---
title: "10 - Serialization Formats - Python"
tags:
  - python
aliases: [serialization formats, JSON, CSV, Parquet, Avro, Protocol Buffers]
description: "Python serialization formats reference with executable examples and cell outputs — covers JSON, CSV, Parquet, Avro, Protocol Buffers, MessagePack, and format comparison benchmarks. See [10-cs-serialization-formats](https://alp78.github.io/elysium/02-Programming-Languages/02-CSharp/10-cs-serialization-formats) for the C# equivalent."
created: 2026-03-25
updated: 2026-03-25
status: complete
---

# Serialization Formats - Python

> [!quote]+
> "Write programs to handle text streams, because that is a universal interface."
>
> — **Doug McIlroy**, *Bell System Technical Journal* (1978)

> [!abstract]- Summary
>
> - **Parquet** — columnar binary format; schema embedded in file footer; best for data lakes, analytics, BigQuery; supports column pruning, predicate pushdown, Hive-style partitioning; `pyarrow` is the standard Python library.
> - **Avro** — row-based binary with schema in file/message header; native to Kafka; supports schema evolution (add fields with defaults safely); `fastavro` is the Python library; ~50–70% smaller than JSON at scale.
> - **Protocol Buffers (Protobuf)** — smallest payload, fastest parse; schema defined in `.proto` files compiled with `protoc`; schema not embedded in binary — both sides must share the schema; standard for gRPC and high-frequency feeds.
> - **MessagePack** — binary JSON semantics; drop-in size/speed improvement over JSON; no schema enforcement; limited enterprise adoption.
> - **Benchmark results (100K OHLCV records):** Parquet wins on size (1.7 MB, 65.9% smaller than CSV) and read speed (8 ms); Protobuf wins on write throughput; JSON is largest (11.9 MB) and slowest to write (716 ms).
> - **Format selection rules:** Parquet for batch analytics; Avro for streaming/Kafka; Protobuf for gRPC/low-latency IPC; JSON for APIs and config; CSV for legacy interchange only.
> - **Schema evolution safety:** adding fields with defaults is safe in both Avro and Protobuf; renaming or removing required fields breaks consumers.
> - **Compression codecs:** Snappy for speed (real-time), Zstd for balance (ETL), Gzip for archival; Parquet embeds compression per column.
> - **In-memory patterns:** `BytesIO` enables cloud upload without disk I/O for both Parquet and Avro payloads.
> - **Parquet limitation:** not streamable — footer must be read before any data; use Avro or JSONL for append/streaming workloads.

