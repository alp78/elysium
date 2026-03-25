---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [file IO, JSON serialization, CSV, file reading, file writing, serialization, deserialization]
keywords: [File, StreamReader, StreamWriter, JsonSerializer, System.Text.Json, Newtonsoft, CsvHelper, Path, Directory]
description: "C# file I/O and serialization reference with executable examples and cell outputs — covers File/Stream APIs, System.Text.Json, Newtonsoft.Json, CSV handling, and async file operations. See [[09_py_fileio_serialization]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[09_py_fileio_serialization]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 09. File I/O & Serialization - C#

```csharp
// Suppress CS1701/CS1702 warnings and import all namespaces used in this notebook

using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
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

Console.WriteLine("WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.");
```

    WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.

## Read, Write, Append Files

<h4><code style="font-size:0.75em">File.WriteAllText</code> and <code style="font-size:0.75em">File.ReadAllText</code></h4>

```csharp
#nullable enable

// Write and read — File class static methods for simple one-shot operations
var tmpDir = Path.Combine(Path.GetTempPath(), "fileio_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);
Console.WriteLine($"Working dir: {tmpDir}\n");

// WriteAllText — creates or overwrites the file
var stagingFile = Path.Combine(tmpDir, "pipeline_output.txt");
var content = "pipeline_id|status|rows_processed\n"
            + "etl_001|success|15000\n"
            + "etl_002|failed|0\n"
            + "etl_003|success|8200\n";
File.WriteAllText(stagingFile, content, Encoding.UTF8);
Console.WriteLine($"  Written: {Path.GetFileName(stagingFile)} ({new FileInfo(stagingFile).Length} bytes)");

// ReadAllText — entire file into one string (fine for small files)
var text = File.ReadAllText(stagingFile, Encoding.UTF8);
Console.WriteLine($"  Content ({text.Length} chars): {text[..50]}...");

// ReadAllLines — returns string[] with one element per line
string[] allLines = File.ReadAllLines(stagingFile, Encoding.UTF8);
Console.WriteLine($"  Lines: {allLines.Length}");
foreach (var (line, i) in allLines.Select((l, i) => (l, i)))
    Console.WriteLine($"  [{i}]: {line}");
```

    Working dir: C:\Users\aperi\AppData\Local\Temp\fileio_cs_43ca5c6c
    
      Written: pipeline_output.txt (97 bytes)
      Content (94 chars): pipeline_id|status|rows_processed
    etl_001|success|...
      Lines: 4
      [0]: pipeline_id|status|rows_processed
      [1]: etl_001|success|15000
      [2]: etl_002|failed|0
      [3]: etl_003|success|8200

<h4><code style="font-size:0.75em">StreamReader</code> and <code style="font-size:0.75em">StreamWriter</code></h4>

```csharp
// StreamReader — line-by-line reading for large files
// constant memory regardless of file size
using (var reader = new StreamReader(stagingFile, Encoding.UTF8))
{
    string? line;
    int lineNum = 0;
    while ((line = reader.ReadLine()) != null)
        Console.WriteLine($"  Line {lineNum++}: {line}");
}

// StreamWriter — buffered writing
// more efficient than WriteAllText for many small writes
var logFile = Path.Combine(tmpDir, "etl_log.txt");
using (var writer = new StreamWriter(logFile, append: false, Encoding.UTF8))
{
    writer.WriteLine("timestamp|level|message");
    writer.WriteLine("2024-01-15T03:00:00|INFO|Pipeline started");
    writer.WriteLine("2024-01-15T03:00:05|INFO|Extracted 1.5M rows from BigQuery");
    writer.WriteLine("2024-01-15T03:00:12|INFO|Loaded to GCS");
}
Console.WriteLine($"  Written: {Path.GetFileName(logFile)}");
```

      Line 0: pipeline_id|status|rows_processed
      Line 1: etl_001|success|15000
      Line 2: etl_002|failed|0
      Line 3: etl_003|success|8200
      Written: etl_log.txt

#### Append, Binary I/O, and Path operations

