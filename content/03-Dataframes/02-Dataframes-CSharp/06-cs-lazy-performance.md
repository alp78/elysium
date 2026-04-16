---
title: "06 - Lazy API and Performance - C#"
tags: [csharp, polars, dataframes]
aliases:
  - lazy evaluation, query optimization, benchmarks
description: "Polars.NET / C# DataFrames reference 06/10 — Lazy API & Performance (lazy/collect, query plan, benchmarks). Executable examples with cell outputs. See [06_py_lazy_performance](https://alp78.github.io/elysium/03-Dataframes/Dataframes-Python/06_py_lazy_performance) for the Python equivalent."
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# Lazy API and Performance - C#

> [!quote]- Epigraph
>
> "Premature optimization is the root of all evil."
>
> — **Donald Knuth**, *Structured Programming with go to Statements* (1974)
>
> "The First Rule of Program Optimization: Don't do it. The Second Rule of Program Optimization (for experts only): Don't do it yet."
>
> — **Michael A. Jackson**, *Principles of Program Design* (1975)

> [!abstract]- Summary
>
> Explains how lazy execution changes dataframe performance in C#, focusing on Polars.NET `LazyFrame` planning, collection boundaries, query-plan inspection, and scan-time pushdown behavior. The note exists to separate two questions that are often conflated: whether a dataframe operation is correct, and whether the engine is allowed to avoid unnecessary reads, columns, materializations, and passes over the data.
>
> **Setup**
> - Configure the notebook runtime, load Polars.NET and its native runtime package, and prepare the shared benchmark and Parquet inputs used throughout the note
>
> **Lazy Fundamentals**
> - Contrast eager and lazy execution, show how `DataFrame.Lazy()` and scan-based entry points create `LazyFrame` plans, and make `.Collect()` the explicit execution boundary
> - Treat Deedle as the eager-only comparison point so the execution-model difference is visible even before optimization details appear
>
> **Query Optimization**
> - Inspect query plans, use `ScanParquet`, and understand predicate and projection pushdown as storage-aware optimizations rather than syntax tricks
> - Keep the optimizer contract clear: native expressions and scan-based sources preserve pushdown opportunities better than eager reads or custom code paths
>
> **Performance Comparison**
> - Benchmark eager versus lazy patterns, compare materialization costs, and evaluate where lazy planning actually reduces work instead of just changing API style
> - Include streaming-mode discussion for workloads that pressure memory even when lazy planning is available
>
> **Deedle Note**
> - Use Deedle as a deliberately eager reference point rather than a feature-for-feature competitor to Polars.NET's lazy engine
>
> **Operations and safety**
> - Warnings: the current note-level warnings still reflect broader transform-model issues rather than lazy-specific hazards, so the Summary keeps the operational focus on plan boundaries, repeated collection, and optimizer visibility instead
> - Recommendations: 4 practices covering expression-first transforms, MDA-oriented boundaries, schema validation, and Parquet persistence
> - Troubleshooting: 3 failure modes in the current note-level table, while the actual lazy-workflow risks are repeated `Collect()` calls, non-pushdown sources, and plan assumptions that differ from the optimized result

