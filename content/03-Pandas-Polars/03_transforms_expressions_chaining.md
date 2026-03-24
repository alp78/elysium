---
type: reference
category: programming-languages
technology:
  - python
  - pandas
  - polars
tags: [pipeline, python, pandas, polars]
aliases:
  - with_columns, assign, apply, map, when/then, method chaining
keywords: [with_columns, assign, apply, map_elements, when, then, otherwise, pipe, method chaining, expressions]
description: "Pandas vs Polars reference 03/10 — Transforms, Expressions & Chaining (with_columns, when/then, apply). Side-by-side executable examples with cell outputs."
related:
  - "[[pandas-polars-index]]"
  - "[[programming-languages-index]]"
  - "[[02_explore_select_filter]]"
  - "[[04_missing_strings_datetime]]"
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# 03 — Transformations, Expressions & Chaining

Create columns, Polars expressions, method chaining.

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

## Setup & Data Loading

```python
print("ohlcv  :\n", ohlcv_pd.shape, "\n", list(ohlcv_pd.columns))
print("\ndim    :\n", dim_pd.shape, "\n", list(dim_pd.columns))
print("\nscores :\n", scores_pd.shape, "\n", list(scores_pd.columns))
```

    ohlcv  :
     (66355, 12) 
     ['id', 'symbol', 'date', 'open', 'high', 'low', 'close', 'adj_close', 'volume', 'dividends', 'stock_splits', 'is_filled']
    
    dim    :
     (169, 26) 
     ['id', '_index', 'symbol', 'long_name', 'short_name', 'sector', 'sector_key', 'industry', 'industry_key', 'country', 'city', 'website', 'long_business_summary', 'exchange', 'full_exchange_name', 'exchange_timezone_name', 'exchange_timezone_short', 'currency', 'financial_currency', 'quote_type', 'market', 'range_start', 'price_data_start', 'valid_from', 'valid_to', 'is_current']
    
    scores :
     (466, 36) 
     ['id', '_index', 'symbol', 'score_date', 'sector', 'pe_zscore', 'pb_zscore', 'ev_ebitda_zscore', 'yield_zscore', 'relative_value_score', 'relative_value_rank', 'relative_strength', 'sma_50_ratio', 'sma_200_ratio', 'dist_from_52w_high', 'momentum_score', 'momentum_rank', 'implied_upside', 'recommendation_mean', 'price_falling_analysts_bullish', 'sentiment_score', 'sentiment_rank', 'composite_score', 'composite_rank', '_scored_at', 'sma_30_close', 'sma_90_close', 'market_cap', 'index_weight', 'short_name', 'country', 'current_price', 'day_change_pct', 'five_day_change_pct', 'ytd_change_pct', 'currency']

```python
ohlcv_pd.head(3)
```

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
  </tbody>
</table>

```python
ohlcv_pl.head(3)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (3, 12)</small><table border="1" class="dataframe"><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

---
## 1 · Direct Column Assignment (Pandas)

```python
# Simple derived column — Pandas mutates in place
df = ohlcv_pd.copy()
df["range"] = df["high"] - df["low"]
df[["symbol", "date", "high", "low", "range"]].head()
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>high</th>
      <th>low</th>
      <th>range</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ABI.BR</td>
      <td>2021-01-04</td>
      <td>58.85</td>
      <td>56.78</td>
      <td>2.07</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ABI.BR</td>
      <td>2021-01-05</td>
      <td>57.98</td>
      <td>56.75</td>
      <td>1.23</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ABI.BR</td>
      <td>2021-01-06</td>
      <td>58.94</td>
      <td>57.39</td>
      <td>1.55</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ABI.BR</td>
      <td>2021-01-07</td>
      <td>58.86</td>
      <td>57.88</td>
      <td>0.98</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ABI.BR</td>
      <td>2021-01-08</td>
      <td>58.40</td>
      <td>57.43</td>
      <td>0.97</td>
    </tr>
  </tbody>
</table>

```python
# Overwrite an existing column
df = ohlcv_pd.copy()
df["volume"] = df["volume"] / 1_000_000  # express in millions
df[["symbol", "date", "volume"]].head()
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>volume</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ABI.BR</td>
      <td>2021-01-04</td>
      <td>1.513937</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ABI.BR</td>
      <td>2021-01-05</td>
      <td>1.382722</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ABI.BR</td>
      <td>2021-01-06</td>
      <td>1.370204</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ABI.BR</td>
      <td>2021-01-07</td>
      <td>1.469911</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ABI.BR</td>
      <td>2021-01-08</td>
      <td>1.428681</td>
    </tr>
  </tbody>
</table>

---
## 2 · <code style="font-size:0.75em">assign</code> — Chainable Column Creation (Pandas)

```python
(ohlcv_pd
 .assign(
     range=lambda d: d["high"] - d["low"],
     mid=lambda d: (d["high"] + d["low"]) / 2,
     pct_range=lambda d: d["range"] / d["close"] * 100,
 )
 [["symbol", "date", "close", "range", "mid", "pct_range"]]
 .head()
)
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>close</th>
      <th>range</th>
      <th>mid</th>
      <th>pct_range</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ABI.BR</td>
      <td>2021-01-04</td>
      <td>57.21</td>
      <td>2.07</td>
      <td>57.815</td>
      <td>3.618249</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ABI.BR</td>
      <td>2021-01-05</td>
      <td>57.18</td>
      <td>1.23</td>
      <td>57.365</td>
      <td>2.151102</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ABI.BR</td>
      <td>2021-01-06</td>
      <td>58.77</td>
      <td>1.55</td>
      <td>58.165</td>
      <td>2.637400</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ABI.BR</td>
      <td>2021-01-07</td>
      <td>58.40</td>
      <td>0.98</td>
      <td>58.370</td>
      <td>1.678082</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ABI.BR</td>
      <td>2021-01-08</td>
      <td>57.86</td>
      <td>0.97</td>
      <td>57.915</td>
      <td>1.676460</td>
    </tr>
  </tbody>
</table>

---
## 3 · <code style="font-size:0.75em">with_columns</code> (Polars)

```python
ohlcv_pl.with_columns(
    (pl.col("high") - pl.col("low")).alias("range"),
    ((pl.col("high") + pl.col("low")) / 2).alias("mid"),
).select("symbol", "date", "close", "range", "mid").head()
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 5)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th><th>range</th><th>mid</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>2.07</td><td>57.815</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td><td>1.23</td><td>57.365</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td><td>1.55</td><td>58.165</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.4</td><td>0.98</td><td>58.37</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>57.86</td><td>0.97</td><td>57.915</td></tr></tbody></table></div>

```python
# Multiple derived columns in one call
ohlcv_pl.with_columns(
    (pl.col("high") - pl.col("low")).alias("range"),
    ((pl.col("high") + pl.col("low")) / 2).alias("mid"),
    (pl.col("volume") / 1_000_000).alias("vol_m"),
    ((pl.col("close") - pl.col("open")) / pl.col("open") * 100).alias("intraday_ret_pct"),
).head()
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 16)</small><table border="1" class="dataframe"><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th><th>range</th><th>mid</th><th>vol_m</th><th>intraday_ret_pct</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>21160</td><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td><td>2.07</td><td>57.815</td><td>1.513937</td><td>-1.616509</td></tr><tr><td>21161</td><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td><td>1.23</td><td>57.365</td><td>1.382722</td><td>0.492091</td></tr><tr><td>21162</td><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td><td>1.55</td><td>58.165</td><td>1.370204</td><td>1.397516</td></tr><tr><td>21163</td><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td><td>0.98</td><td>58.37</td><td>1.469911</td><td>-0.477164</td></tr><tr><td>21164</td><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td><td>0.97</td><td>57.915</td><td>1.428681</td><td>-0.515818</td></tr></tbody></table></div>

---
## 4 · <code style="font-size:0.75em">select</code> + <code style="font-size:0.75em">alias</code> (Polars)

`select` returns **only** the listed columns — useful when you want a lean result.

```python
ohlcv_pl.select(
    "symbol",
    "date",
    pl.col("close"),
    (pl.col("high") - pl.col("low")).alias("range"),
).head()
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 4)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th><th>range</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>2.07</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td><td>1.23</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td><td>1.55</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.4</td><td>0.98</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>57.86</td><td>0.97</td></tr></tbody></table></div>

---
## 5 · <code style="font-size:0.75em">apply</code> and <code style="font-size:0.75em">map</code> (Pandas)

> **Prefer vectorised operations** whenever possible. `apply` is a Python-level loop and much slower.

```python
# map — element-wise transformation on a Series
ohlcv_pd["symbol"].map(lambda t: t.split(".")[0]).head()
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>symbol</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ABI</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ABI</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ABI</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ABI</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ABI</td>
    </tr>
  </tbody>
</table>

```python
# apply on a DataFrame — row-wise (axis=1)
def label_row(row):
    if row["close"] > row["open"]:
        return "up"
    elif row["close"] < row["open"]:
        return "down"
    return "flat"

ohlcv_pd.head(10).apply(label_row, axis=1)
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>0</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>down</td>
    </tr>
    <tr>
      <th>1</th>
      <td>up</td>
    </tr>
    <tr>
      <th>2</th>
      <td>up</td>
    </tr>
    <tr>
      <th>3</th>
      <td>down</td>
    </tr>
    <tr>
      <th>4</th>
      <td>down</td>
    </tr>
    <tr>
      <th>5</th>
      <td>down</td>
    </tr>
    <tr>
      <th>6</th>
      <td>down</td>
    </tr>
    <tr>
      <th>7</th>
      <td>down</td>
    </tr>
    <tr>
      <th>8</th>
      <td>up</td>
    </tr>
    <tr>
      <th>9</th>
      <td>flat</td>
    </tr>
  </tbody>
</table>

```python
# apply on a Series
ohlcv_pd["close"].apply(lambda x: round(x, 0)).head()
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>57.0</td>
    </tr>
    <tr>
      <th>1</th>
      <td>57.0</td>
    </tr>
    <tr>
      <th>2</th>
      <td>59.0</td>
    </tr>
    <tr>
      <th>3</th>
      <td>58.0</td>
    </tr>
    <tr>
      <th>4</th>
      <td>58.0</td>
    </tr>
  </tbody>
</table>

---
## 6 · <code style="font-size:0.75em">map_elements</code> / <code style="font-size:0.75em">map_batches</code> (Polars)

> `map_elements` is analogous to Pandas `apply` — it runs a Python function per element.  
> `map_batches` receives the whole Series (or column) at once — great for NumPy interop.

```python
# map_elements — per-element Python function (slow, use sparingly)
ohlcv_pl.with_columns(
    pl.col("symbol").map_elements(lambda t: t.split(".")[0], return_dtype=pl.String).alias("short_symbol")
).select("symbol", "short_symbol").head()
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 2)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>short_symbol</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>&quot;ABI&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;ABI&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;ABI&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;ABI&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;ABI&quot;</td></tr></tbody></table></div>

```python
# map_batches — receives the full Series; great for NumPy UDFs
ohlcv_pl.with_columns(
    pl.col("close").map_batches(lambda s: s.to_numpy() ** 0.5, return_dtype=pl.Float64).alias("sqrt_close")
).select("symbol", "date", "close", "sqrt_close").head()
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 4)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th><th>sqrt_close</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>7.563729</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td><td>7.561746</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td><td>7.666159</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.4</td><td>7.641989</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>57.86</td><td>7.606576</td></tr></tbody></table></div>

---
## 7 · Conditional Columns — <code style="font-size:0.75em">np.where</code> / <code style="font-size:0.75em">np.select</code> (Pandas)

```python
# np.where — binary condition
df = ohlcv_pd.copy()
df["direction"] = np.where(df["close"] > df["open"], "up", "down")
df[["symbol", "date", "open", "close", "direction"]].head()
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>open</th>
      <th>close</th>
      <th>direction</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ABI.BR</td>
      <td>2021-01-04</td>
      <td>58.15</td>
      <td>57.21</td>
      <td>down</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ABI.BR</td>
      <td>2021-01-05</td>
      <td>56.90</td>
      <td>57.18</td>
      <td>up</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ABI.BR</td>
      <td>2021-01-06</td>
      <td>57.96</td>
      <td>58.77</td>
      <td>up</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ABI.BR</td>
      <td>2021-01-07</td>
      <td>58.68</td>
      <td>58.40</td>
      <td>down</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ABI.BR</td>
      <td>2021-01-08</td>
      <td>58.16</td>
      <td>57.86</td>
      <td>down</td>
    </tr>
  </tbody>
</table>

```python
# np.select — multiple conditions
conditions = [
    ohlcv_pd["close"] > ohlcv_pd["open"] * 1.02,
    ohlcv_pd["close"] < ohlcv_pd["open"] * 0.98,
]
choices = ["strong_up", "strong_down"]
df = ohlcv_pd.copy()
df["move"] = np.select(conditions, choices, default="flat")
df[["symbol", "date", "open", "close", "move"]].head(10)
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>open</th>
      <th>close</th>
      <th>move</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ABI.BR</td>
      <td>2021-01-04</td>
      <td>58.15</td>
      <td>57.21</td>
      <td>flat</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ABI.BR</td>
      <td>2021-01-05</td>
      <td>56.90</td>
      <td>57.18</td>
      <td>flat</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ABI.BR</td>
      <td>2021-01-06</td>
      <td>57.96</td>
      <td>58.77</td>
      <td>flat</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ABI.BR</td>
      <td>2021-01-07</td>
      <td>58.68</td>
      <td>58.40</td>
      <td>flat</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ABI.BR</td>
      <td>2021-01-08</td>
      <td>58.16</td>
      <td>57.86</td>
      <td>flat</td>
    </tr>
    <tr>
      <th>5</th>
      <td>ABI.BR</td>
      <td>2021-01-11</td>
      <td>57.73</td>
      <td>56.61</td>
      <td>flat</td>
    </tr>
    <tr>
      <th>6</th>
      <td>ABI.BR</td>
      <td>2021-01-12</td>
      <td>56.70</td>
      <td>56.51</td>
      <td>flat</td>
    </tr>
    <tr>
      <th>7</th>
      <td>ABI.BR</td>
      <td>2021-01-13</td>
      <td>56.50</td>
      <td>56.48</td>
      <td>flat</td>
    </tr>
    <tr>
      <th>8</th>
      <td>ABI.BR</td>
      <td>2021-01-14</td>
      <td>56.88</td>
      <td>56.96</td>
      <td>flat</td>
    </tr>
    <tr>
      <th>9</th>
      <td>ABI.BR</td>
      <td>2021-01-15</td>
      <td>56.74</td>
      <td>56.74</td>
      <td>flat</td>
    </tr>
  </tbody>
