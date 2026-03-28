---
type: reference
category: programming-languages
technology:
  - csharp
  - dotnet
  - polars
tags: [pipeline, csharp, polars, dataframes]
aliases:
  - lazy evaluation, query optimization, benchmarks
keywords: [lazy, collect, scan_csv, scan_parquet, query plan, optimization, streaming, benchmark, performance]
description: "Polars.NET / C# DataFrames reference 06/10 — Lazy API & Performance (lazy/collect, query plan, benchmarks). Executable examples with cell outputs. See [[06_py_lazy_performance]] for the Python equivalent."
related:
  - "[[dataframes-index]]"
  - "[[programming-languages-index]]"
  - "[[06_py_lazy_performance]]"
  - "[[05_cs_aggregation_reshaping]]"
  - "[[07_cs_types_interop]]"
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# 06 — Lazy API & Performance

Polars.NET lazy execution, optimization, benchmarks. Deedle is eager-only.

---
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

#### Setup — Install NuGet packages and configure formatters

```csharp
#r "nuget: Polars.NET, 0.4.0"
#r "nuget: Polars.NET.Native.win-x64, 0.4.0"

using System.IO;
using System.Linq;
using System.Diagnostics;
using Polars.CSharp;
using static Polars.CSharp.Polars;
using Microsoft.DotNet.Interactive.Formatting;

Formatter.Register<DataFrame>((df, writer) =>
{
    var html = df.ToHtml();
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

---
## Lazy Fundamentals

Polars has two execution modes:

- **Eager** — operations execute immediately and return a `DataFrame`.
- **Lazy** — operations build a query plan (a `LazyFrame`) that only executes when you call `.Collect()`.

The lazy API lets Polars optimize the entire query plan *before* touching any data: reordering filters, eliminating unused columns, and pushing predicates down to the file scanner.

#### Scan Parquet (lazy): no data loaded until Collect

```csharp
// Polars.NET — ScanParquet returns a LazyFrame (no data read yet)
var parquetPath = Path.Combine(DATA, "eurostoxx50_ohlcv.parquet");
var lf = LazyFrame.ScanParquet(parquetPath);

// Polars.NET — the LazyFrame is just a query plan, not materialized data
Console.WriteLine($"Type: {lf.GetType().Name}");
Console.WriteLine("No data has been loaded yet — just a query plan.");
```

    Type: LazyFrame
    No data has been loaded yet — just a query plan.

#### Lazy from eager: convert an existing DataFrame

```csharp
// Polars.NET — read CSV eagerly, then convert to lazy
var dfEager = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"));
Console.WriteLine($"Eager DataFrame shape: {dfEager.Shape}");

// Polars.NET — .Lazy() converts DataFrame to LazyFrame
var lfFromEager = dfEager.Lazy();
Console.WriteLine($"LazyFrame type: {lfFromEager.GetType().Name}");
Console.WriteLine("Eager -> Lazy conversion is free (no copy).");
```

    Eager DataFrame shape: (66355, 12)
    LazyFrame type: LazyFrame
    Eager -> Lazy conversion is free (no copy).

#### Collect: materialize the query plan

```csharp
// Polars.NET — Collect() executes the query plan and returns a DataFrame
var result = lf.Collect();
Console.WriteLine($"Collected shape: {result.Shape}");

result.Head(5)
```

    Collected shape: (66355, 12)

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

#### Explain: inspect the optimized query plan

> [!info] `Explain()` shows the optimized query plan as a string. It may not be exposed in Polars.NET 0.4.0 — the code catches the exception and notes the limitation.

```csharp
try
{
    var lfExplain = LazyFrame.ScanParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"));
    var plan = lfExplain.Explain();
    Console.WriteLine("Optimized query plan:");
    Console.WriteLine(plan);
}
catch (Exception ex)
{
    Console.WriteLine($"Explain() not available in Polars.NET 0.4.0: {ex.GetType().Name}");
    Console.WriteLine("Use .Collect() to execute — optimization still happens internally.");
}
```

    Optimized query plan:
    Parquet SCAN [../data/eurostoxx50_ohlcv.parquet]
    PROJECT */12 COLUMNS
    ESTIMATED ROWS: 66355

---
## Query Optimization

When you build a lazy query, Polars applies **automatic optimizations** before execution:

- **Predicate pushdown** — filters move as early as possible, even into the file scanner.
- **Projection pushdown** — only columns that are actually used get read from disk.
- **Common subexpression elimination** — duplicate computations are evaluated once.

These happen transparently. You write clear, readable code; Polars figures out the fastest plan.

#### Predicate pushdown: filter before reading all data

```csharp
// Polars.NET — filter in lazy mode: Polars pushes the predicate into the scan
var lfFiltered = LazyFrame.ScanParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"))
    .Filter(Col("symbol") == Lit("SAP.DE"));

