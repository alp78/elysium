---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [file IO, JSON serialization, CSV, file reading, file writing, serialization, deserialization]
keywords: [File, StreamReader, StreamWriter, JsonSerializer, System.Text.Json, Newtonsoft, CsvHelper, Path, Directory]
description: "C# file I/O and serialization reference with executable examples and cell outputs — covers File/Stream APIs, System.Text.Json, Newtonsoft.Json, CSV handling, and async file operations. See [[09_FileIO_Serialization]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[09_FileIO_Serialization]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 09. File I/O & Serialization - C#


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

Console.WriteLine("WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.");
```

## 1. Read, Write, Append Files


```csharp
#nullable enable

using System.IO;
using System.Text;

// File I/O — Read, Write, Append
//
// KEY CONCEPTS:
// - File class: static methods for simple one-shot operations (ReadAllText, WriteAllText, etc.)
// - StreamReader / StreamWriter: for line-by-line or buffered I/O (use with 'using').
// - FileStream: low-level byte stream with control over buffers, seek, and file sharing.
// - MemoryStream: in-memory byte stream (C# equivalent of Python's BytesIO).
// - StringWriter / StringReader: in-memory text stream (C# equivalent of Python's StringIO).
// - All stream types implement IDisposable — always wrap in 'using'.
// - Encoding.UTF8: always specify explicitly (default is UTF-8 in .NET Core, but be explicit).
// - Python equivalent: open(path, 'r'/'w'/'a'), pathlib.Path, io.StringIO / io.BytesIO
// - NOTE: type declarations (class/record) must come AFTER all top-level statements.

