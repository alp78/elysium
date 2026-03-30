---
type: reference
category: programming-languages
technology:
  - python
  - pandas
  - polars
tags: [pipeline, python, pandas, polars]
aliases:
  - categoricals, nested types, Arrow, zero-copy
keywords: [Categorical, Enum, Struct, List, Array, ArrowDtype, to_arrow, from_arrow, zero-copy, PyArrow]
description: "Pandas/Polars DataFrame reference 07/10 — Advanced Types & Interoperability (categoricals, nested types, Arrow, zero-copy). Side-by-side executable examples with cell outputs."
related:
  - "[[moc-dataframes]]"
  - "[[07_cs_types_interop]]"
  - "[[moc-programming-languages]]"
  - "[[06_py_lazy_performance]]"
  - "[[08_py_visualization]]"
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# 07 — Advanced Types & Interoperability

Categoricals, nested types, library conversions.

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

    OHLCV: (66355, 12), Dim: (169, 26), Scores: (466, 36)

## Categorical


- **Categorical**: Store repeated strings as integer codes (Pandas).
- **Memory Usage**: Measure RAM consumption (Pandas).

```python
dim_pd["sector_cat"] = pd.Categorical(dim_pd["sector"])
print(f"Categories: {dim_pd["sector_cat"].cat.categories.tolist()[:5]}")
print(f"Memory: str={dim_pd["sector"].memory_usage()}, cat={dim_pd["sector_cat"].memory_usage()}")
```

    Categories: ['Basic Materials', 'Communication Services', 'Consumer Cyclical', 'Consumer Defensive', 'Energy']
    Memory: str=1484, cat=681

### Polars


- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **Categorical**: Store repeated strings as integer codes. Saves memory, speeds up groupby.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

```python
dim_cat = dim_pl.with_columns(pl.col("sector").cast(pl.Categorical).alias("sector_cat"))
print(f"dtype: {dim_cat["sector_cat"].dtype}")
display(dim_cat.select("symbol", "sector", "sector_cat").head(5))
```

    dtype: Categorical

<div><!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>sector</th><th>sector_cat</th></tr><tr><td>str</td><td>str</td><td>cat</td></tr></thead><tbody><tr><td>ASML.AS</td><td>Technology</td><td>Technology</td></tr><tr><td>MC.PA</td><td>Consumer Cyclical</td><td>Consumer Cyclical</td></tr><tr><td>RMS.PA</td><td>Consumer Cyclical</td><td>Consumer Cyclical</td></tr><tr><td>OR.PA</td><td>Consumer Defensive</td><td>Consumer Defensive</td></tr><tr><td>SAP.DE</td><td>Technology</td><td>Technology</td></tr></tbody></table></div>

## Polars Enum


- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **Enum**: Categorical with fixed, ordered values. Sorting respects the defined order.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

```python
risk=pl.Enum(["LOW","MEDIUM","HIGH","CRITICAL"])
df=pl.DataFrame({"alert":["HIGH","LOW","MEDIUM"]}).with_columns(pl.col("alert").cast(risk).alias("risk_enum"))
display(df.sort("risk_enum"))
```

<div><!-- shape: (3, 2) --><table><thead><tr><th>alert</th><th>risk_enum</th></tr><tr><td>str</td><td>enum</td></tr></thead><tbody><tr><td>LOW</td><td>LOW</td></tr><tr><td>MEDIUM</td><td>MEDIUM</td></tr><tr><td>HIGH</td><td>HIGH</td></tr></tbody></table></div>

## List Type (Polars)


- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **List Ops**: Access elements inside list columns: .list.len(), .list.first(), .list.contains().
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **Alias**: Give an expression result a column name (Polars).

```python
df=pl.DataFrame({"symbol":["ASML.AS","MC.PA"],"tags":[["tech","nl"],["luxury","fr"]]})
display(df.with_columns(
    pl.col("tags").list.len().alias("count"),
    pl.col("tags").list.first().alias("first"),
))
```

