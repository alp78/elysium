---
title: "02 - Explore, Select & Filter - C#"
tags: [csharp, microsoft-data-analysis, polars, dataframes]
aliases:
  - head, tail, describe, filter, where, isin
description: "Polars.NET / Microsoft.Data.Analysis / C# DataFrames reference 02/10 - Explore, Select & Filter (head/tail, describe, where, isin). Executable examples with cell outputs. See [02_py_explore_select_filter](https://alp78.github.io/elysium/03-Dataframes/Dataframes-Python/02_py_explore_select_filter) for the Python equivalent."
created: 2026-03-27
updated: 2026-04-07
status: complete
---

# 02 — Exploration, Selection & Filtering

> [!quote]
> "If we have data, let's look at data. If all we have are opinions, let's go with mine."
>
> — **Jim Barksdale**

This note covers the full exploration, selection, and filtering workflow in C# using Polars.NET and Microsoft.Data.Analysis. It demonstrates previewing data (head, tail, describe), statistical summaries, column selection by name and type, and row filtering using boolean expressions and membership tests on real EuroStoxx 50 data.

## Key terms used in this note

| Term | Definition | Purpose | Common mistake / confusion |
|---|---|---|---|
| **Head / Tail** | Methods returning the first or last *n* rows. Both libraries: `df.Head(n)`, `df.Tail(n)`. | Quick preview without printing the full dataset. | Both return new DataFrames, not views. |
| **Describe** | Summary statistics for columns. Polars.NET: `df.Describe()`. MDA: `df.Description()`. | First-pass quality check — reveals nulls, ranges, and distributions. | MDA `Description()` returns a DataFrame with string-typed statistics — numeric parsing required. |
| **Filter** | Row selection by condition. Polars.NET: `df.Filter(expr)`. MDA: `df.Filter(boolColumn)`. | The primary mechanism for subsetting data by row. | Polars.NET takes an expression (`Col("x").Gt(5)`); MDA takes a `PrimitiveDataFrameColumn<bool>`. |
| **Select** | Column selection. Polars.NET: `df.Select(cols)`. MDA: column indexing `df["col"]`. | Reduces width to needed columns only. | Polars.NET `Select` returns a new DataFrame; MDA indexer returns a single column reference. |

## What this note covers

- **Data preview** — Head, Tail, shape, schema inspection
- **Statistical summaries** — Describe, null counts, value counts, unique counts
- **Column selection** — by name, by index, multi-column patterns
- **Row filtering** — boolean expressions, comparison operators, membership tests, combined conditions

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

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td><span>2021-01-04 00:00:00Z</span></td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>21161</td><td>ABI.BR</td><td><span>2021-01-05 00:00:00Z</span></td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>21162</td><td>ABI.BR</td><td><span>2021-01-06 00:00:00Z</span></td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>21163</td><td>ABI.BR</td><td><span>2021-01-07 00:00:00Z</span></td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>21164</td><td>ABI.BR</td><td><span>2021-01-08 00:00:00Z</span></td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>False</td></tr></tbody></table>