// === Create a temp directory for all demos ===
var tmpDir = Path.Combine(Path.GetTempPath(), "fileio_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);  // creates the directory on disk
Console.WriteLine($"Working dir: {tmpDir}\n");

// === Write a file — File.WriteAllText (simplest) ===
Console.WriteLine("=== File.WriteAllText (one-shot write) ===");
// Data Engineering scenario: write pipeline output to a staging file.
// File.WriteAllText: creates file if not exists, OVERWRITES if it does (like Python 'w' mode).

var stagingFile = Path.Combine(tmpDir, "pipeline_output.txt");
var content = "pipeline_id|status|rows_processed\n"
            + "etl_001|success|15000\n"
            + "etl_002|failed|0\n"
            + "etl_003|success|8200\n";
File.WriteAllText(stagingFile, content, Encoding.UTF8);

Console.WriteLine($"  Written: {Path.GetFileName(stagingFile)}");
Console.WriteLine($"  Size: {new FileInfo(stagingFile).Length} bytes");  // FileInfo = file metadata

// === Read entire file — File.ReadAllText ===
Console.WriteLine("\n=== File.ReadAllText (one-shot read) ===");
// Reads entire file into a single string — fine for small files.
// For large files (multi-GB), use StreamReader line-by-line instead.

var text = File.ReadAllText(stagingFile, Encoding.UTF8);
Console.WriteLine($"  Content ({text.Length} chars): {text[..50]}...");

// === Read all lines — File.ReadAllLines ===
Console.WriteLine("\n=== File.ReadAllLines ===");
// Returns string[] — one element per line. Loads all into memory.

string[] allLines = File.ReadAllLines(stagingFile, Encoding.UTF8);
Console.WriteLine($"  Lines: {allLines.Length}");
foreach (var (line, i) in allLines.Select((l, i) => (l, i)))
    Console.WriteLine($"  [{i}]: {line}");

// === StreamReader — line-by-line (memory efficient for large files) ===
Console.WriteLine("\n=== StreamReader (line-by-line) ===");
// Data Engineering scenario: stream through a multi-GB data lake export.
// StreamReader reads one line at a time — constant memory regardless of file size.
// Python equivalent: for line in open(path): ...

using (var reader = new StreamReader(stagingFile, Encoding.UTF8))
{
    // reader.ReadLine() returns null at end-of-file
    string? line;
    int lineNum = 0;
    while ((line = reader.ReadLine()) != null)
    {
        Console.WriteLine($"  Line {lineNum++}: {line}");
    }
}  // reader.Dispose() called here — file handle released

// === StreamWriter — write with control ===
Console.WriteLine("\n=== StreamWriter (buffered write) ===");
// StreamWriter is buffered — more efficient than File.WriteAllText for many small writes.
// Python equivalent: open(path, 'w')

var logFile = Path.Combine(tmpDir, "etl_log.txt");
using (var writer = new StreamWriter(logFile, append: false, Encoding.UTF8))
{
    // append: false = overwrite (like 'w' mode).  append: true = append (like 'a' mode).
    writer.WriteLine("timestamp|level|message");          // WriteLine adds \n automatically
    writer.WriteLine("2024-01-15T03:00:00|INFO|Pipeline started");
    writer.WriteLine("2024-01-15T03:00:05|INFO|Extracted 1.5M rows from BigQuery");
    writer.WriteLine("2024-01-15T03:00:12|INFO|Loaded to GCS");
    writer.Flush();  // force write buffered content to disk (also happens on Dispose)
}

Console.WriteLine($"  Written: {Path.GetFileName(logFile)}");
Console.WriteLine($"  Content:\n{File.ReadAllText(logFile)}");

// === Append — File.AppendAllText / StreamWriter(append: true) ===
Console.WriteLine("=== Append ===");
// Data Engineering scenario: append new pipeline results to the daily log.

// Method 1: File.AppendAllText — one-shot append (simple)
File.AppendAllText(logFile, "2024-01-15T03:01:00|WARN|Slow query detected\n", Encoding.UTF8);

// Method 2: StreamWriter with append: true
using (var writer = new StreamWriter(logFile, append: true, Encoding.UTF8))
{
    writer.WriteLine("2024-01-15T03:02:00|INFO|Pipeline completed");
}

var lines = File.ReadAllLines(logFile);
Console.WriteLine($"  Total lines after append: {lines.Length}");
Console.WriteLine($"  Last line: {lines[^1]}");  // [^1] = last element (Index from end)

// === Binary I/O — FileStream / File.ReadAllBytes ===
Console.WriteLine("\n=== Binary I/O ===");
// For: parquet files, protobuf, images, compressed archives.
// Python equivalent: open(path, 'rb'/'wb')

var binFile = Path.Combine(tmpDir, "sample.bin");
byte[] pngMagic = { 0x89, 0x50, 0x4E, 0x47 };  // PNG header signature

File.WriteAllBytes(binFile, pngMagic);           // write bytes directly

byte[] raw = File.ReadAllBytes(binFile);          // read bytes directly
Console.WriteLine($"  Type: byte[], Length: {raw.Length}");
Console.WriteLine($"  Content: {BitConverter.ToString(raw)}");  // "89-50-4E-47"

// === Path operations (System.IO.Path) ===
Console.WriteLine("\n=== Path operations ===");
// Python equivalent: pathlib.Path

var p = @"/data/lake/raw/events/2024/01/events.parquet";
Console.WriteLine($"  FileName:      {Path.GetFileName(p)}");           // events.parquet
Console.WriteLine($"  FileNameNoExt: {Path.GetFileNameWithoutExtension(p)}"); // events
Console.WriteLine($"  Extension:     {Path.GetExtension(p)}");         // .parquet
Console.WriteLine($"  Directory:     {Path.GetDirectoryName(p)}");     // /data/lake/raw/events/2024/01
Console.WriteLine($"  Combine:       {Path.Combine(tmpDir, "output", "data.csv")}");

// Create a subdirectory
var outputDir = Path.Combine(tmpDir, "output");
Directory.CreateDirectory(outputDir);    // mkdir -p equivalent; no error if exists
Console.WriteLine($"  Created dir:   {outputDir}");
Console.WriteLine($"  Dir exists:    {Directory.Exists(outputDir)}");
Console.WriteLine($"  File exists:   {File.Exists(stagingFile)}");

// List files in a directory (like Python's Path.glob)
Console.WriteLine($"\n  Files in tmpDir:");
foreach (var f in Directory.GetFiles(tmpDir))
    Console.WriteLine($"    {Path.GetFileName(f)}");
// Recursive: Directory.GetFiles(tmpDir, "*.csv", SearchOption.AllDirectories)

// === Cleanup ===
Directory.Delete(tmpDir, recursive: true);  // like Python's shutil.rmtree()
Console.WriteLine($"\n  Cleaned up: {tmpDir}");
```

    Working dir: C:\Users\aperi\AppData\Local\Temp\fileio_cs_2fca94b0
    
    === File.WriteAllText (one-shot write) ===
      Written: pipeline_output.txt
      Size: 97 bytes
    
    === File.ReadAllText (one-shot read) ===
      Content (94 chars): pipeline_id|status|rows_processed
    etl_001|success|...
    
    === File.ReadAllLines ===
      Lines: 4
      [0]: pipeline_id|status|rows_processed
      [1]: etl_001|success|15000
      [2]: etl_002|failed|0
      [3]: etl_003|success|8200
    
    === StreamReader (line-by-line) ===
      Line 0: pipeline_id|status|rows_processed
      Line 1: etl_001|success|15000
      Line 2: etl_002|failed|0
      Line 3: etl_003|success|8200
    
    === StreamWriter (buffered write) ===
      Written: etl_log.txt
      Content:
    timestamp|level|message
    2024-01-15T03:00:00|INFO|Pipeline started
    2024-01-15T03:00:05|INFO|Extracted 1.5M rows from BigQuery
    2024-01-15T03:00:12|INFO|Loaded to GCS
    
    === Append ===
      Total lines after append: 6
      Last line: 2024-01-15T03:02:00|INFO|Pipeline completed
    
    === Binary I/O ===
      Type: byte[], Length: 4
      Content: 89-50-4E-47
    
    === Path operations ===
      FileName:      events.parquet
      FileNameNoExt: events
      Extension:     .parquet
      Directory:     \data\lake\raw\events\2024\01
      Combine:       C:\Users\aperi\AppData\Local\Temp\fileio_cs_2fca94b0\output\data.csv
      Created dir:   C:\Users\aperi\AppData\Local\Temp\fileio_cs_2fca94b0\output
      Dir exists:    True
      File exists:   True
    
      Files in tmpDir:
        etl_log.txt
        pipeline_output.txt
        sample.bin
    
      Cleaned up: C:\Users\aperi\AppData\Local\Temp\fileio_cs_2fca94b0
    

## 2. CSV Files


```csharp
#nullable enable

using System.IO;
using System.Text;

// CSV Files — manual parsing and writing
//
// KEY CONCEPTS:
// - C# has NO built-in CSV library (unlike Python's csv module).
// - Options: (1) manual string.Split — simple but fragile (breaks on quoted commas).
//            (2) CsvHelper NuGet — production-grade, handles all edge cases.
//            (3) StreamReader + manual parsing — shown here for learning.
// - For production DE: always use CsvHelper or equivalent library.
// - Python equivalent: csv module (built-in), csv.DictReader / csv.DictWriter.

// === Write CSV manually ===
Console.WriteLine("=== Write CSV manually ===");
// Data Engineering scenario: export pipeline run results to CSV

var tmpDir = Path.Combine(Path.GetTempPath(), "csv_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);

var csvFile = Path.Combine(tmpDir, "pipeline_runs.csv");

using (var writer = new StreamWriter(csvFile, false, Encoding.UTF8))
{
    // Write header
    writer.WriteLine("pipeline_id,status,rows_processed,duration_s");
    // Write data rows
    writer.WriteLine("etl_001,success,15000,2.3");
    writer.WriteLine("etl_002,failed,0,0.1");
    writer.WriteLine("etl_003,success,8200,1.7");
    writer.WriteLine("etl_004,success,22000,4.1");
    writer.WriteLine("etl_005,success,3100,0.8");
}

Console.WriteLine($"  Written: {Path.GetFileName(csvFile)}");
Console.WriteLine($"  Content:\n{File.ReadAllText(csvFile)}");

// === Read CSV with string.Split (simple, fragile) ===
Console.WriteLine("=== Read CSV with string.Split ===");
// Works only if values NEVER contain commas or quotes.
// Fine for controlled pipeline outputs; dangerous for user-generated data.

using (var reader = new StreamReader(csvFile, Encoding.UTF8))
{
    var header = reader.ReadLine()?.Split(',');  // first line = header
    Console.WriteLine($"  Header: [{string.Join(", ", header!)}]");

    string? line;
    while ((line = reader.ReadLine()) != null)
    {
        var parts = line.Split(',');
        // All values are strings — cast manually (same as Python csv.reader)
        var pipelineId = parts[0];
        var status = parts[1];
        var rows = int.Parse(parts[2]);
        var duration = double.Parse(parts[3]);
        Console.WriteLine($"  {pipelineId}: {status}, {rows:N0} rows, {duration:F1}s");
    }
}

// === Helper: write CSV with quoting (handles commas in values) ===
Console.WriteLine("\n=== CSV with proper quoting ===");
// Data Engineering scenario: names and addresses may contain commas.
// Quote any field that contains a comma, quote, or newline.
// Escape quotes by doubling them: " → ""

string CsvQuote(string value)
{
    // If value contains comma, quote, or newline → wrap in quotes and escape internal quotes
    if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
        return $"\"{value.Replace("\"", "\"\"")}\"";  // double any existing quotes, wrap in quotes
    return value;
}

string CsvRow(params string[] fields) =>
    string.Join(",", fields.Select(CsvQuote));  // quote each field, join with comma

var quotedCsv = Path.Combine(tmpDir, "employees.csv");
using (var writer = new StreamWriter(quotedCsv, false, Encoding.UTF8))
{
    writer.WriteLine(CsvRow("name", "address", "note"));
    writer.WriteLine(CsvRow("Smith, John", "123 Main St, Apt 4", "has a comma"));
    writer.WriteLine(CsvRow("O'Brien", "456 Oak \"Ave\"", "has quotes"));
    writer.WriteLine(CsvRow("Alice", "789 Elm St", "clean value"));
}

Console.WriteLine($"  Raw CSV output:");
Console.WriteLine(File.ReadAllText(quotedCsv));

// === Read CSV as Dictionary (like Python's DictReader) ===
Console.WriteLine("=== Read CSV as Dictionary ===");
// Map each row to a Dictionary<string, string> using the header as keys.
// This is what Python's csv.DictReader does automatically.