```csharp
// Append — File.AppendAllText for one-shot; StreamWriter(append: true) for multiple writes
File.AppendAllText(logFile, "2024-01-15T03:01:00|WARN|Slow query detected\n", Encoding.UTF8);
using (var writer = new StreamWriter(logFile, append: true, Encoding.UTF8))
    writer.WriteLine("2024-01-15T03:02:00|INFO|Pipeline completed");

var lines = File.ReadAllLines(logFile);
Console.WriteLine($"  Total lines: {lines.Length}, Last: {lines[^1]}");

// Binary I/O — File.WriteAllBytes / File.ReadAllBytes for raw bytes
var binFile = Path.Combine(tmpDir, "sample.bin");
byte[] pngMagic = { 0x89, 0x50, 0x4E, 0x47 };
File.WriteAllBytes(binFile, pngMagic);
byte[] raw = File.ReadAllBytes(binFile);
Console.WriteLine($"  Binary: {BitConverter.ToString(raw)}");

// Path operations — System.IO.Path for cross-platform path manipulation
var p = @"/data/lake/raw/events/2024/01/events.parquet";
Console.WriteLine($"  FileName:  {Path.GetFileName(p)}");
Console.WriteLine($"  Extension: {Path.GetExtension(p)}");
Console.WriteLine($"  Directory: {Path.GetDirectoryName(p)}");
Console.WriteLine($"  Combine:   {Path.Combine(tmpDir, "output", "data.csv")}");

// List files
foreach (var f in Directory.GetFiles(tmpDir))
    Console.WriteLine($"    {Path.GetFileName(f)}");

// Cleanup
Directory.Delete(tmpDir, recursive: true);
Console.WriteLine($"\n  Cleaned up: {tmpDir}");
```

      Total lines: 6, Last: 2024-01-15T03:02:00|INFO|Pipeline completed
      Binary: 89-50-4E-47
      FileName:  events.parquet
      Extension: .parquet
      Directory: \data\lake\raw\events\2024\01
      Combine:   C:\Users\aperi\AppData\Local\Temp\fileio_cs_43ca5c6c\output\data.csv
        etl_log.txt
        pipeline_output.txt
        sample.bin
    
      Cleaned up: C:\Users\aperi\AppData\Local\Temp\fileio_cs_43ca5c6c

## CSV Files

#### Write and read CSV manually

```csharp
#nullable enable

// Write and read CSV — manual string.Split works for controlled data; use CsvHelper for production
var tmpDir = Path.Combine(Path.GetTempPath(), "csv_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);

// Write CSV with StreamWriter
var csvFile = Path.Combine(tmpDir, "pipeline_runs.csv");
using (var writer = new StreamWriter(csvFile, false, Encoding.UTF8))
{
    writer.WriteLine("pipeline_id,status,rows_processed,duration_s");
    writer.WriteLine("etl_001,success,15000,2.3");
    writer.WriteLine("etl_002,failed,0,0.1");
    writer.WriteLine("etl_003,success,8200,1.7");
}
Console.WriteLine($"  Written: {Path.GetFileName(csvFile)}");

// Read CSV with string.Split — works only if values never contain commas
using (var reader = new StreamReader(csvFile, Encoding.UTF8))
{
    var header = reader.ReadLine()?.Split(',');
    Console.WriteLine($"  Header: [{string.Join(", ", header!)}]");
    string? line;
    while ((line = reader.ReadLine()) != null)
    {
        var parts = line.Split(',');
        Console.WriteLine($"  {parts[0]}: {parts[1]}, {int.Parse(parts[2]):N0} rows");
    }
}
```

      Written: pipeline_runs.csv
      Header: [pipeline_id, status, rows_processed, duration_s]
      etl_001: success, 15'000 rows
      etl_002: failed, 0 rows
      etl_003: success, 8'200 rows

#### CSV quoting, DictReader pattern, and delimiters

```csharp
// CSV quoting — quote fields containing commas/quotes; DictReader maps header to values

// Helper: quote fields that contain commas, quotes, or newlines
string CsvQuote(string value)
{
    if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
        return $"\"{value.Replace("\"", "\"\"")}\"";
    return value;
}
string CsvRow(params string[] fields) =>
    string.Join(",", fields.Select(CsvQuote));

// DictReader pattern — map each row to Dictionary<string, string> using header as keys
List<Dictionary<string, string>> ReadCsvAsDict(string path)
{
    var results = new List<Dictionary<string, string>>();
    using var reader = new StreamReader(path, Encoding.UTF8);
    var headerLine = reader.ReadLine();
    if (headerLine == null) return results;
    var columns = headerLine.Split(',');
    string? line;
    while ((line = reader.ReadLine()) != null)
    {
        var values = line.Split(',');
        var row = new Dictionary<string, string>();
        for (int i = 0; i < columns.Length && i < values.Length; i++)
            row[columns[i]] = values[i];
        results.Add(row);
    }
    return results;
}

var rows = ReadCsvAsDict(csvFile);
foreach (var row in rows)
    Console.WriteLine($"  {row["pipeline_id"]}: {row["status"]}");

// Pipe-delimited and tab-delimited — just change the delimiter character
var pipeData = "id|name|region\n1|Alice|EMEA\n2|Bob|APAC";
foreach (var line in pipeData.Split('\n'))
    Console.WriteLine($"  Pipe: [{string.Join(", ", line.Split('|'))}]");

// In-memory CSV — StringWriter for API payloads or cloud uploads
var sw = new StringWriter();
sw.WriteLine("event_id,event_type,timestamp");
sw.WriteLine("evt_001,page_view,2024-01-15T10:30:00Z");
Console.WriteLine($"  In-memory CSV: {sw.ToString().TrimEnd()}");

// Cleanup
Directory.Delete(tmpDir, recursive: true);
```

      etl_001: success
      etl_002: failed
      etl_003: success
      Pipe: [id, name, region]
      Pipe: [1, Alice, EMEA]
      Pipe: [2, Bob, APAC]
      In-memory CSV: event_id,event_type,timestamp
    evt_001,page_view,2024-01-15T10:30:00Z

