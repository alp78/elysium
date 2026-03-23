---
type: index
category: programming-languages
technology: [python, csharp, dotnet, pandas, polars]
tags: [index, programming-languages, python, csharp, dotnet, pandas, polars]
aliases: [Programming Languages Index, Language Reference, Python Reference, C# Reference]
keywords: [programming languages, python, csharp, c sharp, dotnet, pandas, polars, dataframe, language reference, code examples, jupyter notebooks, executable examples, side-by-side comparison]
description: "Index for the Programming Languages section — paired Python and C# references covering 16 topics from basics to design patterns, plus a 10-part Pandas vs Polars series, each with executable examples and cell outputs."
related:
  - "[[Dashboard]]"
  - "[[sql-python-csharp-transforms]]"
  - "[[pandas-polars-index]]"
created: 2026-03-22
updated: 2026-03-23
status: complete
---

# Programming Languages

Paired Python and C# references covering 16 topics. Each note was converted from an executed Jupyter notebook with cell outputs preserved — you see both the code and its result. Every Python topic has a C# counterpart covering the same concepts in that language.

## Topic Map

| # | Topic | Python | C\# |
|---|-------|--------|------|
| 01 | Basics (variables, types, operators, I/O) | [[01_Basics|Python]] | [[cs-01_Basics|C#]] |
| 02 | Strings (manipulation, formatting, regex) | [[02_Strings|Python]] | [[cs-02_Strings|C#]] |
| 03 | Control Flow (if/else, loops, pattern matching) | [[03_Control_Flow|Python]] | [[cs-03_Control_Flow|C#]] |
| 04 | Functions (lambdas, closures, decorators/delegates) | [[04_Functions|Python]] | [[cs-04_Functions|C#]] |
| 05 | Collections (lists, dicts, sets, LINQ) | [[05_Collections|Python]] | [[cs-05_Collections|C#]] |
| 06 | OOP (classes, inheritance, polymorphism) | [[06_OOP|Python]] | [[cs-06_OOP|C#]] |
| 07 | Generics and LINQ / Comprehensions | [[07_Generics_LINQ|Python]] | [[cs-07_Generics_LINQ|C#]] |
| 08 | Error Handling (exceptions, try/catch) | [[08_ErrorHandling|Python]] | [[cs-08_ErrorHandling|C#]] |
| 09 | File I/O and Serialization (JSON, CSV) | [[09_FileIO_Serialization|Python]] | [[cs-09_FileIO_Serialization|C#]] |
| 10 | DateTime, Math, and Utilities | [[10_DateTimeMathUtils|Python]] | [[cs-10_DateTimeMathUtils|C#]] |
| 11 | Async and Concurrency | [[11_AsyncConcurrency|Python]] | [[cs-11_AsyncConcurrency|C#]] |
| 12 | Testing (unit tests, mocking) | [[12_Testing|Python]] | [[cs-12_Testing|C#]] |
| 13 | Web APIs (HTTP clients and servers) | [[13_WebAPIs|Python]] | [[cs-13_WebAPIs|C#]] |
| 14 | Database Access (SQL, ORM, connections) | [[14_Database|Python]] | [[cs-14_Database|C#]] |
| 15 | GCP (BigQuery, GCS, Pub/Sub) | [[15_GCP|Python]] | [[cs-15_GCP|C#]] |
| 16 | Design Patterns (singleton, factory, observer) | [[16_DesignPatterns|Python]] | [[cs-16_DesignPatterns|C#]] |

## How These Notes Work

Each note contains:
- **Code cells** — the actual source code as fenced code blocks
- **Output cells** — the printed output from running the code (indented text blocks below each code cell)
- **Explanatory markdown** — headings, descriptions, and context between cells

The Python and C# notes for each topic are tightly paired — they cover the same concepts, in the same order, allowing side-by-side comparison across languages.

## Python — Pandas vs Polars

Side-by-side Pandas and Polars references across 10 topics. Full index: [[pandas-polars-index]]

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

## Python — Data Engineering

Specialized Python references for data engineering tasks. These complement the 16-topic paired notes above with deeper coverage of pipeline-specific concerns.

| Note | Description |
|------|-------------|
| [[fastapi-and-polars]] | FastAPI for building data APIs; Polars for high-performance DataFrame operations |
| [[parquet-files]] | Reading, writing, and partitioning Parquet files with PyArrow and pandas |
| [[python-pipeline-execution]] | Running Python pipelines: subprocess, multiprocessing, async execution patterns |
| [[python-virtual-environments]] | venv, virtualenv, pip, requirements.txt, pyproject.toml, dependency management |
| [[data-formats-and-serialization]] | JSON, CSV, Parquet, Avro, Protobuf, Pickle — reading, writing, and schema evolution |
| [[database-connections]] | Connection string recipes: pyodbc, SQLAlchemy, BigQuery client, Firestore, psycopg2 |

## Comparison Tables

Side-by-side language and tool comparisons.

| Note | Description |
|------|-------------|
| [[sql-python-csharp-transforms]] | Data transformations in SQL, Python, and C# — side-by-side syntax for common operations |
| [[etl-vs-elt]] | ETL vs ELT architectural comparison — when to transform before or after loading |
| [[merge-vs-rebase-vs-squash]] | Git history strategies compared — merge commit, rebase, and squash merge trade-offs |

## All Notebook Notes

**Python:** [[01_Basics]] | [[02_Strings]] | [[03_Control_Flow]] | [[04_Functions]] | [[05_Collections]] | [[06_OOP]] | [[07_Generics_LINQ]] | [[08_ErrorHandling]] | [[09_FileIO_Serialization]] | [[10_DateTimeMathUtils]] | [[11_AsyncConcurrency]] | [[12_Testing]] | [[13_WebAPIs]] | [[14_Database]] | [[15_GCP]] | [[16_DesignPatterns]]

**Pandas vs Polars:** [[01_foundations_io]] | [[02_explore_select_filter]] | [[03_transforms_expressions_chaining]] | [[04_missing_strings_datetime]] | [[05_grouping_windows]] | [[06_combining_reshaping]] | [[07_lazy_performance]] | [[08_types_interop]] | [[09_visualization_sql]] | [[10_project_testing_migration]]

**C#:** [[cs-01_Basics]] | [[cs-02_Strings]] | [[cs-03_Control_Flow]] | [[cs-04_Functions]] | [[cs-05_Collections]] | [[cs-06_OOP]] | [[cs-07_Generics_LINQ]] | [[cs-08_ErrorHandling]] | [[cs-09_FileIO_Serialization]] | [[cs-10_DateTimeMathUtils]] | [[cs-11_AsyncConcurrency]] | [[cs-12_Testing]] | [[cs-13_WebAPIs]] | [[cs-14_Database]] | [[cs-15_GCP]] | [[cs-16_DesignPatterns]]

## Cross-References

- [[sql-python-csharp-transforms]] — Side-by-side data transformations in SQL, Python, and C#
- [[database-connections]] — Connection string recipes for all platforms
- [[rest-api-design-and-consumption]] — REST API patterns (language-agnostic)
- [[data-formats-and-serialization]] — Data serialization in pipeline context
- [[dbt-index]] — dbt uses Python for custom models and macros
