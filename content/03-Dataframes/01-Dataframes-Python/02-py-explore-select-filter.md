---
title: "02 - Explore, Select & Filter - Python"
tags: [python, pandas, polars, dataframes]
aliases:
  - head, tail, describe, info, select, filter, isin, where
description: "Pandas/Polars DataFrame reference 02/10 — Explore, Select & Filter (head/tail, describe, column selection, row filtering). Side-by-side executable examples with cell outputs."
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# Explore, Select & Filter - Python

> [!quote]+
> "If we have data, let's look at data. If all we have are opinions, let's go with mine."
>
> — **Jim Barksdale**

> [!abstract]- Summary
>
> Uses real EuroStoxx 50 OHLCV, dimension, and scoring tables to show how Pandas and Polars preview data, inspect structure and completeness, select rows and columns, and build reproducible filter logic for exploratory analysis and profiling.
>
> **Head / Tail / Sample / Glimpse**
> - Preview row shape and representative values with `head()`, `tail()`, `sample()`, and Polars `glimpse()`, including seeded sampling for reproducible notebook output
> - Establish the three working datasets up front: `eurostoxx50_ohlcv`, `index_dim`, and `scores_daily`
>
> **Shape / Describe / Info**
> - Inspect row/column counts, summary statistics, dtypes, non-null counts, memory usage, schema, and transposed column previews with Pandas `.info()` / `.describe()` and Polars `df.schema`, `null_count()`, and `estimated_size()`
> - Contrast Pandas' numeric-default `describe()` with broader Polars summaries and Pandas workarounds such as `include="all"`
>
> **Value Counts / Unique / N-Unique / Null Inspection**
> - Profile categorical frequency, cardinality, duplicate keys, and missingness with `value_counts()`, `unique()`, `n_unique()`, `.isna()` / `.is_null()`, and null-count summaries
> - Show how null behavior differs across libraries, including Pandas `dropna=False` requirements and NaN-vs-null pitfalls
>
> **Scores / Dimension / Profiling Strategies**
> - Profile the `scores_daily` table for sparse metrics, ranked score columns, and null-heavy analytical fields before downstream filtering
> - Validate the `index_dim` dimension table for join readiness, categorical consistency, and key uniqueness, then generalize the profiling workflow into a repeatable checklist
>
> **Selecting Rows & Columns**
> - Select by label, position, name, dtype, and pattern with `.loc`, `.iloc`, bracket indexing, `select()`, `select_dtypes()`, and Polars selectors via `polars.selectors as cs`
> - Contrast Pandas' index-aware accessors with Polars' index-free model, including slice semantics, row/column subsets, and how to emulate label filters in Polars
>
> **Filtering Rows**
> - Filter with boolean masks, `df.filter(pl.col(...))`, `.query()`, `isin()` / `is_in()`, `between()` / `is_between()`, string/date predicates, null checks, seeded sampling, deduplication, null dropping, sorting, and semi-join-style membership filters
> - Compare conditional replacement patterns: Pandas `where()` / `mask()` versus Polars `when().then().otherwise()`
>
> **Operations and safety**
> - Warnings: Pandas `filter()` selects columns not rows, boolean logic requires `&` / `|` / `~` plus parentheses, NaN equality fails, `.loc` / `.iloc` slice semantics differ, deduplication depends on row order, and unseeded `sample()` is non-reproducible
> - Recommendations: 7 practices covering profile-first workflow, early filter/select pushdown, `cs` selectors, `validate=` before join-dependent filters, `is_in()` over chained ORs, `dropna=False` in Pandas `value_counts()`, and sorting before `head()` / `tail()`
> - Troubleshooting: 10 failure modes covering missing columns, unexpectedly empty filters, boolean-precedence `TypeError`s, Series-vs-DataFrame selection mistakes, unordered uniques, and dtype mismatches in `isin()`

> [!note]- Glossary
>
> **`head()` / `tail()`**
> - Methods that return the first or last `n` rows of a DataFrame, usually used as the fastest preview of raw tabular values.
> - They are the first inspection step in this note because they reveal row layout, obvious type issues, and whether the loaded data even resembles the expected dataset.
>
> > [!warning] Preview is not profiling
> >
> > A few visible rows can confirm column names and rough shape, but they do not reveal null rates, duplicate keys, or hidden outliers. Use them as the opening check, not the full diagnosis.
>
> ---
>
> **`sample()`**
> - A method that returns a random subset of rows from a DataFrame instead of the first or last rows in storage order.
> - It matters here because random sampling helps catch localized anomalies that `head()` and `tail()` can miss, especially in time-ordered datasets.
>
> > [!warning] Seed controls reproducibility
> >
> > Without `random_state=` in Pandas or `seed=` in Polars, the sampled rows change every run. That breaks notebook reproducibility and makes debugging harder.
>
> ---
>
> **`shape`**
> - The `(rows, columns)` dimensions of a DataFrame.
> - It is the fastest structural sanity check in the note because many downstream issues start with the wrong row count, unexpected width, or accidental empty results.
>
> > [!info] Cheap but high-signal
> >
> > A shape mismatch often reveals upstream filter, join, or load errors before you inspect any actual cell values.
>
> ---
>
> **`describe()`**
> - A summary method that computes descriptive statistics such as count, mean, standard deviation, min, max, and percentiles for selected columns.
> - It is used here as the first numeric quality screen for distributions, missingness, impossible ranges, and suspiciously constant columns.
>
> > [!warning] Pandas hides non-numeric columns
> >
> > Pandas excludes many non-numeric fields by default. If string, categorical, or datetime columns matter, use `include="all"` or inspect them separately.
>
> ---
>
> **`info()`**
> - A Pandas-only structural summary that reports column names, non-null counts, dtypes, and memory usage.
> - It matters because it compresses schema validation and completeness checks into one glance before deeper selection or filtering work.
>
> > [!info] No Polars equivalent
> >
> > Polars splits the same insight across `schema`, `null_count()`, and `estimated_size()`. You need multiple calls rather than one `.info()` method.
>
> ---
>
> **`glimpse()`**
> - A Polars display method that summarizes columns vertically, showing each column's name, dtype, and preview values in a transposed layout.
> - It is useful in this note for wide DataFrames where a normal horizontal preview hides important columns off-screen.
>
> > [!warning] Display helper, not transformation
> >
> > `glimpse()` is for inspection only. It does not change the underlying DataFrame or replace explicit schema and null checks.
>
> ---
>
> **`value_counts()`**
> - A frequency-count operation that reports how often each unique value occurs in a column.
> - It is central to the note's profiling workflow because it surfaces dominant categories, unexpected labels, and join-key quality issues quickly.
>
> > [!warning] Pandas drops NaN by default
> >
> > In Pandas, null-like values disappear unless you pass `dropna=False`. If you forget that flag, your cardinality analysis underreports missing data.
>
> ---
>
> **`unique()` / `n_unique()`**
> - Distinct-value operations: `unique()` returns the distinct values themselves, while `n_unique()` returns only the count.
> - They matter for deciding whether a column is categorical, suitable as a key, or contaminated by unexpected duplicates.
>
> > [!warning] Uniqueness is often unordered
> >
> > Distinct values are commonly returned in arbitrary order. If the order matters for display or testing, sort the result explicitly.
>
> ---
>
> **Null / missing value**
> - The absence of a value in a column, represented as Arrow nulls in Polars and as `NaN` or nullable sentinels such as `pd.NA` in Pandas.
> - Missingness is a core concern in this note because it changes counts, filters, deduplication, joins, and statistical summaries.
>
> > [!warning] Equality does not find nulls
> >
> > Missing values are not reliably detected with `==`. Use `.isna()`, `.notna()`, `.is_null()`, or `.is_not_null()` instead.
>
> ---
>
> **Boolean mask**
> - A per-row sequence of `True` and `False` values used to keep rows whose condition evaluates to `True`.
> - It is the basic row-filtering mechanism across the note, whether expressed directly in Pandas or through Polars expressions.
>
> > [!warning] Use bitwise operators
> >
> > Combine conditions with `&`, `|`, and `~`, not Python `and`, `or`, or `not`. Each condition also needs parentheses to avoid precedence bugs.
>
> ---
>
> **`.loc` / `.iloc`**
> - Pandas accessors for label-based selection (`.loc`) and integer-position-based selection (`.iloc`).
> - They matter because the note compares Pandas' index-aware selection model with Polars' index-free row/column access patterns.
>
> > [!warning] Slice endpoints differ
> >
> > `.loc` label slices include the right endpoint, while `.iloc` positional slices exclude it. Mixing the two models causes off-by-one selection errors.
>
> ---
>
> **Filter expression**
> - A boolean expression passed to Polars `filter()` and built from column expressions such as `pl.col("close") > 50`.
> - It matters because Polars filtering is expression-driven and composes cleanly with selection, lazy execution, and optimizer pushdown.
>
> > [!warning] Pandas `filter()` means something else
> >
> > In Polars, `filter()` selects rows. In Pandas, `filter()` is mostly for column-label selection. The same method name points at different operations.
>
> ---
>
> **`query()`**
> - A Pandas method that filters rows using a string expression instead of explicit bracketed boolean masks.
> - It appears in the note as an alternative filtering syntax for readable notebook code when conditions are simple and column names are expression-friendly.
>
> > [!warning] String syntax has limits
> >
> > `query()` is convenient, but it is still parsed text. Complex expressions, odd column names, or heavy refactoring can make explicit masks safer and clearer.
>
> ---
>
> **Selector / `cs`**
> - The Polars selectors API, imported as `polars.selectors as cs`, for choosing columns by dtype family, pattern, or set logic.
> - It matters because the note uses selectors to avoid brittle hard-coded column lists when exploring changing schemas.
>
> > [!info] Separate module import
> >
> > Selectors are not available automatically from the main `pl` namespace in the same way users often expect. Import `polars.selectors as cs` explicitly.
>
> ---
>
> **`isin()` / `is_in()`**
> - Membership tests that return a boolean mask indicating whether each value belongs to a provided list or set of candidates.
> - They are used in the note for watchlist-style filters, semi-join-style membership checks, and compact alternatives to chained equality conditions.
>
> > [!warning] Method names differ
> >
> > Pandas uses `.isin()`, while Polars uses `.is_in()`. The underscore is easy to miss and is a common source of copy-paste errors.
>
> ---
>
> **`between()` / `is_between()`**
> - Range predicates that test whether values fall between two bounds.
> - They matter because price ranges, date windows, and score thresholds are common filter shapes throughout exploratory work.
>
> > [!warning] Boundary rules vary
> >
> > Pandas is inclusive by default, while Polars exposes boundary control through `closed=`. If edge values matter, make the inclusion rule explicit.
>
> ---
>
> **`where()` / `mask()` / `when().then().otherwise()`**
> - Conditional replacement patterns that keep or replace values based on a boolean condition, with Pandas and Polars exposing different APIs.
> - They matter because the note uses them to express row-dependent value logic without manually splitting and recombining DataFrames.
>
> > [!warning] Pandas `where` and `mask` invert each other
> >
> > `where()` keeps values where the condition is `True`, while `mask()` replaces values where the condition is `True`. Polars' `when().then().otherwise()` is more explicit about branch direction.
>
> ---
>
> **`drop_duplicates()` / `unique()`**
> - Row-deduplication operations that keep one representative row from repeated values or repeated key combinations.
> - They matter because profiling and filtering often depend on confirming whether keys are truly unique before joins or aggregations.
>
> > [!warning] Kept row depends on order
> >
> > If you keep the "first" duplicate without sorting deterministically, the survivor is only as stable as the incoming row order.
>
> ---
>
> **`dropna()` / `drop_nulls()`**
> - Row-removal operations that discard rows containing missing values, optionally limited to a subset of columns.
> - They matter because many filters and comparisons behave differently once null-bearing rows are removed or isolated.
>
> > [!warning] Row loss can be silent
> >
> > Dropping nulls can remove far more data than intended, especially in wide tables. Always specify the critical subset when only certain columns matter.
>
> ---
>
> **Semi-join filter**
> - A filter that keeps rows from one table only when their key exists in another table, without importing the other table's columns.
> - It matters because the note contrasts Pandas membership-style workarounds with Polars' native `how="semi"` join for table-driven filtering.
>
> > [!info] Useful for key membership
> >
> > Semi-joins are clearer than full joins when you only care whether a key exists, not about bringing reference columns into the result.
>
> ---
>
> **Sort / `sort_values()`**
> - Row-ordering operations that arrange a DataFrame by one or more columns in ascending or descending order.
> - They matter because many previews and top-N selections in the note only make sense after the data is explicitly ordered.
>
> > [!warning] Parameter names differ
> >
> > Pandas uses `ascending=`, while Polars uses `descending=`. The intent is the same, but the parameter names invert the phrasing.

---

```python
import pandas as pd
import polars as pl
import polars.selectors as cs
import numpy as np
from pathlib import Path
import io

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

Three datasets are used throughout: **eurostoxx50_ohlcv** (66K rows, daily OHLCV prices), **index_dim** (169 rows, stock metadata), and **scores_daily** (466 rows, composite scores with real nulls).

---

## Head / Tail / Sample / Glimpse

The first step in data exploration is previewing rows. Both libraries provide `.head()` and `.tail()`. Polars additionally offers `.glimpse()` for a transposed column-by-column preview of data types and sample values.

### Pandas | head() and tail()

```python
display(Markdown("**First 5 rows (head):**"))
display(ohlcv_pd.head())
```

#### First 5 rows (head)

<table>
<thead>
<tr>
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
</tr>
</tbody>
</table>

```python
display(Markdown("**Last 5 rows (tail):**"))
display(ohlcv_pd.tail())
```

#### Last 5 rows (tail)

<table>
<thead>
<tr>
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
<th>66350</th>
<td>64828</td>
<td>WKL.AS</td>
<td>2026-03-06</td>
<td>69.02</td>
<td>69.36</td>
<td>67.82</td>
<td>68.52</td>
<td>68.52</td>
<td>1143729</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>66351</th>
<td>66875</td>
<td>WKL.AS</td>
<td>2026-03-09</td>
<td>68.78</td>
<td>69.16</td>
<td>67.64</td>
<td>68.64</td>
<td>68.64</td>
<td>841503</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>66352</th>
<td>66876</td>
<td>WKL.AS</td>
<td>2026-03-10</td>
<td>68.80</td>
<td>69.16</td>
<td>66.34</td>
<td>67.16</td>
<td>67.16</td>
<td>1355645</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>66353</th>
<td>66877</td>
<td>WKL.AS</td>
<td>2026-03-11</td>
<td>67.50</td>
<td>69.60</td>
<td>67.02</td>
<td>67.22</td>
<td>67.22</td>
<td>1142531</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>66354</th>
<td>66929</td>
<td>WKL.AS</td>
<td>2026-03-12</td>
<td>67.00</td>
<td>67.54</td>
<td>66.28</td>
<td>67.32</td>
<td>67.32</td>
<td>210379</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

### Pandas | sample()

```python
display(Markdown("**Random sample of 5 rows:**"))
display(ohlcv_pd.sample(5, random_state=42))
```

#### Random sample of 5 rows

<table>
<thead>
<tr>
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
<th>43053</th>
<td>38920</td>
<td>MUV2.DE</td>
<td>2023-03-29</td>
<td>320.0000</td>
<td>322.600</td>
<td>318.400</td>
<td>322.4000</td>
<td>290.3200</td>
<td>195809</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>56209</th>
<td>5772</td>
<td>SAP.DE</td>
<td>2022-11-03</td>
<td>95.9200</td>
<td>96.340</td>
<td>95.080</td>
<td>95.5100</td>
<td>91.9052</td>
<td>1424973</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>53515</th>
<td>11015</td>
<td>SAN.MC</td>
<td>2022-09-15</td>
<td>2.5975</td>
<td>2.686</td>
<td>2.597</td>
<td>2.6765</td>
<td>2.3373</td>
<td>70158349</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>6498</th>
<td>28954</td>
<td>AI.PA</td>
<td>2025-08-12</td>
<td>173.3200</td>
<td>174.440</td>
<td>172.800</td>
<td>173.6800</td>
<td>173.6800</td>
<td>415652</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>63527</th>
<td>24956</td>
<td>UCG.MI</td>
<td>2025-07-07</td>
<td>56.4600</td>
<td>57.350</td>
<td>56.440</td>
<td>57.3500</td>
<td>56.0468</td>
<td>4705567</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

### Polars | head() and tail()

```python
display(Markdown("**First 5 rows (head):**"))
display(ohlcv_pl.head())
```

#### First 5 rows (head)

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
display(Markdown("**Last 5 rows (tail):**"))
display(ohlcv_pl.tail())
```

#### Last 5 rows (tail)

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>64828</td><td>WKL.AS</td><td>2026-03-06</td><td>69.02</td><td>69.36</td><td>67.82</td><td>68.52</td><td>68.52</td><td>1143729</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>66875</td><td>WKL.AS</td><td>2026-03-09</td><td>68.78</td><td>69.16</td><td>67.64</td><td>68.64</td><td>68.64</td><td>841503</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>66876</td><td>WKL.AS</td><td>2026-03-10</td><td>68.8</td><td>69.16</td><td>66.34</td><td>67.16</td><td>67.16</td><td>1355645</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>66877</td><td>WKL.AS</td><td>2026-03-11</td><td>67.5</td><td>69.6</td><td>67.02</td><td>67.22</td><td>67.22</td><td>1142531</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>66929</td><td>WKL.AS</td><td>2026-03-12</td><td>67.0</td><td>67.54</td><td>66.28</td><td>67.32</td><td>67.32</td><td>210379</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

### Polars | sample() and glimpse()

```python
display(Markdown("**Random sample of 5 rows:**"))
display(ohlcv_pl.sample(5, seed=42))
```

#### Random sample of 5 rows

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>11529</td><td>SAN.MC</td><td>2024-09-18</td><td>4.511</td><td>4.5455</td><td>4.5065</td><td>4.5085</td><td>4.2785</td><td>16487238</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>35604</td><td>CS.PA</td><td>2025-10-14</td><td>39.34</td><td>40.27</td><td>39.25</td><td>40.18</td><td>40.18</td><td>3511125</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>63666</td><td>WKL.AS</td><td>2022-01-05</td><td>102.2</td><td>102.65</td><td>101.25</td><td>101.8</td><td>95.254</td><td>230509</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>33136</td><td>PRX.AS</td><td>2021-05-03</td><td>41.3654</td><td>41.737</td><td>41.0718</td><td>41.3746</td><td>40.8581</td><td>2177525</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>19417</td><td>SAF.PA</td><td>2024-07-12</td><td>204.2</td><td>204.8</td><td>201.3</td><td>204.8</td><td>202.5157</td><td>496739</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
display(Markdown("**Glimpse (transposed summary):**"))
# Transpose the glimpse into a horizontal table
cols = []
for line in ohlcv_pl.glimpse(return_type="string").strip().split("\n"):
    parts = line.split()
    if len(parts) >= 3:
        name = parts[0]
        dtype = parts[1]
        preview = " ".join(parts[2:])
        cols.append({"Column": name, "Type": dtype, "Preview": preview})
display(ohlcv_pl.head())
```

#### Glimpse (transposed summary)

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

---

## Shape / Describe / Info

Shape, summary statistics, column types, and memory usage are the core metadata inspection operations. Pandas provides `.describe()`, `.info()`, and `.dtypes`. Polars provides `.describe()`, `.schema`, and `.dtypes`.

### Pandas | shape

```python
for name, df in [("ohlcv", ohlcv_pd), ("dim", dim_pd), ("scores", scores_pd)]:
    print(f"{name:>10s}: {df.shape[0]:>8,} rows x {df.shape[1]:>3} cols")
```

ohlcv:   66,355 rows x  12 cols
           dim:      169 rows x  26 cols
        scores:      466 rows x  36 cols

### Pandas | describe()

- **Describe**: Summary statistics: count, mean, std, min, max, quartiles.

```python
display(Markdown("**Numeric summary:**"))
display(ohlcv_pd.describe())
```

#### Numeric summary

<table>
<thead>
<tr>
<th></th>
<th>id</th>
<th>open</th>
<th>high</th>
<th>low</th>
<th>close</th>
<th>adj_close</th>
<th>volume</th>
<th>dividends</th>
<th>stock_splits</th>
</tr>
</thead>
<tbody>
<tr>
<th>count</th>
<td>66355.000000</td>
<td>66355.000000</td>
<td>66355.000000</td>
<td>66355.000000</td>
<td>66355.000000</td>
<td>66355.000000</td>
<td>6.635500e+04</td>
<td>66355.000000</td>
<td>66355.000000</td>
</tr>
<tr>
<th>mean</th>
<td>33179.733102</td>
<td>197.040520</td>
<td>199.364124</td>
<td>194.585782</td>
<td>197.034900</td>
<td>190.494909</td>
<td>5.942124e+06</td>
<td>0.011757</td>
<td>0.000172</td>
</tr>
<tr>
<th>std</th>
<td>19158.201385</td>
<td>363.150484</td>
<td>367.873829</td>
<td>358.011643</td>
<td>363.052047</td>
<td>359.635301</td>
<td>1.615619e+07</td>
<td>0.283142</td>
<td>0.022716</td>
</tr>
<tr>
<th>min</th>
<td>1.000000</td>
<td>1.601000</td>
<td>1.662800</td>
<td>1.584200</td>
<td>1.606600</td>
<td>1.201300</td>
<td>0.000000e+00</td>
<td>0.000000</td>
<td>0.000000</td>
</tr>
<tr>
<th>25%</th>
<td>16589.500000</td>
<td>29.789950</td>
<td>30.090000</td>
<td>29.470000</td>
<td>29.787450</td>
<td>28.143400</td>
<td>5.099855e+05</td>
<td>0.000000</td>
<td>0.000000</td>
</tr>
<tr>
<th>50%</th>
<td>33178.000000</td>
<td>70.700000</td>
<td>71.400000</td>
<td>69.890000</td>
<td>70.680000</td>
<td>63.141000</td>
<td>1.415896e+06</td>
<td>0.000000</td>
<td>0.000000</td>
</tr>
<tr>
<th>75%</th>
<td>49766.500000</td>
<td>185.990000</td>
<td>188.000000</td>
<td>184.000000</td>
<td>186.100000</td>
<td>175.253900</td>
<td>4.089299e+06</td>
<td>0.000000</td>
<td>0.000000</td>
</tr>
<tr>
<th>max</th>
<td>66930.000000</td>
<td>2926.000000</td>
<td>2957.000000</td>
<td>2813.000000</td>
<td>2839.000000</td>
<td>2802.938200</td>
<td>3.763915e+08</td>
<td>22.500000</td>
<td>5.000000</td>
</tr>
</tbody>
</table>

```python
display(Markdown("**Include all dtypes:**"))
display(ohlcv_pd.describe(include="all"))
```

#### Include all dtypes

<table>
<thead>
<tr>
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
<th>count</th>
<td>66355.000000</td>
<td>66355</td>
<td>66355</td>
<td>66355.000000</td>
<td>66355.000000</td>
<td>66355.000000</td>
<td>66355.000000</td>
<td>66355.000000</td>
<td>6.635500e+04</td>
<td>66355.000000</td>
<td>66355.000000</td>
<td>66355</td>
</tr>
<tr>
<th>unique</th>
<td>NaN</td>
<td>50</td>
<td>1331</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>2</td>
</tr>
<tr>
<th>top</th>
<td>NaN</td>
<td>ABI.BR</td>
<td>2026-03-12</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>False</td>
</tr>
<tr>
<th>freq</th>
<td>NaN</td>
<td>1331</td>
<td>50</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>66349</td>
</tr>
<tr>
<th>mean</th>
<td>33179.733102</td>
<td>NaN</td>
<td>NaN</td>
<td>197.040520</td>
<td>199.364124</td>
<td>194.585782</td>
<td>197.034900</td>
<td>190.494909</td>
<td>5.942124e+06</td>
<td>0.011757</td>
<td>0.000172</td>
<td>NaN</td>
</tr>
<tr>
<th>std</th>
<td>19158.201385</td>
<td>NaN</td>
<td>NaN</td>
<td>363.150484</td>
<td>367.873829</td>
<td>358.011643</td>
<td>363.052047</td>
<td>359.635301</td>
<td>1.615619e+07</td>
<td>0.283142</td>
<td>0.022716</td>
<td>NaN</td>
</tr>
<tr>
<th>min</th>
<td>1.000000</td>
<td>NaN</td>
<td>NaN</td>
<td>1.601000</td>
<td>1.662800</td>
<td>1.584200</td>
<td>1.606600</td>
<td>1.201300</td>
<td>0.000000e+00</td>
<td>0.000000</td>
<td>0.000000</td>
<td>NaN</td>
</tr>
<tr>
<th>25%</th>
<td>16589.500000</td>
<td>NaN</td>
<td>NaN</td>
<td>29.789950</td>
<td>30.090000</td>
<td>29.470000</td>
<td>29.787450</td>
<td>28.143400</td>
<td>5.099855e+05</td>
<td>0.000000</td>
<td>0.000000</td>
<td>NaN</td>
</tr>
<tr>
<th>50%</th>
<td>33178.000000</td>
<td>NaN</td>
<td>NaN</td>
<td>70.700000</td>
<td>71.400000</td>
<td>69.890000</td>
<td>70.680000</td>
<td>63.141000</td>
<td>1.415896e+06</td>
<td>0.000000</td>
<td>0.000000</td>
<td>NaN</td>
</tr>
<tr>
<th>75%</th>
<td>49766.500000</td>
<td>NaN</td>
<td>NaN</td>
<td>185.990000</td>
<td>188.000000</td>
<td>184.000000</td>
<td>186.100000</td>
<td>175.253900</td>
<td>4.089299e+06</td>
<td>0.000000</td>
<td>0.000000</td>
<td>NaN</td>
</tr>
<tr>
<th>max</th>
<td>66930.000000</td>
<td>NaN</td>
<td>NaN</td>
<td>2926.000000</td>
<td>2957.000000</td>
<td>2813.000000</td>
<td>2839.000000</td>
<td>2802.938200</td>
<td>3.763915e+08</td>
<td>22.500000</td>
<td>5.000000</td>
<td>NaN</td>
</tr>
</tbody>
</table>

### Pandas | info()

```python
# display hlcv_pd.info() as dataframe

info_df = pd.DataFrame({
    "Column": ohlcv_pd.columns,
    "Non-Null": [ohlcv_pd[c].notna().sum() for c in ohlcv_pd.columns],
    "Dtype": [ohlcv_pd[c].dtype for c in ohlcv_pd.columns],
})
display(info_df)
```

<table>
<thead>
<tr>
<th></th>
<th>Column</th>
<th>Non-Null</th>
<th>Dtype</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>id</td>
<td>66355</td>
<td>int64</td>
</tr>
<tr>
<th>1</th>
<td>symbol</td>
<td>66355</td>
<td>object</td>
</tr>
<tr>
<th>2</th>
<td>date</td>
<td>66355</td>
<td>object</td>
</tr>
<tr>
<th>3</th>
<td>open</td>
<td>66355</td>
<td>float64</td>
</tr>
<tr>
<th>4</th>
<td>high</td>
<td>66355</td>
<td>float64</td>
</tr>
<tr>
<th>5</th>
<td>low</td>
<td>66355</td>
<td>float64</td>
</tr>
<tr>
<th>6</th>
<td>close</td>
<td>66355</td>
<td>float64</td>
</tr>
<tr>
<th>7</th>
<td>adj_close</td>
<td>66355</td>
<td>float64</td>
</tr>
<tr>
<th>8</th>
<td>volume</td>
<td>66355</td>
<td>int64</td>
</tr>
<tr>
<th>9</th>
<td>dividends</td>
<td>66355</td>
<td>float64</td>
</tr>
<tr>
<th>10</th>
<td>stock_splits</td>
<td>66355</td>
<td>float64</td>
</tr>
<tr>
<th>11</th>
<td>is_filled</td>
<td>66355</td>
<td>bool</td>
</tr>
</tbody>
</table>

### Pandas | dtypes

```python
display(ohlcv_pd.dtypes)
```

<table>
<thead>
<tr>
<th></th>
<th>0</th>
</tr>
</thead>
<tbody>
<tr>
<th>id</th>
<td>int64</td>
</tr>
<tr>
<th>symbol</th>
<td>object</td>
</tr>
<tr>
<th>date</th>
<td>object</td>
</tr>
<tr>
<th>open</th>
<td>float64</td>
</tr>
<tr>
<th>high</th>
<td>float64</td>
</tr>
<tr>
<th>low</th>
<td>float64</td>
</tr>
<tr>
<th>close</th>
<td>float64</td>
</tr>
<tr>
<th>adj_close</th>
<td>float64</td>
</tr>
<tr>
<th>volume</th>
<td>int64</td>
</tr>
<tr>
<th>dividends</th>
<td>float64</td>
</tr>
<tr>
<th>stock_splits</th>
<td>float64</td>
</tr>
<tr>
<th>is_filled</th>
<td>bool</td>
</tr>
</tbody>
</table>

### Polars | shape

```python
for name, df in [("ohlcv", ohlcv_pl), ("dim", dim_pl), ("scores", scores_pl)]:
    print(f"{name:>10s}: {df.shape[0]:>8,} rows x {df.shape[1]:>3} cols")
```

ohlcv:   66,355 rows x  12 cols
           dim:      169 rows x  26 cols
        scores:      466 rows x  36 cols

### Polars | describe()

- **Describe**: Summary statistics: count, mean, std, min, max, quartiles.

```python
display(Markdown("**Polars describe (all columns):**"))
display(ohlcv_pl.describe())
```

#### Polars describe (all columns)

<div><!-- shape: (9, 13) --><table><thead><tr><th>statistic</th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>str</td><td>f64</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>count</td><td>66355.0</td><td>66355</td><td>66355</td><td>66355.0</td><td>66355.0</td><td>66355.0</td><td>66355.0</td><td>66355.0</td><td>66355.0</td><td>66355.0</td><td>66355.0</td><td>66355.0</td></tr><tr><td>null_count</td><td>0.0</td><td>0</td><td>0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td></tr><tr><td>mean</td><td>33179.733102</td><td>null</td><td>2023-08-05 00:56:42.354005</td><td>197.04052</td><td>199.364124</td><td>194.585782</td><td>197.0349</td><td>190.494909</td><td>5.9421e6</td><td>0.011757</td><td>0.000172</td><td>0.00009</td></tr><tr><td>std</td><td>19158.201385</td><td>null</td><td>null</td><td>363.150484</td><td>367.873829</td><td>358.011643</td><td>363.052047</td><td>359.635301</td><td>1.6156e7</td><td>0.283142</td><td>0.022716</td><td>null</td></tr><tr><td>min</td><td>1.0</td><td>ABI.BR</td><td>2021-01-04</td><td>1.601</td><td>1.6628</td><td>1.5842</td><td>1.6066</td><td>1.2013</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td></tr><tr><td>25%</td><td>16590.0</td><td>null</td><td>2022-04-20</td><td>29.79</td><td>30.09</td><td>29.47</td><td>29.7899</td><td>28.1461</td><td>509991.0</td><td>0.0</td><td>0.0</td><td>null</td></tr><tr><td>50%</td><td>33178.0</td><td>null</td><td>2023-08-03</td><td>70.7</td><td>71.4</td><td>69.89</td><td>70.68</td><td>63.141</td><td>1.415896e6</td><td>0.0</td><td>0.0</td><td>null</td></tr><tr><td>75%</td><td>49767.0</td><td>null</td><td>2024-11-19</td><td>186.0</td><td>188.0</td><td>184.0</td><td>186.1</td><td>175.2609</td><td>4.089463e6</td><td>0.0</td><td>0.0</td><td>null</td></tr><tr><td>max</td><td>66930.0</td><td>WKL.AS</td><td>2026-03-12</td><td>2926.0</td><td>2957.0</td><td>2813.0</td><td>2839.0</td><td>2802.9382</td><td>3.76391539e8</td><td>22.5</td><td>5.0</td><td>1.0</td></tr></tbody></table></div>

### Polars | schema and dtypes

```python
display(Markdown("**Schema dict:**"))
for col_name, dtype in ohlcv_pl.schema.items():
    print(f"  {col_name:<20s} {dtype}")
