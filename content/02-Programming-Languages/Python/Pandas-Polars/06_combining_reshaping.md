---
type: reference
category: programming-languages
technology: [python, pandas, polars]
tags: [pipeline, api, python, pandas, polars]
aliases: [join, merge, concat, pivot, melt, explode]
keywords: [join, merge, concat, vstack, hstack, pivot, melt, unpivot, explode, cross join]
description: "Pandas vs Polars reference 06/10 — Combining & Reshaping (joins, concat, pivot, melt, explode). Side-by-side executable examples with cell outputs."
related:
  - "[[pandas-polars-index]]"
  - "[[programming-languages-index]]"
  - "[[05_grouping_windows]]"
  - "[[07_lazy_performance]]"
created: 2026-03-23
updated: 2026-03-23
status: complete
---

# 06 — Combining & Reshaping DataFrames

Join, concat, pivot, melt, explode.


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

## Inner Join

This cell demonstrates:
- **Merge**: Combine two DataFrames by matching rows on shared key columns (Pandas).
- **Head**: Return the first N rows.


```python
# Pandas
result_pd = ohlcv_pd.merge(dim_pd[["symbol", "short_name", "sector"]], on="symbol", how="inner")
print(f"Pandas inner: {len(result_pd)}")
display(result_pd[["symbol", "short_name", "date", "close", "sector"]].head(5))
```

    Pandas inner: 66355
    


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
      <th>date</th>
      <th>close</th>
      <th>sector</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ABI.BR</td>
      <td>AB INBEV</td>
      <td>2021-01-04</td>
      <td>57.21</td>
      <td>Consumer Defensive</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ABI.BR</td>
      <td>AB INBEV</td>
      <td>2021-01-05</td>
      <td>57.18</td>
      <td>Consumer Defensive</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ABI.BR</td>
      <td>AB INBEV</td>
      <td>2021-01-06</td>
      <td>58.77</td>
      <td>Consumer Defensive</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ABI.BR</td>
      <td>AB INBEV</td>
      <td>2021-01-07</td>
      <td>58.40</td>
      <td>Consumer Defensive</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ABI.BR</td>
      <td>AB INBEV</td>
      <td>2021-01-08</td>
      <td>57.86</td>
      <td>Consumer Defensive</td>
    </tr>
  </tbody>
</table>
</div>



```python
# Polars
result_pl = ohlcv_pl.join(dim_pl.select("symbol", "short_name", "sector"), on="symbol", how="inner")
print(f"Polars inner: {result_pl.height}")
display(result_pl.select("symbol", "short_name", "date", "close", "sector").head(5))
```

    Polars inner: 66355
    


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 5)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>short_name</th><th>date</th><th>close</th><th>sector</th></tr><tr><td>str</td><td>str</td><td>date</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>&quot;AB INBEV&quot;</td><td>2021-01-04</td><td>57.21</td><td>&quot;Consumer Defensive&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;AB INBEV&quot;</td><td>2021-01-05</td><td>57.18</td><td>&quot;Consumer Defensive&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;AB INBEV&quot;</td><td>2021-01-06</td><td>58.77</td><td>&quot;Consumer Defensive&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;AB INBEV&quot;</td><td>2021-01-07</td><td>58.4</td><td>&quot;Consumer Defensive&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;AB INBEV&quot;</td><td>2021-01-08</td><td>57.86</td><td>&quot;Consumer Defensive&quot;</td></tr></tbody></table></div>


## Left Join

This cell demonstrates:
- **Merge**: Combine two DataFrames by matching rows on shared key columns (Pandas).
- **Head**: Return the first N rows.


