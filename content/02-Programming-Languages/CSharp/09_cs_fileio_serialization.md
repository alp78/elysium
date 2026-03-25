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
using System.Diagnostics;
using System.IO.MemoryMappedFiles;
using System.Threading;
using System.Security.Cryptography;
using System.Net;
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

    Working dir: C:\Users\aperi\AppData\Local\Temp\fileio_cs_da9b60f9
    
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
      Combine:   C:\Users\aperi\AppData\Local\Temp\fileio_cs_da9b60f9\output\data.csv
        etl_log.txt
        pipeline_output.txt
        sample.bin
    
      Cleaned up: C:\Users\aperi\AppData\Local\Temp\fileio_cs_da9b60f9

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
// CSV quoting — quote fields that contain commas, quotes, or newlines
// Without quoting, a value like "Smith, John" breaks the parser (sees 2 fields instead of 1).
// RFC 4180 rule: wrap in double-quotes, escape internal quotes by doubling them (" → "").

// CsvQuote: wraps a field in quotes if it contains special characters
string CsvQuote(string value)
{
    if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
        return $"\"{value.Replace("\"", "\"\"")}\"";
    return value;
}

// CsvRow: joins quoted fields with commas
string CsvRow(params string[] fields) =>
    string.Join(",", fields.Select(CsvQuote));

// DictReader pattern — map each row to Dictionary<string, string> using the header as keys
// This is what Python's csv.DictReader does automatically.
// Access columns by name (row["status"]) instead of by index (parts[1]).
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
```

      etl_001: success
      etl_002: failed
      etl_003: success

#### Custom delimiters — pipe and tab

```csharp
// Pipe-delimited and tab-delimited — same Split logic, just change the delimiter
// Pipe: common in legacy data warehouses and mainframe exports.
// Tab (TSV): used by BigQuery exports, Redshift UNLOAD, Excel copy-paste.
var pipeData = "id|name|region\n1|Alice|EMEA\n2|Bob|APAC";
foreach (var line in pipeData.Split('\n'))
    Console.WriteLine($"  Pipe: [{string.Join(", ", line.Split('|'))}]");
```

      Pipe: [id, name, region]
      Pipe: [1, Alice, EMEA]
      Pipe: [2, Bob, APAC]

<h4>In-memory CSV — <code style="font-size:0.75em">StringWriter</code></h4>

```csharp
// In-memory CSV — build CSV in memory for API payloads or cloud uploads
// StringWriter wraps a StringBuilder — no disk I/O, no temp file.
// Use when: sending CSV as HTTP response body, uploading to GCS/S3, unit tests.
var sw = new StringWriter();
sw.WriteLine("event_id,event_type,timestamp");
sw.WriteLine("evt_001,page_view,2024-01-15T10:30:00Z");
Console.WriteLine($"  In-memory CSV: {sw.ToString().TrimEnd()}");

// Cleanup
Directory.Delete(tmpDir, recursive: true);
```

      In-memory CSV: event_id,event_type,timestamp
    evt_001,page_view,2024-01-15T10:30:00Z

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

```csharp
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
Console.WriteLine($"  Loaded: {loaded!.PipelineId}, {loaded.RowsProcessed:N0} rows\n");

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
```

      Position: 36, Length: 36 bytes
      Content: PIPELINE_DATA
    etl_001|success|15000

```csharp
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
```

      StringWriter:
      pipeline_id|status|rows
    etl_001|success|15000
    etl_002|failed|0

```csharp
// StringReader — read string line by line as if it were a file
var sr = new StringReader(builtString);
string? line;
int lineNum = 0;
while ((line = sr.ReadLine()) != null)
    Console.WriteLine($"  StringReader line {lineNum++}: {line}");
