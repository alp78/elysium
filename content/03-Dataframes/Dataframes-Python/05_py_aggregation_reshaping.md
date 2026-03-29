---
type: reference
category: programming-languages
technology:
  - python
  - pandas
  - polars
tags: [pipeline, python, pandas, polars]
aliases:
  - groupby, agg, window functions, join, concat, pivot, melt
keywords: [groupby, agg, over, rolling, shift, join, merge, concat, pivot, melt, explode, window functions]
description: "Pandas/Polars DataFrame reference 05/10 — Aggregation & Reshaping (groupby, agg, window functions, joins, pivot, melt). Side-by-side executable examples with cell outputs."
related:
  - "[[dataframes-index]]"
  - "[[05_cs_aggregation_reshaping]]"
  - "[[programming-languages-index]]"
  - "[[04_py_missing_strings_datetime]]"
  - "[[06_py_lazy_performance]]"
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# 05 — Aggregation & Reshaping

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

> [!warning] `as_index=False` vs `as_index=True` — fundamentally different output
> Pandas `groupby()` defaults to `as_index=True`, which puts group keys into the index.
> This breaks chaining with `.merge()` and makes the output unusable with many Pandas
> operations. Always use `as_index=False` for pipeline code to get a flat DataFrame.
>
> Polars `group_by()` always returns a flat DataFrame — no index concept exists.

> [!tip] Pandas named aggregation — `.agg(new_name=("column", "func"))` — is the cleanest
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

<div><!-- shape: (10, 4) --><table><thead><tr><th>symbol</th><th>avg_close</th><th>total_volume</th><th>trading_days</th></tr><tr><td>str</td><td>f64</td><td>i64</td><td>u32</td></tr></thead><tbody><tr><td>&quot;RMS.PA&quot;</td><td>1761.56</td><td>81633862</td><td>1331</td></tr><tr><td>&quot;ADYEN.AS&quot;</td><td>1545.98</td><td>110400463</td><td>1331</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>671.35</td><td>945070720</td><td>1331</td></tr><tr><td>&quot;MC.PA&quot;</td><td>662.4</td><td>557855567</td><td>1331</td></tr><tr><td>&quot;RHM.DE&quot;</td><td>544.66</td><td>308359744</td><td>1324</td></tr><tr><td>&quot;ARGX.BR&quot;</td><td>413.69</td><td>94592244</td><td>1331</td></tr><tr><td>&quot;OR.PA&quot;</td><td>377.54</td><td>484115375</td><td>1331</td></tr><tr><td>&quot;MUV2.DE&quot;</td><td>374.66</td><td>398802950</td><td>1324</td></tr><tr><td>&quot;RACE.MI&quot;</td><td>289.75</td><td>476686026</td><td>1321</td></tr><tr><td>&quot;ALV.DE&quot;</td><td>252.19</td><td>1101960308</td><td>1324</td></tr></tbody></table></div>

## Multiple Grouping Columns


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

<div><!-- shape: (5, 4) --><table><thead><tr><th>symbol</th><th>year</th><th>avg_close</th><th>max_close</th></tr><tr><td>str</td><td>i32</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2026</td><td>1170.42</td><td>1288.4</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2025</td><td>724.61</td><td>963.4</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2024</td><td>799.26</td><td>1002.2</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2023</td><td>611.33</td><td>694.7</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2022</td><td>531.58</td><td>701.7</td></tr></tbody></table></div>

## Multiple Aggregation Functions



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

