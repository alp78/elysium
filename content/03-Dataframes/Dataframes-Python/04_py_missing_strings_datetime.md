---
type: reference
category: programming-languages
technology:
  - python
  - pandas
  - polars
tags: [pipeline, python, pandas, polars]
aliases:
  - null handling, string methods, datetime parsing, timezones
keywords: [NaN, fillna, fill_null, dropna, str accessor, dt accessor, timezone, timedelta]
description: "Pandas/Polars DataFrame reference 04/10 — Missing Data, Strings & DateTime (nulls, .str, .dt, timezones). Side-by-side executable examples with cell outputs."
related:
  - "[[dataframes-index]]"
  - "[[04_cs_missing_strings_datetime]]"
  - "[[programming-languages-index]]"
  - "[[03_py_transforms_expressions]]"
  - "[[05_py_aggregation_reshaping]]"
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# 04 — Missing Data, Strings & DateTime

Handle nulls, manipulate strings, time series.

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
```

    OHLCV: (66355, 12), Dim: (169, 26), Scores: (466, 36)

```python
# Additional datasets
usa_pd = pd.read_parquet(DATA / "stoxxusa50_ohlcv.parquet")
usa_pl = pl.read_parquet(DATA / "stoxxusa50_ohlcv.parquet")
signals_pd = pd.read_parquet(DATA / "signals_daily.parquet")
signals_pl = pl.read_parquet(DATA / "signals_daily.parquet")
cal_pd = pd.read_parquet(DATA / "trading_calendar.parquet")
cal_pl = pl.read_parquet(DATA / "trading_calendar.parquet")
perf_pd = pd.read_parquet(DATA / "index_performance.parquet")
perf_pl = pl.read_parquet(DATA / "index_performance.parquet")
```

## Null Representations

- Pandas: NaN (float), None (object), pd.NA (nullable)
- Polars: null (universal, all dtypes)

```python
# Pandas
pd_s = pd.Series([1.0, None, 3.0, np.nan, 5.0])
print(f"Pandas: {pd_s.tolist()}, dtype: {pd_s.dtype}")
```

    Pandas: [1.0, nan, 3.0, nan, 5.0], dtype: float64

```python
# Polars
pl_s = pl.Series([1.0, None, 3.0, None, 5.0])
print(f"Polars: {pl_s.to_list()}, dtype: {pl_s.dtype}")
```

    Polars: [1.0, None, 3.0, None, 5.0], dtype: Float64

## Detection


- **Sort**: Reorder rows by column values (Pandas).
- **Null Detection**: Check which values are missing (Pandas).
- **Head**: Return the first N rows.

```python
# Pandas: count nulls per column
print("=== Pandas nulls ===")
display(signals_pd.isna().sum().sort_values(ascending=False).to_frame("null_count").head(10))
```

    === Pandas nulls ===

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>null_count</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>ev_to_ebitda</th>
      <td>71</td>
    </tr>
    <tr>
      <th>dividend_yield</th>
      <td>35</td>
    </tr>
    <tr>
      <th>recommendation_mean</th>
      <td>14</td>
    </tr>
    <tr>
      <th>beta</th>
      <td>8</td>
    </tr>
    <tr>
      <th>symbol</th>
      <td>0</td>
    </tr>
    <tr>
      <th>id</th>
      <td>0</td>
    </tr>
    <tr>
      <th>_index</th>
      <td>0</td>
    </tr>
    <tr>
      <th>price_to_book</th>
      <td>0</td>
    </tr>
    <tr>
      <th>forward_pe</th>
      <td>0</td>
    </tr>
    <tr>
      <th>current_price</th>
      <td>0</td>
    </tr>
  </tbody>
</table>

```python
# Polars: null_count
print("=== Polars nulls ===")
display(signals_pl.null_count())
```

    === Polars nulls ===

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (1, 19)</small><table border="1" class="dataframe"><thead><tr><th>id</th><th>_index</th><th>symbol</th><th>signal_date</th><th>current_price</th><th>forward_pe</th><th>price_to_book</th><th>ev_to_ebitda</th><th>dividend_yield</th><th>market_cap</th><th>beta</th><th>fifty_two_week_change</th><th>sandp_52_week_change</th><th>fifty_day_average</th><th>two_hundred_day_average</th><th>dist_from_52_week_high</th><th>target_median_price</th><th>recommendation_mean</th><th>upside_potential</th></tr><tr><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td></tr></thead><tbody><tr><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>71</td><td>35</td><td>0</td><td>8</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>14</td><td>0</td></tr></tbody></table></div>

```python
# Polars: rows with nulls
signals_pl.filter(pl.col("forward_pe").is_null()).select("symbol", "signal_date", "forward_pe").head(5)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (0, 3)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>signal_date</th><th>forward_pe</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody></tbody></table></div>

## Dropping Nulls


- **Drop Nulls**: Remove rows with missing values (Pandas).

```python
# Pandas
print(f"Before: {len(signals_pd)}")
cleaned_pd = signals_pd.dropna(subset=["forward_pe", "price_to_book"])
print(f"After: {len(cleaned_pd)}")
```

    Before: 466
    After: 466

```python
# Polars
print(f"Before: {signals_pl.height}")
cleaned_pl = signals_pl.drop_nulls(subset=["forward_pe", "price_to_book"])
print(f"After: {cleaned_pl.height}")
```

    Before: 466
    After: 466

## Filling Nulls


- **Fill Nulls**: Replace missing values (Pandas).
- **Head**: Return the first N rows.

```python
# Pandas
display(signals_pd[["symbol", "forward_pe"]].fillna({"forward_pe": 0.0}).head(5))
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>symbol</th>
      <th>forward_pe</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>32.141113</td>
    </tr>
    <tr>
      <th>1</th>
      <td>MC.PA</td>
      <td>18.854280</td>
    </tr>
    <tr>
      <th>2</th>
      <td>RMS.PA</td>
      <td>36.034904</td>
    </tr>
    <tr>
      <th>3</th>
      <td>OR.PA</td>
      <td>25.504032</td>
    </tr>
    <tr>
      <th>4</th>
      <td>SAP.DE</td>
      <td>19.631992</td>
    </tr>
  </tbody>
</table>

```python
# Polars
display(signals_pl.select("symbol", pl.col("forward_pe").fill_null(0.0)).head(5))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 2)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>forward_pe</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>32.141113</td></tr><tr><td>&quot;MC.PA&quot;</td><td>18.85428</td></tr><tr><td>&quot;RMS.PA&quot;</td><td>36.034904</td></tr><tr><td>&quot;OR.PA&quot;</td><td>25.504032</td></tr><tr><td>&quot;SAP.DE&quot;</td><td>19.631992</td></tr></tbody></table></div>

### Forward / Backward Fill


- **Sort**: Reorder rows by column values (Pandas).
- **Forward Fill**: Fill missing values with the last known value.
- **Tail**: Return the last N rows.