```

      StringReader line 0: pipeline_id|status|rows
      StringReader line 1: etl_001|success|15000
      StringReader line 2: etl_002|failed|0

<h4><code style="font-size:0.75em">BinaryReader</code> / <code style="font-size:0.75em">BinaryWriter</code></h4>

```csharp
// BinaryWriter — write primitive types in compact binary format
// Each Write() appends the raw bytes of the value: int32=4 bytes, double=8, bool=1.
// A row of (int, double, bool) = 13 bytes vs ~30+ chars in CSV text.
// Use cases: IoT sensor data, legacy file formats, custom wire protocols, compact caching.
var binFile = Path.Combine(tmpDir, "sensor_data.bin");
using (var fs = new FileStream(binFile, FileMode.Create))
using (var bw = new BinaryWriter(fs))
{
    bw.Write(42);    bw.Write(23.5);  bw.Write(true);   // sensor 42
    bw.Write(43);    bw.Write(19.8);  bw.Write(false);  // sensor 43
    bw.Write(44);    bw.Write(31.2);  bw.Write(true);   // sensor 44
}
Console.WriteLine($"  Written: {new FileInfo(binFile).Length} bytes");
```

      Written: 39 bytes

<h4><code style="font-size:0.75em">BinaryReader</code> — read back in same order and types</h4>

```csharp
// BinaryReader — read primitives back in the EXACT same order and types as written
// ReadInt32 reads 4 bytes, ReadDouble reads 8, ReadBoolean reads 1.
// If you read in the wrong order, you get garbage — there's no schema to protect you.
using (var fs = new FileStream(binFile, FileMode.Open))
using (var br = new BinaryReader(fs))
{
    while (fs.Position < fs.Length)
    {
        var id = br.ReadInt32();      // 4 bytes → int
        var val = br.ReadDouble();    // 8 bytes → double
        var alert = br.ReadBoolean(); // 1 byte → bool
        Console.WriteLine($"  Sensor {id}: {val:F1}, alert={alert}");
    }
}
```

      Sensor 42: 23.5, alert=True
      Sensor 43: 19.8, alert=False
      Sensor 44: 31.2, alert=True

#### Binary in memory

```csharp
// Binary in memory — BinaryWriter/Reader on MemoryStream, no disk needed
// leaveOpen: true keeps the MemoryStream alive after disposing the BinaryWriter.
// BinaryWriter.Write(string) prefixes with a length byte — ReadString() knows how many bytes to read.
{
    var binaryMs = new MemoryStream();
    using (var bw = new BinaryWriter(binaryMs, Encoding.UTF8, leaveOpen: true))
    {
        bw.Write(42);       // int32 — 4 bytes
        bw.Write(23.5);     // double — 8 bytes
        bw.Write(true);     // bool — 1 byte
        bw.Write("EMEA");   // string — length-prefixed (1 byte length + 4 bytes "EMEA")
    }
    binaryMs.Seek(0, SeekOrigin.Begin);
    var brMem = new BinaryReader(binaryMs);
    Console.WriteLine($"  From memory: sensor={brMem.ReadInt32()}, value={brMem.ReadDouble():F1}, " +
                      $"alert={brMem.ReadBoolean()}, region={brMem.ReadString()}");
}
```

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

## Async File I/O

#### Async read and write

```csharp
// Async file I/O — non-blocking operations for high-throughput services
//
// WHAT: File.ReadAllTextAsync, StreamReader.ReadLineAsync, FileStream.ReadAsync
//   are async versions of every synchronous I/O method. They return Task<T>
//   and release the calling thread while the OS completes the disk/network operation.
//
// WHY: in a web API or background service, synchronous I/O blocks thread pool threads.
//   With 100 concurrent requests doing File.ReadAllText, you exhaust the thread pool
//   and the entire service hangs. Async I/O releases the thread during the wait.
//
// WHEN TO USE: any I/O in ASP.NET Core, background services, or concurrent pipelines
// ANTI-PATTERNS:
//   - Don't use .Result or .Wait() on async methods — deadlock risk
//   - Don't forget CancellationToken — allows graceful shutdown of long reads
//   - Don't mix sync and async in the same code path