<div><!-- shape: (10, 7) --><table><thead><tr><th>symbol</th><th>mean_close</th><th>std_close</th><th>min_close</th><th>max_close</th><th>first_date</th><th>last_date</th></tr><tr><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>date</td><td>date</td></tr></thead><tbody><tr><td>&quot;RMS.PA&quot;</td><td>1761.56</td><td>481.32</td><td>842.6</td><td>2839.0</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;ADYEN.AS&quot;</td><td>1545.98</td><td>417.81</td><td>630.8</td><td>2766.0</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>671.35</td><td>162.75</td><td>397.45</td><td>1288.4</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;MC.PA&quot;</td><td>662.4</td><td>103.5</td><td>437.55</td><td>902.0</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;RHM.DE&quot;</td><td>544.66</td><td>586.08</td><td>77.0</td><td>1988.5</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;ARGX.BR&quot;</td><td>413.69</td><td>142.73</td><td>208.8</td><td>803.0</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;OR.PA&quot;</td><td>377.54</td><td>37.18</td><td>290.1</td><td>456.9</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;MUV2.DE&quot;</td><td>374.66</td><td>123.05</td><td>209.15</td><td>610.6</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;RACE.MI&quot;</td><td>289.75</td><td>94.85</td><td>154.7</td><td>487.9</td><td>2021-01-04</td><td>2026-03-12</td></tr><tr><td>&quot;ALV.DE&quot;</td><td>252.19</td><td>62.47</td><td>159.62</td><td>392.7</td><td>2021-01-04</td><td>2026-03-12</td></tr></tbody></table></div>

## Transform: Same-Length Output


- **Tail**: Return the last N rows.

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

### Polars: .over() window expression


- **Window (.over)**: Compute a value per row based on its group, without collapsing rows. Like SQL OVER(PARTITION BY).
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

<div><!-- shape: (10, 5) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>group_avg</th><th>vs_avg</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2026-02-27</td><td>1233.4</td><td>671.35</td><td>83.72</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-02</td><td>1210.4</td><td>671.35</td><td>80.29</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-03</td><td>1161.8</td><td>671.35</td><td>73.05</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-04</td><td>1199.8</td><td>671.35</td><td>78.71</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-05</td><td>1186.0</td><td>671.35</td><td>76.66</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-06</td><td>1147.0</td><td>671.35</td><td>70.85</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-09</td><td>1147.6</td><td>671.35</td><td>70.94</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-10</td><td>1200.0</td><td>671.35</td><td>78.74</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-11</td><td>1198.8</td><td>671.35</td><td>78.57</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-12</td><td>1190.8</td><td>671.35</td><td>77.37</td></tr></tbody></table></div>

## Sector Analysis with Scores



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

<div><!-- shape: (10, 5) --><table><thead><tr><th>sector</th><th>stocks</th><th>avg_composite</th><th>avg_momentum</th><th>total_weight</th></tr><tr><td>str</td><td>u32</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;Technology&quot;</td><td>75</td><td>0.154</td><td>-0.1971</td><td>2.1478</td></tr><tr><td>&quot;Energy&quot;</td><td>34</td><td>0.1057</td><td>0.5028</td><td>1.1997</td></tr><tr><td>&quot;Industrials&quot;</td><td>66</td><td>0.0874</td><td>0.3035</td><td>1.3159</td></tr><tr><td>&quot;Communication Services&quot;</td><td>36</td><td>0.0494</td><td>-0.1825</td><td>1.0214</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>18</td><td>0.043</td><td>0.4475</td><td>0.1854</td></tr><tr><td>&quot;Healthcare&quot;</td><td>45</td><td>0.0191</td><td>-0.2097</td><td>0.5436</td></tr><tr><td>&quot;Consumer Defensive&quot;</td><td>36</td><td>-0.0753</td><td>0.2477</td><td>0.4731</td></tr><tr><td>&quot;Financial Services&quot;</td><td>96</td><td>-0.09</td><td>-0.0565</td><td>1.4682</td></tr><tr><td>&quot;Utilities&quot;</td><td>6</td><td>-0.0994</td><td>0.7253</td><td>0.1337</td></tr><tr><td>&quot;Consumer Cyclical&quot;</td><td>54</td><td>-0.1374</td><td>-0.4132</td><td>1.4235</td></tr></tbody></table></div>

## Group By + Sort Pattern



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

