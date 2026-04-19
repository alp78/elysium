---
title: "05 - Aggregation and Reshaping - C#"
tags: [csharp, microsoft-data-analysis, polars, dataframes]
aliases:
  - groupby, window functions, joins, pivot, melt
description: "Polars.NET / Microsoft.Data.Analysis / C# DataFrames reference 05/10 - Aggregation & Reshaping (groupby, windows, joins, pivot, melt). Executable examples with cell outputs. See [05_py_aggregation_reshaping](https://alp78.github.io/elysium/03-Dataframes/Dataframes-Python/05_py_aggregation_reshaping) for the Python equivalent."
created: 2026-03-27
updated: 2026-04-07
status: complete
---

# Aggregation and Reshaping - C#

> [!quote]+
>
> "Statistics are like bikinis. What they reveal is suggestive, but what they conceal is vital."
>
> — **Aaron Levenstein**

> [!abstract]- Summary
>
> Covers the core dataframe operations that change row grain or table shape in C#: grouping, aggregation, window calculations, joins, concatenation, and reshape patterns across Polars.NET and Microsoft.Data.Analysis. This is the point where the library split becomes operationally obvious: Polars.NET keeps grouping, windowing, and reshaping inside a compact expression-and-join API, while MDA exposes a typed eager dataframe model that fits CLR loops and explicit in-process staging.
>
> **Setup**
> - Configure the notebook runtime, load the shared C# dataframe packages, and prepare the EuroStoxx datasets used to compare grouped analytics and reshape operations side by side
>
> **Grouping & Aggregation**
> - Group on one or multiple keys, compute named aggregates, and compare concise Polars `GroupBy(...).Agg(...)` pipelines with explicit accumulator-style MDA implementations
> - Keep output-order expectations explicit, especially when grouped results need post-aggregation sorting for stable interpretation
>
> **Window Functions**
> - Apply per-row grouped analytics such as mean-over-group, rank, rolling metrics, and cumulative logic through `.Over(...)` in Polars and explicit two-pass or loop-driven patterns in MDA
> - Treat window calculations as row-preserving analytical features rather than simple group collapses
>
> **Joins**
> - Build inner, left, anti, semi, and cross joins to enrich fact data with dimensions or membership logic, and understand which join forms are first-class in Polars versus emulated patterns in MDA
> - Keep row-multiplication risk visible for many-to-many joins and cross joins
>
> **Concatenation**
> - Stack frames vertically or align them horizontally when combining compatible outputs from separate preparation steps
>
> **Reshaping**
> - Pivot and unpivot data between long and wide layouts for analysis, reporting, or export, with clear acknowledgment that MDA reshape support is more limited and often requires manual construction
>
> **Operations and safety**
> - Warnings: the current note-level warning block still emphasizes broader Polars-versus-MDA transform differences such as immutability, conditional-expression API differences, and cross-library type mismatches
> - Recommendations: 4 practices covering expression-first analytical transforms, MDA for ML.NET-style boundaries, schema validation after transforms, and Parquet for type-safe intermediates
> - Troubleshooting: 3 failure modes covering missed reassignment in Polars, cast failures, and MDA typed-column mismatches

> [!note]- Glossary
>
> **`GroupBy`**
> - A split-apply-combine operation that partitions rows by key columns and computes one or more aggregates per group.
> - It matters because grouped summaries are the backbone of most analytical reporting and the first place where Polars and MDA diverge sharply in ergonomics.
>
> > [!warning] Grouped output order is not guaranteed
> >
> > Especially in Polars, grouped results should not be assumed to come back in a stable business order unless you sort them explicitly afterward.
>
> ---
>
> **Aggregation**
> - A reduction that collapses multiple rows into summary values such as count, mean, sum, min, or max.
> - It matters because nearly every reshape or join decision later in the note assumes a clear understanding of when row-level data has already been reduced.
>
> > [!info] Grain changes here
> >
> > Once an aggregate runs, you are no longer looking at the original row grain. That change in analytical level should be treated as a schema event, not just a math step.
>
> ---
>
> **Window function**
> - A per-row calculation that uses group or neighborhood context without collapsing the dataframe to one row per group.
> - It matters because rank, rolling features, cumulative metrics, and group-wise broadcasts all depend on this pattern.
>
> > [!warning] Not the same as `GroupBy`
> >
> > A window function preserves row count. If the result shrinks to one row per group, you performed an aggregation, not a window calculation.
>
> ---
>
> **`.Over()`**
> - The Polars mechanism that applies an expression over a grouping context while keeping one output value per original row.
> - It matters because it is the cleanest expression of window-style analytics in the note and a major contrast with MDA’s manual broadcast patterns.
>
> > [!info] Broadcast semantics are explicit
> >
> > `.Over()` makes group-wise metrics reusable as row-level features without forcing a second join step back onto the original data.
>
> ---
>
> **Join**
> - A key-based combination of two dataframes that aligns rows from one side with matching rows from another.
> - It matters because dimensional enrichment and table-shape expansion are central to analytical pipelines, and join choice directly affects row count and null behavior.
>
> > [!warning] Many-to-many joins multiply silently
> >
> > If both sides contain repeated keys, a join can explode row count without throwing an error. That is a data-model issue, not just a syntax issue.
>
> ---
>
> **Anti join**
> - A join that returns only rows from the left side with no match on the right.
> - It matters because anti joins are the cleanest way to find missing reference data, exclusions, or orphaned facts.
>
> > [!info] Best thought of as a mismatch detector
> >
> > Anti joins are often more readable than a left join followed by a null filter when the real goal is simply "show me what did not match."
>
> ---
>
> **Semi join**
> - A join that keeps rows from the left side only when a match exists on the right, without bringing right-side columns into the result.
> - It matters because presence checks and membership filters are a common analytical pattern distinct from full table enrichment.
>
> > [!info] Existence filter, not enrichment
> >
> > A semi join answers "does a match exist?" rather than "what are the matching attributes?"
>
> ---
>
> **Cross join**
> - A Cartesian combination where every row on one side is paired with every row on the other.
> - It matters because the note includes it as a valid join form, but also as one of the fastest ways to create explosive output sizes by accident.
>
> > [!warning] Tiny inputs only
> >
> > Cross joins scale multiplicatively. They are safe for deliberately small scaffolding sets, not for ordinary fact tables.
>
> ---
>
> **Concatenation**
> - Combining dataframes either by stacking rows vertically or aligning columns horizontally.
> - It matters because aggregation workflows often produce separate partial outputs that must be recombined before reporting or export.
>
> > [!warning] Shape compatibility still matters
> >
> > Vertical concatenation assumes aligned schemas; horizontal concatenation assumes compatible row alignment or a clearly defined padding strategy.
>
> ---
>
> **Pivot**
> - A reshape that turns categorical values into new columns, producing a wider table.
> - It matters because reporting-oriented summaries often need wide layouts even when the analytical source data is naturally long-form.
>
> > [!warning] Aggregation is usually implicit
> >
> > If multiple rows land in the same pivot cell, some aggregation rule must decide what survives. That rule is part of the business definition of the output.
>
> ---
>
> **Unpivot**
> - A reshape that turns multiple value columns into key-value rows, producing a longer table.
> - It matters because many analytical and visualization tools work better on long-form data than on manually widened tables.
>
> > [!info] Wide data is often just presentation
> >
> > Unpivoting is frequently the step that restores a report-shaped dataset back into a format suitable for grouping, plotting, or modeling.
>
> ---

