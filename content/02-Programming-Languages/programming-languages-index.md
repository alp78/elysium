---
type: index
category: programming-languages
technology: [python, csharp, dotnet]
tags: [index, programming-languages, python, csharp, dotnet]
aliases: [Programming Languages Index, Language Reference, Python Reference, C# Reference]
keywords: [programming languages, python, csharp, c sharp, dotnet, language reference, code examples, jupyter notebooks, executable examples, side-by-side comparison]
description: "Index for the Programming Languages section — paired Python and C# references covering 16 topics from basics to design patterns, each with executable examples and cell outputs."
related:
  - "[[Dashboard]]"
  - "[[sql-python-csharp-transforms]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Programming Languages

Paired Python and C# references covering 16 topics. Each note was converted from an executed Jupyter notebook with cell outputs preserved — you see both the code and its result. Every Python topic has a C# counterpart covering the same concepts in that language.

## Topic Map

| # | Topic | Python | C# |
|---|-------|--------|-----|
| 01 | Basics (variables, types, operators, I/O) | [[01_Basics\|Python]] | [[01_Basics\|C#]] |
| 02 | Strings (manipulation, formatting, regex) | [[02_Strings\|Python]] | [[02_Strings\|C#]] |
| 03 | Control Flow (if/else, loops, pattern matching) | [[03_Control_Flow\|Python]] | [[03_Control_Flow\|C#]] |
| 04 | Functions (lambdas, closures, decorators/delegates) | [[04_Functions\|Python]] | [[04_Functions\|C#]] |
| 05 | Collections (lists, dicts, sets, LINQ) | [[05_Collections\|Python]] | [[05_Collections\|C#]] |
| 06 | OOP (classes, inheritance, polymorphism) | [[06_OOP\|Python]] | [[06_OOP\|C#]] |
| 07 | Generics and LINQ / Comprehensions | [[07_Generics_LINQ\|Python]] | [[07_Generics_LINQ\|C#]] |
| 08 | Error Handling (exceptions, try/catch) | [[08_ErrorHandling\|Python]] | [[08_ErrorHandling\|C#]] |
| 09 | File I/O and Serialization (JSON, CSV) | [[09_FileIO_Serialization\|Python]] | [[09_FileIO_Serialization\|C#]] |
| 10 | DateTime, Math, and Utilities | [[10_DateTimeMathUtils\|Python]] | [[10_DateTimeMathUtils\|C#]] |
| 11 | Async and Concurrency | [[11_AsyncConcurrency\|Python]] | [[11_AsyncConcurrency\|C#]] |
| 12 | Testing (unit tests, mocking) | [[12_Testing\|Python]] | [[12_Testing\|C#]] |
| 13 | Web APIs (HTTP clients and servers) | [[13_WebAPIs\|Python]] | [[13_WebAPIs\|C#]] |
| 14 | Database Access (SQL, ORM, connections) | [[14_Database\|Python]] | [[14_Database\|C#]] |
| 15 | GCP (BigQuery, GCS, Pub/Sub) | [[15_GCP\|Python]] | [[15_GCP\|C#]] |
| 16 | Design Patterns (singleton, factory, observer) | [[16_DesignPatterns\|Python]] | [[16_DesignPatterns\|C#]] |

## How These Notes Work

Each note contains:
- **Code cells** — the actual source code as fenced code blocks
- **Output cells** — the printed output from running the code (indented text blocks below each code cell)
- **Explanatory markdown** — headings, descriptions, and context between cells

The Python and C# notes for each topic are tightly paired — they cover the same concepts, in the same order, allowing side-by-side comparison across languages.

## Learning Paths

**For Python developers learning C#:**
1. Start with [[01_Basics|C# Basics]] — syntax differences (braces, semicolons, types)
2. [[05_Collections|C# Collections]] — `List<T>` vs `list`, `Dictionary` vs `dict`, LINQ vs comprehensions
3. [[06_OOP|C# OOP]] — interfaces, properties, access modifiers
4. [[11_AsyncConcurrency|C# Async]] — `Task` vs `asyncio`, `async/await` patterns

**For C# developers learning Python:**
1. Start with [[01_Basics|Python Basics]] — dynamic typing, indentation, no semicolons
2. [[04_Functions|Python Functions]] — first-class functions, decorators, generators
3. [[07_Generics_LINQ|Python Comprehensions]] — list/dict/set comprehensions as LINQ equivalent
4. [[14_Database|Python Database]] — pyodbc vs ADO.NET, SQLAlchemy vs Entity Framework

**For data engineers (both languages):**
1. [[09_FileIO_Serialization]] — JSON/CSV handling in both languages
2. [[14_Database]] — SQL Server connections, parameterized queries, ORMs
3. [[15_GCP]] — BigQuery, GCS, Pub/Sub client libraries
4. [[13_WebAPIs]] — Building and consuming REST APIs
5. [[11_AsyncConcurrency]] — Parallel data processing patterns

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

## Cross-References

- [[sql-python-csharp-transforms]] — Side-by-side data transformations in SQL, Python, and C#
- [[database-connections]] — Connection string recipes for all platforms
- [[rest-api-design-and-consumption]] — REST API patterns (language-agnostic)
- [[data-formats-and-serialization]] — Data serialization in pipeline context