## Parquet Files

#### NuGet package and type declarations

```csharp
#r "nuget: Parquet.Net, 5.5.0"

using Parquet;
using Parquet.Data;
using Parquet.Schema;
using Parquet.Serialization;

// EventRecord — Parquet.Net maps properties to parquet columns
public class EventRecord
{
    public string EventId { get; set; } = "";
    public string EventType { get; set; } = "";
    public long UserId { get; set; }
    public double Revenue { get; set; }
    public bool IsMobile { get; set; }
}
```

<div><div></div><div></div><div><strong>Installed Packages</strong><ul><li><span>Parquet.Net, 5.5.0</span></li></ul></div></div>

#### Write parquet — DataColumn API

```csharp
// Write parquet — define schema, then write one column at a time (columnar format)
var tmpDir = Path.Combine(Path.GetTempPath(), "parquet_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);

// Define schema — DataField(name, type) for each column
var schema = new ParquetSchema(
    new DataField<string>("event_id"),
    new DataField<string>("event_type"),
    new DataField<long>("user_id"),
    new DataField<double>("revenue"),
    new DataField<bool>("is_mobile")
);

var parquetFile = Path.Combine(tmpDir, "events.parquet");

// Write column by column — parquet is columnar, not row-based
using (Stream fs = File.OpenWrite(parquetFile))
{
    using var writer = await ParquetWriter.CreateAsync(schema, fs);
    using var groupWriter = writer.CreateRowGroup();

    await groupWriter.WriteColumnAsync(
        new DataColumn(schema.DataFields[0], new[] { "evt_001", "evt_002", "evt_003", "evt_004", "evt_005" }));
    await groupWriter.WriteColumnAsync(
        new DataColumn(schema.DataFields[1], new[] { "page_view", "purchase", "page_view", "signup", "purchase" }));
    await groupWriter.WriteColumnAsync(
        new DataColumn(schema.DataFields[2], new long[] { 1001, 1002, 1001, 1003, 1002 }));
    await groupWriter.WriteColumnAsync(
        new DataColumn(schema.DataFields[3], new double[] { 0.0, 49.99, 0.0, 0.0, 129.99 }));
    await groupWriter.WriteColumnAsync(
        new DataColumn(schema.DataFields[4], new bool[] { true, false, true, true, false }));
}

Console.WriteLine($"  Written: {Path.GetFileName(parquetFile)} ({new FileInfo(parquetFile).Length} bytes)");
```

      Written: events.parquet (1045 bytes)

#### Read parquet — DataColumn API

```csharp
// Read parquet — schema is embedded in the file; read columns individually
using (Stream fs = File.OpenRead(parquetFile))
{
    using var reader = await ParquetReader.CreateAsync(fs);

    Console.WriteLine($"  Schema: {string.Join(", ", reader.Schema.DataFields.Select(f => $"{f.Name}:{f.ClrType.Name}"))}");

    using var groupReader = reader.OpenRowGroupReader(0);

    var eventIds = (await groupReader.ReadColumnAsync(reader.Schema.DataFields[0])).Data.Cast<string>().ToArray();
    var eventTypes = (await groupReader.ReadColumnAsync(reader.Schema.DataFields[1])).Data.Cast<string>().ToArray();
    var userIds = (await groupReader.ReadColumnAsync(reader.Schema.DataFields[2])).Data.Cast<long>().ToArray();
    var revenues = (await groupReader.ReadColumnAsync(reader.Schema.DataFields[3])).Data.Cast<double>().ToArray();

    Console.WriteLine($"  Rows: {eventIds.Length}");
    for (int i = 0; i < eventIds.Length; i++)
        Console.WriteLine($"    {eventIds[i]}: {eventTypes[i]}, user={userIds[i]}, revenue=${revenues[i]:F2}");
}
```

      Schema: event_id:String, event_type:String, user_id:Int64, revenue:Double, is_mobile:Boolean
      Rows: 5
        evt_001: page_view, user=1001, revenue=$0.00
        evt_002: purchase, user=1002, revenue=$49.99
        evt_003: page_view, user=1001, revenue=$0.00
        evt_004: signup, user=1003, revenue=$0.00
        evt_005: purchase, user=1002, revenue=$129.99

#### Class serialization and deserialization

