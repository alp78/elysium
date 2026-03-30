---
type: reference
category: programming-languages
technology:
  - python
  - pandas
  - polars
tags: [pipeline, python, pandas, polars]
aliases:
  - lazy evaluation, query plan, collect, benchmarks
keywords: [lazy, collect, scan_parquet, scan_csv, query plan, optimization, predicate pushdown, projection pushdown, benchmark]
description: "Pandas/Polars DataFrame reference 06/10 — Lazy API & Performance (lazy/collect, query plan, benchmarks). Side-by-side executable examples with cell outputs."
related:
  - "[moc-dataframes](/03-Dataframes/moc-dataframes)"
  - "[06_cs_lazy_performance](/03-Dataframes/Dataframes-CSharp/06_cs_lazy_performance)"
  - "[moc-programming-languages](/02-Programming-Languages/moc-programming-languages)"
  - "[05_py_aggregation_reshaping](/03-Dataframes/Dataframes-Python/05_py_aggregation_reshaping)"
  - "[07_py_types_interop](/03-Dataframes/Dataframes-Python/07_py_types_interop)"
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# 06 — Lazy API & Performance

Polars lazy execution, optimization, benchmarks.

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
import time
```

    OHLCV: (66355, 12), Dim: (169, 26), Scores: (466, 36)

## Eager: Immediate

> [!warning] Eager execution loads ALL data
>
> Eager execution loads ALL data into memory immediately
> `pl.read_parquet()` and `pd.read_parquet()` load the entire file into RAM. For files
> larger than available memory, use lazy mode (`pl.scan_parquet()`) or Pandas
> `read_parquet(columns=[...])` to only load needed columns.

```python
df = pl.read_parquet(DATA / "eurostoxx50_ohlcv.parquet")
print(f"Type: {type(df)}, Shape: {df.shape}")
```

    Type: <class 'polars.dataframe.frame.DataFrame'>, Shape: (66355, 12)

## Lazy: Deferred

The lazy-vs-eager distinction mirrors concepts elsewhere in the pipeline: dbt's ephemeral models defer computation in the same way a LazyFrame does, while `dbt run` materializes results like `.collect()` — see [dbt-materializations](/11-dbt/Modeling/dbt-materializations). BigQuery's query planner applies similar predicate pushdown and projection pruning, covered in [querying-and-cost-optimization](/06-GCP/BigQuery/querying-and-cost-optimization).


```python
lf = pl.scan_parquet(DATA / "eurostoxx50_ohlcv.parquet")
print(f"Type: {type(lf)}")
print(f"Schema: {lf.collect_schema()}")
```

    Type: <class 'polars.lazyframe.frame.LazyFrame'>
    Schema: Schema({'id': Int64, 'symbol': String, 'date': Date, 'open': Float64, 'high': Float64, 'low': Float64, 'close': Float64, 'adj_close': Float64, 'volume': Int64, 'dividends': Float64, 'stock_splits': Float64, 'is_filled': Boolean})

## .collect()

> [!danger] Forgetting .collect() is the most
>
> Forgetting `.collect()` is the most common Polars mistake
> A LazyFrame does nothing until `.collect()` is called. If you assign `lf.filter(...)` to
> a variable and never collect, no computation happens. Unlike Pandas (where every
> operation runs immediately), Polars lazy chains must end with `.collect()` to materialize
> results.

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

<div><!-- shape: (10, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>ASML.AS</td><td>2026-03-12</td><td>1190.8</td></tr><tr><td>ASML.AS</td><td>2026-03-11</td><td>1198.8</td></tr><tr><td>ASML.AS</td><td>2026-03-10</td><td>1200.0</td></tr><tr><td>ASML.AS</td><td>2026-03-09</td><td>1147.6</td></tr><tr><td>ASML.AS</td><td>2026-03-06</td><td>1147.0</td></tr><tr><td>ASML.AS</td><td>2026-03-05</td><td>1186.0</td></tr><tr><td>ASML.AS</td><td>2026-03-04</td><td>1199.8</td></tr><tr><td>ASML.AS</td><td>2026-03-03</td><td>1161.8</td></tr><tr><td>ASML.AS</td><td>2026-03-02</td><td>1210.4</td></tr><tr><td>ASML.AS</td><td>2026-02-27</td><td>1233.4</td></tr></tbody></table></div>

## Query Plan: explain()



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
    SELECTION: [([(col("symbol")) == ("ASML.AS")]) & ([(col("close")) > (900.0)])]
    ESTIMATED ROWS: 66355

## Predicate Pushdown



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


- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

```python
df = pl.read_parquet(DATA / "eurostoxx50_ohlcv.parquet")
result = df.lazy().filter(pl.col("symbol") == "ASML.AS").select("date", "close").collect()
print(f"Result: {result.shape}")
```

    Result: (1331, 2)

## Streaming Mode



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

<div><!-- shape: (7, 2) --><table><thead><tr><th>symbol</th><th>avg_close</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>RMS.PA</td><td>1761.56</td></tr><tr><td>ADYEN.AS</td><td>1545.98</td></tr><tr><td>RHM.DE</td><td>1230.09</td></tr><tr><td>ASML.AS</td><td>696.35</td></tr><tr><td>MC.PA</td><td>677.03</td></tr><tr><td>ARGX.BR</td><td>625.29</td></tr><tr><td>MUV2.DE</td><td>548.06</td></tr></tbody></table></div>

## profile()


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

<div><!-- shape: (2, 2) --><table><thead><tr><th>symbol</th><th>avg_ret</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>ASML.AS</td><td>-0.0162</td></tr><tr><td>MC.PA</td><td>-0.0045</td></tr></tbody></table></div>

<div><!-- shape: (3, 3) --><table><thead><tr><th>node</th><th>start</th><th>end</th></tr><tr><td>str</td><td>u64</td><td>u64</td></tr></thead><tbody><tr><td>optimization</td><td>0</td><td>2054</td></tr><tr><td>with_column(ret)</td><td>2054</td><td>2222</td></tr><tr><td>group_by(symbol)</td><td>2227</td><td>2566</td></tr></tbody></table></div>

## Pandas vs Polars Lazy Benchmark



```python
start = time.perf_counter()
pd.read_parquet(DATA / "eurostoxx50_ohlcv.parquet").query("symbol == 'ASML.AS'")[["symbol","date","close"]].sort_values("date", ascending=False).head(10)
pd_t = time.perf_counter() - start
start = time.perf_counter()
pl.scan_parquet(DATA / "eurostoxx50_ohlcv.parquet").filter(pl.col("symbol")=="ASML.AS").select("symbol","date","close").sort("date", descending=True).head(10).collect()
pl_t = time.perf_counter() - start
print(f"Pandas: {pd_t:.4f}s \nPolars lazy: {pl_t:.4f}s \nSpeedup: {pd_t/pl_t:.1f}x")
```

    Pandas: 0.0114s 
    Polars lazy: 0.0023s 
    Speedup: 5.1x

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

    iterrows (1K): 0.0116s
    vectorized (66K): 0.0003s

## Why apply() Is Slow

> [!danger] apply() is extremely slow
>
> `df.apply(axis=1)` is 100-1000x slower than vectorized operations.
> `apply()` with `axis=1` iterates row by row in Python — bypassing NumPy/C optimizations
> entirely. The example below shows a **743x** speedup from vectorization. Every
> `apply(lambda r: ...)` in production code is a performance bug. Rewrite using column
> arithmetic, `.where()`, or `np.select()` for conditional logic.

```python
start=time.perf_counter()
ohlcv_pd["ret_apply"]=ohlcv_pd.apply(lambda r:(r["close"]-r["open"])/r["open"]*100,axis=1)
apply_t=time.perf_counter()-start

start=time.perf_counter()
ohlcv_pd["ret_vec"]=(ohlcv_pd["close"]-ohlcv_pd["open"])/ohlcv_pd["open"]*100
vec_t=time.perf_counter()-start

print(f"apply: {apply_t:.4f}s\nvectorized: {vec_t:.4f}s\nSpeedup: {apply_t/vec_t:.0f}x")
```

    apply: 0.2317s
    vectorized: 0.0003s
    Speedup: 743x

## Memory Usage


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

      pd_filter      : 0.0019s
      pl_filter      : 0.0006s
      pd_groupby     : 0.0025s
      pl_groupby     : 0.0013s
      pd_sort        : 0.0064s
      pl_sort        : 0.0014s
    Filter speedup: 3.4x

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
