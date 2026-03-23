---
type: reference
category: programming-languages
technology: [python, pandas, polars]
tags: [reference, programming-languages, python, pandas, polars, lazy-evaluation, performance, optimization]
aliases: [Pandas Polars Lazy Performance, lazy collect, query plan, predicate pushdown, benchmark]
keywords: [pandas, polars, lazy, eager, collect, explain, query plan, predicate pushdown, projection pushdown, streaming, profile, benchmark, vectorized, apply, memory usage, performance]
description: "Polars lazy API and performance — eager vs lazy execution, collect, query plan, predicate/projection pushdown, streaming, profiling, benchmarks vs Pandas."
related:
  - "[[pandas-polars-index]]"
  - "[[06_combining_reshaping]]"
  - "[[08_types_interop]]"
  - "[[fastapi-and-polars]]"
created: 2026-03-23
updated: 2026-03-23
status: complete
---
# 07 — Lazy API & Performance

Polars lazy execution, optimization, benchmarks.


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

## Eager: Immediate

This cell demonstrates:
- **Read Parquet**: Load a Parquet file. Columnar format: faster and smaller than CSV.


```python
df = pl.read_parquet(DATA / "eurostoxx50_ohlcv.parquet")
print(f"Type: {type(df)}, Shape: {df.shape}")
```

    Type: <class 'polars.dataframe.frame.DataFrame'>, Shape: (66355, 12)
    

## Lazy: Deferred

This cell demonstrates:
- **Lazy Scan**: Create a LazyFrame without loading data. Execution deferred until .collect().


```python
lf = pl.scan_parquet(DATA / "eurostoxx50_ohlcv.parquet")
print(f"Type: {type(lf)}")
print(f"Schema: {lf.collect_schema()}")
```

    Type: <class 'polars.lazyframe.frame.LazyFrame'>
    Schema: Schema({'id': Int64, 'symbol': String, 'date': Date, 'open': Float64, 'high': Float64, 'low': Float64, 'close': Float64, 'adj_close': Float64, 'volume': Int64, 'dividends': Float64, 'stock_splits': Float64, 'is_filled': Boolean})
    

## .collect()

This cell demonstrates:
- **Filter**: Keep only rows matching a condition.
- **Select**: Choose specific columns, optionally transforming them.
- **Sort**: Reorder rows by column values.
- **Lazy Scan**: Create a LazyFrame without loading data. Execution deferred until .collect().


