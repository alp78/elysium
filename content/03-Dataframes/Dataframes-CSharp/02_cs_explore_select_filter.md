---
type: reference
category: programming-languages
technology:
  - csharp
  - dotnet
  - polars
tags: [pipeline, csharp, deedle, polars, dataframes]
aliases:
  - head, tail, describe, filter, where, isin
keywords: [head, tail, describe, select, filter, where, isin, column selection, row filtering, boolean indexing]
description: "Polars.NET / C# DataFrames reference 02/10 — Explore, Select & Filter (head/tail, describe, where, isin). Executable examples with cell outputs. See [[02_py_explore_select_filter]] for the Python equivalent."
related:
  - "[[dataframes-index]]"
  - "[[programming-languages-index]]"
  - "[[02_py_explore_select_filter]]"
  - "[[01_cs_foundations_io]]"
  - "[[03_cs_transforms_expressions]]"
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# 02 — Exploration, Selection & Filtering

Polars.NET vs Deedle: Inspect data, select columns, filter rows.

---
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

#### Install NuGet packages and import namespaces

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
    html = System.Text.RegularExpressions.Regex.Replace(html, @"(&gt;|>)&quot;(.+?)&quot;(&lt;|<)", @"$1$2$3");
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

#### Load the primary datasets used throughout this notebook

```csharp
// Polars.NET — load primary datasets
var dfP = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"), tryParseDates: true);
var dimP = DataFrame.ReadCsv(Path.Combine(DATA, "dim_country.csv"));

display($"OHLCV: {dfP.Shape}  |  DimCountry: {dimP.Shape}");

// Deedle — load same datasets
var dfD = Frame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"));
var dimD = Frame.ReadCsv(Path.Combine(DATA, "dim_country.csv"));

display($"OHLCV: {dfD.RowCount} x {dfD.ColumnCount}  |  DimCountry: {dimD.RowCount} x {dimD.ColumnCount}");
```

    OHLCV: (66355, 12)  |  DimCountry: (212, 2)

    OHLCV: 66355 x 12  |  DimCountry: 212 x 2

---
## Data Exploration

#### Polars.NET — Data Exploration: preview first and last rows with Head and Tail

```csharp
// Polars.NET — Head / Tail
display("Head(5):");
display(dfP.Head(5));
display("Tail(5):");
dfP.Tail(5)
```

    Head(5):

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

    Tail(5):

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>64828</td><td>WKL.AS</td><td>2026-03-06</td><td>69.02</td><td>69.36</td><td>67.82</td><td>68.52</td><td>68.52</td><td>1143729</td><td>0</td><td>0</td><td>false</td></tr><tr><td>66875</td><td>WKL.AS</td><td>2026-03-09</td><td>68.78</td><td>69.16</td><td>67.64</td><td>68.64</td><td>68.64</td><td>841503</td><td>0</td><td>0</td><td>false</td></tr><tr><td>66876</td><td>WKL.AS</td><td>2026-03-10</td><td>68.8</td><td>69.16</td><td>66.34</td><td>67.16</td><td>67.16</td><td>1355645</td><td>0</td><td>0</td><td>false</td></tr><tr><td>66877</td><td>WKL.AS</td><td>2026-03-11</td><td>67.5</td><td>69.6</td><td>67.02</td><td>67.22</td><td>67.22</td><td>1142531</td><td>0</td><td>0</td><td>false</td></tr><tr><td>66929</td><td>WKL.AS</td><td>2026-03-12</td><td>67</td><td>67.54</td><td>66.28</td><td>67.32</td><td>67.32</td><td>210379</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Deedle — Preview first and last rows with GetRowsAt

```csharp
// Deedle — Head / Tail
display("Head(5):");
display(dfD.Rows[Enumerable.Range(0, 5)]);
display("Tail(5):");
dfD.Rows[Enumerable.Range(dfD.RowCount - 5, 5)]
```

    Head(5):

<div>

<table>

<thead><th></th><th></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></thead><thead><th></th><th></th><th>(int)</th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Boolean)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>21160</td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>21161</td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>21162</td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>21163</td><td>ABI.BR</td><td>07-Jan-21 0:00:00</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>21164</td><td>ABI.BR</td><td>08-Jan-21 0:00:00</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>False</td></tr>

</table>

<p><b>5</b> rows x <b>12</b> columns</p><p><b>0</b> missing values</p>

</div>

    Tail(5):

<div>

<table>

<thead><th></th><th></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></thead><thead><th></th><th></th><th>(int)</th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Boolean)</th></thead>

<tr><td><b>66350</b></td><td class="no-wrap">-></td><td>64828</td><td>WKL.AS</td><td>06-Mar-26 0:00:00</td><td>69.02</td><td>69.36</td><td>67.82</td><td>68.52</td><td>68.52</td><td>1143729</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>66351</b></td><td class="no-wrap">-></td><td>66875</td><td>WKL.AS</td><td>09-Mar-26 0:00:00</td><td>68.78</td><td>69.16</td><td>67.64</td><td>68.64</td><td>68.64</td><td>841503</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>66352</b></td><td class="no-wrap">-></td><td>66876</td><td>WKL.AS</td><td>10-Mar-26 0:00:00</td><td>68.8</td><td>69.16</td><td>66.34</td><td>67.16</td><td>67.16</td><td>1355645</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>66353</b></td><td class="no-wrap">-></td><td>66877</td><td>WKL.AS</td><td>11-Mar-26 0:00:00</td><td>67.5</td><td>69.6</td><td>67.02</td><td>67.22</td><td>67.22</td><td>1142531</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>66354</b></td><td class="no-wrap">-></td><td>66929</td><td>WKL.AS</td><td>12-Mar-26 0:00:00</td><td>67.0</td><td>67.54</td><td>66.28</td><td>67.32</td><td>67.32</td><td>210379</td><td>0.0</td><td>0.0</td><td>False</td></tr>

</table>

<p><b>5</b> rows x <b>12</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Random sample with Sample

```csharp
// Polars.NET — Sample(n) returns n random rows
dfP.Sample(5)
```

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>48632</td><td>BMW.DE</td><td>2025-03-21</td><td>79.5</td><td>80.1</td><td>77.94</td><td>79.16</td><td>75.1068</td><td>3215296</td><td>0</td><td>0</td><td>false</td></tr><tr><td>13368</td><td>ALV.DE</td><td>2021-07-26</td><td>209.15</td><td>211.15</td><td>207.8</td><td>211.15</td><td>173.0352</td><td>475414</td><td>0</td><td>0</td><td>false</td></tr><tr><td>54306</td><td>SGO.PA</td><td>2021-08-10</td><td>63.93</td><td>64.31</td><td>63.86</td><td>64.26</td><td>57.3201</td><td>700160</td><td>0</td><td>0</td><td>false</td></tr><tr><td>20409</td><td>IBE.MC</td><td>2023-03-24</td><td>11.085</td><td>11.085</td><td>10.96</td><td>11.07</td><td>9.7173</td><td>12976210</td><td>0</td><td>0</td><td>false</td></tr><tr><td>5092</td><td>OR.PA</td><td>2025-05-13</td><td>394.15</td><td>394.25</td><td>385</td><td>385.15</td><td>385.15</td><td>318152</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Deedle — Random sample via manual shuffling (no built-in Sample)

```csharp
// Deedle — no built-in Sample; shuffle row indices manually
var rng = new Random(42);
var sampleIndices = Enumerable.Range(0, dfD.RowCount)
    .OrderBy(_ => rng.Next())
    .Take(5)
    .ToArray();
dfD.Rows[sampleIndices]
```

<div>

<table>

<thead><th></th><th></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></thead><thead><th></th><th></th><th>(int)</th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Boolean)</th></thead>