var tmpDir = Path.Combine(Path.GetTempPath(), "async_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);
var asyncFile = Path.Combine(tmpDir, "data.txt");

// Async write — File.WriteAllTextAsync releases the thread during disk write
await File.WriteAllTextAsync(asyncFile, "line1\nline2\nline3\n", Encoding.UTF8);
Console.WriteLine("  Written async");

// Async read — File.ReadAllTextAsync releases the thread during disk read
var content = await File.ReadAllTextAsync(asyncFile, Encoding.UTF8);
Console.WriteLine($"  Read async: {content.TrimEnd().Replace("\n", ", ")}");

// Async line-by-line with StreamReader + CancellationToken
var cts = new CancellationTokenSource();
using (var reader = new StreamReader(asyncFile, Encoding.UTF8))
{
    string? line;
    int lineNum = 0;
    while ((line = await reader.ReadLineAsync(cts.Token)) != null)
        Console.WriteLine($"    Async line {lineNum++}: {line}");
}

// Async write with StreamWriter
var asyncLog = Path.Combine(tmpDir, "log.txt");
await using (var writer = new StreamWriter(asyncLog, false, Encoding.UTF8))
{
    await writer.WriteLineAsync("2024-01-15 INFO Pipeline started");
    await writer.WriteLineAsync("2024-01-15 INFO Processing 1M rows");
    await writer.FlushAsync();
}
Console.WriteLine($"  Async log: {await File.ReadAllTextAsync(asyncLog)}");

Directory.Delete(tmpDir, recursive: true);
```

      Written async
      Read async: line1, line2, line3
        Async line 0: line1
        Async line 1: line2
        Async line 2: line3
      Async log: 2024-01-15 INFO Pipeline started
    2024-01-15 INFO Processing 1M rows

## Advanced JSON Patterns

#### JSON Source Generators

```csharp
// JSON Source Generators — compile-time serialization for maximum performance
//
// WHAT: [JsonSerializable] generates serialization code at compile time instead of
//   using reflection at runtime. The generated code is a JsonSerializerContext
//   that knows how to serialize/deserialize specific types without reflection.
//
// WHY:
//   - 2-5x faster than reflection-based serialization
//   - Zero allocations for known types (no boxing, no reflection metadata)
//   - Required for Native AOT compilation (no runtime code generation)
//   - Reduces application startup time (no JIT compilation of serialization code)
//
// WHEN TO USE: high-throughput APIs (>1000 req/s), serverless (cold start matters),
//   Native AOT builds, any hot path that serializes/deserializes JSON
// ANTI-PATTERNS:
//   - Don't forget to add [JsonSerializable(typeof(YourType))] for each type
//   - Don't use source generators for one-off scripts — overkill, use reflection

// NOTE: Source generators require a partial class in a real project.
// In notebooks, we demonstrate the PATTERN — the actual codegen needs csproj.
Console.WriteLine(@"
// In a real project (not notebook):

// 1. Define your type
public record StockQuote(string Symbol, double Price, DateTime Timestamp);

// 2. Create a source-generated context
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.SnakeCaseLower)]
[JsonSerializable(typeof(StockQuote))]
[JsonSerializable(typeof(List<StockQuote>))]
partial class QuoteContext : JsonSerializerContext { }

// 3. Use the context instead of default options
var json = JsonSerializer.Serialize(quote, QuoteContext.Default.StockQuote);
var parsed = JsonSerializer.Deserialize(json, QuoteContext.Default.StockQuote);

// Result: no reflection, no runtime codegen, AOT-compatible, 2-5x faster
");
```

    
    // In a real project (not notebook):
    
    // 1. Define your type
    public record StockQuote(string Symbol, double Price, DateTime Timestamp);
    
    // 2. Create a source-generated context
    [JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.SnakeCaseLower)]
    [JsonSerializable(typeof(StockQuote))]
    [JsonSerializable(typeof(List<StockQuote>))]
    partial class QuoteContext : JsonSerializerContext { }
    
    // 3. Use the context instead of default options
    var json = JsonSerializer.Serialize(quote, QuoteContext.Default.StockQuote);
    var parsed = JsonSerializer.Deserialize(json, QuoteContext.Default.StockQuote);
    
    // Result: no reflection, no runtime codegen, AOT-compatible, 2-5x faster

<h4><code style="font-size:0.75em">Utf8JsonReader</code> — forward-only zero-allocation parsing</h4>

```csharp
// Utf8JsonReader — low-level, forward-only, zero-allocation JSON parser
//
// WHAT: reads raw UTF-8 bytes token by token without building an object model.
//   You advance through tokens (StartObject, PropertyName, String, Number, etc.)
//   and extract values directly. No intermediate objects are allocated.
//
// WHY: for multi-GB JSON files, JsonSerializer.Deserialize loads everything into RAM.
//   Utf8JsonReader processes tokens one at a time with constant memory.
//   Also useful for extracting a few fields from a large JSON without parsing all of it.
//
// WHEN TO USE: streaming large JSON arrays, extracting specific fields from huge payloads,
//   performance-critical parsing where even JsonDocument is too slow
// ANTI-PATTERNS:
//   - Don't use for simple deserialization — JsonSerializer is simpler and fast enough
//   - Don't forget it's forward-only — you can't go back to a previous token

