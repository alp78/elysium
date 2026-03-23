---
type: reference
category: programming-languages
technology: [python, pandas, polars]
tags: [reference, programming-languages, python, pandas, polars, groupby, aggregation, window-functions]
aliases: [Pandas Polars Grouping Windows, groupby agg, over, rolling, shift lag]
keywords: [pandas, polars, groupby, group_by, agg, aggregate, named_agg, over, window, partition_by, order_by, shift, lag, rolling, cumsum, rank]
description: "Pandas vs Polars grouping, aggregation, and window functions — groupby/agg, multi-column groupby, Polars over/partition_by, shift/lag, rolling windows."
related:
  - "[[pandas-polars-index]]"
  - "[[04_missing_strings_datetime]]"
  - "[[06_combining_reshaping]]"
  - "[[07_Generics_LINQ]]"
created: 2026-03-23
updated: 2026-03-23
status: complete
---

# 05 — Grouping, Aggregation & Windows

Split-apply-combine and window functions.


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

## Basic Group By

This cell demonstrates:
- **Group By**: Split rows into groups by one or more columns, then apply aggregate functions to each group independently.
- **Aggregation**: Compute summary statistics (mean, sum, count, min, max) for each group. Returns one row per group.
- **Sort**: Reorder rows by column values (Pandas).
- **Head**: Return the first N rows.


```python
# Pandas
display(
    ohlcv_pd.groupby("symbol", as_index=False)
    .agg(avg_close=("close", "mean"), total_volume=("volume", "sum"), trading_days=("date", "count"))
    .sort_values("avg_close", ascending=False)
    .head(10)
)
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
      <th>avg_close</th>
      <th>total_volume</th>
      <th>trading_days</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>38</th>
      <td>RMS.PA</td>
      <td>1761.555748</td>
      <td>81633862</td>
      <td>1331</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ADYEN.AS</td>
      <td>1545.976409</td>
      <td>110400463</td>
      <td>1331</td>
    </tr>
    <tr>
      <th>8</th>
      <td>ASML.AS</td>
      <td>671.348911</td>
      <td>945070720</td>
      <td>1331</td>
    </tr>
    <tr>
      <th>31</th>
      <td>MC.PA</td>
      <td>662.404508</td>
      <td>557855567</td>
      <td>1331</td>
    </tr>
    <tr>
      <th>37</th>
      <td>RHM.DE</td>
      <td>544.661533</td>
      <td>308359744</td>
      <td>1324</td>
    </tr>
    <tr>
      <th>7</th>
      <td>ARGX.BR</td>
      <td>413.691961</td>
      <td>94592244</td>
      <td>1331</td>
    </tr>
    <tr>
      <th>34</th>
      <td>OR.PA</td>
      <td>377.544365</td>
      <td>484115375</td>
      <td>1331</td>
    </tr>
    <tr>
      <th>32</th>
      <td>MUV2.DE</td>
      <td>374.659932</td>
      <td>398802950</td>
      <td>1324</td>
    </tr>
    <tr>
      <th>36</th>
      <td>RACE.MI</td>
      <td>289.753823</td>
      <td>476686026</td>
      <td>1321</td>
    </tr>
    <tr>
      <th>6</th>
      <td>ALV.DE</td>
      <td>252.193731</td>
      <td>1101960308</td>
      <td>1324</td>
    </tr>
  </tbody>
</table>
</div>



```python
# Polars
display(
    ohlcv_pl.group_by("symbol")
    .agg(
        pl.col("close").mean().round(2).alias("avg_close"),
        pl.col("volume").sum().alias("total_volume"),
        pl.col("date").count().alias("trading_days"),
    )
    .sort("avg_close", descending=True)
    .head(10)
)
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 4)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>avg_close</th><th>total_volume</th><th>trading_days</th></tr><tr><td>str</td><td>f64</td><td>i64</td><td>u32</td></tr></thead><tbody><tr><td>&quot;RMS.PA&quot;</td><td>1761.56</td><td>81633862</td><td>1331</td></tr><tr><td>&quot;ADYEN.AS&quot;</td><td>1545.98</td><td>110400463</td><td>1331</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>671.35</td><td>945070720</td><td>1331</td></tr><tr><td>&quot;MC.PA&quot;</td><td>662.4</td><td>557855567</td><td>1331</td></tr><tr><td>&quot;RHM.DE&quot;</td><td>544.66</td><td>308359744</td><td>1324</td></tr><tr><td>&quot;ARGX.BR&quot;</td><td>413.69</td><td>94592244</td><td>1331</td></tr><tr><td>&quot;OR.PA&quot;</td><td>377.54</td><td>484115375</td><td>1331</td></tr><tr><td>&quot;MUV2.DE&quot;</td><td>374.66</td><td>398802950</td><td>1324</td></tr><tr><td>&quot;RACE.MI&quot;</td><td>289.75</td><td>476686026</td><td>1321</td></tr><tr><td>&quot;ALV.DE&quot;</td><td>252.19</td><td>1101960308</td><td>1324</td></tr></tbody></table></div>


