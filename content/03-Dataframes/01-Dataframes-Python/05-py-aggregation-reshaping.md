---
title: "05 - Aggregation and Reshaping - Python"
tags: [python, pandas, polars, dataframes]
aliases:
  - groupby, agg, window functions, join, concat, pivot, melt
description: "Pandas/Polars DataFrame reference 05/10 — Aggregation & Reshaping (groupby, agg, window functions, joins, pivot, melt). Side-by-side executable examples with cell outputs."
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# Aggregation and Reshaping - Python

> [!quote]
> "Statistics are like bikinis. What they reveal is suggestive, but what they conceal is vital."
>
> — **Aaron Levenstein**

> [!abstract]- Summary
>
> Covers the four structural pillars of DataFrame manipulation — grouping, windowing, table combination, and reshape — using EuroStoxx price, dimension, and score data to show how Pandas and Polars summarize, enrich, and reorient tables without losing track of row counts, join cardinality, or output shape.
>
> **Part 1: Group By**
> - Aggregate by one or more keys with `groupby()` / `group_by()`, named aggregation, multi-function aggregation, and same-length group statistics via `transform()` or Polars `.over(...)`
> - Apply group-by-plus-sort patterns and sector-level analysis to turn raw OHLCV and scores tables into grouped summaries
>
> **Part 2: Window Functions**
> - Build rolling windows, cumulative metrics, rank-within-group logic, and lead/lag features without collapsing the original row set
> - Emphasize ordering requirements so rolling and window calculations operate on meaningful sequences rather than shuffled rows
>
> **Part 3: Combining DataFrames**
> - Compare `inner`, `left`, `anti`, `semi`, and `cross` joins plus vertical, horizontal, and diagonal concat patterns
> - Show how dimension enrichment, membership filtering, and schema-aware table stacking behave differently depending on key uniqueness and shape
>
> **Part 4: Reshaping**
> - Convert between long and wide layouts with `melt()` / `unpivot()`, `pivot()`, explode, implode, transpose, and one-hot encoding
> - Highlight where duplicates, list cardinality, or dynamic category sets make reshape operations fail or explode in width/row count
>
> **Operations and safety**
> - Warnings: many-to-many joins silently multiply rows, cross joins scale quadratically, Polars `group_by()` is unordered until sorted, `as_index=False` is version-sensitive in Pandas, rolling windows need sorted data, and `pivot()` fails on duplicate key pairs
> - Recommendations: 7 practices covering join-cardinality validation, explicit post-group sorting in Polars, named aggregation, `.over()` for Polars transforms, limiting cross joins, `unpivot()` preference, and post-join/post-reshape shape assertions
> - Troubleshooting: 8 failure modes covering join row explosions, missing groups from null keys, duplicate-entry pivot errors, null-producing concat schema mismatches, anti-join empties, explode dtype issues, and one-hot width explosions

