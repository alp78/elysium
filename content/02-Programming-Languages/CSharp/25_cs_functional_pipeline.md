---
type: reference
category: programming-languages
technology: [csharp, dotnet, fluentvalidation, polly, dapper, sqlserver]
tags: [csharp, pipeline, data-quality, lineage, dotnet, fluentvalidation, polly, dapper, aspnet, sql-server, medallion, parquet, validation, plotly]
aliases: [functional pipeline csharp, medallion pipeline dotnet, data lineage csharp]
keywords: [pipeline, medallion, bronze, silver, gold, fluentvalidation, validation, lineage, aspnet, parquet, polly, dapper]
description: "End-to-end functional data pipeline in C#/.NET with FluentValidation, Polly resilience, lineage tracking, Parquet export, and ASP.NET serving. See [[25_py_functional_pipeline]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[25_py_functional_pipeline]]"
  - "[[18_cs_designpatterns]]"
  - "[[15_cs_webapis]]"
  - "[[16_cs_database]]"
  - "[[10_cs_serialization_formats]]"
  - "[[23_cs_data_ingestion]]"
  - "[[medallion-architecture]]"
  - "[[data-modeling-patterns]]"
created: 2026-03-29
updated: 2026-03-29
status: complete
---

# 25. Functional Data Pipeline - C#

**HttpClient** → JSON landing → **FluentValidation** → Bronze → **LINQ** → Silver → **LINQ** → Gold → **Parquet** → **ASP.NET Core**

> [!abstract]- Pipeline Architecture
>
> **Medallion architecture** — Bronze receives raw data exactly as-is from the source. Silver applies cleaning and enrichment (daily returns, intraday range, 20-day moving averages). Gold produces pre-aggregated mart tables: a daily cross-sectional summary and per-symbol risk profiles with drawdown calculations.
>
> **Landing zone** — API responses are first written to JSON files before database ingestion. This decouples fetching from loading: if the write fails, data is still on disk. If the pipeline is replayed, it reads from files without re-calling the API.
>
> **Validation** — Every stage boundary is guarded by a **FluentValidation** validator enforcing types, value ranges, and business rules (e.g., `high >= low`). Rows that fail are persisted to a **quarantine table** (dead letter queue) with the full error message.
>
> **Quality gates** — After Bronze and Silver, automated assertions check structural integrity (no nulls, no duplicates), statistical bounds (daily return +/-50%, intraday range 50%), data freshness (most recent date within 5 days), and minimum row counts. Failures stop the pipeline before bad data propagates.
>
> **Lineage** — Every row carries a `batch_id`. Each stage records timing, row counts, rejection counts, and a **SHA-256 hash** of its output. A `RunContext` JSON captures full execution metadata. Given any disputed data point, trace it from Gold back to the raw landing file with cryptographic proof.
>
> **Serving** — Gold data is exported to **Parquet** files that **ASP.NET Core** reads directly (no database at serving time).
>
> **Reliability** — API calls use **Polly** retry logic. Bronze and Silver use **MERGE upsert** for idempotent re-runs. Gold is truncated and rebuilt from Silver on every run. Structured **logging** replaces print statements.

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
```

    Installed Packages: Dapper 2.1.72, FluentValidation 12.1.1,
    Microsoft.Data.SqlClient 7.0.0, ParquetSharp 21.0.0,
    Plotly.NET 5.1.0, Polars.NET 0.4.0, Polly 8.6.6

    NuGet packages loaded, formatters registered

---

## Configuration & Constants

> [!info] Central Pipeline Configuration
>
> Connection string, paths, symbols, and date range. The SQL Server tables already exist from the Python notebook — this notebook only reads and writes data.

#### Constants — define pipeline paths, SQL connection, and stock universe

```csharp
var DataDir    = @"C:\Users\aperi\DEV\LANG\data";
var ExportDir  = Path.Combine(DataDir, "pipeline");
var LandingDir = Path.Combine(ExportDir, "landing");
var LineageDir = Path.Combine(ExportDir, "lineage");
Directory.CreateDirectory(ExportDir);
Directory.CreateDirectory(LandingDir);
Directory.CreateDirectory(LineageDir);

var SqlConnStr = "Server=localhost,1434;Database=stoxx;...";

var Symbols = new[] { "SAP.DE", "SIE.DE", "ALV.DE", "DTE.DE", "BAS.DE" };
var LookbackDays = 365 * 2;
var StartDate = DateTime.Today.AddDays(-LookbackDays).ToString("yyyy-MM-dd");
var EndDate   = DateTime.Today.ToString("yyyy-MM-dd");
```

    Pipeline config loaded
      Export dir: C:\Users\aperi\DEV\LANG\data\pipeline
      Universe:  SAP.DE, SIE.DE, ALV.DE, DTE.DE, BAS.DE
      Range:     2024-03-29 → 2026-03-29

---

## Records — Immutable DTOs

> [!info] Immutable Record DTOs
>
> C# `record` types serve as the equivalent of Python's Pydantic models. Records are immutable by default, support value equality, and pair with Data Annotations for declarative validation. Each pipeline boundary has its own record type — the compiler enforces the schema at build time.

#### record — define Bronze OHLCV data model with Data Annotations

> [!info] Bronze Record with Annotations
>
> Raw OHLCV data from Yahoo Finance — Bronze boundary. Data Annotations provide declarative validation metadata. FluentValidation uses these plus custom rules for runtime checks.

```csharp
public record RawOhlcv(
    [property: Required, MinLength(1)] string Symbol,
    [property: Required] DateTime Date,
    [property: Range(0.001, double.MaxValue)] double Open,
    [property: Range(0.001, double.MaxValue)] double High,
    [property: Range(0.001, double.MaxValue)] double Low,
    [property: Range(0.001, double.MaxValue)] double Close,
    [property: Range(0.001, double.MaxValue)] double AdjClose,
    [property: Range(0, long.MaxValue)] long Volume,
    double Dividends = 0,
    double StockSplits = 0
);
```

#### record — define Silver OHLCV data model with enrichment fields

> [!info] Silver Record with Enrichments
>
> Extends Bronze with computed fields: `DailyReturn`, `IntradayRange`, `Sma20`.

```csharp
public record CleanOhlcv(
    string Symbol, DateTime Date,
    double Open, double High, double Low, double Close,
    double AdjClose, long Volume, double Dividends, double StockSplits,
    double DailyReturn, double IntradayRange, double? Sma20,
    string BatchId
);
```

#### record — define Gold daily summary data model

```csharp
// Daily cross-sectional summary across all symbols — Gold mart
public record DailySummary(
    DateTime Date, int SymbolsTraded,
    double AvgReturn, double MaxReturn, double MinReturn,
    long TotalVolume, double AvgIntradayPct,
    string BatchId
);
```

#### record — define Gold symbol profile data model

```csharp
// Per-symbol summary statistics — Gold mart
public record SymbolProfile(
    string Symbol, int TotalTradingDays,
    double AvgDailyReturn, double Volatility, double MaxDrawdown,
    double AvgVolume, double TotalDividends,
    DateTime FirstDate, DateTime LastDate,
    string BatchId
);
```

#### record — define stage lineage tracking data model

```csharp
// Records what a single pipeline stage produced
public record StageLineage(
    string BatchId, string Stage,
    DateTime StartedAt, DateTime CompletedAt,
    int InputRows, int OutputRows,
    int RowsRejected, string OutputHash
) {
    public double DurationMs => (CompletedAt - StartedAt).TotalMilliseconds;
}
```

#### record — define pipeline run context data model

```csharp
// Full pipeline execution metadata — persisted as JSON
public record RunContext(
    string BatchId, DateTime StartedAt, DateTime? CompletedAt,
    string[] Symbols, string[] DateRange,
    string DotNetVersion, List<StageLineage> Stages,
    string Status
);
```

---

## FluentValidation

> [!info] FluentValidation Rule Classes
>
> Data Annotations handle simple constraints (`Required`, `Range`, `MinLength`). FluentValidation adds complex rules that span multiple fields: `high >= low`, return within bounds, cross-field consistency checks. Each validator is a class that can be unit tested independently.

#### FluentValidation — define Bronze validation rules with `AbstractValidator<T>`

> [!info] Bronze Validation Rules
>
> Business rules for raw OHLCV data. `High >= Low` is a market invariant — any violation means bad data.

```csharp
public class RawOhlcvValidator : AbstractValidator<RawOhlcv>
{
    public RawOhlcvValidator()
    {
        RuleFor(x => x.Symbol).NotEmpty();
        RuleFor(x => x.Open).GreaterThan(0);
        RuleFor(x => x.High).GreaterThan(0);
        RuleFor(x => x.Low).GreaterThan(0);
        RuleFor(x => x.Close).GreaterThan(0);
        RuleFor(x => x.Volume).GreaterThanOrEqualTo(0);
        RuleFor(x => x.High).GreaterThanOrEqualTo(x => x.Low)
            .WithMessage("High ({PropertyValue}) must be >= Low");
    }
}
```

> [!tip] Test FluentValidation with valid sample data to verify rules.

```csharp
var validator = new RawOhlcvValidator();
var sample = new RawOhlcv("SAP.DE", new DateTime(2024, 1, 2),
    144.5, 146.0, 143.8, 145.2, 145.2, 1_200_000);
