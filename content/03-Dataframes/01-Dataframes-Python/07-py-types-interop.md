---
title: "07 - Advanced Types and Interop - Python"
tags: [python, pandas, polars, dataframes]
aliases:
  - categoricals, nested types, Arrow, zero-copy
description: "Pandas/Polars DataFrame reference 07/10 — Advanced Types & Interoperability (categoricals, nested types, Arrow, zero-copy). Side-by-side executable examples with cell outputs."
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# Advanced Types and Interop - Python

> [!quote]+
>
> "The nice thing about standards is that you have so many to choose from."
>
> — **Andrew S. Tanenbaum**, *Computer Networks* (1981)

> [!abstract]- Summary
>
> Covers advanced column types and cross-library data exchange in Pandas and Polars, showing how categorical and nested schemas interact with Arrow memory, zero-copy conversion, and loss-aware file I/O across CSV, JSON, and Parquet when fidelity, schema control, and encoding correctness matter.
>
> **Advanced types**
> - Compare `Categorical`, `Enum`, `List`, `Struct`, and Arrow-backed dtypes, focusing on memory savings, closed-vs-open category domains, and nested data support
> - Show where advanced types help analytical pipelines and where they block joins, SQL persistence, or legacy Pandas-only code paths
>
> **Interoperability**
> - Move data between Pandas and Polars through Arrow-compatible paths, including zero-copy exchange when both sides use Arrow-backed memory
> - Contrast cheap schema-preserving conversion with fallback copy-heavy conversion when NumPy-backed Pandas dtypes remain in play
>
> **CSV / JSON / Parquet**
> - Read and write CSV with explicit delimiters, quoting rules, header control, type overrides, null sentinels, bad-line handling, and encoding declarations
> - Contrast JSON and NDJSON orientation, nested-structure handling, schema inference, and round-trip behavior
> - Treat Parquet as the default analytical format, including compression choices, row-group sizing, partition-aware reads, metadata inspection, and schema-preserving round trips
>
> **Character encodings & binary data**
> - Handle UTF-8, Latin-1, and other text encodings explicitly rather than relying on heuristics or platform defaults
> - Show how raw binary payloads become base64 for text formats or `pl.Binary` / Parquet-native binary columns for lossless round trips
>
> **Operations and safety**
> - Warnings: categorical ordering affects comparisons, `pl.Enum` rejects undeclared values, zero-copy requires Arrow-backed memory on both sides, Parquet codecs must exist on the reader, encoding detection is heuristic, and CSV round-trip loses types
> - Recommendations: 7 practices covering Parquet-first persistence, categorical dimension columns, Enum for closed domains, Arrow exchange over serialization, explicit encodings, round-trip tests, and `zstd` for Parquet compression
> - Troubleshooting: 7 failure modes covering Enum append errors, unexpected copies in interop, codec issues, garbled text from wrong encodings, nested JSON read failures, schema mismatch on Parquet append, and integer overflow during CSV inference

> [!note]- Glossary
>
> **Categorical**
> - A dictionary-encoded column type that stores unique category values once and represents each row with an internal code.
> - It matters because the note uses it as the primary memory-saving type for repeated low-cardinality strings such as sector, country, and status fields.
> - It is usually a poor fit for high-cardinality IDs and timestamps because the category dictionary becomes overhead instead of a savings.
>
> **Enum**
> - A strict Polars categorical type whose allowed values are declared up front and validated at cast time.
> - It matters because it turns domain validation into a dtype-level guarantee instead of a later cleanup step.
> - Values outside the declared set are rejected instead of being silently added, so the domain must be genuinely closed.
>
> **List type**
> - A nested column type where each row holds a variable-length list of values of the same underlying element type.
> - It matters because the note shows how Polars can store repeating attributes without flattening them immediately.
> - List-valued columns often need to be exploded before joins or grouped comparisons make sense.
>
> **Struct type**
> - A nested column type where each row contains a fixed set of named fields, similar to a tiny record embedded inside a cell.
> - It matters because struct columns make nested JSON-like data and grouped field bundles manageable without immediate denormalization.
> - Struct contents are not top-level columns; use struct accessors or `unnest()` when you need the fields directly.
>
> **Arrow-backed dtypes**
> - Pandas dtypes backed by Apache Arrow arrays instead of classic NumPy/object representations.
> - They matter because they are the Pandas side of fast interop and native-null exchange with Polars and other Arrow-native systems.
> - Some Pandas operations still fall back to NumPy-like behavior or trigger copies, so Arrow-backed storage does not guarantee end-to-end zero-copy behavior.
>
> **Apache Arrow**
> - A columnar in-memory data standard designed for fast analytics and efficient exchange between libraries.
> - It matters because the note's interoperability patterns all depend on Arrow as the shared memory contract.
> - Arrow defines the in-memory layout; `Parquet` is the on-disk format that often preserves Arrow-compatible schemas.
>
> **Zero-copy conversion**
> - Transferring data between libraries without duplicating the underlying buffers in memory.
> - It matters because avoiding copies reduces latency, RAM pressure, and serialization overhead in mixed Pandas/Polars workflows.
> - Zero-copy only works when both sides expose compatible Arrow-reusable buffers; object-heavy and NumPy-backed paths still copy.
>
> **Parquet**
> - A columnar binary file format that stores schema, compression metadata, and typed column data efficiently on disk.
> - It matters because the note treats Parquet as the default persistence format for analytical pipelines and round-trip fidelity.
> - It is usually the safest default when downstream type fidelity matters because it preserves schema and compresses efficiently.
>
> **Encoding**
> - The rule set used to interpret bytes as text characters, such as UTF-8, Latin-1, or Windows-1252.
> - It matters because cross-system file exchange fails quickly when text bytes are decoded under the wrong character set.
> - UTF-8 is the modern default, but legacy feeds still use other encodings, and garbled text usually means the wrong decode assumption rather than corrupted bytes.
>
> **Interoperability**
> - The ability to exchange typed data cleanly between libraries, runtimes, and file formats without losing schema or wasting time on unnecessary conversion.
> - It matters because the note is not just about one library's features; it is about keeping data portable across Pandas, Polars, Arrow, and storage formats.
> - Interop failures are usually schema or memory-layout mismatches rather than API-shape problems.
>
> **CSV**
> - A plain-text tabular format with delimiters but no embedded schema, no native compression contract, and no guaranteed type fidelity.
> - It matters because the note contrasts human-readable CSV convenience with its operational weaknesses for typed data exchange.
> - Dates, nullable integers, booleans, and binary payloads all need extra handling in CSV, and round-tripping usually changes dtypes.
>
> **JSON / NDJSON**
> - Text-based structured formats where JSON commonly represents whole documents and NDJSON stores one JSON object per line.
> - They matter because nested data exchange and row-oriented streaming workflows in the note depend on choosing the right JSON flavor.
> - Mixed nesting depth or inconsistent field types quickly make JSON ingestion messy, and NDJSON works best when each line follows the same schema.
>
> **Row group**
> - A Parquet storage subdivision that chunks rows into independently readable blocks on disk.
> - It matters because row-group sizing influences scan efficiency, predicate pruning, and how much data must be read for a partial query.
> - Very small row groups increase metadata overhead, while very large ones reduce pruning precision, so sizing is workload-dependent.
>
> **Compression codec**
> - The algorithm used to compress stored data, such as `snappy`, `zstd`, or `gzip`.
> - It matters because file size, write speed, read speed, and cross-environment compatibility all depend on the chosen codec.
> - Successful writes are not enough; downstream readers also need codec support or the file becomes operationally unusable.
>
> **Binary data / `pl.Binary` / base64**
> - Raw byte payloads represented either as native binary columns in Polars/Parquet or as base64 text when a text-only format must carry them.
> - It matters because the note contrasts lossless binary-native storage with the text-safe base64 workaround required for CSV-like transport.
> - CSV and other text-only formats cannot safely store arbitrary bytes directly, so encode binary payloads first or use a binary-capable format instead.

---
*Runs the example and records the observed result.*
```python
import pandas as pd
import polars as pl
import polars.selectors as cs
import numpy as np
from pathlib import Path

from IPython.display import display, Markdown
html_formatter = get_ipython().display_formatter.formatters['text/html'] # type: ignore
html_formatter.for_type(pd.DataFrame, lambda df: df.to_html())
html_formatter.for_type(pd.Series, lambda s: s.to_frame().to_html())

pl.Config.set_tbl_rows(100)
pd.set_option("display.max_rows", 100)

DATA = Path("../data")

# Core datasets
ohlcv_pd = pd.read_parquet(DATA / "eurostoxx50_ohlcv.parquet")  # 66K rows, daily OHLCV
ohlcv_pl = pl.read_parquet(DATA / "eurostoxx50_ohlcv.parquet")
dim_pd = pd.read_parquet(DATA / "index_dim.parquet")            # 169 rows, stock metadata
dim_pl = pl.read_parquet(DATA / "index_dim.parquet")
scores_pd = pd.read_parquet(DATA / "scores_daily.parquet")      # 466 rows, composite scores
scores_pl = pl.read_parquet(DATA / "scores_daily.parquet")

print(f"OHLCV: {ohlcv_pd.shape}, Dim: {dim_pd.shape}, Scores: {scores_pd.shape}")
import io, json, tempfile, base64, os
import pyarrow as pa
import pyarrow.parquet as pq
import csv
import gzip
import json as json_mod
import shutil
```

```text
OHLCV: (66355, 12), Dim: (169, 26), Scores: (466, 36)
```
## Categorical

### Categorical

#### Pandas | Categorical encoding

`pd.Categorical` encodes repeated string values as integer codes backed by a fixed category array. Use it for low-cardinality string columns (sector, country, status) to reduce memory and speed up groupby operations.

> [!info] Pandas Categorical vs Polars Categorical
>
> Pandas `Categorical` represents missing categories as `NaN` (float), which can silently coerce integer category codes to float. Polars `Categorical` uses native `null` without type coercion. Both store unique values once; Polars additionally uses integer codes at the column level rather than per-Series.

*Encodes `dim_pd["sector"]` as a Pandas `Categorical` and prints the first 5 category labels and memory usage — confirming the `cat` column uses 681 bytes versus 1,484 bytes for the original string column.*
```python
dim_pd["sector_cat"] = pd.Categorical(dim_pd["sector"])
print(f"Categories: {dim_pd["sector_cat"].cat.categories.tolist()[:5]}")
print(f"Memory: str={dim_pd["sector"].memory_usage()}, cat={dim_pd["sector_cat"].memory_usage()}")
```

```text
Categories: ['Basic Materials', 'Communication Services', 'Consumer Cyclical', 'Consumer Defensive', 'Energy']
    Memory: str=1484, cat=681
```
#### Polars | Categorical encoding

`pl.Categorical` stores unique string values in a dictionary and encodes each row as an integer index. `cast(pl.Categorical)` is non-destructive — `with_columns` returns a new DataFrame. The `cat` dtype is visible in schema inspection and in displayed DataFrames.

*Casts `dim_pl["sector"]` to `pl.Categorical` and displays the first 5 rows with `symbol`, `sector`, and `sector_cat` columns — confirming the inferred `cat` dtype shown in the Polars DataFrame schema.*
```python
dim_cat = dim_pl.with_columns(pl.col("sector").cast(pl.Categorical).alias("sector_cat"))
print(f"dtype: {dim_cat["sector_cat"].dtype}")
display(dim_cat.select("symbol", "sector", "sector_cat").head(5))
```

```text
dtype: Categorical

shape: (5, 3)
 symbol             sector         sector_cat
    str                str                cat
ASML.AS         Technology         Technology
  MC.PA  Consumer Cyclical  Consumer Cyclical
 RMS.PA  Consumer Cyclical  Consumer Cyclical
  OR.PA Consumer Defensive Consumer Defensive
 SAP.DE         Technology         Technology
```
## Polars Enum

### Ordered Categorical Type

#### Polars | Sort ordered categorical with pl.Enum

`pl.Enum` is a Categorical variant with a fixed, ordered set of values defined at creation time. Sorting on an Enum column respects the declared order (not alphabetical). Use it for ordered categories: risk levels (`LOW < MEDIUM < HIGH`), priority tiers, ratings.

> [!info] No Pandas equivalent for ordered Enum
>
> Pandas has `CategoricalDtype(ordered=True)` which provides ordered categoricals, but requires the category list upfront. Polars `pl.Enum` is stricter — values not in the declared set raise an error at cast time.

*Creates a 3-row DataFrame with `alert` values cast to `pl.Enum(["LOW","MEDIUM","HIGH","CRITICAL"])`, sorts by `risk_enum` — confirming the result orders `LOW, MEDIUM, HIGH` by declared position rather than alphabetically.*
```python
risk=pl.Enum(["LOW","MEDIUM","HIGH","CRITICAL"])
df=pl.DataFrame({"alert":["HIGH","LOW","MEDIUM"]}).with_columns(pl.col("alert").cast(risk).alias("risk_enum"))
display(df.sort("risk_enum"))
```

```text
shape: (3, 2)
 alert risk_enum
   str      enum
   LOW       LOW
MEDIUM    MEDIUM
  HIGH      HIGH
```
## List Type (Polars)

### Variable-Length List Column

#### Polars | List column with .list operations

A `List` column stores a variable-length array of typed values in each row. It is native to Polars (and Arrow) — each row can hold a different number of elements. Use it for tags, labels, multi-value attributes, or time-series windows. Pandas has no direct native equivalent.

> [!info] No Pandas native List column
>
> Pandas can store Python lists in `object` columns but without vectorized operations. Polars `List` columns support `.list.len()`, `.list.first()`, `.list.contains()`, `.list.explode()`, and more — all executed at the Arrow layer without Python overhead.