// Polars.NET — Collect materializes only matching rows
var dfFiltered = lfFiltered.Collect();
Console.WriteLine($"Rows matching symbol='SAP.DE': {dfFiltered.Shape}");

dfFiltered.Head(5)
```

    Rows matching symbol='SAP.DE': (1324, 12)

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
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 12 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>id<span class='pl-dtype'>int64</span></th><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>adj_close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>dividends<span class='pl-dtype'>double</span></th><th>stock_splits<span class='pl-dtype'>double</span></th><th>is_filled<span class='pl-dtype'>bool</span></th></tr></thead><tbody><tr><td>5301</td><td>SAP.DE</td><td>2021-01-04</td><td>108.1</td><td>108.5</td><td>104.78</td><td>105.32</td><td>97.0102</td><td>2928515</td><td>0</td><td>0</td><td>false</td></tr><tr><td>5302</td><td>SAP.DE</td><td>2021-01-05</td><td>104.98</td><td>106.2</td><td>104.46</td><td>105.04</td><td>96.7523</td><td>2798888</td><td>0</td><td>0</td><td>false</td></tr><tr><td>5303</td><td>SAP.DE</td><td>2021-01-06</td><td>105.14</td><td>106.26</td><td>103.6</td><td>105.48</td><td>97.1576</td><td>3018802</td><td>0</td><td>0</td><td>false</td></tr><tr><td>5304</td><td>SAP.DE</td><td>2021-01-07</td><td>105.58</td><td>105.7</td><td>104.04</td><td>104.52</td><td>96.2734</td><td>3176143</td><td>0</td><td>0</td><td>false</td></tr><tr><td>5305</td><td>SAP.DE</td><td>2021-01-08</td><td>105.14</td><td>106.72</td><td>105.04</td><td>106.18</td><td>97.8024</td><td>3068744</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Projection pushdown: select only needed columns

```csharp
// Polars.NET — select in lazy mode: only requested columns are read from parquet
var lfProjected = LazyFrame.ScanParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"))
    .Select(Col("symbol"), Col("date"), Col("close"), Col("volume"));

// Polars.NET — Collect reads only 4 columns from the file, not all 12
var dfProjected = lfProjected.Collect();
Console.WriteLine($"Projected shape: {dfProjected.Shape} (only 4 of 12 columns read)");

dfProjected.Head(5)
```

    Projected shape: (66355, 4) (only 4 of 12 columns read)

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
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 4 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>1370204</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>1469911</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>1428681</td></tr></tbody></table></div>

#### Combined: filter + select + sort in a single lazy query

```csharp
// Polars.NET — chain filter, select, sort in lazy mode
// Polars optimizes the entire pipeline before execution
var lfCombined = LazyFrame.ScanParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"))
    .Filter(Col("volume") > Lit(5_000_000))
    .Select(Col("symbol"), Col("date"), Col("close"), Col("volume"))
    .Sort("volume", true);  // descending

var dfCombined = lfCombined.Collect();
Console.WriteLine($"High-volume trades: {dfCombined.Shape}");

dfCombined.Head(10)
```

    High-volume trades: (14330, 4)

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
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 4 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>ISP.MI</td><td>2023-08-08</td><td>2.338</td><td>376391539</td></tr><tr><td>SAN.MC</td><td>2021-10-20</td><td>3.36</td><td>367211467</td></tr><tr><td>ISP.MI</td><td>2023-05-31</td><td>2.1555</td><td>317362978</td></tr><tr><td>ISP.MI</td><td>2023-03-13</td><td>2.3305</td><td>311886033</td></tr><tr><td>SAN.MC</td><td>2021-11-03</td><td>3.31</td><td>306973344</td></tr><tr><td>SAN.MC</td><td>2022-10-19</td><td>2.6345</td><td>304539953</td></tr><tr><td>ISP.MI</td><td>2022-03-07</td><td>1.8432</td><td>286679922</td></tr><tr><td>ISP.MI</td><td>2021-02-03</td><td>1.9512</td><td>284805919</td></tr><tr><td>ISP.MI</td><td>2022-03-09</td><td>2.0725</td><td>284368758</td></tr><tr><td>ISP.MI</td><td>2023-03-15</td><td>2.2435</td><td>282185531</td></tr></tbody></table></div>

#### Lazy GroupBy with aggregation

```csharp
// Polars.NET — lazy GroupBy + Agg, all optimized before execution
var lfGrouped = LazyFrame.ScanParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"))
    .GroupBy("symbol")
    .Agg(
        Col("close").Mean().Alias("avg_close"),
        Col("volume").Sum().Alias("total_volume"),
        Col("close").Count().Alias("num_days")
    )
    .Sort("total_volume", true);

