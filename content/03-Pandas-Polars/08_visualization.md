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
description: "Pandas vs Polars reference 08/10 — Visualization (matplotlib, seaborn, static charts). Side-by-side executable examples with cell outputs."
related:
  - "[[pandas-polars-index]]"
  - "[[programming-languages-index]]"
  - "[[07_types_interop]]"
  - "[[09_database_interface]]"
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# 08 — Visualization

Pandas/Matplotlib/Seaborn for static charts, Plotly for interactive.



    OHLCV: (66355, 12), Dim: (169, 26), Scores: (466, 36)

## Data Preparation



## 1. Line Charts


Line charts connect data points in order, revealing **trends**, **cycles**, and **rate of change** over time. Slope shows velocity; curvature shows acceleration; crossings between series highlight regime changes.

**Best for:** Time-series data, continuous measurements over ordered intervals (stock prices, sensor readings, revenue over months). Not suitable for unordered categories.

### 1.1 Basic Line (Pandas built-in)



![Chart 1](/static/pandas-polars/viz_img_01.png)

### 1.2 Multi-Series



![Chart 2](/static/pandas-polars/viz_img_02.png)

### 1.3 Line Styles & Markers



![Chart 3](/static/pandas-polars/viz_img_03.png)

### 1.4 Fill Between



![Chart 4](/static/pandas-polars/viz_img_04.png)

### 1.5 Dual Y-Axis



![Chart 5](/static/pandas-polars/viz_img_05.png)

## 2. Bar Charts


Bar charts compare **discrete categories** by encoding values as bar lengths. Horizontal bars work better when category labels are long. Grouped bars compare sub-categories side by side; stacked bars show part-to-whole composition.

**Best for:** Categorical comparisons (revenue by department, scores by sector, counts by group). Use when you have a small-to-medium number of categories (<20). For many categories, consider sorting or filtering.

### 2.1 Horizontal Bar



![Chart 6](/static/pandas-polars/viz_img_06.png)

### 2.2 Vertical Bar



![Chart 7](/static/pandas-polars/viz_img_07.png)

### 2.3 Grouped Bar



![Chart 8](/static/pandas-polars/viz_img_08.png)

### 2.4 Stacked Bar



![Chart 9](/static/pandas-polars/viz_img_09.png)

### 2.5 Bar with Error Bars



![Chart 10](/static/pandas-polars/viz_img_10.png)

## 3. Histograms


Histograms bin continuous data to show its **distribution shape** — normal, skewed, bimodal, etc. Bin count matters: too few hides structure, too many adds noise. KDE (kernel density estimation) overlays a smooth curve estimate of the probability density.

**Best for:** Exploring a single continuous variable (prices, returns, test scores). Answers: "What is the typical range? Are there outliers? Is the data symmetric?"

### 3.1 Basic Histogram



![Chart 11](/static/pandas-polars/viz_img_11.png)

### 3.2 Overlaid Histograms



![Chart 12](/static/pandas-polars/viz_img_12.png)

### 3.3 Histogram + KDE



![Chart 13](/static/pandas-polars/viz_img_13.png)

### 3.4 2D Histogram (hexbin)



![Chart 14](/static/pandas-polars/viz_img_14.png)

## 4. Scatter Plots


Scatter plots reveal **relationships between two continuous variables** — correlation, clusters, and outliers. Adding color encodes a third variable (categorical or continuous); size encodes a fourth (bubble chart). No visible pattern = no linear relationship, but non-linear patterns may still exist.

**Best for:** Exploring correlation between two numeric columns (price vs volume, momentum vs value). Works well up to ~10K points; beyond that, use hexbin or density plots to avoid overplotting.

### 4.1 Basic Scatter



![Chart 15](/static/pandas-polars/viz_img_15.png)

### 4.2 Color-Mapped Scatter



![Chart 16](/static/pandas-polars/viz_img_16.png)

### 4.3 Bubble Chart (size + color)



![Chart 17](/static/pandas-polars/viz_img_17.png)

## 5. Area Charts