<tr><td><b>59735</b></td><td class="no-wrap">-></td><td>11919</td><td>SU.PA</td><td>28-Jan-21 0:00:00</td><td>121.55</td><td>124.7</td><td>119.85</td><td>123.8</td><td>112.5677</td><td>1325851</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>51154</b></td><td class="no-wrap">-></td><td>3389</td><td>RMS.PA</td><td>14-Nov-23 0:00:00</td><td>1853.2</td><td>1924.8</td><td>1849.4</td><td>1910.4</td><td>1865.127</td><td>70301</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>48939</b></td><td class="no-wrap">-></td><td>46108</td><td>RACE.MI</td><td>04-Aug-25 0:00:00</td><td>378.1</td><td>381.6</td><td>375.3</td><td>378.3</td><td>378.3</td><td>647904</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>8962</b></td><td class="no-wrap">-></td><td>14209</td><td>ALV.DE</td><td>04-Nov-24 0:00:00</td><td>291.4</td><td>291.8</td><td>290.0</td><td>290.2</td><td>278.1992</td><td>371309</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>36412</b></td><td class="no-wrap">-></td><td>40233</td><td>INGA.AS</td><td>17-Mar-23 0:00:00</td><td>11.09</td><td>11.236</td><td>10.43</td><td>10.602</td><td>8.5921</td><td>39359365</td><td>0.0</td><td>0.0</td><td>False</td></tr>

</table>

<p><b>5</b> rows x <b>12</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Inspect shape with Height, Width, and Schema

```csharp
// Polars.NET — Shape and schema
display($"Shape: {dfP.Shape}  |  Height: {dfP.Height}  |  Width: {dfP.Width}");
dfP.PrintSchema();
```

    Shape: (66355, 12)  |  Height: 66355  |  Width: 12

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

#### Deedle — Inspect shape with RowCount, ColumnCount, and ColumnTypes

```csharp
// Deedle — Shape and column types
display($"Shape: {dfD.RowCount} rows x {dfD.ColumnCount} cols");
foreach (var (name, type) in dfD.ColumnKeys.Zip(dfD.ColumnTypes))
    Console.WriteLine($"  {name,-18} : {type.Name}");
```

    Shape: 66355 rows x 12 cols

      id                 : Int32
      symbol             : String
      date               : DateTime
      open               : Decimal
      high               : Decimal
      low                : Decimal
      close              : Decimal
      adj_close          : Decimal
      volume             : Int32
      dividends          : Decimal
      stock_splits       : Decimal
      is_filled          : Boolean

#### Polars.NET — Summary statistics with Describe

```csharp
// Polars.NET — Describe() returns a summary DataFrame
dfP.Describe()
```

<!-- Polars DataFrame: (9 rows, 10 columns) --><table><thead><tr><th>statistic</th><th>id</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th></tr></thead><tbody><tr><td>count</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td></tr><tr><td>null_count</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr><tr><td>mean</td><td>33179.7331</td><td>197.0405202</td><td>199.364124</td><td>194.5857816</td><td>197.0349004</td><td>190.4949089</td><td>5942123.691</td><td>0.01175667386</td><td>0.0001720326822</td></tr><tr><td>std</td><td>19158.20139</td><td>363.1504839</td><td>367.8738291</td><td>358.011643</td><td>363.052047</td><td>359.6353012</td><td>16156185.53</td><td>0.2831418842</td><td>0.02271628163</td></tr><tr><td>min</td><td>1</td><td>1.601</td><td>1.6628</td><td>1.5842</td><td>1.6066</td><td>1.2013</td><td>0</td><td>0</td><td>0</td></tr><tr><td>25%</td><td>16590</td><td>29.79</td><td>30.09</td><td>29.47</td><td>29.7899</td><td>28.1461</td><td>509991</td><td>0</td><td>0</td></tr><tr><td>50%</td><td>33178</td><td>70.7</td><td>71.4</td><td>69.89</td><td>70.68</td><td>63.141</td><td>1415896</td><td>0</td><td>0</td></tr><tr><td>75%</td><td>49767</td><td>186</td><td>188</td><td>184</td><td>186.1</td><td>175.2609</td><td>4089463</td><td>0</td><td>0</td></tr><tr><td>max</td><td>66930</td><td>2926</td><td>2957</td><td>2813</td><td>2839</td><td>2802.9382</td><td>376391539</td><td>22.5</td><td>5</td></tr></tbody></table></div>

#### Deedle — Summary statistics computed manually per numeric column

```csharp
// Deedle — manual describe for numeric columns
var numericCols = new[] { "open", "high", "low", "close", "adj_close", "volume" };
Console.WriteLine($"{"Column",-12} {"Count",8} {"Mean",12} {"StdDev",12} {"Min",12} {"Max",12}");
Console.WriteLine(new string('-', 68));
foreach (var col in numericCols)
{
    var s = dfD.GetColumn<double>(col);
    Console.WriteLine($"{col,-12} {s.KeyCount,8} {s.Mean(),12:F2} {s.StdDev(),12:F2} {s.Min(),12:F2} {s.Max(),12:F2}");
}
```

    Column          Count         Mean       StdDev          Min          Max
    --------------------------------------------------------------------
    open            66355       197.04       363.15         1.60      2926.00
    high            66355       199.36       367.87         1.66      2957.00
    low             66355       194.59       358.01         1.58      2813.00
    close           66355       197.03       363.05         1.61      2839.00
    adj_close       66355       190.49       359.64         1.20      2802.94
    volume          66355   5942123.69  16156185.53         0.00 376391539.00

#### Polars.NET — Count nulls per column with Series.NullCount property

```csharp
// Polars.NET — NullCount is a property on Series, NOT a method on DataFrame
// Use scores_daily which has real nulls
var scP = DataFrame.ReadCsv(Path.Combine(DATA, "scores_daily.csv"), tryParseDates: true);
Console.WriteLine($"scores_daily: {scP.Shape}");
foreach (var col in scP.Columns)
{
    var nc = scP.Column(col).NullCount;
    if (nc > 0)
        Console.WriteLine($"  {col,-28} {nc,4} nulls");
}
```

    scores_daily: (466, 36)
      pe_zscore                       3 nulls
      pb_zscore                       6 nulls
      ev_ebitda_zscore               71 nulls
      yield_zscore                   35 nulls
      recommendation_mean            14 nulls

```csharp
// Deedle — count missing values per column (using scores_daily with real nulls)
var scD = Frame.ReadCsv(Path.Combine(DATA, "scores_daily.csv"));
Console.WriteLine($"scores_daily: {scD.RowCount} x {scD.ColumnCount}");
foreach (var col in scD.ColumnKeys)
{
    var s = scD.Columns[col];
    var missing = scD.RowCount - s.ValueCount;
    if (missing > 0)
        Console.WriteLine($"  {col,-28} {missing,4} missing");
}
```

    scores_daily: 466 x 36
      pe_zscore                       3 missing
      pb_zscore                       6 missing
      ev_ebitda_zscore               71 missing
      yield_zscore                   35 missing
      recommendation_mean            14 missing

```csharp
// Deedle — count missing values per column (using scores_daily with real nulls)
var scD2 = Frame.ReadCsv(Path.Combine(DATA, "scores_daily.csv"));
Console.WriteLine($"scores_daily: {scD2.RowCount} x {scD2.ColumnCount}");
foreach (var col in scD2.ColumnKeys)
{
    var s = scD2.Columns[col];
    var missing = scD2.RowCount - s.ValueCount;
    if (missing > 0)
        Console.WriteLine($"  {col,-28} {missing,4} missing");
}
```

    scores_daily: 466 x 36
      pe_zscore                       3 missing
      pb_zscore                       6 missing
      ev_ebitda_zscore               71 missing
      yield_zscore                   35 missing
      recommendation_mean            14 missing

#### Polars.NET — Frequency distribution with ValueCounts on a Series

```csharp
// Polars.NET — ValueCounts() on a Series returns a DataFrame
dfP.Column("symbol").ValueCounts()
```

