---
title: "08. Visualization - C#"
tags: [csharp, polars, dataframes, plotly]
aliases:
  - charts, plots, Plotly, matplotlib, seaborn
description: "Polars.NET / C# DataFrames reference 08/10 — Visualization (charts, plots, interactive graphics). Executable examples with cell outputs. See [08_py_visualization](https://alp78.github.io/elysium/03-Dataframes/Dataframes-Python/08_py_visualization) for the Python equivalent."
parent: "[[domain-integrate-and-validate]]"
links:
  - "[[08_py_visualization]]"
  - "[[09_py_database_interface]]"
  - "[[09_cs_database_interface]]"
  - "[[10_py_testing_migration]]"
  - "[[10_cs_testing_migration]]"
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# 08 — Visualization

> [!quote]
> "The greatest value of a picture is when it forces us to notice what we never expected to see."
>
> — **John Tukey**, *Exploratory Data Analysis* (1977)

Plotly.NET for interactive charts, ScottPlot for static/performance, OxyPlot for PDF export.

---

## Setup

.NET Interactive notebooks require a one-time warning suppression for NuGet version mismatches, package installation via `#r "nuget:"` directives, and data loading before any chart cell can run.

### Suppress assembly version warnings

NuGet packages targeting .NET 8/9 trigger CS1701/CS1702 on .NET 10 — harmless version-mismatch noise. Run this cell once, before any cell that loads NuGet packages.

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

### NuGet Packages and Imports

Install the required packages: Polars.NET for data manipulation, Plotly.NET + Plotly.NET.CSharp for interactive charts, and ScottPlot for static PNG export. The `DATA` variable points to the shared dataset folder.

```csharp
#r "nuget: Polars.NET, 0.4.0"
#r "nuget: Polars.NET.Native.win-x64, 0.4.0"
#r "nuget: Plotly.NET, 5.1.0"
#r "nuget: Plotly.NET.CSharp, 0.13.0"
#r "nuget: Plotly.NET.Interactive, 5.0.0"
#r "nuget: ScottPlot, 5.0.55"

using System.IO;
using System.Linq;
using Polars.CSharp;
using static Polars.CSharp.Polars;
using Plotly.NET;
using Chart = Plotly.NET.CSharp.Chart;
using Plotly.NET.LayoutObjects;
using Plotly.NET.TraceObjects;

var DATA = Path.Combine("..", "data");
```

### Dataset Loading

Load the EuroStoxx 50 OHLCV dataset and extract typed arrays for use in chart traces. Polars.NET's `ToArray<T>()` requires homogeneous column types — date columns must be cast to `string` first because `ToArray<string>()` does not coerce `Date` types directly.

```csharp
var dfP = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"), tryParseDates: true);
display($"Loaded: {dfP.Shape}");

var asml = dfP.Filter(Col("symbol") == Lit("ASML.AS")).Sort("date");
var asmlDatesDf = asml.WithColumns(Col("date").Cast(DataType.String).Alias("date_str"));
var asmlDates = asmlDatesDf.Column("date_str").ToArray<string>();
var asmlClose = asml.Column("close").ToArray<double>();
var asmlOpen = asml.Column("open").ToArray<double>();
var asmlHigh = asml.Column("high").ToArray<double>();
var asmlLow = asml.Column("low").ToArray<double>();
var asmlVol = asml.Column("volume").ToArray<long>();
display($"ASML rows: {asmlDates.Length}");
```

    Loaded: (66355, 12)

    ASML rows: 1331

---

## Line Charts

Line charts connect ordered data points to reveal **trends, cycles, and rate of change** over time. In Plotly.NET, `Chart.Line<TX, TY, TName>()` produces an interactive trace; `Chart.Combine()` merges multiple traces into a single figure. `WithAxisAnchor()` binds a trace to a specific y-axis for dual-axis layouts.

**Best for:** Time-series data — stock prices, sensor readings, cumulative returns. Avoid for unordered categories.

### Single Line Chart

#### Plotly.NET | Single line — ASML close price over time

Plots ASML's closing price as a single interactive trace. Date strings are parsed to `DateTime` to enable Plotly's built-in date axis formatting.