</table>

---
## 8 · <code style="font-size:0.75em">when</code> / <code style="font-size:0.75em">then</code> / <code style="font-size:0.75em">otherwise</code> (Polars)

```python
ohlcv_pl.with_columns(
    pl.when(pl.col("close") > pl.col("open"))
      .then(pl.lit("up"))
      .otherwise(pl.lit("down"))
      .alias("direction")
).select("symbol", "date", "open", "close", "direction").head()
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 5)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>open</th><th>close</th><th>direction</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>58.15</td><td>57.21</td><td>&quot;down&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>56.9</td><td>57.18</td><td>&quot;up&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>57.96</td><td>58.77</td><td>&quot;up&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.68</td><td>58.4</td><td>&quot;down&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>58.16</td><td>57.86</td><td>&quot;down&quot;</td></tr></tbody></table></div>

```python
# Chained when — multiple buckets
ohlcv_pl.with_columns(
    pl.when(pl.col("close") > pl.col("open") * 1.02)
      .then(pl.lit("strong_up"))
      .when(pl.col("close") < pl.col("open") * 0.98)
      .then(pl.lit("strong_down"))
      .otherwise(pl.lit("flat"))
      .alias("move")
).select("symbol", "date", "open", "close", "move").head(10)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 5)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>open</th><th>close</th><th>move</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>58.15</td><td>57.21</td><td>&quot;flat&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>56.9</td><td>57.18</td><td>&quot;flat&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>57.96</td><td>58.77</td><td>&quot;flat&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.68</td><td>58.4</td><td>&quot;flat&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>58.16</td><td>57.86</td><td>&quot;flat&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-11</td><td>57.73</td><td>56.61</td><td>&quot;flat&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-12</td><td>56.7</td><td>56.51</td><td>&quot;flat&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-13</td><td>56.5</td><td>56.48</td><td>&quot;flat&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-14</td><td>56.88</td><td>56.96</td><td>&quot;flat&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-15</td><td>56.74</td><td>56.74</td><td>&quot;flat&quot;</td></tr></tbody></table></div>

---
## 9 · Type Casting

### Pandas — <code style="font-size:0.75em">astype</code>


- **Astype**: Convert column to a different data type (Pandas).

```python
df = ohlcv_pd.copy()
print("Before:", df["volume"].dtype)
df["volume"] = df["volume"].astype("float64")
print("After :", df["volume"].dtype)
```

    Before: int64
    After : float64

```python
# Cast date string to datetime (if needed)
df = ohlcv_pd.copy()
df["date"] = pd.to_datetime(df["date"])
print(df["date"].dtype)
```

    datetime64[ns]

```python
# Category type for low-cardinality strings
df = ohlcv_pd.copy()
df["symbol"] = df["symbol"].astype("category")
print(df["symbol"].dtype)
print(df["symbol"].cat.categories[:5].tolist())
```

    category
    ['ABI.BR', 'AD.AS', 'ADS.DE', 'ADYEN.AS', 'AI.PA']

### Polars — <code style="font-size:0.75em">cast</code>


- **Select**: Choose specific columns, optionally transforming them.
- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **Head**: Return the first N rows.

```python
ohlcv_pl.with_columns(
    pl.col("volume").cast(pl.Float64).alias("volume_f64"),
).select("volume", "volume_f64").head()
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 2)</small><table border="1" class="dataframe"><thead><tr><th>volume</th><th>volume_f64</th></tr><tr><td>i64</td><td>f64</td></tr></thead><tbody><tr><td>1513937</td><td>1.513937e6</td></tr><tr><td>1382722</td><td>1.382722e6</td></tr><tr><td>1370204</td><td>1.370204e6</td></tr><tr><td>1469911</td><td>1.469911e6</td></tr><tr><td>1428681</td><td>1.428681e6</td></tr></tbody></table></div>

```python
# Cast multiple columns at once
ohlcv_pl.with_columns(
    cs.numeric().cast(pl.Float32)
).dtypes
```

    [Float32,
     String,
     Date,
     Float32,
     Float32,
     Float32,
     Float32,
     Float32,
     Float32,
     Float32,
     Float32,
     Boolean]

```python
# Enum / Categorical
ohlcv_pl.with_columns(
    pl.col("symbol").cast(pl.Categorical)
).schema
```

    Schema([('id', Int64),
            ('symbol', Categorical),
            ('date', Date),
            ('open', Float64),
            ('high', Float64),
            ('low', Float64),
            ('close', Float64),
            ('adj_close', Float64),
            ('volume', Int64),
            ('dividends', Float64),
            ('stock_splits', Float64),
            ('is_filled', Boolean)])

---
## 10 · <code style="font-size:0.75em">.str</code> Accessor Operations

### Pandas


- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.
- **Head**: Return the first N rows.

```python
df = ohlcv_pd.copy()
df["symbol_upper"] = df["symbol"].str.upper()
df["symbol_short"] = df["symbol"].str.split(".").str[0]
df["has_de"]       = df["symbol"].str.contains("DE")
df[["symbol", "symbol_upper", "symbol_short", "has_de"]].head()
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>symbol</th>
      <th>symbol_upper</th>
      <th>symbol_short</th>
      <th>has_de</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ABI.BR</td>
      <td>ABI.BR</td>
      <td>ABI</td>
      <td>False</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ABI.BR</td>
      <td>ABI.BR</td>
      <td>ABI</td>
      <td>False</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ABI.BR</td>
      <td>ABI.BR</td>
      <td>ABI</td>
      <td>False</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ABI.BR</td>
      <td>ABI.BR</td>
      <td>ABI</td>
      <td>False</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ABI.BR</td>
      <td>ABI.BR</td>
      <td>ABI</td>
      <td>False</td>
    </tr>
  </tbody>
</table>

```python
# Replace and strip
df = ohlcv_pd.copy()
df["clean"] = df["symbol"].str.replace(".DE", "", regex=False).str.strip()
df[["symbol", "clean"]].drop_duplicates().head()
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>symbol</th>
      <th>clean</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ABI.BR</td>
      <td>ABI.BR</td>
    </tr>
    <tr>
      <th>1331</th>
      <td>AD.AS</td>
      <td>AD.AS</td>
    </tr>
    <tr>
      <th>2662</th>
      <td>ADS.DE</td>
      <td>ADS</td>
    </tr>
    <tr>
      <th>3986</th>
      <td>ADYEN.AS</td>
      <td>ADYEN.AS</td>
    </tr>
    <tr>
      <th>5317</th>
      <td>AI.PA</td>
      <td>AI.PA</td>
    </tr>
  </tbody>
</table>

### Polars


- **Select**: Choose specific columns, optionally transforming them.
- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **List Ops**: Access elements inside list columns: .list.len(), .list.first(), .list.contains().
- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.

```python
ohlcv_pl.with_columns(
    pl.col("symbol").str.to_uppercase().alias("symbol_upper"),
    pl.col("symbol").str.split(".").list.first().alias("symbol_short"),
    pl.col("symbol").str.contains("DE").alias("has_de"),
).select("symbol", "symbol_upper", "symbol_short", "has_de").head()
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 4)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>symbol_upper</th><th>symbol_short</th><th>has_de</th></tr><tr><td>str</td><td>str</td><td>str</td><td>bool</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>&quot;ABI.BR&quot;</td><td>&quot;ABI&quot;</td><td>false</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;ABI.BR&quot;</td><td>&quot;ABI&quot;</td><td>false</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;ABI.BR&quot;</td><td>&quot;ABI&quot;</td><td>false</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;ABI.BR&quot;</td><td>&quot;ABI&quot;</td><td>false</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;ABI.BR&quot;</td><td>&quot;ABI&quot;</td><td>false</td></tr></tbody></table></div>

```python
ohlcv_pl.with_columns(
    pl.col("symbol").str.replace(".DE", "").str.strip_chars().alias("clean"),
).select("symbol", "clean").unique().head()
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 2)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>clean</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>&quot;NDA-FI.HE&quot;</td><td>&quot;NDA-FI.HE&quot;</td></tr><tr><td>&quot;INGA.AS&quot;</td><td>&quot;INGA.AS&quot;</td></tr><tr><td>&quot;SAP.DE&quot;</td><td>&quot;SAP&quot;</td></tr><tr><td>&quot;MBG.DE&quot;</td><td>&quot;MBG&quot;</td></tr><tr><td>&quot;PRX.AS&quot;</td><td>&quot;PRX.AS&quot;</td></tr></tbody></table></div>

---
## 11 · <code style="font-size:0.75em">.dt</code> Accessor Operations

### Pandas


- **DateTime Accessor**: Extract date parts: .dt.year(), .dt.month(), .dt.weekday().
- **Parse Dates**: Convert strings to datetime objects (Pandas).
- **Head**: Return the first N rows.

```python
df = ohlcv_pd.copy()
df["date"] = pd.to_datetime(df["date"])
df["year"]    = df["date"].dt.year
df["month"]   = df["date"].dt.month
df["weekday"] = df["date"].dt.day_name()
df["quarter"] = df["date"].dt.quarter
df[["date", "year", "month", "weekday", "quarter"]].head()
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>date</th>
      <th>year</th>
      <th>month</th>
      <th>weekday</th>
      <th>quarter</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>2021-01-04</td>
      <td>2021</td>
      <td>1</td>
      <td>Monday</td>
      <td>1</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2021-01-05</td>
      <td>2021</td>
      <td>1</td>
      <td>Tuesday</td>
      <td>1</td>
    </tr>
    <tr>
      <th>2</th>
      <td>2021-01-06</td>
      <td>2021</td>
      <td>1</td>
      <td>Wednesday</td>
      <td>1</td>
    </tr>
    <tr>
      <th>3</th>
      <td>2021-01-07</td>
      <td>2021</td>
      <td>1</td>
      <td>Thursday</td>
      <td>1</td>
    </tr>
    <tr>
      <th>4</th>
      <td>2021-01-08</td>
      <td>2021</td>
      <td>1</td>
      <td>Friday</td>
      <td>1</td>
    </tr>
  </tbody>
</table>

### Polars


- **Select**: Choose specific columns, optionally transforming them.
- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **DateTime Accessor**: Extract date parts: .dt.year(), .dt.month(), .dt.weekday().
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

```python
ohlcv_pl.with_columns(
    pl.col("date").dt.year().alias("year"),
    pl.col("date").dt.month().alias("month"),
    pl.col("date").dt.weekday().alias("weekday"),
    pl.col("date").dt.quarter().alias("quarter"),
).select("date", "year", "month", "weekday", "quarter").head()
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 5)</small><table border="1" class="dataframe"><thead><tr><th>date</th><th>year</th><th>month</th><th>weekday</th><th>quarter</th></tr><tr><td>date</td><td>i32</td><td>i8</td><td>i8</td><td>i8</td></tr></thead><tbody><tr><td>2021-01-04</td><td>2021</td><td>1</td><td>1</td><td>1</td></tr><tr><td>2021-01-05</td><td>2021</td><td>1</td><td>2</td><td>1</td></tr><tr><td>2021-01-06</td><td>2021</td><td>1</td><td>3</td><td>1</td></tr><tr><td>2021-01-07</td><td>2021</td><td>1</td><td>4</td><td>1</td></tr><tr><td>2021-01-08</td><td>2021</td><td>1</td><td>5</td><td>1</td></tr></tbody></table></div>

```python
# Date arithmetic — Polars
ohlcv_pl.with_columns(
    (pl.col("date") + pl.duration(days=7)).alias("date_plus_7d"),
    pl.col("date").dt.month_start().alias("month_start"),
).select("date", "date_plus_7d", "month_start").head()
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 3)</small><table border="1" class="dataframe"><thead><tr><th>date</th><th>date_plus_7d</th><th>month_start</th></tr><tr><td>date</td><td>date</td><td>date</td></tr></thead><tbody><tr><td>2021-01-04</td><td>2021-01-11</td><td>2021-01-01</td></tr><tr><td>2021-01-05</td><td>2021-01-12</td><td>2021-01-01</td></tr><tr><td>2021-01-06</td><td>2021-01-13</td><td>2021-01-01</td></tr><tr><td>2021-01-07</td><td>2021-01-14</td><td>2021-01-01</td></tr><tr><td>2021-01-08</td><td>2021-01-15</td><td>2021-01-01</td></tr></tbody></table></div>

---
## 12 · Arithmetic & Math Operations

