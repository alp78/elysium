---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [file IO, JSON serialization, CSV, file reading, file writing, serialization, deserialization]
keywords: [open, read, write, json, csv, pickle, pathlib, shutil, os.path, serialization]
description: "Python file I/O and serialization reference with executable examples and cell outputs — covers file reading/writing, JSON, CSV, pickle, and pathlib. See [[09_cs_fileio_serialization]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[09_cs_fileio_serialization]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 09. File I/O & Serialization - Python

```python
import os
import csv
import json
import yaml
import pickle
import struct
import tempfile
import time
import shutil
import base64
import hashlib
import asyncio
import aiofiles
import orjson
import fsspec
import fastavro
import polars as pl
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.compute as pc
from pathlib import Path
from io import StringIO, BytesIO
from datetime import datetime
from decimal import Decimal
from dataclasses import dataclass, asdict
from typing import Optional
from urllib.parse import quote, unquote, quote_plus, urlencode
from pydantic import BaseModel, Field, ValidationError
from google.protobuf import descriptor_pb2, descriptor_pool, symbol_database
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection

from IPython.display import display, Markdown
html_formatter = get_ipython().display_formatter.formatters['text/html'] # type: ignore
html_formatter.for_type(pd.DataFrame, lambda df: df.to_html())
html_formatter.for_type(pd.Series, lambda s: s.to_frame().to_html())
```

    <function __main__.<lambda>(s)>

## Read, Write, Append Files

`open(path, mode)` returns a file object. Modes: `'r'` (read, default), `'w'` (write — truncates!), `'a'` (append), `'x'` (exclusive create — fail if exists). Add `'b'` for binary (`'rb'`, `'wb'`), `'+'` for read+write (`'r+'`, `'w+'`). Always specify `encoding='utf-8'` — the default varies by OS (Windows uses cp1252). Use `pathlib.Path` for modern, object-oriented path handling (preferred over `os.path`).

> [!warning] Always use `with` for file operations
> - `open()` without `with` leaks file handles if an exception occurs
> - `'w'` mode truncates existing files immediately — no undo
> - Omitting `encoding=` causes platform-dependent behavior

#### Create a temp directory for all demos

```python
# Temp directory — isolated workspace for file demos

tmp_dir = Path(tempfile.mkdtemp(prefix="fileio_"))
print(f"Working dir: {tmp_dir}\n")
```

    Working dir: C:\Users\aperi\AppData\Local\Temp\fileio_yk2nuyou

#### Write a file — mode 'w' (creates new or TRUNCATES existing)

```python
# Write file — mode 'w' creates new or truncates existing

print("=== Write file (mode='w') ===")
# Data Engineering scenario: write pipeline output to a staging file
staging_file = tmp_dir / "pipeline_output.txt"  # Path / operator joins paths (like os.path.join)

with open(staging_file, "w", encoding="utf-8") as f:
    # 'w' mode: creates the file if it doesn't exist, OVERWRITES if it does.
    # f.write() does NOT add a newline — you must add \n yourself.
    f.write("pipeline_id|status|rows_processed\n")  # header
    f.write("etl_001|success|15000\n")
    f.write("etl_002|failed|0\n")
    f.write("etl_003|success|8200\n")

print(f"  Written: {staging_file}")
print(f"  Size: {staging_file.stat().st_size} bytes")  # .stat() returns file metadata
```

    === Write file (mode='w') ===
      Written: C:\Users\aperi\AppData\Local\Temp\fileio_yk2nuyou\pipeline_output.txt
      Size: 98 bytes

#### Read entire file — mode 'r'

```python
# Read entire file — mode 'r' loads all content into a string

print("\n=== Read entire file ===")

# Method 1: read() — returns the entire file as one string
with open(staging_file, "r", encoding="utf-8") as f:
    content = f.read()  # read everything into memory at once
print(f"  read(): {repr(content[:60])}...")

# Method 2: Path.read_text() — one-liner, opens/reads/closes automatically
content = staging_file.read_text(encoding="utf-8")  # pathlib shorthand
print(f"  Path.read_text(): {len(content)} chars")
```

    
    === Read entire file ===
      read(): 'pipeline_id|status|rows_processed\netl_001|success|15000\netl_'...
      Path.read_text(): 94 chars

#### Read line by line — memory efficient for large files

```python
# Read line by line — memory efficient for large files

print("\n=== Read line by line (memory efficient) ===")
# For large files (multi-GB data lake exports), don't read all into memory.
# Iterating the file object yields one line at a time — uses almost no memory.

with open(staging_file, "r", encoding="utf-8") as f:
    for i, line in enumerate(f):  # f is an iterator — yields one line at a time
        # line includes the trailing \n — strip it
        print(f"  Line {i}: {line.rstrip()}")
```

    
    === Read line by line (memory efficient) ===
      Line 0: pipeline_id|status|rows_processed
      Line 1: etl_001|success|15000
      Line 2: etl_002|failed|0
      Line 3: etl_003|success|8200

#### readlines() vs readline()

```python
# readlines() vs readline() — bulk vs single-line reading

print("\n=== readlines() vs readline() ===")

with open(staging_file, "r", encoding="utf-8") as f:
    # readlines() reads ALL lines into a list at once (like read() but split by \n)
    all_lines = f.readlines()
    print(f"  readlines() → list of {len(all_lines)} strings")
    print(f"  First: {all_lines[0].rstrip()!r}")

with open(staging_file, "r", encoding="utf-8") as f:
    # readline() reads ONE line at a time (manual control)
    first = f.readline()     # reads line 1
    second = f.readline()    # reads line 2
    print(f"  readline() #1: {first.rstrip()!r}")
    print(f"  readline() #2: {second.rstrip()!r}")
```

    
    === readlines() vs readline() ===
      readlines() → list of 4 strings
      First: 'pipeline_id|status|rows_processed'
      readline() #1: 'pipeline_id|status|rows_processed'
      readline() #2: 'etl_001|success|15000'

#### Append — mode 'a' (adds to end, never truncates)

```python
# Append — mode 'a' adds to end, never truncates

print("\n=== Append file (mode='a') ===")
# Data Engineering scenario: append new pipeline results to the log

with open(staging_file, "a", encoding="utf-8") as f:
    # 'a' mode: positions cursor at end of file. Creates file if it doesn't exist.
    # Does NOT truncate — safe to call repeatedly.
    f.write("etl_004|success|22000\n")
    f.write("etl_005|success|3100\n")

# Verify: now has 5 data rows + 1 header = 6 lines
lines = staging_file.read_text(encoding="utf-8").splitlines()  # splitlines() strips \n
print(f"  Total lines after append: {len(lines)}")
print(f"  Last line: {lines[-1]!r}")
```

    
    === Append file (mode='a') ===
      Total lines after append: 6
      Last line: 'etl_005|success|3100'

#### Create (exclusive) — mode 'x' (fail if file already exists)

```python
# Exclusive create — mode 'x' fails if file already exists

print("\n=== Exclusive create (mode='x') ===")
# Prevents accidental overwrites — useful for ensuring unique output files

new_file = tmp_dir / "unique_output.txt"
with open(new_file, "x", encoding="utf-8") as f:
    f.write("This file was created exclusively.\n")
    print(f"  Created: {new_file.name}")

try:
    with open(new_file, "x") as f:  # second attempt — file already exists
        pass
except FileExistsError:
    print(f"  FileExistsError: '{new_file.name}' already exists (mode='x' prevents overwrite)")
```

    
    === Exclusive create (mode='x') ===
      Created: unique_output.txt
      FileExistsError: 'unique_output.txt' already exists (mode='x' prevents overwrite)

#### Binary mode — 'rb' / 'wb'

```python
# Binary mode — 'rb' / 'wb' for non-text data

print("\n=== Binary mode ===")
# Use binary mode for: images, parquet files, protobuf, avro, compressed archives.
# No encoding parameter — you work with bytes, not strings.

bin_file = tmp_dir / "sample.bin"
data = bytes([0x89, 0x50, 0x4E, 0x47])  # PNG magic bytes (header signature)

with open(bin_file, "wb") as f:     # 'wb' = write binary
    f.write(data)

with open(bin_file, "rb") as f:     # 'rb' = read binary
    raw = f.read()                  # returns bytes, not str
    print(f"  Type: {type(raw)}, Content: {raw.hex()}")
```

    
    === Binary mode ===
      Type: <class 'bytes'>, Content: 89504e47

