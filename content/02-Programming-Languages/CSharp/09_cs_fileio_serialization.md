---
tags: [csharp]
aliases: [file IO, JSON serialization, CSV, file reading, file writing, serialization, deserialization]
description: "C# file I/O and serialization reference with executable examples and cell outputs — covers File/Stream APIs, System.Text.Json, Newtonsoft.Json, CSV handling, and async file operations. See [09_py_fileio_serialization](https://alp78.github.io/elysium/02-Programming-Languages/Python/09_py_fileio_serialization) for the Python equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 09. File I/O & Serialization - C#

> [!quote]
> "Tape is dead. Disk is tape. Flash is disk. RAM locality is king."
>
> — **Jim Gray**, Turing Award lecture (1998)

```csharp
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

// WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.
```

    WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.

## Read, Write, Append Files

#### File.WriteAllText and File.ReadAllText

> [!info] File class — one-line read/write
>
> - `WriteAllText` — creates or overwrites a file
> - `ReadAllText` — reads entire file into a string
> - UTF-8 by default
>
> > [!warning] Don't use on huge files (loads all into memory) — use `StreamReader` for line-by-line.

```csharp
#nullable enable

// Write and read — File class static methods for simple one-shot operations
var tmpDir = Path.Combine(Path.GetTempPath(), "fileio_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);
$"Working dir: {tmpDir}"

// WriteAllText — creates or overwrites the file
var stagingFile = Path.Combine(tmpDir, "pipeline_output.txt");
var content = "pipeline_id|status|rows_processed\n"
            + "etl_001|success|15000\n"
            + "etl_002|failed|0\n"
            + "etl_003|success|8200\n";
File.WriteAllText(stagingFile, content, Encoding.UTF8);
$"  Written: {Path.GetFileName(stagingFile)} ({new FileInfo(stagingFile).Length} bytes)"

// ReadAllText — entire file into one string (fine for small files)
var text = File.ReadAllText(stagingFile, Encoding.UTF8);
$"  Content ({text.Length} chars): {text[..50]}..."

// ReadAllLines — returns string[] with one element per line
string[] allLines = File.ReadAllLines(stagingFile, Encoding.UTF8);
$"  Lines: {allLines.Length}"
foreach (var (line, i) in allLines.Select((l, i) => (l, i)))
    $"  [{i}]: {line}"
```

    C:\Users\aperi\AppData\Local\Temp\fileio_cs_da9b60f9
    
      pipeline_output.txt (97 bytes)
      pipeline_id|status|rows_processed
    etl_001|success|...
      4
      [0]: pipeline_id|status|rows_processed
      [1]: etl_001|success|15000
      [2]: etl_002|failed|0
      [3]: etl_003|success|8200

#### StreamReader and StreamWriter

> [!info] StreamWriter for Buffered Writing
> `StreamWriter` buffers writes and flushes in batches — more efficient than `WriteAllText` for many small writes.

```csharp
// StreamReader — line-by-line reading for large files

using (var reader = new StreamReader(stagingFile, Encoding.UTF8))
{
    string? line;
    int lineNum = 0;
    while ((line = reader.ReadLine()) != null)
        $"  Line {lineNum++}: {line}"
}

var logFile = Path.Combine(tmpDir, "etl_log.txt");
using (var writer = new StreamWriter(logFile, append: false, Encoding.UTF8))
{
    writer.WriteLine("timestamp|level|message");
    writer.WriteLine("2024-01-15T03:00:00|INFO|Pipeline started");
    writer.WriteLine("2024-01-15T03:00:05|INFO|Extracted 1.5M rows from BigQuery");
    writer.WriteLine("2024-01-15T03:00:12|INFO|Loaded to GCS");
}
$"  Written: {Path.GetFileName(logFile)}"
```

      pipeline_id|status|rows_processed
      etl_001|success|15000
      etl_002|failed|0
      etl_003|success|8200
      etl_log.txt

#### Append, Binary I/O, and Path operations