```

#### Schema dict

id                   Int64
      symbol               String
      date                 Date
      open                 Float64
      high                 Float64
      low                  Float64
      close                Float64
      adj_close            Float64
      volume               Int64
      dividends            Float64
      stock_splits         Float64
      is_filled            Boolean

```python
display(Markdown("**dtypes list:**"))
print(ohlcv_pl.dtypes)
```

#### dtypes list

[Int64, String, Date, Float64, Float64, Float64, Float64, Float64, Int64, Float64, Float64, Boolean]

---

## Value Counts / Unique / N-Unique

Understanding cardinality and frequency distribution of columns. Pandas uses `.value_counts()`, `.nunique()`, and `.unique()`. Polars uses `.value_counts()`, `.n_unique()`, and `.unique()`.

### Pandas | value_counts()

- **Value Counts**: Count occurrences of each unique value.

```python
display(Markdown("**Top 10 tickers by row count:**"))
display(ohlcv_pd["symbol"].value_counts().head(10))
```

#### Top 10 tickers by row count

<table>
<thead>
<tr>
<th></th>
<th>count</th>
</tr>
<tr>
<th>symbol</th>
<th></th>
</tr>
</thead>
<tbody>
<tr>
<th>ABI.BR</th>
<td>1331</td>
</tr>
<tr>
<th>AD.AS</th>
<td>1331</td>
</tr>
<tr>
<th>ADYEN.AS</th>
<td>1331</td>
</tr>
<tr>
<th>AI.PA</th>
<td>1331</td>
</tr>
<tr>
<th>AIR.PA</th>
<td>1331</td>
</tr>
<tr>
<th>ARGX.BR</th>
<td>1331</td>
</tr>
<tr>
<th>ASML.AS</th>
<td>1331</td>
</tr>
<tr>
<th>CS.PA</th>
<td>1331</td>
</tr>
<tr>
<th>DG.PA</th>
<td>1331</td>
</tr>
<tr>
<th>BN.PA</th>
<td>1331</td>
</tr>
</tbody>
</table>

### Pandas | nunique() and unique()

```python
display(Markdown("**Number of unique values per column:**"))
display(ohlcv_pd.nunique())
```

#### Number of unique values per column

<table>
<thead>
<tr>
<th></th>
<th>0</th>
</tr>
</thead>
<tbody>
<tr>
<th>id</th>
<td>66355</td>
</tr>
<tr>
<th>symbol</th>
<td>50</td>
</tr>
<tr>
<th>date</th>
<td>1331</td>
</tr>
<tr>
<th>open</th>
<td>29671</td>
</tr>
<tr>
<th>high</th>
<td>31651</td>
</tr>
<tr>
<th>low</th>
<td>31695</td>
</tr>
<tr>
<th>close</th>
<td>31505</td>
</tr>
<tr>
<th>adj_close</th>
<td>57739</td>
</tr>
<tr>
<th>volume</th>
<td>65199</td>
</tr>
<tr>
<th>dividends</th>
<td>216</td>
</tr>
<tr>
<th>stock_splits</th>
<td>6</td>
</tr>
<tr>
<th>is_filled</th>
<td>2</td>
</tr>
</tbody>
</table>

```python
display(Markdown("**Unique tickers (first 10):**"))
print(ohlcv_pd["symbol"].unique()[:10])
```

#### Unique tickers (first 10)

['ABI.BR' 'AD.AS' 'ADS.DE' 'ADYEN.AS' 'AI.PA' 'AIR.PA' 'ALV.DE' 'ARGX.BR'
     'ASML.AS' 'BAS.DE']

### Polars | value_counts()

- **Value Counts**: Count occurrences of each unique value.

```python
display(Markdown("**Top 10 tickers by row count:**"))
display(
    ohlcv_pl.get_column("symbol")
    .value_counts()
    .sort("count", descending=True)
    .head(10)
)
```

#### Top 10 tickers by row count

<div><!-- shape: (10, 2) --><table><thead><tr><th>symbol</th><th>count</th></tr><tr><td>str</td><td>u32</td></tr></thead><tbody><tr><td>SAN.PA</td><td>1331</td></tr><tr><td>ADYEN.AS</td><td>1331</td></tr><tr><td>PRX.AS</td><td>1331</td></tr><tr><td>ARGX.BR</td><td>1331</td></tr><tr><td>BN.PA</td><td>1331</td></tr><tr><td>DSY.PA</td><td>1331</td></tr><tr><td>BNP.PA</td><td>1331</td></tr><tr><td>TTE.PA</td><td>1331</td></tr><tr><td>ASML.AS</td><td>1331</td></tr><tr><td>CS.PA</td><td>1331</td></tr></tbody></table></div>

### Polars | n_unique() and unique()

- **N Unique**: Count the number of distinct values.

```python
display(Markdown("**n_unique per column:**"))
display(
    ohlcv_pl.select(pl.all().n_unique())
)
```

#### n_unique per column

<div><!-- shape: (1, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td></tr></thead><tbody><tr><td>66355</td><td>50</td><td>1331</td><td>29671</td><td>31651</td><td>31695</td><td>31505</td><td>57739</td><td>65199</td><td>216</td><td>6</td><td>2</td></tr></tbody></table></div>

```python
display(Markdown("**Unique tickers (first 10):**"))
print(ohlcv_pl.get_column("symbol").unique().sort().head(10).to_list())
```

#### Unique tickers (first 10)

['ABI.BR', 'AD.AS', 'ADS.DE', 'ADYEN.AS', 'AI.PA', 'AIR.PA', 'ALV.DE', 'ARGX.BR', 'ASML.AS', 'BAS.DE']

---

## Null / Missing Value Inspection

Null detection is critical for data quality. Pandas uses `NaN` (float) for missing values, so `.isna()` and `.isnull()` are equivalent. Polars uses native Arrow `null` — use `.is_null()` and `.null_count()`.

> [!info] Pandas vs Polars | Null representation
>
> Pandas `.isna()` detects both `NaN` and `None`. Polars `.is_null()` detects only Arrow null — `NaN` is a valid float value in Polars, not a null. Use `.is_nan()` to detect `NaN` specifically in Polars float columns.

### Pandas | isna() / isnull()

```python
display(Markdown("**Null counts per column:**"))
display(scores_pd.isnull().sum())
```

#### Null counts per column

<table>
<thead>
<tr>
<th></th>
<th>0</th>
</tr>
</thead>
<tbody>
<tr>
<th>id</th>
<td>0</td>
</tr>
<tr>
<th>_index</th>
<td>0</td>
</tr>
<tr>
<th>symbol</th>
<td>0</td>
</tr>
<tr>
<th>score_date</th>
<td>0</td>
</tr>
<tr>
<th>sector</th>
<td>0</td>
</tr>
<tr>
<th>pe_zscore</th>
<td>3</td>
</tr>
<tr>
<th>pb_zscore</th>
<td>6</td>
</tr>
<tr>
<th>ev_ebitda_zscore</th>
<td>71</td>
</tr>
<tr>
<th>yield_zscore</th>
<td>35</td>
</tr>
<tr>
<th>relative_value_score</th>
<td>0</td>
</tr>
<tr>
<th>relative_value_rank</th>
<td>0</td>
</tr>
<tr>
<th>relative_strength</th>
<td>0</td>
</tr>
<tr>
<th>sma_50_ratio</th>
<td>0</td>
</tr>
<tr>
<th>sma_200_ratio</th>
<td>0</td>
</tr>
<tr>
<th>dist_from_52w_high</th>
<td>0</td>
</tr>
<tr>
<th>momentum_score</th>
<td>0</td>
</tr>
<tr>
<th>momentum_rank</th>
<td>0</td>
</tr>
<tr>
<th>implied_upside</th>
<td>0</td>
</tr>
<tr>
<th>recommendation_mean</th>
<td>14</td>
</tr>
<tr>
<th>price_falling_analysts_bullish</th>
<td>0</td>
</tr>
<tr>
<th>sentiment_score</th>
<td>0</td>
</tr>
<tr>
<th>sentiment_rank</th>
<td>0</td>
</tr>
<tr>
<th>composite_score</th>
<td>0</td>
</tr>
<tr>
<th>composite_rank</th>
<td>0</td>
</tr>
<tr>
<th>_scored_at</th>
<td>0</td>
</tr>
<tr>
<th>sma_30_close</th>
<td>0</td>
</tr>
<tr>
<th>sma_90_close</th>
<td>0</td>
</tr>
<tr>
<th>market_cap</th>
<td>0</td>
</tr>
<tr>
<th>index_weight</th>
<td>0</td>
</tr>
<tr>
<th>short_name</th>
<td>0</td>
</tr>
<tr>
<th>country</th>
<td>0</td>
</tr>
<tr>
<th>current_price</th>
<td>0</td>
</tr>
<tr>
<th>day_change_pct</th>
<td>0</td>
</tr>
<tr>
<th>five_day_change_pct</th>
<td>0</td>
</tr>
<tr>
<th>ytd_change_pct</th>
<td>0</td>
</tr>
<tr>
<th>currency</th>
<td>0</td>
</tr>
</tbody>
</table>

```python
display(Markdown("**Null percentage per column:**"))
null_pct = (scores_pd.isnull().sum() / len(scores_pd) * 100).round(2)
display(null_pct[null_pct > 0])
```

#### Null percentage per column

<table>
<thead>
<tr>
<th></th>
<th>0</th>
</tr>
</thead>
<tbody>
<tr>
<th>pe_zscore</th>
<td>0.64</td>
</tr>
<tr>
<th>pb_zscore</th>
<td>1.29</td>
</tr>
<tr>
<th>ev_ebitda_zscore</th>
<td>15.24</td>
</tr>
<tr>
<th>yield_zscore</th>
<td>7.51</td>
</tr>
<tr>
<th>recommendation_mean</th>
<td>3.00</td>
</tr>
</tbody>
</table>

### Pandas | rows with any null

```python
rows_with_nulls = scores_pd[scores_pd.isnull().any(axis=1)]
print(f"Rows with at least one null: {len(rows_with_nulls):,}")
if len(rows_with_nulls) > 0:
    display(rows_with_nulls.head())
```

Rows with at least one null: 120

<table>
<thead>
<tr>
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
<th>5</th>
<td>196</td>
<td>euro_stoxx_50</td>
<td>VOW.DE</td>
<td>2026-03-04</td>
<td>Consumer Cyclical</td>
<td>1.166221</td>
<td>0.940273</td>
<td>0.37983</td>
<td>1.528891</td>
<td>1.003804</td>
<td>2</td>
<td>-0.292748</td>
<td>0.929392</td>
<td>0.969628</td>
<td>0.180805</td>
<td>-0.411969</td>
<td>37</td>
<td>0.297071</td>
<td>NaN</td>
<td>False</td>
<td>0.555357</td>
<td>12</td>
<td>0.382397</td>
<td>6</td>
<td>2026-03-04 22:40:25.489180</td>
<td>102.286667</td>
<td>101.225556</td>
<td>47923826688</td>
<td>0.009381</td>
<td>VOLKSWAGEN AG</td>
<td>Germany</td>
<td>95.600</td>
<td>0.013786</td>
<td>-0.048756</td>
<td>-0.090390</td>
<td>EUR</td>
</tr>
<tr>
<th>8</th>
<td>188</td>
<td>euro_stoxx_50</td>
<td>SAN.MC</td>
<td>2026-03-04</td>
<td>Financial Services</td>
<td>0.458599</td>
<td>0.499398</td>
<td>NaN</td>
<td>-1.107590</td>
<td>-0.049864</td>
<td>33</td>
<td>0.393197</td>
<td>0.953824</td>
<td>1.139519</td>
<td>0.113499</td>
<td>0.519307</td>
<td>14</td>
<td>0.224704</td>
<td>1.70000</td>
<td>False</td>
<td>0.448776</td>
<td>15</td>
<td>0.306073</td>
<td>9</td>
<td>2026-03-04 22:40:25.489180</td>
<td>10.604900</td>
<td>9.919500</td>
<td>145955749888</td>
<td>0.028570</td>
<td>BANCO SANTANDER S.A.</td>
<td>Spain</td>
<td>9.982</td>
<td>0.038818</td>
<td>-0.105876</td>
<td>-0.008739</td>
<td>EUR</td>
</tr>
<tr>
<th>15</th>
<td>176</td>
<td>euro_stoxx_50</td>
<td>ISP.MI</td>
<td>2026-03-04</td>
<td>Financial Services</td>
<td>0.366619</td>
<td>0.488302</td>
<td>NaN</td>
<td>0.723361</td>
<td>0.526094</td>
<td>13</td>
<td>-0.065247</td>
<td>0.922492</td>
<td>0.990855</td>
<td>0.119662</td>
<td>-0.122626</td>
<td>33</td>
<td>0.254150</td>
<td>2.00000</td>
<td>False</td>
<td>0.146959</td>
<td>21</td>
<td>0.183476</td>
<td>16</td>
<td>2026-03-04 22:40:25.489180</td>
<td>5.834933</td>
<td>5.769367</td>
<td>94268317696</td>
<td>0.018452</td>
<td>INTESA SANPAOLO</td>
<td>Italy</td>
<td>5.422</td>
<td>0.018216</td>
<td>-0.067103</td>
<td>-0.084276</td>
<td>EUR</td>
</tr>
<tr>
<th>16</th>
<td>195</td>
<td>euro_stoxx_50</td>
<td>UCG.MI</td>
<td>2026-03-04</td>
<td>Financial Services</td>
<td>0.452501</td>
<td>0.355225</td>
<td>NaN</td>
<td>-0.260674</td>
<td>0.182351</td>
<td>26</td>
<td>0.085867</td>
<td>0.950889</td>
<td>1.054430</td>
<td>0.137862</td>
<td>0.123670</td>
<td>22</td>
<td>0.261521</td>
<td>1.94444</td>
<td>False</td>
<td>0.240819</td>
<td>18</td>
<td>0.182280</td>
<td>17</td>
<td>2026-03-04 22:40:25.489180</td>
<td>73.253333</td>
<td>68.983556</td>
<td>103066501120</td>
<td>0.020174</td>
<td>UNICREDIT</td>
<td>Italy</td>
<td>68.790</td>
<td>0.027483</td>
<td>-0.072161</td>
<td>-0.030034</td>
<td>EUR</td>
</tr>
</tbody>
</table>

### Polars | is_null() / null_count()

- **Null Count**: Count missing values per column.

```python
display(Markdown("**Null counts per column (Polars):**"))
display(scores_pl.null_count())
```

#### Null counts per column (Polars)

<div><!-- shape: (1, 36) --><table><thead><tr><th>id</th><th>_index</th><th>symbol</th><th>score_date</th><th>sector</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>relative_value_rank</th><th>relative_strength</th><th>sma_50_ratio</th><th>sma_200_ratio</th><th>dist_from_52w_high</th><th>momentum_score</th><th>momentum_rank</th><th>implied_upside</th><th>recommendation_mean</th><th>price_falling_analysts_bullish</th><th>sentiment_score</th><th>sentiment_rank</th><th>composite_score</th><th>composite_rank</th><th>_scored_at</th><th>sma_30_close</th><th>sma_90_close</th><th>market_cap</th><th>index_weight</th><th>short_name</th><th>country</th><th>current_price</th><th>day_change_pct</th><th>five_day_change_pct</th><th>ytd_change_pct</th><th>currency</th></tr><tr><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td></tr></thead><tbody><tr><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>3</td><td>6</td><td>71</td><td>35</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>14</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr></tbody></table></div>

```python
display(Markdown("**Null percentage per column (Polars):**"))
display(
    scores_pl.select(
        (pl.all().null_count() / pl.len() * 100).round(2).name.suffix("_null_pct")
    )
)
```

#### Null percentage per column (Polars)

<div><!-- shape: (1, 36) --><table><thead><tr><th>id_null_pct</th><th>_index_null_pct</th><th>symbol_null_pct</th><th>score_date_null_pct</th><th>sector_null_pct</th><th>pe_zscore_null_pct</th><th>pb_zscore_null_pct</th><th>ev_ebitda_zscore_null_pct</th><th>yield_zscore_null_pct</th><th>relative_value_score_null_pct</th><th>relative_value_rank_null_pct</th><th>relative_strength_null_pct</th><th>sma_50_ratio_null_pct</th><th>sma_200_ratio_null_pct</th><th>dist_from_52w_high_null_pct</th><th>momentum_score_null_pct</th><th>momentum_rank_null_pct</th><th>implied_upside_null_pct</th><th>recommendation_mean_null_pct</th><th>price_falling_analysts_bullish_null_pct</th><th>sentiment_score_null_pct</th><th>sentiment_rank_null_pct</th><th>composite_score_null_pct</th><th>composite_rank_null_pct</th><th>_scored_at_null_pct</th><th>sma_30_close_null_pct</th><th>sma_90_close_null_pct</th><th>market_cap_null_pct</th><th>index_weight_null_pct</th><th>short_name_null_pct</th><th>country_null_pct</th><th>current_price_null_pct</th><th>day_change_pct_null_pct</th><th>five_day_change_pct_null_pct</th><th>ytd_change_pct_null_pct</th><th>currency_null_pct</th></tr><tr><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.64</td><td>1.29</td><td>15.24</td><td>7.51</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>3.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td></tr></tbody></table></div>

### Polars | rows with any null

```python
mask = pl.any_horizontal(pl.all().is_null())
rows_with_nulls_pl = scores_pl.filter(mask)
print(f"Rows with at least one null: {rows_with_nulls_pl.shape[0]:,}")
if rows_with_nulls_pl.shape[0] > 0:
    display(rows_with_nulls_pl.head())
