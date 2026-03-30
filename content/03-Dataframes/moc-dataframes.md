---
title: "MOC: DataFrames"
tags:
  - moc
  - dataframes
  - pandas
  - polars
---

# MOC: DataFrames

Side-by-side Pandas/Polars (Python) and Polars.NET/Deedle (C#) reference across 10 paired notebooks. Every page uses the same Euro Stoxx 50 financial datasets, so patterns build on each other from foundations through production pipelines. Python pages are listed first, followed by their C# counterpart.

## Core Operations — Building and Shaping DataFrames

The fundamentals: create data structures, read/write files, inspect rows, select columns, filter, and transform. Start here if you are new to either library.

* [[01_py_foundations_io]] — Series vs DataFrame construction, data types, CSV/Parquet I/O, Pandas indexes vs Polars names

* [[01_cs_foundations_io]] — Polars.NET and Deedle Series/DataFrames, NuGet setup, CSV/Parquet I/O in C#

* [[02_py_explore_select_filter]] — head/tail/describe/info, column selection with selectors, row filtering with isin/between/query, loc vs iloc

* [[02_cs_explore_select_filter]] — head/tail/describe in Polars.NET and Deedle, boolean filtering, where/isin equivalents in C#

* [[03_py_transforms_expressions]] — with_columns, assign, when/then/otherwise, apply vs map_elements, method chaining and pipe

* [[03_cs_transforms_expressions]] — Polars.NET with_columns and expressions, when/then, method chaining patterns in C#

* [[04_py_missing_strings_datetime]] — NaN vs null semantics, fillna/fill_null, nullable integer dtypes, .str and .dt accessors, timezone handling

* [[04_cs_missing_strings_datetime]] — null handling in Polars.NET and Deedle, string operations, DateTime parsing and timezone conversion in C#

## Advanced Analytics — Aggregation, Joins, and Performance

Group-by, window functions, joins, reshaping, lazy evaluation, and benchmarking. These patterns appear in every production pipeline.

* [[05_py_aggregation_reshaping]] — groupby with named aggregation, window functions with over(), rolling/shift, joins/merge/concat, pivot/melt/explode

* [[05_cs_aggregation_reshaping]] — Polars.NET group_by and agg, window expressions, joins, cross joins, pivot/unpivot in C#

* [[06_py_lazy_performance]] — lazy vs eager execution, scan_parquet, query plan visualization, predicate and projection pushdown, Pandas vs Polars benchmarks

* [[06_cs_lazy_performance]] — Polars.NET LazyFrame, scan_csv/scan_parquet, query optimization, collect, eager-only Deedle comparison

* [[07_py_types_interop]] — Categorical and Enum types, Struct/List/Array nested types, PyArrow zero-copy interchange, memory optimization

* [[07_cs_types_interop]] — Polars.NET categoricals, nested types, Arrow interop, type casting and schema management in C#

## Visualization, Integration & Quality — From DataFrames to Production

Charting, database connectivity, testing, and migration strategies that take DataFrames from exploration to deployment.

* [[08_py_visualization]] — Matplotlib/Seaborn static charts, Plotly interactive charts, Tokyo Night theming, subplots and faceting

* [[08_cs_visualization]] — Plotly.NET interactive charts, ScottPlot for static/performance plots, OxyPlot for PDF export in C#

* [[09_py_database_interface]] — Polars SQLContext, DuckDB integration, SQL Server connectivity via pyodbc/SQLAlchemy, read_database patterns

* [[09_cs_database_interface]] — Polars.NET SQL context, DuckDB.NET, ADO.NET SQL Server connectivity in C#

* [[10_py_testing_migration]] — End-to-end analytical pipeline, assert_frame_equal validation, Pandas-to-Polars migration guide and gotchas

* [[10_cs_testing_migration]] — End-to-end pipeline in C#, xUnit-style validation, Pandas-to-Polars.NET migration patterns
