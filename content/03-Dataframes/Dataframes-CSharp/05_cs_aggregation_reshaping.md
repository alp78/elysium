---
type: reference
category: programming-languages
technology:
  - csharp
  - dotnet
  - polars
tags: [pipeline, csharp, polars, dataframes]
aliases:
  - groupby, window functions, joins, pivot, melt
keywords: [groupby, agg, window, rolling, join, merge, pivot, melt, unpivot, cross join]
description: "Polars.NET / C# DataFrames reference 05/10 — Aggregation & Reshaping (groupby, windows, joins, pivot, melt). Executable examples with cell outputs. See [[05_py_aggregation_reshaping]] for the Python equivalent."
related:
  - "[[dataframes-index]]"
  - "[[programming-languages-index]]"
  - "[[05_py_aggregation_reshaping]]"
  - "[[04_cs_missing_strings_datetime]]"
  - "[[06_cs_lazy_performance]]"
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# 05 — Aggregation & Reshaping

Polars.NET vs Deedle: Group-by, aggregation, joins, concat, pivot, melt.

---
## 0 — Setup & Imports

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

#### Setup — Install NuGet packages and configure formatters

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
    html = System.Text.RegularExpressions.Regex.Replace(html, @"(>|>)&quot;(.+?)&quot;(<|<)", @"$1$2$3");
    html = System.Text.RegularExpressions.Regex.Replace(html, @">""(.+?)""<", @">$1<");
    var css = """
        <style>
        .pl-dataframe, .pl-dataframe * {
            background: transparent !important;
            background-color: transparent !important;
            color: var(--vscode-editor-foreground, inherit) !important;
        }
        .pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
        .pl-dataframe td, .pl-dataframe th {
            padding: 6px 12px !important;
            text-align: left;
            border: 1px solid var(--vscode-panel-border, #555) !important;
        }
        .pl-dataframe th { font-weight: bold; }
        .pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
        </style>
        """;
    writer.Write(css + html);
}, "text/html");
Formatter.Register<Polars.CSharp.Series>((s, writer) =>
    writer.Write($"<pre style='font-size:14px'>{s}</pre>"), "text/html");

var DATA = Path.Combine("..", "data");
Console.WriteLine($"Data directory: {Path.GetFullPath(DATA)}");
```

    Data directory: c:\Users\aperi\DEV\LANG\data

#### Setup — Load datasets into Polars and Deedle

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

#### Polars.NET — Build exchange dimension table from symbol suffixes

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

<style>
.pl-dataframe, .pl-dataframe * {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--vscode-editor-foreground, inherit) !important;
}
.pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
.pl-dataframe td, .pl-dataframe th {
    padding: 6px 12px !important;
    text-align: left;
    border: 1px solid var(--vscode-panel-border, #555) !important;
}
.pl-dataframe th { font-weight: bold; }
.pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(7 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>suffix<span class='pl-dtype'>utf8view</span></th><th>exchange_name<span class='pl-dtype'>utf8view</span></th><th>country<span class='pl-dtype'>utf8view</span></th></tr></thead><tbody><tr><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>.AS</td><td>Euronext Amsterdam</td><td>Netherlands</td></tr><tr><td>.DE</td><td>XETRA Frankfurt</td><td>Germany</td></tr><tr><td>.PA</td><td>Euronext Paris</td><td>France</td></tr><tr><td>.MC</td><td>Bolsa de Madrid</td><td>Spain</td></tr><tr><td>.MI</td><td>Borsa Italiana</td><td>Italy</td></tr><tr><td>.HE</td><td>Nasdaq Helsinki</td><td>Finland</td></tr></tbody></table></div>

#### Deedle — Build matching exchange dimension frame

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

<style scoped>,

  .dataframe tbody tr th:only-of-type {

    vertical-align: middle;

  }

  .dataframe tbody tr th {,

    vertical-align: top

  }

  .dataframe thead th {

    text-align: right;

  }

  .no-wrap {

    white-space: nowrap;

  }

</style>

<table border='1' class='dataframe'>

<thead><th></th><th></th><th>suffix</th><th>exchange_name</th><th>country</th></thead><thead><th></th><th></th><th>(string)</th><th>(string)</th><th>(string)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>.AS</td><td>Euronext Amsterdam</td><td>Netherlands</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>.DE</td><td>XETRA Frankfurt</td><td>Germany</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>.PA</td><td>Euronext Paris</td><td>France</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>.MC</td><td>Bolsa de Madrid</td><td>Spain</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>.MI</td><td>Borsa Italiana</td><td>Italy</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>.HE</td><td>Nasdaq Helsinki</td><td>Finland</td></tr>

</table>

<p><b>7</b> rows x <b>3</b> columns</p><p><b>0</b> missing values</p>

</div>

---
## 1 — Grouping & Aggregation

#### Polars.NET — GroupBy single column with mean aggregation

```csharp
// Polars.NET — Average closing price per symbol
var avgCloseP = dfP
    .GroupBy("symbol")
    .Agg(Col("close").Mean().Alias("avg_close"));