_Parses all 1,331 ASML date strings to `DateTime`, renders a single `Chart.Line` trace with custom transparent background and gray font, producing an interactive chart with Plotly's built-in date axis formatting._

```csharp
var dates = asmlDates.Select(d => DateTime.Parse(d)).ToArray();
Plotly.NET.CSharp.Chart.Line<DateTime, double, string>(x: dates, y: asmlClose)
    .WithTitle("ASML — Close Price")
    .WithXAxisStyle(Title.init("Date"))
    .WithYAxisStyle(Title.init("Close (EUR)"))
    .WithSize(900, 450)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<iframe src="/static/plotly/df_cs_08_01.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Multi-line Chart

#### Plotly.NET | Multi-line — overlay ASML, SAP, SIE close prices

Build one trace per symbol via LINQ and combine them with `Chart.Combine()`. Each trace is automatically colored by Plotly's default palette; the legend identifies each symbol.

_Iterates over three symbols (`ASML.AS`, `SAP.DE`, `SIE.DE`) with LINQ, builds one `Chart.Line` trace per symbol from its date-parsed close price array, and combines them into a single multi-series chart with an auto-colored legend._

```csharp
var symbols = new[] { "ASML.AS", "SAP.DE", "SIE.DE" };
var traces = symbols.Select(sym =>
{
    var sub = dfP.Filter(Col("symbol") == Lit(sym)).Sort("date")
        .WithColumns(Col("date").Cast(DataType.String).Alias("date_str"));
    var dates = sub.Column("date_str").ToArray<string>().Select(d => DateTime.Parse(d)).ToArray();
    var close = sub.Column("close").ToArray<double>();
    return Plotly.NET.CSharp.Chart.Line<DateTime, double, string>(x: dates, y: close, Name: sym);
}).ToArray();

Plotly.NET.CSharp.Chart.Combine(traces)
    .WithTitle("Close Price Comparison — ASML vs SAP vs Siemens")
    .WithXAxisStyle(Title.init("Date"))
    .WithYAxisStyle(Title.init("Close (EUR)"))
    .WithSize(900, 450)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<iframe src="/static/plotly/df_cs_08_02.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Dual Y-Axis Chart

#### Plotly.NET | Dual y-axis — ASML price + volume

Overlays a price line (left axis, full height) with volume bars (right axis, scaled to occupy the bottom third). Plotly.NET exposes `yaxis2` via `DynamicObj` since the typed API does not yet have a direct `WithYAxis2` helper. Setting `range` to `[0, maxVol * 4]` effectively confines the bars to the lower quarter of the chart area.

_Overlays ASML close price (left y-axis, EUR) and daily volume converted to millions (right y-axis) — uses `DynamicObj` to configure `yaxis2` since the Plotly.NET typed API lacks a `WithYAxis2` helper, and sets `range: [0, maxVol * 4]` to confine volume bars to the lower quarter of the chart area._

```csharp
var dates = asmlDates.Select(d => DateTime.Parse(d)).ToArray();
var asmlVolDouble = asmlVol.Select(v => (double)v / 1_000_000.0).ToArray();
var maxVol = asmlVolDouble.Max();

var priceLine = Plotly.NET.CSharp.Chart.Line<DateTime, double, string>(
    x: dates, y: asmlClose, Name: "Close (EUR)")
    .WithAxisAnchor(Y: 1);

var volArea = Plotly.NET.CSharp.Chart.Column<double, DateTime, string>(
    values: asmlVolDouble, Keys: dates, Name: "Volume (M)")
    .WithAxisAnchor(Y: 2)
    .WithMarkerStyle(Color: Color.fromHex("#4a6cf7"), Opacity: 0.3);

var layout = Layout.init<string>(
    PaperBGColor: Color.fromString("transparent"),
    PlotBGColor: Color.fromString("transparent"),
    Font: Font.init(Color: Color.fromHex("#cccccc")));

var yaxis2 = new global::DynamicObj.DynamicObj();
yaxis2.SetValue("title", "Volume (M)");
yaxis2.SetValue("overlaying", "y");
yaxis2.SetValue("side", "right");
yaxis2.SetValue("range", new[] { 0.0, maxVol * 4.0 });
yaxis2.SetValue("showgrid", false);
layout.SetValue("yaxis2", yaxis2);

Plotly.NET.CSharp.Chart.Combine(new[] { volArea, priceLine })
    .WithTitle("ASML — Close Price + Volume")
    .WithYAxisStyle(Title.init("Close (EUR)"))
    .WithSize(900, 450)
    .WithLayout(layout)
```

