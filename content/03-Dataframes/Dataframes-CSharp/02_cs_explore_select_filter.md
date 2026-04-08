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
using System.Globalization;
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

static Type[] OhlcvCsvTypes() => new[]
{
    typeof(long), typeof(string), typeof(DateTime), typeof(decimal), typeof(decimal),
    typeof(decimal), typeof(decimal), typeof(decimal), typeof(long), typeof(decimal), typeof(decimal), typeof(bool)
};

static decimal? ToNullableDecimal(object value)
{
    if (value is null) return null;
    if (value is decimal d) return d;
    if (value is string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        return decimal.Parse(s, NumberStyles.Float, CultureInfo.InvariantCulture);
    }
    return Convert.ToDecimal(value, CultureInfo.InvariantCulture);
}

static MDA.DataFrame ConvertColumnsToDecimal(MDA.DataFrame df, params string[] columnNames)
{
    foreach (var columnName in columnNames)
    {
        var index = df.Columns.IndexOf(columnName);
        if (index < 0) continue;
        var source = df.Columns[index];
        var target = new MDA.PrimitiveDataFrameColumn<decimal>(columnName, df.Rows.Count);
        for (long row = 0; row < df.Rows.Count; row++)
        {
            var value = ToNullableDecimal(source[row]);
            if (value.HasValue) target[row] = value.Value;
        }
        df.Columns.Remove(columnName);
        df.Columns.Insert(index, target);
    }
    return df;
}

static MDA.DataFrame LoadOhlcvCsv(string dataDir) =>
    MDA.DataFrame.LoadCsv(Path.Combine(dataDir, "eurostoxx50_ohlcv.csv"), dataTypes: OhlcvCsvTypes());

static MDA.DataFrame LoadScoresDailyCsv(string dataDir)
{
    var df = MDA.DataFrame.LoadCsv(Path.Combine(dataDir, "scores_daily.csv"));
    return ConvertColumnsToDecimal(
        df,
        "pe_zscore", "pb_zscore", "ev_ebitda_zscore", "yield_zscore", "relative_value_score",
        "relative_strength", "sma_50_ratio", "sma_200_ratio", "dist_from_52w_high", "momentum_score",
        "implied_upside", "recommendation_mean", "sentiment_score", "composite_score", "sma_30_close",
        "sma_90_close", "market_cap", "index_weight", "current_price", "day_change_pct",
        "five_day_change_pct", "ytd_change_pct"
    );
}
```

```text
Data directory: c:\Users\aperi\DEV\LANG\data
```

Load the primary datasets used throughout this notebook. Both libraries read the same CSV files, so the rest of the page compares API shape and workflow rather than data differences.

```csharp
var dfP = Polars.CSharp.DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"), tryParseDates: true);
var dimP = Polars.CSharp.DataFrame.ReadCsv(Path.Combine(DATA, "dim_country.csv"));

display($"OHLCV: {dfP.Shape}  |  DimCountry: {dimP.Shape}");

var df = LoadOhlcvCsv(DATA);
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
// Microsoft.Data.Analysis — Head / Tail
display("Head(5):");
display(df.Head(5));
display("Tail(5):");
df.Tail(5)
```

```text
Head(5):
```

<table id="table_639112126212496044"><thead><tr><th><i>index</i></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td><div class="dni-plaintext"><pre>21160</pre></div></td><td>ABI.BR</td><td><span>2021-01-04 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>58.15</pre></div></td><td><div class="dni-plaintext"><pre>58.85</pre></div></td><td><div class="dni-plaintext"><pre>56.78</pre></div></td><td><div class="dni-plaintext"><pre>57.21</pre></div></td><td><div class="dni-plaintext"><pre>53.5761</pre></div></td><td><div class="dni-plaintext"><pre>1513937</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td><div class="dni-plaintext"><pre>21161</pre></div></td><td>ABI.BR</td><td><span>2021-01-05 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>56.9</pre></div></td><td><div class="dni-plaintext"><pre>57.98</pre></div></td><td><div class="dni-plaintext"><pre>56.75</pre></div></td><td><div class="dni-plaintext"><pre>57.18</pre></div></td><td><div class="dni-plaintext"><pre>53.548</pre></div></td><td><div class="dni-plaintext"><pre>1382722</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td><div class="dni-plaintext"><pre>21162</pre></div></td><td>ABI.BR</td><td><span>2021-01-06 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>57.96</pre></div></td><td><div class="dni-plaintext"><pre>58.94</pre></div></td><td><div class="dni-plaintext"><pre>57.39</pre></div></td><td><div class="dni-plaintext"><pre>58.77</pre></div></td><td><div class="dni-plaintext"><pre>55.037</pre></div></td><td><div class="dni-plaintext"><pre>1370204</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td><div class="dni-plaintext"><pre>21163</pre></div></td><td>ABI.BR</td><td><span>2021-01-07 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>58.68</pre></div></td><td><div class="dni-plaintext"><pre>58.86</pre></div></td><td><div class="dni-plaintext"><pre>57.88</pre></div></td><td><div class="dni-plaintext"><pre>58.4</pre></div></td><td><div class="dni-plaintext"><pre>54.6905</pre></div></td><td><div class="dni-plaintext"><pre>1469911</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td><div class="dni-plaintext"><pre>21164</pre></div></td><td>ABI.BR</td><td><span>2021-01-08 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>58.16</pre></div></td><td><div class="dni-plaintext"><pre>58.4</pre></div></td><td><div class="dni-plaintext"><pre>57.43</pre></div></td><td><div class="dni-plaintext"><pre>57.86</pre></div></td><td><div class="dni-plaintext"><pre>54.1848</pre></div></td><td><div class="dni-plaintext"><pre>1428681</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr></tbody></table>

```text
Tail(5):
```

<table id="table_639112126212956886"><thead><tr><th><i>index</i></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td><div class="dni-plaintext"><pre>64828</pre></div></td><td>WKL.AS</td><td><span>2026-03-06 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>69.02</pre></div></td><td><div class="dni-plaintext"><pre>69.36</pre></div></td><td><div class="dni-plaintext"><pre>67.82</pre></div></td><td><div class="dni-plaintext"><pre>68.52</pre></div></td><td><div class="dni-plaintext"><pre>68.52</pre></div></td><td><div class="dni-plaintext"><pre>1143729</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td><div class="dni-plaintext"><pre>66875</pre></div></td><td>WKL.AS</td><td><span>2026-03-09 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>68.78</pre></div></td><td><div class="dni-plaintext"><pre>69.16</pre></div></td><td><div class="dni-plaintext"><pre>67.64</pre></div></td><td><div class="dni-plaintext"><pre>68.64</pre></div></td><td><div class="dni-plaintext"><pre>68.64</pre></div></td><td><div class="dni-plaintext"><pre>841503</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td><div class="dni-plaintext"><pre>66876</pre></div></td><td>WKL.AS</td><td><span>2026-03-10 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>68.8</pre></div></td><td><div class="dni-plaintext"><pre>69.16</pre></div></td><td><div class="dni-plaintext"><pre>66.34</pre></div></td><td><div class="dni-plaintext"><pre>67.16</pre></div></td><td><div class="dni-plaintext"><pre>67.16</pre></div></td><td><div class="dni-plaintext"><pre>1355645</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td><div class="dni-plaintext"><pre>66877</pre></div></td><td>WKL.AS</td><td><span>2026-03-11 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>67.5</pre></div></td><td><div class="dni-plaintext"><pre>69.6</pre></div></td><td><div class="dni-plaintext"><pre>67.02</pre></div></td><td><div class="dni-plaintext"><pre>67.22</pre></div></td><td><div class="dni-plaintext"><pre>67.22</pre></div></td><td><div class="dni-plaintext"><pre>1142531</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td><div class="dni-plaintext"><pre>66929</pre></div></td><td>WKL.AS</td><td><span>2026-03-12 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>67.0</pre></div></td><td><div class="dni-plaintext"><pre>67.54</pre></div></td><td><div class="dni-plaintext"><pre>66.28</pre></div></td><td><div class="dni-plaintext"><pre>67.32</pre></div></td><td><div class="dni-plaintext"><pre>67.32</pre></div></td><td><div class="dni-plaintext"><pre>210379</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Random sample with an explicit mask

The current API surface documents `Sample(Int32)`, but the explicit helper below is still useful because it shows the row-filtering model MDA falls back to in more complex cases: build a boolean mask and pass it into `Filter()`.

_Builds a `Sample(DataFrame data, int n)` helper that randomly selects row indices, turns them into a boolean mask, and returns `data.Filter(mask)` to produce a 5-row exploratory sample._

```csharp
// Microsoft.Data.Analysis — Sample(n) returns n random rows
// (No native method, using boolean mask generation)
DataFrame Sample(DataFrame data, int n)
{
    var rand = new Random();
    var indices = new HashSet<long>();
    while(indices.Count < n && indices.Count < data.Rows.Count)
    {
        indices.Add(rand.NextInt64(0, data.Rows.Count));
    }

    var mask = new PrimitiveDataFrameColumn<bool>("mask", data.Rows.Count);
    for(long i = 0; i < data.Rows.Count; i++) mask[i] = indices.Contains(i);

    return data.Filter(mask);
}