var dfGrouped = lfGrouped.Collect();
Console.WriteLine($"Grouped result: {dfGrouped.Shape}");

dfGrouped.Head(10)
```

    Grouped result: (50, 4)

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
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 4 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>avg_close<span class='pl-dtype'>double</span></th><th>total_volume<span class='pl-dtype'>int64</span></th><th>num_days<span class='pl-dtype'>uint32</span></th></tr></thead><tbody><tr><td>ISP.MI</td><td>3.147987207</td><td>115704541969</td><td>1321</td></tr><tr><td>SAN.MC</td><td>4.42584763</td><td>55513641918</td><td>1329</td></tr><tr><td>ENEL.MI</td><td>6.820438304</td><td>32600561934</td><td>1321</td></tr><tr><td>BBVA.MC</td><td>8.651954101</td><td>22133773194</td><td>1329</td></tr><tr><td>UCG.MI</td><td>28.45710447</td><td>18366801099</td><td>1321</td></tr><tr><td>ENI.MI</td><td>13.39762453</td><td>17141570967</td><td>1321</td></tr><tr><td>INGA.AS</td><td>14.03818783</td><td>17041577555</td><td>1331</td></tr><tr><td>IBE.MC</td><td>12.25531151</td><td>15994295949</td><td>1329</td></tr><tr><td>DTE.DE</td><td>22.43009743</td><td>10029411390</td><td>1324</td></tr><tr><td>NDA-FI.HE</td><td>10.84807887</td><td>7020342991</td><td>1306</td></tr></tbody></table></div>

#### Lazy WithColumns: add computed columns

```csharp
// Polars.NET — WithColumns in lazy mode adds new expressions
var lfWithCols = LazyFrame.ScanParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"))
    .Filter(Col("symbol") == Lit("SAP.DE"))
    .WithColumns(
        (Col("high") - Col("low")).Alias("daily_range"),
        (Col("close") - Col("open")).Alias("daily_change")
    )
    .Select(Col("date"), Col("open"), Col("close"), Col("daily_range"), Col("daily_change"));

var dfWithCols = lfWithCols.Collect();
Console.WriteLine($"With computed columns: {dfWithCols.Shape}");

dfWithCols.Head(5)
```

    With computed columns: (1324, 5)

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
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 5 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>daily_range<span class='pl-dtype'>double</span></th><th>daily_change<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>2021-01-04</td><td>108.1</td><td>105.32</td><td>3.72</td><td>-2.78</td></tr><tr><td>2021-01-05</td><td>104.98</td><td>105.04</td><td>1.74</td><td>0.06</td></tr><tr><td>2021-01-06</td><td>105.14</td><td>105.48</td><td>2.66</td><td>0.34</td></tr><tr><td>2021-01-07</td><td>105.58</td><td>104.52</td><td>1.66</td><td>-1.06</td></tr><tr><td>2021-01-08</td><td>105.14</td><td>106.18</td><td>1.68</td><td>1.04</td></tr></tbody></table></div>

---
## Performance Comparison

We compare **eager** vs **lazy** execution on real data to measure the impact of query optimization.

- **Eager**: read the entire file into memory, then filter and select.
- **Lazy**: scan the file, apply filter + select, then collect — Polars only reads what it needs.

We use `Stopwatch` for timing and average over multiple iterations to reduce noise.

#### Helper: benchmark runner

```csharp
// Polars.NET — simple benchmark helper using Stopwatch
static (double avgMs, double minMs, double maxMs) Benchmark(Action action, int warmup = 2, int iterations = 5)
{
    // Polars.NET — warmup runs to stabilize JIT and caching
    for (int i = 0; i < warmup; i++)
        action();

    var times = new double[iterations];
    var sw = new Stopwatch();

    for (int i = 0; i < iterations; i++)
    {
        sw.Restart();
        action();
        sw.Stop();
        times[i] = sw.Elapsed.TotalMilliseconds;
    }

    return (times.Average(), times.Min(), times.Max());
}

Console.WriteLine("Benchmark helper defined.");
```

    Benchmark helper defined.

#### Eager vs Lazy: Parquet read + filter + select

```csharp
// Polars.NET — benchmark on bench_large.parquet (~12M rows)
var benchPath = Path.Combine(DATA, "bench_large.parquet");
Console.WriteLine($"Benchmark file: {benchPath}");

