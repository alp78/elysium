---
title: "08. Visualization - Python"
tags: [python, pandas, polars, dataframes, matplotlib, seaborn, plotly]
aliases:
  - matplotlib, seaborn, plotting, charts
description: "Pandas/Polars DataFrame reference 08/10 — Visualization (matplotlib, seaborn, static charts). Side-by-side executable examples with cell outputs."
parent: "[[domain-integrate-and-validate]]"
links:
  - "[[08_cs_visualization]]"
  - "[[09_py_database_interface]]"
  - "[[09_cs_database_interface]]"
  - "[[10_py_testing_migration]]"
  - "[[10_cs_testing_migration]]"
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# 08 — Visualization

> [!quote]
> "The greatest value of a picture is when it forces us to notice what we never expected to see."
>
> — **John Tukey**, *Exploratory Data Analysis* (1977)

Pandas/Matplotlib/Seaborn for static charts, Plotly for interactive.

```python
from cycler import cycler
import pandas as pd
import polars as pl
import polars.selectors as cs
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
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

import tempfile
TMP = Path(tempfile.mkdtemp())

# Tokyo Night theme for Matplotlib
plt.rcParams.update({
    "figure.facecolor": "#1a1b26",
    "axes.facecolor": "#1a1b26",
    "axes.edgecolor": "#3b4261",
    "axes.labelcolor": "#a9b1d6",
    "axes.prop_cycle": cycler(color=["#7aa2f7", "#9ece6a", "#e0af68", "#f7768e", "#bb9af7", "#7dcfff", "#73daca", "#ff9e64"]),
    "text.color": "#a9b1d6",
    "xtick.color": "#a9b1d6",
    "ytick.color": "#a9b1d6",
    "grid.color": "#292e42",
    "legend.facecolor": "#24283b",
    "legend.edgecolor": "#3b4261",
    "legend.labelcolor": "#a9b1d6",
    "savefig.facecolor": "#1a1b26",
})

from matplotlib.patches import Circle
import plotly.io as pio
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from IPython.display import HTML
```

    OHLCV: (66355, 12), Dim: (169, 26), Scores: (466, 36)

## Data Preparation

### Reusable Subsets

```python
# Reusable subsets for plotting
asml = ohlcv_pd[ohlcv_pd["symbol"] == "ASML.AS"].sort_values("date").tail(365).copy()
top5_syms = ["ASML.AS", "SAP.DE", "SIE.DE", "TTE.PA", "AIR.PA"]
top5 = ohlcv_pd[ohlcv_pd["symbol"].isin(top5_syms)].sort_values("date").copy()
sector_avg = scores_pd.groupby("sector")["composite_score"].mean().sort_values()
```

## Line Charts


Line charts connect data points in order, revealing **trends**, **cycles**, and **rate of change** over time. Slope shows velocity; curvature shows acceleration; crossings between series highlight regime changes.

**Best for:** Time-series data, continuous measurements over ordered intervals (stock prices, sensor readings, revenue over months). Not suitable for unordered categories.

### Basic Line

#### Pandas | Basic line

_Plots ASML's 365-day close price series using `DataFrame.plot(x="date", y="close")` — Pandas delegates directly to Matplotlib, producing a single-call line chart with axis labels and a tight layout._

```python
# Close price evolution for ASML over the last year
asml.plot(x="date", y="close", title="ASML Close Price (1Y)", figsize=(10, 4), legend=False)
plt.ylabel("Close")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_01.png)

### Multi-series Line

#### Matplotlib | Multi-series line

_Loops over `top5_syms` and plots each stock's close price on the same axes with `ax.plot()`, producing five independently colored lines on a shared date axis — each labeled for legend identification._

```python
# Close price comparison for 5 stocks on the same time axis
fig, ax = plt.subplots(figsize=(10, 5))
for sym in top5_syms:
    df = top5[top5["symbol"] == sym]
    ax.plot(df["date"], df["close"], label=sym)
ax.set_title("Close Prices — Top 5")
ax.legend()
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_02.png)

### Line Styles and Markers

#### Matplotlib | Line styles & markers

_Overlays ASML's close (solid blue) and open (dashed orange) prices, then adds red circle markers at every 30th row using `.iloc[::30]` to indicate approximate monthly reference points._

```python
# Close vs Open price with different line styles and monthly markers
fig, ax = plt.subplots(figsize=(10, 4))
ax.plot(asml["date"], asml["close"], color="#7aa2f7", linewidth=2, label="Close")
ax.plot(asml["date"], asml["open"], color="#e0af68", linewidth=1, linestyle="--", label="Open")
ax.plot(asml["date"].iloc[::30], asml["close"].iloc[::30], "o",
        color="#f7768e", markersize=6, label="Monthly mark")
ax.set_title("Line Styles & Markers")
ax.legend()
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_03.png)

### Fill Between

#### Matplotlib | Fill between

_Traces ASML's close price as a line and shades the gap between `low` and `high` using `fill_between()` with `alpha=0.2`, visualizing daily volatility as a blue band around the close._

```python
# Close price with shaded high-low range showing daily volatility
fig, ax = plt.subplots(figsize=(10, 4))
ax.plot(asml["date"], asml["close"], color="#7aa2f7")
ax.fill_between(asml["date"], asml["low"], asml["high"], alpha=0.2, color="#7aa2f7", label="High-Low range")
ax.set_title("ASML: Close with High-Low Band")
ax.legend()
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_04.png)

### Dual Y-axis

#### Matplotlib | Dual y-axis

_Creates a twin axes with `twinx()` — ASML close price traces on the left y-axis in blue, and daily volume bars overlay on the right y-axis in green with `alpha=0.3`, sharing the same date x-axis._

```python
# Price on left axis, volume bars on right axis — shows if volume spikes align with price moves
fig, ax1 = plt.subplots(figsize=(10, 4))
ax1.plot(asml["date"], asml["close"], color="#7aa2f7", label="Close")
ax1.set_ylabel("Close", color="#7aa2f7")

ax2 = ax1.twinx()
ax2.bar(asml["date"], asml["volume"], alpha=0.3, color="#9ece6a", label="Volume")
ax2.set_ylabel("Volume", color="#9ece6a")

ax1.set_title("ASML: Price & Volume")
fig.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_05.png)

## Bar Charts


Bar charts compare **discrete categories** by encoding values as bar lengths. Horizontal bars work better when category labels are long. Grouped bars compare sub-categories side by side; stacked bars show part-to-whole composition.

**Best for:** Categorical comparisons (revenue by department, scores by sector, counts by group). Use when you have a small-to-medium number of categories (<20). For many categories, consider sorting or filtering.

### Horizontal Bar

#### Pandas | Horizontal bar

_Renders the pre-computed `sector_avg` Series as a horizontal bar chart using `.plot.barh()` — sectors are already sorted by ascending mean score, so the shortest bar is at the bottom and the longest at the top._

```python
# Horizontal ranking of sectors by average composite score
sector_avg.plot.barh(title="Avg Composite Score by Sector", figsize=(10, 5))
plt.xlabel("Score")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_06.png)

### Vertical Bar

#### Pandas | Vertical bar

_Reuses the same `sector_avg` Series with `.plot.bar()` for vertical bars, rotating x-tick labels 45° with `ha="right"` to prevent overlap of sector names._

```python
# Same ranking as vertical bars (easier axis labels when few categories)
sector_avg.plot.bar(title="Avg Composite Score by Sector", figsize=(10, 5))
plt.ylabel("Score")
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_07.png)

### Grouped Bar

#### Pandas | Grouped bar

_Aggregates `momentum_score` and `relative_value_score` per sector, then calls `.plot.bar()` on the resulting DataFrame — Pandas places the two metrics side by side for each sector automatically._

```python
# Side-by-side comparison of momentum and value scores per sector
agg = scores_pd.groupby("sector")[["momentum_score", "relative_value_score"]].mean()
agg.plot.bar(figsize=(10, 5), title="Momentum vs Value by Sector")
plt.ylabel("Score")
plt.xticks(rotation=45, ha="right")
plt.legend(title="Metric")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_08.png)

### Stacked Bar

#### Pandas | Stacked bar

_Calls `.plot.bar(stacked=True)` on the same per-sector aggregation — the two score bars are stacked vertically per sector, so total bar height represents the combined momentum + value score._

```python
# Stacked view: total score magnitude per sector, split by metric
agg.plot.bar(stacked=True, figsize=(10, 5), title="Momentum + Value Stacked")
plt.ylabel("Score")
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_09.png)

### Bar with Error Bars

#### Pandas | Bar with error bars

_Computes mean and standard deviation of `composite_score` per sector via `.agg(["mean", "std"])`, then renders horizontal bars with `xerr=stats["std"]` — cap-ended whiskers show ±1 std dev per sector._

```python
# Mean composite score per sector with standard deviation error bars showing dispersion
stats = scores_pd.groupby("sector")["composite_score"].agg(["mean", "std"])
fig, ax = plt.subplots(figsize=(10, 5))
stats["mean"].plot.barh(xerr=stats["std"], ax=ax, capsize=4, title="Score ± Std Dev")
plt.xlabel("Composite Score")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_10.png)

## Histograms


Histograms bin continuous data to show its **distribution shape** — normal, skewed, bimodal, etc. Bin count matters: too few hides structure, too many adds noise. KDE (kernel density estimation) overlays a smooth curve estimate of the probability density.

**Best for:** Exploring a single continuous variable (prices, returns, test scores). Answers: "What is the typical range? Are there outliers? Is the data symmetric?"

### Basic Histogram

#### Pandas | Basic histogram

_Bins all 66K close price values from `ohlcv_pd` into 50 buckets using `.plot.hist(bins=50)` — the resulting distribution shows the price concentration across all EuroStoxx 50 stocks and years._

```python
# Distribution of all close prices across all stocks — reveals price clustering and outliers
ohlcv_pd["close"].plot.hist(bins=50, title="Distribution of Close Prices", figsize=(10, 4))
plt.xlabel("Close Price")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_11.png)

### Overlaid Histograms

#### Matplotlib | Overlaid histograms

_Plots three overlapping histograms (ASML, SAP, SIE close prices) on shared axes using `alpha=0.5` per histogram — where bars overlap, blended colors reveal which price ranges these stocks share._

```python
# Overlaid histograms to compare price distributions of 3 stocks
fig, ax = plt.subplots(figsize=(10, 4))
for sym in ["ASML.AS", "SAP.DE", "SIE.DE"]:
    ohlcv_pd[ohlcv_pd["symbol"] == sym]["close"].plot.hist(
        bins=40, alpha=0.5, label=sym, ax=ax)
ax.set_title("Close Price Distribution (Overlaid)")
ax.legend()
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_12.png)

### Histogram + KDE

#### Pandas | Histogram + KDE

_Normalizes ASML's close price histogram with `density=True` and overlays `plot.kde()` on the same axes — the KDE line smooths the distribution shape, showing that prices cluster around a central mode with a light right skew._

```python
# ASML price histogram with KDE overlay showing the smooth probability density
fig, ax = plt.subplots(figsize=(10, 4))
asml["close"].plot.hist(bins=30, density=True, alpha=0.6, ax=ax, label="Histogram")
asml["close"].plot.kde(ax=ax, color="#f7768e", linewidth=2, label="KDE")
ax.set_title("ASML Close: Histogram + KDE")
ax.legend()
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_13.png)

### 2D Hexbin Histogram

#### Matplotlib | 2D hexbin histogram

_Bins all (momentum, value) score pairs into a 20×20 hexagonal grid using `ax.hexbin(gridsize=20)` and maps count to a `YlOrRd` color scale — the darkest hex cells reveal where most stocks cluster in 2D score space._

```python
# 2D density of momentum vs value scores — reveals where most stocks cluster
fig, ax = plt.subplots(figsize=(8, 6))
hb = ax.hexbin(scores_pd["momentum_score"], scores_pd["relative_value_score"],
               gridsize=20, cmap="YlOrRd")