avgCloseP.Head(10)
```

<style>
.pl-dataframe, .pl-dataframe * {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--vscode-editor-foreground, inherit) !important;
}
.pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
.pl-dataframe td, .pl-dataframe th {
    padding: 6px 12px !important;
    text-align: left;
    border: 1px solid var(--vscode-panel-border, #555) !important;
}
.pl-dataframe th { font-weight: bold; }
.pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 2 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>avg_close<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>54.86423366</td></tr><tr><td>AD.AS</td><td>29.6526559</td></tr><tr><td>ADS.DE</td><td>205.4264804</td></tr><tr><td>ADYEN.AS</td><td>1545.976409</td></tr><tr><td>AI.PA</td><td>145.4284434</td></tr><tr><td>AIR.PA</td><td>134.5841172</td></tr><tr><td>ALV.DE</td><td>252.1937311</td></tr><tr><td>ARGX.BR</td><td>413.6919609</td></tr><tr><td>ASML.AS</td><td>671.3489106</td></tr><tr><td>BAS.DE</td><td>50.56185423</td></tr></tbody></table></div>

#### Deedle — GroupBy single column with mean aggregation

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

#### Polars.NET — GroupBy multiple columns

```csharp
// Polars.NET — Group by symbol + is_filled, count rows
var multiGroupP = dfP
    .GroupBy("symbol", "is_filled")
    .Agg(Col("close").Count().Alias("row_count"));

