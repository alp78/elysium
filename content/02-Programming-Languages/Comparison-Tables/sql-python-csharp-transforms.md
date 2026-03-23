---
type: reference
category: data-engineering
technology: [sql-server, python, csharp]
tags: [reference, sql-server, python, csharp, data-modeling, snippet, comparison]
aliases: [SQL vs Python vs C#, data manipulation comparison, where to transform, window functions SQL Python, LINQ data transforms, ROW_NUMBER Python equivalent, pandas SQL comparison, LINQ vs SQL, data transformation reference]
keywords: [sql, python, csharp, linq, pandas, window functions, ROW_NUMBER, RANK, LAG, LEAD, pivot, unpivot, z-score, percent change, deduplication, conditional aggregation, running total, moving average, joins, cross-database join, where to transform, data manipulation, transformation layer]
description: "Side-by-side reference for data manipulation in SQL Server (T-SQL), Python (pandas), and C# (LINQ) — covering where to transform, window functions, pivoting, z-scores, deduplication, and the key insight for choosing the right tool in each scenario."
related: [date-and-time-handling, awk-data-processing, parquet-files, serialization-formats, database-connections, idempotent-pipeline-design]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# SQL, Python, and C# Data Transforms — Side-by-Side Reference

The ability to express the same transformation in SQL, Python, and C# is what makes a data engineer versatile. SQL for database-level transforms, Python for pipeline processing, C# for dashboard logic. This note presents the key decision framework and every major operation across all three languages.

> This chapter covers: window functions (ROW_NUMBER, RANK, LAG/LEAD, running aggregates, moving averages), pivoting/unpivoting, conditional aggregation, joins, z-scores, percent change, deduplication, and type conversion.

## 26.1 The Key Insight — Where to Transform

| Scenario | Best Tool | Why |
|---|---|---|
| Data already in the database, result stays in the database | SQL | No data movement, optimizer handles execution plan |
| Data needs to be loaded from external API then written to DB | Python | HTTP client + data cleaning + DB write in one pipeline |
| Dashboard needs to compute aggregations for display | C# (LINQ) | Runs in the application layer, close to the UI |
| Complex statistical calculations | Python (pandas/numpy) | Rich library ecosystem, vectorized operations |
| Simple filtering and grouping | SQL | Most readable, most maintainable, best performance |
| Cross-database joins | Python (pandas merge) | SQL can't join across different database servers |

> [!tip] The Golden Rule
> Transform data as close to its source as possible, and as late as you can get away with. SQL transformations in the database are almost always faster than pulling data to Python and transforming there. But Python is necessary when crossing system boundaries (API → DB) or when using libraries that don't exist in SQL (scipy, statsmodels, scikit-learn).

> [!info] Context for This Reference
> SQL examples use SQL Server T-SQL dialect. Python examples use pandas (the standard for data engineering; see also Polars for large-scale pipelines). C# examples use LINQ, which is idiomatic for the application/dashboard layer. For [[database-connections|connection recipes]], see the database connections note.

## Window Functions

Window functions compute values across a "window" of related rows without collapsing the result set. They are one of the most powerful features in SQL and have equivalents in pandas and LINQ.

### ROW_NUMBER — Assign Sequential Row Numbers

**Row number within a partition (e.g., rank instruments per index by score):**

```sql
-- SQL Server: ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)
SELECT
    symbol,
    index_key,
    composite_score,
    ROW_NUMBER() OVER (PARTITION BY index_key ORDER BY composite_score DESC) AS rank
FROM gold.scores_daily
WHERE trade_date = '2026-03-10'
```

```python
# Python (pandas): groupby + cumcount, or rank
import pandas as pd

df['rank'] = (
    df.groupby('index_key')['composite_score']
    .rank(method='first', ascending=False)
    .astype(int)
)
```

### RANK and DENSE_RANK

```sql
-- SQL Server: RANK() leaves gaps after ties; DENSE_RANK() does not
SELECT
    symbol,
    composite_score,
    RANK()       OVER (ORDER BY composite_score DESC) AS rank_with_gaps,
    DENSE_RANK() OVER (ORDER BY composite_score DESC) AS dense_rank
FROM gold.scores_daily
WHERE trade_date = '2026-03-10'
-- If scores 1st and 2nd are tied: RANK gives 1,1,3; DENSE_RANK gives 1,1,2
```

```python
# Python (pandas)
df['rank_with_gaps'] = df['composite_score'].rank(method='min', ascending=False).astype(int)
df['dense_rank']     = df['composite_score'].rank(method='dense', ascending=False).astype(int)
```

### LAG and LEAD — Prior and Next Row Values

**Compute day-over-day change (LAG = previous row's value):**

```sql
-- SQL Server: LAG/LEAD with optional offset and default value
SELECT
    symbol,
    trade_date,
    close_price,
    LAG(close_price, 1) OVER (PARTITION BY symbol ORDER BY trade_date) AS prev_close,
    LEAD(close_price, 1) OVER (PARTITION BY symbol ORDER BY trade_date) AS next_close,
    close_price - LAG(close_price, 1) OVER (PARTITION BY symbol ORDER BY trade_date) AS day_change
FROM silver.ohlcv_daily
```

```python
# Python (pandas): shift() is LAG; shift(-1) is LEAD
df = df.sort_values(['symbol', 'trade_date'])
df['prev_close'] = df.groupby('symbol')['close_price'].shift(1)
df['next_close'] = df.groupby('symbol')['close_price'].shift(-1)
df['day_change']  = df['close_price'] - df['prev_close']
```

### Running Totals and Moving Averages

```sql
-- SQL Server: running total with ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
SELECT
    trade_date,
    close_price,
    SUM(close_price) OVER (PARTITION BY symbol ORDER BY trade_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total,
    AVG(close_price) OVER (PARTITION BY symbol ORDER BY trade_date
        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS moving_avg_30d
FROM silver.ohlcv_daily
```

```python
# Python (pandas): cumsum() for running total; rolling() for moving average
df = df.sort_values(['symbol', 'trade_date'])
df['running_total']  = df.groupby('symbol')['close_price'].cumsum()
df['moving_avg_30d'] = df.groupby('symbol')['close_price'].transform(
    lambda x: x.rolling(30, min_periods=1).mean()
)
```

## Z-Score Normalization

Z-scores standardize values to a mean of 0 and standard deviation of 1. Commonly used in factor models and scoring systems to make metrics from different scales comparable.

```sql
-- SQL Server: z-score with window function
SELECT
    symbol,
    trade_date,
    momentum_30d,
    (momentum_30d - AVG(momentum_30d) OVER (PARTITION BY trade_date))
        / NULLIF(STDEV(momentum_30d) OVER (PARTITION BY trade_date), 0) AS momentum_z_score
FROM silver.daily_signals
-- NULLIF(stdev, 0) prevents division by zero when all values are identical
```

```python
# Python (pandas): groupby + transform
df['momentum_z_score'] = df.groupby('trade_date')['momentum_30d'].transform(
    lambda x: (x - x.mean()) / x.std() if x.std() > 0 else 0
)

# Or with scipy for population z-score
from scipy import stats
df['z_score'] = df.groupby('trade_date')['momentum_30d'].transform(stats.zscore)
```

```csharp
// C# (LINQ): z-score for dashboard display
var grouped = records.GroupBy(r => r.TradeDate);
var result = grouped.SelectMany(g => {
    var mean = g.Average(r => r.Momentum30d);
    var std = Math.Sqrt(g.Average(r => Math.Pow(r.Momentum30d - mean, 2)));
    return g.Select(r => new {
        r.Symbol,
        r.TradeDate,
        ZScore = std > 0 ? (r.Momentum30d - mean) / std : 0
    });
});
```

## Percent Change

```sql
-- SQL Server: percent change day-over-day
SELECT
    symbol,
    trade_date,
    close_price,
    LAG(close_price) OVER (PARTITION BY symbol ORDER BY trade_date) AS prev_close,
    (close_price - LAG(close_price) OVER (PARTITION BY symbol ORDER BY trade_date))
        / NULLIF(LAG(close_price) OVER (PARTITION BY symbol ORDER BY trade_date), 0) * 100 AS pct_change
FROM silver.ohlcv_daily
```

```python
# Python (pandas): pct_change()
df = df.sort_values(['symbol', 'trade_date'])
df['pct_change'] = df.groupby('symbol')['close_price'].pct_change() * 100
```

## Pivoting and Unpivoting

Pivot: rows → columns. Unpivot: columns → rows.

```sql
-- SQL Server PIVOT: show metrics as columns
SELECT *
FROM (
    SELECT symbol, metric_name, metric_value
    FROM silver.daily_metrics
    WHERE trade_date = '2026-03-10'
) src
PIVOT (
    MAX(metric_value)
    FOR metric_name IN ([momentum_30d], [pe_ratio], [dividend_yield])
) pvt
```

```python
# Python (pandas): pivot_table()
pivoted = df.pivot_table(
    index='symbol',
    columns='metric_name',
    values='metric_value',
    aggfunc='max'
).reset_index()

# Unpivot: melt() — reverse of pivot
melted = df.melt(
    id_vars=['symbol', 'trade_date'],
    value_vars=['momentum_30d', 'pe_ratio', 'dividend_yield'],
    var_name='metric_name',
    value_name='metric_value'
)
```

## Deduplication

```sql
-- SQL Server: keep latest record per key using ROW_NUMBER
WITH ranked AS (
    SELECT *,
        ROW_NUMBER() OVER (PARTITION BY symbol, trade_date ORDER BY loaded_at DESC) AS rn
    FROM bronze.raw_prices
)
SELECT * FROM ranked WHERE rn = 1
-- Keeps only the most recently loaded record for each (symbol, trade_date) pair
```

```python
# Python (pandas): drop_duplicates() or sort + groupby last
# Keep last occurrence (assumes sorted by loaded_at)
df_dedup = df.sort_values('loaded_at').drop_duplicates(
    subset=['symbol', 'trade_date'], keep='last'
)

# Or: groupby + last
df_dedup = (
    df.sort_values('loaded_at')
    .groupby(['symbol', 'trade_date'])
    .last()
    .reset_index()
)
```

```csharp
// C# (LINQ): GroupBy + last
var deduped = records
    .GroupBy(r => new { r.Symbol, r.TradeDate })
    .Select(g => g.OrderByDescending(r => r.LoadedAt).First())
    .ToList();
```

## Conditional Aggregation (CASE WHEN / IIF)

```sql
-- SQL Server: count records matching a condition within a GROUP BY
SELECT
    trade_date,
    COUNT(*) AS total,
    SUM(CASE WHEN composite_score > 0.7 THEN 1 ELSE 0 END) AS high_score_count,
    AVG(CASE WHEN sector = 'Technology' THEN composite_score ELSE NULL END) AS tech_avg_score
FROM gold.scores_daily
GROUP BY trade_date
```

```python
# Python (pandas): conditional sum with np.where or boolean indexing
import numpy as np

summary = df.groupby('trade_date').agg(
    total=('symbol', 'count'),
    high_score_count=('composite_score', lambda x: (x > 0.7).sum()),
    tech_avg_score=('composite_score', lambda x: x[df.loc[x.index, 'sector'] == 'Technology'].mean())
)
```

## Joins

```sql
-- SQL Server: INNER JOIN (most common)
SELECT a.symbol, a.composite_score, b.sector
FROM gold.scores_daily a
INNER JOIN reference.instruments b ON a.symbol = b.symbol
WHERE a.trade_date = '2026-03-10'

-- LEFT JOIN: keep all rows from left table, NULL for unmatched right rows
SELECT a.symbol, b.sector   -- b.sector will be NULL if no match
FROM gold.scores_daily a
LEFT JOIN reference.instruments b ON a.symbol = b.symbol
```

```python
# Python (pandas): merge() — equivalent to SQL JOIN
# INNER JOIN
merged = pd.merge(scores_df, instruments_df, on='symbol', how='inner')

# LEFT JOIN
merged = pd.merge(scores_df, instruments_df, on='symbol', how='left')

# Cross-database join (the main reason to use pandas instead of SQL)
sql_df = pd.read_sql("SELECT * FROM gold.scores_daily WHERE ...", sql_engine)
bq_df  = bq_client.query("SELECT * FROM `project.dataset.table`").to_dataframe()
combined = pd.merge(sql_df, bq_df, on='symbol', how='inner')
```

> [!info] Cross-Database Joins
> SQL cannot join tables across different database servers. If you need to combine data from SQL Server and BigQuery, pull both to Python DataFrames and use `pd.merge()`. This is one of the primary use cases for Python in data engineering pipelines.

## Type Conversion

```sql
-- SQL Server: CAST and TRY_CAST
SELECT
    CAST('2026-03-10' AS DATE) AS trade_date,
    CAST('123.45' AS DECIMAL(10,2)) AS price,
    TRY_CAST(user_input AS INT) AS safe_int,   -- returns NULL instead of error
    CONVERT(NVARCHAR(10), GETDATE(), 120) AS date_string
```

```python
# Python (pandas): astype() and to_numeric/to_datetime
df['trade_date'] = pd.to_datetime(df['trade_date'])
df['price']      = pd.to_numeric(df['price'], errors='coerce')   # NaN on failure
df['volume']     = df['volume'].astype(int)
df['date_str']   = df['trade_date'].dt.strftime('%Y-%m-%d')
```

```csharp
// C# safe type conversion
int.TryParse(str, out var i);           // returns false, i=0 on failure
decimal.TryParse(str, out var d);
DateTime.TryParse(str, out var dt);
Convert.ToDecimal(obj);                 // throws on failure
```

---

## Related Notes

- [[database-connections]] — Connection string recipes for pyodbc, SQLAlchemy, C# SqlClient, PowerShell, sqlcmd
- [[date-and-time-handling]] — Date arithmetic, timezone conversion, SQL DATEADD/DATEDIFF in all languages
- [[awk-data-processing]] — JSON and CSV file processing in Bash, Python, PowerShell
- [[parquet-files]] — Writing Parquet output from Python transforms
- [[serialization-formats]] — Format decision matrix for pipeline output
- [[idempotent-pipeline-design]] — Pipeline design patterns for the transforms covered here

## References

- [pandas documentation](https://pandas.pydata.org/docs/)
- [SQL Server window functions](https://docs.microsoft.com/en-us/sql/t-sql/functions/ranking-functions-transact-sql)
- [LINQ standard query operators](https://docs.microsoft.com/en-us/dotnet/csharp/programming-guide/concepts/linq/standard-query-operators-overview)
