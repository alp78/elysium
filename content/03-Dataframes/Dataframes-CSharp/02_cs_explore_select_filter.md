---
title: "02. Explore, Select & Filter - C#"
tags: [csharp, microsoft-data-analysis, polars, dataframes]
aliases:
  - head, tail, describe, filter, where, isin
description: "Polars.NET / Microsoft.Data.Analysis / C# DataFrames reference 02/10 - Explore, Select & Filter (head/tail, describe, where, isin). Executable examples with cell outputs. See [02_py_explore_select_filter](https://alp78.github.io/elysium/03-Dataframes/Dataframes-Python/02_py_explore_select_filter) for the Python equivalent."
parent: "[[domain-ingest-and-explore]]"
links:
  - "[[01_py_foundations_io]]"
  - "[[01_cs_foundations_io]]"
  - "[[02_py_explore_select_filter]]"
  - "[[07_py_types_interop]]"
  - "[[07_cs_types_interop]]"
created: 2026-03-27
updated: 2026-04-07
status: complete
---

# 02 — Exploration, Selection & Filtering

> [!quote]
> "If we have data, let's look at data. If all we have are opinions, let's go with mine."
>
> — **Jim Barksdale**

Polars.NET vs Microsoft.Data.Analysis: inspect data, select columns, and filter rows.

---

Suppress CS1701/CS1702 assembly version warnings in .NET Interactive. Run this cell once before any cells that use NuGet packages.

```csharp
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

Install NuGet packages and import namespaces. Alias Microsoft.Data.Analysis as `MDA` so `DataFrame` continues to refer to Polars.NET inside mixed examples.

```csharp
#r "nuget: Polars.NET, 0.4.0"
#r "nuget: Polars.NET.Native.win-x64, 0.4.0"
#r "nuget: Microsoft.Data.Analysis, 0.23.0"

using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Polars.CSharp;
using static Polars.CSharp.Polars;
using MDA = Microsoft.Data.Analysis;
using Microsoft.DotNet.Interactive.Formatting;

Formatter.Register<Polars.CSharp.DataFrame>((df, writer) =>
{
    var html = df.ToHtml();
    html = System.Text.RegularExpressions.Regex.Replace(html, @"(&gt;|>)(.+?)(&lt;|<)", @"$1$2$3");
    html = System.Text.RegularExpressions.Regex.Replace(html, @">""(.+?)""<", @">$1<");
    writer.Write(html);
}, "text/html");
Formatter.Register<Polars.CSharp.Series>((s, writer) =>
    writer.Write($"<pre style='font-size:14px'>{s}</pre>"), "text/html");

var DATA = Path.Combine("..", "data");
Console.WriteLine($"Data directory: {Path.GetFullPath(DATA)}");
```

```text
Data directory: c:\Users\aperi\DEV\LANG\data
```

Load the primary datasets used throughout this notebook. Both libraries read the same CSV files, so the rest of the page compares API shape and workflow rather than data differences.

```csharp
var dfP = Polars.CSharp.DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"), tryParseDates: true);
var dimP = Polars.CSharp.DataFrame.ReadCsv(Path.Combine(DATA, "dim_country.csv"));

display($"OHLCV: {dfP.Shape}  |  DimCountry: {dimP.Shape}");

var df = MDA.DataFrame.LoadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"));
var dim = MDA.DataFrame.LoadCsv(Path.Combine(DATA, "dim_country.csv"));

display($"OHLCV: ({df.Rows.Count}, {df.Columns.Count})  |  DimCountry: ({dim.Rows.Count}, {dim.Columns.Count})");
```

```text
OHLCV: (66355, 12)  |  DimCountry: (212, 2)
OHLCV: (66355, 12)  |  DimCountry: (212, 2)
```

> [!info] Current API and execution-model check | 2026-04
>
> Microsoft's [`DataFrame` API](https://learn.microsoft.com/en-us/dotnet/api/microsoft.data.analysis.dataframe?view=ml-dotnet-preview) documents `Head`, `Tail`, `Description`, `Info`, `Filter`, `OrderBy`, `LoadCsv`, and `IDataView` interoperability. Polars' [lazy optimization guide](https://docs.pola.rs/user-guide/lazy/optimizations/) documents predicate, projection, and slice pushdown. In practice, the same explore/select/filter logic can stay closer to an optimizable query plan in Polars, while MDA remains an eager in-memory dataframe API.

---

## Data Exploration

The first step after loading data is exploration: previewing rows, inspecting schema, profiling nulls, and understanding value distributions before you write downstream transformations. Polars.NET tends to surface these operations as concise dataframe methods; Microsoft.Data.Analysis exposes the same work through managed `DataFrame` and `DataFrameColumn` APIs.

### Head, Tail, and Sample

#### Polars.NET | Preview first and last rows with Head and Tail

`.Head(n)` and `.Tail(n)` return the first and last N rows. `.Sample(n)` returns N random rows. These are the most common entry points for data exploration.

_Calls `Head(5)` and `Tail(5)` on the 66,355-row OHLCV DataFrame, displaying 5-row previews from each end to confirm schema, date range (2021-01-04 to 2026-03-12), and that all 12 columns are present._

```csharp
display("Head(5):");
display(dfP.Head(5));
display("Tail(5):");
dfP.Tail(5)
```

Head(5):

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

Tail(5):

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>64828</td><td>WKL.AS</td><td>2026-03-06</td><td>69.02</td><td>69.36</td><td>67.82</td><td>68.52</td><td>68.52</td><td>1143729</td><td>0</td><td>0</td><td>false</td></tr><tr><td>66875</td><td>WKL.AS</td><td>2026-03-09</td><td>68.78</td><td>69.16</td><td>67.64</td><td>68.64</td><td>68.64</td><td>841503</td><td>0</td><td>0</td><td>false</td></tr><tr><td>66876</td><td>WKL.AS</td><td>2026-03-10</td><td>68.8</td><td>69.16</td><td>66.34</td><td>67.16</td><td>67.16</td><td>1355645</td><td>0</td><td>0</td><td>false</td></tr><tr><td>66877</td><td>WKL.AS</td><td>2026-03-11</td><td>67.5</td><td>69.6</td><td>67.02</td><td>67.22</td><td>67.22</td><td>1142531</td><td>0</td><td>0</td><td>false</td></tr><tr><td>66929</td><td>WKL.AS</td><td>2026-03-12</td><td>67</td><td>67.54</td><td>66.28</td><td>67.32</td><td>67.32</td><td>210379</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Preview first and last rows with Head and Tail

`Microsoft.Data.Analysis` exposes `Head(n)` and `Tail(n)` directly on `DataFrame`, so the first preview workflow is very close to Polars for this use case.

_Calls `Head(5)` and `Tail(5)` on the 66,355-row OHLCV DataFrame to verify that the dataset loaded correctly, the row ordering is intact, and all 12 columns are present in both previews._

```csharp
display("Head(5):");
display(df.Head(5));
display("Tail(5):");
df.Tail(5)
```

```text
Head(5):
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04 00:00:00Z</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05 00:00:00Z</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06 00:00:00Z</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07 00:00:00Z</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08 00:00:00Z</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0</td><td>0</td><td>False</td></tr></tbody></table>

```text
Tail(5):
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>64828</td><td>WKL.AS</td><td>2026-03-06 00:00:00Z</td><td>69.02</td><td>69.36</td><td>67.82</td><td>68.52</td><td>68.52</td><td>1143729</td><td>0</td><td>0</td><td>False</td></tr><tr><td>66875</td><td>WKL.AS</td><td>2026-03-09 00:00:00Z</td><td>68.78</td><td>69.16</td><td>67.64</td><td>68.64</td><td>68.64</td><td>841503</td><td>0</td><td>0</td><td>False</td></tr><tr><td>66876</td><td>WKL.AS</td><td>2026-03-10 00:00:00Z</td><td>68.8</td><td>69.16</td><td>66.34</td><td>67.16</td><td>67.16</td><td>1355645</td><td>0</td><td>0</td><td>False</td></tr><tr><td>66877</td><td>WKL.AS</td><td>2026-03-11 00:00:00Z</td><td>67.5</td><td>69.6</td><td>67.02</td><td>67.22</td><td>67.22</td><td>1142531</td><td>0</td><td>0</td><td>False</td></tr><tr><td>66929</td><td>WKL.AS</td><td>2026-03-12 00:00:00Z</td><td>67</td><td>67.54</td><td>66.28</td><td>67.32</td><td>67.32</td><td>210379</td><td>0</td><td>0</td><td>False</td></tr></tbody></table>

#### Polars.NET | Random sample with Sample

`.Sample(n)` returns N random rows from the DataFrame. Useful for quick spot-checking of large datasets.

_Draws 5 random rows from `dfP` without a fixed seed — output changes each run, making it useful for spot-checking value distributions and confirming no obvious data anomalies._

```csharp
dfP.Sample(5)
```

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>48632</td><td>BMW.DE</td><td>2025-03-21</td><td>79.5</td><td>80.1</td><td>77.94</td><td>79.16</td><td>75.1068</td><td>3215296</td><td>0</td><td>0</td><td>false</td></tr><tr><td>13368</td><td>ALV.DE</td><td>2021-07-26</td><td>209.15</td><td>211.15</td><td>207.8</td><td>211.15</td><td>173.0352</td><td>475414</td><td>0</td><td>0</td><td>false</td></tr><tr><td>54306</td><td>SGO.PA</td><td>2021-08-10</td><td>63.93</td><td>64.31</td><td>63.86</td><td>64.26</td><td>57.3201</td><td>700160</td><td>0</td><td>0</td><td>false</td></tr><tr><td>20409</td><td>IBE.MC</td><td>2023-03-24</td><td>11.085</td><td>11.085</td><td>10.96</td><td>11.07</td><td>9.7173</td><td>12976210</td><td>0</td><td>0</td><td>false</td></tr><tr><td>5092</td><td>OR.PA</td><td>2025-05-13</td><td>394.15</td><td>394.25</td><td>385</td><td>385.15</td><td>385.15</td><td>318152</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Random sample with an explicit mask

The current API surface documents `Sample(Int32)`, but the explicit helper below is still useful because it shows the row-filtering model MDA falls back to in more complex cases: build a boolean mask and pass it into `Filter()`.

_Builds a `Sample(DataFrame data, int n)` helper that randomly selects row indices, turns them into a boolean mask, and returns `data.Filter(mask)` to produce a 5-row exploratory sample._

```csharp
MDA.DataFrame Sample(MDA.DataFrame data, int n)
{
    var rand = new Random();
    var indices = new HashSet<long>();
    while(indices.Count < n && indices.Count < data.Rows.Count)
    {
        indices.Add(rand.NextInt64(0, data.Rows.Count));
    }

    var mask = new MDA.PrimitiveDataFrameColumn<bool>("mask", data.Rows.Count);
    for(long i = 0; i < data.Rows.Count; i++) mask[i] = indices.Contains(i);

    return data.Filter(mask);
}