```python
# Pandas
df = ohlcv_pd.copy()
df["log_close"]     = np.log(df["close"])
df["pct_change"]    = df.groupby("symbol")["close"].pct_change()
df["cum_volume"]    = df.groupby("symbol")["volume"].cumsum()
df[["symbol", "date", "close", "log_close", "pct_change", "cum_volume"]].head(10)
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>close</th>
      <th>log_close</th>
      <th>pct_change</th>
      <th>cum_volume</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ABI.BR</td>
      <td>2021-01-04</td>
      <td>57.21</td>
      <td>4.046729</td>
      <td>NaN</td>
      <td>1513937</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ABI.BR</td>
      <td>2021-01-05</td>
      <td>57.18</td>
      <td>4.046204</td>
      <td>-0.000524</td>
      <td>2896659</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ABI.BR</td>
      <td>2021-01-06</td>
      <td>58.77</td>
      <td>4.073632</td>
      <td>0.027807</td>
      <td>4266863</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ABI.BR</td>
      <td>2021-01-07</td>
      <td>58.40</td>
      <td>4.067316</td>
      <td>-0.006296</td>
      <td>5736774</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ABI.BR</td>
      <td>2021-01-08</td>
      <td>57.86</td>
      <td>4.058026</td>
      <td>-0.009247</td>
      <td>7165455</td>
    </tr>
    <tr>
      <th>5</th>
      <td>ABI.BR</td>
      <td>2021-01-11</td>
      <td>56.61</td>
      <td>4.036186</td>
      <td>-0.021604</td>
      <td>8683534</td>
    </tr>
    <tr>
      <th>6</th>
      <td>ABI.BR</td>
      <td>2021-01-12</td>
      <td>56.51</td>
      <td>4.034418</td>
      <td>-0.001766</td>
      <td>10333525</td>
    </tr>
    <tr>
      <th>7</th>
      <td>ABI.BR</td>
      <td>2021-01-13</td>
      <td>56.48</td>
      <td>4.033887</td>
      <td>-0.000531</td>
      <td>11424331</td>
    </tr>
    <tr>
      <th>8</th>
      <td>ABI.BR</td>
      <td>2021-01-14</td>
      <td>56.96</td>
      <td>4.042349</td>
      <td>0.008499</td>
      <td>12947376</td>
    </tr>
    <tr>
      <th>9</th>
      <td>ABI.BR</td>
      <td>2021-01-15</td>
      <td>56.74</td>
      <td>4.038479</td>
      <td>-0.003862</td>
      <td>14717364</td>
    </tr>
  </tbody>
</table>

```python
# Polars
ohlcv_pl.with_columns(
    pl.col("close").log().alias("log_close"),
    pl.col("close").pct_change().over("symbol").alias("pct_change"),
    pl.col("volume").cum_sum().over("symbol").alias("cum_volume"),
).select("symbol", "date", "close", "log_close", "pct_change", "cum_volume").head(10)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 6)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th><th>log_close</th><th>pct_change</th><th>cum_volume</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>4.046729</td><td>null</td><td>1513937</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td><td>4.046204</td><td>-0.000524</td><td>2896659</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td><td>4.073632</td><td>0.027807</td><td>4266863</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.4</td><td>4.067316</td><td>-0.006296</td><td>5736774</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>57.86</td><td>4.058026</td><td>-0.009247</td><td>7165455</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-11</td><td>56.61</td><td>4.036186</td><td>-0.021604</td><td>8683534</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-12</td><td>56.51</td><td>4.034418</td><td>-0.001766</td><td>10333525</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-13</td><td>56.48</td><td>4.033887</td><td>-0.000531</td><td>11424331</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-14</td><td>56.96</td><td>4.042349</td><td>0.008499</td><td>12947376</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-15</td><td>56.74</td><td>4.038479</td><td>-0.003862</td><td>14717364</td></tr></tbody></table></div>

```python
# Polars — clip / round / abs
ohlcv_pl.with_columns(
    pl.col("close").round(0).alias("close_rounded"),
    pl.col("close").clip(20, 80).alias("close_clipped"),
    (pl.col("close") - pl.col("open")).abs().alias("abs_change"),
).select("symbol", "date", "close", "close_rounded", "close_clipped", "abs_change").head()
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 6)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th><th>close_rounded</th><th>close_clipped</th><th>abs_change</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>57.0</td><td>57.21</td><td>0.94</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td><td>57.0</td><td>57.18</td><td>0.28</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td><td>59.0</td><td>58.77</td><td>0.81</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.4</td><td>58.0</td><td>58.4</td><td>0.28</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>57.86</td><td>58.0</td><td>57.86</td><td>0.3</td></tr></tbody></table></div>

---
## 13 · The "Tweak Function" Pattern

Encapsulate all data-prep transformations in a single function that takes a raw DataFrame and returns a clean one.
This makes pipelines **reproducible** and **testable**.

### Pandas tweak


- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.
- **Assign**: Add columns via method chaining (Pandas). Returns new DataFrame.
- **Parse Dates**: Convert strings to datetime objects (Pandas).
- **Head**: Return the first N rows.

```python
def tweak_ohlcv_pd(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df
        .assign(
            date=lambda d: pd.to_datetime(d["date"]),
            range=lambda d: d["high"] - d["low"],
            mid=lambda d: (d["high"] + d["low"]) / 2,
            intraday_ret=lambda d: (d["close"] - d["open"]) / d["open"],
            volume_m=lambda d: d["volume"] / 1_000_000,
            symbol_short=lambda d: d["symbol"].str.split(".").str[0],
        )
        .rename(columns=str.lower)
    )

tweak_ohlcv_pd(ohlcv_pd).head()
```

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
      <th>range</th>
      <th>mid</th>
      <th>intraday_ret</th>
      <th>volume_m</th>
      <th>symbol_short</th>
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
      <td>2.07</td>
      <td>57.815</td>
      <td>-0.016165</td>
      <td>1.513937</td>
      <td>ABI</td>
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
      <td>1.23</td>
      <td>57.365</td>
      <td>0.004921</td>
      <td>1.382722</td>
      <td>ABI</td>
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
      <td>1.55</td>
      <td>58.165</td>
      <td>0.013975</td>
      <td>1.370204</td>
      <td>ABI</td>
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
      <td>0.98</td>
      <td>58.370</td>
      <td>-0.004772</td>
      <td>1.469911</td>
      <td>ABI</td>
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
      <td>0.97</td>
      <td>57.915</td>
      <td>-0.005158</td>
      <td>1.428681</td>
      <td>ABI</td>
    </tr>
  </tbody>
</table>

### Polars tweak


- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **List Ops**: Access elements inside list columns: .list.len(), .list.first(), .list.contains().
- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

```python
def tweak_ohlcv_pl(df: pl.DataFrame) -> pl.DataFrame:
    return (
        df
        .with_columns(
            (pl.col("high") - pl.col("low")).alias("range"),
            ((pl.col("high") + pl.col("low")) / 2).alias("mid"),
            ((pl.col("close") - pl.col("open")) / pl.col("open")).alias("intraday_ret"),
            (pl.col("volume") / 1_000_000).alias("volume_m"),
            pl.col("symbol").str.split(".").list.first().alias("symbol_short"),
        )
    )

tweak_ohlcv_pl(ohlcv_pl).head()
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 17)</small><table border="1" class="dataframe"><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th><th>range</th><th>mid</th><th>intraday_ret</th><th>volume_m</th><th>symbol_short</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>21160</td><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td><td>2.07</td><td>57.815</td><td>-0.016165</td><td>1.513937</td><td>&quot;ABI&quot;</td></tr><tr><td>21161</td><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td><td>1.23</td><td>57.365</td><td>0.004921</td><td>1.382722</td><td>&quot;ABI&quot;</td></tr><tr><td>21162</td><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td><td>1.55</td><td>58.165</td><td>0.013975</td><td>1.370204</td><td>&quot;ABI&quot;</td></tr><tr><td>21163</td><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td><td>0.98</td><td>58.37</td><td>-0.004772</td><td>1.469911</td><td>&quot;ABI&quot;</td></tr><tr><td>21164</td><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td><td>0.97</td><td>57.915</td><td>-0.005158</td><td>1.428681</td><td>&quot;ABI&quot;</td></tr></tbody></table></div>

---
## 14 · Transforming <code style="font-size:0.75em">scores_daily</code> — Practical Examples

```python
scores_pd.head(3)
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>id</th>
      <th>_index</th>
      <th>symbol</th>
      <th>score_date</th>
      <th>sector</th>
      <th>pe_zscore</th>
      <th>pb_zscore</th>
      <th>ev_ebitda_zscore</th>
      <th>yield_zscore</th>
      <th>relative_value_score</th>
      <th>relative_value_rank</th>
      <th>relative_strength</th>
      <th>sma_50_ratio</th>
      <th>sma_200_ratio</th>
      <th>dist_from_52w_high</th>
      <th>momentum_score</th>
      <th>momentum_rank</th>
      <th>implied_upside</th>
      <th>recommendation_mean</th>
      <th>price_falling_analysts_bullish</th>
      <th>sentiment_score</th>
      <th>sentiment_rank</th>
      <th>composite_score</th>
      <th>composite_rank</th>
      <th>_scored_at</th>
      <th>sma_30_close</th>
      <th>sma_90_close</th>
      <th>market_cap</th>
      <th>index_weight</th>
      <th>short_name</th>
      <th>country</th>
      <th>current_price</th>
      <th>day_change_pct</th>
      <th>five_day_change_pct</th>
      <th>ytd_change_pct</th>
      <th>currency</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>163</td>
      <td>euro_stoxx_50</td>
      <td>BNP.PA</td>
      <td>2026-03-04</td>
      <td>Financial Services</td>
      <td>0.913389</td>
      <td>1.261140</td>
      <td>NaN</td>
      <td>2.388962</td>
      <td>1.521163</td>
      <td>1</td>
      <td>0.016123</td>
      <td>1.009090</td>
      <td>1.130264</td>
      <td>0.082486</td>
      <td>0.477966</td>
      <td>16</td>
      <td>0.153157</td>
      <td>1.84211</td>
      <td>False</td>
      <td>0.052711</td>
      <td>25</td>
      <td>0.683947</td>
      <td>1</td>
      <td>2026-03-04 22:40:25.489180</td>
      <td>92.085000</td>
      <td>81.181889</td>
      <td>99751215104</td>
      <td>0.019525</td>
      <td>BNP PARIBAS ACT.A</td>
      <td>France</td>
      <td>89.320</td>
      <td>0.011437</td>
      <td>-0.073156</td>
      <td>0.105582</td>
      <td>EUR</td>
    </tr>
    <tr>
      <th>1</th>
      <td>168</td>
      <td>euro_stoxx_50</td>
      <td>DTE.DE</td>
      <td>2026-03-04</td>
      <td>Communication Services</td>
      <td>0.326587</td>
      <td>0.387463</td>
      <td>0.379532</td>
      <td>-0.127867</td>
      <td>0.241429</td>
      <td>24</td>
      <td>-0.205598</td>
      <td>1.120650</td>
      <td>1.112416</td>
      <td>0.055524</td>
      <td>0.685752</td>
      <td>8</td>
      <td>0.121212</td>
      <td>1.33333</td>
      <td>False</td>
      <td>0.617835</td>
      <td>10</td>
      <td>0.515005</td>
      <td>2</td>
      <td>2026-03-04 22:40:25.489180</td>
      <td>30.838000</td>
      <td>28.554556</td>
      <td>164294311936</td>
      <td>0.032159</td>
      <td>DEUTSCHE TELEKOM AG</td>
      <td>Germany</td>
      <td>33.000</td>
      <td>0.011649</td>
      <td>-0.019608</td>
      <td>0.193059</td>
      <td>EUR</td>
    </tr>
    <tr>
      <th>2</th>
      <td>174</td>
      <td>euro_stoxx_50</td>
      <td>IFX.DE</td>
      <td>2026-03-04</td>
      <td>Technology</td>
      <td>0.509398</td>
      <td>0.637215</td>
      <td>0.677068</td>
      <td>-0.696662</td>
      <td>0.281755</td>
      <td>22</td>
      <td>0.000965</td>
      <td>1.048244</td>
      <td>1.198626</td>
      <td>0.088845</td>
      <td>0.675764</td>
      <td>9</td>
      <td>0.126408</td>
      <td>1.37500</td>
      <td>False</td>
      <td>0.579187</td>
      <td>11</td>
      <td>0.512235</td>
      <td>3</td>
      <td>2026-03-04 22:40:25.489180</td>
      <td>43.480333</td>
      <td>38.855556</td>
      <td>57222533120</td>
      <td>0.011201</td>
      <td>INFINEON TECHNOLOGIES AG</td>
      <td>Germany</td>
      <td>43.945</td>
      <td>0.054343</td>
      <td>-0.066490</td>
      <td>0.164723</td>
      <td>EUR</td>
    </tr>
  </tbody>
</table>

```python
# Pandas — bin scores
df = scores_pd.copy()
df["score_bin"] = pd.cut(df["pe_zscore"], bins=[0, 0.25, 0.5, 0.75, 1.0],
                         labels=["Q1", "Q2", "Q3", "Q4"])
