---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [serialization formats, JSON, CSV, Parquet, Avro, Protocol Buffers]
keywords: [serialization, JSON, CSV, Parquet, Avro, protobuf, msgpack, pickle, arrow, feather, data formats, schema evolution, compression]
description: "Python serialization formats reference with executable examples and cell outputs — covers JSON, CSV, Parquet, Avro, Protocol Buffers, MessagePack, and format comparison benchmarks. See [10_cs_serialization_formats](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/10_cs_serialization_formats) for the C# equivalent."
created: 2026-03-25
updated: 2026-03-25
status: complete
---

# 10. Serialization Formats - Python

> [!quote]
> "Write programs to handle text streams, because that is a universal interface."
>
> — **Doug McIlroy**, *Bell System Technical Journal* (1978)

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

    <function __main__.<lambda>(s)>

## Parquet Files

#### Parquet overview — columnar format for analytics

Parquet stores data **column-by-column** with per-column compression (snappy, gzip, zstd). Schema is embedded in the file footer — self-describing, no separate schema file needed. Supports column pruning (projection pushdown), predicate pushdown, and partitioning. 5-10x smaller than CSV. Standard in data lakes (GCS, S3, ADLS), BigQuery, Spark, DuckDB, Athena. Use `pyarrow` for parquet I/O in Python.

> [!warning] When NOT to use Parquet
>
> - **Small files** (<1MB) — Parquet overhead exceeds benefit
> - **Frequent appends** — Parquet is immutable; use Avro/JSONL for streaming
> - **Simple data exchange** — CSV is more universal

```python
tmp_dir = Path(tempfile.mkdtemp(prefix="parquet_"))
```

#### pyarrow pq.write_table — write Parquet from Arrow table

```python
# Write parquet from Arrow table — column-oriented creation

print("=== Write parquet from Arrow table ===")
# Data Engineering scenario: write pipeline output to a parquet file in a data lake.

# Step 1: Define the schema (column names and types)
# Arrow types: pa.string(), pa.int64(), pa.float64(), pa.bool_(), pa.timestamp('us'), etc.
schema = pa.schema([
    ("event_id", pa.string()),
    ("event_type", pa.string()),
    ("user_id", pa.int64()),
    ("revenue", pa.float64()),
    ("is_mobile", pa.bool_()),
])

# Step 2: Create an Arrow table from column arrays
# Each column is a pa.array — typed, nullable, and efficient.
table = pa.table({
    "event_id":   ["evt_001", "evt_002", "evt_003", "evt_004", "evt_005"],
    "event_type": ["page_view", "purchase", "page_view", "signup", "purchase"],
    "user_id":    [1001, 1002, 1001, 1003, 1002],
    "revenue":    [0.0, 49.99, 0.0, 0.0, 129.99],
    "is_mobile":  [True, False, True, True, False],
}, schema=schema)

# Step 3: Write to parquet file
parquet_file = tmp_dir / "events.parquet"
pq.write_table(table, parquet_file, compression="snappy")
#   compression options: 'snappy' (default, fast), 'gzip' (smaller), 'zstd' (best ratio), 'none'

print(f"  Written: {parquet_file.name}")
print(f"  Size: {parquet_file.stat().st_size} bytes (compressed)")
print(f"  Rows: {table.num_rows}, Columns: {table.num_columns}")

# ─────────────────────────────────────────────
# READ PARQUET
# ─────────────────────────────────────────────
```

    === Write parquet from Arrow table ===
      Written: events.parquet
      Size: 1594 bytes (compressed)
      Rows: 5, Columns: 5

#### pyarrow pq.read_table — read entire Parquet file