multiGroupP.Head(10)
```

<style>
.pl-dataframe, .pl-dataframe * {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--vscode-editor-foreground, inherit) !important;
}
.pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
.pl-dataframe td, .pl-dataframe th {
    padding: 6px 12px !important;
    text-align: left;
    border: 1px solid var(--vscode-panel-border, #555) !important;
}
.pl-dataframe th { font-weight: bold; }
.pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>is_filled<span class='pl-dtype'>bool</span></th><th>row_count<span class='pl-dtype'>uint32</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>false</td><td>1331</td></tr><tr><td>AD.AS</td><td>false</td><td>1331</td></tr><tr><td>ADS.DE</td><td>false</td><td>1324</td></tr><tr><td>ADYEN.AS</td><td>false</td><td>1331</td></tr><tr><td>AI.PA</td><td>false</td><td>1331</td></tr><tr><td>AIR.PA</td><td>false</td><td>1331</td></tr><tr><td>ALV.DE</td><td>false</td><td>1324</td></tr><tr><td>ARGX.BR</td><td>false</td><td>1331</td></tr><tr><td>ASML.AS</td><td>false</td><td>1331</td></tr><tr><td>BAS.DE</td><td>false</td><td>1324</td></tr></tbody></table></div>

#### Deedle — GroupBy multiple columns

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

#### Polars.NET — Multiple aggregations in a single Agg call

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

<style>
.pl-dataframe, .pl-dataframe * {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--vscode-editor-foreground, inherit) !important;
}
.pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
.pl-dataframe td, .pl-dataframe th {
    padding: 6px 12px !important;
    text-align: left;
    border: 1px solid var(--vscode-panel-border, #555) !important;
}
.pl-dataframe th { font-weight: bold; }
.pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 7 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>sum_close<span class='pl-dtype'>double</span></th><th>mean_close<span class='pl-dtype'>double</span></th><th>count<span class='pl-dtype'>uint32</span></th><th>min_close<span class='pl-dtype'>double</span></th><th>max_close<span class='pl-dtype'>double</span></th><th>total_volume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>73024.295</td><td>54.86423366</td><td>1331</td><td>45.06</td><td>68.82</td><td>2114455849</td></tr><tr><td>AD.AS</td><td>39467.685</td><td>29.6526559</td><td>1331</td><td>21.72</td><td>41.77</td><td>3214250982</td></tr><tr><td>ADS.DE</td><td>271984.66</td><td>205.4264804</td><td>1324</td><td>93.95</td><td>336.25</td><td>740793162</td></tr><tr><td>ADYEN.AS</td><td>2057694.6</td><td>1545.976409</td><td>1331</td><td>630.8</td><td>2766</td><td>110400463</td></tr><tr><td>AI.PA</td><td>193565.2582</td><td>145.4284434</td><td>1331</td><td>103.0579</td><td>186.64</td><td>1023869587</td></tr><tr><td>AIR.PA</td><td>179131.46</td><td>134.5841172</td><td>1331</td><td>83.11</td><td>220.2</td><td>1648955654</td></tr><tr><td>ALV.DE</td><td>333904.5</td><td>252.1937311</td><td>1324</td><td>159.62</td><td>392.7</td><td>1101960308</td></tr><tr><td>ARGX.BR</td><td>550624</td><td>413.6919609</td><td>1331</td><td>208.8</td><td>803</td><td>94592244</td></tr><tr><td>ASML.AS</td><td>893565.4</td><td>671.3489106</td><td>1331</td><td>397.45</td><td>1288.4</td><td>945070720</td></tr><tr><td>BAS.DE</td><td>66943.895</td><td>50.56185423</td><td>1324</td><td>38.85</td><td>72.61</td><td>3570432622</td></tr></tbody></table></div>

#### Deedle — Multiple aggregations manually per column

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

<style scoped>,

  .dataframe tbody tr th:only-of-type {

    vertical-align: middle;

  }

  .dataframe tbody tr th {,

    vertical-align: top

  }

  .dataframe thead th {

    text-align: right;

  }

  .no-wrap {

    white-space: nowrap;

  }

</style>

<table border='1' class='dataframe'>

<thead><th></th><th></th><th>symbol</th><th>sum_close</th><th>mean_close</th><th>count</th><th>min_close</th><th>max_close</th><th>total_volume</th></thead><thead><th></th><th></th><th>(string)</th><th>(float)</th><th>(float)</th><th>(float)</th><th>(float)</th><th>(float)</th><th>(float)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>73024.29499999993</td><td>54.864233658903025</td><td>1331</td><td>45.06</td><td>68.82</td><td>2114455849</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>AD.AS</td><td>39467.68500000005</td><td>29.652655897821223</td><td>1331</td><td>21.72</td><td>41.77</td><td>3214250982</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ADS.DE</td><td>271984.6599999997</td><td>205.42648036253752</td><td>1324</td><td>93.95</td><td>336.25</td><td>740793162</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ADYEN.AS</td><td>2057694.6</td><td>1545.9764087152519</td><td>1331</td><td>630.8</td><td>2766</td><td>110400463</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>AI.PA</td><td>193565.2581999998</td><td>145.42844342599534</td><td>1331</td><td>103.0579</td><td>186.64</td><td>1023869587</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>AIR.PA</td><td>179131.46000000005</td><td>134.58411720510898</td><td>1331</td><td>83.11</td><td>220.2</td><td>1648955654</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>ALV.DE</td><td>333904.5000000002</td><td>252.1937311178249</td><td>1324</td><td>159.62</td><td>392.7</td><td>1101960308</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>ARGX.BR</td><td>550623.9999999994</td><td>413.6919609316299</td><td>1331</td><td>208.8</td><td>803</td><td>94592244</td></tr><tr><td><b>8</b></td><td class="no-wrap">-></td><td>ASML.AS</td><td>893565.4000000005</td><td>671.348910593539</td><td>1331</td><td>397.45</td><td>1288.4</td><td>945070720</td></tr><tr><td><b>9</b></td><td class="no-wrap">-></td><td>BAS.DE</td><td>66943.89499999997</td><td>50.561854229607235</td><td>1324</td><td>38.85</td><td>72.61</td><td>3570432622</td></tr>

</table>

<p><b>10</b> rows x <b>7</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Group head: top N rows per group

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

<style>
.pl-dataframe, .pl-dataframe * {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--vscode-editor-foreground, inherit) !important;
}
.pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
.pl-dataframe td, .pl-dataframe th {
    padding: 6px 12px !important;
    text-align: left;
    border: 1px solid var(--vscode-panel-border, #555) !important;
}
.pl-dataframe th { font-weight: bold; }
.pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(9 rows, 4 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>close<span class='pl-dtype'>double</span></th><th>row_num<span class='pl-dtype'>int32</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>1</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-11</td><td>56.61</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-12</td><td>56.51</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-13</td><td>56.48</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-14</td><td>56.96</td><td>0</td></tr></tbody></table></div>

#### Deedle — Group head: top N rows per group

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

<style scoped>,

  .dataframe tbody tr th:only-of-type {

    vertical-align: middle;

  }

  .dataframe tbody tr th {,

    vertical-align: top

  }

  .dataframe thead th {

    text-align: right;

  }

  .no-wrap {

    white-space: nowrap;

  }

</style>

<table border='1' class='dataframe'>

<thead><th></th><th></th><th></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></thead><thead><th></th><th></th><th></th><th>(int)</th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Boolean)</th></thead>

<tr><td><b>ABI.BR</b></td><td><b>0</b></td><td class="no-wrap">-></td><td>21160</td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b></b></td><td><b>1</b></td><td class="no-wrap">-></td><td>21161</td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b></b></td><td><b>2</b></td><td class="no-wrap">-></td><td>21162</td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>AD.AS</b></td><td><b>1331</b></td><td class="no-wrap">-></td><td>59438</td><td>AD.AS</td><td>04-Jan-21 0:00:00</td><td>23.38</td><td>23.83</td><td>23.38</td><td>23.79</td><td>19.9339</td><td>3526165</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b></b></td><td><b>1332</b></td><td class="no-wrap">-></td><td>59439</td><td>AD.AS</td><td>05-Jan-21 0:00:00</td><td>23.71</td><td>23.93</td><td>23.61</td><td>23.68</td><td>19.8417</td><td>3405805</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b></b></td><td><b>1333</b></td><td class="no-wrap">-></td><td>59440</td><td>AD.AS</td><td>06-Jan-21 0:00:00</td><td>23.7</td><td>23.87</td><td>23.61</td><td>23.76</td><td>19.9088</td><td>3033335</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>ADS.DE</b></td><td><b>2662</b></td><td class="no-wrap">-></td><td>62088</td><td>ADS.DE</td><td>04-Jan-21 0:00:00</td><td>300.0</td><td>300.5</td><td>293.0</td><td>295.4</td><td>282.2904</td><td>440364</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b></b></td><td><b>2663</b></td><td class="no-wrap">-></td><td>62089</td><td>ADS.DE</td><td>05-Jan-21 0:00:00</td><td>292.9</td><td>295.4</td><td>288.2</td><td>289.6</td><td>276.7479</td><td>436591</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b></b></td><td><b>2664</b></td><td class="no-wrap">-></td><td>62090</td><td>ADS.DE</td><td>06-Jan-21 0:00:00</td><td>290.7</td><td>292.7</td><td>286.8</td><td>291.7</td><td>278.7546</td><td>392602</td><td>0.0</td><td>0.0</td><td>False</td></tr>

</table>

<p><b>9</b> rows x <b>12</b> columns</p><p><b>0</b> missing values</p>

</div>

---
## 2 — Window Functions

For a cross-language comparison of window functions, pivots, and ranking across SQL, Python, and C#, see [[sql-python-csharp-transforms]]. The SQL Server gold layer in [[gold-transforms]] applies the same windowed aggregations to produce final analytical tables.

#### Polars.NET — Mean over group (window function)

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

<style>
.pl-dataframe, .pl-dataframe * {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--vscode-editor-foreground, inherit) !important;
}
.pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
.pl-dataframe td, .pl-dataframe th {
    padding: 6px 12px !important;
    text-align: left;
    border: 1px solid var(--vscode-panel-border, #555) !important;
}
.pl-dataframe th { font-weight: bold; }
.pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(8 rows, 4 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>close<span class='pl-dtype'>double</span></th><th>mean_close_over<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-11</td><td>56.61</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-12</td><td>56.51</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-13</td><td>56.48</td><td>54.86423366</td></tr></tbody></table></div>

// Polars.NET — Split first 10 and next 10, then vertical concat
var topP = dfP.Head(10);
var botP = dfP.Slice(10, 10);
var vcatP = Polars.CSharp.Polars.Concat(new[] { topP, botP });

display($"Top: {topP.Shape}  Bot: {botP.Shape}  Concat: {vcatP.Shape}");
vcatP.Head(5)

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

<style scoped>,

  .dataframe tbody tr th:only-of-type {

    vertical-align: middle;

  }

  .dataframe tbody tr th {,

    vertical-align: top

  }

  .dataframe thead th {

    text-align: right;

  }

  .no-wrap {

    white-space: nowrap;

  }

</style>

<table border='1' class='dataframe'>

<thead><th></th><th></th><th>symbol</th><th>date</th><th>close</th><th>mean_close_by_symbol</th></thead><thead><th></th><th></th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(float)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>57.21</td><td>54.864233658903025</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>57.18</td><td>54.864233658903025</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>58.77</td><td>54.864233658903025</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>07-Jan-21 0:00:00</td><td>58.4</td><td>54.864233658903025</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>08-Jan-21 0:00:00</td><td>57.86</td><td>54.864233658903025</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>11-Jan-21 0:00:00</td><td>56.61</td><td>54.864233658903025</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>12-Jan-21 0:00:00</td><td>56.51</td><td>54.864233658903025</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>13-Jan-21 0:00:00</td><td>56.48</td><td>54.864233658903025</td></tr>

</table>

<p><b>8</b> rows x <b>4</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Rank within group (window function)

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

<style>
.pl-dataframe, .pl-dataframe * {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--vscode-editor-foreground, inherit) !important;
}
.pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
.pl-dataframe td, .pl-dataframe th {
    padding: 6px 12px !important;
    text-align: left;
    border: 1px solid var(--vscode-panel-border, #555) !important;
}
.pl-dataframe th { font-weight: bold; }
.pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(8 rows, 4 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>close<span class='pl-dtype'>double</span></th><th>rank_in_group<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>946.5</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>940.5</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>1126</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>1085.5</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>1024</td></tr><tr><td>ABI.BR</td><td>2021-01-11</td><td>56.61</td><td>887.5</td></tr><tr><td>ABI.BR</td><td>2021-01-12</td><td>56.51</td><td>875.5</td></tr><tr><td>ABI.BR</td><td>2021-01-13</td><td>56.48</td><td>871</td></tr></tbody></table></div>

#### Deedle — Rank within group (manual computation)

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

<style scoped>,

  .dataframe tbody tr th:only-of-type {

    vertical-align: middle;

  }

  .dataframe tbody tr th {,

    vertical-align: top

  }

  .dataframe thead th {

    text-align: right;

  }

  .no-wrap {

    white-space: nowrap;

  }

</style>

<table border='1' class='dataframe'>

<thead><th></th><th></th><th>symbol</th><th>date</th><th>close</th><th>rank_in_group</th></thead><thead><th></th><th></th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(int)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>57.21</td><td>946</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>57.18</td><td>940</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>58.77</td><td>1125</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>07-Jan-21 0:00:00</td><td>58.4</td><td>1085</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>08-Jan-21 0:00:00</td><td>57.86</td><td>1023</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>11-Jan-21 0:00:00</td><td>56.61</td><td>887</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>12-Jan-21 0:00:00</td><td>56.51</td><td>875</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>13-Jan-21 0:00:00</td><td>56.48</td><td>871</td></tr>

</table>

<p><b>8</b> rows x <b>4</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Rolling mean over group (window function)

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

<style>
.pl-dataframe, .pl-dataframe * {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--vscode-editor-foreground, inherit) !important;
}
.pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
.pl-dataframe td, .pl-dataframe th {
    padding: 6px 12px !important;
    text-align: left;
    border: 1px solid var(--vscode-panel-border, #555) !important;
}
.pl-dataframe th { font-weight: bold; }
.pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 4 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>close<span class='pl-dtype'>double</span></th><th>rolling_mean_20<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>57.21</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>57.195</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>57.72</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>57.89</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>57.884</td></tr><tr><td>ABI.BR</td><td>2021-01-11</td><td>56.61</td><td>57.67166667</td></tr><tr><td>ABI.BR</td><td>2021-01-12</td><td>56.51</td><td>57.50571429</td></tr><tr><td>ABI.BR</td><td>2021-01-13</td><td>56.48</td><td>57.3775</td></tr><tr><td>ABI.BR</td><td>2021-01-14</td><td>56.96</td><td>57.33111111</td></tr><tr><td>ABI.BR</td><td>2021-01-15</td><td>56.74</td><td>57.272</td></tr></tbody></table></div>

#### Deedle — Rolling mean over group (manual windowed computation)

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

<style scoped>,

  .dataframe tbody tr th:only-of-type {

    vertical-align: middle;

  }

  .dataframe tbody tr th {,

    vertical-align: top

  }

  .dataframe thead th {

    text-align: right;

  }

  .no-wrap {

    white-space: nowrap;

  }

</style>

<table border='1' class='dataframe'>

<thead><th></th><th></th><th>symbol</th><th>date</th><th>close</th><th>rolling_mean_20</th></thead><thead><th></th><th></th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(float)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>57.21</td><td>57.21</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>57.18</td><td>57.195</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>58.77</td><td>57.72</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>07-Jan-21 0:00:00</td><td>58.4</td><td>57.89</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>08-Jan-21 0:00:00</td><td>57.86</td><td>57.884</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>11-Jan-21 0:00:00</td><td>56.61</td><td>57.671666666666674</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>12-Jan-21 0:00:00</td><td>56.51</td><td>57.50571428571429</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>13-Jan-21 0:00:00</td><td>56.48</td><td>57.377500000000005</td></tr><tr><td><b>8</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>14-Jan-21 0:00:00</td><td>56.96</td><td>57.33111111111111</td></tr><tr><td><b>9</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>15-Jan-21 0:00:00</td><td>56.74</td><td>57.272000000000006</td></tr>

</table>

<p><b>10</b> rows x <b>4</b> columns</p><p><b>0</b> missing values</p>

</div>

---
## 3 — Joins

#### Polars.NET — Inner join on exchange suffix

```csharp
// Polars.NET — Inner join OHLCV (with suffix) to exchange dimension
var innerP = dfPWithSuffix.Join(dimExP,
    new[] { Col("suffix") }, new[] { Col("suffix") });