```

Rows with at least one null: 120

<div><!-- shape: (5, 36) --><table><thead><tr><th>id</th><th>_index</th><th>symbol</th><th>score_date</th><th>sector</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>relative_value_rank</th><th>relative_strength</th><th>sma_50_ratio</th><th>sma_200_ratio</th><th>dist_from_52w_high</th><th>momentum_score</th><th>momentum_rank</th><th>implied_upside</th><th>recommendation_mean</th><th>price_falling_analysts_bullish</th><th>sentiment_score</th><th>sentiment_rank</th><th>composite_score</th><th>composite_rank</th><th>_scored_at</th><th>sma_30_close</th><th>sma_90_close</th><th>market_cap</th><th>index_weight</th><th>short_name</th><th>country</th><th>current_price</th><th>day_change_pct</th><th>five_day_change_pct</th><th>ytd_change_pct</th><th>currency</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>date</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td><td>f64</td><td>i64</td><td>f64</td><td>i64</td><td>datetime[ns]</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>163</td><td>euro_stoxx_50</td><td>BNP.PA</td><td>2026-03-04</td><td>Financial Services</td><td>0.913389</td><td>1.26114</td><td>null</td><td>2.388962</td><td>1.521163</td><td>1</td><td>0.016123</td><td>1.00909</td><td>1.130264</td><td>0.082486</td><td>0.477966</td><td>16</td><td>0.153157</td><td>1.84211</td><td>false</td><td>0.052711</td><td>25</td><td>0.683947</td><td>1</td><td>2026-03-04 22:40:25.489180</td><td>92.085</td><td>81.181889</td><td>99751215104</td><td>0.019525</td><td>BNP PARIBAS ACT.A</td><td>France</td><td>89.32</td><td>0.011437</td><td>-0.073156</td><td>0.105582</td><td>EUR</td></tr><tr><td>196</td><td>euro_stoxx_50</td><td>VOW.DE</td><td>2026-03-04</td><td>Consumer Cyclical</td><td>1.166221</td><td>0.940273</td><td>0.37983</td><td>1.528891</td><td>1.003804</td><td>2</td><td>-0.292748</td><td>0.929392</td><td>0.969628</td><td>0.180805</td><td>-0.411969</td><td>37</td><td>0.297071</td><td>null</td><td>false</td><td>0.555357</td><td>12</td><td>0.382397</td><td>6</td><td>2026-03-04 22:40:25.489180</td><td>102.286667</td><td>101.225556</td><td>47923826688</td><td>0.009381</td><td>VOLKSWAGEN AG</td><td>Germany</td><td>95.6</td><td>0.013786</td><td>-0.048756</td><td>-0.09039</td><td>EUR</td></tr><tr><td>188</td><td>euro_stoxx_50</td><td>SAN.MC</td><td>2026-03-04</td><td>Financial Services</td><td>0.458599</td><td>0.499398</td><td>null</td><td>-1.10759</td><td>-0.049864</td><td>33</td><td>0.393197</td><td>0.953824</td><td>1.139519</td><td>0.113499</td><td>0.519307</td><td>14</td><td>0.224704</td><td>1.7</td><td>false</td><td>0.448776</td><td>15</td><td>0.306073</td><td>9</td><td>2026-03-04 22:40:25.489180</td><td>10.6049</td><td>9.9195</td><td>145955749888</td><td>0.02857</td><td>BANCO SANTANDER S.A.</td><td>Spain</td><td>9.982</td><td>0.038818</td><td>-0.105876</td><td>-0.008739</td><td>EUR</td></tr><tr><td>176</td><td>euro_stoxx_50</td><td>ISP.MI</td><td>2026-03-04</td><td>Financial Services</td><td>0.366619</td><td>0.488302</td><td>null</td><td>0.723361</td><td>0.526094</td><td>13</td><td>-0.065247</td><td>0.922492</td><td>0.990855</td><td>0.119662</td><td>-0.122626</td><td>33</td><td>0.25415</td><td>2.0</td><td>false</td><td>0.146959</td><td>21</td><td>0.183476</td><td>16</td><td>2026-03-04 22:40:25.489180</td><td>5.834933</td><td>5.769367</td><td>94268317696</td><td>0.018452</td><td>INTESA SANPAOLO</td><td>Italy</td><td>5.422</td><td>0.018216</td><td>-0.067103</td><td>-0.084276</td><td>EUR</td></tr><tr><td>195</td><td>euro_stoxx_50</td><td>UCG.MI</td><td>2026-03-04</td><td>Financial Services</td><td>0.452501</td><td>0.355225</td><td>null</td><td>-0.260674</td><td>0.182351</td><td>26</td><td>0.085867</td><td>0.950889</td><td>1.05443</td><td>0.137862</td><td>0.12367</td><td>22</td><td>0.261521</td><td>1.94444</td><td>false</td><td>0.240819</td><td>18</td><td>0.18228</td><td>17</td><td>2026-03-04 22:40:25.489180</td><td>73.253333</td><td>68.983556</td><td>103066501120</td><td>0.020174</td><td>UNICREDIT</td><td>Italy</td><td>68.79</td><td>0.027483</td><td>-0.072161</td><td>-0.030034</td><td>EUR</td></tr></tbody></table></div>

---

## Exploring the Scores Dataset

The `scores_daily` dataset contains composite factor scores with real null values in several columns — ideal for practicing null inspection and data quality assessment.

### Pandas | quick profile

```python
display(Markdown("**scores_daily — head:**"))
display(scores_pd.head())
```

#### scores_daily — head

<table>
<thead>
<tr>
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
</tr>
</tbody>
</table>

```python
display(Markdown("**scores_daily — describe:**"))
display(scores_pd.describe(include="all"))
```

#### scores_daily — describe

<table>
<thead>
<tr>
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
<th>count</th>
<td>466.000000</td>
<td>466</td>
<td>466</td>
<td>466</td>
<td>466</td>
<td>463.000000</td>
<td>460.000000</td>
<td>395.000000</td>
<td>431.000000</td>
<td>466.000000</td>
<td>466.000000</td>
<td>466.000000</td>
<td>466.000000</td>
<td>466.000000</td>
<td>466.000000</td>
<td>466.000000</td>
<td>466.000000</td>
<td>466.000000</td>
<td>452.000000</td>
<td>466</td>
<td>466.000000</td>
<td>466.000000</td>
<td>466.000000</td>
<td>466.000000</td>
<td>466</td>
<td>466.000000</td>
<td>466.000000</td>
<td>4.660000e+02</td>
<td>466.000000</td>
<td>466</td>
<td>466</td>
<td>466.000000</td>
<td>466.000000</td>
<td>466.000000</td>
<td>466.000000</td>
<td>466</td>
</tr>
<tr>
<th>unique</th>
<td>NaN</td>
<td>4</td>
<td>167</td>
<td>3</td>
<td>10</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>2</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>167</td>
<td>16</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>6</td>
</tr>
<tr>
<th>top</th>
<td>NaN</td>
<td>stoxx_asia_50</td>
<td>CVX</td>
<td>2026-03-12</td>
<td>Financial Services</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>False</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>Chevron Corporation</td>
<td>United States</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>USD</td>
</tr>
<tr>
<th>freq</th>
<td>NaN</td>
<td>150</td>
<td>4</td>
<td>169</td>
<td>96</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>401</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>4</td>
<td>159</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>167</td>
</tr>
<tr>
<th>mean</th>
<td>2083.712446</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>0.011386</td>
<td>0.024513</td>
<td>0.038046</td>
<td>0.051915</td>
<td>0.036204</td>
<td>24.733906</td>
<td>0.047972</td>
<td>0.991152</td>
<td>1.064981</td>
<td>0.154695</td>
<td>-0.000157</td>
<td>24.768240</td>
<td>0.175049</td>
<td>2.011047</td>
<td>NaN</td>
<td>-0.004157</td>
<td>24.793991</td>
<td>0.010630</td>
<td>24.774678</td>
<td>2026-03-08 09:35:56.501645824</td>
<td>2726.980722</td>
<td>2568.225890</td>
<td>3.030703e+12</td>
<td>0.021271</td>
<td>NaN</td>
<td>NaN</td>
<td>2721.358232</td>
<td>-0.001651</td>
<td>-0.024835</td>
<td>0.028935</td>
<td>NaN</td>
</tr>
<tr>
<th>min</th>
<td>149.000000</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>-3.244355</td>
<td>-3.609853</td>
<td>-3.562197</td>
<td>-1.765215</td>
<td>-3.069151</td>
<td>1.000000</td>
<td>-0.758111</td>
<td>0.764715</td>
<td>0.630163</td>
<td>0.000686</td>
<td>-2.270682</td>
<td>1.000000</td>
<td>-0.287205</td>
<td>1.224490</td>
<td>NaN</td>
<td>-3.028190</td>
<td>1.000000</td>
<td>-1.265925</td>
<td>1.000000</td>
<td>2026-03-04 22:40:25.489180</td>
<td>4.967667</td>
<td>4.912000</td>
<td>1.516982e+10</td>
<td>0.000102</td>
<td>NaN</td>
<td>NaN</td>
<td>5.120000</td>
<td>-0.071643</td>
<td>-0.147762</td>
<td>-0.326764</td>
<td>NaN</td>
</tr>
<tr>
<th>25%</th>
<td>266.250000</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>-0.544030</td>
<td>-0.360416</td>
<td>-0.292057</td>
<td>-0.680445</td>
<td>-0.327241</td>
<td>12.000000</td>
<td>-0.207124</td>
<td>0.928823</td>
<td>0.946901</td>
<td>0.073301</td>
<td>-0.442542</td>
<td>12.000000</td>
<td>0.070549</td>
<td>1.666670</td>
<td>NaN</td>
<td>-0.632834</td>
<td>12.000000</td>
<td>-0.175500</td>
<td>12.000000</td>
<td>2026-03-04 22:40:25.489179904</td>
<td>71.671500</td>
<td>72.912944</td>
<td>9.705579e+10</td>
<td>0.007191</td>
<td>NaN</td>
<td>NaN</td>
<td>69.900000</td>
<td>-0.013312</td>
<td>-0.054816</td>
<td>-0.083552</td>
<td>NaN</td>
</tr>
<tr>
<th>50%</th>
<td>2387.500000</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>0.294467</td>
<td>0.328987</td>
<td>0.309876</td>
<td>0.051261</td>
<td>0.178100</td>
<td>24.000000</td>
<td>-0.027879</td>
<td>0.984705</td>
<td>1.058055</td>
<td>0.124107</td>
<td>0.029804</td>
<td>24.000000</td>
<td>0.152967</td>
<td>1.944440</td>
<td>NaN</td>
<td>0.023661</td>
<td>24.000000</td>
<td>0.031939</td>
<td>24.000000</td>
<td>2026-03-07 03:00:57.486865920</td>
<td>206.003000</td>
<td>202.193333</td>
<td>2.577942e+11</td>
<td>0.012848</td>
<td>NaN</td>
<td>NaN</td>
<td>203.470000</td>
<td>-0.002397</td>
<td>-0.023506</td>
<td>0.019151</td>
<td>NaN</td>
</tr>
<tr>
<th>75%</th>
<td>3410.750000</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>0.643742</td>
<td>0.617103</td>
<td>0.622976</td>
<td>0.718698</td>
<td>0.523516</td>
<td>37.000000</td>
<td>0.197873</td>
<td>1.046022</td>
<td>1.177306</td>
<td>0.200560</td>
<td>0.488433</td>
<td>37.000000</td>
<td>0.273151</td>
<td>2.280000</td>
<td>NaN</td>
<td>0.527927</td>
<td>37.000000</td>
<td>0.243820</td>
<td>37.000000</td>
<td>2026-03-12 12:52:26.509884928</td>
<td>856.826917</td>
<td>837.629000</td>
<td>1.628276e+12</td>
<td>0.027448</td>
<td>NaN</td>
<td>NaN</td>
<td>799.057500</td>
<td>0.009959</td>
<td>0.002131</td>
<td>0.129549</td>
<td>NaN</td>
</tr>
<tr>
<th>max</th>
<td>3527.000000</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>1.666177</td>
<td>2.019105</td>
<td>1.697527</td>
<td>2.919889</td>
<td>1.521163</td>
<td>50.000000</td>
<td>3.342994</td>
<td>1.233011</td>
<td>1.905060</td>
<td>0.589001</td>
<td>2.806741</td>
<td>50.000000</td>
<td>0.804817</td>
<td>4.785710</td>
<td>NaN</td>
<td>2.169723</td>
<td>50.000000</td>
<td>1.287144</td>
<td>50.000000</td>
<td>2026-03-12 12:52:26.509885</td>
<td>68837.666667</td>
<td>60523.222222</td>
<td>4.587752e+13</td>
<td>0.245721</td>
<td>NaN</td>
<td>NaN</td>
<td>69950.000000</td>
<td>0.091834</td>
<td>0.192987</td>
<td>0.466977</td>
<td>NaN</td>
</tr>
<tr>
<th>std</th>
<td>1340.387660</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>NaN</td>
<td>0.894679</td>
<td>0.922349</td>
<td>0.875291</td>
<td>0.914714</td>
<td>0.723838</td>
<td>14.457279</td>
<td>0.462482</td>
<td>0.081733</td>
<td>0.182469</td>
<td>0.117997</td>
<td>0.817166</td>
<td>14.472144</td>
<td>0.172802</td>
<td>0.512925</td>
<td>NaN</td>
<td>0.886008</td>
<td>14.458262</td>
<td>0.336210</td>
<td>14.470685</td>
<td>NaN</td>
<td>9736.666450</td>
<td>8945.961901</td>
<td>6.558209e+12</td>
<td>0.024398</td>
<td>NaN</td>
<td>NaN</td>
<td>9820.254826</td>
<td>0.022118</td>
<td>0.046550</td>
<td>0.151246</td>
<td>NaN</td>
</tr>
</tbody>
</table>

```python
display(Markdown("**scores_daily — null counts:**"))
display(scores_pd.isnull().sum())
```

#### scores_daily — null counts

<table>
<thead>
<tr>
<th></th>
<th>0</th>
</tr>
</thead>
<tbody>
<tr>
<th>id</th>
<td>0</td>
</tr>
<tr>
<th>_index</th>
<td>0</td>
</tr>
<tr>
<th>symbol</th>
<td>0</td>
</tr>
<tr>
<th>score_date</th>
<td>0</td>
</tr>
<tr>
<th>sector</th>
<td>0</td>
</tr>
<tr>
<th>pe_zscore</th>
<td>3</td>
</tr>
<tr>
<th>pb_zscore</th>
<td>6</td>
</tr>
<tr>
<th>ev_ebitda_zscore</th>
<td>71</td>
</tr>
<tr>
<th>yield_zscore</th>
<td>35</td>
</tr>
<tr>
<th>relative_value_score</th>
<td>0</td>
</tr>
<tr>
<th>relative_value_rank</th>
<td>0</td>
</tr>
<tr>
<th>relative_strength</th>
<td>0</td>
</tr>
<tr>
<th>sma_50_ratio</th>
<td>0</td>
</tr>
<tr>
<th>sma_200_ratio</th>
<td>0</td>
</tr>
<tr>
<th>dist_from_52w_high</th>
<td>0</td>
</tr>
<tr>
<th>momentum_score</th>
<td>0</td>
</tr>
<tr>
<th>momentum_rank</th>
<td>0</td>
</tr>
<tr>
<th>implied_upside</th>
<td>0</td>
</tr>
<tr>
<th>recommendation_mean</th>
<td>14</td>
</tr>
<tr>
<th>price_falling_analysts_bullish</th>
<td>0</td>
</tr>
<tr>
<th>sentiment_score</th>
<td>0</td>
</tr>
<tr>
<th>sentiment_rank</th>
<td>0</td>
</tr>
<tr>
<th>composite_score</th>
<td>0</td>
</tr>
<tr>
<th>composite_rank</th>
<td>0</td>
</tr>
<tr>
<th>_scored_at</th>
<td>0</td>
</tr>
<tr>
<th>sma_30_close</th>
<td>0</td>
</tr>
<tr>
<th>sma_90_close</th>
<td>0</td>
</tr>
<tr>
<th>market_cap</th>
<td>0</td>
</tr>
<tr>
<th>index_weight</th>
<td>0</td>
</tr>
<tr>
<th>short_name</th>
<td>0</td>
</tr>
<tr>
<th>country</th>
<td>0</td>
</tr>
<tr>
<th>current_price</th>
<td>0</td>
</tr>
<tr>
<th>day_change_pct</th>
<td>0</td>
</tr>
<tr>
<th>five_day_change_pct</th>
<td>0</td>
</tr>
<tr>
<th>ytd_change_pct</th>
<td>0</td>
</tr>
<tr>
<th>currency</th>
<td>0</td>
</tr>
</tbody>
</table>

### Polars | quick profile

```python
display(Markdown("**scores_daily — head (Polars):**"))
display(scores_pl.head())
```

#### scores_daily — head (Polars)

<div><!-- shape: (5, 36) --><table><thead><tr><th>id</th><th>_index</th><th>symbol</th><th>score_date</th><th>sector</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>relative_value_rank</th><th>relative_strength</th><th>sma_50_ratio</th><th>sma_200_ratio</th><th>dist_from_52w_high</th><th>momentum_score</th><th>momentum_rank</th><th>implied_upside</th><th>recommendation_mean</th><th>price_falling_analysts_bullish</th><th>sentiment_score</th><th>sentiment_rank</th><th>composite_score</th><th>composite_rank</th><th>_scored_at</th><th>sma_30_close</th><th>sma_90_close</th><th>market_cap</th><th>index_weight</th><th>short_name</th><th>country</th><th>current_price</th><th>day_change_pct</th><th>five_day_change_pct</th><th>ytd_change_pct</th><th>currency</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>date</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td><td>f64</td><td>i64</td><td>f64</td><td>i64</td><td>datetime[ns]</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>163</td><td>euro_stoxx_50</td><td>BNP.PA</td><td>2026-03-04</td><td>Financial Services</td><td>0.913389</td><td>1.26114</td><td>null</td><td>2.388962</td><td>1.521163</td><td>1</td><td>0.016123</td><td>1.00909</td><td>1.130264</td><td>0.082486</td><td>0.477966</td><td>16</td><td>0.153157</td><td>1.84211</td><td>false</td><td>0.052711</td><td>25</td><td>0.683947</td><td>1</td><td>2026-03-04 22:40:25.489180</td><td>92.085</td><td>81.181889</td><td>99751215104</td><td>0.019525</td><td>BNP PARIBAS ACT.A</td><td>France</td><td>89.32</td><td>0.011437</td><td>-0.073156</td><td>0.105582</td><td>EUR</td></tr><tr><td>168</td><td>euro_stoxx_50</td><td>DTE.DE</td><td>2026-03-04</td><td>Communication Services</td><td>0.326587</td><td>0.387463</td><td>0.379532</td><td>-0.127867</td><td>0.241429</td><td>24</td><td>-0.205598</td><td>1.12065</td><td>1.112416</td><td>0.055524</td><td>0.685752</td><td>8</td><td>0.121212</td><td>1.33333</td><td>false</td><td>0.617835</td><td>10</td><td>0.515005</td><td>2</td><td>2026-03-04 22:40:25.489180</td><td>30.838</td><td>28.554556</td><td>164294311936</td><td>0.032159</td><td>DEUTSCHE TELEKOM AG</td><td>Germany</td><td>33.0</td><td>0.011649</td><td>-0.019608</td><td>0.193059</td><td>EUR</td></tr><tr><td>174</td><td>euro_stoxx_50</td><td>IFX.DE</td><td>2026-03-04</td><td>Technology</td><td>0.509398</td><td>0.637215</td><td>0.677068</td><td>-0.696662</td><td>0.281755</td><td>22</td><td>0.000965</td><td>1.048244</td><td>1.198626</td><td>0.088845</td><td>0.675764</td><td>9</td><td>0.126408</td><td>1.375</td><td>false</td><td>0.579187</td><td>11</td><td>0.512235</td><td>3</td><td>2026-03-04 22:40:25.489180</td><td>43.480333</td><td>38.855556</td><td>57222533120</td><td>0.011201</td><td>INFINEON TECHNOLOGIES AG</td><td>Germany</td><td>43.945</td><td>0.054343</td><td>-0.06649</td><td>0.164723</td><td>EUR</td></tr><tr><td>172</td><td>euro_stoxx_50</td><td>ENR.DE</td><td>2026-03-04</td><td>Industrials</td><td>-0.902738</td><td>-0.743338</td><td>-1.693212</td><td>-1.326075</td><td>-1.166341</td><td>46</td><td>1.645455</td><td>1.137007</td><td>1.474095</td><td>0.05185</td><td>2.541889</td><td>1</td><td>0.075269</td><td>1.8</td><td>false</td><td>-0.123264</td><td>29</td><td>0.417428</td><td>4</td><td>2026-03-04 22:40:25.489180</td><td>155.675</td><td>129.122</td><td>139207262208</td><td>0.027249</td><td>Siemens Energy AG</td><td>Germany</td><td>162.75</td><td>0.047297</td><td>-0.039256</td><td>0.351744</td><td>EUR</td></tr><tr><td>149</td><td>euro_stoxx_50</td><td>ABI.BR</td><td>2026-03-04</td><td>Consumer Defensive</td><td>0.474084</td><td>0.844075</td><td>0.552739</td><td>-0.975005</td><td>0.223973</td><td>25</td><td>-0.029791</td><td>1.058542</td><td>1.142783</td><td>0.063063</td><td>0.651891</td><td>10</td><td>0.186198</td><td>1.69231</td><td>false</td><td>0.344755</td><td>17</td><td>0.406873</td><td>5</td><td>2026-03-04 22:40:25.489180</td><td>64.342</td><td>57.869333</td><td>125566156800</td><td>0.024579</td><td>AB INBEV</td><td>Belgium</td><td>64.48</td><td>-0.017073</td><td>-0.040762</td><td>0.174499</td><td>EUR</td></tr></tbody></table></div>

```python
display(Markdown("**scores_daily — describe (Polars):**"))
display(scores_pl.describe())
```

#### scores_daily — describe (Polars)

<div><!-- shape: (9, 37) --><table><thead><tr><th>statistic</th><th>id</th><th>_index</th><th>symbol</th><th>score_date</th><th>sector</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>relative_value_rank</th><th>relative_strength</th><th>sma_50_ratio</th><th>sma_200_ratio</th><th>dist_from_52w_high</th><th>momentum_score</th><th>momentum_rank</th><th>implied_upside</th><th>recommendation_mean</th><th>price_falling_analysts_bullish</th><th>sentiment_score</th><th>sentiment_rank</th><th>composite_score</th><th>composite_rank</th><th>_scored_at</th><th>sma_30_close</th><th>sma_90_close</th><th>market_cap</th><th>index_weight</th><th>short_name</th><th>country</th><th>current_price</th><th>day_change_pct</th><th>five_day_change_pct</th><th>ytd_change_pct</th><th>currency</th></tr><tr><td>str</td><td>f64</td><td>str</td><td>str</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>count</td><td>466.0</td><td>466</td><td>466</td><td>466</td><td>466</td><td>463.0</td><td>460.0</td><td>395.0</td><td>431.0</td><td>466.0</td><td>466.0</td><td>466.0</td><td>466.0</td><td>466.0</td><td>466.0</td><td>466.0</td><td>466.0</td><td>466.0</td><td>452.0</td><td>466.0</td><td>466.0</td><td>466.0</td><td>466.0</td><td>466.0</td><td>466</td><td>466.0</td><td>466.0</td><td>466.0</td><td>466.0</td><td>466</td><td>466</td><td>466.0</td><td>466.0</td><td>466.0</td><td>466.0</td><td>466</td></tr><tr><td>null_count</td><td>0.0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>3.0</td><td>6.0</td><td>71.0</td><td>35.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>14.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0</td><td>0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0.0</td><td>0</td></tr><tr><td>mean</td><td>2083.712446</td><td>null</td><td>null</td><td>2026-03-07 20:48:24.721030</td><td>null</td><td>0.011386</td><td>0.024513</td><td>0.038046</td><td>0.051915</td><td>0.036204</td><td>24.733906</td><td>0.047972</td><td>0.991152</td><td>1.064981</td><td>0.154695</td><td>-0.000157</td><td>24.76824</td><td>0.175049</td><td>2.011047</td><td>0.139485</td><td>-0.004157</td><td>24.793991</td><td>0.01063</td><td>24.774678</td><td>2026-03-08 09:35:56.501646</td><td>2726.980722</td><td>2568.22589</td><td>3.0307e12</td><td>0.021271</td><td>null</td><td>null</td><td>2721.358232</td><td>-0.001651</td><td>-0.024835</td><td>0.028935</td><td>null</td></tr><tr><td>std</td><td>1340.38766</td><td>null</td><td>null</td><td>null</td><td>null</td><td>0.894679</td><td>0.922349</td><td>0.875291</td><td>0.914714</td><td>0.723838</td><td>14.457279</td><td>0.462482</td><td>0.081733</td><td>0.182469</td><td>0.117997</td><td>0.817166</td><td>14.472144</td><td>0.172802</td><td>0.512925</td><td>null</td><td>0.886008</td><td>14.458262</td><td>0.33621</td><td>14.470685</td><td>null</td><td>9736.66645</td><td>8945.961901</td><td>6.5582e12</td><td>0.024398</td><td>null</td><td>null</td><td>9820.254826</td><td>0.022118</td><td>0.04655</td><td>0.151246</td><td>null</td></tr><tr><td>min</td><td>149.0</td><td>euro_stoxx_50</td><td>0388.HK</td><td>2026-03-04</td><td>Basic Materials</td><td>-3.244355</td><td>-3.609853</td><td>-3.562197</td><td>-1.765215</td><td>-3.069151</td><td>1.0</td><td>-0.758111</td><td>0.764715</td><td>0.630163</td><td>0.000686</td><td>-2.270682</td><td>1.0</td><td>-0.287205</td><td>1.22449</td><td>0.0</td><td>-3.02819</td><td>1.0</td><td>-1.265925</td><td>1.0</td><td>2026-03-04 22:40:25.489180</td><td>4.967667</td><td>4.912</td><td>1.5170e10</td><td>0.000102</td><td>AB INBEV</td><td>Australia</td><td>5.12</td><td>-0.071643</td><td>-0.147762</td><td>-0.326764</td><td>AUD</td></tr><tr><td>25%</td><td>266.0</td><td>null</td><td>null</td><td>2026-03-04</td><td>null</td><td>-0.542352</td><td>-0.358338</td><td>-0.285053</td><td>-0.678854</td><td>-0.327398</td><td>12.0</td><td>-0.207295</td><td>0.928634</td><td>0.94669</td><td>0.073233</td><td>-0.443075</td><td>12.0</td><td>0.070336</td><td>1.66667</td><td>null</td><td>-0.635563</td><td>12.0</td><td>-0.176007</td><td>12.0</td><td>2026-03-04 22:40:25.489179</td><td>71.527</td><td>72.844222</td><td>9.7039e10</td><td>0.00719</td><td>null</td><td>null</td><td>69.8</td><td>-0.013336</td><td>-0.054849</td><td>-0.083791</td><td>null</td></tr><tr><td>50%</td><td>2388.0</td><td>null</td><td>null</td><td>2026-03-07</td><td>null</td><td>0.294467</td><td>0.32996</td><td>0.309876</td><td>0.051261</td><td>0.179359</td><td>24.0</td><td>-0.025968</td><td>0.984787</td><td>1.058079</td><td>0.124181</td><td>0.031184</td><td>24.0</td><td>0.153157</td><td>1.94444</td><td>null</td><td>0.024154</td><td>24.0</td><td>0.032344</td><td>24.0</td><td>2026-03-07 03:00:57.486865</td><td>207.221667</td><td>204.365333</td><td>2.5787e11</td><td>0.013111</td><td>null</td><td>null</td><td>204.83</td><td>-0.002381</td><td>-0.023153</td><td>0.019395</td><td>null</td></tr><tr><td>75%</td><td>3411.0</td><td>null</td><td>null</td><td>2026-03-12</td><td>null</td><td>0.645507</td><td>0.616745</td><td>0.625587</td><td>0.723361</td><td>0.526094</td><td>37.0</td><td>0.199916</td><td>1.046095</td><td>1.17734</td><td>0.200735</td><td>0.489412</td><td>37.0</td><td>0.273617</td><td>2.28</td><td>null</td><td>0.528756</td><td>37.0</td><td>0.24484</td><td>37.0</td><td>2026-03-12 12:52:26.509884</td><td>900.273667</td><td>874.914222</td><td>1.6312e12</td><td>0.027458</td><td>null</td><td>null</td><td>821.42</td><td>0.009963</td><td>0.002179</td><td>0.12961</td><td>null</td></tr><tr><td>max</td><td>3527.0</td><td>stoxx_usa_50</td><td>XOM</td><td>2026-03-12</td><td>Utilities</td><td>1.666177</td><td>2.019105</td><td>1.697527</td><td>2.919889</td><td>1.521163</td><td>50.0</td><td>3.342994</td><td>1.233011</td><td>1.90506</td><td>0.589001</td><td>2.806741</td><td>50.0</td><td>0.804817</td><td>4.78571</td><td>1.0</td><td>2.169723</td><td>50.0</td><td>1.287144</td><td>50.0</td><td>2026-03-12 12:52:26.509885</td><td>68837.666667</td><td>60523.222222</td><td>4.5878e13</td><td>0.245721</td><td>adidas AG</td><td>United States</td><td>69950.0</td><td>0.091834</td><td>0.192987</td><td>0.466977</td><td>USD</td></tr></tbody></table></div>

```python
display(Markdown("**scores_daily — null counts (Polars):**"))
display(scores_pl.null_count())
```

#### scores_daily — null counts (Polars)

<div><!-- shape: (1, 36) --><table><thead><tr><th>id</th><th>_index</th><th>symbol</th><th>score_date</th><th>sector</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>relative_value_rank</th><th>relative_strength</th><th>sma_50_ratio</th><th>sma_200_ratio</th><th>dist_from_52w_high</th><th>momentum_score</th><th>momentum_rank</th><th>implied_upside</th><th>recommendation_mean</th><th>price_falling_analysts_bullish</th><th>sentiment_score</th><th>sentiment_rank</th><th>composite_score</th><th>composite_rank</th><th>_scored_at</th><th>sma_30_close</th><th>sma_90_close</th><th>market_cap</th><th>index_weight</th><th>short_name</th><th>country</th><th>current_price</th><th>day_change_pct</th><th>five_day_change_pct</th><th>ytd_change_pct</th><th>currency</th></tr><tr><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td><td>u32</td></tr></thead><tbody><tr><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>3</td><td>6</td><td>71</td><td>35</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>14</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr></tbody></table></div>

---

## Exploring the Dimension Table

### Head Preview

```python
display(Markdown("**index_dim — Pandas:**"))
display(dim_pd.drop(columns="long_business_summary").head())
```

#### index_dim — Pandas

<table>
<thead>
<tr>
<th></th>
<th>id</th>
<th>_index</th>
<th>symbol</th>
<th>long_name</th>
<th>short_name</th>
<th>sector</th>
<th>sector_key</th>
<th>industry</th>
<th>industry_key</th>
<th>country</th>
<th>city</th>
<th>website</th>
<th>exchange</th>
<th>full_exchange_name</th>
<th>exchange_timezone_name</th>
<th>exchange_timezone_short</th>
<th>currency</th>
<th>financial_currency</th>
<th>quote_type</th>
<th>market</th>
<th>range_start</th>
<th>price_data_start</th>
<th>valid_from</th>
<th>valid_to</th>
<th>is_current</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>1</td>
<td>euro_stoxx_50</td>
<td>ASML.AS</td>
<td>ASML Holding N.V.</td>
<td>ASML HOLDING</td>
<td>Technology</td>
<td>technology</td>
<td>Semiconductor Equipment &amp; Materials</td>
<td>semiconductor-equipment-materials</td>
<td>Netherlands</td>
<td>Veldhoven</td>
<td>https://www.asml.com</td>
<td>AMS</td>
<td>Amsterdam</td>
<td>Europe/Amsterdam</td>
<td>CET</td>
<td>EUR</td>
<td>EUR</td>
<td>EQUITY</td>
<td>nl_market</td>
<td>1998-07-20</td>
<td>2021-01-01</td>
<td>2026-03-04 22:11:36.189862</td>
<td>None</td>
<td>True</td>
</tr>
<tr>
<th>1</th>
<td>2</td>
<td>euro_stoxx_50</td>
<td>MC.PA</td>
<td>LVMH Moët Hennessy - Louis Vuitton, Société Européenne</td>
<td>LVMH</td>
<td>Consumer Cyclical</td>
<td>consumer-cyclical</td>
<td>Luxury Goods</td>
<td>luxury-goods</td>
<td>France</td>
<td>Paris</td>
<td>https://www.lvmh.com</td>
<td>PAR</td>
<td>Paris</td>
<td>Europe/Paris</td>
<td>CET</td>
<td>EUR</td>
<td>EUR</td>
<td>EQUITY</td>
<td>fr_market</td>
<td>2000-01-03</td>
<td>2021-01-01</td>
<td>2026-03-04 22:11:36.189862</td>
<td>None</td>
<td>True</td>
</tr>
<tr>
<th>2</th>
<td>3</td>
<td>euro_stoxx_50</td>
<td>RMS.PA</td>
<td>Hermès International Société en commandite par actions</td>
<td>HERMES INTL</td>
<td>Consumer Cyclical</td>
<td>consumer-cyclical</td>
<td>Luxury Goods</td>
<td>luxury-goods</td>
<td>France</td>
<td>Paris</td>
<td>https://finance.hermes.com</td>
<td>PAR</td>
<td>Paris</td>
<td>Europe/Paris</td>
<td>CET</td>
<td>EUR</td>
<td>EUR</td>
<td>EQUITY</td>
<td>fr_market</td>
<td>2000-01-03</td>
<td>2021-01-01</td>
<td>2026-03-04 22:11:36.193940</td>
<td>None</td>
<td>True</td>
</tr>
<tr>
<th>3</th>
<td>4</td>
<td>euro_stoxx_50</td>
<td>OR.PA</td>
<td>L'Oréal S.A.</td>
<td>L'OREAL</td>
<td>Consumer Defensive</td>
<td>consumer-defensive</td>
<td>Household &amp; Personal Products</td>
<td>household-personal-products</td>
<td>France</td>
<td>Clichy</td>
<td>https://www.loreal.com</td>
<td>PAR</td>
<td>Paris</td>
<td>Europe/Paris</td>
<td>CET</td>
<td>EUR</td>
<td>EUR</td>
<td>EQUITY</td>
<td>fr_market</td>
<td>2000-01-03</td>
<td>2021-01-01</td>
<td>2026-03-04 22:11:36.193940</td>
<td>None</td>
<td>True</td>
</tr>
<tr>
<th>4</th>
<td>5</td>
<td>euro_stoxx_50</td>
<td>SAP.DE</td>
<td>SAP SE</td>
<td>SAP SE</td>
<td>Technology</td>
<td>technology</td>
<td>Software - Application</td>
<td>software-application</td>
<td>Germany</td>
<td>Walldorf</td>
<td>https://www.sap.com</td>
<td>GER</td>
<td>XETRA</td>
<td>Europe/Berlin</td>
<td>CET</td>
<td>EUR</td>
<td>EUR</td>
<td>EQUITY</td>
<td>de_market</td>
<td>1998-04-09</td>
<td>2021-01-01</td>
<td>2026-03-04 22:11:36.193940</td>
<td>None</td>
<td>True</td>
</tr>
</tbody>
</table>

```python
display(Markdown("**index_dim — Polars:**"))
display(dim_pl.head())
```

#### index_dim — Polars

<div><!-- shape: (5, 26) --><table><thead><tr><th>id</th><th>_index</th><th>symbol</th><th>long_name</th><th>short_name</th><th>sector</th><th>sector_key</th><th>industry</th><th>industry_key</th><th>country</th><th>city</th><th>website</th><th>long_business_summary</th><th>exchange</th><th>full_exchange_name</th><th>exchange_timezone_name</th><th>exchange_timezone_short</th><th>currency</th><th>financial_currency</th><th>quote_type</th><th>market</th><th>range_start</th><th>price_data_start</th><th>valid_from</th><th>valid_to</th><th>is_current</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>date</td><td>date</td><td>datetime[ns]</td><td>null</td><td>bool</td></tr></thead><tbody><tr><td>1</td><td>euro_stoxx_50</td><td>ASML.AS</td><td>ASML Holding N.V.</td><td>ASML HOLDING</td><td>Technology</td><td>technology</td><td>Semiconductor Equipment &amp; Mate…</td><td>semiconductor-equipment-materi…</td><td>Netherlands</td><td>Veldhoven</td><td>https://www.asml.com</td><td>ASML Holding N.V. provides lit…</td><td>AMS</td><td>Amsterdam</td><td>Europe/Amsterdam</td><td>CET</td><td>EUR</td><td>EUR</td><td>EQUITY</td><td>nl_market</td><td>1998-07-20</td><td>2021-01-01</td><td>2026-03-04 22:11:36.189862</td><td>null</td><td>true</td></tr><tr><td>2</td><td>euro_stoxx_50</td><td>MC.PA</td><td>LVMH Moët Hennessy - Louis Vui…</td><td>LVMH</td><td>Consumer Cyclical</td><td>consumer-cyclical</td><td>Luxury Goods</td><td>luxury-goods</td><td>France</td><td>Paris</td><td>https://www.lvmh.com</td><td>LVMH Moët Hennessy - Louis Vui…</td><td>PAR</td><td>Paris</td><td>Europe/Paris</td><td>CET</td><td>EUR</td><td>EUR</td><td>EQUITY</td><td>fr_market</td><td>2000-01-03</td><td>2021-01-01</td><td>2026-03-04 22:11:36.189862</td><td>null</td><td>true</td></tr><tr><td>3</td><td>euro_stoxx_50</td><td>RMS.PA</td><td>Hermès International Société e…</td><td>HERMES INTL</td><td>Consumer Cyclical</td><td>consumer-cyclical</td><td>Luxury Goods</td><td>luxury-goods</td><td>France</td><td>Paris</td><td>https://finance.hermes.com</td><td>Hermès International Société e…</td><td>PAR</td><td>Paris</td><td>Europe/Paris</td><td>CET</td><td>EUR</td><td>EUR</td><td>EQUITY</td><td>fr_market</td><td>2000-01-03</td><td>2021-01-01</td><td>2026-03-04 22:11:36.193940</td><td>null</td><td>true</td></tr><tr><td>4</td><td>euro_stoxx_50</td><td>OR.PA</td><td>L&#x27;Oréal S.A.</td><td>L&#x27;OREAL</td><td>Consumer Defensive</td><td>consumer-defensive</td><td>Household &amp; Personal Products</td><td>household-personal-products</td><td>France</td><td>Clichy</td><td>https://www.loreal.com</td><td>L&#x27;Oréal S.A., through its subs…</td><td>PAR</td><td>Paris</td><td>Europe/Paris</td><td>CET</td><td>EUR</td><td>EUR</td><td>EQUITY</td><td>fr_market</td><td>2000-01-03</td><td>2021-01-01</td><td>2026-03-04 22:11:36.193940</td><td>null</td><td>true</td></tr><tr><td>5</td><td>euro_stoxx_50</td><td>SAP.DE</td><td>SAP SE</td><td>SAP SE</td><td>Technology</td><td>technology</td><td>Software - Application</td><td>software-application</td><td>Germany</td><td>Walldorf</td><td>https://www.sap.com</td><td>SAP SE, together with its subs…</td><td>GER</td><td>XETRA</td><td>Europe/Berlin</td><td>CET</td><td>EUR</td><td>EUR</td><td>EQUITY</td><td>de_market</td><td>1998-04-09</td><td>2021-01-01</td><td>2026-03-04 22:11:36.193940</td><td>null</td><td>true</td></tr></tbody></table></div>

### Types and Schema

```python
display(Markdown("**index_dim — dtypes (Pandas):**"))
display(dim_pd.dtypes)
```

#### index_dim — dtypes (Pandas)

<table>
<thead>
<tr>
<th></th>
<th>0</th>
</tr>
</thead>
<tbody>
<tr>
<th>id</th>
<td>int64</td>
</tr>
<tr>
<th>_index</th>
<td>object</td>
</tr>
<tr>
<th>symbol</th>
<td>object</td>
</tr>
<tr>
<th>long_name</th>
<td>object</td>
</tr>
<tr>
<th>short_name</th>
<td>object</td>
</tr>
<tr>
<th>sector</th>
<td>object</td>
</tr>
<tr>
<th>sector_key</th>
<td>object</td>
</tr>
<tr>
<th>industry</th>
<td>object</td>
</tr>
<tr>
<th>industry_key</th>
<td>object</td>
</tr>
<tr>
<th>country</th>
<td>object</td>
</tr>
<tr>
<th>city</th>
<td>object</td>
</tr>
<tr>
<th>website</th>
<td>object</td>
</tr>
<tr>
<th>long_business_summary</th>
<td>object</td>
</tr>
<tr>
<th>exchange</th>
<td>object</td>
</tr>
<tr>
<th>full_exchange_name</th>
<td>object</td>
</tr>
<tr>
<th>exchange_timezone_name</th>
<td>object</td>
</tr>
<tr>
<th>exchange_timezone_short</th>
<td>object</td>
</tr>
<tr>
<th>currency</th>
<td>object</td>
</tr>
<tr>
<th>financial_currency</th>
<td>object</td>
</tr>
<tr>
<th>quote_type</th>
<td>object</td>
</tr>
<tr>
<th>market</th>
<td>object</td>
</tr>
<tr>
<th>range_start</th>
<td>object</td>
</tr>
<tr>
<th>price_data_start</th>
<td>object</td>
</tr>
<tr>
<th>valid_from</th>
<td>datetime64[ns]</td>
</tr>
<tr>
<th>valid_to</th>
<td>object</td>
</tr>
<tr>
<th>is_current</th>
<td>bool</td>
</tr>
</tbody>
</table>

```python
display(Markdown("**index_dim — schema (Polars):**"))
for col_name, dtype in dim_pl.schema.items():
    print(f"  {col_name:<25s} {dtype}")
```

#### index_dim — schema (Polars)

id                        Int64
      _index                    String
      symbol                    String
      long_name                 String
      short_name                String
      sector                    String
      sector_key                String
      industry                  String
      industry_key              String
      country                   String
      city                      String
      website                   String
      long_business_summary     String
      exchange                  String
      full_exchange_name        String
      exchange_timezone_name    String
      exchange_timezone_short   String
      currency                  String
      financial_currency        String
      quote_type                String
      market                    String
      range_start               Date
      price_data_start          Date
      valid_from                Datetime(time_unit='ns', time_zone=None)
      valid_to                  Null
      is_current                Boolean

---

## Data Profiling Strategies

Reusable profiling functions that combine shape, types, null counts, and basic stats into a single summary. Build these once and apply to any dataset.

A reusable profiling pattern: for each column report dtype, null count, unique count, and a few sample values.

### Pandas | quick profiler

- **Drop Nulls**: Remove rows with missing values (Pandas).
- **N Unique**: Count the number of distinct values.

```python
def profile_pd(df: pd.DataFrame) -> pd.DataFrame:
    """Return a one-row-per-column profiling DataFrame (Pandas)."""
    records = []
    for col in df.columns:
        records.append({
            "column":     col,
            "dtype":      str(df[col].dtype),
            "null_count": int(df[col].isnull().sum()),
            "null_pct":   round(df[col].isnull().mean() * 100, 2),
            "n_unique":   int(df[col].nunique()),
            "sample":     str(df[col].dropna().iloc[:3].tolist()),
        })
    return pd.DataFrame(records)

display(Markdown("**OHLCV profile (Pandas):**"))
display(profile_pd(ohlcv_pd))
```

#### OHLCV profile (Pandas)

<table>
<thead>
<tr>
<th></th>
<th>column</th>
<th>dtype</th>
<th>null_count</th>
<th>null_pct</th>
<th>n_unique</th>
<th>sample</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>id</td>
<td>int64</td>
<td>0</td>
<td>0.0</td>
<td>66355</td>
<td>[21160, 21161, 21162]</td>
</tr>
<tr>
<th>1</th>
<td>symbol</td>
<td>object</td>
<td>0</td>
<td>0.0</td>
<td>50</td>
<td>['ABI.BR', 'ABI.BR', 'ABI.BR']</td>
</tr>
<tr>
<th>2</th>
<td>date</td>
<td>datetime64[ns]</td>
<td>0</td>
<td>0.0</td>
<td>1331</td>
<td>[Timestamp('2021-01-04 00:00:00'), Timestamp('2021-01-05 00:00:00'), Timestamp('2021-01-06 00:00:00')]</td>
</tr>
<tr>
<th>3</th>
<td>open</td>
<td>float64</td>
<td>0</td>
<td>0.0</td>
<td>29671</td>
<td>[58.15, 56.9, 57.96]</td>
</tr>
<tr>
<th>4</th>
<td>high</td>
<td>float64</td>
<td>0</td>
<td>0.0</td>
<td>31651</td>
<td>[58.85, 57.98, 58.94]</td>
</tr>
<tr>
<th>5</th>
<td>low</td>
<td>float64</td>
<td>0</td>
<td>0.0</td>
<td>31695</td>
<td>[56.78, 56.75, 57.39]</td>
</tr>
<tr>
<th>6</th>
<td>close</td>
<td>float64</td>
<td>0</td>
<td>0.0</td>
<td>31505</td>
<td>[57.21, 57.18, 58.77]</td>
</tr>
<tr>
<th>7</th>
<td>adj_close</td>
<td>float64</td>
<td>0</td>
<td>0.0</td>
<td>57739</td>
<td>[53.5761, 53.548, 55.037]</td>
</tr>
<tr>
<th>8</th>
<td>volume</td>
<td>int64</td>
<td>0</td>
<td>0.0</td>
<td>65199</td>
<td>[1513937, 1382722, 1370204]</td>
</tr>
<tr>
<th>9</th>
<td>dividends</td>
<td>float64</td>
<td>0</td>
<td>0.0</td>
<td>216</td>
<td>[0.0, 0.0, 0.0]</td>
</tr>
<tr>
<th>10</th>
<td>stock_splits</td>
<td>float64</td>
<td>0</td>
<td>0.0</td>
<td>6</td>
<td>[0.0, 0.0, 0.0]</td>
</tr>
<tr>
<th>11</th>
<td>is_filled</td>
<td>bool</td>
<td>0</td>
<td>0.0</td>
<td>2</td>
<td>[False, False, False]</td>
</tr>
</tbody>
</table>

### Polars | quick profiler

- **Null Count**: Count missing values per column.
- **Drop Nulls**: Remove rows with missing values (Polars).
- **N Unique**: Count the number of distinct values.

```python
def profile_pl(df: pl.DataFrame) -> pl.DataFrame:
    """Return a one-row-per-column profiling DataFrame (Polars)."""
    rows = []
    for col_name in df.columns:
        col = df.get_column(col_name)
        rows.append({
            "column":     col_name,
            "dtype":      str(col.dtype),
            "null_count": col.null_count(),
            "null_pct":   round(col.null_count() / df.height * 100, 2),
            "n_unique":   col.n_unique(),
            "sample":     str(col.drop_nulls().head(3).to_list()),
        })
    return pl.DataFrame(rows)