df.head()
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>id</th>
      <th>_index</th>
      <th>symbol</th>
      <th>score_date</th>
      <th>sector</th>
      <th>pe_zscore</th>
      <th>pb_zscore</th>
      <th>ev_ebitda_zscore</th>
      <th>yield_zscore</th>
      <th>relative_value_score</th>
      <th>relative_value_rank</th>
      <th>relative_strength</th>
      <th>sma_50_ratio</th>
      <th>sma_200_ratio</th>
      <th>dist_from_52w_high</th>
      <th>momentum_score</th>
      <th>momentum_rank</th>
      <th>implied_upside</th>
      <th>recommendation_mean</th>
      <th>price_falling_analysts_bullish</th>
      <th>sentiment_score</th>
      <th>sentiment_rank</th>
      <th>composite_score</th>
      <th>composite_rank</th>
      <th>_scored_at</th>
      <th>sma_30_close</th>
      <th>sma_90_close</th>
      <th>market_cap</th>
      <th>index_weight</th>
      <th>short_name</th>
      <th>country</th>
      <th>current_price</th>
      <th>day_change_pct</th>
      <th>five_day_change_pct</th>
      <th>ytd_change_pct</th>
      <th>currency</th>
      <th>score_bin</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>163</td>
      <td>euro_stoxx_50</td>
      <td>BNP.PA</td>
      <td>2026-03-04</td>
      <td>Financial Services</td>
      <td>0.913389</td>
      <td>1.261140</td>
      <td>NaN</td>
      <td>2.388962</td>
      <td>1.521163</td>
      <td>1</td>
      <td>0.016123</td>
      <td>1.009090</td>
      <td>1.130264</td>
      <td>0.082486</td>
      <td>0.477966</td>
      <td>16</td>
      <td>0.153157</td>
      <td>1.84211</td>
      <td>False</td>
      <td>0.052711</td>
      <td>25</td>
      <td>0.683947</td>
      <td>1</td>
      <td>2026-03-04 22:40:25.489180</td>
      <td>92.085000</td>
      <td>81.181889</td>
      <td>99751215104</td>
      <td>0.019525</td>
      <td>BNP PARIBAS ACT.A</td>
      <td>France</td>
      <td>89.320</td>
      <td>0.011437</td>
      <td>-0.073156</td>
      <td>0.105582</td>
      <td>EUR</td>
      <td>Q4</td>
    </tr>
    <tr>
      <th>1</th>
      <td>168</td>
      <td>euro_stoxx_50</td>
      <td>DTE.DE</td>
      <td>2026-03-04</td>
      <td>Communication Services</td>
      <td>0.326587</td>
      <td>0.387463</td>
      <td>0.379532</td>
      <td>-0.127867</td>
      <td>0.241429</td>
      <td>24</td>
      <td>-0.205598</td>
      <td>1.120650</td>
      <td>1.112416</td>
      <td>0.055524</td>
      <td>0.685752</td>
      <td>8</td>
      <td>0.121212</td>
      <td>1.33333</td>
      <td>False</td>
      <td>0.617835</td>
      <td>10</td>
      <td>0.515005</td>
      <td>2</td>
      <td>2026-03-04 22:40:25.489180</td>
      <td>30.838000</td>
      <td>28.554556</td>
      <td>164294311936</td>
      <td>0.032159</td>
      <td>DEUTSCHE TELEKOM AG</td>
      <td>Germany</td>
      <td>33.000</td>
      <td>0.011649</td>
      <td>-0.019608</td>
      <td>0.193059</td>
      <td>EUR</td>
      <td>Q2</td>
    </tr>
    <tr>
      <th>2</th>
      <td>174</td>
      <td>euro_stoxx_50</td>
      <td>IFX.DE</td>
      <td>2026-03-04</td>
      <td>Technology</td>
      <td>0.509398</td>
      <td>0.637215</td>
      <td>0.677068</td>
      <td>-0.696662</td>
      <td>0.281755</td>
      <td>22</td>
      <td>0.000965</td>
      <td>1.048244</td>
      <td>1.198626</td>
      <td>0.088845</td>
      <td>0.675764</td>
      <td>9</td>
      <td>0.126408</td>
      <td>1.37500</td>
      <td>False</td>
      <td>0.579187</td>
      <td>11</td>
      <td>0.512235</td>
      <td>3</td>
      <td>2026-03-04 22:40:25.489180</td>
      <td>43.480333</td>
      <td>38.855556</td>
      <td>57222533120</td>
      <td>0.011201</td>
      <td>INFINEON TECHNOLOGIES AG</td>
      <td>Germany</td>
      <td>43.945</td>
      <td>0.054343</td>
      <td>-0.066490</td>
      <td>0.164723</td>
      <td>EUR</td>
      <td>Q3</td>
    </tr>
    <tr>
      <th>3</th>
      <td>172</td>
      <td>euro_stoxx_50</td>
      <td>ENR.DE</td>
      <td>2026-03-04</td>
      <td>Industrials</td>
      <td>-0.902738</td>
      <td>-0.743338</td>
      <td>-1.693212</td>
      <td>-1.326075</td>
      <td>-1.166341</td>
      <td>46</td>
      <td>1.645455</td>
      <td>1.137007</td>
      <td>1.474095</td>
      <td>0.051850</td>
      <td>2.541889</td>
      <td>1</td>
      <td>0.075269</td>
      <td>1.80000</td>
      <td>False</td>
      <td>-0.123264</td>
      <td>29</td>
      <td>0.417428</td>
      <td>4</td>
      <td>2026-03-04 22:40:25.489180</td>
      <td>155.675000</td>
      <td>129.122000</td>
      <td>139207262208</td>
      <td>0.027249</td>
      <td>Siemens Energy AG</td>
      <td>Germany</td>
      <td>162.750</td>
      <td>0.047297</td>
      <td>-0.039256</td>
      <td>0.351744</td>
      <td>EUR</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>4</th>
      <td>149</td>
      <td>euro_stoxx_50</td>
      <td>ABI.BR</td>
      <td>2026-03-04</td>
      <td>Consumer Defensive</td>
      <td>0.474084</td>
      <td>0.844075</td>
      <td>0.552739</td>
      <td>-0.975005</td>
      <td>0.223973</td>
      <td>25</td>
      <td>-0.029791</td>
      <td>1.058542</td>
      <td>1.142783</td>
      <td>0.063063</td>
      <td>0.651891</td>
      <td>10</td>
      <td>0.186198</td>
      <td>1.69231</td>
      <td>False</td>
      <td>0.344755</td>
      <td>17</td>
      <td>0.406873</td>
      <td>5</td>
      <td>2026-03-04 22:40:25.489180</td>
      <td>64.342000</td>
      <td>57.869333</td>
      <td>125566156800</td>
      <td>0.024579</td>
      <td>AB INBEV</td>
      <td>Belgium</td>
      <td>64.480</td>
      <td>-0.017073</td>
      <td>-0.040762</td>
      <td>0.174499</td>
      <td>EUR</td>
      <td>Q2</td>
    </tr>
  </tbody>
</table>