> [!note]- Glossary
>
> **Parquet**
>
> - Apache columnar binary file format that stores data column-by-column with per-column compression and an embedded schema in the file footer.
> - Used as the standard storage format in data lakes (GCS, S3, ADLS), BigQuery, Spark, DuckDB, and Athena because it allows reading only the required columns, reducing I/O by up to 96% on wide tables.
>
> > [!tip] Parquet is not streamable
> >
> > The file footer must be read before any row data can be accessed. Never use Parquet for append or streaming workloads — use Avro or JSONL instead.
>
>  ---
>
> **Avro**
>
> - Apache row-based binary serialization format that embeds the full schema as a JSON object in every file header, making files self-describing without an external schema file.
> - Native to Apache Kafka and widely used for event streaming; `fastavro` is the standard Python library; typically 50–70% smaller than equivalent JSON for numeric-heavy payloads.
>
> > [!tip] Avro schema vs. Avro data
> >
> > The Avro schema is defined in JSON syntax, but the data payload is binary. Do not confuse the two layers when debugging serialization errors.
>
>  ---
>
> **Protocol Buffers (Protobuf)**
>
> - Google's language-neutral binary serialization format where schemas are defined in `.proto` text files and compiled by `protoc` into typed classes for Python, Java, Go, C#, and other languages.
> - Produces the smallest wire payload and fastest parse times among common formats; standard for gRPC microservices and high-frequency trading feeds; schema is not embedded in binary messages.
>
> > [!tip] Protobuf field numbers are wire identifiers
> >
> > Field numbers in `.proto` files are permanent identifiers encoded in the binary — changing a number breaks all existing messages. Add new fields with new numbers; never reuse retired ones.
>
>  ---
>
> **MessagePack**
>
> - Binary serialization format that mirrors the JSON data model (objects, arrays, strings, numbers, booleans, null) but encodes values in a compact binary representation.
> - Acts as a drop-in replacement for JSON when payload size and parse speed matter but schema enforcement is not required; has limited enterprise tooling support compared to Avro or Protobuf.
>
> > [!tip] MessagePack vs. JSON
> >
> > MessagePack is not self-describing — field names are still included, unlike Protobuf. It trades human readability for ~30–50% size reduction with no schema validation guarantee.
>
>  ---
>
> **columnar format**
>
> - A storage layout where all values for a single column are stored contiguously on disk, rather than storing all columns of a row together (row-based layout).
> - Enables column pruning (skip unneeded columns entirely) and vectorized computation; critical for analytical workloads where queries touch a small subset of columns in a wide table.
>
> > [!tip] Columnar is slow for single-record lookups
> >
> > Reading one complete row requires touching every column file; row-based formats (Avro, CSV) are faster for transactional point-queries.
>
>  ---
>
> **schema evolution**
>
> - The ability to add, remove, or modify fields in a serialization schema without breaking existing producers or consumers that use an older version of the schema.
> - Long-lived data pipelines depend on safe evolution; Avro and Protobuf both support it through default values and field-number stability, but renaming fields or changing types breaks compatibility in all formats.
>
> > [!tip] Safe vs. unsafe changes
> >
> > Adding a field with a default value is always safe. Removing a field without a default, or changing a field's type, is a breaking change that corrupts or drops data for consumers on the old schema.
>
>  ---
>
> **predicate pushdown**
>
> - An optimization where a filter condition is applied during the I/O phase — skipping entire row groups or data blocks whose column statistics (min/max) prove no matching rows exist.
> - Parquet implements predicate pushdown via `filters=` in `pq.read_table()`; on sorted or partitioned data, this can reduce I/O by 10–100x compared to loading all data and filtering in memory.
>
> > [!tip] Pushdown only works with column statistics
> >
> > Predicate pushdown benefits are data-dependent: fully random data with no clustering provides no skippable row groups. Sort or partition by the filter column to maximize benefit.
>
>  ---
>
> **compression codec**
>
> - An algorithm applied to serialized data to reduce its size: Snappy (fast, low CPU), Zstd (balanced speed/ratio), Gzip (highest compression, more CPU).
> - Parquet applies codec per column; choosing the right codec trades CPU time for storage size and network transfer cost — Snappy for real-time pipelines, Zstd for ETL, Gzip for archival.
>
> > [!tip] Snappy vs. Zstd vs. Gzip
> >
> > Snappy decompresses in ~200 MB/s; Zstd achieves 30–50% better compression ratios than Snappy at similar CPU cost; Gzip maximizes compression but is 3–5x slower to decompress.
>
>  ---
>
> **column pruning**
>
> - Reading only a specified subset of columns from a Parquet file by passing `columns=[...]` to `pq.read_table()`; unneeded columns are never read from disk at the block level.
> - On a 50-column table where a query touches only 2 columns, column pruning reduces disk reads by ~96%; this is the primary reason Parquet outperforms CSV for analytical queries.
>
> > [!tip] Column pruning is free at read time
> >
> > Always pass an explicit `columns=` list when reading Parquet in production pipelines. It costs nothing to specify and can cut I/O and memory by an order of magnitude.
>
>  ---
>
> **Hive-style partitioning**
>
> - A directory naming convention where a dataset is split into subdirectories named `column=value/` (e.g., `event_type=purchase/`), enabling query engines to skip entire partitions that do not match filter conditions.
> - Supported natively by `pq.write_to_dataset()` via `partition_cols=`; readers (BigQuery, Spark, Athena, DuckDB, pyarrow) discover and prune partitions automatically.
>
> > [!tip] Partition cardinality matters
> >
> > High-cardinality columns (e.g., `user_id`) create millions of tiny files and destroy performance. Partition on low-cardinality columns like `date`, `region`, or `event_type`.
>
>  ---
>
> **BytesIO**
>
> - An in-memory binary stream from the Python `io` module that satisfies the file-like interface expected by `pq.write_table()`, `fastavro.writer()`, and other serialization libraries.
> - Used to serialize Parquet or Avro directly into a bytes buffer for cloud upload (GCS, S3) without writing a temporary file to disk; always call `seek(0)` before reading back.
>
> > [!tip] BytesIO for cloud upload
> >
> > Pass a `BytesIO` buffer directly to GCS `blob.upload_from_file()` or S3 `put_object(Body=...)` after serializing — avoids a disk round-trip and simplifies container deployments with read-only filesystems.
>
>  ---
>
> **fastavro**
>
> - A pure-Python Avro library optimized for speed; provides `fastavro.parse_schema()`, `fastavro.writer()`, and `fastavro.reader()` for schema validation, file serialization, and deserialization.
> - `parse_schema()` must be called on the schema dict before writing; schemas are plain Python dicts following the Avro JSON schema specification; records are plain Python dicts validated on write.
>
> > [!tip] fastavro vs. Apache avro-python3
> >
> > `fastavro` is 5–10x faster than the official `avro-python3` package and is the de-facto standard for Python Avro work. The `avro-python3` package is deprecated; prefer `fastavro` in all new code.
>
>  ---
>
> **pyarrow**
>
> - Apache Arrow's Python bindings providing the `pa.Table`, `pa.Schema`, and `pyarrow.parquet` (`pq`) modules for in-memory columnar data and Parquet I/O.
> - The standard library for Parquet read/write in Python; also used by pandas (`to_parquet`/`read_parquet`) and Polars internally; supports column pruning, predicate pushdown, partitioned datasets, and in-memory `BytesIO` serialization.
>
> > [!tip] pyarrow schema enforcement
> >
> > Pass a `pa.schema()` explicitly to `pa.table()` to enforce types at construction time. Without it, Arrow infers types from Python values and may silently choose `int32` instead of `int64` for small integers.
>
>  ---
>
> **row group**
>
> - A horizontal partition within a Parquet file; a single file is divided into one or more row groups, each containing a fixed number of rows (default ~122,880 rows per group in pyarrow).
> - Row group statistics (min/max per column) are stored in the file footer and are the basis for predicate pushdown — the reader skips entire row groups that cannot contain matching rows.
>
> > [!tip] Row group size tuning
> >
> > Smaller row groups increase predicate pushdown effectiveness but add footer overhead. Larger row groups improve compression ratios. The pyarrow default (~122K rows) is a sensible starting point for most ETL workloads.
>
>  ---
>
> **`.proto` file**
>
> - A text file written in Protocol Buffers IDL (Interface Definition Language) that defines message types, field names, field numbers, and scalar types; compiled by `protoc` into language-specific source code.
> - Field numbers in `.proto` are permanent wire identifiers; once a field number is assigned and data has been written, the number cannot be reused for a different field without corrupting existing messages.
>
> > [!tip] Proto3 default values
> >
> > In proto3, all fields are optional and default to the zero value for their type (`""`, `0`, `false`). Protobuf omits default-value fields from the binary encoding, which means a missing field and a field set to its default are indistinguishable on the wire.
>
>  ---
>
> **schema registry**
>
> - A centralized service (e.g., Confluent Schema Registry, Buf) that stores versioned schemas for Avro or Protobuf messages and enforces compatibility rules (backward, forward, full) before a new schema version is accepted.
> - Decouples schema management from application code; Kafka producers and consumers look up schemas by ID at runtime, eliminating the need to bundle schema files in every service.
>
> > [!tip] Schema IDs in Kafka messages
> >
> > Confluent-compatible producers prefix each Avro/Protobuf message with a 5-byte header: `0x00` (magic byte) + 4-byte big-endian schema ID. Consumers use this ID to fetch the correct schema from the registry before deserializing.
>
>  ---
>
> **wire format**
>
> - The binary byte sequence actually transmitted over a network or written to disk, as opposed to the in-memory representation of the data in a programming language.
> - Protobuf's wire format uses tag-length-value (TLV) encoding: each field is prefixed by a varint combining the field number and wire type (0 = varint, 1 = 64-bit, 2 = length-delimited, 5 = 32-bit).
>
> > [!tip] Wire type determines decoding
> >
> > A Protobuf decoder reads the wire type from the tag to know how many bytes to consume for each field. Mismatched wire types (e.g., schema says `string` but writer sends `int64`) produce `DecodeError` exceptions or silent corruption.
>
>  ---
>
> **OHLCV**
>
> - Open-High-Low-Close-Volume: the standard five-field representation of a price bar for a financial instrument over a time period (tick, minute, day, etc.).
> - Used as the benchmark test schema in this note because it is representative of real stoxx pipeline data: a mix of string (`symbol`, `date`), float (`open`, `high`, `low`, `close`), and integer (`volume`) columns.
>
> > [!tip] OHLCV as a benchmark schema
> >
> > The mix of string and numeric types in OHLCV data makes it a realistic proxy for financial data lake payloads — column pruning and compression ratios measured on this schema transfer directly to production pipeline sizing.
>
>  ---
>
> **varint encoding**
>
> - A variable-length integer encoding used by Protobuf where smaller integer values occupy fewer bytes: values 0–127 encode in 1 byte; values 128–16383 in 2 bytes, and so on.
> - The `_proto_varint()` helper in the benchmark benchmark encodes the `volume` field using this scheme; varint is Protobuf wire type 0 and is used for `int32`, `int64`, `uint32`, `uint64`, `sint32`, `sint64`, `bool`, and `enum` fields.
>
> > [!tip] Varint and negative numbers
> >
> > Negative `int64` values always occupy 10 bytes in standard varint encoding because the sign bit forces all high bits to 1. Use `sint64` with zigzag encoding in `.proto` if negative integers are common — it halves the size.
>
>  ---
>
> **descriptor pool**
>
> - A runtime registry in `google.protobuf` that maps fully-qualified message type names to their `DescriptorProto` definitions, enabling dynamic message construction without `protoc`-generated `_pb2.py` files.
> - Used in the dynamic Protobuf example (`descriptor_pool.DescriptorPool()`, `pool.Add()`, `pool.FindMessageTypeByName()`) to build a `StockQuote` message class at runtime inside a Jupyter notebook.
>
> > [!tip] Dynamic Protobuf vs. generated code
> >
> > The descriptor-pool approach is useful for notebooks and exploratory work where compiling `.proto` files is impractical. In production services, always use `protoc`-generated `_pb2.py` modules — they are faster, type-checked, and easier to maintain.


```python
import os
import csv
import json
import struct
import tempfile
import time
import shutil
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.compute as pc
from pathlib import Path
from io import BytesIO
from google.protobuf import descriptor_pb2, descriptor_pool
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection

import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from IPython.display import display
import fastavro
import random
html_formatter = get_ipython().display_formatter.formatters['text/html'] # type: ignore
html_formatter.for_type(pd.DataFrame, lambda df: df.to_html())
html_formatter.for_type(pd.Series, lambda s: s.to_frame().to_html())
```