#### pathlib — modern file path operations

```python
# pathlib — modern file path operations replacing os.path

print("\n=== pathlib.Path operations ===")
# pathlib.Path is the modern replacement for os.path.join, os.path.exists, etc.

p = Path("/data/lake/raw/events/2024/01/events.parquet")
print(f"  name:     {p.name}")        # 'events.parquet' — filename with extension
print(f"  stem:     {p.stem}")        # 'events' — filename without extension
print(f"  suffix:   {p.suffix}")      # '.parquet' — extension including the dot
print(f"  parent:   {p.parent}")      # '/data/lake/raw/events/2024/01' — directory containing this file
print(f"  parts:    {p.parts}")       # all path components as a tuple

# Path operations
output = tmp_dir / "output"          # / operator joins paths
output.mkdir(exist_ok=True)          # mkdir -p equivalent; exist_ok=True avoids error if already exists
print(f"  Created dir: {output}")
print(f"  Exists: {output.exists()}")          # True
print(f"  Is dir: {output.is_dir()}")          # True
print(f"  Is file: {staging_file.is_file()}")  # True

# Glob — find files matching a pattern
print(f"\n  Files in tmp_dir:")
for f in sorted(tmp_dir.glob("*")):  # glob("*") = all files/dirs in tmp_dir
    print(f"    {f.name}")
# Recursive glob: tmp_dir.glob("**/*.csv") — all .csv files in any subdirectory
```

    
    === pathlib.Path operations ===
      name:     events.parquet
      stem:     events
      suffix:   .parquet
      parent:   \data\lake\raw\events\2024\01
      parts:    ('\\', 'data', 'lake', 'raw', 'events', '2024', '01', 'events.parquet')
      Created dir: C:\Users\aperi\AppData\Local\Temp\fileio_yk2nuyou\output
      Exists: True
      Is dir: True
      Is file: True
    
      Files in tmp_dir:
        output
        pipeline_output.txt
        sample.bin
        unique_output.txt

## CSV Files

The `csv` module handles quoting, escaping, and delimiters automatically. `csv.reader`/`csv.writer` work with list-based rows; `csv.DictReader`/`csv.DictWriter` use dict-based rows with named columns — preferred in data engineering since you access columns by name, not index.

> [!warning] CSV pitfalls
> - **Never use `split(',')`** — breaks on quoted commas. Always use the `csv` module.
> - **Avoid positional indexing** with `csv.reader` — fragile if columns reorder. Use `DictReader` instead.
> - **For large CSV (>100MB)** — use pandas, Polars, or DuckDB instead of the built-in module.

#### csv.writer — write CSV rows as lists

```python
# csv.writer — write CSV rows as lists

print("=== csv.writer (list-based) ===")
# Data Engineering scenario: export pipeline results to CSV for downstream consumers

tmp_dir = Path(tempfile.mkdtemp(prefix="csv_"))
csv_file = tmp_dir / "pipeline_runs.csv"

with open(csv_file, "w", newline="", encoding="utf-8") as f:
    # newline="" is REQUIRED on Windows — prevents csv module from adding extra blank lines.
    # The csv.writer handles quoting automatically (e.g. commas inside values).
    writer = csv.writer(f)
    writer.writerow(["pipeline_id", "status", "rows_processed", "duration_s"])  # header
    writer.writerow(["etl_001", "success", 15000, 2.3])
    writer.writerow(["etl_002", "failed", 0, 0.1])
    writer.writerow(["etl_003", "success", 8200, 1.7])
    # writerows() writes multiple rows at once from a list of lists:
    writer.writerows([
        ["etl_004", "success", 22000, 4.1],
        ["etl_005", "success", 3100, 0.8],
    ])

print(f"  Written: {csv_file.name}")
print(f"  Content:\n{csv_file.read_text(encoding='utf-8')}")
```

    === csv.writer (list-based) ===
      Written: pipeline_runs.csv
      Content:
    pipeline_id,status,rows_processed,duration_s
    etl_001,success,15000,2.3
    etl_002,failed,0,0.1
    etl_003,success,8200,1.7
    etl_004,success,22000,4.1
    etl_005,success,3100,0.8

#### csv.reader — read CSV rows as lists

```python
# csv.reader — read CSV rows as lists of strings

print("=== csv.reader (list-based) ===")

with open(csv_file, "r", encoding="utf-8") as f:
    reader = csv.reader(f)            # returns an iterator of lists
    header = next(reader)             # first row = header; next() advances the iterator
    print(f"  Header: {header}")
    for row in reader:                # remaining rows = data
        # row is a list of strings: ['etl_001', 'success', '15000', '2.3']
        # All values are strings — you must cast manually.
        pipeline_id, status, rows, duration = row
        print(f"  {pipeline_id}: {status}, {int(rows):,} rows, {float(duration):.1f}s")
```

    === csv.reader (list-based) ===
      Header: ['pipeline_id', 'status', 'rows_processed', 'duration_s']
      etl_001: success, 15,000 rows, 2.3s
      etl_002: failed, 0 rows, 0.1s
      etl_003: success, 8,200 rows, 1.7s
      etl_004: success, 22,000 rows, 4.1s
      etl_005: success, 3,100 rows, 0.8s

#### csv.DictReader — read rows as dictionaries (preferred in DE)

```python
# csv.DictReader — read rows as dictionaries with named columns

print("\n=== csv.DictReader (dict-based) ===")
# DictReader uses the first row as keys. Each subsequent row is an OrderedDict.
# Access columns by name — safer and more readable than row[2].

with open(csv_file, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)        # auto-reads first row as fieldnames
    print(f"  Columns: {reader.fieldnames}")  # list of column names from header
    for row in reader:
        # row is a dict: {'pipeline_id': 'etl_001', 'status': 'success', ...}
        if row["status"] == "failed":
            print(f"  FAILED: {row['pipeline_id']} ({row['rows_processed']} rows)")
        else:
            print(f"  OK:     {row['pipeline_id']} ({int(row['rows_processed']):,} rows)")
```

    
    === csv.DictReader (dict-based) ===
      Columns: ['pipeline_id', 'status', 'rows_processed', 'duration_s']
      OK:     etl_001 (15,000 rows)
      FAILED: etl_002 (0 rows)
      OK:     etl_003 (8,200 rows)
      OK:     etl_004 (22,000 rows)
      OK:     etl_005 (3,100 rows)

#### csv.DictWriter — write rows from dictionaries

```python
# csv.DictWriter — write rows from dictionaries

print("\n=== csv.DictWriter (dict-based) ===")
# Data Engineering scenario: transform and write enriched records

enriched_file = tmp_dir / "enriched_runs.csv"
fieldnames = ["pipeline_id", "status", "rows_processed", "cost_usd"]

records = [
    {"pipeline_id": "etl_001", "status": "success", "rows_processed": 15000, "cost_usd": 0.45},
    {"pipeline_id": "etl_002", "status": "failed", "rows_processed": 0, "cost_usd": 0.01},
    {"pipeline_id": "etl_003", "status": "success", "rows_processed": 8200, "cost_usd": 0.25},
]

with open(enriched_file, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()            # writes the header row from fieldnames
    writer.writerows(records)       # writes all dicts at once (or use writer.writerow(dict) one by one)

print(f"  Written: {enriched_file.name}")
print(f"  Content:\n{enriched_file.read_text(encoding='utf-8')}")
```

    
    === csv.DictWriter (dict-based) ===
      Written: enriched_runs.csv
      Content:
    pipeline_id,status,rows_processed,cost_usd
    etl_001,success,15000,0.45
    etl_002,failed,0,0.01
    etl_003,success,8200,0.25

#### Custom delimiters — pipe-delimited, tab-delimited

