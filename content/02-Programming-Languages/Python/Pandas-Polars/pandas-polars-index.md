---
type: index
category: programming-languages
technology: [python, pandas, polars]
tags: [pipeline, python, pandas, polars]
aliases: [Pandas Polars Index, Pandas vs Polars, DataFrame Reference]
keywords: [pandas, polars, dataframe, series, data analysis, data engineering, python data, side-by-side comparison, lazy evaluation, arrow]
description: "Index for the Pandas vs Polars reference series — 10 notebooks covering foundations through real-world projects, each with side-by-side Pandas and Polars examples and cell outputs."
related:
  - "[[programming-languages-index]]"
  - "[[fastapi-and-polars]]"
  - "[[parquet-files]]"
  - "[[data-formats-and-serialization]]"
  - "[[sql-python-csharp-transforms]]"
created: 2026-03-23
updated: 2026-03-23
status: complete
---

# Pandas vs Polars

Side-by-side Pandas and Polars references across 10 topics. Each note was converted from an executed Jupyter notebook with cell outputs preserved — you see both the code and its result. Every section shows the Pandas way first, then the Polars equivalent.

## Topic Map

| # | Topic | Note |
|---|-------|------|
| 01 | Foundations & I/O (Series, DataFrames, types, CSV/Parquet) | [[01_foundations_io]] |
| 02 | Explore, Select & Filter (head/tail, describe, where, isin) | [[02_explore_select_filter]] |
| 03 | Transforms, Expressions & Chaining (with_columns, when/then) | [[03_transforms_expressions_chaining]] |
| 04 | Missing Data, Strings & DateTime (nulls, .str, .dt, timezones) | [[04_missing_strings_datetime]] |
| 05 | Grouping, Aggregation & Windows (groupby, over, rolling, shift) | [[05_grouping_windows]] |
| 06 | Combining & Reshaping (joins, concat, pivot, melt, explode) | [[06_combining_reshaping]] |
| 07 | Lazy API & Performance (lazy/collect, query plan, benchmarks) | [[07_lazy_performance]] |
| 08 | Advanced Types & Interop (categoricals, Arrow, zero-copy) | [[08_types_interop]] |
| 09 | Visualization & SQL (matplotlib, seaborn, SQLContext, DuckDB) | [[09_visualization_sql]] |
| 10 | Project, Testing & Migration (end-to-end, validation, migration guide) | [[10_project_testing_migration]] |

## How These Notes Work

Each note contains:
- **Code cells** — the actual source code as fenced Python code blocks
- **Output cells** — the printed/rendered output from running the code (indented text or HTML tables below each code cell)
- **Explanatory markdown** — headings, descriptions, and comparison notes between cells

## Cross-References

- [[fastapi-and-polars]] — FastAPI + Polars for building data APIs
- [[parquet-files]] — Parquet file recipes with PyArrow and Pandas
- [[data-formats-and-serialization]] — JSON, CSV, Parquet, Avro, Protobuf
- [[sql-python-csharp-transforms]] — Side-by-side data transforms in SQL, Python, C#
- [[database-connections]] — Connection string recipes for all platforms
