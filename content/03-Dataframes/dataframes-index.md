---
type: index
category: dataframes
technology:
  - python
  - csharp
  - pandas
  - polars
  - dotnet
tags: [python, csharp, pandas, polars, dataframes]
aliases: [DataFrames Index, DataFrame Reference, Pandas vs Polars Index, Polars.NET Reference]
keywords: [pandas, polars, polars.net, dataframe, comparison, side-by-side, python data analysis, csharp data analysis]
description: "Index for the DataFrames section — paired Python (Pandas/Polars) and C# (Polars.NET) references covering 10 topics from foundations to production patterns, each with executable examples and cell outputs."
related:
  - "[[programming-languages-index]]"
  - "[[index|Elysium]]"
created: 2026-03-24
updated: 2026-03-27
status: complete
---

# DataFrames

Paired Python and C# DataFrame references covering 10 topics. Each note was converted from an executed Jupyter notebook with cell outputs preserved — you see both the code and its result. The Python notes use Pandas and Polars side-by-side; the C# notes use Polars.NET.

## Topic Map

| # | Topic | Python | C\# |
|---|-------|--------|------|
| 01 | Foundations & I/O (Series, DataFrames, types, CSV/Parquet) | [[01_py_foundations_io|Python]] | [[01_cs_foundations_io|C#]] |
| 02 | Explore, Select & Filter (head/tail, describe, where, isin) | [[02_py_explore_select_filter|Python]] | [[02_cs_explore_select_filter|C#]] |
| 03 | Transforms, Expressions & Chaining (with_columns, when/then) | [[03_py_transforms_expressions_chaining|Python]] | [[03_cs_transforms_expressions_chaining|C#]] |
| 04 | Missing Data, Strings & DateTime (nulls, .str, .dt, timezones) | [[04_py_missing_strings_datetime|Python]] | [[04_cs_missing_strings_datetime|C#]] |
| 05 | Aggregation & Reshaping (groupby, windows, joins, pivot, melt) | [[05_py_aggregation_reshaping|Python]] | [[05_cs_aggregation_reshaping|C#]] |
| 06 | Lazy API & Performance (lazy/collect, query plan, benchmarks) | [[06_py_lazy_performance|Python]] | [[06_cs_lazy_performance|C#]] |
| 07 | Advanced Types & Interop (categoricals, Arrow, zero-copy) | [[07_py_types_interop|Python]] | [[07_cs_types_interop|C#]] |
| 08 | Visualization (charts, plots, interactive graphics) | [[08_py_visualization|Python]] | [[08_cs_visualization|C#]] |
| 09 | Database & SQL Interface (SQLContext, DuckDB, SQL Server) | [[09_py_database_interface|Python]] | [[09_cs_database_interface|C#]] |
| 10 | Testing & Migration (end-to-end, validation, migration guide) | [[10_py_testing_migration|Python]] | [[10_cs_testing_migration|C#]] |

## How These Notes Work

Each note contains:
- **Code cells** — the actual source code as fenced code blocks
- **Output cells** — the printed output from running the code (indented text blocks below each code cell)
- **DataFrame renders** — HTML tables showing DataFrame contents inline
- **Explanatory markdown** — headings, descriptions, and context between cells

The Python and C# notes for each topic are tightly paired — they cover the same concepts, in the same order, allowing side-by-side comparison across languages.

## All Notes

**Python:** [[01_py_foundations_io]] | [[02_py_explore_select_filter]] | [[03_py_transforms_expressions_chaining]] | [[04_py_missing_strings_datetime]] | [[05_py_aggregation_reshaping]] | [[06_py_lazy_performance]] | [[07_py_types_interop]] | [[08_py_visualization]] | [[09_py_database_interface]] | [[10_py_testing_migration]]

**C#:** [[01_cs_foundations_io]] | [[02_cs_explore_select_filter]] | [[03_cs_transforms_expressions_chaining]] | [[04_cs_missing_strings_datetime]] | [[05_cs_aggregation_reshaping]] | [[06_cs_lazy_performance]] | [[07_cs_types_interop]] | [[08_cs_visualization]] | [[09_cs_database_interface]] | [[10_cs_testing_migration]]

## Cross-References

- [[programming-languages-index]] — Python and C# paired language references
- [[sql-python-csharp-transforms]] — Side-by-side data transformations in SQL, Python, and C#