```python
# Polars — bin scores with when/then
scores_pl.with_columns(
    pl.when(pl.col("pe_zscore") <= 0.25).then(pl.lit("Q1"))
      .when(pl.col("pe_zscore") <= 0.50).then(pl.lit("Q2"))
      .when(pl.col("pe_zscore") <= 0.75).then(pl.lit("Q3"))
      .otherwise(pl.lit("Q4"))
      .alias("score_bin")
).head()
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 37)</small><table border="1" class="dataframe"><thead><tr><th>id</th><th>_index</th><th>symbol</th><th>score_date</th><th>sector</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>relative_value_rank</th><th>relative_strength</th><th>sma_50_ratio</th><th>sma_200_ratio</th><th>dist_from_52w_high</th><th>momentum_score</th><th>momentum_rank</th><th>implied_upside</th><th>recommendation_mean</th><th>price_falling_analysts_bullish</th><th>sentiment_score</th><th>sentiment_rank</th><th>composite_score</th><th>composite_rank</th><th>_scored_at</th><th>sma_30_close</th><th>sma_90_close</th><th>market_cap</th><th>index_weight</th><th>short_name</th><th>country</th><th>current_price</th><th>day_change_pct</th><th>five_day_change_pct</th><th>ytd_change_pct</th><th>currency</th><th>score_bin</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>date</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td><td>f64</td><td>i64</td><td>f64</td><td>i64</td><td>datetime[ns]</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>str</td><td>str</td></tr></thead><tbody><tr><td>163</td><td>&quot;euro_stoxx_50&quot;</td><td>&quot;BNP.PA&quot;</td><td>2026-03-04</td><td>&quot;Financial Services&quot;</td><td>0.913389</td><td>1.26114</td><td>null</td><td>2.388962</td><td>1.521163</td><td>1</td><td>0.016123</td><td>1.00909</td><td>1.130264</td><td>0.082486</td><td>0.477966</td><td>16</td><td>0.153157</td><td>1.84211</td><td>false</td><td>0.052711</td><td>25</td><td>0.683947</td><td>1</td><td>2026-03-04 22:40:25.489180</td><td>92.085</td><td>81.181889</td><td>99751215104</td><td>0.019525</td><td>&quot;BNP PARIBAS ACT.A&quot;</td><td>&quot;France&quot;</td><td>89.32</td><td>0.011437</td><td>-0.073156</td><td>0.105582</td><td>&quot;EUR&quot;</td><td>&quot;Q4&quot;</td></tr><tr><td>168</td><td>&quot;euro_stoxx_50&quot;</td><td>&quot;DTE.DE&quot;</td><td>2026-03-04</td><td>&quot;Communication Services&quot;</td><td>0.326587</td><td>0.387463</td><td>0.379532</td><td>-0.127867</td><td>0.241429</td><td>24</td><td>-0.205598</td><td>1.12065</td><td>1.112416</td><td>0.055524</td><td>0.685752</td><td>8</td><td>0.121212</td><td>1.33333</td><td>false</td><td>0.617835</td><td>10</td><td>0.515005</td><td>2</td><td>2026-03-04 22:40:25.489180</td><td>30.838</td><td>28.554556</td><td>164294311936</td><td>0.032159</td><td>&quot;DEUTSCHE TELEKOM AG&quot;</td><td>&quot;Germany&quot;</td><td>33.0</td><td>0.011649</td><td>-0.019608</td><td>0.193059</td><td>&quot;EUR&quot;</td><td>&quot;Q2&quot;</td></tr><tr><td>174</td><td>&quot;euro_stoxx_50&quot;</td><td>&quot;IFX.DE&quot;</td><td>2026-03-04</td><td>&quot;Technology&quot;</td><td>0.509398</td><td>0.637215</td><td>0.677068</td><td>-0.696662</td><td>0.281755</td><td>22</td><td>0.000965</td><td>1.048244</td><td>1.198626</td><td>0.088845</td><td>0.675764</td><td>9</td><td>0.126408</td><td>1.375</td><td>false</td><td>0.579187</td><td>11</td><td>0.512235</td><td>3</td><td>2026-03-04 22:40:25.489180</td><td>43.480333</td><td>38.855556</td><td>57222533120</td><td>0.011201</td><td>&quot;INFINEON TECHNOLOGIES AG&quot;</td><td>&quot;Germany&quot;</td><td>43.945</td><td>0.054343</td><td>-0.06649</td><td>0.164723</td><td>&quot;EUR&quot;</td><td>&quot;Q3&quot;</td></tr><tr><td>172</td><td>&quot;euro_stoxx_50&quot;</td><td>&quot;ENR.DE&quot;</td><td>2026-03-04</td><td>&quot;Industrials&quot;</td><td>-0.902738</td><td>-0.743338</td><td>-1.693212</td><td>-1.326075</td><td>-1.166341</td><td>46</td><td>1.645455</td><td>1.137007</td><td>1.474095</td><td>0.05185</td><td>2.541889</td><td>1</td><td>0.075269</td><td>1.8</td><td>false</td><td>-0.123264</td><td>29</td><td>0.417428</td><td>4</td><td>2026-03-04 22:40:25.489180</td><td>155.675</td><td>129.122</td><td>139207262208</td><td>0.027249</td><td>&quot;Siemens Energy AG&quot;</td><td>&quot;Germany&quot;</td><td>162.75</td><td>0.047297</td><td>-0.039256</td><td>0.351744</td><td>&quot;EUR&quot;</td><td>&quot;Q1&quot;</td></tr><tr><td>149</td><td>&quot;euro_stoxx_50&quot;</td><td>&quot;ABI.BR&quot;</td><td>2026-03-04</td><td>&quot;Consumer Defensive&quot;</td><td>0.474084</td><td>0.844075</td><td>0.552739</td><td>-0.975005</td><td>0.223973</td><td>25</td><td>-0.029791</td><td>1.058542</td><td>1.142783</td><td>0.063063</td><td>0.651891</td><td>10</td><td>0.186198</td><td>1.69231</td><td>false</td><td>0.344755</td><td>17</td><td>0.406873</td><td>5</td><td>2026-03-04 22:40:25.489180</td><td>64.342</td><td>57.869333</td><td>125566156800</td><td>0.024579</td><td>&quot;AB INBEV&quot;</td><td>&quot;Belgium&quot;</td><td>64.48</td><td>-0.017073</td><td>-0.040762</td><td>0.174499</td><td>&quot;EUR&quot;</td><td>&quot;Q2&quot;</td></tr></tbody></table></div>

```python
# Polars — z-score normalisation per symbol
scores_pl.with_columns(
    ((pl.col("pe_zscore") - pl.col("pe_zscore").mean().over("symbol"))
     / pl.col("pe_zscore").std().over("symbol")).alias("score_z")
).head(10)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 37)</small><table border="1" class="dataframe"><thead><tr><th>id</th><th>_index</th><th>symbol</th><th>score_date</th><th>sector</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>relative_value_rank</th><th>relative_strength</th><th>sma_50_ratio</th><th>sma_200_ratio</th><th>dist_from_52w_high</th><th>momentum_score</th><th>momentum_rank</th><th>implied_upside</th><th>recommendation_mean</th><th>price_falling_analysts_bullish</th><th>sentiment_score</th><th>sentiment_rank</th><th>composite_score</th><th>composite_rank</th><th>_scored_at</th><th>sma_30_close</th><th>sma_90_close</th><th>market_cap</th><th>index_weight</th><th>short_name</th><th>country</th><th>current_price</th><th>day_change_pct</th><th>five_day_change_pct</th><th>ytd_change_pct</th><th>currency</th><th>score_z</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>date</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td><td>f64</td><td>i64</td><td>f64</td><td>i64</td><td>datetime[ns]</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>str</td><td>f64</td></tr></thead><tbody><tr><td>163</td><td>&quot;euro_stoxx_50&quot;</td><td>&quot;BNP.PA&quot;</td><td>2026-03-04</td><td>&quot;Financial Services&quot;</td><td>0.913389</td><td>1.26114</td><td>null</td><td>2.388962</td><td>1.521163</td><td>1</td><td>0.016123</td><td>1.00909</td><td>1.130264</td><td>0.082486</td><td>0.477966</td><td>16</td><td>0.153157</td><td>1.84211</td><td>false</td><td>0.052711</td><td>25</td><td>0.683947</td><td>1</td><td>2026-03-04 22:40:25.489180</td><td>92.085</td><td>81.181889</td><td>99751215104</td><td>0.019525</td><td>&quot;BNP PARIBAS ACT.A&quot;</td><td>&quot;France&quot;</td><td>89.32</td><td>0.011437</td><td>-0.073156</td><td>0.105582</td><td>&quot;EUR&quot;</td><td>1.151369</td></tr><tr><td>168</td><td>&quot;euro_stoxx_50&quot;</td><td>&quot;DTE.DE&quot;</td><td>2026-03-04</td><td>&quot;Communication Services&quot;</td><td>0.326587</td><td>0.387463</td><td>0.379532</td><td>-0.127867</td><td>0.241429</td><td>24</td><td>-0.205598</td><td>1.12065</td><td>1.112416</td><td>0.055524</td><td>0.685752</td><td>8</td><td>0.121212</td><td>1.33333</td><td>false</td><td>0.617835</td><td>10</td><td>0.515005</td><td>2</td><td>2026-03-04 22:40:25.489180</td><td>30.838</td><td>28.554556</td><td>164294311936</td><td>0.032159</td><td>&quot;DEUTSCHE TELEKOM AG&quot;</td><td>&quot;Germany&quot;</td><td>33.0</td><td>0.011649</td><td>-0.019608</td><td>0.193059</td><td>&quot;EUR&quot;</td><td>1.146083</td></tr><tr><td>174</td><td>&quot;euro_stoxx_50&quot;</td><td>&quot;IFX.DE&quot;</td><td>2026-03-04</td><td>&quot;Technology&quot;</td><td>0.509398</td><td>0.637215</td><td>0.677068</td><td>-0.696662</td><td>0.281755</td><td>22</td><td>0.000965</td><td>1.048244</td><td>1.198626</td><td>0.088845</td><td>0.675764</td><td>9</td><td>0.126408</td><td>1.375</td><td>false</td><td>0.579187</td><td>11</td><td>0.512235</td><td>3</td><td>2026-03-04 22:40:25.489180</td><td>43.480333</td><td>38.855556</td><td>57222533120</td><td>0.011201</td><td>&quot;INFINEON TECHNOLOGIES AG&quot;</td><td>&quot;Germany&quot;</td><td>43.945</td><td>0.054343</td><td>-0.06649</td><td>0.164723</td><td>&quot;EUR&quot;</td><td>1.017897</td></tr><tr><td>172</td><td>&quot;euro_stoxx_50&quot;</td><td>&quot;ENR.DE&quot;</td><td>2026-03-04</td><td>&quot;Industrials&quot;</td><td>-0.902738</td><td>-0.743338</td><td>-1.693212</td><td>-1.326075</td><td>-1.166341</td><td>46</td><td>1.645455</td><td>1.137007</td><td>1.474095</td><td>0.05185</td><td>2.541889</td><td>1</td><td>0.075269</td><td>1.8</td><td>false</td><td>-0.123264</td><td>29</td><td>0.417428</td><td>4</td><td>2026-03-04 22:40:25.489180</td><td>155.675</td><td>129.122</td><td>139207262208</td><td>0.027249</td><td>&quot;Siemens Energy AG&quot;</td><td>&quot;Germany&quot;</td><td>162.75</td><td>0.047297</td><td>-0.039256</td><td>0.351744</td><td>&quot;EUR&quot;</td><td>0.340213</td></tr><tr><td>149</td><td>&quot;euro_stoxx_50&quot;</td><td>&quot;ABI.BR&quot;</td><td>2026-03-04</td><td>&quot;Consumer Defensive&quot;</td><td>0.474084</td><td>0.844075</td><td>0.552739</td><td>-0.975005</td><td>0.223973</td><td>25</td><td>-0.029791</td><td>1.058542</td><td>1.142783</td><td>0.063063</td><td>0.651891</td><td>10</td><td>0.186198</td><td>1.69231</td><td>false</td><td>0.344755</td><td>17</td><td>0.406873</td><td>5</td><td>2026-03-04 22:40:25.489180</td><td>64.342</td><td>57.869333</td><td>125566156800</td><td>0.024579</td><td>&quot;AB INBEV&quot;</td><td>&quot;Belgium&quot;</td><td>64.48</td><td>-0.017073</td><td>-0.040762</td><td>0.174499</td><td>&quot;EUR&quot;</td><td>-1.152299</td></tr><tr><td>196</td><td>&quot;euro_stoxx_50&quot;</td><td>&quot;VOW.DE&quot;</td><td>2026-03-04</td><td>&quot;Consumer Cyclical&quot;</td><td>1.166221</td><td>0.940273</td><td>0.37983</td><td>1.528891</td><td>1.003804</td><td>2</td><td>-0.292748</td><td>0.929392</td><td>0.969628</td><td>0.180805</td><td>-0.411969</td><td>37</td><td>0.297071</td><td>null</td><td>false</td><td>0.555357</td><td>12</td><td>0.382397</td><td>6</td><td>2026-03-04 22:40:25.489180</td><td>102.286667</td><td>101.225556</td><td>47923826688</td><td>0.009381</td><td>&quot;VOLKSWAGEN AG&quot;</td><td>&quot;Germany&quot;</td><td>95.6</td><td>0.013786</td><td>-0.048756</td><td>-0.09039</td><td>&quot;EUR&quot;</td><td>-0.590923</td></tr><tr><td>194</td><td>&quot;euro_stoxx_50&quot;</td><td>&quot;TTE.PA&quot;</td><td>2026-03-04</td><td>&quot;Energy&quot;</td><td>0.691106</td><td>0.609377</td><td>0.44961</td><td>0.731948</td><td>0.62051</td><td>12</td><td>0.0498</td><td>1.109161</td><td>1.212503</td><td>0.08411</td><td>0.919444</td><td>5</td><td>0.041131</td><td>2.04545</td><td>false</td><td>-0.542576</td><td>35</td><td>0.332459</td><td>7</td><td>2026-03-04 22:40:25.489180</td><td>63.603</td><td>58.231667</td><td>142003961856</td><td>0.027796</td><td>&quot;TOTALENERGIES&quot;</td><td>&quot;France&quot;</td><td>66.86</td><td>-0.018209</td><td>-0.00757</td><td>0.202734</td><td>&quot;EUR&quot;</td><td>1.114951</td></tr><tr><td>166</td><td>&quot;euro_stoxx_50&quot;</td><td>&quot;DG.PA&quot;</td><td>2026-03-04</td><td>&quot;Industrials&quot;</td><td>0.778573</td><td>0.850985</td><td>0.928797</td><td>1.146268</td><td>0.926156</td><td>3</td><td>-0.031697</td><td>1.064353</td><td>1.095809</td><td>0.062871</td><td>0.59582</td><td>11</td><td>0.043608</td><td>2.04762</td><td>false</td><td>-0.538059</td><td>34</td><td>0.327972</td><td>8</td><td>2026-03-04 22:40:25.489180</td><td>131.013333</td><td>123.067778</td><td>74446422016</td><td>0.014572</td><td>&quot;VINCI&quot;</td><td>&quot;France&quot;</td><td>134.15</td><td>0.006754</td><td>-0.054283</td><td>0.117451</td><td>&quot;EUR&quot;</td><td>-0.51532</td></tr><tr><td>188</td><td>&quot;euro_stoxx_50&quot;</td><td>&quot;SAN.MC&quot;</td><td>2026-03-04</td><td>&quot;Financial Services&quot;</td><td>0.458599</td><td>0.499398</td><td>null</td><td>-1.10759</td><td>-0.049864</td><td>33</td><td>0.393197</td><td>0.953824</td><td>1.139519</td><td>0.113499</td><td>0.519307</td><td>14</td><td>0.224704</td><td>1.7</td><td>false</td><td>0.448776</td><td>15</td><td>0.306073</td><td>9</td><td>2026-03-04 22:40:25.489180</td><td>10.6049</td><td>9.9195</td><td>145955749888</td><td>0.02857</td><td>&quot;BANCO SANTANDER S.A.&quot;</td><td>&quot;Spain&quot;</td><td>9.982</td><td>0.038818</td><td>-0.105876</td><td>-0.008739</td><td>&quot;EUR&quot;</td><td>-0.927419</td></tr><tr><td>193</td><td>&quot;euro_stoxx_50&quot;</td><td>&quot;SU.PA&quot;</td><td>2026-03-04</td><td>&quot;Industrials&quot;</td><td>-0.175048</td><td>0.278256</td><td>-0.060732</td><td>-0.419549</td><td>-0.094268</td><td>34</td><td>-0.045547</td><td>1.049116</td><td>1.102466</td><td>0.078557</td><td>0.519908</td><td>13</td><td>0.141252</td><td>1.47826</td><td>false</td><td>0.48924</td><td>14</td><td>0.30496</td><td>10</td><td>2026-03-04 22:40:25.489180</td><td>253.745</td><td>241.719444</td><td>145081614336</td><td>0.028399</td><td>&quot;SCHNEIDER ELECTRIC SE&quot;</td><td>&quot;France&quot;</td><td>258.05</td><td>0.017748</td><td>-0.026043</td><td>0.098553</td><td>&quot;EUR&quot;</td><td>0.608136</td></tr></tbody></table></div>

---
## Comparison Table — Creating & Transforming Columns

```python
comparison = r"""
| Operation                     | Pandas                                          | Polars                                           |
|:------------------------------|:-------------------------------------------------|:-------------------------------------------------|
| Add column (mutate)           | `df["new"] = expr`                               | `df.with_columns(expr.alias("new"))`              |
| Chainable add                 | `df.assign(new=lambda d: …)`                     | `df.with_columns(…)`                              |
| Select + rename               | `df[["a","b"]].rename(columns=…)`                | `df.select(pl.col("a"), expr.alias("b"))`         |
| Element-wise apply            | `s.apply(fn)` / `s.map(fn)`                      | `col.map_elements(fn, return_dtype=…)`            |
| Row-wise apply                | `df.apply(fn, axis=1)`                            | *(prefer expressions)* `map_rows(fn)`             |
| Batch UDF (NumPy)             | vectorised by default                             | `col.map_batches(fn, return_dtype=…)`             |
| Binary conditional            | `np.where(cond, a, b)`                            | `when(cond).then(a).otherwise(b)`                 |
| Multi-way conditional         | `np.select([c1,c2], [v1,v2], default=…)`          | chained `when(c1).then(v1).when(c2)…`             |
| Cast type                     | `s.astype("float64")`                             | `col.cast(pl.Float64)`                            |
| Cast many cols                | `df.astype({"a": float, …})`                     | `cs.numeric().cast(pl.Float32)`                   |
| String — upper / lower        | `s.str.upper()`                                   | `col.str.to_uppercase()`                          |
| String — split + extract      | `s.str.split(".").str[0]`                         | `col.str.split(".").list.first()`                 |
| String — replace              | `s.str.replace("x","y")`                          | `col.str.replace("x","y")`                        |
| Datetime — extract part       | `s.dt.year`                                       | `col.dt.year()`                                   |
| Datetime — arithmetic         | `s + pd.Timedelta("7d")`                          | `col + pl.duration(days=7)`                       |
| Log / sqrt / abs              | `np.log(s)`                                       | `col.log()` / `col.sqrt()` / `col.abs()`          |
| Pct change (grouped)          | `df.groupby("g")["c"].pct_change()`               | `col.pct_change().over("g")`                      |
| Cumulative sum (grouped)      | `df.groupby("g")["c"].cumsum()`                   | `col.cum_sum().over("g")`                         |
| Round / clip                  | `s.round(2)` / `s.clip(lo, hi)`                   | `col.round(2)` / `col.clip(lo, hi)`               |
| Tweak function                | `def tweak(df): return df.assign(…)`              | `def tweak(df): return df.with_columns(…)`        |
"""
display(Markdown(comparison))
```

| Operation                     | Pandas                                          | Polars                                           |
|:------------------------------|:-------------------------------------------------|:-------------------------------------------------|
| Add column (mutate)           | `df["new"] = expr`                               | `df.with_columns(expr.alias("new"))`              |
| Chainable add                 | `df.assign(new=lambda d: …)`                     | `df.with_columns(…)`                              |
| Select + rename               | `df[["a","b"]].rename(columns=…)`                | `df.select(pl.col("a"), expr.alias("b"))`         |
| Element-wise apply            | `s.apply(fn)` / `s.map(fn)`                      | `col.map_elements(fn, return_dtype=…)`            |
| Row-wise apply                | `df.apply(fn, axis=1)`                            | *(prefer expressions)* `map_rows(fn)`             |
| Batch UDF (NumPy)             | vectorised by default                             | `col.map_batches(fn, return_dtype=…)`             |
| Binary conditional            | `np.where(cond, a, b)`                            | `when(cond).then(a).otherwise(b)`                 |
| Multi-way conditional         | `np.select([c1,c2], [v1,v2], default=…)`          | chained `when(c1).then(v1).when(c2)…`             |
| Cast type                     | `s.astype("float64")`                             | `col.cast(pl.Float64)`                            |
| Cast many cols                | `df.astype({"a": float, …})`                     | `cs.numeric().cast(pl.Float32)`                   |
| String — upper / lower        | `s.str.upper()`                                   | `col.str.to_uppercase()`                          |
| String — split + extract      | `s.str.split(".").str[0]`                         | `col.str.split(".").list.first()`                 |
| String — replace              | `s.str.replace("x","y")`                          | `col.str.replace("x","y")`                        |
| Datetime — extract part       | `s.dt.year`                                       | `col.dt.year()`                                   |
| Datetime — arithmetic         | `s + pd.Timedelta("7d")`                          | `col + pl.duration(days=7)`                       |
| Log / sqrt / abs              | `np.log(s)`                                       | `col.log()` / `col.sqrt()` / `col.abs()`          |
| Pct change (grouped)          | `df.groupby("g")["c"].pct_change()`               | `col.pct_change().over("g")`                      |
| Cumulative sum (grouped)      | `df.groupby("g")["c"].cumsum()`                   | `col.cum_sum().over("g")`                         |
| Round / clip                  | `s.round(2)` / `s.clip(lo, hi)`                   | `col.round(2)` / `col.clip(lo, hi)`               |
| Tweak function                | `def tweak(df): return df.assign(…)`              | `def tweak(df): return df.with_columns(…)`        |