<!-- Polars DataFrame: (50 rows, 2 columns) --><table><thead><tr><th>symbol</th><th>count</th></tr></thead><tbody><tr><td>ABI.BR</td><td>1331</td></tr><tr><td>AD.AS</td><td>1331</td></tr><tr><td>ADYEN.AS</td><td>1331</td></tr><tr><td>AI.PA</td><td>1331</td></tr><tr><td>AIR.PA</td><td>1331</td></tr><tr><td>ARGX.BR</td><td>1331</td></tr><tr><td>ASML.AS</td><td>1331</td></tr><tr><td>BN.PA</td><td>1331</td></tr><tr><td>BNP.PA</td><td>1331</td></tr><tr><td>CS.PA</td><td>1331</td></tr><tr><td colspan='2' style='text-align:center; font-style:italic; color:#999; padding: 10px'>... 40 more rows ...</td></tr></tbody></table></div>

#### Deedle — Frequency distribution via GroupBy and counting

```csharp
// Deedle — value counts via GroupBy on the symbol column
var valueCounts = dfD.GetColumn<string>("symbol")
    .GroupBy(kvp => kvp.Value)
    .Select(g => g.Value.KeyCount);
valueCounts
```

<div>

<table>

<tr><td><b>ABI.BR</b></td><td class="no-wrap">-></td><td>1331</td></tr><tr><td><b>AD.AS</b></td><td class="no-wrap">-></td><td>1331</td></tr><tr><td><b>ADS.DE</b></td><td class="no-wrap">-></td><td>1324</td></tr><tr><td><b>ADYEN.AS</b></td><td class="no-wrap">-></td><td>1331</td></tr><tr><td><b>AI.PA</b></td><td class="no-wrap">-></td><td>1331</td></tr><tr><td><b>...</b></td><td class="no-wrap">-></td><td>...</td></tr><tr><td><b>SU.PA</b></td><td class="no-wrap">-></td><td>1331</td></tr><tr><td><b>TTE.PA</b></td><td class="no-wrap">-></td><td>1331</td></tr><tr><td><b>UCG.MI</b></td><td class="no-wrap">-></td><td>1321</td></tr><tr><td><b>VOW.DE</b></td><td class="no-wrap">-></td><td>1324</td></tr><tr><td><b>WKL.AS</b></td><td class="no-wrap">-></td><td>1331</td></tr>

</table>

<p>Series of <b>50</b> items<p><b>0</b> missing values</p>

</div>

#### Polars.NET — Distinct values with Unique and count with NUnique

```csharp
// Polars.NET — Unique() returns distinct values, NUnique() counts them
var symSeries = dfP.Column("symbol");
display($"NUnique: {symSeries.NUnique}");
symSeries.Unique()
```

    NUnique: 50

<pre style='font-size:14px'>shape: (50, 1)
┌─────────┐
│ symbol  │
│ ---     │
│ str     │
╞═════════╡
│ ENI.MI  │
│ RMS.PA  │
│ SGO.PA  │
│ DB1.DE  │
│ SAF.PA  │
│ …       │
│ DHL.DE  │
│ UCG.MI  │
│ DTE.DE  │
│ BBVA.MC │
│ ABI.BR  │
└─────────┘</pre>

#### Deedle — Distinct values with Values.Distinct

```csharp
// Deedle — Distinct() on series values
var uniqueSymbols = dfD.GetColumn<string>("symbol").Values.Distinct().ToArray();
display($"Unique count: {uniqueSymbols.Length}");
display(string.Join(", ", uniqueSymbols.Take(10)));
if (uniqueSymbols.Length > 10)
    Console.WriteLine($"  ... and {uniqueSymbols.Length - 10} more");
```

    Unique count: 50

    ABI.BR, AD.AS, ADS.DE, ADYEN.AS, AI.PA, AIR.PA, ALV.DE, ARGX.BR, ASML.AS, BAS.DE

      ... and 40 more

#### Polars.NET — Estimate memory usage with EstimatedSize

```csharp
// Polars.NET — estimate size (no built-in EstimatedSize in 0.4.0)
long estBytes = 0;
foreach (var col in dfP.Columns)
{
    var s = dfP.Column(col);
    estBytes += s.Length * (s.DataTypeName switch
    {
        "Int32" or "Float32" => 4,
        "Int64" or "Float64" or "Date" or "Datetime" => 8,
        "Boolean" => 1,
        "Utf8" => 40,  // rough average
        _ => 8
    });
}
display($"Estimated size: {estBytes:N0} bytes ({estBytes / 1_048_576.0:F2} MB)");
display($"Shape: {dfP.Shape}  |  {dfP.Height:N0} rows x {dfP.Width} cols");
```

    Estimated size: 6'370'080 bytes (6.07 MB)

    Shape: (66355, 12)  |  66'355 rows x 12 cols

#### Deedle — No built-in memory estimate (note only)

```csharp
// Deedle — no built-in EstimatedSize; rough heuristic based on column types
long estBytes = 0;
foreach (var (col, type) in dfD.ColumnKeys.Zip(dfD.ColumnTypes))
{
    int bytesPerElem = type.Name switch
    {
        "Double" => 8,
        "Int32" or "Single" => 4,
        "Int64" or "DateTime" => 8,
        "String" => 40,   // rough average
        "Boolean" => 1,
        _ => 8
    };
    estBytes += (long)dfD.RowCount * bytesPerElem;
}
Console.WriteLine($"Rough estimate: {estBytes:N0} bytes ({estBytes / 1_048_576.0:F2} MB)");
```

    Rough estimate: 7'498'115 bytes (7.15 MB)

#### Polars.NET — Reusable quick-profile function for any DataFrame

```csharp
// Polars.NET — reusable profiler that returns a summary DataFrame
DataFrame ProfilePolars(DataFrame df)
{
    var cols = df.Columns.ToArray();
    var colNames = new string[cols.Length];
    var types = new string[cols.Length];
    var nulls = new long[cols.Length];
    var uniques = new long[cols.Length];
    for (int j = 0; j < cols.Length; j++)
    {
        var s = df.Column(cols[j]);
        colNames[j] = cols[j];
        types[j] = s.DataTypeName;
        nulls[j] = s.NullCount;
        uniques[j] = (long)s.NUnique;
    }
    return new DataFrame(new Polars.CSharp.Series[]
    {
        Polars.CSharp.Series.From("column", colNames),
        Polars.CSharp.Series.From("type", types),
        Polars.CSharp.Series.From("nulls", nulls),
        Polars.CSharp.Series.From("unique", uniques)
    });
}

display($"eurostoxx50_ohlcv: {dfP.Shape}");
display(ProfilePolars(dfP));
display($"dim_country: {dimP.Shape}");
display(ProfilePolars(dimP));
```

    eurostoxx50_ohlcv: (66355, 12)

<!-- Polars DataFrame: (12 rows, 4 columns) --><table><thead><tr><th>column</th><th>type</th><th>nulls</th><th>unique</th></tr></thead><tbody><tr><td>id</td><td>i64</td><td>0</td><td>66355</td></tr><tr><td>symbol</td><td>str</td><td>0</td><td>50</td></tr><tr><td>date</td><td>date</td><td>0</td><td>1331</td></tr><tr><td>open</td><td>f64</td><td>0</td><td>29671</td></tr><tr><td>high</td><td>f64</td><td>0</td><td>31651</td></tr><tr><td>low</td><td>f64</td><td>0</td><td>31695</td></tr><tr><td>close</td><td>f64</td><td>0</td><td>31505</td></tr><tr><td>adj_close</td><td>f64</td><td>0</td><td>57739</td></tr><tr><td>volume</td><td>i64</td><td>0</td><td>65199</td></tr><tr><td>dividends</td><td>f64</td><td>0</td><td>216</td></tr><tr><td colspan='4' style='text-align:center; font-style:italic; color:#999; padding: 10px'>... 2 more rows ...</td></tr></tbody></table></div>

    dim_country: (212, 2)

<!-- Polars DataFrame: (2 rows, 4 columns) --><table><thead><tr><th>column</th><th>type</th><th>nulls</th><th>unique</th></tr></thead><tbody><tr><td>country_name</td><td>str</td><td>0</td><td>212</td></tr><tr><td>iso_alpha2</td><td>str</td><td>0</td><td>212</td></tr></tbody></table></div>