```csharp
// Append, binary I/O, and Path operations

File.AppendAllText(logFile, "2024-01-15T03:01:00|WARN|Slow query detected\n", Encoding.UTF8);
using (var writer = new StreamWriter(logFile, append: true, Encoding.UTF8))
    writer.WriteLine("2024-01-15T03:02:00|INFO|Pipeline completed");

var lines = File.ReadAllLines(logFile);
$"  Total lines: {lines.Length}, Last: {lines[^1]}"

// Binary I/O — File.WriteAllBytes / File.ReadAllBytes for raw bytes
var binFile = Path.Combine(tmpDir, "sample.bin");
byte[] pngMagic = { 0x89, 0x50, 0x4E, 0x47 };
File.WriteAllBytes(binFile, pngMagic);
byte[] raw = File.ReadAllBytes(binFile);
BitConverter.ToString(raw)   // Binary

// Path operations — System.IO.Path for cross-platform path manipulation
var p = @"/data/lake/raw/events/2024/01/events.parquet";
Path.GetFileName(p)                          // FileName
Path.GetExtension(p)                         // Extension
Path.GetDirectoryName(p)                     // Directory
Path.Combine(tmpDir, "output", "data.csv")   // Combine

// List files
foreach (var f in Directory.GetFiles(tmpDir))
    Path.GetFileName(f)

// Cleanup
Directory.Delete(tmpDir, recursive: true);
```

      6, Last: 2024-01-15T03:02:00|INFO|Pipeline completed
      89-50-4E-47
      events.parquet
      .parquet
      \data\lake\raw\events\2024\01
      C:\Users\aperi\AppData\Local\Temp\fileio_cs_da9b60f9\output\data.csv
        etl_log.txt
        pipeline_output.txt
        sample.bin
    
      C:\Users\aperi\AppData\Local\Temp\fileio_cs_da9b60f9

## CSV Files

#### Write and read CSV manually

Write header + rows with `string.Join`. Read with `Split(',')`. Works for simple data without commas or quotes. For production CSV with quoting, use `CsvHelper`.

> [!warning] Manual Split breaks on quoted commas
>
> Manual `Split` breaks on quoted commas — use `CsvHelper` for user-facing CSV.

> [!success] Use CsvHelper for production CSV
>
> `CsvHelper` handles quoted commas, escaped quotes, and custom delimiters correctly. Use `string.Split` only for controlled internal data where field values are guaranteed to never contain commas.

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
$"  Written: {Path.GetFileName(csvFile)}"

// Read CSV with string.Split — works only if values never contain commas
using (var reader = new StreamReader(csvFile, Encoding.UTF8))
{
    var header = reader.ReadLine()?.Split(',');
    $"  Header: [{string.Join(", ", header!)}]"
    string? line;
    while ((line = reader.ReadLine()) != null)
    {
        var parts = line.Split(',');
        $"  {parts[0]}: {parts[1]}, {int.Parse(parts[2]):N0} rows"
    }
}
```

      pipeline_runs.csv
      [pipeline_id, status, rows_processed, duration_s]
      etl_001: success, 15'000 rows
      etl_002: failed, 0 rows
      etl_003: success, 8'200 rows

#### CSV quoting, DictReader pattern, and delimiters

```csharp
// CSV quoting, DictReader pattern, and custom delimiters

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
    $"  {row["pipeline_id"]}: {row["status"]}"
```

      etl_001: success
      etl_002: failed
      etl_003: success

#### Custom delimiters — pipe and tab

```csharp
// Pipe-delimited and tab-delimited — alternative CSV formats

var pipeData = "id|name|region\n1|Alice|EMEA\n2|Bob|APAC";
foreach (var line in pipeData.Split('\n'))
    $"  Pipe: [{string.Join(", ", line.Split('|'))}]"
```

      [id, name, region]
      [1, Alice, EMEA]
      [2, Bob, APAC]

#### In-memory CSV — StringWriter

```csharp
// In-memory CSV — StringWriter for API payloads and cloud uploads

var sw = new StringWriter();
sw.WriteLine("event_id,event_type,timestamp");
sw.WriteLine("evt_001,page_view,2024-01-15T10:30:00Z");
sw.ToString().TrimEnd()   // In-memory CSV

// Cleanup
Directory.Delete(tmpDir, recursive: true);
```

      event_id,event_type,timestamp
    evt_001,page_view,2024-01-15T10:30:00Z

## JSON

#### JsonSerializerOptions — configure camelCase, indentation, encoding

> [!info] JsonSerializerOptions
>
> - `WriteIndented` — pretty print
> - `PropertyNamingPolicy` — camelCase for APIs
> - `Encoder` — Unicode handling
> - Reuse one instance — don't create new options per call

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
// Serialize — convert C# objects to JSON strings

var pipelineMeta = new
{
    PipelineId = "etl_events_daily",
    Schedule = "0 3 * * *",
    Source = new { Type = "bigquery", Dataset = "raw_events", Table = "clickstream" },
    Tags = new[] { "production", "clickstream", "daily" },
    RowCount = 1_500_000,
};
JsonSerializer.Serialize(pipelineMeta, jsonOptions)
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

#### Typed record serialization with JsonPropertyName

```csharp
// Typed record with JsonPropertyName — PascalCase to snake_case mapping