display(Markdown("**OHLCV profile (Polars):**"))
display(profile_pl(ohlcv_pl))
```

#### OHLCV profile (Polars)

<div><!-- shape: (12, 6) --><table><thead><tr><th>column</th><th>dtype</th><th>null_count</th><th>null_pct</th><th>n_unique</th><th>sample</th></tr><tr><td>str</td><td>str</td><td>i64</td><td>f64</td><td>i64</td><td>str</td></tr></thead><tbody><tr><td>id</td><td>Int64</td><td>0</td><td>0.0</td><td>66355</td><td>[21160, 21161, 21162]</td></tr><tr><td>symbol</td><td>String</td><td>0</td><td>0.0</td><td>50</td><td>[&#x27;ABI.BR&#x27;, &#x27;ABI.BR&#x27;, &#x27;ABI.BR&#x27;]</td></tr><tr><td>date</td><td>Date</td><td>0</td><td>0.0</td><td>1331</td><td>[datetime.date(2021, 1, 4), da…</td></tr><tr><td>open</td><td>Float64</td><td>0</td><td>0.0</td><td>29671</td><td>[58.15, 56.9, 57.96]</td></tr><tr><td>high</td><td>Float64</td><td>0</td><td>0.0</td><td>31651</td><td>[58.85, 57.98, 58.94]</td></tr><tr><td>low</td><td>Float64</td><td>0</td><td>0.0</td><td>31695</td><td>[56.78, 56.75, 57.39]</td></tr><tr><td>close</td><td>Float64</td><td>0</td><td>0.0</td><td>31505</td><td>[57.21, 57.18, 58.77]</td></tr><tr><td>adj_close</td><td>Float64</td><td>0</td><td>0.0</td><td>57739</td><td>[53.5761, 53.548, 55.037]</td></tr><tr><td>volume</td><td>Int64</td><td>0</td><td>0.0</td><td>65199</td><td>[1513937, 1382722, 1370204]</td></tr><tr><td>dividends</td><td>Float64</td><td>0</td><td>0.0</td><td>216</td><td>[0.0, 0.0, 0.0]</td></tr><tr><td>stock_splits</td><td>Float64</td><td>0</td><td>0.0</td><td>6</td><td>[0.0, 0.0, 0.0]</td></tr><tr><td>is_filled</td><td>Boolean</td><td>0</td><td>0.0</td><td>2</td><td>[False, False, False]</td></tr></tbody></table></div>

### Profile all three datasets

#### Profile eurostoxx50_ohlcv — Pandas vs Polars describe comparison

```python
prof_pd = profile_pd(ohlcv_pd)
display(Markdown("*Pandas profile:*"))
display(prof_pd)
```

*Pandas profile:*

<table>
<thead>
<tr>
<th></th>
<th>column</th>
<th>dtype</th>
<th>null_count</th>
<th>null_pct</th>
<th>n_unique</th>
<th>sample</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>id</td>
<td>int64</td>
<td>0</td>
<td>0.0</td>
<td>66355</td>
<td>[21160, 21161, 21162]</td>
</tr>
<tr>
<th>1</th>
<td>symbol</td>
<td>object</td>
<td>0</td>
<td>0.0</td>
<td>50</td>
<td>['ABI.BR', 'ABI.BR', 'ABI.BR']</td>
</tr>
<tr>
<th>2</th>
<td>date</td>
<td>object</td>
<td>0</td>
<td>0.0</td>
<td>1331</td>
<td>[datetime.date(2021, 1, 4), datetime.date(2021, 1, 5), datetime.date(2021, 1, 6)]</td>
</tr>
<tr>
<th>3</th>
<td>open</td>
<td>float64</td>
<td>0</td>
<td>0.0</td>
<td>29671</td>
<td>[58.15, 56.9, 57.96]</td>
</tr>
<tr>
<th>4</th>
<td>high</td>
<td>float64</td>
<td>0</td>
<td>0.0</td>
<td>31651</td>
<td>[58.85, 57.98, 58.94]</td>
</tr>
<tr>
<th>5</th>
<td>low</td>
<td>float64</td>
<td>0</td>
<td>0.0</td>
<td>31695</td>
<td>[56.78, 56.75, 57.39]</td>
</tr>
<tr>
<th>6</th>
<td>close</td>
<td>float64</td>
<td>0</td>
<td>0.0</td>
<td>31505</td>
<td>[57.21, 57.18, 58.77]</td>
</tr>
<tr>
<th>7</th>
<td>adj_close</td>
<td>float64</td>
<td>0</td>
<td>0.0</td>
<td>57739</td>
<td>[53.5761, 53.548, 55.037]</td>
</tr>
<tr>
<th>8</th>
<td>volume</td>
<td>int64</td>
<td>0</td>
<td>0.0</td>
<td>65199</td>
<td>[1513937, 1382722, 1370204]</td>
</tr>
<tr>
<th>9</th>
<td>dividends</td>
<td>float64</td>
<td>0</td>
<td>0.0</td>
<td>216</td>
<td>[0.0, 0.0, 0.0]</td>
</tr>
<tr>
<th>10</th>
<td>stock_splits</td>
<td>float64</td>
<td>0</td>
<td>0.0</td>
<td>6</td>
<td>[0.0, 0.0, 0.0]</td>
</tr>
<tr>
<th>11</th>
<td>is_filled</td>
<td>bool</td>
<td>0</td>
<td>0.0</td>
<td>2</td>
<td>[False, False, False]</td>
</tr>
</tbody>
</table>

```python
prof_pl = profile_pl(ohlcv_pl)
display(Markdown("*Polars profile:*"))
display(prof_pl)
```

*Polars profile:*

<div><!-- shape: (12, 6) --><table><thead><tr><th>column</th><th>dtype</th><th>null_count</th><th>null_pct</th><th>n_unique</th><th>sample</th></tr><tr><td>str</td><td>str</td><td>i64</td><td>f64</td><td>i64</td><td>str</td></tr></thead><tbody><tr><td>id</td><td>Int64</td><td>0</td><td>0.0</td><td>66355</td><td>[21160, 21161, 21162]</td></tr><tr><td>symbol</td><td>String</td><td>0</td><td>0.0</td><td>50</td><td>[&#x27;ABI.BR&#x27;, &#x27;ABI.BR&#x27;, &#x27;ABI.BR&#x27;]</td></tr><tr><td>date</td><td>Date</td><td>0</td><td>0.0</td><td>1331</td><td>[datetime.date(2021, 1, 4), da…</td></tr><tr><td>open</td><td>Float64</td><td>0</td><td>0.0</td><td>29671</td><td>[58.15, 56.9, 57.96]</td></tr><tr><td>high</td><td>Float64</td><td>0</td><td>0.0</td><td>31651</td><td>[58.85, 57.98, 58.94]</td></tr><tr><td>low</td><td>Float64</td><td>0</td><td>0.0</td><td>31695</td><td>[56.78, 56.75, 57.39]</td></tr><tr><td>close</td><td>Float64</td><td>0</td><td>0.0</td><td>31505</td><td>[57.21, 57.18, 58.77]</td></tr><tr><td>adj_close</td><td>Float64</td><td>0</td><td>0.0</td><td>57739</td><td>[53.5761, 53.548, 55.037]</td></tr><tr><td>volume</td><td>Int64</td><td>0</td><td>0.0</td><td>65199</td><td>[1513937, 1382722, 1370204]</td></tr><tr><td>dividends</td><td>Float64</td><td>0</td><td>0.0</td><td>216</td><td>[0.0, 0.0, 0.0]</td></tr><tr><td>stock_splits</td><td>Float64</td><td>0</td><td>0.0</td><td>6</td><td>[0.0, 0.0, 0.0]</td></tr><tr><td>is_filled</td><td>Boolean</td><td>0</td><td>0.0</td><td>2</td><td>[False, False, False]</td></tr></tbody></table></div>

#### Profile index_dim — Pandas vs Polars describe comparison

```python
prof_pd = profile_pd(dim_pd)
prof_pd = prof_pd[prof_pd["column"] != "long_business_summary"]
display(Markdown("*Pandas profile:*"))
display(prof_pd.head())
```

*Pandas profile:*

<table>
<thead>
<tr>
<th></th>
<th>column</th>
<th>dtype</th>
<th>null_count</th>
<th>null_pct</th>
<th>n_unique</th>
<th>sample</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>id</td>
<td>int64</td>
<td>0</td>
<td>0.0</td>
<td>169</td>
<td>[1, 2, 3]</td>
</tr>
<tr>
<th>1</th>
<td>_index</td>
<td>object</td>
<td>0</td>
<td>0.0</td>
<td>4</td>
<td>['euro_stoxx_50', 'euro_stoxx_50', 'euro_stoxx_50']</td>
</tr>
<tr>
<th>2</th>
<td>symbol</td>
<td>object</td>
<td>0</td>
<td>0.0</td>
<td>167</td>
<td>['ASML.AS', 'MC.PA', 'RMS.PA']</td>
</tr>
<tr>
<th>3</th>
<td>long_name</td>
<td>object</td>
<td>0</td>
<td>0.0</td>
<td>166</td>
<td>['ASML Holding N.V.', 'LVMH Moët Hennessy - Louis Vuitton, Société Européenne', 'Hermès International Société en commandite par actions']</td>
</tr>
<tr>
<th>4</th>
<td>short_name</td>
<td>object</td>
<td>0</td>
<td>0.0</td>
<td>167</td>
<td>['ASML HOLDING', 'LVMH', 'HERMES INTL']</td>
</tr>
</tbody>
</table>

```python
prof_pl = profile_pl(dim_pl)
prof_pl = prof_pl.filter(pl.col("column") != "long_business_summary")
display(Markdown("*Polars profile:*"))
display(prof_pl.head())
```

*Polars profile:*

<div><!-- shape: (5, 6) --><table><thead><tr><th>column</th><th>dtype</th><th>null_count</th><th>null_pct</th><th>n_unique</th><th>sample</th></tr><tr><td>str</td><td>str</td><td>i64</td><td>f64</td><td>i64</td><td>str</td></tr></thead><tbody><tr><td>id</td><td>Int64</td><td>0</td><td>0.0</td><td>169</td><td>[1, 2, 3]</td></tr><tr><td>_index</td><td>String</td><td>0</td><td>0.0</td><td>4</td><td>[&#x27;euro_stoxx_50&#x27;, &#x27;euro_stoxx_…</td></tr><tr><td>symbol</td><td>String</td><td>0</td><td>0.0</td><td>167</td><td>[&#x27;ASML.AS&#x27;, &#x27;MC.PA&#x27;, &#x27;RMS.PA&#x27;]</td></tr><tr><td>long_name</td><td>String</td><td>0</td><td>0.0</td><td>166</td><td>[&#x27;ASML Holding N.V.&#x27;, &#x27;LVMH Mo…</td></tr><tr><td>short_name</td><td>String</td><td>0</td><td>0.0</td><td>167</td><td>[&#x27;ASML HOLDING&#x27;, &#x27;LVMH&#x27;, &#x27;HERM…</td></tr></tbody></table></div>

#### Profile scores_daily — Pandas vs Polars describe comparison

```python
prof_pd = profile_pd(scores_pd)
display(Markdown("*Pandas profile:*"))
display(prof_pd.head())
```

*Pandas profile:*

<table>
<thead>
<tr>
<th></th>
<th>column</th>
<th>dtype</th>
<th>null_count</th>
<th>null_pct</th>
<th>n_unique</th>
<th>sample</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>id</td>
<td>int64</td>
<td>0</td>
<td>0.0</td>
<td>466</td>
<td>[163, 168, 174]</td>
</tr>
<tr>
<th>1</th>
<td>_index</td>
<td>object</td>
<td>0</td>
<td>0.0</td>
<td>4</td>
<td>['euro_stoxx_50', 'euro_stoxx_50', 'euro_stoxx_50']</td>
</tr>
<tr>
<th>2</th>
<td>symbol</td>
<td>object</td>
<td>0</td>
<td>0.0</td>
<td>167</td>
<td>['BNP.PA', 'DTE.DE', 'IFX.DE']</td>
</tr>
<tr>
<th>3</th>
<td>score_date</td>
<td>object</td>
<td>0</td>
<td>0.0</td>
<td>3</td>
<td>[datetime.date(2026, 3, 4), datetime.date(2026, 3, 4), datetime.date(2026, 3, 4)]</td>
</tr>
<tr>
<th>4</th>
<td>sector</td>
<td>object</td>
<td>0</td>
<td>0.0</td>
<td>10</td>
<td>['Financial Services', 'Communication Services', 'Technology']</td>
</tr>
</tbody>
</table>

```python
prof_pl = profile_pl(scores_pl)
display(Markdown("*Polars profile:*"))
display(prof_pl.head())
```

*Polars profile:*

<div><!-- shape: (5, 6) --><table><thead><tr><th>column</th><th>dtype</th><th>null_count</th><th>null_pct</th><th>n_unique</th><th>sample</th></tr><tr><td>str</td><td>str</td><td>i64</td><td>f64</td><td>i64</td><td>str</td></tr></thead><tbody><tr><td>id</td><td>Int64</td><td>0</td><td>0.0</td><td>466</td><td>[163, 168, 174]</td></tr><tr><td>_index</td><td>String</td><td>0</td><td>0.0</td><td>4</td><td>[&#x27;euro_stoxx_50&#x27;, &#x27;euro_stoxx_…</td></tr><tr><td>symbol</td><td>String</td><td>0</td><td>0.0</td><td>167</td><td>[&#x27;BNP.PA&#x27;, &#x27;DTE.DE&#x27;, &#x27;IFX.DE&#x27;]</td></tr><tr><td>score_date</td><td>Date</td><td>0</td><td>0.0</td><td>3</td><td>[datetime.date(2026, 3, 4), da…</td></tr><tr><td>sector</td><td>String</td><td>0</td><td>0.0</td><td>10</td><td>[&#x27;Financial Services&#x27;, &#x27;Commun…</td></tr></tbody></table></div>

---

### Comparison Table | Pandas vs Polars

```python
comparison = """
| Task | Pandas | Polars |
|---|---|---|
| First N rows | `df.head(n)` | `df.head(n)` |
| Last N rows | `df.tail(n)` | `df.tail(n)` |
| Random sample | `df.sample(n)` | `df.sample(n)` |
| Transposed preview | (no built-in) | `df.glimpse()` |
| Shape | `df.shape` | `df.shape` |
| Describe (numeric) | `df.describe()` | `df.describe()` |
| Describe (all) | `df.describe(include="all")` | `df.describe()` (all by default) |
| Column dtypes | `df.dtypes` | `df.dtypes` / `df.schema` |
| Info summary | `df.info()` | (no direct equivalent) |
| Value counts | `s.value_counts()` | `s.value_counts()` |
| Unique values | `s.unique()` | `s.unique()` |
| N-unique (one col) | `s.nunique()` | `s.n_unique()` |
| N-unique (all cols) | `df.nunique()` | `df.select(pl.all().n_unique())` |
| Null count (col) | `s.isnull().sum()` | `s.null_count()` |
| Null count (all) | `df.isnull().sum()` | `df.null_count()` |
| Null percentage | `df.isnull().mean() * 100` | `pl.all().null_count() / pl.len() * 100` |
| Filter null rows | `df[df.isnull().any(axis=1)]` | `df.filter(pl.any_horizontal(pl.all().is_null()))` |
"""
display(Markdown(comparison))
```

| Task | Pandas | Polars |
|---|---|---|
| First N rows | `df.head(n)` | `df.head(n)` |
| Last N rows | `df.tail(n)` | `df.tail(n)` |
| Random sample | `df.sample(n)` | `df.sample(n)` |
| Transposed preview | (no built-in) | `df.glimpse()` |
| Shape | `df.shape` | `df.shape` |
| Describe (numeric) | `df.describe()` | `df.describe()` |
| Describe (all) | `df.describe(include="all")` | `df.describe()` (all by default) |
| Column dtypes | `df.dtypes` | `df.dtypes` / `df.schema` |
| Info summary | `df.info()` | (no direct equivalent) |
| Value counts | `s.value_counts()` | `s.value_counts()` |
| Unique values | `s.unique()` | `s.unique()` |
| N-unique (one col) | `s.nunique()` | `s.n_unique()` |
| N-unique (all cols) | `df.nunique()` | `df.select(pl.all().n_unique())` |
| Null count (col) | `s.isnull().sum()` | `s.null_count()` |
| Null count (all) | `df.isnull().sum()` | `df.null_count()` |
| Null percentage | `df.isnull().mean() * 100` | `pl.all().null_count() / pl.len() * 100` |
| Filter null rows | `df[df.isnull().any(axis=1)]` | `df.filter(pl.any_horizontal(pl.all().is_null()))` |

---

## Selecting Rows & Columns

This section covers positional, label-based, and name-based row and column selection. Pandas uses `.iloc[]` (positional) and `.loc[]` (label-based). Polars uses `.select()`, `.filter()`, and `pl.col()` expressions.

> [!info] Pandas vs Polars | Selection philosophy
>
> Pandas provides two indexing axes: `.iloc[]` for integer position and `.loc[]` for label-based access. Polars has no `.iloc`/`.loc` — all column selection goes through `.select()` with expressions, and all row filtering goes through `.filter()`. This eliminates the `SettingWithCopyWarning` and chained-indexing bugs common in Pandas.

### Dataset Overview

```python
display(Markdown("**Quick look at both datasets:**"))
display(ohlcv_pd.head(3))
display(dim_pd.drop(columns="long_business_summary").head(3))
```

#### Quick look at both datasets

<table>
<thead>
<tr>
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
<table>
<thead>
<tr>
<th></th>
<th>id</th>
<th>_index</th>
<th>symbol</th>
<th>long_name</th>
<th>short_name</th>
<th>sector</th>
<th>sector_key</th>
<th>industry</th>
<th>industry_key</th>
<th>country</th>
<th>city</th>
<th>website</th>
<th>exchange</th>
<th>full_exchange_name</th>
<th>exchange_timezone_name</th>
<th>exchange_timezone_short</th>
<th>currency</th>
<th>financial_currency</th>
<th>quote_type</th>
<th>market</th>
<th>range_start</th>
<th>price_data_start</th>
<th>valid_from</th>
<th>valid_to</th>
<th>is_current</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>1</td>
<td>euro_stoxx_50</td>
<td>ASML.AS</td>
<td>ASML Holding N.V.</td>
<td>ASML HOLDING</td>
<td>Technology</td>
<td>technology</td>
<td>Semiconductor Equipment &amp; Materials</td>
<td>semiconductor-equipment-materials</td>
<td>Netherlands</td>
<td>Veldhoven</td>
<td>https://www.asml.com</td>
<td>AMS</td>
<td>Amsterdam</td>
<td>Europe/Amsterdam</td>
<td>CET</td>
<td>EUR</td>
<td>EUR</td>
<td>EQUITY</td>
<td>nl_market</td>
<td>1998-07-20</td>
<td>2021-01-01</td>
<td>2026-03-04 22:11:36.189862</td>
<td>None</td>
<td>True</td>
</tr>
<tr>
<th>1</th>
<td>2</td>
<td>euro_stoxx_50</td>
<td>MC.PA</td>
<td>LVMH Moët Hennessy - Louis Vuitton, Société Européenne</td>
<td>LVMH</td>
<td>Consumer Cyclical</td>
<td>consumer-cyclical</td>
<td>Luxury Goods</td>
<td>luxury-goods</td>
<td>France</td>
<td>Paris</td>
<td>https://www.lvmh.com</td>
<td>PAR</td>
<td>Paris</td>
<td>Europe/Paris</td>
<td>CET</td>
<td>EUR</td>
<td>EUR</td>
<td>EQUITY</td>
<td>fr_market</td>
<td>2000-01-03</td>
<td>2021-01-01</td>
<td>2026-03-04 22:11:36.189862</td>
<td>None</td>
<td>True</td>
</tr>
<tr>
<th>2</th>
<td>3</td>
<td>euro_stoxx_50</td>
<td>RMS.PA</td>
<td>Hermès International Société en commandite par actions</td>
<td>HERMES INTL</td>
<td>Consumer Cyclical</td>
<td>consumer-cyclical</td>
<td>Luxury Goods</td>
<td>luxury-goods</td>
<td>France</td>
<td>Paris</td>
<td>https://finance.hermes.com</td>
<td>PAR</td>
<td>Paris</td>
<td>Europe/Paris</td>
<td>CET</td>
<td>EUR</td>
<td>EUR</td>
<td>EQUITY</td>
<td>fr_market</td>
<td>2000-01-03</td>
<td>2021-01-01</td>
<td>2026-03-04 22:11:36.193940</td>
<td>None</td>
<td>True</td>
</tr>
</tbody>
</table>

### Selecting Rows by Position

### Single Row

```python
# Pandas — iloc returns a Series
display(Markdown("**Pandas — single row as Series:**"))
display(ohlcv_pd.iloc[0])
```

#### Pandas | single row as Series

<table>
<thead>
<tr>
<th></th>
<th>0</th>
</tr>
</thead>
<tbody>
<tr>
<th>id</th>
<td>21160</td>
</tr>
<tr>
<th>symbol</th>
<td>ABI.BR</td>
</tr>
<tr>
<th>date</th>
<td>2021-01-04</td>
</tr>
<tr>
<th>open</th>
<td>58.15</td>
</tr>
<tr>
<th>high</th>
<td>58.85</td>
</tr>
<tr>
<th>low</th>
<td>56.78</td>
</tr>
<tr>
<th>close</th>
<td>57.21</td>
</tr>
<tr>
<th>adj_close</th>
<td>53.5761</td>
</tr>
<tr>
<th>volume</th>
<td>1513937</td>
</tr>
<tr>
<th>dividends</th>
<td>0.0</td>
</tr>
<tr>
<th>stock_splits</th>
<td>0.0</td>
</tr>
<tr>
<th>is_filled</th>
<td>False</td>
</tr>
</tbody>
</table>

```python
# Polars — row() returns a tuple, slice() returns a 1-row DataFrame
display(Markdown("**Polars — single row as tuple:**"))
print(ohlcv_pl.row(0))

display(Markdown("**Polars — single row as DataFrame:**"))
display(ohlcv_pl.slice(0, 1))
```

#### Polars | single row as tuple

(21160, 'ABI.BR', datetime.date(2021, 1, 4), 58.15, 58.85, 56.78, 57.21, 53.5761, 1513937, 0.0, 0.0, False)

#### Polars | single row as DataFrame

<div><!-- shape: (1, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

### Multiple Rows by Position

```python
# Pandas — pass a list of positions
display(Markdown("**Pandas — rows at positions 0, 10, 100:**"))
display(ohlcv_pd.iloc[[0, 10, 100]])
```

#### Pandas | rows at positions 0, 10, 100

<table>
<thead>
<tr>
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
<th>10</th>
<td>21170</td>
<td>ABI.BR</td>
<td>2021-01-18</td>
<td>56.25</td>
<td>57.30</td>
<td>56.20</td>
<td>57.08</td>
<td>53.4544</td>
<td>730298</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>100</th>
<td>21260</td>
<td>ABI.BR</td>
<td>2021-05-26</td>
<td>61.99</td>
<td>62.39</td>
<td>61.83</td>
<td>62.12</td>
<td>58.6701</td>
<td>940186</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

```python
# Polars — bracket indexing with a list
display(Markdown("**Polars — rows at positions 0, 10, 100:**"))
display(ohlcv_pl[[0, 10, 100]])
```

#### Polars | rows at positions 0, 10, 100

<div><!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21170</td><td>ABI.BR</td><td>2021-01-18</td><td>56.25</td><td>57.3</td><td>56.2</td><td>57.08</td><td>53.4544</td><td>730298</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21260</td><td>ABI.BR</td><td>2021-05-26</td><td>61.99</td><td>62.39</td><td>61.83</td><td>62.12</td><td>58.6701</td><td>940186</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

### Row Slicing

```python
# Pandas — standard Python slicing (start:stop)
display(Markdown("**Pandas — rows 10 to 14:**"))
display(ohlcv_pd.iloc[10:15])
```

#### Pandas | rows 10 to 14

<table>
<thead>
<tr>
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
<th>10</th>
<td>21170</td>
<td>ABI.BR</td>
<td>2021-01-18</td>
<td>56.25</td>
<td>57.30</td>
<td>56.20</td>
<td>57.08</td>
<td>53.4544</td>
<td>730298</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>11</th>
<td>21171</td>
<td>ABI.BR</td>
<td>2021-01-19</td>
<td>57.10</td>
<td>57.26</td>
<td>56.26</td>
<td>56.35</td>
<td>52.7707</td>
<td>1116570</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>12</th>
<td>21172</td>
<td>ABI.BR</td>
<td>2021-01-20</td>
<td>56.35</td>
<td>56.77</td>
<td>56.00</td>
<td>56.24</td>
<td>52.6677</td>
<td>1226516</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>13</th>
<td>21173</td>
<td>ABI.BR</td>
<td>2021-01-21</td>
<td>56.20</td>
<td>56.55</td>
<td>55.31</td>
<td>55.31</td>
<td>51.7968</td>
<td>1404283</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>14</th>
<td>21174</td>
<td>ABI.BR</td>
<td>2021-01-22</td>
<td>55.28</td>
<td>55.28</td>
<td>54.12</td>
<td>54.78</td>
<td>51.3005</td>
<td>1557287</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

```python
# Polars — slice(offset, length)
display(Markdown("**Polars — rows 10 to 14:**"))
display(ohlcv_pl.slice(10, 5))
```

#### Polars | rows 10 to 14

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21170</td><td>ABI.BR</td><td>2021-01-18</td><td>56.25</td><td>57.3</td><td>56.2</td><td>57.08</td><td>53.4544</td><td>730298</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21171</td><td>ABI.BR</td><td>2021-01-19</td><td>57.1</td><td>57.26</td><td>56.26</td><td>56.35</td><td>52.7707</td><td>1116570</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21172</td><td>ABI.BR</td><td>2021-01-20</td><td>56.35</td><td>56.77</td><td>56.0</td><td>56.24</td><td>52.6677</td><td>1226516</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21173</td><td>ABI.BR</td><td>2021-01-21</td><td>56.2</td><td>56.55</td><td>55.31</td><td>55.31</td><td>51.7968</td><td>1404283</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21174</td><td>ABI.BR</td><td>2021-01-22</td><td>55.28</td><td>55.28</td><td>54.12</td><td>54.78</td><td>51.3005</td><td>1557287</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

### Row by Label

Pandas DataFrames have a row index that supports label-based access via `loc`.
Polars has no row index — use `filter()` instead.

```python
# Pandas — loc with label-based indexing
# Set 'symbol' as index to demonstrate label access
dim_indexed = dim_pd.drop(columns="long_business_summary").set_index("symbol")
display(Markdown("**Pandas — loc with label index:**"))
display(dim_indexed.loc[["ASML.AS", "SAP.DE"]])
```

#### Pandas | loc with label index

<table>
<thead>
<tr>
<th></th>
<th>id</th>
<th>_index</th>
<th>long_name</th>
<th>short_name</th>
<th>sector</th>
<th>sector_key</th>
<th>industry</th>
<th>industry_key</th>
<th>country</th>
<th>city</th>
<th>website</th>
<th>exchange</th>
<th>full_exchange_name</th>
<th>exchange_timezone_name</th>
<th>exchange_timezone_short</th>
<th>currency</th>
<th>financial_currency</th>
<th>quote_type</th>
<th>market</th>
<th>range_start</th>
<th>price_data_start</th>
<th>valid_from</th>
<th>valid_to</th>
<th>is_current</th>
</tr>
<tr>
<th>symbol</th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
<th></th>
</tr>
</thead>
<tbody>
<tr>
<th>ASML.AS</th>
<td>1</td>
<td>euro_stoxx_50</td>
<td>ASML Holding N.V.</td>
<td>ASML HOLDING</td>
<td>Technology</td>
<td>technology</td>
<td>Semiconductor Equipment &amp; Materials</td>
<td>semiconductor-equipment-materials</td>
<td>Netherlands</td>
<td>Veldhoven</td>
<td>https://www.asml.com</td>
<td>AMS</td>
<td>Amsterdam</td>
<td>Europe/Amsterdam</td>
<td>CET</td>
<td>EUR</td>
<td>EUR</td>
<td>EQUITY</td>
<td>nl_market</td>
<td>1998-07-20</td>
<td>2021-01-01</td>
<td>2026-03-04 22:11:36.189862</td>
<td>None</td>
<td>True</td>
</tr>
<tr>
<th>SAP.DE</th>
<td>5</td>
<td>euro_stoxx_50</td>
<td>SAP SE</td>
<td>SAP SE</td>
<td>Technology</td>
<td>technology</td>
<td>Software - Application</td>
<td>software-application</td>
<td>Germany</td>
<td>Walldorf</td>
<td>https://www.sap.com</td>
<td>GER</td>
<td>XETRA</td>
<td>Europe/Berlin</td>
<td>CET</td>
<td>EUR</td>
<td>EUR</td>
<td>EQUITY</td>
<td>de_market</td>
<td>1998-04-09</td>
<td>2021-01-01</td>
<td>2026-03-04 22:11:36.193940</td>
<td>None</td>
<td>True</td>
</tr>
</tbody>
</table>

```python
# Polars — no index, use filter instead
display(Markdown("**Polars — filter as label equivalent:**"))
display(dim_pl.filter(pl.col("symbol").is_in(["ASML.AS", "SAP.DE"])).drop("long_business_summary"))
```

#### Polars | filter as label equivalent

<div><!-- shape: (2, 25) --><table><thead><tr><th>id</th><th>_index</th><th>symbol</th><th>long_name</th><th>short_name</th><th>sector</th><th>sector_key</th><th>industry</th><th>industry_key</th><th>country</th><th>city</th><th>website</th><th>exchange</th><th>full_exchange_name</th><th>exchange_timezone_name</th><th>exchange_timezone_short</th><th>currency</th><th>financial_currency</th><th>quote_type</th><th>market</th><th>range_start</th><th>price_data_start</th><th>valid_from</th><th>valid_to</th><th>is_current</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>date</td><td>date</td><td>datetime[ns]</td><td>null</td><td>bool</td></tr></thead><tbody><tr><td>1</td><td>euro_stoxx_50</td><td>ASML.AS</td><td>ASML Holding N.V.</td><td>ASML HOLDING</td><td>Technology</td><td>technology</td><td>Semiconductor Equipment &amp; Mate…</td><td>semiconductor-equipment-materi…</td><td>Netherlands</td><td>Veldhoven</td><td>https://www.asml.com</td><td>AMS</td><td>Amsterdam</td><td>Europe/Amsterdam</td><td>CET</td><td>EUR</td><td>EUR</td><td>EQUITY</td><td>nl_market</td><td>1998-07-20</td><td>2021-01-01</td><td>2026-03-04 22:11:36.189862</td><td>null</td><td>true</td></tr><tr><td>5</td><td>euro_stoxx_50</td><td>SAP.DE</td><td>SAP SE</td><td>SAP SE</td><td>Technology</td><td>technology</td><td>Software - Application</td><td>software-application</td><td>Germany</td><td>Walldorf</td><td>https://www.sap.com</td><td>GER</td><td>XETRA</td><td>Europe/Berlin</td><td>CET</td><td>EUR</td><td>EUR</td><td>EQUITY</td><td>de_market</td><td>1998-04-09</td><td>2021-01-01</td><td>2026-03-04 22:11:36.193940</td><td>null</td><td>true</td></tr></tbody></table></div>

### Selecting Rows and Columns Together

### By Position

```python
# Pandas — iloc[rows, cols]
display(Markdown("**Pandas — rows 0-4, columns 2-5:**"))
display(ohlcv_pd.iloc[:5, 2:6])
```

#### Pandas | rows 0-4, columns 2-5

<table>
<thead>
<tr>
<th></th>
<th>date</th>
<th>open</th>
<th>high</th>
<th>low</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>2021-01-04</td>
<td>58.15</td>
<td>58.85</td>
<td>56.78</td>
</tr>
<tr>
<th>1</th>
<td>2021-01-05</td>
<td>56.90</td>
<td>57.98</td>
<td>56.75</td>
</tr>
<tr>
<th>2</th>
<td>2021-01-06</td>
<td>57.96</td>
<td>58.94</td>
<td>57.39</td>
</tr>
<tr>
<th>3</th>
<td>2021-01-07</td>
<td>58.68</td>
<td>58.86</td>
<td>57.88</td>
</tr>
<tr>
<th>4</th>
<td>2021-01-08</td>
<td>58.16</td>
<td>58.40</td>
<td>57.43</td>
</tr>
</tbody>
</table>

```python
# Polars — slice + select by column names (no positional column indexing)
display(Markdown("**Polars — rows 0-4, columns date through close:**"))
cols = ohlcv_pl.columns[2:6]
display(ohlcv_pl.slice(0, 5).select(cols))
```

#### Polars | rows 0-4, columns date through close

<div><!-- shape: (5, 4) --><table><thead><tr><th>date</th><th>open</th><th>high</th><th>low</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td></tr><tr><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td></tr><tr><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td></tr><tr><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td></tr><tr><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td></tr></tbody></table></div>

### By Name and Condition

```python
# Pandas — loc with condition + column names
display(Markdown("**Pandas — ASML rows, selected columns:**"))
display(ohlcv_pd.loc[ohlcv_pd["symbol"] == "ASML.AS", ["date", "close", "volume"]].head())
```

#### Pandas | ASML rows, selected columns

<table>
<thead>
<tr>
<th></th>
<th>date</th>
<th>close</th>
<th>volume</th>
</tr>
</thead>
<tbody>
<tr>
<th>10634</th>
<td>2021-01-04</td>
<td>406.25</td>
<td>789502</td>
</tr>
<tr>
<th>10635</th>
<td>2021-01-05</td>
<td>406.90</td>
<td>798787</td>
</tr>
<tr>
<th>10636</th>
<td>2021-01-06</td>
<td>402.85</td>
<td>875711</td>
</tr>
<tr>
<th>10637</th>
<td>2021-01-07</td>
<td>403.90</td>
<td>874780</td>
</tr>
<tr>
<th>10638</th>
<td>2021-01-08</td>
<td>416.05</td>
<td>975243</td>
</tr>
</tbody>
</table>

```python
# Polars — filter + select
display(Markdown("**Polars — ASML rows, selected columns:**"))
display(
    ohlcv_pl
    .filter(pl.col("symbol") == "ASML.AS")
    .select("date", "close", "volume")
    .head()
)
```

#### Polars | ASML rows, selected columns

<div><!-- shape: (5, 3) --><table><thead><tr><th>date</th><th>close</th><th>volume</th></tr><tr><td>date</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>2021-01-04</td><td>406.25</td><td>789502</td></tr><tr><td>2021-01-05</td><td>406.9</td><td>798787</td></tr><tr><td>2021-01-06</td><td>402.85</td><td>875711</td></tr><tr><td>2021-01-07</td><td>403.9</td><td>874780</td></tr><tr><td>2021-01-08</td><td>416.05</td><td>975243</td></tr></tbody></table></div>

### Practical Subset from Dimension Table

```python
# Pandas — first 5 stocks, just name and sector
display(Markdown("**Pandas:**"))
display(dim_pd.iloc[:5][["symbol", "long_name", "sector", "country"]])
```

#### Pandas | first 5 stocks — symbol, name, sector, country

<table>
<thead>
<tr>
<th></th>
<th>symbol</th>
<th>long_name</th>
<th>sector</th>
<th>country</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>ASML.AS</td>
<td>ASML Holding N.V.</td>
<td>Technology</td>
<td>Netherlands</td>
</tr>
<tr>
<th>1</th>
<td>MC.PA</td>
<td>LVMH Moët Hennessy - Louis Vuitton, Société Européenne</td>
<td>Consumer Cyclical</td>
<td>France</td>
</tr>
<tr>
<th>2</th>
<td>RMS.PA</td>
<td>Hermès International Société en commandite par actions</td>
<td>Consumer Cyclical</td>
<td>France</td>
</tr>
<tr>
<th>3</th>
<td>OR.PA</td>
<td>L'Oréal S.A.</td>
<td>Consumer Defensive</td>
<td>France</td>
</tr>
<tr>
<th>4</th>
<td>SAP.DE</td>
<td>SAP SE</td>
<td>Technology</td>
<td>Germany</td>
</tr>
</tbody>
</table>

```python
# Polars — first 5 stocks, just name and sector
display(Markdown("**Polars:**"))
display(dim_pl.slice(0, 5).select("symbol", "long_name", "sector", "country"))
```

#### Polars | first 5 stocks — symbol, name, sector, country

<div><!-- shape: (5, 4) --><table><thead><tr><th>symbol</th><th>long_name</th><th>sector</th><th>country</th></tr><tr><td>str</td><td>str</td><td>str</td><td>str</td></tr></thead><tbody><tr><td>ASML.AS</td><td>ASML Holding N.V.</td><td>Technology</td><td>Netherlands</td></tr><tr><td>MC.PA</td><td>LVMH Moët Hennessy - Louis Vui…</td><td>Consumer Cyclical</td><td>France</td></tr><tr><td>RMS.PA</td><td>Hermès International Société e…</td><td>Consumer Cyclical</td><td>France</td></tr><tr><td>OR.PA</td><td>L&#x27;Oréal S.A.</td><td>Consumer Defensive</td><td>France</td></tr><tr><td>SAP.DE</td><td>SAP SE</td><td>Technology</td><td>Germany</td></tr></tbody></table></div>

---

### Single Column Selection

#### Pandas | bracket and dot notation

_Selects the `close` column from `ohlcv_pd` using bracket notation and dot attribute access, both returning the first 5 rows as an identical Series — demonstrating that `df["col"]` and `df.col` are interchangeable for column retrieval._

```python
display(ohlcv_pd["close"].head())
```

<table>
<thead>
<tr>
<th></th>
<th>close</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>57.21</td>
</tr>
<tr>
<th>1</th>
<td>57.18</td>
</tr>
<tr>
<th>2</th>
<td>58.77</td>
</tr>
<tr>
<th>3</th>
<td>58.40</td>
</tr>
<tr>
<th>4</th>
<td>57.86</td>
</tr>
</tbody>
</table>

```python
display(ohlcv_pd.close.head())
```

<table>
<thead>
<tr>
<th></th>
<th>close</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>57.21</td>
</tr>
<tr>
<th>1</th>
<td>57.18</td>
</tr>
<tr>
<th>2</th>
<td>58.77</td>
</tr>
<tr>
<th>3</th>
<td>58.40</td>
</tr>
<tr>
<th>4</th>
<td>57.86</td>
</tr>
</tbody>
</table>

#### Polars | select() and pl.col()

_Selects `symbol`, `date`, and `close` from `ohlcv_pl` using string shorthand in `select()`, then repeats with explicit `pl.col()` expressions — confirming that bare strings and `pl.col()` are interchangeable column references, both returning a 5-row, 2–3 column result._

```python
display(ohlcv_pl.select("symbol", "date", "close").head())
```

<div><!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td></tr></tbody></table></div>

```python
display(ohlcv_pl.select(pl.col("symbol"), pl.col("close")).head())
```

<div><!-- shape: (5, 2) --><table><thead><tr><th>symbol</th><th>close</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>ABI.BR</td><td>57.21</td></tr><tr><td>ABI.BR</td><td>57.18</td></tr><tr><td>ABI.BR</td><td>58.77</td></tr><tr><td>ABI.BR</td><td>58.4</td></tr><tr><td>ABI.BR</td><td>57.86</td></tr></tbody></table></div>

---

### Multiple Column Selection

#### Pandas | list, loc

_Selects three columns from `ohlcv_pd` using a double-bracket list — the standard Pandas idiom for returning a DataFrame (not a Series) with a named column subset — then demonstrates `loc[:, [...]]` and `loc[:, "open":"close"]` for label-based multi-column access._

```python
display(ohlcv_pd[["symbol", "date", "close"]].head())
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
<td>ABI.BR</td>
<td>2021-01-07</td>
<td>58.40</td>
</tr>
<tr>
<th>4</th>
<td>ABI.BR</td>
<td>2021-01-08</td>
<td>57.86</td>
</tr>
</tbody>
</table>

```python
display(Markdown("**Select specific columns with `loc`:**"))
display(ohlcv_pd.loc[:, ["symbol", "open", "close"]].head())
```

#### Select specific columns with `loc`

<table>
<thead>
<tr>
<th></th>
<th>symbol</th>
<th>open</th>
<th>close</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>ABI.BR</td>
<td>58.15</td>
<td>57.21</td>
</tr>
<tr>
<th>1</th>
<td>ABI.BR</td>
<td>56.90</td>
<td>57.18</td>
</tr>
<tr>
<th>2</th>
<td>ABI.BR</td>
<td>57.96</td>
<td>58.77</td>
</tr>
<tr>
<th>3</th>
<td>ABI.BR</td>
<td>58.68</td>
<td>58.40</td>
</tr>
<tr>
<th>4</th>
<td>ABI.BR</td>
<td>58.16</td>
<td>57.86</td>
</tr>
</tbody>
</table>