plt.colorbar(hb, ax=ax, label="Count")
ax.set_xlabel("Momentum Score")
ax.set_ylabel("Relative Value Score")
ax.set_title("2D Hexbin: Momentum vs Value")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_14.png)

## Scatter Plots


Scatter plots reveal **relationships between two continuous variables** — correlation, clusters, and outliers. Adding color encodes a third variable (categorical or continuous); size encodes a fourth (bubble chart). No visible pattern = no linear relationship, but non-linear patterns may still exist.

**Best for:** Exploring correlation between two numeric columns (price vs volume, momentum vs value). Works well up to ~10K points; beyond that, use hexbin or density plots to avoid overplotting.

### Basic Scatter

#### Pandas | Basic scatter

_Calls `.plot.scatter(x="momentum_score", y="relative_value_score")` on `scores_pd`, rendering all 466 stock–date observations as semi-transparent dots with `alpha=0.5` to expose overlap density._

```python
# Relationship between momentum and relative value scores across all stocks
scores_pd.plot.scatter(x="momentum_score", y="relative_value_score",
                       alpha=0.5, title="Momentum vs Value", figsize=(8, 6))
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_15.png)

### Color-mapped Scatter

#### Matplotlib | Color-mapped scatter

_Maps `composite_score` to the `coolwarm` diverging colormap via `ax.scatter(c=scores_pd["composite_score"])` — warm tones identify stocks with high composite scores; cool tones identify low scorers in the momentum × value space._

```python
# Same scatter, color-mapped by composite score to reveal which quadrant has highest scores
fig, ax = plt.subplots(figsize=(8, 6))
sc = ax.scatter(scores_pd["momentum_score"], scores_pd["relative_value_score"],
                c=scores_pd["composite_score"], cmap="coolwarm", alpha=0.7, edgecolors="none")
plt.colorbar(sc, ax=ax, label="Composite Score")
ax.set_xlabel("Momentum")
ax.set_ylabel("Relative Value")
ax.set_title("Scatter colored by Composite Score")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_16.png)

### Bubble Chart

#### Matplotlib | Bubble chart (size + color)

_Normalizes `composite_score` to positive bubble sizes (`sizes`) and passes both `s=sizes` and `c=scores_pd["composite_score"]` to `ax.scatter()` — each stock appears as a bubble where area and hue simultaneously encode the same score magnitude._

```python
# Bubble chart: position = momentum vs value, size & color = composite score magnitude
fig, ax = plt.subplots(figsize=(8, 6))
# Normalize composite_score to positive sizes
sizes = (scores_pd["composite_score"] - scores_pd["composite_score"].min() + 0.1) * 100
sc = ax.scatter(scores_pd["momentum_score"], scores_pd["relative_value_score"],
                s=sizes, c=scores_pd["composite_score"], cmap="viridis",
                alpha=0.6, edgecolors="#3b4261", linewidth=0.5)
plt.colorbar(sc, ax=ax, label="Composite Score")
ax.set_title("Bubble Chart: size & color = composite score")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_17.png)

## Area Charts


Area charts are line charts with the region below filled, emphasizing **magnitude** and **cumulative totals**. Stacked areas show how components contribute to a total over time.

**Best for:** Time-series composition data (market share over time, portfolio allocation, traffic sources). Keep to 3–5 series; too many layers become unreadable.

### Basic Area

#### Pandas | Basic area

_Calls `.plot.area(x="date", y="close", alpha=0.4)` on the ASML subset — the filled region from zero to close emphasizes cumulative magnitude and makes price level immediately visible._

```python
# ASML close price as filled area — emphasizes magnitude relative to zero
asml.plot.area(x="date", y="close", alpha=0.4, title="ASML Close (Area)", figsize=(10, 4), legend=False)
plt.ylabel("Close")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_18.png)

### Stacked Area

#### Pandas | Stacked area

_Pivots ASML, SAP, and SIE daily volume into a wide DataFrame (rows = dates, cols = symbols), then calls `.plot.area(alpha=0.6)` — the three layers stack so total area height represents combined daily volume across the three stocks._

```python
# Pivot daily volume for top 3 stocks
vol_pivot = top5[top5["symbol"].isin(top5_syms[:3])].pivot_table(
    index="date", columns="symbol", values="volume", aggfunc="sum")
vol_pivot.plot.area(figsize=(10, 5), alpha=0.6, title="Stacked Volume (Top 3)")
plt.ylabel("Volume")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_19.png)

## Pie & Donut


Pie charts show **part-to-whole proportions** for a single categorical variable. Humans judge angles poorly, so pie charts work best with ≤6 slices and clear size differences. Donut charts free the center for labels or KPIs.

**Best for:** Showing composition when there are few categories with distinct proportions (market share, budget allocation). For precise comparison or many categories, prefer bar charts.

### Pie Chart

#### Matplotlib | Pie chart

_Groups `dim_pd` by `sector`, computes counts, and builds label strings as `"name\ncount (pct%)"` — `ax.pie()` renders each sector as a colored slice with the pre-computed label embedded._

```python
# Proportion of stocks in each sector within the EuroStoxx 50 index
sector_count = dim_pd.groupby("sector").size()
total = sector_count.sum()
fig, ax = plt.subplots(figsize=(8, 8))
NL = chr(10)
labels = [f"{name}{NL}{count} ({count/total*100:.0f}%)" for name, count in zip(sector_count.index, sector_count)]
colors = ["#1a3a5c", "#2d4a3e", "#5c4a1a", "#5c1a2a", "#3a2a5c",
          "#1a4a5c", "#1a5c4a", "#5c3a1a", "#1a4a4a", "#2a3a4a",
          "#3b4261", "#292e42"]
ax.pie(sector_count.tolist(), labels=labels, startangle=90,
       colors=colors[:len(sector_count)])
ax.set_title("Stocks per Sector")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_20.png)

### Donut Chart

#### Matplotlib | Donut chart

_Renders the same sector proportions as a pie, then adds a `Circle` patch at radius 0.60 with the background color to punch out a donut hole — the center space can display a total count or KPI label._

```python
# Same proportions as donut — center space available for a KPI or total
sector_count = dim_pd.groupby("sector").size()
total = sector_count.sum()
fig, ax = plt.subplots(figsize=(8, 8))
NL = chr(10)
labels = [f"{name}{NL}{count} ({count/total*100:.0f}%)" for name, count in zip(sector_count.index, sector_count)]
colors = ["#1a3a5c", "#2d4a3e", "#5c4a1a", "#5c1a2a", "#3a2a5c",
          "#1a4a5c", "#1a5c4a", "#5c3a1a", "#1a4a4a", "#2a3a4a",
          "#3b4261", "#292e42"]
ax.pie(sector_count.tolist(), labels=labels, startangle=90, pctdistance=0.85,
       colors=colors[:len(sector_count)])
ax.add_artist(Circle((0, 0), 0.60, fc="#1a1b26"))
ax.set_title("Stocks per Sector (Donut)")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_21.png)

## Seaborn — Statistical Plots


Seaborn provides high-level functions for **statistical visualization** — distribution shapes, group comparisons, correlations, and regression. It handles grouping, faceting, and confidence intervals automatically.

**Best for:** Exploratory data analysis (EDA) when you need to understand distributions (violin, box, KDE), relationships (regression, pair plots), and group differences (strip, swarm). Accepts Pandas DataFrames directly with column-name-based API.

### Box Plot

#### How to read
- **Box** = interquartile range (IQR): middle 50% of data (Q1 to Q3)
- **Line inside box** = median (Q2)
- **Whiskers** = extend to the farthest point within 1.5×IQR from the box edges
- **Circles/diamonds beyond whiskers** = outliers (individual data points outside 1.5×IQR)
- **Notch** (if enabled) = 95% confidence interval around the median; non-overlapping notches between groups suggest significantly different medians

#### Seaborn | Box plot

_Plots composite score distributions for each sector as a box plot, using `sns.boxplot()` on `scores_pd` — each box spans the IQR, the centre line marks the median, whiskers extend to 1.5×IQR, and dots beyond whiskers are outlier stocks._

```python
# Quartile summary of composite scores per sector — shows median, IQR, and outliers
fig, ax = plt.subplots(figsize=(10, 5))
sns.boxplot(data=scores_pd, x="sector", y="composite_score", ax=ax)
ax.set_title("Composite Score by Sector")
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_22.png)

### Violin Plot

#### How to read
- **Width** = density estimate (wider = more data points at that value)
- **Inner box/lines** = quartiles (same as box plot: Q1, median, Q3)
- **Shape** = full distribution — symmetric = normal; multiple bulges = multimodal; long tail = skewed
- Compare width across groups: a wider section means more stocks cluster at that score level

#### Seaborn | Violin plot

_Draws violin plots of composite scores by sector using `inner="quart"`, revealing the full density shape (width = data density) with Q1, median, and Q3 lines drawn inside each violin._

```python
# Full distribution shape per sector — wider = more stocks at that score level
fig, ax = plt.subplots(figsize=(10, 5))
sns.violinplot(data=scores_pd, x="sector", y="composite_score", inner="quart", ax=ax)
ax.set_title("Composite Score (Violin)")
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_23.png)

### Strip Plot

#### How to read
- **Each dot** = one data point (one stock)
- **Jitter** = small random horizontal offset to prevent dots from stacking on top of each other
- **Dense clusters** = many values near that level; isolated dots = outliers
- Best for small-to-medium datasets (<500 points per group)

#### Seaborn | Strip plot

_Renders every stock's composite score as a jittered dot within its sector band using `sns.stripplot()`, with `alpha=0.5` to expose overlapping points and reveal where values cluster most densely._

```python
# Every individual stock plotted as a dot, jittered to avoid overlap
fig, ax = plt.subplots(figsize=(10, 5))
sns.stripplot(data=scores_pd, x="sector", y="composite_score", jitter=True, alpha=0.5, ax=ax)
ax.set_title("Composite Score (Strip)")
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_24.png)

### Swarm Plot

#### How to read
- Like strip plot, but dots are algorithmically spread so **no two overlap**
- **Width of the swarm** at a given y-value reflects how many points are near that value (like a violin)
- Gives exact count — every point is visible and countable
- Slow for large datasets (>300 points per group)

#### Seaborn | Swarm plot

_Positions each stock's composite score as a non-overlapping dot within its sector band using `sns.swarmplot()` — swarm width at any score level directly reflects how many stocks score there, combining the precision of a strip plot with the density readability of a violin._

```python
# Swarm works best with smaller datasets
fig, ax = plt.subplots(figsize=(10, 5))
sns.swarmplot(data=scores_pd, x="sector", y="composite_score", size=3, ax=ax)
ax.set_title("Composite Score (Swarm)")
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_25.png)

### Heatmap

#### How to read
- **Color intensity** = magnitude of the value in each cell
- **Diverging scale (RdBu):** red = strong positive, white = zero, blue = strong negative
- **Diagonal** (in correlation matrix) = always 1.0 (variable correlated with itself)
- **Off-diagonal symmetry** = correlation is symmetric: corr(A,B) = corr(B,A)
- Look for dark clusters of red/blue — these indicate groups of highly correlated variables

#### Seaborn | Heatmap

_Computes the pairwise Pearson correlation matrix for all numeric columns in `scores_pd` and renders it as an annotated heatmap — red cells identify positively correlated score pairs, blue cells identify negatively correlated ones._

```python
# Pairwise correlation between all numeric score columns — red = positive, blue = negative
corr = scores_pd.select_dtypes("number").corr()
fig, ax = plt.subplots(figsize=(12, 10))
sns.heatmap(corr, annot=True, fmt=".2f", cmap="RdBu_r", center=0,
            square=True, linewidths=0.5, ax=ax,
            annot_kws={"size": 7})