## Multiple Grouping Columns

This cell demonstrates:
- **Group By**: Split rows into groups by one or more columns, then apply aggregate functions to each group independently.
- **Aggregation**: Compute summary statistics (mean, sum, count, min, max) for each group. Returns one row per group.
- **Query**: Filter rows using a string expression (Pandas).
- **DateTime Accessor**: Extract date parts: .dt.year(), .dt.month(), .dt.weekday().


```python
# Pandas: group by symbol + year
ohlcv_pd["year"] = pd.to_datetime(ohlcv_pd["date"]).dt.year
display(
    ohlcv_pd.groupby(["symbol", "year"], as_index=False)
    .agg(avg_close=("close", "mean"), max_close=("close", "max"))
    .query("symbol == 'ASML.AS'")
    .tail(5)
)
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
      <th>year</th>
      <th>avg_close</th>
      <th>max_close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>49</th>
      <td>ASML.AS</td>
      <td>2022</td>
      <td>531.578794</td>
      <td>701.7</td>
    </tr>
    <tr>
      <th>50</th>
      <td>ASML.AS</td>
      <td>2023</td>
      <td>611.328627</td>
      <td>694.7</td>
    </tr>
    <tr>
      <th>51</th>
      <td>ASML.AS</td>
      <td>2024</td>
      <td>799.262109</td>
      <td>1002.2</td>
    </tr>
    <tr>
      <th>52</th>
      <td>ASML.AS</td>
      <td>2025</td>
      <td>724.614118</td>
      <td>963.4</td>
    </tr>
    <tr>
      <th>53</th>
      <td>ASML.AS</td>
      <td>2026</td>
      <td>1170.418000</td>
      <td>1288.4</td>
    </tr>
  </tbody>
</table>
</div>



```python
# Polars
display(
    ohlcv_pl.with_columns(pl.col("date").dt.year().alias("year"))
    .group_by("symbol", "year")
    .agg(
        pl.col("close").mean().round(2).alias("avg_close"),
        pl.col("close").max().alias("max_close"),
    )
    .filter(pl.col("symbol") == "ASML.AS")
    .sort("year", descending=True)
    .head(5)
)
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (5, 4)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>year</th><th>avg_close</th><th>max_close</th></tr><tr><td>str</td><td>i32</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2026</td><td>1170.42</td><td>1288.4</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2025</td><td>724.61</td><td>963.4</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2024</td><td>799.26</td><td>1002.2</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2023</td><td>611.33</td><td>694.7</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2022</td><td>531.58</td><td>701.7</td></tr></tbody></table></div>


## Multiple Aggregation Functions

This cell demonstrates:
- **Group By**: Split rows into groups by one or more columns, then apply aggregate functions to each group independently.
- **Aggregation**: Compute summary statistics (mean, sum, count, min, max) for each group. Returns one row per group.
- **Sort**: Reorder rows by column values (Pandas).
- **Head**: Return the first N rows.