<div><!-- shape: (30, 4) --><table><thead><tr><th>sector</th><th>symbol</th><th>composite_score</th><th>composite_rank</th></tr><tr><td>str</td><td>str</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>&quot;Basic Materials&quot;</td><td>&quot;4063.T&quot;</td><td>0.344008</td><td>7</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;4063.T&quot;</td><td>0.24484</td><td>11</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;4063.T&quot;</td><td>0.245728</td><td>12</td></tr><tr><td>&quot;Communication Services&quot;</td><td>&quot;DTE.DE&quot;</td><td>0.515005</td><td>2</td></tr><tr><td>&quot;Communication Services&quot;</td><td>&quot;DTE.DE&quot;</td><td>0.521442</td><td>2</td></tr><tr><td>&quot;Communication Services&quot;</td><td>&quot;DTE.DE&quot;</td><td>0.487049</td><td>3</td></tr><tr><td>&quot;Consumer Cyclical&quot;</td><td>&quot;VOW.DE&quot;</td><td>0.57561</td><td>2</td></tr><tr><td>&quot;Consumer Cyclical&quot;</td><td>&quot;VOW.DE&quot;</td><td>0.463323</td><td>3</td></tr><tr><td>&quot;Consumer Cyclical&quot;</td><td>&quot;7203.T&quot;</td><td>0.429936</td><td>3</td></tr><tr><td>&quot;Consumer Defensive&quot;</td><td>&quot;ABI.BR&quot;</td><td>0.42094</td><td>4</td></tr><tr><td>&quot;Consumer Defensive&quot;</td><td>&quot;ABI.BR&quot;</td><td>0.38521</td><td>5</td></tr><tr><td>&quot;Consumer Defensive&quot;</td><td>&quot;ABI.BR&quot;</td><td>0.406873</td><td>5</td></tr><tr><td>&quot;Energy&quot;</td><td>&quot;DVN&quot;</td><td>0.665507</td><td>1</td></tr><tr><td>&quot;Energy&quot;</td><td>&quot;VLO&quot;</td><td>0.49009</td><td>2</td></tr><tr><td>&quot;Energy&quot;</td><td>&quot;WDS.AX&quot;</td><td>0.490654</td><td>2</td></tr><tr><td>&quot;Financial Services&quot;</td><td>&quot;BNP.PA&quot;</td><td>0.679599</td><td>1</td></tr><tr><td>&quot;Financial Services&quot;</td><td>&quot;BNP.PA&quot;</td><td>0.663971</td><td>1</td></tr><tr><td>&quot;Financial Services&quot;</td><td>&quot;BNP.PA&quot;</td><td>0.683947</td><td>1</td></tr><tr><td>&quot;Healthcare&quot;</td><td>&quot;2269.HK&quot;</td><td>0.357499</td><td>5</td></tr><tr><td>&quot;Healthcare&quot;</td><td>&quot;4568.T&quot;</td><td>0.355843</td><td>6</td></tr><tr><td>&quot;Healthcare&quot;</td><td>&quot;4568.T&quot;</td><td>0.377455</td><td>6</td></tr><tr><td>&quot;Industrials&quot;</td><td>&quot;8001.T&quot;</td><td>0.478444</td><td>1</td></tr><tr><td>&quot;Industrials&quot;</td><td>&quot;8031.T&quot;</td><td>0.48932</td><td>2</td></tr><tr><td>&quot;Industrials&quot;</td><td>&quot;8001.T&quot;</td><td>0.46616</td><td>3</td></tr><tr><td>&quot;Technology&quot;</td><td>&quot;6981.T&quot;</td><td>0.494602</td><td>1</td></tr><tr><td>&quot;Technology&quot;</td><td>&quot;6981.T&quot;</td><td>0.546581</td><td>1</td></tr><tr><td>&quot;Technology&quot;</td><td>&quot;MU&quot;</td><td>0.925838</td><td>1</td></tr><tr><td>&quot;Utilities&quot;</td><td>&quot;ENEL.MI&quot;</td><td>0.039337</td><td>25</td></tr><tr><td>&quot;Utilities&quot;</td><td>&quot;ENEL.MI&quot;</td><td>0.018668</td><td>26</td></tr><tr><td>&quot;Utilities&quot;</td><td>&quot;ENEL.MI&quot;</td><td>0.002435</td><td>27</td></tr></tbody></table></div>

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