```python
# Pandas
asml_pd = ohlcv_pd[ohlcv_pd["symbol"] == "ASML.AS"].sort_values("date")[["date", "close", "dividends"]].tail(10)
display(asml_pd.ffill())
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>date</th>
      <th>close</th>
      <th>dividends</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>11955</th>
      <td>2026-02-27</td>
      <td>1233.4</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>11956</th>
      <td>2026-03-02</td>
      <td>1210.4</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>11957</th>
      <td>2026-03-03</td>
      <td>1161.8</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>11958</th>
      <td>2026-03-04</td>
      <td>1199.8</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>11959</th>
      <td>2026-03-05</td>
      <td>1186.0</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>11960</th>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>11961</th>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>11962</th>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>11963</th>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>11964</th>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>0.0</td>
    </tr>
  </tbody>
</table>

```python
# Polars
asml_pl = ohlcv_pl.filter(pl.col("symbol") == "ASML.AS").sort("date").tail(10)
display(asml_pl.select(
    "date", "close", "dividends",
    pl.col("dividends").fill_null(strategy="forward").alias("div_ffill"),
    pl.col("dividends").fill_null(strategy="backward").alias("div_bfill"),
))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 5)</small><table border="1" class="dataframe"><thead><tr><th>date</th><th>close</th><th>dividends</th><th>div_ffill</th><th>div_bfill</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>0.0</td><td>0.0</td><td>0.0</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>0.0</td><td>0.0</td><td>0.0</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>0.0</td><td>0.0</td><td>0.0</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>0.0</td><td>0.0</td><td>0.0</td></tr><tr><td>2026-03-05</td><td>1186.0</td><td>0.0</td><td>0.0</td><td>0.0</td></tr><tr><td>2026-03-06</td><td>1147.0</td><td>0.0</td><td>0.0</td><td>0.0</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>0.0</td><td>0.0</td><td>0.0</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>0.0</td><td>0.0</td><td>0.0</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>0.0</td><td>0.0</td><td>0.0</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>0.0</td><td>0.0</td><td>0.0</td></tr></tbody></table></div>

### Mean / Median Imputation


- **Fill Nulls**: Replace missing values (Pandas).
- **Assign**: Add columns via method chaining (Pandas). Returns new DataFrame.
- **Head**: Return the first N rows.

```python
# Pandas
mean_pe = signals_pd["forward_pe"].mean()
print(f"Mean PE: {mean_pe:.2f}")
display(signals_pd[["symbol", "forward_pe"]].assign(pe_filled=signals_pd["forward_pe"].fillna(mean_pe)).head(5))
```

    Mean PE: 27.55

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>symbol</th>
      <th>forward_pe</th>
      <th>pe_filled</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>32.141113</td>
      <td>32.141113</td>
    </tr>
    <tr>
      <th>1</th>
      <td>MC.PA</td>
      <td>18.854280</td>
      <td>18.854280</td>
    </tr>
    <tr>
      <th>2</th>
      <td>RMS.PA</td>
      <td>36.034904</td>
      <td>36.034904</td>
    </tr>
    <tr>
      <th>3</th>
      <td>OR.PA</td>
      <td>25.504032</td>
      <td>25.504032</td>
    </tr>
    <tr>
      <th>4</th>
      <td>SAP.DE</td>
      <td>19.631992</td>
      <td>19.631992</td>
    </tr>
  </tbody>
</table>

```python
# Polars
display(signals_pl.select(
    "symbol", "forward_pe",
    pl.col("forward_pe").fill_null(pl.col("forward_pe").mean()).alias("pe_mean_filled"),
    pl.col("forward_pe").fill_null(pl.col("forward_pe").median()).alias("pe_median_filled"),
).head(5))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 4)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>forward_pe</th><th>pe_mean_filled</th><th>pe_median_filled</th></tr><tr><td>str</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>32.141113</td><td>32.141113</td><td>32.141113</td></tr><tr><td>&quot;MC.PA&quot;</td><td>18.85428</td><td>18.85428</td><td>18.85428</td></tr><tr><td>&quot;RMS.PA&quot;</td><td>36.034904</td><td>36.034904</td><td>36.034904</td></tr><tr><td>&quot;OR.PA&quot;</td><td>25.504032</td><td>25.504032</td><td>25.504032</td></tr><tr><td>&quot;SAP.DE&quot;</td><td>19.631992</td><td>19.631992</td><td>19.631992</td></tr></tbody></table></div>

### fill_nan vs fill_null (Polars)


- **Fill Nulls**: Replace missing values (Polars).
- **Fill NaN**: Replace NaN (not null) values. Polars distinguishes NaN from null.

```python
s = pl.Series([1.0, float("nan"), None, 4.0])
print(f"Original: {s.to_list()}")
print(f"fill_null(0): {s.fill_null(0).to_list()}")
print(f"fill_nan(0):  {s.fill_nan(0).to_list()}")
print(f"Both:         {s.fill_nan(0).fill_null(0).to_list()}")
```

    Original: [1.0, nan, None, 4.0]
    fill_null(0): [1.0, nan, 0.0, 4.0]
    fill_nan(0):  [1.0, 0.0, None, 4.0]
    Both:         [1.0, 0.0, 0.0, 4.0]

### Coalesce (Polars)


- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **Coalesce**: Return first non-null value from multiple columns.
- **Alias**: Give an expression result a column name (Polars).

```python
df = pl.DataFrame({"primary": [100.0, None, 300.0, None], "secondary": [None, 200.0, None, 400.0], "fallback": [50.0, 50.0, 50.0, 50.0]})
display(df.with_columns(pl.coalesce("primary", "secondary", "fallback").alias("best")))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (4, 4)</small><table border="1" class="dataframe"><thead><tr><th>primary</th><th>secondary</th><th>fallback</th><th>best</th></tr><tr><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>100.0</td><td>null</td><td>50.0</td><td>100.0</td></tr><tr><td>null</td><td>200.0</td><td>50.0</td><td>200.0</td></tr><tr><td>300.0</td><td>null</td><td>50.0</td><td>300.0</td></tr><tr><td>null</td><td>400.0</td><td>50.0</td><td>400.0</td></tr></tbody></table></div>

### Interpolation


- **Sort**: Reorder rows by column values (Pandas).
- **Interpolate**: Estimate missing values by linear interpolation.
- **Assign**: Add columns via method chaining (Pandas). Returns new DataFrame.
- **Head**: Return the first N rows.