Sample(df, 5)
```

<table id="table_639112126214167368"><thead><tr><th><i>index</i></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td><div class="dni-plaintext"><pre>62110</pre></div></td><td>ADS.DE</td><td><span>2021-02-03 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>279.9</pre></div></td><td><div class="dni-plaintext"><pre>279.9</pre></div></td><td><div class="dni-plaintext"><pre>274.2</pre></div></td><td><div class="dni-plaintext"><pre>275.0</pre></div></td><td><div class="dni-plaintext"><pre>262.7958</pre></div></td><td><div class="dni-plaintext"><pre>405362</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td><div class="dni-plaintext"><pre>47784</pre></div></td><td>BMW.DE</td><td><span>2021-11-24 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>94.23</pre></div></td><td><div class="dni-plaintext"><pre>94.83</pre></div></td><td><div class="dni-plaintext"><pre>91.81</pre></div></td><td><div class="dni-plaintext"><pre>92.49</pre></div></td><td><div class="dni-plaintext"><pre>70.7878</pre></div></td><td><div class="dni-plaintext"><pre>1403839</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td><div class="dni-plaintext"><pre>65828</pre></div></td><td>DSY.PA</td><td><span>2024-11-21 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>32.17</pre></div></td><td><div class="dni-plaintext"><pre>32.28</pre></div></td><td><div class="dni-plaintext"><pre>31.83</pre></div></td><td><div class="dni-plaintext"><pre>32.17</pre></div></td><td><div class="dni-plaintext"><pre>31.921</pre></div></td><td><div class="dni-plaintext"><pre>845398</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td><div class="dni-plaintext"><pre>27022</pre></div></td><td>EL.PA</td><td><span>2023-03-24 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>158.5725</pre></div></td><td><div class="dni-plaintext"><pre>158.915</pre></div></td><td><div class="dni-plaintext"><pre>156.8601</pre></div></td><td><div class="dni-plaintext"><pre>158.6215</pre></div></td><td><div class="dni-plaintext"><pre>150.249</pre></div></td><td><div class="dni-plaintext"><pre>458988</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td><div class="dni-plaintext"><pre>43193</pre></div></td><td>ENI.MI</td><td><span>2024-06-21 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>14.06</pre></div></td><td><div class="dni-plaintext"><pre>14.156</pre></div></td><td><div class="dni-plaintext"><pre>13.906</pre></div></td><td><div class="dni-plaintext"><pre>13.936</pre></div></td><td><div class="dni-plaintext"><pre>12.5348</pre></div></td><td><div class="dni-plaintext"><pre>29704326</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Inspect shape with row counts and Info

MDA exposes row and column counts directly from `Rows.Count` and `Columns.Count`, and `Info()` provides the concise schema-like view used for quick inspection.

_Prints the OHLCV shape as `(66355, 12)` and then calls `Info()` to summarize the 12 columns, their CLR data types, and basic completeness metadata before any downstream selection or filtering logic._

```csharp
// Microsoft.Data.Analysis — Shape and schema
display($"Shape: ({df.Rows.Count}, {df.Columns.Count})  |  Height: {df.Rows.Count}  |  Width: {df.Columns.Count}");
df.Info();
```

```text
Shape: (66355, 12)  |  Height: 66355  |  Width: 12
```

#### Microsoft.Data.Analysis | Summary statistics with Description

`Description()` is the MDA equivalent for numeric summary statistics. It returns another `DataFrame`, which keeps the result easy to inspect or reuse in notebook workflows.

_Computes descriptive statistics for the numeric columns in `df`, returning a summary DataFrame that highlights counts, minima, maxima, and mean values for the OHLCV data._

```csharp
// Microsoft.Data.Analysis — Description() returns a summary DataFrame
df.Description()
```

<table id="table_639112126215247292"><thead><tr><th><i>index</i></th><th>Description</th><th>id</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td>Length (excluding null values)</td><td><div class="dni-plaintext"><pre>66355</pre></div></td><td><div class="dni-plaintext"><pre>66355</pre></div></td><td><div class="dni-plaintext"><pre>66355</pre></div></td><td><div class="dni-plaintext"><pre>66355</pre></div></td><td><div class="dni-plaintext"><pre>66355</pre></div></td><td><div class="dni-plaintext"><pre>66355</pre></div></td><td><div class="dni-plaintext"><pre>66355</pre></div></td><td><div class="dni-plaintext"><pre>66355</pre></div></td><td><div class="dni-plaintext"><pre>66355</pre></div></td><td><div class="dni-plaintext"><pre>66355</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td>Max</td><td><div class="dni-plaintext"><pre>66930</pre></div></td><td><div class="dni-plaintext"><pre>&lt;null&gt;</pre></div></td><td><div class="dni-plaintext"><pre>2926</pre></div></td><td><div class="dni-plaintext"><pre>2957</pre></div></td><td><div class="dni-plaintext"><pre>2813</pre></div></td><td><div class="dni-plaintext"><pre>2839</pre></div></td><td><div class="dni-plaintext"><pre>2802.9382</pre></div></td><td><div class="dni-plaintext"><pre>376391550</pre></div></td><td><div class="dni-plaintext"><pre>22.5</pre></div></td><td><div class="dni-plaintext"><pre>5</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td>Min</td><td><div class="dni-plaintext"><pre>1</pre></div></td><td><div class="dni-plaintext"><pre>&lt;null&gt;</pre></div></td><td><div class="dni-plaintext"><pre>1.601</pre></div></td><td><div class="dni-plaintext"><pre>1.6628</pre></div></td><td><div class="dni-plaintext"><pre>1.5842</pre></div></td><td><div class="dni-plaintext"><pre>1.6066</pre></div></td><td><div class="dni-plaintext"><pre>1.2013</pre></div></td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>0</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td>Mean</td><td><div class="dni-plaintext"><pre>33179.734</pre></div></td><td><div class="dni-plaintext"><pre>&lt;null&gt;</pre></div></td><td><div class="dni-plaintext"><pre>197.04053</pre></div></td><td><div class="dni-plaintext"><pre>199.36412</pre></div></td><td><div class="dni-plaintext"><pre>194.58578</pre></div></td><td><div class="dni-plaintext"><pre>197.0349</pre></div></td><td><div class="dni-plaintext"><pre>190.49492</pre></div></td><td><div class="dni-plaintext"><pre>5942123.5</pre></div></td><td><div class="dni-plaintext"><pre>0.011756673</pre></div></td><td><div class="dni-plaintext"><pre>0.00017203268</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Count nulls per column

Null counts live on each `DataFrameColumn` via `NullCount`, so the standard pattern is to iterate columns and record the fields that actually contain missing data.

_Loads `scores_daily.csv`, iterates through its columns, and prints only the fields whose `NullCount` is greater than zero so that missing-value hot spots stand out immediately._

```csharp
// Microsoft.Data.Analysis — NullCount is a property on DataFrameColumn
// Use scores_daily which has real nulls
var scP = LoadScoresDailyCsv(DATA);
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

#### Microsoft.Data.Analysis | Frequency distribution with ValueCounts

`ValueCounts()` is available on a column and returns a new DataFrame of unique values plus their counts. This is the fastest way to inspect categorical distributions in MDA.

_Computes `ValueCounts()` for the `symbol` column, returning one row per ticker together with its observation count across the 66,355-row OHLCV dataset._

```csharp
// Microsoft.Data.Analysis — ValueCounts() on a Column returns a DataFrame
df.Columns["symbol"].ValueCounts()
```