```python
display(Markdown("**Slice columns with `loc` (label range):**"))
display(ohlcv_pd.loc[:, "open":"close"].head())
```

#### Slice columns with `loc` (label range)

<table>
<thead>
<tr>
<th></th>
<th>open</th>
<th>high</th>
<th>low</th>
<th>close</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>58.15</td>
<td>58.85</td>
<td>56.78</td>
<td>57.21</td>
</tr>
<tr>
<th>1</th>
<td>56.90</td>
<td>57.98</td>
<td>56.75</td>
<td>57.18</td>
</tr>
<tr>
<th>2</th>
<td>57.96</td>
<td>58.94</td>
<td>57.39</td>
<td>58.77</td>
</tr>
<tr>
<th>3</th>
<td>58.68</td>
<td>58.86</td>
<td>57.88</td>
<td>58.40</td>
</tr>
<tr>
<th>4</th>
<td>58.16</td>
<td>58.40</td>
<td>57.43</td>
<td>57.86</td>
</tr>
</tbody>
</table>

#### Polars | pl.col() with a list

_Passes a Python list of column names to `pl.col()` inside `select()`, returning the five OHLCV price columns — demonstrating that `pl.col(["a", "b", ...])` is a concise alternative to `pl.col("a"), pl.col("b"), ...` for multi-column selection._

```python
display(ohlcv_pl.select(pl.col(["symbol", "open", "high", "low", "close"])).head())
```

<div><!-- shape: (5, 5) --><table><thead><tr><th>symbol</th><th>open</th><th>high</th><th>low</th><th>close</th></tr><tr><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>ABI.BR</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td></tr><tr><td>ABI.BR</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td></tr><tr><td>ABI.BR</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td></tr><tr><td>ABI.BR</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td></tr><tr><td>ABI.BR</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td></tr></tbody></table></div>

---

### Column Selection by Position

#### Pandas | iloc

_Uses `iloc[:, :3]` to return the first three columns (id, symbol, date) of `ohlcv_pd` by position, then `iloc[:, [0, 2, 4]]` to retrieve non-contiguous columns id, date, and high — both operations across all rows._

```python
display(Markdown("**First three columns by position:**"))
display(ohlcv_pd.iloc[:, :3].head())
```

#### First three columns by position

<table>
<thead>
<tr>
<th></th>
<th>id</th>
<th>symbol</th>
<th>date</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>21160</td>
<td>ABI.BR</td>
<td>2021-01-04</td>
</tr>
<tr>
<th>1</th>
<td>21161</td>
<td>ABI.BR</td>
<td>2021-01-05</td>
</tr>
<tr>
<th>2</th>
<td>21162</td>
<td>ABI.BR</td>
<td>2021-01-06</td>
</tr>
<tr>
<th>3</th>
<td>21163</td>
<td>ABI.BR</td>
<td>2021-01-07</td>
</tr>
<tr>
<th>4</th>
<td>21164</td>
<td>ABI.BR</td>
<td>2021-01-08</td>
</tr>
</tbody>
</table>

```python
display(Markdown("**Columns at positions 0, 2, 4:**"))
display(ohlcv_pd.iloc[:, [0, 2, 4]].head())
```

#### Columns at positions 0, 2, 4

<table>
<thead>
<tr>
<th></th>
<th>id</th>
<th>date</th>
<th>high</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>21160</td>
<td>2021-01-04</td>
<td>58.85</td>
</tr>
<tr>
<th>1</th>
<td>21161</td>
<td>2021-01-05</td>
<td>57.98</td>
</tr>
<tr>
<th>2</th>
<td>21162</td>
<td>2021-01-06</td>
<td>58.94</td>
</tr>
<tr>
<th>3</th>
<td>21163</td>
<td>2021-01-07</td>
<td>58.86</td>
</tr>
<tr>
<th>4</th>
<td>21164</td>
<td>2021-01-08</td>
<td>58.40</td>
</tr>
</tbody>
</table>

#### Polars | index into columns list

_Slices `ohlcv_pl.columns` (a Python list) to get the first three column names, then passes them to `select()` — and repeats with a list comprehension for non-contiguous positions 0, 2, 4 — since Polars has no `iloc`-style positional column indexer._

```python
# Polars has no positional column indexing — slice the columns list
display(Markdown("**First three columns by position:**"))
display(ohlcv_pl.select(ohlcv_pl.columns[:3]).head())

display(Markdown("**Columns at positions 0, 2, 4:**"))
display(ohlcv_pl.select([ohlcv_pl.columns[i] for i in [0, 2, 4]]).head())
```

#### First three columns by position

<div><!-- shape: (5, 3) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th></tr><tr><td>i64</td><td>str</td><td>date</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td></tr></tbody></table></div>

#### Columns at positions 0, 2, 4

<div><!-- shape: (5, 3) --><table><thead><tr><th>id</th><th>date</th><th>high</th></tr><tr><td>i64</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>21160</td><td>2021-01-04</td><td>58.85</td></tr><tr><td>21161</td><td>2021-01-05</td><td>57.98</td></tr><tr><td>21162</td><td>2021-01-06</td><td>58.94</td></tr><tr><td>21163</td><td>2021-01-07</td><td>58.86</td></tr><tr><td>21164</td><td>2021-01-08</td><td>58.4</td></tr></tbody></table></div>

---

### Select All / Exclude Columns

Pandas selects all columns by default; exclusion uses `drop()` (covered later).
Polars provides `pl.all()` and `pl.exclude()` as expression-level selectors.

#### Polars | pl.all() and pl.exclude()

_Uses `pl.all()` inside `select()` to pass through all 12 columns of `ohlcv_pl` unmodified, then `pl.exclude("volume")` to drop a single column and `pl.exclude(["volume", "symbol"])` to drop two — demonstrating expression-level exclusion without listing every kept column._

```python
display(ohlcv_pl.select(pl.all()).head(3))
```

<div><!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
display(Markdown("**All columns except volume:**"))
display(ohlcv_pl.select(pl.exclude("volume")).head())
```

#### All columns except volume

<div><!-- shape: (5, 11) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
display(Markdown("**Exclude multiple columns:**"))
display(ohlcv_pl.select(pl.exclude(["volume", "symbol"])).head())
```

#### Exclude multiple columns

<div><!-- shape: (5, 10) --><table><thead><tr><th>id</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

---

### Column Selection by Dtype

#### Pandas | select_dtypes()

_Passes `include="number"` to `select_dtypes()` on `ohlcv_pd`, returning the 9 numeric columns (id, open, high, low, close, adj_close, volume, dividends, stock_splits) and filtering out symbol, date, and is_filled — then repeats with `include="object"` to isolate the two string columns._

```python
display(Markdown("**Numeric columns only:**"))
display(ohlcv_pd.select_dtypes(include="number").head())
```

#### Numeric columns only

<table>
<thead>
<tr>
<th></th>
<th>id</th>
<th>open</th>
<th>high</th>
<th>low</th>
<th>close</th>
<th>adj_close</th>
<th>volume</th>
<th>dividends</th>
<th>stock_splits</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>21160</td>
<td>58.15</td>
<td>58.85</td>
<td>56.78</td>
<td>57.21</td>
<td>53.5761</td>
<td>1513937</td>
<td>0.0</td>
<td>0.0</td>
</tr>
<tr>
<th>1</th>
<td>21161</td>
<td>56.90</td>
<td>57.98</td>
<td>56.75</td>
<td>57.18</td>
<td>53.5480</td>
<td>1382722</td>
<td>0.0</td>
<td>0.0</td>
</tr>
<tr>
<th>2</th>
<td>21162</td>
<td>57.96</td>
<td>58.94</td>
<td>57.39</td>
<td>58.77</td>
<td>55.0370</td>
<td>1370204</td>
<td>0.0</td>
<td>0.0</td>
</tr>
<tr>
<th>3</th>
<td>21163</td>
<td>58.68</td>
<td>58.86</td>
<td>57.88</td>
<td>58.40</td>
<td>54.6905</td>
<td>1469911</td>
<td>0.0</td>
<td>0.0</td>
</tr>
<tr>
<th>4</th>
<td>21164</td>
<td>58.16</td>
<td>58.40</td>
<td>57.43</td>
<td>57.86</td>
<td>54.1848</td>
<td>1428681</td>
<td>0.0</td>
<td>0.0</td>
</tr>
</tbody>
</table>

```python
display(Markdown("**Object / string columns only:**"))
display(ohlcv_pd.select_dtypes(include="object").head())
```

#### Object / string columns only

<table>
<thead>
<tr>
<th></th>
<th>symbol</th>
<th>date</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>ABI.BR</td>
<td>2021-01-04</td>
</tr>
<tr>
<th>1</th>
<td>ABI.BR</td>
<td>2021-01-05</td>
</tr>
<tr>
<th>2</th>
<td>ABI.BR</td>
<td>2021-01-06</td>
</tr>
<tr>
<th>3</th>
<td>ABI.BR</td>
<td>2021-01-07</td>
</tr>
<tr>
<th>4</th>
<td>ABI.BR</td>
<td>2021-01-08</td>
</tr>
</tbody>
</table>

#### Polars | polars.selectors

_Uses `cs.numeric()`, `cs.string()`, and `cs.temporal()` on `ohlcv_pl` to select 9 numeric columns, 1 string column (symbol), and 1 temporal column (date) respectively — then demonstrates `cs.by_dtype(pl.Float64)` and `cs.by_dtype(pl.Int64)` for single-dtype filtering._

```python
display(ohlcv_pl.select(cs.numeric()).head())
```

<div><!-- shape: (5, 9) --><table><thead><tr><th>id</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th></tr><tr><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>21160</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td></tr><tr><td>21161</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td></tr><tr><td>21162</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td></tr><tr><td>21163</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td></tr><tr><td>21164</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td></tr></tbody></table></div>

```python
display(ohlcv_pl.select(cs.string()).head())
```

<div><!-- shape: (5, 1) --><table><thead><tr><th>symbol</th></tr><tr><td>str</td></tr></thead><tbody><tr><td>ABI.BR</td></tr><tr><td>ABI.BR</td></tr><tr><td>ABI.BR</td></tr><tr><td>ABI.BR</td></tr><tr><td>ABI.BR</td></tr></tbody></table></div>

```python
display(ohlcv_pl.select(cs.temporal()).head())
```

<div><!-- shape: (5, 1) --><table><thead><tr><th>date</th></tr><tr><td>date</td></tr></thead><tbody><tr><td>2021-01-04</td></tr><tr><td>2021-01-05</td></tr><tr><td>2021-01-06</td></tr><tr><td>2021-01-07</td></tr><tr><td>2021-01-08</td></tr></tbody></table></div>

```python
display(Markdown("**Float64 columns only:**"))
display(ohlcv_pl.select(cs.by_dtype(pl.Float64)).head())
```

#### Float64 columns only

<div><!-- shape: (5, 7) --><table><thead><tr><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>dividends</th><th>stock_splits</th></tr><tr><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>0.0</td><td>0.0</td></tr><tr><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>0.0</td><td>0.0</td></tr><tr><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>0.0</td><td>0.0</td></tr><tr><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>0.0</td><td>0.0</td></tr><tr><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>0.0</td><td>0.0</td></tr></tbody></table></div>

```python
display(Markdown("**Int64 columns only:**"))
display(ohlcv_pl.select(cs.by_dtype(pl.Int64)).head())
```

#### Int64 columns only

<div><!-- shape: (5, 2) --><table><thead><tr><th>id</th><th>volume</th></tr><tr><td>i64</td><td>i64</td></tr></thead><tbody><tr><td>21160</td><td>1513937</td></tr><tr><td>21161</td><td>1382722</td></tr><tr><td>21162</td><td>1370204</td></tr><tr><td>21163</td><td>1469911</td></tr><tr><td>21164</td><td>1428681</td></tr></tbody></table></div>

---

### Column Selection by Pattern / Regex

#### Pandas | filter(regex=...)

_Applies `df.filter(regex="o")` to `ohlcv_pd`, returning the 7 columns whose names contain the letter "o" (symbol, open, low, close, adj_close, volume, stock_splits) — then demonstrates anchored patterns: `^c` for names starting with "c" and `e` for names containing "e"._

```python
display(Markdown("**Columns matching regex (contains 'o'):**"))
display(ohlcv_pd.filter(regex="o").head())
```

#### Columns matching regex (contains 'o')

<table>
<thead>
<tr>
<th></th>
<th>symbol</th>
<th>open</th>
<th>low</th>
<th>close</th>
<th>adj_close</th>
<th>volume</th>
<th>stock_splits</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>ABI.BR</td>
<td>58.15</td>
<td>56.78</td>
<td>57.21</td>
<td>53.5761</td>
<td>1513937</td>
<td>0.0</td>
</tr>
<tr>
<th>1</th>
<td>ABI.BR</td>
<td>56.90</td>
<td>56.75</td>
<td>57.18</td>
<td>53.5480</td>
<td>1382722</td>
<td>0.0</td>
</tr>
<tr>
<th>2</th>
<td>ABI.BR</td>
<td>57.96</td>
<td>57.39</td>
<td>58.77</td>
<td>55.0370</td>
<td>1370204</td>
<td>0.0</td>
</tr>
<tr>
<th>3</th>
<td>ABI.BR</td>
<td>58.68</td>
<td>57.88</td>
<td>58.40</td>
<td>54.6905</td>
<td>1469911</td>
<td>0.0</td>
</tr>
<tr>
<th>4</th>
<td>ABI.BR</td>
<td>58.16</td>
<td>57.43</td>
<td>57.86</td>
<td>54.1848</td>
<td>1428681</td>
<td>0.0</td>
</tr>
</tbody>
</table>

```python
display(Markdown("**Columns starting with 'c':**"))
display(ohlcv_pd.filter(regex="^c").head())
```

#### Columns starting with 'c'

<table>
<thead>
<tr>
<th></th>
<th>close</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>57.21</td>
</tr>
<tr>
<th>1</th>
<td>57.18</td>
</tr>
<tr>
<th>2</th>
<td>58.77</td>
</tr>
<tr>
<th>3</th>
<td>58.40</td>
</tr>
<tr>
<th>4</th>
<td>57.86</td>
</tr>
</tbody>
</table>

```python
display(Markdown("**Columns whose name contains 'e':**"))
display(ohlcv_pd.filter(regex="e").head())
```

#### Columns whose name contains 'e'

<table>
<thead>
<tr>
<th></th>
<th>date</th>
<th>open</th>
<th>close</th>
<th>adj_close</th>
<th>volume</th>
<th>dividends</th>
<th>is_filled</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>2021-01-04</td>
<td>58.15</td>
<td>57.21</td>
<td>53.5761</td>
<td>1513937</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>1</th>
<td>2021-01-05</td>
<td>56.90</td>
<td>57.18</td>
<td>53.5480</td>
<td>1382722</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>2</th>
<td>2021-01-06</td>
<td>57.96</td>
<td>58.77</td>
<td>55.0370</td>
<td>1370204</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>3</th>
<td>2021-01-07</td>
<td>58.68</td>
<td>58.40</td>
<td>54.6905</td>
<td>1469911</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>4</th>
<td>2021-01-08</td>
<td>58.16</td>
<td>57.86</td>
<td>54.1848</td>
<td>1428681</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

#### Polars | pl.col("^regex$") and cs.by_name()

_Uses `cs.by_name("open", "close")` to select two columns by exact name, then demonstrates Polars regex column selection with `pl.col("^(c|o).*$")` for names starting with "c" or "o" and `pl.col("^.*e$")` for names ending with "e" — all anchored with `^...$` as Polars requires._

```python
display(ohlcv_pl.select(cs.by_name("open", "close")).head())
```

<div><!-- shape: (5, 2) --><table><thead><tr><th>open</th><th>close</th></tr><tr><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>58.15</td><td>57.21</td></tr><tr><td>56.9</td><td>57.18</td></tr><tr><td>57.96</td><td>58.77</td></tr><tr><td>58.68</td><td>58.4</td></tr><tr><td>58.16</td><td>57.86</td></tr></tbody></table></div>

```python
display(Markdown("**Columns whose name starts with 'c' or 'o' (regex):**"))
display(ohlcv_pl.select(pl.col("^(c|o).*$")).head())
```

#### Columns whose name starts with 'c' or 'o' (regex)

<div><!-- shape: (5, 2) --><table><thead><tr><th>open</th><th>close</th></tr><tr><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>58.15</td><td>57.21</td></tr><tr><td>56.9</td><td>57.18</td></tr><tr><td>57.96</td><td>58.77</td></tr><tr><td>58.68</td><td>58.4</td></tr><tr><td>58.16</td><td>57.86</td></tr></tbody></table></div>

```python
display(Markdown("**Columns ending with 'e':**"))
display(ohlcv_pl.select(pl.col("^.*e$")).head())
```

#### Columns ending with 'e'

<div><!-- shape: (5, 4) --><table><thead><tr><th>date</th><th>close</th><th>adj_close</th><th>volume</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>2021-01-04</td><td>57.21</td><td>53.5761</td><td>1513937</td></tr><tr><td>2021-01-05</td><td>57.18</td><td>53.548</td><td>1382722</td></tr><tr><td>2021-01-06</td><td>58.77</td><td>55.037</td><td>1370204</td></tr><tr><td>2021-01-07</td><td>58.4</td><td>54.6905</td><td>1469911</td></tr><tr><td>2021-01-08</td><td>57.86</td><td>54.1848</td><td>1428681</td></tr></tbody></table></div>

---

### Combining Selectors (Polars)

`polars.selectors` supports set operations: `|` (union), `-` (difference), `~` (invert).

```python
display(Markdown("**Numeric BUT NOT Int64:**"))
display(ohlcv_pl.select(cs.numeric() - cs.by_dtype(pl.Int64)).head())
```

#### Numeric BUT NOT Int64

<div><!-- shape: (5, 7) --><table><thead><tr><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>dividends</th><th>stock_splits</th></tr><tr><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>0.0</td><td>0.0</td></tr><tr><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>0.0</td><td>0.0</td></tr><tr><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>0.0</td><td>0.0</td></tr><tr><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>0.0</td><td>0.0</td></tr><tr><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>0.0</td><td>0.0</td></tr></tbody></table></div>

```python
display(Markdown("**Numeric OR temporal:**"))
display(ohlcv_pl.select(cs.numeric() | cs.temporal()).head())
```

#### Numeric OR temporal

<div><!-- shape: (5, 10) --><table><thead><tr><th>id</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th></tr><tr><td>i64</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>21160</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td></tr><tr><td>21161</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td></tr><tr><td>21162</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td></tr><tr><td>21163</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td></tr><tr><td>21164</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td></tr></tbody></table></div>

```python
display(Markdown("**Invert a selector (everything NOT numeric):**"))
display(ohlcv_pl.select(~cs.numeric()).head())
```

#### Invert a selector (everything NOT numeric)

<div><!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>is_filled</th></tr><tr><td>str</td><td>date</td><td>bool</td></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>false</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>false</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>false</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>false</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>false</td></tr></tbody></table></div>

---

### Renaming Columns

#### Pandas | rename()

- **Rename**: Rename columns.

_Renames `open` to `Open` and `close` to `Close` in `ohlcv_pd` using a `columns` dictionary — the result confirms both columns are capitalised while the remaining 10 columns are unchanged._

```python
display(
    ohlcv_pd.rename(columns={"open": "Open", "close": "Close"}).head(3)
)
```

<table>
<thead>
<tr>
<th></th>
<th>id</th>
<th>symbol</th>
<th>date</th>
<th>Open</th>
<th>high</th>
<th>low</th>
<th>Close</th>
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

#### Polars | rename()

- **Rename**: Rename columns.

_Applies the same two-column rename as the Pandas example using a plain dict (no `columns=` keyword) — confirms API parity while highlighting that Polars `rename()` takes the mapping as the first positional argument._

```python
display(
    ohlcv_pl.rename({"open": "Open", "close": "Close"}).head(3)
)
```

<div><!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>Open</th><th>high</th><th>low</th><th>Close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

#### Polars | alias() inside select()

- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **Alias**: Give an expression result a column name (Polars).

_Selects `symbol` and `date` unchanged, renames `close` to `closing_price` and `volume` to `vol` using `.alias()` per expression — reducing the result from 12 to 4 named columns without a separate rename step._

```python
display(
    ohlcv_pl.select(
        pl.col("symbol"),
        pl.col("date"),
        pl.col("close").alias("closing_price"),
        pl.col("volume").alias("vol"),
    ).head()
)
```

<div><!-- shape: (5, 4) --><table><thead><tr><th>symbol</th><th>date</th><th>closing_price</th><th>vol</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>1370204</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>1469911</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>1428681</td></tr></tbody></table></div>

#### Polars | name.prefix() / name.suffix()

- **Selector: Numeric**: Select all numeric columns (Polars selectors module).

_Adds a `num_` prefix to all 9 numeric column names using `cs.numeric().name.prefix()`, then demonstrates `pl.all().name.suffix("_raw")` to append `_raw` to all 12 column names — showing both approaches to bulk column renaming via name modifiers._

```python
display(Markdown("**Add prefix to numeric columns:**"))
display(
    ohlcv_pl.select(cs.numeric().name.prefix("num_")).head(3)
)
```

#### Add prefix to numeric columns

<div><!-- shape: (3, 9) --><table><thead><tr><th>num_id</th><th>num_open</th><th>num_high</th><th>num_low</th><th>num_close</th><th>num_adj_close</th><th>num_volume</th><th>num_dividends</th><th>num_stock_splits</th></tr><tr><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>21160</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td></tr><tr><td>21161</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td></tr><tr><td>21162</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td></tr></tbody></table></div>

```python
display(Markdown("**Add suffix to all columns:**"))
display(
    ohlcv_pl.select(pl.all().name.suffix("_raw")).head(3)
)
```

#### Add suffix to all columns

<div><!-- shape: (3, 12) --><table><thead><tr><th>id_raw</th><th>symbol_raw</th><th>date_raw</th><th>open_raw</th><th>high_raw</th><th>low_raw</th><th>close_raw</th><th>adj_close_raw</th><th>volume_raw</th><th>dividends_raw</th><th>stock_splits_raw</th><th>is_filled_raw</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

---

### Reordering Columns

#### Pandas | explicit list

_Reorders `ohlcv_pd` to a 7-column subset with `date` and `symbol` first, followed by OHLCV price columns — using a manually defined list as the column index to achieve reordering and column subsetting in one bracket operation._

```python
new_order = ["date", "symbol", "close", "open", "high", "low", "volume"]
display(ohlcv_pd[new_order].head(3))
```

<table>
<thead>
<tr>
<th></th>
<th>date</th>
<th>symbol</th>
<th>close</th>
<th>open</th>
<th>high</th>
<th>low</th>
<th>volume</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>2021-01-04</td>
<td>ABI.BR</td>
<td>57.21</td>
<td>58.15</td>
<td>58.85</td>
<td>56.78</td>
<td>1513937</td>
</tr>
<tr>
<th>1</th>
<td>2021-01-05</td>
<td>ABI.BR</td>
<td>57.18</td>
<td>56.90</td>
<td>57.98</td>
<td>56.75</td>
<td>1382722</td>
</tr>
<tr>
<th>2</th>
<td>2021-01-06</td>
<td>ABI.BR</td>
<td>58.77</td>
<td>57.96</td>
<td>58.94</td>
<td>57.39</td>
<td>1370204</td>
</tr>
</tbody>
</table>

#### Polars | select() reorders

_Reorders `ohlcv_pl` to the same 7-column subset as the Pandas example by passing the desired column order directly to `select()` — demonstrating that Polars `select()` naturally reorders and subsets in one step._

```python
display(
    ohlcv_pl.select("date", "symbol", "close", "open", "high", "low", "volume").head(3)
)
```

<div><!-- shape: (3, 7) --><table><thead><tr><th>date</th><th>symbol</th><th>close</th><th>open</th><th>high</th><th>low</th><th>volume</th></tr><tr><td>date</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>2021-01-04</td><td>ABI.BR</td><td>57.21</td><td>58.15</td><td>58.85</td><td>56.78</td><td>1513937</td></tr><tr><td>2021-01-05</td><td>ABI.BR</td><td>57.18</td><td>56.9</td><td>57.98</td><td>56.75</td><td>1382722</td></tr><tr><td>2021-01-06</td><td>ABI.BR</td><td>58.77</td><td>57.96</td><td>58.94</td><td>57.39</td><td>1370204</td></tr></tbody></table></div>

#### Polars | move specific columns to front

_Moves `date` and `symbol` to the front of `ohlcv_pl` while preserving all 12 columns by splitting the column list into `front` and `rest`, then concatenating them as the `select()` argument._

```python
front = ["date", "symbol"]
rest  = [c for c in ohlcv_pl.columns if c not in front]
display(ohlcv_pl.select(front + rest).head(3))
```

<div><!-- shape: (3, 12) --><table><thead><tr><th>date</th><th>symbol</th><th>id</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>date</td><td>str</td><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>2021-01-04</td><td>ABI.BR</td><td>21160</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>2021-01-05</td><td>ABI.BR</td><td>21161</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>2021-01-06</td><td>ABI.BR</td><td>21162</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

---

### Dropping Columns

#### Pandas | drop()

_Removes the `volume` column from `ohlcv_pd` using `drop(columns=[...])`, returning an 11-column DataFrame, then drops both `volume` and `open` to produce a 10-column result._

```python
display(ohlcv_pd.drop(columns=["volume"]).head(3))
```

<table>
<thead>
<tr>
<th></th>
<th>id</th>
<th>symbol</th>
<th>date</th>
<th>open</th>
<th>high</th>
<th>low</th>
<th>close</th>
<th>adj_close</th>
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
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

```python
display(Markdown("**Drop multiple columns:**"))
display(ohlcv_pd.drop(columns=["volume", "open"]).head(3))
```

#### Drop multiple columns

<table>
<thead>
<tr>
<th></th>
<th>id</th>
<th>symbol</th>
<th>date</th>
<th>high</th>
<th>low</th>
<th>close</th>
<th>adj_close</th>
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
<td>58.85</td>
<td>56.78</td>
<td>57.21</td>
<td>53.5761</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>1</th>
<td>21161</td>
<td>ABI.BR</td>
<td>2021-01-05</td>
<td>57.98</td>
<td>56.75</td>
<td>57.18</td>
<td>53.5480</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>2</th>
<td>21162</td>
<td>ABI.BR</td>
<td>2021-01-06</td>
<td>58.94</td>
<td>57.39</td>
<td>58.77</td>
<td>55.0370</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

#### Polars | drop()

_Removes `volume` from `ohlcv_pl` using `drop()` with a bare string (no list required for a single column), returning an 11-column DataFrame — then drops both `volume` and `open` to confirm `drop("a", "b")` variadic syntax._

```python
display(ohlcv_pl.drop("volume").head(3))
```