ax.set_title("Score Correlation Matrix")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_26.png)

### Clustermap

#### How to read
- Same as heatmap, but rows and columns are **reordered by hierarchical clustering**
- **Dendrograms** (tree diagrams on the sides) show which variables are most similar
- Variables that merge early in the tree are more correlated with each other
- Look for diagonal blocks of strong color — these are clusters of related metrics

#### Seaborn | Clustermap (hierarchical clustering)

_Passes the same correlation matrix to `sns.clustermap()` — rows and columns are reordered by Ward hierarchical clustering, so metrics that correlate strongly appear adjacent, exposing cluster structure that the fixed-order heatmap may hide._

```python
# Clustermap reorders rows/cols by similarity
g = sns.clustermap(corr, annot=True, fmt=".2f", cmap="RdBu_r", center=0,
                   figsize=(12, 10), linewidths=0.5,
                   annot_kws={"size": 7})
g.fig.suptitle("Clustered Correlation Matrix", y=1.02)
plt.show()
```

![chart](/static/img/df_py_08/viz_27.png)

### Pair Plot

#### How to read
- **Grid of scatter plots**: every pair of numeric columns plotted against each other
- **Diagonal** = distribution of each variable (KDE or histogram)
- **Off-diagonal** = scatter of row-variable (y) vs column-variable (x)
- **Color** = categorical grouping — separated clusters suggest the groups differ on those dimensions
- Quick way to spot correlations, clusters, and outliers across all variable pairs

#### Seaborn | Pair plot

_Generates a sector-colored pair plot for `momentum_score`, `relative_value_score`, and `composite_score` — scatter panels reveal cross-metric relationships while the diagonal KDE panels show each score's distribution per sector._

```python
# Pair plot for selected numeric columns
cols = ["momentum_score", "relative_value_score", "composite_score", "sector"]
g = sns.pairplot(scores_pd[cols], hue="sector", diag_kind="kde",
                 plot_kws={"alpha": 0.5, "s": 20}, height=2.5)
g.fig.suptitle("Pair Plot: Scores by Sector", y=1.02)
plt.show()
```

![chart](/static/img/df_py_08/viz_28.png)

### Joint Plot

#### How to read
- **Center** = scatter (or hexbin/KDE) of two variables
- **Top margin** = distribution of the x-variable
- **Right margin** = distribution of the y-variable
- **Hexbin mode**: color intensity = count of points in each hex — dark = dense cluster
- Combines relationship analysis with individual distributions in one view

#### Seaborn | Joint plot

_Plots momentum vs. relative value scores as a hexbin joint plot using `kind="hex"` — hex color intensity shows where most stocks concentrate in score space, while the top and right margins show each variable's marginal distribution._

```python
# Momentum vs value with marginal hexbin density showing where most stocks concentrate
g = sns.jointplot(data=scores_pd, x="momentum_score", y="relative_value_score",
                  kind="hex", height=7)
g.fig.suptitle("Joint Plot: Momentum vs Value", y=1.02)
plt.show()
```

![chart](/static/img/df_py_08/viz_29.png)

### KDE Plot

#### How to read
- **Curve height** = estimated probability density (not count)
- **Peaks** = modes — values where data concentrates
- **Width/spread** = variance — wider curve = more dispersed data
- **Fill** = area under curve always sums to 1.0
- Overlaying multiple KDEs reveals which groups overlap or separate in their distributions

#### Seaborn | KDE plot

_Overlays filled KDE curves for ASML, SAP, and SIE close prices — `fill=True` with `alpha=0.3` lets the distributions overlap visibly, showing which stocks share a price range and which are distinct._

```python
# Smooth density curves comparing close price distributions across 3 stocks
fig, ax = plt.subplots(figsize=(10, 5))
for sym in ["ASML.AS", "SAP.DE", "SIE.DE"]:
    data = ohlcv_pd[ohlcv_pd["symbol"] == sym]["close"]
    sns.kdeplot(data, label=sym, ax=ax, fill=True, alpha=0.3)
ax.set_title("KDE: Close Price Distribution")
ax.legend()
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_30.png)

### Regression Plot

#### How to read
- **Dots** = individual data points
- **Line** = OLS (ordinary least squares) best-fit line
- **Shaded band** = 95% confidence interval around the regression line
- **Steep slope** = strong relationship; **flat slope** = weak/no relationship
- Wide confidence band = high uncertainty (small sample or high variance)

#### Seaborn | Regression plot

_Fits an OLS regression line between `momentum_score` and `relative_value_score` across all stocks in `scores_pd`, rendering scatter points at `alpha=0.4` and a red best-fit line with shaded 95% confidence band._

```python
# Linear regression fit between momentum and value — shows direction and strength of relationship
fig, ax = plt.subplots(figsize=(8, 6))
sns.regplot(data=scores_pd, x="momentum_score", y="relative_value_score",
            scatter_kws={"alpha": 0.4}, line_kws={"color": "#f7768e"}, ax=ax)
ax.set_title("Regression: Momentum vs Value")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_31.png)

### Residual Plot

#### How to read
- **Each dot** = residual (actual value minus predicted value from linear fit)
- **Ideal pattern**: random scatter around zero — no visible structure
- **Funnel shape** = heteroscedasticity (variance changes with x)
- **Curved pattern** = the relationship is non-linear — linear model is a poor fit
- **Clusters** = possible subgroups that the model treats as one

#### Seaborn | Residual plot

_Plots the residuals from regressing `relative_value_score` on `momentum_score` — a random horizontal scatter around zero confirms the linear model is adequate; curves or fans indicate nonlinearity or heteroscedasticity._

```python
# Residuals from the linear fit — random scatter = good fit, patterns = nonlinearity
fig, ax = plt.subplots(figsize=(8, 5))
sns.residplot(data=scores_pd, x="momentum_score", y="relative_value_score",
              scatter_kws={"alpha": 0.4}, ax=ax)
ax.set_title("Residuals: Momentum vs Value")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_32.png)

### Count Plot

#### How to read
- **Bar length** = number of observations in each category
- Essentially a histogram for categorical data
- Ordered by count to quickly identify the most/least populated categories

#### Seaborn | Count plot

_Draws a horizontal count bar for each sector in `dim_pd`, ordered from most to fewest constituent companies — bar length directly reads as the number of index members per sector._

```python
# Count of stocks in each sector — bar length = number of constituent companies
fig, ax = plt.subplots(figsize=(10, 5))
sns.countplot(data=dim_pd, y="sector", order=dim_pd["sector"].value_counts().index, ax=ax)
ax.set_title("Number of Stocks per Sector")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_33.png)

### ECDF

#### How to read
- **X-axis** = variable values; **Y-axis** = cumulative proportion (0 to 1)
- Read as: "what fraction of data falls below this value?"
- **Steep section** = many values concentrated in a narrow range
- **Flat section** = sparse region with few data points
- Curves shifted right = higher values overall; compare vertical gaps between groups at any x to see which group has more data below that threshold

#### Seaborn | ECDF (Empirical CDF)

_Plots one ECDF curve per sector using `scores_pd`, so each curve answers "what fraction of stocks in this sector score below X?" — sectors with right-shifted curves have systematically higher composite scores._

```python
# Cumulative distribution per sector — read off what % of stocks score below a threshold
fig, ax = plt.subplots(figsize=(10, 4))
sns.ecdfplot(data=scores_pd, x="composite_score", hue="sector", ax=ax)
ax.set_title("ECDF of Composite Score by Sector")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_34.png)

### Rug Plot

#### How to read
- **Short ticks on the axis** = exact position of each data point
- Combined with KDE, it grounds the smooth curve in actual observations
- **Dense ticks** = cluster of values; **gaps** = sparse regions
- Useful for small-to-medium datasets; too many ticks become a solid bar

#### Seaborn | Rug plot

_Draws a filled KDE curve for `composite_score` across all stocks in `scores_pd`, then adds `sns.rugplot()` tick marks on the x-axis — each tick is one stock, grounding the smooth density in the actual data points._

```python
# KDE density with rug ticks showing exact score positions of each stock
fig, ax = plt.subplots(figsize=(10, 3))
sns.kdeplot(data=scores_pd, x="composite_score", fill=True, alpha=0.3, ax=ax)
sns.rugplot(data=scores_pd, x="composite_score", height=0.1, ax=ax)
ax.set_title("KDE + Rug: Composite Score")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_35.png)

## Matplotlib — Advanced


Matplotlib is the low-level engine behind Pandas and Seaborn plots. Use it directly when you need **full control**: custom layouts, mixed chart types in subplots, annotations, polar coordinates, or any visualization not covered by higher-level APIs.

**Best for:** Publication-quality figures, custom dashboards, unconventional chart types (radar, stem), and any scenario where you need pixel-level control over every element.

### Subplots Grid

#### Matplotlib | Subplots grid

_Creates a 2×2 subplot grid with `plt.subplots(2, 2)` — top row: close price line and volume line; bottom row: close price histogram and open-vs-close scatter — all fed from the 365-day `asml` subset._

```python
# 2x2 dashboard: close price, volume, distribution, and open-vs-close scatter for ASML
fig, axes = plt.subplots(2, 2, figsize=(12, 8))

asml.plot(x="date", y="close", ax=axes[0, 0], title="Close", legend=False)
asml.plot(x="date", y="volume", ax=axes[0, 1], title="Volume", legend=False)
axes[1, 0].hist(asml["close"], bins=30)
axes[1, 0].set_title("Close Distribution")
axes[1, 1].scatter(asml["open"], asml["close"], alpha=0.5, s=10)
axes[1, 1].set_title("Open vs Close")

fig.suptitle("ASML Dashboard", fontsize=16)
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_36.png)

### Step Plot

#### How to read
- Value stays **flat** between changes, then jumps vertically
- Emphasizes that the value is constant between updates (unlike a line chart which implies interpolation)
- Best for discrete-step data: interest rates, pricing tiers, digital signals

#### Matplotlib | Step plot

_Renders ASML's 365-day close price as a step function using `where="mid"` — each horizontal segment holds the price constant between observations, making it explicit that no value is interpolated between trading days._

```python
# Step plot — shows price as flat segments between changes (useful for discrete-step data)
fig, ax = plt.subplots(figsize=(10, 4))
ax.step(asml["date"], asml["close"], where="mid", color="#7aa2f7")
ax.set_title("ASML Close (Step)")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_37.png)

### Stem Plot

#### How to read
- **Vertical line** from baseline (zero) to the value — length = magnitude
- **Dot at tip** = the actual value
- Lines above zero = positive; below = negative
- Best for discrete events: daily returns, impulse responses, sparse signals

#### Matplotlib | Stem plot

_Computes ASML daily percentage returns with `pct_change() * 100`, then renders each as a vertical stem from zero — stem length encodes daily return magnitude, with stems above/below zero distinguishing gains from losses._