<iframe src="/static/plotly/df_cs_08_03.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

---

## Bar Charts

Bar charts compare discrete categories by encoding values as bar lengths. `Chart.Column<TValue, TKeys, TName>()` produces vertical bars; `Chart.Combine()` with `BarMode.Stack` produces stacked bars.

**Best for:** Ranking (top N symbols by price or volume), part-to-whole composition (up vs down day volume). Horizontal orientation works better when category labels are long.

### Grouped Bar Chart

#### Plotly.NET | Grouped bar — average close price by top 5 symbols

Groups by symbol, computes mean close, sorts descending, and takes the top 5. `Chart.Column` maps `barValues` (heights) to `barSymbols` (x-axis categories).

_Groups all EuroStoxx 50 symbols by mean close price using Polars.NET `GroupBy().Agg()`, takes the top 5 by descending average, and renders them as a `Chart.Column` bar chart with symbol labels on the x-axis._

```csharp
var avgClose = dfP.GroupBy("symbol")
    .Agg(Col("close").Mean().Alias("avg_close"))
    .Sort("avg_close", descending: true)
    .Head(5);

var barSymbols = avgClose.Column("symbol").ToArray<string>();
var barValues = avgClose.Column("avg_close").ToArray<double>();

Plotly.NET.CSharp.Chart.Column<double, string, string>(barValues, Keys: barSymbols)
    .WithTitle("Top 5 Symbols — Average Close Price")
    .WithXAxisStyle(Title.init("Symbol"))
    .WithYAxisStyle(Title.init("Avg Close (EUR)"))
    .WithSize(900, 450)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<iframe src="/static/plotly/df_cs_08_04.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Stacked Bar Chart

#### Plotly.NET | Stacked bar — total volume by top 5 symbols

Splits each symbol's total volume into "up days" (close > open) and "down days" (close ≤ open) to reveal whether buying or selling pressure dominates. `BarMode.Stack` stacks the two bar series; `Chart.Combine()` merges the two traces before applying layout.

_For each of the top 5 symbols, sums daily volume separately into up-day (close > open) and down-day buckets using a `for` loop, renders two `Chart.Column` traces colored green (`#26a69a`) and red (`#ef5350`) respectively, and stacks them with `BarMode.Stack` to reveal per-symbol buying vs selling pressure._

```csharp
var top5Syms = avgClose.Column("symbol").ToArray<string>();

var upVolumes = new double[top5Syms.Length];
var downVolumes = new double[top5Syms.Length];

for (int i = 0; i < top5Syms.Length; i++)
{
    var sub = dfP.Filter(Col("symbol") == Lit(top5Syms[i]));
    var upDays = sub.Filter(Col("close") > Col("open"));
    var downDays = sub.Filter(Col("close") <= Col("open"));
    upVolumes[i] = upDays.Column("volume").ToArray<long>().Select(v => (double)v).Sum();
    downVolumes[i] = downDays.Column("volume").ToArray<long>().Select(v => (double)v).Sum();
}

var upBar = Plotly.NET.CSharp.Chart.Column<double, string, string>(upVolumes, Keys: top5Syms, Name: "Up days")
    .WithMarkerStyle(Color: Color.fromHex("#26a69a"));
var downBar = Plotly.NET.CSharp.Chart.Column<double, string, string>(downVolumes, Keys: top5Syms, Name: "Down days")
    .WithMarkerStyle(Color: Color.fromHex("#ef5350"));

Plotly.NET.CSharp.Chart.Combine(new[] { upBar, downBar })
    .WithTitle("Top 5 Symbols — Volume by Day Type (Stacked)")
    .WithXAxisStyle(Title.init("Symbol"))
    .WithYAxisStyle(Title.init("Total Volume"))
    .WithSize(900, 450)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc")),
        BarMode: StyleParam.BarMode.Stack))
```

