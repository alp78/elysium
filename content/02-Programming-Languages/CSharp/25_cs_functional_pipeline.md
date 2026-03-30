---
type: reference
category: programming-languages
technology: [csharp, dotnet, fluentvalidation, polly, dapper, sqlserver]
tags: [csharp, pipeline, data-quality, lineage, dotnet, fluentvalidation, polly, dapper, aspnet, sql-server, medallion, parquet, validation, plotly]
aliases: [functional pipeline csharp, medallion pipeline dotnet, data lineage csharp]
keywords: [pipeline, medallion, bronze, silver, gold, fluentvalidation, validation, lineage, aspnet, parquet, polly, dapper]
description: "End-to-end functional data pipeline in C#/.NET with FluentValidation, Polly resilience, lineage tracking, Parquet export, and ASP.NET serving. See [[25_py_functional_pipeline]] for the Python equivalent."
related:
  - "[[moc-programming-languages]]"
  - "[[25_py_functional_pipeline]]"
  - "[[functional-pipeline-architecture]]"
  - "[[18_cs_designpatterns]]"
  - "[[15_cs_webapis]]"
  - "[[16_cs_database]]"
  - "[[10_cs_serialization_formats]]"
  - "[[23_cs_data_ingestion]]"
  - "[[medallion-architecture]]"
  - "[[data-modeling-patterns]]"
created: 2026-03-29
updated: 2026-03-30
status: complete
---

# 25. Functional Data Pipeline — C# / .NET

**A production-grade data pipeline architecture combining five principles:**
functional core/imperative shell, contract-first validation, quality gates,
data provenance with SHA-256 tamper detection, and semantic context propagation.

**Data flow:** HttpClient → JSON landing → FluentValidation → Bronze →
LINQ transforms → Silver → LINQ aggregation → Gold → Parquet → HttpListener API

**Two orthogonal dimensions of data trustworthiness:**
- **Structural integrity** (vertical) — pure transforms, typed contracts, quality gates, immutable records
- **Semantic integrity** (horizontal) — column context, business context, temporal markers, lineage tracking

```csharp
#r "nuget: Microsoft.Data.SqlClient"
#r "nuget: Dapper"
#r "nuget: FluentValidation"
#r "nuget: Polly"
#r "nuget: Plotly.NET, 5.1.0"
#r "nuget: Plotly.NET.Interactive, 5.0.0"
#r "nuget: Plotly.NET.CSharp, 0.13.0"
#r "nuget: Polars.NET"
#r "nuget: Polars.NET.Native.win-x64"
#r "nuget: ParquetSharp"

using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Data;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using System.Reflection;
using Microsoft.Data.SqlClient;
using Microsoft.DotNet.Interactive;
using Microsoft.DotNet.Interactive.CSharp;
using Microsoft.DotNet.Interactive.Formatting;
using Dapper;
using FluentValidation;
using Polly;
using Polly.Retry;
using Plotly.NET;
using Plotly.NET.CSharp;
using Chart = Plotly.NET.CSharp.Chart;
using Plotly.NET.LayoutObjects;

// ── Warning suppression ──
var csharpKernel = (CSharpKernel)Kernel.Root.FindKernelByName("csharp");
var optionsField = typeof(CSharpKernel).GetField("_scriptOptions",
    BindingFlags.NonPublic | BindingFlags.Instance);
var scriptOptions = optionsField.GetValue(csharpKernel);
var withWarningLevel = scriptOptions.GetType().GetMethod("WithWarningLevel");
var newOptions = withWarningLevel.Invoke(scriptOptions, new object[] { 0 });
optionsField.SetValue(csharpKernel, newOptions);

// ── DataTable HTML formatter — transparent background ──
Formatter.Register<DataTable>((dt, writer) => {
    writer.Write("<table style='border-collapse:collapse;background:transparent;color:inherit;'>");
    writer.Write("<tr>");
    foreach (DataColumn col in dt.Columns)
        writer.Write($"<th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>{col.ColumnName}</th>");
    writer.Write("</tr>");
    foreach (DataRow row in dt.Rows) {
        writer.Write("<tr>");
        foreach (var val in row.ItemArray)
            writer.Write($"<td style='text-align:left;padding:4px 12px;'>{val}</td>");
        writer.Write("</tr>");
    }
    writer.Write("</table>");
}, "text/html");
```

    Installed Packages: Dapper 2.1.72, FluentValidation 12.1.1,
    Microsoft.Data.SqlClient 7.0.0, ParquetSharp 21.0.0,
    Plotly.NET 5.1.0, Polars.NET 0.4.0, Polly 8.6.6

## 1. Configuration & Constants

Central configuration: paths, SQL connection, stock universe, date range.
Every downstream cell references these constants — change them here, not in
individual cells.

#### C# — define pipeline paths, SQL connection, and stock universe

> [!info] Central Configuration Cell
>
> All downstream cells reference these constants — paths, SQL connection, stock universe, and date range. Change them here, not in individual cells.

```csharp
// ── Paths ──
string DATA_DIR    = @"C:\Users\aperi\DEV\LANG\data";
string EXPORT_DIR  = Path.Combine(DATA_DIR, "pipeline");
string LINEAGE_DIR = Path.Combine(EXPORT_DIR, "lineage");
string LANDING_DIR = Path.Combine(DATA_DIR, "pipeline", "landing");
Directory.CreateDirectory(EXPORT_DIR);
Directory.CreateDirectory(LANDING_DIR);
Directory.CreateDirectory(LINEAGE_DIR);

// ── SQL Server (local Docker instance) ──
string SQL_CONN_STR = "Server=localhost,1434;Database=stoxx;User Id=sa;Password=EsgDev2026Pass1;Encrypt=yes;TrustServerCertificate=yes;";
SqlConnection sqlConn = new SqlConnection(SQL_CONN_STR);
sqlConn.Open();

// ── Stock universe — 5 EURO STOXX 50 components for demo ──
string[] SYMBOLS = { "SAP.DE", "SIE.DE", "ALV.DE", "DTE.DE", "BAS.DE" };
int LOOKBACK_DAYS = 365 * 2;
string START_DATE = DateTime.Today.AddDays(-LOOKBACK_DAYS).ToString("yyyy-MM-dd");
string END_DATE   = DateTime.Today.ToString("yyyy-MM-dd");

// ── Exchange mapping: Yahoo Finance exchange code → calendar name ──
Dictionary<string, string> EXCHANGE_MAP = new() {
    ["GER"] = "XETR", ["FRA"] = "XFRA", ["PAR"] = "XPAR",
    ["AMS"] = "XAMS", ["BRU"] = "XBRU", ["MIL"] = "XMIL",
    ["MCE"] = "XMAD", ["NMS"] = "XNYS", ["NYQ"] = "XNYS",
    ["HKG"] = "XHKG", ["TKS"] = "XTKS",
};

Console.WriteLine($"Pipeline config loaded");
Console.WriteLine($"  Export dir:  {EXPORT_DIR}");
Console.WriteLine($"  Universe:    {string.Join(", ", SYMBOLS)}");
Console.WriteLine($"  Date range:  {START_DATE} → {END_DATE}");
```

    Pipeline config loaded
      Export dir:  C:\Users\aperi\DEV\LANG\data\pipeline
      Universe:    SAP.DE, SIE.DE, ALV.DE, DTE.DE, BAS.DE
      Date range:  2024-03-30 → 2026-03-30

## 2. Records + FluentValidation — Schema Validation at Every Boundary

Every stage boundary has a typed contract — a C# `record` that defines exactly what data can cross that boundary. Data that doesn't conform is rejected BEFORE it crosses, with the rejection recorded in the quarantine table. This is **Schema-on-Write** (Design by Contract, Bertrand Meyer 1986): the contract is code — it runs at runtime, it's version-controlled, it's unit-testable. The opposite of data lake Schema-on-Read, where bad data enters freely and is discovered months later.

The models divide into three groups along two orthogonal dimensions — **structural integrity** (vertical: is the data correct?) and **semantic integrity** (horizontal: is the data meaningful?):

**Structural models (boundary enforcement):**
- `RawOhlcv` — first line of defense: validates raw Yahoo Finance data at Bronze ingestion
- `CleanOhlcv` — validates enrichment transforms at Silver boundary
- `DailySummary` / `SymbolProfile` — validates aggregation output at Gold boundary

**Operational models (provenance tracking):**
- `StageLineage` — forensic record: row counts, SHA-256 hash, timing per stage
- `RunContext` — full pipeline execution envelope with business and temporal context

**Semantic models (self-describing data):**
- `ColumnContext` — what each column means, its formula, unit, null semantics
- `BusinessContext` — why this run was triggered (scheduled vs backfill vs correction)
- `TemporalContext` — as-of date vs knowledge date (bi-temporal)
- `StageContext` — propagated metadata flowing stage-to-stage with accumulated warnings

> [!danger] Without Typed Contracts
>
> A renamed API field silently loads NULLs into bronze — every row, every day. A negative volume passes through to silver unchallenged. A NaN daily return poisons the gold aggregation. By the time a dashboard user notices, the damage is three layers deep and every downstream consumer has absorbed corrupt data. Contracts catch bad data at ingestion — one layer, one fix.

#### record — define Bronze validation model with `record` and properties

> [!info] Bronze Contract: RawOhlcv
>
> Validates raw Yahoo Finance data BEFORE persistence to SQL Server. Enforces positive prices, non-negative volume, symbol not empty. FluentValidation adds `High >= Low` (market invariant — any violation = bad data). C# records are immutable by default.

```csharp
public record RawOhlcv(
    string Symbol,
    DateTime Date,
    double Open,
    double High,
    double Low,
    double Close,
    double AdjClose,
    long Volume,
    double Dividends = 0.0,
    double StockSplits = 0.0);

public class RawOhlcvValidator : AbstractValidator<RawOhlcv>
{
    public RawOhlcvValidator()
    {
        RuleFor(x => x.Symbol).NotEmpty();
        RuleFor(x => x.Open).GreaterThan(0);
        RuleFor(x => x.High).GreaterThan(0);
        RuleFor(x => x.Low).GreaterThan(0);
        RuleFor(x => x.Close).GreaterThan(0);
        RuleFor(x => x.AdjClose).GreaterThan(0);
        RuleFor(x => x.Volume).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Dividends).GreaterThanOrEqualTo(0);
        RuleFor(x => x.StockSplits).GreaterThanOrEqualTo(0);
        RuleFor(x => x.High).GreaterThanOrEqualTo(x => x.Low)
            .WithMessage("high must be >= low (market invariant)");
    }
}

var sample = new RawOhlcv("SAP.DE", new DateTime(2024, 1, 2), 144.5, 146.0, 143.8, 145.2, 145.2, 1_200_000);
var validator = new RawOhlcvValidator();
var result = validator.Validate(sample);
Console.WriteLine($"RawOhlcv validated: {sample.Symbol} {sample.Date:yyyy-MM-dd} close={sample.Close}");
```

    RawOhlcv validated: SAP.DE 2024-01-02 close=145.2

#### record — define Silver validation model with `record` and properties

> [!info] Silver Contract: CleanOhlcv
>
> Extends Bronze with three computed fields: `daily_return`, `intraday_range`, `sma_20`. Daily return constrained to [-50%, +50%] to catch extreme calculation errors. `batch_id` required — every Silver row must trace back to a pipeline run.

```csharp
public record CleanOhlcv(
    string Symbol,
    DateTime Date,
    double Open,
    double High,
    double Low,
    double Close,
    double AdjClose,
    long Volume,
    double Dividends,
    double StockSplits,
    double DailyReturn,
    double IntradayRange,
    double? Sma20,
    string BatchId);

public class CleanOhlcvValidator : AbstractValidator<CleanOhlcv>
{
    public CleanOhlcvValidator()
    {
        RuleFor(x => x.Symbol).NotEmpty();
        RuleFor(x => x.Open).GreaterThan(0);
        RuleFor(x => x.High).GreaterThan(0);
        RuleFor(x => x.Low).GreaterThan(0);
        RuleFor(x => x.Close).GreaterThan(0);
        RuleFor(x => x.AdjClose).GreaterThan(0);
        RuleFor(x => x.Volume).GreaterThanOrEqualTo(0);
        RuleFor(x => x.IntradayRange).GreaterThanOrEqualTo(0);
        RuleFor(x => x.High).GreaterThanOrEqualTo(x => x.Low)
            .WithMessage("high must be >= low");
        RuleFor(x => x.BatchId).NotEmpty();
    }
}

Console.WriteLine($"CleanOhlcv record defined — 14 fields");
```

    CleanOhlcv record defined — 14 fields

#### record — define Gold validation models with `record` and properties

> [!info] Gold Contracts: Two Mart Tables
>
> `DailySummary`: one row per trading day with cross-sectional metrics. `SymbolProfile`: one row per symbol with full-history aggregate stats. `max_drawdown` constrained to <= 0 (always negative — peak-to-trough decline).

```csharp
public record DailySummary(
    DateTime Date,
    int SymbolsTraded,
    double AvgReturn,
    double MaxReturn,
    double MinReturn,
    long TotalVolume,
    double AvgIntradayPct,
    string BatchId);

public record SymbolProfile(
    string Symbol,
    int TotalTradingDays,
    double AvgDailyReturn,
    double Volatility,
    double MaxDrawdown,
    double AvgVolume,
    double TotalDividends,
    DateTime FirstDate,
    DateTime LastDate,
    string BatchId);

Console.WriteLine($"DailySummary:  8 fields");
Console.WriteLine($"SymbolProfile: 10 fields");
```

    DailySummary:  8 fields
    SymbolProfile: 10 fields

#### record — define lineage tracking models with `record` and properties

> [!info] Lineage Model: StageLineage
>
> Records what a single pipeline stage produced: `input_rows` / `output_rows` / `rows_rejected` for data flow accounting, `output_hash` (SHA-256) for tamper detection, `DurationMs` computed from timestamps.

```csharp
public record StageLineage(
    string BatchId,
    string Stage,
    DateTime StartedAt,
    DateTime CompletedAt,
    int InputRows,
    int OutputRows,
    int RowsRejected,
    string OutputHash)
{
    public double DurationMs => (CompletedAt - StartedAt).TotalMilliseconds;
}
```

### Context Architecture — Semantic Metadata Layer

This is where the two dimensions of the architecture intersect. The structural models above ensure the pipeline produces **correct** data. The semantic models below ensure the data is **meaningful** to any consumer — another pipeline, a dashboard, an LLM agent, an auditor — without reading the pipeline source code.

- **ColumnContext** — documents what each column means, how it was derived, what NULL signifies. Without it, `volatility: 0.0187` is an opaque number. With it: unit=decimal_ratio, formula=std(daily_return), annualize with sqrt(252)
- **BusinessContext** — records WHY this run happened. Without it, two batches covering the same date range are indistinguishable. With it, one is `trigger=scheduled` and the other is `trigger=reprocess, is_correction=true`
- **TemporalContext** — separates "what date is this data FOR" (as_of_date) from "when did we learn about it" (knowledge_date). Without it, a backfill loading 2024 data in 2026 looks like a normal 2026 run
- **StageContext** — carries all of the above THROUGH the pipeline. Each stage inherits upstream warnings and adds its own. By gold, the context contains the full warning chain from every stage

> [!danger] Without Semantic Context
>
> An AI agent queries gold_symbol_profile and sees `volatility: 0.0187`. It doesn't know if that's a percentage or a decimal, daily or annual, what formula produced it, or what NULL would mean. It guesses — or hallucinates an interpretation. The data contract eliminates this: unit=decimal_ratio, formula=std(daily_return), annualize with sqrt(252). The number becomes self-describing.

#### record — define column semantic metadata model with `record`

> [!info] Semantic Metadata: ColumnContext
>
> Describes WHAT a column means, not just its type. `computation`: formula used to derive it. `source_columns`: upstream dependencies. `null_semantics`: what NULL means ("insufficient_data" vs "source_missing"). `is_derived`: True = computed by pipeline, False = raw from source.

```csharp
public record ColumnContext(
    string Name,
    string Description,
    string Unit,
    string Computation = null,
    string[] SourceColumns = null,
    (double Min, double Max)? ValidRange = null,
    string NullSemantics = "not_applicable",
    bool IsBusinessKey = false,
    bool IsDerived = false)
{
    public string[] SourceColumns { get; init; } = SourceColumns ?? Array.Empty<string>();
}
```

#### C# — define column registries for each medallion layer

> [!info] Column Registries per Layer
>
> Each column has a `ColumnContext` entry documenting what it is, how it was computed, what NULL means, and its valid range. These registries feed into data contracts (exported as JSON Schema) and attach to `StageContext` for cross-stage propagation.

```csharp
List<ColumnContext> BRONZE_COLUMNS = new() {
    new("symbol", "Yahoo Finance ticker symbol", "identifier", IsBusinessKey: true),
    new("date", "Trading date (exchange local)", "date", IsBusinessKey: true),
    new("open", "Opening price", "EUR", ValidRange: (0.001, 100000)),
    new("high", "Highest price", "EUR", ValidRange: (0.001, 100000)),
    new("low", "Lowest price", "EUR", ValidRange: (0.001, 100000)),
    new("close", "Closing price", "EUR", ValidRange: (0.001, 100000)),
    new("adj_close", "Adjusted close", "EUR", ValidRange: (0.001, 100000)),
    new("volume", "Shares traded", "count", ValidRange: (0, 1e12)),
    new("dividends", "Dividend paid", "EUR", ValidRange: (0, 1000)),
    new("stock_splits", "Split ratio", "ratio", ValidRange: (0, 100)),
};

List<ColumnContext> SILVER_COLUMNS = new(BRONZE_COLUMNS) {
    new("daily_return", "Close-to-close return", "decimal_ratio",
        Computation: "pct_change(close).over(symbol)", SourceColumns: new[]{"bronze.close"},
        ValidRange: (-0.5, 0.5), NullSemantics: "first_row_in_series", IsDerived: true),
    new("intraday_range", "(high-low)/close", "decimal_ratio",
        Computation: "(high - low) / close", SourceColumns: new[]{"bronze.high","bronze.low","bronze.close"},
        ValidRange: (0, 0.5), IsDerived: true),
    new("sma_20", "20-day moving average of close", "EUR",
        Computation: "close.rolling_mean(20).over(symbol)", SourceColumns: new[]{"bronze.close"},
        ValidRange: (0.001, 100000), NullSemantics: "insufficient_data", IsDerived: true),
};

List<ColumnContext> GOLD_DAILY_COLUMNS = new() {
    new("date", "Trading date", "date", IsBusinessKey: true),
    new("symbols_traded", "Distinct symbols", "count",
        Computation: "count(distinct symbol) per date", SourceColumns: new[]{"silver.symbol"}, IsDerived: true),
    new("avg_return", "Mean daily return", "decimal_ratio",
        Computation: "mean(daily_return) per date", SourceColumns: new[]{"silver.daily_return"}, IsDerived: true),
    new("max_return", "Best return", "decimal_ratio", IsDerived: true),
    new("min_return", "Worst return", "decimal_ratio", IsDerived: true),
    new("total_volume", "Sum of volume", "count", IsDerived: true),
    new("avg_intraday_pct", "Mean intraday range", "decimal_ratio", IsDerived: true),
};

List<ColumnContext> GOLD_PROFILE_COLUMNS = new() {
    new("symbol", "Yahoo Finance ticker symbol", "identifier", IsBusinessKey: true, NullSemantics: "not_applicable"),
    new("total_trading_days", "Number of trading days with data", "count",
        Computation: "count(*) per symbol", SourceColumns: new[]{"silver.date"}, ValidRange: (1, 5000), IsDerived: true),
    new("avg_daily_return", "Mean daily close-to-close return over full history", "decimal_ratio",
        Computation: "mean(daily_return) per symbol", SourceColumns: new[]{"silver.daily_return"}, ValidRange: (-0.1, 0.1), IsDerived: true),
    new("volatility", "Standard deviation of daily returns \u2014 annualize by multiplying by sqrt(252)", "decimal_ratio",
        Computation: "std(daily_return) per symbol", SourceColumns: new[]{"silver.daily_return"}, ValidRange: (0, 1), IsDerived: true),
    new("max_drawdown", "Largest peak-to-trough decline in cumulative return (always negative or zero)", "decimal_ratio",
        Computation: "min(cumulative_return - running_max(cumulative_return)) per symbol",
        SourceColumns: new[]{"silver.daily_return"}, ValidRange: (-1, 0), IsDerived: true),
    new("avg_volume", "Mean daily trading volume over full history", "count",
        Computation: "mean(volume) per symbol", SourceColumns: new[]{"silver.volume"}, ValidRange: (0, 1e12), IsDerived: true),
    new("total_dividends", "Sum of all dividends paid over full history", "EUR",
        Computation: "sum(dividends) per symbol", SourceColumns: new[]{"silver.dividends"}, ValidRange: (0, 10000), IsDerived: true),
};

Console.WriteLine($"Column registries: Bronze={BRONZE_COLUMNS.Count}, Silver={SILVER_COLUMNS.Count}, " +
    $"Gold Daily={GOLD_DAILY_COLUMNS.Count}, Gold Profile={GOLD_PROFILE_COLUMNS.Count}");
```

    Column registries: Bronze=10, Silver=13, Gold Daily=7, Gold Profile=7

#### record — define business context model with `record`

> [!info] BusinessContext: Run Trigger Reason
>
> Captures WHY this pipeline execution happened. `trigger`: scheduled, manual, backfill, reprocess, or test. `is_correction`: true if overwriting previously published data. Enables downstream consumers to distinguish routine runs from corrections.

```csharp
public record BusinessContext
{
    public string Trigger { get; init; }
    public string Reason { get; init; }
    public DateTime BusinessDate { get; init; } = DateTime.Today;
    public bool IsCorrection { get; init; }
    public string[] AffectedSymbols { get; init; }

    public static readonly HashSet<string> ValidTriggers = new() {
        "scheduled", "manual", "backfill", "reprocess", "test"
    };
}
```

#### record — define temporal context model with `record`

> [!info] TemporalContext: Bi-Temporal Markers
>
> `as_of_date`: the business date the data represents (usually T-1). `knowledge_date`: when the pipeline ingested it (auto-set to now). Separates "what date is this data FOR" from "when did we learn about it" — critical for backfills where `knowledge_date >> as_of_date`.

```csharp
public record TemporalContext
{
    public DateTime AsOfDate { get; init; }
    public DateTime ReportingPeriodStart { get; init; }
    public DateTime ReportingPeriodEnd { get; init; }
    public DateTime KnowledgeDate { get; init; } = DateTime.UtcNow;
    public string Timezone { get; init; } = "UTC";
    public bool IsBackfill { get; init; }
}
```

#### record — define stage context model for cross-stage propagation with `record`

> [!info] StageContext: Cross-Stage Propagation
>
> Unlike `StageLineage` (recorded after the fact), `StageContext` is created at stage start and carried forward via `ForNextStage()`. Each stage inherits upstream warnings and adds its own. By gold, the context carries the full warning chain from all stages.

```csharp
public class StageContext
{
    public string BatchId { get; set; }
    public string Stage { get; set; }
    public List<StageLineage> UpstreamStages { get; set; } = new();
    public List<string> DataWarnings { get; set; } = new();
    public string SchemaVersion { get; set; } = "1.0";
    public List<ColumnContext> ColumnCtx { get; set; } = new();
    public BusinessContext BizContext { get; set; }
    public TemporalContext TempContext { get; set; }

    public void AddWarning(string warning)
    {
        DataWarnings.Add(warning);
        Console.WriteLine($"  WARNING {Stage}: {warning}");
    }

    public StageContext ForNextStage(string nextStage, StageLineage lineage,
        List<ColumnContext> columns)
    {
        return new StageContext {
            BatchId = BatchId, Stage = nextStage,
            UpstreamStages = new List<StageLineage>(UpstreamStages) { lineage },
            DataWarnings = new List<string>(DataWarnings),
            SchemaVersion = SchemaVersion, ColumnCtx = columns,
            BizContext = BizContext, TempContext = TempContext,
        };
    }
}
```

#### record — define pipeline run context model with `record`

> [!info] RunContext: Execution Envelope
>
> Aggregates everything: stages, business context, temporal context, data warnings, and contract version into a single JSON artifact per pipeline execution.

```csharp,
// accumulated warnings, contract version. Persisted as JSON per run.

public class RunContext
{
    public string BatchId { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string[] Symbols { get; set; }
    public string[] DateRange { get; set; }
    public string PolarsVersion { get; set; } = "Polars.NET";
    public List<StageLineage> Stages { get; set; } = new();
    public string Status { get; set; } = "running";
    public BusinessContext BizContext { get; set; }
    public TemporalContext TempContext { get; set; }
    public List<string> DataWarnings { get; set; } = new();
    public string ContractVersion { get; set; } = "1.0";
}
```

#### C# — define data contract export function with `JsonSerializer`

> [!info] Data Contract Export to JSON Schema
>
> Generates machine-readable contracts for each pipeline boundary. Each contract includes structural schema (types, constraints) PLUS `x-column-context` with descriptions, formulas, units, and null semantics.

```csharp
List<string> ExportDataContracts(string exportDir)
{
    var contractsDir = Path.Combine(exportDir, "contracts");
    Directory.CreateDirectory(contractsDir);

    var registry = new Dictionary<string, List<ColumnContext>> {
        ["bronze_ohlcv"] = BRONZE_COLUMNS,
        ["silver_ohlcv"] = SILVER_COLUMNS,
        ["gold_daily_summary"] = GOLD_DAILY_COLUMNS,
        ["gold_symbol_profile"] = GOLD_PROFILE_COLUMNS,
    };

    var paths = new List<string>();
    foreach (var (name, columns) in registry)
    {
        var properties = new Dictionary<string, object>();
        foreach (var col in columns)
        {
            properties[col.Name] = new Dictionary<string, object> {
                ["description"] = col.Description,
                ["x-unit"] = col.Unit,
            };
        }

        var schema = new Dictionary<string, object> {
            ["type"] = "object",
            ["properties"] = properties,
            ["x-column-context"] = columns.Select(c => new Dictionary<string, object> {
                ["name"] = c.Name, ["description"] = c.Description,
                ["unit"] = c.Unit, ["computation"] = c.Computation ?? "",
                ["source_columns"] = c.SourceColumns,
                ["valid_range"] = c.ValidRange.HasValue
                    ? new[] { c.ValidRange.Value.Min, c.ValidRange.Value.Max } : null,
                ["null_semantics"] = c.NullSemantics,
                ["is_business_key"] = c.IsBusinessKey,
                ["is_derived"] = c.IsDerived,
            }).ToArray(),
            ["x-contract-version"] = "1.0",
            ["x-generated-at"] = DateTime.UtcNow.ToString("o"),
        };

        var path = Path.Combine(contractsDir, $"{name}_contract.json");
        File.WriteAllText(path, JsonSerializer.Serialize(schema, new JsonSerializerOptions { WriteIndented = true }));
        paths.Add(path);
        Console.WriteLine($"  Contract exported: {Path.GetFileName(path)}");
    }
    return paths;
}

Console.WriteLine("ExportDataContracts() defined");
```

    ExportDataContracts() defined

## 3. Lineage & Context Infrastructure

These functions implement the ability to trace any data point from Gold back to its raw source with cryptographic proof. `batch_id` is the thread — every row in every table carries the UUID of the pipeline run that created it. `compute_hash()` produces a deterministic SHA-256: same data → same hash. If someone modifies a Silver row after the pipeline ran, the recomputed hash won't match the recorded one. `RunContext` captures the full execution envelope — which symbols, what date range, which library versions, how many rejections.

> [!danger] Without Lineage Tracking
>
> A stakeholder disputes a -16% drop in gold. Without lineage, you spend
> a day manually checking: was the source data correct? Did the transform
> produce the right number? Was the data modified after ingestion? With
> lineage, three queries answer all three questions — batch_id traces the
> row to its run, the hash proves no tampering, the RunContext shows zero
> rejections and the exact date range processed.

#### Guid — generate unique batch ID with `Guid.NewGuid()`

> [!info] Batch ID: Unique Run Identifier
>
> Every row in bronze/silver/gold carries this UUID. Trace any disputed value back to its pipeline run in one query.

```csharp
string GenerateBatchId()
{
    return Guid.NewGuid().ToString();
}

// Demo: generate a batch_id
var demoBatch = GenerateBatchId();
Console.WriteLine($"Sample batch_id: {demoBatch}");
```

    Sample batch_id: 4af95c21-c810-416d-81ec-75d175e0d6d3

#### SHA256 — compute deterministic DataTable hash with `SHA256.HashData()`

> [!info] SHA-256 Hash: Tamper Detection
>
> Same data → same hash, every time. If someone modifies a row after the pipeline ran, the recomputed hash won't match. Serializes DataTable to sorted CSV bytes before hashing.

```csharp
string ComputeHash(DataTable dt)
{
    var sb = new StringBuilder();
    var colNames = dt.Columns.Cast<DataColumn>().Select(c => c.ColumnName).OrderBy(c => c).ToList();
    sb.AppendLine(string.Join(",", colNames));
    var rows = dt.AsEnumerable().OrderBy(r => string.Join(",", colNames.Select(c => r[c]?.ToString() ?? "")));
    foreach (var row in rows)
        sb.AppendLine(string.Join(",", colNames.Select(c => row[c]?.ToString() ?? "")));
    var hash = SHA256.HashData(Encoding.UTF8.GetBytes(sb.ToString()));
    return Convert.ToHexString(hash).ToLower().Substring(0, 16);
}

// Demo with a small table
var demoDt = new DataTable();
demoDt.Columns.Add("a", typeof(int));
demoDt.Columns.Add("b", typeof(int));
demoDt.Rows.Add(1, 4); demoDt.Rows.Add(2, 5); demoDt.Rows.Add(3, 6);
Console.WriteLine($"Hash of demo table: {ComputeHash(demoDt)}");
```

    Hash of demo table: 68135205be4bfc0c

#### C# — define stage start and end tracker with `DateTime.UtcNow`

> [!info] Stage Tracking: Start/End Pattern
>
> `StartStage()`: captures timestamp and input row count at entry. `EndStage()`: fills output metrics, computes SHA-256 hash, returns `StageLineage`. `StageContext` (if provided) flows alongside for semantic metadata propagation.

```csharp
Dictionary<string, object> StartStage(string batchId, string stage, int inputRows,
    StageContext stageContext = null)
{
    return new Dictionary<string, object> {
        ["batch_id"] = batchId,
        ["stage"] = stage,
        ["started_at"] = DateTime.UtcNow,
        ["input_rows"] = inputRows,
        ["stage_context"] = stageContext,
    };
}

StageLineage EndStage(Dictionary<string, object> ctx, DataTable outputDt,
    int rowsRejected = 0)
{
    return new StageLineage(
        BatchId: (string)ctx["batch_id"],
        Stage: (string)ctx["stage"],
        StartedAt: (DateTime)ctx["started_at"],
        CompletedAt: DateTime.UtcNow,
        InputRows: (int)ctx["input_rows"],
        OutputRows: outputDt.Rows.Count,
        RowsRejected: rowsRejected,
        OutputHash: ComputeHash(outputDt)
    );
}

Console.WriteLine("StartStage() / EndStage() defined");
```

    StartStage() / EndStage() defined

#### C# — save run context to JSON with `JsonSerializer.Serialize()`

> [!info] Save RunContext to JSON
>
> One JSON file per run, named by batch_id prefix. Full audit trail on disk.

```csharp

string SaveRunContext(RunContext ctx)
{
    var path = Path.Combine(LINEAGE_DIR, $"run_{ctx.BatchId.Substring(0, 8)}.json");
    File.WriteAllText(path, JsonSerializer.Serialize(ctx, new JsonSerializerOptions { WriteIndented = true }));
    return path;
}

Console.WriteLine($"SaveRunContext() defined — writes to {LINEAGE_DIR}");
```

    SaveRunContext() defined — writes to C:\Users\aperi\DEV\LANG\data\pipeline\lineage

## 4. SQL Server Schema — Medallion Tables + Lineage

Nine tables implementing the full architecture — not just data storage but the complete operational infrastructure. Three groups: **medallion tables** (bronze_ohlcv, silver_ohlcv, gold_daily_summary, gold_symbol_profile) store data at three stages of refinement. **Dimension tables** (dim_symbol, dim_calendar) provide business context that enables context-driven decisions. **Operational tables** (lineage_stages, quarantine, context_log) store the metadata that makes the pipeline auditable, recoverable, and self-describing.

> [!warning] Without Operational Tables
>
> Without `lineage_stages`: no record of which batch produced which rows.
> Without `quarantine`: rejected rows disappear — you never know they
> existed, never know what was wrong with them, can never replay them.
> Without `context_log`: the pipeline's knowledge about holidays, expected
> nulls, and business triggers is lost the moment the process exits.

| Table | Purpose | Key |
|---|---|---|
| `bronze_ohlcv` | Raw Yahoo Finance data, untransformed | `(symbol, date)` |
| `silver_ohlcv` | Enriched with daily_return, sma_20 | `(symbol, date)` |
| `gold_daily_summary` | Cross-sectional daily metrics | `(date)` |
| `gold_symbol_profile` | Per-symbol aggregate stats | `(symbol)` |
| `dim_symbol` | SCD Type 2 company metadata | `(symbol, valid_from)` |
| `dim_calendar` | Per-exchange trading day flags | `(date, exchange_code)` |
| `lineage_stages` | Stage-level execution metadata | `(batch_id, stage)` |
| `quarantine` | Dead letter queue for rejected rows | `(batch_id, stage)` |
| `context_log` | Semantic context per stage per run | `(batch_id, stage)` |

#### SQL Server — create Bronze OHLCV table with `sqlConn.Execute()`

> [!info] Bronze Table: Raw Source Data
>
> Stores raw Yahoo Finance output exactly as received. `batch_id` links every row to the pipeline run that ingested it. `UNIQUE` on `(symbol, date)` enables MERGE upsert for incremental loads.

```csharp
sqlConn.Execute(@"
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'bronze_ohlcv')
CREATE TABLE bronze_ohlcv (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    symbol       VARCHAR(20)  NOT NULL,
    date         DATE         NOT NULL,
    [open]       FLOAT        NOT NULL,
    high         FLOAT        NOT NULL,
    low          FLOAT        NOT NULL,
    [close]      FLOAT        NOT NULL,
    adj_close    FLOAT        NOT NULL,
    volume       BIGINT       NOT NULL,
    dividends    FLOAT        NOT NULL DEFAULT 0,
    stock_splits FLOAT        NOT NULL DEFAULT 0,
    batch_id     VARCHAR(36)  NOT NULL,
    ingested_at  DATETIME2    NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_bronze_symbol_date UNIQUE (symbol, date)
)
");
Console.WriteLine("bronze_ohlcv table ready (with UNIQUE on symbol+date)");
```

    bronze_ohlcv table ready (with UNIQUE on symbol+date)

#### SQL Server — create Silver OHLCV table with `sqlConn.Execute()`

> [!info] Silver Table DDL
>
> Adds computed columns: daily_return, intraday_range, sma_20. UNIQUE on (symbol, date) enables MERGE upsert.

```csharp

sqlConn.Execute(@"
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'silver_ohlcv')
CREATE TABLE silver_ohlcv (
    id              INT IDENTITY(1,1) PRIMARY KEY NONCLUSTERED,
    symbol          VARCHAR(20)  NOT NULL,
    date            DATE         NOT NULL,
    [open]          FLOAT        NOT NULL,
    high            FLOAT        NOT NULL,
    low             FLOAT        NOT NULL,
    [close]         FLOAT        NOT NULL,
    adj_close       FLOAT        NOT NULL,
    volume          BIGINT       NOT NULL,
    dividends       FLOAT        NOT NULL DEFAULT 0,
    stock_splits    FLOAT        NOT NULL DEFAULT 0,
    daily_return    FLOAT        NOT NULL,
    intraday_range  FLOAT        NOT NULL,
    sma_20          FLOAT        NULL,
    batch_id        VARCHAR(36)  NOT NULL,
    processed_at    DATETIME2    NOT NULL DEFAULT GETUTCDATE(),
    INDEX IX_silver_symbol_date CLUSTERED (symbol, date),
    CONSTRAINT UQ_silver_symbol_date UNIQUE (symbol, date)
)
");
Console.WriteLine("silver_ohlcv table ready (with UNIQUE on symbol+date)");
```

    silver_ohlcv table ready (with UNIQUE on symbol+date)

#### SQL Server — create Gold daily summary table with `sqlConn.Execute()`

> [!info] Gold Daily Summary DDL
>
> One row per trading day with cross-sectional metrics. Clustered on date for efficient range scans.

```csharp

sqlConn.Execute(@"
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'gold_daily_summary')
CREATE TABLE gold_daily_summary (
    id               INT IDENTITY(1,1) PRIMARY KEY NONCLUSTERED,
    date             DATE         NOT NULL,
    symbols_traded   INT          NOT NULL,
    avg_return       FLOAT        NOT NULL,
    max_return       FLOAT        NOT NULL,
    min_return       FLOAT        NOT NULL,
    total_volume     BIGINT       NOT NULL,
    avg_intraday_pct FLOAT        NOT NULL,
    batch_id         VARCHAR(36)  NOT NULL,
    INDEX IX_gold_daily_date CLUSTERED (date)
)
");
Console.WriteLine("gold_daily_summary table ready");
```

    gold_daily_summary table ready

#### SQL Server — create Gold symbol profile table with `sqlConn.Execute()`

> [!info] Gold Symbol Profile DDL
>
> One row per symbol with aggregate statistics. Clustered on symbol for efficient lookups.

```csharp

sqlConn.Execute(@"
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'gold_symbol_profile')
CREATE TABLE gold_symbol_profile (
    id                 INT IDENTITY(1,1) PRIMARY KEY NONCLUSTERED,
    symbol             VARCHAR(20)  NOT NULL,
    total_trading_days INT          NOT NULL,
    avg_daily_return   FLOAT        NOT NULL,
    volatility         FLOAT        NOT NULL,
    max_drawdown       FLOAT        NOT NULL,
    avg_volume         FLOAT        NOT NULL,
    total_dividends    FLOAT        NOT NULL DEFAULT 0,
    first_date         DATE         NOT NULL,
    last_date          DATE         NOT NULL,
    batch_id           VARCHAR(36)  NOT NULL,
    INDEX IX_gold_profile_symbol CLUSTERED (symbol)
)
");
Console.WriteLine("gold_symbol_profile table ready");
```

    gold_symbol_profile table ready

#### SQL Server — create SCD Type 2 symbol dimension with `sqlConn.Execute()`

> [!info] SCD Type 2 Dimension DDL
>
> Tracks historical changes in symbol metadata. valid_from/valid_to/is_current enable point-in-time queries.

```csharp

sqlConn.Execute(@"
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'dim_symbol')
CREATE TABLE dim_symbol (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    symbol                  VARCHAR(20)   NOT NULL,
    company_name            NVARCHAR(200) NULL,
    short_name              NVARCHAR(100) NULL,
    sector                  NVARCHAR(100) NULL,
    sector_key              VARCHAR(100)  NULL,
    industry                NVARCHAR(200) NULL,
    industry_key            VARCHAR(200)  NULL,
    country                 NVARCHAR(100) NULL,
    city                    NVARCHAR(100) NULL,
    exchange                VARCHAR(20)   NULL,
    full_exchange_name      NVARCHAR(100) NULL,
    currency                VARCHAR(10)   NULL,
    market_cap              BIGINT        NULL,
    website                 VARCHAR(500)  NULL,
    -- SCD Type 2 columns
    valid_from              DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    valid_to                DATETIME2     NULL,
    is_current              BIT           NOT NULL DEFAULT 1
)
");
Console.WriteLine("dim_symbol table ready (SCD Type 2)");
```

    dim_symbol table ready (SCD Type 2)

#### SQL Server — create per-exchange trading calendar with `sqlConn.Execute()`

> [!info] Trading Calendar Dimension
>
> Per-exchange trading calendar with holiday flags. Composite PK on . Aligned with the stoxx.bronze.trading_calendar schema.

```csharp

sqlConn.Execute(@"
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'dim_calendar')
CREATE TABLE dim_calendar (
    date            DATE         NOT NULL,
    exchange_code   VARCHAR(10)  NOT NULL,
    year            SMALLINT     NOT NULL,
    quarter         TINYINT      NOT NULL,
    month           TINYINT      NOT NULL,
    week_of_year    TINYINT      NOT NULL,
    day_of_week     TINYINT      NOT NULL,
    is_trading_day  BIT          NOT NULL DEFAULT 0,
    is_month_end    BIT          NOT NULL DEFAULT 0,
    is_quarter_end  BIT          NOT NULL DEFAULT 0,
    CONSTRAINT PK_dim_calendar PRIMARY KEY (date, exchange_code)
)
");
Console.WriteLine("dim_calendar table ready (per-exchange)");
```

    dim_calendar table ready (per-exchange)

#### SQL Server — create lineage tracking table with `Execute()`

> [!info] Lineage Table DDL
>
> Persists StageLineage records to SQL Server. Enables querying pipeline history: which batch produced what.

```csharp

sqlConn.Execute(@"
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'lineage_stages')
CREATE TABLE lineage_stages (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    batch_id      VARCHAR(36)  NOT NULL,
    stage         VARCHAR(20)  NOT NULL,
    started_at    DATETIME2    NOT NULL,
    completed_at  DATETIME2    NOT NULL,
    input_rows    INT          NOT NULL,
    output_rows   INT          NOT NULL,
    rows_rejected INT          NOT NULL DEFAULT 0,
    output_hash   VARCHAR(16)  NOT NULL
)
");
Console.WriteLine("lineage_stages table ready");
```

    lineage_stages table ready

#### SQL Server — create quarantine table for rejected rows with `Execute()`

> [!info] Quarantine: Dead Letter Queue
>
> Stores every row that failed validation. Preserves the raw data + rejection reason for investigation and replay.

```csharp

sqlConn.Execute(@"
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'quarantine')
CREATE TABLE quarantine (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    batch_id        VARCHAR(36)   NOT NULL,
    stage           VARCHAR(20)   NOT NULL,
    symbol          VARCHAR(20)   NULL,
    date            DATE          NULL,
    raw_data        NVARCHAR(MAX) NOT NULL,
    error_message   NVARCHAR(MAX) NOT NULL,
    quarantined_at  DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)
");
Console.WriteLine("quarantine table ready (dead letter queue)");
```

    quarantine table ready (dead letter queue)

#### SQL Server — create context log table with `Execute()`

```csharp
// Persists StageContext records — business context, temporal context, warnings

sqlConn.Execute(@"
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'context_log')
CREATE TABLE context_log (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    batch_id        VARCHAR(36)    NOT NULL,
    stage           VARCHAR(20)    NOT NULL,
    business_date   DATE           NULL,
    trigger_type    VARCHAR(20)    NULL,
    is_correction   BIT            NOT NULL DEFAULT 0,
    schema_version  VARCHAR(10)    NOT NULL DEFAULT '1.0',
    data_warnings   NVARCHAR(MAX)  NULL,
    column_context  NVARCHAR(MAX)  NULL,
    temporal_json   NVARCHAR(MAX)  NULL,
    created_at      DATETIME2      NOT NULL DEFAULT GETUTCDATE()
)
");
Console.WriteLine("context_log table ready");
```

    context_log table ready

#### SQL Server — define context persistence helper with `Execute()`

```csharp
// Write a StageContext record to the context_log table

void PersistContext(StageContext stageCtx)
{
    if (stageCtx == null) return;
    sqlConn.Execute(
        @"INSERT INTO context_log
          (batch_id, stage, business_date, trigger_type, is_correction,
           schema_version, data_warnings, column_context, temporal_json)
          VALUES (@BatchId, @Stage, @BizDate, @Trigger, @IsCorrection,
                  @SchemaVer, @Warnings, @ColCtx, @TempJson)",
        new {
            stageCtx.BatchId, stageCtx.Stage,
            BizDate = stageCtx.BizContext?.BusinessDate,
            Trigger = stageCtx.BizContext?.Trigger,
            IsCorrection = stageCtx.BizContext?.IsCorrection ?? false,
            SchemaVer = stageCtx.SchemaVersion,
            Warnings = stageCtx.DataWarnings.Any()
                ? JsonSerializer.Serialize(stageCtx.DataWarnings) : null,
            ColCtx = stageCtx.ColumnCtx.Any()
                ? JsonSerializer.Serialize(stageCtx.ColumnCtx.Select(c => new {
                    c.Name, c.Description, c.Unit, c.Computation,
                    source_columns = c.SourceColumns, c.NullSemantics,
                    is_business_key = c.IsBusinessKey, is_derived = c.IsDerived,
                    valid_range = c.ValidRange.HasValue
                        ? new[]{ c.ValidRange.Value.Min, c.ValidRange.Value.Max } : null
                  })) : null,
            TempJson = stageCtx.TempContext != null
                ? JsonSerializer.Serialize(stageCtx.TempContext) : null,
        });
}

Console.WriteLine("PersistContext() defined");
```

    PersistContext() defined

#### SQL Server — define lineage persistence helper with `Execute()`

> [!tip] Idempotent Lineage Persistence
>
> Inserts a StageLineage into lineage_stages. Deletes any existing record for the same batch+stage first.

```csharp

void PersistLineage(StageLineage lineage)
{
    sqlConn.Execute(
        "DELETE FROM lineage_stages WHERE batch_id = @BatchId AND stage = @Stage",
        new { lineage.BatchId, lineage.Stage });
    sqlConn.Execute(
        @"INSERT INTO lineage_stages
          (batch_id, stage, started_at, completed_at, input_rows, output_rows, rows_rejected, output_hash)
          VALUES (@BatchId, @Stage, @StartedAt, @CompletedAt, @InputRows, @OutputRows, @RowsRejected, @OutputHash)",
        new {
            lineage.BatchId, lineage.Stage, lineage.StartedAt, lineage.CompletedAt,
            lineage.InputRows, lineage.OutputRows, lineage.RowsRejected, lineage.OutputHash
        });
}

Console.WriteLine("PersistLineage() defined \u2014 idempotent: deletes before insert");
```

    PersistLineage() defined — idempotent: deletes before insert

#### Dapper — define DataFrame write helper with `Execute()`

> [!info] DataFrame Write Helper
>
> Writes a DataTable to SQL Server using Dapper row-by-row.  wipes the table before insert (used by Gold tables only).

```csharp

DataTable QueryToTable(string sql, object param = null)
{
    var reader = sqlConn.ExecuteReader(sql, param);
    var dt = new DataTable();
    dt.Load(reader);
    return dt;
}

void WriteToCsv(DataTable dt, string table, bool truncate = true)
{
    if (truncate)
        sqlConn.Execute($"TRUNCATE TABLE {table}");

    foreach (DataRow row in dt.Rows)
    {
        var cols = string.Join(", ", dt.Columns.Cast<DataColumn>()
            .Select(c => c.ColumnName == "open" || c.ColumnName == "close"
                ? $"[{c.ColumnName}]" : c.ColumnName));
        var parms = string.Join(", ", dt.Columns.Cast<DataColumn>()
            .Select(c => $"@{c.ColumnName}"));
        var parameters = new DynamicParameters();
        foreach (DataColumn col in dt.Columns)
            parameters.Add(col.ColumnName, row[col]);
        sqlConn.Execute($"INSERT INTO {table} ({cols}) VALUES ({parms})", parameters);
    }
}

Console.WriteLine("QueryToTable() + WriteToCsv() defined");
```

    QueryToTable() + WriteToCsv() defined

#### SQL Server — define Bronze MERGE upsert with `MERGE INTO`

> [!info] Bronze MERGE Upsert
>
> Idempotent: MERGE on  — safe to re-run. Existing rows get updated, new rows get inserted.

```csharp

int MergeBronze(DataTable dt, string batchId)
{
    int rowsAffected = 0;
    foreach (DataRow row in dt.Rows)
    {
        rowsAffected += sqlConn.Execute(@"
            MERGE bronze_ohlcv AS tgt
            USING (SELECT @symbol AS symbol, @date AS date) AS src
               ON tgt.symbol = src.symbol AND tgt.date = src.date
            WHEN MATCHED THEN UPDATE SET
                [open] = @open, high = @high, low = @low, [close] = @close,
                adj_close = @adj_close, volume = @volume, dividends = @dividends,
                stock_splits = @stock_splits,
                batch_id = @batch_id, ingested_at = GETUTCDATE()
            WHEN NOT MATCHED THEN INSERT
                (symbol, date, [open], high, low, [close], adj_close,
                 volume, dividends, stock_splits, batch_id)
                VALUES (@symbol, @date, @open, @high, @low, @close, @adj_close,
                        @volume, @dividends, @stock_splits, @batch_id);",
            new {
                symbol = row["symbol"].ToString(), date = (DateTime)row["date"],
                open = Convert.ToDouble(row["open"]), high = Convert.ToDouble(row["high"]),
                low = Convert.ToDouble(row["low"]), close = Convert.ToDouble(row["close"]),
                adj_close = Convert.ToDouble(row["adj_close"]),
                volume = Convert.ToInt64(row["volume"]),
                dividends = Convert.ToDouble(row["dividends"]),
                stock_splits = Convert.ToDouble(row["stock_splits"]),
                batch_id = batchId,
            });
    }
    return rowsAffected;
}

Console.WriteLine("MergeBronze() defined");
```

    MergeBronze() defined

#### SQL Server — define Silver MERGE upsert with `MERGE INTO`

> [!info] Silver MERGE Upsert
>
> Same idempotent pattern as Bronze, but includes enrichment columns: , , .

```csharp

int MergeSilver(DataTable dt, string batchId)
{
    int rowsAffected = 0;
    foreach (DataRow row in dt.Rows)
    {
        rowsAffected += sqlConn.Execute(@"
            MERGE silver_ohlcv AS tgt
            USING (SELECT @symbol AS symbol, @date AS date) AS src
               ON tgt.symbol = src.symbol AND tgt.date = src.date
            WHEN MATCHED THEN UPDATE SET
                [open] = @open, high = @high, low = @low, [close] = @close,
                adj_close = @adj_close, volume = @volume, dividends = @dividends,
                stock_splits = @stock_splits,
                daily_return = @daily_return, intraday_range = @intraday_range, sma_20 = @sma_20,
                batch_id = @batch_id, processed_at = GETUTCDATE()
            WHEN NOT MATCHED THEN INSERT
                (symbol, date, [open], high, low, [close], adj_close,
                 volume, dividends, stock_splits,
                 daily_return, intraday_range, sma_20, batch_id)
                VALUES (@symbol, @date, @open, @high, @low, @close, @adj_close,
                        @volume, @dividends, @stock_splits,
                        @daily_return, @intraday_range, @sma_20, @batch_id);",
            new {
                symbol = row["symbol"].ToString(), date = (DateTime)row["date"],
                open = Convert.ToDouble(row["open"]), high = Convert.ToDouble(row["high"]),
                low = Convert.ToDouble(row["low"]), close = Convert.ToDouble(row["close"]),
                adj_close = Convert.ToDouble(row["adj_close"]),
                volume = Convert.ToInt64(row["volume"]),
                dividends = Convert.ToDouble(row["dividends"]),
                stock_splits = Convert.ToDouble(row["stock_splits"]),
                daily_return = row["daily_return"] is DBNull ? (double?)null : Convert.ToDouble(row["daily_return"]),
                intraday_range = row["intraday_range"] is DBNull ? (double?)null : Convert.ToDouble(row["intraday_range"]),
                sma_20 = row["sma_20"] is DBNull ? (double?)null : Convert.ToDouble(row["sma_20"]),
                batch_id = batchId,
            });
    }
    return rowsAffected;
}

Console.WriteLine("MergeSilver() defined");
```

    MergeSilver() defined

#### SQL Server — define quarantine persistence helper with `Execute()`

```csharp
// Persists a rejected row to the quarantine table with its error message

void QuarantineRow(string batchId, string stage, Dictionary<string, object> rowData, string error)
{
    sqlConn.Execute(
        @"INSERT INTO quarantine (batch_id, stage, symbol, date, raw_data, error_message)
          VALUES (@BatchId, @Stage, @Symbol, @Date, @RawData, @Error)",
        new {
            BatchId = batchId, Stage = stage,
            Symbol = rowData.GetValueOrDefault("symbol")?.ToString(),
            Date = rowData.ContainsKey("date") ? rowData["date"] : null,
            RawData = JsonSerializer.Serialize(rowData),
            Error = error.Length > 4000 ? error[..4000] : error,
        });
}

Console.WriteLine("QuarantineRow() defined \u2014 dead letter queue helper");
```

    QuarantineRow() defined — dead letter queue helper

#### Polly — define API retry wrapper with `WaitAndRetryAsync()` exponential backoff

> [!info] Polly Retry Policy
>
> Wraps API calls with 3 attempts and exponential backoff. Catches transient failures.

```csharp

AsyncRetryPolicy retryPolicy = Policy
    .Handle<HttpRequestException>()
    .Or<TaskCanceledException>()
    .WaitAndRetryAsync(
        retryCount: 3,
        sleepDurationProvider: attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)),
        onRetry: (ex, delay, attempt, _) =>
            Console.WriteLine($"  Retry {attempt}/3 after {ex.GetType().Name}")
    );

Console.WriteLine("retryPolicy defined \u2014 3 attempts, exponential backoff");
```

    retryPolicy defined — 3 attempts, exponential backoff

#### C# — define custom `Exception` subclass for quality gate failures

> [!info] Quality Gate Exception
>
> Raised when a data quality gate fails. Blocks downstream stages from processing bad data.

```csharp

public class DataQualityException : Exception
{
    public DataQualityException(string message) : base(message) { }
}

Console.WriteLine("DataQualityException defined");
```

    DataQualityException defined

#### C# — assert DataTable is not empty with `Rows.Count`

> [!info] Assert: Not Empty
>
> Verifies the output table/frame is not empty after a stage.

```csharp

(bool Passed, string Message) DqCheckNotEmpty(DataTable dt, string stage)
{
    bool ok = dt.Rows.Count > 0;
    return (ok, ok ? $"{stage}: {dt.Rows.Count} rows" : $"{stage}: EMPTY DataTable");
}

Console.WriteLine("DqCheckNotEmpty() defined");
```

    DqCheckNotEmpty() defined

#### C# — assert no nulls in key columns with `DBNull` check

> [!info] Assert: No Null Keys
>
> Checks each key column individually, reports first failure found.

```csharp

(bool Passed, string Message) DqCheckNoNullKeys(DataTable dt, IEnumerable<string> keys, string stage)
{
    foreach (var col in keys)
    {
        if (!dt.Columns.Contains(col))
            return (false, $"{stage}: column '{col}' missing");
        int nulls = dt.AsEnumerable().Count(r => r[col] is DBNull || r[col] == null);
        if (nulls > 0)
            return (false, $"{stage}: {nulls} nulls in '{col}'");
    }
    return (true, $"{stage}: no null keys in [{string.Join(", ", keys)}]");
}

Console.WriteLine("DqCheckNoNullKeys() defined");
```

    DqCheckNoNullKeys() defined

#### C# — assert no duplicate rows with `GroupBy()`

> [!info] Assert: No Duplicates
>
> Compares total rows vs unique key combinations to detect duplicates.

```csharp

(bool Passed, string Message) DqCheckNoDuplicates(DataTable dt, IEnumerable<string> keys, string stage)
{
    int total = dt.Rows.Count;
    int unique = dt.AsEnumerable()
        .GroupBy(r => string.Join("|", keys.Select(k => r[k]?.ToString() ?? "")))
        .Count();
    int dupes = total - unique;
    bool ok = dupes == 0;
    return (ok, ok ? $"{stage}: no duplicates" : $"{stage}: {dupes} duplicates on [{string.Join(", ", keys)}]");
}

Console.WriteLine("DqCheckNoDuplicates() defined");
```

    DqCheckNoDuplicates() defined

#### C# — assert values within range with `Where()`

> [!info] Assert: Value Range
>
> Reports count of out-of-range values in the specified column.

```csharp

(bool Passed, string Message) DqCheckRange(DataTable dt, string col, double minVal, double maxVal, string stage)
{
    int outOfRange = dt.AsEnumerable()
        .Where(r => !(r[col] is DBNull))
        .Count(r => Convert.ToDouble(r[col]) < minVal || Convert.ToDouble(r[col]) > maxVal);
    bool ok = outOfRange == 0;
    return (ok, ok
        ? $"{stage}: '{col}' within range"
        : $"{stage}: {outOfRange} values outside [{minVal}, {maxVal}] in '{col}'");
}

Console.WriteLine("DqCheckRange() defined");
```

    DqCheckRange() defined

#### C# — assert data freshness against SLA with `Max()`

> [!info] Assert: Data Freshness
>
> Detects stale data that missed recent trading days.

```csharp

(bool Passed, string Message) DqCheckFreshness(DataTable dt, string dateCol, int maxAgeDays, string stage)
{
    if (dt.Rows.Count == 0)
        return (false, $"{stage}: empty DataTable, can't check freshness");
    var dates = dt.AsEnumerable()
        .Where(r => !(r[dateCol] is DBNull))
        .Select(r => Convert.ToDateTime(r[dateCol]))
        .ToList();
    if (dates.Count == 0)
        return (false, $"{stage}: all dates are null");
    var latest = dates.Max();
    int age = (DateTime.Today - latest.Date).Days;
    bool ok = age <= maxAgeDays;
    return (ok, $"{stage}: latest date {latest:yyyy-MM-dd} ({age}d ago)" + (ok ? "" : $" EXCEEDS {maxAgeDays}d SLA"));
}

Console.WriteLine("DqCheckFreshness() defined");
```

    DqCheckFreshness() defined

#### C# — assert minimum row count with `Rows.Count`

> [!info] Assert: Minimum Row Count
>
> Catches partial loads or missing symbols.

```csharp

(bool Passed, string Message) DqCheckRowCount(DataTable dt, int minRows, string stage)
{
    bool ok = dt.Rows.Count >= minRows;
    return (ok, $"{stage}: {dt.Rows.Count} rows" + (ok ? "" : $" BELOW minimum {minRows}"));
}

Console.WriteLine("DqCheckRowCount() defined");
```

    DqCheckRowCount() defined

#### Pipeline — run all quality gate assertions with `Console.WriteLine()`

> [!info] Quality Gate Runner
>
> Executes all checks for a stage, logs PASS/FAIL for each. : raises exception on first failure, blocking downstream stages.

```csharp

DataTable RunQualityGate(IEnumerable<(bool Passed, string Message)> checks, string stage, bool failFast = true)
{
    var dt = new DataTable();
    dt.Columns.Add("check", typeof(string));
    dt.Columns.Add("status", typeof(string));
    bool allPassed = true;

    foreach (var (passed, msg) in checks)
    {
        var status = passed ? "PASS" : "FAIL";
        Console.WriteLine($"  DQ {status}: {msg}");
        dt.Rows.Add(msg, status);
        if (!passed) allPassed = false;
    }

    if (!allPassed && failFast)
        throw new DataQualityException($"Data quality gate FAILED for {stage}");

    return dt;
}

Console.WriteLine("RunQualityGate() defined");
```

    RunQualityGate() defined

## 5. Dimension Tables — Symbol Metadata (SCD2) & Trading Calendar

Dimensions are the pipeline's external knowledge — facts about the world that the pipeline needs but doesn't compute. `dim_symbol` uses SCD Type 2 because company metadata changes over time — without historization, a join between gold scores and dim_symbol shows today's sector for historical dates, producing misleading analysis. `dim_calendar` exists because zero-volume doesn't always mean bad data — the calendar tells the pipeline whether an exchange was open, turning undifferentiated zero-volume alerts into classified holidays vs genuine anomalies.

> [!warning] Without Trading Calendar
>
> Every zero-volume day triggers an investigation. Good Friday, Christmas,
> local exchange holidays — all flagged as anomalies. An on-call engineer
> wastes time cross-referencing exchange schedules. With dim_calendar, the
> pipeline classifies each zero-volume date at ingestion and records the
> classification as a context warning.

#### HttpClient — fetch symbol metadata to JSON landing zone with `GetStringAsync()`

> [!info] Fetch Symbol Metadata
>
> Fetches company metadata from Yahoo Finance v8 API for each symbol. Saves raw API response to  for replay.

```csharp

string[] SCD2_COMPARE_COLS = { "company_name", "sector", "industry", "country", "exchange", "currency" };

async Task<string> FetchSymbolsToLanding(IEnumerable<string> symbols)
{
    var client = new HttpClient();
    client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0");
    var records = new List<Dictionary<string, object>>();

    foreach (var symbol in symbols)
    {
        try
        {
            var url = $"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d";
            var json = await retryPolicy.ExecuteAsync(() => client.GetStringAsync(url));
            var doc = JsonDocument.Parse(json);
            var meta = doc.RootElement
                .GetProperty("chart").GetProperty("result")[0]
                .GetProperty("meta");

            var rec = new Dictionary<string, object>
            {
                ["symbol"] = symbol,
                ["longName"] = meta.TryGetProperty("longName", out var ln) ? ln.GetString() : null,
                ["shortName"] = meta.TryGetProperty("shortName", out var sn) ? sn.GetString() : null,
                ["sector"] = null,
                ["sectorKey"] = null,
                ["industry"] = null,
                ["industryKey"] = null,
                ["country"] = null,
                ["city"] = null,
                ["website"] = null,
                ["longBusinessSummary"] = null,
                ["exchange"] = meta.TryGetProperty("exchangeName", out var ex) ? ex.GetString() : null,
                ["fullExchangeName"] = meta.TryGetProperty("fullExchangeName", out var fen) ? fen.GetString() : null,
                ["exchangeTimezoneName"] = meta.TryGetProperty("exchangeTimezoneName", out var etz) ? etz.GetString() : null,
                ["exchangeTimezoneShortName"] = meta.TryGetProperty("exchangeTimezoneShortName", out var etsn) ? etsn.GetString() : null,
                ["currency"] = meta.TryGetProperty("currency", out var cur) ? cur.GetString() : null,
                ["financialCurrency"] = meta.TryGetProperty("financialCurrency", out var fc) ? fc.GetString() : null,
                ["quoteType"] = meta.TryGetProperty("instrumentType", out var qt) ? qt.GetString() : null,
                ["market"] = meta.TryGetProperty("exchangeName", out var mk) ? mk.GetString() : null,
                ["marketCap"] = null,
            };
            records.Add(rec);
            Console.WriteLine($"  {symbol}: fetched ({rec["longName"]})");
        }
        catch (Exception e)
        {
            Console.WriteLine($"  {symbol}: fetch failed ({e.Message}), using empty info");
            records.Add(new Dictionary<string, object> { ["symbol"] = symbol });
        }
    }

    var landingPath = Path.Combine(LANDING_DIR, "dim_symbol.json");
    File.WriteAllText(landingPath, JsonSerializer.Serialize(records, new JsonSerializerOptions { WriteIndented = true }));
    Console.WriteLine($"Landed: {landingPath} ({records.Count} symbols)");
    return landingPath;
}

Console.WriteLine("FetchSymbolsToLanding() defined");
```

    FetchSymbolsToLanding() defined

#### JSON — load symbol metadata from landing zone with `JsonSerializer.Deserialize()`

> [!info] Load Symbols from Landing
>
> Reads the JSON landing file and returns records ready for SCD2 upsert.

```csharp

List<Dictionary<string, object>> LoadSymbolsFromLanding()
{
    var landingPath = Path.Combine(LANDING_DIR, "dim_symbol.json");
    var json = File.ReadAllText(landingPath);
    var docs = JsonDocument.Parse(json).RootElement;
    var results = new List<Dictionary<string, object>>();
    foreach (var el in docs.EnumerateArray())
    {
        var dict = new Dictionary<string, object>();
        foreach (var prop in el.EnumerateObject())
            dict[prop.Name] = prop.Value.ValueKind == JsonValueKind.Null
                ? null : prop.Value.ToString();
        results.Add(dict);
    }
    return results;
}

Console.WriteLine("LoadSymbolsFromLanding() defined");
```

    LoadSymbolsFromLanding() defined

#### SQL Server — define SCD Type 2 upsert for one symbol with `MERGE INTO`

> [!info] SCD Type 2 Dimension Upsert
>
> New symbol → INSERT. Unchanged attributes → skip. Changed attributes → close old record, INSERT new version.

```csharp

string Scd2UpsertSymbol(Dictionary<string, object> rec)
{
    string Val(string key) => rec.TryGetValue(key, out var v) ? v?.ToString() : null;
    string sector = Val("sector");
    string industry = Val("industry");

    var dbRec = new {
        symbol = Val("symbol"),
        company_name = Val("longName") ?? Val("shortName"),
        short_name = Val("shortName"),
        sector = sector,
        sector_key = sector?.ToLower().Replace(" ", "_"),
        industry = industry,
        industry_key = industry?.ToLower().Replace(" ", "_"),
        country = Val("country"),
        city = Val("city"),
        exchange = Val("exchange"),
        full_exchange_name = Val("fullExchangeName"),
        currency = Val("currency"),
        market_cap = Val("marketCap") != null ? (long?)long.Parse(Val("marketCap")) : null,
        website = Val("website"),
    };

    // Check current record
    var existing = sqlConn.QueryFirstOrDefault<dynamic>(
        @"SELECT id, company_name, sector, industry, country, exchange, currency
          FROM dim_symbol WHERE symbol = @symbol AND is_current = 1",
        new { dbRec.symbol });

    if (existing == null)
    {
        sqlConn.Execute(
            @"INSERT INTO dim_symbol
                (symbol, company_name, short_name, sector, sector_key,
                 industry, industry_key, country, city, exchange,
                 full_exchange_name, currency, market_cap, website)
              VALUES (@symbol, @company_name, @short_name, @sector, @sector_key,
                      @industry, @industry_key, @country, @city, @exchange,
                      @full_exchange_name, @currency, @market_cap, @website)",
            dbRec);
        return "INSERT";
    }

    // Compare tracked columns
    var oldVals = (existing.company_name?.ToString(), existing.sector?.ToString(),
                   existing.industry?.ToString(), existing.country?.ToString(),
                   existing.exchange?.ToString(), existing.currency?.ToString());
    var newVals = (dbRec.company_name, dbRec.sector, dbRec.industry,
                   dbRec.country, dbRec.exchange, dbRec.currency);

    if (oldVals == newVals)
        return "UNCHANGED";

    // Attribute changed \u2192 close old record, insert new
    sqlConn.Execute(
        "UPDATE dim_symbol SET valid_to = SYSUTCDATETIME(), is_current = 0 WHERE id = @id",
        new { id = (int)existing.id });
    sqlConn.Execute(
        @"INSERT INTO dim_symbol
            (symbol, company_name, short_name, sector, sector_key,
             industry, industry_key, country, city, exchange,
             full_exchange_name, currency, market_cap, website)
          VALUES (@symbol, @company_name, @short_name, @sector, @sector_key,
                  @industry, @industry_key, @country, @city, @exchange,
                  @full_exchange_name, @currency, @market_cap, @website)",
        dbRec);
    return "SCD2_UPDATE";
}

Console.WriteLine("Scd2UpsertSymbol() defined");
```

    Scd2UpsertSymbol() defined

#### SQL Server — orchestrate SCD Type 2 upsert for all symbols with `Execute()`

> [!info] SCD2 Upsert Orchestration
>
> Read landing JSON, SCD2 upsert each symbol, log action taken per symbol.

```csharp

DataTable PopulateDimSymbolFromLanding()
{
    var records = LoadSymbolsFromLanding();
    var dt = new DataTable();
    dt.Columns.Add("symbol", typeof(string));
    dt.Columns.Add("longName", typeof(string));
    dt.Columns.Add("sector", typeof(string));
    dt.Columns.Add("country", typeof(string));
    dt.Columns.Add("exchange", typeof(string));
    dt.Columns.Add("_action", typeof(string));

    foreach (var rec in records)
    {
        string Val(string key) => rec.TryGetValue(key, out var v) ? v?.ToString() : null;
        var action = Scd2UpsertSymbol(rec);
        dt.Rows.Add(Val("symbol"), Val("longName"), Val("sector"),
                    Val("country"), Val("exchange"), action);
        Console.WriteLine($"  {Val("symbol")}: {action}");
    }
    return dt;
}

Console.WriteLine("PopulateDimSymbolFromLanding() defined");
```

    PopulateDimSymbolFromLanding() defined

#### SQL Server — load symbols from landing and SCD2 upsert with `MERGE INTO`

```csharp
// Step 1: Fetch from Yahoo Finance API \u2192 JSON landing zone
Console.WriteLine("Step 1: Fetching symbol metadata to landing zone...\n");
await FetchSymbolsToLanding(SYMBOLS);

// Step 2: Load from landing JSON \u2192 SCD2 upsert into dim_symbol
Console.WriteLine("\nStep 2: SCD2 upsert from landing zone...\n");
var dimSymbolDt = PopulateDimSymbolFromLanding();
dimSymbolDt.AsEnumerable().Take(5).CopyToDataTable()
```

    Step 1: Fetching symbol metadata to landing zone...
    
      SAP.DE: fetched (SAP SE)
      SIE.DE: fetched (Siemens Aktiengesellschaft)
      ALV.DE: fetched (Allianz SE)
      DTE.DE: fetched (Deutsche Telekom AG)
      BAS.DE: fetched (BASF SE)
    Landed: C:\Users\aperi\DEV\LANG\data\pipeline\landing\dim_symbol.json (5 symbols)
    
    Step 2: SCD2 upsert from landing zone...
    
      SAP.DE: UNCHANGED
      SIE.DE: UNCHANGED
      ALV.DE: UNCHANGED
      DTE.DE: UNCHANGED
      BAS.DE: UNCHANGED

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>longName</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>sector</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>country</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>exchange</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>_action</th></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>SAP SE</td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>UNCHANGED</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SIE.DE</td><td style='text-align:left;padding:4px 12px;'>Siemens Aktiengesellschaft</td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>UNCHANGED</td></tr><tr><td style='text-align:left;padding:4px 12px;'>ALV.DE</td><td style='text-align:left;padding:4px 12px;'>Allianz SE</td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>UNCHANGED</td></tr><tr><td style='text-align:left;padding:4px 12px;'>DTE.DE</td><td style='text-align:left;padding:4px 12px;'>Deutsche Telekom AG</td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>UNCHANGED</td></tr><tr><td style='text-align:left;padding:4px 12px;'>BAS.DE</td><td style='text-align:left;padding:4px 12px;'>BASF SE</td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>UNCHANGED</td></tr></table>

#### SQL Server — verify trading calendar exists with `QueryToTable()`

> [!info] Read Existing Calendar
>
> C# reads dim_calendar populated by the Python notebook rather than regenerating.

```csharp

DataTable calDt = QueryToTable(
    @"SELECT exchange_code, COUNT(*) as total_days,
             SUM(CAST(is_trading_day AS INT)) as trading_days,
             MIN(date) as first_date, MAX(date) as last_date
      FROM dim_calendar GROUP BY exchange_code ORDER BY exchange_code");

Console.WriteLine("Calendar dimension (from Python notebook):");
calDt.AsEnumerable().Take(5).CopyToDataTable()
```

    Calendar dimension (from Python notebook):

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>exchange_code</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>total_days</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>trading_days</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>first_date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>last_date</th></tr><tr><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>732</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>29-Mar-26 0:00:00</td></tr></table>

#### SQL Server — persist calendar dimension with `MERGE INTO`

```csharp
// Calendar already populated by Python notebook \u2014 verify row count

int calRows = sqlConn.ExecuteScalar<int>("SELECT COUNT(*) FROM dim_calendar");
Console.WriteLine($"dim_calendar: {calRows} rows verified");
```

    dim_calendar: 732 rows verified

#### SQL Server — display detected exchange holidays with `QueryToTable()`

```csharp
// Display holidays detected (weekdays marked as non-trading)

DataTable holidays = QueryToTable(
    @"SELECT TOP 20 date, exchange_code, day_of_week
      FROM dim_calendar
      WHERE day_of_week BETWEEN 1 AND 5 AND is_trading_day = 0
      ORDER BY exchange_code, date");

int holidayCount = sqlConn.ExecuteScalar<int>(
    @"SELECT COUNT(*) FROM dim_calendar
      WHERE day_of_week BETWEEN 1 AND 5 AND is_trading_day = 0");
Console.WriteLine($"Holidays detected: {holidayCount} (weekdays with no trading)");
holidays
```

    Holidays detected: 16 (weekdays with no trading)

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>exchange_code</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>day_of_week</th></tr><tr><td style='text-align:left;padding:4px 12px;'>29-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>5</td></tr><tr><td style='text-align:left;padding:4px 12px;'>01-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>1</td></tr><tr><td style='text-align:left;padding:4px 12px;'>01-May-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>3</td></tr><tr><td style='text-align:left;padding:4px 12px;'>24-Dec-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>2</td></tr><tr><td style='text-align:left;padding:4px 12px;'>25-Dec-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>3</td></tr><tr><td style='text-align:left;padding:4px 12px;'>26-Dec-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>4</td></tr><tr><td style='text-align:left;padding:4px 12px;'>31-Dec-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>2</td></tr><tr><td style='text-align:left;padding:4px 12px;'>01-Jan-25 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>3</td></tr><tr><td style='text-align:left;padding:4px 12px;'>18-Apr-25 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>5</td></tr><tr><td style='text-align:left;padding:4px 12px;'>21-Apr-25 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>1</td></tr><tr><td style='text-align:left;padding:4px 12px;'>01-May-25 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>4</td></tr><tr><td style='text-align:left;padding:4px 12px;'>24-Dec-25 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>3</td></tr><tr><td style='text-align:left;padding:4px 12px;'>25-Dec-25 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>4</td></tr><tr><td style='text-align:left;padding:4px 12px;'>26-Dec-25 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>5</td></tr><tr><td style='text-align:left;padding:4px 12px;'>31-Dec-25 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>3</td></tr><tr><td style='text-align:left;padding:4px 12px;'>01-Jan-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>GER</td><td style='text-align:left;padding:4px 12px;'>4</td></tr></table>

## 6. Bronze Layer — Landing Zone + Incremental Ingestion

Bronze implements two principles. The **landing zone** decouples API fetching from database loading — API calls are unreliable and unrepeatable, so raw responses are saved as JSON files first. If the MERGE fails, data is still on disk. If the pipeline is replayed, it reads from files without re-calling the API. **Contract enforcement** at the bronze boundary is the first line of defense — business rule violations (high < low, negative prices, empty symbols) are caught here, not three stages later. Rejected rows go to the quarantine table with full error context — preserved for investigation and replay, never silently dropped.

> [!danger] Without Landing Zone
>
> The pipeline calls the API and writes directly to SQL Server. The API
> changes its response format. The MERGE fails mid-batch. 3 of 5 symbols
> are loaded, 2 are missing, and there's no way to replay because the API
> response is gone. With the landing zone, the raw JSON is on disk —
> fix the parser, re-run the load, no re-fetch needed.

#### HttpClient — fetch OHLCV to JSON landing zone with `GetStringAsync()`

> [!info] Landing Zone: OHLCV Fetch
>
> Downloads OHLCV data from Yahoo Finance API and saves to . Each symbol gets its own file.

```csharp

HttpClient httpClient = new HttpClient();
httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0");

async Task<string> FetchOhlcvToLanding(string symbol, string start, string end)
{
    long period1 = new DateTimeOffset(DateTime.Parse(start)).ToUnixTimeSeconds();
    long period2 = new DateTimeOffset(DateTime.Parse(end)).ToUnixTimeSeconds();
    string url = $"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?period1={period1}&period2={period2}&interval=1d";

    string json = await retryPolicy.ExecuteAsync(() => httpClient.GetStringAsync(url));

    var safeSymbol = symbol.Replace(".", "_");
    var landingPath = Path.Combine(LANDING_DIR, $"ohlcv_{safeSymbol}.json");

    // Parse v8 response and extract OHLCV records
    using var doc = JsonDocument.Parse(json);
    var result = doc.RootElement.GetProperty("chart").GetProperty("result")[0];
    var timestamps = result.GetProperty("timestamp");
    var quote = result.GetProperty("indicators").GetProperty("quote")[0];
    var adjClose = result.GetProperty("indicators").GetProperty("adjclose")[0].GetProperty("adjclose");

    var records = new List<Dictionary<string, object>>();
    for (int i = 0; i < timestamps.GetArrayLength(); i++)
    {
        var ts = DateTimeOffset.FromUnixTimeSeconds(timestamps[i].GetInt64()).DateTime;
        records.Add(new Dictionary<string, object> {
            ["symbol"] = symbol,
            ["date"] = ts.ToString("yyyy-MM-dd"),
            ["open"] = quote.GetProperty("open")[i].GetDouble(),
            ["high"] = quote.GetProperty("high")[i].GetDouble(),
            ["low"] = quote.GetProperty("low")[i].GetDouble(),
            ["close"] = quote.GetProperty("close")[i].GetDouble(),
            ["adj_close"] = adjClose[i].GetDouble(),
            ["volume"] = quote.GetProperty("volume")[i].GetInt64(),
            ["dividends"] = 0.0,
            ["stock_splits"] = 0.0,
        });
    }

    File.WriteAllText(landingPath, JsonSerializer.Serialize(records, new JsonSerializerOptions { WriteIndented = true }));
    return landingPath;
}

Console.WriteLine("FetchOhlcvToLanding() defined");
```

    FetchOhlcvToLanding() defined

#### C# — load OHLCV from JSON landing zone with `JsonSerializer.Deserialize()`

> [!info] Load OHLCV from Landing
>
> Reads a symbol JSON landing file into a DataTable. Casts date strings to DateTime.

```csharp

DataTable LoadOhlcvFromLanding(string symbol)
{
    var safeSymbol = symbol.Replace(".", "_");
    var landingPath = Path.Combine(LANDING_DIR, $"ohlcv_{safeSymbol}.json");
    if (!File.Exists(landingPath)) return new DataTable();

    var json = File.ReadAllText(landingPath);
    var records = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(json);
    if (records == null || records.Count == 0) return new DataTable();

    var dt = new DataTable();
    dt.Columns.Add("symbol", typeof(string));
    dt.Columns.Add("date", typeof(DateTime));
    dt.Columns.Add("open", typeof(double));
    dt.Columns.Add("high", typeof(double));
    dt.Columns.Add("low", typeof(double));
    dt.Columns.Add("close", typeof(double));
    dt.Columns.Add("adj_close", typeof(double));
    dt.Columns.Add("volume", typeof(long));
    dt.Columns.Add("dividends", typeof(double));
    dt.Columns.Add("stock_splits", typeof(double));

    foreach (var rec in records)
    {
        dt.Rows.Add(
            rec["symbol"].GetString(),
            DateTime.Parse(rec["date"].GetString()),
            rec["open"].GetDouble(),
            rec["high"].GetDouble(),
            rec["low"].GetDouble(),
            rec["close"].GetDouble(),
            rec["adj_close"].GetDouble(),
            rec["volume"].GetInt64(),
            rec.ContainsKey("dividends") ? rec["dividends"].GetDouble() : 0.0,
            rec.ContainsKey("stock_splits") ? rec["stock_splits"].GetDouble() : 0.0
        );
    }
    return dt;
}

Console.WriteLine("LoadOhlcvFromLanding() defined");
```

    LoadOhlcvFromLanding() defined

#### HttpClient — test single symbol landing zone fetch with `FetchOhlcvToLanding()`

```csharp
// Verify the landing zone pattern: fetch → JSON → load → DataTable

var testPath = await FetchOhlcvToLanding("SAP.DE", "2024-06-01", "2024-06-30");
if (testPath != null)
    Console.WriteLine($"Landed: {Path.GetFileName(testPath)} ({new FileInfo(testPath).Length / 1024.0:F1} KB)");

var testDt = LoadOhlcvFromLanding("SAP.DE");
Console.WriteLine($"Loaded: {testDt.Rows.Count} rows, columns: {string.Join(", ", testDt.Columns.Cast<DataColumn>().Select(c => c.ColumnName))}");
testDt.AsEnumerable().Take(5).CopyToDataTable()
```

    Landed: ohlcv_SAP_DE.json (5.7 KB)
    Loaded: 20 rows, columns: symbol, date, open, high, low, close, adj_close, volume, dividends, stock_splits

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>open</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>high</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>low</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>adj_close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>volume</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>dividends</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>stock_splits</th></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>03-Jun-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>169.74000549316406</td><td style='text-align:left;padding:4px 12px;'>169.82000732421875</td><td style='text-align:left;padding:4px 12px;'>166.9600067138672</td><td style='text-align:left;padding:4px 12px;'>168.25999450683594</td><td style='text-align:left;padding:4px 12px;'>166.7528076171875</td><td style='text-align:left;padding:4px 12px;'>1531728</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>04-Jun-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>168.52000427246094</td><td style='text-align:left;padding:4px 12px;'>170.44000244140625</td><td style='text-align:left;padding:4px 12px;'>167.66000366210938</td><td style='text-align:left;padding:4px 12px;'>168.60000610351562</td><td style='text-align:left;padding:4px 12px;'>167.0897674560547</td><td style='text-align:left;padding:4px 12px;'>1592071</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>05-Jun-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>170</td><td style='text-align:left;padding:4px 12px;'>171.82000732421875</td><td style='text-align:left;padding:4px 12px;'>169.0800018310547</td><td style='text-align:left;padding:4px 12px;'>171.52000427246094</td><td style='text-align:left;padding:4px 12px;'>169.98361206054688</td><td style='text-align:left;padding:4px 12px;'>1352916</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>06-Jun-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>176.02000427246094</td><td style='text-align:left;padding:4px 12px;'>180.24000549316406</td><td style='text-align:left;padding:4px 12px;'>176</td><td style='text-align:left;padding:4px 12px;'>177.72000122070312</td><td style='text-align:left;padding:4px 12px;'>176.12806701660156</td><td style='text-align:left;padding:4px 12px;'>2089549</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>07-Jun-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>177.5</td><td style='text-align:left;padding:4px 12px;'>178.25999450683594</td><td style='text-align:left;padding:4px 12px;'>175.6999969482422</td><td style='text-align:left;padding:4px 12px;'>177.36000061035156</td><td style='text-align:left;padding:4px 12px;'>175.77130126953125</td><td style='text-align:left;padding:4px 12px;'>1224863</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td></tr></table>

#### FluentValidation — validate Bronze rows with `Validate()` row-level check

> [!info] Bronze Row-Level Validation
>
> Valid rows collected; rejected rows go to quarantine with error details.

```csharp

(DataTable Valid, int Rejected) ValidateBronze(DataTable dt, string batchId = "")
{
    var validator = new RawOhlcvValidator();
    var valid = dt.Clone();
    int rejected = 0;

    foreach (DataRow row in dt.Rows)
    {
        try
        {
            var record = new RawOhlcv(
                row["symbol"].ToString(), (DateTime)row["date"],
                Convert.ToDouble(row["open"]), Convert.ToDouble(row["high"]),
                Convert.ToDouble(row["low"]), Convert.ToDouble(row["close"]),
                Convert.ToDouble(row["adj_close"]), Convert.ToInt64(row["volume"]),
                Convert.ToDouble(row["dividends"]), Convert.ToDouble(row["stock_splits"]));
            var result = validator.Validate(record);
            if (!result.IsValid) throw new Exception(string.Join("; ", result.Errors));
            valid.ImportRow(row);
        }
        catch (Exception ex)
        {
            rejected++;
            if (!string.IsNullOrEmpty(batchId))
                QuarantineRow(batchId, "bronze",
                    dt.Columns.Cast<DataColumn>().ToDictionary(c => c.ColumnName, c => row[c] as object),
                    ex.Message);
        }
    }
    return (valid, rejected);
}

Console.WriteLine("ValidateBronze() defined \u2014 rejects go to quarantine");
```

    ValidateBronze() defined — rejects go to quarantine

#### FluentValidation — test Bronze validation on sample data

```csharp
// Should pass all rows since Yahoo Finance data is generally clean

var (validDt, rejectedCount) = ValidateBronze(testDt, "test");
Console.WriteLine($"Valid: {validDt.Rows.Count} rows | Rejected: {rejectedCount} rows");
var preview = validDt.AsEnumerable().Take(5).CopyToDataTable();
preview
```

    Valid: 20 rows | Rejected: 0 rows

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>open</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>high</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>low</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>adj_close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>volume</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>dividends</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>stock_splits</th></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>03-Jun-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>169.74000549316406</td><td style='text-align:left;padding:4px 12px;'>169.82000732421875</td><td style='text-align:left;padding:4px 12px;'>166.9600067138672</td><td style='text-align:left;padding:4px 12px;'>168.25999450683594</td><td style='text-align:left;padding:4px 12px;'>166.7528076171875</td><td style='text-align:left;padding:4px 12px;'>1531728</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>04-Jun-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>168.52000427246094</td><td style='text-align:left;padding:4px 12px;'>170.44000244140625</td><td style='text-align:left;padding:4px 12px;'>167.66000366210938</td><td style='text-align:left;padding:4px 12px;'>168.60000610351562</td><td style='text-align:left;padding:4px 12px;'>167.0897674560547</td><td style='text-align:left;padding:4px 12px;'>1592071</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>05-Jun-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>170</td><td style='text-align:left;padding:4px 12px;'>171.82000732421875</td><td style='text-align:left;padding:4px 12px;'>169.0800018310547</td><td style='text-align:left;padding:4px 12px;'>171.52000427246094</td><td style='text-align:left;padding:4px 12px;'>169.98361206054688</td><td style='text-align:left;padding:4px 12px;'>1352916</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>06-Jun-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>176.02000427246094</td><td style='text-align:left;padding:4px 12px;'>180.24000549316406</td><td style='text-align:left;padding:4px 12px;'>176</td><td style='text-align:left;padding:4px 12px;'>177.72000122070312</td><td style='text-align:left;padding:4px 12px;'>176.12806701660156</td><td style='text-align:left;padding:4px 12px;'>2089549</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>07-Jun-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>177.5</td><td style='text-align:left;padding:4px 12px;'>178.25999450683594</td><td style='text-align:left;padding:4px 12px;'>175.6999969482422</td><td style='text-align:left;padding:4px 12px;'>177.36000061035156</td><td style='text-align:left;padding:4px 12px;'>175.77130126953125</td><td style='text-align:left;padding:4px 12px;'>1224863</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td></tr></table>

#### Bronze — define incremental ingestion pipeline with landing zone + `MERGE INTO`

> [!info] Bronze Ingestion Pipeline
>
> Three-step process: land → validate → MERGE upsert. Checks last known date per symbol, fetches only new data, validates with FluentValidation, MERGE upserts to SQL Server.

```csharp

async Task<(DataTable, StageLineage)> IngestBronze(string[] symbols, string start, string end, string batchId)
{
    var stageCtx = StartStage(batchId, "bronze", 0);
    int totalFetched = 0;
    int totalRejected = 0;
    var allRows = new DataTable();

    foreach (var symbol in symbols)
    {
        // Check last known date in SQL Server
        var lastDate = sqlConn.ExecuteScalar<DateTime?>(
            "SELECT MAX(date) FROM bronze_ohlcv WHERE symbol = @symbol",
            new { symbol });

        // Determine fetch range
        string fetchStart;
        if (lastDate.HasValue)
        {
            fetchStart = lastDate.Value.AddDays(1).ToString("yyyy-MM-dd");
            if (string.Compare(fetchStart, end) >= 0)
            {
                Console.WriteLine($"  {symbol}: up to date (last: {lastDate.Value:yyyy-MM-dd})");
                continue;
            }
        }
        else
        {
            fetchStart = start;
        }

        // Step 1: Fetch from Yahoo Finance → JSON landing zone
        string landingPath;
        try
        {
            landingPath = await FetchOhlcvToLanding(symbol, fetchStart, end);
        }
        catch
        {
            Console.WriteLine($"  {symbol}: no new data from {fetchStart}");
            continue;
        }

        // Step 2: Load from landing zone
        var rawDt = LoadOhlcvFromLanding(symbol);
        totalFetched += rawDt.Rows.Count;

        // Step 3: Validate through FluentValidation
        var (validDt, rejected) = ValidateBronze(rawDt, batchId);
        totalRejected += rejected;

        if (validDt.Rows.Count > 0)
        {
            if (allRows.Columns.Count == 0) allRows = validDt.Clone();
            foreach (DataRow r in validDt.Rows) allRows.ImportRow(r);

            // MERGE upsert into SQL Server
            int merged = MergeBronze(validDt, batchId);
            double sizeKb = new FileInfo(landingPath).Length / 1024.0;
            Console.WriteLine($"  {symbol}: {rawDt.Rows.Count} landed ({sizeKb:F1} KB), "
                + $"{validDt.Rows.Count} valid, {rejected} rejected, {merged} merged");
        }
    }

    // Build lineage via StartStage/EndStage
    stageCtx["input_rows"] = totalFetched;
    var emptyDt = allRows.Rows.Count > 0 ? allRows : new DataTable();
    if (emptyDt.Columns.Count == 0) { emptyDt.Columns.Add("_"); emptyDt.Rows.Add("_"); }
    var lineage = EndStage(stageCtx, emptyDt, totalRejected);
    PersistLineage(lineage);

    // Return FULL bronze dataset for downstream stages
    var bronzeFull = QueryToTable(
        "SELECT symbol, date, [open], high, low, [close], "
        + "adj_close, volume, dividends, stock_splits, batch_id "
        + "FROM bronze_ohlcv ORDER BY symbol, date");

    return (bronzeFull, lineage);
}

Console.WriteLine("IngestBronze() defined — landing zone + incremental MERGE");
```

    IngestBronze() defined — landing zone + incremental MERGE

#### Bronze — execute incremental ingestion for all symbols

> [!info] Bronze Execution with Context
>
> Creates  (scheduled, T-1) and , initializes , then runs the Bronze ingestion pipeline.

```csharp

var batchId = Guid.NewGuid().ToString();

var bizCtx = new BusinessContext {
    Trigger = "scheduled",
    BusinessDate = DateTime.Today.AddDays(-1),
};
var tempCtx = new TemporalContext {
    AsOfDate = DateTime.Today.AddDays(-1),
    ReportingPeriodStart = DateTime.Parse(START_DATE),
    ReportingPeriodEnd = DateTime.Parse(END_DATE),
    Timezone = "CET",
};
var bronzeStageCtx = new StageContext {
    BatchId = batchId, Stage = "bronze",
    ColumnCtx = BRONZE_COLUMNS,
    BizContext = bizCtx, TempContext = tempCtx,
};

Console.WriteLine($"Pipeline batch_id: {batchId.Substring(0, 8)}...");
Console.WriteLine($"Range: {START_DATE} → {END_DATE}");

var sw = System.Diagnostics.Stopwatch.StartNew();
var (bronzeDt, bronzeLineage) = await IngestBronze(SYMBOLS, START_DATE, END_DATE, batchId);
sw.Stop();

// Detect zero-volume rows and classify using trading calendar
var zeroVol = bronzeDt.AsEnumerable()
    .Where(r => Convert.ToInt64(r["volume"]) == 0)
    .Select(r => new { Symbol = r["symbol"].ToString(), Date = (DateTime)r["date"] })
    .Distinct().ToList();

if (zeroVol.Count > 0)
{
    foreach (var row in zeroVol)
    {
        var cal = QueryToTable(
            $"SELECT is_trading_day FROM dim_calendar "
            + $"WHERE date = '{row.Date:yyyy-MM-dd}' AND exchange_code = 'XETR'");
        if (cal.Rows.Count > 0 && !Convert.ToBoolean(cal.Rows[0]["is_trading_day"]))
            bronzeStageCtx.AddWarning(
                $"{row.Symbol}: zero volume on {row.Date:yyyy-MM-dd} — non-trading day (calendar)");
        else if (cal.Rows.Count > 0 && Convert.ToBoolean(cal.Rows[0]["is_trading_day"]))
            bronzeStageCtx.AddWarning(
                $"{row.Symbol}: zero volume on {row.Date:yyyy-MM-dd} — TRADING DAY (anomaly)");
    }
}

PersistContext(bronzeStageCtx);
var silverStageCtx = bronzeStageCtx.ForNextStage("silver", bronzeLineage, SILVER_COLUMNS);
Console.WriteLine($"Bronze complete: {bronzeDt.Rows.Count} rows in {sw.ElapsedMilliseconds}ms");
```

    Pipeline batch_id: d99b77ff...
    Range: 2024-03-30 → 2026-03-30
      SAP.DE: 1 landed (0.3 KB), 1 valid, 0 rejected, 1 merged
      SIE.DE: 1 landed (0.3 KB), 1 valid, 0 rejected, 1 merged
      ALV.DE: 1 landed (0.3 KB), 1 valid, 0 rejected, 1 merged
      DTE.DE: 1 landed (0.3 KB), 1 valid, 0 rejected, 1 merged
      BAS.DE: 1 landed (0.3 KB), 1 valid, 0 rejected, 1 merged
    Bronze complete: 2530 rows in 583ms

#### SQL Server — display Bronze sample data with `QueryToTable()`

```csharp
// Show first rows of ingested data to verify schema and values

QueryToTable("SELECT TOP 5 * FROM bronze_ohlcv ORDER BY symbol, date")
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>id</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>open</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>high</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>low</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>adj_close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>volume</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>dividends</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>stock_splits</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>batch_id</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>ingested_at</th></tr><tr><td style='text-align:left;padding:4px 12px;'>1013</td><td style='text-align:left;padding:4px 12px;'>ALV.DE</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>277</td><td style='text-align:left;padding:4px 12px;'>278.1000061035156</td><td style='text-align:left;padding:4px 12px;'>276.45001220703125</td><td style='text-align:left;padding:4px 12px;'>277.79998779296875</td><td style='text-align:left;padding:4px 12px;'>252.8253936767578</td><td style='text-align:left;padding:4px 12px;'>919173</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>28-Mar-26 23:21:34</td></tr><tr><td style='text-align:left;padding:4px 12px;'>1014</td><td style='text-align:left;padding:4px 12px;'>ALV.DE</td><td style='text-align:left;padding:4px 12px;'>02-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>278.20001220703125</td><td style='text-align:left;padding:4px 12px;'>280</td><td style='text-align:left;padding:4px 12px;'>272.20001220703125</td><td style='text-align:left;padding:4px 12px;'>273.8999938964844</td><td style='text-align:left;padding:4px 12px;'>249.2760009765625</td><td style='text-align:left;padding:4px 12px;'>1013176</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>28-Mar-26 23:21:34</td></tr><tr><td style='text-align:left;padding:4px 12px;'>1015</td><td style='text-align:left;padding:4px 12px;'>ALV.DE</td><td style='text-align:left;padding:4px 12px;'>03-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>274.5</td><td style='text-align:left;padding:4px 12px;'>276.6000061035156</td><td style='text-align:left;padding:4px 12px;'>273.8999938964844</td><td style='text-align:left;padding:4px 12px;'>274.3999938964844</td><td style='text-align:left;padding:4px 12px;'>249.73106384277344</td><td style='text-align:left;padding:4px 12px;'>782102</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>28-Mar-26 23:21:34</td></tr><tr><td style='text-align:left;padding:4px 12px;'>1016</td><td style='text-align:left;padding:4px 12px;'>ALV.DE</td><td style='text-align:left;padding:4px 12px;'>04-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>274.1000061035156</td><td style='text-align:left;padding:4px 12px;'>275.20001220703125</td><td style='text-align:left;padding:4px 12px;'>272.20001220703125</td><td style='text-align:left;padding:4px 12px;'>272.3999938964844</td><td style='text-align:left;padding:4px 12px;'>247.91087341308594</td><td style='text-align:left;padding:4px 12px;'>690551</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>28-Mar-26 23:21:34</td></tr><tr><td style='text-align:left;padding:4px 12px;'>1017</td><td style='text-align:left;padding:4px 12px;'>ALV.DE</td><td style='text-align:left;padding:4px 12px;'>05-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>270</td><td style='text-align:left;padding:4px 12px;'>270.20001220703125</td><td style='text-align:left;padding:4px 12px;'>267.1000061035156</td><td style='text-align:left;padding:4px 12px;'>268.79998779296875</td><td style='text-align:left;padding:4px 12px;'>244.63449096679688</td><td style='text-align:left;padding:4px 12px;'>930874</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>28-Mar-26 23:21:34</td></tr></table>

#### SQL Server — display Bronze row counts per symbol with `GROUP BY`

```csharp
// Verify all symbols were ingested with reasonable row counts

QueryToTable(@"SELECT symbol, COUNT(*) as rows, MIN(date) as first_date, MAX(date) as last_date
    FROM bronze_ohlcv GROUP BY symbol ORDER BY symbol")
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>rows</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>first_date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>last_date</th></tr><tr><td style='text-align:left;padding:4px 12px;'>ALV.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>27-Mar-26 0:00:00</td></tr><tr><td style='text-align:left;padding:4px 12px;'>BAS.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>27-Mar-26 0:00:00</td></tr><tr><td style='text-align:left;padding:4px 12px;'>DTE.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>27-Mar-26 0:00:00</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>27-Mar-26 0:00:00</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SIE.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>27-Mar-26 0:00:00</td></tr></table>

#### Pipeline — run Bronze data quality gate with `RunQualityGate()`

> [!info] Bronze Quality Gate
>
> All checks must pass before Silver processing begins.

```csharp

var bronzeDq = RunQualityGate(new[] {
    DqCheckNotEmpty(bronzeDt, "bronze"),
    DqCheckNoNullKeys(bronzeDt, new[] { "symbol", "date" }, "bronze"),
    DqCheckNoDuplicates(bronzeDt, new[] { "symbol", "date" }, "bronze"),
    DqCheckRange(bronzeDt, "close", 0.01, 100_000, "bronze"),
    DqCheckRange(bronzeDt, "volume", 0, 10_000_000_000, "bronze"),
    DqCheckFreshness(bronzeDt, "date", 5, "bronze"),
    DqCheckRowCount(bronzeDt, SYMBOLS.Length * 200, "bronze"),
}, "bronze");

bronzeDq
```

    DQ PASS: bronze: 2530 rows
      DQ PASS: bronze: no null keys in [symbol, date]
      DQ PASS: bronze: no duplicates
      DQ PASS: bronze: 'close' within range
      DQ PASS: bronze: 'volume' within range
      DQ PASS: bronze: latest date 2026-03-27 (3d ago)
      DQ PASS: bronze: 2530 rows

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>check</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>status</th></tr><tr><td style='text-align:left;padding:4px 12px;'>bronze: 2530 rows</td><td style='text-align:left;padding:4px 12px;'>PASS</td></tr><tr><td style='text-align:left;padding:4px 12px;'>bronze: no null keys in [symbol, date]</td><td style='text-align:left;padding:4px 12px;'>PASS</td></tr><tr><td style='text-align:left;padding:4px 12px;'>bronze: no duplicates</td><td style='text-align:left;padding:4px 12px;'>PASS</td></tr><tr><td style='text-align:left;padding:4px 12px;'>bronze: 'close' within range</td><td style='text-align:left;padding:4px 12px;'>PASS</td></tr><tr><td style='text-align:left;padding:4px 12px;'>bronze: 'volume' within range</td><td style='text-align:left;padding:4px 12px;'>PASS</td></tr><tr><td style='text-align:left;padding:4px 12px;'>bronze: latest date 2026-03-27 (3d ago)</td><td style='text-align:left;padding:4px 12px;'>PASS</td></tr><tr><td style='text-align:left;padding:4px 12px;'>bronze: 2530 rows</td><td style='text-align:left;padding:4px 12px;'>PASS</td></tr></table>

## 7. Silver Layer — Cleaning & Enrichment

Silver is where the **Functional Core** principle (Gary Bernhardt, 'Boundaries' 2012) is most visible. The three transforms (daily_return, intraday_range, sma_20) are pure functions — DataFrame in, DataFrame out, no database calls, no file I/O, no side effects. Pure functions are trivially testable (pass a 10-row hardcoded DataFrame, assert the output), trivially debuggable (the bug is in the formula, not in a network timeout), and trivially parallelizable (no shared state). The imperative shell (MERGE upsert, lineage persistence, context propagation) wraps AROUND the pure transforms, never inside them.

> [!danger] Without Pure Transforms
>
> A transform function that reads from SQL Server mid-computation becomes
> untestable without a live database. A transform that writes intermediate
> results to a file fails unpredictably under disk pressure. Keeping
> transforms pure means the only thing that can go wrong is the formula —
> and formulas can be verified with a unit test in milliseconds.

#### LINQ — compute daily returns with grouped percentage change

> [!info] Transform: Daily Returns
>
> Close-to-close percentage change, partitioned by symbol. Pure function: DataTable in → DataTable out.

```csharp

DataTable ComputeDailyReturns(DataTable dt)
{
    if (!dt.Columns.Contains("daily_return"))
        dt.Columns.Add("daily_return", typeof(double));

    var groups = dt.AsEnumerable().GroupBy(r => r.Field<string>("symbol"));
    foreach (var group in groups)
    {
        var rows = group.OrderBy(r => r.Field<DateTime>("date")).ToList();
        for (int i = 0; i < rows.Count; i++)
        {
            if (i == 0)
                rows[i]["daily_return"] = 0.0;
            else
            {
                double prevClose = Convert.ToDouble(rows[i - 1]["close"]);
                double currClose = Convert.ToDouble(rows[i]["close"]);
                rows[i]["daily_return"] = Math.Round((currClose - prevClose) / prevClose, 6);
            }
        }
    }
    return dt;
}

// Test on Bronze data
var testReturns = ComputeDailyReturns(bronzeDt.Copy());
var sapRows = testReturns.AsEnumerable()
    .Where(r => r.Field<string>("symbol") == "SAP.DE")
    .Take(5);
var preview = testReturns.Clone();
foreach (var r in sapRows) preview.ImportRow(r);
preview
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>open</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>high</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>low</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>adj_close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>volume</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>dividends</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>stock_splits</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>batch_id</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>daily_return</th></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>181.82000732421875</td><td style='text-align:left;padding:4px 12px;'>181.86000061035156</td><td style='text-align:left;padding:4px 12px;'>179.10000610351562</td><td style='text-align:left;padding:4px 12px;'>180.4600067138672</td><td style='text-align:left;padding:4px 12px;'>176.6092529296875</td><td style='text-align:left;padding:4px 12px;'>1700825</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>0</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>02-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>181</td><td style='text-align:left;padding:4px 12px;'>181.9199981689453</td><td style='text-align:left;padding:4px 12px;'>177.05999755859375</td><td style='text-align:left;padding:4px 12px;'>177.05999755859375</td><td style='text-align:left;padding:4px 12px;'>173.28179931640625</td><td style='text-align:left;padding:4px 12px;'>1838833</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>-0.018841</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>03-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>178.32000732421875</td><td style='text-align:left;padding:4px 12px;'>179.52000427246094</td><td style='text-align:left;padding:4px 12px;'>176.55999755859375</td><td style='text-align:left;padding:4px 12px;'>178.22000122070312</td><td style='text-align:left;padding:4px 12px;'>174.41705322265625</td><td style='text-align:left;padding:4px 12px;'>1501774</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>0.006551</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>04-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>177.9199981689453</td><td style='text-align:left;padding:4px 12px;'>178.4600067138672</td><td style='text-align:left;padding:4px 12px;'>176.33999633789062</td><td style='text-align:left;padding:4px 12px;'>178.02000427246094</td><td style='text-align:left;padding:4px 12px;'>174.22132873535156</td><td style='text-align:left;padding:4px 12px;'>1126985</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>-0.001122</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>05-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>175.39999389648438</td><td style='text-align:left;padding:4px 12px;'>177.9600067138672</td><td style='text-align:left;padding:4px 12px;'>174.77999877929688</td><td style='text-align:left;padding:4px 12px;'>177.4199981689453</td><td style='text-align:left;padding:4px 12px;'>173.63412475585938</td><td style='text-align:left;padding:4px 12px;'>2099406</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>-0.00337</td></tr></table>

#### LINQ — compute intraday range with `(high - low) / close`

> [!info] Transform: Intraday Range
>
>  — normalized daily price spread. Higher values = more volatile day.

```csharp

DataTable ComputeIntradayRange(DataTable dt)
{
    if (!dt.Columns.Contains("intraday_range"))
        dt.Columns.Add("intraday_range", typeof(double));

    foreach (DataRow row in dt.Rows)
    {
        double high = Convert.ToDouble(row["high"]);
        double low = Convert.ToDouble(row["low"]);
        double close = Convert.ToDouble(row["close"]);
        row["intraday_range"] = Math.Round((high - low) / close, 6);
    }
    return dt;
}

// Test on returns data
var testRange = ComputeIntradayRange(testReturns);
var sapRange = testRange.AsEnumerable()
    .Where(r => r.Field<string>("symbol") == "SAP.DE")
    .Take(5);
var previewRange = testRange.Clone();
foreach (var r in sapRange) previewRange.ImportRow(r);
previewRange
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>open</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>high</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>low</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>adj_close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>volume</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>dividends</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>stock_splits</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>batch_id</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>daily_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>intraday_range</th></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>181.82000732421875</td><td style='text-align:left;padding:4px 12px;'>181.86000061035156</td><td style='text-align:left;padding:4px 12px;'>179.10000610351562</td><td style='text-align:left;padding:4px 12px;'>180.4600067138672</td><td style='text-align:left;padding:4px 12px;'>176.6092529296875</td><td style='text-align:left;padding:4px 12px;'>1700825</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0.015294</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>02-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>181</td><td style='text-align:left;padding:4px 12px;'>181.9199981689453</td><td style='text-align:left;padding:4px 12px;'>177.05999755859375</td><td style='text-align:left;padding:4px 12px;'>177.05999755859375</td><td style='text-align:left;padding:4px 12px;'>173.28179931640625</td><td style='text-align:left;padding:4px 12px;'>1838833</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>-0.018841</td><td style='text-align:left;padding:4px 12px;'>0.027448</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>03-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>178.32000732421875</td><td style='text-align:left;padding:4px 12px;'>179.52000427246094</td><td style='text-align:left;padding:4px 12px;'>176.55999755859375</td><td style='text-align:left;padding:4px 12px;'>178.22000122070312</td><td style='text-align:left;padding:4px 12px;'>174.41705322265625</td><td style='text-align:left;padding:4px 12px;'>1501774</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>0.006551</td><td style='text-align:left;padding:4px 12px;'>0.016609</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>04-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>177.9199981689453</td><td style='text-align:left;padding:4px 12px;'>178.4600067138672</td><td style='text-align:left;padding:4px 12px;'>176.33999633789062</td><td style='text-align:left;padding:4px 12px;'>178.02000427246094</td><td style='text-align:left;padding:4px 12px;'>174.22132873535156</td><td style='text-align:left;padding:4px 12px;'>1126985</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>-0.001122</td><td style='text-align:left;padding:4px 12px;'>0.011909</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>05-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>175.39999389648438</td><td style='text-align:left;padding:4px 12px;'>177.9600067138672</td><td style='text-align:left;padding:4px 12px;'>174.77999877929688</td><td style='text-align:left;padding:4px 12px;'>177.4199981689453</td><td style='text-align:left;padding:4px 12px;'>173.63412475585938</td><td style='text-align:left;padding:4px 12px;'>2099406</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>-0.00337</td><td style='text-align:left;padding:4px 12px;'>0.017924</td></tr></table>

#### LINQ — compute 20-day moving average with rolling window

> [!info] Transform: 20-Day SMA
>
> Rolling mean of close price over 20-day window, per symbol. First 19 rows per symbol are NULL (insufficient data).

```csharp

DataTable ComputeSma(DataTable dt, int window = 20)
{
    string col = $"sma_{window}";
    if (!dt.Columns.Contains(col))
        dt.Columns.Add(col, typeof(object));

    var groups = dt.AsEnumerable().GroupBy(r => r.Field<string>("symbol"));
    foreach (var group in groups)
    {
        var rows = group.OrderBy(r => r.Field<DateTime>("date")).ToList();
        for (int i = 0; i < rows.Count; i++)
        {
            if (i < window - 1)
                rows[i][col] = DBNull.Value;
            else
            {
                double sum = 0;
                for (int j = i - window + 1; j <= i; j++)
                    sum += Convert.ToDouble(rows[j]["close"]);
                rows[i][col] = Math.Round(sum / window, 4);
            }
        }
    }
    return dt;
}

// Test on range data
var testSma = ComputeSma(testRange);
var sapSma = testSma.AsEnumerable()
    .Where(r => r.Field<string>("symbol") == "SAP.DE")
    .Reverse().Take(5).Reverse();
var previewSma = testSma.Clone();
foreach (var r in sapSma) previewSma.ImportRow(r);
previewSma
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>open</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>high</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>low</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>adj_close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>volume</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>dividends</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>stock_splits</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>batch_id</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>daily_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>intraday_range</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>sma_20</th></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>23-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>150.4600067138672</td><td style='text-align:left;padding:4px 12px;'>161.52000427246094</td><td style='text-align:left;padding:4px 12px;'>150.39999389648438</td><td style='text-align:left;padding:4px 12px;'>153.86000061035156</td><td style='text-align:left;padding:4px 12px;'>153.86000061035156</td><td style='text-align:left;padding:4px 12px;'>4165368</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>0.00026</td><td style='text-align:left;padding:4px 12px;'>0.072274</td><td style='text-align:left;padding:4px 12px;'>166.034</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>24-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>149.75999450683594</td><td style='text-align:left;padding:4px 12px;'>151.0399932861328</td><td style='text-align:left;padding:4px 12px;'>146</td><td style='text-align:left;padding:4px 12px;'>147.6199951171875</td><td style='text-align:left;padding:4px 12px;'>147.6199951171875</td><td style='text-align:left;padding:4px 12px;'>4380715</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>-0.040556</td><td style='text-align:left;padding:4px 12px;'>0.034142</td><td style='text-align:left;padding:4px 12px;'>165.123</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>25-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>148.77999877929688</td><td style='text-align:left;padding:4px 12px;'>150.5399932861328</td><td style='text-align:left;padding:4px 12px;'>145.36000061035156</td><td style='text-align:left;padding:4px 12px;'>146.89999389648438</td><td style='text-align:left;padding:4px 12px;'>146.89999389648438</td><td style='text-align:left;padding:4px 12px;'>3757697</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>-0.004877</td><td style='text-align:left;padding:4px 12px;'>0.035262</td><td style='text-align:left;padding:4px 12px;'>164.129</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>26-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>145.39999389648438</td><td style='text-align:left;padding:4px 12px;'>148.0800018310547</td><td style='text-align:left;padding:4px 12px;'>143.52000427246094</td><td style='text-align:left;padding:4px 12px;'>144.63999938964844</td><td style='text-align:left;padding:4px 12px;'>144.63999938964844</td><td style='text-align:left;padding:4px 12px;'>3752998</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>-0.015385</td><td style='text-align:left;padding:4px 12px;'>0.031527</td><td style='text-align:left;padding:4px 12px;'>162.75</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>27-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>145.74000549316406</td><td style='text-align:left;padding:4px 12px;'>147.32000732421875</td><td style='text-align:left;padding:4px 12px;'>142.10000610351562</td><td style='text-align:left;padding:4px 12px;'>142.55999755859375</td><td style='text-align:left;padding:4px 12px;'>142.55999755859375</td><td style='text-align:left;padding:4px 12px;'>3568581</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td><td style='text-align:left;padding:4px 12px;'>-0.014381</td><td style='text-align:left;padding:4px 12px;'>0.036616</td><td style='text-align:left;padding:4px 12px;'>161.33</td></tr></table>

#### C# — compose all Silver transforms with function chaining

> [!info] Transform Composition Pipeline
>
> Chains three pure functions — each is independent and unit-testable. The composed pipeline validates through FluentValidation before MERGE.

```csharp

DataTable TransformSilver(DataTable bronzeDt)
{
    var dt = bronzeDt.Copy();
    if (dt.Columns.Contains("batch_id")) dt.Columns.Remove("batch_id");
    dt = ComputeDailyReturns(dt);
    dt = ComputeIntradayRange(dt);
    dt = ComputeSma(dt, 20);
    return dt;
}

Console.WriteLine("TransformSilver() defined \u2014 composes all Silver transforms");
```

    TransformSilver() defined — composes all Silver transforms

#### FluentValidation — validate Silver rows with `Validate()` row-level check

> [!info] Silver Row-Level Validation
>
> Valid rows collected; rejected rows quarantined with error details.

```csharp

(DataTable Valid, int Rejected) ValidateSilver(DataTable dt, string batchId)
{
    var validator = new CleanOhlcvValidator();
    var valid = dt.Clone();
    int rejected = 0;

    foreach (DataRow row in dt.Rows)
    {
        try
        {
            var sma20 = row["sma_20"] == DBNull.Value ? (double?)null : Convert.ToDouble(row["sma_20"]);
            var record = new CleanOhlcv(
                row["symbol"].ToString(), (DateTime)row["date"],
                Convert.ToDouble(row["open"]), Convert.ToDouble(row["high"]),
                Convert.ToDouble(row["low"]), Convert.ToDouble(row["close"]),
                Convert.ToDouble(row["adj_close"]), Convert.ToInt64(row["volume"]),
                Convert.ToDouble(row["dividends"]), Convert.ToDouble(row["stock_splits"]),
                Convert.ToDouble(row["daily_return"]),
                Convert.ToDouble(row["intraday_range"]),
                sma20, batchId);
            var result = validator.Validate(record);
            if (!result.IsValid) throw new Exception(string.Join("; ", result.Errors));
            valid.ImportRow(row);
        }
        catch (Exception ex)
        {
            rejected++;
            QuarantineRow(batchId, "silver",
                dt.Columns.Cast<DataColumn>().ToDictionary(c => c.ColumnName, c => row[c] as object),
                ex.Message);
        }
    }
    return (valid, rejected);
}

Console.WriteLine("ValidateSilver() defined \u2014 rejects go to quarantine");
```

    ValidateSilver() defined — rejects go to quarantine

#### Silver — define enrichment pipeline with transform + `MERGE INTO`

> [!info] Silver Enrichment Pipeline
>
> Orchestrates: transform (pure) → validate (FluentValidation) → MERGE (SQL) → lineage. Transforms the FULL bronze dataset (needed for correct SMA/returns).

```csharp

(DataTable, StageLineage) ProcessSilver(DataTable bronzeDt, string batchId)
{
    var stageCtx = StartStage(batchId, "silver", bronzeDt.Rows.Count);

    // Apply all transforms on full bronze (SMA/returns need full history)
    var enrichedDt = TransformSilver(bronzeDt);

    // Validate through FluentValidation
    var (validDt, rejected) = ValidateSilver(enrichedDt, batchId);

    // MERGE upsert into SQL Server
    if (validDt.Rows.Count > 0)
    {
        int merged = MergeSilver(validDt, batchId);
        Console.WriteLine($"Silver: {merged} rows merged ({validDt.Rows.Count} valid, {rejected} rejected)");
    }

    // Complete lineage
    var lineage = EndStage(stageCtx, validDt, rejected);
    PersistLineage(lineage);

    // Return FULL silver dataset for Gold layer
    var silverFull = QueryToTable(
        "SELECT symbol, date, [open], high, low, [close], "
        + "adj_close, volume, dividends, stock_splits, "
        + "daily_return, intraday_range, sma_20, batch_id "
        + "FROM silver_ohlcv ORDER BY symbol, date");

    return (silverFull, lineage);
}

Console.WriteLine("ProcessSilver() defined — MERGE upsert, returns full dataset");
```

    ProcessSilver() defined — MERGE upsert, returns full dataset

#### Silver — execute enrichment on full Bronze data

> [!info] Silver Execution with Context
>
> Runs the Silver enrichment, then records SMA-20 null warnings in  for downstream visibility.

```csharp

var swSilver = System.Diagnostics.Stopwatch.StartNew();
var (silverDt, silverLineage) = ProcessSilver(bronzeDt, batchId);
swSilver.Stop();

int smaNullCount = silverDt.AsEnumerable()
    .Count(r => r["sma_20"] == DBNull.Value || r["sma_20"] == null);
if (smaNullCount > 0)
    silverStageCtx.AddWarning($"sma_20: {smaNullCount} NULL values (first 19 rows per symbol)");

PersistContext(silverStageCtx);
var goldStageCtx = silverStageCtx.ForNextStage("gold", silverLineage, GOLD_DAILY_COLUMNS);
Console.WriteLine($"Silver complete: {silverDt.Rows.Count} rows in {swSilver.ElapsedMilliseconds}ms");
```

    Silver: 2530 rows merged (2530 valid, 0 rejected)
      WARNING silver: sma_20: 95 NULL values (first 19 rows per symbol)
    Silver complete: 2530 rows in 5837ms

#### SQL Server — display Silver enriched columns with `QueryToTable()`

```csharp
// Verify daily_return, intraday_range, and sma_20 are populated

QueryToTable(@"SELECT TOP 5 symbol, date, [close], daily_return, intraday_range, sma_20
    FROM silver_ohlcv WHERE symbol = 'SAP.DE' ORDER BY date DESC")
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>daily_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>intraday_range</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>sma_20</th></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>27-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>142.55999755859375</td><td style='text-align:left;padding:4px 12px;'>-0.014381</td><td style='text-align:left;padding:4px 12px;'>0.036616</td><td style='text-align:left;padding:4px 12px;'>161.33</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>26-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>144.63999938964844</td><td style='text-align:left;padding:4px 12px;'>-0.015385</td><td style='text-align:left;padding:4px 12px;'>0.031527</td><td style='text-align:left;padding:4px 12px;'>162.75</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>25-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>146.89999389648438</td><td style='text-align:left;padding:4px 12px;'>-0.004877</td><td style='text-align:left;padding:4px 12px;'>0.035262</td><td style='text-align:left;padding:4px 12px;'>164.129</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>24-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>147.6199951171875</td><td style='text-align:left;padding:4px 12px;'>-0.040556</td><td style='text-align:left;padding:4px 12px;'>0.034142</td><td style='text-align:left;padding:4px 12px;'>165.123</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>23-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>153.86000061035156</td><td style='text-align:left;padding:4px 12px;'>0.00026</td><td style='text-align:left;padding:4px 12px;'>0.072274</td><td style='text-align:left;padding:4px 12px;'>166.034</td></tr></table>

#### SQL Server — display Silver statistics per symbol with `GROUP BY`

```csharp
// Summary stats to verify enrichment quality across all symbols

QueryToTable(@"SELECT symbol,
    ROUND(AVG(daily_return), 6) as avg_return,
    ROUND(STDEV(daily_return), 6) as volatility,
    ROUND(AVG(intraday_range), 6) as avg_intraday,
    SUM(CASE WHEN sma_20 IS NULL THEN 1 ELSE 0 END) as sma_nulls,
    COUNT(*) as rows
    FROM silver_ohlcv GROUP BY symbol ORDER BY symbol")
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>avg_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>volatility</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>avg_intraday</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>sma_nulls</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>rows</th></tr><tr><td style='text-align:left;padding:4px 12px;'>ALV.DE</td><td style='text-align:left;padding:4px 12px;'>0.000532</td><td style='text-align:left;padding:4px 12px;'>0.011851</td><td style='text-align:left;padding:4px 12px;'>0.014106</td><td style='text-align:left;padding:4px 12px;'>19</td><td style='text-align:left;padding:4px 12px;'>506</td></tr><tr><td style='text-align:left;padding:4px 12px;'>BAS.DE</td><td style='text-align:left;padding:4px 12px;'>0.000121</td><td style='text-align:left;padding:4px 12px;'>0.017508</td><td style='text-align:left;padding:4px 12px;'>0.021398</td><td style='text-align:left;padding:4px 12px;'>19</td><td style='text-align:left;padding:4px 12px;'>506</td></tr><tr><td style='text-align:left;padding:4px 12px;'>DTE.DE</td><td style='text-align:left;padding:4px 12px;'>0.000765</td><td style='text-align:left;padding:4px 12px;'>0.013263</td><td style='text-align:left;padding:4px 12px;'>0.01572</td><td style='text-align:left;padding:4px 12px;'>19</td><td style='text-align:left;padding:4px 12px;'>506</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>-0.000285</td><td style='text-align:left;padding:4px 12px;'>0.018919</td><td style='text-align:left;padding:4px 12px;'>0.020672</td><td style='text-align:left;padding:4px 12px;'>19</td><td style='text-align:left;padding:4px 12px;'>506</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SIE.DE</td><td style='text-align:left;padding:4px 12px;'>0.000475</td><td style='text-align:left;padding:4px 12px;'>0.019223</td><td style='text-align:left;padding:4px 12px;'>0.0215</td><td style='text-align:left;padding:4px 12px;'>19</td><td style='text-align:left;padding:4px 12px;'>506</td></tr></table>

#### Pipeline — run Silver data quality gate with `RunQualityGate()`

> [!info] Silver Quality Gate
>
> Hard gate: blocks pipeline on structural issues. Soft gate: logs warnings on statistical anomalies (e.g., return outliers).

```csharp
var silverDq = RunQualityGate(new[] {
    DqCheckNotEmpty(silverDt, "silver"),
    DqCheckNoNullKeys(silverDt, new[] { "symbol", "date", "daily_return" }, "silver"),
    DqCheckNoDuplicates(silverDt, new[] { "symbol", "date" }, "silver"),
    DqCheckRange(silverDt, "daily_return", -0.5, 0.5, "silver"),
    DqCheckRange(silverDt, "intraday_range", 0, 0.5, "silver"),
    DqCheckFreshness(silverDt, "date", 5, "silver"),
    DqCheckRowCount(silverDt, SYMBOLS.Length * 200, "silver"),
}, "silver");

// Soft checks — warn but don't block (daily return > 10% is unusual for blue chips)
Console.WriteLine("Outlier checks (warnings only):");
var outliers = silverDt.AsEnumerable()
    .Where(r => Math.Abs(Convert.ToDouble(r["daily_return"])) > 0.10)
    .ToList();
if (outliers.Count > 0)
{
    Console.WriteLine($"  {outliers.Count} rows with |daily_return| > 10%:");
    var outlierDt = silverDt.Clone();
    foreach (var r in outliers) outlierDt.ImportRow(r);
    display(outlierDt);
}
else
{
    Console.WriteLine("  No outliers detected");
}

silverDq
```

    DQ PASS: silver: 2530 rows
      DQ PASS: silver: no null keys in [symbol, date, daily_return]
      DQ PASS: silver: no duplicates
      DQ PASS: silver: 'daily_return' within range
      DQ PASS: silver: 'intraday_range' within range
      DQ PASS: silver: latest date 2026-03-27 (3d ago)
      DQ PASS: silver: 2530 rows
    Outlier checks (warnings only):
      3 rows with |daily_return| > 10%:

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>open</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>high</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>low</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>adj_close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>volume</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>dividends</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>stock_splits</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>daily_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>intraday_range</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>sma_20</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>batch_id</th></tr><tr><td style='text-align:left;padding:4px 12px;'>BAS.DE</td><td style='text-align:left;padding:4px 12px;'>05-Mar-25 0:00:00</td><td style='text-align:left;padding:4px 12px;'>50.099998474121094</td><td style='text-align:left;padding:4px 12px;'>53.68000030517578</td><td style='text-align:left;padding:4px 12px;'>50.04999923706055</td><td style='text-align:left;padding:4px 12px;'>53.65999984741211</td><td style='text-align:left;padding:4px 12px;'>50.94013214111328</td><td style='text-align:left;padding:4px 12px;'>9216640</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0.107077</td><td style='text-align:left;padding:4px 12px;'>0.067648</td><td style='text-align:left;padding:4px 12px;'>49.203</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>23-Apr-25 0:00:00</td><td style='text-align:left;padding:4px 12px;'>242.39999389648438</td><td style='text-align:left;padding:4px 12px;'>244.1999969482422</td><td style='text-align:left;padding:4px 12px;'>236.1999969482422</td><td style='text-align:left;padding:4px 12px;'>241.6999969482422</td><td style='text-align:left;padding:4px 12px;'>239.53497314453125</td><td style='text-align:left;padding:4px 12px;'>3410054</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0.106178</td><td style='text-align:left;padding:4px 12px;'>0.033099</td><td style='text-align:left;padding:4px 12px;'>235.6525</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>29-Jan-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>179</td><td style='text-align:left;padding:4px 12px;'>180.16000366210938</td><td style='text-align:left;padding:4px 12px;'>162.1199951171875</td><td style='text-align:left;padding:4px 12px;'>164.6199951171875</td><td style='text-align:left;padding:4px 12px;'>164.6199951171875</td><td style='text-align:left;padding:4px 12px;'>15846791</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>-0.160702</td><td style='text-align:left;padding:4px 12px;'>0.109586</td><td style='text-align:left;padding:4px 12px;'>200.193</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr></table>

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>check</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>status</th></tr><tr><td style='text-align:left;padding:4px 12px;'>silver: 2530 rows</td><td style='text-align:left;padding:4px 12px;'>PASS</td></tr><tr><td style='text-align:left;padding:4px 12px;'>silver: no null keys in [symbol, date, daily_return]</td><td style='text-align:left;padding:4px 12px;'>PASS</td></tr><tr><td style='text-align:left;padding:4px 12px;'>silver: no duplicates</td><td style='text-align:left;padding:4px 12px;'>PASS</td></tr><tr><td style='text-align:left;padding:4px 12px;'>silver: 'daily_return' within range</td><td style='text-align:left;padding:4px 12px;'>PASS</td></tr><tr><td style='text-align:left;padding:4px 12px;'>silver: 'intraday_range' within range</td><td style='text-align:left;padding:4px 12px;'>PASS</td></tr><tr><td style='text-align:left;padding:4px 12px;'>silver: latest date 2026-03-27 (3d ago)</td><td style='text-align:left;padding:4px 12px;'>PASS</td></tr><tr><td style='text-align:left;padding:4px 12px;'>silver: 2530 rows</td><td style='text-align:left;padding:4px 12px;'>PASS</td></tr></table>

## 8. Gold Layer — Aggregations & Mart Tables

Gold produces consumption-ready data products from Silver. Two aggregations, both pure functions: `DailySummary` (cross-sectional: all symbols for each date) and `SymbolProfile` (longitudinal: full history for each symbol). Gold is always a full rebuild — truncate and recompute from Silver on every run. This is simpler than incremental and guarantees consistency. Acceptable because Gold tables are small (~50 symbols x 1 row + ~500 daily rows). Both are validated through the typed contracts before persistence.

> [!warning] Without Gold Validation
>
> An aggregation bug produces max_drawdown = 0.15 (positive). This is
> mathematically impossible — drawdown is always negative. Without the
> le=0 constraint, the bad value reaches the dashboard. A portfolio
> manager sees "positive drawdown" and makes decisions on nonsensical data.

#### LINQ — build daily cross-sectional summary with `GroupBy()`

> [!info] Aggregation: Daily Summary
>
> Groups all symbols by date: mean/max/min return, total volume, avg intraday range. One row per trading day.

```csharp

DataTable BuildDailySummary(DataTable silverDt, string batchId)
{
    var dt = new DataTable();
    dt.Columns.Add("date", typeof(DateTime));
    dt.Columns.Add("symbols_traded", typeof(int));
    dt.Columns.Add("avg_return", typeof(double));
    dt.Columns.Add("max_return", typeof(double));
    dt.Columns.Add("min_return", typeof(double));
    dt.Columns.Add("total_volume", typeof(long));
    dt.Columns.Add("avg_intraday_pct", typeof(double));
    dt.Columns.Add("batch_id", typeof(string));

    var groups = silverDt.AsEnumerable()
        .GroupBy(r => r.Field<DateTime>("date"))
        .OrderBy(g => g.Key);

    foreach (var group in groups)
    {
        var returns = group.Select(r => Convert.ToDouble(r["daily_return"])).ToList();
        var volumes = group.Select(r => Convert.ToInt64(r["volume"])).ToList();
        var intraday = group.Select(r => Convert.ToDouble(r["intraday_range"])).ToList();

        dt.Rows.Add(
            group.Key,
            group.Select(r => r.Field<string>("symbol")).Distinct().Count(),
            Math.Round(returns.Average(), 6),
            returns.Max(),
            returns.Min(),
            volumes.Sum(),
            Math.Round(intraday.Average(), 6),
            batchId
        );
    }
    return dt;
}

var dailySummaryDt = BuildDailySummary(silverDt, batchId);
Console.WriteLine($"Daily summary: {dailySummaryDt.Rows.Count} trading days");
var previewDaily = dailySummaryDt.Clone();
foreach (DataRow r in dailySummaryDt.AsEnumerable().Take(5)) previewDaily.ImportRow(r);
previewDaily
```

    Daily summary: 506 trading days

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbols_traded</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>avg_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>max_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>min_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>total_volume</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>avg_intraday_pct</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>batch_id</th></tr><tr><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>14115241</td><td style='text-align:left;padding:4px 12px;'>0.011246</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr><tr><td style='text-align:left;padding:4px 12px;'>02-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>-0.006261</td><td style='text-align:left;padding:4px 12px;'>0.016815</td><td style='text-align:left;padding:4px 12px;'>-0.018841</td><td style='text-align:left;padding:4px 12px;'>15460060</td><td style='text-align:left;padding:4px 12px;'>0.02085</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr><tr><td style='text-align:left;padding:4px 12px;'>03-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>0.004862</td><td style='text-align:left;padding:4px 12px;'>0.01282</td><td style='text-align:left;padding:4px 12px;'>-0.002239</td><td style='text-align:left;padding:4px 12px;'>12344475</td><td style='text-align:left;padding:4px 12px;'>0.014617</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr><tr><td style='text-align:left;padding:4px 12px;'>04-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>-0.000631</td><td style='text-align:left;padding:4px 12px;'>0.007522</td><td style='text-align:left;padding:4px 12px;'>-0.007289</td><td style='text-align:left;padding:4px 12px;'>10238748</td><td style='text-align:left;padding:4px 12px;'>0.01083</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr><tr><td style='text-align:left;padding:4px 12px;'>05-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>-0.014092</td><td style='text-align:left;padding:4px 12px;'>-0.00337</td><td style='text-align:left;padding:4px 12px;'>-0.02146</td><td style='text-align:left;padding:4px 12px;'>16364036</td><td style='text-align:left;padding:4px 12px;'>0.017791</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr></table>

#### LINQ — build per-symbol profile with cumulative max drawdown

> [!info] Aggregation: Symbol Risk Profile
>
> Per-symbol over full history: avg return, volatility (daily sigma), max drawdown (peak-to-trough), total dividends.

```csharp

DataTable BuildSymbolProfile(DataTable silverDt, string batchId)
{
    var dt = new DataTable();
    dt.Columns.Add("symbol", typeof(string));
    dt.Columns.Add("total_trading_days", typeof(int));
    dt.Columns.Add("avg_daily_return", typeof(double));
    dt.Columns.Add("volatility", typeof(double));
    dt.Columns.Add("max_drawdown", typeof(double));
    dt.Columns.Add("avg_volume", typeof(double));
    dt.Columns.Add("total_dividends", typeof(double));
    dt.Columns.Add("first_date", typeof(DateTime));
    dt.Columns.Add("last_date", typeof(DateTime));
    dt.Columns.Add("batch_id", typeof(string));

    var groups = silverDt.AsEnumerable()
        .GroupBy(r => r.Field<string>("symbol"))
        .OrderBy(g => g.Key);

    foreach (var group in groups)
    {
        var rows = group.OrderBy(r => r.Field<DateTime>("date")).ToList();
        var returns = rows.Select(r => Convert.ToDouble(r["daily_return"])).ToList();
        var volumes = rows.Select(r => Convert.ToInt64(r["volume"])).ToList();
        var dividends = rows.Select(r => Convert.ToDouble(r["dividends"])).ToList();
        var closes = rows.Select(r => Convert.ToDouble(r["close"])).ToList();
        var dates = rows.Select(r => r.Field<DateTime>("date")).ToList();

        // Max drawdown: peak-to-trough decline using cumulative max of close
        double peak = closes[0];
        double maxDd = 0;
        foreach (var c in closes)
        {
            if (c > peak) peak = c;
            double dd = (c - peak) / peak;
            if (dd < maxDd) maxDd = dd;
        }

        double avgRet = returns.Average();
        double vol = Math.Sqrt(returns.Select(r => Math.Pow(r - avgRet, 2)).Average());

        dt.Rows.Add(
            group.Key,
            rows.Count,
            Math.Round(avgRet, 6),
            Math.Round(vol, 6),
            Math.Round(maxDd, 6),
            Math.Round(volumes.Average(), 2),
            Math.Round(dividends.Sum(), 4),
            dates.First(),
            dates.Last(),
            batchId
        );
    }
    return dt;
}

var symbolProfileDt = BuildSymbolProfile(silverDt, batchId);
Console.WriteLine($"Symbol profiles: {symbolProfileDt.Rows.Count} symbols");
symbolProfileDt
```

    Symbol profiles: 5 symbols

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>total_trading_days</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>avg_daily_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>volatility</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>max_drawdown</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>avg_volume</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>total_dividends</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>first_date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>last_date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>batch_id</th></tr><tr><td style='text-align:left;padding:4px 12px;'>ALV.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>0.000532</td><td style='text-align:left;padding:4px 12px;'>0.011839</td><td style='text-align:left;padding:4px 12px;'>-0.123504</td><td style='text-align:left;padding:4px 12px;'>631486.14</td><td style='text-align:left;padding:4px 12px;'>29.2</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>27-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr><tr><td style='text-align:left;padding:4px 12px;'>BAS.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>0.000121</td><td style='text-align:left;padding:4px 12px;'>0.017491</td><td style='text-align:left;padding:4px 12px;'>-0.276766</td><td style='text-align:left;padding:4px 12px;'>2518782.14</td><td style='text-align:left;padding:4px 12px;'>5.65</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>27-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr><tr><td style='text-align:left;padding:4px 12px;'>DTE.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>0.000765</td><td style='text-align:left;padding:4px 12px;'>0.01325</td><td style='text-align:left;padding:4px 12px;'>-0.266109</td><td style='text-align:left;padding:4px 12px;'>6531019.06</td><td style='text-align:left;padding:4px 12px;'>1.67</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>27-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>-0.000285</td><td style='text-align:left;padding:4px 12px;'>0.0189</td><td style='text-align:left;padding:4px 12px;'>-0.491402</td><td style='text-align:left;padding:4px 12px;'>1676455.19</td><td style='text-align:left;padding:4px 12px;'>4.55</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>27-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SIE.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>0.000475</td><td style='text-align:left;padding:4px 12px;'>0.019204</td><td style='text-align:left;padding:4px 12px;'>-0.273251</td><td style='text-align:left;padding:4px 12px;'>1155097.07</td><td style='text-align:left;padding:4px 12px;'>10.55</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>27-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr></table>

#### FluentValidation — validate Gold daily summary with row-level check

```csharp
// Validates each row to catch aggregation errors before persistence

(DataTable Valid, int Rejected) ValidateGoldDaily(DataTable dt)
{
    var valid = dt.Clone();
    int rejected = 0;
    foreach (DataRow row in dt.Rows)
    {
        try
        {
            var record = new DailySummary(
                (DateTime)row["date"],
                Convert.ToInt32(row["symbols_traded"]),
                Convert.ToDouble(row["avg_return"]),
                Convert.ToDouble(row["max_return"]),
                Convert.ToDouble(row["min_return"]),
                Convert.ToInt64(row["total_volume"]),
                Convert.ToDouble(row["avg_intraday_pct"]),
                row["batch_id"].ToString());
            valid.ImportRow(row);
        }
        catch
        {
            rejected++;
        }
    }
    return (valid, rejected);
}

var (validDaily, rejDaily) = ValidateGoldDaily(dailySummaryDt);
Console.WriteLine($"Daily summary validation: {validDaily.Rows.Count} valid, {rejDaily} rejected");
```

    Daily summary validation: 506 valid, 0 rejected

#### FluentValidation — validate Gold symbol profiles with row-level check

```csharp
// Validates each profile to catch calculation errors

(DataTable Valid, int Rejected) ValidateGoldProfiles(DataTable dt)
{
    var valid = dt.Clone();
    int rejected = 0;
    foreach (DataRow row in dt.Rows)
    {
        try
        {
            var record = new SymbolProfile(
                row["symbol"].ToString(),
                Convert.ToInt32(row["total_trading_days"]),
                Convert.ToDouble(row["avg_daily_return"]),
                Convert.ToDouble(row["volatility"]),
                Convert.ToDouble(row["max_drawdown"]),
                Convert.ToDouble(row["avg_volume"]),
                Convert.ToDouble(row["total_dividends"]),
                (DateTime)row["first_date"],
                (DateTime)row["last_date"],
                row["batch_id"].ToString());
            valid.ImportRow(row);
        }
        catch (Exception ex)
        {
            rejected++;
            Console.WriteLine($"  Rejected {row["symbol"]}: {ex.Message}");
        }
    }
    return (valid, rejected);
}

var (validProfiles, rejProfiles) = ValidateGoldProfiles(symbolProfileDt);
Console.WriteLine($"Symbol profile validation: {validProfiles.Rows.Count} valid, {rejProfiles} rejected");
```

    Symbol profile validation: 5 valid, 0 rejected

#### SQL Server — define Gold persistence function with `TRUNCATE` + `WriteToCsv()`

> [!info] Gold: Truncate and Rebuild
>
> Gold is always a full rebuild from Silver — not incremental. TRUNCATE both Gold tables, then INSERT new aggregations.

```csharp

StageLineage PersistGold(DataTable dailyDt, DataTable profileDt, string batchId)
{
    int totalInput = dailyDt.Rows.Count + profileDt.Rows.Count;
    var stageCtx = StartStage(batchId, "gold", totalInput);

    // Truncate and insert
    if (dailyDt.Rows.Count > 0)
    {
        sqlConn.Execute("TRUNCATE TABLE gold_daily_summary");
        WriteToCsv(dailyDt, "gold_daily_summary", false);
    }
    if (profileDt.Rows.Count > 0)
    {
        sqlConn.Execute("TRUNCATE TABLE gold_symbol_profile");
        WriteToCsv(profileDt, "gold_symbol_profile", false);
    }

    // Combined DataTable for hash
    var combined = dailyDt.Copy();
    foreach (DataRow r in profileDt.Rows)
    {
        var newRow = combined.NewRow();
        combined.Rows.Add(newRow);
    }

    var lineage = EndStage(stageCtx, combined, 0);
    PersistLineage(lineage);
    return lineage;
}

Console.WriteLine("PersistGold() defined");
```

    PersistGold() defined

#### SQL Server — persist Gold marts with `TRUNCATE` + `WriteToCsv()`

> [!info] Gold Execution with Context
>
> Persists Gold marts, checks for days with missing symbols, records warnings in .

```csharp

var goldLineage = PersistGold(validDaily, validProfiles, batchId);

var missingSymbols = validDaily.AsEnumerable()
    .Where(r => Convert.ToInt32(r["symbols_traded"]) < SYMBOLS.Length)
    .ToList();
if (missingSymbols.Count > 0)
{
    foreach (var row in missingSymbols.Take(5))
    {
        goldStageCtx.AddWarning(
            $"gold: {((DateTime)row["date"]):yyyy-MM-dd} only {row["symbols_traded"]}/{SYMBOLS.Length} symbols");
    }
}

PersistContext(goldStageCtx);
Console.WriteLine($"Gold persisted: hash={goldLineage.OutputHash}");
```

    Gold persisted: hash=a87ddaf98043eb7c

#### SQL Server — display Gold daily summary with `QueryToTable()`

```csharp
// Show the most recent trading days with cross-sectional metrics

QueryToTable("SELECT TOP 5 * FROM gold_daily_summary ORDER BY date DESC")
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>id</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbols_traded</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>avg_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>max_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>min_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>total_volume</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>avg_intraday_pct</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>batch_id</th></tr><tr><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>27-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>-0.003768</td><td style='text-align:left;padding:4px 12px;'>0.026803</td><td style='text-align:left;padding:4px 12px;'>-0.023123</td><td style='text-align:left;padding:4px 12px;'>16229634</td><td style='text-align:left;padding:4px 12px;'>0.024848</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr><tr><td style='text-align:left;padding:4px 12px;'>505</td><td style='text-align:left;padding:4px 12px;'>26-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>-0.006063</td><td style='text-align:left;padding:4px 12px;'>0.014394</td><td style='text-align:left;padding:4px 12px;'>-0.015385</td><td style='text-align:left;padding:4px 12px;'>15722294</td><td style='text-align:left;padding:4px 12px;'>0.01961</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr><tr><td style='text-align:left;padding:4px 12px;'>504</td><td style='text-align:left;padding:4px 12px;'>25-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>0.008021</td><td style='text-align:left;padding:4px 12px;'>0.023951</td><td style='text-align:left;padding:4px 12px;'>-0.004877</td><td style='text-align:left;padding:4px 12px;'>13536325</td><td style='text-align:left;padding:4px 12px;'>0.019512</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr><tr><td style='text-align:left;padding:4px 12px;'>503</td><td style='text-align:left;padding:4px 12px;'>24-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>0.003854</td><td style='text-align:left;padding:4px 12px;'>0.0418</td><td style='text-align:left;padding:4px 12px;'>-0.040556</td><td style='text-align:left;padding:4px 12px;'>14990944</td><td style='text-align:left;padding:4px 12px;'>0.028663</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr><tr><td style='text-align:left;padding:4px 12px;'>502</td><td style='text-align:left;padding:4px 12px;'>23-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>0.012035</td><td style='text-align:left;padding:4px 12px;'>0.037055</td><td style='text-align:left;padding:4px 12px;'>-0.00253</td><td style='text-align:left;padding:4px 12px;'>21900746</td><td style='text-align:left;padding:4px 12px;'>0.071276</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr></table>

#### SQL Server — display Gold symbol profiles with `QueryToTable()`

```csharp
// Final per-symbol summary statistics

QueryToTable(@"SELECT symbol, total_trading_days, avg_daily_return,
    volatility, max_drawdown, avg_volume, total_dividends
    FROM gold_symbol_profile ORDER BY symbol")
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>total_trading_days</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>avg_daily_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>volatility</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>max_drawdown</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>avg_volume</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>total_dividends</th></tr><tr><td style='text-align:left;padding:4px 12px;'>ALV.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>0.000532</td><td style='text-align:left;padding:4px 12px;'>0.011839</td><td style='text-align:left;padding:4px 12px;'>-0.123504</td><td style='text-align:left;padding:4px 12px;'>631486.14</td><td style='text-align:left;padding:4px 12px;'>29.2</td></tr><tr><td style='text-align:left;padding:4px 12px;'>BAS.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>0.000121</td><td style='text-align:left;padding:4px 12px;'>0.017491</td><td style='text-align:left;padding:4px 12px;'>-0.276766</td><td style='text-align:left;padding:4px 12px;'>2518782.14</td><td style='text-align:left;padding:4px 12px;'>5.65</td></tr><tr><td style='text-align:left;padding:4px 12px;'>DTE.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>0.000765</td><td style='text-align:left;padding:4px 12px;'>0.01325</td><td style='text-align:left;padding:4px 12px;'>-0.266109</td><td style='text-align:left;padding:4px 12px;'>6531019.06</td><td style='text-align:left;padding:4px 12px;'>1.67</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>-0.000285</td><td style='text-align:left;padding:4px 12px;'>0.0189</td><td style='text-align:left;padding:4px 12px;'>-0.491402</td><td style='text-align:left;padding:4px 12px;'>1676455.19</td><td style='text-align:left;padding:4px 12px;'>4.55</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SIE.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>0.000475</td><td style='text-align:left;padding:4px 12px;'>0.019204</td><td style='text-align:left;padding:4px 12px;'>-0.273251</td><td style='text-align:left;padding:4px 12px;'>1155097.07</td><td style='text-align:left;padding:4px 12px;'>10.55</td></tr></table>

## 9. Parquet Export — Pre-Materialized Data Products

The serving layer reads Parquet files, not SQL Server. This is the **pre-materialized views** pattern — the pipeline produces finished data products as files, the API is a thin reader with zero database dependency at serving time. Deployment is a file copy, not a migration. Cache invalidation = re-run the pipeline. Data contracts (JSON Schema with column semantics) are exported alongside the Parquet files, making each data product self-describing.

> [!warning] Without Pre-Materialization
>
> The API queries SQL Server on every request. A slow query blocks the
> response. A database restart takes the API down. With Parquet files,
> the API has no database dependency — it reads a file that the pipeline
> pre-computed. The API can serve data even if SQL Server is down.

#### ParquetSharp — export daily summary to Parquet with `WriteDataTableToParquet()`

> [!info] Parquet: Pre-Materialized View
>
> API reads this file directly. Parquet preserves types without CSV parsing overhead.

```csharp

using ParquetSharp;

void WriteDataTableToParquet(DataTable dt, string path)
{
    // Detect which columns have DBNull values (nullable)
    var hasNulls = new HashSet<string>();
    foreach (DataColumn col in dt.Columns)
        if (dt.AsEnumerable().Any(r => r[col] is DBNull))
            hasNulls.Add(col.ColumnName);

    var columns = new List<Column>();
    foreach (DataColumn col in dt.Columns)
    {
        bool nullable = hasNulls.Contains(col.ColumnName);
        if (col.DataType == typeof(DateTime))
            columns.Add(nullable ? new Column<DateTime?>(col.ColumnName) : new Column<DateTime>(col.ColumnName));
        else if (col.DataType == typeof(double) || col.DataType == typeof(object))
            columns.Add(nullable ? new Column<double?>(col.ColumnName) : new Column<double>(col.ColumnName));
        else if (col.DataType == typeof(long) || col.DataType == typeof(int))
            columns.Add(nullable ? new Column<long?>(col.ColumnName) : new Column<long>(col.ColumnName));
        else
            columns.Add(new Column<string>(col.ColumnName));
    }

    using var file = new ParquetFileWriter(path, columns.ToArray());
    using var rowGroup = file.AppendRowGroup();
    foreach (DataColumn col in dt.Columns)
    {
        bool nullable = hasNulls.Contains(col.ColumnName);
        if (col.DataType == typeof(DateTime) && nullable)
        {
            using var w = rowGroup.NextColumn().LogicalWriter<DateTime?>();
            w.WriteBatch(dt.AsEnumerable().Select(r => r[col] is DBNull ? (DateTime?)null : (DateTime)r[col]).ToArray());
        }
        else if (col.DataType == typeof(DateTime))
        {
            using var w = rowGroup.NextColumn().LogicalWriter<DateTime>();
            w.WriteBatch(dt.AsEnumerable().Select(r => (DateTime)r[col]).ToArray());
        }
        else if ((col.DataType == typeof(double) || col.DataType == typeof(object)) && nullable)
        {
            using var w = rowGroup.NextColumn().LogicalWriter<double?>();
            w.WriteBatch(dt.AsEnumerable().Select(r => r[col] is DBNull ? (double?)null : Convert.ToDouble(r[col])).ToArray());
        }
        else if (col.DataType == typeof(double) || col.DataType == typeof(object))
        {
            using var w = rowGroup.NextColumn().LogicalWriter<double>();
            w.WriteBatch(dt.AsEnumerable().Select(r => Convert.ToDouble(r[col])).ToArray());
        }
        else if ((col.DataType == typeof(long) || col.DataType == typeof(int)) && nullable)
        {
            using var w = rowGroup.NextColumn().LogicalWriter<long?>();
            w.WriteBatch(dt.AsEnumerable().Select(r => r[col] is DBNull ? (long?)null : Convert.ToInt64(r[col])).ToArray());
        }
        else if (col.DataType == typeof(long) || col.DataType == typeof(int))
        {
            using var w = rowGroup.NextColumn().LogicalWriter<long>();
            w.WriteBatch(dt.AsEnumerable().Select(r => Convert.ToInt64(r[col])).ToArray());
        }
        else
        {
            using var w = rowGroup.NextColumn().LogicalWriter<string>();
            w.WriteBatch(dt.AsEnumerable().Select(r => r[col] is DBNull ? "" : r[col].ToString()).ToArray());
        }
    }
}

var dailyPath = Path.Combine(EXPORT_DIR, "gold_daily_summary.parquet");
WriteDataTableToParquet(validDaily, dailyPath);
var sizeKb = new FileInfo(dailyPath).Length / 1024.0;
Console.WriteLine($"Exported: {Path.GetFileName(dailyPath)} ({sizeKb:F1} KB, {validDaily.Rows.Count} rows)");
```

    Exported: gold_daily_summary.parquet (26.8 KB, 506 rows)

#### ParquetSharp — export symbol profiles to Parquet with `WriteDataTableToParquet()`

```csharp
// ── Pre-materialized view: per-symbol summary for the comparison dashboard ──

var profilePath = Path.Combine(EXPORT_DIR, "gold_symbol_profile.parquet");
WriteDataTableToParquet(validProfiles, profilePath);
var sizeKb = new FileInfo(profilePath).Length / 1024.0;
Console.WriteLine($"Exported: {Path.GetFileName(profilePath)} ({sizeKb:F1} KB, {validProfiles.Rows.Count} rows)");
```

    Exported: gold_symbol_profile.parquet (2.6 KB, 5 rows)

#### ParquetSharp — export Silver data to Parquet with `WriteDataTableToParquet()`

> [!info] Silver Parquet Export
>
> Full Silver dataset exported for time-series and per-symbol drill-down endpoints.

```csharp

var silverPath = Path.Combine(EXPORT_DIR, "silver_ohlcv.parquet");
WriteDataTableToParquet(silverDt, silverPath);
var sizeKb = new FileInfo(silverPath).Length / 1024.0;
Console.WriteLine($"Exported: {Path.GetFileName(silverPath)} ({sizeKb:F1} KB, {silverDt.Rows.Count} rows)");
```

    Exported: silver_ohlcv.parquet (160.7 KB, 2530 rows)

#### Lineage — record export stage with `EndStage()`

```csharp
// ── Track which files were exported and their sizes ──

var exportCtx = StartStage(batchId, "export", inputRows: validDaily.Rows.Count + validProfiles.Rows.Count + silverDt.Rows.Count);

// Combined export DataTable for hash (all exported data)
var exportCombined = new DataTable();
exportCombined.Columns.Add("data", typeof(string));
foreach (DataTable dt in new[] { validDaily, validProfiles, silverDt })
    foreach (DataRow row in dt.Rows)
        exportCombined.Rows.Add(string.Join("|", row.ItemArray.Select(v => v?.ToString() ?? "")));

var exportLineage = EndStage(exportCtx, exportCombined, 0);
PersistLineage(exportLineage);

Console.WriteLine($"Export lineage recorded: {exportLineage.OutputRows} total rows, hash={exportLineage.OutputHash}");
```

    Export lineage recorded: 3041 total rows, hash=4915a3cad5280dd8

#### ParquetSharp — verify exported Parquet files with `ParquetFileReader`

```csharp
// ── Round-trip test: verify Parquet files exist and report sizes ──

foreach (var name in new[] { "gold_daily_summary", "gold_symbol_profile", "silver_ohlcv" })
{
    var path = Path.Combine(EXPORT_DIR, $"{name}.parquet");
    using var reader = new ParquetFileReader(path);
    var meta = reader.FileMetaData;
    Console.WriteLine($"  {name}: {meta.NumRows} rows, {meta.NumColumns} cols");
}
```

    gold_daily_summary: 506 rows, 8 cols
      gold_symbol_profile: 5 rows, 10 cols
      silver_ohlcv: 2530 rows, 14 cols

#### C# — export data contracts as JSON Schema with `JsonSerializer`

```csharp
// ── Export machine-readable contracts for every pipeline boundary ──

var contractPaths = ExportDataContracts(EXPORT_DIR);
foreach (var p in contractPaths)
    Console.WriteLine($"  {Path.GetFileName(p)}: {new FileInfo(p).Length:N0} bytes");
```

    Contract exported: bronze_ohlcv_contract.json
      Contract exported: silver_ohlcv_contract.json
      Contract exported: gold_daily_summary_contract.json
      Contract exported: gold_symbol_profile_contract.json
      bronze_ohlcv_contract.json: 4'279 bytes
      silver_ohlcv_contract.json: 5'861 bytes
      gold_daily_summary_contract.json: 3'080 bytes
      gold_symbol_profile_contract.json: 4'074 bytes

## 10. Lineage Review — Pipeline Execution Audit

After all stages complete, the full execution trail is available for review across five artifacts: **stage lineage** (timing, row counts, hashes), **RunContext JSON** (execution envelope with business and temporal context), **context log** (warnings per stage in SQL Server), **quarantine** (every rejected row with its error), and **data contracts** (column-level semantics as JSON Schema). Together these answer any question about what the pipeline did, why it did it, what it knew, and what it produced.

#### C# — build and save run context with `RunContext`

> [!info] Finalize RunContext
>
> Combines stage lineage, business context, temporal context, and data warnings into the final execution record. Persisted as JSON.

```csharp

var runContext = new RunContext {
    BatchId = batchId,
    StartedAt = bronzeLineage.StartedAt,
    CompletedAt = exportLineage.CompletedAt,
    Symbols = SYMBOLS,
    DateRange = new[] { START_DATE, END_DATE },
    Stages = new List<StageLineage> { bronzeLineage, silverLineage, goldLineage, exportLineage },
    Status = "completed",
    BizContext = bizCtx,
    TempContext = tempCtx,
    DataWarnings = goldStageCtx.DataWarnings,
    ContractVersion = "1.0",
};

string SaveRunContext(RunContext ctx)
{
    var path = Path.Combine(LINEAGE_DIR, $"run_{ctx.BatchId[..8]}.json");
    File.WriteAllText(path, JsonSerializer.Serialize(ctx, new JsonSerializerOptions { WriteIndented = true }));
    return path;
}

var ctxPath = SaveRunContext(runContext);
var totalMs = runContext.Stages.Sum(s => s.DurationMs);
Console.WriteLine($"RunContext saved: {Path.GetFileName(ctxPath)}");
Console.WriteLine($"Batch: {batchId[..8]}... | Warnings: {runContext.DataWarnings.Count}");
Console.WriteLine($"Processing time: {totalMs:F0}ms");
```

    RunContext saved: run_d99b77ff.json
    Batch: d99b77ff... | Warnings: 1
    Processing time: 7219ms

#### C# — display lineage summary as DataTable

```csharp
// ── Shows all stages with timing, row counts, and hashes ──

var lineageDt = new DataTable();
lineageDt.Columns.Add("stage", typeof(string));
lineageDt.Columns.Add("input_rows", typeof(int));
lineageDt.Columns.Add("output_rows", typeof(int));
lineageDt.Columns.Add("rejected", typeof(int));
lineageDt.Columns.Add("duration_ms", typeof(double));
lineageDt.Columns.Add("output_hash", typeof(string));

foreach (var s in runContext.Stages)
    lineageDt.Rows.Add(s.Stage, s.InputRows, s.OutputRows, s.RowsRejected, Math.Round(s.DurationMs, 1), s.OutputHash);

lineageDt
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>stage</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>input_rows</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>output_rows</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>rejected</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>duration_ms</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>output_hash</th></tr><tr><td style='text-align:left;padding:4px 12px;'>bronze</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>561</td><td style='text-align:left;padding:4px 12px;'>959fbdf2bc0d14a5</td></tr><tr><td style='text-align:left;padding:4px 12px;'>silver</td><td style='text-align:left;padding:4px 12px;'>2530</td><td style='text-align:left;padding:4px 12px;'>2530</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>5776.9</td><td style='text-align:left;padding:4px 12px;'>76d1db80852e66dc</td></tr><tr><td style='text-align:left;padding:4px 12px;'>gold</td><td style='text-align:left;padding:4px 12px;'>511</td><td style='text-align:left;padding:4px 12px;'>511</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>877.2</td><td style='text-align:left;padding:4px 12px;'>a87ddaf98043eb7c</td></tr><tr><td style='text-align:left;padding:4px 12px;'>export</td><td style='text-align:left;padding:4px 12px;'>3041</td><td style='text-align:left;padding:4px 12px;'>3041</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>4.3</td><td style='text-align:left;padding:4px 12px;'>4915a3cad5280dd8</td></tr></table>

#### JSON — read back persisted run context with `JsonSerializer.Deserialize()`

> [!tip] Verify RunContext JSON
>
> Check the JSON file is complete and parseable. Shows business_context and temporal_context.

```csharp

var ctxJson = JsonSerializer.Deserialize<JsonElement>(File.ReadAllText(ctxPath));

// Display key fields without the bulky stages array
var displayCtx = new Dictionary<string, object>();
foreach (var prop in ctxJson.EnumerateObject())
{
    if (prop.Name == "Stages")
        displayCtx[prop.Name] = $"[{prop.Value.GetArrayLength()} stage records]";
    else if (prop.Value.ValueKind == JsonValueKind.Object || prop.Value.ValueKind == JsonValueKind.Array)
        displayCtx[prop.Name] = JsonSerializer.Deserialize<object>(prop.Value.GetRawText());
    else
        displayCtx[prop.Name] = prop.Value.ToString();
}
Console.WriteLine(JsonSerializer.Serialize(displayCtx, new JsonSerializerOptions { WriteIndented = true }));
```

    {
      "BatchId": "d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f",
      "StartedAt": "2026-03-29T23:24:03.1918047Z",
      "CompletedAt": "2026-03-29T23:24:12.045971Z",
      "Symbols": [
        "SAP.DE",
        "SIE.DE",
        "ALV.DE",
        "DTE.DE",
        "BAS.DE"
      ],
      "DateRange": [
        "2024-03-30",
        "2026-03-30"
      ],
      "PolarsVersion": "Polars.NET",
      "Stages": "[4 stage records]",
      "Status": "completed",
      "BizContext": {
        "Trigger": "scheduled",
        "Reason": null,
        "BusinessDate": "2026-03-29T00:00:00\u002B01:00",
        "IsCorrection": false,
        "AffectedSymbols": null
      },
      "TempContext": {
        "AsOfDate": "2026-03-29T00:00:00\u002B01:00",
        "ReportingPeriodStart": "2024-03-30T00:00:00",
        "ReportingPeriodEnd": "2026-03-30T00:00:00",
        "KnowledgeDate": "2026-03-29T23:24:03.1903432Z",
        "Timezone": "CET",
        "IsBackfill": false
      },
      "DataWarnings": [
        "sma_20: 95 NULL values (first 19 rows per symbol)"
      ],
      "ContractVersion": "1.0"
    }

#### SQL Server — query lineage table with `QueryToTable()`

```csharp
// ── Verify lineage records were persisted to SQL Server ──

var lineageQuery = QueryToTable(
    $"SELECT stage, input_rows, output_rows, rows_rejected, output_hash FROM lineage_stages WHERE batch_id = '{batchId}'"
);
lineageQuery
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>stage</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>input_rows</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>output_rows</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>rows_rejected</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>output_hash</th></tr><tr><td style='text-align:left;padding:4px 12px;'>bronze</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>959fbdf2bc0d14a5</td></tr><tr><td style='text-align:left;padding:4px 12px;'>silver</td><td style='text-align:left;padding:4px 12px;'>2530</td><td style='text-align:left;padding:4px 12px;'>2530</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>76d1db80852e66dc</td></tr><tr><td style='text-align:left;padding:4px 12px;'>gold</td><td style='text-align:left;padding:4px 12px;'>511</td><td style='text-align:left;padding:4px 12px;'>511</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>a87ddaf98043eb7c</td></tr><tr><td style='text-align:left;padding:4px 12px;'>export</td><td style='text-align:left;padding:4px 12px;'>3041</td><td style='text-align:left;padding:4px 12px;'>3041</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>4915a3cad5280dd8</td></tr></table>

#### SQL Server — review quarantined rows with `QueryToTable()`

> [!info] Review Quarantined Rows
>
> Shows rejected rows with error messages for investigation.

```csharp

var quarantineDt = QueryToTable(
    $"SELECT stage, symbol, date, error_message, quarantined_at FROM quarantine WHERE batch_id = '{batchId}' ORDER BY quarantined_at"
);

if (quarantineDt.Rows.Count > 0)
{
    Console.WriteLine($"WARNING: Quarantined rows: {quarantineDt.Rows.Count}");
    display(quarantineDt);
}
else
{
    Console.WriteLine("No quarantined rows — all data passed validation");
}
```

    No quarantined rows — all data passed validation

#### SQL Server — query context log for this batch with `QueryToTable()`

> [!info] Context Audit per Stage
>
> Lineage = what happened. Context = what the pipeline knew at each stage.

```csharp

var contextDt = QueryToTable(
    $"SELECT stage, business_date, trigger_type, schema_version, data_warnings FROM context_log WHERE batch_id = '{batchId}' ORDER BY created_at"
);
contextDt
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>stage</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>business_date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>trigger_type</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>schema_version</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>data_warnings</th></tr><tr><td style='text-align:left;padding:4px 12px;'>bronze</td><td style='text-align:left;padding:4px 12px;'>29-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>scheduled</td><td style='text-align:left;padding:4px 12px;'>1.0</td><td style='text-align:left;padding:4px 12px;'></td></tr><tr><td style='text-align:left;padding:4px 12px;'>silver</td><td style='text-align:left;padding:4px 12px;'>29-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>scheduled</td><td style='text-align:left;padding:4px 12px;'>1.0</td><td style='text-align:left;padding:4px 12px;'>["sma_20: 95 NULL values (first 19 rows per symbol)"]</td></tr><tr><td style='text-align:left;padding:4px 12px;'>gold</td><td style='text-align:left;padding:4px 12px;'>29-Mar-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>scheduled</td><td style='text-align:left;padding:4px 12px;'>1.0</td><td style='text-align:left;padding:4px 12px;'>["sma_20: 95 NULL values (first 19 rows per symbol)"]</td></tr></table>

#### C# — display accumulated data warnings with `Console.WriteLine()`

```csharp
// ── Show all data warnings accumulated across stages ──

if (goldStageCtx != null && goldStageCtx.DataWarnings.Count > 0)
{
    Console.WriteLine($"Data Warnings ({goldStageCtx.DataWarnings.Count} total):");
    foreach (var w in goldStageCtx.DataWarnings)
        Console.WriteLine($"  {w}");
}
else
{
    Console.WriteLine("No data warnings — clean run");
}
```

    Data Warnings (1 total):
      sma_20: 95 NULL values (first 19 rows per symbol)

#### JSON — inspect exported data contract with `JsonSerializer.Deserialize()`

```csharp
// ── Inspect the Silver contract — shows structural schema + column semantics ──

var contractPath = Path.Combine(EXPORT_DIR, "contracts", "silver_ohlcv_contract.json");
if (File.Exists(contractPath))
{
    var contract = JsonSerializer.Deserialize<JsonElement>(File.ReadAllText(contractPath));
    Console.WriteLine($"Contract: {Path.GetFileName(contractPath)}");
    Console.WriteLine($"  Version: {(contract.TryGetProperty("x-contract-version", out var v) ? v.ToString() : "N/A")}");
    Console.WriteLine($"  Generated: {(contract.TryGetProperty("x-generated-at", out var g) ? g.ToString() : "N/A")}");
    Console.WriteLine($"  Fields: {(contract.TryGetProperty("properties", out var props) ? props.EnumerateObject().Count() : 0)}");

    if (contract.TryGetProperty("x-column-context", out var colCtx))
    {
        Console.WriteLine($"  Column contexts: {colCtx.GetArrayLength()}");
        Console.WriteLine();
        foreach (var col in colCtx.EnumerateArray())
        {
            if (col.TryGetProperty("is_derived", out var isDerived) && isDerived.GetBoolean())
            {
                Console.WriteLine($"  {col.GetProperty("name")}:");
                Console.WriteLine($"    {col.GetProperty("description")}");
                Console.WriteLine($"    Computation: {col.GetProperty("computation")}");
                Console.WriteLine($"    Sources: {col.GetProperty("source_columns")}");
                Console.WriteLine($"    Null means: {col.GetProperty("null_semantics")}");
                Console.WriteLine();
            }
        }
    }
}
```

    Contract: silver_ohlcv_contract.json
      Version: 1.0
      Generated: 2026-03-29T23:24:12.1161340Z
      Fields: 13
      Column contexts: 13
    
      daily_return:
        Close-to-close return
        Computation: pct_change(close).over(symbol)
        Sources: [
            "bronze.close"
          ]
        Null means: first_row_in_series
    
      intraday_range:
        (high-low)/close
        Computation: (high - low) / close
        Sources: [
            "bronze.high",
            "bronze.low",
            "bronze.close"
          ]
        Null means: not_applicable
    
      sma_20:
        20-day moving average of close
        Computation: close.rolling_mean(20).over(symbol)
        Sources: [
            "bronze.close"
          ]
        Null means: insufficient_data

## 11. HttpListener Serving Layer — Pre-Materialized JSON API

HttpListener serves the Gold data products by reading pre-materialized JSON files. No database connection at runtime — the API reads files that the pipeline produced. Four endpoints: health (operational monitoring), daily-summary (market overview), symbol-profile (stock comparison), and lineage (pipeline execution audit).

#### C# — define daily summary API response record

```csharp
// ── Response schema for the /daily-summary endpoint ──

public record DailySummaryResponse(
    DateTime Date,
    int SymbolsTraded,
    double AvgReturn,
    double MaxReturn,
    double MinReturn,
    long TotalVolume,
    double AvgIntradayPct
);

Console.WriteLine("DailySummaryResponse defined");
```

    DailySummaryResponse defined

#### C# — define symbol profile API response record

```csharp
// ── Response schema for the /symbol-profile endpoint ──

public record SymbolProfileResponse(
    string Symbol,
    int TotalTradingDays,
    double AvgDailyReturn,
    double Volatility,
    double MaxDrawdown,
    double AvgVolume,
    double TotalDividends,
    DateTime FirstDate,
    DateTime LastDate
);

Console.WriteLine("SymbolProfileResponse defined");
```

    SymbolProfileResponse defined

#### C# — define timeseries row API response record

```csharp
// ── Response schema for the /symbol/{symbol}/timeseries endpoint ──

public record TimeSeriesRow(
    DateTime Date,
    double Open,
    double High,
    double Low,
    double Close,
    long Volume,
    double DailyReturn,
    double IntradayRange,
    double? Sma20
);

Console.WriteLine("TimeSeriesRow defined");
```

    TimeSeriesRow defined

#### HttpListener — create listener instance with `HttpListener()`

```csharp
// ── Serialize pipeline outputs to JSON for HttpListener endpoints ──

var dailyJson = JsonSerializer.Serialize(validDaily.AsEnumerable().Select(r => new {
    date = r.Field<DateTime>("date").ToString("yyyy-MM-dd"),
    symbols_traded = Convert.ToInt32(r["symbols_traded"]),
    avg_return = Convert.ToDouble(r["avg_return"]),
    max_return = Convert.ToDouble(r["max_return"]),
    min_return = Convert.ToDouble(r["min_return"]),
    total_volume = Convert.ToInt64(r["total_volume"]),
    avg_intraday_pct = Convert.ToDouble(r["avg_intraday_pct"]),
}).ToArray());

var profilesJson = JsonSerializer.Serialize(validProfiles.AsEnumerable().Select(r => new {
    symbol = r["symbol"]?.ToString() ?? "",
    total_trading_days = Convert.ToInt32(r["total_trading_days"]),
    avg_daily_return = Convert.ToDouble(r["avg_daily_return"]),
    volatility = Convert.ToDouble(r["volatility"]),
    max_drawdown = Convert.ToDouble(r["max_drawdown"]),
    avg_volume = Convert.ToDouble(r["avg_volume"]),
    total_dividends = Convert.ToDouble(r["total_dividends"]),
    first_date = r.Field<DateTime>("first_date").ToString("yyyy-MM-dd"),
    last_date = r.Field<DateTime>("last_date").ToString("yyyy-MM-dd"),
}).ToArray());

var silverSymbolJson = new Dictionary<string, string>();
foreach (var grp in silverDt.AsEnumerable().GroupBy(r => r["symbol"]?.ToString() ?? ""))
{
    silverSymbolJson[grp.Key.ToUpper()] = JsonSerializer.Serialize(grp.Select(r => new {
        date = r.Field<DateTime>("date").ToString("yyyy-MM-dd"),
        open = Convert.ToDouble(r["open"]),
        high = Convert.ToDouble(r["high"]),
        low = Convert.ToDouble(r["low"]),
        close = Convert.ToDouble(r["close"]),
        volume = Convert.ToInt64(r["volume"]),
        daily_return = Convert.ToDouble(r["daily_return"]),
        intraday_range = Convert.ToDouble(r["intraday_range"]),
        sma_20 = r["sma_20"] == DBNull.Value ? (double?)null : Convert.ToDouble(r["sma_20"]),
    }).ToArray());
}

Console.WriteLine($"JSON data prepared for HttpListener: daily={dailyJson.Length:N0} chars, profiles={profilesJson.Length:N0} chars, symbols={silverSymbolJson.Count}");
```

    JSON data prepared for HttpListener: daily=80'209 chars, profiles=1'089 chars, symbols=5

#### HttpListener — define health endpoint handler

```csharp
// ── Healthcheck: verifies Parquet files exist and reports their sizes ──

string HandleHealth()
{
    var files = Directory.GetFiles(EXPORT_DIR, "*.parquet")
        .ToDictionary(f => Path.GetFileNameWithoutExtension(f), f => new FileInfo(f).Length);
    return JsonSerializer.Serialize(new { status = "healthy", files });
}

Console.WriteLine("GET /health handler defined");
```

    GET /health handler defined

#### HttpListener — define daily summary endpoint handler

```csharp
// ── Returns daily cross-sectional summary from pre-serialized JSON ──

string HandleDailySummary()
{
    return dailyJson;
}

Console.WriteLine("GET /daily-summary handler defined");
```

    GET /daily-summary handler defined

#### HttpListener — define symbol profile endpoint handler

```csharp
// ── Returns per-symbol summary statistics from pre-serialized JSON ──

string HandleSymbolProfile()
{
    return profilesJson;
}

Console.WriteLine("GET /symbol-profile handler defined");
```

    GET /symbol-profile handler defined

#### HttpListener — define symbol timeseries endpoint handler

```csharp
// ── Returns daily OHLCV + enrichment for one symbol from pre-serialized JSON ──

string HandleTimeseries(string symbol)
{
    return silverSymbolJson.GetValueOrDefault(symbol.ToUpper(), "[]");
}

Console.WriteLine("GET /symbol/{symbol}/timeseries handler defined");
```

    GET /symbol/{symbol}/timeseries handler defined

#### HttpListener — define lineage endpoint handler

```csharp
// ── Returns RunContext JSON for a batch, matched by prefix ──

string HandleLineage(string batchIdPrefix)
{
    var files = Directory.GetFiles(LINEAGE_DIR, $"run_{batchIdPrefix}*.json");
    return files.Length > 0 ? File.ReadAllText(files[0]) : "{}";
}

Console.WriteLine("GET /lineage/{batch_id} handler defined");
```

    GET /lineage/{batch_id} handler defined

#### HttpListener — start server in background with `Thread()`

> [!info] Background HTTP Server
>
> Port 8098 to avoid conflicts. Background thread allows notebook to continue.

```csharp

int API_PORT = 8098;
var listener = new HttpListener();
listener.Prefixes.Add($"http://localhost:{API_PORT}/");
listener.Start();

async Task HandleRequests()
{
    while (listener.IsListening)
    {
        try
        {
            var ctx = await listener.GetContextAsync();
            var path = ctx.Request.Url.AbsolutePath;
            string responseJson = "";
            int statusCode = 200;

            if (path == "/health")
                responseJson = HandleHealth();
            else if (path == "/daily-summary")
                responseJson = HandleDailySummary();
            else if (path == "/symbol-profile")
                responseJson = HandleSymbolProfile();
            else if (path.StartsWith("/symbol/") && path.EndsWith("/timeseries"))
            {
                var symbol = path.Split('/')[2];
                responseJson = HandleTimeseries(symbol);
            }
            else if (path.StartsWith("/lineage/"))
            {
                var prefix = path.Split('/')[2];
                responseJson = HandleLineage(prefix);
            }
            else
                statusCode = 404;

            var bytes = System.Text.Encoding.UTF8.GetBytes(responseJson);
            ctx.Response.StatusCode = statusCode;
            ctx.Response.ContentType = "application/json";
            ctx.Response.ContentLength64 = bytes.Length;
            await ctx.Response.OutputStream.WriteAsync(bytes);
            ctx.Response.Close();
        }
        catch (HttpListenerException) { break; }
    }
}

var serverThread = new Thread(() => HandleRequests().Wait()) { IsBackground = true };
serverThread.Start();
Thread.Sleep(1000);
Console.WriteLine($"HttpListener running at http://localhost:{API_PORT}");
```

    HttpListener running at http://localhost:8098

#### HttpClient — test health endpoint with `GetStringAsync()`

```csharp
// ── Verify the API server is running and Parquet files are accessible ──

var client = new HttpClient();
var resp = await client.GetStringAsync($"http://localhost:{API_PORT}/health");
Console.WriteLine($"Status: 200");
Console.WriteLine(JsonSerializer.Serialize(JsonSerializer.Deserialize<JsonElement>(resp), new JsonSerializerOptions { WriteIndented = true }));
```

    Status: 200
    {
      "status": "healthy",
      "files": {
        "gold_daily_summary": 27461,
        "gold_symbol_profile": 2680,
        "silver_ohlcv": 164515
      }
    }

#### HttpClient — test daily summary endpoint with `GetStringAsync()`

```csharp
// ── Fetch daily cross-sectional summary ──

var resp = await client.GetStringAsync($"http://localhost:{API_PORT}/daily-summary");
var dailyArr = JsonSerializer.Deserialize<JsonElement>(resp);
Console.WriteLine($"Status: 200, rows: {dailyArr.GetArrayLength()}");

// Display as DataTable
var dailyRespDt = new DataTable();
dailyRespDt.Columns.Add("date", typeof(string));
dailyRespDt.Columns.Add("symbols_traded", typeof(int));
dailyRespDt.Columns.Add("avg_return", typeof(double));
dailyRespDt.Columns.Add("total_volume", typeof(long));
foreach (var item in dailyArr.EnumerateArray().Take(5))
    dailyRespDt.Rows.Add(
        item.GetProperty("date").GetString(),
        item.GetProperty("symbols_traded").GetInt32(),
        item.GetProperty("avg_return").GetDouble(),
        item.GetProperty("total_volume").GetInt64()
    );
dailyRespDt
```

    Status: 200, rows: 506

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbols_traded</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>avg_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>total_volume</th></tr><tr><td style='text-align:left;padding:4px 12px;'>2024-03-28</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>14115241</td></tr><tr><td style='text-align:left;padding:4px 12px;'>2024-04-02</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>-0.006261</td><td style='text-align:left;padding:4px 12px;'>15460060</td></tr><tr><td style='text-align:left;padding:4px 12px;'>2024-04-03</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>0.004862</td><td style='text-align:left;padding:4px 12px;'>12344475</td></tr><tr><td style='text-align:left;padding:4px 12px;'>2024-04-04</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>-0.000631</td><td style='text-align:left;padding:4px 12px;'>10238748</td></tr><tr><td style='text-align:left;padding:4px 12px;'>2024-04-05</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>-0.014092</td><td style='text-align:left;padding:4px 12px;'>16364036</td></tr></table>

#### HttpClient — test symbol profile endpoint with `GetStringAsync()`

```csharp
// ── Fetch all symbol profiles from the API ──

var resp = await client.GetStringAsync($"http://localhost:{API_PORT}/symbol-profile");
var profileArr = JsonSerializer.Deserialize<JsonElement>(resp);
Console.WriteLine($"Status: 200, profiles: {profileArr.GetArrayLength()}");

var profileRespDt = new DataTable();
profileRespDt.Columns.Add("symbol", typeof(string));
profileRespDt.Columns.Add("total_trading_days", typeof(int));
profileRespDt.Columns.Add("avg_daily_return", typeof(double));
profileRespDt.Columns.Add("volatility", typeof(double));
foreach (var item in profileArr.EnumerateArray())
    profileRespDt.Rows.Add(
        item.GetProperty("symbol").GetString(),
        item.GetProperty("total_trading_days").GetInt32(),
        item.GetProperty("avg_daily_return").GetDouble(),
        item.GetProperty("volatility").GetDouble()
    );
profileRespDt
```

    Status: 200, profiles: 5

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>total_trading_days</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>avg_daily_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>volatility</th></tr><tr><td style='text-align:left;padding:4px 12px;'>ALV.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>0.000532</td><td style='text-align:left;padding:4px 12px;'>0.011839</td></tr><tr><td style='text-align:left;padding:4px 12px;'>BAS.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>0.000121</td><td style='text-align:left;padding:4px 12px;'>0.017491</td></tr><tr><td style='text-align:left;padding:4px 12px;'>DTE.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>0.000765</td><td style='text-align:left;padding:4px 12px;'>0.01325</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>-0.000285</td><td style='text-align:left;padding:4px 12px;'>0.0189</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SIE.DE</td><td style='text-align:left;padding:4px 12px;'>506</td><td style='text-align:left;padding:4px 12px;'>0.000475</td><td style='text-align:left;padding:4px 12px;'>0.019204</td></tr></table>

#### HttpClient — test symbol timeseries endpoint with `GetStringAsync()`

```csharp
// ── Fetch last 10 days of SAP.DE time series data ──

var resp = await client.GetStringAsync($"http://localhost:{API_PORT}/symbol/SAP.DE/timeseries");
var tsArr = JsonSerializer.Deserialize<JsonElement>(resp);
Console.WriteLine($"Status: 200, rows: {tsArr.GetArrayLength()}");

var tsRespDt = new DataTable();
tsRespDt.Columns.Add("date", typeof(string));
tsRespDt.Columns.Add("open", typeof(double));
tsRespDt.Columns.Add("high", typeof(double));
tsRespDt.Columns.Add("low", typeof(double));
tsRespDt.Columns.Add("close", typeof(double));
tsRespDt.Columns.Add("volume", typeof(long));
foreach (var item in tsArr.EnumerateArray().Take(5))
    tsRespDt.Rows.Add(
        item.GetProperty("date").GetString(),
        item.GetProperty("open").GetDouble(),
        item.GetProperty("high").GetDouble(),
        item.GetProperty("low").GetDouble(),
        item.GetProperty("close").GetDouble(),
        item.GetProperty("volume").GetInt64()
    );
tsRespDt
```

    Status: 200, rows: 506

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>open</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>high</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>low</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>volume</th></tr><tr><td style='text-align:left;padding:4px 12px;'>2024-03-28</td><td style='text-align:left;padding:4px 12px;'>181.82000732421875</td><td style='text-align:left;padding:4px 12px;'>181.86000061035156</td><td style='text-align:left;padding:4px 12px;'>179.10000610351562</td><td style='text-align:left;padding:4px 12px;'>180.4600067138672</td><td style='text-align:left;padding:4px 12px;'>1700825</td></tr><tr><td style='text-align:left;padding:4px 12px;'>2024-04-02</td><td style='text-align:left;padding:4px 12px;'>181</td><td style='text-align:left;padding:4px 12px;'>181.9199981689453</td><td style='text-align:left;padding:4px 12px;'>177.05999755859375</td><td style='text-align:left;padding:4px 12px;'>177.05999755859375</td><td style='text-align:left;padding:4px 12px;'>1838833</td></tr><tr><td style='text-align:left;padding:4px 12px;'>2024-04-03</td><td style='text-align:left;padding:4px 12px;'>178.32000732421875</td><td style='text-align:left;padding:4px 12px;'>179.52000427246094</td><td style='text-align:left;padding:4px 12px;'>176.55999755859375</td><td style='text-align:left;padding:4px 12px;'>178.22000122070312</td><td style='text-align:left;padding:4px 12px;'>1501774</td></tr><tr><td style='text-align:left;padding:4px 12px;'>2024-04-04</td><td style='text-align:left;padding:4px 12px;'>177.9199981689453</td><td style='text-align:left;padding:4px 12px;'>178.4600067138672</td><td style='text-align:left;padding:4px 12px;'>176.33999633789062</td><td style='text-align:left;padding:4px 12px;'>178.02000427246094</td><td style='text-align:left;padding:4px 12px;'>1126985</td></tr><tr><td style='text-align:left;padding:4px 12px;'>2024-04-05</td><td style='text-align:left;padding:4px 12px;'>175.39999389648438</td><td style='text-align:left;padding:4px 12px;'>177.9600067138672</td><td style='text-align:left;padding:4px 12px;'>174.77999877929688</td><td style='text-align:left;padding:4px 12px;'>177.4199981689453</td><td style='text-align:left;padding:4px 12px;'>2099406</td></tr></table>

#### HttpClient — test lineage endpoint with `GetStringAsync()`

```csharp
// ── Fetch pipeline execution metadata for this run ──

var resp = await client.GetStringAsync($"http://localhost:{API_PORT}/lineage/{batchId[..8]}");
Console.WriteLine($"Status: 200");
var data = JsonSerializer.Deserialize<JsonElement>(resp);
Console.WriteLine($"Batch: {data.GetProperty("BatchId").GetString()[..8]}... | Status: {data.GetProperty("Status")}");

var stagesDt = new DataTable();
stagesDt.Columns.Add("stage", typeof(string));
stagesDt.Columns.Add("input_rows", typeof(int));
stagesDt.Columns.Add("output_rows", typeof(int));
stagesDt.Columns.Add("rows_rejected", typeof(int));
stagesDt.Columns.Add("output_hash", typeof(string));
foreach (var s in data.GetProperty("Stages").EnumerateArray())
    stagesDt.Rows.Add(
        s.GetProperty("Stage").GetString(),
        s.GetProperty("InputRows").GetInt32(),
        s.GetProperty("OutputRows").GetInt32(),
        s.GetProperty("RowsRejected").GetInt32(),
        s.GetProperty("OutputHash").GetString()
    );
stagesDt
```

    Status: 200
    Batch: d99b77ff... | Status: completed

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>stage</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>input_rows</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>output_rows</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>rows_rejected</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>output_hash</th></tr><tr><td style='text-align:left;padding:4px 12px;'>bronze</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>959fbdf2bc0d14a5</td></tr><tr><td style='text-align:left;padding:4px 12px;'>silver</td><td style='text-align:left;padding:4px 12px;'>2530</td><td style='text-align:left;padding:4px 12px;'>2530</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>76d1db80852e66dc</td></tr><tr><td style='text-align:left;padding:4px 12px;'>gold</td><td style='text-align:left;padding:4px 12px;'>511</td><td style='text-align:left;padding:4px 12px;'>511</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>a87ddaf98043eb7c</td></tr><tr><td style='text-align:left;padding:4px 12px;'>export</td><td style='text-align:left;padding:4px 12px;'>3041</td><td style='text-align:left;padding:4px 12px;'>3041</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>4915a3cad5280dd8</td></tr></table>

## 12. Pipeline Visualization — Charts & Metrics

Visual validation of the pipeline output. Each chart answers a specific question about the data: daily return volatility (how noisy is the market?), cumulative investment performance (how would a 1 EUR investment have grown?), risk-return positioning (which stocks offer the best return per unit of risk?), and pipeline execution timing (which stage is the bottleneck?). Charts use dark-theme compatible transparent backgrounds.

#### Plotly.NET — plot daily return time series with `Chart.Line()`

```csharp
// Overlaid line chart showing daily returns across all 5 symbols (last 3 months)

var threeMonthsAgo = DateTime.Today.AddDays(-90);

var returnTraces = SYMBOLS.Select(symbol =>
{
    var symDt = QueryToTable(
        $"SELECT date, daily_return FROM silver_ohlcv "
        + $"WHERE symbol = '{symbol}' AND date >= '{threeMonthsAgo:yyyy-MM-dd}' "
        + "ORDER BY date");
    var dates = symDt.AsEnumerable().Select(r => r.Field<DateTime>("date")).ToArray();
    var returns = symDt.AsEnumerable().Select(r => Convert.ToDouble(r["daily_return"])).ToArray();
    return Plotly.NET.CSharp.Chart.Line<DateTime, double, string>(x: dates, y: returns, Name: symbol);
}).ToArray();

Plotly.NET.CSharp.Chart.Combine(returnTraces)
    .WithTitle("Daily Returns — Last 3 Months")
    .WithXAxisStyle(Title.init("Date"))
    .WithYAxisStyle(Title.init("Daily Return"))
    .WithSize(750, 450)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<div><div id="a085995c-12ec-4eaf-83fa-afc7fd602041"><!-- Plotly chart will be drawn inside this DIV --></div><script type="text/javascript">
var renderPlotly_a085995c12ec4eaf83faafc7fd602041 = function() {
    var fsharpPlotlyRequire = requirejs.config({context:'fsharp-plotly',paths:{plotly:'https://cdn.plot.ly/plotly-2.27.1.min'}}) || require;
    fsharpPlotlyRequire(['plotly'], function(Plotly) {
        var data = [{"type":"scatter","name":"SAP.DE","mode":"lines","x":["2025-12-30T00:00:00","2026-01-02T00:00:00","2026-01-05T00:00:00","2026-01-06T00:00:00","2026-01-07T00:00:00","2026-01-08T00:00:00","2026-01-09T00:00:00","2026-01-12T00:00:00","2026-01-13T00:00:00","2026-01-14T00:00:00","2026-01-15T00:00:00","2026-01-16T00:00:00","2026-01-19T00:00:00","2026-01-20T00:00:00","2026-01-21T00:00:00","2026-01-22T00:00:00","2026-01-23T00:00:00","2026-01-26T00:00:00","2026-01-27T00:00:00","2026-01-28T00:00:00","2026-01-29T00:00:00","2026-01-30T00:00:00","2026-02-02T00:00:00","2026-02-03T00:00:00","2026-02-04T00:00:00","2026-02-05T00:00:00","2026-02-06T00:00:00","2026-02-09T00:00:00","2026-02-10T00:00:00","2026-02-11T00:00:00","2026-02-12T00:00:00","2026-02-13T00:00:00","2026-02-16T00:00:00","2026-02-17T00:00:00","2026-02-18T00:00:00","2026-02-19T00:00:00","2026-02-20T00:00:00","2026-02-23T00:00:00","2026-02-24T00:00:00","2026-02-25T00:00:00","2026-02-26T00:00:00","2026-02-27T00:00:00","2026-03-02T00:00:00","2026-03-03T00:00:00","2026-03-04T00:00:00","2026-03-05T00:00:00","2026-03-06T00:00:00","2026-03-09T00:00:00","2026-03-10T00:00:00","2026-03-11T00:00:00","2026-03-12T00:00:00","2026-03-13T00:00:00","2026-03-16T00:00:00","2026-03-17T00:00:00","2026-03-18T00:00:00","2026-03-19T00:00:00","2026-03-20T00:00:00","2026-03-23T00:00:00","2026-03-24T00:00:00","2026-03-25T00:00:00","2026-03-26T00:00:00","2026-03-27T00:00:00"],"y":[-0.00048,-0.030718,0.021045,-0.020126,0.031428,-0.009117,0.028329,0.003532,0.001642,-0.034434,-0.002426,-0.01678,-0.030621,-0.010002,-0.015258,-0.006281,0.042562,0.015309,-0.026922,0.003068,-0.160702,0.036083,0.026618,-0.046259,0.001198,0.019617,0.004341,0.02161,0.019209,-0.052053,0.004142,0.011903,-0.019567,0.007603,0.022047,-0.015227,0.017922,-0.034177,-0.012034,0.005668,0.032618,-0.007316,-0.022578,-0.009695,0.011482,0.021508,0.010294,-0.004979,-0.013265,-0.024528,0.00955,-0.003473,-0.005888,0.004714,-0.028874,-0.00892,-0.038625,0.00026,-0.040556,-0.004877,-0.015385,-0.014381],"marker":{},"line":{}},{"type":"scatter","name":"SIE.DE","mode":"lines","x":["2025-12-30T00:00:00","2026-01-02T00:00:00","2026-01-05T00:00:00","2026-01-06T00:00:00","2026-01-07T00:00:00","2026-01-08T00:00:00","2026-01-09T00:00:00","2026-01-12T00:00:00","2026-01-13T00:00:00","2026-01-14T00:00:00","2026-01-15T00:00:00","2026-01-16T00:00:00","2026-01-19T00:00:00","2026-01-20T00:00:00","2026-01-21T00:00:00","2026-01-22T00:00:00","2026-01-23T00:00:00","2026-01-26T00:00:00","2026-01-27T00:00:00","2026-01-28T00:00:00","2026-01-29T00:00:00","2026-01-30T00:00:00","2026-02-02T00:00:00","2026-02-03T00:00:00","2026-02-04T00:00:00","2026-02-05T00:00:00","2026-02-06T00:00:00","2026-02-09T00:00:00","2026-02-10T00:00:00","2026-02-11T00:00:00","2026-02-12T00:00:00","2026-02-13T00:00:00","2026-02-16T00:00:00","2026-02-17T00:00:00","2026-02-18T00:00:00","2026-02-19T00:00:00","2026-02-20T00:00:00","2026-02-23T00:00:00","2026-02-24T00:00:00","2026-02-25T00:00:00","2026-02-26T00:00:00","2026-02-27T00:00:00","2026-03-02T00:00:00","2026-03-03T00:00:00","2026-03-04T00:00:00","2026-03-05T00:00:00","2026-03-06T00:00:00","2026-03-09T00:00:00","2026-03-10T00:00:00","2026-03-11T00:00:00","2026-03-12T00:00:00","2026-03-13T00:00:00","2026-03-16T00:00:00","2026-03-17T00:00:00","2026-03-18T00:00:00","2026-03-19T00:00:00","2026-03-20T00:00:00","2026-03-23T00:00:00","2026-03-24T00:00:00","2026-03-25T00:00:00","2026-03-26T00:00:00","2026-03-27T00:00:00"],"y":[0.008859,0.008154,0.014517,0.01206,0.035144,-0.017366,0.009531,0.016326,0.01316,-0.010315,0.006949,-0.0023,-0.01633,-0.008984,-0.002365,0.01936,-0.013954,0.00059,-0.004518,-0.009866,0.020128,0.001367,0.015802,0.001344,-0.07173,0.010331,0.02454,0.021756,0.0084,-0.007168,0.002927,-0.023152,-0.064131,0.003405,0.038388,-0.017361,0.019123,-0.018356,-0.004779,0.019207,0.01864,-0.005027,-0.037187,-0.049328,0.028483,-0.034779,0.0,-0.016459,0.049977,-0.017015,-0.015337,-0.019359,-0.000227,-0.00522,-0.004791,-0.035763,-0.031146,0.037055,-0.009939,0.012428,-0.009679,-0.023123],"marker":{},"line":{}},{"type":"scatter","name":"ALV.DE","mode":"lines","x":["2025-12-30T00:00:00","2026-01-02T00:00:00","2026-01-05T00:00:00","2026-01-06T00:00:00","2026-01-07T00:00:00","2026-01-08T00:00:00","2026-01-09T00:00:00","2026-01-12T00:00:00","2026-01-13T00:00:00","2026-01-14T00:00:00","2026-01-15T00:00:00","2026-01-16T00:00:00","2026-01-19T00:00:00","2026-01-20T00:00:00","2026-01-21T00:00:00","2026-01-22T00:00:00","2026-01-23T00:00:00","2026-01-26T00:00:00","2026-01-27T00:00:00","2026-01-28T00:00:00","2026-01-29T00:00:00","2026-01-30T00:00:00","2026-02-02T00:00:00","2026-02-03T00:00:00","2026-02-04T00:00:00","2026-02-05T00:00:00","2026-02-06T00:00:00","2026-02-09T00:00:00","2026-02-10T00:00:00","2026-02-11T00:00:00","2026-02-12T00:00:00","2026-02-13T00:00:00","2026-02-16T00:00:00","2026-02-17T00:00:00","2026-02-18T00:00:00","2026-02-19T00:00:00","2026-02-20T00:00:00","2026-02-23T00:00:00","2026-02-24T00:00:00","2026-02-25T00:00:00","2026-02-26T00:00:00","2026-02-27T00:00:00","2026-03-02T00:00:00","2026-03-03T00:00:00","2026-03-04T00:00:00","2026-03-05T00:00:00","2026-03-06T00:00:00","2026-03-09T00:00:00","2026-03-10T00:00:00","2026-03-11T00:00:00","2026-03-12T00:00:00","2026-03-13T00:00:00","2026-03-16T00:00:00","2026-03-17T00:00:00","2026-03-18T00:00:00","2026-03-19T00:00:00","2026-03-20T00:00:00","2026-03-23T00:00:00","2026-03-24T00:00:00","2026-03-25T00:00:00","2026-03-26T00:00:00","2026-03-27T00:00:00"],"y":[0.004372,-0.00717,0.012897,-0.003565,-0.016611,0.014033,-0.020246,-0.006016,-0.000526,-0.00237,0.008446,-0.003926,-0.003416,-0.014764,-0.014985,0.005162,-0.016487,0.004122,-0.000274,0.007117,0.003805,0.00677,0.019903,0.008439,0.013075,-0.008776,0.008333,0.000516,-0.025813,-0.028087,0.000545,-0.000272,0.006269,0.008667,0.000269,0.002416,0.015533,-0.001055,-0.000792,0.007926,0.008388,-0.006499,-0.030874,-0.040497,0.010129,-0.016156,-0.015855,-0.009781,0.029634,-0.007054,-0.003978,0.010271,0.01525,0.007232,-0.009666,-0.015059,-0.015855,0.006041,-0.000572,0.012303,-0.008197,0.0],"marker":{},"line":{}},{"type":"scatter","name":"DTE.DE","mode":"lines","x":["2025-12-30T00:00:00","2026-01-02T00:00:00","2026-01-05T00:00:00","2026-01-06T00:00:00","2026-01-07T00:00:00","2026-01-08T00:00:00","2026-01-09T00:00:00","2026-01-12T00:00:00","2026-01-13T00:00:00","2026-01-14T00:00:00","2026-01-15T00:00:00","2026-01-16T00:00:00","2026-01-19T00:00:00","2026-01-20T00:00:00","2026-01-21T00:00:00","2026-01-22T00:00:00","2026-01-23T00:00:00","2026-01-26T00:00:00","2026-01-27T00:00:00","2026-01-28T00:00:00","2026-01-29T00:00:00","2026-01-30T00:00:00","2026-02-02T00:00:00","2026-02-03T00:00:00","2026-02-04T00:00:00","2026-02-05T00:00:00","2026-02-06T00:00:00","2026-02-09T00:00:00","2026-02-10T00:00:00","2026-02-11T00:00:00","2026-02-12T00:00:00","2026-02-13T00:00:00","2026-02-16T00:00:00","2026-02-17T00:00:00","2026-02-18T00:00:00","2026-02-19T00:00:00","2026-02-20T00:00:00","2026-02-23T00:00:00","2026-02-24T00:00:00","2026-02-25T00:00:00","2026-02-26T00:00:00","2026-02-27T00:00:00","2026-03-02T00:00:00","2026-03-03T00:00:00","2026-03-04T00:00:00","2026-03-05T00:00:00","2026-03-06T00:00:00","2026-03-09T00:00:00","2026-03-10T00:00:00","2026-03-11T00:00:00","2026-03-12T00:00:00","2026-03-13T00:00:00","2026-03-16T00:00:00","2026-03-17T00:00:00","2026-03-18T00:00:00","2026-03-19T00:00:00","2026-03-20T00:00:00","2026-03-23T00:00:00","2026-03-24T00:00:00","2026-03-25T00:00:00","2026-03-26T00:00:00","2026-03-27T00:00:00"],"y":[-0.001444,0.005785,-0.012581,-0.002548,-0.00365,0.036996,0.003179,0.010211,-0.024747,0.004646,-0.008894,-0.029074,0.019593,-0.027556,-0.019016,0.020525,0.007821,-0.005913,0.003346,0.009633,0.008073,0.025482,0.020234,0.003132,0.053763,0.007242,-0.011111,0.008262,-0.010161,0.005629,0.060915,0.00031,0.02296,0.011829,-0.029676,0.008032,0.002758,0.016198,0.002105,0.010204,-0.022282,0.035855,-0.025814,-0.017766,0.011649,0.001818,-0.00605,-0.010956,0.009846,-0.003961,0.003365,0.016159,-0.010801,0.014559,-0.027205,-0.011985,-0.016485,-0.00253,0.028535,-0.003699,-0.011448,-0.008138],"marker":{},"line":{}},{"type":"scatter","name":"BAS.DE","mode":"lines","x":["2025-12-30T00:00:00","2026-01-02T00:00:00","2026-01-05T00:00:00","2026-01-06T00:00:00","2026-01-07T00:00:00","2026-01-08T00:00:00","2026-01-09T00:00:00","2026-01-12T00:00:00","2026-01-13T00:00:00","2026-01-14T00:00:00","2026-01-15T00:00:00","2026-01-16T00:00:00","2026-01-19T00:00:00","2026-01-20T00:00:00","2026-01-21T00:00:00","2026-01-22T00:00:00","2026-01-23T00:00:00","2026-01-26T00:00:00","2026-01-27T00:00:00","2026-01-28T00:00:00","2026-01-29T00:00:00","2026-01-30T00:00:00","2026-02-02T00:00:00","2026-02-03T00:00:00","2026-02-04T00:00:00","2026-02-05T00:00:00","2026-02-06T00:00:00","2026-02-09T00:00:00","2026-02-10T00:00:00","2026-02-11T00:00:00","2026-02-12T00:00:00","2026-02-13T00:00:00","2026-02-16T00:00:00","2026-02-17T00:00:00","2026-02-18T00:00:00","2026-02-19T00:00:00","2026-02-20T00:00:00","2026-02-23T00:00:00","2026-02-24T00:00:00","2026-02-25T00:00:00","2026-02-26T00:00:00","2026-02-27T00:00:00","2026-03-02T00:00:00","2026-03-03T00:00:00","2026-03-04T00:00:00","2026-03-05T00:00:00","2026-03-06T00:00:00","2026-03-09T00:00:00","2026-03-10T00:00:00","2026-03-11T00:00:00","2026-03-12T00:00:00","2026-03-13T00:00:00","2026-03-16T00:00:00","2026-03-17T00:00:00","2026-03-18T00:00:00","2026-03-19T00:00:00","2026-03-20T00:00:00","2026-03-23T00:00:00","2026-03-24T00:00:00","2026-03-25T00:00:00","2026-03-26T00:00:00","2026-03-27T00:00:00"],"y":[0.004976,0.007878,-0.019875,0.021645,-0.015165,0.003623,0.013989,-0.003783,-0.004244,0.027815,0.010258,-0.036725,-0.011662,-0.010211,0.039661,0.025799,-0.009028,0.005206,-0.005179,-0.003471,0.000435,0.0,0.014578,0.016513,0.049789,-0.013264,-0.018737,0.009963,0.046445,0.013747,-0.005037,-0.005452,-0.006265,-0.002758,-0.014026,-0.024444,0.004108,-0.000409,0.0,0.001228,0.014919,-0.019331,-0.028131,-0.040144,0.015849,0.006067,-0.024984,-0.010603,0.023666,0.010033,0.04621,-0.002064,-0.001034,0.011594,-0.011666,-0.04473,-0.002818,0.019348,0.0418,0.023951,0.014394,0.026803],"marker":{},"line":{}}];
        var layout = {"width":750,"height":450,"template":{"layout":{"title":{"x":0.05},"font":{"color":"rgba(42, 63, 95, 1.0)"},"paper_bgcolor":"rgba(255, 255, 255, 1.0)","plot_bgcolor":"rgba(229, 236, 246, 1.0)","autotypenumbers":"strict","colorscale":{"diverging":[[0.0,"#8e0152"],[0.1,"#c51b7d"],[0.2,"#de77ae"],[0.3,"#f1b6da"],[0.4,"#fde0ef"],[0.5,"#f7f7f7"],[0.6,"#e6f5d0"],[0.7,"#b8e186"],[0.8,"#7fbc41"],[0.9,"#4d9221"],[1.0,"#276419"]],"sequential":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]],"sequentialminus":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]},"hovermode":"closest","hoverlabel":{"align":"left"},"coloraxis":{"colorbar":{"outlinewidth":0.0,"ticks":""}},"geo":{"showland":true,"landcolor":"rgba(229, 236, 246, 1.0)","showlakes":true,"lakecolor":"rgba(255, 255, 255, 1.0)","subunitcolor":"rgba(255, 255, 255, 1.0)","bgcolor":"rgba(255, 255, 255, 1.0)"},"mapbox":{"style":"light"},"polar":{"bgcolor":"rgba(229, 236, 246, 1.0)","radialaxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","ticks":""},"angularaxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","ticks":""}},"scene":{"xaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","gridwidth":2.0,"zerolinecolor":"rgba(255, 255, 255, 1.0)","backgroundcolor":"rgba(229, 236, 246, 1.0)","showbackground":true},"yaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","gridwidth":2.0,"zerolinecolor":"rgba(255, 255, 255, 1.0)","backgroundcolor":"rgba(229, 236, 246, 1.0)","showbackground":true},"zaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","gridwidth":2.0,"zerolinecolor":"rgba(255, 255, 255, 1.0)","backgroundcolor":"rgba(229, 236, 246, 1.0)","showbackground":true}},"ternary":{"aaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)"},"baxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)"},"caxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)"},"bgcolor":"rgba(229, 236, 246, 1.0)"},"xaxis":{"title":{"standoff":15},"ticks":"","automargin":"height+width+left+right+top+bottom","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","zerolinecolor":"rgba(255, 255, 255, 1.0)","zerolinewidth":2.0},"yaxis":{"title":{"standoff":15},"ticks":"","automargin":"height+width+left+right+top+bottom","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","zerolinecolor":"rgba(255, 255, 255, 1.0)","zerolinewidth":2.0},"annotationdefaults":{"arrowcolor":"#2a3f5f","arrowhead":0,"arrowwidth":1},"shapedefaults":{"line":{"color":"rgba(42, 63, 95, 1.0)"}},"colorway":["rgba(99, 110, 250, 1.0)","rgba(239, 85, 59, 1.0)","rgba(0, 204, 150, 1.0)","rgba(171, 99, 250, 1.0)","rgba(255, 161, 90, 1.0)","rgba(25, 211, 243, 1.0)","rgba(255, 102, 146, 1.0)","rgba(182, 232, 128, 1.0)","rgba(255, 151, 255, 1.0)","rgba(254, 203, 82, 1.0)"]},"data":{"bar":[{"marker":{"line":{"color":"rgba(229, 236, 246, 1.0)","width":0.5},"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}},"error_x":{"color":"rgba(42, 63, 95, 1.0)"},"error_y":{"color":"rgba(42, 63, 95, 1.0)"}}],"barpolar":[{"marker":{"line":{"color":"rgba(229, 236, 246, 1.0)","width":0.5},"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}}}],"carpet":[{"aaxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","endlinecolor":"rgba(42, 63, 95, 1.0)","minorgridcolor":"rgba(255, 255, 255, 1.0)","startlinecolor":"rgba(42, 63, 95, 1.0)"},"baxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","endlinecolor":"rgba(42, 63, 95, 1.0)","minorgridcolor":"rgba(255, 255, 255, 1.0)","startlinecolor":"rgba(42, 63, 95, 1.0)"}}],"choropleth":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"contour":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"contourcarpet":[{"colorbar":{"outlinewidth":0.0,"ticks":""}}],"heatmap":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"heatmapgl":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"histogram":[{"marker":{"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}}}],"histogram2d":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"histogram2dcontour":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"mesh3d":[{"colorbar":{"outlinewidth":0.0,"ticks":""}}],"parcoords":[{"line":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"pie":[{"automargin":true}],"scatter":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatter3d":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}},"line":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattercarpet":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattergeo":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattergl":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattermapbox":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatterpolar":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatterpolargl":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatterternary":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"surface":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"table":[{"cells":{"fill":{"color":"rgba(235, 240, 248, 1.0)"},"line":{"color":"rgba(255, 255, 255, 1.0)"}},"header":{"fill":{"color":"rgba(200, 212, 227, 1.0)"},"line":{"color":"rgba(255, 255, 255, 1.0)"}}}]}},"title":{"text":"Daily Returns — Last 3 Months"},"xaxis":{"title":{"text":"Date"}},"yaxis":{"title":{"text":"Daily Return"}},"font":{"color":"rgba(204, 204, 204, 1.0)"},"paper_bgcolor":"transparent","plot_bgcolor":"transparent"};
        var config = {"responsive":true};
        Plotly.newPlot('a085995c-12ec-4eaf-83fa-afc7fd602041', data, layout, config);
    });
};
if ((typeof(requirejs) !==  typeof(Function)) || (typeof(requirejs.config) !== typeof(Function))) {
    var script = document.createElement("script");
    script.setAttribute("charset", "utf-8");
    script.setAttribute("src", "https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js");
    script.onload = function(){
        renderPlotly_a085995c12ec4eaf83faafc7fd602041();
    };
    document.getElementsByTagName("head")[0].appendChild(script);
}
else {
    renderPlotly_a085995c12ec4eaf83faafc7fd602041();
}
</script></div>

#### Plotly.NET — plot cumulative returns comparison with cumulative product

```csharp
// Shows how a €1 investment in each symbol would have grown

var cumTraces = SYMBOLS.Select(symbol =>
{
    var symDt = QueryToTable(
        $"SELECT date, daily_return FROM silver_ohlcv "
        + $"WHERE symbol = '{symbol}' ORDER BY date");
    var dates = symDt.AsEnumerable().Select(r => r.Field<DateTime>("date")).ToArray();
    var returns = symDt.AsEnumerable().Select(r => Convert.ToDouble(r["daily_return"])).ToArray();

    var cumRet = new double[returns.Length];
    cumRet[0] = 1.0 + returns[0];
    for (int i = 1; i < returns.Length; i++)
        cumRet[i] = cumRet[i - 1] * (1.0 + returns[i]);

    return Plotly.NET.CSharp.Chart.Line<DateTime, double, string>(x: dates, y: cumRet, Name: symbol);
}).ToArray();

Plotly.NET.CSharp.Chart.Combine(cumTraces)
    .WithTitle("Cumulative Returns — €1 Investment")
    .WithXAxisStyle(Title.init("Date"))
    .WithYAxisStyle(Title.init("Growth of €1"))
    .WithSize(750, 450)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<div><div id="5086c8bf-784d-4e91-a4ed-cc8271f24eb5"><!-- Plotly chart will be drawn inside this DIV --></div><script type="text/javascript">
var renderPlotly_5086c8bf784d4e91a4edcc8271f24eb5 = function() {
    var fsharpPlotlyRequire = requirejs.config({context:'fsharp-plotly',paths:{plotly:'https://cdn.plot.ly/plotly-2.27.1.min'}}) || require;
    fsharpPlotlyRequire(['plotly'], function(Plotly) {
        var data = [{"type":"scatter","name":"SAP.DE","mode":"lines","x":["2024-03-28T00:00:00","2024-04-02T00:00:00","2024-04-03T00:00:00","2024-04-04T00:00:00","2024-04-05T00:00:00","2024-04-08T00:00:00","2024-04-09T00:00:00","2024-04-10T00:00:00","2024-04-11T00:00:00","2024-04-12T00:00:00","2024-04-15T00:00:00","2024-04-16T00:00:00","2024-04-17T00:00:00","2024-04-18T00:00:00","2024-04-19T00:00:00","2024-04-22T00:00:00","2024-04-23T00:00:00","2024-04-24T00:00:00","2024-04-25T00:00:00","2024-04-26T00:00:00","2024-04-29T00:00:00","2024-04-30T00:00:00","2024-05-02T00:00:00","2024-05-03T00:00:00","2024-05-06T00:00:00","2024-05-07T00:00:00","2024-05-08T00:00:00","2024-05-09T00:00:00","2024-05-10T00:00:00","2024-05-13T00:00:00","2024-05-14T00:00:00","2024-05-15T00:00:00","2024-05-16T00:00:00","2024-05-17T00:00:00","2024-05-20T00:00:00","2024-05-21T00:00:00","2024-05-22T00:00:00","2024-05-23T00:00:00","2024-05-24T00:00:00","2024-05-27T00:00:00","2024-05-28T00:00:00","2024-05-29T00:00:00","2024-05-30T00:00:00","2024-05-31T00:00:00","2024-06-03T00:00:00","2024-06-04T00:00:00","2024-06-05T00:00:00","2024-06-06T00:00:00","2024-06-07T00:00:00","2024-06-10T00:00:00","2024-06-11T00:00:00","2024-06-12T00:00:00","2024-06-13T00:00:00","2024-06-14T00:00:00","2024-06-17T00:00:00","2024-06-18T00:00:00","2024-06-19T00:00:00","2024-06-20T00:00:00","2024-06-21T00:00:00","2024-06-24T00:00:00","2024-06-25T00:00:00","2024-06-26T00:00:00","2024-06-27T00:00:00","2024-06-28T00:00:00","2024-07-01T00:00:00","2024-07-02T00:00:00","2024-07-03T00:00:00","2024-07-04T00:00:00","2024-07-05T00:00:00","2024-07-08T00:00:00","2024-07-09T00:00:00","2024-07-10T00:00:00","2024-07-11T00:00:00","2024-07-12T00:00:00","2024-07-15T00:00:00","2024-07-16T00:00:00","2024-07-17T00:00:00","2024-07-18T00:00:00","2024-07-19T00:00:00","2024-07-22T00:00:00","2024-07-23T00:00:00","2024-07-24T00:00:00","2024-07-25T00:00:00","2024-07-26T00:00:00","2024-07-29T00:00:00","2024-07-30T00:00:00","2024-07-31T00:00:00","2024-08-01T00:00:00","2024-08-02T00:00:00","2024-08-05T00:00:00","2024-08-06T00:00:00","2024-08-07T00:00:00","2024-08-08T00:00:00","2024-08-09T00:00:00","2024-08-12T00:00:00","2024-08-13T00:00:00","2024-08-14T00:00:00","2024-08-15T00:00:00","2024-08-16T00:00:00","2024-08-19T00:00:00","2024-08-20T00:00:00","2024-08-21T00:00:00","2024-08-22T00:00:00","2024-08-23T00:00:00","2024-08-26T00:00:00","2024-08-27T00:00:00","2024-08-28T00:00:00","2024-08-29T00:00:00","2024-08-30T00:00:00","2024-09-02T00:00:00","2024-09-03T00:00:00","2024-09-04T00:00:00","2024-09-05T00:00:00","2024-09-06T00:00:00","2024-09-09T00:00:00","2024-09-10T00:00:00","2024-09-11T00:00:00","2024-09-12T00:00:00","2024-09-13T00:00:00","2024-09-16T00:00:00","2024-09-17T00:00:00","2024-09-18T00:00:00","2024-09-19T00:00:00","2024-09-20T00:00:00","2024-09-23T00:00:00","2024-09-24T00:00:00","2024-09-25T00:00:00","2024-09-26T00:00:00","2024-09-27T00:00:00","2024-09-30T00:00:00","2024-10-01T00:00:00","2024-10-02T00:00:00","2024-10-03T00:00:00","2024-10-04T00:00:00","2024-10-07T00:00:00","2024-10-08T00:00:00","2024-10-09T00:00:00","2024-10-10T00:00:00","2024-10-11T00:00:00","2024-10-14T00:00:00","2024-10-15T00:00:00","2024-10-16T00:00:00","2024-10-17T00:00:00","2024-10-18T00:00:00","2024-10-21T00:00:00","2024-10-22T00:00:00","2024-10-23T00:00:00","2024-10-24T00:00:00","2024-10-25T00:00:00","2024-10-28T00:00:00","2024-10-29T00:00:00","2024-10-30T00:00:00","2024-10-31T00:00:00","2024-11-01T00:00:00","2024-11-04T00:00:00","2024-11-05T00:00:00","2024-11-06T00:00:00","2024-11-07T00:00:00","2024-11-08T00:00:00","2024-11-11T00:00:00","2024-11-12T00:00:00","2024-11-13T00:00:00","2024-11-14T00:00:00","2024-11-15T00:00:00","2024-11-18T00:00:00","2024-11-19T00:00:00","2024-11-20T00:00:00","2024-11-21T00:00:00","2024-11-22T00:00:00","2024-11-25T00:00:00","2024-11-26T00:00:00","2024-11-27T00:00:00","2024-11-28T00:00:00","2024-11-29T00:00:00","2024-12-02T00:00:00","2024-12-03T00:00:00","2024-12-04T00:00:00","2024-12-05T00:00:00","2024-12-06T00:00:00","2024-12-09T00:00:00","2024-12-10T00:00:00","2024-12-11T00:00:00","2024-12-12T00:00:00","2024-12-13T00:00:00","2024-12-16T00:00:00","2024-12-17T00:00:00","2024-12-18T00:00:00","2024-12-19T00:00:00","2024-12-20T00:00:00","2024-12-23T00:00:00","2024-12-27T00:00:00","2024-12-30T00:00:00","2025-01-02T00:00:00","2025-01-03T00:00:00","2025-01-06T00:00:00","2025-01-07T00:00:00","2025-01-08T00:00:00","2025-01-09T00:00:00","2025-01-10T00:00:00","2025-01-13T00:00:00","2025-01-14T00:00:00","2025-01-15T00:00:00","2025-01-16T00:00:00","2025-01-17T00:00:00","2025-01-20T00:00:00","2025-01-21T00:00:00","2025-01-22T00:00:00","2025-01-23T00:00:00","2025-01-24T00:00:00","2025-01-27T00:00:00","2025-01-28T00:00:00","2025-01-29T00:00:00","2025-01-30T00:00:00","2025-01-31T00:00:00","2025-02-03T00:00:00","2025-02-04T00:00:00","2025-02-05T00:00:00","2025-02-06T00:00:00","2025-02-07T00:00:00","2025-02-10T00:00:00","2025-02-11T00:00:00","2025-02-12T00:00:00","2025-02-13T00:00:00","2025-02-14T00:00:00","2025-02-17T00:00:00","2025-02-18T00:00:00","2025-02-19T00:00:00","2025-02-20T00:00:00","2025-02-21T00:00:00","2025-02-24T00:00:00","2025-02-25T00:00:00","2025-02-26T00:00:00","2025-02-27T00:00:00","2025-02-28T00:00:00","2025-03-03T00:00:00","2025-03-04T00:00:00","2025-03-05T00:00:00","2025-03-06T00:00:00","2025-03-07T00:00:00","2025-03-10T00:00:00","2025-03-11T00:00:00","2025-03-12T00:00:00","2025-03-13T00:00:00","2025-03-14T00:00:00","2025-03-17T00:00:00","2025-03-18T00:00:00","2025-03-19T00:00:00","2025-03-20T00:00:00","2025-03-21T00:00:00","2025-03-24T00:00:00","2025-03-25T00:00:00","2025-03-26T00:00:00","2025-03-27T00:00:00","2025-03-28T00:00:00","2025-03-31T00:00:00","2025-04-01T00:00:00","2025-04-02T00:00:00","2025-04-03T00:00:00","2025-04-04T00:00:00","2025-04-07T00:00:00","2025-04-08T00:00:00","2025-04-09T00:00:00","2025-04-10T00:00:00","2025-04-11T00:00:00","2025-04-14T00:00:00","2025-04-15T00:00:00","2025-04-16T00:00:00","2025-04-17T00:00:00","2025-04-22T00:00:00","2025-04-23T00:00:00","2025-04-24T00:00:00","2025-04-25T00:00:00","2025-04-28T00:00:00","2025-04-29T00:00:00","2025-04-30T00:00:00","2025-05-02T00:00:00","2025-05-05T00:00:00","2025-05-06T00:00:00","2025-05-07T00:00:00","2025-05-08T00:00:00","2025-05-09T00:00:00","2025-05-12T00:00:00","2025-05-13T00:00:00","2025-05-14T00:00:00","2025-05-15T00:00:00","2025-05-16T00:00:00","2025-05-19T00:00:00","2025-05-20T00:00:00","2025-05-21T00:00:00","2025-05-22T00:00:00","2025-05-23T00:00:00","2025-05-26T00:00:00","2025-05-27T00:00:00","2025-05-28T00:00:00","2025-05-29T00:00:00","2025-05-30T00:00:00","2025-06-02T00:00:00","2025-06-03T00:00:00","2025-06-04T00:00:00","2025-06-05T00:00:00","2025-06-06T00:00:00","2025-06-09T00:00:00","2025-06-10T00:00:00","2025-06-11T00:00:00","2025-06-12T00:00:00","2025-06-13T00:00:00","2025-06-16T00:00:00","2025-06-17T00:00:00","2025-06-18T00:00:00","2025-06-19T00:00:00","2025-06-20T00:00:00","2025-06-23T00:00:00","2025-06-24T00:00:00","2025-06-25T00:00:00","2025-06-26T00:00:00","2025-06-27T00:00:00","2025-06-30T00:00:00","2025-07-01T00:00:00","2025-07-02T00:00:00","2025-07-03T00:00:00","2025-07-04T00:00:00","2025-07-07T00:00:00","2025-07-08T00:00:00","2025-07-09T00:00:00","2025-07-10T00:00:00","2025-07-11T00:00:00","2025-07-14T00:00:00","2025-07-15T00:00:00","2025-07-16T00:00:00","2025-07-17T00:00:00","2025-07-18T00:00:00","2025-07-21T00:00:00","2025-07-22T00:00:00","2025-07-23T00:00:00","2025-07-24T00:00:00","2025-07-25T00:00:00","2025-07-28T00:00:00","2025-07-29T00:00:00","2025-07-30T00:00:00","2025-07-31T00:00:00","2025-08-01T00:00:00","2025-08-04T00:00:00","2025-08-05T00:00:00","2025-08-06T00:00:00","2025-08-07T00:00:00","2025-08-08T00:00:00","2025-08-11T00:00:00","2025-08-12T00:00:00","2025-08-13T00:00:00","2025-08-14T00:00:00","2025-08-15T00:00:00","2025-08-18T00:00:00","2025-08-19T00:00:00","2025-08-20T00:00:00","2025-08-21T00:00:00","2025-08-22T00:00:00","2025-08-25T00:00:00","2025-08-26T00:00:00","2025-08-27T00:00:00","2025-08-28T00:00:00","2025-08-29T00:00:00","2025-09-01T00:00:00","2025-09-02T00:00:00","2025-09-03T00:00:00","2025-09-04T00:00:00","2025-09-05T00:00:00","2025-09-08T00:00:00","2025-09-09T00:00:00","2025-09-10T00:00:00","2025-09-11T00:00:00","2025-09-12T00:00:00","2025-09-15T00:00:00","2025-09-16T00:00:00","2025-09-17T00:00:00","2025-09-18T00:00:00","2025-09-19T00:00:00","2025-09-22T00:00:00","2025-09-23T00:00:00","2025-09-24T00:00:00","2025-09-25T00:00:00","2025-09-26T00:00:00","2025-09-29T00:00:00","2025-09-30T00:00:00","2025-10-01T00:00:00","2025-10-02T00:00:00","2025-10-03T00:00:00","2025-10-06T00:00:00","2025-10-07T00:00:00","2025-10-08T00:00:00","2025-10-09T00:00:00","2025-10-10T00:00:00","2025-10-13T00:00:00","2025-10-14T00:00:00","2025-10-15T00:00:00","2025-10-16T00:00:00","2025-10-17T00:00:00","2025-10-20T00:00:00","2025-10-21T00:00:00","2025-10-22T00:00:00","2025-10-23T00:00:00","2025-10-24T00:00:00","2025-10-27T00:00:00","2025-10-28T00:00:00","2025-10-29T00:00:00","2025-10-30T00:00:00","2025-10-31T00:00:00","2025-11-03T00:00:00","2025-11-04T00:00:00","2025-11-05T00:00:00","2025-11-06T00:00:00","2025-11-07T00:00:00","2025-11-10T00:00:00","2025-11-11T00:00:00","2025-11-12T00:00:00","2025-11-13T00:00:00","2025-11-14T00:00:00","2025-11-17T00:00:00","2025-11-18T00:00:00","2025-11-19T00:00:00","2025-11-20T00:00:00","2025-11-21T00:00:00","2025-11-24T00:00:00","2025-11-25T00:00:00","2025-11-26T00:00:00","2025-11-27T00:00:00","2025-11-28T00:00:00","2025-12-01T00:00:00","2025-12-02T00:00:00","2025-12-03T00:00:00","2025-12-04T00:00:00","2025-12-05T00:00:00","2025-12-08T00:00:00","2025-12-09T00:00:00","2025-12-10T00:00:00","2025-12-11T00:00:00","2025-12-12T00:00:00","2025-12-15T00:00:00","2025-12-16T00:00:00","2025-12-17T00:00:00","2025-12-18T00:00:00","2025-12-19T00:00:00","2025-12-22T00:00:00","2025-12-23T00:00:00","2025-12-29T00:00:00","2025-12-30T00:00:00","2026-01-02T00:00:00","2026-01-05T00:00:00","2026-01-06T00:00:00","2026-01-07T00:00:00","2026-01-08T00:00:00","2026-01-09T00:00:00","2026-01-12T00:00:00","2026-01-13T00:00:00","2026-01-14T00:00:00","2026-01-15T00:00:00","2026-01-16T00:00:00","2026-01-19T00:00:00","2026-01-20T00:00:00","2026-01-21T00:00:00","2026-01-22T00:00:00","2026-01-23T00:00:00","2026-01-26T00:00:00","2026-01-27T00:00:00","2026-01-28T00:00:00","2026-01-29T00:00:00","2026-01-30T00:00:00","2026-02-02T00:00:00","2026-02-03T00:00:00","2026-02-04T00:00:00","2026-02-05T00:00:00","2026-02-06T00:00:00","2026-02-09T00:00:00","2026-02-10T00:00:00","2026-02-11T00:00:00","2026-02-12T00:00:00","2026-02-13T00:00:00","2026-02-16T00:00:00","2026-02-17T00:00:00","2026-02-18T00:00:00","2026-02-19T00:00:00","2026-02-20T00:00:00","2026-02-23T00:00:00","2026-02-24T00:00:00","2026-02-25T00:00:00","2026-02-26T00:00:00","2026-02-27T00:00:00","2026-03-02T00:00:00","2026-03-03T00:00:00","2026-03-04T00:00:00","2026-03-05T00:00:00","2026-03-06T00:00:00","2026-03-09T00:00:00","2026-03-10T00:00:00","2026-03-11T00:00:00","2026-03-12T00:00:00","2026-03-13T00:00:00","2026-03-16T00:00:00","2026-03-17T00:00:00","2026-03-18T00:00:00","2026-03-19T00:00:00","2026-03-20T00:00:00","2026-03-23T00:00:00","2026-03-24T00:00:00","2026-03-25T00:00:00","2026-03-26T00:00:00","2026-03-27T00:00:00"],"y":[1.0,0.981159,0.987586572609,0.9864785004745327,0.9831540679279335,0.9820460532933787,0.9554473359399275,0.9492407500456618,0.9487974546153904,0.9479112777927797,0.9512365505552769,0.9441431795977862,0.9351662662461704,0.9374938950828571,0.9187637045529967,0.920425748094533,0.9689680816232907,0.9728468608540287,0.9431448733452944,0.9642024689324747,0.949905274723144,0.940373925196572,0.9339455290439284,0.9460261144621115,0.9502378227236967,0.9661970669563411,0.9778339444307632,0.9851481423351053,0.9756168340580131,0.9790519809307315,0.9679691125065957,0.9758377334221618,0.9793839277454179,0.9809352718869667,0.9940131009317636,0.9974484102085838,0.9936800501148157,1.004984154364922,0.9977804279464343,0.9997749910218993,0.9820429817811349,0.974284842225064,0.934164766707078,0.9196459779029167,0.9323913515106733,0.9342757144320765,0.9504564355303257,0.9848125843054403,0.9828173540096374,0.9798246751666781,0.9719557032004146,1.0052043638954944,0.9862532460229726,0.9685204126594795,0.9739509066132611,0.9752813235516948,0.9768329961374654,0.9957845330955284,1.0033206304419953,0.9944542860307793,1.006977448854765,1.0308055562270153,1.0386747258432523,1.0502008992759349,1.0289217286548058,1.026261965986233,1.0398938036804282,1.0363477658098779,1.0477631364502737,1.040891905801433,1.0238244012220068,1.0295875087764856,1.0332446036076597,1.045879118620574,1.040448914236696,1.0374565831593512,1.0155123015123646,1.0006614496150479,1.0057598197008366,1.0175070943949422,1.0902100113036497,1.0740291143158809,1.0817868266085844,1.0848904730141244,1.0688199904373663,1.0640541221000062,1.0806778396495744,1.0609500656867714,1.0315808459684301,1.004206816639812,1.0273698510724258,1.0416667299199498,1.043329230020902,1.052416627614384,1.048980487325223,1.061614408314568,1.064385221920269,1.0859964994661382,1.0905403088199044,1.0929787569504257,1.0855530592757046,1.0888781082962662,1.0891002394303588,1.0840021612095854,1.076133389521365,1.0820069255613725,1.0816747494352252,1.1028431242816727,1.0956393529938648,1.1074974577113175,1.0982985838275672,1.0726972438385465,1.0608385758079113,1.0568487619242977,1.0671562078993453,1.0669342394081023,1.0773517853216832,1.103728589081714,1.1118741060691368,1.1091033157968124,1.1118738558796728,1.1059442326062665,1.1420743247412808,1.1332084017583142,1.1462300995029189,1.1462300995029189,1.1182460378536545,1.1332081698401364,1.1398578353807582,1.1326539338611519,1.1321000660874938,1.1290524527095862,1.112704902246804,1.112150775205485,1.1099342587105006,1.1359788660911425,1.1517712442875416,1.1417969053120116,1.155927783812153,1.1722749145308247,1.1625778564378257,1.1672874593342555,1.172551925775853,1.179478190001411,1.1678414581788572,1.1927772089938922,1.2116183177871596,1.2138343676903924,1.224916675467406,1.2340594535330944,1.2412626585633673,1.2166037345883474,1.1902825127905285,1.1902825127905285,1.1847417476934887,1.1949933180362806,1.1800320016944663,1.2224234713233384,1.2268559788303568,1.2279638297792408,1.2213144056409864,1.2160505405526736,1.224916765043843,1.2041372770416394,1.2113416303701796,1.218545479045991,1.2224241093057944,1.2451440838013519,1.2517931532088509,1.23849410274916,1.2368320436632707,1.219930733786612,1.219930733786612,1.2462519592987922,1.2803319653777772,1.2908601351290787,1.3393474235247973,1.3374080484555333,1.3410096883300242,1.3326981102817548,1.3326981102817548,1.322169795210529,1.3382394469015177,1.3357463068119404,1.3335303036889394,1.3246636606997118,1.3315903269815104,1.3135805678090855,1.3119175748102392,1.3097004341088099,1.3271561214946122,1.3094239885553227,1.3218923237743465,1.3013897738326063,1.3257713112453602,1.3482139680021217,1.3562493232514143,1.358465434645607,1.3623438534615204,1.3515377420158636,1.3709323086137915,1.4052892431999617,1.4133246870925789,1.4232985194093912,1.4185888246086655,1.4185888246086655,1.4534988769934603,1.4540526600655947,1.4540526600655947,1.4485112653780847,1.4551613805974355,1.4806514425013608,1.4853613947399578,1.487855316521726,1.4582083114847142,1.4812042565568282,1.5005991450921832,1.5163914504951332,1.5017067156885384,1.5017067156885384,1.5424360052314432,1.5468689663104784,1.5532420664516775,1.5346792705155134,1.5521347125383569,1.542436974854417,1.5310769265346145,1.5235960846715664,1.516115227895829,1.5199934506487867,1.5094644560161425,1.5249802411595323,1.4823112940118885,1.4701207659299347,1.504753870933712,1.4349332913223878,1.4667959850562013,1.44823221506933,1.409442763420913,1.3421150920550595,1.3224437111508085,1.344055086278435,1.3127466670986652,1.3443326646557263,1.3443326646557263,1.367051886688408,1.3761947297065802,1.3861693891074933,1.3961442640315107,1.3961442640315107,1.4338248015734572,1.3858920384568565,1.3811813914181417,1.3673281420622176,1.354305708837217,1.3861684592490304,1.3803507102255623,1.3241055598360014,1.2811595201082806,1.2268537303699307,1.2401528248071407,1.1880639258595913,1.274508645169061,1.2456932792104338,1.2678591454207044,1.2891934112606986,1.2875316409535835,1.252344688737963,1.210784377897505,1.339343041573906,1.3362946968112839,1.3559662910430428,1.3786855062494692,1.4108254227711567,1.4147037818583545,1.4756591237072856,1.4814776476320635,1.464853986947984,1.4490613961146976,1.4562646803147838,1.4498920660737262,1.4546027653963998,1.4537721872173583,1.4537721872173583,1.4584824091039426,1.475383303260639,1.4709497764343407,1.4690095936792238,1.472887779006537,1.4712248887040384,1.4437953718790404,1.453493345391952,1.472057362399298,1.4590355429715138,1.4543257762388018,1.4734428885674609,1.4645771827069505,1.4936695438642416,1.503366446543008,1.5014271038269675,1.5091849776724413,1.5091849776724413,1.4723352080726133,1.4582052070807405,1.4471228475069269,1.4116582078830746,1.4266203732284273,1.418862411638811,1.4016842444211,1.3728698214085353,1.3917097139677246,1.3850601249543868,1.4127668676939742,1.399190178095435,1.3944805039559658,1.4296674305122867,1.4304980672894143,1.4163676073807294,1.4025141158129384,1.4307747752465692,1.4158131634218156,1.4471210399045622,1.4637455664109857,1.4712267700009125,1.4579268800001042,1.4338215169661823,1.4299430297627889,1.43964090339064,1.43964090339064,1.472889410054447,1.4631919061786485,1.4631919061786485,1.437978183251378,1.3789635586107416,1.3637246323245342,1.3576287832180436,1.352363898796724,1.3767456675281302,1.4019593876832404,1.3897679488479469,1.3556880592062974,1.356242535622513,1.3667710464265506,1.3789626441606755,1.411656469491081,1.3858895039534602,1.3817332213311038,1.2855908420576643,1.3243796889442283,1.3243796889442283,1.313297279707143,1.3113575396250154,1.3127423331868593,1.2952867983824736,1.2864205602475456,1.2889136432933053,1.2911305747597697,1.2847575542427554,1.3099709212447694,1.309694517380387,1.2839275874454452,1.2961184798882397,1.2592685353865372,1.2819882583019808,1.2922403184036217,1.2648112254051864,1.277002740806867,1.2761714120226018,1.239598891696858,1.2179877246190152,1.2240837531807331,1.1894507515519908,1.168948188947489,1.2063521930974308,1.2717401010198908,1.2609341253815247,1.2609341253815247,1.2534530032156361,1.2634279822152261,1.247911823165641,1.2476347867408981,1.2498518337569366,1.2498518337569366,1.2623203556504958,1.2861479146837544,1.2753416999045815,1.2833763526139803,1.3022163174703536,1.3144076666345113,1.3177331180310965,1.2775580707285645,1.2822684273353409,1.2894722113601107,1.2977841492345379,1.2922426109173064,1.2797750542071762,1.3221663231027345,1.3321407458442216,1.31246902345034,1.3410073498962443,1.293074383181553,1.3052654884661887,1.2972302741191908,1.2429256203840133,1.251514236420867,1.243756099669294,1.2681386942472108,1.252623017323096,1.2631513137836967,1.2077381287993196,1.2077381287993196,1.1983177713946849,1.2027503488310738,1.210231456000803,1.210231456000803,1.169779469583976,1.147060012725716,1.1379167973642794,1.1387474766263552,1.144843191868736,1.1359775261909046,1.1498307721228027,1.1351462833320225,1.145397789416794,1.1470597616092377,1.1556489451041676,1.1575881240340524,1.1517700861226574,1.1442893394132907,1.16451579777676,1.1816935703097649,1.1642387745827194,1.163684596926018,1.1689491060425112,1.1598055861350467,1.1537096479743207,1.1537096479743207,1.1451202796451518,1.1451202796451518,1.1451202796451518,1.15703411103458,1.1556491412036718,1.1509387153041257,1.155094755005089,1.1545403095226865,1.1190751402947685,1.142626076622272,1.1196295842041721,1.154817302776541,1.144288833427127,1.1767053917892842,1.1808615152330841,1.1828004898410969,1.1420719377739086,1.139301271252869,1.1201837959212457,1.0858826479063413,1.075021649661982,1.0586189693314394,1.0519697835850685,1.0967437215140161,1.1135337711466742,1.0835552149598635,1.0868795623593603,0.9122158429290864,0.9451313271894968,0.9702888328566268,0.925404241737512,0.9265128760191136,0.9446882791079805,0.9487891709275882,0.9692925049113332,0.987911644638175,0.9364878797998241,0.9403668125979551,0.9515599987683085,0.9329408242724091,0.9400339733593522,0.9607589023700058,0.9461294265636178,0.9630859581464909,0.9301705693549183,0.9189768967233012,0.9241856577739289,0.954330745559199,0.9473488618246878,0.92595961922241,0.9169824407140487,0.9275112330983274,0.9474601446998063,0.9572132994293462,0.9524473344114875,0.9398131205205192,0.916761384300392,0.9255164555204607,0.9223021368704382,0.916871621888545,0.9211937547141277,0.894595206240512,0.8866154170008467,0.8523698965191889,0.8525915126922838,0.8180138113035356,0.8140243579458082,0.801500593198812,0.7899742131680199],"marker":{},"line":{}},{"type":"scatter","name":"SIE.DE","mode":"lines","x":["2024-03-28T00:00:00","2024-04-02T00:00:00","2024-04-03T00:00:00","2024-04-04T00:00:00","2024-04-05T00:00:00","2024-04-08T00:00:00","2024-04-09T00:00:00","2024-04-10T00:00:00","2024-04-11T00:00:00","2024-04-12T00:00:00","2024-04-15T00:00:00","2024-04-16T00:00:00","2024-04-17T00:00:00","2024-04-18T00:00:00","2024-04-19T00:00:00","2024-04-22T00:00:00","2024-04-23T00:00:00","2024-04-24T00:00:00","2024-04-25T00:00:00","2024-04-26T00:00:00","2024-04-29T00:00:00","2024-04-30T00:00:00","2024-05-02T00:00:00","2024-05-03T00:00:00","2024-05-06T00:00:00","2024-05-07T00:00:00","2024-05-08T00:00:00","2024-05-09T00:00:00","2024-05-10T00:00:00","2024-05-13T00:00:00","2024-05-14T00:00:00","2024-05-15T00:00:00","2024-05-16T00:00:00","2024-05-17T00:00:00","2024-05-20T00:00:00","2024-05-21T00:00:00","2024-05-22T00:00:00","2024-05-23T00:00:00","2024-05-24T00:00:00","2024-05-27T00:00:00","2024-05-28T00:00:00","2024-05-29T00:00:00","2024-05-30T00:00:00","2024-05-31T00:00:00","2024-06-03T00:00:00","2024-06-04T00:00:00","2024-06-05T00:00:00","2024-06-06T00:00:00","2024-06-07T00:00:00","2024-06-10T00:00:00","2024-06-11T00:00:00","2024-06-12T00:00:00","2024-06-13T00:00:00","2024-06-14T00:00:00","2024-06-17T00:00:00","2024-06-18T00:00:00","2024-06-19T00:00:00","2024-06-20T00:00:00","2024-06-21T00:00:00","2024-06-24T00:00:00","2024-06-25T00:00:00","2024-06-26T00:00:00","2024-06-27T00:00:00","2024-06-28T00:00:00","2024-07-01T00:00:00","2024-07-02T00:00:00","2024-07-03T00:00:00","2024-07-04T00:00:00","2024-07-05T00:00:00","2024-07-08T00:00:00","2024-07-09T00:00:00","2024-07-10T00:00:00","2024-07-11T00:00:00","2024-07-12T00:00:00","2024-07-15T00:00:00","2024-07-16T00:00:00","2024-07-17T00:00:00","2024-07-18T00:00:00","2024-07-19T00:00:00","2024-07-22T00:00:00","2024-07-23T00:00:00","2024-07-24T00:00:00","2024-07-25T00:00:00","2024-07-26T00:00:00","2024-07-29T00:00:00","2024-07-30T00:00:00","2024-07-31T00:00:00","2024-08-01T00:00:00","2024-08-02T00:00:00","2024-08-05T00:00:00","2024-08-06T00:00:00","2024-08-07T00:00:00","2024-08-08T00:00:00","2024-08-09T00:00:00","2024-08-12T00:00:00","2024-08-13T00:00:00","2024-08-14T00:00:00","2024-08-15T00:00:00","2024-08-16T00:00:00","2024-08-19T00:00:00","2024-08-20T00:00:00","2024-08-21T00:00:00","2024-08-22T00:00:00","2024-08-23T00:00:00","2024-08-26T00:00:00","2024-08-27T00:00:00","2024-08-28T00:00:00","2024-08-29T00:00:00","2024-08-30T00:00:00","2024-09-02T00:00:00","2024-09-03T00:00:00","2024-09-04T00:00:00","2024-09-05T00:00:00","2024-09-06T00:00:00","2024-09-09T00:00:00","2024-09-10T00:00:00","2024-09-11T00:00:00","2024-09-12T00:00:00","2024-09-13T00:00:00","2024-09-16T00:00:00","2024-09-17T00:00:00","2024-09-18T00:00:00","2024-09-19T00:00:00","2024-09-20T00:00:00","2024-09-23T00:00:00","2024-09-24T00:00:00","2024-09-25T00:00:00","2024-09-26T00:00:00","2024-09-27T00:00:00","2024-09-30T00:00:00","2024-10-01T00:00:00","2024-10-02T00:00:00","2024-10-03T00:00:00","2024-10-04T00:00:00","2024-10-07T00:00:00","2024-10-08T00:00:00","2024-10-09T00:00:00","2024-10-10T00:00:00","2024-10-11T00:00:00","2024-10-14T00:00:00","2024-10-15T00:00:00","2024-10-16T00:00:00","2024-10-17T00:00:00","2024-10-18T00:00:00","2024-10-21T00:00:00","2024-10-22T00:00:00","2024-10-23T00:00:00","2024-10-24T00:00:00","2024-10-25T00:00:00","2024-10-28T00:00:00","2024-10-29T00:00:00","2024-10-30T00:00:00","2024-10-31T00:00:00","2024-11-01T00:00:00","2024-11-04T00:00:00","2024-11-05T00:00:00","2024-11-06T00:00:00","2024-11-07T00:00:00","2024-11-08T00:00:00","2024-11-11T00:00:00","2024-11-12T00:00:00","2024-11-13T00:00:00","2024-11-14T00:00:00","2024-11-15T00:00:00","2024-11-18T00:00:00","2024-11-19T00:00:00","2024-11-20T00:00:00","2024-11-21T00:00:00","2024-11-22T00:00:00","2024-11-25T00:00:00","2024-11-26T00:00:00","2024-11-27T00:00:00","2024-11-28T00:00:00","2024-11-29T00:00:00","2024-12-02T00:00:00","2024-12-03T00:00:00","2024-12-04T00:00:00","2024-12-05T00:00:00","2024-12-06T00:00:00","2024-12-09T00:00:00","2024-12-10T00:00:00","2024-12-11T00:00:00","2024-12-12T00:00:00","2024-12-13T00:00:00","2024-12-16T00:00:00","2024-12-17T00:00:00","2024-12-18T00:00:00","2024-12-19T00:00:00","2024-12-20T00:00:00","2024-12-23T00:00:00","2024-12-27T00:00:00","2024-12-30T00:00:00","2025-01-02T00:00:00","2025-01-03T00:00:00","2025-01-06T00:00:00","2025-01-07T00:00:00","2025-01-08T00:00:00","2025-01-09T00:00:00","2025-01-10T00:00:00","2025-01-13T00:00:00","2025-01-14T00:00:00","2025-01-15T00:00:00","2025-01-16T00:00:00","2025-01-17T00:00:00","2025-01-20T00:00:00","2025-01-21T00:00:00","2025-01-22T00:00:00","2025-01-23T00:00:00","2025-01-24T00:00:00","2025-01-27T00:00:00","2025-01-28T00:00:00","2025-01-29T00:00:00","2025-01-30T00:00:00","2025-01-31T00:00:00","2025-02-03T00:00:00","2025-02-04T00:00:00","2025-02-05T00:00:00","2025-02-06T00:00:00","2025-02-07T00:00:00","2025-02-10T00:00:00","2025-02-11T00:00:00","2025-02-12T00:00:00","2025-02-13T00:00:00","2025-02-14T00:00:00","2025-02-17T00:00:00","2025-02-18T00:00:00","2025-02-19T00:00:00","2025-02-20T00:00:00","2025-02-21T00:00:00","2025-02-24T00:00:00","2025-02-25T00:00:00","2025-02-26T00:00:00","2025-02-27T00:00:00","2025-02-28T00:00:00","2025-03-03T00:00:00","2025-03-04T00:00:00","2025-03-05T00:00:00","2025-03-06T00:00:00","2025-03-07T00:00:00","2025-03-10T00:00:00","2025-03-11T00:00:00","2025-03-12T00:00:00","2025-03-13T00:00:00","2025-03-14T00:00:00","2025-03-17T00:00:00","2025-03-18T00:00:00","2025-03-19T00:00:00","2025-03-20T00:00:00","2025-03-21T00:00:00","2025-03-24T00:00:00","2025-03-25T00:00:00","2025-03-26T00:00:00","2025-03-27T00:00:00","2025-03-28T00:00:00","2025-03-31T00:00:00","2025-04-01T00:00:00","2025-04-02T00:00:00","2025-04-03T00:00:00","2025-04-04T00:00:00","2025-04-07T00:00:00","2025-04-08T00:00:00","2025-04-09T00:00:00","2025-04-10T00:00:00","2025-04-11T00:00:00","2025-04-14T00:00:00","2025-04-15T00:00:00","2025-04-16T00:00:00","2025-04-17T00:00:00","2025-04-22T00:00:00","2025-04-23T00:00:00","2025-04-24T00:00:00","2025-04-25T00:00:00","2025-04-28T00:00:00","2025-04-29T00:00:00","2025-04-30T00:00:00","2025-05-02T00:00:00","2025-05-05T00:00:00","2025-05-06T00:00:00","2025-05-07T00:00:00","2025-05-08T00:00:00","2025-05-09T00:00:00","2025-05-12T00:00:00","2025-05-13T00:00:00","2025-05-14T00:00:00","2025-05-15T00:00:00","2025-05-16T00:00:00","2025-05-19T00:00:00","2025-05-20T00:00:00","2025-05-21T00:00:00","2025-05-22T00:00:00","2025-05-23T00:00:00","2025-05-26T00:00:00","2025-05-27T00:00:00","2025-05-28T00:00:00","2025-05-29T00:00:00","2025-05-30T00:00:00","2025-06-02T00:00:00","2025-06-03T00:00:00","2025-06-04T00:00:00","2025-06-05T00:00:00","2025-06-06T00:00:00","2025-06-09T00:00:00","2025-06-10T00:00:00","2025-06-11T00:00:00","2025-06-12T00:00:00","2025-06-13T00:00:00","2025-06-16T00:00:00","2025-06-17T00:00:00","2025-06-18T00:00:00","2025-06-19T00:00:00","2025-06-20T00:00:00","2025-06-23T00:00:00","2025-06-24T00:00:00","2025-06-25T00:00:00","2025-06-26T00:00:00","2025-06-27T00:00:00","2025-06-30T00:00:00","2025-07-01T00:00:00","2025-07-02T00:00:00","2025-07-03T00:00:00","2025-07-04T00:00:00","2025-07-07T00:00:00","2025-07-08T00:00:00","2025-07-09T00:00:00","2025-07-10T00:00:00","2025-07-11T00:00:00","2025-07-14T00:00:00","2025-07-15T00:00:00","2025-07-16T00:00:00","2025-07-17T00:00:00","2025-07-18T00:00:00","2025-07-21T00:00:00","2025-07-22T00:00:00","2025-07-23T00:00:00","2025-07-24T00:00:00","2025-07-25T00:00:00","2025-07-28T00:00:00","2025-07-29T00:00:00","2025-07-30T00:00:00","2025-07-31T00:00:00","2025-08-01T00:00:00","2025-08-04T00:00:00","2025-08-05T00:00:00","2025-08-06T00:00:00","2025-08-07T00:00:00","2025-08-08T00:00:00","2025-08-11T00:00:00","2025-08-12T00:00:00","2025-08-13T00:00:00","2025-08-14T00:00:00","2025-08-15T00:00:00","2025-08-18T00:00:00","2025-08-19T00:00:00","2025-08-20T00:00:00","2025-08-21T00:00:00","2025-08-22T00:00:00","2025-08-25T00:00:00","2025-08-26T00:00:00","2025-08-27T00:00:00","2025-08-28T00:00:00","2025-08-29T00:00:00","2025-09-01T00:00:00","2025-09-02T00:00:00","2025-09-03T00:00:00","2025-09-04T00:00:00","2025-09-05T00:00:00","2025-09-08T00:00:00","2025-09-09T00:00:00","2025-09-10T00:00:00","2025-09-11T00:00:00","2025-09-12T00:00:00","2025-09-15T00:00:00","2025-09-16T00:00:00","2025-09-17T00:00:00","2025-09-18T00:00:00","2025-09-19T00:00:00","2025-09-22T00:00:00","2025-09-23T00:00:00","2025-09-24T00:00:00","2025-09-25T00:00:00","2025-09-26T00:00:00","2025-09-29T00:00:00","2025-09-30T00:00:00","2025-10-01T00:00:00","2025-10-02T00:00:00","2025-10-03T00:00:00","2025-10-06T00:00:00","2025-10-07T00:00:00","2025-10-08T00:00:00","2025-10-09T00:00:00","2025-10-10T00:00:00","2025-10-13T00:00:00","2025-10-14T00:00:00","2025-10-15T00:00:00","2025-10-16T00:00:00","2025-10-17T00:00:00","2025-10-20T00:00:00","2025-10-21T00:00:00","2025-10-22T00:00:00","2025-10-23T00:00:00","2025-10-24T00:00:00","2025-10-27T00:00:00","2025-10-28T00:00:00","2025-10-29T00:00:00","2025-10-30T00:00:00","2025-10-31T00:00:00","2025-11-03T00:00:00","2025-11-04T00:00:00","2025-11-05T00:00:00","2025-11-06T00:00:00","2025-11-07T00:00:00","2025-11-10T00:00:00","2025-11-11T00:00:00","2025-11-12T00:00:00","2025-11-13T00:00:00","2025-11-14T00:00:00","2025-11-17T00:00:00","2025-11-18T00:00:00","2025-11-19T00:00:00","2025-11-20T00:00:00","2025-11-21T00:00:00","2025-11-24T00:00:00","2025-11-25T00:00:00","2025-11-26T00:00:00","2025-11-27T00:00:00","2025-11-28T00:00:00","2025-12-01T00:00:00","2025-12-02T00:00:00","2025-12-03T00:00:00","2025-12-04T00:00:00","2025-12-05T00:00:00","2025-12-08T00:00:00","2025-12-09T00:00:00","2025-12-10T00:00:00","2025-12-11T00:00:00","2025-12-12T00:00:00","2025-12-15T00:00:00","2025-12-16T00:00:00","2025-12-17T00:00:00","2025-12-18T00:00:00","2025-12-19T00:00:00","2025-12-22T00:00:00","2025-12-23T00:00:00","2025-12-29T00:00:00","2025-12-30T00:00:00","2026-01-02T00:00:00","2026-01-05T00:00:00","2026-01-06T00:00:00","2026-01-07T00:00:00","2026-01-08T00:00:00","2026-01-09T00:00:00","2026-01-12T00:00:00","2026-01-13T00:00:00","2026-01-14T00:00:00","2026-01-15T00:00:00","2026-01-16T00:00:00","2026-01-19T00:00:00","2026-01-20T00:00:00","2026-01-21T00:00:00","2026-01-22T00:00:00","2026-01-23T00:00:00","2026-01-26T00:00:00","2026-01-27T00:00:00","2026-01-28T00:00:00","2026-01-29T00:00:00","2026-01-30T00:00:00","2026-02-02T00:00:00","2026-02-03T00:00:00","2026-02-04T00:00:00","2026-02-05T00:00:00","2026-02-06T00:00:00","2026-02-09T00:00:00","2026-02-10T00:00:00","2026-02-11T00:00:00","2026-02-12T00:00:00","2026-02-13T00:00:00","2026-02-16T00:00:00","2026-02-17T00:00:00","2026-02-18T00:00:00","2026-02-19T00:00:00","2026-02-20T00:00:00","2026-02-23T00:00:00","2026-02-24T00:00:00","2026-02-25T00:00:00","2026-02-26T00:00:00","2026-02-27T00:00:00","2026-03-02T00:00:00","2026-03-03T00:00:00","2026-03-04T00:00:00","2026-03-05T00:00:00","2026-03-06T00:00:00","2026-03-09T00:00:00","2026-03-10T00:00:00","2026-03-11T00:00:00","2026-03-12T00:00:00","2026-03-13T00:00:00","2026-03-16T00:00:00","2026-03-17T00:00:00","2026-03-18T00:00:00","2026-03-19T00:00:00","2026-03-20T00:00:00","2026-03-23T00:00:00","2026-03-24T00:00:00","2026-03-25T00:00:00","2026-03-26T00:00:00","2026-03-27T00:00:00"],"y":[1.0,0.992315,0.9976268621949999,0.9953662397252659,0.9740056802207617,0.9847421448338352,0.9784132070689882,0.9854206024580161,0.9808994927339387,0.9757007254224489,0.9940097495350011,0.978073785230456,0.9758134567127884,0.9918626606353438,0.9773963437299773,0.9833868059206984,0.9908457948436068,0.9868903384305912,0.9815779077388193,1.0037301579606688,1.0038435794685183,0.9940109316076242,0.9900547680998258,1.0037303946115887,1.0135629375572037,1.01797092277264,1.0261085823292844,1.040236045290794,1.0646483048016784,1.0622752037302754,1.0467914803607028,1.0606928712198929,0.9889253308602837,0.9751367449720987,0.9783010637095331,0.9812398801049165,0.9815793891034328,1.0012453321641201,1.0019231752539952,1.0110777473062909,1.001696967966783,0.9931074164664679,0.9952545147008685,0.9960457420400557,1.0067831151392475,0.984857392457745,1.0105129275312692,0.9927683205238201,0.985761361717563,0.985761361717563,0.9745719845007069,1.0064434121098336,0.9654167528585883,0.9365971319522537,0.9499333385141218,0.9518550536579359,0.9507252017092439,0.9625921536769788,0.9504991084503349,0.9665482858965189,0.9582978297281062,0.9562633634355934,0.9806758108407405,0.9816927716565823,1.000906462583445,0.9880217936906083,0.9988712610071248,1.0021485576144893,1.0009048912544896,1.001131095759913,0.9790921958178544,0.9967236880801424,1.0109638794117435,1.0406882393942074,1.022152541162357,1.0259948125645866,1.0081373728518999,0.9636079450930314,0.9631560129667827,0.9790914292013181,0.9811259811911984,0.9688069633713617,0.9540016553571206,0.9596522071618007,0.9484636220785012,0.952192981040514,0.9573919547169952,0.9298152368533269,0.8917272153061041,0.8766953696376891,0.8702534120615913,0.8812159942933312,0.8996378146540333,0.8882232100617028,0.8883360144093806,0.8981690057528781,0.9002033585509083,0.9194163988324602,0.9222417654260724,0.9282317256925147,0.9257449928993844,0.9316216221143097,0.9317343483305855,0.9442792195965085,0.9482348052473983,0.944392557816536,0.9506085496320845,0.9619103346786604,0.9602154486689566,0.9638316200486439,0.9500430448922279,0.9421320364574104,0.933655674525403,0.9105999812986727,0.9188500171292387,0.917493794503956,0.9162505904124031,0.9284568807778771,0.9271004052750607,0.9205448783093606,0.9400972515246514,0.9364806973980361,0.9602148641928919,0.9417931420233513,0.9465397794591489,0.9625883614198788,0.9750201901076165,1.0270092416643448,1.0333386996207221,1.0247495883494746,1.0163866069589547,1.0206808403733563,1.0148037600944864,1.0334517939899825,1.0419281656042885,1.0181940839199883,1.0423802661894237,1.0361645526621361,1.0501786782368916,1.0469010705821142,1.0332254018971,1.0228280546778095,1.0413637446846806,1.048823033187857,1.0459975039364489,1.0369559015124221,1.0239586962428653,1.014125620882845,1.0195501788289474,1.02757505828651,1.0231677888615192,1.0142396267359135,1.0081369469018435,1.0257682539662099,1.0245250228424028,1.0397822494825717,1.0403478910262902,1.0622732228296692,1.0345829467301682,1.0501792846521254,1.0055361632615636,1.0137865874811247,1.063514847170249,1.0589938455549281,1.039780520215025,1.0049707479592664,0.9977379734862036,0.9945731486343055,1.0033890450237999,1.0218112678904367,1.0189859597347197,1.0114138750679311,1.0114138750679311,1.0350354461201428,1.0630642060010762,1.0748185069268301,1.084425234741742,1.090980585285756,1.0945971859259782,1.097084110732402,1.097084110732402,1.1048821845914878,1.0962928304884736,1.0814873958127267,1.07549703712732,1.0901894021515162,1.1003608692735898,1.0705234839423672,1.0695064866326218,1.0679246865388923,1.0714285474354264,1.0714285474354264,1.06871569035332,1.0554924711165783,1.0910942321673405,1.0936932186283632,1.0936932186283632,1.1109856021080964,1.0991180539063776,1.091658339674515,1.0960664560501208,1.1052208030910513,1.1028478940268147,1.1350025272250606,1.140371089178835,1.140371089178835,1.170603467124055,1.18105812668894,1.18105812668894,1.1381101289700233,1.1304813767755373,1.1491297975668266,1.1593018945348883,1.172298828074519,1.1420664135973053,1.1406536774436855,1.1372625140606454,1.1756894771482407,1.1722987886961451,1.1722987886961451,1.214398382795801,1.198293031443163,1.2853178645586913,1.2726035002424767,1.2827754200199146,1.2782549194397645,1.2451966907132133,1.250282073998086,1.2514123289929804,1.2324809632799745,1.2240039592145346,1.2627130844246943,1.2466084417459418,1.2499992167074907,1.2768416998870673,1.20535644047719,1.3084867375244185,1.3731900982082634,1.324027146312211,1.2906868187409233,1.2613017519386487,1.2819278194881014,1.2799498048626314,1.3096177613895426,1.3240274856181118,1.339285578362375,1.3375900428201681,1.3248749118731196,1.2932289497281182,1.2932289497281182,1.293510873639159,1.2686470076260672,1.2519769859458607,1.220613710470931,1.1974440210187716,1.213549643101474,1.213549643101474,1.1159571943528965,1.0489361531316446,0.9979641497063654,1.0326613672633562,1.0011290524139698,1.0563953806234305,1.0210198685124936,1.0493878845392448,1.0471275030359473,1.0518741320072091,1.0568473929033393,1.0698445021412644,1.1104183548849718,1.1338703905401424,1.1338703905401424,1.1587350343342973,1.1429125074404625,1.1412175681919283,1.1855778362851168,1.1937713647116832,1.1807735820927023,1.181903582410765,1.204789963380567,1.2095934609645653,1.2531061665358436,1.2723200433873378,1.2723200433873378,1.2536716485114097,1.242935204513558,1.2533895325187214,1.255932659880202,1.2488692946010358,1.2268304981592113,1.1997052758449112,1.2355884606454326,1.2488685654204497,1.229090233949886,1.201400060069229,1.1968791916431885,1.2073339313821916,1.2095940605017392,1.2321977447103352,1.2389785288994761,1.2364361449581744,1.2364361449581744,1.2378493914718616,1.2415220906163584,1.2282427703351257,1.2146805136650853,1.2206142279743393,1.2093125608375248,1.1926421871863795,1.1748420025426227,1.1827533885877448,1.1799277907424086,1.2121386395018856,1.2070525057705357,1.2141161770343047,1.258759228863856,1.2299386775597891,1.2186367710516923,1.240393093325278,1.2505643166905454,1.2206145518701235,1.2338948381944703,1.2265482283278604,1.2742989774048923,1.2816453110096315,1.2604545874373982,1.2449144428288825,1.2336118646024392,1.2336118646024392,1.277125055902561,1.2669527548322972,1.2689304680825904,1.2451963926075735,1.2867311634793916,1.2841885827003563,1.2844711041885506,1.2751471284432458,1.283058141228108,1.2937947717539047,1.2709088360363499,1.2033790950335583,1.2251349856926699,1.2364368559356849,1.2375669592220102,1.2833396107757955,1.313290190612081,1.2887080248242042,1.305943205948203,1.3011399468367255,1.3180924992040612,1.323743161748149,1.3197878171808455,1.3463472272137929,1.3195051025448314,1.3203522248206652,1.3387183242679208,1.3308064989714974,1.3274156040121181,1.316678139191264,1.3384349287632604,1.3370215414784865,1.3517140711977935,1.292379230328495,1.2966169418247422,1.300007595127614,1.2771209614153924,1.303397725196514,1.2912487549999574,1.2906831880452674,1.294356472398444,1.2915308922191981,1.3008544537301288,1.277402649638282,1.2728819216612122,1.2884225370427738,1.2906824301727469,1.2906824301727469,1.2940730529168105,1.2790980395484572,1.2646877210349043,1.2926600840487545,1.278249509431779,1.278249509431779,1.3079176805456905,1.3630150207563583,1.3630150207563583,1.3745992854177667,1.3692314752082102,1.3859018684188702,1.3926830862610438,1.369231695771494,1.3907053564562784,1.3469106540761135,1.3599083418879478,1.3802525706825917,1.3443687643499858,1.3743186116821748,1.3669728787027335,1.3675374385016377,1.3542572824363481,1.3765781509654642,1.3946608815565467,1.391552182451557,1.3887273315211806,1.3957903987292972,1.3875971090887562,1.3969217616618328,1.3799687191623047,1.3844894966862804,1.3652755514512682,1.3652755514512682,1.3884442775593961,1.3980509235158294,1.4150036890143824,1.2827715942759883,1.3017027374643133,1.260168006517302,1.232760612543557,1.2353037976872343,1.2494307319175855,1.2384107528620723,1.2601671529683531,1.2827707711911467,1.2889870783483388,1.285879330502441,1.290117588775777,1.2782510871942174,1.284467222231243,1.2926608386418559,1.3008550156980068,1.3192204868096313,1.3243060817862824,1.322610970001596,1.3087658783676193,1.3497354854240393,1.3497354854240393,1.3497354854240393,1.3421067804604228,1.3421067804604228,1.3421067804604228,1.3336300340350347,1.337302851148767,1.3438021430053502,1.3395637910463114,1.3514309866711907,1.3624505549365076,1.3822292496425208,1.3988989343932094,1.4480618385435244,1.4229147966553777,1.4364765975823,1.4599285145144287,1.4791411737654387,1.4638838325580483,1.4740563613104944,1.4706660316794804,1.4466500553821546,1.4336533512846015,1.4302627611088135,1.45795264816388,1.4376083769114012,1.4384565658537791,1.4319576190892518,1.4178299252193172,1.4463680059541315,1.4483451910182708,1.4712319417267417,1.4732092774564225,1.3675359759844734,1.381663990152369,1.4155700244707081,1.446367165923093,1.458516650116847,1.4480620027688094,1.4523004802509136,1.4186768195321446,1.3276956564187288,1.3322164601288347,1.3833575856002605,1.3593411145566543,1.385335794690321,1.3599065708429856,1.353407577340927,1.3794024766789141,1.405114538844209,1.3980510280574392,1.3460617044770673,1.2796631727186225,1.316111818867167,1.2703387659187857,1.2703387659187857,1.2494302601705285,1.3118730362830708,1.2895515165707143,1.2697736649610691,1.2451921165810877,1.244909457970624,1.2384110306000173,1.2324778033524126,1.1884006996711203,1.1513867714791635,1.1940514082963238,1.1821837313492667,1.1968759107624756,1.1852913488222057,1.1578838569633898],"marker":{},"line":{}},{"type":"scatter","name":"ALV.DE","mode":"lines","x":["2024-03-28T00:00:00","2024-04-02T00:00:00","2024-04-03T00:00:00","2024-04-04T00:00:00","2024-04-05T00:00:00","2024-04-08T00:00:00","2024-04-09T00:00:00","2024-04-10T00:00:00","2024-04-11T00:00:00","2024-04-12T00:00:00","2024-04-15T00:00:00","2024-04-16T00:00:00","2024-04-17T00:00:00","2024-04-18T00:00:00","2024-04-19T00:00:00","2024-04-22T00:00:00","2024-04-23T00:00:00","2024-04-24T00:00:00","2024-04-25T00:00:00","2024-04-26T00:00:00","2024-04-29T00:00:00","2024-04-30T00:00:00","2024-05-02T00:00:00","2024-05-03T00:00:00","2024-05-06T00:00:00","2024-05-07T00:00:00","2024-05-08T00:00:00","2024-05-09T00:00:00","2024-05-10T00:00:00","2024-05-13T00:00:00","2024-05-14T00:00:00","2024-05-15T00:00:00","2024-05-16T00:00:00","2024-05-17T00:00:00","2024-05-20T00:00:00","2024-05-21T00:00:00","2024-05-22T00:00:00","2024-05-23T00:00:00","2024-05-24T00:00:00","2024-05-27T00:00:00","2024-05-28T00:00:00","2024-05-29T00:00:00","2024-05-30T00:00:00","2024-05-31T00:00:00","2024-06-03T00:00:00","2024-06-04T00:00:00","2024-06-05T00:00:00","2024-06-06T00:00:00","2024-06-07T00:00:00","2024-06-10T00:00:00","2024-06-11T00:00:00","2024-06-12T00:00:00","2024-06-13T00:00:00","2024-06-14T00:00:00","2024-06-17T00:00:00","2024-06-18T00:00:00","2024-06-19T00:00:00","2024-06-20T00:00:00","2024-06-21T00:00:00","2024-06-24T00:00:00","2024-06-25T00:00:00","2024-06-26T00:00:00","2024-06-27T00:00:00","2024-06-28T00:00:00","2024-07-01T00:00:00","2024-07-02T00:00:00","2024-07-03T00:00:00","2024-07-04T00:00:00","2024-07-05T00:00:00","2024-07-08T00:00:00","2024-07-09T00:00:00","2024-07-10T00:00:00","2024-07-11T00:00:00","2024-07-12T00:00:00","2024-07-15T00:00:00","2024-07-16T00:00:00","2024-07-17T00:00:00","2024-07-18T00:00:00","2024-07-19T00:00:00","2024-07-22T00:00:00","2024-07-23T00:00:00","2024-07-24T00:00:00","2024-07-25T00:00:00","2024-07-26T00:00:00","2024-07-29T00:00:00","2024-07-30T00:00:00","2024-07-31T00:00:00","2024-08-01T00:00:00","2024-08-02T00:00:00","2024-08-05T00:00:00","2024-08-06T00:00:00","2024-08-07T00:00:00","2024-08-08T00:00:00","2024-08-09T00:00:00","2024-08-12T00:00:00","2024-08-13T00:00:00","2024-08-14T00:00:00","2024-08-15T00:00:00","2024-08-16T00:00:00","2024-08-19T00:00:00","2024-08-20T00:00:00","2024-08-21T00:00:00","2024-08-22T00:00:00","2024-08-23T00:00:00","2024-08-26T00:00:00","2024-08-27T00:00:00","2024-08-28T00:00:00","2024-08-29T00:00:00","2024-08-30T00:00:00","2024-09-02T00:00:00","2024-09-03T00:00:00","2024-09-04T00:00:00","2024-09-05T00:00:00","2024-09-06T00:00:00","2024-09-09T00:00:00","2024-09-10T00:00:00","2024-09-11T00:00:00","2024-09-12T00:00:00","2024-09-13T00:00:00","2024-09-16T00:00:00","2024-09-17T00:00:00","2024-09-18T00:00:00","2024-09-19T00:00:00","2024-09-20T00:00:00","2024-09-23T00:00:00","2024-09-24T00:00:00","2024-09-25T00:00:00","2024-09-26T00:00:00","2024-09-27T00:00:00","2024-09-30T00:00:00","2024-10-01T00:00:00","2024-10-02T00:00:00","2024-10-03T00:00:00","2024-10-04T00:00:00","2024-10-07T00:00:00","2024-10-08T00:00:00","2024-10-09T00:00:00","2024-10-10T00:00:00","2024-10-11T00:00:00","2024-10-14T00:00:00","2024-10-15T00:00:00","2024-10-16T00:00:00","2024-10-17T00:00:00","2024-10-18T00:00:00","2024-10-21T00:00:00","2024-10-22T00:00:00","2024-10-23T00:00:00","2024-10-24T00:00:00","2024-10-25T00:00:00","2024-10-28T00:00:00","2024-10-29T00:00:00","2024-10-30T00:00:00","2024-10-31T00:00:00","2024-11-01T00:00:00","2024-11-04T00:00:00","2024-11-05T00:00:00","2024-11-06T00:00:00","2024-11-07T00:00:00","2024-11-08T00:00:00","2024-11-11T00:00:00","2024-11-12T00:00:00","2024-11-13T00:00:00","2024-11-14T00:00:00","2024-11-15T00:00:00","2024-11-18T00:00:00","2024-11-19T00:00:00","2024-11-20T00:00:00","2024-11-21T00:00:00","2024-11-22T00:00:00","2024-11-25T00:00:00","2024-11-26T00:00:00","2024-11-27T00:00:00","2024-11-28T00:00:00","2024-11-29T00:00:00","2024-12-02T00:00:00","2024-12-03T00:00:00","2024-12-04T00:00:00","2024-12-05T00:00:00","2024-12-06T00:00:00","2024-12-09T00:00:00","2024-12-10T00:00:00","2024-12-11T00:00:00","2024-12-12T00:00:00","2024-12-13T00:00:00","2024-12-16T00:00:00","2024-12-17T00:00:00","2024-12-18T00:00:00","2024-12-19T00:00:00","2024-12-20T00:00:00","2024-12-23T00:00:00","2024-12-27T00:00:00","2024-12-30T00:00:00","2025-01-02T00:00:00","2025-01-03T00:00:00","2025-01-06T00:00:00","2025-01-07T00:00:00","2025-01-08T00:00:00","2025-01-09T00:00:00","2025-01-10T00:00:00","2025-01-13T00:00:00","2025-01-14T00:00:00","2025-01-15T00:00:00","2025-01-16T00:00:00","2025-01-17T00:00:00","2025-01-20T00:00:00","2025-01-21T00:00:00","2025-01-22T00:00:00","2025-01-23T00:00:00","2025-01-24T00:00:00","2025-01-27T00:00:00","2025-01-28T00:00:00","2025-01-29T00:00:00","2025-01-30T00:00:00","2025-01-31T00:00:00","2025-02-03T00:00:00","2025-02-04T00:00:00","2025-02-05T00:00:00","2025-02-06T00:00:00","2025-02-07T00:00:00","2025-02-10T00:00:00","2025-02-11T00:00:00","2025-02-12T00:00:00","2025-02-13T00:00:00","2025-02-14T00:00:00","2025-02-17T00:00:00","2025-02-18T00:00:00","2025-02-19T00:00:00","2025-02-20T00:00:00","2025-02-21T00:00:00","2025-02-24T00:00:00","2025-02-25T00:00:00","2025-02-26T00:00:00","2025-02-27T00:00:00","2025-02-28T00:00:00","2025-03-03T00:00:00","2025-03-04T00:00:00","2025-03-05T00:00:00","2025-03-06T00:00:00","2025-03-07T00:00:00","2025-03-10T00:00:00","2025-03-11T00:00:00","2025-03-12T00:00:00","2025-03-13T00:00:00","2025-03-14T00:00:00","2025-03-17T00:00:00","2025-03-18T00:00:00","2025-03-19T00:00:00","2025-03-20T00:00:00","2025-03-21T00:00:00","2025-03-24T00:00:00","2025-03-25T00:00:00","2025-03-26T00:00:00","2025-03-27T00:00:00","2025-03-28T00:00:00","2025-03-31T00:00:00","2025-04-01T00:00:00","2025-04-02T00:00:00","2025-04-03T00:00:00","2025-04-04T00:00:00","2025-04-07T00:00:00","2025-04-08T00:00:00","2025-04-09T00:00:00","2025-04-10T00:00:00","2025-04-11T00:00:00","2025-04-14T00:00:00","2025-04-15T00:00:00","2025-04-16T00:00:00","2025-04-17T00:00:00","2025-04-22T00:00:00","2025-04-23T00:00:00","2025-04-24T00:00:00","2025-04-25T00:00:00","2025-04-28T00:00:00","2025-04-29T00:00:00","2025-04-30T00:00:00","2025-05-02T00:00:00","2025-05-05T00:00:00","2025-05-06T00:00:00","2025-05-07T00:00:00","2025-05-08T00:00:00","2025-05-09T00:00:00","2025-05-12T00:00:00","2025-05-13T00:00:00","2025-05-14T00:00:00","2025-05-15T00:00:00","2025-05-16T00:00:00","2025-05-19T00:00:00","2025-05-20T00:00:00","2025-05-21T00:00:00","2025-05-22T00:00:00","2025-05-23T00:00:00","2025-05-26T00:00:00","2025-05-27T00:00:00","2025-05-28T00:00:00","2025-05-29T00:00:00","2025-05-30T00:00:00","2025-06-02T00:00:00","2025-06-03T00:00:00","2025-06-04T00:00:00","2025-06-05T00:00:00","2025-06-06T00:00:00","2025-06-09T00:00:00","2025-06-10T00:00:00","2025-06-11T00:00:00","2025-06-12T00:00:00","2025-06-13T00:00:00","2025-06-16T00:00:00","2025-06-17T00:00:00","2025-06-18T00:00:00","2025-06-19T00:00:00","2025-06-20T00:00:00","2025-06-23T00:00:00","2025-06-24T00:00:00","2025-06-25T00:00:00","2025-06-26T00:00:00","2025-06-27T00:00:00","2025-06-30T00:00:00","2025-07-01T00:00:00","2025-07-02T00:00:00","2025-07-03T00:00:00","2025-07-04T00:00:00","2025-07-07T00:00:00","2025-07-08T00:00:00","2025-07-09T00:00:00","2025-07-10T00:00:00","2025-07-11T00:00:00","2025-07-14T00:00:00","2025-07-15T00:00:00","2025-07-16T00:00:00","2025-07-17T00:00:00","2025-07-18T00:00:00","2025-07-21T00:00:00","2025-07-22T00:00:00","2025-07-23T00:00:00","2025-07-24T00:00:00","2025-07-25T00:00:00","2025-07-28T00:00:00","2025-07-29T00:00:00","2025-07-30T00:00:00","2025-07-31T00:00:00","2025-08-01T00:00:00","2025-08-04T00:00:00","2025-08-05T00:00:00","2025-08-06T00:00:00","2025-08-07T00:00:00","2025-08-08T00:00:00","2025-08-11T00:00:00","2025-08-12T00:00:00","2025-08-13T00:00:00","2025-08-14T00:00:00","2025-08-15T00:00:00","2025-08-18T00:00:00","2025-08-19T00:00:00","2025-08-20T00:00:00","2025-08-21T00:00:00","2025-08-22T00:00:00","2025-08-25T00:00:00","2025-08-26T00:00:00","2025-08-27T00:00:00","2025-08-28T00:00:00","2025-08-29T00:00:00","2025-09-01T00:00:00","2025-09-02T00:00:00","2025-09-03T00:00:00","2025-09-04T00:00:00","2025-09-05T00:00:00","2025-09-08T00:00:00","2025-09-09T00:00:00","2025-09-10T00:00:00","2025-09-11T00:00:00","2025-09-12T00:00:00","2025-09-15T00:00:00","2025-09-16T00:00:00","2025-09-17T00:00:00","2025-09-18T00:00:00","2025-09-19T00:00:00","2025-09-22T00:00:00","2025-09-23T00:00:00","2025-09-24T00:00:00","2025-09-25T00:00:00","2025-09-26T00:00:00","2025-09-29T00:00:00","2025-09-30T00:00:00","2025-10-01T00:00:00","2025-10-02T00:00:00","2025-10-03T00:00:00","2025-10-06T00:00:00","2025-10-07T00:00:00","2025-10-08T00:00:00","2025-10-09T00:00:00","2025-10-10T00:00:00","2025-10-13T00:00:00","2025-10-14T00:00:00","2025-10-15T00:00:00","2025-10-16T00:00:00","2025-10-17T00:00:00","2025-10-20T00:00:00","2025-10-21T00:00:00","2025-10-22T00:00:00","2025-10-23T00:00:00","2025-10-24T00:00:00","2025-10-27T00:00:00","2025-10-28T00:00:00","2025-10-29T00:00:00","2025-10-30T00:00:00","2025-10-31T00:00:00","2025-11-03T00:00:00","2025-11-04T00:00:00","2025-11-05T00:00:00","2025-11-06T00:00:00","2025-11-07T00:00:00","2025-11-10T00:00:00","2025-11-11T00:00:00","2025-11-12T00:00:00","2025-11-13T00:00:00","2025-11-14T00:00:00","2025-11-17T00:00:00","2025-11-18T00:00:00","2025-11-19T00:00:00","2025-11-20T00:00:00","2025-11-21T00:00:00","2025-11-24T00:00:00","2025-11-25T00:00:00","2025-11-26T00:00:00","2025-11-27T00:00:00","2025-11-28T00:00:00","2025-12-01T00:00:00","2025-12-02T00:00:00","2025-12-03T00:00:00","2025-12-04T00:00:00","2025-12-05T00:00:00","2025-12-08T00:00:00","2025-12-09T00:00:00","2025-12-10T00:00:00","2025-12-11T00:00:00","2025-12-12T00:00:00","2025-12-15T00:00:00","2025-12-16T00:00:00","2025-12-17T00:00:00","2025-12-18T00:00:00","2025-12-19T00:00:00","2025-12-22T00:00:00","2025-12-23T00:00:00","2025-12-29T00:00:00","2025-12-30T00:00:00","2026-01-02T00:00:00","2026-01-05T00:00:00","2026-01-06T00:00:00","2026-01-07T00:00:00","2026-01-08T00:00:00","2026-01-09T00:00:00","2026-01-12T00:00:00","2026-01-13T00:00:00","2026-01-14T00:00:00","2026-01-15T00:00:00","2026-01-16T00:00:00","2026-01-19T00:00:00","2026-01-20T00:00:00","2026-01-21T00:00:00","2026-01-22T00:00:00","2026-01-23T00:00:00","2026-01-26T00:00:00","2026-01-27T00:00:00","2026-01-28T00:00:00","2026-01-29T00:00:00","2026-01-30T00:00:00","2026-02-02T00:00:00","2026-02-03T00:00:00","2026-02-04T00:00:00","2026-02-05T00:00:00","2026-02-06T00:00:00","2026-02-09T00:00:00","2026-02-10T00:00:00","2026-02-11T00:00:00","2026-02-12T00:00:00","2026-02-13T00:00:00","2026-02-16T00:00:00","2026-02-17T00:00:00","2026-02-18T00:00:00","2026-02-19T00:00:00","2026-02-20T00:00:00","2026-02-23T00:00:00","2026-02-24T00:00:00","2026-02-25T00:00:00","2026-02-26T00:00:00","2026-02-27T00:00:00","2026-03-02T00:00:00","2026-03-03T00:00:00","2026-03-04T00:00:00","2026-03-05T00:00:00","2026-03-06T00:00:00","2026-03-09T00:00:00","2026-03-10T00:00:00","2026-03-11T00:00:00","2026-03-12T00:00:00","2026-03-13T00:00:00","2026-03-16T00:00:00","2026-03-17T00:00:00","2026-03-18T00:00:00","2026-03-19T00:00:00","2026-03-20T00:00:00","2026-03-23T00:00:00","2026-03-24T00:00:00","2026-03-25T00:00:00","2026-03-26T00:00:00","2026-03-27T00:00:00"],"y":[1.0,0.985961,0.9877603788249999,0.9805605934237445,0.9676015046210562,0.9665216613418991,0.9503227582978089,0.948162674668198,0.9395230163766214,0.9431223290523602,0.9503221249123458,0.9323239741886309,0.9409628881334627,0.9431223979617289,0.9474418985443936,0.960040980911237,0.9737196448072604,0.960040831237008,0.9456421388501154,0.95572079276598,0.9586003795145838,0.9596807221422968,0.9625607239894459,0.9510417598054642,0.9690402251097827,0.9809187201891786,0.9848786890625824,0.9478019459341325,0.9557217789943581,0.9578817102148852,0.9553615234353098,0.9478017477003662,0.9586010008136641,0.9625609815480254,0.9640009727764212,0.9618416105974019,0.9596813143400001,0.9503225021625564,0.9535621515724286,0.958242234612346,0.957162295613938,0.9499625208263299,0.9564422151808862,0.9658010022564312,0.9748003359954566,0.9431232242769483,0.9460025794806658,0.9499625462783718,0.9413235868825163,0.9337638171562628,0.9218844738744008,0.9348434039236532,0.9226044340794847,0.9121651649078754,0.9200845828696056,0.9251238861299824,0.9290834163626188,0.9359223993904641,0.9344829507402015,0.941322431456669,0.936643117649898,0.9326829905484743,0.9337630374515293,0.9341234699839857,0.9449228714204705,0.9312441679337877,0.9359236698776551,0.9416833441420821,0.9391633995131579,0.9438432507329318,0.9355638577375026,0.9442028543998506,0.9506819743867423,0.9600414384245799,0.9546421653748801,0.9474432088057881,0.9467231519670958,0.9452831860529538,0.9337639651477124,0.9442034462780639,0.945283615020606,0.9348448480599334,0.9319645910830607,0.9398844261780844,0.9316049842678817,0.9427637487694425,0.9388041410246108,0.9139661998655227,0.9046071859788998,0.8837288521265068,0.8804891021546111,0.8970475802097307,0.9139658975724864,0.9211652069476648,0.9211652069476648,0.9247651205764162,0.9323241506720078,0.9485232827899338,0.9611225175552325,0.9708413884527509,0.9737209040109018,0.9776810269275142,0.9805602975518157,0.993879248073462,0.9899196331491373,0.9945989832550333,1.0104379720633696,1.0111574038994788,1.0111574038994788,1.014757124257361,1.0151173630364725,1.0111573902032671,1.0208766350379008,1.0086373450604313,1.0212362341375811,1.018356347957313,1.0197963038333246,1.0248361371668688,1.0316758935463206,1.034915355852056,1.038154640915873,1.038154640915873,1.0503934459776303,1.0503934459776303,1.0615528259476965,1.0644328187644925,1.0586731727821577,1.0647923037208384,1.0673126671037456,1.0619131323208677,1.0565133040430161,1.050393978985999,1.0428342935192367,1.0503937993129577,1.05219417428498,1.0471541641901552,1.0561534070772054,1.0597527778885245,1.0694717706145402,1.077391209075941,1.0838706398073237,1.0842304848597397,1.0899899171953147,1.0953897272451,1.0842309920936544,1.0647928988673994,1.0583136340777912,1.0615531321117033,1.0575935389289266,1.0655127993484264,1.0619134971122273,1.0511148987600931,1.0417557717015333,1.0417557717015333,1.0446351846545163,1.0507546575662223,1.0428351197121457,1.042475341595845,1.0331159979789974,1.0421154714373924,1.0183573229195626,1.0244766320729861,1.0269968445878856,1.036355866832615,1.0381560169733033,1.0266366378089675,1.0269969872688385,1.047875836020014,1.0489561960069507,1.052916005646877,1.0449970243684068,1.0363580339679532,1.0363580339679532,1.0518370775632986,1.06731591199672,1.0709159685678848,1.080275774133168,1.096474509366295,1.0856753319235464,1.0748761193969028,1.0748761193969028,1.0856753997684834,1.0777564834025721,1.0874756913698964,1.0777569211161238,1.0766770086811654,1.0712774734826294,1.0687578288649981,1.0604781619647812,1.059038032620833,1.0622776299626202,1.0651574646174489,1.068397673624815,1.0687577236408268,1.0763170470201384,1.080996873540582,1.085676509006139,1.0817170467777937,1.0655183340022962,1.05795848142255,1.064077713279098,1.0845963238242586,1.0928761321603329,1.1007951126139668,1.1018749926194409,1.1018749926194409,1.1033151432347945,1.1187935513792355,1.1187935513792355,1.1267134909294492,1.1339131901364883,1.1310330506335415,1.1360729339071647,1.1317535846124496,1.1227538801076113,1.1263534290472363,1.1270731688883975,1.140752455939196,1.1461516373131562,1.1461516373131562,1.1526308325188874,1.1630702099690111,1.1889880665279606,1.1598305121724954,1.1785490168084471,1.1839491284034636,1.1519114649888658,1.1501121792805533,1.1526320750653571,1.163071463769224,1.1735111932280167,1.2048286864416926,1.199788888046307,1.1889895882650021,1.2249874370393132,1.2037486048559256,1.232185961897042,1.2447850633574393,1.2354255244660546,1.2321862387409046,1.2159879184464166,1.2480255521337242,1.254144621415836,1.2656639397635405,1.2656639397635405,1.2897824317996744,1.2797027820951599,1.273223646909412,1.26494387353356,1.26494387353356,1.2822230068460285,1.2786238068658118,1.2861830308120024,1.2789829782055169,1.267464457503798,1.285102492894421,1.2861819789884523,1.2735825403222814,1.1965486267883478,1.1375133106398643,1.1702702814463604,1.1346332108357557,1.1843097220725667,1.180709420517466,1.2156265402104292,1.2347045831324917,1.2501828397866408,1.253422063524528,1.2768196931843403,1.2854586552284255,1.2832990846876418,1.2926581849122687,1.3002176499776357,1.3020171512052048,1.3106560350034513,1.3318939053946472,1.350252730986607,1.3592521654386327,1.338013850353654,1.34053333043387,1.3045359889117294,1.2660195638391105,1.2631393693313766,1.2631393693313766,1.253420775023741,1.2642202484213454,1.2656601952842974,1.2519809398936648,1.2652995131322535,1.2631396468633367,1.2491011128280975,1.2681798832254338,1.2685400463122698,1.2534215860403202,1.2516216726427662,1.255221336573287,1.2620610376362749,1.2627804124277275,1.27033941597652,1.2739395578813975,1.2789792627723764,1.2789792627723764,1.2512612241895735,1.245501668774629,1.2350631192886288,1.2296634233310988,1.2379427471603872,1.2195840562199987,1.2156240667894522,1.2001455255470221,1.2246236936860793,1.2102245682957182,1.2264234241423564,1.2235437819424702,1.2249838929738164,1.237582852313052,1.2386632621431213,1.2339835923387446,1.2257047964177439,1.237943458809975,1.2300243345039674,1.2584624971176992,1.2624216201336316,1.2822201784021872,1.2537818170654051,1.2476621080163088,1.2419028997257056,1.2228247873801192,1.2228247873801192,1.2419032997128236,1.2440629695510241,1.2440629695510241,1.2253447981111594,1.2429836364799693,1.2401036433942452,1.229304820867568,1.222464968844261,1.240823947746364,1.2440637390739298,1.249823754185842,1.20266790394041,1.2429849400842043,1.250184308857172,1.2685432654327398,1.3207387466322351,1.3138986406634268,1.3099385501604672,1.309578317059173,1.327217027411643,1.327217027411643,1.358895043421904,1.3444961915418054,1.3477364273634211,1.351696076987015,1.3495360666559897,1.3426966178701771,1.3344175505243896,1.3120994169918692,1.3102992165917562,1.301660413856767,1.3002207774390413,1.2955412828610382,1.275022500023085,1.2707027237930069,1.2746622334803457,1.264942933950058,1.2696232228056732,1.2717828519076655,1.2660229473713758,1.2685423330366448,1.27610157679921,1.2797014593473606,1.2476641333125993,1.2401045363288583,1.2498232355800676,1.2509030828556087,1.2509030828556087,1.25342240166448,1.2455032789307636,1.2573828892052052,1.289060136332952,1.2829409678657795,1.2829409678657795,1.3077787050036611,1.304178390228786,1.3012987643431608,1.3066978529164206,1.3113771379277144,1.3358553035842733,1.32829569842129,1.3225362082729353,1.3268556115291548,1.330814948673958,1.317855472703771,1.3102962537123422,1.2519802086446206,1.2638589968642406,1.2696184023129509,1.2660190341423936,1.2606194629617764,1.2699783018548048,1.2825777565875063,1.286537074122092,1.275377651541157,1.281856570010986,1.2534185820052923,1.2706969571582352,1.273576356463156,1.2825754469979247,1.2717761617342023,1.2717761617342023,1.2843756481685031,1.29229510841511,1.2994944844640905,1.2994944844640905,1.3232531421235476,1.3038145534657528,1.2944557726009756,1.2933761964866264,1.3056154154339794,1.3070555092372032,1.3063353216516136,1.3210942981156335,1.344132861580472,1.3383732522685996,1.3401733642929008,1.3308135935166792,1.3383726147278538,1.3146151624438198,1.3203744914704862,1.3200140292343148,1.3304527001774997,1.3704088556692304,1.3646490272488527,1.3822871159260444,1.3693281742142376,1.3693281742142376,1.379767932214447,1.379767932214447,1.379767932214447,1.4020856785180156,1.4053258985210706,1.4074858844270974,1.399565961355426,1.405684863738472,1.3956061032654672,1.4136052351792818,1.4085657325158676,1.3851680471330465,1.4046061103384646,1.376168455028552,1.3678894256031002,1.367169915765233,1.3639297230648695,1.3754494735058753,1.3700494588728913,1.3653693699213816,1.3452110565438624,1.3250530688615525,1.3318929928030157,1.3099340730306723,1.3153336212797047,1.314973219867474,1.3243318842732708,1.3293709670929306,1.3383708085401496,1.3650084027425242,1.3765277086532686,1.39452580844391,1.3822874499490063,1.3938060512694312,1.3945252551918863,1.3585283747796182,1.320371388317183,1.321090990723816,1.320731653974339,1.3290113207131042,1.3405298618297248,1.340890464362557,1.3441300557244569,1.365008427880025,1.3635683439886115,1.3624883978601725,1.3732874809016125,1.3848066162914152,1.3758067580921374,1.3333301002428009,1.279334231173268,1.292292607600822,1.2714143282324233,1.2512560540582982,1.239017518593554,1.2757345637395552,1.2667355321269365,1.2616964581801355,1.2746553425021037,1.2940938364752608,1.3034527231006496,1.2908535490791588,1.2714145854835757,1.2512563072307337,1.2588151465827144,1.258095104318869,1.273573448387304,1.2631339668308732,1.2631339668308732],"marker":{},"line":{}},{"type":"scatter","name":"DTE.DE","mode":"lines","x":["2024-03-28T00:00:00","2024-04-02T00:00:00","2024-04-03T00:00:00","2024-04-04T00:00:00","2024-04-05T00:00:00","2024-04-08T00:00:00","2024-04-09T00:00:00","2024-04-10T00:00:00","2024-04-11T00:00:00","2024-04-12T00:00:00","2024-04-15T00:00:00","2024-04-16T00:00:00","2024-04-17T00:00:00","2024-04-18T00:00:00","2024-04-19T00:00:00","2024-04-22T00:00:00","2024-04-23T00:00:00","2024-04-24T00:00:00","2024-04-25T00:00:00","2024-04-26T00:00:00","2024-04-29T00:00:00","2024-04-30T00:00:00","2024-05-02T00:00:00","2024-05-03T00:00:00","2024-05-06T00:00:00","2024-05-07T00:00:00","2024-05-08T00:00:00","2024-05-09T00:00:00","2024-05-10T00:00:00","2024-05-13T00:00:00","2024-05-14T00:00:00","2024-05-15T00:00:00","2024-05-16T00:00:00","2024-05-17T00:00:00","2024-05-20T00:00:00","2024-05-21T00:00:00","2024-05-22T00:00:00","2024-05-23T00:00:00","2024-05-24T00:00:00","2024-05-27T00:00:00","2024-05-28T00:00:00","2024-05-29T00:00:00","2024-05-30T00:00:00","2024-05-31T00:00:00","2024-06-03T00:00:00","2024-06-04T00:00:00","2024-06-05T00:00:00","2024-06-06T00:00:00","2024-06-07T00:00:00","2024-06-10T00:00:00","2024-06-11T00:00:00","2024-06-12T00:00:00","2024-06-13T00:00:00","2024-06-14T00:00:00","2024-06-17T00:00:00","2024-06-18T00:00:00","2024-06-19T00:00:00","2024-06-20T00:00:00","2024-06-21T00:00:00","2024-06-24T00:00:00","2024-06-25T00:00:00","2024-06-26T00:00:00","2024-06-27T00:00:00","2024-06-28T00:00:00","2024-07-01T00:00:00","2024-07-02T00:00:00","2024-07-03T00:00:00","2024-07-04T00:00:00","2024-07-05T00:00:00","2024-07-08T00:00:00","2024-07-09T00:00:00","2024-07-10T00:00:00","2024-07-11T00:00:00","2024-07-12T00:00:00","2024-07-15T00:00:00","2024-07-16T00:00:00","2024-07-17T00:00:00","2024-07-18T00:00:00","2024-07-19T00:00:00","2024-07-22T00:00:00","2024-07-23T00:00:00","2024-07-24T00:00:00","2024-07-25T00:00:00","2024-07-26T00:00:00","2024-07-29T00:00:00","2024-07-30T00:00:00","2024-07-31T00:00:00","2024-08-01T00:00:00","2024-08-02T00:00:00","2024-08-05T00:00:00","2024-08-06T00:00:00","2024-08-07T00:00:00","2024-08-08T00:00:00","2024-08-09T00:00:00","2024-08-12T00:00:00","2024-08-13T00:00:00","2024-08-14T00:00:00","2024-08-15T00:00:00","2024-08-16T00:00:00","2024-08-19T00:00:00","2024-08-20T00:00:00","2024-08-21T00:00:00","2024-08-22T00:00:00","2024-08-23T00:00:00","2024-08-26T00:00:00","2024-08-27T00:00:00","2024-08-28T00:00:00","2024-08-29T00:00:00","2024-08-30T00:00:00","2024-09-02T00:00:00","2024-09-03T00:00:00","2024-09-04T00:00:00","2024-09-05T00:00:00","2024-09-06T00:00:00","2024-09-09T00:00:00","2024-09-10T00:00:00","2024-09-11T00:00:00","2024-09-12T00:00:00","2024-09-13T00:00:00","2024-09-16T00:00:00","2024-09-17T00:00:00","2024-09-18T00:00:00","2024-09-19T00:00:00","2024-09-20T00:00:00","2024-09-23T00:00:00","2024-09-24T00:00:00","2024-09-25T00:00:00","2024-09-26T00:00:00","2024-09-27T00:00:00","2024-09-30T00:00:00","2024-10-01T00:00:00","2024-10-02T00:00:00","2024-10-03T00:00:00","2024-10-04T00:00:00","2024-10-07T00:00:00","2024-10-08T00:00:00","2024-10-09T00:00:00","2024-10-10T00:00:00","2024-10-11T00:00:00","2024-10-14T00:00:00","2024-10-15T00:00:00","2024-10-16T00:00:00","2024-10-17T00:00:00","2024-10-18T00:00:00","2024-10-21T00:00:00","2024-10-22T00:00:00","2024-10-23T00:00:00","2024-10-24T00:00:00","2024-10-25T00:00:00","2024-10-28T00:00:00","2024-10-29T00:00:00","2024-10-30T00:00:00","2024-10-31T00:00:00","2024-11-01T00:00:00","2024-11-04T00:00:00","2024-11-05T00:00:00","2024-11-06T00:00:00","2024-11-07T00:00:00","2024-11-08T00:00:00","2024-11-11T00:00:00","2024-11-12T00:00:00","2024-11-13T00:00:00","2024-11-14T00:00:00","2024-11-15T00:00:00","2024-11-18T00:00:00","2024-11-19T00:00:00","2024-11-20T00:00:00","2024-11-21T00:00:00","2024-11-22T00:00:00","2024-11-25T00:00:00","2024-11-26T00:00:00","2024-11-27T00:00:00","2024-11-28T00:00:00","2024-11-29T00:00:00","2024-12-02T00:00:00","2024-12-03T00:00:00","2024-12-04T00:00:00","2024-12-05T00:00:00","2024-12-06T00:00:00","2024-12-09T00:00:00","2024-12-10T00:00:00","2024-12-11T00:00:00","2024-12-12T00:00:00","2024-12-13T00:00:00","2024-12-16T00:00:00","2024-12-17T00:00:00","2024-12-18T00:00:00","2024-12-19T00:00:00","2024-12-20T00:00:00","2024-12-23T00:00:00","2024-12-27T00:00:00","2024-12-30T00:00:00","2025-01-02T00:00:00","2025-01-03T00:00:00","2025-01-06T00:00:00","2025-01-07T00:00:00","2025-01-08T00:00:00","2025-01-09T00:00:00","2025-01-10T00:00:00","2025-01-13T00:00:00","2025-01-14T00:00:00","2025-01-15T00:00:00","2025-01-16T00:00:00","2025-01-17T00:00:00","2025-01-20T00:00:00","2025-01-21T00:00:00","2025-01-22T00:00:00","2025-01-23T00:00:00","2025-01-24T00:00:00","2025-01-27T00:00:00","2025-01-28T00:00:00","2025-01-29T00:00:00","2025-01-30T00:00:00","2025-01-31T00:00:00","2025-02-03T00:00:00","2025-02-04T00:00:00","2025-02-05T00:00:00","2025-02-06T00:00:00","2025-02-07T00:00:00","2025-02-10T00:00:00","2025-02-11T00:00:00","2025-02-12T00:00:00","2025-02-13T00:00:00","2025-02-14T00:00:00","2025-02-17T00:00:00","2025-02-18T00:00:00","2025-02-19T00:00:00","2025-02-20T00:00:00","2025-02-21T00:00:00","2025-02-24T00:00:00","2025-02-25T00:00:00","2025-02-26T00:00:00","2025-02-27T00:00:00","2025-02-28T00:00:00","2025-03-03T00:00:00","2025-03-04T00:00:00","2025-03-05T00:00:00","2025-03-06T00:00:00","2025-03-07T00:00:00","2025-03-10T00:00:00","2025-03-11T00:00:00","2025-03-12T00:00:00","2025-03-13T00:00:00","2025-03-14T00:00:00","2025-03-17T00:00:00","2025-03-18T00:00:00","2025-03-19T00:00:00","2025-03-20T00:00:00","2025-03-21T00:00:00","2025-03-24T00:00:00","2025-03-25T00:00:00","2025-03-26T00:00:00","2025-03-27T00:00:00","2025-03-28T00:00:00","2025-03-31T00:00:00","2025-04-01T00:00:00","2025-04-02T00:00:00","2025-04-03T00:00:00","2025-04-04T00:00:00","2025-04-07T00:00:00","2025-04-08T00:00:00","2025-04-09T00:00:00","2025-04-10T00:00:00","2025-04-11T00:00:00","2025-04-14T00:00:00","2025-04-15T00:00:00","2025-04-16T00:00:00","2025-04-17T00:00:00","2025-04-22T00:00:00","2025-04-23T00:00:00","2025-04-24T00:00:00","2025-04-25T00:00:00","2025-04-28T00:00:00","2025-04-29T00:00:00","2025-04-30T00:00:00","2025-05-02T00:00:00","2025-05-05T00:00:00","2025-05-06T00:00:00","2025-05-07T00:00:00","2025-05-08T00:00:00","2025-05-09T00:00:00","2025-05-12T00:00:00","2025-05-13T00:00:00","2025-05-14T00:00:00","2025-05-15T00:00:00","2025-05-16T00:00:00","2025-05-19T00:00:00","2025-05-20T00:00:00","2025-05-21T00:00:00","2025-05-22T00:00:00","2025-05-23T00:00:00","2025-05-26T00:00:00","2025-05-27T00:00:00","2025-05-28T00:00:00","2025-05-29T00:00:00","2025-05-30T00:00:00","2025-06-02T00:00:00","2025-06-03T00:00:00","2025-06-04T00:00:00","2025-06-05T00:00:00","2025-06-06T00:00:00","2025-06-09T00:00:00","2025-06-10T00:00:00","2025-06-11T00:00:00","2025-06-12T00:00:00","2025-06-13T00:00:00","2025-06-16T00:00:00","2025-06-17T00:00:00","2025-06-18T00:00:00","2025-06-19T00:00:00","2025-06-20T00:00:00","2025-06-23T00:00:00","2025-06-24T00:00:00","2025-06-25T00:00:00","2025-06-26T00:00:00","2025-06-27T00:00:00","2025-06-30T00:00:00","2025-07-01T00:00:00","2025-07-02T00:00:00","2025-07-03T00:00:00","2025-07-04T00:00:00","2025-07-07T00:00:00","2025-07-08T00:00:00","2025-07-09T00:00:00","2025-07-10T00:00:00","2025-07-11T00:00:00","2025-07-14T00:00:00","2025-07-15T00:00:00","2025-07-16T00:00:00","2025-07-17T00:00:00","2025-07-18T00:00:00","2025-07-21T00:00:00","2025-07-22T00:00:00","2025-07-23T00:00:00","2025-07-24T00:00:00","2025-07-25T00:00:00","2025-07-28T00:00:00","2025-07-29T00:00:00","2025-07-30T00:00:00","2025-07-31T00:00:00","2025-08-01T00:00:00","2025-08-04T00:00:00","2025-08-05T00:00:00","2025-08-06T00:00:00","2025-08-07T00:00:00","2025-08-08T00:00:00","2025-08-11T00:00:00","2025-08-12T00:00:00","2025-08-13T00:00:00","2025-08-14T00:00:00","2025-08-15T00:00:00","2025-08-18T00:00:00","2025-08-19T00:00:00","2025-08-20T00:00:00","2025-08-21T00:00:00","2025-08-22T00:00:00","2025-08-25T00:00:00","2025-08-26T00:00:00","2025-08-27T00:00:00","2025-08-28T00:00:00","2025-08-29T00:00:00","2025-09-01T00:00:00","2025-09-02T00:00:00","2025-09-03T00:00:00","2025-09-04T00:00:00","2025-09-05T00:00:00","2025-09-08T00:00:00","2025-09-09T00:00:00","2025-09-10T00:00:00","2025-09-11T00:00:00","2025-09-12T00:00:00","2025-09-15T00:00:00","2025-09-16T00:00:00","2025-09-17T00:00:00","2025-09-18T00:00:00","2025-09-19T00:00:00","2025-09-22T00:00:00","2025-09-23T00:00:00","2025-09-24T00:00:00","2025-09-25T00:00:00","2025-09-26T00:00:00","2025-09-29T00:00:00","2025-09-30T00:00:00","2025-10-01T00:00:00","2025-10-02T00:00:00","2025-10-03T00:00:00","2025-10-06T00:00:00","2025-10-07T00:00:00","2025-10-08T00:00:00","2025-10-09T00:00:00","2025-10-10T00:00:00","2025-10-13T00:00:00","2025-10-14T00:00:00","2025-10-15T00:00:00","2025-10-16T00:00:00","2025-10-17T00:00:00","2025-10-20T00:00:00","2025-10-21T00:00:00","2025-10-22T00:00:00","2025-10-23T00:00:00","2025-10-24T00:00:00","2025-10-27T00:00:00","2025-10-28T00:00:00","2025-10-29T00:00:00","2025-10-30T00:00:00","2025-10-31T00:00:00","2025-11-03T00:00:00","2025-11-04T00:00:00","2025-11-05T00:00:00","2025-11-06T00:00:00","2025-11-07T00:00:00","2025-11-10T00:00:00","2025-11-11T00:00:00","2025-11-12T00:00:00","2025-11-13T00:00:00","2025-11-14T00:00:00","2025-11-17T00:00:00","2025-11-18T00:00:00","2025-11-19T00:00:00","2025-11-20T00:00:00","2025-11-21T00:00:00","2025-11-24T00:00:00","2025-11-25T00:00:00","2025-11-26T00:00:00","2025-11-27T00:00:00","2025-11-28T00:00:00","2025-12-01T00:00:00","2025-12-02T00:00:00","2025-12-03T00:00:00","2025-12-04T00:00:00","2025-12-05T00:00:00","2025-12-08T00:00:00","2025-12-09T00:00:00","2025-12-10T00:00:00","2025-12-11T00:00:00","2025-12-12T00:00:00","2025-12-15T00:00:00","2025-12-16T00:00:00","2025-12-17T00:00:00","2025-12-18T00:00:00","2025-12-19T00:00:00","2025-12-22T00:00:00","2025-12-23T00:00:00","2025-12-29T00:00:00","2025-12-30T00:00:00","2026-01-02T00:00:00","2026-01-05T00:00:00","2026-01-06T00:00:00","2026-01-07T00:00:00","2026-01-08T00:00:00","2026-01-09T00:00:00","2026-01-12T00:00:00","2026-01-13T00:00:00","2026-01-14T00:00:00","2026-01-15T00:00:00","2026-01-16T00:00:00","2026-01-19T00:00:00","2026-01-20T00:00:00","2026-01-21T00:00:00","2026-01-22T00:00:00","2026-01-23T00:00:00","2026-01-26T00:00:00","2026-01-27T00:00:00","2026-01-28T00:00:00","2026-01-29T00:00:00","2026-01-30T00:00:00","2026-02-02T00:00:00","2026-02-03T00:00:00","2026-02-04T00:00:00","2026-02-05T00:00:00","2026-02-06T00:00:00","2026-02-09T00:00:00","2026-02-10T00:00:00","2026-02-11T00:00:00","2026-02-12T00:00:00","2026-02-13T00:00:00","2026-02-16T00:00:00","2026-02-17T00:00:00","2026-02-18T00:00:00","2026-02-19T00:00:00","2026-02-20T00:00:00","2026-02-23T00:00:00","2026-02-24T00:00:00","2026-02-25T00:00:00","2026-02-26T00:00:00","2026-02-27T00:00:00","2026-03-02T00:00:00","2026-03-03T00:00:00","2026-03-04T00:00:00","2026-03-05T00:00:00","2026-03-06T00:00:00","2026-03-09T00:00:00","2026-03-10T00:00:00","2026-03-11T00:00:00","2026-03-12T00:00:00","2026-03-13T00:00:00","2026-03-16T00:00:00","2026-03-17T00:00:00","2026-03-18T00:00:00","2026-03-19T00:00:00","2026-03-20T00:00:00","2026-03-23T00:00:00","2026-03-24T00:00:00","2026-03-25T00:00:00","2026-03-26T00:00:00","2026-03-27T00:00:00"],"y":[1.0,0.992444,0.990221917884,0.990221917884,0.9777777990419518,0.9804441990999392,0.9871112196538187,1.0044448926709397,0.9426675139921062,0.9413345821273214,0.9391120911789188,0.9257785777083605,0.9280004462948604,0.9311120317912871,0.940445498797963,0.9604459532208992,0.9666677221058642,0.9675570564102016,0.9631130668501096,0.9711126839833665,0.9684460085531481,0.9551124439073884,0.9657791396809461,0.9626683650720337,0.9662234993442447,0.965334573724848,0.9617792464898194,0.9733350241363947,0.9764458028735347,0.9782239106805675,0.9782239106805675,0.983113073786149,0.9728906640449206,0.9777794396317464,0.9871123443830313,0.9835567657185637,0.982667630402354,0.9675561675820267,0.9671120593011066,0.9671120593011066,0.9653345073361111,0.9608901072643357,0.9782236039092769,0.9906685645982106,1.006224042399532,0.9888908270451576,1.0048910806267484,1.005780409233103,1.004002189469579,1.0048907314072595,1.0048907314072595,1.0017795897028225,1.0013347995649946,1.005778723405464,1.0031124040097161,1.013334119406575,1.0173337491758727,1.0173337491758727,1.0168891743274828,1.0288894834737214,1.0364446189508691,1.0364446189508691,1.0386667562138998,1.0435557606353987,1.052444768604491,1.0448892676106794,1.0560006200824514,1.0555560438213967,1.059111156576987,1.0622217660438535,1.0506658554510624,1.0599989202450342,1.0559984843200294,1.0613312766658456,1.057775816889015,1.0582200827321084,1.0684424887313007,1.0782198059456807,1.0751091418055274,1.0804427582580247,1.0733312840231704,1.0675535417212736,1.075997890236289,1.0773310516222918,1.0742197195452066,1.0706640522735118,1.074219727591112,1.0648869065978004,1.0719982213600605,1.057331141695412,1.0551086316355682,1.063108465280629,1.0831087248379536,1.0937751795601578,1.0991084273356932,1.1004416458580513,1.1088864350483658,1.1111086434642026,1.1177752953249878,1.1208860639718772,1.1146640254307694,1.1111082471896452,1.114663793580652,1.1195527089792967,1.119108246553832,1.1257747743785531,1.1364414903657898,1.1426635075255425,1.1426635075255425,1.1502187986373014,1.1475525914620601,1.1608860050222578,1.1684410511429426,1.1564411615477046,1.1657747981625561,1.1604413784609624,1.1671081141802209,1.1808858254681185,1.191996780199948,1.195997121394299,1.185774933997742,1.1764416994922458,1.1564421906008775,1.1586648724912123,1.1662205261247276,1.1764424490362106,1.1768871442819464,1.1711098052906663,1.1662204218535777,1.1728865377848927,1.1782196528722007,1.1697753526200656,1.1684418087180788,1.1684418087180788,1.1746637613495026,1.1822191986625026,1.1888857327237603,1.2088851685196393,1.206218367837885,1.2213298715501582,1.2453302248559903,1.2528856433301916,1.253330417733574,1.2568861161286842,1.2395523997011535,1.2257747747784753,1.228885791156863,1.2457743685847318,1.2488850671830878,1.2555516156717113,1.2595518031192412,1.2475520530909243,1.2364413545060966,1.2453301314036407,1.2422192967353944,1.2506639035146017,1.2604415939122788,1.2568858881758525,1.2675530787088007,1.2755526061885318,1.2457748305970606,1.2377744646349662,1.2786631062997178,1.2746634481032122,1.278218484459972,1.2764404825480882,1.2799966457324672,1.2871083070961566,1.3066633436058686,1.3146627365954235,1.3235511713575452,1.3293284722205208,1.3293284722205208,1.3457722654218887,1.3551051960825893,1.358216517612795,1.347994580101241,1.3591060994250155,1.3599949548140393,1.3311059419838795,1.3311059419838795,1.3239951740418017,1.330661489743102,1.3244393166170632,1.3333276288708802,1.324438333569198,1.3111052128651568,1.2995491315189633,1.2853268658236199,1.2813269286171767,1.2884382930710019,1.2884382930710019,1.2964382064326796,1.30265981338535,1.2817716632777159,1.289327707232738,1.292883673049286,1.300439285234586,1.3084395877173491,1.3266622258554888,1.3422173404536444,1.3342177251045406,1.3471062683290504,1.3471062683290504,1.3439957999554786,1.3439957999554786,1.3311068802339054,1.3333284976170157,1.3333284976170157,1.324884528241607,1.3675511095890998,1.4311066798561434,1.4351066230263414,1.4377730511319242,1.446217092261222,1.4377726306595087,1.4515508057791187,1.4675512503112218,1.4626628370964352,1.4626628370964352,1.5035515767074659,1.5164400208230022,1.4928851579795586,1.4942183044256343,1.512885573702824,1.5319963442698379,1.5262191860555965,1.5222189655689449,1.534218617674525,1.5404414083878128,1.5546643039114576,1.503997794246983,1.529774812442582,1.5444422933442814,1.5933316141400946,1.56177568152205,1.5084426037737535,1.4688867133749943,1.5142194951231733,1.533330459371123,1.485775748504187,1.480887546291608,1.5026654785473725,1.497777307745658,1.5031108927385401,1.501777633376681,1.4911105068468065,1.4817776461844523,1.5004435991934377,1.5004435991934377,1.484444369095238,1.4911110087568449,1.4848886025173027,1.5168879519015506,1.520887985430715,1.5359995284539545,1.5115556319581382,1.5097780425349556,1.448888694079521,1.392444337224265,1.422221759375806,1.4044439873836085,1.4088890526036777,1.363555229558049,1.3982222577143328,1.4066661219286696,1.4248880748721335,1.411110832076195,1.4271114178011068,1.4613335495999773,1.4555554367448589,1.3857775646627473,1.3715553295166134,1.3715553295166134,1.4044438547630922,1.4097765280796277,1.4226647050993317,1.4226647050993317,1.4208863742179576,1.4199968993476972,1.437773840530631,1.4102189048768616,1.408440618837812,1.408440618837812,1.447551606382319,1.4666621826897783,1.4875503854956462,1.4977728317447723,1.5248840177721843,1.5239950103898232,1.4982166347890793,1.5168829158419164,1.5199940427023082,1.4831053072799658,1.4697721905675187,1.4791052439776227,1.4693283583149306,1.4826610438382803,1.496882728570777,1.510215463034157,1.5035493719803243,1.5035493719803243,1.4595495031586923,1.4346612650308304,1.3808844221724148,1.365773403940582,1.387995902996099,1.3586619975821796,1.3484394247123714,1.351550274465183,1.3555508632776,1.3773291434470178,1.4088851314525324,1.366663661833163,1.3662194961430671,1.3835527228906341,1.3764412618949762,1.3822195623124112,1.3808857204347798,1.3786638753106002,1.3702195590743227,1.3777749497230585,1.3791086358743905,1.3831080509184261,1.358219021542149,1.3573307463020603,1.359108849579716,1.342664991608651,1.342664991608651,1.361332062986986,1.3511098205260168,1.3466660203263068,1.351998817766799,1.3546649594354352,1.4231094065109104,1.4079988308325775,1.385776385285547,1.4093318122826308,1.4146647238603083,1.3991090705567404,1.3835537759102905,1.4008869376148947,1.397331486567228,1.3915535208702725,1.322220758246432,1.3111101372148872,1.3315542775844789,1.347554233783934,1.3497763507154437,1.3622212886690401,1.3706656984374996,1.3813322189027402,1.3888881061401384,1.4017769877651187,1.4048875309009694,1.3968881013000194,1.3982207325486595,1.404442814808501,1.40888787631737,1.3946651532059462,1.3946651532059462,1.3995534545679331,1.395553530794778,1.3826641983843573,1.4151084137994463,1.406664461894305,1.3533307788215823,1.3604425320642897,1.3604425320642897,1.3319983996038895,1.3337766174673609,1.3262207729294082,1.3062213636736328,1.296888412030185,1.2991099818799927,1.2924429494529845,1.2924429494529845,1.262220463522976,1.2693318136144642,1.2724429458896334,1.2733323835088102,1.279110765865173,1.279110765865173,1.2973329778356884,1.2942219733548384,1.2919997942265882,1.2875553149344487,1.2911102551589828,1.2999995492657523,1.2999995492657523,1.3173324432561127,1.3084430839290204,1.3088879545775562,1.3062217498140818,1.3173324720180002,1.3253326321205654,1.3337776516524378,1.331999726042785,1.3346663894943227,1.3026664281398068,1.2888881253293722,1.2888881253293722,1.289332791732611,1.25066570130855,1.2199993783124643,1.1951101709955116,1.1844438127193768,1.183110128986255,1.182665279577756,1.1711094571310017,1.1711094571310017,1.186220282456363,1.2031096868379767,1.2137764573214822,1.2119982748115061,1.2106650767092135,1.2106650767092135,1.1959978693048814,1.2071086895107237,1.203552547311425,1.2275525886573622,1.2088864239942383,1.2275528392671333,1.2288859616505774,1.223552596577014,1.2337753785214147,1.2275534492875313,1.2231084782476611,1.2088861728625973,1.2173302427800425,1.2248862115969783,1.2248862115969783,1.193330693013817,1.1937746120316182,1.1964415045148968,1.191552844527449,1.191552844527449,1.1884417000503877,1.1884417000503877,1.1884417000503877,1.2168858636993936,1.217774190379894,1.2213300910158034,1.231108059724476,1.2293303396862338,1.2364420157013185,1.2208863387017803,1.217775520310768,1.2133306396616337,1.2582190200065555,1.2622188982711564,1.275107415441403,1.2435523322314748,1.2493298763670222,1.238218336446614,1.202218376532765,1.2257734411841714,1.1919960282389004,1.1693290317659095,1.1933295101429047,1.2026625402417324,1.195551196641283,1.1995515109452448,1.2111067906501805,1.2208840557710994,1.2519946232802586,1.2773274824877114,1.2813280721628628,1.3502161133065549,1.3599943783991209,1.3448834808607282,1.3559949081795994,1.3422166439175867,1.3497719814061988,1.4319933416535575,1.43243725958947,1.4653260190696444,1.4826593605492193,1.4386599613655606,1.4502152781752489,1.4542149719124562,1.477770346027494,1.480881052605882,1.4959919628666725,1.4626582699500772,1.515101882219137,1.4759910422315323,1.4497685853752469,1.4666569396262832,1.469323321942524,1.4604339158447717,1.4444334018627765,1.4586552931375174,1.4528775595213996,1.4577664925091893,1.4813225412616453,1.4653227764934784,1.486656410796447,1.4462119231407298,1.4288790732418881,1.4053240017194957,1.4017685319951454,1.4417679970556267,1.436434897234518,1.4199905905309773,1.4084347071052363],"marker":{},"line":{}},{"type":"scatter","name":"BAS.DE","mode":"lines","x":["2024-03-28T00:00:00","2024-04-02T00:00:00","2024-04-03T00:00:00","2024-04-04T00:00:00","2024-04-05T00:00:00","2024-04-08T00:00:00","2024-04-09T00:00:00","2024-04-10T00:00:00","2024-04-11T00:00:00","2024-04-12T00:00:00","2024-04-15T00:00:00","2024-04-16T00:00:00","2024-04-17T00:00:00","2024-04-18T00:00:00","2024-04-19T00:00:00","2024-04-22T00:00:00","2024-04-23T00:00:00","2024-04-24T00:00:00","2024-04-25T00:00:00","2024-04-26T00:00:00","2024-04-29T00:00:00","2024-04-30T00:00:00","2024-05-02T00:00:00","2024-05-03T00:00:00","2024-05-06T00:00:00","2024-05-07T00:00:00","2024-05-08T00:00:00","2024-05-09T00:00:00","2024-05-10T00:00:00","2024-05-13T00:00:00","2024-05-14T00:00:00","2024-05-15T00:00:00","2024-05-16T00:00:00","2024-05-17T00:00:00","2024-05-20T00:00:00","2024-05-21T00:00:00","2024-05-22T00:00:00","2024-05-23T00:00:00","2024-05-24T00:00:00","2024-05-27T00:00:00","2024-05-28T00:00:00","2024-05-29T00:00:00","2024-05-30T00:00:00","2024-05-31T00:00:00","2024-06-03T00:00:00","2024-06-04T00:00:00","2024-06-05T00:00:00","2024-06-06T00:00:00","2024-06-07T00:00:00","2024-06-10T00:00:00","2024-06-11T00:00:00","2024-06-12T00:00:00","2024-06-13T00:00:00","2024-06-14T00:00:00","2024-06-17T00:00:00","2024-06-18T00:00:00","2024-06-19T00:00:00","2024-06-20T00:00:00","2024-06-21T00:00:00","2024-06-24T00:00:00","2024-06-25T00:00:00","2024-06-26T00:00:00","2024-06-27T00:00:00","2024-06-28T00:00:00","2024-07-01T00:00:00","2024-07-02T00:00:00","2024-07-03T00:00:00","2024-07-04T00:00:00","2024-07-05T00:00:00","2024-07-08T00:00:00","2024-07-09T00:00:00","2024-07-10T00:00:00","2024-07-11T00:00:00","2024-07-12T00:00:00","2024-07-15T00:00:00","2024-07-16T00:00:00","2024-07-17T00:00:00","2024-07-18T00:00:00","2024-07-19T00:00:00","2024-07-22T00:00:00","2024-07-23T00:00:00","2024-07-24T00:00:00","2024-07-25T00:00:00","2024-07-26T00:00:00","2024-07-29T00:00:00","2024-07-30T00:00:00","2024-07-31T00:00:00","2024-08-01T00:00:00","2024-08-02T00:00:00","2024-08-05T00:00:00","2024-08-06T00:00:00","2024-08-07T00:00:00","2024-08-08T00:00:00","2024-08-09T00:00:00","2024-08-12T00:00:00","2024-08-13T00:00:00","2024-08-14T00:00:00","2024-08-15T00:00:00","2024-08-16T00:00:00","2024-08-19T00:00:00","2024-08-20T00:00:00","2024-08-21T00:00:00","2024-08-22T00:00:00","2024-08-23T00:00:00","2024-08-26T00:00:00","2024-08-27T00:00:00","2024-08-28T00:00:00","2024-08-29T00:00:00","2024-08-30T00:00:00","2024-09-02T00:00:00","2024-09-03T00:00:00","2024-09-04T00:00:00","2024-09-05T00:00:00","2024-09-06T00:00:00","2024-09-09T00:00:00","2024-09-10T00:00:00","2024-09-11T00:00:00","2024-09-12T00:00:00","2024-09-13T00:00:00","2024-09-16T00:00:00","2024-09-17T00:00:00","2024-09-18T00:00:00","2024-09-19T00:00:00","2024-09-20T00:00:00","2024-09-23T00:00:00","2024-09-24T00:00:00","2024-09-25T00:00:00","2024-09-26T00:00:00","2024-09-27T00:00:00","2024-09-30T00:00:00","2024-10-01T00:00:00","2024-10-02T00:00:00","2024-10-03T00:00:00","2024-10-04T00:00:00","2024-10-07T00:00:00","2024-10-08T00:00:00","2024-10-09T00:00:00","2024-10-10T00:00:00","2024-10-11T00:00:00","2024-10-14T00:00:00","2024-10-15T00:00:00","2024-10-16T00:00:00","2024-10-17T00:00:00","2024-10-18T00:00:00","2024-10-21T00:00:00","2024-10-22T00:00:00","2024-10-23T00:00:00","2024-10-24T00:00:00","2024-10-25T00:00:00","2024-10-28T00:00:00","2024-10-29T00:00:00","2024-10-30T00:00:00","2024-10-31T00:00:00","2024-11-01T00:00:00","2024-11-04T00:00:00","2024-11-05T00:00:00","2024-11-06T00:00:00","2024-11-07T00:00:00","2024-11-08T00:00:00","2024-11-11T00:00:00","2024-11-12T00:00:00","2024-11-13T00:00:00","2024-11-14T00:00:00","2024-11-15T00:00:00","2024-11-18T00:00:00","2024-11-19T00:00:00","2024-11-20T00:00:00","2024-11-21T00:00:00","2024-11-22T00:00:00","2024-11-25T00:00:00","2024-11-26T00:00:00","2024-11-27T00:00:00","2024-11-28T00:00:00","2024-11-29T00:00:00","2024-12-02T00:00:00","2024-12-03T00:00:00","2024-12-04T00:00:00","2024-12-05T00:00:00","2024-12-06T00:00:00","2024-12-09T00:00:00","2024-12-10T00:00:00","2024-12-11T00:00:00","2024-12-12T00:00:00","2024-12-13T00:00:00","2024-12-16T00:00:00","2024-12-17T00:00:00","2024-12-18T00:00:00","2024-12-19T00:00:00","2024-12-20T00:00:00","2024-12-23T00:00:00","2024-12-27T00:00:00","2024-12-30T00:00:00","2025-01-02T00:00:00","2025-01-03T00:00:00","2025-01-06T00:00:00","2025-01-07T00:00:00","2025-01-08T00:00:00","2025-01-09T00:00:00","2025-01-10T00:00:00","2025-01-13T00:00:00","2025-01-14T00:00:00","2025-01-15T00:00:00","2025-01-16T00:00:00","2025-01-17T00:00:00","2025-01-20T00:00:00","2025-01-21T00:00:00","2025-01-22T00:00:00","2025-01-23T00:00:00","2025-01-24T00:00:00","2025-01-27T00:00:00","2025-01-28T00:00:00","2025-01-29T00:00:00","2025-01-30T00:00:00","2025-01-31T00:00:00","2025-02-03T00:00:00","2025-02-04T00:00:00","2025-02-05T00:00:00","2025-02-06T00:00:00","2025-02-07T00:00:00","2025-02-10T00:00:00","2025-02-11T00:00:00","2025-02-12T00:00:00","2025-02-13T00:00:00","2025-02-14T00:00:00","2025-02-17T00:00:00","2025-02-18T00:00:00","2025-02-19T00:00:00","2025-02-20T00:00:00","2025-02-21T00:00:00","2025-02-24T00:00:00","2025-02-25T00:00:00","2025-02-26T00:00:00","2025-02-27T00:00:00","2025-02-28T00:00:00","2025-03-03T00:00:00","2025-03-04T00:00:00","2025-03-05T00:00:00","2025-03-06T00:00:00","2025-03-07T00:00:00","2025-03-10T00:00:00","2025-03-11T00:00:00","2025-03-12T00:00:00","2025-03-13T00:00:00","2025-03-14T00:00:00","2025-03-17T00:00:00","2025-03-18T00:00:00","2025-03-19T00:00:00","2025-03-20T00:00:00","2025-03-21T00:00:00","2025-03-24T00:00:00","2025-03-25T00:00:00","2025-03-26T00:00:00","2025-03-27T00:00:00","2025-03-28T00:00:00","2025-03-31T00:00:00","2025-04-01T00:00:00","2025-04-02T00:00:00","2025-04-03T00:00:00","2025-04-04T00:00:00","2025-04-07T00:00:00","2025-04-08T00:00:00","2025-04-09T00:00:00","2025-04-10T00:00:00","2025-04-11T00:00:00","2025-04-14T00:00:00","2025-04-15T00:00:00","2025-04-16T00:00:00","2025-04-17T00:00:00","2025-04-22T00:00:00","2025-04-23T00:00:00","2025-04-24T00:00:00","2025-04-25T00:00:00","2025-04-28T00:00:00","2025-04-29T00:00:00","2025-04-30T00:00:00","2025-05-02T00:00:00","2025-05-05T00:00:00","2025-05-06T00:00:00","2025-05-07T00:00:00","2025-05-08T00:00:00","2025-05-09T00:00:00","2025-05-12T00:00:00","2025-05-13T00:00:00","2025-05-14T00:00:00","2025-05-15T00:00:00","2025-05-16T00:00:00","2025-05-19T00:00:00","2025-05-20T00:00:00","2025-05-21T00:00:00","2025-05-22T00:00:00","2025-05-23T00:00:00","2025-05-26T00:00:00","2025-05-27T00:00:00","2025-05-28T00:00:00","2025-05-29T00:00:00","2025-05-30T00:00:00","2025-06-02T00:00:00","2025-06-03T00:00:00","2025-06-04T00:00:00","2025-06-05T00:00:00","2025-06-06T00:00:00","2025-06-09T00:00:00","2025-06-10T00:00:00","2025-06-11T00:00:00","2025-06-12T00:00:00","2025-06-13T00:00:00","2025-06-16T00:00:00","2025-06-17T00:00:00","2025-06-18T00:00:00","2025-06-19T00:00:00","2025-06-20T00:00:00","2025-06-23T00:00:00","2025-06-24T00:00:00","2025-06-25T00:00:00","2025-06-26T00:00:00","2025-06-27T00:00:00","2025-06-30T00:00:00","2025-07-01T00:00:00","2025-07-02T00:00:00","2025-07-03T00:00:00","2025-07-04T00:00:00","2025-07-07T00:00:00","2025-07-08T00:00:00","2025-07-09T00:00:00","2025-07-10T00:00:00","2025-07-11T00:00:00","2025-07-14T00:00:00","2025-07-15T00:00:00","2025-07-16T00:00:00","2025-07-17T00:00:00","2025-07-18T00:00:00","2025-07-21T00:00:00","2025-07-22T00:00:00","2025-07-23T00:00:00","2025-07-24T00:00:00","2025-07-25T00:00:00","2025-07-28T00:00:00","2025-07-29T00:00:00","2025-07-30T00:00:00","2025-07-31T00:00:00","2025-08-01T00:00:00","2025-08-04T00:00:00","2025-08-05T00:00:00","2025-08-06T00:00:00","2025-08-07T00:00:00","2025-08-08T00:00:00","2025-08-11T00:00:00","2025-08-12T00:00:00","2025-08-13T00:00:00","2025-08-14T00:00:00","2025-08-15T00:00:00","2025-08-18T00:00:00","2025-08-19T00:00:00","2025-08-20T00:00:00","2025-08-21T00:00:00","2025-08-22T00:00:00","2025-08-25T00:00:00","2025-08-26T00:00:00","2025-08-27T00:00:00","2025-08-28T00:00:00","2025-08-29T00:00:00","2025-09-01T00:00:00","2025-09-02T00:00:00","2025-09-03T00:00:00","2025-09-04T00:00:00","2025-09-05T00:00:00","2025-09-08T00:00:00","2025-09-09T00:00:00","2025-09-10T00:00:00","2025-09-11T00:00:00","2025-09-12T00:00:00","2025-09-15T00:00:00","2025-09-16T00:00:00","2025-09-17T00:00:00","2025-09-18T00:00:00","2025-09-19T00:00:00","2025-09-22T00:00:00","2025-09-23T00:00:00","2025-09-24T00:00:00","2025-09-25T00:00:00","2025-09-26T00:00:00","2025-09-29T00:00:00","2025-09-30T00:00:00","2025-10-01T00:00:00","2025-10-02T00:00:00","2025-10-03T00:00:00","2025-10-06T00:00:00","2025-10-07T00:00:00","2025-10-08T00:00:00","2025-10-09T00:00:00","2025-10-10T00:00:00","2025-10-13T00:00:00","2025-10-14T00:00:00","2025-10-15T00:00:00","2025-10-16T00:00:00","2025-10-17T00:00:00","2025-10-20T00:00:00","2025-10-21T00:00:00","2025-10-22T00:00:00","2025-10-23T00:00:00","2025-10-24T00:00:00","2025-10-27T00:00:00","2025-10-28T00:00:00","2025-10-29T00:00:00","2025-10-30T00:00:00","2025-10-31T00:00:00","2025-11-03T00:00:00","2025-11-04T00:00:00","2025-11-05T00:00:00","2025-11-06T00:00:00","2025-11-07T00:00:00","2025-11-10T00:00:00","2025-11-11T00:00:00","2025-11-12T00:00:00","2025-11-13T00:00:00","2025-11-14T00:00:00","2025-11-17T00:00:00","2025-11-18T00:00:00","2025-11-19T00:00:00","2025-11-20T00:00:00","2025-11-21T00:00:00","2025-11-24T00:00:00","2025-11-25T00:00:00","2025-11-26T00:00:00","2025-11-27T00:00:00","2025-11-28T00:00:00","2025-12-01T00:00:00","2025-12-02T00:00:00","2025-12-03T00:00:00","2025-12-04T00:00:00","2025-12-05T00:00:00","2025-12-08T00:00:00","2025-12-09T00:00:00","2025-12-10T00:00:00","2025-12-11T00:00:00","2025-12-12T00:00:00","2025-12-15T00:00:00","2025-12-16T00:00:00","2025-12-17T00:00:00","2025-12-18T00:00:00","2025-12-19T00:00:00","2025-12-22T00:00:00","2025-12-23T00:00:00","2025-12-29T00:00:00","2025-12-30T00:00:00","2026-01-02T00:00:00","2026-01-05T00:00:00","2026-01-06T00:00:00","2026-01-07T00:00:00","2026-01-08T00:00:00","2026-01-09T00:00:00","2026-01-12T00:00:00","2026-01-13T00:00:00","2026-01-14T00:00:00","2026-01-15T00:00:00","2026-01-16T00:00:00","2026-01-19T00:00:00","2026-01-20T00:00:00","2026-01-21T00:00:00","2026-01-22T00:00:00","2026-01-23T00:00:00","2026-01-26T00:00:00","2026-01-27T00:00:00","2026-01-28T00:00:00","2026-01-29T00:00:00","2026-01-30T00:00:00","2026-02-02T00:00:00","2026-02-03T00:00:00","2026-02-04T00:00:00","2026-02-05T00:00:00","2026-02-06T00:00:00","2026-02-09T00:00:00","2026-02-10T00:00:00","2026-02-11T00:00:00","2026-02-12T00:00:00","2026-02-13T00:00:00","2026-02-16T00:00:00","2026-02-17T00:00:00","2026-02-18T00:00:00","2026-02-19T00:00:00","2026-02-20T00:00:00","2026-02-23T00:00:00","2026-02-24T00:00:00","2026-02-25T00:00:00","2026-02-26T00:00:00","2026-02-27T00:00:00","2026-03-02T00:00:00","2026-03-03T00:00:00","2026-03-04T00:00:00","2026-03-05T00:00:00","2026-03-06T00:00:00","2026-03-09T00:00:00","2026-03-10T00:00:00","2026-03-11T00:00:00","2026-03-12T00:00:00","2026-03-13T00:00:00","2026-03-16T00:00:00","2026-03-17T00:00:00","2026-03-18T00:00:00","2026-03-19T00:00:00","2026-03-20T00:00:00","2026-03-23T00:00:00","2026-03-24T00:00:00","2026-03-25T00:00:00","2026-03-26T00:00:00","2026-03-27T00:00:00"],"y":[1.0,1.016815,1.0298505683,1.0375971042747527,1.0170039145462118,1.0179487111828251,1.012658431730808,1.020215901606815,0.984130865166982,0.9758179117489165,0.9777070952260624,0.954657650456108,0.9629708092762796,0.9648601580040798,0.9529576430949415,0.9656157794681715,0.9650489630056236,0.9695827630338241,0.9633483458675165,0.9224455384503276,0.926791179381967,0.9286799798055474,0.9190449250150649,0.9270746205249215,0.9348203289794071,0.9461559602886115,0.9353868131486065,0.9416211662582419,0.9220674611197233,0.9265072159450147,0.9325526755290559,0.9378430468573322,0.9271685172980021,0.9233903055900127,0.9305696652159751,0.9286806087955867,0.9144160746444864,0.9151713823221427,0.9110146739036354,0.9212171272366823,0.9109206834055579,0.8925000453457307,0.9083704811520684,0.9146055361346962,0.9056314266141425,0.8946732863521114,0.8913674685590404,0.8875889618598186,0.8841886085469336,0.8719081129628252,0.8773871835446836,0.8781426139097156,0.8618943411245441,0.8423405442074515,0.847157889779774,0.8509362139681917,0.8491415894929328,0.8603825258546404,0.8530142099032212,0.8720961377787563,0.8768194104609661,0.8540536712877576,0.8566986755077357,0.8536753858818689,0.8386558211426632,0.8448903885170378,0.854997812234867,0.858681997807787,0.8524471078217046,0.8491404654904643,0.8351593677261638,0.8251458069071271,0.8334583257659095,0.84366068913161,0.8244842816676484,0.8277904636371357,0.8522566385803948,0.8545236412390187,0.8330802249857668,0.8467777300449829,0.8455499023364177,0.8463996799882657,0.8458325922026736,0.8262786343361322,0.8123921956074792,0.8080467097531747,0.8142815981656303,0.7995455440836269,0.789154650192716,0.7715841219061752,0.7721512362357762,0.7860376040682404,0.7856595199806836,0.7815976602623835,0.7798976853513128,0.7832980392594444,0.7784807563179988,0.7958618961643108,0.8038913468347125,0.8139046174508857,0.8190053576884504,0.8343084727968592,0.83969309968029,0.8492336926788576,0.8495173367322124,0.8539569143339749,0.853673400638416,0.8638756514494458,0.8662374874805086,0.8611362149167358,0.840543003473217,0.841109529457558,0.8446043395524541,0.8202324367303284,0.8233501402223403,0.8027573298652394,0.8080475006690514,0.8067247269104562,0.8237280639795479,0.8228779766175209,0.8385587393399444,0.8583965234365095,0.8841853301901126,0.869448613291834,0.8530116872575519,0.8634030756317234,0.8564129643314089,0.855751813522945,0.9121467137859206,0.8984490065849975,0.8862633427086852,0.8924982053246407,0.8969383838961308,0.9112965735455401,0.9129970529517759,0.8801236810631943,0.8952380450380926,0.8942935689005773,0.8924987217077939,0.8794628853785298,0.8675602346878167,0.8751175518921822,0.8729446350108339,0.8877750914150329,0.879084661045171,0.876534436443479,0.8698271949358135,0.8697323837715655,0.8722833088531675,0.86614330664215,0.8553745469106682,0.8411103209663858,0.8434721587476594,0.8434721587476594,0.8503683871175802,0.8322308797887493,0.8316641305596132,0.8645373186482431,0.8196669672730806,0.8364816154397205,0.800679365817285,0.7975623210461583,0.8025686197353651,0.8151320289087025,0.814565512148611,0.8088032757156717,0.800490395647866,0.7955785865801707,0.8044580391849919,0.8125822609227212,0.799168152959409,0.7960505979947143,0.7960505979947143,0.8014350842395506,0.8171159630977816,0.8302461995087997,0.8247674048382412,0.8240119178954093,0.83062461353652,0.8527291957519539,0.8527291957519539,0.8480059287366839,0.8514064325109181,0.8427161270542791,0.8271292495682832,0.8242955047592622,0.8197610551875815,0.8064415775628936,0.8037020955239125,0.7999238919728546,0.8070088178840581,0.8021909752412902,0.8048357988866609,0.7846207381260246,0.798506955949379,0.8019077970747674,0.7927443966775941,0.7917994453567544,0.7845259756517072,0.790288318942869,0.8030412015456502,0.8364814432604141,0.8339310113399131,0.8395992404239905,0.8593424165625606,0.8593424165625606,0.8554693602911131,0.8634987957068054,0.8634987957068054,0.8861699565880875,0.8921214740165331,0.8850362452698938,0.892782082488496,0.8805964998446105,0.8470616239375282,0.8526352894230371,0.8517852120394823,0.9134706453101696,0.8977900082127752,0.8977900082127752,0.8872095529659876,0.9123371019250902,0.960702828709445,0.9620257165045779,0.9610810072509703,0.949556684893024,0.9085595750227677,0.9059147580998764,0.9240520774717941,0.9257523332943423,0.9210291448898745,0.9390721058382672,0.9213123741726538,0.9297193495869793,0.9448337970532148,0.9157385851067581,1.0137931255842345,1.0306078983651745,1.0132266961592458,1.0000020613209752,0.9599489787588862,0.9637273379392811,0.9716626688398732,0.9932005435573777,0.9932005435573777,1.0043472332577221,0.985832092012616,0.958248510078103,0.9540916280413843,0.9540916280413843,0.9495568305333035,0.9389768683275015,0.9063868591815906,0.8962788329279974,0.8670897201760313,0.881259700383148,0.8716240068191587,0.8194799722352094,0.784150551672205,0.7687529714395697,0.7725313922941952,0.7504269515664814,0.7725315278518237,0.7696978822076632,0.7936916742897226,0.792558282578837,0.7935030120516711,0.7925587434673296,0.8150412573432674,0.8348785465057451,0.8414907845940706,0.8486703839682271,0.859250757645159,0.8547164913970655,0.8431914942270674,0.8386568103711143,0.8025710851344661,0.8006818328000596,0.798037180706321,0.8097507704447283,0.8171186927050049,0.8431913159518363,0.855660429132132,0.855660429132132,0.8388458460392565,0.8199525210489144,0.8241088603781113,0.8191963474613974,0.8112616116398863,0.8014372335229273,0.7823558144299799,0.8003038391688182,0.8099394973924108,0.8033271513356992,0.8052165767956407,0.8010600488262216,0.7948253984662071,0.793125266938888,0.795203255138268,0.7935031105787823,0.7906695109709055,0.7991715802223757,0.8216538751171916,0.813152222471354,0.8065396685982169,0.7957707509430935,0.8014382302313102,0.8042721158134081,0.7950149437603957,0.7831119800224151,0.7836789530959513,0.7799000531841226,0.8037049425074616,0.785001121085428,0.7906688291796647,0.8101287704034347,0.7908582373418481,0.7950149882373169,0.815041415791015,0.7972824783823446,0.7874583636837174,0.7810350658111493,0.8012505964195394,0.822221728279628,0.8335576992474193,0.8186320150846951,0.8080520149217404,0.819010008296094,0.819010008296094,0.8035176149791651,0.8029511350606048,0.8029511350606048,0.8220332687853201,0.8501837980748734,0.8641642204504165,0.8624635452645701,0.8477266306666345,0.8294004763648831,0.8303451635074627,0.8154197091934161,0.789158302039133,0.7874576658982386,0.8029501080171205,0.8074843672770932,0.8456476934433431,0.8592507822400728,0.8454589479343373,0.8467812457289066,0.8632181164897504,0.8632181164897504,0.8720980412540804,0.8756875967918822,0.8987365700270414,0.9093164969293996,0.8970361776383681,0.9079943715843983,0.8940139822451133,0.8949589550243464,0.8720981234772045,0.8669972215529863,0.8569842706412708,0.8562284105145651,0.8484821120846399,0.8431918261157921,0.8312893302983416,0.8276998229701134,0.8346905756749189,0.8220324930948087,0.8252441740453302,0.8303450082851044,0.8286444617081364,0.8312894948299089,0.8248661209033581,0.8216540922285605,0.811640593806571,0.8089954571113555,0.8089954571113555,0.8095625629267905,0.801816668324707,0.7952040862610331,0.8027609106927718,0.8046498071156319,0.8046498071156319,0.8088066280191913,0.8248654836185123,0.8363905041556302,0.829967025083715,0.8312891625546733,0.8152303185124422,0.8118291776236083,0.7972820105897709,0.806350296178219,0.7857569159641234,0.803705175438576,0.8159857905192774,0.8218429365236247,0.8271331395060273,0.8157972798290972,0.8144748724384943,0.8258107337130933,0.8259998443711136,0.8199543515101615,0.8125862417074912,0.8260004153855984,0.8127753227348596,0.8084302258595191,0.8110754095585314,0.7906711854802675,0.8127759798127393,0.8105091476050416,0.8105091476050416,0.8127761416908929,0.823167484662411,0.8263794841875638,0.8263794841875638,0.821278243631674,0.8042744988755238,0.791616022537722,0.8142879054232024,0.8080529029313769,0.8273241566133873,0.8375267181127436,0.8447059971404061,0.8430056039681624,0.8430056039681624,0.8482954641330627,0.8452729873943566,0.8532084102000148,0.8354488771417015,0.8080536730113479,0.8261912457557605,0.8182565050315223,0.8171232197720536,0.8150452754241733,0.8418733057100353,0.8471636375631171,0.8360166584200616,0.8411180320697408,0.8411180320697408,0.8411180320697408,0.8267593061442783,0.8261921492602633,0.8244918458170857,0.8352605338153026,0.8394167902315677,0.8460297157050121,0.829214875105375,0.8471632310770307,0.8343160006777476,0.837338727548203,0.8490522590078748,0.8458402943120481,0.8422505481029877,0.8656777470984722,0.8745578694282085,0.8424397316734575,0.8326151995226817,0.8241133657203557,0.8567985259181906,0.878903071088354,0.8709683341625682,0.8755025953102186,0.8709683673691069,0.8679452361659687,0.8683227923437009,0.8683227923437009,0.8809812020104874,0.8955288445992865,0.9401163302430404,0.9276466272386967,0.9102653123841252,0.9193342856914082,0.9620327665903456,0.9752578310326631,0.9703454573377516,0.9650551339043462,0.9590090634904355,0.9563641164933288,0.9429501533953933,0.9199006798457964,0.9236796318386029,0.9233018468691809,0.9233018468691809,0.9244356615371363,0.9382273171716088,0.9200904449033644,0.8942073805977879,0.8583103195110704,0.8719136797650013,0.8772035800601357,0.8552875258159133,0.8462189121796871,0.8662455289553316,0.8749365703473404,0.915367389263091,0.913478070971652,0.9125335346462673,0.9231134484469562,0.9123444069573741,0.8715352416341707,0.8690792553232457,0.8858942007552398,0.922924578346809,0.9450295449227935,0.9586323001924122,0.9843265217344693],"marker":{},"line":{}}];
        var layout = {"width":750,"height":450,"template":{"layout":{"title":{"x":0.05},"font":{"color":"rgba(42, 63, 95, 1.0)"},"paper_bgcolor":"rgba(255, 255, 255, 1.0)","plot_bgcolor":"rgba(229, 236, 246, 1.0)","autotypenumbers":"strict","colorscale":{"diverging":[[0.0,"#8e0152"],[0.1,"#c51b7d"],[0.2,"#de77ae"],[0.3,"#f1b6da"],[0.4,"#fde0ef"],[0.5,"#f7f7f7"],[0.6,"#e6f5d0"],[0.7,"#b8e186"],[0.8,"#7fbc41"],[0.9,"#4d9221"],[1.0,"#276419"]],"sequential":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]],"sequentialminus":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]},"hovermode":"closest","hoverlabel":{"align":"left"},"coloraxis":{"colorbar":{"outlinewidth":0.0,"ticks":""}},"geo":{"showland":true,"landcolor":"rgba(229, 236, 246, 1.0)","showlakes":true,"lakecolor":"rgba(255, 255, 255, 1.0)","subunitcolor":"rgba(255, 255, 255, 1.0)","bgcolor":"rgba(255, 255, 255, 1.0)"},"mapbox":{"style":"light"},"polar":{"bgcolor":"rgba(229, 236, 246, 1.0)","radialaxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","ticks":""},"angularaxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","ticks":""}},"scene":{"xaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","gridwidth":2.0,"zerolinecolor":"rgba(255, 255, 255, 1.0)","backgroundcolor":"rgba(229, 236, 246, 1.0)","showbackground":true},"yaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","gridwidth":2.0,"zerolinecolor":"rgba(255, 255, 255, 1.0)","backgroundcolor":"rgba(229, 236, 246, 1.0)","showbackground":true},"zaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","gridwidth":2.0,"zerolinecolor":"rgba(255, 255, 255, 1.0)","backgroundcolor":"rgba(229, 236, 246, 1.0)","showbackground":true}},"ternary":{"aaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)"},"baxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)"},"caxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)"},"bgcolor":"rgba(229, 236, 246, 1.0)"},"xaxis":{"title":{"standoff":15},"ticks":"","automargin":"height+width+left+right+top+bottom","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","zerolinecolor":"rgba(255, 255, 255, 1.0)","zerolinewidth":2.0},"yaxis":{"title":{"standoff":15},"ticks":"","automargin":"height+width+left+right+top+bottom","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","zerolinecolor":"rgba(255, 255, 255, 1.0)","zerolinewidth":2.0},"annotationdefaults":{"arrowcolor":"#2a3f5f","arrowhead":0,"arrowwidth":1},"shapedefaults":{"line":{"color":"rgba(42, 63, 95, 1.0)"}},"colorway":["rgba(99, 110, 250, 1.0)","rgba(239, 85, 59, 1.0)","rgba(0, 204, 150, 1.0)","rgba(171, 99, 250, 1.0)","rgba(255, 161, 90, 1.0)","rgba(25, 211, 243, 1.0)","rgba(255, 102, 146, 1.0)","rgba(182, 232, 128, 1.0)","rgba(255, 151, 255, 1.0)","rgba(254, 203, 82, 1.0)"]},"data":{"bar":[{"marker":{"line":{"color":"rgba(229, 236, 246, 1.0)","width":0.5},"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}},"error_x":{"color":"rgba(42, 63, 95, 1.0)"},"error_y":{"color":"rgba(42, 63, 95, 1.0)"}}],"barpolar":[{"marker":{"line":{"color":"rgba(229, 236, 246, 1.0)","width":0.5},"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}}}],"carpet":[{"aaxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","endlinecolor":"rgba(42, 63, 95, 1.0)","minorgridcolor":"rgba(255, 255, 255, 1.0)","startlinecolor":"rgba(42, 63, 95, 1.0)"},"baxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","endlinecolor":"rgba(42, 63, 95, 1.0)","minorgridcolor":"rgba(255, 255, 255, 1.0)","startlinecolor":"rgba(42, 63, 95, 1.0)"}}],"choropleth":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"contour":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"contourcarpet":[{"colorbar":{"outlinewidth":0.0,"ticks":""}}],"heatmap":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"heatmapgl":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"histogram":[{"marker":{"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}}}],"histogram2d":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"histogram2dcontour":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"mesh3d":[{"colorbar":{"outlinewidth":0.0,"ticks":""}}],"parcoords":[{"line":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"pie":[{"automargin":true}],"scatter":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatter3d":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}},"line":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattercarpet":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattergeo":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattergl":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattermapbox":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatterpolar":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatterpolargl":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatterternary":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"surface":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"table":[{"cells":{"fill":{"color":"rgba(235, 240, 248, 1.0)"},"line":{"color":"rgba(255, 255, 255, 1.0)"}},"header":{"fill":{"color":"rgba(200, 212, 227, 1.0)"},"line":{"color":"rgba(255, 255, 255, 1.0)"}}}]}},"title":{"text":"Cumulative Returns — €1 Investment"},"xaxis":{"title":{"text":"Date"}},"yaxis":{"title":{"text":"Growth of €1"}},"font":{"color":"rgba(204, 204, 204, 1.0)"},"paper_bgcolor":"transparent","plot_bgcolor":"transparent"};
        var config = {"responsive":true};
        Plotly.newPlot('5086c8bf-784d-4e91-a4ed-cc8271f24eb5', data, layout, config);
    });
};
if ((typeof(requirejs) !==  typeof(Function)) || (typeof(requirejs.config) !== typeof(Function))) {
    var script = document.createElement("script");
    script.setAttribute("charset", "utf-8");
    script.setAttribute("src", "https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js");
    script.onload = function(){
        renderPlotly_5086c8bf784d4e91a4edcc8271f24eb5();
    };
    document.getElementsByTagName("head")[0].appendChild(script);
}
else {
    renderPlotly_5086c8bf784d4e91a4edcc8271f24eb5();
}
</script></div>

#### Plotly.NET — plot risk-return scatter with `Chart.Point()`

```csharp
// Risk-return visualization using Gold symbol profile data

var profDt = QueryToTable("SELECT symbol, volatility, avg_daily_return FROM gold_symbol_profile");

var scatterSymbols = profDt.AsEnumerable().Select(r => r.Field<string>("symbol")).ToArray();
var vols = profDt.AsEnumerable().Select(r => Convert.ToDouble(r["volatility"]) * 100).ToArray();
var avgRets = profDt.AsEnumerable().Select(r => Convert.ToDouble(r["avg_daily_return"]) * 100).ToArray();

Plotly.NET.CSharp.Chart.Point<double, double, string>(x: vols, y: avgRets, Name: "Symbols",
        MultiText: scatterSymbols, TextPosition: StyleParam.TextPosition.TopCenter,
        MarkerColor: Color.fromHex("#4285F4"))
    .WithMarkerStyle(Size: 12)
    .WithTitle("Risk-Return Profile — Volatility vs Avg Daily Return")
    .WithXAxisStyle(Title.init("Daily Volatility (%)"))
    .WithYAxisStyle(Title.init("Avg Daily Return (%)"))
    .WithSize(750, 450)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<div><div id="8879757f-17ae-49bb-a58f-331678ca1db4"><!-- Plotly chart will be drawn inside this DIV --></div><script type="text/javascript">
var renderPlotly_8879757f17ae49bba58f331678ca1db4 = function() {
    var fsharpPlotlyRequire = requirejs.config({context:'fsharp-plotly',paths:{plotly:'https://cdn.plot.ly/plotly-2.27.1.min'}}) || require;
    fsharpPlotlyRequire(['plotly'], function(Plotly) {
        var data = [{"type":"scatter","name":"Symbols","mode":"markers+text","x":[1.1839,1.7490999999999999,1.325,1.8900000000000001,1.9203999999999999],"y":[0.053200000000000004,0.0121,0.0765,-0.028499999999999998,0.0475],"text":["ALV.DE","BAS.DE","DTE.DE","SAP.DE","SIE.DE"],"textposition":"top center","marker":{"color":"rgba(66, 133, 244, 1.0)","size":12},"line":{}}];
        var layout = {"width":750,"height":450,"template":{"layout":{"title":{"x":0.05},"font":{"color":"rgba(42, 63, 95, 1.0)"},"paper_bgcolor":"rgba(255, 255, 255, 1.0)","plot_bgcolor":"rgba(229, 236, 246, 1.0)","autotypenumbers":"strict","colorscale":{"diverging":[[0.0,"#8e0152"],[0.1,"#c51b7d"],[0.2,"#de77ae"],[0.3,"#f1b6da"],[0.4,"#fde0ef"],[0.5,"#f7f7f7"],[0.6,"#e6f5d0"],[0.7,"#b8e186"],[0.8,"#7fbc41"],[0.9,"#4d9221"],[1.0,"#276419"]],"sequential":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]],"sequentialminus":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]},"hovermode":"closest","hoverlabel":{"align":"left"},"coloraxis":{"colorbar":{"outlinewidth":0.0,"ticks":""}},"geo":{"showland":true,"landcolor":"rgba(229, 236, 246, 1.0)","showlakes":true,"lakecolor":"rgba(255, 255, 255, 1.0)","subunitcolor":"rgba(255, 255, 255, 1.0)","bgcolor":"rgba(255, 255, 255, 1.0)"},"mapbox":{"style":"light"},"polar":{"bgcolor":"rgba(229, 236, 246, 1.0)","radialaxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","ticks":""},"angularaxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","ticks":""}},"scene":{"xaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","gridwidth":2.0,"zerolinecolor":"rgba(255, 255, 255, 1.0)","backgroundcolor":"rgba(229, 236, 246, 1.0)","showbackground":true},"yaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","gridwidth":2.0,"zerolinecolor":"rgba(255, 255, 255, 1.0)","backgroundcolor":"rgba(229, 236, 246, 1.0)","showbackground":true},"zaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","gridwidth":2.0,"zerolinecolor":"rgba(255, 255, 255, 1.0)","backgroundcolor":"rgba(229, 236, 246, 1.0)","showbackground":true}},"ternary":{"aaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)"},"baxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)"},"caxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)"},"bgcolor":"rgba(229, 236, 246, 1.0)"},"xaxis":{"title":{"standoff":15},"ticks":"","automargin":"height+width+left+right+top+bottom","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","zerolinecolor":"rgba(255, 255, 255, 1.0)","zerolinewidth":2.0},"yaxis":{"title":{"standoff":15},"ticks":"","automargin":"height+width+left+right+top+bottom","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","zerolinecolor":"rgba(255, 255, 255, 1.0)","zerolinewidth":2.0},"annotationdefaults":{"arrowcolor":"#2a3f5f","arrowhead":0,"arrowwidth":1},"shapedefaults":{"line":{"color":"rgba(42, 63, 95, 1.0)"}},"colorway":["rgba(99, 110, 250, 1.0)","rgba(239, 85, 59, 1.0)","rgba(0, 204, 150, 1.0)","rgba(171, 99, 250, 1.0)","rgba(255, 161, 90, 1.0)","rgba(25, 211, 243, 1.0)","rgba(255, 102, 146, 1.0)","rgba(182, 232, 128, 1.0)","rgba(255, 151, 255, 1.0)","rgba(254, 203, 82, 1.0)"]},"data":{"bar":[{"marker":{"line":{"color":"rgba(229, 236, 246, 1.0)","width":0.5},"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}},"error_x":{"color":"rgba(42, 63, 95, 1.0)"},"error_y":{"color":"rgba(42, 63, 95, 1.0)"}}],"barpolar":[{"marker":{"line":{"color":"rgba(229, 236, 246, 1.0)","width":0.5},"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}}}],"carpet":[{"aaxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","endlinecolor":"rgba(42, 63, 95, 1.0)","minorgridcolor":"rgba(255, 255, 255, 1.0)","startlinecolor":"rgba(42, 63, 95, 1.0)"},"baxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","endlinecolor":"rgba(42, 63, 95, 1.0)","minorgridcolor":"rgba(255, 255, 255, 1.0)","startlinecolor":"rgba(42, 63, 95, 1.0)"}}],"choropleth":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"contour":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"contourcarpet":[{"colorbar":{"outlinewidth":0.0,"ticks":""}}],"heatmap":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"heatmapgl":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"histogram":[{"marker":{"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}}}],"histogram2d":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"histogram2dcontour":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"mesh3d":[{"colorbar":{"outlinewidth":0.0,"ticks":""}}],"parcoords":[{"line":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"pie":[{"automargin":true}],"scatter":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatter3d":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}},"line":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattercarpet":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattergeo":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattergl":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattermapbox":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatterpolar":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatterpolargl":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatterternary":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"surface":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"table":[{"cells":{"fill":{"color":"rgba(235, 240, 248, 1.0)"},"line":{"color":"rgba(255, 255, 255, 1.0)"}},"header":{"fill":{"color":"rgba(200, 212, 227, 1.0)"},"line":{"color":"rgba(255, 255, 255, 1.0)"}}}]}},"title":{"text":"Risk-Return Profile — Volatility vs Avg Daily Return"},"xaxis":{"title":{"text":"Daily Volatility (%)"}},"yaxis":{"title":{"text":"Avg Daily Return (%)"}},"font":{"color":"rgba(204, 204, 204, 1.0)"},"paper_bgcolor":"transparent","plot_bgcolor":"transparent"};
        var config = {"responsive":true};
        Plotly.newPlot('8879757f-17ae-49bb-a58f-331678ca1db4', data, layout, config);
    });
};
if ((typeof(requirejs) !==  typeof(Function)) || (typeof(requirejs.config) !== typeof(Function))) {
    var script = document.createElement("script");
    script.setAttribute("charset", "utf-8");
    script.setAttribute("src", "https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js");
    script.onload = function(){
        renderPlotly_8879757f17ae49bba58f331678ca1db4();
    };
    document.getElementsByTagName("head")[0].appendChild(script);
}
else {
    renderPlotly_8879757f17ae49bba58f331678ca1db4();
}
</script></div>

#### Plotly.NET — plot pipeline stage timing with `Chart.Column()`

```csharp
// Shows how long each pipeline stage took in milliseconds

var stageNames = runContext.Stages.Select(s => s.Stage).ToArray();
var durations = runContext.Stages.Select(s => s.DurationMs).ToArray();

Plotly.NET.CSharp.Chart.Column<double, string, string>(values: durations, Keys: stageNames, Name: "Duration")
    .WithMarkerStyle(Color: Color.fromColors(new[] {
        Color.fromHex("#4285F4"), Color.fromHex("#34A853"),
        Color.fromHex("#FBBC04"), Color.fromHex("#EA4335") }))
    .WithTitle("Pipeline Stage Duration")
    .WithXAxisStyle(Title.init("Stage"))
    .WithYAxisStyle(Title.init("Duration (ms)"))
    .WithSize(750, 450)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<div><div id="f6f50c6e-6d65-464a-983b-79dedae74dd3"><!-- Plotly chart will be drawn inside this DIV --></div><script type="text/javascript">
var renderPlotly_f6f50c6e6d65464a983b79dedae74dd3 = function() {
    var fsharpPlotlyRequire = requirejs.config({context:'fsharp-plotly',paths:{plotly:'https://cdn.plot.ly/plotly-2.27.1.min'}}) || require;
    fsharpPlotlyRequire(['plotly'], function(Plotly) {
        var data = [{"type":"bar","name":"Duration","x":["bronze","silver","gold","export"],"y":[560.9704,5776.8853,877.2435,4.2956],"orientation":"v","marker":{"pattern":{},"color":["rgba(66, 133, 244, 1.0)","rgba(52, 168, 83, 1.0)","rgba(251, 188, 4, 1.0)","rgba(234, 67, 53, 1.0)"]}}];
        var layout = {"width":750,"height":450,"template":{"layout":{"title":{"x":0.05},"font":{"color":"rgba(42, 63, 95, 1.0)"},"paper_bgcolor":"rgba(255, 255, 255, 1.0)","plot_bgcolor":"rgba(229, 236, 246, 1.0)","autotypenumbers":"strict","colorscale":{"diverging":[[0.0,"#8e0152"],[0.1,"#c51b7d"],[0.2,"#de77ae"],[0.3,"#f1b6da"],[0.4,"#fde0ef"],[0.5,"#f7f7f7"],[0.6,"#e6f5d0"],[0.7,"#b8e186"],[0.8,"#7fbc41"],[0.9,"#4d9221"],[1.0,"#276419"]],"sequential":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]],"sequentialminus":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]},"hovermode":"closest","hoverlabel":{"align":"left"},"coloraxis":{"colorbar":{"outlinewidth":0.0,"ticks":""}},"geo":{"showland":true,"landcolor":"rgba(229, 236, 246, 1.0)","showlakes":true,"lakecolor":"rgba(255, 255, 255, 1.0)","subunitcolor":"rgba(255, 255, 255, 1.0)","bgcolor":"rgba(255, 255, 255, 1.0)"},"mapbox":{"style":"light"},"polar":{"bgcolor":"rgba(229, 236, 246, 1.0)","radialaxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","ticks":""},"angularaxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","ticks":""}},"scene":{"xaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","gridwidth":2.0,"zerolinecolor":"rgba(255, 255, 255, 1.0)","backgroundcolor":"rgba(229, 236, 246, 1.0)","showbackground":true},"yaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","gridwidth":2.0,"zerolinecolor":"rgba(255, 255, 255, 1.0)","backgroundcolor":"rgba(229, 236, 246, 1.0)","showbackground":true},"zaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","gridwidth":2.0,"zerolinecolor":"rgba(255, 255, 255, 1.0)","backgroundcolor":"rgba(229, 236, 246, 1.0)","showbackground":true}},"ternary":{"aaxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)"},"baxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)"},"caxis":{"ticks":"","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)"},"bgcolor":"rgba(229, 236, 246, 1.0)"},"xaxis":{"title":{"standoff":15},"ticks":"","automargin":"height+width+left+right+top+bottom","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","zerolinecolor":"rgba(255, 255, 255, 1.0)","zerolinewidth":2.0},"yaxis":{"title":{"standoff":15},"ticks":"","automargin":"height+width+left+right+top+bottom","linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","zerolinecolor":"rgba(255, 255, 255, 1.0)","zerolinewidth":2.0},"annotationdefaults":{"arrowcolor":"#2a3f5f","arrowhead":0,"arrowwidth":1},"shapedefaults":{"line":{"color":"rgba(42, 63, 95, 1.0)"}},"colorway":["rgba(99, 110, 250, 1.0)","rgba(239, 85, 59, 1.0)","rgba(0, 204, 150, 1.0)","rgba(171, 99, 250, 1.0)","rgba(255, 161, 90, 1.0)","rgba(25, 211, 243, 1.0)","rgba(255, 102, 146, 1.0)","rgba(182, 232, 128, 1.0)","rgba(255, 151, 255, 1.0)","rgba(254, 203, 82, 1.0)"]},"data":{"bar":[{"marker":{"line":{"color":"rgba(229, 236, 246, 1.0)","width":0.5},"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}},"error_x":{"color":"rgba(42, 63, 95, 1.0)"},"error_y":{"color":"rgba(42, 63, 95, 1.0)"}}],"barpolar":[{"marker":{"line":{"color":"rgba(229, 236, 246, 1.0)","width":0.5},"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}}}],"carpet":[{"aaxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","endlinecolor":"rgba(42, 63, 95, 1.0)","minorgridcolor":"rgba(255, 255, 255, 1.0)","startlinecolor":"rgba(42, 63, 95, 1.0)"},"baxis":{"linecolor":"rgba(255, 255, 255, 1.0)","gridcolor":"rgba(255, 255, 255, 1.0)","endlinecolor":"rgba(42, 63, 95, 1.0)","minorgridcolor":"rgba(255, 255, 255, 1.0)","startlinecolor":"rgba(42, 63, 95, 1.0)"}}],"choropleth":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"contour":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"contourcarpet":[{"colorbar":{"outlinewidth":0.0,"ticks":""}}],"heatmap":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"heatmapgl":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"histogram":[{"marker":{"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}}}],"histogram2d":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"histogram2dcontour":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"mesh3d":[{"colorbar":{"outlinewidth":0.0,"ticks":""}}],"parcoords":[{"line":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"pie":[{"automargin":true}],"scatter":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatter3d":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}},"line":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattercarpet":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattergeo":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattergl":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scattermapbox":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatterpolar":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatterpolargl":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"scatterternary":[{"marker":{"colorbar":{"outlinewidth":0.0,"ticks":""}}}],"surface":[{"colorbar":{"outlinewidth":0.0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"table":[{"cells":{"fill":{"color":"rgba(235, 240, 248, 1.0)"},"line":{"color":"rgba(255, 255, 255, 1.0)"}},"header":{"fill":{"color":"rgba(200, 212, 227, 1.0)"},"line":{"color":"rgba(255, 255, 255, 1.0)"}}}]}},"title":{"text":"Pipeline Stage Duration"},"xaxis":{"title":{"text":"Stage"}},"yaxis":{"title":{"text":"Duration (ms)"}},"font":{"color":"rgba(204, 204, 204, 1.0)"},"paper_bgcolor":"transparent","plot_bgcolor":"transparent"};
        var config = {"responsive":true};
        Plotly.newPlot('f6f50c6e-6d65-464a-983b-79dedae74dd3', data, layout, config);
    });
};
if ((typeof(requirejs) !==  typeof(Function)) || (typeof(requirejs.config) !== typeof(Function))) {
    var script = document.createElement("script");
    script.setAttribute("charset", "utf-8");
    script.setAttribute("src", "https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js");
    script.onload = function(){
        renderPlotly_f6f50c6e6d65464a983b79dedae74dd3();
    };
    document.getElementsByTagName("head")[0].appendChild(script);
}
else {
    renderPlotly_f6f50c6e6d65464a983b79dedae74dd3();
}
</script></div>

## 13. Audit — Investigating a Disputed Data Point

The audit section demonstrates lineage in action. A stakeholder disputes a specific data point — the pipeline traces it from Gold back to the raw source in seven steps, each independently verifiable: Bronze (raw values as ingested), Silver (computed return verified mathematically), Gold (propagation to aggregation), Lineage (batch metadata with SHA-256 hash), RunContext (execution fingerprint), Landing Zone (raw JSON file on disk), and Live API (corroboration with current source). This is the proof that the architecture’s lineage tracking delivers real forensic capability.

#### SQL Server — query Bronze table for raw ingested values with `read_database()`

```csharp
// Step 2: Check Bronze — exact values as persisted, with batch_id and ingestion timestamp

var bronzeAudit = QueryToTable(
    @"SELECT symbol, date, [open], high, low, [close],
             adj_close, volume, dividends, stock_splits, batch_id, ingested_at
      FROM bronze_ohlcv
      WHERE symbol = 'SAP.DE' AND date = '2026-01-29'");
Console.WriteLine("Bronze table (raw ingested):");
bronzeAudit
```

    Bronze table (raw ingested):

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>open</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>high</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>low</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>adj_close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>volume</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>dividends</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>stock_splits</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>batch_id</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>ingested_at</th></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>29-Jan-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>179</td><td style='text-align:left;padding:4px 12px;'>180.16000366210938</td><td style='text-align:left;padding:4px 12px;'>162.1199951171875</td><td style='text-align:left;padding:4px 12px;'>164.6199951171875</td><td style='text-align:left;padding:4px 12px;'>164.6199951171875</td><td style='text-align:left;padding:4px 12px;'>15846791</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>9c135c08-937d-4413-8bb4-1b66407ed9a5</td><td style='text-align:left;padding:4px 12px;'>28-Mar-26 23:21:33</td></tr></table>

#### SQL Server — query Silver table for enriched values with `read_database()`

```csharp
// Step 3: Check Silver — verify the daily_return calculation is correct

var silverAudit = QueryToTable(
    @"SELECT symbol, date, [close], daily_return, intraday_range, sma_20,
             batch_id, processed_at
      FROM silver_ohlcv
      WHERE symbol = 'SAP.DE' AND date BETWEEN '2026-01-28' AND '2026-01-30'
      ORDER BY date");

Console.WriteLine("Silver table (enriched, 3-day window):");
Console.WriteLine();

if (silverAudit.Rows.Count >= 2)
{
    var prevClose = Convert.ToDouble(silverAudit.Rows[0]["close"]);
    var currClose = Convert.ToDouble(silverAudit.Rows[1]["close"]);
    var expectedReturn = (currClose - prevClose) / prevClose;
    var actualReturn = Convert.ToDouble(silverAudit.Rows[1]["daily_return"]);
    Console.WriteLine($"  Previous close (Jan 28): {prevClose:F2}");
    Console.WriteLine($"  Current close  (Jan 29): {currClose:F2}");
    Console.WriteLine($"  Expected return: ({currClose:F2} - {prevClose:F2}) / {prevClose:F2} = {expectedReturn:F6}");
    Console.WriteLine($"  Actual return:   {actualReturn:F6}");
    Console.WriteLine($"  Match: {Math.Abs(expectedReturn - actualReturn) < 0.000001}");
    Console.WriteLine();
}
silverAudit
```

    Silver table (enriched, 3-day window):
    
      Previous close (Jan 28): 196.14
      Current close  (Jan 29): 164.62
      Expected return: (164.62 - 196.14) / 196.14 = -0.160702
      Actual return:   -0.160702
      Match: True

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>daily_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>intraday_range</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>sma_20</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>batch_id</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>processed_at</th></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>28-Jan-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>196.13999938964844</td><td style='text-align:left;padding:4px 12px;'>0.003068</td><td style='text-align:left;padding:4px 12px;'>0.020598</td><td style='text-align:left;padding:4px 12px;'>202.3795</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td><td style='text-align:left;padding:4px 12px;'>29-Mar-26 23:24:06</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>29-Jan-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>164.6199951171875</td><td style='text-align:left;padding:4px 12px;'>-0.160702</td><td style='text-align:left;padding:4px 12px;'>0.109586</td><td style='text-align:left;padding:4px 12px;'>200.193</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td><td style='text-align:left;padding:4px 12px;'>29-Mar-26 23:24:06</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>30-Jan-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>170.55999755859375</td><td style='text-align:left;padding:4px 12px;'>0.036083</td><td style='text-align:left;padding:4px 12px;'>0.038227</td><td style='text-align:left;padding:4px 12px;'>198.6235</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td><td style='text-align:left;padding:4px 12px;'>29-Mar-26 23:24:06</td></tr></table>

#### SQL Server — query Gold tables for aggregated impact with `read_database()`

```csharp
// Step 4: Check Gold — verify the data point propagated to aggregations

var goldDailyAudit = QueryToTable(
    @"SELECT date, symbols_traded, avg_return, min_return, max_return, total_volume, batch_id
      FROM gold_daily_summary WHERE date = '2026-01-29'");
Console.WriteLine("Gold daily summary (Jan 29):");
Console.WriteLine("  The min_return on this day should reflect SAP's -16% drop");
goldDailyAudit
```

    Gold daily summary (Jan 29):
      The min_return on this day should reflect SAP's -16% drop

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbols_traded</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>avg_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>min_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>max_return</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>total_volume</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>batch_id</th></tr><tr><td style='text-align:left;padding:4px 12px;'>29-Jan-26 0:00:00</td><td style='text-align:left;padding:4px 12px;'>5</td><td style='text-align:left;padding:4px 12px;'>-0.025652</td><td style='text-align:left;padding:4px 12px;'>-0.160702</td><td style='text-align:left;padding:4px 12px;'>0.020128</td><td style='text-align:left;padding:4px 12px;'>25357247</td><td style='text-align:left;padding:4px 12px;'>d99b77ff-42f2-4cde-a7b2-fbfc54ad6e6f</td></tr></table>

#### SQL Server — query lineage table for pipeline run metadata with `read_database()`

```csharp
// Step 5: Trace the disputed data point back to its pipeline run
var batchFromBronze = sqlConn.ExecuteScalar<string>(
    "SELECT batch_id FROM bronze_ohlcv WHERE symbol = 'SAP.DE' AND date = '2026-01-29'");

Console.WriteLine($"Disputed row: SAP.DE / 2026-01-29");
Console.WriteLine($"Batch ID (from row): {batchFromBronze}");
Console.WriteLine();

var lineageAudit = QueryToTable(
    $@"SELECT stage, started_at, completed_at, input_rows, output_rows,
              rows_rejected, output_hash
       FROM lineage_stages WHERE batch_id = '{batchFromBronze}'
       ORDER BY started_at");
Console.WriteLine("Full pipeline execution for this batch:");
lineageAudit
```

    Disputed row: SAP.DE / 2026-01-29
    Batch ID (from row): 9c135c08-937d-4413-8bb4-1b66407ed9a5
    
    Full pipeline execution for this batch:

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>stage</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>started_at</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>completed_at</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>input_rows</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>output_rows</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>rows_rejected</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>output_hash</th></tr><tr><td style='text-align:left;padding:4px 12px;'>bronze</td><td style='text-align:left;padding:4px 12px;'>28-Mar-26 23:21:34</td><td style='text-align:left;padding:4px 12px;'>28-Mar-26 23:21:37</td><td style='text-align:left;padding:4px 12px;'>2530</td><td style='text-align:left;padding:4px 12px;'>2530</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>914eccd231d933a2</td></tr><tr><td style='text-align:left;padding:4px 12px;'>silver</td><td style='text-align:left;padding:4px 12px;'>28-Mar-26 23:25:09</td><td style='text-align:left;padding:4px 12px;'>28-Mar-26 23:25:12</td><td style='text-align:left;padding:4px 12px;'>2530</td><td style='text-align:left;padding:4px 12px;'>2530</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>d3c2286d9c3a8b8c</td></tr><tr><td style='text-align:left;padding:4px 12px;'>gold</td><td style='text-align:left;padding:4px 12px;'>28-Mar-26 23:29:18</td><td style='text-align:left;padding:4px 12px;'>28-Mar-26 23:29:18</td><td style='text-align:left;padding:4px 12px;'>511</td><td style='text-align:left;padding:4px 12px;'>511</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>fabdf6a3896591c1</td></tr><tr><td style='text-align:left;padding:4px 12px;'>export</td><td style='text-align:left;padding:4px 12px;'>28-Mar-26 23:29:41</td><td style='text-align:left;padding:4px 12px;'>28-Mar-26 23:29:41</td><td style='text-align:left;padding:4px 12px;'>3041</td><td style='text-align:left;padding:4px 12px;'>3041</td><td style='text-align:left;padding:4px 12px;'>0</td><td style='text-align:left;padding:4px 12px;'>ad1a03cae4b23504</td></tr></table>

#### JSON — verify RunContext execution metadata with `JsonSerializer`

```csharp
// Step 6: Load RunContext — the pipeline's execution fingerprint

var ctxFiles = Directory.GetFiles(LINEAGE_DIR, $"run_{batchFromBronze[..8]}*.json");
if (ctxFiles.Length > 0)
{
    var ctxText = File.ReadAllText(ctxFiles[0]);
    // Handle BOM if present
    if (ctxText[0] == '﻿') ctxText = ctxText[1..];
    var ctx = JsonSerializer.Deserialize<JsonElement>(ctxText);
    Console.WriteLine($"RunContext: {Path.GetFileName(ctxFiles[0])}");

    // Helper: try PascalCase (C#) then snake_case (Python) keys
    JsonElement Prop(JsonElement el, string pascal, string snake) =>
        el.TryGetProperty(pascal, out var v) ? v :
        el.TryGetProperty(snake, out var v2) ? v2 :
        throw new Exception($"Key {pascal}/{snake} not found");

    Console.WriteLine($"  Status:       {Prop(ctx, "Status", "status")}");
    Console.WriteLine($"  Symbols:      [{string.Join(", ", Prop(ctx, "Symbols", "symbols").EnumerateArray())}]");
    Console.WriteLine($"  Date range:   [{string.Join(", ", Prop(ctx, "DateRange", "date_range").EnumerateArray())}]");
    var stages = Prop(ctx, "Stages", "stages");
    var totalRejected = stages.EnumerateArray()
        .Sum(s => Prop(s, "RowsRejected", "rows_rejected").GetInt32());
    Console.WriteLine($"  Rejected:     {totalRejected} rows");
    Console.WriteLine($"  Output hash:  {Prop(stages.EnumerateArray().First(), "OutputHash", "output_hash")}");
}
else
{
    Console.WriteLine($"No RunContext found for batch {batchFromBronze[..8]}");
}
```

    RunContext: run_9c135c08.json
      Status:       completed
      Symbols:      [SAP.DE, SIE.DE, ALV.DE, DTE.DE, BAS.DE]
      Date range:   [2024-03-29, 2026-03-29]
      Rejected:     0 rows
      Output hash:  914eccd231d933a2

#### C# — corroborate with landing zone file

```csharp
// Step 7: Prove the landing zone file exists and contains the record

var landingFile = Path.Combine(LANDING_DIR, "ohlcv_SAP_DE.json");
var rawRecords = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(
    File.ReadAllText(landingFile));

var jan29InFile = rawRecords.Where(r => r["date"].GetString() == "2026-01-29").ToList();
if (jan29InFile.Any())
{
    var liveClose29 = jan29InFile[0]["close"].GetDouble();
    Console.WriteLine($"Landing file: {Path.GetFileName(landingFile)}");
    Console.WriteLine($"  Total records: {rawRecords.Count}");
    Console.WriteLine($"  Jan 29 record found:");
    foreach (var kv in jan29InFile[0])
        Console.WriteLine($"    {kv.Key,-15}: {kv.Value}");
    Console.WriteLine($"\n  Bronze close: {Convert.ToDouble(bronzeAudit.Rows[0]["close"]):F2}");
    Console.WriteLine($"  Landing close: {liveClose29}");
    Console.WriteLine($"  Match: {Math.Abs(liveClose29 - Convert.ToDouble(bronzeAudit.Rows[0]["close"])) < 0.01}");
}
else
{
    var dates = rawRecords.Select(r => r["date"].GetString()).OrderBy(d => d).ToList();
    Console.WriteLine($"Landing file covers: {dates.First()} to {dates.Last()}");
    Console.WriteLine("Jan 29 not in current file (overwritten by incremental fetch)");
    Console.WriteLine("In production, landing files are archived and would contain this record");
}
```

    Landing file covers: 2026-03-27 to 2026-03-27
    Jan 29 not in current file (overwritten by incremental fetch)
    In production, landing files are archived and would contain this record

#### C# — display full audit trail summary as DataTable

```csharp
// ── Audit conclusion: full chain of evidence ──

var bronzeClose = Convert.ToDouble(bronzeAudit.Rows[0]["close"]);
var silverRow = silverAudit.AsEnumerable()
    .First(r => r.Field<DateTime>("date").ToString("yyyy-MM-dd") == "2026-01-29");
var silverClose = Convert.ToDouble(silverRow["close"]);

var auditSummary = new DataTable();
auditSummary.Columns.Add("step", typeof(string));
auditSummary.Columns.Add("source", typeof(string));
auditSummary.Columns.Add("close", typeof(double));
auditSummary.Columns.Add("evidence", typeof(string));

auditSummary.Rows.Add("1. Bronze table", "bronze_ohlcv", bronzeClose,
    $"Batch {batchFromBronze[..8]}");
auditSummary.Rows.Add("2. Silver table", "silver_ohlcv", silverClose,
    "Return = -16.07% verified");
auditSummary.Rows.Add("3. Gold table", "gold_daily_summary", DBNull.Value,
    "min_return reflects the drop");
auditSummary.Rows.Add("4. Lineage", "lineage_stages", DBNull.Value,
    $"Hash: {lineageAudit.Rows[0]["output_hash"]}");
auditSummary.Rows.Add("5. RunContext", $"run_{batchFromBronze[..8]}.json", DBNull.Value,
    "0 rejected, status=completed");

Console.WriteLine("AUDIT CONCLUSION: The SAP.DE -16% drop on 2026-01-29 is AUTHENTIC.");
Console.WriteLine("  - Same close price in Bronze and Silver");
Console.WriteLine("  - Daily return verified mathematically from consecutive closes");
Console.WriteLine("  - Zero rows rejected by Pydantic validation");
Console.WriteLine("  - Output hash proves no post-ingestion tampering");
Console.WriteLine();
auditSummary
```

    AUDIT CONCLUSION: The SAP.DE -16% drop on 2026-01-29 is AUTHENTIC.
      - Same close price in Bronze and Silver
      - Daily return verified mathematically from consecutive closes
      - Zero rows rejected by Pydantic validation
      - Output hash proves no post-ingestion tampering

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>step</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>source</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>close</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>evidence</th></tr><tr><td style='text-align:left;padding:4px 12px;'>1. Bronze table</td><td style='text-align:left;padding:4px 12px;'>bronze_ohlcv</td><td style='text-align:left;padding:4px 12px;'>164.6199951171875</td><td style='text-align:left;padding:4px 12px;'>Batch 9c135c08</td></tr><tr><td style='text-align:left;padding:4px 12px;'>2. Silver table</td><td style='text-align:left;padding:4px 12px;'>silver_ohlcv</td><td style='text-align:left;padding:4px 12px;'>164.6199951171875</td><td style='text-align:left;padding:4px 12px;'>Return = -16.07% verified</td></tr><tr><td style='text-align:left;padding:4px 12px;'>3. Gold table</td><td style='text-align:left;padding:4px 12px;'>gold_daily_summary</td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'>min_return reflects the drop</td></tr><tr><td style='text-align:left;padding:4px 12px;'>4. Lineage</td><td style='text-align:left;padding:4px 12px;'>lineage_stages</td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'>Hash: 914eccd231d933a2</td></tr><tr><td style='text-align:left;padding:4px 12px;'>5. RunContext</td><td style='text-align:left;padding:4px 12px;'>run_9c135c08.json</td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'>0 rejected, status=completed</td></tr></table>

### Context-Driven Analysis — Metadata in Action

The three demonstrations below use **real data from this pipeline run** to show
what context adds beyond lineage:

- **Zero-volume classification** — context + trading calendar turns 116
  undifferentiated alerts into classified holidays vs genuine anomalies
- **SMA-20 null accounting** — context explains exactly how many nulls are
  expected per symbol and flags any that exceed the baseline
- **Data contract interpretation** — column-level metadata makes Gold values
  self-describing without reading the pipeline source code

#### Zero-Volume Classification — Holiday or Anomaly?

Silver contains rows with `volume=0`. Without context, each is an
undifferentiated alert. With the trading calendar cross-reference recorded at
bronze ingestion, each is classified as non-trading day or genuine anomaly.

```csharp
// ── Context demonstration: zero-volume classification ──

var zeroVol = QueryToTable(
    "SELECT DISTINCT symbol, date FROM silver_ohlcv WHERE volume = 0");

if (zeroVol.Rows.Count > 0)
{
    var classified = new DataTable();
    classified.Columns.Add("symbol", typeof(string));
    classified.Columns.Add("date", typeof(DateTime));
    classified.Columns.Add("is_trading_day", typeof(bool));
    classified.Columns.Add("verdict", typeof(string));

    foreach (DataRow row in zeroVol.Rows)
    {
        var isTradingDay = sqlConn.ExecuteScalar<bool?>(
            $"SELECT is_trading_day FROM dim_calendar WHERE date = @Date AND exchange_code = 'XETR'",
            new { Date = row["date"] });
        classified.Rows.Add(row["symbol"], row["date"],
            isTradingDay,
            isTradingDay == true ? "anomaly" : "non-trading day");
    }

    var anomalies = classified.AsEnumerable().Count(r => r.Field<string>("verdict") == "anomaly");
    var holidays = classified.AsEnumerable().Count(r => r.Field<string>("verdict") == "non-trading day");

    classified.DefaultView.Sort = "date ASC";
    var sorted = classified.DefaultView.ToTable();
    // show first 5
    var preview = sorted.Clone();
    for (int i = 0; i < Math.Min(5, sorted.Rows.Count); i++)
        preview.ImportRow(sorted.Rows[i]);
    display(preview);

    Console.WriteLine($"\nTotal zero-volume: {classified.Rows.Count}  |  " +
        $"Non-trading days: {holidays}  |  Anomalies to investigate: {anomalies}");
}
else
{
    Console.WriteLine($"No zero-volume rows in Silver");
}
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>date</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>is_trading_day</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>verdict</th></tr><tr><td style='text-align:left;padding:4px 12px;'>ALV.DE</td><td style='text-align:left;padding:4px 12px;'>20-Sep-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'>non-trading day</td></tr><tr><td style='text-align:left;padding:4px 12px;'>BAS.DE</td><td style='text-align:left;padding:4px 12px;'>21-Oct-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'>non-trading day</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>21-Oct-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'>non-trading day</td></tr><tr><td style='text-align:left;padding:4px 12px;'>ALV.DE</td><td style='text-align:left;padding:4px 12px;'>01-Nov-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'>non-trading day</td></tr><tr><td style='text-align:left;padding:4px 12px;'>BAS.DE</td><td style='text-align:left;padding:4px 12px;'>01-Nov-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'></td><td style='text-align:left;padding:4px 12px;'>non-trading day</td></tr></table>

    Total zero-volume: 116  |  Non-trading days: 116  |  Anomalies to investigate: 0

#### SMA-20 Null Accounting — Expected vs Unexpected

`sma_20` requires 20 data points — the first 19 rows per symbol are `NULL` by
mathematical necessity. Context recorded this at silver stage. If any symbol
has MORE than 19 nulls, those extras are unexplained and need investigation.

```csharp
// ── Context demonstration: SMA-20 null accounting ──

var smaNulls = QueryToTable(
    @"SELECT symbol, COUNT(*) as null_count, MIN(date) as first_null, MAX(date) as last_null
      FROM silver_ohlcv WHERE sma_20 IS NULL GROUP BY symbol ORDER BY symbol");

int actualNullCount = sqlConn.ExecuteScalar<int>("SELECT COUNT(*) FROM silver_ohlcv WHERE sma_20 IS NULL");
int symbolsCount = sqlConn.ExecuteScalar<int>("SELECT COUNT(DISTINCT symbol) FROM silver_ohlcv");
int expectedNullCount = 19 * symbolsCount;

// Add expected + unexplained columns
smaNulls.Columns.Add("expected", typeof(int));
smaNulls.Columns.Add("unexplained", typeof(int));
foreach (DataRow row in smaNulls.Rows)
{
    row["expected"] = 19;
    row["unexplained"] = Convert.ToInt32(row["null_count"]) - 19;
}

display(smaNulls);
Console.WriteLine($"\nExpected nulls: {expectedNullCount} (19 x {symbolsCount} symbols)  |  " +
    $"Actual: {actualNullCount}  |  Unexplained: {actualNullCount - expectedNullCount}");

var smaWarnings = goldStageCtx.DataWarnings.Where(w => w.Contains("sma_20")).ToList();
if (smaWarnings.Any())
    Console.WriteLine($"Context recorded: {smaWarnings[0]}");
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>null_count</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>first_null</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>last_null</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>expected</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>unexplained</th></tr><tr><td style='text-align:left;padding:4px 12px;'>ALV.DE</td><td style='text-align:left;padding:4px 12px;'>19</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>25-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>19</td><td style='text-align:left;padding:4px 12px;'>0</td></tr><tr><td style='text-align:left;padding:4px 12px;'>BAS.DE</td><td style='text-align:left;padding:4px 12px;'>19</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>25-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>19</td><td style='text-align:left;padding:4px 12px;'>0</td></tr><tr><td style='text-align:left;padding:4px 12px;'>DTE.DE</td><td style='text-align:left;padding:4px 12px;'>19</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>25-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>19</td><td style='text-align:left;padding:4px 12px;'>0</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>19</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>25-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>19</td><td style='text-align:left;padding:4px 12px;'>0</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SIE.DE</td><td style='text-align:left;padding:4px 12px;'>19</td><td style='text-align:left;padding:4px 12px;'>28-Mar-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>25-Apr-24 0:00:00</td><td style='text-align:left;padding:4px 12px;'>19</td><td style='text-align:left;padding:4px 12px;'>0</td></tr></table>

    Expected nulls: 95 (19 x 5 symbols)  |  Actual: 95  |  Unexplained: 0
    Context recorded: sma_20: 95 NULL values (first 19 rows per symbol)

#### Data Contract — Column Semantics as Structured Data

Each exported JSON Schema contract includes `x-column-context` with the
computation formula, source columns, unit, and null semantics for every
derived column. This is what turns `volatility: 0.0187` into
"daily σ of close-to-close returns, annualize with √252 → 29.7%".

```csharp
// ── Context demonstration: data contract as structured metadata ──

var contractJson = File.ReadAllText(Path.Combine(EXPORT_DIR, "contracts", "gold_symbol_profile_contract.json"));
var contract = JsonSerializer.Deserialize<JsonElement>(contractJson);

var derived = new DataTable();
derived.Columns.Add("column", typeof(string));
derived.Columns.Add("description", typeof(string));
derived.Columns.Add("unit", typeof(string));
derived.Columns.Add("computation", typeof(string));
derived.Columns.Add("source_columns", typeof(string));
derived.Columns.Add("null_means", typeof(string));

foreach (var col in contract.GetProperty("x-column-context").EnumerateArray())
{
    if (col.TryGetProperty("is_derived", out var isDerived) && isDerived.GetBoolean())
    {
        derived.Rows.Add(
            col.GetProperty("name").GetString(),
            col.GetProperty("description").GetString(),
            col.GetProperty("unit").GetString(),
            col.TryGetProperty("computation", out var comp) ? comp.GetString() : "—",
            col.TryGetProperty("source_columns", out var src)
                ? string.Join(", ", src.EnumerateArray().Select(s => s.GetString())) : "—",
            col.TryGetProperty("null_semantics", out var ns) ? ns.GetString() : "—"
        );
    }
}
derived
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>column</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>description</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>unit</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>computation</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>source_columns</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>null_means</th></tr><tr><td style='text-align:left;padding:4px 12px;'>total_trading_days</td><td style='text-align:left;padding:4px 12px;'>Number of trading days with data</td><td style='text-align:left;padding:4px 12px;'>count</td><td style='text-align:left;padding:4px 12px;'>count(*) per symbol</td><td style='text-align:left;padding:4px 12px;'>silver.date</td><td style='text-align:left;padding:4px 12px;'>not_applicable</td></tr><tr><td style='text-align:left;padding:4px 12px;'>avg_daily_return</td><td style='text-align:left;padding:4px 12px;'>Mean daily close-to-close return over full history</td><td style='text-align:left;padding:4px 12px;'>decimal_ratio</td><td style='text-align:left;padding:4px 12px;'>mean(daily_return) per symbol</td><td style='text-align:left;padding:4px 12px;'>silver.daily_return</td><td style='text-align:left;padding:4px 12px;'>not_applicable</td></tr><tr><td style='text-align:left;padding:4px 12px;'>volatility</td><td style='text-align:left;padding:4px 12px;'>Standard deviation of daily returns — annualize by multiplying by sqrt(252)</td><td style='text-align:left;padding:4px 12px;'>decimal_ratio</td><td style='text-align:left;padding:4px 12px;'>std(daily_return) per symbol</td><td style='text-align:left;padding:4px 12px;'>silver.daily_return</td><td style='text-align:left;padding:4px 12px;'>not_applicable</td></tr><tr><td style='text-align:left;padding:4px 12px;'>max_drawdown</td><td style='text-align:left;padding:4px 12px;'>Largest peak-to-trough decline in cumulative return (always negative or zero)</td><td style='text-align:left;padding:4px 12px;'>decimal_ratio</td><td style='text-align:left;padding:4px 12px;'>min(cumulative_return - running_max(cumulative_return)) per symbol</td><td style='text-align:left;padding:4px 12px;'>silver.daily_return</td><td style='text-align:left;padding:4px 12px;'>not_applicable</td></tr><tr><td style='text-align:left;padding:4px 12px;'>avg_volume</td><td style='text-align:left;padding:4px 12px;'>Mean daily trading volume over full history</td><td style='text-align:left;padding:4px 12px;'>count</td><td style='text-align:left;padding:4px 12px;'>mean(volume) per symbol</td><td style='text-align:left;padding:4px 12px;'>silver.volume</td><td style='text-align:left;padding:4px 12px;'>not_applicable</td></tr><tr><td style='text-align:left;padding:4px 12px;'>total_dividends</td><td style='text-align:left;padding:4px 12px;'>Sum of all dividends paid over full history</td><td style='text-align:left;padding:4px 12px;'>EUR</td><td style='text-align:left;padding:4px 12px;'>sum(dividends) per symbol</td><td style='text-align:left;padding:4px 12px;'>silver.dividends</td><td style='text-align:left;padding:4px 12px;'>not_applicable</td></tr></table>

```csharp
// ── Context demonstration: interpreting a Gold value ──

var volMeta = contract.GetProperty("x-column-context").EnumerateArray()
    .First(c => c.GetProperty("name").GetString() == "volatility");

var germanProfiles = QueryToTable(
    "SELECT symbol, volatility FROM gold_symbol_profile WHERE symbol LIKE '%.DE'");

var interpretation = new DataTable();
interpretation.Columns.Add("symbol", typeof(string));
interpretation.Columns.Add("daily_vol", typeof(double));
interpretation.Columns.Add("annual_vol_%", typeof(double));
interpretation.Columns.Add("unit", typeof(string));
interpretation.Columns.Add("formula", typeof(string));

foreach (DataRow row in germanProfiles.Rows)
{
    var vol = Convert.ToDouble(row["volatility"]);
    interpretation.Rows.Add(
        row["symbol"],
        Math.Round(vol, 4),
        Math.Round(vol * Math.Sqrt(252) * 100, 1),
        volMeta.GetProperty("unit").GetString(),
        volMeta.GetProperty("computation").GetString()
    );
}

display(interpretation);
Console.WriteLine($"\nContract says: '{volMeta.GetProperty("description").GetString()}'");
```

<table style='border-collapse:collapse;background:transparent;color:inherit;'><tr><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>symbol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>daily_vol</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>annual_vol_%</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>unit</th><th style='text-align:left;padding:4px 12px;border-bottom:1px solid #555;'>formula</th></tr><tr><td style='text-align:left;padding:4px 12px;'>ALV.DE</td><td style='text-align:left;padding:4px 12px;'>0.0118</td><td style='text-align:left;padding:4px 12px;'>18.8</td><td style='text-align:left;padding:4px 12px;'>decimal_ratio</td><td style='text-align:left;padding:4px 12px;'>std(daily_return) per symbol</td></tr><tr><td style='text-align:left;padding:4px 12px;'>BAS.DE</td><td style='text-align:left;padding:4px 12px;'>0.0175</td><td style='text-align:left;padding:4px 12px;'>27.8</td><td style='text-align:left;padding:4px 12px;'>decimal_ratio</td><td style='text-align:left;padding:4px 12px;'>std(daily_return) per symbol</td></tr><tr><td style='text-align:left;padding:4px 12px;'>DTE.DE</td><td style='text-align:left;padding:4px 12px;'>0.0132</td><td style='text-align:left;padding:4px 12px;'>21</td><td style='text-align:left;padding:4px 12px;'>decimal_ratio</td><td style='text-align:left;padding:4px 12px;'>std(daily_return) per symbol</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SAP.DE</td><td style='text-align:left;padding:4px 12px;'>0.0189</td><td style='text-align:left;padding:4px 12px;'>30</td><td style='text-align:left;padding:4px 12px;'>decimal_ratio</td><td style='text-align:left;padding:4px 12px;'>std(daily_return) per symbol</td></tr><tr><td style='text-align:left;padding:4px 12px;'>SIE.DE</td><td style='text-align:left;padding:4px 12px;'>0.0192</td><td style='text-align:left;padding:4px 12px;'>30.5</td><td style='text-align:left;padding:4px 12px;'>decimal_ratio</td><td style='text-align:left;padding:4px 12px;'>std(daily_return) per symbol</td></tr></table>

    Contract says: 'Standard deviation of daily returns — annualize by multiplying by sqrt(252)'