Area charts are line charts with the region below filled, emphasizing **magnitude** and **cumulative totals**. Stacked areas show how components contribute to a total over time.

**Best for:** Time-series composition data (market share over time, portfolio allocation, traffic sources). Keep to 3–5 series; too many layers become unreadable.

### 5.1 Basic Area



![Chart 18](/static/pandas-polars/viz_img_18.png)

### 5.2 Stacked Area



![Chart 19](/static/pandas-polars/viz_img_19.png)

## 6. Pie & Donut


Pie charts show **part-to-whole proportions** for a single categorical variable. Humans judge angles poorly, so pie charts work best with ≤6 slices and clear size differences. Donut charts free the center for labels or KPIs.

**Best for:** Showing composition when there are few categories with distinct proportions (market share, budget allocation). For precise comparison or many categories, prefer bar charts.

### 6.1 Pie Chart



![Chart 20](/static/pandas-polars/viz_img_20.png)

### 6.2 Donut Chart



![Chart 21](/static/pandas-polars/viz_img_21.png)

## 7. Seaborn — Statistical Plots


Seaborn provides high-level functions for **statistical visualization** — distribution shapes, group comparisons, correlations, and regression. It handles grouping, faceting, and confidence intervals automatically.

**Best for:** Exploratory data analysis (EDA) when you need to understand distributions (violin, box, KDE), relationships (regression, pair plots), and group differences (strip, swarm). Accepts Pandas DataFrames directly with column-name-based API.

### 7.1 Box Plot


**How to read:**
- **Box** = interquartile range (IQR): middle 50% of data (Q1 to Q3)
- **Line inside box** = median (Q2)
- **Whiskers** = extend to the farthest point within 1.5×IQR from the box edges
- **Circles/diamonds beyond whiskers** = outliers (individual data points outside 1.5×IQR)
- **Notch** (if enabled) = 95% confidence interval around the median; non-overlapping notches between groups suggest significantly different medians



![Chart 22](/static/pandas-polars/viz_img_22.png)

### 7.2 Violin Plot


**How to read:**
- **Width** = density estimate (wider = more data points at that value)
- **Inner box/lines** = quartiles (same as box plot: Q1, median, Q3)
- **Shape** = full distribution — symmetric = normal; multiple bulges = multimodal; long tail = skewed
- Compare width across groups: a wider section means more stocks cluster at that score level



![Chart 23](/static/pandas-polars/viz_img_23.png)

### 7.3 Strip Plot


**How to read:**
- **Each dot** = one data point (one stock)
- **Jitter** = small random horizontal offset to prevent dots from stacking on top of each other
- **Dense clusters** = many values near that level; isolated dots = outliers
- Best for small-to-medium datasets (<500 points per group)



![Chart 24](/static/pandas-polars/viz_img_24.png)

### 7.4 Swarm Plot


**How to read:**
- Like strip plot, but dots are algorithmically spread so **no two overlap**
- **Width of the swarm** at a given y-value reflects how many points are near that value (like a violin)
- Gives exact count — every point is visible and countable
- Slow for large datasets (>300 points per group)



![Chart 25](/static/pandas-polars/viz_img_25.png)

### 7.5 Heatmap


**How to read:**
- **Color intensity** = magnitude of the value in each cell
- **Diverging scale (RdBu):** red = strong positive, white = zero, blue = strong negative
- **Diagonal** (in correlation matrix) = always 1.0 (variable correlated with itself)
- **Off-diagonal symmetry** = correlation is symmetric: corr(A,B) = corr(B,A)
- Look for dark clusters of red/blue — these indicate groups of highly correlated variables



![Chart 26](/static/pandas-polars/viz_img_26.png)

### 7.6 Clustermap (hierarchical clustering)


**How to read:**
- Same as heatmap, but rows and columns are **reordered by hierarchical clustering**
- **Dendrograms** (tree diagrams on the sides) show which variables are most similar
- Variables that merge early in the tree are more correlated with each other
- Look for diagonal blocks of strong color — these are clusters of related metrics



![Chart 27](/static/pandas-polars/viz_img_27.png)

### 7.7 Pair Plot


