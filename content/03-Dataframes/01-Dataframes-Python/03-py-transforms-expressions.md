---
title: "03 - Transforms, Expressions & Chaining - Python"
tags: [pipeline, python, pandas, polars]
aliases:
  - with_columns, assign, apply, map, when/then, method chaining
description: "Pandas/Polars DataFrame reference 03/10 — Transforms, Expressions & Chaining (with_columns, when/then, apply). Side-by-side executable examples with cell outputs."
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# Transforms, Expressions & Chaining - Python

> [!quote] Attributed Remark
>
> "If you torture the data long enough, it will confess to anything."
>
> — **Ronald Coase**, attributed remark (c. 1960s)

> [!abstract]- Summary
>
> Covers column creation, conditional derivation, expression composition, and fluent pipeline construction in Pandas and Polars, using EuroStoxx market, dimension, and scoring data to show how transforms stay readable, debuggable, and fast when expressed with native column operations instead of row-wise Python callbacks.
>
> **Setup & Data Loading**
> - Load and verify the three working datasets (`eurostoxx50_ohlcv`, `index_dim`, `scores_daily`) and confirm shape plus schema before transforming anything
> - Establish the baseline preview and dataset contract that the later examples mutate, enrich, and aggregate
>
> **Practical Transform Examples — scores_daily dataset**
> - Create and replace columns with direct Pandas assignment, `.assign()`, and Polars `.with_columns()`
> - Build real metrics such as return percentages, Z-scores, percentile ranks, conditional flags, and binned categories on live financial columns
> - Contrast `np.where` / `np.select` and Pandas boolean logic with Polars `when().then().otherwise()`
>
> **Column Transform API Lookup**
> - Compare Pandas and Polars APIs for in-place mutation versus returned DataFrames, conditional transforms, custom-function escape hatches, and column naming behavior
> - Surface the semantics that matter operationally: mutation safety, readability, and how each library names derived outputs
>
> **Part 2: Polars Expressions Deep Dive**
> - Use `pl.col()`, `pl.lit()`, `.alias()`, `pl.struct()`, casts, expression composition, and multi-column transforms as the core Polars transformation model
> - Show why expressions outperform `.map_elements()` and how `return_dtype=` plus explicit aliases prevent schema surprises
>
> **Part 3: Method Chaining & Pipes**
> - Compose fluent pipelines with `.filter()`, `.assign()`, `.with_columns()`, `.sort()`, and Pandas `.pipe()` for reusable DataFrame functions
> - Demonstrate when to keep a chain compact and when to break it into named intermediate variables for debugging and maintenance
>
> **Operations and safety**
> - Warnings: `.apply()` / `.map_elements()` are much slower than native expressions, missing `.alias()` can overwrite source columns, `SettingWithCopyWarning` signals a real Pandas bug, missing `.otherwise()` introduces nulls, arithmetic changes dtypes, and long chains can hide the failing step
> - Recommendations: 7 practices covering expression-first transforms, explicit naming, breaking long chains, sample-first validation, null handling, `pl.struct()` for multi-column custom functions, and post-transform schema assertions
> - Troubleshooting: 9 failure modes covering chained-indexing warnings, schema/type mismatches, alias collisions, cast failures, missing `return_dtype`, empty chains, all-null conditional outputs, unexpected float promotion, and unexpectedly slow transforms

> [!note]- Glossary
>
> **`with_columns()`**
> - A Polars method that adds derived columns or replaces existing ones while returning a new DataFrame instead of mutating the current object in place.
> - It is the main transformation entry point in this note because almost every Polars column derivation, recode, and conditional expression is expressed through it.
>
> > [!warning] Result must be captured
> >
> > `with_columns()` does not mutate the original DataFrame. If you do not assign the result or continue chaining from it, the transform is discarded.
>
> ---
>
> **`assign()`**
> - A Pandas method that adds or overwrites columns and returns a new DataFrame with the updated schema.
> - It matters here because it is the cleanest Pandas counterpart to Polars `with_columns()` for chainable, side-effect-controlled transforms.
>
> > [!warning] Direct assignment behaves differently
> >
> > `df["col"] = ...` mutates the object in place, while `.assign()` returns a new one. Mixing the two styles carelessly makes pipelines harder to reason about.
>
> ---
>
> **Expression**
> - In Polars, a declarative column operation built from expression constructors such as `pl.col()`, `pl.lit()`, and `pl.when()`.
> - It is the core abstraction of the note because native Polars transforms are composed from expressions rather than Python row callbacks.
>
> > [!info] Expressions describe work
> >
> > An expression is not a Series and not a Python function. It is a plan for how Polars should compute a result column.
>
> ---
>
> **`pl.col()`**
> - The Polars expression constructor used to reference one or more existing columns by name.
> - It matters because nearly every Polars transform in the note starts by selecting an input column through `pl.col()`.
>
> > [!warning] It does not read data immediately
> >
> > `pl.col("x")` builds an expression object, not a concrete Series. You still need `with_columns()`, `select()`, or another expression-consuming context to evaluate it.
>
> ---
>
> **`.alias()`**
> - A Polars expression method that gives an explicit output name to a derived column.
> - It matters because the note repeatedly derives new columns, and explicit aliases prevent accidental overwrites and ambiguous schemas.
>
> > [!warning] Omitted alias can overwrite source
> >
> > If a derived expression inherits the name of an input column, you may replace the original column unintentionally. Name every important derived output explicitly.
>
> ---
>
> **`pl.lit()`**
> - A Polars helper that turns a Python scalar into a broadcastable expression value.
> - It matters whenever the note adds fixed constants, default branches, or comparison values inside a larger expression tree.
>
> > [!warning] Python scalars are not always enough
> >
> > Some expression contexts require an explicit expression on both sides. Wrapping constants in `pl.lit()` avoids confusing type and expression-construction errors.
>
> ---
>
> **`when().then().otherwise()`**
> - Polars' conditional expression builder, analogous to SQL `CASE WHEN`, for choosing outputs based on one or more boolean conditions.
> - It matters because conditional transforms are a major theme in the note, from recoding and flags to bucketed financial logic.
>
> > [!warning] Missing `otherwise()` yields nulls
> >
> > If unmatched rows have no explicit fallback branch, Polars fills them with `null`. That can silently corrupt later aggregates or comparisons.
>
> ---
>
> **`np.where()` / `np.select()`**
> - NumPy conditional helpers commonly used in Pandas pipelines to build one-branch or multi-branch derived columns.
> - They matter because the note compares Pandas' conditional-transform idioms directly against Polars conditional expressions.
>
> > [!info] Good for vectorized Pandas branching
> >
> > These functions are vectorized and usually preferable to `.apply()` when the condition can be expressed with array logic.
>
> ---
>
> **`apply()` / `map_elements()`**
> - Row-wise Python callback mechanisms in Pandas and Polars used when native vectorized operations cannot express the logic directly.
> - They matter as the note's explicit last-resort escape hatch for complex custom transforms.
>
> > [!warning] Performance cliff
> >
> > A Python function executed per row is dramatically slower than native expressions. Reach for these methods only after ruling out built-in arithmetic, string, datetime, and conditional operations.
>
> ---
>
> **Method chaining**
> - A style where each DataFrame operation is called directly on the result of the previous one, producing a linear transform pipeline.
> - It matters because the note treats chainable transforms as the clearest way to express multi-step data preparation when the steps remain readable.
>
> > [!warning] Long chains hide failure points
> >
> > Once a chain becomes too long, debugging gets harder because the stack trace often points at the chain as a whole rather than the exact failing idea. Break long sequences into named steps.
>
> ---
>
> **`pipe()`**
> - A Pandas method that passes the DataFrame into a custom function while staying inside a fluent method chain.
> - It matters because the note uses it to keep reusable business logic composable without abandoning chaining style.
>
> > [!info] Polars uses plain functions instead
> >
> > Polars does not rely on a direct `pipe()` equivalent in the same way. Functions that take and return a DataFrame can simply be called around a chain.
>
> ---
>
> **Vectorization**
> - Column-wise execution using optimized native routines instead of Python loops over individual rows.
> - It matters because the entire performance argument in the note depends on using vectorized DataFrame operations whenever possible.
>
> > [!warning] Lambda syntax is not vectorization
> >
> > Code that looks compact can still be slow if it executes a Python function per element. Prefer library-native expressions and methods over lambdas by default.
>
> ---
>
> **SettingWithCopyWarning**
> - A Pandas warning raised when an assignment may be targeting a temporary slice rather than the original DataFrame.
> - It matters because transformation pipelines that modify views can appear to work while silently discarding the change.
>
> > [!danger] Warning points at a real correctness bug
> >
> > Suppressing the warning does not make the assignment safe. Fix the underlying ambiguity with `.copy()`, `.loc[...] = ...`, or a returned transform such as `.assign()`.
>
> ---
>
> **`pl.struct()`**
> - A Polars expression that packs multiple columns into a single struct value, similar to a lightweight row object.
> - It matters because it is the cleanest way in the note to feed multiple input columns into one custom expression or callback.
>
> > [!info] Best for multi-column custom logic
> >
> > When a custom function needs several fields at once, a struct keeps the inputs grouped without forcing multiple separate row-wise lookups.
>
> ---
>
> **Direct column assignment**
> - The Pandas pattern `df["new_col"] = expression`, which mutates the DataFrame by inserting or replacing a column directly.
> - It matters because the note contrasts this imperative style with safer returned-transform patterns such as `.assign()`.
>
> > [!warning] Mutation propagates outward
> >
> > If multiple parts of a notebook share the same DataFrame reference, direct assignment changes all downstream consumers of that object unless you copied it first.
>
> ---
>
> **`.copy()`**
> - A Pandas method that creates an explicit independent copy of a DataFrame rather than another reference to the same underlying object.
> - It matters because safe transformation stages in the note often begin by copying before mutating to avoid shared-reference bugs.
>
> > [!warning] Copy is a correctness boundary
> >
> > When you intend to mutate a DataFrame for one branch of work only, `.copy()` is not optional hygiene. It is what separates an isolated transform from silent shared-state mutation.
>
> ---
>
> **`return_dtype=`**
> - A Polars `map_elements()` parameter used to declare the output type of a custom Python callback.
> - It matters because custom functions in the note can otherwise produce ambiguous or inconsistent inferred schemas.
>
> > [!warning] Inference may be unstable
> >
> > If Polars cannot infer a single consistent result type from your callback, the transform can fail or produce an unexpected schema. Declare `return_dtype=` when the output type matters.

---

*Imports — Pandas, Polars, NumPy, polars.selectors.*
```python
# Imports — Pandas, Polars, NumPy, polars.selectors
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
```text
OHLCV: (66355, 12), Dim: (169, 26), Scores: (466, 36)
```

## Setup & Data Loading

### Dataset Verification

*Verify loaded datasets — shapes and column names.*
```python
# Verify loaded datasets — shapes and column names
print("ohlcv  :\n", ohlcv_pd.shape, "\n", list(ohlcv_pd.columns))
print("\ndim    :\n", dim_pd.shape, "\n", list(dim_pd.columns))
print("\nscores :\n", scores_pd.shape, "\n", list(scores_pd.columns))
```
```text
ohlcv  :
     (66355, 12)
     ['id', 'symbol', 'date', 'open', 'high', 'low', 'close', 'adj_close', 'volume', 'dividends', 'stock_splits', 'is_filled']

dim    :
     (169, 26)
     ['id', '_index', 'symbol', 'long_name', 'short_name', 'sector', 'sector_key', 'industry', 'industry_key', 'country', 'city', 'website', 'long_business_summary', 'exchange', 'full_exchange_name', 'exchange_timezone_name', 'exchange_timezone_short', 'currency', 'financial_currency', 'quote_type', 'market', 'range_start', 'price_data_start', 'valid_from', 'valid_to', 'is_current']

scores :
     (466, 36)
     ['id', '_index', 'symbol', 'score_date', 'sector', 'pe_zscore', 'pb_zscore', 'ev_ebitda_zscore', 'yield_zscore', 'relative_value_score', 'relative_value_rank', 'relative_strength', 'sma_50_ratio', 'sma_200_ratio', 'dist_from_52w_high', 'momentum_score', 'momentum_rank', 'implied_upside', 'recommendation_mean', 'price_falling_analysts_bullish', 'sentiment_score', 'sentiment_rank', 'composite_score', 'composite_rank', '_scored_at', 'sma_30_close', 'sma_90_close', 'market_cap', 'index_weight', 'short_name', 'country', 'current_price', 'day_change_pct', 'five_day_change_pct', 'ytd_change_pct', 'currency']
```

### Data Preview

*Preview Pandas OHLCV DataFrame.*
```python
# Preview Pandas OHLCV DataFrame
ohlcv_pd.head(3)
```
```text
id symbol       date  open  high   low  close  adj_close  volume  dividends  stock_splits  is_filled
0 21160 ABI.BR 2021-01-04 58.15 58.85 56.78  57.21    53.5761 1513937        0.0           0.0      False
1 21161 ABI.BR 2021-01-05 56.90 57.98 56.75  57.18    53.5480 1382722        0.0           0.0      False
2 21162 ABI.BR 2021-01-06 57.96 58.94 57.39  58.77    55.0370 1370204        0.0           0.0      False
```

*Preview Polars OHLCV DataFrame.*
```python
# Preview Polars OHLCV DataFrame
ohlcv_pl.head(3)
```
```text
shape: (3, 12)

 ('id', 'i64') ('symbol', 'str') ('date', 'date')  ('open', 'f64')  ('high', 'f64')  ('low', 'f64')  ('close', 'f64')  ('adj_close', 'f64')  ('volume', 'i64')  ('dividends', 'f64')  ('stock_splits', 'f64')  ('is_filled', 'bool')
         21160            ABI.BR       2021-01-04            58.15            58.85           56.78             57.21               53.5761            1513937                   0.0                      0.0                  False
         21161            ABI.BR       2021-01-05            56.90            57.98           56.75             57.18               53.5480            1382722                   0.0                      0.0                  False
         21162            ABI.BR       2021-01-06            57.96            58.94           57.39             58.77               55.0370            1370204                   0.0                      0.0                  False
