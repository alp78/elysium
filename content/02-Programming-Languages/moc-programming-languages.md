---
title: "MOC: Programming Languages"
tags:
  - moc
  - python
  - csharp
  - programming
---

# MOC: Programming Languages

This map covers the complete Python and C# reference library — 52 pages of executable notebook conversions with cell outputs preserved (you see both the code and its result). Most topics exist as paired notebooks (Python first, then C# equivalent) so you can compare idioms side-by-side. The collection progresses from language fundamentals through data engineering pipelines to cloud-native GCP integration.

## Language Foundations — Syntax, Types, and Core Abstractions

The building blocks of both languages: variables, strings, control flow, functions, collections, OOP, generics, error handling, and standard-library utilities. Each Python page has a C# counterpart covering the same concepts in that language's idiom.

* [[01_py_basics]] — Variables, data types, type conversion, operators, and console I/O in Python. Paired with the C# equivalent below.

* [[01_cs_basics]] — Variables, data types (value vs reference), casting, operators, and Console.WriteLine in C#. Paired with the Python equivalent above.

* [[02_py_strings]] — String creation, slicing, methods, f-string formatting, efficient building with join, and regular expressions in Python.

* [[02_cs_strings]] — String immutability, interpolation, StringBuilder, Span-based slicing, and Regex in C#.

* [[03_py_control_flow]] — if/elif/else, for/while loops, break/continue, iterators, generators, yield, and comprehensions in Python.

* [[03_cs_control_flow]] — if/else, switch expressions, pattern matching, for/foreach/while, and LINQ query syntax in C#.

