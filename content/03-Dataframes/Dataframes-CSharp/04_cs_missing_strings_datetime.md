---
type: reference
category: programming-languages
technology:
  - csharp
  - dotnet
  - polars
tags: [pipeline, csharp, polars, dataframes]
aliases:
  - null handling, string operations, datetime, timezones
keywords: [null, NaN, fillna, dropna, str, dt, timezones, datetime, string methods, missing data]
description: "Polars.NET / C# DataFrames reference 04/10 — Missing Data, Strings & DateTime (nulls, .str, .dt, timezones). Executable examples with cell outputs. See [[04_py_missing_strings_datetime]] for the Python equivalent."
related:
  - "[[dataframes-index]]"
  - "[[programming-languages-index]]"
  - "[[04_py_missing_strings_datetime]]"
  - "[[03_cs_transforms_expressions]]"
  - "[[05_cs_aggregation_reshaping]]"
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# 04 — Missing Data, Strings & DateTime

Polars.NET vs Deedle: Handle nulls, manipulate strings, time series.

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
```

#### Load the primary datasets used throughout this notebook

```csharp
// Load primary datasets
var dfP = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"), tryParseDates: true);
var dfD = Frame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"));
display($"OHLCV — Polars: {dfP.Shape}  |  Deedle: {dfD.RowCount} x {dfD.ColumnCount}");

// scores_daily has real nulls in pe_zscore, pb_zscore, ev_ebitda_zscore, yield_zscore, recommendation_mean
var scP = DataFrame.ReadCsv(Path.Combine(DATA, "scores_daily.csv"), tryParseDates: true);
var scD = Frame.ReadCsv(Path.Combine(DATA, "scores_daily.csv"));
display($"Scores — Polars: {scP.Shape}  |  Deedle: {scD.RowCount} x {scD.ColumnCount}");
```

    OHLCV — Polars: (66355, 12)  |  Deedle: 66355 x 12

    Scores — Polars: (466, 36)  |  Deedle: 466 x 36

---

## Missing Data

#### Polars.NET — Detect null rows with Col().IsNull() filter

```csharp
// Polars.NET — Detect nulls in scores_daily (has real nulls)
display("Null counts per column:");
foreach (var col in scP.Columns)
{
    var nc = scP.Column(col).NullCount;
    if (nc > 0)
        Console.WriteLine($"  {col,-28} {nc,4} nulls");
}

display("Rows where ev_ebitda_zscore IS null (first 5):");
scP.Filter(Col("ev_ebitda_zscore").IsNull()).Head(5)
    .Select("symbol", "score_date", "ev_ebitda_zscore", "pe_zscore")
```

    Null counts per column:

      pe_zscore                       3 nulls
      pb_zscore                       6 nulls
      ev_ebitda_zscore               71 nulls
      yield_zscore                   35 nulls
      recommendation_mean            14 nulls

    Rows where ev_ebitda_zscore IS null (first 5):

<small>Polars DataFrame: (5 rows, 4 columns)</small><table><thead><tr><th>symbol</th><th>score_date</th><th>ev_ebitda_zscore</th><th>pe_zscore</th></tr></thead><tbody><tr><td>BNP.PA</td><td>2026-03-04</td><td class='pl-null'>null</td><td>0.9133885393</td></tr><tr><td>SAN.MC</td><td>2026-03-04</td><td class='pl-null'>null</td><td>0.4585988913</td></tr><tr><td>ISP.MI</td><td>2026-03-04</td><td class='pl-null'>null</td><td>0.3666188825</td></tr><tr><td>UCG.MI</td><td>2026-03-04</td><td class='pl-null'>null</td><td>0.45250099</td></tr><tr><td>INGA.AS</td><td>2026-03-04</td><td class='pl-null'>null</td><td>0.3799166699</td></tr></tbody></table></div>

#### Deedle — Detect missing values with series.TryGet and HasValue

```csharp
// Deedle — Detect nulls in scores_daily
display("Missing counts per column:");
foreach (var col in scD.ColumnKeys)
{
    var s = scD.Columns[col];
    var missing = scD.RowCount - s.ValueCount;
    if (missing > 0)
        Console.WriteLine($"  {col,-28} {missing,4} missing");
}

// Show symbols that have missing ev_ebitda_zscore
// RowsDense only keeps rows where ALL columns have values
var denseCount = scD.RowsDense.KeyCount;
display($"Rows with no missing values (dense): {denseCount} / {scD.RowCount}");
display($"Rows with at least one missing value: {scD.RowCount - denseCount}");
```

    Missing counts per column:

      pe_zscore                       3 missing
      pb_zscore                       6 missing
      ev_ebitda_zscore               71 missing
      yield_zscore                   35 missing
      recommendation_mean            14 missing

    Rows with no missing values (dense): 346 / 466

    Rows with at least one missing value: 120

#### Polars.NET — Count nulls per column with Series.NullCount property

```csharp
// Polars.NET — Count nulls per column with NullCount property
var nullCols = new[] { "pe_zscore", "pb_zscore", "ev_ebitda_zscore", "yield_zscore", "recommendation_mean" };
foreach (var col in nullCols)
    Console.WriteLine($"  {col,-28} {scP.Column(col).NullCount,4} / {scP.Height}");