Sample(df, 5)
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>28704</td><td>AI.PA</td><td>2024-08-19 00:00:00Z</td><td>166.06</td><td>166.52</td><td>165.4</td><td>165.4</td><td>162.4755</td><td>445438</td><td>0</td><td>0</td><td>False</td></tr><tr><td>25248</td><td>BNP.PA</td><td>2021-06-30 00:00:00Z</td><td>53.2</td><td>53.44</td><td>52.14</td><td>52.87</td><td>38.1249</td><td>3382152</td><td>0</td><td>0</td><td>False</td></tr><tr><td>44508</td><td>DHL.DE</td><td>2024-06-20 00:00:00Z</td><td>37.89</td><td>38.24</td><td>37.79</td><td>38.15</td><td>36.3015</td><td>1838244</td><td>0</td><td>0</td><td>False</td></tr><tr><td>9331</td><td>DTE.DE</td><td>2021-04-15 00:00:00Z</td><td>16.088</td><td>16.098</td><td>15.964</td><td>15.992</td><td>14.0211</td><td>9225277</td><td>0</td><td>0</td><td>False</td></tr><tr><td>9101</td><td>ITX.MC</td><td>2025-07-22 00:00:00Z</td><td>41.92</td><td>42.08</td><td>41.8</td><td>42.04</td><td>41.3225</td><td>1215364</td><td>0</td><td>0</td><td>False</td></tr></tbody></table>

### Shape and Schema

#### Polars.NET | Inspect shape with Height, Width, and Schema

`.Shape` returns `(rows, columns)`, `.Height` and `.Width` return individual dimensions. `.PrintSchema()` displays the Arrow type for every column.

_Prints `(66355, 12)` from `.Shape` and individual dimensions, then calls `.PrintSchema()` to list all 12 columns with their Arrow types — including `Date`, `Float64`, `Int64`, `String`, and `Boolean`._

```csharp
display($"Shape: {dfP.Shape}  |  Height: {dfP.Height}  |  Width: {dfP.Width}");
dfP.PrintSchema();
```

```text
Shape: (66355, 12)  |  Height: 66355  |  Width: 12
```

```text
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
```

#### Microsoft.Data.Analysis | Inspect shape with row counts and Info

MDA exposes row and column counts directly from `Rows.Count` and `Columns.Count`, and `Info()` provides the concise schema-like view used for quick inspection.

_Prints the OHLCV shape as `(66355, 12)` and then calls `Info()` to summarize the 12 columns, their CLR data types, and basic completeness metadata before any downstream selection or filtering logic._

```csharp
display($"Shape: ({df.Rows.Count}, {df.Columns.Count})  |  Height: {df.Rows.Count}  |  Width: {df.Columns.Count}");
df.Info();
```

```text
Shape: (66355, 12)  |  Height: 66355  |  Width: 12
```

### Summary Statistics

#### Polars.NET | Summary statistics with Describe

`.Describe()` returns a DataFrame with count, null_count, mean, std, min, percentiles (25%, 50%, 75%), and max for all numeric columns. Non-numeric columns are excluded.

_Calls `.Describe()` on `dfP`, producing a 9-row summary (count through max) across 9 numeric columns — `symbol`, `date`, and `is_filled` are excluded as non-numeric._

```csharp
dfP.Describe()
```

<!-- Polars DataFrame: (9 rows, 10 columns) --><table><thead><tr><th>statistic</th><th>id</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th></tr></thead><tbody><tr><td>count</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td></tr><tr><td>null_count</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr><tr><td>mean</td><td>33179.7331</td><td>197.0405202</td><td>199.364124</td><td>194.5857816</td><td>197.0349004</td><td>190.4949089</td><td>5942123.691</td><td>0.01175667386</td><td>0.0001720326822</td></tr><tr><td>std</td><td>19158.20139</td><td>363.1504839</td><td>367.8738291</td><td>358.011643</td><td>363.052047</td><td>359.6353012</td><td>16156185.53</td><td>0.2831418842</td><td>0.02271628163</td></tr><tr><td>min</td><td>1</td><td>1.601</td><td>1.6628</td><td>1.5842</td><td>1.6066</td><td>1.2013</td><td>0</td><td>0</td><td>0</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Summary statistics with Description

`Description()` is the MDA equivalent for numeric summary statistics. It returns another `DataFrame`, which keeps the result easy to inspect or reuse in notebook workflows.

_Computes descriptive statistics for the numeric columns in `df`, returning a summary DataFrame that highlights counts, minima, maxima, and mean values for the OHLCV data._

```csharp
df.Description()
```

<table><thead><tr><th>Description</th><th>id</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th></tr></thead><tbody><tr><td>Length (excluding null values)</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td></tr><tr><td>Max</td><td>66930</td><td>&lt;null&gt;</td><td>2926</td><td>2957</td><td>2813</td><td>2839</td><td>2802.9382</td><td>376391550</td><td>22.5</td><td>5</td></tr><tr><td>Min</td><td>1</td><td>&lt;null&gt;</td><td>1.601</td><td>1.6628</td><td>1.5842</td><td>1.6066</td><td>1.2013</td><td>0</td><td>0</td><td>0</td></tr><tr><td>Mean</td><td>33179.312</td><td>&lt;null&gt;</td><td>197.04108</td><td>199.36696</td><td>194.58563</td><td>197.03654</td><td>190.49628</td><td>5942157.5</td><td>0.01175667</td><td>0.00017203267</td></tr></tbody></table>

### Null Counts

#### Polars.NET | Count nulls per column

`.NullCount` is a property on each Series (not on DataFrame). Iterate columns and check for non-zero null counts to identify data quality issues.

_Loads `scores_daily.csv` (466 rows, 36 columns) and iterates all columns, printing only those with non-zero `.NullCount` — revealing 5 columns with gaps ranging from 3 (`pe_zscore`) to 71 (`ev_ebitda_zscore`)._

```csharp
var scP = Polars.CSharp.DataFrame.ReadCsv(Path.Combine(DATA, "scores_daily.csv"), tryParseDates: true);
Console.WriteLine($"scores_daily: {scP.Shape}");
foreach (var col in scP.Columns)
{
    var nc = scP.Column(col).NullCount;
    if (nc > 0)
        Console.WriteLine($"  {col,-28} {nc,4} nulls");
}
```

```text
scores_daily: (466, 36)
  pe_zscore                       3 nulls
  pb_zscore                       6 nulls
  ev_ebitda_zscore               71 nulls
  yield_zscore                   35 nulls
  recommendation_mean            14 nulls
```

#### Microsoft.Data.Analysis | Count nulls per column

Null counts live on each `DataFrameColumn` via `NullCount`, so the standard pattern is to iterate columns and record the fields that actually contain missing data.

_Loads `scores_daily.csv`, iterates through its columns, and prints only the fields whose `NullCount` is greater than zero so that missing-value hot spots stand out immediately._

```csharp
var scP = MDA.DataFrame.LoadCsv(Path.Combine(DATA, "scores_daily.csv"));
Console.WriteLine($"scores_daily: ({scP.Rows.Count}, {scP.Columns.Count})");
foreach (var col in scP.Columns)
{
    var nc = col.NullCount;
    if (nc > 0)
        Console.WriteLine($"  {col.Name,-28} {nc,4} nulls");
}
```

```text
scores_daily: (466, 36)
  pe_zscore                       3 nulls
  pb_zscore                       6 nulls
  ev_ebitda_zscore               71 nulls
  yield_zscore                   35 nulls
  recommendation_mean            14 nulls
```

### Value Counts and Unique Values

#### Polars.NET | Frequency distribution with ValueCounts

`.ValueCounts()` on a Series returns a two-column DataFrame with each unique value and its count. Useful for understanding cardinality and distribution of categorical columns.

_Calls `.ValueCounts()` on the `symbol` Series, returning a 50-row DataFrame with each EuroStoxx ticker and its row count — most show 1,331, with slight variation for delisted or late-added constituents._

```csharp
dfP.Column("symbol").ValueCounts()
```

<!-- Polars DataFrame: (50 rows, 2 columns) --><table><thead><tr><th>symbol</th><th>count</th></tr></thead><tbody><tr><td>ABI.BR</td><td>1331</td></tr><tr><td>AD.AS</td><td>1331</td></tr><tr><td>ADYEN.AS</td><td>1331</td></tr><tr><td>AI.PA</td><td>1331</td></tr><tr><td>AIR.PA</td><td>1331</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Frequency distribution with ValueCounts

`ValueCounts()` is available on a column and returns a new DataFrame of unique values plus their counts. This is the fastest way to inspect categorical distributions in MDA.

_Computes `ValueCounts()` for the `symbol` column, returning one row per ticker together with its observation count across the 66,355-row OHLCV dataset._

```csharp
df.Columns["symbol"].ValueCounts()
```