<table id="table_639112126216712034"><caption><h3 style="text-align: center;">DataFrame - 50 rows </h3></caption><thead><tr><th><i>index</i></th><th>Values</th><th>Counts</th></tr></thead><tbody><tr style="display: none"><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td>ABI.BR</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td>AD.AS</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td>ADS.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td>ADYEN.AS</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td>AI.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>5</pre></div></i></td><td>AIR.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>6</pre></div></i></td><td>ALV.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>7</pre></div></i></td><td>ARGX.BR</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>8</pre></div></i></td><td>ASML.AS</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>9</pre></div></i></td><td>BAS.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>10</pre></div></i></td><td>BAYN.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>11</pre></div></i></td><td>BBVA.MC</td><td><div class="dni-plaintext"><pre>1329</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>12</pre></div></i></td><td>BMW.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>13</pre></div></i></td><td>BN.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>14</pre></div></i></td><td>BNP.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>15</pre></div></i></td><td>CS.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>16</pre></div></i></td><td>DB1.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>17</pre></div></i></td><td>DG.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>18</pre></div></i></td><td>DHL.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>19</pre></div></i></td><td>DSY.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>20</pre></div></i></td><td>DTE.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>21</pre></div></i></td><td>EL.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>22</pre></div></i></td><td>ENEL.MI</td><td><div class="dni-plaintext"><pre>1321</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>23</pre></div></i></td><td>ENI.MI</td><td><div class="dni-plaintext"><pre>1321</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>24</pre></div></i></td><td>ENR.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>25</pre></div></i></td><td>IBE.MC</td><td><div class="dni-plaintext"><pre>1329</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>26</pre></div></i></td><td>IFX.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>27</pre></div></i></td><td>INGA.AS</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>28</pre></div></i></td><td>ISP.MI</td><td><div class="dni-plaintext"><pre>1321</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>29</pre></div></i></td><td>ITX.MC</td><td><div class="dni-plaintext"><pre>1329</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>30</pre></div></i></td><td>MBG.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>31</pre></div></i></td><td>MC.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>32</pre></div></i></td><td>MUV2.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>33</pre></div></i></td><td>NDA-FI.HE</td><td><div class="dni-plaintext"><pre>1306</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>34</pre></div></i></td><td>OR.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>35</pre></div></i></td><td>PRX.AS</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>36</pre></div></i></td><td>RACE.MI</td><td><div class="dni-plaintext"><pre>1321</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>37</pre></div></i></td><td>RHM.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>38</pre></div></i></td><td>RMS.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>39</pre></div></i></td><td>SAF.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>40</pre></div></i></td><td>SAN.MC</td><td><div class="dni-plaintext"><pre>1329</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>41</pre></div></i></td><td>SAN.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>42</pre></div></i></td><td>SAP.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>43</pre></div></i></td><td>SGO.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>44</pre></div></i></td><td>SIE.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>45</pre></div></i></td><td>SU.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>46</pre></div></i></td><td>TTE.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>47</pre></div></i></td><td>UCG.MI</td><td><div class="dni-plaintext"><pre>1321</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>48</pre></div></i></td><td>VOW.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>49</pre></div></i></td><td>WKL.AS</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr></tbody><tfoot><tr><td colspan="3" style="text-align: center;"><button style="margin: 2px;" onclick="var allRows = document.querySelectorAll(&#39;#table_639112126216712034 tbody tr:nth-child(n)&#39;); for (let i = 0; i &lt; allRows.length; i++) { allRows[i].style.display=&#39;none&#39;; } document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML = 1; var page = parseInt(document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639112126216712034 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j &lt; 25; j++) { pageRows[j].style.display=&#39;table-row&#39;; } ">⏮</button><button style="margin: 2px;" onclick="var allRows = document.querySelectorAll(&#39;#table_639112126216712034 tbody tr:nth-child(n)&#39;); for (let i = 0; i &lt; allRows.length; i++) { allRows[i].style.display=&#39;none&#39;; } var page = parseInt(document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML) - 1; page = parseInt(page) + parseInt(-10); page = page &lt; 0 ? 0 : page; page = page > 1 ? 1 : page; document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML = page + 1; var page = parseInt(document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639112126216712034 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j &lt; 25; j++) { pageRows[j].style.display=&#39;table-row&#39;; } ">⏪</button><button style="margin: 2px;" onclick="var allRows = document.querySelectorAll(&#39;#table_639112126216712034 tbody tr:nth-child(n)&#39;); for (let i = 0; i &lt; allRows.length; i++) { allRows[i].style.display=&#39;none&#39;; } var page = parseInt(document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML) - 1; page = parseInt(page) + parseInt(-1); page = page &lt; 0 ? 0 : page; page = page > 1 ? 1 : page; document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML = page + 1; var page = parseInt(document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639112126216712034 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j &lt; 25; j++) { pageRows[j].style.display=&#39;table-row&#39;; } ">◀️</button><b style="margin: 2px;">Page</b><b id="page_639112126216712034" style="margin: 2px;">1</b><button style="margin: 2px;" onclick="var allRows = document.querySelectorAll(&#39;#table_639112126216712034 tbody tr:nth-child(n)&#39;); for (let i = 0; i &lt; allRows.length; i++) { allRows[i].style.display=&#39;none&#39;; } var page = parseInt(document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML) - 1; page = parseInt(page) + parseInt(1); page = page &lt; 0 ? 0 : page; page = page > 1 ? 1 : page; document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML = page + 1; var page = parseInt(document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639112126216712034 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j &lt; 25; j++) { pageRows[j].style.display=&#39;table-row&#39;; } ">▶️</button><button style="margin: 2px;" onclick="var allRows = document.querySelectorAll(&#39;#table_639112126216712034 tbody tr:nth-child(n)&#39;); for (let i = 0; i &lt; allRows.length; i++) { allRows[i].style.display=&#39;none&#39;; } var page = parseInt(document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML) - 1; page = parseInt(page) + parseInt(10); page = page &lt; 0 ? 0 : page; page = page > 1 ? 1 : page; document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML = page + 1; var page = parseInt(document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639112126216712034 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j &lt; 25; j++) { pageRows[j].style.display=&#39;table-row&#39;; } ">⏩</button><button style="margin: 2px;" onclick="var allRows = document.querySelectorAll(&#39;#table_639112126216712034 tbody tr:nth-child(n)&#39;); for (let i = 0; i &lt; allRows.length; i++) { allRows[i].style.display=&#39;none&#39;; } document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML = 2; var page = parseInt(document.querySelector(&#39;#page_639112126216712034&#39;).innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639112126216712034 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j &lt; 25; j++) { pageRows[j].style.display=&#39;table-row&#39;; } ">⏭️</button></td></tr></tfoot></table><script>var page = parseInt(document.querySelector('#page_639112126216712034').innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639112126216712034 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j < 25; j++) { pageRows[j].style.display='table-row'; } </script>

#### Microsoft.Data.Analysis | Distinct values with LINQ Distinct

When you want the set of unique values without the counts, the MDA pattern is usually to cast the column to a typed enumerable and use LINQ `Distinct()` before materializing the result back into a DataFrame.

_Casts the `symbol` column to `string`, computes the distinct tickers with LINQ, prints the unique-count result, and materializes the distinct values into a one-column DataFrame._

```csharp
// Microsoft.Data.Analysis — Unique counting and distinct values using LINQ
var symSeries = df.Columns["symbol"].Cast<string>();
var distinctSymbols = symSeries.Distinct().ToArray();
display($"NUnique: {distinctSymbols.Length}");

new DataFrame(new StringDataFrameColumn("symbol", distinctSymbols))
```

```text
NUnique: 50
```

<table id="table_639112126217485803"><caption><h3 style="text-align: center;">DataFrame - 50 rows </h3></caption><thead><tr><th><i>index</i></th><th>symbol</th></tr></thead><tbody><tr style="display: none"><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td>ABI.BR</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td>AD.AS</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td>ADS.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td>ADYEN.AS</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td>AI.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>5</pre></div></i></td><td>AIR.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>6</pre></div></i></td><td>ALV.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>7</pre></div></i></td><td>ARGX.BR</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>8</pre></div></i></td><td>ASML.AS</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>9</pre></div></i></td><td>BAS.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>10</pre></div></i></td><td>BAYN.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>11</pre></div></i></td><td>BBVA.MC</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>12</pre></div></i></td><td>BMW.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>13</pre></div></i></td><td>BN.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>14</pre></div></i></td><td>BNP.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>15</pre></div></i></td><td>CS.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>16</pre></div></i></td><td>DB1.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>17</pre></div></i></td><td>DG.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>18</pre></div></i></td><td>DHL.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>19</pre></div></i></td><td>DSY.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>20</pre></div></i></td><td>DTE.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>21</pre></div></i></td><td>EL.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>22</pre></div></i></td><td>ENEL.MI</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>23</pre></div></i></td><td>ENI.MI</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>24</pre></div></i></td><td>ENR.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>25</pre></div></i></td><td>IBE.MC</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>26</pre></div></i></td><td>IFX.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>27</pre></div></i></td><td>INGA.AS</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>28</pre></div></i></td><td>ISP.MI</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>29</pre></div></i></td><td>ITX.MC</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>30</pre></div></i></td><td>MBG.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>31</pre></div></i></td><td>MC.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>32</pre></div></i></td><td>MUV2.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>33</pre></div></i></td><td>NDA-FI.HE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>34</pre></div></i></td><td>OR.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>35</pre></div></i></td><td>PRX.AS</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>36</pre></div></i></td><td>RACE.MI</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>37</pre></div></i></td><td>RHM.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>38</pre></div></i></td><td>RMS.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>39</pre></div></i></td><td>SAF.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>40</pre></div></i></td><td>SAN.MC</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>41</pre></div></i></td><td>SAN.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>42</pre></div></i></td><td>SAP.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>43</pre></div></i></td><td>SGO.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>44</pre></div></i></td><td>SIE.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>45</pre></div></i></td><td>SU.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>46</pre></div></i></td><td>TTE.PA</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>47</pre></div></i></td><td>UCG.MI</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>48</pre></div></i></td><td>VOW.DE</td></tr><tr style="display: none"><td><i><div class="dni-plaintext"><pre>49</pre></div></i></td><td>WKL.AS</td></tr></tbody><tfoot><tr><td colspan="2" style="text-align: center;"><button style="margin: 2px;" onclick="var allRows = document.querySelectorAll(&#39;#table_639112126217485803 tbody tr:nth-child(n)&#39;); for (let i = 0; i &lt; allRows.length; i++) { allRows[i].style.display=&#39;none&#39;; } document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML = 1; var page = parseInt(document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639112126217485803 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j &lt; 25; j++) { pageRows[j].style.display=&#39;table-row&#39;; } ">⏮</button><button style="margin: 2px;" onclick="var allRows = document.querySelectorAll(&#39;#table_639112126217485803 tbody tr:nth-child(n)&#39;); for (let i = 0; i &lt; allRows.length; i++) { allRows[i].style.display=&#39;none&#39;; } var page = parseInt(document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML) - 1; page = parseInt(page) + parseInt(-10); page = page &lt; 0 ? 0 : page; page = page > 1 ? 1 : page; document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML = page + 1; var page = parseInt(document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639112126217485803 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j &lt; 25; j++) { pageRows[j].style.display=&#39;table-row&#39;; } ">⏪</button><button style="margin: 2px;" onclick="var allRows = document.querySelectorAll(&#39;#table_639112126217485803 tbody tr:nth-child(n)&#39;); for (let i = 0; i &lt; allRows.length; i++) { allRows[i].style.display=&#39;none&#39;; } var page = parseInt(document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML) - 1; page = parseInt(page) + parseInt(-1); page = page &lt; 0 ? 0 : page; page = page > 1 ? 1 : page; document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML = page + 1; var page = parseInt(document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639112126217485803 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j &lt; 25; j++) { pageRows[j].style.display=&#39;table-row&#39;; } ">◀️</button><b style="margin: 2px;">Page</b><b id="page_639112126217485803" style="margin: 2px;">1</b><button style="margin: 2px;" onclick="var allRows = document.querySelectorAll(&#39;#table_639112126217485803 tbody tr:nth-child(n)&#39;); for (let i = 0; i &lt; allRows.length; i++) { allRows[i].style.display=&#39;none&#39;; } var page = parseInt(document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML) - 1; page = parseInt(page) + parseInt(1); page = page &lt; 0 ? 0 : page; page = page > 1 ? 1 : page; document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML = page + 1; var page = parseInt(document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639112126217485803 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j &lt; 25; j++) { pageRows[j].style.display=&#39;table-row&#39;; } ">▶️</button><button style="margin: 2px;" onclick="var allRows = document.querySelectorAll(&#39;#table_639112126217485803 tbody tr:nth-child(n)&#39;); for (let i = 0; i &lt; allRows.length; i++) { allRows[i].style.display=&#39;none&#39;; } var page = parseInt(document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML) - 1; page = parseInt(page) + parseInt(10); page = page &lt; 0 ? 0 : page; page = page > 1 ? 1 : page; document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML = page + 1; var page = parseInt(document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639112126217485803 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j &lt; 25; j++) { pageRows[j].style.display=&#39;table-row&#39;; } ">⏩</button><button style="margin: 2px;" onclick="var allRows = document.querySelectorAll(&#39;#table_639112126217485803 tbody tr:nth-child(n)&#39;); for (let i = 0; i &lt; allRows.length; i++) { allRows[i].style.display=&#39;none&#39;; } document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML = 2; var page = parseInt(document.querySelector(&#39;#page_639112126217485803&#39;).innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639112126217485803 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j &lt; 25; j++) { pageRows[j].style.display=&#39;table-row&#39;; } ">⏭️</button></td></tr></tfoot></table><script>var page = parseInt(document.querySelector('#page_639112126217485803').innerHTML) - 1; var pageRows = document.querySelectorAll(`#table_639112126217485803 tbody tr:nth-child(n + ${page * 25 + 1 })`); for (let j = 0; j < 25; j++) { pageRows[j].style.display='table-row'; } </script>