* [[04_py_functions]] — def, lambda, closures, decorators, *args/**kwargs, type hints, and scope (LEGB rule) in Python.

* [[04_cs_functions]] — Methods, delegates, Func/Action, lambdas, closures, extension methods, and yield-based iterators in C#.

* [[05_py_collections]] — Lists, dictionaries, sets, tuples, deque, Counter, defaultdict, namedtuple, and comprehensions in Python.

* [[05_cs_collections]] — Arrays, List, Dictionary, HashSet, Queue, Stack, immutable collections, and ConcurrentDictionary in C#.

* [[06_py_oop]] — Classes, inheritance, polymorphism, encapsulation, properties, dataclasses, ABC, and Protocol in Python.

* [[06_cs_oop]] — Classes, interfaces, abstract classes, inheritance, properties, records, sealed, and virtual/override in C#.

* [[07_py_generics_linq]] — Duck typing, TypeVar, Generic classes, Protocol, map/filter/reduce, itertools, and functools in Python.

* [[07_cs_generics_linq]] — Generic classes, type constraints, LINQ query and method syntax, deferred execution, and IQueryable in C#.

* [[08_py_errorhandling]] — try/except/else/finally, exception hierarchy, custom exceptions, re-raising, context managers, and logging in Python.

* [[08_cs_errorhandling]] — try/catch/finally, exception hierarchy, custom exceptions, exception filters (when), IDisposable, and the using statement in C#.

* [[11_py_datetimemathutils]] — datetime, timedelta, timezone handling with pytz, math module, random, uuid, and hashlib in Python.

* [[11_cs_datetimemathutils]] — DateTime, DateOnly, TimeOnly, TimeSpan, TimeZoneInfo, Math, Random, Guid, logging, and configuration in C#.

## Data Engineering with Code — Pipelines, Testing, and Architecture

File I/O, serialization formats, async concurrency, advanced parallel pipelines, database access, web APIs, design patterns, performance profiling, testing, and end-to-end functional pipelines. These pages show how to build and validate production data workflows.

* [[09_py_fileio_serialization]] — File reading/writing, JSON, CSV, pickle, pathlib, shutil, and async file I/O with aiofiles in Python.

* [[09_cs_fileio_serialization]] — File/Stream APIs, System.Text.Json, Newtonsoft.Json, CsvHelper, async streams, and memory-mapped files in C#.

* [[10_py_serialization_formats]] — JSON, CSV, Parquet, Avro, Protocol Buffers, MessagePack, Arrow/Feather, and format comparison benchmarks in Python.

* [[10_cs_serialization_formats]] — JSON, CSV, Parquet, Avro, Protocol Buffers, MessagePack, and format comparison benchmarks in C#.

* [[12_py_asyncconcurrency]] — asyncio, async/await, coroutines, tasks, threading, multiprocessing, concurrent.futures, and the GIL in Python.

* [[12_cs_asyncconcurrency]] — async/await, Task, CancellationToken, Parallel, Thread, SemaphoreSlim, Channels, and IAsyncEnumerable in C#.

* [[13_py_advancedpipelines]] — Async generators, parallel API ingestion with rate limiting, semaphore-based batching, subprocess execution, and distributed task queues (Celery, Dask) in Python.

* [[13_cs_advancedpipelines]] — TPL Dataflow (TransformBlock, ActionBlock, BatchBlock), Channel-based pipelines, IAsyncEnumerable for paginated APIs, and cross-process execution in C#.

* [[14_py_testing]] — pytest, unittest, fixtures, mocking with patch, parametrize, coverage, and the testing pyramid for data pipelines in Python.

* [[14_cs_testing]] — xUnit, NUnit, Moq, FluentAssertions, data-driven Theory tests, and the testing pyramid for data pipelines in C#.

* [[15_py_webapis]] — HTTP clients (requests, httpx), REST API concepts, building APIs with FastAPI, and data engineering API patterns in Python.

* [[15_cs_webapis]] — HttpClient, IHttpClientFactory, ASP.NET Core minimal APIs, controllers, middleware, Swagger, and authentication in C#.

* [[16_py_database]] — SQLite, SQL Server with pyodbc, pandas read_sql/to_sql, SQLAlchemy ORM, DuckDB, and querying files with Polars in Python.

* [[16_cs_database]] — SQLite, SQL Server with SqlClient, ODBC provider, Dapper micro-ORM, Entity Framework Core, and DuckDB in C#.

* [[18_py_designpatterns]] — Dependency injection, Singleton, Factory, Observer, Strategy patterns, Pydantic validation, reflection, and project structure in Python.

* [[18_cs_designpatterns]] — Dependency injection with IServiceCollection, Singleton, Factory, Observer, Strategy patterns, DataAnnotations, reflection, and project structure in C#.

* [[19_py_performance_quality]] — timeit, perf_counter, cProfile, memory profiling, Big-O complexity, code smells, type hints, ruff, mypy, and linting in Python.

* [[19_cs_performance_quality]] — Stopwatch, BenchmarkDotNet, GC.GetTotalMemory, Span/stackalloc/ArrayPool, Big-O, LINQ pitfalls, nullable reference types, and Roslyn analyzers in C#.

* [[25_py_functional_pipeline]] — End-to-end medallion pipeline with Polars, Pydantic validation, lineage tracking, SHA-256 tamper detection, Parquet export, FastAPI serving, and Plotly visualization in Python.

* [[25_cs_functional_pipeline]] — End-to-end medallion pipeline with LINQ, FluentValidation, Polly resilience, lineage tracking, Parquet export, and ASP.NET serving in C#.

## GCP Integration — Cloud Security, Data Movement, and Streaming

Google Cloud Platform workflows: security infrastructure setup, encryption and identity operations, data transfer benchmarks, bulk ingestion into managed services, and real-time streaming with WebSocket, SSE, Pub/Sub, and Firestore listeners.

* [[20_py_security_setup]] — Provisions service accounts, KMS keys, Secret Manager secrets, Cloud SQL, Compute Engine, Workload Identity Federation, and demo data. Python-only prerequisite for security operations in both languages.

* [[21_py_security_operations]] — Encryption (KMS, envelope, CMEK/CSEK), certificates, signed URLs, Workload Identity, OAuth/JWT, SSH with paramiko, IAP tunnels, and secure access to BigQuery/Firestore/GCS in Python.

* [[21_cs_security_operations]] — Encryption (KMS, envelope), certificates, ADC authentication, Secret Manager, Cloud SQL SSL, and secure access to BigQuery/Firestore/GCS in C#.

* [[22_py_data_transfer]] — GCS upload/download, VM file copy via SCP/SSH, SQL Server bulk insert, BigQuery load, parallel transfers, compression benchmarks, and interactive throughput charts in Python.

* [[22_cs_data_transfer]] — GCS upload/download, VM file copy, SQL Server bulk insert, BigQuery load, parallel transfers, compression benchmarks, and interactive throughput charts in C#.

* [[23_py_data_ingestion]] — Bulk loading into SQL Server (pyodbc, bcp), BigQuery (load jobs, streaming inserts), and Firestore (batch writes) with performance benchmarks in Python.

* [[23_cs_data_ingestion]] — Bulk loading into SQL Server (SqlBulkCopy, ADO.NET), BigQuery (load jobs), and Firestore (batch writes) with performance benchmarks in C#.

* [[24_py_streaming_realtime]] — WebSocket, Server-Sent Events, Google Cloud Pub/Sub, Firestore on_snapshot listeners, and latency benchmarks comparing all four protocols in Python.

* [[24_cs_streaming_realtime]] — WebSocket (ClientWebSocket), SSE (HttpClient), Pub/Sub, Firestore listeners, and latency benchmarks comparing all four protocols in C#.

* [[17_py_gcp]] — Full medallion pipeline on GCP: yfinance fetch, GCS Bronze upload, BigQuery Silver/Gold transforms, Firestore publishing, Pub/Sub events, Secret Manager, and Cloud Monitoring in Python.

* [[17_cs_gcp]] — Full medallion pipeline on GCP: data fetch, GCS Bronze upload, BigQuery Silver/Gold transforms, Firestore publishing, Pub/Sub events, Secret Manager, and Cloud Monitoring in C#.

## Cross-References

- [[rest-api-design-and-consumption]] — Language-agnostic REST API patterns
- [[moc-dbt]] — dbt uses Python for custom models and macros
