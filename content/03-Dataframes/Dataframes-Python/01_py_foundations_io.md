---
type: reference
category: programming-languages
technology:
  - python
  - pandas
  - polars
tags: [pipeline, python, pandas, polars]
aliases:
  - Series, DataFrames, indexes, data types
keywords: [Series, DataFrame, Index, dtypes, int64, float64, object, category, read_csv, read_parquet, to_csv, to_parquet]
description: "Pandas/Polars DataFrame reference 01/10 — Foundations & I/O (Series, DataFrames, types, CSV/Parquet). Side-by-side executable examples with cell outputs."
related:
  - "[[dataframes-index]]"
  - "[[01_cs_foundations_io]]"
  - "[[programming-languages-index]]"
  - "[[02_py_explore_select_filter]]"
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# 01 — Foundations and Data Structures
## Pandas vs Polars: Series, DataFrames, Indexes, and Data Types

This notebook provides a side-by-side tour of the **core building blocks** in
Pandas and Polars.  Every section shows the Pandas way first, then the Polars
equivalent, and flags gotchas along the way.

---

```python
import pandas as pd
import polars as pl
import numpy as np
from pathlib import Path
import time

from IPython.display import display, Markdown
html_formatter = get_ipython().display_formatter.formatters['text/html'] # type: ignore
html_formatter.for_type(pd.DataFrame, lambda df: df.to_html())
html_formatter.for_type(pd.Series, lambda s: s.to_frame().to_html())

pl.Config.set_tbl_rows(100)
pd.set_option("display.max_rows", 100)

DATA = Path("../data")
print(f"pandas  {pd.__version__}")
print(f"polars  {pl.__version__}")
print(f"numpy   {np.__version__}")
import shutil
import io
```

    pandas  2.3.3
    polars  1.39.3
    numpy   2.4.3

---
## Series

A **Series** is a one-dimensional labelled (Pandas) or unnamed (Polars) array.
Pandas Series carry an **index**; Polars Series carry only a **name**.

### Creating a Series from a Python list

```python
# Pandas — Series from a list (auto-generates a RangeIndex)
s_pd = pd.Series([10, 20, 30, 40], name="values")
print(type(s_pd))
display(s_pd)
```

    <class 'pandas.core.series.Series'>

<table>
  <thead>
    <tr>
      <th></th>
      <th>values</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>10</td>
    </tr>
    <tr>
      <th>1</th>
      <td>20</td>
    </tr>
    <tr>
      <th>2</th>
      <td>30</td>
    </tr>
    <tr>
      <th>3</th>
      <td>40</td>
    </tr>
  </tbody>
</table>

```python
# Polars — Series from a list (no index, just a name)
s_pl = pl.Series("values", [10, 20, 30, 40])
print(type(s_pl))
display(s_pl)
```

    <class 'polars.series.series.Series'>

<div><!-- shape: (4,) --><table><thead><tr><th>values</th></tr><tr><td>i64</td></tr></thead><tbody><tr><td>10</td></tr><tr><td>20</td></tr><tr><td>30</td></tr><tr><td>40</td></tr></tbody></table></div>

### Creating a Series from a NumPy array

```python
arr = np.array([1.1, 2.2, 3.3, np.nan, 5.5])

s_pd = pd.Series(arr, name="from_numpy")
display(s_pd)
print(f"dtype: {s_pd.dtype}")  # float64
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>from_numpy</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>1.1</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2.2</td>
    </tr>
    <tr>
      <th>2</th>
      <td>3.3</td>
    </tr>
    <tr>
      <th>3</th>
      <td>NaN</td>
    </tr>
    <tr>
      <th>4</th>
      <td>5.5</td>
    </tr>
  </tbody>
</table>

    dtype: float64

```python
# Polars can wrap a numpy array directly
s_pl = pl.Series("from_numpy", arr)
display(s_pl)
print(f"dtype: {s_pl.dtype}")  # Float64
```

<div><!-- shape: (5,) --><table><thead><tr><th>from_numpy</th></tr><tr><td>f64</td></tr></thead><tbody><tr><td>1.1</td></tr><tr><td>2.2</td></tr><tr><td>3.3</td></tr><tr><td>NaN</td></tr><tr><td>5.5</td></tr></tbody></table></div>

    dtype: Float64

### Custom index (Pandas) vs named-only (Polars)

```python
# Pandas supports a custom index on a Series
s_pd = pd.Series(
    [100, 200, 300],
    index=["a", "b", "c"],
    name="amounts",
)
display(s_pd)
print(f"Index: {s_pd.index.tolist()}")
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>amounts</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>a</th>
      <td>100</td>
    </tr>
    <tr>
      <th>b</th>
      <td>200</td>
    </tr>
    <tr>
      <th>c</th>
      <td>300</td>
    </tr>
  </tbody>
</table>

    Index: ['a', 'b', 'c']

```python
# Polars has NO index concept — use a DataFrame if you need a label column
s_pl = pl.Series("amounts", [100, 200, 300])
display(s_pl)
# To replicate Pandas' index, pair with a label Series in a DataFrame:
df_pl = pl.DataFrame({"label": ["a", "b", "c"], "amounts": [100, 200, 300]})
display(df_pl)
```

<div><!-- shape: (3,) --><table><thead><tr><th>amounts</th></tr><tr><td>i64</td></tr></thead><tbody><tr><td>100</td></tr><tr><td>200</td></tr><tr><td>300</td></tr></tbody></table></div>

<div><!-- shape: (3, 2) --><table><thead><tr><th>label</th><th>amounts</th></tr><tr><td>str</td><td>i64</td></tr></thead><tbody><tr><td>a</td><td>100</td></tr><tr><td>b</td><td>200</td></tr><tr><td>c</td><td>300</td></tr></tbody></table></div>

### Data types — inference and casting

Pandas defaults to `int64`/`float64`/`object`; Polars defaults to
`Int64`/`Float64`/`String`.  Polars is stricter: no silent object fallback.

```python
# Pandas — mixed types silently become object dtype
mixed_pd = pd.Series([1, "two", 3.0], name="mixed")
print(f"dtype: {mixed_pd.dtype}")  # object  ← watch out!
display(mixed_pd)
```

    dtype: object

<table>
  <thead>
    <tr>
      <th></th>
      <th>mixed</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>1</td>
    </tr>
    <tr>
      <th>1</th>
      <td>two</td>
    </tr>
    <tr>
      <th>2</th>
      <td>3.0</td>
    </tr>
  </tbody>
</table>

```python
# Polars — mixed types? It will try to find a common supertype or raise
try:
    mixed_pl = pl.Series("mixed", [1, "two", 3.0], strict=False)
    display(mixed_pl)
except Exception as e:
    print(f"Polars error: {e}")
```

<div><!-- shape: (3,) --><table><thead><tr><th>mixed</th></tr><tr><td>str</td></tr></thead><tbody><tr><td>1</td></tr><tr><td>two</td></tr><tr><td>3.0</td></tr></tbody></table></div>

```python
# Explicit casting in Pandas
s_pd = pd.Series([1, 2, 3], dtype="float32")
print(f"dtype after cast: {s_pd.dtype}")

# Convert to nullable Int
s_pd_nullable = pd.array([1, 2, None], dtype=pd.Int64Dtype())
print(f"Nullable Int64: {s_pd_nullable}")
```

    dtype after cast: float32
    Nullable Int64: <IntegerArray>
    [1, 2, <NA>]
    Length: 3, dtype: Int64

```python
# Explicit casting in Polars
s_pl = pl.Series("vals", [1, 2, 3]).cast(pl.Float32)
print(f"dtype after cast: {s_pl.dtype}")

# Polars has first-class null support — no special nullable dtype needed
s_pl_null = pl.Series("vals", [1, 2, None])
print(f"dtype with null: {s_pl_null.dtype}")  # Int64, null is native
```

    dtype after cast: Float32
    dtype with null: Int64

### Basic Series operations


- **Describe**: Summary statistics: count, mean, std, min, max, quartiles.

```python
prices_pd = pd.Series([10.5, 20.3, 30.1, 40.8, 50.0], name="price")

print("len   :", len(prices_pd))
print("shape :", prices_pd.shape)
print("sum   :", prices_pd.sum())
print("mean  :", prices_pd.mean())
print("std   :", prices_pd.std())
print("nunique:", prices_pd.nunique())
display(prices_pd.describe())
```

    len   : 5
    shape : (5,)
    sum   : 151.7
    mean  : 30.339999999999996
    std   : 15.735405936930892
    nunique: 5

<table>
  <thead>
    <tr>
      <th></th>
      <th>price</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>count</th>
      <td>5.000000</td>
    </tr>
    <tr>
      <th>mean</th>
      <td>30.340000</td>
    </tr>
    <tr>
      <th>std</th>
      <td>15.735406</td>
    </tr>
    <tr>
      <th>min</th>
      <td>10.500000</td>
    </tr>
    <tr>
      <th>25%</th>
      <td>20.300000</td>
    </tr>
    <tr>
      <th>50%</th>
      <td>30.100000</td>
    </tr>
    <tr>
      <th>75%</th>
      <td>40.800000</td>
    </tr>
    <tr>
      <th>max</th>
      <td>50.000000</td>
    </tr>
  </tbody>
</table>

```python
prices_pl = pl.Series("price", [10.5, 20.3, 30.1, 40.8, 50.0])

print("len   :", prices_pl.len())
print("shape :", prices_pl.shape)
print("sum   :", prices_pl.sum())
print("mean  :", prices_pl.mean())
print("std   :", prices_pl.std())
print("nunique:", prices_pl.n_unique())
display(prices_pl.describe())
```

    len   : 5
    shape : (5,)
    sum   : 151.7
    mean  : 30.339999999999996
    std   : 15.735405936930892
    nunique: 5

<div><!-- shape: (9, 2) --><table><thead><tr><th>statistic</th><th>value</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>count</td><td>5.0</td></tr><tr><td>null_count</td><td>0.0</td></tr><tr><td>mean</td><td>30.34</td></tr><tr><td>std</td><td>15.735406</td></tr><tr><td>min</td><td>10.5</td></tr><tr><td>25%</td><td>20.3</td></tr><tr><td>50%</td><td>30.1</td></tr><tr><td>75%</td><td>40.8</td></tr><tr><td>max</td><td>50.0</td></tr></tbody></table></div>

### Gotcha — NaN vs null

Pandas uses `NaN` (a float) for missing values, which silently promotes
integer columns to float.  Polars uses a proper **null** bitmask.

```python
# Pandas: inserting a missing value promotes int → float
s = pd.Series([1, 2, 3])
print(f"Before: {s.dtype}")  # int64
s.iloc[1] = np.nan # type: ignore
print(f"After:  {s.dtype}")  # float64  ← surprise!
display(s)
```

    Before: int64
    After:  float64

<table>
  <thead>
    <tr>
      <th></th>
      <th>0</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>1.0</td>
    </tr>
    <tr>
      <th>1</th>
      <td>NaN</td>
    </tr>
    <tr>
      <th>2</th>
      <td>3.0</td>
    </tr>
  </tbody>
</table>

```python
# Polars: null is native — dtype stays Int64
s = pl.Series("x", [1, 2, 3])
# Replace value at index 1 with null using scatter
s = s.scatter(1, None)
print(f"dtype: {s.dtype}")  # Int64  ← no promotion
display(s)
```

    dtype: Int64

<div><!-- shape: (3,) --><table><thead><tr><th>x</th></tr><tr><td>i64</td></tr></thead><tbody><tr><td>1</td></tr><tr><td>null</td></tr><tr><td>3</td></tr></tbody></table></div>

---
## DataFrame

A **DataFrame** is a two-dimensional table of columns.
Pandas DataFrames have a row index; Polars DataFrames do not.

### Creating a DataFrame from a dict

```python
data = {
    "symbol": ["AAPL", "MSFT", "GOOG", "AMZN"],
    "price":  [175.0, 340.0, 140.0, 180.0],
    "volume": [50_000_000, 30_000_000, 25_000_000, 40_000_000],
}

df_pd = pd.DataFrame(data)
print(f"type : {type(df_pd)}")
print(f"shape: {df_pd.shape}")
display(df_pd)
```

    type : <class 'pandas.core.frame.DataFrame'>
    shape: (4, 3)

<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>price</th>
      <th>volume</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>AAPL</td>
      <td>175.0</td>
      <td>50000000</td>
    </tr>
    <tr>
      <th>1</th>
      <td>MSFT</td>
      <td>340.0</td>
      <td>30000000</td>
    </tr>
    <tr>
      <th>2</th>
      <td>GOOG</td>
      <td>140.0</td>
      <td>25000000</td>
    </tr>
    <tr>
      <th>3</th>
      <td>AMZN</td>
      <td>180.0</td>
      <td>40000000</td>
    </tr>
  </tbody>
</table>

```python
df_pl = pl.DataFrame(data)
print(f"type  : {type(df_pl)}")
print(f"shape : {df_pl.shape}")
print(f"height: {df_pl.height}, width: {df_pl.width}")
display(df_pl)
```

    type  : <class 'polars.dataframe.frame.DataFrame'>
    shape : (4, 3)
    height: 4, width: 3

<div><!-- shape: (4, 3) --><table><thead><tr><th>symbol</th><th>price</th><th>volume</th></tr><tr><td>str</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>AAPL</td><td>175.0</td><td>50000000</td></tr><tr><td>MSFT</td><td>340.0</td><td>30000000</td></tr><tr><td>GOOG</td><td>140.0</td><td>25000000</td></tr><tr><td>AMZN</td><td>180.0</td><td>40000000</td></tr></tbody></table></div>

### Creating a DataFrame from a list of dicts (records)

```python
records = [
    {"name": "Alice", "age": 30, "city": "London"},
    {"name": "Bob",   "age": 25, "city": "Paris"},
    {"name": "Carol", "age": 35, "city": "Berlin"},
]

df_pd = pd.DataFrame(records)
display(df_pd)
```

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
      <td>London</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Bob</td>
      <td>25</td>
      <td>Paris</td>
    </tr>
    <tr>
      <th>2</th>
      <td>Carol</td>
      <td>35</td>
      <td>Berlin</td>
    </tr>
  </tbody>
</table>

```python
df_pl = pl.DataFrame(records)
display(df_pl)
```

<div><!-- shape: (3, 3) --><table><thead><tr><th>name</th><th>age</th><th>city</th></tr><tr><td>str</td><td>i64</td><td>str</td></tr></thead><tbody><tr><td>Alice</td><td>30</td><td>London</td></tr><tr><td>Bob</td><td>25</td><td>Paris</td></tr><tr><td>Carol</td><td>35</td><td>Berlin</td></tr></tbody></table></div>

### Creating a DataFrame from a NumPy array

```python
arr = np.random.default_rng(42).standard_normal((5, 3))

df_pd = pd.DataFrame(arr, columns=["A", "B", "C"])
display(df_pd)
print(f"dtypes:\n{df_pd.dtypes}")
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>A</th>
      <th>B</th>
      <th>C</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>0.304717</td>
      <td>-1.039984</td>
      <td>0.750451</td>
    </tr>
    <tr>
      <th>1</th>
      <td>0.940565</td>
      <td>-1.951035</td>
      <td>-1.302180</td>
    </tr>
    <tr>
      <th>2</th>
      <td>0.127840</td>
      <td>-0.316243</td>
      <td>-0.016801</td>
    </tr>
    <tr>
      <th>3</th>
      <td>-0.853044</td>
      <td>0.879398</td>
      <td>0.777792</td>
    </tr>
    <tr>
      <th>4</th>
      <td>0.066031</td>
      <td>1.127241</td>
      <td>0.467509</td>
    </tr>
  </tbody>
</table>

    dtypes:
    A    float64
    B    float64
    C    float64
    dtype: object

```python
# Polars — pass dict of column_name → array slice
df_pl = pl.DataFrame({"A": arr[:, 0], "B": arr[:, 1], "C": arr[:, 2]})
display(df_pl)
print(f"dtypes: {df_pl.dtypes}")
```

<div><!-- shape: (5, 3) --><table><thead><tr><th>A</th><th>B</th><th>C</th></tr><tr><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>0.304717</td><td>-1.039984</td><td>0.750451</td></tr><tr><td>0.940565</td><td>-1.951035</td><td>-1.30218</td></tr><tr><td>0.12784</td><td>-0.316243</td><td>-0.016801</td></tr><tr><td>-0.853044</td><td>0.879398</td><td>0.777792</td></tr><tr><td>0.066031</td><td>1.127241</td><td>0.467509</td></tr></tbody></table></div>

    dtypes: [Float64, Float64, Float64]

### Shape, height, width, column names

Pandas uses `.shape` and `.columns`.
Polars adds `.height` and `.width` for clarity.

```python
df_pd = pd.DataFrame(data)  # reuse earlier dict