> [!note]- Glossary
>
> **`LazyFrame`**
> - The deferred-execution dataframe object in Polars.NET that records operations as a plan instead of running them immediately.
> - It matters because the entire note turns on understanding that the pipeline can be designed, optimized, and only then materialized.
>
> > [!warning] Not directly inspectable as rows
> >
> > A `LazyFrame` is a plan, not a rendered table. If you expect eager row inspection at every step, you will force materialization too early.
>
> ---
>
> **`Collect()`**
> - The method that executes a lazy query plan and returns a materialized `DataFrame`.
> - It matters because it is the boundary between planning and actual cost: memory use, CPU time, and I/O happen here.
>
> > [!warning] Repeated collection repeats work
> >
> > Calling `Collect()` inside a loop or after every incremental tweak re-runs the full lazy plan unless you explicitly cache or restructure the workflow.
>
> ---
>
> **Eager execution**
> - An execution model where each dataframe operation runs immediately and produces a concrete result at that step.
> - It matters because Deedle and ordinary eager Polars workflows provide the baseline behavior that lazy planning is trying to improve upon.
>
> > [!info] Simpler mental model, fewer optimizer opportunities
> >
> > Eager code can be straightforward to debug, but it gives the engine fewer chances to fuse, reorder, or skip work.
>
> ---
>
> **Lazy execution**
> - An execution model where operations are accumulated into a query plan and optimized before running.
> - It matters because the note is fundamentally about how delaying execution changes both API design and performance outcomes.
>
> > [!info] Delay enables optimization
> >
> > The point of laziness is not delay for its own sake. It is delay so the engine can see the whole graph before touching the data.
>
> ---
>
> **`ScanParquet`**
> - A lazy file-source constructor that creates a query plan over Parquet data without reading the full file immediately.
> - It matters because scan-based entry points are where predicate and projection pushdown become possible in a meaningful way.
>
> > [!warning] Source type matters
> >
> > Pushdown wins depend heavily on columnar scan sources like Parquet. An eager `ReadCsv()` followed by `.Lazy()` does not offer the same storage-level advantages.
>
> ---
>
> **Query plan**
> - The internal representation of a lazy pipeline after the engine has captured its operations and before or during optimization.
> - It matters because the plan tells you what the engine is actually going to execute, which is more authoritative than the surface method chain.
>
> > [!warning] Optimized plan may surprise you
> >
> > The plan the engine executes can differ materially from the order you wrote in code. That is usually a benefit, but it means you should inspect rather than assume.
>
> ---
>
> **Predicate pushdown**
> - An optimization that moves filters as close to the data source as possible so irrelevant rows are never fully read.
> - It matters because row pruning is one of the fastest ways a lazy engine can reduce I/O and memory pressure on large sources.
>
> > [!warning] Custom code can block it
> >
> > Pushdown depends on the engine understanding the filter. Once the logic leaves native expressions, the optimizer may lose that opportunity.
>
> ---
>
> **Projection pushdown**
> - An optimization that reads only the columns required by the final query instead of loading the full schema eagerly.
> - It matters because wide datasets often waste more time on unnecessary columns than on unnecessary rows.
>
> > [!info] Column pruning is a real performance feature
> >
> > Selecting the needed fields early is not just cleaner code. In lazy scan workflows, it can materially reduce the storage work itself.
>
> ---
>
> **Streaming mode**
> - An execution mode where the engine processes data in smaller chunks instead of requiring full in-memory materialization at once.
> - It matters because lazy planning alone does not guarantee safe execution when datasets approach or exceed RAM limits.
>
> > [!warning] Lazy is not the same as memory-free
> >
> > A lazy plan can still materialize to a large result. Streaming helps only when the specific operations in the plan are compatible with streamed execution.
>
> ---
>
> **Benchmark**
> - A measured comparison of runtime behavior under defined conditions such as source type, operation pattern, and materialization strategy.
> - It matters because performance claims about lazy execution are only useful when backed by comparable workloads instead of intuition.
>
> > [!warning] Benchmark the real bottleneck
> >
> > If the workload is dominated by parsing, disk speed, or repeated materialization, a benchmark that hides those costs can mislead architectural decisions.
>
> ---
>
> **Deedle**
> - A .NET dataframe and series library used here as an eager-only comparison point.
> - It matters because it helps illustrate what Polars lazy execution buys you by contrasting it with a model that materializes more directly.
>
> > [!info] Reference point, not same architecture
> >
> > Deedle is useful in this note as a conceptual foil. It is not trying to solve the exact same optimization problem in the same way as Polars.

## Setup

### Setup | Suppress compiler warnings