```python
# Read entire parquet file — schema discovery and full table load

print("\n=== Read entire parquet file ===")

table_read = pq.read_table(parquet_file)  # returns an Arrow table
print(f"  Schema:\n{table_read.schema}")
print(f"\n  Data:\n{table_read.to_pandas()}")  # convert to pandas DataFrame for display
```

    
    === Read entire parquet file ===
      Schema:
    event_id: string
    event_type: string
    user_id: int64
    revenue: double
    is_mobile: bool
    
      Data:
      event_id event_type  user_id  revenue  is_mobile
    0  evt_001  page_view     1001     0.00       True
    1  evt_002   purchase     1002    49.99      False
    2  evt_003  page_view     1001     0.00       True
    3  evt_004     signup     1003     0.00       True
    4  evt_005   purchase     1002   129.99      False

#### pyarrow pq.read_table columns= — column pruning

```python
# Column pruning — read only selected columns from parquet

print("\n=== Column pruning (read only selected columns) ===")
# Data Engineering key feature: only read the columns you need.
# On a 100-column table, this can be 50x faster than CSV.

partial = pq.read_table(parquet_file, columns=["event_id", "revenue"])
print(f"  Columns read: {partial.column_names}")
print(f"  Revenue total: {partial.column('revenue').to_pylist()}")  # Arrow column → Python list
print(f"  Sum: {sum(partial.column('revenue').to_pylist()):.2f}")
```

    
    === Column pruning (read only selected columns) ===
      Columns read: ['event_id', 'revenue']
      Revenue total: [0.0, 49.99, 0.0, 0.0, 129.99]
      Sum: 179.98

#### pyarrow pq.read_table filters= — predicate pushdown

```python
# Predicate pushdown — filter rows at read time via row group statistics

filtered = pq.read_table(
    parquet_file,
    filters=[("event_type", "==", "purchase")]
)
print(f"  Purchases only ({filtered.num_rows} rows):")
print(f"  {filtered.to_pandas()}")

# Metadata — read schema and row count without loading data (instant, even for huge files)
meta = pq.read_metadata(parquet_file)
print(f"Rows: {meta.num_rows}, Columns: {meta.num_columns}, Row groups: {meta.num_row_groups}")

schema_read = pq.read_schema(parquet_file)
print(f"  Schema:")
for i, field in enumerate(schema_read):
    print(f"    [{i}] {field.name}: {field.type}")
```

      Purchases only (2 rows):
        event_id event_type  user_id  revenue  is_mobile
    0  evt_002   purchase     1002    49.99      False
    1  evt_005   purchase     1002   129.99      False
    Rows: 5, Columns: 5, Row groups: 1
      Schema:
        [0] event_id: string
        [1] event_type: string
        [2] user_id: int64
        [3] revenue: double
        [4] is_mobile: bool

#### pyarrow pq.write_to_dataset — Hive-style partitioning

```python
# Hive-style partitioning — split files into subdirectories by column value

partitioned_dir = tmp_dir / "events_partitioned"
pq.write_to_dataset(
    table,
    root_path=str(partitioned_dir),
    partition_cols=["event_type"],
)

print("  Partitioned dir structure:")
for f in sorted(partitioned_dir.rglob("*.parquet")):
    rel = f.relative_to(partitioned_dir)
    print(f"    {rel} ({f.stat().st_size} bytes)")

# Read back — pyarrow discovers partitions automatically
dataset = pq.read_table(str(partitioned_dir))
print(f"Read back: {dataset.num_rows} rows, columns: {dataset.column_names}")
```

      Partitioned dir structure:
        event_type=page_view\9f62ef0dd3b74960a0f065356a69591c-0.parquet (1266 bytes)
        event_type=purchase\9f62ef0dd3b74960a0f065356a69591c-0.parquet (1274 bytes)
        event_type=signup\9f62ef0dd3b74960a0f065356a69591c-0.parquet (1255 bytes)
    Read back: 5 rows, columns: ['event_id', 'user_id', 'revenue', 'is_mobile', 'event_type']

#### Parquet in memory — BytesIO

```python
# Parquet in memory — BytesIO for cloud upload without temp files

buffer = BytesIO()
pq.write_table(table, buffer)
print(f"  Buffer size: {buffer.tell()} bytes")

# Read back from the same buffer
buffer.seek(0)
table_from_mem = pq.read_table(buffer)
print(f"  Read from memory: {table_from_mem.num_rows} rows")
```

      Buffer size: 1594 bytes
      Read from memory: 5 rows