```python
# Stem plot of daily returns — each vertical line = one day's % change from previous close
returns = asml["close"].pct_change().dropna() * 100
fig, ax = plt.subplots(figsize=(10, 4))
ax.stem(asml["date"].iloc[1:], returns, linefmt="#7aa2f7", markerfmt="o", basefmt="#3b4261")
ax.set_title("ASML Daily Returns (%)")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_38.png)

### Stackplot

#### Matplotlib | Stackplot

_Pivots ASML, SAP, and SIE daily volume into wide format, drops NaN rows, then calls `ax.stackplot()` with unpacked columns — provides finer control than Pandas `.plot.area()` for custom colors and per-layer alpha._

```python
# Native matplotlib stacked area — same as Pandas .plot.area but with more control
vol_pivot = top5[top5["symbol"].isin(top5_syms[:3])].pivot_table(
    index="date", columns="symbol", values="volume", aggfunc="sum").dropna()
fig, ax = plt.subplots(figsize=(10, 5))
ax.stackplot(vol_pivot.index, *[vol_pivot[c] for c in vol_pivot.columns],
             labels=vol_pivot.columns, alpha=0.7)
ax.set_title("Stacked Volume")
ax.legend(loc="upper left")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_39.png)

### Polar / Radar Chart

#### How to read
- Each **spoke** = one dimension/metric (e.g., momentum, value, sentiment, composite)
- **Distance from center** = score magnitude on that dimension
- **Shape** reveals the profile: balanced (regular polygon) vs specialized (elongated toward one spoke)
- Useful for comparing multi-dimensional profiles of a single entity

#### Matplotlib | Polar / radar chart

_Constructs a polar radar chart for ASML's four scores (momentum, relative value, sentiment, composite) — the polygon is closed by appending the first value, and the filled area shows how ASML's profile balances across the four dimensions._

```python
# Radar chart for one stock's scores
cols = ["momentum_score", "relative_value_score", "sentiment_score", "composite_score"]
vals = scores_pd[scores_pd["symbol"] == "ASML.AS"][cols].iloc[0].tolist()
vals += [vals[0]]  # close the polygon

angles = np.linspace(0, 2 * np.pi, len(cols), endpoint=False).tolist()
angles += [angles[0]]

fig, ax = plt.subplots(figsize=(6, 6), subplot_kw=dict(polar=True))
ax.plot(angles, vals, color="#7aa2f7", linewidth=2)
ax.fill(angles, vals, alpha=0.2, color="#7aa2f7")
ax.set_xticks(angles[:-1])
ax.set_xticklabels(cols, size=9)
ax.set_title("ASML Score Radar")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_40.png)

### Error Bar Plot

#### How to read
- **Dot** = point estimate (mean)
- **Bars** = uncertainty range (here: ±1 standard deviation)
- **Short bars** = low dispersion (consistent values); **long bars** = high dispersion
- Non-overlapping error bars suggest the groups differ meaningfully

#### Matplotlib | Error bar plot

_Groups `scores_pd` by sector, computes mean and standard deviation of `composite_score`, then plots mean as a dot with ±1 std dev bars — sectors sorted ascending so the lowest-scoring sectors appear at the bottom._

```python
# Mean composite score per sector with std dev error bars — wider bars = more dispersion
stats = scores_pd.groupby("sector")["composite_score"].agg(["mean", "std"]).sort_values("mean")
fig, ax = plt.subplots(figsize=(10, 5))
ax.errorbar(stats.index, stats["mean"], yerr=stats["std"], fmt="o",
            capsize=5, color="#7aa2f7", ecolor="#f7768e")
ax.set_title("Composite Score: Mean ± Std")
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_41.png)

### Annotations and Text

#### Matplotlib | Annotations & text

_Finds the max and min close price indices with `idxmax()`/`idxmin()`, adds `ax.annotate()` arrows pointing to each, then draws a dashed `axhline` at the mean price — demonstrating Matplotlib's annotation layer on top of a line chart._

```python
# Close price with annotated max/min points and mean reference line
fig, ax = plt.subplots(figsize=(10, 4))
ax.plot(asml["date"], asml["close"], color="#7aa2f7")

# Mark max and min
max_idx = int(asml["close"].idxmax())
min_idx = int(asml["close"].idxmin())
for idx, label, color, offset in [
    (max_idx, "Max", "#9ece6a", (20, 15)),
    (min_idx, "Min", "#f7768e", (-60, -40)),
]:
    x = asml["date"].loc[idx]  # type: ignore[arg-type]
    y: float = asml["close"].loc[idx].item()  # type: ignore[union-attr]
    ax.annotate(f"{label}: {y:.0f}", xy=(x, y),
                xytext=offset, textcoords="offset points",
                arrowprops=dict(arrowstyle="->", color=color), color=color)

ax.axhline(asml["close"].mean(), linestyle="--", color="#e0af68", alpha=0.7, label="Mean")
ax.legend()
ax.set_title("ASML with Annotations")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_42.png)

## Polars to Pandas for Plotting

Polars has no built-in `.plot()` method. Matplotlib and Seaborn both operate on NumPy arrays and Pandas DataFrames — they cannot consume a Polars DataFrame directly. The standard workflow is `.to_pandas()` for conversion.

> [!info] Polars + Plotly: no conversion needed (Plotly 6+)
>
> **Plotly Express** accepts Polars DataFrames directly since **Plotly 6.0** (released 2025). Column names are resolved via the `__dataframe__` protocol. This means `px.line(df_polars, x="date", y="close")` works without `.to_pandas()`. See the `## Plotly with Polars DataFrames` section below for examples.
>
> **Matplotlib and Seaborn** do not support the `__dataframe__` protocol — always convert with `.to_pandas()` before using these libraries.

> [!warning] `.to_pandas()` memory cost on large Polars frames
>
> `.to_pandas()` copies the entire DataFrame into memory as a new Pandas object. For a 5M-row frame, this can double peak memory usage. If you only need to plot a subset, filter and slice in Polars **before** converting: `df.filter(...).head(10_000).to_pandas()`. For `LazyFrame`, call `.collect().to_pandas()` — `.collect()` triggers full evaluation first.

### Conversion Example

#### Polars | Convert to Pandas for plotting

_Filters `ohlcv_pl` to ASML's last 90 trading days in Polars, chains `.to_pandas()` to produce a Pandas DataFrame, then calls `.plot()` on the result — demonstrating the complete Polars → Pandas → Matplotlib pipeline in three chained calls._

```python
asml_pl = ohlcv_pl.filter(pl.col("symbol") == "ASML.AS").sort("date").tail(90)
asml_pl.to_pandas().plot(x="date", y="close", title="ASML (Polars → Pandas plot)",
                         figsize=(10, 4), legend=False)
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_43.png)

## Matplotlib / Seaborn Summary

> [!question] When to use Matplotlib/Seaborn vs Plotly?
>
> - **Matplotlib/Pandas `.plot()`** — publication-quality static figures (PNG/SVG/PDF), fine-grained layout control, integration with reporting pipelines that don't render HTML. Required for Seaborn's statistical plots (violin, pair, joint, clustermap).
> - **Seaborn** — EDA shortcut for statistical visualization: distribution comparison, regression overlays, clustered correlation matrices. Accepts DataFrames directly with column-name API; handles grouping and confidence intervals automatically.
> - **Plotly** — interactive exploration in notebooks and dashboards (hover, zoom, dropdown filters). Best for stakeholder-facing output or when you need to explore specific data points. Polars DataFrames accepted directly since Plotly 6.
>
> Default workflow: use **Seaborn/Matplotlib** for analysis you'll export to a report; use **Plotly** for analysis you'll share as a notebook or web dashboard.

| Chart | Matplotlib / Pandas | Seaborn |
|---|---|---|
| Line | `ax.plot()` / `df.plot()` | `sns.lineplot()` |
| Bar | `df.plot.bar()` / `.barh()` | `sns.barplot()` / `sns.countplot()` |
| Histogram | `df.plot.hist()` | `sns.histplot()` |
| KDE | `df.plot.kde()` | `sns.kdeplot()` |
| Scatter | `df.plot.scatter()` | `sns.scatterplot()` / `sns.regplot()` |
| Area | `df.plot.area()` / `ax.stackplot()` | — |
| Pie | `df.plot.pie()` | — |
| Box | — | `sns.boxplot()` |
| Violin | — | `sns.violinplot()` |
| Strip | — | `sns.stripplot()` |
| Swarm | — | `sns.swarmplot()` |
| Heatmap | `ax.imshow()` | `sns.heatmap()` / `sns.clustermap()` |
| Pair | — | `sns.pairplot()` |
| Joint | — | `sns.jointplot()` |
| ECDF | — | `sns.ecdfplot()` |
| Regression | — | `sns.regplot()` / `sns.residplot()` |
| Hexbin | `ax.hexbin()` | — |
| Step | `ax.step()` | — |
| Stem | `ax.stem()` | — |
| Polar/Radar | `subplot_kw=dict(polar=True)` | — |
| Error bars | `ax.errorbar()` | — |
| Fill between | `ax.fill_between()` | — |

---

## Plotly — Interactive Charts

Plotly Express (`px`) provides a one-function API for common chart types; Graph Objects (`go`) gives full control over every trace attribute. Plotly accepts **Pandas DataFrames**, **Polars DataFrames** (since Plotly 6), or plain Python lists/arrays — no `.to_pandas()` conversion required for `px` functions.

### Setup and Theme Configuration

```python
pio.renderers.default = "notebook_connected"


# Prepare data subsets
asml_pd = ohlcv_pd[ohlcv_pd["symbol"] == "ASML.AS"].sort_values("date").tail(365).copy()
asml_pl = ohlcv_pl.filter(pl.col("symbol") == "ASML.AS").sort("date").tail(365)
top5 = ["ASML.AS", "SAP.DE", "SIE.DE", "TTE.PA", "AIR.PA"]
top5_pd = ohlcv_pd[ohlcv_pd["symbol"].isin(top5)].sort_values("date").copy()

# Tokyo Night theme for all Plotly charts
pio.templates["tokyo_night"] = go.layout.Template(
    layout=go.Layout(
        paper_bgcolor="#1a1b26",
        plot_bgcolor="#1a1b26",
        font=dict(color="#a9b1d6", family="JetBrains Mono, Consolas, monospace"),
        title=dict(font=dict(color="#c0caf5", size=16)),
        xaxis=dict(gridcolor="#292e42", zerolinecolor="#3b4261", linecolor="#3b4261"),
        yaxis=dict(gridcolor="#292e42", zerolinecolor="#3b4261", linecolor="#3b4261"),
        colorway=["#7aa2f7", "#9ece6a", "#e0af68", "#f7768e", "#bb9af7",
                  "#7dcfff", "#73daca", "#ff9e64", "#2ac3de", "#b4f9f8"],
        legend=dict(bgcolor="rgba(0,0,0,0)", bordercolor="#3b4261"),
        hoverlabel=dict(bgcolor="#24283b", font_color="#c0caf5", bordercolor="#3b4261"),
    )
)
pio.templates.default = "tokyo_night"
```

## Line Charts


Plotly line charts are **interactive** — hover for values, zoom, pan, and export. Faceting splits series into separate panels; dual Y-axes overlay different scales.

**Best for:** Interactive exploration of time-series data in notebooks or dashboards. Ideal when stakeholders need to zoom into specific date ranges or compare series on hover.

### Basic Line

#### Plotly | Basic line

_Calls `px.line(asml_pd, x="date", y="close")` — produces an interactive chart where hovering reveals exact date/price and dragging zooms into any sub-period._

```python
# Interactive close price for ASML — hover for exact values, drag to zoom
fig = px.line(asml_pd, x="date", y="close", title="ASML Close Price (1Y)")
fig.show()
```

<script>
        window.PlotlyConfig = {MathJaxConfig: 'local'};
        if (window.MathJax && window.MathJax.Hub && window.MathJax.Hub.Config) {window.MathJax.Hub.Config({SVG: {font: "STIX-Web"}});}
        </script>
        <script type="module">import "https://cdn.plot.ly/plotly-3.4.0.min"</script>

<iframe src="/static/plotly/df_py_08_01.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Multi-series

#### Plotly | Multi-series (color)

_Passes the `top5_pd` DataFrame to `px.line()` with `color="symbol"` — each stock gets its own colored line, and `hovermode="x unified"` shows all five prices simultaneously when hovering over any date._

```python
# Multi-stock comparison — unified hover shows all prices at the same date
fig = px.line(top5_pd, x="date", y="close", color="symbol",
              title="Close Prices — Top 5 Stocks")