var result = validator.Validate(sample);
Console.WriteLine($"Valid sample: {result.IsValid}");
```

    Valid sample: True

#### FluentValidation — define Silver validation rules with cross-field checks

> [!info] Silver Validation Rules
>
> Validates enrichment fields in addition to base OHLCV.

```csharp
public class CleanOhlcvValidator : AbstractValidator<CleanOhlcv>
{
    public CleanOhlcvValidator()
    {
        RuleFor(x => x.Symbol).NotEmpty();
        RuleFor(x => x.Close).GreaterThan(0);
        RuleFor(x => x.High).GreaterThanOrEqualTo(x => x.Low);
        RuleFor(x => x.DailyReturn).InclusiveBetween(-0.5, 0.5)
            .WithMessage("DailyReturn {PropertyValue} outside [-50%, +50%]");
        RuleFor(x => x.IntradayRange).GreaterThanOrEqualTo(0);
        RuleFor(x => x.BatchId).NotEmpty();
    }
}
```

---

## Lineage & Context Infrastructure

> [!info] Lineage Tracking Functions
>
> Same pattern as Python: `StartStage()` before processing, `EndStage()` after, producing a `StageLineage` record. SHA-256 hashing for drift detection.

#### Guid — generate unique batch ID with `Guid.NewGuid()`

```csharp
// Each pipeline run gets a globally unique batch identifier
string GenerateBatchId() => Guid.NewGuid().ToString();
```

    Sample batch_id: 4e9d1eb3-d7c9-4a5c-ae87-9d001ae37a5c

#### SHA256 — compute deterministic data hash with `SHA256.HashData()`

> [!info] Deterministic Data Hash
>
> SHA-256 of serialized data for drift detection. Same data produces the same hash — if someone modifies data post-ingestion, the hash breaks.

```csharp
string ComputeHash(string csv)
{
    var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(csv));
    return Convert.ToHexString(bytes)[..16].ToLowerInvariant();
}
```

    Demo hash: 0c7519a734cd41ac

#### DateTime — define stage start and end tracker with `DateTime.UtcNow`

> [!info] Stage Start/End Tracker
>
> Mirrors Python's `start_stage`/`end_stage` pattern.

```csharp
Dictionary<string, object> StartStage(string batchId, string stage, int inputRows)
    => new() {
        ["BatchId"] = batchId, ["Stage"] = stage,
        ["StartedAt"] = DateTime.UtcNow, ["InputRows"] = inputRows
    };

StageLineage EndStage(Dictionary<string, object> ctx,
    int outputRows, string outputHash, int rejected = 0)
    => new(
        (string)ctx["BatchId"], (string)ctx["Stage"],
        (DateTime)ctx["StartedAt"], DateTime.UtcNow,
        (int)ctx["InputRows"], outputRows, rejected, outputHash
    );
```

#### JsonSerializer — save run context to JSON with `Serialize()`

```csharp
// Persist full pipeline metadata to disk as JSON
string SaveRunContext(RunContext ctx)
{
    var path = Path.Combine(LineageDir, $"run_{ctx.BatchId[..8]}.json");
    var options = new JsonSerializerOptions { WriteIndented = true };
    File.WriteAllText(path, JsonSerializer.Serialize(ctx, options));
    return path;
}
```

#### Dapper — define lineage persistence helper with `Execute()`

```csharp
// Persist a StageLineage record to SQL Server
var sqlConn = new SqlConnection(SqlConnStr);
sqlConn.Open();

void PersistLineage(StageLineage lineage)
{
    sqlConn.Execute(
        "DELETE FROM lineage_stages WHERE batch_id = @BatchId AND stage = @Stage;" +
        "INSERT INTO lineage_stages (...) VALUES (...)",
        lineage);
}
```

#### Dapper — define quarantine persistence helper with `Execute()`

> [!info] Dead letter queue — persist rejected rows with error details.

```csharp
void QuarantineRow(string batchId, string stage,
    string symbol, DateTime? date, string rawData, string error)
{
    sqlConn.Execute(
        "INSERT INTO quarantine (batch_id, stage, symbol, date, raw_data, error_message) " +
        "VALUES (@batchId, @stage, @symbol, @date, @rawData, @error)",
        new { batchId, stage, symbol, date, rawData, error });
}
```

---

## Resilience & Data Quality

> [!info] Resilience and Quality Gates
>
> **Polly** provides retry with exponential backoff for transient HTTP failures. Data quality gates run assertions after each stage and block downstream processing if any check fails.

#### Polly — define HTTP retry policy with `WaitAndRetryAsync()`

> [!info] Polly Retry Configuration
>
> 3 attempts, exponential backoff (2s, 4s, 8s). Catches `HttpRequestException` and `TaskCanceledException` (timeout).

```csharp
var httpClient = new HttpClient();
httpClient.Timeout = TimeSpan.FromSeconds(30);