```python
# Pandas
asml_pd2 = ohlcv_pd[ohlcv_pd["symbol"] == "ASML.AS"].sort_values("date").tail(20).copy()
asml_pd2.iloc[5:8, asml_pd2.columns.get_loc("close")] = np.nan # type: ignore
display(asml_pd2[["date", "close"]].assign(interpolated=asml_pd2["close"].interpolate()).head(10))
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>date</th>
      <th>close</th>
      <th>interpolated</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>11945</th>
      <td>2026-02-13</td>
      <td>1190.4</td>
      <td>1190.40</td>
    </tr>
    <tr>
      <th>11946</th>
      <td>2026-02-16</td>
      <td>1195.0</td>
      <td>1195.00</td>
    </tr>
    <tr>
      <th>11947</th>
      <td>2026-02-17</td>
      <td>1199.2</td>
      <td>1199.20</td>
    </tr>
    <tr>
      <th>11948</th>
      <td>2026-02-18</td>
      <td>1244.8</td>
      <td>1244.80</td>
    </tr>
    <tr>
      <th>11949</th>
      <td>2026-02-19</td>
      <td>1238.2</td>
      <td>1238.20</td>
    </tr>
    <tr>
      <th>11950</th>
      <td>2026-02-20</td>
      <td>NaN</td>
      <td>1250.75</td>
    </tr>
    <tr>
      <th>11951</th>
      <td>2026-02-23</td>
      <td>NaN</td>
      <td>1263.30</td>
    </tr>
    <tr>
      <th>11952</th>
      <td>2026-02-24</td>
      <td>NaN</td>
      <td>1275.85</td>
    </tr>
    <tr>
      <th>11953</th>
      <td>2026-02-25</td>
      <td>1288.4</td>
      <td>1288.40</td>
    </tr>
    <tr>
      <th>11954</th>
      <td>2026-02-26</td>
      <td>1232.4</td>
      <td>1232.40</td>
    </tr>
  </tbody>
</table>

```python
# Polars
asml_pl2 = ohlcv_pl.filter(pl.col("symbol") == "ASML.AS").sort("date").tail(20)
vals = asml_pl2["close"].to_list()
for i in range(5, 8): vals[i] = None
asml_null = asml_pl2.with_columns(pl.Series("close", vals))
display(asml_null.select("date", "close", pl.col("close").interpolate().alias("interpolated")).head(10))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 3)</small><table border="1" class="dataframe"><thead><tr><th>date</th><th>close</th><th>interpolated</th></tr><tr><td>date</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-02-13</td><td>1190.4</td><td>1190.4</td></tr><tr><td>2026-02-16</td><td>1195.0</td><td>1195.0</td></tr><tr><td>2026-02-17</td><td>1199.2</td><td>1199.2</td></tr><tr><td>2026-02-18</td><td>1244.8</td><td>1244.8</td></tr><tr><td>2026-02-19</td><td>1238.2</td><td>1238.2</td></tr><tr><td>2026-02-20</td><td>null</td><td>1250.75</td></tr><tr><td>2026-02-23</td><td>null</td><td>1263.3</td></tr><tr><td>2026-02-24</td><td>null</td><td>1275.85</td></tr><tr><td>2026-02-25</td><td>1288.4</td><td>1288.4</td></tr><tr><td>2026-02-26</td><td>1232.4</td><td>1232.4</td></tr></tbody></table></div>

## Summary

| Operation | Pandas | Polars |
|---|---|---|
| Detect | isna() | is_null() |
| Count | isna().sum() | null_count() |
| Drop | dropna() | drop_nulls() |
| Fill literal | fillna(val) | fill_null(val) |
| Fill forward | ffill() | fill_null(strategy="forward") |
| Fill mean | fillna(col.mean()) | fill_null(col.mean()) |
| Interpolate | interpolate() | interpolate() |
| NaN vs null | Same thing | Different! fill_nan vs fill_null |
| Coalesce | combine_first() | pl.coalesce() |

---
# Part 2: String Manipulation

```python
dim_pd = pd.read_parquet(DATA / "index_dim.parquet")
dim_pl = pl.read_parquet(DATA / "index_dim.parquet")
```

## Case Operations


- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.
- **Assign**: Add columns via method chaining (Pandas). Returns new DataFrame.
- **Head**: Return the first N rows.

```python
# Pandas
display(dim_pd[["short_name", "sector"]].assign(
    name_upper=dim_pd["short_name"].str.upper(),
    sector_lower=dim_pd["sector"].str.lower(),
).head(5))
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>short_name</th>
      <th>sector</th>
      <th>name_upper</th>
      <th>sector_lower</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML HOLDING</td>
      <td>Technology</td>
      <td>ASML HOLDING</td>
      <td>technology</td>
    </tr>
    <tr>
      <th>1</th>
      <td>LVMH</td>
      <td>Consumer Cyclical</td>
      <td>LVMH</td>
      <td>consumer cyclical</td>
    </tr>
    <tr>
      <th>2</th>
      <td>HERMES INTL</td>
      <td>Consumer Cyclical</td>
      <td>HERMES INTL</td>
      <td>consumer cyclical</td>
    </tr>
    <tr>
      <th>3</th>
      <td>L'OREAL</td>
      <td>Consumer Defensive</td>
      <td>L'OREAL</td>
      <td>consumer defensive</td>
    </tr>
    <tr>
      <th>4</th>
      <td>SAP SE</td>
      <td>Technology</td>
      <td>SAP SE</td>
      <td>technology</td>
    </tr>
  </tbody>
</table>

```python
# Polars
display(dim_pl.select(
    "short_name", "sector",
    pl.col("short_name").str.to_uppercase().alias("name_upper"),
    pl.col("sector").str.to_lowercase().alias("sector_lower"),
).head(5))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 4)</small><table border="1" class="dataframe"><thead><tr><th>short_name</th><th>sector</th><th>name_upper</th><th>sector_lower</th></tr><tr><td>str</td><td>str</td><td>str</td><td>str</td></tr></thead><tbody><tr><td>&quot;ASML HOLDING&quot;</td><td>&quot;Technology&quot;</td><td>&quot;ASML HOLDING&quot;</td><td>&quot;technology&quot;</td></tr><tr><td>&quot;LVMH&quot;</td><td>&quot;Consumer Cyclical&quot;</td><td>&quot;LVMH&quot;</td><td>&quot;consumer cyclical&quot;</td></tr><tr><td>&quot;HERMES INTL&quot;</td><td>&quot;Consumer Cyclical&quot;</td><td>&quot;HERMES INTL&quot;</td><td>&quot;consumer cyclical&quot;</td></tr><tr><td>&quot;L&#x27;OREAL&quot;</td><td>&quot;Consumer Defensive&quot;</td><td>&quot;L&#x27;OREAL&quot;</td><td>&quot;consumer defensive&quot;</td></tr><tr><td>&quot;SAP SE&quot;</td><td>&quot;Technology&quot;</td><td>&quot;SAP SE&quot;</td><td>&quot;technology&quot;</td></tr></tbody></table></div>

## Contains / Starts With / Ends With


- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.