---
## Column Selection

#### Polars.NET — Column Selection: select a single column by name with Column

```csharp
// Polars.NET — single column returns a Series (untyped)
var closeSeries = dfP.Column("close");
display($"Name: {closeSeries.Name}  |  Length: {closeSeries.Length}  |  Type: {closeSeries.DataTypeName}");

// Also via indexer
var symbolSeries = dfP["symbol"];
display($"Name: {symbolSeries.Name}  |  Length: {symbolSeries.Length}");
```

    Name: close  |  Length: 66355  |  Type: f64

    Name: symbol  |  Length: 66355

#### Deedle — Select a single column by name with GetColumn<T>

```csharp
// Deedle — GetColumn<T> requires the value type
var closeSeries = dfD.GetColumn<double>("close");
display($"KeyCount: {closeSeries.KeyCount}");

// String columns must use GetColumn<string>, not the indexer (which defaults to double)
var symbolSeries = dfD.GetColumn<string>("symbol");
display($"KeyCount: {symbolSeries.KeyCount}");
```

    KeyCount: 66355

    KeyCount: 66355

#### Polars.NET — Select multiple columns by name with Select

```csharp
// Polars.NET — Select("a", "b") returns a new DataFrame with those columns
dfP.Select("date", "symbol", "close", "volume").Head(5)
```

<!-- Polars DataFrame: (5 rows, 4 columns) --><table><thead><tr><th>date</th><th>symbol</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>2021-01-04</td><td>ABI.BR</td><td>57.21</td><td>1513937</td></tr><tr><td>2021-01-05</td><td>ABI.BR</td><td>57.18</td><td>1382722</td></tr><tr><td>2021-01-06</td><td>ABI.BR</td><td>58.77</td><td>1370204</td></tr><tr><td>2021-01-07</td><td>ABI.BR</td><td>58.4</td><td>1469911</td></tr><tr><td>2021-01-08</td><td>ABI.BR</td><td>57.86</td><td>1428681</td></tr></tbody></table></div>

#### Deedle — Select multiple columns by name with Columns indexer

```csharp
// Deedle — Columns indexer with a list of column names
dfD.Columns[new[] { "date", "symbol", "close", "volume" }]
    .Rows[Enumerable.Range(0, 5)]
```

<div>

<table>

<thead><th></th><th></th><th>date</th><th>symbol</th><th>close</th><th>volume</th></thead><thead><th></th><th></th><th>(DateTime)</th><th>(string)</th><th>(Decimal)</th><th>(int)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>04-Jan-21 0:00:00</td><td>ABI.BR</td><td>57.21</td><td>1513937</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>05-Jan-21 0:00:00</td><td>ABI.BR</td><td>57.18</td><td>1382722</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>06-Jan-21 0:00:00</td><td>ABI.BR</td><td>58.77</td><td>1370204</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>07-Jan-21 0:00:00</td><td>ABI.BR</td><td>58.4</td><td>1469911</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>08-Jan-21 0:00:00</td><td>ABI.BR</td><td>57.86</td><td>1428681</td></tr>

</table>

<p><b>5</b> rows x <b>4</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Select with expressions and rename with Alias

```csharp
// Polars.NET — expressions allow compute-on-select and renaming
dfP.Select(
    Col("symbol"),
    Col("close").Alias("price"),
    (Col("high") - Col("low")).Alias("range")
).Head(5)
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>symbol</th><th>price</th><th>range</th></tr></thead><tbody><tr><td>ABI.BR</td><td>57.21</td><td>2.07</td></tr><tr><td>ABI.BR</td><td>57.18</td><td>1.23</td></tr><tr><td>ABI.BR</td><td>58.77</td><td>1.55</td></tr><tr><td>ABI.BR</td><td>58.4</td><td>0.98</td></tr><tr><td>ABI.BR</td><td>57.86</td><td>0.97</td></tr></tbody></table></div>

#### Deedle — No expression system; compute columns manually

```csharp
// Deedle — no expression system; build columns with arithmetic
var builder = new FrameBuilder.Columns<int, string>();
builder.Add("symbol", dfD.GetColumn<string>("symbol"));
builder.Add("price", dfD.GetColumn<double>("close"));
builder.Add("range", dfD.GetColumn<double>("high") - dfD.GetColumn<double>("low"));
builder.Frame.Rows[Enumerable.Range(0, 5)]
```

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>price</th><th>range</th></thead><thead><th></th><th></th><th>(string)</th><th>(float)</th><th>(float)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>57.21</td><td>2.0700000000000003</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>57.18</td><td>1.2299999999999969</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>58.77</td><td>1.5499999999999972</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>58.4</td><td>0.9799999999999969</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>57.86</td><td>0.9699999999999989</td></tr>

</table>

<p><b>5</b> rows x <b>3</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Exclude columns with Drop

```csharp
// Polars.NET — Drop columns by selecting the ones to keep
var dropCols = new HashSet<string> { "id", "adj_close", "dividends", "stock_splits", "is_filled" };
var keepCols = dfP.Columns.Where(c => !dropCols.Contains(c)).ToArray();
var trimmed = dfP.Select(keepCols);
display($"Columns: {string.Join(", ", trimmed.Columns)}");
trimmed.Head(3)
```

    Columns: symbol, date, open, high, low, close, volume

<!-- Polars DataFrame: (3 rows, 7 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>1370204</td></tr></tbody></table></div>

#### Deedle — Exclude columns with DropColumn

```csharp
// Deedle — DropColumn removes one at a time; chain or keep-list is easier
var keepCols = new[] { "date", "symbol", "open", "high", "low", "close", "volume" };
var trimmed = dfD.Columns[keepCols];
display($"Columns: {string.Join(", ", trimmed.ColumnKeys)}");
trimmed.Rows[Enumerable.Range(0, 3)]
```

    Columns: date, symbol, open, high, low, close, volume

<div>

<table>

<thead><th></th><th></th><th>date</th><th>symbol</th><th>open</th><th>high</th><th>low</th><th>close</th><th>volume</th></thead><thead><th></th><th></th><th>(DateTime)</th><th>(string)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(int)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>04-Jan-21 0:00:00</td><td>ABI.BR</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>1513937</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>05-Jan-21 0:00:00</td><td>ABI.BR</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>1382722</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>06-Jan-21 0:00:00</td><td>ABI.BR</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>1370204</td></tr>

</table>

<p><b>3</b> rows x <b>7</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Select columns matching a regex pattern

```csharp
// Polars.NET — select columns by regex (match OHLC price columns)
var pattern = new Regex("^(open|high|low|close)$");
var priceCols = dfP.Columns.Where(c => pattern.IsMatch(c)).ToArray();
display($"Matched: {string.Join(", ", priceCols)}");
dfP.Select(priceCols).Head(5)
```

    Matched: open, high, low, close

<!-- Polars DataFrame: (5 rows, 4 columns) --><table><thead><tr><th>open</th><th>high</th><th>low</th><th>close</th></tr></thead><tbody><tr><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td></tr><tr><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td></tr><tr><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td></tr><tr><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td></tr><tr><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td></tr></tbody></table></div>

#### Deedle — Select columns matching a regex pattern via LINQ

```csharp
// Deedle — filter column names with LINQ + Regex
var pattern = new Regex("^(open|high|low|close)$");
var priceCols = dfD.ColumnKeys.Where(c => pattern.IsMatch(c)).ToArray();
display($"Matched: {string.Join(", ", priceCols)}");
dfD.Columns[priceCols].Rows[Enumerable.Range(0, 5)]
```

    Matched: open, high, low, close

<div>

<table>

<thead><th></th><th></th><th>open</th><th>high</th><th>low</th><th>close</th></thead><thead><th></th><th></th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td></tr>

</table>

<p><b>5</b> rows x <b>4</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Rename columns with Rename

```csharp
// Polars.NET — Rename() accepts a dictionary of old -> new names
var renamed = dfP.Select("symbol", "close", "volume")
    .Rename(new Dictionary<string, string>
    {
        ["symbol"] = "ticker",
        ["close"]  = "price",
        ["volume"] = "vol"
    });