#### Microsoft.Data.Analysis | Memory estimate via CLR-type heuristic

MDA does not expose a direct equivalent to Polars `EstimatedSize()`, so a practical approximation is to estimate bytes from the inferred CLR type and multiply by column length.

_Estimates dataframe size by summing `column length x assumed byte width` across all columns, then reports the approximate byte and megabyte footprint alongside the dataframe shape._

```csharp
// Microsoft.Data.Analysis — estimate size
long estBytes = 0;
foreach (var col in df.Columns)
{
    estBytes += col.Length * (col.DataType.Name switch
    {
        "Int32" or "Single" => 4,
        "Int64" or "Double" or "DateTime" => 8,
        "Decimal" => 16,
        "Boolean" => 1,
        "String" => 40,
        _ => 8
    });
}
display($"Estimated size: {estBytes:N0} bytes ({estBytes / 1_048_576.0:F2} MB)");
display($"Shape: ({df.Rows.Count}, {df.Columns.Count})  |  {df.Rows.Count:N0} rows x {df.Columns.Count} cols");
```

```text
Estimated size: 11'744'835 bytes (11.20 MB)
```

```text
Shape: (66355, 12)  |  66'355 rows x 12 cols
```

#### Microsoft.Data.Analysis | Reusable quick-profile function

When basic exploration needs to become repeatable, build a small profiling function that emits column name, CLR type, null count, and distinct count for any DataFrame.

_Defines `ProfileDataFrame(DataFrame d)`, computes per-column type, null count, and unique count, and applies it to both `eurostoxx50_ohlcv` and `dim_country` to produce reusable profile tables._

```csharp
// Microsoft.Data.Analysis — reusable profiler that returns a summary DataFrame
DataFrame ProfileDataFrame(DataFrame d)
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

    return new DataFrame(
        new StringDataFrameColumn("column", colNames),
        new StringDataFrameColumn("type", types),
        new PrimitiveDataFrameColumn<long>("nulls", nulls),
        new PrimitiveDataFrameColumn<long>("unique", uniques)
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

<table id="table_639112126220843727"><thead><tr><th><i>index</i></th><th>column</th><th>type</th><th>nulls</th><th>unique</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td>id</td><td>Int64</td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>66355</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td>symbol</td><td>String</td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>50</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td>date</td><td>DateTime</td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td>open</td><td>Decimal</td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>29671</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td>high</td><td>Decimal</td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>31651</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>5</pre></div></i></td><td>low</td><td>Decimal</td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>31695</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>6</pre></div></i></td><td>close</td><td>Decimal</td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>31505</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>7</pre></div></i></td><td>adj_close</td><td>Decimal</td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>57739</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>8</pre></div></i></td><td>volume</td><td>Int64</td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>65199</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>9</pre></div></i></td><td>dividends</td><td>Decimal</td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>216</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>10</pre></div></i></td><td>stock_splits</td><td>Decimal</td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>6</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>11</pre></div></i></td><td>is_filled</td><td>Boolean</td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>2</pre></div></td></tr></tbody></table>

```text
dim_country: (212, 2)
```

<table id="table_639112126220849689"><thead><tr><th><i>index</i></th><th>column</th><th>type</th><th>nulls</th><th>unique</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td>country_name</td><td>String</td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>212</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td>iso_alpha2</td><td>String</td><td><div class="dni-plaintext"><pre>0</pre></div></td><td><div class="dni-plaintext"><pre>212</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Select a single column by name

Selecting one column returns a `DataFrameColumn`, not a one-column DataFrame. That is convenient for direct vector operations, but downstream code needs to stay clear about whether it expects a column or a frame.

_Selects `close` and `symbol` from `df.Columns[...]`, then prints each column's name, length, and data type metadata to confirm the object returned is a `DataFrameColumn`._

```csharp
// Microsoft.Data.Analysis — single column returns a DataFrameColumn
var closeSeries = df.Columns["close"];
display($"Name: {closeSeries.Name}  |  Length: {closeSeries.Length}  |  Type: {closeSeries.DataType.Name}");

var symbolSeries = df.Columns["symbol"];
display($"Name: {symbolSeries.Name}  |  Length: {symbolSeries.Length}");
```

```text
Name: close  |  Length: 66355  |  Type: Decimal
```

```text
Name: symbol  |  Length: 66355
```

#### Microsoft.Data.Analysis | Select multiple columns into a new DataFrame

The standard MDA pattern is to construct a new `DataFrame` from the selected column objects. This is explicit and readable, but less declarative than Polars projection expressions when the selection logic becomes dynamic.

_Builds a new DataFrame from `date`, `symbol`, `close`, and `volume`, then previews the first five rows to confirm the four-column projection._

```csharp
// Microsoft.Data.Analysis — Select specific columns to form a new DataFrame
var selected = new DataFrame(df.Columns["date"], df.Columns["symbol"], df.Columns["close"], df.Columns["volume"]);
selected.Head(5)
```

<table id="table_639112126221936122"><thead><tr><th><i>index</i></th><th>date</th><th>symbol</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td><span>2021-01-04 00:00:00Z</span></td><td>ABI.BR</td><td><div class="dni-plaintext"><pre>57.21</pre></div></td><td><div class="dni-plaintext"><pre>1513937</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td><span>2021-01-05 00:00:00Z</span></td><td>ABI.BR</td><td><div class="dni-plaintext"><pre>57.18</pre></div></td><td><div class="dni-plaintext"><pre>1382722</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td><span>2021-01-06 00:00:00Z</span></td><td>ABI.BR</td><td><div class="dni-plaintext"><pre>58.77</pre></div></td><td><div class="dni-plaintext"><pre>1370204</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td><span>2021-01-07 00:00:00Z</span></td><td>ABI.BR</td><td><div class="dni-plaintext"><pre>58.4</pre></div></td><td><div class="dni-plaintext"><pre>1469911</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td><span>2021-01-08 00:00:00Z</span></td><td>ABI.BR</td><td><div class="dni-plaintext"><pre>57.86</pre></div></td><td><div class="dni-plaintext"><pre>1428681</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Compute columns explicitly and rename with SetName

MDA supports vectorized column arithmetic, but computed projections are assembled explicitly: clone the source columns you want to keep, compute the derived column, rename it, and build a new DataFrame from those pieces.

_Clones `symbol` and `close`, renames `close` to `price`, computes `range = high - low`, and materializes the result as a three-column DataFrame for inspection._

```csharp
// Microsoft.Data.Analysis — compute-on-select and renaming
var symbolCol = df.Columns["symbol"].Clone();
var priceCol = df.Columns["close"].Clone();
priceCol.SetName("price");
var highCol = (PrimitiveDataFrameColumn<decimal>)df.Columns["high"];
var lowCol = (PrimitiveDataFrameColumn<decimal>)df.Columns["low"];
var rangeCol = new PrimitiveDataFrameColumn<decimal>("range", df.Rows.Count);
for (long i = 0; i < df.Rows.Count; i++) if (highCol[i].HasValue && lowCol[i].HasValue) rangeCol[i] = highCol[i].Value - lowCol[i].Value;
var computed = new DataFrame(symbolCol, priceCol, rangeCol);
computed.Head(5)
```

<table id="table_639112126222705581"><thead><tr><th><i>index</i></th><th>symbol</th><th>price</th><th>range</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td>ABI.BR</td><td><div class="dni-plaintext"><pre>57.21</pre></div></td><td><div class="dni-plaintext"><pre>2.07</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td>ABI.BR</td><td><div class="dni-plaintext"><pre>57.18</pre></div></td><td><div class="dni-plaintext"><pre>1.23</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td>ABI.BR</td><td><div class="dni-plaintext"><pre>58.77</pre></div></td><td><div class="dni-plaintext"><pre>1.55</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td>ABI.BR</td><td><div class="dni-plaintext"><pre>58.4</pre></div></td><td><div class="dni-plaintext"><pre>0.98</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td>ABI.BR</td><td><div class="dni-plaintext"><pre>57.86</pre></div></td><td><div class="dni-plaintext"><pre>0.97</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Exclude columns by building the keep-set

Dropping columns is usually written as the inverse problem: define the columns to exclude, then build a new DataFrame from the columns that remain.

_Defines a `dropCols` set, selects every column not in that set, prints the resulting column list, and previews the trimmed frame._

```csharp
// Microsoft.Data.Analysis — Drop columns by selecting the ones to keep
var dropCols = new HashSet<string> { "id", "adj_close", "dividends", "stock_splits", "is_filled" };
var keepCols = df.Columns.Where(c => !dropCols.Contains(c.Name)).ToArray();
var trimmed = new DataFrame(keepCols);
display($"Columns: {string.Join(", ", trimmed.Columns.Select(c => c.Name))}");
trimmed.Head(3)
```

```text
Columns: symbol, date, open, high, low, close, volume
```

<table id="table_639112126223704685"><thead><tr><th><i>index</i></th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td>ABI.BR</td><td><span>2021-01-04 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>58.15</pre></div></td><td><div class="dni-plaintext"><pre>58.85</pre></div></td><td><div class="dni-plaintext"><pre>56.78</pre></div></td><td><div class="dni-plaintext"><pre>57.21</pre></div></td><td><div class="dni-plaintext"><pre>1513937</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td>ABI.BR</td><td><span>2021-01-05 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>56.9</pre></div></td><td><div class="dni-plaintext"><pre>57.98</pre></div></td><td><div class="dni-plaintext"><pre>56.75</pre></div></td><td><div class="dni-plaintext"><pre>57.18</pre></div></td><td><div class="dni-plaintext"><pre>1382722</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td>ABI.BR</td><td><span>2021-01-06 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>57.96</pre></div></td><td><div class="dni-plaintext"><pre>58.94</pre></div></td><td><div class="dni-plaintext"><pre>57.39</pre></div></td><td><div class="dni-plaintext"><pre>58.77</pre></div></td><td><div class="dni-plaintext"><pre>1370204</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Select columns matching a regex pattern

Regex-based selection in MDA is a `Columns.Where(...)` operation followed by a new DataFrame constructor. This keeps the logic flexible when column names follow domain conventions.

_Uses the regex `^(open|high|low|close)$` to isolate the OHLC price columns, prints the matched column names, and previews the resulting four-column DataFrame._

```csharp
// Microsoft.Data.Analysis — select columns by regex (match OHLC price columns)
var pattern = new Regex("^(open|high|low|close)$");
var priceCols = df.Columns.Where(c => pattern.IsMatch(c.Name)).ToArray();
var regexDf = new DataFrame(priceCols);
display($"Matched: {string.Join(", ", regexDf.Columns.Select(c => c.Name))}");
regexDf.Head(5)
```

```text
Matched: open, high, low, close
```

<table id="table_639112126224260691"><thead><tr><th><i>index</i></th><th>open</th><th>high</th><th>low</th><th>close</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td><div class="dni-plaintext"><pre>58.15</pre></div></td><td><div class="dni-plaintext"><pre>58.85</pre></div></td><td><div class="dni-plaintext"><pre>56.78</pre></div></td><td><div class="dni-plaintext"><pre>57.21</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td><div class="dni-plaintext"><pre>56.9</pre></div></td><td><div class="dni-plaintext"><pre>57.98</pre></div></td><td><div class="dni-plaintext"><pre>56.75</pre></div></td><td><div class="dni-plaintext"><pre>57.18</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td><div class="dni-plaintext"><pre>57.96</pre></div></td><td><div class="dni-plaintext"><pre>58.94</pre></div></td><td><div class="dni-plaintext"><pre>57.39</pre></div></td><td><div class="dni-plaintext"><pre>58.77</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td><div class="dni-plaintext"><pre>58.68</pre></div></td><td><div class="dni-plaintext"><pre>58.86</pre></div></td><td><div class="dni-plaintext"><pre>57.88</pre></div></td><td><div class="dni-plaintext"><pre>58.4</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td><div class="dni-plaintext"><pre>58.16</pre></div></td><td><div class="dni-plaintext"><pre>58.4</pre></div></td><td><div class="dni-plaintext"><pre>57.43</pre></div></td><td><div class="dni-plaintext"><pre>57.86</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Rename columns with cloned columns and SetName

Renaming usually means cloning the source columns, mutating their names, and then materializing the renamed set into a new frame.

_Clones `symbol`, `close`, and `volume`, renames them to `ticker`, `price`, and `vol`, prints the new schema, and previews the renamed DataFrame._

```csharp
// Microsoft.Data.Analysis — Rename via SetName on cloned columns
var renamed = new DataFrame(df.Columns["symbol"].Clone(), df.Columns["close"].Clone(), df.Columns["volume"].Clone());
renamed.Columns["symbol"].SetName("ticker");
renamed.Columns["close"].SetName("price");
renamed.Columns["volume"].SetName("vol");