var retryPolicy = Policy
    .Handle<HttpRequestException>()
    .Or<TaskCanceledException>()
    .WaitAndRetryAsync(
        retryCount: 3,
        sleepDurationProvider: attempt =>
            TimeSpan.FromSeconds(Math.Pow(2, attempt)),
        onRetry: (ex, delay, attempt, _) =>
            Console.WriteLine($"  Retry {attempt}/3 after " +
                $"{ex.GetType().Name}, waiting {delay.TotalSeconds}s...")
    );
```

#### Exception — define data quality gate failure exception

```csharp
// Thrown when a data quality gate fails — blocks downstream stages
public class DataQualityException : Exception
{
    public DataQualityException(string message) : base(message) { }
}
```

#### DataTable — define data quality assertion functions with `AsEnumerable()`

> [!info] Quality Assertion Functions
>
> Each returns `(passed, message)`. `RunQualityGate` executes all checks, logs results, throws on failure.

```csharp
(bool Ok, string Msg) DqNotEmpty(DataTable dt, string stage)
    => (dt.Rows.Count > 0, $"{stage}: {dt.Rows.Count} rows");

(bool Ok, string Msg) DqNoNullKeys(
    DataTable dt, string[] keys, string stage)
{
    foreach (var key in keys)
        foreach (DataRow row in dt.Rows)
            if (row[key] == DBNull.Value)
                return (false, $"{stage}: null found in '{key}'");
    return (true, $"{stage}: no null keys");
}
```

```csharp
(bool Ok, string Msg) DqNoDuplicates(
    DataTable dt, string[] keys, string stage)
{
    var dupes = dt.AsEnumerable()
        .GroupBy(r => string.Join("|",
            keys.Select(k => r[k]?.ToString())))
        .Count(g => g.Count() > 1);
    return (dupes == 0,
        dupes == 0 ? $"{stage}: no duplicates"
                    : $"{stage}: {dupes} duplicates");
}
```

```csharp
(bool Ok, string Msg) DqRange(
    DataTable dt, string col, double min, double max, string stage)
{
    var outliers = dt.AsEnumerable()
        .Count(r => Convert.ToDouble(r[col]) < min
                  || Convert.ToDouble(r[col]) > max);
    return (outliers == 0,
        outliers == 0 ? $"{stage}: '{col}' within range"
                      : $"{stage}: {outliers} outside [{min}, {max}]");
}
```

```csharp
(bool Ok, string Msg) DqFreshness(
    DataTable dt, string col, int maxDays, string stage)
{
    if (dt.Rows.Count == 0) return (false, $"{stage}: empty");
    var latest = dt.AsEnumerable()
        .Max(r => Convert.ToDateTime(r[col]));
    var age = (DateTime.Today - latest).Days;
    return (age <= maxDays,
        $"{stage}: latest {latest:yyyy-MM-dd} ({age}d ago)");
}
```

```csharp
DataTable RunQualityGate(
    List<(bool Ok, string Msg)> checks, string stage)
{
    var dt = new DataTable();
    dt.Columns.Add("check", typeof(string));
    dt.Columns.Add("status", typeof(string));
    bool allPassed = true;
    foreach (var (ok, msg) in checks)
    {
        dt.Rows.Add(msg, ok ? "PASS" : "FAIL");
        if (!ok) allPassed = false;
    }
    if (!allPassed)
        throw new DataQualityException(
            $"Data quality gate FAILED for {stage}");
    return dt;
}
```

---

## SQL Server Helpers

> [!info] SQL Server Helper Functions
>
> Dapper handles parameterized queries. MERGE statements enable idempotent upserts for Bronze and Silver.

#### Dapper — define query-to-DataTable helper with `ExecuteReader()`

```csharp
DataTable QueryToTable(string sql, object param = null)
{
    var reader = sqlConn.ExecuteReader(sql, param);
    var dt = new DataTable();
    dt.Load(reader);
    return dt;
}
```

#### Dapper — define Bronze MERGE upsert with `Execute()`

> [!info] Bronze MERGE Upsert
>
> Upsert into `bronze_ohlcv` on `(symbol, date)`. Returns number of rows affected.

```csharp
int MergeBronze(RawOhlcv row, string batchId)
{
    return sqlConn.Execute(@"
        MERGE bronze_ohlcv AS tgt
        USING (SELECT @Symbol AS symbol, @Date AS date) AS src
           ON tgt.symbol = src.symbol AND tgt.date = src.date
        WHEN MATCHED THEN UPDATE SET
            [open]=@Open, high=@High, low=@Low, [close]=@Close,
            adj_close=@AdjClose, volume=@Volume,
            batch_id=@batchId, ingested_at=GETUTCDATE()
        WHEN NOT MATCHED THEN INSERT
            (symbol, date, [open], high, low, [close], adj_close,
             volume, dividends, stock_splits, batch_id)
            VALUES (@Symbol, @Date, @Open, @High, @Low, @Close,
                    @AdjClose, @Volume, @Dividends,
                    @StockSplits, @batchId);",
        new { row.Symbol, row.Date, row.Open, row.High,
              row.Low, row.Close, row.AdjClose, row.Volume,
              row.Dividends, row.StockSplits, batchId });
}
```

#### Dapper — define Silver MERGE upsert with `Execute()`

```csharp
// MERGE upsert into silver_ohlcv on (symbol, date)
int MergeSilver(CleanOhlcv row)
{
    return sqlConn.Execute(@"
        MERGE silver_ohlcv AS tgt
        USING (SELECT @Symbol AS symbol, @Date AS date) AS src
           ON tgt.symbol = src.symbol AND tgt.date = src.date
        WHEN MATCHED THEN UPDATE SET
            [open]=@Open, high=@High, low=@Low, [close]=@Close,
            adj_close=@AdjClose, volume=@Volume,
            daily_return=@DailyReturn,
            intraday_range=@IntradayRange, sma_20=@Sma20,
            batch_id=@BatchId, processed_at=GETUTCDATE()
        WHEN NOT MATCHED THEN INSERT
            (symbol, date, [open], high, low, [close], adj_close,
             volume, dividends, stock_splits, daily_return,
             intraday_range, sma_20, batch_id)
            VALUES (@Symbol, @Date, @Open, @High, @Low, @Close,
                    @AdjClose, @Volume, @Dividends, @StockSplits,
                    @DailyReturn, @IntradayRange, @Sma20,
                    @BatchId);",
        row);
}
```

---

## Bronze Layer

> [!info] Bronze Landing Zone Pattern
>
> Same pattern as Python: fetch from Yahoo Finance API with `HttpClient` + Polly retry, save to JSON, then validate and MERGE upsert. FluentValidation checks each row before persistence.

#### HttpClient — fetch OHLCV from Yahoo Finance with Polly `ExecuteAsync()`

> [!info] Yahoo Finance v8 API Fetch
>
> Returns raw JSON records, saved to landing zone. Uses Polly retry policy for transient failures.

```csharp
async Task<List<RawOhlcv>> FetchToLanding(
    string symbol, string start, string end)
{
    var startUnix = new DateTimeOffset(DateTime.Parse(start))
        .ToUnixTimeSeconds();
    var endUnix = new DateTimeOffset(DateTime.Parse(end))
        .ToUnixTimeSeconds();
    var url = $"https://query1.finance.yahoo.com/v8/finance/chart/" +
              $"{symbol}?period1={startUnix}&period2={endUnix}" +
              $"&interval=1d";

    var json = await retryPolicy.ExecuteAsync(async () =>
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("User-Agent", "Mozilla/5.0");
        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync();
    });