var run = new PipelineRun(
    PipelineId: "etl_events_daily",
    Status: "success",
    RowsProcessed: 1_500_000,
    StartedAt: new DateTime(2024, 1, 15, 3, 0, 0),
    CostUsd: 0.45m,
    ErrorMessage: null      // omitted due to WhenWritingNull
);
JsonSerializer.Serialize(run, jsonOptions)
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
// Deserialize — parse JSON string into a typed C# object

var jsonInput = @"{
    ""pipeline_id"": ""etl_purchases"",
    ""status"": ""failed"",
    ""rows_processed"": 0,
    ""started_at"": ""2024-01-15T04:00:00"",
    ""cost_usd"": 0.01,
    ""error_message"": ""Source table not found""
}";

var run2 = JsonSerializer.Deserialize<PipelineRun>(jsonInput, jsonOptions);
run2!.PipelineId     // Pipeline
run2.Status          // Status
run2.ErrorMessage    // Error
```

      etl_purchases
      failed
      Source table not found

#### JSON file I/O and JsonDocument

```csharp
// JSON file I/O and JsonDocument — file persistence and dynamic parsing

var jsonFile = Path.Combine(tmpDir, "pipeline_config.json");
File.WriteAllText(jsonFile, JsonSerializer.Serialize(run, jsonOptions), Encoding.UTF8);
var loaded = JsonSerializer.Deserialize<PipelineRun>(File.ReadAllText(jsonFile), jsonOptions);
$"  Loaded: {loaded!.PipelineId}, {loaded.RowsProcessed:N0} rows"

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
    root.GetProperty("job_id").GetString()                // Job
    var stats = root.GetProperty("statistics");
    stats.GetProperty("total_rows").GetInt64()              // Rows
    stats.GetProperty("cache_hit").GetBoolean()             // Cache hit
}
```

      etl_events_daily, 1'500'000 rows
    
      bq_job_12345
      1'500'000
      False

#### JSON Lines (JSONL)

```csharp
// JSON Lines (JSONL) — one JSON object per line for streaming

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
        $"  {r.GetProperty("event_id")}: {r.GetProperty("type")} by user {r.GetProperty("user_id")}"
    }
}
```

      evt_001: page_view by user 1001
      evt_002: purchase by user 1002
      evt_003: logout by user 1001

#### Utf8JsonWriter — write JSON directly to a stream

```csharp
// Utf8JsonWriter — write JSON directly to a byte stream