display($"Columns: {string.Join(", ", renamed.Columns)}");
renamed.Head(3)
```

    Columns: ticker, price, vol

<!-- Polars DataFrame: (3 rows, 3 columns) --><table><thead><tr><th>ticker</th><th>price</th><th>vol</th></tr></thead><tbody><tr><td>ABI.BR</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>58.77</td><td>1370204</td></tr></tbody></table></div>

#### Deedle — Rename columns with RenameColumns

```csharp
// Deedle — rename by rebuilding with new column names
var renames = new Dictionary<string, string>
{
    ["symbol"] = "ticker",
    ["close"]  = "price",
    ["volume"] = "vol"
};
var subset = dfD.Columns[new[] { "symbol", "close", "volume" }];
var builder = new FrameBuilder.Columns<int, string>();
foreach (var col in subset.ColumnKeys)
    builder.Add(renames.ContainsKey(col) ? renames[col] : col, subset.Columns[col]);
var renamed = builder.Frame;
display($"Columns: {string.Join(", ", renamed.ColumnKeys)}");
renamed.Rows[Enumerable.Range(0, 3)]
```

    Columns: ticker, price, vol

<div>

<table>

<thead><th></th><th></th><th>ticker</th><th>price</th><th>vol</th></thead><thead><th></th><th></th><th>(string)</th><th>(Decimal)</th><th>(int)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>57.21</td><td>1513937</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>57.18</td><td>1382722</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>58.77</td><td>1370204</td></tr>

</table>

<p><b>3</b> rows x <b>3</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Reorder columns with Select

```csharp
// Polars.NET — Select in desired order reorders columns
var reordered = dfP.Select("symbol", "date", "volume", "open", "high", "low", "close");
display($"Column order: {string.Join(", ", reordered.Columns)}");
reordered.Head(3)
```

    Column order: symbol, date, volume, open, high, low, close

<!-- Polars DataFrame: (3 rows, 7 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>volume</th><th>open</th><th>high</th><th>low</th><th>close</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>1513937</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>1382722</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>1370204</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td></tr></tbody></table></div>

#### Deedle — Reorder columns with Columns indexer

```csharp
// Deedle — Columns indexer with ordered list reorders
var reordered = dfD.Columns[new[] { "symbol", "date", "volume", "open", "high", "low", "close" }];
display($"Column order: {string.Join(", ", reordered.ColumnKeys)}");
reordered.Rows[Enumerable.Range(0, 3)]
```

    Column order: symbol, date, volume, open, high, low, close

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>date</th><th>volume</th><th>open</th><th>high</th><th>low</th><th>close</th></thead><thead><th></th><th></th><th>(string)</th><th>(DateTime)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>1513937</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>1382722</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>1370204</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td></tr>

</table>

<p><b>3</b> rows x <b>7</b> columns</p><p><b>0</b> missing values</p>

</div>

---
## Row Filtering

> [!info] C# DataFrame libraries are immutable by design
> Unlike Pandas (which supports dangerous in-place mutation), Polars.NET and Deedle
> return new DataFrames from filter operations — eliminating the chained-indexing bugs
> that plague Pandas pipelines. The trade-off is slightly higher memory usage for
> intermediate results, but `.Lazy()` in Polars.NET defers execution to avoid this.

#### Polars.NET — Boolean filter with Filter and Col expressions

```csharp
// Polars.NET — Filter with a boolean expression (uses C# operator overloads)
var expensive = dfP.Filter(Col("close") > Lit(500.0));
display($"Rows where close > 500: {expensive.Height}");
expensive.Head(5)
```

    Rows where close > 500: 6155

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>60763</td><td>ADYEN.AS</td><td>2021-01-04</td><td>1900</td><td>1921.5</td><td>1856</td><td>1859.5</td><td>1859.5</td><td>99408</td><td>0</td><td>0</td><td>false</td></tr><tr><td>60764</td><td>ADYEN.AS</td><td>2021-01-05</td><td>1848.5</td><td>1857</td><td>1814</td><td>1829</td><td>1829</td><td>86256</td><td>0</td><td>0</td><td>false</td></tr><tr><td>60765</td><td>ADYEN.AS</td><td>2021-01-06</td><td>1822</td><td>1824</td><td>1706.5</td><td>1733</td><td>1733</td><td>156844</td><td>0</td><td>0</td><td>false</td></tr><tr><td>60766</td><td>ADYEN.AS</td><td>2021-01-07</td><td>1735</td><td>1754</td><td>1708.5</td><td>1714.5</td><td>1714.5</td><td>90183</td><td>0</td><td>0</td><td>false</td></tr><tr><td>60767</td><td>ADYEN.AS</td><td>2021-01-08</td><td>1730</td><td>1764.5</td><td>1715</td><td>1756.5</td><td>1756.5</td><td>97176</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Deedle — Boolean filter with Where and row lambda

```csharp
// Deedle — Where uses a row-level lambda
var expensive = dfD.Where(row => row.Value.GetAs<double>("close") > 500.0);
display($"Rows where close > 500: {expensive.RowCount}");
expensive.Rows[Enumerable.Range(0, 5)]
```

    Rows where close > 500: 6155

<div>

<table>

<thead><th></th><th></th></thead><thead><th></th><th></th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td></tr>

</table>

<p><b>5</b> rows x <b>0</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Compound filters with AND, OR, NOT

```csharp
// Polars.NET — AND / OR / NOT with C# operators
var filtered = dfP.Filter(
    (Col("symbol") == Lit("ASML.AS")) & (Col("close") > Lit(600.0))
);
display($"ASML AND close > 600: {filtered.Height} rows");
display(filtered.Head(3));

// OR
var orFilter = dfP.Filter(
    (Col("symbol") == Lit("ASML.AS")) | (Col("symbol") == Lit("SAP.DE"))
);
display($"ASML OR SAP: {orFilter.Height} rows");

// NOT
var notFilter = dfP.Filter(
    Col("symbol") != Lit("ASML.AS")
);
display($"NOT ASML: {notFilter.Height} rows");
```

    ASML AND close > 600: 840 rows

<!-- Polars DataFrame: (3 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>136</td><td>ASML.AS</td><td>2021-07-14</td><td>599.5</td><td>611.8</td><td>597.2</td><td>609.1</td><td>582.9708</td><td>641585</td><td>0</td><td>0</td><td>false</td></tr><tr><td>142</td><td>ASML.AS</td><td>2021-07-22</td><td>610</td><td>625.9</td><td>608.2</td><td>620.8</td><td>594.169</td><td>788099</td><td>0</td><td>0</td><td>false</td></tr><tr><td>143</td><td>ASML.AS</td><td>2021-07-23</td><td>622.9</td><td>639</td><td>617.5</td><td>638.8</td><td>611.3967</td><td>833737</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

    ASML OR SAP: 2655 rows

    NOT ASML: 65024 rows

#### Deedle — Compound filters with && || ! in Where lambda

```csharp
// Deedle — AND / OR / NOT with standard C# operators
var filtered = dfD.Where(row =>
    row.Value.GetAs<string>("symbol") == "ASML.AS" &&
    row.Value.GetAs<double>("close") > 600.0);
display($"ASML AND close > 600: {filtered.RowCount} rows");

var orFilter = dfD.Where(row =>
    row.Value.GetAs<string>("symbol") == "ASML.AS" ||
    row.Value.GetAs<string>("symbol") == "SAP.DE");
display($"ASML OR SAP: {orFilter.RowCount} rows");

var notFilter = dfD.Where(row =>
    row.Value.GetAs<string>("symbol") != "ASML.AS");