```python
# Pandas: named aggregation
display(
    ohlcv_pd.groupby("symbol", as_index=False).agg(
        mean_close=("close", "mean"),
        std_close=("close", "std"),
        min_close=("close", "min"),
        max_close=("close", "max"),
        first_date=("date", "min"),
        last_date=("date", "max"),
    ).sort_values("mean_close", ascending=False).head(10)
)
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
      <th>mean_close</th>
      <th>std_close</th>
      <th>min_close</th>
      <th>max_close</th>
      <th>first_date</th>
      <th>last_date</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>38</th>
      <td>RMS.PA</td>
      <td>1761.555748</td>
      <td>481.321257</td>
      <td>842.60</td>
      <td>2839.0</td>
      <td>2021-01-04</td>
      <td>2026-03-12</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ADYEN.AS</td>
      <td>1545.976409</td>
      <td>417.812759</td>
      <td>630.80</td>
      <td>2766.0</td>
      <td>2021-01-04</td>
      <td>2026-03-12</td>
    </tr>
    <tr>
      <th>8</th>
      <td>ASML.AS</td>
      <td>671.348911</td>
      <td>162.745793</td>
      <td>397.45</td>
      <td>1288.4</td>
      <td>2021-01-04</td>
      <td>2026-03-12</td>
    </tr>
    <tr>
      <th>31</th>
      <td>MC.PA</td>
      <td>662.404508</td>
      <td>103.503255</td>
      <td>437.55</td>
      <td>902.0</td>
      <td>2021-01-04</td>
      <td>2026-03-12</td>
    </tr>
    <tr>
      <th>37</th>
      <td>RHM.DE</td>
      <td>544.661533</td>
      <td>586.081819</td>
      <td>77.00</td>
      <td>1988.5</td>
      <td>2021-01-04</td>
      <td>2026-03-12</td>
    </tr>
    <tr>
      <th>7</th>
      <td>ARGX.BR</td>
      <td>413.691961</td>
      <td>142.729547</td>
      <td>208.80</td>
      <td>803.0</td>
      <td>2021-01-04</td>
      <td>2026-03-12</td>
    </tr>
    <tr>
      <th>34</th>
      <td>OR.PA</td>
      <td>377.544365</td>
      <td>37.184584</td>
      <td>290.10</td>
      <td>456.9</td>
      <td>2021-01-04</td>
      <td>2026-03-12</td>
    </tr>
    <tr>
      <th>32</th>
      <td>MUV2.DE</td>
      <td>374.659932</td>
      <td>123.048080</td>
      <td>209.15</td>
      <td>610.6</td>
      <td>2021-01-04</td>
      <td>2026-03-12</td>
    </tr>
    <tr>
      <th>36</th>
      <td>RACE.MI</td>
      <td>289.753823</td>
      <td>94.845151</td>
      <td>154.70</td>
      <td>487.9</td>
      <td>2021-01-04</td>
      <td>2026-03-12</td>
    </tr>
    <tr>
      <th>6</th>
      <td>ALV.DE</td>
      <td>252.193731</td>
      <td>62.466824</td>
      <td>159.62</td>
      <td>392.7</td>
      <td>2021-01-04</td>
      <td>2026-03-12</td>
    </tr>
  </tbody>
</table>
</div>



```python
# Polars: expressions in .agg()
display(
    ohlcv_pl.group_by("symbol").agg(
        pl.col("close").mean().round(2).alias("mean_close"),
        pl.col("close").std().round(2).alias("std_close"),
        pl.col("close").min().alias("min_close"),
        pl.col("close").max().alias("max_close"),
        pl.col("date").min().alias("first_date"),
        pl.col("date").max().alias("last_date"),
    ).sort("mean_close", descending=True).head(10)
)
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 7)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>mean_close</th><th>std_close</th><th>min_close</th><th>max_close</th><th>first_date</th><th>last_date</th></tr><tr><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>date</td><td>date</td></tr></thead><tbody><tr><td>&quot;RMS.PA&quot;</td><td>1761.56</td><td>481.32</td><td>842.6</td><td>2839.0</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;ADYEN.AS&quot;</td><td>1545.98</td><td>417.81</td><td>630.8</td><td>2766.0</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>671.35</td><td>162.75</td><td>397.45</td><td>1288.4</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;MC.PA&quot;</td><td>662.4</td><td>103.5</td><td>437.55</td><td>902.0</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;RHM.DE&quot;</td><td>544.66</td><td>586.08</td><td>77.0</td><td>1988.5</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;ARGX.BR&quot;</td><td>413.69</td><td>142.73</td><td>208.8</td><td>803.0</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;OR.PA&quot;</td><td>377.54</td><td>37.18</td><td>290.1</td><td>456.9</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;MUV2.DE&quot;</td><td>374.66</td><td>123.05</td><td>209.15</td><td>610.6</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;RACE.MI&quot;</td><td>289.75</td><td>94.85</td><td>154.7</td><td>487.9</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;ALV.DE&quot;</td><td>252.19</td><td>62.47</td><td>159.62</td><td>392.7</td><td>2021-01-04</td><td>2026-03-12</td></tr></tbody></table></div>


## Transform: Same-Length Output

This cell demonstrates:
- **Group By**: Split rows into groups by one or more columns, then apply aggregate functions to each group independently.
- **Tail**: Return the last N rows.


