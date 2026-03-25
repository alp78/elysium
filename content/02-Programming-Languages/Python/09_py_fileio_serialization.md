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
# Imports used throughout this notebook
import os
import csv
import json
import yaml
import pickle
import struct
import tempfile
from pathlib import Path
from io import StringIO, BytesIO
from datetime import datetime
from decimal import Decimal
from dataclasses import dataclass, asdict
from typing import Optional
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.compute as pc
```

## Read, Write, Append Files

```python
# File I/O — Read, Write, Append
#
# KEY CONCEPTS:
# - open(path, mode) returns a file object. Always use 'with' to ensure cleanup.
# - Modes: 'r' read (default), 'w' write (truncates!), 'a' append, 'x' create (fail if exists)
#   Add 'b' for binary: 'rb', 'wb'. Add '+' for read+write: 'r+', 'w+'.
# - encoding='utf-8' — always specify! Default varies by OS (Windows uses cp1252).
# - pathlib.Path — modern, object-oriented file path handling (preferred over os.path).
```

#### Create a temp directory for all demos

```python
# tempfile.mkdtemp() creates a real directory on disk, returns its path.
# We use this so demos don't pollute your project folder.
tmp_dir = Path(tempfile.mkdtemp(prefix="fileio_"))
print(f"Working dir: {tmp_dir}\n")
```

    Working dir: C:\Users\aperi\AppData\Local\Temp\fileio__ffqjssx

#### Write a file — mode 'w' (creates new or TRUNCATES existing)

```python
# Write a file — mode 'w' (creates new or TRUNCATES existing)
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
      Written: C:\Users\aperi\AppData\Local\Temp\fileio__ffqjssx\pipeline_output.txt
      Size: 98 bytes

#### Read entire file — mode 'r'

```python
# Read entire file — mode 'r'
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
# readlines() vs readline()
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
# Append — mode 'a' (adds to end, never truncates)
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
# Create (exclusive) — mode 'x' (fail if file already exists)
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
# Binary mode — 'rb' / 'wb'
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
# pathlib — modern file path operations
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
      Created dir: C:\Users\aperi\AppData\Local\Temp\fileio__ffqjssx\output
      Exists: True
      Is dir: True
      Is file: True
    
      Files in tmp_dir:
        output
        pipeline_output.txt
        sample.bin
        unique_output.txt

## CSV Files

```python
# CSV Files — the bread and butter of data engineering
#
# KEY CONCEPTS:
# - csv module: built-in, handles quoting, escaping, delimiters automatically.
# - csv.reader / csv.writer: list-based — each row is a list of strings.
# - csv.DictReader / csv.DictWriter: dict-based — each row is a dict {column: value}.
# - DictReader is preferred in DE — access columns by name, not index.
# - For large-scale CSV: use pandas.read_csv() with chunking (not covered here).
```

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
# csv.reader — read CSV rows as lists
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
# csv.DictReader — read rows as dictionaries (preferred in DE)
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
# Custom delimiters — pipe-delimited, tab-delimited
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
# Handling edge cases — quoting, embedded commas, newlines
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
# StringIO — CSV in memory (no disk I/O)
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

## Parquet Files

```python
# Parquet Files — columnar storage for analytics & data lakes
#
# KEY CONCEPTS:
# - Parquet: columnar binary format. Designed for analytics — read only the columns you need.
#   Standard format in data lakes (GCS, S3, ADLS), BigQuery exports, Spark, dbt.
# - Columnar vs row-based: CSV stores row-by-row (read entire row even for 1 column).
#   Parquet stores column-by-column — reading 3 columns from a 100-column table is fast.
# - Built-in compression: snappy (default, fast), gzip (smaller), zstd (best ratio).
# - Schema is embedded: column names, types, and nullability are stored in the file metadata.
#   No need for a separate schema file or header row.
# - pyarrow: Apache Arrow for Python. The standard library for parquet I/O.
#   pip install pyarrow


tmp_dir = Path(tempfile.mkdtemp(prefix="parquet_"))

# ─────────────────────────────────────────────
# WRITE PARQUET
# ─────────────────────────────────────────────
```

#### Write parquet from Arrow table

```python
# Write parquet from Arrow table
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

#### Read entire parquet file

```python
# Read entire parquet file
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

#### Read specific columns only (column pruning)

```python
# Read specific columns only (column pruning)
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

#### Read with row filter (predicate pushdown)

```python
# Row filter (predicate pushdown) — parquet skips non-matching row groups at read time
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

#### Hive-style partitioning

```python
# Hive-style partitioning — splits files into subdirectories by column value
# BigQuery, Spark, Athena, dbt all understand this layout
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
        event_type=page_view\22a62776a45c499187d77bcffb26a11b-0.parquet (1266 bytes)
        event_type=purchase\22a62776a45c499187d77bcffb26a11b-0.parquet (1274 bytes)
        event_type=signup\22a62776a45c499187d77bcffb26a11b-0.parquet (1255 bytes)
    Read back: 5 rows, columns: ['event_id', 'user_id', 'revenue', 'is_mobile', 'event_type']

<h4>Parquet in memory — <code style="font-size:0.75em">BytesIO</code></h4>

```python
# Parquet in memory — write to BytesIO for cloud upload without temp files
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
# CSV vs Parquet — size and feature comparison
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

## JSON

#### json.dumps — dict → JSON string

```python
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
# json.loads — JSON string → dict
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
# json.dump / json.load — write/read JSON files
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
# Handling non-serializable types (datetime, Decimal, custom objects)
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
# JSON Lines (JSONL) — one JSON object per line
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
# yaml.dump — dict → YAML string
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
# Write/read YAML files
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
# Multi-document YAML (--- separator)
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
# JSON vs YAML comparison
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

```python
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
# StringIO — in-memory text stream
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
# BytesIO — in-memory binary stream
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
# Streams as function arguments
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
# @dataclass — auto-generates __init__, __repr__, __eq__ from field annotations
# use a dataclass instead of a plain dict for serialization:
#   - typo in a field name = immediate error, not a silent bug at 3am
#   - IDE autocomplete knows every field and its type
#   - type checking catches wrong types before runtime (str vs int)
#   - asdict() converts to dict for json.dumps; from_dict() reconstructs it
#   - the class IS the schema — anyone reading the code sees the data shape
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
# Serialize: dataclass → dict → JSON string
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
# Deserialize: JSON string → dict → dataclass
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
# pickle.dumps / pickle.loads — serialize to/from bytes
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
# pickle.dump / pickle.load — serialize to/from file
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
# When to use pickle vs JSON
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