## Window Transform

Window functions like `PARTITION BY` and `ROWS BETWEEN` appear across SQL and DataFrame APIs. For a cross-language comparison of these patterns, see [[sql-python-csharp-transforms]]. The SQL Server gold layer in [[gold-transforms]] applies the same ranking and running-total logic, and [[bq-advanced]] covers BigQuery window functions for identical analytical needs.

### Pandas Window Transform — groupby().transform()
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

### Polars Window Transform — .over()
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


- **Rolling Window**: Compute statistics over a sliding window of N consecutive rows.
- **Assign**: Add columns via method chaining (Pandas). Returns new DataFrame.
- **Tail**: Return the last N rows.

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
        pl.col("close").rolling_mean(7).alias("sma_7"),
        pl.col("close").rolling_max(30).alias("rolling_max"),
    ).select("date","close","sma_7","rolling_max").tail(10)
)
```

<div><!-- shape: (10, 4) --><table><thead><tr><th>date</th><th>close</th><th>sma_7</th><th>rolling_max</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>1251.514286</td><td>1288.4</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>1247.542857</td><td>1288.4</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>1234.142857</td><td>1288.4</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>1227.085714</td><td>1288.4</td></tr><tr><td>2026-03-05</td><td>1186.0</td><td>1216.028571</td><td>1288.4</td></tr><tr><td>2026-03-06</td><td>1147.0</td><td>1195.828571</td><td>1288.4</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1183.714286</td><td>1288.4</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>1178.942857</td><td>1288.4</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1177.285714</td><td>1288.4</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1181.428571</td><td>1288.4</td></tr></tbody></table></div>

## Cumulative


- **Cumulative Sum**: Running total from the first row to the current row.
- **Cumulative Max**: Running maximum from the first row to the current row.

```python
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


- **Window (.over)**: Compute a value per row based on its group, without collapsing rows. Like SQL OVER(PARTITION BY).
- **Rank**: Assign a rank number to each row within its group, ordered by a column.
- **With Columns**: Add new columns or replace existing ones. All original columns are kept.

```python
display(
    scores_pl.with_columns(
        pl.col("composite_score").rank(descending=True).over("sector").alias("sector_rank")
    ).select("sector","symbol","composite_score","sector_rank")
    .sort("sector","sector_rank").head(15)
)
```

<div><!-- shape: (15, 4) --><table><thead><tr><th>sector</th><th>symbol</th><th>composite_score</th><th>sector_rank</th></tr><tr><td>str</td><td>str</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;Basic Materials&quot;</td><td>&quot;4063.T&quot;</td><td>0.344008</td><td>1.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;4063.T&quot;</td><td>0.245728</td><td>2.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;4063.T&quot;</td><td>0.24484</td><td>3.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;AI.PA&quot;</td><td>0.097187</td><td>4.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;AI.PA&quot;</td><td>0.088726</td><td>5.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;LIN&quot;</td><td>0.072093</td><td>6.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;AI.PA&quot;</td><td>0.063075</td><td>7.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;LIN&quot;</td><td>0.056958</td><td>8.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;RIO.AX&quot;</td><td>0.04482</td><td>9.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;BHP.AX&quot;</td><td>0.026917</td><td>10.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;LIN&quot;</td><td>0.023257</td><td>11.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;RIO.AX&quot;</td><td>-0.017276</td><td>12.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;BHP.AX&quot;</td><td>-0.032021</td><td>13.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;RIO.AX&quot;</td><td>-0.068535</td><td>14.0</td></tr><tr><td>&quot;Basic Materials&quot;</td><td>&quot;BAS.DE&quot;</td><td>-0.084199</td><td>15.0</td></tr></tbody></table></div>

## Lead / Lag


- **Shift (Lag/Lead)**: Access the previous row (shift(1)) or next row (shift(-1)) within each group.
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