display($"Columns: {string.Join(", ", renamed.Columns.Select(c => c.Name))}");
renamed.Head(3)
```

```text
Columns: ticker, price, vol
```

<table id="table_639112126224817371"><thead><tr><th><i>index</i></th><th>ticker</th><th>price</th><th>vol</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td>ABI.BR</td><td><div class="dni-plaintext"><pre>57.21</pre></div></td><td><div class="dni-plaintext"><pre>1513937</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td>ABI.BR</td><td><div class="dni-plaintext"><pre>57.18</pre></div></td><td><div class="dni-plaintext"><pre>1382722</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td>ABI.BR</td><td><div class="dni-plaintext"><pre>58.77</pre></div></td><td><div class="dni-plaintext"><pre>1370204</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Reorder columns by constructor order

Column order is simply the order in which the selected columns are passed into the new `DataFrame`. That makes reordering straightforward, but still a manual projection step.

_Constructs a new DataFrame in the order `symbol`, `date`, `volume`, `open`, `high`, `low`, `close`, prints the resulting column order, and previews the reordered frame._

```csharp
// Microsoft.Data.Analysis — Reorder by selecting them in order into a new DataFrame
var reordered = new DataFrame(
    df.Columns["symbol"], df.Columns["date"], df.Columns["volume"],
    df.Columns["open"], df.Columns["high"], df.Columns["low"], df.Columns["close"]
);
display($"Column order: {string.Join(", ", reordered.Columns.Select(c => c.Name))}");
reordered.Head(3)
```

```text
Column order: symbol, date, volume, open, high, low, close
```

<table id="table_639112126225312084"><thead><tr><th><i>index</i></th><th>symbol</th><th>date</th><th>volume</th><th>open</th><th>high</th><th>low</th><th>close</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td>ABI.BR</td><td><span>2021-01-04 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>1513937</pre></div></td><td><div class="dni-plaintext"><pre>58.15</pre></div></td><td><div class="dni-plaintext"><pre>58.85</pre></div></td><td><div class="dni-plaintext"><pre>56.78</pre></div></td><td><div class="dni-plaintext"><pre>57.21</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td>ABI.BR</td><td><span>2021-01-05 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>1382722</pre></div></td><td><div class="dni-plaintext"><pre>56.9</pre></div></td><td><div class="dni-plaintext"><pre>57.98</pre></div></td><td><div class="dni-plaintext"><pre>56.75</pre></div></td><td><div class="dni-plaintext"><pre>57.18</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td>ABI.BR</td><td><span>2021-01-06 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>1370204</pre></div></td><td><div class="dni-plaintext"><pre>57.96</pre></div></td><td><div class="dni-plaintext"><pre>58.94</pre></div></td><td><div class="dni-plaintext"><pre>57.39</pre></div></td><td><div class="dni-plaintext"><pre>58.77</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Boolean filter with elementwise comparison

Numeric predicates are expressed as vectorized elementwise comparisons on a typed column, and the resulting boolean column is passed into `DataFrame.Filter(...)`.

_Casts `close` to `MDA.PrimitiveDataFrameColumn<decimal>`, builds the predicate `close > 500`, filters the dataframe, prints the row count, and previews the first five matching rows._

```csharp
// Microsoft.Data.Analysis — Filter with elementwise expressions
var closeCol = (PrimitiveDataFrameColumn<decimal>)df.Columns["close"];
var expensiveMask = new PrimitiveDataFrameColumn<bool>("close_gt_500", df.Rows.Count);
for (long i = 0; i < df.Rows.Count; i++) if (closeCol[i].HasValue) expensiveMask[i] = closeCol[i].Value > 500.0m;
var expensive = df.Filter(expensiveMask);
display($"Rows where close > 500: {expensive.Rows.Count}");
expensive.Head(5)
```

```text
Rows where close > 500: 6155
```

<table id="table_639112126226238809"><thead><tr><th><i>index</i></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td><div class="dni-plaintext"><pre>60763</pre></div></td><td>ADYEN.AS</td><td><span>2021-01-04 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>1900.0</pre></div></td><td><div class="dni-plaintext"><pre>1921.5</pre></div></td><td><div class="dni-plaintext"><pre>1856.0</pre></div></td><td><div class="dni-plaintext"><pre>1859.5</pre></div></td><td><div class="dni-plaintext"><pre>1859.5</pre></div></td><td><div class="dni-plaintext"><pre>99408</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td><div class="dni-plaintext"><pre>60764</pre></div></td><td>ADYEN.AS</td><td><span>2021-01-05 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>1848.5</pre></div></td><td><div class="dni-plaintext"><pre>1857.0</pre></div></td><td><div class="dni-plaintext"><pre>1814.0</pre></div></td><td><div class="dni-plaintext"><pre>1829.0</pre></div></td><td><div class="dni-plaintext"><pre>1829.0</pre></div></td><td><div class="dni-plaintext"><pre>86256</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td><div class="dni-plaintext"><pre>60765</pre></div></td><td>ADYEN.AS</td><td><span>2021-01-06 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>1822.0</pre></div></td><td><div class="dni-plaintext"><pre>1824.0</pre></div></td><td><div class="dni-plaintext"><pre>1706.5</pre></div></td><td><div class="dni-plaintext"><pre>1733.0</pre></div></td><td><div class="dni-plaintext"><pre>1733.0</pre></div></td><td><div class="dni-plaintext"><pre>156844</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td><div class="dni-plaintext"><pre>60766</pre></div></td><td>ADYEN.AS</td><td><span>2021-01-07 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>1735.0</pre></div></td><td><div class="dni-plaintext"><pre>1754.0</pre></div></td><td><div class="dni-plaintext"><pre>1708.5</pre></div></td><td><div class="dni-plaintext"><pre>1714.5</pre></div></td><td><div class="dni-plaintext"><pre>1714.5</pre></div></td><td><div class="dni-plaintext"><pre>90183</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td><div class="dni-plaintext"><pre>60767</pre></div></td><td>ADYEN.AS</td><td><span>2021-01-08 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>1730.0</pre></div></td><td><div class="dni-plaintext"><pre>1764.5</pre></div></td><td><div class="dni-plaintext"><pre>1715.0</pre></div></td><td><div class="dni-plaintext"><pre>1756.5</pre></div></td><td><div class="dni-plaintext"><pre>1756.5</pre></div></td><td><div class="dni-plaintext"><pre>97176</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Compound filters with And, Or, and explicit negation

Compound filters are composed from boolean columns with `.And()` and `.Or()`. In practice, the mask construction is explicit, which keeps the logic readable but gets verbose faster than a Polars predicate chain.

_Builds boolean masks for `ASML.AS`, `SAP.DE`, and `close > 600`, then evaluates `ASML AND close > 600`, `ASML OR SAP`, and a non-ASML filter to show the three common boolean compositions._

```csharp
// Microsoft.Data.Analysis — AND / OR / NOT elementwise operators
var symbolColStr = df.Columns["symbol"];
var isAsml = symbolColStr.ElementwiseEquals("ASML.AS");
var isSap = symbolColStr.ElementwiseEquals("SAP.DE");
var closeOver600 = new PrimitiveDataFrameColumn<bool>("close_over_600", df.Rows.Count);
for (long i = 0; i < df.Rows.Count; i++) if (closeCol[i].HasValue) closeOver600[i] = closeCol[i].Value > 600.0m;
var filtered = df.Filter((PrimitiveDataFrameColumn<bool>)isAsml.And(closeOver600));
display($"ASML AND close > 600: {filtered.Rows.Count} rows");
display(filtered.Head(3));
var orFilter = df.Filter((PrimitiveDataFrameColumn<bool>)isAsml.Or(isSap));
display($"ASML OR SAP: {orFilter.Rows.Count} rows");
var notFilter = df.Filter((PrimitiveDataFrameColumn<bool>)isAsml.ElementwiseNotEquals(true));
display($"NOT ASML: {notFilter.Rows.Count} rows");
```

```text
ASML AND close > 600: 840 rows
```

<table id="table_639112126227368780"><thead><tr><th><i>index</i></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td><div class="dni-plaintext"><pre>136</pre></div></td><td>ASML.AS</td><td><span>2021-07-14 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>599.5</pre></div></td><td><div class="dni-plaintext"><pre>611.8</pre></div></td><td><div class="dni-plaintext"><pre>597.2</pre></div></td><td><div class="dni-plaintext"><pre>609.1</pre></div></td><td><div class="dni-plaintext"><pre>582.9708</pre></div></td><td><div class="dni-plaintext"><pre>641585</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td><div class="dni-plaintext"><pre>142</pre></div></td><td>ASML.AS</td><td><span>2021-07-22 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>610.0</pre></div></td><td><div class="dni-plaintext"><pre>625.9</pre></div></td><td><div class="dni-plaintext"><pre>608.2</pre></div></td><td><div class="dni-plaintext"><pre>620.8</pre></div></td><td><div class="dni-plaintext"><pre>594.169</pre></div></td><td><div class="dni-plaintext"><pre>788099</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td><div class="dni-plaintext"><pre>143</pre></div></td><td>ASML.AS</td><td><span>2021-07-23 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>622.9</pre></div></td><td><div class="dni-plaintext"><pre>639.0</pre></div></td><td><div class="dni-plaintext"><pre>617.5</pre></div></td><td><div class="dni-plaintext"><pre>638.8</pre></div></td><td><div class="dni-plaintext"><pre>611.3967</pre></div></td><td><div class="dni-plaintext"><pre>833737</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr></tbody></table>

```text
ASML OR SAP: 2655 rows
```

```text
NOT ASML: 65024 rows
```

#### Microsoft.Data.Analysis | Filter by membership with a manual boolean mask

Membership filtering is usually implemented by testing each value against a `HashSet<T>` and writing the result into a boolean mask column.

_Builds a ticker set for `ASML.AS`, `SAP.DE`, and `SIE.DE`, evaluates membership row by row into a boolean mask, filters the dataframe, and previews the first five matching rows._

```csharp
// Microsoft.Data.Analysis — IsIn requires manual evaluation into a boolean mask
var techTickers = new HashSet<string> { "ASML.AS", "SAP.DE", "SIE.DE" };
var isInMask = new PrimitiveDataFrameColumn<bool>("mask", df.Rows.Count);