{
    var ms = new MemoryStream();
    var utf8Writer = new Utf8JsonWriter(ms, new JsonWriterOptions { Indented = true });
    utf8Writer.WriteStartObject();
    utf8Writer.WriteString("pipeline_id", "etl_events_daily");
    utf8Writer.WriteString("status", "success");
    utf8Writer.WriteNumber("rows_processed", 1_500_000);
    utf8Writer.WriteEndObject();
    utf8Writer.Flush();
    Encoding.UTF8.GetString(ms.ToArray())   // Utf8JsonWriter output
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

YAML uses indentation (like Python), supports comments (`#`), anchors, multi-line strings (`|` and `>`). Standard config for dbt, Airflow, K8s, Docker Compose. Requires `YamlDotNet` NuGet. Don't use YAML for API payloads (JSON is the standard) or rely on type coercion (`"yes"` → boolean `true`).

```csharp
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
// JSON version
jsonConfig
```

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
// YAML equivalent of JSON config — comments and clean syntax

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
// YAML version
yamlConfig
```

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
// YamlDotNet usage pattern — serialize and deserialize YAML in C#

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
// JSON vs YAML comparison — when to use each format

// Feature           JSON                    YAML
// ─────────────────────────────────────────────────────
// Comments          NO                      YES (#)
// Quoting           REQUIRED (double)       Optional
// Trailing commas   NO                      N/A
// Readability       Compact                 Human-friendly
// Use case          APIs, data exchange     Config files (dbt, Airflow, K8s)
// C# package        System.Text.Json        YamlDotNet
// Security          Safe                    Use SafeYaml / safe_load ONLY
// Multi-document    No                      Yes (--- separator)
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

For an architecture-level comparison of when to choose JSON, CSV, Parquet, or Avro across the full pipeline, see [serialization-formats](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/serialization-formats). The `GZipStream` and `DeflateStream` wrappers used with these streams map to the codec decisions covered in [compression](https://alp78.github.io/elysium/01-Shell/File-Operations/compression).

#### Serialization Streams — System.IO hierarchy FileStream, MemoryStream, StreamReader

> [!info] Stream hierarchy
>
> - `Stream` — abstract base class
> - `FileStream` — files | `MemoryStream` — in-memory | `NetworkStream` — network
> - `StreamReader`/`StreamWriter` — wrap streams for text I/O
> - Uniform API with async support; always dispose streams

```csharp
#nullable enable

// Stream hierarchy — all I/O in .NET flows through streams
var tmpDir = Path.Combine(Path.GetTempPath(), "streams_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);

// Stream (abstract base)
// ├── FileStream         — bytes to/from a file
// ├── MemoryStream       — bytes in memory (no disk)
// ├── NetworkStream      — bytes over TCP
// ├── GZipStream         — compress/decompress on the fly
// └── BufferedStream     — adds buffering to any stream
//
// Wrappers (sit on top of a Stream):
// ├── StreamReader / StreamWriter  — text I/O (encoding)
// ├── BinaryReader / BinaryWriter  — primitive types
// └── Utf8JsonWriter               — JSON to a stream
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

#### MemoryStream — in-memory byte stream

```csharp
// MemoryStream — in-memory byte stream for testing and cloud uploads

using (var ms = new MemoryStream())
{
    byte[] header = Encoding.UTF8.GetBytes("PIPELINE_DATA\n");
    ms.Write(header, 0, header.Length);
    byte[] payload = Encoding.UTF8.GetBytes("etl_001|success|15000\n");
    ms.Write(payload);

    $"  Position: {ms.Position}, Length: {ms.Length} bytes"

    ms.Seek(0, SeekOrigin.Begin);
    Encoding.UTF8.GetString(ms.ToArray()).TrimEnd()   // Content
}
```

      36, Length: 36 bytes
      PIPELINE_DATA
    etl_001|success|15000

#### MemoryStream + StreamWriter — build CSV in memory for cloud upload

```csharp
// Cloud upload pattern — build CSV in MemoryStream and upload directly

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
    $"  Upload payload: {uploadStream.Length} bytes"
    Encoding.UTF8.GetString(uploadStream.ToArray()).TrimEnd()   // Preview
}
```

    
      73 bytes
      ﻿event_id,type,user_id
    evt_001,page_view,1001
    evt_002,purchase,1002

#### StringWriter / StringReader

```csharp
// StringWriter / StringReader — text stream in memory

var sw = new StringWriter();
sw.WriteLine("pipeline_id|status|rows");
sw.WriteLine("etl_001|success|15000");
sw.WriteLine("etl_002|failed|0");
var builtString = sw.ToString();
builtString.TrimEnd()   // StringWriter output
```

      pipeline_id|status|rows
    etl_001|success|15000
    etl_002|failed|0

#### StringReader — line-by-line parsing of in-memory text

```csharp
// StringReader — read string line by line as if it were a file

var sr = new StringReader(builtString);
string? line;
int lineNum = 0;
while ((line = sr.ReadLine()) != null)
    $"  StringReader line {lineNum++}: {line}"
```

      pipeline_id|status|rows
      etl_001|success|15000
      etl_002|failed|0

#### BinaryReader / BinaryWriter

```csharp
// BinaryWriter — write primitive types in compact binary format

var binFile = Path.Combine(tmpDir, "sensor_data.bin");
using (var fs = new FileStream(binFile, FileMode.Create))
using (var bw = new BinaryWriter(fs))
{
    bw.Write(42);    bw.Write(23.5);  bw.Write(true);   // sensor 42
    bw.Write(43);    bw.Write(19.8);  bw.Write(false);  // sensor 43
    bw.Write(44);    bw.Write(31.2);  bw.Write(true);   // sensor 44
}
new FileInfo(binFile).Length   // bytes written
```

      39 bytes

#### BinaryReader — read back in same order and types

```csharp
// BinaryReader — read primitives back in exact same order and types

using (var fs = new FileStream(binFile, FileMode.Open))
using (var br = new BinaryReader(fs))
{
    while (fs.Position < fs.Length)
    {
        var id = br.ReadInt32();      // 4 bytes → int
        var val = br.ReadDouble();    // 8 bytes → double
        var alert = br.ReadBoolean(); // 1 byte → bool
        $"  Sensor {id}: {val:F1}, alert={alert}"
    }
}
```

      23.5, alert=True
      19.8, alert=False
      31.2, alert=True

#### Binary in memory

```csharp
// Binary in memory — BinaryWriter/Reader on MemoryStream

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
    $"  From memory: sensor={brMem.ReadInt32()}, value={brMem.ReadDouble():F1}, " +
    $"alert={brMem.ReadBoolean()}, region={brMem.ReadString()}"
}
```

      sensor=42, value=23.5, alert=True, region=EMEA

#### FileStream — low-level byte I/O

```csharp
// FileStream — low-level byte I/O with buffer and seek control

var rawFile = Path.Combine(tmpDir, "raw_data.bin");

// Write raw bytes
using (var fs = new FileStream(rawFile, FileMode.Create, FileAccess.Write))
{
    byte[] data = { 0x01, 0x02, 0x03, 0x04, 0x05 };
    fs.Write(data);
    fs.Length   // bytes written
}

// Read with Seek — skip first 2 bytes, read 3
using (var fs = new FileStream(rawFile, FileMode.Open, FileAccess.Read))
{
    fs.Seek(2, SeekOrigin.Begin);
    var buffer = new byte[3];
    int bytesRead = fs.Read(buffer, 0, buffer.Length);
    $"  Read {bytesRead} bytes from offset 2: [{string.Join(", ", buffer.Select(b => $"0x{b:X2}"))}]"
}

// Cleanup
Directory.Delete(tmpDir, recursive: true);
```

      Wrote 5 bytes
      [0x03, 0x04, 0x05]

## Async File I/O

#### Async read and write

Async versions of every I/O method (`ReadAllTextAsync`, `ReadLineAsync`, `ReadAsync`) release the thread during I/O — essential for web servers handling concurrent requests. Same API, just add `Async` suffix and `await`.

> [!warning] Don't use .Result or .Wait()
>
> Don't use `.Result` or `.Wait()` on async methods — deadlock risk. Don't forget `CancellationToken` for graceful shutdown. Don't mix sync and async in the same code path.

> [!success] Always await async methods
>
> Use `await` throughout the call chain. Pass a `CancellationToken` from the caller to every async I/O method to support graceful shutdown. Use `await using` for `IAsyncDisposable` resources like `StreamWriter`.

```csharp
var tmpDir = Path.Combine(Path.GetTempPath(), "async_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);
var asyncFile = Path.Combine(tmpDir, "data.txt");

// Async write — File.WriteAllTextAsync releases the thread during disk write
await File.WriteAllTextAsync(asyncFile, "line1\nline2\nline3\n", Encoding.UTF8);

// Async read — File.ReadAllTextAsync releases the thread during disk read
var content = await File.ReadAllTextAsync(asyncFile, Encoding.UTF8);
content.TrimEnd().Replace("\n", ", ")   // Read async

// Async line-by-line with StreamReader + CancellationToken
var cts = new CancellationTokenSource();
using (var reader = new StreamReader(asyncFile, Encoding.UTF8))
{
    string? line;
    int lineNum = 0;
    while ((line = await reader.ReadLineAsync(cts.Token)) != null)
        $"    Async line {lineNum++}: {line}"
}

// Async write with StreamWriter
var asyncLog = Path.Combine(tmpDir, "log.txt");
await using (var writer = new StreamWriter(asyncLog, false, Encoding.UTF8))
{
    await writer.WriteLineAsync("2024-01-15 INFO Pipeline started");
    await writer.WriteLineAsync("2024-01-15 INFO Processing 1M rows");
    await writer.FlushAsync();
}
await File.ReadAllTextAsync(asyncLog)   // Async log

Directory.Delete(tmpDir, recursive: true);
```

      Written async
      line1, line2, line3
        line1
        line2
        line3
      2024-01-15 INFO Pipeline started
    2024-01-15 INFO Processing 1M rows

## Advanced JSON Patterns

#### System.Text.Json Source Generators — AOT-friendly serialization

`[JsonSerializable]` generates serialization code at compile time — no reflection, 2–5x faster, zero allocations, AOT-compatible. Required for Native AOT. Use for high-throughput APIs (>1000 req/s), serverless (cold start), hot paths. Overkill for prototyping.

> [!info] Source generators require a partial
>
> Source generators require a partial class in a real project. The pattern below demonstrates the API — actual codegen needs a `.csproj`.

```csharp
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
```

    
    // In a real project (not notebook):
    
    // 1. Define your type
    public record StockQuote(string Symbol, double Price, DateTime Timestamp);
    
    // 2. Create a source-generated context
    [JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.SnakeCaseLower)]
    [JsonSerializable(typeof(StockQuote))]
    [JsonSerializable(typeof(List<StockQuote>))]
    JsonSerializerContext { }
    
    // 3. Use the context instead of default options
    var json = JsonSerializer.Serialize(quote, QuoteContext.Default.StockQuote);
    var parsed = JsonSerializer.Deserialize(json, QuoteContext.Default.StockQuote);
    
    // Result: no reflection, no runtime codegen, AOT-compatible, 2-5x faster

#### Utf8JsonReader — forward-only zero-allocation parsing

```csharp
// Utf8JsonReader — forward-only zero-allocation JSON parsing

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

    $"  Extracted {symbols.Count} symbols: [{string.Join(", ", symbols)}]"
    // Memory: zero heap allocations during parsing (only the result list)
}
```

      [SAP.DE, ASML.AS, TTE.PA]
      zero heap allocations during parsing (only the result list)

## Memory-Mapped Files

#### MemoryMappedFile — OS-paged random access

Maps a file into virtual address space — OS pages data into RAM on demand. Access any offset without loading the whole file. Use for huge files (>1GB), random access, IPC shared memory. Don't use for sequential reads (StreamReader is simpler) or files <1MB.

```csharp
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
    $"  Bytes at offset 500000: {b0}, {b1}"
    $"  Expected: {500000 % 256}, {500001 % 256}"
}

// Read a struct-like record at a specific offset
using (var accessor = mmf.CreateViewAccessor(0, 100))
{
    // Read first 10 bytes
    var buffer = new byte[10];
    accessor.ReadArray(0, buffer, 0, 10);
    $"  First 10 bytes: [{string.Join(", ", buffer)}]"
}

}

// Named MMF for inter-process shared memory:
// Process A: MemoryMappedFile.CreateNew("shared_data", 1024)
// Process B: MemoryMappedFile.OpenExisting("shared_data")
// Both read/write the same memory region — no serialization needed

Directory.Delete(tmpDir, recursive: true);
```

      32, 33
      32, 33
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    
      // Named MMF for inter-process shared memory:
      // Process A: MemoryMappedFile.CreateNew("shared_data", 1024)
      // Process B: MemoryMappedFile.OpenExisting("shared_data")
      // Both read/write the same memory region — no serialization needed

## System.IO.Pipelines

#### PipeReader and PipeWriter

`Pipe` is a producer-consumer buffer. `PipeWriter` writes bytes, `PipeReader` reads without copying (zero-allocation). Buffer manages growth and recycling automatically. Built-in backpressure. Used internally by ASP.NET Core (Kestrel) for HTTP parsing. Don't use for simple file reads.

> [!info] This demonstrates the pattern
>
> This demonstrates the pattern — real usage requires a continuous data source (network stream, log pipe).

```csharp
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
// Pipelines: used by ASP.NET Core Kestrel for HTTP parsing
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
    
      used by ASP.NET Core Kestrel for HTTP parsing

## High-Performance Parsing with Span

#### Zero-allocation CSV parsing with ReadOnlySpan&lt;char&gt;

> [!info] Zero-allocation CSV parsing
>
> - `AsSpan()` — creates a zero-allocation view
> - `IndexOf` finds delimiters; `Slice` creates sub-views without new strings
> - Orders of magnitude less GC pressure than `Split`
> - Use for high-throughput parsing (>100MB, millions of rows); for normal CSV, `Split` suffices

```csharp
// Traditional: line.Split(',') — allocates N strings per line
var csvLine = "SAP.DE,2024-03-12,166.52,168.00,165.30,82621";
var parts = csvLine.Split(','); // allocates string[] + 6 strings
$"  Split: {parts[0]}, close={parts[2]}"

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
    $"  Span: {symbol.ToString()}, close={closeValue}"
    // Allocations: 0 during parsing, 1 string for final ToString()
}
```

      SAP.DE, close=166.52
      SAP.DE, close=166.52
      0 during parsing, 1 string for final ToString()

## Encoding and Decoding

#### Encoding.UTF8, Encoding.ASCII — character encoding conversion

`Encoding.UTF8.GetBytes(string)` converts text to bytes. `.GetString(bytes)` converts back. C# strings are internally UTF-16; APIs/files use UTF-8. Always specify encoding explicitly — without it, you get mojibake or data corruption.

> [!danger] Never use Encoding.Default (varies by
>
> Never use `Encoding.Default` (varies by OS) or ASCII for non-English text (silently loses characters like `€`).

> [!success] Always specify Encoding.UTF8 explicitly
>
> Pass `Encoding.UTF8` to every `StreamReader`, `StreamWriter`, `File.ReadAllText`, and `File.WriteAllText` call. UTF-8 is the correct default for files, APIs, and cross-platform code.

```csharp
var text = "Euro Stoxx 50: SAP €166.52, ASML €685.40";