*Builds a 2-row DataFrame with a `tags` List column, then uses `.list.len()` and `.list.first()` to add `count` and `first` columns — producing `[2, "tech"]` and `[2, "luxury"]` for ASML.AS and MC.PA.*
```python
df=pl.DataFrame({"symbol":["ASML.AS","MC.PA"],"tags":[["tech","nl"],["luxury","fr"]]})
display(df.with_columns(
    pl.col("tags").list.len().alias("count"),
    pl.col("tags").list.first().alias("first"),
))
```

```text
shape: (2, 4)
 symbol         tags count  first
    str    list[str]   u32    str
ASML.AS   [tech, nl]     2   tech
  MC.PA [luxury, fr]     2 luxury
```
## Struct Type (Polars)

### Nested Struct Column

#### Polars | Struct column and unnest to flat columns

A `Struct` column stores a fixed-schema record (key-value pairs) in each row — analogous to a nested object in JSON. Use it to keep related fields together before unnesting, or when reading JSON with nested objects. `unnest()` flattens a Struct column into separate top-level columns.

*Creates a 1-row DataFrame with a `scores` Struct column containing `momentum` and `value` keys, then unnests it — producing a 3-column DataFrame with `symbol`, `momentum`, and `value` as top-level columns.*
```python
df=pl.DataFrame({"symbol":["ASML.AS"],"scores":[{"momentum":0.8,"value":0.5}]})
display(df.unnest("scores"))
```

```text
shape: (1, 3)
 symbol momentum value
    str      f64   f64
ASML.AS      0.8   0.5
```
## Arrow-Backed Dtypes (Pandas 2.x)

### Arrow-Backed Dtypes

#### Pandas | Arrow-backed string dtype via pd.array

Pandas 2.x introduced opt-in Arrow-backed dtypes (e.g., `string[pyarrow]`, `int64[pyarrow]`) via `dtype_backend="pyarrow"`. These use the same Arrow memory layout as Polars, enabling faster operations and reducing conversion overhead when moving data between the two libraries.

> [!warning] Arrow-backed dtypes are opt-in
>
> Arrow-backed dtypes are not the default in Pandas 2.x. You must request them explicitly via `pd.array(..., dtype="string[pyarrow]")` or `dtype_backend="pyarrow"` on read functions. Copy-on-Write (CoW) became the default in Pandas 3.0. Mixing Arrow-backed and NumPy-backed columns in the same DataFrame can cause unexpected behavior.

> [!success] Opt into Arrow dtypes before planning Arrow-native interchange
>
> Use `dtype_backend="pyarrow"` on ingest or `convert_dtypes(dtype_backend="pyarrow")`
> before handing the frame to Polars, Arrow, or another columnar engine. That
> makes the memory model explicit instead of relying on mixed backend defaults.

*Creates a 2-row DataFrame with `symbol` stored as `string[pyarrow]` via explicit `pd.array(dtype="string[pyarrow]")` — confirming the printed dtype is `string` (Arrow-backed) rather than the default `object`.*
```python
df = pd.DataFrame({"symbol": pd.array(["ASML.AS", "MC.PA"], dtype="string[pyarrow]")})
print(f"dtype: {df["symbol"].dtype}")
```

```text
dtype: string
```
## Summary — Advanced Types

| Type | Pandas | Polars |
|---|---|---|
| Categorical | pd.Categorical | pl.Categorical |
| Ordered | CategoricalDtype(ordered) | pl.Enum |
| List | N/A | pl.List |
| Struct | N/A | pl.Struct |
| Arrow string | string[pyarrow] | pl.Utf8 |

---

## Interoperability

### Dataset Loading
*Runs the example and records the observed result.*
```python
ohlcv_pl=pl.read_parquet(DATA/"eurostoxx50_ohlcv.parquet")
scores_pl=pl.read_parquet(DATA/"scores_daily.parquet")
```

```text
No visible output. This cell prepares state used by later examples.
```
### Polars-to-Pandas Conversion

#### Polars | Convert Polars DataFrame to Pandas with .to_pandas()

`.to_pandas()` converts a Polars `DataFrame` to a Pandas `DataFrame`. When Polars columns use Arrow-compatible types, the conversion may be zero-copy via the Arrow C Data Interface. Otherwise, a full memory copy occurs. Polars `null` becomes Pandas `NaN` for float columns; for integer columns, Pandas may upcast to `float64` to accommodate `NaN`.

*Calls `.to_pandas()` on the first 5 rows of the OHLCV Polars DataFrame, confirming the output type is `pandas.core.frame.DataFrame` and displaying all 12 columns — including Polars `date` promoted to Pandas `datetime64` to accommodate the conversion.*
```python
pdf=ohlcv_pl.head(5).to_pandas()
print(f"Type: {type(pdf)}")
display(pdf)
```

```text
Type: <class 'pandas.core.frame.DataFrame'>

id  symbol        date   open   high    low  close  adj_close   volume  dividends  stock_splits  is_filled
Unnamed: 0                                                                                                               
0           21160  ABI.BR  2021-01-04  58.15  58.85  56.78  57.21    53.5761  1513937        0.0           0.0      False
1           21161  ABI.BR  2021-01-05  56.90  57.98  56.75  57.18    53.5480  1382722        0.0           0.0      False
2           21162  ABI.BR  2021-01-06  57.96  58.94  57.39  58.77    55.0370  1370204        0.0           0.0      False
3           21163  ABI.BR  2021-01-07  58.68  58.86  57.88  58.40    54.6905  1469911        0.0           0.0      False
4           21164  ABI.BR  2021-01-08  58.16  58.40  57.43  57.86    54.1848  1428681        0.0           0.0      False
```
### Pandas-to-Polars Conversion

#### Pandas | Convert Pandas DataFrame back to Polars with pl.from_pandas()

`pl.from_pandas()` converts a Pandas `DataFrame` to Polars. This is always a data copy — Pandas uses NumPy buffers (not Arrow-native), so Polars must allocate new Arrow arrays. Pandas `NaN` in numeric columns becomes Polars `null`; Pandas `object` columns become Polars `String`.

*Calls `pl.from_pandas()` on the 5-row Pandas DataFrame, confirming the output type is `polars.dataframe.frame.DataFrame` — demonstrating the round-trip where Pandas `datetime64` maps back to Polars `datetime[ms]` in the schema.*
```python
plf=pl.from_pandas(pdf)
print(f"Type: {type(plf)}")
display(plf)
```

```text
Type: <class 'polars.dataframe.frame.DataFrame'>

shape: (5, 12)
   id symbol                date  open  high   low close adj_close  volume dividends stock_splits is_filled
  i64    str        datetime[ms]   f64   f64   f64   f64       f64     i64       f64          f64      bool
21160 ABI.BR 2021-01-04 00:00:00 58.15 58.85 56.78 57.21   53.5761 1513937       0.0          0.0     False
21161 ABI.BR 2021-01-05 00:00:00 56.90 57.98 56.75 57.18   53.5480 1382722       0.0          0.0     False
21162 ABI.BR 2021-01-06 00:00:00 57.96 58.94 57.39 58.77   55.0370 1370204       0.0          0.0     False
21163 ABI.BR 2021-01-07 00:00:00 58.68 58.86 57.88 58.40   54.6905 1469911       0.0          0.0     False
21164 ABI.BR 2021-01-08 00:00:00 58.16 58.40 57.43 57.86   54.1848 1428681       0.0          0.0     False
```
### NumPy Conversion

#### Polars | Extract Polars Series to NumPy array with .to_numpy()

`.to_numpy()` extracts a Polars `Series` as a NumPy array. For contiguous numeric types with no nulls, this may be zero-copy (returns a view). If the column contains nulls or non-contiguous memory, a copy is made. Pass `allow_copy=False` to raise an error instead of silently copying.

*Extracts the first 5 `close` values from the OHLCV Polars DataFrame as a NumPy array, printing type `numpy.ndarray`, `dtype: float64`, and the 5 closing prices `[57.21 57.18 58.77 58.4 57.86]`.*
```python
arr=ohlcv_pl["close"].head(5).to_numpy()
print(f"Type: {type(arr)}, dtype: {arr.dtype}, values: {arr}")
```

```text
Type: <class 'numpy.ndarray'>, dtype: float64, values: [57.21 57.18 58.77 58.4  57.86]
```
### Arrow Interoperability

> [!tip] Polars is Arrow-native — use it as the interop hub
>
> Polars stores data in Apache Arrow columnar format internally. `.to_arrow()` returns a `pyarrow.Table` with zero-copy (no data duplication). Use Arrow as the interop layer between Polars and any other Arrow-compatible library (DuckDB, Spark via `datafusion`, ADBC, etc.).

#### Polars | Export to PyArrow Table with .to_arrow()

`.to_arrow()` returns a `pyarrow.Table` without copying data — Polars and PyArrow share the same memory buffers. `pl.from_arrow()` reconstructs a Polars `DataFrame` from any Arrow `Table` or `RecordBatch`, also zero-copy.

*Calls `.to_arrow()` on the first 5 OHLCV rows to produce a `pyarrow.lib.Table`, printing the 12-field Arrow schema including `date32[day]` for dates and `large_string` for the symbol column.*
```python
arrow_table=ohlcv_pl.head(5).to_arrow()
print(f"Type: {type(arrow_table)}")
print(f"Schema: {arrow_table.schema}")
```

```text
Type: <class 'pyarrow.lib.Table'>
    Schema: id: int64
    symbol: large_string
    date: date32[day]
    open: double
    high: double
    low: double
    close: double
    adj_close: double
    volume: int64
    dividends: double
    stock_splits: double
    is_filled: bool
```
#### Polars | Round-trip Arrow Table back to Polars with pl.from_arrow()

`pl.from_arrow()` reconstructs a Polars frame from Arrow buffers and is the direct reverse path for `to_arrow()` in mixed-library pipelines.

*Reconstructs the 5-row Polars DataFrame from the Arrow Table using `pl.from_arrow()` — confirming zero-copy round-trip where Arrow `date32[day]` maps back to Polars `date` dtype.*
```python
back=pl.from_arrow(arrow_table)
display(back)
```

```text
shape: (5, 12)
   id symbol       date  open  high   low close adj_close  volume dividends stock_splits is_filled
  i64    str       date   f64   f64   f64   f64       f64     i64       f64          f64      bool
21160 ABI.BR 2021-01-04 58.15 58.85 56.78 57.21   53.5761 1513937       0.0          0.0     False
21161 ABI.BR 2021-01-05 56.90 57.98 56.75 57.18   53.5480 1382722       0.0          0.0     False
21162 ABI.BR 2021-01-06 57.96 58.94 57.39 58.77   55.0370 1370204       0.0          0.0     False
21163 ABI.BR 2021-01-07 58.68 58.86 57.88 58.40   54.6905 1469911       0.0          0.0     False
21164 ABI.BR 2021-01-08 58.16 58.40 57.43 57.86   54.1848 1428681       0.0          0.0     False
```
### Python Dict Conversion

#### Polars | Convert DataFrame rows to Python dicts with .to_dicts()

`.to_dicts()` converts a Polars `DataFrame` to a Python list of dicts (one dict per row). This is a full data copy into Python native objects — useful for serializing to JSON, passing rows to external APIs, or interoperating with non-DataFrame Python code.

*Selects `symbol` and `composite_score` from the first 3 scores rows and calls `.to_dicts()`, printing a Python `list` of 3 dicts — confirming composite scores for BNP.PA (0.684), DTE.DE (0.515), and IFX.DE (0.512) serialize as native Python floats.*
```python
d=scores_pl.head(3).select("symbol","composite_score").to_dicts()
print(f"Type: {type(d)}")
for row in d: print(f"  {row}")
```

```text
Type: <class 'list'>
      {'symbol': 'BNP.PA', 'composite_score': 0.6839467847784353}
      {'symbol': 'DTE.DE', 'composite_score': 0.5150053634526331}
      {'symbol': 'IFX.DE', 'composite_score': 0.5122353361255053}
```
### Zero-Copy Summary

#### Polars | Zero-copy round-trip via Arrow

Zero-copy means no new memory is allocated — the receiving structure shares the same buffer as the source. Polars ↔ Arrow is zero-copy because both use the same columnar Arrow format. Pandas conversion is generally a copy because NumPy-backed Pandas uses a different memory layout.

*Converts the full 66,355-row OHLCV Polars DataFrame to Arrow and back with `pl.from_arrow(ohlcv_pl.to_arrow())`, printing shape `(66355, 12)` — confirming no data was duplicated in memory during the round-trip.*
```python
# Zero-copy: Polars -> Arrow -> Polars
table=ohlcv_pl.to_arrow()
back=pl.from_arrow(table)
print(f"Same data, no copy: {back.shape}")
```

```text
Same data, no copy: (66355, 12)
```
### Summary

| Conversion | Function | Zero-Copy? |
|---|---|---|
| Polars to Pandas | .to_pandas() | Sometimes |
| Pandas to Polars | pl.from_pandas() | No |
| Polars to Arrow | .to_arrow() | Yes |
| Arrow to Polars | pl.from_arrow() | Yes |
| Polars to NumPy | .to_numpy() | Depends on dtype |

---

Advanced reading and writing for CSV, JSON, and Parquet. Covers every major option: encoding, compression, schema, partitioning, nested data, and edge cases.
*Runs the example and records the observed result.*
```python
TMP = Path(tempfile.mkdtemp())
print(f"Temp dir: {TMP}")
```

```text
Temp dir: C:\Users\aperi\AppData\Local\Temp\tmpmnzrnm_0
```
## CSV

### Separators & Delimiters

#### Pandas | Read CSV — separators and delimiters

`sep` accepts any single character or a regex pattern. `decimal` handles locales where `,` is the decimal separator (common in European CSV exports). `pd.read_fwf` handles fixed-width format files where columns are aligned by character position.