display($"NOT ASML: {notFilter.RowCount} rows");
```

    ASML AND close > 600: 840 rows

    ASML OR SAP: 2655 rows

    NOT ASML: 65024 rows

#### Polars.NET — Filter by membership with IsIn

```csharp
// Polars.NET — IsIn filters rows where the column value is in a list
var techTickers = Polars.CSharp.Series.From("tickers",
    new[] { "ASML.AS", "SAP.DE", "SIE.DE" });
var techRows = dfP.Filter(Col("symbol").IsIn(Lit(techTickers)));
display($"Tech tickers: {techRows.Height} rows");
techRows.Head(5)
```

    Tech tickers: 3979 rows

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>1</td><td>ASML.AS</td><td>2021-01-04</td><td>404</td><td>411</td><td>402.25</td><td>406.25</td><td>387.709</td><td>789502</td><td>0</td><td>0</td><td>false</td></tr><tr><td>2</td><td>ASML.AS</td><td>2021-01-05</td><td>406.55</td><td>412.05</td><td>401.15</td><td>406.9</td><td>388.3294</td><td>798787</td><td>0</td><td>0</td><td>false</td></tr><tr><td>3</td><td>ASML.AS</td><td>2021-01-06</td><td>406.8</td><td>407.2</td><td>399.2</td><td>402.85</td><td>384.4644</td><td>875711</td><td>0</td><td>0</td><td>false</td></tr><tr><td>4</td><td>ASML.AS</td><td>2021-01-07</td><td>404.8</td><td>407.8</td><td>400.35</td><td>403.9</td><td>385.4664</td><td>874780</td><td>0</td><td>0</td><td>false</td></tr><tr><td>5</td><td>ASML.AS</td><td>2021-01-08</td><td>414.25</td><td>419.1</td><td>413.4</td><td>416.05</td><td>397.0618</td><td>975243</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Deedle — Filter by membership with Contains in Where

```csharp
// Deedle — manual IsIn using HashSet + Where
var techSet = new HashSet<string> { "ASML.AS", "SAP.DE", "SIE.DE" };
var techRows = dfD.Where(row => techSet.Contains(row.Value.GetAs<string>("symbol")));
display($"Tech tickers: {techRows.RowCount} rows");
techRows.Rows[Enumerable.Range(0, 5)]
```

    Tech tickers: 3979 rows

<div>

<table>

<thead><th></th><th></th></thead><thead><th></th><th></th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td></tr>

</table>

<p><b>5</b> rows x <b>0</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Range filter with IsBetween

```csharp
// Polars.NET — IsBetween for range filtering
var midRange = dfP.Filter(Col("close").IsBetween(Lit(100.0), Lit(200.0)));
display($"Close between 100 and 200: {midRange.Height} rows");
midRange.Head(5)
```

    Close between 100 and 200: 12013 rows

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>62387</td><td>ADS.DE</td><td>2022-03-04</td><td>196.5</td><td>197.64</td><td>187</td><td>187</td><td>180.5918</td><td>1319891</td><td>0</td><td>0</td><td>false</td></tr><tr><td>62388</td><td>ADS.DE</td><td>2022-03-07</td><td>177.1</td><td>183.4</td><td>170.08</td><td>176.9</td><td>170.8379</td><td>2345656</td><td>0</td><td>0</td><td>false</td></tr><tr><td>62389</td><td>ADS.DE</td><td>2022-03-08</td><td>172.18</td><td>187.06</td><td>172</td><td>184.94</td><td>178.6024</td><td>1937346</td><td>0</td><td>0</td><td>false</td></tr><tr><td>62391</td><td>ADS.DE</td><td>2022-03-10</td><td>211.35</td><td>211.8</td><td>196.68</td><td>197.08</td><td>190.3264</td><td>1375129</td><td>0</td><td>0</td><td>false</td></tr><tr><td>62415</td><td>ADS.DE</td><td>2022-04-13</td><td>198.52</td><td>199.74</td><td>194.16</td><td>197.76</td><td>190.9831</td><td>755573</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Deedle — Range filter with compound condition in Where

```csharp
// Deedle — manual range check
var midRange = dfD.Where(row =>
{
    var close = row.Value.GetAs<double>("close");
    return close >= 100.0 && close <= 200.0;
});
display($"Close between 100 and 200: {midRange.RowCount} rows");
midRange.Rows[Enumerable.Range(0, 5)]
```

    Close between 100 and 200: 12013 rows

<div>

<table>

<thead><th></th><th></th></thead><thead><th></th><th></th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td></tr>

</table>

<p><b>5</b> rows x <b>0</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Null checks with IsNull and IsNotNull

```csharp
// Polars.NET — IsNull / IsNotNull expressions
var withNulls = dfP.Filter(Col("volume").IsNull());
display($"Rows with null volume: {withNulls.Height}");

var noNulls = dfP.Filter(Col("volume").IsNotNull());
display($"Rows with non-null volume: {noNulls.Height}");
```

    Rows with null volume: 0

    Rows with non-null volume: 66355

#### Deedle — Filter missing values with TryGet and HasValue

```csharp
// Deedle — check for missing values
var volCol = dfD["volume"];
var missingCount = dfD.RowCount - volCol.ValueCount;
display($"Rows with missing volume: {missingCount}");
display($"Rows with present volume: {volCol.ValueCount}");
```

    Rows with missing volume: 0

    Rows with present volume: 66355

#### Polars.NET — String predicates with Str.StartsWith and Str.Contains

```csharp
// Polars.NET — string predicates on the symbol column
var parisStocks = dfP.Filter(Col("symbol").Str.EndsWith(".PA"));
display($"Paris-listed (.PA): {parisStocks.Height} rows");
display(parisStocks.Select("symbol").Unique());

var containsB = dfP.Filter(Col("symbol").Str.Contains("BN"));
display($"Symbol contains BN: {containsB.Height} rows");
containsB.Select("symbol").Unique()
```

    Paris-listed (.PA): 21296 rows

<!-- Polars DataFrame: (16 rows, 1 columns) --><table><thead><tr><th>symbol</th></tr></thead><tbody><tr><td>AI.PA</td></tr><tr><td>AIR.PA</td></tr><tr><td>BN.PA</td></tr><tr><td>BNP.PA</td></tr><tr><td>CS.PA</td></tr><tr><td>DG.PA</td></tr><tr><td>DSY.PA</td></tr><tr><td>EL.PA</td></tr><tr><td>MC.PA</td></tr><tr><td>OR.PA</td></tr><tr><td colspan='1' style='text-align:center; font-style:italic; color:#999; padding: 10px'>... 6 more rows ...</td></tr></tbody></table></div>

    Symbol contains BN: 2662 rows

<!-- Polars DataFrame: (2 rows, 1 columns) --><table><thead><tr><th>symbol</th></tr></thead><tbody><tr><td>BN.PA</td></tr><tr><td>BNP.PA</td></tr></tbody></table></div>

#### Deedle — String predicates via lambda in Where

```csharp
// Deedle — string predicates via lambda
var parisStocks = dfD.Where(row => row.Value.GetAs<string>("symbol").EndsWith(".PA"));
display($"Paris-listed (.PA): {parisStocks.RowCount} rows");
display(string.Join(", ", parisStocks.GetColumn<string>("symbol").Values.Distinct()));

var containsB = dfD.Where(row => row.Value.GetAs<string>("symbol").Contains("BN"));
display($"Symbol contains 'BN': {containsB.RowCount} rows");
display(string.Join(", ", containsB.GetColumn<string>("symbol").Values.Distinct()));
```

    Paris-listed (.PA): 21296 rows

    AI.PA, AIR.PA, BN.PA, BNP.PA, CS.PA, DG.PA, DSY.PA, EL.PA, MC.PA, OR.PA, RMS.PA, SAF.PA, SAN.PA, SGO.PA, SU.PA, TTE.PA

    Symbol contains 'BN': 2662 rows

    BN.PA, BNP.PA

#### Polars.NET — Date predicates with Dt accessor for year and range

```csharp
// Polars.NET — date predicates
// Filter for year 2023
var year2023 = dfP.Filter(Col("date").Dt.Year() == Lit(2023));
display($"Year 2023: {year2023.Height} rows");