## Parquet Files

### pyarrow | write and read Parquet

#### Parquet overview — columnar format for analytics

Parquet stores data **column-by-column** with per-column compression (snappy, gzip, zstd). Schema is embedded in the file footer — self-describing, no separate schema file needed. Supports column pruning (projection pushdown), predicate pushdown, and partitioning. 5-10x smaller than CSV. Standard in data lakes (GCS, S3, ADLS), BigQuery, Spark, DuckDB, Athena. Use `pyarrow` for parquet I/O in Python.

> [!warning] When NOT to use Parquet
>
> - **Small files** (<1MB) — Parquet overhead exceeds benefit
> - **Frequent appends** — Parquet is immutable; use Avro/JSONL for streaming
> - **Simple data exchange** — CSV is more universal

> [!success] Use Parquet for analytics; JSONL or Avro for streaming appends
>
> For batch analytics (BigQuery, Spark, Athena, DuckDB) with files >1 MB: Parquet with snappy compression. For event streams where records arrive continuously: JSONL (one object per line) or Avro with a schema registry. For simple hand-off to non-engineering consumers: CSV.

```python
tmp_dir = Path(tempfile.mkdtemp(prefix="parquet_"))
```

#### pa.schema — define typed Arrow schema

`pa.schema()` declares column names and types upfront. Arrow enforces these types at table creation — no silent coercion. Use `pa.string()`, `pa.int64()`, `pa.float64()`, `pa.bool_()` for the most common column types.

```python
schema = pa.schema([
    ("event_id", pa.string()),
    ("event_type", pa.string()),
    ("user_id", pa.int64()),
    ("revenue", pa.float64()),
    ("is_mobile", pa.bool_()),
])
```

#### pa.table — create Arrow table from column arrays

Each column is a `pa.array` — typed, nullable, and memory-efficient. Pass a dict of column names to Python lists along with the schema to enforce types at construction time.

```python
table = pa.table({
    "event_id":   ["evt_001", "evt_002", "evt_003", "evt_004", "evt_005"],
    "event_type": ["page_view", "purchase", "page_view", "signup", "purchase"],
    "user_id":    [1001, 1002, 1001, 1003, 1002],
    "revenue":    [0.0, 49.99, 0.0, 0.0, 129.99],
    "is_mobile":  [True, False, True, True, False],
}, schema=schema)
```

#### pq.write_table — write Parquet from Arrow table

`pq.write_table()` serializes an Arrow table to a Parquet file on disk. The `compression` parameter controls the codec: `'snappy'` (default, fast), `'gzip'` (smaller), `'zstd'` (best ratio), `'none'`.

```python
parquet_file = tmp_dir / "events.parquet"
pq.write_table(table, parquet_file, compression="snappy")

print(parquet_file.name)
print(f"{parquet_file.stat().st_size} bytes (compressed)")
print(f"Rows: {table.num_rows}, Columns: {table.num_columns}")
```

```text
events.parquet
1594 bytes (compressed)
Rows: 5, Columns: 5
```

#### pyarrow pq.read_table — read entire Parquet file

`pq.read_table()` reads the full Parquet file into an Arrow table. The schema is discovered from the file footer. Call `.to_pandas()` to convert to a pandas DataFrame for display or further processing.

```python
table_read = pq.read_table(parquet_file)
print(f"Schema:\n{table_read.schema}")
print(f"Data:\n{table_read.to_pandas()}")
```

```text
Schema:
  event_id: string
  event_type: string
  user_id: int64
  revenue: double
  is_mobile: bool

Data:
  event_id event_type  user_id  revenue  is_mobile
  evt_001  page_view     1001     0.00       True
  evt_002   purchase     1002    49.99      False
  evt_003  page_view     1001     0.00       True
  evt_004     signup     1003     0.00       True
  evt_005   purchase     1002   129.99      False
```

### Column pruning, pushdown, and partitioning

#### pyarrow pq.read_table columns= — column pruning

Pass `columns=["col1", "col2"]` to read only the columns you need. On a 100-column table, this can be 50x faster than CSV because Parquet stores columns independently — unneeded columns are never read from disk.

```python
partial = pq.read_table(parquet_file, columns=["event_id", "revenue"])
print(partial.column_names)
print(partial.column('revenue').to_pylist())
print(f"{sum(partial.column('revenue').to_pylist()):.2f}")
```

```text
['event_id', 'revenue']
[0.0, 49.99, 0.0, 0.0, 129.99]
179.98
```

#### pyarrow pq.read_table filters= — predicate pushdown

Pass `filters=[("column", "op", "value")]` to skip entire row groups whose statistics prove no matching rows exist. This avoids reading data that would be filtered out anyway — significant for partitioned datasets with millions of rows.

```python
filtered = pq.read_table(
    parquet_file,
    filters=[("event_type", "==", "purchase")]
)
print(f"Purchases only ({filtered.num_rows} rows):")
print(f"{filtered.to_pandas()}")

meta = pq.read_metadata(parquet_file)
print(f"Rows: {meta.num_rows}, Columns: {meta.num_columns}, Row groups: {meta.num_row_groups}")

schema_read = pq.read_schema(parquet_file)
for i, field in enumerate(schema_read):
    print(f"    [{i}] {field.name}: {field.type}")
```

Metadata reads the schema and row count from the file footer without loading any data — instant even for huge files.

```text
Purchases only (2 rows):
  event_id event_type  user_id  revenue  is_mobile
  evt_002   purchase     1002    49.99      False
  evt_005   purchase     1002   129.99      False
Rows: 5, Columns: 5, Row groups: 1
Schema:
  [0] event_id: string
  [1] event_type: string
  [2] user_id: int64
  [3] revenue: double
  [4] is_mobile: bool
```

#### pyarrow pq.write_to_dataset — Hive-style partitioning

`pq.write_to_dataset()` splits a table into subdirectories by partition column values (e.g., `event_type=purchase/`). Readers discover partitions automatically. This is the standard storage pattern for data lakes — BigQuery, Athena, and Spark all understand Hive-style layout.

```python
partitioned_dir = tmp_dir / "events_partitioned"
pq.write_to_dataset(
    table,
    root_path=str(partitioned_dir),
    partition_cols=["event_type"],
)

for f in sorted(partitioned_dir.rglob("*.parquet")):
    rel = f.relative_to(partitioned_dir)
    print(f"    {rel} ({f.stat().st_size} bytes)")

dataset = pq.read_table(str(partitioned_dir))
print(f"{dataset.num_rows} rows, columns: {dataset.column_names}")
```

pyarrow discovers partitions automatically when reading back.

```text
event_type=page_view/...-0.parquet (1266 bytes)
event_type=purchase/...-0.parquet (1274 bytes)
event_type=signup/...-0.parquet (1255 bytes)
5 rows, columns: ['event_id', 'user_id', 'revenue', 'is_mobile', 'event_type']
```

### In-memory and comparison

#### Parquet in memory — BytesIO | cloud upload without temp files

Serialize Parquet to a `BytesIO` buffer for direct cloud upload (GCS, S3) without writing to disk. Rewind with `seek(0)` before reading or uploading.

```python
buffer = BytesIO()
pq.write_table(table, buffer)
print(f"{buffer.tell()} bytes")

buffer.seek(0)
table_from_mem = pq.read_table(buffer)
print(f"{table_from_mem.num_rows} rows")
```

```text
1594 bytes
5 rows
```

#### CSV vs Parquet comparison | size, features, and use cases

```python
csv_file = tmp_dir / "events.csv"
table.to_pandas().to_csv(csv_file, index=False)

csv_size = csv_file.stat().st_size
parquet_size = parquet_file.stat().st_size
print(f"{csv_size} bytes")
print(f"{parquet_size} bytes")
print(f"Ratio:        {csv_size / parquet_size:.1f}x smaller with parquet")
```