List<Dictionary<string, string>> ReadCsvAsDict(string path)
{
    var results = new List<Dictionary<string, string>>();
    using var reader = new StreamReader(path, Encoding.UTF8);

    // Read header — split into column names
    var headerLine = reader.ReadLine();
    if (headerLine == null) return results;
    var columns = headerLine.Split(',');

    // Read data rows
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
{
    // Access columns by name — safer than row[2]
    if (row["status"] == "failed")
        Console.WriteLine($"  FAILED: {row["pipeline_id"]} ({row["rows_processed"]} rows)");
    else
        Console.WriteLine($"  OK:     {row["pipeline_id"]} ({int.Parse(row["rows_processed"]):N0} rows)");
}

// === Pipe-delimited and Tab-delimited ===
Console.WriteLine("\n=== Custom delimiters (pipe, tab) ===");

// Pipe-delimited (common in legacy data warehouses)
var pipeData = "id|name|region\n1|Alice|EMEA\n2|Bob|APAC";
foreach (var line in pipeData.Split('\n'))
{
    var parts = line.Split('|');
    Console.WriteLine($"  Pipe: [{string.Join(", ", parts)}]");
}

// Tab-delimited (TSV — BigQuery exports, Redshift UNLOAD)
var tsvData = "id\tname\tregion\n1\tAlice\tEMEA\n2\tBob\tAPAC";
foreach (var line in tsvData.Split('\n'))
{
    var parts = line.Split('\t');
    Console.WriteLine($"  Tab:  [{string.Join(", ", parts)}]");
}

// === Write CSV to MemoryStream (no disk I/O) ===
Console.WriteLine("\n=== CSV in memory (StringWriter) ===");
// Data Engineering scenario: build CSV payload for an API call or cloud upload
// without writing to disk. Python equivalent: csv.writer(StringIO())

var sw = new StringWriter();   // in-memory text stream (like Python's StringIO)
sw.WriteLine("event_id,event_type,timestamp");
sw.WriteLine("evt_001,page_view,2024-01-15T10:30:00Z");
sw.WriteLine("evt_002,purchase,2024-01-15T10:31:00Z");

var csvString = sw.ToString();  // get the entire CSV as a string
Console.WriteLine($"  In-memory CSV ({csvString.Length} chars):");
Console.WriteLine($"  {csvString.TrimEnd()}");
// csvString can now be sent to an API, uploaded to GCS, or pushed to Kafka.

// === Cleanup ===
Directory.Delete(tmpDir, recursive: true);
Console.WriteLine($"\n  Cleaned up: {tmpDir}");
```

    === Write CSV manually ===
      Written: pipeline_runs.csv
      Content:
    pipeline_id,status,rows_processed,duration_s
    etl_001,success,15000,2.3
    etl_002,failed,0,0.1
    etl_003,success,8200,1.7
    etl_004,success,22000,4.1
    etl_005,success,3100,0.8
    
    === Read CSV with string.Split ===
      Header: [pipeline_id, status, rows_processed, duration_s]
      etl_001: success, 15'000 rows, 2.3s
      etl_002: failed, 0 rows, 0.1s
      etl_003: success, 8'200 rows, 1.7s
      etl_004: success, 22'000 rows, 4.1s
      etl_005: success, 3'100 rows, 0.8s
    
    === CSV with proper quoting ===
      Raw CSV output:
    name,address,note
    "Smith, John","123 Main St, Apt 4",has a comma
    O'Brien,"456 Oak ""Ave""",has quotes
    Alice,789 Elm St,clean value
    
    === Read CSV as Dictionary ===
      OK:     etl_001 (15'000 rows)
      FAILED: etl_002 (0 rows)
      OK:     etl_003 (8'200 rows)
      OK:     etl_004 (22'000 rows)
      OK:     etl_005 (3'100 rows)
    
    === Custom delimiters (pipe, tab) ===
      Pipe: [id, name, region]
      Pipe: [1, Alice, EMEA]
      Pipe: [2, Bob, APAC]
      Tab:  [id, name, region]
      Tab:  [1, Alice, EMEA]
      Tab:  [2, Bob, APAC]
    
    === CSV in memory (StringWriter) ===
      In-memory CSV (110 chars):
      event_id,event_type,timestamp
    evt_001,page_view,2024-01-15T10:30:00Z
    evt_002,purchase,2024-01-15T10:31:00Z
    
      Cleaned up: C:\Users\aperi\AppData\Local\Temp\csv_cs_4da238d3
    

## 3. Parquet Files


```csharp
#r "nuget: Parquet.Net, 5.5.0"

using System.IO;
using Parquet;
using Parquet.Data;
using Parquet.Schema;
using Parquet.Serialization;

// Parquet Files — columnar storage for analytics & data lakes
//
// KEY CONCEPTS:
// - Parquet: columnar binary format. Standard in data lakes (GCS, S3), BigQuery, Spark.
// - Columnar: read only the columns you need — skip the rest (column pruning).
// - Built-in compression: snappy (default), gzip, zstd.
// - Schema embedded in the file — column names, types, and nullability are self-describing.
// - Parquet.Net: the standard C# library for parquet I/O (NuGet: Parquet.Net).
//   Two APIs: (1) low-level DataColumn-based, (2) high-level class serialization.
// - Python equivalent: pyarrow.parquet (pq.read_table, pq.write_table)
// - NOTE: type declarations (class/record) must come AFTER all top-level statements.

var tmpDir = Path.Combine(Path.GetTempPath(), "parquet_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);

// ─────────────────────────────────────────────
// WRITE PARQUET (low-level — DataColumn API)
// ─────────────────────────────────────────────

Console.WriteLine("=== Write parquet (DataColumn API) ===");
// Data Engineering scenario: write event data to a parquet file in a data lake.

// Step 1: Define the schema
// DataField(name, type) — like Arrow's pa.schema() in Python
var schema = new ParquetSchema(
    new DataField<string>("event_id"),
    new DataField<string>("event_type"),
    new DataField<long>("user_id"),
    new DataField<double>("revenue"),
    new DataField<bool>("is_mobile")
);

var parquetFile = Path.Combine(tmpDir, "events.parquet");

// Step 2: Write data column by column
// Parquet is columnar — you write one column at a time, not row by row.
using (Stream fs = File.OpenWrite(parquetFile))
{
    using var writer = await ParquetWriter.CreateAsync(schema, fs);
    // Create a row group — parquet organizes data into row groups (chunks of rows)
    using var groupWriter = writer.CreateRowGroup();

    // Write each column as an array
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

Console.WriteLine($"  Written: {Path.GetFileName(parquetFile)}");
Console.WriteLine($"  Size: {new FileInfo(parquetFile).Length} bytes");

// ─────────────────────────────────────────────
// READ PARQUET (low-level — DataColumn API)
// ─────────────────────────────────────────────

Console.WriteLine("\n=== Read parquet (DataColumn API) ===");

using (Stream fs = File.OpenRead(parquetFile))
{
    using var reader = await ParquetReader.CreateAsync(fs);

    // Read schema — embedded in the file
    Console.WriteLine($"  Schema: {string.Join(", ", reader.Schema.DataFields.Select(f => $"{f.Name}:{f.ClrType.Name}"))}");

    // Read first row group (parquet files can have multiple row groups for large datasets)
    using var groupReader = reader.OpenRowGroupReader(0);

    // Read individual columns
    var eventIds = (await groupReader.ReadColumnAsync(reader.Schema.DataFields[0])).Data.Cast<string>().ToArray();
    var eventTypes = (await groupReader.ReadColumnAsync(reader.Schema.DataFields[1])).Data.Cast<string>().ToArray();
    var userIds = (await groupReader.ReadColumnAsync(reader.Schema.DataFields[2])).Data.Cast<long>().ToArray();
    var revenues = (await groupReader.ReadColumnAsync(reader.Schema.DataFields[3])).Data.Cast<double>().ToArray();

    Console.WriteLine($"  Rows: {eventIds.Length}");
    for (int i = 0; i < eventIds.Length; i++)
        Console.WriteLine($"    {eventIds[i]}: {eventTypes[i]}, user={userIds[i]}, revenue=${revenues[i]:F2}");
}

// ─────────────────────────────────────────────
// CLASS SERIALIZATION (high-level API)
// ─────────────────────────────────────────────

Console.WriteLine("\n=== Write parquet (class serialization) ===");
// Simpler API — serialize a list of objects directly to parquet.
// Like Python's pyarrow.Table.from_pydict() but with typed classes.

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

// === Read back with class deserialization ===
Console.WriteLine("\n=== Read parquet (class deserialization) ===");

var loaded = await ParquetSerializer.DeserializeAsync<EventRecord>(typedFile);
Console.WriteLine($"  Loaded {loaded.Count} records:");
foreach (var e in loaded)
    Console.WriteLine($"    {e.EventId}: {e.EventType}, user={e.UserId}, revenue=${e.Revenue:F2}");

// ─────────────────────────────────────────────
// PARQUET METADATA
// ─────────────────────────────────────────────

Console.WriteLine("\n=== Parquet metadata (no data read) ===");
// Read file metadata without loading data — fast for schema validation, row count checks.

using (Stream fs = File.OpenRead(parquetFile))
{
    using var reader = await ParquetReader.CreateAsync(fs);
    Console.WriteLine($"  Row groups:  {reader.RowGroupCount}");
    Console.WriteLine($"  Schema fields:");
    foreach (var field in reader.Schema.DataFields)
        Console.WriteLine($"    {field.Name}: {field.ClrType.Name} (nullable={field.IsNullable})");
}

// ─────────────────────────────────────────────
// PARQUET IN MEMORY (MemoryStream)
// ─────────────────────────────────────────────

Console.WriteLine("\n=== Parquet in memory (MemoryStream) ===");
// Data Engineering scenario: build parquet in memory for cloud upload (GCS/S3/ADLS).
// No temp file — write to MemoryStream, then upload the bytes.

{
    var memStream = new MemoryStream();
    await ParquetSerializer.SerializeAsync(events, memStream);

    Console.WriteLine($"  MemoryStream size: {memStream.Length} bytes");
    // memStream.ToArray() → byte[] ready for upload:
    // await gcsClient.UploadObjectAsync(bucket, "events.parquet", "application/octet-stream", memStream);

    // Read back from memory
    memStream.Seek(0, SeekOrigin.Begin);
    var fromMem = await ParquetSerializer.DeserializeAsync<EventRecord>(memStream);
    Console.WriteLine($"  Read from memory: {fromMem.Count} records");
}

// ─────────────────────────────────────────────
// CSV vs PARQUET
// ─────────────────────────────────────────────

Console.WriteLine("\n=== CSV vs Parquet comparison ===");
Console.WriteLine(@"
Feature              CSV                         Parquet
──────────────────────────────────────────────────────────────
Format               Text (row-based)            Binary (columnar)
Schema               No (header row only)        Embedded (typed, nullable)
Compression          None (manual gzip)          Built-in (snappy/gzip/zstd)
Column pruning       No (read all columns)       Yes (read only what you need)
Predicate pushdown   No (filter after read)      Yes (skip non-matching row groups)
Human-readable       Yes                         No
Use case             Simple exchange, legacy      Data lakes, analytics, BigQuery
Python library       csv (built-in)              pyarrow / fastparquet
C# library           Manual / CsvHelper          Parquet.Net
");

// === Cleanup ===
Directory.Delete(tmpDir, recursive: true);
Console.WriteLine($"  Cleaned up: {tmpDir}");

// === Type declarations must come AFTER all top-level statements ===

// Event record for class serialization — Parquet.Net maps properties to columns.
// Property names → parquet column names (can customize with attributes).
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


    === Write parquet (DataColumn API) ===
      Written: events.parquet
      Size: 1045 bytes
    
    === Read parquet (DataColumn API) ===
      Schema: event_id:String, event_type:String, user_id:Int64, revenue:Double, is_mobile:Boolean
      Rows: 5
        evt_001: page_view, user=1001, revenue=$0.00
        evt_002: purchase, user=1002, revenue=$49.99
        evt_003: page_view, user=1001, revenue=$0.00
        evt_004: signup, user=1003, revenue=$0.00
        evt_005: purchase, user=1002, revenue=$129.99
    
    === Write parquet (class serialization) ===
      Written: events_typed.parquet (1037 bytes)
    
    === Read parquet (class deserialization) ===
      Loaded 5 records:
        evt_001: page_view, user=1001, revenue=$0.00
        evt_002: purchase, user=1002, revenue=$49.99
        evt_003: page_view, user=1001, revenue=$0.00
        evt_004: signup, user=1003, revenue=$0.00
        evt_005: purchase, user=1002, revenue=$129.99
    
    === Parquet metadata (no data read) ===
      Row groups:  1
      Schema fields:
        event_id: String (nullable=True)
        event_type: String (nullable=True)
        user_id: Int64 (nullable=False)
        revenue: Double (nullable=False)
        is_mobile: Boolean (nullable=False)
    
    === Parquet in memory (MemoryStream) ===
      MemoryStream size: 1037 bytes
      Read from memory: 5 records
    
    === CSV vs Parquet comparison ===
    
    Feature              CSV                         Parquet
    ──────────────────────────────────────────────────────────────
    Format               Text (row-based)            Binary (columnar)
    Schema               No (header row only)        Embedded (typed, nullable)
    Compression          None (manual gzip)          Built-in (snappy/gzip/zstd)
    Column pruning       No (read all columns)       Yes (read only what you need)
    Predicate pushdown   No (filter after read)      Yes (skip non-matching row groups)
    Human-readable       Yes                         No
    Use case             Simple exchange, legacy      Data lakes, analytics, BigQuery
    Python library       csv (built-in)              pyarrow / fastparquet
    C# library           Manual / CsvHelper          Parquet.Net
    
      Cleaned up: C:\Users\aperi\AppData\Local\Temp\parquet_cs_6a02ee9c
    

## 4. JSON


```csharp
#nullable enable

using System.IO;
using System.Text;
using System.Text.Json;            // built-in JSON (System.Text.Json) — .NET Core 3+
using System.Text.Json.Serialization;

// JSON — the standard data exchange format for APIs, configs, and pipelines
//
// KEY CONCEPTS:
// - System.Text.Json: built-in, fast, modern. Preferred for new code.
//   JsonSerializer.Serialize()   = object → JSON string.
//   JsonSerializer.Deserialize() = JSON string → object.
// - Newtonsoft.Json (Json.NET): popular third-party, more features. 
//   Not shown here — System.Text.Json covers most DE needs.
// - For YAML, see the YAML section below (YamlDotNet NuGet package).
// - JsonDocument / JsonElement: low-level, read-only DOM for querying without a class.
// - Python equivalent: json.dumps/loads (System.Text.Json), yaml.safe_load (YamlDotNet)
// - NOTE: type declarations (class/record) must come AFTER all top-level statements.

var tmpDir = Path.Combine(Path.GetTempPath(), "json_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);

// Configure JSON options once — reuse everywhere
var jsonOptions = new JsonSerializerOptions
{
    WriteIndented = true,                              // pretty-print with indentation
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,  // PipelineId → pipeline_id
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull, // skip null fields
};

// ─────────────────────────────────────────────
// SERIALIZE: object → JSON string
// ─────────────────────────────────────────────

// === Serialize anonymous object ===
Console.WriteLine("=== Serialize anonymous object → JSON ===");
// Quick and simple — no class definition needed.

var pipelineMeta = new
{
    PipelineId = "etl_events_daily",
    Schedule = "0 3 * * *",       // cron expression — runs at 3am daily
    Source = new { Type = "bigquery", Dataset = "raw_events", Table = "clickstream" },
    Sink = new { Type = "gcs", Bucket = "data-lake-prod", Path = "processed/events/" },
    Tags = new[] { "production", "clickstream", "daily" },
    RowCount = 1_500_000,
    IsActive = true,
};

var jsonStr = JsonSerializer.Serialize(pipelineMeta, jsonOptions);
Console.WriteLine(jsonStr);
// Note: PropertyNamingPolicy.SnakeCaseLower converts PipelineId → pipeline_id

// === Serialize a typed record ===
Console.WriteLine("\n=== Serialize typed record → JSON ===");
// Data Engineering scenario: serialize a pipeline run for logging or API call.

var run = new PipelineRun(
    PipelineId: "etl_events_daily",
    Status: "success",
    RowsProcessed: 1_500_000,
    StartedAt: new DateTime(2024, 1, 15, 3, 0, 0),
    CostUsd: 0.45m,
    ErrorMessage: null      // will be omitted due to WhenWritingNull
);

jsonStr = JsonSerializer.Serialize(run, jsonOptions);
Console.WriteLine(jsonStr);

// ─────────────────────────────────────────────
// DESERIALIZE: JSON string → object
// ─────────────────────────────────────────────

Console.WriteLine("\n=== Deserialize JSON → typed record ===");
// Data Engineering scenario: parse an API response or Kafka message.

var jsonInput = @"{
    ""pipeline_id"": ""etl_purchases"",
    ""status"": ""failed"",
    ""rows_processed"": 0,
    ""started_at"": ""2024-01-15T04:00:00"",
    ""cost_usd"": 0.01,
    ""error_message"": ""Source table not found""
}";

// Deserialize<T>: JSON string → typed object.
// The JsonPropertyName attributes on the record handle the snake_case → PascalCase mapping.
var run2 = JsonSerializer.Deserialize<PipelineRun>(jsonInput, jsonOptions);
Console.WriteLine($"  Pipeline: {run2!.PipelineId}");
Console.WriteLine($"  Status:   {run2.Status}");
Console.WriteLine($"  Error:    {run2.ErrorMessage}");
Console.WriteLine($"  Type:     {run2.GetType().Name}");

// ─────────────────────────────────────────────
// JSON FILE I/O
// ─────────────────────────────────────────────

Console.WriteLine("\n=== JSON file I/O ===");

var jsonFile = Path.Combine(tmpDir, "pipeline_config.json");

// Write: serialize to file
File.WriteAllText(jsonFile, JsonSerializer.Serialize(run, jsonOptions), Encoding.UTF8);
Console.WriteLine($"  Written: {Path.GetFileName(jsonFile)} ({new FileInfo(jsonFile).Length} bytes)");

// Read: deserialize from file
var loaded = JsonSerializer.Deserialize<PipelineRun>(File.ReadAllText(jsonFile), jsonOptions);
Console.WriteLine($"  Loaded: {loaded!.PipelineId}, {loaded.RowsProcessed:N0} rows");

// ─────────────────────────────────────────────
// JsonDocument — low-level query without a class
// ─────────────────────────────────────────────

Console.WriteLine("\n=== JsonDocument (dynamic/untyped access) ===");
// Use when you don't want to define a class — explore arbitrary JSON.
// Python equivalent: json.loads() returns a dict you access with ["key"].

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
    var root = doc.RootElement;  // JsonElement — the root JSON object

    // Navigate the tree with GetProperty()
    Console.WriteLine($"  Job:       {root.GetProperty("job_id").GetString()}");
    var stats = root.GetProperty("statistics");
    Console.WriteLine($"  Rows:      {stats.GetProperty("total_rows").GetInt64():N0}");
    Console.WriteLine($"  Cache hit: {stats.GetProperty("cache_hit").GetBoolean()}");

    // TryGetProperty — safe access (like Python's .get())
    if (root.TryGetProperty("error", out var errorEl))
        Console.WriteLine($"  Error: {errorEl.GetString()}");
    else
        Console.WriteLine("  Error: (none)");
}

// ─────────────────────────────────────────────
// JSON Lines (JSONL) — one JSON object per line
// ─────────────────────────────────────────────

Console.WriteLine("\n=== JSON Lines (JSONL) ===");
// JSONL is the standard format for BigQuery imports, Kafka messages, streaming pipelines.
// Each line is one complete JSON object. No array wrapper, no commas between lines.

var events = new[]
{
    new { EventId = "evt_001", Type = "page_view", UserId = 1001, Ts = "2024-01-15T10:30:00Z" },
    new { EventId = "evt_002", Type = "purchase",  UserId = 1002, Ts = "2024-01-15T10:31:00Z" },
    new { EventId = "evt_003", Type = "logout",    UserId = 1001, Ts = "2024-01-15T10:35:00Z" },
};

var jsonlFile = Path.Combine(tmpDir, "events.jsonl");

// Write JSONL — one Serialize per line, no indentation (compact)
var compactOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };
using (var writer = new StreamWriter(jsonlFile, false, Encoding.UTF8))
{
    foreach (var evt in events)
        writer.WriteLine(JsonSerializer.Serialize(evt, compactOptions));
}

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

// ─────────────────────────────────────────────
// JSON in memory (MemoryStream / Utf8JsonWriter)
// ─────────────────────────────────────────────

Console.WriteLine("\n=== JSON in memory (Utf8JsonWriter) ===");
// Data Engineering scenario: build JSON payload for API/cloud upload without touching disk.
// Utf8JsonWriter writes directly to a stream in UTF-8 — no intermediate string allocation.

{
    var ms = new MemoryStream();                     // in-memory byte stream
    var utf8Writer = new Utf8JsonWriter(ms, new JsonWriterOptions { Indented = true });
    
    utf8Writer.WriteStartObject();
    utf8Writer.WriteString("pipeline_id", "etl_events_daily");
    utf8Writer.WriteString("status", "success");
    utf8Writer.WriteNumber("rows_processed", 1_500_000);
    utf8Writer.WriteStartArray("tags");
    utf8Writer.WriteStringValue("production");
    utf8Writer.WriteStringValue("clickstream");
    utf8Writer.WriteEndArray();
    utf8Writer.WriteEndObject();
    utf8Writer.Flush();  // flush to the MemoryStream
    
    var jsonBytes = ms.ToArray();                           // get bytes from MemoryStream
    Console.WriteLine($"  Bytes: {jsonBytes.Length}");
    Console.WriteLine($"  JSON:\n{Encoding.UTF8.GetString(jsonBytes)}");
}

// === Cleanup ===
Directory.Delete(tmpDir, recursive: true);
Console.WriteLine($"\n  Cleaned up: {tmpDir}");

// === Type declarations must come AFTER all top-level statements ===

// Pipeline run record — used for JSON serialization demos above.
// JsonPropertyName maps the C# PascalCase → JSON snake_case.
// Alternatively, use JsonSerializerOptions.PropertyNamingPolicy = SnakeCaseLower (as we did above).
record PipelineRun(
    [property: JsonPropertyName("pipeline_id")] string PipelineId,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("rows_processed")] int RowsProcessed,
    [property: JsonPropertyName("started_at")] DateTime StartedAt,
    [property: JsonPropertyName("cost_usd")] decimal CostUsd,
    [property: JsonPropertyName("error_message")] string? ErrorMessage = null
);
```

    === Serialize anonymous object → JSON ===
    {
      "pipeline_id": "etl_events_daily",
      "schedule": "0 3 * * *",
      "source": {
        "type": "bigquery",
        "dataset": "raw_events",
        "table": "clickstream"
      },
      "sink": {
        "type": "gcs",
        "bucket": "data-lake-prod",
        "path": "processed/events/"
      },
      "tags": [
        "production",
        "clickstream",
        "daily"
      ],
      "row_count": 1500000,
      "is_active": true
    }
    
    === Serialize typed record → JSON ===
    {
      "pipeline_id": "etl_events_daily",
      "status": "success",
      "rows_processed": 1500000,
      "started_at": "2024-01-15T03:00:00",
      "cost_usd": 0.45
    }
    
    === Deserialize JSON → typed record ===
      Pipeline: etl_purchases
      Status:   failed
      Error:    Source table not found
      Type:     PipelineRun
    
    === JSON file I/O ===
      Written: pipeline_config.json (159 bytes)
      Loaded: etl_events_daily, 1'500'000 rows
    
    === JsonDocument (dynamic/untyped access) ===
      Job:       bq_job_12345
      Rows:      1'500'000
      Cache hit: False
      Error: (none)
    
    === JSON Lines (JSONL) ===
      evt_001: page_view by user 1001
      evt_002: purchase by user 1002
      evt_003: logout by user 1001
    
    === JSON in memory (Utf8JsonWriter) ===
      Bytes: 152
      JSON:
    {
      "pipeline_id": "etl_events_daily",
      "status": "success",
      "rows_processed": 1500000,
      "tags": [
        "production",
        "clickstream"
      ]
    }
    
      Cleaned up: C:\Users\aperi\AppData\Local\Temp\json_cs_111487ad
    

## 5. YAML


```csharp
// YAML — human-friendly config format used by dbt, Airflow, Kubernetes, Docker Compose
//
// KEY CONCEPTS:
// - YamlDotNet: NuGet package (dotnet add package YamlDotNet).
//   Deserializer.Deserialize<T>() = YAML string → object.
//   Serializer.Serialize()        = object → YAML string.
// - YAML supports comments, anchors, multi-line strings, multi-document files.
// - Python equivalent: yaml.safe_load() / yaml.dump()
// - NOTE: Unlike System.Text.Json (built-in), YAML requires a NuGet package.

// Since YamlDotNet requires a NuGet package, we demonstrate the concepts using string parsing.
// In a real project: dotnet add package YamlDotNet

// === What YAML looks like vs JSON ===
Console.WriteLine("=== YAML vs JSON format comparison ===");

// JSON version (strict: double quotes, no comments, no trailing commas)
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

// Equivalent YAML (comments, no quotes needed, indentation-based)
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

Console.WriteLine("JSON:");
Console.WriteLine(jsonConfig);
Console.WriteLine("\nYAML equivalent:");
Console.WriteLine(yamlConfig);

// === With YamlDotNet (requires NuGet package) ===
Console.WriteLine("=== YamlDotNet usage (code pattern — requires NuGet) ===");
Console.WriteLine(@"
// Install: dotnet add package YamlDotNet

using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

// Deserialize YAML → object
var deserializer = new DeserializerBuilder()
    .WithNamingConvention(UnderscoredNamingConvention.Instance)  // snake_case
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

// === JSON vs YAML comparison table ===
Console.WriteLine("=== JSON vs YAML ===");
Console.WriteLine(@"
Feature           JSON                    YAML
─────────────────────────────────────────────────────
Comments          NO                      YES (#)
Quoting           REQUIRED (double)       Optional
Trailing commas   NO                      N/A
Readability       Compact                 Human-friendly
Use case          APIs, data exchange     Config files (dbt, Airflow, K8s)
C# package        System.Text.Json        YamlDotNet
Python module     json (built-in)         yaml (pip install pyyaml)
Security          Safe                    Use SafeYaml / safe_load ONLY
Multi-document    No                      Yes (--- separator)
");
```

    === YAML vs JSON format comparison ===
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
    
    YAML equivalent:
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
    
    === YamlDotNet usage (code pattern — requires NuGet) ===
    
    // Install: dotnet add package YamlDotNet
    
    using YamlDotNet.Serialization;
    using YamlDotNet.Serialization.NamingConventions;
    
    // Deserialize YAML → object
    var deserializer = new DeserializerBuilder()
        .WithNamingConvention(UnderscoredNamingConvention.Instance)  // snake_case
        .Build();
    var config = deserializer.Deserialize<PipelineConfig>(yamlString);
    
    // Serialize object → YAML
    var serializer = new SerializerBuilder()
        .WithNamingConvention(UnderscoredNamingConvention.Instance)
        .Build();
    string yaml = serializer.Serialize(config);
    
    // Read from file
    var config2 = deserializer.Deserialize<PipelineConfig>(File.ReadAllText("config.yaml"));
    
    === JSON vs YAML ===
    
    Feature           JSON                    YAML
    ─────────────────────────────────────────────────────
    Comments          NO                      YES (#)
    Quoting           REQUIRED (double)       Optional
    Trailing commas   NO                      N/A
    Readability       Compact                 Human-friendly
    Use case          APIs, data exchange     Config files (dbt, Airflow, K8s)
    C# package        System.Text.Json        YamlDotNet
    Python module     json (built-in)         yaml (pip install pyyaml)
    Security          Safe                    Use SafeYaml / safe_load ONLY
    Multi-document    No                      Yes (--- separator)
    
    

## 6. Serialization, Deserialization & Streams


```csharp
#nullable enable

using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

// Serialization, Deserialization & Streams
//
// KEY CONCEPTS:
// - Stream: abstract base class for all byte streams (FileStream, MemoryStream, NetworkStream).
//   Streams are the foundation of all I/O in .NET — everything reads/writes through streams.
//   Key methods: Read(), Write(), Seek(), Flush(), Dispose().
// - MemoryStream: in-memory byte stream. Python equivalent: io.BytesIO.
//   Use for: building payloads for APIs, cloud uploads, unit tests — no disk I/O.
// - StringWriter / StringReader: in-memory text stream. Python equivalent: io.StringIO.
// - StreamReader / StreamWriter: wraps a byte Stream to read/write text (handles encoding).
// - BinaryReader / BinaryWriter: wraps a Stream to read/write primitive types (int, double, bool).
//   Like Python's struct.pack/unpack but higher-level.
// - JsonSerializer: the standard way to serialize objects ↔ JSON (covered in cell 3).
// - BinaryFormatter: OBSOLETE and dangerous — never use (like Python's pickle with untrusted data).
// - NOTE: type declarations (record/class) must come AFTER all top-level statements.

var tmpDir = Path.Combine(Path.GetTempPath(), "streams_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);

// ─────────────────────────────────────────────
// STREAM HIERARCHY
// ─────────────────────────────────────────────

Console.WriteLine("=== .NET Stream hierarchy ===");
Console.WriteLine(@"
Stream (abstract base)
├── FileStream         — reads/writes bytes to a file on disk
├── MemoryStream       — reads/writes bytes in memory (no disk)
├── NetworkStream      — reads/writes bytes over a TCP socket
├── GZipStream         — compresses/decompresses bytes on the fly
├── CryptoStream       — encrypts/decrypts bytes on the fly
└── BufferedStream     — adds buffering to any stream

Wrappers (sit on top of a Stream):
├── StreamReader / StreamWriter  — text I/O (handles encoding: bytes ↔ chars)
├── BinaryReader / BinaryWriter  — primitive types (int, double, bool, string)
└── Utf8JsonWriter               — JSON directly to a stream
");

// ─────────────────────────────────────────────
// MemoryStream — in-memory byte stream
// ─────────────────────────────────────────────

Console.WriteLine("=== MemoryStream (in-memory bytes) ===");
// MemoryStream = byte[] with a stream interface.
// Python equivalent: io.BytesIO

using (var ms = new MemoryStream())
{
    // Write bytes to the stream
    byte[] header = Encoding.UTF8.GetBytes("PIPELINE_DATA\n");
    ms.Write(header, 0, header.Length);   // write(buffer, offset, count)

    byte[] payload = Encoding.UTF8.GetBytes("etl_001|success|15000\n");
    ms.Write(payload);                    // simpler overload (.NET 5+)

    Console.WriteLine($"  Position after write: {ms.Position}");  // cursor position
    Console.WriteLine($"  Length: {ms.Length} bytes");

    // Seek back to start to read
    ms.Seek(0, SeekOrigin.Begin);         // SeekOrigin.Begin = absolute position from start
    // SeekOrigin.Current = relative to current position
    // SeekOrigin.End = relative to end of stream

    // Read all bytes
    var allBytes = ms.ToArray();          // returns entire content as byte[]
    Console.WriteLine($"  Content: {Encoding.UTF8.GetString(allBytes).TrimEnd()}");
}

// === MemoryStream for cloud upload scenario ===
Console.WriteLine("\n=== MemoryStream → cloud upload pattern ===");
// Data Engineering scenario: build a payload in memory, then upload to GCS/S3.
// No temp file needed — MemoryStream goes directly to the upload API.

{
    var uploadStream = new MemoryStream();
    using (var writer = new StreamWriter(uploadStream, Encoding.UTF8, leaveOpen: true))
    {
        // leaveOpen: true — don't close the MemoryStream when StreamWriter is disposed.
        // Without this, disposing the writer would also dispose the MemoryStream.
        writer.WriteLine("event_id,type,user_id");
        writer.WriteLine("evt_001,page_view,1001");
        writer.WriteLine("evt_002,purchase,1002");
        writer.Flush();
    }
    // Now uploadStream contains the CSV bytes — ready for upload:
    // await gcsClient.UploadObjectAsync(bucket, objectName, "text/csv", uploadStream);
    uploadStream.Seek(0, SeekOrigin.Begin);
    Console.WriteLine($"  Upload payload: {uploadStream.Length} bytes");
    Console.WriteLine($"  Preview: {Encoding.UTF8.GetString(uploadStream.ToArray()).TrimEnd()}");
}

// ─────────────────────────────────────────────
// StringWriter / StringReader — in-memory text
// ─────────────────────────────────────────────

Console.WriteLine("\n=== StringWriter / StringReader (in-memory text) ===");
// StringWriter = builds a string incrementally. Python equivalent: io.StringIO.
// StringReader = reads from an existing string as if it were a file.

// StringWriter — build text incrementally
var sw = new StringWriter();
sw.WriteLine("pipeline_id|status|rows");
sw.WriteLine("etl_001|success|15000");
sw.WriteLine("etl_002|failed|0");

var builtString = sw.ToString();   // get the entire content as a string
Console.WriteLine($"  StringWriter output:\n  {builtString.TrimEnd()}");

// StringReader — read string as if it were a file
var sr = new StringReader(builtString);
string? line;
int lineNum = 0;
while ((line = sr.ReadLine()) != null)
{
    Console.WriteLine($"  StringReader line {lineNum++}: {line}");
}

// ─────────────────────────────────────────────
// BinaryReader / BinaryWriter — primitive types
// ─────────────────────────────────────────────

Console.WriteLine("\n=== BinaryReader / BinaryWriter ===");
// Write/read primitive types (int, double, bool, string) in binary format.
// Python equivalent: struct.pack / struct.unpack
// Use case: compact binary formats, IoT sensor data, legacy file formats.

var binFile = Path.Combine(tmpDir, "sensor_data.bin");

// Write sensor readings in binary
using (var fs = new FileStream(binFile, FileMode.Create))
using (var bw = new BinaryWriter(fs))
{
    // Write 3 sensor readings: (int sensorId, double value, bool alert)
    bw.Write(42);       // int32 — 4 bytes
    bw.Write(23.5);     // double — 8 bytes
    bw.Write(true);     // bool — 1 byte

    bw.Write(43);
    bw.Write(19.8);
    bw.Write(false);

    bw.Write(44);
    bw.Write(31.2);
    bw.Write(true);
}

Console.WriteLine($"  Written: {Path.GetFileName(binFile)} ({new FileInfo(binFile).Length} bytes)");

// Read sensor readings back
using (var fs = new FileStream(binFile, FileMode.Open))
using (var br = new BinaryReader(fs))
{
    // Read in the SAME order and types as written
    while (fs.Position < fs.Length)
    {
        var sensorId = br.ReadInt32();    // read 4 bytes as int
        var value = br.ReadDouble();      // read 8 bytes as double
        var alert = br.ReadBoolean();     // read 1 byte as bool
        Console.WriteLine($"  Sensor {sensorId}: {value:F1}, alert={alert}");
    }
}

// === BinaryWriter with MemoryStream (in memory) ===
Console.WriteLine("\n=== Binary in memory (MemoryStream + BinaryWriter) ===");

{
    var binaryMs = new MemoryStream();
    using (var bw = new BinaryWriter(binaryMs, Encoding.UTF8, leaveOpen: true))
    {
        bw.Write(42);         // sensor_id
        bw.Write(23.5);       // value
        bw.Write(true);       // alert
        bw.Write("EMEA");     // string — BinaryWriter prefixes with length byte
    }
    
    var bytes = binaryMs.ToArray();
    Console.WriteLine($"  Total bytes: {bytes.Length}");
    Console.WriteLine($"  Hex: {BitConverter.ToString(bytes)}");
    
    // Read back from the same MemoryStream
    binaryMs.Seek(0, SeekOrigin.Begin);
    var brMem = new BinaryReader(binaryMs);
    Console.WriteLine($"  Read: sensor={brMem.ReadInt32()}, value={brMem.ReadDouble():F1}, " +
                      $"alert={brMem.ReadBoolean()}, region={brMem.ReadString()}");
}

// ─────────────────────────────────────────────
// FileStream — low-level file access
// ─────────────────────────────────────────────

Console.WriteLine("\n=== FileStream (low-level byte I/O) ===");
// FileStream gives you control over: buffer size, file sharing, seek position.
// StreamReader/File.ReadAllText use FileStream internally.
// Use directly when: working with binary formats, need Seek, or need file locking.

var rawFile = Path.Combine(tmpDir, "raw_data.bin");

using (var fs = new FileStream(rawFile, FileMode.Create, FileAccess.Write))
{
    // FileMode: Create, Open, Append, CreateNew, OpenOrCreate, Truncate
    // FileAccess: Read, Write, ReadWrite
    byte[] data = { 0x01, 0x02, 0x03, 0x04, 0x05 };
    fs.Write(data);
    Console.WriteLine($"  Wrote {fs.Length} bytes");
}

using (var fs = new FileStream(rawFile, FileMode.Open, FileAccess.Read))
{
    // Seek to position 2 (skip first 2 bytes)
    fs.Seek(2, SeekOrigin.Begin);
    var buffer = new byte[3];
    int bytesRead = fs.Read(buffer, 0, buffer.Length);  // read up to 3 bytes
    Console.WriteLine($"  Read {bytesRead} bytes from offset 2: [{string.Join(", ", buffer.Select(b => $"0x{b:X2}"))}]");
}

// === Cleanup ===
Directory.Delete(tmpDir, recursive: true);
Console.WriteLine($"\n  Cleaned up: {tmpDir}");

// === C# vs Python Cheat Sheet ===
Console.WriteLine("\n=== C# vs Python File I/O & Serialization ===");
Console.WriteLine(@"
C#                                        Python
──────────────────────────────────────    ──────────────────────────────────
File.ReadAllText(path)                    Path(path).read_text()
File.WriteAllText(path, text)             Path(path).write_text(text)
File.ReadAllLines(path)                   path.read_text().splitlines()
File.AppendAllText(path, text)            open(path, 'a').write(text)
StreamReader / StreamWriter               open(path, 'r'/'w')
using (var r = new StreamReader(...))     with open(...) as f:
MemoryStream                              io.BytesIO
StringWriter / StringReader               io.StringIO
FileStream                                open(path, 'rb'/'wb')
BinaryReader / BinaryWriter               struct.pack / struct.unpack
string.Split(',')                         csv module (built-in)
System.Text.Json                          json module (built-in)
JsonSerializer.Serialize(obj)             json.dumps(obj)
JsonSerializer.Deserialize<T>(json)       json.loads(json_str)
JsonDocument / JsonElement                json.loads() → dict access
Utf8JsonWriter                            json.dumps() to stream
YamlDotNet                                yaml (pip install pyyaml)
BinaryFormatter (OBSOLETE)                pickle (Python-only)
");
```

    === .NET Stream hierarchy ===
    
    Stream (abstract base)
    ├── FileStream         — reads/writes bytes to a file on disk
    ├── MemoryStream       — reads/writes bytes in memory (no disk)
    ├── NetworkStream      — reads/writes bytes over a TCP socket
    ├── GZipStream         — compresses/decompresses bytes on the fly
    ├── CryptoStream       — encrypts/decrypts bytes on the fly
    └── BufferedStream     — adds buffering to any stream
    
    Wrappers (sit on top of a Stream):
    ├── StreamReader / StreamWriter  — text I/O (handles encoding: bytes ↔ chars)
    ├── BinaryReader / BinaryWriter  — primitive types (int, double, bool, string)
    └── Utf8JsonWriter               — JSON directly to a stream
    
    === MemoryStream (in-memory bytes) ===
      Position after write: 36
      Length: 36 bytes
      Content: PIPELINE_DATA
    etl_001|success|15000
    
    === MemoryStream → cloud upload pattern ===
      Upload payload: 73 bytes
      Preview: ﻿event_id,type,user_id
    evt_001,page_view,1001
    evt_002,purchase,1002
    
    === StringWriter / StringReader (in-memory text) ===
      StringWriter output:
      pipeline_id|status|rows
    etl_001|success|15000
    etl_002|failed|0
      StringReader line 0: pipeline_id|status|rows
      StringReader line 1: etl_001|success|15000
      StringReader line 2: etl_002|failed|0
    
    === BinaryReader / BinaryWriter ===
      Written: sensor_data.bin (39 bytes)
      Sensor 42: 23.5, alert=True
      Sensor 43: 19.8, alert=False
      Sensor 44: 31.2, alert=True
    
    === Binary in memory (MemoryStream + BinaryWriter) ===
      Total bytes: 18
      Hex: 2A-00-00-00-00-00-00-00-00-80-37-40-01-04-45-4D-45-41
      Read: sensor=42, value=23.5, alert=True, region=EMEA
    
    === FileStream (low-level byte I/O) ===
      Wrote 5 bytes
      Read 3 bytes from offset 2: [0x03, 0x04, 0x05]
    
      Cleaned up: C:\Users\aperi\AppData\Local\Temp\streams_cs_dc8d11bf
    
    === C# vs Python File I/O & Serialization ===
    
    C#                                        Python
    ──────────────────────────────────────    ──────────────────────────────────
    File.ReadAllText(path)                    Path(path).read_text()
    File.WriteAllText(path, text)             Path(path).write_text(text)
    File.ReadAllLines(path)                   path.read_text().splitlines()
    File.AppendAllText(path, text)            open(path, 'a').write(text)
    StreamReader / StreamWriter               open(path, 'r'/'w')
    using (var r = new StreamReader(...))     with open(...) as f:
    MemoryStream                              io.BytesIO
    StringWriter / StringReader               io.StringIO
    FileStream                                open(path, 'rb'/'wb')
    BinaryReader / BinaryWriter               struct.pack / struct.unpack
    string.Split(',')                         csv module (built-in)
    System.Text.Json                          json module (built-in)
    JsonSerializer.Serialize(obj)             json.dumps(obj)
    JsonSerializer.Deserialize<T>(json)       json.loads(json_str)
    JsonDocument / JsonElement                json.loads() → dict access
    Utf8JsonWriter                            json.dumps() to stream
    YamlDotNet                                yaml (pip install pyyaml)
    BinaryFormatter (OBSOLETE)                pickle (Python-only)
    
    
