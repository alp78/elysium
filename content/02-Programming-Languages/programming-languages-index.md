---
type: index
category: programming-languages
technology: [python, csharp, dotnet]
tags: [python, csharp]
aliases: [Programming Languages Index, Language Reference, Python Reference, C# Reference]
keywords: [programming languages, python, csharp, c sharp, dotnet, language reference, code examples, jupyter notebooks, executable examples, side-by-side comparison]
description: "Index for the Programming Languages section — paired Python and C# references covering 18 topics from basics to design patterns, each with executable examples and cell outputs."
related:
  - "[[index|Elysium]]"
  - "[[sql-python-csharp-transforms]]"
  - "[[pandas-polars-index]]"
created: 2026-03-22
updated: 2026-03-23
status: complete
---

# Programming Languages

Paired Python and C# references covering 18 topics. Each note was converted from an executed Jupyter notebook with cell outputs preserved — you see both the code and its result. Every Python topic has a C# counterpart covering the same concepts in that language.

## Topic Map

| # | Topic | Python | C\# |
|---|-------|--------|------|
| 01 | Basics (variables, types, operators, I/O) | [[01_py_basics|Python]] | [[01_cs_basics|C#]] |
| 02 | Strings (manipulation, formatting, regex) | [[02_py_strings|Python]] | [[02_cs_strings|C#]] |
| 03 | Control Flow (if/else, loops, pattern matching) | [[03_py_control_flow|Python]] | [[03_cs_control_flow|C#]] |
| 04 | Functions (lambdas, closures, decorators/delegates) | [[04_py_functions|Python]] | [[04_cs_functions|C#]] |
| 05 | Collections (lists, dicts, sets, LINQ) | [[05_py_collections|Python]] | [[05_cs_collections|C#]] |
| 06 | OOP (classes, inheritance, polymorphism) | [[06_py_oop|Python]] | [[06_cs_oop|C#]] |
| 07 | Generics and LINQ / Comprehensions | [[07_py_generics_linq|Python]] | [[07_cs_generics_linq|C#]] |
| 08 | Error Handling (exceptions, try/catch) | [[08_py_errorhandling|Python]] | [[08_cs_errorhandling|C#]] |
| 09 | File I/O and Serialization (JSON, CSV) | [[09_py_fileio_serialization|Python]] | [[09_cs_fileio_serialization|C#]] |
| 10 | DateTime, Math, and Utilities | [[10_py_datetimemathutils|Python]] | [[10_cs_datetimemathutils|C#]] |
| 11 | Async and Concurrency | [[11_py_asyncconcurrency|Python]] | [[11_cs_asyncconcurrency|C#]] |
| 12 | Advanced Parallel Pipelines (Dataflow, channels, rate limiting) | [[12_py_advancedpipelines|Python]] | [[12_cs_advancedpipelines|C#]] |
| 13 | Testing (unit tests, mocking) | [[13_py_testing|Python]] | [[13_cs_testing|C#]] |
| 14 | Web APIs (HTTP clients and servers) | [[14_py_webapis|Python]] | [[14_cs_webapis|C#]] |
| 15 | Database Access (SQL, ORM, connections) | [[15_py_database|Python]] | [[15_cs_database|C#]] |
| 16 | GCP (BigQuery, GCS, Pub/Sub) | [[16_py_gcp|Python]] | [[16_cs_gcp|C#]] |
| 17 | Design Patterns (singleton, factory, observer) | [[17_py_designpatterns|Python]] | [[17_cs_designpatterns|C#]] |
| 18 | Performance & Code Quality (profiling, Big-O, linting) | [[18_py_performance_quality|Python]] | [[18_cs_performance_quality|C#]] |

## How These Notes Work

Each note contains:
- **Code cells** — the actual source code as fenced code blocks
- **Output cells** — the printed output from running the code (indented text blocks below each code cell)
- **Explanatory markdown** — headings, descriptions, and context between cells

The Python and C# notes for each topic are tightly paired — they cover the same concepts, in the same order, allowing side-by-side comparison across languages.

## Comparison Tables

Side-by-side language and tool comparisons.

| Note | Description |
|------|-------------|
| [[sql-python-csharp-transforms]] | Data transformations in SQL, Python, and C# — side-by-side syntax for common operations |
| [[etl-vs-elt]] | ETL vs ELT architectural comparison — when to transform before or after loading |
| [[merge-vs-rebase-vs-squash]] | Git history strategies compared — merge commit, rebase, and squash merge trade-offs |

## All Notebook Notes

**Python:** [[01_py_basics]] | [[02_py_strings]] | [[03_py_control_flow]] | [[04_py_functions]] | [[05_py_collections]] | [[06_py_oop]] | [[07_py_generics_linq]] | [[08_py_errorhandling]] | [[09_py_fileio_serialization]] | [[10_py_datetimemathutils]] | [[11_py_asyncconcurrency]] | [[12_py_advancedpipelines]] | [[13_py_testing]] | [[14_py_webapis]] | [[15_py_database]] | [[16_py_gcp]] | [[17_py_designpatterns]] | [[18_py_performance_quality]]

**C#:** [[01_cs_basics]] | [[02_cs_strings]] | [[03_cs_control_flow]] | [[04_cs_functions]] | [[05_cs_collections]] | [[06_cs_oop]] | [[07_cs_generics_linq]] | [[08_cs_errorhandling]] | [[09_cs_fileio_serialization]] | [[10_cs_datetimemathutils]] | [[11_cs_asyncconcurrency]] | [[12_cs_advancedpipelines]] | [[13_cs_testing]] | [[14_cs_webapis]] | [[15_cs_database]] | [[16_cs_gcp]] | [[17_cs_designpatterns]] | [[18_cs_performance_quality]]

## Cross-References

- [[sql-python-csharp-transforms]] — Side-by-side data transformations in SQL, Python, and C#
- [[rest-api-design-and-consumption]] — REST API patterns (language-agnostic)
- [[dbt-index]] — dbt uses Python for custom models and macros
