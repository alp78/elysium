---
type: index
category: programming-languages
technology: [python, csharp, dotnet]
tags: [python, csharp]
aliases: [Programming Languages Index, Language Reference, Python Reference, C# Reference]
keywords: [programming languages, python, csharp, c sharp, dotnet, language reference, code examples, jupyter notebooks, executable examples, side-by-side comparison]
description: "Index for the Programming Languages section — paired Python and C# references covering 24 topics from basics to security operations, each with executable examples and cell outputs."
related:
  - "[[index|Elysium]]"
  - "[[sql-python-csharp-transforms]]"
  - "[[dataframes-index]]"
created: 2026-03-22
updated: 2026-03-23
status: complete
---

# Programming Languages

Paired Python and C# references covering 24 topics. Each note was converted from an executed Jupyter notebook with cell outputs preserved — you see both the code and its result. Every Python topic has a C# counterpart covering the same concepts in that language.

## Topic Map

| # | Topic | Python | C\# |
|---|-------|--------|------|
| 01 | Basics (variables, types, operators, I/O) | [[01_py_basics\|Basics]] | [[01_cs_basics\|Basics]] |
| 02 | Strings (manipulation, formatting, regex) | [[02_py_strings\|Strings]] | [[02_cs_strings\|Strings]] |
| 03 | Control Flow (if/else, loops, pattern matching) | [[03_py_control_flow\|Control Flow]] | [[03_cs_control_flow\|Control Flow]] |
| 04 | Functions (lambdas, closures, decorators/delegates) | [[04_py_functions\|Functions]] | [[04_cs_functions\|Functions]] |
| 05 | Collections (lists, dicts, sets, LINQ) | [[05_py_collections\|Collections]] | [[05_cs_collections\|Collections]] |
| 06 | OOP (classes, inheritance, polymorphism) | [[06_py_oop\|OOP]] | [[06_cs_oop\|OOP]] |
| 07 | Generics and LINQ / Comprehensions | [[07_py_generics_linq\|Generics & LINQ]] | [[07_cs_generics_linq\|Generics & LINQ]] |
| 08 | Error Handling (exceptions, try/catch) | [[08_py_errorhandling\|Error Handling]] | [[08_cs_errorhandling\|Error Handling]] |
| 09 | File I/O and Serialization (JSON, CSV) | [[09_py_fileio_serialization\|File I/O]] | [[09_cs_fileio_serialization\|File I/O]] |
| 10 | Serialization Formats (Parquet, Avro, Protobuf, MessagePack) | [[10_py_serialization_formats\|Serialization]] | [[10_cs_serialization_formats\|Serialization]] |
| 11 | DateTime, Math, and Utilities | [[11_py_datetimemathutils\|DateTime & Math]] | [[11_cs_datetimemathutils\|DateTime & Math]] |
| 12 | Async and Concurrency | [[12_py_asyncconcurrency\|Async]] | [[12_cs_asyncconcurrency\|Async]] |
| 13 | Advanced Parallel Pipelines (Dataflow, channels, rate limiting) | [[13_py_advancedpipelines\|Pipelines]] | [[13_cs_advancedpipelines\|Pipelines]] |
| 14 | Testing (unit tests, mocking) | [[14_py_testing\|Testing]] | [[14_cs_testing\|Testing]] |
| 15 | Web APIs (HTTP clients and servers) | [[15_py_webapis\|Web APIs]] | [[15_cs_webapis\|Web APIs]] |
| 16 | Database Access (SQL, ORM, connections) | [[16_py_database\|Database]] | [[16_cs_database\|Database]] |
| 17 | GCP (BigQuery, GCS, Pub/Sub) | [[17_py_gcp\|GCP]] | [[17_cs_gcp\|GCP]] |
| 18 | Design Patterns (singleton, factory, observer) | [[18_py_designpatterns\|Design Patterns]] | [[18_cs_designpatterns\|Design Patterns]] |
| 19 | Performance & Code Quality (profiling, Big-O, linting) | [[19_py_performance_quality\|Performance]] | [[19_cs_performance_quality\|Performance]] |
| 20 | Security Setup (GCP infrastructure, KMS, secrets, WIF) | [[20_py_security_setup\|Security Setup]] | — |
| 21 | Security Operations (encryption, certificates, identity) | [[21_py_security_operations\|Security Ops]] | [[21_cs_security_operations\|Security Ops]] |
| 22 | Data Transfer (GCS, SQL Server, BigQuery benchmarks) | [[22_py_data_transfer\|Data Transfer]] | [[22_cs_data_transfer\|Data Transfer]] |
| 23 | Data Ingestion (bulk load SQL Server, BigQuery, Firestore) | [[23_py_data_ingestion\|Data Ingestion]] | [[23_cs_data_ingestion\|Data Ingestion]] |
| 24 | Streaming & Real-Time (WebSocket, SSE, Pub/Sub, Firestore) | [[24_py_streaming_realtime\|Streaming]] | [[24_cs_streaming_realtime\|Streaming]] |
| 25 | Functional Data Pipeline (Medallion, Pydantic, FastAPI, Airflow) | [[25_py_functional_pipeline\|Pipeline]] | — |

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

**Python:** [[01_py_basics]] | [[02_py_strings]] | [[03_py_control_flow]] | [[04_py_functions]] | [[05_py_collections]] | [[06_py_oop]] | [[07_py_generics_linq]] | [[08_py_errorhandling]] | [[09_py_fileio_serialization]] | [[10_py_serialization_formats]] | [[11_py_datetimemathutils]] | [[12_py_asyncconcurrency]] | [[13_py_advancedpipelines]] | [[14_py_testing]] | [[15_py_webapis]] | [[16_py_database]] | [[17_py_gcp]] | [[18_py_designpatterns]] | [[19_py_performance_quality]] | [[20_py_security_setup]] | [[21_py_security_operations]] | [[22_py_data_transfer]] | [[23_py_data_ingestion]] | [[24_py_streaming_realtime]]

**C#:** [[01_cs_basics]] | [[02_cs_strings]] | [[03_cs_control_flow]] | [[04_cs_functions]] | [[05_cs_collections]] | [[06_cs_oop]] | [[07_cs_generics_linq]] | [[08_cs_errorhandling]] | [[09_cs_fileio_serialization]] | [[10_cs_serialization_formats]] | [[11_cs_datetimemathutils]] | [[12_cs_asyncconcurrency]] | [[13_cs_advancedpipelines]] | [[14_cs_testing]] | [[15_cs_webapis]] | [[16_cs_database]] | [[17_cs_gcp]] | [[18_cs_designpatterns]] | [[19_cs_performance_quality]] | [[21_cs_security_operations]] | [[22_cs_data_transfer]] | [[23_cs_data_ingestion]] | [[24_cs_streaming_realtime]]

## Cross-References

- [[sql-python-csharp-transforms]] — Side-by-side data transformations in SQL, Python, and C#
- [[rest-api-design-and-consumption]] — REST API patterns (language-agnostic)
- [[dbt-index]] — dbt uses Python for custom models and macros