display($"Total rows: {scP.Height}");
```

      pe_zscore                       3 / 466
      pb_zscore                       6 / 466
      ev_ebitda_zscore               71 / 466
      yield_zscore                   35 / 466
      recommendation_mean            14 / 466

    Total rows: 466

#### Deedle — Count missing values per column with ValueCount

```csharp
// Deedle — Count missing values per column
var nullCols = new[] { "pe_zscore", "pb_zscore", "ev_ebitda_zscore", "yield_zscore", "recommendation_mean" };
foreach (var col in nullCols)
{
    var s = scD.Columns[col];
    Console.WriteLine($"  {col,-28} {scD.RowCount - s.ValueCount,4} / {scD.RowCount}");
}
```

      pe_zscore                       3 / 466
      pb_zscore                       6 / 466
      ev_ebitda_zscore               71 / 466
      yield_zscore                   35 / 466
      recommendation_mean            14 / 466

#### Polars.NET — Drop rows with nulls using DropNulls()

```csharp
// Polars.NET — Drop rows where any column has null
var scPDropped = scP.DropNulls();
display($"Before: {scP.Height} rows  |  After DropNulls: {scPDropped.Height} rows");
scPDropped.Select("symbol", "score_date", "ev_ebitda_zscore", "pe_zscore").Head(5)
```

    Before: 466 rows  |  After DropNulls: 346 rows

<small>Polars DataFrame: (5 rows, 4 columns)</small><table><thead><tr><th>symbol</th><th>score_date</th><th>ev_ebitda_zscore</th><th>pe_zscore</th></tr></thead><tbody><tr><td>DTE.DE</td><td>2026-03-04</td><td>0.3795319291</td><td>0.3265870647</td></tr><tr><td>IFX.DE</td><td>2026-03-04</td><td>0.6770676017</td><td>0.5093979371</td></tr><tr><td>ENR.DE</td><td>2026-03-04</td><td>-1.693211811</td><td>-0.9027376753</td></tr><tr><td>ABI.BR</td><td>2026-03-04</td><td>0.5527390806</td><td>0.4740837062</td></tr><tr><td>TTE.PA</td><td>2026-03-04</td><td>0.4496104876</td><td>0.6911063935</td></tr></tbody></table></div>

#### Deedle — Drop rows with missing values using DropSparseRows()

```csharp
// Deedle — Drop rows with any missing value
var scDDropped = scD.DropSparseRows();
display($"Before: {scD.RowCount} rows  |  After DropSparseRows: {scDDropped.RowCount} rows");
scDDropped.Rows[scDDropped.RowKeys.Take(5)].Columns[new[] { "symbol", "score_date", "ev_ebitda_zscore", "pe_zscore" }]
```

    Before: 466 rows  |  After DropSparseRows: 346 rows

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>score_date</th><th>ev_ebitda_zscore</th><th>pe_zscore</th></thead><thead><th></th><th></th><th>(string)</th><th>(DateTime)</th><th>(float)</th><th>(Decimal)</th></thead>

<tr><td><b>1</b></td><td class="no-wrap">-></td><td>DTE.DE</td><td>04-Mar-26 0:00:00</td><td>0.3795319290535272</td><td>0.32658706468715487</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>IFX.DE</td><td>04-Mar-26 0:00:00</td><td>0.6770676016907706</td><td>0.5093979370966721</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ENR.DE</td><td>04-Mar-26 0:00:00</td><td>-1.693211811112902</td><td>-0.902737675317518</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Mar-26 0:00:00</td><td>0.5527390805672748</td><td>0.47408370618998047</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>TTE.PA</td><td>04-Mar-26 0:00:00</td><td>0.4496104875609825</td><td>0.69110639353589</td></tr>

</table>

<p><b>5</b> rows x <b>4</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Fill nulls with a literal value using FillNull(Lit())

```csharp
// Polars.NET — Fill null ev_ebitda_zscore with 0.0
var scPFilled = scP.WithColumns(
    Col("ev_ebitda_zscore").FillNull(Lit(0.0)).Alias("ev_ebitda_zscore")
);
display($"Nulls after FillNull(0.0): {scPFilled.Column("ev_ebitda_zscore").NullCount}");
scPFilled.Select("symbol", "score_date", "ev_ebitda_zscore").Head(5)
```

    Nulls after FillNull(0.0): 0

<small>Polars DataFrame: (5 rows, 3 columns)</small><table><thead><tr><th>symbol</th><th>score_date</th><th>ev_ebitda_zscore</th></tr></thead><tbody><tr><td>BNP.PA</td><td>2026-03-04</td><td>0</td></tr><tr><td>DTE.DE</td><td>2026-03-04</td><td>0.3795319291</td></tr><tr><td>IFX.DE</td><td>2026-03-04</td><td>0.6770676017</td></tr><tr><td>ENR.DE</td><td>2026-03-04</td><td>-1.693211811</td></tr><tr><td>ABI.BR</td><td>2026-03-04</td><td>0.5527390806</td></tr></tbody></table></div>

#### Deedle — Fill missing values with a constant using FillMissing()

```csharp
// Deedle — Fill missing ev_ebitda_zscore with 0.0
var evFilled = scD.GetColumn<double>("ev_ebitda_zscore").FillMissing(0.0);
var missingAfter = evFilled.Values.Count(v => double.IsNaN(v));
display($"Missing after FillMissing(0.0): {missingAfter}");
display($"First 5 values: [{string.Join(", ", evFilled.Values.Take(5).Select(v => v.ToString("F2")))}]");
```

    Missing after FillMissing(0.0): 0

    First 5 values: [0.00, 0.38, 0.68, -1.69, 0.55]

#### Polars.NET — Forward fill nulls with ForwardFill()

```csharp
// Polars.NET — Forward fill: propagate last valid value forward
var scPFfill = scP.WithColumns(
    Col("ev_ebitda_zscore").ForwardFill().Alias("ev_ebitda_zscore")
);
display($"Nulls after ForwardFill: {scPFfill.Column("ev_ebitda_zscore").NullCount}");
scPFfill.Select("symbol", "score_date", "ev_ebitda_zscore").Head(5)
```

    Nulls after ForwardFill: 1

<small>Polars DataFrame: (5 rows, 3 columns)</small><table><thead><tr><th>symbol</th><th>score_date</th><th>ev_ebitda_zscore</th></tr></thead><tbody><tr><td>BNP.PA</td><td>2026-03-04</td><td class='pl-null'>null</td></tr><tr><td>DTE.DE</td><td>2026-03-04</td><td>0.3795319291</td></tr><tr><td>IFX.DE</td><td>2026-03-04</td><td>0.6770676017</td></tr><tr><td>ENR.DE</td><td>2026-03-04</td><td>-1.693211811</td></tr><tr><td>ABI.BR</td><td>2026-03-04</td><td>0.5527390806</td></tr></tbody></table></div>

#### Deedle — Forward fill missing values with Direction.Forward

```csharp
// Deedle — Forward fill
var evFfill = scD.GetColumn<double>("ev_ebitda_zscore").FillMissing(Direction.Forward);
var missingFfill = evFfill.KeyCount - evFfill.ValueCount;
display($"Missing after forward fill: {missingFfill}");
display($"First 5 values: [{string.Join(", ", evFfill.Values.Take(5).Select(v => v.ToString("F2")))}]");
```

    Missing after forward fill: 1

    First 5 values: [0.38, 0.68, -1.69, 0.55, 0.38]

#### Polars.NET — Backward fill nulls with BackwardFill()

```csharp
// Polars.NET — Backward fill: propagate next valid value backward
var scPBfill = scP.WithColumns(
    Col("ev_ebitda_zscore").BackwardFill().Alias("ev_ebitda_zscore")
);
display($"Nulls after BackwardFill: {scPBfill.Column("ev_ebitda_zscore").NullCount}");
scPBfill.Select("symbol", "score_date", "ev_ebitda_zscore").Head(5)
```

    Nulls after BackwardFill: 0

<small>Polars DataFrame: (5 rows, 3 columns)</small><table><thead><tr><th>symbol</th><th>score_date</th><th>ev_ebitda_zscore</th></tr></thead><tbody><tr><td>BNP.PA</td><td>2026-03-04</td><td>0.3795319291</td></tr><tr><td>DTE.DE</td><td>2026-03-04</td><td>0.3795319291</td></tr><tr><td>IFX.DE</td><td>2026-03-04</td><td>0.6770676017</td></tr><tr><td>ENR.DE</td><td>2026-03-04</td><td>-1.693211811</td></tr><tr><td>ABI.BR</td><td>2026-03-04</td><td>0.5527390806</td></tr></tbody></table></div>

#### Deedle — Backward fill missing values with Direction.Backward

```csharp
// Deedle — Backward fill
var evBfill = scD.GetColumn<double>("ev_ebitda_zscore").FillMissing(Direction.Backward);
var missingBfill = evBfill.KeyCount - evBfill.ValueCount;
display($"Missing after backward fill: {missingBfill}");
display($"First 5 values: [{string.Join(", ", evBfill.Values.Take(5).Select(v => v.ToString("F2")))}]");
```

    Missing after backward fill: 0

    First 5 values: [0.38, 0.38, 0.68, -1.69, 0.55]

#### Polars.NET — Fill nulls with column mean using FillNull(Col().Mean())

```csharp
// Polars.NET — Fill null with column mean (expression-based)
var scPMeanFill = scP.WithColumns(
    Col("ev_ebitda_zscore").FillNull(Col("ev_ebitda_zscore").Mean()).Alias("ev_ebitda_zscore")
);
display($"Nulls after FillNull(mean): {scPMeanFill.Column("ev_ebitda_zscore").NullCount}");
scPMeanFill.Select("symbol", "score_date", "ev_ebitda_zscore").Head(5)
```

    Nulls after FillNull(mean): 0

<small>Polars DataFrame: (5 rows, 3 columns)</small><table><thead><tr><th>symbol</th><th>score_date</th><th>ev_ebitda_zscore</th></tr></thead><tbody><tr><td>BNP.PA</td><td>2026-03-04</td><td>0.03804613962</td></tr><tr><td>DTE.DE</td><td>2026-03-04</td><td>0.3795319291</td></tr><tr><td>IFX.DE</td><td>2026-03-04</td><td>0.6770676017</td></tr><tr><td>ENR.DE</td><td>2026-03-04</td><td>-1.693211811</td></tr><tr><td>ABI.BR</td><td>2026-03-04</td><td>0.5527390806</td></tr></tbody></table></div>

#### Deedle — Fill missing values with series mean

```csharp
// Deedle — Fill missing with series mean
var evCol = scD.GetColumn<double>("ev_ebitda_zscore");
var meanVal = evCol.Mean();
var evMeanFilled = evCol.FillMissing(meanVal);
display($"Mean value used: {meanVal:F4}");
var missingMean = evMeanFilled.KeyCount - evMeanFilled.ValueCount;
display($"Missing after FillMissing(mean): {missingMean}");
```

    Mean value used: 0.0380

    Missing after FillMissing(mean): 0

#### Polars.NET — Interpolate missing values with Interpolate()

```csharp
// Polars.NET — Linear interpolation of missing values
var scPInterp = scP.WithColumns(
    Col("ev_ebitda_zscore").Interpolate().Alias("ev_ebitda_zscore")
);
display($"Nulls after Interpolate: {scPInterp.Column("ev_ebitda_zscore").NullCount}");
scPInterp.Select("symbol", "score_date", "ev_ebitda_zscore").Head(10)
```

    Nulls after Interpolate: 1

<small>Polars DataFrame: (10 rows, 3 columns)</small><table><thead><tr><th>symbol</th><th>score_date</th><th>ev_ebitda_zscore</th></tr></thead><tbody><tr><td>BNP.PA</td><td>2026-03-04</td><td class='pl-null'>null</td></tr><tr><td>DTE.DE</td><td>2026-03-04</td><td>0.3795319291</td></tr><tr><td>IFX.DE</td><td>2026-03-04</td><td>0.6770676017</td></tr><tr><td>ENR.DE</td><td>2026-03-04</td><td>-1.693211811</td></tr><tr><td>ABI.BR</td><td>2026-03-04</td><td>0.5527390806</td></tr><tr><td>VOW.DE</td><td>2026-03-04</td><td>0.3798301687</td></tr><tr><td>TTE.PA</td><td>2026-03-04</td><td>0.4496104876</td></tr><tr><td>DG.PA</td><td>2026-03-04</td><td>0.9287967228</td></tr><tr><td>SAN.MC</td><td>2026-03-04</td><td>0.4340322959</td></tr><tr><td>SU.PA</td><td>2026-03-04</td><td>-0.06073213096</td></tr></tbody></table></div>

#### Deedle — Interpolate missing values with linear interpolation

```csharp
// Deedle — No built-in linear interpolation on Series
// Closest option: FillMissing(Direction.Forward) for LOCF
var evInterp = scD.GetColumn<double>("ev_ebitda_zscore").FillMissing(Direction.Forward);
var missingAfterInterp = evInterp.KeyCount - evInterp.ValueCount;
display($"Missing after forward fill (LOCF): {missingAfterInterp}");
display("Deedle has no built-in linear interpolation — forward fill is the closest built-in.");
```

    Missing after forward fill (LOCF): 1

    Deedle has no built-in linear interpolation — forward fill is the closest built-in.

---

## String Operations

#### Polars.NET — Convert strings to upper/lower case with Str.ToUppercase()

```csharp
// Polars.NET — String case conversion
var symbols = dfP.Select(new[] { "symbol" }).Unique();
var caseDemo = symbols.WithColumns(
    Col("symbol").Str.ToUpper().Alias("upper"),
    Col("symbol").Str.ToLower().Alias("lower")
);
caseDemo.Head(10)
```

<small>Polars DataFrame: (10 rows, 3 columns)</small><table><thead><tr><th>symbol</th><th>upper</th><th>lower</th></tr></thead><tbody><tr><td>ABI.BR</td><td>ABI.BR</td><td>abi.br</td></tr><tr><td>AD.AS</td><td>AD.AS</td><td>ad.as</td></tr><tr><td>ADS.DE</td><td>ADS.DE</td><td>ads.de</td></tr><tr><td>ADYEN.AS</td><td>ADYEN.AS</td><td>adyen.as</td></tr><tr><td>AI.PA</td><td>AI.PA</td><td>ai.pa</td></tr><tr><td>AIR.PA</td><td>AIR.PA</td><td>air.pa</td></tr><tr><td>ALV.DE</td><td>ALV.DE</td><td>alv.de</td></tr><tr><td>ARGX.BR</td><td>ARGX.BR</td><td>argx.br</td></tr><tr><td>ASML.AS</td><td>ASML.AS</td><td>asml.as</td></tr><tr><td>BAS.DE</td><td>BAS.DE</td><td>bas.de</td></tr></tbody></table></div>

#### Deedle — Convert strings to upper/lower case with lambda

```csharp
// Deedle — String case conversion via lambda
var symArr = dfD.GetColumn<string>("symbol").Observations
    .Select(o => o.Value).Distinct().Take(10).ToArray();