```python
# Pandas: group mean alongside each row
asml_pd = ohlcv_pd[ohlcv_pd["symbol"] == "ASML.AS"].copy()
asml_pd["group_avg"] = asml_pd.groupby("symbol")["close"].transform("mean")
asml_pd["vs_avg"] = ((asml_pd["close"] - asml_pd["group_avg"]) / asml_pd["group_avg"] * 100).round(2)
display(asml_pd[["symbol", "date", "close", "group_avg", "vs_avg"]].tail(10))
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
      <th>group_avg</th>
      <th>vs_avg</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>11955</th>
      <td>ASML.AS</td>
      <td>2026-02-27</td>
      <td>1233.4</td>
      <td>671.348911</td>
      <td>83.72</td>
    </tr>
    <tr>
      <th>11956</th>
      <td>ASML.AS</td>
      <td>2026-03-02</td>
      <td>1210.4</td>
      <td>671.348911</td>
      <td>80.29</td>
    </tr>
    <tr>
      <th>11957</th>
      <td>ASML.AS</td>
      <td>2026-03-03</td>
      <td>1161.8</td>
      <td>671.348911</td>
      <td>73.05</td>
    </tr>
    <tr>
      <th>11958</th>
      <td>ASML.AS</td>
      <td>2026-03-04</td>
      <td>1199.8</td>
      <td>671.348911</td>
      <td>78.71</td>
    </tr>
    <tr>
      <th>11959</th>
      <td>ASML.AS</td>
      <td>2026-03-05</td>
      <td>1186.0</td>
      <td>671.348911</td>
      <td>76.66</td>
    </tr>
    <tr>
      <th>11960</th>
      <td>ASML.AS</td>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>671.348911</td>
      <td>70.85</td>
    </tr>
    <tr>
      <th>11961</th>
      <td>ASML.AS</td>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>671.348911</td>
      <td>70.94</td>
    </tr>
    <tr>
      <th>11962</th>
      <td>ASML.AS</td>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>671.348911</td>
      <td>78.74</td>
    </tr>
    <tr>
      <th>11963</th>
      <td>ASML.AS</td>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>671.348911</td>
      <td>78.57</td>
    </tr>
    <tr>
      <th>11964</th>
      <td>ASML.AS</td>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>671.348911</td>
      <td>77.37</td>
    </tr>
  </tbody>
</table>
</div>


### Polars: .over() window expression

This cell demonstrates:
- **Window (.over)**: Compute a value per row based on its group, without collapsing rows. Like SQL OVER(PARTITION BY).
- **Filter**: Keep only rows matching a condition.
- **Select**: Choose specific columns, optionally transforming them.
- **With Columns**: Add new columns or replace existing ones. All original columns are kept.


```python
# Polars: .over() — same concept, different syntax
display(
    ohlcv_pl.filter(pl.col("symbol") == "ASML.AS")
    .with_columns(
        pl.col("close").mean().over("symbol").round(2).alias("group_avg"),
    )
    .with_columns(
        ((pl.col("close") - pl.col("group_avg")) / pl.col("group_avg") * 100).round(2).alias("vs_avg"),
    )
    .select("symbol", "date", "close", "group_avg", "vs_avg")
    .tail(10)
)
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 5)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th><th>group_avg</th><th>vs_avg</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2026-02-27</td><td>1233.4</td><td>671.35</td><td>83.72</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-02</td><td>1210.4</td><td>671.35</td><td>80.29</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-03</td><td>1161.8</td><td>671.35</td><td>73.05</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-04</td><td>1199.8</td><td>671.35</td><td>78.71</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-05</td><td>1186.0</td><td>671.35</td><td>76.66</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-06</td><td>1147.0</td><td>671.35</td><td>70.85</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-09</td><td>1147.6</td><td>671.35</td><td>70.94</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-10</td><td>1200.0</td><td>671.35</td><td>78.74</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-11</td><td>1198.8</td><td>671.35</td><td>78.57</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-12</td><td>1190.8</td><td>671.35</td><td>77.37</td></tr></tbody></table></div>


## Sector Analysis with Scores

This cell demonstrates:
- **Group By**: Split rows into groups by one or more columns, then apply aggregate functions to each group independently.
- **Aggregation**: Compute summary statistics (mean, sum, count, min, max) for each group. Returns one row per group.
- **Sort**: Reorder rows by column values (Pandas).