```text
Tail(5):
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>64828</td><td>WKL.AS</td><td><span>2026-03-06 00:00:00Z</span></td><td>69.02</td><td>69.36</td><td>67.82</td><td>68.52</td><td>68.52</td><td>1143729</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>66875</td><td>WKL.AS</td><td><span>2026-03-09 00:00:00Z</span></td><td>68.78</td><td>69.16</td><td>67.64</td><td>68.64</td><td>68.64</td><td>841503</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>66876</td><td>WKL.AS</td><td><span>2026-03-10 00:00:00Z</span></td><td>68.8</td><td>69.16</td><td>66.34</td><td>67.16</td><td>67.16</td><td>1355645</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>66877</td><td>WKL.AS</td><td><span>2026-03-11 00:00:00Z</span></td><td>67.5</td><td>69.6</td><td>67.02</td><td>67.22</td><td>67.22</td><td>1142531</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>66929</td><td>WKL.AS</td><td><span>2026-03-12 00:00:00Z</span></td><td>67.0</td><td>67.54</td><td>66.28</td><td>67.32</td><td>67.32</td><td>210379</td><td>0.0</td><td>0.0</td><td>False</td></tr></tbody></table>

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

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>62110</td><td>ADS.DE</td><td><span>2021-02-03 00:00:00Z</span></td><td>279.9</td><td>279.9</td><td>274.2</td><td>275.0</td><td>262.7958</td><td>405362</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>47784</td><td>BMW.DE</td><td><span>2021-11-24 00:00:00Z</span></td><td>94.23</td><td>94.83</td><td>91.81</td><td>92.49</td><td>70.7878</td><td>1403839</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>65828</td><td>DSY.PA</td><td><span>2024-11-21 00:00:00Z</span></td><td>32.17</td><td>32.28</td><td>31.83</td><td>32.17</td><td>31.921</td><td>845398</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>27022</td><td>EL.PA</td><td><span>2023-03-24 00:00:00Z</span></td><td>158.5725</td><td>158.915</td><td>156.8601</td><td>158.6215</td><td>150.249</td><td>458988</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>43193</td><td>ENI.MI</td><td><span>2024-06-21 00:00:00Z</span></td><td>14.06</td><td>14.156</td><td>13.906</td><td>13.936</td><td>12.5348</td><td>29704326</td><td>0.0</td><td>0.0</td><td>False</td></tr></tbody></table>

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

<table><thead><tr><th>Description</th><th>id</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th></tr></thead><tbody><tr><td>Length (excluding null values)</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td></tr><tr><td>Max</td><td>66930</td><td>&lt;null&gt;</td><td>2926</td><td>2957</td><td>2813</td><td>2839</td><td>2802.9382</td><td>376391550</td><td>22.5</td><td>5</td></tr><tr><td>Min</td><td>1</td><td>&lt;null&gt;</td><td>1.601</td><td>1.6628</td><td>1.5842</td><td>1.6066</td><td>1.2013</td><td>0</td><td>0</td><td>0</td></tr><tr><td>Mean</td><td>33179.734</td><td>&lt;null&gt;</td><td>197.04053</td><td>199.36412</td><td>194.58578</td><td>197.0349</td><td>190.49492</td><td>5942123.5</td><td>0.011756673</td><td>0.00017203268</td></tr></tbody></table>

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

<table><thead><tr><th>Values</th><th>Counts</th></tr></thead><tbody><tr><td>ABI.BR</td><td>1331</td></tr><tr><td>AD.AS</td><td>1331</td></tr><tr><td>ADS.DE</td><td>1324</td></tr><tr><td>ADYEN.AS</td><td>1331</td></tr><tr><td>AI.PA</td><td>1331</td></tr><tr><td>AIR.PA</td><td>1331</td></tr><tr><td>ALV.DE</td><td>1324</td></tr><tr><td>ARGX.BR</td><td>1331</td></tr><tr><td>ASML.AS</td><td>1331</td></tr><tr><td>BAS.DE</td><td>1324</td></tr><tr><td>BAYN.DE</td><td>1324</td></tr><tr><td>BBVA.MC</td><td>1329</td></tr><tr><td>BMW.DE</td><td>1324</td></tr><tr><td>BN.PA</td><td>1331</td></tr><tr><td>BNP.PA</td><td>1331</td></tr><tr><td>CS.PA</td><td>1331</td></tr><tr><td>DB1.DE</td><td>1324</td></tr><tr><td>DG.PA</td><td>1331</td></tr><tr><td>DHL.DE</td><td>1324</td></tr><tr><td>DSY.PA</td><td>1331</td></tr><tr><td>DTE.DE</td><td>1324</td></tr><tr><td>EL.PA</td><td>1331</td></tr><tr><td>ENEL.MI</td><td>1321</td></tr><tr><td>ENI.MI</td><td>1321</td></tr><tr><td>ENR.DE</td><td>1324</td></tr><tr><td>IBE.MC</td><td>1329</td></tr><tr><td>IFX.DE</td><td>1324</td></tr><tr><td>INGA.AS</td><td>1331</td></tr><tr><td>ISP.MI</td><td>1321</td></tr><tr><td>ITX.MC</td><td>1329</td></tr><tr><td>MBG.DE</td><td>1324</td></tr><tr><td>MC.PA</td><td>1331</td></tr><tr><td>MUV2.DE</td><td>1324</td></tr><tr><td>NDA-FI.HE</td><td>1306</td></tr><tr><td>OR.PA</td><td>1331</td></tr><tr><td>PRX.AS</td><td>1331</td></tr><tr><td>RACE.MI</td><td>1321</td></tr><tr><td>RHM.DE</td><td>1324</td></tr><tr><td>RMS.PA</td><td>1331</td></tr><tr><td>SAF.PA</td><td>1331</td></tr><tr><td>SAN.MC</td><td>1329</td></tr><tr><td>SAN.PA</td><td>1331</td></tr><tr><td>SAP.DE</td><td>1324</td></tr><tr><td>SGO.PA</td><td>1331</td></tr><tr><td>SIE.DE</td><td>1324</td></tr><tr><td>SU.PA</td><td>1331</td></tr><tr><td>TTE.PA</td><td>1331</td></tr><tr><td>UCG.MI</td><td>1321</td></tr><tr><td>VOW.DE</td><td>1324</td></tr><tr><td>WKL.AS</td><td>1331</td></tr></tbody></table>

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

<table><thead><tr><th>symbol</th></tr></thead><tbody><tr><td>ABI.BR</td></tr><tr><td>AD.AS</td></tr><tr><td>ADS.DE</td></tr><tr><td>ADYEN.AS</td></tr><tr><td>AI.PA</td></tr><tr><td>AIR.PA</td></tr><tr><td>ALV.DE</td></tr><tr><td>ARGX.BR</td></tr><tr><td>ASML.AS</td></tr><tr><td>BAS.DE</td></tr><tr><td>BAYN.DE</td></tr><tr><td>BBVA.MC</td></tr><tr><td>BMW.DE</td></tr><tr><td>BN.PA</td></tr><tr><td>BNP.PA</td></tr><tr><td>CS.PA</td></tr><tr><td>DB1.DE</td></tr><tr><td>DG.PA</td></tr><tr><td>DHL.DE</td></tr><tr><td>DSY.PA</td></tr><tr><td>DTE.DE</td></tr><tr><td>EL.PA</td></tr><tr><td>ENEL.MI</td></tr><tr><td>ENI.MI</td></tr><tr><td>ENR.DE</td></tr><tr><td>IBE.MC</td></tr><tr><td>IFX.DE</td></tr><tr><td>INGA.AS</td></tr><tr><td>ISP.MI</td></tr><tr><td>ITX.MC</td></tr><tr><td>MBG.DE</td></tr><tr><td>MC.PA</td></tr><tr><td>MUV2.DE</td></tr><tr><td>NDA-FI.HE</td></tr><tr><td>OR.PA</td></tr><tr><td>PRX.AS</td></tr><tr><td>RACE.MI</td></tr><tr><td>RHM.DE</td></tr><tr><td>RMS.PA</td></tr><tr><td>SAF.PA</td></tr><tr><td>SAN.MC</td></tr><tr><td>SAN.PA</td></tr><tr><td>SAP.DE</td></tr><tr><td>SGO.PA</td></tr><tr><td>SIE.DE</td></tr><tr><td>SU.PA</td></tr><tr><td>TTE.PA</td></tr><tr><td>UCG.MI</td></tr><tr><td>VOW.DE</td></tr><tr><td>WKL.AS</td></tr></tbody></table>

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

<table><thead><tr><th>column</th><th>type</th><th>nulls</th><th>unique</th></tr></thead><tbody><tr><td>id</td><td>Int64</td><td>0</td><td>66355</td></tr><tr><td>symbol</td><td>String</td><td>0</td><td>50</td></tr><tr><td>date</td><td>DateTime</td><td>0</td><td>1331</td></tr><tr><td>open</td><td>Decimal</td><td>0</td><td>29671</td></tr><tr><td>high</td><td>Decimal</td><td>0</td><td>31651</td></tr><tr><td>low</td><td>Decimal</td><td>0</td><td>31695</td></tr><tr><td>close</td><td>Decimal</td><td>0</td><td>31505</td></tr><tr><td>adj_close</td><td>Decimal</td><td>0</td><td>57739</td></tr><tr><td>volume</td><td>Int64</td><td>0</td><td>65199</td></tr><tr><td>dividends</td><td>Decimal</td><td>0</td><td>216</td></tr><tr><td>stock_splits</td><td>Decimal</td><td>0</td><td>6</td></tr><tr><td>is_filled</td><td>Boolean</td><td>0</td><td>2</td></tr></tbody></table>

```text
dim_country: (212, 2)
```

<table><thead><tr><th>column</th><th>type</th><th>nulls</th><th>unique</th></tr></thead><tbody><tr><td>country_name</td><td>String</td><td>0</td><td>212</td></tr><tr><td>iso_alpha2</td><td>String</td><td>0</td><td>212</td></tr></tbody></table>

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

<table><thead><tr><th>date</th><th>symbol</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td><span>2021-01-04 00:00:00Z</span></td><td>ABI.BR</td><td>57.21</td><td>1513937</td></tr><tr><td><span>2021-01-05 00:00:00Z</span></td><td>ABI.BR</td><td>57.18</td><td>1382722</td></tr><tr><td><span>2021-01-06 00:00:00Z</span></td><td>ABI.BR</td><td>58.77</td><td>1370204</td></tr><tr><td><span>2021-01-07 00:00:00Z</span></td><td>ABI.BR</td><td>58.4</td><td>1469911</td></tr><tr><td><span>2021-01-08 00:00:00Z</span></td><td>ABI.BR</td><td>57.86</td><td>1428681</td></tr></tbody></table>

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

<table><thead><tr><th>symbol</th><th>price</th><th>range</th></tr></thead><tbody><tr><td>ABI.BR</td><td>57.21</td><td>2.07</td></tr><tr><td>ABI.BR</td><td>57.18</td><td>1.23</td></tr><tr><td>ABI.BR</td><td>58.77</td><td>1.55</td></tr><tr><td>ABI.BR</td><td>58.4</td><td>0.98</td></tr><tr><td>ABI.BR</td><td>57.86</td><td>0.97</td></tr></tbody></table>

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

<table><thead><tr><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>ABI.BR</td><td><span>2021-01-04 00:00:00Z</span></td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td><span>2021-01-05 00:00:00Z</span></td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td><span>2021-01-06 00:00:00Z</span></td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>1370204</td></tr></tbody></table>

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

<table><thead><tr><th>open</th><th>high</th><th>low</th><th>close</th></tr></thead><tbody><tr><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td></tr><tr><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td></tr><tr><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td></tr><tr><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td></tr><tr><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td></tr></tbody></table>

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

<table><thead><tr><th>ticker</th><th>price</th><th>vol</th></tr></thead><tbody><tr><td>ABI.BR</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>58.77</td><td>1370204</td></tr></tbody></table>

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

<table><thead><tr><th>symbol</th><th>date</th><th>volume</th><th>open</th><th>high</th><th>low</th><th>close</th></tr></thead><tbody><tr><td>ABI.BR</td><td><span>2021-01-04 00:00:00Z</span></td><td>1513937</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td></tr><tr><td>ABI.BR</td><td><span>2021-01-05 00:00:00Z</span></td><td>1382722</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td></tr><tr><td>ABI.BR</td><td><span>2021-01-06 00:00:00Z</span></td><td>1370204</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td></tr></tbody></table>

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

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>60763</td><td>ADYEN.AS</td><td><span>2021-01-04 00:00:00Z</span></td><td>1900.0</td><td>1921.5</td><td>1856.0</td><td>1859.5</td><td>1859.5</td><td>99408</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>60764</td><td>ADYEN.AS</td><td><span>2021-01-05 00:00:00Z</span></td><td>1848.5</td><td>1857.0</td><td>1814.0</td><td>1829.0</td><td>1829.0</td><td>86256</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>60765</td><td>ADYEN.AS</td><td><span>2021-01-06 00:00:00Z</span></td><td>1822.0</td><td>1824.0</td><td>1706.5</td><td>1733.0</td><td>1733.0</td><td>156844</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>60766</td><td>ADYEN.AS</td><td><span>2021-01-07 00:00:00Z</span></td><td>1735.0</td><td>1754.0</td><td>1708.5</td><td>1714.5</td><td>1714.5</td><td>90183</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>60767</td><td>ADYEN.AS</td><td><span>2021-01-08 00:00:00Z</span></td><td>1730.0</td><td>1764.5</td><td>1715.0</td><td>1756.5</td><td>1756.5</td><td>97176</td><td>0.0</td><td>0.0</td><td>False</td></tr></tbody></table>

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

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>136</td><td>ASML.AS</td><td><span>2021-07-14 00:00:00Z</span></td><td>599.5</td><td>611.8</td><td>597.2</td><td>609.1</td><td>582.9708</td><td>641585</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>142</td><td>ASML.AS</td><td><span>2021-07-22 00:00:00Z</span></td><td>610.0</td><td>625.9</td><td>608.2</td><td>620.8</td><td>594.169</td><td>788099</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>143</td><td>ASML.AS</td><td><span>2021-07-23 00:00:00Z</span></td><td>622.9</td><td>639.0</td><td>617.5</td><td>638.8</td><td>611.3967</td><td>833737</td><td>0.0</td><td>0.0</td><td>False</td></tr></tbody></table>

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

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>1</td><td>ASML.AS</td><td><span>2021-01-04 00:00:00Z</span></td><td>404.0</td><td>411.0</td><td>402.25</td><td>406.25</td><td>387.709</td><td>789502</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>2</td><td>ASML.AS</td><td><span>2021-01-05 00:00:00Z</span></td><td>406.55</td><td>412.05</td><td>401.15</td><td>406.9</td><td>388.3294</td><td>798787</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>3</td><td>ASML.AS</td><td><span>2021-01-06 00:00:00Z</span></td><td>406.8</td><td>407.2</td><td>399.2</td><td>402.85</td><td>384.4644</td><td>875711</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>4</td><td>ASML.AS</td><td><span>2021-01-07 00:00:00Z</span></td><td>404.8</td><td>407.8</td><td>400.35</td><td>403.9</td><td>385.4664</td><td>874780</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>5</td><td>ASML.AS</td><td><span>2021-01-08 00:00:00Z</span></td><td>414.25</td><td>419.1</td><td>413.4</td><td>416.05</td><td>397.0618</td><td>975243</td><td>0.0</td><td>0.0</td><td>False</td></tr></tbody></table>

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

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>62387</td><td>ADS.DE</td><td><span>2022-03-04 00:00:00Z</span></td><td>196.5</td><td>197.64</td><td>187.0</td><td>187.0</td><td>180.5918</td><td>1319891</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>62388</td><td>ADS.DE</td><td><span>2022-03-07 00:00:00Z</span></td><td>177.1</td><td>183.4</td><td>170.08</td><td>176.9</td><td>170.8379</td><td>2345656</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>62389</td><td>ADS.DE</td><td><span>2022-03-08 00:00:00Z</span></td><td>172.18</td><td>187.06</td><td>172.0</td><td>184.94</td><td>178.6024</td><td>1937346</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>62391</td><td>ADS.DE</td><td><span>2022-03-10 00:00:00Z</span></td><td>211.35</td><td>211.8</td><td>196.68</td><td>197.08</td><td>190.3264</td><td>1375129</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>62415</td><td>ADS.DE</td><td><span>2022-04-13 00:00:00Z</span></td><td>198.52</td><td>199.74</td><td>194.16</td><td>197.76</td><td>190.9831</td><td>755573</td><td>0.0</td><td>0.0</td><td>False</td></tr></tbody></table>

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

<table><thead><tr><th>symbol</th></tr></thead><tbody><tr><td>AI.PA</td></tr><tr><td>AIR.PA</td></tr><tr><td>BN.PA</td></tr><tr><td>BNP.PA</td></tr><tr><td>CS.PA</td></tr><tr><td>DG.PA</td></tr><tr><td>DSY.PA</td></tr><tr><td>EL.PA</td></tr><tr><td>MC.PA</td></tr><tr><td>OR.PA</td></tr><tr><td>RMS.PA</td></tr><tr><td>SAF.PA</td></tr><tr><td>SAN.PA</td></tr><tr><td>SGO.PA</td></tr><tr><td>SU.PA</td></tr><tr><td>TTE.PA</td></tr></tbody></table>

```text
Symbol contains BN: 2662 rows
```

<table><thead><tr><th>symbol</th></tr></thead><tbody><tr><td>BN.PA</td></tr><tr><td>BNP.PA</td></tr></tbody></table>

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

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21930</td><td>ABI.BR</td><td><span>2024-01-02 00:00:00Z</span></td><td>58.72</td><td>58.95</td><td>58.17</td><td>58.77</td><td>56.7582</td><td>1049145</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>21931</td><td>ABI.BR</td><td><span>2024-01-03 00:00:00Z</span></td><td>58.64</td><td>59.34</td><td>58.24</td><td>58.37</td><td>56.3719</td><td>1247000</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>21932</td><td>ABI.BR</td><td><span>2024-01-04 00:00:00Z</span></td><td>58.36</td><td>58.92</td><td>58.3</td><td>58.81</td><td>56.7968</td><td>1009526</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>21933</td><td>ABI.BR</td><td><span>2024-01-05 00:00:00Z</span></td><td>58.26</td><td>58.91</td><td>58.16</td><td>58.86</td><td>56.8451</td><td>1236000</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>21934</td><td>ABI.BR</td><td><span>2024-01-08 00:00:00Z</span></td><td>58.47</td><td>59.5</td><td>58.39</td><td>59.38</td><td>57.3473</td><td>1033238</td><td>0.0</td><td>0.0</td><td>False</td></tr></tbody></table>

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

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td><span>2021-01-04 00:00:00Z</span></td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>False</td></tr></tbody></table>

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

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21260</td><td>ABI.BR</td><td><span>2021-05-26 00:00:00Z</span></td><td>61.99</td><td>62.39</td><td>61.83</td><td>62.12</td><td>58.6701</td><td>940186</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>21261</td><td>ABI.BR</td><td><span>2021-05-27 00:00:00Z</span></td><td>61.8</td><td>62.64</td><td>61.73</td><td>62.13</td><td>58.6795</td><td>1796477</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>21262</td><td>ABI.BR</td><td><span>2021-05-28 00:00:00Z</span></td><td>62.14</td><td>62.58</td><td>61.96</td><td>62.34</td><td>58.8779</td><td>1004125</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>21263</td><td>ABI.BR</td><td><span>2021-05-31 00:00:00Z</span></td><td>62.27</td><td>62.31</td><td>61.51</td><td>61.56</td><td>58.1412</td><td>851557</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>21264</td><td>ABI.BR</td><td><span>2021-06-01 00:00:00Z</span></td><td>62.35</td><td>62.48</td><td>61.98</td><td>62.38</td><td>58.9157</td><td>1171646</td><td>0.0</td><td>0.0</td><td>False</td></tr></tbody></table>

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

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>3708</td><td>RMS.PA</td><td><span>2025-02-14 00:00:00Z</span></td><td>2926.0</td><td>2957.0</td><td>2813.0</td><td>2839.0</td><td>2802.9382</td><td>105651</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>3707</td><td>RMS.PA</td><td><span>2025-02-13 00:00:00Z</span></td><td>2770.0</td><td>2816.0</td><td>2765.0</td><td>2816.0</td><td>2780.2302</td><td>80087</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>3709</td><td>RMS.PA</td><td><span>2025-02-17 00:00:00Z</span></td><td>2825.0</td><td>2858.0</td><td>2803.0</td><td>2809.0</td><td>2776.7424</td><td>53852</td><td>3.5</td><td>0.0</td><td>False</td></tr><tr><td>3710</td><td>RMS.PA</td><td><span>2025-02-18 00:00:00Z</span></td><td>2816.0</td><td>2827.0</td><td>2780.0</td><td>2806.0</td><td>2773.7771</td><td>65469</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>60927</td><td>ADYEN.AS</td><td><span>2021-08-24 00:00:00Z</span></td><td>2725.0</td><td>2766.0</td><td>2711.5</td><td>2766.0</td><td>2766.0</td><td>61431</td><td>0.0</td><td>0.0</td><td>False</td></tr></tbody></table>

```text
Sort by symbol ASC, then close DESC:
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21512</td><td>ABI.BR</td><td><span>2022-05-17 00:00:00Z</span></td><td>54.65</td><td>55.18</td><td>53.96</td><td>54.44</td><td>51.9</td><td>1092579</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>21814</td><td>ABI.BR</td><td><span>2023-07-19 00:00:00Z</span></td><td>51.59</td><td>52.15</td><td>51.34</td><td>52.0</td><td>50.2199</td><td>1228208</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>21408</td><td>ABI.BR</td><td><span>2021-12-20 00:00:00Z</span></td><td>51.69</td><td>52.32</td><td>50.71</td><td>52.0</td><td>49.1121</td><td>2123317</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>22457</td><td>ABI.BR</td><td><span>2026-01-26 00:00:00Z</span></td><td>59.0</td><td>59.44</td><td>58.94</td><td>59.0</td><td>59.0</td><td>836059</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td>21240</td><td>ABI.BR</td><td><span>2021-04-28 00:00:00Z</span></td><td>58.09</td><td>59.6</td><td>58.02</td><td>59.0</td><td>55.2524</td><td>1250347</td><td>0.0</td><td>0.0</td><td>False</td></tr></tbody></table>

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