```python
# Pandas
result_pd = ohlcv_pd.merge(scores_pd[["symbol", "composite_score", "composite_rank"]], on="symbol", how="left")
display(result_pd[["symbol", "date", "close", "composite_score"]].head(5))
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
      <th>composite_score</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ABI.BR</td>
      <td>2021-01-04</td>
      <td>57.21</td>
      <td>0.406873</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ABI.BR</td>
      <td>2021-01-04</td>
      <td>57.21</td>
      <td>0.420940</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ABI.BR</td>
      <td>2021-01-04</td>
      <td>57.21</td>
      <td>0.385210</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ABI.BR</td>
      <td>2021-01-05</td>
      <td>57.18</td>
      <td>0.406873</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ABI.BR</td>
      <td>2021-01-05</td>
      <td>57.18</td>
      <td>0.420940</td>
    </tr>
  </tbody>
</table>
</div>



```python
# Polars
result_pl = ohlcv_pl.join(scores_pl.select("symbol", "composite_score", "composite_rank"), on="symbol", how="left")
display(result_pl.select("symbol", "date", "close", "composite_score").head(5))
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 4)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th><th>composite_score</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>0.406873</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>0.42094</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>0.38521</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td><td>0.406873</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td><td>0.42094</td></tr></tbody></table></div>


## Anti Join

This cell demonstrates:
- **Join**: Combine two DataFrames by matching rows on shared key columns.
- **Select**: Choose specific columns, optionally transforming them.
- **Unique**: Return distinct values or deduplicate rows.


```python
# Polars: symbols in OHLCV not in scores
result = ohlcv_pl.select("symbol").unique().join(scores_pl.select("symbol").unique(), on="symbol", how="anti")
print(f"Symbols without scores: {result.height}")
display(result)
```

    Symbols without scores: 0
    


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (0, 1)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th></tr><tr><td>str</td></tr></thead><tbody></tbody></table></div>


## Semi Join

This cell demonstrates:
- **Join**: Combine two DataFrames by matching rows on shared key columns.
- **Select**: Choose specific columns, optionally transforming them.
- **Unique**: Return distinct values or deduplicate rows.


```python
result = ohlcv_pl.join(scores_pl.select("symbol").unique(), on="symbol", how="semi")
print(f"OHLCV rows with scores: {result.height} (of {ohlcv_pl.height})")
```

    OHLCV rows with scores: 66355 (of 66355)
    

## Cross Join

This cell demonstrates:
- **Join**: Combine two DataFrames by matching rows on shared key columns.


```python
syms = pl.DataFrame({"symbol": ["ASML.AS", "MC.PA"]})
dts = pl.DataFrame({"date": ["2026-03-01", "2026-03-02"]})
display(syms.join(dts, how="cross"))
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (4, 2)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>&quot;2026-03-01&quot;</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>&quot;2026-03-02&quot;</td></tr><tr><td>&quot;MC.PA&quot;</td><td>&quot;2026-03-01&quot;</td></tr><tr><td>&quot;MC.PA&quot;</td><td>&quot;2026-03-02&quot;</td></tr></tbody></table></div>


## Vertical Concat

This cell demonstrates:
- **Concatenation**: Stack DataFrames vertically (add rows) or horizontally (add columns).
- **Head**: Return the first N rows.


```python
# Pandas
combined_pd = pd.concat([ohlcv_pd.head(3), usa_pd.head(3)], ignore_index=True)
display(combined_pd[["symbol", "date", "close"]])
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
    <tr>
      <th>3</th>
      <td>AAPL</td>
      <td>2021-01-04</td>
      <td>129.41</td>
    </tr>
    <tr>
      <th>4</th>
      <td>AAPL</td>
      <td>2021-01-05</td>
      <td>131.01</td>
    </tr>
    <tr>
      <th>5</th>
      <td>AAPL</td>
      <td>2021-01-06</td>
      <td>126.60</td>
    </tr>
  </tbody>
</table>
</div>