var idx = Enumerable.Range(0, symArr.Length).ToArray();
var symSeries  = new Series<int, string>(idx, symArr);
var upperArr   = symArr.Select(s => s.ToUpper()).ToArray();
var lowerArr   = symArr.Select(s => s.ToLower()).ToArray();

var builder = new FrameBuilder.Columns<int, string>();
builder.Add("symbol", symSeries);
builder.Add("upper", new Series<int, string>(idx, upperArr));
builder.Add("lower", new Series<int, string>(idx, lowerArr));
builder.Frame
```

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>upper</th><th>lower</th></thead><thead><th></th><th></th><th>(string)</th><th>(string)</th><th>(string)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>ABI.BR</td><td>abi.br</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>AD.AS</td><td>AD.AS</td><td>ad.as</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ADS.DE</td><td>ADS.DE</td><td>ads.de</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ADYEN.AS</td><td>ADYEN.AS</td><td>adyen.as</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>AI.PA</td><td>AI.PA</td><td>ai.pa</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>AIR.PA</td><td>AIR.PA</td><td>air.pa</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>ALV.DE</td><td>ALV.DE</td><td>alv.de</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>ARGX.BR</td><td>ARGX.BR</td><td>argx.br</td></tr><tr><td><b>8</b></td><td class="no-wrap">-></td><td>ASML.AS</td><td>ASML.AS</td><td>asml.as</td></tr><tr><td><b>9</b></td><td class="no-wrap">-></td><td>BAS.DE</td><td>BAS.DE</td><td>bas.de</td></tr>

</table>

<p><b>10</b> rows x <b>3</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Check if strings contain a substring with Str.Contains()

```csharp
// Polars.NET — Filter symbols containing ".DE" (German exchange)
// Str.Contains takes a plain string, NOT Lit()
var germanP = dfP.Filter(Col("symbol").Str.Contains(".DE"))
    .Select(new[] { "symbol" }).Unique();
display("German exchange symbols (.DE):");
germanP
```

    German exchange symbols (.DE):

<small>Polars DataFrame: (16 rows, 1 columns)</small><table><thead><tr><th>symbol</th></tr></thead><tbody><tr><td>ADS.DE</td></tr><tr><td>ALV.DE</td></tr><tr><td>BAS.DE</td></tr><tr><td>BAYN.DE</td></tr><tr><td>BMW.DE</td></tr><tr><td>DB1.DE</td></tr><tr><td>DHL.DE</td></tr><tr><td>DTE.DE</td></tr><tr><td>ENR.DE</td></tr><tr><td>IFX.DE</td></tr><tr><td colspan='1' style='text-align:center; font-style:italic; color:#999; padding: 10px'>... 6 more rows ...</td></tr></tbody></table></div>

#### Deedle — Check if strings contain a substring with lambda

```csharp
// Deedle — Filter symbols containing ".DE"
var germanD = dfD.GetColumn<string>("symbol").Observations
    .Select(o => o.Value)
    .Where(s => s.Contains(".DE"))
    .Distinct().ToArray();