<table><thead><tr><th>Values</th><th>Counts</th></tr></thead><tbody><tr><td>ABI.BR</td><td>1331</td></tr><tr><td>AD.AS</td><td>1331</td></tr><tr><td>ADS.DE</td><td>1324</td></tr><tr><td>ADYEN.AS</td><td>1331</td></tr><tr><td>AI.PA</td><td>1331</td></tr></tbody></table><script>var page = parseInt(document.querySelector('#page_639110735296256504').innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639110735296256504 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j < 25; j++) { pageRows[j].style.display='table-row'; } </script>

#### Polars.NET | Distinct values with Unique and NUnique

`.Unique()` returns a Series of distinct values. `.NUnique` (property) returns the count of distinct values.

_Extracts the `symbol` Series, prints `NUnique: 50`, then calls `.Unique()` to return the 50 distinct ticker strings — demonstrating the property/method pair for cardinality check and enumeration._

```csharp
var symSeries = dfP.Column("symbol");
display($"NUnique: {symSeries.NUnique}");
symSeries.Unique()
```

```text
NUnique: 50
```

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

#### Microsoft.Data.Analysis | Distinct values with LINQ Distinct

When you want the set of unique values without the counts, the MDA pattern is usually to cast the column to a typed enumerable and use LINQ `Distinct()` before materializing the result back into a DataFrame.

_Casts the `symbol` column to `string`, computes the distinct tickers with LINQ, prints the unique-count result, and materializes the distinct values into a one-column DataFrame._

```csharp
var symSeries = df.Columns["symbol"].Cast<string>();
var distinctSymbols = symSeries.Distinct().ToArray();
display($"NUnique: {distinctSymbols.Length}");

new MDA.DataFrame(new MDA.StringDataFrameColumn("symbol", distinctSymbols))
```

```text
NUnique: 50
```

<table><thead><tr><th>symbol</th></tr></thead><tbody><tr><td>ABI.BR</td></tr><tr><td>AD.AS</td></tr><tr><td>ADS.DE</td></tr><tr><td>ADYEN.AS</td></tr><tr><td>AI.PA</td></tr></tbody></table><script>var page = parseInt(document.querySelector('#page_639110735362759510').innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639110735362759510 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j < 25; j++) { pageRows[j].style.display='table-row'; } </script>

### Memory Estimation and Profiling

#### Polars.NET | Estimate memory usage

Polars.NET 0.4.0 does not expose `EstimatedSize()` directly. Estimate by multiplying column length by byte size per Arrow type.

_Iterates all 12 columns of `dfP`, assigns byte widths per Arrow type via a `switch` expression (8 bytes for Float64/Int64/Date, 40 for strings), and prints the total — `6.07 MB` for 66,355 rows._

```csharp
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

```text
Estimated size: 6,370,080 bytes (6.07 MB)
Shape: (66355, 12)  |  66,355 rows x 12 cols
```

#### Microsoft.Data.Analysis | Memory estimate via CLR-type heuristic

MDA does not expose a direct equivalent to Polars `EstimatedSize()`, so a practical approximation is to estimate bytes from the inferred CLR type and multiply by column length.

_Estimates dataframe size by summing `column length x assumed byte width` across all columns, then reports the approximate byte and megabyte footprint alongside the dataframe shape._

```csharp
long estBytes = 0;
foreach (var col in df.Columns)
{
    estBytes += col.Length * (col.DataType.Name switch
    {
        "Int32" or "Single" => 4,
        "Int64" or "Double" or "DateTime" => 8,
        "Boolean" => 1,
        "String" => 40,  // rough average string footprint
        _ => 8
    });
}
display($"Estimated size: {estBytes:N0} bytes ({estBytes / 1_048_576.0:F2} MB)");
display($"Shape: ({df.Rows.Count}, {df.Columns.Count})  |  {df.Rows.Count:N0} rows x {df.Columns.Count} cols");
```

```text
Estimated size: 5'640'175 bytes (5.38 MB)
```

```text
Shape: (66355, 12)  |  66'355 rows x 12 cols
```

#### Polars.NET | Reusable quick-profile function

A reusable profiler that returns column name, Arrow type, null count, and unique count for any DataFrame. Useful as a first step when exploring an unfamiliar dataset.

_Defines `ProfilePolars(DataFrame df)` which assembles a 4-column summary DataFrame (column, type, nulls, unique), then calls it on both `dfP` (12 columns, all 0 nulls) and `dimP` (2 columns) — showing cardinality and type at a glance._

```csharp
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

<!-- Polars DataFrame: (12 rows, 4 columns) --><table><thead><tr><th>column</th><th>type</th><th>nulls</th><th>unique</th></tr></thead><tbody><tr><td>id</td><td>i64</td><td>0</td><td>66355</td></tr><tr><td>symbol</td><td>str</td><td>0</td><td>50</td></tr><tr><td>date</td><td>date</td><td>0</td><td>1331</td></tr><tr><td>open</td><td>f64</td><td>0</td><td>29671</td></tr><tr><td>high</td><td>f64</td><td>0</td><td>31651</td></tr></tbody></table></div>

dim_country: (212, 2)

<!-- Polars DataFrame: (2 rows, 4 columns) --><table><thead><tr><th>column</th><th>type</th><th>nulls</th><th>unique</th></tr></thead><tbody><tr><td>country_name</td><td>str</td><td>0</td><td>212</td></tr><tr><td>iso_alpha2</td><td>str</td><td>0</td><td>212</td></tr></tbody></table></div>

---

#### Microsoft.Data.Analysis | Reusable quick-profile function

When basic exploration needs to become repeatable, build a small profiling function that emits column name, CLR type, null count, and distinct count for any DataFrame.

_Defines `ProfileDataFrame(DataFrame d)`, computes per-column type, null count, and unique count, and applies it to both `eurostoxx50_ohlcv` and `dim_country` to produce reusable profile tables._

```csharp
MDA.DataFrame ProfileDataFrame(MDA.DataFrame d)
{
    var cols = d.Columns.ToArray();
    var colNames = new string[cols.Length];
    var types = new string[cols.Length];
    var nulls = new long[cols.Length];
    var uniques = new long[cols.Length];

    for (int j = 0; j < cols.Length; j++)
    {
        var s = d.Columns[j];
        colNames[j] = s.Name;
        types[j] = s.DataType.Name;
        nulls[j] = s.NullCount;
        uniques[j] = s.ValueCounts().Rows.Count;
    }

    return new MDA.DataFrame(
        new MDA.StringDataFrameColumn("column", colNames),
        new MDA.StringDataFrameColumn("type", types),
        new MDA.PrimitiveDataFrameColumn<long>("nulls", nulls),
        new MDA.PrimitiveDataFrameColumn<long>("unique", uniques)
    );
}

display($"eurostoxx50_ohlcv: ({df.Rows.Count}, {df.Columns.Count})");
display(ProfileDataFrame(df));
display($"dim_country: ({dim.Rows.Count}, {dim.Columns.Count})");
display(ProfileDataFrame(dim));
```

```text
eurostoxx50_ohlcv: (66355, 12)
```

<table><thead><tr><th>column</th><th>type</th><th>nulls</th><th>unique</th></tr></thead><tbody><tr><td>id</td><td>Single</td><td>0</td><td>66355</td></tr><tr><td>symbol</td><td>String</td><td>0</td><td>50</td></tr><tr><td>date</td><td>DateTime</td><td>0</td><td>1331</td></tr><tr><td>open</td><td>Single</td><td>0</td><td>29671</td></tr><tr><td>high</td><td>Single</td><td>0</td><td>31651</td></tr></tbody></table>

```text
dim_country: (212, 2)
```

<table><thead><tr><th>column</th><th>type</th><th>nulls</th><th>unique</th></tr></thead><tbody><tr><td>country_name</td><td>String</td><td>0</td><td>212</td></tr><tr><td>iso_alpha2</td><td>String</td><td>0</td><td>212</td></tr></tbody></table>

## Column Selection

Column selection is where the libraries start to diverge more clearly. Polars.NET leans toward query-like projection expressions; Microsoft.Data.Analysis usually builds new frames from existing column objects and explicit column arithmetic.

> [!info] Polars.NET vs Microsoft.Data.Analysis | Projection model
>
> Polars.NET uses an expression API that scales naturally into larger transformation graphs. Microsoft.Data.Analysis stays closer to explicit managed-column assembly: clone or select the columns you need, compute derived columns directly, and materialize the result into a new `DataFrame`.

### Single Column Selection

#### Polars.NET | Select a single column by name

`.Column("name")` or the indexer `df["name"]` returns a Polars Series (untyped). The Series carries the column name and Arrow data type.

_Retrieves `close` as an untyped Series (name: `close`, type: `f64`, length: 66,355), then retrieves `symbol` via the `df["name"]` indexer — confirming both access patterns return equivalent Series objects._

```csharp
var closeSeries = dfP.Column("close");
display($"Name: {closeSeries.Name}  |  Length: {closeSeries.Length}  |  Type: {closeSeries.DataTypeName}");

// Also via indexer
var symbolSeries = dfP["symbol"];
display($"Name: {symbolSeries.Name}  |  Length: {symbolSeries.Length}");
```

```text
Name: close  |  Length: 66355  |  Type: f64
Name: symbol  |  Length: 66355
```

#### Microsoft.Data.Analysis | Select a single column by name

Selecting one column returns a `DataFrameColumn`, not a one-column DataFrame. That is convenient for direct vector operations, but downstream code needs to stay clear about whether it expects a column or a frame.

_Selects `close` and `symbol` from `df.Columns[...]`, then prints each column's name, length, and data type metadata to confirm the object returned is a `DataFrameColumn`._

```csharp
var closeSeries = df.Columns["close"];
display($"Name: {closeSeries.Name}  |  Length: {closeSeries.Length}  |  Type: {closeSeries.DataType.Name}");

var symbolSeries = df.Columns["symbol"];
display($"Name: {symbolSeries.Name}  |  Length: {symbolSeries.Length}");
```

```text
Name: close  |  Length: 66355  |  Type: Single
```

```text
Name: symbol  |  Length: 66355
```