```python
# Pandas
display(dim_pd[dim_pd["sector"].str.contains("Tech", na=False)][["symbol", "short_name", "sector"]])
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>symbol</th>
      <th>short_name</th>
      <th>sector</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>ASML HOLDING</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>4</th>
      <td>SAP.DE</td>
      <td>SAP SE</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>31</th>
      <td>IFX.DE</td>
      <td>INFINEON TECHNOLOGIES AG</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>46</th>
      <td>ADYEN.AS</td>
      <td>ADYEN</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>51</th>
      <td>6758.T</td>
      <td>SONY GROUP CORPORATION</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>54</th>
      <td>6861.T</td>
      <td>KEYENCE CORP</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>72</th>
      <td>8035.T</td>
      <td>TOKYO ELECTRON</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>86</th>
      <td>6981.T</td>
      <td>MURATA MANUFACTURING CO</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>96</th>
      <td>6702.T</td>
      <td>FUJITSU</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>98</th>
      <td>1810.HK</td>
      <td>XIAOMI-W</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>99</th>
      <td>NVDA</td>
      <td>NVIDIA Corporation</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>100</th>
      <td>AAPL</td>
      <td>Apple Inc.</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>102</th>
      <td>MSFT</td>
      <td>Microsoft Corporation</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>105</th>
      <td>AVGO</td>
      <td>Broadcom Inc.</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>114</th>
      <td>MU</td>
      <td>Micron Technology, Inc.</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>117</th>
      <td>ORCL</td>
      <td>Oracle Corporation</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>127</th>
      <td>PLTR</td>
      <td>Palantir Technologies Inc.</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>128</th>
      <td>AMD</td>
      <td>Advanced Micro Devices, Inc.</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>129</th>
      <td>CSCO</td>
      <td>Cisco Systems, Inc.</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>131</th>
      <td>AMAT</td>
      <td>Applied Materials, Inc.</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>132</th>
      <td>LRCX</td>
      <td>Lam Research Corporation</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>143</th>
      <td>INTC</td>
      <td>Intel Corporation</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>144</th>
      <td>IBM</td>
      <td>International Business Machines</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>147</th>
      <td>DSY.PA</td>
      <td>DASSAULT SYSTEMES</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>148</th>
      <td>CRM</td>
      <td>Salesforce, Inc.</td>
      <td>Technology</td>
    </tr>
    <tr>
      <th>149</th>
      <td>UBER</td>
      <td>Uber Technologies, Inc.</td>
      <td>Technology</td>
    </tr>
  </tbody>
</table>

```python
# Polars
display(dim_pl.filter(pl.col("sector").str.contains("Tech")).select("symbol", "short_name", "sector"))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (26, 3)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>short_name</th><th>sector</th></tr><tr><td>str</td><td>str</td><td>str</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>&quot;ASML HOLDING&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;SAP.DE&quot;</td><td>&quot;SAP SE&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;IFX.DE&quot;</td><td>&quot;INFINEON TECHNOLOGIES AG&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;ADYEN.AS&quot;</td><td>&quot;ADYEN&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;6758.T&quot;</td><td>&quot;SONY GROUP CORPORATION&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;6861.T&quot;</td><td>&quot;KEYENCE CORP&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;8035.T&quot;</td><td>&quot;TOKYO ELECTRON&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;6981.T&quot;</td><td>&quot;MURATA MANUFACTURING CO&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;6702.T&quot;</td><td>&quot;FUJITSU&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;1810.HK&quot;</td><td>&quot;XIAOMI-W&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;NVDA&quot;</td><td>&quot;NVIDIA Corporation&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;AAPL&quot;</td><td>&quot;Apple Inc.&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;MSFT&quot;</td><td>&quot;Microsoft Corporation&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;AVGO&quot;</td><td>&quot;Broadcom Inc.&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;MU&quot;</td><td>&quot;Micron Technology, Inc.&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;ORCL&quot;</td><td>&quot;Oracle Corporation&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;PLTR&quot;</td><td>&quot;Palantir Technologies Inc.&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;AMD&quot;</td><td>&quot;Advanced Micro Devices, Inc.&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;CSCO&quot;</td><td>&quot;Cisco Systems, Inc.&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;AMAT&quot;</td><td>&quot;Applied Materials, Inc.&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;LRCX&quot;</td><td>&quot;Lam Research Corporation&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;INTC&quot;</td><td>&quot;Intel Corporation&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;IBM&quot;</td><td>&quot;International Business Machine…</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;DSY.PA&quot;</td><td>&quot;DASSAULT SYSTEMES&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;CRM&quot;</td><td>&quot;Salesforce, Inc.&quot;</td><td>&quot;Technology&quot;</td></tr><tr><td>&quot;UBER&quot;</td><td>&quot;Uber Technologies, Inc.&quot;</td><td>&quot;Technology&quot;</td></tr></tbody></table></div>

```python
# Ends with
display(dim_pl.filter(pl.col("symbol").str.ends_with(".AS")).select("symbol", "short_name", "country"))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (6, 3)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>short_name</th><th>country</th></tr><tr><td>str</td><td>str</td><td>str</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>&quot;ASML HOLDING&quot;</td><td>&quot;Netherlands&quot;</td></tr><tr><td>&quot;PRX.AS&quot;</td><td>&quot;PROSUS&quot;</td><td>&quot;Netherlands&quot;</td></tr><tr><td>&quot;INGA.AS&quot;</td><td>&quot;ING GROEP N.V.&quot;</td><td>&quot;Netherlands&quot;</td></tr><tr><td>&quot;AD.AS&quot;</td><td>&quot;KONINKLIJKE AHOLD DELHAIZE N.V…</td><td>&quot;Netherlands&quot;</td></tr><tr><td>&quot;ADYEN.AS&quot;</td><td>&quot;ADYEN&quot;</td><td>&quot;Netherlands&quot;</td></tr><tr><td>&quot;WKL.AS&quot;</td><td>&quot;WOLTERS KLUWER&quot;</td><td>&quot;Netherlands&quot;</td></tr></tbody></table></div>

## Extract and Split


- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.
- **Assign**: Add columns via method chaining (Pandas). Returns new DataFrame.
- **Head**: Return the first N rows.

```python
# Pandas
display(dim_pd[["symbol"]].assign(
    exchange_code=dim_pd["symbol"].str.extract(r"\.(.+)$"), # type: ignore
    ticker_only=dim_pd["symbol"].str.split(".").str[0],
).head(10))
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>symbol</th>
      <th>exchange_code</th>
      <th>ticker_only</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>AS</td>
      <td>ASML</td>
    </tr>
    <tr>
      <th>1</th>
      <td>MC.PA</td>
      <td>PA</td>
      <td>MC</td>
    </tr>
    <tr>
      <th>2</th>
      <td>RMS.PA</td>
      <td>PA</td>
      <td>RMS</td>
    </tr>
    <tr>
      <th>3</th>
      <td>OR.PA</td>
      <td>PA</td>
      <td>OR</td>
    </tr>
    <tr>
      <th>4</th>
      <td>SAP.DE</td>
      <td>DE</td>
      <td>SAP</td>
    </tr>
    <tr>
      <th>5</th>
      <td>SIE.DE</td>
      <td>DE</td>
      <td>SIE</td>
    </tr>
    <tr>
      <th>6</th>
      <td>ITX.MC</td>
      <td>MC</td>
      <td>ITX</td>
    </tr>
    <tr>
      <th>7</th>
      <td>DTE.DE</td>
      <td>DE</td>
      <td>DTE</td>
    </tr>
    <tr>
      <th>8</th>
      <td>SAN.MC</td>
      <td>MC</td>
      <td>SAN</td>
    </tr>
    <tr>
      <th>9</th>
      <td>SU.PA</td>
      <td>PA</td>
      <td>SU</td>
    </tr>
  </tbody>