**How to read:**
- **Grid of scatter plots**: every pair of numeric columns plotted against each other
- **Diagonal** = distribution of each variable (KDE or histogram)
- **Off-diagonal** = scatter of row-variable (y) vs column-variable (x)
- **Color** = categorical grouping — separated clusters suggest the groups differ on those dimensions
- Quick way to spot correlations, clusters, and outliers across all variable pairs



![Chart 28](/static/pandas-polars/viz_img_28.png)

### 7.8 Joint Plot


**How to read:**
- **Center** = scatter (or hexbin/KDE) of two variables
- **Top margin** = distribution of the x-variable
- **Right margin** = distribution of the y-variable
- **Hexbin mode**: color intensity = count of points in each hex — dark = dense cluster
- Combines relationship analysis with individual distributions in one view



![Chart 29](/static/pandas-polars/viz_img_29.png)

### 7.9 KDE Plot


**How to read:**
- **Curve height** = estimated probability density (not count)
- **Peaks** = modes — values where data concentrates
- **Width/spread** = variance — wider curve = more dispersed data
- **Fill** = area under curve always sums to 1.0
- Overlaying multiple KDEs reveals which groups overlap or separate in their distributions



![Chart 30](/static/pandas-polars/viz_img_30.png)

### 7.10 Regression Plot


**How to read:**
- **Dots** = individual data points
- **Line** = OLS (ordinary least squares) best-fit line
- **Shaded band** = 95% confidence interval around the regression line
- **Steep slope** = strong relationship; **flat slope** = weak/no relationship
- Wide confidence band = high uncertainty (small sample or high variance)



![Chart 31](/static/pandas-polars/viz_img_31.png)

### 7.11 Residual Plot


**How to read:**
- **Each dot** = residual (actual value minus predicted value from linear fit)
- **Ideal pattern**: random scatter around zero — no visible structure
- **Funnel shape** = heteroscedasticity (variance changes with x)
- **Curved pattern** = the relationship is non-linear — linear model is a poor fit
- **Clusters** = possible subgroups that the model treats as one



![Chart 32](/static/pandas-polars/viz_img_32.png)

### 7.12 Count Plot


**How to read:**
- **Bar length** = number of observations in each category
- Essentially a histogram for categorical data
- Ordered by count to quickly identify the most/least populated categories



![Chart 33](/static/pandas-polars/viz_img_33.png)

### 7.13 ECDF (Empirical CDF)


**How to read:**
- **X-axis** = variable values; **Y-axis** = cumulative proportion (0 to 1)
- Read as: "what fraction of data falls below this value?"
- **Steep section** = many values concentrated in a narrow range
- **Flat section** = sparse region with few data points
- Curves shifted right = higher values overall; compare vertical gaps between groups at any x to see which group has more data below that threshold



![Chart 34](/static/pandas-polars/viz_img_34.png)

### 7.14 Rug Plot


**How to read:**
- **Short ticks on the axis** = exact position of each data point
- Combined with KDE, it grounds the smooth curve in actual observations
- **Dense ticks** = cluster of values; **gaps** = sparse regions
- Useful for small-to-medium datasets; too many ticks become a solid bar



![Chart 35](/static/pandas-polars/viz_img_35.png)

## 8. Matplotlib — Advanced


Matplotlib is the low-level engine behind Pandas and Seaborn plots. Use it directly when you need **full control**: custom layouts, mixed chart types in subplots, annotations, polar coordinates, or any visualization not covered by higher-level APIs.

**Best for:** Publication-quality figures, custom dashboards, unconventional chart types (radar, stem), and any scenario where you need pixel-level control over every element.

### 8.1 Subplots Grid



![Chart 36](/static/pandas-polars/viz_img_36.png)

### 8.2 Step Plot


**How to read:**
- Value stays **flat** between changes, then jumps vertically
- Emphasizes that the value is constant between updates (unlike a line chart which implies interpolation)
- Best for discrete-step data: interest rates, pricing tiers, digital signals



![Chart 37](/static/pandas-polars/viz_img_37.png)