fig.update_layout(hovermode="x unified")
fig.show()
```

<iframe src="/static/plotly/df_py_08_02.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Faceted Lines

#### Plotly | Faceted lines

_Uses `facet_col="symbol"` and `facet_col_wrap=3` to generate a 3×2 grid of line charts — `update_yaxes(matches=None)` decouples each panel's y-axis so high-priced stocks (ASML) and lower-priced ones use their own scale._

```python
# Each stock in its own panel — independent y-axes reveal individual patterns
fig = px.line(top5_pd, x="date", y="close", facet_col="symbol", facet_col_wrap=3,
              title="Close Prices by Stock")
fig.update_yaxes(matches=None, showticklabels=True)  # independent y-axes
fig.show()
```

<iframe src="/static/plotly/df_py_08_03.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Dual Y-axis

#### Plotly | Dual y-axis (Graph Objects)

_Builds a dual-axis figure with `make_subplots(specs=[[{"secondary_y": True}]])` — adds a `go.Scatter` for close on the primary y-axis and a `go.Bar` for volume on the secondary, linked by `hovermode="x unified"`._

```python
# ASML price (line) + volume (bars) on dual axes — volume spikes often precede price moves
fig = make_subplots(specs=[[{"secondary_y": True}]])
fig.add_trace(go.Scatter(x=asml_pd["date"], y=asml_pd["close"], name="Close", mode="lines"), secondary_y=False)
fig.add_trace(go.Bar(x=asml_pd["date"], y=asml_pd["volume"], name="Volume", opacity=0.3), secondary_y=True)
fig.update_layout(title="ASML: Price & Volume", hovermode="x unified")
fig.update_yaxes(title_text="Close", secondary_y=False)
fig.update_yaxes(title_text="Volume", secondary_y=True)
fig.show()
```

<iframe src="/static/plotly/df_py_08_04.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Line Styles and Markers

#### Plotly | Line styles & markers

_Adds two `go.Scatter` traces: close with `mode="lines+markers"`, `dash="solid"`, and size-3 markers; open with `mode="lines"` and `dash="dash"` — demonstrating direct Graph Objects styling without Plotly Express defaults._

```python
# Close vs Open with different line styles — solid, dashed, with markers
fig = go.Figure()
fig.add_trace(go.Scatter(x=asml_pd["date"], y=asml_pd["close"],
                         mode="lines+markers", name="Close",
                         line=dict(color="royalblue", width=2, dash="solid"),
                         marker=dict(size=3)))
fig.add_trace(go.Scatter(x=asml_pd["date"], y=asml_pd["open"],
                         mode="lines", name="Open",
                         line=dict(color="orange", width=1, dash="dash")))
fig.update_layout(title="ASML: Line Styles")
fig.show()
```

<iframe src="/static/plotly/df_py_08_05.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Bar Charts


Interactive bars support hover tooltips, click-to-filter, and animated transitions. Grouped bars (`barmode="group"`) compare side by side; stacked (`barmode="stack"`) show totals. Text labels (`text_auto`) make values readable without consulting the axis.

**Best for:** Presentations and dashboards where viewers need to read exact values via hover, or explore subsets by clicking legend items to toggle categories.

### Basic Bar

#### Plotly | Basic bar

_Aggregates `composite_score` by sector, sorts ascending, then passes to `px.bar()` with `orientation="h"` and `color="composite_score"` mapped to a `Viridis` scale — sectors with higher scores appear darker._

```python
# Horizontal bar ranking of sectors — color intensity reinforces score magnitude
sector_avg = scores_pd.groupby("sector")["composite_score"].mean().reset_index().sort_values("composite_score")
fig = px.bar(sector_avg, x="composite_score", y="sector", orientation="h",
             title="Average Composite Score by Sector",
             color="composite_score", color_continuous_scale="Viridis")
fig.show()
```

<iframe src="/static/plotly/df_py_08_06.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Grouped Bar

#### Plotly | Grouped bar

_Melts the per-sector momentum/value aggregation to long format with `melt(id_vars="sector")`, then calls `px.bar(..., barmode="group")` — two bars per sector appear side by side, colored by metric type._

```python
# Compare momentum vs value scores by sector
agg = scores_pd.groupby("sector")[["momentum_score", "relative_value_score"]].mean().reset_index()
fig = px.bar(agg.melt(id_vars="sector", var_name="metric", value_name="score"),
             x="sector", y="score", color="metric", barmode="group",
             title="Momentum vs Value by Sector")
fig.update_layout(xaxis_tickangle=-45, xaxis_title=None, margin=dict(b=150))
fig.show()
```

<iframe src="/static/plotly/df_py_08_07.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Stacked Bar

#### Plotly | Stacked bar

_Reuses the same melted per-sector momentum/value data but passes `barmode="stack"` — the two score components stack vertically per sector, making total combined height represent the combined score._

```python
# Stacked version of the same data — total bar height = combined score
fig = px.bar(agg.melt(id_vars="sector", var_name="metric", value_name="score"),
             x="sector", y="score", color="metric", barmode="stack",
             title="Momentum + Value Stacked by Sector")
fig.update_layout(xaxis_tickangle=-45, xaxis_title=None, margin=dict(b=150))
fig.show()
```

<iframe src="/static/plotly/df_py_08_08.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Bar with Text Labels

#### Plotly | Bar with text labels

_Passes `text=sector_avg["composite_score"].round(2)` to `px.bar()` and calls `update_traces(textposition="outside")` — each bar displays its score value as a floating label, with the y-axis range extended to prevent label clipping._

```python
# Bars with explicit numeric labels — no need to reference the axis
fig = px.bar(sector_avg, x="sector", y="composite_score",
             text=sector_avg["composite_score"].round(2),
             title="Scores with Labels")
fig.update_traces(textposition="outside")
fig.update_layout(xaxis_tickangle=-45,
                  xaxis_title=None,
                  margin=dict(b=150),
                  yaxis_range=[0, sector_avg["composite_score"].max() * 1.15])
fig.show()
```

<iframe src="/static/plotly/df_py_08_09.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Scatter Plots


Plotly scatter adds **hover details**, marginal distributions, trendlines, and 3D projection. Color, size, and symbol can each encode a different variable, turning a 2D plot into a 5D exploration tool.

**Best for:** Multi-dimensional exploration — when you want to encode 3–5 variables in a single view. OLS trendlines quantify relationships; marginals show distributions along each axis. 3D scatter is useful for PCA or factor analysis visualization.

### Basic Scatter

#### Plotly | Basic scatter

_Plots all 466 stock-date rows from `scores_pd` as interactive dots using `px.scatter()` — hover reveals coordinates, and zooming into dense regions separates overlapping points._

```python
# Interactive momentum vs value scatter — hover to identify individual stocks
fig = px.scatter(scores_pd, x="momentum_score", y="relative_value_score",
                 title="Momentum vs Value")
fig.show()
```

<iframe src="/static/plotly/df_py_08_10.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Color, Size and Hover

#### Plotly | Color, size & hover

_Adds `color="sector"` and `hover_data=["symbol", "composite_score"]` to the momentum vs. value scatter — hover tooltips show the stock symbol and composite score alongside the plotted coordinates._

```python
# Colored by sector — hover shows symbol and composite score
fig = px.scatter(scores_pd, x="momentum_score", y="relative_value_score",
                 color="sector",
                 hover_data=["symbol", "composite_score"],
                 title="Momentum vs Value (colored by sector)")
fig.show()
```

<iframe src="/static/plotly/df_py_08_11.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Marginal Distributions

#### How to read
- **Center** = main scatter plot showing the relationship
- **Top margin** = histogram of the x-variable's distribution
- **Right margin** = box plot of the y-variable's distribution
- Combines relationship analysis with individual variable summaries in one view

#### Plotly | Marginal distributions

_Extends the sector-colored scatter with `marginal_x="histogram"` and `marginal_y="box"` — the top margin shows momentum score distribution per sector, and the right margin shows value score quartiles, all in one interactive figure._

```python
# Colored by sector — hover shows symbol and composite score
fig = px.scatter(scores_pd, x="momentum_score", y="relative_value_score",
                 color="sector", marginal_x="histogram", marginal_y="box",
                 title="Scatter with Marginal Distributions")
fig.show()
```

<iframe src="/static/plotly/df_py_08_12.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Trendline (OLS)

#### How to read
- **Red line** = best-fit linear regression
- **Slope direction** = positive or negative correlation
- **Scatter tightness** around line = strength of relationship (R²)
- Hover the trendline to see equation and R² value

#### Plotly | Trendline (OLS)

_Adds `trendline="ols"` to the momentum vs. value scatter — Plotly fits a linear regression across all stocks and overlays a red line; hovering the line reveals the slope, intercept, and R² quantifying the relationship._

```python
# OLS regression line overlaid — quantifies the linear relationship
fig = px.scatter(scores_pd, x="momentum_score", y="relative_value_score",
                 trendline="ols", trendline_color_override="red",
                 title="With OLS Trendline")
fig.show()
```

<iframe src="/static/plotly/df_py_08_13.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### 3D Scatter

#### Plotly | 3D scatter

_Calls `px.scatter_3d()` with momentum, value, and composite as the three axes, colored by sector — rotating the 3D view reveals cluster structure that is hidden in any 2D projection of the score space._

```python
# 3D view of momentum, value, and composite — rotate to find cluster structure
fig = px.scatter_3d(scores_pd, x="momentum_score", y="relative_value_score",
                    z="composite_score", color="sector", hover_data=["symbol"],
                    title="3D: Momentum × Value × Composite")
fig.update_layout(height=600)
fig.show()
```

<iframe src="/static/plotly/df_py_08_14.html" width="100%" height="650" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Histograms & Distributions


Interactive histograms let you zoom into tails, hover for bin counts, and overlay multiple groups. Violin plots show the full density shape; box plots summarize with quartiles and outliers; strip plots show every individual point.

**Best for:** Comparing distributions across groups interactively. Use violin when shape matters (bimodality), box when you need quartile summary, strip/swarm for small datasets where every point counts.

### Basic Histogram

#### Plotly | Basic histogram

_Passes all 66K close price values from `ohlcv_pd` to `px.histogram(nbins=80)` — interactive chart supports zooming into the right tail to inspect outliers and hovering over bins for exact count._

```python
# Distribution of all close prices — zoom into tails to inspect outliers
fig = px.histogram(ohlcv_pd, x="close", nbins=80,
                   title="Distribution of Close Prices")
fig.show()
```

<iframe src="/static/plotly/df_py_08_15.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Overlaid by Category

#### Plotly | Overlaid by category

_Plots close price histograms for `top5_pd` with `color="symbol"` and `barmode="overlay"` — clicking a symbol in the legend toggles its histogram on/off for direct distribution comparison._

```python
# Overlaid distributions per stock — toggle stocks via legend clicks
fig = px.histogram(top5_pd, x="close", color="symbol", nbins=60,
                   barmode="overlay", opacity=0.6,
                   title="Close Price Distribution by Stock")