<div><!-- shape: (2, 4) --><table><thead><tr><th>symbol</th><th>tags</th><th>count</th><th>first</th></tr><tr><td>str</td><td>list[str]</td><td>u32</td><td>str</td></tr></thead><tbody><tr><td>ASML.AS</td><td>[tech, nl]</td><td>2</td><td>tech</td></tr><tr><td>MC.PA</td><td>[luxury, fr]</td><td>2</td><td>luxury</td></tr></tbody></table></div>

## Struct Type (Polars)


- **Unnest**: Flatten a Struct column into separate columns.

```python
df=pl.DataFrame({"symbol":["ASML.AS"],"scores":[{"momentum":0.8,"value":0.5}]})
display(df.unnest("scores"))
```

<div><!-- shape: (1, 3) --><table><thead><tr><th>symbol</th><th>momentum</th><th>value</th></tr><tr><td>str</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>ASML.AS</td><td>0.8</td><td>0.5</td></tr></tbody></table></div>

## Arrow-Backed Dtypes (Pandas 2.x)

```python
df = pd.DataFrame({"symbol": pd.array(["ASML.AS", "MC.PA"], dtype="string[pyarrow]")})
print(f"dtype: {df["symbol"].dtype}")
```

    dtype: string

## Summary

| Type | Pandas | Polars |
|---|---|---|
| Categorical | pd.Categorical | pl.Categorical |
| Ordered | CategoricalDtype(ordered) | pl.Enum |
| List | N/A | pl.List |
| Struct | N/A | pl.Struct |
| Arrow string | string[pyarrow] | pl.Utf8 |

---
# Part 2: Interoperability

```python
ohlcv_pl=pl.read_parquet(DATA/"eurostoxx50_ohlcv.parquet")
scores_pl=pl.read_parquet(DATA/"scores_daily.parquet")
```

## Polars to Pandas


- **To Pandas**: Convert Polars DataFrame to Pandas. May copy data.

```python
pdf=ohlcv_pl.head(5).to_pandas()
print(f"Type: {type(pdf)}")
display(pdf)
```

    Type: <class 'pandas.core.frame.DataFrame'>

<table>
  <thead>
    <tr>
      <th></th>
      <th>id</th>
      <th>symbol</th>
      <th>date</th>
      <th>open</th>
      <th>high</th>
      <th>low</th>
      <th>close</th>
      <th>adj_close</th>
      <th>volume</th>
      <th>dividends</th>
      <th>stock_splits</th>
      <th>is_filled</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>21160</td>
      <td>ABI.BR</td>
      <td>2021-01-04</td>
      <td>58.15</td>
      <td>58.85</td>
      <td>56.78</td>
      <td>57.21</td>
      <td>53.5761</td>
      <td>1513937</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>1</th>
      <td>21161</td>
      <td>ABI.BR</td>
      <td>2021-01-05</td>
      <td>56.90</td>
      <td>57.98</td>
      <td>56.75</td>
      <td>57.18</td>
      <td>53.5480</td>
      <td>1382722</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>2</th>
      <td>21162</td>
      <td>ABI.BR</td>
      <td>2021-01-06</td>
      <td>57.96</td>
      <td>58.94</td>
      <td>57.39</td>
      <td>58.77</td>
      <td>55.0370</td>
      <td>1370204</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>3</th>
      <td>21163</td>
      <td>ABI.BR</td>
      <td>2021-01-07</td>
      <td>58.68</td>
      <td>58.86</td>
      <td>57.88</td>
      <td>58.40</td>
      <td>54.6905</td>
      <td>1469911</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>4</th>
      <td>21164</td>
      <td>ABI.BR</td>
      <td>2021-01-08</td>
      <td>58.16</td>
      <td>58.40</td>
      <td>57.43</td>
      <td>57.86</td>
      <td>54.1848</td>
      <td>1428681</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
  </tbody>
</table>

## Pandas to Polars


- **From Pandas**: Convert Pandas DataFrame to Polars.

```python
plf=pl.from_pandas(pdf)
print(f"Type: {type(plf)}")
display(plf)
```

    Type: <class 'polars.dataframe.frame.DataFrame'>

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>datetime[ms]</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04 00:00:00</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05 00:00:00</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06 00:00:00</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07 00:00:00</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08 00:00:00</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

## Polars to NumPy


