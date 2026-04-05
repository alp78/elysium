---
title: "05. Aggregation & Reshaping - Python"
tags: [python, pandas, polars, dataframes]
aliases:
  - groupby, agg, window functions, join, concat, pivot, melt
description: "Pandas/Polars DataFrame reference 05/10 — Aggregation & Reshaping (groupby, agg, window functions, joins, pivot, melt). Side-by-side executable examples with cell outputs."
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# 05 — Aggregation & Reshaping

> [!quote]
> "Statistics are like bikinis. What they reveal is suggestive, but what they conceal is vital."
>
> — **Aaron Levenstein**

Group-by, aggregation, window functions, joins, concat, pivot, melt.

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

## Basic Group By

> [!warning] as_index=False vs as_index=True
>
> `as_index=False` vs `as_index=True` — fundamentally different output
> Pandas `groupby()` defaults to `as_index=True`, which puts group keys into the index.
> This breaks chaining with `.merge()` and makes the output unusable with many Pandas
> operations. Always use `as_index=False` for pipeline code to get a flat DataFrame.
>
> Polars `group_by()` always returns a flat DataFrame — no index concept exists.

> [!success] Always pass `as_index=False` in pipeline groupby calls
>
> Use `df.groupby("col", as_index=False).agg(...)` to get a flat DataFrame with group
> keys as regular columns. This makes the result chainable with `.merge()`, `.sort_values()`,
> and any downstream operation. In Polars, `group_by()` is always flat — no change needed.

> [!tip] Pandas named aggregation
>
> Pandas named aggregation — `.agg(new_name=("column", "func"))` — is the cleanest
> syntax for groupby. It names the output columns explicitly and avoids the confusing
> MultiIndex column headers that `.agg({"col": ["mean", "sum"]})` produces.

```python
# Pandas
display(
    ohlcv_pd.groupby("symbol", as_index=False)
    .agg(avg_close=("close", "mean"), total_volume=("volume", "sum"), trading_days=("date", "count"))
    .sort_values("avg_close", ascending=False)
    .head(10)
)
```

<table>
  <thead>
    <tr>
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

<div><!-- shape: (10, 4) --><table><thead><tr><th>symbol</th><th>avg_close</th><th>total_volume</th><th>trading_days</th></tr><tr><td>str</td><td>f64</td><td>i64</td><td>u32</td></tr></thead><tbody><tr><td>RMS.PA</td><td>1761.56</td><td>81633862</td><td>1331</td></tr><tr><td>ADYEN.AS</td><td>1545.98</td><td>110400463</td><td>1331</td></tr><tr><td>ASML.AS</td><td>671.35</td><td>945070720</td><td>1331</td></tr><tr><td>MC.PA</td><td>662.4</td><td>557855567</td><td>1331</td></tr><tr><td>RHM.DE</td><td>544.66</td><td>308359744</td><td>1324</td></tr><tr><td>ARGX.BR</td><td>413.69</td><td>94592244</td><td>1331</td></tr><tr><td>OR.PA</td><td>377.54</td><td>484115375</td><td>1331</td></tr><tr><td>MUV2.DE</td><td>374.66</td><td>398802950</td><td>1324</td></tr><tr><td>RACE.MI</td><td>289.75</td><td>476686026</td><td>1321</td></tr><tr><td>ALV.DE</td><td>252.19</td><td>1101960308</td><td>1324</td></tr></tbody></table></div>

## Multiple Grouping Columns

Pass a list of column names to `groupby()` / `group_by()` to create composite group keys. A common pattern is extracting a date part (year, month, quarter) as a new column and grouping on both symbol and that period — giving per-symbol per-period aggregates without a MultiIndex. Polars expresses the extraction inline with `.dt.year()` in a `.with_columns()` step; Pandas extracts to a new column first via `pd.to_datetime(...).dt.year`.

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

<table>
  <thead>
    <tr>
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

<div><!-- shape: (5, 4) --><table><thead><tr><th>symbol</th><th>year</th><th>avg_close</th><th>max_close</th></tr><tr><td>str</td><td>i32</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>ASML.AS</td><td>2026</td><td>1170.42</td><td>1288.4</td></tr><tr><td>ASML.AS</td><td>2025</td><td>724.61</td><td>963.4</td></tr><tr><td>ASML.AS</td><td>2024</td><td>799.26</td><td>1002.2</td></tr><tr><td>ASML.AS</td><td>2023</td><td>611.33</td><td>694.7</td></tr><tr><td>ASML.AS</td><td>2022</td><td>531.58</td><td>701.7</td></tr></tbody></table></div>

## Multiple Aggregation Functions

Both libraries support computing multiple aggregation functions in a single `groupby` pass, avoiding the cost of repeated scans. Pandas uses **named aggregation** syntax — `.agg(output_col=("input_col", "func"))` — which produces a flat DataFrame with explicitly named columns. Polars uses a list of expressions in `.agg()`, each chained with `.alias()`. Named aggregation in Pandas is preferred over the dict-of-lists form `.agg({"col": ["mean", "sum"]})`, which produces confusing MultiIndex column headers.

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

<table>
  <thead>
    <tr>
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

