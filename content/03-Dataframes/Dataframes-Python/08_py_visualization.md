---
type: reference
category: programming-languages
technology:
  - python
  - pandas
  - polars
tags: [pipeline, python, pandas, polars]
aliases:
  - matplotlib, seaborn, plotting, charts
keywords: [matplotlib, seaborn, plot, bar, line, scatter, histogram, heatmap, subplots, facet, savefig]
description: "Pandas/Polars DataFrame reference 08/10 — Visualization (matplotlib, seaborn, static charts). Side-by-side executable examples with cell outputs."
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# 08 — Visualization

> [!quote]
> "The greatest value of a picture is when it forces us to notice what we never expected to see."
> — **John Tukey**

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

### Basic Line (Pandas built-in)

```python
# Close price evolution for ASML over the last year
asml.plot(x="date", y="close", title="ASML Close Price (1Y)", figsize=(10, 4), legend=False)
plt.ylabel("Close")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_01.png)

### Multi-Series

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

### Line Styles & Markers

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

### Dual Y-Axis

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

```python
# Horizontal ranking of sectors by average composite score
sector_avg.plot.barh(title="Avg Composite Score by Sector", figsize=(10, 5))
plt.xlabel("Score")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_06.png)

### Vertical Bar

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

```python
# Distribution of all close prices across all stocks — reveals price clustering and outliers
ohlcv_pd["close"].plot.hist(bins=50, title="Distribution of Close Prices", figsize=(10, 4))
plt.xlabel("Close Price")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_11.png)

### Overlaid Histograms

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

### 2D Histogram (hexbin)

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

```python
# Relationship between momentum and relative value scores across all stocks
scores_pd.plot.scatter(x="momentum_score", y="relative_value_score",
                       alpha=0.5, title="Momentum vs Value", figsize=(8, 6))
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_15.png)

### Color-Mapped Scatter

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

### Bubble Chart (size + color)

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

```python
# ASML close price as filled area — emphasizes magnitude relative to zero
asml.plot.area(x="date", y="close", alpha=0.4, title="ASML Close (Area)", figsize=(10, 4), legend=False)
plt.ylabel("Close")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_18.png)

### Stacked Area

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

### Clustermap (hierarchical clustering)


#### How to read
- Same as heatmap, but rows and columns are **reordered by hierarchical clustering**
- **Dendrograms** (tree diagrams on the sides) show which variables are most similar
- Variables that merge early in the tree are more correlated with each other
- Look for diagonal blocks of strong color — these are clusters of related metrics

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

```python
# Count of stocks in each sector — bar length = number of constituent companies
fig, ax = plt.subplots(figsize=(10, 5))
sns.countplot(data=dim_pd, y="sector", order=dim_pd["sector"].value_counts().index, ax=ax)
ax.set_title("Number of Stocks per Sector")
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_33.png)

### ECDF (Empirical CDF)


#### How to read
- **X-axis** = variable values; **Y-axis** = cumulative proportion (0 to 1)
- Read as: "what fraction of data falls below this value?"
- **Steep section** = many values concentrated in a narrow range
- **Flat section** = sparse region with few data points
- Curves shifted right = higher values overall; compare vertical gaps between groups at any x to see which group has more data below that threshold

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

### Stackplot (matplotlib native)

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

### Annotations & Text

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

```python
# Polars DataFrame converted to Pandas for matplotlib plotting — standard workflow
asml_pl = ohlcv_pl.filter(pl.col("symbol") == "ASML.AS").sort("date").tail(90)
asml_pl.to_pandas().plot(x="date", y="close", title="ASML (Polars → Pandas plot)",
                         figsize=(10, 4), legend=False)
plt.tight_layout()
plt.show()
```

![chart](/static/img/df_py_08/viz_43.png)

## Matplotlib / Seaborn Summary

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
# Part 2: Plotly — Interactive Charts

Plotly Express for quick interactive charts, and Graph Objects for full control.

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

### Multi-Series (color)

```python
# Multi-stock comparison — unified hover shows all prices at the same date
fig = px.line(top5_pd, x="date", y="close", color="symbol",
              title="Close Prices — Top 5 Stocks")
fig.update_layout(hovermode="x unified")
fig.show()
```

<iframe src="/static/plotly/df_py_08_02.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Faceted Lines

```python
# Each stock in its own panel — independent y-axes reveal individual patterns
fig = px.line(top5_pd, x="date", y="close", facet_col="symbol", facet_col_wrap=3,
              title="Close Prices by Stock")
fig.update_yaxes(matches=None, showticklabels=True)  # independent y-axes
fig.show()
```

<iframe src="/static/plotly/df_py_08_03.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Dual Y-Axis (Graph Objects)

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

### Line Styles & Markers

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

```python
# Interactive momentum vs value scatter — hover to identify individual stocks
fig = px.scatter(scores_pd, x="momentum_score", y="relative_value_score",
                 title="Momentum vs Value")
fig.show()
```

<iframe src="/static/plotly/df_py_08_10.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Color, Size, Hover

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

```python
# OLS regression line overlaid — quantifies the linear relationship
fig = px.scatter(scores_pd, x="momentum_score", y="relative_value_score",
                 trendline="ols", trendline_color_override="red",
                 title="With OLS Trendline")
fig.show()
```

<iframe src="/static/plotly/df_py_08_13.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### 3D Scatter

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

```python
# Distribution of all close prices — zoom into tails to inspect outliers
fig = px.histogram(ohlcv_pd, x="close", nbins=80,
                   title="Distribution of Close Prices")
fig.show()
```

<iframe src="/static/plotly/df_py_08_15.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Overlaid by Category

```python
# Overlaid distributions per stock — toggle stocks via legend clicks
fig = px.histogram(top5_pd, x="close", color="symbol", nbins=60,
                   barmode="overlay", opacity=0.6,
                   title="Close Price Distribution by Stock")
fig.show()
```

<iframe src="/static/plotly/df_py_08_16.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Histogram with Rug/Box

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

```python
# ASML close as filled area — emphasizes cumulative magnitude
fig = px.area(asml_pd, x="date", y="close", title="ASML Close Price (Area)")
fig.show()
```

<iframe src="/static/plotly/df_py_08_21.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Stacked Area

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

```python
# Sector composition of the index — hover for exact counts
sector_count = dim_pd.groupby("sector").size().reset_index(name="count")
fig = px.pie(sector_count, values="count", names="sector",
             title="Stocks per Sector", hole=0)
fig.show()
```

<iframe src="/static/plotly/df_py_08_23.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Donut Chart

```python
# Donut variant — center space for a KPI or label
fig = px.pie(sector_count, values="count", names="sector",
             title="Stocks per Sector (Donut)", hole=0.4)
fig.update_traces(textinfo="percent+label")
fig.show()
```

<iframe src="/static/plotly/df_py_08_24.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

### Sunburst

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

### Animated Line (cumulative)

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

### Animated Scatter (built-in)

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

### Annotations & Shapes

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

### Range Slider & Selector

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

```python
# Plotly Express works directly with Polars DataFrames (since Plotly 6+)
fig = px.line(asml_pl, x="date", y="close", title="Direct from Polars DataFrame")
fig.show()
```

<iframe src="/static/plotly/df_py_08_44.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

```python
# Scatter with Polars
fig = px.scatter(scores_pl, x="momentum_score", y="relative_value_score",
                 color="sector", hover_data=["symbol"],
                 title="Polars DataFrame → Plotly Scatter")
fig.show()
```

<iframe src="/static/plotly/df_py_08_45.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

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