fig.show()
```

<iframe src="/static/plotly/df_py_08_16.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Histogram with Rug/Box

#### Plotly | Histogram with rug/box

_Adds `marginal="rug"` to the sector-colored composite score histogram — each stock appears as a short tick above the histogram bars, grounding the binned distribution in the exact individual data points._

```python
# Composite score by sector with rug marks showing individual stock positions
fig = px.histogram(scores_pd, x="composite_score", color="sector",
                   marginal="rug", nbins=30,
                   title="Composite Score Distribution with Rug")
fig.show()
```

<iframe src="/static/plotly/df_py_08_17.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Violin Plot

#### How to read
- **Width** = density (wider = more data at that level)
- **Internal box** = Q1, median, Q3 (same as box plot)
- **Points** = individual observations (when enabled)
- Compare shapes across categories: symmetric vs skewed, unimodal vs bimodal

#### Plotly | Violin plot

_Renders interactive violins for composite score by sector using `box=True` and `points="all"` — each violin shows the density shape, embedded quartile box, and every individual stock as a hoverable dot._

```python
# Violin per sector — width shows density, internal box shows quartiles, dots show all points
fig = px.violin(scores_pd, x="sector", y="composite_score", color="sector",
                box=True, points="all",
                title="Composite Score by Sector (Violin)")
fig.update_layout(xaxis_tickangle=-45, showlegend=False)
fig.show()
```

<iframe src="/static/plotly/df_py_08_18.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Box Plot

#### How to read
- **Box** = IQR (Q1 to Q3, middle 50%); **line** = median
- **Whiskers** = up to 1.5×IQR; **dots** = outliers beyond whiskers
- **Notch** = 95% CI for median; non-overlapping notches ≈ significant difference

#### Plotly | Box plot

_Draws notched box plots for composite score by sector using `notched=True` and `points="outliers"` — notch width encodes the 95% CI around each sector median, so non-overlapping notches signal a statistically meaningful difference._

```python
# Notched box plots — non-overlapping notches suggest significantly different medians
fig = px.box(scores_pd, x="sector", y="composite_score", color="sector",
             points="outliers", notched=True,
             title="Composite Score by Sector (Box)")
fig.update_layout(xaxis_tickangle=-45, showlegend=False)
fig.show()
```

<iframe src="/static/plotly/df_py_08_19.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Strip Plot

#### How to read
- **Each dot** = one observation, jittered horizontally
- Hover to identify individual points by name
- Best for small datasets where you want to see every value

#### Plotly | Strip plot

_Renders each stock in `scores_pd` as a jittered dot within its sector band using `px.strip()` — hover reveals the stock symbol and composite score, making outlier identification interactive._

```python
# Every stock as a dot — hover to identify outliers by symbol
fig = px.strip(scores_pd, x="sector", y="composite_score", color="sector",
               title="Composite Score by Sector (Strip)")
fig.update_layout(xaxis_tickangle=-45, showlegend=False)
fig.show()
```

<iframe src="/static/plotly/df_py_08_20.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Area Charts


Interactive area charts support hover, zoom, and range selection. Stacked areas show composition over time — hover reveals each component's value at any point.

**Best for:** Interactive time-series composition in dashboards (trading volume by stock, resource usage by service).

### Basic Area

#### Plotly | Basic area

_Calls `px.area(asml_pd, x="date", y="close")` — the region between close price and zero is filled, and interactive hover reveals the exact price for any date._

```python
# ASML close as filled area — emphasizes cumulative magnitude
fig = px.area(asml_pd, x="date", y="close", title="ASML Close Price (Area)")
fig.show()
```

<iframe src="/static/plotly/df_py_08_21.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Stacked Area

#### Plotly | Stacked area

_Passes `top5_pd` to `px.area(color="symbol")` — Plotly stacks each stock's daily volume on top of the previous, so total area height represents combined trading volume across all five stocks._

```python
# Daily volume by stock (stacked)
fig = px.area(top5_pd, x="date", y="volume", color="symbol",
              title="Trading Volume — Stacked Area")
fig.show()
```

<iframe src="/static/plotly/df_py_08_22.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Pie, Sunburst & Treemap


Sunbursts and treemaps extend pie charts to **hierarchical data** — drill from sector to country to stock. Click to zoom into a level; hover for details. Treemaps use area (easier to compare than angles); sunbursts use concentric rings.

**Best for:** Hierarchical/nested categorical data (org structures, file sizes, market segments). Treemaps work well for space-efficient dashboards; sunbursts for exploring parent-child relationships.

### Pie Chart

#### Plotly | Pie chart

_Groups `dim_pd` by sector, resets to a DataFrame, and passes to `px.pie(values="count", names="sector")` — hover shows exact constituent count per slice, and clicking a slice isolates it._

```python
# Sector composition of the index — hover for exact counts
sector_count = dim_pd.groupby("sector").size().reset_index(name="count")
fig = px.pie(sector_count, values="count", names="sector",
             title="Stocks per Sector", hole=0)
fig.show()
```

<iframe src="/static/plotly/df_py_08_23.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Donut Chart

#### Plotly | Donut chart

_Adds `hole=0.4` to `px.pie()` and `textinfo="percent+label"` to show percentages and names on each slice — the 40% center hole is available for a KPI value or additional label._

```python
# Donut variant — center space for a KPI or label
fig = px.pie(sector_count, values="count", names="sector",
             title="Stocks per Sector (Donut)", hole=0.4)
fig.update_traces(textinfo="percent+label")
fig.show()
```

<iframe src="/static/plotly/df_py_08_24.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Sunburst

#### Plotly | Sunburst

_Builds `sun_data` with a count column and passes `path=["sector", "country", "symbol"]` to `px.sunburst()` — each ring level represents one hierarchy level; clicking an inner segment zooms into that subtree._

```python
# Hierarchy: sector -> symbol
sun_data = dim_pd[["sector", "symbol", "country"]].copy()
sun_data["count"] = 1
fig = px.sunburst(sun_data, path=["sector", "country", "symbol"], values="count",
                  title="Sector → Country → Stock")
fig.update_layout(height=900, width=900, margin=dict(l=0, r=0, t=40, b=0))
fig.show()
```

<iframe src="/static/plotly/df_py_08_25.html" width="100%" height="950" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Treemap

#### Plotly | Treemap

_Passes the same `path=["sector", "country", "symbol"]` to `px.treemap()` — each leaf rectangle represents one stock grouped into country and sector tiles, where area is easier to compare than the angle-based sunburst._

```python
# Same hierarchy as rectangles — area encodes count, easier to compare than pie angles
fig = px.treemap(sun_data, path=["sector", "country", "symbol"], values="count",
                 title="Sector → Country → Stock (Treemap)")
fig.update_layout(height=900, margin=dict(l=0, r=0, t=40, b=0))
fig.show()
```

<iframe src="/static/plotly/df_py_08_26.html" width="100%" height="950" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Heatmap & Correlation


Heatmaps encode a **matrix of values** as colors, ideal for correlation matrices and pivot tables. Interactive hover shows exact values; zoom lets you focus on subregions. Diverging color scales (RdBu) center on zero to distinguish positive from negative.

**Best for:** Correlation analysis, confusion matrices, time x category pivot tables, and any data naturally represented as a 2D grid (weekday x hour, gene expression matrices).

### Correlation Matrix

#### How to read
- **+1.0 (dark red)** = perfect positive correlation (both move together)
- **-1.0 (dark blue)** = perfect negative correlation (one goes up, other goes down)
- **0.0 (white)** = no linear relationship
- Look for off-diagonal clusters of strong color — these variables move together

#### Plotly | Correlation matrix

_Renders the numeric score correlation matrix as an interactive `px.imshow()` heatmap with `text_auto=".2f"` — each cell shows the coefficient, diverging red–white–blue scale centered at zero, and hover gives exact values._

```python
# Interactive correlation matrix — hover for exact coefficients, zoom into subregions
corr = scores_pd.select_dtypes("number").corr()
fig = px.imshow(corr, text_auto=".2f", color_continuous_scale="RdBu_r",
                zmin=-1, zmax=1, title="Score Correlation Matrix")
fig.update_layout(height=1000, width=1000,
                  xaxis=dict(tickangle=-45, tickfont=dict(size=10)),
                  yaxis=dict(tickfont=dict(size=10)))
fig.show()
```

<iframe src="/static/plotly/df_py_08_27.html" width="100%" height="1050" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Pivot Heatmap

#### Plotly | Pivot heatmap

_Groups `asml_pd` by weekday and month, computes mean close, pivots to a weekday × month matrix, and passes to `px.imshow()` — each cell color encodes the average price for that weekday × month combination._

```python
# Average close by stock and month
asml_monthly = asml_pd.copy()
asml_monthly["month"] = pd.to_datetime(asml_monthly["date"]).dt.to_period("M").astype(str)
asml_monthly["weekday"] = pd.to_datetime(asml_monthly["date"]).dt.day_name()

pivot = asml_monthly.groupby(["weekday", "month"])["close"].mean().unstack()
# Reorder weekdays
day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
pivot = pivot.reindex(day_order)

fig = px.imshow(pivot, title="ASML Avg Close by Weekday × Month",
                color_continuous_scale="YlOrRd", aspect="auto")
fig.show()
```

<iframe src="/static/plotly/df_py_08_28.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Financial Charts

> [!tip] Related pattern
>
> The financial metrics rendered in these charts — daily returns, moving averages, price-to-book — are defined in [chart-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/chart-metrics). For the dashboard-level KPIs these charts feed into, see [index-snapshot-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/index-snapshot-metrics).

Candlestick and OHLC charts are standard for **price action analysis**. Each bar shows open, high, low, close for a period. Green = close > open (bullish); red = bearish. Adding a volume subplot shows trading activity — high volume confirms price moves.

**Best for:** Financial time-series (stocks, forex, crypto). Essential for technical analysis; the volume subplot helps distinguish meaningful moves from noise.

### Candlestick

#### How to read
- **Body** = range between open and close (filled/green = close > open = bullish; hollow/red = bearish)
- **Upper wick** = high of the day above the body
- **Lower wick** = low of the day below the body
- **Long wicks** = price was rejected at that level (buying/selling pressure)
- **Small body + long wicks** = indecision (doji)

#### Plotly | Candlestick

_Renders ASML's last 365 trading days as a `go.Candlestick` chart — green bodies where close exceeded open, red where it fell short, with upper and lower wicks showing each day's full intraday range._

```python
dates = pd.to_datetime(asml_pd["date"])
# Standard candlestick chart — body = open-to-close, wicks = high-low for each day
fig = go.Figure(go.Candlestick(
    x=dates, open=asml_pd["open"], high=asml_pd["high"],
    low=asml_pd["low"], close=asml_pd["close"]))
fig.update_layout(title="ASML Candlestick", xaxis_rangeslider_visible=False)
fig.show()
```

<iframe src="/static/plotly/df_py_08_29.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### OHLC

#### How to read
- **Vertical line** = high-to-low range for the period
- **Left tick** = opening price
- **Right tick** = closing price
- Right tick above left = bullish; below = bearish
- Less visually heavy than candlesticks — preferred when overlaying many indicators

#### Plotly | OHLC

_Renders the same ASML 365-day price data as `go.Ohlc` bars — each bar is a vertical line spanning the day's high-low range with a left tick for open and right tick for close, producing a less cluttered alternative to candlesticks._

```python
dates = pd.to_datetime(asml_pd["date"])
# OHLC bars — left tick = open, right tick = close, vertical line = high-low range
fig = go.Figure(go.Ohlc(
    x=dates, open=asml_pd["open"], high=asml_pd["high"],
    low=asml_pd["low"], close=asml_pd["close"]))