### Multiple Column Selection

#### Polars.NET | Select multiple columns by name

`.Select("a", "b", ...)` returns a new DataFrame containing only the specified columns, in the specified order.

_Narrows the 12-column OHLCV DataFrame to 4 columns (`date`, `symbol`, `close`, `volume`) in the specified order and previews 5 rows — confirming column order follows the argument sequence._

```csharp
dfP.Select("date", "symbol", "close", "volume").Head(5)
```

<!-- Polars DataFrame: (5 rows, 4 columns) --><table><thead><tr><th>date</th><th>symbol</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>2021-01-04</td><td>ABI.BR</td><td>57.21</td><td>1513937</td></tr><tr><td>2021-01-05</td><td>ABI.BR</td><td>57.18</td><td>1382722</td></tr><tr><td>2021-01-06</td><td>ABI.BR</td><td>58.77</td><td>1370204</td></tr><tr><td>2021-01-07</td><td>ABI.BR</td><td>58.4</td><td>1469911</td></tr><tr><td>2021-01-08</td><td>ABI.BR</td><td>57.86</td><td>1428681</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Select multiple columns into a new DataFrame

The standard MDA pattern is to construct a new `DataFrame` from the selected column objects. This is explicit and readable, but less declarative than Polars projection expressions when the selection logic becomes dynamic.

_Builds a new DataFrame from `date`, `symbol`, `close`, and `volume`, then previews the first five rows to confirm the four-column projection._

```csharp
var selected = new MDA.DataFrame(df.Columns["date"], df.Columns["symbol"], df.Columns["close"], df.Columns["volume"]);
selected.Head(5)
```

<table><thead><tr><th>date</th><th>symbol</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>2021-01-04 00:00:00Z</td><td>ABI.BR</td><td>57.21</td><td>1513937</td></tr><tr><td>2021-01-05 00:00:00Z</td><td>ABI.BR</td><td>57.18</td><td>1382722</td></tr><tr><td>2021-01-06 00:00:00Z</td><td>ABI.BR</td><td>58.77</td><td>1370204</td></tr><tr><td>2021-01-07 00:00:00Z</td><td>ABI.BR</td><td>58.4</td><td>1469911</td></tr><tr><td>2021-01-08 00:00:00Z</td><td>ABI.BR</td><td>57.86</td><td>1428681</td></tr></tbody></table>

### Expressions and Computed Columns

#### Polars.NET | Select with expressions and rename with Alias

Polars expressions allow compute-on-select: derive new columns, apply arithmetic, and rename — all in a single `.Select()` call.

_Selects `symbol`, renames `close` to `price` with `.Alias()`, and computes a new `range` column as `high - low` in one `.Select()` call — returning a 3-column, 5-row DataFrame showing price and intraday range per row._

```csharp
dfP.Select(
    Col("symbol"),
    Col("close").Alias("price"),
    (Col("high") - Col("low")).Alias("range")
).Head(5)
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>symbol</th><th>price</th><th>range</th></tr></thead><tbody><tr><td>ABI.BR</td><td>57.21</td><td>2.07</td></tr><tr><td>ABI.BR</td><td>57.18</td><td>1.23</td></tr><tr><td>ABI.BR</td><td>58.77</td><td>1.55</td></tr><tr><td>ABI.BR</td><td>58.4</td><td>0.98</td></tr><tr><td>ABI.BR</td><td>57.86</td><td>0.97</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Compute columns explicitly and rename with SetName

MDA supports vectorized column arithmetic, but computed projections are assembled explicitly: clone the source columns you want to keep, compute the derived column, rename it, and build a new DataFrame from those pieces.

_Clones `symbol` and `close`, renames `close` to `price`, computes `range = high - low`, and materializes the result as a three-column DataFrame for inspection._

```csharp
var symbolCol = df.Columns["symbol"].Clone();
var priceCol = df.Columns["close"].Clone();
priceCol.SetName("price");

var highCol = (MDA.PrimitiveDataFrameColumn<float>)df.Columns["high"];
var lowCol = (MDA.PrimitiveDataFrameColumn<float>)df.Columns["low"];
var rangeCol = highCol - lowCol;
rangeCol.SetName("range");

var computed = new MDA.DataFrame(symbolCol, priceCol, rangeCol);
computed.Head(5)
```

<table><thead><tr><th>symbol</th><th>price</th><th>range</th></tr></thead><tbody><tr><td>ABI.BR</td><td>57.21</td><td>2.0699997</td></tr><tr><td>ABI.BR</td><td>57.18</td><td>1.2299995</td></tr><tr><td>ABI.BR</td><td>58.77</td><td>1.5499992</td></tr><tr><td>ABI.BR</td><td>58.4</td><td>0.97999954</td></tr><tr><td>ABI.BR</td><td>57.86</td><td>0.9700012</td></tr></tbody></table>

### Dropping, Filtering, and Renaming Columns

#### Polars.NET | Exclude columns with Drop

Drop columns by building a keep-list and passing it to `.Select()`. Polars.NET 0.4.0 does not have a `.Drop()` method — filter the column names in C# instead.

_Defines a `HashSet` of 5 columns to drop (`id`, `adj_close`, `dividends`, `stock_splits`, `is_filled`), builds a keep-list via LINQ `.Where()`, and calls `.Select(keepCols)` — leaving a 7-column OHLCV core DataFrame._

```csharp
var dropCols = new HashSet<string> { "id", "adj_close", "dividends", "stock_splits", "is_filled" };
var keepCols = dfP.Columns.Where(c => !dropCols.Contains(c)).ToArray();
var trimmed = dfP.Select(keepCols);
display($"Columns: {string.Join(", ", trimmed.Columns)}");
trimmed.Head(3)
```

Columns: symbol, date, open, high, low, close, volume

<!-- Polars DataFrame: (3 rows, 7 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>1370204</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Exclude columns by building the keep-set

Dropping columns is usually written as the inverse problem: define the columns to exclude, then build a new DataFrame from the columns that remain.

_Defines a `dropCols` set, selects every column not in that set, prints the resulting column list, and previews the trimmed frame._

```csharp
var dropCols = new HashSet<string> { "id", "adj_close", "dividends", "stock_splits", "is_filled" };
var keepCols = df.Columns.Where(c => !dropCols.Contains(c.Name)).ToArray();
var trimmed = new MDA.DataFrame(keepCols);
display($"Columns: {string.Join(", ", trimmed.Columns.Select(c => c.Name))}");
trimmed.Head(3)
```

```text
Columns: symbol, date, open, high, low, close, volume
```

<table><thead><tr><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04 00:00:00Z</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>2021-01-05 00:00:00Z</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>2021-01-06 00:00:00Z</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>1370204</td></tr></tbody></table>

#### Polars.NET | Select columns matching a regex pattern

Filter the `.Columns` list with a `Regex` and pass the matches to `.Select()`.

_Applies `^(open|high|low|close)$` to `.Columns` via LINQ, collects 4 matched price columns, then calls `.Select(priceCols)` — returning a 5-row preview containing only the OHLC fields._

```csharp
var pattern = new Regex("^(open|high|low|close)$");
var priceCols = dfP.Columns.Where(c => pattern.IsMatch(c)).ToArray();
display($"Matched: {string.Join(", ", priceCols)}");
dfP.Select(priceCols).Head(5)
```

Matched: open, high, low, close

<!-- Polars DataFrame: (5 rows, 4 columns) --><table><thead><tr><th>open</th><th>high</th><th>low</th><th>close</th></tr></thead><tbody><tr><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td></tr><tr><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td></tr><tr><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td></tr><tr><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td></tr><tr><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Select columns matching a regex pattern

Regex-based selection in MDA is a `Columns.Where(...)` operation followed by a new DataFrame constructor. This keeps the logic flexible when column names follow domain conventions.

_Uses the regex `^(open|high|low|close)$` to isolate the OHLC price columns, prints the matched column names, and previews the resulting four-column DataFrame._

```csharp
var pattern = new Regex("^(open|high|low|close)$");
var priceCols = df.Columns.Where(c => pattern.IsMatch(c.Name)).ToArray();
var regexDf = new MDA.DataFrame(priceCols);
display($"Matched: {string.Join(", ", regexDf.Columns.Select(c => c.Name))}");
regexDf.Head(5)
```

```text
Matched: open, high, low, close
```

<table><thead><tr><th>open</th><th>high</th><th>low</th><th>close</th></tr></thead><tbody><tr><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td></tr><tr><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td></tr><tr><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td></tr><tr><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td></tr><tr><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td></tr></tbody></table>

#### Polars.NET | Rename columns with Rename

`.Rename()` accepts a `Dictionary<string, string>` mapping old names to new names.

_Selects `symbol`, `close`, and `volume`, then calls `.Rename()` with a `Dictionary` mapping each to `ticker`, `price`, and `vol` — returning a 3-column, 3-row DataFrame with renamed headers confirmed by the display output._

```csharp
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

#### Microsoft.Data.Analysis | Rename columns with cloned columns and SetName

Renaming usually means cloning the source columns, mutating their names, and then materializing the renamed set into a new frame.

_Clones `symbol`, `close`, and `volume`, renames them to `ticker`, `price`, and `vol`, prints the new schema, and previews the renamed DataFrame._

```csharp
var renamed = new MDA.DataFrame(df.Columns["symbol"].Clone(), df.Columns["close"].Clone(), df.Columns["volume"].Clone());
renamed.Columns["symbol"].SetName("ticker");
renamed.Columns["close"].SetName("price");
renamed.Columns["volume"].SetName("vol");

display($"Columns: {string.Join(", ", renamed.Columns.Select(c => c.Name))}");
renamed.Head(3)
```

```text
Columns: ticker, price, vol
```

<table><thead><tr><th>ticker</th><th>price</th><th>vol</th></tr></thead><tbody><tr><td>ABI.BR</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>58.77</td><td>1370204</td></tr></tbody></table>

#### Polars.NET | Reorder columns with Select