```text
214 bytes
1594 bytes
0.1x smaller with parquet
```

| Feature | CSV | Parquet |
|---|---|---|
| Format | Text (row-based) | Binary (columnar) |
| Schema | No (header row only) | Embedded (typed, nullable) |
| Compression | None (manual gzip) | Built-in (snappy/gzip/zstd) |
| Column pruning | No (read all columns) | Yes (read only what you need) |
| Partitioning | Manual (directory naming) | Native (Hive-style) |
| Use case | Simple exchange, legacy | Data lakes, analytics, BigQuery |

## Enterprise Message Serialization

Binary formats provide schema enforcement, cross-language support, and compact serialization (3–10x smaller than JSON).

**Apache Avro** — binary format with embedded schema (self-describing). Schema evolution lets you add/remove fields without breaking consumers. Standard for Kafka messages in data engineering. Python library: `fastavro`. ~50–70% smaller than JSON.

**Protocol Buffers (Protobuf)** — binary format with separate `.proto` schema files. `protoc` compiles schemas into Python/Java/Go/C# classes. Standard for gRPC microservices. ~60–80% smaller than JSON.

> [!warning] Why not JSON or pickle
>
> Why not JSON or pickle at scale?
> - **JSON:** text-based, no schema enforcement, slow to parse at scale
> - **pickle:** Python-only, insecure (arbitrary code execution), no schema — never use in production