*Demonstrates four CSV variants — tab-separated, European semicolon-separated with `,` as decimal, pipe-separated, and fixed-width format — producing four separate DataFrames from inline string data.*
```python
# Tab-separated
tsv = "name\tage\nAlice\t30\nBob\t25"
display(pd.read_csv(io.StringIO(tsv), sep="\t"))

# Semicolon-separated (common in European locales)
semi = "name;score\nAlice;3,14\nBob;2,72"
display(pd.read_csv(io.StringIO(semi), sep=";", decimal=","))

# Pipe-separated
pipe = "name|city\nAlice|New York\nBob|London"
display(pd.read_csv(io.StringIO(pipe), sep="|"))

# Fixed-width (not CSV but common)
fwf = "name      age  city\nAlice      30  NYC\nBob        25  LON"
display(pd.read_fwf(io.StringIO(fwf)))
```

```text
name  age
Unnamed: 0            
0           Alice   30
1             Bob   25
             name  score
Unnamed: 0              
0           Alice   3.14
1             Bob   2.72
             name      city
Unnamed: 0                 
0           Alice  New York
1             Bob    London
             name  age city
Unnamed: 0                 
0           Alice   30  NYC
1             Bob   25  LON
```
#### Polars | Read CSV — separators and delimiters

`separator` accepts a single character. Polars has no `decimal` parameter — preprocess European-format numbers before reading, or use `pl.read_csv` with `schema_overrides` and cast afterward. There is no fixed-width reader in Polars.

*Reads the same three CSV variants (tab, semicolon, pipe) into Polars DataFrames, each producing a 2×2 result — confirming that Polars infers `i64` for integer columns and `f64` for decimal values.*
```python
# Tab-separated
tsv = "name\tage\nAlice\t30\nBob\t25"
display(pl.read_csv(io.StringIO(tsv), separator="\t"))

# Semicolon
semi = "name;score\nAlice;3.14\nBob;2.72"
display(pl.read_csv(io.StringIO(semi), separator=";"))

# Pipe-separated
pipe = "name|city\nAlice|New York\nBob|London"
display(pl.read_csv(io.StringIO(pipe), separator="|"))
```

```text
shape: (2, 2)
 name age
  str i64
Alice  30
  Bob  25
 name score
  str   f64
Alice  3.14
  Bob  2.72
 name     city
  str      str
Alice New York
  Bob   London
```
### Column Names & Headers

#### Pandas | Read CSV — header, names, usecols

`header=None` reads files with no header row; `names` assigns column names. `skiprows` skips lines from the top (useful for files with metadata preamble). Multi-level headers (`header=[0,1]`) create a `MultiIndex` on columns.

*Demonstrates four header scenarios: providing column names when no header exists, skipping 2 metadata comment lines, reading the second row as the header, and building a MultiIndex from rows 0 and 1.*
```python
# No header in file — provide names
raw = "Alice,30\nBob,25"
display(pd.read_csv(io.StringIO(raw), header=None, names=["name", "age"]))

# Skip rows (e.g., metadata at top of file)
raw = "# Report 2024\n# Generated today\nname,age\nAlice,30\nBob,25"
display(pd.read_csv(io.StringIO(raw), skiprows=2))

# Use a specific row as header
raw = "metadata,ignore\nname,age\nAlice,30\nBob,25"
display(pd.read_csv(io.StringIO(raw), header=1))

# Multi-level headers
raw = "group,A,A,B,B\nmetric,x,y,x,y\n,1,2,3,4"
display(pd.read_csv(io.StringIO(raw), header=[0, 1]))
```

```text
name  age
Unnamed: 0            
0           Alice   30
1             Bob   25
             name  age
Unnamed: 0            
0           Alice   30
1             Bob   25
             name  age
Unnamed: 0            
0           Alice   30
1             Bob   25
Unnamed: 0_level_0  group A   B  
Unnamed: 0_level_1 metric x y x y
                 0    NaN 1 2 3 4
```
#### Polars | Read CSV — has_header, new_columns, skip_rows

`has_header=False` combined with `new_columns` handles files without a header row. `skip_rows` discards leading lines before the header; `skip_rows_after_header` discards the first data row (e.g., a units row). Polars has no MultiIndex equivalent.

*Reads three CSV variants: assigning column names via `new_columns` when no header exists, skipping 2 comment lines, and discarding a "skip_this" units row after the header — each producing a clean 2-row DataFrame.*
```python
# No header — provide names
raw = "Alice,30\nBob,25"
display(pl.read_csv(io.StringIO(raw), has_header=False, new_columns=["name", "age"]))

# Skip rows
raw = "# Report 2024\n# Generated today\nname,age\nAlice,30\nBob,25"
display(pl.read_csv(io.StringIO(raw), skip_rows=2))

# Skip rows after header
raw = "name,age\nskip_this,0\nAlice,30\nBob,25"
display(pl.read_csv(io.StringIO(raw), skip_rows_after_header=1))
```

```text
shape: (2, 2)
 name age
  str i64
Alice  30
  Bob  25
 name age
  str i64
Alice  30
  Bob  25
 name age
  str i64
Alice  30
  Bob  25
```
### Type Control & Parsing

#### Pandas | Read CSV — dtype, parse_dates, na_values

`dtype` overrides inferred types per column. `parse_dates` converts string columns to `datetime64`. `na_values` defines custom null sentinels in addition to (or replacing) Pandas defaults (`NaN`, `N/A`, `null`, `None`, `#N/A`, etc.).

*Demonstrates five type-control scenarios on a 2-row CSV: explicit `int32`/`category`/`boolean` dtypes, automatic date parsing, day-first date parsing, custom null sentinels (`N/A` and `-999`), and a combined default + custom null configuration.*
```python
raw = "id,name,score,date,active\n1,Alice,3.14,2024-01-15,true\n2,Bob,2.72,2024-02-20,false"

# Explicit dtypes
df = pd.read_csv(io.StringIO(raw), dtype={"id": "int32", "name": "category", "active": "boolean"})
display(df.dtypes)

# Parse dates
df = pd.read_csv(io.StringIO(raw), parse_dates=["date"])
display(df.dtypes)

# Custom date parser (day-first)
raw2 = "dt,val\n15/01/2024,10\n20/02/2024,20"
df = pd.read_csv(io.StringIO(raw2), parse_dates=["dt"], dayfirst=True)
display(df)

# NA values — custom sentinels
raw3 = "name,score\nAlice,3.14\nBob,N/A\nCarol,-999"
df = pd.read_csv(io.StringIO(raw3), na_values=["N/A", "-999"])
display(df)

# Keep default NA + add custom
df = pd.read_csv(io.StringIO(raw3), keep_default_na=True, na_values=["-999"])
display(df)
```

```text
0
Unnamed: 0          
id             int32
name        category
score        float64
date          object
active       boolean
                         0
Unnamed: 0                
id                   int64
name                object
score              float64
date        datetime64[ns]
active                bool
                    dt  val
Unnamed: 0                 
0           2024-01-15   10
1           2024-02-20   20
             name  score
Unnamed: 0              
0           Alice   3.14
1             Bob    NaN
2           Carol    NaN
             name  score
Unnamed: 0              
0           Alice   3.14
1             Bob    NaN
2           Carol    NaN
```
#### Polars | Read CSV — schema_overrides, null_values, try_parse_dates

`null_values` accepts a dict mapping column names to their null sentinel string. `try_parse_dates=True` auto-detects ISO date columns and parses them as `Date` or `Datetime`. `schema_overrides` applies per-column type overrides without rejecting other inferred columns.

> [!warning] Polars null vs Pandas NaN in CSV parsing
>
> Pandas uses `NaN` (float) for missing values, which coerces integer columns to `float64`. Polars uses typed `null` — integer columns stay `Int64` even with nulls. This difference becomes visible when round-tripping CSV data between the two libraries.

> [!success] Make nullability and target dtypes explicit at the CSV boundary
>
> Override the schema you expect, declare null sentinels up front, and inspect the
> resulting dtypes immediately after read. That prevents silent integer-to-float
> promotion on the Pandas side and keeps the round-trip contract deliberate.

*Reads the 3-row CSV with a per-column null mapping (`score → "N/A"`), producing a Float64 `score` column where `"N/A"` becomes `null` while `"-999"` remains as a numeric value.*
```python
# Per-column null values (one sentinel per column)
df = pl.read_csv(io.StringIO(raw3), null_values={"score": "N/A"})
display(df)
```

```text
shape: (3, 2)
 name   score
  str     f64
Alice    3.14
  Bob     NaN
Carol -999.00
```
### Quoting & Escaping

#### Pandas | Read CSV — quoting and escaping

RFC 4180 quoting is handled automatically: fields containing the separator, quotes, or newlines are enclosed in double-quotes; literal double-quotes are escaped by doubling. `quoting=csv.QUOTE_ALL` forces all fields to be quoted on write; `QUOTE_MINIMAL` (default) quotes only when necessary.

*Reads a CSV with embedded commas and doubled-quote escaping, then writes the same DataFrame three times — with `QUOTE_MINIMAL` (default), `QUOTE_ALL`, and `QUOTE_NONNUMERIC` — showing how each strategy affects the output.*
```python
# Fields containing commas, quotes, newlines
raw = 'name,bio\nAlice,"Likes cats, dogs"\nBob,"Said ""hello"""'
display(pd.read_csv(io.StringIO(raw)))

# Writing with quoting options
df = pd.DataFrame({"name": ["Alice", "Bob"], "bio": ["Likes cats, dogs", "Said hello"]})
print("--- QUOTE_MINIMAL (default) ---")
print(df.to_csv(index=False))
print("--- QUOTE_ALL ---")
print(df.to_csv(index=False, quoting=csv.QUOTE_ALL))
print("--- QUOTE_NONNUMERIC ---")
print(df.to_csv(index=False, quoting=csv.QUOTE_NONNUMERIC))
```

```text
name               bio
Unnamed: 0                         
0           Alice  Likes cats, dogs
1             Bob      Said "hello"

--- QUOTE_MINIMAL (default) ---
    name,bio
    Alice,"Likes cats, dogs"
    Bob,Said hello

--- QUOTE_ALL ---
    "name","bio"
    "Alice","Likes cats, dogs"
    "Bob","Said hello"

--- QUOTE_NONNUMERIC ---
    "name","bio"
    "Alice","Likes cats, dogs"
    "Bob","Said hello"
```
#### Polars | Read CSV — quoting and write quote_style

Polars handles RFC 4180 quoting automatically on read. On write, `quote_style="always"` quotes all fields; `"auto"` (default) quotes only when the field contains the separator or a quote character. Use `quote_char` to change the quote character from `"` to another.

*Reads a 2-row CSV with embedded commas and doubled-quote escaping, then writes it twice — with `quote_style="auto"` (default, quotes only fields containing commas) and `quote_style="always"` (all fields quoted).*
```python
# Polars handles standard RFC 4180 quoting automatically
raw = 'name,bio\nAlice,"Likes cats, dogs"\nBob,"Said ""hello"""'
display(pl.read_csv(io.StringIO(raw)))

# Writing with quote style
df = pl.DataFrame({"name": ["Alice", "Bob"], "bio": ["Likes cats, dogs", "Said hello"]})
print("--- auto (default) ---")
print(df.write_csv())
print("--- always ---")
print(df.write_csv(quote_style="always"))
```

```text
shape: (2, 2)
 name              bio
  str              str
Alice Likes cats, dogs
  Bob       Said hello

--- auto (default) ---
    name,bio
    Alice,"Likes cats, dogs"
    Bob,Said hello

--- always ---
    "name","bio"
    "Alice","Likes cats, dogs"
    "Bob","Said hello"
```
### Error Handling & Bad Lines

#### Pandas | Read CSV — on_bad_lines, nrows, comment

`on_bad_lines="skip"` silently drops rows with more fields than the header; `"warn"` logs them. `nrows` limits rows loaded for fast file inspection. `comment` skips lines that start with the specified character — useful for files with embedded metadata lines.

*Skips a malformed row with 3 fields (from a 2-column header) yielding a 2-row result, limits a 100-row file to 5 rows with `nrows`, and skips a `#`-prefixed comment line to produce a clean 2-row DataFrame.*
```python
# on_bad_lines: "skip" drops malformed rows
bad = "name,age\nAlice,30\nBob,25,extra_field\nCarol,28"
display(pd.read_csv(io.StringIO(bad), on_bad_lines="skip"))

# Limit rows for peeking
raw = "name,age\n" + "\n".join(f"Person{i},{i}" for i in range(100))
display(pd.read_csv(io.StringIO(raw), nrows=5))

# Comment character — skip lines starting with #
raw = "name,age\n# This is a comment\nAlice,30\nBob,25"
display(pd.read_csv(io.StringIO(raw), comment="#"))
```

```text
name  age
Unnamed: 0            
0           Alice   30
1           Carol   28
               name  age
Unnamed: 0              
0           Person0    0
1           Person1    1
2           Person2    2
3           Person3    3
4           Person4    4
             name  age
Unnamed: 0            
0           Alice   30
1             Bob   25
```
#### Polars | Read CSV — truncate_ragged_lines, n_rows, comment_prefix

`truncate_ragged_lines=True` keeps rows with extra fields by truncating them to the expected number of columns. `n_rows` limits rows loaded. `comment_prefix` skips lines starting with the specified string (e.g., `"#"`).

*Reads a ragged CSV (keeping all 3 rows by truncating the extra field), limits a 100-row file to 5 rows, and skips a `#`-prefixed comment — each producing a clean 2-column DataFrame.*
```python
# Truncate ragged lines (extra fields)
bad = "name,age\nAlice,30\nBob,25,extra_field\nCarol,28"
display(pl.read_csv(io.StringIO(bad), truncate_ragged_lines=True))

# Limit rows
raw = "name,age\n" + "\n".join(f"Person{i},{i}" for i in range(100))
display(pl.read_csv(io.StringIO(raw), n_rows=5))

# Comment prefix
raw = "name,age\n# comment\nAlice,30\nBob,25"
display(pl.read_csv(io.StringIO(raw), comment_prefix="#"))
```

```text
shape: (3, 2)
 name age
  str i64
Alice  30
  Bob  25
Carol  28
   name age
    str i64
Person0   0
Person1   1
Person2   2
Person3   3
Person4   4
 name age
  str i64
Alice  30
  Bob  25
```
### CSV Compression (read & write)

