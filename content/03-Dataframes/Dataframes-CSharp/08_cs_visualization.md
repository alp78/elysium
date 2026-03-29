---
type: reference
category: programming-languages
technology:
  - csharp
  - dotnet
  - polars
tags: [pipeline, csharp, deedle, polars, dataframes]
aliases:
  - charts, plots, Plotly, matplotlib, seaborn
keywords: [plot, bar, line, scatter, histogram, heatmap, Plotly, Plotly.NET, matplotlib, seaborn, visualization]
description: "Polars.NET / C# DataFrames reference 08/10 — Visualization (charts, plots, interactive graphics). Executable examples with cell outputs. See [[08_py_visualization]] for the Python equivalent."
related:
  - "[[dataframes-index]]"
  - "[[programming-languages-index]]"
  - "[[08_py_visualization]]"
  - "[[07_cs_types_interop]]"
  - "[[09_cs_database_interface]]"
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# 08 — Visualization

Plotly.NET for interactive charts, ScottPlot for static/performance, OxyPlot for PDF export.

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

#### Load OHLCV data and prepare arrays

```csharp
// Load OHLCV data and extract arrays for charting
var dfP = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"), tryParseDates: true);
display($"Loaded: {dfP.Shape}");

// Filter to ASML.AS for single-stock charts
var asml = dfP.Filter(Col("symbol") == Lit("ASML.AS")).Sort("date");
// Cast date to string for array extraction (Date type can't ToArray<string> directly)
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

#### Single line — ASML close price over time

```csharp
// Single-line chart — ASML closing price
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

#### Multi-line — overlay ASML, SAP, SIE close prices

```csharp
// Multi-line chart — compare three stocks
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

#### Dual y-axis — ASML price + volume

```csharp
// Price + Volume on dual y-axis — volume confined to bottom third
var dates = asmlDates.Select(d => DateTime.Parse(d)).ToArray();
var asmlVolDouble = asmlVol.Select(v => (double)v / 1_000_000.0).ToArray();
var maxVol = asmlVolDouble.Max();

// Price on y1 (full height)
var priceLine = Plotly.NET.CSharp.Chart.Line<DateTime, double, string>(
    x: dates, y: asmlClose, Name: "Close (EUR)")
    .WithAxisAnchor(Y: 1);

// Volume on y2 (bottom third — set range to 3x max so bars fill ~33%)
var volArea = Plotly.NET.CSharp.Chart.Column<double, DateTime, string>(
    values: asmlVolDouble, Keys: dates, Name: "Volume (M)")
    .WithAxisAnchor(Y: 2)
    .WithMarkerStyle(Color: Color.fromHex("#4a6cf7"), Opacity: 0.3);

var layout = Layout.init<string>(
    PaperBGColor: Color.fromString("transparent"),
    PlotBGColor: Color.fromString("transparent"),
    Font: Font.init(Color: Color.fromHex("#cccccc")));

// yaxis2: overlays y1, right side, range 0..3x max so bars stay in bottom third, no grid
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

#### Grouped bar — average close price by top 5 symbols

```csharp
// Grouped bar — average close price for top 5 symbols by mean close
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

#### Stacked bar — total volume by top 5 symbols

```csharp
// Stacked bar — split total volume into open-above-close vs close-above-open days
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

#### Scatter — close vs volume (ASML)

```csharp
// Scatter — does volume correlate with close price?
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

#### Histogram — ASML daily returns distribution

```csharp
// Histogram — daily percentage returns
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

#### Box plot — close price distribution by symbol (top 5)

```csharp
// Box plot — close price spread for top 5 symbols
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

> [!tip] Related pattern
> The financial metrics rendered in these charts — daily returns, OHLC spreads, volume — are defined in [[chart-metrics]]. For the dashboard-level KPIs these charts feed into, see [[index-snapshot-metrics]].

#### Candlestick — ASML OHLC

```csharp
// Candlestick — ASML open/high/low/close
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

#### Candlestick + volume overlay

```csharp
// Candlestick with volume area below (last 6 months for readability)
var nCandle = Math.Min(130, asmlDates.Length);  // ~6 months of trading days
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

#### Correlation heatmap — OHLCV numeric columns (ASML)

```csharp
// Correlation heatmap — Pearson correlation between OHLCV columns
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

---
## Pie, Donut & Radar

#### Pie chart — Volume share by top symbols

```csharp
// Pie chart — volume share by top 8 symbols
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

#### Donut chart — Trade count by exchange suffix

```csharp
// Donut chart — trade count by exchange suffix
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

#### Radar chart — Normalized metrics for top 3 symbols

```csharp
// Radar chart — compare avg OHLCV metrics for 3 symbols (normalized 0-1)
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

#### ScottPlot line chart — ASML close price saved as PNG

```csharp
// ScottPlot — static line chart exported as PNG
var plt = new ScottPlot.Plot();

// Convert dates to OADate for ScottPlot x-axis
var oaDates = asmlDates.Select(d => DateTime.Parse(d).ToOADate()).ToArray();

var sig = plt.Add.Scatter(oaDates, asmlClose);
sig.LineWidth = 1.5f;
sig.MarkerSize = 0;

plt.Title("ASML — Close Price (ScottPlot)");
plt.XLabel("Date");
plt.YLabel("Close (EUR)");
plt.Axes.DateTimeTicksBottom();

// Dark theme
plt.Axes.Color(ScottPlot.Color.FromHex("#cccccc"));
plt.FigureBackground.Color = ScottPlot.Color.FromHex("#1e1e1e");
plt.DataBackground.Color = ScottPlot.Color.FromHex("#2d2d2d");

var pngPath = Path.Combine(DATA, "asml_scottplot.png");
plt.SavePng(pngPath, 900, 450);
Console.WriteLine($"Saved: {Path.GetFullPath(pngPath)}");
```

    Saved: c:\Users\aperi\DEV\LANG\data\asml_scottplot.png

---

## Summary

#### Library decision guide

| Library | Strengths | Weaknesses | Best For |
|---|---|---|---|
| **Plotly.NET** | Interactive, rich chart types, dark theme, hover tooltips, VS Code integration via `Plotly.NET.Interactive` | Large JS payload, slower with 100k+ points | Dashboards, exploration, notebooks |
| **ScottPlot** | Fast rendering, simple API, no JS dependency, direct PNG/SVG export | No interactivity in notebooks, limited chart types vs Plotly | Batch export, server-side generation, performance-critical plots |
| **OxyPlot** | PDF/SVG export, WPF/Avalonia integration, mature ecosystem | Complex API, NuGet compatibility issues with .NET 10 Interactive | Desktop apps, print-quality PDF reports |

**Recommendation:** Use **Plotly.NET** for interactive notebook exploration, **ScottPlot** for static image export and performance, and **OxyPlot** when PDF output or desktop GUI embedding is required.