Passing column names in a different order to `.Select()` reorders the columns in the result.

_Calls `.Select()` with 7 columns in custom order (symbol, date, volume, then OHLC), returning a 3-row preview with `volume` before the price columns — confirming Polars respects argument sequence._

```csharp
var reordered = dfP.Select("symbol", "date", "volume", "open", "high", "low", "close");
display($"Column order: {string.Join(", ", reordered.Columns)}");
reordered.Head(3)
```

Column order: symbol, date, volume, open, high, low, close

<!-- Polars DataFrame: (3 rows, 7 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>volume</th><th>open</th><th>high</th><th>low</th><th>close</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>1513937</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>1382722</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>1370204</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Reorder columns by constructor order

Column order is simply the order in which the selected columns are passed into the new `DataFrame`. That makes reordering straightforward, but still a manual projection step.

_Constructs a new DataFrame in the order `symbol`, `date`, `volume`, `open`, `high`, `low`, `close`, prints the resulting column order, and previews the reordered frame._

```csharp
var reordered = new MDA.DataFrame(
    df.Columns["symbol"], df.Columns["date"], df.Columns["volume"],
    df.Columns["open"], df.Columns["high"], df.Columns["low"], df.Columns["close"]
);
display($"Column order: {string.Join(", ", reordered.Columns.Select(c => c.Name))}");
reordered.Head(3)
```

```text
Column order: symbol, date, volume, open, high, low, close
```

<table><thead><tr><th>symbol</th><th>date</th><th>volume</th><th>open</th><th>high</th><th>low</th><th>close</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04 00:00:00Z</td><td>1513937</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td></tr><tr><td>ABI.BR</td><td>2021-01-05 00:00:00Z</td><td>1382722</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td></tr><tr><td>ABI.BR</td><td>2021-01-06 00:00:00Z</td><td>1370204</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td></tr></tbody></table>

## Row Filtering

Row filtering is where the operational boundary matters most. In Polars, predicates are expression objects that can later participate in lazy planning and pushdown. In Microsoft.Data.Analysis, filters are eager boolean masks over already materialized columns.

> [!question] Where should production filters live?
>
> If the predicate can run in SQL, DuckDB, or a lakehouse scan, keep it there so the source system reduces bytes before the dataframe is materialized. Local dataframe filtering is most valuable when the data is already in memory or the logic belongs to notebook-side exploration and feature engineering.

> [!tip] Polars expressions vs MDA masks
>
> Polars filters are expressions that can later participate in lazy optimization, including predicate, projection, and slice pushdown. Microsoft.Data.Analysis filters are explicit boolean mask materializations over managed columns, which is clear for notebook work and ML.NET preparation but more verbose for wide production pipelines.

### Boolean Filters

#### Polars.NET | Boolean filter with expressions

`.Filter()` accepts a boolean expression built from `Col()`, `Lit()`, and C# operator overloads (`>`, `<`, `==`, `!=`, `&`, `|`).

_Filters `dfP` to rows where `close > 500.0`, returning 6,155 rows — predominantly high-priced stocks like ADYEN.AS and ASML.AS, confirmed by the 5-row preview showing ADYEN values above 1,700._

```csharp
var expensive = dfP.Filter(Col("close") > Lit(500.0));
display($"Rows where close > 500: {expensive.Height}");
expensive.Head(5)
```

```text
Rows where close > 500: 6155
```

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>60763</td><td>ADYEN.AS</td><td>2021-01-04</td><td>1900</td><td>1921.5</td><td>1856</td><td>1859.5</td><td>1859.5</td><td>99408</td><td>0</td><td>0</td><td>false</td></tr><tr><td>60764</td><td>ADYEN.AS</td><td>2021-01-05</td><td>1848.5</td><td>1857</td><td>1814</td><td>1829</td><td>1829</td><td>86256</td><td>0</td><td>0</td><td>false</td></tr><tr><td>60765</td><td>ADYEN.AS</td><td>2021-01-06</td><td>1822</td><td>1824</td><td>1706.5</td><td>1733</td><td>1733</td><td>156844</td><td>0</td><td>0</td><td>false</td></tr><tr><td>60766</td><td>ADYEN.AS</td><td>2021-01-07</td><td>1735</td><td>1754</td><td>1708.5</td><td>1714.5</td><td>1714.5</td><td>90183</td><td>0</td><td>0</td><td>false</td></tr><tr><td>60767</td><td>ADYEN.AS</td><td>2021-01-08</td><td>1730</td><td>1764.5</td><td>1715</td><td>1756.5</td><td>1756.5</td><td>97176</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Boolean filter with elementwise comparison

Numeric predicates are expressed as vectorized elementwise comparisons on a typed column, and the resulting boolean column is passed into `DataFrame.Filter(...)`.

_Casts `close` to `MDA.PrimitiveDataFrameColumn<float>`, builds the predicate `close > 500`, filters the dataframe, prints the row count, and previews the first five matching rows._

```csharp
var closeCol = (MDA.PrimitiveDataFrameColumn<float>)df.Columns["close"];

var expensive = df.Filter(closeCol.ElementwiseGreaterThan(500.0f));

display($"Rows where close > 500: {expensive.Rows.Count}");
expensive.Head(5)
```

```text
Rows where close > 500: 6155
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>60763</td><td>ADYEN.AS</td><td>2021-01-04 00:00:00Z</td><td>1900</td><td>1921.5</td><td>1856</td><td>1859.5</td><td>1859.5</td><td>99408</td><td>0</td><td>0</td><td>False</td></tr><tr><td>60764</td><td>ADYEN.AS</td><td>2021-01-05 00:00:00Z</td><td>1848.5</td><td>1857</td><td>1814</td><td>1829</td><td>1829</td><td>86256</td><td>0</td><td>0</td><td>False</td></tr><tr><td>60765</td><td>ADYEN.AS</td><td>2021-01-06 00:00:00Z</td><td>1822</td><td>1824</td><td>1706.5</td><td>1733</td><td>1733</td><td>156844</td><td>0</td><td>0</td><td>False</td></tr><tr><td>60766</td><td>ADYEN.AS</td><td>2021-01-07 00:00:00Z</td><td>1735</td><td>1754</td><td>1708.5</td><td>1714.5</td><td>1714.5</td><td>90183</td><td>0</td><td>0</td><td>False</td></tr><tr><td>60767</td><td>ADYEN.AS</td><td>2021-01-08 00:00:00Z</td><td>1730</td><td>1764.5</td><td>1715</td><td>1756.5</td><td>1756.5</td><td>97176</td><td>0</td><td>0</td><td>False</td></tr></tbody></table>

#### Polars.NET | Compound filters with AND, OR, NOT

Combine conditions with `&` (AND), `|` (OR), and `!=` (NOT). Wrap each condition in parentheses due to C# operator precedence.

_Demonstrates three compound filter patterns: `ASML.AS AND close > 600` (840 rows), `ASML.AS OR SAP.DE` (2,655 rows), and `NOT ASML.AS` (65,024 rows) — with parentheses required around each sub-expression due to C# operator precedence._

```csharp
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

```text
ASML AND close > 600: 840 rows
```

<!-- Polars DataFrame: (3 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>136</td><td>ASML.AS</td><td>2021-07-14</td><td>599.5</td><td>611.8</td><td>597.2</td><td>609.1</td><td>582.9708</td><td>641585</td><td>0</td><td>0</td><td>false</td></tr><tr><td>142</td><td>ASML.AS</td><td>2021-07-22</td><td>610</td><td>625.9</td><td>608.2</td><td>620.8</td><td>594.169</td><td>788099</td><td>0</td><td>0</td><td>false</td></tr><tr><td>143</td><td>ASML.AS</td><td>2021-07-23</td><td>622.9</td><td>639</td><td>617.5</td><td>638.8</td><td>611.3967</td><td>833737</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

```text
ASML OR SAP: 2655 rows
NOT ASML: 65024 rows
```

#### Microsoft.Data.Analysis | Compound filters with And, Or, and explicit negation

Compound filters are composed from boolean columns with `.And()` and `.Or()`. In practice, the mask construction is explicit, which keeps the logic readable but gets verbose faster than a Polars predicate chain.

_Builds boolean masks for `ASML.AS`, `SAP.DE`, and `close > 600`, then evaluates `ASML AND close > 600`, `ASML OR SAP`, and a non-ASML filter to show the three common boolean compositions._

```csharp
var symbolColStr = df.Columns["symbol"];
var isAsml = symbolColStr.ElementwiseEquals("ASML.AS");
var isSap = symbolColStr.ElementwiseEquals("SAP.DE");

var closeOver600 = closeCol.ElementwiseGreaterThan(600.0f);

var filtered = df.Filter((MDA.PrimitiveDataFrameColumn<bool>)isAsml.And(closeOver600));
display($"ASML AND close > 600: {filtered.Rows.Count} rows");
display(filtered.Head(3));

var orFilter = df.Filter((MDA.PrimitiveDataFrameColumn<bool>)isAsml.Or(isSap));
display($"ASML OR SAP: {orFilter.Rows.Count} rows");

var notFilter = df.Filter((MDA.PrimitiveDataFrameColumn<bool>)isAsml.ElementwiseNotEquals(true));
display($"NOT ASML: {notFilter.Rows.Count} rows");
```

```text
ASML AND close > 600: 840 rows
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>136</td><td>ASML.AS</td><td>2021-07-14 00:00:00Z</td><td>599.5</td><td>611.8</td><td>597.2</td><td>609.1</td><td>582.9708</td><td>641585</td><td>0</td><td>0</td><td>False</td></tr><tr><td>142</td><td>ASML.AS</td><td>2021-07-22 00:00:00Z</td><td>610</td><td>625.9</td><td>608.2</td><td>620.8</td><td>594.169</td><td>788099</td><td>0</td><td>0</td><td>False</td></tr><tr><td>143</td><td>ASML.AS</td><td>2021-07-23 00:00:00Z</td><td>622.9</td><td>639</td><td>617.5</td><td>638.8</td><td>611.3967</td><td>833737</td><td>0</td><td>0</td><td>False</td></tr></tbody></table>

```text
ASML OR SAP: 2655 rows
```

```text
NOT ASML: 65024 rows
```

### Membership and Range Filters

#### Polars.NET | Filter by membership with IsIn

`.IsIn()` filters rows where the column value is in a given Series. Build the lookup list as a Polars Series.

_Builds a Polars Series named `tickers` containing `["ASML.AS", "SAP.DE", "SIE.DE"]` and passes it to `.IsIn(Lit(...))`, filtering `dfP` to 3,979 rows covering all three tech stocks from 2021 to 2026._

```csharp
var techTickers = Polars.CSharp.Series.From("tickers",
    new[] { "ASML.AS", "SAP.DE", "SIE.DE" });
var techRows = dfP.Filter(Col("symbol").IsIn(Lit(techTickers)));
display($"Tech tickers: {techRows.Height} rows");
techRows.Head(5)
```

```text
Tech tickers: 3979 rows
```

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>1</td><td>ASML.AS</td><td>2021-01-04</td><td>404</td><td>411</td><td>402.25</td><td>406.25</td><td>387.709</td><td>789502</td><td>0</td><td>0</td><td>false</td></tr><tr><td>2</td><td>ASML.AS</td><td>2021-01-05</td><td>406.55</td><td>412.05</td><td>401.15</td><td>406.9</td><td>388.3294</td><td>798787</td><td>0</td><td>0</td><td>false</td></tr><tr><td>3</td><td>ASML.AS</td><td>2021-01-06</td><td>406.8</td><td>407.2</td><td>399.2</td><td>402.85</td><td>384.4644</td><td>875711</td><td>0</td><td>0</td><td>false</td></tr><tr><td>4</td><td>ASML.AS</td><td>2021-01-07</td><td>404.8</td><td>407.8</td><td>400.35</td><td>403.9</td><td>385.4664</td><td>874780</td><td>0</td><td>0</td><td>false</td></tr><tr><td>5</td><td>ASML.AS</td><td>2021-01-08</td><td>414.25</td><td>419.1</td><td>413.4</td><td>416.05</td><td>397.0618</td><td>975243</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Filter by membership with a manual boolean mask

Membership filtering is usually implemented by testing each value against a `HashSet<T>` and writing the result into a boolean mask column.

_Builds a ticker set for `ASML.AS`, `SAP.DE`, and `SIE.DE`, evaluates membership row by row into a boolean mask, filters the dataframe, and previews the first five matching rows._

```csharp
var techTickers = new HashSet<string> { "ASML.AS", "SAP.DE", "SIE.DE" };
var isInMask = new MDA.PrimitiveDataFrameColumn<bool>("mask", df.Rows.Count);

var symbols = (MDA.StringDataFrameColumn)df.Columns["symbol"];

for(long i = 0; i < df.Rows.Count; i++)
{
    isInMask[i] = techTickers.Contains(symbols[i]);
}

var techRows = df.Filter(isInMask);
display($"Tech tickers: {techRows.Rows.Count} rows");
techRows.Head(5)
```

```text
Tech tickers: 3979 rows
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>1</td><td>ASML.AS</td><td>2021-01-04 00:00:00Z</td><td>404</td><td>411</td><td>402.25</td><td>406.25</td><td>387.709</td><td>789502</td><td>0</td><td>0</td><td>False</td></tr><tr><td>2</td><td>ASML.AS</td><td>2021-01-05 00:00:00Z</td><td>406.55</td><td>412.05</td><td>401.15</td><td>406.9</td><td>388.3294</td><td>798787</td><td>0</td><td>0</td><td>False</td></tr><tr><td>3</td><td>ASML.AS</td><td>2021-01-06 00:00:00Z</td><td>406.8</td><td>407.2</td><td>399.2</td><td>402.85</td><td>384.4644</td><td>875711</td><td>0</td><td>0</td><td>False</td></tr><tr><td>4</td><td>ASML.AS</td><td>2021-01-07 00:00:00Z</td><td>404.8</td><td>407.8</td><td>400.35</td><td>403.9</td><td>385.4664</td><td>874780</td><td>0</td><td>0</td><td>False</td></tr><tr><td>5</td><td>ASML.AS</td><td>2021-01-08 00:00:00Z</td><td>414.25</td><td>419.1</td><td>413.4</td><td>416.05</td><td>397.0618</td><td>975243</td><td>0</td><td>0</td><td>False</td></tr></tbody></table>

#### Polars.NET | Range filter with IsBetween

`.IsBetween(lo, hi)` filters rows where the column value falls within the inclusive range.

_Applies `.IsBetween(100.0, 200.0)` to the `close` column, returning 12,013 rows — the mid-range price band covering stocks like Adidas, SAP, and Volkswagen in their lower-price periods._

```csharp
var midRange = dfP.Filter(Col("close").IsBetween(Lit(100.0), Lit(200.0)));
display($"Close between 100 and 200: {midRange.Height} rows");
midRange.Head(5)
```

Close between 100 and 200: 12013 rows

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>62387</td><td>ADS.DE</td><td>2022-03-04</td><td>196.5</td><td>197.64</td><td>187</td><td>187</td><td>180.5918</td><td>1319891</td><td>0</td><td>0</td><td>false</td></tr><tr><td>62388</td><td>ADS.DE</td><td>2022-03-07</td><td>177.1</td><td>183.4</td><td>170.08</td><td>176.9</td><td>170.8379</td><td>2345656</td><td>0</td><td>0</td><td>false</td></tr><tr><td>62389</td><td>ADS.DE</td><td>2022-03-08</td><td>172.18</td><td>187.06</td><td>172</td><td>184.94</td><td>178.6024</td><td>1937346</td><td>0</td><td>0</td><td>false</td></tr><tr><td>62391</td><td>ADS.DE</td><td>2022-03-10</td><td>211.35</td><td>211.8</td><td>196.68</td><td>197.08</td><td>190.3264</td><td>1375129</td><td>0</td><td>0</td><td>false</td></tr><tr><td>62415</td><td>ADS.DE</td><td>2022-04-13</td><td>198.52</td><td>199.74</td><td>194.16</td><td>197.76</td><td>190.9831</td><td>755573</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Range filter with composed boolean masks

Range filters are just boolean mask composition: generate the lower-bound and upper-bound comparisons, combine them with `.And()`, and pass the result into `Filter()`.

_Builds a mask for `100 <= close <= 200`, filters the dataframe, prints the matching row count, and previews the first five results._

```csharp
var midRangeMask = (MDA.PrimitiveDataFrameColumn<bool>)closeCol
    .ElementwiseGreaterThanOrEqual(100.0f)
    .And(closeCol.ElementwiseLessThanOrEqual(200.0f));

var midRange = df.Filter(midRangeMask);

display($"Close between 100 and 200: {midRange.Rows.Count} rows");
midRange.Head(5)
```

```text
Close between 100 and 200: 12013 rows
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>62387</td><td>ADS.DE</td><td>2022-03-04 00:00:00Z</td><td>196.5</td><td>197.64</td><td>187</td><td>187</td><td>180.5918</td><td>1319891</td><td>0</td><td>0</td><td>False</td></tr><tr><td>62388</td><td>ADS.DE</td><td>2022-03-07 00:00:00Z</td><td>177.1</td><td>183.4</td><td>170.08</td><td>176.9</td><td>170.8379</td><td>2345656</td><td>0</td><td>0</td><td>False</td></tr><tr><td>62389</td><td>ADS.DE</td><td>2022-03-08 00:00:00Z</td><td>172.18</td><td>187.06</td><td>172</td><td>184.94</td><td>178.6024</td><td>1937346</td><td>0</td><td>0</td><td>False</td></tr><tr><td>62391</td><td>ADS.DE</td><td>2022-03-10 00:00:00Z</td><td>211.35</td><td>211.8</td><td>196.68</td><td>197.08</td><td>190.3264</td><td>1375129</td><td>0</td><td>0</td><td>False</td></tr><tr><td>62415</td><td>ADS.DE</td><td>2022-04-13 00:00:00Z</td><td>198.52</td><td>199.74</td><td>194.16</td><td>197.76</td><td>190.9831</td><td>755573</td><td>0</td><td>0</td><td>False</td></tr></tbody></table>

### Null and String Predicates

#### Polars.NET | Null checks with IsNull and IsNotNull

`.IsNull()` and `.IsNotNull()` filter rows based on null presence.

_Filters `dfP` for null and non-null `volume` values, printing 0 and 66,355 respectively — confirming the OHLCV dataset has no missing volume entries and that `.IsNull()` / `.IsNotNull()` produce complementary subsets._

```csharp
var withNulls = dfP.Filter(Col("volume").IsNull());
display($"Rows with null volume: {withNulls.Height}");

var noNulls = dfP.Filter(Col("volume").IsNotNull());
display($"Rows with non-null volume: {noNulls.Height}");
```

Rows with null volume: 0

Rows with non-null volume: 66355

#### Microsoft.Data.Analysis | Null checks with ElementwiseIsNull and ElementwiseIsNotNull

MDA exposes null predicates as elementwise boolean columns. The main pattern is straightforward: generate the mask, call `Filter()`, and count or inspect the result.

_Filters once for rows with null `volume` and once for rows with non-null `volume`, then prints the row counts for each result set._

```csharp
var withNulls = df.Filter(df.Columns["volume"].ElementwiseIsNull());
display($"Rows with null volume: {withNulls.Rows.Count}");

var noNulls = df.Filter(df.Columns["volume"].ElementwiseIsNotNull());
display($"Rows with non-null volume: {noNulls.Rows.Count}");
```

```text
Rows with null volume: 0
```

```text
Rows with non-null volume: 66355
```

#### Polars.NET | String predicates with Str accessor

Polars provides `.Str.EndsWith()`, `.Str.Contains()`, `.Str.StartsWith()` for string-column filtering. These operate on the entire column vectorially.

_Applies `.Str.EndsWith(".PA")` to select 21,296 Paris-listed rows (16 tickers), then `.Str.Contains("BN")` to isolate 2,662 rows from BN.PA and BNP.PA — both predicates operate vectorially across the full 66,355-row column._

```csharp
var parisStocks = dfP.Filter(Col("symbol").Str.EndsWith(".PA"));
display($"Paris-listed (.PA): {parisStocks.Height} rows");
display(parisStocks.Select("symbol").Unique());

var containsB = dfP.Filter(Col("symbol").Str.Contains("BN"));
display($"Symbol contains BN: {containsB.Height} rows");
containsB.Select("symbol").Unique()
```

Paris-listed (.PA): 21296 rows

<!-- Polars DataFrame: (16 rows, 1 columns) --><table><thead><tr><th>symbol</th></tr></thead><tbody><tr><td>AI.PA</td></tr><tr><td>AIR.PA</td></tr><tr><td>BN.PA</td></tr><tr><td>BNP.PA</td></tr><tr><td>CS.PA</td></tr></tbody></table></div>

Symbol contains BN: 2662 rows

<!-- Polars DataFrame: (2 rows, 1 columns) --><table><thead><tr><th>symbol</th></tr></thead><tbody><tr><td>BN.PA</td></tr><tr><td>BNP.PA</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | String predicates through explicit mask evaluation

String filtering often becomes manual mask construction over a `MDA.StringDataFrameColumn`, especially when you need `EndsWith` or `Contains` semantics without a dedicated string-expression namespace.

_Builds one mask for Paris-listed symbols ending in `.PA` and another for symbols containing `BN`, filters the dataframe with each mask, prints the row counts, and materializes the distinct matching symbols._

```csharp
var isPaMask = new MDA.PrimitiveDataFrameColumn<bool>("mask", df.Rows.Count);
var hasBnMask = new MDA.PrimitiveDataFrameColumn<bool>("mask", df.Rows.Count);

for(long i = 0; i < df.Rows.Count; i++)
{
    var val = symbols[i];
    isPaMask[i] = val != null && val.EndsWith(".PA");
    hasBnMask[i] = val != null && val.Contains("BN");
}

var parisStocks = df.Filter(isPaMask);
display($"Paris-listed (.PA): {parisStocks.Rows.Count} rows");
display(new MDA.DataFrame(new MDA.StringDataFrameColumn("symbol", parisStocks.Columns["symbol"].Cast<string>().Distinct())));

var containsB = df.Filter(hasBnMask);
display($"Symbol contains BN: {containsB.Rows.Count} rows");
new MDA.DataFrame(new MDA.StringDataFrameColumn("symbol", containsB.Columns["symbol"].Cast<string>().Distinct()))
```

```text
Paris-listed (.PA): 21296 rows
```

<table><thead><tr><th>symbol</th></tr></thead><tbody><tr><td>AI.PA</td></tr><tr><td>AIR.PA</td></tr><tr><td>BN.PA</td></tr><tr><td>BNP.PA</td></tr><tr><td>CS.PA</td></tr></tbody></table>

```text
Symbol contains BN: 2662 rows
```

<table><thead><tr><th>symbol</th></tr></thead><tbody><tr><td>BN.PA</td></tr><tr><td>BNP.PA</td></tr></tbody></table>

### Date Predicates

#### Polars.NET | Date predicates with Dt accessor

The `.Dt` accessor provides `.Year()`, `.Month()`, `.Day()` for extracting date components. Combine with comparison operators for date range filtering.

_Uses `.Dt.Year() == Lit(2023)` to return 12,741 rows for 2023, then combines `>=` and `<=` with `DateOnly` literals to select 3,150 rows in Q1 2024 — demonstrating both component extraction and direct date comparison._

```csharp
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

#### Microsoft.Data.Analysis | Date predicates with an explicit DateTime mask

The date column is evaluated row by row, coercing each value to `DateTime` where possible and writing the final result into reusable boolean masks. This is clear and robust, but more procedural than Polars' date-expression API.

_Builds one mask for rows in calendar year 2023 and another for Q1 2024, prints the resulting row counts, and previews the first five rows from the Q1 2024 subset._

```csharp
var dates = df.Columns["date"];
var yearMask = new MDA.PrimitiveDataFrameColumn<bool>("yearMask", df.Rows.Count);
var q1Mask = new MDA.PrimitiveDataFrameColumn<bool>("q1Mask", df.Rows.Count);

for(long i = 0; i < df.Rows.Count; i++)
{
    DateTime d;
    if(dates[i] is DateTime dt) d = dt;
    else if (dates[i] is string s && DateTime.TryParse(s, out var p)) d = p;
    else continue;

    yearMask[i] = d.Year == 2023;
    q1Mask[i] = d >= new DateTime(2024, 1, 1) && d <= new DateTime(2024, 3, 31);
}

var year2023 = df.Filter(yearMask);
display($"Year 2023: {year2023.Rows.Count} rows");

var dateRange = df.Filter(q1Mask);
display($"Q1 2024: {dateRange.Rows.Count} rows");
dateRange.Head(5)
```

```text
Year 2023: 12741 rows
```

```text
Q1 2024: 3150 rows
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21930</td><td>ABI.BR</td><td>2024-01-02 00:00:00Z</td><td>58.72</td><td>58.95</td><td>58.17</td><td>58.77</td><td>56.7582</td><td>1049145</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21931</td><td>ABI.BR</td><td>2024-01-03 00:00:00Z</td><td>58.64</td><td>59.34</td><td>58.24</td><td>58.37</td><td>56.3719</td><td>1247000</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21932</td><td>ABI.BR</td><td>2024-01-04 00:00:00Z</td><td>58.36</td><td>58.92</td><td>58.3</td><td>58.81</td><td>56.7968</td><td>1009526</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21933</td><td>ABI.BR</td><td>2024-01-05 00:00:00Z</td><td>58.26</td><td>58.91</td><td>58.16</td><td>58.86</td><td>56.8451</td><td>1236000</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21934</td><td>ABI.BR</td><td>2024-01-08 00:00:00Z</td><td>58.47</td><td>59.5</td><td>58.39</td><td>59.38</td><td>57.3473</td><td>1033238</td><td>0</td><td>0</td><td>False</td></tr></tbody></table>

## Row Access & Slicing

Access individual rows by position or extract narrow row ranges for debugging. In both libraries, row-wise access should usually stay an inspection tool rather than become the backbone of a production transformation.

### Single Row Access

#### Polars.NET | Access a single row by position

`.Slice(0, 1)` returns a one-row DataFrame. Extract individual cell values with `.Column("col").GetValue<T>(index)`.

```csharp
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

#### Microsoft.Data.Analysis | Access a single row by position

For quick inspection, `Head(1)` returns a one-row frame while column indexers retrieve specific scalar values from the same row position.

_Displays the first row with `Head(1)`, then reads `symbol` and `close` from row position `0` via the column indexers to show row-level inspection without materializing a dedicated row object._

```csharp
display("Row 0:");
display(df.Head(1));

display($"Row 0, symbol: {df.Columns["symbol"][0]}");
display($"Row 0, close:  {df.Columns["close"][0]}");
```

```text
Row 0:
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04 00:00:00Z</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>False</td></tr></tbody></table>

```text
Row 0, symbol: ABI.BR
```

```text
Row 0, close:  57.21
```

### Row Slicing

#### Polars.NET | Select a range of rows with Slice

`.Slice(offset, length)` returns a contiguous range of rows by position.

```csharp
display("Rows 100..104:");
dfP.Slice(100, 5)
```

Rows 100..104:

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21260</td><td>ABI.BR</td><td>2021-05-26</td><td>61.99</td><td>62.39</td><td>61.83</td><td>62.12</td><td>58.6701</td><td>940186</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21261</td><td>ABI.BR</td><td>2021-05-27</td><td>61.8</td><td>62.64</td><td>61.73</td><td>62.13</td><td>58.6795</td><td>1796477</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21262</td><td>ABI.BR</td><td>2021-05-28</td><td>62.14</td><td>62.58</td><td>61.96</td><td>62.34</td><td>58.8779</td><td>1004125</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21263</td><td>ABI.BR</td><td>2021-05-31</td><td>62.27</td><td>62.31</td><td>61.51</td><td>61.56</td><td>58.1412</td><td>851557</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21264</td><td>ABI.BR</td><td>2021-06-01</td><td>62.35</td><td>62.48</td><td>61.98</td><td>62.38</td><td>58.9157</td><td>1171646</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Slice a row range with a positional mask

The slice pattern shown here creates a positional boolean mask, marks the desired row interval, and filters on that mask.

_Builds a mask for row positions `100..104`, filters the dataframe on that mask, and displays the resulting five-row slice._

```csharp
display("Rows 100..104:");
var sliceMask = new MDA.PrimitiveDataFrameColumn<bool>("mask", df.Rows.Count);
for(long i = 100; i < 105 && i < df.Rows.Count; i++)
{
    sliceMask[i] = true;
}
df.Filter(sliceMask)
```

```text
Rows 100..104:
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21260</td><td>ABI.BR</td><td>2021-05-26 00:00:00Z</td><td>61.99</td><td>62.39</td><td>61.83</td><td>62.12</td><td>58.6701</td><td>940186</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21261</td><td>ABI.BR</td><td>2021-05-27 00:00:00Z</td><td>61.8</td><td>62.64</td><td>61.73</td><td>62.13</td><td>58.6795</td><td>1796477</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21262</td><td>ABI.BR</td><td>2021-05-28 00:00:00Z</td><td>62.14</td><td>62.58</td><td>61.96</td><td>62.34</td><td>58.8779</td><td>1004125</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21263</td><td>ABI.BR</td><td>2021-05-31 00:00:00Z</td><td>62.27</td><td>62.31</td><td>61.51</td><td>61.56</td><td>58.1412</td><td>851557</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21264</td><td>ABI.BR</td><td>2021-06-01 00:00:00Z</td><td>62.35</td><td>62.48</td><td>61.98</td><td>62.38</td><td>58.9157</td><td>1171646</td><td>0</td><td>0</td><td>False</td></tr></tbody></table>

### Sorting

#### Polars.NET | Sort rows

`.Sort("col", descending: true)` sorts by a single column. For multi-column sort, chain `.Sort()` calls — the last sort is the primary key.

```csharp
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

#### Microsoft.Data.Analysis | Sort rows with OrderBy and OrderByDescending

MDA provides dataframe-level `OrderBy(...)` and `OrderByDescending(...)` for single-column sorting. Chained sorts work, but they are still eager materializations rather than lazy plan transformations.

_Sorts the dataframe by `close` descending to show the top five closing prices, then chains a second sort to inspect symbol-first ordering with descending close values inside the sorted result._

```csharp
display("Top 5 by close (descending):");
display(df.OrderByDescending("close").Head(5));

display("Sort by symbol ASC, then close DESC:");
df.OrderByDescending("close").OrderBy("symbol").Head(5)
```

```text
Top 5 by close (descending):
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>3708</td><td>RMS.PA</td><td>2025-02-14 00:00:00Z</td><td>2926</td><td>2957</td><td>2813</td><td>2839</td><td>2802.9382</td><td>105651</td><td>0</td><td>0</td><td>False</td></tr><tr><td>3707</td><td>RMS.PA</td><td>2025-02-13 00:00:00Z</td><td>2770</td><td>2816</td><td>2765</td><td>2816</td><td>2780.2302</td><td>80087</td><td>0</td><td>0</td><td>False</td></tr><tr><td>3709</td><td>RMS.PA</td><td>2025-02-17 00:00:00Z</td><td>2825</td><td>2858</td><td>2803</td><td>2809</td><td>2776.7424</td><td>53852</td><td>3.5</td><td>0</td><td>False</td></tr><tr><td>3710</td><td>RMS.PA</td><td>2025-02-18 00:00:00Z</td><td>2816</td><td>2827</td><td>2780</td><td>2806</td><td>2773.777</td><td>65469</td><td>0</td><td>0</td><td>False</td></tr><tr><td>60927</td><td>ADYEN.AS</td><td>2021-08-24 00:00:00Z</td><td>2725</td><td>2766</td><td>2711.5</td><td>2766</td><td>2766</td><td>61431</td><td>0</td><td>0</td><td>False</td></tr></tbody></table>

```text
Sort by symbol ASC, then close DESC:
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21512</td><td>ABI.BR</td><td>2022-05-17 00:00:00Z</td><td>54.65</td><td>55.18</td><td>53.96</td><td>54.44</td><td>51.9</td><td>1092579</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21814</td><td>ABI.BR</td><td>2023-07-19 00:00:00Z</td><td>51.59</td><td>52.15</td><td>51.34</td><td>52</td><td>50.2199</td><td>1228208</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21408</td><td>ABI.BR</td><td>2021-12-20 00:00:00Z</td><td>51.69</td><td>52.32</td><td>50.71</td><td>52</td><td>49.1121</td><td>2123317</td><td>0</td><td>0</td><td>False</td></tr><tr><td>22457</td><td>ABI.BR</td><td>2026-01-26 00:00:00Z</td><td>59</td><td>59.44</td><td>58.94</td><td>59</td><td>59</td><td>836059</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21240</td><td>ABI.BR</td><td>2021-04-28 00:00:00Z</td><td>58.09</td><td>59.6</td><td>58.02</td><td>59</td><td>55.2524</td><td>1250347</td><td>0</td><td>0</td><td>False</td></tr></tbody></table>

### Deduplication

#### Polars.NET | Deduplicate rows with Unique

`.Unique(subset: columns)` keeps one row per distinct combination of the specified columns.

```csharp
var uniqueSymbols = dfP.Unique(subset: new[] { "symbol" });
display($"Unique symbols: {uniqueSymbols.Height} (from {dfP.Height} total rows)");
uniqueSymbols.Select("symbol").Head(10)
```

Unique symbols: 50 (from 66355 total rows)

<!-- Polars DataFrame: (10 rows, 1 columns) --><table><thead><tr><th>symbol</th></tr></thead><tbody><tr><td>ABI.BR</td></tr><tr><td>AD.AS</td></tr><tr><td>ADS.DE</td></tr><tr><td>ADYEN.AS</td></tr><tr><td>AI.PA</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Distinct counts from ValueCounts

For entity-style dedup checks, the quickest MDA path is usually `ValueCounts()` or LINQ `Distinct()` on the key column. That gives you the unique-cardinality view you need even when you do not build a full dataframe-level dedup helper.

_Computes `ValueCounts()` for `symbol`, prints the number of unique tickers relative to the total row count, and previews the first ten unique symbols with their counts._

```csharp
var symbolCounts = df.Columns["symbol"].ValueCounts();

display($"Unique symbols: {symbolCounts.Rows.Count} (from {df.Rows.Count} total rows)");

symbolCounts.Head(10)
```

```text
Unique symbols: 50 (from 66355 total rows)
```

<table><thead><tr><th>Values</th><th>Counts</th></tr></thead><tbody><tr><td>ABI.BR</td><td>1331</td></tr><tr><td>AD.AS</td><td>1331</td></tr><tr><td>ADS.DE</td><td>1324</td></tr><tr><td>ADYEN.AS</td><td>1331</td></tr><tr><td>AI.PA</td><td>1331</td></tr></tbody></table>

## Summary

This chapter is mostly about mechanics, but the mechanics point to a larger design choice: do you want a query-oriented analytical engine or a managed dataframe API that stays close to the rest of the .NET stack?

### API Comparison

| Operation | Polars.NET | Microsoft.Data.Analysis |
|---|---|---|
| **Head / Tail** | `df.Head(n)`, `df.Tail(n)` | `df.Head(n)`, `df.Tail(n)` |
| **Sample** | `df.Sample(n)` | `df.Sample(n)` or explicit `Filter(mask)` helper |
| **Shape** | `df.Height`, `df.Width`, `df.Shape` | `df.Rows.Count`, `df.Columns.Count` |
| **Schema / info** | `df.PrintSchema()` | `df.Info()` |
| **Describe** | `df.Describe()` | `df.Description()` |
| **Null count** | `df.Column(col).NullCount` | `df.Columns[col].NullCount` |
| **Value counts** | `series.ValueCounts()` | `column.ValueCounts()` |
| **Unique values** | `series.Unique()`, `series.NUnique()` | `column.Cast<T>().Distinct()` or `ValueCounts()` |
| **Estimated size** | `df.EstimatedSize()` | Manual CLR-width heuristic |
| **Select single col** | `df.Column("col")` or `df["col"]` | `df.Columns["col"]` |
| **Select multiple cols** | `df.Select("a", "b")` | `new MDA.DataFrame(df.Columns["a"], df.Columns["b"])` |
| **Computed projection** | Expression-based `Select(...)` | Clone columns, compute derived columns, materialize new frame |
| **Drop columns** | `df.Drop("a", "b")` | Build a keep-set and construct a new frame |
| **Regex col select** | Expression or selector-based | `df.Columns.Where(Regex)` + `new MDA.DataFrame(...)` |
| **Rename** | `df.Rename(dict)` | `SetName()` on cloned columns |
| **Reorder** | `df.Select("b", "a")` | Constructor order of selected columns |
| **Boolean filter** | Expression-based `df.Filter(...)` | `DataFrame.Filter(MDA.PrimitiveDataFrameColumn<bool>)` |
| **Membership** | `Col("x").IsIn(...)` | Build a `HashSet<T>` mask and call `Filter()` |
| **Range filter** | `Col("x").IsBetween(lo, hi)` | Compose lower/upper masks with `.And()` |
| **Null filter** | `Col("x").IsNull()` / `.IsNotNull()` | `ElementwiseIsNull()` / `ElementwiseIsNotNull()` |
| **String predicates** | `Col("x").Str...` | Explicit string mask evaluation |
| **Date predicates** | `Col("x").Dt...` | Explicit `DateTime` mask evaluation |
| **Single row** | `df.Slice(i, 1)` | `df.Head(1)` plus column indexers |
| **Slice** | `df.Slice(offset, length)` | Positional boolean mask + `Filter()` |
| **Sort** | `df.Sort("col", descending: true)` | `df.OrderBy(...)`, `df.OrderByDescending(...)` |
| **Distinct / dedup** | `df.Unique(subset: ["col"])` | `ValueCounts()` or LINQ `Distinct()` on the key column |

### Engineering Recommendations

As *Fundamentals of Data Engineering.epub* argues, architecture decisions should stay reversible. Applied here, that means not overcommitting to a notebook-local style of filtering if the same logic will later need to move into a database, lakehouse scan, or orchestrated batch pipeline.

| Scenario | Prefer | Why |
|---|---|---|
| Notebook exploration on data already loaded into memory | Either | Both libraries cover head/tail, schema checks, null profiling, and value counts effectively. |
| Selection and filtering logic that should later become part of an optimized analytical pipeline | Polars.NET | The expression model aligns with Polars lazy pushdown for predicates, projections, and slices. |
| Managed .NET preprocessing immediately upstream of ML.NET | Microsoft.Data.Analysis | `DataFrame` implements `IDataView`, which keeps the handoff into ML.NET natural. |
| Production ETL dominated by string/date predicates and repeated custom masks | Polars.NET or SQL upstream | MDA works, but the mask-heavy style becomes verbose and easier to hard-code incorrectly. |
| Simple feature prep in a .NET notebook or service that already uses CLR-native types | Microsoft.Data.Analysis | The API stays close to ordinary .NET collections, columns, and `DateTime` values. |

If the filter can be expressed in SQL or pushed to a scan boundary, do that before either dataframe library materializes the full dataset. Local dataframe filtering is most valuable when the data is already in memory, the logic is exploratory, or the transformation genuinely belongs in application code rather than the source system.