```

---

### Pandas — Direct Column Assignment with df["col"] = expression

> [!info] Direct column assignment
>
> `df["col"] = expression` creates a new column in-place on the DataFrame. Fast for simple arithmetic but mutates the original — use `.copy()` first. Each column is a separate statement; no chaining.

> [!warning] Direct assignment mutates the original
>
> Direct assignment mutates the original DataFrame. Always `.copy()` first in pipelines to avoid corrupting shared references.

> [!success] .copy() before any column assignment in pipeline stages
>
> At the start of each pipeline stage, call `df = source_df.copy()` before adding or modifying columns. This prevents silent mutation of the shared source reference across multiple consumers. In Polars, `with_columns` always returns a new DataFrame — no copy needed.

*Runs `df = ohlcv_pd.copy()` and shows the resulting output.*
```python
df = ohlcv_pd.copy()
df["range"] = df["high"] - df["low"]
df[["symbol", "date", "high", "low", "range"]].head()
```
```text
symbol       date  high   low  range
0 ABI.BR 2021-01-04 58.85 56.78   2.07
1 ABI.BR 2021-01-05 57.98 56.75   1.23
2 ABI.BR 2021-01-06 58.94 57.39   1.55
3 ABI.BR 2021-01-07 58.86 57.88   0.98
4 ABI.BR 2021-01-08 58.40 57.43   0.97
```

*Overwrite an existing column.*
```python
# Overwrite an existing column
df = ohlcv_pd.copy()
df["volume"] = df["volume"] / 1_000_000  # express in millions
df[["symbol", "date", "volume"]].head()
```
```text
symbol       date   volume
0 ABI.BR 2021-01-04 1.513937
1 ABI.BR 2021-01-05 1.382722
2 ABI.BR 2021-01-06 1.370204
3 ABI.BR 2021-01-07 1.469911
4 ABI.BR 2021-01-08 1.428681
```

---

### Pandas assign() — create columns in a chainable pipeline

> [!info] Pandas assign() immutable columns
>
> `.assign()` returns a **new** DataFrame with added columns — the original is unchanged. Each keyword argument becomes a column name. Use `lambda d: ...` to reference the DataFrame being built, including columns created earlier in the same call (e.g., `range` is used in `pct_range`). This is the Pandas equivalent of Polars `.with_columns()` — enables method chaining.

*Runs `(ohlcv_pd` and shows the resulting output.*
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
```text
symbol       date  close  range    mid  pct_range
0 ABI.BR 2021-01-04  57.21   2.07 57.815   3.618249
1 ABI.BR 2021-01-05  57.18   1.23 57.365   2.151102
2 ABI.BR 2021-01-06  58.77   1.55 58.165   2.637400
3 ABI.BR 2021-01-07  58.40   0.98 58.370   1.678082
4 ABI.BR 2021-01-08  57.86   0.97 57.915   1.676460
```

---

### Polars with_columns() — add computed columns with expressions

> [!info] .with_columns() adds new columns using
>
> `.with_columns()` adds new columns using Polars expressions. `pl.col("name")` references a column; `.alias("new")` names the result. All original columns are kept. Multiple expressions in one call are computed **in parallel** — unlike Pandas `.assign()` which is sequential.

*with_columns context — add new columns, keep all originals.*
```python
# with_columns context — add new columns, keep all originals
ohlcv_pl.with_columns(
    (pl.col("high") - pl.col("low")).alias("range"),
    ((pl.col("high") + pl.col("low")) / 2).alias("mid"),
).select("symbol", "date", "close", "range", "mid").head()
```
```text
shape: (5, 5)

('symbol', 'str') ('date', 'date')  ('close', 'f64')  ('range', 'f64')  ('mid', 'f64')
           ABI.BR       2021-01-04             57.21              2.07          57.815
           ABI.BR       2021-01-05             57.18              1.23          57.365
           ABI.BR       2021-01-06             58.77              1.55          58.165
           ABI.BR       2021-01-07             58.40              0.98          58.370
           ABI.BR       2021-01-08             57.86              0.97          57.915
```

*Multiple derived columns in one call.*
```python
# Multiple derived columns in one call
ohlcv_pl.with_columns(
    (pl.col("high") - pl.col("low")).alias("range"),
    ((pl.col("high") + pl.col("low")) / 2).alias("mid"),
    (pl.col("volume") / 1_000_000).alias("vol_m"),
    ((pl.col("close") - pl.col("open")) / pl.col("open") * 100).alias("intraday_ret_pct"),
).head()
```
```text
shape: (5, 16)

 ('id', 'i64') ('symbol', 'str') ('date', 'date')  ('open', 'f64')  ('high', 'f64')  ('low', 'f64')  ('close', 'f64')  ('adj_close', 'f64')  ('volume', 'i64')  ('dividends', 'f64')  ('stock_splits', 'f64')  ('is_filled', 'bool')  ('range', 'f64')  ('mid', 'f64')  ('vol_m', 'f64')  ('intraday_ret_pct', 'f64')
         21160            ABI.BR       2021-01-04            58.15            58.85           56.78             57.21               53.5761            1513937                   0.0                      0.0                  False              2.07          57.815          1.513937                    -1.616509
         21161            ABI.BR       2021-01-05            56.90            57.98           56.75             57.18               53.5480            1382722                   0.0                      0.0                  False              1.23          57.365          1.382722                     0.492091
         21162            ABI.BR       2021-01-06            57.96            58.94           57.39             58.77               55.0370            1370204                   0.0                      0.0                  False              1.55          58.165          1.370204                     1.397516
         21163            ABI.BR       2021-01-07            58.68            58.86           57.88             58.40               54.6905            1469911                   0.0                      0.0                  False              0.98          58.370          1.469911                    -0.477164
         21164            ABI.BR       2021-01-08            58.16            58.40           57.43             57.86               54.1848            1428681                   0.0                      0.0                  False              0.97          57.915          1.428681                    -0.515818
```

---

### Polars select() + alias() — return only computed columns

> [!info] Polars select() returns subset columns
>
> `.select()` returns **only** the listed columns — unlike `.with_columns()` which keeps all originals. Use it when you want a lean result with just the columns you need. Combine with `.alias()` to rename computed expressions.

*Continuing expressions — chain methods on pl.col() results.*
```python
# Continuing expressions — chain methods on pl.col() results
ohlcv_pl.select(
    "symbol",
    "date",
    pl.col("close"),
    (pl.col("high") - pl.col("low")).alias("range"),
).head()
```
```text
shape: (5, 4)

('symbol', 'str') ('date', 'date')  ('close', 'f64')  ('range', 'f64')
           ABI.BR       2021-01-04             57.21              2.07
           ABI.BR       2021-01-05             57.18              1.23
           ABI.BR       2021-01-06             58.77              1.55
           ABI.BR       2021-01-07             58.40              0.98
           ABI.BR       2021-01-08             57.86              0.97
```

---

### Pandas apply() and map() — row-level and element-level transforms

> [!info] map() vs apply() behavior
>
> `.map()` applies a function to each **element** of a Series. `.apply()` applies a function to each **row** (axis=1) or **column** (axis=0) of a DataFrame. Both are Python-level loops under the hood.

> [!danger] apply() performance penalty
>
> `apply()` is 10-100x slower than vectorized operations. Use it only when no vectorized alternative exists (e.g., calling an external API per row, complex branching logic). For arithmetic, string, or date operations, always use vectorized methods first.

> [!success] Replace apply() with vectorized operations
>
> For string operations use `.str` accessor (`df["col"].str.split(".").str[0]`). For arithmetic use standard operators or NumPy ufuncs. For conditional logic use `np.where` / `np.select`. Reserve `apply()` only for row-wise calls to external APIs or logic that cannot be expressed with native methods.

*map — element-wise transformation on a Series.*
```python
# map — element-wise transformation on a Series
ohlcv_pd["symbol"].map(lambda t: t.split(".")[0]).head()
```
```text
symbol
0    ABI
1    ABI
2    ABI
3    ABI
4    ABI
```

*apply on a DataFrame — row-wise (axis=1).*
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
```text
0
0 down
1   up
2   up
3 down
4 down
5 down
6 down
7 down
8   up
9 flat
```

*apply on a Series.*
```python
# apply on a Series
ohlcv_pd["close"].apply(lambda x: round(x, 0)).head()
```
```text
close
0   57.0
1   57.0
2   59.0
3   58.0
4   58.0
```

---

### Polars map_elements() / map_batches() — custom Python functions on columns

> [!info] map_elements runs a Python function
>
> `map_elements` runs a Python function **per element** — analogous to Pandas `.apply()`. `map_batches` receives the **whole Series** at once — use it for NumPy interop or batch operations.

> [!warning] map_elements breaks Polars' query optimizer
>
> `map_elements` breaks Polars' query optimizer and runs in Python, not Rust. Always prefer native expressions. Use `map_elements` only when no expression equivalent exists.

> [!success] Use native Polars expressions instead of map_elements
>
> Replace `map_elements(lambda s: s.split(".")[0])` with `pl.col("symbol").str.split(".").list.first()`. For math operations use Polars arithmetic expressions directly. Native expressions stay in the Lazy query graph and benefit from predicate pushdown and parallel execution.

*map_elements — per-element Python function (slow, use sparingly).*
```python
# map_elements — per-element Python function (slow, use sparingly)
ohlcv_pl.with_columns(
    pl.col("symbol").map_elements(lambda t: t.split(".")[0], return_dtype=pl.String).alias("short_symbol")
).select("symbol", "short_symbol").head()
```
```text
shape: (5, 2)

('symbol', 'str') ('short_symbol', 'str')
           ABI.BR                     ABI
           ABI.BR                     ABI
           ABI.BR                     ABI
           ABI.BR                     ABI
           ABI.BR                     ABI
```

*map_batches — receives the full Series; great for NumPy UDFs.*
```python
# map_batches — receives the full Series; great for NumPy UDFs
ohlcv_pl.with_columns(
    pl.col("close").map_batches(lambda s: s.to_numpy() ** 0.5, return_dtype=pl.Float64).alias("sqrt_close")
).select("symbol", "date", "close", "sqrt_close").head()
```
```text
shape: (5, 4)

('symbol', 'str') ('date', 'date')  ('close', 'f64')  ('sqrt_close', 'f64')
           ABI.BR       2021-01-04             57.21               7.563729
           ABI.BR       2021-01-05             57.18               7.561746
           ABI.BR       2021-01-06             58.77               7.666159
           ABI.BR       2021-01-07             58.40               7.641989
           ABI.BR       2021-01-08             57.86               7.606576
```

---

### Pandas np.where() / np.select() — conditional column creation

> [!info] np.where() and np.select() conditionals
>
> `np.where(condition, true_val, false_val)` creates a column from a binary condition (if/else). For multiple conditions, use `np.select([cond1, cond2, ...], [val1, val2, ...], default=...)` — the Pandas equivalent of SQL `CASE WHEN`.

*np.where — binary condition (if/else).*
```python
# np.where — binary condition (if/else)
df = ohlcv_pd.copy()
df["direction"] = np.where(df["close"] > df["open"], "up", "down")
df[["symbol", "date", "open", "close", "direction"]].head()
```
```text
symbol       date  open  close direction
0 ABI.BR 2021-01-04 58.15  57.21      down
1 ABI.BR 2021-01-05 56.90  57.18        up
2 ABI.BR 2021-01-06 57.96  58.77        up
3 ABI.BR 2021-01-07 58.68  58.40      down
4 ABI.BR 2021-01-08 58.16  57.86      down
```

*np.select — multiple conditions.*
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
```text
symbol       date  open  close move
0 ABI.BR 2021-01-04 58.15  57.21 flat
1 ABI.BR 2021-01-05 56.90  57.18 flat
2 ABI.BR 2021-01-06 57.96  58.77 flat
3 ABI.BR 2021-01-07 58.68  58.40 flat
4 ABI.BR 2021-01-08 58.16  57.86 flat
5 ABI.BR 2021-01-11 57.73  56.61 flat
6 ABI.BR 2021-01-12 56.70  56.51 flat
7 ABI.BR 2021-01-13 56.50  56.48 flat
8 ABI.BR 2021-01-14 56.88  56.96 flat
9 ABI.BR 2021-01-15 56.74  56.74 flat
```

---

### Polars when() / then() / otherwise() — conditional expressions

> [!info] pl.when(cond).then(val).otherwise(val) is Polars' native CASE WHEN
>
> `pl.when(cond).then(val).otherwise(val)` is Polars' native `CASE WHEN` — equivalent to `np.where` in Pandas. Chain multiple `.when().then()` for multi-branch logic (like `np.select`). Runs in Rust, fully optimized.

*when/then/otherwise — binary condition (Polars equivalent of np.where).*
```python
# when/then/otherwise — binary condition (Polars equivalent of np.where)
ohlcv_pl.with_columns(
    pl.when(pl.col("close") > pl.col("open"))
      .then(pl.lit("up"))
      .otherwise(pl.lit("down"))
      .alias("direction")
).select("symbol", "date", "open", "close", "direction").head()
```
```text
shape: (5, 5)

('symbol', 'str') ('date', 'date')  ('open', 'f64')  ('close', 'f64') ('direction', 'str')
           ABI.BR       2021-01-04            58.15             57.21                 down
           ABI.BR       2021-01-05            56.90             57.18                   up
           ABI.BR       2021-01-06            57.96             58.77                   up
           ABI.BR       2021-01-07            58.68             58.40                 down
           ABI.BR       2021-01-08            58.16             57.86                 down
```

*Chained when — multiple buckets.*
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
```text
shape: (10, 5)

('symbol', 'str') ('date', 'date')  ('open', 'f64')  ('close', 'f64') ('move', 'str')
           ABI.BR       2021-01-04            58.15             57.21            flat
           ABI.BR       2021-01-05            56.90             57.18            flat
           ABI.BR       2021-01-06            57.96             58.77            flat
           ABI.BR       2021-01-07            58.68             58.40            flat
           ABI.BR       2021-01-08            58.16             57.86            flat
           ABI.BR       2021-01-11            57.73             56.61            flat
           ABI.BR       2021-01-12            56.70             56.51            flat
           ABI.BR       2021-01-13            56.50             56.48            flat
           ABI.BR       2021-01-14            56.88             56.96            flat
           ABI.BR       2021-01-15            56.74             56.74            flat
```

---

### Type Casting

#### Pandas astype() — cast column types

> [!info] Pandas astype() dtype casting
>
> `.astype("type")` converts a column to a different dtype. Common casts: `int64` → `float64` (for division), `object` → `category` (for memory), `str` → `datetime64` (for date ops). Returns a new Series — assign it back to the column.

_Demonstrates three common dtype casts on the OHLCV dataset: converts `volume` from `int64` to `float64` for division safety, parses `date` strings to `datetime64[ns]` via `pd.to_datetime()`, and re-encodes `symbol` as a memory-efficient `category` dtype — each using `.astype()`._

*astype — cast volume from int to float for division safety.*
```python
# astype — cast volume from int to float for division safety
df = ohlcv_pd.copy()
print("Before:", df["volume"].dtype)
df["volume"] = df["volume"].astype("float64")
print("After :", df["volume"].dtype)
```
```text
Before: int64
    After : float64
```

*Cast date string to datetime (if needed).*
```python
# Cast date string to datetime (if needed)
df = ohlcv_pd.copy()
df["date"] = pd.to_datetime(df["date"])
print(df["date"].dtype)
```
```text
datetime64[ns]
```

*Category type for low-cardinality strings.*
```python
# Category type for low-cardinality strings
df = ohlcv_pd.copy()
df["symbol"] = df["symbol"].astype("category")
print(df["symbol"].dtype)
print(df["symbol"].cat.categories[:5].tolist())
```
```text
category
    ['ABI.BR', 'AD.AS', 'ADS.DE', 'ADYEN.AS', 'AI.PA']
```

#### Polars cast() — cast column types

> [!info] .cast(pl.Type) converts a column's dtype
>
> `.cast(pl.Type)` converts a column's dtype within an expression. Use inside `.with_columns()` to cast in place, or `.alias()` to create a new column. Polars types: `pl.Float64`, `pl.Int32`, `pl.Utf8`, `pl.Date`, `pl.Boolean`.

> [!warning] .cast(strict=True) (default) raises an error
>
> `.cast(strict=True)` (default) raises an error on invalid values. Use `strict=False` to get nulls instead of errors — useful for dirty data.

> [!success] Use strict=False when casting dirty or untrusted data
>
> For columns sourced from external files or APIs, cast with `pl.col("col").cast(pl.Int64, strict=False)` — invalid values become `null` instead of raising. Follow with a null-count check (`df["col"].null_count()`) to quantify data quality before proceeding.

_Casts `volume` from `Int64` to `Float64`, then bulk-casts all numeric columns to `Float32` via the `cs.numeric()` selector, and finally re-encodes `symbol` as `Categorical` — printing the full schema after each operation to confirm the dtype changes._

*cast — convert volume from Int64 to Float64.*
```python
# cast — convert volume from Int64 to Float64
ohlcv_pl.with_columns(
    pl.col("volume").cast(pl.Float64).alias("volume_f64"),
).select("volume", "volume_f64").head()
```
```text
shape: (5, 2)

 ('volume', 'i64')  ('volume_f64', 'f64')
           1513937              1513937.0
           1382722              1382722.0
           1370204              1370204.0
           1469911              1469911.0
           1428681              1428681.0
```

*Cast multiple columns at once.*
```python
# Cast multiple columns at once
ohlcv_pl.with_columns(
    cs.numeric().cast(pl.Float32)
).dtypes
```
```text
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
```

*Enum / Categorical.*
```python
# Enum / Categorical
ohlcv_pl.with_columns(
    pl.col("symbol").cast(pl.Categorical)
).schema
```
```text
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
```

---

### .str Accessor — String Operations on DataFrame Columns

#### Pandas .str Accessor — string transforms

> [!info] .str gives access to vectorized
>
> `.str` gives access to vectorized string methods on a Series: `.str.upper()`, `.str.lower()`, `.str.contains()`, `.str.split()`, `.str.replace()`, `.str.extract()`. Works on `object` or `string` dtype columns. Much faster than `apply(lambda x: x.upper())`.

_Derives three new columns from `symbol`: uppercased text (`symbol_upper`), the ticker stub without exchange suffix (`symbol_short` via `.str.split(".").str[0]`), and a boolean flag for German-listed stocks (`has_de`). A second example strips the `.DE` exchange suffix using `.str.replace()` and `.str.strip()`._

*.str accessor — vectorized string operations on a column.*
```python
# .str accessor — vectorized string operations on a column
df = ohlcv_pd.copy()
df["symbol_upper"] = df["symbol"].str.upper()
df["symbol_short"] = df["symbol"].str.split(".").str[0]
df["has_de"]       = df["symbol"].str.contains("DE")
df[["symbol", "symbol_upper", "symbol_short", "has_de"]].head()
```
```text
symbol symbol_upper symbol_short  has_de
0 ABI.BR       ABI.BR          ABI   False
1 ABI.BR       ABI.BR          ABI   False
2 ABI.BR       ABI.BR          ABI   False
3 ABI.BR       ABI.BR          ABI   False
4 ABI.BR       ABI.BR          ABI   False
```

*Replace and strip.*
```python
# Replace and strip
df = ohlcv_pd.copy()
df["clean"] = df["symbol"].str.replace(".DE", "", regex=False).str.strip()
df[["symbol", "clean"]].drop_duplicates().head()
```
```text
symbol    clean
   0   ABI.BR   ABI.BR
1331    AD.AS    AD.AS
2662   ADS.DE      ADS
3986 ADYEN.AS ADYEN.AS
5317    AI.PA    AI.PA
```

#### Polars .str Accessor — string transforms

> [!info] Polars .str namespace: .str.to_uppercase(), .str.to_lowercase(),
>
> Polars `.str` namespace: `.str.to_uppercase()`, `.str.to_lowercase()`, `.str.contains()`, `.str.split()`, `.str.replace()`, `.str.extract()`. After `.str.split()` the result is a List column — chain `.list.first()`, `.list.last()`, `.list.len()` to extract elements.

_Replicates the same three string transformations on the Polars `symbol` column: uppercases via `.str.to_uppercase()`, extracts the ticker stub via `.str.split().list.first()`, and flags German listings via `.str.contains("DE")`. A second example strips the `.DE` exchange suffix using `.str.replace()` combined with `.str.strip_chars()`._

*.str accessor — string transforms inside Polars expressions.*
```python
# .str accessor — string transforms inside Polars expressions
ohlcv_pl.with_columns(
    pl.col("symbol").str.to_uppercase().alias("symbol_upper"),
    pl.col("symbol").str.split(".").list.first().alias("symbol_short"),
    pl.col("symbol").str.contains("DE").alias("has_de"),
).select("symbol", "symbol_upper", "symbol_short", "has_de").head()
```
```text
shape: (5, 4)

('symbol', 'str') ('symbol_upper', 'str') ('symbol_short', 'str')  ('has_de', 'bool')
           ABI.BR                  ABI.BR                     ABI               False
           ABI.BR                  ABI.BR                     ABI               False
           ABI.BR                  ABI.BR                     ABI               False
           ABI.BR                  ABI.BR                     ABI               False
           ABI.BR                  ABI.BR                     ABI               False
```

*with_columns context — add new columns, keep all originals.*
```python
# with_columns context — add new columns, keep all originals
ohlcv_pl.with_columns(
    pl.col("symbol").str.replace(".DE", "").str.strip_chars().alias("clean"),
).select("symbol", "clean").unique().head()
```
```text
shape: (5, 2)

('symbol', 'str') ('clean', 'str')
        NDA-FI.HE        NDA-FI.HE
          INGA.AS          INGA.AS
           SAP.DE              SAP
           MBG.DE              MBG
           PRX.AS           PRX.AS
```

---

### .dt Accessor — DateTime Operations on DataFrame Columns

#### Pandas .dt Accessor — datetime transforms

> [!info] .dt gives access to datetime
>
> `.dt` gives access to datetime components: `.dt.year`, `.dt.month`, `.dt.day`, `.dt.day_name()`, `.dt.quarter`, `.dt.weekday`. The column must be `datetime64` dtype — convert with `pd.to_datetime()` first if it's a string.

_Converts the `date` column to `datetime64` via `pd.to_datetime()`, then extracts four temporal components — year, month, weekday name, and quarter — into separate columns, demonstrating that `.dt` accessor methods are available only after the column is in a datetime dtype._

*.dt accessor — extract date components from a datetime column.*
```python
# .dt accessor — extract date components from a datetime column
df = ohlcv_pd.copy()
df["date"] = pd.to_datetime(df["date"])
df["year"]    = df["date"].dt.year
df["month"]   = df["date"].dt.month
df["weekday"] = df["date"].dt.day_name()
df["quarter"] = df["date"].dt.quarter
df[["date", "year", "month", "weekday", "quarter"]].head()
```
```text
date  year  month   weekday  quarter
0 2021-01-04  2021      1    Monday        1
1 2021-01-05  2021      1   Tuesday        1
2 2021-01-06  2021      1 Wednesday        1
3 2021-01-07  2021      1  Thursday        1
4 2021-01-08  2021      1    Friday        1
```

#### Polars .dt Accessor — datetime transforms

> [!info] Polars .dt namespace: .dt.year(), .dt.month(),
>
> Polars `.dt` namespace: `.dt.year()`, `.dt.month()`, `.dt.day()`, `.dt.weekday()`, `.dt.quarter()`, `.dt.ordinal_day()`. Note: Polars weekday is 1=Monday (ISO), Pandas is 0=Monday.

_Extracts year, month, ISO weekday integer (1=Monday), and quarter from the Polars `date` column using the `.dt` namespace inside a `with_columns` call. A second example demonstrates date arithmetic — shifting each date forward 7 days with `pl.duration(days=7)` and computing the first day of the month via `.dt.month_start()`._

*.dt accessor — extract date components inside Polars expressions.*
```python
# .dt accessor — extract date components inside Polars expressions
ohlcv_pl.with_columns(
    pl.col("date").dt.year().alias("year"),
    pl.col("date").dt.month().alias("month"),
    pl.col("date").dt.weekday().alias("weekday"),
    pl.col("date").dt.quarter().alias("quarter"),
).select("date", "year", "month", "weekday", "quarter").head()
```
```text
shape: (5, 5)

('date', 'date')  ('year', 'i32')  ('month', 'i8')  ('weekday', 'i8')  ('quarter', 'i8')
      2021-01-04             2021                1                  1                  1
      2021-01-05             2021                1                  2                  1
      2021-01-06             2021                1                  3                  1
      2021-01-07             2021                1                  4                  1
      2021-01-08             2021                1                  5                  1
```

*Date arithmetic — Polars.*
```python
# Date arithmetic — Polars
ohlcv_pl.with_columns(
    (pl.col("date") + pl.duration(days=7)).alias("date_plus_7d"),
    pl.col("date").dt.month_start().alias("month_start"),
).select("date", "date_plus_7d", "month_start").head()
```
```text
shape: (5, 3)

('date', 'date') ('date_plus_7d', 'date') ('month_start', 'date')
      2021-01-04               2021-01-11              2021-01-01
      2021-01-05               2021-01-12              2021-01-01
      2021-01-06               2021-01-13              2021-01-01
      2021-01-07               2021-01-14              2021-01-01
      2021-01-08               2021-01-15              2021-01-01
```

---

### Arithmetic & Math Operations

> [!info] Both Pandas and Polars support
>
> Both Pandas and Polars support element-wise arithmetic (`+`, `-`, `*`, `/`), NumPy functions (`np.log`, `np.sqrt`), and group-level computations (`.pct_change()`, `.cumsum()`). Pandas uses `.groupby("col")["target"].method()` syntax; Polars uses `.method().over("col")` expressions.

*Pandas — arithmetic, log, pct_change, cumsum grouped by symbol.*
```python
# Pandas — arithmetic, log, pct_change, cumsum grouped by symbol
df = ohlcv_pd.copy()
df["log_close"]     = np.log(df["close"])
df["pct_change"]    = df.groupby("symbol")["close"].pct_change()
df["cum_volume"]    = df.groupby("symbol")["volume"].cumsum()
df[["symbol", "date", "close", "log_close", "pct_change", "cum_volume"]].head(10)
```
```text
symbol       date  close  log_close  pct_change  cum_volume
0 ABI.BR 2021-01-04  57.21   4.046729         NaN     1513937
1 ABI.BR 2021-01-05  57.18   4.046204   -0.000524     2896659
2 ABI.BR 2021-01-06  58.77   4.073632    0.027807     4266863
3 ABI.BR 2021-01-07  58.40   4.067316   -0.006296     5736774
4 ABI.BR 2021-01-08  57.86   4.058026   -0.009247     7165455
5 ABI.BR 2021-01-11  56.61   4.036186   -0.021604     8683534
6 ABI.BR 2021-01-12  56.51   4.034418   -0.001766    10333525
7 ABI.BR 2021-01-13  56.48   4.033887   -0.000531    11424331
8 ABI.BR 2021-01-14  56.96   4.042349    0.008499    12947376
9 ABI.BR 2021-01-15  56.74   4.038479   -0.003862    14717364
```

*Polars.*
```python
# Polars
ohlcv_pl.with_columns(
    pl.col("close").log().alias("log_close"),
    pl.col("close").pct_change().over("symbol").alias("pct_change"),
    pl.col("volume").cum_sum().over("symbol").alias("cum_volume"),
).select("symbol", "date", "close", "log_close", "pct_change", "cum_volume").head(10)
```
```text
shape: (10, 6)

('symbol', 'str') ('date', 'date')  ('close', 'f64')  ('log_close', 'f64')  ('pct_change', 'f64')  ('cum_volume', 'i64')
           ABI.BR       2021-01-04             57.21              4.046729                    NaN                1513937
           ABI.BR       2021-01-05             57.18              4.046204              -0.000524                2896659
           ABI.BR       2021-01-06             58.77              4.073632               0.027807                4266863
           ABI.BR       2021-01-07             58.40              4.067316              -0.006296                5736774
           ABI.BR       2021-01-08             57.86              4.058026              -0.009247                7165455
           ABI.BR       2021-01-11             56.61              4.036186              -0.021604                8683534
           ABI.BR       2021-01-12             56.51              4.034418              -0.001766               10333525
           ABI.BR       2021-01-13             56.48              4.033887              -0.000531               11424331
           ABI.BR       2021-01-14             56.96              4.042349               0.008499               12947376
           ABI.BR       2021-01-15             56.74              4.038479              -0.003862               14717364
```

*Polars — clip / round / abs.*
```python
# Polars — clip / round / abs
ohlcv_pl.with_columns(
    pl.col("close").round(0).alias("close_rounded"),
    pl.col("close").clip(20, 80).alias("close_clipped"),
    (pl.col("close") - pl.col("open")).abs().alias("abs_change"),
).select("symbol", "date", "close", "close_rounded", "close_clipped", "abs_change").head()
```
```text
shape: (5, 6)

('symbol', 'str') ('date', 'date')  ('close', 'f64')  ('close_rounded', 'f64')  ('close_clipped', 'f64')  ('abs_change', 'f64')
           ABI.BR       2021-01-04             57.21                      57.0                     57.21                   0.94
           ABI.BR       2021-01-05             57.18                      57.0                     57.18                   0.28
           ABI.BR       2021-01-06             58.77                      59.0                     58.77                   0.81
           ABI.BR       2021-01-07             58.40                      58.0                     58.40                   0.28
           ABI.BR       2021-01-08             57.86                      58.0                     57.86                   0.30
```

---

### The "Tweak Function" Pattern

Encapsulate all data-prep transformations in a single function that takes a raw DataFrame and returns a clean one.
This makes pipelines **reproducible** and **testable**.

#### Pandas — Tweak Function Pattern (chainable transform)

> [!info] The "tweak function" pattern wraps
>
> The "tweak function" pattern wraps all DataFrame transforms in a single function: `def tweak(df) -> df`. Inside, chain `.assign()`, `.rename()`, `.astype()`, `.query()`, `.sort_values()` etc. Call it as `df.pipe(tweak)` to include in a pipeline. This is the idiomatic Pandas approach to composable, testable transforms.

_Defines `tweak_ohlcv_pd()` — a Pandas tweak function that adds `range`, `mid`, `intraday_ret`, `volume_m`, and `symbol_short` columns in a single `.assign()` chain, then lowercases all column names via `.rename(columns=str.lower)`, returning the enriched 17-column OHLCV DataFrame._

*Tweak function — all Pandas transforms in one chainable function.*
```python
# Tweak function — all Pandas transforms in one chainable function
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
```text
id symbol       date  open  high   low  close  adj_close  volume  dividends  stock_splits  is_filled  range    mid  intraday_ret  volume_m symbol_short
0 21160 ABI.BR 2021-01-04 58.15 58.85 56.78  57.21    53.5761 1513937        0.0           0.0      False   2.07 57.815     -0.016165  1.513937          ABI
1 21161 ABI.BR 2021-01-05 56.90 57.98 56.75  57.18    53.5480 1382722        0.0           0.0      False   1.23 57.365      0.004921  1.382722          ABI
2 21162 ABI.BR 2021-01-06 57.96 58.94 57.39  58.77    55.0370 1370204        0.0           0.0      False   1.55 58.165      0.013975  1.370204          ABI
3 21163 ABI.BR 2021-01-07 58.68 58.86 57.88  58.40    54.6905 1469911        0.0           0.0      False   0.98 58.370     -0.004772  1.469911          ABI
4 21164 ABI.BR 2021-01-08 58.16 58.40 57.43  57.86    54.1848 1428681        0.0           0.0      False   0.97 57.915     -0.005158  1.428681          ABI
```

#### Polars — Tweak Function Pattern (chainable transform)

- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **List Ops**: Access elements inside list columns: .list.len(), .list.first(), .list.contains().
- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

> [!info] Polars tweak functions use .with_columns(),
>
> Polars tweak functions use `.with_columns()`, `.filter()`, `.sort()`, `.rename()` chained naturally — no `.pipe()` needed because Polars methods already return new DataFrames (immutable by design).

_Defines `tweak_ohlcv_pl()` — the Polars equivalent that adds the same five derived columns (`range`, `mid`, `intraday_ret`, `volume_m`, `symbol_short`) in a single `.with_columns()` call, demonstrating that Polars methods chain directly without `.pipe()` or `.copy()`._

*Tweak function — all Polars transforms in one chainable function.*
```python
# Tweak function — all Polars transforms in one chainable function
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
```text
shape: (5, 17)

 ('id', 'i64') ('symbol', 'str') ('date', 'date')  ('open', 'f64')  ('high', 'f64')  ('low', 'f64')  ('close', 'f64')  ('adj_close', 'f64')  ('volume', 'i64')  ('dividends', 'f64')  ('stock_splits', 'f64')  ('is_filled', 'bool')  ('range', 'f64')  ('mid', 'f64')  ('intraday_ret', 'f64')  ('volume_m', 'f64') ('symbol_short', 'str')
         21160            ABI.BR       2021-01-04            58.15            58.85           56.78             57.21               53.5761            1513937                   0.0                      0.0                  False              2.07          57.815                -0.016165             1.513937                     ABI
         21161            ABI.BR       2021-01-05            56.90            57.98           56.75             57.18               53.5480            1382722                   0.0                      0.0                  False              1.23          57.365                 0.004921             1.382722                     ABI
         21162            ABI.BR       2021-01-06            57.96            58.94           57.39             58.77               55.0370            1370204                   0.0                      0.0                  False              1.55          58.165                 0.013975             1.370204                     ABI
         21163            ABI.BR       2021-01-07            58.68            58.86           57.88             58.40               54.6905            1469911                   0.0                      0.0                  False              0.98          58.370                -0.004772             1.469911                     ABI
         21164            ABI.BR       2021-01-08            58.16            58.40           57.43             57.86               54.1848            1428681                   0.0                      0.0                  False              0.97          57.915                -0.005158             1.428681                     ABI
```

---

## Practical Transform Examples — scores_daily dataset

*Preview Pandas scores_daily DataFrame.*
```python
# Preview Pandas scores_daily DataFrame
scores_pd.head(3)
```
```text
id        _index symbol score_date                 sector  pe_zscore  pb_zscore  ev_ebitda_zscore  yield_zscore  relative_value_score  relative_value_rank  relative_strength  sma_50_ratio  sma_200_ratio  dist_from_52w_high  momentum_score  momentum_rank  implied_upside  recommendation_mean  price_falling_analysts_bullish  sentiment_score  sentiment_rank  composite_score  composite_rank                 _scored_at  sma_30_close  sma_90_close   market_cap  index_weight               short_name country  current_price  day_change_pct  five_day_change_pct  ytd_change_pct currency
0 163 euro_stoxx_50 BNP.PA 2026-03-04     Financial Services   0.913389   1.261140               NaN      2.388962              1.521163                    1           0.016123      1.009090       1.130264            0.082486        0.477966             16        0.153157              1.84211                           False         0.052711              25         0.683947               1 2026-03-04 22:40:25.489180     92.085000     81.181889  99751215104      0.019525        BNP PARIBAS ACT.A  France         89.320        0.011437            -0.073156        0.105582      EUR
1 168 euro_stoxx_50 DTE.DE 2026-03-04 Communication Services   0.326587   0.387463          0.379532     -0.127867              0.241429                   24          -0.205598      1.120650       1.112416            0.055524        0.685752              8        0.121212              1.33333                           False         0.617835              10         0.515005               2 2026-03-04 22:40:25.489180     30.838000     28.554556 164294311936      0.032159      DEUTSCHE TELEKOM AG Germany         33.000        0.011649            -0.019608        0.193059      EUR
2 174 euro_stoxx_50 IFX.DE 2026-03-04             Technology   0.509398   0.637215          0.677068     -0.696662              0.281755                   22           0.000965      1.048244       1.198626            0.088845        0.675764              9        0.126408              1.37500                           False         0.579187              11         0.512235               3 2026-03-04 22:40:25.489180     43.480333     38.855556  57222533120      0.011201 INFINEON TECHNOLOGIES AG Germany         43.945        0.054343            -0.066490        0.164723      EUR
```

*Pandas — bin scores.*
```python
# Pandas — bin scores
df = scores_pd.copy()
df["score_bin"] = pd.cut(df["pe_zscore"], bins=[0, 0.25, 0.5, 0.75, 1.0],
                         labels=["Q1", "Q2", "Q3", "Q4"])
df.head()
```
```text
id        _index symbol score_date                 sector  pe_zscore  pb_zscore  ev_ebitda_zscore  yield_zscore  relative_value_score  relative_value_rank  relative_strength  sma_50_ratio  sma_200_ratio  dist_from_52w_high  momentum_score  momentum_rank  implied_upside  recommendation_mean  price_falling_analysts_bullish  sentiment_score  sentiment_rank  composite_score  composite_rank                 _scored_at  sma_30_close  sma_90_close   market_cap  index_weight               short_name country  current_price  day_change_pct  five_day_change_pct  ytd_change_pct currency score_bin
0 163 euro_stoxx_50 BNP.PA 2026-03-04     Financial Services   0.913389   1.261140               NaN      2.388962              1.521163                    1           0.016123      1.009090       1.130264            0.082486        0.477966             16        0.153157              1.84211                           False         0.052711              25         0.683947               1 2026-03-04 22:40:25.489180     92.085000     81.181889  99751215104      0.019525        BNP PARIBAS ACT.A  France         89.320        0.011437            -0.073156        0.105582      EUR        Q4
1 168 euro_stoxx_50 DTE.DE 2026-03-04 Communication Services   0.326587   0.387463          0.379532     -0.127867              0.241429                   24          -0.205598      1.120650       1.112416            0.055524        0.685752              8        0.121212              1.33333                           False         0.617835              10         0.515005               2 2026-03-04 22:40:25.489180     30.838000     28.554556 164294311936      0.032159      DEUTSCHE TELEKOM AG Germany         33.000        0.011649            -0.019608        0.193059      EUR        Q2
2 174 euro_stoxx_50 IFX.DE 2026-03-04             Technology   0.509398   0.637215          0.677068     -0.696662              0.281755                   22           0.000965      1.048244       1.198626            0.088845        0.675764              9        0.126408              1.37500                           False         0.579187              11         0.512235               3 2026-03-04 22:40:25.489180     43.480333     38.855556  57222533120      0.011201 INFINEON TECHNOLOGIES AG Germany         43.945        0.054343            -0.066490        0.164723      EUR        Q3
3 172 euro_stoxx_50 ENR.DE 2026-03-04            Industrials  -0.902738  -0.743338         -1.693212     -1.326075             -1.166341                   46           1.645455      1.137007       1.474095            0.051850        2.541889              1        0.075269              1.80000                           False        -0.123264              29         0.417428               4 2026-03-04 22:40:25.489180    155.675000    129.122000 139207262208      0.027249        Siemens Energy AG Germany        162.750        0.047297            -0.039256        0.351744      EUR       NaN
4 149 euro_stoxx_50 ABI.BR 2026-03-04     Consumer Defensive   0.474084   0.844075          0.552739     -0.975005              0.223973                   25          -0.029791      1.058542       1.142783            0.063063        0.651891             10        0.186198              1.69231                           False         0.344755              17         0.406873               5 2026-03-04 22:40:25.489180     64.342000     57.869333 125566156800      0.024579                 AB INBEV Belgium         64.480       -0.017073            -0.040762        0.174499      EUR        Q2
```

*Polars — bin scores with when/then.*
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
```text
shape: (5, 37)

 ('id', 'i64') ('_index', 'str') ('symbol', 'str') ('score_date', 'date')      ('sector', 'str')  ('pe_zscore', 'f64')  ('pb_zscore', 'f64')  ('ev_ebitda_zscore', 'f64')  ('yield_zscore', 'f64')  ('relative_value_score', 'f64')  ('relative_value_rank', 'i64')  ('relative_strength', 'f64')  ('sma_50_ratio', 'f64')  ('sma_200_ratio', 'f64')  ('dist_from_52w_high', 'f64')  ('momentum_score', 'f64')  ('momentum_rank', 'i64')  ('implied_upside', 'f64')  ('recommendation_mean', 'f64')  ('price_falling_analysts_bullish', 'bool')  ('sentiment_score', 'f64')  ('sentiment_rank', 'i64')  ('composite_score', 'f64')  ('composite_rank', 'i64') ('_scored_at', 'datetime[ns]')  ('sma_30_close', 'f64')  ('sma_90_close', 'f64')  ('market_cap', 'i64')  ('index_weight', 'f64')    ('short_name', 'str') ('country', 'str')  ('current_price', 'f64')  ('day_change_pct', 'f64')  ('five_day_change_pct', 'f64')  ('ytd_change_pct', 'f64') ('currency', 'str') ('score_bin', 'str')
           163     euro_stoxx_50            BNP.PA             2026-03-04     Financial Services              0.913389              1.261140                          NaN                 2.388962                         1.521163                               1                      0.016123                 1.009090                  1.130264                       0.082486                   0.477966                        16                   0.153157                         1.84211                                       False                    0.052711                         25                    0.683947                          1     2026-03-04 22:40:25.489180                92.085000                81.181889            99751215104                 0.019525        BNP PARIBAS ACT.A             France                    89.320                   0.011437                       -0.073156                   0.105582                 EUR                   Q4
           168     euro_stoxx_50            DTE.DE             2026-03-04 Communication Services              0.326587              0.387463                     0.379532                -0.127867                         0.241429                              24                     -0.205598                 1.120650                  1.112416                       0.055524                   0.685752                         8                   0.121212                         1.33333                                       False                    0.617835                         10                    0.515005                          2     2026-03-04 22:40:25.489180                30.838000                28.554556           164294311936                 0.032159      DEUTSCHE TELEKOM AG            Germany                    33.000                   0.011649                       -0.019608                   0.193059                 EUR                   Q2
           174     euro_stoxx_50            IFX.DE             2026-03-04             Technology              0.509398              0.637215                     0.677068                -0.696662                         0.281755                              22                      0.000965                 1.048244                  1.198626                       0.088845                   0.675764                         9                   0.126408                         1.37500                                       False                    0.579187                         11                    0.512235                          3     2026-03-04 22:40:25.489180                43.480333                38.855556            57222533120                 0.011201 INFINEON TECHNOLOGIES AG            Germany                    43.945                   0.054343                       -0.066490                   0.164723                 EUR                   Q3
           172     euro_stoxx_50            ENR.DE             2026-03-04            Industrials             -0.902738             -0.743338                    -1.693212                -1.326075                        -1.166341                              46                      1.645455                 1.137007                  1.474095                       0.051850                   2.541889                         1                   0.075269                         1.80000                                       False                   -0.123264                         29                    0.417428                          4     2026-03-04 22:40:25.489180               155.675000               129.122000           139207262208                 0.027249        Siemens Energy AG            Germany                   162.750                   0.047297                       -0.039256                   0.351744                 EUR                   Q1
           149     euro_stoxx_50            ABI.BR             2026-03-04     Consumer Defensive              0.474084              0.844075                     0.552739                -0.975005                         0.223973                              25                     -0.029791                 1.058542                  1.142783                       0.063063                   0.651891                        10                   0.186198                         1.69231                                       False                    0.344755                         17                    0.406873                          5     2026-03-04 22:40:25.489180                64.342000                57.869333           125566156800                 0.024579                 AB INBEV            Belgium                    64.480                  -0.017073                       -0.040762                   0.174499                 EUR                   Q2
```

*Polars — z-score normalisation per symbol.*
```python
# Polars — z-score normalisation per symbol
scores_pl.with_columns(
    ((pl.col("pe_zscore") - pl.col("pe_zscore").mean().over("symbol"))
     / pl.col("pe_zscore").std().over("symbol")).alias("score_z")
).head(10)
```
```text
shape: (10, 37)

 ('id', 'i64') ('_index', 'str') ('symbol', 'str') ('score_date', 'date')      ('sector', 'str')  ('pe_zscore', 'f64')  ('pb_zscore', 'f64')  ('ev_ebitda_zscore', 'f64')  ('yield_zscore', 'f64')  ('relative_value_score', 'f64')  ('relative_value_rank', 'i64')  ('relative_strength', 'f64')  ('sma_50_ratio', 'f64')  ('sma_200_ratio', 'f64')  ('dist_from_52w_high', 'f64')  ('momentum_score', 'f64')  ('momentum_rank', 'i64')  ('implied_upside', 'f64')  ('recommendation_mean', 'f64')  ('price_falling_analysts_bullish', 'bool')  ('sentiment_score', 'f64')  ('sentiment_rank', 'i64')  ('composite_score', 'f64')  ('composite_rank', 'i64') ('_scored_at', 'datetime[ns]')  ('sma_30_close', 'f64')  ('sma_90_close', 'f64')  ('market_cap', 'i64')  ('index_weight', 'f64')    ('short_name', 'str') ('country', 'str')  ('current_price', 'f64')  ('day_change_pct', 'f64')  ('five_day_change_pct', 'f64')  ('ytd_change_pct', 'f64') ('currency', 'str')  ('score_z', 'f64')
           163     euro_stoxx_50            BNP.PA             2026-03-04     Financial Services              0.913389              1.261140                          NaN                 2.388962                         1.521163                               1                      0.016123                 1.009090                  1.130264                       0.082486                   0.477966                        16                   0.153157                         1.84211                                       False                    0.052711                         25                    0.683947                          1     2026-03-04 22:40:25.489180                92.085000                81.181889            99751215104                 0.019525        BNP PARIBAS ACT.A             France                    89.320                   0.011437                       -0.073156                   0.105582                 EUR            1.151369
           168     euro_stoxx_50            DTE.DE             2026-03-04 Communication Services              0.326587              0.387463                     0.379532                -0.127867                         0.241429                              24                     -0.205598                 1.120650                  1.112416                       0.055524                   0.685752                         8                   0.121212                         1.33333                                       False                    0.617835                         10                    0.515005                          2     2026-03-04 22:40:25.489180                30.838000                28.554556           164294311936                 0.032159      DEUTSCHE TELEKOM AG            Germany                    33.000                   0.011649                       -0.019608                   0.193059                 EUR            1.146083
           174     euro_stoxx_50            IFX.DE             2026-03-04             Technology              0.509398              0.637215                     0.677068                -0.696662                         0.281755                              22                      0.000965                 1.048244                  1.198626                       0.088845                   0.675764                         9                   0.126408                         1.37500                                       False                    0.579187                         11                    0.512235                          3     2026-03-04 22:40:25.489180                43.480333                38.855556            57222533120                 0.011201 INFINEON TECHNOLOGIES AG            Germany                    43.945                   0.054343                       -0.066490                   0.164723                 EUR            1.017897
           172     euro_stoxx_50            ENR.DE             2026-03-04            Industrials             -0.902738             -0.743338                    -1.693212                -1.326075                        -1.166341                              46                      1.645455                 1.137007                  1.474095                       0.051850                   2.541889                         1                   0.075269                         1.80000                                       False                   -0.123264                         29                    0.417428                          4     2026-03-04 22:40:25.489180               155.675000               129.122000           139207262208                 0.027249        Siemens Energy AG            Germany                   162.750                   0.047297                       -0.039256                   0.351744                 EUR            0.340213
           149     euro_stoxx_50            ABI.BR             2026-03-04     Consumer Defensive              0.474084              0.844075                     0.552739                -0.975005                         0.223973                              25                     -0.029791                 1.058542                  1.142783                       0.063063                   0.651891                        10                   0.186198                         1.69231                                       False                    0.344755                         17                    0.406873                          5     2026-03-04 22:40:25.489180                64.342000                57.869333           125566156800                 0.024579                 AB INBEV            Belgium                    64.480                  -0.017073                       -0.040762                   0.174499                 EUR           -1.152299
           196     euro_stoxx_50            VOW.DE             2026-03-04      Consumer Cyclical              1.166221              0.940273                     0.379830                 1.528891                         1.003804                               2                     -0.292748                 0.929392                  0.969628                       0.180805                  -0.411969                        37                   0.297071                             NaN                                       False                    0.555357                         12                    0.382397                          6     2026-03-04 22:40:25.489180               102.286667               101.225556            47923826688                 0.009381            VOLKSWAGEN AG            Germany                    95.600                   0.013786                       -0.048756                  -0.090390                 EUR           -0.590923
           194     euro_stoxx_50            TTE.PA             2026-03-04                 Energy              0.691106              0.609377                     0.449610                 0.731948                         0.620510                              12                      0.049800                 1.109161                  1.212503                       0.084110                   0.919444                         5                   0.041131                         2.04545                                       False                   -0.542576                         35                    0.332459                          7     2026-03-04 22:40:25.489180                63.603000                58.231667           142003961856                 0.027796            TOTALENERGIES             France                    66.860                  -0.018209                       -0.007570                   0.202734                 EUR            1.114951
           166     euro_stoxx_50             DG.PA             2026-03-04            Industrials              0.778573              0.850985                     0.928797                 1.146268                         0.926156                               3                     -0.031697                 1.064353                  1.095809                       0.062871                   0.595820                        11                   0.043608                         2.04762                                       False                   -0.538059                         34                    0.327972                          8     2026-03-04 22:40:25.489180               131.013333               123.067778            74446422016                 0.014572                    VINCI             France                   134.150                   0.006754                       -0.054283                   0.117451                 EUR           -0.515320
           188     euro_stoxx_50            SAN.MC             2026-03-04     Financial Services              0.458599              0.499398                          NaN                -1.107590                        -0.049864                              33                      0.393197                 0.953824                  1.139519                       0.113499                   0.519307                        14                   0.224704                         1.70000                                       False                    0.448776                         15                    0.306073                          9     2026-03-04 22:40:25.489180                10.604900                 9.919500           145955749888                 0.028570     BANCO SANTANDER S.A.              Spain                     9.982                   0.038818                       -0.105876                  -0.008739                 EUR           -0.927419
           193     euro_stoxx_50             SU.PA             2026-03-04            Industrials             -0.175048              0.278256                    -0.060732                -0.419549                        -0.094268                              34                     -0.045547                 1.049116                  1.102466                       0.078557                   0.519908                        13                   0.141252                         1.47826                                       False                    0.489240                         14                    0.304960                         10     2026-03-04 22:40:25.489180               253.745000               241.719444           145081614336                 0.028399    SCHNEIDER ELECTRIC SE             France                   258.050                   0.017748                       -0.026043                   0.098553                 EUR            0.608136
```

---

## Column Transform API Lookup

*Pandas vs Polars comparison table for column creation methods.*
```python
# Pandas vs Polars comparison table for column creation methods
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
```text
(No visible output)
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

## Part 2: Polars Expressions Deep Dive

### What Is an Expression?

> [!info] Polars expressions are lazy
>
> A Polars expression is a **lazy computation** — it describes *what* to compute, not *how*. `pl.col("close") * 2` creates an `Expr` object. It does nothing until passed into a context (`.select()`, `.with_columns()`, `.filter()`, `.group_by().agg()`). The optimizer then fuses, reorders, and parallelizes all expressions for maximum performance.

*An expression is a lazy computation — it's not executed until placed in a context.*
```python
# An expression is a lazy computation — it's not executed until placed in a context
expr = pl.col("close") * 2
print(f"Type: {type(expr)}")
print(f"Repr: {expr}")
```
```text
Type: <class 'polars.expr.expr.Expr'>
    Repr: [(col("close")) * (dyn int: 2)]
```

### Expression Contexts

*select context — return only named columns (drop the rest).*
```python
# select context — return only named columns (drop the rest)
ohlcv_pl.select("symbol", "date", "close").head(5)
```
```text
shape: (5, 3)

('symbol', 'str') ('date', 'date')  ('close', 'f64')
           ABI.BR       2021-01-04             57.21
           ABI.BR       2021-01-05             57.18
           ABI.BR       2021-01-06             58.77
           ABI.BR       2021-01-07             58.40
           ABI.BR       2021-01-08             57.86
```

*Continuing expressions — chain methods on pl.col() results.*
```python
# Continuing expressions — chain methods on pl.col() results
ohlcv_pl.select(
    "symbol", "date",
    pl.col("close").round(2).alias("close_rounded"),
    (pl.col("high") - pl.col("low")).alias("daily_range"),
).head(5)
```
```text
shape: (5, 4)

('symbol', 'str') ('date', 'date')  ('close_rounded', 'f64')  ('daily_range', 'f64')
           ABI.BR       2021-01-04                     57.21                    2.07
           ABI.BR       2021-01-05                     57.18                    1.23
           ABI.BR       2021-01-06                     58.77                    1.55
           ABI.BR       2021-01-07                     58.40                    0.98
           ABI.BR       2021-01-08                     57.86                    0.97
```

#### Polars Expression Context — with_columns

- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

_Adds `price_change` (close minus open) and `pct_change` (percentage change from open to close, rounded to 2 dp) as two new columns in a single `with_columns` call, keeping all 12 original OHLCV columns intact._

*with_columns context — add new columns, keep all originals.*
```python
# with_columns context — add new columns, keep all originals
ohlcv_pl.with_columns(
    (pl.col("close") - pl.col("open")).alias("price_change"),
    ((pl.col("close") - pl.col("open")) / pl.col("open") * 100).round(2).alias("pct_change"),
).select("symbol", "date", "close", "open", "price_change", "pct_change").head(5)
```
```text
shape: (5, 6)

('symbol', 'str') ('date', 'date')  ('close', 'f64')  ('open', 'f64')  ('price_change', 'f64')  ('pct_change', 'f64')
           ABI.BR       2021-01-04             57.21            58.15                    -0.94                  -1.62
           ABI.BR       2021-01-05             57.18            56.90                     0.28                   0.49
           ABI.BR       2021-01-06             58.77            57.96                     0.81                   1.40
           ABI.BR       2021-01-07             58.40            58.68                    -0.28                  -0.48
           ABI.BR       2021-01-08             57.86            58.16                    -0.30                  -0.52
```

#### Polars Expression Context — filter

- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

_Filters the OHLCV dataset to ASML.AS rows where `close > 900` using a compound boolean expression with `&`, returning the first 5 matching dates and prices._

*filter context — keep rows matching a boolean expression.*
```python
# filter context — keep rows matching a boolean expression
ohlcv_pl.filter(
    (pl.col("symbol") == "ASML.AS") & (pl.col("close") > 900)
).select("symbol", "date", "close").head(5)
```
```text
shape: (5, 3)

('symbol', 'str') ('date', 'date')  ('close', 'f64')
          ASML.AS       2024-03-04             913.2
          ASML.AS       2024-03-06             912.2
          ASML.AS       2024-03-07             949.2
          ASML.AS       2024-03-08             923.4
          ASML.AS       2024-03-21             923.3
```

#### Polars Expression Context — group_by.agg

- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

_Groups the full OHLCV dataset by `symbol` and computes three per-symbol aggregates — average close price, total traded volume, and most recent date — then sorts descending by average close to rank the 50 stocks by price level._

*group_by.agg context — aggregate expressions per group.*
```python
# group_by.agg context — aggregate expressions per group
ohlcv_pl.group_by("symbol").agg(
    pl.col("close").mean().round(2).alias("avg_close"),
    pl.col("volume").sum().alias("total_volume"),
    pl.col("date").max().alias("last_date"),
).sort("avg_close", descending=True).head(10)
```
```text
shape: (10, 4)

('symbol', 'str')  ('avg_close', 'f64')  ('total_volume', 'i64') ('last_date', 'date')
           RMS.PA               1761.56                 81633862            2026-03-12
         ADYEN.AS               1545.98                110400463            2026-03-12
          ASML.AS                671.35                945070720            2026-03-12
            MC.PA                662.40                557855567            2026-03-12
           RHM.DE                544.66                308359744            2026-03-12
          ARGX.BR                413.69                 94592244            2026-03-12
            OR.PA                377.54                484115375            2026-03-12
          MUV2.DE                374.66                398802950            2026-03-12
          RACE.MI                289.75                476686026            2026-03-12
           ALV.DE                252.19               1101960308            2026-03-12
```

### Column Expressions

- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

*pl.col with multiple names — select columns by name.*
```python
# pl.col with multiple names — select columns by name
ohlcv_pl.select(pl.col("symbol", "date", "close")).head(3)
```
```text
shape: (3, 3)

('symbol', 'str') ('date', 'date')  ('close', 'f64')
           ABI.BR       2021-01-04             57.21
           ABI.BR       2021-01-05             57.18
           ABI.BR       2021-01-06             58.77
```

*Regex.*
```python
# Regex
ohlcv_pl.select(pl.col("^(open|high|low|close)$")).head(3)
```
```text
shape: (3, 4)

 ('open', 'f64')  ('high', 'f64')  ('low', 'f64')  ('close', 'f64')
           58.15            58.85           56.78             57.21
           56.90            57.98           56.75             57.18
           57.96            58.94           57.39             58.77
```

#### Polars Column Expressions — pl.all, pl.exclude

_Uses `pl.exclude()` to drop four metadata columns (`id`, `dividends`, `stock_splits`, `is_filled`) and return only the 8 analytically relevant OHLCV columns._

*pl.exclude — select all columns EXCEPT the listed ones.*
```python
# pl.exclude — select all columns EXCEPT the listed ones
ohlcv_pl.select(pl.exclude("id", "dividends", "stock_splits", "is_filled")).head(3)
```
```text
shape: (3, 8)

('symbol', 'str') ('date', 'date')  ('open', 'f64')  ('high', 'f64')  ('low', 'f64')  ('close', 'f64')  ('adj_close', 'f64')  ('volume', 'i64')
           ABI.BR       2021-01-04            58.15            58.85           56.78             57.21               53.5761            1513937
           ABI.BR       2021-01-05            56.90            57.98           56.75             57.18               53.5480            1382722
           ABI.BR       2021-01-06            57.96            58.94           57.39             58.77               55.0370            1370204
```

#### Polars Column Expressions — pl.lit

- **pl.lit**: Create a constant/literal value as an expression.
- **Alias**: Give an expression result a column name (Polars).

_Injects two constant columns into the OHLCV dataset using `pl.lit()`: a static `"EUR"` currency string and a `1.0` float weight — demonstrating how to attach fixed-value metadata to every row without a source column._

*pl.lit — inject a constant value as a new column.*
```python
# pl.lit — inject a constant value as a new column
ohlcv_pl.select("symbol", "date", pl.lit("EUR").alias("currency"), pl.lit(1.0).alias("weight")).head(3)
```
```text
shape: (3, 4)

('symbol', 'str') ('date', 'date') ('currency', 'str')  ('weight', 'f64')
           ABI.BR       2021-01-04                 EUR                1.0
           ABI.BR       2021-01-05                 EUR                1.0
           ABI.BR       2021-01-06                 EUR                1.0
```

#### Polars Column Expressions — pl.first, pl.last

- **Alias**: Give an expression result a column name (Polars).

_Extracts the first symbol in the dataset and the date range boundaries (`first_date` and `last_date`) using `pl.first()` and `pl.last()`, confirming that the OHLCV data spans from 2021-01-04 to 2026-03-12._

*pl.first, pl.last — get the first/last value in the column.*
```python
# pl.first, pl.last — get the first/last value in the column
ohlcv_pl.select(pl.first("symbol"), pl.first("date").alias("first_date"), pl.last("date").alias("last_date"))
```
```text
shape: (1, 3)

('symbol', 'str') ('first_date', 'date') ('last_date', 'date')
           ABI.BR             2021-01-04            2026-03-12
```

### Continuing Expressions

- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

*Continuing expressions — chain methods on pl.col() results.*
```python
# Continuing expressions — chain methods on pl.col() results
ohlcv_pl.select(
    pl.col("close").cast(pl.Float64).round(2).alias("rounded_close"),
    pl.col("symbol").str.to_lowercase().str.replace(".as", "").alias("clean_symbol"),
).head(5)
```
```text
shape: (5, 2)

 ('rounded_close', 'f64') ('clean_symbol', 'str')
                    57.21                  abi.br
                    57.18                  abi.br
                    58.77                  abi.br
                    58.40                  abi.br
                    57.86                  abi.br
```

### Horizontal Expressions

- **Sum Horizontal**: Sum values across columns (row-wise), not down a column.
- **Alias**: Give an expression result a column name (Polars).

*Horizontal expression — row-level computation across columns.*
```python
# Horizontal expression — row-level computation across columns
scores_pl.select(
    "symbol",
    pl.sum_horizontal("pe_zscore", "pb_zscore").round(4).alias("combined_value"),
).head(5)
```
```text
shape: (5, 2)

('symbol', 'str')  ('combined_value', 'f64')
           BNP.PA                     2.1745
           DTE.DE                     0.7141
           IFX.DE                     1.1466
           ENR.DE                    -1.6461
           ABI.BR                     1.3182
```

*Horizontal expression — row-level computation across columns.*
```python
# Horizontal expression — row-level computation across columns
scores_pl.select(
    "symbol",
    pl.mean_horizontal("relative_value_score", "momentum_score", "sentiment_score").round(4).alias("avg_factor"),
).head(5)
```
```text
shape: (5, 2)

('symbol', 'str')  ('avg_factor', 'f64')
           BNP.PA                 0.6839
           DTE.DE                 0.5150
           IFX.DE                 0.5122
           ENR.DE                 0.4174
           ABI.BR                 0.4069
```

*Horizontal expression — concatenate strings across columns.*
```python
# Horizontal expression — concatenate strings across columns
dim_pl.select(
    pl.concat_str("short_name", pl.lit(" ("), "country", pl.lit(")")).alias("display_name"),
).head(5)
```
```text
shape: (5, 1)

   ('display_name', 'str')
ASML HOLDING (Netherlands)
             LVMH (France)
      HERMES INTL (France)
          L'OREAL (France)
          SAP SE (Germany)
```

### Polars Window Expressions — .over() for group-level computation

- **Window (.over)**: Compute a value per row based on its group, without collapsing rows. Like SQL OVER(PARTITION BY).

> [!info] .over("col") is the Polars equivalent
>
> `.over("col")` is the Polars equivalent of SQL `PARTITION BY` — it computes an expression **within each group** without collapsing rows. Equivalent to Pandas `groupby("col").transform()`. Chain any expression before `.over()`: `.mean().over()`, `.rank().over()`, `.cum_sum().over()`, `.shift().over()`.

*.over("symbol") — window expression: rank and mean within each symbol group.*
```python
# .over("symbol") — window expression: rank and mean within each symbol group
ohlcv_pl.filter(pl.col("symbol").is_in(["ASML.AS", "MC.PA"])).with_columns(
    pl.col("close").rank(descending=True).over("symbol").alias("price_rank"),
    pl.col("close").mean().over("symbol").round(2).alias("avg_close"),
).select("symbol", "date", "close", "price_rank", "avg_close").head(10)
```
```text
shape: (10, 5)

('symbol', 'str') ('date', 'date')  ('close', 'f64')  ('price_rank', 'f64')  ('avg_close', 'f64')
          ASML.AS       2021-01-04            406.25                 1326.0                671.35
          ASML.AS       2021-01-05            406.90                 1325.0                671.35
          ASML.AS       2021-01-06            402.85                 1329.0                671.35
          ASML.AS       2021-01-07            403.90                 1327.0                671.35
          ASML.AS       2021-01-08            416.05                 1319.0                671.35
          ASML.AS       2021-01-11            414.90                 1320.5                671.35
          ASML.AS       2021-01-12            418.95                 1318.0                671.35
          ASML.AS       2021-01-13            422.45                 1316.0                671.35
          ASML.AS       2021-01-14            447.35                 1288.0                671.35
          ASML.AS       2021-01-15            435.85                 1307.0                671.35
```

*filter context — keep rows matching a boolean expression.*
```python
# filter context — keep rows matching a boolean expression
ohlcv_pl.filter(pl.col("symbol") == "ASML.AS").sort("date").with_columns(
    pl.col("volume").cum_sum().over("symbol").alias("cumulative_volume"),
).select("symbol", "date", "volume", "cumulative_volume").tail(10)
```
```text
shape: (10, 4)

('symbol', 'str') ('date', 'date')  ('volume', 'i64')  ('cumulative_volume', 'i64')
          ASML.AS       2026-02-27            1010698                     938726541
          ASML.AS       2026-03-02             871267                     939597808
          ASML.AS       2026-03-03             941945                     940539753
          ASML.AS       2026-03-04             714587                     941254340
          ASML.AS       2026-03-05             778081                     942032421
          ASML.AS       2026-03-06             857271                     942889692
          ASML.AS       2026-03-09             689086                     943578778
          ASML.AS       2026-03-10             800815                     944379593
          ASML.AS       2026-03-11             562904                     944942497
          ASML.AS       2026-03-12             128223                     945070720
```

### Expression Arithmetic

- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **Alias**: Give an expression result a column name (Polars).

*Continuing expressions — chain methods on pl.col() results.*
```python
# Continuing expressions — chain methods on pl.col() results
ohlcv_pl.select(
    "symbol", "date",
    ((pl.col("close") + pl.col("open")) / 2).alias("mid_price"),
    (pl.col("high") - pl.col("low")).alias("range"),
    (pl.col("close") > pl.col("open")).alias("green_candle"),
).head(5)
```
```text
shape: (5, 5)

('symbol', 'str') ('date', 'date')  ('mid_price', 'f64')  ('range', 'f64')  ('green_candle', 'bool')
           ABI.BR       2021-01-04                57.680              2.07                     False
           ABI.BR       2021-01-05                57.040              1.23                      True
           ABI.BR       2021-01-06                58.365              1.55                      True
           ABI.BR       2021-01-07                58.540              0.98                     False
           ABI.BR       2021-01-08                58.010              0.97                     False
```

### Folds

- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **pl.lit**: Create a constant/literal value as an expression.
- **Fold**: Reduce across columns by applying a function cumulatively.

*Horizontal expression — row-level computation across columns.*
```python
# Horizontal expression — row-level computation across columns
scores_pl.select(
    "symbol",
    pl.fold(
        acc=pl.lit(0.0),
        function=lambda acc, col: acc + col,
        exprs=[pl.col("pe_zscore"), pl.col("pb_zscore")],
    ).alias("sum_zscores"),
).head(5)
```
```text
shape: (5, 2)

('symbol', 'str')  ('sum_zscores', 'f64')
           BNP.PA                2.174528
           DTE.DE                0.714050
           IFX.DE                1.146613
           ENR.DE               -1.646076
           ABI.BR                1.318159
```

### Polars Selectors (cs module) — select columns by dtype

> [!info] import polars.selectors as cs
>
> `import polars.selectors as cs` — select columns by **dtype** instead of name. `cs.numeric()` selects all numeric columns, `cs.float()` only floats, `cs.string()` only strings. Combine with `|` (union), `&` (intersection), `-` (difference). Use `cs.by_name()` to mix name-based and type-based selection.

*cs.numeric() — select all numeric columns regardless of name.*
```python
# cs.numeric() — select all numeric columns regardless of name
scores_pl.select(cs.numeric()).head(3)
```
```text
shape: (3, 27)

 ('id', 'i64')  ('pe_zscore', 'f64')  ('pb_zscore', 'f64')  ('ev_ebitda_zscore', 'f64')  ('yield_zscore', 'f64')  ('relative_value_score', 'f64')  ('relative_value_rank', 'i64')  ('relative_strength', 'f64')  ('sma_50_ratio', 'f64')  ('sma_200_ratio', 'f64')  ('dist_from_52w_high', 'f64')  ('momentum_score', 'f64')  ('momentum_rank', 'i64')  ('implied_upside', 'f64')  ('recommendation_mean', 'f64')  ('sentiment_score', 'f64')  ('sentiment_rank', 'i64')  ('composite_score', 'f64')  ('composite_rank', 'i64')  ('sma_30_close', 'f64')  ('sma_90_close', 'f64')  ('market_cap', 'i64')  ('index_weight', 'f64')  ('current_price', 'f64')  ('day_change_pct', 'f64')  ('five_day_change_pct', 'f64')  ('ytd_change_pct', 'f64')
           163              0.913389              1.261140                          NaN                 2.388962                         1.521163                               1                      0.016123                 1.009090                  1.130264                       0.082486                   0.477966                        16                   0.153157                         1.84211                    0.052711                         25                    0.683947                          1                92.085000                81.181889            99751215104                 0.019525                    89.320                   0.011437                       -0.073156                   0.105582
           168              0.326587              0.387463                     0.379532                -0.127867                         0.241429                              24                     -0.205598                 1.120650                  1.112416                       0.055524                   0.685752                         8                   0.121212                         1.33333                    0.617835                         10                    0.515005                          2                30.838000                28.554556           164294311936                 0.032159                    33.000                   0.011649                       -0.019608                   0.193059
           174              0.509398              0.637215                     0.677068                -0.696662                         0.281755                              22                      0.000965                 1.048244                  1.198626                       0.088845                   0.675764                         9                   0.126408                         1.37500                    0.579187                         11                    0.512235                          3                43.480333                38.855556            57222533120                 0.011201                    43.945                   0.054343                       -0.066490                   0.164723
```

*Horizontal expression — row-level computation across columns.*
```python
# Horizontal expression — row-level computation across columns
scores_pl.select(cs.by_name("symbol", "score_date") | cs.float()).head(3)
```
```text
shape: (3, 23)

('symbol', 'str') ('score_date', 'date')  ('pe_zscore', 'f64')  ('pb_zscore', 'f64')  ('ev_ebitda_zscore', 'f64')  ('yield_zscore', 'f64')  ('relative_value_score', 'f64')  ('relative_strength', 'f64')  ('sma_50_ratio', 'f64')  ('sma_200_ratio', 'f64')  ('dist_from_52w_high', 'f64')  ('momentum_score', 'f64')  ('implied_upside', 'f64')  ('recommendation_mean', 'f64')  ('sentiment_score', 'f64')  ('composite_score', 'f64')  ('sma_30_close', 'f64')  ('sma_90_close', 'f64')  ('index_weight', 'f64')  ('current_price', 'f64')  ('day_change_pct', 'f64')  ('five_day_change_pct', 'f64')  ('ytd_change_pct', 'f64')
           BNP.PA             2026-03-04              0.913389              1.261140                          NaN                 2.388962                         1.521163                      0.016123                 1.009090                  1.130264                       0.082486                   0.477966                   0.153157                         1.84211                    0.052711                    0.683947                92.085000                81.181889                 0.019525                    89.320                   0.011437                       -0.073156                   0.105582
           DTE.DE             2026-03-04              0.326587              0.387463                     0.379532                -0.127867                         0.241429                     -0.205598                 1.120650                  1.112416                       0.055524                   0.685752                   0.121212                         1.33333                    0.617835                    0.515005                30.838000                28.554556                 0.032159                    33.000                   0.011649                       -0.019608                   0.193059
           IFX.DE             2026-03-04              0.509398              0.637215                     0.677068                -0.696662                         0.281755                      0.000965                 1.048244                  1.198626                       0.088845                   0.675764                   0.126408                         1.37500                    0.579187                    0.512235                43.480333                38.855556                 0.011201                    43.945                   0.054343                       -0.066490                   0.164723
```

*Horizontal expression — row-level computation across columns.*
```python
# Horizontal expression — row-level computation across columns
scores_pl.select(cs.contains("score")).head(3)
```
```text
shape: (3, 10)

('score_date', 'date')  ('pe_zscore', 'f64')  ('pb_zscore', 'f64')  ('ev_ebitda_zscore', 'f64')  ('yield_zscore', 'f64')  ('relative_value_score', 'f64')  ('momentum_score', 'f64')  ('sentiment_score', 'f64')  ('composite_score', 'f64') ('_scored_at', 'datetime[ns]')
            2026-03-04              0.913389              1.261140                          NaN                 2.388962                         1.521163                   0.477966                    0.052711                    0.683947     2026-03-04 22:40:25.489180
            2026-03-04              0.326587              0.387463                     0.379532                -0.127867                         0.241429                   0.685752                    0.617835                    0.515005     2026-03-04 22:40:25.489180
            2026-03-04              0.509398              0.637215                     0.677068                -0.696662                         0.281755                   0.675764                    0.579187                    0.512235     2026-03-04 22:40:25.489180
```

## Polars Expression Lookup

| Concept | Polars | Pandas Equivalent |
|---|---|---|
| Expression | pl.col("x") * 2 | No equivalent |
| select | df.select(...) | df[api-protocols-comparison](https://alp78.github.io/elysium/14-Data-Architecture/APIs-and-Protocols/api-protocols-comparison) |
| with_columns | df.with_columns(...) | df.assign(...) |
| filter | df.filter(expr) | df[condition] |
| group_by.agg | df.group_by().agg(exprs) | df.groupby().agg() |
| .over() | expr.over("col") | groupby().transform() |
| Horizontal | pl.sum_horizontal(...) | df[cols].sum(axis=1) |
| Folds | pl.fold(...) | df.apply(axis=1) |
| Selectors | cs.numeric() | df.select_dtypes() |

---

## Part 3: Method Chaining & Pipes

### Imperative vs Chained Style

Imperative code mutates step by step; chained (declarative) code reads as a pipeline.

#### Pandas — unchained imperative style

> [!warning] Imperative style (separate statements per
>
> Imperative style (separate statements per step) is readable for beginners but creates many intermediate variables, makes it easy to accidentally reuse stale references, and is hard to compose into reusable pipelines. Prefer chained style below.

> [!success] Prefer method chaining to eliminate stale intermediate variables
>
> Use Pandas method chaining — `(df.query(...).assign(...).sort_values(...))` — or wrap the chain in a `pipe()` call for named steps. In Polars, chain `.filter()`, `.with_columns()`, and `.sort()` directly on the LazyFrame. Both styles produce a single, immutable result with no reused intermediate names.

_Filters OHLCV to ASML.AS, computes `daily_return` as a separate in-place assignment, then re-sorts — using the same variable `df` at each step, illustrating how imperative style accumulates stale intermediate state._

*Imperative: each step is a separate statement, intermediate variable "df" is reused.*
```python
# Imperative: each step is a separate statement, intermediate variable "df" is reused
df = ohlcv_pd[ohlcv_pd["symbol"] == "ASML.AS"].copy()
df["daily_return"] = (df["close"] - df["open"]) / df["open"] * 100
df = df.sort_values("date", ascending=False)
display(df[["symbol", "date", "close", "daily_return"]].head(10))
```
```text
symbol       date  close  daily_return
11964 ASML.AS 2026-03-12 1190.8     -0.334784
11963 ASML.AS 2026-03-11 1198.8      0.875126
11962 ASML.AS 2026-03-10 1200.0      0.976102
11961 ASML.AS 2026-03-09 1147.6      7.052239
11960 ASML.AS 2026-03-06 1147.0     -3.288364
11959 ASML.AS 2026-03-05 1186.0     -1.051226
11958 ASML.AS 2026-03-04 1199.8      2.459436
11957 ASML.AS 2026-03-03 1161.8     -2.090005
11956 ASML.AS 2026-03-02 1210.4      1.475520
11955 ASML.AS 2026-02-27 1233.4     -0.113379
```

#### Pandas — chained declarative style with .pipe()

> [!info] Chained declarative style
>
> Chained style: start from the DataFrame and chain `.query()`, `.assign()`, `.sort_values()`, `.head()` in one expression. No intermediate variables. Wrap in parentheses `(...)` for multi-line readability. Use `.pipe(func)` to insert custom functions into the chain.

_Rewrites the same ASML.AS transformation as a single Pandas method chain: `.query()` → `.assign()` → `.sort_values()` → `.head()` → column selection, producing identical output with no mutable intermediate variables._

*Runs `result_pd = (` and shows the resulting output.*
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
```text
symbol       date  close  daily_return
11964 ASML.AS 2026-03-12 1190.8         -0.33
11963 ASML.AS 2026-03-11 1198.8          0.88
11962 ASML.AS 2026-03-10 1200.0          0.98
11961 ASML.AS 2026-03-09 1147.6          7.05
11960 ASML.AS 2026-03-06 1147.0         -3.29
11959 ASML.AS 2026-03-05 1186.0         -1.05
11958 ASML.AS 2026-03-04 1199.8          2.46
11957 ASML.AS 2026-03-03 1161.8         -2.09
11956 ASML.AS 2026-03-02 1210.4          1.48
11955 ASML.AS 2026-02-27 1233.4         -0.11
```

#### Polars — natural chaining with expressions

> [!info] Polars is designed for chaining
>
> Polars is designed for chaining — every method returns a new DataFrame. No `.pipe()` needed, no `.copy()` needed. The chain reads top to bottom: filter → compute → sort → limit → select.

_Reproduces the ASML.AS daily return pipeline in Polars as a clean top-to-bottom chain: `.filter()` → `.with_columns()` → `.sort()` → `.head()` → `.select()`, demonstrating that no `.pipe()` or `.copy()` is needed._

*Runs `result_pl = (` and shows the resulting output.*
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
```text
shape: (10, 4)

('symbol', 'str') ('date', 'date')  ('close', 'f64')  ('daily_return', 'f64')
          ASML.AS       2026-03-12            1190.8                    -0.33
          ASML.AS       2026-03-11            1198.8                     0.88
          ASML.AS       2026-03-10            1200.0                     0.98
          ASML.AS       2026-03-09            1147.6                     7.05
          ASML.AS       2026-03-06            1147.0                    -3.29
          ASML.AS       2026-03-05            1186.0                    -1.05
          ASML.AS       2026-03-04            1199.8                     2.46
          ASML.AS       2026-03-03            1161.8                    -2.09
          ASML.AS       2026-03-02            1210.4                     1.48
          ASML.AS       2026-02-27            1233.4                    -0.11
```

---

### Reusable Functions & Expressions

#### Pandas .pipe() — compose reusable transform functions

> [!info] .pipe(func) inserts a custom function
>
> `.pipe(func)` inserts a custom function into a Pandas chain. The function receives the DataFrame as its first argument and must return a DataFrame. This lets you break complex transforms into named, testable, reusable functions.

_Defines two reusable Pandas transform functions — `add_moving_averages()` (7-day and 30-day SMAs via `.rolling().mean()`) and `flag_high_volume()` (boolean flag for volume > 2× average) — and composes them into the ASML.AS pipeline using `.pipe()`._

*Reusable transform functions — each takes a DataFrame and returns a DataFrame.*
```python
# Reusable transform functions — each takes a DataFrame and returns a DataFrame
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
```text
symbol       date  close       sma_7      sma_30  high_volume
11955 ASML.AS 2026-02-27 1233.4 1251.514286 1201.400000        False
11956 ASML.AS 2026-03-02 1210.4 1247.542857 1204.400000        False
11957 ASML.AS 2026-03-03 1161.8 1234.142857 1205.126667        False
11958 ASML.AS 2026-03-04 1199.8 1227.085714 1206.626667        False
11959 ASML.AS 2026-03-05 1186.0 1216.028571 1206.946667        False
11960 ASML.AS 2026-03-06 1147.0 1195.828571 1205.906667        False
11961 ASML.AS 2026-03-09 1147.6 1183.714286 1204.893333        False
11962 ASML.AS 2026-03-10 1200.0 1178.942857 1204.306667        False
11963 ASML.AS 2026-03-11 1198.8 1177.285714 1204.453333        False
11964 ASML.AS 2026-03-12 1190.8 1181.428571 1204.413333        False
```

#### Polars — reusable functions with expression variables

> [!info] In Polars, reuse is achieved
>
> In Polars, reuse is achieved by **storing expressions in variables**. An expression is just a Python object — assign it to a name, then pass it into `.with_columns()` or `.select()` anywhere. No `.pipe()` needed.

_Stores the daily return, 7-day SMA, and 30-day SMA computations as named Polars expression variables (`daily_return_expr`, `sma_7_expr`, `sma_30_expr`), then applies all three in a single `.with_columns()` call on the ASML.AS pipeline — demonstrating expression reuse without `.pipe()`._

*Reusable expressions — define once, use in any context.*
```python
# Reusable expressions — define once, use in any context
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
```text
shape: (10, 6)

('symbol', 'str') ('date', 'date')  ('close', 'f64')  ('daily_return', 'f64')  ('sma_7', 'f64')  ('sma_30', 'f64')
          ASML.AS       2026-02-27            1233.4                    -0.11       1251.514286        1201.400000
          ASML.AS       2026-03-02            1210.4                     1.48       1247.542857        1204.400000
          ASML.AS       2026-03-03            1161.8                    -2.09       1234.142857        1205.126667
          ASML.AS       2026-03-04            1199.8                     2.46       1227.085714        1206.626667
          ASML.AS       2026-03-05            1186.0                    -1.05       1216.028571        1206.946667
          ASML.AS       2026-03-06            1147.0                    -3.29       1195.828571        1205.906667
          ASML.AS       2026-03-09            1147.6                     7.05       1183.714286        1204.893333
          ASML.AS       2026-03-10            1200.0                     0.98       1178.942857        1204.306667
          ASML.AS       2026-03-11            1198.8                     0.88       1177.285714        1204.453333
          ASML.AS       2026-03-12            1190.8                    -0.33       1181.428571        1204.413333
```

### Recipe Pipeline: Full Example

*Pandas.*
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
```text
symbol                      short_name                 sector  avg_return  positive_days  total_days  win_rate
13  SAP.DE                          SAP SE             Technology    0.089682            702        1324      53.0
 8  ENR.DE               Siemens Energy AG            Industrials    0.050090            641        1324      48.4
14  SIE.DE                      SIEMENS AG            Industrials    0.041032            687        1324      51.9
 5  DB1.DE              DEUTSCHE BOERSE AG     Financial Services    0.036636            658        1324      49.7
12  RHM.DE                  RHEINMETALL AG            Industrials    0.033806            640        1324      48.3
11 MUV2.DE MUENCHENER RUECKVERS.-GES. AG N     Financial Services    0.029580            670        1324      50.6
 7  DTE.DE             DEUTSCHE TELEKOM AG Communication Services    0.026986            683        1324      51.6
 6  DHL.DE                DEUTSCHE POST AG            Industrials    0.019929            688        1324      52.0
10  MBG.DE          Mercedes-Benz Group AG      Consumer Cyclical    0.009697            648        1324      48.9
 4  BMW.DE     BAYERISCHE MOTOREN WERKE AG      Consumer Cyclical    0.009107            657        1324      49.6
 1  ALV.DE                      Allianz SE     Financial Services    0.007040            661        1324      49.9
 2  BAS.DE                         BASF SE        Basic Materials   -0.017599            635        1324      48.0
 0  ADS.DE                       adidas AG      Consumer Cyclical   -0.018576            609        1324      46.0
 3 BAYN.DE                        Bayer AG             Healthcare   -0.027584            636        1324      48.0
 9  IFX.DE        INFINEON TECHNOLOGIES AG             Technology   -0.054771            622        1324      47.0
15  VOW.DE                   VOLKSWAGEN AG      Consumer Cyclical   -0.063948            599        1324      45.2
```

*Polars.*
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
```text
shape: (16, 7)

('symbol', 'str')    ('short_name', 'str')  ('sector', 'str') ('avg_return', 'f64') ('positive_days', 'u32') ('total_days', 'u32') ('win_rate', 'f64')
           SAP.DE                   SAP SE         Technology                0.0897                      702                  1324                53.0
           ENR.DE        Siemens Energy AG        Industrials                0.0501                      641                  1324                48.4
           SIE.DE               SIEMENS AG        Industrials                 0.041                      687                  1324                51.9
           DB1.DE       DEUTSCHE BOERSE AG Financial Services                0.0366                      658                  1324                49.7
           RHM.DE           RHEINMETALL AG        Industrials                0.0338                      640                  1324                48.3
                …                        …                  …                     …                        …                     …                   …
           BAS.DE                  BASF SE    Basic Materials               -0.0176                      635                  1324                48.0
           ADS.DE                adidas AG  Consumer Cyclical               -0.0186                      609                  1324                46.0
          BAYN.DE                 Bayer AG         Healthcare               -0.0276                      636                  1324                48.0
           IFX.DE INFINEON TECHNOLOGIES AG         Technology               -0.0548                      622                  1324                47.0
           VOW.DE            VOLKSWAGEN AG  Consumer Cyclical               -0.0639                      599                  1324                45.2
```

### Clean Code: Breaking Long Chains

- **With Columns**: Add new columns or replace existing ones. All original columns are kept.

*Breaking long chains — assign intermediate steps to named variables.*
```python
# Breaking long chains — assign intermediate steps to named variables
filtered = ohlcv_pl.filter(pl.col("symbol") == "ASML.AS").sort("date")
enriched = filtered.with_columns(
    ((pl.col("close") - pl.col("open")) / pl.col("open") * 100).round(2).alias("daily_return"),
    (pl.col("high") - pl.col("low")).round(2).alias("range"),
)
final = enriched.select("symbol", "date", "close", "daily_return", "range").tail(10)
display(final)
```
```text
shape: (10, 5)

('symbol', 'str') ('date', 'date')  ('close', 'f64')  ('daily_return', 'f64')  ('range', 'f64')
          ASML.AS       2026-02-27            1233.4                    -0.11              38.2
          ASML.AS       2026-03-02            1210.4                     1.48              51.4
          ASML.AS       2026-03-03            1161.8                    -2.09              43.4
          ASML.AS       2026-03-04            1199.8                     2.46              43.2
          ASML.AS       2026-03-05            1186.0                    -1.05              37.0
          ASML.AS       2026-03-06            1147.0                    -3.29              79.8
          ASML.AS       2026-03-09            1147.6                     7.05              87.4
          ASML.AS       2026-03-10            1200.0                     0.98              36.2
          ASML.AS       2026-03-11            1198.8                     0.88              36.8
          ASML.AS       2026-03-12            1190.8                    -0.33              14.4
```

## Method Chaining Lookup

| Feature | Pandas | Polars |
|---|---|---|
| Basic chaining | .query().assign().sort_values() | .filter().with_columns().sort() |
| Custom functions | .pipe(func) | Regular function calls |
| Reusable logic | Functions returning DataFrames | Expressions as variables |
| Debugging | Insert .pipe(print) | Intermediate variables |

---


## Risk Reference

#### Prefer expressions before row callbacks

Native transforms such as `.assign()` and `.with_columns()` keep work inside vectorized execution. If `.apply()` or `.map_elements()` produce the same business result as column arithmetic, keep the expression form and treat the callback as the last resort.

*Compares a row callback with the equivalent vectorized arithmetic on a three-row sample.*
```python
scores_pd[["symbol", "current_price"]].head(3).assign(
    scaled_apply=lambda d: d["current_price"].apply(lambda x: round(x * 1.01, 2)),
    scaled_vectorized=lambda d: (d["current_price"] * 1.01).round(2),
)
```
```text
symbol  current_price  scaled_apply  scaled_vectorized
BNP.PA         89.320         90.21              90.21
DTE.DE         33.000         33.33              33.33
IFX.DE         43.945         44.38              44.38
```

#### Always close a conditional with `.otherwise()`

A `pl.when().then()` chain without `.otherwise()` writes `null` into every non-matching row. That fallback becomes a data-quality decision, not a formatting detail.

*Shows how a missing fallback branch leaves unmatched rows as `null`.*
```python
ohlcv_pl.select("symbol", "date", "open", "close").head(5).with_columns(
    pl.when(pl.col("close") > pl.col("open")).then(pl.lit("up")).alias("move")
)
```
```text
shape: (5, 5)
┌────────┬────────────┬───────┬───────┬──────┐
│ symbol ┆ date       ┆ open  ┆ close ┆ move │
│ ---    ┆ ---        ┆ ---   ┆ ---   ┆ ---  │
│ str    ┆ date       ┆ f64   ┆ f64   ┆ str  │
╞════════╪════════════╪═══════╪═══════╪══════╡
│ ABI.BR ┆ 2021-01-04 ┆ 58.15 ┆ 57.21 ┆ null │
│ ABI.BR ┆ 2021-01-05 ┆ 56.9  ┆ 57.18 ┆ up   │
│ ABI.BR ┆ 2021-01-06 ┆ 57.96 ┆ 58.77 ┆ up   │
│ ABI.BR ┆ 2021-01-07 ┆ 58.68 ┆ 58.4  ┆ null │
│ ABI.BR ┆ 2021-01-08 ┆ 58.16 ┆ 57.86 ┆ null │
└────────┴────────────┴───────┴───────┴──────┘
```

#### Expect arithmetic to promote types

Operations such as `/` on rank columns yield floating-point results even when both inputs started as integer-like ranks. If the downstream contract requires an integer dtype, cast back explicitly after the calculation.

*Calculates a ratio from two rank columns to show the float promotion introduced by division.*
```python
scores_pd[["symbol", "relative_value_rank", "momentum_rank"]].head(3).assign(
    rank_ratio=lambda d: d["relative_value_rank"] / d["momentum_rank"]
)
```
```text
symbol  relative_value_rank  momentum_rank  rank_ratio
BNP.PA                    1             16    0.062500
DTE.DE                   24              8    3.000000
IFX.DE                   22              9    2.444444
```

## Pattern Reference

#### Alias derived outputs explicitly

Name derived columns with `.alias("daily_return")` or a named `assign()` key so the output schema describes intent instead of inheriting a source-column name by accident.

*Derives `daily_return` with an explicit alias on a small `ASML.AS` slice.*
```python
ohlcv_pl.filter(pl.col("symbol") == "ASML.AS").sort("date").head(3).with_columns(
    ((pl.col("close") - pl.col("open")) / pl.col("open") * 100).round(2).alias("daily_return")
).select("symbol", "date", "close", "daily_return")
```
```text
shape: (3, 4)
┌─────────┬────────────┬────────┬──────────────┐
│ symbol  ┆ date       ┆ close  ┆ daily_return │
│ ---     ┆ ---        ┆ ---    ┆ ---          │
│ str     ┆ date       ┆ f64    ┆ f64          │
╞═════════╪════════════╪════════╪══════════════╡
│ ASML.AS ┆ 2021-01-04 ┆ 406.25 ┆ 0.56         │
│ ASML.AS ┆ 2021-01-05 ┆ 406.9  ┆ 0.09         │
│ ASML.AS ┆ 2021-01-06 ┆ 402.85 ┆ -0.97        │
└─────────┴────────────┴────────┴──────────────┘
```

#### Validate a small slice before widening the transform

Run `head()` or `limit()` with the exact expression chain you plan to use in production. A short sample catches naming mistakes, null propagation, and obviously wrong values before the full pipeline hides the problem.

*Applies a pricing transform to a three-row sample before scaling it to the full dataset.*
```python
scores_pl.head(3).select("symbol", "current_price", "day_change_pct").with_columns(
    (pl.col("current_price") * (1 + pl.col("day_change_pct"))).round(2).alias("price_after_day_move")
)
```
```text
shape: (3, 4)
┌────────┬───────────────┬────────────────┬──────────────────────┐
│ symbol ┆ current_price ┆ day_change_pct ┆ price_after_day_move │
│ ---    ┆ ---           ┆ ---            ┆ ---                  │
│ str    ┆ f64           ┆ f64            ┆ f64                  │
╞════════╪═══════════════╪════════════════╪══════════════════════╡
│ BNP.PA ┆ 89.32         ┆ 0.011437       ┆ 90.34                │
│ DTE.DE ┆ 33.0          ┆ 0.011649       ┆ 33.38                │
│ IFX.DE ┆ 43.945        ┆ 0.054343       ┆ 46.33                │
└────────┴───────────────┴────────────────┴──────────────────────┘
```

#### Use `pl.struct()` for multi-column custom logic

When custom logic genuinely needs more than one source field, `pl.struct([...]).map_elements(..., return_dtype=...)` makes the Python boundary explicit and keeps the input columns grouped as a single record.

*Builds a custom blended factor from two score columns with `pl.struct()` and an explicit `return_dtype=`.*
```python
scores_pl.select("symbol", "relative_value_score", "momentum_score").head(3).with_columns(
    pl.struct(["relative_value_score", "momentum_score"])
    .map_elements(
        lambda row: round((row["relative_value_score"] + row["momentum_score"]) / 2, 4),
        return_dtype=pl.Float64,
    )
    .alias("blended_score")
)
```
```text
shape: (3, 4)
┌────────┬──────────────────────┬────────────────┬───────────────┐
│ symbol ┆ relative_value_score ┆ momentum_score ┆ blended_score │
│ ---    ┆ ---                  ┆ ---            ┆ ---           │
│ str    ┆ f64                  ┆ f64            ┆ f64           │
╞════════╪══════════════════════╪════════════════╪═══════════════╡
│ BNP.PA ┆ 1.521163             ┆ 0.477966       ┆ 0.9996        │
│ DTE.DE ┆ 0.241429             ┆ 0.685752       ┆ 0.4636        │
│ IFX.DE ┆ 0.281755             ┆ 0.675764       ┆ 0.4788        │
└────────┴──────────────────────┴────────────────┴───────────────┘
```

## Failure Mode Reference

#### Repair chained assignment with `.loc[]` or `.assign()`

If the intent is to write back into a filtered Pandas frame, use `.loc[]` or return a new frame with `.assign()`. That removes the `SettingWithCopyWarning` ambiguity and makes the mutation target explicit.

*Uses `.loc[]` on a copied slice to assign a categorical direction flag safely.*
```python
df = scores_pd[["symbol", "day_change_pct"]].head(5).copy()
df.loc[df["day_change_pct"] > 0, "direction"] = "up"
df.loc[df["day_change_pct"] <= 0, "direction"] = "down_or_flat"
df
```
```text
symbol  day_change_pct    direction
BNP.PA        0.011437           up
DTE.DE        0.011649           up
IFX.DE        0.054343           up
ENR.DE        0.047297           up
ABI.BR       -0.017073 down_or_flat
```

#### Clean strings before `.cast()`

Casting raw strings directly with `.cast()` is brittle when whitespace or formatting artifacts are present. Normalize the source first with `.str.strip_chars()` or a related string method, then cast.

*Strips whitespace from rank strings before casting them to `Int64`.*
```python
pl.DataFrame({"raw_rank": ["1", " 2 ", "3"]}).with_columns(
    pl.col("raw_rank").str.strip_chars().cast(pl.Int64).alias("rank_int")
)
```
```text
shape: (3, 2)
┌──────────┬──────────┐
│ raw_rank ┆ rank_int │
│ ---      ┆ ---      │
│ str      ┆ i64      │
╞══════════╪══════════╡
│ 1        ┆ 1        │
│  2       ┆ 2        │
│ 3        ┆ 3        │
└──────────┴──────────┘
```

#### Stabilize callback schemas with `return_dtype=`

When `map_elements()` crosses the Python boundary, declare `return_dtype=` so Polars does not have to infer the result schema from mixed values or null branches.

*Maps float values to integers with an explicit `return_dtype=` declaration.*
```python
pl.DataFrame({"x": [1.2, 2.7, None]}).with_columns(
    pl.col("x").map_elements(
        lambda value: int(value) if value is not None else None,
        return_dtype=pl.Int64,
    ).alias("x_int")
)
```
```text
shape: (3, 2)
┌──────┬───────┐
│ x    ┆ x_int │
│ ---  ┆ ---   │
│ f64  ┆ i64   │
╞══════╪═══════╡
│ 1.2  ┆ 1     │
│ 2.7  ┆ 2     │
│ null ┆ null  │
└──────┴───────┘
```

#### Check for empty chains early

After a restrictive `query()` or `filter()`, inspect `.shape`, `.is_empty()`, or a short preview before assuming later transforms ran on data. An empty chain is easier to diagnose at the filter boundary than after several downstream steps.

*Checks the shape and preview of an over-filtered Pandas query before continuing the pipeline.*
```python
empty = scores_pd.query("country == 'Atlantis'")
print(empty.shape)
print(empty[["symbol", "country", "current_price"]].head().to_string(index=False))
```
```text
(0, 36)
Empty DataFrame
Columns: [symbol, country, current_price]
Index: []
```