Silences Roslyn diagnostic warnings in the .NET Interactive kernel to keep notebook output clean. This is standard boilerplate for .NET notebooks — do not modify.

*Kernel warning suppression.*
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

```text
No visible output.
```

### Setup | Install NuGet packages and configure formatters

Loads `Polars.NET 0.4.0` and its native Windows x64 runtime via NuGet. Registers custom HTML formatters so `DataFrame` and `Series` values render as tables in notebook output. Sets `DATA` to the shared dataset directory.

*Package and formatter setup.*
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

```text
Data directory: c:\Users\aperi\DEV\LANG\data
```

---

## Lazy Fundamentals

Polars has two execution modes:

- **Eager** — operations execute immediately and return a `DataFrame`.
- **Lazy** — operations build a query plan (a `LazyFrame`) that only executes when you call `.Collect()`.

The lazy API lets Polars optimize the entire query plan *before* touching any data: reordering filters, eliminating unused columns, and pushing predicates down to the file scanner.

> [!warning] Eager load of large files exhausts memory
>
> `DataFrame.ReadParquet(path)` loads the entire file into RAM immediately. For files larger than available memory, use `LazyFrame.ScanParquet(path)` and chain `.Filter()` / `.Select()` before `.Collect()` — Polars will only materialize the rows and columns you actually need.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#1a1b2e', 'primaryTextColor': '#c0caf5', 'primaryBorderColor': '#7aa2f7', 'lineColor': '#7aa2f7', 'background': '#1a1b2e', 'mainBkg': '#1f2335', 'clusterBkg': '#1f2335', 'titleColor': '#c0caf5', 'edgeLabelBackground': '#1f2335', 'fontFamily': 'monospace'}}}%%
flowchart LR
    A["ScanParquet(path)"] -->|"LazyFrame — no data read"| B["Build query plan"]
    B --> C[".Filter(Col(...))"]
    C --> D[".Select(Col(...))"]
    D --> E[".Sort / .GroupBy<br/>.WithColumns"]
    E -->|"Optimizer rewrites plan"| F[".Collect()"]
    F --> G["DataFrame<br/>(materialized)"]

    style A fill:#1f2335,stroke:#7aa2f7,color:#c0caf5
    style B fill:#1f2335,stroke:#7aa2f7,color:#c0caf5
    style C fill:#1f2335,stroke:#e0af68,color:#c0caf5
    style D fill:#1f2335,stroke:#e0af68,color:#c0caf5
    style E fill:#1f2335,stroke:#e0af68,color:#c0caf5
    style F fill:#1f2335,stroke:#f7768e,color:#f7768e
    style G fill:#1f2335,stroke:#9ece6a,color:#9ece6a
```

### Scan, Convert, and Collect

#### Polars.NET | Scan Parquet (lazy)

`LazyFrame.ScanParquet(path)` registers the Parquet file in the query plan without reading any data. Schema is inferred from file metadata. Use this as the entry point for all lazy pipelines — it enables predicate and projection pushdown so only the rows and columns you actually need are ever read from disk.

*Lazy Parquet scan.*
```csharp
var parquetPath = Path.Combine(DATA, "eurostoxx50_ohlcv.parquet");
var lf = LazyFrame.ScanParquet(parquetPath);

Console.WriteLine($"Type: {lf.GetType().Name}");
Console.WriteLine("No data has been loaded yet — just a query plan.");
```

```text
Type: LazyFrame
No data has been loaded yet — just a query plan.
```

#### Polars.NET | Eager to Lazy conversion

Call `.Lazy()` on an existing `DataFrame` to convert it to a `LazyFrame`. The conversion is free — no data is copied. Use this when you have already read data eagerly (e.g., from a CSV) but want to chain further operations with lazy optimization before collecting.

*Eager to lazy conversion.*
```csharp
var dfEager = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"));
Console.WriteLine($"Eager DataFrame shape: {dfEager.Shape}");