// Date range: Jan 2024 to Mar 2024
var dateRange = dfP.Filter(
    (Col("date") >= Lit(new DateOnly(2024, 1, 1)))
    & (Col("date") <= Lit(new DateOnly(2024, 3, 31)))
);
display($"Q1 2024: {dateRange.Height} rows");
dateRange.Head(5)
```

    Year 2023: 12741 rows

    Q1 2024: 3150 rows

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21930</td><td>ABI.BR</td><td>2024-01-02</td><td>58.72</td><td>58.95</td><td>58.17</td><td>58.77</td><td>56.7582</td><td>1049145</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21931</td><td>ABI.BR</td><td>2024-01-03</td><td>58.64</td><td>59.34</td><td>58.24</td><td>58.37</td><td>56.3719</td><td>1247000</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21932</td><td>ABI.BR</td><td>2024-01-04</td><td>58.36</td><td>58.92</td><td>58.3</td><td>58.81</td><td>56.7968</td><td>1009526</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21933</td><td>ABI.BR</td><td>2024-01-05</td><td>58.26</td><td>58.91</td><td>58.16</td><td>58.86</td><td>56.8451</td><td>1236000</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21934</td><td>ABI.BR</td><td>2024-01-08</td><td>58.47</td><td>59.5</td><td>58.39</td><td>59.38</td><td>57.3473</td><td>1033238</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Deedle — Date predicates via parsing and comparison in Where

```csharp
// Deedle — date predicates (date column is a string; parse in lambda)
var year2023 = dfD.Where(row =>
    DateTime.Parse(row.Value.GetAs<string>("date")).Year == 2023);
display($"Year 2023: {year2023.RowCount} rows");

var dateRange = dfD.Where(row =>
{
    var d = DateTime.Parse(row.Value.GetAs<string>("date"));
    return d >= new DateTime(2024, 1, 1) && d <= new DateTime(2024, 3, 31);
});
display($"Q1 2024: {dateRange.RowCount} rows");
dateRange.Rows[Enumerable.Range(0, 5)]
```

    Year 2023: 12741 rows

    Q1 2024: 3150 rows

<div>

<table>

<thead><th></th><th></th></thead><thead><th></th><th></th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td></tr>

</table>

<p><b>5</b> rows x <b>0</b> columns</p><p><b>0</b> missing values</p>

</div>

---
## Row Access & Slicing

#### Polars.NET — Access a single row by position with Head/Slice

```csharp
// Polars.NET — single row access (row 0)
display("Row 0:");
display(dfP.Slice(0, 1));

// Access individual values from a row
display($"Row 0, symbol: {dfP.Column("symbol").GetValue<string>(0)}");
display($"Row 0, close:  {dfP.Column("close").GetValue<double>(0)}");
```

    Row 0:

<!-- Polars DataFrame: (1 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

    Row 0, symbol: ABI.BR

    Row 0, close:  57.21

#### Deedle — Access a single row by position with GetRowAt

```csharp
// Deedle — single row access
display("Row 0:");
var row0 = dfD.Rows[new[] { 0 }];
display(row0);

// Individual values via the row key
var firstRow = dfD.Rows[0];
display($"Row 0, symbol: {firstRow.GetAs<string>("symbol")}");
display($"Row 0, close:  {firstRow.GetAs<double>("close")}");
```

    Row 0:

<div>

<table>

<thead><th></th><th></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></thead><thead><th></th><th></th><th>(int)</th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Boolean)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>21160</td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>False</td></tr>

</table>

<p><b>1</b> rows x <b>12</b> columns</p><p><b>0</b> missing values</p>

</div>

    Row 0, symbol: ABI.BR

    Row 0, close:  57.21

#### Polars.NET — Row Slicing: select a range of rows with Slice(offset, length)

```csharp
// Polars.NET — Slice(offset, length)
display("Rows 100..104:");
dfP.Slice(100, 5)
```

    Rows 100..104:

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21260</td><td>ABI.BR</td><td>2021-05-26</td><td>61.99</td><td>62.39</td><td>61.83</td><td>62.12</td><td>58.6701</td><td>940186</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21261</td><td>ABI.BR</td><td>2021-05-27</td><td>61.8</td><td>62.64</td><td>61.73</td><td>62.13</td><td>58.6795</td><td>1796477</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21262</td><td>ABI.BR</td><td>2021-05-28</td><td>62.14</td><td>62.58</td><td>61.96</td><td>62.34</td><td>58.8779</td><td>1004125</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21263</td><td>ABI.BR</td><td>2021-05-31</td><td>62.27</td><td>62.31</td><td>61.51</td><td>61.56</td><td>58.1412</td><td>851557</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21264</td><td>ABI.BR</td><td>2021-06-01</td><td>62.35</td><td>62.48</td><td>61.98</td><td>62.38</td><td>58.9157</td><td>1171646</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Deedle — Slice a range of rows with GetRowsAt

```csharp
// Deedle — GetRowsAt with index range
display("Rows 100..104:");
dfD.Rows[Enumerable.Range(100, 5)]
```

    Rows 100..104:

<div>

<table>

<thead><th></th><th></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></thead><thead><th></th><th></th><th>(int)</th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Boolean)</th></thead>

<tr><td><b>100</b></td><td class="no-wrap">-></td><td>21260</td><td>ABI.BR</td><td>26-May-21 0:00:00</td><td>61.99</td><td>62.39</td><td>61.83</td><td>62.12</td><td>58.6701</td><td>940186</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>101</b></td><td class="no-wrap">-></td><td>21261</td><td>ABI.BR</td><td>27-May-21 0:00:00</td><td>61.8</td><td>62.64</td><td>61.73</td><td>62.13</td><td>58.6795</td><td>1796477</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>102</b></td><td class="no-wrap">-></td><td>21262</td><td>ABI.BR</td><td>28-May-21 0:00:00</td><td>62.14</td><td>62.58</td><td>61.96</td><td>62.34</td><td>58.8779</td><td>1004125</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>103</b></td><td class="no-wrap">-></td><td>21263</td><td>ABI.BR</td><td>31-May-21 0:00:00</td><td>62.27</td><td>62.31</td><td>61.51</td><td>61.56</td><td>58.1412</td><td>851557</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>104</b></td><td class="no-wrap">-></td><td>21264</td><td>ABI.BR</td><td>01-Jun-21 0:00:00</td><td>62.35</td><td>62.48</td><td>61.98</td><td>62.38</td><td>58.9157</td><td>1171646</td><td>0.0</td><td>0.0</td><td>False</td></tr>

</table>

<p><b>5</b> rows x <b>12</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Sort rows with Sort

```csharp
// Polars.NET — Sort ascending and descending
display("Top 5 by close (descending):");
display(dfP.Sort("close", descending: true).Head(5));