- **To NumPy**: Extract column as NumPy array.

```python
arr=ohlcv_pl["close"].head(5).to_numpy()
print(f"Type: {type(arr)}, dtype: {arr.dtype}, values: {arr}")
```

    Type: <class 'numpy.ndarray'>, dtype: float64, values: [57.21 57.18 58.77 58.4  57.86]

## Polars to Arrow


- **To Arrow**: Convert to Apache Arrow table. Zero-copy (Polars uses Arrow internally).

```python
arrow_table=ohlcv_pl.head(5).to_arrow()
print(f"Type: {type(arrow_table)}")
print(f"Schema: {arrow_table.schema}")
```

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

## Arrow to Polars

```python
back=pl.from_arrow(arrow_table)
display(back)
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

## Polars to Dict



```python
d=scores_pl.head(3).select("symbol","composite_score").to_dicts()
print(f"Type: {type(d)}")
for row in d: print(f"  {row}")
```

    Type: <class 'list'>
      {'symbol': 'BNP.PA', 'composite_score': 0.6839467847784353}
      {'symbol': 'DTE.DE', 'composite_score': 0.5150053634526331}
      {'symbol': 'IFX.DE', 'composite_score': 0.5122353361255053}

## Zero-Copy


- **To Arrow**: Convert to Apache Arrow table. Zero-copy (Polars uses Arrow internally).

```python
# Zero-copy: Polars -> Arrow -> Polars
table=ohlcv_pl.to_arrow()
back=pl.from_arrow(table)
print(f"Same data, no copy: {back.shape}")
```

    Same data, no copy: (66355, 12)

## Summary

| Conversion | Function | Zero-Copy? |
|---|---|---|
| Polars to Pandas | .to_pandas() | Sometimes |
| Pandas to Polars | pl.from_pandas() | No |
| Polars to Arrow | .to_arrow() | Yes |
| Arrow to Polars | pl.from_arrow() | Yes |
| Polars to NumPy | .to_numpy() | Depends on dtype |

---
# Part 3: File I/O — Exhaustive Reference

Advanced reading and writing for CSV, JSON, and Parquet.
Covers every major option: encoding, compression, schema, partitioning, nested data, and edge cases.

```python
TMP = Path(tempfile.mkdtemp())
print(f"Temp dir: {TMP}")
```

    Temp dir: C:\Users\aperi\AppData\Local\Temp\tmpmnzrnm_0

## CSV

### Separators & Delimiters

#### Pandas read_csv sep — tab, pipe, fixed-width delimiters

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

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>age</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>30</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>25</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>score</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>3.14</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>2.72</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>city</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>New York</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>London</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>age</th>
      <th>city</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>30</td>
      <td>NYC</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>25</td>
      <td>LON</td>
    </tr>
  </tbody>
</table>

#### Polars read_csv separator — tab, pipe, fixed-width delimiters

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

<div><!-- shape: (2, 2) --><table><thead><tr><th>name</th><th>age</th></tr><tr><td>str</td><td>i64</td></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr><tr><td>Bob</td><td>25</td></tr></tbody></table></div>

<div><!-- shape: (2, 2) --><table><thead><tr><th>name</th><th>score</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>Alice</td><td>3.14</td></tr><tr><td>Bob</td><td>2.72</td></tr></tbody></table></div>

<div><!-- shape: (2, 2) --><table><thead><tr><th>name</th><th>city</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>Alice</td><td>New York</td></tr><tr><td>Bob</td><td>London</td></tr></tbody></table></div>

### Column Names & Headers

#### Pandas read_csv — header, names, usecols, prefix

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

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>age</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>30</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>25</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>age</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>30</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>25</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>age</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>30</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>25</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>group</th>
      <th colspan="2" halign="left">A</th>
      <th colspan="2" halign="left">B</th>
    </tr>
    <tr>
      <th></th>
      <th>metric</th>
      <th>x</th>
      <th>y</th>
      <th>x</th>
      <th>y</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>NaN</td>
      <td>1</td>
      <td>2</td>
      <td>3</td>
      <td>4</td>
    </tr>
  </tbody>
</table>

#### Polars read_csv — has_header, new_columns, column selection

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

<div><!-- shape: (2, 2) --><table><thead><tr><th>name</th><th>age</th></tr><tr><td>str</td><td>i64</td></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr><tr><td>Bob</td><td>25</td></tr></tbody></table></div>

<div><!-- shape: (2, 2) --><table><thead><tr><th>name</th><th>age</th></tr><tr><td>str</td><td>i64</td></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr><tr><td>Bob</td><td>25</td></tr></tbody></table></div>

<div><!-- shape: (2, 2) --><table><thead><tr><th>name</th><th>age</th></tr><tr><td>str</td><td>i64</td></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr><tr><td>Bob</td><td>25</td></tr></tbody></table></div>

### Type Control & Parsing

#### Pandas read_csv dtype, parse_dates, converters — type control

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
      <td>int32</td>
    </tr>
    <tr>
      <th>name</th>
      <td>category</td>
    </tr>
    <tr>
      <th>score</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>date</th>
      <td>object</td>
    </tr>
    <tr>
      <th>active</th>
      <td>boolean</td>
    </tr>
  </tbody>
</table>

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
      <th>name</th>
      <td>object</td>
    </tr>
    <tr>
      <th>score</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>date</th>
      <td>datetime64[ns]</td>
    </tr>
    <tr>
      <th>active</th>
      <td>bool</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>dt</th>
      <th>val</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>2024-01-15</td>
      <td>10</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2024-02-20</td>
      <td>20</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>score</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>3.14</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>2</th>
      <td>Carol</td>
      <td>NaN</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>score</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>3.14</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>2</th>
      <td>Carol</td>
      <td>NaN</td>
    </tr>
  </tbody>
</table>

#### Polars read_csv dtypes, try_parse_dates — type control and parsing

```python
# Per-column null values (one sentinel per column)
df = pl.read_csv(io.StringIO(raw3), null_values={"score": "N/A"})
display(df)
```

<div><!-- shape: (3, 2) --><table><thead><tr><th>name</th><th>score</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>Alice</td><td>3.14</td></tr><tr><td>Bob</td><td>null</td></tr><tr><td>Carol</td><td>-999.0</td></tr></tbody></table></div>

### Quoting & Escaping

#### Pandas read_csv quoting, escapechar — quoting and escaping

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

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>bio</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>Likes cats, dogs</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>Said "hello"</td>
    </tr>
  </tbody>
</table>

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

#### Polars read_csv quote_char, eol_char — quoting and escaping

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

<div><!-- shape: (2, 2) --><table><thead><tr><th>name</th><th>bio</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>Alice</td><td>Likes cats, dogs</td></tr><tr><td>Bob</td><td>Said hello</td></tr></tbody></table></div>

    --- auto (default) ---
    name,bio
    Alice,"Likes cats, dogs"
    Bob,Said hello
    
    --- always ---
    "name","bio"
    "Alice","Likes cats, dogs"
    "Bob","Said hello"

### Error Handling & Bad Lines

#### Pandas read_csv on_bad_lines — skip or warn on malformed rows

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

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>age</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>30</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Carol</td>
      <td>28</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>age</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Person0</td>
      <td>0</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Person1</td>
      <td>1</td>
    </tr>
    <tr>
      <th>2</th>
      <td>Person2</td>
      <td>2</td>
    </tr>
    <tr>
      <th>3</th>
      <td>Person3</td>
      <td>3</td>
    </tr>
    <tr>
      <th>4</th>
      <td>Person4</td>
      <td>4</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>age</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>30</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>25</td>
    </tr>
  </tbody>
</table>

#### Polars read_csv truncate_ragged_lines — handle malformed rows

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

<div><!-- shape: (3, 2) --><table><thead><tr><th>name</th><th>age</th></tr><tr><td>str</td><td>i64</td></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr><tr><td>Bob</td><td>25</td></tr><tr><td>Carol</td><td>28</td></tr></tbody></table></div>

<div><!-- shape: (5, 2) --><table><thead><tr><th>name</th><th>age</th></tr><tr><td>str</td><td>i64</td></tr></thead><tbody><tr><td>Person0</td><td>0</td></tr><tr><td>Person1</td><td>1</td></tr><tr><td>Person2</td><td>2</td></tr><tr><td>Person3</td><td>3</td></tr><tr><td>Person4</td><td>4</td></tr></tbody></table></div>

<div><!-- shape: (2, 2) --><table><thead><tr><th>name</th><th>age</th></tr><tr><td>str</td><td>i64</td></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr><tr><td>Bob</td><td>25</td></tr></tbody></table></div>

### CSV Compression (read & write)

#### Pandas read_csv/to_csv compression — gzip, bz2, xz, zstd

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

<table>
  <thead>
    <tr>
      <th></th>
      <th>id</th>
      <th>symbol</th>
      <th>date</th>
      <th>open</th>
      <th>high</th>
      <th>low</th>
      <th>close</th>
      <th>adj_close</th>
      <th>volume</th>
      <th>dividends</th>
      <th>stock_splits</th>
      <th>is_filled</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>21160</td>
      <td>ABI.BR</td>
      <td>2021-01-04</td>
      <td>58.15</td>
      <td>58.85</td>
      <td>56.78</td>
      <td>57.21</td>
      <td>53.5761</td>
      <td>1513937</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>1</th>
      <td>21161</td>
      <td>ABI.BR</td>
      <td>2021-01-05</td>
      <td>56.90</td>
      <td>57.98</td>
      <td>56.75</td>
      <td>57.18</td>
      <td>53.5480</td>
      <td>1382722</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>2</th>
      <td>21162</td>
      <td>ABI.BR</td>
      <td>2021-01-06</td>
      <td>57.96</td>
      <td>58.94</td>
      <td>57.39</td>
      <td>58.77</td>
      <td>55.0370</td>
      <td>1370204</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
  </tbody>
</table>

    csv.gz    :    2,394 bytes
    csv.bz2   :    2,058 bytes
    csv.zip   :    2,488 bytes
    csv.zst   :    2,305 bytes

#### Polars read_csv/write_csv — compressed CSV with gzip, zstd

```python
# Polars reads compressed CSV automatically from extension
display(pl.read_csv(TMP / "ohlcv.csv.gz").head(3))