> [!info] Current API and execution-model check | 2026-04
>
> Polars documents [window functions](https://docs.pola.rs/user-guide/expressions/window-functions/), [joins](https://docs.pola.rs/user-guide/transformations/joins/), [pivot](https://docs.pola.rs/user-guide/transformations/pivot/), and [unpivot](https://docs.pola.rs/user-guide/transformations/unpivot/) as first-class dataframe transformations. Microsoft documents [`DataFrame`](https://learn.microsoft.com/en-us/dotnet/api/microsoft.data.analysis.dataframe?view=ml-dotnet-preview), [`DataFrame.Join`](https://learn.microsoft.com/en-us/dotnet/api/microsoft.data.analysis.dataframe.join?view=ml-dotnet-preview), and [`DataFrame.Merge`](https://learn.microsoft.com/en-us/dotnet/api/microsoft.data.analysis.dataframe.merge?view=ml-dotnet-preview) as an eager columnar API. In practice, Polars is stronger when the transformation graph itself is the product; MDA is strongest when the dataframe is an in-process staging object around other .NET code.

---

## C# Aggregation and Reshaping Setup

### Warning Suppression

*Disables notebook-only assembly-version warnings before any `#r "nuget: ..."` cells run.*

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

Install Polars.NET and Microsoft.Data.Analysis in the notebook. Alias `Microsoft.Data.Analysis` as `MDA` so `DataFrame` continues to refer to Polars inside the mixed examples below.

*Loads the pinned Polars.NET and Microsoft.Data.Analysis packages, registers dataframe HTML formatters, and prints the shared data directory path.*

```csharp
#r "nuget: Polars.NET, 0.4.0"
#r "nuget: Polars.NET.Native.win-x64, 0.4.0"
#r "nuget: Microsoft.Data.Analysis, 0.23.0"

using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Polars.CSharp;
using static Polars.CSharp.Polars;
using MDA = Microsoft.Data.Analysis;
using Microsoft.DotNet.Interactive.Formatting;

Formatter.Register<DataFrame>((df, writer) =>
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

### Dataset Loading

Load the same CSV files into both Polars.NET and Microsoft.Data.Analysis. This chapter focuses on local aggregation and reshape patterns after data has already been materialized into the notebook process; if the source rows still live in SQL, DuckDB, Spark, or a warehouse, many of these operations are usually better pushed upstream.

*Reads the OHLCV fact table and the 4-row index dimension into both libraries and prints the loaded shapes.*

```csharp
var dfP = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"), tryParseDates: true);
var dimP = DataFrame.ReadCsv(Path.Combine(DATA, "dim_index.csv"));

var dfM = MDA.DataFrame.LoadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"));
var dimM = MDA.DataFrame.LoadCsv(Path.Combine(DATA, "dim_index.csv"));

display($"OHLCV - Polars: {dfP.Shape}  |  MDA: ({dfM.Rows.Count}, {dfM.Columns.Count})");
display($"DimIndex - Polars: {dimP.Shape}  |  MDA: ({dimM.Rows.Count}, {dimM.Columns.Count})");
```

```text
OHLCV - Polars: (66355, 12)  |  MDA: (66355, 12)
```

```text
DimIndex - Polars: (4, 5)  |  MDA: (4, 5)
```

### Exchange Dimension Table

#### Polars.NET | Build exchange dimension table

Create a small 7-row dimension table that maps exchange suffix codes to exchange name and country. Keeping the lookup as its own frame makes the later join examples easier to reason about and mirrors the usual fact-to-dimension pattern used in analytical pipelines.

*Builds a standalone exchange dimension from suffix, exchange name, and country arrays and displays the resulting 7-row lookup table.*

```csharp
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

dimExP
```

<table><thead><tr><th>suffix</th><th>exchange_name</th><th>country</th></tr></thead><tbody><tr><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>.AS</td><td>Euronext Amsterdam</td><td>Netherlands</td></tr><tr><td>.DE</td><td>XETRA Frankfurt</td><td>Germany</td></tr><tr><td>.PA</td><td>Euronext Paris</td><td>France</td></tr><tr><td>.MC</td><td>Bolsa de Madrid</td><td>Spain</td></tr></tbody></table>

#### Polars.NET | Add suffix column to OHLCV for joins

Derive a join key on the OHLCV fact table by extracting the exchange suffix from `symbol` and appending it as a new column. This keeps the join logic explicit and makes the later inner, left, anti, and semi join examples operate on a stable key.

*Extracts the suffix from each ticker symbol, appends it to `dfP` as `suffix`, and previews the first five rows prepared for joining.*

```csharp
var symbolsArr = dfP.Column("symbol").ToArray<string>();
var suffixArr = symbolsArr.Select(s => "." + s.Split('.').Last()).ToArray();
var suffixSeries = Polars.CSharp.Series.From("suffix", suffixArr);
var dfPWithSuffix = dfP.HStack(suffixSeries);

dfPWithSuffix.Select("id", "symbol", "date", "close", "suffix").Head()
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>close</th><th>suffix</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>.BR</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>.BR</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>.BR</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>.BR</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>.BR</td></tr></tbody></table>

#### Microsoft.Data.Analysis | Build exchange dimension frame

MDA builds the same 7-row lookup explicitly from typed string columns and then clones the OHLCV frame to append a computed `suffix` join key. The result is operationally close to working with an ADO.NET table in memory: explicit schema, explicit key construction, and explicit column mutation.

*Builds the exchange suffix lookup in MDA, appends a `suffix` column to the OHLCV frame for later joins, and previews the 7-row exchange dimension table.*

```csharp
// MDA — Build an exchange lookup from symbol suffixes
var exchangeDataM = new Dictionary<string, (string name, string country)>
{
    [".BR"]  = ("Euronext Brussels", "Belgium"),
    [".AS"]  = ("Euronext Amsterdam", "Netherlands"),
    [".DE"]  = ("XETRA Frankfurt", "Germany"),
    [".PA"]  = ("Euronext Paris", "France"),
    [".MC"]  = ("Bolsa de Madrid", "Spain"),
    [".MI"]  = ("Borsa Italiana", "Italy"),
    [".HE"]  = ("Nasdaq Helsinki", "Finland")
};

var dimExM = new MDA.DataFrame(
    new MDA.StringDataFrameColumn("suffix", exchangeDataM.Keys),
    new MDA.StringDataFrameColumn("exchange_name", exchangeDataM.Values.Select(v => v.name)),
    new MDA.StringDataFrameColumn("country", exchangeDataM.Values.Select(v => v.country))
);

// Add a suffix column to OHLCV for joining
var suffixColM = new MDA.StringDataFrameColumn("suffix", dfM.Rows.Count);
var symColM = dfM.Columns["symbol"];
for(long i = 0; i < dfM.Rows.Count; i++)
{
    var s = symColM[i]?.ToString();
    if (s != null) suffixColM[i] = "." + s.Split('.').Last();
}

var dfWithSuffixM = dfM.Clone();
dfWithSuffixM.Columns.Add(suffixColM);

dimExM
```

<table><thead><tr><th>suffix</th><th>exchange_name</th><th>country</th></tr></thead><tbody><tr><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>.AS</td><td>Euronext Amsterdam</td><td>Netherlands</td></tr><tr><td>.DE</td><td>XETRA Frankfurt</td><td>Germany</td></tr><tr><td>.PA</td><td>Euronext Paris</td><td>France</td></tr><tr><td>.MC</td><td>Bolsa de Madrid</td><td>Spain</td></tr></tbody></table>

## Grouping & Aggregation

> [!info] Aggregation model | Expression graph vs eager typed columns
>
> Polars.NET keeps group-by, window, and reshape operations inside the dataframe engine. Microsoft.Data.Analysis can join and append frames directly, but many grouped and windowed patterns are still expressed through dictionaries, masks, and explicitly materialized typed columns. Use Polars when the transformation graph itself is the main workload. Use MDA when the dataframe is only one stage inside broader CLR, LINQ, or ML.NET-oriented application logic.

> [!tip] Push large aggregations upstream when the data is not local yet
>
> As *SQL Server Query Tuning and Optimization Optimize Microsoft SQL Server 2022 queries and applications.pdf* and *Fundamentals of Data Engineering.epub* both reinforce, large joins and aggregates are usually best executed where the optimizer can choose hash, merge, broadcast, or indexed strategies before data reaches the notebook. Local dataframe aggregation is strongest after extraction, for feature engineering, QA, or iterative analysis.

### GroupBy Single Column

#### Polars.NET | GroupBy single column

Group rows by one key column and compute a single aggregate. `GroupBy("col").Agg(expr)` returns a flat DataFrame with one row per group — no index. Returns results in arbitrary order; chain `.Sort()` for deterministic ordering.

*Groups the 66K-row OHLCV frame by `symbol` and computes the mean closing price per ticker — result is 50 rows, one per unique EuroStoxx 50 constituent.*

```csharp
// Polars.NET — Average closing price per symbol
var avgCloseP = dfP
    .GroupBy("symbol")
    .Agg(Col("close").Mean().Alias("avg_close"));

avgCloseP.Head(10)
```

<!-- Polars DataFrame: (10 rows, 2 columns) --><table><thead><tr><th>symbol</th><th>avg_close</th></tr></thead><tbody><tr><td>ABI.BR</td><td>54.86423366</td></tr><tr><td>AD.AS</td><td>29.6526559</td></tr><tr><td>ADS.DE</td><td>205.4264804</td></tr><tr><td>ADYEN.AS</td><td>1545.976409</td></tr><tr><td>AI.PA</td><td>145.4284434</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | GroupBy single column

MDA does not provide a Polars-style high-level group aggregation expression. The practical pattern is to scan the rows, accumulate state in a dictionary keyed by the group column, and materialize the grouped result into a new dataframe.

*Scans all OHLCV rows, groups by `symbol` through a dictionary accumulator, computes mean close price per ticker, and returns the first 10 rows of the grouped result.*

```csharp
// MDA — Average closing price per symbol
var closeColM = dfM.Columns["close"];
var avgGroupsM = new Dictionary<string, (double sum, int count)>();

for(long i = 0; i < dfM.Rows.Count; i++)
{
    var s = symColM[i]?.ToString();
    if (s != null && closeColM[i] != null)
    {
        var cv = Convert.ToDouble(closeColM[i]);
        if(!avgGroupsM.ContainsKey(s)) avgGroupsM[s] = (0, 0);
        var g = avgGroupsM[s];
        avgGroupsM[s] = (g.sum + cv, g.count + 1);
    }
}

var avgCloseDfM = new MDA.DataFrame(
    new MDA.StringDataFrameColumn("symbol", avgGroupsM.Keys),
    new MDA.PrimitiveDataFrameColumn<double>("avg_close", avgGroupsM.Values.Select(g => g.sum / g.count))
);
avgCloseDfM.Head(10)
```

<table><thead><tr><th>symbol</th><th>avg_close</th></tr></thead><tbody><tr><td>ABI.BR</td><td>54.8642336517953</td></tr><tr><td>AD.AS</td><td>29.652655860161442</td></tr><tr><td>ADS.DE</td><td>205.42648054969996</td></tr><tr><td>ADYEN.AS</td><td>1545.9764069543576</td></tr><tr><td>AI.PA</td><td>145.42844344439317</td></tr></tbody></table>

### GroupBy Multiple Columns

#### Polars.NET | GroupBy multiple columns

Pass multiple column names to `GroupBy()` to create composite group keys. Polars.NET handles this natively — the result has one row per unique combination of the key columns.

*Groups the OHLCV frame by `symbol` and `is_filled` simultaneously, counting rows per combination — confirming that `is_filled` is uniformly `False` for all 50 symbols, so each symbol yields a single group.*

```csharp
// Polars.NET — Group by symbol + is_filled, count rows
var multiGroupP = dfP
    .GroupBy("symbol", "is_filled")
    .Agg(Col("close").Count().Alias("row_count"));

multiGroupP.Head(10)
```

<!-- Polars DataFrame: (10 rows, 3 columns) --><table><thead><tr><th>symbol</th><th>is_filled</th><th>row_count</th></tr></thead><tbody><tr><td>ABI.BR</td><td>false</td><td>1331</td></tr><tr><td>AD.AS</td><td>false</td><td>1331</td></tr><tr><td>ADS.DE</td><td>false</td><td>1324</td></tr><tr><td>ADYEN.AS</td><td>false</td><td>1331</td></tr><tr><td>AI.PA</td><td>false</td><td>1331</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | GroupBy multiple columns

For composite keys, MDA uses the same pattern as single-key grouping but with tuple keys. This keeps the semantics simple and explicit, but the developer owns the grouping state, type choices, and final frame construction.

*Groups by the composite key `(symbol, is_filled)` and materializes row counts per combination into a new MDA dataframe.*

```csharp
// MDA — Group by symbol + is_filled, count rows
var isFilledColM = dfM.Columns["is_filled"];
var filledGroupsM = new Dictionary<(string, bool), int>();

for(long i = 0; i < dfM.Rows.Count; i++)
{
    var s = symColM[i]?.ToString();
    var f = isFilledColM[i] != null && Convert.ToBoolean(isFilledColM[i]);
    if (s != null)
    {
        var key = (s, f);
        if(!filledGroupsM.ContainsKey(key)) filledGroupsM[key] = 0;
        filledGroupsM[key]++;
    }
}

var multiGroupDfM = new MDA.DataFrame(
    new MDA.StringDataFrameColumn("symbol", filledGroupsM.Keys.Select(k => k.Item1)),
    new MDA.PrimitiveDataFrameColumn<bool>("is_filled", filledGroupsM.Keys.Select(k => k.Item2)),
    new MDA.PrimitiveDataFrameColumn<int>("row_count", filledGroupsM.Values)
);
multiGroupDfM.Head(10)
```

<table><thead><tr><th>symbol</th><th>is_filled</th><th>row_count</th></tr></thead><tbody><tr><td>ABI.BR</td><td>False</td><td>1331</td></tr><tr><td>AD.AS</td><td>False</td><td>1331</td></tr><tr><td>ADS.DE</td><td>False</td><td>1324</td></tr><tr><td>ADYEN.AS</td><td>False</td><td>1331</td></tr><tr><td>AI.PA</td><td>False</td><td>1331</td></tr></tbody></table>

### Multiple Aggregations

#### Polars.NET | Multiple aggregations in one Agg call

Pass a list of expressions to `.Agg()` to compute multiple aggregations in a single group-by pass. Each expression names an output column via `.Alias()`. This avoids multiple scans of the data.

*Computes sum, mean, count, min, max of `close` and total `volume` for each of the 50 symbols in a single GroupBy pass — producing a 50-row × 7-column summary frame.*

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

<!-- Polars DataFrame: (10 rows, 7 columns) --><table><thead><tr><th>symbol</th><th>sum_close</th><th>mean_close</th><th>count</th><th>min_close</th><th>max_close</th><th>total_volume</th></tr></thead><tbody><tr><td>ABI.BR</td><td>73024.295</td><td>54.86423366</td><td>1331</td><td>45.06</td><td>68.82</td><td>2114455849</td></tr><tr><td>AD.AS</td><td>39467.685</td><td>29.6526559</td><td>1331</td><td>21.72</td><td>41.77</td><td>3214250982</td></tr><tr><td>ADS.DE</td><td>271984.66</td><td>205.4264804</td><td>1324</td><td>93.95</td><td>336.25</td><td>740793162</td></tr><tr><td>ADYEN.AS</td><td>2057694.6</td><td>1545.976409</td><td>1331</td><td>630.8</td><td>2766</td><td>110400463</td></tr><tr><td>AI.PA</td><td>193565.2582</td><td>145.4284434</td><td>1331</td><td>103.0579</td><td>186.64</td><td>1023869587</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Multiple aggregations in one manual pass

MDA can still compute many statistics efficiently, but the code is explicit rather than declarative. Here a single accumulator structure tracks sum, count, min, max, and volume totals, then emits the grouped summary frame at the end of the scan.

*Computes symbol-level `sum_close`, `mean_close`, `count`, `min_close`, `max_close`, and `total_volume` in one manual pass and previews the first 10 groups.*

```csharp
// MDA — Multiple Aggregations
var volColM = dfM.Columns["volume"];
var multiAggDataM = new Dictionary<string, (double sumC, int count, double minC, double maxC, double sumV)>();

for(long i = 0; i < dfM.Rows.Count; i++)
{
    var s = symColM[i]?.ToString();
    if (s != null && closeColM[i] != null)
    {
        double c = Convert.ToDouble(closeColM[i]);
        double v = volColM[i] != null ? Convert.ToDouble(volColM[i]) : 0;
        if(!multiAggDataM.ContainsKey(s)) multiAggDataM[s] = (0, 0, double.MaxValue, double.MinValue, 0);

        var g = multiAggDataM[s];
        multiAggDataM[s] = (g.sumC + c, g.count + 1, Math.Min(g.minC, c), Math.Max(g.maxC, c), g.sumV + v);
    }
}

var multiAggDfM = new MDA.DataFrame(
    new MDA.StringDataFrameColumn("symbol", multiAggDataM.Keys),
    new MDA.PrimitiveDataFrameColumn<double>("sum_close", multiAggDataM.Values.Select(g => g.sumC)),
    new MDA.PrimitiveDataFrameColumn<double>("mean_close", multiAggDataM.Values.Select(g => g.sumC / g.count)),
    new MDA.PrimitiveDataFrameColumn<int>("count", multiAggDataM.Values.Select(g => g.count)),
    new MDA.PrimitiveDataFrameColumn<double>("min_close", multiAggDataM.Values.Select(g => g.minC)),
    new MDA.PrimitiveDataFrameColumn<double>("max_close", multiAggDataM.Values.Select(g => g.maxC)),
    new MDA.PrimitiveDataFrameColumn<double>("total_volume", multiAggDataM.Values.Select(g => g.sumV))
);
multiAggDfM.Head(10)
```

<table><thead><tr><th>symbol</th><th>sum_close</th><th>mean_close</th><th>count</th><th>min_close</th><th>max_close</th><th>total_volume</th></tr></thead><tbody><tr><td>ABI.BR</td><td>73024.29499053955</td><td>54.8642336517953</td><td>1331</td><td>45.060001373291016</td><td>68.81999969482422</td><td>2114455849</td></tr><tr><td>AD.AS</td><td>39467.68494987488</td><td>29.652655860161442</td><td>1331</td><td>21.719999313354492</td><td>41.77000045776367</td><td>3214250982</td></tr><tr><td>ADS.DE</td><td>271984.66024780273</td><td>205.42648054969996</td><td>1324</td><td>93.94999694824219</td><td>336.25</td><td>740793162</td></tr><tr><td>ADYEN.AS</td><td>2057694.59765625</td><td>1545.9764069543576</td><td>1331</td><td>630.7999877929688</td><td>2766</td><td>110400463</td></tr><tr><td>AI.PA</td><td>193565.2582244873</td><td>145.42844344439317</td><td>1331</td><td>103.05789947509766</td><td>186.63999938964844</td><td>1023869587</td></tr></tbody></table>

### Group Head

#### Polars.NET | Group head (top N per group)

Return the first N rows within each group without collapsing rows. Polars.NET has no `GroupBy().Head(n)` method on `GroupByBuilder`; in the pinned rerun for this note, the documented `.CumSum().Over()` workaround reproduces incorrect output and must be treated as a version-specific failure case rather than a verified recipe.

> [!info] GroupBy().Head() workaround in Polars.NET
>
> Polars Python supports `group_by().head(n)` natively. In Polars.NET 0.4.x this method exists on the `GroupBy` object only for some overloads. The safe workaround is `Lit(1).CumSum().Over("group_col")` to number rows within each group, then `.Filter(Col("row_num") <= Lit(n))`.

> [!bug] Verified failed rerun in the pinned environment
>
> A scratch rerun on `2026-04-16` with `dotnet 10.0.201`, `Polars.NET 0.4.0`, and `Polars.NET.Native.win-x64 0.4.0` reproduced the same failure as the stored notebook output: the result stayed at `66355` rows instead of the expected `150`, and `row_num` dropped to `0` after the first row.
>
> [!warning] Keep this section quarantined until you verify a working overload or package build
>
> For this dataset, the expected result is `50 symbols x 3 rows = 150` rows. If your local build does not produce that, do not treat the row-number pattern below as correct `group head` evidence. Re-check the overloads exposed by your installed package or validate against a newer Polars.NET release before depending on it.

*Attempts the documented `Lit(1).CumSum().Over("symbol")` row-number pattern, but the pinned rerun below confirms that this environment still returns the full 66K-row frame instead of the expected 150-row group head.*

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

```text
Pinned rerun | 2026-04-16 | dotnet 10.0.201 | Polars.NET 0.4.0
Data path: C:\Users\aperi\My Drive\VAULT\data\eurostoxx50_ohlcv.csv
Source shape: (66355, 12)
Group head shape: (66355, 13)

shape: (9, 4)
+--------+------------+-------+---------+
| symbol | date       | close | row_num |
| ---    | ---        | ---   | ---     |
| str    | date       | f64   | i32     |
+=======================================+
| ABI.BR | 2021-01-04 | 57.21 | 1       |
| ABI.BR | 2021-01-05 | 57.18 | 0       |
| ABI.BR | 2021-01-06 | 58.77 | 0       |
| ABI.BR | 2021-01-07 | 58.4  | 0       |
| ABI.BR | 2021-01-08 | 57.86 | 0       |
| ABI.BR | 2021-01-11 | 56.61 | 0       |
| ABI.BR | 2021-01-12 | 56.51 | 0       |
| ABI.BR | 2021-01-13 | 56.48 | 0       |
| ABI.BR | 2021-01-14 | 56.96 | 0       |
+--------+------------+-------+---------+
```

<!-- Polars DataFrame: (9 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>row_num</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>1</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>0</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Group head (top N per group)

MDA has no built-in grouped `head(n)` operator, so the usual pattern is to number rows per group and then build a boolean mask for the first `n` rows in each partition. This is explicit but predictable for small and medium in-process datasets.

*Assigns an intra-symbol row number, filters to the first 3 rows per symbol, confirms the expected 150-row result, and previews the first 9 rows.*

```csharp
// MDA — First 3 rows per symbol (group head equivalent)
var rowNumColM = new MDA.PrimitiveDataFrameColumn<int>("row_num", dfM.Rows.Count);
var symCountsM = new Dictionary<string, int>();
var headMaskM = new MDA.PrimitiveDataFrameColumn<bool>("mask", dfM.Rows.Count);

for(long i = 0; i < dfM.Rows.Count; i++)
{
    var s = symColM[i]?.ToString();
    if (s != null)
    {
        if(!symCountsM.ContainsKey(s)) symCountsM[s] = 0;
        symCountsM[s]++;
        rowNumColM[i] = symCountsM[s];
        headMaskM[i] = symCountsM[s] <= 3;
    }
}

var dfNumberedM = dfM.Clone();
dfNumberedM.Columns.Add(rowNumColM);
var groupHeadDfM = dfNumberedM.Filter(headMaskM);

display($"Group head shape: ({groupHeadDfM.Rows.Count}, {groupHeadDfM.Columns.Count})");
new MDA.DataFrame(groupHeadDfM.Columns["symbol"], groupHeadDfM.Columns["date"], groupHeadDfM.Columns["close"], groupHeadDfM.Columns["row_num"]).Head(9)
```

```text
Group head shape: (150, 13)
```

<table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>row_num</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04 00:00:00Z</td><td>57.21</td><td>1</td></tr><tr><td>ABI.BR</td><td>2021-01-05 00:00:00Z</td><td>57.18</td><td>2</td></tr><tr><td>ABI.BR</td><td>2021-01-06 00:00:00Z</td><td>58.77</td><td>3</td></tr><tr><td>AD.AS</td><td>2021-01-04 00:00:00Z</td><td>23.79</td><td>1</td></tr><tr><td>AD.AS</td><td>2021-01-05 00:00:00Z</td><td>23.68</td><td>2</td></tr></tbody></table>

## Window Functions

Window functions preserve row-level granularity while computing group-relative statistics such as broadcast averages, rankings, and rolling means. Conceptually they are the same family of operations exposed in SQL through `OVER (PARTITION BY ... ORDER BY ...)`, but the execution model differs sharply between Polars expressions and MDA's explicit typed-column materialization.

> [!question] Should this window stay local or move upstream?
>
> Keep window logic in Polars.NET or MDA when the data is already local, the transformation is notebook-scoped, or the result must feed immediate in-process .NET logic. If the source is still in a database or warehouse, prefer SQL window functions for large partitions and wide joins so the engine can optimize sort, frame, and memory behavior before extraction.

The SQL Server gold layer in [gold-transforms](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms) applies the same windowed aggregations to produce final analytical tables.

### Mean over Group

#### Polars.NET | Mean over group

`expr.Over("group_col")` computes a per-group aggregate and broadcasts the result back to every row in the group — equivalent to SQL `AVG(close) OVER (PARTITION BY symbol)`. The original row count is preserved; no grouping collapse occurs.

*Computes the mean `close` per symbol and broadcasts it back to every row via `Mean().Over("symbol")` — every ABI.BR row receives the same `54.86` mean_close_over value without collapsing the 66K-row frame.*

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

<!-- Polars DataFrame: (8 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>mean_close_over</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>54.86423366</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Mean over group

Broadcasted window-style statistics in MDA are usually built from a precomputed group aggregate map. Once the per-symbol means exist, a second pass writes the broadcasted value back to every original row without collapsing the frame.

*Uses the previously computed symbol means to populate a `mean_close_over` column for every row, reproducing `AVG(close) OVER (PARTITION BY symbol)` semantics.*

```csharp
// MDA — Mean close over each symbol (broadcasted to each row)
var meanOverColM = new MDA.PrimitiveDataFrameColumn<double>("mean_close_over", dfM.Rows.Count);

for(long i = 0; i < dfM.Rows.Count; i++)
{
    var s = symColM[i]?.ToString();
    if (s != null && avgGroupsM.ContainsKey(s))
    {
        meanOverColM[i] = avgGroupsM[s].sum / avgGroupsM[s].count;
    }
}

var withMeanDfM = new MDA.DataFrame(dfM.Columns["symbol"], dfM.Columns["date"], dfM.Columns["close"], meanOverColM);
withMeanDfM.Head(8)
```

<table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>mean_close_over</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04 00:00:00Z</td><td>57.21</td><td>54.8642336517953</td></tr><tr><td>ABI.BR</td><td>2021-01-05 00:00:00Z</td><td>57.18</td><td>54.8642336517953</td></tr><tr><td>ABI.BR</td><td>2021-01-06 00:00:00Z</td><td>58.77</td><td>54.8642336517953</td></tr><tr><td>ABI.BR</td><td>2021-01-07 00:00:00Z</td><td>58.4</td><td>54.8642336517953</td></tr><tr><td>ABI.BR</td><td>2021-01-08 00:00:00Z</td><td>57.86</td><td>54.8642336517953</td></tr></tbody></table>

### Rank within Group

#### Polars.NET | Rank within group

`Col("close").Rank().Over("symbol")` assigns a rank (1 = lowest by default) to each row within its group. Ties produce averaged ranks (dense or standard depending on version). Equivalent to SQL `RANK() OVER (PARTITION BY symbol ORDER BY close)`.

*Assigns each ABI.BR close price a rank within its symbol group — e.g., 57.21 on 2021-01-04 ranks 946.5 out of 1331, with ties producing averaged ranks (float output).*

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

<!-- Polars DataFrame: (8 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>rank_in_group</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>946.5</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>940.5</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>1126</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>1085.5</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>1024</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Rank within group

MDA ranking is explicit: collect row indices by group, sort each group by the measure of interest, and assign ordinal positions back into a typed result column. Unlike Polars' default rank behavior, this notebook example uses simple ordinal ranks without tie averaging.

*Builds symbol-specific index lists, sorts each symbol's rows by `close`, assigns ordinal rank positions, and previews the first 8 ranked rows.*

```csharp
// MDA — Rank close price within each symbol
var rankColM = new MDA.PrimitiveDataFrameColumn<double>("rank_in_group", dfM.Rows.Count);
var symIndicesM = new Dictionary<string, List<long>>();

for(long i = 0; i < dfM.Rows.Count; i++)
{
    var s = symColM[i]?.ToString();
    if (s != null)
    {
        if(!symIndicesM.ContainsKey(s)) symIndicesM[s] = new List<long>();
        symIndicesM[s].Add(i);
    }
}

foreach(var kvp in symIndicesM)
{
    var sorted = kvp.Value
        .Where(idx => closeColM[idx] != null)
        .OrderBy(idx => Convert.ToDouble(closeColM[idx]))
        .ToList();

    for(int r = 0; r < sorted.Count; r++) rankColM[sorted[r]] = r + 1;
}

var withRankDfM = new MDA.DataFrame(dfM.Columns["symbol"], dfM.Columns["date"], dfM.Columns["close"], rankColM);
withRankDfM.Head(8)
```

<table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>rank_in_group</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04 00:00:00Z</td><td>57.21</td><td>946</td></tr><tr><td>ABI.BR</td><td>2021-01-05 00:00:00Z</td><td>57.18</td><td>940</td></tr><tr><td>ABI.BR</td><td>2021-01-06 00:00:00Z</td><td>58.77</td><td>1125</td></tr><tr><td>ABI.BR</td><td>2021-01-07 00:00:00Z</td><td>58.4</td><td>1085</td></tr><tr><td>ABI.BR</td><td>2021-01-08 00:00:00Z</td><td>57.86</td><td>1023</td></tr></tbody></table>

### Rolling Mean over Group

#### Polars.NET | Rolling mean over group

`RollingMean("20i")` computes a 20-row trailing mean. Combining it with `.Over("symbol")` ensures the window never crosses group boundaries — rows restart from 1 at each new symbol. The `"20i"` suffix specifies an index-based (row-count) window.

> [!tip] Row-count vs time-based rolling windows
>
> Polars.NET uses `"Ni"` (index-based) or duration strings like `"1d"` (time-based) for window sizes. For OHLCV data with irregular trading calendars, index-based windows (`"20i"`) count rows regardless of calendar gaps — e.g., weekends. Use time-based windows only when actual calendar duration matters.

*Computes a 20-row trailing mean of `close` per symbol via `RollingMean("20i").Over("symbol")` — the window starts from a 1-row mean and reaches full size after 20 rows, resetting at each new symbol.*

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

<!-- Polars DataFrame: (10 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>rolling_mean_20</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>57.21</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>57.195</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>57.72</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>57.89</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>57.884</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Rolling mean over group

Rolling windows in MDA are straightforward but manual: maintain group-local order, scan the trailing frame, and write the aggregate into a typed output column. This is appropriate when the data is already local and the logic is tightly coupled to other .NET code, but it is not a substitute for warehouse-scale window execution.

*Computes a 20-row trailing mean of `close` per symbol using explicit nested loops over group-local row indices and previews the first 10 rows.*

```csharp
// MDA — 20-row rolling mean of close, per symbol
var rollingColM = new MDA.PrimitiveDataFrameColumn<double>("rolling_mean_20", dfM.Rows.Count);

foreach(var kvp in symIndicesM)
{
    var indices = kvp.Value; // Relies on underlying chronological dataset order
    for(int i = 0; i < indices.Count; i++)
    {
        double sum = 0;
        int count = 0;
        for(int j = 0; j < 20 && (i - j) >= 0; j++)
        {
            var cVal = closeColM[indices[i - j]];
            if (cVal != null) { sum += Convert.ToDouble(cVal); count++; }
        }
        if (count > 0) rollingColM[indices[i]] = sum / count;
    }
}

var withRollingDfM = new MDA.DataFrame(dfM.Columns["symbol"], dfM.Columns["date"], dfM.Columns["close"], rollingColM);
withRollingDfM.Head(10)
```

<table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>rolling_mean_20</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04 00:00:00Z</td><td>57.21</td><td>57.209999084472656</td></tr><tr><td>ABI.BR</td><td>2021-01-05 00:00:00Z</td><td>57.18</td><td>57.19499969482422</td></tr><tr><td>ABI.BR</td><td>2021-01-06 00:00:00Z</td><td>58.77</td><td>57.71999994913737</td></tr><tr><td>ABI.BR</td><td>2021-01-07 00:00:00Z</td><td>58.4</td><td>57.890000343322754</td></tr><tr><td>ABI.BR</td><td>2021-01-08 00:00:00Z</td><td>57.86</td><td>57.88400039672852</td></tr></tbody></table>

## Joins

Joins are the point where row-count mistakes become expensive. For tiny dimensions or post-extract enrichment, local joins are fine. For fact-to-fact joins, duplicated keys, or large shuffle-style workloads, prefer database or warehouse execution so the optimizer can reorder joins, push filters early, and avoid unnecessary in-memory expansion.

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

*Joins the 66K-row OHLCV frame (augmented with a `suffix` column) to the 7-row exchange dimension on `suffix`, producing 66355 rows with `exchange_name` and `country` appended — confirming all symbol suffixes match.*

```csharp
// Polars.NET — Inner join OHLCV (with suffix) to exchange dimension
var innerP = dfPWithSuffix.Join(dimExP,
    new[] { Col("suffix") }, new[] { Col("suffix") });

display($"Inner join shape: {innerP.Shape}");
innerP.Select("symbol", "date", "close", "suffix", "exchange_name", "country").Head(8)
```

Inner join shape: (66355, 15)

<!-- Polars DataFrame: (8 rows, 6 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>suffix</th><th>exchange_name</th><th>country</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Inner join

Unlike many other grouped transformations, MDA does expose database-style join primitives directly through `Merge`. That makes dimension enrichment a reasonable in-process workflow when the data is already local and the join keys are small, clean, and well understood.

*Performs an inner merge from the OHLCV frame with computed suffixes into the exchange dimension, confirms the 66,355-row result, and previews the joined columns.*

```csharp
// MDA — Inner join OHLCV (with suffix) to exchange dimension
var innerDfM = dfWithSuffixM.Merge(dimExM, new[] { "suffix" }, new[] { "suffix" }, joinAlgorithm: MDA.JoinAlgorithm.Inner);

display($"Inner join shape: ({innerDfM.Rows.Count}, {innerDfM.Columns.Count})");

// MDA renames the join key. We clone it and rename it back to 'suffix' for a clean projection.
var cleanSuffixM = innerDfM.Columns["suffix_left"].Clone();
cleanSuffixM.SetName("suffix");

new MDA.DataFrame(
    innerDfM.Columns["symbol"],
    innerDfM.Columns["date"],
    innerDfM.Columns["close"],
    cleanSuffixM,
    innerDfM.Columns["exchange_name"],
    innerDfM.Columns["country"]
).Head(8)
```

```text
Inner join shape: (66355, 16)
```

<table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>suffix</th><th>exchange_name</th><th>country</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04 00:00:00Z</td><td>57.21</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-05 00:00:00Z</td><td>57.18</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-06 00:00:00Z</td><td>58.77</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-07 00:00:00Z</td><td>58.4</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-08 00:00:00Z</td><td>57.86</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr></tbody></table>

### Left Join

#### Polars.NET | Left join

`JoinType.Left` keeps all rows from the left frame. Unmatched rows on the right produce `null` in the new columns. Use `.NullCount` on the joined column to verify how many rows had no match.

*Joins OHLCV to a 3-row partial dimension table (only `.DE`, `.PA`, `.AS`), keeping all 66355 rows and producing 15889 null `exchange_name` entries for the unmatched `.BR`, `.MC`, `.MI`, `.HE` suffixes.*

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

<!-- Polars DataFrame: (10 rows, 3 columns) --><table><thead><tr><th>symbol</th><th>suffix</th><th>exchange_name</th></tr></thead><tbody><tr><td>AD.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>ADYEN.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>ASML.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>INGA.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>PRX.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Left join

Left joins in MDA use the same `Merge` primitive with a different join algorithm. This keeps unmatched left rows but materializes right-side nulls directly into the result, making row-count checks and null auditing critical after the merge.

*Left-joins a partial suffix dimension, counts the 15,889 unmatched rows, and previews representative symbols with and without a match.*

```csharp
// MDA — Left join with partial dimM table
var dimPartialM = new MDA.DataFrame(
    new MDA.StringDataFrameColumn("suffix", new[] { ".DE", ".PA", ".AS" }),
    new MDA.StringDataFrameColumn("exchange_name", new[] { "XETRA Frankfurt", "Euronext Paris", "Euronext Amsterdam" })
);

var leftDfM = dfWithSuffixM.Merge(dimPartialM, new[] { "suffix" }, new[] { "suffix" }, joinAlgorithm: MDA.JoinAlgorithm.Left);
display($"Left join shape: ({leftDfM.Rows.Count}, {leftDfM.Columns.Count})");

var nullCountM = 0;
var leftExchM = leftDfM.Columns["exchange_name"];
for(long i = 0; i < leftDfM.Rows.Count; i++) if (leftExchM[i] == null) nullCountM++;

display($"Null exchange_name count: {nullCountM} (unmatched .BR, .MC, .MI, .HE)");

// Unique symbols demonstration
var displayedSymsM = new HashSet<string>();
var partialShowMaskM = new MDA.PrimitiveDataFrameColumn<bool>("mask", leftDfM.Rows.Count);
for(long i = 0; i < leftDfM.Rows.Count; i++)
{
    var s = leftDfM.Columns["symbol"][i]?.ToString();
    if(s != null && !displayedSymsM.Contains(s))
    {
        displayedSymsM.Add(s);
        partialShowMaskM[i] = true;
    }
}

var uniqueLeftM = leftDfM.Filter(partialShowMaskM).OrderBy("suffix_left"); // Use suffix_left here

var cleanSuffixLeftM = uniqueLeftM.Columns["suffix_left"].Clone();
cleanSuffixLeftM.SetName("suffix");

new MDA.DataFrame(uniqueLeftM.Columns["symbol"], cleanSuffixLeftM, uniqueLeftM.Columns["exchange_name"]).Head(10)
```

```text
Left join shape: (66355, 15)
```

```text
Null exchange_name count: 15889 (unmatched .BR, .MC, .MI, .HE)
```

<table><thead><tr><th>symbol</th><th>suffix</th><th>exchange_name</th></tr></thead><tbody><tr><td>WKL.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>AD.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>PRX.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>ADYEN.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>INGA.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr></tbody></table>

### Anti Join

#### Polars.NET | Anti join

`JoinType.Anti` returns only the rows from the left frame whose key has **no match** in the right frame — the inverse of an inner join. Useful for finding data gaps: "which symbols have no entry in the dimension table?"

*Returns the 15889 OHLCV rows whose `suffix` is not in the 3-entry partial dimension table (`.DE`, `.PA`, `.AS` only), isolating `.BR`, `.HE`, `.MI`, `.MC` as unmatched suffixes.*

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

<!-- Polars DataFrame: (8 rows, 3 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>suffix</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>.BR</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Anti join equivalent

MDA has no dedicated anti-join operator in the dataframe API used here, so the practical pattern is a left join followed by a null filter on the right-side enrichment column. This mirrors how engineers often prototype anti joins in SQL before tightening them into a dedicated `ANTI` or `NOT EXISTS` plan.

*Filters the left-join result to rows with null `exchange_name`, confirms the 15,889 unmatched rows, and previews the unmatched suffixes.*

```csharp
// MDA — Anti join equivalent (Left join + filter where right is null)
var antiMaskM = new MDA.PrimitiveDataFrameColumn<bool>("mask", leftDfM.Rows.Count);
for(long i = 0; i < leftDfM.Rows.Count; i++) antiMaskM[i] = leftDfM.Columns["exchange_name"][i] == null;
var antiDfM = leftDfM.Filter(antiMaskM);

display($"Anti join shape: ({antiDfM.Rows.Count}, {antiDfM.Columns.Count}) (rows without .DE, .PA, .AS)");

// Extract unique suffixes using suffix_left
var unqSuffixesM = antiDfM.Columns["suffix_left"].Cast<string>().Where(x => x != null).Distinct().ToList();
display($"Unique unmatched suffixes: {string.Join(", ", unqSuffixesM)}");

var cleanSuffixAntiM = antiDfM.Columns["suffix_left"].Clone();
cleanSuffixAntiM.SetName("suffix");

new MDA.DataFrame(antiDfM.Columns["symbol"], antiDfM.Columns["date"], cleanSuffixAntiM).Head(8)
```

```text
Anti join shape: (15889, 15) (rows without .DE, .PA, .AS)
```

```text
Unique unmatched suffixes: .BR, .MC, .MI, .HE
```

<table><thead><tr><th>symbol</th><th>date</th><th>suffix</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04 00:00:00Z</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-05 00:00:00Z</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-06 00:00:00Z</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-07 00:00:00Z</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-08 00:00:00Z</td><td>.BR</td></tr></tbody></table>

### Semi Join

#### Polars.NET | Semi join

`JoinType.Semi` returns only the rows from the left frame whose key **has a match** in the right frame — but without adding any columns from the right. Use it to filter a large frame down to rows that exist in a reference set.

> [!info] Semi join is a pure existence filter
>
> A semi join keeps only the left-side rows whose keys exist on the right and does not project right-side columns. In MDA, the same idea is usually implemented with a `HashSet<T>`-backed mask; in SQL, use `EXISTS` or `IN` when the data is still remote.

*Filters the 66K-row OHLCV frame to rows whose `suffix` matches one of the 7 entries in the full exchange dimension, keeping all 66355 rows and no right-side columns — confirming no rows are dropped when all suffixes match.*

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

#### Microsoft.Data.Analysis | Semi join via HashSet-backed filter

MDA does not expose a dedicated semi-join algorithm in the same way Polars exposes `how: Semi`. The normal in-process pattern is to collect the right-side keys into a `HashSet<T>`, build a boolean mask over the left frame, and filter the left rows while keeping only left-side columns.

*Builds a `HashSet<string>` from the 7-row exchange dimension, applies a boolean mask across the 66K-row OHLCV frame, and confirms that all 66355 rows survive because every suffix exists in the reference set.*

```csharp
// MDA — Semi join via HashSet-backed filter
var validSuffixesM = dimExM.Columns["suffix"].Cast<string>().Where(x => x != null).ToHashSet();
var semiMaskM = new MDA.PrimitiveDataFrameColumn<bool>("mask", dfWithSuffixM.Rows.Count);

for(long i = 0; i < dfWithSuffixM.Rows.Count; i++)
{
    semiMaskM[i] = validSuffixesM.Contains(dfWithSuffixM.Columns["suffix"][i]?.ToString());
}

var semiDfM = dfWithSuffixM.Filter(semiMaskM);
display($"Semi join shape: ({semiDfM.Rows.Count}, {semiDfM.Columns.Count})  (original: ({dfWithSuffixM.Rows.Count}, {dfWithSuffixM.Columns.Count}))");

new MDA.DataFrame(semiDfM.Columns["symbol"], semiDfM.Columns["date"], semiDfM.Columns["suffix"]).Head(5)
```

```text
Semi join shape: (66355, 13)  (original: (66355, 13))
```

> [!tip] Prefer semi joins as predicates, not enrichment joins
>
> A semi join answers “does a match exist?” and should usually avoid materializing right-side payload columns. When the right frame is large, a full merge just to discard the right columns is unnecessary memory work.

### Cross Join

#### Polars.NET | Cross join

`JoinType.Cross` produces the Cartesian product of two frames: every row on the left is paired with every row on the right. Result row count = `left.rows × right.rows`. Use for generating all combinations of two small sets.

> [!warning] Cross join row explosion
>
> A cross join of two 1,000-row frames produces 1,000,000 rows. Never cross-join large frames without filtering or limiting both sides first. Always verify `result.Shape` before using the output.

> [!info] Cross join is a deliberate Cartesian product
>
> MDA has no dedicated cross-join helper in this notebook workflow. If you need the same behavior, build it explicitly and keep both sides tiny so the multiplicative row growth stays controlled.

*Cross-joins a 2-symbol frame (`ASML.AS`, `MC.PA`) with a 2-value exchange frame (`Primary`, `Secondary`), producing all 4 symbol × exchange combinations — demonstrating the Cartesian product behavior on a minimal example.*

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

#### Microsoft.Data.Analysis | Cross join via explicit Cartesian construction

MDA has no dedicated cross-join helper in this chapter's workflow. If you genuinely need a Cartesian product, build it explicitly with nested loops or by broadcasting a tiny right-side lookup into repeated rows, and do it only after aggressive filtering.

*Builds the same 2-symbol by 2-exchange grid explicitly in MDA, materializes the four Cartesian pairs, and confirms the expected `(4, 2)` result.*

```csharp
// MDA — Cross join via explicit Cartesian construction
var symbolGridM = new[] { "ASML.AS", "MC.PA" };
var exchangeGridM = new[] { "Primary", "Secondary" };
var crossPairsM = new List<(string symbol, string exchange)>();

foreach(var symbol in symbolGridM)
{
    foreach(var exchange in exchangeGridM)
    {
        crossPairsM.Add((symbol, exchange));
    }
}

var crossDfM = new MDA.DataFrame(
    new MDA.StringDataFrameColumn("symbol", crossPairsM.Select(p => p.symbol)),
    new MDA.StringDataFrameColumn("exchange", crossPairsM.Select(p => p.exchange))
);

display($"Cross join shape: ({crossDfM.Rows.Count}, {crossDfM.Columns.Count})");
crossDfM
```

```text
Cross join shape: (4, 2)
```

> [!warning] Cross joins amplify row counts multiplicatively
>
> A `10,000 x 1,000` Cartesian product creates 10 million rows before any downstream transform. This is a memory and notebook-responsiveness risk in both libraries.
>
> [!success] Keep cross joins tiny or move them upstream
>
> Filter both sides first, project only the needed columns, and prefer upstream execution when the product is larger than a small exploratory or feature-grid workload.

---

## Concatenation

### Vertical Concatenation

#### Polars.NET | Vertical concatenation

`.VStack(other)` stacks two frames with the same schema vertically (adds rows). Both frames must have identical column names and types — Polars.NET raises an error on schema mismatch, preventing silent data corruption.

*Splits the first 20 OHLCV rows into two 10-row slices and recombines them with `VStack`, confirming the result is (20, 12) — both slices share the identical 12-column schema.*

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

#### Microsoft.Data.Analysis | Vertical concatenation

MDA does not expose a Polars-style `VStack` convenience, but it can append rows in place once the schema is aligned. This is workable for notebook-sized reconstruction and batch assembly tasks, though repeated row appends are not the pattern to choose for very large concatenation pipelines.

*Splits the first 20 OHLCV rows into two 10-row segments, appends the second segment into a cloned first segment, and verifies the resulting 20-row frame.*

```csharp
// MDA — Split first 10 and next 10, then vertical concat (VStack)
var topM = dfM.Head(10);

var botMaskM = new MDA.PrimitiveDataFrameColumn<bool>("mask", dfM.Rows.Count);
for(long i = 10; i < 20 && i < dfM.Rows.Count; i++) botMaskM[i] = true;
var botM = dfM.Filter(botMaskM);

var vcatM = topM.Clone();
for(long i = 0; i < botM.Rows.Count; i++)
{
    var rowVals = new List<KeyValuePair<string, object>>();
    foreach(var c in botM.Columns) rowVals.Add(new KeyValuePair<string, object>(c.Name, c[i]));
    vcatM.Append(rowVals, inPlace: true);
}

display($"Top: ({topM.Rows.Count}, {topM.Columns.Count})  Bot: ({botM.Rows.Count}, {botM.Columns.Count})  Concat: ({vcatM.Rows.Count}, {vcatM.Columns.Count})");
vcatM.Head(5)
```

```text
Top: (10, 12)  Bot: (10, 12)  Concat: (20, 12)
```

<table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04 00:00:00Z</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05 00:00:00Z</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06 00:00:00Z</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07 00:00:00Z</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08 00:00:00Z</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0</td><td>0</td><td>False</td></tr></tbody></table>

### Horizontal Concatenation

#### Polars.NET | Horizontal concatenation

`.HStack(series)` appends a single `Series` as a new column. To add multiple columns from another frame, call `.HStack()` once per column. Both frames must have the same number of rows.

*Splits the first 5 OHLCV rows into a 3-column left frame and a 3-column right frame, then rebuilds a (5, 6) frame via three sequential `HStack` calls — adding `volume`, `high`, and `low` one column at a time.*

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

#### Microsoft.Data.Analysis | Horizontal concatenation

Horizontal combination in MDA is schema-first rather than key-aware by default. If two frames already have the same row alignment, columns can simply be appended; if alignment depends on keys, use a join instead of column stacking.

*Clones a 3-column left frame, appends three more columns from a right frame with matching row counts, and confirms the resulting 5-row, 6-column shape.*

```csharp
// MDA — Horizontal concat (HStack equivalent)
var leftColsM = new MDA.DataFrame(dfM.Columns["symbol"], dfM.Columns["date"], dfM.Columns["close"]).Head(5);
var rightColsM = new MDA.DataFrame(dfM.Columns["volume"], dfM.Columns["high"], dfM.Columns["low"]).Head(5);

var hcatM = leftColsM.Clone();
foreach(var c in rightColsM.Columns) hcatM.Columns.Add(c);

display($"Left: ({leftColsM.Rows.Count}, {leftColsM.Columns.Count})  Right: ({rightColsM.Rows.Count}, {rightColsM.Columns.Count})  HStacked: ({hcatM.Rows.Count}, {hcatM.Columns.Count})");
hcatM
```

```text
Left: (5, 3)  Right: (5, 3)  HStacked: (5, 6)
```

<table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th><th>high</th><th>low</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04 00:00:00Z</td><td>57.21</td><td>1513937</td><td>58.85</td><td>56.78</td></tr><tr><td>ABI.BR</td><td>2021-01-05 00:00:00Z</td><td>57.18</td><td>1382722</td><td>57.98</td><td>56.75</td></tr><tr><td>ABI.BR</td><td>2021-01-06 00:00:00Z</td><td>58.77</td><td>1370204</td><td>58.94</td><td>57.39</td></tr><tr><td>ABI.BR</td><td>2021-01-07 00:00:00Z</td><td>58.4</td><td>1469911</td><td>58.86</td><td>57.88</td></tr><tr><td>ABI.BR</td><td>2021-01-08 00:00:00Z</td><td>57.86</td><td>1428681</td><td>58.4</td><td>57.43</td></tr></tbody></table>

## Reshaping

Pivot and melt are often presentation or feature-construction steps rather than core storage layouts. Wide pivots can explode column counts, while unpivot multiplies row counts. The safest pattern is to filter and aggregate first, then reshape only the subset that genuinely needs a wide report matrix or a long modeling layout.

### Pivot (Long to Wide)

#### Polars.NET | Pivot (long to wide)

`.Pivot(columnSelector, indexSelector, valueSelector)` rotates a long frame to wide format: unique values in the column selector become new column headers. Use when you need one row per date and one column per symbol.

*Pivots 30 rows of close prices for ASML.AS, SAP.DE, and MC.PA from long format into a (1, 31)-shaped frame — one row per symbol with each of the 30 dates as a separate column header.*

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

#### Microsoft.Data.Analysis | Pivot (long to wide)

MDA has no single-call pivot API in this notebook workflow, so pivoting means explicitly enumerating the unique row and column keys, creating the wide schema, and populating the matrix cell by cell. That is acceptable for controlled reporting subsets, but it is not the reshape you want to improvise over high-cardinality columns.

*Filters 30 rows for three symbols, dynamically constructs a wide dataframe with one symbol row and date columns, confirms the pivot shape, and previews the wide result.*

```csharp
// MDA — Pivot: daily close prices with symbols as columns
var filterSymsM = new[] { "SAP.DE", "ASML.AS", "MC.PA" };
var pivotMaskM = new MDA.PrimitiveDataFrameColumn<bool>("mask", dfM.Rows.Count);
int addedM = 0;
for(long i = 0; i < dfM.Rows.Count && addedM < 30; i++)
{
    var s = symColM[i]?.ToString();
    if(s != null && filterSymsM.Contains(s))
    {
        pivotMaskM[i] = true;
        addedM++;
    }
}

var pivotSubsetM = dfM.Filter(pivotMaskM);
var finalSubsetM = new MDA.DataFrame(pivotSubsetM.Columns["symbol"], pivotSubsetM.Columns["date"], pivotSubsetM.Columns["close"]);
display($"Subset: ({finalSubsetM.Rows.Count}, {finalSubsetM.Columns.Count})");

// Extract distinct pivot values
var pivotSymsM = finalSubsetM.Columns["symbol"].Cast<string>().Distinct().ToList();
var pivotDatesM = finalSubsetM.Columns["date"].Cast<DateTime?>().Distinct().OrderBy(d => d).ToList();

// Build dynamically pivoted columns
var pivotColsM = new List<MDA.DataFrameColumn>();

// Initialize the String column safely using the explicit length
var symColumnM = new MDA.StringDataFrameColumn("symbol", pivotSymsM.Count);
for(int i = 0; i < pivotSymsM.Count; i++) symColumnM[i] = pivotSymsM[i];
pivotColsM.Add(symColumnM);

foreach(var d in pivotDatesM)
{
    pivotColsM.Add(new MDA.PrimitiveDataFrameColumn<double>(d?.ToString("yyyy-MM-dd"), pivotSymsM.Count));
}
var pivotDfM = new MDA.DataFrame(pivotColsM);

// Populate matrix
for(long i = 0; i < finalSubsetM.Rows.Count; i++)
{
    var s = finalSubsetM.Columns["symbol"][i]?.ToString();
    var d = ((DateTime?)finalSubsetM.Columns["date"][i])?.ToString("yyyy-MM-dd");
    var c = Convert.ToDouble(finalSubsetM.Columns["close"][i]);

    int rIdx = pivotSymsM.IndexOf(s);
    if(rIdx >= 0 && d != null) pivotDfM.Columns[d][rIdx] = c;
}

display($"Pivot shape: ({pivotDfM.Rows.Count}, {pivotDfM.Columns.Count})");

// FIXED: Manually clamp the Head request to avoid MDA's out-of-bounds bug
int headCountM = (int)Math.Min(10, pivotDfM.Rows.Count);
pivotDfM.Head(headCountM)
```

```text
Subset: (30, 3)
```

```text
Pivot shape: (1, 31)
```

<table><thead><tr><th>symbol</th><th>2021-01-04</th><th>2021-01-05</th><th>2021-01-06</th><th>2021-01-07</th><th>2021-01-08</th><th>2021-01-11</th><th>2021-01-12</th><th>2021-01-13</th><th>2021-01-14</th><th>2021-01-15</th><th>2021-01-18</th><th>2021-01-19</th><th>2021-01-20</th><th>2021-01-21</th><th>2021-01-22</th><th>2021-01-25</th><th>2021-01-26</th><th>2021-01-27</th><th>2021-01-28</th><th>2021-01-29</th><th>2021-02-01</th><th>2021-02-02</th><th>2021-02-03</th><th>2021-02-04</th><th>2021-02-05</th><th>2021-02-08</th><th>2021-02-09</th><th>2021-02-10</th><th>2021-02-11</th><th>2021-02-12</th></tr></thead><tbody><tr><td>ASML.AS</td><td>406.25</td><td>406.8999938964844</td><td>402.8500061035156</td><td>403.8999938964844</td><td>416.04998779296875</td><td>414.8999938964844</td><td>418.95001220703125</td><td>422.45001220703125</td><td>447.3500061035156</td><td>435.8500061035156</td><td>437.6000061035156</td><td>439.8999938964844</td><td>453.1499938964844</td><td>470.54998779296875</td><td>462.8999938964844</td><td>461.3500061035156</td><td>458.54998779296875</td><td>440.6499938964844</td><td>449</td><td>439.45001220703125</td><td>454.8999938964844</td><td>457.5</td><td>457.1499938964844</td><td>459.54998779296875</td><td>460</td><td>467.1000061035156</td><td>469.75</td><td>464.1000061035156</td><td>480.45001220703125</td><td>494.75</td></tr></tbody></table>

### Unpivot (Wide to Long)

#### Polars.NET | Unpivot (wide to long)

`.Unpivot(on, index)` is the inverse of pivot: the columns named in `on` become rows in a new `variable` column, with their values in a `value` column. The `index` columns are preserved as-is per row. Result shape: `n_rows × len(on)` rows.

*Melts the 4 OHLC columns of the first 5 OHLCV rows from wide to long format, expanding (5, 6) into (20, 4) — with `variable` cycling through `open`, `high`, `low`, `close` and `value` holding the corresponding price.*

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

<!-- Polars DataFrame: (12 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>variable</th><th>value</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>open</td><td>58.15</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>open</td><td>56.9</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>open</td><td>57.96</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>open</td><td>58.68</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>open</td><td>58.16</td></tr></tbody></table></div>

#### Microsoft.Data.Analysis | Unpivot (wide to long)

Unpivot in MDA is the inverse manual process: iterate the measure columns, emit one output row per original value, and materialize the long-form result into typed columns. This pattern is common when preparing features for charting, model input, or uniform rule evaluation.

*Takes a 5-row OHLC subset, emits one row per `open`, `high`, `low`, and `close` value, and materializes the expected 20-row long dataframe.*

```csharp
// MDA — Melt/Unpivot: turn OHLC columns into rows
var ohlcSubsetM = new MDA.DataFrame(dfM.Columns["symbol"], dfM.Columns["date"], dfM.Columns["open"], dfM.Columns["high"], dfM.Columns["low"], dfM.Columns["close"]).Head(5);

var varsM = new[] { "open", "high", "low", "close" };
// FIXED: Changed int to long
long meltedCountM = ohlcSubsetM.Rows.Count * varsM.Length;

var meltSymM = new MDA.StringDataFrameColumn("symbol", meltedCountM);
var meltDateM = new MDA.PrimitiveDataFrameColumn<DateTime>("date", meltedCountM);
var meltVarM = new MDA.StringDataFrameColumn("variable", meltedCountM);
var meltValM = new MDA.PrimitiveDataFrameColumn<double>("value", meltedCountM);

long mIdxM = 0; // FIXED: Consistent with long indexing
foreach(var v in varsM)
{
    for(long i = 0; i < ohlcSubsetM.Rows.Count; i++)
    {
        meltSymM[mIdxM] = ohlcSubsetM.Columns["symbol"][i]?.ToString();
        if(ohlcSubsetM.Columns["date"][i] is DateTime dt) meltDateM[mIdxM] = dt;
        meltVarM[mIdxM] = v;
        meltValM[mIdxM] = Convert.ToDouble(ohlcSubsetM.Columns[v][i]);
        mIdxM++;
    }
}

var meltedDfM = new MDA.DataFrame(meltSymM, meltDateM, meltVarM, meltValM);
display($"Melted shape: ({meltedDfM.Rows.Count}, {meltedDfM.Columns.Count})");
meltedDfM.Head(12)
```

```text
Melted shape: (20, 4)
```

<table><thead><tr><th>symbol</th><th>date</th><th>variable</th><th>value</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04 00:00:00Z</td><td>open</td><td>58.150001525878906</td></tr><tr><td>ABI.BR</td><td>2021-01-05 00:00:00Z</td><td>open</td><td>56.900001525878906</td></tr><tr><td>ABI.BR</td><td>2021-01-06 00:00:00Z</td><td>open</td><td>57.959999084472656</td></tr><tr><td>ABI.BR</td><td>2021-01-07 00:00:00Z</td><td>open</td><td>58.68000030517578</td></tr><tr><td>ABI.BR</td><td>2021-01-08 00:00:00Z</td><td>open</td><td>58.15999984741211</td></tr></tbody></table>

## Summary Comparison

| Operation | Polars.NET | Microsoft.Data.Analysis |
|---|---|---|
| **GroupBy + single agg** | `.GroupBy("col").Agg(Col("x").Mean())` | Manual accumulator dictionary, then materialize grouped result frame |
| **GroupBy + multi agg** | `.GroupBy().Agg(sum, mean, count, ...)` in one call | Single explicit pass is possible, but you manage accumulator state and output schema |
| **GroupBy multiple cols** | `.GroupBy("a", "b")` | Tuple-key dictionary aggregation |
| **Group head** | Expression workaround or grouped row-numbering pattern | Manual row numbering plus boolean mask |
| **Window: mean over** | `Col("x").Mean().Over("g")` | Precompute group means, then broadcast via second pass |
| **Window: rank** | `Col("x").Rank().Over("g")` | Sort indices within each group and assign ordinal ranks explicitly |
| **Window: rolling** | `Col("x").RollingMean("20i").Over("g")` | Manual trailing-window loop per group |
| **Inner / left join** | `.Join(..., how: Inner/Left)` | `Merge(..., joinAlgorithm: ...)` |
| **Anti join** | `.Join(..., how: Anti)` | Left merge plus null filter on right-side columns |
| **Semi join** | `.Join(..., how: Semi)` | HashSet-backed filter pattern |
| **Cross join** | `.Join(..., how: Cross)` | Manual Cartesian construction only for tiny sets |
| **Vertical concat** | `.VStack(other)` | Clone and `Append(..., inPlace: true)` row by row |
| **Horizontal concat** | `.HStack(series)` / select-then-stack | Append aligned columns directly; use `Merge` when alignment is key-based |
| **Pivot** | `.Pivot(...)` | Build the wide schema and populate cells manually |
| **Unpivot / Melt** | `.Unpivot(on, index)` | Emit long-form rows manually and materialize typed result columns |

> [!question] Which library should own aggregation and reshape work?
>
> Prefer **Polars.NET** when the main job is analytical transformation: many grouped metrics, chained windows, repeated joins, reshape-heavy notebook work, or pipelines that benefit from a compact expression API and a clearer transformation graph.
>
> Prefer **Microsoft.Data.Analysis** when the dataframe is one in-process component inside a broader .NET application: custom CLR logic, typed column control, ML.NET-adjacent preparation, or explicit notebook demonstrations where transparency matters more than terse syntax.
>
> Prefer **neither** for warehouse-scale joins, large rollups, or fact-to-fact windows if the data is still remote. Push those operations upstream into SQL, Spark, DuckDB, or the warehouse engine and use Polars or MDA after extraction for local enrichment, QA, feature prep, or presentation reshapes.

> [!quote]+
>
> Assemble pipelines as isolated, reusable transformations and let the right execution engine own the expensive stage.
>
> Source: Eberhard Wolff | Data Management at Scale Modern Data Architecture with Data Mesh and Data Fabric - 2nd Edition.pdf

---

## Operational Risks

### API Semantics

#### Reassign `Filter()` and `Sort()` results in `Polars.NET`

`Polars.NET` transforms return a new dataframe. If you call `Filter()` or `Sort()` and discard the returned frame, the original stays unchanged.

*Runs a minimal reassignment contrast and prints the retained and transformed values.*

```csharp
var originalValues = new[] { 1, 2, 3 };
var transformedValues = originalValues.Select(x => x * 10).ToArray();

Console.WriteLine($"Original: {string.Join(", ", originalValues)}");
Console.WriteLine($"Transformed: {string.Join(", ", transformedValues)}");
```

```text
Original: 1, 2, 3
Transformed: 10, 20, 30
```

#### Keep `IfElse()` syntax distinct from `When().Then().Otherwise()`

Treat `IfElse()` as the C# binding surface rather than assuming the Python `when/then/otherwise` chain exists unchanged.

*Runs a minimal branch and prints the selected value for an `IfElse()`-style condition.*

```csharp
var x = 4;
var branch = x > 0 ? "positive" : "non-positive";

Console.WriteLine($"Branch result: {branch}");
```

```text
Branch result: positive
```

### Schema Boundaries

#### Map Arrow-style and CLR types explicitly

`Polars.NET` exposes Arrow-oriented types while `Microsoft.Data.Analysis` uses CLR-backed `DataFrameColumn` implementations. Crossing that boundary without an explicit mapping invites schema drift.

*Prints a simple type map for a common numeric handoff.*

```csharp
var polarsType = "Float64";
var mdaType = "DoubleDataFrameColumn";

Console.WriteLine($"Map {polarsType} -> {mdaType}");
```

```text
Map Float64 -> DoubleDataFrameColumn
```

## Recommended Patterns

### Transformation Ownership

#### Keep reshape-heavy work in `Polars.NET`

Use `GroupBy()`, `.Over()`, `JoinType.Semi`, and `Pivot()` in `Polars.NET` when the transformation graph itself is the main deliverable.

*Runs a simple routing rule that sends reshape-heavy workloads to the Polars branch.*

```csharp
var workload = "reshape-heavy";
var engineForTransforms = workload == "reshape-heavy" ? "Polars.NET" : "Microsoft.Data.Analysis";

Console.WriteLine($"Recommended engine: {engineForTransforms}");
```

```text
Recommended engine: Polars.NET
```

#### Use `Microsoft.Data.Analysis` at `IDataView` boundaries

Keep `Microsoft.Data.Analysis` when the dataframe is an in-process staging object for CLR-heavy code or downstream `IDataView` consumers.

*Runs a simple routing rule for an `IDataView`-style handoff.*

```csharp
var target = "IDataView";
var engineForBoundary = target == "IDataView" ? "Microsoft.Data.Analysis" : "Polars.NET";

Console.WriteLine($"Recommended engine: {engineForBoundary}");
```

```text
Recommended engine: Microsoft.Data.Analysis
```

### Contract Checks

#### Assert schema after `GroupBy()` or `Pivot()`

After `GroupBy()` or `Pivot()`, validate the resulting column contract before feeding the output into later joins, exports, or model code.

*Builds a minimal expected-schema check and prints whether the contract matches.*

```csharp
var expectedColumns = new[] { "symbol", "avg_close" };
var actualColumns = new[] { "symbol", "avg_close" };
var schemaMatches = expectedColumns.SequenceEqual(actualColumns);

Console.WriteLine($"Schema matches: {schemaMatches}");
```

```text
Schema matches: True
```

## C# Aggregation and Reshaping Troubleshooting

### Failure Modes

#### Unchanged result after `WithColumns()`

If a Polars transform appears unchanged, confirm you kept the returned frame rather than discarding the result of `WithColumns()`.

*Runs a minimal before-and-after check that prints the original and reassigned values.*

```csharp
var baseline = new[] { 2, 4, 6 };
var reassigned = baseline.Select(x => x + 1).ToArray();

Console.WriteLine($"Baseline: {string.Join(", ", baseline)}");
Console.WriteLine($"Reassigned: {string.Join(", ", reassigned)}");
```

```text
Baseline: 2, 4, 6
Reassigned: 3, 5, 7
```

#### `ComputeError` during `Cast()`

Cast failures usually mean at least one row cannot be converted to the requested target type. Clean or branch those rows before calling `Cast()`.

*Runs a guarded parse and prints the values that would fail a numeric cast.*

```csharp
var rawValues = new[] { "10", "11.5", "bad" };
var invalidValues = rawValues.Where(x => !double.TryParse(x, out _)).ToArray();

Console.WriteLine($"Invalid values: {string.Join(", ", invalidValues)}");
```

```text
Invalid values: bad
```

#### Match the `DataFrameColumn` type to the CLR payload

When `Microsoft.Data.Analysis` column construction fails, verify that the chosen `DataFrameColumn` matches the CLR value type actually stored in the input.

*Prints the expected column class for a simple integer payload.*

```csharp
var payloadType = typeof(int).Name;
var columnType = "Int32DataFrameColumn";

Console.WriteLine($"Payload {payloadType} -> {columnType}");
```

```text
Payload Int32 -> Int32DataFrameColumn
```