// Multi-column sort: chain sorts (last Sort is the primary key)
display("Sort by symbol ASC, then close DESC:");
dfP.Sort("close", descending: true).Sort("symbol").Head(5)
```

    Top 5 by close (descending):

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>3708</td><td>RMS.PA</td><td>2025-02-14</td><td>2926</td><td>2957</td><td>2813</td><td>2839</td><td>2802.9382</td><td>105651</td><td>0</td><td>0</td><td>false</td></tr><tr><td>3707</td><td>RMS.PA</td><td>2025-02-13</td><td>2770</td><td>2816</td><td>2765</td><td>2816</td><td>2780.2302</td><td>80087</td><td>0</td><td>0</td><td>false</td></tr><tr><td>3709</td><td>RMS.PA</td><td>2025-02-17</td><td>2825</td><td>2858</td><td>2803</td><td>2809</td><td>2776.7424</td><td>53852</td><td>3.5</td><td>0</td><td>false</td></tr><tr><td>3710</td><td>RMS.PA</td><td>2025-02-18</td><td>2816</td><td>2827</td><td>2780</td><td>2806</td><td>2773.7771</td><td>65469</td><td>0</td><td>0</td><td>false</td></tr><tr><td>60927</td><td>ADYEN.AS</td><td>2021-08-24</td><td>2725</td><td>2766</td><td>2711.5</td><td>2766</td><td>2766</td><td>61431</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

    Sort by symbol ASC, then close DESC:

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>22481</td><td>ABI.BR</td><td>2026-02-27</td><td>67.34</td><td>68.82</td><td>67.24</td><td>68.82</td><td>68.82</td><td>3482764</td><td>0</td><td>0</td><td>false</td></tr><tr><td>22470</td><td>ABI.BR</td><td>2026-02-12</td><td>65.9</td><td>68.64</td><td>65.52</td><td>68.54</td><td>68.54</td><td>3484641</td><td>0</td><td>0</td><td>false</td></tr><tr><td>22478</td><td>ABI.BR</td><td>2026-02-24</td><td>67.8</td><td>68.32</td><td>67.58</td><td>68.3</td><td>68.3</td><td>1936847</td><td>0</td><td>0</td><td>false</td></tr><tr><td>22477</td><td>ABI.BR</td><td>2026-02-23</td><td>66.52</td><td>67.76</td><td>66.5</td><td>67.76</td><td>67.76</td><td>2207904</td><td>0</td><td>0</td><td>false</td></tr><tr><td>22471</td><td>ABI.BR</td><td>2026-02-13</td><td>67.5</td><td>67.88</td><td>66.58</td><td>67.68</td><td>67.68</td><td>2951731</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Deedle — Sort rows with SortRowsBy

```csharp
// Deedle — sort by column value (descending)
display("Top 5 by close (descending):");
var sorted = dfD.GetColumn<double>("close")
    .Observations
    .OrderByDescending(o => o.Value)
    .Take(5)
    .Select(o => o.Key);
dfD.Rows[sorted]
```

    Top 5 by close (descending):

<div>

<table>

<thead><th></th><th></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></thead><thead><th></th><th></th><th>(int)</th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Boolean)</th></thead>

<tr><td><b>51473</b></td><td class="no-wrap">-></td><td>3708</td><td>RMS.PA</td><td>14-Feb-25 0:00:00</td><td>2926.0</td><td>2957.0</td><td>2813.0</td><td>2839.0</td><td>2802.9382</td><td>105651</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>51472</b></td><td class="no-wrap">-></td><td>3707</td><td>RMS.PA</td><td>13-Feb-25 0:00:00</td><td>2770.0</td><td>2816.0</td><td>2765.0</td><td>2816.0</td><td>2780.2302</td><td>80087</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>51474</b></td><td class="no-wrap">-></td><td>3709</td><td>RMS.PA</td><td>17-Feb-25 0:00:00</td><td>2825.0</td><td>2858.0</td><td>2803.0</td><td>2809.0</td><td>2776.7424</td><td>53852</td><td>3.5</td><td>0.0</td><td>False</td></tr><tr><td><b>51475</b></td><td class="no-wrap">-></td><td>3710</td><td>RMS.PA</td><td>18-Feb-25 0:00:00</td><td>2816.0</td><td>2827.0</td><td>2780.0</td><td>2806.0</td><td>2773.7771</td><td>65469</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>4150</b></td><td class="no-wrap">-></td><td>60927</td><td>ADYEN.AS</td><td>24-Aug-21 0:00:00</td><td>2725.0</td><td>2766.0</td><td>2711.5</td><td>2766.0</td><td>2766.0</td><td>61431</td><td>0.0</td><td>0.0</td><td>False</td></tr>

</table>

<p><b>5</b> rows x <b>12</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Deduplicate rows with Unique

```csharp
// Polars.NET — Unique() deduplicates based on subset of columns
var uniqueSymbols = dfP.Unique(subset: new[] { "symbol" });
display($"Unique symbols: {uniqueSymbols.Height} (from {dfP.Height} total rows)");
uniqueSymbols.Select("symbol").Head(10)
```

    Unique symbols: 50 (from 66355 total rows)

<!-- Polars DataFrame: (10 rows, 1 columns) --><table><thead><tr><th>symbol</th></tr></thead><tbody><tr><td>ABI.BR</td></tr><tr><td>AD.AS</td></tr><tr><td>ADS.DE</td></tr><tr><td>ADYEN.AS</td></tr><tr><td>AI.PA</td></tr><tr><td>AIR.PA</td></tr><tr><td>ALV.DE</td></tr><tr><td>ARGX.BR</td></tr><tr><td>ASML.AS</td></tr><tr><td>BAS.DE</td></tr></tbody></table></div>

#### Deedle — Deduplicate rows with GroupBy and FirstValue

```csharp
// Deedle — unique values by column
var uniqueSymbols = dfD.GetColumn<string>("symbol").Values.Distinct().Count();
display($"Unique symbols: {uniqueSymbols} (from {dfD.RowCount} total rows)");
```

    Unique symbols: 50 (from 66355 total rows)

---
## Summary

| Operation | Polars.NET | Deedle |
|---|---|---|
| **Head / Tail** | `df.Head(n)`, `df.Tail(n)` | `df.GetRowsAt(range)` |
| **Sample** | `df.Sample(n)` | Manual shuffle + `GetRowsAt` |
| **Shape** | `df.Height`, `df.Width`, `df.Shape` | `df.RowCount`, `df.ColumnCount` |
| **Schema** | `df.PrintSchema()` | `df.ColumnKeys.Zip(df.ColumnTypes)` |
| **Describe** | `df.Describe()` | Manual per-column stats |
| **Null count** | `df.Column(col).NullCount` (property) | `df.RowCount - df[col].ValueCount` |
| **Value counts** | `series.ValueCounts()` | `series.GroupBy(v).Select(g => g.KeyCount)` |
| **Unique / NUnique** | `series.Unique()`, `series.NUnique()` | `series.Values.Distinct()` |
| **Estimated size** | `df.EstimatedSize()` | No built-in equivalent |
| **Select single col** | `df.Column("col")` or `df["col"]` | `df.GetColumn<T>("col")` |
| **Select multiple cols** | `df.Select("a", "b")` | `df.Columns[["a", "b"]]` |
| **Select with expression** | `df.Select(Col("a"), expr.Alias("b"))` | No expression system |
| **Drop columns** | `df.Drop("a", "b")` | `df.Columns[keepList]` |
| **Regex col select** | `df.Columns.Where(Regex) + Select` | `df.ColumnKeys.Where(Regex)` |
| **Rename** | `df.Rename(dict)` | `df.RenameColumns(func)` |
| **Reorder** | `df.Select("b", "a")` | `df.Columns[["b", "a"]]` |
| **Boolean filter** | `df.Filter(Col("x").Gt(Lit(n)))` | `df.Where(row => ...)` |
| **AND / OR / NOT** | `.And()`, `.Or()`, `.Not()` | `&&`, `\|\|`, `!` in lambda |
| **IsIn** | `Col("x").IsIn(series)` | `HashSet.Contains` in lambda |
| **IsBetween** | `Col("x").IsBetween(lo, hi)` | Manual range in lambda |
| **Null filter** | `Col("x").IsNull()` / `.IsNotNull()` | Check `ValueCount` or `OptionalValue` |
| **String predicates** | `Col("x").Str.EndsWith(...)` | `string.EndsWith()` in lambda |
| **Date predicates** | `Col("x").Dt.Year().Eq(...)` | `DateTime.Parse().Year` in lambda |
| **Single row** | `df.Slice(i, 1)` | `df.GetRowsAt([i])` |
| **Slice** | `df.Slice(offset, length)` | `df.GetRowsAt(Range)` |
| **Sort** | `df.Sort("col", descending: true)` | `df.SortRowsBy<T>("col", comparer)` |
| **Unique / dedup** | `df.Unique(subset: ["col"])` | `GroupRowsBy + First` |