<div><!-- shape: (10, 7) --><table><thead><tr><th>symbol</th><th>mean_close</th><th>std_close</th><th>min_close</th><th>max_close</th><th>first_date</th><th>last_date</th></tr><tr><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>date</td><td>date</td></tr></thead><tbody><tr><td>RMS.PA</td><td>1761.56</td><td>481.32</td><td>842.6</td><td>2839.0</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>ADYEN.AS</td><td>1545.98</td><td>417.81</td><td>630.8</td><td>2766.0</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>ASML.AS</td><td>671.35</td><td>162.75</td><td>397.45</td><td>1288.4</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>MC.PA</td><td>662.4</td><td>103.5</td><td>437.55</td><td>902.0</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>RHM.DE</td><td>544.66</td><td>586.08</td><td>77.0</td><td>1988.5</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>ARGX.BR</td><td>413.69</td><td>142.73</td><td>208.8</td><td>803.0</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>OR.PA</td><td>377.54</td><td>37.18</td><td>290.1</td><td>456.9</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>MUV2.DE</td><td>374.66</td><td>123.05</td><td>209.15</td><td>610.6</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>RACE.MI</td><td>289.75</td><td>94.85</td><td>154.7</td><td>487.9</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>ALV.DE</td><td>252.19</td><td>62.47</td><td>159.62</td><td>392.7</td><td>2021-01-04</td><td>2026-03-12</td></tr></tbody></table></div>

## Transform: Same-Length Output

`groupby().transform()` broadcasts a group-level statistic back to every row in the original DataFrame without collapsing it. Use this when you need both the raw value and its group context on the same row — e.g., "what is ASML's close price vs its all-time group mean?". The output is always the same length as the input. Pandas uses `.transform("mean")` for this; Polars uses `.mean().over("group_col")` (covered in detail in Part 2).

```python
# Pandas: group mean alongside each row
asml_pd = ohlcv_pd[ohlcv_pd["symbol"] == "ASML.AS"].copy()
asml_pd["group_avg"] = asml_pd.groupby("symbol")["close"].transform("mean")
asml_pd["vs_avg"] = ((asml_pd["close"] - asml_pd["group_avg"]) / asml_pd["group_avg"] * 100).round(2)
display(asml_pd[["symbol", "date", "close", "group_avg", "vs_avg"]].tail(10))
```

<table>
  <thead>
    <tr>
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

> [!info] Polars equivalent: `.over()` window expression
>
> Polars replaces `.transform()` with `.mean().over("symbol")` inside `.with_columns()`.
> The result is identical — one group mean value broadcast across all rows — but Polars
> computes it as a window expression without mutating the DataFrame. See the full
> `.over()` examples in **Part 2 — Window Functions** below.

## Sector Analysis with Scores

Group the `scores` dimension table by `sector` to compute portfolio-level metrics: count of constituents, average composite and momentum scores, and total index weight per sector. This is a typical index analytics query — the result is a small 10-row frame (one row per sector) regardless of how many stocks are in the dataset.

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

<table>
  <thead>
    <tr>
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

<div><!-- shape: (10, 5) --><table><thead><tr><th>sector</th><th>stocks</th><th>avg_composite</th><th>avg_momentum</th><th>total_weight</th></tr><tr><td>str</td><td>u32</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>Technology</td><td>75</td><td>0.154</td><td>-0.1971</td><td>2.1478</td></tr><tr><td>Energy</td><td>34</td><td>0.1057</td><td>0.5028</td><td>1.1997</td></tr><tr><td>Industrials</td><td>66</td><td>0.0874</td><td>0.3035</td><td>1.3159</td></tr><tr><td>Communication Services</td><td>36</td><td>0.0494</td><td>-0.1825</td><td>1.0214</td></tr><tr><td>Basic Materials</td><td>18</td><td>0.043</td><td>0.4475</td><td>0.1854</td></tr><tr><td>Healthcare</td><td>45</td><td>0.0191</td><td>-0.2097</td><td>0.5436</td></tr><tr><td>Consumer Defensive</td><td>36</td><td>-0.0753</td><td>0.2477</td><td>0.4731</td></tr><tr><td>Financial Services</td><td>96</td><td>-0.09</td><td>-0.0565</td><td>1.4682</td></tr><tr><td>Utilities</td><td>6</td><td>-0.0994</td><td>0.7253</td><td>0.1337</td></tr><tr><td>Consumer Cyclical</td><td>54</td><td>-0.1374</td><td>-0.4132</td><td>1.4235</td></tr></tbody></table></div>

## Group By + Sort Pattern

To retrieve the top-N rows per group (e.g., top 3 stocks per sector by rank), pre-sort the DataFrame and then call `.group_by().head(n)`. This is more efficient than filtering with `rank().over()` and avoids a second sort pass. Polars `.group_by()` is unordered by default, so the pre-sort is essential — it determines which rows each group "sees first".

> [!info] Pandas equivalent: sort + groupby + head
>
> Pandas has no direct `.group_by().head()` method. The equivalent pattern is:
> ```python
> scores_pd.sort_values("composite_rank").groupby("sector", as_index=False).head(3)
> ```
> This works but returns rows in the original sorted order across all groups, not grouped.
> Chain `.sort_values(["sector", "composite_rank"])` after to match the Polars output layout.

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