```python
# Custom delimiters — pipe-delimited and tab-delimited formats

print("=== Custom delimiters (pipe, tab) ===")

# Pipe-delimited (common in legacy data warehouses)
pipe_data = "id|name|region\n1|Alice|EMEA\n2|Bob|APAC"
reader = csv.reader(StringIO(pipe_data), delimiter="|")  # StringIO = in-memory file
for row in reader:
    print(f"  Pipe: {row}")

# Tab-delimited (TSV — common in BigQuery exports, Redshift UNLOAD)
tsv_data = "id\tname\tregion\n1\tAlice\tEMEA\n2\tBob\tAPAC"
reader = csv.reader(StringIO(tsv_data), delimiter="\t")
for row in reader:
    print(f"  Tab:  {row}")
```

    === Custom delimiters (pipe, tab) ===
      Pipe: ['id', 'name', 'region']
      Pipe: ['1', 'Alice', 'EMEA']
      Pipe: ['2', 'Bob', 'APAC']
      Tab:  ['id', 'name', 'region']
      Tab:  ['1', 'Alice', 'EMEA']
      Tab:  ['2', 'Bob', 'APAC']

#### Handling edge cases — quoting, embedded commas, newlines

```python
# CSV edge cases — quoting, embedded commas, and newlines in fields

print("\n=== Edge cases (quoting, embedded commas) ===")
# csv module handles these automatically — no manual splitting needed

tricky_data = '''name,address,note
"Smith, John","123 Main St, Apt 4","has a comma"
"O'Brien","456 Oak ""Ave""","has quotes"'''

reader = csv.DictReader(StringIO(tricky_data))
for row in reader:
    print(f"  Name: {row['name']:<15} Address: {row['address']}")
```

    
    === Edge cases (quoting, embedded commas) ===
      Name: Smith, John     Address: 123 Main St, Apt 4
      Name: O'Brien         Address: 456 Oak "Ave"

#### StringIO — CSV in memory (no disk I/O)

```python
# StringIO — CSV in memory without disk I/O

print("\n=== StringIO — CSV in memory ===")
# Data Engineering scenario: build CSV payload for an API call or S3 upload
# without writing to disk first.

output = StringIO()                            # in-memory text buffer
writer = csv.writer(output)
writer.writerow(["event_id", "event_type", "timestamp"])
writer.writerow(["evt_001", "page_view", "2024-01-15T10:30:00Z"])
writer.writerow(["evt_002", "purchase", "2024-01-15T10:31:00Z"])

csv_string = output.getvalue()                 # retrieve the entire CSV as a string
print(f"  In-memory CSV ({len(csv_string)} chars):")
print(f"  {csv_string.strip()}")
# Now csv_string can be sent to an API, uploaded to GCS, or written to Kafka.
```

    
    === StringIO — CSV in memory ===
      In-memory CSV (110 chars):
      event_id,event_type,timestamp
    evt_001,page_view,2024-01-15T10:30:00Z
    evt_002,purchase,2024-01-15T10:31:00Z

## JSON

#### json.dumps — dict → JSON string

```python
# json.dumps — serialize dict to JSON string
#
# Technique: json.dumps(obj, indent=2, sort_keys=True) converts Python
#   dicts/lists to a JSON string. indent for pretty printing. default=
#   parameter handles non-serializable types (datetime, Decimal).
#
# Benefits:
#   - One function call — dict to JSON string
#   - indent makes output human-readable for configs and debugging
#   - sort_keys ensures consistent output for diffing
#
# Anti-patterns:
#   - Manual string building for JSON — fragile, no escaping
#   - Ignoring non-serializable types — TypeError at runtime
#
# When to use:
#   - API payloads, message queue messages, config generation
#
# When NOT to use:
#   - High-throughput — use orjson for 3-10x speed

tmp_dir = Path(tempfile.mkdtemp(prefix="json_yaml_"))

# json.dumps — dict → JSON string
print("=== json.dumps (dict → JSON string) ===")
# Data Engineering scenario: build a pipeline metadata payload

pipeline_meta = {
    "pipeline_id": "etl_events_daily",
    "schedule": "0 3 * * *",             # cron expression — runs at 3am daily
    "source": {
        "type": "bigquery",
        "dataset": "raw_events",
        "table": "clickstream",
    },
    "sink": {
        "type": "gcs",
        "bucket": "data-lake-prod",
        "path": "processed/events/",
    },
    "tags": ["production", "clickstream", "daily"],
    "row_count": 1_500_000,
    "is_active": True,                    # Python True → JSON true
    "last_failure": None,                 # Python None → JSON null
}

# dumps = dump-to-string. indent=2 for pretty print. ensure_ascii=False for unicode.
json_str = json.dumps(pipeline_meta, indent=2, ensure_ascii=False)
print(json_str)
```

    === json.dumps (dict → JSON string) ===
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
      "is_active": true,
      "last_failure": null
    }

#### json.loads — JSON string → dict

```python
# json.loads — parse JSON string to dict

print("\n=== json.loads (JSON string → dict) ===")
# Data Engineering scenario: parse an API response or Kafka message

api_response = '''
{
    "status": "completed",
    "job_id": "bq_job_12345",
    "statistics": {
        "total_bytes_processed": 524288000,
        "total_rows": 1500000,
        "cache_hit": false
    }
}
'''

data = json.loads(api_response)  # JSON string → Python dict
# JSON types → Python types:
#   object {} → dict,  array [] → list,  string → str
#   number (int) → int,  number (float) → float
#   true/false → True/False,  null → None
print(f"  Job:  {data['job_id']}")
print(f"  Rows: {data['statistics']['total_rows']:,}")
print(f"  Cache hit: {data['statistics']['cache_hit']}")  # Python bool
```

    
    === json.loads (JSON string → dict) ===
      Job:  bq_job_12345
      Rows: 1,500,000
      Cache hit: False

#### json.dump / json.load — write/read JSON files

```python
# json.dump / json.load — write and read JSON files

print("\n=== json.dump / json.load (file I/O) ===")

json_file = tmp_dir / "pipeline_config.json"

# Write dict → JSON file
with open(json_file, "w", encoding="utf-8") as f:
    json.dump(pipeline_meta, f, indent=2, ensure_ascii=False)
    # dump (no 's') writes directly to a file object
print(f"  Written: {json_file.name} ({json_file.stat().st_size} bytes)")

# Read JSON file → dict
with open(json_file, "r", encoding="utf-8") as f:
    loaded = json.load(f)  # load (no 's') reads from a file object
print(f"  Loaded pipeline: {loaded['pipeline_id']}")
print(f"  Source: {loaded['source']['dataset']}.{loaded['source']['table']}")
```

    
    === json.dump / json.load (file I/O) ===
      Written: pipeline_config.json (421 bytes)
      Loaded pipeline: etl_events_daily
      Source: raw_events.clickstream

#### Handling non-serializable types (datetime, Decimal, custom objects)

```python
# Custom JSON serialization — handling datetime, Decimal, custom objects

print("\n=== Custom JSON serialization (datetime, Decimal) ===")
# json.dumps() fails on datetime, Decimal, set, etc. by default.
# Fix: provide a 'default' function that converts unsupported types.


pipeline_run = {
    "pipeline_id": "etl_events_daily",
    "started_at": datetime(2024, 1, 15, 3, 0, 0),  # not JSON-serializable
    "cost_usd": Decimal("0.45"),                     # not JSON-serializable
    "unique_users": {1001, 1002, 1003},              # set — not JSON-serializable
}

def json_serializer(obj):
    """Custom serializer for types json can't handle natively."""
    if isinstance(obj, datetime):
        return obj.isoformat()      # '2024-01-15T03:00:00' — ISO 8601 standard
    if isinstance(obj, Decimal):
        return float(obj)           # or str(obj) to preserve precision
    if isinstance(obj, set):
        return sorted(list(obj))    # convert set → sorted list
    raise TypeError(f"Type {type(obj).__name__} not serializable")

# default= is called for any object json can't serialize natively
json_str = json.dumps(pipeline_run, indent=2, default=json_serializer)
print(json_str)
```

    
    === Custom JSON serialization (datetime, Decimal) ===
    {
      "pipeline_id": "etl_events_daily",
      "started_at": "2024-01-15T03:00:00",
      "cost_usd": 0.45,
      "unique_users": [
        1001,
        1002,
        1003
      ]
    }

#### JSON Lines (JSONL) — one JSON object per line