// Polars.NET — Eager: read all data, then filter and select
var (eagerAvg, eagerMin, eagerMax) = Benchmark(() =>
{
    var df = DataFrame.ReadParquet(benchPath);
    var filtered = df.Filter(Col("exchange") == Lit("XAMS"));
    var selected = filtered.Select(Col("symbol"), Col("date"), Col("price"), Col("size"));
}, warmup: 1, iterations: 3);

Console.WriteLine($"EAGER  — avg: {eagerAvg:F1} ms  (min: {eagerMin:F1}, max: {eagerMax:F1})");

// Polars.NET — Lazy: scan + filter + select + collect (optimized)
var (lazyAvg, lazyMin, lazyMax) = Benchmark(() =>
{
    var df = LazyFrame.ScanParquet(benchPath)
        .Filter(Col("exchange") == Lit("XAMS"))
        .Select(Col("symbol"), Col("date"), Col("price"), Col("size"))
        .Collect();
}, warmup: 1, iterations: 3);

Console.WriteLine($"LAZY   — avg: {lazyAvg:F1} ms  (min: {lazyMin:F1}, max: {lazyMax:F1})");

var speedup = eagerAvg / lazyAvg;
Console.WriteLine($"\nLazy is ~{speedup:F1}x faster than eager on this query.");
```

    Benchmark file: ..\data\bench_large.parquet
    EAGER  — avg: 141.5 ms  (min: 99.1, max: 218.3)
    LAZY   — avg: 15.8 ms  (min: 15.1, max: 16.2)
    
    Lazy is ~9.0x faster than eager on this query.

#### Eager vs Lazy: CSV read + filter + select

```csharp
// Polars.NET — benchmark CSV: eager vs lazy
// NOTE: LazyFrame.ScanCsv may not exist in 0.4.0. If not, we show eager-only CSV.
var csvBenchPath = Path.Combine(DATA, "bench_medium.csv");
Console.WriteLine($"CSV benchmark file: {csvBenchPath} (~2.5M rows)");

// Polars.NET — Eager CSV: read everything, then filter
var (csvEagerAvg, csvEagerMin, csvEagerMax) = Benchmark(() =>
{
    var df = DataFrame.ReadCsv(csvBenchPath);
    var filtered = df.Filter(Col("symbol") == Lit("ASML.AS"));
    var selected = filtered.Select(Col("symbol"), Col("date"), Col("close"), Col("volume"));
}, warmup: 1, iterations: 3);

Console.WriteLine($"EAGER CSV  — avg: {csvEagerAvg:F1} ms  (min: {csvEagerMin:F1}, max: {csvEagerMax:F1})");

// Polars.NET — Lazy CSV: ScanCsv if available
try
{
    var (csvLazyAvg, csvLazyMin, csvLazyMax) = Benchmark(() =>
    {
        var df = LazyFrame.ScanCsv(csvBenchPath)
            .Filter(Col("symbol") == Lit("ASML.AS"))
            .Select(Col("symbol"), Col("date"), Col("close"), Col("volume"))
            .Collect();
    }, warmup: 1, iterations: 3);

    Console.WriteLine($"LAZY  CSV  — avg: {csvLazyAvg:F1} ms  (min: {csvLazyMin:F1}, max: {csvLazyMax:F1})");
    Console.WriteLine($"\nLazy CSV speedup: ~{csvEagerAvg / csvLazyAvg:F1}x");
}
catch (Exception ex)
{
    Console.WriteLine($"ScanCsv not available: {ex.GetType().Name}");
    Console.WriteLine("For CSV, use eager ReadCsv + .Lazy() for downstream optimizations.");

    // Polars.NET — alternative: eager read then lazy pipeline
    var (csvHybridAvg, _, _) = Benchmark(() =>
    {
        var df = DataFrame.ReadCsv(csvBenchPath)
            .Lazy()
            .Filter(Col("symbol") == Lit("ASML.AS"))
            .Select(Col("symbol"), Col("date"), Col("close"), Col("volume"))
            .Collect();
    }, warmup: 1, iterations: 3);

    Console.WriteLine($"HYBRID CSV (ReadCsv + .Lazy()) — avg: {csvHybridAvg:F1} ms");
    Console.WriteLine("No speedup for CSV reads — the scan cost dominates. Use Parquet for best lazy perf.");
}
```

    CSV benchmark file: ..\data\bench_medium.csv (~2.5M rows)
    EAGER CSV  — avg: 103.8 ms  (min: 102.4, max: 105.5)
    LAZY  CSV  — avg: 76.8 ms  (min: 75.1, max: 77.7)
    
    Lazy CSV speedup: ~1.4x

#### Projection pushdown impact: all columns vs selected columns

```csharp
// Polars.NET — measure projection pushdown benefit on parquet
var projPath = Path.Combine(DATA, "bench_large.parquet");

