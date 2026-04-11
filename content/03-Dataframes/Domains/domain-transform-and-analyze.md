---
title: "Domain: Transform and Analyze"
tags:
  - domain
  - dataframes
---

# Transform and Analyze

Column transforms, expressions, missing data handling, aggregation, reshaping, and lazy evaluation performance across Pandas and Polars.

```mermaid
mindmap
  ((Transform and Analyze))
    (transforms, expressions)
    (missing, strings, dates)
    (aggregation, reshaping)
    (lazy eval, performance)
```

> [!abstract]- Transforms and Expressions
>
> - Column creation with assign and with_columns — [[03-py-transforms-expressions#Setup & Data Loading|py]] · [[03-cs-transforms-expressions#Column Transforms|cs]]
> - Polars expression system — [[03-py-transforms-expressions#Comparison Table — Creating & Transforming Columns|py]] · [[03-cs-transforms-expressions#Expression System (Polars.NET focus)|cs]]
> - Type casting — [[03-py-transforms-expressions#Comparison Table — Creating & Transforming Columns|py]] · [[03-cs-transforms-expressions#Type Casting|cs]]
> - Method chaining and window expressions — [[03-py-transforms-expressions#Practical Transform Examples — scores_daily dataset|py]] · [[03-cs-transforms-expressions#Method Chaining & Window Functions|cs]]
> - Apply, map, and UDFs — [[03-py-transforms-expressions#Practical Transform Examples — scores_daily dataset|py]] · [[03-cs-transforms-expressions#Column Transforms|cs]]

> [!abstract]- Missing Data, Strings, and DateTime
>
> - Null representations and detection — [[04-py-missing-strings-datetime#Null Representations|py]] · [[04-cs-missing-strings-datetime#Missing Data|cs]]
> - Filling and dropping nulls — [[04-py-missing-strings-datetime#Filling Nulls|py]] · [[04-cs-missing-strings-datetime#Missing Data|cs]]
> - String operations and pattern matching — [[04-py-missing-strings-datetime#Case Operations|py]] · [[04-cs-missing-strings-datetime#String Operations|cs]]
> - Date parsing and dt accessor — [[04-py-missing-strings-datetime#Parsing Dates|py]] · [[04-cs-missing-strings-datetime#DateTime Operations|cs]]
> - Rolling windows and resampling — [[04-py-missing-strings-datetime#Rolling Windows|py]] · [[04-cs-missing-strings-datetime#DateTime Operations|cs]]

> [!abstract]- Aggregation and Reshaping
>
> - Group-by and multiple aggregations — [[05-py-aggregation-reshaping#Basic Group By|py]] · [[05-cs-aggregation-reshaping#Grouping & Aggregation|cs]]
> - Window functions and rolling — [[05-py-aggregation-reshaping#Window Transform|py]] · [[05-cs-aggregation-reshaping#Window Functions|cs]]
> - Joins — [[05-py-aggregation-reshaping#Inner Join|py]] · [[05-cs-aggregation-reshaping#Joins|cs]]
> - Concatenation — [[05-py-aggregation-reshaping#Vertical Concat|py]] · [[05-cs-aggregation-reshaping#Concatenation|cs]]
> - Pivot, melt, and explode — [[05-py-aggregation-reshaping#Long to Wide: pivot|py]] · [[05-cs-aggregation-reshaping#Reshaping|cs]]

> [!abstract]- Lazy Evaluation and Performance
>
> - Eager vs lazy execution — [[06-py-lazy-performance#Eager: Immediate|py]] · [[06-cs-lazy-performance#Lazy Fundamentals|cs]]
> - Query optimization and pushdown — [[06-py-lazy-performance#Predicate Pushdown|py]] · [[06-cs-lazy-performance#Query Optimization|cs]]
> - Pandas vs Polars benchmarks — [[06-py-lazy-performance#Pandas vs Polars Lazy Benchmark|py]] · [[06-cs-lazy-performance#Performance Comparison|cs]]
> - Vectorized vs loop performance — [[06-py-lazy-performance#Vectorized vs Loop|py]] · [[06-cs-lazy-performance#Performance Comparison|cs]]
> - Memory usage and profiling — [[06-py-lazy-performance#Memory Usage|py]] · [[06-cs-lazy-performance#Deedle Note|cs]]