> [!note]- Glossary
>
> **`groupby()` / `group_by()`**
> - Grouping operations that partition a DataFrame by one or more key columns before applying aggregations or grouped transforms.
> - They matter because the note's aggregation patterns all start by defining which rows belong together logically.
>
> > [!warning] Group object is not the result
> >
> > In Pandas, `groupby()` returns a `GroupBy` object rather than a summary table. You still need `.agg()`, `.transform()`, or another grouped operation to materialize results.
>
> ---
>
> **Aggregation / `agg()`**
> - A reduction step that turns many rows per group into one or a few summary values such as mean, sum, count, min, max, first, or last.
> - It matters because grouping only becomes analytically useful once those groups are reduced into interpretable statistics.
>
> > [!warning] Count semantics differ
> >
> > Counting non-null values is not always the same as counting all rows. Verify whether you need `count`, `size`, or a length-style aggregate.
>
> ---
>
> **Named aggregation**
> - An aggregation style that assigns explicit output names while computing grouped metrics, instead of accepting auto-generated or MultiIndex column labels.
> - It matters because clear output schemas make grouped results easier to chain into joins, sorts, and downstream analysis.
>
> > [!info] Prefer explicit output names
> >
> > Auto-generated aggregate names often become ambiguous once multiple source columns and functions are involved. Naming the outputs up front avoids cleanup later.
>
> ---
>
> **Transform**
> - A grouped computation that returns the same number of rows as the input by broadcasting the group-level result back onto each original row.
> - It matters because the note uses it to enrich rows with group statistics without collapsing the table.
>
> > [!warning] Same length is the key difference
> >
> > If the result has fewer rows than the input, you aggregated; if it has the same length, you transformed. Mixing those expectations causes alignment bugs.
>
> ---
>
> **Window function**
> - A per-row computation that depends on neighboring rows, group membership, or ordered context while preserving one output value per input row.
> - It matters because ranking, rolling metrics, lag features, and cumulative statistics all rely on window semantics.
>
> > [!warning] Order defines meaning
> >
> > A window over unsorted data still computes something, but not necessarily something meaningful. Always verify the sort order before interpreting the result.
>
> ---
>
> **Rolling window**
> - A fixed-size moving frame that slides across ordered rows and recomputes an aggregate at each position.
> - It matters because moving averages and related smoothing metrics are a core part of the note's time-series examples.
>
> > [!warning] Early rows are incomplete
> >
> > The first rows of a rolling calculation usually lack a full window and therefore produce null or NaN outputs unless a minimum-period rule says otherwise.
>
> ---
>
> **Join**
> - A table-combination operation that matches rows across DataFrames by one or more shared keys.
> - It matters because the note uses joins to enrich fact-like market data with dimension attributes and to filter by membership.
>
> > [!danger] Cardinality mistakes multiply data
> >
> > A join can silently create more rows than either input if keys are duplicated on both sides. Validate uniqueness assumptions before trusting row counts.
>
> ---
>
> **Inner join**
> - A join that keeps only rows whose key exists in both input tables.
> - It matters when unmatched records are intentionally excluded and only confirmed matches should survive.
>
> > [!warning] Dropped rows are easy to miss
> >
> > An inner join removes non-matching rows silently. Compare input and output row counts if record loss matters.
>
> ---
>
> **Left join**
> - A join that preserves every row from the left table and attaches matching columns from the right table where available.
> - It matters because it is the default enrichment pattern for fact-plus-dimension pipelines in this note.
>
> > [!warning] Left join can still expand rows
> >
> > Preserving all left rows does not guarantee preserving left row count. Duplicate keys on the right side still fan out the result.
>
> ---
>
> **Anti join**
> - A join-style filter that returns only rows from the left table whose keys do not appear in the right table.
> - It matters for finding orphan records, excluded keys, and failed reference matches.
>
> > [!info] Useful for diagnostics
> >
> > Anti joins are often the fastest way to answer "what did not match?" after a join or membership check.
>
> ---
>
> **Semi join**
> - A join-style filter that keeps left-table rows whose keys exist in the right table, without bringing right-side columns into the result.
> - It matters because it expresses table-driven membership filtering more clearly than ad hoc boolean lists.
>
> > [!info] Membership without enrichment
> >
> > Use a semi join when the right table is only a key filter and not a source of attributes you need to keep.
>
> ---
>
> **Cross join**
> - A Cartesian product that pairs every row from one table with every row from the other.
> - It matters because it can generate scenario grids and exhaustive combinations, but it is also the easiest reshape/join pattern to blow up in size.
>
> > [!danger] Growth is quadratic
> >
> > Even medium-size inputs can create unmanageable outputs. Estimate row count before running a cross join, not after.
>
> ---
>
> **Concat**
> - An operation that stacks DataFrames vertically or horizontally to combine partitions, results, or aligned column sets.
> - It matters because the note compares multiple concat modes and how schema mismatches surface in each library.
>
> > [!warning] Schema alignment is part of the operation
> >
> > Concat is not just appending memory blocks. Column names, column order, and dtypes determine whether the result is clean, sparse, or erroneous.
>
> ---
>
> **Pivot**
> - A reshape that turns unique values from one column into new output columns, converting long-form data into wide-form layout.
> - It matters because pivoting is a common reporting pattern for ticker-by-period summary tables.
>
> > [!warning] Duplicate coordinate pairs break pivots
> >
> > If the same row-key and column-key combination appears more than once, you need an aggregation-aware pivot strategy instead of a strict pivot.
>
> ---
>
> **`melt()` / `unpivot()`**
> - Long-format reshapes that turn multiple measured columns into key-value rows instead of keeping them as separate wide columns.
> - They matter because many analytics and visualization tools prefer long-form data over wide spreadsheets.
>
> > [!info] Same idea, different API names
> >
> > Pandas and Polars expose the same conceptual reshape under different names. The operation is equivalent even though the function labels differ.
>
> ---
>
> **Explode**
> - A reshape that turns each element of a list-like cell into its own row while duplicating the other row values as needed.
> - It matters because nested list columns must often be flattened before relational analysis or export.
>
> > [!warning] Row count can surge
> >
> > Exploding a list column multiplies rows by list length. On heavily nested data, that expansion can be large enough to affect memory planning.
>
> ---
>
> **Implode**
> - The inverse-style operation of explode in Polars, collecting multiple row values into a single list-valued column per group.
> - It matters because the note uses it to package grouped records into compact list outputs before further processing.
>
> > [!info] Useful for grouped collection
> >
> > Implode is a natural fit when you need "all values per key" as a list instead of one row per value.
>
> ---
>
> **Transpose**
> - A reshape that swaps rows and columns so that previous row labels or identifiers become column headings in the output.
> - It matters for compact display-oriented summaries where metrics should appear as rows and entities as columns.
>
> > [!warning] Best on small, regular tables
> >
> > Transpose is most useful when the data is small and homogeneous. Large mixed-type tables usually become harder to interpret after transposition.
>
> ---
>
> **One-hot encoding**
> - A categorical expansion that turns one category column into many binary indicator columns, one per distinct category.
> - It matters because machine-learning and numeric-only modeling pipelines often require categorical variables in this expanded form.
>
> > [!warning] High-cardinality categories create width explosion
> >
> > A category column with thousands of unique values becomes thousands of output columns. Bucket or reduce rare categories before encoding.
>
> ---
>
> **`.over()`**
> - A Polars windowing construct that applies a calculation within groups while preserving one result per original row.
> - It matters because it is the expression-native Polars alternative to many Pandas `transform()` patterns in the note.
>
> > [!info] Windowing without collapse
> >
> > `.over()` attaches group-aware results back to each row, which makes it ideal for ranks, grouped means, and other same-length enrichments.
>
> ---