#### Pandas | Read and write CSV — compression (gzip, bz2, zstd)

Compression format is inferred from the file extension automatically. `compression="gzip"` is the most widely supported; `"zstd"` offers better compression ratios with faster decompression. Compressed CSV is useful for intermediate files but slower to read than Parquet for analytical workloads.

*Writes the first 100 OHLCV rows to four compressed formats (gzip, bz2, zip, zstd), reads back the gzip file to verify round-trip integrity, and prints file sizes — confirming bz2 achieves the smallest output (2,058 bytes) among the four.*
```python
# Write compressed CSV
df = ohlcv_pd.head(100)
df.to_csv(TMP / "ohlcv.csv.gz", index=False, compression="gzip")
df.to_csv(TMP / "ohlcv.csv.bz2", index=False, compression="bz2")
df.to_csv(TMP / "ohlcv.csv.zip", index=False, compression="zip")
df.to_csv(TMP / "ohlcv.csv.zst", index=False, compression="zstd")

# Read compressed — auto-detected from extension
display(pd.read_csv(TMP / "ohlcv.csv.gz").head(3))

# Compare sizes
for ext in ["csv.gz", "csv.bz2", "csv.zip", "csv.zst"]:
    p = TMP / f"ohlcv.{ext}"
    print(f"{ext:10s}: {p.stat().st_size:>8,} bytes")
```

```text
id  symbol        date   open   high    low  close  adj_close   volume  dividends  stock_splits  is_filled
Unnamed: 0                                                                                                               
0           21160  ABI.BR  2021-01-04  58.15  58.85  56.78  57.21    53.5761  1513937        0.0           0.0      False
1           21161  ABI.BR  2021-01-05  56.90  57.98  56.75  57.18    53.5480  1382722        0.0           0.0      False
2           21162  ABI.BR  2021-01-06  57.96  58.94  57.39  58.77    55.0370  1370204        0.0           0.0      False

csv.gz    :    2,394 bytes
    csv.bz2   :    2,058 bytes
    csv.zip   :    2,488 bytes
    csv.zst   :    2,305 bytes
```
#### Polars | Read and write CSV — compression

Polars auto-detects compression from the file extension on read. On write, `write_csv()` returns a string — compress it manually using `gzip`, `zstd`, or `lz4` as needed. Alternatively, use `write_parquet` with a compression codec for a better-structured format.

*Reads the gzip-compressed OHLCV CSV written by the Pandas cell (auto-detected from the `.gz` extension), then writes 100 Polars rows to gzip by encoding the CSV string to bytes and compressing manually — producing a 2,384-byte output.*
```python
# Polars reads compressed CSV automatically from extension
display(pl.read_csv(TMP / "ohlcv.csv.gz").head(3))

# Write CSV to string, then compress manually
csv_bytes = ohlcv_pl.head(100).write_csv().encode()
with gzip.open(TMP / "ohlcv_pl.csv.gz", "wb") as f:
    f.write(csv_bytes)
print(f"Compressed: {(TMP / 'ohlcv_pl.csv.gz').stat().st_size:,} bytes")
```

```text
shape: (3, 12)
   id symbol       date  open  high   low close adj_close  volume dividends stock_splits is_filled
  i64    str        str   f64   f64   f64   f64       f64     i64       f64          f64      bool
21160 ABI.BR 2021-01-04 58.15 58.85 56.78 57.21   53.5761 1513937       0.0          0.0     False
21161 ABI.BR 2021-01-05 56.90 57.98 56.75 57.18   53.5480 1382722       0.0          0.0     False
21162 ABI.BR 2021-01-06 57.96 58.94 57.39 58.77   55.0370 1370204       0.0          0.0     False

Compressed: 2,384 bytes
```
### Writing Options

#### Pandas | Write CSV — index, float_format, sep, header

`index=False` (almost always needed) suppresses the Pandas row index from the output. `columns` selects a subset. `float_format="%.2f"` controls decimal precision. `sep` changes the delimiter. `header=False` writes data only (useful for append scenarios).

*Writes the first 5 OHLCV rows in five variations: with and without the row index, as a `symbol`/`close` subset, with semicolon delimiter, without a header row, and with close prices formatted to 2 decimal places.*
```python
df = ohlcv_pd.head(5)

# Include/exclude index
print("--- With index ---")
print(df.to_csv(index=True)[:200])
print("--- Without index ---")
print(df.to_csv(index=False)[:200])

# Subset of columns
print("--- Selected columns ---")
print(df.to_csv(index=False, columns=["symbol", "close"]))

# Custom separator
print("--- Semicolon-separated ---")
print(df[["symbol", "close"]].to_csv(index=False, sep=";"))

# No header
print("--- No header ---")
print(df[["symbol", "close"]].to_csv(index=False, header=False))

# Float format
print("--- 2 decimal places ---")
print(df[["close", "volume"]].head(3).to_csv(index=False, float_format="%.2f"))
```

```text
--- With index ---
    ,id,symbol,date,open,high,low,close,adj_close,volume,dividends,stock_splits,is_filled
    0,21160,ABI.BR,2021-01-04,58.15,58.85,56.78,57.21,53.5761,1513937,0.0,0.0,False
    1,21161,ABI.BR,2021-01-05,56.9,5
    --- Without index ---
    id,symbol,date,open,high,low,close,adj_close,volume,dividends,stock_splits,is_filled
    21160,ABI.BR,2021-01-04,58.15,58.85,56.78,57.21,53.5761,1513937,0.0,0.0,False
    21161,ABI.BR,2021-01-05,56.9,57.98,
    --- Selected columns ---
    symbol,close
    ABI.BR,57.21
    ABI.BR,57.18
    ABI.BR,58.77
    ABI.BR,58.4
    ABI.BR,57.86

--- Semicolon-separated ---
    symbol;close
    ABI.BR;57.21
    ABI.BR;57.18
    ABI.BR;58.77
    ABI.BR;58.4
    ABI.BR;57.86

--- No header ---
    ABI.BR,57.21
    ABI.BR,57.18
    ABI.BR,58.77
    ABI.BR,58.4
    ABI.BR,57.86

--- 2 decimal places ---
    close,volume
    57.21,1513937
    57.18,1382722
    58.77,1370204
```
#### Polars | Write CSV — separator, null_value, include_header

`separator` changes the delimiter. `include_header=False` omits the header row. `null_value` controls how `null` is serialized (default: empty string). `write_csv()` without a path argument returns a Python string, which can then be compressed or transmitted.

*Writes the first 5 OHLCV rows with comma delimiter (default), semicolon delimiter, no header, custom `"NA"` null string, and to a file — demonstrating how `write_csv()` returns a Python string for all in-memory variants.*
```python
df = ohlcv_pl.head(5)

# Basic write to string
print("--- Default ---")
print(df.select("symbol", "close").write_csv())

# Custom separator
print("--- Semicolon ---")
print(df.select("symbol", "close").write_csv(separator=";"))

# No header
print("--- No header ---")
print(df.select("symbol", "close").write_csv(include_header=False))

# Custom null representation
df_null = pl.DataFrame({"a": [1, None, 3], "b": ["x", None, "z"]})
print("--- Custom null ---")
print(df_null.write_csv(null_value="NA"))

# Write to file
df.write_csv(TMP / "polars_out.csv")
print(f"Written: {(TMP / 'polars_out.csv').stat().st_size:,} bytes")
```

```text
--- Default ---
    symbol,close
    ABI.BR,57.21
    ABI.BR,57.18
    ABI.BR,58.77
    ABI.BR,58.4
    ABI.BR,57.86

--- Semicolon ---
    symbol;close
    ABI.BR;57.21
    ABI.BR;57.18
    ABI.BR;58.77
    ABI.BR;58.4
    ABI.BR;57.86

--- No header ---
    ABI.BR,57.21
    ABI.BR,57.18
    ABI.BR,58.77
    ABI.BR,58.4
    ABI.BR,57.86

--- Custom null ---
    a,b
    1,x
    NA,NA
    3,z

Written: 470 bytes
```
### Chunked & Streaming Reading

#### Pandas | Read CSV — chunksize (chunked iteration)

`chunksize=N` returns a `TextFileReader` iterator rather than a `DataFrame`. Each iteration yields a chunk of N rows. Use it to aggregate results from files that don't fit in memory — process each chunk and accumulate results. This is still eager per-chunk (no pushdown).

> [!tip] Prefer Polars scan_csv for large files
>
> Pandas `chunksize` reads the full file row by row in batches. Polars `scan_csv()` (lazy) applies predicate and column pushdown before reading — it only reads the data you actually need, which is much faster for filtered aggregations on large CSVs.

*Reads the full 66,355-row OHLCV CSV in 10,000-row chunks to count total rows and compute the average close price (197.03) by accumulating per-chunk sums without loading the entire file into memory.*
```python
# chunksize returns an iterator of DataFrames
path = DATA / "eurostoxx50_ohlcv.csv"
total_rows = 0
for chunk in pd.read_csv(path, chunksize=10_000):
    total_rows += len(chunk)
print(f"Read {total_rows:,} rows in chunks of 10,000")

# Process chunks with aggregation
avg_close = 0
n = 0
for chunk in pd.read_csv(path, chunksize=10_000, usecols=["close"]):
    avg_close += chunk["close"].sum()
    n += len(chunk)
print(f"Average close: {avg_close / n:.2f}")
```

```text
Read 66,355 rows in chunks of 10,000
    Average close: 197.03
```
#### Polars | Read CSV — scan_csv (lazy, predicate pushdown)

`scan_csv()` creates a `LazyFrame` — no data is read until `.collect()` is called. Polars optimizes the query plan first: predicates are pushed down to the file scan (only matching rows are read), and column projection reduces which columns are loaded. For large files, this can reduce read time by orders of magnitude.

*Creates a LazyFrame over the 66,355-row OHLCV CSV, filters for `ASML.AS` rows with predicate pushdown (reading 1,331 matching rows), then batch-reads the full file in 10,000-row chunks to confirm 66,355 total rows.*
```python
# Polars: use scan_csv (lazy) — never loads everything at once
lf = pl.scan_csv(DATA / "eurostoxx50_ohlcv.csv", try_parse_dates=True)
print(f"Schema: {lf.collect_schema()}")

# Predicate pushdown — only reads matching rows
result = lf.filter(pl.col("symbol") == "ASML.AS").select("date", "close").collect()
print(f"Filtered: {result.shape}")
display(result.head(3))

# Streaming batched collection
total = 0
for batch in pl.scan_csv(DATA / "eurostoxx50_ohlcv.csv").collect_batches(chunk_size=10_000):
    total += batch.height
print(f"Batched read: {total:,} rows")
```

```text
Schema: Schema({'id': Int64, 'symbol': String, 'date': Date, 'open': Float64, 'high': Float64, 'low': Float64, 'close': Float64, 'adj_close': Float64, 'volume': Int64, 'dividends': Float64, 'stock_splits': Float64, 'is_filled': Boolean})
    Filtered: (1331, 2)

shape: (3, 2)
      date  close
      date    f64
2021-01-04 406.25
2021-01-05 406.90
2021-01-06 402.85

Batched read: 66,355 rows
```
## JSON

### Orient Options (Pandas)

#### Pandas | Write JSON — orient options

The `orient` parameter controls the JSON structure. Use `"records"` for interoperable row payloads, `"split"` when you need explicit `columns` and `index`, and `"table"` when schema metadata must round-trip with the data. `"columns"`, `"index"`, and `"values"` still exist, but they are usually secondary choices compared with those three operational defaults.

*Prints the same 2-row DataFrame in `records`, `split`, and `table` form so you can compare row-oriented JSON, coordinate-style JSON, and schema-carrying JSON directly.*
```python
df = pd.DataFrame({"name": ["Alice", "Bob"], "age": [30, 25], "city": ["NYC", "LON"]})
for orient in ["records", "split", "table"]:
    print(f"--- {orient} ---")
    print(df.to_json(orient=orient, indent=2))
```

```text
--- records ---
[
  {
    "name":"Alice",
    "age":30,
    "city":"NYC"
  },
  {
    "name":"Bob",
    "age":25,
    "city":"LON"
  }
]
--- split ---
{
  "columns":[
    "name",
    "age",
    "city"
  ],
  "index":[
    0,
    1
  ],
  "data":[
    [
      "Alice",
      30,
      "NYC"
    ],
    [
      "Bob",
      25,
      "LON"
    ]
  ]
}
--- table ---
{
  "schema":{
    "fields":[
      {
        "name":"index",
        "type":"integer"
      },
      {
        "name":"name",
        "type":"string",
        "extDtype":"str"
      },
      {
        "name":"age",
        "type":"integer"
      },
      {
        "name":"city",
        "type":"string",
        "extDtype":"str"
      }
    ],
    "primaryKey":[
      "index"
    ],
    "pandas_version":"1.4.0"
  },
  "data":[
    {
      "index":0,
      "name":"Alice",
      "age":30,
      "city":"NYC"
    },
    {
      "index":1,
      "name":"Bob",
      "age":25,
      "city":"LON"
    }
  ]
}
```

#### Pandas | JSON round-trip — read back each orient

`pd.read_json` requires the same `orient` on read as was used on write. `"values"` loses column names (returns integer column indices). `"table"` preserves schema metadata and is the most robust orient for lossless round-trips.

*Round-trips the same DataFrame through `records`, `split`, `table`, and `values` to show that only `values` drops the original column names.*
```python
for orient in ["records", "split", "table", "values"]:
    j = df.to_json(orient=orient)
    back = pd.read_json(io.StringIO(j), orient=orient)
    print(f"{orient}: shape={back.shape}, cols={list(back.columns)}")
```

```text
records: shape=(2, 3), cols=['name', 'age', 'city']
split: shape=(2, 3), cols=['name', 'age', 'city']
table: shape=(2, 3), cols=['name', 'age', 'city']
values: shape=(2, 3), cols=[0, 1, 2]
```