<iframe src="/static/plotly/df_cs_08_05.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

---

## Scatter & Distribution

Scatter plots reveal relationships between two continuous variables. Histograms show distribution shape. Box plots summarize with quartiles and flag outliers. In Plotly.NET: `Chart.Point` for scatter, `Chart.Histogram` for distribution, `Chart.BoxPlot` for quartile summaries.

**How to read a scatter plot:** each dot is one observation. Dots rising left-to-right = positive correlation; no pattern = no linear relationship (non-linear patterns may still exist). Dense clusters = common value combinations.

### Scatter Plot

#### Plotly.NET | Scatter — close vs volume (ASML)

Plots ASML's closing price against daily volume to explore whether high-volume days correlate with price levels. `Opacity: 0.6` reduces overplotting for overlapping points.

_Casts ASML volume from `long` to `double`, then renders 1,331 data points as a `Chart.Point` scatter plot with volume on x and close price on y, using size-4 markers at 60% opacity to reduce overplotting._

```csharp
var scatterVol = asmlVol.Select(v => (double)v).ToArray();

Plotly.NET.CSharp.Chart.Point<double, double, string>(scatterVol, asmlClose)
    .WithTitle("ASML — Close vs Volume")
    .WithXAxisStyle(Title.init("Volume"))
    .WithYAxisStyle(Title.init("Close (EUR)"))
    .WithMarkerStyle(Size: 4, Color: Color.fromHex("#42a5f5"), Opacity: 0.6)
    .WithSize(900, 450)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<iframe src="/static/plotly/df_cs_08_06.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Histogram

#### Plotly.NET | Histogram — ASML daily returns distribution

**How to read:** bar height = frequency (count of days) in each return bucket. A roughly symmetric bell shape centered near zero is expected for daily stock returns. Heavy tails (bars far from zero taller than expected) indicate fat-tail risk — more extreme moves than a normal distribution predicts.

Computes daily percentage returns as `(close[i] - close[i-1]) / close[i-1] * 100`. The array is one element shorter than the close price array.

_Computes 1,330 daily percentage returns from ASML's close price array using a `for` loop, then passes the resulting `double[]` to `Chart.Histogram` which auto-bins the distribution and renders frequency counts per return bucket._

```csharp
var returns = new double[asmlClose.Length - 1];
for (int i = 1; i < asmlClose.Length; i++)
    returns[i - 1] = (asmlClose[i] - asmlClose[i - 1]) / asmlClose[i - 1] * 100.0;

Plotly.NET.CSharp.Chart.Histogram<double, double, string>(X: returns)
    .WithTitle("ASML — Daily Returns Distribution (%)")
    .WithXAxisStyle(Title.init("Daily Return (%)"))
    .WithYAxisStyle(Title.init("Frequency"))
    .WithMarkerStyle(Color: Color.fromHex("#66bb6a"))
    .WithSize(900, 450)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<iframe src="/static/plotly/df_cs_08_07.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Box Plot

#### Plotly.NET | Box plot — close price distribution by symbol (top 5)

**How to read:** the box spans Q1–Q3 (the middle 50% of values). The horizontal line inside is the median. Whiskers extend to the farthest point within 1.5× the IQR. Points beyond whiskers are outliers. Compare box positions to see which symbol trades at a higher median price; compare box widths to see which has more price dispersion.

Builds one `BoxPlot` trace per symbol using LINQ and combines them with `Chart.Combine()`.

_For each of the top 5 symbols, extracts the full close price array and constructs a `Chart.BoxPlot` trace with symbol-labeled x-axis categories; `Chart.Combine()` merges all 5 traces into a single grouped box plot showing median, IQR, whiskers, and outliers per symbol._