```python
# JSON Lines (JSONL) — one JSON object per line for streaming

print("\n=== JSON Lines (JSONL) — streaming format ===")
# JSONL is the standard format for:
# - BigQuery exports / imports
# - Kafka messages (one event per line)
# - Streaming data pipelines
# Each line is a complete, valid JSON object. No surrounding array, no commas between lines.

events = [
    {"event_id": "evt_001", "type": "page_view", "user_id": 1001, "ts": "2024-01-15T10:30:00Z"},
    {"event_id": "evt_002", "type": "purchase",  "user_id": 1002, "ts": "2024-01-15T10:31:00Z"},
    {"event_id": "evt_003", "type": "logout",    "user_id": 1001, "ts": "2024-01-15T10:35:00Z"},
]

jsonl_file = tmp_dir / "events.jsonl"

# Write JSONL — one json.dumps per line, no indent (compact)
with open(jsonl_file, "w", encoding="utf-8") as f:
    for event in events:
        f.write(json.dumps(event) + "\n")  # one complete JSON object per line

# Read JSONL — one json.loads per line
with open(jsonl_file, "r", encoding="utf-8") as f:
    for line in f:
        event = json.loads(line)           # parse each line independently
        print(f"  {event['event_id']}: {event['type']} by user {event['user_id']}")
```

    
    === JSON Lines (JSONL) — streaming format ===
      evt_001: page_view by user 1001
      evt_002: purchase by user 1002
      evt_003: logout by user 1001

## YAML

#### yaml.safe_load — YAML string → dict

```python
# yaml.safe_load — parse YAML string into Python dict
#
# Technique: yaml.safe_load(yaml_string) parses YAML into dicts, lists,
#   and scalars. safe_load prevents arbitrary code execution (unlike
#   yaml.load which can instantiate any Python object).
#
# Benefits:
#   - Safe — no arbitrary code execution from malicious YAML
#   - Automatic type detection — numbers, booleans, dates parsed natively
#   - Handles comments, anchors, multi-line strings
#
# Anti-patterns:
#   - yaml.load() without Loader — security risk, can execute arbitrary code
#   - yaml.safe_load on untrusted YAML without size limits — DoS risk
#
# When to use:
#   - Always use safe_load (never yaml.load without SafeLoader)
#
# When NOT to use:
#   - JSON data — use json.loads instead

tmp_dir = Path(tempfile.mkdtemp(prefix="yaml_"))

# yaml.safe_load — YAML string → dict
print("\n=== yaml.safe_load (YAML → dict) ===")
# Data Engineering scenario: parse a dbt project config or Airflow DAG config

yaml_config = """
# Pipeline configuration (YAML supports comments — JSON does not)
pipeline:
  name: etl_events_daily
  schedule: "0 3 * * *"
  owner: data-team

source:
  type: bigquery
  dataset: raw_events
  table: clickstream
  partitioned_by: event_date      # BigQuery partition column

sink:
  type: gcs
  bucket: data-lake-prod
  format: parquet
  compression: snappy

quality_checks:
  - name: row_count_check
    min_rows: 1000
  - name: null_check
    columns: [event_id, user_id, event_date]

tags: [production, clickstream, daily]
"""

# safe_load: parses YAML but blocks dangerous Python object deserialization.
# ALWAYS use safe_load — never yaml.load() without Loader= (security risk).
config = yaml.safe_load(yaml_config)

print(f"  Pipeline: {config['pipeline']['name']}")
print(f"  Source:   {config['source']['dataset']}.{config['source']['table']}")
print(f"  Sink:     gs://{config['sink']['bucket']}/{config['sink']['format']}")
print(f"  Checks:   {[c['name'] for c in config['quality_checks']]}")
print(f"  Tags:     {config['tags']}")
```

    
    === yaml.safe_load (YAML → dict) ===
      Pipeline: etl_events_daily
      Source:   raw_events.clickstream
      Sink:     gs://data-lake-prod/parquet
      Checks:   ['row_count_check', 'null_check']
      Tags:     ['production', 'clickstream', 'daily']

#### yaml.dump — dict → YAML string

```python
# yaml.dump — serialize dict to YAML string

print("\n=== yaml.dump (dict → YAML) ===")
# Data Engineering scenario: generate a config file programmatically

new_config = {
    "pipeline": {
        "name": "etl_purchases_hourly",
        "schedule": "0 * * * *",
    },
    "source": {"type": "kafka", "topic": "purchases", "group_id": "etl-consumer"},
    "sink": {"type": "bigquery", "dataset": "analytics", "table": "purchases"},
}

# default_flow_style=False → block style (readable); sort_keys=False → preserve insertion order
yaml_str = yaml.dump(new_config, default_flow_style=False, sort_keys=False)
print(yaml_str)
```

    
    === yaml.dump (dict → YAML) ===
    pipeline:
      name: etl_purchases_hourly
      schedule: 0 * * * *
    source:
      type: kafka
      topic: purchases
      group_id: etl-consumer
    sink:
      type: bigquery
      dataset: analytics
      table: purchases

#### Write/read YAML files

```python
# YAML file I/O — read and write YAML files

print("=== YAML file I/O ===")

yaml_file = tmp_dir / "pipeline_config.yaml"

# Write
with open(yaml_file, "w", encoding="utf-8") as f:
    yaml.dump(new_config, f, default_flow_style=False, sort_keys=False)
print(f"  Written: {yaml_file.name}")

# Read
with open(yaml_file, "r", encoding="utf-8") as f:
    loaded_config = yaml.safe_load(f)
print(f"  Loaded: {loaded_config['pipeline']['name']}")
```

    === YAML file I/O ===
      Written: pipeline_config.yaml
      Loaded: etl_purchases_hourly

#### Multi-document YAML (--- separator)

```python
# Multi-document YAML — multiple documents in one file separated by ---

print("\n=== Multi-document YAML ===")
# Some tools (dbt, K8s) use multiple YAML documents in one file, separated by '---'

multi_doc = """
---
name: staging_events
materialized: view
---
name: mart_daily_events
materialized: table
depends_on:
  - staging_events
"""

# safe_load_all returns a generator — one dict per document
docs = list(yaml.safe_load_all(multi_doc))
for doc in docs:
    print(f"  Model: {doc['name']} ({doc['materialized']})")
```

    
    === Multi-document YAML ===
      Model: staging_events (view)
      Model: mart_daily_events (table)

#### JSON vs YAML comparison