<div><!-- shape: (10, 4) --><table><thead><tr><th>date</th><th>close</th><th>prev_close</th><th>next_close</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>1232.4</td><td>1210.4</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>1233.4</td><td>1161.8</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>1210.4</td><td>1199.8</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>1161.8</td><td>1186.0</td></tr><tr><td>2026-03-05</td><td>1186.0</td><td>1199.8</td><td>1147.0</td></tr><tr><td>2026-03-06</td><td>1147.0</td><td>1186.0</td><td>1147.6</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1147.0</td><td>1200.0</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>1147.6</td><td>1198.8</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1200.0</td><td>1190.8</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1198.8</td><td>null</td></tr></tbody></table></div>

## Summary

| Op | Pandas | Polars |
|---|---|---|
| Window avg | groupby().transform() | .mean().over() |
| Rolling | .rolling(n).mean() | .rolling_mean(n) |
| Cumulative | .cumsum() | .cum_sum() |
| Rank | .rank() | .rank().over() |
| Shift | .shift(n) | .shift(n) |

---
# Part 3: Combining DataFrames

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
> If both DataFrames have duplicate keys and you don't set `validate=`, `merge()` produces
> a Cartesian product for those keys — your 66K row DataFrame can become millions of rows
> with no error or warning. **Always** add `validate='many_to_one'` or `validate='one_to_one'`
> to catch unexpected duplicates.
>
> ```python
> # Safe merge — raises MergeError if key relationship is violated
> result = ohlcv_pd.merge(dim_pd, on="symbol", validate="many_to_one")
> ```

> [!warning] Pandas vs Polars merge defaults
> - Pandas `merge()` defaults to `how='inner'` — rows without matches are silently dropped
> - Polars `join()` defaults to `how='inner'` too, but uses different suffix behavior:
>   Pandas appends `_x`/`_y`, Polars appends `_right`

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

<div><!-- shape: (5, 5) --><table><thead><tr><th>symbol</th><th>short_name</th><th>date</th><th>close</th><th>sector</th></tr><tr><td>str</td><td>str</td><td>date</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>&quot;AB INBEV&quot;</td><td>2021-01-04</td><td>57.21</td><td>&quot;Consumer Defensive&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;AB INBEV&quot;</td><td>2021-01-05</td><td>57.18</td><td>&quot;Consumer Defensive&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;AB INBEV&quot;</td><td>2021-01-06</td><td>58.77</td><td>&quot;Consumer Defensive&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;AB INBEV&quot;</td><td>2021-01-07</td><td>58.4</td><td>&quot;Consumer Defensive&quot;</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>&quot;AB INBEV&quot;</td><td>2021-01-08</td><td>57.86</td><td>&quot;Consumer Defensive&quot;</td></tr></tbody></table></div>

## Left Join

> [!warning] Left join with duplicate keys silently multiplies rows
> This left join produces more rows than the left DataFrame because `scores_pd` has
> multiple rows per symbol (one per date). The output has `len(ohlcv) × scores_per_symbol`
> rows — a classic accidental many-to-many. Always check `len(result)` after a join.

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

<div><!-- shape: (5, 4) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>composite_score</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>0.406873</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>0.42094</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>0.38521</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td><td>0.406873</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td><td>0.42094</td></tr></tbody></table></div>

## Anti Join


- **Unique**: Return distinct values or deduplicate rows.

```python
# Polars: symbols in OHLCV not in scores
result = ohlcv_pl.select("symbol").unique().join(scores_pl.select("symbol").unique(), on="symbol", how="anti")
print(f"Symbols without scores: {result.height}")
display(result)
```

    Symbols without scores: 0

<div><!-- shape: (0, 1) --><table><thead><tr><th>symbol</th></tr><tr><td>str</td></tr></thead><tbody></tbody></table></div>

## Semi Join


- **Unique**: Return distinct values or deduplicate rows.

```python
result = ohlcv_pl.join(scores_pl.select("symbol").unique(), on="symbol", how="semi")
print(f"OHLCV rows with scores: {result.height} (of {ohlcv_pl.height})")
```

    OHLCV rows with scores: 66355 (of 66355)