var lfFromEager = dfEager.Lazy();
Console.WriteLine($"LazyFrame type: {lfFromEager.GetType().Name}");
Console.WriteLine("Eager -> Lazy conversion is free (no copy).");
```

```text
Eager DataFrame shape: (66355, 12)
LazyFrame type: LazyFrame
Eager -> Lazy conversion is free (no copy).
```

#### Polars.NET | Collect

> [!warning] `.Collect()` is the execution trigger
>
> Nothing runs until you call `.Collect()`. A `LazyFrame` with filters, selects, and sorts is just a description of work — no computation happens. If you forget `.Collect()`, you will hold a `LazyFrame` with no results. For large datasets, call `.Head(100).Collect()` first to validate the plan before collecting the full result.

`.Collect()` executes the optimized query plan and materializes the result as a `DataFrame`. This is the only point where data moves — Polars reads the file, applies filters, and evaluates expressions.

*Collect the lazy frame.*
```csharp
var result = lf.Collect();
Console.WriteLine($"Collected shape: {result.Shape}");

result.Head(5)
```

```text
Collected shape: (66355, 12)
```

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

### Query Plan Inspection

#### Polars.NET | Explain: inspect the optimized query plan

`lf.Explain()` returns the optimized query plan as a string. Read it to verify that filters and column selections have been pushed into the scan. The plan shows `PROJECT N/12 COLUMNS` for projection pushdown and `SELECTION: [...]` for predicate pushdown.

> [!info] `Explain()` availability in Polars.NET 0.4.0
>
> `Explain()` may not be exposed in Polars.NET 0.4.0. The code below catches the exception gracefully. Regardless, Polars still applies all optimizations internally when you call `.Collect()` — you just cannot inspect the plan text in this version.

*Query plan inspection.*
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

```text
Optimized query plan:
Parquet SCAN [../data/eurostoxx50_ohlcv.parquet]
PROJECT */12 COLUMNS
ESTIMATED ROWS: 66355
```

---

## Query Optimization

When you build a lazy query, Polars applies **automatic optimizations** before execution:

- **Predicate pushdown** — filters move as early as possible, even into the file scanner.
- **Projection pushdown** — only columns that are actually used get read from disk.
- **Common subexpression elimination** — duplicate computations are evaluated once.

These happen transparently. You write clear, readable code; Polars figures out the fastest plan.

> [!tip] Write readable code — let Polars optimize
>
> Do not manually reorder filters to "help" Polars. Write the query in logical order (scan → filter → select → aggregate). Polars will rewrite the plan into the optimal execution order automatically, including pushing filters inside the file scanner.

### Predicate and Projection Pushdown

#### Polars.NET | Predicate pushdown

A filter applied to a `LazyFrame` is pushed into the file scanner at optimization time. Polars passes the predicate to the Parquet reader, which skips row groups that cannot match — so only qualifying rows are ever deserialized into memory.

*Predicate pushdown.*
```csharp
var lfFiltered = LazyFrame.ScanParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"))
    .Filter(Col("symbol") == Lit("SAP.DE"));

var dfFiltered = lfFiltered.Collect();
Console.WriteLine($"Rows matching symbol='SAP.DE': {dfFiltered.Shape}");