```python
# Pandas: sector aggregation
display(
    scores_pd.groupby("sector", as_index=False).agg(
        stocks=("symbol", "count"),
        avg_composite=("composite_score", "mean"),
        avg_momentum=("momentum_score", "mean"),
        total_weight=("index_weight", "sum"),
    ).sort_values("avg_composite", ascending=False)
)
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
      <th>sector</th>
      <th>stocks</th>
      <th>avg_composite</th>
      <th>avg_momentum</th>
      <th>total_weight</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>8</th>
      <td>Technology</td>
      <td>75</td>
      <td>0.154008</td>
      <td>-0.197089</td>
      <td>2.147753</td>
    </tr>
    <tr>
      <th>4</th>
      <td>Energy</td>
      <td>34</td>
      <td>0.105659</td>
      <td>0.502755</td>
      <td>1.199656</td>
    </tr>
    <tr>
      <th>7</th>
      <td>Industrials</td>
      <td>66</td>
      <td>0.087422</td>
      <td>0.303463</td>
      <td>1.315854</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Communication Services</td>
      <td>36</td>
      <td>0.049356</td>
      <td>-0.182466</td>
      <td>1.021353</td>
    </tr>
    <tr>
      <th>0</th>
      <td>Basic Materials</td>
      <td>18</td>
      <td>0.043009</td>
      <td>0.447455</td>
      <td>0.185352</td>
    </tr>
    <tr>
      <th>6</th>
      <td>Healthcare</td>
      <td>45</td>
      <td>0.019073</td>
      <td>-0.209665</td>
      <td>0.543554</td>
    </tr>
    <tr>
      <th>3</th>
      <td>Consumer Defensive</td>
      <td>36</td>
      <td>-0.075310</td>
      <td>0.247709</td>
      <td>0.473144</td>
    </tr>
    <tr>
      <th>5</th>
      <td>Financial Services</td>
      <td>96</td>
      <td>-0.089991</td>
      <td>-0.056456</td>
      <td>1.468250</td>
    </tr>
    <tr>
      <th>9</th>
      <td>Utilities</td>
      <td>6</td>
      <td>-0.099377</td>
      <td>0.725350</td>
      <td>0.133743</td>
    </tr>
    <tr>
      <th>2</th>
      <td>Consumer Cyclical</td>
      <td>54</td>
      <td>-0.137446</td>
      <td>-0.413220</td>
      <td>1.423495</td>
    </tr>
  </tbody>
</table>
</div>



```python
# Polars: same analysis
display(
    scores_pl.group_by("sector").agg(
        pl.col("symbol").count().alias("stocks"),
        pl.col("composite_score").mean().round(4).alias("avg_composite"),
        pl.col("momentum_score").mean().round(4).alias("avg_momentum"),
        pl.col("index_weight").sum().round(4).alias("total_weight"),
    ).sort("avg_composite", descending=True)
)
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 5)</small><table border="1" class="dataframe"><thead><tr><th>sector</th><th>stocks</th><th>avg_composite</th><th>avg_momentum</th><th>total_weight</th></tr><tr><td>str</td><td>u32</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;Technology&quot;</td><td>75</td><td>0.154</td><td>-0.1971</td><td>2.1478</td></tr><tr><td>&quot;Energy&quot;</td><td>34</td><td>0.1057</td><td>0.5028</td><td>1.1997</td></tr><tr><td>&quot;Industrials&quot;</td><td>66</td><td>0.0874</td><td>0.3035</td><td>1.3159</td></tr><tr><td>&quot;Communication Services&quot;</td><td>36</td><td>0.0494</td><td>-0.1825</td><td>1.0214</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>18</td><td>0.043</td><td>0.4475</td><td>0.1854</td></tr><tr><td>&quot;Healthcare&quot;</td><td>45</td><td>0.0191</td><td>-0.2097</td><td>0.5436</td></tr><tr><td>&quot;Consumer Defensive&quot;</td><td>36</td><td>-0.0753</td><td>0.2477</td><td>0.4731</td></tr><tr><td>&quot;Financial Services&quot;</td><td>96</td><td>-0.09</td><td>-0.0565</td><td>1.4682</td></tr><tr><td>&quot;Utilities&quot;</td><td>6</td><td>-0.0994</td><td>0.7253</td><td>0.1337</td></tr><tr><td>&quot;Consumer Cyclical&quot;</td><td>54</td><td>-0.1374</td><td>-0.4132</td><td>1.4235</td></tr></tbody></table></div>


## Group By + Sort Pattern

This cell demonstrates:
- **Group By**: Split rows into groups by one or more columns, then apply aggregate functions to each group independently.
- **Select**: Choose specific columns, optionally transforming them.
- **Sort**: Reorder rows by column values.
- **Head**: Return the first N rows.