fig.update_layout(title="ASML OHLC", xaxis_rangeslider_visible=False)
fig.show()
```

<iframe src="/static/plotly/df_py_08_30.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Candlestick + Volume Subplot

#### Plotly | Candlestick + volume subplot

_Uses `make_subplots(rows=2, shared_xaxes=True)` to place a `go.Candlestick` in the top 70% and a color-coded `go.Bar` volume chart in the bottom 30% — bar colors are green for up-days (close ≥ open) and red for down-days._

```python
dates = pd.to_datetime(dates)
# Standard candlestick chart — body = open-to-close, wicks = high-low for each day
fig = make_subplots(rows=2, cols=1, shared_xaxes=True,
                    row_heights=[0.7, 0.3], vertical_spacing=0.02)

fig.add_trace(go.Candlestick(
    x=dates, open=asml_pd["open"], high=asml_pd["high"],
    low=asml_pd["low"], close=asml_pd["close"], name="OHLC"), row=1, col=1)

colors = ["green" if c >= o else "red"
          for c, o in zip(asml_pd["close"], asml_pd["open"])]
fig.add_trace(go.Bar(x=dates, y=asml_pd["volume"],
                     marker_color=colors, name="Volume", showlegend=False), row=2, col=1)

fig.update_layout(title="ASML: Candlestick + Volume",
                  xaxis_rangeslider_visible=False, height=600)
fig.show()
```

<iframe src="/static/plotly/df_py_08_31.html" width="100%" height="650" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Subplots & Layout


Subplots arrange multiple charts in a grid for **dashboard-style views**. Shared axes link zoom/pan across panels. Plotly Express faceting (`facet_col`, `facet_row`) auto-creates grids from a categorical column.

**Best for:** Dashboards, multi-metric monitoring, comparing the same metric across categories (one chart per stock, per sensor, per region).

### Grid of Subplots

#### Plotly | Grid of subplots

_Creates a 2×2 subplot grid with `make_subplots(rows=2, cols=2)` — top row: close price line and volume bar; bottom row: daily high-low range line and percentage returns histogram — all referencing the `asml_pd` subset._

```python
# 2x2 dashboard for ASML: price, volume, daily range, and return distribution
fig = make_subplots(rows=2, cols=2,
                    subplot_titles=["Close", "Volume", "High-Low Range", "Returns"])

fig.add_trace(go.Scatter(x=asml_pd["date"], y=asml_pd["close"], mode="lines", name="Close"),
              row=1, col=1)
fig.add_trace(go.Bar(x=asml_pd["date"], y=asml_pd["volume"], name="Volume"),
              row=1, col=2)
fig.add_trace(go.Scatter(x=asml_pd["date"], y=asml_pd["high"] - asml_pd["low"],
                         mode="lines", name="Range"),
              row=2, col=1)
returns = asml_pd["close"].pct_change() * 100
fig.add_trace(go.Histogram(x=returns, nbinsx=50, name="Returns %"),
              row=2, col=2)

fig.update_layout(title="ASML Dashboard", height=600, showlegend=False)
fig.show()
```

<iframe src="/static/plotly/df_py_08_32.html" width="100%" height="650" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Faceting with Plotly Express

#### Plotly | Faceting with Plotly Express

_Passes `top5_pd` to `px.histogram(facet_col="symbol", facet_col_wrap=3)` — Plotly Express auto-generates 5 panels (3 per row), each with independent y-axes to compare distribution shapes regardless of volume differences._

```python
# Per-stock histograms in a facet grid — compare distribution shapes side by side
fig = px.histogram(top5_pd, x="close", facet_col="symbol", facet_col_wrap=3,
                   nbins=40, title="Close Distribution per Stock")
fig.update_yaxes(matches=None, showticklabels=True)
fig.show()
```

<iframe src="/static/plotly/df_py_08_33.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Geographic Charts


Choropleth maps color regions by a metric — great for showing **geographic distribution**. Scatter maps plot points at coordinates with size/color encoding.

**Best for:** Any data with a geographic dimension (sales by country, offices on a map, sensor locations). Use ISO-3 country codes for reliable matching.

### Choropleth

#### Plotly | Choropleth

_Maps country names to ISO-3 codes and passes to `px.choropleth(locationmode="ISO-3")` scoped to Europe — country fill color encodes the number of EuroStoxx 50 stocks headquartered there, with darker blue meaning more stocks._

```python
# Map of Europe colored by number of index constituents per country
country_count = dim_pd.groupby("country").size().reset_index(name="stocks")

# Map country names to ISO-3 codes
iso3_map = {
    "Netherlands": "NLD", "Germany": "DEU", "France": "FRA",
    "Spain": "ESP", "Italy": "ITA", "Finland": "FIN",
    "Belgium": "BEL", "Ireland": "IRL", "Luxembourg": "LUX",
    "Austria": "AUT", "Portugal": "PRT",
}
country_count["iso3"] = country_count["country"].map(iso3_map)

fig = px.choropleth(country_count, locations="iso3", locationmode="ISO-3",
                    color="stocks", hover_name="country",
                    title="EuroStoxx 50: Stocks per Country",
                    color_continuous_scale="Blues")
fig.update_layout(
    height=600, margin=dict(l=0, r=0, t=40, b=0),
    geo=dict(scope="europe",
             bgcolor="#1a1b26",
             landcolor="#24283b",
             countrycolor="#3b4261",
             subunitcolor="#3b4261",
             showocean=True, oceancolor="#16161e",
             showlakes=True, lakecolor="#16161e",
             showcoastlines=True, coastlinecolor="#3b4261",
             lonaxis_range=[-15, 35], lataxis_range=[35, 65]))
fig.show()
```

<iframe src="/static/plotly/df_py_08_34.html" width="100%" height="650" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Scatter Map

#### Plotly | Scatter map

_Adds lat/lon coordinates for 8 European capitals, then calls `px.scatter_map()` with `size="stocks"` — each capital appears as a bubble where area encodes the number of index constituents from that country._

```python
# Bubble map — bubble size = number of stocks headquartered in each country
city_coords = {
    "Netherlands": (52.37, 4.90), "Germany": (52.52, 13.41), "France": (48.86, 2.35),
    "Spain": (40.42, -3.70), "Italy": (41.90, 12.50), "Finland": (60.17, 24.94),
    "Belgium": (50.85, 4.35), "Ireland": (53.35, -6.26),
}
geo = country_count.copy()
geo["lat"] = geo["country"].map(lambda c: city_coords.get(c, (0, 0))[0])
geo["lon"] = geo["country"].map(lambda c: city_coords.get(c, (0, 0))[1])
geo = geo[geo["lat"] != 0]

fig = px.scatter_map(geo, lat="lat", lon="lon", size="stocks", text="country",
                     title="Stocks by Country (Scatter Map)",
                     size_max=30, zoom=3, center={"lat": 50, "lon": 10})
fig.update_layout(height=600, margin=dict(l=0, r=0, t=40, b=0),
                  map_style="carto-darkmatter")
fig.show()
```

<iframe src="/static/plotly/df_py_08_35.html" width="100%" height="650" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Animated Charts


Animation adds a **time dimension** to any chart type. `animation_frame` in Plotly Express creates a slider that steps through values of a column. Use fixed axis ranges so the viewer can track movement rather than rescaling.

**Best for:** Showing evolution over time (rankings changing, clusters drifting, distributions shifting). Most impactful in presentations; less useful for static analysis (hard to compare frames).

### Animated Line

#### Plotly | Animated line (cumulative)

_Aggregates ASML to monthly last-close, then manually constructs `go.Frame` objects that progressively reveal each month's close — a "Play" button steps through frames at 100ms intervals, showing the price build-up over time._

```python
# Monthly aggregation for animation
asml_anim = asml_pd.copy()
asml_anim["month"] = pd.to_datetime(asml_anim["date"]).dt.to_period("M").astype(str)
monthly = asml_anim.groupby("month").agg(close=("close", "last"), date=("date", "last")).reset_index()
monthly["cum_frame"] = range(len(monthly))

fig = px.line(monthly, x="month", y="close",
              title="ASML Monthly Close (animated)",
              range_y=[monthly["close"].min() * 0.95, monthly["close"].max() * 1.05])
fig.update_layout(xaxis_tickangle=-45)

# Add animation frames
frames = [go.Frame(data=[go.Scatter(x=monthly["month"][:k+1], y=monthly["close"][:k+1],
                                     mode="lines+markers")],
                   name=str(k))
          for k in range(1, len(monthly))]
fig.frames = frames

fig.update_layout(
    updatemenus=[dict(type="buttons", showactive=False,
                      buttons=[dict(label="Play", method="animate",
                                    args=[None, {"frame": {"duration": 100}, "fromcurrent": True}])])])
fig.show()
```

<iframe src="/static/plotly/df_py_08_36.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Animated Scatter

#### Plotly | Animated scatter (built-in)

_Passes `animation_frame="date_str"` to `px.scatter()` on `scores_anim` — Plotly Express auto-builds frames for each date, with fixed axis ranges so stocks' movements through score space are comparable across frames._

```python
# Scatter by sector over months
scores_anim = scores_pd.copy()
scores_anim["date_str"] = scores_anim["score_date"].astype(str)

fig = px.scatter(scores_anim, x="momentum_score", y="relative_value_score",
                 color="sector", hover_name="symbol",
                 animation_frame="date_str",
                 title="Momentum vs Value Over Time",
                 range_x=[scores_anim["momentum_score"].min() - 0.5,
                          scores_anim["momentum_score"].max() + 0.5],
                 range_y=[scores_anim["relative_value_score"].min() - 0.5,
                          scores_anim["relative_value_score"].max() + 0.5])
fig.update_layout(height=600)
fig.show()
```

<iframe src="/static/plotly/df_py_08_37.html" width="100%" height="650" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Styling, Templates & Themes


Templates control the overall look: background, grid, fonts, color palette. Built-in options include `plotly_dark`, `ggplot2`, `seaborn`, etc. Custom templates let you enforce brand consistency across all charts.

**Best for:** Ensuring visual consistency across a project or org. Set a default template once and all subsequent charts inherit it.

### Built-in Templates

#### Plotly | Built-in templates

_Iterates over 6 named templates (`plotly`, `plotly_white`, `plotly_dark`, `ggplot2`, `seaborn`, `simple_white`), generates a 30-day ASML line chart for each, converts to HTML with `pio.to_html(include_plotlyjs=False)`, and assembles them in a CSS grid div._

```python
# Show built-in templates in a 2x3 grid using HTML

templates = ["plotly", "plotly_white", "plotly_dark", "ggplot2", "seaborn", "simple_white"]
html_parts = []

for tmpl in templates:
    fig = px.line(asml_pd.tail(30), x="date", y="close",
                 title=f"Template: {tmpl}", template=tmpl)
    fig.update_layout(height=280, width=400, margin=dict(l=40, r=20, t=40, b=30))
    html_parts.append(pio.to_html(fig, include_plotlyjs=False, full_html=False))

grid = "<div style='display:grid; grid-template-columns:1fr 1fr 1fr; gap:5px'>" + "".join(html_parts) + "</div>"
js_tag = '<script src="https://cdn.plot.ly/plotly-latest.min.js"></script>'
display(HTML(js_tag + grid))
```

<iframe src="/static/plotly/df_py_08_38.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Custom Styling

#### Plotly | Custom styling

_Adds a `go.Scatter` with `fill="tozeroy"` and `fillcolor="rgba(122,162,247,0.1)"`, then configures the layout with a visible `rangeslider`, unified hover mode, and explicit axis titles._

```python
# Custom-styled close price with filled area and range slider for navigation
fig = go.Figure()
fig.add_trace(go.Scatter(x=asml_pd["date"], y=asml_pd["close"], mode="lines",
                         line=dict(color="#7aa2f7", width=2),
                         fill="tozeroy", fillcolor="rgba(122,162,247,0.1)"))