// UTF-8: variable-length, ASCII-compatible, the internet standard
var utf8Bytes = Encoding.UTF8.GetBytes(text);
var utf8Back = Encoding.UTF8.GetString(utf8Bytes);
$"  UTF-8:    {utf8Bytes.Length} bytes, roundtrip={text == utf8Back}"

// ASCII: 7-bit, non-ASCII chars become '?' — data loss!
var asciiBytes = Encoding.ASCII.GetBytes(text);
var asciiBack = Encoding.ASCII.GetString(asciiBytes);
$"  ASCII:    {asciiBytes.Length} bytes, roundtrip={text == asciiBack} (€ lost!)"
asciiBack

// UTF-16: C#'s internal format, 2 bytes per char (4 for supplementary)
var utf16Bytes = Encoding.Unicode.GetBytes(text);
$"  UTF-16:   {utf16Bytes.Length} bytes (2x larger than UTF-8 for ASCII text)"

// Latin-1 (ISO 8859-1): single-byte Western European — used in some legacy systems
var latin1Bytes = Encoding.Latin1.GetBytes(text);
var latin1Back = Encoding.Latin1.GetString(latin1Bytes);
$"  Latin-1:  {latin1Bytes.Length} bytes, roundtrip={text == latin1Back}"

// Detect BOM (Byte Order Mark) in a file
var bom = Encoding.UTF8.GetPreamble();
$"  UTF-8 BOM: [{string.Join(", ", bom.Select(b => $"0x{b:X2}"))}] ({bom.Length} bytes)"
```

      44 bytes, roundtrip=True
      40 bytes, roundtrip=False (€ lost!)
      "Euro Stoxx 50: SAP ?166.52, ASML ?685.40"
      80 bytes (2x larger than UTF-8 for ASCII text)
      40 bytes, roundtrip=False
      [0xEF, 0xBB, 0xBF] (3 bytes)

#### Convert.ToBase64String / FromBase64String — Base64 encoding

```csharp
// Base64 encoding — binary data as printable ASCII text

