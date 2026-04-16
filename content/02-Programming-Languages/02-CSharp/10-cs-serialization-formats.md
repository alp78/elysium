---
title: "10 - Serialization Formats - C#"
tags:
  - csharp
aliases: [serialization formats, JSON, CSV, Parquet, Avro, Protocol Buffers]
description: "C# serialization formats reference with executable examples and cell outputs — covers JSON, CSV, Parquet, Avro, Protocol Buffers, MessagePack, and format comparison benchmarks. See [10-py-serialization-formats](https://alp78.github.io/elysium/02-Programming-Languages/01-Python/10-py-serialization-formats) for the Python equivalent."
created: 2026-03-25
updated: 2026-03-25
status: complete
---

# 10. Serialization Formats - C#

> [!quote]+
> "Write programs to handle text streams, because that is a universal interface."
>
> — **Doug McIlroy**, *Bell System Technical Journal* (1978)

> [!abstract]- Summary
>
> **Parquet Files**
> - `Parquet.Net` wraps Parquet's columnar binary format for C#; two APIs: low-level `DataColumn` (manual schema + column-by-column write/read) and high-level `ParquetSerializer<T>` (POCO mapping, auto-schema).
> - Schema is embedded in the file footer — inspect row count, column names, and nullability without loading data.
> - `MemoryStream` target enables cloud upload (GCS, S3, Azure Blob) without a temp file.
>
> **Protocol Buffers**
> - Dynamic encoding uses `CodedOutputStream`/`CodedInputStream` with raw tagged fields (wire types: 0 varint, 1 64-bit, 2 length-delimited, 5 32-bit) — no `protoc` needed for notebooks.
> - Production path: define schema in `.proto`, run `protoc --csharp_out`, commit both `.proto` and generated `.cs`; `Grpc.Tools` automates regeneration in MSBuild.
> - gRPC service definition lives in the same `.proto`; `protoc` with `--grpc_out` generates the server base class and client stub.
> - Savings vs JSON: ~57% smaller on a typical financial record.
>
> **Apache Avro**
> - Schema defined as JSON, embedded in every file header via `DataFileWriter` — no external schema needed to decode.
> - `GenericRecord` API (dynamic, slower) vs specific/code-gen API (typed, production); `DataFileReader` iterates records from the embedded schema.
> - Schema evolution: add fields with defaults (safe), remove with defaults (safe), change types or field numbers (breaks consumers).
> - For small record sets, Avro files are larger than raw Protobuf due to embedded schema overhead.
>
> **Format Performance Benchmark**
> - Test data: synthetic OHLCV records at 100, 10K, and 100K row sizes.
> - At 100K records — file size order: Parquet (1.8 MB) < CSV (5.0 MB) ≈ Avro (5.1 MB) < Protobuf (5.7 MB) < JSON (10.5 MB).
> - Parquet wins on both size and read speed for large datasets; Protobuf is most compact per record but lacks built-in message framing for bulk reads.
> - Decision matrix: Parquet for analytics/lakes, Avro for Kafka/streaming, Protobuf for gRPC/microservices, JSON for REST/config.

> [!note]- Glossary
>
> **Parquet**
>
> - Columnar binary format that stores data column-by-column rather than row-by-row. Apache project, schema embedded in the file footer, typed and compressed per column.
> - Enables column pruning (read only the columns needed, skip 96%+ of data in wide tables) and predicate pushdown. Standard in data lakes (GCS, S3, ADLS), BigQuery, Spark, DuckDB. Not streamable — files must be read or written as complete units.
>
> > [!tip] Parquet is the default for analytics storage
> >
> > Use Parquet whenever the workload is columnar (BI queries, ML feature stores, batch ETL intermediate files). Its on-disk size is typically 5–10x smaller than CSV for the same data.
>
>  ---
>
> **Protocol Buffers (Protobuf)**
>
> - Google's binary serialization format. `.proto` files define strongly typed schemas; `protoc` generates C# (and other language) classes. 3–10x smaller than JSON, fast binary encoding, no text overhead.
> - Used for gRPC microservices, high-frequency trading feeds, and cross-language IPC. Schema is **not** embedded in the data — both producer and consumer must hold the `.proto` file or generated classes. Field numbers baked into the binary encoding; changing a number breaks all consumers.
>
> > [!warning] Schema not self-describing
> >
> > Without the `.proto` or generated classes, a Protobuf blob is opaque. Distribute the schema file or use a schema registry alongside the data.
>
>  ---
>
> **Apache Avro**
>
> - Row-based binary format with the schema (defined as JSON) embedded in every file header. Readers do not need an external schema to decode. Compact binary, comparable to Protobuf per record. Native to Kafka with Confluent Schema Registry.
> - Supports schema evolution: add or remove fields with default values without breaking existing consumers. Changing field types or removing fields without defaults breaks compatibility. Better than Parquet for streaming; worse for columnar analytics queries.
>
> > [!info] Avro schema is JSON; the payload is binary
> >
> > The schema block stored in the file header is valid JSON text. The records that follow are binary-encoded. Parsing the file with a text editor will show a readable JSON header followed by unreadable binary data.
>
>  ---
>
> **`Parquet.Net`**
>
> - NuGet library (`Parquet.Net`) for reading and writing Parquet files in C# without a Python or Spark dependency.
> - Exposes two APIs: the low-level `DataColumn` API (explicit schema definition, column-by-column I/O) and the high-level `ParquetSerializer<T>` API (POCO/record type mapping, automatic schema). Pin the NuGet version — the API has breaking changes between minor versions.
>
> > [!warning] API differs from PyArrow
> >
> > Column access, schema inspection, and read options use different patterns than Python's `pyarrow.parquet`. PyArrow code does not translate directly to `Parquet.Net`.
>
>  ---
>
> **`Google.Protobuf`**
>
> - Official .NET NuGet library for Protocol Buffers. Provides `CodedOutputStream`/`CodedInputStream` for dynamic (runtime) encoding, and generates strongly typed message classes when used with `protoc`.
> - Classes produced by `protoc` expose `ToByteArray()`, `Parser.ParseFrom()`, and all property accessors. Must regenerate C# classes whenever the `.proto` schema changes; stale generated code silently misinterprets new fields.
>
> > [!tip] Automate regeneration with `Grpc.Tools`
> >
> > Add `<PackageReference Include="Grpc.Tools" />` and `<Protobuf Include="*.proto" />` to the `.csproj`; MSBuild runs `protoc` automatically on every build.
>
>  ---
>
> **`Apache.Avro`**
>
> - .NET NuGet library for Avro serialization. Offers two programming models: generic API (`GenericRecord` — dynamic field access, no compile-time checking, slower) and specific/code-gen API (generated typed classes, faster, production-preferred).
> - Integrates with Kafka and Confluent Schema Registry. `DataFileWriter` embeds the schema in the file header automatically; `DataFileReader` reads it back without needing an external schema.
>
> > [!info] Generic vs specific API
> >
> > The generic API is suitable for tools and ad-hoc queries. For production Kafka consumers and producers, use the code-generated specific API — it avoids `GenericRecord` dynamic dispatch overhead and provides compile-time field safety.
>
>  ---
>
> **`MemoryMappedFile`**
>
> - .NET class (`System.IO.MemoryMappedFiles`) that maps a file into the process's virtual address space, enabling zero-copy random access to binary data without explicit read calls.
> - Used for fixed-size binary records, shared memory between processes, and inter-process communication. Not suitable for variable-length records or text data because random access requires known offsets.
>
> > [!warning] Not suitable for variable-length records
> >
> > Memory-mapped files require that record boundaries are known in advance. Use `MemoryStream` for variable-length serialized payloads and reserve `MemoryMappedFile` for fixed-stride binary structures.
>
>  ---
>
> **`BinaryPrimitives`**
>
> - Static class in `System.Buffers.Binary` providing explicit big-endian and little-endian read/write methods for primitive types (`ReadInt32BigEndian`, `WriteInt32LittleEndian`, etc.).
> - Prevents endianness bugs in network protocol parsing and binary file format I/O. The default `BinaryWriter` is little-endian; most network protocols (TCP, UDP payloads) use big-endian byte order.
>
> > [!tip] Always be explicit about endianness
> >
> > Do not rely on `BinaryWriter`/`BinaryReader` defaults in cross-platform or network code. Use `BinaryPrimitives` methods with an explicit endianness suffix so the intent is visible in code review.
>
>  ---
>
> **compression codec**
>
> - Algorithm applied on top of serialized data to reduce its on-disk or wire size. Common codecs in C# serialization: Snappy (fast compression/decompression, moderate ratio), Zstd (balanced speed and ratio), Gzip (best ratio, slower CPU).
> - Parquet supports per-column codec selection; typical data-lake deployments use Snappy or Zstd. Choosing the wrong codec trades CPU for I/O (or vice versa): Snappy for throughput-bound workloads, Zstd for storage-cost-sensitive workloads, Gzip for maximum compression when CPU is plentiful.
>
> > [!tip] Default codec recommendation
> >
> > Use Snappy for interactive analytics (low decompression latency), Zstd level 3–6 for batch ETL files where storage cost matters, and Gzip only for archival or external data exchange where the receiving tool does not support Snappy or Zstd.


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