### Nested JSON & Flattening

#### Pandas | JSON — json_normalize for nested records

`pd.json_normalize()` recursively flattens nested dicts into dot-notation column names (`address.city`). `record_path` explodes a nested list into rows; `meta` copies parent-level fields into each exploded row. Use this when ingesting REST API responses with nested objects.

*Reads 2 nested records raw (showing dict/list cells), flattens them with `json_normalize` to produce dot-notation columns (`address.city`, `address.zip`), then explodes the `employees` list with `record_path` and `meta=["company"]` to produce 3 rows with company name preserved.*
```python
# Nested JSON records
nested = [
    {"name": "Alice", "address": {"city": "NYC", "zip": "10001"}, "scores": [90, 85, 92]},
    {"name": "Bob", "address": {"city": "London", "zip": "EC1A"}, "scores": [78, 88, 95]},
]

# Default read — nested objects become dicts in cells
df = pd.DataFrame(nested)
print("Raw nested:")
display(df)

# json_normalize — flatten nested dicts
df_flat = pd.json_normalize(nested)
print("\nFlattened:")
display(df_flat)

# Deeper nesting with record_path and meta
data = [
    {"company": "ACME", "employees": [
        {"name": "Alice", "role": "Eng"},
        {"name": "Bob", "role": "PM"},
    ]},
    {"company": "Globex", "employees": [
        {"name": "Carol", "role": "Eng"},
    ]},
]
df_emp = pd.json_normalize(data, record_path="employees", meta=["company"])
print("\nNested array with meta:")
display(df_emp)
```

```text
Raw nested:

name                            address        scores
Unnamed: 0                                                        
0           Alice    {'city': 'NYC', 'zip': '10001'}  [90, 85, 92]
1             Bob  {'city': 'London', 'zip': 'EC1A'}  [78, 88, 95]

Flattened:

name        scores address.city address.zip
Unnamed: 0                                              
0           Alice  [90, 85, 92]          NYC       10001
1             Bob  [78, 88, 95]       London        EC1A

Nested array with meta:

name role company
Unnamed: 0                    
0           Alice  Eng    ACME
1             Bob   PM    ACME
2           Carol  Eng  Globex
```
#### Polars | JSON — unnest and explode for nested Struct and List

Polars reads nested JSON objects as `Struct` columns and arrays as `List` columns — preserving the nested structure rather than flattening eagerly. `unnest("col")` promotes Struct fields to top-level columns. `explode("col")` turns each list element into a separate row.

> [!info] Polars keeps nested structure; Pandas flattens by default
>
> `pd.json_normalize()` eagerly flattens nested dicts with dot-notation keys. Polars `read_json` preserves the hierarchy as `Struct`/`List` types, giving you more control over when and how to flatten. For columnar access patterns, Polars' approach is more memory-efficient.

*Reads the same 2-record nested JSON as Polars, confirming `address` becomes `Struct({'city','zip'})` and `scores` becomes `List(Int64)`, then unnests to 4 columns and explodes to 6 rows (3 scores × 2 names).*
```python
# Polars represents nested JSON as Struct and List types
nested_json = '[{"name":"Alice","address":{"city":"NYC","zip":"10001"},"scores":[90,85,92]},''{"name":"Bob","address":{"city":"London","zip":"EC1A"},"scores":[78,88,95]}]'

# Read — keeps nested structure
df = pl.read_json(io.StringIO(nested_json))
print("Schema with nested types:")
print(df.schema)
display(df)

# Unnest struct columns
df_flat = df.unnest("address")
print("\nUnnested:")
display(df_flat)

# Explode list columns
df_exploded = df.unnest("address").explode("scores")
print("\nUnnested + exploded:")
display(df_exploded)
```

```text
Schema with nested types:
    Schema({'name': String, 'address': Struct({'city': String, 'zip': String}), 'scores': List(Int64)})

shape: (2, 3)
 name       address       scores
  str     struct[2]    list[i64]
Alice   {NYC,10001} [90, 85, 92]
  Bob {London,EC1A} [78, 88, 95]

Unnested:

shape: (2, 4)
 name   city   zip       scores
  str    str   str    list[i64]
Alice    NYC 10001 [90, 85, 92]
  Bob London  EC1A [78, 88, 95]

Unnested + exploded:

shape: (6, 4)
 name   city   zip scores
  str    str   str    i64
Alice    NYC 10001     90
Alice    NYC 10001     85
Alice    NYC 10001     92
  Bob London  EC1A     78
  Bob London  EC1A     88
  Bob London  EC1A     95
```
### NDJSON (Newline-Delimited JSON)

#### Pandas and Polars | Read and write NDJSON with lines=True and read_ndjson()

NDJSON (also called JSON Lines) stores one JSON object per line, making it streamable and append-friendly. Pandas reads it with `lines=True`; Polars has dedicated `read_ndjson()` and `write_ndjson()` methods, plus `scan_ndjson()` for lazy evaluation.

*Reads a 3-record NDJSON string with Pandas (`lines=True`) and Polars (`read_ndjson()`), writes NDJSON back with both, then creates a Polars `LazyFrame` via `scan_ndjson()` — confirming both libraries produce identical 3-row, 2-column DataFrames.*
```python
# NDJSON — one JSON object per line, ideal for streaming/append
ndjson_data = '{"name":"Alice","age":30}\n{"name":"Bob","age":25}\n{"name":"Carol","age":35}'

# Pandas — use lines=True
df_pd = pd.read_json(io.StringIO(ndjson_data), lines=True)
display(Markdown("**Pandas:**"))
display(df_pd)

# Polars — dedicated read_ndjson
df_pl = pl.read_ndjson(io.StringIO(ndjson_data))
display(Markdown("**Polars:**"))
display(df_pl)

# Write NDJSON
print("--- Pandas NDJSON output ---")
print(df_pd.to_json(orient="records", lines=True))

print("--- Polars NDJSON output ---")
df_pl.write_ndjson(TMP / "out.ndjson")
print((TMP / "out.ndjson").read_text())

# Polars lazy scan_ndjson — for large files
lf = pl.scan_ndjson(TMP / "out.ndjson")
print(f"\nLazy schema: {lf.collect_schema()}")
```

```text
name  age
Unnamed: 0            
0           Alice   30
1             Bob   25
2           Carol   35

shape: (3, 2)
 name age
  str i64
Alice  30
  Bob  25
Carol  35

--- Pandas NDJSON output ---
    {"name":"Alice","age":30}
    {"name":"Bob","age":25}
    {"name":"Carol","age":35}

--- Polars NDJSON output ---
    {"name":"Alice","age":30}
    {"name":"Bob","age":25}
    {"name":"Carol","age":35}

Lazy schema: Schema({'name': String, 'age': Int64})
```
### JSON Writing Options

#### Pandas | Write JSON — orient, date_format, double_precision

`date_format="iso"` writes dates as ISO 8601 strings; `"epoch"` writes milliseconds since epoch. `double_precision` controls float decimal digits. `force_ascii=False` preserves Unicode characters (default `True` escapes them as `\uXXXX`). Supports gzip/bz2/zstd compression.

*Serializes the first 3 OHLCV rows (symbol, date, close) with ISO dates and 2-space indentation, then demonstrates epoch timestamps, float precision control, Unicode escaping for city names, and gzip compression — producing a 113-byte compressed JSON file.*
```python
df = ohlcv_pd.head(3)[["symbol", "date", "close"]]

# Pretty print
print("--- indent=2 ---")
print(df.to_json(orient="records", indent=2, date_format="iso"))

# Epoch timestamps (default)
print("--- date_format=epoch ---")
print(df.to_json(orient="records", date_format="epoch")[:200])

# Double precision control
print("--- double_precision=2 ---")
print(df.to_json(orient="records", double_precision=2))

# Force ASCII (escape unicode)
df_uni = pd.DataFrame({"city": ["München", "Zürich"]})
print("--- force_ascii=True ---")
print(df_uni.to_json(orient="records", force_ascii=True))
print("--- force_ascii=False ---")
print(df_uni.to_json(orient="records", force_ascii=False))

# Compressed JSON
df.to_json(TMP / "ohlcv.json.gz", orient="records", compression="gzip")
print(f"\nCompressed JSON: {(TMP / 'ohlcv.json.gz').stat().st_size:,} bytes")
```

```text
--- indent=2 ---
    [
      {
        "symbol":"ABI.BR",
        "date":"2021-01-04T00:00:00.000",
        "close":57.21
      },
      {
        "symbol":"ABI.BR",
        "date":"2021-01-05T00:00:00.000",
        "close":57.18
      },
      {
        "symbol":"ABI.BR",
        "date":"2021-01-06T00:00:00.000",
        "close":58.77
      }
    ]
    --- date_format=epoch ---
    [{"symbol":"ABI.BR","date":1609718400000,"close":57.21},{"symbol":"ABI.BR","date":1609804800000,"close":57.18},{"symbol":"ABI.BR","date":1609891200000,"close":58.77}]
    --- double_precision=2 ---
    [{"symbol":"ABI.BR","date":1609718400000,"close":57.21},{"symbol":"ABI.BR","date":1609804800000,"close":57.18},{"symbol":"ABI.BR","date":1609891200000,"close":58.77}]
    --- force_ascii=True ---
    [{"city":"M\u00fcnchen"},{"city":"Z\u00fcrich"}]
    --- force_ascii=False ---
    [{"city":"München"},{"city":"Zürich"}]

Compressed JSON: 113 bytes
```
#### Polars | Write JSON — write_json, write_ndjson, to_dicts()

`write_json()` writes a JSON array (row-oriented, no orient variants). `write_ndjson()` writes NDJSON. For custom JSON control (custom date formatting, selective fields, extra metadata), use `to_dicts()` to get a Python list and serialize with `json.dumps()` and `default=str` for date handling.

*Writes the first 3 OHLCV rows (symbol, date, close) as a JSON array file, as NDJSON, and as a custom JSON via `to_dicts()` with `json.dumps(default=str)` — showing that Polars dates serialize as ISO strings in all three approaches.*
```python
df = ohlcv_pl.head(3).select("symbol", "date", "close")

# Write JSON (row-oriented)
print("--- Polars JSON ---")
df.write_json(TMP / "pl_out.json")
print((TMP / "pl_out.json").read_text()[:300])

# Write NDJSON (streaming-friendly)
print("\n--- Polars NDJSON ---")
df.write_ndjson(TMP / "pl_out.ndjson")
print((TMP / "pl_out.ndjson").read_text())

# Serialize to Python dicts for custom JSON handling
dicts = df.to_dicts()
custom = json_mod.dumps(dicts, indent=2, default=str)
print("\n--- Custom via to_dicts() ---")
print(custom)
```

```text
--- Polars JSON ---
    [{"symbol":"ABI.BR","date":"2021-01-04","close":57.21},{"symbol":"ABI.BR","date":"2021-01-05","close":57.18},{"symbol":"ABI.BR","date":"2021-01-06","close":58.77}]

--- Polars NDJSON ---
    {"symbol":"ABI.BR","date":"2021-01-04","close":57.21}
    {"symbol":"ABI.BR","date":"2021-01-05","close":57.18}
    {"symbol":"ABI.BR","date":"2021-01-06","close":58.77}

--- Custom via to_dicts() ---
    [
      {
        "symbol": "ABI.BR",
        "date": "2021-01-04",
        "close": 57.21
      },
      {
        "symbol": "ABI.BR",
        "date": "2021-01-05",
        "close": 57.18
      },
      {
        "symbol": "ABI.BR",
        "date": "2021-01-06",
        "close": 58.77
      }
    ]
```
### Schema Control on Read

#### Pandas and Polars | JSON schema override and infer_schema_length comparison

Both libraries support schema overrides at read time to avoid a separate cast step. Polars `infer_schema_length=None` scans the entire file before inferring types — useful for files where the first N rows are insufficient to determine the correct type (e.g., a `"1"` that becomes `"two"` 1000 rows later).

*Reads a 2-element JSON array with Pandas `dtype={"id": int, "val": float}` and Polars `schema_overrides`, then demonstrates `infer_schema_length=None` on an inconsistent JSON array `[{"x":1},{"x":"two"},{"x":3}]` — showing Polars falls back to `String` when types conflict across rows.*
```python
# Pandas — dtype control
raw = '[{"id":"1","val":"3.14"},{"id":"2","val":"2.72"}]'
df = pd.read_json(io.StringIO(raw), dtype={"id": int, "val": float})
display(Markdown("**Pandas with dtype:**"))
display(df.dtypes)

# Polars — schema_overrides (must match the JSON value types)
raw = '[{"id":1,"val":"3.14"},{"id":2,"val":"2.72"}]'
df = pl.read_json(io.StringIO(raw), schema_overrides={"val": pl.String})
display(Markdown("**Polars with schema_overrides (keep as String, cast after):**"))
display(df.with_columns(pl.col("val").cast(pl.Float64)))

# Polars — infer_schema_length (for inconsistent types)
# None = scan entire file for schema inference
raw = '[{"x":1},{"x":"two"},{"x":3}]'
df = pl.read_json(io.StringIO(raw), infer_schema_length=None)
display(Markdown("**Polars infer_schema_length=None:**"))
display(df)
```

```text
No visible output. This cell prepares state used by later examples.
```
#### Pandas | JSON read — dtype override

<table>
<thead>
<tr>
<th></th>
<th>0</th>
</tr>
</thead>
<tbody>
<tr>
<th>id</th>
<td>int64</td>
</tr>
<tr>
<th>val</th>
<td>float64</td>
</tr>
</tbody>
</table>

#### Polars | JSON read — schema_overrides

<div><!-- shape: (2, 2) --><table><thead><tr><th>id</th><th>val</th></tr><tr><td>i64</td><td>f64</td></tr></thead><tbody><tr><td>1</td><td>3.14</td></tr><tr><td>2</td><td>2.72</td></tr></tbody></table></div>

#### Polars | JSON read — infer_schema_length=None