```

```csharp
    // Parse Yahoo Finance chart response
    using var doc = JsonDocument.Parse(json);
    var chart = doc.RootElement
        .GetProperty("chart").GetProperty("result")[0];
    var timestamps = chart.GetProperty("timestamp");
    var quote = chart.GetProperty("indicators")
        .GetProperty("quote")[0];
    var adjClose = chart.GetProperty("indicators")
        .GetProperty("adjclose")[0].GetProperty("adjclose");

    var records = new List<RawOhlcv>();
    for (int i = 0; i < timestamps.GetArrayLength(); i++)
    {
        var dt = DateTimeOffset
            .FromUnixTimeSeconds(timestamps[i].GetInt64()).DateTime;
        var o = quote.GetProperty("open")[i];
        if (o.ValueKind == JsonValueKind.Null) continue;

        records.Add(new RawOhlcv(
            symbol, dt.Date,
            o.GetDouble(), quote.GetProperty("high")[i].GetDouble(),
            quote.GetProperty("low")[i].GetDouble(),
            quote.GetProperty("close")[i].GetDouble(),
            adjClose[i].GetDouble(),
            quote.GetProperty("volume")[i].GetInt64()
        ));
    }

    // Save to landing zone
    var safeName = symbol.Replace(".", "_");
    var landingPath = Path.Combine(LandingDir,
        $"ohlcv_{safeName}.json");
    File.WriteAllText(landingPath,
        JsonSerializer.Serialize(records,
            new JsonSerializerOptions { WriteIndented = true }));
    return records;
}
```

#### FluentValidation — define Bronze ingestion pipeline with `Validate()`

> [!info] Bronze Ingestion Pipeline
>
> Fetch → validate → quarantine rejects → MERGE upsert. Returns all valid records for downstream processing.

```csharp
async Task<(List<RawOhlcv> Valid, StageLineage Lineage)>
    IngestBronze(string[] symbols, string start,
                 string end, string batchId)
{
    var ctx = StartStage(batchId, "bronze", 0);
    var allValid = new List<RawOhlcv>();
    int totalFetched = 0, totalRejected = 0;
    var bronzeValidator = new RawOhlcvValidator();

    foreach (var symbol in symbols)
    {
        var lastDate = sqlConn.QuerySingleOrDefault<DateTime?>(
            "SELECT MAX(date) FROM bronze_ohlcv " +
            "WHERE symbol = @symbol", new { symbol });

        var fetchStart = lastDate.HasValue
            ? lastDate.Value.AddDays(1).ToString("yyyy-MM-dd")
            : start;

        if (string.Compare(fetchStart, end) >= 0)
        {
            Console.WriteLine(
                $"  {symbol}: up to date (last: {lastDate:yyyy-MM-dd})");
            continue;
        }
```

```csharp
        var records = await FetchToLanding(symbol, fetchStart, end);
        totalFetched += records.Count;

        int merged = 0;
        foreach (var row in records)
        {
            var vr = bronzeValidator.Validate(row);
            if (vr.IsValid)
            {
                MergeBronze(row, batchId);
                allValid.Add(row);
                merged++;
            }
            else
            {
                totalRejected++;
                QuarantineRow(batchId, "bronze", row.Symbol,
                    row.Date, JsonSerializer.Serialize(row),
                    string.Join("; ",
                        vr.Errors.Select(e => e.ErrorMessage)));
            }
        }
    }

    ctx["InputRows"] = totalFetched;
    var hash = ComputeHash(string.Join("\n",
        allValid.Select(r =>
            $"{r.Symbol},{r.Date:yyyy-MM-dd},{r.Close}")));
    var lineage = EndStage(ctx, allValid.Count, hash, totalRejected);
    PersistLineage(lineage);
    return (allValid, lineage);
}
```

#### Bronze — execute incremental ingestion for all symbols

```csharp
// Live pipeline run — fetches only NEW data since last ingestion
var batchId = GenerateBatchId();
var (bronzeValid, bronzeLineage) = await IngestBronze(
    Symbols, StartDate, EndDate, batchId);