```csharp
// Class serialization — serialize a list of objects directly to parquet (simpler API)
var events = new List<EventRecord>
{
    new() { EventId = "evt_001", EventType = "page_view", UserId = 1001, Revenue = 0.0, IsMobile = true },
    new() { EventId = "evt_002", EventType = "purchase",  UserId = 1002, Revenue = 49.99, IsMobile = false },
    new() { EventId = "evt_003", EventType = "page_view", UserId = 1001, Revenue = 0.0, IsMobile = true },
    new() { EventId = "evt_004", EventType = "signup",    UserId = 1003, Revenue = 0.0, IsMobile = true },
    new() { EventId = "evt_005", EventType = "purchase",  UserId = 1002, Revenue = 129.99, IsMobile = false },
};

var typedFile = Path.Combine(tmpDir, "events_typed.parquet");
await ParquetSerializer.SerializeAsync(events, typedFile);
Console.WriteLine($"  Written: {Path.GetFileName(typedFile)} ({new FileInfo(typedFile).Length} bytes)");

// Deserialize back to typed objects
var loaded = await ParquetSerializer.DeserializeAsync<EventRecord>(typedFile);
Console.WriteLine($"  Loaded {loaded.Count} records:");
foreach (var e in loaded)
    Console.WriteLine($"    {e.EventId}: {e.EventType}, user={e.UserId}, revenue=${e.Revenue:F2}");
```

      Written: events_typed.parquet (1037 bytes)
      Loaded 5 records:
        evt_001: page_view, user=1001, revenue=$0.00
        evt_002: purchase, user=1002, revenue=$49.99
        evt_003: page_view, user=1001, revenue=$0.00
        evt_004: signup, user=1003, revenue=$0.00
        evt_005: purchase, user=1002, revenue=$129.99

<h4>Metadata, <code style="font-size:0.75em">MemoryStream</code>, and CSV vs Parquet</h4>

```csharp
// Metadata — read schema and row count without loading data
using (Stream fs = File.OpenRead(parquetFile))
{
    using var reader = await ParquetReader.CreateAsync(fs);
    Console.WriteLine($"  Row groups: {reader.RowGroupCount}");
    foreach (var field in reader.Schema.DataFields)
        Console.WriteLine($"    {field.Name}: {field.ClrType.Name} (nullable={field.IsNullable})");
}

// MemoryStream — build parquet in memory for cloud upload (no temp file)
{
    var memStream = new MemoryStream();
    await ParquetSerializer.SerializeAsync(events, memStream);
    Console.WriteLine($"\n  MemoryStream size: {memStream.Length} bytes");

    memStream.Seek(0, SeekOrigin.Begin);
    var fromMem = await ParquetSerializer.DeserializeAsync<EventRecord>(memStream);
    Console.WriteLine($"  Read from memory: {fromMem.Count} records");
}

// CSV vs Parquet comparison
Console.WriteLine(@"
Feature              CSV                         Parquet
──────────────────────────────────────────────────────────────
Format               Text (row-based)            Binary (columnar)
Schema               No (header row only)        Embedded (typed, nullable)
Compression          None (manual gzip)          Built-in (snappy/gzip/zstd)
Column pruning       No (read all columns)       Yes (read only what you need)
Human-readable       Yes                         No
Use case             Simple exchange, legacy      Data lakes, analytics, BigQuery
");

// Cleanup
Directory.Delete(tmpDir, recursive: true);
```

      Row groups: 1
        event_id: String (nullable=True)
        event_type: String (nullable=True)
        user_id: Int64 (nullable=False)
        revenue: Double (nullable=False)
        is_mobile: Boolean (nullable=False)
    
      MemoryStream size: 1037 bytes
      Read from memory: 5 records
    
    Feature              CSV                         Parquet
    ──────────────────────────────────────────────────────────────
    Format               Text (row-based)            Binary (columnar)
    Schema               No (header row only)        Embedded (typed, nullable)
    Compression          None (manual gzip)          Built-in (snappy/gzip/zstd)
    Column pruning       No (read all columns)       Yes (read only what you need)
    Human-readable       Yes                         No
    Use case             Simple exchange, legacy      Data lakes, analytics, BigQuery

## JSON

#### Type declarations

```csharp
#nullable enable

// Shared JSON options — reuse everywhere
var jsonOptions = new JsonSerializerOptions
{
    WriteIndented = true,
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
};

var tmpDir = Path.Combine(Path.GetTempPath(), "json_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);

// PipelineRun — record with JsonPropertyName for snake_case mapping
record PipelineRun(
    [property: JsonPropertyName("pipeline_id")] string PipelineId,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("rows_processed")] int RowsProcessed,
    [property: JsonPropertyName("started_at")] DateTime StartedAt,
    [property: JsonPropertyName("cost_usd")] decimal CostUsd,
    [property: JsonPropertyName("error_message")] string? ErrorMessage = null
);
```

#### Serialize — object to JSON string