## Cross Join



```python
syms = pl.DataFrame({"symbol": ["ASML.AS", "MC.PA"]})
dts = pl.DataFrame({"date": ["2026-03-01", "2026-03-02"]})
display(syms.join(dts, how="cross"))
```

<div><!-- shape: (4, 2) --><table><thead><tr><th>symbol</th><th>date</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>&quot;2026-03-01&quot;</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>&quot;2026-03-02&quot;</td></tr><tr><td>&quot;MC.PA&quot;</td><td>&quot;2026-03-01&quot;</td></tr><tr><td>&quot;MC.PA&quot;</td><td>&quot;2026-03-02&quot;</td></tr></tbody></table></div>

## Vertical Concat


- **Concatenation**: Stack DataFrames vertically (add rows) or horizontally (add columns).

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

<div><!-- shape: (6, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td></tr><tr><td>&quot;AAPL&quot;</td><td>2021-01-04</td><td>129.41</td></tr><tr><td>&quot;AAPL&quot;</td><td>2021-01-05</td><td>131.01</td></tr><tr><td>&quot;AAPL&quot;</td><td>2021-01-06</td><td>126.6</td></tr></tbody></table></div>

## Horizontal Concat


- **Concatenation**: Stack DataFrames vertically (add rows) or horizontally (add columns).

```python
left = pl.DataFrame({"symbol": ["A", "B"], "price": [100, 200]})
right = pl.DataFrame({"sector": ["Tech", "Luxury"]})
display(pl.concat([left, right], how="horizontal"))
```

<div><!-- shape: (2, 3) --><table><thead><tr><th>symbol</th><th>price</th><th>sector</th></tr><tr><td>str</td><td>i64</td><td>str</td></tr></thead><tbody><tr><td>&quot;A&quot;</td><td>100</td><td>&quot;Tech&quot;</td></tr><tr><td>&quot;B&quot;</td><td>200</td><td>&quot;Luxury&quot;</td></tr></tbody></table></div>

## Diagonal Concat (Polars Only)


- **Concatenation**: Stack DataFrames vertically (add rows) or horizontally (add columns).

```python
a = pl.DataFrame({"symbol": ["A"], "close": [100.0]})
b = pl.DataFrame({"symbol": ["B"], "volume": [999]})
display(pl.concat([a, b], how="diagonal"))
```

<div><!-- shape: (2, 3) --><table><thead><tr><th>symbol</th><th>close</th><th>volume</th></tr><tr><td>str</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>&quot;A&quot;</td><td>100.0</td><td>null</td></tr><tr><td>&quot;B&quot;</td><td>null</td><td>999</td></tr></tbody></table></div>

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
# Part 4: Reshaping

## Wide to Long: melt / unpivot


- **Melt**: Convert wide format to long: column names become values in a new column (Pandas).
- **Tail**: Return the last N rows.

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

<div><!-- shape: (12, 3) --><table><thead><tr><th>date</th><th>price_type</th><th>price</th></tr><tr><td>date</td><td>str</td><td>f64</td></tr></thead><tbody><tr><td>2026-03-10</td><td>&quot;open&quot;</td><td>1188.4</td></tr><tr><td>2026-03-11</td><td>&quot;open&quot;</td><td>1188.4</td></tr><tr><td>2026-03-12</td><td>&quot;open&quot;</td><td>1194.8</td></tr><tr><td>2026-03-10</td><td>&quot;high&quot;</td><td>1208.4</td></tr><tr><td>2026-03-11</td><td>&quot;high&quot;</td><td>1210.8</td></tr><tr><td>2026-03-12</td><td>&quot;high&quot;</td><td>1202.2</td></tr><tr><td>2026-03-10</td><td>&quot;low&quot;</td><td>1172.2</td></tr><tr><td>2026-03-11</td><td>&quot;low&quot;</td><td>1174.0</td></tr><tr><td>2026-03-12</td><td>&quot;low&quot;</td><td>1187.8</td></tr><tr><td>2026-03-10</td><td>&quot;close&quot;</td><td>1200.0</td></tr><tr><td>2026-03-11</td><td>&quot;close&quot;</td><td>1198.8</td></tr><tr><td>2026-03-12</td><td>&quot;close&quot;</td><td>1190.8</td></tr></tbody></table></div>

## Long to Wide: pivot


- **Pivot**: Convert long format to wide: values in a column become new column headers.

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

<div><!-- shape: (3, 7) --><table><thead><tr><th>symbol</th><th>2024</th><th>2021</th><th>2026</th><th>2023</th><th>2022</th><th>2025</th></tr><tr><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>799.26</td><td>593.61</td><td>1170.42</td><td>611.33</td><td>531.58</td><td>724.61</td></tr><tr><td>&quot;MC.PA&quot;</td><td>705.65</td><td>630.22</td><td>560.63</td><td>788.14</td><td>645.6</td><td>562.7</td></tr><tr><td>&quot;SAP.DE&quot;</td><td>188.51</td><td>116.57</td><td>182.11</td><td>122.43</td><td>96.91</td><td>243.04</td></tr></tbody></table></div>

## Explode


- **Explode**: Expand a list column into multiple rows, one per list element.

```python
df = pl.DataFrame({"symbol": ["ASML.AS","MC.PA"], "tags": [["tech","nl"],["luxury","fr"]]})
display(df.explode("tags"))
```

<div><!-- shape: (4, 2) --><table><thead><tr><th>symbol</th><th>tags</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>&quot;tech&quot;</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>&quot;nl&quot;</td></tr><tr><td>&quot;MC.PA&quot;</td><td>&quot;luxury&quot;</td></tr><tr><td>&quot;MC.PA&quot;</td><td>&quot;fr&quot;</td></tr></tbody></table></div>

## Implode


- **Implode**: Collect multiple rows into a single list value per group.

```python
display(scores_pl.group_by("sector").agg(pl.col("symbol").implode()).sort("sector").head(5))
```

<div><!-- shape: (5, 2) --><table><thead><tr><th>sector</th><th>symbol</th></tr><tr><td>str</td><td>list[str]</td></tr></thead><tbody><tr><td>&quot;Basic Materials&quot;</td><td>[&quot;AI.PA&quot;, &quot;BAS.DE&quot;, … &quot;LIN&quot;]</td></tr><tr><td>&quot;Communication Services&quot;</td><td>[&quot;DTE.DE&quot;, &quot;DTE.DE&quot;, … &quot;NFLX&quot;]</td></tr><tr><td>&quot;Consumer Cyclical&quot;</td><td>[&quot;VOW.DE&quot;, &quot;ADS.DE&quot;, … &quot;TSLA&quot;]</td></tr><tr><td>&quot;Consumer Defensive&quot;</td><td>[&quot;ABI.BR&quot;, &quot;AD.AS&quot;, … &quot;COST&quot;]</td></tr><tr><td>&quot;Energy&quot;</td><td>[&quot;TTE.PA&quot;, &quot;ENI.MI&quot;, … &quot;XOM&quot;]</td></tr></tbody></table></div>

## Transpose


- **Transpose**: Swap rows and columns.

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

<div><!-- shape: (2, 3) --><table><thead><tr><th>symbol</th><th>composite_score</th><th>momentum_score</th></tr><tr><td>str</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>0.176104</td><td>1.470134</td></tr><tr><td>&quot;MC.PA&quot;</td><td>-0.203769</td><td>-0.70792</td></tr></tbody></table></div>

<div><!-- shape: (2, 3) --><table><thead><tr><th>column</th><th>ASML.AS</th><th>MC.PA</th></tr><tr><td>str</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;composite_score&quot;</td><td>0.176104</td><td>-0.203769</td></tr><tr><td>&quot;momentum_score&quot;</td><td>1.470134</td><td>-0.70792</td></tr></tbody></table></div>

## One-Hot Encoding


- **One-Hot Encoding**: Convert categories into binary 0/1 columns.

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