display("German exchange symbols (.DE):");
display(string.Join(", ", germanD));
```

    German exchange symbols (.DE):

    ADS.DE, ALV.DE, BAS.DE, BAYN.DE, BMW.DE, DB1.DE, DHL.DE, DTE.DE, ENR.DE, IFX.DE, MBG.DE, MUV2.DE, RHM.DE, SAP.DE, SIE.DE, VOW.DE

#### Polars.NET — Filter with StartsWith and EndsWith using Str accessor

```csharp
// Polars.NET — StartsWith / EndsWith (plain string args, NOT Lit())
var startsS = dfP.Filter(Col("symbol").Str.StartsWith("S"))
    .Select(new[] { "symbol" }).Unique();
var endsBR = dfP.Filter(Col("symbol").Str.EndsWith(".BR"))
    .Select(new[] { "symbol" }).Unique();

// Display side by side using raw HTML
string StripQuotes(string h) => h.Replace("&quot;", "").Replace("\"", "");
var leftHtml = StripQuotes(startsS.ToHtml());
var rightHtml = StripQuotes(endsBR.ToHtml());
display(HTML($"<div style='display:flex;gap:40px'><div><b>StartsWith S</b>{leftHtml}</div><div><b>EndsWith .BR</b>{rightHtml}</div></div>"));
```

<div style='display:flex;gap:40px'><div><b>StartsWith S</b>
<small>Polars DataFrame: (7 rows, 1 columns)</small><table><thead><tr><th>symbol</th></tr></thead><tbody><tr><td>SAF.PA</td></tr><tr><td>SAN.MC</td></tr><tr><td>SAN.PA</td></tr><tr><td>SAP.DE</td></tr><tr><td>SGO.PA</td></tr><tr><td>SIE.DE</td></tr><tr><td>SU.PA</td></tr></tbody></table></div></div><div><b>EndsWith .BR</b>
<small>Polars DataFrame: (2 rows, 1 columns)</small><table><thead><tr><th>symbol</th></tr></thead><tbody><tr><td>ABI.BR</td></tr><tr><td>ARGX.BR</td></tr></tbody></table></div></div></div>

#### Deedle — Filter with StartsWith and EndsWith using lambda

```csharp
// Deedle — StartsWith / EndsWith via plain LINQ
var symSet = new HashSet<string>();
foreach (var o in dfD.GetColumn<string>("symbol").Observations)
    symSet.Add(o.Value);

var startsSd = symSet.Where(s => s.StartsWith("S")).ToArray();
display("Symbols starting with S:");
display(string.Join(", ", startsSd));

var endsBRd = symSet.Where(s => s.EndsWith(".BR")).ToArray();
display("Symbols ending with .BR:");
display(string.Join(", ", endsBRd));
```

    Symbols starting with S:

    SAF.PA, SAN.MC, SAN.PA, SAP.DE, SGO.PA, SIE.DE, SU.PA

    Symbols ending with .BR:

    ABI.BR, ARGX.BR

#### Polars.NET — Replace substrings with Str.Replace()

```csharp
// Polars.NET — Replace exchange suffix in symbol
var replaced = dfP.Select(new[] { "symbol" }).Unique()
    .WithColumns(
        Col("symbol").Str.ReplaceAll(".DE", "_GER").Alias("replaced")
    );
display("Replace '.DE' with '_GER':");
replaced.Filter(Col("replaced").Str.Contains("_GER"))
```

    Replace '.DE' with '_GER':

<small>Polars DataFrame: (16 rows, 2 columns)</small><table><thead><tr><th>symbol</th><th>replaced</th></tr></thead><tbody><tr><td>ADS.DE</td><td>ADS_GER</td></tr><tr><td>ALV.DE</td><td>ALV_GER</td></tr><tr><td>BAS.DE</td><td>BAS_GER</td></tr><tr><td>BAYN.DE</td><td>BAYN_GER</td></tr><tr><td>BMW.DE</td><td>BMW_GER</td></tr><tr><td>DB1.DE</td><td>DB1_GER</td></tr><tr><td>DHL.DE</td><td>DHL_GER</td></tr><tr><td>DTE.DE</td><td>DTE_GER</td></tr><tr><td>ENR.DE</td><td>ENR_GER</td></tr><tr><td>IFX.DE</td><td>IFX_GER</td></tr><tr><td colspan='2' style='text-align:center; font-style:italic; color:#999; padding: 10px'>... 6 more rows ...</td></tr></tbody></table></div>

#### Deedle — Replace substrings with lambda

```csharp
// Deedle — Replace substrings via lambda
var uniqueSymbols = dfD.GetColumn<string>("symbol").Values.Distinct().ToArray();
var replaced = uniqueSymbols.Select(s => s.Replace(".DE", "_GER")).ToArray();
var germanOnly = replaced.Where(s => s.Contains("_GER")).ToArray();
display("Replace .DE with _GER (German symbols only):");
display(string.Join(", ", germanOnly));
```

    Replace .DE with _GER (German symbols only):

    ADS_GER, ALV_GER, BAS_GER, BAYN_GER, BMW_GER, DB1_GER, DHL_GER, DTE_GER, ENR_GER, IFX_GER, MBG_GER, MUV2_GER, RHM_GER, SAP_GER, SIE_GER, VOW_GER

#### Polars.NET — Measure string length with Str.LenChars()

```csharp
// Polars.NET — String length (no Str.Len in 0.4.0; compute via C# array)
var symDf = dfP.Select(new[] { "symbol" }).Unique();
var symArr = symDf.Column("symbol").ToArray<string>();
var lenArr = symArr.Select(s => (double)s.Length).ToArray();
var lenSeries = Polars.CSharp.Series.From("char_len", lenArr);
var lengths = symDf.HStack(lenSeries);
lengths.Sort("char_len", descending: true).Head(10)
```

<small>Polars DataFrame: (10 rows, 2 columns)</small><table><thead><tr><th>symbol</th><th>char_len</th></tr></thead><tbody><tr><td>NDA-FI.HE</td><td>9</td></tr><tr><td>ADYEN.AS</td><td>8</td></tr><tr><td>ARGX.BR</td><td>7</td></tr><tr><td>ASML.AS</td><td>7</td></tr><tr><td>BAYN.DE</td><td>7</td></tr><tr><td>BBVA.MC</td><td>7</td></tr><tr><td>ENEL.MI</td><td>7</td></tr><tr><td>INGA.AS</td><td>7</td></tr><tr><td>MUV2.DE</td><td>7</td></tr><tr><td>RACE.MI</td><td>7</td></tr></tbody></table></div>

#### Deedle — Measure string length with lambda

```csharp
// Deedle — String length via lambda
var symUniq = dfD.GetColumn<string>("symbol").Observations
    .Select(o => o.Value).Distinct().ToArray();
var idx = Enumerable.Range(0, symUniq.Length).ToArray();

display("Symbol lengths (sample):");
var builder = new FrameBuilder.Columns<int, string>();
builder.Add("symbol", new Series<int, string>(idx, symUniq));
builder.Add("char_len", new Series<int, double>(idx, symUniq.Select(s => (double)s.Length).ToArray()));
builder.Frame
```

    Symbol lengths (sample):

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>char_len</th></thead><thead><th></th><th></th><th>(string)</th><th>(float)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>6</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>AD.AS</td><td>5</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ADS.DE</td><td>6</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ADYEN.AS</td><td>8</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>AI.PA</td><td>5</td></tr><tr><td><b>:</b></td><td class="no-wrap"></td><td>...</td><td>...</td></tr><tr><td><b>45</b></td><td class="no-wrap">-></td><td>SU.PA</td><td>5</td></tr><tr><td><b>46</b></td><td class="no-wrap">-></td><td>TTE.PA</td><td>6</td></tr><tr><td><b>47</b></td><td class="no-wrap">-></td><td>UCG.MI</td><td>6</td></tr><tr><td><b>48</b></td><td class="no-wrap">-></td><td>VOW.DE</td><td>6</td></tr><tr><td><b>49</b></td><td class="no-wrap">-></td><td>WKL.AS</td><td>6</td></tr>

</table>

<p><b>50</b> rows x <b>2</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Extract substrings with Str.Slice()

```csharp
// Polars.NET — Slice: extract the ticker part before the dot
// Str.Slice(offset, length) extracts a substring
var sliced = dfP.Select(new[] { "symbol" }).Unique()
    .WithColumns(
        Col("symbol").Str.Slice(0, 3).Alias("first_3")
    );