print(f"shape   : {df_pd.shape}")
print(f"rows    : {df_pd.shape[0]}")
print(f"cols    : {df_pd.shape[1]}")
print(f"columns : {df_pd.columns.tolist()}")
print(f"dtypes  :\n{df_pd.dtypes}")
```

    shape   : (4, 3)
    rows    : 4
    cols    : 3
    columns : ['symbol', 'price', 'volume']
    dtypes  :
    symbol     object
    price     float64
    volume      int64
    dtype: object

```python
df_pl = pl.DataFrame(data)

print(f"shape   : {df_pl.shape}")
print(f"height  : {df_pl.height}")
print(f"width   : {df_pl.width}")
print(f"columns : {df_pl.columns}")
print(f"dtypes  : {df_pl.dtypes}")
print(f"schema  : {df_pl.schema}")
```

    shape   : (4, 3)
    height  : 4
    width   : 3
    columns : ['symbol', 'price', 'volume']
    dtypes  : [String, Float64, Int64]
    schema  : Schema({'symbol': String, 'price': Float64, 'volume': Int64})

---
## The Index Concept

Pandas relies heavily on **Index** objects for alignment, selection, and
joins.  Polars **has no index** — all operations are column-based.

### Pandas Index basics

```python
df = pd.DataFrame(
    {"value": [10, 20, 30]},
    index=pd.Index(["a", "b", "c"], name="key"),
)
display(df)
print(f"Index type : {type(df.index)}")
print(f"Index name : {df.index.name}")
print(f"Index vals : {df.index.tolist()}")
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>value</th>
    </tr>
    <tr>
      <th>key</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>a</th>
      <td>10</td>
    </tr>
    <tr>
      <th>b</th>
      <td>20</td>
    </tr>
    <tr>
      <th>c</th>
      <td>30</td>
    </tr>
  </tbody>
</table>

    Index type : <class 'pandas.core.indexes.base.Index'>
    Index name : key
    Index vals : ['a', 'b', 'c']

```python
# Setting and resetting the index
df_pd = pd.DataFrame({"key": ["a", "b", "c"], "value": [10, 20, 30]})
df_indexed = df_pd.set_index("key")
display(df_indexed)

df_reset = df_indexed.reset_index()
display(df_reset)
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>value</th>
    </tr>
    <tr>
      <th>key</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>a</th>
      <td>10</td>
    </tr>
    <tr>
      <th>b</th>
      <td>20</td>
    </tr>
    <tr>
      <th>c</th>
      <td>30</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>key</th>
      <th>value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>a</td>
      <td>10</td>
    </tr>
    <tr>
      <th>1</th>
      <td>b</td>
      <td>20</td>
    </tr>
    <tr>
      <th>2</th>
      <td>c</td>
      <td>30</td>
    </tr>
  </tbody>
</table>

### Polars — no index, use columns instead


- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

```python
# Polars simply keeps the key as a regular column
df_pl = pl.DataFrame({"key": ["a", "b", "c"], "value": [10, 20, 30]})
display(df_pl)

# Filtering by 'key' replaces .loc on an index
display(df_pl.filter(pl.col("key") == "b"))
```

<div><!-- shape: (3, 2) --><table><thead><tr><th>key</th><th>value</th></tr><tr><td>str</td><td>i64</td></tr></thead><tbody><tr><td>a</td><td>10</td></tr><tr><td>b</td><td>20</td></tr><tr><td>c</td><td>30</td></tr></tbody></table></div>

<div><!-- shape: (1, 2) --><table><thead><tr><th>key</th><th>value</th></tr><tr><td>str</td><td>i64</td></tr></thead><tbody><tr><td>b</td><td>20</td></tr></tbody></table></div>

### Gotcha — index alignment in Pandas

When you combine two Pandas objects, they align on the index.
This can produce unexpected NaNs if the indexes don't match.

```python
s1 = pd.Series([1, 2, 3], index=["a", "b", "c"])
s2 = pd.Series([10, 20, 30], index=["b", "c", "d"])

result = s1 + s2
print("Index alignment produces NaN where keys don't overlap:")
display(result)
```

    Index alignment produces NaN where keys don't overlap:

<table>
  <thead>
    <tr>
      <th></th>
      <th>0</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>a</th>
      <td>NaN</td>
    </tr>
    <tr>
      <th>b</th>
      <td>12.0</td>
    </tr>
    <tr>
      <th>c</th>
      <td>23.0</td>
    </tr>
    <tr>
      <th>d</th>
      <td>NaN</td>
    </tr>
  </tbody>
</table>

```python
# Polars has no alignment surprises — addition is positional
s1 = pl.Series("s1", [1, 2, 3])
s2 = pl.Series("s2", [10, 20, 30])
result = s1 + s2
print("Polars addition is purely positional:")
display(result)
```

    Polars addition is purely positional:

<div><!-- shape: (3,) --><table><thead><tr><th>s1</th></tr><tr><td>i64</td></tr></thead><tbody><tr><td>11</td></tr><tr><td>22</td></tr><tr><td>33</td></tr></tbody></table></div>

### Pandas MultiIndex vs Polars grouped columns

```python
arrays = [
    ["bar", "bar", "baz", "baz"],
    ["one", "two", "one", "two"],
]
idx = pd.MultiIndex.from_arrays(arrays, names=["first", "second"])
df_mi = pd.DataFrame({"val": [10, 20, 30, 40]}, index=idx)
display(df_mi)
print(f"Index levels: {df_mi.index.nlevels}")
```

<table>
  <thead>
    <tr>
      <th></th>
      <th></th>
      <th>val</th>
    </tr>
    <tr>
      <th>first</th>
      <th>second</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th rowspan="2" valign="top">bar</th>
      <th>one</th>
      <td>10</td>
    </tr>
    <tr>
      <th>two</th>
      <td>20</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">baz</th>
      <th>one</th>
      <td>30</td>
    </tr>
    <tr>
      <th>two</th>
      <td>40</td>
    </tr>
  </tbody>
</table>

    Index levels: 2

```python
# Polars equivalent: just keep those levels as regular columns
df_pl = pl.DataFrame({
    "first":  ["bar", "bar", "baz", "baz"],
    "second": ["one", "two", "one", "two"],
    "val":    [10, 20, 30, 40],
})
display(df_pl)
# Grouping replaces multi-index workflows
```

<div><!-- shape: (4, 3) --><table><thead><tr><th>first</th><th>second</th><th>val</th></tr><tr><td>str</td><td>str</td><td>i64</td></tr></thead><tbody><tr><td>bar</td><td>one</td><td>10</td></tr><tr><td>bar</td><td>two</td><td>20</td></tr><tr><td>baz</td><td>one</td><td>30</td></tr><tr><td>baz</td><td>two</td><td>40</td></tr></tbody></table></div>

---
## Data Types Deep Dive

Understanding types is critical. Pandas inherited NumPy types plus
its own Extension types; Polars uses Apache Arrow types.

### Listing available types

```python
# Pandas common dtypes
print("Pandas common dtypes:")
for dt in ["int64", "float64", "bool", "object", "datetime64[ns]",
           "timedelta64[ns]", "category", "string", "Int64", "Float64"]:
    print(f"  {dt}")
```

    Pandas common dtypes:
      int64
      float64
      bool
      object
      datetime64[ns]
      timedelta64[ns]
      category
      string
      Int64
      Float64

```python
# Polars type hierarchy (a selection)
print("Polars common dtypes:")
for dt in [pl.Int8, pl.Int16, pl.Int32, pl.Int64,
           pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
           pl.Float32, pl.Float64,
           pl.Boolean, pl.String, pl.Date, pl.Datetime,
           pl.Duration, pl.Categorical, pl.Null]:
    print(f"  {dt}")
```

    Polars common dtypes:
      Int8
      Int16
      Int32
      Int64
      UInt8
      UInt16
      UInt32
      UInt64
      Float32
      Float64
      Boolean
      String
      Date
      Datetime
      Duration
      Categorical
      Null

### Inspecting types on real data



```python
df_pd = pd.read_csv(DATA / "dim_country.csv")
print(f"Shape: {df_pd.shape}")
display(df_pd.head())
display(df_pd.dtypes)
```

    Shape: (212, 2)

<table>
  <thead>
    <tr>
      <th></th>
      <th>country_name</th>
      <th>iso_alpha2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Afghanistan</td>
      <td>AF</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Albania</td>
      <td>AL</td>
    </tr>
    <tr>
      <th>2</th>
      <td>Algeria</td>
      <td>DZ</td>
    </tr>
    <tr>
      <th>3</th>
      <td>American Samoa</td>
      <td>AS</td>
    </tr>
    <tr>
      <th>4</th>
      <td>Andorra</td>
      <td>AD</td>
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
      <th>country_name</th>
      <td>object</td>
    </tr>
    <tr>
      <th>iso_alpha2</th>
      <td>object</td>
    </tr>
  </tbody>
</table>

```python
df_pl = pl.read_csv(DATA / "dim_country.csv")
print(f"Shape: {df_pl.shape}")
display(df_pl.head())
print(f"Schema: {df_pl.schema}")
```

    Shape: (212, 2)

<div><!-- shape: (5, 2) --><table><thead><tr><th>country_name</th><th>iso_alpha2</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>Afghanistan</td><td>AF</td></tr><tr><td>Albania</td><td>AL</td></tr><tr><td>Algeria</td><td>DZ</td></tr><tr><td>American Samoa</td><td>AS</td></tr><tr><td>Andorra</td><td>AD</td></tr></tbody></table></div>

    Schema: Schema({'country_name': String, 'iso_alpha2': String})

### Type casting


- **Parse Dates**: Convert strings to datetime objects (Pandas).
- **Astype**: Convert column to a different data type (Pandas).

```python
df_pd = pd.read_csv(DATA / "eurostoxx50_ohlcv.csv", nrows=5)
display(df_pd.dtypes)

# Cast volume to float, date to datetime
df_pd_c = df_pd
df_pd_c["volume"] = df_pd_c["volume"].astype("float64")
df_pd_c["date"] = pd.to_datetime(df_pd_c["date"])
display(df_pd.dtypes)
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
      <td>int64</td>
    </tr>
    <tr>
      <th>symbol</th>
      <td>object</td>
    </tr>
    <tr>
      <th>date</th>
      <td>object</td>
    </tr>
    <tr>
      <th>open</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>high</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>low</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>close</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>adj_close</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>volume</th>
      <td>int64</td>
    </tr>
    <tr>
      <th>dividends</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>stock_splits</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>is_filled</th>
      <td>bool</td>
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
      <th>symbol</th>
      <td>object</td>
    </tr>
    <tr>
      <th>date</th>
      <td>datetime64[ns]</td>
    </tr>
    <tr>
      <th>open</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>high</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>low</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>close</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>adj_close</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>volume</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>dividends</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>stock_splits</th>
      <td>float64</td>
    </tr>
    <tr>
      <th>is_filled</th>
      <td>bool</td>
    </tr>
  </tbody>
</table>

```python
df_pl = pl.read_csv(DATA / "eurostoxx50_ohlcv.csv", n_rows=5)
print(df_pl.dtypes)

# Cast volume to Float64, date to Date
df_pl = df_pl.with_columns(
    pl.col("volume").cast(pl.Float64),
    pl.col("date").str.to_date("%Y-%m-%d"),
)
print(df_pl.dtypes)
display(df_pl)
```

    [Int64, String, String, Float64, Float64, Float64, Float64, Float64, Int64, Float64, Float64, Boolean]
    [Int64, String, Date, Float64, Float64, Float64, Float64, Float64, Float64, Float64, Float64, Boolean]

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1.513937e6</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1.382722e6</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1.370204e6</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1.469911e6</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1.428681e6</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

### Gotcha — Pandas object vs string dtype

Pandas' default for text is `object` which can hold *anything*.
Use `string` dtype (or `StringDtype()`) for type safety.

```python
s_obj = pd.Series(["a", "b", "c"])
s_str = pd.Series(["a", "b", "c"], dtype="string")

print(f"Default dtype: {s_obj.dtype}")   # object
print(f"String dtype:  {s_str.dtype}")   # string

# object allows mixed types — dangerous!
s_obj.iloc[0] = 42  # type: ignore # no error
print(f"After inserting int into object Series: {s_obj.tolist()}")
```

    Default dtype: object
    String dtype:  string
    After inserting int into object Series: [42, 'b', 'c']

---
## Loading Real Data from Multiple Formats

The `../data/` directory contains CSV, JSON, and Parquet files.
Let's compare how each library loads them.

### CSV



```python
df_pd = pd.read_csv(DATA / "index_performance.csv")
print(f"Shape: {df_pd.shape}")
display(df_pd.head(3))
```

    Shape: (5281, 15)

<table>
  <thead>
    <tr>
      <th></th>
      <th>id</th>
      <th>_index</th>
      <th>perf_date</th>
      <th>daily_return</th>
      <th>cumulative_factor</th>
      <th>rolling_30d_return</th>
      <th>rolling_90d_return</th>
      <th>ytd_return</th>
      <th>rolling_30d_volatility</th>
      <th>stocks_count</th>
      <th>avg_pe</th>
      <th>avg_pb</th>
      <th>avg_dividend_yield</th>
      <th>avg_market_cap</th>
      <th>_computed_at</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>1</td>
      <td>euro_stoxx_50</td>
      <td>2021-01-05</td>
      <td>-0.004626</td>
      <td>0.995374</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>-0.004626</td>
      <td>NaN</td>
      <td>49</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>2026-03-04 22:40:26.069309</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2</td>
      <td>euro_stoxx_50</td>
      <td>2021-01-06</td>
      <td>0.018394</td>
      <td>1.013683</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>0.013683</td>
      <td>NaN</td>
      <td>48</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>2026-03-04 22:40:26.069309</td>
    </tr>
    <tr>
      <th>2</th>
      <td>3</td>
      <td>euro_stoxx_50</td>
      <td>2021-01-07</td>
      <td>0.005412</td>
      <td>1.019168</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>0.019168</td>
      <td>NaN</td>
      <td>49</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>2026-03-04 22:40:26.069309</td>
    </tr>
  </tbody>
</table>

    CPU times: total: 15.6 ms
    Wall time: 20.9 ms

```python
df_pl = pl.read_csv(DATA / "index_performance.csv")
print(f"Shape: {df_pl.shape}")
display(df_pl.head(3))
```

    Shape: (5281, 15)