#### CSV vs Parquet comparison

```python
# CSV vs Parquet comparison — size, features, and use cases

csv_file = tmp_dir / "events.csv"
table.to_pandas().to_csv(csv_file, index=False)

csv_size = csv_file.stat().st_size
parquet_size = parquet_file.stat().st_size
print(f"  CSV size:     {csv_size} bytes")
print(f"  Parquet size: {parquet_size} bytes")
print(f"  Ratio:        {csv_size / parquet_size:.1f}x smaller with parquet")

print("""
Feature              CSV                         Parquet
──────────────────────────────────────────────────────────────
Format               Text (row-based)            Binary (columnar)
Schema               No (header row only)        Embedded (typed, nullable)
Compression          None (manual gzip)          Built-in (snappy/gzip/zstd)
Column pruning       No (read all columns)       Yes (read only what you need)
Partitioning         Manual (directory naming)    Native (Hive-style)
Use case             Simple exchange, legacy      Data lakes, analytics, BigQuery
""")
```

      CSV size:     214 bytes
      Parquet size: 1594 bytes
      Ratio:        0.1x smaller with parquet
    
    Feature              CSV                         Parquet
    ──────────────────────────────────────────────────────────────
    Format               Text (row-based)            Binary (columnar)
    Schema               No (header row only)        Embedded (typed, nullable)
    Compression          None (manual gzip)          Built-in (snappy/gzip/zstd)
    Column pruning       No (read all columns)       Yes (read only what you need)
    Partitioning         Manual (directory naming)    Native (Hive-style)
    Use case             Simple exchange, legacy      Data lakes, analytics, BigQuery

## Enterprise Message Serialization

Binary formats provide schema enforcement, cross-language support, and compact serialization (3–10x smaller than JSON).

**Apache Avro** — binary format with embedded schema (self-describing). Schema evolution lets you add/remove fields without breaking consumers. Standard for Kafka messages in data engineering. Python library: `fastavro`. ~50–70% smaller than JSON.

**Protocol Buffers (Protobuf)** — binary format with separate `.proto` schema files. `protoc` compiles schemas into Python/Java/Go/C# classes. Standard for gRPC microservices. ~60–80% smaller than JSON.

> [!warning] Why not JSON or pickle
>
> Why not JSON or pickle at scale?
> - **JSON:** text-based, no schema enforcement, slow to parse at scale
> - **pickle:** Python-only, insecure (arbitrary code execution), no schema — never use in production

| Format | Size | Speed | Schema | Cross-lang | Use case |
|---|---|---|---|---|---|
| JSON | Large | Slow | No | Yes | APIs, config |
| Avro | Small | Fast | Yes | Yes | Kafka, data lakes |
| Protobuf | Small | Fastest | Yes | Yes | gRPC, mobile |
| pickle | Medium | Fast | No | No | Never in prod |
| struct | Tiny | Fastest | Manual | Manual | IoT, binary protocols |

#### Avro serialization with fastavro

```python
# Apache Avro with fastavro — binary serialization with embedded schema

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

# Parse and validate the schema
parsed_schema = fastavro.parse_schema(avro_schema)
print(f"  Schema: {avro_schema['name']} ({len(avro_schema['fields'])} fields)")
for f in avro_schema["fields"]:
    print(f"    {f['name']}: {f['type']}")
```

      Schema: StockQuote (4 fields)
        symbol: string
        price: double
        volume: long
        exchange: ['null', 'string']

#### Write and read Avro file