// Polars.NET — read all 12 columns
var (allColsAvg, _, _) = Benchmark(() =>
{
    var df = LazyFrame.ScanParquet(projPath).Collect();
}, warmup: 1, iterations: 3);

// Polars.NET — read only 2 columns via projection pushdown
var (twoColsAvg, _, _) = Benchmark(() =>
{
    var df = LazyFrame.ScanParquet(projPath)
        .Select(Col("symbol"), Col("price"))
        .Collect();
}, warmup: 1, iterations: 3);

Console.WriteLine($"All 12 columns — avg: {allColsAvg:F1} ms");
Console.WriteLine($"Only 2 columns — avg: {twoColsAvg:F1} ms");
Console.WriteLine($"\nProjection pushdown saves ~{(1 - twoColsAvg / allColsAvg) * 100:F0}% read time.");
```

    All 12 columns — avg: 73.4 ms
    Only 2 columns — avg: 17.7 ms
    
    Projection pushdown saves ~76% read time.

#### Summary table

```csharp
// Polars.NET — build a summary DataFrame from benchmark results
var summaryDf = new DataFrame(new Polars.CSharp.Series[]
{
    Polars.CSharp.Series.From("approach", new[] { "Eager Parquet", "Lazy Parquet", "Lazy 2-col Parquet" }),
    Polars.CSharp.Series.From("avg_ms", new[] { eagerAvg, lazyAvg, twoColsAvg }),
    Polars.CSharp.Series.From("vs_eager", new[] { 1.0, eagerAvg / lazyAvg, eagerAvg / twoColsAvg })
});

summaryDf
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
</style><div class='pl-dim'>Polars DataFrame: <b>(3 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>approach<span class='pl-dtype'>utf8view</span></th><th>avg_ms<span class='pl-dtype'>double</span></th><th>vs_eager<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>Eager Parquet</td><td>141.5324667</td><td>1</td></tr><tr><td>Lazy Parquet</td><td>15.79983333</td><td>8.957845547</td></tr><tr><td>Lazy 2-col Parquet</td><td>17.7476</td><td>7.974738368</td></tr></tbody></table></div>

---
## Deedle Note

**Deedle is eager-only.** All data is loaded into memory immediately when you read a file. There is no lazy execution mode, no query plan, and no automatic optimization.

For large datasets, Polars.NET's lazy evaluation with predicate and projection pushdown is significantly faster:

- **Predicate pushdown** — filters move into the file reader, so unmatched rows are never materialized.
- **Projection pushdown** — unneeded columns are skipped entirely during the Parquet scan.
- **Query optimization** — the entire pipeline is rewritten for efficiency before any data moves.

If your workflow fits in memory and you only need basic operations, Deedle works fine. For analytical queries on larger-than-memory data, Polars.NET's lazy API is the right tool.

---
## Summary

#### Lazy API cheat sheet

| Operation | Syntax | Notes |
|---|---|---|
| Scan Parquet | `LazyFrame.ScanParquet(path)` | Returns `LazyFrame`, no data read |
| Scan CSV | `LazyFrame.ScanCsv(path)` | May not exist in 0.4.0; use `ReadCsv` + `.Lazy()` |
| Eager to lazy | `df.Lazy()` | Free conversion, no data copy |
| Collect | `lf.Collect()` | Materializes query plan into `DataFrame` |
| Explain | `lf.Explain()` | Print optimized plan (if available) |
| Filter (lazy) | `lf.Filter(Col("x") > Lit(5))` | Predicate pushdown applies |
| Select (lazy) | `lf.Select(Col("a"), Col("b"))` | Projection pushdown applies |
| Sort (lazy) | `lf.Sort("col", descending)` | Single column per call |
| GroupBy (lazy) | `lf.GroupBy("col").Agg(...)` | Same Agg syntax as eager |
| WithColumns (lazy) | `lf.WithColumns(expr.Alias("name"))` | Add/replace columns in plan |

#### Key takeaways

- **Always prefer `ScanParquet` over `ReadParquet`** when you plan to filter or select — predicate and projection pushdown avoid reading unnecessary data.
- **Chain operations lazily** — let Polars optimize the full pipeline before execution.
- **Parquet > CSV for lazy** — Parquet's columnar format enables true projection pushdown; CSV must still be fully scanned.
- **Deedle has no lazy mode** — every operation is immediate and loads all data.