```csharp
// Serialize — convert a C# object into a JSON string for storage, APIs, or message queues
// Using a record/class instead of a Dictionary gives you:
//   - compile-time safety: typo in a property name = compile error, not a silent bug
//   - IDE autocomplete: IntelliSense knows every field and its type
//   - type checking: can't accidentally put a string where an int belongs
//   - refactoring: rename a property and the compiler finds every usage
//   - documentation: the record IS the schema — anyone reading the code sees the shape of the data

// Anonymous object — quick and simple, no class definition needed
var pipelineMeta = new
{
    PipelineId = "etl_events_daily",
    Schedule = "0 3 * * *",
    Source = new { Type = "bigquery", Dataset = "raw_events", Table = "clickstream" },
    Tags = new[] { "production", "clickstream", "daily" },
    RowCount = 1_500_000,
};
Console.WriteLine(JsonSerializer.Serialize(pipelineMeta, jsonOptions));

// Typed record — JsonPropertyName maps PascalCase → snake_case
var run = new PipelineRun(
    PipelineId: "etl_events_daily",
    Status: "success",
    RowsProcessed: 1_500_000,
    StartedAt: new DateTime(2024, 1, 15, 3, 0, 0),
    CostUsd: 0.45m,
    ErrorMessage: null      // omitted due to WhenWritingNull
);
Console.WriteLine(JsonSerializer.Serialize(run, jsonOptions));
```

    {
      "pipeline_id": "etl_events_daily",
      "schedule": "0 3 * * *",
      "source": {
        "type": "bigquery",
        "dataset": "raw_events",
        "table": "clickstream"
      },
      "tags": [
        "production",
        "clickstream",
        "daily"
      ],
      "row_count": 1500000
    }
    {
      "pipeline_id": "etl_events_daily",
      "status": "success",
      "rows_processed": 1500000,
      "started_at": "2024-01-15T03:00:00",
      "cost_usd": 0.45
    }

#### Deserialize — JSON string to typed object

```csharp
// Deserialize — parse a JSON string back into a typed C# object with compile-time safety
var jsonInput = @"{
    ""pipeline_id"": ""etl_purchases"",
    ""status"": ""failed"",
    ""rows_processed"": 0,
    ""started_at"": ""2024-01-15T04:00:00"",
    ""cost_usd"": 0.01,
    ""error_message"": ""Source table not found""
}";

var run2 = JsonSerializer.Deserialize<PipelineRun>(jsonInput, jsonOptions);
Console.WriteLine($"  Pipeline: {run2!.PipelineId}");
Console.WriteLine($"  Status:   {run2.Status}");
Console.WriteLine($"  Error:    {run2.ErrorMessage}");
```

      Pipeline: etl_purchases
      Status:   failed
      Error:    Source table not found

<h4>JSON file I/O and <code style="font-size:0.75em">JsonDocument</code></h4>

```csharp
// JSON file I/O — serialize to file, deserialize from file
var jsonFile = Path.Combine(tmpDir, "pipeline_config.json");
File.WriteAllText(jsonFile, JsonSerializer.Serialize(run, jsonOptions), Encoding.UTF8);
var loaded = JsonSerializer.Deserialize<PipelineRun>(File.ReadAllText(jsonFile), jsonOptions);
Console.WriteLine($"  Loaded: {loaded!.PipelineId}, {loaded.RowsProcessed:N0} rows");

// JsonDocument — low-level read-only DOM for querying without a class
var apiResponse = @"{
    ""status"": ""completed"",
    ""job_id"": ""bq_job_12345"",
    ""statistics"": {
        ""total_bytes_processed"": 524288000,
        ""total_rows"": 1500000,
        ""cache_hit"": false
    }
}";

{
    using var doc = JsonDocument.Parse(apiResponse);
    var root = doc.RootElement;
    Console.WriteLine($"  Job:       {root.GetProperty("job_id").GetString()}");
    var stats = root.GetProperty("statistics");
    Console.WriteLine($"  Rows:      {stats.GetProperty("total_rows").GetInt64():N0}");
    Console.WriteLine($"  Cache hit: {stats.GetProperty("cache_hit").GetBoolean()}");
}
```

      Loaded: etl_events_daily, 1'500'000 rows
      Job:       bq_job_12345
      Rows:      1'500'000
      Cache hit: False

#### JSON Lines (JSONL)

```csharp
// JSONL — one JSON object per line
//standard for BigQuery imports, Kafka, and streaming pipelines
var events = new[]
{
    new { EventId = "evt_001", Type = "page_view", UserId = 1001, Ts = "2024-01-15T10:30:00Z" },
    new { EventId = "evt_002", Type = "purchase",  UserId = 1002, Ts = "2024-01-15T10:31:00Z" },
    new { EventId = "evt_003", Type = "logout",    UserId = 1001, Ts = "2024-01-15T10:35:00Z" },
};

var jsonlFile = Path.Combine(tmpDir, "events.jsonl");
var compactOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

// Write JSONL — one Serialize per line, no indentation
using (var writer = new StreamWriter(jsonlFile, false, Encoding.UTF8))
    foreach (var evt in events)
        writer.WriteLine(JsonSerializer.Serialize(evt, compactOptions));

// Read JSONL — one Deserialize per line
using (var reader = new StreamReader(jsonlFile, Encoding.UTF8))
{
    string? line;
    while ((line = reader.ReadLine()) != null)
    {
        using var lineDoc = JsonDocument.Parse(line);
        var r = lineDoc.RootElement;
        Console.WriteLine($"  {r.GetProperty("event_id")}: {r.GetProperty("type")} by user {r.GetProperty("user_id")}");
    }
}
```

      evt_001: page_view by user 1001
      evt_002: purchase by user 1002
      evt_003: logout by user 1001