</table>

```python
# Polars
display(dim_pl.select(
    "symbol",
    pl.col("symbol").str.extract(r"\.(.+)$", 1).alias("exchange_code"),
    pl.col("symbol").str.split(".").list.first().alias("ticker_only"),
).head(10))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 3)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>exchange_code</th><th>ticker_only</th></tr><tr><td>str</td><td>str</td><td>str</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>&quot;AS&quot;</td><td>&quot;ASML&quot;</td></tr><tr><td>&quot;MC.PA&quot;</td><td>&quot;PA&quot;</td><td>&quot;MC&quot;</td></tr><tr><td>&quot;RMS.PA&quot;</td><td>&quot;PA&quot;</td><td>&quot;RMS&quot;</td></tr><tr><td>&quot;OR.PA&quot;</td><td>&quot;PA&quot;</td><td>&quot;OR&quot;</td></tr><tr><td>&quot;SAP.DE&quot;</td><td>&quot;DE&quot;</td><td>&quot;SAP&quot;</td></tr><tr><td>&quot;SIE.DE&quot;</td><td>&quot;DE&quot;</td><td>&quot;SIE&quot;</td></tr><tr><td>&quot;ITX.MC&quot;</td><td>&quot;MC&quot;</td><td>&quot;ITX&quot;</td></tr><tr><td>&quot;DTE.DE&quot;</td><td>&quot;DE&quot;</td><td>&quot;DTE&quot;</td></tr><tr><td>&quot;SAN.MC&quot;</td><td>&quot;MC&quot;</td><td>&quot;SAN&quot;</td></tr><tr><td>&quot;SU.PA&quot;</td><td>&quot;PA&quot;</td><td>&quot;SU&quot;</td></tr></tbody></table></div>

## Replace


- **Select**: Choose specific columns, optionally transforming them.
- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **Head**: Return the first N rows.

```python
# Polars: remove exchange suffix
display(dim_pl.select(
    "symbol",
    pl.col("symbol").str.replace(r"\..*$", "").alias("clean"),
).head(5))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 2)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>clean</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>&quot;ASML&quot;</td></tr><tr><td>&quot;MC.PA&quot;</td><td>&quot;MC&quot;</td></tr><tr><td>&quot;RMS.PA&quot;</td><td>&quot;RMS&quot;</td></tr><tr><td>&quot;OR.PA&quot;</td><td>&quot;OR&quot;</td></tr><tr><td>&quot;SAP.DE&quot;</td><td>&quot;SAP&quot;</td></tr></tbody></table></div>

## String Length and Slicing


- **Select**: Choose specific columns, optionally transforming them.
- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **Head**: Return the first N rows.

```python
dim_pl.select(
    "short_name",
    pl.col("short_name").str.len_chars().alias("length"),
    pl.col("short_name").str.slice(0, 5).alias("first_5"),
).head(10)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 3)</small><table border="1" class="dataframe"><thead><tr><th>short_name</th><th>length</th><th>first_5</th></tr><tr><td>str</td><td>u32</td><td>str</td></tr></thead><tbody><tr><td>&quot;ASML HOLDING&quot;</td><td>12</td><td>&quot;ASML &quot;</td></tr><tr><td>&quot;LVMH&quot;</td><td>4</td><td>&quot;LVMH&quot;</td></tr><tr><td>&quot;HERMES INTL&quot;</td><td>11</td><td>&quot;HERME&quot;</td></tr><tr><td>&quot;L&#x27;OREAL&quot;</td><td>7</td><td>&quot;L&#x27;ORE&quot;</td></tr><tr><td>&quot;SAP SE&quot;</td><td>6</td><td>&quot;SAP S&quot;</td></tr><tr><td>&quot;SIEMENS AG&quot;</td><td>10</td><td>&quot;SIEME&quot;</td></tr><tr><td>&quot;INDUSTRIA DE DISE...O TEXTIL S…</td><td>31</td><td>&quot;INDUS&quot;</td></tr><tr><td>&quot;DEUTSCHE TELEKOM AG&quot;</td><td>19</td><td>&quot;DEUTS&quot;</td></tr><tr><td>&quot;BANCO SANTANDER S.A.&quot;</td><td>20</td><td>&quot;BANCO&quot;</td></tr><tr><td>&quot;SCHNEIDER ELECTRIC SE&quot;</td><td>21</td><td>&quot;SCHNE&quot;</td></tr></tbody></table></div>

## Concatenating Strings


- **Assign**: Add columns via method chaining (Pandas). Returns new DataFrame.
- **Head**: Return the first N rows.

```python
# Pandas: + operator
display(dim_pd[["short_name", "country"]].assign(
    display_name=(dim_pd["short_name"] + " (" + dim_pd["country"] + ")"),
).head(5))
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>short_name</th>
      <th>country</th>
      <th>display_name</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML HOLDING</td>
      <td>Netherlands</td>
      <td>ASML HOLDING (Netherlands)</td>
    </tr>
    <tr>
      <th>1</th>
      <td>LVMH</td>
      <td>France</td>
      <td>LVMH (France)</td>
    </tr>
    <tr>
      <th>2</th>
      <td>HERMES INTL</td>
      <td>France</td>
      <td>HERMES INTL (France)</td>
    </tr>
    <tr>
      <th>3</th>
      <td>L'OREAL</td>
      <td>France</td>
      <td>L'OREAL (France)</td>
    </tr>
    <tr>
      <th>4</th>
      <td>SAP SE</td>
      <td>Germany</td>
      <td>SAP SE (Germany)</td>
    </tr>
  </tbody>
</table>

```python
# Polars: pl.concat_str
display(dim_pl.select(
    pl.concat_str("short_name", pl.lit(" ("), "country", pl.lit(")")).alias("display_name"),
).head(5))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 1)</small><table border="1" class="dataframe"><thead><tr><th>display_name</th></tr><tr><td>str</td></tr></thead><tbody><tr><td>&quot;ASML HOLDING (Netherlands)&quot;</td></tr><tr><td>&quot;LVMH (France)&quot;</td></tr><tr><td>&quot;HERMES INTL (France)&quot;</td></tr><tr><td>&quot;L&#x27;OREAL (France)&quot;</td></tr><tr><td>&quot;SAP SE (Germany)&quot;</td></tr></tbody></table></div>

## Stripping and Padding


- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **Alias**: Give an expression result a column name (Polars).

```python
df = pl.DataFrame({"name": ["  ASML  ", "  SAP ", " MC"]})
display(df.with_columns(
    pl.col("name").str.strip_chars().alias("stripped"),
))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (3, 2)</small><table border="1" class="dataframe"><thead><tr><th>name</th><th>stripped</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>&quot;&nbsp;&nbsp;ASML&nbsp;&nbsp;&quot;</td><td>&quot;ASML&quot;</td></tr><tr><td>&quot;&nbsp;&nbsp;SAP &quot;</td><td>&quot;SAP&quot;</td></tr><tr><td>&quot; MC&quot;</td><td>&quot;MC&quot;</td></tr></tbody></table></div>