<div><!-- shape: (3, 11) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
display(Markdown("**Drop multiple columns:**"))
display(ohlcv_pl.drop("volume", "open").head(3))
```

#### Drop multiple columns

<div><!-- shape: (3, 10) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

---

### Selection Patterns on the Dimension Table

```python
display(Markdown("**Dimension table columns:**"))
print("Pandas:\n", dim_pd.columns.tolist())
print("\nPolars:\n", dim_pl.columns)
```

#### Dimension table columns

Pandas:
     ['id', '_index', 'symbol', 'long_name', 'short_name', 'sector', 'sector_key', 'industry', 'industry_key', 'country', 'city', 'website', 'long_business_summary', 'exchange', 'full_exchange_name', 'exchange_timezone_name', 'exchange_timezone_short', 'currency', 'financial_currency', 'quote_type', 'market', 'range_start', 'price_data_start', 'valid_from', 'valid_to', 'is_current']

Polars:
     ['id', '_index', 'symbol', 'long_name', 'short_name', 'sector', 'sector_key', 'industry', 'industry_key', 'country', 'city', 'website', 'long_business_summary', 'exchange', 'full_exchange_name', 'exchange_timezone_name', 'exchange_timezone_short', 'currency', 'financial_currency', 'quote_type', 'market', 'range_start', 'price_data_start', 'valid_from', 'valid_to', 'is_current']

```python
display(Markdown("**Pandas — select string columns:**"))
display(dim_pd.select_dtypes(include="object").drop(columns="long_business_summary").head())
```

#### Pandas | select string columns

<table>
<thead>
<tr>
<th></th>
<th>_index</th>
<th>symbol</th>
<th>long_name</th>
<th>short_name</th>
<th>sector</th>
<th>sector_key</th>
<th>industry</th>
<th>industry_key</th>
<th>country</th>
<th>city</th>
<th>website</th>
<th>exchange</th>
<th>full_exchange_name</th>
<th>exchange_timezone_name</th>
<th>exchange_timezone_short</th>
<th>currency</th>
<th>financial_currency</th>
<th>quote_type</th>
<th>market</th>
<th>range_start</th>
<th>price_data_start</th>
<th>valid_to</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>euro_stoxx_50</td>
<td>ASML.AS</td>
<td>ASML Holding N.V.</td>
<td>ASML HOLDING</td>
<td>Technology</td>
<td>technology</td>
<td>Semiconductor Equipment &amp; Materials</td>
<td>semiconductor-equipment-materials</td>
<td>Netherlands</td>
<td>Veldhoven</td>
<td>https://www.asml.com</td>
<td>AMS</td>
<td>Amsterdam</td>
<td>Europe/Amsterdam</td>
<td>CET</td>
<td>EUR</td>
<td>EUR</td>
<td>EQUITY</td>
<td>nl_market</td>
<td>1998-07-20</td>
<td>2021-01-01</td>
<td>None</td>
</tr>
<tr>
<th>1</th>
<td>euro_stoxx_50</td>
<td>MC.PA</td>
<td>LVMH Moët Hennessy - Louis Vuitton, Société Européenne</td>
<td>LVMH</td>
<td>Consumer Cyclical</td>
<td>consumer-cyclical</td>
<td>Luxury Goods</td>
<td>luxury-goods</td>
<td>France</td>
<td>Paris</td>
<td>https://www.lvmh.com</td>
<td>PAR</td>
<td>Paris</td>
<td>Europe/Paris</td>
<td>CET</td>
<td>EUR</td>
<td>EUR</td>
<td>EQUITY</td>
<td>fr_market</td>
<td>2000-01-03</td>
<td>2021-01-01</td>
<td>None</td>
</tr>
<tr>
<th>2</th>
<td>euro_stoxx_50</td>
<td>RMS.PA</td>
<td>Hermès International Société en commandite par actions</td>
<td>HERMES INTL</td>
<td>Consumer Cyclical</td>
<td>consumer-cyclical</td>
<td>Luxury Goods</td>
<td>luxury-goods</td>
<td>France</td>
<td>Paris</td>
<td>https://finance.hermes.com</td>
<td>PAR</td>
<td>Paris</td>
<td>Europe/Paris</td>
<td>CET</td>
<td>EUR</td>
<td>EUR</td>
<td>EQUITY</td>
<td>fr_market</td>
<td>2000-01-03</td>
<td>2021-01-01</td>
<td>None</td>
</tr>
<tr>
<th>3</th>
<td>euro_stoxx_50</td>
<td>OR.PA</td>
<td>L'Oréal S.A.</td>
<td>L'OREAL</td>
<td>Consumer Defensive</td>
<td>consumer-defensive</td>
<td>Household &amp; Personal Products</td>
<td>household-personal-products</td>
<td>France</td>
<td>Clichy</td>
<td>https://www.loreal.com</td>
<td>PAR</td>
<td>Paris</td>
<td>Europe/Paris</td>
<td>CET</td>
<td>EUR</td>
<td>EUR</td>
<td>EQUITY</td>
<td>fr_market</td>
<td>2000-01-03</td>
<td>2021-01-01</td>
<td>None</td>
</tr>
<tr>
<th>4</th>
<td>euro_stoxx_50</td>
<td>SAP.DE</td>
<td>SAP SE</td>
<td>SAP SE</td>
<td>Technology</td>
<td>technology</td>
<td>Software - Application</td>
<td>software-application</td>
<td>Germany</td>
<td>Walldorf</td>
<td>https://www.sap.com</td>
<td>GER</td>
<td>XETRA</td>
<td>Europe/Berlin</td>
<td>CET</td>
<td>EUR</td>
<td>EUR</td>
<td>EQUITY</td>
<td>de_market</td>
<td>1998-04-09</td>
<td>2021-01-01</td>
<td>None</td>
</tr>
</tbody>
</table>

```python
display(Markdown("**Polars — select string columns with cs.string():**"))
display(dim_pl.select(cs.string()).head())
```

#### Polars | select string columns with cs.string()

<div><!-- shape: (5, 20) --><table><thead><tr><th>_index</th><th>symbol</th><th>long_name</th><th>short_name</th><th>sector</th><th>sector_key</th><th>industry</th><th>industry_key</th><th>country</th><th>city</th><th>website</th><th>long_business_summary</th><th>exchange</th><th>full_exchange_name</th><th>exchange_timezone_name</th><th>exchange_timezone_short</th><th>currency</th><th>financial_currency</th><th>quote_type</th><th>market</th></tr><tr><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td></tr></thead><tbody><tr><td>euro_stoxx_50</td><td>ASML.AS</td><td>ASML Holding N.V.</td><td>ASML HOLDING</td><td>Technology</td><td>technology</td><td>Semiconductor Equipment &amp; Mate…</td><td>semiconductor-equipment-materi…</td><td>Netherlands</td><td>Veldhoven</td><td>https://www.asml.com</td><td>ASML Holding N.V. provides lit…</td><td>AMS</td><td>Amsterdam</td><td>Europe/Amsterdam</td><td>CET</td><td>EUR</td><td>EUR</td><td>EQUITY</td><td>nl_market</td></tr><tr><td>euro_stoxx_50</td><td>MC.PA</td><td>LVMH Moët Hennessy - Louis Vui…</td><td>LVMH</td><td>Consumer Cyclical</td><td>consumer-cyclical</td><td>Luxury Goods</td><td>luxury-goods</td><td>France</td><td>Paris</td><td>https://www.lvmh.com</td><td>LVMH Moët Hennessy - Louis Vui…</td><td>PAR</td><td>Paris</td><td>Europe/Paris</td><td>CET</td><td>EUR</td><td>EUR</td><td>EQUITY</td><td>fr_market</td></tr><tr><td>euro_stoxx_50</td><td>RMS.PA</td><td>Hermès International Société e…</td><td>HERMES INTL</td><td>Consumer Cyclical</td><td>consumer-cyclical</td><td>Luxury Goods</td><td>luxury-goods</td><td>France</td><td>Paris</td><td>https://finance.hermes.com</td><td>Hermès International Société e…</td><td>PAR</td><td>Paris</td><td>Europe/Paris</td><td>CET</td><td>EUR</td><td>EUR</td><td>EQUITY</td><td>fr_market</td></tr><tr><td>euro_stoxx_50</td><td>OR.PA</td><td>L&#x27;Oréal S.A.</td><td>L&#x27;OREAL</td><td>Consumer Defensive</td><td>consumer-defensive</td><td>Household &amp; Personal Products</td><td>household-personal-products</td><td>France</td><td>Clichy</td><td>https://www.loreal.com</td><td>L&#x27;Oréal S.A., through its subs…</td><td>PAR</td><td>Paris</td><td>Europe/Paris</td><td>CET</td><td>EUR</td><td>EUR</td><td>EQUITY</td><td>fr_market</td></tr><tr><td>euro_stoxx_50</td><td>SAP.DE</td><td>SAP SE</td><td>SAP SE</td><td>Technology</td><td>technology</td><td>Software - Application</td><td>software-application</td><td>Germany</td><td>Walldorf</td><td>https://www.sap.com</td><td>SAP SE, together with its subs…</td><td>GER</td><td>XETRA</td><td>Europe/Berlin</td><td>CET</td><td>EUR</td><td>EUR</td><td>EQUITY</td><td>de_market</td></tr></tbody></table></div>

```python
display(Markdown("**Polars — select with cs.matches() regex:**"))
display(dim_pl.select(cs.matches(".*name.*|.*id.*")).head())
```

#### Polars | select with cs.matches() regex

<div><!-- shape: (5, 7) --><table><thead><tr><th>id</th><th>long_name</th><th>short_name</th><th>full_exchange_name</th><th>exchange_timezone_name</th><th>valid_from</th><th>valid_to</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>str</td><td>str</td><td>datetime[ns]</td><td>null</td></tr></thead><tbody><tr><td>1</td><td>ASML Holding N.V.</td><td>ASML HOLDING</td><td>Amsterdam</td><td>Europe/Amsterdam</td><td>2026-03-04 22:11:36.189862</td><td>null</td></tr><tr><td>2</td><td>LVMH Moët Hennessy - Louis Vui…</td><td>LVMH</td><td>Paris</td><td>Europe/Paris</td><td>2026-03-04 22:11:36.189862</td><td>null</td></tr><tr><td>3</td><td>Hermès International Société e…</td><td>HERMES INTL</td><td>Paris</td><td>Europe/Paris</td><td>2026-03-04 22:11:36.193940</td><td>null</td></tr><tr><td>4</td><td>L&#x27;Oréal S.A.</td><td>L&#x27;OREAL</td><td>Paris</td><td>Europe/Paris</td><td>2026-03-04 22:11:36.193940</td><td>null</td></tr><tr><td>5</td><td>SAP SE</td><td>SAP SE</td><td>XETRA</td><td>Europe/Berlin</td><td>2026-03-04 22:11:36.193940</td><td>null</td></tr></tbody></table></div>

---

### Comparison Table | Pandas vs Polars

```python
comparison = """
| Task | Pandas | Polars |
|---|---|---|
| Single column (Series) | `df["col"]` | `df.get_column("col")` |
| Single column (DataFrame) | `df[["col"]]` | `df.select("col")` |
| Multiple columns | `df[["a","b"]]` | `df.select("a","b")` |
| Label-based slice | `df.loc[:, "a":"c"]` | (use explicit list) |
| Position-based | `df.iloc[:, 0:3]` | `df[:, 0:3]` |
| All columns | `df` | `df.select(pl.all())` |
| Exclude columns | `df.drop(columns=[...])` | `df.select(pl.exclude(...))` |
| Numeric columns | `df.select_dtypes("number")` | `df.select(cs.numeric())` |
| String columns | `df.select_dtypes("object")` | `df.select(cs.string())` |
| Temporal columns | `df.select_dtypes("datetime")` | `df.select(cs.temporal())` |
| By specific dtype | `df.select_dtypes(include=...)` | `df.select(cs.by_dtype(...))` |
| By name pattern | `df.filter(regex=...)` | `df.select(pl.col("^regex$"))` |
| Selector by name | (manual list) | `cs.by_name("a","b")` |
| Selector set ops | (not available) | `cs.numeric() - cs.by_dtype(pl.Int64)` |
| Rename | `df.rename(columns={...})` | `df.rename({...})` |
| Alias in expr | (not applicable) | `pl.col("x").alias("y")` |
| Prefix / suffix | `df.add_prefix("p_")` | `cs.numeric().name.prefix("p_")` |
| Reorder | `df[new_order]` | `df.select(new_order)` |
| Drop columns | `df.drop(columns=[...])` | `df.drop("a","b")` |
| Regex select | `df.filter(regex="pattern")` | `pl.col("^pattern$")` |
"""
display(Markdown(comparison))
```

| Task | Pandas | Polars |
|---|---|---|
| Single column (Series) | `df["col"]` | `df.get_column("col")` |
| Single column (DataFrame) | `df[["col"]]` | `df.select("col")` |
| Multiple columns | `df[["a","b"]]` | `df.select("a","b")` |
| Label-based slice | `df.loc[:, "a":"c"]` | (use explicit list) |
| Position-based | `df.iloc[:, 0:3]` | `df[:, 0:3]` |
| All columns | `df` | `df.select(pl.all())` |
| Exclude columns | `df.drop(columns=[...])` | `df.select(pl.exclude(...))` |
| Numeric columns | `df.select_dtypes("number")` | `df.select(cs.numeric())` |
| String columns | `df.select_dtypes("object")` | `df.select(cs.string())` |
| Temporal columns | `df.select_dtypes("datetime")` | `df.select(cs.temporal())` |
| By specific dtype | `df.select_dtypes(include=...)` | `df.select(cs.by_dtype(...))` |
| By name pattern | `df.filter(regex=...)` | `df.select(pl.col("^regex$"))` |
| Selector by name | (manual list) | `cs.by_name("a","b")` |
| Selector set ops | (not available) | `cs.numeric() - cs.by_dtype(pl.Int64)` |
| Rename | `df.rename(columns={...})` | `df.rename({...})` |
| Alias in expr | (not applicable) | `pl.col("x").alias("y")` |
| Prefix / suffix | `df.add_prefix("p_")` | `cs.numeric().name.prefix("p_")` |
| Reorder | `df[new_order]` | `df.select(new_order)` |
| Drop columns | `df.drop(columns=[...])` | `df.drop("a","b")` |
| Regex select | `df.filter(regex="pattern")` | `pl.col("^pattern$")` |

---

*End of notebook.*

---

## Filtering Rows

Row filtering selects subsets of rows based on conditions. Pandas uses boolean indexing (`df[mask]`), `.loc[]`, and `.query()`. Polars uses `.filter()` with expressions. Both support compound conditions, membership tests, range checks, null filtering, and string/datetime accessors.

> [!tip] Performance | Vectorized expressions vs boolean masks
>
> Polars `.filter(pl.col("x") > 100)` compiles into a vectorized query plan — the engine processes entire columns at once. Pandas `df[df["x"] > 100]` creates an intermediate boolean mask array in memory. For large datasets, Polars filtering is significantly faster and more memory-efficient.

### Setup & Data Loading

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

<table>
<thead>
<tr>
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

<div><!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

---

### Boolean Indexing (Single Condition)

> [!danger] Chained indexing in Pandas
>
> Chained indexing in Pandas — `df[condition]["col"] = value` silently fails
> `df[df["close"] > 50]["close"] = 0` looks like it works but modifies a **copy**, not the
> original DataFrame. Pandas raises `SettingWithCopyWarning` but the change is lost. Always
> use `.loc[]` for assignment: `df.loc[df["close"] > 50, "close"] = 0`.
>
> Polars has no chained indexing — all operations return new DataFrames, eliminating this
> entire class of bugs.

> [!success] Use .loc[] for all conditional assignment in Pandas
>
> Replace any chained write (`df[mask]["col"] = val`) with a single `.loc[]` call: `df.loc[df["close"] > 50, "close"] = 0`. In Pandas 3+, Copy-on-Write is the default and chained assignment raises a hard error — migrating to `.loc[]` now is future-proof. In Polars, use `pl.when(condition).then(value).otherwise(pl.col("col"))` inside `with_columns`.

#### Pandas | Boolean Indexing — bracket notation

_Filters `ohlcv_pd` to rows where the `close` column exceeds 50 using bracket-notation boolean indexing — the simplest Pandas filter form, returning the first 5 matching OHLCV rows._

```python
# Rows where Close > 50
ohlcv_pd[ohlcv_pd["close"] > 50].head()
```

<table>
<thead>
<tr>
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
</tr>
</tbody>
</table>

#### Pandas | .loc with a boolean mask

_Applies the same `close > 50` filter as bracket notation but using `.loc[]`, producing identical results — `.loc[]` is preferred over bracket notation for any conditional assignment operation to avoid `SettingWithCopyWarning`._

```python
ohlcv_pd.loc[ohlcv_pd["close"] > 50].head()
```

<table>
<thead>
<tr>
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
</tr>
</tbody>
</table>

#### Polars | filter

- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

_Filters `ohlcv_pl` to rows where `close > 50` using a `pl.col` expression inside `.filter()` — the Polars equivalent of Pandas bracket-notation boolean indexing, returning the first 5 matching rows without the `SettingWithCopyWarning` risk._

```python
ohlcv_pl.filter(pl.col("close") > 50).head()
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

---

### Multiple Conditions (&, |, ~)

#### Pandas | AND / OR / NOT

_Builds three boolean masks on `ohlcv_pd`: AND (`close > 50` and `volume > 1M`), OR (`close < 10` or `close > 100`), and NOT (volume not above 5M) — each stored in a variable and applied with `.loc[]` to demonstrate all three Pandas boolean operators._

```python
# AND: close > 50 AND volume > 1_000_000
mask = (ohlcv_pd["close"] > 50) & (ohlcv_pd["volume"] > 1_000_000)
ohlcv_pd.loc[mask].head()
```

<table>
<thead>
<tr>
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
</tr>
</tbody>
</table>

```python
# OR: close < 10 OR close > 100
mask = (ohlcv_pd["close"] < 10) | (ohlcv_pd["close"] > 100)
ohlcv_pd.loc[mask].head()
```

<table>
<thead>
<tr>
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
<th>2662</th>
<td>62088</td>
<td>ADS.DE</td>
<td>2021-01-04</td>
<td>300.0</td>
<td>300.5</td>
<td>293.0</td>
<td>295.4</td>
<td>282.2904</td>
<td>440364</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>2663</th>
<td>62089</td>
<td>ADS.DE</td>
<td>2021-01-05</td>
<td>292.9</td>
<td>295.4</td>
<td>288.2</td>
<td>289.6</td>
<td>276.7479</td>
<td>436591</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>2664</th>
<td>62090</td>
<td>ADS.DE</td>
<td>2021-01-06</td>
<td>290.7</td>
<td>292.7</td>
<td>286.8</td>
<td>291.7</td>
<td>278.7546</td>
<td>392602</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>2665</th>
<td>62091</td>
<td>ADS.DE</td>
<td>2021-01-07</td>
<td>294.0</td>
<td>294.1</td>
<td>288.5</td>
<td>288.5</td>
<td>275.6967</td>
<td>362809</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>2666</th>
<td>62092</td>
<td>ADS.DE</td>
<td>2021-01-08</td>
<td>292.3</td>
<td>296.8</td>
<td>292.0</td>
<td>295.1</td>
<td>282.0038</td>
<td>425762</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

```python
# NOT: rows where volume is NOT above 5_000_000
mask = ~(ohlcv_pd["volume"] > 5_000_000)
ohlcv_pd.loc[mask].head()
```

<table>
<thead>
<tr>
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
</tr>
</tbody>
</table>

#### Polars | AND / OR / NOT

- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

_Demonstrates AND, OR, and NOT filtering in Polars using `pl.col` expressions inside `.filter()` — mirrors the Pandas examples with the same threshold values, applying `&`, `|`, and `~` operators directly in the expression context without intermediate mask variables._

```python
ohlcv_pl.filter(
    (pl.col("close") > 50) & (pl.col("volume") > 1_000_000)
).head()
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
ohlcv_pl.filter(
    (pl.col("close") < 10) | (pl.col("close") > 100)
).head()
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>62088</td><td>ADS.DE</td><td>2021-01-04</td><td>300.0</td><td>300.5</td><td>293.0</td><td>295.4</td><td>282.2904</td><td>440364</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>62089</td><td>ADS.DE</td><td>2021-01-05</td><td>292.9</td><td>295.4</td><td>288.2</td><td>289.6</td><td>276.7479</td><td>436591</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>62090</td><td>ADS.DE</td><td>2021-01-06</td><td>290.7</td><td>292.7</td><td>286.8</td><td>291.7</td><td>278.7546</td><td>392602</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>62091</td><td>ADS.DE</td><td>2021-01-07</td><td>294.0</td><td>294.1</td><td>288.5</td><td>288.5</td><td>275.6967</td><td>362809</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>62092</td><td>ADS.DE</td><td>2021-01-08</td><td>292.3</td><td>296.8</td><td>292.0</td><td>295.1</td><td>282.0038</td><td>425762</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
ohlcv_pl.filter(
    ~(pl.col("volume") > 5_000_000)
).head()
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

---

### query() (Pandas Only)

```python
ohlcv_pd.query("close > 50 and volume > 1_000_000").head()
```

<table>
<thead>
<tr>
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
</tr>
</tbody>
</table>

```python
# Using variables with @
threshold = 80
ohlcv_pd.query("close > @threshold").head()
```

<table>
<thead>
<tr>
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
<th>2662</th>
<td>62088</td>
<td>ADS.DE</td>
<td>2021-01-04</td>
<td>300.0</td>
<td>300.5</td>
<td>293.0</td>
<td>295.4</td>
<td>282.2904</td>
<td>440364</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>2663</th>
<td>62089</td>
<td>ADS.DE</td>
<td>2021-01-05</td>
<td>292.9</td>
<td>295.4</td>
<td>288.2</td>
<td>289.6</td>
<td>276.7479</td>
<td>436591</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>2664</th>
<td>62090</td>
<td>ADS.DE</td>
<td>2021-01-06</td>
<td>290.7</td>
<td>292.7</td>
<td>286.8</td>
<td>291.7</td>
<td>278.7546</td>
<td>392602</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>2665</th>
<td>62091</td>
<td>ADS.DE</td>
<td>2021-01-07</td>
<td>294.0</td>
<td>294.1</td>
<td>288.5</td>
<td>288.5</td>
<td>275.6967</td>
<td>362809</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>2666</th>
<td>62092</td>
<td>ADS.DE</td>
<td>2021-01-08</td>
<td>292.3</td>
<td>296.8</td>
<td>292.0</td>
<td>295.1</td>
<td>282.0038</td>
<td>425762</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

```python
# String column comparisons in query
tickers = ["SIE.DE", "SAP.DE"]
ohlcv_pd.query("symbol in @tickers").head()
```

<table>
<thead>
<tr>
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
<th>55738</th>
<td>5301</td>
<td>SAP.DE</td>
<td>2021-01-04</td>
<td>108.10</td>
<td>108.50</td>
<td>104.78</td>
<td>105.32</td>
<td>97.0102</td>
<td>2928515</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>55739</th>
<td>5302</td>
<td>SAP.DE</td>
<td>2021-01-05</td>
<td>104.98</td>
<td>106.20</td>
<td>104.46</td>
<td>105.04</td>
<td>96.7523</td>
<td>2798888</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>55740</th>
<td>5303</td>
<td>SAP.DE</td>
<td>2021-01-06</td>
<td>105.14</td>
<td>106.26</td>
<td>103.60</td>
<td>105.48</td>
<td>97.1576</td>
<td>3018802</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>55741</th>
<td>5304</td>
<td>SAP.DE</td>
<td>2021-01-07</td>
<td>105.58</td>
<td>105.70</td>
<td>104.04</td>
<td>104.52</td>
<td>96.2734</td>
<td>3176143</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>55742</th>
<td>5305</td>
<td>SAP.DE</td>
<td>2021-01-08</td>
<td>105.14</td>
<td>106.72</td>
<td>105.04</td>
<td>106.18</td>
<td>97.8024</td>
<td>3068744</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

---

### isin / is_in

#### Pandas | filter by ticker list with isin

_Defines a list of three German ticker symbols and filters `ohlcv_pd` to only rows matching those tickers using `.isin()` — returning the first 5 OHLCV rows for SIE.DE, SAP.DE, or BAS.DE._

```python
target_tickers = ["SIE.DE", "SAP.DE", "BAS.DE"]
ohlcv_pd[ohlcv_pd["symbol"].isin(target_tickers)].head()
```

<table>
<thead>
<tr>
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
<th>11965</th>
<td>52834</td>
<td>BAS.DE</td>
<td>2021-01-04</td>
<td>65.48</td>
<td>66.07</td>
<td>64.43</td>
<td>64.89</td>
<td>47.4862</td>
<td>2741508</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>11966</th>
<td>52835</td>
<td>BAS.DE</td>
<td>2021-01-05</td>
<td>64.30</td>
<td>65.47</td>
<td>63.26</td>
<td>64.40</td>
<td>47.1277</td>
<td>2770337</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>11967</th>
<td>52836</td>
<td>BAS.DE</td>
<td>2021-01-06</td>
<td>65.24</td>
<td>67.55</td>
<td>65.14</td>
<td>67.37</td>
<td>49.3011</td>
<td>5187251</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>11968</th>
<td>52837</td>
<td>BAS.DE</td>
<td>2021-01-07</td>
<td>67.93</td>
<td>68.53</td>
<td>67.13</td>
<td>68.41</td>
<td>50.0622</td>
<td>3655366</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>11969</th>
<td>52838</td>
<td>BAS.DE</td>
<td>2021-01-08</td>
<td>69.00</td>
<td>69.24</td>
<td>68.01</td>
<td>68.58</td>
<td>50.1866</td>
<td>3035733</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

#### Polars | is_in

_Applies the same three-ticker filter as the Pandas example using `pl.col("symbol").is_in(target_tickers)` inside `.filter()` — reusing the same target list to confirm parity between Pandas `.isin()` and Polars `.is_in()`._

```python
target_tickers = ["SIE.DE", "SAP.DE", "BAS.DE"]
ohlcv_pl.filter(pl.col("symbol").is_in(target_tickers)).head()
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>52834</td><td>BAS.DE</td><td>2021-01-04</td><td>65.48</td><td>66.07</td><td>64.43</td><td>64.89</td><td>47.4862</td><td>2741508</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>52835</td><td>BAS.DE</td><td>2021-01-05</td><td>64.3</td><td>65.47</td><td>63.26</td><td>64.4</td><td>47.1277</td><td>2770337</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>52836</td><td>BAS.DE</td><td>2021-01-06</td><td>65.24</td><td>67.55</td><td>65.14</td><td>67.37</td><td>49.3011</td><td>5187251</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>52837</td><td>BAS.DE</td><td>2021-01-07</td><td>67.93</td><td>68.53</td><td>67.13</td><td>68.41</td><td>50.0622</td><td>3655366</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>52838</td><td>BAS.DE</td><td>2021-01-08</td><td>69.0</td><td>69.24</td><td>68.01</td><td>68.58</td><td>50.1866</td><td>3035733</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

---

### between / is_between

#### Pandas | close price in range 40–60 with between

_Filters `ohlcv_pd` to rows where the `close` price falls in the closed interval [40, 60] using `.between()` — targets the lower-priced tier of the Euro Stoxx 50 universe, returning the first 5 matching rows._

```python
ohlcv_pd[ohlcv_pd["close"].between(40, 60)].head()
```

<table>
<thead>
<tr>
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
</tr>
</tbody>
</table>

#### Polars | is_between

_Demonstrates `is_between()` for both a numeric range (`close` between 40 and 60) and a date range (`date` between 2023-01-01 and 2023-06-30), using `pl.lit(...).str.to_date()` to convert string literals to dates for the second filter._

```python
ohlcv_pl.filter(pl.col("close").is_between(40, 60)).head()
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
# Date range filtering — Polars
ohlcv_pl.filter(
    pl.col("date").is_between(
        pl.lit("2023-01-01").str.to_date(),
        pl.lit("2023-06-30").str.to_date(),
    )
).head()
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21675</td><td>ABI.BR</td><td>2023-01-02</td><td>56.63</td><td>57.09</td><td>56.43</td><td>56.9</td><td>54.2453</td><td>608437</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21676</td><td>ABI.BR</td><td>2023-01-03</td><td>56.79</td><td>57.76</td><td>56.72</td><td>56.84</td><td>54.1881</td><td>1164809</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21677</td><td>ABI.BR</td><td>2023-01-04</td><td>56.96</td><td>58.02</td><td>56.94</td><td>58.02</td><td>55.313</td><td>1835512</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21678</td><td>ABI.BR</td><td>2023-01-05</td><td>57.69</td><td>57.98</td><td>57.0</td><td>57.14</td><td>54.4741</td><td>1324250</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21679</td><td>ABI.BR</td><td>2023-01-06</td><td>57.23</td><td>57.47</td><td>57.03</td><td>57.44</td><td>54.7601</td><td>1100010</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

---

### Null / NaN Filtering

#### Pandas | Null / NaN Filtering

_Filters `scores_pd` to rows where `ev_ebitda_zscore` is null using `.isna()`, then to rows where it is not null using `.notna()` — identifies which index constituents lack EV/EBITDA data (financial institutions without an enterprise value ratio)._

```python
# Rows where a column IS null
scores_pd[scores_pd["ev_ebitda_zscore"].isna()].head()
```

<table>
<thead>
<tr>
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
<th>8</th>
<td>188</td>
<td>euro_stoxx_50</td>
<td>SAN.MC</td>
<td>2026-03-04</td>
<td>Financial Services</td>
<td>0.458599</td>
<td>0.499398</td>
<td>NaN</td>
<td>-1.107590</td>
<td>-0.049864</td>
<td>33</td>
<td>0.393197</td>
<td>0.953824</td>
<td>1.139519</td>
<td>0.113499</td>
<td>0.519307</td>
<td>14</td>
<td>0.224704</td>
<td>1.70000</td>
<td>False</td>
<td>0.448776</td>
<td>15</td>
<td>0.306073</td>
<td>9</td>
<td>2026-03-04 22:40:25.489180</td>
<td>10.604900</td>
<td>9.919500</td>
<td>145955749888</td>
<td>0.028570</td>
<td>BANCO SANTANDER S.A.</td>
<td>Spain</td>
<td>9.982</td>
<td>0.038818</td>
<td>-0.105876</td>
<td>-0.008739</td>
<td>EUR</td>
</tr>
<tr>
<th>15</th>
<td>176</td>
<td>euro_stoxx_50</td>
<td>ISP.MI</td>
<td>2026-03-04</td>
<td>Financial Services</td>
<td>0.366619</td>
<td>0.488302</td>
<td>NaN</td>
<td>0.723361</td>
<td>0.526094</td>
<td>13</td>
<td>-0.065247</td>
<td>0.922492</td>
<td>0.990855</td>
<td>0.119662</td>
<td>-0.122626</td>
<td>33</td>
<td>0.254150</td>
<td>2.00000</td>
<td>False</td>
<td>0.146959</td>
<td>21</td>
<td>0.183476</td>
<td>16</td>
<td>2026-03-04 22:40:25.489180</td>
<td>5.834933</td>
<td>5.769367</td>
<td>94268317696</td>
<td>0.018452</td>
<td>INTESA SANPAOLO</td>
<td>Italy</td>
<td>5.422</td>
<td>0.018216</td>
<td>-0.067103</td>
<td>-0.084276</td>
<td>EUR</td>
</tr>
<tr>
<th>16</th>
<td>195</td>
<td>euro_stoxx_50</td>
<td>UCG.MI</td>
<td>2026-03-04</td>
<td>Financial Services</td>
<td>0.452501</td>
<td>0.355225</td>
<td>NaN</td>
<td>-0.260674</td>
<td>0.182351</td>
<td>26</td>
<td>0.085867</td>
<td>0.950889</td>
<td>1.054430</td>
<td>0.137862</td>
<td>0.123670</td>
<td>22</td>
<td>0.261521</td>
<td>1.94444</td>
<td>False</td>
<td>0.240819</td>
<td>18</td>
<td>0.182280</td>
<td>17</td>
<td>2026-03-04 22:40:25.489180</td>
<td>73.253333</td>
<td>68.983556</td>
<td>103066501120</td>
<td>0.020174</td>
<td>UNICREDIT</td>
<td>Italy</td>
<td>68.790</td>
<td>0.027483</td>
<td>-0.072161</td>
<td>-0.030034</td>
<td>EUR</td>
</tr>
<tr>
<th>20</th>
<td>175</td>
<td>euro_stoxx_50</td>
<td>INGA.AS</td>
<td>2026-03-04</td>
<td>Financial Services</td>
<td>0.379917</td>
<td>0.727879</td>
<td>NaN</td>
<td>-0.240509</td>
<td>0.289096</td>
<td>21</td>
<td>0.113086</td>
<td>0.946227</td>
<td>1.070815</td>
<td>0.118737</td>
<td>0.192271</td>
<td>21</td>
<td>0.201459</td>
<td>2.10526</td>
<td>False</td>
<td>-0.145505</td>
<td>30</td>
<td>0.111954</td>
<td>21</td>
<td>2026-03-04 22:40:25.489180</td>
<td>24.766000</td>
<td>23.632333</td>
<td>67454382080</td>
<td>0.013204</td>
<td>ING GROEP N.V.</td>
<td>Netherlands</td>
<td>23.305</td>
<td>0.018798</td>
<td>-0.066867</td>
<td>-0.029363</td>
<td>EUR</td>
</tr>
</tbody>
</table>

```python
# Rows where a column is NOT null
scores_pd[scores_pd["ev_ebitda_zscore"].notna()].head()
```

<table>
<thead>
<tr>
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
</tr>
<tr>
<th>5</th>
<td>196</td>
<td>euro_stoxx_50</td>
<td>VOW.DE</td>
<td>2026-03-04</td>
<td>Consumer Cyclical</td>
<td>1.166221</td>
<td>0.940273</td>
<td>0.379830</td>
<td>1.528891</td>
<td>1.003804</td>
<td>2</td>
<td>-0.292748</td>
<td>0.929392</td>
<td>0.969628</td>
<td>0.180805</td>
<td>-0.411969</td>
<td>37</td>
<td>0.297071</td>
<td>NaN</td>
<td>False</td>
<td>0.555357</td>
<td>12</td>
<td>0.382397</td>
<td>6</td>
<td>2026-03-04 22:40:25.489180</td>
<td>102.286667</td>
<td>101.225556</td>
<td>47923826688</td>
<td>0.009381</td>
<td>VOLKSWAGEN AG</td>
<td>Germany</td>
<td>95.600</td>
<td>0.013786</td>
<td>-0.048756</td>
<td>-0.090390</td>
<td>EUR</td>
</tr>
</tbody>
</table>

#### Polars | Null / NaN Filtering

- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

_Filters `scores_pl` to null rows with `.is_null()` and non-null rows with `.is_not_null()` on `ev_ebitda_zscore` — the Polars equivalents of Pandas `.isna()` / `.notna()`, confirming the same financial institutions are identified as lacking EV/EBITDA data._

```python
scores_pl.filter(pl.col("ev_ebitda_zscore").is_null()).head()
```

<div><!-- shape: (5, 36) --><table><thead><tr><th>id</th><th>_index</th><th>symbol</th><th>score_date</th><th>sector</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>relative_value_rank</th><th>relative_strength</th><th>sma_50_ratio</th><th>sma_200_ratio</th><th>dist_from_52w_high</th><th>momentum_score</th><th>momentum_rank</th><th>implied_upside</th><th>recommendation_mean</th><th>price_falling_analysts_bullish</th><th>sentiment_score</th><th>sentiment_rank</th><th>composite_score</th><th>composite_rank</th><th>_scored_at</th><th>sma_30_close</th><th>sma_90_close</th><th>market_cap</th><th>index_weight</th><th>short_name</th><th>country</th><th>current_price</th><th>day_change_pct</th><th>five_day_change_pct</th><th>ytd_change_pct</th><th>currency</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>date</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td><td>f64</td><td>i64</td><td>f64</td><td>i64</td><td>datetime[ns]</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>163</td><td>euro_stoxx_50</td><td>BNP.PA</td><td>2026-03-04</td><td>Financial Services</td><td>0.913389</td><td>1.26114</td><td>null</td><td>2.388962</td><td>1.521163</td><td>1</td><td>0.016123</td><td>1.00909</td><td>1.130264</td><td>0.082486</td><td>0.477966</td><td>16</td><td>0.153157</td><td>1.84211</td><td>false</td><td>0.052711</td><td>25</td><td>0.683947</td><td>1</td><td>2026-03-04 22:40:25.489180</td><td>92.085</td><td>81.181889</td><td>99751215104</td><td>0.019525</td><td>BNP PARIBAS ACT.A</td><td>France</td><td>89.32</td><td>0.011437</td><td>-0.073156</td><td>0.105582</td><td>EUR</td></tr><tr><td>188</td><td>euro_stoxx_50</td><td>SAN.MC</td><td>2026-03-04</td><td>Financial Services</td><td>0.458599</td><td>0.499398</td><td>null</td><td>-1.10759</td><td>-0.049864</td><td>33</td><td>0.393197</td><td>0.953824</td><td>1.139519</td><td>0.113499</td><td>0.519307</td><td>14</td><td>0.224704</td><td>1.7</td><td>false</td><td>0.448776</td><td>15</td><td>0.306073</td><td>9</td><td>2026-03-04 22:40:25.489180</td><td>10.6049</td><td>9.9195</td><td>145955749888</td><td>0.02857</td><td>BANCO SANTANDER S.A.</td><td>Spain</td><td>9.982</td><td>0.038818</td><td>-0.105876</td><td>-0.008739</td><td>EUR</td></tr><tr><td>176</td><td>euro_stoxx_50</td><td>ISP.MI</td><td>2026-03-04</td><td>Financial Services</td><td>0.366619</td><td>0.488302</td><td>null</td><td>0.723361</td><td>0.526094</td><td>13</td><td>-0.065247</td><td>0.922492</td><td>0.990855</td><td>0.119662</td><td>-0.122626</td><td>33</td><td>0.25415</td><td>2.0</td><td>false</td><td>0.146959</td><td>21</td><td>0.183476</td><td>16</td><td>2026-03-04 22:40:25.489180</td><td>5.834933</td><td>5.769367</td><td>94268317696</td><td>0.018452</td><td>INTESA SANPAOLO</td><td>Italy</td><td>5.422</td><td>0.018216</td><td>-0.067103</td><td>-0.084276</td><td>EUR</td></tr><tr><td>195</td><td>euro_stoxx_50</td><td>UCG.MI</td><td>2026-03-04</td><td>Financial Services</td><td>0.452501</td><td>0.355225</td><td>null</td><td>-0.260674</td><td>0.182351</td><td>26</td><td>0.085867</td><td>0.950889</td><td>1.05443</td><td>0.137862</td><td>0.12367</td><td>22</td><td>0.261521</td><td>1.94444</td><td>false</td><td>0.240819</td><td>18</td><td>0.18228</td><td>17</td><td>2026-03-04 22:40:25.489180</td><td>73.253333</td><td>68.983556</td><td>103066501120</td><td>0.020174</td><td>UNICREDIT</td><td>Italy</td><td>68.79</td><td>0.027483</td><td>-0.072161</td><td>-0.030034</td><td>EUR</td></tr><tr><td>175</td><td>euro_stoxx_50</td><td>INGA.AS</td><td>2026-03-04</td><td>Financial Services</td><td>0.379917</td><td>0.727879</td><td>null</td><td>-0.240509</td><td>0.289096</td><td>21</td><td>0.113086</td><td>0.946227</td><td>1.070815</td><td>0.118737</td><td>0.192271</td><td>21</td><td>0.201459</td><td>2.10526</td><td>false</td><td>-0.145505</td><td>30</td><td>0.111954</td><td>21</td><td>2026-03-04 22:40:25.489180</td><td>24.766</td><td>23.632333</td><td>67454382080</td><td>0.013204</td><td>ING GROEP N.V.</td><td>Netherlands</td><td>23.305</td><td>0.018798</td><td>-0.066867</td><td>-0.029363</td><td>EUR</td></tr></tbody></table></div>

```python
scores_pl.filter(pl.col("ev_ebitda_zscore").is_not_null()).head()
```

<div><!-- shape: (5, 36) --><table><thead><tr><th>id</th><th>_index</th><th>symbol</th><th>score_date</th><th>sector</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>relative_value_rank</th><th>relative_strength</th><th>sma_50_ratio</th><th>sma_200_ratio</th><th>dist_from_52w_high</th><th>momentum_score</th><th>momentum_rank</th><th>implied_upside</th><th>recommendation_mean</th><th>price_falling_analysts_bullish</th><th>sentiment_score</th><th>sentiment_rank</th><th>composite_score</th><th>composite_rank</th><th>_scored_at</th><th>sma_30_close</th><th>sma_90_close</th><th>market_cap</th><th>index_weight</th><th>short_name</th><th>country</th><th>current_price</th><th>day_change_pct</th><th>five_day_change_pct</th><th>ytd_change_pct</th><th>currency</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>date</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td><td>f64</td><td>i64</td><td>f64</td><td>i64</td><td>datetime[ns]</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>168</td><td>euro_stoxx_50</td><td>DTE.DE</td><td>2026-03-04</td><td>Communication Services</td><td>0.326587</td><td>0.387463</td><td>0.379532</td><td>-0.127867</td><td>0.241429</td><td>24</td><td>-0.205598</td><td>1.12065</td><td>1.112416</td><td>0.055524</td><td>0.685752</td><td>8</td><td>0.121212</td><td>1.33333</td><td>false</td><td>0.617835</td><td>10</td><td>0.515005</td><td>2</td><td>2026-03-04 22:40:25.489180</td><td>30.838</td><td>28.554556</td><td>164294311936</td><td>0.032159</td><td>DEUTSCHE TELEKOM AG</td><td>Germany</td><td>33.0</td><td>0.011649</td><td>-0.019608</td><td>0.193059</td><td>EUR</td></tr><tr><td>174</td><td>euro_stoxx_50</td><td>IFX.DE</td><td>2026-03-04</td><td>Technology</td><td>0.509398</td><td>0.637215</td><td>0.677068</td><td>-0.696662</td><td>0.281755</td><td>22</td><td>0.000965</td><td>1.048244</td><td>1.198626</td><td>0.088845</td><td>0.675764</td><td>9</td><td>0.126408</td><td>1.375</td><td>false</td><td>0.579187</td><td>11</td><td>0.512235</td><td>3</td><td>2026-03-04 22:40:25.489180</td><td>43.480333</td><td>38.855556</td><td>57222533120</td><td>0.011201</td><td>INFINEON TECHNOLOGIES AG</td><td>Germany</td><td>43.945</td><td>0.054343</td><td>-0.06649</td><td>0.164723</td><td>EUR</td></tr><tr><td>172</td><td>euro_stoxx_50</td><td>ENR.DE</td><td>2026-03-04</td><td>Industrials</td><td>-0.902738</td><td>-0.743338</td><td>-1.693212</td><td>-1.326075</td><td>-1.166341</td><td>46</td><td>1.645455</td><td>1.137007</td><td>1.474095</td><td>0.05185</td><td>2.541889</td><td>1</td><td>0.075269</td><td>1.8</td><td>false</td><td>-0.123264</td><td>29</td><td>0.417428</td><td>4</td><td>2026-03-04 22:40:25.489180</td><td>155.675</td><td>129.122</td><td>139207262208</td><td>0.027249</td><td>Siemens Energy AG</td><td>Germany</td><td>162.75</td><td>0.047297</td><td>-0.039256</td><td>0.351744</td><td>EUR</td></tr><tr><td>149</td><td>euro_stoxx_50</td><td>ABI.BR</td><td>2026-03-04</td><td>Consumer Defensive</td><td>0.474084</td><td>0.844075</td><td>0.552739</td><td>-0.975005</td><td>0.223973</td><td>25</td><td>-0.029791</td><td>1.058542</td><td>1.142783</td><td>0.063063</td><td>0.651891</td><td>10</td><td>0.186198</td><td>1.69231</td><td>false</td><td>0.344755</td><td>17</td><td>0.406873</td><td>5</td><td>2026-03-04 22:40:25.489180</td><td>64.342</td><td>57.869333</td><td>125566156800</td><td>0.024579</td><td>AB INBEV</td><td>Belgium</td><td>64.48</td><td>-0.017073</td><td>-0.040762</td><td>0.174499</td><td>EUR</td></tr><tr><td>196</td><td>euro_stoxx_50</td><td>VOW.DE</td><td>2026-03-04</td><td>Consumer Cyclical</td><td>1.166221</td><td>0.940273</td><td>0.37983</td><td>1.528891</td><td>1.003804</td><td>2</td><td>-0.292748</td><td>0.929392</td><td>0.969628</td><td>0.180805</td><td>-0.411969</td><td>37</td><td>0.297071</td><td>null</td><td>false</td><td>0.555357</td><td>12</td><td>0.382397</td><td>6</td><td>2026-03-04 22:40:25.489180</td><td>102.286667</td><td>101.225556</td><td>47923826688</td><td>0.009381</td><td>VOLKSWAGEN AG</td><td>Germany</td><td>95.6</td><td>0.013786</td><td>-0.048756</td><td>-0.09039</td><td>EUR</td></tr></tbody></table></div>

---

### where / mask (Pandas) vs when / then / otherwise (Polars)

These do not strictly *filter* rows — they replace values conditionally while keeping all rows.

#### Pandas | where — keep values where True, replace with NaN where False

_Applies `.where()` to the `close` column, keeping the original price where `volume > 1M` and replacing it with NaN otherwise — demonstrating conditional value preservation that retains all rows while masking low-volume prices._

```python
# Keep close where volume > 1M, else NaN
ohlcv_pd["close"].where(ohlcv_pd["volume"] > 1_000_000).head(10)
```

<table>
<thead>
<tr>
<th></th>
<th>close</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>57.21</td>
</tr>
<tr>
<th>1</th>
<td>57.18</td>
</tr>
<tr>
<th>2</th>
<td>58.77</td>
</tr>
<tr>
<th>3</th>
<td>58.40</td>
</tr>
<tr>
<th>4</th>
<td>57.86</td>
</tr>
<tr>
<th>5</th>
<td>56.61</td>
</tr>
<tr>
<th>6</th>
<td>56.51</td>
</tr>
<tr>
<th>7</th>
<td>56.48</td>
</tr>
<tr>
<th>8</th>
<td>56.96</td>
</tr>
<tr>
<th>9</th>
<td>56.74</td>
</tr>
</tbody>
</table>

#### Pandas | mask — opposite of where (replace where True)

_Applies `.mask()` to the `close` column, replacing prices with NaN where `volume > 5M` — the inverse of `.where()`, masking out high-volume spikes rather than preserving low-volume entries._

```python
# Replace close with NaN where volume > 5M
ohlcv_pd["close"].mask(ohlcv_pd["volume"] > 5_000_000).head(10)
```

<table>
<thead>
<tr>
<th></th>
<th>close</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>57.21</td>
</tr>
<tr>
<th>1</th>
<td>57.18</td>
</tr>
<tr>
<th>2</th>
<td>58.77</td>
</tr>
<tr>
<th>3</th>
<td>58.40</td>
</tr>
<tr>
<th>4</th>
<td>57.86</td>
</tr>
<tr>
<th>5</th>
<td>56.61</td>
</tr>
<tr>
<th>6</th>
<td>56.51</td>
</tr>
<tr>
<th>7</th>
<td>56.48</td>
</tr>
<tr>
<th>8</th>
<td>56.96</td>
</tr>
<tr>
<th>9</th>
<td>56.74</td>
</tr>
</tbody>
</table>

#### Polars | when / then / otherwise

- **With Columns**: Add new columns or replace existing ones. All original columns are kept.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.
- **pl.lit**: Create a constant/literal value as an expression.

_Creates a `close_filtered` column keeping `close` where `volume > 1M` and `None` otherwise, then chains multiple `when/then` to bucket prices into "high", "mid", or "low" — both computed as new columns via `with_columns()` without dropping any rows._

```python
ohlcv_pl.with_columns(
    pl.when(pl.col("volume") > 1_000_000)
      .then(pl.col("close"))
      .otherwise(pl.lit(None))
      .alias("close_filtered")
).select("symbol", "date", "close", "volume", "close_filtered").head(10)
```

<div><!-- shape: (10, 5) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th><th>close_filtered</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>i64</td><td>f64</td></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>1513937</td><td>57.21</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>1382722</td><td>57.18</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>1370204</td><td>58.77</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>1469911</td><td>58.4</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>1428681</td><td>57.86</td></tr><tr><td>ABI.BR</td><td>2021-01-11</td><td>56.61</td><td>1518079</td><td>56.61</td></tr><tr><td>ABI.BR</td><td>2021-01-12</td><td>56.51</td><td>1649991</td><td>56.51</td></tr><tr><td>ABI.BR</td><td>2021-01-13</td><td>56.48</td><td>1090806</td><td>56.48</td></tr><tr><td>ABI.BR</td><td>2021-01-14</td><td>56.96</td><td>1523045</td><td>56.96</td></tr><tr><td>ABI.BR</td><td>2021-01-15</td><td>56.74</td><td>1769988</td><td>56.74</td></tr></tbody></table></div>

```python
# Multiple conditions with when/then chaining (Polars)
ohlcv_pl.with_columns(
    pl.when(pl.col("close") > 100)
      .then(pl.lit("high"))
      .when(pl.col("close") > 50)
      .then(pl.lit("mid"))
      .otherwise(pl.lit("low"))
      .alias("price_bucket")
).select("symbol", "date", "close", "price_bucket").head(10)
```

<div><!-- shape: (10, 4) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>price_bucket</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>mid</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>mid</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>mid</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>mid</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>mid</td></tr><tr><td>ABI.BR</td><td>2021-01-11</td><td>56.61</td><td>mid</td></tr><tr><td>ABI.BR</td><td>2021-01-12</td><td>56.51</td><td>mid</td></tr><tr><td>ABI.BR</td><td>2021-01-13</td><td>56.48</td><td>mid</td></tr><tr><td>ABI.BR</td><td>2021-01-14</td><td>56.96</td><td>mid</td></tr><tr><td>ABI.BR</td><td>2021-01-15</td><td>56.74</td><td>mid</td></tr></tbody></table></div>

---

### String Accessor Filtering

#### Pandas | String Accessor Filtering — .str

- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.

_Filters `ohlcv_pd` via the `.str` accessor: first to tickers starting with "S" using `.str.startswith()` (e.g., SAF.PA, SAP.DE, SAN.MC), then to tickers containing "DE" using `.str.contains()` — selecting German-exchange stocks by exchange suffix._

```python
# Tickers that start with "S"
ohlcv_pd[ohlcv_pd["symbol"].str.startswith("S")].head()
```

<table>
<thead>
<tr>
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
<th>51747</th>
<td>18512</td>
<td>SAF.PA</td>
<td>2021-01-04</td>
<td>117.35</td>
<td>121.00</td>
<td>116.1</td>
<td>116.15</td>
<td>111.6447</td>
<td>658764</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>51748</th>
<td>18513</td>
<td>SAF.PA</td>
<td>2021-01-05</td>
<td>114.90</td>
<td>116.95</td>
<td>114.8</td>
<td>116.40</td>
<td>111.8850</td>
<td>588765</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>51749</th>
<td>18514</td>
<td>SAF.PA</td>
<td>2021-01-06</td>
<td>117.55</td>
<td>117.55</td>
<td>115.4</td>
<td>116.30</td>
<td>111.7888</td>
<td>581543</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>51750</th>
<td>18515</td>
<td>SAF.PA</td>
<td>2021-01-07</td>
<td>117.05</td>
<td>117.30</td>
<td>114.8</td>
<td>115.80</td>
<td>111.3082</td>
<td>635605</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>51751</th>
<td>18516</td>
<td>SAF.PA</td>
<td>2021-01-08</td>
<td>116.90</td>
<td>117.00</td>
<td>115.0</td>
<td>116.35</td>
<td>111.8369</td>
<td>688460</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

```python
# Tickers containing "DE"
ohlcv_pd[ohlcv_pd["symbol"].str.contains("DE")].head()
```

<table>
<thead>
<tr>
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
<th>2662</th>
<td>62088</td>
<td>ADS.DE</td>
<td>2021-01-04</td>
<td>300.0</td>
<td>300.5</td>
<td>293.0</td>
<td>295.4</td>
<td>282.2904</td>
<td>440364</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>2663</th>
<td>62089</td>
<td>ADS.DE</td>
<td>2021-01-05</td>
<td>292.9</td>
<td>295.4</td>
<td>288.2</td>
<td>289.6</td>
<td>276.7479</td>
<td>436591</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>2664</th>
<td>62090</td>
<td>ADS.DE</td>
<td>2021-01-06</td>
<td>290.7</td>
<td>292.7</td>
<td>286.8</td>
<td>291.7</td>
<td>278.7546</td>
<td>392602</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>2665</th>
<td>62091</td>
<td>ADS.DE</td>
<td>2021-01-07</td>
<td>294.0</td>
<td>294.1</td>
<td>288.5</td>
<td>288.5</td>
<td>275.6967</td>
<td>362809</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>2666</th>
<td>62092</td>
<td>ADS.DE</td>
<td>2021-01-08</td>
<td>292.3</td>
<td>296.8</td>
<td>292.0</td>
<td>295.1</td>
<td>282.0038</td>
<td>425762</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

#### Polars | String Accessor Filtering — .str

- **String Ops**: Text manipulation via .str accessor: contains, split, replace, extract.
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

_Applies the same string filters as the Pandas example using `str.starts_with()` and `str.contains()` inside `pl.col(...).filter()` — note `starts_with` (no underscore) vs Pandas' `startswith`, returning identical ticker subsets._

```python
ohlcv_pl.filter(pl.col("symbol").str.starts_with("S")).head()
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>18512</td><td>SAF.PA</td><td>2021-01-04</td><td>117.35</td><td>121.0</td><td>116.1</td><td>116.15</td><td>111.6447</td><td>658764</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>18513</td><td>SAF.PA</td><td>2021-01-05</td><td>114.9</td><td>116.95</td><td>114.8</td><td>116.4</td><td>111.885</td><td>588765</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>18514</td><td>SAF.PA</td><td>2021-01-06</td><td>117.55</td><td>117.55</td><td>115.4</td><td>116.3</td><td>111.7888</td><td>581543</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>18515</td><td>SAF.PA</td><td>2021-01-07</td><td>117.05</td><td>117.3</td><td>114.8</td><td>115.8</td><td>111.3082</td><td>635605</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>18516</td><td>SAF.PA</td><td>2021-01-08</td><td>116.9</td><td>117.0</td><td>115.0</td><td>116.35</td><td>111.8369</td><td>688460</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
ohlcv_pl.filter(pl.col("symbol").str.contains("DE")).head()
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>62088</td><td>ADS.DE</td><td>2021-01-04</td><td>300.0</td><td>300.5</td><td>293.0</td><td>295.4</td><td>282.2904</td><td>440364</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>62089</td><td>ADS.DE</td><td>2021-01-05</td><td>292.9</td><td>295.4</td><td>288.2</td><td>289.6</td><td>276.7479</td><td>436591</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>62090</td><td>ADS.DE</td><td>2021-01-06</td><td>290.7</td><td>292.7</td><td>286.8</td><td>291.7</td><td>278.7546</td><td>392602</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>62091</td><td>ADS.DE</td><td>2021-01-07</td><td>294.0</td><td>294.1</td><td>288.5</td><td>288.5</td><td>275.6967</td><td>362809</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>62092</td><td>ADS.DE</td><td>2021-01-08</td><td>292.3</td><td>296.8</td><td>292.0</td><td>295.1</td><td>282.0038</td><td>425762</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