```python
result = (
    pl.scan_parquet(DATA / "eurostoxx50_ohlcv.parquet")
    .filter(pl.col("symbol") == "ASML.AS")
    .select("symbol", "date", "close")
    .sort("date", descending=True)
    .head(10)
    .collect()
)
display(result)
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (10, 3)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-12</td><td>1190.8</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-11</td><td>1198.8</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-10</td><td>1200.0</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-09</td><td>1147.6</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-06</td><td>1147.0</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-05</td><td>1186.0</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-04</td><td>1199.8</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-03</td><td>1161.8</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-03-02</td><td>1210.4</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2026-02-27</td><td>1233.4</td></tr></tbody></table></div>


## Query Plan: explain()

This cell demonstrates:
- **Filter**: Keep only rows matching a condition.
- **Select**: Choose specific columns, optionally transforming them.
- **Lazy Scan**: Create a LazyFrame without loading data. Execution deferred until .collect().
- **Explain**: Print the optimized query plan without executing.


```python
lf = (
    pl.scan_parquet(DATA / "eurostoxx50_ohlcv.parquet")
    .filter(pl.col("symbol") == "ASML.AS")
    .filter(pl.col("close") > 900)
    .select("symbol", "date", "close")
)
print(lf.explain())
```

    Parquet SCAN [../data/eurostoxx50_ohlcv.parquet]
    PROJECT 3/12 COLUMNS
    SELECTION: [([(col("close")) > (900.0)]) & ([(col("symbol")) == ("ASML.AS")])]
    ESTIMATED ROWS: 66355
    

## Predicate Pushdown

This cell demonstrates:
- **Filter**: Keep only rows matching a condition.
- **Select**: Choose specific columns, optionally transforming them.
- **Lazy Scan**: Create a LazyFrame without loading data. Execution deferred until .collect().
- **Explain**: Print the optimized query plan without executing.


```python
lf = (
    pl.scan_parquet(DATA / "eurostoxx50_ohlcv.parquet")
    .select("symbol", "date", "close")
    .filter(pl.col("symbol") == "ASML.AS")
)
print("Filter pushed to scan:")
print(lf.explain())
```

    Filter pushed to scan:
    Parquet SCAN [../data/eurostoxx50_ohlcv.parquet]
    PROJECT 3/12 COLUMNS
    SELECTION: [(col("symbol")) == ("ASML.AS")]
    ESTIMATED ROWS: 66355
    

## Projection Pushdown

This cell demonstrates:
- **Select**: Choose specific columns, optionally transforming them.
- **Lazy Scan**: Create a LazyFrame without loading data. Execution deferred until .collect().
- **Collect**: Execute the lazy query plan and return results.
- **Explain**: Print the optimized query plan without executing.


```python
lf = pl.scan_parquet(DATA / "eurostoxx50_ohlcv.parquet").select("symbol", "close")
print("Only 2 columns read:")
print(lf.explain())
print(f"Result: {lf.collect().shape}")
```

    Only 2 columns read:
    Parquet SCAN [../data/eurostoxx50_ohlcv.parquet]
    PROJECT 2/12 COLUMNS
    ESTIMATED ROWS: 66355
    Result: (66355, 2)
    

## .lazy() — Eager to Lazy

This cell demonstrates:
- **Filter**: Keep only rows matching a condition.
- **Select**: Choose specific columns, optionally transforming them.
- **Collect**: Execute the lazy query plan and return results.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.


```python
df = pl.read_parquet(DATA / "eurostoxx50_ohlcv.parquet")
result = df.lazy().filter(pl.col("symbol") == "ASML.AS").select("date", "close").collect()
print(f"Result: {result.shape}")
```

    Result: (1331, 2)
    

## Streaming Mode

This cell demonstrates:
- **Group By**: Split rows into groups by one or more columns, then apply aggregate functions to each group independently.
- **Aggregation**: Compute summary statistics (mean, sum, count, min, max) for each group. Returns one row per group.
- **Filter**: Keep only rows matching a condition.
- **Sort**: Reorder rows by column values.


```python
result = (
    pl.scan_parquet(DATA / "eurostoxx50_ohlcv.parquet")
    .filter(pl.col("close") > 500)
    .group_by("symbol").agg(pl.col("close").mean().round(2).alias("avg_close"))
    .sort("avg_close", descending=True)
    .collect(engine="streaming")
)
display(result.head(10))
```

    C:\Users\aperi\AppData\Local\Temp\ipykernel_12872\3751127500.py:6: DeprecationWarning: the `streaming` parameter was deprecated in 1.25.0; use `engine` instead.
      .collect(streaming=True)
    


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (7, 2)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>avg_close</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>&quot;RMS.PA&quot;</td><td>1761.56</td></tr><tr><td>&quot;ADYEN.AS&quot;</td><td>1545.98</td></tr><tr><td>&quot;RHM.DE&quot;</td><td>1230.09</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>696.35</td></tr><tr><td>&quot;MC.PA&quot;</td><td>677.03</td></tr><tr><td>&quot;ARGX.BR&quot;</td><td>625.29</td></tr><tr><td>&quot;MUV2.DE&quot;</td><td>548.06</td></tr></tbody></table></div>


## profile()

This cell demonstrates:
- **Group By**: Split rows into groups by one or more columns, then apply aggregate functions to each group independently.
- **Aggregation**: Compute summary statistics (mean, sum, count, min, max) for each group. Returns one row per group.
- **Filter**: Keep only rows matching a condition.
- **With Columns**: Add new columns or replace existing ones. All original columns are kept.


```python
lf = (
    pl.scan_parquet(DATA / "eurostoxx50_ohlcv.parquet")
    .filter(pl.col("symbol").is_in(["ASML.AS", "MC.PA"]))
    .with_columns(((pl.col("close") - pl.col("open")) / pl.col("open") * 100).alias("ret"))
    .group_by("symbol").agg(pl.col("ret").mean().round(4).alias("avg_ret"))
)
result_df, timing_df = lf.profile()
display(result_df)
display(timing_df)
```


<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (2, 2)</small><table border="1" class="dataframe"><thead><tr><th>symbol</th><th>avg_ret</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>-0.0162</td></tr><tr><td>&quot;MC.PA&quot;</td><td>-0.0045</td></tr></tbody></table></div>



<div><style>
.dataframe > thead > tr,
.dataframe > tbody > tr {
  text-align: right;
  white-space: pre-wrap;
}
</style>
<small>shape: (3, 3)</small><table border="1" class="dataframe"><thead><tr><th>node</th><th>start</th><th>end</th></tr><tr><td>str</td><td>u64</td><td>u64</td></tr></thead><tbody><tr><td>&quot;optimization&quot;</td><td>0</td><td>3297</td></tr><tr><td>&quot;with_column(ret)&quot;</td><td>3297</td><td>3450</td></tr><tr><td>&quot;group_by(symbol)&quot;</td><td>3456</td><td>3815</td></tr></tbody></table></div>


## Pandas vs Polars Lazy Benchmark

This cell demonstrates:
- **Filter**: Keep only rows matching a condition.
- **Query**: Filter rows using a string expression (Pandas).
- **Select**: Choose specific columns, optionally transforming them.
- **Sort**: Reorder rows by column values.


```python
import time
start = time.perf_counter()
pd.read_parquet(DATA / "eurostoxx50_ohlcv.parquet").query("symbol == 'ASML.AS'")[["symbol","date","close"]].sort_values("date", ascending=False).head(10)
pd_t = time.perf_counter() - start
start = time.perf_counter()
pl.scan_parquet(DATA / "eurostoxx50_ohlcv.parquet").filter(pl.col("symbol")=="ASML.AS").select("symbol","date","close").sort("date", descending=True).head(10).collect()
pl_t = time.perf_counter() - start
print(f"Pandas: {pd_t:.4f}s \nPolars lazy: {pl_t:.4f}s \nSpeedup: {pd_t/pl_t:.1f}x")
```

    Pandas: 0.0105s 
    Polars lazy: 0.0022s 
    Speedup: 4.8x
    

## Summary

| Feature | Polars Eager | Polars Lazy | Pandas |
|---|---|---|---|
| Execution | Immediate | .collect() | Immediate |
| Optimization | None | Pushdown | None |
| Memory | Full | Streaming | Full |
| Query plan | No | .explain() | No |
| Profile | No | .profile() | No |

---
# Part 2: Performance & Optimization


```python
ohlcv_pd=pd.read_parquet(DATA/"eurostoxx50_ohlcv.parquet")
ohlcv_pl=pl.read_parquet(DATA/"eurostoxx50_ohlcv.parquet")
print(f"Rows: {len(ohlcv_pd):,}")
```

    Rows: 66,355
    

## Vectorized vs Loop

This cell demonstrates:
- **Benchmark**: Measure execution time.
- **iterrows (Anti-pattern)**: Row-by-row iteration. Extremely slow. Use vectorized operations.
- **Head**: Return the first N rows.


```python
start=time.perf_counter()
results=[]
for _,row in ohlcv_pd.head(1000).iterrows():
    results.append(row["close"]-row["open"])