### 8.3 Stem Plot


**How to read:**
- **Vertical line** from baseline (zero) to the value — length = magnitude
- **Dot at tip** = the actual value
- Lines above zero = positive; below = negative
- Best for discrete events: daily returns, impulse responses, sparse signals



![Chart 38](/static/pandas-polars/viz_img_38.png)

### 8.4 Stackplot (matplotlib native)



![Chart 39](/static/pandas-polars/viz_img_39.png)

### 8.5 Polar / Radar Chart


**How to read:**
- Each **spoke** = one dimension/metric (e.g., momentum, value, sentiment, composite)
- **Distance from center** = score magnitude on that dimension
- **Shape** reveals the profile: balanced (regular polygon) vs specialized (elongated toward one spoke)
- Useful for comparing multi-dimensional profiles of a single entity



![Chart 40](/static/pandas-polars/viz_img_40.png)

### 8.6 Error Bar Plot


**How to read:**
- **Dot** = point estimate (mean)
- **Bars** = uncertainty range (here: ±1 standard deviation)
- **Short bars** = low dispersion (consistent values); **long bars** = high dispersion
- Non-overlapping error bars suggest the groups differ meaningfully



![Chart 41](/static/pandas-polars/viz_img_41.png)

### 8.7 Annotations & Text



![Chart 42](/static/pandas-polars/viz_img_42.png)

## 9. Polars to Pandas for Plotting



![Chart 43](/static/pandas-polars/viz_img_43.png)

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



## 1. Line Charts


Plotly line charts are **interactive** — hover for values, zoom, pan, and export. Faceting splits series into separate panels; dual Y-axes overlay different scales.

**Best for:** Interactive exploration of time-series data in notebooks or dashboards. Ideal when stakeholders need to zoom into specific date ranges or compare series on hover.

### 1.1 Basic Line



<iframe src="/static/plotly/viz_01.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

<iframe src="/static/plotly/viz_02.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 1.2 Multi-Series (color)



<iframe src="/static/plotly/viz_03.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 1.3 Faceted Lines



<iframe src="/static/plotly/viz_04.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 1.4 Dual Y-Axis (Graph Objects)



<iframe src="/static/plotly/viz_05.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 1.5 Line Styles & Markers



<iframe src="/static/plotly/viz_06.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

## 2. Bar Charts


Interactive bars support hover tooltips, click-to-filter, and animated transitions. Grouped bars (`barmode="group"`) compare side by side; stacked (`barmode="stack"`) show totals. Text labels (`text_auto`) make values readable without consulting the axis.

**Best for:** Presentations and dashboards where viewers need to read exact values via hover, or explore subsets by clicking legend items to toggle categories.

### 2.1 Basic Bar



<iframe src="/static/plotly/viz_07.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 2.2 Grouped Bar



<iframe src="/static/plotly/viz_08.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 2.3 Stacked Bar



<iframe src="/static/plotly/viz_09.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 2.4 Bar with Text Labels



<iframe src="/static/plotly/viz_10.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

## 3. Scatter Plots


Plotly scatter adds **hover details**, marginal distributions, trendlines, and 3D projection. Color, size, and symbol can each encode a different variable, turning a 2D plot into a 5D exploration tool.

**Best for:** Multi-dimensional exploration — when you want to encode 3–5 variables in a single view. OLS trendlines quantify relationships; marginals show distributions along each axis. 3D scatter is useful for PCA or factor analysis visualization.

### 3.1 Basic Scatter



<iframe src="/static/plotly/viz_11.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 3.2 Color, Size, Hover



<iframe src="/static/plotly/viz_12.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 3.3 Marginal Distributions


**How to read:**
- **Center** = main scatter plot showing the relationship
- **Top margin** = histogram of the x-variable's distribution
- **Right margin** = box plot of the y-variable's distribution
- Combines relationship analysis with individual variable summaries in one view



<iframe src="/static/plotly/viz_13.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 3.4 Trendline (OLS)


**How to read:**
- **Red line** = best-fit linear regression
- **Slope direction** = positive or negative correlation
- **Scatter tightness** around line = strength of relationship (R²)
- Hover the trendline to see equation and R² value