---

### Datetime Accessor Filtering

#### Pandas | Datetime Accessor Filtering — .dt

- **DateTime Accessor**: Extract date parts: .dt.year(), .dt.month(), .dt.weekday().
- **Parse Dates**: Convert strings to datetime objects (Pandas).

_Converts the `date` column to datetime with `pd.to_datetime()` (required in Pandas before `.dt` access), then filters to January rows using `.dt.month == 1` — demonstrating date-part extraction for seasonal or calendar-based filtering._

```python
# Ensure date is datetime
ohlcv_pd["date"] = pd.to_datetime(ohlcv_pd["date"])

# Filter rows in January
ohlcv_pd[ohlcv_pd["date"].dt.month == 1].head()
```

<table>
<thead>
<tr>
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
</tr>
</tbody>
</table>

```python
# Filter by year
ohlcv_pd[ohlcv_pd["date"].dt.year == 2023].head()
```

<table>
<thead>
<tr>
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
<th>515</th>
<td>21675</td>
<td>ABI.BR</td>
<td>2023-01-02</td>
<td>56.63</td>
<td>57.09</td>
<td>56.43</td>
<td>56.90</td>
<td>54.2453</td>
<td>608437</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>516</th>
<td>21676</td>
<td>ABI.BR</td>
<td>2023-01-03</td>
<td>56.79</td>
<td>57.76</td>
<td>56.72</td>
<td>56.84</td>
<td>54.1881</td>
<td>1164809</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>517</th>
<td>21677</td>
<td>ABI.BR</td>
<td>2023-01-04</td>
<td>56.96</td>
<td>58.02</td>
<td>56.94</td>
<td>58.02</td>
<td>55.3130</td>
<td>1835512</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>518</th>
<td>21678</td>
<td>ABI.BR</td>
<td>2023-01-05</td>
<td>57.69</td>
<td>57.98</td>
<td>57.00</td>
<td>57.14</td>
<td>54.4741</td>
<td>1324250</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>519</th>
<td>21679</td>
<td>ABI.BR</td>
<td>2023-01-06</td>
<td>57.23</td>
<td>57.47</td>
<td>57.03</td>
<td>57.44</td>
<td>54.7601</td>
<td>1100010</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

```python
# Filter by day of week (Monday=0)
ohlcv_pd[ohlcv_pd["date"].dt.dayofweek == 0].head()
```

<table>
<thead>
<tr>
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
<th>5</th>
<td>21165</td>
<td>ABI.BR</td>
<td>2021-01-11</td>
<td>57.73</td>
<td>57.81</td>
<td>56.39</td>
<td>56.61</td>
<td>53.0142</td>
<td>1518079</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>10</th>
<td>21170</td>
<td>ABI.BR</td>
<td>2021-01-18</td>
<td>56.25</td>
<td>57.30</td>
<td>56.20</td>
<td>57.08</td>
<td>53.4544</td>
<td>730298</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>15</th>
<td>21175</td>
<td>ABI.BR</td>
<td>2021-01-25</td>
<td>54.77</td>
<td>54.80</td>
<td>52.89</td>
<td>53.17</td>
<td>49.7927</td>
<td>1974547</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>20</th>
<td>21180</td>
<td>ABI.BR</td>
<td>2021-02-01</td>
<td>52.32</td>
<td>53.30</td>
<td>52.15</td>
<td>52.58</td>
<td>49.2402</td>
<td>1543605</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

#### Polars | Datetime Accessor Filtering — .dt

- **DateTime Accessor**: Extract date parts: .dt.year(), .dt.month(), .dt.weekday().
- **pl.col**: Reference a column by name. The foundation of all Polars expressions.

_Filters `ohlcv_pl` by month (January), year (2023), and weekday (Monday = 1 in Polars) using `pl.col("date").dt.method()` — note Polars requires function-call syntax (`.dt.month()`) where Pandas uses attribute access (`.dt.month`)._

```python
ohlcv_pl.filter(pl.col("date").dt.month() == 1).head()
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
ohlcv_pl.filter(pl.col("date").dt.year() == 2023).head()
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21675</td><td>ABI.BR</td><td>2023-01-02</td><td>56.63</td><td>57.09</td><td>56.43</td><td>56.9</td><td>54.2453</td><td>608437</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21676</td><td>ABI.BR</td><td>2023-01-03</td><td>56.79</td><td>57.76</td><td>56.72</td><td>56.84</td><td>54.1881</td><td>1164809</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21677</td><td>ABI.BR</td><td>2023-01-04</td><td>56.96</td><td>58.02</td><td>56.94</td><td>58.02</td><td>55.313</td><td>1835512</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21678</td><td>ABI.BR</td><td>2023-01-05</td><td>57.69</td><td>57.98</td><td>57.0</td><td>57.14</td><td>54.4741</td><td>1324250</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21679</td><td>ABI.BR</td><td>2023-01-06</td><td>57.23</td><td>57.47</td><td>57.03</td><td>57.44</td><td>54.7601</td><td>1100010</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
ohlcv_pl.filter(pl.col("date").dt.weekday() == 1).head()  # Monday=1 in Polars
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21165</td><td>ABI.BR</td><td>2021-01-11</td><td>57.73</td><td>57.81</td><td>56.39</td><td>56.61</td><td>53.0142</td><td>1518079</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21170</td><td>ABI.BR</td><td>2021-01-18</td><td>56.25</td><td>57.3</td><td>56.2</td><td>57.08</td><td>53.4544</td><td>730298</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21175</td><td>ABI.BR</td><td>2021-01-25</td><td>54.77</td><td>54.8</td><td>52.89</td><td>53.17</td><td>49.7927</td><td>1974547</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21180</td><td>ABI.BR</td><td>2021-02-01</td><td>52.32</td><td>53.3</td><td>52.15</td><td>52.58</td><td>49.2402</td><td>1543605</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

---

### head, tail, slice, sample

```python
# Pandas
print("head(3):\n", ohlcv_pd.head(3), "\n")
print("tail(3):\n", ohlcv_pd.tail(3))
```

head(3):
           id  symbol       date   open   high    low  close  adj_close   volume  \
    0  21160  ABI.BR 2021-01-04  58.15  58.85  56.78  57.21    53.5761  1513937
    1  21161  ABI.BR 2021-01-05  56.90  57.98  56.75  57.18    53.5480  1382722
    2  21162  ABI.BR 2021-01-06  57.96  58.94  57.39  58.77    55.0370  1370204

dividends  stock_splits  is_filled
    0        0.0           0.0      False
    1        0.0           0.0      False
    2        0.0           0.0      False

tail(3):
               id  symbol       date  open   high    low  close  adj_close  \
    66352  66876  WKL.AS 2026-03-10  68.8  69.16  66.34  67.16      67.16
    66353  66877  WKL.AS 2026-03-11  67.5  69.60  67.02  67.22      67.22
    66354  66929  WKL.AS 2026-03-12  67.0  67.54  66.28  67.32      67.32

volume  dividends  stock_splits  is_filled
    66352  1355645        0.0           0.0      False
    66353  1142531        0.0           0.0      False
    66354   210379        0.0           0.0      False

```python
# Pandas — iloc slicing
ohlcv_pd.iloc[10:15]
```

<table>
<thead>
<tr>
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
<th>10</th>
<td>21170</td>
<td>ABI.BR</td>
<td>2021-01-18</td>
<td>56.25</td>
<td>57.30</td>
<td>56.20</td>
<td>57.08</td>
<td>53.4544</td>
<td>730298</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>11</th>
<td>21171</td>
<td>ABI.BR</td>
<td>2021-01-19</td>
<td>57.10</td>
<td>57.26</td>
<td>56.26</td>
<td>56.35</td>
<td>52.7707</td>
<td>1116570</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>12</th>
<td>21172</td>
<td>ABI.BR</td>
<td>2021-01-20</td>
<td>56.35</td>
<td>56.77</td>
<td>56.00</td>
<td>56.24</td>
<td>52.6677</td>
<td>1226516</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>13</th>
<td>21173</td>
<td>ABI.BR</td>
<td>2021-01-21</td>
<td>56.20</td>
<td>56.55</td>
<td>55.31</td>
<td>55.31</td>
<td>51.7968</td>
<td>1404283</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>14</th>
<td>21174</td>
<td>ABI.BR</td>
<td>2021-01-22</td>
<td>55.28</td>
<td>55.28</td>
<td>54.12</td>
<td>54.78</td>
<td>51.3005</td>
<td>1557287</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

```python
# Pandas — sample
ohlcv_pd.sample(5, random_state=42)
```

<table>
<thead>
<tr>
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
<th>43053</th>
<td>38920</td>
<td>MUV2.DE</td>
<td>2023-03-29</td>
<td>320.0000</td>
<td>322.600</td>
<td>318.400</td>
<td>322.4000</td>
<td>290.3200</td>
<td>195809</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>56209</th>
<td>5772</td>
<td>SAP.DE</td>
<td>2022-11-03</td>
<td>95.9200</td>
<td>96.340</td>
<td>95.080</td>
<td>95.5100</td>
<td>91.9052</td>
<td>1424973</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>53515</th>
<td>11015</td>
<td>SAN.MC</td>
<td>2022-09-15</td>
<td>2.5975</td>
<td>2.686</td>
<td>2.597</td>
<td>2.6765</td>
<td>2.3373</td>
<td>70158349</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>6498</th>
<td>28954</td>
<td>AI.PA</td>
<td>2025-08-12</td>
<td>173.3200</td>
<td>174.440</td>
<td>172.800</td>
<td>173.6800</td>
<td>173.6800</td>
<td>415652</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>63527</th>
<td>24956</td>
<td>UCG.MI</td>
<td>2025-07-07</td>
<td>56.4600</td>
<td>57.350</td>
<td>56.440</td>
<td>57.3500</td>
<td>56.0468</td>
<td>4705567</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

```python
# Polars
ohlcv_pl.head(3)
```

<div><!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
ohlcv_pl.tail(3)
```

<div><!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>66876</td><td>WKL.AS</td><td>2026-03-10</td><td>68.8</td><td>69.16</td><td>66.34</td><td>67.16</td><td>67.16</td><td>1355645</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>66877</td><td>WKL.AS</td><td>2026-03-11</td><td>67.5</td><td>69.6</td><td>67.02</td><td>67.22</td><td>67.22</td><td>1142531</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>66929</td><td>WKL.AS</td><td>2026-03-12</td><td>67.0</td><td>67.54</td><td>66.28</td><td>67.32</td><td>67.32</td><td>210379</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
ohlcv_pl.slice(10, 5)  # offset, length
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21170</td><td>ABI.BR</td><td>2021-01-18</td><td>56.25</td><td>57.3</td><td>56.2</td><td>57.08</td><td>53.4544</td><td>730298</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21171</td><td>ABI.BR</td><td>2021-01-19</td><td>57.1</td><td>57.26</td><td>56.26</td><td>56.35</td><td>52.7707</td><td>1116570</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21172</td><td>ABI.BR</td><td>2021-01-20</td><td>56.35</td><td>56.77</td><td>56.0</td><td>56.24</td><td>52.6677</td><td>1226516</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21173</td><td>ABI.BR</td><td>2021-01-21</td><td>56.2</td><td>56.55</td><td>55.31</td><td>55.31</td><td>51.7968</td><td>1404283</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21174</td><td>ABI.BR</td><td>2021-01-22</td><td>55.28</td><td>55.28</td><td>54.12</td><td>54.78</td><td>51.3005</td><td>1557287</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
ohlcv_pl.sample(5, seed=42)
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>11529</td><td>SAN.MC</td><td>2024-09-18</td><td>4.511</td><td>4.5455</td><td>4.5065</td><td>4.5085</td><td>4.2785</td><td>16487238</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>35604</td><td>CS.PA</td><td>2025-10-14</td><td>39.34</td><td>40.27</td><td>39.25</td><td>40.18</td><td>40.18</td><td>3511125</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>63666</td><td>WKL.AS</td><td>2022-01-05</td><td>102.2</td><td>102.65</td><td>101.25</td><td>101.8</td><td>95.254</td><td>230509</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>33136</td><td>PRX.AS</td><td>2021-05-03</td><td>41.3654</td><td>41.737</td><td>41.0718</td><td>41.3746</td><td>40.8581</td><td>2177525</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>19417</td><td>SAF.PA</td><td>2024-07-12</td><td>204.2</td><td>204.8</td><td>201.3</td><td>204.8</td><td>202.5157</td><td>496739</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

---

### unique / drop_duplicates / drop_nulls / dropna

```python
# Pandas — unique tickers
ohlcv_pd["symbol"].drop_duplicates().head(10)
```

<table>
<thead>
<tr>
<th></th>
<th>symbol</th>
</tr>
</thead>
<tbody>
<tr>
<th>0</th>
<td>ABI.BR</td>
</tr>
<tr>
<th>1331</th>
<td>AD.AS</td>
</tr>
<tr>
<th>2662</th>
<td>ADS.DE</td>
</tr>
<tr>
<th>3986</th>
<td>ADYEN.AS</td>
</tr>
<tr>
<th>5317</th>
<td>AI.PA</td>
</tr>
<tr>
<th>6648</th>
<td>AIR.PA</td>
</tr>
<tr>
<th>7979</th>
<td>ALV.DE</td>
</tr>
<tr>
<th>9303</th>
<td>ARGX.BR</td>
</tr>
<tr>
<th>10634</th>
<td>ASML.AS</td>
</tr>
<tr>
<th>11965</th>
<td>BAS.DE</td>
</tr>
</tbody>
</table>

```python
# Pandas — drop_duplicates on subset
ohlcv_pd.drop_duplicates(subset=["symbol"]).head()
```

<table>
<thead>
<tr>
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
<td>58.1500</td>
<td>58.8500</td>
<td>56.7800</td>
<td>57.2100</td>
<td>53.5761</td>
<td>1513937</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>1331</th>
<td>59438</td>
<td>AD.AS</td>
<td>2021-01-04</td>
<td>23.3800</td>
<td>23.8300</td>
<td>23.3800</td>
<td>23.7900</td>
<td>19.9339</td>
<td>3526165</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>2662</th>
<td>62088</td>
<td>ADS.DE</td>
<td>2021-01-04</td>
<td>300.0000</td>
<td>300.5000</td>
<td>293.0000</td>
<td>295.4000</td>
<td>282.2904</td>
<td>440364</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>3986</th>
<td>60763</td>
<td>ADYEN.AS</td>
<td>2021-01-04</td>
<td>1900.0000</td>
<td>1921.5000</td>
<td>1856.0000</td>
<td>1859.5000</td>
<td>1859.5000</td>
<td>99408</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>5317</th>
<td>27773</td>
<td>AI.PA</td>
<td>2021-01-04</td>
<td>112.3554</td>
<td>113.6364</td>
<td>111.9835</td>
<td>112.7686</td>
<td>102.9625</td>
<td>917982</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

```python
# Pandas — dropna
scores_pd.dropna(subset=["ev_ebitda_zscore"]).head()
```

<table>
<thead>
<tr>
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
</tr>
<tr>
<th>5</th>
<td>196</td>
<td>euro_stoxx_50</td>
<td>VOW.DE</td>
<td>2026-03-04</td>
<td>Consumer Cyclical</td>
<td>1.166221</td>
<td>0.940273</td>
<td>0.379830</td>
<td>1.528891</td>
<td>1.003804</td>
<td>2</td>
<td>-0.292748</td>
<td>0.929392</td>
<td>0.969628</td>
<td>0.180805</td>
<td>-0.411969</td>
<td>37</td>
<td>0.297071</td>
<td>NaN</td>
<td>False</td>
<td>0.555357</td>
<td>12</td>
<td>0.382397</td>
<td>6</td>
<td>2026-03-04 22:40:25.489180</td>
<td>102.286667</td>
<td>101.225556</td>
<td>47923826688</td>
<td>0.009381</td>
<td>VOLKSWAGEN AG</td>
<td>Germany</td>
<td>95.600</td>
<td>0.013786</td>
<td>-0.048756</td>
<td>-0.090390</td>
<td>EUR</td>
</tr>
</tbody>
</table>

```python
# Polars — unique
ohlcv_pl.select("symbol").unique().head(10)
```

<div><!-- shape: (10, 1) --><table><thead><tr><th>symbol</th></tr><tr><td>str</td></tr></thead><tbody><tr><td>ARGX.BR</td></tr><tr><td>OR.PA</td></tr><tr><td>IBE.MC</td></tr><tr><td>ADYEN.AS</td></tr><tr><td>ENI.MI</td></tr><tr><td>BAYN.DE</td></tr><tr><td>IFX.DE</td></tr><tr><td>BNP.PA</td></tr><tr><td>DSY.PA</td></tr><tr><td>ENEL.MI</td></tr></tbody></table></div>

```python
# Polars — unique on subset
ohlcv_pl.unique(subset=["symbol"]).head()
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>17194</td><td>ENR.DE</td><td>2021-01-04</td><td>30.62</td><td>31.2</td><td>29.91</td><td>30.13</td><td>29.8481</td><td>1693265</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>1</td><td>ASML.AS</td><td>2021-01-04</td><td>404.0</td><td>411.0</td><td>402.25</td><td>406.25</td><td>387.709</td><td>789502</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>63406</td><td>WKL.AS</td><td>2021-01-04</td><td>69.78</td><td>71.3</td><td>69.76</td><td>70.86</td><td>65.1785</td><td>516176</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>42307</td><td>ENI.MI</td><td>2021-01-04</td><td>8.604</td><td>8.756</td><td>8.397</td><td>8.448</td><td>6.0466</td><td>19734004</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>19837</td><td>IBE.MC</td><td>2021-01-04</td><td>11.8</td><td>11.945</td><td>11.79</td><td>11.905</td><td>9.4733</td><td>14213672</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
# Polars — drop_nulls
scores_pl.drop_nulls(subset=["ev_ebitda_zscore"]).head()
```

<div><!-- shape: (5, 36) --><table><thead><tr><th>id</th><th>_index</th><th>symbol</th><th>score_date</th><th>sector</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>relative_value_rank</th><th>relative_strength</th><th>sma_50_ratio</th><th>sma_200_ratio</th><th>dist_from_52w_high</th><th>momentum_score</th><th>momentum_rank</th><th>implied_upside</th><th>recommendation_mean</th><th>price_falling_analysts_bullish</th><th>sentiment_score</th><th>sentiment_rank</th><th>composite_score</th><th>composite_rank</th><th>_scored_at</th><th>sma_30_close</th><th>sma_90_close</th><th>market_cap</th><th>index_weight</th><th>short_name</th><th>country</th><th>current_price</th><th>day_change_pct</th><th>five_day_change_pct</th><th>ytd_change_pct</th><th>currency</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>date</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td><td>f64</td><td>i64</td><td>f64</td><td>i64</td><td>datetime[ns]</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>168</td><td>euro_stoxx_50</td><td>DTE.DE</td><td>2026-03-04</td><td>Communication Services</td><td>0.326587</td><td>0.387463</td><td>0.379532</td><td>-0.127867</td><td>0.241429</td><td>24</td><td>-0.205598</td><td>1.12065</td><td>1.112416</td><td>0.055524</td><td>0.685752</td><td>8</td><td>0.121212</td><td>1.33333</td><td>false</td><td>0.617835</td><td>10</td><td>0.515005</td><td>2</td><td>2026-03-04 22:40:25.489180</td><td>30.838</td><td>28.554556</td><td>164294311936</td><td>0.032159</td><td>DEUTSCHE TELEKOM AG</td><td>Germany</td><td>33.0</td><td>0.011649</td><td>-0.019608</td><td>0.193059</td><td>EUR</td></tr><tr><td>174</td><td>euro_stoxx_50</td><td>IFX.DE</td><td>2026-03-04</td><td>Technology</td><td>0.509398</td><td>0.637215</td><td>0.677068</td><td>-0.696662</td><td>0.281755</td><td>22</td><td>0.000965</td><td>1.048244</td><td>1.198626</td><td>0.088845</td><td>0.675764</td><td>9</td><td>0.126408</td><td>1.375</td><td>false</td><td>0.579187</td><td>11</td><td>0.512235</td><td>3</td><td>2026-03-04 22:40:25.489180</td><td>43.480333</td><td>38.855556</td><td>57222533120</td><td>0.011201</td><td>INFINEON TECHNOLOGIES AG</td><td>Germany</td><td>43.945</td><td>0.054343</td><td>-0.06649</td><td>0.164723</td><td>EUR</td></tr><tr><td>172</td><td>euro_stoxx_50</td><td>ENR.DE</td><td>2026-03-04</td><td>Industrials</td><td>-0.902738</td><td>-0.743338</td><td>-1.693212</td><td>-1.326075</td><td>-1.166341</td><td>46</td><td>1.645455</td><td>1.137007</td><td>1.474095</td><td>0.05185</td><td>2.541889</td><td>1</td><td>0.075269</td><td>1.8</td><td>false</td><td>-0.123264</td><td>29</td><td>0.417428</td><td>4</td><td>2026-03-04 22:40:25.489180</td><td>155.675</td><td>129.122</td><td>139207262208</td><td>0.027249</td><td>Siemens Energy AG</td><td>Germany</td><td>162.75</td><td>0.047297</td><td>-0.039256</td><td>0.351744</td><td>EUR</td></tr><tr><td>149</td><td>euro_stoxx_50</td><td>ABI.BR</td><td>2026-03-04</td><td>Consumer Defensive</td><td>0.474084</td><td>0.844075</td><td>0.552739</td><td>-0.975005</td><td>0.223973</td><td>25</td><td>-0.029791</td><td>1.058542</td><td>1.142783</td><td>0.063063</td><td>0.651891</td><td>10</td><td>0.186198</td><td>1.69231</td><td>false</td><td>0.344755</td><td>17</td><td>0.406873</td><td>5</td><td>2026-03-04 22:40:25.489180</td><td>64.342</td><td>57.869333</td><td>125566156800</td><td>0.024579</td><td>AB INBEV</td><td>Belgium</td><td>64.48</td><td>-0.017073</td><td>-0.040762</td><td>0.174499</td><td>EUR</td></tr><tr><td>196</td><td>euro_stoxx_50</td><td>VOW.DE</td><td>2026-03-04</td><td>Consumer Cyclical</td><td>1.166221</td><td>0.940273</td><td>0.37983</td><td>1.528891</td><td>1.003804</td><td>2</td><td>-0.292748</td><td>0.929392</td><td>0.969628</td><td>0.180805</td><td>-0.411969</td><td>37</td><td>0.297071</td><td>null</td><td>false</td><td>0.555357</td><td>12</td><td>0.382397</td><td>6</td><td>2026-03-04 22:40:25.489180</td><td>102.286667</td><td>101.225556</td><td>47923826688</td><td>0.009381</td><td>VOLKSWAGEN AG</td><td>Germany</td><td>95.6</td><td>0.013786</td><td>-0.048756</td><td>-0.09039</td><td>EUR</td></tr></tbody></table></div>