// Parse a JSON array token by token — extract only the fields we need
// Utf8JsonReader is a ref struct — must be a local variable, not a field.
// In notebooks, top-level variables become fields, so we wrap in a block {}.
{
    var utf8Data = Encoding.UTF8.GetBytes(@"[
      {""symbol"": ""SAP.DE"", ""close"": 166.52, ""volume"": 82621},
      {""symbol"": ""ASML.AS"", ""close"": 685.40, ""volume"": 45000},
      {""symbol"": ""TTE.PA"", ""close"": 58.20, ""volume"": 120000}
    ]");

    var reader = new Utf8JsonReader(utf8Data);
    var symbols = new List<string>();
    string? currentProp = null;

    // Walk through every token — constant memory regardless of JSON size
    while (reader.Read())
    {
        switch (reader.TokenType)
        {
            case JsonTokenType.PropertyName:
                currentProp = reader.GetString();
                break;
            case JsonTokenType.String when currentProp == "symbol":
                symbols.Add(reader.GetString()!);
                break;
        }
    }

    Console.WriteLine($"  Extracted {symbols.Count} symbols: [{string.Join(", ", symbols)}]");
    Console.WriteLine("  Memory: zero heap allocations during parsing (only the result list)");
}
```

      Extracted 3 symbols: [SAP.DE, ASML.AS, TTE.PA]
      Memory: zero heap allocations during parsing (only the result list)

## Memory-Mapped Files

<h4><code style="font-size:0.75em">MemoryMappedFile</code> — OS-paged random access</h4>

```csharp
// MemoryMappedFile — let the OS page parts of a huge file into virtual memory
//
// WHAT: maps a file directly into the process's virtual address space.
//   The OS loads pages on demand — only the parts you access are in RAM.
//   The file behaves like a giant byte array: random access via offset.
//
// WHY: reading a 50GB file with File.ReadAllBytes allocates 50GB of RAM and crashes.
//   MemoryMappedFile lets you access any offset without loading the whole file.
//   The OS handles paging — recently accessed pages stay in RAM, old pages are evicted.
//
// WHEN TO USE: large binary datasets, database files, shared memory between processes,
//   random access patterns (seek to offset N, read M bytes)
// ANTI-PATTERNS:
//   - Don't use for sequential reads — StreamReader is simpler and just as fast
//   - Don't forget to dispose the accessor and the MMF
//   - Don't use for files < 1MB — overhead isn't worth it
var tmpDir = Path.Combine(Path.GetTempPath(), "mmf_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);
var mmfFile = Path.Combine(tmpDir, "large_data.bin");

// Write a binary file with known pattern: byte[i] = i % 256
var data = new byte[1024 * 1024]; // 1MB
for (int i = 0; i < data.Length; i++) data[i] = (byte)(i % 256);
File.WriteAllBytes(mmfFile, data);

// Memory-map the file — OS pages it on demand, no 1MB allocation
using (var mmf = MemoryMappedFile.CreateFromFile(mmfFile, FileMode.Open))
{

// Random access: read 4 bytes at offset 500,000 — only that page is loaded
using (var accessor = mmf.CreateViewAccessor(500_000, 4))
{
    var b0 = accessor.ReadByte(0);
    var b1 = accessor.ReadByte(1);
    Console.WriteLine($"  Bytes at offset 500000: {b0}, {b1}");
    Console.WriteLine($"  Expected: {500000 % 256}, {500001 % 256}");
}

// Read a struct-like record at a specific offset
using (var accessor = mmf.CreateViewAccessor(0, 100))
{
    // Read first 10 bytes
    var buffer = new byte[10];
    accessor.ReadArray(0, buffer, 0, 10);
    Console.WriteLine($"  First 10 bytes: [{string.Join(", ", buffer)}]");
}

}

// Shared memory between processes — named MMF
Console.WriteLine(@"
  // Named MMF for inter-process shared memory:
  // Process A: MemoryMappedFile.CreateNew(""shared_data"", 1024)
  // Process B: MemoryMappedFile.OpenExisting(""shared_data"")
  // Both read/write the same memory region — no serialization needed
");

Directory.Delete(tmpDir, recursive: true);
```

      Bytes at offset 500000: 32, 33
      Expected: 32, 33
      First 10 bytes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    
      // Named MMF for inter-process shared memory:
      // Process A: MemoryMappedFile.CreateNew("shared_data", 1024)
      // Process B: MemoryMappedFile.OpenExisting("shared_data")
      // Both read/write the same memory region — no serialization needed

## System.IO.Pipelines

<h4><code style="font-size:0.75em">PipeReader</code> and <code style="font-size:0.75em">PipeWriter</code></h4>

```csharp
// System.IO.Pipelines — high-performance buffered I/O for streaming data
//
// WHAT: Pipe is a producer-consumer buffer for bytes. PipeWriter writes bytes in,
//   PipeReader reads them out. The pipe manages buffer allocation, growth,
//   and recycling automatically — no manual byte[] management.
//
// WHY: traditional Stream-based code has two problems:
//   1. You allocate byte[] buffers manually and risk over/under-sizing them
//   2. Partial reads require complex state management (what if a record spans two reads?)
//   Pipelines solve both: the buffer grows as needed, and you can "peek" at data
//   without consuming it (AdvanceTo marks how far you've processed).
//
// WHEN TO USE: network servers (Kestrel uses it), log parsers, streaming ingestion
// ANTI-PATTERNS:
//   - Don't use for simple file reads — StreamReader is simpler
//   - Don't forget to call reader.AdvanceTo — without it, the buffer grows forever

// NOTE: System.IO.Pipelines is used internally by ASP.NET Core (Kestrel) for HTTP parsing.
// In notebooks we demonstrate the PATTERN — real usage requires a continuous data source.
Console.WriteLine(@"
// Production pattern: parse newline-delimited records from a network stream

var pipe = new Pipe();

// Producer: reads from network/file into the pipe
async Task FillPipeAsync(Stream source, PipeWriter writer) {
    while (true) {
        Memory<byte> buffer = writer.GetMemory(4096);   // get a buffer from the pool
        int bytesRead = await source.ReadAsync(buffer);  // fill it from the source
        if (bytesRead == 0) break;                       // end of stream
        writer.Advance(bytesRead);                       // tell pipe how much was written
        await writer.FlushAsync();                        // signal consumer
    }
    await writer.CompleteAsync();                          // signal: no more data
}

// Consumer: reads records from the pipe
async Task ReadPipeAsync(PipeReader reader) {
    while (true) {
        ReadResult result = await reader.ReadAsync();     // wait for data
        ReadOnlySequence<byte> buffer = result.Buffer;    // the available bytes
        // Find newline, process the line, then:
        reader.AdvanceTo(consumed, examined);             // mark progress
        if (result.IsCompleted) break;
    }
}
");
Console.WriteLine("  Pipelines: used by ASP.NET Core Kestrel for HTTP parsing");
```

    
    // Production pattern: parse newline-delimited records from a network stream
    
    var pipe = new Pipe();
    
    // Producer: reads from network/file into the pipe
    async Task FillPipeAsync(Stream source, PipeWriter writer) {
        while (true) {
            Memory<byte> buffer = writer.GetMemory(4096);   // get a buffer from the pool
            int bytesRead = await source.ReadAsync(buffer);  // fill it from the source
            if (bytesRead == 0) break;                       // end of stream
            writer.Advance(bytesRead);                       // tell pipe how much was written
            await writer.FlushAsync();                        // signal consumer
        }
        await writer.CompleteAsync();                          // signal: no more data
    }
    
    // Consumer: reads records from the pipe
    async Task ReadPipeAsync(PipeReader reader) {
        while (true) {
            ReadResult result = await reader.ReadAsync();     // wait for data
            ReadOnlySequence<byte> buffer = result.Buffer;    // the available bytes
            // Find newline, process the line, then:
            reader.AdvanceTo(consumed, examined);             // mark progress
            if (result.IsCompleted) break;
        }
    }
    
      Pipelines: used by ASP.NET Core Kestrel for HTTP parsing

## High-Performance Parsing with Span

<h4>Zero-allocation CSV parsing with <code style="font-size:0.75em">ReadOnlySpan&lt;char&gt;</code></h4>

```csharp
// Span-based CSV parsing — parse without allocating strings for each cell
//
// WHAT: instead of line.Split(',') which allocates a new string[] and string per cell,
//   use ReadOnlySpan<char> to slice the line in-place. No heap allocations.
//
// WHY: parsing a 10M-row CSV with Split allocates ~100M strings → massive GC pressure.
//   With Span, you process each cell as a "window" into the original line buffer.
//   The only allocations are for the final output values you choose to keep.
//
// WHEN TO USE: parsing large files (>100MB), hot loops, streaming ingestion
// ANTI-PATTERNS:
//   - Don't store Span in a field or closure — it's stack-only
//   - Don't use for small files — Split is simpler and fast enough

// Traditional: line.Split(',') — allocates N strings per line
var csvLine = "SAP.DE,2024-03-12,166.52,168.00,165.30,82621";
var parts = csvLine.Split(','); // allocates string[] + 6 strings
Console.WriteLine($"  Split: {parts[0]}, close={parts[2]}");

// Span-based: zero allocations until you need the final value
{
    ReadOnlySpan<char> span = csvLine.AsSpan();
    int fieldIndex = 0;
    ReadOnlySpan<char> symbol = default;
    ReadOnlySpan<char> close = default;

    // Walk through the span, slicing at each comma
    while (span.Length > 0)
    {
        int comma = span.IndexOf(',');
        var field = comma >= 0 ? span[..comma] : span;

        if (fieldIndex == 0) symbol = field;      // "SAP.DE" — no allocation
        else if (fieldIndex == 2) close = field;   // "166.52" — no allocation

        fieldIndex++;
        span = comma >= 0 ? span[(comma + 1)..] : ReadOnlySpan<char>.Empty;
    }

    // Only allocate when you need the final value
    var closeValue = double.Parse(close);
    Console.WriteLine($"  Span: {symbol.ToString()}, close={closeValue}");
    Console.WriteLine("  Allocations: 0 during parsing, 1 string for final ToString()");
}
```

      Split: SAP.DE, close=166.52
      Span: SAP.DE, close=166.52
      Allocations: 0 during parsing, 1 string for final ToString()

## Encoding and Decoding

#### Character encoding — UTF-8, ASCII, Unicode

```csharp
// Character encoding — converting between strings and byte arrays
//
// WHAT: Encoding.UTF8.GetBytes(string) converts text to bytes.
//   Encoding.UTF8.GetString(bytes) converts bytes back to text.
//   UTF-8 is the standard for APIs, files, and databases. Always specify it explicitly.
//
// WHY: a string in C# is internally UTF-16 (2 bytes per char). APIs and files use UTF-8
//   (1-4 bytes per char, ASCII-compatible). Without explicit encoding, you get mojibake
//   (é becomes Ã©) or data corruption. Always use Encoding.UTF8, never the default.
//
// WHEN TO USE: writing bytes to streams, HTTP request/response bodies, hashing,
//   reading files with specific encoding, interop with non-.NET systems

var text = "Euro Stoxx 50: SAP €166.52, ASML €685.40";

// UTF-8: variable-length, ASCII-compatible, the internet standard
var utf8Bytes = Encoding.UTF8.GetBytes(text);
var utf8Back = Encoding.UTF8.GetString(utf8Bytes);
Console.WriteLine($"  UTF-8:    {utf8Bytes.Length} bytes, roundtrip={text == utf8Back}");

// ASCII: 7-bit, non-ASCII chars become '?' — data loss!
var asciiBytes = Encoding.ASCII.GetBytes(text);
var asciiBack = Encoding.ASCII.GetString(asciiBytes);
Console.WriteLine($"  ASCII:    {asciiBytes.Length} bytes, roundtrip={text == asciiBack} (€ lost!)");
Console.WriteLine($"  ASCII:    \"{asciiBack}\"");

// UTF-16: C#'s internal format, 2 bytes per char (4 for supplementary)
var utf16Bytes = Encoding.Unicode.GetBytes(text);
Console.WriteLine($"  UTF-16:   {utf16Bytes.Length} bytes (2x larger than UTF-8 for ASCII text)");

// Latin-1 (ISO 8859-1): single-byte Western European — used in some legacy systems
var latin1Bytes = Encoding.Latin1.GetBytes(text);
var latin1Back = Encoding.Latin1.GetString(latin1Bytes);
Console.WriteLine($"  Latin-1:  {latin1Bytes.Length} bytes, roundtrip={text == latin1Back}");

// Detect BOM (Byte Order Mark) in a file
var bom = Encoding.UTF8.GetPreamble();
Console.WriteLine($"  UTF-8 BOM: [{string.Join(", ", bom.Select(b => $"0x{b:X2}"))}] ({bom.Length} bytes)");
```

      UTF-8:    44 bytes, roundtrip=True
      ASCII:    40 bytes, roundtrip=False (€ lost!)
      ASCII:    "Euro Stoxx 50: SAP ?166.52, ASML ?685.40"
      UTF-16:   80 bytes (2x larger than UTF-8 for ASCII text)
      Latin-1:  40 bytes, roundtrip=False
      UTF-8 BOM: [0xEF, 0xBB, 0xBF] (3 bytes)

#### Base64 encoding

```csharp
// Base64 — encode binary data as printable ASCII text
//
// WHAT: Convert.ToBase64String(bytes) encodes bytes as A-Z, a-z, 0-9, +, /, =.
//   Convert.FromBase64String(text) decodes back to bytes.
//   Every 3 bytes of input become 4 chars of output (33% size increase).
//
// WHY: binary data (images, protobuf, encrypted tokens) can't be safely embedded
//   in JSON, XML, URLs, or email. Base64 makes it text-safe.
//   Common in: JWT tokens, API keys, inline images (data: URIs), email attachments.
//
// WHEN TO USE: embedding binary in JSON/XML, JWT payloads, data: URIs, MIME encoding
// ANTI-PATTERNS:
//   - Don't use Base64 for encryption — it's encoding, not security (trivially reversible)
//   - Don't Base64-encode large files — 33% overhead, use binary transfer instead

// Encode text as Base64
var original = "SAP.DE|2024-03-12|166.52";
var base64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(original));
var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(base64));
Console.WriteLine($"  Original:  {original}");
Console.WriteLine($"  Base64:    {base64}");
Console.WriteLine($"  Decoded:   {decoded}");
Console.WriteLine($"  Roundtrip: {original == decoded}");

// Encode raw bytes (e.g., a hash or encrypted payload)
var rawBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47 }; // PNG header
var b64Bytes = Convert.ToBase64String(rawBytes);
Console.WriteLine($"\n  Raw bytes: [{BitConverter.ToString(rawBytes)}]");
Console.WriteLine($"  Base64:    {b64Bytes}");

