---
title: "06. Lazy API & Performance - Python"
tags: [python, pandas, polars, dataframes]
aliases:
  - lazy evaluation, query plan, collect, benchmarks
description: "Pandas/Polars DataFrame reference 06/10 — Lazy API & Performance (lazy/collect, query plan, benchmarks). Side-by-side executable examples with cell outputs."
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# 06 — Lazy API & Performance

> [!quote]
> "Premature optimization is the root of all evil."
>
> — **Donald Knuth**, *Structured Programming with go to Statements* (1974)
>
> "The First Rule of Program Optimization: Don't do it. The Second Rule of Program Optimization (for experts only): Don't do it yet."
>
> — **Michael A. Jackson**, *Principles of Program Design* (1975)

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

### Pandas / Polars | Eager read

> [!warning] Eager execution loads ALL data
>
> Eager execution loads ALL data into memory immediately
> `pl.read_parquet()` and `pd.read_parquet()` load the entire file into RAM. For files
> larger than available memory, use lazy mode (`pl.scan_parquet()`) or Pandas
> `read_parquet(columns=[...])` to only load needed columns.

> [!success] Use lazy scanning or column selection to limit memory usage
>
> In Polars, replace `pl.read_parquet(path)` with `pl.scan_parquet(path)` and chain
> `.select()` / `.filter()` before `.collect()` — Polars will apply projection and
> predicate pushdown automatically. In Pandas, pass `columns=[...]` to `pd.read_parquet()`
> to load only the columns you need.

```python
df = pl.read_parquet(DATA / "eurostoxx50_ohlcv.parquet")
print(f"Type: {type(df)}, Shape: {df.shape}")
```

    Type: <class 'polars.dataframe.frame.DataFrame'>, Shape: (66355, 12)

## Lazy: Deferred