<div><!-- shape: (3, 15) --><table><thead><tr><th>id</th><th>_index</th><th>perf_date</th><th>daily_return</th><th>cumulative_factor</th><th>rolling_30d_return</th><th>rolling_90d_return</th><th>ytd_return</th><th>rolling_30d_volatility</th><th>stocks_count</th><th>avg_pe</th><th>avg_pb</th><th>avg_dividend_yield</th><th>avg_market_cap</th><th>_computed_at</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td></tr></thead><tbody><tr><td>1</td><td>euro_stoxx_50</td><td>2021-01-05</td><td>-0.004626</td><td>0.995374</td><td>null</td><td>null</td><td>-0.004626</td><td>null</td><td>49</td><td>null</td><td>null</td><td>null</td><td>null</td><td>2026-03-04 22:40:26.069309</td></tr><tr><td>2</td><td>euro_stoxx_50</td><td>2021-01-06</td><td>0.018394</td><td>1.013683</td><td>null</td><td>null</td><td>0.013683</td><td>null</td><td>48</td><td>null</td><td>null</td><td>null</td><td>null</td><td>2026-03-04 22:40:26.069309</td></tr><tr><td>3</td><td>euro_stoxx_50</td><td>2021-01-07</td><td>0.005412</td><td>1.019168</td><td>null</td><td>null</td><td>0.019168</td><td>null</td><td>49</td><td>null</td><td>null</td><td>null</td><td>null</td><td>2026-03-04 22:40:26.069309</td></tr></tbody></table></div>

    CPU times: total: 0 ns
    Wall time: 3.5 ms

### Parquet



```python
df_pd = pd.read_parquet(DATA / "index_performance.parquet")
print(f"Shape: {df_pd.shape}")
display(df_pd.head(3))
```

    Shape: (5281, 15)

<table>
  <thead>
    <tr>
      <th></th>
      <th>id</th>
      <th>_index</th>
      <th>perf_date</th>
      <th>daily_return</th>
      <th>cumulative_factor</th>
      <th>rolling_30d_return</th>
      <th>rolling_90d_return</th>
      <th>ytd_return</th>
      <th>rolling_30d_volatility</th>
      <th>stocks_count</th>
      <th>avg_pe</th>
      <th>avg_pb</th>
      <th>avg_dividend_yield</th>
      <th>avg_market_cap</th>
      <th>_computed_at</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>1</td>
      <td>euro_stoxx_50</td>
      <td>2021-01-05</td>
      <td>-0.004626</td>
      <td>0.995374</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>-0.004626</td>
      <td>NaN</td>
      <td>49</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>2026-03-04 22:40:26.069309</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2</td>
      <td>euro_stoxx_50</td>
      <td>2021-01-06</td>
      <td>0.018394</td>
      <td>1.013683</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>0.013683</td>
      <td>NaN</td>
      <td>48</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>2026-03-04 22:40:26.069309</td>
    </tr>
    <tr>
      <th>2</th>
      <td>3</td>
      <td>euro_stoxx_50</td>
      <td>2021-01-07</td>
      <td>0.005412</td>
      <td>1.019168</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>0.019168</td>
      <td>NaN</td>
      <td>49</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>2026-03-04 22:40:26.069309</td>
    </tr>
  </tbody>
</table>

    CPU times: total: 46.9 ms
    Wall time: 366 ms

```python
df_pl = pl.read_parquet(DATA / "index_performance.parquet")
print(f"Shape: {df_pl.shape}")
display(df_pl.head(3))
```

    Shape: (5281, 15)

<div><!-- shape: (3, 15) --><table><thead><tr><th>id</th><th>_index</th><th>perf_date</th><th>daily_return</th><th>cumulative_factor</th><th>rolling_30d_return</th><th>rolling_90d_return</th><th>ytd_return</th><th>rolling_30d_volatility</th><th>stocks_count</th><th>avg_pe</th><th>avg_pb</th><th>avg_dividend_yield</th><th>avg_market_cap</th><th>_computed_at</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>datetime[ns]</td></tr></thead><tbody><tr><td>1</td><td>euro_stoxx_50</td><td>2021-01-05</td><td>-0.004626</td><td>0.995374</td><td>null</td><td>null</td><td>-0.004626</td><td>null</td><td>49</td><td>null</td><td>null</td><td>null</td><td>null</td><td>2026-03-04 22:40:26.069309</td></tr><tr><td>2</td><td>euro_stoxx_50</td><td>2021-01-06</td><td>0.018394</td><td>1.013683</td><td>null</td><td>null</td><td>0.013683</td><td>null</td><td>48</td><td>null</td><td>null</td><td>null</td><td>null</td><td>2026-03-04 22:40:26.069309</td></tr><tr><td>3</td><td>euro_stoxx_50</td><td>2021-01-07</td><td>0.005412</td><td>1.019168</td><td>null</td><td>null</td><td>0.019168</td><td>null</td><td>49</td><td>null</td><td>null</td><td>null</td><td>null</td><td>2026-03-04 22:40:26.069309</td></tr></tbody></table></div>

    CPU times: total: 0 ns
    Wall time: 22 ms

### JSON


- **Read JSON**: Load a JSON file into a DataFrame.

```python
df_pd = pd.read_json(DATA / "dim_country.json")
print(f"Shape: {df_pd.shape}")
display(df_pd.head(3))
```

    Shape: (212, 2)

<table>
  <thead>
    <tr>
      <th></th>
      <th>country_name</th>
      <th>iso_alpha2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Afghanistan</td>
      <td>AF</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Albania</td>
      <td>AL</td>
    </tr>
    <tr>
      <th>2</th>
      <td>Algeria</td>
      <td>DZ</td>
    </tr>
  </tbody>
</table>

```python
df_pl = pl.read_json(DATA / "dim_country.json")
print(f"Shape: {df_pl.shape}")
display(df_pl.head(3))
```

    Shape: (212, 2)

<div><!-- shape: (3, 2) --><table><thead><tr><th>country_name</th><th>iso_alpha2</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>Afghanistan</td><td>AF</td></tr><tr><td>Albania</td><td>AL</td></tr><tr><td>Algeria</td><td>DZ</td></tr></tbody></table></div>

---
## Inspecting DataFrames

### Head, tail, sample, describe


- **Tail**: Return the last N rows.
- **Describe**: Summary statistics: count, mean, std, min, max, quartiles.

```python
df_pd = pd.read_parquet(DATA / "eurostoxx50_ohlcv.parquet")

display(df_pd.head(3))
display(df_pd.tail(3))
display(df_pd.sample(3, random_state=42))
display(df_pd.describe())
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
      <th>66352</th>
      <td>66876</td>
      <td>WKL.AS</td>
      <td>2026-03-10</td>
      <td>68.8</td>
      <td>69.16</td>
      <td>66.34</td>
      <td>67.16</td>
      <td>67.16</td>
      <td>1355645</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>66353</th>
      <td>66877</td>
      <td>WKL.AS</td>
      <td>2026-03-11</td>
      <td>67.5</td>
      <td>69.60</td>
      <td>67.02</td>
      <td>67.22</td>
      <td>67.22</td>
      <td>1142531</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>66354</th>
      <td>66929</td>
      <td>WKL.AS</td>
      <td>2026-03-12</td>
      <td>67.0</td>
      <td>67.54</td>
      <td>66.28</td>
      <td>67.32</td>
      <td>67.32</td>
      <td>210379</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
  </tbody>
</table>

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
      <th>43053</th>
      <td>38920</td>
      <td>MUV2.DE</td>
      <td>2023-03-29</td>
      <td>320.0000</td>
      <td>322.600</td>
      <td>318.400</td>
      <td>322.4000</td>
      <td>290.3200</td>
      <td>195809</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>56209</th>
      <td>5772</td>
      <td>SAP.DE</td>
      <td>2022-11-03</td>
      <td>95.9200</td>
      <td>96.340</td>
      <td>95.080</td>
      <td>95.5100</td>
      <td>91.9052</td>
      <td>1424973</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>53515</th>
      <td>11015</td>
      <td>SAN.MC</td>
      <td>2022-09-15</td>
      <td>2.5975</td>
      <td>2.686</td>
      <td>2.597</td>
      <td>2.6765</td>
      <td>2.3373</td>
      <td>70158349</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>id</th>
      <th>open</th>
      <th>high</th>
      <th>low</th>
      <th>close</th>
      <th>adj_close</th>
      <th>volume</th>
      <th>dividends</th>
      <th>stock_splits</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>count</th>
      <td>66355.000000</td>
      <td>66355.000000</td>
      <td>66355.000000</td>
      <td>66355.000000</td>
      <td>66355.000000</td>
      <td>66355.000000</td>
      <td>6.635500e+04</td>
      <td>66355.000000</td>
      <td>66355.000000</td>
    </tr>
    <tr>
      <th>mean</th>
      <td>33179.733102</td>
      <td>197.040520</td>
      <td>199.364124</td>
      <td>194.585782</td>
      <td>197.034900</td>
      <td>190.494909</td>
      <td>5.942124e+06</td>
      <td>0.011757</td>
      <td>0.000172</td>
    </tr>
    <tr>
      <th>std</th>
      <td>19158.201385</td>
      <td>363.150484</td>
      <td>367.873829</td>
      <td>358.011643</td>
      <td>363.052047</td>
      <td>359.635301</td>
      <td>1.615619e+07</td>
      <td>0.283142</td>
      <td>0.022716</td>
    </tr>
    <tr>
      <th>min</th>
      <td>1.000000</td>
      <td>1.601000</td>
      <td>1.662800</td>
      <td>1.584200</td>
      <td>1.606600</td>
      <td>1.201300</td>
      <td>0.000000e+00</td>
      <td>0.000000</td>
      <td>0.000000</td>
    </tr>
    <tr>
      <th>25%</th>
      <td>16589.500000</td>
      <td>29.789950</td>
      <td>30.090000</td>
      <td>29.470000</td>
      <td>29.787450</td>
      <td>28.143400</td>
      <td>5.099855e+05</td>
      <td>0.000000</td>
      <td>0.000000</td>
    </tr>
    <tr>
      <th>50%</th>
      <td>33178.000000</td>
      <td>70.700000</td>
      <td>71.400000</td>
      <td>69.890000</td>
      <td>70.680000</td>
      <td>63.141000</td>
      <td>1.415896e+06</td>
      <td>0.000000</td>
      <td>0.000000</td>
    </tr>
    <tr>
      <th>75%</th>
      <td>49766.500000</td>
      <td>185.990000</td>
      <td>188.000000</td>
      <td>184.000000</td>
      <td>186.100000</td>
      <td>175.253900</td>
      <td>4.089299e+06</td>
      <td>0.000000</td>
      <td>0.000000</td>
    </tr>
    <tr>
      <th>max</th>
      <td>66930.000000</td>
      <td>2926.000000</td>
      <td>2957.000000</td>
      <td>2813.000000</td>
      <td>2839.000000</td>
      <td>2802.938200</td>
      <td>3.763915e+08</td>
      <td>22.500000</td>
      <td>5.000000</td>
    </tr>
  </tbody>
</table>

```python
df_pl = pl.read_parquet(DATA / "eurostoxx50_ohlcv.parquet")

display(df_pl.head(3))
display(df_pl.tail(3))
display(df_pl.sample(3, seed=42))
display(df_pl.describe())
```

<div><!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

<div><!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>66876</td><td>WKL.AS</td><td>2026-03-10</td><td>68.8</td><td>69.16</td><td>66.34</td><td>67.16</td><td>67.16</td><td>1355645</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>66877</td><td>WKL.AS</td><td>2026-03-11</td><td>67.5</td><td>69.6</td><td>67.02</td><td>67.22</td><td>67.22</td><td>1142531</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>66929</td><td>WKL.AS</td><td>2026-03-12</td><td>67.0</td><td>67.54</td><td>66.28</td><td>67.32</td><td>67.32</td><td>210379</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

<div><!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>11531</td><td>SAN.MC</td><td>2024-09-20</td><td>4.58</td><td>4.6285</td><td>4.5585</td><td>4.5585</td><td>4.3259</td><td>70961183</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>35605</td><td>CS.PA</td><td>2025-10-15</td><td>40.54</td><td>41.0</td><td>40.17</td><td>40.17</td><td>40.17</td><td>3204582</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>63668</td><td>WKL.AS</td><td>2022-01-07</td><td>97.52</td><td>97.96</td><td>96.92</td><td>97.34</td><td>91.0808</td><td>408411</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

<div><!-- shape: (9, 13) --><table><thead><tr><th>statistic</th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>str</td><td>f64</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>count</td><td>66355.0</td><td>66355</td><td>66355</td><td>66355.0</td><td>66355.0</td><td>66355.0</td><td>66355.0</td><td>66355.0</td><td>66355.0</td><td>66355.0</td><td>66355.0</td><td>66355.0</td></tr><tr><td>null_count</td><td>0.0</td><td>0</td><td>0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td></tr><tr><td>mean</td><td>33179.733102</td><td>null</td><td>2023-08-05 00:56:42.354005</td><td>197.04052</td><td>199.364124</td><td>194.585782</td><td>197.0349</td><td>190.494909</td><td>5.9421e6</td><td>0.011757</td><td>0.000172</td><td>0.00009</td></tr><tr><td>std</td><td>19158.201385</td><td>null</td><td>null</td><td>363.150484</td><td>367.873829</td><td>358.011643</td><td>363.052047</td><td>359.635301</td><td>1.6156e7</td><td>0.283142</td><td>0.022716</td><td>null</td></tr><tr><td>min</td><td>1.0</td><td>ABI.BR</td><td>2021-01-04</td><td>1.601</td><td>1.6628</td><td>1.5842</td><td>1.6066</td><td>1.2013</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td></tr><tr><td>25%</td><td>16590.0</td><td>null</td><td>2022-04-20</td><td>29.79</td><td>30.09</td><td>29.47</td><td>29.7899</td><td>28.1461</td><td>509991.0</td><td>0.0</td><td>0.0</td><td>null</td></tr><tr><td>50%</td><td>33178.0</td><td>null</td><td>2023-08-03</td><td>70.7</td><td>71.4</td><td>69.89</td><td>70.68</td><td>63.141</td><td>1.415896e6</td><td>0.0</td><td>0.0</td><td>null</td></tr><tr><td>75%</td><td>49767.0</td><td>null</td><td>2024-11-19</td><td>186.0</td><td>188.0</td><td>184.0</td><td>186.1</td><td>175.2609</td><td>4.089463e6</td><td>0.0</td><td>0.0</td><td>null</td></tr><tr><td>max</td><td>66930.0</td><td>WKL.AS</td><td>2026-03-12</td><td>2926.0</td><td>2957.0</td><td>2813.0</td><td>2839.0</td><td>2802.9382</td><td>3.76391539e8</td><td>22.5</td><td>5.0</td><td>1.0</td></tr></tbody></table></div>

### Memory usage


- **Memory Usage**: Measure RAM consumption (Pandas).

```python
print("Pandas memory usage:")
df_pd.info(memory_usage="deep")
```

    Pandas memory usage:
    <class 'pandas.core.frame.DataFrame'>
    RangeIndex: 66355 entries, 0 to 66354
    Data columns (total 12 columns):
     #   Column        Non-Null Count  Dtype  
    ---  ------        --------------  -----  
     0   id            66355 non-null  int64  
     1   symbol        66355 non-null  object 
     2   date          66355 non-null  object 
     3   open          66355 non-null  float64
     4   high          66355 non-null  float64
     5   low           66355 non-null  float64
     6   close         66355 non-null  float64
     7   adj_close     66355 non-null  float64
     8   volume        66355 non-null  int64  
     9   dividends     66355 non-null  float64
     10  stock_splits  66355 non-null  float64
     11  is_filled     66355 non-null  bool   
    dtypes: bool(1), float64(7), int64(2), object(2)
    memory usage: 10.6 MB

```python
size_bytes = df_pl.estimated_size("b")
size_mb = df_pl.estimated_size("mb")
print(f"Polars estimated size: {size_bytes:,} bytes ({size_mb:.2f} MB)")
```

    Polars estimated size: 5,454,618 bytes (5.20 MB)

### Null / NaN inspection

```python
# Pandas
print("Null counts per column:")
display(df_pd.isnull().sum())
print(f"\nTotal nulls: {df_pd.isnull().sum().sum()}")
```

    Null counts per column:

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
      <td>0</td>
    </tr>
    <tr>
      <th>symbol</th>
      <td>0</td>
    </tr>
    <tr>
      <th>date</th>
      <td>0</td>
    </tr>
    <tr>
      <th>open</th>
      <td>0</td>
    </tr>
    <tr>
      <th>high</th>
      <td>0</td>
    </tr>
    <tr>
      <th>low</th>
      <td>0</td>
    </tr>
    <tr>
      <th>close</th>
      <td>0</td>
    </tr>
    <tr>
      <th>adj_close</th>
      <td>0</td>
    </tr>
    <tr>
      <th>volume</th>
      <td>0</td>
    </tr>
    <tr>
      <th>dividends</th>
      <td>0</td>
    </tr>
    <tr>
      <th>stock_splits</th>
      <td>0</td>
    </tr>
    <tr>
      <th>is_filled</th>
      <td>0</td>
    </tr>
  </tbody>
</table>

    
    Total nulls: 0

```python
# Polars
print("Null counts per column:")
display(df_pl.null_count())
```

    Null counts per column:

<div><!-- shape: (1, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td></tr></thead><tbody><tr><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr></tbody></table></div>

---
## Edge Cases and Gotchas

### Empty DataFrames

```python
# Pandas — empty DataFrame keeps dtypes
df_empty_pd = pd.DataFrame({"a": pd.Series(dtype="int64"), "b": pd.Series(dtype="float64")})
print(f"Shape: {df_empty_pd.shape}")
display(df_empty_pd.dtypes)
```

    Shape: (0, 2)

<table>
  <thead>
    <tr>
      <th></th>
      <th>0</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>a</th>
      <td>int64</td>
    </tr>
    <tr>
      <th>b</th>
      <td>float64</td>
    </tr>
  </tbody>
</table>

```python
# Polars — explicit schema for empty DataFrame
df_empty_pl = pl.DataFrame(schema={"a": pl.Int64, "b": pl.Float64})
print(f"Shape: {df_empty_pl.shape}")
print(f"Schema: {df_empty_pl.schema}")
display(df_empty_pl)
```

    Shape: (0, 2)
    Schema: Schema({'a': Int64, 'b': Float64})

<div><!-- shape: (0, 2) --><table><thead><tr><th>a</th><th>b</th></tr><tr><td>i64</td><td>f64</td></tr></thead><tbody></tbody></table></div>

### Column name duplicates

```python
# Pandas allows duplicate column names (!) — leads to confusing bugs
df_dup = pd.DataFrame([[1, 2]], columns=["x", "x"])
display(df_dup)
print(f"Selecting 'x' returns {df_dup['x'].shape[1]} columns — not 1!")
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>x</th>
      <th>x</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>1</td>
      <td>2</td>
    </tr>
  </tbody>