```csharp
var boxTraces = top5Syms.Select(sym =>
{
    var sub = dfP.Filter(Col("symbol") == Lit(sym));
    var closes = sub.Column("close").ToArray<double>();
    var labels = Enumerable.Repeat(sym, closes.Length).ToArray();
    return Plotly.NET.CSharp.Chart.BoxPlot<string, double, string>(X: labels, Y: closes, Name: sym);
}).ToArray();

Plotly.NET.CSharp.Chart.Combine(boxTraces)
    .WithTitle("Close Price Distribution — Top 5 Symbols")
    .WithXAxisStyle(Title.init("Symbol"))
    .WithYAxisStyle(Title.init("Close (EUR)"))
    .WithSize(900, 450)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<iframe src="/static/plotly/df_cs_08_08.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

---

## Financial Charts

Candlestick and combined price+volume charts are the standard display for OHLCV data in financial analysis. Each candlestick encodes four values per period; adding volume below helps distinguish meaningful price moves from noise.

> [!tip] Related pattern
>
> The financial metrics rendered in these charts — daily returns, OHLC spreads, volume — are defined in [chart-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/chart-metrics). For the dashboard-level KPIs these charts feed into, see [index-snapshot-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/index-snapshot-metrics).

### Candlestick Chart

#### Plotly.NET | Candlestick — ASML OHLC

**How to read:** the body of each candle spans open to close. A green (hollow) body means close > open (bullish); a red (filled) body means close < open (bearish). The upper wick reaches the daily high; the lower wick reaches the daily low. Long wicks signal price rejection — buying or selling pressure reversed the move. A small body with long wicks (doji) indicates indecision.

_Renders ASML's full 1,331-day OHLC history as an interactive Plotly candlestick chart using pre-extracted `asmlOpen`, `asmlHigh`, `asmlLow`, and `asmlClose` arrays with date strings on the x-axis._

```csharp
Plotly.NET.CSharp.Chart.Candlestick<double, string, string>(asmlOpen, asmlHigh, asmlLow, asmlClose, asmlDates)
    .WithTitle("ASML — Candlestick Chart")
    .WithXAxisStyle(Title.init("Date"))
    .WithYAxisStyle(Title.init("Price (EUR)"))
    .WithSize(900, 450)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<iframe src="/static/plotly/df_cs_08_09.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Candlestick with Volume Overlay

#### Plotly.NET | Candlestick + volume overlay

Renders candlestick and volume as two separate chart objects displayed sequentially via `display()` and the implicit return. Restricts to the last 130 trading days (~6 months) for readability — full history makes individual candles too narrow to read interactively.

_Slices the last 130 trading days from the ASML arrays using `TakeLast()`, renders a candlestick for OHLC and a separate area chart for volume (in millions), and outputs both charts sequentially — the candlestick via `display()` and the volume area via implicit return._

```csharp
var nCandle = Math.Min(130, asmlDates.Length);
var cDates = asmlDates.TakeLast(nCandle).Select(d => DateTime.Parse(d)).ToArray();
var cOpen = asmlOpen.TakeLast(nCandle).ToArray();
var cHigh = asmlHigh.TakeLast(nCandle).ToArray();
var cLow = asmlLow.TakeLast(nCandle).ToArray();
var cClose = asmlClose.TakeLast(nCandle).ToArray();
var cVol = asmlVol.TakeLast(nCandle).Select(v => (double)v / 1_000_000.0).ToArray();

var candle = Plotly.NET.CSharp.Chart.Candlestick<double, DateTime, string>(
        cOpen, cHigh, cLow, cClose, cDates)
    .WithTitle("ASML — Candlestick (last 6 months)")
    .WithYAxisStyle(Title.init("Price (EUR)"))
    .WithSize(900, 450)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))));

var volArea = Plotly.NET.CSharp.Chart.Area<DateTime, double, string>(
        x: cDates, y: cVol, Name: "Volume (M)")
    .WithTitle("Volume")
    .WithYAxisStyle(Title.init("Volume (millions)"))
    .WithSize(900, 300)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))));

display(candle);
volArea
```

<iframe src="/static/plotly/df_cs_08_10.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

<iframe src="/static/plotly/df_cs_08_11.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

---

## Heatmap

Heatmaps encode a matrix of values as colors — ideal for correlation matrices and pivot tables. Plotly.NET's `Chart.Heatmap` takes a `List<double[]>` as the z-matrix, with row and column labels provided as string arrays.