<table><thead><tr><th>Values</th><th>Counts</th></tr></thead><tbody><tr><td>ABI.BR</td><td>1331</td></tr><tr><td>AD.AS</td><td>1331</td></tr><tr><td>ADS.DE</td><td>1324</td></tr><tr><td>ADYEN.AS</td><td>1331</td></tr><tr><td>AI.PA</td><td>1331</td></tr><tr><td>AIR.PA</td><td>1331</td></tr><tr><td>ALV.DE</td><td>1324</td></tr><tr><td>ARGX.BR</td><td>1331</td></tr><tr><td>ASML.AS</td><td>1331</td></tr><tr><td>BAS.DE</td><td>1324</td></tr></tbody></table>

---

## Warnings

> [!warning] MDA `Filter` requires an explicit boolean column, not an expression
> Unlike Polars.NET where `df.Filter(Col("x").Gt(5))` works directly, MDA requires constructing a `PrimitiveDataFrameColumn<bool>` first — more verbose and error-prone.

> [!warning] Column selection by string index in MDA returns a reference, not a copy
> `df["col"]` in MDA returns a reference to the column — mutations propagate to the original DataFrame.

## Recommendations

1. **Profile before transforming** — run `Describe()`, null counts, and unique counts on every new dataset.
2. **Filter early** — reduce row count before expensive operations (joins, group_by).
3. **Prefer Polars.NET expressions for complex filters** — the expression API is more composable and readable than MDA's manual boolean column construction.
4. **Validate column existence before selection** — check `df.Columns` to avoid runtime `KeyNotFoundException`.

## Troubleshooting and failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `KeyNotFoundException` on column select | Column name not in DataFrame | Check `df.Columns` or `df.Schema` before selecting |
| Filter returns empty DataFrame | Condition too restrictive or type mismatch in comparison | Verify filter values match column dtype |
| `Describe()` missing columns | MDA excludes non-numeric columns by default | Handle separately with manual aggregation |