</table>

    Selecting 'x' returns 2 columns — not 1!

```python
# Polars rejects duplicate column names
try:
    df_dup = pl.DataFrame({"x": [1], "x": [2]})  # dict deduplicates first
    print("Dict deduplicates, so only one 'x':")
    display(df_dup)
except Exception as e:
    print(f"Error: {e}")

# Trying via schema
try:
    df_dup = pl.from_records([(1, 2)], schema=["x", "x"], orient="row")
    display(df_dup)
except Exception as e:
    print(f"Polars error on duplicate columns: {e}")
```

    Dict deduplicates, so only one 'x':

<div><!-- shape: (1, 1) --><table><thead><tr><th>x</th></tr><tr><td>i64</td></tr></thead><tbody><tr><td>2</td></tr></tbody></table></div>

    Polars error on duplicate columns: column with name 'x' has more than one occurrence

### Integer overflow

```python
# Pandas silently wraps on int overflow (numpy behavior)
s = pd.Series([np.iinfo(np.int64).max], dtype="int64")
print(f"Max int64: {s.iloc[0]}")
s_overflow = s + 1
print(f"Max + 1  : {s_overflow.iloc[0]}  ← silent wrap!")
```

    Max int64: 9223372036854775807
    Max + 1  : -9223372036854775808  ← silent wrap!

```python
# Polars raises on overflow in debug builds / returns null
s = pl.Series("x", [2**63 - 1], dtype=pl.Int64)
print(f"Max int64: {s[0]}")
try:
    result = s + 1
    print(f"Max + 1  : {result[0]}")
except Exception as e:
    print(f"Polars overflow error: {e}")
```

    Max int64: 9223372036854775807
    Max + 1  : -9223372036854775808

### Gotcha — Pandas .values vs .to_numpy() vs .to_list()

- **To NumPy**: Extract column as NumPy array.

```python
s = pd.Series([1, 2, 3])

# .values returns a numpy array (legacy, may share memory)
print(f".values type      : {type(s.values)}")

# .to_numpy() is the recommended way
print(f".to_numpy() type  : {type(s.to_numpy())}")

# .to_list() gives a plain Python list
print(f".to_list() type   : {type(s.to_list())}")

# Gotcha: .values may return a view — mutating it mutates the Series!
arr = s.values
arr[0] = 999
print(f"Series after mutating .values: {s.tolist()}  ← changed!")
```

    .values type      : <class 'numpy.ndarray'>
    .to_numpy() type  : <class 'numpy.ndarray'>
    .to_list() type   : <class 'list'>
    Series after mutating .values: [999, 2, 3]  ← changed!

```python
s = pl.Series("x", [1, 2, 3])

# Explicitly create a writable copy in memory
arr = s.to_numpy().copy()

# Now mutation is allowed
arr[0] = 999

print(f"Original Series: {s.to_list()} -> unchanged")
print(f"Mutated Array: {arr.tolist()}")
```

    Original Series: [1, 2, 3] -> unchanged
    Mutated Array: [999, 2, 3]

---
## Comparison Summary Table

```python
comparison = pl.DataFrame({
    "Feature": [
        "1-D data structure",
        "2-D data structure",
        "Row index",
        "Missing values",
        "Default int type",
        "Default float type",
        "Default string type",
        "Type safety",
        "Duplicate column names",
        "Memory layout",
        "Lazy evaluation",
        "MultiIndex",
        "Create from dict",
        "Create from numpy",
        "Create from records",
        "Shape attribute",
        "Height / width attrs",
        "Null counting",
        "Memory estimation",
        "Type casting",
    ],
    "Pandas": [
        "pd.Series (indexed)",
        "pd.DataFrame (indexed)",
        "Yes — RangeIndex, named, Multi",
        "NaN (float) or pd.NA",
        "int64",
        "float64",
        "object (or StringDtype)",
        "Low — object dtype is a catch-all",
        "Allowed (bug-prone)",
        "Column-major (BlockManager)",
        "No (eager only)",
        "Yes — pd.MultiIndex",
        "pd.DataFrame(dict)",
        "pd.DataFrame(arr, columns=…)",
        "pd.DataFrame(list_of_dicts)",
        ".shape → (rows, cols)",
        "No",
        "df.isnull().sum()",
        "df.memory_usage(deep=True)",
        ".astype() / pd.to_datetime()",
    ],
    "Polars": [
        "pl.Series (named, no index)",
        "pl.DataFrame (no index)",
        "No — all data lives in columns",
        "null (Arrow bitmask)",
        "Int64",
        "Float64",
        "String (Utf8)",
        "High — strict type checking",
        "Rejected (error)",
        "Column-major (Arrow arrays)",
        "Yes — pl.LazyFrame",
        "No — use regular columns",
        "pl.DataFrame(dict)",
        "pl.DataFrame({'col': arr})",
        "pl.DataFrame(list_of_dicts)",
        ".shape → (rows, cols)",
        "Yes — .height, .width",
        "df.null_count()",
        "df.estimated_size()",
        ".cast() / .str.to_date()",
    ],
})

display(comparison)
```

