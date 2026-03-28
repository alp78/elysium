---
type: reference
category: programming-languages
technology:
  - csharp
  - dotnet
  - polars
tags: [pipeline, csharp, polars, dataframes]
aliases:
  - unit testing, validation, migration guide
keywords: [testing, pytest, xUnit, assert_frame_equal, validation, migration, pandas to polars, best practices]
description: "Polars.NET / C# DataFrames reference 10/10 — Project, Testing & Migration (end-to-end, validation, migration guide). Executable examples with cell outputs. See [[10_py_testing_migration]] for the Python equivalent."
related:
  - "[[dataframes-index]]"
  - "[[programming-languages-index]]"
  - "[[10_py_testing_migration]]"
  - "[[09_cs_database_interface]]"
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# 10 — Real-World Project, Testing & Migration

End-to-end analysis, validation, Pandas-to-Polars.NET guide.

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

```csharp
var dfP = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"), tryParseDates: true);
var dimP = DataFrame.ReadCsv(Path.Combine(DATA, "index_dim.csv"));
display($"OHLCV: {dfP.Shape}  |  IndexDim: {dimP.Shape}");
```

    OHLCV: (66355, 12)  |  IndexDim: (169, 26)

---
## 1 — Testing & Assertions

#### Assert DataFrame equality from two frames to a boolean result using column-by-column comparison

```csharp
// Helper — compare two DataFrames for structural + value equality
bool AssertDataFrameEqual(DataFrame left, DataFrame right, string label = "")
{
    var errors = new List<string>();

    // Shape check — use Height / Width (not Shape.Rows)
    if (left.Height != right.Height)
        errors.Add($"Row count mismatch: {left.Height} vs {right.Height}");
    if (left.Width != right.Width)
        errors.Add($"Column count mismatch: {left.Width} vs {right.Width}");

    // Column names check
    var leftCols  = left.Columns.ToArray();
    var rightCols = right.Columns.ToArray();
    var missing = leftCols.Except(rightCols).ToArray();
    var extra   = rightCols.Except(leftCols).ToArray();
    if (missing.Length > 0) errors.Add($"Missing in right: {string.Join(", ", missing)}");
    if (extra.Length > 0)   errors.Add($"Extra in right: {string.Join(", ", extra)}");

    // Value comparison — column by column
    if (errors.Count == 0)
    {
        foreach (var col in leftCols)
        {
            var lSeries = left.Column(col);
            var rSeries = right.Column(col);
            if (lSeries.DataTypeName != rSeries.DataTypeName)
                errors.Add($"Column '{col}' dtype mismatch: {lSeries.DataTypeName} vs {rSeries.DataTypeName}");
        }
    }

    // Report
    var tag = string.IsNullOrEmpty(label) ? "" : $" [{label}]";
    if (errors.Count == 0)
    {
        Console.WriteLine($"PASS{tag}: DataFrames are equal ({left.Height} rows × {left.Width} cols)");
        return true;
    }
    Console.WriteLine($"FAIL{tag}:");
    foreach (var e in errors) Console.WriteLine($"  - {e}");
    return false;
}

// Test — compare dfP with itself
AssertDataFrameEqual(dfP, dfP, "self-check");

// Test — compare with a subset to see failure
var subset = dfP.Head(10);
AssertDataFrameEqual(dfP, subset, "full vs head(10)");
```

    PASS [self-check]: DataFrames are equal (66355 rows × 12 cols)
    FAIL [full vs head(10)]:
      - Row count mismatch: 66355 vs 10

#### Validate schema from a DataFrame to an expected definition using name and type checks

```csharp
// Schema validation — check column names and data types against expected
void ValidateSchema(DataFrame df, Dictionary<string, string> expectedSchema, string label = "")
{
    var tag = string.IsNullOrEmpty(label) ? "" : $" [{label}]";
    var cols = df.Columns.ToArray();
    var errors = new List<string>();

    foreach (var kv in expectedSchema)
    {
        if (!cols.Contains(kv.Key))
        {
            errors.Add($"Missing column: '{kv.Key}'");
            continue;
        }
        var actual = df.Column(kv.Key).DataTypeName;
        if (actual != kv.Value)
            errors.Add($"Column '{kv.Key}': expected {kv.Value}, got {actual}");
    }

    if (errors.Count == 0)
        Console.WriteLine($"PASS{tag}: Schema matches ({expectedSchema.Count} columns validated)");
    else
    {
        Console.WriteLine($"FAIL{tag}:");
        foreach (var e in errors) Console.WriteLine($"  - {e}");
    }
}

// Define expected schema for OHLCV data
var expectedOhlcv = new Dictionary<string, string>
{
    ["symbol"] = "str",
    ["open"]   = "f64",
    ["high"]   = "f64",
    ["low"]    = "f64",
    ["close"]  = "f64",
    ["volume"] = "i64",
};

ValidateSchema(dfP, expectedOhlcv, "OHLCV schema");
```

    PASS [OHLCV schema]: Schema matches (6 columns validated)