```python
# Top 3 stocks per sector by composite score (Polars)
display(
    scores_pl
    .sort("composite_rank")
    .group_by("sector")
    .head(3)
    .select("sector", "symbol", "composite_score", "composite_rank")
    .sort("sector", "composite_rank")
)
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (30, 4)</small><table border="1" class="dataframe"><thead><tr><th>sector</th><th>symbol</th><th>composite_score</th><th>composite_rank</th></tr><tr><td>str</td><td>str</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>&quot;Basic Materials&quot;</td><td>&quot;4063.T&quot;</td><td>0.344008</td><td>7</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;4063.T&quot;</td><td>0.24484</td><td>11</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;4063.T&quot;</td><td>0.245728</td><td>12</td></tr><tr><td>&quot;Communication Services&quot;</td><td>&quot;DTE.DE&quot;</td><td>0.515005</td><td>2</td></tr><tr><td>&quot;Communication Services&quot;</td><td>&quot;DTE.DE&quot;</td><td>0.521442</td><td>2</td></tr><tr><td>&hellip;</td><td>&hellip;</td><td>&hellip;</td><td>&hellip;</td></tr><tr><td>&quot;Technology&quot;</td><td>&quot;MU&quot;</td><td>0.925838</td><td>1</td></tr><tr><td>&quot;Technology&quot;</td><td>&quot;6981.T&quot;</td><td>0.494602</td><td>1</td></tr><tr><td>&quot;Utilities&quot;</td><td>&quot;ENEL.MI&quot;</td><td>0.039337</td><td>25</td></tr><tr><td>&quot;Utilities&quot;</td><td>&quot;ENEL.MI&quot;</td><td>0.018668</td><td>26</td></tr><tr><td>&quot;Utilities&quot;</td><td>&quot;ENEL.MI&quot;</td><td>0.002435</td><td>27</td></tr></tbody></table></div>


## Summary

| Operation | Pandas | Polars |
|---|---|---|
| Group by | .groupby(col) | .group_by(col) |
| Aggregate | .agg(name=(col, func)) | .agg(pl.col(col).func().alias(name)) |
| Transform | .groupby().transform() | .over() window expression |
| Multiple aggs | dict of (col, func) | List of expressions |
| Reset index | as_index=False | Not needed (no index) |
| Filter groups | .filter(func) | .filter() after group_by |

---
# Part 2: Window Functions

## Pandas: groupby().transform()

This cell demonstrates:
- **Group By**: Split rows into groups by one or more columns, then apply aggregate functions to each group independently.
- **Rank**: Assign a rank number to each row within its group, ordered by a column.
- **Tail**: Return the last N rows.


```python
asml=ohlcv_pd[ohlcv_pd["symbol"]=="ASML.AS"].copy()
asml["avg_close"]=asml.groupby("symbol")["close"].transform("mean")
asml["rank"]=asml["close"].rank(ascending=False)
display(asml[["date","close","avg_close","rank"]].tail(10))
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
      <th>close</th>
      <th>avg_close</th>
      <th>rank</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>11955</th>
      <td>2026-02-27</td>
      <td>1233.4</td>
      <td>671.348911</td>
      <td>7.0</td>
    </tr>
    <tr>
      <th>11956</th>
      <td>2026-03-02</td>
      <td>1210.4</td>
      <td>671.348911</td>
      <td>12.0</td>
    </tr>
    <tr>
      <th>11957</th>
      <td>2026-03-03</td>
      <td>1161.8</td>
      <td>671.348911</td>
      <td>33.0</td>
    </tr>
    <tr>
      <th>11958</th>
      <td>2026-03-04</td>
      <td>1199.8</td>
      <td>671.348911</td>
      <td>16.0</td>
    </tr>
    <tr>
      <th>11959</th>
      <td>2026-03-05</td>
      <td>1186.0</td>
      <td>671.348911</td>
      <td>27.0</td>
    </tr>
    <tr>
      <th>11960</th>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>671.348911</td>
      <td>38.0</td>
    </tr>
    <tr>
      <th>11961</th>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>671.348911</td>
      <td>37.0</td>
    </tr>
    <tr>
      <th>11962</th>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>671.348911</td>
      <td>15.0</td>
    </tr>
    <tr>
      <th>11963</th>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>671.348911</td>
      <td>18.0</td>
    </tr>
    <tr>
      <th>11964</th>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>671.348911</td>
      <td>24.0</td>
    </tr>
  </tbody>
</table>
</div>


## Polars: .over()

This cell demonstrates:
- **Window (.over)**: Compute a value per row based on its group, without collapsing rows. Like SQL OVER(PARTITION BY).
- **Rank**: Assign a rank number to each row within its group, ordered by a column.
- **Filter**: Keep only rows matching a condition.
- **Select**: Choose specific columns, optionally transforming them.