---

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

### Per-Symbol Aggregation

#### Pandas | Group by symbol to compute mean close, total volume, and trading days

_Aggregates all 66,355 rows by `symbol`, producing one row per constituent with mean closing price, total share volume, and trading day count, then sorts by `avg_close` descending to surface the 10 highest-priced stocks._

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

#### Polars | Group by symbol to compute mean close, total volume, and trading days

_Replicates the Pandas aggregation using chained Polars expressions in a single `.agg()` call, rounding `avg_close` to 2 decimal places and returning the same 10-row flat DataFrame sorted by `avg_close` descending._

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

### Composite Group Keys with Date Extraction

#### Pandas | Group by symbol and year to compute annual average and maximum close price

_Extracts year from the `date` column into a new `ohlcv_pd["year"]` column, then groups on `["symbol", "year"]` to compute annual average and max close for ASML.AS, showing the last 5 years' performance sorted ascending._

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

#### Polars | Group by symbol and year to compute annual average and maximum close, extracting year inline

_Uses `.with_columns(pl.col("date").dt.year())` to extract year without mutating the DataFrame, then groups on `["symbol", "year"]` and filters to ASML.AS to show 5 years sorted descending — confirming identical annual statistics as the Pandas result._

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

### Named Aggregation with Multiple Functions

#### Pandas | Compute mean, std, min, max close and date range per symbol using named aggregation

_Runs six aggregation functions in a single `groupby()` pass using named aggregation syntax, producing a flat 50-row frame with explicitly named columns — sorted by `mean_close` descending to rank the 10 highest-priced constituents._

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

#### Polars | Compute mean, std, min, max close and date range per symbol using expression list