// URL-safe Base64 (replace + and / with - and _, strip padding =)
var urlSafe = base64.Replace("+", "-").Replace("/", "_").TrimEnd('=');
Console.WriteLine($"\n  Standard:  {base64}");
Console.WriteLine($"  URL-safe:  {urlSafe}");
```

      Original:  SAP.DE|2024-03-12|166.52
      Base64:    U0FQLkRFfDIwMjQtMDMtMTJ8MTY2LjUy
      Decoded:   SAP.DE|2024-03-12|166.52
      Roundtrip: True
    
      Raw bytes: [89-50-4E-47]
      Base64:    iVBORw==
    
      Standard:  U0FQLkRFfDIwMjQtMDMtMTJ8MTY2LjUy
      URL-safe:  U0FQLkRFfDIwMjQtMDMtMTJ8MTY2LjUy

#### Hexadecimal encoding

```csharp
// Hexadecimal — represent bytes as 0-9, A-F pairs
//
// WHAT: Convert.ToHexString(bytes) encodes each byte as 2 hex characters.
//   Convert.FromHexString(hex) decodes back to bytes.
//   Each byte becomes exactly 2 chars (100% size increase, but human-readable).
//
// WHY: hex is the standard for displaying hashes (SHA-256), MAC addresses,
//   color codes (#FF5733), binary protocol debugging, and memory dumps.
//
// WHEN TO USE: logging hashes/keys, debugging binary data, config color codes

