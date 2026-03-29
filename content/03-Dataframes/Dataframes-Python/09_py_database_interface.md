---
type: reference
category: programming-languages
technology:
  - python
  - pandas
  - polars
tags: [pipeline, python, pandas, polars]
aliases:
  - SQLContext, DuckDB, SQL Server, database queries
keywords: [SQLContext, DuckDB, pyodbc, sqlalchemy, read_database, SQL, register, execute]
description: "Pandas/Polars DataFrame reference 09/10 — Database & SQL Interface (SQLContext, DuckDB, SQL Server connectivity). Side-by-side executable examples with cell outputs."
related:
  - "[[dataframes-index]]"
  - "[[09_cs_database_interface]]"
  - "[[programming-languages-index]]"
  - "[[08_py_visualization]]"
  - "[[10_py_testing_migration]]"
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# 09 — Database & SQL Interface

SQL queries against DataFrames (Polars SQLContext, DuckDB) and direct SQL Server connectivity.

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
import duckdb
import tempfile
import time
import shutil
import os
from dotenv import load_dotenv
from urllib.parse import quote_plus
import pyodbc
import sqlalchemy as sa
```

    OHLCV: (66355, 12), Dim: (169, 26), Scores: (466, 36)

## Polars SQLContext


- **SQL Context**: Register Polars DataFrames as SQL tables, query with standard SQL.

```python
ctx=pl.SQLContext(ohlcv=ohlcv_pl, dim=dim_pl, scores=scores_pl)
display(ctx.execute("SELECT * FROM ohlcv LIMIT 5").collect())
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

```python
display(ctx.execute("""
    SELECT symbol, AVG(close) as avg_close, COUNT(*) as days
    FROM ohlcv
    GROUP BY symbol
    ORDER BY avg_close DESC
    LIMIT 10
""").collect())
```

<div><!-- shape: (10, 3) --><table><thead><tr><th>symbol</th><th>avg_close</th><th>days</th></tr><tr><td>str</td><td>f64</td><td>u32</td></tr></thead><tbody><tr><td>RMS.PA</td><td>1761.555748</td><td>1331</td></tr><tr><td>ADYEN.AS</td><td>1545.976409</td><td>1331</td></tr><tr><td>ASML.AS</td><td>671.348911</td><td>1331</td></tr><tr><td>MC.PA</td><td>662.404508</td><td>1331</td></tr><tr><td>RHM.DE</td><td>544.661533</td><td>1324</td></tr><tr><td>ARGX.BR</td><td>413.691961</td><td>1331</td></tr><tr><td>OR.PA</td><td>377.544365</td><td>1331</td></tr><tr><td>MUV2.DE</td><td>374.659932</td><td>1324</td></tr><tr><td>RACE.MI</td><td>289.753823</td><td>1321</td></tr><tr><td>ALV.DE</td><td>252.193731</td><td>1324</td></tr></tbody></table></div>

```python
display(ctx.execute("""
    SELECT ohlcv.symbol, dim.short_name, dim.sector, ohlcv.close
    FROM ohlcv
    JOIN dim USING (symbol)
    WHERE dim.country = 'Germany'
    ORDER BY ohlcv.close DESC
    LIMIT 10
""").collect())
```

<div><!-- shape: (10, 4) --><table><thead><tr><th>symbol</th><th>short_name</th><th>sector</th><th>close</th></tr><tr><td>str</td><td>str</td><td>str</td><td>f64</td></tr></thead><tbody><tr><td>RHM.DE</td><td>RHEINMETALL AG</td><td>Industrials</td><td>1988.5</td></tr><tr><td>RHM.DE</td><td>RHEINMETALL AG</td><td>Industrials</td><td>1988.5</td></tr><tr><td>RHM.DE</td><td>RHEINMETALL AG</td><td>Industrials</td><td>1986.0</td></tr><tr><td>RHM.DE</td><td>RHEINMETALL AG</td><td>Industrials</td><td>1978.5</td></tr><tr><td>RHM.DE</td><td>RHEINMETALL AG</td><td>Industrials</td><td>1978.5</td></tr><tr><td>RHM.DE</td><td>RHEINMETALL AG</td><td>Industrials</td><td>1962.5</td></tr><tr><td>RHM.DE</td><td>RHEINMETALL AG</td><td>Industrials</td><td>1962.5</td></tr><tr><td>RHM.DE</td><td>RHEINMETALL AG</td><td>Industrials</td><td>1960.5</td></tr><tr><td>RHM.DE</td><td>RHEINMETALL AG</td><td>Industrials</td><td>1951.0</td></tr><tr><td>RHM.DE</td><td>RHEINMETALL AG</td><td>Industrials</td><td>1950.0</td></tr></tbody></table></div>

## Window Functions in SQL

The SQL syntax used in Polars SQLContext follows the same patterns as [[sql-fundamentals]] for SQL Server and [[bq-fundamentals]] for BigQuery. For direct Python database access with pyodbc and SQLAlchemy outside of DataFrames, see [[16_py_database]].

- **Rolling Window**: Compute statistics over a sliding window of N consecutive rows (e.g., 7-day moving average).
- **With Columns**: Add new columns or replace existing ones. All original columns are kept.

```python
# Polars SQL does not yet support custom ROWS BETWEEN frames.
# Use the expression API for rolling windows instead:
result = (
    ctx.execute("""
        SELECT symbol, date, close,
            AVG(close) OVER (PARTITION BY symbol ORDER BY date) as cumulative_avg
        FROM ohlcv
        WHERE symbol = 'ASML.AS'
        ORDER BY date DESC
        LIMIT 10
    """).collect()
)
display(result)

# For SMA-7, use the expression API:
sma_result = (
    ohlcv_pl
    .filter(pl.col("symbol") == "ASML.AS")
    .sort("date")
    .with_columns(pl.col("close").rolling_mean(7).alias("sma_7"))
    .select("symbol", "date", "close", "sma_7")
    .sort("date", descending=True)
    .head(10)
)
display(sma_result)
```

<div><!-- shape: (10, 4) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>cumulative_avg</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>ASML.AS</td><td>2026-03-12</td><td>1190.8</td><td>671.348911</td></tr><tr><td>ASML.AS</td><td>2026-03-11</td><td>1198.8</td><td>671.348911</td></tr><tr><td>ASML.AS</td><td>2026-03-10</td><td>1200.0</td><td>671.348911</td></tr><tr><td>ASML.AS</td><td>2026-03-09</td><td>1147.6</td><td>671.348911</td></tr><tr><td>ASML.AS</td><td>2026-03-06</td><td>1147.0</td><td>671.348911</td></tr><tr><td>ASML.AS</td><td>2026-03-05</td><td>1186.0</td><td>671.348911</td></tr><tr><td>ASML.AS</td><td>2026-03-04</td><td>1199.8</td><td>671.348911</td></tr><tr><td>ASML.AS</td><td>2026-03-03</td><td>1161.8</td><td>671.348911</td></tr><tr><td>ASML.AS</td><td>2026-03-02</td><td>1210.4</td><td>671.348911</td></tr><tr><td>ASML.AS</td><td>2026-02-27</td><td>1233.4</td><td>671.348911</td></tr></tbody></table></div>

<div><!-- shape: (10, 4) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>sma_7</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>ASML.AS</td><td>2026-03-12</td><td>1190.8</td><td>1181.428571</td></tr><tr><td>ASML.AS</td><td>2026-03-11</td><td>1198.8</td><td>1177.285714</td></tr><tr><td>ASML.AS</td><td>2026-03-10</td><td>1200.0</td><td>1178.942857</td></tr><tr><td>ASML.AS</td><td>2026-03-09</td><td>1147.6</td><td>1183.714286</td></tr><tr><td>ASML.AS</td><td>2026-03-06</td><td>1147.0</td><td>1195.828571</td></tr><tr><td>ASML.AS</td><td>2026-03-05</td><td>1186.0</td><td>1216.028571</td></tr><tr><td>ASML.AS</td><td>2026-03-04</td><td>1199.8</td><td>1227.085714</td></tr><tr><td>ASML.AS</td><td>2026-03-03</td><td>1161.8</td><td>1234.142857</td></tr><tr><td>ASML.AS</td><td>2026-03-02</td><td>1210.4</td><td>1247.542857</td></tr><tr><td>ASML.AS</td><td>2026-02-27</td><td>1233.4</td><td>1251.514286</td></tr></tbody></table></div>

## DuckDB — Embedded Analytical Database

DuckDB is an in-process OLAP database (like SQLite for analytics). It queries Pandas/Polars DataFrames in-place, reads Parquet/CSV directly, and supports full SQL including window functions, CTEs, and JSON. No server needed — runs in the notebook process.

### Setup & Create Tables from Parquet

```python
# In-memory database (default)
db = duckdb.connect()

# Load the same datasets as SQL Server tables — directly from Parquet
db.execute("CREATE TABLE eurostoxx50_ohlcv AS SELECT * FROM read_parquet('../data/eurostoxx50_ohlcv.parquet')")
db.execute("CREATE TABLE index_dim AS SELECT * FROM read_parquet('../data/index_dim.parquet')")
db.execute("CREATE TABLE scores_daily AS SELECT * FROM read_parquet('../data/scores_daily.parquet')")

# Verify
for t in ["eurostoxx50_ohlcv", "index_dim", "scores_daily"]:
    row = db.execute(f"SELECT COUNT(*) FROM {t}").fetchone()
    count = row[0] if row else 0
    print(f"{t}: {count:,} rows")
```

    eurostoxx50_ohlcv: 66,355 rows
    index_dim: 169 rows
    scores_daily: 466 rows

### Basic Queries