sliced.Head(10)
```

<small>Polars DataFrame: (10 rows, 2 columns)</small><table><thead><tr><th>symbol</th><th>first_3</th></tr></thead><tbody><tr><td>ABI.BR</td><td>ABI</td></tr><tr><td>AD.AS</td><td>AD.</td></tr><tr><td>ADS.DE</td><td>ADS</td></tr><tr><td>ADYEN.AS</td><td>ADY</td></tr><tr><td>AI.PA</td><td>AI.</td></tr><tr><td>AIR.PA</td><td>AIR</td></tr><tr><td>ALV.DE</td><td>ALV</td></tr><tr><td>ARGX.BR</td><td>ARG</td></tr><tr><td>ASML.AS</td><td>ASM</td></tr><tr><td>BAS.DE</td><td>BAS</td></tr></tbody></table></div>

#### Deedle — Extract substrings with lambda Substring()

```csharp
// Deedle — Substring via lambda
var first3 = symUniq.Select(s => s.Length >= 3 ? s.Substring(0, 3) : s).ToArray();
var builder = new FrameBuilder.Columns<int, string>();
builder.Add("symbol", new Series<int, string>(idx, symUniq));
builder.Add("first_3", new Series<int, string>(idx, first3));
builder.Frame
```

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>first_3</th></thead><thead><th></th><th></th><th>(string)</th><th>(string)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>ABI</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>AD.AS</td><td>AD.</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ADS.DE</td><td>ADS</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ADYEN.AS</td><td>ADY</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>AI.PA</td><td>AI.</td></tr><tr><td><b>:</b></td><td class="no-wrap"></td><td>...</td><td>...</td></tr><tr><td><b>45</b></td><td class="no-wrap">-></td><td>SU.PA</td><td>SU.</td></tr><tr><td><b>46</b></td><td class="no-wrap">-></td><td>TTE.PA</td><td>TTE</td></tr><tr><td><b>47</b></td><td class="no-wrap">-></td><td>UCG.MI</td><td>UCG</td></tr><tr><td><b>48</b></td><td class="no-wrap">-></td><td>VOW.DE</td><td>VOW</td></tr><tr><td><b>49</b></td><td class="no-wrap">-></td><td>WKL.AS</td><td>WKL</td></tr>

</table>

<p><b>50</b> rows x <b>2</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Split strings with Str.Split()

```csharp
// Polars.NET — Split symbol on "." to separate ticker from exchange
var split = dfP.Select(new[] { "symbol" }).Unique()
    .WithColumns(
        Col("symbol").Str.Split(".").Alias("parts")
    );
split.Head(10)
```

<small>Polars DataFrame: (10 rows, 2 columns)</small><table><thead><tr><th>symbol</th><th>parts</th></tr></thead><tbody><tr><td>ABI.BR</td><td>[&quot;ABI&quot;, &quot;BR&quot;]</td></tr><tr><td>AD.AS</td><td>[&quot;AD&quot;, &quot;AS&quot;]</td></tr><tr><td>ADS.DE</td><td>[&quot;ADS&quot;, &quot;DE&quot;]</td></tr><tr><td>ADYEN.AS</td><td>[&quot;ADYEN&quot;, &quot;AS&quot;]</td></tr><tr><td>AI.PA</td><td>[&quot;AI&quot;, &quot;PA&quot;]</td></tr><tr><td>AIR.PA</td><td>[&quot;AIR&quot;, &quot;PA&quot;]</td></tr><tr><td>ALV.DE</td><td>[&quot;ALV&quot;, &quot;DE&quot;]</td></tr><tr><td>ARGX.BR</td><td>[&quot;ARGX&quot;, &quot;BR&quot;]</td></tr><tr><td>ASML.AS</td><td>[&quot;ASML&quot;, &quot;AS&quot;]</td></tr><tr><td>BAS.DE</td><td>[&quot;BAS&quot;, &quot;DE&quot;]</td></tr></tbody></table></div>

#### Deedle — Split strings with lambda String.Split()

```csharp
// Deedle — Split via lambda
var tickerPart = symUniq.Select(s => s.Split(".")[0]).ToArray();
var exchPart = symUniq.Select(s => s.Contains(".") ? s.Split(".")[1] : "").ToArray();

var builder = new FrameBuilder.Columns<int, string>();
builder.Add("symbol", new Series<int, string>(idx, symUniq));
builder.Add("ticker", new Series<int, string>(idx, tickerPart));
builder.Add("exchange", new Series<int, string>(idx, exchPart));
builder.Frame
```

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>ticker</th><th>exchange</th></thead><thead><th></th><th></th><th>(string)</th><th>(string)</th><th>(string)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>ABI</td><td>BR</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>AD.AS</td><td>AD</td><td>AS</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ADS.DE</td><td>ADS</td><td>DE</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ADYEN.AS</td><td>ADYEN</td><td>AS</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>AI.PA</td><td>AI</td><td>PA</td></tr><tr><td><b>:</b></td><td class="no-wrap"></td><td>...</td><td>...</td><td>...</td></tr><tr><td><b>45</b></td><td class="no-wrap">-></td><td>SU.PA</td><td>SU</td><td>PA</td></tr><tr><td><b>46</b></td><td class="no-wrap">-></td><td>TTE.PA</td><td>TTE</td><td>PA</td></tr><tr><td><b>47</b></td><td class="no-wrap">-></td><td>UCG.MI</td><td>UCG</td><td>MI</td></tr><tr><td><b>48</b></td><td class="no-wrap">-></td><td>VOW.DE</td><td>VOW</td><td>DE</td></tr><tr><td><b>49</b></td><td class="no-wrap">-></td><td>WKL.AS</td><td>WKL</td><td>AS</td></tr>

</table>

<p><b>50</b> rows x <b>3</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Extract with regex using Str.Extract()

```csharp
// Polars.NET — Regex extract: capture the exchange code after the dot
var extracted = dfP.Select(new[] { "symbol" }).Unique()
    .WithColumns(
        Col("symbol").Str.Extract(@"\.(\w+)", 1).Alias("exchange")
    );
extracted.Head(10)
```

<small>Polars DataFrame: (10 rows, 2 columns)</small><table><thead><tr><th>symbol</th><th>exchange</th></tr></thead><tbody><tr><td>ABI.BR</td><td>BR</td></tr><tr><td>AD.AS</td><td>AS</td></tr><tr><td>ADS.DE</td><td>DE</td></tr><tr><td>ADYEN.AS</td><td>AS</td></tr><tr><td>AI.PA</td><td>PA</td></tr><tr><td>AIR.PA</td><td>PA</td></tr><tr><td>ALV.DE</td><td>DE</td></tr><tr><td>ARGX.BR</td><td>BR</td></tr><tr><td>ASML.AS</td><td>AS</td></tr><tr><td>BAS.DE</td><td>DE</td></tr></tbody></table></div>

#### Deedle — Extract with regex using Regex.Match lambda

```csharp
// Deedle — Regex extract via lambda
var regexPattern = new Regex(@"\.(\w+)");
var exchExtract = symUniq.Select(s => {
    var m = regexPattern.Match(s);
    return m.Success ? m.Groups[1].Value : "";
}).ToArray();