<h4><code style="font-size:0.75em">Utf8JsonWriter</code> — write JSON directly to a stream</h4>

```csharp
// Utf8JsonWriter — writes JSON directly to a byte stream in UTF-8 with no intermediate string
{
    var ms = new MemoryStream();
    var utf8Writer = new Utf8JsonWriter(ms, new JsonWriterOptions { Indented = true });
    utf8Writer.WriteStartObject();
    utf8Writer.WriteString("pipeline_id", "etl_events_daily");
    utf8Writer.WriteString("status", "success");
    utf8Writer.WriteNumber("rows_processed", 1_500_000);
    utf8Writer.WriteEndObject();
    utf8Writer.Flush();
    Console.WriteLine($"  Utf8JsonWriter:\n{Encoding.UTF8.GetString(ms.ToArray())}");
}

// Cleanup
Directory.Delete(tmpDir, recursive: true);
```

      Utf8JsonWriter:
    {
      "pipeline_id": "etl_events_daily",
      "status": "success",
      "rows_processed": 1500000
    }

## YAML

#### YAML format and comparison with JSON

```csharp
// YAML — human-friendly config format used by dbt, Airflow, Kubernetes, Docker Compose
// Supports comments, anchors, multi-line strings — unlike JSON which is strict and verbose
// Requires NuGet package YamlDotNet (not built-in like System.Text.Json)

// JSON version — strict: double quotes, no comments, no trailing commas
var jsonConfig = @"{
    ""pipeline"": {
        ""name"": ""etl_events_daily"",
        ""schedule"": ""0 3 * * *"",
        ""owner"": ""data-team""
    },
    ""source"": {
        ""type"": ""bigquery"",
        ""dataset"": ""raw_events""
    }
}";
Console.WriteLine("JSON:");
Console.WriteLine(jsonConfig);
```

    JSON:
    {
        "pipeline": {
            "name": "etl_events_daily",
            "schedule": "0 3 * * *",
            "owner": "data-team"
        },
        "source": {
            "type": "bigquery",
            "dataset": "raw_events"
        }
    }

#### YAML equivalent

```csharp
// YAML equivalent — comments, no quotes needed, indentation-based nesting
var yamlConfig = @"# Pipeline configuration (YAML supports comments — JSON does not)
pipeline:
  name: etl_events_daily
  schedule: ""0 3 * * *""
  owner: data-team

source:
  type: bigquery
  dataset: raw_events
  partitioned_by: event_date    # BigQuery partition column

quality_checks:
  - name: row_count_check       # list items start with -
    min_rows: 1000
  - name: null_check
    columns: [event_id, user_id]   # inline list syntax

tags: [production, clickstream, daily]
";
Console.WriteLine("YAML:");
Console.WriteLine(yamlConfig);
```

    YAML:
    # Pipeline configuration (YAML supports comments — JSON does not)
    pipeline:
      name: etl_events_daily
      schedule: "0 3 * * *"
      owner: data-team
    
    source:
      type: bigquery
      dataset: raw_events
      partitioned_by: event_date    # BigQuery partition column
    
    quality_checks:
      - name: row_count_check       # list items start with -
        min_rows: 1000
      - name: null_check
        columns: [event_id, user_id]   # inline list syntax
    
    tags: [production, clickstream, daily]

#### YamlDotNet usage pattern

```csharp
// YamlDotNet usage pattern — requires: dotnet add package YamlDotNet
Console.WriteLine(@"
// Deserialize YAML → object
var deserializer = new DeserializerBuilder()
    .WithNamingConvention(UnderscoredNamingConvention.Instance)
    .Build();
var config = deserializer.Deserialize<PipelineConfig>(yamlString);

// Serialize object → YAML
var serializer = new SerializerBuilder()
    .WithNamingConvention(UnderscoredNamingConvention.Instance)
    .Build();
string yaml = serializer.Serialize(config);

// Read from file
var config2 = deserializer.Deserialize<PipelineConfig>(File.ReadAllText(""config.yaml""));
");
```

    
    // Deserialize YAML → object
    var deserializer = new DeserializerBuilder()
        .WithNamingConvention(UnderscoredNamingConvention.Instance)
        .Build();
    var config = deserializer.Deserialize<PipelineConfig>(yamlString);
    
    // Serialize object → YAML
    var serializer = new SerializerBuilder()
        .WithNamingConvention(UnderscoredNamingConvention.Instance)
        .Build();
    string yaml = serializer.Serialize(config);
    
    // Read from file
    var config2 = deserializer.Deserialize<PipelineConfig>(File.ReadAllText("config.yaml"));