// Encode bytes as hex
var hashBytes = new byte[] { 0xDE, 0xAD, 0xBE, 0xEF, 0xCA, 0xFE };
var hex = Convert.ToHexString(hashBytes);           // .NET 5+
var hexLower = Convert.ToHexString(hashBytes).ToLower();
var backToBytes = Convert.FromHexString(hex);
Console.WriteLine($"  Bytes:     [{BitConverter.ToString(hashBytes)}]");
Console.WriteLine($"  Hex:       {hex}");
Console.WriteLine($"  Hex lower: {hexLower}");
Console.WriteLine($"  Roundtrip: {hashBytes.SequenceEqual(backToBytes)}");

// SHA-256 hash displayed as hex (standard format)
var sha256 = SHA256.HashData(Encoding.UTF8.GetBytes("SAP.DE"));
Console.WriteLine($"\n  SHA-256 of \"SAP.DE\": {Convert.ToHexString(sha256).ToLower()}");
Console.WriteLine($"  Length: {sha256.Length} bytes = {sha256.Length * 2} hex chars");
```

      Bytes:     [DE-AD-BE-EF-CA-FE]
      Hex:       DEADBEEFCAFE
      Hex lower: deadbeefcafe
      Roundtrip: True
    
      SHA-256 of "SAP.DE": a80ae49a0c54581271b2fa37bc9113425072ca8b559941b00b916d37af0c4e58
      Length: 32 bytes = 64 hex chars

#### URL encoding

```csharp
// URL encoding — escape special characters for safe use in URLs and query strings
//
// WHAT: Uri.EscapeDataString(text) converts spaces, &, =, +, €, etc. to %XX form.
//   Uri.UnescapeDataString(encoded) decodes back.
//   WebUtility.UrlEncode/UrlDecode is the older API (encodes space as +, not %20).
//
// WHY: URLs have reserved characters (&, =, ?, /, #). If your data contains them,
//   the URL breaks: ?query=SAP&price=166 — is "price" a parameter or part of "query"?
//   URL encoding makes it unambiguous: ?query=SAP%26price%3D166
//
// WHEN TO USE: building API query strings, form POST data, redirect URLs
// ANTI-PATTERNS:
//   - Don't manually replace characters — use the built-in methods
//   - Don't encode the entire URL — only encode parameter VALUES
//   - Don't double-encode (encoding an already-encoded string)