var builder = new FrameBuilder.Columns<int, string>();
builder.Add("symbol", new Series<int, string>(idx, symUniq));
builder.Add("exchange", new Series<int, string>(idx, exchExtract));
builder.Frame
```

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>exchange</th></thead><thead><th></th><th></th><th>(string)</th><th>(string)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>BR</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>AD.AS</td><td>AS</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ADS.DE</td><td>DE</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ADYEN.AS</td><td>AS</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>AI.PA</td><td>PA</td></tr><tr><td><b>:</b></td><td class="no-wrap"></td><td>...</td><td>...</td></tr><tr><td><b>45</b></td><td class="no-wrap">-></td><td>SU.PA</td><td>PA</td></tr><tr><td><b>46</b></td><td class="no-wrap">-></td><td>TTE.PA</td><td>PA</td></tr><tr><td><b>47</b></td><td class="no-wrap">-></td><td>UCG.MI</td><td>MI</td></tr><tr><td><b>48</b></td><td class="no-wrap">-></td><td>VOW.DE</td><td>DE</td></tr><tr><td><b>49</b></td><td class="no-wrap">-></td><td>WKL.AS</td><td>AS</td></tr>

</table>

<p><b>50</b> rows x <b>2</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Pad strings with Str.PadStart()

```csharp
// Polars.NET — Pad symbol to 10 chars (no Str.Pad in 0.4.0; compute via C#)
var symDfPad = dfP.Select(new[] { "symbol" }).Unique();
var symArrPad = symDfPad.Column("symbol").ToArray<string>();
var paddedArr = symArrPad.Select(s => s.PadLeft(10, '0')).ToArray();
var paddedSeries = Polars.CSharp.Series.From("padded", paddedArr);
symDfPad.HStack(paddedSeries).Head(10)
```

<small>Polars DataFrame: (10 rows, 2 columns)</small><table><thead><tr><th>symbol</th><th>padded</th></tr></thead><tbody><tr><td>ABI.BR</td><td>0000ABI.BR</td></tr><tr><td>AD.AS</td><td>00000AD.AS</td></tr><tr><td>ADS.DE</td><td>0000ADS.DE</td></tr><tr><td>ADYEN.AS</td><td>00ADYEN.AS</td></tr><tr><td>AI.PA</td><td>00000AI.PA</td></tr><tr><td>AIR.PA</td><td>0000AIR.PA</td></tr><tr><td>ALV.DE</td><td>0000ALV.DE</td></tr><tr><td>ARGX.BR</td><td>000ARGX.BR</td></tr><tr><td>ASML.AS</td><td>000ASML.AS</td></tr><tr><td>BAS.DE</td><td>0000BAS.DE</td></tr></tbody></table></div>

#### Deedle — Pad strings with PadLeft lambda

```csharp
// Deedle — Pad via lambda
var padded = symUniq.Select(s => s.PadLeft(10, '0')).ToArray();
var builder = new FrameBuilder.Columns<int, string>();
builder.Add("symbol", new Series<int, string>(idx, symUniq));
builder.Add("padded", new Series<int, string>(idx, padded));
builder.Frame
```

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>padded</th></thead><thead><th></th><th></th><th>(string)</th><th>(string)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>0000ABI.BR</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>AD.AS</td><td>00000AD.AS</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ADS.DE</td><td>0000ADS.DE</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ADYEN.AS</td><td>00ADYEN.AS</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>AI.PA</td><td>00000AI.PA</td></tr><tr><td><b>:</b></td><td class="no-wrap"></td><td>...</td><td>...</td></tr><tr><td><b>45</b></td><td class="no-wrap">-></td><td>SU.PA</td><td>00000SU.PA</td></tr><tr><td><b>46</b></td><td class="no-wrap">-></td><td>TTE.PA</td><td>0000TTE.PA</td></tr><tr><td><b>47</b></td><td class="no-wrap">-></td><td>UCG.MI</td><td>0000UCG.MI</td></tr><tr><td><b>48</b></td><td class="no-wrap">-></td><td>VOW.DE</td><td>0000VOW.DE</td></tr><tr><td><b>49</b></td><td class="no-wrap">-></td><td>WKL.AS</td><td>0000WKL.AS</td></tr>

</table>

<p><b>50</b> rows x <b>2</b> columns</p><p><b>0</b> missing values</p>

</div>

---

## DateTime Operations

#### Polars.NET — Parse string column to date with Str.ToDate()

```csharp
// Polars.NET — The date column was already parsed as Date type
display($"date column type: {dfP.Column("date").DataTypeName}");

// Demonstrate Str.ToDate by casting date to string first, then parsing back
var dfStr = dfP.WithColumns(Col("date").Cast(DataType.String).Alias("date_str"));
display($"Cast to string: {dfStr.Column("date_str").DataTypeName}");

var dfParsed = dfStr.WithColumns(
    Col("date_str").Str.ToDate("%Y-%m-%d").Alias("date_reparsed")
);
display($"After Str.ToDate: {dfParsed.Column("date_reparsed").DataTypeName}");
dfParsed.Select("symbol", "date", "date_str", "date_reparsed").Head(5)
```

    date column type: date

    Cast to string: str

    After Str.ToDate: date

<small>Polars DataFrame: (5 rows, 4 columns)</small><table><thead><tr><th>symbol</th><th>date</th><th>date_str</th><th>date_reparsed</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>2021-01-04</td><td>2021-01-04</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>2021-01-05</td><td>2021-01-05</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>2021-01-06</td><td>2021-01-06</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>2021-01-07</td><td>2021-01-07</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>2021-01-08</td><td>2021-01-08</td></tr></tbody></table></div>

#### Deedle — Parse string column to DateTime with DateTime.Parse

```csharp
// Deedle — Parse string date column to DateTime
var dateStrings = dfD.GetColumn<string>("date");
var dateKeys = dateStrings.Keys.ToArray();
var dateVals = dateStrings.Values.Select(s => DateTime.Parse(s)).ToArray();
var dateParsed = new Series<int, DateTime>(dateKeys, dateVals);
display($"Parsed type: {dateVals[0].GetType().Name}");
display("First 5 parsed dates:");
display(string.Join(", ", dateVals.Take(5).Select(d => d.ToString("yyyy-MM-dd"))));
```

    Parsed type: DateTime

    First 5 parsed dates:

    2021-01-04, 2021-01-05, 2021-01-06, 2021-01-07, 2021-01-08

#### Polars.NET — Extract year, month, weekday with Dt accessor

```csharp
// Polars.NET — Extract date components with .Dt accessor
var dateComponents = dfP.WithColumns(
    Col("date").Dt.Year().Alias("year"),
    Col("date").Dt.Month().Alias("month"),
    Col("date").Dt.Weekday().Alias("weekday")
);
dateComponents.Select(new[] { "symbol", "date", "year", "month", "weekday" }).Head(10)
```

<small>Polars DataFrame: (10 rows, 5 columns)</small><table><thead><tr><th>symbol</th><th>date</th><th>year</th><th>month</th><th>weekday</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>2021</td><td>1</td><td>1</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>2021</td><td>1</td><td>2</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>2021</td><td>1</td><td>3</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>2021</td><td>1</td><td>4</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>2021</td><td>1</td><td>5</td></tr><tr><td>ABI.BR</td><td>2021-01-11</td><td>2021</td><td>1</td><td>1</td></tr><tr><td>ABI.BR</td><td>2021-01-12</td><td>2021</td><td>1</td><td>2</td></tr><tr><td>ABI.BR</td><td>2021-01-13</td><td>2021</td><td>1</td><td>3</td></tr><tr><td>ABI.BR</td><td>2021-01-14</td><td>2021</td><td>1</td><td>4</td></tr><tr><td>ABI.BR</td><td>2021-01-15</td><td>2021</td><td>1</td><td>5</td></tr></tbody></table></div>

#### Deedle — Extract year, month, weekday with DateTime lambda

```csharp
// Deedle — Extract date components via lambda
var yearArr = dateVals.Select(d => (double)d.Year).ToArray();
var monthArr = dateVals.Select(d => (double)d.Month).ToArray();
var wdayArr = dateVals.Select(d => (double)d.DayOfWeek).ToArray();