```python
# SELECT with filtering and ordering
display(db.execute("""
    SELECT symbol, date, close, volume
    FROM eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS'
    ORDER BY date DESC
    LIMIT 10
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>close</th>
      <th>volume</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>128223</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ASML.AS</td>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>562904</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>800815</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ASML.AS</td>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>689086</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ASML.AS</td>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>857271</td>
    </tr>
    <tr>
      <th>5</th>
      <td>ASML.AS</td>
      <td>2026-03-05</td>
      <td>1186.0</td>
      <td>778081</td>
    </tr>
    <tr>
      <th>6</th>
      <td>ASML.AS</td>
      <td>2026-03-04</td>
      <td>1199.8</td>
      <td>714587</td>
    </tr>
    <tr>
      <th>7</th>
      <td>ASML.AS</td>
      <td>2026-03-03</td>
      <td>1161.8</td>
      <td>941945</td>
    </tr>
    <tr>
      <th>8</th>
      <td>ASML.AS</td>
      <td>2026-03-02</td>
      <td>1210.4</td>
      <td>871267</td>
    </tr>
    <tr>
      <th>9</th>
      <td>ASML.AS</td>
      <td>2026-02-27</td>
      <td>1233.4</td>
      <td>1010698</td>
    </tr>
  </tbody>
</table>

```python
# Aggregation
display(db.execute("""
    SELECT symbol,
           COUNT(*) as days,
           ROUND(AVG(close), 2) as avg_close,
           ROUND(MIN(close), 2) as min_close,
           ROUND(MAX(close), 2) as max_close
    FROM eurostoxx50_ohlcv
    GROUP BY symbol
    ORDER BY avg_close DESC
    LIMIT 10
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>days</th>
      <th>avg_close</th>
      <th>min_close</th>
      <th>max_close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>RMS.PA</td>
      <td>1331</td>
      <td>1761.56</td>
      <td>842.60</td>
      <td>2839.0</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ADYEN.AS</td>
      <td>1331</td>
      <td>1545.98</td>
      <td>630.80</td>
      <td>2766.0</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>1331</td>
      <td>671.35</td>
      <td>397.45</td>
      <td>1288.4</td>
    </tr>
    <tr>
      <th>3</th>
      <td>MC.PA</td>
      <td>1331</td>
      <td>662.40</td>
      <td>437.55</td>
      <td>902.0</td>
    </tr>
    <tr>
      <th>4</th>
      <td>RHM.DE</td>
      <td>1324</td>
      <td>544.66</td>
      <td>77.00</td>
      <td>1988.5</td>
    </tr>
    <tr>
      <th>5</th>
      <td>ARGX.BR</td>
      <td>1331</td>
      <td>413.69</td>
      <td>208.80</td>
      <td>803.0</td>
    </tr>
    <tr>
      <th>6</th>
      <td>OR.PA</td>
      <td>1331</td>
      <td>377.54</td>
      <td>290.10</td>
      <td>456.9</td>
    </tr>
    <tr>
      <th>7</th>
      <td>MUV2.DE</td>
      <td>1324</td>
      <td>374.66</td>
      <td>209.15</td>
      <td>610.6</td>
    </tr>
    <tr>
      <th>8</th>
      <td>RACE.MI</td>
      <td>1321</td>
      <td>289.75</td>
      <td>154.70</td>
      <td>487.9</td>
    </tr>
    <tr>
      <th>9</th>
      <td>ALV.DE</td>
      <td>1324</td>
      <td>252.19</td>
      <td>159.62</td>
      <td>392.7</td>
    </tr>
  </tbody>
</table>

```python
# JOIN tables
display(db.execute("""
    SELECT d.symbol, d.short_name, d.sector, d.country,
           ROUND(AVG(o.close), 2) as avg_close,
           ROUND(AVG(o.volume), 0) as avg_volume
    FROM eurostoxx50_ohlcv o
    JOIN index_dim d USING (symbol)
    GROUP BY d.symbol, d.short_name, d.sector, d.country
    ORDER BY avg_close DESC
    LIMIT 10
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>short_name</th>
      <th>sector</th>
      <th>country</th>
      <th>avg_close</th>
      <th>avg_volume</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>RMS.PA</td>
      <td>HERMES INTL</td>
      <td>Consumer Cyclical</td>
      <td>France</td>
      <td>1761.56</td>
      <td>61333.0</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ADYEN.AS</td>
      <td>ADYEN</td>
      <td>Technology</td>
      <td>Netherlands</td>
      <td>1545.98</td>
      <td>82946.0</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>ASML HOLDING</td>
      <td>Technology</td>
      <td>Netherlands</td>
      <td>671.35</td>
      <td>710046.0</td>
    </tr>
    <tr>
      <th>3</th>
      <td>MC.PA</td>
      <td>LVMH</td>
      <td>Consumer Cyclical</td>
      <td>France</td>
      <td>662.40</td>
      <td>419125.0</td>
    </tr>
    <tr>
      <th>4</th>
      <td>RHM.DE</td>
      <td>RHEINMETALL AG</td>
      <td>Industrials</td>
      <td>Germany</td>
      <td>544.66</td>
      <td>232900.0</td>
    </tr>
    <tr>
      <th>5</th>
      <td>ARGX.BR</td>
      <td>ARGENX SE</td>
      <td>Healthcare</td>
      <td>Netherlands</td>
      <td>413.69</td>
      <td>71069.0</td>
    </tr>
    <tr>
      <th>6</th>
      <td>OR.PA</td>
      <td>L'OREAL</td>
      <td>Consumer Defensive</td>
      <td>France</td>
      <td>377.54</td>
      <td>363723.0</td>
    </tr>
    <tr>
      <th>7</th>
      <td>MUV2.DE</td>
      <td>MUENCHENER RUECKVERS.-GES. AG N</td>
      <td>Financial Services</td>
      <td>Germany</td>
      <td>374.66</td>
      <td>301211.0</td>
    </tr>
    <tr>
      <th>8</th>
      <td>RACE.MI</td>
      <td>FERRARI</td>
      <td>Consumer Cyclical</td>
      <td>Italy</td>
      <td>289.75</td>
      <td>360852.0</td>
    </tr>
    <tr>
      <th>9</th>
      <td>ALV.DE</td>
      <td>Allianz SE</td>
      <td>Financial Services</td>
      <td>Germany</td>
      <td>252.19</td>
      <td>832296.0</td>
    </tr>
  </tbody>
</table>

### Query DataFrames Directly (Zero-Copy)

```python
# DuckDB can query Pandas DataFrames by variable name — no import needed
display(db.execute("""
    SELECT symbol, AVG(close) as avg_close
    FROM ohlcv_pd
    GROUP BY symbol
    ORDER BY avg_close DESC
    LIMIT 5
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>avg_close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>RMS.PA</td>
      <td>1761.555748</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ADYEN.AS</td>
      <td>1545.976409</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>671.348911</td>
    </tr>
    <tr>
      <th>3</th>
      <td>MC.PA</td>
      <td>662.404508</td>
    </tr>
    <tr>
      <th>4</th>
      <td>RHM.DE</td>
      <td>544.661533</td>
    </tr>
  </tbody>
</table>

```python
# Also works with Polars DataFrames
display(db.execute("""
    SELECT sector, COUNT(*) as stocks
    FROM dim_pl
    GROUP BY sector
    ORDER BY stocks DESC
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>sector</th>
      <th>stocks</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Financial Services</td>
      <td>32</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Technology</td>
      <td>26</td>
    </tr>
    <tr>
      <th>2</th>
      <td>Energy</td>
      <td>24</td>
    </tr>
    <tr>
      <th>3</th>
      <td>Industrials</td>
      <td>22</td>
    </tr>
    <tr>
      <th>4</th>
      <td>Consumer Cyclical</td>
      <td>18</td>
    </tr>
    <tr>
      <th>5</th>
      <td>Healthcare</td>
      <td>15</td>
    </tr>
    <tr>
      <th>6</th>
      <td>Consumer Defensive</td>
      <td>12</td>
    </tr>
    <tr>
      <th>7</th>
      <td>Communication Services</td>
      <td>12</td>
    </tr>
    <tr>
      <th>8</th>
      <td>Basic Materials</td>
      <td>6</td>
    </tr>
    <tr>
      <th>9</th>
      <td>Utilities</td>
      <td>2</td>
    </tr>
  </tbody>
</table>

### Window Functions

```python
# Rank stocks by avg close within each sector
display(db.execute("""
    SELECT symbol, sector, avg_close,
           RANK() OVER (PARTITION BY sector ORDER BY avg_close DESC) as sector_rank
    FROM (
        SELECT o.symbol, d.sector, ROUND(AVG(o.close), 2) as avg_close
        FROM eurostoxx50_ohlcv o
        JOIN index_dim d USING (symbol)
        GROUP BY o.symbol, d.sector
    )
    QUALIFY sector_rank <= 3
    ORDER BY sector, sector_rank
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>sector</th>
      <th>avg_close</th>
      <th>sector_rank</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>AI.PA</td>
      <td>Basic Materials</td>
      <td>145.43</td>
      <td>1</td>
    </tr>
    <tr>
      <th>1</th>
      <td>BAS.DE</td>
      <td>Basic Materials</td>
      <td>50.56</td>
      <td>2</td>
    </tr>
    <tr>
      <th>2</th>
      <td>DTE.DE</td>
      <td>Communication Services</td>
      <td>22.43</td>
      <td>1</td>
    </tr>
    <tr>
      <th>3</th>
      <td>RMS.PA</td>
      <td>Consumer Cyclical</td>
      <td>1761.56</td>
      <td>1</td>
    </tr>
    <tr>
      <th>4</th>
      <td>MC.PA</td>
      <td>Consumer Cyclical</td>
      <td>662.40</td>
      <td>2</td>
    </tr>
    <tr>
      <th>5</th>
      <td>RACE.MI</td>
      <td>Consumer Cyclical</td>
      <td>289.75</td>
      <td>3</td>
    </tr>
    <tr>
      <th>6</th>
      <td>OR.PA</td>
      <td>Consumer Defensive</td>
      <td>377.54</td>
      <td>1</td>
    </tr>
    <tr>
      <th>7</th>
      <td>BN.PA</td>
      <td>Consumer Defensive</td>
      <td>60.29</td>
      <td>2</td>
    </tr>
    <tr>
      <th>8</th>
      <td>ABI.BR</td>
      <td>Consumer Defensive</td>
      <td>54.86</td>
      <td>3</td>
    </tr>
    <tr>
      <th>9</th>
      <td>TTE.PA</td>
      <td>Energy</td>
      <td>53.14</td>
      <td>1</td>
    </tr>
    <tr>
      <th>10</th>
      <td>ENI.MI</td>
      <td>Energy</td>
      <td>13.40</td>
      <td>2</td>
    </tr>
    <tr>
      <th>11</th>
      <td>MUV2.DE</td>
      <td>Financial Services</td>
      <td>374.66</td>
      <td>1</td>
    </tr>
    <tr>
      <th>12</th>
      <td>ALV.DE</td>
      <td>Financial Services</td>
      <td>252.19</td>
      <td>2</td>
    </tr>
    <tr>
      <th>13</th>
      <td>DB1.DE</td>
      <td>Financial Services</td>
      <td>184.80</td>
      <td>3</td>
    </tr>
    <tr>
      <th>14</th>
      <td>ARGX.BR</td>
      <td>Healthcare</td>
      <td>413.69</td>
      <td>1</td>
    </tr>
    <tr>
      <th>15</th>
      <td>EL.PA</td>
      <td>Healthcare</td>
      <td>191.91</td>
      <td>2</td>
    </tr>
    <tr>
      <th>16</th>
      <td>SAN.PA</td>
      <td>Healthcare</td>
      <td>90.30</td>
      <td>3</td>
    </tr>
    <tr>
      <th>17</th>
      <td>RHM.DE</td>
      <td>Industrials</td>
      <td>544.66</td>
      <td>1</td>
    </tr>
    <tr>
      <th>18</th>
      <td>SU.PA</td>
      <td>Industrials</td>
      <td>179.03</td>
      <td>2</td>
    </tr>
    <tr>
      <th>19</th>
      <td>SAF.PA</td>
      <td>Industrials</td>
      <td>171.83</td>
      <td>3</td>
    </tr>
    <tr>
      <th>20</th>
      <td>ADYEN.AS</td>
      <td>Technology</td>
      <td>1545.98</td>
      <td>1</td>
    </tr>
    <tr>
      <th>21</th>
      <td>ASML.AS</td>
      <td>Technology</td>
      <td>671.35</td>
      <td>2</td>
    </tr>
    <tr>
      <th>22</th>
      <td>SAP.DE</td>
      <td>Technology</td>
      <td>154.33</td>
      <td>3</td>
    </tr>
    <tr>
      <th>23</th>
      <td>IBE.MC</td>
      <td>Utilities</td>
      <td>12.26</td>
      <td>1</td>
    </tr>
    <tr>
      <th>24</th>
      <td>ENEL.MI</td>
      <td>Utilities</td>
      <td>6.82</td>
      <td>2</td>
    </tr>
  </tbody>
</table>

```python
# Running average and lag/lead
display(db.execute("""
    SELECT date, close,
           ROUND(AVG(close) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2) as sma_7,
           ROUND(AVG(close) OVER (ORDER BY date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW), 2) as sma_30,
           LAG(close, 1) OVER (ORDER BY date) as prev_close,
           ROUND((close - LAG(close, 1) OVER (ORDER BY date)) / LAG(close, 1) OVER (ORDER BY date) * 100, 2) as daily_return_pct
    FROM eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS'
    ORDER BY date DESC
    LIMIT 15
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>date</th>
      <th>close</th>
      <th>sma_7</th>
      <th>sma_30</th>
      <th>prev_close</th>
      <th>daily_return_pct</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>1181.43</td>
      <td>1204.41</td>
      <td>1198.8</td>
      <td>-0.67</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>1177.29</td>
      <td>1204.45</td>
      <td>1200.0</td>
      <td>-0.10</td>
    </tr>
    <tr>
      <th>2</th>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>1178.94</td>
      <td>1204.31</td>
      <td>1147.6</td>
      <td>4.57</td>
    </tr>
    <tr>
      <th>3</th>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>1183.71</td>
      <td>1204.89</td>
      <td>1147.0</td>
      <td>0.05</td>
    </tr>
    <tr>
      <th>4</th>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>1195.83</td>
      <td>1205.91</td>
      <td>1186.0</td>
      <td>-3.29</td>
    </tr>
    <tr>
      <th>5</th>
      <td>2026-03-05</td>
      <td>1186.0</td>
      <td>1216.03</td>
      <td>1206.95</td>
      <td>1199.8</td>
      <td>-1.15</td>
    </tr>
    <tr>
      <th>6</th>
      <td>2026-03-04</td>
      <td>1199.8</td>
      <td>1227.09</td>
      <td>1206.63</td>
      <td>1161.8</td>
      <td>3.27</td>
    </tr>
    <tr>
      <th>7</th>
      <td>2026-03-03</td>
      <td>1161.8</td>
      <td>1234.14</td>
      <td>1205.13</td>
      <td>1210.4</td>
      <td>-4.02</td>
    </tr>
    <tr>
      <th>8</th>
      <td>2026-03-02</td>
      <td>1210.4</td>
      <td>1247.54</td>
      <td>1204.40</td>
      <td>1233.4</td>
      <td>-1.86</td>
    </tr>
    <tr>
      <th>9</th>
      <td>2026-02-27</td>
      <td>1233.4</td>
      <td>1251.51</td>
      <td>1201.40</td>
      <td>1232.4</td>
      <td>0.08</td>
    </tr>
    <tr>
      <th>10</th>
      <td>2026-02-26</td>
      <td>1232.4</td>
      <td>1253.14</td>
      <td>1199.19</td>
      <td>1288.4</td>
      <td>-4.35</td>
    </tr>
    <tr>
      <th>11</th>
      <td>2026-02-25</td>
      <td>1288.4</td>
      <td>1248.40</td>
      <td>1196.43</td>
      <td>1263.4</td>
      <td>1.98</td>
    </tr>
    <tr>
      <th>12</th>
      <td>2026-02-24</td>
      <td>1263.4</td>
      <td>1235.06</td>
      <td>1189.62</td>
      <td>1249.2</td>
      <td>1.14</td>
    </tr>
    <tr>
      <th>13</th>
      <td>2026-02-23</td>
      <td>1249.2</td>
      <td>1224.63</td>
      <td>1184.26</td>
      <td>1255.6</td>
      <td>-0.51</td>
    </tr>
    <tr>
      <th>14</th>
      <td>2026-02-20</td>
      <td>1255.6</td>
      <td>1214.71</td>
      <td>1178.83</td>
      <td>1238.2</td>
      <td>1.41</td>
    </tr>
  </tbody>
</table>

```python
# NTILE, PERCENT_RANK, CUME_DIST
display(db.execute("""
    SELECT symbol, avg_close,
           NTILE(4) OVER (ORDER BY avg_close) as quartile,
           ROUND(PERCENT_RANK() OVER (ORDER BY avg_close), 3) as pct_rank,
           ROUND(CUME_DIST() OVER (ORDER BY avg_close), 3) as cume_dist
    FROM (
        SELECT symbol, ROUND(AVG(close), 2) as avg_close
        FROM eurostoxx50_ohlcv
        GROUP BY symbol
    )
    ORDER BY avg_close DESC
    LIMIT 15
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>avg_close</th>
      <th>quartile</th>
      <th>pct_rank</th>
      <th>cume_dist</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>RMS.PA</td>
      <td>1761.56</td>
      <td>4</td>
      <td>1.000</td>
      <td>1.00</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ADYEN.AS</td>
      <td>1545.98</td>
      <td>4</td>
      <td>0.980</td>
      <td>0.98</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>671.35</td>
      <td>4</td>
      <td>0.959</td>
      <td>0.96</td>
    </tr>
    <tr>
      <th>3</th>
      <td>MC.PA</td>
      <td>662.40</td>
      <td>4</td>
      <td>0.939</td>
      <td>0.94</td>
    </tr>
    <tr>
      <th>4</th>
      <td>RHM.DE</td>
      <td>544.66</td>
      <td>4</td>
      <td>0.918</td>
      <td>0.92</td>
    </tr>
    <tr>
      <th>5</th>
      <td>ARGX.BR</td>
      <td>413.69</td>
      <td>4</td>
      <td>0.898</td>
      <td>0.90</td>
    </tr>
    <tr>
      <th>6</th>
      <td>OR.PA</td>
      <td>377.54</td>
      <td>4</td>
      <td>0.878</td>
      <td>0.88</td>
    </tr>
    <tr>
      <th>7</th>
      <td>MUV2.DE</td>
      <td>374.66</td>
      <td>4</td>
      <td>0.857</td>
      <td>0.86</td>
    </tr>
    <tr>
      <th>8</th>
      <td>RACE.MI</td>
      <td>289.75</td>
      <td>4</td>
      <td>0.837</td>
      <td>0.84</td>
    </tr>
    <tr>
      <th>9</th>
      <td>ALV.DE</td>
      <td>252.19</td>
      <td>4</td>
      <td>0.816</td>
      <td>0.82</td>
    </tr>
    <tr>
      <th>10</th>
      <td>ADS.DE</td>
      <td>205.43</td>
      <td>4</td>
      <td>0.796</td>
      <td>0.80</td>
    </tr>
    <tr>
      <th>11</th>
      <td>EL.PA</td>
      <td>191.91</td>
      <td>4</td>
      <td>0.776</td>
      <td>0.78</td>
    </tr>
    <tr>
      <th>12</th>
      <td>DB1.DE</td>
      <td>184.80</td>
      <td>3</td>
      <td>0.755</td>
      <td>0.76</td>
    </tr>
    <tr>
      <th>13</th>
      <td>SU.PA</td>
      <td>179.03</td>
      <td>3</td>
      <td>0.735</td>
      <td>0.74</td>
    </tr>
    <tr>
      <th>14</th>
      <td>SAF.PA</td>
      <td>171.83</td>
      <td>3</td>
      <td>0.714</td>
      <td>0.72</td>
    </tr>
  </tbody>
</table>

### Common Table Expressions (CTEs)

```python
# Multi-level CTE
display(db.execute("""
    WITH daily_returns AS (
        SELECT symbol, date, close,
               (close - LAG(close) OVER (PARTITION BY symbol ORDER BY date))
               / LAG(close) OVER (PARTITION BY symbol ORDER BY date) * 100 as ret
        FROM eurostoxx50_ohlcv
    ),
    volatility AS (
        SELECT symbol,
               ROUND(STDDEV(ret), 2) as daily_vol,
               ROUND(AVG(ret), 4) as avg_ret,
               COUNT(*) as days
        FROM daily_returns
        WHERE ret IS NOT NULL
        GROUP BY symbol
    )
    SELECT v.symbol, d.sector, v.daily_vol, v.avg_ret,
           ROUND(v.daily_vol * SQRT(252), 2) as annualized_vol
    FROM volatility v
    JOIN index_dim d USING (symbol)
    ORDER BY annualized_vol DESC
    LIMIT 10
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>sector</th>
      <th>daily_vol</th>
      <th>avg_ret</th>
      <th>annualized_vol</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ADYEN.AS</td>
      <td>Technology</td>
      <td>3.17</td>
      <td>-0.0010</td>
      <td>50.32</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ENR.DE</td>
      <td>Industrials</td>
      <td>3.15</td>
      <td>0.1762</td>
      <td>50.00</td>
    </tr>
    <tr>
      <th>2</th>
      <td>RHM.DE</td>
      <td>Industrials</td>
      <td>2.57</td>
      <td>0.2498</td>
      <td>40.80</td>
    </tr>
    <tr>
      <th>3</th>
      <td>PRX.AS</td>
      <td>Consumer Cyclical</td>
      <td>2.50</td>
      <td>0.0400</td>
      <td>39.69</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ARGX.BR</td>
      <td>Healthcare</td>
      <td>2.48</td>
      <td>0.1015</td>
      <td>39.37</td>
    </tr>
    <tr>
      <th>5</th>
      <td>ASML.AS</td>
      <td>Technology</td>
      <td>2.37</td>
      <td>0.1091</td>
      <td>37.62</td>
    </tr>
    <tr>
      <th>6</th>
      <td>IFX.DE</td>
      <td>Technology</td>
      <td>2.35</td>
      <td>0.0455</td>
      <td>37.31</td>
    </tr>
    <tr>
      <th>7</th>
      <td>VOW.DE</td>
      <td>Consumer Cyclical</td>
      <td>2.24</td>
      <td>-0.0194</td>
      <td>35.56</td>
    </tr>
    <tr>
      <th>8</th>
      <td>UCG.MI</td>
      <td>Financial Services</td>
      <td>2.24</td>
      <td>0.1891</td>
      <td>35.56</td>
    </tr>
    <tr>
      <th>9</th>
      <td>ADS.DE</td>
      <td>Consumer Cyclical</td>
      <td>2.17</td>
      <td>-0.0330</td>
      <td>34.45</td>
    </tr>
  </tbody>
</table>

### Recursive CTE

```python
# Generate a date series using recursive CTE
display(db.execute("""
    WITH RECURSIVE dates AS (
        SELECT DATE '2024-01-01' as dt
        UNION ALL
        SELECT dt + INTERVAL 1 DAY FROM dates WHERE dt < DATE '2024-01-10'
    )
    SELECT dt, DAYNAME(dt) as day_name FROM dates
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>dt</th>
      <th>day_name</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>2024-01-01</td>
      <td>Monday</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2024-01-02</td>
      <td>Tuesday</td>
    </tr>
    <tr>
      <th>2</th>
      <td>2024-01-03</td>
      <td>Wednesday</td>
    </tr>
    <tr>
      <th>3</th>
      <td>2024-01-04</td>
      <td>Thursday</td>
    </tr>
    <tr>
      <th>4</th>
      <td>2024-01-05</td>
      <td>Friday</td>
    </tr>
    <tr>
      <th>5</th>
      <td>2024-01-06</td>
      <td>Saturday</td>
    </tr>
    <tr>
      <th>6</th>
      <td>2024-01-07</td>
      <td>Sunday</td>
    </tr>
    <tr>
      <th>7</th>
      <td>2024-01-08</td>
      <td>Monday</td>
    </tr>
    <tr>
      <th>8</th>
      <td>2024-01-09</td>
      <td>Tuesday</td>
    </tr>
    <tr>
      <th>9</th>
      <td>2024-01-10</td>
      <td>Wednesday</td>
    </tr>
  </tbody>
</table>

### Read Files Directly (No Import Step)

```python
# Query Parquet files without loading into memory
display(db.execute("""
    SELECT symbol, date, close
    FROM read_parquet('../data/eurostoxx50_ohlcv.parquet')
    WHERE symbol = 'SAP.DE'
    ORDER BY date DESC
    LIMIT 5
""").df())
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
      <td>SAP.DE</td>
      <td>2026-03-12</td>
      <td>166.52</td>
    </tr>
    <tr>
      <th>1</th>
      <td>SAP.DE</td>
      <td>2026-03-11</td>
      <td>165.44</td>
    </tr>
    <tr>
      <th>2</th>
      <td>SAP.DE</td>
      <td>2026-03-10</td>
      <td>169.60</td>
    </tr>
    <tr>
      <th>3</th>
      <td>SAP.DE</td>
      <td>2026-03-09</td>
      <td>171.88</td>
    </tr>
    <tr>
      <th>4</th>
      <td>SAP.DE</td>
      <td>2026-03-06</td>
      <td>172.74</td>
    </tr>
  </tbody>
</table>

```python
# Query CSV files directly
display(db.execute("""
    SELECT *
    FROM read_csv_auto('../data/scores_daily.csv')
    LIMIT 5
""").df())
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
# Query multiple Parquet files with glob
display(db.execute("""
    SELECT COUNT(*) as total_rows, MIN(date) as earliest, MAX(date) as latest
    FROM read_parquet('../data/*_ohlcv.parquet')
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>total_rows</th>
      <th>earliest</th>
      <th>latest</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>156193</td>
      <td>2021-01-04</td>
      <td>2026-03-12</td>
    </tr>
  </tbody>
</table>

### Export Results

```python
TMP = Path(tempfile.mkdtemp())

# Export query result to Parquet
db.execute(f"""
    COPY (
        SELECT symbol, date, close FROM eurostoxx50_ohlcv
        WHERE symbol = 'ASML.AS'
    ) TO '{TMP}/asml.parquet' (FORMAT PARQUET, COMPRESSION ZSTD)
""")
print(f"Parquet: {(TMP / 'asml.parquet').stat().st_size:,} bytes")

# Export to CSV
db.execute(f"""
    COPY (
        SELECT symbol, date, close FROM eurostoxx50_ohlcv
        WHERE symbol = 'ASML.AS'
    ) TO '{TMP}/asml.csv' (FORMAT CSV, HEADER TRUE)
""")
print(f"CSV: {(TMP / 'asml.csv').stat().st_size:,} bytes")

# Export to JSON
db.execute(f"""
    COPY (
        SELECT symbol, date, close FROM eurostoxx50_ohlcv
        WHERE symbol = 'ASML.AS'
        LIMIT 5
    ) TO '{TMP}/asml.json' (FORMAT JSON)
""")
print(f"JSON: {(TMP / 'asml.json').stat().st_size:,} bytes")
print((TMP / "asml.json").read_text()[:300])
```

    Parquet: 6,823 bytes
    CSV: 33,410 bytes
    JSON: 278 bytes
    {"symbol":"ASML.AS","date":"2021-01-04","close":406.25}
    {"symbol":"ASML.AS","date":"2021-01-05","close":406.9}
    {"symbol":"ASML.AS","date":"2021-01-06","close":402.85}
    {"symbol":"ASML.AS","date":"2021-01-07","close":403.9}
    {"symbol":"ASML.AS","date":"2021-01-08","close":416.05}

### Result Conversion: Pandas, Polars, Arrow

```python
query = "SELECT symbol, date, close FROM eurostoxx50_ohlcv WHERE symbol = 'ASML.AS' LIMIT 5"

# To Pandas
df_pd = db.execute(query).df()
print(f"Pandas: {type(df_pd).__name__}, shape={df_pd.shape}")

# To Polars
df_pl = db.execute(query).pl()
print(f"Polars: {type(df_pl).__name__}, shape={df_pl.shape}")

# To Arrow
table = db.execute(query).arrow().read_all()
print(f"Arrow:  {type(table).__name__}, rows={table.num_rows}")

# To Python lists
rows = db.execute(query).fetchall()
print(f"Python: {len(rows)} rows, first={rows[0]}")

# To numpy
arr = db.execute("SELECT close FROM eurostoxx50_ohlcv WHERE symbol = 'ASML.AS' LIMIT 5").fetchnumpy()
print(f"NumPy:  {arr['close']}")
```

    Pandas: DataFrame, shape=(5, 3)
    Polars: DataFrame, shape=(5, 3)
    Arrow:  Table, rows=5
    Python: 5 rows, first=('ASML.AS', datetime.date(2021, 1, 4), 406.25)
    NumPy:  [406.25 406.9  402.85 403.9  416.05]

### Persistent Database (on disk)

```python
# Create a persistent DuckDB file
db_path = TMP / "stoxx.duckdb"
pdb = duckdb.connect(str(db_path))

# Create tables from Parquet
pdb.execute("CREATE OR REPLACE TABLE ohlcv AS SELECT * FROM read_parquet('../data/eurostoxx50_ohlcv.parquet')")
pdb.execute("CREATE OR REPLACE TABLE dim AS SELECT * FROM read_parquet('../data/index_dim.parquet')")
print(f"Database file: {db_path.stat().st_size:,} bytes")

# Close and reopen — data persists
pdb.close()
pdb = duckdb.connect(str(db_path))
row_count = pdb.execute("SELECT COUNT(*) FROM ohlcv").fetchone()
if row_count:
    print(f"After reopen: {row_count[0]:,} rows")
pdb.close()
```

    Database file: 12,288 bytes
    After reopen: 66,355 rows

### Views & Macros

```python
# Create a view (virtual table — query runs on access)
db.execute("""
    CREATE OR REPLACE VIEW v_stock_summary AS
    SELECT o.symbol, d.short_name, d.sector, d.country,
           COUNT(*) as days,
           ROUND(AVG(o.close), 2) as avg_close,
           ROUND(STDDEV(o.close), 2) as std_close
    FROM eurostoxx50_ohlcv o
    JOIN index_dim d USING (symbol)
    GROUP BY o.symbol, d.short_name, d.sector, d.country
""")
display(db.execute("SELECT * FROM v_stock_summary ORDER BY avg_close DESC LIMIT 5").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>short_name</th>
      <th>sector</th>
      <th>country</th>
      <th>days</th>
      <th>avg_close</th>
      <th>std_close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>RMS.PA</td>
      <td>HERMES INTL</td>
      <td>Consumer Cyclical</td>
      <td>France</td>
      <td>1331</td>
      <td>1761.56</td>
      <td>481.32</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ADYEN.AS</td>
      <td>ADYEN</td>
      <td>Technology</td>
      <td>Netherlands</td>
      <td>1331</td>
      <td>1545.98</td>
      <td>417.81</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>ASML HOLDING</td>
      <td>Technology</td>
      <td>Netherlands</td>
      <td>1331</td>
      <td>671.35</td>
      <td>162.75</td>
    </tr>
    <tr>
      <th>3</th>
      <td>MC.PA</td>
      <td>LVMH</td>
      <td>Consumer Cyclical</td>
      <td>France</td>
      <td>1331</td>
      <td>662.40</td>
      <td>103.50</td>
    </tr>
    <tr>
      <th>4</th>
      <td>RHM.DE</td>
      <td>RHEINMETALL AG</td>
      <td>Industrials</td>
      <td>Germany</td>
      <td>1324</td>
      <td>544.66</td>
      <td>586.08</td>
    </tr>
  </tbody>
</table>

```python
# Create a SQL macro (reusable function)
db.execute("""
    CREATE OR REPLACE MACRO sma(col, n) AS (
        AVG(col) OVER (ORDER BY date ROWS BETWEEN (n-1) PRECEDING AND CURRENT ROW)
    )
""")

# Use the macro
display(db.execute("""
    SELECT date, close,
           ROUND(sma(close, 7), 2) as sma_7,
           ROUND(sma(close, 30), 2) as sma_30
    FROM eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS'
    ORDER BY date DESC
    LIMIT 10
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>date</th>
      <th>close</th>
      <th>sma_7</th>
      <th>sma_30</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>1181.43</td>
      <td>1204.41</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>1177.29</td>
      <td>1204.45</td>
    </tr>
    <tr>
      <th>2</th>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>1178.94</td>
      <td>1204.31</td>
    </tr>
    <tr>
      <th>3</th>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>1183.71</td>
      <td>1204.89</td>
    </tr>
    <tr>
      <th>4</th>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>1195.83</td>
      <td>1205.91</td>
    </tr>
    <tr>
      <th>5</th>
      <td>2026-03-05</td>
      <td>1186.0</td>
      <td>1216.03</td>
      <td>1206.95</td>
    </tr>
    <tr>
      <th>6</th>
      <td>2026-03-04</td>
      <td>1199.8</td>
      <td>1227.09</td>
      <td>1206.63</td>
    </tr>
    <tr>
      <th>7</th>
      <td>2026-03-03</td>
      <td>1161.8</td>
      <td>1234.14</td>
      <td>1205.13</td>
    </tr>
    <tr>
      <th>8</th>
      <td>2026-03-02</td>
      <td>1210.4</td>
      <td>1247.54</td>
      <td>1204.40</td>
    </tr>
    <tr>
      <th>9</th>
      <td>2026-02-27</td>
      <td>1233.4</td>
      <td>1251.51</td>
      <td>1201.40</td>
    </tr>
  </tbody>
</table>

### JSON Functions

```python
# DuckDB has full JSON support
display(db.execute("""
    SELECT
        json_object('symbol', symbol, 'close', close, 'date', date) as json_row,
        json_extract(json_object('symbol', symbol, 'close', close), '$.symbol') as extracted
    FROM eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS'
    ORDER BY date DESC
    LIMIT 5
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>json_row</th>
      <th>extracted</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>{"symbol":"ASML.AS","close":1190.8,"date":"2026-03-12"}</td>
      <td>"ASML.AS"</td>
    </tr>
    <tr>
      <th>1</th>
      <td>{"symbol":"ASML.AS","close":1198.8,"date":"2026-03-11"}</td>
      <td>"ASML.AS"</td>
    </tr>
    <tr>
      <th>2</th>
      <td>{"symbol":"ASML.AS","close":1200.0,"date":"2026-03-10"}</td>
      <td>"ASML.AS"</td>
    </tr>
    <tr>
      <th>3</th>
      <td>{"symbol":"ASML.AS","close":1147.6,"date":"2026-03-09"}</td>
      <td>"ASML.AS"</td>
    </tr>
    <tr>
      <th>4</th>
      <td>{"symbol":"ASML.AS","close":1147.0,"date":"2026-03-06"}</td>
      <td>"ASML.AS"</td>
    </tr>
  </tbody>
</table>

### String & Date Functions

```python
display(db.execute("""
    SELECT
        symbol,
        SPLIT_PART(symbol, '.', 1) as ticker,
        SPLIT_PART(symbol, '.', 2) as exchange,
        LENGTH(symbol) as sym_len,
        UPPER(short_name) as upper_name,
        LEFT(short_name, 10) as short
    FROM index_dim
    LIMIT 10
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>ticker</th>
      <th>exchange</th>
      <th>sym_len</th>
      <th>upper_name</th>
      <th>short</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>ASML</td>
      <td>AS</td>
      <td>7</td>
      <td>ASML HOLDING</td>
      <td>ASML HOLDI</td>
    </tr>
    <tr>
      <th>1</th>
      <td>MC.PA</td>
      <td>MC</td>
      <td>PA</td>
      <td>5</td>
      <td>LVMH</td>
      <td>LVMH</td>
    </tr>
    <tr>
      <th>2</th>
      <td>RMS.PA</td>
      <td>RMS</td>
      <td>PA</td>
      <td>6</td>
      <td>HERMES INTL</td>
      <td>HERMES INT</td>
    </tr>
    <tr>
      <th>3</th>
      <td>OR.PA</td>
      <td>OR</td>
      <td>PA</td>
      <td>5</td>
      <td>L'OREAL</td>
      <td>L'OREAL</td>
    </tr>
    <tr>
      <th>4</th>
      <td>SAP.DE</td>
      <td>SAP</td>
      <td>DE</td>
      <td>6</td>
      <td>SAP SE</td>
      <td>SAP SE</td>
    </tr>
    <tr>
      <th>5</th>
      <td>SIE.DE</td>
      <td>SIE</td>
      <td>DE</td>
      <td>6</td>
      <td>SIEMENS AG</td>
      <td>SIEMENS AG</td>
    </tr>
    <tr>
      <th>6</th>
      <td>ITX.MC</td>
      <td>ITX</td>
      <td>MC</td>
      <td>6</td>
      <td>INDUSTRIA DE DISE...O TEXTIL S.</td>
      <td>INDUSTRIA</td>
    </tr>
    <tr>
      <th>7</th>
      <td>DTE.DE</td>
      <td>DTE</td>
      <td>DE</td>
      <td>6</td>
      <td>DEUTSCHE TELEKOM AG</td>
      <td>DEUTSCHE T</td>
    </tr>
    <tr>
      <th>8</th>
      <td>SAN.MC</td>
      <td>SAN</td>
      <td>MC</td>
      <td>6</td>
      <td>BANCO SANTANDER S.A.</td>
      <td>BANCO SANT</td>
    </tr>
    <tr>
      <th>9</th>
      <td>SU.PA</td>
      <td>SU</td>
      <td>PA</td>
      <td>5</td>
      <td>SCHNEIDER ELECTRIC SE</td>
      <td>SCHNEIDER</td>
    </tr>
  </tbody>
</table>

```python
display(db.execute("""
    SELECT
        date,
        YEAR(date) as yr,
        MONTH(date) as mo,
        DAYNAME(date) as day_name,
        WEEKOFYEAR(date) as week,
        date - INTERVAL 7 DAY as week_ago,
        DATEDIFF('day', MIN(date) OVER (), date) as days_since_start
    FROM eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS'
    ORDER BY date DESC
    LIMIT 10
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>date</th>
      <th>yr</th>
      <th>mo</th>
      <th>day_name</th>
      <th>week</th>
      <th>week_ago</th>
      <th>days_since_start</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>2026-03-12</td>
      <td>2026</td>
      <td>3</td>
      <td>Thursday</td>
      <td>11</td>
      <td>2026-03-05</td>
      <td>1893</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2026-03-11</td>
      <td>2026</td>
      <td>3</td>
      <td>Wednesday</td>
      <td>11</td>
      <td>2026-03-04</td>
      <td>1892</td>
    </tr>
    <tr>
      <th>2</th>
      <td>2026-03-10</td>
      <td>2026</td>
      <td>3</td>
      <td>Tuesday</td>
      <td>11</td>
      <td>2026-03-03</td>
      <td>1891</td>
    </tr>
    <tr>
      <th>3</th>
      <td>2026-03-09</td>
      <td>2026</td>
      <td>3</td>
      <td>Monday</td>
      <td>11</td>
      <td>2026-03-02</td>
      <td>1890</td>
    </tr>
    <tr>
      <th>4</th>
      <td>2026-03-06</td>
      <td>2026</td>
      <td>3</td>
      <td>Friday</td>
      <td>10</td>
      <td>2026-02-27</td>
      <td>1887</td>
    </tr>
    <tr>
      <th>5</th>
      <td>2026-03-05</td>
      <td>2026</td>
      <td>3</td>
      <td>Thursday</td>
      <td>10</td>
      <td>2026-02-26</td>
      <td>1886</td>
    </tr>
    <tr>
      <th>6</th>
      <td>2026-03-04</td>
      <td>2026</td>
      <td>3</td>
      <td>Wednesday</td>
      <td>10</td>
      <td>2026-02-25</td>
      <td>1885</td>
    </tr>
    <tr>
      <th>7</th>
      <td>2026-03-03</td>
      <td>2026</td>
      <td>3</td>
      <td>Tuesday</td>
      <td>10</td>
      <td>2026-02-24</td>
      <td>1884</td>
    </tr>
    <tr>
      <th>8</th>
      <td>2026-03-02</td>
      <td>2026</td>
      <td>3</td>
      <td>Monday</td>
      <td>10</td>
      <td>2026-02-23</td>
      <td>1883</td>
    </tr>
    <tr>
      <th>9</th>
      <td>2026-02-27</td>
      <td>2026</td>
      <td>2</td>
      <td>Friday</td>
      <td>9</td>
      <td>2026-02-20</td>
      <td>1880</td>
    </tr>
  </tbody>
</table>

### PIVOT & UNPIVOT

```python
# PIVOT: rows to columns
display(db.execute("""
    PIVOT (
        SELECT d.sector, YEAR(o.date) as yr, ROUND(AVG(o.close), 2) as avg_close
        FROM eurostoxx50_ohlcv o
        JOIN index_dim d USING (symbol)
        GROUP BY d.sector, YEAR(o.date)
    )
    ON yr
    USING AVG(avg_close)
    ORDER BY sector
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>sector</th>
      <th>2021</th>
      <th>2022</th>
      <th>2023</th>
      <th>2024</th>
      <th>2025</th>
      <th>2026</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Basic Materials</td>
      <td>92.40</td>
      <td>86.26</td>
      <td>95.60</td>
      <td>105.90</td>
      <td>109.07</td>
      <td>105.97</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Communication Services</td>
      <td>16.67</td>
      <td>18.06</td>
      <td>20.68</td>
      <td>24.50</td>
      <td>30.82</td>
      <td>30.17</td>
    </tr>
    <tr>
      <th>2</th>
      <td>Consumer Cyclical</td>
      <td>308.44</td>
      <td>296.79</td>
      <td>383.32</td>
      <td>423.22</td>
      <td>424.14</td>
      <td>382.46</td>
    </tr>
    <tr>
      <th>3</th>
      <td>Consumer Defensive</td>
      <td>125.78</td>
      <td>119.62</td>
      <td>135.95</td>
      <td>137.95</td>
      <td>132.23</td>
      <td>138.42</td>
    </tr>
    <tr>
      <th>4</th>
      <td>Energy</td>
      <td>25.07</td>
      <td>31.99</td>
      <td>36.07</td>
      <td>37.97</td>
      <td>34.42</td>
      <td>40.00</td>
    </tr>
    <tr>
      <th>5</th>
      <td>Financial Services</td>
      <td>64.25</td>
      <td>66.01</td>
      <td>79.92</td>
      <td>99.19</td>
      <td>125.30</td>
      <td>127.33</td>
    </tr>
    <tr>
      <th>6</th>
      <td>Healthcare</td>
      <td>136.39</td>
      <td>157.01</td>
      <td>177.90</td>
      <td>189.54</td>
      <td>247.28</td>
      <td>265.22</td>
    </tr>
    <tr>
      <th>7</th>
      <td>Industrials</td>
      <td>89.13</td>
      <td>92.61</td>
      <td>116.08</td>
      <td>163.54</td>
      <td>286.22</td>
      <td>321.53</td>
    </tr>
    <tr>
      <th>8</th>
      <td>Technology</td>
      <td>599.48</td>
      <td>452.04</td>
      <td>408.80</td>
      <td>473.39</td>
      <td>506.48</td>
      <td>517.70</td>
    </tr>
    <tr>
      <th>9</th>
      <td>Utilities</td>
      <td>9.17</td>
      <td>7.89</td>
      <td>8.54</td>
      <td>9.44</td>
      <td>11.79</td>
      <td>14.28</td>
    </tr>
  </tbody>
</table>

### Parameterized Queries

```python
# Positional parameters with $1, $2...
result = db.execute(
    "SELECT * FROM eurostoxx50_ohlcv WHERE symbol = $1 AND close > $2 ORDER BY date DESC LIMIT 5",
    ["ASML.AS", 700.0]
).df()
display(result)

# Named parameters (DuckDB 0.9+)
result = db.execute(
    "SELECT * FROM eurostoxx50_ohlcv WHERE symbol = $sym ORDER BY date DESC LIMIT $n",
    {"sym": "SAP.DE", "n": 5}
).df()
display(result)
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
      <td>66881</td>
      <td>ASML.AS</td>
      <td>2026-03-12</td>
      <td>1194.8</td>
      <td>1202.2</td>
      <td>1187.8</td>
      <td>1190.8</td>
      <td>1190.8</td>
      <td>128223</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>1</th>
      <td>66733</td>
      <td>ASML.AS</td>
      <td>2026-03-11</td>
      <td>1188.4</td>
      <td>1210.8</td>
      <td>1174.0</td>
      <td>1198.8</td>
      <td>1198.8</td>
      <td>562904</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>2</th>
      <td>66732</td>
      <td>ASML.AS</td>
      <td>2026-03-10</td>
      <td>1188.4</td>
      <td>1208.4</td>
      <td>1172.2</td>
      <td>1200.0</td>
      <td>1200.0</td>
      <td>800815</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>3</th>
      <td>66731</td>
      <td>ASML.AS</td>
      <td>2026-03-09</td>
      <td>1072.0</td>
      <td>1147.6</td>
      <td>1060.2</td>
      <td>1147.6</td>
      <td>1147.6</td>
      <td>689086</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>4</th>
      <td>64732</td>
      <td>ASML.AS</td>
      <td>2026-03-06</td>
      <td>1186.0</td>
      <td>1192.6</td>
      <td>1112.8</td>
      <td>1147.0</td>
      <td>1147.0</td>
      <td>857271</td>
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
      <td>66885</td>
      <td>SAP.DE</td>
      <td>2026-03-12</td>
      <td>163.00</td>
      <td>166.74</td>
      <td>162.80</td>
      <td>166.52</td>
      <td>166.52</td>
      <td>806722</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>1</th>
      <td>66745</td>
      <td>SAP.DE</td>
      <td>2026-03-11</td>
      <td>167.10</td>
      <td>168.96</td>
      <td>163.02</td>
      <td>165.44</td>
      <td>165.44</td>
      <td>2953782</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>2</th>
      <td>66744</td>
      <td>SAP.DE</td>
      <td>2026-03-10</td>
      <td>171.60</td>
      <td>172.88</td>
      <td>166.46</td>
      <td>169.60</td>
      <td>169.60</td>
      <td>3187246</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>3</th>
      <td>66743</td>
      <td>SAP.DE</td>
      <td>2026-03-09</td>
      <td>173.72</td>
      <td>173.86</td>
      <td>168.52</td>
      <td>171.88</td>
      <td>171.88</td>
      <td>1990823</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>4</th>
      <td>64740</td>
      <td>SAP.DE</td>
      <td>2026-03-06</td>
      <td>173.66</td>
      <td>175.10</td>
      <td>170.24</td>
      <td>172.74</td>
      <td>172.74</td>
      <td>3347221</td>
      <td>0.0</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
  </tbody>
</table>

### Transactions & DDL

```python
# Create, insert, update, delete
db.execute("CREATE OR REPLACE TABLE _test (id INTEGER, name VARCHAR, score DOUBLE)")
db.execute("INSERT INTO _test VALUES (1, 'alpha', 0.9), (2, 'beta', 0.7), (3, 'gamma', 0.5)")
display(db.execute("SELECT * FROM _test").df())

# Update
db.execute("UPDATE _test SET score = 0.95 WHERE name = 'alpha'")

# Delete
db.execute("DELETE FROM _test WHERE name = 'gamma'")
display(db.execute("SELECT * FROM _test").df())

# Transaction
db.execute("BEGIN TRANSACTION")
db.execute("INSERT INTO _test VALUES (4, 'delta', 0.8)")
db.execute("ROLLBACK")  # undo
row = db.execute("SELECT COUNT(*) FROM _test").fetchone()
if row:
    print(f"After rollback: {row[0]} rows")

db.execute("DROP TABLE _test")
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>id</th>
      <th>name</th>
      <th>score</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>1</td>
      <td>alpha</td>
      <td>0.9</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2</td>
      <td>beta</td>
      <td>0.7</td>
    </tr>
    <tr>
      <th>2</th>
      <td>3</td>
      <td>gamma</td>
      <td>0.5</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>id</th>
      <th>name</th>
      <th>score</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>1</td>
      <td>alpha</td>
      <td>0.95</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2</td>
      <td>beta</td>
      <td>0.70</td>
    </tr>
  </tbody>
</table>

    After rollback: 2 rows

    <_duckdb.DuckDBPyConnection at 0x1e428aaf430>

### Performance: DuckDB vs Pandas vs Polars

```python
# Complex analytical query
query_sql = """
    SELECT symbol, sector,
           AVG(close) as avg_close,
           STDDEV(close) as std_close,
           COUNT(*) as days
    FROM eurostoxx50_ohlcv o
    JOIN index_dim d USING (symbol)
    GROUP BY symbol, sector
    ORDER BY avg_close DESC
"""

# DuckDB
t0 = time.perf_counter()
df_duck = db.execute(query_sql).df()
t_duck = time.perf_counter() - t0

# Pandas equivalent
t0 = time.perf_counter()
df_pandas = (ohlcv_pd.merge(dim_pd[["symbol", "sector"]], on="symbol")
             .groupby(["symbol", "sector"])["close"]
             .agg(["mean", "std", "count"])
             .reset_index()
             .sort_values("mean", ascending=False))
t_pandas = time.perf_counter() - t0

# Polars equivalent
t0 = time.perf_counter()
df_polars = (ohlcv_pl.join(dim_pl.select("symbol", "sector"), on="symbol")
             .group_by("symbol", "sector")
             .agg(pl.col("close").mean().alias("avg_close"),
                  pl.col("close").std().alias("std_close"),
                  pl.col("close").count().alias("days"))
             .sort("avg_close", descending=True))
t_polars = time.perf_counter() - t0

print(f"DuckDB:  {t_duck:.3f}s")
print(f"Pandas:  {t_pandas:.3f}s")
print(f"Polars:  {t_polars:.3f}s")
```

    DuckDB:  0.007s
    Pandas:  0.011s
    Polars:  0.003s

### Schema Inspection

```python
# List tables
display(db.execute("SHOW TABLES").df())

# Describe a table
display(db.execute("DESCRIBE eurostoxx50_ohlcv").df())

# Table sizes
display(db.execute("""
    SELECT table_name, estimated_size, column_count
    FROM duckdb_tables()
    ORDER BY estimated_size DESC
""").df())
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>name</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>eurostoxx50_ohlcv</td>
    </tr>
    <tr>
      <th>1</th>
      <td>index_dim</td>
    </tr>
    <tr>
      <th>2</th>
      <td>scores_daily</td>
    </tr>
    <tr>
      <th>3</th>
      <td>v_stock_summary</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>column_name</th>
      <th>column_type</th>
      <th>null</th>
      <th>key</th>
      <th>default</th>
      <th>extra</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>id</td>
      <td>BIGINT</td>
      <td>YES</td>
      <td>None</td>
      <td>None</td>
      <td>None</td>
    </tr>
    <tr>
      <th>1</th>
      <td>symbol</td>
      <td>VARCHAR</td>
      <td>YES</td>
      <td>None</td>
      <td>None</td>
      <td>None</td>
    </tr>
    <tr>
      <th>2</th>
      <td>date</td>
      <td>DATE</td>
      <td>YES</td>
      <td>None</td>
      <td>None</td>
      <td>None</td>
    </tr>
    <tr>
      <th>3</th>
      <td>open</td>
      <td>DOUBLE</td>
      <td>YES</td>
      <td>None</td>
      <td>None</td>
      <td>None</td>
    </tr>
    <tr>
      <th>4</th>
      <td>high</td>
      <td>DOUBLE</td>
      <td>YES</td>
      <td>None</td>
      <td>None</td>
      <td>None</td>
    </tr>
    <tr>
      <th>5</th>
      <td>low</td>
      <td>DOUBLE</td>
      <td>YES</td>
      <td>None</td>
      <td>None</td>
      <td>None</td>
    </tr>
    <tr>
      <th>6</th>
      <td>close</td>
      <td>DOUBLE</td>
      <td>YES</td>
      <td>None</td>
      <td>None</td>
      <td>None</td>
    </tr>
    <tr>
      <th>7</th>
      <td>adj_close</td>
      <td>DOUBLE</td>
      <td>YES</td>
      <td>None</td>
      <td>None</td>
      <td>None</td>
    </tr>
    <tr>
      <th>8</th>
      <td>volume</td>
      <td>BIGINT</td>
      <td>YES</td>
      <td>None</td>
      <td>None</td>
      <td>None</td>
    </tr>
    <tr>
      <th>9</th>
      <td>dividends</td>
      <td>DOUBLE</td>
      <td>YES</td>
      <td>None</td>
      <td>None</td>
      <td>None</td>
    </tr>
    <tr>
      <th>10</th>
      <td>stock_splits</td>
      <td>DOUBLE</td>
      <td>YES</td>
      <td>None</td>
      <td>None</td>
      <td>None</td>
    </tr>
    <tr>
      <th>11</th>
      <td>is_filled</td>
      <td>BOOLEAN</td>
      <td>YES</td>
      <td>None</td>
      <td>None</td>
      <td>None</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th></th>
      <th>table_name</th>
      <th>estimated_size</th>
      <th>column_count</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>eurostoxx50_ohlcv</td>
      <td>66355</td>
      <td>12</td>
    </tr>
    <tr>
      <th>1</th>
      <td>scores_daily</td>
      <td>466</td>
      <td>36</td>
    </tr>
    <tr>
      <th>2</th>
      <td>index_dim</td>
      <td>169</td>
      <td>26</td>
    </tr>
  </tbody>
</table>

```python
# Cleanup temp files
shutil.rmtree(TMP, ignore_errors=True)
db.execute("DROP VIEW IF EXISTS v_stock_summary")
db.execute("DROP MACRO IF EXISTS sma")
print("DuckDB cleanup done")
```

    DuckDB cleanup done

### DuckDB Summary

| Feature | DuckDB |
|---|---|
| Setup | `duckdb.connect()` (in-memory) or `duckdb.connect('file.duckdb')` |
| Query DataFrames | `db.execute('SELECT * FROM df_variable')` — zero-copy |
| Read Parquet/CSV | `read_parquet('path')`, `read_csv_auto('path')` — no import step |
| Glob files | `read_parquet('data/*.parquet')` |
| Window functions | Full support: `RANK`, `LAG`, `ROWS BETWEEN`, `QUALIFY` |
| CTEs | `WITH ... AS`, recursive CTEs |
| PIVOT/UNPIVOT | Native `PIVOT` syntax |
| Views | `CREATE VIEW` |
| Macros | `CREATE MACRO name(args) AS (expr)` |
| JSON | `json_object()`, `json_extract()` |
| Parameters | `$1` positional, `$name` named |
| Export | `COPY ... TO 'file' (FORMAT PARQUET/CSV/JSON)` |
| Result to Pandas | `.df()` |
| Result to Polars | `.pl()` |
| Result to Arrow | `.arrow()` |
| Persistent storage | `duckdb.connect('file.duckdb')` |
| vs Pandas | Often 2–10x faster for analytical queries |
| vs Polars | Comparable speed; DuckDB wins on complex SQL, Polars on expression API |

## Part 1 Summary

| Feature | Polars SQL | DuckDB |
|---|---|---|
| Setup | pl.SQLContext() | duckdb.connect() |
| Input | Polars DataFrames | Pandas/Polars/Arrow |
| Output | LazyFrame | Pandas DataFrame |
| SQL dialect | Standard SQL | PostgreSQL-like |

---
# Part 2: SQL Server Integration

Connect Pandas and Polars directly to SQL Server tables for reading, writing, and querying.

## Connection Setup

> [!danger] Never hardcode credentials in connection strings
>
> Use environment variables (`os.environ.get()`) or a secret manager. The `.env` file
> should be in `.gitignore` and never committed. See [[environment-variables]] for secure
> credential handling patterns.

> [!warning] TrustServerCertificate=yes disables certificate validation
>
> Acceptable for local development. In production, use a valid TLS certificate and
> remove this flag — otherwise connections are vulnerable to man-in-the-middle attacks.

```python
load_dotenv(dotenv_path="../.env")

# Connection parameters
SERVER = "localhost,1434"
DATABASE = "stoxx"
USER = "sa"
PASSWORD = os.environ.get("STOXX_SA_PASSWORD", "")  # set via: $env:STOXX_SA_PASSWORD="..."

# pyodbc connection string
PYODBC_CONN = (
    f"DRIVER={{ODBC Driver 18 for SQL Server}};"
    f"SERVER={SERVER};"
    f"DATABASE={DATABASE};"
    f"UID={USER};"
    f"PWD={PASSWORD};"
    f"Encrypt=yes;TrustServerCertificate=yes;"
)

# SQLAlchemy engine (used by Pandas)
ENGINE = sa.create_engine(
    f"mssql+pyodbc:///?odbc_connect={quote_plus(PYODBC_CONN)}"
)


# Test connection
with pyodbc.connect(PYODBC_CONN) as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT @@VERSION")
    version = cursor.fetchone()
    if version:
        print(version[0][:80])
print("Connection OK")
```

    Microsoft SQL Server 2022 (RTM-CU23) (KB5078297) - 16.0.4236.2 (X64) 
    	Jan 22 20
    Connection OK

## Reading Tables

> [!danger] pd.read_sql() loads the entire result
>
> `pd.read_sql()` loads the entire result set into memory
> `SELECT * FROM table` on a 10M row table allocates the full DataFrame in RAM. For large
> tables, use `chunksize=` to iterate in batches, or add a `WHERE` clause to limit rows.
> Polars `pl.read_database()` has the same issue — neither library supports server-side
> cursors by default.

> [!warning] SQL injection risk with string
>
> SQL injection risk with string formatting in queries
> Never use f-strings for user input: `f"WHERE symbol = '{user_input}'"` is injectable.
> Use parameterized queries: `pd.read_sql("SELECT * FROM t WHERE symbol = ?", engine,
> params=["ASML"])`.

### Pandas — pd.read_sql()

```python
# Read entire table
df = pd.read_sql("SELECT TOP 5 * FROM bronze.eurostoxx50_ohlcv", ENGINE)
display(df)
print(f"dtypes:\n{df.dtypes}")
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>id</th>
      <th>_ingested_at</th>
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
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>66728</td>
      <td>2026-03-12 12:45:00.017366</td>
      <td>ASML.AS</td>
      <td>2026-03-12</td>
      <td>1194.8</td>
      <td>1202.20</td>
      <td>1187.8</td>
      <td>1190.80</td>
      <td>1190.80</td>
      <td>128223</td>
      <td>0.0</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>1</th>
      <td>66732</td>
      <td>2026-03-12 12:45:00.017366</td>
      <td>MC.PA</td>
      <td>2026-03-12</td>
      <td>495.3</td>
      <td>497.40</td>
      <td>491.6</td>
      <td>494.35</td>
      <td>494.35</td>
      <td>171997</td>
      <td>0.0</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>2</th>
      <td>66736</td>
      <td>2026-03-12 12:45:00.017366</td>
      <td>RMS.PA</td>
      <td>2026-03-12</td>
      <td>1900.0</td>
      <td>1918.50</td>
      <td>1894.0</td>
      <td>1906.00</td>
      <td>1906.00</td>
      <td>18681</td>
      <td>0.0</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>3</th>
      <td>66740</td>
      <td>2026-03-12 12:45:00.017366</td>
      <td>OR.PA</td>
      <td>2026-03-12</td>
      <td>361.1</td>
      <td>362.30</td>
      <td>357.8</td>
      <td>360.80</td>
      <td>360.80</td>
      <td>82621</td>
      <td>0.0</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>4</th>
      <td>66744</td>
      <td>2026-03-12 12:45:00.017366</td>
      <td>SAP.DE</td>
      <td>2026-03-12</td>
      <td>163.0</td>
      <td>166.74</td>
      <td>162.8</td>
      <td>166.52</td>
      <td>166.52</td>
      <td>806722</td>
      <td>0.0</td>
      <td>0.0</td>
    </tr>
  </tbody>
</table>

    dtypes:
    id                       int64
    _ingested_at    datetime64[ns]
    symbol                  object
    date                    object
    open                   float64
    high                   float64
    low                    float64
    close                  float64
    adj_close              float64
    volume                   int64
    dividends              float64
    stock_splits           float64
    dtype: object

```python
# Parameterized query
symbol = "ASML.AS"
df = pd.read_sql(
    sa.text("SELECT [date], [close], volume FROM bronze.eurostoxx50_ohlcv WHERE symbol = :sym ORDER BY [date] DESC"),
    ENGINE,
    params={"sym": symbol}
)
display(df.head(10))
print(f"Shape: {df.shape}")
```

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
      <th>0</th>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>128223</td>
    </tr>
  </tbody>
</table>

    Shape: (1, 3)

```python
# Read entire table (shorthand)
df = pd.read_sql_table("index_dim", ENGINE, schema="bronze")
print(f"Columns: \n{list(df.columns)}")
print(f"\nShape: \n{df.shape}")
```

    Columns: 
    ['id', '_index', '_ingested_at', 'symbol', 'long_name', 'short_name', 'sector', 'sector_key', 'industry', 'industry_key', 'country', 'city', 'website', 'long_business_summary', 'exchange', 'full_exchange_name', 'exchange_timezone_name', 'exchange_timezone_short', 'currency', 'financial_currency', 'quote_type', 'market', 'range_start', 'price_data_start']
    
    Shape: 
    (169, 24)

### Polars — pl.read_database()

```python
# Polars with SQLAlchemy engine
df = pl.read_database("SELECT TOP 5 * FROM bronze.eurostoxx50_ohlcv", connection=ENGINE)
display(df)
print(f"Schema: {df.schema}")
```

<div><!-- shape: (5, 12) --><table><thead><tr><th>id</th><th>_ingested_at</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th></tr><tr><td>i64</td><td>datetime[μs]</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>66728</td><td>2026-03-12 12:45:00.017366</td><td>ASML.AS</td><td>2026-03-12</td><td>1194.8</td><td>1202.2</td><td>1187.8</td><td>1190.8</td><td>1190.8</td><td>128223</td><td>0.0</td><td>0.0</td></tr><tr><td>66732</td><td>2026-03-12 12:45:00.017366</td><td>MC.PA</td><td>2026-03-12</td><td>495.3</td><td>497.4</td><td>491.6</td><td>494.35</td><td>494.35</td><td>171997</td><td>0.0</td><td>0.0</td></tr><tr><td>66736</td><td>2026-03-12 12:45:00.017366</td><td>RMS.PA</td><td>2026-03-12</td><td>1900.0</td><td>1918.5</td><td>1894.0</td><td>1906.0</td><td>1906.0</td><td>18681</td><td>0.0</td><td>0.0</td></tr><tr><td>66740</td><td>2026-03-12 12:45:00.017366</td><td>OR.PA</td><td>2026-03-12</td><td>361.1</td><td>362.3</td><td>357.8</td><td>360.8</td><td>360.8</td><td>82621</td><td>0.0</td><td>0.0</td></tr><tr><td>66744</td><td>2026-03-12 12:45:00.017366</td><td>SAP.DE</td><td>2026-03-12</td><td>163.0</td><td>166.74</td><td>162.8</td><td>166.52</td><td>166.52</td><td>806722</td><td>0.0</td><td>0.0</td></tr></tbody></table></div>

    Schema: Schema({'id': Int64, '_ingested_at': Datetime(time_unit='us', time_zone=None), 'symbol': String, 'date': Date, 'open': Float64, 'high': Float64, 'low': Float64, 'close': Float64, 'adj_close': Float64, 'volume': Int64, 'dividends': Float64, 'stock_splits': Float64})

```python
# Filtered query
df = pl.read_database(
    "SELECT [date], symbol, [close], volume FROM bronze.eurostoxx50_ohlcv WHERE symbol = 'ASML.AS' ORDER BY [date] DESC",
    connection=ENGINE
)
display(df.head(10))
print(f"Shape: {df.shape}")
```

<div><!-- shape: (1, 4) --><table><thead><tr><th>date</th><th>symbol</th><th>close</th><th>volume</th></tr><tr><td>date</td><td>str</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>2026-03-12</td><td>ASML.AS</td><td>1190.8</td><td>128223</td></tr></tbody></table></div>

    Shape: (1, 4)

```python
# Polars with SQLAlchemy engine
df = pl.read_database("SELECT TOP 5 * FROM bronze.index_dim", connection=ENGINE)
display(df)
```

<div><!-- shape: (5, 24) --><table><thead><tr><th>id</th><th>_index</th><th>_ingested_at</th><th>symbol</th><th>long_name</th><th>short_name</th><th>sector</th><th>sector_key</th><th>industry</th><th>industry_key</th><th>country</th><th>city</th><th>website</th><th>long_business_summary</th><th>exchange</th><th>full_exchange_name</th><th>exchange_timezone_name</th><th>exchange_timezone_short</th><th>currency</th><th>financial_currency</th><th>quote_type</th><th>market</th><th>range_start</th><th>price_data_start</th></tr><tr><td>i64</td><td>str</td><td>datetime[μs]</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>str</td><td>date</td><td>date</td></tr></thead><tbody><tr><td>198</td><td>stoxx_asia_50</td><td>2026-03-04 22:21:55.384964</td><td>7203.T</td><td>Toyota Motor Corporation</td><td>TOYOTA MOTOR CORP</td><td>Consumer Cyclical</td><td>consumer-cyclical</td><td>Auto Manufacturers</td><td>auto-manufacturers</td><td>Japan</td><td>Toyota</td><td>https://global.toyota/en</td><td>Toyota Motor Corporation desig…</td><td>JPX</td><td>Tokyo</td><td>Asia/Tokyo</td><td>JST</td><td>JPY</td><td>JPY</td><td>EQUITY</td><td>jp_market</td><td>1999-05-06</td><td>2021-01-01</td></tr><tr><td>199</td><td>stoxx_asia_50</td><td>2026-03-04 22:21:55.384964</td><td>BHP.AX</td><td>BHP Group Limited</td><td>BHP GROUP FPO [BHP]</td><td>Basic Materials</td><td>basic-materials</td><td>Other Industrial Metals &amp; Mini…</td><td>other-industrial-metals-mining</td><td>Australia</td><td>Melbourne</td><td>https://www.bhp.com</td><td>BHP Group Limited operates as …</td><td>ASX</td><td>ASX</td><td>Australia/Sydney</td><td>AEDT</td><td>AUD</td><td>USD</td><td>EQUITY</td><td>au_market</td><td>1988-01-28</td><td>2021-01-01</td></tr><tr><td>200</td><td>stoxx_asia_50</td><td>2026-03-04 22:21:55.384964</td><td>6758.T</td><td>Sony Group Corporation</td><td>SONY GROUP CORPORATION</td><td>Technology</td><td>technology</td><td>Consumer Electronics</td><td>consumer-electronics</td><td>Japan</td><td>Tokyo</td><td>https://www.sony.com</td><td>Sony Group Corporation designs…</td><td>JPX</td><td>Tokyo</td><td>Asia/Tokyo</td><td>JST</td><td>JPY</td><td>JPY</td><td>EQUITY</td><td>jp_market</td><td>2000-01-04</td><td>2021-01-01</td></tr><tr><td>201</td><td>stoxx_asia_50</td><td>2026-03-04 22:21:55.384964</td><td>1299.HK</td><td>AIA Group Limited</td><td>AIA</td><td>Financial Services</td><td>financial-services</td><td>Insurance - Life</td><td>insurance-life</td><td>Hong Kong</td><td>Central</td><td>https://www.aia.com</td><td>AIA Group Limited, together wi…</td><td>HKG</td><td>HKSE</td><td>Asia/Hong_Kong</td><td>HKT</td><td>HKD</td><td>USD</td><td>EQUITY</td><td>hk_market</td><td>2010-10-29</td><td>2021-01-01</td></tr><tr><td>202</td><td>stoxx_asia_50</td><td>2026-03-04 22:21:55.384964</td><td>CBA.AX</td><td>Commonwealth Bank of Australia</td><td>CWLTH BANK FPO [CBA]</td><td>Financial Services</td><td>financial-services</td><td>Banks - Diversified</td><td>banks-diversified</td><td>Australia</td><td>Sydney</td><td>https://www.commbank.com.au</td><td>Commonwealth Bank of Australia…</td><td>ASX</td><td>ASX</td><td>Australia/Sydney</td><td>AEDT</td><td>AUD</td><td>AUD</td><td>EQUITY</td><td>au_market</td><td>1991-09-30</td><td>2021-01-01</td></tr></tbody></table></div>

## Chunked Reading (Large Tables)

### Pandas

```python
# Read in chunks for memory efficiency
total = 0
for chunk in pd.read_sql("SELECT * FROM bronze.eurostoxx50_ohlcv", ENGINE, chunksize=10_000):
    total += len(chunk)
print(f"Read {total:,} rows in chunks of 10,000")
```

    Read 50 rows in chunks of 10,000

### Polars

```python
# Polars reads the full result but ConnectorX streams internally
# For very large tables, use a WHERE clause or OFFSET/FETCH
df = pl.read_database(
    "SELECT * FROM bronze.eurostoxx50_ohlcv ORDER BY id OFFSET 0 ROWS FETCH NEXT 10000 ROWS ONLY",
    connection=ENGINE
)
print(f"First batch: {df.shape}")
```

    First batch: (50, 12)

## Writing to SQL Server

> [!warning] df.to_sql() is extremely slow by default
>
> `df.to_sql()` is extremely slow by default — ~100 rows/second
> Pandas inserts rows one at a time through SQLAlchemy. For bulk loading, use
> `method="multi"` (batches inserts) or `fast_executemany=True` on the engine:
> ```python
> engine = sa.create_engine(url, fast_executemany=True)
> df.to_sql("table", engine, if_exists="append", index=False, method="multi")
> ```
> For tables >100K rows, use `bcp` instead — it's 10-50x faster than any ORM approach.
> See [[data-transfer]] for bcp patterns.

> [!danger] if_exists="replace" drops the table
>
> This destroys indexes, constraints, permissions, and foreign keys. Use
> `if_exists="append"` with a preceding `DELETE` for controlled replacement, or use
> `MERGE`/upsert patterns from [[merge-and-upsert]].

### Pandas — df.to_sql()

```python
# Create a test DataFrame
test_df = pd.DataFrame({
    "symbol": ["TEST.XX", "TEST.YY"],
    "score": [0.42, 0.73],
    "date": pd.to_datetime(["2024-01-01", "2024-01-02"]),
})

# Write to SQL Server (replace if exists)
test_df.to_sql("_test_pandas", ENGINE, if_exists="replace", index=False)
print("Written to _test_pandas")

# Verify
display(pd.read_sql("SELECT * FROM dbo._test_pandas", ENGINE))
```

    Written to _test_pandas

<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>score</th>
      <th>date</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>TEST.XX</td>
      <td>0.42</td>
      <td>2024-01-01</td>
    </tr>
    <tr>
      <th>1</th>
      <td>TEST.YY</td>
      <td>0.73</td>
      <td>2024-01-02</td>
    </tr>
  </tbody>
</table>

```python
# Writing options
# if_exists: "fail" (default), "replace" (DROP+CREATE), "append" (INSERT INTO)
# dtype: explicit SQL types
# method: "multi" for faster bulk insert, or callable for custom

test_df.to_sql("_test_pandas_typed", ENGINE, if_exists="replace", index=False,
               dtype={  # type: ignore[arg-type]
                   "symbol": sa.types.NVARCHAR(20),
                   "score": sa.types.Float,
                   "date": sa.types.Date,
               })
print("Written with explicit types")

# Check the SQL types
with ENGINE.connect() as conn:
    result = conn.execute(sa.text(
        "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_NAME = '_test_pandas_typed' AND TABLE_SCHEMA = 'dbo'"
    ))
    for row in result:
        print(f"  {row[0]:15s}: {row[1]}")
```

    Written with explicit types
      symbol         : nvarchar
      score          : float
      date           : date

```python
# Append rows to existing table
new_rows = pd.DataFrame({
    "symbol": ["TEST.ZZ"],
    "score": [0.55],
    "date": pd.to_datetime(["2024-01-03"]),
})
new_rows.to_sql("_test_pandas", ENGINE, if_exists="append", index=False)
display(pd.read_sql("SELECT * FROM dbo._test_pandas", ENGINE))
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>score</th>
      <th>date</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>TEST.XX</td>
      <td>0.42</td>
      <td>2024-01-01</td>
    </tr>
    <tr>
      <th>1</th>
      <td>TEST.YY</td>
      <td>0.73</td>
      <td>2024-01-02</td>
    </tr>
    <tr>
      <th>2</th>
      <td>TEST.ZZ</td>
      <td>0.55</td>
      <td>2024-01-03</td>
    </tr>
    <tr>
      <th>3</th>
      <td>TEST.ZZ</td>
      <td>0.55</td>
      <td>2024-01-03</td>
    </tr>
  </tbody>
</table>

### Polars — write via Pandas or pyodbc

```python
# Polars doesn't have a native write_sql yet — convert to Pandas first
test_pl = pl.DataFrame({
    "symbol": ["PL_TEST.XX", "PL_TEST.YY"],
    "score": [0.88, 0.91],
    "date": ["2024-01-01", "2024-01-02"],
})

test_pl.to_pandas().to_sql("_test_polars", ENGINE, if_exists="replace", index=False)
print("Polars → Pandas → SQL Server")
display(pl.read_database("SELECT * FROM dbo._test_polars", connection=ENGINE))
```

    Polars → Pandas → SQL Server

<div><!-- shape: (2, 3) --><table><thead><tr><th>symbol</th><th>score</th><th>date</th></tr><tr><td>str</td><td>f64</td><td>str</td></tr></thead><tbody><tr><td>PL_TEST.XX</td><td>0.88</td><td>2024-01-01</td></tr><tr><td>PL_TEST.YY</td><td>0.91</td><td>2024-01-02</td></tr></tbody></table></div>

```python
# For bulk inserts: use pyodbc executemany with fast_executemany
with pyodbc.connect(PYODBC_CONN) as conn:
    conn.autocommit = False
    cursor = conn.cursor()
    cursor.fast_executemany = True

    # Create table
    cursor.execute("IF OBJECT_ID('_test_bulk') IS NOT NULL DROP TABLE _test_bulk")
    cursor.execute("CREATE TABLE _test_bulk (symbol NVARCHAR(20), score FLOAT, dt DATE)")

    # Bulk insert from Polars
    rows = test_pl.select("symbol", "score", "date").rows()
    cursor.executemany("INSERT INTO _test_bulk (symbol, score, dt) VALUES (?, ?, ?)", rows)
    conn.commit()

print(f"Bulk inserted {len(rows)} rows")
display(pl.read_database("SELECT * FROM dbo._test_bulk", connection=ENGINE))
```

    Bulk inserted 2 rows

<div><!-- shape: (2, 3) --><table><thead><tr><th>symbol</th><th>score</th><th>dt</th></tr><tr><td>str</td><td>f64</td><td>date</td></tr></thead><tbody><tr><td>PL_TEST.XX</td><td>0.88</td><td>2024-01-01</td></tr><tr><td>PL_TEST.YY</td><td>0.91</td><td>2024-01-02</td></tr></tbody></table></div>

## Executing SQL Statements

```python
# DDL and DML via SQLAlchemy
with ENGINE.begin() as conn:
    # Create/alter tables
    conn.execute(sa.text(
        "IF OBJECT_ID('_test_exec') IS NOT NULL DROP TABLE _test_exec"
    ))
    conn.execute(sa.text(
        "CREATE TABLE _test_exec (id INT IDENTITY PRIMARY KEY, name NVARCHAR(50), value FLOAT)"
    ))
    # Insert
    conn.execute(sa.text(
        "INSERT INTO _test_exec (name, value) VALUES (:name, :value)"
    ), [{"name": "alpha", "value": 1.1}, {"name": "beta", "value": 2.2}])

display(pd.read_sql("SELECT * FROM dbo._test_exec", ENGINE))
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>id</th>
      <th>name</th>
      <th>value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>1</td>
      <td>alpha</td>
      <td>1.1</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2</td>
      <td>beta</td>
      <td>2.2</td>
    </tr>
  </tbody>
</table>

```python
# DDL via pyodbc (for stored procedures, etc.)
with pyodbc.connect(PYODBC_CONN) as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM bronze.eurostoxx50_ohlcv")
    total = cursor.fetchone()
    print(f"Total rows: {total[0]:,}")  # type: ignore[index]

    # List all user tables
    cursor.execute(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES "
        "WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
    )
    tables = [row[0] for row in cursor.fetchall()]
    print(f"Tables ({len(tables)}): {tables[:10]}...")
```

    Total rows: 50
    Tables (27): ['_test_bulk', '_test_exec', '_test_pandas', '_test_pandas_typed', '_test_polars', 'dim_country', 'dim_index', 'eurostoxx50_ohlcv', 'eurostoxx50_ohlcv', 'index_dim']...

## Stored Procedures

```python
# Call stored procedures and read results
with pyodbc.connect(PYODBC_CONN) as conn:
    cursor = conn.cursor()

    # Create a test stored procedure
    cursor.execute("""
        IF OBJECT_ID('sp_test_top_stocks') IS NOT NULL DROP PROCEDURE sp_test_top_stocks
    """)
    cursor.execute("""
        CREATE PROCEDURE sp_test_top_stocks @top_n INT = 5
        AS
        SELECT TOP (@top_n) symbol, AVG([close]) as avg_close
        FROM bronze.eurostoxx50_ohlcv
        GROUP BY symbol
        ORDER BY avg_close DESC
    """)
    conn.commit()

# Execute stored procedure via Pandas
df = pd.read_sql("EXEC sp_test_top_stocks @top_n = 10", ENGINE)
display(Markdown("**Top 10 stocks by avg close (stored procedure):**"))
display(df)
```

#### Top 10 stocks by avg close (stored procedure)

<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>avg_close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>RMS.PA</td>
      <td>1906.00</td>
    </tr>
    <tr>
      <th>1</th>
      <td>RHM.DE</td>
      <td>1551.50</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>1190.80</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ADYEN.AS</td>
      <td>925.70</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ARGX.BR</td>
      <td>626.60</td>
    </tr>
    <tr>
      <th>5</th>
      <td>MUV2.DE</td>
      <td>526.20</td>
    </tr>
    <tr>
      <th>6</th>
      <td>MC.PA</td>
      <td>494.35</td>
    </tr>
    <tr>
      <th>7</th>
      <td>OR.PA</td>
      <td>360.80</td>
    </tr>
    <tr>
      <th>8</th>
      <td>ALV.DE</td>
      <td>348.70</td>
    </tr>
    <tr>
      <th>9</th>
      <td>SAF.PA</td>
      <td>315.40</td>
    </tr>
  </tbody>
</table>

## Schema Inspection

```python
# List all tables with row counts
query = """
SELECT
    t.TABLE_NAME,
    p.rows as row_count
FROM INFORMATION_SCHEMA.TABLES t
JOIN sys.partitions p ON OBJECT_ID(t.TABLE_SCHEMA + '.' + t.TABLE_NAME) = p.object_id
WHERE t.TABLE_TYPE = 'BASE TABLE' AND p.index_id IN (0, 1)
ORDER BY p.rows DESC
"""
display(pd.read_sql(query, ENGINE))
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>TABLE_NAME</th>
      <th>row_count</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>eurostoxx50_ohlcv</td>
      <td>66355</td>
    </tr>
    <tr>
      <th>1</th>
      <td>stoxxusa50_ohlcv</td>
      <td>65100</td>
    </tr>
    <tr>
      <th>2</th>
      <td>stoxxasia50_ohlcv</td>
      <td>64045</td>
    </tr>
    <tr>
      <th>3</th>
      <td>trading_calendar</td>
      <td>29335</td>
    </tr>
    <tr>
      <th>4</th>
      <td>oil20_ohlcv</td>
      <td>24738</td>
    </tr>
    <tr>
      <th>5</th>
      <td>index_performance</td>
      <td>5281</td>
    </tr>
    <tr>
      <th>6</th>
      <td>scores_daily</td>
      <td>466</td>
    </tr>
    <tr>
      <th>7</th>
      <td>signals_daily</td>
      <td>466</td>
    </tr>
    <tr>
      <th>8</th>
      <td>dim_country</td>
      <td>212</td>
    </tr>
    <tr>
      <th>9</th>
      <td>signals_quarterly</td>
      <td>177</td>
    </tr>
    <tr>
      <th>10</th>
      <td>scores_quarterly</td>
      <td>170</td>
    </tr>
    <tr>
      <th>11</th>
      <td>index_dim</td>
      <td>169</td>
    </tr>
    <tr>
      <th>12</th>
      <td>index_dim</td>
      <td>169</td>
    </tr>
    <tr>
      <th>13</th>
      <td>signals_daily</td>
      <td>169</td>
    </tr>
    <tr>
      <th>14</th>
      <td>signals_quarterly</td>
      <td>169</td>
    </tr>
    <tr>
      <th>15</th>
      <td>eurostoxx50_ohlcv</td>
      <td>50</td>
    </tr>
    <tr>
      <th>16</th>
      <td>stoxxusa50_ohlcv</td>
      <td>50</td>
    </tr>
    <tr>
      <th>17</th>
      <td>stoxxasia50_ohlcv</td>
      <td>50</td>
    </tr>
    <tr>
      <th>18</th>
      <td>pulse</td>
      <td>40</td>
    </tr>
    <tr>
      <th>19</th>
      <td>pulse_tickers</td>
      <td>40</td>
    </tr>
    <tr>
      <th>20</th>
      <td>oil20_ohlcv</td>
      <td>19</td>
    </tr>
    <tr>
      <th>21</th>
      <td>dim_index</td>
      <td>4</td>
    </tr>
    <tr>
      <th>22</th>
      <td>_test_pandas</td>
      <td>4</td>
    </tr>
    <tr>
      <th>23</th>
      <td>_test_exec</td>
      <td>2</td>
    </tr>
    <tr>
      <th>24</th>
      <td>_test_pandas_typed</td>
      <td>2</td>
    </tr>
    <tr>
      <th>25</th>
      <td>_test_polars</td>
      <td>2</td>
    </tr>
    <tr>
      <th>26</th>
      <td>_test_bulk</td>
      <td>2</td>
    </tr>
  </tbody>
</table>

```python
# Column details for a specific table
query = """
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'eurostoxx50_ohlcv' AND TABLE_SCHEMA = 'bronze'
ORDER BY ORDINAL_POSITION
"""
display(pd.read_sql(query, ENGINE))
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>COLUMN_NAME</th>
      <th>DATA_TYPE</th>
      <th>CHARACTER_MAXIMUM_LENGTH</th>
      <th>IS_NULLABLE</th>
      <th>COLUMN_DEFAULT</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>id</td>
      <td>int</td>
      <td>NaN</td>
      <td>NO</td>
      <td>None</td>
    </tr>
    <tr>
      <th>1</th>
      <td>_ingested_at</td>
      <td>datetime2</td>
      <td>NaN</td>
      <td>NO</td>
      <td>(sysutcdatetime())</td>
    </tr>
    <tr>
      <th>2</th>
      <td>symbol</td>
      <td>varchar</td>
      <td>20.0</td>
      <td>NO</td>
      <td>None</td>
    </tr>
    <tr>
      <th>3</th>
      <td>date</td>
      <td>date</td>
      <td>NaN</td>
      <td>NO</td>
      <td>None</td>
    </tr>
    <tr>
      <th>4</th>
      <td>open</td>
      <td>float</td>
      <td>NaN</td>
      <td>YES</td>
      <td>None</td>
    </tr>
    <tr>
      <th>5</th>
      <td>high</td>
      <td>float</td>
      <td>NaN</td>
      <td>YES</td>
      <td>None</td>
    </tr>
    <tr>
      <th>6</th>
      <td>low</td>
      <td>float</td>
      <td>NaN</td>
      <td>YES</td>
      <td>None</td>
    </tr>
    <tr>
      <th>7</th>
      <td>close</td>
      <td>float</td>
      <td>NaN</td>
      <td>YES</td>
      <td>None</td>
    </tr>
    <tr>
      <th>8</th>
      <td>adj_close</td>
      <td>float</td>
      <td>NaN</td>
      <td>YES</td>
      <td>None</td>
    </tr>
    <tr>
      <th>9</th>
      <td>volume</td>
      <td>bigint</td>
      <td>NaN</td>
      <td>YES</td>
      <td>None</td>
    </tr>
    <tr>
      <th>10</th>
      <td>dividends</td>
      <td>float</td>
      <td>NaN</td>
      <td>YES</td>
      <td>None</td>
    </tr>
    <tr>
      <th>11</th>
      <td>stock_splits</td>
      <td>float</td>
      <td>NaN</td>
      <td>YES</td>
      <td>None</td>
    </tr>
  </tbody>
</table>

## Performance: SQLAlchemy vs pyodbc (Pandas vs Polars)

```python
query = "SELECT * FROM bronze.eurostoxx50_ohlcv"

# SQLAlchemy (Polars)
t0 = time.perf_counter()
df_pl_sa = pl.read_database(query, connection=ENGINE)
t_pl_sa = time.perf_counter() - t0

# SQLAlchemy (Pandas)
t0 = time.perf_counter()
df_sa = pd.read_sql(query, ENGINE)
t_sa = time.perf_counter() - t0

# pyodbc via ENGINE.raw_connection()
t0 = time.perf_counter()

df_py = pd.read_sql(query, ENGINE)
t_py = time.perf_counter() - t0

print(f"SQLAlchemy (Polars): {t_pl_sa:.2f}s — {df_pl_sa.shape}")
print(f"SQLAlchemy (Pandas): {t_sa:.2f}s — {df_sa.shape}")
print(f"pyodbc     (Pandas): {t_py:.2f}s — {df_py.shape}")
```

    SQLAlchemy (Polars): 0.00s — (50, 12)
    SQLAlchemy (Pandas): 0.00s — (50, 12)
    pyodbc     (Pandas): 0.00s — (50, 12)

## Cleanup Test Tables

```python
# Drop test tables created during this notebook
with ENGINE.begin() as conn:
    for table in ["_test_pandas", "_test_pandas_typed", "_test_polars", "_test_bulk", "_test_exec"]:
        conn.execute(sa.text(f"IF OBJECT_ID('{table}') IS NOT NULL DROP TABLE {table}"))
    conn.execute(sa.text("IF OBJECT_ID('sp_test_top_stocks') IS NOT NULL DROP PROCEDURE sp_test_top_stocks"))
print("Test tables and procedures cleaned up")
```

    Test tables and procedures cleaned up

## Summary

| Task | Pandas | Polars |
|---|---|---|
| Connection | `sqlalchemy.create_engine()` | SQLAlchemy engine |
| Read table | `pd.read_sql(query, engine)` | `pl.read_database(query, uri)` |
| Read with params | `pd.read_sql(query, engine, params=[...])` | Use f-string or ConnectorX params |
| Chunked read | `pd.read_sql(query, engine, chunksize=N)` | Use OFFSET/FETCH in SQL |
| Write table | `df.to_sql(name, engine)` | `df.to_pandas().to_sql()` or pyodbc bulk |
| Append rows | `df.to_sql(name, engine, if_exists="append")` | Same via Pandas |
| Bulk insert | `to_sql(method="multi")` | `cursor.fast_executemany = True` |
| Execute DDL | `engine.execute(text(...))` | `cursor.execute(...)` via pyodbc |
| Stored procs | `pd.read_sql("EXEC sp_name", engine)` | `pl.read_database("EXEC sp_name", uri)` |
| Speed | Moderate | Similar speed via SQLAlchemy/pyodbc |