_Passes six chained expressions to `.agg()` — each using `.alias()` to name output columns — returning the same 10-row summary as the Pandas named aggregation with no MultiIndex, sorted by `mean_close` descending._

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

### Same-Length Group Broadcast

#### Pandas | Broadcast symbol mean close back to each row alongside deviation percentage

_Filters to ASML.AS, adds `group_avg` via `.groupby("symbol")["close"].transform("mean")`, then computes `vs_avg` as the percentage deviation of each day's close from the all-time mean — returning the last 10 rows at full DataFrame length without collapsing rows._

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

### Portfolio-Level Sector Metrics

#### Pandas | Aggregate scores by sector to compute constituent count, average scores, and total weight

_Groups the 466-row scores table by `sector`, computing stock count, mean composite and momentum scores, and summed index weight per sector, returning a 10-row frame sorted by `avg_composite` descending._

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

#### Polars | Aggregate scores by sector to compute constituent count, average scores, and total weight

_Replicates the Pandas sector aggregation using `.count()`, `.mean().round(4)`, and `.sum().round(4)` expressions in a single `.agg()` call, producing the same 10-row sector summary sorted by `avg_composite` descending._

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

### Top-N Rows Per Group

#### Polars | Retrieve top 3 stocks per sector by composite rank using group_by().head()

_Pre-sorts the scores table by `composite_rank` ascending, then calls `.group_by("sector").head(3)` to capture the 3 highest-ranked stocks per sector — producing a 30-row result across all 10 sectors, re-sorted by sector and rank._

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