<div><!-- shape: (30, 4) --><table><thead><tr><th>sector</th><th>symbol</th><th>composite_score</th><th>composite_rank</th></tr><tr><td>str</td><td>str</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>Basic Materials</td><td>4063.T</td><td>0.344008</td><td>7</td></tr><tr><td>Basic Materials</td><td>4063.T</td><td>0.24484</td><td>11</td></tr><tr><td>Basic Materials</td><td>4063.T</td><td>0.245728</td><td>12</td></tr><tr><td>Communication Services</td><td>DTE.DE</td><td>0.515005</td><td>2</td></tr><tr><td>Communication Services</td><td>DTE.DE</td><td>0.521442</td><td>2</td></tr><tr><td>Communication Services</td><td>DTE.DE</td><td>0.487049</td><td>3</td></tr><tr><td>Consumer Cyclical</td><td>VOW.DE</td><td>0.57561</td><td>2</td></tr><tr><td>Consumer Cyclical</td><td>VOW.DE</td><td>0.463323</td><td>3</td></tr><tr><td>Consumer Cyclical</td><td>7203.T</td><td>0.429936</td><td>3</td></tr><tr><td>Consumer Defensive</td><td>ABI.BR</td><td>0.42094</td><td>4</td></tr><tr><td>Consumer Defensive</td><td>ABI.BR</td><td>0.38521</td><td>5</td></tr><tr><td>Consumer Defensive</td><td>ABI.BR</td><td>0.406873</td><td>5</td></tr><tr><td>Energy</td><td>DVN</td><td>0.665507</td><td>1</td></tr><tr><td>Energy</td><td>VLO</td><td>0.49009</td><td>2</td></tr><tr><td>Energy</td><td>WDS.AX</td><td>0.490654</td><td>2</td></tr><tr><td>Financial Services</td><td>BNP.PA</td><td>0.679599</td><td>1</td></tr><tr><td>Financial Services</td><td>BNP.PA</td><td>0.663971</td><td>1</td></tr><tr><td>Financial Services</td><td>BNP.PA</td><td>0.683947</td><td>1</td></tr><tr><td>Healthcare</td><td>2269.HK</td><td>0.357499</td><td>5</td></tr><tr><td>Healthcare</td><td>4568.T</td><td>0.355843</td><td>6</td></tr><tr><td>Healthcare</td><td>4568.T</td><td>0.377455</td><td>6</td></tr><tr><td>Industrials</td><td>8001.T</td><td>0.478444</td><td>1</td></tr><tr><td>Industrials</td><td>8031.T</td><td>0.48932</td><td>2</td></tr><tr><td>Industrials</td><td>8001.T</td><td>0.46616</td><td>3</td></tr><tr><td>Technology</td><td>6981.T</td><td>0.494602</td><td>1</td></tr><tr><td>Technology</td><td>6981.T</td><td>0.546581</td><td>1</td></tr><tr><td>Technology</td><td>MU</td><td>0.925838</td><td>1</td></tr><tr><td>Utilities</td><td>ENEL.MI</td><td>0.039337</td><td>25</td></tr><tr><td>Utilities</td><td>ENEL.MI</td><td>0.018668</td><td>26</td></tr><tr><td>Utilities</td><td>ENEL.MI</td><td>0.002435</td><td>27</td></tr></tbody></table></div>

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
## Part 2: Window Functions

## Window Transform

Window functions compute per-row values that depend on a partition (group) of the data — without collapsing rows. They are the DataFrame equivalent of SQL `OVER(PARTITION BY col ORDER BY ...)`. Common uses: broadcasting a group mean or sum back to each row, computing within-group ranks, and rolling statistics scoped to a symbol's own history.