```python
display(
    ohlcv_pl.filter(pl.col("symbol")=="ASML.AS")
    .with_columns(
        pl.col("close").mean().over("symbol").round(2).alias("avg_close"),
        pl.col("close").rank(descending=True).over("symbol").alias("rank"),
    ).select("date","close","avg_close","rank").tail(10)
)
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 4)</small><table border="1" class="dataframe"><thead><tr><th>date</th><th>close</th><th>avg_close</th><th>rank</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>671.35</td><td>7.0</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>671.35</td><td>12.0</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>671.35</td><td>33.0</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>671.35</td><td>16.0</td></tr><tr><td>2026-03-05</td><td>1186.0</td><td>671.35</td><td>27.0</td></tr><tr><td>2026-03-06</td><td>1147.0</td><td>671.35</td><td>38.0</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>671.35</td><td>37.0</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>671.35</td><td>15.0</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>671.35</td><td>18.0</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>671.35</td><td>24.0</td></tr></tbody></table></div>


## Rolling Windows

This cell demonstrates:
- **Rolling Window**: Compute statistics over a sliding window of N consecutive rows.
- **Sort**: Reorder rows by column values (Pandas).
- **Assign**: Add columns via method chaining (Pandas). Returns new DataFrame.
- **Tail**: Return the last N rows.


```python
asml_s=ohlcv_pd[ohlcv_pd["symbol"]=="ASML.AS"].sort_values("date")
display(asml_s.assign(
    sma_7=asml_s["close"].rolling(7).mean(),
    rolling_max=asml_s["close"].rolling(30).max(),
)[["date","close","sma_7","rolling_max"]].tail(10))
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
      <th>close</th>
      <th>sma_7</th>
      <th>rolling_max</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>11955</th>
      <td>2026-02-27</td>
      <td>1233.4</td>
      <td>1251.514286</td>
      <td>1288.4</td>
    </tr>
    <tr>
      <th>11956</th>
      <td>2026-03-02</td>
      <td>1210.4</td>
      <td>1247.542857</td>
      <td>1288.4</td>
    </tr>
    <tr>
      <th>11957</th>
      <td>2026-03-03</td>
      <td>1161.8</td>
      <td>1234.142857</td>
      <td>1288.4</td>
    </tr>
    <tr>
      <th>11958</th>
      <td>2026-03-04</td>
      <td>1199.8</td>
      <td>1227.085714</td>
      <td>1288.4</td>
    </tr>
    <tr>
      <th>11959</th>
      <td>2026-03-05</td>
      <td>1186.0</td>
      <td>1216.028571</td>
      <td>1288.4</td>
    </tr>
    <tr>
      <th>11960</th>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>1195.828571</td>
      <td>1288.4</td>
    </tr>
    <tr>
      <th>11961</th>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>1183.714286</td>
      <td>1288.4</td>
    </tr>
    <tr>
      <th>11962</th>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>1178.942857</td>
      <td>1288.4</td>
    </tr>
    <tr>
      <th>11963</th>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>1177.285714</td>
      <td>1288.4</td>
    </tr>
    <tr>
      <th>11964</th>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>1181.428571</td>
      <td>1288.4</td>
    </tr>
  </tbody>
</table>
</div>



```python
display(
    ohlcv_pl.filter(pl.col("symbol")=="ASML.AS").sort("date")
    .with_columns(
        pl.col("close").rolling_mean(7).alias("sma_7"),
        pl.col("close").rolling_max(30).alias("rolling_max"),
    ).select("date","close","sma_7","rolling_max").tail(10)
)
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 4)</small><table border="1" class="dataframe"><thead><tr><th>date</th><th>close</th><th>sma_7</th><th>rolling_max</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>1251.514286</td><td>1288.4</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>1247.542857</td><td>1288.4</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>1234.142857</td><td>1288.4</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>1227.085714</td><td>1288.4</td></tr><tr><td>2026-03-05</td><td>1186.0</td><td>1216.028571</td><td>1288.4</td></tr><tr><td>2026-03-06</td><td>1147.0</td><td>1195.828571</td><td>1288.4</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1183.714286</td><td>1288.4</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>1178.942857</td><td>1288.4</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1177.285714</td><td>1288.4</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1181.428571</td><td>1288.4</td></tr></tbody></table></div>


## Cumulative

This cell demonstrates:
- **Cumulative Sum**: Running total from the first row to the current row.
- **Cumulative Max**: Running maximum from the first row to the current row.
- **Filter**: Keep only rows matching a condition.
- **Select**: Choose specific columns, optionally transforming them.


```python
display(
    ohlcv_pl.filter(pl.col("symbol")=="ASML.AS").sort("date")
    .with_columns(
        pl.col("volume").cum_sum().alias("cum_vol"),
        pl.col("close").cum_max().alias("run_high"),
    ).select("date","close","volume","cum_vol","run_high").tail(10)
)
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 5)</small><table border="1" class="dataframe"><thead><tr><th>date</th><th>close</th><th>volume</th><th>cum_vol</th><th>run_high</th></tr><tr><td>date</td><td>f64</td><td>i64</td><td>i64</td><td>f64</td></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>1010698</td><td>938726541</td><td>1288.4</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>871267</td><td>939597808</td><td>1288.4</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>941945</td><td>940539753</td><td>1288.4</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>714587</td><td>941254340</td><td>1288.4</td></tr><tr><td>2026-03-05</td><td>1186.0</td><td>778081</td><td>942032421</td><td>1288.4</td></tr><tr><td>2026-03-06</td><td>1147.0</td><td>857271</td><td>942889692</td><td>1288.4</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>689086</td><td>943578778</td><td>1288.4</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>800815</td><td>944379593</td><td>1288.4</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>562904</td><td>944942497</td><td>1288.4</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>128223</td><td>945070720</td><td>1288.4</td></tr></tbody></table></div>