Window functions like `PARTITION BY` and `ROWS BETWEEN` appear across SQL and DataFrame APIs. The SQL Server gold layer in [gold-transforms](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms) applies the same ranking and running-total logic, and [bq-advanced](https://alp78.github.io/elysium/05-DB-Queries/BigQuery/bq-advanced) covers BigQuery window functions for identical analytical needs.

### Broadcasting Group Statistics

#### Pandas | Window transform (groupby().transform())

`.groupby().transform(func)` applies `func` to each group and broadcasts the result back to the full-length DataFrame. It is the Pandas idiom for "add a group-level column without collapsing rows". The function receives each group's Series and must return a same-length Series. Common functions: `"mean"`, `"sum"`, `"rank"`, or a custom lambda.

_Filters to ASML.AS, broadcasts the all-time mean close back to each row as `avg_close` using `.transform("mean")`, then adds a `rank` column via `.rank(ascending=False)` — showing the last 10 rows with both raw close and its ordinal position in the full 1,331-row ASML history._

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

#### Polars | Window transform (.over())

`.expr.over("group_col")` in Polars computes the expression within each partition defined by `group_col` and broadcasts the result back to each row — the exact equivalent of Pandas `.transform()`. Unlike `.transform()`, `.over()` can be chained with any expression (`.mean()`, `.rank()`, `.cum_sum()`) inside a single `.with_columns()` call without multiple passes. Multiple `.over()` expressions in one `.with_columns()` are computed in parallel.

_Replicates the Pandas transform by computing `.mean().over("symbol")` and `.rank(descending=True).over("symbol")` in a single `.with_columns()` call — showing that multiple `.over()` expressions are evaluated in parallel, producing identical last-10-row values as the Pandas result._

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

### Moving Average and Rolling Maximum

#### Pandas | Compute 7-day SMA and 30-day rolling max for ASML.AS using rolling()

_Filters to ASML.AS sorted by date, then uses `.assign()` with `.rolling(7).mean()` and `.rolling(30).max()` to append `sma_7` and `rolling_max` — displaying the last 10 rows where the 30-day high is uniformly 1,288.4._

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

#### Polars | Compute 7-day SMA and 30-day rolling max for ASML.AS using rolling_mean() and rolling_max()

_Replicates the Pandas rolling windows using `rolling_mean(window_size=7)` and `rolling_max(window_size=30)` as expressions in a single `.with_columns()` call, producing the same last-10-row result with identical SMA and rolling high values._

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

### Running Totals and All-Time Highs

#### Pandas | Compute cumulative volume and running close high for ASML.AS using cumsum() and cummax()

_Filters to ASML.AS sorted by date, appending `cum_vol` (running total shares traded) and `run_high` (all-time closing high) via `.assign()` — showing the last 10 rows where cumulative volume approaches 945 million shares._

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

#### Polars | Compute cumulative volume and running close high for ASML.AS using cum_sum() and cum_max()

_Replicates the Pandas cumulative operations using `pl.col("volume").cum_sum()` and `pl.col("close").cum_max()` in a single `.with_columns()`, confirming identical running totals and all-time highs in the last 10 rows._

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

### Within-Group Percentile Ranking

#### Pandas | Rank each stock within its sector by composite score using groupby().rank()

_Assigns each stock a within-sector rank based on `composite_score` descending, broadcasting the rank back to every row using `.groupby("sector")["composite_score"].rank(ascending=False)` — showing the top 15 rows sorted by sector and rank._

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

#### Polars | Rank each stock within its sector by composite score using rank().over()

_Computes the within-sector rank in a single `.with_columns()` call using `.rank(descending=True).over("sector")` — returning the same 15-row result sorted by sector and rank, with all sectors' rankings computed in parallel._

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

### Shift for Lag and Lead Values

#### Pandas | Compute previous-day and next-day close for ASML.AS using shift()

_Filters to ASML.AS sorted by date, then uses `.assign()` to add `prev_close` (shift(1)) and `next_close` (shift(-1)) — showing the last 10 rows where the final row's `next_close` is `NaN` because no future row exists._

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

#### Polars | Compute previous-day and next-day close for ASML.AS using shift()

_Replicates the Pandas shift using `pl.col("close").shift(1)` and `pl.col("close").shift(-1)` in a single `.with_columns()` call — producing the same last-10-row result with `null` (instead of `NaN`) for the final lead value._

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

### Additional Dataset Loading

#### Python | Load USA OHLCV, signals, trading calendar, and index performance datasets

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

### Key-Based Row Matching

#### Pandas | Inner join OHLCV to dimension table on symbol, adding short_name and sector columns

_Merges the 66,355-row OHLCV frame with the 169-row dimension table on `symbol` using `how="inner"`, enriching every price row with `short_name` and `sector` — confirming all 66,355 rows are retained because every OHLCV symbol has a dimension entry._

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

#### Polars | Inner join OHLCV to dimension table on symbol, adding short_name and sector columns

_Replicates the Pandas inner join using `.join(dim_pl.select(...), on="symbol", how="inner")`, confirming 66,355 rows retained — Polars uses `_right` instead of `_x`/`_y` for duplicate column name collisions._

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

### Preserving All Left-Side Rows

#### Pandas | Left join OHLCV to scores on symbol, attaching composite score to each price row

_Joins the 66,355-row OHLCV frame to the scores table on `symbol` using `how="left"`, demonstrating the many-to-many row explosion where ABI.BR appears three times (one per scoring date) — showing the first 5 rows to expose the duplication._

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

#### Polars | Left join OHLCV to scores on symbol, attaching composite score to each price row

_Replicates the Pandas left join using `.join(scores_pl.select(...), on="symbol", how="left")`, producing the same many-to-many expansion — confirming identical composite score values as the Pandas result in the first 5 rows._

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

### Identifying Unmatched Rows

#### Polars | Find symbols in OHLCV that have no match in the scores table using anti join

_Extracts unique symbols from both OHLCV and scores, then applies `how="anti"` to return only OHLCV symbols absent from scores — confirming 0 unmatched symbols, meaning full OHLCV coverage in the scores table._

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

### Filtering by Key Membership

#### Polars | Filter OHLCV to keep only symbols present in the scores table using semi join

_Joins the 66,355-row OHLCV to the unique scores symbols using `how="semi"`, returning all 66,355 rows — confirming every OHLCV symbol has a corresponding scores entry without adding any columns from the right side._

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

### Cartesian Product Generation

#### Polars | Generate all combinations of two symbols and two dates using cross join

_Joins a 2-row symbols DataFrame to a 2-row dates DataFrame using `how="cross"`, producing all 4 (symbol, date) combinations — demonstrating the Cartesian product that scales to millions of rows on larger inputs._

```python
syms = pl.DataFrame({"symbol": ["ASML.AS", "MC.PA"]})
dts = pl.DataFrame({"date": ["2026-03-01", "2026-03-02"]})
display(syms.join(dts, how="cross"))
```

<div><!-- shape: (4, 2) --><table><thead><tr><th>symbol</th><th>date</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>ASML.AS</td><td>2026-03-01</td></tr><tr><td>ASML.AS</td><td>2026-03-02</td></tr><tr><td>MC.PA</td><td>2026-03-01</td></tr><tr><td>MC.PA</td><td>2026-03-02</td></tr></tbody></table></div>

## Vertical Concat

Vertical concatenation stacks DataFrames on top of each other (adds rows). Both DataFrames must have compatible schemas — same column names and compatible types. Use this to combine data from multiple time periods, markets, or API pages into a single frame. Polars uses `pl.concat([df1, df2])`; Pandas uses `pd.concat([df1, df2], ignore_index=True)`. Always pass `ignore_index=True` in Pandas to reset the row index after concat — without it, duplicate index values are preserved, which breaks many downstream operations.

### Stacking Frames Row-Wise

#### Pandas | Stack Euro Stoxx 50 and US 50 OHLCV head rows vertically using pd.concat()

_Concatenates the first 3 rows of `ohlcv_pd` (ABI.BR) and `usa_pd` (AAPL) using `pd.concat([...], ignore_index=True)`, producing a 6-row frame with a clean integer index reset — one frame stacked on top of the other._

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

#### Polars | Stack Euro Stoxx 50 and US 50 OHLCV head rows vertically using pl.concat()

_Replicates the Pandas vertical concat using `pl.concat([ohlcv_pl.head(3), usa_pl.head(3)])`, returning the same 6-row result — no `ignore_index` parameter needed since Polars has no row index concept._

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

### Attaching Columns Side by Side

#### Polars | Horizontally concatenate a symbol-price frame with a sector frame using pl.concat()

_Combines a 2-row `symbol`/`price` frame with a 2-row `sector` frame using `how="horizontal"`, producing a 2-row, 3-column result — both frames must have matching row counts for horizontal concat to succeed._

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

### Schema-Tolerant Vertical Stack

#### Polars | Diagonally concatenate two frames with different schemas, filling missing columns with null

_Stacks a `{symbol, close}` frame and a `{symbol, volume}` frame using `how="diagonal"`, producing a 2-row, 3-column result where `close` is `null` for row B and `volume` is `null` for row A._

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

### Spreading Column Names into Rows

#### Pandas | Melt ASML.AS OHLC columns into long format with price_type and price columns

_Takes the last 3 rows of ASML.AS with `open`, `high`, `low`, `close` columns and melts them into a 12-row long frame where `price_type` holds the column name and `price` holds the value — keeping `date` as the identity variable._

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

#### Polars | Unpivot ASML.AS OHLC columns into long format with price_type and price columns

_Replicates the Pandas melt using `.unpivot(index="date", variable_name="price_type", value_name="price")`, producing the same 12-row result with `Float64` typed `price` values and a Polars-native API name._

```python
# Polars unpivot
asml_pl = ohlcv_pl.filter(pl.col("symbol")=="ASML.AS").select("date","open","high","low","close").tail(3)
display(asml_pl.unpivot(index="date", variable_name="price_type", value_name="price"))
```

<div><!-- shape: (12, 3) --><table><thead><tr><th>date</th><th>price_type</th><th>price</th></tr><tr><td>date</td><td>str</td><td>f64</td></tr></thead><tbody><tr><td>2026-03-10</td><td>open</td><td>1188.4</td></tr><tr><td>2026-03-11</td><td>open</td><td>1188.4</td></tr><tr><td>2026-03-12</td><td>open</td><td>1194.8</td></tr><tr><td>2026-03-10</td><td>high</td><td>1208.4</td></tr><tr><td>2026-03-11</td><td>high</td><td>1210.8</td></tr><tr><td>2026-03-12</td><td>high</td><td>1202.2</td></tr><tr><td>2026-03-10</td><td>low</td><td>1172.2</td></tr><tr><td>2026-03-11</td><td>low</td><td>1174.0</td></tr><tr><td>2026-03-12</td><td>low</td><td>1187.8</td></tr><tr><td>2026-03-10</td><td>close</td><td>1200.0</td></tr><tr><td>2026-03-11</td><td>close</td><td>1198.8</td></tr><tr><td>2026-03-12</td><td>close</td><td>1190.8</td></tr></tbody></table></div>

## Long to Wide: pivot

Pivot converts a long-format DataFrame into wide format by spreading the unique values of an `on` column into new columns, filling each cell with a corresponding `values` column. Use pivot to create a symbol-by-year close-price matrix from daily time series data, or to produce a sector-by-metric scorecard. Polars `.pivot(on=, index=, values=)` performs this eagerly; Pandas uses `pivot_table()` which also supports aggregation functions for duplicate index combinations.

### Spreading Row Values into Columns

#### Polars | Pivot annual average close prices into a symbol × year matrix using pivot()

_Groups ASML.AS, MC.PA, and SAP.DE by `symbol` and `year` to compute annual average close, then pivots `year` values into columns — producing a 3-row, 7-column matrix of average prices from 2021 to 2026._

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

### Expanding List Columns to Rows

#### Polars | Explode a tags list column so each tag becomes its own row using explode()

_Takes a 2-row DataFrame where each symbol has a list of 2 tags, then explodes the `tags` column into 4 rows — repeating the `symbol` value for each tag element._

```python
df = pl.DataFrame({"symbol": ["ASML.AS","MC.PA"], "tags": [["tech","nl"],["luxury","fr"]]})
display(df.explode("tags"))
```

<div><!-- shape: (4, 2) --><table><thead><tr><th>symbol</th><th>tags</th></tr><tr><td>str</td><td>str</td></tr></thead><tbody><tr><td>ASML.AS</td><td>tech</td></tr><tr><td>ASML.AS</td><td>nl</td></tr><tr><td>MC.PA</td><td>luxury</td></tr><tr><td>MC.PA</td><td>fr</td></tr></tbody></table></div>

## Implode

Implode (Polars only) is the inverse of explode: it collects all values in a group into a single `list[T]` column. Use it to create a "bag of symbols per sector" column, or to bundle related values before serializing to JSON. Pandas has no direct equivalent — the closest is `.groupby("sector")["symbol"].apply(list)`.

### Collecting Rows into Lists

#### Polars | Group symbols by sector into a list column per sector using group_by() and implode()

_Groups the scores table by `sector` and collects all `symbol` values into a `list[str]` column per sector using `.implode()`, showing the first 5 sectors sorted alphabetically — each as a bag of symbol strings._

```python
display(scores_pl.group_by("sector").agg(pl.col("symbol").implode()).sort("sector").head(5))
```

<div><!-- shape: (5, 2) --><table><thead><tr><th>sector</th><th>symbol</th></tr><tr><td>str</td><td>list[str]</td></tr></thead><tbody><tr><td>Basic Materials</td><td>[AI.PA, BAS.DE, … LIN]</td></tr><tr><td>Communication Services</td><td>[DTE.DE, DTE.DE, … NFLX]</td></tr><tr><td>Consumer Cyclical</td><td>[VOW.DE, ADS.DE, … TSLA]</td></tr><tr><td>Consumer Defensive</td><td>[ABI.BR, AD.AS, … COST]</td></tr><tr><td>Energy</td><td>[TTE.PA, ENI.MI, … XOM]</td></tr></tbody></table></div>

## Transpose

Transpose swaps rows and columns — the row index becomes column names and vice versa. Use it to convert a small "symbol × metric" frame into a "metric × symbol" view, e.g., for display in a dashboard table. Polars `.transpose(include_header=True, column_names=col)` names the output columns from a string column in the input. Pandas uses `.T` (the transposed property). Both require a homogeneous schema (all numeric, or all string) for the transposed columns.

### Swapping Rows and Columns

#### Polars | Transpose a 2-symbol × 2-metric frame into a 2-metric × 2-symbol view using transpose()

_Selects the most recent composite and momentum scores for ASML.AS and MC.PA, then transposes the 2-row, 3-column frame so metric names become rows and symbol values become columns — using `column_names="symbol"` to name the output columns._

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

### Encoding Categoricals as Binary Columns

#### Polars | One-hot encode a sector column into binary dummy columns using to_dummies()

_Converts a 4-row `sector` column with values `Tech`, `Luxury`, and `Energy` into 3 binary columns (`sector_Energy`, `sector_Luxury`, `sector_Tech`) using `to_dummies()` — each column uses `u8` dtype for memory efficiency._

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

---


## Warnings

> [!warning] Many-to-many joins silently multiply rows
> If both sides of a join have duplicate keys, the result is a Cartesian product of the matching rows. A 1000-row left table joined to a right table with 5 rows per key produces 5000 rows. Use `validate="one_to_many"` or `"many_to_one"` in Pandas, or check key uniqueness before joining.

> [!warning] Cross-join row explosion
> A cross join between two 10,000-row DataFrames produces 100 million rows. Always filter or limit one side before crossing.

> [!warning] Polars `group_by` does not guarantee output order
> Unlike Pandas `groupby(sort=True)`, Polars `group_by()` returns groups in arbitrary order. Chain `.sort()` after aggregation if order matters.

> [!warning] `as_index=False` behaves differently across Pandas versions
> In older Pandas, `.groupby(..., as_index=False)` does not work consistently with named aggregation. Prefer `.reset_index()` after aggregation for portability.

> [!warning] Rolling windows on unsorted data produce meaningless results
> A rolling mean assumes rows are in temporal or logical order. On shuffled data, the window slides over random rows.

> [!warning] `pivot()` fails on duplicate index/column pairs
> If the same (index, column) combination appears more than once, Polars raises an error and Pandas `pivot()` raises `ValueError`. Use `pivot_table(aggfunc=...)` to aggregate duplicates.

## Recommendations

1. **Always validate join cardinality** — use `validate=` (Pandas) or check `n_unique()` on join keys before any join. Silent row multiplication is the most common join bug.
2. **Sort after group_by in Polars** — if output order matters, chain `.sort()`. Do not assume groups arrive in insertion order.
3. **Use named aggregation** — `pl.col("price").mean().alias("avg_price")` (Polars) or `.agg(avg_price=("price", "mean"))` (Pandas). Avoid ambiguous MultiIndex column headers.
4. **Prefer `.over()` to `.transform()` in Polars** — `pl.col("price").mean().over("sector")` is a single expression; Pandas `.transform()` requires a separate `groupby()` call.
5. **Limit cross joins** — filter the smaller table aggressively before crossing. Consider whether a `semi-join` + conditional logic achieves the same result without the Cartesian product.
6. **Prefer `unpivot()` (Polars) over `melt()` (Pandas) for new code** — the naming is clearer and the API is more consistent.
7. **Check output shape after every join and reshape** — assert `result.shape[0]` against expected row count. Shape checks cost nothing and catch silent bugs immediately.

## Troubleshooting and failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Join produces more rows than the left table | Duplicate keys in the right table (one-to-many or many-to-many) | Deduplicate the right table or use `validate="one_to_one"` |
| `group_by` result is missing groups | Groups with all-null keys are excluded by default | Check for null keys before grouping; handle null groups separately |
| `pivot()` raises `ValueError: duplicate entries` | Same (index, column) pair appears twice | Aggregate first, or use `pivot_table(aggfunc=...)` |
| Rolling mean shows all NaN | Window size larger than the group, or data is unsorted | Reduce window size; sort by date first |
| `concat` produces unexpected nulls | Column names or dtypes don't match across DataFrames | Align schemas before concatenating; use `how="diagonal"` in Polars for mismatched columns |
| Anti-join returns empty DataFrame | All left keys exist in the right table | Verify key columns match in dtype and values; check for whitespace in string keys |
| `explode()` raises error | Column is not list-typed | Cast to list first, or check with `df.schema` |
| One-hot encoding produces too many columns | High-cardinality column (e.g., 10K unique values) | Bucket rare values into "other" before encoding |