<div><!-- shape: (20, 3) --><table><thead><tr><th>Feature</th><th>Pandas</th><th>Polars</th></tr><tr><td>str</td><td>str</td><td>str</td></tr></thead><tbody><tr><td>1-D data structure</td><td>pd.Series (indexed)</td><td>pl.Series (named, no index)</td></tr><tr><td>2-D data structure</td><td>pd.DataFrame (indexed)</td><td>pl.DataFrame (no index)</td></tr><tr><td>Row index</td><td>Yes — RangeIndex, named, Multi</td><td>No — all data lives in columns</td></tr><tr><td>Missing values</td><td>NaN (float) or pd.NA</td><td>null (Arrow bitmask)</td></tr><tr><td>Default int type</td><td>int64</td><td>Int64</td></tr><tr><td>Default float type</td><td>float64</td><td>Float64</td></tr><tr><td>Default string type</td><td>object (or StringDtype)</td><td>String (Utf8)</td></tr><tr><td>Type safety</td><td>Low — object dtype is a catch-…</td><td>High — strict type checking</td></tr><tr><td>Duplicate column names</td><td>Allowed (bug-prone)</td><td>Rejected (error)</td></tr><tr><td>Memory layout</td><td>Column-major (BlockManager)</td><td>Column-major (Arrow arrays)</td></tr><tr><td>Lazy evaluation</td><td>No (eager only)</td><td>Yes — pl.LazyFrame</td></tr><tr><td>MultiIndex</td><td>Yes — pd.MultiIndex</td><td>No — use regular columns</td></tr><tr><td>Create from dict</td><td>pd.DataFrame(dict)</td><td>pl.DataFrame(dict)</td></tr><tr><td>Create from numpy</td><td>pd.DataFrame(arr, columns=…)</td><td>pl.DataFrame({&#x27;col&#x27;: arr})</td></tr><tr><td>Create from records</td><td>pd.DataFrame(list_of_dicts)</td><td>pl.DataFrame(list_of_dicts)</td></tr><tr><td>Shape attribute</td><td>.shape → (rows, cols)</td><td>.shape → (rows, cols)</td></tr><tr><td>Height / width attrs</td><td>No</td><td>Yes — .height, .width</td></tr><tr><td>Null counting</td><td>df.isnull().sum()</td><td>df.null_count()</td></tr><tr><td>Memory estimation</td><td>df.memory_usage(deep=True)</td><td>df.estimated_size()</td></tr><tr><td>Type casting</td><td>.astype() / pd.to_datetime()</td><td>.cast() / .str.to_date()</td></tr></tbody></table></div>

---
#### Key takeaways
- Polars has **no index** — this eliminates a whole class of alignment bugs.
- Polars uses **Arrow-native nulls** — no NaN-induced type promotion.
- Polars is **stricter** with types — catches errors earlier.
- Pandas is more **permissive** — great for exploration, risky in production.
- Both can create DataFrames from dicts, lists, numpy, and files.
- For new projects, Polars' design avoids many Pandas footguns while being faster.

---
# Part 2: Reading & Writing Data

## Setup and Imports

## Discovering Data Files

We use `pathlib` and glob patterns to discover every file in the `../data/`
directory, grouped by extension.

```python
DATA_DIR = Path("../data")
assert DATA_DIR.exists(), f"Data directory not found: {DATA_DIR.resolve()}"

all_files = sorted(DATA_DIR.iterdir())
print(f"Total files in data directory: {len(all_files)}")
for f in all_files:
    size_kb = f.stat().st_size / 1024
    print(f"  {f.name:<35s} {size_kb:>10,.1f} KB")
```

    Total files in data directory: 39
      dim_country.csv                            2.8 KB
      dim_country.json                          13.0 KB
      dim_country.parquet                        5.0 KB
      dim_index.csv                              0.2 KB
      dim_index.json                             0.6 KB
      dim_index.parquet                          3.5 KB
      eurostoxx50_ohlcv.csv                  5,162.0 KB
      eurostoxx50_ohlcv.json                17,668.3 KB
      eurostoxx50_ohlcv.parquet              2,426.7 KB
      index_dim.csv                            278.0 KB
      index_dim.json                           371.8 KB
      index_dim.parquet                        145.0 KB
      index_performance.csv                    940.1 KB
      index_performance.json                 2,432.6 KB
      index_performance.parquet                344.9 KB
      oil20_ohlcv.csv                        1,849.1 KB
      oil20_ohlcv.json                       6,511.6 KB
      oil20_ohlcv.parquet                      882.4 KB
      pulse.csv                                  6.8 KB
      pulse.json                                20.8 KB
      pulse.parquet                             16.4 KB
      scores_daily.csv                         236.6 KB
      scores_daily.json                        541.0 KB
      scores_daily.parquet                     117.4 KB
      scores_quarterly.csv                      49.0 KB
      scores_quarterly.json                    148.1 KB
      scores_quarterly.parquet                  33.6 KB
      signals_daily.csv                         84.6 KB
      signals_daily.json                       270.5 KB
      signals_daily.parquet                     59.4 KB
      signals_quarterly.csv                     28.4 KB
      signals_quarterly.json                   112.7 KB
      signals_quarterly.parquet                 29.2 KB
      stoxxusa50_ohlcv.csv                   5,048.3 KB
      stoxxusa50_ohlcv.json                 17,318.1 KB
      stoxxusa50_ohlcv.parquet               2,522.3 KB
      trading_calendar.csv                   1,498.8 KB
      trading_calendar.json                  7,342.8 KB
      trading_calendar.parquet                  34.8 KB

```python
# Group files by extension using glob
csv_files  = sorted(DATA_DIR.glob("*.csv"))
json_files = sorted(DATA_DIR.glob("*.json"))
pq_files   = sorted(DATA_DIR.glob("*.parquet"))

print(f"CSV  files: {len(csv_files)}")
print(f"JSON files: {len(json_files)}")
print(f"Parquet files: {len(pq_files)}")
```

    CSV  files: 13
    JSON files: 13
    Parquet files: 13

```python
# Build a summary table of file sizes by format
rows = []
stems = sorted({f.stem for f in all_files})
for stem in stems:
    row = {"dataset": stem}
    for ext in ["csv", "json", "parquet"]:
        p = DATA_DIR / f"{stem}.{ext}"
        row[ext + "_KB"] = round(p.stat().st_size / 1024, 1) if p.exists() else None # type: ignore
    rows.append(row)

size_df = pd.DataFrame(rows)
display(Markdown("### File sizes by format (KB)"))
display(size_df)
```

### File sizes by format (KB)

<table>
  <thead>
    <tr>
      <th></th>
      <th>dataset</th>
      <th>csv_KB</th>
      <th>json_KB</th>
      <th>parquet_KB</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>dim_country</td>
      <td>2.8</td>
      <td>13.0</td>
      <td>5.0</td>
    </tr>
    <tr>
      <th>1</th>
      <td>dim_index</td>
      <td>0.2</td>
      <td>0.6</td>
      <td>3.5</td>
    </tr>
    <tr>
      <th>2</th>
      <td>eurostoxx50_ohlcv</td>
      <td>5162.0</td>
      <td>17668.3</td>
      <td>2426.7</td>
    </tr>
    <tr>
      <th>3</th>
      <td>index_dim</td>
      <td>278.0</td>
      <td>371.8</td>
      <td>145.0</td>
    </tr>
    <tr>
      <th>4</th>
      <td>index_performance</td>
      <td>940.1</td>
      <td>2432.6</td>
      <td>344.9</td>
    </tr>
    <tr>
      <th>5</th>
      <td>oil20_ohlcv</td>
      <td>1849.1</td>
      <td>6511.6</td>
      <td>882.4</td>
    </tr>
    <tr>
      <th>6</th>
      <td>pulse</td>
      <td>6.8</td>
      <td>20.8</td>
      <td>16.4</td>
    </tr>
    <tr>
      <th>7</th>
      <td>scores_daily</td>
      <td>236.6</td>
      <td>541.0</td>
      <td>117.4</td>
    </tr>
    <tr>
      <th>8</th>
      <td>scores_quarterly</td>
      <td>49.0</td>
      <td>148.1</td>
      <td>33.6</td>
    </tr>
    <tr>
      <th>9</th>
      <td>signals_daily</td>
      <td>84.6</td>
      <td>270.5</td>
      <td>59.4</td>
    </tr>
    <tr>
      <th>10</th>
      <td>signals_quarterly</td>
      <td>28.4</td>
      <td>112.7</td>
      <td>29.2</td>
    </tr>
    <tr>
      <th>11</th>
      <td>stoxxusa50_ohlcv</td>
      <td>5048.3</td>
      <td>17318.1</td>
      <td>2522.3</td>
    </tr>
    <tr>
      <th>12</th>
      <td>trading_calendar</td>
      <td>1498.8</td>
      <td>7342.8</td>
      <td>34.8</td>
    </tr>
  </tbody>
</table>

## Reading CSV Files



### Pandas read_csv

> [!danger] read_csv() dtype inference trap
>
> `pd.read_csv()` infers dtypes from the first 100 rows by default.
> If the first 100 rows of a column contain only integers but row 101 has a float or
> null, Pandas silently coerces the entire column. Always specify `dtype=` for critical
> columns, or use `dtype_backend="pyarrow"` for consistent nullable types. Integer columns
> with any null values are silently upcast to `float64` — a common source of broken join
> keys (`1.0 != 1` in string comparisons).

> [!warning] Encoding defaults differ between Pandas
>
> Encoding defaults differ between Pandas and Polars
> Pandas `read_csv()` defaults to `encoding='utf-8'` but **silently falls back** on some
> platforms. Polars only supports UTF-8 — non-UTF-8 files raise an error immediately.
> For files from legacy systems (SQL Server BCP exports, Excel CSV), always specify
> `encoding='utf-8-sig'` (to handle BOM) or `encoding='latin-1'`.

```python
# Basic read - small file
df_pd = pd.read_csv(DATA_DIR / "dim_country.csv")
print(f"Shape: {df_pd.shape}")
print(f"Dtypes:\n{df_pd.dtypes}")
display(df_pd.head())
```

    Shape: (212, 2)
    Dtypes:
    country_name    object
    iso_alpha2      object
    dtype: object

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>country_name</th>
      <th>iso_alpha2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Afghanistan</td>
      <td>AF</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Albania</td>
      <td>AL</td>
    </tr>
    <tr>
      <th>2</th>
      <td>Algeria</td>
      <td>DZ</td>
    </tr>
    <tr>
      <th>3</th>
      <td>American Samoa</td>
      <td>AS</td>
    </tr>
    <tr>
      <th>4</th>
      <td>Andorra</td>
      <td>AD</td>
    </tr>
  </tbody>
</table>
</div>

```python
# Reading a larger file with explicit parameters
df_pd_ohlcv = pd.read_csv(
    DATA_DIR / "eurostoxx50_ohlcv.csv",
    sep=",",               # separator (default)
    dtype={"ticker": "category"},
    parse_dates=["date"],
    na_values=["", "NA", "N/A"],
)
print(f"Shape: {df_pd_ohlcv.shape}")
print(f"Dtypes:\n{df_pd_ohlcv.dtypes}")
display(df_pd_ohlcv.head(3))
```

    Shape: (66355, 12)
    Dtypes:
    id                       int64
    symbol                  object
    date            datetime64[ns]
    open                   float64
    high                   float64
    low                    float64
    close                  float64
    adj_close              float64
    volume                   int64
    dividends              float64
    stock_splits           float64
    is_filled                 bool
    dtype: object

<div>
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
</div>

```python
# Read only specific columns and limit rows (useful for peeking)
df_peek = pd.read_csv(
    DATA_DIR / "trading_calendar.csv",
    usecols=lambda c: c in ["date", "exchange", "is_open"],
    nrows=5,
)
display(Markdown("### Peek at trading_calendar.csv (first 5 rows, selected cols)"))
display(df_peek)
```

### Peek at trading_calendar.csv (first 5 rows, selected cols)

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>date</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>2021-01-01</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2021-01-02</td>
    </tr>
    <tr>
      <th>2</th>
      <td>2021-01-03</td>
    </tr>
    <tr>
      <th>3</th>
      <td>2021-01-04</td>
    </tr>
    <tr>
      <th>4</th>
      <td>2021-01-05</td>
    </tr>
  </tbody>
</table>
</div>

### Polars read_csv (Eager)



```python
# Basic read - small file
df_pl = pl.read_csv(DATA_DIR / "dim_country.csv")
print(f"Shape: {df_pl.shape}")
print(f"Schema: {df_pl.schema}")
display(df_pl.head())
```

    Shape: (212, 2)
    Schema: Schema({'country_name': String, 'iso_alpha2': String})

<div><!-- shape: (5, 2) --><table><thead><tr><th>country_name</th><th>iso_alpha2</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>Afghanistan</td><td>AF</td></tr><tr><td>Albania</td><td>AL</td></tr><tr><td>Algeria</td><td>DZ</td></tr><tr><td>American Samoa</td><td>AS</td></tr><tr><td>Andorra</td><td>AD</td></tr></tbody></table></div>

```python
# Polars read_csv with parameters
df_pl_ohlcv = pl.read_csv(
    DATA_DIR / "eurostoxx50_ohlcv.csv",
    separator=",",
    null_values=["", "NA", "N/A"],
    try_parse_dates=True,
    schema_overrides={"ticker": pl.Categorical},
)
print(f"Shape: {df_pl_ohlcv.shape}")
print(f"Schema: {df_pl_ohlcv.schema}")
display(df_pl_ohlcv.head(3))
```

    Shape: (66355, 12)
    Schema: Schema({'id': Int64, 'symbol': String, 'date': Date, 'open': Float64, 'high': Float64, 'low': Float64, 'close': Float64, 'adj_close': Float64, 'volume': Int64, 'dividends': Float64, 'stock_splits': Float64, 'is_filled': Boolean})

<div><!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

### Polars scan_csv (Lazy)

```python
# Lazy scan - no data is read yet!
lf = pl.scan_csv(DATA_DIR / "eurostoxx50_ohlcv.csv", try_parse_dates=True)
print(f"Type: {type(lf)}")
print(f"Schema: {lf.collect_schema()}")
print("No data loaded yet - this is a query plan.")
```

    Type: <class 'polars.lazyframe.frame.LazyFrame'>
    Schema: Schema({'id': Int64, 'symbol': String, 'date': Date, 'open': Float64, 'high': Float64, 'low': Float64, 'close': Float64, 'adj_close': Float64, 'volume': Int64, 'dividends': Float64, 'stock_splits': Float64, 'is_filled': Boolean})
    No data loaded yet - this is a query plan.

```python
# Collect a filtered subset - Polars pushes predicates down
result = (
    lf
    .filter(pl.col("symbol") == "ADYEN.AS")
    .select("date", "symbol", "close", "volume")
    .head(5)
    .collect()
)
display(Markdown("### Lazy scan -> filtered collect"))
display(result)
```

### Lazy scan -> filtered collect

<div><!-- shape: (5, 4) --><table><thead><tr><th>date</th><th>symbol</th><th>close</th><th>volume</th></tr><tr><td>date</td><td>str</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>2021-01-04</td><td>ADYEN.AS</td><td>1859.5</td><td>99408</td></tr><tr><td>2021-01-05</td><td>ADYEN.AS</td><td>1829.0</td><td>86256</td></tr><tr><td>2021-01-06</td><td>ADYEN.AS</td><td>1733.0</td><td>156844</td></tr><tr><td>2021-01-07</td><td>ADYEN.AS</td><td>1714.5</td><td>90183</td></tr><tr><td>2021-01-08</td><td>ADYEN.AS</td><td>1756.5</td><td>97176</td></tr></tbody></table></div>

```python
# Load ALL csv files with Pandas
print("Loading all CSV files with Pandas...")
pd_csvs = {}
for f in csv_files:
    t0 = time.perf_counter()
    pd_csvs[f.stem] = pd.read_csv(f)
    elapsed = time.perf_counter() - t0
    print(f"  {f.stem:30s} -> {pd_csvs[f.stem].shape}  ({elapsed:.3f}s)")
```

    Loading all CSV files with Pandas...
      dim_country                    -> (212, 2)  (0.001s)
      dim_index                      -> (4, 5)  (0.001s)
      eurostoxx50_ohlcv              -> (66355, 12)  (0.035s)
      index_dim                      -> (169, 26)  (0.004s)
      index_performance              -> (5281, 15)  (0.006s)
      oil20_ohlcv                    -> (24738, 12)  (0.013s)
      pulse                          -> (40, 20)  (0.001s)
      scores_daily                   -> (466, 36)  (0.003s)
      scores_quarterly               -> (170, 29)  (0.001s)
      signals_daily                  -> (466, 19)  (0.001s)
      signals_quarterly              -> (177, 22)  (0.001s)
      stoxxusa50_ohlcv               -> (65100, 12)  (0.029s)
      trading_calendar               -> (29335, 11)  (0.010s)

```python
# Load ALL csv files with Polars
print("Loading all CSV files with Polars...")
pl_csvs = {}
for f in csv_files:
    t0 = time.perf_counter()
    pl_csvs[f.stem] = pl.read_csv(f, try_parse_dates=True)
    elapsed = time.perf_counter() - t0
    print(f"  {f.stem:30s} -> {pl_csvs[f.stem].shape}  ({elapsed:.3f}s)")
```

    Loading all CSV files with Polars...
      dim_country                    -> (212, 2)  (0.001s)
      dim_index                      -> (4, 5)  (0.001s)
      eurostoxx50_ohlcv              -> (66355, 12)  (0.003s)
      index_dim                      -> (169, 26)  (0.009s)
      index_performance              -> (5281, 15)  (0.003s)
      oil20_ohlcv                    -> (24738, 12)  (0.002s)
      pulse                          -> (40, 20)  (0.001s)
      scores_daily                   -> (466, 36)  (0.003s)
      scores_quarterly               -> (170, 29)  (0.002s)
      signals_daily                  -> (466, 19)  (0.001s)
      signals_quarterly              -> (177, 22)  (0.001s)
      stoxxusa50_ohlcv               -> (65100, 12)  (0.003s)
      trading_calendar               -> (29335, 11)  (0.002s)

## Reading JSON Files


- **Read JSON**: Load a JSON file into a DataFrame.

### Pandas read_json

- **Read JSON**: Load a JSON file into a DataFrame.

```python
df_pd_json = pd.read_json(DATA_DIR / "dim_index.json")
print(f"Shape: {df_pd_json.shape}")
display(df_pd_json.head())
```

    Shape: (4, 5)

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>index_key</th>
      <th>display_name</th>
      <th>file_prefix</th>
      <th>color</th>
      <th>currency</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>euro_stoxx_50</td>
      <td>Euro Stoxx 50</td>
      <td>eurostoxx50</td>
      <td>#4285F4</td>
      <td>€</td>
    </tr>
    <tr>
      <th>1</th>
      <td>oil_20</td>
      <td>Oil &amp; Gas 20</td>
      <td>oil20</td>
      <td>#D4A017</td>
      <td>$</td>
    </tr>
    <tr>
      <th>2</th>
      <td>stoxx_asia_50</td>
      <td>STOXX Asia/Pacific 50</td>
      <td>stoxxasia50</td>
      <td>#EF5350</td>
      <td></td>
    </tr>
    <tr>
      <th>3</th>
      <td>stoxx_usa_50</td>
      <td>STOXX USA 50</td>
      <td>stoxxusa50</td>
      <td>#FFFFFF</td>
      <td>$</td>
    </tr>
  </tbody>
</table>
</div>

```python
# Load a larger JSON file
df_pd_perf = pd.read_json(DATA_DIR / "index_performance.json")
print(f"Shape: {df_pd_perf.shape}")
print(f"Dtypes:\n{df_pd_perf.dtypes}")
display(df_pd_perf.head(3))
```

    Shape: (5281, 15)
    Dtypes:
    id                                 int64
    _index                            object
    perf_date                         object
    daily_return                     float64
    cumulative_factor                float64
    rolling_30d_return               float64
    rolling_90d_return               float64
    ytd_return                       float64
    rolling_30d_volatility           float64
    stocks_count                       int64
    avg_pe                           float64
    avg_pb                           float64
    avg_dividend_yield               float64
    avg_market_cap                   float64
    _computed_at              datetime64[ns]
    dtype: object

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>id</th>
      <th>_index</th>
      <th>perf_date</th>
      <th>daily_return</th>
      <th>cumulative_factor</th>
      <th>rolling_30d_return</th>
      <th>rolling_90d_return</th>
      <th>ytd_return</th>
      <th>rolling_30d_volatility</th>
      <th>stocks_count</th>
      <th>avg_pe</th>
      <th>avg_pb</th>
      <th>avg_dividend_yield</th>
      <th>avg_market_cap</th>
      <th>_computed_at</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>1</td>
      <td>euro_stoxx_50</td>
      <td>2021-01-05</td>
      <td>-0.004626</td>
      <td>0.995374</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>-0.004626</td>
      <td>NaN</td>
      <td>49</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>2026-03-04 22:40:26.069309</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2</td>
      <td>euro_stoxx_50</td>
      <td>2021-01-06</td>
      <td>0.018394</td>
      <td>1.013683</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>0.013683</td>
      <td>NaN</td>
      <td>48</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>2026-03-04 22:40:26.069309</td>
    </tr>
    <tr>
      <th>2</th>
      <td>3</td>
      <td>euro_stoxx_50</td>
      <td>2021-01-07</td>
      <td>0.005412</td>
      <td>1.019168</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>0.019168</td>
      <td>NaN</td>
      <td>49</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>2026-03-04 22:40:26.069309</td>
    </tr>
  </tbody>
</table>
</div>

### Polars read_json

- **Read JSON**: Load a JSON file into a DataFrame.

```python
df_pl_json = pl.read_json(DATA_DIR / "dim_index.json")
print(f"Shape: {df_pl_json.shape}")
print(f"Schema: {df_pl_json.schema}")
display(df_pl_json.head())
```

    Shape: (4, 5)
    Schema: Schema({'index_key': String, 'display_name': String, 'file_prefix': String, 'color': String, 'currency': String})

<div><!-- shape: (4, 5) --><table><thead><tr><th>index_key</th><th>display_name</th><th>file_prefix</th><th>color</th><th>currency</th></tr><tr><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td></tr></thead><tbody><tr><td>euro_stoxx_50</td><td>Euro Stoxx 50</td><td>eurostoxx50</td><td>#4285F4</td><td>€</td></tr><tr><td>oil_20</td><td>Oil &amp; Gas 20</td><td>oil20</td><td>#D4A017</td><td>$</td></tr><tr><td>stoxx_asia_50</td><td>STOXX Asia/Pacific 50</td><td>stoxxasia50</td><td>#EF5350</td><td></td></tr><tr><td>stoxx_usa_50</td><td>STOXX USA 50</td><td>stoxxusa50</td><td>#FFFFFF</td><td>$</td></tr></tbody></table></div>

```python
# Setting infer_schema_length to None forces Polars to scan the whole file
df_pl_perf = pl.read_json(
    DATA_DIR / "index_performance.json", 
    infer_schema_length=None
)

print(f"Shape: {df_pl_perf.shape}")
display(df_pl_perf.head(3))
```

    Shape: (5281, 15)

<div><!-- shape: (3, 15) --><table><thead><tr><th>id</th><th>_index</th><th>perf_date</th><th>daily_return</th><th>cumulative_factor</th><th>rolling_30d_return</th><th>rolling_90d_return</th><th>ytd_return</th><th>rolling_30d_volatility</th><th>stocks_count</th><th>avg_pe</th><th>avg_pb</th><th>avg_dividend_yield</th><th>avg_market_cap</th><th>_computed_at</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>1</td><td>euro_stoxx_50</td><td>2021-01-05</td><td>-0.004626</td><td>0.995374</td><td>null</td><td>null</td><td>-0.004626</td><td>null</td><td>49</td><td>null</td><td>null</td><td>null</td><td>null</td><td>2026-03-04 22:40:26.069309</td></tr><tr><td>2</td><td>euro_stoxx_50</td><td>2021-01-06</td><td>0.018394</td><td>1.013683</td><td>null</td><td>null</td><td>0.013683</td><td>null</td><td>48</td><td>null</td><td>null</td><td>null</td><td>null</td><td>2026-03-04 22:40:26.069309</td></tr><tr><td>3</td><td>euro_stoxx_50</td><td>2021-01-07</td><td>0.005412</td><td>1.019168</td><td>null</td><td>null</td><td>0.019168</td><td>null</td><td>49</td><td>null</td><td>null</td><td>null</td><td>null</td><td>2026-03-04 22:40:26.069309</td></tr></tbody></table></div>

### Polars scan_ndjson (Lazy)

`scan_ndjson` works with newline-delimited JSON files.  Standard JSON
arrays need to be converted first.  We demonstrate by writing NDJSON
and scanning it back.

```python
# Write an NDJSON file from an existing dataframe, then scan it lazily
ndjson_path = DATA_DIR / "dim_index.ndjson"
pl.read_json(DATA_DIR / "dim_index.json").write_ndjson(ndjson_path)

lf_ndjson = pl.scan_ndjson(ndjson_path)
print(f"Type: {type(lf_ndjson)}")
print(f"Schema: {lf_ndjson.collect_schema()}")
display(lf_ndjson.head(3).collect())

# Clean up temp file
ndjson_path.unlink()
```

    Type: <class 'polars.lazyframe.frame.LazyFrame'>
    Schema: Schema({'index_key': String, 'display_name': String, 'file_prefix': String, 'color': String, 'currency': String})

<div><!-- shape: (3, 5) --><table><thead><tr><th>index_key</th><th>display_name</th><th>file_prefix</th><th>color</th><th>currency</th></tr><tr><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td></tr></thead><tbody><tr><td>euro_stoxx_50</td><td>Euro Stoxx 50</td><td>eurostoxx50</td><td>#4285F4</td><td>€</td></tr><tr><td>oil_20</td><td>Oil &amp; Gas 20</td><td>oil20</td><td>#D4A017</td><td>$</td></tr><tr><td>stoxx_asia_50</td><td>STOXX Asia/Pacific 50</td><td>stoxxasia50</td><td>#EF5350</td><td></td></tr></tbody></table></div>

```python
# Load ALL json files with Pandas
print("Loading all JSON files with Pandas...")
pd_jsons = {}
for f in json_files:
    t0 = time.perf_counter()
    pd_jsons[f.stem] = pd.read_json(f)
    elapsed = time.perf_counter() - t0
    print(f"  {f.stem:30s} -> {pd_jsons[f.stem].shape}  ({elapsed:.3f}s)")
```

    Loading all JSON files with Pandas...
      dim_country                    -> (212, 2)  (0.002s)
      dim_index                      -> (4, 5)  (0.001s)
      eurostoxx50_ohlcv              -> (66355, 12)  (0.173s)
      index_dim                      -> (169, 26)  (0.004s)
      index_performance              -> (5281, 15)  (0.016s)
      oil20_ohlcv                    -> (24738, 12)  (0.057s)
      pulse                          -> (40, 20)  (0.003s)
      scores_daily                   -> (466, 36)  (0.008s)
      scores_quarterly               -> (170, 29)  (0.004s)
      signals_daily                  -> (466, 19)  (0.003s)
      signals_quarterly              -> (177, 22)  (0.003s)
      stoxxusa50_ohlcv               -> (65100, 12)  (0.153s)
      trading_calendar               -> (29335, 11)  (0.062s)

```python
# Load ALL json files with Polars
print("Loading all JSON files with Polars...")
pl_jsons = {}

for f in json_files:
    t0 = time.perf_counter()
    
    # Force full-file schema scanning to prevent the Null to Float ComputeError
    pl_jsons[f.stem] = pl.read_json(f, infer_schema_length=None)
    
    elapsed = time.perf_counter() - t0
    print(f"  {f.stem:30s} -> {pl_jsons[f.stem].shape}  ({elapsed:.3f}s)")
```

    Loading all JSON files with Polars...
      dim_country                    -> (212, 2)  (0.000s)
      dim_index                      -> (4, 5)  (0.000s)
      eurostoxx50_ohlcv              -> (66355, 12)  (0.107s)
      index_dim                      -> (169, 26)  (0.001s)
      index_performance              -> (5281, 15)  (0.009s)
      oil20_ohlcv                    -> (24738, 12)  (0.032s)
      pulse                          -> (40, 20)  (0.000s)
      scores_daily                   -> (466, 36)  (0.002s)
      scores_quarterly               -> (170, 29)  (0.001s)
      signals_daily                  -> (466, 19)  (0.001s)
      signals_quarterly              -> (177, 22)  (0.001s)
      stoxxusa50_ohlcv               -> (65100, 12)  (0.088s)
      trading_calendar               -> (29335, 11)  (0.035s)

## Reading Parquet Files



### Pandas read_parquet


```python
df_pd_pq = pd.read_parquet(DATA_DIR / "dim_country.parquet")
print(f"Shape: {df_pd_pq.shape}")
print(f"Dtypes:\n{df_pd_pq.dtypes}")
display(df_pd_pq.head())
```

    Shape: (212, 2)
    Dtypes:
    country_name    object
    iso_alpha2      object
    dtype: object

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>country_name</th>
      <th>iso_alpha2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Afghanistan</td>
      <td>AF</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Albania</td>
      <td>AL</td>
    </tr>
    <tr>
      <th>2</th>
      <td>Algeria</td>
      <td>DZ</td>
    </tr>
    <tr>
      <th>3</th>
      <td>American Samoa</td>
      <td>AS</td>
    </tr>
    <tr>
      <th>4</th>
      <td>Andorra</td>
      <td>AD</td>
    </tr>
  </tbody>
</table>
</div>

```python
# Read specific columns only (Parquet supports column projection)
df_pd_pq_cols = pd.read_parquet(
    DATA_DIR / "eurostoxx50_ohlcv.parquet",
    columns=["date", "symbol", "close"],
)
print(f"Shape (projected): {df_pd_pq_cols.shape}")
display(df_pd_pq_cols.head(3))
```

    Shape (projected): (66355, 3)

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>date</th>
      <th>symbol</th>
      <th>close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>2021-01-04</td>
      <td>ABI.BR</td>
      <td>57.21</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2021-01-05</td>
      <td>ABI.BR</td>
      <td>57.18</td>
    </tr>
    <tr>
      <th>2</th>
      <td>2021-01-06</td>
      <td>ABI.BR</td>
      <td>58.77</td>
    </tr>
  </tbody>
</table>
</div>

### Polars read_parquet (Eager)



```python
df_pl_pq = pl.read_parquet(DATA_DIR / "dim_country.parquet")
print(f"Shape: {df_pl_pq.shape}")
print(f"Schema: {df_pl_pq.schema}")
display(df_pl_pq.head())
```

    Shape: (212, 2)
    Schema: Schema({'country_name': String, 'iso_alpha2': String})

<div><!-- shape: (5, 2) --><table><thead><tr><th>country_name</th><th>iso_alpha2</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>Afghanistan</td><td>AF</td></tr><tr><td>Albania</td><td>AL</td></tr><tr><td>Algeria</td><td>DZ</td></tr><tr><td>American Samoa</td><td>AS</td></tr><tr><td>Andorra</td><td>AD</td></tr></tbody></table></div>

```python
# Polars read_parquet with column selection
df_pl_pq_cols = pl.read_parquet(
    DATA_DIR / "eurostoxx50_ohlcv.parquet",
    columns=["date", "symbol", "close"],
)
print(f"Shape (projected): {df_pl_pq_cols.shape}")
display(df_pl_pq_cols.head(3))
```

    Shape (projected): (66355, 3)

<div><!-- shape: (3, 3) --><table><thead><tr><th>date</th><th>symbol</th><th>close</th></tr><tr><td>date</td><td>str</td><td>f64</td></tr></thead><tbody><tr><td>2021-01-04</td><td>ABI.BR</td><td>57.21</td></tr><tr><td>2021-01-05</td><td>ABI.BR</td><td>57.18</td></tr><tr><td>2021-01-06</td><td>ABI.BR</td><td>58.77</td></tr></tbody></table></div>

### Polars scan_parquet (Lazy)



```python
lf_pq = pl.scan_parquet(DATA_DIR / "eurostoxx50_ohlcv.parquet")
print(f"Type: {type(lf_pq)}")
print(f"Schema: {lf_pq.collect_schema()}")
```

    Type: <class 'polars.lazyframe.frame.LazyFrame'>
    Schema: Schema({'id': Int64, 'symbol': String, 'date': Date, 'open': Float64, 'high': Float64, 'low': Float64, 'close': Float64, 'adj_close': Float64, 'volume': Int64, 'dividends': Float64, 'stock_splits': Float64, 'is_filled': Boolean})

```python
# Lazy scan with predicate pushdown and projection pushdown
result_pq = (
    lf_pq
    .filter(pl.col("symbol") == "ADYEN.AS")
    .select("date", "close")
    .sort("date", descending=True)
    .head(10)
    .collect()
)
display(Markdown("### Lazy parquet scan -> filtered, sorted, collected"))
display(result_pq)
```

### Lazy parquet scan -> filtered, sorted, collected

<div><!-- shape: (10, 2) --><table><thead><tr><th>date</th><th>close</th></tr><tr><td>date</td><td>f64</td></tr></thead><tbody><tr><td>2026-03-12</td><td>925.7</td></tr><tr><td>2026-03-11</td><td>926.5</td></tr><tr><td>2026-03-10</td><td>935.0</td></tr><tr><td>2026-03-09</td><td>942.7</td></tr><tr><td>2026-03-06</td><td>930.4</td></tr><tr><td>2026-03-05</td><td>931.5</td></tr><tr><td>2026-03-04</td><td>957.6</td></tr><tr><td>2026-03-03</td><td>949.1</td></tr><tr><td>2026-03-02</td><td>965.7</td></tr><tr><td>2026-02-27</td><td>994.8</td></tr></tbody></table></div>

```python
# Load ALL parquet files with Pandas
print("Loading all Parquet files with Pandas...")
pd_pqs = {}
for f in pq_files:
    t0 = time.perf_counter()
    pd_pqs[f.stem] = pd.read_parquet(f)
    elapsed = time.perf_counter() - t0
    print(f"  {f.stem:30s} -> {pd_pqs[f.stem].shape}  ({elapsed:.3f}s)")
```

    Loading all Parquet files with Pandas...
      dim_country                    -> (212, 2)  (0.002s)
      dim_index                      -> (4, 5)  (0.001s)
      eurostoxx50_ohlcv              -> (66355, 12)  (0.006s)
      index_dim                      -> (169, 26)  (0.005s)
      index_performance              -> (5281, 15)  (0.002s)
      oil20_ohlcv                    -> (24738, 12)  (0.003s)
      pulse                          -> (40, 20)  (0.002s)
      scores_daily                   -> (466, 36)  (0.002s)
      scores_quarterly               -> (170, 29)  (0.002s)
      signals_daily                  -> (466, 19)  (0.001s)
      signals_quarterly              -> (177, 22)  (0.001s)
      stoxxusa50_ohlcv               -> (65100, 12)  (0.005s)
      trading_calendar               -> (29335, 11)  (0.003s)

```python
# Load ALL parquet files with Polars
print("Loading all Parquet files with Polars...")
pl_pqs = {}
for f in pq_files:
    t0 = time.perf_counter()
    pl_pqs[f.stem] = pl.read_parquet(f)
    elapsed = time.perf_counter() - t0
    print(f"  {f.stem:30s} -> {pl_pqs[f.stem].shape}  ({elapsed:.3f}s)")
```

    Loading all Parquet files with Polars...
      dim_country                    -> (212, 2)  (0.001s)
      dim_index                      -> (4, 5)  (0.001s)
      eurostoxx50_ohlcv              -> (66355, 12)  (0.004s)
      index_dim                      -> (169, 26)  (0.001s)
      index_performance              -> (5281, 15)  (0.001s)
      oil20_ohlcv                    -> (24738, 12)  (0.002s)
      pulse                          -> (40, 20)  (0.001s)
      scores_daily                   -> (466, 36)  (0.001s)
      scores_quarterly               -> (170, 29)  (0.001s)
      signals_daily                  -> (466, 19)  (0.001s)
      signals_quarterly              -> (177, 22)  (0.001s)
      stoxxusa50_ohlcv               -> (65100, 12)  (0.004s)
      trading_calendar               -> (29335, 11)  (0.001s)

## Parameter Deep-Dives



### dtypes / schema_overrides


```python
# Pandas: dtype parameter
df_dtype_pd = pd.read_csv(
    DATA_DIR / "pulse.csv",
    dtype={
        "ticker": "category",
    },
)
print("Pandas dtypes with category override:")
print(df_dtype_pd.dtypes)
display(df_dtype_pd.head(3))
```

    Pandas dtypes with category override:
    id                        int64
    _index                   object
    _ingested_at             object
    symbol                   object
    timestamp                object
    current_price           float64
    open_price              float64
    day_high                float64
    day_low                 float64
    previous_close          float64
    price_change            float64
    price_change_pct        float64
    bid                     float64
    ask                     float64
    bid_size                float64
    ask_size                float64
    spread                  float64
    current_volume            int64
    average_volume_10day      int64
    volume_ratio            float64
    dtype: object

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>id</th>
      <th>_index</th>
      <th>_ingested_at</th>
      <th>symbol</th>
      <th>timestamp</th>
      <th>current_price</th>
      <th>open_price</th>
      <th>day_high</th>
      <th>day_low</th>
      <th>previous_close</th>
      <th>price_change</th>
      <th>price_change_pct</th>
      <th>bid</th>
      <th>ask</th>
      <th>bid_size</th>
      <th>ask_size</th>
      <th>spread</th>
      <th>current_volume</th>
      <th>average_volume_10day</th>
      <th>volume_ratio</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>20192</td>
      <td>euro_stoxx_50</td>
      <td>2026-03-12 12:50:13.639560</td>
      <td>BMW.DE</td>
      <td>2026-03-12 13:49:54</td>
      <td>80.40</td>
      <td>79.0</td>
      <td>81.16</td>
      <td>77.90</td>
      <td>80.82</td>
      <td>-0.42</td>
      <td>-0.5197</td>
      <td>80.38</td>
      <td>80.52</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>0.14</td>
      <td>770681</td>
      <td>1209819</td>
      <td>0.6370</td>
    </tr>
    <tr>
      <th>1</th>
      <td>20193</td>
      <td>euro_stoxx_50</td>
      <td>2026-03-12 12:50:13.639560</td>
      <td>RHM.DE</td>
      <td>2026-03-12 13:49:55</td>
      <td>1551.00</td>
      <td>1536.0</td>
      <td>1588.00</td>
      <td>1535.00</td>
      <td>1520.50</td>
      <td>30.50</td>
      <td>2.0059</td>
      <td>1551.50</td>
      <td>1552.00</td>
      <td>267.0</td>
      <td>45.0</td>
      <td>0.50</td>
      <td>159633</td>
      <td>294973</td>
      <td>0.5412</td>
    </tr>
    <tr>
      <th>2</th>
      <td>20194</td>
      <td>euro_stoxx_50</td>
      <td>2026-03-12 12:50:13.639560</td>
      <td>BAS.DE</td>
      <td>2026-03-12 13:49:55</td>
      <td>47.67</td>
      <td>46.3</td>
      <td>48.10</td>
      <td>45.96</td>
      <td>46.31</td>
      <td>1.36</td>
      <td>2.9367</td>
      <td>47.68</td>
      <td>47.71</td>
      <td>1393.0</td>
      <td>165.0</td>
      <td>0.03</td>
      <td>1512800</td>
      <td>4089134</td>
      <td>0.3700</td>
    </tr>
  </tbody>
</table>
</div>

```python
# Polars: schema_overrides parameter
df_dtype_pl = pl.read_csv(
    DATA_DIR / "pulse.csv",
    schema_overrides={
        "ticker": pl.Categorical,
    },
)
print("Polars schema with overrides:")
print(df_dtype_pl.schema)
display(df_dtype_pl.head(3))
```

    Polars schema with overrides:
    Schema({'id': Int64, '_index': String, '_ingested_at': String, 'symbol': String, 'timestamp': String, 'current_price': Float64, 'open_price': Float64, 'day_high': Float64, 'day_low': Float64, 'previous_close': Float64, 'price_change': Float64, 'price_change_pct': Float64, 'bid': Float64, 'ask': Float64, 'bid_size': Float64, 'ask_size': Float64, 'spread': Float64, 'current_volume': Int64, 'average_volume_10day': Int64, 'volume_ratio': Float64})

<div><!-- shape: (3, 20) --><table><thead><tr><th>id</th><th>_index</th><th>_ingested_at</th><th>symbol</th><th>timestamp</th><th>current_price</th><th>open_price</th><th>day_high</th><th>day_low</th><th>previous_close</th><th>price_change</th><th>price_change_pct</th><th>bid</th><th>ask</th><th>bid_size</th><th>ask_size</th><th>spread</th><th>current_volume</th><th>average_volume_10day</th><th>volume_ratio</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>i64</td><td>f64</td></tr></thead><tbody><tr><td>20192</td><td>euro_stoxx_50</td><td>2026-03-12 12:50:13.639560</td><td>BMW.DE</td><td>2026-03-12 13:49:54</td><td>80.4</td><td>79.0</td><td>81.16</td><td>77.9</td><td>80.82</td><td>-0.42</td><td>-0.5197</td><td>80.38</td><td>80.52</td><td>0.0</td><td>0.0</td><td>0.14</td><td>770681</td><td>1209819</td><td>0.637</td></tr><tr><td>20193</td><td>euro_stoxx_50</td><td>2026-03-12 12:50:13.639560</td><td>RHM.DE</td><td>2026-03-12 13:49:55</td><td>1551.0</td><td>1536.0</td><td>1588.0</td><td>1535.0</td><td>1520.5</td><td>30.5</td><td>2.0059</td><td>1551.5</td><td>1552.0</td><td>267.0</td><td>45.0</td><td>0.5</td><td>159633</td><td>294973</td><td>0.5412</td></tr><tr><td>20194</td><td>euro_stoxx_50</td><td>2026-03-12 12:50:13.639560</td><td>BAS.DE</td><td>2026-03-12 13:49:55</td><td>47.67</td><td>46.3</td><td>48.1</td><td>45.96</td><td>46.31</td><td>1.36</td><td>2.9367</td><td>47.68</td><td>47.71</td><td>1393.0</td><td>165.0</td><td>0.03</td><td>1512800</td><td>4089134</td><td>0.37</td></tr></tbody></table></div>

### null_values


```python
# Pandas recognises many null sentinels by default (NA, N/A, null, etc.)
# You can extend with na_values
df_null_pd = pd.read_csv(
    DATA_DIR / "scores_daily.csv",
    na_values=["", "NA", "N/A", "null", "-"],
)
null_counts_pd = df_null_pd.isnull().sum()
print("Pandas null counts per column:")
display(null_counts_pd[null_counts_pd > 0])
```

    Pandas null counts per column:

    pe_zscore               3
    pb_zscore               6
    ev_ebitda_zscore       71
    yield_zscore           35
    recommendation_mean    14
    dtype: int64

```python
# Polars: null_values parameter
df_null_pl = pl.read_csv(
    DATA_DIR / "scores_daily.csv",
    null_values=["", "NA", "N/A", "null", "-"],
)
null_counts_pl = df_null_pl.null_count()
print("Polars null counts per column:")
display(null_counts_pl)
```

    Polars null counts per column:

<div><!-- shape: (1, 36) --><table><thead><tr><th>id</th><th>_index</th><th>symbol</th><th>score_date</th><th>sector</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>relative_value_rank</th><th>relative_strength</th><th>sma_50_ratio</th><th>sma_200_ratio</th><th>dist_from_52w_high</th><th>momentum_score</th><th>momentum_rank</th><th>implied_upside</th><th>recommendation_mean</th><th>price_falling_analysts_bullish</th><th>sentiment_score</th><th>sentiment_rank</th><th>composite_score</th><th>composite_rank</th><th>_scored_at</th><th>sma_30_close</th><th>sma_90_close</th><th>market_cap</th><th>index_weight</th><th>short_name</th><th>country</th><th>current_price</th><th>day_change_pct</th><th>five_day_change_pct</th><th>ytd_change_pct</th><th>currency</th></tr><tr><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td></tr></thead><tbody><tr><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>3</td><td>6</td><td>71</td><td>35</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>14</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr></tbody></table></div>

### separator


```python
# Demonstrate reading with explicit separator
# (Our data uses comma, but showing the parameter)
df_sep_pd = pd.read_csv(DATA_DIR / "dim_index.csv", sep=",")
print(f"Pandas with explicit sep=',' -> shape {df_sep_pd.shape}")

df_sep_pl = pl.read_csv(DATA_DIR / "dim_index.csv", separator=",")
print(f"Polars with explicit separator=',' -> shape {df_sep_pl.shape}")

# Note: Pandas uses 'sep', Polars uses 'separator'
display(df_sep_pd.head(3))
```

    Pandas with explicit sep=',' -> shape (4, 5)
    Polars with explicit separator=',' -> shape (4, 5)

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>index_key</th>
      <th>display_name</th>
      <th>file_prefix</th>
      <th>color</th>
      <th>currency</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>euro_stoxx_50</td>
      <td>Euro Stoxx 50</td>
      <td>eurostoxx50</td>
      <td>#4285F4</td>
      <td>€</td>
    </tr>
    <tr>
      <th>1</th>
      <td>oil_20</td>
      <td>Oil &amp; Gas 20</td>
      <td>oil20</td>
      <td>#D4A017</td>
      <td>$</td>
    </tr>
    <tr>
      <th>2</th>
      <td>stoxx_asia_50</td>
      <td>STOXX Asia/Pacific 50</td>
      <td>stoxxasia50</td>
      <td>#EF5350</td>
      <td>NaN</td>
    </tr>
  </tbody>
</table>
</div>

## Writing Data


- **Write CSV**: Save DataFrame to CSV file.

### Writing CSV


- **Write CSV**: Save DataFrame to CSV file.

```python
OUT_DIR = Path("../data/_output")
OUT_DIR.mkdir(exist_ok=True)

# Pandas to_csv
df_pd_pq = pd.read_parquet(DATA_DIR / "scores_quarterly.parquet")
csv_path_pd = OUT_DIR / "scores_quarterly_pandas.csv"
df_pd_pq.to_csv(csv_path_pd, index=False)
print(f"Pandas CSV written: {csv_path_pd.stat().st_size / 1024:.1f} KB")

# Polars to_csv (called write_csv)
df_pl_pq2 = pl.read_parquet(DATA_DIR / "scores_quarterly.parquet")
csv_path_pl = OUT_DIR / "scores_quarterly_polars.csv"
df_pl_pq2.write_csv(csv_path_pl)
print(f"Polars CSV written: {csv_path_pl.stat().st_size / 1024:.1f} KB")
```

    Pandas CSV written: 49.0 KB
    Polars CSV written: 49.3 KB

### Writing JSON

```python
# Pandas to_json
json_path_pd = OUT_DIR / "scores_quarterly_pandas.json"
df_pd_pq.to_json(json_path_pd, orient="records", indent=2)
print(f"Pandas JSON written: {json_path_pd.stat().st_size / 1024:.1f} KB")

# Polars write_json
json_path_pl = OUT_DIR / "scores_quarterly_polars.json"
df_pl_pq2.write_json(json_path_pl)
print(f"Polars JSON written: {json_path_pl.stat().st_size / 1024:.1f} KB")
```

    Pandas JSON written: 143.6 KB
    Polars JSON written: 128.7 KB

### Writing Parquet


- **Write Parquet**: Save DataFrame to Parquet file.

```python
# Pandas to_parquet
pq_path_pd = OUT_DIR / "scores_quarterly_pandas.parquet"
df_pd_pq.to_parquet(pq_path_pd, index=False)
print(f"Pandas Parquet written: {pq_path_pd.stat().st_size / 1024:.1f} KB")

# Polars write_parquet
pq_path_pl = OUT_DIR / "scores_quarterly_polars.parquet"
df_pl_pq2.write_parquet(pq_path_pl)
print(f"Polars Parquet written: {pq_path_pl.stat().st_size / 1024:.1f} KB")
```

    Pandas Parquet written: 33.6 KB
    Polars Parquet written: 23.9 KB

```python
# Compare output file sizes
display(Markdown("### Output file size comparison"))
out_files = sorted(OUT_DIR.glob("scores_quarterly_*"))
rows = []
for f in out_files:
    rows.append({"file": f.name, "size_KB": round(f.stat().st_size / 1024, 1)})
display(pd.DataFrame(rows))
```

### Output file size comparison

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>file</th>
      <th>size_KB</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>scores_quarterly_pandas.csv</td>
      <td>49.0</td>
    </tr>
    <tr>
      <th>1</th>
      <td>scores_quarterly_pandas.json</td>
      <td>143.6</td>
    </tr>
    <tr>
      <th>2</th>
      <td>scores_quarterly_pandas.parquet</td>
      <td>33.6</td>
    </tr>
    <tr>
      <th>3</th>
      <td>scores_quarterly_polars.csv</td>
      <td>49.3</td>
    </tr>
    <tr>
      <th>4</th>
      <td>scores_quarterly_polars.json</td>
      <td>128.7</td>
    </tr>
    <tr>
      <th>5</th>
      <td>scores_quarterly_polars.parquet</td>
      <td>23.9</td>
    </tr>
  </tbody>
</table>
</div>

```python
# Cleanup output directory
shutil.rmtree(OUT_DIR)
print(f"Cleaned up {OUT_DIR}")
```

    Cleaned up ..\data\_output

## Lazy Scanning vs Eager Reading

Polars' `scan_*` functions return a `LazyFrame` that does **not** read
data until `.collect()` is called.  This enables:

- **Predicate pushdown** - filters applied before reading data
- **Projection pushdown** - only needed columns are read
- **Query optimization** - Polars rewrites the plan for efficiency

Eager `read_*` loads everything into memory immediately.

```python
# Eager: reads entire file into memory
t0 = time.perf_counter()
df_eager = pl.read_parquet(DATA_DIR / "eurostoxx50_ohlcv.parquet")
eager_time = time.perf_counter() - t0
print(f"Eager read: {df_eager.shape}, {eager_time:.4f}s")
```

    Eager read: (66355, 12), 0.0044s

```python
# Lazy: scan + filter + collect (only reads what's needed)
t0 = time.perf_counter()
df_lazy = (
    pl.scan_parquet(DATA_DIR / "eurostoxx50_ohlcv.parquet")
    .filter(pl.col("symbol") == "ADYEN.AS")
    .select("date", "close")
    .collect()
)
lazy_time = time.perf_counter() - t0
print(f"Lazy scan+filter+collect: {df_lazy.shape}, {lazy_time:.4f}s")
print(f"\nLazy was ~{eager_time / max(lazy_time, 0.0001):.1f}x vs eager for this filtered query")
```

    Lazy scan+filter+collect: (1331, 2), 0.0018s
    
    Lazy was ~2.5x vs eager for this filtered query

```python
# Explain the query plan
plan = (
    pl.scan_parquet(DATA_DIR / "eurostoxx50_ohlcv.parquet")
    .filter(pl.col("symbol") == "ADYEN.AS")
    .select("date", "close", "volume")
    .sort("date")
)
print("=== Optimized Query Plan ===")
print(plan.explain())
```

    === Optimized Query Plan ===
    SORT BY [col("date")]
      simple π 3/3 ["date", "close", "volume"]
        Parquet SCAN [../data/eurostoxx50_ohlcv.parquet]
        PROJECT 4/12 COLUMNS
        SELECTION: [(col("symbol")) == ("ADYEN.AS")]
        ESTIMATED ROWS: 66355

```python
# Lazy scan_csv comparison
t0 = time.perf_counter()
df_csv_eager = pl.read_csv(DATA_DIR / "oil20_ohlcv.csv", try_parse_dates=True)
csv_eager_time = time.perf_counter() - t0

t0 = time.perf_counter()
df_csv_lazy = (
    pl.scan_csv(DATA_DIR / "oil20_ohlcv.csv", try_parse_dates=True)
    .filter(pl.col("symbol") == "CL=F")
    .select("date", "close")
    .collect()
)
csv_lazy_time = time.perf_counter() - t0

print(f"CSV eager: {df_csv_eager.shape} in {csv_eager_time:.4f}s")
print(f"CSV lazy+filter: {df_csv_lazy.shape} in {csv_lazy_time:.4f}s")
```

    CSV eager: (24738, 12) in 0.0023s
    CSV lazy+filter: (0, 2) in 0.0034s

## Format Comparison: Size and Speed

For a deeper look at when to choose Parquet, CSV, or JSON across the full data pipeline, see [[serialization-formats]]. The same Parquet I/O patterns shown here apply when loading data into BigQuery via [[data-loading-and-export]].

- **Read JSON**: Load a JSON file into a DataFrame.

```python
# Benchmark read speed: CSV vs JSON vs Parquet for Pandas and Polars
benchmark_datasets = ["dim_country", "pulse", "scores_daily",
                      "index_performance", "oil20_ohlcv"]
results = []

for name in benchmark_datasets:
    for fmt, reader_pd, reader_pl in [
        ("csv",     lambda p: pd.read_csv(p),     lambda p: pl.read_csv(p, try_parse_dates=True)),
        # Add infer_schema_length=None to the Polars JSON reader
        ("json",    lambda p: pd.read_json(p),    lambda p: pl.read_json(p, infer_schema_length=None)),
        ("parquet", lambda p: pd.read_parquet(p), lambda p: pl.read_parquet(p)),
    ]:
        fpath = DATA_DIR / f"{name}.{fmt}"
        if not fpath.exists():
            continue
        size_kb = fpath.stat().st_size / 1024

        t0 = time.perf_counter()
        _ = reader_pd(fpath)
        pd_time = time.perf_counter() - t0

        t0 = time.perf_counter()
        _ = reader_pl(fpath)
        pl_time = time.perf_counter() - t0

        results.append({
            "dataset": name,
            "format": fmt,
            "size_KB": round(size_kb, 1),
            "pandas_sec": round(pd_time, 4),
            "polars_sec": round(pl_time, 4),
        })

bench_df = pd.DataFrame(results)
display(Markdown("### Read Speed Benchmark"))
display(bench_df)
```

### Read Speed Benchmark

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>dataset</th>
      <th>format</th>
      <th>size_KB</th>
      <th>pandas_sec</th>
      <th>polars_sec</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>dim_country</td>
      <td>csv</td>
      <td>2.8</td>
      <td>0.0013</td>
      <td>0.0011</td>
    </tr>
    <tr>
      <th>1</th>
      <td>dim_country</td>
      <td>json</td>
      <td>13.0</td>
      <td>0.0014</td>
      <td>0.0003</td>
    </tr>
    <tr>
      <th>2</th>
      <td>dim_country</td>
      <td>parquet</td>
      <td>5.0</td>
      <td>0.0014</td>
      <td>0.0011</td>
    </tr>
    <tr>
      <th>3</th>
      <td>pulse</td>
      <td>csv</td>
      <td>6.8</td>
      <td>0.0009</td>
      <td>0.0009</td>
    </tr>
    <tr>
      <th>4</th>
      <td>pulse</td>
      <td>json</td>
      <td>20.8</td>
      <td>0.0033</td>
      <td>0.0003</td>
    </tr>
    <tr>
      <th>5</th>
      <td>pulse</td>
      <td>parquet</td>
      <td>16.4</td>
      <td>0.0018</td>
      <td>0.0007</td>
    </tr>
    <tr>
      <th>6</th>
      <td>scores_daily</td>
      <td>csv</td>
      <td>236.6</td>
      <td>0.0031</td>
      <td>0.0035</td>
    </tr>
    <tr>
      <th>7</th>
      <td>scores_daily</td>
      <td>json</td>
      <td>541.0</td>
      <td>0.0082</td>
      <td>0.0025</td>
    </tr>
    <tr>
      <th>8</th>
      <td>scores_daily</td>
      <td>parquet</td>
      <td>117.4</td>
      <td>0.0023</td>
      <td>0.0009</td>
    </tr>
    <tr>
      <th>9</th>
      <td>index_performance</td>
      <td>csv</td>
      <td>940.1</td>
      <td>0.0066</td>
      <td>0.0025</td>
    </tr>
    <tr>
      <th>10</th>
      <td>index_performance</td>
      <td>json</td>
      <td>2432.6</td>
      <td>0.0174</td>
      <td>0.0088</td>
    </tr>
    <tr>
      <th>11</th>
      <td>index_performance</td>
      <td>parquet</td>
      <td>344.9</td>
      <td>0.0023</td>
      <td>0.0010</td>
    </tr>
    <tr>
      <th>12</th>
      <td>oil20_ohlcv</td>
      <td>csv</td>
      <td>1849.1</td>
      <td>0.0142</td>
      <td>0.0022</td>
    </tr>
    <tr>
      <th>13</th>
      <td>oil20_ohlcv</td>
      <td>json</td>
      <td>6511.6</td>
      <td>0.0620</td>
      <td>0.0326</td>
    </tr>
    <tr>
      <th>14</th>
      <td>oil20_ohlcv</td>
      <td>parquet</td>
      <td>882.4</td>
      <td>0.0032</td>
      <td>0.0023</td>
    </tr>
  </tbody>
</table>
</div>

```python
# Pivot to compare formats side-by-side for file size
size_pivot = bench_df.pivot_table(
    index="dataset", columns="format", values="size_KB", aggfunc="first"
)[["csv", "json", "parquet"]]
size_pivot["parquet_vs_csv_%"] = (
    (size_pivot["parquet"] / size_pivot["csv"] * 100).round(1)
)
display(Markdown("### File Size Comparison (KB)"))
display(size_pivot)
```

### File Size Comparison (KB)

<div>
<table>
  <thead>
    <tr>
      <th>format</th>
      <th>csv</th>
      <th>json</th>
      <th>parquet</th>
      <th>parquet_vs_csv_%</th>
    </tr>
    <tr>
      <th>dataset</th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>dim_country</th>
      <td>2.8</td>
      <td>13.0</td>
      <td>5.0</td>
      <td>178.6</td>
    </tr>
    <tr>
      <th>index_performance</th>
      <td>940.1</td>
      <td>2432.6</td>
      <td>344.9</td>
      <td>36.7</td>
    </tr>
    <tr>
      <th>oil20_ohlcv</th>
      <td>1849.1</td>
      <td>6511.6</td>
      <td>882.4</td>
      <td>47.7</td>
    </tr>
    <tr>
      <th>pulse</th>
      <td>6.8</td>
      <td>20.8</td>
      <td>16.4</td>
      <td>241.2</td>
    </tr>
    <tr>
      <th>scores_daily</th>
      <td>236.6</td>
      <td>541.0</td>
      <td>117.4</td>
      <td>49.6</td>
    </tr>
  </tbody>
</table>
</div>

## Gotchas and Tips



### Date Parsing

- **Pandas**: use `parse_dates=["col"]` in `read_csv`; JSON dates often
  need `pd.to_datetime()` after loading.
- **Polars**: use `try_parse_dates=True` in `read_csv`; Parquet stores
  date types natively.
- **Gotcha**: Pandas may silently parse dates as strings if the format is
  ambiguous. Always verify dtypes after loading.

```python
# Pandas: dates in CSV may need explicit parsing
df_dates = pd.read_csv(DATA_DIR / "trading_calendar.csv")
print(f"date column dtype WITHOUT parse_dates: {df_dates['date'].dtype}")

df_dates2 = pd.read_csv(DATA_DIR / "trading_calendar.csv", parse_dates=["date"])
print(f"date column dtype WITH parse_dates:    {df_dates2['date'].dtype}")
```

    date column dtype WITHOUT parse_dates: object
    date column dtype WITH parse_dates:    datetime64[ns]

### Memory and Large Files

- **Parquet** supports column projection - read only the columns you need.
- **Polars lazy** scans avoid loading entire files.
- **Pandas** `read_csv` with `chunksize` returns an iterator for large files.

```python
# Pandas chunked reading
chunk_iter = pd.read_csv(DATA_DIR / "eurostoxx50_ohlcv.csv", chunksize=10_000)
total_rows = 0
for chunk in chunk_iter:
    total_rows += len(chunk)
print(f"Total rows via chunked reading: {total_rows:,}")
```

    Total rows via chunked reading: 66,355

### Index Handling


- **Write CSV**: Save DataFrame to CSV file.

```python
# Pandas default to_csv includes the index
buf = io.StringIO()
pd.DataFrame({"a": [1, 2]}).to_csv(buf)
print("With index (default):")
print(buf.getvalue())

buf2 = io.StringIO()
pd.DataFrame({"a": [1, 2]}).to_csv(buf2, index=False)
print("Without index:")
print(buf2.getvalue())
```

    With index (default):
    ,a
    0,1
    1,2
    
    Without index:
    a
    1
    2

### String vs Categorical

- For columns with low cardinality (e.g. tickers, country codes),
  use `category` (Pandas) or `Categorical` (Polars) to save memory.
- Set dtypes at read time for best performance.

```python
# Memory comparison: string vs category in Pandas
df_str = pd.read_csv(DATA_DIR / "eurostoxx50_ohlcv.csv", usecols=["symbol"])
df_cat = pd.read_csv(DATA_DIR / "eurostoxx50_ohlcv.csv", usecols=["symbol"],
                      dtype={"symbol": "category"})

mem_str = df_str.memory_usage(deep=True).sum() / 1024
mem_cat = df_cat.memory_usage(deep=True).sum() / 1024
print(f"String dtype memory:   {mem_str:,.1f} KB")
print(f"Category dtype memory: {mem_cat:,.1f} KB")
print(f"Savings: {(1 - mem_cat/mem_str)*100:.1f}%")
```

    String dtype memory:   3,569.2 KB
    Category dtype memory: 69.7 KB
    Savings: 98.0%

## Summary Comparison Table



```python
comparison = [
    ["Read CSV",           "pd.read_csv()",        "pl.read_csv()",          "Both excellent"],
    ["Read JSON",          "pd.read_json()",       "pl.read_json()",         "Polars stricter on schema"],
    ["Read Parquet",       "pd.read_parquet()",    "pl.read_parquet()",      "Both use Arrow under the hood"],
    ["Lazy CSV",           "N/A (use chunksize)",  "pl.scan_csv()",          "Polars only"],
    ["Lazy NDJSON",        "N/A",                  "pl.scan_ndjson()",       "Polars only; needs NDJSON format"],
    ["Lazy Parquet",       "N/A",                  "pl.scan_parquet()",      "Polars only; best lazy format"],
    ["Write CSV",          ".to_csv()",            ".write_csv()",           "Pandas writes index by default"],
    ["Write JSON",         ".to_json()",           ".write_json()",          "Different default orientations"],
    ["Write Parquet",      ".to_parquet()",        ".write_parquet()",       "Both produce valid Parquet"],
    ["dtype override",     "dtype={...}",          "dtypes={...}",          "Param name differs"],
    ["Schema override",    "dtype={...}",          "schema_overrides={...}", "Polars has dedicated param"],
    ["Null values",        "na_values=[...]",      "null_values=[...]",      "Param name differs"],
    ["Separator",          "sep=','",              "separator=','",          "Param name differs"],
    ["Column projection",  "usecols=[...]",        "columns=[...]",          "Parquet: both support this"],
    ["Predicate pushdown", "N/A",                  "LazyFrame.filter()",     "Polars only; major advantage"],
]

comp_df = pd.DataFrame(
    comparison, columns=["Operation", "Pandas", "Polars", "Notes"]
)
display(Markdown("### Pandas vs Polars - Reading & Writing Comparison"))
display(comp_df.style.set_properties(**{"text-align": "left"}).hide(axis="index")) # type: ignore
```

### Pandas vs Polars - Reading & Writing Comparison

<table id="T_ddd7b">
  <thead>
    <tr>
      <th id="T_ddd7b_level0_col0" class="col_heading level0 col0" >Operation</th>
      <th id="T_ddd7b_level0_col1" class="col_heading level0 col1" >Pandas</th>
      <th id="T_ddd7b_level0_col2" class="col_heading level0 col2" >Polars</th>
      <th id="T_ddd7b_level0_col3" class="col_heading level0 col3" >Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td id="T_ddd7b_row0_col0" class="data row0 col0" >Read CSV</td>
      <td id="T_ddd7b_row0_col1" class="data row0 col1" >pd.read_csv()</td>
      <td id="T_ddd7b_row0_col2" class="data row0 col2" >pl.read_csv()</td>
      <td id="T_ddd7b_row0_col3" class="data row0 col3" >Both excellent</td>
    </tr>
    <tr>
      <td id="T_ddd7b_row1_col0" class="data row1 col0" >Read JSON</td>
      <td id="T_ddd7b_row1_col1" class="data row1 col1" >pd.read_json()</td>
      <td id="T_ddd7b_row1_col2" class="data row1 col2" >pl.read_json()</td>
      <td id="T_ddd7b_row1_col3" class="data row1 col3" >Polars stricter on schema</td>
    </tr>
    <tr>
      <td id="T_ddd7b_row2_col0" class="data row2 col0" >Read Parquet</td>
      <td id="T_ddd7b_row2_col1" class="data row2 col1" >pd.read_parquet()</td>
      <td id="T_ddd7b_row2_col2" class="data row2 col2" >pl.read_parquet()</td>
      <td id="T_ddd7b_row2_col3" class="data row2 col3" >Both use Arrow under the hood</td>
    </tr>
    <tr>
      <td id="T_ddd7b_row3_col0" class="data row3 col0" >Lazy CSV</td>
      <td id="T_ddd7b_row3_col1" class="data row3 col1" >N/A (use chunksize)</td>
      <td id="T_ddd7b_row3_col2" class="data row3 col2" >pl.scan_csv()</td>
      <td id="T_ddd7b_row3_col3" class="data row3 col3" >Polars only</td>
    </tr>
    <tr>
      <td id="T_ddd7b_row4_col0" class="data row4 col0" >Lazy NDJSON</td>
      <td id="T_ddd7b_row4_col1" class="data row4 col1" >N/A</td>
      <td id="T_ddd7b_row4_col2" class="data row4 col2" >pl.scan_ndjson()</td>
      <td id="T_ddd7b_row4_col3" class="data row4 col3" >Polars only; needs NDJSON format</td>
    </tr>
    <tr>
      <td id="T_ddd7b_row5_col0" class="data row5 col0" >Lazy Parquet</td>
      <td id="T_ddd7b_row5_col1" class="data row5 col1" >N/A</td>
      <td id="T_ddd7b_row5_col2" class="data row5 col2" >pl.scan_parquet()</td>
      <td id="T_ddd7b_row5_col3" class="data row5 col3" >Polars only; best lazy format</td>
    </tr>
    <tr>
      <td id="T_ddd7b_row6_col0" class="data row6 col0" >Write CSV</td>
      <td id="T_ddd7b_row6_col1" class="data row6 col1" >.to_csv()</td>
      <td id="T_ddd7b_row6_col2" class="data row6 col2" >.write_csv()</td>
      <td id="T_ddd7b_row6_col3" class="data row6 col3" >Pandas writes index by default</td>
    </tr>
    <tr>
      <td id="T_ddd7b_row7_col0" class="data row7 col0" >Write JSON</td>
      <td id="T_ddd7b_row7_col1" class="data row7 col1" >.to_json()</td>
      <td id="T_ddd7b_row7_col2" class="data row7 col2" >.write_json()</td>
      <td id="T_ddd7b_row7_col3" class="data row7 col3" >Different default orientations</td>
    </tr>
    <tr>
      <td id="T_ddd7b_row8_col0" class="data row8 col0" >Write Parquet</td>
      <td id="T_ddd7b_row8_col1" class="data row8 col1" >.to_parquet()</td>
      <td id="T_ddd7b_row8_col2" class="data row8 col2" >.write_parquet()</td>
      <td id="T_ddd7b_row8_col3" class="data row8 col3" >Both produce valid Parquet</td>
    </tr>
    <tr>
      <td id="T_ddd7b_row9_col0" class="data row9 col0" >dtype override</td>
      <td id="T_ddd7b_row9_col1" class="data row9 col1" >dtype={...}</td>
      <td id="T_ddd7b_row9_col2" class="data row9 col2" >dtypes={...}</td>
      <td id="T_ddd7b_row9_col3" class="data row9 col3" >Param name differs</td>
    </tr>
    <tr>
      <td id="T_ddd7b_row10_col0" class="data row10 col0" >Schema override</td>
      <td id="T_ddd7b_row10_col1" class="data row10 col1" >dtype={...}</td>
      <td id="T_ddd7b_row10_col2" class="data row10 col2" >schema_overrides={...}</td>
      <td id="T_ddd7b_row10_col3" class="data row10 col3" >Polars has dedicated param</td>
    </tr>
    <tr>
      <td id="T_ddd7b_row11_col0" class="data row11 col0" >Null values</td>
      <td id="T_ddd7b_row11_col1" class="data row11 col1" >na_values=[...]</td>
      <td id="T_ddd7b_row11_col2" class="data row11 col2" >null_values=[...]</td>
      <td id="T_ddd7b_row11_col3" class="data row11 col3" >Param name differs</td>
    </tr>
    <tr>
      <td id="T_ddd7b_row12_col0" class="data row12 col0" >Separator</td>
      <td id="T_ddd7b_row12_col1" class="data row12 col1" >sep=','</td>
      <td id="T_ddd7b_row12_col2" class="data row12 col2" >separator=','</td>
      <td id="T_ddd7b_row12_col3" class="data row12 col3" >Param name differs</td>
    </tr>
    <tr>
      <td id="T_ddd7b_row13_col0" class="data row13 col0" >Column projection</td>
      <td id="T_ddd7b_row13_col1" class="data row13 col1" >usecols=[...]</td>
      <td id="T_ddd7b_row13_col2" class="data row13 col2" >columns=[...]</td>
      <td id="T_ddd7b_row13_col3" class="data row13 col3" >Parquet: both support this</td>
    </tr>
    <tr>
      <td id="T_ddd7b_row14_col0" class="data row14 col0" >Predicate pushdown</td>
      <td id="T_ddd7b_row14_col1" class="data row14 col1" >N/A</td>
      <td id="T_ddd7b_row14_col2" class="data row14 col2" >LazyFrame.filter()</td>
      <td id="T_ddd7b_row14_col3" class="data row14 col3" >Polars only; major advantage</td>
    </tr>
  </tbody>
</table>

---

#### Key takeaways

1. **Parquet** is the best format for analytical workloads: smallest files,
   fastest reads, native schema preservation.
2. **Polars lazy scanning** (`scan_csv`, `scan_parquet`, `scan_ndjson`)
   enables predicate and projection pushdown - only reads what you need.
3. **Parameter names differ** between Pandas and Polars (`sep` vs
   `separator`, `dtype` vs `dtypes` / `schema_overrides`, etc.).
4. **Always verify dtypes** after loading CSV/JSON - both libraries may
   guess wrong on dates, nulls, or mixed-type columns.
5. For **large files**, prefer Parquet + Polars lazy for best performance.