**How to read a correlation matrix:** values range from −1 to +1. Dark warm colors (close to +1) = variables move together; dark cool colors (close to −1) = variables move in opposite directions; near-zero = no linear relationship. The diagonal is always 1.0 (a variable is perfectly correlated with itself). Look for off-diagonal clusters of strong color — these reveal groups of collinear variables.

### Correlation Heatmap

#### Plotly.NET | Correlation heatmap — OHLCV numeric columns (ASML)

Computes the 5×5 Pearson correlation matrix for OHLCV columns using a local helper function. Note that Polars.NET does not expose a built-in `.corr()` method, so the matrix is computed manually via array iteration.

_Defines a local `Pearson()` function, builds a 5×5 correlation matrix over ASML's open/high/low/close/volume arrays (volume cast from `long` to `double`), rounds each value to 3 decimal places, and passes the result to `Chart.Heatmap` with column names as both x and y labels._

```csharp
var colNames = new[] { "open", "high", "low", "close", "volume" };
var arrays = colNames.Select(c =>
{
    if (c == "volume")
        return asml.Column(c).ToArray<long>().Select(v => (double)v).ToArray();
    return asml.Column(c).ToArray<double>();
}).ToArray();

// Compute Pearson correlation matrix
double Pearson(double[] x, double[] y)
{
    int n = x.Length;
    double mx = x.Average(), my = y.Average();
    double num = 0, dx = 0, dy = 0;
    for (int i = 0; i < n; i++)
    {
        double a = x[i] - mx, b = y[i] - my;
        num += a * b;
        dx += a * a;
        dy += b * b;
    }
    return num / Math.Sqrt(dx * dy);
}

int dim = colNames.Length;
var corrMatrix = new List<double[]>();
for (int r = 0; r < dim; r++)
{
    var row = new double[dim];
    for (int c = 0; c < dim; c++)
        row[c] = Math.Round(Pearson(arrays[r], arrays[c]), 3);
    corrMatrix.Add(row);
}

Plotly.NET.CSharp.Chart.Heatmap<double, string, string, string>(corrMatrix, X: colNames, Y: colNames)
    .WithTitle("ASML — OHLCV Correlation Matrix")
    .WithSize(600, 550)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<iframe src="/static/plotly/df_cs_08_12.html" width="100%" height="600" style="border:none;border-radius:8px;" loading="lazy"></iframe>

---

## Static Export with ScottPlot

ScottPlot generates static PNG/SVG images without JavaScript — ideal for batch export, server-side reporting, or embedding in non-HTML contexts. The `Plot` class manages the figure; `plt.Add.Scatter()` adds traces; `plt.SavePng()` writes to disk. Date axes require OADate (OLE Automation date = days since 1899-12-30) for the x-axis tick formatter.

> [!tip] ScottPlot vs Plotly.NET for static export
>
> Use **ScottPlot** when you need PNG/SVG/PDF files at scale (batch scripts, CI pipelines, PDF reports) — no browser required, fast rendering even for 100k+ points.
> Use **Plotly.NET** for interactive exploration in notebooks where hover, zoom, and pan add value.

### Line Chart Export

#### ScottPlot | Line chart — ASML close price saved as PNG

Converts date strings to OADate (required by ScottPlot's `DateTimeTicksBottom()` formatter), adds a scatter trace, applies a dark theme, and saves to PNG.

_Converts ASML's 1,331 date strings to OADate values via `DateTime.Parse().ToOADate()`, renders a scatter line with 1.5px width and no markers, applies a dark color scheme (`#1e1e1e` background, `#2d2d2d` data area), and writes a 900×450 PNG to the shared data folder._