bad=time.perf_counter()-start
start=time.perf_counter()
_=ohlcv_pd["close"]-ohlcv_pd["open"]
good=time.perf_counter()-start
print(f"iterrows (1K): {bad:.4f}s")
print(f"vectorized (66K): {good:.4f}s")
```

    iterrows (1K): 0.0119s
    vectorized (66K): 0.0003s
    

## Why apply() Is Slow

This cell demonstrates:
- **Benchmark**: Measure execution time.
- **Apply**: Apply a function to each row/column. Slower than vectorized ops.


```python
start=time.perf_counter()
ohlcv_pd["ret_apply"]=ohlcv_pd.apply(lambda r:(r["close"]-r["open"])/r["open"]*100,axis=1)
apply_t=time.perf_counter()-start
start=time.perf_counter()
ohlcv_pd["ret_vec"]=(ohlcv_pd["close"]-ohlcv_pd["open"])/ohlcv_pd["open"]*100
vec_t=time.perf_counter()-start
print(f"apply: {apply_t:.4f}s, vectorized: {vec_t:.4f}s, Speedup: {apply_t/vec_t:.0f}x")
```

    apply: 0.2315s, vectorized: 0.0005s, Speedup: 479x
    

## Memory Usage

This cell demonstrates:
- **Memory Usage**: Measure RAM consumption (Pandas).


```python
mem_pd=ohlcv_pd.memory_usage(deep=True).sum()/1024/1024
mem_pl=ohlcv_pl.estimated_size("mb")
print(f"Pandas: {mem_pd:.2f} MB")
print(f"Polars: {mem_pl:.2f} MB")
print(f"Ratio: {mem_pd/mem_pl:.1f}x")
```

    Pandas: 11.65 MB
    Polars: 5.20 MB
    Ratio: 2.2x
    

## Benchmark: Common Operations

This cell demonstrates:
- **Group By**: Split rows into groups by one or more columns, then apply aggregate functions to each group independently.
- **Aggregation**: Compute summary statistics (mean, sum, count, min, max) for each group. Returns one row per group.
- **Filter**: Keep only rows matching a condition.
- **Sort**: Reorder rows by column values.


```python
ops={}
start=time.perf_counter()
_=ohlcv_pd[ohlcv_pd["symbol"]=="ASML.AS"]
ops["pd_filter"]=time.perf_counter()-start
start=time.perf_counter()
_=ohlcv_pl.filter(pl.col("symbol")=="ASML.AS")
ops["pl_filter"]=time.perf_counter()-start
start=time.perf_counter()
_=ohlcv_pd.groupby("symbol")["close"].mean()
ops["pd_groupby"]=time.perf_counter()-start
start=time.perf_counter()
_=ohlcv_pl.group_by("symbol").agg(pl.col("close").mean())
ops["pl_groupby"]=time.perf_counter()-start
start=time.perf_counter()
_=ohlcv_pd.sort_values(["symbol","date"])
ops["pd_sort"]=time.perf_counter()-start
start=time.perf_counter()
_=ohlcv_pl.sort("symbol","date")
ops["pl_sort"]=time.perf_counter()-start
for op,t in ops.items(): print(f"  {op:15s}: {t:.4f}s")
print(f"Filter speedup: {ops["pd_filter"]/ops["pl_filter"]:.1f}x")
```

      pd_filter      : 0.0020s
      pl_filter      : 0.0004s
      pd_groupby     : 0.0034s
      pl_groupby     : 0.0016s
      pd_sort        : 0.0068s
      pl_sort        : 0.0015s
    Filter speedup: 5.3x
    

## Polars Architecture

- Apache Arrow columnar format
- SIMD vector instructions
- Multi-threaded Rust engine
- Lazy query optimization


```python
print(f"Thread pool: {pl.thread_pool_size()}")
print(f"Polars version: {pl.__version__}")
```

    Thread pool: 16
    Polars version: 1.39.3
    

## Summary

| Aspect | Pandas | Polars |
|---|---|---|
| Engine | Single-threaded C | Multi-threaded Rust |
| Memory | NumPy arrays | Apache Arrow |
| Optimization | None | Query planning |
| apply() | Slow | Use expressions |