<iframe src="/static/plotly/viz_14.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 3.5 3D Scatter



<iframe src="/static/plotly/viz_15.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

## 4. Histograms & Distributions


Interactive histograms let you zoom into tails, hover for bin counts, and overlay multiple groups. Violin plots show the full density shape; box plots summarize with quartiles and outliers; strip plots show every individual point.

**Best for:** Comparing distributions across groups interactively. Use violin when shape matters (bimodality), box when you need quartile summary, strip/swarm for small datasets where every point counts.

### 4.1 Basic Histogram



<iframe src="/static/plotly/viz_16.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 4.2 Overlaid by Category



<iframe src="/static/plotly/viz_17.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 4.3 Histogram with Rug/Box



<iframe src="/static/plotly/viz_18.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 4.4 Violin Plot


**How to read:**
- **Width** = density (wider = more data at that level)
- **Internal box** = Q1, median, Q3 (same as box plot)
- **Points** = individual observations (when enabled)
- Compare shapes across categories: symmetric vs skewed, unimodal vs bimodal



<iframe src="/static/plotly/viz_19.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 4.5 Box Plot


**How to read:**
- **Box** = IQR (Q1 to Q3, middle 50%); **line** = median
- **Whiskers** = up to 1.5×IQR; **dots** = outliers beyond whiskers
- **Notch** = 95% CI for median; non-overlapping notches ≈ significant difference



<iframe src="/static/plotly/viz_20.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 4.6 Strip Plot


**How to read:**
- **Each dot** = one observation, jittered horizontally
- Hover to identify individual points by name
- Best for small datasets where you want to see every value



<iframe src="/static/plotly/viz_21.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

## 5. Area Charts


Interactive area charts support hover, zoom, and range selection. Stacked areas show composition over time — hover reveals each component's value at any point.

**Best for:** Interactive time-series composition in dashboards (trading volume by stock, resource usage by service).

### 5.1 Basic Area



<iframe src="/static/plotly/viz_22.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 5.2 Stacked Area



<iframe src="/static/plotly/viz_23.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

## 6. Pie, Sunburst & Treemap


Sunbursts and treemaps extend pie charts to **hierarchical data** — drill from sector to country to stock. Click to zoom into a level; hover for details. Treemaps use area (easier to compare than angles); sunbursts use concentric rings.

**Best for:** Hierarchical/nested categorical data (org structures, file sizes, market segments). Treemaps work well for space-efficient dashboards; sunbursts for exploring parent-child relationships.

### 6.1 Pie Chart



<iframe src="/static/plotly/viz_24.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 6.2 Donut Chart



<iframe src="/static/plotly/viz_25.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 6.3 Sunburst



<iframe src="/static/plotly/viz_26.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 6.4 Treemap



<iframe src="/static/plotly/viz_27.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

## 7. Heatmap & Correlation


Heatmaps encode a **matrix of values** as colors, ideal for correlation matrices and pivot tables. Interactive hover shows exact values; zoom lets you focus on subregions. Diverging color scales (RdBu) center on zero to distinguish positive from negative.

**Best for:** Correlation analysis, confusion matrices, time x category pivot tables, and any data naturally represented as a 2D grid (weekday x hour, gene expression matrices).

### 7.1 Correlation Matrix


**How to read:**
- **+1.0 (dark red)** = perfect positive correlation (both move together)
- **-1.0 (dark blue)** = perfect negative correlation (one goes up, other goes down)
- **0.0 (white)** = no linear relationship
- Look for off-diagonal clusters of strong color — these variables move together



<iframe src="/static/plotly/viz_28.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 7.2 Pivot Heatmap



<iframe src="/static/plotly/viz_29.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

## 8. Financial Charts


Candlestick and OHLC charts are standard for **price action analysis**. Each bar shows open, high, low, close for a period. Green = close > open (bullish); red = bearish. Adding a volume subplot shows trading activity — high volume confirms price moves.