---
# Part 2: Polars Expressions Deep Dive

## What Is an Expression?

- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

```python
expr = pl.col("close") * 2
print(f"Type: {type(expr)}")
print(f"Repr: {expr}")
```

    Type: <class 'polars.expr.expr.Expr'>
    Repr: [(col("close")) * (dyn int: 2)]

## Expression Contexts

- **Select**: Choose specific columns, optionally transforming them.
- **Head**: Return the first N rows.

```python
ohlcv_pl.select("symbol", "date", "close").head(5)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 3)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.4</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>57.86</td></tr></tbody></table></div>

```python
ohlcv_pl.select(
    "symbol", "date",
    pl.col("close").round(2).alias("close_rounded"),
    (pl.col("high") - pl.col("low")).alias("daily_range"),
).head(5)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 4)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close_rounded</th><th>daily_range</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>2.07</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td><td>1.23</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td><td>1.55</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.4</td><td>0.98</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>57.86</td><td>0.97</td></tr></tbody></table></div>

### with_columns

- **Select**: Choose specific columns, optionally transforming them.
- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **Head**: Return the first N rows.

```python
ohlcv_pl.with_columns(
    (pl.col("close") - pl.col("open")).alias("price_change"),
    ((pl.col("close") - pl.col("open")) / pl.col("open") * 100).round(2).alias("pct_change"),
).select("symbol", "date", "close", "open", "price_change", "pct_change").head(5)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 6)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th><th>open</th><th>price_change</th><th>pct_change</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>58.15</td><td>-0.94</td><td>-1.62</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td><td>56.9</td><td>0.28</td><td>0.49</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td><td>57.96</td><td>0.81</td><td>1.4</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.4</td><td>58.68</td><td>-0.28</td><td>-0.48</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>57.86</td><td>58.16</td><td>-0.3</td><td>-0.52</td></tr></tbody></table></div>

### filter


- **Filter**: Keep only rows matching a condition.
- **Select**: Choose specific columns, optionally transforming them.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **Head**: Return the first N rows.

```python
ohlcv_pl.filter(
    (pl.col("symbol") == "ASML.AS") & (pl.col("close") > 900)
).select("symbol", "date", "close").head(5)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 3)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2024-03-04</td><td>913.2</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2024-03-06</td><td>912.2</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2024-03-07</td><td>949.2</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2024-03-08</td><td>923.4</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2024-03-21</td><td>923.3</td></tr></tbody></table></div>

### group_by.agg


- **Group By**: Split rows into groups by one or more columns, then apply aggregate functions to each group independently.
- **Aggregation**: Compute summary statistics (mean, sum, count, min, max) for each group. Returns one row per group.
- **Sort**: Reorder rows by column values.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

```python
ohlcv_pl.group_by("symbol").agg(
    pl.col("close").mean().round(2).alias("avg_close"),
    pl.col("volume").sum().alias("total_volume"),
    pl.col("date").max().alias("last_date"),
).sort("avg_close", descending=True).head(10)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 4)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>avg_close</th><th>total_volume</th><th>last_date</th></tr><tr><td>str</td><td>f64</td><td>i64</td><td>date</td></tr></thead><tbody><tr><td>&quot;RMS.PA&quot;</td><td>1761.56</td><td>81633862</td><td>2026-03-12</td></tr><tr><td>&quot;ADYEN.AS&quot;</td><td>1545.98</td><td>110400463</td><td>2026-03-12</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>671.35</td><td>945070720</td><td>2026-03-12</td></tr><tr><td>&quot;MC.PA&quot;</td><td>662.4</td><td>557855567</td><td>2026-03-12</td></tr><tr><td>&quot;RHM.DE&quot;</td><td>544.66</td><td>308359744</td><td>2026-03-12</td></tr><tr><td>&quot;ARGX.BR&quot;</td><td>413.69</td><td>94592244</td><td>2026-03-12</td></tr><tr><td>&quot;OR.PA&quot;</td><td>377.54</td><td>484115375</td><td>2026-03-12</td></tr><tr><td>&quot;MUV2.DE&quot;</td><td>374.66</td><td>398802950</td><td>2026-03-12</td></tr><tr><td>&quot;RACE.MI&quot;</td><td>289.75</td><td>476686026</td><td>2026-03-12</td></tr><tr><td>&quot;ALV.DE&quot;</td><td>252.19</td><td>1101960308</td><td>2026-03-12</td></tr></tbody></table></div>

## Column Expressions


- **Select**: Choose specific columns, optionally transforming them.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **Head**: Return the first N rows.

```python
ohlcv_pl.select(pl.col("symbol", "date", "close")).head(3)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (3, 3)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td></tr></tbody></table></div>

```python
# Regex
ohlcv_pl.select(pl.col("^(open|high|low|close)$")).head(3)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (3, 4)</small><table border="1" class="dataframe"><thead><tr><th>open</th><th>high</th><th>low</th><th>close</th></tr><tr><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td></tr><tr><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td></tr><tr><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td></tr></tbody></table></div>

### pl.all, pl.exclude


- **Select**: Choose specific columns, optionally transforming them.
- **Head**: Return the first N rows.

```python
ohlcv_pl.select(pl.exclude("id", "dividends", "stock_splits", "is_filled")).head(3)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (3, 8)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td></tr></tbody></table></div>

### pl.lit


- **Select**: Choose specific columns, optionally transforming them.
- **pl.lit**: Create a constant/literal value as an expression.
- **Head**: Return the first N rows.
- **Alias**: Give an expression result a column name (Polars).

```python
ohlcv_pl.select("symbol", "date", pl.lit("EUR").alias("currency"), pl.lit(1.0).alias("weight")).head(3)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (3, 4)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>currency</th><th>weight</th></tr><tr><td>str</td><td>date</td><td>str</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>&quot;EUR&quot;</td><td>1.0</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>&quot;EUR&quot;</td><td>1.0</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>&quot;EUR&quot;</td><td>1.0</td></tr></tbody></table></div>

### pl.first, pl.last


- **Select**: Choose specific columns, optionally transforming them.
- **Alias**: Give an expression result a column name (Polars).

```python
ohlcv_pl.select(pl.first("symbol"), pl.first("date").alias("first_date"), pl.last("date").alias("last_date"))
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (1, 3)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>first_date</th><th>last_date</th></tr><tr><td>str</td><td>date</td><td>date</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>2026-03-12</td></tr></tbody></table></div>

## Continuing Expressions


- **Select**: Choose specific columns, optionally transforming them.
- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **Head**: Return the first N rows.

```python
ohlcv_pl.select(
    pl.col("close").cast(pl.Float64).round(2).alias("rounded_close"),
    pl.col("symbol").str.to_lowercase().str.replace(".as", "").alias("clean_symbol"),
).head(5)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 2)</small><table border="1" class="dataframe"><thead><tr><th>rounded_close</th><th>clean_symbol</th></tr><tr><td>f64</td><td>str</td></tr></thead><tbody><tr><td>57.21</td><td>&quot;abi.br&quot;</td></tr><tr><td>57.18</td><td>&quot;abi.br&quot;</td></tr><tr><td>58.77</td><td>&quot;abi.br&quot;</td></tr><tr><td>58.4</td><td>&quot;abi.br&quot;</td></tr><tr><td>57.86</td><td>&quot;abi.br&quot;</td></tr></tbody></table></div>

## Horizontal Expressions


- **Select**: Choose specific columns, optionally transforming them.
- **Sum Horizontal**: Sum values across columns (row-wise), not down a column.
- **Head**: Return the first N rows.
- **Alias**: Give an expression result a column name (Polars).

```python
scores_pl.select(
    "symbol",
    pl.sum_horizontal("pe_zscore", "pb_zscore").round(4).alias("combined_value"),
).head(5)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 2)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>combined_value</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>&quot;BNP.PA&quot;</td><td>2.1745</td></tr><tr><td>&quot;DTE.DE&quot;</td><td>0.7141</td></tr><tr><td>&quot;IFX.DE&quot;</td><td>1.1466</td></tr><tr><td>&quot;ENR.DE&quot;</td><td>-1.6461</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>1.3182</td></tr></tbody></table></div>

```python
scores_pl.select(
    "symbol",
    pl.mean_horizontal("relative_value_score", "momentum_score", "sentiment_score").round(4).alias("avg_factor"),
).head(5)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 2)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>avg_factor</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>&quot;BNP.PA&quot;</td><td>0.6839</td></tr><tr><td>&quot;DTE.DE&quot;</td><td>0.515</td></tr><tr><td>&quot;IFX.DE&quot;</td><td>0.5122</td></tr><tr><td>&quot;ENR.DE&quot;</td><td>0.4174</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>0.4069</td></tr></tbody></table></div>

```python
dim_pl.select(
    pl.concat_str("short_name", pl.lit(" ("), "country", pl.lit(")")).alias("display_name"),
).head(5)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 1)</small><table border="1" class="dataframe"><thead><tr><th>display_name</th></tr><tr><td>str</td></tr></thead><tbody><tr><td>&quot;ASML HOLDING (Netherlands)&quot;</td></tr><tr><td>&quot;LVMH (France)&quot;</td></tr><tr><td>&quot;HERMES INTL (France)&quot;</td></tr><tr><td>&quot;L&#x27;OREAL (France)&quot;</td></tr><tr><td>&quot;SAP SE (Germany)&quot;</td></tr></tbody></table></div>

## Window Expressions — .over()


- **Window (.over)**: Compute a value per row based on its group, without collapsing rows. Like SQL OVER(PARTITION BY).
- **Rank**: Assign a rank number to each row within its group, ordered by a column.
- **Filter**: Keep only rows matching a condition.
- **Select**: Choose specific columns, optionally transforming them.

```python
ohlcv_pl.filter(pl.col("symbol").is_in(["ASML.AS", "MC.PA"])).with_columns(
    pl.col("close").rank(descending=True).over("symbol").alias("price_rank"),
    pl.col("close").mean().over("symbol").round(2).alias("avg_close"),
).select("symbol", "date", "close", "price_rank", "avg_close").head(10)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 5)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th><th>price_rank</th><th>avg_close</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-04</td><td>406.25</td><td>1326.0</td><td>671.35</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-05</td><td>406.9</td><td>1325.0</td><td>671.35</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-06</td><td>402.85</td><td>1329.0</td><td>671.35</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-07</td><td>403.9</td><td>1327.0</td><td>671.35</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-08</td><td>416.05</td><td>1319.0</td><td>671.35</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-11</td><td>414.9</td><td>1320.5</td><td>671.35</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-12</td><td>418.95</td><td>1318.0</td><td>671.35</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-13</td><td>422.45</td><td>1316.0</td><td>671.35</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-14</td><td>447.35</td><td>1288.0</td><td>671.35</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-15</td><td>435.85</td><td>1307.0</td><td>671.35</td></tr></tbody></table></div>

```python
ohlcv_pl.filter(pl.col("symbol") == "ASML.AS").sort("date").with_columns(
    pl.col("volume").cum_sum().over("symbol").alias("cumulative_volume"),
).select("symbol", "date", "volume", "cumulative_volume").tail(10)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 4)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>volume</th><th>cumulative_volume</th></tr><tr><td>str</td><td>date</td><td>i64</td><td>i64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2026-02-27</td><td>1010698</td><td>938726541</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-02</td><td>871267</td><td>939597808</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-03</td><td>941945</td><td>940539753</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-04</td><td>714587</td><td>941254340</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-05</td><td>778081</td><td>942032421</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-06</td><td>857271</td><td>942889692</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-09</td><td>689086</td><td>943578778</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-10</td><td>800815</td><td>944379593</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-11</td><td>562904</td><td>944942497</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-12</td><td>128223</td><td>945070720</td></tr></tbody></table></div>

## Expression Arithmetic


- **Select**: Choose specific columns, optionally transforming them.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **Head**: Return the first N rows.
- **Alias**: Give an expression result a column name (Polars).

```python
ohlcv_pl.select(
    "symbol", "date",
    ((pl.col("close") + pl.col("open")) / 2).alias("mid_price"),
    (pl.col("high") - pl.col("low")).alias("range"),
    (pl.col("close") > pl.col("open")).alias("green_candle"),
).head(5)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 5)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>mid_price</th><th>range</th><th>green_candle</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.68</td><td>2.07</td><td>false</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.04</td><td>1.23</td><td>true</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.365</td><td>1.55</td><td>true</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.54</td><td>0.98</td><td>false</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>58.01</td><td>0.97</td><td>false</td></tr></tbody></table></div>

## Folds


- **Select**: Choose specific columns, optionally transforming them.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **pl.lit**: Create a constant/literal value as an expression.
- **Fold**: Reduce across columns by applying a function cumulatively.

```python
scores_pl.select(
    "symbol",
    pl.fold(
        acc=pl.lit(0.0),
        function=lambda acc, col: acc + col,
        exprs=[pl.col("pe_zscore"), pl.col("pb_zscore")],
    ).alias("sum_zscores"),
).head(5)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 2)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>sum_zscores</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>&quot;BNP.PA&quot;</td><td>2.174528</td></tr><tr><td>&quot;DTE.DE&quot;</td><td>0.71405</td></tr><tr><td>&quot;IFX.DE&quot;</td><td>1.146613</td></tr><tr><td>&quot;ENR.DE&quot;</td><td>-1.646076</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>1.318159</td></tr></tbody></table></div>