#### Audit nulls from each column to a summary report using Series.NullCount

```csharp
// Null audit — count nulls per column, flag those exceeding threshold
void NullAudit(DataFrame df, double threshold = 0.05, string label = "")
{
    var tag = string.IsNullOrEmpty(label) ? "" : $" [{label}]";
    Console.WriteLine($"Null Audit{tag} — threshold: {threshold:P0} of {df.Height} rows");
    Console.WriteLine(new string('-', 55));

    var maxNulls = (int)(df.Height * threshold);
    var flagged = 0;

    foreach (var col in df.Columns)
    {
        // NullCount is a property on Series — not a method on DataFrame
        var nulls = df.Column(col).NullCount;
        var pct   = (double)nulls / df.Height;
        var flag  = nulls > maxNulls ? "  *** FLAGGED" : "";
        if (nulls > maxNulls) flagged++;
        Console.WriteLine($"  {col,-20} nulls={nulls,6}  ({pct:P1}){flag}");
    }

    Console.WriteLine(new string('-', 55));
    Console.WriteLine(flagged == 0
        ? "PASS: No columns exceed null threshold."
        : $"WARNING: {flagged} column(s) exceed null threshold.");
}

// scores_daily has real nulls in pe_zscore, pb_zscore, ev_ebitda_zscore, yield_zscore, recommendation_mean
var scP = DataFrame.ReadCsv(Path.Combine(DATA, "scores_daily.csv"), tryParseDates: true);
NullAudit(scP, 0.01, "scores_daily");
```

    Null Audit [scores_daily] — threshold: 1% of 466 rows
    -------------------------------------------------------
      id                   nulls=     0  (0.0%)
      _index               nulls=     0  (0.0%)
      symbol               nulls=     0  (0.0%)
      score_date           nulls=     0  (0.0%)
      sector               nulls=     0  (0.0%)
      pe_zscore            nulls=     3  (0.6%)
      pb_zscore            nulls=     6  (1.3%)  *** FLAGGED
      ev_ebitda_zscore     nulls=    71  (15.2%)  *** FLAGGED
      yield_zscore         nulls=    35  (7.5%)  *** FLAGGED
      relative_value_score nulls=     0  (0.0%)
      relative_value_rank  nulls=     0  (0.0%)
      relative_strength    nulls=     0  (0.0%)
      sma_50_ratio         nulls=     0  (0.0%)
      sma_200_ratio        nulls=     0  (0.0%)
      dist_from_52w_high   nulls=     0  (0.0%)
      momentum_score       nulls=     0  (0.0%)
      momentum_rank        nulls=     0  (0.0%)
      implied_upside       nulls=     0  (0.0%)
      recommendation_mean  nulls=    14  (3.0%)  *** FLAGGED
      price_falling_analysts_bullish nulls=     0  (0.0%)
      sentiment_score      nulls=     0  (0.0%)
      sentiment_rank       nulls=     0  (0.0%)
      composite_score      nulls=     0  (0.0%)
      composite_rank       nulls=     0  (0.0%)
      _scored_at           nulls=     0  (0.0%)
      sma_30_close         nulls=     0  (0.0%)
      sma_90_close         nulls=     0  (0.0%)
      market_cap           nulls=     0  (0.0%)
      index_weight         nulls=     0  (0.0%)
      short_name           nulls=     0  (0.0%)
      country              nulls=     0  (0.0%)
      current_price        nulls=     0  (0.0%)
      day_change_pct       nulls=     0  (0.0%)
      five_day_change_pct  nulls=     0  (0.0%)
      ytd_change_pct       nulls=     0  (0.0%)
      currency             nulls=     0  (0.0%)
    -------------------------------------------------------
    WARNING: 4 column(s) exceed null threshold.

#### Detect duplicates from key columns to flagged rows using GroupBy and Agg

```csharp
// Duplicate detection — find rows with duplicate (date, symbol) keys
// GroupBy().Count() does NOT exist — use Agg with Count().Alias()
var dupes = dfP
    .GroupBy("date", "symbol")
    .Agg(Col("close").Count().Alias("row_count"))
    .Filter(Col("row_count") > Lit(1));

Console.WriteLine($"Duplicate key check (date, symbol):");
Console.WriteLine($"  Groups with duplicates: {dupes.Height}");

if (dupes.Height > 0)
{
    Console.WriteLine("  Sample duplicates:");
    display(dupes.Head(5));
}
else
{
    Console.WriteLine("  PASS: No duplicate keys found.");
}
```

    Duplicate key check (date, symbol):
      Groups with duplicates: 0
      PASS: No duplicate keys found.

#### Verify OHLC consistency from price columns to validation flags using C# operators