The lazy-vs-eager distinction mirrors concepts elsewhere in the pipeline: dbt's ephemeral models defer computation in the same way a LazyFrame does, while `dbt run` materializes results like `.collect()` — see [dbt-materializations](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-materializations). BigQuery's query planner applies similar predicate pushdown and projection pruning, covered in [querying-and-cost-optimization](https://alp78.github.io/elysium/06-GCP/BigQuery/querying-and-cost-optimization).

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#1a1b2e', 'primaryTextColor': '#c0caf5', 'primaryBorderColor': '#7aa2f7', 'lineColor': '#7aa2f7', 'background': '#1a1b2e', 'mainBkg': '#1f2335', 'clusterBkg': '#1f2335', 'titleColor': '#c0caf5', 'edgeLabelBackground': '#1f2335', 'fontFamily': 'monospace'}}}%%
flowchart LR
    A["pl.scan_parquet(path)\npl.scan_csv(path)"] -->|"LazyFrame\n(no data)"| B["Build query plan"]
    B --> C[".filter(pl.col(...))"]
    C --> D[".select(...)"]
    D --> E[".group_by / .sort\n.with_columns"]
    E -->|"Optimizer rewrites plan"| F[".collect()"]
    F --> G["DataFrame\n(materialized)"]
    B2["pd.read_parquet(path)"] -->|"DataFrame\n(all data loaded)"| G2["Immediate execution\n(no optimization)"]

    style A fill:#1f2335,stroke:#7aa2f7,color:#c0caf5
    style B fill:#1f2335,stroke:#7aa2f7,color:#c0caf5
    style C fill:#1f2335,stroke:#e0af68,color:#c0caf5
    style D fill:#1f2335,stroke:#e0af68,color:#c0caf5
    style E fill:#1f2335,stroke:#e0af68,color:#c0caf5
    style F fill:#1f2335,stroke:#f7768e,color:#f7768e
    style G fill:#1f2335,stroke:#9ece6a,color:#9ece6a
    style B2 fill:#1f2335,stroke:#f7768e,color:#c0caf5
    style G2 fill:#1f2335,stroke:#565f89,color:#c0caf5
```

### Polars | scan_parquet()

`pl.scan_parquet(path)` returns a `LazyFrame` — a description of work, not data. Call `.collect_schema()` to inspect the column names and types without reading any rows. The schema is derived from the Parquet file footer metadata.

```python
lf = pl.scan_parquet(DATA / "eurostoxx50_ohlcv.parquet")
print(f"Type: {type(lf)}")
print(f"Schema: {lf.collect_schema()}")
```

    Type: <class 'polars.lazyframe.frame.LazyFrame'>
    Schema: Schema({'id': Int64, 'symbol': String, 'date': Date, 'open': Float64, 'high': Float64, 'low': Float64, 'close': Float64, 'adj_close': Float64, 'volume': Int64, 'dividends': Float64, 'stock_splits': Float64, 'is_filled': Boolean})

## Collect

### Polars | .collect()

> [!danger] Forgetting .collect() is the most
>
> Forgetting `.collect()` is the most common Polars mistake
> A LazyFrame does nothing until `.collect()` is called. If you assign `lf.filter(...)` to
> a variable and never collect, no computation happens. Unlike Pandas (where every
> operation runs immediately), Polars lazy chains must end with `.collect()` to materialize
> results.

> [!success] Always end a Polars lazy chain with `.collect()`
>
> Every `pl.scan_*()` chain must terminate with `.collect()` to produce a DataFrame.
> Use type annotations (`lf: pl.LazyFrame`, `df: pl.DataFrame`) to catch missing
> `.collect()` calls at review time. If you need a partial result during development,
> chain `.head(100).collect()` first to verify the plan before collecting the full dataset.

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

## Query Plan

### Polars | explain()

`lf.explain()` returns the **optimized** query plan as a string without executing it. Read it to verify that Polars has applied predicate and projection pushdown. The key fields to look for:

- `PROJECT N/12 COLUMNS` — only N columns will be read from disk (projection pushdown active)
- `SELECTION: [...]` — the filter predicate has been pushed into the scanner
- `ESTIMATED ROWS` — Polars' row count estimate before execution

> [!tip] Always check `.explain()` before collecting on large datasets
>
> On a multi-GB Parquet file, call `lf.explain()` first to verify that `PROJECT` shows fewer columns than the total and that `SELECTION` contains your filter. If you see `PROJECT */N COLUMNS` with the full column count, your filter or select is not pushing down — check for unsupported expression types.

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

### Polars | Predicate pushdown

When you call `.filter()` on a `LazyFrame`, Polars moves the predicate into the file scanner at optimization time. For Parquet files, the scanner uses row group statistics to skip entire row groups that cannot satisfy the predicate — so unmatched rows are never deserialized into memory. The optimizer applies this even if you write the filter after a `.select()`.

> [!info] Pandas has no predicate pushdown
>
> `pd.read_parquet()` loads all rows unconditionally. The only way to limit rows in Pandas is to read all data first, then filter with `df.query()` or boolean indexing. To limit I/O in Pandas, use `pd.read_parquet(path, filters=[...])` which delegates pushdown to the `pyarrow` engine — but this is only available at read time, not as part of a chain.

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

### Polars | Projection pushdown

`.select()` on a `LazyFrame` tells Polars which columns are needed. At optimization time, the column list is pushed into the Parquet scanner, which reads only those byte ranges from disk — all other columns are completely skipped. The `.explain()` output shows `PROJECT N/12 COLUMNS` to confirm this is active.

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

## Eager to Lazy Conversion

### Polars | .lazy()

Call `.lazy()` on an existing `DataFrame` to enter the lazy API. The conversion is free — no data is copied. Use this when you have already read data eagerly but want to apply further operations with query optimization before collecting. `pl.col("name")` is the expression API entry point — it references a column by name and is the foundation for all Polars filter, select, and transform expressions.

```python
df = pl.read_parquet(DATA / "eurostoxx50_ohlcv.parquet")
result = df.lazy().filter(pl.col("symbol") == "ASML.AS").select("date", "close").collect()
print(f"Result: {result.shape}")
```

    Result: (1331, 2)

## Streaming Mode

### Polars | collect(engine="streaming")

Streaming mode processes data in chunks instead of loading the full dataset into memory at once. Pass `engine="streaming"` to `.collect()` to activate it. Use streaming for datasets larger than available RAM or when you want bounded memory usage on long-running aggregations.

> [!warning] Streaming engine is experimental in Polars v1
>
> Not all operations support streaming. Unsupported nodes fall back to in-memory execution silently. Check `.explain(streaming=True)` to see which plan nodes will stream. The new Polars streaming engine (introduced in v1) is more capable than the legacy `streaming=True` parameter from v0.x but remains under active development.

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

## Profile

### Polars | .profile()

`lf.profile()` executes the query and returns a tuple of `(result_df, timing_df)`. The `timing_df` contains one row per plan node with `start` and `end` timestamps in microseconds. Use it to identify which operation in a chain is the bottleneck before optimizing.

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

The `start` and `end` columns are in microseconds. Here, `optimization` took 2054 µs (plan rewriting), `with_column(ret)` took 168 µs, and `group_by` took 339 µs. Subtract `end - start` per row to find the slowest node — that is where to focus optimization effort.

## Pandas vs Polars Lazy Benchmark

### Pandas / Polars | Head query benchmark

Compares the same operation — filter one symbol, select three columns, sort by date descending, take top 10 — using Pandas eager execution vs Polars lazy execution. Pandas reads the full Parquet file then filters in memory. Polars scans with predicate and projection pushdown.

> [!question] When to choose Polars lazy over Pandas for read queries?
>
> For small DataFrames (< 100K rows, fits easily in memory), the difference is negligible and Pandas' familiar API may be preferable. Choose Polars lazy when: (1) data is larger than memory or growing toward that limit, (2) the query reads from Parquet and you can exploit projection/predicate pushdown, (3) the operation is part of a scheduled pipeline where throughput matters, or (4) you need reproducible multi-threaded performance.

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

## Performance & Optimization

### Setup | Reload datasets for benchmarking

Reloads both datasets into memory so the benchmark cells below have a clean baseline without any cached filtered subsets from earlier cells.

```python
ohlcv_pd=pd.read_parquet(DATA/"eurostoxx50_ohlcv.parquet")
ohlcv_pl=pl.read_parquet(DATA/"eurostoxx50_ohlcv.parquet")
print(f"Rows: {len(ohlcv_pd):,}")
```

    Rows: 66,355

## Vectorized vs Loop

### Pandas | iterrows() vs column arithmetic

`DataFrame.iterrows()` yields one Python dict per row, bypassing NumPy's C-level vectorization entirely. Column arithmetic (`df["a"] - df["b"]`) dispatches to NumPy's C implementation and processes all rows in a single SIMD-accelerated pass. The benchmark below measures `iterrows` over 1K rows vs column subtraction over the full 66K rows.

> [!info] Polars has no iterrows equivalent
>
> Polars DataFrames are immutable and expression-based — there is no row iteration API. All operations use `pl.col()` expressions that execute in parallel across the full column in Rust. This design eliminates the anti-pattern at the API level.

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

### Pandas | apply(axis=1) anti-pattern

> [!danger] apply() is extremely slow
>
> `df.apply(axis=1)` is 100-1000x slower than vectorized operations.
> `apply()` with `axis=1` iterates row by row in Python — bypassing NumPy/C optimizations
> entirely. The example below shows a **743x** speedup from vectorization. Every
> `apply(lambda r: ...)` in production code is a performance bug. Rewrite using column
> arithmetic, `.where()`, or `np.select()` for conditional logic.

> [!success] Replace `apply(axis=1)` with vectorized column arithmetic
>
> Rewrite row-wise lambdas as direct column operations:
> `df["ret"] = (df["close"] - df["open"]) / df["open"] * 100`.
> For conditional logic use `np.where()` or `np.select()` instead of `apply`.
> In Polars, use `pl.when().then().otherwise()` — all operations execute in parallel
> across columns in native Rust with no Python overhead.

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

### Pandas / Polars | RAM footprint comparison

Polars uses Apache Arrow as its in-memory format. Arrow stores data in typed, contiguous column buffers that are more compact than Pandas' NumPy arrays, which add per-array Python object overhead and use 8-byte floats for integer columns that contain `NaN`.

> [!info] Pandas uses NaN (float) for missing integers; Polars uses null
>
> In Pandas, an integer column with any missing value is silently promoted to `float64` to accommodate `NaN`. This doubles the memory footprint for integer columns with nulls and can cause silent precision loss for large integers. Polars uses a native `null` type backed by a validity bitmask — integer columns stay as `Int64` regardless of nulls, with no type coercion.

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

### Pandas / Polars | Filter, GroupBy, Sort

Measures three core operations — single-column equality filter, group-by mean aggregation, and multi-column sort — side by side on the same 66K-row dataset. Polars benefits from multi-threaded execution and Apache Arrow's cache-friendly columnar layout.

```python
ops = {}

start = time.perf_counter()
_ = ohlcv_pd[ohlcv_pd["symbol"] == "ASML.AS"]
ops["pd_filter"] = time.perf_counter() - start

start = time.perf_counter()
_ = ohlcv_pl.filter(pl.col("symbol") == "ASML.AS")
ops["pl_filter"] = time.perf_counter() - start

print(f"  pd_filter : {ops['pd_filter']:.4f}s")
print(f"  pl_filter : {ops['pl_filter']:.4f}s")
print(f"  Filter speedup: {ops['pd_filter'] / ops['pl_filter']:.1f}x")
```

      pd_filter : 0.0019s
      pl_filter : 0.0006s
      Filter speedup: 3.4x

```python
start = time.perf_counter()
_ = ohlcv_pd.groupby("symbol")["close"].mean()
ops["pd_groupby"] = time.perf_counter() - start

start = time.perf_counter()
_ = ohlcv_pl.group_by("symbol").agg(pl.col("close").mean())
ops["pl_groupby"] = time.perf_counter() - start

print(f"  pd_groupby : {ops['pd_groupby']:.4f}s")
print(f"  pl_groupby : {ops['pl_groupby']:.4f}s")
print(f"  GroupBy speedup: {ops['pd_groupby'] / ops['pl_groupby']:.1f}x")
```

      pd_groupby : 0.0025s
      pl_groupby : 0.0013s
      GroupBy speedup: 1.9x

```python
start = time.perf_counter()
_ = ohlcv_pd.sort_values(["symbol", "date"])
ops["pd_sort"] = time.perf_counter() - start

start = time.perf_counter()
_ = ohlcv_pl.sort("symbol", "date")
ops["pl_sort"] = time.perf_counter() - start

print(f"  pd_sort : {ops['pd_sort']:.4f}s")
print(f"  pl_sort : {ops['pl_sort']:.4f}s")
print(f"  Sort speedup: {ops['pd_sort'] / ops['pl_sort']:.1f}x")
```

      pd_sort : 0.0064s
      pl_sort : 0.0014s
      Sort speedup: 4.6x

## Polars Architecture

### Polars | Execution model

Polars is built on four pillars that together make it faster than Pandas for analytical workloads:

- **Apache Arrow** — columnar in-memory format; cache-friendly, zero-copy between Arrow-native systems (DuckDB, Pyarrow, Pandas 2.x Arrow backend)
- **SIMD vector instructions** — operations on column arrays use CPU vectorization (AVX2/AVX-512) to process multiple values per clock cycle
- **Multi-threaded Rust engine** — the thread pool size matches available CPU cores; group-by and sort operations partition work across threads automatically
- **Lazy query optimization** — the full pipeline is rewritten before execution: predicate pushdown, projection pushdown, common subexpression elimination

> [!info] Pandas and Polars have no shared index
>
> Pandas attaches an index to every DataFrame. The index enables label-based alignment in joins and assignments but is also a source of subtle bugs (misaligned index after filtering, accidental index-based join instead of column-based). Polars has no index — every operation is explicit and column-based. This makes Polars code more predictable but means you must use explicit join keys rather than relying on index alignment.

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