# Write CSV to string, then compress manually
csv_bytes = ohlcv_pl.head(100).write_csv().encode()
with gzip.open(TMP / "ohlcv_pl.csv.gz", "wb") as f:
    f.write(csv_bytes)
print(f"Compressed: {(TMP / 'ohlcv_pl.csv.gz').stat().st_size:,} bytes")
```

<div><!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

    Compressed: 2,384 bytes

### Writing Options

#### Pandas to_csv — index, float_format, quoting, date_format

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

#### Polars write_csv — float_precision, date_format, null_value

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

### Chunked & Streaming Reading

#### Pandas read_csv chunksize — iterate DataFrame chunks

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

    Read 66,355 rows in chunks of 10,000
    Average close: 197.03

#### Polars scan_csv — lazy streaming without full memory load

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

    Schema: Schema({'id': Int64, 'symbol': String, 'date': Date, 'open': Float64, 'high': Float64, 'low': Float64, 'close': Float64, 'adj_close': Float64, 'volume': Int64, 'dividends': Float64, 'stock_splits': Float64, 'is_filled': Boolean})
    Filtered: (1331, 2)

<div><!-- shape: (3, 2) --><table><thead><tr><th>date</th><th>close</th></tr><tr><td>date</td><td>f64</td></tr></thead><tbody><tr><td>2021-01-04</td><td>406.25</td></tr><tr><td>2021-01-05</td><td>406.9</td></tr><tr><td>2021-01-06</td><td>402.85</td></tr></tbody></table></div>

    Batched read: 66,355 rows

## JSON

### Orient Options (Pandas)

#### Writing with orient

```python
df = pd.DataFrame({"name": ["Alice", "Bob"], "age": [30, 25], "city": ["NYC", "LON"]})
```

```python
# orient="records"
print(df.to_json(orient="records", indent=2))
```

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

```python
# orient="columns"
print(df.to_json(orient="columns", indent=2))
```

    {
      "name":{
        "0":"Alice",
        "1":"Bob"
      },
      "age":{
        "0":30,
        "1":25
      },
      "city":{
        "0":"NYC",
        "1":"LON"
      }
    }

```python
# orient="index"
print(df.to_json(orient="index", indent=2))
```

    {
      "0":{
        "name":"Alice",
        "age":30,
        "city":"NYC"
      },
      "1":{
        "name":"Bob",
        "age":25,
        "city":"LON"
      }
    }

```python
# orient="split"
print(df.to_json(orient="split", indent=2))
```

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

```python
# orient="values"
print(df.to_json(orient="values", indent=2))
```

    [
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

```python
# orient="table"
print(df.to_json(orient="table", indent=2))
```

    {
      "schema":{
        "fields":[
          {
            "name":"index",
            "type":"integer"
          },
          {
            "name":"name",
            "type":"string"
          },
          {
            "name":"age",
            "type":"integer"
          },
          {
            "name":"city",
            "type":"string"
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

#### Round-trip: read back each orient

```python
orientations: list = ["records", "columns", "index", "split", "values", "table"]
for orient in orientations:
    j = df.to_json(orient=orient)
    back = pd.read_json(io.StringIO(j), orient=orient)
    print(f"orient={orient:10s}: shape={back.shape}, cols={list(back.columns)}")