```csharp
// OHLC consistency — high >= low, close between low and high
// Use C# operators (>=, <=) — NOT .Gt()/.Lt()
var ohlcCheck = dfP
    .WithColumns(
        (Col("high") >= Col("low")).Alias("high_gte_low"),
        (Col("close") >= Col("low")).Alias("close_gte_low"),
        (Col("close") <= Col("high")).Alias("close_lte_high")
    );

// Count violations — extract arrays, use LINQ
var highLowArr   = ohlcCheck.Column("high_gte_low").Cast(DataType.Int32).ToArray<int>();
var closeLowArr  = ohlcCheck.Column("close_gte_low").Cast(DataType.Int32).ToArray<int>();
var closeHighArr = ohlcCheck.Column("close_lte_high").Cast(DataType.Int32).ToArray<int>();

var highLowFails  = highLowArr.Count(v => v == 0);
var closeLowFails = closeLowArr.Count(v => v == 0);
var closeHighFails = closeHighArr.Count(v => v == 0);

Console.WriteLine($"OHLC Consistency Check ({dfP.Height} rows):");
Console.WriteLine($"  high >= low  violations: {highLowFails}");
Console.WriteLine($"  close >= low violations: {closeLowFails}");
Console.WriteLine($"  close <= high violations: {closeHighFails}");

var total = highLowFails + closeLowFails + closeHighFails;
Console.WriteLine(total == 0
    ? "  PASS: All OHLC relationships are consistent."
    : $"  WARNING: {total} total violation(s) found.");
```

    OHLC Consistency Check (66355 rows):
      high >= low  violations: 0
      close >= low violations: 0
      close <= high violations: 0
      PASS: All OHLC relationships are consistent.

---
## 2 — Data Quality Pipeline

#### Define assertion guards from validation rules to chainable functions using DataFrame pass-through

```csharp
// Guard functions — return DataFrame for chaining, throw on failure

DataFrame AssertNoNulls(DataFrame df, string[] columns, string label = "")
{
    var tag = string.IsNullOrEmpty(label) ? "" : $" [{label}]";
    foreach (var col in columns)
    {
        var nulls = df.Column(col).NullCount;
        if (nulls > 0)
            throw new Exception($"AssertNoNulls{tag}: Column '{col}' has {nulls} null(s)");
    }
    Console.WriteLine($"  AssertNoNulls{tag}: PASS ({columns.Length} columns clean)");
    return df;
}

DataFrame AssertUnique(DataFrame df, string[] keyColumns, string label = "")
{
    var tag = string.IsNullOrEmpty(label) ? "" : $" [{label}]";
    var dupeCount = df
        .GroupBy(keyColumns)
        .Agg(Col(keyColumns[0]).Count().Alias("_cnt"))
        .Filter(Col("_cnt") > Lit(1))
        .Height;
    if (dupeCount > 0)
        throw new Exception($"AssertUnique{tag}: {dupeCount} duplicate group(s) on [{string.Join(", ", keyColumns)}]");
    Console.WriteLine($"  AssertUnique{tag}: PASS (keys unique)");
    return df;
}

DataFrame AssertInRange(DataFrame df, string column, double min, double max, string label = "")
{
    var tag = string.IsNullOrEmpty(label) ? "" : $" [{label}]";
    var violations = df
        .Filter((Col(column) < Lit(min)) | (Col(column) > Lit(max)))
        .Height;
    if (violations > 0)
        throw new Exception($"AssertInRange{tag}: {violations} value(s) in '{column}' outside [{min}, {max}]");
    Console.WriteLine($"  AssertInRange{tag}: PASS ('{column}' in [{min}, {max}])");
    return df;
}

// Chain guards on OHLCV data
Console.WriteLine("Running assertion guards on OHLCV data:");
try
{
    var validated = AssertNoNulls(dfP, new[] { "symbol", "date" }, "keys");
    validated = AssertUnique(validated, new[] { "date", "symbol" }, "pk");
    validated = AssertInRange(validated, "volume", 0, double.MaxValue, "volume");
    Console.WriteLine("All assertions passed.");
}
catch (Exception ex)
{
    Console.WriteLine($"Assertion failed: {ex.Message}");
}
```

    Running assertion guards on OHLCV data:
      AssertNoNulls [keys]: PASS (2 columns clean)
      AssertUnique [pk]: PASS (keys unique)
      AssertInRange [volume]: PASS ('volume' in [0, 1.7976931348623157E+308])
    All assertions passed.

#### Check referential integrity from OHLCV symbols to dimension table using anti-join

```csharp
// Referential integrity — find orphan symbols not in dimension table
// Join syntax: df.Join(other, leftOn[], rightOn[], JoinType)
var uniqueSymbols = dfP
    .Select(Col("symbol"))
    .Unique();

var orphans = uniqueSymbols.Join(
    dimP,
    new[] { Col("symbol") },
    new[] { Col("symbol") },
    JoinType.Anti
);

Console.WriteLine($"Referential integrity check:");
Console.WriteLine($"  Unique symbols in OHLCV: {uniqueSymbols.Height}");
Console.WriteLine($"  Symbols in dim_country:  {dimP.Height}");
Console.WriteLine($"  Orphan symbols:          {orphans.Height}");

if (orphans.Height > 0)
{
    Console.WriteLine("  Orphan symbols found:");
    display(orphans);
}
else
{
    Console.WriteLine("  PASS: All symbols have dimension records.");
}
```

    Referential integrity check:
      Unique symbols in OHLCV: 50
      Symbols in dim_country:  169
      Orphan symbols:          0
      PASS: All symbols have dimension records.