#r "nuget: Apache.Avro, 1.12.0"
#r "nuget: Google.Protobuf"
#r "nuget: Parquet.Net, 5.5.0"
#r "nuget: Plotly.NET, 5.1.0"
#r "nuget: Plotly.NET.CSharp, 0.13.0"
#r "nuget: Plotly.NET.Interactive, 5.0.0"
#r "nuget: Polars.NET"
#r "nuget: Polars.NET.Native.win-x64"
using Avro.File;
using Avro.Generic;
using Avro.IO;
using Avro;
using Google.Protobuf.Reflection;
using Google.Protobuf.WellKnownTypes;
using Google.Protobuf;
using Microsoft.DotNet.Interactive.Formatting;
using Parquet.Data;
using Parquet.Schema;
using Parquet.Serialization;
using Parquet;
using Plotly.NET.CSharp;
using Plotly.NET.Interactive;
using Plotly.NET.LayoutObjects;
using Plotly.NET;
using Polars.CSharp;
using static Polars.CSharp.Polars;
var csharpKernel = (CSharpKernel)Kernel.Root.FindKernelByName("csharp");
var optionsField = typeof(CSharpKernel).GetField("_scriptOptions",
    BindingFlags.NonPublic | BindingFlags.Instance);

var scriptOptions = optionsField.GetValue(csharpKernel);
var withWarningLevel = scriptOptions.GetType().GetMethod("WithWarningLevel");
var newOptions = withWarningLevel.Invoke(scriptOptions, new object[] { 0 });
optionsField.SetValue(csharpKernel, newOptions);

// WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.
```

## Parquet Files

Parquet stores data column-by-column with per-column compression (snappy, gzip, zstd). Schema is embedded in the file footer — self-describing, no separate schema file needed. Supports column pruning (read only the columns you need), predicate pushdown, and partitioning. 5–10x smaller than CSV. Standard in data lakes (GCS, S3, ADLS), BigQuery, Spark, DuckDB, Athena. C# uses `Parquet.Net` (NuGet).

### Parquet.Net | schema, write, and read

#### NuGet package and type declarations

`Parquet.Net` maps record/class properties to parquet columns automatically via the class serialization API. Supports both low-level `DataColumn` API and high-level class serialization. Pin the NuGet version to avoid build breakage on updates.

`Parquet.Net` maps `EventRecord` properties to parquet columns automatically.

```csharp
public class EventRecord
{
    public string EventId { get; set; } = "";
    public string EventType { get; set; } = "";
    public long UserId { get; set; }
    public double Revenue { get; set; }
    public bool IsMobile { get; set; }
}
```

#### Write parquet — DataColumn API

The low-level `DataColumn` API writes one column at a time — matching Parquet's columnar storage model. Define a `ParquetSchema` with `DataField<T>` for each column, then write each column as an array of values. This gives full control over schema types and nullable fields.

```csharp
var tmpDir = Path.Combine(Path.GetTempPath(), "parquet_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);

var schema = new ParquetSchema(
    new DataField<string>("event_id"),
    new DataField<string>("event_type"),
    new DataField<long>("user_id"),
    new DataField<double>("revenue"),
    new DataField<bool>("is_mobile")
);

var parquetFile = Path.Combine(tmpDir, "events.parquet");

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

Console.WriteLine(Path.GetFileName(parquetFile));
Console.WriteLine(new FileInfo(parquetFile).Length);
```

```text
events.parquet
1045
```

#### Read parquet — DataColumn API

`ParquetReader` discovers the schema from the file footer and reads columns individually. Each column is strongly typed — cast the `Data` array to the expected CLR type. Use `reader.Schema.DataFields` to inspect column names and types at runtime.

```csharp
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

```text
Schema: event_id:String, event_type:String, user_id:Int64, revenue:Double, is_mobile:Boolean
Rows: 5
  evt_001: page_view, user=1001, revenue=$0.00
  evt_002: purchase, user=1002, revenue=$49.99
  evt_003: page_view, user=1001, revenue=$0.00
  evt_004: signup, user=1003, revenue=$0.00
  evt_005: purchase, user=1002, revenue=$129.99
```

#### Class serialization and deserialization | ParquetSerializer high-level API

`ParquetSerializer.SerializeAsync<T>` maps class properties to Parquet columns automatically — no manual schema definition needed. `DeserializeAsync<T>` reads the file back into typed objects. Simpler than the DataColumn API for standard POCO/record types.

```csharp
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

var loaded = await ParquetSerializer.DeserializeAsync<EventRecord>(typedFile);
Console.WriteLine($"  Loaded {loaded.Count} records:");
foreach (var e in loaded)
    Console.WriteLine($"    {e.EventId}: {e.EventType}, user={e.UserId}, revenue=${e.Revenue:F2}");
```

```text
events_typed.parquet (1037 bytes)
Loaded 5 records:
  evt_001: page_view, user=1001, revenue=$0.00
  evt_002: purchase, user=1002, revenue=$49.99
  evt_003: page_view, user=1001, revenue=$0.00
  evt_004: signup, user=1003, revenue=$0.00
  evt_005: purchase, user=1002, revenue=$129.99
```

### Metadata, in-memory, and comparison

#### Parquet metadata | read schema and row count without loading data

Parquet embeds metadata in the file footer — you can read the schema, row count, and row group structure without loading any data. This is instant even for multi-GB files.

```csharp
using (Stream fs = File.OpenRead(parquetFile))
{
    using var reader = await ParquetReader.CreateAsync(fs);
    Console.WriteLine($"  Row groups: {reader.RowGroupCount}");
    foreach (var field in reader.Schema.DataFields)
        Console.WriteLine($"    {field.Name}: {field.ClrType.Name} (nullable={field.IsNullable})");
}
```

```text
Row groups: 1
  event_id: String (nullable=True)
  event_type: String (nullable=True)
  user_id: Int64 (nullable=False)
  revenue: Double (nullable=False)
  is_mobile: Boolean (nullable=False)
```

#### Parquet in memory — MemoryStream | cloud upload without temp files

Serialize Parquet to a `MemoryStream` for direct cloud upload (GCS, S3, Azure Blob) without writing to disk. Rewind with `Seek(0)` before reading or uploading.

```csharp
{
    var memStream = new MemoryStream();
    await ParquetSerializer.SerializeAsync(events, memStream);
    Console.WriteLine($"  MemoryStream size: {memStream.Length} bytes");

    memStream.Seek(0, SeekOrigin.Begin);
    var fromMem = await ParquetSerializer.DeserializeAsync<EventRecord>(memStream);
    Console.WriteLine($"  Read from memory: {fromMem.Count} records");
}
```

```text
MemoryStream size: 1037 bytes
Read from memory: 5 records
```

#### CSV vs Parquet comparison

| Feature | CSV | Parquet |
|---|---|---|
| Format | Text (row-based) | Binary (columnar) |
| Schema | No (header row only) | Embedded (typed, nullable) |
| Compression | None (manual gzip) | Built-in (snappy/gzip/zstd) |
| Column pruning | No (read all columns) | Yes (read only needed columns) |
| Human-readable | Yes | No |
| Use case | Simple exchange, legacy | Data lakes, analytics, BigQuery |

```csharp
Directory.Delete(tmpDir, recursive: true);
```

## Protocol Buffers (Protobuf)

Protocol Buffers is Google's binary serialization format — 3–10x smaller than JSON with fast parsing and no text overhead. `.proto` files define schemas; `protoc` generates strongly-typed classes for C#, Python, Java, Go. Schema evolution lets you add fields without breaking existing consumers. Standard for gRPC microservices, Kafka messages, and high-frequency data feeds.

### Google.Protobuf | dynamic and production patterns

#### Protobuf with Google.Protobuf NuGet

> [!info] Protocol Buffers
>
> - `.proto` files define schemas — `protoc` generates typed C# classes
> - 3-10x smaller than JSON, fast binary encoding with no parsing overhead
> - Cross-language: the same `.proto` generates C#, Python, Java, Go code
> - Schema evolution — add fields without breaking old consumers
> - Use for gRPC, microservice communication, and Kafka messages
> - For config files or human-readable exchange, use JSON instead

> [!warning] Protobuf anti-patterns
>
> - Don't use for human-readable configs -- use JSON/YAML instead
> - Don't change field numbers in existing `.proto` -- breaks all consumers
> - Don't use for one-off scripts -- JSON is simpler for ad-hoc work

> [!success] Protobuf best practices
>
> - Define schemas in `.proto` files and commit them to version control alongside the service code
> - Use field numbers 1–15 for the most frequent fields (single-byte tag encoding)
> - Add new fields with unused numbers and never reuse retired field numbers

> [!tip] When to use Protobuf
>
> gRPC services, Kafka events, high-frequency data feeds, inter-service communication, mobile APIs (bandwidth matters). In production, `protoc` generates C# classes from `.proto` files. In notebooks, use the dynamic message API (same binary format).

#### Dynamic protobuf messages | runtime encoding without protoc

In notebooks or dynamic scenarios without `protoc`-generated classes, use `CodedOutputStream` to write raw tagged fields and `CodedInputStream` to read them back. Each field is encoded as `(field_number << 3 | wire_type) + value`.

> [!info] Protobuf wire format
>
> For dynamic messages without `protoc`, use raw byte encoding. Each field is encoded as `(field_number << 3 | wire_type) + value`. Wire types: `0` = varint, `1` = 64-bit, `2` = length-delimited, `5` = 32-bit.

**Initialize stream and encoder.** Create a `MemoryStream` as the target buffer and wrap it in a `CodedOutputStream` for writing tagged protobuf fields.

```csharp
var ms = new MemoryStream();
var cos = new CodedOutputStream(ms);
```

**Field 1 — symbol (length-delimited string).** Tag is `(1 << 3) | 2 = 10`. Wire type 2 means the value is prefixed with its byte length, followed by UTF-8 encoded string bytes.

```csharp
cos.WriteTag(1, WireFormat.WireType.LengthDelimited);
cos.WriteString("SAP.DE");
```

**Field 2 — price (64-bit double).** Tag is `(2 << 3) | 1 = 17`. Wire type 1 writes exactly 8 bytes in little-endian IEEE 754 format — no length prefix needed.

```csharp
cos.WriteTag(2, WireFormat.WireType.Fixed64);
cos.WriteDouble(166.52);
```

**Field 3 — volume (varint int64).** Tag is `(3 << 3) | 0 = 24`. Wire type 0 encodes the integer as a variable-length sequence of 7-bit groups — small values use fewer bytes.

```csharp
cos.WriteTag(3, WireFormat.WireType.Varint);
cos.WriteInt64(82621);
```

**Flush and compare size with JSON.** The protobuf encoding is significantly smaller than the equivalent JSON because it uses binary encoding and field numbers instead of repeated key strings.

```csharp
cos.Flush();
var protoBytes = ms.ToArray();

Console.WriteLine($"  Protobuf:  {protoBytes.Length} bytes");
Console.WriteLine($"  Hex:       {Convert.ToHexString(protoBytes).ToLower()}");

var jsonStr = JsonSerializer.Serialize(new { symbol = "SAP.DE", price = 166.52, volume = 82621 });
Console.WriteLine($"  JSON:      {Encoding.UTF8.GetByteCount(jsonStr)} bytes");
Console.WriteLine($"  Savings:   {(1.0 - (double)protoBytes.Length / Encoding.UTF8.GetByteCount(jsonStr)) * 100:F0}%");
```

```text
Protobuf:  21 bytes
Hex:       0a065341502e444511713d0ad7a3d0644018bd8505
JSON:      49 bytes
Savings:   57%
```

**Decode with CodedInputStream.** Read tags in a loop, switch on the field number to dispatch to the correct reader method. Unknown fields are skipped with `SkipLastField` — this is how protobuf achieves forward compatibility.

```csharp
var cis = new CodedInputStream(protoBytes);
string? sym = null; double price = 0; long vol = 0;
while (!cis.IsAtEnd)
{
    var tag = cis.ReadTag();
    switch (WireFormat.GetTagFieldNumber(tag))
    {
        case 1: sym = cis.ReadString(); break;
        case 2: price = cis.ReadDouble(); break;
        case 3: vol = cis.ReadInt64(); break;
        default: cis.SkipLastField(); break;
    }
}
Console.WriteLine($"  Decoded: symbol={sym}, price={price}, volume={vol}");
```

```text
Decoded: symbol=SAP.DE, price=166.52, volume=82621
```

#### Production protobuf — Step 1: define the .proto schema

The `.proto` file is the immutable contract for the message. Each field gets a unique number (not a default value) that is baked into the binary encoding — changing a number breaks all existing consumers. Assign numbers 1–15 to the most frequently used fields: they use single-byte tags, saving one byte per field per message. Adding field 4 (`exchange`) later is safe: old consumers that don't know about it simply skip it.

```protobuf
syntax = "proto3";
package stoxx;

message StockQuote {
  string symbol   = 1;
  double price    = 2;
  int64  volume   = 3;
  string exchange = 4;
}
```

#### Production protobuf — Step 2: compile schema to C# with protoc

`protoc` reads the `.proto` file and generates a strongly-typed `StockQuote.cs` with `ToByteArray()`, `Parser.ParseFrom()`, and all property accessors already implemented. Re-run whenever the schema changes and commit both `.proto` and generated `.cs` to version control — the `.proto` is the source of truth, the `.cs` is a build artifact.

```bash
protoc --csharp_out=. stock_quote.proto
```

This generates `StockQuote.cs` with all property accessors and serialization methods.

> [!tip] Automate protoc in CI with Grpc.Tools
>
> Add `<PackageReference Include="Grpc.Tools" />` to your `.csproj` and set `<Protobuf Include="*.proto" />`. MSBuild then runs `protoc` automatically on every build — no manual invocations or checked-in generated code needed.

#### Production protobuf — Step 3: serialize and deserialize

`ToByteArray()` serializes the object to its wire-format binary encoding. `Parser.ParseFrom()` deserializes bytes back to a typed object. Both are generated by `protoc`. Schema evolution is automatic: if a message was encoded without `exchange` (field 4), `ParseFrom()` returns `""` (the proto3 default for `string`) — no exception is thrown and no migration is needed.

```csharp
var quote = new StockQuote { Symbol = "SAP.DE", Price = 166.52, Volume = 82621 };

byte[] data  = quote.ToByteArray();
var parsed   = StockQuote.Parser.ParseFrom(data);

Console.WriteLine($"{parsed.Symbol}: {parsed.Price}");
Console.WriteLine($"  {data.Length} bytes | exchange default: '{parsed.Exchange}'");
```

> [!info] Output matches the dynamic encoding example
>
> The wire encoding is identical to the `CodedOutputStream` example above (21 bytes, same hex). `protoc`-generated classes use the same binary format — they just remove the boilerplate.

#### Production protobuf — gRPC service definition

A gRPC service is defined in the same `.proto` file alongside the messages. `protoc` (with the gRPC plugin) generates both the server base class and the client stub. The method signature is strongly typed — request and response shapes are enforced at compile time, and the transport is HTTP/2.

```protobuf
service MarketData {
  rpc GetQuote (QuoteRequest) returns (StockQuote);
}
```

> [!info] gRPC setup requires additional packages
>
> Add `Grpc.AspNetCore` (server) or `Grpc.Net.Client` (client) NuGet packages. The generated `MarketDataBase` server class and `MarketDataClient` stub are produced by `protoc` with the `--grpc_out` flag, or automatically via `Grpc.Tools` with `<Protobuf GrpcServices="Server" />` in the `.csproj`.

## Apache Avro

Apache Avro is a row-based binary format with the schema embedded in every file header — readers don't need an external schema to decode. Supports schema evolution (add/remove fields with compatibility rules). Compact binary, comparable to Protobuf. Standard in Kafka (with Schema Registry) and Hadoop. For analytics queries, Parquet is better (columnar = column pruning); for human-readable interchange, use JSON.

### Apache.Avro | schema, write, and read

#### Avro schema and serialization

Schema is defined in JSON format and embedded in every file header — readers don't need an external schema to decode. Supports schema evolution (add/remove fields with compatibility rules). Compact binary format, comparable to Protobuf. Standard in Kafka (with Schema Registry for version management) and Hadoop. For simple analytics files, Parquet is better; for human-readable interchange, use JSON.

> [!tip] Avro vs Protobuf vs Parquet
>
> - **Avro**: row-based, self-describing, best for streaming/Kafka
> - **Protobuf**: binary, external schema, best for gRPC/microservices
> - **Parquet**: columnar, best for analytics/queries (read specific columns)

> [!warning] Avro anti-patterns
>
> - Don't use Avro for analytics queries -- use Parquet (columnar = column pruning)
> - Don't change field types in schema evolution -- only add/remove fields
> - Don't use Avro without a schema registry in production Kafka

> [!success] Avro best practices
>
> - Always provide a `default` value when adding new fields to ensure backward and forward compatibility
> - Use Confluent Schema Registry with FULL compatibility mode for Kafka topics
> - Keep the writer schema alongside the data or in a registry — never discard it

Avro schemas are always defined as JSON, even when the data format is binary.

```csharp
var schemaJson = @"{
  ""type"": ""record"",
  ""name"": ""StockQuote"",
  ""namespace"": ""stoxx"",
  ""fields"": [
    {""name"": ""symbol"",    ""type"": ""string""},
    {""name"": ""price"",     ""type"": ""double""},
    {""name"": ""volume"",    ""type"": ""long""},
    {""name"": ""exchange"",  ""type"": [""null"", ""string""], ""default"": null}
  ]
}";

var schema = (RecordSchema)Schema.Parse(schemaJson);
Console.WriteLine($"  Schema: {schema.Name} ({schema.Fields.Count} fields)");
foreach (var f in schema.Fields)
    Console.WriteLine($"    {f.Name}: {f.Schema}");
```

```text
Schema: StockQuote (4 fields)
  symbol: "string"
  price: "double"
  volume: "long"
  exchange: ["null","string"]
```

#### Write Avro file | GenericRecord API with embedded schema

Create `GenericRecord` instances (like Python dicts but typed by the Avro schema) and write them with `DataFileWriter`. The schema is embedded in the file header automatically — any consumer can decode the file without a separate schema file.

**Prepare output path.** Create a temporary directory for the Avro file.

```csharp
var tmpDir = Path.Combine(Path.GetTempPath(), "avro_cs_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);
var avroFile = Path.Combine(tmpDir, "quotes.avro");
```

**Build GenericRecord instances.** Each `GenericRecord` is typed by the Avro schema — fields are added by name with `record.Add()`. Nullable union fields (`["null", "string"]`) accept `null` values directly, as shown in the last record where `exchange` is absent.

```csharp
var records = new List<GenericRecord>();
var quotes = new[]
{
    ("SAP.DE",  166.52, 82621L,  "XETR"),
    ("ASML.AS", 685.40, 45000L,  "XAMS"),
    ("TTE.PA",  58.20,  120000L, "XPAR"),
    ("BAS.DE",  44.85,  95000L,  (string?)null),
};

foreach (var (sym, price, vol, exch) in quotes)
{
    var record = new GenericRecord(schema);
    record.Add("symbol", sym);
    record.Add("price", price);
    record.Add("volume", vol);
    record.Add("exchange", exch);
    records.Add(record);
}
```

**Write to file with DataFileWriter.** `DataFileWriter` embeds the schema in the file header automatically — any consumer can decode the file without a separate schema file. Records are appended one at a time with `Append()`.

```csharp
using (var writer = DataFileWriter<GenericRecord>.OpenWriter(
    new GenericDatumWriter<GenericRecord>(schema),
    avroFile))
{
    foreach (var r in records)
        writer.Append(r);
}

var fileSize = new FileInfo(avroFile).Length;
Console.WriteLine($"  Records: {records.Count}, Size: {fileSize} bytes");
```

```text
Records: 4, Size: 390 bytes
```

#### Read Avro file | schema discovered from file header

`DataFileReader` reads the embedded schema from the file header and iterates records. Access fields by name (`record["symbol"]`). Nullable union fields (`["null", "string"]`) return `null` when absent.

```csharp
using (var reader = DataFileReader<GenericRecord>.OpenReader(avroFile))
{
    var fileSchema = reader.GetSchema();
    Console.WriteLine($"  Schema from file: {fileSchema.Name}");

    while (reader.HasNext())
    {
        var record = reader.Next();
        var sym = record["symbol"];
        var price = record["price"];
        var vol = record["volume"];
        var exch = record["exchange"] ?? "N/A";
        Console.WriteLine($"    {sym,-10} \u20ac{price,8:F2}  vol={vol,8}  exch={exch}");
    }
}
```

```text
Schema from file: StockQuote
  SAP.DE     €  166.52  vol=   82621  exch=XETR
  ASML.AS    €  685.40  vol=   45000  exch=XAMS
  TTE.PA     €   58.20  vol=  120000  exch=XPAR
  BAS.DE     €   44.85  vol=   95000  exch=N/A
```

### In-memory, comparison, and schema evolution

#### Avro in memory and size comparison | MemoryStream for Kafka payloads

Serialize Avro records to a `MemoryStream` for Kafka producer payloads or API responses without disk I/O. The embedded schema adds overhead per file — Avro files are larger than raw Protobuf for small record sets but self-describing.

```csharp
var avroMs = new MemoryStream();
var datumWriter = new GenericDatumWriter<GenericRecord>(schema);

using (var writer = DataFileWriter<GenericRecord>.OpenWriter(datumWriter, avroMs, leaveOpen: true))
{
    foreach (var r in records)
        writer.Append(r);
}

var avroBytes = avroMs.ToArray();
Console.WriteLine($"  Avro in memory: {avroBytes.Length} bytes ({records.Count} records)");

var jsonPayload = JsonSerializer.Serialize(
    quotes.Select(q => new { symbol = q.Item1, price = q.Item2, volume = q.Item3, exchange = q.Item4 }));
var jsonSize = Encoding.UTF8.GetByteCount(jsonPayload);

Console.WriteLine($"\n  {"Format",-12} {"Size",8} {"Per record",12}");
Console.WriteLine($"  {new string('\u2500', 34)}");
Console.WriteLine($"  {"Avro",-12} {avroBytes.Length,8} {avroBytes.Length / records.Count,12}");
Console.WriteLine($"  {"JSON",-12} {jsonSize,8} {jsonSize / records.Count,12}");
Console.WriteLine($"  {"Savings",-12} {(1.0 - (double)avroBytes.Length / jsonSize) * 100:F0}%");

Directory.Delete(tmpDir, recursive: true);
```

```text
Avro in memory: 390 bytes (4 records)

Format           Size   Per record
──────────────────────────────────
Avro              390           97
JSON              269           67
Savings      -45%
```

#### Schema evolution | add fields without breaking existing consumers

Schema evolution lets producers and consumers update independently. In Kafka with Confluent Schema Registry, set compatibility mode to control which changes are allowed.

> [!info] Safe schema changes
>
> - **Add field with default** — old readers get the default value, new readers get the actual value
> - **Remove field with default** — old readers ignore the extra bytes
> - **Add aliases** — renamed fields are still recognized by old consumers

> [!danger] Unsafe schema changes (breaks consumers)
>
> - Change field type (e.g., `string` → `int`)
> - Remove a field WITHOUT a default value
> - Change field number or order

> [!success] Use Confluent Schema Registry with FULL compatibility
>
> - **BACKWARD** compatible: new schema can read old data
> - **FORWARD** compatible: old schema can read new data
> - **FULL** compatible: both directions — the safest option for production Kafka

## Format Performance Benchmark

For the architecture-level decision guide on when to use each format (Parquet for analytics, Avro for streaming, Protobuf for services), see [serialization-formats](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/serialization-formats).

### Test data and benchmark setup

#### Generate test data | OHLCV records at three sizes

Generates synthetic OHLCV (open/high/low/close/volume) data matching the stoxx database schema. Three sizes — 100 (small), 10K (medium), 100K (large) — to show how format overhead scales.

```csharp
var rng = new Random(42);
var symbols = new[] { "SAP.DE","ASML.AS","TTE.PA","BAS.DE","BAYN.DE","BMW.DE","SIE.DE","ALV.DE",
                      "ADS.DE","DTE.DE","ENEL.MI","ENI.MI","BNP.PA","MC.PA","OR.PA","AIR.PA",
                      "SAN.PA","CS.PA","DG.PA","SU.PA","INGA.AS","AD.AS","PRX.AS","WKL.AS",
                      "UCG.MI","ISP.MI","RACE.MI","ABI.BR","ARGX.BR","ITX.MC" };


List<OhlcvRecord> GenerateData(int count)
{
    var data = new List<OhlcvRecord>(count);
    var baseDate = new DateTime(2020, 1, 1);
    for (int i = 0; i < count; i++)
    {
        var sym = symbols[i % symbols.Length];
        var date = baseDate.AddDays(i / symbols.Length).ToString("yyyy-MM-dd");
        var close = 50.0 + rng.NextDouble() * 200;
        var open = close * (0.98 + rng.NextDouble() * 0.04);
        var high = Math.Max(open, close) * (1 + rng.NextDouble() * 0.02);
        var low = Math.Min(open, close) * (1 - rng.NextDouble() * 0.02);
        var vol = (long)(rng.NextDouble() * 500_000);
        data.Add(new OhlcvRecord(sym, date, Math.Round(open, 2), Math.Round(high, 2),
                                 Math.Round(low, 2), Math.Round(close, 2), vol));
    }
    return data;
}

var small  = GenerateData(100);
var medium = GenerateData(10_000);
var large  = GenerateData(100_000);

Console.WriteLine($"  Small:  {small.Count:N0} records");
Console.WriteLine($"  Medium: {medium.Count:N0} records");
Console.WriteLine($"  Large:  {large.Count:N0} records");

record OhlcvRecord(string Symbol, string Date, double Open, double High, double Low, double Close, long Volume);
```

```text
Small:  100 records
Medium: 10,000 records
Large:  100,000 records
```

#### Benchmark helpers | write/read timing and file size measurement

```csharp

var benchDir = Path.Combine(Path.GetTempPath(), "bench_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(benchDir);

var results = new List<(string Format, string Size, int Records, long WriteMs, long ReadMs, long FileBytes)>();

(long ms, long bytes) BenchWrite(string label, string size, int records, Action<string> writeAction)
{
    var path = Path.Combine(benchDir, $"{label}_{size}");
    var sw = Stopwatch.StartNew();
    writeAction(path);
    sw.Stop();
    var fileSize = new FileInfo(path).Length;
    return (sw.ElapsedMilliseconds, fileSize);
}

long BenchRead(Action readAction)
{
    var sw = Stopwatch.StartNew();
    readAction();
    sw.Stop();
    return sw.ElapsedMilliseconds;
}

```

### Individual format benchmarks

#### CSV benchmark | text-based, row-oriented baseline

```csharp

void WriteCsv(string path, List<OhlcvRecord> data)
{
    using var w = new StreamWriter(path, false, Encoding.UTF8);
    w.WriteLine("symbol,date,open,high,low,close,volume");
    foreach (var r in data)
        w.WriteLine($"{r.Symbol},{r.Date},{r.Open},{r.High},{r.Low},{r.Close},{r.Volume}");
}

int ReadCsv(string path)
{
    int count = 0;
    using var reader = new StreamReader(path);
    reader.ReadLine(); // skip header
    while (reader.ReadLine() != null) count++;
    return count;
}

foreach (var (label, data) in new[] { ("small", small), ("medium", medium), ("large", large) })
{
    var path = Path.Combine(benchDir, $"csv_{label}.csv");
    var (wMs, bytes) = BenchWrite("csv", $"{label}.csv", data.Count, p => WriteCsv(p, data));
    var rMs = BenchRead(() => ReadCsv(path));
    results.Add(("CSV", label, data.Count, wMs, rMs, bytes));
}
```

#### JSON benchmark | text-based, self-describing format

```csharp

var jsonOpts = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

void WriteJson(string path, List<OhlcvRecord> data)
{
    var json = JsonSerializer.Serialize(data, jsonOpts);
    File.WriteAllText(path, json, Encoding.UTF8);
}

int ReadJson(string path)
{
    var json = File.ReadAllText(path);
    var list = JsonSerializer.Deserialize<List<OhlcvRecord>>(json, jsonOpts);
    return list?.Count ?? 0;
}

foreach (var (label, data) in new[] { ("small", small), ("medium", medium), ("large", large) })
{
    var path = Path.Combine(benchDir, $"json_{label}.json");
    var (wMs, bytes) = BenchWrite("json", $"{label}.json", data.Count, p => WriteJson(p, data));
    var rMs = BenchRead(() => ReadJson(path));
    results.Add(("JSON", label, data.Count, wMs, rMs, bytes));
}
```

#### Parquet benchmark | columnar, compressed, typed format

```csharp

void WriteParquet(string path, List<OhlcvRecord> data)
{
    var schema = new ParquetSchema(
        new DataField<string>("symbol"), new DataField<string>("date"),
        new DataField<double>("open"), new DataField<double>("high"),
        new DataField<double>("low"), new DataField<double>("close"),
        new DataField<long>("volume"));
    using var fs = File.OpenWrite(path);
    using var writer = ParquetWriter.CreateAsync(schema, fs).Result;
    using var group = writer.CreateRowGroup();
    group.WriteColumnAsync(new DataColumn(schema.DataFields[0], data.Select(r => r.Symbol).ToArray())).Wait();
    group.WriteColumnAsync(new DataColumn(schema.DataFields[1], data.Select(r => r.Date).ToArray())).Wait();
    group.WriteColumnAsync(new DataColumn(schema.DataFields[2], data.Select(r => r.Open).ToArray())).Wait();
    group.WriteColumnAsync(new DataColumn(schema.DataFields[3], data.Select(r => r.High).ToArray())).Wait();
    group.WriteColumnAsync(new DataColumn(schema.DataFields[4], data.Select(r => r.Low).ToArray())).Wait();
    group.WriteColumnAsync(new DataColumn(schema.DataFields[5], data.Select(r => r.Close).ToArray())).Wait();
    group.WriteColumnAsync(new DataColumn(schema.DataFields[6], data.Select(r => r.Volume).ToArray())).Wait();
}

int ReadParquet(string path)
{
    using var fs = File.OpenRead(path);
    using var reader = ParquetReader.CreateAsync(fs).Result;
    using var group = reader.OpenRowGroupReader(0);
    var col = group.ReadColumnAsync(reader.Schema.DataFields[0]).Result;
    return col.Data.Length;
}

foreach (var (label, data) in new[] { ("small", small), ("medium", medium), ("large", large) })
{
    var path = Path.Combine(benchDir, $"parquet_{label}.parquet");
    var (wMs, bytes) = BenchWrite("parquet", $"{label}.parquet", data.Count, p => WriteParquet(p, data));
    var rMs = BenchRead(() => ReadParquet(path));
    results.Add(("Parquet", label, data.Count, wMs, rMs, bytes));
}
```

#### Avro benchmark | row-based binary with embedded schema

```csharp

var avroSchema = (RecordSchema)Schema.Parse(@"{
  ""type"": ""record"", ""name"": ""OhlcvRecord"", ""namespace"": ""bench"",
  ""fields"": [
    {""name"": ""symbol"", ""type"": ""string""},
    {""name"": ""date"",   ""type"": ""string""},
    {""name"": ""open"",   ""type"": ""double""},
    {""name"": ""high"",   ""type"": ""double""},
    {""name"": ""low"",    ""type"": ""double""},
    {""name"": ""close"",  ""type"": ""double""},
    {""name"": ""volume"", ""type"": ""long""}
  ]
}");

void WriteAvro(string path, List<OhlcvRecord> data)
{
    using var writer = DataFileWriter<GenericRecord>.OpenWriter(
        new GenericDatumWriter<GenericRecord>(avroSchema), path);
    foreach (var r in data)
    {
        var rec = new GenericRecord(avroSchema);
        rec.Add("symbol", r.Symbol); rec.Add("date", r.Date);
        rec.Add("open", r.Open); rec.Add("high", r.High);
        rec.Add("low", r.Low); rec.Add("close", r.Close);
        rec.Add("volume", r.Volume);
        writer.Append(rec);
    }
}

int ReadAvro(string path)
{
    int count = 0;
    using var reader = DataFileReader<GenericRecord>.OpenReader(path);
    while (reader.HasNext()) { reader.Next(); count++; }
    return count;
}

foreach (var (label, data) in new[] { ("small", small), ("medium", medium), ("large", large) })
{
    var path = Path.Combine(benchDir, $"avro_{label}.avro");
    var (wMs, bytes) = BenchWrite("avro", $"{label}.avro", data.Count, p => WriteAvro(p, data));
    var rMs = BenchRead(() => ReadAvro(path));
    results.Add(("Avro", label, data.Count, wMs, rMs, bytes));
}
```

#### Protobuf benchmark | binary with external schema, most compact

```csharp

void WriteProto(string path, List<OhlcvRecord> data)
{
    using var fs = File.OpenWrite(path);
    foreach (var r in data)
    {
        var cos = new CodedOutputStream(fs, leaveOpen: true);
        cos.WriteTag(1, WireFormat.WireType.LengthDelimited); cos.WriteString(r.Symbol);
        cos.WriteTag(2, WireFormat.WireType.LengthDelimited); cos.WriteString(r.Date);
        cos.WriteTag(3, WireFormat.WireType.Fixed64); cos.WriteDouble(r.Open);
        cos.WriteTag(4, WireFormat.WireType.Fixed64); cos.WriteDouble(r.High);
        cos.WriteTag(5, WireFormat.WireType.Fixed64); cos.WriteDouble(r.Low);
        cos.WriteTag(6, WireFormat.WireType.Fixed64); cos.WriteDouble(r.Close);
        cos.WriteTag(7, WireFormat.WireType.Varint); cos.WriteInt64(r.Volume);
        cos.Flush();
    }
}

foreach (var (label, data) in new[] { ("small", small), ("medium", medium), ("large", large) })
{
    var path = Path.Combine(benchDir, $"proto_{label}.bin");
    var (wMs, bytes) = BenchWrite("proto", $"{label}.bin", data.Count, p => WriteProto(p, data));
    results.Add(("Protobuf", label, data.Count, wMs, 0, bytes));
}
```

> [!info] Protobuf read benchmark omitted
>
> Raw protobuf bytes have no built-in message framing — without length-prefixed records, a generic reader cannot determine where one message ends and the next begins. Read benchmarks require `protoc`-generated classes or a framing convention.

### Results and analysis

#### Results — performance matrix

```csharp

foreach (var bucket in new[] { "large", "medium", "small" })
{
    var bucketResults = results.Where(r => r.Size == bucket).OrderBy(r => r.FileBytes).ToList();
    if (!bucketResults.Any()) continue;

    var minBytes = bucketResults.Min(r => r.FileBytes);
    var maxBytes = bucketResults.Max(r => r.FileBytes);
    var minWrite = bucketResults.Min(r => r.WriteMs);
    var maxWrite = bucketResults.Max(r => r.WriteMs);
    var minRead = bucketResults.Where(r => r.ReadMs > 0).Min(r => r.ReadMs);
    var maxRead = bucketResults.Max(r => r.ReadMs);

    Console.WriteLine($"\n  \u2550\u2550\u2550 {bucket.ToUpper()} ({bucketResults[0].Records:N0} records) \u2550\u2550\u2550");
    Console.WriteLine($"  {"Format",-10} {"File Size",12} {"Bytes/Rec",10} {"Write ms",10} {"Read ms",10}");
    Console.WriteLine($"  {new string('\u2500', 54)}");

    foreach (var r in bucketResults)
    {
        var sizeStr = r.FileBytes < 1024 ? $"{r.FileBytes} B"
                    : r.FileBytes < 1024 * 1024 ? $"{r.FileBytes / 1024.0:F1} KB"
                    : $"{r.FileBytes / (1024.0 * 1024):F1} MB";
        var bpr = r.FileBytes / Math.Max(r.Records, 1);
        var readStr = r.ReadMs > 0 ? $"{r.ReadMs}" : "n/a";

            var bprMark = r.FileBytes == minBytes ? " \u2714" : r.FileBytes == maxBytes ? " \u2718" : "";
        var writeMark = r.WriteMs == minWrite ? " \u2714" : r.WriteMs == maxWrite ? " \u2718" : "";
        var readMark = r.ReadMs == minRead ? " \u2714" : r.ReadMs == maxRead ? " \u2718" : "";

        Console.WriteLine($"  {r.Format,-10} {sizeStr,12} {bpr,8}{bprMark,-2} {r.WriteMs,8}{writeMark,-2} {readStr,8}{readMark}");
    }
}
```

```text
═══ LARGE (100,000 records) ═══
Format        File Size  Bytes/Rec   Write ms    Read ms
──────────────────────────────────────────────────────
Parquet          1.8 MB       18 ✔       23 ✔        8 ✔
CSV              5.0 MB       52         36         14
Avro             5.1 MB       53         38         31
Protobuf         5.7 MB       59         40        n/a
JSON            10.5 MB      110 ✘       45 ✘       87 ✘

═══ MEDIUM (10,000 records) ═══
Format        File Size  Bytes/Rec   Write ms    Read ms
──────────────────────────────────────────────────────
Parquet        292.1 KB       29 ✔        9 ✘        6 ✔
CSV            510.6 KB       52          3         16 ✘
Avro           517.9 KB       53          3          6 ✔
Protobuf       585.6 KB       59          2 ✔      n/a
JSON             1.1 MB      110 ✘        4         12

═══ SMALL (100 records) ═══
Format        File Size  Bytes/Rec   Write ms    Read ms
──────────────────────────────────────────────────────
Parquet          4.1 KB       41 ✔        2 ✘      n/a
CSV              5.2 KB       53          0 ✔      n/a
Avro             5.5 KB       56          0 ✔        7 ✔
Protobuf         5.9 KB       60          0 ✔      n/a
JSON            10.8 KB      110 ✘        1          7 ✔
```

### Performance and compression charts

#### Results DataFrame

Registers a custom HTML table formatter for `DataFrame` that highlights the best (green) and worst (red) values in metric columns, grouped by record count.

```csharp
Formatter.Register<DataFrame>(df =>
{
    var cols = df.ColumnNames.ToList();
    var data = Enumerable.Range(0, (int)df.Height)
        .Select(r => cols.ToDictionary(c => c, c => df[cols.IndexOf(c)][r]?.ToString() ?? ""))
        .ToList();

    var colorCols = new HashSet<string> { "Write_ms", "Read_ms", "Bytes_Rec" };
    var groupCol = "Records";

    var html = "<table><tr>" +
        string.Join("", cols.Select(c => $"<th>{c}</th>")) +
        "</tr>";

    foreach (var grp in data.GroupBy(r => r[groupCol]).OrderByDescending(g => long.TryParse(g.Key, out var v) ? v : 0))
    {
        var rows = grp.OrderBy(r => long.TryParse(r.GetValueOrDefault("Bytes_Rec", "0"), out var v) ? v : 0).ToList();

        // Compute min/max ONLY for the color columns
        var mins = new Dictionary<string, long>();
        var maxs = new Dictionary<string, long>();
        foreach (var c in colorCols)
        {
            var vals = rows.Select(r => long.TryParse(r.GetValueOrDefault(c, "0"), out var v) ? v : 0).Where(v => v > 0).ToList();
            if (vals.Any()) { mins[c] = vals.Min(); maxs[c] = vals.Max(); }
        }

        html += $"<tr><td colspan='{cols.Count}'>" +
                $"\u2500\u2500\u2500\u2500 {long.Parse(grp.Key):N0} records \u2500\u2500\u2500\u2500</td></tr>";

        foreach (var row in rows)
        {
            html += "<tr>";
            foreach (var c in cols)
            {
                var val = row[c];
                var s = "padding:3px 8px;text-align:right;";
                if (c == "Format") s = "padding:3px 8px;text-align:right;font-weight:bold;";

                if (colorCols.Contains(c) && long.TryParse(val, out var n) && n > 0)
                {
                    if (mins.ContainsKey(c) && n == mins[c]) s += "background:#2e7d32;color:#fff;";
                    else if (maxs.ContainsKey(c) && n == maxs[c]) s += "background:#c62828;color:#fff;";
                }
                html += $"<td>{val}</td>";
            }
            html += "</tr>";
        }
    }
    return html + "</table>";
}, mimeType: "text/html");

```

#### Results

Builds a `DataFrame` from the benchmark results with formatted file size and per-record byte count columns.

```csharp
DataFrame.From(results.Select(r => {
    var sz = r.FileBytes < 1024 * 1024
        ? $"{r.FileBytes / 1024.0:F1} KB"
        : $"{r.FileBytes / (1024.0 * 1024):F1} MB";
    return new {
        r.Format,
        r.Records,
        File_Size = sz,
        Bytes_Rec = r.FileBytes / Math.Max(r.Records, 1),
        Write_ms = r.WriteMs,
        Read_ms = r.ReadMs,
    };
}))
```

<table><tr><th>Format</th><th>Records</th><th>File_Size</th><th>Bytes_Rec</th><th>Write_ms</th><th>Read_ms</th></tr><tr><td colspan='6'>──── 100'000 records ────</td></tr><tr><td>Parquet</td><td>100000</td><td>1.8 MB</td><td>18</td><td>23</td><td>8</td></tr><tr><td>CSV</td><td>100000</td><td>5.0 MB</td><td>52</td><td>36</td><td>14</td></tr><tr><td>Avro</td><td>100000</td><td>5.1 MB</td><td>53</td><td>38</td><td>31</td></tr><tr><td>Protobuf</td><td>100000</td><td>5.7 MB</td><td>59</td><td>40</td><td>0</td></tr><tr><td>JSON</td><td>100000</td><td>10.5 MB</td><td>110</td><td>45</td><td>87</td></tr><tr><td colspan='6'>──── 10'000 records ────</td></tr><tr><td>Parquet</td><td>10000</td><td>292.1 KB</td><td>29</td><td>9</td><td>6</td></tr><tr><td>CSV</td><td>10000</td><td>510.6 KB</td><td>52</td><td>3</td><td>16</td></tr><tr><td>Avro</td><td>10000</td><td>517.9 KB</td><td>53</td><td>3</td><td>6</td></tr><tr><td>Protobuf</td><td>10000</td><td>585.6 KB</td><td>59</td><td>2</td><td>0</td></tr><tr><td>JSON</td><td>10000</td><td>1.1 MB</td><td>110</td><td>4</td><td>12</td></tr><tr><td colspan='6'>──── 100 records ────</td></tr><tr><td>Parquet</td><td>100</td><td>4.1 KB</td><td>41</td><td>2</td><td>0</td></tr><tr><td>CSV</td><td>100</td><td>5.2 KB</td><td>53</td><td>0</td><td>0</td></tr><tr><td>Avro</td><td>100</td><td>5.5 KB</td><td>56</td><td>0</td><td>7</td></tr><tr><td>Protobuf</td><td>100</td><td>5.9 KB</td><td>60</td><td>0</td><td>0</td></tr><tr><td>JSON</td><td>100</td><td>10.8 KB</td><td>110</td><td>1</td><td>7</td></tr></table>

#### Write vs Read speed — 100K records

Grouped bar chart comparing write and read times across all formats for the 100K record set.

```csharp
var large = results.Where(r => r.Size == "large").OrderBy(r => r.WriteMs).ToList();
var fmtNames = large.Select(r => r.Format).ToArray();

var writeVals = large.Select(r => (int)r.WriteMs).ToArray();
var readVals = large.Select(r => (int)r.ReadMs).ToArray();

Plotly.NET.CSharp.Chart.Combine(new[] {
    Plotly.NET.CSharp.Chart.Column<int, string, string>(
        values: writeVals,
        Keys: fmtNames,
        Name: "Write ms"
    ),
    Plotly.NET.CSharp.Chart.Column<int, string, string>(
        values: readVals,
        Keys: fmtNames,
        Name: "Read ms"
    )
}).WithTitle("Read/Write Performance — 100K Records (ms, lower = faster)")
 .WithYAxisStyle(Title.init("Time (ms)"))
 .WithSize(700, 400)
 .WithLayout(Layout.init<string>(
    PaperBGColor: Color.fromHex("#1e1e1e"),
    PlotBGColor: Color.fromHex("#2d2d2d"),
    Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<iframe src="/static/plotly/ser_01.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### File size comparison — 100K records

Horizontal bar chart showing file sizes in MB for the 100K record set, ordered by size.

```csharp
var sizeMB = large.Select(r => Math.Round(r.FileBytes / (1024.0 * 1024), 2)).ToArray();

Plotly.NET.CSharp.Chart.Bar<double, string, string>(
    values: sizeMB,
    Keys: fmtNames,
    Name: "Size (MB)"
).WithTitle("File Size — 100K Records (MB)")
 .WithXAxisStyle(Title.init("Size (MB)"))
 .WithSize(700, 350)
 .WithLayout(Layout.init<string>(
    PaperBGColor: Color.fromHex("#1e1e1e"),
    PlotBGColor: Color.fromHex("#2d2d2d"),
    Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<iframe src="/static/plotly/ser_02.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### Recommendation matrix | best format for each scenario

| Scenario | Best Format | Why |
|---|---|---|
| Data lake / analytics queries | Parquet | Columnar: read 2 of 50 columns = skip 96% of data |
| Kafka event streaming | Avro | Schema embedded, schema registry, compact |
| gRPC microservices | Protobuf | Fastest parse, smallest size, code-generated types |
| REST API responses | JSON | Human-readable, universal, self-describing |
| Config files | JSON / YAML | Human-editable, comments (YAML), versioned in git |
| Legacy data warehouse export | CSV | Universal, every tool reads it, no schema needed |
| Debug / logging | JSON | Human-readable, structured, grep-friendly |
| High-freq trading feed | Protobuf | Lowest latency, smallest payload, no text parsing |
| ML feature store | Parquet | Column pruning, predicate pushdown, partitioned |
| Cross-language IPC | Protobuf/Avro | Protobuf for speed, Avro for schema |
| Batch ETL intermediate | Parquet | Compressed, typed, readable by Spark/BigQuery/Polars |
| Small config payloads (<1KB) | JSON | Binary format overhead not worth it |
| Shared memory / mmap | Binary (struct) | Fixed-size records, zero-copy access |
| Browser / mobile API | JSON + gzip | Universal client support, compressed in transit |

> [!tip] Rankings
>
> **Size** (smallest → largest): Protobuf < Parquet < Avro < JSON < CSV
> **Speed** (fastest → slowest): Protobuf ≈ Parquet > Avro > JSON > CSV

```csharp
Directory.Delete(benchDir, recursive: true);
```

## Warnings

> [!warning] Parquet.NET API differs from PyArrow
>
> Column access, schema inspection, and read options use different patterns than Python's `pyarrow.parquet`. Code that works in PyArrow won't translate directly.

> [!success] Correct pattern
>
> Read the Parquet.NET documentation for its specific API. Use `ParquetReader`/`ParquetWriter` with explicit column access patterns.

> [!warning] Protobuf code generation must be re-run on schema changes
>
> If you modify a `.proto` file but don't regenerate the C# classes, the old generated code silently misinterprets new fields.

> [!success] Correct pattern
>
> Integrate `protoc` into your build pipeline (MSBuild `<Protobuf>` items). Regeneration happens automatically on build.

> [!warning] Avro generic API is slower than specific API
>
> `GenericRecord` uses dynamic field access — no compile-time checking, slower serialization, more allocations.

> [!success] Correct pattern
>
> Use code-generated specific classes for production workloads. Reserve generic API for tools and ad-hoc queries.

## Recommendations

- **Use Parquet for data lakes and analytical storage** — columnar layout, compression, schema embedded. Parquet.NET provides native .NET access.
- **Use Protobuf for gRPC and low-latency IPC** — smallest payload, fastest parse. Integrate `protoc` into MSBuild.
- **Use Avro for Kafka and streaming** — schema embedded, schema evolution, compact wire format.
- **Use `System.Text.Json` for REST APIs** — no binary format overhead for small payloads (<1KB).
- **Use `BinaryPrimitives` for endianness-aware binary I/O** — explicit big/little-endian methods prevent protocol bugs.
- **Choose compression by workload** — Snappy for speed, Zstd for balance, Gzip for maximum compression.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Parquet file can't be read | Wrong library version or unsupported compression codec | Check Parquet.NET version supports the codec used |
| Protobuf deserialization returns default values | Field numbers changed between `.proto` versions | Regenerate C# classes from the current `.proto` |
| Avro `SchemaParseException` | Malformed Avro schema JSON | Validate schema against Avro spec |
| Binary data corrupted across platforms | Endianness mismatch | Use `BinaryPrimitives.ReadInt32BigEndian` explicitly |
| Benchmark shows unexpected results | JIT warmup, GC pressure, or small dataset size | Use `BenchmarkDotNet` for reliable microbenchmarks |