display($"Inner join shape: {innerP.Shape}");
innerP.Select("symbol", "date", "close", "suffix", "exchange_name", "country").Head(8)
```

    Inner join shape: (66355, 15)

<style>
.pl-dataframe, .pl-dataframe * {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--vscode-editor-foreground, inherit) !important;
}
.pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
.pl-dataframe td, .pl-dataframe th {
    padding: 6px 12px !important;
    text-align: left;
    border: 1px solid var(--vscode-panel-border, #555) !important;
}
.pl-dataframe th { font-weight: bold; }
.pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(8 rows, 6 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>close<span class='pl-dtype'>double</span></th><th>suffix<span class='pl-dtype'>utf8view</span></th><th>exchange_name<span class='pl-dtype'>utf8view</span></th><th>country<span class='pl-dtype'>utf8view</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-11</td><td>56.61</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-12</td><td>56.51</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-13</td><td>56.48</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr></tbody></table></div>

#### Deedle — Inner join on exchange suffix

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

<style scoped>,

  .dataframe tbody tr th:only-of-type {

    vertical-align: middle;

  }

  .dataframe tbody tr th {,

    vertical-align: top

  }

  .dataframe thead th {

    text-align: right;

  }

  .no-wrap {

    white-space: nowrap;

  }

</style>

<table border='1' class='dataframe'>

<thead><th></th><th></th><th>symbol</th><th>date</th><th>close</th><th>suffix</th><th>exchange_name</th><th>country</th></thead><thead><th></th><th></th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(string)</th><th>(string)</th><th>(string)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>57.21</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>57.18</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>58.77</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>07-Jan-21 0:00:00</td><td>58.4</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>08-Jan-21 0:00:00</td><td>57.86</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>11-Jan-21 0:00:00</td><td>56.61</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>12-Jan-21 0:00:00</td><td>56.51</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>13-Jan-21 0:00:00</td><td>56.48</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr>

</table>

<p><b>8</b> rows x <b>6</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Left join on exchange suffix

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

<style>
.pl-dataframe, .pl-dataframe * {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--vscode-editor-foreground, inherit) !important;
}
.pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
.pl-dataframe td, .pl-dataframe th {
    padding: 6px 12px !important;
    text-align: left;
    border: 1px solid var(--vscode-panel-border, #555) !important;
}
.pl-dataframe th { font-weight: bold; }
.pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>suffix<span class='pl-dtype'>utf8view</span></th><th>exchange_name<span class='pl-dtype'>utf8view</span></th></tr></thead><tbody><tr><td>AD.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>ADYEN.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>ASML.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>INGA.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>PRX.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>WKL.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>ABI.BR</td><td>.BR</td><td class='pl-null'>null</td></tr><tr><td>ARGX.BR</td><td>.BR</td><td class='pl-null'>null</td></tr><tr><td>ADS.DE</td><td>.DE</td><td>XETRA Frankfurt</td></tr><tr><td>ALV.DE</td><td>.DE</td><td>XETRA Frankfurt</td></tr></tbody></table></div>

#### Deedle — Left join on exchange suffix

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

<style scoped>,

  .dataframe tbody tr th:only-of-type {

    vertical-align: middle;

  }

  .dataframe tbody tr th {,

    vertical-align: top

  }

  .dataframe thead th {

    text-align: right;

  }

  .no-wrap {

    white-space: nowrap;

  }

</style>

<table border='1' class='dataframe'>

<thead><th></th><th></th><th>symbol</th><th>close</th><th>suffix</th><th>exchange_name</th><th>country</th></thead><thead><th></th><th></th><th>(string)</th><th>(Decimal)</th><th>(string)</th><th>(string)</th><th>(string)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>57.21</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>57.18</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>58.77</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>58.4</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>57.86</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>56.61</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>56.51</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>56.48</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr>

</table>

<p><b>8</b> rows x <b>5</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Anti join (rows with no match)

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

<style>
.pl-dataframe, .pl-dataframe * {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--vscode-editor-foreground, inherit) !important;
}
.pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
.pl-dataframe td, .pl-dataframe th {
    padding: 6px 12px !important;
    text-align: left;
    border: 1px solid var(--vscode-panel-border, #555) !important;
}
.pl-dataframe th { font-weight: bold; }
.pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(8 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>suffix<span class='pl-dtype'>utf8view</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-11</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-12</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-13</td><td>.BR</td></tr></tbody></table></div>

#### Deedle — Anti join workaround (manual set difference)

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

---
## 4 — Concatenation

#### Polars.NET — Vertical concatenation (stacking rows)

```csharp
// Polars.NET — Split first 10 and next 10, then vertical concat
var topP = dfP.Head(10);
var botP = dfP.Slice(10, 10);
var vcatP = topP.VStack(botP);