## Selectors (cs module)


- **Select**: Choose specific columns, optionally transforming them.
- **Head**: Return the first N rows.
- **Selector: Numeric**: Select all numeric columns (Polars selectors module).

```python
scores_pl.select(cs.numeric()).head(3)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (3, 27)</small><table border="1" class="dataframe"><thead><tr><th>id</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>relative_value_rank</th><th>relative_strength</th><th>sma_50_ratio</th><th>sma_200_ratio</th><th>dist_from_52w_high</th><th>momentum_score</th><th>momentum_rank</th><th>implied_upside</th><th>recommendation_mean</th><th>sentiment_score</th><th>sentiment_rank</th><th>composite_score</th><th>composite_rank</th><th>sma_30_close</th><th>sma_90_close</th><th>market_cap</th><th>index_weight</th><th>current_price</th><th>day_change_pct</th><th>five_day_change_pct</th><th>ytd_change_pct</th></tr><tr><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>163</td><td>0.913389</td><td>1.26114</td><td>null</td><td>2.388962</td><td>1.521163</td><td>1</td><td>0.016123</td><td>1.00909</td><td>1.130264</td><td>0.082486</td><td>0.477966</td><td>16</td><td>0.153157</td><td>1.84211</td><td>0.052711</td><td>25</td><td>0.683947</td><td>1</td><td>92.085</td><td>81.181889</td><td>99751215104</td><td>0.019525</td><td>89.32</td><td>0.011437</td><td>-0.073156</td><td>0.105582</td></tr><tr><td>168</td><td>0.326587</td><td>0.387463</td><td>0.379532</td><td>-0.127867</td><td>0.241429</td><td>24</td><td>-0.205598</td><td>1.12065</td><td>1.112416</td><td>0.055524</td><td>0.685752</td><td>8</td><td>0.121212</td><td>1.33333</td><td>0.617835</td><td>10</td><td>0.515005</td><td>2</td><td>30.838</td><td>28.554556</td><td>164294311936</td><td>0.032159</td><td>33.0</td><td>0.011649</td><td>-0.019608</td><td>0.193059</td></tr><tr><td>174</td><td>0.509398</td><td>0.637215</td><td>0.677068</td><td>-0.696662</td><td>0.281755</td><td>22</td><td>0.000965</td><td>1.048244</td><td>1.198626</td><td>0.088845</td><td>0.675764</td><td>9</td><td>0.126408</td><td>1.375</td><td>0.579187</td><td>11</td><td>0.512235</td><td>3</td><td>43.480333</td><td>38.855556</td><td>57222533120</td><td>0.011201</td><td>43.945</td><td>0.054343</td><td>-0.06649</td><td>0.164723</td></tr></tbody></table></div>

```python
scores_pl.select(cs.by_name("symbol", "score_date") | cs.float()).head(3)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (3, 23)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>score_date</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>relative_strength</th><th>sma_50_ratio</th><th>sma_200_ratio</th><th>dist_from_52w_high</th><th>momentum_score</th><th>implied_upside</th><th>recommendation_mean</th><th>sentiment_score</th><th>composite_score</th><th>sma_30_close</th><th>sma_90_close</th><th>index_weight</th><th>current_price</th><th>day_change_pct</th><th>five_day_change_pct</th><th>ytd_change_pct</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;BNP.PA&quot;</td><td>2026-03-04</td><td>0.913389</td><td>1.26114</td><td>null</td><td>2.388962</td><td>1.521163</td><td>0.016123</td><td>1.00909</td><td>1.130264</td><td>0.082486</td><td>0.477966</td><td>0.153157</td><td>1.84211</td><td>0.052711</td><td>0.683947</td><td>92.085</td><td>81.181889</td><td>0.019525</td><td>89.32</td><td>0.011437</td><td>-0.073156</td><td>0.105582</td></tr><tr><td>&quot;DTE.DE&quot;</td><td>2026-03-04</td><td>0.326587</td><td>0.387463</td><td>0.379532</td><td>-0.127867</td><td>0.241429</td><td>-0.205598</td><td>1.12065</td><td>1.112416</td><td>0.055524</td><td>0.685752</td><td>0.121212</td><td>1.33333</td><td>0.617835</td><td>0.515005</td><td>30.838</td><td>28.554556</td><td>0.032159</td><td>33.0</td><td>0.011649</td><td>-0.019608</td><td>0.193059</td></tr><tr><td>&quot;IFX.DE&quot;</td><td>2026-03-04</td><td>0.509398</td><td>0.637215</td><td>0.677068</td><td>-0.696662</td><td>0.281755</td><td>0.000965</td><td>1.048244</td><td>1.198626</td><td>0.088845</td><td>0.675764</td><td>0.126408</td><td>1.375</td><td>0.579187</td><td>0.512235</td><td>43.480333</td><td>38.855556</td><td>0.011201</td><td>43.945</td><td>0.054343</td><td>-0.06649</td><td>0.164723</td></tr></tbody></table></div>

```python
scores_pl.select(cs.contains("score")).head(3)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (3, 10)</small><table border="1" class="dataframe"><thead><tr><th>score_date</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>momentum_score</th><th>sentiment_score</th><th>composite_score</th><th>_scored_at</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>datetime[ns]</td></tr></thead><tbody><tr><td>2026-03-04</td><td>0.913389</td><td>1.26114</td><td>null</td><td>2.388962</td><td>1.521163</td><td>0.477966</td><td>0.052711</td><td>0.683947</td><td>2026-03-04 22:40:25.489180</td></tr><tr><td>2026-03-04</td><td>0.326587</td><td>0.387463</td><td>0.379532</td><td>-0.127867</td><td>0.241429</td><td>0.685752</td><td>0.617835</td><td>0.515005</td><td>2026-03-04 22:40:25.489180</td></tr><tr><td>2026-03-04</td><td>0.509398</td><td>0.637215</td><td>0.677068</td><td>-0.696662</td><td>0.281755</td><td>0.675764</td><td>0.579187</td><td>0.512235</td><td>2026-03-04 22:40:25.489180</td></tr></tbody></table></div>

## Summary

| Concept | Polars | Pandas Equivalent |
|---|---|---|
| Expression | pl.col("x") * 2 | No equivalent |
| select | df.select(...) | df[[cols]] |
| with_columns | df.with_columns(...) | df.assign(...) |
| filter | df.filter(expr) | df[condition] |
| group_by.agg | df.group_by().agg(exprs) | df.groupby().agg() |
| .over() | expr.over("col") | groupby().transform() |
| Horizontal | pl.sum_horizontal(...) | df[cols].sum(axis=1) |
| Folds | pl.fold(...) | df.apply(axis=1) |
| Selectors | cs.numeric() | df.select_dtypes() |

---
# Part 3: Method Chaining & Pipes

## Imperative vs Chained Style

Imperative code mutates step by step; chained (declarative) code reads as a pipeline.

### Pandas — unchained (imperative)

```python
df = ohlcv_pd[ohlcv_pd["symbol"] == "ASML.AS"].copy()
df["daily_return"] = (df["close"] - df["open"]) / df["open"] * 100
df = df.sort_values("date", ascending=False)
display(df[["symbol", "date", "close", "daily_return"]].head(10))
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>close</th>
      <th>daily_return</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>11964</th>
      <td>ASML.AS</td>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>-0.334784</td>
    </tr>
    <tr>
      <th>11963</th>
      <td>ASML.AS</td>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>0.875126</td>
    </tr>
    <tr>
      <th>11962</th>
      <td>ASML.AS</td>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>0.976102</td>
    </tr>
    <tr>
      <th>11961</th>
      <td>ASML.AS</td>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>7.052239</td>
    </tr>
    <tr>
      <th>11960</th>
      <td>ASML.AS</td>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>-3.288364</td>
    </tr>
    <tr>
      <th>11959</th>
      <td>ASML.AS</td>
      <td>2026-03-05</td>
      <td>1186.0</td>
      <td>-1.051226</td>
    </tr>
    <tr>
      <th>11958</th>
      <td>ASML.AS</td>
      <td>2026-03-04</td>
      <td>1199.8</td>
      <td>2.459436</td>
    </tr>
    <tr>
      <th>11957</th>
      <td>ASML.AS</td>
      <td>2026-03-03</td>
      <td>1161.8</td>
      <td>-2.090005</td>
    </tr>
    <tr>
      <th>11956</th>
      <td>ASML.AS</td>
      <td>2026-03-02</td>
      <td>1210.4</td>
      <td>1.475520</td>
    </tr>
    <tr>
      <th>11955</th>
      <td>ASML.AS</td>
      <td>2026-02-27</td>
      <td>1233.4</td>
      <td>-0.113379</td>
    </tr>
  </tbody>
</table>

### Pandas — chained (declarative)

```python
result_pd = (
    ohlcv_pd
    .query("symbol == 'ASML.AS'")
    .assign(daily_return=lambda d: ((d["close"] - d["open"]) / d["open"] * 100).round(2))
    .sort_values("date", ascending=False)
    .head(10)
    [["symbol", "date", "close", "daily_return"]])
display(result_pd)
```

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
      <th>symbol</th>
      <th>date</th>
      <th>close</th>
      <th>daily_return</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>11964</th>
      <td>ASML.AS</td>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>-0.33</td>
    </tr>
    <tr>
      <th>11963</th>
      <td>ASML.AS</td>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>0.88</td>
    </tr>
    <tr>
      <th>11962</th>
      <td>ASML.AS</td>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>0.98</td>
    </tr>
    <tr>
      <th>11961</th>
      <td>ASML.AS</td>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>7.05</td>
    </tr>
    <tr>
      <th>11960</th>
      <td>ASML.AS</td>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>-3.29</td>
    </tr>
    <tr>
      <th>11959</th>
      <td>ASML.AS</td>
      <td>2026-03-05</td>
      <td>1186.0</td>
      <td>-1.05</td>
    </tr>
    <tr>
      <th>11958</th>
      <td>ASML.AS</td>
      <td>2026-03-04</td>
      <td>1199.8</td>
      <td>2.46</td>
    </tr>
    <tr>
      <th>11957</th>
      <td>ASML.AS</td>
      <td>2026-03-03</td>
      <td>1161.8</td>
      <td>-2.09</td>
    </tr>
    <tr>
      <th>11956</th>
      <td>ASML.AS</td>
      <td>2026-03-02</td>
      <td>1210.4</td>
      <td>1.48</td>
    </tr>
    <tr>
      <th>11955</th>
      <td>ASML.AS</td>
      <td>2026-02-27</td>
      <td>1233.4</td>
      <td>-0.11</td>
    </tr>
  </tbody>
</table>
</div>

### Polars — natural chaining

```python
result_pl = (
    ohlcv_pl
    .filter(pl.col("symbol") == "ASML.AS")
    .with_columns(
        ((pl.col("close") - pl.col("open")) / pl.col("open") * 100).round(2).alias("daily_return")
    )
    .sort("date", descending=True)
    .head(10)
    .select("symbol", "date", "close", "daily_return")
)
display(result_pl)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 4)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th><th>daily_return</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-12</td><td>1190.8</td><td>-0.33</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-11</td><td>1198.8</td><td>0.88</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-10</td><td>1200.0</td><td>0.98</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-09</td><td>1147.6</td><td>7.05</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-06</td><td>1147.0</td><td>-3.29</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-05</td><td>1186.0</td><td>-1.05</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-04</td><td>1199.8</td><td>2.46</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-03</td><td>1161.8</td><td>-2.09</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-02</td><td>1210.4</td><td>1.48</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-02-27</td><td>1233.4</td><td>-0.11</td></tr></tbody></table></div>

---
## Reusable Functions & Expressions

### Pandas — <code style="font-size:0.75em">.pipe()</code>

```python
def add_moving_averages(df, windows=[7, 30]):
    for w in windows:
        df = df.assign(**{f"sma_{w}": df["close"].rolling(w).mean()})
    return df

def flag_high_volume(df, threshold=2.0):
    avg_vol = df["volume"].mean()
    return df.assign(high_volume=df["volume"] > avg_vol * threshold)

result_pd = (
    ohlcv_pd
    .query("symbol == 'ASML.AS'")
    .sort_values("date")
    .pipe(add_moving_averages, windows=[7, 30])
    .pipe(flag_high_volume)
    .tail(10)
    [["symbol", "date", "close", "sma_7", "sma_30", "high_volume"]]
)
display(result_pd)
```

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
      <th>symbol</th>
      <th>date</th>
      <th>close</th>
      <th>sma_7</th>
      <th>sma_30</th>
      <th>high_volume</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>11955</th>
      <td>ASML.AS</td>
      <td>2026-02-27</td>
      <td>1233.4</td>
      <td>1251.514286</td>
      <td>1201.400000</td>
      <td>False</td>
    </tr>
    <tr>
      <th>11956</th>
      <td>ASML.AS</td>
      <td>2026-03-02</td>
      <td>1210.4</td>
      <td>1247.542857</td>
      <td>1204.400000</td>
      <td>False</td>
    </tr>
    <tr>
      <th>11957</th>
      <td>ASML.AS</td>
      <td>2026-03-03</td>
      <td>1161.8</td>
      <td>1234.142857</td>
      <td>1205.126667</td>
      <td>False</td>
    </tr>
    <tr>
      <th>11958</th>
      <td>ASML.AS</td>
      <td>2026-03-04</td>
      <td>1199.8</td>
      <td>1227.085714</td>
      <td>1206.626667</td>
      <td>False</td>
    </tr>
    <tr>
      <th>11959</th>
      <td>ASML.AS</td>
      <td>2026-03-05</td>
      <td>1186.0</td>
      <td>1216.028571</td>
      <td>1206.946667</td>
      <td>False</td>
    </tr>
    <tr>
      <th>11960</th>
      <td>ASML.AS</td>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>1195.828571</td>
      <td>1205.906667</td>
      <td>False</td>
    </tr>
    <tr>
      <th>11961</th>
      <td>ASML.AS</td>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>1183.714286</td>
      <td>1204.893333</td>
      <td>False</td>
    </tr>
    <tr>
      <th>11962</th>
      <td>ASML.AS</td>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>1178.942857</td>
      <td>1204.306667</td>
      <td>False</td>
    </tr>
    <tr>
      <th>11963</th>
      <td>ASML.AS</td>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>1177.285714</td>
      <td>1204.453333</td>
      <td>False</td>
    </tr>
    <tr>
      <th>11964</th>
      <td>ASML.AS</td>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>1181.428571</td>
      <td>1204.413333</td>
      <td>False</td>
    </tr>
  </tbody>
</table>
</div>

### Polars — reusable expressions

```python
daily_return_expr = ((pl.col("close") - pl.col("open")) / pl.col("open") * 100).round(2).alias("daily_return")
sma_7_expr = pl.col("close").rolling_mean(7).over("symbol").alias("sma_7")
sma_30_expr = pl.col("close").rolling_mean(30).over("symbol").alias("sma_30")