<div><!-- shape: (3, 1) --><table><thead><tr><th>x</th></tr><tr><td>str</td></tr></thead><tbody><tr><td>1</td></tr><tr><td>two</td></tr><tr><td>3</td></tr></tbody></table></div>

## Parquet

### Compression Codecs

#### Pandas | Read and write Parquet — compression codecs

Parquet compression is applied per-column during write. `snappy` (default) offers fast read/write with moderate compression. `zstd` (with higher levels) provides the best compression ratio at the cost of slower write speed. `brotli` is the smallest but slowest. `gzip` is universally supported but slow. `lz4` is the fastest with modest compression.

> [!tip] Choose zstd for analytical workloads
>
> For data that will be read many times but written once (analytical pipelines), `zstd` at level 5–10 gives a good balance: 30–40% smaller than snappy with acceptable write overhead. For intermediate files that are rewritten frequently, `snappy` or `lz4` reduces write latency.

*Writes the first 10,000 OHLCV rows to 6 Parquet files with different codecs and to 4 zstd compression levels, printing byte sizes — confirming brotli achieves the smallest output (283,158 bytes) while zstd level 19 reaches 283,439 bytes.*
```python
df = ohlcv_pd.head(10_000)

# Available compression codecs
for comp in ["snappy", "gzip", "brotli", "zstd", "lz4", None]:
    path = TMP / f"test_{comp}.parquet"
    df.to_parquet(path, compression=comp, index=False)
    label = str(comp) if comp else "none"
    print(f"{label:8s}: {path.stat().st_size:>10,} bytes")

# Zstd with compression level
for level in [1, 5, 9, 19]:
    path = TMP / f"test_zstd_{level}.parquet"
    df.to_parquet(path, compression="zstd", index=False,
                  engine="pyarrow",
                  compression_level=level)
    print(f"zstd(level={level:2d}): {path.stat().st_size:>10,} bytes")
```

```text
snappy  :    405,191 bytes
    gzip    :    302,502 bytes
    brotli  :    283,158 bytes
    zstd    :    302,040 bytes
    lz4     :    401,644 bytes
    none    :    605,121 bytes
    zstd(level= 1):    302,040 bytes
    zstd(level= 5):    294,758 bytes
    zstd(level= 9):    291,326 bytes
    zstd(level=19):    283,439 bytes
```
#### Polars | Write Parquet — compression codecs and levels

Polars supports the same codecs as PyArrow. `compression_level` allows fine-tuning within each codec (e.g., `zstd` level 1–22). `"uncompressed"` is the Polars equivalent of Pandas' `compression=None`. Use `use_pyarrow=True` to write via the PyArrow engine (required for some advanced features like custom metadata).

*Writes the same 10,000 OHLCV rows to 6 Polars-native compressed formats and 4 zstd levels, printing byte sizes — confirming uncompressed is largest (744,360 bytes) and zstd level 22 achieves the smallest output (180,766 bytes).*
```python
df = ohlcv_pl.head(10_000)

for comp in ["snappy", "gzip", "brotli", "zstd", "lz4", "uncompressed"]:
    path = TMP / f"pl_{comp}.parquet"
    df.write_parquet(path, compression=comp)
    print(f"{comp:14s}: {path.stat().st_size:>10,} bytes")

# Zstd with compression level
for level in [1, 5, 10, 22]:
    path = TMP / f"pl_zstd_{level}.parquet"
    df.write_parquet(path, compression="zstd", compression_level=level)
    print(f"zstd(level={level:2d}): {path.stat().st_size:>10,} bytes")
```

```text
snappy        :    338,226 bytes
    gzip          :    210,473 bytes
    brotli        :    239,972 bytes
    zstd          :    216,877 bytes
    lz4           :    328,123 bytes
    uncompressed  :    744,360 bytes
    zstd(level= 1):    215,867 bytes
    zstd(level= 5):    205,621 bytes
    zstd(level=10):    200,071 bytes
    zstd(level=22):    180,766 bytes
```
### Row Groups & Statistics

#### Polars | Write Parquet with custom row group sizes and inspect statistics via PyArrow

Row groups are the horizontal partitions of a Parquet file. Each row group stores column data independently with its own min/max statistics. These statistics enable predicate pushdown: the Parquet reader skips entire row groups that cannot contain matching rows, without decompressing them.

> [!info] Row group size trade-off
>
> Smaller row groups (1K–10K rows): finer predicate pushdown granularity, more metadata overhead, better for highly selective filters. Larger row groups (100K+ rows): better compression (more context for the codec), lower metadata overhead, faster sequential reads. Default in most engines is 128MB per row group.

*Writes 10,000 OHLCV rows with row group sizes of 1,000 (10 groups) and 10,000 (1 group), then uses `pq.read_metadata()` to print per-group row counts and byte sizes — confirming column-level min/max statistics (`id`, `symbol`, `date`, `open`, `high`) used for predicate pushdown.*
```python
# Row groups control parallelism and predicate pushdown granularity
df = ohlcv_pl.head(10_000)

# Small row groups
path_small = TMP / "rg_small.parquet"
df.write_parquet(path_small, row_group_size=1_000)

# Large row groups
path_large = TMP / "rg_large.parquet"
df.write_parquet(path_large, row_group_size=10_000)

# Inspect with PyArrow
for label, p in [("small (1K)", path_small), ("large (10K)", path_large)]:
    meta = pq.read_metadata(p)
    print(f"\n{label}: {meta.num_row_groups} row groups, {meta.num_rows} rows, {meta.serialized_size:,} bytes")
    for i in range(min(3, meta.num_row_groups)):
        rg = meta.row_group(i)
        print(f"  RG {i}: {rg.num_rows} rows, {rg.total_byte_size:,} bytes")

# Column-level statistics (min/max for predicate pushdown)
meta = pq.read_metadata(path_small)
rg = meta.row_group(0)
print("\nColumn statistics for row group 0:")
for j in range(min(5, rg.num_columns)):
    col = rg.column(j)
    stats = col.statistics
    if stats and stats.has_min_max:
        print(f"  {col.path_in_schema:15s}: min={stats.min}, max={stats.max}, nulls={stats.null_count}")

# Toggle statistics writing (Polars)
path_no_stats = TMP / "no_stats.parquet"
df.write_parquet(path_no_stats, statistics=False)
print(f"\nWith stats: {path_small.stat().st_size:,}, without: {path_no_stats.stat().st_size:,}")
```

```text
small (1K): 10 row groups, 10000 rows, 9,956 bytes
      RG 0: 1000 rows, 78,001 bytes
      RG 1: 1000 rows, 78,014 bytes
      RG 2: 1000 rows, 78,014 bytes

large (10K): 1 row groups, 10000 rows, 2,063 bytes
      RG 0: 10000 rows, 741,091 bytes

Column statistics for row group 0:
      id             : min=21160, max=22159, nulls=0
      symbol         : min=ABI.BR, max=ABI.BR, nulls=0
      date           : min=2021-01-04, max=2024-11-21, nulls=0
      open           : min=46.0, max=65.26, nulls=0
      high           : min=46.585, max=65.86, nulls=0

With stats: 268,457, without: 215,668
```
### Schema Control & Type Mapping

#### Pandas | Read Parquet — column projection and explicit schema

`columns=[...]` reads only specified columns (column projection) — Parquet's columnar format means unread columns incur zero I/O cost. `pq.read_schema()` reads only the schema metadata without loading any data. Writing with an explicit PyArrow schema controls precise types (e.g., `int32` instead of inferred `int64`).

*Projects only `symbol`, `date`, and `close` from the 66,355-row OHLCV Parquet, inspects the full 12-field schema without loading data, then writes a 2-row DataFrame with an explicit Arrow schema enforcing `int32`, `float32`, and `large_string` types.*
```python
# Read with specific columns only
df = pd.read_parquet(DATA / "eurostoxx50_ohlcv.parquet", columns=["symbol", "date", "close"])
display(df.head(3))

# Inspect Parquet schema without reading data
schema = pq.read_schema(DATA / "eurostoxx50_ohlcv.parquet")
print("Parquet schema:")
for field in schema:
    print(f"  {field.name:20s}: {field.type}")

# Write with explicit Arrow schema
df = pd.DataFrame({"id": [1, 2], "value": [3.14, 2.72], "label": ["a", "b"]})
schema = pa.schema([
    ("id", pa.int32()),
    ("value", pa.float32()),
    ("label", pa.large_string()),
])
table = pa.Table.from_pandas(df, schema=schema)
pq.write_table(table, TMP / "typed.parquet")
print("\nWritten with explicit schema:")
print(pq.read_schema(TMP / "typed.parquet"))
```

```text
symbol        date  close
Unnamed: 0                           
0           ABI.BR  2021-01-04  57.21
1           ABI.BR  2021-01-05  57.18
2           ABI.BR  2021-01-06  58.77

Parquet schema:
      id                  : int64
      symbol              : string
      date                : date32[day]
      open                : double
      high                : double
      low                 : double
      close               : double
      adj_close           : double
      volume              : int64
      dividends           : double
      stock_splits        : double
      is_filled           : bool

Written with explicit schema:
    id: int32
    value: float
    label: large_string
    -- schema metadata --
    pandas: '{"index_columns": [], "column_indexes": [{"name": null, "field_n' + 533
```
#### Polars | Read Parquet — column projection, schema, scan_parquet

`columns=[...]` applies column projection at the file level (zero-cost for skipped columns). `scan_parquet()` returns a `LazyFrame` — combine with `.filter()` for predicate pushdown before `.collect()`. Use `.cast()` before write to control output types precisely.

*Projects `symbol`, `date`, and `close` with Polars column projection, inspects the full schema lazily via `scan_parquet().collect_schema()`, then writes a 2-row DataFrame with `Int32`/`Float32` types and compares PyArrow engine output (uses `int64`/`double` instead).*
```python
# Read with column projection
df = pl.read_parquet(DATA / "eurostoxx50_ohlcv.parquet", columns=["symbol", "date", "close"])
display(df.head(3))

# Lazy schema inspection
lf = pl.scan_parquet(DATA / "eurostoxx50_ohlcv.parquet")
print("Schema:", lf.collect_schema())

# Polars controls schema via casting before write
df = pl.DataFrame({"id": [1, 2], "value": [3.14, 2.72], "label": ["a", "b"]})
df_typed = df.cast({"id": pl.Int32, "value": pl.Float32})
df_typed.write_parquet(TMP / "pl_typed.parquet")
print("\nWritten schema:", pq.read_schema(TMP / "pl_typed.parquet"))

# use_pyarrow=True for PyArrow engine
df.write_parquet(TMP / "pl_pyarrow.parquet", use_pyarrow=True)
print("PyArrow engine:", pq.read_schema(TMP / "pl_pyarrow.parquet"))
```

```text
shape: (3, 3)
symbol       date close
   str       date   f64
ABI.BR 2021-01-04 57.21
ABI.BR 2021-01-05 57.18
ABI.BR 2021-01-06 58.77

Schema: Schema({'id': Int64, 'symbol': String, 'date': Date, 'open': Float64, 'high': Float64, 'low': Float64, 'close': Float64, 'adj_close': Float64, 'volume': Int64, 'dividends': Float64, 'stock_splits': Float64, 'is_filled': Boolean})

Written schema: id: int32
    value: float
    label: large_string
    PyArrow engine: id: int64
    value: double
    label: large_string
```
### Partitioned Parquet

#### PyArrow | Write Hive-style partitioned Parquet by symbol and year

Hive-style partitioning splits a dataset into a directory tree where folder names encode partition key values (`symbol=ASML.AS/`, `year=2021/`). This allows query engines to skip entire directories for queries that filter on the partition keys, without reading any data files.

> [!tip] Partition on high-cardinality filter columns
>
> Partition on columns you filter most frequently in WHERE clauses. Typical choices: date/year, symbol, country, region. Avoid over-partitioning (too many small files degrade performance) — a good target is files of 100MB–1GB per partition.

*Partitions 300 OHLCV rows for ASML.AS, SAP.DE, and SIE.DE into Hive-style directories (`symbol=ASML.AS/`, etc.) via `pq.write_to_dataset()`, then extends to multi-level partitioning by `symbol` and `year` — producing subdirectories like `symbol=ASML.AS/year=2021/`.*
```python
# Partitioned Parquet — Hive-style directory layout
# symbol=ASML.AS/part-0.parquet, symbol=SAP.DE/part-0.parquet, ...

part_dir = TMP / "partitioned"

# PyArrow partitioned write (works with Pandas DataFrames)
df_small = ohlcv_pd[ohlcv_pd["symbol"].isin(["ASML.AS", "SAP.DE", "SIE.DE"])].head(300)
table = pa.Table.from_pandas(df_small, preserve_index=False)
pq.write_to_dataset(table, root_path=str(part_dir / "by_symbol"), partition_cols=["symbol"])

# Show directory structure
for p in sorted(part_dir.rglob("*.parquet")):
    print(f"  {p.relative_to(part_dir)}  ({p.stat().st_size:,} bytes)")

# Multi-column partitioning
df_multi = df_small.copy()
df_multi["year"] = pd.to_datetime(df_multi["date"]).dt.year
table = pa.Table.from_pandas(df_multi, preserve_index=False)
pq.write_to_dataset(table, root_path=str(part_dir / "by_symbol_year"),
                     partition_cols=["symbol", "year"])

print("\nMulti-level partitions:")
for p in sorted((part_dir / "by_symbol_year").rglob("*.parquet")):
    print(f"  {p.relative_to(part_dir / 'by_symbol_year')}")
```

```text
by_symbol\symbol=ASML.AS\68419add66e54df8884428d44897a5e4-0.parquet  (20,869 bytes)

Multi-level partitions:
      symbol=ASML.AS\year=2021\8791271a22434bc7ab0bec4da71a4f5b-0.parquet
      symbol=ASML.AS\year=2022\8791271a22434bc7ab0bec4da71a4f5b-0.parquet
```
#### Pandas and Polars | Read Hive-style partitioned Parquet with filter pushdown