```python
df = pl.DataFrame({"code": ["A", "AB", "ABC", "ABCD"]})
display(df.with_columns(
    pl.col("code").str.pad_start(6, "0").alias("padded"),
))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (4, 2)</small><table border="1" class="dataframe"><thead><tr><th>code</th><th>padded</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>&quot;A&quot;</td><td>&quot;00000A&quot;</td></tr><tr><td>&quot;AB&quot;</td><td>&quot;0000AB&quot;</td></tr><tr><td>&quot;ABC&quot;</td><td>&quot;000ABC&quot;</td></tr><tr><td>&quot;ABCD&quot;</td><td>&quot;00ABCD&quot;</td></tr></tbody></table></div>

## Regex: Extract All


- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **Alias**: Give an expression result a column name (Polars).

```python
df = pl.DataFrame({"text": ["ASML closed at 900.5 up from 895.2", "No numbers", "PE: 45.3, PB: 12.1"]})
display(df.with_columns(
    pl.col("text").str.extract_all(r"[0-9]+\.?[0-9]*").alias("numbers"),
    pl.col("text").str.count_matches(r"[0-9]+").alias("count"),
))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (3, 3)</small><table border="1" class="dataframe"><thead><tr><th>text</th><th>numbers</th><th>count</th></tr><tr><td>str</td><td>list[str]</td><td>u32</td></tr></thead><tbody><tr><td>&quot;ASML closed at 900.5 up from 8…</td><td>[&quot;900.5&quot;, &quot;895.2&quot;]</td><td>4</td></tr><tr><td>&quot;No numbers&quot;</td><td>[]</td><td>0</td></tr><tr><td>&quot;PE: 45.3, PB: 12.1&quot;</td><td>[&quot;45.3&quot;, &quot;12.1&quot;]</td><td>4</td></tr></tbody></table></div>

## Summary

| Operation | Pandas .str | Polars .str |
|---|---|---|
| Uppercase | .str.upper() | .str.to_uppercase() |
| Lowercase | .str.lower() | .str.to_lowercase() |
| Contains | .str.contains() | .str.contains() |
| Starts with | .str.startswith() | .str.starts_with() |
| Extract | .str.extract(re) | .str.extract(re, group) |
| Split | .str.split().str[n] | .str.split().list.get(n) |
| Replace | .str.replace() | .str.replace() |
| Length | .str.len() | .str.len_chars() |
| Concat | + operator | pl.concat_str() |
| Strip | .str.strip() | .str.strip_chars() |

---
# Part 3: DateTime & Time Series

## Date/Time Types

> [!info]- Pandas types
> Pandas types
> print("Pandas date dtype:", ohlcv_pd["date"].dtype)
> Pandas Timestamp:", pd.Timestamp("2026-03-15
> print("Pandas Timedelta:", pd.Timedelta(days=5))
>

    Pandas date dtype: object
    Pandas Timestamp: 2026-03-15 00:00:00
    Pandas Timedelta: 5 days 00:00:00

> [!info]- Polars types
> Polars types
> print("Polars date dtype:", ohlcv_pl["date"].dtype)
> print("Polars Date:", pl.Series(["2026-03-15"]).str.to_date())
> print("Polars Duration:", pl.duration(days=5))
>

    Polars date dtype: Date
    Polars Date: shape: (1,)
    Series: '' [date]
    [
    	2026-03-15
    ]
    Polars Duration: 5d.alias("duration")

## Parsing Dates


- **Parse Dates**: Convert strings to datetime objects (Pandas).

```python
# Pandas: pd.to_datetime
date_strs = pd.Series(["2026-03-15", "15/03/2026", "March 15, 2026"])
print(pd.to_datetime(date_strs, format="mixed"))
```

    0   2026-03-15
    1   2026-03-15
    2   2026-03-15
    dtype: datetime64[ns]

```python
# Polars: str.to_date
date_strs_pl = pl.Series(["2026-03-15", "2026-03-16", "2026-03-17"])
display(date_strs_pl.str.to_date("%Y-%m-%d"))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (3,)</small><table border="1" class="dataframe"><thead><tr><th></th></tr><tr><td>date</td></tr></thead><tbody><tr><td>2026-03-15</td></tr><tr><td>2026-03-16</td></tr><tr><td>2026-03-17</td></tr></tbody></table></div>

## .dt Accessor


- **DateTime Accessor**: Extract date parts: .dt.year(), .dt.month(), .dt.weekday().
- **Assign**: Add columns via method chaining (Pandas). Returns new DataFrame.
- **Parse Dates**: Convert strings to datetime objects (Pandas).
- **Head**: Return the first N rows.

```python
# Pandas
asml_pd = ohlcv_pd[ohlcv_pd["symbol"] == "ASML.AS"].copy()
asml_pd["date"] = pd.to_datetime(asml_pd["date"])
display(asml_pd.assign(
    year=asml_pd["date"].dt.year,
    month=asml_pd["date"].dt.month,
    weekday=asml_pd["date"].dt.day_name(),
)[["date", "year", "month", "weekday"]].head(5))
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>date</th>
      <th>year</th>
      <th>month</th>
      <th>weekday</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>10634</th>
      <td>2021-01-04</td>
      <td>2021</td>
      <td>1</td>
      <td>Monday</td>
    </tr>
    <tr>
      <th>10635</th>
      <td>2021-01-05</td>
      <td>2021</td>
      <td>1</td>
      <td>Tuesday</td>
    </tr>
    <tr>
      <th>10636</th>
      <td>2021-01-06</td>
      <td>2021</td>
      <td>1</td>
      <td>Wednesday</td>
    </tr>
    <tr>
      <th>10637</th>
      <td>2021-01-07</td>
      <td>2021</td>
      <td>1</td>
      <td>Thursday</td>
    </tr>
    <tr>
      <th>10638</th>
      <td>2021-01-08</td>
      <td>2021</td>
      <td>1</td>
      <td>Friday</td>
    </tr>
  </tbody>
</table>