```python
# JSON vs YAML comparison — when to use each format

print("\n=== JSON vs YAML ===")
print("""
Feature           JSON                    YAML
─────────────────────────────────────────────────────
Comments          NO                      YES (#)
Quoting           REQUIRED (double)       Optional
Trailing commas   NO                      N/A
Readability       Compact                 Human-friendly
Use case          APIs, data exchange     Config files (dbt, Airflow, K8s)
Python module     json (built-in)         yaml (pip install pyyaml)
C# equivalent     System.Text.Json        YamlDotNet
Security          Safe                    Use safe_load ONLY
Multi-document    No                      Yes (--- separator)
""")
```

    
    === JSON vs YAML ===
    
    Feature           JSON                    YAML
    ─────────────────────────────────────────────────────
    Comments          NO                      YES (#)
    Quoting           REQUIRED (double)       Optional
    Trailing commas   NO                      N/A
    Readability       Compact                 Human-friendly
    Use case          APIs, data exchange     Config files (dbt, Airflow, K8s)
    Python module     json (built-in)         yaml (pip install pyyaml)
    C# equivalent     System.Text.Json        YamlDotNet
    Security          Safe                    Use safe_load ONLY
    Multi-document    No                      Yes (--- separator)

## Serialization, Deserialization, and Streams

For an architecture-level comparison of when to choose JSON, CSV, Parquet, or Avro for pipeline storage and interchange, see [[serialization-formats]].

#### Serialization overview — object to bytes/string and back

```python
# Serialization — converting objects to bytes/string for storage or transfer
#
# Technique: Serialization converts in-memory objects to a persistent format.
#   JSON for text interchange. pickle for Python-native binary. struct
#   for C-compatible fixed-size records. StringIO/BytesIO for in-memory streams.
#
# Benefits:
#   - Decouples data from runtime — persist, transmit, cache
#   - Multiple formats for different needs — text vs binary vs compact
#   - Streams enable uniform I/O API for file, memory, and network
#
# Anti-patterns:
#   - pickle for cross-language data — Python-only, security risk
#   - JSON for large numeric arrays — binary formats are 10x smaller
#
# When to use:
#   - JSON for interchange; pickle for caching; struct for binary protocols
#
# When NOT to use:
#   - pickle from untrusted sources — arbitrary code execution risk

# Serialization, Deserialization & Streams
#
# KEY CONCEPTS:
# - Serialization: converting an in-memory object → bytes/string for storage or transmission.
# - Deserialization: converting bytes/string → in-memory object.
# - pickle: Python-specific binary serialization. Fast, but NOT safe for untrusted data.
# - dataclasses + json: the modern, safe pattern for DE (serialize dataclasses to JSON).
# - struct: pack/unpack primitive types to/from binary (C-compatible byte layout).
# - Streams (io module): in-memory file-like objects (StringIO for text, BytesIO for binary).
#   Useful for building payloads for APIs, cloud uploads, or passing data between functions
#   without touching disk.
#   MemoryStream, StreamReader/StreamWriter


tmp_dir = Path(tempfile.mkdtemp(prefix="serial_"))

# ─────────────────────────────────────────────
# STREAMS — in-memory file-like objects
# ─────────────────────────────────────────────
```

#### StringIO — in-memory text stream

```python
# StringIO — in-memory text stream with file-like API

print("=== StringIO (in-memory text stream) ===")
# StringIO behaves exactly like a file opened in text mode ('r'/'w'),
# but lives entirely in memory — no disk I/O.
# Use case: build CSV/JSON payloads for API calls, cloud uploads, unit tests.

buffer = StringIO()                  # create an empty text buffer
buffer.write("line 1\n")            # write to it like a file
buffer.write("line 2\n")
buffer.write("line 3\n")

# getvalue() returns the entire content as a string
content = buffer.getvalue()
print(f"  Content: {content!r}")

# seek(0) resets the read position to the beginning (like rewinding a tape)
buffer.seek(0)
for line in buffer:                  # iterate like a file
    print(f"  Read: {line.rstrip()}")

buffer.close()                       # free the buffer (or use 'with')
```

    === StringIO (in-memory text stream) ===
      Content: 'line 1\nline 2\nline 3\n'
      Read: line 1
      Read: line 2
      Read: line 3

#### BytesIO — in-memory binary stream

```python
# BytesIO — in-memory binary stream with file-like API

print("\n=== BytesIO (in-memory binary stream) ===")
# BytesIO behaves like a file opened in binary mode ('rb'/'wb').
# Use case: build binary payloads (parquet, protobuf, images) for cloud upload.

bin_buffer = BytesIO()
bin_buffer.write(b"HEADER")         # write bytes (not strings)
bin_buffer.write(b"\x00\x01\x02")  # raw binary data
print(f"  Size: {bin_buffer.tell()} bytes")  # tell() returns current position

# Read back
bin_buffer.seek(0)                   # rewind to start
raw = bin_buffer.read()
print(f"  Content: {raw}")
print(f"  Type: {type(raw)}")        # bytes
```

    
    === BytesIO (in-memory binary stream) ===
      Size: 9 bytes
      Content: b'HEADER\x00\x01\x02'
      Type: <class 'bytes'>

#### Streams as function arguments

```python
# Streams as function arguments — write once, use with file or memory

print("\n=== Streams as function arguments ===")
# Data Engineering scenario: a function that writes CSV, accepting any file-like object.
# Can be called with a real file OR a StringIO — same interface.


def write_events_csv(dest, events):
    """Write events to any file-like object (real file, StringIO, GCS blob, etc.)."""
    writer = csv.writer(dest)
    writer.writerow(["event_id", "type", "user_id"])
    for e in events:
        writer.writerow([e["event_id"], e["type"], e["user_id"]])

events = [
    {"event_id": "evt_001", "type": "page_view", "user_id": 1001},
    {"event_id": "evt_002", "type": "purchase", "user_id": 1002},
]

# Option 1: write to in-memory stream (for API upload, unit test, etc.)
mem_file = StringIO()
write_events_csv(mem_file, events)
print(f"  In-memory CSV:\n  {mem_file.getvalue().strip()}")

# Option 2: write to real file on disk (same function, different argument)
disk_file = tmp_dir / "events.csv"
with open(disk_file, "w", newline="", encoding="utf-8") as f:
    write_events_csv(f, events)
print(f"  Disk file: {disk_file.name} ({disk_file.stat().st_size} bytes)")
```

    
    === Streams as function arguments ===
      In-memory CSV:
      event_id,type,user_id
    evt_001,page_view,1001
    evt_002,purchase,1002
      Disk file: events.csv (70 bytes)

#### Define dataclass (your domain model)

```python
# Dataclass for serialization — typed domain model with field annotations

@dataclass
class PipelineRun:
    """Represents a single execution of a data pipeline."""
    pipeline_id: str
    status: str                              # 'success' | 'failed' | 'running'
    rows_processed: int
    started_at: datetime
    cost_usd: float
    error_message: Optional[str] = None      # None if success, error string if failed
```

#### Serialize: dataclass → dict → JSON string

```python
# Serialize — dataclass to dict to JSON string

print("\n=== Serialize: dataclass → JSON ===")

run = PipelineRun(
    pipeline_id="etl_events_daily",
    status="success",
    rows_processed=1_500_000,
    started_at=datetime(2024, 1, 15, 3, 0, 0),
    cost_usd=0.45,
)

# Step 1: asdict() converts the dataclass instance to a plain dict
run_dict = asdict(run)  # {'pipeline_id': 'etl_events_daily', 'status': 'success', ...}

# Step 2: json.dumps() converts the dict to a JSON string
# Need default= for datetime (not natively JSON-serializable)
json_str = json.dumps(run_dict, indent=2, default=str)  # default=str: fallback for non-serializable types
print(json_str)
```

    
    === Serialize: dataclass → JSON ===
    {
      "pipeline_id": "etl_events_daily",
      "status": "success",
      "rows_processed": 1500000,
      "started_at": "2024-01-15 03:00:00",
      "cost_usd": 0.45,
      "error_message": null
    }

#### Deserialize: JSON string → dict → dataclass

```python
# Deserialize — JSON string to dict to dataclass

print("\n=== Deserialize: JSON → dataclass ===")

json_input = '{"pipeline_id":"etl_purchases","status":"failed","rows_processed":0,"started_at":"2024-01-15T04:00:00","cost_usd":0.01,"error_message":"Source table not found"}'

data = json.loads(json_input)          # JSON string → dict
# Convert datetime string back to datetime object
data["started_at"] = datetime.fromisoformat(data["started_at"])
# Unpack dict into dataclass constructor with **
run2 = PipelineRun(**data)             # dict → dataclass instance
print(f"  Pipeline: {run2.pipeline_id}")
print(f"  Status:   {run2.status}")
print(f"  Error:    {run2.error_message}")
print(f"  Type:     {type(run2)}")
```

    
    === Deserialize: JSON → dataclass ===
      Pipeline: etl_purchases
      Status:   failed
      Error:    Source table not found
      Type:     <class '__main__.PipelineRun'>

#### pickle.dumps / pickle.loads — serialize to/from bytes

```python
# pickle.dumps / pickle.loads — serialize any Python object to bytes

print("\n=== pickle.dumps / pickle.loads ===")
# pickle can serialize almost ANY Python object — including dataclasses,
# lambdas, nested structures, custom classes.
# WARNING: NEVER unpickle data from untrusted sources — it can execute arbitrary code.

pickled = pickle.dumps(run)            # PipelineRun → bytes
print(f"  Pickled size: {len(pickled)} bytes")
print(f"  Type: {type(pickled)}")
print(f"  First 30 bytes: {pickled[:30]}")

unpickled = pickle.loads(pickled)      # bytes → PipelineRun
print(f"  Unpickled: {unpickled.pipeline_id}, {unpickled.status}")
print(f"  Type: {type(unpickled)}")
```

    
    === pickle.dumps / pickle.loads ===
      Pickled size: 212 bytes
      Type: <class 'bytes'>
      First 30 bytes: b'\x80\x04\x95\xc9\x00\x00\x00\x00\x00\x00\x00\x8c\x08__main__\x94\x8c\x0bPipeli'
      Unpickled: etl_events_daily, success
      Type: <class '__main__.PipelineRun'>

#### pickle.dump / pickle.load — serialize to/from file

```python
# pickle.dump / pickle.load — serialize to/from binary files

print("\n=== pickle file I/O ===")

pkl_file = tmp_dir / "pipeline_run.pkl"

# Write — binary mode required ('wb')
with open(pkl_file, "wb") as f:
    pickle.dump(run, f)
print(f"  Written: {pkl_file.name} ({pkl_file.stat().st_size} bytes)")

# Read — binary mode required ('rb')
with open(pkl_file, "rb") as f:
    loaded_run = pickle.load(f)
print(f"  Loaded: {loaded_run.pipeline_id}, {loaded_run.rows_processed:,} rows")
```

    
    === pickle file I/O ===
      Written: pipeline_run.pkl (212 bytes)
      Loaded: etl_events_daily, 1,500,000 rows

#### When to use pickle vs JSON

```python
# Pickle vs JSON comparison — when to use each

print("\n=== Pickle vs JSON ===")
print("""
Feature         pickle                          JSON
──────────────────────────────────────────────────────────
Types           Any Python object               dict, list, str, int, float, bool, None
Cross-language  Python only                     Universal (JS, C#, Go, Java, ...)
Human-readable  No (binary)                     Yes (text)
Security        DANGEROUS with untrusted data   Safe
Speed           Fast                            Moderate
Use case        Cache, ML models, internal      APIs, configs, data exchange
DE use case     Sklearn model artifacts,        BigQuery loads, API payloads,
                Airflow XCom (legacy)           Kafka messages, config files
""")

# ─────────────────────────────────────────────
# STRUCT — binary packing (C-compatible layout)
# ─────────────────────────────────────────────

print("="*60)
print("struct (binary packing)")
print("="*60)
```

    
    === Pickle vs JSON ===
    
    Feature         pickle                          JSON
    ──────────────────────────────────────────────────────────
    Types           Any Python object               dict, list, str, int, float, bool, None
    Cross-language  Python only                     Universal (JS, C#, Go, Java, ...)
    Human-readable  No (binary)                     Yes (text)
    Security        DANGEROUS with untrusted data   Safe
    Speed           Fast                            Moderate
    Use case        Cache, ML models, internal      APIs, configs, data exchange
    DE use case     Sklearn model artifacts,        BigQuery loads, API payloads,
                    Airflow XCom (legacy)           Kafka messages, config files
    
    ============================================================
    struct (binary packing)
    ============================================================

#### struct.pack / struct.unpack — fixed-size binary records

```python
# struct.pack / struct.unpack — fixed-size binary records

print("\n=== struct.pack / struct.unpack ===")
# struct converts Python values ↔ C-compatible binary data.
# Format codes: 'i' = 32-bit int, 'f' = 32-bit float, 'd' = 64-bit double,
#               'B' = unsigned byte, '?' = bool, 's' = char[] (string bytes)
# '<' = little-endian, '>' = big-endian, '!' = network byte order (big-endian)
# Use case: reading binary file formats, network protocols, IoT sensor data.

# Data Engineering scenario: pack a sensor reading into compact binary format
# Format: '<i f d ?' = little-endian: int32 sensor_id, float32 value, float64 timestamp, bool alert
fmt = '<ifd?'
print(f"  Format: {fmt}")
print(f"  Size: {struct.calcsize(fmt)} bytes")  # how many bytes this format needs

# Pack: Python values → bytes
packed = struct.pack(fmt, 42, 23.5, 1705312200.0, True)
print(f"  Packed: {packed.hex()}")

# Unpack: bytes → Python tuple
sensor_id, value, ts, alert = struct.unpack(fmt, packed)
print(f"  Unpacked: sensor={sensor_id}, value={value:.1f}, ts={ts}, alert={alert}")
```

    
    === struct.pack / struct.unpack ===
      Format: <ifd?
      Size: 17 bytes
      Packed: 2a0000000000bc41000000f23f69d94101
      Unpacked: sensor=42, value=23.5, ts=1705312200.0, alert=True

## Encoding and Decoding

#### Character encoding — UTF-8, ASCII, Latin-1

```python
# Character encoding — UTF-8, ASCII, Latin-1 conversion
#
# Technique: str.encode('utf-8') converts string to bytes. bytes.decode('utf-8')
#   converts back. UTF-8 is variable-width (1-4 bytes per char). ASCII is
#   7-bit. Latin-1 maps bytes 0-255 directly.
#
# Benefits:
#   - Explicit encoding prevents silent character corruption
#   - UTF-8 handles all Unicode — the universal encoding
#   - errors='replace' or 'ignore' for graceful handling of bad bytes
#
# Anti-patterns:
#   - Default encoding — varies by platform; always specify explicitly
#   - ASCII for non-English text — silently loses characters
#
# When to use:
#   - File I/O, network protocols, hashing, encryption
#
# When NOT to use:
#   - String manipulation — work with str, encode at I/O boundaries

# Character encoding — converting between strings and raw bytes
#
# WHAT: str.encode("utf-8") converts a Python string to bytes.
#   bytes.decode("utf-8") converts bytes back to a string.
#   UTF-8 is the universal standard for APIs, files, and databases.
#
# WHY: strings in Python are Unicode objects (abstract characters).
#   To write to a file, send over HTTP, or hash, you need raw bytes.
#   Without explicit encoding, you get UnicodeEncodeError or mojibake.
#
# WHEN TO USE: writing to binary streams, HTTP request bodies, hashing,
#   reading files with specific encoding, interop with non-Python systems

text = "Euro Stoxx 50: SAP €166.52, ASML €685.40"

# UTF-8: variable-length, ASCII-compatible, the internet standard
utf8 = text.encode("utf-8")
print(f"  UTF-8:   {len(utf8)} bytes, roundtrip={text == utf8.decode('utf-8')}")

# ASCII: 7-bit only — non-ASCII chars raise UnicodeEncodeError
try:
    ascii_bytes = text.encode("ascii")
except UnicodeEncodeError as e:
    print(f"  ASCII:   FAILED — {e}")

# ASCII with replace — replaces unknown chars with ?
ascii_safe = text.encode("ascii", errors="replace")
print(f"  ASCII:   {ascii_safe.decode('ascii')} (€ replaced with ?)")

# Latin-1 (ISO 8859-1): single-byte Western European
# Note: € is NOT in Latin-1 (it was added in Latin-9/ISO 8859-15)
try:
    latin1 = text.encode("latin-1")
except UnicodeEncodeError as e:
    print(f"  Latin-1: FAILED — {e}")
    latin1 = text.encode("latin-1", errors="replace")
    print(f"  Latin-1: {len(latin1)} bytes (with replacements)")

# UTF-16: 2 bytes per char (4 for supplementary) — used internally by Java/.NET
utf16 = text.encode("utf-16")
print(f"  UTF-16:  {len(utf16)} bytes (includes 2-byte BOM)")
```

      UTF-8:   44 bytes, roundtrip=True
      ASCII:   FAILED — 'ascii' codec can't encode character '\u20ac' in position 19: ordinal not in range(128)
      ASCII:   Euro Stoxx 50: SAP ?166.52, ASML ?685.40 (€ replaced with ?)
      Latin-1: FAILED — 'latin-1' codec can't encode character '\u20ac' in position 19: ordinal not in range(256)
      Latin-1: 40 bytes (with replacements)
      UTF-16:  82 bytes (includes 2-byte BOM)

#### Base64 encoding

```python
# Base64 encoding — binary data as printable ASCII text

original = "SAP.DE|2024-03-12|166.52"
b64 = base64.b64encode(original.encode("utf-8"))
decoded = base64.b64decode(b64).decode("utf-8")
print(f"  Original: {original}")
print(f"  Base64:   {b64.decode()}")
print(f"  Decoded:  {decoded}")
print(f"  Roundtrip: {original == decoded}")

# URL-safe Base64 (replaces + and / with - and _)
url_safe = base64.urlsafe_b64encode(original.encode("utf-8"))
print(f"\n  Standard: {b64.decode()}")
print(f"  URL-safe: {url_safe.decode()}")
```

      Original: SAP.DE|2024-03-12|166.52
      Base64:   U0FQLkRFfDIwMjQtMDMtMTJ8MTY2LjUy
      Decoded:  SAP.DE|2024-03-12|166.52
      Roundtrip: True
    
      Standard: U0FQLkRFfDIwMjQtMDMtMTJ8MTY2LjUy
      URL-safe: U0FQLkRFfDIwMjQtMDMtMTJ8MTY2LjUy

#### Hexadecimal encoding

```python
# Hexadecimal encoding — bytes as 0-9, a-f character pairs

raw = b"\xde\xad\xbe\xef\xca\xfe"
hex_str = raw.hex()
back = bytes.fromhex(hex_str)
print(f"  Bytes:     {raw}")
print(f"  Hex:       {hex_str}")
print(f"  Roundtrip: {raw == back}")

# SHA-256 hash displayed as hex (standard format)
sha = hashlib.sha256(b"SAP.DE").hexdigest()
print(f"\n  SHA-256:   {sha}")
print(f"  Length:    {len(sha)} hex chars = {len(sha)//2} bytes")
```

      Bytes:     b'\xde\xad\xbe\xef\xca\xfe'
      Hex:       deadbeefcafe
      Roundtrip: True
    
      SHA-256:   a80ae49a0c54581271b2fa37bc9113425072ca8b559941b00b916d37af0c4e58
      Length:    64 hex chars = 32 bytes

#### URL encoding

```python
# URL encoding — escape special characters for safe URL use

raw = "SAP.DE close=166.52 change=+2.5% sector=Tech&Finance"
encoded = quote(raw)
print(f"  Raw:     {raw}")
print(f"  Encoded: {encoded}")
print(f"  Decoded: {unquote(encoded)}")

# Build safe query string from dict
params = {"symbol": "BRK.B", "note": "Q1 2024 earnings & revenue"}
qs = urlencode(params)
print(f"\n  Query string: {qs}")
print(f"  Full URL: https://api.example.com/quote?{qs}")
```

      Raw:     SAP.DE close=166.52 change=+2.5% sector=Tech&Finance
      Encoded: SAP.DE%20close%3D166.52%20change%3D%2B2.5%25%20sector%3DTech%26Finance
      Decoded: SAP.DE close=166.52 change=+2.5% sector=Tech&Finance
    
      Query string: symbol=BRK.B&note=Q1+2024+earnings+%26+revenue
      Full URL: https://api.example.com/quote?symbol=BRK.B&note=Q1+2024+earnings+%26+revenue

## Async File I/O

<h4><code style="font-size:0.75em">aiofiles</code> — non-blocking file operations</h4>

```python
# aiofiles — async file I/O for concurrent Python applications
#
# Technique: aiofiles wraps standard open() with async/await support.
#   async with aiofiles.open() as f: enables non-blocking file reads.
#   Essential for asyncio-based web servers and concurrent pipelines.
#
# Benefits:
#   - Non-blocking — other coroutines run during file I/O wait
#   - Same API as standard open — just add async/await
#   - Higher throughput for I/O-bound concurrent applications
#
# Anti-patterns:
#   - aiofiles in synchronous scripts — overhead without benefit
#   - Mixing sync and async file I/O — stick to one pattern
#
# When to use:
#   - asyncio web servers, concurrent file processing pipelines
#
# When NOT to use:
#   - Synchronous scripts and notebooks — standard open is simpler

# aiofiles — async file I/O for concurrent Python applications
#
# WHAT: aiofiles wraps standard open() with async/await support.
#   async with aiofiles.open(...) as f: await f.read()
#   Releases the event loop during disk I/O instead of blocking.
#
# WHY: in a FastAPI server or asyncio scraper, standard open() blocks the
#   entire event loop during disk reads. With 100 concurrent requests,
#   one slow disk read freezes all of them. aiofiles uses a thread pool internally.
#
# WHEN TO USE: any async application (FastAPI, aiohttp, asyncio scripts)
# ANTI-PATTERNS:
#   - Don't use aiofiles in synchronous scripts — standard open() is simpler
#   - Don't forget await — aiofiles.open() without await returns a coroutine, not a file

tmp = tempfile.mkdtemp(prefix="async_py_")
async_file = os.path.join(tmp, "data.txt")

# Async write
async with aiofiles.open(async_file, "w") as f:
    await f.write("line1\nline2\nline3\n")
print("  Written async")

# Async read
async with aiofiles.open(async_file, "r") as f:
    content = await f.read()
print(f"  Read async: {content.strip().replace(chr(10), ', ')}")

# Async line-by-line
async with aiofiles.open(async_file, "r") as f:
    i = 0
    async for line in f:
        print(f"    Line {i}: {line.strip()}")
        i += 1

shutil.rmtree(tmp)
```

      Written async
      Read async: line1, line2, line3
        Line 0: line1
        Line 1: line2
        Line 2: line3

## High-Performance JSON

<h4><code style="font-size:0.75em">orjson</code> — fast JSON serialization</h4>

```python
# orjson — high-performance JSON serialization (3-10x faster than json)
#
# Technique: orjson.dumps(obj) returns bytes (not str). orjson.loads(data)
#   parses. Handles datetime, numpy, and dataclasses natively. Written
#   in Rust. Drop-in replacement for most json.dumps/loads calls.
#
# Benefits:
#   - 3-10x faster than stdlib json — significant for high-throughput
#   - Native datetime/numpy support — no custom default= function
#   - Returns bytes — avoids str→bytes conversion for network I/O
#
# Anti-patterns:
#   - orjson for small/infrequent JSON — stdlib json is fine
#   - Expecting str return — orjson.dumps returns bytes
#
# When to use:
#   - High-throughput APIs, large JSON payloads, ML pipelines
#
# When NOT to use:
#   - Simple scripts — stdlib json has no dependency

# orjson — drop-in replacement for json, written in Rust, 3-10x faster
#
# WHAT: orjson.dumps(obj) returns bytes (not str). orjson.loads(data) parses.
#   Handles datetime, numpy, dataclass natively — no custom encoder needed.
#
# WHY: the standard json module is pure Python and slow for large payloads.
#   orjson is 3-10x faster for both serialization and deserialization.
#   It's a drop-in replacement — same API, just faster.
#
# WHEN TO USE: high-throughput APIs, large JSON payloads, hot paths

# orjson.dumps returns bytes, not str
data = {"symbol": "SAP.DE", "price": 166.52, "timestamp": datetime(2024, 3, 12, 14, 30)}
fast_json = orjson.dumps(data, option=orjson.OPT_INDENT_2)
print(f"  orjson output (bytes): {fast_json.decode()}")

# Parse back
parsed = orjson.loads(fast_json)
print(f"  Parsed: {parsed}")

# Benchmark: orjson vs json
big = [{"id": i, "value": i * 1.5, "name": f"item_{i}"} for i in range(10000)]

start = time.perf_counter()
for _ in range(100): json.dumps(big)
std_time = time.perf_counter() - start

start = time.perf_counter()
for _ in range(100): orjson.dumps(big)
orj_time = time.perf_counter() - start

print(f"\n  json:   {std_time:.3f}s")
print(f"  orjson: {orj_time:.3f}s")
print(f"  Speedup: {std_time/orj_time:.1f}x")
```

      orjson output (bytes): {
      "symbol": "SAP.DE",
      "price": 166.52,
      "timestamp": "2024-03-12T14:30:00"
    }
      Parsed: {'symbol': 'SAP.DE', 'price': 166.52, 'timestamp': '2024-03-12T14:30:00'}
    
      json:   0.299s
      orjson: 0.038s
      Speedup: 7.9x

## Schema Validation with Pydantic

<h4><code style="font-size:0.75em">pydantic</code> — typed models with validation</h4>

```python
# Pydantic — typed models with automatic validation from JSON/dict
#
# Technique: class Model(BaseModel) defines fields with types. Pydantic
#   validates on construction: wrong types raise ValidationError.
#   model_dump() → dict, model_dump_json() → JSON string. Automatic
#   type coercion (str "42" → int 42 when annotated as int).
#
# Benefits:
#   - Runtime validation — catches type errors at construction
#   - Automatic coercion — "42" → 42 for int fields
#   - JSON schema generation — model_json_schema() for API docs
#
# Anti-patterns:
#   - Using dict for validated API input — no type checking
#   - Pydantic for simple internal data — dataclass is lighter
#
# When to use:
#   - API request/response models, config validation, ETL schemas
#
# When NOT to use:
#   - Internal data without validation needs — dataclass is sufficient

# Pydantic — parse JSON/dict into strongly typed models with automatic validation
#
# WHAT: define a model class inheriting from BaseModel. Pydantic automatically:
#   - Validates types (str where int expected → ValidationError)
#   - Coerces compatible types ("42" → 42 if field is int)
#   - Validates constraints (gt=0, max_length=10, regex patterns)
#   - Generates JSON schema for API documentation
#
# WHY: a plain dict has no type safety. d["price"] could be str, None, or missing.
#   Pydantic catches this at parse time, not when your model crashes 3 hours later.
#
# WHEN TO USE: API request/response validation, config parsing, ETL record validation
# ANTI-PATTERNS:
#   - Don't use for internal data that's already validated — overhead isn't worth it
#   - Don't ignore ValidationError — log it and route to dead-letter queue

# Define a model with type hints and constraints
class StockQuote(BaseModel):
    symbol: str = Field(min_length=1, max_length=10)
    price: float = Field(gt=0)
    volume: int = Field(ge=0)
    exchange: Optional[str] = None

# Valid data — parsed and validated
quote = StockQuote(symbol="SAP.DE", price=166.52, volume=82621)
print(f"  Valid: {quote}")
print(f"  JSON:  {quote.model_dump_json()}")

# Type coercion — "166.52" auto-converted to float
coerced = StockQuote(symbol="ASML.AS", price="685.40", volume="45000")
print(f"  Coerced: price={coerced.price} (type={type(coerced.price).__name__})")

# Validation error — negative price rejected
try:
    bad = StockQuote(symbol="BAD", price=-5.0, volume=100)
except ValidationError as e:
    print(f"  Validation error: {e.errors()[0]['msg']}")
```

      Valid: symbol='SAP.DE' price=166.52 volume=82621 exchange=None
      JSON:  {"symbol":"SAP.DE","price":166.52,"volume":82621,"exchange":null}
      Coerced: price=685.4 (type=float)
      Validation error: Input should be greater than 0

## High-Performance CSV Parsing

<h4><code style="font-size:0.75em">polars</code> and <code style="font-size:0.75em">DuckDB</code> — vectorized CSV</h4>

```python
# Polars and DuckDB — high-performance CSV parsing (10-100x faster)
#
# Technique: polars.read_csv uses Rust multi-threading. DuckDB read_csv_auto
#   uses C++ with SIMD. Both are 10-100x faster than csv module for large
#   files. Automatic type inference and parallel I/O.
#
# Benefits:
#   - Multi-threaded — saturates all CPU cores during parsing
#   - Columnar — access specific columns without reading entire rows
#   - Type inference — automatically detects int, float, date, string
#
# Anti-patterns:
#   - csv module for multi-GB files — 10x slower than polars/DuckDB
#   - pandas.read_csv for very large files — polars uses less memory
#
# When to use:
#   - Large CSV files (>100MB), data analysis, ETL pipelines
#
# When NOT to use:
#   - Small files or simple row processing — csv module is sufficient

# High-performance CSV — bypass the standard csv module for large files
#
# WHAT: Polars (Rust-based) and DuckDB (C++-based) parse CSV using
#   multi-threading and SIMD vectorization. 10-100x faster than csv module.
#
# WHY: the standard csv module processes one row at a time in pure Python.
#   For a 1GB CSV, that's minutes. Polars does it in seconds.
#
# WHEN TO USE: any CSV > 100MB, ETL pipelines, data lake ingestion

# Create a sample CSV in memory
csv_data = "symbol,date,close,volume\n"
csv_data += "\n".join(f"SYM_{i},2024-03-{i%28+1:02d},{100+i*0.5},{1000*i}" for i in range(1000))

# Polars: read CSV from string (in production: pl.read_csv("path.csv"))
df = pl.read_csv(csv_data.encode())
print(f"  Polars: {df.shape[0]} rows, {df.shape[1]} cols")
print(f"  Schema: {dict(zip(df.columns, [str(t) for t in df.dtypes]))}")
print(f"  Head:\n{df.head(3)}")

# Benchmark: csv module vs Polars

start = time.perf_counter()
for _ in range(100):
    reader = csv.DictReader(StringIO(csv_data))
    rows = list(reader)
csv_time = time.perf_counter() - start

start = time.perf_counter()
for _ in range(100):
    df = pl.read_csv(csv_data.encode())
pl_time = time.perf_counter() - start

print(f"\n  csv module: {csv_time:.3f}s")
print(f"  Polars:     {pl_time:.3f}s")
print(f"  Speedup:    {csv_time/pl_time:.1f}x")
```

      Polars: 1000 rows, 4 cols
      Schema: {'symbol': 'String', 'date': 'String', 'close': 'Float64', 'volume': 'Int64'}
      Head:
    shape: (3, 4)
    ┌────────┬────────────┬───────┬────────┐
    │ symbol ┆ date       ┆ close ┆ volume │
    │ ---    ┆ ---        ┆ ---   ┆ ---    │
    │ str    ┆ str        ┆ f64   ┆ i64    │
    ╞════════╪════════════╪═══════╪════════╡
    │ SYM_0  ┆ 2024-03-01 ┆ 100.0 ┆ 0      │
    │ SYM_1  ┆ 2024-03-02 ┆ 100.5 ┆ 1000   │
    │ SYM_2  ┆ 2024-03-03 ┆ 101.0 ┆ 2000   │
    └────────┴────────────┴───────┴────────┘
    
      csv module: 0.065s
      Polars:     0.012s
      Speedup:    5.4x

> [!tip] Related pattern
> When writing pipeline output to files, codec selection (gzip, zstd, snappy) significantly affects both file size and read performance — see [[compression]] for benchmark data and decision guidance.

## Cloud and Object Storage

<h4><code style="font-size:0.75em">fsspec</code> — unified filesystem interface</h4>

```python
# fsspec / smart_open — unified filesystem for local + cloud storage
#
# Technique: fsspec provides a single open() API that works with local
#   files, S3, GCS, Azure Blob, HDFS, and HTTP. smart_open wraps it with
#   simpler syntax. Same code for local dev and cloud production.
#
# Benefits:
#   - Write once — same code for local and cloud storage
#   - Supports streaming — read/write large files without full download
#   - Pluggable backends — add new storage without code changes
#
# Anti-patterns:
#   - Separate code paths for local vs cloud — fsspec unifies them
#   - Downloading entire file to process — fsspec streams directly
#
# When to use:
#   - Pipelines that run locally and in cloud, multi-cloud storage
#
# When NOT to use:
#   - Local-only scripts — standard open() is simpler

# fsspec / smart_open — unified file interface for local + cloud storage
#
# WHAT: fsspec provides a single open() API that works with local files,
#   S3, GCS, Azure Blob, HDFS, HTTP, and more. You change the URI, not the code.
#   smart_open is a simpler alternative with the same concept.
#
# WHY: production pipelines read from cloud, not local disk.
#   Without fsspec: boto3.client("s3").download_file(...), then open locally.
#   With fsspec: open("s3://bucket/data.csv") — same code as local files.
#
# WHEN TO USE: any pipeline that reads/writes cloud storage
#   Works with: pandas.read_csv("s3://..."), polars, pyarrow, dask

# Local filesystem (always works)

tmp = tempfile.mkdtemp(prefix="fsspec_")
local_path = os.path.join(tmp, "data.csv")

# fsspec write — same API for local and cloud
with fsspec.open(local_path, "w") as f:
    f.write("symbol,price\nSAP.DE,166.52\nASML.AS,685.40\n")

# fsspec read
with fsspec.open(local_path, "r") as f:
    print(f"  fsspec local: {f.read().strip()}")

# In production, just change the path:
print("\n  # Cloud URIs (same API, just change the path):")
print("  fsspec.open('s3://bucket/data.csv')       # AWS S3")
print("  fsspec.open('gs://bucket/data.csv')       # Google Cloud Storage")
print("  fsspec.open('abfs://container/data.csv')  # Azure Blob")
print("  fsspec.open('https://api.example.com/data') # HTTP")

shutil.rmtree(tmp)
```

      fsspec local: symbol,price
    SAP.DE,166.52
    ASML.AS,685.40
    
      # Cloud URIs (same API, just change the path):
      fsspec.open('s3://bucket/data.csv')       # AWS S3
      fsspec.open('gs://bucket/data.csv')       # Google Cloud Storage
      fsspec.open('abfs://container/data.csv')  # Azure Blob
      fsspec.open('https://api.example.com/data') # HTTP