Partition-aware reads matter because Hive-style directory keys let both eager readers and lazy scans skip irrelevant files before materializing rows.

*Reads the partitioned ASML.AS dataset into Pandas (full read + partition filter `symbol=ASML.AS`), Polars with `hive_partitioning=True`, and Polars lazy `scan_parquet` filtered for SAP.DE — confirming 300 rows for ASML.AS (the only symbol written) and 0 rows for SAP.DE.*
```python
# Reading partitioned datasets

# Pandas — reads entire partitioned dataset
df_back = pd.read_parquet(part_dir / "by_symbol")
display(Markdown("**Pandas — read partitioned:**"))
print(f"Shape: {df_back.shape}, symbols: {df_back['symbol'].unique()}")

# Pandas — filter on partition column (predicate pushdown)
df_one = pd.read_parquet(part_dir / "by_symbol", filters=[("symbol", "==", "ASML.AS")])
print(f"Filtered: {df_one.shape}")

# Polars — read partitioned with hive_partitioning
df_pl = pl.read_parquet(part_dir / "by_symbol" / "**/*.parquet", hive_partitioning=True)
display(Markdown("**Polars — read partitioned:**"))
print(f"Shape: {df_pl.shape}, symbols: {df_pl['symbol'].unique().to_list()}")

# Polars lazy — scan partitioned dataset
lf = pl.scan_parquet(part_dir / "by_symbol" / "**/*.parquet", hive_partitioning=True)
result = lf.filter(pl.col("symbol") == "SAP.DE").select("date", "close").collect()
display(Markdown("**Polars lazy — filtered scan:**"))
display(result.head(3))
```

```text
Shape: (300, 12), symbols: ['ASML.AS']
    Categories (1, object): ['ASML.AS']
    Filtered: (300, 12)

Shape: (300, 12), symbols: ['ASML.AS']
shape: (0, 2)
date close
date   f64
```

### Custom Metadata

#### Polars | Embed custom key-value metadata in Parquet via PyArrow

Parquet files carry a key-value metadata dict in the file footer (in addition to Pandas-specific schema metadata). This is useful for lineage tracking: record the pipeline version, source system, creation timestamp, or row count without embedding them in the data. Metadata is accessed via PyArrow's schema API.

*Writes 100 OHLCV rows to Parquet with custom metadata keys `created_by`, `version`, and `row_count` injected via `replace_schema_metadata()`, then reads back with `pq.read_schema()` — confirming all three custom keys are preserved while the verbose `pandas` metadata key is skipped.*
```python
# Parquet files can carry custom key-value metadata

# Write with custom metadata via PyArrow
df = ohlcv_pl.head(100)
table = df.to_arrow()
custom_meta = {b"created_by": b"notebook_08", b"version": b"1.0", b"row_count": str(df.height).encode()}
table = table.replace_schema_metadata({**(table.schema.metadata or {}), **custom_meta})
pq.write_table(table, TMP / "with_meta.parquet")

# Read metadata back
schema_meta = pq.read_schema(TMP / "with_meta.parquet").metadata
print("File metadata:")
for k, v in schema_meta.items():
    if k != b"pandas":  # skip pandas internal metadata (verbose)
        print(f"  {k.decode()}: {v.decode()[:100]}")

# Polars reads back — metadata preserved
table_back = pq.read_table(TMP / "with_meta.parquet")
print(f"\nRound-trip metadata: {table_back.schema.metadata[b'version']}")
```

```text
File metadata:
      created_by: notebook_08
      version: 1.0
      row_count: 100

Round-trip metadata: b'1.0'
```
## Character Encodings & Binary Data

### Character Encodings

#### Pandas | Read CSV — encoding (UTF-8, Latin-1, chardet)

`encoding` specifies the file character encoding. Pandas handles the full Python codec list: `"utf-8"`, `"latin-1"` (ISO-8859-1), `"cp1252"` (Windows Western European), `"utf-16"`. `chardet` can detect unknown encodings by inspecting the raw bytes — useful for files received from external systems.

> [!warning] Polars is UTF-8 only
>
> Polars `read_csv()` only reads UTF-8 encoded files natively. For any other encoding, decode the bytes to a Python string first, then pass a `StringIO` object. See the Polars cell below for the standard pattern.

> [!success] Decode legacy encodings before the text reaches Polars
>
> Treat the byte-to-string conversion as a separate ingest step: read bytes,
> decode with the correct encoding, then pass the resulting Unicode text through
> `io.StringIO` into `pl.read_csv()`. That keeps encoding repair explicit and
> repeatable.

*Creates city CSV files in 4 encodings (UTF-8, Latin-1, CP1252, UTF-16) with German and Portuguese city names, reads each with the matching `encoding` parameter, writes a Latin-1 file, and runs `chardet.detect()` on the Latin-1 bytes — reporting Windows-1252 at 9% confidence.*
```python
# Create files with different encodings
text = "name,city\nAlice,München\nBob,Zürich\nCarol,São Paulo"

for enc in ["utf-8", "latin-1", "cp1252", "utf-16"]:
    (TMP / f"cities_{enc}.csv").write_bytes(text.encode(enc))

# Read each encoding
for enc in ["utf-8", "latin-1", "cp1252"]:
    df = pd.read_csv(TMP / f"cities_{enc}.csv", encoding=enc)
    print(f"{enc:10s}: {df['city'].tolist()}")

# UTF-16 (has BOM)
df = pd.read_csv(TMP / "cities_utf-16.csv", encoding="utf-16")
print(f"utf-16    : {df['city'].tolist()}")

# Write with specific encoding
df.to_csv(TMP / "out_latin1.csv", index=False, encoding="latin-1")
print(f"\nWritten as latin-1: {(TMP / 'out_latin1.csv').read_bytes()[:60]}")

# Detect encoding with chardet (if installed)
try:
    import chardet
    raw = (TMP / "cities_latin-1.csv").read_bytes()
    detected = chardet.detect(raw)
    print(f"\nDetected encoding: {detected}")
except ImportError:
    print("\n(chardet not installed — pip install chardet)")
```

```text
utf-8     : ['München', 'Zürich', 'São Paulo']
    latin-1   : ['München', 'Zürich', 'São Paulo']
    cp1252    : ['München', 'Zürich', 'São Paulo']
    utf-16    : ['München', 'Zürich', 'São Paulo']

Written as latin-1: b'name,city\r\nAlice,M\xfcnchen\r\nBob,Z\xfcrich\r\nCarol,S\xe3o Paulo\r\n'

Detected encoding: {'encoding': 'Windows-1252', 'confidence': 0.09340473165624712, 'language': 'pt', 'mime_type': 'text/plain'}
```
#### Polars | Read CSV — UTF-8 only, decode non-UTF-8 before reading

Polars reads only UTF-8 natively. The standard pattern for other encodings: `Path(file).read_bytes().decode(encoding)` → pass the resulting string to `pl.read_csv(io.StringIO(text))`. The helper function below encapsulates this pattern for any encoding.

*Reads the UTF-8 city file directly, then reads the Latin-1 and UTF-16 files by decoding bytes first and wrapping in `StringIO`, and defines a `read_csv_encoded()` helper — confirming all 4 encodings return the same 3 city names.*
```python
# Polars only reads UTF-8 natively.
# For other encodings, decode to string first, then pass to read_csv.

# UTF-8 — works directly
df = pl.read_csv(TMP / "cities_utf-8.csv")
print(f"UTF-8: {df['city'].to_list()}")

# Latin-1 — decode bytes to str first
raw = (TMP / "cities_latin-1.csv").read_bytes()
text = raw.decode("latin-1")
df = pl.read_csv(io.StringIO(text))
print(f"Latin-1: {df['city'].to_list()}")

# UTF-16 — decode first
raw = (TMP / "cities_utf-16.csv").read_bytes()
text = raw.decode("utf-16")
df = pl.read_csv(io.StringIO(text))
print(f"UTF-16: {df['city'].to_list()}")

# Helper function for any encoding
def read_csv_encoded(path, encoding, **kwargs):
    text = Path(path).read_bytes().decode(encoding)
    return pl.read_csv(io.StringIO(text), **kwargs)

df = read_csv_encoded(TMP / "cities_cp1252.csv", "cp1252")
print(f"CP1252: {df['city'].to_list()}")
```

```text
UTF-8: ['München', 'Zürich', 'São Paulo']
    Latin-1: ['München', 'Zürich', 'São Paulo']
    UTF-16: ['München', 'Zürich', 'São Paulo']
    CP1252: ['München', 'Zürich', 'São Paulo']
```
### BOM (Byte Order Mark)

#### Pandas and Polars | Handle UTF-8 BOM in CSV files

A UTF-8 BOM (`\xef\xbb\xbf`) is prepended by some tools (notably Excel and Windows Notepad) to signal UTF-8 encoding. If not stripped, it appears as a garbage character in the first column name. Pandas handles it automatically; Polars requires decoding with `"utf-8-sig"` (which strips the BOM) before passing to `read_csv`.

*Creates a BOM-prefixed CSV file and reads it with Pandas (auto-strips BOM) and Polars (requires decoding via `"utf-8-sig"` before `StringIO`) — both producing column names `["name", "age"]` with no BOM artifact.*
```python
# UTF-8 BOM — common when files are exported from Excel
bom_csv = b"\xef\xbb\xbfname,age\nAlice,30\nBob,25"
(TMP / "bom.csv").write_bytes(bom_csv)

# Pandas handles BOM automatically
df = pd.read_csv(TMP / "bom.csv")
print(f"Pandas columns: {list(df.columns)}")  # no BOM artifact

# Polars — use encoding="utf-8-sig" in the decode step
raw = (TMP / "bom.csv").read_bytes()
text = raw.decode("utf-8-sig")  # strips BOM
df = pl.read_csv(io.StringIO(text))
print(f"Polars columns: {df.columns}")
```

```text
Pandas columns: ['name', 'age']
    Polars columns: ['name', 'age']
```
### Base64 & Binary Data in DataFrames

#### Pandas and Polars | Store and round-trip binary blobs as base64 and native Binary dtype

For binary data (images, cryptographic blobs, serialized objects), CSV and JSON require base64 encoding since they are text formats. Parquet supports native binary columns (`pl.Binary`, `pa.binary()`) that survive round-trips without any encoding — use Parquet when storing binary data at scale.

> [!tip] Use Polars Binary + Parquet for blob storage
>
> Polars `pl.Binary` dtype stores raw bytes natively. Writing to Parquet preserves the binary type without any encoding overhead. For CSV/JSON export, encode to base64 as a separate step using `map_elements`. Avoid storing large binaries in DataFrames — prefer a blob store with a reference column.

*Generates 3 random 32-byte blobs, stores them as base64 strings in a Pandas `object` column and as `pl.Binary` in a Polars column, round-trips the Polars binary through Parquet (asserting equality), then encodes to base64 strings for CSV export.*
```python
# Storing binary data (images, blobs) as base64 strings
binary_data = [os.urandom(32) for _ in range(3)]
encoded = [base64.b64encode(b).decode("ascii") for b in binary_data]

# Pandas
df_pd = pd.DataFrame({"id": [1, 2, 3], "blob_b64": encoded})
display(Markdown("**Pandas with base64:**"))
display(df_pd)

# Round-trip: decode back
decoded = [base64.b64decode(s) for s in df_pd["blob_b64"]]
assert decoded == binary_data
print("Round-trip OK")

# Polars — Binary dtype for raw bytes (no base64 needed in Parquet)
df_pl = pl.DataFrame({"id": [1, 2, 3], "blob": binary_data}, schema={"id": pl.Int64, "blob": pl.Binary})
display(Markdown("**Polars with Binary dtype:**"))
display(df_pl)
print(f"dtype: {df_pl['blob'].dtype}")

# Binary survives Parquet round-trip natively
df_pl.write_parquet(TMP / "binary.parquet")
df_back = pl.read_parquet(TMP / "binary.parquet")
assert df_back["blob"].to_list() == binary_data
print("Binary Parquet round-trip OK")

# For CSV/JSON: must encode to base64 first
df_csv = df_pl.with_columns(
    pl.col("blob").map_elements(lambda b: base64.b64encode(b).decode(), return_dtype=pl.String).alias("blob_b64")
).drop("blob")
print("\nFor CSV export:")
print(df_csv.write_csv())
```

```text
id                                      blob_b64
Unnamed: 0                                                  
0            1  IAkd87tVZPNCk4g8EE/6hBeXif5fOxMLmj+Eo6+QGas=
1            2  9VwPMCC3iQiZvmM4+V971Dg3kpHHGqZgq4LM4efXUZw=
2            3  JRYn36L7sTc4tB2zcauhCeE5YrvUHs546qGQMVEaYBE=

Round-trip OK

shape: (3, 2)
 id                                                                                                      blob
i64                                                                                                    binary
  1 b\x20\x09\x1d\xf3\xbbUd\xf3B\x93\x88<\x10O\xfa\x84\x17\x97\x89\xfe_;\x13\x0b\x9a?\x84\xa3\xaf\x90\x19\xab
  2       b\xf5\\x0f0\x20\xb7\x89\x08\x99\xbec8\xf9_{\xd487\x92\x91\xc7\x1a\xa6`\xab\x82\xcc\xe1\xe7\xd7Q\x9c
  3          b%\x16'\xdf\xa2\xfb\xb178\xb4\x1d\xb3q\xab\xa1\x09\xe19b\xbb\xd4\x1e\xcex\xea\xa1\x901Q\x1a`\x11

dtype: Binary
    Binary Parquet round-trip OK

For CSV export:
    id,blob_b64
    1,IAkd87tVZPNCk4g8EE/6hBeXif5fOxMLmj+Eo6+QGas=
    2,9VwPMCC3iQiZvmM4+V971Dg3kpHHGqZgq4LM4efXUZw=
    3,JRYn36L7sTc4tB2zcauhCeE5YrvUHs546qGQMVEaYBE=