dfFiltered.Head(5)
```

```text
Rows matching symbol='SAP.DE': (1324, 12)
```

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>5301</td><td>SAP.DE</td><td>2021-01-04</td><td>108.1</td><td>108.5</td><td>104.78</td><td>105.32</td><td>97.0102</td><td>2928515</td><td>0</td><td>0</td><td>false</td></tr><tr><td>5302</td><td>SAP.DE</td><td>2021-01-05</td><td>104.98</td><td>106.2</td><td>104.46</td><td>105.04</td><td>96.7523</td><td>2798888</td><td>0</td><td>0</td><td>false</td></tr><tr><td>5303</td><td>SAP.DE</td><td>2021-01-06</td><td>105.14</td><td>106.26</td><td>103.6</td><td>105.48</td><td>97.1576</td><td>3018802</td><td>0</td><td>0</td><td>false</td></tr><tr><td>5304</td><td>SAP.DE</td><td>2021-01-07</td><td>105.58</td><td>105.7</td><td>104.04</td><td>104.52</td><td>96.2734</td><td>3176143</td><td>0</td><td>0</td><td>false</td></tr><tr><td>5305</td><td>SAP.DE</td><td>2021-01-08</td><td>105.14</td><td>106.72</td><td>105.04</td><td>106.18</td><td>97.8024</td><td>3068744</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Polars.NET | Projection pushdown

A `.Select()` on a `LazyFrame` is pushed into the Parquet scanner — only the requested columns are read from disk. Parquet's columnar format stores each column separately, so unselected columns are completely skipped. This is one of the largest memory and I/O savings in the Polars lazy API.

*Projection pushdown.*
```csharp
var lfProjected = LazyFrame.ScanParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"))
    .Select(Col("symbol"), Col("date"), Col("close"), Col("volume"));

var dfProjected = lfProjected.Collect();
Console.WriteLine($"Projected shape: {dfProjected.Shape} (only 4 of 12 columns read)");

dfProjected.Head(5)
```

```text
Projected shape: (66355, 4) (only 4 of 12 columns read)
```

<!-- Polars DataFrame: (5 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>1370204</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>1469911</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>1428681</td></tr></tbody></table></div>

### Lazy Pipeline Operations

#### Polars.NET | Combined filter, select, and sort

Chaining `.Filter()`, `.Select()`, and `.Sort()` on a `LazyFrame` builds a single query plan. Polars optimizes the full pipeline before any execution: the filter is pushed into the scan, only the four selected columns are read from disk, and the sort runs on the already-filtered result. Write the chain in the logical order that reads clearly — Polars handles the reordering.

*Combined lazy pipeline.*
```csharp
var lfCombined = LazyFrame.ScanParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"))
    .Filter(Col("volume") > Lit(5_000_000))
    .Select(Col("symbol"), Col("date"), Col("close"), Col("volume"))
    .Sort("volume", true);

var dfCombined = lfCombined.Collect();
Console.WriteLine($"High-volume trades: {dfCombined.Shape}");

dfCombined.Head(10)
```

```text
High-volume trades: (14330, 4)
```

<!-- Polars DataFrame: (10 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>ISP.MI</td><td>2023-08-08</td><td>2.338</td><td>376391539</td></tr><tr><td>SAN.MC</td><td>2021-10-20</td><td>3.36</td><td>367211467</td></tr><tr><td>ISP.MI</td><td>2023-05-31</td><td>2.1555</td><td>317362978</td></tr><tr><td>ISP.MI</td><td>2023-03-13</td><td>2.3305</td><td>311886033</td></tr><tr><td>SAN.MC</td><td>2021-11-03</td><td>3.31</td><td>306973344</td></tr></tbody></table></div>

#### Polars.NET | Lazy GroupBy with aggregation

`.GroupBy().Agg()` in lazy mode builds the grouping and aggregation into the query plan. Polars can optimize the scan to only read the columns referenced in the grouping key and aggregation expressions. The `.Sort()` after `.Agg()` runs on the smaller grouped result, not the full dataset.

*Lazy groupby aggregation.*
```csharp
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

```text
Grouped result: (50, 4)
```

