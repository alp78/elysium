---
type: reference
category: programming-languages
technology: [python, pandas, polars, pyarrow]
tags: [reference, programming-languages, python, pandas, polars, types, interoperability, arrow]
aliases: [Pandas Polars Types Interop, categorical enum, list struct, arrow conversion, zero-copy]
keywords: [pandas, polars, categorical, enum, list, struct, arrow, pyarrow, numpy, to_pandas, to_numpy, to_arrow, from_arrow, zero-copy, dtype, ArrowDtype]
description: "Pandas vs Polars advanced types and interoperability — categoricals, enums, list/struct types, Arrow-backed dtypes, conversions between Pandas/Polars/NumPy/Arrow, zero-copy."
related:
  - "[[pandas-polars-index]]"
  - "[[07_lazy_performance]]"
  - "[[09_visualization_sql]]"
  - "[[data-formats-and-serialization]]"
created: 2026-03-23
updated: 2026-03-23
status: complete
---
# 08 — Advanced Types & Interoperability

Categoricals, nested types, library conversions.


```python
import pandas as pd
import polars as pl
import polars.selectors as cs
import numpy as np
from pathlib import Path
from IPython.display import display, Markdown

DATA = Path("../data")

# Core datasets
ohlcv_pd = pd.read_parquet(DATA / "eurostoxx50_ohlcv.parquet")  # 66K rows, daily OHLCV
ohlcv_pl = pl.read_parquet(DATA / "eurostoxx50_ohlcv.parquet")
dim_pd = pd.read_parquet(DATA / "index_dim.parquet")            # 169 rows, stock metadata
dim_pl = pl.read_parquet(DATA / "index_dim.parquet")
scores_pd = pd.read_parquet(DATA / "scores_daily.parquet")      # 466 rows, composite scores
scores_pl = pl.read_parquet(DATA / "scores_daily.parquet")

print(f"OHLCV: {ohlcv_pd.shape}, Dim: {dim_pd.shape}, Scores: {scores_pd.shape}")
```

## Categorical

This cell demonstrates:
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

This cell demonstrates:
- **Select**: Choose specific columns, optionally transforming them.
- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **Categorical**: Store repeated strings as integer codes. Saves memory, speeds up groupby.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.


```python
dim_cat = dim_pl.with_columns(pl.col("sector").cast(pl.Categorical).alias("sector_cat"))
print(f"dtype: {dim_cat["sector_cat"].dtype}")
display(dim_cat.select("symbol", "sector", "sector_cat").head(5))
```

    dtype: Categorical
    


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 3)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>sector</th><th>sector_cat</th></tr><tr><td>str</td><td>str</td><td>cat</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>&quot;Technology&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;MC.PA&quot;</td><td>&quot;Consumer Cyclical&quot;</td><td>&quot;Consumer Cyclical&quot;</td></tr><tr><td>&quot;RMS.PA&quot;</td><td>&quot;Consumer Cyclical&quot;</td><td>&quot;Consumer Cyclical&quot;</td></tr><tr><td>&quot;OR.PA&quot;</td><td>&quot;Consumer Defensive&quot;</td><td>&quot;Consumer Defensive&quot;</td></tr><tr><td>&quot;SAP.DE&quot;</td><td>&quot;Technology&quot;</td><td>&quot;Technology&quot;</td></tr></tbody></table></div>


## Polars Enum

This cell demonstrates:
- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **Sort**: Reorder rows by column values.
- **Enum**: Categorical with fixed, ordered values. Sorting respects the defined order.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.


```python
risk=pl.Enum(["LOW","MEDIUM","HIGH","CRITICAL"])
df=pl.DataFrame({"alert":["HIGH","LOW","MEDIUM"]}).with_columns(pl.col("alert").cast(risk).alias("risk_enum"))
display(df.sort("risk_enum"))
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (3, 2)</small><table border="1" class="dataframe"><thead><tr><th>alert</th><th>risk_enum</th></tr><tr><td>str</td><td>enum</td></tr></thead><tbody><tr><td>&quot;LOW&quot;</td><td>&quot;LOW&quot;</td></tr><tr><td>&quot;MEDIUM&quot;</td><td>&quot;MEDIUM&quot;</td></tr><tr><td>&quot;HIGH&quot;</td><td>&quot;HIGH&quot;</td></tr></tbody></table></div>


## List Type (Polars)

This cell demonstrates:
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


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (2, 4)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>tags</th><th>count</th><th>first</th></tr><tr><td>str</td><td>list[str]</td><td>u32</td><td>str</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>[&quot;tech&quot;, &quot;nl&quot;]</td><td>2</td><td>&quot;tech&quot;</td></tr><tr><td>&quot;MC.PA&quot;</td><td>[&quot;luxury&quot;, &quot;fr&quot;]</td><td>2</td><td>&quot;luxury&quot;</td></tr></tbody></table></div>


## Struct Type (Polars)

This cell demonstrates:
- **Unnest**: Flatten a Struct column into separate columns.


```python
df=pl.DataFrame({"symbol":["ASML.AS"],"scores":[{"momentum":0.8,"value":0.5}]})
display(df.unnest("scores"))
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (1, 3)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>momentum</th><th>value</th></tr><tr><td>str</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>0.8</td><td>0.5</td></tr></tbody></table></div>


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

This cell demonstrates:
- **To Pandas**: Convert Polars DataFrame to Pandas. May copy data.
- **Head**: Return the first N rows.


```python
pdf=ohlcv_pl.head(5).to_pandas()
print(f"Type: {type(pdf)}")
display(pdf)
```

    Type: <class 'pandas.core.frame.DataFrame'>
    


<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
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
</div>


## Pandas to Polars

This cell demonstrates:
- **From Pandas**: Convert Pandas DataFrame to Polars.


```python
plf=pl.from_pandas(pdf)
print(f"Type: {type(plf)}")
display(plf)
```

    Type: <class 'polars.dataframe.frame.DataFrame'>
    


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 12)</small><table border="1" class="dataframe"><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>datetime[ms]</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>&quot;ABI.BR&quot;</td><td>2021-01-04 00:00:00</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>&quot;ABI.BR&quot;</td><td>2021-01-05 00:00:00</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>&quot;ABI.BR&quot;</td><td>2021-01-06 00:00:00</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>&quot;ABI.BR&quot;</td><td>2021-01-07 00:00:00</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>&quot;ABI.BR&quot;</td><td>2021-01-08 00:00:00</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>


## Polars to NumPy

This cell demonstrates:
- **To NumPy**: Extract column as NumPy array.
- **Head**: Return the first N rows.


```python
arr=ohlcv_pl["close"].head(5).to_numpy()
print(f"Type: {type(arr)}, dtype: {arr.dtype}, values: {arr}")
```

    Type: <class 'numpy.ndarray'>, dtype: float64, values: [57.21 57.18 58.77 58.4  57.86]
    

## Polars to Arrow

This cell demonstrates:
- **To Arrow**: Convert to Apache Arrow table. Zero-copy (Polars uses Arrow internally).
- **Head**: Return the first N rows.


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


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 12)</small><table border="1" class="dataframe"><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>


## Polars to Dict

This cell demonstrates:
- **Select**: Choose specific columns, optionally transforming them.
- **Head**: Return the first N rows.


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

This cell demonstrates:
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