#### JSON vs YAML comparison

```csharp
// JSON vs YAML — when to use each
Console.WriteLine(@"
Feature           JSON                    YAML
─────────────────────────────────────────────────────
Comments          NO                      YES (#)
Quoting           REQUIRED (double)       Optional
Trailing commas   NO                      N/A
Readability       Compact                 Human-friendly
Use case          APIs, data exchange     Config files (dbt, Airflow, K8s)
C# package        System.Text.Json        YamlDotNet
Security          Safe                    Use SafeYaml / safe_load ONLY
Multi-document    No                      Yes (--- separator)
");
```

    
    Feature           JSON                    YAML
    ─────────────────────────────────────────────────────
    Comments          NO                      YES (#)
    Quoting           REQUIRED (double)       Optional
    Trailing commas   NO                      N/A
    Readability       Compact                 Human-friendly
    Use case          APIs, data exchange     Config files (dbt, Airflow, K8s)
    C# package        System.Text.Json        YamlDotNet
    Security          Safe                    Use SafeYaml / safe_load ONLY
    Multi-document    No                      Yes (--- separator)

## Serialization, Deserialization, and Streams

#### Stream hierarchy

```csharp
#nullable enable

// Stream hierarchy — all I/O in .NET flows through streams
var tmpDir = Path.Combine(Path.GetTempPath(), "streams_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);

Console.WriteLine(@"
Stream (abstract base)
├── FileStream         — bytes to/from a file
├── MemoryStream       — bytes in memory (no disk)
├── NetworkStream      — bytes over TCP
├── GZipStream         — compress/decompress on the fly
└── BufferedStream     — adds buffering to any stream

Wrappers (sit on top of a Stream):
├── StreamReader / StreamWriter  — text I/O (encoding)
├── BinaryReader / BinaryWriter  — primitive types
└── Utf8JsonWriter               — JSON to a stream
");
```

    
    Stream (abstract base)
    ├── FileStream         — bytes to/from a file
    ├── MemoryStream       — bytes in memory (no disk)
    ├── NetworkStream      — bytes over TCP
    ├── GZipStream         — compress/decompress on the fly
    └── BufferedStream     — adds buffering to any stream
    
    Wrappers (sit on top of a Stream):
    ├── StreamReader / StreamWriter  — text I/O (encoding)
    ├── BinaryReader / BinaryWriter  — primitive types
    └── Utf8JsonWriter               — JSON to a stream

<h4><code style="font-size:0.75em">MemoryStream</code> — in-memory byte stream</h4>

```csharp
// MemoryStream — byte[] with a stream interface
// use for cloud uploads, tests, no-disk scenarios

// Write and read bytes in memory
using (var ms = new MemoryStream())
{
    byte[] header = Encoding.UTF8.GetBytes("PIPELINE_DATA\n");
    ms.Write(header, 0, header.Length);
    byte[] payload = Encoding.UTF8.GetBytes("etl_001|success|15000\n");
    ms.Write(payload);

    Console.WriteLine($"  Position: {ms.Position}, Length: {ms.Length} bytes");

    ms.Seek(0, SeekOrigin.Begin);
    Console.WriteLine($"  Content: {Encoding.UTF8.GetString(ms.ToArray()).TrimEnd()}");
}

// Cloud upload pattern — build CSV in memory, upload directly
{
    var uploadStream = new MemoryStream();
    using (var writer = new StreamWriter(uploadStream, Encoding.UTF8, leaveOpen: true))
    {
        writer.WriteLine("event_id,type,user_id");
        writer.WriteLine("evt_001,page_view,1001");
        writer.WriteLine("evt_002,purchase,1002");
        writer.Flush();
    }
    uploadStream.Seek(0, SeekOrigin.Begin);
    Console.WriteLine($"\n  Upload payload: {uploadStream.Length} bytes");
    Console.WriteLine($"  Preview: {Encoding.UTF8.GetString(uploadStream.ToArray()).TrimEnd()}");
}
```

      Position: 36, Length: 36 bytes
      Content: PIPELINE_DATA
    etl_001|success|15000
    
      Upload payload: 73 bytes
      Preview: ﻿event_id,type,user_id
    evt_001,page_view,1001
    evt_002,purchase,1002

<h4><code style="font-size:0.75em">StringWriter</code> / <code style="font-size:0.75em">StringReader</code></h4>

```csharp
// StringWriter/Reader — build and read text in memory without touching disk
// unit testing I/O code without real files, building API payloads,
// formatting multi-line output incrementally, mocking file reads in tests.
// StringWriter wraps a StringBuilder; StringReader wraps a string — both are lightweight.

// StringWriter — build text incrementally (like StringBuilder but with WriteLine)
var sw = new StringWriter();
sw.WriteLine("pipeline_id|status|rows");
sw.WriteLine("etl_001|success|15000");
sw.WriteLine("etl_002|failed|0");
var builtString = sw.ToString();
Console.WriteLine($"  StringWriter:\n  {builtString.TrimEnd()}");

// StringReader — read string line by line as if it were a file
var sr = new StringReader(builtString);
string? line;
int lineNum = 0;
while ((line = sr.ReadLine()) != null)
    Console.WriteLine($"  StringReader line {lineNum++}: {line}");
```

      StringWriter:
      pipeline_id|status|rows
    etl_001|success|15000
    etl_002|failed|0
      StringReader line 0: pipeline_id|status|rows
      StringReader line 1: etl_001|success|15000
      StringReader line 2: etl_002|failed|0

<h4><code style="font-size:0.75em">BinaryReader</code> / <code style="font-size:0.75em">BinaryWriter</code></h4>

```csharp
// BinaryWriter/Reader — write/read primitive types in compact binary format
// Use cases: IoT sensor data, legacy file formats, custom wire protocols, compact caching
// Much smaller than JSON/CSV — a row of (int, double, bool) = 13 bytes vs ~30+ in text

// Write sensor readings to file
var binFile = Path.Combine(tmpDir, "sensor_data.bin");
using (var fs = new FileStream(binFile, FileMode.Create))
using (var bw = new BinaryWriter(fs))
{
    bw.Write(42);    bw.Write(23.5);  bw.Write(true);   // sensor 42
    bw.Write(43);    bw.Write(19.8);  bw.Write(false);  // sensor 43
    bw.Write(44);    bw.Write(31.2);  bw.Write(true);   // sensor 44
}
Console.WriteLine($"  Written: {new FileInfo(binFile).Length} bytes");

// Read back — same order and types as written
using (var fs = new FileStream(binFile, FileMode.Open))
using (var br = new BinaryReader(fs))
{
    while (fs.Position < fs.Length)
    {
        var id = br.ReadInt32();
        var val = br.ReadDouble();
        var alert = br.ReadBoolean();
        Console.WriteLine($"  Sensor {id}: {val:F1}, alert={alert}");
    }
}

// Binary in memory — no disk needed
{
    var binaryMs = new MemoryStream();
    using (var bw = new BinaryWriter(binaryMs, Encoding.UTF8, leaveOpen: true))
    {
        bw.Write(42); bw.Write(23.5); bw.Write(true); bw.Write("EMEA");
    }
    binaryMs.Seek(0, SeekOrigin.Begin);
    var brMem = new BinaryReader(binaryMs);
    Console.WriteLine($"\n  From memory: sensor={brMem.ReadInt32()}, value={brMem.ReadDouble():F1}, " +
                      $"alert={brMem.ReadBoolean()}, region={brMem.ReadString()}");
}
```

      Written: 39 bytes
      Sensor 42: 23.5, alert=True
      Sensor 43: 19.8, alert=False
      Sensor 44: 31.2, alert=True
    
      From memory: sensor=42, value=23.5, alert=True, region=EMEA

<h4><code style="font-size:0.75em">FileStream</code> — low-level byte I/O</h4>

```csharp
// FileStream — low-level byte I/O with control over buffer size, seek position, and file locking
// Use cases: reading/writing binary formats (parquet headers, protobuf), random access within
// large files (seek to a specific offset), concurrent file access with FileShare locks,
// custom buffer sizes for performance tuning on large sequential reads.
// StreamReader/File.ReadAllText use FileStream internally — use FileStream directly when
// you need Seek, binary access, or fine-grained control over how the OS opens the file.
var rawFile = Path.Combine(tmpDir, "raw_data.bin");

// Write raw bytes
using (var fs = new FileStream(rawFile, FileMode.Create, FileAccess.Write))
{
    byte[] data = { 0x01, 0x02, 0x03, 0x04, 0x05 };
    fs.Write(data);
    Console.WriteLine($"  Wrote {fs.Length} bytes");
}

// Read with Seek — skip first 2 bytes, read 3
using (var fs = new FileStream(rawFile, FileMode.Open, FileAccess.Read))
{
    fs.Seek(2, SeekOrigin.Begin);
    var buffer = new byte[3];
    int bytesRead = fs.Read(buffer, 0, buffer.Length);
    Console.WriteLine($"  Read {bytesRead} bytes from offset 2: [{string.Join(", ", buffer.Select(b => $"0x{b:X2}"))}]");
}

// Cleanup
Directory.Delete(tmpDir, recursive: true);
```

      Wrote 5 bytes
      Read 3 bytes from offset 2: [0x03, 0x04, 0x05]