fig.update_layout(
    title=dict(text="ASML Close Price", font=dict(size=20)),
    xaxis=dict(title="Date", rangeslider=dict(visible=True)),
    yaxis=dict(title="Price (€)"),
    hovermode="x unified",
    height=500,
)
fig.show()
```

<iframe src="/static/plotly/df_py_08_39.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Annotations and Shapes

#### Plotly | Annotations & shapes

_Uses `add_hline()`, `add_vline()`, `add_annotation()`, and `add_vrect()` on a `px.line()` figure — the dashed horizontal marks the mean, the dotted vertical marks the midpoint date, the annotation arrow points to the price maximum, and the green rectangle highlights rows 50–100._

```python
# Close price with reference lines, annotations at max/min, and a highlighted region
fig = px.line(asml_pd, x="date", y="close", title="ASML with Annotations")

# Add horizontal line
avg_close = asml_pd["close"].mean()
fig.add_hline(y=avg_close, line_dash="dash", line_color="red",
              annotation_text=f"Avg: {avg_close:.2f}")

# Add vertical line at a date
mid_date = asml_pd["date"].iloc[len(asml_pd)//2]
fig.add_vline(x=mid_date, line_dash="dot", line_color="gray")

# Add text annotation at max price
max_idx = asml_pd["close"].idxmax()
fig.add_annotation(x=asml_pd.loc[max_idx, "date"], y=asml_pd.loc[max_idx, "close"],
                   text=f"Max: {asml_pd.loc[max_idx, 'close']:.2f}",
                   showarrow=True, arrowhead=2, ax=40, ay=-40)

# Add shaded region
fig.add_vrect(x0=asml_pd["date"].iloc[50], x1=asml_pd["date"].iloc[100],
              fillcolor="green", opacity=0.1, line_width=0,
              annotation_text="Highlight")
fig.show()
```

<iframe src="/static/plotly/df_py_08_40.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Advanced Interactivity


Dropdowns, range selectors, and custom hover templates turn charts into **mini-applications**. Dropdown buttons toggle trace visibility; range selectors offer 1M/3M/YTD presets. Custom hover templates control exactly what information appears on mouseover.

**Best for:** Stakeholder-facing dashboards where users need self-service exploration without writing code. Also useful in Jupyter for rapid what-if exploration.

### Dropdown Buttons

#### Plotly | Dropdown buttons

_Adds one `go.Scatter` trace per stock (all hidden except the first), then builds `updatemenus` buttons where each button sets `visible=[True/False]` for the corresponding trace and updates the chart title._

```python
# Dropdown selector to switch between stocks without redrawing
fig = go.Figure()
for sym in top5:
    df_sym = ohlcv_pd[ohlcv_pd["symbol"] == sym].sort_values("date").tail(365)
    fig.add_trace(go.Scatter(x=df_sym["date"], y=df_sym["close"],
                             mode="lines", name=sym, visible=(sym == top5[0])))

buttons = []
for i, sym in enumerate(top5):
    vis = [False] * len(top5)
    vis[i] = True
    buttons.append(dict(label=sym, method="update",
                        args=[{"visible": vis}, {"title": f"{sym} Close Price"}]))
buttons.append(dict(label="All", method="update",
                    args=[{"visible": [True] * len(top5)}, {"title": "All Stocks"}]))

fig.update_layout(title=f"{top5[0]} Close Price",
                  updatemenus=[dict(buttons=buttons, direction="down",
                                    x=0.01, y=1.15, showactive=True)])
fig.show()
```

<iframe src="/static/plotly/df_py_08_41.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Range Slider and Selector

#### Plotly | Range slider & selector

_Calls `update_xaxes(rangeslider_visible=True, rangeselector=dict(buttons=[...]))` with four step buttons — clicking a preset button zooms to that trailing window; the slider below the chart enables custom range selection._

```python
# Range presets (1M, 3M, 6M, All) plus a draggable slider for custom zoom
fig = px.line(asml_pd, x="date", y="close", title="ASML with Range Selector")
fig.update_xaxes(
    rangeslider_visible=True,
    rangeselector=dict(
        buttons=[
            dict(count=1, label="1M", step="month", stepmode="backward"),
            dict(count=3, label="3M", step="month", stepmode="backward"),
            dict(count=6, label="6M", step="month", stepmode="backward"),
            dict(step="all", label="All"),
        ]
    )
)
fig.show()
```

<iframe src="/static/plotly/df_py_08_42.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Custom Hover Templates

#### Plotly | Custom hover templates

_Stacks volume, high, and low into a `customdata` array via `np.stack()`, then sets `hovertemplate` with `%{customdata[0]:,.0f}` references — hover shows a formatted tooltip with date, close, volume, high, and low in a single popup._

```python
# Custom hover showing date, close, volume, high, low in a formatted tooltip
fig = go.Figure(go.Scatter(
    x=asml_pd["date"], y=asml_pd["close"], mode="lines",
    customdata=np.stack([asml_pd["volume"], asml_pd["high"], asml_pd["low"]], axis=-1),
    hovertemplate=(
        "<b>Date</b>: %{x|%Y-%m-%d}<br>"
        "<b>Close</b>: €%{y:.2f}<br>"
        "<b>Volume</b>: %{customdata[0]:,.0f}<br>"
        "<b>High</b>: €%{customdata[1]:.2f}<br>"
        "<b>Low</b>: €%{customdata[2]:.2f}<br>"
        "<extra></extra>"
    )
))
fig.update_layout(title="Custom Hover Template")
fig.show()
```

<iframe src="/static/plotly/df_py_08_43.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Plotly with Polars DataFrames

> [!info] How Plotly consumes Polars DataFrames
>
> Plotly Express uses the [Python DataFrame Interchange Protocol](https://data-apis.org/dataframe-protocol/latest/) (`__dataframe__`) introduced in Plotly 6.0. Column names passed as strings (e.g., `x="date"`) are resolved against this protocol rather than the Pandas API. **Graph Objects (`go.Scatter`, `go.Candlestick`, etc.) do not support this protocol** — pass `.to_list()` or `.to_pandas()` arrays for `go` traces.

### Plotly Express with Polars

#### Plotly | Line chart from Polars DataFrame

_Passes `asml_pl` (a Polars DataFrame) directly to `px.line()` — Plotly 6+ resolves column names via the `__dataframe__` protocol without requiring `.to_pandas()` conversion._

```python
# Plotly Express works directly with Polars DataFrames (since Plotly 6+)
fig = px.line(asml_pl, x="date", y="close", title="Direct from Polars DataFrame")
fig.show()
```

<iframe src="/static/plotly/df_py_08_44.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### Plotly | Scatter from Polars DataFrame

_Passes `scores_pl` directly to `px.scatter()` with `color="sector"` — confirms that column-based styling arguments work with Polars DataFrames in the same way as with Pandas._

```python
# Scatter with Polars
fig = px.scatter(scores_pl, x="momentum_score", y="relative_value_score",
                 color="sector", hover_data=["symbol"],
                 title="Polars DataFrame → Plotly Scatter")
fig.show()
```

<iframe src="/static/plotly/df_py_08_45.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Graph Objects with Polars

#### Plotly | Candlestick from Polars via lists

_Extracts Polars Series to Python lists with `.to_list()` before passing to `go.Candlestick()` — Graph Objects do not support the `__dataframe__` protocol, so column-level extraction is required._

```python
# For Graph Objects, convert to lists or Pandas
fig = go.Figure(go.Candlestick(
    x=asml_pl["date"].to_list(),
    open=asml_pl["open"].to_list(),
    high=asml_pl["high"].to_list(),
    low=asml_pl["low"].to_list(),
    close=asml_pl["close"].to_list(),
))
fig.update_layout(title="Candlestick from Polars (via lists)",
                  xaxis_rangeslider_visible=False)
fig.show()
```

<iframe src="/static/plotly/df_py_08_46.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Exporting Charts

### Export Options

#### Plotly | Export to HTML, PNG, SVG, PDF, and JSON

_Demonstrates five export formats using a `px.line()` figure: interactive HTML via `write_html()`, static PNG/SVG/PDF via `write_image()` (requires `kaleido`), and raw JSON via `write_json()` — printed file sizes confirm the output._

```python
# Export options: interactive HTML, static PNG/SVG/PDF, and JSON for web embedding
fig = px.line(asml_pd, x="date", y="close", title="Export Example")

# Interactive HTML
fig.write_html(TMP / "chart.html", include_plotlyjs="cdn")
print(f"HTML: {(TMP / 'chart.html').stat().st_size:,} bytes")

# Static image (requires kaleido)
try:
    fig.write_image(TMP / "chart.png", width=1000, height=500, scale=2)
    print(f"PNG: {(TMP / 'chart.png').stat().st_size:,} bytes")
    fig.write_image(TMP / "chart.svg")
    print(f"SVG: {(TMP / 'chart.svg').stat().st_size:,} bytes")
    fig.write_image(TMP / "chart.pdf")
    print(f"PDF: {(TMP / 'chart.pdf').stat().st_size:,} bytes")
except Exception as e:
    print(f"Static export needs kaleido: pip install kaleido\n  {e}")

# JSON (for embedding in web apps)
fig.write_json(TMP / "chart.json")
print(f"JSON: {(TMP / 'chart.json').stat().st_size:,} bytes")
```

    HTML: 10,714 bytes
    PNG: 129,923 bytes
    SVG: 12,829 bytes
    PDF: 12,091 bytes
    JSON: 9,815 bytes

## Summary

| Chart Type | Plotly Express | Graph Objects |
|---|---|---|
| Line | `px.line()` | `go.Scatter(mode="lines")` |
| Bar | `px.bar()` | `go.Bar()` |
| Scatter | `px.scatter()` | `go.Scatter(mode="markers")` |
| Histogram | `px.histogram()` | `go.Histogram()` |
| Box | `px.box()` | `go.Box()` |
| Violin | `px.violin()` | `go.Violin()` |
| Area | `px.area()` | `go.Scatter(fill="tozeroy")` |
| Pie/Donut | `px.pie(hole=0.4)` | `go.Pie()` |
| Sunburst | `px.sunburst()` | `go.Sunburst()` |
| Treemap | `px.treemap()` | `go.Treemap()` |
| Heatmap | `px.imshow()` | `go.Heatmap()` |
| Candlestick | — | `go.Candlestick()` |
| OHLC | — | `go.Ohlc()` |
| Choropleth | `px.choropleth()` | `go.Choropleth()` |
| 3D Scatter | `px.scatter_3d()` | `go.Scatter3d()` |

| Feature | How |
|---|---|
| Facets | `facet_col`, `facet_row` |
| Animation | `animation_frame` |
| Dual Y-axis | `make_subplots(specs=[[{"secondary_y": True}]])` |
| Templates | `template="plotly_dark"` |
| Range selector | `rangeselector=dict(buttons=[...])` |
| Dropdowns | `updatemenus=[dict(buttons=[...])]` |
| Custom hover | `hovertemplate="..."` |
| Export HTML | `fig.write_html()` |
| Export PNG/SVG | `fig.write_image()` (needs kaleido) |
| Polars direct | Plotly Express accepts Polars DataFrames |