// Cast to StringDataFrameColumn instead of using .Cast<string>()
var symbols = (StringDataFrameColumn)df.Columns["symbol"];

for(long i = 0; i < df.Rows.Count; i++)
{
    // Now indexing with [i] works correctly
    isInMask[i] = techTickers.Contains(symbols[i]);
}

var techRows = df.Filter(isInMask);
display($"Tech tickers: {techRows.Rows.Count} rows");
techRows.Head(5)
```

```text
Tech tickers: 3979 rows
```

<table id="table_639112126229749896"><thead><tr><th><i>index</i></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td><div class="dni-plaintext"><pre>1</pre></div></td><td>ASML.AS</td><td><span>2021-01-04 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>404.0</pre></div></td><td><div class="dni-plaintext"><pre>411.0</pre></div></td><td><div class="dni-plaintext"><pre>402.25</pre></div></td><td><div class="dni-plaintext"><pre>406.25</pre></div></td><td><div class="dni-plaintext"><pre>387.709</pre></div></td><td><div class="dni-plaintext"><pre>789502</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td><div class="dni-plaintext"><pre>2</pre></div></td><td>ASML.AS</td><td><span>2021-01-05 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>406.55</pre></div></td><td><div class="dni-plaintext"><pre>412.05</pre></div></td><td><div class="dni-plaintext"><pre>401.15</pre></div></td><td><div class="dni-plaintext"><pre>406.9</pre></div></td><td><div class="dni-plaintext"><pre>388.3294</pre></div></td><td><div class="dni-plaintext"><pre>798787</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td><div class="dni-plaintext"><pre>3</pre></div></td><td>ASML.AS</td><td><span>2021-01-06 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>406.8</pre></div></td><td><div class="dni-plaintext"><pre>407.2</pre></div></td><td><div class="dni-plaintext"><pre>399.2</pre></div></td><td><div class="dni-plaintext"><pre>402.85</pre></div></td><td><div class="dni-plaintext"><pre>384.4644</pre></div></td><td><div class="dni-plaintext"><pre>875711</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td><div class="dni-plaintext"><pre>4</pre></div></td><td>ASML.AS</td><td><span>2021-01-07 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>404.8</pre></div></td><td><div class="dni-plaintext"><pre>407.8</pre></div></td><td><div class="dni-plaintext"><pre>400.35</pre></div></td><td><div class="dni-plaintext"><pre>403.9</pre></div></td><td><div class="dni-plaintext"><pre>385.4664</pre></div></td><td><div class="dni-plaintext"><pre>874780</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td><div class="dni-plaintext"><pre>5</pre></div></td><td>ASML.AS</td><td><span>2021-01-08 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>414.25</pre></div></td><td><div class="dni-plaintext"><pre>419.1</pre></div></td><td><div class="dni-plaintext"><pre>413.4</pre></div></td><td><div class="dni-plaintext"><pre>416.05</pre></div></td><td><div class="dni-plaintext"><pre>397.0618</pre></div></td><td><div class="dni-plaintext"><pre>975243</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Range filter with composed boolean masks

Range filters are just boolean mask composition: generate the lower-bound and upper-bound comparisons, combine them with `.And()`, and pass the result into `Filter()`.

_Builds a mask for `100 <= close <= 200`, filters the dataframe, prints the matching row count, and previews the first five results._

```csharp
// Microsoft.Data.Analysis — Range filtering using logical And()
var midRangeMask = new PrimitiveDataFrameColumn<bool>("mid_range", df.Rows.Count);
for (long i = 0; i < df.Rows.Count; i++)
{
    if (closeCol[i].HasValue)
    {
        var value = closeCol[i].Value;
        midRangeMask[i] = value >= 100.0m && value <= 200.0m;
    }
}
var midRange = df.Filter(midRangeMask);
display($"Close between 100 and 200: {midRange.Rows.Count} rows");
midRange.Head(5)
```

```text
Close between 100 and 200: 12013 rows
```

<table id="table_639112126230927861"><thead><tr><th><i>index</i></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td><div class="dni-plaintext"><pre>62387</pre></div></td><td>ADS.DE</td><td><span>2022-03-04 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>196.5</pre></div></td><td><div class="dni-plaintext"><pre>197.64</pre></div></td><td><div class="dni-plaintext"><pre>187.0</pre></div></td><td><div class="dni-plaintext"><pre>187.0</pre></div></td><td><div class="dni-plaintext"><pre>180.5918</pre></div></td><td><div class="dni-plaintext"><pre>1319891</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td><div class="dni-plaintext"><pre>62388</pre></div></td><td>ADS.DE</td><td><span>2022-03-07 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>177.1</pre></div></td><td><div class="dni-plaintext"><pre>183.4</pre></div></td><td><div class="dni-plaintext"><pre>170.08</pre></div></td><td><div class="dni-plaintext"><pre>176.9</pre></div></td><td><div class="dni-plaintext"><pre>170.8379</pre></div></td><td><div class="dni-plaintext"><pre>2345656</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td><div class="dni-plaintext"><pre>62389</pre></div></td><td>ADS.DE</td><td><span>2022-03-08 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>172.18</pre></div></td><td><div class="dni-plaintext"><pre>187.06</pre></div></td><td><div class="dni-plaintext"><pre>172.0</pre></div></td><td><div class="dni-plaintext"><pre>184.94</pre></div></td><td><div class="dni-plaintext"><pre>178.6024</pre></div></td><td><div class="dni-plaintext"><pre>1937346</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td><div class="dni-plaintext"><pre>62391</pre></div></td><td>ADS.DE</td><td><span>2022-03-10 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>211.35</pre></div></td><td><div class="dni-plaintext"><pre>211.8</pre></div></td><td><div class="dni-plaintext"><pre>196.68</pre></div></td><td><div class="dni-plaintext"><pre>197.08</pre></div></td><td><div class="dni-plaintext"><pre>190.3264</pre></div></td><td><div class="dni-plaintext"><pre>1375129</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td><div class="dni-plaintext"><pre>62415</pre></div></td><td>ADS.DE</td><td><span>2022-04-13 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>198.52</pre></div></td><td><div class="dni-plaintext"><pre>199.74</pre></div></td><td><div class="dni-plaintext"><pre>194.16</pre></div></td><td><div class="dni-plaintext"><pre>197.76</pre></div></td><td><div class="dni-plaintext"><pre>190.9831</pre></div></td><td><div class="dni-plaintext"><pre>755573</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Null checks with ElementwiseIsNull and ElementwiseIsNotNull

MDA exposes null predicates as elementwise boolean columns. The main pattern is straightforward: generate the mask, call `Filter()`, and count or inspect the result.

_Filters once for rows with null `volume` and once for rows with non-null `volume`, then prints the row counts for each result set._

```csharp
// Microsoft.Data.Analysis — IsNull / IsNotNull
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