```python
# Polars
asml_pl = ohlcv_pl.filter(pl.col("symbol") == "ASML.AS")
display(asml_pl.select(
    "date",
    pl.col("date").dt.year().alias("year"),
    pl.col("date").dt.month().alias("month"),
    pl.col("date").dt.weekday().alias("weekday"),
).head(5))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 4)</small><table border="1" class="dataframe"><thead><tr><th>date</th><th>year</th><th>month</th><th>weekday</th></tr><tr><td>date</td><td>i32</td><td>i8</td><td>i8</td></tr></thead><tbody><tr><td>2021-01-04</td><td>2021</td><td>1</td><td>1</td></tr><tr><td>2021-01-05</td><td>2021</td><td>1</td><td>2</td></tr><tr><td>2021-01-06</td><td>2021</td><td>1</td><td>3</td></tr><tr><td>2021-01-07</td><td>2021</td><td>1</td><td>4</td></tr><tr><td>2021-01-08</td><td>2021</td><td>1</td><td>5</td></tr></tbody></table></div>

## date_range


- **Date Range**: Generate a sequence of dates between start and end.

```python
# Pandas
dr_pd = pd.date_range("2026-01-01", "2026-01-10", freq="D")
print(f"Pandas: {dr_pd.tolist()[:3]}...")
```

    Pandas: [Timestamp('2026-01-01 00:00:00'), Timestamp('2026-01-02 00:00:00'), Timestamp('2026-01-03 00:00:00')]...

```python
# Polars
dr_pl = pl.date_range(pl.date(2026, 1, 1), pl.date(2026, 1, 10), eager=True)
display(dr_pl)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10,)</small><table border="1" class="dataframe"><thead><tr><th>date</th></tr><tr><td>date</td></tr></thead><tbody><tr><td>2026-01-01</td></tr><tr><td>2026-01-02</td></tr><tr><td>2026-01-03</td></tr><tr><td>2026-01-04</td></tr><tr><td>2026-01-05</td></tr><tr><td>2026-01-06</td></tr><tr><td>2026-01-07</td></tr><tr><td>2026-01-08</td></tr><tr><td>2026-01-09</td></tr><tr><td>2026-01-10</td></tr></tbody></table></div>

## Rolling Windows


- **Rolling Window**: Compute statistics over a sliding window of N consecutive rows.
- **Sort**: Reorder rows by column values (Pandas).
- **Assign**: Add columns via method chaining (Pandas). Returns new DataFrame.
- **Tail**: Return the last N rows.

```python
# Pandas rolling
asml_pd_sorted = ohlcv_pd[ohlcv_pd["symbol"] == "ASML.AS"].sort_values("date")
display(asml_pd_sorted.assign(
    sma_7=asml_pd_sorted["close"].rolling(7).mean(),
    sma_30=asml_pd_sorted["close"].rolling(30).mean(),
)[["date", "close", "sma_7", "sma_30"]].tail(10))
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>date</th>
      <th>close</th>
      <th>sma_7</th>
      <th>sma_30</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>11955</th>
      <td>2026-02-27</td>
      <td>1233.4</td>
      <td>1251.514286</td>
      <td>1201.400000</td>
    </tr>
    <tr>
      <th>11956</th>
      <td>2026-03-02</td>
      <td>1210.4</td>
      <td>1247.542857</td>
      <td>1204.400000</td>
    </tr>
    <tr>
      <th>11957</th>
      <td>2026-03-03</td>
      <td>1161.8</td>
      <td>1234.142857</td>
      <td>1205.126667</td>
    </tr>
    <tr>
      <th>11958</th>
      <td>2026-03-04</td>
      <td>1199.8</td>
      <td>1227.085714</td>
      <td>1206.626667</td>
    </tr>
    <tr>
      <th>11959</th>
      <td>2026-03-05</td>
      <td>1186.0</td>
      <td>1216.028571</td>
      <td>1206.946667</td>
    </tr>
    <tr>
      <th>11960</th>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>1195.828571</td>
      <td>1205.906667</td>
    </tr>
    <tr>
      <th>11961</th>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>1183.714286</td>
      <td>1204.893333</td>
    </tr>
    <tr>
      <th>11962</th>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>1178.942857</td>
      <td>1204.306667</td>
    </tr>
    <tr>
      <th>11963</th>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>1177.285714</td>
      <td>1204.453333</td>
    </tr>
    <tr>
      <th>11964</th>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>1181.428571</td>
      <td>1204.413333</td>
    </tr>
  </tbody>
</table>

```python
# Polars rolling
asml_pl_sorted = ohlcv_pl.filter(pl.col("symbol") == "ASML.AS").sort("date")
display(asml_pl_sorted.with_columns(
    pl.col("close").rolling_mean(7).alias("sma_7"),
    pl.col("close").rolling_mean(30).alias("sma_30"),
).select("date", "close", "sma_7", "sma_30").tail(10))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 4)</small><table border="1" class="dataframe"><thead><tr><th>date</th><th>close</th><th>sma_7</th><th>sma_30</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>1251.514286</td><td>1201.4</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>1247.542857</td><td>1204.4</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>1234.142857</td><td>1205.126667</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>1227.085714</td><td>1206.626667</td></tr><tr><td>2026-03-05</td><td>1186.0</td><td>1216.028571</td><td>1206.946667</td></tr><tr><td>2026-03-06</td><td>1147.0</td><td>1195.828571</td><td>1205.906667</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1183.714286</td><td>1204.893333</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>1178.942857</td><td>1204.306667</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1177.285714</td><td>1204.453333</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1181.428571</td><td>1204.413333</td></tr></tbody></table></div>

## Shifting / Lagging


- **Shift (Lag/Lead)**: Access the previous row (shift(1)) or next row (shift(-1)) within each group.
- **Assign**: Add columns via method chaining (Pandas). Returns new DataFrame.
- **Tail**: Return the last N rows.

```python
# Pandas shift
display(asml_pd_sorted.assign(
    prev_close=asml_pd_sorted["close"].shift(1),
    daily_return=lambda d: ((d["close"] - d["close"].shift(1)) / d["close"].shift(1) * 100).round(2),
)[["date", "close", "prev_close", "daily_return"]].tail(10))
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>date</th>
      <th>close</th>
      <th>prev_close</th>
      <th>daily_return</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>11955</th>
      <td>2026-02-27</td>
      <td>1233.4</td>
      <td>1232.4</td>
      <td>0.08</td>
    </tr>
    <tr>
      <th>11956</th>
      <td>2026-03-02</td>
      <td>1210.4</td>
      <td>1233.4</td>
      <td>-1.86</td>
    </tr>
    <tr>
      <th>11957</th>
      <td>2026-03-03</td>
      <td>1161.8</td>
      <td>1210.4</td>
      <td>-4.02</td>
    </tr>
    <tr>
      <th>11958</th>
      <td>2026-03-04</td>
      <td>1199.8</td>
      <td>1161.8</td>
      <td>3.27</td>
    </tr>
    <tr>
      <th>11959</th>
      <td>2026-03-05</td>
      <td>1186.0</td>
      <td>1199.8</td>
      <td>-1.15</td>
    </tr>
    <tr>
      <th>11960</th>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>1186.0</td>
      <td>-3.29</td>
    </tr>
    <tr>
      <th>11961</th>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>1147.0</td>
      <td>0.05</td>
    </tr>
    <tr>
      <th>11962</th>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>1147.6</td>
      <td>4.57</td>
    </tr>
    <tr>
      <th>11963</th>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>1200.0</td>
      <td>-0.10</td>
    </tr>
    <tr>
      <th>11964</th>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>1198.8</td>
      <td>-0.67</td>
    </tr>
  </tbody>
</table>

```python
# Polars shift
display(asml_pl_sorted.with_columns(
    pl.col("close").shift(1).alias("prev_close"),
    ((pl.col("close") - pl.col("close").shift(1)) / pl.col("close").shift(1) * 100).round(2).alias("daily_return"),
).select("date", "close", "prev_close", "daily_return").tail(10))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 4)</small><table border="1" class="dataframe"><thead><tr><th>date</th><th>close</th><th>prev_close</th><th>daily_return</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>1232.4</td><td>0.08</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>1233.4</td><td>-1.86</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>1210.4</td><td>-4.02</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>1161.8</td><td>3.27</td></tr><tr><td>2026-03-05</td><td>1186.0</td><td>1199.8</td><td>-1.15</td></tr><tr><td>2026-03-06</td><td>1147.0</td><td>1186.0</td><td>-3.29</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1147.0</td><td>0.05</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>1147.6</td><td>4.57</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1200.0</td><td>-0.1</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1198.8</td><td>-0.67</td></tr></tbody></table></div>