```csharp
var plt = new ScottPlot.Plot();

var oaDates = asmlDates.Select(d => DateTime.Parse(d).ToOADate()).ToArray();

var sig = plt.Add.Scatter(oaDates, asmlClose);
sig.LineWidth = 1.5f;
sig.MarkerSize = 0;

plt.Title("ASML — Close Price (ScottPlot)");
plt.XLabel("Date");
plt.YLabel("Close (EUR)");
plt.Axes.DateTimeTicksBottom();

plt.Axes.Color(ScottPlot.Color.FromHex("#cccccc"));
plt.FigureBackground.Color = ScottPlot.Color.FromHex("#1e1e1e");
plt.DataBackground.Color = ScottPlot.Color.FromHex("#2d2d2d");

var pngPath = Path.Combine(DATA, "asml_scottplot.png");
plt.SavePng(pngPath, 900, 450);
Console.WriteLine($"Saved: {Path.GetFullPath(pngPath)}");
```

    Saved: c:\Users\aperi\DEV\LANG\data\asml_scottplot.png

---

## Pie, Donut & Radar

Pie and donut charts show part-to-whole composition for a single categorical variable. Radar charts (spider/polar charts) compare a single entity across multiple normalized dimensions. Use `Chart.Pie`, `Chart.Doughnut`, and `Chart.ScatterPolar` in Plotly.NET.CSharp.

**Best for pie/donut:** ≤6 slices with clearly distinct proportions (market share, budget allocation). For precise comparisons or many categories, prefer bar charts — humans judge bar lengths more accurately than angles.

**Best for radar:** profiling a single entity across 4–8 metrics (e.g., comparing OHLCV magnitude ratios across three stocks). Not suitable for many entities — overlapping polygons become unreadable.

### Pie Chart

#### Plotly.NET | Pie chart — Volume share by top symbols

Groups by symbol, sums total traded volume, takes the top 8 by volume. `Chart.Pie` renders slices proportional to `pieVals`.

_Groups all EuroStoxx 50 rows by symbol, sums `volume` cast to Float64, sorts descending, takes the top 8, and passes symbol labels and volume totals to `Chart.Pie` — each slice is sized proportionally to total traded volume._

```csharp
var volBySymbol = dfP.GroupBy("symbol")
    .Agg(Col("volume").Cast(DataType.Float64).Sum().Alias("total_vol"))
    .Sort("total_vol", descending: true)
    .Head(8);

var pieLabels = volBySymbol.Column("symbol").ToArray<string>();
var pieVals = volBySymbol.Column("total_vol").ToArray<double>();

Plotly.NET.CSharp.Chart.Pie<double, string, string>(values: pieVals, Labels: pieLabels)
    .WithTitle("Volume Share — Top 8 Symbols")
    .WithSize(700, 500)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<iframe src="/static/plotly/df_cs_08_13.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Donut Chart

#### Plotly.NET | Donut chart — Trade count by exchange suffix

Extracts exchange suffix from each symbol ticker (e.g., `.AS` from `ASML.AS`) using LINQ string splitting, then counts rows per exchange. `Chart.Doughnut` is identical to `Chart.Pie` but adds a hole in the center — useful for placing a KPI label or total count.

_Extracts the exchange suffix from all 66,355 symbol strings using `Split('.').Last()`, groups and counts rows per suffix with LINQ, sorts descending, and renders a `Chart.Doughnut` with proportional slices — the center hole is left available for a KPI total label._

```csharp
var symbolArr = dfP.Column("symbol").ToArray<string>();
var exchangeCounts = symbolArr
    .Select(s => "." + s.Split('.').Last())
    .GroupBy(e => e)
    .Select(g => new { Exchange = g.Key, Count = (double)g.Count() })
    .OrderByDescending(x => x.Count)
    .ToArray();

var donutLabels = exchangeCounts.Select(x => x.Exchange).ToArray();
var donutVals = exchangeCounts.Select(x => x.Count).ToArray();

Plotly.NET.CSharp.Chart.Doughnut<double, string, string>(values: donutVals, Labels: donutLabels)
    .WithTitle("Row Count by Exchange")
    .WithSize(700, 500)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<iframe src="/static/plotly/df_cs_08_14.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Radar Chart

#### Plotly.NET | Radar chart — Normalized metrics for top 3 symbols

**How to read:** each spoke represents one metric. Distance from the center = normalized magnitude (0 = global minimum, 1 = global maximum for that metric). A larger polygon area = higher overall magnitude across all dimensions. Compare polygon shapes: if one stock is much larger on `volume` but similar on `close`, it trades with higher activity relative to its price level.