var original = "SAP.DE|2024-03-12|166.52";
var base64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(original));
var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(base64));
original     // Original
base64       // Base64
decoded      // Decoded
original == decoded   // Roundtrip

// Encode raw bytes (e.g., a hash or encrypted payload)
var rawBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47 }; // PNG header
var b64Bytes = Convert.ToBase64String(rawBytes);
BitConverter.ToString(rawBytes)   // Raw bytes
b64Bytes   // Base64

// URL-safe Base64 (replace + and / with - and _, strip padding =)
var urlSafe = base64.Replace("+", "-").Replace("/", "_").TrimEnd('=');
base64     // Standard
urlSafe    // URL-safe
```

      SAP.DE|2024-03-12|166.52
      U0FQLkRFfDIwMjQtMDMtMTJ8MTY2LjUy
      SAP.DE|2024-03-12|166.52
      True
    
      [89-50-4E-47]
      iVBORw==
    
      U0FQLkRFfDIwMjQtMDMtMTJ8MTY2LjUy
      U0FQLkRFfDIwMjQtMDMtMTJ8MTY2LjUy

#### Convert.ToHexString / FromHexString — hexadecimal encoding

```csharp
// Hexadecimal encoding — bytes as 0-9, A-F character pairs

var hashBytes = new byte[] { 0xDE, 0xAD, 0xBE, 0xEF, 0xCA, 0xFE };
var hex = Convert.ToHexString(hashBytes);           // .NET 5+
var hexLower = Convert.ToHexString(hashBytes).ToLower();
var backToBytes = Convert.FromHexString(hex);
BitConverter.ToString(hashBytes)          // Bytes
hex                                       // Hex
hexLower                                  // Hex lower
hashBytes.SequenceEqual(backToBytes)      // Roundtrip