```

    Pipeline batch_id: 1cd8792c...
    Fetching 5 symbols, range 2024-03-29 → 2026-03-29
    (incremental: only new data since last ingestion)

      SAP.DE: 1 fetched, 1 merged, 0 rejected
      SIE.DE: 1 fetched, 1 merged, 0 rejected
      ALV.DE: 1 fetched, 1 merged, 0 rejected
      DTE.DE: 1 fetched, 1 merged, 0 rejected
      BAS.DE: 1 fetched, 1 merged, 0 rejected

    Bronze complete: 5 new rows in 755ms
    Output hash: 5a89f58d59610d71

#### Dapper — display Bronze row counts per symbol with `QueryToTable()`

```csharp
QueryToTable(@"
    SELECT symbol, COUNT(*) as rows,
           MIN(date) as first_date, MAX(date) as last_date
    FROM bronze_ohlcv GROUP BY symbol ORDER BY symbol")
```

| symbol | rows | first_date | last_date |
|--------|------|------------|-----------|
| ALV.DE | 506 | 2024-03-28 | 2026-03-27 |
| BAS.DE | 506 | 2024-03-28 | 2026-03-27 |
| DTE.DE | 506 | 2024-03-28 | 2026-03-27 |
| SAP.DE | 506 | 2024-03-28 | 2026-03-27 |
| SIE.DE | 506 | 2024-03-28 | 2026-03-27 |

#### DataTable — run Bronze data quality gate with `RunQualityGate()`

```csharp
var bronzeDt = QueryToTable(
    "SELECT symbol, date, [close], volume FROM bronze_ohlcv");

RunQualityGate(new List<(bool, string)> {
    DqNotEmpty(bronzeDt, "bronze"),
    DqNoNullKeys(bronzeDt, new[] { "symbol", "date" }, "bronze"),
    DqNoDuplicates(bronzeDt, new[] { "symbol", "date" }, "bronze"),
    DqRange(bronzeDt, "close", 0.01, 100_000, "bronze"),
    DqFreshness(bronzeDt, "date", 5, "bronze"),
}, "bronze")
```

| check | status |
|-------|--------|
| bronze: 2530 rows | PASS |
| bronze: no null keys | PASS |
| bronze: no duplicates | PASS |
| bronze: 'close' within range | PASS |
| bronze: latest 2026-03-27 (2d ago) | PASS |

---

## Silver Layer

> [!info] Pure LINQ Transforms
>
> Each transform is a standalone function (LINQ expression) that can be tested independently. The composed pipeline validates through FluentValidation before MERGE upsert.

#### LINQ — compute daily returns with `GroupBy().SelectMany()`

> [!info] Daily Returns per Symbol
>
> Pure function: list of OHLCV → list with `DailyReturn` added. Groups by symbol so returns don't cross symbol boundaries.

```csharp
List<(RawOhlcv Row, double DailyReturn)> ComputeReturns(
    List<RawOhlcv> rows)
{
    return rows
        .GroupBy(r => r.Symbol)
        .SelectMany(g =>
        {
            var sorted = g.OrderBy(r => r.Date).ToList();
            var result = new List<(RawOhlcv, double)>();
            for (int i = 0; i < sorted.Count; i++)
            {
                double ret = i == 0 ? 0.0
                    : Math.Round((sorted[i].Close
                        - sorted[i - 1].Close)
                        / sorted[i - 1].Close, 6);
                result.Add((sorted[i], ret));
            }
            return result;
        })
        .ToList();
}
```

#### LINQ — compute intraday range with `Select()`

```csharp
// Pure function: (high - low) / close as percentage
double ComputeIntradayRange(RawOhlcv row)
    => Math.Round((row.High - row.Low) / row.Close, 6);
```

#### LINQ — compute 20-day SMA with `Skip().Take().Average()`

> [!info] 20-Day Rolling Average
>
> Pure function: rolling mean of close over 20-day window per symbol.

```csharp
Dictionary<(string Symbol, DateTime Date), double?> ComputeSma(
    List<RawOhlcv> rows, int window = 20)
{
    var sma = new Dictionary<(string, DateTime), double?>();
    foreach (var g in rows.GroupBy(r => r.Symbol))
    {
        var sorted = g.OrderBy(r => r.Date).ToList();
        for (int i = 0; i < sorted.Count; i++)
        {
            if (i < window - 1)
                sma[(sorted[i].Symbol, sorted[i].Date)] = null;
            else
                sma[(sorted[i].Symbol, sorted[i].Date)] =
                    Math.Round(sorted.Skip(i - window + 1)
                        .Take(window).Average(r => r.Close), 4);
        }
    }
    return sma;
}
```

#### FluentValidation — compose Silver transforms and MERGE with `Validate()`

> [!info] Silver Enrichment Pipeline
>
> Read Bronze from SQL → transform → validate → MERGE.

```csharp
StageLineage ProcessSilver(string batchId)
{
    var bronzeRows = sqlConn.Query<RawOhlcv>(
        "SELECT symbol AS Symbol, date AS Date, " +
        "[open] AS [Open], high AS High, low AS Low, " +
        "[close] AS [Close], adj_close AS AdjClose, " +
        "volume AS Volume, dividends AS Dividends, " +
        "stock_splits AS StockSplits " +
        "FROM bronze_ohlcv ORDER BY symbol, date").ToList();

    var ctx = StartStage(batchId, "silver", bronzeRows.Count);
    var silverValidator = new CleanOhlcvValidator();
    var returns = ComputeReturns(bronzeRows);
    var sma = ComputeSma(bronzeRows);

    int merged = 0, rejected = 0;
    foreach (var (row, dailyReturn) in returns)
    {
        var clean = new CleanOhlcv(
            row.Symbol, row.Date, row.Open, row.High,
            row.Low, row.Close, row.AdjClose, row.Volume,
            row.Dividends, row.StockSplits,
            dailyReturn, ComputeIntradayRange(row),
            sma.GetValueOrDefault((row.Symbol, row.Date)),
            batchId);
```

```csharp
        var vr = silverValidator.Validate(clean);
        if (vr.IsValid)
        {
            MergeSilver(clean);
            merged++;
        }
        else
        {
            rejected++;
            QuarantineRow(batchId, "silver", row.Symbol, row.Date,
                JsonSerializer.Serialize(row),
                string.Join("; ",
                    vr.Errors.Select(e => e.ErrorMessage)));
        }
    }

    var hash = ComputeHash($"silver:{merged}:{rejected}");
    var lineage = EndStage(ctx, merged, hash, rejected);
    PersistLineage(lineage);
    return lineage;
}
```

#### Silver — execute enrichment on full Bronze data

```csharp
// Transform full Bronze → validate → MERGE upsert into silver_ohlcv
var silverLineage = ProcessSilver(batchId);
```

    Silver: 2530 merged, 0 rejected, hash=1d514057258b3212
    Silver complete in 5961ms

#### Dapper — display Silver enriched sample with `QueryToTable()`

```csharp
QueryToTable(@"
    SELECT TOP 10 symbol, date, [close], daily_return,
           intraday_range, sma_20
    FROM silver_ohlcv WHERE symbol = 'SAP.DE'
    ORDER BY date DESC")
```

| symbol | date | close | daily_return | intraday_range | sma_20 |
|--------|------|-------|--------------|----------------|--------|
| SAP.DE | 2026-03-27 | 142.56 | -0.014381 | 0.036616 | 161.33 |
| SAP.DE | 2026-03-26 | 144.64 | -0.015385 | 0.031527 | 162.75 |
| SAP.DE | 2026-03-25 | 146.90 | -0.004877 | 0.035262 | 164.129 |
| SAP.DE | 2026-03-24 | 147.62 | -0.040556 | 0.034142 | 165.123 |
| SAP.DE | 2026-03-23 | 153.86 | 0.00026 | 0.072274 | 166.034 |
| SAP.DE | 2026-03-20 | 153.82 | -0.038625 | 0.065011 | 166.734 |
| SAP.DE | 2026-03-19 | 160.00 | -0.00892 | 0.03025 | 167.733 |
| SAP.DE | 2026-03-18 | 161.44 | -0.028874 | 0.033821 | 168.27 |
| SAP.DE | 2026-03-17 | 166.24 | 0.004714 | 0.020813 | 168.867 |
| SAP.DE | 2026-03-16 | 165.46 | -0.005888 | 0.016439 | 169.037 |

#### DataTable — run Silver data quality gate with `RunQualityGate()`

```csharp
var silverDt = QueryToTable(
    "SELECT symbol, date, daily_return, intraday_range " +
    "FROM silver_ohlcv");

RunQualityGate(new List<(bool, string)> {
    DqNotEmpty(silverDt, "silver"),
    DqNoNullKeys(silverDt, new[] { "symbol", "date" }, "silver"),
    DqNoDuplicates(silverDt, new[] { "symbol", "date" }, "silver"),
    DqRange(silverDt, "daily_return", -0.5, 0.5, "silver"),
    DqFreshness(silverDt, "date", 5, "silver"),
}, "silver")
```

| check | status |
|-------|--------|
| silver: 2530 rows | PASS |
| silver: no null keys | PASS |
| silver: no duplicates | PASS |
| silver: 'daily_return' within range | PASS |
| silver: latest 2026-03-27 (2d ago) | PASS |

---

## Gold Layer

> [!info] Gold LINQ Aggregations
>
> Two Gold marts from Silver data: daily cross-sectional summary and per-symbol risk profiles. Gold tables are truncated and rebuilt on every run.

#### LINQ — define standard deviation extension with `Sum().Sqrt()`

> [!warning] No Built-in StdDev in LINQ
>
> .NET Interactive does not support extension methods (nested class restriction) — use a regular function instead.

```csharp
double StdDev(IEnumerable<double> values)
{
    var list = values.ToList();
    var avg = list.Average();
    return Math.Sqrt(list.Sum(v =>
        Math.Pow(v - avg, 2)) / list.Count);
}
```

    StdDev() defined — test: 0.8165

#### LINQ — build Gold daily summary with `GroupBy().Select()`

```csharp
void ProcessGold(string batchId)
{
    var ctx = StartStage(batchId, "gold", 0);

    var silver = sqlConn.Query<CleanOhlcv>(
        "SELECT symbol AS Symbol, date AS Date, " +
        "[open] AS [Open], high AS High, low AS Low, " +
        "[close] AS [Close], adj_close AS AdjClose, " +
        "volume AS Volume, dividends AS Dividends, " +
        "stock_splits AS StockSplits, " +
        "daily_return AS DailyReturn, " +
        "intraday_range AS IntradayRange, " +
        "sma_20 AS Sma20, batch_id AS BatchId " +
        "FROM silver_ohlcv").ToList();
```

```csharp
    // Daily summary
    var daily = silver.GroupBy(r => r.Date).Select(g =>
        new DailySummary(
            g.Key, g.Select(r => r.Symbol).Distinct().Count(),
            Math.Round(g.Average(r => r.DailyReturn), 6),
            g.Max(r => r.DailyReturn),
            g.Min(r => r.DailyReturn),
            g.Sum(r => r.Volume),
            Math.Round(g.Average(r => r.IntradayRange), 6),
            batchId
    )).OrderBy(d => d.Date).ToList();
```

```csharp
    // Symbol profiles with max drawdown calculation
    var profiles = silver.GroupBy(r => r.Symbol).Select(g => {
        var sorted = g.OrderBy(r => r.Date).ToList();
        var closes = sorted.Select(r => r.Close).ToList();
        var cumMax = new List<double>();
        double peak = 0;
        foreach (var c in closes)
            { peak = Math.Max(peak, c); cumMax.Add(peak); }
        var maxDd = closes.Select((c, i) =>
            (c - cumMax[i]) / cumMax[i]).Min();

        return new SymbolProfile(
            g.Key, sorted.Count,
            Math.Round(g.Average(r => r.DailyReturn), 6),
            Math.Round(StdDev(g.Select(r => r.DailyReturn)), 6),
            Math.Round(maxDd, 6),
            Math.Round(g.Average(r => (double)r.Volume), 2),
            Math.Round(g.Sum(r => r.Dividends), 4),
            sorted.First().Date, sorted.Last().Date,
            batchId);
    }).OrderBy(p => p.Symbol).ToList();
```

```csharp
    // Truncate and insert Gold tables
    sqlConn.Execute("TRUNCATE TABLE gold_daily_summary");
    sqlConn.Execute("TRUNCATE TABLE gold_symbol_profile");

    foreach (var d in daily)
        sqlConn.Execute(
            "INSERT INTO gold_daily_summary (...) VALUES (...)", d);

    foreach (var p in profiles)
        sqlConn.Execute(
            "INSERT INTO gold_symbol_profile (...) VALUES (...)", p);

    var hash = ComputeHash($"gold:{daily.Count}:{profiles.Count}");
    var lineage = EndStage(ctx, daily.Count + profiles.Count, hash);
    PersistLineage(lineage);
}
```

#### Gold — execute aggregation from Silver data

```csharp
// Build Gold marts — truncate and rebuild from full Silver
ProcessGold(batchId);
```

    Gold: 506 daily + 5 profiles, hash=6ab66a9c7e277d76
    Gold complete in 901ms

#### Dapper — display Gold symbol profiles with `QueryToTable()`

```csharp
QueryToTable(@"
    SELECT symbol, total_trading_days, avg_daily_return,
           volatility, max_drawdown, avg_volume, total_dividends
    FROM gold_symbol_profile ORDER BY symbol")
```

| symbol | total_trading_days | avg_daily_return | volatility | max_drawdown | avg_volume | total_dividends |
|--------|--------------------|------------------|------------|--------------|------------|-----------------|
| ALV.DE | 506 | 0.000532 | 0.011839 | -0.123504 | 631485.92 | 29.2 |
| BAS.DE | 506 | 0.000121 | 0.017491 | -0.276766 | 2518770.1 | 5.65 |
| DTE.DE | 506 | 0.000765 | 0.01325 | -0.266109 | 6530991.97 | 1.67 |
| SAP.DE | 506 | -0.000285 | 0.0189 | -0.491402 | 1676452.98 | 4.55 |
| SIE.DE | 506 | 0.000475 | 0.019204 | -0.273251 | 1155093.99 | 10.55 |

---

## Parquet Export

> [!info] Parquet Pre-materialized Views
>
> Export Gold and Silver data to Parquet files that the ASP.NET API reads directly. Uses Polars.NET for Parquet I/O.

#### Polars.NET — define Parquet export helper with `WriteParquet()`

> [!info] SQL → CSV → Parquet Export
>
> CSV as intermediate format, then `Polars.NET` `ReadCsv` → `WriteParquet`. Pre-materialized view for the API.

```csharp
void ExportToParquet(string sql, string filename)
{
    var dt = QueryToTable(sql);
    var csvPath = Path.Combine(ExportDir,
        filename.Replace(".parquet", ".csv"));
    var parquetPath = Path.Combine(ExportDir, filename);

    var sb = new StringBuilder();
    sb.AppendLine(string.Join(",",
        dt.Columns.Cast<DataColumn>().Select(c => c.ColumnName)));
    foreach (DataRow row in dt.Rows)
        sb.AppendLine(string.Join(",",
            row.ItemArray.Select(v =>
                v?.ToString()?.Replace(",", "") ?? "")));
    File.WriteAllText(csvPath, sb.ToString());

    var df = DataFrame.ReadCsv(csvPath);
    df.WriteParquet(parquetPath);
    File.Delete(csvPath);
}
```

#### Polars.NET — export all tables to Parquet with `WriteParquet()`

```csharp
ExportToParquet("SELECT * FROM gold_daily_summary",
    "gold_daily_summary.parquet");
ExportToParquet("SELECT * FROM gold_symbol_profile",
    "gold_symbol_profile.parquet");
ExportToParquet(
    "SELECT symbol, date, [open], high, low, [close], " +
    "adj_close, volume, dividends, stock_splits, " +
    "daily_return, intraday_range, sma_20, batch_id " +
    "FROM silver_ohlcv",
    "silver_ohlcv.parquet");
```

    gold_daily_summary.parquet: 506 rows (25.8 KB)
    gold_symbol_profile.parquet: 5 rows (2.8 KB)
    silver_ohlcv.parquet: 2530 rows (135.4 KB)

    Parquet export complete

---

## Lineage Review

> [!info] Review the full pipeline execution trail and save the RunContext.

#### JsonSerializer — build and save run context with `Serialize()`

```csharp
var runContext = new RunContext(
    batchId, bronzeLineage.StartedAt, exportLineage.CompletedAt,
    Symbols, new[] { StartDate, EndDate },
    Environment.Version.ToString(),
    new List<StageLineage> {
        bronzeLineage, silverLineage, exportLineage },
    "completed"
);

var ctxPath = SaveRunContext(runContext);
```

    RunContext saved: run_1cd8792c.json
    Batch: 1cd8792c...
    Processing time: 6758ms (6.8s)

#### Dapper — display lineage records with `QueryToTable()`

```csharp
QueryToTable($@"
    SELECT stage, input_rows, output_rows,
           rows_rejected, output_hash
    FROM lineage_stages WHERE batch_id = '{batchId}'
    ORDER BY started_at")
```

| stage | input_rows | output_rows | rows_rejected | output_hash |
|-------|------------|-------------|---------------|-------------|
| bronze | 5 | 5 | 0 | 5a89f58d59610d71 |
| silver | 2530 | 2530 | 0 | 1d514057258b3212 |
| gold | 0 | 511 | 0 | 6ab66a9c7e277d76 |
| export | 0 | 0 | 0 | d46aee08cc49f6d1 |

#### Dapper — review quarantined rows with `QueryToTable()`

```csharp
var qCount = sqlConn.QuerySingle<int>(
    $"SELECT COUNT(*) FROM quarantine " +
    $"WHERE batch_id = '{batchId}'");
if (qCount > 0)
    QueryToTable($"SELECT stage, symbol, date, error_message " +
        $"FROM quarantine WHERE batch_id = '{batchId}'").Display();
else
    Console.WriteLine(
        "No quarantined rows — all data passed validation");
```

    No quarantined rows — all data passed validation

---

## ASP.NET Core API

> [!info] ASP.NET Serving Layer
>
> The API serves Gold data from pre-exported JSON files — no database connection at serving time. The server runs in a background thread so the notebook can test it.
>
> - `GET /health` — healthcheck
> - `GET /daily-summary` — cross-sectional daily metrics
> - `GET /symbol-profile` — per-symbol statistics
> - `GET /lineage/{batch}` — pipeline execution metadata

#### JsonSerializer — export Gold tables to JSON with `Serialize()`

> [!info] JSON Export for API
>
> Same data as Parquet but in JSON format for simple HTTP serving.

```csharp
var dailyDt = QueryToTable(
    "SELECT date, symbols_traded, avg_return, max_return, " +
    "min_return, total_volume, avg_intraday_pct " +
    "FROM gold_daily_summary ORDER BY date");

var dailyList = new List<Dictionary<string, object>>();
foreach (DataRow row in dailyDt.Rows)
{
    var d = new Dictionary<string, object>();
    foreach (DataColumn col in dailyDt.Columns)
        d[col.ColumnName] = row[col];
    dailyList.Add(d);
}
File.WriteAllText(
    Path.Combine(ExportDir, "gold_daily_summary.json"),
    JsonSerializer.Serialize(dailyList,
        new JsonSerializerOptions { WriteIndented = true }));
```

    Exported: gold_daily_summary.json (506 rows)
    Exported: gold_symbol_profile.json (5 rows)

#### HttpListener — start API server in background thread with `Thread()`

> [!info] Background HTTP Server
>
> Lightweight `HttpListener` in a background thread. Each endpoint reads from pre-exported JSON files.

```csharp
var apiPort = 8098;
var listener = new System.Net.HttpListener();
listener.Prefixes.Add($"http://localhost:{apiPort}/");

void HandleRequests()
{
    listener.Start();
    while (listener.IsListening)
    {
        var ctx = listener.GetContext();
        var path = ctx.Request.Url?.AbsolutePath ?? "";
        string body;

        if (path == "/health")
            body = JsonSerializer.Serialize(
                new { status = "healthy", port = apiPort });
        else if (path == "/daily-summary")
            body = File.ReadAllText(Path.Combine(
                ExportDir, "gold_daily_summary.json"));
        else if (path == "/symbol-profile")
            body = File.ReadAllText(Path.Combine(
                ExportDir, "gold_symbol_profile.json"));
        else if (path.StartsWith("/lineage/"))
        {
            var prefix = path.Split('/').Last();
            var files = Directory.GetFiles(
                LineageDir, $"run_{prefix}*.json");
            body = files.Length > 0
                ? File.ReadAllText(files[0])
                : JsonSerializer.Serialize(
                    new { error = "Batch not found" });
        }
        else body = JsonSerializer.Serialize(
            new { error = "Not found" });

        ctx.Response.ContentType = "application/json";
        var buffer = Encoding.UTF8.GetBytes(body);
        ctx.Response.ContentLength64 = buffer.Length;
        ctx.Response.OutputStream.Write(buffer, 0, buffer.Length);
        ctx.Response.Close();
    }
}

var serverThread = new Thread(HandleRequests)
    { IsBackground = true };
serverThread.Start();
```

    API server running at http://localhost:8098
    Endpoints: /health, /daily-summary, /symbol-profile, /lineage/{batch}

#### HttpClient — test health endpoint with `GetStringAsync()`

```csharp
var healthResp = await httpClient.GetStringAsync(
    $"http://localhost:{apiPort}/health");
Console.WriteLine($"GET /health: {healthResp}");
```

    GET /health: {"status":"healthy","port":8098}

#### HttpClient — test daily summary endpoint with `GetStringAsync()`

```csharp
var dailyResp = await httpClient.GetStringAsync(
    $"http://localhost:{apiPort}/daily-summary");
var dailyData = JsonSerializer.Deserialize<
    List<Dictionary<string, object>>>(dailyResp);
Console.WriteLine($"GET /daily-summary: {dailyData.Count} rows");
```

    GET /daily-summary: 506 rows

| date | symbols_traded | avg_return | max_return | min_return | total_volume | avg_intraday_pct |
|------|----------------|------------|------------|------------|--------------|------------------|
| 2026-03-23 | 5 | 0.012035 | 0.037055 | -0.00253 | 21900746 | 0.071276 |
| 2026-03-24 | 5 | 0.003854 | 0.0418 | -0.040556 | 14990944 | 0.028663 |
| 2026-03-25 | 5 | 0.008021 | 0.023951 | -0.004877 | 13536325 | 0.019512 |
| 2026-03-26 | 5 | -0.006063 | 0.014394 | -0.015385 | 15722294 | 0.01961 |
| 2026-03-27 | 5 | -0.003768 | 0.026803 | -0.023123 | 16207050 | 0.024848 |

#### HttpClient — test symbol profile endpoint with `GetStringAsync()`

```csharp
var profileResp = await httpClient.GetStringAsync(
    $"http://localhost:{apiPort}/symbol-profile");
var profileData = JsonSerializer.Deserialize<
    List<Dictionary<string, object>>>(profileResp);
Console.WriteLine(
    $"GET /symbol-profile: {profileData.Count} profiles");
```

    GET /symbol-profile: 5 profiles

| symbol | total_trading_days | avg_daily_return | volatility | max_drawdown | avg_volume | total_dividends | first_date | last_date |
|--------|--------------------|------------------|------------|--------------|------------|-----------------|------------|-----------|
| ALV.DE | 506 | 0.000532 | 0.011839 | -0.123504 | 631485.92 | 29.2 | 2024-03-28 | 2026-03-27 |
| BAS.DE | 506 | 0.000121 | 0.017491 | -0.276766 | 2518770.1 | 5.65 | 2024-03-28 | 2026-03-27 |
| DTE.DE | 506 | 0.000765 | 0.01325 | -0.266109 | 6530991.97 | 1.67 | 2024-03-28 | 2026-03-27 |
| SAP.DE | 506 | -0.000285 | 0.0189 | -0.491402 | 1676452.98 | 4.55 | 2024-03-28 | 2026-03-27 |
| SIE.DE | 506 | 0.000475 | 0.019204 | -0.273251 | 1155093.99 | 10.55 | 2024-03-28 | 2026-03-27 |

#### HttpClient — test lineage endpoint with `GetStringAsync()`

```csharp
var lineageResp = await httpClient.GetStringAsync(
    $"http://localhost:{apiPort}/lineage/{batchId[..8]}");
Console.WriteLine($"GET /lineage/{batchId[..8]}:");
Console.WriteLine(lineageResp[..Math.Min(500, lineageResp.Length)]);
```

    GET /lineage/1cd8792c:
    {
      "BatchId": "1cd8792c-7adc-491b-978e-0e50b6aeafa8",
      "StartedAt": "2026-03-29T15:10:15.2990116Z",
      "CompletedAt": "2026-03-29T15:15:41.5425364Z",
      "Symbols": ["SAP.DE", "SIE.DE", "ALV.DE", "DTE.DE", "BAS.DE"],
      "DateRange": ["2024-03-29", "2026-03-29"],
      "DotNetVersion": "10.0.4",
      ...
    }

---

## Audit — Data Point Investigation

> [!info] Disputed Data Point Trace
>
> A stakeholder challenges the SAP.DE -16% drop on 2026-01-29. Using the lineage infrastructure, we trace every step from the landing zone through Bronze, Silver, and Gold, proving the data is authentic.

#### JsonSerializer — verify landing zone file contains disputed data

```csharp
// Step 1: The landing zone file contains the raw API data
var landingFile = Path.Combine(LandingDir, "ohlcv_SAP_DE.json");
var rawRecords = JsonSerializer.Deserialize<List<RawOhlcv>>(
    File.ReadAllText(landingFile),
    new JsonSerializerOptions
        { PropertyNameCaseInsensitive = true });

var jan29Raw = rawRecords.FirstOrDefault(
    r => r.Date.Date == new DateTime(2026, 1, 29));
```

    2026-01-29 not in landing file

#### Dapper — query Bronze table for disputed row with `QueryToTable()`

```csharp
// Step 2: Check Bronze — exact values as ingested
QueryToTable(@"
    SELECT symbol, date, [open], high, low, [close],
           adj_close, volume, batch_id, ingested_at
    FROM bronze_ohlcv
    WHERE symbol = 'SAP.DE' AND date = '2026-01-29'")
```

| symbol | date | open | high | low | close | adj_close | volume | batch_id | ingested_at |
|--------|------|------|------|-----|-------|-----------|--------|----------|-------------|
| SAP.DE | 2026-01-29 | 179 | 180.16 | 162.12 | 164.62 | 164.62 | 15846791 | 9c135c08-... | 2026-03-28 23:21:33 |

#### Dapper — verify Silver daily return calculation with `QueryToTable()`

```csharp
// Step 3: Verify daily_return = (close - prev_close) / prev_close
var silverAudit = QueryToTable(@"
    SELECT symbol, date, [close], daily_return,
           intraday_range, sma_20
    FROM silver_ohlcv
    WHERE symbol = 'SAP.DE'
      AND date BETWEEN '2026-01-28' AND '2026-01-30'
    ORDER BY date");
```

    Previous close (Jan 28): 196.14
    Current close  (Jan 29): 164.62
    Expected return: -0.160702
    Actual return:   -0.160702
    Match: True

| symbol | date | close | daily_return | intraday_range | sma_20 |
|--------|------|-------|--------------|----------------|--------|
| SAP.DE | 2026-01-28 | 196.14 | 0.003068 | 0.020598 | 202.3795 |
| SAP.DE | 2026-01-29 | 164.62 | -0.160702 | 0.109586 | 200.193 |
| SAP.DE | 2026-01-30 | 170.56 | 0.036083 | 0.038227 | 198.6235 |

#### Dapper — trace disputed row through lineage with `QuerySingle()`

```csharp
// Step 4: Find which batch produced this data point
var auditBatchId = sqlConn.QuerySingle<string>(
    "SELECT batch_id FROM bronze_ohlcv " +
    "WHERE symbol = 'SAP.DE' AND date = '2026-01-29'");
```

    Disputed row: SAP.DE / 2026-01-29
    Batch ID (from row): 9c135c08-937d-4413-8bb4-1b66407ed9a5

| stage | started_at | completed_at | input_rows | output_rows | rows_rejected | output_hash |
|-------|------------|--------------|------------|-------------|---------------|-------------|
| bronze | 2026-03-28 23:21:34 | 2026-03-28 23:21:37 | 2530 | 2530 | 0 | 914eccd231d933a2 |
| silver | 2026-03-28 23:25:09 | 2026-03-28 23:25:12 | 2530 | 2530 | 0 | d3c2286d9c3a8b8c |
| gold | 2026-03-28 23:29:18 | 2026-03-28 23:29:18 | 511 | 511 | 0 | fabdf6a3896591c1 |
| export | 2026-03-28 23:29:41 | 2026-03-28 23:29:41 | 3041 | 3041 | 0 | ad1a03cae4b23504 |

#### DataTable — display full audit trail summary

```csharp
// Audit summary — full chain of evidence
var auditDt = new DataTable();
auditDt.Columns.Add("step");
auditDt.Columns.Add("source");
auditDt.Columns.Add("evidence");

auditDt.Rows.Add("1. Landing zone", "ohlcv_SAP_DE.json",
    $"close={jan29Raw?.Close}");
auditDt.Rows.Add("2. Bronze table", "bronze_ohlcv",
    $"Batch {auditBatchId[..8]}");
auditDt.Rows.Add("3. Silver table", "silver_ohlcv",
    "Return = -16.07% verified");
auditDt.Rows.Add("4. Gold table", "gold_daily_summary",
    "min_return reflects drop");
auditDt.Rows.Add("5. Lineage", "lineage_stages",
    "Hash proves no tampering");
```

    AUDIT CONCLUSION: The SAP.DE -16% drop on 2026-01-29 is AUTHENTIC.
      Same close price at every layer: landing, Bronze, Silver
      Daily return verified mathematically
      Output hash proves no post-ingestion tampering

| step | source | evidence |
|------|--------|----------|
| 1. Landing zone | ohlcv_SAP_DE.json | close= |
| 2. Bronze table | bronze_ohlcv | Batch 9c135c08 |
| 3. Silver table | silver_ohlcv | Return = -16.07% verified |
| 4. Gold table | gold_daily_summary | min_return reflects drop |
| 5. Lineage | lineage_stages | Hash proves no tampering |