<!-- Polars DataFrame: (10 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>avg_close</th><th>total_volume</th><th>num_days</th></tr></thead><tbody><tr><td>ISP.MI</td><td>3.147987207</td><td>115704541969</td><td>1321</td></tr><tr><td>SAN.MC</td><td>4.42584763</td><td>55513641918</td><td>1329</td></tr><tr><td>ENEL.MI</td><td>6.820438304</td><td>32600561934</td><td>1321</td></tr><tr><td>BBVA.MC</td><td>8.651954101</td><td>22133773194</td><td>1329</td></tr><tr><td>UCG.MI</td><td>28.45710447</td><td>18366801099</td><td>1321</td></tr></tbody></table></div>

#### Polars.NET | Lazy WithColumns: add computed columns

`.WithColumns()` adds new expression-based columns to the query plan without materializing the DataFrame. All original columns are preserved alongside the new ones. Expressions passed to `.WithColumns()` are evaluated lazily — they run only at `.Collect()` time, after filters have reduced the row count.

*WithColumns() demo.*
```csharp
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

```text
With computed columns: (1324, 5)
```

<!-- Polars DataFrame: (5 rows, 5 columns) --><table><thead><tr><th>date</th><th>open</th><th>close</th><th>daily_range</th><th>daily_change</th></tr></thead><tbody><tr><td>2021-01-04</td><td>108.1</td><td>105.32</td><td>3.72</td><td>-2.78</td></tr><tr><td>2021-01-05</td><td>104.98</td><td>105.04</td><td>1.74</td><td>0.06</td></tr><tr><td>2021-01-06</td><td>105.14</td><td>105.48</td><td>2.66</td><td>0.34</td></tr><tr><td>2021-01-07</td><td>105.58</td><td>104.52</td><td>1.66</td><td>-1.06</td></tr><tr><td>2021-01-08</td><td>105.14</td><td>106.18</td><td>1.68</td><td>1.04</td></tr></tbody></table></div>

---

## Performance Comparison

We compare **eager** vs **lazy** execution on real data to measure the impact of query optimization.

- **Eager**: read the entire file into memory, then filter and select.
- **Lazy**: scan the file, apply filter + select, then collect — Polars only reads what it needs.

We use `Stopwatch` for timing and average over multiple iterations to reduce noise.

### Benchmark Setup

#### Polars.NET | Benchmark helper

A `Stopwatch`-based timing helper that runs warmup iterations to stabilize JIT compilation and OS file caching before measuring. Returns average, min, and max across the measured iterations. Warmup is important: the first run after cold-start will always be slower due to JIT and disk cache effects.

*Benchmark helper.*
```csharp
static (double avgMs, double minMs, double maxMs) Benchmark(Action action, int warmup = 2, int iterations = 5)
{
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

```text
Benchmark helper defined.
```

### Eager vs Lazy Benchmarks

#### Polars.NET | Eager vs Lazy: Parquet read + filter + select

Benchmarks the same query (filter one exchange, select four columns) on a ~12M-row Parquet file using eager and lazy execution. Eager reads all 12 columns into memory first, then filters. Lazy pushes the filter and column selection into the Parquet scanner, reading only what it needs.

*Parquet benchmark.*
```csharp
var benchPath = Path.Combine(DATA, "bench_large.parquet");
Console.WriteLine($"Benchmark file: {benchPath}");

var (eagerAvg, eagerMin, eagerMax) = Benchmark(() =>
{
    var df = DataFrame.ReadParquet(benchPath);
    var filtered = df.Filter(Col("exchange") == Lit("XAMS"));
    var selected = filtered.Select(Col("symbol"), Col("date"), Col("price"), Col("size"));
}, warmup: 1, iterations: 3);

Console.WriteLine($"EAGER  — avg: {eagerAvg:F1} ms  (min: {eagerMin:F1}, max: {eagerMax:F1})");

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

```text
Benchmark file: ..\data\bench_large.parquet
EAGER  — avg: 141.5 ms  (min: 99.1, max: 218.3)
LAZY   — avg: 15.8 ms  (min: 15.1, max: 16.2)

Lazy is ~9.0x faster than eager on this query.
```

#### Polars.NET | Eager vs Lazy: CSV read + filter + select

CSV is a row-based format — unlike Parquet, it cannot skip columns without reading the full line. Projection pushdown has no effect on CSV. `LazyFrame.ScanCsv()` was not available in early Polars.NET builds; the code falls back to an eager-read + `.Lazy()` hybrid if `ScanCsv` throws.

> [!info] Use Parquet for best lazy performance
>
> CSV must be fully scanned line by line regardless of which columns you request. Lazy CSV (`ScanCsv`) still applies predicate pushdown to skip non-matching rows, but column pruning does not apply. For data that you query repeatedly, convert to Parquet once and get true projection pushdown.

*CSV benchmark.*
```csharp
var csvBenchPath = Path.Combine(DATA, "bench_medium.csv");
Console.WriteLine($"CSV benchmark file: {csvBenchPath} (~2.5M rows)");

var (csvEagerAvg, csvEagerMin, csvEagerMax) = Benchmark(() =>
{
    var df = DataFrame.ReadCsv(csvBenchPath);
    var filtered = df.Filter(Col("symbol") == Lit("ASML.AS"));
    var selected = filtered.Select(Col("symbol"), Col("date"), Col("close"), Col("volume"));
}, warmup: 1, iterations: 3);

Console.WriteLine($"EAGER CSV  — avg: {csvEagerAvg:F1} ms  (min: {csvEagerMin:F1}, max: {csvEagerMax:F1})");

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

```text
CSV benchmark file: ..\data\bench_medium.csv (~2.5M rows)
EAGER CSV  — avg: 103.8 ms  (min: 102.4, max: 105.5)
LAZY  CSV  — avg: 76.8 ms  (min: 75.1, max: 77.7)

Lazy CSV speedup: ~1.4x
```

### Projection Impact and Summary

#### Polars.NET | Projection pushdown impact

Measures the I/O savings from reading 2 columns vs all 12 columns from the same Parquet file. In a columnar format, each column is a separate byte range in the file — selecting fewer columns means less data read from disk, less decompression work, and less memory allocation.

*Projection impact.*
```csharp
var projPath = Path.Combine(DATA, "bench_large.parquet");

var (allColsAvg, _, _) = Benchmark(() =>
{
    var df = LazyFrame.ScanParquet(projPath).Collect();
}, warmup: 1, iterations: 3);

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

```text
All 12 columns — avg: 73.4 ms
Only 2 columns — avg: 17.7 ms

Projection pushdown saves ~76% read time.
```

#### Polars.NET | Benchmark summary

Assembles the benchmark results into a `DataFrame` for comparison. The `vs_eager` column shows the speedup factor relative to the eager Parquet baseline.

*Benchmark summary.*
```csharp
var summaryDf = new DataFrame(new Polars.CSharp.Series[]
{
    Polars.CSharp.Series.From("approach", new[] { "Eager Parquet", "Lazy Parquet", "Lazy 2-col Parquet" }),
    Polars.CSharp.Series.From("avg_ms", new[] { eagerAvg, lazyAvg, twoColsAvg }),
    Polars.CSharp.Series.From("vs_eager", new[] { 1.0, eagerAvg / lazyAvg, eagerAvg / twoColsAvg })
});

summaryDf
```

```text
Rendered summary table follows.
```

<!-- Polars DataFrame: (3 rows, 3 columns) --><table><thead><tr><th>approach</th><th>avg_ms</th><th>vs_eager</th></tr></thead><tbody><tr><td>Eager Parquet</td><td>141.5324667</td><td>1</td></tr><tr><td>Lazy Parquet</td><td>15.79983333</td><td>8.957845547</td></tr><tr><td>Lazy 2-col Parquet</td><td>17.7476</td><td>7.974738368</td></tr></tbody></table></div>

---

## Deedle Note

> [!info] Deedle has no lazy mode
>
> Deedle loads all data into memory immediately on read. There is no query plan, no predicate pushdown, and no projection pushdown. For large datasets that do not fit comfortably in memory, Polars.NET's lazy API is the appropriate choice.

**Deedle is eager-only.** All data is loaded into memory immediately when you read a file. There is no lazy execution mode, no query plan, and no automatic optimization.

For large datasets, Polars.NET's lazy evaluation with predicate and projection pushdown is significantly faster:

- **Predicate pushdown** — filters move into the file reader, so unmatched rows are never materialized.
- **Projection pushdown** — unneeded columns are skipped entirely during the Parquet scan.
- **Query optimization** — the entire pipeline is rewritten for efficiency before any data moves.

If your workflow fits in memory and you only need basic operations, Deedle works fine. For analytical queries on larger-than-memory data, Polars.NET's lazy API is the right tool.

---

## Summary

### Summary | Lazy API cheat sheet

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

### Summary | Key takeaways

- **Always prefer `ScanParquet` over `ReadParquet`** when you plan to filter or select — predicate and projection pushdown avoid reading unnecessary data.
- **Chain operations lazily** — let Polars optimize the full pipeline before execution.
- **Parquet > CSV for lazy** — Parquet's columnar format enables true projection pushdown; CSV must still be fully scanned.
- **Deedle has no lazy mode** — every operation is immediate and loads all data.

---

## Warnings

> [!warning] Polars.NET DataFrames are immutable — every operation returns a new DataFrame
>
> Forgetting to assign the result of `WithColumns()`, `Filter()`, or `Sort()` silently discards the work. MDA is mutable — column assignment modifies the original.

> [!warning] `IfElse` in Polars.NET is not `When/Then/Otherwise`
>
> The C# API uses `Col("x").Gt(0).IfElse(trueVal, falseVal)` — not `When().Then().Otherwise()`. Translating from Python literally produces compile errors.

> [!warning] Type mismatches between Polars.NET and MDA are common
>
> Polars.NET uses Arrow types (Int64, Float64, Utf8). MDA uses .NET types (int, double, string). Converting between libraries requires explicit type mapping.

## Recommendations

1. **Prefer Polars.NET expressions for analytical transforms** — the optimizer can fuse and reorder operations.
2. **Use MDA when ML.NET integration is the goal** — MDA DataFrame implements `IDataView` for direct ML.NET handoff.
3. **Validate output schemas after transforms** — assert column names and types match expectations.
4. **Prefer Parquet for intermediate data** — lossless type preservation between transform steps.

## Troubleshooting and failure modes

#### `WithColumns()` results are immutable until you assign them

Polars transforms return a new frame, so the original stays unchanged unless you assign the returned value.

*Immutable result.*
```csharp
Console.WriteLine("df.WithColumns(...) returns a new DataFrame.");
Console.WriteLine("Assign the result: df = df.WithColumns(...).");
```

```text
df.WithColumns(...) returns a new DataFrame.
Assign the result: df = df.WithColumns(...).
```

#### `Cast` fails when source values do not fit the target type

Treat cast failures as data-shape problems: clean the source values or branch with `IfElse` before converting.

*Cast failure.*
```csharp
Console.WriteLine("ComputeError on Cast usually means the source values do not fit the target type.");
Console.WriteLine("Clean the data first or branch with `IfElse` before casting.");
```

```text
ComputeError on Cast usually means the source values do not fit the target type.
Clean the data first or branch with `IfElse` before casting.
```

#### MDA column constructors must match the CLR type

Choose the MDA column constructor that matches the CLR type exactly so the column is built with the expected schema.

*CLR type mapping.*
```csharp
Console.WriteLine("Use `Int32DataFrameColumn` for `int`, `DoubleDataFrameColumn` for `double`, and `StringDataFrameColumn` for `string`.");
Console.WriteLine("A CLR type mismatch surfaces when the column is constructed.");
```

```text
Use `Int32DataFrameColumn` for `int`, `DoubleDataFrameColumn` for `double`, and `StringDataFrameColumn` for `string`.
A CLR type mismatch surfaces when the column is constructed.
```