display($"Top: {topP.Shape}  Bot: {botP.Shape}  VStack: {vcatP.Shape}");
vcatP.Head(5)
```

    Top: (10, 12)  Bot: (10, 12)  VStack: (20, 12)

<style>
.pl-dataframe, .pl-dataframe * {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--vscode-editor-foreground, inherit) !important;
}
.pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
.pl-dataframe td, .pl-dataframe th {
    padding: 6px 12px !important;
    text-align: left;
    border: 1px solid var(--vscode-panel-border, #555) !important;
}
.pl-dataframe th { font-weight: bold; }
.pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 12 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>id<span class='pl-dtype'>int64</span></th><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>adj_close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>dividends<span class='pl-dtype'>double</span></th><th>stock_splits<span class='pl-dtype'>double</span></th><th>is_filled<span class='pl-dtype'>bool</span></th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Deedle — Vertical concatenation (stacking rows)

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

<style scoped>,

  .dataframe tbody tr th:only-of-type {

    vertical-align: middle;

  }

  .dataframe tbody tr th {,

    vertical-align: top

  }

  .dataframe thead th {

    text-align: right;

  }

  .no-wrap {

    white-space: nowrap;

  }

</style>

<table border='1' class='dataframe'>

<thead><th></th><th></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></thead><thead><th></th><th></th><th>(int)</th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Boolean)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>21160</td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>21161</td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>21162</td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>21163</td><td>ABI.BR</td><td>07-Jan-21 0:00:00</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>21164</td><td>ABI.BR</td><td>08-Jan-21 0:00:00</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>False</td></tr>

</table>

<p><b>5</b> rows x <b>12</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Horizontal concatenation (adding columns)

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

<style>
.pl-dataframe, .pl-dataframe * {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--vscode-editor-foreground, inherit) !important;
}
.pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
.pl-dataframe td, .pl-dataframe th {
    padding: 6px 12px !important;
    text-align: left;
    border: 1px solid var(--vscode-panel-border, #555) !important;
}
.pl-dataframe th { font-weight: bold; }
.pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 6 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>1513937</td><td>58.85</td><td>56.78</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>1382722</td><td>57.98</td><td>56.75</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>1370204</td><td>58.94</td><td>57.39</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>1469911</td><td>58.86</td><td>57.88</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>1428681</td><td>58.4</td><td>57.43</td></tr></tbody></table></div>

#### Deedle — Horizontal concatenation (adding columns)

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

<style scoped>,

  .dataframe tbody tr th:only-of-type {

    vertical-align: middle;

  }

  .dataframe tbody tr th {,

    vertical-align: top

  }

  .dataframe thead th {

    text-align: right;

  }

  .no-wrap {

    white-space: nowrap;

  }

</style>

<table border='1' class='dataframe'>

<thead><th></th><th></th><th>symbol</th><th>date</th><th>close</th><th>volume</th><th>high</th><th>low</th></thead><thead><th></th><th></th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>57.21</td><td>1513937</td><td>58.85</td><td>56.78</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>57.18</td><td>1382722</td><td>57.98</td><td>56.75</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>58.77</td><td>1370204</td><td>58.94</td><td>57.39</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>07-Jan-21 0:00:00</td><td>58.4</td><td>1469911</td><td>58.86</td><td>57.88</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>08-Jan-21 0:00:00</td><td>57.86</td><td>1428681</td><td>58.4</td><td>57.43</td></tr>

</table>

<p><b>5</b> rows x <b>6</b> columns</p><p><b>0</b> missing values</p>

</div>

---
## 5 — Reshaping

#### Polars.NET — Pivot (long to wide)

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

<style>
.pl-dataframe, .pl-dataframe * {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--vscode-editor-foreground, inherit) !important;
}
.pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
.pl-dataframe td, .pl-dataframe th {
    padding: 6px 12px !important;
    text-align: left;
    border: 1px solid var(--vscode-panel-border, #555) !important;
}
.pl-dataframe th { font-weight: bold; }
.pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(1 rows, 31 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>2021-01-04<span class='pl-dtype'>double</span></th><th>2021-01-05<span class='pl-dtype'>double</span></th><th>2021-01-06<span class='pl-dtype'>double</span></th><th>2021-01-07<span class='pl-dtype'>double</span></th><th>2021-01-08<span class='pl-dtype'>double</span></th><th>2021-01-11<span class='pl-dtype'>double</span></th><th>2021-01-12<span class='pl-dtype'>double</span></th><th>2021-01-13<span class='pl-dtype'>double</span></th><th>2021-01-14<span class='pl-dtype'>double</span></th><th>2021-01-15<span class='pl-dtype'>double</span></th><th>2021-01-18<span class='pl-dtype'>double</span></th><th>2021-01-19<span class='pl-dtype'>double</span></th><th>2021-01-20<span class='pl-dtype'>double</span></th><th>2021-01-21<span class='pl-dtype'>double</span></th><th>2021-01-22<span class='pl-dtype'>double</span></th><th>2021-01-25<span class='pl-dtype'>double</span></th><th>2021-01-26<span class='pl-dtype'>double</span></th><th>2021-01-27<span class='pl-dtype'>double</span></th><th>2021-01-28<span class='pl-dtype'>double</span></th><th>2021-01-29<span class='pl-dtype'>double</span></th><th>2021-02-01<span class='pl-dtype'>double</span></th><th>2021-02-02<span class='pl-dtype'>double</span></th><th>2021-02-03<span class='pl-dtype'>double</span></th><th>2021-02-04<span class='pl-dtype'>double</span></th><th>2021-02-05<span class='pl-dtype'>double</span></th><th>2021-02-08<span class='pl-dtype'>double</span></th><th>2021-02-09<span class='pl-dtype'>double</span></th><th>2021-02-10<span class='pl-dtype'>double</span></th><th>2021-02-11<span class='pl-dtype'>double</span></th><th>2021-02-12<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ASML.AS</td><td>406.25</td><td>406.9</td><td>402.85</td><td>403.9</td><td>416.05</td><td>414.9</td><td>418.95</td><td>422.45</td><td>447.35</td><td>435.85</td><td>437.6</td><td>439.9</td><td>453.15</td><td>470.55</td><td>462.9</td><td>461.35</td><td>458.55</td><td>440.65</td><td>449</td><td>439.45</td><td>454.9</td><td>457.5</td><td>457.15</td><td>459.55</td><td>460</td><td>467.1</td><td>469.75</td><td>464.1</td><td>480.45</td><td>494.75</td></tr></tbody></table></div>

#### Deedle — Pivot (long to wide)

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

<style scoped>,

  .dataframe tbody tr th:only-of-type {

    vertical-align: middle;

  }

  .dataframe tbody tr th {,

    vertical-align: top

  }

  .dataframe thead th {

    text-align: right;

  }

  .no-wrap {

    white-space: nowrap;

  }

</style>

<table border='1' class='dataframe'>

<thead><th></th><th></th><th>SAP.DE</th><th>ASML.AS</th><th>MC.PA</th></thead><thead><th></th><th></th><th>(float)</th><th>(float)</th><th>(float)</th></thead>

<tr><td><b>04-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>105.32</td><td>406.25</td><td>512.1</td></tr><tr><td><b>05-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>105.04</td><td>406.9</td><td>506.2</td></tr><tr><td><b>06-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>105.48</td><td>402.85</td><td>502.3</td></tr><tr><td><b>07-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>104.52</td><td>403.9</td><td>515.3</td></tr><tr><td><b>08-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>106.18</td><td>416.05</td><td>525.3</td></tr><tr><td><b>11-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>106.04</td><td>414.9</td><td>522.4</td></tr><tr><td><b>12-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>105.74</td><td>418.95</td><td>515.8</td></tr><tr><td><b>13-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>105.36</td><td>422.45</td><td>512.1</td></tr><tr><td><b>14-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>104.2</td><td>447.35</td><td>508</td></tr><tr><td><b>15-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>103.52</td><td>435.85</td><td>493.95</td></tr>

</table>

<p><b>10</b> rows x <b>3</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Unpivot / Melt (wide to long)

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

<style>
.pl-dataframe, .pl-dataframe * {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--vscode-editor-foreground, inherit) !important;
}
.pl-dataframe { font-size: 14px !important; border-collapse: collapse; width: auto; }
.pl-dataframe td, .pl-dataframe th {
    padding: 6px 12px !important;
    text-align: left;
    border: 1px solid var(--vscode-panel-border, #555) !important;
}
.pl-dataframe th { font-weight: bold; }
.pl-dataframe .pl-dtype { font-size: 11px; opacity: 0.5; }
</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(12 rows, 4 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>variable<span class='pl-dtype'>utf8view</span></th><th>value<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>open</td><td>58.15</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>open</td><td>56.9</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>open</td><td>57.96</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>open</td><td>58.68</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>open</td><td>58.16</td></tr><tr><td>ABI.BR</td><td>2021-01-04</td><td>high</td><td>58.85</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>high</td><td>57.98</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>high</td><td>58.94</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>high</td><td>58.86</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>high</td><td>58.4</td></tr><tr><td colspan='4' style='text-align:center; font-style:italic; color:#999; padding: 10px'>... 2 more rows ...</td></tr></tbody></table></div>

#### Deedle — Unpivot / Melt (wide to long via manual reshape)

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

<style scoped>,

  .dataframe tbody tr th:only-of-type {

    vertical-align: middle;

  }

  .dataframe tbody tr th {,

    vertical-align: top

  }

  .dataframe thead th {

    text-align: right;

  }

  .no-wrap {

    white-space: nowrap;

  }

</style>

<table border='1' class='dataframe'>

<thead><th></th><th></th><th>symbol</th><th>date</th><th>variable</th><th>value</th></thead><thead><th></th><th></th><th>(string)</th><th>(string)</th><th>(string)</th><th>(float)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>open</td><td>58.15</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>high</td><td>58.85</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>low</td><td>56.78</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>close</td><td>57.21</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>open</td><td>56.9</td></tr><tr><td><b>:</b></td><td class="no-wrap"></td><td>...</td><td>...</td><td>...</td><td>...</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>close</td><td>57.18</td></tr><tr><td><b>8</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>open</td><td>57.96</td></tr><tr><td><b>9</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>high</td><td>58.94</td></tr><tr><td><b>10</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>low</td><td>57.39</td></tr><tr><td><b>11</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>close</td><td>58.77</td></tr>

</table>

<p><b>12</b> rows x <b>4</b> columns</p><p><b>0</b> missing values</p>

</div>

---
## 6 — Summary Comparison

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
| **Vertical concat** | `Polars.Concat(df1, df2)` | `frame1.Merge(frame2)` |
| **Horizontal concat** | `.HStack(series)` per column | `frame1.Join(frame2, JoinKind.Inner)` |
| **Pivot** | `.Pivot("index", "columns", "values")` | `.PivotTable<R, C, V>(rowCol, colCol, fn)` |
| **Unpivot / Melt** | `.Unpivot(on, index)` | Manual: iterate rows, build long frame |