```python
# Write and read Avro file — records with embedded schema

avro_dir = tempfile.mkdtemp(prefix="avro_py_")
avro_file = os.path.join(avro_dir, "quotes.avro")

# Records as plain Python dicts — fastavro validates against the schema
records = [
    {"symbol": "SAP.DE",  "price": 166.52, "volume": 82621,  "exchange": "XETR"},
    {"symbol": "ASML.AS", "price": 685.40, "volume": 45000,  "exchange": "XAMS"},
    {"symbol": "TTE.PA",  "price": 58.20,  "volume": 120000, "exchange": "XPAR"},
    {"symbol": "BAS.DE",  "price": 44.85,  "volume": 95000,  "exchange": None},  # nullable
]

# Write — fastavro.writer embeds the schema in the file header
with open(avro_file, "wb") as f:
    fastavro.writer(f, parsed_schema, records)

print(f"  Written: {os.path.basename(avro_file)}")
print(f"  Records: {len(records)}, Size: {os.path.getsize(avro_file)} bytes")

# Read — schema is read from the file header automatically
with open(avro_file, "rb") as f:
    reader = fastavro.reader(f)
    print(f"  Schema from file: {reader.writer_schema['name']}")  # type: ignore[index]
    for record in reader:
        exch = record["exchange"] or "N/A"  # type: ignore[index]
        print(f"    {record["symbol"]:10} €{record["price"]:>8.2f}  vol={record["volume"]:>8}  exch={exch}")  # type: ignore[index]

shutil.rmtree(avro_dir)
```

      Written: quotes.avro
      Records: 4, Size: 399 bytes
      Schema from file: stoxx.StockQuote
        SAP.DE     €  166.52  vol=   82621  exch=XETR
        ASML.AS    €  685.40  vol=   45000  exch=XAMS
        TTE.PA     €   58.20  vol=  120000  exch=XPAR
        BAS.DE     €   44.85  vol=   95000  exch=N/A

#### Avro in memory and schema evolution

```python
# Avro in memory and schema evolution — BytesIO and field addition

# Avro in memory — serialize to BytesIO for Kafka or API payloads
avro_buffer = BytesIO()
fastavro.writer(avro_buffer, parsed_schema, records)
avro_bytes = avro_buffer.getvalue()
print(f"  Avro in memory: {len(avro_bytes)} bytes ({len(records)} records)")

# Read back from memory
avro_buffer.seek(0)
mem_records = list(fastavro.reader(avro_buffer))
print(f"  Read from memory: {len(mem_records)} records")

# Compare sizes
json_size = len(json.dumps(records).encode())
print(f"\n  JSON size:  {json_size} bytes")
print(f"  Avro size:  {len(avro_bytes)} bytes")
print(f"  Savings:    {(1 - len(avro_bytes)/json_size)*100:.0f}%")

# Schema evolution rules
print("""
  Schema Evolution Rules:
    SAFE:   add field with default, remove field with default, add aliases
    UNSAFE: change field type, remove field WITHOUT default
""")
```

      Avro in memory: 399 bytes (4 records)
      Read from memory: 4 records
    
      JSON size:  300 bytes
      Avro size:  399 bytes
      Savings:    -33%
    
      Schema Evolution Rules:
        SAFE:   add field with default, remove field with default, add aliases
        UNSAFE: change field type, remove field WITHOUT default

#### Protobuf in Python — manual message building