#### Microsoft.Data.Analysis | String predicates through explicit mask evaluation

String filtering often becomes manual mask construction over a `MDA.StringDataFrameColumn`, especially when you need `EndsWith` or `Contains` semantics without a dedicated string-expression namespace.

_Builds one mask for Paris-listed symbols ending in `.PA` and another for symbols containing `BN`, filters the dataframe with each mask, prints the row counts, and materializes the distinct matching symbols._

```csharp
// Microsoft.Data.Analysis — string predicates require manual boolean mask evaluation
var isPaMask = new PrimitiveDataFrameColumn<bool>("mask", df.Rows.Count);
var hasBnMask = new PrimitiveDataFrameColumn<bool>("mask", df.Rows.Count);

for(long i = 0; i < df.Rows.Count; i++)
{
    var val = symbols[i];
    isPaMask[i] = val != null && val.EndsWith(".PA");
    hasBnMask[i] = val != null && val.Contains("BN");
}

var parisStocks = df.Filter(isPaMask);
display($"Paris-listed (.PA): {parisStocks.Rows.Count} rows");
display(new DataFrame(new StringDataFrameColumn("symbol", parisStocks.Columns["symbol"].Cast<string>().Distinct())));

var containsB = df.Filter(hasBnMask);
display($"Symbol contains BN: {containsB.Rows.Count} rows");
new DataFrame(new StringDataFrameColumn("symbol", containsB.Columns["symbol"].Cast<string>().Distinct()))
```

```text
Paris-listed (.PA): 21296 rows
```

<table id="table_639112126234062830"><thead><tr><th><i>index</i></th><th>symbol</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td>AI.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td>AIR.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td>BN.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td>BNP.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td>CS.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>5</pre></div></i></td><td>DG.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>6</pre></div></i></td><td>DSY.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>7</pre></div></i></td><td>EL.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>8</pre></div></i></td><td>MC.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>9</pre></div></i></td><td>OR.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>10</pre></div></i></td><td>RMS.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>11</pre></div></i></td><td>SAF.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>12</pre></div></i></td><td>SAN.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>13</pre></div></i></td><td>SGO.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>14</pre></div></i></td><td>SU.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>15</pre></div></i></td><td>TTE.PA</td></tr></tbody></table>

```text
Symbol contains BN: 2662 rows
```

<table id="table_639112126234355385"><thead><tr><th><i>index</i></th><th>symbol</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td>BN.PA</td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td>BNP.PA</td></tr></tbody></table>

#### Microsoft.Data.Analysis | Date predicates with an explicit DateTime mask

The date column is evaluated row by row, coercing each value to `DateTime` where possible and writing the final result into reusable boolean masks. This is clear and robust, but more procedural than Polars' date-expression API.

_Builds one mask for rows in calendar year 2023 and another for Q1 2024, prints the resulting row counts, and previews the first five rows from the Q1 2024 subset._

```csharp
// Microsoft.Data.Analysis — date predicates evaluated manually
var dates = df.Columns["date"];
var yearMask = new PrimitiveDataFrameColumn<bool>("yearMask", df.Rows.Count);
var q1Mask = new PrimitiveDataFrameColumn<bool>("q1Mask", df.Rows.Count);

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

<table id="table_639112126235732594"><thead><tr><th><i>index</i></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td><div class="dni-plaintext"><pre>21930</pre></div></td><td>ABI.BR</td><td><span>2024-01-02 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>58.72</pre></div></td><td><div class="dni-plaintext"><pre>58.95</pre></div></td><td><div class="dni-plaintext"><pre>58.17</pre></div></td><td><div class="dni-plaintext"><pre>58.77</pre></div></td><td><div class="dni-plaintext"><pre>56.7582</pre></div></td><td><div class="dni-plaintext"><pre>1049145</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td><div class="dni-plaintext"><pre>21931</pre></div></td><td>ABI.BR</td><td><span>2024-01-03 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>58.64</pre></div></td><td><div class="dni-plaintext"><pre>59.34</pre></div></td><td><div class="dni-plaintext"><pre>58.24</pre></div></td><td><div class="dni-plaintext"><pre>58.37</pre></div></td><td><div class="dni-plaintext"><pre>56.3719</pre></div></td><td><div class="dni-plaintext"><pre>1247000</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td><div class="dni-plaintext"><pre>21932</pre></div></td><td>ABI.BR</td><td><span>2024-01-04 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>58.36</pre></div></td><td><div class="dni-plaintext"><pre>58.92</pre></div></td><td><div class="dni-plaintext"><pre>58.3</pre></div></td><td><div class="dni-plaintext"><pre>58.81</pre></div></td><td><div class="dni-plaintext"><pre>56.7968</pre></div></td><td><div class="dni-plaintext"><pre>1009526</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td><div class="dni-plaintext"><pre>21933</pre></div></td><td>ABI.BR</td><td><span>2024-01-05 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>58.26</pre></div></td><td><div class="dni-plaintext"><pre>58.91</pre></div></td><td><div class="dni-plaintext"><pre>58.16</pre></div></td><td><div class="dni-plaintext"><pre>58.86</pre></div></td><td><div class="dni-plaintext"><pre>56.8451</pre></div></td><td><div class="dni-plaintext"><pre>1236000</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td><div class="dni-plaintext"><pre>21934</pre></div></td><td>ABI.BR</td><td><span>2024-01-08 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>58.47</pre></div></td><td><div class="dni-plaintext"><pre>59.5</pre></div></td><td><div class="dni-plaintext"><pre>58.39</pre></div></td><td><div class="dni-plaintext"><pre>59.38</pre></div></td><td><div class="dni-plaintext"><pre>57.3473</pre></div></td><td><div class="dni-plaintext"><pre>1033238</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Access a single row by position

For quick inspection, `Head(1)` returns a one-row frame while column indexers retrieve specific scalar values from the same row position.

_Displays the first row with `Head(1)`, then reads `symbol` and `close` from row position `0` via the column indexers to show row-level inspection without materializing a dedicated row object._

```csharp
// Microsoft.Data.Analysis — single row access
display("Row 0:");
display(df.Head(1));