**Best for:** Financial time-series (stocks, forex, crypto). Essential for technical analysis; the volume subplot helps distinguish meaningful moves from noise.

### 8.1 Candlestick


**How to read:**
- **Body** = range between open and close (filled/green = close > open = bullish; hollow/red = bearish)
- **Upper wick** = high of the day above the body
- **Lower wick** = low of the day below the body
- **Long wicks** = price was rejected at that level (buying/selling pressure)
- **Small body + long wicks** = indecision (doji)



<iframe src="/static/plotly/viz_30.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 8.2 OHLC


**How to read:**
- **Vertical line** = high-to-low range for the period
- **Left tick** = opening price
- **Right tick** = closing price
- Right tick above left = bullish; below = bearish
- Less visually heavy than candlesticks — preferred when overlaying many indicators



<iframe src="/static/plotly/viz_31.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 8.3 Candlestick + Volume Subplot



<iframe src="/static/plotly/viz_32.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

## 9. Subplots & Layout


Subplots arrange multiple charts in a grid for **dashboard-style views**. Shared axes link zoom/pan across panels. Plotly Express faceting (`facet_col`, `facet_row`) auto-creates grids from a categorical column.

**Best for:** Dashboards, multi-metric monitoring, comparing the same metric across categories (one chart per stock, per sensor, per region).

### 9.1 Grid of Subplots



<iframe src="/static/plotly/viz_33.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 9.2 Faceting with Plotly Express



<iframe src="/static/plotly/viz_34.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

## 10. Geographic Charts


Choropleth maps color regions by a metric — great for showing **geographic distribution**. Scatter maps plot points at coordinates with size/color encoding.

**Best for:** Any data with a geographic dimension (sales by country, offices on a map, sensor locations). Use ISO-3 country codes for reliable matching.

### 10.1 Choropleth



<iframe src="/static/plotly/viz_35.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 10.2 Scatter Map



<iframe src="/static/plotly/viz_36.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

## 11. Animated Charts


Animation adds a **time dimension** to any chart type. `animation_frame` in Plotly Express creates a slider that steps through values of a column. Use fixed axis ranges so the viewer can track movement rather than rescaling.

**Best for:** Showing evolution over time (rankings changing, clusters drifting, distributions shifting). Most impactful in presentations; less useful for static analysis (hard to compare frames).

### 11.1 Animated Line (cumulative)



<iframe src="/static/plotly/viz_37.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 11.2 Animated Scatter (built-in)



<iframe src="/static/plotly/viz_38.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

## 12. Styling, Templates & Themes


Templates control the overall look: background, grid, fonts, color palette. Built-in options include `plotly_dark`, `ggplot2`, `seaborn`, etc. Custom templates let you enforce brand consistency across all charts.

**Best for:** Ensuring visual consistency across a project or org. Set a default template once and all subsequent charts inherit it.

### 12.1 Built-in Templates



<iframe src="/static/plotly/viz_39.html" width="100%" height="650" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 12.2 Custom Styling



<iframe src="/static/plotly/viz_40.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 12.3 Annotations & Shapes



<iframe src="/static/plotly/viz_41.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

## 13. Advanced Interactivity


Dropdowns, range selectors, and custom hover templates turn charts into **mini-applications**. Dropdown buttons toggle trace visibility; range selectors offer 1M/3M/YTD presets. Custom hover templates control exactly what information appears on mouseover.

**Best for:** Stakeholder-facing dashboards where users need self-service exploration without writing code. Also useful in Jupyter for rapid what-if exploration.

### 13.1 Dropdown Buttons



<iframe src="/static/plotly/viz_42.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 13.2 Range Slider & Selector



<iframe src="/static/plotly/viz_43.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

### 13.3 Custom Hover Templates



<iframe src="/static/plotly/viz_44.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

## 14. Plotly with Polars DataFrames



<iframe src="/static/plotly/viz_45.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>



<iframe src="/static/plotly/viz_46.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>



<iframe src="/static/plotly/viz_47.html" width="100%" height="500" style="border:none; border-radius:8px;" loading="lazy"></iframe>

## 15. Exporting Charts



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