> [!success] Use Avro for Kafka, Protobuf for gRPC — both enforce schema
>
> Avro stores the schema in the file/message header — consumers always know the shape of the data. Protobuf uses compiled `.proto` files — ideal for gRPC where both sides share the generated code. Both are cross-language (Python, Java, Go, C#) and 50-80% smaller than equivalent JSON.

| Format | Size | Speed | Schema | Cross-lang | Use case |
|---|---|---|---|---|---|
| JSON | Large | Slow | No | Yes | APIs, config |
| Avro | Small | Fast | Yes | Yes | Kafka, data lakes |
| Protobuf | Small | Fastest | Yes | Yes | gRPC, mobile |
| pickle | Medium | Fast | No | No | Never in prod |
| struct | Tiny | Fastest | Manual | Manual | IoT, binary protocols |

### fastavro | Apache Avro

#### Avro serialization with fastavro | define schema and parse

Avro schemas are defined as JSON dicts with `type`, `name`, `fields`. `fastavro.parse_schema()` validates the schema. Records are plain Python dicts — `fastavro` validates them against the schema on write.

```python
avro_schema = {
    "type": "record",
    "name": "StockQuote",
    "namespace": "stoxx",
    "fields": [
        {"name": "symbol",   "type": "string"},
        {"name": "price",    "type": "double"},
        {"name": "volume",   "type": "long"},
        {"name": "exchange", "type": ["null", "string"], "default": None},
    ],
}

parsed_schema = fastavro.parse_schema(avro_schema)
print(f"{avro_schema['name']} ({len(avro_schema['fields'])} fields)")
for f in avro_schema["fields"]:
    print(f"    {f['name']}: {f['type']}")
```

```text
StockQuote (4 fields)
  symbol: string
  price: double
  volume: long
  exchange: ['null', 'string']
```

#### Write and read Avro file | fastavro.writer with embedded schema

`fastavro.writer` embeds the schema in the file header and writes records as compact binary. `fastavro.reader` discovers the schema from the file header automatically — no external schema file needed.

```python
avro_dir = tempfile.mkdtemp(prefix="avro_py_")
avro_file = os.path.join(avro_dir, "quotes.avro")

records = [
    {"symbol": "SAP.DE",  "price": 166.52, "volume": 82621,  "exchange": "XETR"},
    {"symbol": "ASML.AS", "price": 685.40, "volume": 45000,  "exchange": "XAMS"},
    {"symbol": "TTE.PA",  "price": 58.20,  "volume": 120000, "exchange": "XPAR"},
    {"symbol": "BAS.DE",  "price": 44.85,  "volume": 95000,  "exchange": None},
]

with open(avro_file, "wb") as f:
    fastavro.writer(f, parsed_schema, records)

print(os.path.basename(avro_file))
print(f"Records: {len(records)}, Size: {os.path.getsize(avro_file)} bytes")

with open(avro_file, "rb") as f:
    reader = fastavro.reader(f)
    print(f"  Schema from file: {reader.writer_schema['name']}")  # type: ignore[index]
    for record in reader:
        exch = record["exchange"] or "N/A"  # type: ignore[index]
        print(f"    {record["symbol"]:10} €{record["price"]:>8.2f}  vol={record["volume"]:>8}  exch={exch}")  # type: ignore[index]

shutil.rmtree(avro_dir)
```

Records are plain Python dicts — `fastavro` validates them against the schema on write. The schema is read from the file header automatically on read.

```text
quotes.avro
Records: 4, Size: 399 bytes
Schema from file: stoxx.StockQuote
  SAP.DE     €  166.52  vol=   82621  exch=XETR
  ASML.AS    €  685.40  vol=   45000  exch=XAMS
  TTE.PA     €   58.20  vol=  120000  exch=XPAR
  BAS.DE     €   44.85  vol=   95000  exch=N/A
```

#### Avro in memory and schema evolution | BytesIO for Kafka payloads

Serialize Avro records to `BytesIO` for Kafka producer payloads or API responses without disk I/O. Schema evolution rules: adding a field with a default is safe (backward compatible); changing a field type breaks consumers.

```python
avro_buffer = BytesIO()
fastavro.writer(avro_buffer, parsed_schema, records)
avro_bytes = avro_buffer.getvalue()
print(f"{len(avro_bytes)} bytes ({len(records)} records)")

avro_buffer.seek(0)
mem_records = list(fastavro.reader(avro_buffer))
print(f"{len(mem_records)} records")

json_size = len(json.dumps(records).encode())
print(f"{json_size} bytes")
print(f"{len(avro_bytes)} bytes")
print(f"Savings:    {(1 - len(avro_bytes)/json_size)*100:.0f}%")

```

```text
399 bytes (4 records)
4 records
JSON: 300 bytes
Avro: 399 bytes
Savings: -33%
```

> [!info] Schema evolution rules
>
> - **Safe**: add field with default, remove field with default, add aliases
> - **Unsafe**: change field type, remove field WITHOUT default

### protobuf | Protocol Buffers

#### Protobuf in Python — dynamic message building

In notebooks or dynamic scenarios without `protoc`-generated classes, use `descriptor_pb2` to define the schema at runtime and `_reflection.GeneratedProtocolMessageType` to create a message class. `SerializeToString()` produces the same binary format as `protoc`-generated code.

```python
DESCRIPTOR = descriptor_pb2.FileDescriptorProto(
    name="stock_quote.proto",
    package="stoxx",
    message_type=[
        descriptor_pb2.DescriptorProto(
            name="StockQuote",
            field=[
                descriptor_pb2.FieldDescriptorProto(
                    name="symbol", number=1,
                    type=descriptor_pb2.FieldDescriptorProto.TYPE_STRING,
                    label=descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL,
                ),
                descriptor_pb2.FieldDescriptorProto(
                    name="price", number=2,
                    type=descriptor_pb2.FieldDescriptorProto.TYPE_DOUBLE,
                    label=descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL,
                ),
                descriptor_pb2.FieldDescriptorProto(
                    name="volume", number=3,
                    type=descriptor_pb2.FieldDescriptorProto.TYPE_INT64,
                    label=descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL,
                ),
            ],
        ),
    ],
)

pool = descriptor_pool.DescriptorPool()
file_desc = pool.Add(DESCRIPTOR)
msg_desc = pool.FindMessageTypeByName("stoxx.StockQuote")

factory = _reflection.GeneratedProtocolMessageType(
    "StockQuote",
    (_message.Message,),
    {"DESCRIPTOR": msg_desc, "__module__": "__main__"},
)

quote = factory(symbol="SAP.DE", price=166.52, volume=82621)  # type: ignore[call-arg]
binary = quote.SerializeToString()  # type: ignore[attr-defined]
print(f"Message:    symbol={quote.symbol}, price={quote.price}, volume={quote.volume}")  # type: ignore[attr-defined]
print(f"{len(binary)} bytes ({binary.hex()[:40]}...)")

parsed = factory.FromString(binary)  # type: ignore[attr-defined]
print(f"Parsed:     symbol={parsed.symbol}, price={parsed.price}, volume={parsed.volume}")  # type: ignore[attr-defined]

json_size = len(json.dumps({"symbol": "SAP.DE", "price": 166.52, "volume": 82621}).encode())
print(f"{json_size} bytes")
print(f"{len(binary)} bytes")
print(f"Savings:       {(1 - len(binary)/json_size)*100:.0f}%")
```

```text
Message: symbol=SAP.DE, price=166.52, volume=82621
21 bytes (0a065341502e444511713d0ad7a3d0644018bd85...)
Parsed:  symbol=SAP.DE, price=166.52, volume=82621
JSON:     54 bytes
Protobuf: 21 bytes
Savings:  61%
```

#### Protobuf with protoc (production pattern) | protoc-generated code workflow

In production, define schemas in `.proto` files, compile with `protoc --python_out=.` to generate `_pb2.py` modules, then serialize/deserialize with `SerializeToString()` and `FromString()`. Schema evolution: old code ignores new fields; new code uses defaults for missing fields.

**Step 1 — Define schema** (`stock_quote.proto`). Field numbers are wire identifiers, not default values. Adding new fields (like `exchange = 4`) is backward-compatible — old consumers ignore unknown fields.

```protobuf
syntax = "proto3";
package stoxx;

message StockQuote {
  string symbol = 1;
  double price = 2;
  int64  volume = 3;
  string exchange = 4;
}
```

**Step 2 — Compile** with `protoc` to generate a Python module. The generated `_pb2.py` file contains typed classes with `SerializeToString()` and `FromString()` methods.

```bash
protoc --python_out=. stock_quote.proto
```

This generates `stock_quote_pb2.py` with typed classes.

**Step 3 — Use in Python**. Serialize with `SerializeToString()` (returns bytes for Kafka, gRPC, or file storage) and deserialize with `FromString()`. Schema evolution is automatic — old code ignores field 4 (`exchange`), new code uses the default (`""`) if absent.

```python
from stock_quote_pb2 import StockQuote

quote = StockQuote(symbol="SAP.DE", price=166.52, volume=82621)
data = quote.SerializeToString()

parsed = StockQuote.FromString(data)
print(parsed.symbol, parsed.price)
```

## Format Performance Benchmark

For the architecture-level decision guide on when to use each format across the full pipeline (ingestion, storage, interchange), see [serialization-formats](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/serialization-formats). The benchmarks below focus on Python-specific library performance, while [data-loading-and-export](https://alp78.github.io/elysium/06-GCP/BigQuery/data-loading-and-export) covers how format choice affects BigQuery load throughput.

### Test data and benchmark setup

#### Generate synthetic OHLCV test data — three sizes for benchmarks

Generates synthetic OHLCV (open/high/low/close/volume) data matching the stoxx database schema. Three sizes — 100 (small), 10K (medium), 100K (large) — to show how format overhead scales.

```python
random.seed(42)

symbols = ["SAP.DE","ASML.AS","TTE.PA","BAS.DE","BAYN.DE","BMW.DE","SIE.DE","ALV.DE",
           "ADS.DE","DTE.DE","ENEL.MI","ENI.MI","BNP.PA","MC.PA","OR.PA","AIR.PA",
           "SAN.PA","CS.PA","DG.PA","SU.PA","INGA.AS","AD.AS","PRX.AS","WKL.AS",
           "UCG.MI","ISP.MI","RACE.MI","ABI.BR","ARGX.BR","ITX.MC"]

def generate_data(count: int) -> list[dict]:
    data = []
    for i in range(count):
        close = 50 + random.random() * 200
        opn = close * (0.98 + random.random() * 0.04)
        high = max(opn, close) * (1 + random.random() * 0.02)
        low = min(opn, close) * (1 - random.random() * 0.02)
        data.append({
            "symbol": symbols[i % len(symbols)],
            "date": f"2020-{(i // 30 % 12) + 1:02d}-{(i % 28) + 1:02d}",
            "open": round(opn, 2), "high": round(high, 2),
            "low": round(low, 2), "close": round(close, 2),
            "volume": int(random.random() * 500_000),
        })
    return data

small  = generate_data(100)
medium = generate_data(10_000)
large  = generate_data(100_000)
print(f"Small: {len(small):,}, Medium: {len(medium):,}, Large: {len(large):,}")
```

```text
Small: 100, Medium: 10,000, Large: 100,000
```

### Benchmark execution

#### Format benchmarks — write/read speed across CSV, Parquet, Avro, Protobuf

Benchmarks each format at all three sizes, measuring write time (ms), read time (ms), and file size (bytes). Each format uses its standard Python library: `csv` module, `json` module, `pandas`/`pyarrow` for Parquet, `fastavro` for Avro, and raw wire-format encoding for Protobuf.

```python

bench_dir = tempfile.mkdtemp(prefix="bench_py_")
results = []

def bench(fmt, label, data, write_fn, read_fn):
    path = os.path.join(bench_dir, f"{fmt}_{label}")
    start = time.perf_counter()
    write_fn(path, data)
    write_ms = (time.perf_counter() - start) * 1000
    file_bytes = os.path.getsize(path)
    start = time.perf_counter()
    count = read_fn(path)
    read_ms = (time.perf_counter() - start) * 1000
    results.append((fmt, label, len(data), write_ms, read_ms, file_bytes))

def write_csv(path, data):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=data[0].keys())
        w.writeheader(); w.writerows(data)
def read_csv(path):
    with open(path) as f: return sum(1 for _ in csv.DictReader(f))

def write_json(path, data):
    with open(path, "w") as f: json.dump(data, f)
def read_json(path):
    with open(path) as f: return len(json.load(f))

def write_parquet(path, data):
    pd.DataFrame(data).to_parquet(path, index=False)
def read_parquet(path):
    return len(pq.read_table(path))

bench_avro_schema = fastavro.parse_schema({
    "type": "record", "name": "Ohlcv", "fields": [
        {"name": "symbol", "type": "string"}, {"name": "date", "type": "string"},
        {"name": "open", "type": "double"}, {"name": "high", "type": "double"},
        {"name": "low", "type": "double"}, {"name": "close", "type": "double"},
        {"name": "volume", "type": "long"},
    ]
})
def write_avro(path, data):
    with open(path, "wb") as f: fastavro.writer(f, bench_avro_schema, data)
def read_avro(path):
    with open(path, "rb") as f: return sum(1 for _ in fastavro.reader(f))

def _proto_tag(field_num, wire_type):
    return bytes([(field_num << 3) | wire_type])

def _proto_varint(value):
    out = b''
    while value > 0x7f:
        out += bytes([value & 0x7f | 0x80])
        value >>= 7
    out += bytes([value & 0x7f])
    return out

def write_proto(path, data):
    with open(path, 'wb') as f:
        for r in data:
            msg = b''
            sym = r['symbol'].encode('utf-8')
            msg += _proto_tag(1, 2) + bytes([len(sym)]) + sym
            dt = r['date'].encode('utf-8')
            msg += _proto_tag(2, 2) + bytes([len(dt)]) + dt
            for fnum, key in [(3,'open'),(4,'high'),(5,'low'),(6,'close')]:
                msg += _proto_tag(fnum, 1) + struct.pack('<d', r[key])
            msg += _proto_tag(7, 0) + _proto_varint(r['volume'])
            f.write(len(msg).to_bytes(2, 'big') + msg)

def read_proto(path):
    count = 0
    with open(path, 'rb') as f:
        while True:
            lb = f.read(2)
            if len(lb) < 2: break
            f.read(int.from_bytes(lb, 'big'))
            count += 1
    return count

for label, data in [("small", small), ("medium", medium), ("large", large)]:
    for fmt, wfn, rfn, ext in [
        ("CSV", write_csv, read_csv, ".csv"),
        ("JSON", write_json, read_json, ".json"),
        ("Parquet", write_parquet, read_parquet, ".parquet"),
        ("Avro", write_avro, read_avro, ".avro"),
        ("Protobuf", write_proto, read_proto, ".bin"),
    ]:
        bench(fmt, label + ext, data, wfn, rfn)

```

### Results and analysis

#### Benchmark results — write/read performance matrix

```python

df_bench = pd.DataFrame(results, columns=["Format", "File", "Records", "Write_ms", "Read_ms", "Bytes"])
df_bench["Bucket"] = df_bench["File"].str.extract(r"(small|medium|large)")
df_bench["File_Size"] = df_bench["Bytes"].apply(
    lambda b: f"{b} B" if b < 1024 else f"{b/1024:.1f} KB" if b < 1024**2 else f"{b/1024**2:.1f} MB")
df_bench["Bytes/Rec"] = df_bench["Bytes"] // df_bench["Records"]
df_bench["Write_ms"] = df_bench["Write_ms"].round(0).astype(int)
df_bench["Read_ms"] = df_bench["Read_ms"].round(0).astype(int)

bucket_order = {"large": 0, "medium": 1, "small": 2}
df_out = (df_bench[["Format", "Records", "File_Size", "Bytes/Rec", "Write_ms", "Read_ms", "Bucket"]]
    .assign(_sort=df_bench["Bucket"].map(bucket_order))
    .sort_values(["_sort", "Bytes/Rec"]).drop(columns="_sort").reset_index(drop=True))

rows = []
prev_bucket = None
for _, row in df_out.iterrows():
    if row["Bucket"] != prev_bucket:
        sep = pd.Series({c: "" for c in df_out.columns})
        sep["Format"] = f"\u2501\u2501 {row['Records']:,} records \u2501\u2501"
        rows.append(sep)
        prev_bucket = row["Bucket"]
    rows.append(row)

df_display = pd.DataFrame(rows).reset_index(drop=True)

def highlight(df):
    styles = pd.DataFrame("", index=df.index, columns=df.columns)
    # Find separator row indices to define groups
    sep_idxs = df.index[df["Records"] == ""].tolist() + [len(df)]
    for g in range(len(sep_idxs) - 1):
        start = sep_idxs[g] + 1
        end = sep_idxs[g + 1]
        group = df.iloc[start:end]
        for col in ["Bytes/Rec", "Write_ms", "Read_ms"]:
            vals = pd.to_numeric(group[col], errors="coerce")
            positive = vals[vals > 0]
            if len(positive) > 0:
                styles.iloc[positive.idxmin(), styles.columns.get_loc(col)] = "background-color:#2e7d32;color:#fff"
                styles.iloc[vals.idxmax(), styles.columns.get_loc(col)] = "background-color:#c62828;color:#fff"
    for idx in sep_idxs[:-1]:
        for col in styles.columns:
            styles.iloc[idx, styles.columns.get_loc(col)] = "font-weight:bold;border-top:2px solid #888"
    return styles

display(
    df_display.drop(columns="Bucket")
    .style.apply(highlight, axis=None)
    .set_caption("Format Performance Benchmark — green = best, red = worst per bucket")
    .hide(axis="index")
)
```

<table id="T_6866c">
  <caption>Format Performance Benchmark — green = best, red = worst per bucket</caption>
  <thead>
    <tr>
      <th id="T_6866c_level0_col0" class="col_heading level0 col0" >Format</th>
      <th id="T_6866c_level0_col1" class="col_heading level0 col1" >Records</th>
      <th id="T_6866c_level0_col2" class="col_heading level0 col2" >File_Size</th>
      <th id="T_6866c_level0_col3" class="col_heading level0 col3" >Bytes/Rec</th>
      <th id="T_6866c_level0_col4" class="col_heading level0 col4" >Write_ms</th>
      <th id="T_6866c_level0_col5" class="col_heading level0 col5" >Read_ms</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td id="T_6866c_row0_col0" class="data row0 col0" >━━ 100,000 records ━━</td>
      <td id="T_6866c_row0_col1" class="data row0 col1" ></td>
      <td id="T_6866c_row0_col2" class="data row0 col2" ></td>
      <td id="T_6866c_row0_col3" class="data row0 col3" ></td>
      <td id="T_6866c_row0_col4" class="data row0 col4" ></td>
      <td id="T_6866c_row0_col5" class="data row0 col5" ></td>
    </tr>
    <tr>
      <td id="T_6866c_row1_col0" class="data row1 col0" >Parquet</td>
      <td id="T_6866c_row1_col1" class="data row1 col1" >100000</td>
      <td id="T_6866c_row1_col2" class="data row1 col2" >1.7 MB</td>
      <td id="T_6866c_row1_col3" class="data row1 col3" >17</td>
      <td id="T_6866c_row1_col4" class="data row1 col4" >70</td>
      <td id="T_6866c_row1_col5" class="data row1 col5" >8</td>
    </tr>
    <tr>
      <td id="T_6866c_row2_col0" class="data row2 col0" >CSV</td>
      <td id="T_6866c_row2_col1" class="data row2 col1" >100000</td>
      <td id="T_6866c_row2_col2" class="data row2 col2" >5.0 MB</td>
      <td id="T_6866c_row2_col3" class="data row2 col3" >52</td>
      <td id="T_6866c_row2_col4" class="data row2 col4" >218</td>
      <td id="T_6866c_row2_col5" class="data row2 col5" >115</td>
    </tr>
    <tr>
      <td id="T_6866c_row3_col0" class="data row3 col0" >Avro</td>
      <td id="T_6866c_row3_col1" class="data row3 col1" >100000</td>
      <td id="T_6866c_row3_col2" class="data row3 col2" >5.1 MB</td>
      <td id="T_6866c_row3_col3" class="data row3 col3" >53</td>
      <td id="T_6866c_row3_col4" class="data row3 col4" >123</td>
      <td id="T_6866c_row3_col5" class="data row3 col5" >102</td>
    </tr>
    <tr>
      <td id="T_6866c_row4_col0" class="data row4 col0" >Protobuf</td>
      <td id="T_6866c_row4_col1" class="data row4 col1" >100000</td>
      <td id="T_6866c_row4_col2" class="data row4 col2" >5.9 MB</td>
      <td id="T_6866c_row4_col3" class="data row4 col3" >61</td>
      <td id="T_6866c_row4_col4" class="data row4 col4" >184</td>
      <td id="T_6866c_row4_col5" class="data row4 col5" >21</td>
    </tr>
    <tr>
      <td id="T_6866c_row5_col0" class="data row5 col0" >JSON</td>
      <td id="T_6866c_row5_col1" class="data row5 col1" >100000</td>
      <td id="T_6866c_row5_col2" class="data row5 col2" >11.9 MB</td>
      <td id="T_6866c_row5_col3" class="data row5 col3" >124</td>
      <td id="T_6866c_row5_col4" class="data row5 col4" >716</td>
      <td id="T_6866c_row5_col5" class="data row5 col5" >102</td>
    </tr>
    <tr>
      <td id="T_6866c_row6_col0" class="data row6 col0" >━━ 10,000 records ━━</td>
      <td id="T_6866c_row6_col1" class="data row6 col1" ></td>
      <td id="T_6866c_row6_col2" class="data row6 col2" ></td>
      <td id="T_6866c_row6_col3" class="data row6 col3" ></td>
      <td id="T_6866c_row6_col4" class="data row6 col4" ></td>
      <td id="T_6866c_row6_col5" class="data row6 col5" ></td>
    </tr>
    <tr>
      <td id="T_6866c_row7_col0" class="data row7 col0" >Parquet</td>
      <td id="T_6866c_row7_col1" class="data row7 col1" >10000</td>
      <td id="T_6866c_row7_col2" class="data row7 col2" >280.9 KB</td>
      <td id="T_6866c_row7_col3" class="data row7 col3" >28</td>
      <td id="T_6866c_row7_col4" class="data row7 col4" >13</td>
      <td id="T_6866c_row7_col5" class="data row7 col5" >6</td>
    </tr>
    <tr>
      <td id="T_6866c_row8_col0" class="data row8 col0" >CSV</td>
      <td id="T_6866c_row8_col1" class="data row8 col1" >10000</td>
      <td id="T_6866c_row8_col2" class="data row8 col2" >511.7 KB</td>
      <td id="T_6866c_row8_col3" class="data row8 col3" >52</td>
      <td id="T_6866c_row8_col4" class="data row8 col4" >25</td>
      <td id="T_6866c_row8_col5" class="data row8 col5" >22</td>
    </tr>
    <tr>
      <td id="T_6866c_row9_col0" class="data row9 col0" >Avro</td>
      <td id="T_6866c_row9_col1" class="data row9 col1" >10000</td>
      <td id="T_6866c_row9_col2" class="data row9 col2" >518.5 KB</td>
      <td id="T_6866c_row9_col3" class="data row9 col3" >53</td>
      <td id="T_6866c_row9_col4" class="data row9 col4" >12</td>
      <td id="T_6866c_row9_col5" class="data row9 col5" >18</td>
    </tr>
    <tr>
      <td id="T_6866c_row10_col0" class="data row10 col0" >Protobuf</td>
      <td id="T_6866c_row10_col1" class="data row10 col1" >10000</td>
      <td id="T_6866c_row10_col2" class="data row10 col2" >605.1 KB</td>
      <td id="T_6866c_row10_col3" class="data row10 col3" >61</td>
      <td id="T_6866c_row10_col4" class="data row10 col4" >23</td>
      <td id="T_6866c_row10_col5" class="data row10 col5" >5</td>
    </tr>
    <tr>
      <td id="T_6866c_row11_col0" class="data row11 col0" >JSON</td>
      <td id="T_6866c_row11_col1" class="data row11 col1" >10000</td>
      <td id="T_6866c_row11_col2" class="data row11 col2" >1.2 MB</td>
      <td id="T_6866c_row11_col3" class="data row11 col3" >124</td>
      <td id="T_6866c_row11_col4" class="data row11 col4" >67</td>
      <td id="T_6866c_row11_col5" class="data row11 col5" >13</td>
    </tr>
    <tr>
      <td id="T_6866c_row12_col0" class="data row12 col0" >━━ 100 records ━━</td>
      <td id="T_6866c_row12_col1" class="data row12 col1" ></td>
      <td id="T_6866c_row12_col2" class="data row12 col2" ></td>
      <td id="T_6866c_row12_col3" class="data row12 col3" ></td>
      <td id="T_6866c_row12_col4" class="data row12 col4" ></td>
      <td id="T_6866c_row12_col5" class="data row12 col5" ></td>
    </tr>
    <tr>
      <td id="T_6866c_row13_col0" class="data row13 col0" >CSV</td>
      <td id="T_6866c_row13_col1" class="data row13 col1" >100</td>
      <td id="T_6866c_row13_col2" class="data row13 col2" >5.1 KB</td>
      <td id="T_6866c_row13_col3" class="data row13 col3" >52</td>
      <td id="T_6866c_row13_col4" class="data row13 col4" >1</td>
      <td id="T_6866c_row13_col5" class="data row13 col5" >1</td>
    </tr>
    <tr>
      <td id="T_6866c_row14_col0" class="data row14 col0" >Avro</td>
      <td id="T_6866c_row14_col1" class="data row14 col1" >100</td>
      <td id="T_6866c_row14_col2" class="data row14 col2" >5.5 KB</td>
      <td id="T_6866c_row14_col3" class="data row14 col3" >56</td>
      <td id="T_6866c_row14_col4" class="data row14 col4" >0</td>
      <td id="T_6866c_row14_col5" class="data row14 col5" >5</td>
    </tr>
    <tr>
      <td id="T_6866c_row15_col0" class="data row15 col0" >Protobuf</td>
      <td id="T_6866c_row15_col1" class="data row15 col1" >100</td>
      <td id="T_6866c_row15_col2" class="data row15 col2" >6.1 KB</td>
      <td id="T_6866c_row15_col3" class="data row15 col3" >61</td>
      <td id="T_6866c_row15_col4" class="data row15 col4" >0</td>
      <td id="T_6866c_row15_col5" class="data row15 col5" >1</td>
    </tr>
    <tr>
      <td id="T_6866c_row16_col0" class="data row16 col0" >Parquet</td>
      <td id="T_6866c_row16_col1" class="data row16 col1" >100</td>
      <td id="T_6866c_row16_col2" class="data row16 col2" >8.3 KB</td>
      <td id="T_6866c_row16_col3" class="data row16 col3" >84</td>
      <td id="T_6866c_row16_col4" class="data row16 col4" >3</td>
      <td id="T_6866c_row16_col5" class="data row16 col5" >5</td>
    </tr>
    <tr>
      <td id="T_6866c_row17_col0" class="data row17 col0" >JSON</td>
      <td id="T_6866c_row17_col1" class="data row17 col1" >100</td>
      <td id="T_6866c_row17_col2" class="data row17 col2" >12.1 KB</td>
      <td id="T_6866c_row17_col3" class="data row17 col3" >124</td>
      <td id="T_6866c_row17_col4" class="data row17 col4" >1</td>
      <td id="T_6866c_row17_col5" class="data row17 col5" >6</td>
    </tr>
  </tbody>
</table>

#### Write vs Read speed chart — Plotly grouped bar

```python

colors = {"CSV": "#4285F4", "JSON": "#FBBC05", "Parquet": "#34A853", "Avro": "#EA4335", "Protobuf": "#9C27B0"}
large = df_bench[df_bench["Bucket"] == "large"].sort_values("Bytes")

fig = make_subplots(rows=1, cols=2, subplot_titles=("Write Time (ms)", "Read Time (ms)"))
for _, row in large.iterrows():
    fig.add_trace(go.Bar(name=row["Format"], x=[row["Format"]], y=[row["Write_ms"]],
                         marker_color=colors.get(row["Format"], "#999"), showlegend=False), row=1, col=1)
    fig.add_trace(go.Bar(name=row["Format"], x=[row["Format"]], y=[row["Read_ms"]],
                         marker_color=colors.get(row["Format"], "#999"), showlegend=False), row=1, col=2)

fig.update_layout(title_text="Read/Write Performance — 100K Records",
                  height=400, template="plotly_dark", bargap=0.3)
fig.show()
```

<iframe src="/static/plotly/pyser_01.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### Compression comparison — file size per format for large tier

```python

csv_bytes = df_bench[(df_bench["Format"] == "CSV") & (df_bench["Bucket"] == "large")]["Bytes"].iloc[0]
comp = df_bench[df_bench["Bucket"] == "large"][["Format", "Bytes"]].sort_values("Bytes").copy()
comp["vs_CSV"] = ((1 - comp["Bytes"] / csv_bytes) * 100).round(1).apply(lambda x: f"{x:+.1f}%")
comp["File_Size"] = comp["Bytes"].apply(
    lambda b: f"{b/1024**2:.1f} MB" if b >= 1024**2 else f"{b/1024:.1f} KB")
comp["Size_MB"] = (comp["Bytes"] / 1024**2).round(2)

display(
    comp[["Format", "File_Size", "vs_CSV"]]
    .style
    .set_caption("Compression vs CSV — 100K records (large bucket)")
    .hide(axis="index")
)
```

<table id="T_1b570">
  <caption>Compression vs CSV — 100K records (large bucket)</caption>
  <thead>
    <tr>
      <th id="T_1b570_level0_col0" class="col_heading level0 col0" >Format</th>
      <th id="T_1b570_level0_col1" class="col_heading level0 col1" >File_Size</th>
      <th id="T_1b570_level0_col2" class="col_heading level0 col2" >vs_CSV</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td id="T_1b570_row0_col0" class="data row0 col0" >Parquet</td>
      <td id="T_1b570_row0_col1" class="data row0 col1" >1.7 MB</td>
      <td id="T_1b570_row0_col2" class="data row0 col2" >+65.9%</td>
    </tr>
    <tr>
      <td id="T_1b570_row1_col0" class="data row1 col0" >CSV</td>
      <td id="T_1b570_row1_col1" class="data row1 col1" >5.0 MB</td>
      <td id="T_1b570_row1_col2" class="data row1 col2" >+0.0%</td>
    </tr>
    <tr>
      <td id="T_1b570_row2_col0" class="data row2 col0" >Avro</td>
      <td id="T_1b570_row2_col1" class="data row2 col1" >5.1 MB</td>
      <td id="T_1b570_row2_col2" class="data row2 col2" >-1.3%</td>
    </tr>
    <tr>
      <td id="T_1b570_row3_col0" class="data row3 col0" >Protobuf</td>
      <td id="T_1b570_row3_col1" class="data row3 col1" >5.9 MB</td>
      <td id="T_1b570_row3_col2" class="data row3 col2" >-18.3%</td>
    </tr>
    <tr>
      <td id="T_1b570_row4_col0" class="data row4 col0" >JSON</td>
      <td id="T_1b570_row4_col1" class="data row4 col1" >11.9 MB</td>
      <td id="T_1b570_row4_col2" class="data row4 col2" >-137.5%</td>
    </tr>
  </tbody>
</table>

#### File size bar chart — Plotly horizontal bars

```python

colors_list = [colors.get(f, "#999") for f in comp["Format"]]
fig2 = go.Figure(go.Bar(
    x=comp["Size_MB"].values,
    y=comp["Format"].values,
    orientation="h",
    marker_color=colors_list,
    text=comp.apply(lambda r: f"{r['File_Size']} ({r['vs_CSV']})", axis=1),
    textposition="outside",
))
fig2.update_layout(
    title="File Size Comparison — 100K Records",
    xaxis_title="Size (MB)",
    yaxis=dict(autorange="reversed"),
    height=350,
    template="plotly_dark",
    margin=dict(r=120),
)
fig2.show()
```

<iframe src="/static/plotly/pyser_02.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### Recommendation matrix | best format for each scenario

| Scenario | Best Format | Why |
|---|---|---|
| Data lake / analytics queries | Parquet | Columnar: read 2 of 50 columns = skip 96% of data |
| Kafka event streaming | Avro | Schema embedded, schema registry, compact |
| gRPC microservices | Protobuf | Fastest parse, smallest size, code-generated types |
| REST API responses | JSON | Human-readable, universal, self-describing |
| Config files | JSON / YAML | Human-editable, comments (YAML), versioned in git |
| Legacy data warehouse export | CSV | Universal, every tool reads it |
| Debug / logging | JSON | Human-readable, structured, grep-friendly |
| High-freq trading feed | Protobuf | Lowest latency, smallest payload |
| ML feature store | Parquet | Column pruning, predicate pushdown, partitioned |
| Cross-language IPC | Protobuf/Avro | Protobuf for speed, Avro for schema |
| Batch ETL intermediate | Parquet | Compressed, typed, Spark/BigQuery/Polars |
| Small config payloads (<1KB) | JSON | Binary format overhead not worth it |
| Browser / mobile API | JSON + gzip | Universal client support |

> [!tip] Rankings
>
> **Size** (smallest → largest): Protobuf < Parquet < Avro < CSV < JSON
> **Speed** (fastest → slowest): Protobuf > CSV > Parquet > Avro > JSON

```python
shutil.rmtree(bench_dir)
```

## Warnings

> [!warning] Parquet is not streamable
>
> Parquet requires reading the footer (at the end of the file) before accessing any data. You cannot write partial Parquet files or stream rows one at a time.

> [!success] Correct pattern
>
> Use Avro for streaming/append workloads. Use Parquet for batch analytics where the entire file is written and read as a unit.

> [!warning] Protobuf schema not embedded in data
>
> Unlike Avro and Parquet, Protobuf messages contain no schema — the receiver must have the `.proto` file to decode. Schema mismatch produces silent data corruption.

> [!success] Correct pattern
>
> Use a schema registry (Confluent, Buf) for versioned schemas. Always test backward/forward compatibility before deploying schema changes.

> [!warning] Avro schema changes can break consumers
>
> Removing a field without a default value, or changing a field's type, breaks existing readers.

> [!success] Correct pattern
>
> Always add new fields with default values. Mark removed fields as deprecated rather than deleting. Use Avro's schema resolution rules for forward/backward compatibility.

## Recommendations

- **Use Parquet for data lakes and analytical storage** — columnar layout, compression, predicate pushdown, schema embedded.
- **Use Avro for Kafka and streaming** — schema embedded, schema evolution, compact, streaming-friendly.
- **Use Protobuf for gRPC and low-latency IPC** — smallest payload, fastest parse, strongly typed.
- **Use JSON for APIs and human-readable interchange** — universal support, self-describing, debuggable.
- **Use CSV only for legacy interchange** — no types, no schema, no nesting, no compression. Prefer Parquet for anything analytical.
- **Choose compression by workload** — Snappy for speed (real-time), Zstd for balance (ETL), Gzip for maximum compression (archival).
- **Test schema evolution before deploying** — add fields with defaults, never rename, use compatibility checks.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Parquet read only returns some columns | Column pruning is working as intended | Specify all needed columns in `columns=` parameter |
| Avro deserialization fails after schema change | Incompatible schema evolution (removed required field) | Add default values to new fields; don't remove required fields |
| Protobuf message is empty/zero-length | Serialized with wrong schema or all fields are default values | Check `.proto` field numbers match; Protobuf omits default values by design |
| Parquet file much larger than expected | Wrong compression codec or no compression | Set `compression='zstd'` or `compression='snappy'` |
| `fastavro` raises `SchemaParseException` | Avro schema JSON is malformed | Validate schema against Avro spec; check field types and names |