```python
# Polars
combined_pl = pl.concat([ohlcv_pl.head(3), usa_pl.head(3)])
display(combined_pl.select("symbol", "date", "close"))
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (6, 3)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td></tr><tr><td>&quot;AAPL&quot;</td><td>2021-01-04</td><td>129.41</td></tr><tr><td>&quot;AAPL&quot;</td><td>2021-01-05</td><td>131.01</td></tr><tr><td>&quot;AAPL&quot;</td><td>2021-01-06</td><td>126.6</td></tr></tbody></table></div>


## Horizontal Concat

This cell demonstrates:
- **Concatenation**: Stack DataFrames vertically (add rows) or horizontally (add columns).


```python
left = pl.DataFrame({"symbol": ["A", "B"], "price": [100, 200]})
right = pl.DataFrame({"sector": ["Tech", "Luxury"]})
display(pl.concat([left, right], how="horizontal"))
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (2, 3)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>price</th><th>sector</th></tr><tr><td>str</td><td>i64</td><td>str</td></tr></thead><tbody><tr><td>&quot;A&quot;</td><td>100</td><td>&quot;Tech&quot;</td></tr><tr><td>&quot;B&quot;</td><td>200</td><td>&quot;Luxury&quot;</td></tr></tbody></table></div>


## Diagonal Concat (Polars Only)

This cell demonstrates:
- **Concatenation**: Stack DataFrames vertically (add rows) or horizontally (add columns).


```python
a = pl.DataFrame({"symbol": ["A"], "close": [100.0]})
b = pl.DataFrame({"symbol": ["B"], "volume": [999]})
display(pl.concat([a, b], how="diagonal"))
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (2, 3)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>close</th><th>volume</th></tr><tr><td>str</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>&quot;A&quot;</td><td>100.0</td><td>null</td></tr><tr><td>&quot;B&quot;</td><td>null</td><td>999</td></tr></tbody></table></div>


## Summary

| Op | Pandas | Polars |
|---|---|---|
| Inner | .merge(how='inner') | .join(how='inner') |
| Left | .merge(how='left') | .join(how='left') |
| Anti | N/A | .join(how='anti') |
| Semi | N/A | .join(how='semi') |
| Cross | .merge(how='cross') | .join(how='cross') |
| Stack | pd.concat() | pl.concat() |
| Diagonal | N/A | pl.concat(how='diagonal') |

---
# Part 2: Reshaping

## Wide to Long: melt / unpivot

This cell demonstrates:
- **Melt**: Convert wide format to long: column names become values in a new column (Pandas).
- **Tail**: Return the last N rows.


```python
# Pandas melt
asml_pd = ohlcv_pd[ohlcv_pd["symbol"]=="ASML.AS"][["date","open","high","low","close"]].tail(3)
display(asml_pd.melt(id_vars="date", var_name="price_type", value_name="price"))
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
      <th>date</th>
      <th>price_type</th>
      <th>price</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>2026-03-10</td>
      <td>open</td>
      <td>1188.4</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2026-03-11</td>
      <td>open</td>
      <td>1188.4</td>
    </tr>
    <tr>
      <th>2</th>
      <td>2026-03-12</td>
      <td>open</td>
      <td>1194.8</td>
    </tr>
    <tr>
      <th>3</th>
      <td>2026-03-10</td>
      <td>high</td>
      <td>1208.4</td>
    </tr>
    <tr>
      <th>4</th>
      <td>2026-03-11</td>
      <td>high</td>
      <td>1210.8</td>
    </tr>
    <tr>
      <th>5</th>
      <td>2026-03-12</td>
      <td>high</td>
      <td>1202.2</td>
    </tr>
    <tr>
      <th>6</th>
      <td>2026-03-10</td>
      <td>low</td>
      <td>1172.2</td>
    </tr>
    <tr>
      <th>7</th>
      <td>2026-03-11</td>
      <td>low</td>
      <td>1174.0</td>
    </tr>
    <tr>
      <th>8</th>
      <td>2026-03-12</td>
      <td>low</td>
      <td>1187.8</td>
    </tr>
    <tr>
      <th>9</th>
      <td>2026-03-10</td>
      <td>close</td>
      <td>1200.0</td>
    </tr>
    <tr>
      <th>10</th>
      <td>2026-03-11</td>
      <td>close</td>
      <td>1198.8</td>
    </tr>
    <tr>
      <th>11</th>
      <td>2026-03-12</td>
      <td>close</td>
      <td>1190.8</td>
    </tr>
  </tbody>