---

### Sorting

#### Pandas | sort_values

_Sorts `ohlcv_pd` by `close` descending to surface the highest-priced OHLCV rows (Hermès RMS.PA at ~2839), then by `["symbol", "date"]` with mixed ascending/descending order to list the most recent date first within each ticker._

```python
ohlcv_pd.sort_values("close", ascending=False).head()
```

<table>
<thead>
<tr>
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
<th>51473</th>
<td>3708</td>
<td>RMS.PA</td>
<td>2025-02-14</td>
<td>2926.0</td>
<td>2957.0</td>
<td>2813.0</td>
<td>2839.0</td>
<td>2802.9382</td>
<td>105651</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>51472</th>
<td>3707</td>
<td>RMS.PA</td>
<td>2025-02-13</td>
<td>2770.0</td>
<td>2816.0</td>
<td>2765.0</td>
<td>2816.0</td>
<td>2780.2302</td>
<td>80087</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>51474</th>
<td>3709</td>
<td>RMS.PA</td>
<td>2025-02-17</td>
<td>2825.0</td>
<td>2858.0</td>
<td>2803.0</td>
<td>2809.0</td>
<td>2776.7424</td>
<td>53852</td>
<td>3.5</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>51475</th>
<td>3710</td>
<td>RMS.PA</td>
<td>2025-02-18</td>
<td>2816.0</td>
<td>2827.0</td>
<td>2780.0</td>
<td>2806.0</td>
<td>2773.7771</td>
<td>65469</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>4150</th>
<td>60927</td>
<td>ADYEN.AS</td>
<td>2021-08-24</td>
<td>2725.0</td>
<td>2766.0</td>
<td>2711.5</td>
<td>2766.0</td>
<td>2766.0000</td>
<td>61431</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

```python
# Multi-column sort
ohlcv_pd.sort_values(["symbol", "date"], ascending=[True, False]).head()
```

<table>
<thead>
<tr>
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
<th>1330</th>
<td>66897</td>
<td>ABI.BR</td>
<td>2026-03-12</td>
<td>62.64</td>
<td>62.96</td>
<td>62.08</td>
<td>62.76</td>
<td>62.76</td>
<td>303648</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>1329</th>
<td>66781</td>
<td>ABI.BR</td>
<td>2026-03-11</td>
<td>62.64</td>
<td>63.38</td>
<td>62.38</td>
<td>62.68</td>
<td>62.68</td>
<td>1679807</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>1328</th>
<td>66780</td>
<td>ABI.BR</td>
<td>2026-03-10</td>
<td>62.74</td>
<td>63.34</td>
<td>62.24</td>
<td>63.32</td>
<td>63.32</td>
<td>1828703</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>1327</th>
<td>66779</td>
<td>ABI.BR</td>
<td>2026-03-09</td>
<td>61.72</td>
<td>62.70</td>
<td>61.50</td>
<td>62.58</td>
<td>62.58</td>
<td>1880254</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
<tr>
<th>1326</th>
<td>64764</td>
<td>ABI.BR</td>
<td>2026-03-06</td>
<td>63.46</td>
<td>63.64</td>
<td>62.32</td>
<td>63.14</td>
<td>63.14</td>
<td>2519869</td>
<td>0.0</td>
<td>0.0</td>
<td>False</td>
</tr>
</tbody>
</table>

#### Polars | sort

_Sorts `ohlcv_pl` by `close` descending, then by `["symbol", "date"]` with mixed directions, and demonstrates `sort_by` inside a `with_columns` / `over` expression to reorder `close` values chronologically within each symbol partition — a pattern useful in group-aware calculations._

```python
ohlcv_pl.sort("close", descending=True).head()
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>3708</td><td>RMS.PA</td><td>2025-02-14</td><td>2926.0</td><td>2957.0</td><td>2813.0</td><td>2839.0</td><td>2802.9382</td><td>105651</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>3707</td><td>RMS.PA</td><td>2025-02-13</td><td>2770.0</td><td>2816.0</td><td>2765.0</td><td>2816.0</td><td>2780.2302</td><td>80087</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>3709</td><td>RMS.PA</td><td>2025-02-17</td><td>2825.0</td><td>2858.0</td><td>2803.0</td><td>2809.0</td><td>2776.7424</td><td>53852</td><td>3.5</td><td>0.0</td><td>false</td></tr><tr><td>3710</td><td>RMS.PA</td><td>2025-02-18</td><td>2816.0</td><td>2827.0</td><td>2780.0</td><td>2806.0</td><td>2773.7771</td><td>65469</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>60927</td><td>ADYEN.AS</td><td>2021-08-24</td><td>2725.0</td><td>2766.0</td><td>2711.5</td><td>2766.0</td><td>2766.0</td><td>61431</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
# Multi-column sort
ohlcv_pl.sort(["symbol", "date"], descending=[False, True]).head()
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>66897</td><td>ABI.BR</td><td>2026-03-12</td><td>62.64</td><td>62.96</td><td>62.08</td><td>62.76</td><td>62.76</td><td>303648</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>66781</td><td>ABI.BR</td><td>2026-03-11</td><td>62.64</td><td>63.38</td><td>62.38</td><td>62.68</td><td>62.68</td><td>1679807</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>66780</td><td>ABI.BR</td><td>2026-03-10</td><td>62.74</td><td>63.34</td><td>62.24</td><td>63.32</td><td>63.32</td><td>1828703</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>66779</td><td>ABI.BR</td><td>2026-03-09</td><td>61.72</td><td>62.7</td><td>61.5</td><td>62.58</td><td>62.58</td><td>1880254</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>64764</td><td>ABI.BR</td><td>2026-03-06</td><td>63.46</td><td>63.64</td><td>62.32</td><td>63.14</td><td>63.14</td><td>2519869</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
# sort_by inside an expression context (useful in group_by)
ohlcv_pl.with_columns(
    pl.col("close").sort_by("date").over("symbol").alias("close_chronological")
).head()
```

<div><!-- shape: (5, 13) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th><th>close_chronological</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td><td>f64</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td><td>57.21</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td><td>57.18</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td><td>58.77</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td><td>58.4</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td><td>57.86</td></tr></tbody></table></div>

---

### Filtering After a Join (Practical Example)

Filter OHLCV data to only include tickers that appear in the dimension table.

```python
# Pandas — semi-join style filter
valid_tickers = dim_pd["symbol"].unique()
ohlcv_pd[ohlcv_pd["symbol"].isin(valid_tickers)].head()
```

<table>
<thead>
<tr>
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
</tr>
</tbody>
</table>

```python
# Polars — semi join
ohlcv_pl.join(dim_pl.select("symbol").unique(), on="symbol", how="semi").head()
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

---

### Filtering scores_daily — Practical Examples

```python
scores_pd.head(3)
```

<table>
<thead>
<tr>
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
# Pandas — top scores
scores_pd[scores_pd["relative_value_score"] > 0.8].head()
```

<table>
<thead>
<tr>
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
<td>89.32</td>
<td>0.011437</td>
<td>-0.073156</td>
<td>0.105582</td>
<td>EUR</td>
</tr>
<tr>
<th>5</th>
<td>196</td>
<td>euro_stoxx_50</td>
<td>VOW.DE</td>
<td>2026-03-04</td>
<td>Consumer Cyclical</td>
<td>1.166221</td>
<td>0.940273</td>
<td>0.379830</td>
<td>1.528891</td>
<td>1.003804</td>
<td>2</td>
<td>-0.292748</td>
<td>0.929392</td>
<td>0.969628</td>
<td>0.180805</td>
<td>-0.411969</td>
<td>37</td>
<td>0.297071</td>
<td>NaN</td>
<td>False</td>
<td>0.555357</td>
<td>12</td>
<td>0.382397</td>
<td>6</td>
<td>2026-03-04 22:40:25.489180</td>
<td>102.286667</td>
<td>101.225556</td>
<td>47923826688</td>
<td>0.009381</td>
<td>VOLKSWAGEN AG</td>
<td>Germany</td>
<td>95.60</td>
<td>0.013786</td>
<td>-0.048756</td>
<td>-0.090390</td>
<td>EUR</td>
</tr>
<tr>
<th>7</th>
<td>166</td>
<td>euro_stoxx_50</td>
<td>DG.PA</td>
<td>2026-03-04</td>
<td>Industrials</td>
<td>0.778573</td>
<td>0.850985</td>
<td>0.928797</td>
<td>1.146268</td>
<td>0.926156</td>
<td>3</td>
<td>-0.031697</td>
<td>1.064353</td>
<td>1.095809</td>
<td>0.062871</td>
<td>0.595820</td>
<td>11</td>
<td>0.043608</td>
<td>2.04762</td>
<td>False</td>
<td>-0.538059</td>
<td>34</td>
<td>0.327972</td>
<td>8</td>
<td>2026-03-04 22:40:25.489180</td>
<td>131.013333</td>
<td>123.067778</td>
<td>74446422016</td>
<td>0.014572</td>
<td>VINCI</td>
<td>France</td>
<td>134.15</td>
<td>0.006754</td>
<td>-0.054283</td>
<td>0.117451</td>
<td>EUR</td>
</tr>
<tr>
<th>18</th>
<td>191</td>
<td>euro_stoxx_50</td>
<td>SGO.PA</td>
<td>2026-03-04</td>
<td>Industrials</td>
<td>1.060288</td>
<td>0.991397</td>
<td>1.009773</td>
<td>0.546912</td>
<td>0.902092</td>
<td>4</td>
<td>-0.390177</td>
<td>0.899452</td>
<td>0.848740</td>
<td>0.276512</td>
<td>-0.946419</td>
<td>43</td>
<td>0.360809</td>
<td>1.94737</td>
<td>True</td>
<td>0.530945</td>
<td>13</td>
<td>0.162206</td>
<td>19</td>
<td>2026-03-04 22:40:25.489180</td>
<td>86.202000</td>
<td>85.090222</td>
<td>38256795648</td>
<td>0.007488</td>
<td>SAINT GOBAIN</td>
<td>France</td>
<td>77.16</td>
<td>-0.011783</td>
<td>-0.121185</td>
<td>-0.112695</td>
<td>EUR</td>
</tr>
<tr>
<th>19</th>
<td>189</td>
<td>euro_stoxx_50</td>
<td>SAN.PA</td>
<td>2026-03-04</td>
<td>Healthcare</td>
<td>0.799367</td>
<td>0.646615</td>
<td>0.714066</td>
<td>1.090175</td>
<td>0.812556</td>
<td>7</td>
<td>-0.432698</td>
<td>0.982603</td>
<td>0.949547</td>
<td>0.285444</td>
<td>-0.592341</td>
<td>39</td>
<td>0.262148</td>
<td>2.00000</td>
<td>True</td>
<td>0.170637</td>
<td>20</td>
<td>0.130284</td>
<td>20</td>
<td>2026-03-04 22:40:25.489180</td>
<td>79.889667</td>
<td>82.906444</td>
<td>95673352192</td>
<td>0.018727</td>
<td>SANOFI</td>
<td>France</td>
<td>79.23</td>
<td>-0.007889</td>
<td>-0.019309</td>
<td>-0.042191</td>
<td>EUR</td>
</tr>
</tbody>
</table>

```python
# Polars — top scores
scores_pl.filter(pl.col("relative_value_score") > 0.8).head()
```

<div><!-- shape: (5, 36) --><table><thead><tr><th>id</th><th>_index</th><th>symbol</th><th>score_date</th><th>sector</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>relative_value_rank</th><th>relative_strength</th><th>sma_50_ratio</th><th>sma_200_ratio</th><th>dist_from_52w_high</th><th>momentum_score</th><th>momentum_rank</th><th>implied_upside</th><th>recommendation_mean</th><th>price_falling_analysts_bullish</th><th>sentiment_score</th><th>sentiment_rank</th><th>composite_score</th><th>composite_rank</th><th>_scored_at</th><th>sma_30_close</th><th>sma_90_close</th><th>market_cap</th><th>index_weight</th><th>short_name</th><th>country</th><th>current_price</th><th>day_change_pct</th><th>five_day_change_pct</th><th>ytd_change_pct</th><th>currency</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>date</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td><td>f64</td><td>i64</td><td>f64</td><td>i64</td><td>datetime[ns]</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>163</td><td>euro_stoxx_50</td><td>BNP.PA</td><td>2026-03-04</td><td>Financial Services</td><td>0.913389</td><td>1.26114</td><td>null</td><td>2.388962</td><td>1.521163</td><td>1</td><td>0.016123</td><td>1.00909</td><td>1.130264</td><td>0.082486</td><td>0.477966</td><td>16</td><td>0.153157</td><td>1.84211</td><td>false</td><td>0.052711</td><td>25</td><td>0.683947</td><td>1</td><td>2026-03-04 22:40:25.489180</td><td>92.085</td><td>81.181889</td><td>99751215104</td><td>0.019525</td><td>BNP PARIBAS ACT.A</td><td>France</td><td>89.32</td><td>0.011437</td><td>-0.073156</td><td>0.105582</td><td>EUR</td></tr><tr><td>196</td><td>euro_stoxx_50</td><td>VOW.DE</td><td>2026-03-04</td><td>Consumer Cyclical</td><td>1.166221</td><td>0.940273</td><td>0.37983</td><td>1.528891</td><td>1.003804</td><td>2</td><td>-0.292748</td><td>0.929392</td><td>0.969628</td><td>0.180805</td><td>-0.411969</td><td>37</td><td>0.297071</td><td>null</td><td>false</td><td>0.555357</td><td>12</td><td>0.382397</td><td>6</td><td>2026-03-04 22:40:25.489180</td><td>102.286667</td><td>101.225556</td><td>47923826688</td><td>0.009381</td><td>VOLKSWAGEN AG</td><td>Germany</td><td>95.6</td><td>0.013786</td><td>-0.048756</td><td>-0.09039</td><td>EUR</td></tr><tr><td>166</td><td>euro_stoxx_50</td><td>DG.PA</td><td>2026-03-04</td><td>Industrials</td><td>0.778573</td><td>0.850985</td><td>0.928797</td><td>1.146268</td><td>0.926156</td><td>3</td><td>-0.031697</td><td>1.064353</td><td>1.095809</td><td>0.062871</td><td>0.59582</td><td>11</td><td>0.043608</td><td>2.04762</td><td>false</td><td>-0.538059</td><td>34</td><td>0.327972</td><td>8</td><td>2026-03-04 22:40:25.489180</td><td>131.013333</td><td>123.067778</td><td>74446422016</td><td>0.014572</td><td>VINCI</td><td>France</td><td>134.15</td><td>0.006754</td><td>-0.054283</td><td>0.117451</td><td>EUR</td></tr><tr><td>191</td><td>euro_stoxx_50</td><td>SGO.PA</td><td>2026-03-04</td><td>Industrials</td><td>1.060288</td><td>0.991397</td><td>1.009773</td><td>0.546912</td><td>0.902092</td><td>4</td><td>-0.390177</td><td>0.899452</td><td>0.84874</td><td>0.276512</td><td>-0.946419</td><td>43</td><td>0.360809</td><td>1.94737</td><td>true</td><td>0.530945</td><td>13</td><td>0.162206</td><td>19</td><td>2026-03-04 22:40:25.489180</td><td>86.202</td><td>85.090222</td><td>38256795648</td><td>0.007488</td><td>SAINT GOBAIN</td><td>France</td><td>77.16</td><td>-0.011783</td><td>-0.121185</td><td>-0.112695</td><td>EUR</td></tr><tr><td>189</td><td>euro_stoxx_50</td><td>SAN.PA</td><td>2026-03-04</td><td>Healthcare</td><td>0.799367</td><td>0.646615</td><td>0.714066</td><td>1.090175</td><td>0.812556</td><td>7</td><td>-0.432698</td><td>0.982603</td><td>0.949547</td><td>0.285444</td><td>-0.592341</td><td>39</td><td>0.262148</td><td>2.0</td><td>true</td><td>0.170637</td><td>20</td><td>0.130284</td><td>20</td><td>2026-03-04 22:40:25.489180</td><td>79.889667</td><td>82.906444</td><td>95673352192</td><td>0.018727</td><td>SANOFI</td><td>France</td><td>79.23</td><td>-0.007889</td><td>-0.019309</td><td>-0.042191</td><td>EUR</td></tr></tbody></table></div>

```python
# Polars — chain multiple filters
scores_pl.filter(
    pl.col("relative_value_score").is_not_null(),
    pl.col("relative_value_score") > 0.5,
).head()
```

<div><!-- shape: (5, 36) --><table><thead><tr><th>id</th><th>_index</th><th>symbol</th><th>score_date</th><th>sector</th><th>pe_zscore</th><th>pb_zscore</th><th>ev_ebitda_zscore</th><th>yield_zscore</th><th>relative_value_score</th><th>relative_value_rank</th><th>relative_strength</th><th>sma_50_ratio</th><th>sma_200_ratio</th><th>dist_from_52w_high</th><th>momentum_score</th><th>momentum_rank</th><th>implied_upside</th><th>recommendation_mean</th><th>price_falling_analysts_bullish</th><th>sentiment_score</th><th>sentiment_rank</th><th>composite_score</th><th>composite_rank</th><th>_scored_at</th><th>sma_30_close</th><th>sma_90_close</th><th>market_cap</th><th>index_weight</th><th>short_name</th><th>country</th><th>current_price</th><th>day_change_pct</th><th>five_day_change_pct</th><th>ytd_change_pct</th><th>currency</th></tr><tr><td>i64</td><td>str</td><td>str</td><td>date</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td><td>f64</td><td>i64</td><td>f64</td><td>i64</td><td>datetime[ns]</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>str</td><td>str</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>163</td><td>euro_stoxx_50</td><td>BNP.PA</td><td>2026-03-04</td><td>Financial Services</td><td>0.913389</td><td>1.26114</td><td>null</td><td>2.388962</td><td>1.521163</td><td>1</td><td>0.016123</td><td>1.00909</td><td>1.130264</td><td>0.082486</td><td>0.477966</td><td>16</td><td>0.153157</td><td>1.84211</td><td>false</td><td>0.052711</td><td>25</td><td>0.683947</td><td>1</td><td>2026-03-04 22:40:25.489180</td><td>92.085</td><td>81.181889</td><td>99751215104</td><td>0.019525</td><td>BNP PARIBAS ACT.A</td><td>France</td><td>89.32</td><td>0.011437</td><td>-0.073156</td><td>0.105582</td><td>EUR</td></tr><tr><td>196</td><td>euro_stoxx_50</td><td>VOW.DE</td><td>2026-03-04</td><td>Consumer Cyclical</td><td>1.166221</td><td>0.940273</td><td>0.37983</td><td>1.528891</td><td>1.003804</td><td>2</td><td>-0.292748</td><td>0.929392</td><td>0.969628</td><td>0.180805</td><td>-0.411969</td><td>37</td><td>0.297071</td><td>null</td><td>false</td><td>0.555357</td><td>12</td><td>0.382397</td><td>6</td><td>2026-03-04 22:40:25.489180</td><td>102.286667</td><td>101.225556</td><td>47923826688</td><td>0.009381</td><td>VOLKSWAGEN AG</td><td>Germany</td><td>95.6</td><td>0.013786</td><td>-0.048756</td><td>-0.09039</td><td>EUR</td></tr><tr><td>194</td><td>euro_stoxx_50</td><td>TTE.PA</td><td>2026-03-04</td><td>Energy</td><td>0.691106</td><td>0.609377</td><td>0.44961</td><td>0.731948</td><td>0.62051</td><td>12</td><td>0.0498</td><td>1.109161</td><td>1.212503</td><td>0.08411</td><td>0.919444</td><td>5</td><td>0.041131</td><td>2.04545</td><td>false</td><td>-0.542576</td><td>35</td><td>0.332459</td><td>7</td><td>2026-03-04 22:40:25.489180</td><td>63.603</td><td>58.231667</td><td>142003961856</td><td>0.027796</td><td>TOTALENERGIES</td><td>France</td><td>66.86</td><td>-0.018209</td><td>-0.00757</td><td>0.202734</td><td>EUR</td></tr><tr><td>166</td><td>euro_stoxx_50</td><td>DG.PA</td><td>2026-03-04</td><td>Industrials</td><td>0.778573</td><td>0.850985</td><td>0.928797</td><td>1.146268</td><td>0.926156</td><td>3</td><td>-0.031697</td><td>1.064353</td><td>1.095809</td><td>0.062871</td><td>0.59582</td><td>11</td><td>0.043608</td><td>2.04762</td><td>false</td><td>-0.538059</td><td>34</td><td>0.327972</td><td>8</td><td>2026-03-04 22:40:25.489180</td><td>131.013333</td><td>123.067778</td><td>74446422016</td><td>0.014572</td><td>VINCI</td><td>France</td><td>134.15</td><td>0.006754</td><td>-0.054283</td><td>0.117451</td><td>EUR</td></tr><tr><td>150</td><td>euro_stoxx_50</td><td>AD.AS</td><td>2026-03-04</td><td>Consumer Defensive</td><td>0.758806</td><td>0.330473</td><td>0.741401</td><td>1.0574</td><td>0.72202</td><td>9</td><td>0.035485</td><td>1.155305</td><td>1.170693</td><td>0.008379</td><td>1.135547</td><td>4</td><td>-0.014969</td><td>2.29412</td><td>false</td><td>-1.03108</td><td>44</td><td>0.275495</td><td>12</td><td>2026-03-04 22:40:25.489180</td><td>37.249</td><td>35.750667</td><td>36734455808</td><td>0.00719</td><td>KONINKLIJKE AHOLD DELHAIZE N.V…</td><td>Netherlands</td><td>41.42</td><td>0.019946</td><td>0.007786</td><td>0.187841</td><td>EUR</td></tr></tbody></table></div>

---

### Comparison Table | Filtering Rows

```python
comparison = r"""
| Operation                        | Pandas                                         | Polars                                          |
|:---------------------------------|:-------------------------------------------------|:-------------------------------------------------|
| Single boolean filter            | `df[df["col"] > x]`                             | `df.filter(pl.col("col") > x)`                   |
| `.loc` with condition            | `df.loc[mask]`                                   | `df.filter(mask_expr)`                           |
| AND / OR / NOT                   | `(c1) & (c2)`, `(c1) \| (c2)`, `~c`              | Same operators on expressions                    |
| `query()`                        | `df.query("col > 5")`                            | N/A — use `filter` expressions                   |
| `isin` / `is_in`                | `df[df["col"].isin(lst)]`                        | `df.filter(pl.col("col").is_in(lst))`             |
| `between` / `is_between`        | `df[df["col"].between(a, b)]`                    | `df.filter(pl.col("col").is_between(a, b))`       |
| Null check                       | `df[df["col"].isna()]` / `.notna()`               | `filter(pl.col("col").is_null())` / `.is_not_null()` |
| `where` / `mask`                | `s.where(cond)` / `s.mask(cond)`                  | `when(cond).then(val).otherwise(alt)`            |
| String filter (`startswith`)     | `df[df["c"].str.startswith("X")]`                 | `filter(pl.col("c").str.starts_with("X"))`        |
| Datetime filter (month)         | `df[df["d"].dt.month == 1]`                       | `filter(pl.col("d").dt.month() == 1)`             |
| `head` / `tail`                 | `df.head(n)` / `df.tail(n)`                       | Same                                             |
| Slice                            | `df.iloc[a:b]`                                    | `df.slice(offset, length)`                       |
| Sample                           | `df.sample(n, random_state=42)`                   | `df.sample(n, seed=42)`                          |
| Unique rows                      | `df.drop_duplicates(subset=…)`                    | `df.unique(subset=…)`                            |
| Drop nulls                       | `df.dropna(subset=…)`                             | `df.drop_nulls(subset=…)`                        |
| Sort                             | `df.sort_values("col", ascending=False)`           | `df.sort("col", descending=True)`                 |
| Multi-col sort                   | `sort_values(["a","b"], ascending=[T,F])`          | `sort(["a","b"], descending=[F,T])`               |
| Expression-level sort            | N/A                                               | `pl.col("c").sort_by("d").over("g")`              |
| Semi-join filter                 | `df[df["k"].isin(other["k"])]`                    | `df.join(other, on="k", how="semi")`              |
"""
display(Markdown(comparison))
```

| Operation                        | Pandas                                         | Polars                                          |
|:---------------------------------|:-------------------------------------------------|:-------------------------------------------------|
| Single boolean filter            | `df[df["col"] > x]`                             | `df.filter(pl.col("col") > x)`                   |
| `.loc` with condition            | `df.loc[mask]`                                   | `df.filter(mask_expr)`                           |
| AND / OR / NOT                   | `(c1) & (c2)`, `(c1) \| (c2)`, `~c`              | Same operators on expressions                    |
| `query()`                        | `df.query("col > 5")`                            | N/A — use `filter` expressions                   |
| `isin` / `is_in`                | `df[df["col"].isin(lst)]`                        | `df.filter(pl.col("col").is_in(lst))`             |
| `between` / `is_between`        | `df[df["col"].between(a, b)]`                    | `df.filter(pl.col("col").is_between(a, b))`       |
| Null check                       | `df[df["col"].isna()]` / `.notna()`               | `filter(pl.col("col").is_null())` / `.is_not_null()` |
| `where` / `mask`                | `s.where(cond)` / `s.mask(cond)`                  | `when(cond).then(val).otherwise(alt)`            |
| String filter (`startswith`)     | `df[df["c"].str.startswith("X")]`                 | `filter(pl.col("c").str.starts_with("X"))`        |
| Datetime filter (month)         | `df[df["d"].dt.month == 1]`                       | `filter(pl.col("d").dt.month() == 1)`             |
| `head` / `tail`                 | `df.head(n)` / `df.tail(n)`                       | Same                                             |
| Slice                            | `df.iloc[a:b]`                                    | `df.slice(offset, length)`                       |
| Sample                           | `df.sample(n, random_state=42)`                   | `df.sample(n, seed=42)`                          |
| Unique rows                      | `df.drop_duplicates(subset=…)`                    | `df.unique(subset=…)`                            |
| Drop nulls                       | `df.dropna(subset=…)`                             | `df.drop_nulls(subset=…)`                        |
| Sort                             | `df.sort_values("col", ascending=False)`           | `df.sort("col", descending=True)`                 |
| Multi-col sort                   | `sort_values(["a","b"], ascending=[T,F])`          | `sort(["a","b"], descending=[F,T])`               |
| Expression-level sort            | N/A                                               | `pl.col("c").sort_by("d").over("g")`              |
| Semi-join filter                 | `df[df["k"].isin(other["k"])]`                    | `df.join(other, on="k", how="semi")`              |

---


## Common Traps and Safe Patterns

### Pandas `filter()` vs Polars `filter()`

> [!warning] The same method name means different things across libraries
>
> In Pandas, `df.filter(items=[...])` selects columns by label. In Polars,
> `df.filter(expr)` selects rows by expression. Reusing the name without checking
> the API leads to quiet, wrong results.

> [!success] Use the row-selection API that matches the library
>
> In Pandas, filter rows with boolean masks or `.loc[...]`. In Polars, use
> `.filter(...)` with expressions such as `pl.col("close") > 50`.

### Parenthesize Boolean Conditions

> [!warning] Unparenthesized boolean expressions change operator precedence
>
> `df[df["a"] > 5 & df["b"] < 10]` is parsed incorrectly because `&` binds more
> tightly than the comparison operators. The same precedence trap exists in both
> Pandas and Polars expression code.

> [!success] Wrap each condition and combine them with bitwise operators
>
> Write `(cond1) & (cond2)` and `(cond1) | (cond2)` explicitly. That makes the
> intent unambiguous and keeps the filter semantics correct in both libraries.

### Nulls Need Null Predicates

> [!warning] Equality filters never match missing values
>
> In Pandas, `NaN != NaN`, so `df["col"] == value` cannot recover null rows. The
> same conceptual rule applies elsewhere: missing values need dedicated null
> predicates, not equality comparisons.

> [!success] Use `.isna()` or `.is_null()` when the target is missing data
>
> Reach for `df["col"].isna()` in Pandas and `pl.col("col").is_null()` in
> Polars whenever the filtering condition is "missing" rather than "equal to a
> concrete value".

### Label Slices and Positional Slices Behave Differently

> [!warning] `.loc` and `.iloc` do not share the same endpoint rules
>
> `.loc["a":"c"]` includes both labels, while `.iloc[0:3]` excludes the right
> endpoint. Swapping one for the other without adjusting the slice leads to
> off-by-one errors.

> [!success] Decide first whether the slice is label-based or position-based
>
> Use `.loc` when the boundary values are labels you want included, and `.iloc`
> when you mean Python-style positional slicing. Treat them as different tools,
> not as interchangeable spellings.

### Deduplication Depends on Existing Order

> [!warning] `keep=\"first\"` is only meaningful after deterministic sorting
>
> `drop_duplicates(..., keep="first")` and similar "first row wins" patterns are
> order-sensitive. If the incoming frame is unsorted, the surviving row is
> arbitrary from a business perspective.

> [!success] Sort first when deduplication must be reproducible
>
> Establish the winning row explicitly with a sort on timestamp, priority, or
> another business key before you drop duplicates or keep the first occurrence.

### Sampling Without a Seed Breaks Reproducibility

> [!warning] Unseeded samples change on every run
>
> Random sampling without `random_state=` in Pandas or `seed=` in Polars returns
> different rows every time. That makes notebooks, tests, and benchmarks harder
> to compare or debug.

> [!success] Set the sampling seed whenever the result must be repeatable
>
> Pass `random_state=` in Pandas and `seed=` in Polars for any sample that will
> be inspected, committed, tested, or compared across runs.

## Python Explore, Select and Filter Recommendations

1. **Profile before transforming** — run `describe()`, `null_count()`, `value_counts()`, and `n_unique()` on every dataset before writing any transformation logic. This takes seconds and prevents hours of debugging.
2. **Filter early, select early** — push filters and column selection as close to the data source as possible. In Polars lazy mode, this enables predicate pushdown and projection pushdown.
3. **Use Polars selectors for type-based selection** — `cs.numeric()`, `cs.string()`, `cs.temporal()` are safer than hard-coding column names, which break when schemas change.
4. **Use `validate=` on joins before filtering** — if your filter depends on a join result, validate the join cardinality first (`validate="one_to_one"` or `"many_to_one"`) to catch unexpected row multiplication.
5. **Prefer `is_in()` over chained `|` conditions** — `df.filter(pl.col("ticker").is_in(["A", "B", "C"]))` is cleaner and faster than `(col == "A") | (col == "B") | (col == "C")`.
6. **Always pass `dropna=False` in Pandas `value_counts()`** — the default drops NaN, hiding the null count from your cardinality analysis.
7. **Sort before `head()`/`tail()` in unsorted data** — `head()` on an unsorted DataFrame returns arbitrary rows, not the "first" in any meaningful order.

## Troubleshooting and failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `KeyError` on column selection | Column name has whitespace or case mismatch | `df.columns = df.columns.str.strip()` then verify exact names |
| Filter returns empty DataFrame unexpectedly | Filter condition is too restrictive, or NaN rows excluded silently | Check `value_counts(dropna=False)` on the filter column |
| `TypeError: Cannot perform 'rand_' with...` | Missing parentheses around boolean conditions | Wrap each condition in `()`: `(cond1) & (cond2)` |
| `.loc` returns a Series instead of a DataFrame | Selecting a single column with `.loc[:, "col"]` | Use `.loc[:, ["col"]]` (list) to get a DataFrame |
| `ColumnNotFoundError` in Polars | Column name does not exist or was renamed upstream | Check `df.columns` or `df.schema` before the failing operation |
| `describe()` shows unexpected count < total rows | Non-numeric columns excluded by default (Pandas) | Use `describe(include="all")` or target specific dtypes |
| `sample()` gives different results across runs | No seed set | Pass `random_state=42` (Pandas) or `seed=42` (Polars) |
| `unique()` returns unordered values | Both libraries return unique values in arbitrary order | Chain `.sort()` after `unique()` if order matters |
| Polars `filter()` returns all rows unchanged | Expression always evaluates to `True` (e.g., comparing wrong column) | Print the boolean expression separately to verify: `df.select(expr)` |
| `isin()` returns all False | List values don't match column dtype (e.g., string "1" vs integer 1) | Ensure the list values match the column dtype exactly |