```python
# Protobuf in Python — manual message building with struct

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

# Register the descriptor and create a message class
pool = descriptor_pool.DescriptorPool()
file_desc = pool.Add(DESCRIPTOR)
msg_desc = pool.FindMessageTypeByName("stoxx.StockQuote")

factory = _reflection.GeneratedProtocolMessageType(
    "StockQuote",
    (_message.Message,),
    {"DESCRIPTOR": msg_desc, "__module__": "__main__"},
)

# Create a message, serialize, deserialize
quote = factory(symbol="SAP.DE", price=166.52, volume=82621)  # type: ignore[call-arg]  # fields are dynamic (runtime reflection)
binary = quote.SerializeToString()  # type: ignore[attr-defined]
print(f"  Message:    symbol={quote.symbol}, price={quote.price}, volume={quote.volume}")  # type: ignore[attr-defined]
print(f"  Binary:     {len(binary)} bytes ({binary.hex()[:40]}...)")

# Deserialize from bytes
parsed = factory.FromString(binary)  # type: ignore[attr-defined]
print(f"  Parsed:     symbol={parsed.symbol}, price={parsed.price}, volume={parsed.volume}")  # type: ignore[attr-defined]

# Compare sizes
json_size = len(json.dumps({"symbol": "SAP.DE", "price": 166.52, "volume": 82621}).encode())
print(f"\n  JSON size:     {json_size} bytes")
print(f"  Protobuf size: {len(binary)} bytes")
print(f"  Savings:       {(1 - len(binary)/json_size)*100:.0f}%")
```

      Message:    symbol=SAP.DE, price=166.52, volume=82621
      Binary:     21 bytes (0a065341502e444511713d0ad7a3d0644018bd85...)
      Parsed:     symbol=SAP.DE, price=166.52, volume=82621
    
      JSON size:     54 bytes
      Protobuf size: 21 bytes
      Savings:       61%

#### Protobuf with protoc (production pattern)

```python
# Production Protobuf workflow — protoc-generated code pattern

print("""
  ── Step 1: Define schema (stock_quote.proto) ──

  syntax = "proto3";
  package stoxx;

  message StockQuote {
    string symbol = 1;     // field number, not default value
    double price = 2;
    int64  volume = 3;
    string exchange = 4;   // added later — old consumers ignore it (forward compat)
  }

  ── Step 2: Compile ──

  $ protoc --python_out=. stock_quote.proto
  # Generates: stock_quote_pb2.py

  ── Step 3: Use in Python ──

  from stock_quote_pb2 import StockQuote

  # Serialize
  quote = StockQuote(symbol="SAP.DE", price=166.52, volume=82621)
  data = quote.SerializeToString()  # bytes — send to Kafka, gRPC, file

  # Deserialize
  parsed = StockQuote.FromString(data)
  print(parsed.symbol, parsed.price)

  # Schema evolution: old code ignores field 4 (exchange)
  # New code reads it if present, uses default ("") if absent
""")
```

    
      ── Step 1: Define schema (stock_quote.proto) ──
    
      syntax = "proto3";
      package stoxx;
    
      message StockQuote {
        string symbol = 1;     // field number, not default value
        double price = 2;
        int64  volume = 3;
        string exchange = 4;   // added later — old consumers ignore it (forward compat)
      }
    
      ── Step 2: Compile ──
    
      $ protoc --python_out=. stock_quote.proto
      # Generates: stock_quote_pb2.py
    
      ── Step 3: Use in Python ──
    
      from stock_quote_pb2 import StockQuote
    
      # Serialize
      quote = StockQuote(symbol="SAP.DE", price=166.52, volume=82621)
      data = quote.SerializeToString()  # bytes — send to Kafka, gRPC, file
    
      # Deserialize
      parsed = StockQuote.FromString(data)
      print(parsed.symbol, parsed.price)
    
      # Schema evolution: old code ignores field 4 (exchange)
      # New code reads it if present, uses default ("") if absent

## Format Performance Benchmark