</table>
</div>



```python
# Polars unpivot
asml_pl = ohlcv_pl.filter(pl.col("symbol")=="ASML.AS").select("date","open","high","low","close").tail(3)
display(asml_pl.unpivot(index="date", variable_name="price_type", value_name="price"))
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (12, 3)</small><table border="1" class="dataframe"><thead><tr><th>date</th><th>price_type</th><th>price</th></tr><tr><td>date</td><td>str</td><td>f64</td></tr></thead><tbody><tr><td>2026-03-10</td><td>&quot;open&quot;</td><td>1188.4</td></tr><tr><td>2026-03-11</td><td>&quot;open&quot;</td><td>1188.4</td></tr><tr><td>2026-03-12</td><td>&quot;open&quot;</td><td>1194.8</td></tr><tr><td>2026-03-10</td><td>&quot;high&quot;</td><td>1208.4</td></tr><tr><td>2026-03-11</td><td>&quot;high&quot;</td><td>1210.8</td></tr><tr><td>&hellip;</td><td>&hellip;</td><td>&hellip;</td></tr><tr><td>2026-03-11</td><td>&quot;low&quot;</td><td>1174.0</td></tr><tr><td>2026-03-12</td><td>&quot;low&quot;</td><td>1187.8</td></tr><tr><td>2026-03-10</td><td>&quot;close&quot;</td><td>1200.0</td></tr><tr><td>2026-03-11</td><td>&quot;close&quot;</td><td>1198.8</td></tr><tr><td>2026-03-12</td><td>&quot;close&quot;</td><td>1190.8</td></tr></tbody></table></div>


## Long to Wide: pivot

This cell demonstrates:
- **Group By**: Split rows into groups by one or more columns, then apply aggregate functions to each group independently.
- **Aggregation**: Compute summary statistics (mean, sum, count, min, max) for each group. Returns one row per group.
- **Pivot**: Convert long format to wide: values in a column become new column headers.
- **Filter**: Keep only rows matching a condition.


```python
# Polars pivot
ohlcv_yr = ohlcv_pl.with_columns(pl.col("date").dt.year().alias("year"))
pivoted = (
    ohlcv_yr.filter(pl.col("symbol").is_in(["ASML.AS","MC.PA","SAP.DE"]))
    .group_by("symbol","year").agg(pl.col("close").mean().round(2).alias("avg"))
    .pivot(on="year", index="symbol", values="avg").sort("symbol")
)
display(pivoted)
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (3, 7)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>2023</th><th>2025</th><th>2024</th><th>2026</th><th>2022</th><th>2021</th></tr><tr><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>611.33</td><td>724.61</td><td>799.26</td><td>1170.42</td><td>531.58</td><td>593.61</td></tr><tr><td>&quot;MC.PA&quot;</td><td>788.14</td><td>562.7</td><td>705.65</td><td>560.63</td><td>645.6</td><td>630.22</td></tr><tr><td>&quot;SAP.DE&quot;</td><td>122.43</td><td>243.04</td><td>188.51</td><td>182.11</td><td>96.91</td><td>116.57</td></tr></tbody></table></div>


## Explode

This cell demonstrates:
- **Explode**: Expand a list column into multiple rows, one per list element.