## Rank Within Groups

This cell demonstrates:
- **Window (.over)**: Compute a value per row based on its group, without collapsing rows. Like SQL OVER(PARTITION BY).
- **Rank**: Assign a rank number to each row within its group, ordered by a column.
- **Select**: Choose specific columns, optionally transforming them.
- **With Columns**: Add new columns or replace existing ones. All original columns are kept.


```python
display(
    scores_pl.with_columns(
        pl.col("composite_score").rank(descending=True).over("sector").alias("sector_rank")
    ).select("sector","symbol","composite_score","sector_rank")
    .sort("sector","sector_rank").head(15)
)
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (15, 4)</small><table border="1" class="dataframe"><thead><tr><th>sector</th><th>symbol</th><th>composite_score</th><th>sector_rank</th></tr><tr><td>str</td><td>str</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;Basic Materials&quot;</td><td>&quot;4063.T&quot;</td><td>0.344008</td><td>1.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;4063.T&quot;</td><td>0.245728</td><td>2.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;4063.T&quot;</td><td>0.24484</td><td>3.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;AI.PA&quot;</td><td>0.097187</td><td>4.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;AI.PA&quot;</td><td>0.088726</td><td>5.0</td></tr><tr><td>&hellip;</td><td>&hellip;</td><td>&hellip;</td><td>&hellip;</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;LIN&quot;</td><td>0.023257</td><td>11.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;RIO.AX&quot;</td><td>-0.017276</td><td>12.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;BHP.AX&quot;</td><td>-0.032021</td><td>13.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;RIO.AX&quot;</td><td>-0.068535</td><td>14.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;BAS.DE&quot;</td><td>-0.084199</td><td>15.0</td></tr></tbody></table></div>


## Lead / Lag

This cell demonstrates:
- **Shift (Lag/Lead)**: Access the previous row (shift(1)) or next row (shift(-1)) within each group.
- **Filter**: Keep only rows matching a condition.
- **Select**: Choose specific columns, optionally transforming them.
- **With Columns**: Add new columns or replace existing ones. All original columns are kept.


```python
display(
    ohlcv_pl.filter(pl.col("symbol")=="ASML.AS").sort("date")
    .with_columns(
        pl.col("close").shift(1).alias("prev_close"),
        pl.col("close").shift(-1).alias("next_close"),
    ).select("date","close","prev_close","next_close").tail(10)
)
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 4)</small><table border="1" class="dataframe"><thead><tr><th>date</th><th>close</th><th>prev_close</th><th>next_close</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>1232.4</td><td>1210.4</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>1233.4</td><td>1161.8</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>1210.4</td><td>1199.8</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>1161.8</td><td>1186.0</td></tr><tr><td>2026-03-05</td><td>1186.0</td><td>1199.8</td><td>1147.0</td></tr><tr><td>2026-03-06</td><td>1147.0</td><td>1186.0</td><td>1147.6</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1147.0</td><td>1200.0</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>1147.6</td><td>1198.8</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1200.0</td><td>1190.8</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1198.8</td><td>null</td></tr></tbody></table></div>


## Summary

| Op | Pandas | Polars |
|---|---|---|
| Window avg | groupby().transform() | .mean().over() |
| Rolling | .rolling(n).mean() | .rolling_mean(n) |
| Cumulative | .cumsum() | .cum_sum() |
| Rank | .rank() | .rank().over() |
| Shift | .shift(n) | .shift(n) |