For the architecture-level decision guide on when to use each format across the full pipeline (ingestion, storage, interchange), see [serialization-formats](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/serialization-formats). The benchmarks below focus on Python-specific library performance, while [data-loading-and-export](https://alp78.github.io/elysium/06-GCP/BigQuery/data-loading-and-export) covers how format choice affects BigQuery load throughput.

#### Generate synthetic OHLCV test data — three sizes for benchmarks

```python
# Generate OHLCV test data — same schema as stoxx database
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
print(f"  Small: {len(small):,}, Medium: {len(medium):,}, Large: {len(large):,}")
```

      Small: 100, Medium: 10,000, Large: 100,000

#### Format benchmarks — write/read speed across CSV, Parquet, Avro, Protobuf, MessagePack

```python
# Run benchmarks — write/read all 5 formats at all 3 sizes

bench_dir = tempfile.mkdtemp(prefix="bench_py_")
results = []  # (format, size_label, records, write_ms, read_ms, file_bytes)

def bench(fmt, label, data, write_fn, read_fn):
    path = os.path.join(bench_dir, f"{fmt}_{label}")
    # Write
    start = time.perf_counter()
    write_fn(path, data)
    write_ms = (time.perf_counter() - start) * 1000
    file_bytes = os.path.getsize(path)
    # Read
    start = time.perf_counter()
    count = read_fn(path)
    read_ms = (time.perf_counter() - start) * 1000
    results.append((fmt, label, len(data), write_ms, read_ms, file_bytes))

# CSV
def write_csv(path, data):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=data[0].keys())
        w.writeheader(); w.writerows(data)
def read_csv(path):
    with open(path) as f: return sum(1 for _ in csv.DictReader(f))

# JSON
def write_json(path, data):
    with open(path, "w") as f: json.dump(data, f)
def read_json(path):
    with open(path) as f: return len(json.load(f))

# Parquet
def write_parquet(path, data):
    pd.DataFrame(data).to_parquet(path, index=False)
def read_parquet(path):
    return len(pq.read_table(path))

# Avro
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

# Protobuf — raw wire-format encoding (same binary format as protoc)
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
            # field 1: symbol (wire type 2 = length-delimited)
            sym = r['symbol'].encode('utf-8')
            msg += _proto_tag(1, 2) + bytes([len(sym)]) + sym
            # field 2: date (wire type 2)
            dt = r['date'].encode('utf-8')
            msg += _proto_tag(2, 2) + bytes([len(dt)]) + dt
            # fields 3-6: open/high/low/close (wire type 1 = fixed64/double)
            for fnum, key in [(3,'open'),(4,'high'),(5,'low'),(6,'close')]:
                msg += _proto_tag(fnum, 1) + struct.pack('<d', r[key])
            # field 7: volume (wire type 0 = varint)
            msg += _proto_tag(7, 0) + _proto_varint(r['volume'])
            # Length-prefix each message for framing
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
# Run all benchmarks
for label, data in [("small", small), ("medium", medium), ("large", large)]:
    for fmt, wfn, rfn, ext in [
        ("CSV", write_csv, read_csv, ".csv"),
        ("JSON", write_json, read_json, ".json"),
        ("Parquet", write_parquet, read_parquet, ".parquet"),
        ("Avro", write_avro, read_avro, ".avro"),
        ("Protobuf", write_proto, read_proto, ".bin"),
    ]:
        bench(fmt, label + ext, data, wfn, rfn)

print("  All benchmarks complete.")
```

      All benchmarks complete.

#### Benchmark results — write/read performance matrix

```python
# Results table — pandas styled DataFrame with performance metrics

df_bench = pd.DataFrame(results, columns=["Format", "File", "Records", "Write_ms", "Read_ms", "Bytes"])
df_bench["Bucket"] = df_bench["File"].str.extract(r"(small|medium|large)")
df_bench["File_Size"] = df_bench["Bytes"].apply(
    lambda b: f"{b} B" if b < 1024 else f"{b/1024:.1f} KB" if b < 1024**2 else f"{b/1024**2:.1f} MB")
df_bench["Bytes/Rec"] = df_bench["Bytes"] // df_bench["Records"]
df_bench["Write_ms"] = df_bench["Write_ms"].round(0).astype(int)
df_bench["Read_ms"] = df_bench["Read_ms"].round(0).astype(int)

# Build a single DataFrame sorted by bucket (large first) then Bytes/Rec
bucket_order = {"large": 0, "medium": 1, "small": 2}
df_out = (df_bench[["Format", "Records", "File_Size", "Bytes/Rec", "Write_ms", "Read_ms", "Bucket"]]
    .assign(_sort=df_bench["Bucket"].map(bucket_order))
    .sort_values(["_sort", "Bytes/Rec"]).drop(columns="_sort").reset_index(drop=True))

# Insert separator rows between buckets
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

# Color function: green=best, red=worst per bucket group
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
    # Bold separator rows
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
# Write/Read speed chart — Plotly grouped bar for large tier

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

#### Compression comparison — snappy, gzip, zstd, lz4 ratios and speed

```python
# Compression comparison — file size per format for large tier

csv_bytes = df_bench[(df_bench["Format"] == "CSV") & (df_bench["Bucket"] == "large")]["Bytes"].iloc[0]
comp = df_bench[df_bench["Bucket"] == "large"][["Format", "Bytes"]].sort_values("Bytes").copy()
comp["vs_CSV"] = ((1 - comp["Bytes"] / csv_bytes) * 100).round(1).apply(lambda x: f"{x:+.1f}%")
comp["File_Size"] = comp["Bytes"].apply(
    lambda b: f"{b/1024**2:.1f} MB" if b >= 1024**2 else f"{b/1024:.1f} KB")
comp["Size_MB"] = (comp["Bytes"] / 1024**2).round(2)

# Styled table
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
# File size bar chart — Plotly horizontal bars for visual comparison

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

#### Recommendation matrix

```python
# Recommendation matrix — best format for each scenario

print("""
  ═══ WHEN TO USE WHAT ═══

  Scenario                        Best Format     Why
  ────────────────────────────────────────────────────────────────────────────
  Data lake / analytics queries   Parquet         Columnar: read 2 of 50 columns = skip 96% of data
  Kafka event streaming           Avro            Schema embedded, schema registry, compact
  gRPC microservices              Protobuf        Fastest parse, smallest size, code-generated types
  REST API responses              JSON            Human-readable, universal, self-describing
  Config files                    JSON / YAML     Human-editable, comments (YAML), versioned in git
  Legacy data warehouse export    CSV             Universal, every tool reads it
  Debug / logging                 JSON            Human-readable, structured, grep-friendly
  High-freq trading feed          Protobuf        Lowest latency, smallest payload
  ML feature store                Parquet         Column pruning, predicate pushdown, partitioned
  Cross-language IPC              Protobuf/Avro   Protobuf for speed, Avro for schema
  Batch ETL intermediate          Parquet         Compressed, typed, Spark/BigQuery/Polars
  Small config payloads (<1KB)    JSON            Binary format overhead not worth it
  Browser / mobile API            JSON + gzip     Universal client support

  SIZE RANKING (smallest to largest for same data):
    Protobuf < Parquet < Avro < CSV < JSON

  SPEED RANKING (fastest write+read):
    Protobuf > CSV > Parquet > Avro > JSON
""")

shutil.rmtree(bench_dir)
```

    
      ═══ WHEN TO USE WHAT ═══
    
      Scenario                        Best Format     Why
      ────────────────────────────────────────────────────────────────────────────
      Data lake / analytics queries   Parquet         Columnar: read 2 of 50 columns = skip 96% of data
      Kafka event streaming           Avro            Schema embedded, schema registry, compact
      gRPC microservices              Protobuf        Fastest parse, smallest size, code-generated types
      REST API responses              JSON            Human-readable, universal, self-describing
      Config files                    JSON / YAML     Human-editable, comments (YAML), versioned in git
      Legacy data warehouse export    CSV             Universal, every tool reads it
      Debug / logging                 JSON            Human-readable, structured, grep-friendly
      High-freq trading feed          Protobuf        Lowest latency, smallest payload
      ML feature store                Parquet         Column pruning, predicate pushdown, partitioned
      Cross-language IPC              Protobuf/Avro   Protobuf for speed, Avro for schema
      Batch ETL intermediate          Parquet         Compressed, typed, Spark/BigQuery/Polars
      Small config payloads (<1KB)    JSON            Binary format overhead not worth it
      Browser / mobile API            JSON + gzip     Universal client support
    
      SIZE RANKING (smallest to largest for same data):
        Protobuf < Parquet < Avro < CSV < JSON
    
      SPEED RANKING (fastest write+read):
        Protobuf > CSV > Parquet > Avro > JSON