```python
df = pl.DataFrame({"symbol": ["ASML.AS","MC.PA"], "tags": [["tech","nl"],["luxury","fr"]]})
display(df.explode("tags"))
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (4, 2)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>tags</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>&quot;tech&quot;</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>&quot;nl&quot;</td></tr><tr><td>&quot;MC.PA&quot;</td><td>&quot;luxury&quot;</td></tr><tr><td>&quot;MC.PA&quot;</td><td>&quot;fr&quot;</td></tr></tbody></table></div>


## Implode

This cell demonstrates:
- **Group By**: Split rows into groups by one or more columns, then apply aggregate functions to each group independently.
- **Aggregation**: Compute summary statistics (mean, sum, count, min, max) for each group. Returns one row per group.
- **Implode**: Collect multiple rows into a single list value per group.
- **Sort**: Reorder rows by column values.


```python
display(scores_pl.group_by("sector").agg(pl.col("symbol").implode()).sort("sector").head(5))
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 2)</small><table border="1" class="dataframe"><thead><tr><th>sector</th><th>symbol</th></tr><tr><td>str</td><td>list[str]</td></tr></thead><tbody><tr><td>&quot;Basic Materials&quot;</td><td>[&quot;AI.PA&quot;, &quot;BAS.DE&quot;, … &quot;LIN&quot;]</td></tr><tr><td>&quot;Communication Services&quot;</td><td>[&quot;DTE.DE&quot;, &quot;DTE.DE&quot;, … &quot;NFLX&quot;]</td></tr><tr><td>&quot;Consumer Cyclical&quot;</td><td>[&quot;VOW.DE&quot;, &quot;ADS.DE&quot;, … &quot;TSLA&quot;]</td></tr><tr><td>&quot;Consumer Defensive&quot;</td><td>[&quot;ABI.BR&quot;, &quot;AD.AS&quot;, … &quot;COST&quot;]</td></tr><tr><td>&quot;Energy&quot;</td><td>[&quot;TTE.PA&quot;, &quot;ENI.MI&quot;, … &quot;XOM&quot;]</td></tr></tbody></table></div>


## Transpose

This cell demonstrates:
- **Transpose**: Swap rows and columns.
- **Filter**: Keep only rows matching a condition.
- **Select**: Choose specific columns, optionally transforming them.
- **Sort**: Reorder rows by column values.


```python
# Need unique rows per symbol for transpose (scores has multiple dates)
small = (
    scores_pl
    .sort("score_date", descending=True)
    .unique(subset=["symbol"], keep="first")
    .filter(pl.col("symbol").is_in(["ASML.AS", "MC.PA"]))
    .select("symbol", "composite_score", "momentum_score")
)
display(small)
display(small.transpose(include_header=True, column_names="symbol"))
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (2, 3)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>composite_score</th><th>momentum_score</th></tr><tr><td>str</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;MC.PA&quot;</td><td>-0.203769</td><td>-0.70792</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>0.176104</td><td>1.470134</td></tr></tbody></table></div>



<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (2, 3)</small><table border="1" class="dataframe"><thead><tr><th>column</th><th>MC.PA</th><th>ASML.AS</th></tr><tr><td>str</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;composite_score&quot;</td><td>-0.203769</td><td>0.176104</td></tr><tr><td>&quot;momentum_score&quot;</td><td>-0.70792</td><td>1.470134</td></tr></tbody></table></div>


## One-Hot Encoding

This cell demonstrates:
- **One-Hot Encoding**: Convert categories into binary 0/1 columns.


```python
df = pl.DataFrame({"sector": ["Tech","Luxury","Tech","Energy"]})
display(df.to_dummies())
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (4, 3)</small><table border="1" class="dataframe"><thead><tr><th>sector_Energy</th><th>sector_Luxury</th><th>sector_Tech</th></tr><tr><td>u8</td><td>u8</td><td>u8</td></tr></thead><tbody><tr><td>0</td><td>0</td><td>1</td></tr><tr><td>0</td><td>1</td><td>0</td></tr><tr><td>0</td><td>0</td><td>1</td></tr><tr><td>1</td><td>0</td><td>0</td></tr></tbody></table></div>


## Summary

| Op | Pandas | Polars |
|---|---|---|
| Wide to long | melt() | unpivot() |
| Long to wide | pivot_table() | pivot() |
| Explode | explode() | explode() |
| Implode | N/A | implode() |
| Transpose | .T | .transpose() |
| One-hot | get_dummies() | to_dummies() |