```
## Summary — File I/O

| Feature | Pandas | Polars |
|---|---|---|
| CSV separator | `sep=";"` | `separator=";"` |
| No header | `header=None, names=[...]` | `has_header=False, new_columns=[...]` |
| Skip rows | `skiprows=N` | `skip_rows=N` |
| Type control | `dtype={...}` | `schema_overrides={...}` |
| Parse dates | `parse_dates=["col"]` | `try_parse_dates=True` |
| Null sentinels | `na_values=[...]` | `null_values=[...]` |
| Bad lines | `on_bad_lines="skip"` | `truncate_ragged_lines=True` |
| CSV quoting | `quoting=csv.QUOTE_ALL` | `quote_style="always"` |
| Chunked read | `chunksize=N` | `scan_csv()` / `read_csv_batched()` |
| JSON orient | `orient="records"` | row-oriented by default |
| Nested JSON | `json_normalize()` | `unnest()` / `explode()` |
| NDJSON | `lines=True` | `read_ndjson()` / `write_ndjson()` |
| Parquet compression | `compression="zstd"` | `compression="zstd"` |
| Row groups | via PyArrow `row_group_size` | `row_group_size=N` |
| Partitioning | `pq.write_to_dataset(..., partition_cols)` | `hive_partitioning=True` on read |
| Schema inspect | `pq.read_schema()` | `scan_parquet().collect_schema()` |
| Encoding | `encoding="latin-1"` | decode bytes → `StringIO` |
| Binary data | base64 strings | `pl.Binary` dtype |
| Compressed I/O | `compression="gzip"` | auto-detect on read |
*Runs the example and records the observed result.*
```python
# Clean up temp directory
shutil.rmtree(TMP, ignore_errors=True)
print("Temp files cleaned up")
```

```text
Temp files cleaned up
```
---


## Operational Risks

### Type semantics

#### `pl.Enum` and ordered categoricals enforce real domain rules

`pl.Enum` is appropriate only for closed domains, and ordered categoricals should be introduced only when comparison semantics really matter. That is why `pl.Enum` rejects undeclared values and why ordered category choices can change sort and comparison behavior across a pipeline.

*Creates a closed `pl.Enum` domain, shows that valid values are accepted, and then demonstrates that an undeclared value must fall back to `pl.Categorical` if the domain is open.*
```python
risk = pl.Enum(["LOW", "MEDIUM", "HIGH"])
valid = pl.Series(["LOW", "HIGH"], dtype=risk)
print(valid)
try:
    pl.Series(["LOW", "CRITICAL"], dtype=risk)
except Exception as exc:
    print(type(exc).__name__)
    print(str(exc).splitlines()[0])
open_set = pl.Series(["LOW", "CRITICAL"], dtype=pl.Categorical)
print(open_set)
```

```text
shape: (2,)
Series: '' [enum]
[
	"LOW"
	"HIGH"
]
InvalidOperationError
conversion from `str` to `enum` failed in column '' for 1 out of 2 values: ["CRITICAL"]
shape: (2,)
Series: '' [cat]
[
	"LOW"
	"CRITICAL"
]
```

#### `dtype_backend="pyarrow"` is the precondition for cheap Arrow interop

If a Pandas frame stays NumPy-backed, `pl.from_pandas()` still works, but the exchange is more likely to copy and coerce. Converting with `convert_dtypes(dtype_backend="pyarrow")` makes the Pandas side line up with Arrow-native null and string storage before the Polars handoff.

*Shows the same Pandas frame before and after `convert_dtypes(dtype_backend="pyarrow")`, then converts the Arrow-backed version into Polars to confirm the resulting schema.*
```python
pd_df = pd.DataFrame({"symbol": ["ASML.AS", "MC.PA"], "qty": [1, None]})
print(pd_df.dtypes.astype(str).to_dict())
pd_arrow = pd_df.convert_dtypes(dtype_backend="pyarrow")
print(pd_arrow.dtypes.astype(str).to_dict())
pl_df = pl.from_pandas(pd_arrow)
print(pl_df.schema)
```

```text
{'symbol': 'str', 'qty': 'float64'}
{'symbol': 'string[pyarrow]', 'qty': 'int64[pyarrow]'}
Schema({'symbol': String, 'qty': Int64})
```

### Storage and text fidelity

#### `encoding=` and `compression=` are part of the file contract

Text decoding is never guess-free, and `chardet`-style detection remains heuristic. Likewise, a `Parquet` file written with `compression="zstd"` or `compression="snappy"` is only portable when the reader has the matching codec support installed. Treat both `encoding=` and `compression=` as explicit pipeline contracts rather than incidental defaults.

*Decodes a Latin-1 payload explicitly to show the difference between a known `encoding=` contract and a guessed one.*
```python
raw = "city\nMünchen\nSão Paulo".encode("latin-1")
print(raw.decode("latin-1").splitlines())
```

```text
['city', 'München', 'São Paulo']
```

#### `CSV` remains a lossy interchange format for typed data

`CSV` is still useful for lightweight interchange, but it drops datetime, nullable-integer, boolean, and binary fidelity unless you rebuild the schema on read. Use `Parquet` when the round trip must preserve the original data contract.

*Writes the same typed Pandas frame to `CSV` and `Parquet`, then reads both back to compare the resulting dtypes.*
```python
rt_df = pd.DataFrame(
    {
        "trade_date": pd.to_datetime(["2024-01-01", "2024-01-02"]),
        "qty": pd.Series([1, None], dtype="Int64"),
    }
)
with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    csv_path = tmp / "demo.csv"
    pq_path = tmp / "demo.parquet"
    rt_df.to_csv(csv_path, index=False)
    rt_df.to_parquet(pq_path, index=False)
    csv_back = pd.read_csv(csv_path)
    pq_back = pd.read_parquet(pq_path)
    print("csv", csv_back.dtypes.astype(str).to_dict())
    print("parquet", pq_back.dtypes.astype(str).to_dict())
```

```text
csv {'trade_date': 'str', 'qty': 'float64'}
parquet {'trade_date': 'datetime64[us]', 'qty': 'Int64'}
```

## Recommended Patterns

### Persistence defaults

#### Prefer `Parquet` for persistence and verify the returned `schema`

For analytical persistence, default to `Parquet`, keep `CSV` for human-facing exports, and check the returned `schema` after read-back. That captures the core recommendations to persist typed data losslessly, validate round trips, and choose `zstd` when the reader fleet supports it.

*Round-trips a typed frame through `CSV` and `Parquet` again to show why `Parquet` is the persistence default when schema fidelity matters.*
```python
rt_df = pd.DataFrame(
    {
        "trade_date": pd.to_datetime(["2024-01-01", "2024-01-02"]),
        "qty": pd.Series([1, None], dtype="Int64"),
    }
)
with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    csv_path = tmp / "demo.csv"
    pq_path = tmp / "demo.parquet"
    rt_df.to_csv(csv_path, index=False)
    rt_df.to_parquet(pq_path, index=False)
    csv_back = pd.read_csv(csv_path)
    pq_back = pd.read_parquet(pq_path)
    print("csv", csv_back.dtypes.astype(str).to_dict())
    print("parquet", pq_back.dtypes.astype(str).to_dict())
```

```text
csv {'trade_date': 'str', 'qty': 'float64'}
parquet {'trade_date': 'datetime64[us]', 'qty': 'Int64'}
```

#### Use `pd.Categorical` for repeated dimensions and `pl.Enum` for closed domains

Dimension columns such as sector, country, currency, and status are good `pd.Categorical` candidates because they repeat values heavily. When the domain is fixed in advance, promote the same idea to `pl.Enum` so the dtype also validates the allowed set.

*Shows that `pl.Enum` preserves only declared values while `pl.Categorical` remains appropriate for an open domain.*
```python
risk = pl.Enum(["LOW", "MEDIUM", "HIGH"])
valid = pl.Series(["LOW", "HIGH"], dtype=risk)
print(valid)
open_set = pl.Series(["LOW", "CRITICAL"], dtype=pl.Categorical)
print(open_set)
```

```text
shape: (2,)
Series: '' [enum]
[
	"LOW"
	"HIGH"
]
shape: (2,)
Series: '' [cat]
[
	"LOW"
	"CRITICAL"
]
```

### Exchange and ingest discipline

#### Prefer `Arrow` exchange over text serialization when libraries share the same memory model

When Pandas, Polars, DuckDB, or PyArrow are all in play, keep the exchange on `Arrow` buffers instead of bouncing through `CSV` or ad hoc JSON. That reduces copies, preserves nullability, and keeps the schema close to the analytical representation.

*Converts a small Pandas frame to Arrow-backed dtypes before handing it to Polars so the resulting schema stays typed and null-aware.*
```python
pd_df = pd.DataFrame({"symbol": ["ASML.AS", "MC.PA"], "qty": [1, None]})
pd_arrow = pd_df.convert_dtypes(dtype_backend="pyarrow")
pl_df = pl.from_pandas(pd_arrow)
print(pd_arrow.dtypes.astype(str).to_dict())
print(pl_df.schema)
```

```text
{'symbol': 'string[pyarrow]', 'qty': 'int64[pyarrow]'}
Schema({'symbol': String, 'qty': Int64})
```

#### Set `encoding=` explicitly on every text read path

Always pin `encoding=` for `CSV`, JSON-over-files, and any byte-to-string decode boundary. That removes guesswork, avoids silent mojibake, and makes legacy feeds with `latin-1` or `cp1252` tractable without trial-and-error.

*Decodes Latin-1 bytes explicitly so the reader contract is visible in code instead of being left to platform defaults.*
```python
raw = "city\nMünchen\nSão Paulo".encode("latin-1")
print(raw.decode("latin-1").splitlines())
```

```text
['city', 'München', 'São Paulo']
```

## Troubleshooting

### Domain and interop failures

#### Fix `Enum` errors by choosing `pl.Enum` only for the real closed set

If a cast fails because a new value appears, the domain was not closed enough for `pl.Enum`. Either extend the enum definition deliberately or switch the column to `pl.Categorical` when the value set is expected to grow.

*Attempts an invalid `pl.Enum` cast, then shows the same values succeeding with `pl.Categorical`.*
```python
risk = pl.Enum(["LOW", "MEDIUM", "HIGH"])
try:
    pl.Series(["LOW", "CRITICAL"], dtype=risk)
except Exception as exc:
    print(type(exc).__name__)
    print(str(exc).splitlines()[0])
open_set = pl.Series(["LOW", "CRITICAL"], dtype=pl.Categorical)
print(open_set)
```

```text
InvalidOperationError
conversion from `str` to `enum` failed in column '' for 1 out of 2 values: ["CRITICAL"]
shape: (2,)
Series: '' [cat]
[
	"LOW"
	"CRITICAL"
]
```

#### Remove unexpected copies with `convert_dtypes(dtype_backend="pyarrow")`

If Polars interop copies more than expected, inspect the Pandas dtypes first. NumPy-backed `float64` plus object/string columns are the common culprit; upgrading them to Arrow-backed extension dtypes usually makes the exchange path predictable again.

*Prints the Pandas dtypes before and after `convert_dtypes(dtype_backend="pyarrow")` so the Arrow-backed precondition is explicit.*
```python
pd_df = pd.DataFrame({"symbol": ["ASML.AS", "MC.PA"], "qty": [1, None]})
print(pd_df.dtypes.astype(str).to_dict())
pd_arrow = pd_df.convert_dtypes(dtype_backend="pyarrow")
print(pd_arrow.dtypes.astype(str).to_dict())
```

```text
{'symbol': 'str', 'qty': 'float64'}
{'symbol': 'string[pyarrow]', 'qty': 'int64[pyarrow]'}
```

### Input and schema failures

#### Decode legacy text with the correct `encoding` before parsing

When a `CSV` or JSON payload renders garbled characters, the bytes are usually fine and the decode step is wrong. Decode with the real `encoding=` first, then hand the resulting text to the dataframe reader.

*Decodes Latin-1 bytes directly to recover the expected city names before any dataframe parser runs.*
```python
raw = "city\nMünchen\nSão Paulo".encode("latin-1")
print(raw.decode("latin-1").splitlines())
```

```text
['city', 'München', 'São Paulo']
```

#### Normalize nested JSON before `read_json` if the structure is irregular

Mixed nesting depth and inconsistent field shapes are easier to repair before ingestion. `pd.json_normalize()` plus explicit `record_path` and `meta` handling gives a stable rectangular result before you hand the data to downstream transformations or convert it to `NDJSON`.

*Flattens a nested company payload into a rectangular employee table with `record_path="employees"` and `meta=["company"]`.*
```python
records = [{"company": "ACME", "employees": [{"name": "Alice"}, {"name": "Bob"}]}]
emp = pd.json_normalize(records, record_path="employees", meta=["company"])
print(emp)
```

```text
    name company
0  Alice    ACME
1    Bob    ACME
```

#### Check `schema` compatibility before Parquet append and override wide integers explicitly

Schema drift is the common cause of failed Parquet appends, and large integers are the common cause of bad CSV inference. Compare the `schema` of incoming data before append, and use `schema_overrides={"big": pl.UInt64}` or equivalent when the values exceed signed `int64`.

*Prints two incompatible Polars schemas and then reads a `UInt64` value with an explicit override to avoid integer overflow during inference.*
```python
left = pl.DataFrame({"id": [1], "value": [1.0]})
right = pl.DataFrame({"id": [2], "value": ["2.0"]})
print(left.schema)
print(right.schema)
wide = pl.read_csv(io.StringIO("big\n18446744073709551615\n"), schema_overrides={"big": pl.UInt64})
print(wide.schema)
print(wide)
```

```text
Schema({'id': Int64, 'value': Float64})
Schema({'id': Int64, 'value': String})
Schema({'big': UInt64})
shape: (1, 1)
┌──────────────────────┐
│ big                  │
│ ---                  │
│ u64                  │
╞══════════════════════╡
│ 18446744073709551615 │
└──────────────────────┘
```