// Access individual values from a row by column indexer
display($"Row 0, symbol: {df.Columns["symbol"][0]}");
display($"Row 0, close:  {df.Columns["close"][0]}");
```

```text
Row 0:
```

<table id="table_639112126236286877"><thead><tr><th><i>index</i></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td><div class="dni-plaintext"><pre>21160</pre></div></td><td>ABI.BR</td><td><span>2021-01-04 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>58.15</pre></div></td><td><div class="dni-plaintext"><pre>58.85</pre></div></td><td><div class="dni-plaintext"><pre>56.78</pre></div></td><td><div class="dni-plaintext"><pre>57.21</pre></div></td><td><div class="dni-plaintext"><pre>53.5761</pre></div></td><td><div class="dni-plaintext"><pre>1513937</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr></tbody></table>

```text
Row 0, symbol: ABI.BR
```

```text
Row 0, close:  57.21
```

#### Microsoft.Data.Analysis | Slice a row range with a positional mask

The slice pattern shown here creates a positional boolean mask, marks the desired row interval, and filters on that mask.

_Builds a mask for row positions `100..104`, filters the dataframe on that mask, and displays the resulting five-row slice._

```csharp
// Microsoft.Data.Analysis — Slice using an index boolean mask
display("Rows 100..104:");
var sliceMask = new PrimitiveDataFrameColumn<bool>("mask", df.Rows.Count);
for(long i = 100; i < 105 && i < df.Rows.Count; i++)
{
    sliceMask[i] = true;
}
df.Filter(sliceMask)
```

```text
Rows 100..104:
```

<table id="table_639112126236982995"><thead><tr><th><i>index</i></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td><div class="dni-plaintext"><pre>21260</pre></div></td><td>ABI.BR</td><td><span>2021-05-26 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>61.99</pre></div></td><td><div class="dni-plaintext"><pre>62.39</pre></div></td><td><div class="dni-plaintext"><pre>61.83</pre></div></td><td><div class="dni-plaintext"><pre>62.12</pre></div></td><td><div class="dni-plaintext"><pre>58.6701</pre></div></td><td><div class="dni-plaintext"><pre>940186</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td><div class="dni-plaintext"><pre>21261</pre></div></td><td>ABI.BR</td><td><span>2021-05-27 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>61.8</pre></div></td><td><div class="dni-plaintext"><pre>62.64</pre></div></td><td><div class="dni-plaintext"><pre>61.73</pre></div></td><td><div class="dni-plaintext"><pre>62.13</pre></div></td><td><div class="dni-plaintext"><pre>58.6795</pre></div></td><td><div class="dni-plaintext"><pre>1796477</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td><div class="dni-plaintext"><pre>21262</pre></div></td><td>ABI.BR</td><td><span>2021-05-28 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>62.14</pre></div></td><td><div class="dni-plaintext"><pre>62.58</pre></div></td><td><div class="dni-plaintext"><pre>61.96</pre></div></td><td><div class="dni-plaintext"><pre>62.34</pre></div></td><td><div class="dni-plaintext"><pre>58.8779</pre></div></td><td><div class="dni-plaintext"><pre>1004125</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td><div class="dni-plaintext"><pre>21263</pre></div></td><td>ABI.BR</td><td><span>2021-05-31 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>62.27</pre></div></td><td><div class="dni-plaintext"><pre>62.31</pre></div></td><td><div class="dni-plaintext"><pre>61.51</pre></div></td><td><div class="dni-plaintext"><pre>61.56</pre></div></td><td><div class="dni-plaintext"><pre>58.1412</pre></div></td><td><div class="dni-plaintext"><pre>851557</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td><div class="dni-plaintext"><pre>21264</pre></div></td><td>ABI.BR</td><td><span>2021-06-01 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>62.35</pre></div></td><td><div class="dni-plaintext"><pre>62.48</pre></div></td><td><div class="dni-plaintext"><pre>61.98</pre></div></td><td><div class="dni-plaintext"><pre>62.38</pre></div></td><td><div class="dni-plaintext"><pre>58.9157</pre></div></td><td><div class="dni-plaintext"><pre>1171646</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Sort rows with OrderBy and OrderByDescending

MDA provides dataframe-level `OrderBy(...)` and `OrderByDescending(...)` for single-column sorting. Chained sorts work, but they are still eager materializations rather than lazy plan transformations.

_Sorts the dataframe by `close` descending to show the top five closing prices, then chains a second sort to inspect symbol-first ordering with descending close values inside the sorted result._

```csharp
// Microsoft.Data.Analysis — Sort ascending and descending
display("Top 5 by close (descending):");
display(df.OrderByDescending("close").Head(5));

// Multi-column sort: Microsoft.Data.Analysis doesn't natively support multi-sort chained via OrderBy().ThenBy()
// We chain OrderBy() calls (which sorts the result of the previous sort).
display("Sort by symbol ASC, then close DESC:");
df.OrderByDescending("close").OrderBy("symbol").Head(5)
```

```text
Top 5 by close (descending):
```

<table id="table_639112126238396308"><thead><tr><th><i>index</i></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td><div class="dni-plaintext"><pre>3708</pre></div></td><td>RMS.PA</td><td><span>2025-02-14 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>2926.0</pre></div></td><td><div class="dni-plaintext"><pre>2957.0</pre></div></td><td><div class="dni-plaintext"><pre>2813.0</pre></div></td><td><div class="dni-plaintext"><pre>2839.0</pre></div></td><td><div class="dni-plaintext"><pre>2802.9382</pre></div></td><td><div class="dni-plaintext"><pre>105651</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td><div class="dni-plaintext"><pre>3707</pre></div></td><td>RMS.PA</td><td><span>2025-02-13 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>2770.0</pre></div></td><td><div class="dni-plaintext"><pre>2816.0</pre></div></td><td><div class="dni-plaintext"><pre>2765.0</pre></div></td><td><div class="dni-plaintext"><pre>2816.0</pre></div></td><td><div class="dni-plaintext"><pre>2780.2302</pre></div></td><td><div class="dni-plaintext"><pre>80087</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td><div class="dni-plaintext"><pre>3709</pre></div></td><td>RMS.PA</td><td><span>2025-02-17 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>2825.0</pre></div></td><td><div class="dni-plaintext"><pre>2858.0</pre></div></td><td><div class="dni-plaintext"><pre>2803.0</pre></div></td><td><div class="dni-plaintext"><pre>2809.0</pre></div></td><td><div class="dni-plaintext"><pre>2776.7424</pre></div></td><td><div class="dni-plaintext"><pre>53852</pre></div></td><td><div class="dni-plaintext"><pre>3.5</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td><div class="dni-plaintext"><pre>3710</pre></div></td><td>RMS.PA</td><td><span>2025-02-18 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>2816.0</pre></div></td><td><div class="dni-plaintext"><pre>2827.0</pre></div></td><td><div class="dni-plaintext"><pre>2780.0</pre></div></td><td><div class="dni-plaintext"><pre>2806.0</pre></div></td><td><div class="dni-plaintext"><pre>2773.7771</pre></div></td><td><div class="dni-plaintext"><pre>65469</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td><div class="dni-plaintext"><pre>60927</pre></div></td><td>ADYEN.AS</td><td><span>2021-08-24 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>2725.0</pre></div></td><td><div class="dni-plaintext"><pre>2766.0</pre></div></td><td><div class="dni-plaintext"><pre>2711.5</pre></div></td><td><div class="dni-plaintext"><pre>2766.0</pre></div></td><td><div class="dni-plaintext"><pre>2766.0</pre></div></td><td><div class="dni-plaintext"><pre>61431</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr></tbody></table>

```text
Sort by symbol ASC, then close DESC:
```

<table id="table_639112126239864866"><thead><tr><th><i>index</i></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td><div class="dni-plaintext"><pre>21512</pre></div></td><td>ABI.BR</td><td><span>2022-05-17 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>54.65</pre></div></td><td><div class="dni-plaintext"><pre>55.18</pre></div></td><td><div class="dni-plaintext"><pre>53.96</pre></div></td><td><div class="dni-plaintext"><pre>54.44</pre></div></td><td><div class="dni-plaintext"><pre>51.9</pre></div></td><td><div class="dni-plaintext"><pre>1092579</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td><div class="dni-plaintext"><pre>21814</pre></div></td><td>ABI.BR</td><td><span>2023-07-19 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>51.59</pre></div></td><td><div class="dni-plaintext"><pre>52.15</pre></div></td><td><div class="dni-plaintext"><pre>51.34</pre></div></td><td><div class="dni-plaintext"><pre>52.0</pre></div></td><td><div class="dni-plaintext"><pre>50.2199</pre></div></td><td><div class="dni-plaintext"><pre>1228208</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td><div class="dni-plaintext"><pre>21408</pre></div></td><td>ABI.BR</td><td><span>2021-12-20 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>51.69</pre></div></td><td><div class="dni-plaintext"><pre>52.32</pre></div></td><td><div class="dni-plaintext"><pre>50.71</pre></div></td><td><div class="dni-plaintext"><pre>52.0</pre></div></td><td><div class="dni-plaintext"><pre>49.1121</pre></div></td><td><div class="dni-plaintext"><pre>2123317</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td><div class="dni-plaintext"><pre>22457</pre></div></td><td>ABI.BR</td><td><span>2026-01-26 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>59.0</pre></div></td><td><div class="dni-plaintext"><pre>59.44</pre></div></td><td><div class="dni-plaintext"><pre>58.94</pre></div></td><td><div class="dni-plaintext"><pre>59.0</pre></div></td><td><div class="dni-plaintext"><pre>59.0</pre></div></td><td><div class="dni-plaintext"><pre>836059</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td><div class="dni-plaintext"><pre>21240</pre></div></td><td>ABI.BR</td><td><span>2021-04-28 00:00:00Z</span></td><td><div class="dni-plaintext"><pre>58.09</pre></div></td><td><div class="dni-plaintext"><pre>59.6</pre></div></td><td><div class="dni-plaintext"><pre>58.02</pre></div></td><td><div class="dni-plaintext"><pre>59.0</pre></div></td><td><div class="dni-plaintext"><pre>55.2524</pre></div></td><td><div class="dni-plaintext"><pre>1250347</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>0.0</pre></div></td><td><div class="dni-plaintext"><pre>False</pre></div></td></tr></tbody></table>

#### Microsoft.Data.Analysis | Distinct counts from ValueCounts

For entity-style dedup checks, the quickest MDA path is usually `ValueCounts()` or LINQ `Distinct()` on the key column. That gives you the unique-cardinality view you need even when you do not build a full dataframe-level dedup helper.

_Computes `ValueCounts()` for `symbol`, prints the number of unique tickers relative to the total row count, and previews the first ten unique symbols with their counts._

```csharp
// Microsoft.Data.Analysis — Get unique values and counts using ValueCounts
var symbolCounts = df.Columns["symbol"].ValueCounts();

display($"Unique symbols: {symbolCounts.Rows.Count} (from {df.Rows.Count} total rows)");

// ValueCounts returns a DataFrame with the unique values and their counts
symbolCounts.Head(10)
```

```text
Unique symbols: 50 (from 66355 total rows)
```

<table id="table_639112126240472528"><thead><tr><th><i>index</i></th><th>Values</th><th>Counts</th></tr></thead><tbody><tr><td><i><div class="dni-plaintext"><pre>0</pre></div></i></td><td>ABI.BR</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>1</pre></div></i></td><td>AD.AS</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>2</pre></div></i></td><td>ADS.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>3</pre></div></i></td><td>ADYEN.AS</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>4</pre></div></i></td><td>AI.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>5</pre></div></i></td><td>AIR.PA</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>6</pre></div></i></td><td>ALV.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>7</pre></div></i></td><td>ARGX.BR</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>8</pre></div></i></td><td>ASML.AS</td><td><div class="dni-plaintext"><pre>1331</pre></div></td></tr><tr><td><i><div class="dni-plaintext"><pre>9</pre></div></i></td><td>BAS.DE</td><td><div class="dni-plaintext"><pre>1324</pre></div></td></tr></tbody></table>