var builder = new FrameBuilder.Columns<int, string>();
builder.Add("date", new Series<int, string>(dateKeys, dateStrings.Values.ToArray()));
builder.Add("year", new Series<int, double>(dateKeys, yearArr));
builder.Add("month", new Series<int, double>(dateKeys, monthArr));
builder.Add("weekday", new Series<int, double>(dateKeys, wdayArr));
builder.Frame.Rows[dateKeys.Take(5)]
```

<div>

<table>

<thead><th></th><th></th><th>date</th><th>year</th><th>month</th><th>weekday</th></thead><thead><th></th><th></th><th>(string)</th><th>(float)</th><th>(float)</th><th>(float)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>04-Jan-21 0:00:00</td><td>2021</td><td>1</td><td>1</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>05-Jan-21 0:00:00</td><td>2021</td><td>1</td><td>2</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>06-Jan-21 0:00:00</td><td>2021</td><td>1</td><td>3</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>07-Jan-21 0:00:00</td><td>2021</td><td>1</td><td>4</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>08-Jan-21 0:00:00</td><td>2021</td><td>1</td><td>5</td></tr>

</table>

<p><b>5</b> rows x <b>4</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Duration arithmetic: add days to a date column

```csharp
// Polars.NET — Add 7 days using Dt.OffsetBy
var dfPlus7 = dfP.WithColumns(
    Col("date").Dt.OffsetBy("7d").Alias("date_plus_7")
);
dfPlus7.Select(new[] { "symbol", "date", "date_plus_7" }).Head(5)
```

<small>Polars DataFrame: (5 rows, 3 columns)</small><table><thead><tr><th>symbol</th><th>date</th><th>date_plus_7</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>2021-01-11</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>2021-01-12</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>2021-01-13</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>2021-01-14</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>2021-01-15</td></tr></tbody></table></div>

#### Deedle — Duration arithmetic: add days with AddDays lambda

```csharp
// Deedle — Add 7 days via lambda
var datePlus7 = dateVals.Select(d => d.AddDays(7).ToString("yyyy-MM-dd")).ToArray();

var builder = new FrameBuilder.Columns<int, string>();
builder.Add("date", new Series<int, string>(dateKeys, dateStrings.Values.ToArray()));
builder.Add("date_plus_7", new Series<int, string>(dateKeys, datePlus7));
builder.Frame.Rows[dateKeys.Take(5)]
```

<div>

<table>

<thead><th></th><th></th><th>date</th><th>date_plus_7</th></thead><thead><th></th><th></th><th>(string)</th><th>(string)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>04-Jan-21 0:00:00</td><td>2021-01-11</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>05-Jan-21 0:00:00</td><td>2021-01-12</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>06-Jan-21 0:00:00</td><td>2021-01-13</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>07-Jan-21 0:00:00</td><td>2021-01-14</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>08-Jan-21 0:00:00</td><td>2021-01-15</td></tr>

</table>

<p><b>5</b> rows x <b>2</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Shift/lag a column with Shift()

```csharp
// Polars.NET — Shift close price by 1 (lag) to compute daily return
var abiPrices = dfP.Filter(Col("symbol") == Lit("ABI.BR"));
var abiShifted = abiPrices.WithColumns(
    Col("close").Shift(1).Alias("prev_close")
);
display("ABI.BR with lagged close (first 5):");
abiShifted.Select(new[] { "date", "close", "prev_close" }).Head(5)
```

    ABI.BR with lagged close (first 5):

<small>Polars DataFrame: (5 rows, 3 columns)</small><table><thead><tr><th>date</th><th>close</th><th>prev_close</th></tr></thead><tbody><tr><td>2021-01-04</td><td>57.21</td><td class='pl-null'>null</td></tr><tr><td>2021-01-05</td><td>57.18</td><td>57.21</td></tr><tr><td>2021-01-06</td><td>58.77</td><td>57.18</td></tr><tr><td>2021-01-07</td><td>58.4</td><td>58.77</td></tr><tr><td>2021-01-08</td><td>57.86</td><td>58.4</td></tr></tbody></table></div>

#### Deedle — Shift/lag a series with Shift()

```csharp
// Deedle — Shift close by 1 period
var abiDRows = dfD.Where(row => row.Value.GetAs<string>("symbol") == "ABI.BR");
var closeSeries = abiDRows.GetColumn<double>("close");
var prevClose = closeSeries.Shift(1);

var builder = new FrameBuilder.Columns<int, string>();
builder.Add("date", abiDRows.GetColumn<string>("date"));
builder.Add("close", closeSeries);
builder.Add("prev_close", prevClose);
builder.Frame.Rows[abiDRows.RowKeys.Take(5)]
```

<div>

<table>

<thead><th></th><th></th><th>date</th><th>close</th><th>prev_close</th></thead><thead><th></th><th></th><th>(string)</th><th>(float)</th><th>(float)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>04-Jan-21 0:00:00</td><td>57.21</td><td><missing></td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>05-Jan-21 0:00:00</td><td>57.18</td><td>57.21</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>06-Jan-21 0:00:00</td><td>58.77</td><td>57.18</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>07-Jan-21 0:00:00</td><td>58.4</td><td>58.77</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>08-Jan-21 0:00:00</td><td>57.86</td><td>58.4</td></tr>

</table>

<p><b>5</b> rows x <b>3</b> columns</p><p><b>1</b> missing values</p>

</div>

#### Polars.NET — Cumulative sum with CumSum()

```csharp
// Polars.NET — Cumulative sum of volume for ABI.BR
var abiCum = abiPrices.WithColumns(
    Col("volume").CumSum().Alias("cum_volume")
);
abiCum.Select(new[] { "date", "volume", "cum_volume" }).Head(10)
```

<small>Polars DataFrame: (10 rows, 3 columns)</small><table><thead><tr><th>date</th><th>volume</th><th>cum_volume</th></tr></thead><tbody><tr><td>2021-01-04</td><td>1513937</td><td>1513937</td></tr><tr><td>2021-01-05</td><td>1382722</td><td>2896659</td></tr><tr><td>2021-01-06</td><td>1370204</td><td>4266863</td></tr><tr><td>2021-01-07</td><td>1469911</td><td>5736774</td></tr><tr><td>2021-01-08</td><td>1428681</td><td>7165455</td></tr><tr><td>2021-01-11</td><td>1518079</td><td>8683534</td></tr><tr><td>2021-01-12</td><td>1649991</td><td>10333525</td></tr><tr><td>2021-01-13</td><td>1090806</td><td>11424331</td></tr><tr><td>2021-01-14</td><td>1523045</td><td>12947376</td></tr><tr><td>2021-01-15</td><td>1769988</td><td>14717364</td></tr></tbody></table></div>

#### Deedle — Cumulative sum with manual Scan approach

```csharp
// Deedle — Cumulative sum (manual via running total)
var volSeries = abiDRows.GetColumn<double>("volume");
var cumVals = new List<double>();
double running = 0;
foreach (var v in volSeries.Values)
{
    running += v;
    cumVals.Add(running);
}
var cumVolSeries = new Series<int, double>(volSeries.Keys.ToArray(), cumVals.ToArray());