## Resampling


- **Aggregation**: Compute summary statistics (mean, sum, count, min, max) for each group. Returns one row per group.
- **Resample**: Change time frequency: daily to monthly. Groups by time buckets (Pandas).
- **Set Index**: Make a column the DataFrame index (Pandas only). Polars has no index.
- **Parse Dates**: Convert strings to datetime objects (Pandas).

```python
# Monthly OHLC for ASML
asml_monthly = (
    asml_pd_sorted
    .set_index(pd.to_datetime(asml_pd_sorted["date"]))
    .resample("ME")
    .agg({"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"})
    .tail(6)
)
display(asml_monthly)
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>open</th>
      <th>high</th>
      <th>low</th>
      <th>close</th>
      <th>volume</th>
    </tr>
    <tr>
      <th>date</th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>2025-10-31</th>
      <td>818.0</td>
      <td>938.6</td>
      <td>812.1</td>
      <td>918.1</td>
      <td>16383868</td>
    </tr>
    <tr>
      <th>2025-11-30</th>
      <td>917.0</td>
      <td>930.9</td>
      <td>822.2</td>
      <td>903.4</td>
      <td>12064891</td>
    </tr>
    <tr>
      <th>2025-12-31</th>
      <td>910.0</td>
      <td>977.1</td>
      <td>866.4</td>
      <td>921.4</td>
      <td>10360738</td>
    </tr>
    <tr>
      <th>2026-01-31</th>
      <td>919.4</td>
      <td>1309.0</td>
      <td>919.2</td>
      <td>1215.6</td>
      <td>16549130</td>
    </tr>
    <tr>
      <th>2026-02-28</th>
      <td>1178.6</td>
      <td>1312.8</td>
      <td>1117.6</td>
      <td>1233.4</td>
      <td>11528098</td>
    </tr>
    <tr>
      <th>2026-03-31</th>
      <td>1192.8</td>
      <td>1231.4</td>
      <td>1060.2</td>
      <td>1190.8</td>
      <td>6344179</td>
    </tr>
  </tbody>
</table>

### Polars: group_by_dynamic


- **Aggregation**: Compute summary statistics (mean, sum, count, min, max) for each group. Returns one row per group.
- **Dynamic Groupby**: Time-based grouping (Polars). Equivalent to Pandas resample().
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **Tail**: Return the last N rows.

```python
# Monthly OHLC for ASML
display(
    asml_pl_sorted
    .group_by_dynamic("date", every="1mo")
    .agg(
        pl.col("open").first(),
        pl.col("high").max(),
        pl.col("low").min(),
        pl.col("close").last(),
        pl.col("volume").sum(),
    )
    .tail(6)
)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (6, 6)</small><table border="1" class="dataframe"><thead><tr><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>volume</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>2025-10-01</td><td>818.0</td><td>938.6</td><td>812.1</td><td>918.1</td><td>16383868</td></tr><tr><td>2025-11-01</td><td>917.0</td><td>930.9</td><td>822.2</td><td>903.4</td><td>12064891</td></tr><tr><td>2025-12-01</td><td>910.0</td><td>977.1</td><td>866.4</td><td>921.4</td><td>10360738</td></tr><tr><td>2026-01-01</td><td>919.4</td><td>1309.0</td><td>919.2</td><td>1215.6</td><td>16549130</td></tr><tr><td>2026-02-01</td><td>1178.6</td><td>1312.8</td><td>1117.6</td><td>1233.4</td><td>11528098</td></tr><tr><td>2026-03-01</td><td>1192.8</td><td>1231.4</td><td>1060.2</td><td>1190.8</td><td>6344179</td></tr></tbody></table></div>

## Cumulative Operations


- **Cumulative Sum**: Running total from the first row to the current row.
- **Cumulative Max**: Running maximum from the first row to the current row.
- **Select**: Choose specific columns, optionally transforming them.
- **With Columns**: Add new columns or replace existing ones. All original columns are kept.

```python
# Polars cumulative
display(asml_pl_sorted.with_columns(
    pl.col("volume").cum_sum().alias("cum_volume"),
    pl.col("close").cum_max().alias("running_high"),
    pl.col("close").cum_min().alias("running_low"),
).select("date", "close", "volume", "cum_volume", "running_high", "running_low").tail(10))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 6)</small><table border="1" class="dataframe"><thead><tr><th>date</th><th>close</th><th>volume</th><th>cum_volume</th><th>running_high</th><th>running_low</th></tr><tr><td>date</td><td>f64</td><td>i64</td><td>i64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>1010698</td><td>938726541</td><td>1288.4</td><td>397.45</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>871267</td><td>939597808</td><td>1288.4</td><td>397.45</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>941945</td><td>940539753</td><td>1288.4</td><td>397.45</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>714587</td><td>941254340</td><td>1288.4</td><td>397.45</td></tr><tr><td>2026-03-05</td><td>1186.0</td><td>778081</td><td>942032421</td><td>1288.4</td><td>397.45</td></tr><tr><td>2026-03-06</td><td>1147.0</td><td>857271</td><td>942889692</td><td>1288.4</td><td>397.45</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>689086</td><td>943578778</td><td>1288.4</td><td>397.45</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>800815</td><td>944379593</td><td>1288.4</td><td>397.45</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>562904</td><td>944942497</td><td>1288.4</td><td>397.45</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>128223</td><td>945070720</td><td>1288.4</td><td>397.45</td></tr></tbody></table></div>

## Summary

| Operation | Pandas | Polars |
|---|---|---|
| Date type | pd.Timestamp | pl.Date / pl.Datetime |
| Parse | pd.to_datetime() | .str.to_date() |
| .dt accessor | .dt.year | .dt.year() |
| date_range | pd.date_range() | pl.date_range() |
| Rolling | .rolling(n).mean() | .rolling_mean(n) |
| Shift | .shift(n) | .shift(n) |
| Resample | .resample("ME").agg() | .group_by_dynamic("date", every="1mo").agg() |
| Cum sum | .cumsum() | .cum_sum() |