Window functions like `PARTITION BY` and `ROWS BETWEEN` appear across SQL and DataFrame APIs. The SQL Server gold layer in [gold-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/gold-transforms) applies the same ranking and running-total logic, and [bq-advanced](https://alp78.github.io/elysium/05-DB-Queries/BigQuery/bq-advanced) covers BigQuery window functions for identical analytical needs.

### Pandas | Window transform (groupby().transform())

`.groupby().transform(func)` applies `func` to each group and broadcasts the result back to the full-length DataFrame. It is the Pandas idiom for "add a group-level column without collapsing rows". The function receives each group's Series and must return a same-length Series. Common functions: `"mean"`, `"sum"`, `"rank"`, or a custom lambda.

```python
asml=ohlcv_pd[ohlcv_pd["symbol"]=="ASML.AS"].copy()
asml["avg_close"]=asml.groupby("symbol")["close"].transform("mean")
asml["rank"]=asml["close"].rank(ascending=False)
display(asml[["date","close","avg_close","rank"]].tail(10))
```

<table>
  <thead>
    <tr>
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

### Polars | Window transform (.over())

`.expr.over("group_col")` in Polars computes the expression within each partition defined by `group_col` and broadcasts the result back to each row — the exact equivalent of Pandas `.transform()`. Unlike `.transform()`, `.over()` can be chained with any expression (`.mean()`, `.rank()`, `.cum_sum()`) inside a single `.with_columns()` call without multiple passes. Multiple `.over()` expressions in one `.with_columns()` are computed in parallel.

```python
display(
    ohlcv_pl.filter(pl.col("symbol")=="ASML.AS")
    .with_columns(
        pl.col("close").mean().over("symbol").round(2).alias("avg_close"),
        pl.col("close").rank(descending=True).over("symbol").alias("rank"),
    ).select("date","close","avg_close","rank").tail(10)
)
```

<div><!-- shape: (10, 4) --><table><thead><tr><th>date</th><th>close</th><th>avg_close</th><th>rank</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>671.35</td><td>7.0</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>671.35</td><td>12.0</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>671.35</td><td>33.0</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>671.35</td><td>16.0</td></tr><tr><td>2026-03-05</td><td>1186.0</td><td>671.35</td><td>27.0</td></tr><tr><td>2026-03-06</td><td>1147.0</td><td>671.35</td><td>38.0</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>671.35</td><td>37.0</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>671.35</td><td>15.0</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>671.35</td><td>18.0</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>671.35</td><td>24.0</td></tr></tbody></table></div>

## Rolling Windows

A rolling window aggregation computes a statistic over the last N consecutive rows per row — the classic moving average. Pandas uses `.rolling(n).mean()` / `.rolling(n).max()` on a Series. Polars uses `.rolling_mean(window_size=n)` / `.rolling_max(window_size=n)` as expressions in `.with_columns()`. Both produce `null` / `NaN` for the first `n-1` rows where the window is incomplete.

> [!warning] Polars 1.x deprecated positional window size
>
> In Polars 0.x, `rolling_mean(7)` accepted the window size as a positional argument.
> **Polars 1.x requires the keyword argument:** `rolling_mean(window_size=7)`.
> The positional form raises a `DeprecationWarning` in 0.x and a `TypeError` in 1.x.
> Always use `window_size=` explicitly to future-proof your code.

```python
asml_s=ohlcv_pd[ohlcv_pd["symbol"]=="ASML.AS"].sort_values("date")
display(asml_s.assign(
    sma_7=asml_s["close"].rolling(7).mean(),
    rolling_max=asml_s["close"].rolling(30).max(),
)[["date","close","sma_7","rolling_max"]].tail(10))
```

<table>
  <thead>
    <tr>
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

```python
display(
    ohlcv_pl.filter(pl.col("symbol")=="ASML.AS").sort("date")
    .with_columns(
        pl.col("close").rolling_mean(window_size=7).alias("sma_7"),
        pl.col("close").rolling_max(window_size=30).alias("rolling_max"),
    ).select("date","close","sma_7","rolling_max").tail(10)
)
```

<div><!-- shape: (10, 4) --><table><thead><tr><th>date</th><th>close</th><th>sma_7</th><th>rolling_max</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>1251.514286</td><td>1288.4</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>1247.542857</td><td>1288.4</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>1234.142857</td><td>1288.4</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>1227.085714</td><td>1288.4</td></tr><tr><td>2026-03-05</td><td>1186.0</td><td>1216.028571</td><td>1288.4</td></tr><tr><td>2026-03-06</td><td>1147.0</td><td>1195.828571</td><td>1288.4</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1183.714286</td><td>1288.4</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>1178.942857</td><td>1288.4</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1177.285714</td><td>1288.4</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1181.428571</td><td>1288.4</td></tr></tbody></table></div>

## Cumulative

Cumulative (running) aggregations compute a running total, maximum, or count from the first row to the current row. Use `cum_sum` on volume to track total shares traded to date; use `cum_max` on price to track the running all-time high. Both operations produce the same length as the input. Ensure the DataFrame is sorted by date before applying cumulative operations — both Pandas and Polars process rows in storage order.

```python
# Pandas: cumulative volume and running high
asml_pd_c = ohlcv_pd[ohlcv_pd["symbol"] == "ASML.AS"].sort_values("date")
display(
    asml_pd_c.assign(
        cum_vol=asml_pd_c["volume"].cumsum(),
        run_high=asml_pd_c["close"].cummax(),
    )[["date", "close", "volume", "cum_vol", "run_high"]].tail(10)
)
```

```python
# Polars: cum_sum / cum_max
display(
    ohlcv_pl.filter(pl.col("symbol")=="ASML.AS").sort("date")
    .with_columns(
        pl.col("volume").cum_sum().alias("cum_vol"),
        pl.col("close").cum_max().alias("run_high"),
    ).select("date","close","volume","cum_vol","run_high").tail(10)
)
```

<div><!-- shape: (10, 5) --><table><thead><tr><th>date</th><th>close</th><th>volume</th><th>cum_vol</th><th>run_high</th></tr><tr><td>date</td><td>f64</td><td>i64</td><td>i64</td><td>f64</td></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>1010698</td><td>938726541</td><td>1288.4</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>871267</td><td>939597808</td><td>1288.4</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>941945</td><td>940539753</td><td>1288.4</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>714587</td><td>941254340</td><td>1288.4</td></tr><tr><td>2026-03-05</td><td>1186.0</td><td>778081</td><td>942032421</td><td>1288.4</td></tr><tr><td>2026-03-06</td><td>1147.0</td><td>857271</td><td>942889692</td><td>1288.4</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>689086</td><td>943578778</td><td>1288.4</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>800815</td><td>944379593</td><td>1288.4</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>562904</td><td>944942497</td><td>1288.4</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>128223</td><td>945070720</td><td>1288.4</td></tr></tbody></table></div>

## Rank Within Groups

Within-group ranking assigns each row a rank number based on its value within its group, without collapsing the DataFrame. Use this to find the top-N stocks per sector, or to flag outliers within a group. Polars uses `.rank(descending=True).over("sector")` inside `.with_columns()`. Pandas uses `.groupby()["col"].rank(ascending=False)`, which also broadcasts the rank back to every row.

```python
# Pandas: rank within sector
display(
    scores_pd.assign(
        sector_rank=scores_pd.groupby("sector")["composite_score"].rank(ascending=False)
    )[["sector", "symbol", "composite_score", "sector_rank"]]
    .sort_values(["sector", "sector_rank"])
    .head(15)
)
```

```python
# Polars: .rank().over()
display(
    scores_pl.with_columns(
        pl.col("composite_score").rank(descending=True).over("sector").alias("sector_rank")
    ).select("sector","symbol","composite_score","sector_rank")
    .sort("sector","sector_rank").head(15)
)
```

<div><!-- shape: (15, 4) --><table><thead><tr><th>sector</th><th>symbol</th><th>composite_score</th><th>sector_rank</th></tr><tr><td>str</td><td>str</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>Basic Materials</td><td>4063.T</td><td>0.344008</td><td>1.0</td></tr><tr><td>Basic Materials</td><td>4063.T</td><td>0.245728</td><td>2.0</td></tr><tr><td>Basic Materials</td><td>4063.T</td><td>0.24484</td><td>3.0</td></tr><tr><td>Basic Materials</td><td>AI.PA</td><td>0.097187</td><td>4.0</td></tr><tr><td>Basic Materials</td><td>AI.PA</td><td>0.088726</td><td>5.0</td></tr><tr><td>Basic Materials</td><td>LIN</td><td>0.072093</td><td>6.0</td></tr><tr><td>Basic Materials</td><td>AI.PA</td><td>0.063075</td><td>7.0</td></tr><tr><td>Basic Materials</td><td>LIN</td><td>0.056958</td><td>8.0</td></tr><tr><td>Basic Materials</td><td>RIO.AX</td><td>0.04482</td><td>9.0</td></tr><tr><td>Basic Materials</td><td>BHP.AX</td><td>0.026917</td><td>10.0</td></tr><tr><td>Basic Materials</td><td>LIN</td><td>0.023257</td><td>11.0</td></tr><tr><td>Basic Materials</td><td>RIO.AX</td><td>-0.017276</td><td>12.0</td></tr><tr><td>Basic Materials</td><td>BHP.AX</td><td>-0.032021</td><td>13.0</td></tr><tr><td>Basic Materials</td><td>RIO.AX</td><td>-0.068535</td><td>14.0</td></tr><tr><td>Basic Materials</td><td>BAS.DE</td><td>-0.084199</td><td>15.0</td></tr></tbody></table></div>

## Lead / Lag

Shift (lag/lead) accesses the value from a previous (`shift(1)`) or future (`shift(-1)`) row. Use lag to compute daily returns (`close / prev_close - 1`) or to detect price-direction changes. The first row of a lag series and the last row of a lead series are `NaN` (Pandas) or `null` (Polars). Both use `.shift(n)` with the same sign convention: positive = look back, negative = look forward.

```python
# Pandas: shift
asml_pd_s = ohlcv_pd[ohlcv_pd["symbol"] == "ASML.AS"].sort_values("date")
display(
    asml_pd_s.assign(
        prev_close=asml_pd_s["close"].shift(1),
        next_close=asml_pd_s["close"].shift(-1),
    )[["date", "close", "prev_close", "next_close"]].tail(10)
)
```

```python
# Polars: shift
display(
    ohlcv_pl.filter(pl.col("symbol")=="ASML.AS").sort("date")
    .with_columns(
        pl.col("close").shift(1).alias("prev_close"),
        pl.col("close").shift(-1).alias("next_close"),
    ).select("date","close","prev_close","next_close").tail(10)
)
```

<div><!-- shape: (10, 4) --><table><thead><tr><th>date</th><th>close</th><th>prev_close</th><th>next_close</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>1232.4</td><td>1210.4</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>1233.4</td><td>1161.8</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>1210.4</td><td>1199.8</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>1161.8</td><td>1186.0</td></tr><tr><td>2026-03-05</td><td>1186.0</td><td>1199.8</td><td>1147.0</td></tr><tr><td>2026-03-06</td><td>1147.0</td><td>1186.0</td><td>1147.6</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1147.0</td><td>1200.0</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>1147.6</td><td>1198.8</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1200.0</td><td>1190.8</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1198.8</td><td>null</td></tr></tbody></table></div>

## Summary

| Op | Pandas | Polars |
|---|---|---|
| Window avg | groupby().transform() | .mean().over() |
| Rolling | .rolling(n).mean() | .rolling_mean(window_size=n) |
| Cumulative | .cumsum() | .cum_sum() |
| Rank | .rank() | .rank().over() |
| Shift | .shift(n) | .shift(n) |

---
## Part 3: Combining DataFrames

Combining DataFrames covers joins (key-based row matching), concatenation (stacking frames), and set-based filters (anti/semi). Both Pandas and Polars use SQL-style join semantics: inner, left, right, full outer, anti, semi, cross. The key API difference is that Pandas uses `.merge()` / `pd.merge()` while Polars uses `.join()`.

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

> [!danger] Silent row explosion on many-to-many joins
>
> If both DataFrames have duplicate keys and you don't set `validate=`, `merge()` produces
> a Cartesian product for those keys — your 66K row DataFrame can become millions of rows
> with no error or warning. **Always** add `validate='many_to_one'` or `validate='one_to_one'`
> to catch unexpected duplicates.
>
> ```python
> # Safe merge — raises MergeError if key relationship is violated
> result = ohlcv_pd.merge(dim_pd, on="symbol", validate="many_to_one")
> ```

> [!success] Use `validate=` on every merge to detect unexpected duplicates
>
> Pass `validate='many_to_one'` or `validate='one_to_one'` to `pd.merge()` / `.merge()`.
> A `MergeError` is raised immediately if the key cardinality violates the constraint,
> preventing silent row explosions. In Polars, use `.join_where()` or assert
> `result.shape[0] == left.shape[0]` after the join when the relationship should be many-to-one.

> [!warning] Pandas vs Polars merge defaults
>
> - Pandas `merge()` defaults to `how='inner'` — rows without matches are silently dropped
> - Polars `join()` defaults to `how='inner'` too, but uses different suffix behavior:
>   Pandas appends `_x`/`_y`, Polars appends `_right`

> [!success] Always specify `how=` explicitly and verify row counts after joining
>
> Always pass `how='inner'`, `how='left'`, etc. explicitly — never rely on defaults.
> After any join, assert `len(result) == expected` to catch silent row drops or explosions.
> In Polars, use `suffix="_right"` awareness or `rename()` the conflicting column before
> joining to avoid ambiguous column names.

```python
# Pandas
result_pd = ohlcv_pd.merge(dim_pd[["symbol", "short_name", "sector"]], on="symbol", how="inner")
print(f"Pandas inner: {len(result_pd)}")
display(result_pd[["symbol", "short_name", "date", "close", "sector"]].head(5))
```

    Pandas inner: 66355

<table>
  <thead>
    <tr>
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

```python
# Polars
result_pl = ohlcv_pl.join(dim_pl.select("symbol", "short_name", "sector"), on="symbol", how="inner")
print(f"Polars inner: {result_pl.height}")
display(result_pl.select("symbol", "short_name", "date", "close", "sector").head(5))
```

    Polars inner: 66355

<div><!-- shape: (5, 5) --><table><thead><tr><th>symbol</th><th>short_name</th><th>date</th><th>close</th><th>sector</th></tr><tr><td>str</td><td>str</td><td>date</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>ABI.BR</td><td>AB INBEV</td><td>2021-01-04</td><td>57.21</td><td>Consumer Defensive</td></tr><tr><td>ABI.BR</td><td>AB INBEV</td><td>2021-01-05</td><td>57.18</td><td>Consumer Defensive</td></tr><tr><td>ABI.BR</td><td>AB INBEV</td><td>2021-01-06</td><td>58.77</td><td>Consumer Defensive</td></tr><tr><td>ABI.BR</td><td>AB INBEV</td><td>2021-01-07</td><td>58.4</td><td>Consumer Defensive</td></tr><tr><td>ABI.BR</td><td>AB INBEV</td><td>2021-01-08</td><td>57.86</td><td>Consumer Defensive</td></tr></tbody></table></div>

## Left Join

> [!warning] Left join with duplicate keys
>
> Left join with duplicate keys silently multiplies rows
> This left join produces more rows than the left DataFrame because `scores_pd` has
> multiple rows per symbol (one per date). The output has `len(ohlcv) × scores_per_symbol`
> rows — a classic accidental many-to-many. Always check `len(result)` after a join.

> [!success] Deduplicate the right side before joining, or use `validate=`
>
> Before a left join, deduplicate the right DataFrame to one row per key:
> `scores_pd.drop_duplicates("symbol")`. Or keep only the latest score with
> `.sort_values("date").groupby("symbol").last().reset_index()`. Then assert
> `len(result) == len(ohlcv_pd)` to confirm no row multiplication occurred.

```python
# Pandas
result_pd = ohlcv_pd.merge(scores_pd[["symbol", "composite_score", "composite_rank"]], on="symbol", how="left")
display(result_pd[["symbol", "date", "close", "composite_score"]].head(5))
```

<table>
  <thead>
    <tr>
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

```python
# Polars
result_pl = ohlcv_pl.join(scores_pl.select("symbol", "composite_score", "composite_rank"), on="symbol", how="left")
display(result_pl.select("symbol", "date", "close", "composite_score").head(5))
```

<div><!-- shape: (5, 4) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>composite_score</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>0.406873</td></tr><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>0.42094</td></tr><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>0.38521</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>0.406873</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>0.42094</td></tr></tbody></table></div>

## Anti Join

An anti join returns rows from the left DataFrame that have **no match** in the right DataFrame. Use it to find coverage gaps: symbols in OHLCV that are not yet in the scores table, or securities missing from a dimension file. It is more readable than a `.merge()` followed by `df[df["col"].isna()]`.

> [!info] No native Pandas anti join
>
> Pandas has no `how='anti'` parameter. The equivalent is a left join with an indicator column:
> ```python
> result = ohlcv_pd.merge(scores_pd[["symbol"]].drop_duplicates(),
>                          on="symbol", how="left", indicator=True)
> anti = result[result["_merge"] == "left_only"].drop(columns="_merge")
> ```
> Or use `~df["symbol"].isin(other["symbol"])` for simple key-exclusion filters.

```python
# Polars: symbols in OHLCV not in scores
result = ohlcv_pl.select("symbol").unique().join(scores_pl.select("symbol").unique(), on="symbol", how="anti")
print(f"Symbols without scores: {result.height}")
display(result)
```

    Symbols without scores: 0

<div><!-- shape: (0, 1) --><table><thead><tr><th>symbol</th></tr><tr><td>str</td></tr></thead><tbody></tbody></table></div>

## Semi Join

A semi join returns rows from the left DataFrame that have **at least one match** in the right DataFrame — but it does not add any columns from the right side. Use it to filter a large fact table (OHLCV) down to only the symbols that exist in a dimension or scoring table, without risk of row duplication.

> [!info] No native Pandas semi join
>
> Pandas has no `how='semi'` parameter. The equivalent filter is:
> ```python
> semi = ohlcv_pd[ohlcv_pd["symbol"].isin(scores_pd["symbol"].unique())]
> ```
> This is efficient for simple key membership tests but does not generalize to multi-column join keys.

```python
result = ohlcv_pl.join(scores_pl.select("symbol").unique(), on="symbol", how="semi")
print(f"OHLCV rows with scores: {result.height} (of {ohlcv_pl.height})")
```

    OHLCV rows with scores: 66355 (of 66355)

## Cross Join

A cross join produces the Cartesian product of two DataFrames: every row in the left is paired with every row in the right. Result row count = `len(left) × len(right)`. Use this to generate all (symbol, date) combinations for a universe/calendar scaffold, then left-join actual prices onto it to expose gaps.

> [!warning] Row explosion risk
>
> Joining two tables of 50 and 1331 rows produces 66,550 rows. Joining OHLCV (66K rows)
> with itself produces 4.4 billion rows. Always apply `.select()` to the smallest possible
> subset before a cross join.

```python
syms = pl.DataFrame({"symbol": ["ASML.AS", "MC.PA"]})
dts = pl.DataFrame({"date": ["2026-03-01", "2026-03-02"]})
display(syms.join(dts, how="cross"))
```

<div><!-- shape: (4, 2) --><table><thead><tr><th>symbol</th><th>date</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>ASML.AS</td><td>2026-03-01</td></tr><tr><td>ASML.AS</td><td>2026-03-02</td></tr><tr><td>MC.PA</td><td>2026-03-01</td></tr><tr><td>MC.PA</td><td>2026-03-02</td></tr></tbody></table></div>

## Vertical Concat

Vertical concatenation stacks DataFrames on top of each other (adds rows). Both DataFrames must have compatible schemas — same column names and compatible types. Use this to combine data from multiple time periods, markets, or API pages into a single frame. Polars uses `pl.concat([df1, df2])`; Pandas uses `pd.concat([df1, df2], ignore_index=True)`. Always pass `ignore_index=True` in Pandas to reset the row index after concat — without it, duplicate index values are preserved, which breaks many downstream operations.

```python
# Pandas
combined_pd = pd.concat([ohlcv_pd.head(3), usa_pd.head(3)], ignore_index=True)
display(combined_pd[["symbol", "date", "close"]])
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

```python
# Polars
combined_pl = pl.concat([ohlcv_pl.head(3), usa_pl.head(3)])
display(combined_pl.select("symbol", "date", "close"))
```

<div><!-- shape: (6, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td></tr><tr><td>AAPL</td><td>2021-01-04</td><td>129.41</td></tr><tr><td>AAPL</td><td>2021-01-05</td><td>131.01</td></tr><tr><td>AAPL</td><td>2021-01-06</td><td>126.6</td></tr></tbody></table></div>

## Horizontal Concat

Horizontal concatenation adds columns side by side. Both DataFrames must have the same number of rows and no overlapping column names. Use this to attach a computed Series or a separate feature frame to an existing DataFrame. Polars uses `pl.concat([left, right], how="horizontal")`.

> [!info] Pandas equivalent: `pd.concat([left, right], axis=1)`
>
> In Pandas, horizontal concat is `pd.concat([df1, df2], axis=1)`. Unlike Polars, Pandas
> aligns on the index, so mismatched indexes produce `NaN` fill rather than an error.
> Use `.reset_index(drop=True)` on both frames before concat to avoid unintended alignment.

```python
left = pl.DataFrame({"symbol": ["A", "B"], "price": [100, 200]})
right = pl.DataFrame({"sector": ["Tech", "Luxury"]})
display(pl.concat([left, right], how="horizontal"))
```

<div><!-- shape: (2, 3) --><table><thead><tr><th>symbol</th><th>price</th><th>sector</th></tr><tr><td>str</td><td>i64</td><td>str</td></tr></thead><tbody><tr><td>A</td><td>100</td><td>Tech</td></tr><tr><td>B</td><td>200</td><td>Luxury</td></tr></tbody></table></div>

## Diagonal Concat (Polars Only)

Diagonal concat stacks DataFrames vertically even when their schemas differ. Columns present in one frame but absent in another are filled with `null`. Use this when combining data from heterogeneous sources — e.g., merging two API responses with slightly different field sets — without needing to align schemas manually first.

> [!info] No Pandas equivalent
>
> Pandas `pd.concat()` raises a column mismatch error when schemas differ unless
> `join='outer'` is specified, which fills missing columns with `NaN` — functionally
> similar but uses `NaN` (float) rather than native `null`, causing type coercion.

```python
a = pl.DataFrame({"symbol": ["A"], "close": [100.0]})
b = pl.DataFrame({"symbol": ["B"], "volume": [999]})
display(pl.concat([a, b], how="diagonal"))
```

<div><!-- shape: (2, 3) --><table><thead><tr><th>symbol</th><th>close</th><th>volume</th></tr><tr><td>str</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>A</td><td>100.0</td><td>null</td></tr><tr><td>B</td><td>null</td><td>999</td></tr></tbody></table></div>

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
## Part 4: Reshaping

Reshaping transforms the structure of a DataFrame without changing the underlying data. The two fundamental operations are **wide to long** (melt/unpivot — spread column names into rows) and **long to wide** (pivot — collapse row values into columns). Additional operations include explode (list column to rows), implode (rows to list), transpose, and one-hot encoding.

## Wide to Long: melt / unpivot

Melt (Pandas) / unpivot (Polars) converts a wide DataFrame — where multiple columns represent the same measurement at different points — into a long format where column names become values in a `variable` column and their values go into a `value` column. This is required before plotting multi-series charts, applying long-format aggregations, or loading into a normalized database table.

```python
# Pandas melt
asml_pd = ohlcv_pd[ohlcv_pd["symbol"]=="ASML.AS"][["date","open","high","low","close"]].tail(3)
display(asml_pd.melt(id_vars="date", var_name="price_type", value_name="price"))
```

<table>
  <thead>
    <tr>
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

```python
# Polars unpivot
asml_pl = ohlcv_pl.filter(pl.col("symbol")=="ASML.AS").select("date","open","high","low","close").tail(3)
display(asml_pl.unpivot(index="date", variable_name="price_type", value_name="price"))
```

<div><!-- shape: (12, 3) --><table><thead><tr><th>date</th><th>price_type</th><th>price</th></tr><tr><td>date</td><td>str</td><td>f64</td></tr></thead><tbody><tr><td>2026-03-10</td><td>open</td><td>1188.4</td></tr><tr><td>2026-03-11</td><td>open</td><td>1188.4</td></tr><tr><td>2026-03-12</td><td>open</td><td>1194.8</td></tr><tr><td>2026-03-10</td><td>high</td><td>1208.4</td></tr><tr><td>2026-03-11</td><td>high</td><td>1210.8</td></tr><tr><td>2026-03-12</td><td>high</td><td>1202.2</td></tr><tr><td>2026-03-10</td><td>low</td><td>1172.2</td></tr><tr><td>2026-03-11</td><td>low</td><td>1174.0</td></tr><tr><td>2026-03-12</td><td>low</td><td>1187.8</td></tr><tr><td>2026-03-10</td><td>close</td><td>1200.0</td></tr><tr><td>2026-03-11</td><td>close</td><td>1198.8</td></tr><tr><td>2026-03-12</td><td>close</td><td>1190.8</td></tr></tbody></table></div>

## Long to Wide: pivot

Pivot converts a long-format DataFrame into wide format by spreading the unique values of an `on` column into new columns, filling each cell with a corresponding `values` column. Use pivot to create a symbol-by-year close-price matrix from daily time series data, or to produce a sector-by-metric scorecard. Polars `.pivot(on=, index=, values=)` performs this eagerly; Pandas uses `pivot_table()` which also supports aggregation functions for duplicate index combinations.

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

<div><!-- shape: (3, 7) --><table><thead><tr><th>symbol</th><th>2024</th><th>2021</th><th>2026</th><th>2023</th><th>2022</th><th>2025</th></tr><tr><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>ASML.AS</td><td>799.26</td><td>593.61</td><td>1170.42</td><td>611.33</td><td>531.58</td><td>724.61</td></tr><tr><td>MC.PA</td><td>705.65</td><td>630.22</td><td>560.63</td><td>788.14</td><td>645.6</td><td>562.7</td></tr><tr><td>SAP.DE</td><td>188.51</td><td>116.57</td><td>182.11</td><td>122.43</td><td>96.91</td><td>243.04</td></tr></tbody></table></div>

## Explode

Explode expands a list-typed column so that each element in the list becomes its own row, repeating the non-list columns. Use this after a `group_by().agg(pl.col("x").implode())` to restore a collected list back to rows, or when ingesting JSON/Parquet data where one field contains a list of tags or events. Both Pandas and Polars support `.explode("col")`.

```python
df = pl.DataFrame({"symbol": ["ASML.AS","MC.PA"], "tags": [["tech","nl"],["luxury","fr"]]})
display(df.explode("tags"))
```

<div><!-- shape: (4, 2) --><table><thead><tr><th>symbol</th><th>tags</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>ASML.AS</td><td>tech</td></tr><tr><td>ASML.AS</td><td>nl</td></tr><tr><td>MC.PA</td><td>luxury</td></tr><tr><td>MC.PA</td><td>fr</td></tr></tbody></table></div>

## Implode

Implode (Polars only) is the inverse of explode: it collects all values in a group into a single `list[T]` column. Use it to create a "bag of symbols per sector" column, or to bundle related values before serializing to JSON. Pandas has no direct equivalent — the closest is `.groupby("sector")["symbol"].apply(list)`.

```python
display(scores_pl.group_by("sector").agg(pl.col("symbol").implode()).sort("sector").head(5))
```

<div><!-- shape: (5, 2) --><table><thead><tr><th>sector</th><th>symbol</th></tr><tr><td>str</td><td>list[str]</td></tr></thead><tbody><tr><td>Basic Materials</td><td>[AI.PA, BAS.DE, … LIN]</td></tr><tr><td>Communication Services</td><td>[DTE.DE, DTE.DE, … NFLX]</td></tr><tr><td>Consumer Cyclical</td><td>[VOW.DE, ADS.DE, … TSLA]</td></tr><tr><td>Consumer Defensive</td><td>[ABI.BR, AD.AS, … COST]</td></tr><tr><td>Energy</td><td>[TTE.PA, ENI.MI, … XOM]</td></tr></tbody></table></div>

## Transpose

Transpose swaps rows and columns — the row index becomes column names and vice versa. Use it to convert a small "symbol × metric" frame into a "metric × symbol" view, e.g., for display in a dashboard table. Polars `.transpose(include_header=True, column_names=col)` names the output columns from a string column in the input. Pandas uses `.T` (the transposed property). Both require a homogeneous schema (all numeric, or all string) for the transposed columns.

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

<div><!-- shape: (2, 3) --><table><thead><tr><th>symbol</th><th>composite_score</th><th>momentum_score</th></tr><tr><td>str</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>ASML.AS</td><td>0.176104</td><td>1.470134</td></tr><tr><td>MC.PA</td><td>-0.203769</td><td>-0.70792</td></tr></tbody></table></div>

<div><!-- shape: (2, 3) --><table><thead><tr><th>column</th><th>ASML.AS</th><th>MC.PA</th></tr><tr><td>str</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>composite_score</td><td>0.176104</td><td>-0.203769</td></tr><tr><td>momentum_score</td><td>1.470134</td><td>-0.70792</td></tr></tbody></table></div>

## One-Hot Encoding

One-hot encoding converts a categorical column into N binary columns (one per unique value), where each cell is 1 if the row belongs to that category and 0 otherwise. Required for ML feature engineering — most scikit-learn estimators require numeric input. Polars uses `.to_dummies()` on the DataFrame; Pandas uses `pd.get_dummies(df, columns=["sector"])`.

```python
df = pl.DataFrame({"sector": ["Tech","Luxury","Tech","Energy"]})
display(df.to_dummies())
```

<div><!-- shape: (4, 3) --><table><thead><tr><th>sector_Energy</th><th>sector_Luxury</th><th>sector_Tech</th></tr><tr><td>u8</td><td>u8</td><td>u8</td></tr></thead><tbody><tr><td>0</td><td>0</td><td>1</td></tr><tr><td>0</td><td>1</td><td>0</td></tr><tr><td>0</td><td>0</td><td>1</td></tr><tr><td>1</td><td>0</td><td>0</td></tr></tbody></table></div>

## Summary

| Op | Pandas | Polars |
|---|---|---|
| Wide to long | melt() | unpivot() |
| Long to wide | pivot_table() | pivot() |
| Explode | explode() | explode() |
| Implode | N/A | implode() |
| Transpose | .T | .transpose() |
| One-hot | get_dummies() | to_dummies() |