var builder = new FrameBuilder.Columns<int, string>();
builder.Add("date", abiDRows.GetColumn<string>("date"));
builder.Add("volume", volSeries);
builder.Add("cum_volume", cumVolSeries);
builder.Frame.Rows[abiDRows.RowKeys.Take(10)]
```

<div>

<table>

<thead><th></th><th></th><th>date</th><th>volume</th><th>cum_volume</th></thead><thead><th></th><th></th><th>(string)</th><th>(float)</th><th>(float)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>04-Jan-21 0:00:00</td><td>1513937</td><td>1513937</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>05-Jan-21 0:00:00</td><td>1382722</td><td>2896659</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>06-Jan-21 0:00:00</td><td>1370204</td><td>4266863</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>07-Jan-21 0:00:00</td><td>1469911</td><td>5736774</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>08-Jan-21 0:00:00</td><td>1428681</td><td>7165455</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>11-Jan-21 0:00:00</td><td>1518079</td><td>8683534</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>12-Jan-21 0:00:00</td><td>1649991</td><td>10333525</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>13-Jan-21 0:00:00</td><td>1090806</td><td>11424331</td></tr><tr><td><b>8</b></td><td class="no-wrap">-></td><td>14-Jan-21 0:00:00</td><td>1523045</td><td>12947376</td></tr><tr><td><b>9</b></td><td class="no-wrap">-></td><td>15-Jan-21 0:00:00</td><td>1769988</td><td>14717364</td></tr>

</table>

<p><b>10</b> rows x <b>3</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Polars.NET — Filter by date range using date comparisons

```csharp
// Polars.NET — Filter rows for year 2024, January only
var jan2024 = dfP.Filter(
    (Col("date").Dt.Year() == Lit(2024))
    & (Col("date").Dt.Month() == Lit(1))
    & (Col("symbol") == Lit("SAP.DE"))
);
display("SAP.DE in January 2024:");
jan2024.Select(new[] { "symbol", "date", "close", "volume" })
```

    SAP.DE in January 2024:

<small>Polars DataFrame: (22 rows, 4 columns)</small><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>SAP.DE</td><td>2024-01-02</td><td>137.34</td><td>1442435</td></tr><tr><td>SAP.DE</td><td>2024-01-03</td><td>137.12</td><td>1311703</td></tr><tr><td>SAP.DE</td><td>2024-01-04</td><td>136.44</td><td>1114133</td></tr><tr><td>SAP.DE</td><td>2024-01-05</td><td>137.08</td><td>1171604</td></tr><tr><td>SAP.DE</td><td>2024-01-08</td><td>138.78</td><td>992579</td></tr><tr><td>SAP.DE</td><td>2024-01-09</td><td>139.28</td><td>1043679</td></tr><tr><td>SAP.DE</td><td>2024-01-10</td><td>142.04</td><td>1619033</td></tr><tr><td>SAP.DE</td><td>2024-01-11</td><td>141.88</td><td>1354264</td></tr><tr><td>SAP.DE</td><td>2024-01-12</td><td>144.86</td><td>1155152</td></tr><tr><td>SAP.DE</td><td>2024-01-15</td><td>144.56</td><td>732435</td></tr><tr><td colspan='4' style='text-align:center; font-style:italic; color:#999; padding: 10px'>... 12 more rows ...</td></tr></tbody></table></div>

#### Deedle — Filter by date range using DateTime lambda

```csharp
// Deedle — Filter rows for SAP.DE in January 2024
var jan2024D = dfD.Where(row =>
{
    var sym = row.Value.GetAs<string>("symbol");
    var dt = DateTime.Parse(row.Value.GetAs<string>("date"));
    return sym == "SAP.DE" && dt.Year == 2024 && dt.Month == 1;
});
display("SAP.DE in January 2024:");
jan2024D.Columns[new[] { "symbol", "date", "close", "volume" }]
```

    SAP.DE in January 2024:

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>date</th><th>close</th><th>volume</th></thead><thead><th></th><th></th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(int)</th></thead>

<tr><td><b>56505</b></td><td class="no-wrap">-></td><td>SAP.DE</td><td>02-Jan-24 0:00:00</td><td>137.34</td><td>1442435</td></tr><tr><td><b>56506</b></td><td class="no-wrap">-></td><td>SAP.DE</td><td>03-Jan-24 0:00:00</td><td>137.12</td><td>1311703</td></tr><tr><td><b>56507</b></td><td class="no-wrap">-></td><td>SAP.DE</td><td>04-Jan-24 0:00:00</td><td>136.44</td><td>1114133</td></tr><tr><td><b>56508</b></td><td class="no-wrap">-></td><td>SAP.DE</td><td>05-Jan-24 0:00:00</td><td>137.08</td><td>1171604</td></tr><tr><td><b>56509</b></td><td class="no-wrap">-></td><td>SAP.DE</td><td>08-Jan-24 0:00:00</td><td>138.78</td><td>992579</td></tr><tr><td><b>:</b></td><td class="no-wrap"></td><td>...</td><td>...</td><td>...</td><td>...</td></tr><tr><td><b>56522</b></td><td class="no-wrap">-></td><td>SAP.DE</td><td>25-Jan-24 0:00:00</td><td>160.76</td><td>3408973</td></tr><tr><td><b>56523</b></td><td class="no-wrap">-></td><td>SAP.DE</td><td>26-Jan-24 0:00:00</td><td>160.0</td><td>2548387</td></tr><tr><td><b>56524</b></td><td class="no-wrap">-></td><td>SAP.DE</td><td>29-Jan-24 0:00:00</td><td>162.0</td><td>1669174</td></tr><tr><td><b>56525</b></td><td class="no-wrap">-></td><td>SAP.DE</td><td>30-Jan-24 0:00:00</td><td>162.42</td><td>1411612</td></tr><tr><td><b>56526</b></td><td class="no-wrap">-></td><td>SAP.DE</td><td>31-Jan-24 0:00:00</td><td>160.8</td><td>2021425</td></tr>

</table>

<p><b>22</b> rows x <b>4</b> columns</p><p><b>0</b> missing values</p>

</div>

---

## Summary

| Operation | Polars.NET | Deedle |
|---|---|---|
| **Detect nulls** | `Col("c").IsNull()` filter | `Observations` + `HasValue` check |
| **Count nulls** | `series.NullCount` (property) | `KeyCount - ValueCount` |
| **Drop nulls** | `df.DropNulls()` | `frame.DropSparseRows()` |
| **Fill with literal** | `Col("c").FillNull(Lit(0.0))` | `series.FillMissing(0.0)` |
| **Forward fill** | `Col("c").ForwardFill()` | `FillMissing(Direction.Forward)` |
| **Backward fill** | `Col("c").BackwardFill()` | `FillMissing(Direction.Backward)` |
| **Fill with expression** | `Col("c").FillNull(Col("c").Mean())` | `series.FillMissing(series.Mean())` |
| **Interpolate** | `Col("c").Interpolate()` | No built-in (manual or forward fill) |
| **To upper/lower** | `.Str.ToUppercase()` / `.ToLowercase()` | Lambda: `.ToUpper()` / `.ToLower()` |
| **Contains** | `.Str.Contains("text")` (plain string) | Lambda: `.Contains("text")` |
| **StartsWith/EndsWith** | `.Str.StartsWith("S")` (plain string) | Lambda: `.StartsWith()` / `.EndsWith()` |
| **Replace** | `.Str.Replace("old", "new")` | Lambda: `.Replace()` |
| **String length** | `.Str.LenChars()` | Lambda: `.Length` |
| **Slice/Substring** | `.Str.Slice(0, 5)` | Lambda: `.Substring(0, 5)` |
| **Split** | `.Str.Split(".")` | Lambda: `.Split('.')` |
| **Regex extract** | `.Str.Extract(pattern, group)` | Lambda: `Regex.Match()` |
| **Pad** | `.Str.PadStart(10, '0')` | Lambda: `.PadLeft(10, '0')` |
| **Parse date** | `.Str.ToDate("%Y-%m-%d")` | `DateTime.Parse()` / `.ParseExact()` |
| **Extract year/month** | `.Dt.Year()`, `.Dt.Month()` | Lambda: `.Year`, `.Month` |
| **Date arithmetic** | `Col("d") + Duration(7, "d")` | Lambda: `.AddDays(7)` |
| **Shift/Lag** | `Col("c").Shift(1)` | `series.Shift(1)` |
| **Cumulative sum** | `Col("c").CumSum()` | Manual running total |
| **Date filter** | `.Dt.Year() == Lit(2024)` | Lambda: `dt.Year == 2024` |