```

    orient=records   : shape=(2, 3), cols=['name', 'age', 'city']
    orient=columns   : shape=(2, 3), cols=['name', 'age', 'city']
    orient=index     : shape=(2, 3), cols=['name', 'age', 'city']
    orient=split     : shape=(2, 3), cols=['name', 'age', 'city']
    orient=values    : shape=(2, 3), cols=[0, 1, 2]
    orient=table     : shape=(2, 3), cols=['name', 'age', 'city']

### Nested JSON & Flattening

#### Pandas json_normalize — flatten nested JSON records

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

    Raw nested:

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>address</th>
      <th>scores</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>{'city': 'NYC', 'zip': '10001'}</td>
      <td>[90, 85, 92]</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>{'city': 'London', 'zip': 'EC1A'}</td>
      <td>[78, 88, 95]</td>
    </tr>
  </tbody>
</table>

    
    Flattened:

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>scores</th>
      <th>address.city</th>
      <th>address.zip</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>[90, 85, 92]</td>
      <td>NYC</td>
      <td>10001</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>[78, 88, 95]</td>
      <td>London</td>
      <td>EC1A</td>
    </tr>
  </tbody>
</table>

    
    Nested array with meta:

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>role</th>
      <th>company</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>Eng</td>
      <td>ACME</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>PM</td>
      <td>ACME</td>
    </tr>
    <tr>
      <th>2</th>
      <td>Carol</td>
      <td>Eng</td>
      <td>Globex</td>
    </tr>
  </tbody>
</table>

#### Polars unnest, explode — flatten nested JSON Struct and List types

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

    Schema with nested types:
    Schema({'name': String, 'address': Struct({'city': String, 'zip': String}), 'scores': List(Int64)})

<div><!-- shape: (2, 3) --><table><thead><tr><th>name</th><th>address</th><th>scores</th></tr><tr><td>str</td><td>struct[2]</td><td>list[i64]</td></tr></thead><tbody><tr><td>Alice</td><td>{NYC,10001}</td><td>[90, 85, 92]</td></tr><tr><td>Bob</td><td>{London,EC1A}</td><td>[78, 88, 95]</td></tr></tbody></table></div>

    
    Unnested:

<div><!-- shape: (2, 4) --><table><thead><tr><th>name</th><th>city</th><th>zip</th><th>scores</th></tr><tr><td>str</td><td>str</td><td>str</td><td>list[i64]</td></tr></thead><tbody><tr><td>Alice</td><td>NYC</td><td>10001</td><td>[90, 85, 92]</td></tr><tr><td>Bob</td><td>London</td><td>EC1A</td><td>[78, 88, 95]</td></tr></tbody></table></div>

    
    Unnested + exploded:

<div><!-- shape: (6, 4) --><table><thead><tr><th>name</th><th>city</th><th>zip</th><th>scores</th></tr><tr><td>str</td><td>str</td><td>str</td><td>i64</td></tr></thead><tbody><tr><td>Alice</td><td>NYC</td><td>10001</td><td>90</td></tr><tr><td>Alice</td><td>NYC</td><td>10001</td><td>85</td></tr><tr><td>Alice</td><td>NYC</td><td>10001</td><td>92</td></tr><tr><td>Bob</td><td>London</td><td>EC1A</td><td>78</td></tr><tr><td>Bob</td><td>London</td><td>EC1A</td><td>88</td></tr><tr><td>Bob</td><td>London</td><td>EC1A</td><td>95</td></tr></tbody></table></div>

### NDJSON (Newline-Delimited JSON)

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

#### Pandas

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
      <th>age</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Alice</td>
      <td>30</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>25</td>
    </tr>
    <tr>
      <th>2</th>
      <td>Carol</td>
      <td>35</td>
    </tr>
  </tbody>
</table>

#### Polars

<div><!-- shape: (3, 2) --><table><thead><tr><th>name</th><th>age</th></tr><tr><td>str</td><td>i64</td></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr><tr><td>Bob</td><td>25</td></tr><tr><td>Carol</td><td>35</td></tr></tbody></table></div>

    --- Pandas NDJSON output ---
    {"name":"Alice","age":30}
    {"name":"Bob","age":25}
    {"name":"Carol","age":35}
    
    --- Polars NDJSON output ---
    {"name":"Alice","age":30}
    {"name":"Bob","age":25}
    {"name":"Carol","age":35}
    
    
    Lazy schema: Schema({'name': String, 'age': Int64})

### JSON Writing Options

#### Pandas to_json — orient, date_format, double_precision

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

#### Polars write_json, write_ndjson — JSON writing options

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

### Schema Control on Read

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

#### Pandas with dtype

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

#### Polars with schema_overrides (keep as String, cast after)

<div><!-- shape: (2, 2) --><table><thead><tr><th>id</th><th>val</th></tr><tr><td>i64</td><td>f64</td></tr></thead><tbody><tr><td>1</td><td>3.14</td></tr><tr><td>2</td><td>2.72</td></tr></tbody></table></div>

#### Polars infer_schema_length=None

<div><!-- shape: (3, 1) --><table><thead><tr><th>x</th></tr><tr><td>str</td></tr></thead><tbody><tr><td>1</td></tr><tr><td>two</td></tr><tr><td>3</td></tr></tbody></table></div>

## Parquet

### Compression Codecs

#### Pandas read_parquet/to_parquet — snappy, gzip, brotli, zstd compression

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

#### Polars write_parquet compression — snappy, gzip, zstd, lz4

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

### Row Groups & Statistics

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

### Schema Control & Type Mapping

#### Pandas read_parquet columns, dtype_backend — schema control

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

<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ABI.BR</td>
      <td>2021-01-04</td>
      <td>57.21</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ABI.BR</td>
      <td>2021-01-05</td>
      <td>57.18</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ABI.BR</td>
      <td>2021-01-06</td>
      <td>58.77</td>
    </tr>
  </tbody>
</table>

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

#### Polars read_parquet columns, rechunk — schema and type mapping

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

<div><!-- shape: (3, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td></tr></tbody></table></div>

    Schema: Schema({'id': Int64, 'symbol': String, 'date': Date, 'open': Float64, 'high': Float64, 'low': Float64, 'close': Float64, 'adj_close': Float64, 'volume': Int64, 'dividends': Float64, 'stock_splits': Float64, 'is_filled': Boolean})
    
    Written schema: id: int32
    value: float
    label: large_string
    PyArrow engine: id: int64
    value: double
    label: large_string

### Partitioned Parquet

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

      by_symbol\symbol=ASML.AS\68419add66e54df8884428d44897a5e4-0.parquet  (20,869 bytes)
    
    Multi-level partitions:
      symbol=ASML.AS\year=2021\8791271a22434bc7ab0bec4da71a4f5b-0.parquet
      symbol=ASML.AS\year=2022\8791271a22434bc7ab0bec4da71a4f5b-0.parquet

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

#### Pandas — read partitioned

    Shape: (300, 12), symbols: ['ASML.AS']
    Categories (1, object): ['ASML.AS']
    Filtered: (300, 12)

#### Polars — read partitioned

    Shape: (300, 12), symbols: ['ASML.AS']

#### Polars lazy — filtered scan

<div><!-- shape: (0, 2) --><table><thead><tr><th>date</th><th>close</th></tr><tr><td>date</td><td>f64</td></tr></thead><tbody></tbody></table></div>

### Custom Metadata

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

    File metadata:
      created_by: notebook_08
      version: 1.0
      row_count: 100
    
    Round-trip metadata: b'1.0'

## Character Encodings & Binary Data

### Character Encodings

#### Pandas read_csv encoding — UTF-8, Latin-1, chardet detection

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

    utf-8     : ['München', 'Zürich', 'São Paulo']
    latin-1   : ['München', 'Zürich', 'São Paulo']
    cp1252    : ['München', 'Zürich', 'São Paulo']
    utf-16    : ['München', 'Zürich', 'São Paulo']
    
    Written as latin-1: b'name,city\r\nAlice,M\xfcnchen\r\nBob,Z\xfcrich\r\nCarol,S\xe3o Paulo\r\n'
    
    Detected encoding: {'encoding': 'Windows-1252', 'confidence': 0.09340473165624712, 'language': 'pt', 'mime_type': 'text/plain'}

#### Polars read_csv — UTF-8 only, decode non-UTF-8 before reading

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

    UTF-8: ['München', 'Zürich', 'São Paulo']
    Latin-1: ['München', 'Zürich', 'São Paulo']
    UTF-16: ['München', 'Zürich', 'São Paulo']
    CP1252: ['München', 'Zürich', 'São Paulo']

### BOM (Byte Order Mark)

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

    Pandas columns: ['name', 'age']
    Polars columns: ['name', 'age']

### Base64 & Binary Data in DataFrames

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

#### Pandas with base64

<table>
  <thead>
    <tr>
      <th></th>
      <th>id</th>
      <th>blob_b64</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>1</td>
      <td>IAkd87tVZPNCk4g8EE/6hBeXif5fOxMLmj+Eo6+QGas=</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2</td>
      <td>9VwPMCC3iQiZvmM4+V971Dg3kpHHGqZgq4LM4efXUZw=</td>
    </tr>
    <tr>
      <th>2</th>
      <td>3</td>
      <td>JRYn36L7sTc4tB2zcauhCeE5YrvUHs546qGQMVEaYBE=</td>
    </tr>
  </tbody>
</table>

    Round-trip OK

#### Polars with Binary dtype

<div><!-- shape: (3, 2) --><table><thead><tr><th>id</th><th>blob</th></tr><tr><td>i64</td><td>binary</td></tr></thead><tbody><tr><td>1</td><td>b\x20\x09\x1d\xf3\xbbUd\xf3B\x93\x88&lt;\x10O\xfa\x84\x17\x97\x89\xfe_;\x13\x0b\x9a?\x84\xa3\xaf\x90\x19\xab</td></tr><tr><td>2</td><td>b\xf5\\x0f0\x20\xb7\x89\x08\x99\xbec8\xf9_{\xd487\x92\x91\xc7\x1a\xa6`\xab\x82\xcc\xe1\xe7\xd7Q\x9c</td></tr><tr><td>3</td><td>b%\x16&#x27;\xdf\xa2\xfb\xb178\xb4\x1d\xb3q\xab\xa1\x09\xe19b\xbb\xd4\x1e\xcex\xea\xa1\x901Q\x1a`\x11</td></tr></tbody></table></div>

    dtype: Binary
    Binary Parquet round-trip OK
    
    For CSV export:
    id,blob_b64
    1,IAkd87tVZPNCk4g8EE/6hBeXif5fOxMLmj+Eo6+QGas=
    2,9VwPMCC3iQiZvmM4+V971Dg3kpHHGqZgq4LM4efXUZw=
    3,JRYn36L7sTc4tB2zcauhCeE5YrvUHs546qGQMVEaYBE=

## Summary

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

```python
# Clean up temp directory
shutil.rmtree(TMP, ignore_errors=True)
print("Temp files cleaned up")
```

    Temp files cleaned up