result_pl = (
    ohlcv_pl
    .filter(pl.col("symbol") == "ASML.AS")
    .sort("date")
    .with_columns(daily_return_expr, sma_7_expr, sma_30_expr)
    .tail(10)
    .select("symbol", "date", "close", "daily_return", "sma_7", "sma_30")
)
display(result_pl)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 6)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th><th>daily_return</th><th>sma_7</th><th>sma_30</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2026-02-27</td><td>1233.4</td><td>-0.11</td><td>1251.514286</td><td>1201.4</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-02</td><td>1210.4</td><td>1.48</td><td>1247.542857</td><td>1204.4</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-03</td><td>1161.8</td><td>-2.09</td><td>1234.142857</td><td>1205.126667</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-04</td><td>1199.8</td><td>2.46</td><td>1227.085714</td><td>1206.626667</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-05</td><td>1186.0</td><td>-1.05</td><td>1216.028571</td><td>1206.946667</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-06</td><td>1147.0</td><td>-3.29</td><td>1195.828571</td><td>1205.906667</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-09</td><td>1147.6</td><td>7.05</td><td>1183.714286</td><td>1204.893333</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-10</td><td>1200.0</td><td>0.98</td><td>1178.942857</td><td>1204.306667</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-11</td><td>1198.8</td><td>0.88</td><td>1177.285714</td><td>1204.453333</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-12</td><td>1190.8</td><td>-0.33</td><td>1181.428571</td><td>1204.413333</td></tr></tbody></table></div>

## Recipe Pipeline: Full Example


- **Group By**: Split rows into groups by one or more columns, then apply aggregate functions to each group independently.
- **Aggregation**: Compute summary statistics (mean, sum, count, min, max) for each group. Returns one row per group.
- **Merge**: Combine two DataFrames by matching rows on shared key columns (Pandas).
- **Query**: Filter rows using a string expression (Pandas).

```python
# Pandas
result_pd = (
    ohlcv_pd
    .merge(dim_pd[["symbol", "short_name", "sector", "country"]], on="symbol", how="left")
    .query("country == 'Germany'")
    .assign(
        daily_return=lambda d: (d["close"] - d["open"]) / d["open"] * 100,
        is_positive=lambda d: d["close"] > d["open"],
    )
    .groupby(["symbol", "short_name", "sector"], as_index=False)
    .agg(avg_return=("daily_return", "mean"), positive_days=("is_positive", "sum"), total_days=("daily_return", "count"))
    .assign(win_rate=lambda d: (d["positive_days"] / d["total_days"] * 100).round(1))
    .sort_values("avg_return", ascending=False)
)
display(result_pd)
```

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
      <th>symbol</th>
      <th>short_name</th>
      <th>sector</th>
      <th>avg_return</th>
      <th>positive_days</th>
      <th>total_days</th>
      <th>win_rate</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>13</th>
      <td>SAP.DE</td>
      <td>SAP SE</td>
      <td>Technology</td>
      <td>0.089682</td>
      <td>702</td>
      <td>1324</td>
      <td>53.0</td>
    </tr>
    <tr>
      <th>8</th>
      <td>ENR.DE</td>
      <td>Siemens Energy AG</td>
      <td>Industrials</td>
      <td>0.050090</td>
      <td>641</td>
      <td>1324</td>
      <td>48.4</td>
    </tr>
    <tr>
      <th>14</th>
      <td>SIE.DE</td>
      <td>SIEMENS AG</td>
      <td>Industrials</td>
      <td>0.041032</td>
      <td>687</td>
      <td>1324</td>
      <td>51.9</td>
    </tr>
    <tr>
      <th>5</th>
      <td>DB1.DE</td>
      <td>DEUTSCHE BOERSE AG</td>
      <td>Financial Services</td>
      <td>0.036636</td>
      <td>658</td>
      <td>1324</td>
      <td>49.7</td>
    </tr>
    <tr>
      <th>12</th>
      <td>RHM.DE</td>
      <td>RHEINMETALL AG</td>
      <td>Industrials</td>
      <td>0.033806</td>
      <td>640</td>
      <td>1324</td>
      <td>48.3</td>
    </tr>
    <tr>
      <th>11</th>
      <td>MUV2.DE</td>
      <td>MUENCHENER RUECKVERS.-GES. AG N</td>
      <td>Financial Services</td>
      <td>0.029580</td>
      <td>670</td>
      <td>1324</td>
      <td>50.6</td>
    </tr>
    <tr>
      <th>7</th>
      <td>DTE.DE</td>
      <td>DEUTSCHE TELEKOM AG</td>
      <td>Communication Services</td>
      <td>0.026986</td>
      <td>683</td>
      <td>1324</td>
      <td>51.6</td>
    </tr>
    <tr>
      <th>6</th>
      <td>DHL.DE</td>
      <td>DEUTSCHE POST AG</td>
      <td>Industrials</td>
      <td>0.019929</td>
      <td>688</td>
      <td>1324</td>
      <td>52.0</td>
    </tr>
    <tr>
      <th>10</th>
      <td>MBG.DE</td>
      <td>Mercedes-Benz Group AG</td>
      <td>Consumer Cyclical</td>
      <td>0.009697</td>
      <td>648</td>
      <td>1324</td>
      <td>48.9</td>
    </tr>
    <tr>
      <th>4</th>
      <td>BMW.DE</td>
      <td>BAYERISCHE MOTOREN WERKE AG</td>
      <td>Consumer Cyclical</td>
      <td>0.009107</td>
      <td>657</td>
      <td>1324</td>
      <td>49.6</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ALV.DE</td>
      <td>Allianz SE</td>
      <td>Financial Services</td>
      <td>0.007040</td>
      <td>661</td>
      <td>1324</td>
      <td>49.9</td>
    </tr>
    <tr>
      <th>2</th>
      <td>BAS.DE</td>
      <td>BASF SE</td>
      <td>Basic Materials</td>
      <td>-0.017599</td>
      <td>635</td>
      <td>1324</td>
      <td>48.0</td>
    </tr>
    <tr>
      <th>0</th>
      <td>ADS.DE</td>
      <td>adidas AG</td>
      <td>Consumer Cyclical</td>
      <td>-0.018576</td>
      <td>609</td>
      <td>1324</td>
      <td>46.0</td>
    </tr>
    <tr>
      <th>3</th>
      <td>BAYN.DE</td>
      <td>Bayer AG</td>
      <td>Healthcare</td>
      <td>-0.027584</td>
      <td>636</td>
      <td>1324</td>
      <td>48.0</td>
    </tr>
    <tr>
      <th>9</th>
      <td>IFX.DE</td>
      <td>INFINEON TECHNOLOGIES AG</td>
      <td>Technology</td>
      <td>-0.054771</td>
      <td>622</td>
      <td>1324</td>
      <td>47.0</td>
    </tr>
    <tr>
      <th>15</th>
      <td>VOW.DE</td>
      <td>VOLKSWAGEN AG</td>
      <td>Consumer Cyclical</td>
      <td>-0.063948</td>
      <td>599</td>
      <td>1324</td>
      <td>45.2</td>
    </tr>
  </tbody>
</table>
</div>

```python
# Polars
result_pl = (
    ohlcv_pl
    .join(dim_pl.select("symbol", "short_name", "sector", "country"), on="symbol", how="left")
    .filter(pl.col("country") == "Germany")
    .with_columns(
        ((pl.col("close") - pl.col("open")) / pl.col("open") * 100).alias("daily_return"),
        (pl.col("close") > pl.col("open")).alias("is_positive"),
    )
    .group_by("symbol", "short_name", "sector")
    .agg(
        pl.col("daily_return").mean().round(4).alias("avg_return"),
        pl.col("is_positive").sum().alias("positive_days"),
        pl.col("daily_return").count().alias("total_days"),
    )
    .with_columns((pl.col("positive_days") / pl.col("total_days") * 100).round(1).alias("win_rate"))
    .sort("avg_return", descending=True)
)
display(result_pl)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (16, 7)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>short_name</th><th>sector</th><th>avg_return</th><th>positive_days</th><th>total_days</th><th>win_rate</th></tr><tr><td>str</td><td>str</td><td>str</td><td>f64</td><td>u32</td><td>u32</td><td>f64</td></tr></thead><tbody><tr><td>&quot;SAP.DE&quot;</td><td>&quot;SAP SE&quot;</td><td>&quot;Technology&quot;</td><td>0.0897</td><td>702</td><td>1324</td><td>53.0</td></tr><tr><td>&quot;ENR.DE&quot;</td><td>&quot;Siemens Energy AG&quot;</td><td>&quot;Industrials&quot;</td><td>0.0501</td><td>641</td><td>1324</td><td>48.4</td></tr><tr><td>&quot;SIE.DE&quot;</td><td>&quot;SIEMENS AG&quot;</td><td>&quot;Industrials&quot;</td><td>0.041</td><td>687</td><td>1324</td><td>51.9</td></tr><tr><td>&quot;DB1.DE&quot;</td><td>&quot;DEUTSCHE BOERSE AG&quot;</td><td>&quot;Financial Services&quot;</td><td>0.0366</td><td>658</td><td>1324</td><td>49.7</td></tr><tr><td>&quot;RHM.DE&quot;</td><td>&quot;RHEINMETALL AG&quot;</td><td>&quot;Industrials&quot;</td><td>0.0338</td><td>640</td><td>1324</td><td>48.3</td></tr><tr><td>&hellip;</td><td>&hellip;</td><td>&hellip;</td><td>&hellip;</td><td>&hellip;</td><td>&hellip;</td><td>&hellip;</td></tr><tr><td>&quot;BAS.DE&quot;</td><td>&quot;BASF SE&quot;</td><td>&quot;Basic Materials&quot;</td><td>-0.0176</td><td>635</td><td>1324</td><td>48.0</td></tr><tr><td>&quot;ADS.DE&quot;</td><td>&quot;adidas AG&quot;</td><td>&quot;Consumer Cyclical&quot;</td><td>-0.0186</td><td>609</td><td>1324</td><td>46.0</td></tr><tr><td>&quot;BAYN.DE&quot;</td><td>&quot;Bayer AG&quot;</td><td>&quot;Healthcare&quot;</td><td>-0.0276</td><td>636</td><td>1324</td><td>48.0</td></tr><tr><td>&quot;IFX.DE&quot;</td><td>&quot;INFINEON TECHNOLOGIES AG&quot;</td><td>&quot;Technology&quot;</td><td>-0.0548</td><td>622</td><td>1324</td><td>47.0</td></tr><tr><td>&quot;VOW.DE&quot;</td><td>&quot;VOLKSWAGEN AG&quot;</td><td>&quot;Consumer Cyclical&quot;</td><td>-0.0639</td><td>599</td><td>1324</td><td>45.2</td></tr></tbody></table></div>

## Clean Code: Breaking Long Chains


- **Filter**: Keep only rows matching a condition.
- **Select**: Choose specific columns, optionally transforming them.
- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **Sort**: Reorder rows by column values.

```python
filtered = ohlcv_pl.filter(pl.col("symbol") == "ASML.AS").sort("date")
enriched = filtered.with_columns(
    ((pl.col("close") - pl.col("open")) / pl.col("open") * 100).round(2).alias("daily_return"),
    (pl.col("high") - pl.col("low")).round(2).alias("range"),
)
final = enriched.select("symbol", "date", "close", "daily_return", "range").tail(10)
display(final)
```

<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 5)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th><th>daily_return</th><th>range</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2026-02-27</td><td>1233.4</td><td>-0.11</td><td>38.2</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-02</td><td>1210.4</td><td>1.48</td><td>51.4</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-03</td><td>1161.8</td><td>-2.09</td><td>43.4</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-04</td><td>1199.8</td><td>2.46</td><td>43.2</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-05</td><td>1186.0</td><td>-1.05</td><td>37.0</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-06</td><td>1147.0</td><td>-3.29</td><td>79.8</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-09</td><td>1147.6</td><td>7.05</td><td>87.4</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-10</td><td>1200.0</td><td>0.98</td><td>36.2</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-11</td><td>1198.8</td><td>0.88</td><td>36.8</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-12</td><td>1190.8</td><td>-0.33</td><td>14.4</td></tr></tbody></table></div>

## Summary

| Feature | Pandas | Polars |
|---|---|---|
| Basic chaining | .query().assign().sort_values() | .filter().with_columns().sort() |
| Custom functions | .pipe(func) | Regular function calls |
| Reusable logic | Functions returning DataFrames | Expressions as variables |
| Debugging | Insert .pipe(print) | Intermediate variables |