Normalizes each metric to [0, 1] by dividing the per-symbol average by the global maximum. Closes the polygon by appending `vals[0]` and `metrics[0]` at the end.

_For ASML, SAP, and Siemens, computes average open/high/low/close/volume (volume averaged as `double`) and normalizes each to [0,1] by dividing by the global metric max; closes each polygon by appending the first value, then combines three `Chart.ScatterPolar` traces in `Lines` mode with a transparent polar background._

```csharp
var radarSyms = new[] { "ASML.AS", "SAP.DE", "SIE.DE" };
var metrics = new[] { "open", "high", "low", "close", "volume" };

// Get global max per metric for normalization
var globalMax = metrics.Select(m =>
    m == "volume"
        ? dfP.Column(m).ToArray<long>().Max()
        : (long)dfP.Column(m).ToArray<double>().Max()
).ToArray();

var radarTraces = radarSyms.Select(sym =>
{
    var sub = dfP.Filter(Col("symbol") == Lit(sym));
    var vals = new double[metrics.Length];
    for (int j = 0; j < metrics.Length; j++)
    {
        double avg = metrics[j] == "volume"
            ? sub.Column(metrics[j]).ToArray<long>().Average(v => (double)v)
            : sub.Column(metrics[j]).ToArray<double>().Average();
        vals[j] = avg / globalMax[j];
    }
    return Plotly.NET.CSharp.Chart.ScatterPolar<double, string, string>(
        r: vals.Append(vals[0]).ToArray(),
        theta: metrics.Append(metrics[0]).ToArray(),
        mode: StyleParam.Mode.Lines, Name: sym);
}).ToArray();

// Set polar subplot background to transparent
var polar = new Plotly.NET.LayoutObjects.Polar();
polar.SetValue("bgcolor", "rgba(0,0,0,0)");

var layout = Layout.init<string>(
    PaperBGColor: Color.fromString("transparent"),
    PlotBGColor: Color.fromString("transparent"),
    Font: Font.init(Color: Color.fromHex("#cccccc")));
layout.SetValue("polar", polar);

Plotly.NET.CSharp.Chart.Combine(radarTraces)
    .WithTitle("Normalized OHLCV Metrics — Radar Comparison")
    .WithSize(700, 550)
    .WithLayout(layout)
```

<iframe src="/static/plotly/df_cs_08_15.html" width="100%" height="600" style="border:none;border-radius:8px;" loading="lazy"></iframe>

---

## Summary

> [!question] Which library should I use?
>
> - **Plotly.NET** — interactive notebook exploration, hover tooltips, click-to-filter. Use when end consumers are data analysts working in .NET Interactive or VS Code.
> - **ScottPlot** — batch PNG/SVG export, server-side report generation, CI pipelines. No JS dependency; handles 100k+ points faster than Plotly.
> - **OxyPlot** — PDF export and WPF/Avalonia desktop embedding. Note: has known NuGet compatibility issues with .NET 10 Interactive (prefer ScottPlot for static export in notebooks).
>
> For the Quartz published site, all Plotly charts are pre-rendered as iframe embeds — interactive features are preserved in the HTML output files.

### Library decision guide

| Library | Strengths | Weaknesses | Best For |
|---|---|---|---|
| **Plotly.NET** | Interactive, rich chart types, dark theme, hover tooltips, VS Code integration via `Plotly.NET.Interactive` | Large JS payload, slower with 100k+ points | Dashboards, exploration, notebooks |
| **ScottPlot** | Fast rendering, simple API, no JS dependency, direct PNG/SVG export | No interactivity in notebooks, limited chart types vs Plotly | Batch export, server-side generation, performance-critical plots |
| **OxyPlot** | PDF/SVG export, WPF/Avalonia integration, mature ecosystem | Complex API, NuGet compatibility issues with .NET 10 Interactive | Desktop apps, print-quality PDF reports |

**Recommendation:** Use **Plotly.NET** for interactive notebook exploration, **ScottPlot** for static image export and performance, and **OxyPlot** when PDF output or desktop GUI embedding is required.