// Uri.EscapeDataString — the modern, RFC 3986-compliant method
var raw = "SAP.DE close=166.52 change=+2.5% sector=Tech&Finance";
var escaped = Uri.EscapeDataString(raw);
var unescaped = Uri.UnescapeDataString(escaped);
Console.WriteLine($"  Raw:       {raw}");
Console.WriteLine($"  Escaped:   {escaped}");
Console.WriteLine($"  Unescaped: {unescaped}");
Console.WriteLine($"  Roundtrip: {raw == unescaped}");

// Building a safe API URL with encoded parameters
var symbol = "BRK.B";  // dot and capital letters
var note = "Q1 2024 earnings & revenue";
var url = $"https://api.example.com/quote?symbol={Uri.EscapeDataString(symbol)}"
        + $"&note={Uri.EscapeDataString(note)}";
Console.WriteLine($"\n  Safe URL: {url}");

// WebUtility.UrlEncode — older API, encodes space as + (HTML form style)
var webEncoded = WebUtility.UrlEncode(raw);
Console.WriteLine($"\n  WebUtility:     {webEncoded}");
Console.WriteLine($"  EscapeDataStr:  {escaped}");
Console.WriteLine("  Difference: space → + (WebUtility) vs %20 (EscapeDataString)");
```

      Raw:       SAP.DE close=166.52 change=+2.5% sector=Tech&Finance
      Escaped:   SAP.DE%20close%3D166.52%20change%3D%2B2.5%25%20sector%3DTech%26Finance
      Unescaped: SAP.DE close=166.52 change=+2.5% sector=Tech&Finance
      Roundtrip: True
    
      Safe URL: https://api.example.com/quote?symbol=BRK.B&note=Q1%202024%20earnings%20%26%20revenue
    
      WebUtility:     SAP.DE+close%3D166.52+change%3D%2B2.5%25+sector%3DTech%26Finance
      EscapeDataStr:  SAP.DE%20close%3D166.52%20change%3D%2B2.5%25%20sector%3DTech%26Finance
      Difference: space → + (WebUtility) vs %20 (EscapeDataString)

#### Encoding comparison

```csharp
// Encoding comparison — same data in every format
var sample = "SAP €166.52";
var sampleBytes = Encoding.UTF8.GetBytes(sample);

