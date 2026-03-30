---
title: "Domain: Language Foundations"
tags:
  - domain
  - programming-languages
---

# Language Foundations

Core programming concepts in Python and C# — from basics and types through OOP, async, and design patterns.

```mermaid
mindmap
  ((Language Foundations))
    (basics, types)
    (strings, regex)
    (control flow)
    (functions, closures)
    (collections)
    (OOP, classes)
    (generics, itertools)
    (error handling)
    (datetime, math)
    (async, concurrency)
    (design patterns)
    (environments, deps)
```

> [!abstract]- Basics, Types, and Operators
>
> - Environment setup and runtime info — [[01_py_basics#Environment Setup|py]] · [[01_cs_basics#Environment Setup|cs]]
> - Console input and output — [[01_py_basics#Console I|py]] · [[01_cs_basics#Console I|cs]]
> - Variables, constants, and data types — [[01_py_basics#Variables, Constants & Data Types|py]] · [[01_cs_basics#Variables, Constants & Data Types|cs]]
> - Arithmetic, comparison, logical, and bitwise operators — [[01_py_basics#Operators|py]] · [[01_cs_basics#Operators|cs]]
> - Magic methods and operator overloading — [[01_py_basics#Magic Methods (Dunder Methods)|py]] · [[01_cs_basics#Special Methods & Operator Overloading|cs]]

> [!abstract]- Strings and Regular Expressions
>
> - String creation, immutability, and raw strings — [[02_py_strings#String Creation & Basics|py]] · [[02_cs_strings#String Creation & Basics|cs]]
> - Indexing, slicing, and substrings — [[02_py_strings#Indexing & Slicing|py]] · [[02_cs_strings#Indexing & Slicing|cs]]
> - String methods for cleaning and transformation — [[02_py_strings#String Methods|py]] · [[02_cs_strings#String Methods|cs]]
> - Formatting and interpolation — [[02_py_strings#String Formatting|py]] · [[02_cs_strings#String Formatting|cs]]
> - Efficient string building — [[02_py_strings#Efficient String Building|py]] · [[02_cs_strings#Efficient String Building (StringBuilder)|cs]]
> - Regular expressions — [[02_py_strings#Regular Expressions|py]] · [[02_cs_strings#Regular Expressions|cs]]

> [!abstract]- Control Flow
>
> - Conditionals and branching — [[03_py_control_flow#Conditional Statements|py]] · [[03_cs_control_flow#Conditional Statements|cs]]
> - Loops and iteration — [[03_py_control_flow#Loops|py]] · [[03_cs_control_flow#Loops|cs]]
> - Break, continue, and loop control — [[03_py_control_flow#Loop Control (break, continue, pass)|py]] · [[03_cs_control_flow#Loop Control|cs]]
> - Iterators and generators — [[03_py_control_flow#Iterators & Generators (yield)|py]] · [[03_cs_control_flow#Iterators & Generators|cs]]
> - Comprehensions, LINQ, and functional tools — [[03_py_control_flow#Comprehensions & Functional Tools|py]] · [[03_cs_control_flow#LINQ & Functional Equivalents|cs]]

> [!abstract]- Functions and Closures
>
> - Function basics and signatures — [[04_py_functions#Function Basics|py]] · [[04_cs_functions#Function Basics|cs]]
> - Parameters and argument passing — [[04_py_functions#Parameters|py]] · [[04_cs_functions#Parameters|cs]]
> - Lambda expressions — [[04_py_functions#Lambda Expressions|py]] · [[04_cs_functions#Lambda Expressions|cs]]
> - Closures and variable scope — [[04_py_functions#Closures & Scope|py]] · [[04_cs_functions#Closures & Scope|cs]]
> - Decorators and delegates — [[04_py_functions#Decorators|py]] · [[04_cs_functions#Delegates & Events|cs]]

> [!abstract]- Collections
>
> - Lists and dynamic arrays — [[05_py_collections#Lists (Dynamic Arrays)|py]] · [[05_cs_collections#Arrays and Lists|cs]]
> - Dictionaries and hash maps — [[05_py_collections#Dictionaries|py]] · [[05_cs_collections#Dictionaries|cs]]
> - Sets and uniqueness — [[05_py_collections#Sets|py]] · [[05_cs_collections#Sets|cs]]
> - Tuples and enums — [[05_py_collections#Tuples & Enums|py]] · [[05_cs_collections#Tuples and Enums|cs]]
> - Stacks, queues, and deques — [[05_py_collections#Stacks, Queues & Deques|py]] · [[05_cs_collections#Stacks, Queues, and Linked Lists|cs]]

> [!abstract]- Object-Oriented Programming
>
> - Classes and objects — [[06_py_oop#Classes & Objects|py]] · [[06_cs_oop#Classes & Objects|cs]]
> - Inheritance and polymorphism — [[06_py_oop#Inheritance & Polymorphism|py]] · [[06_cs_oop#Inheritance & Polymorphism|cs]]
> - Abstract classes and interfaces — [[06_py_oop#Abstract Classes & Interfaces|py]] · [[06_cs_oop#Abstract Classes & Interfaces|cs]]
> - Encapsulation and access control — [[06_py_oop#Encapsulation & Access Control|py]] · [[06_cs_oop#Encapsulation & Access Modifiers|cs]]
> - Dataclasses and records — [[06_py_oop#Dataclasses & Records|py]] · [[06_cs_oop#Records & Init-Only Properties|cs]]

> [!abstract]- Generics and Itertools/LINQ
>
> - Generic types and type constraints — [[07_py_generics_linq#Generics|py]] · [[07_cs_generics_linq#Generics|cs]]
> - Analytics with Pandas/Polars vs LINQ — [[07_py_generics_linq#Pandas vs Polars Analytics|py]] · [[07_cs_generics_linq#Advanced LINQ|cs]]
> - Aggregations — [[07_py_generics_linq#Aggregations|py]] · [[07_cs_generics_linq#Aggregations|cs]]
> - Window functions — [[07_py_generics_linq#Window Functions|py]] · [[07_cs_generics_linq#Window Functions|cs]]
> - Joins — [[07_py_generics_linq#Joins|py]] · [[07_cs_generics_linq#Joins|cs]]

> [!abstract]- Error Handling
>
> - Try, catch, and finally — [[08_py_errorhandling#try|py]] · [[08_cs_errorhandling#try|cs]]
> - Exception types and hierarchy — [[08_py_errorhandling#Exception Types and Hierarchy|py]] · [[08_cs_errorhandling#Exception Types and Hierarchy|cs]]
> - Custom exceptions — [[08_py_errorhandling#Custom Exceptions|py]] · [[08_cs_errorhandling#Custom Exceptions|cs]]
> - Resource cleanup and context managers — [[08_py_errorhandling#Context Managers — with statement|py]] · [[08_cs_errorhandling#Resource Cleanup — using and IDisposable|cs]]
> - Data engineering resilience patterns — [[08_py_errorhandling#Data Engineering — error accumulation and resilience patterns|py]] · [[08_cs_errorhandling#Data Engineering — error accumulation and resilience patterns|cs]]

> [!abstract]- DateTime, Math, and Utilities
>
> - Date and time handling — [[11_py_datetimemathutils#Date and Time|py]] · [[11_cs_datetimemathutils#Date and Time|cs]]
> - Math and random — [[11_py_datetimemathutils#Math and Random|py]] · [[11_cs_datetimemathutils#Math and Random|cs]]
> - Logging — [[11_py_datetimemathutils#Logging|py]] · [[11_cs_datetimemathutils#Logging|cs]]
> - Configuration and environment variables — [[11_py_datetimemathutils#Configuration and Environment Variables|py]] · [[11_cs_datetimemathutils#Configuration and Environment Variables|cs]]

> [!abstract]- Async and Concurrency
>
> - Async and await fundamentals — [[12_py_asyncconcurrency#Async and Await|py]] · [[12_cs_asyncconcurrency#Async and Await|cs]]
> - Tasks and parallelism — [[12_py_asyncconcurrency#Tasks and Parallelism|py]] · [[12_cs_asyncconcurrency#Tasks and Parallelism|cs]]
> - Threading and concurrency — [[12_py_asyncconcurrency#Threading and Concurrency|py]] · [[12_cs_asyncconcurrency#Threading and Concurrency|cs]]

> [!abstract]- Design Patterns
>
> - Dependency injection — [[18_py_designpatterns#Dependency Injection|py]] · [[18_cs_designpatterns#Dependency Injection|cs]]
> - Design patterns (Singleton, Factory, Observer, Strategy) — [[18_py_designpatterns#Design Patterns|py]] · [[18_cs_designpatterns#Design Patterns|cs]]
> - Data validation — [[18_py_designpatterns#Data Validation|py]] · [[18_cs_designpatterns#Data Validation|cs]]
> - Reflection and introspection — [[18_py_designpatterns#Reflection|py]] · [[18_cs_designpatterns#Reflection|cs]]
> - Project structure and best practices — [[18_py_designpatterns#Project Structure & Best Practices|py]] · [[18_cs_designpatterns#Project Structure & Best Practices|cs]]

> [!abstract]- Environments and Dependencies
>
> - Creating virtual environments — [[26_py_environments#venv — create and activate virtual environments|py]] · [[26_cs_environments#dotnet new — create projects and solution files|cs]]
> - Installing packages — [[26_py_environments#pip — install and manage packages|py]] · [[26_cs_environments#dotnet add package — install NuGet packages|cs]]
> - Pinning and freezing — [[26_py_environments#pip freeze — pin dependencies for reproducibility|py]] · [[26_cs_environments#Pinning and Locking Dependencies|cs]]
> - Docker patterns — [[26_py_environments#Docker — Python environments in containers|py]] · [[26_cs_environments#Docker — multi-stage builds for .NET|cs]]
> - CI/CD setup — [[26_py_environments#GitHub Actions — Python in CI|py]] · [[26_cs_environments#GitHub Actions — .NET in CI|cs]]
> - Anti-patterns — [[26_py_environments#Anti-Patterns and Common Mistakes|py]] · [[26_cs_environments#Anti-Patterns and Common Mistakes|cs]]