// SHA-256 hash displayed as hex (standard format)
var sha256 = SHA256.HashData(Encoding.UTF8.GetBytes("SAP.DE"));
Convert.ToHexString(sha256).ToLower()     // SHA-256 of "SAP.DE"
$"  Length: {sha256.Length} bytes = {sha256.Length * 2} hex chars"
```

      [DE-AD-BE-EF-CA-FE]
      DEADBEEFCAFE
      deadbeefcafe
      True
    
      SHA-256 of "SAP.DE": a80ae49a0c54581271b2fa37bc9113425072ca8b559941b00b916d37af0c4e58
      32 bytes = 64 hex chars

#### Uri.EscapeDataString, WebUtility.UrlEncode — URL encoding

```csharp
// URL encoding — escape special characters for safe URL use

var raw = "SAP.DE close=166.52 change=+2.5% sector=Tech&Finance";
var escaped = Uri.EscapeDataString(raw);
var unescaped = Uri.UnescapeDataString(escaped);
raw          // Raw
escaped      // Escaped
unescaped    // Unescaped
raw == unescaped   // Roundtrip

// Building a safe API URL with encoded parameters
var symbol = "BRK.B";  // dot and capital letters
var note = "Q1 2024 earnings & revenue";
var url = $"https://api.example.com/quote?symbol={Uri.EscapeDataString(symbol)}"
        + $"&note={Uri.EscapeDataString(note)}";