Console.WriteLine($"  Original:   {sample}");
Console.WriteLine($"  UTF-8 bytes: [{string.Join(", ", sampleBytes.Select(b => $"0x{b:X2}"))}]");
Console.WriteLine($"  Base64:      {Convert.ToBase64String(sampleBytes)}");
Console.WriteLine($"  Hex:         {Convert.ToHexString(sampleBytes)}");
Console.WriteLine($"  URL:         {Uri.EscapeDataString(sample)}");
Console.WriteLine($"\n  {"Format",-15} {"Output",-40} {"Size",5}");
Console.WriteLine($"  {new string('-', 62)}");
Console.WriteLine($"  {"UTF-8",-15} {sampleBytes.Length + " bytes",-40} {sampleBytes.Length,5}");
Console.WriteLine($"  {"Base64",-15} {Convert.ToBase64String(sampleBytes).Length + " chars",-40} {Convert.ToBase64String(sampleBytes).Length,5}");
Console.WriteLine($"  {"Hex",-15} {Convert.ToHexString(sampleBytes).Length + " chars",-40} {Convert.ToHexString(sampleBytes).Length,5}");
Console.WriteLine($"  {"URL",-15} {Uri.EscapeDataString(sample).Length + " chars",-40} {Uri.EscapeDataString(sample).Length,5}");
```

      Original:   SAP €166.52
      UTF-8 bytes: [0x53, 0x41, 0x50, 0x20, 0xE2, 0x82, 0xAC, 0x31, 0x36, 0x36, 0x2E, 0x35, 0x32]
      Base64:      U0FQIOKCrDE2Ni41Mg==
      Hex:         53415020E282AC3136362E3532
      URL:         SAP%20%E2%82%AC166.52
    
      Format          Output                                    Size
      --------------------------------------------------------------
      UTF-8           13 bytes                                    13
      Base64          20 chars                                    20
      Hex             26 chars                                    26
      URL             21 chars                                    21