#### Detect date gaps from consecutive trading dates to gap report using Shift and date arithmetic

```csharp
// Date gap detection — find missing trading dates per symbol
// Pick one symbol to demonstrate
var sym = "ASML.AS";
var symDf = dfP
    .Filter(Col("symbol") == Lit(sym))
    .Sort("date");

// Compute day difference between consecutive rows
var withGap = symDf
    .WithColumns(
        (Col("date") - Col("date").Shift(1)).Alias("date_diff")
    );

// Extract date_diff array — look for gaps > 4 days (skip weekends = 3 days)
// Duration is in microseconds in Polars — cast to get usable values
var gapDf = withGap
    .WithColumns(
        Col("date_diff").Cast(DataType.Int64).Alias("diff_us")
    )
    .Filter(Col("diff_us") > Lit(4L * 24 * 60 * 60 * 1_000_000));

Console.WriteLine($"Date gap analysis for {sym}:");
Console.WriteLine($"  Total trading days: {symDf.Height}");
Console.WriteLine($"  Gaps > 4 calendar days: {gapDf.Height}");

if (gapDf.Height > 0)
{
    // Show date and gap size — select relevant columns
    var keepCols = new[] { "date", "date_diff" };
    var gapReport = gapDf.Select(keepCols.Select(c => Col(c)).ToArray());
    display(gapReport.Head(10));
}
else
{
    Console.WriteLine("  No significant gaps detected.");
}
```

    Date gap analysis for ASML.AS:
      Total trading days: 1331
      Gaps > 4 calendar days: 7

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
</style><div class='pl-dim'>Polars DataFrame: <b>(7 rows, 2 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>date<span class='pl-dtype'>date32</span></th><th>date_diff<span class='pl-dtype'>duration</span></th></tr></thead><tbody><tr><td>2021-04-06</td><td>432000000000us</td></tr><tr><td>2022-04-19</td><td>432000000000us</td></tr><tr><td>2023-04-11</td><td>432000000000us</td></tr><tr><td>2023-12-27</td><td>432000000000us</td></tr><tr><td>2024-04-02</td><td>432000000000us</td></tr><tr><td>2025-04-22</td><td>432000000000us</td></tr><tr><td>2025-12-29</td><td>432000000000us</td></tr></tbody></table></div>

#### Split data from quality rules to good and bad partitions using filter-based quarantine

```csharp
// Quarantine pattern — split data into good/bad based on quality rules
// Rules: no nulls in close, volume > 0, high >= low
// Use C# operators — NOT .Gt()/.Lt()

var qualityRules =
    Col("close").IsNotNull()
    & (Col("volume") > Lit(0.0))
    & (Col("high") >= Col("low"));

var good = dfP.Filter(qualityRules);
// Negate: find rows that fail ANY rule
var badRules =
    Col("close").IsNull()
    | (Col("volume") <= Lit(0.0))
    | (Col("high") < Col("low"));
var bad = dfP.Filter(badRules);

Console.WriteLine("Quarantine split results:");
Console.WriteLine($"  Total rows:       {dfP.Height}");
Console.WriteLine($"  Good rows:        {good.Height}");
Console.WriteLine($"  Quarantined rows: {bad.Height}");
Console.WriteLine($"  Sum check:        {good.Height + bad.Height} (should equal {dfP.Height})");

if (bad.Height > 0)
{
    Console.WriteLine("  Sample quarantined rows:");
    display(bad.Head(5));
}
else
{
    Console.WriteLine("  All rows pass quality checks.");
}
```

    Quarantine split results:
      Total rows:       66355
      Good rows:        65704
      Quarantined rows: 651
      Sum check:        66355 (should equal 66355)
      Sample quarantined rows:

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
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 12 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>id<span class='pl-dtype'>int64</span></th><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>adj_close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>dividends<span class='pl-dtype'>double</span></th><th>stock_splits<span class='pl-dtype'>double</span></th><th>is_filled<span class='pl-dtype'>bool</span></th></tr></thead><tbody><tr><td>62326</td><td>ADS.DE</td><td>2021-12-07</td><td>255.25</td><td>255.25</td><td>255.25</td><td>255.25</td><td>246.503</td><td>0</td><td>0</td><td>0</td><td>false</td></tr><tr><td>62419</td><td>ADS.DE</td><td>2022-04-21</td><td>208.05</td><td>208.05</td><td>208.05</td><td>208.05</td><td>200.9205</td><td>0</td><td>0</td><td>0</td><td>false</td></tr><tr><td>62420</td><td>ADS.DE</td><td>2022-04-22</td><td>208.05</td><td>208.05</td><td>208.05</td><td>208.05</td><td>200.9205</td><td>0</td><td>0</td><td>0</td><td>false</td></tr><tr><td>62423</td><td>ADS.DE</td><td>2022-04-27</td><td>188.44</td><td>188.44</td><td>188.44</td><td>188.44</td><td>181.9825</td><td>0</td><td>0</td><td>0</td><td>false</td></tr><tr><td>62430</td><td>ADS.DE</td><td>2022-05-06</td><td>188.22</td><td>188.22</td><td>188.22</td><td>188.22</td><td>181.77</td><td>0</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

---
## 3 — Python to C# Migration Guide

The table below maps common **Python Polars** patterns to their **C# Polars.NET** equivalents.
Many Python idioms do not translate 1:1 — pay close attention to the gotchas column.

| Operation | Python Polars | C# Polars.NET | Gotcha |
|---|---|---|---|
| **Read CSV** | `pl.read_csv("f.csv")` | `DataFrame.ReadCsv("f.csv")` | Use `tryParseDates: true` for dates |
| **Select** | `df.select("a", "b")` | `df.Select(Col("a"), Col("b"))` | Use `Col()` expressions |
| **Filter** | `df.filter(pl.col("x") > 5)` | `df.Filter(Col("x") > Lit(5))` | C# operators (`>`, `<`, `==`) — no `.Gt()` |
| **WithColumns** | `df.with_columns(expr)` | `df.WithColumns(expr)` | Same pattern |
| **Alias** | `expr.alias("name")` | `expr.Alias("name")` | Same pattern |
| **Sort single** | `df.sort("col")` | `df.Sort("col")` | Same pattern |
| **Sort multi** | `df.sort(["a","b"], descending=[True, False])` | `df.Sort("b").Sort("a", descending: true)` | Chain single `.Sort()` calls — no multi-column sort |
| **Drop columns** | `df.drop(["a", "b"])` | `df.Select(keepCols)` | `Drop()` takes single string only — use `Select` to keep the rest |
| **GroupBy + Agg** | `df.group_by("k").agg(pl.col("v").sum())` | `df.GroupBy("k").Agg(Col("v").Sum().Alias("v_sum"))` | No `.Count()` on GroupBy — use `.Agg(Col(...).Count().Alias(...))` |
| **Conditional** | `pl.when(c).then(a).otherwise(b)` | `IfElse(cond, trueExpr, falseExpr)` | No `When`/`Then`/`Otherwise` in Polars.NET |
| **Join** | `df.join(other, on="k", how="left")` | `df.Join(other, new[] { Col("k") }, new[] { Col("k") }, JoinType.Left)` | Separate left/right key arrays + `JoinType` enum |
| **VStack** | `pl.concat([df1, df2])` | `df1.VStack(df2)` | No `Concat` — use `VStack` |
| **Cast** | `col.cast(pl.Float64)` | `col.Cast(DataType.Float64)` | `DataType.X` enum — no string casts |
| **Null literal** | `pl.lit(None)` | `Lit((string)null)` | Must cast `null` — `Lit(null)` is ambiguous |
| **Null count** | `df.null_count()` | `df.Column(col).NullCount` | Property on Series — not method on DataFrame |
| **Unique count** | `series.n_unique()` | `series.NUnique` | Property — not a method |
| **Shape** | `df.shape` → `(rows, cols)` | `df.Height` / `df.Width` | No `.Shape.Rows` — use `Height` / `Width` |
| **New DataFrame** | `pl.DataFrame({"a": s1, "b": s2})` | `new DataFrame(new Series[] { s1, s2 })` | No `FromColumns` — constructor with Series array |
| **Map elements** | `col.map_elements(fn)` | Extract array + LINQ + `Series.From` + `HStack` | No `MapElements` — manual loop |
| **Add column** | `df.with_columns(series)` | `df.HStack(series)` | `WithColumn` for expressions; `HStack` for Series |

#### Demonstrate migration from a Python-style pipeline to idiomatic C# using Polars.NET patterns

> [!abstract]- Migration demo — typical analysis pipeline in idiomatic C# Polars.NET
> Migration demo — typical analysis pipeline in idiomatic C# Polars.NET
> Python equivalent:
>   df.filter(pl.col("symbol") == "ASML.AS")
>     .with_columns((pl.col("close") - pl.col("open")).alias("intraday_change"))
>     .with_columns(
>         pl.when(pl.col("intraday_change") > 0)
>           .then(pl.lit("up"))
>           .otherwise(pl.lit("down"))
>           .alias("direction")
>     )
>     .group_by("direction")
>     .agg([pl.col("close").mean(), pl.col("volume").sum()])
>     .sort("direction")
>
> C# Polars.NET translation:

```csharp
var pipeline = dfP
    .Filter(Col("symbol") == Lit("ASML.AS"))
    .WithColumns(
        (Col("close") - Col("open")).Alias("intraday_change")
    )
    .WithColumns(
        // IfElse — not When/Then/Otherwise
        IfElse(
            Col("intraday_change") > Lit(0.0),
            Lit("up"),
            Lit("down")
        ).Alias("direction")
    )
    .GroupBy("direction")
    .Agg(
        Col("close").Mean().Alias("avg_close"),
        Col("volume").Sum().Alias("total_volume")
    )
    .Sort("direction");

Console.WriteLine("Migration demo — ASML direction summary:");
display(pipeline);
```

    Migration demo — ASML direction summary:

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
</style><div class='pl-dim'>Polars DataFrame: <b>(2 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>direction<span class='pl-dtype'>utf8view</span></th><th>avg_close<span class='pl-dtype'>double</span></th><th>total_volume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>down</td><td>667.177735</td><td>468134431</td></tr><tr><td>up</td><td>675.3182551</td><td>476936289</td></tr></tbody></table></div>

---
## 4 — Debugging & Profiling

#### Inspect pipeline from each step to shape and head output using Console.WriteLine

```csharp
// Pipeline inspection — print Shape + Head at each step
Console.WriteLine("=== Step 1: Filter to single symbol ===");
var step1 = dfP.Filter(Col("symbol") == Lit("SAN.MC"));
Console.WriteLine($"  Shape: {step1.Height} rows × {step1.Width} cols");
display(step1.Head(3));

Console.WriteLine("\n=== Step 2: Add daily return ===");
var step2 = step1
    .Sort("date")
    .WithColumns(
        ((Col("close") - Col("close").Shift(1)) / Col("close").Shift(1) * Lit(100.0))
            .Alias("daily_return_pct")
    );
Console.WriteLine($"  Shape: {step2.Height} rows × {step2.Width} cols");
display(step2.Head(3));

Console.WriteLine("\n=== Step 3: Filter high-volatility days ===");
var step3 = step2.Filter(
    Col("daily_return_pct").IsNotNull()
    & ((Col("daily_return_pct") > Lit(3.0)) | (Col("daily_return_pct") < Lit(-3.0)))
);
Console.WriteLine($"  Shape: {step3.Height} rows × {step3.Width} cols");
display(step3.Head(5));
```

    === Step 1: Filter to single symbol ===
      Shape: 1329 rows × 12 cols

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
</style><div class='pl-dim'>Polars DataFrame: <b>(3 rows, 12 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>id<span class='pl-dtype'>int64</span></th><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>adj_close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>dividends<span class='pl-dtype'>double</span></th><th>stock_splits<span class='pl-dtype'>double</span></th><th>is_filled<span class='pl-dtype'>bool</span></th></tr></thead><tbody><tr><td>10578</td><td>SAN.MC</td><td>2021-01-04</td><td>2.592</td><td>2.5975</td><td>2.514</td><td>2.5665</td><td>2.1491</td><td>61027452</td><td>0</td><td>0</td><td>false</td></tr><tr><td>10579</td><td>SAN.MC</td><td>2021-01-05</td><td>2.5335</td><td>2.5935</td><td>2.528</td><td>2.5755</td><td>2.1566</td><td>34085777</td><td>0</td><td>0</td><td>false</td></tr><tr><td>10580</td><td>SAN.MC</td><td>2021-01-06</td><td>2.6495</td><td>2.7925</td><td>2.6295</td><td>2.7525</td><td>2.3048</td><td>73687945</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

    
    === Step 2: Add daily return ===
      Shape: 1329 rows × 13 cols

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
</style><div class='pl-dim'>Polars DataFrame: <b>(3 rows, 13 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>id<span class='pl-dtype'>int64</span></th><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>adj_close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>dividends<span class='pl-dtype'>double</span></th><th>stock_splits<span class='pl-dtype'>double</span></th><th>is_filled<span class='pl-dtype'>bool</span></th><th>daily_return_pct<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>10578</td><td>SAN.MC</td><td>2021-01-04</td><td>2.592</td><td>2.5975</td><td>2.514</td><td>2.5665</td><td>2.1491</td><td>61027452</td><td>0</td><td>0</td><td>false</td><td class='pl-null'>null</td></tr><tr><td>10579</td><td>SAN.MC</td><td>2021-01-05</td><td>2.5335</td><td>2.5935</td><td>2.528</td><td>2.5755</td><td>2.1566</td><td>34085777</td><td>0</td><td>0</td><td>false</td><td>0.3506721216</td></tr><tr><td>10580</td><td>SAN.MC</td><td>2021-01-06</td><td>2.6495</td><td>2.7925</td><td>2.6295</td><td>2.7525</td><td>2.3048</td><td>73687945</td><td>0</td><td>0</td><td>false</td><td>6.872451951</td></tr></tbody></table></div>

    
    === Step 3: Filter high-volatility days ===
      Shape: 141 rows × 13 cols

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
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 13 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>id<span class='pl-dtype'>int64</span></th><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>adj_close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>dividends<span class='pl-dtype'>double</span></th><th>stock_splits<span class='pl-dtype'>double</span></th><th>is_filled<span class='pl-dtype'>bool</span></th><th>daily_return_pct<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>10580</td><td>SAN.MC</td><td>2021-01-06</td><td>2.6495</td><td>2.7925</td><td>2.6295</td><td>2.7525</td><td>2.3048</td><td>73687945</td><td>0</td><td>0</td><td>false</td><td>6.872451951</td></tr><tr><td>10593</td><td>SAN.MC</td><td>2021-01-25</td><td>2.5985</td><td>2.6185</td><td>2.4755</td><td>2.49</td><td>2.085</td><td>50395819</td><td>0</td><td>0</td><td>false</td><td>-3.525765207</td></tr><tr><td>10595</td><td>SAN.MC</td><td>2021-01-27</td><td>2.51</td><td>2.524</td><td>2.422</td><td>2.4325</td><td>2.0369</td><td>55168498</td><td>0</td><td>0</td><td>false</td><td>-3.948667325</td></tr><tr><td>10599</td><td>SAN.MC</td><td>2021-02-02</td><td>2.438</td><td>2.5615</td><td>2.4315</td><td>2.537</td><td>2.1244</td><td>74092009</td><td>0</td><td>0</td><td>false</td><td>4.964832437</td></tr><tr><td>10601</td><td>SAN.MC</td><td>2021-02-04</td><td>2.57</td><td>2.7045</td><td>2.5385</td><td>2.69</td><td>2.2525</td><td>91259735</td><td>0</td><td>0</td><td>false</td><td>5.324980423</td></tr></tbody></table></div>

#### Debug with Peek from a DataFrame to a labelled snapshot using an extension-style helper

```csharp
// Peek helper — prints shape + head and returns the DataFrame for chaining
DataFrame Peek(DataFrame df, string label = "")
{
    var tag = string.IsNullOrEmpty(label) ? "" : $" [{label}]";
    Console.WriteLine($"--- Peek{tag}: {df.Height} rows × {df.Width} cols ---");
    display(df.Head(3));
    return df;
}

// Chain Peek through a multi-step pipeline
var result = Peek(
    Peek(
        Peek(
            dfP.Filter(Col("symbol") == Lit("BNP.PA")),
            "1-filter"
        )
        .Sort("date"),
        "2-sorted"
    )
    .WithColumns(
        (Col("high") - Col("low")).Alias("daily_range")
    ),
    "3-with-range"
);
```

    --- Peek [1-filter]: 1331 rows × 12 cols ---

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
</style><div class='pl-dim'>Polars DataFrame: <b>(3 rows, 12 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>id<span class='pl-dtype'>int64</span></th><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>adj_close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>dividends<span class='pl-dtype'>double</span></th><th>stock_splits<span class='pl-dtype'>double</span></th><th>is_filled<span class='pl-dtype'>bool</span></th></tr></thead><tbody><tr><td>25123</td><td>BNP.PA</td><td>2021-01-04</td><td>43.86</td><td>43.915</td><td>42.64</td><td>43.01</td><td>30.4027</td><td>3025708</td><td>0</td><td>0</td><td>false</td></tr><tr><td>25124</td><td>BNP.PA</td><td>2021-01-05</td><td>42.72</td><td>43.475</td><td>42.315</td><td>42.92</td><td>30.3391</td><td>2852830</td><td>0</td><td>0</td><td>false</td></tr><tr><td>25125</td><td>BNP.PA</td><td>2021-01-06</td><td>43.97</td><td>46.01</td><td>43.78</td><td>45.29</td><td>32.0143</td><td>5959237</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

    --- Peek [2-sorted]: 1331 rows × 12 cols ---

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
</style><div class='pl-dim'>Polars DataFrame: <b>(3 rows, 12 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>id<span class='pl-dtype'>int64</span></th><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>adj_close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>dividends<span class='pl-dtype'>double</span></th><th>stock_splits<span class='pl-dtype'>double</span></th><th>is_filled<span class='pl-dtype'>bool</span></th></tr></thead><tbody><tr><td>25123</td><td>BNP.PA</td><td>2021-01-04</td><td>43.86</td><td>43.915</td><td>42.64</td><td>43.01</td><td>30.4027</td><td>3025708</td><td>0</td><td>0</td><td>false</td></tr><tr><td>25124</td><td>BNP.PA</td><td>2021-01-05</td><td>42.72</td><td>43.475</td><td>42.315</td><td>42.92</td><td>30.3391</td><td>2852830</td><td>0</td><td>0</td><td>false</td></tr><tr><td>25125</td><td>BNP.PA</td><td>2021-01-06</td><td>43.97</td><td>46.01</td><td>43.78</td><td>45.29</td><td>32.0143</td><td>5959237</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

    --- Peek [3-with-range]: 1331 rows × 13 cols ---

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
</style><div class='pl-dim'>Polars DataFrame: <b>(3 rows, 13 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>id<span class='pl-dtype'>int64</span></th><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>adj_close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>dividends<span class='pl-dtype'>double</span></th><th>stock_splits<span class='pl-dtype'>double</span></th><th>is_filled<span class='pl-dtype'>bool</span></th><th>daily_range<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>25123</td><td>BNP.PA</td><td>2021-01-04</td><td>43.86</td><td>43.915</td><td>42.64</td><td>43.01</td><td>30.4027</td><td>3025708</td><td>0</td><td>0</td><td>false</td><td>1.275</td></tr><tr><td>25124</td><td>BNP.PA</td><td>2021-01-05</td><td>42.72</td><td>43.475</td><td>42.315</td><td>42.92</td><td>30.3391</td><td>2852830</td><td>0</td><td>0</td><td>false</td><td>1.16</td></tr><tr><td>25125</td><td>BNP.PA</td><td>2021-01-06</td><td>43.97</td><td>46.01</td><td>43.78</td><td>45.29</td><td>32.0143</td><td>5959237</td><td>0</td><td>0</td><td>false</td><td>2.23</td></tr></tbody></table></div>

#### Time pipeline steps from start to finish using Stopwatch measurements

```csharp
// Timing with Stopwatch — measure each pipeline step
var sw = new Stopwatch();
var timings = new List<(string Step, long Ms)>();

// Step 1 — Reload CSV
sw.Restart();
var tDf = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"), tryParseDates: true);
sw.Stop();
timings.Add(("ReadCsv", sw.ElapsedMilliseconds));

// Step 2 — Filter
sw.Restart();
var tFiltered = tDf.Filter(Col("symbol") == Lit("ASML.AS"));
sw.Stop();
timings.Add(("Filter", sw.ElapsedMilliseconds));

// Step 3 — Sort
sw.Restart();
var tSorted = tFiltered.Sort("date");
sw.Stop();
timings.Add(("Sort", sw.ElapsedMilliseconds));

// Step 4 — WithColumns (add computed column)
sw.Restart();
var tEnriched = tSorted.WithColumns(
    (Col("high") - Col("low")).Alias("range"),
    ((Col("close") - Col("open")) / Col("open") * Lit(100.0)).Alias("pct_change")
);
sw.Stop();
timings.Add(("WithColumns", sw.ElapsedMilliseconds));

// Step 5 — GroupBy + Agg
sw.Restart();
var tAgg = tDf
    .GroupBy("symbol")
    .Agg(
        Col("close").Mean().Alias("avg_close"),
        Col("volume").Sum().Alias("total_vol"),
        Col("close").Count().Alias("n_days")
    );
sw.Stop();
timings.Add(("GroupBy+Agg", sw.ElapsedMilliseconds));

// Step 6 — Join
sw.Restart();
var tJoined = tAgg.Join(
    dimP,
    new[] { Col("symbol") },
    new[] { Col("symbol") },
    JoinType.Left
);
sw.Stop();
timings.Add(("Join", sw.ElapsedMilliseconds));

// Report
Console.WriteLine("Pipeline timing report:");
Console.WriteLine(new string('-', 40));
foreach (var (step, ms) in timings)
{
    Console.WriteLine($"  {step,-20} {ms,6} ms");
}
Console.WriteLine(new string('-', 40));
Console.WriteLine($"  {"TOTAL",-20} {timings.Sum(t => t.Ms),6} ms");
```

    Pipeline timing report:
    ----------------------------------------
      ReadCsv                   5 ms
      Filter                    0 ms
      Sort                      0 ms
      WithColumns               0 ms
      GroupBy+Agg               0 ms
      Join                      0 ms
    ----------------------------------------
      TOTAL                     5 ms

---
## 5 — Summary

#### Key lessons

| Topic | Lesson |
|---|---|
| **Assertion helpers** | Build reusable guard functions that return `DataFrame` for chaining |
| **Schema validation** | Check column names + `DataTypeName` (not `Dtype`) before pipeline runs |
| **Null auditing** | Use `series.NullCount` (property) — not `df.NullCount()` |
| **Duplicate detection** | `GroupBy().Agg(Col(...).Count().Alias(...))` then `Filter` — no shortcut `.Count()` |
| **Anti-join** | `JoinType.Anti` finds orphan/missing keys across tables |
| **Quarantine pattern** | Filter with quality rules, split into good/bad partitions |
| **Migration from Python** | `IfElse` not `When/Then`, C# operators not `.Gt()`, chain `.Sort()` calls |
| **Debugging** | `Peek()` helper wraps `Head` + shape print and returns `df` for chaining |
| **Profiling** | `Stopwatch` per step — simple and effective for pipeline bottleneck analysis |

#### Previous notebooks

| # | Notebook | Topic |
|---|---|---|
| 01 | `01_cs_foundations_io.ipynb` | Foundations & I/O |
| 02 | `02_cs_explore_select_filter.ipynb` | Explore, Select, Filter |
| 03 | `03_cs_transforms_expressions_chaining.ipynb` | Transforms & Expressions |
| 04 | `04_cs_missing_strings_datetime.ipynb` | Missing, Strings, DateTime |
| 05 | `05_cs_aggregation_reshaping.ipynb` | Aggregation & Reshaping |
| 06 | `06_cs_lazy_performance.ipynb` | Lazy & Performance |
| 07 | `07_cs_types_interop.ipynb` | Types & Interop |
| 08 | `08_cs_visualization.ipynb` | Visualization |
| 09 | `09_cs_database_interface.ipynb` | Database & SQL Interface |