url   // Safe URL

// WebUtility.UrlEncode — older API, encodes space as + (HTML form style)
var webEncoded = WebUtility.UrlEncode(raw);
webEncoded   // WebUtility
escaped      // EscapeDataStr
// Difference: space → + (WebUtility) vs %20 (EscapeDataString)
```

      SAP.DE close=166.52 change=+2.5% sector=Tech&Finance
      SAP.DE%20close%3D166.52%20change%3D%2B2.5%25%20sector%3DTech%26Finance
      SAP.DE close=166.52 change=+2.5% sector=Tech&Finance
      True
    
      https://api.example.com/quote?symbol=BRK.B&note=Q1%202024%20earnings%20%26%20revenue
    
      SAP.DE+close%3D166.52+change%3D%2B2.5%25+sector%3DTech%26Finance
      SAP.DE%20close%3D166.52%20change%3D%2B2.5%25%20sector%3DTech%26Finance
      space → + (WebUtility) vs %20 (EscapeDataString)

#### Encoding comparison

```csharp
// Encoding comparison — same data in UTF-8, Base64, Hex, and URL formats

var sample = "SAP €166.52";
var sampleBytes = Encoding.UTF8.GetBytes(sample);

sample                                                                // Original
$"  UTF-8 bytes: [{string.Join(", ", sampleBytes.Select(b => $"0x{b:X2}"))}]"
Convert.ToBase64String(sampleBytes)                                   // Base64
Convert.ToHexString(sampleBytes)                                      // Hex
Uri.EscapeDataString(sample)                                          // URL

$"  {"Format",-15} {"Output",-40} {"Size",5}"
$"  {new string('-', 62)}"
$"  {"UTF-8",-15} {sampleBytes.Length + " bytes",-40} {sampleBytes.Length,5}"
$"  {"Base64",-15} {Convert.ToBase64String(sampleBytes).Length + " chars",-40} {Convert.ToBase64String(sampleBytes).Length,5}"
$"  {"Hex",-15} {Convert.ToHexString(sampleBytes).Length + " chars",-40} {Convert.ToHexString(sampleBytes).Length,5}"
$"  {"URL",-15} {Uri.EscapeDataString(sample).Length + " chars",-40} {Uri.EscapeDataString(sample).Length,5}"
```

      SAP €166.52
      [0x53, 0x41, 0x50, 0x20, 0xE2, 0x82, 0xAC, 0x31, 0x36, 0x36, 0x2E, 0x35, 0x32]
      U0FQIOKCrDE2Ni41Mg==
      53415020E282AC3136362E3532
      SAP%20%E2%82%AC166.52
    
      Format          Output                                    Size
      --------------------------------------------------------------
      UTF-8           13 bytes                                    13
      Base64          20 chars                                    20
      Hex             26 chars                                    26
      URL             21 chars                                    21
