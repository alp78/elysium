---
title: "07 - Generics & Functional Data Processing - Python"
tags: [python]
aliases: [generics, LINQ, type parameters, generic collections, comprehensions, functional programming]
description: "Python generics and functional data processing reference with executable examples and cell outputs — covers TypeVar, Generic classes, Protocol, functional tools, and itertools. See [07-cs-generics-linq](https://alp78.github.io/elysium/02-Programming-Languages/02-CSharp/07-cs-generics-linq) for the C# equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Generics & Functional Data Processing - Python

> [!quote]
> "All non-trivial abstractions, to some degree, are leaky."
>
> — **Joel Spolsky**, *The Law of Leaky Abstractions*, blog post (2002)

> [!abstract]- Summary
>
> **Generics**
> - Python's duck typing makes functions naturally generic — any object with the right methods works without type declarations or generic syntax.
> - `TypeVar` declares a generic type variable (`T = TypeVar('T')`); resolved by the static checker at each call site, erased at runtime.
> - `Generic[T]` as a base class enables parameterized containers (`Stack[int]`, `Repository[Trade]`); mypy tracks the inner type through operations.
> - Bounded type variables (`TypeVar('T', bound=Comparable)`) restrict `T` to subtypes of a given class, enabling method calls on `T` that are only safe for that bound.
> - `Protocol` defines structural interfaces: any class with the required methods satisfies the protocol without inheritance; add `@runtime_checkable` to enable `isinstance()` checks.
> - Built-in generic hints: `list[int]`, `dict[str, int]`, `tuple[int, str]`, `Optional[str]`, `Callable[[int], bool]` — no import needed in Python 3.9+.
>
> **Functional Data Processing**
> - List/dict/set comprehensions are Python's primary replacement for C# LINQ `Select`/`Where`; generator expressions (`()`) are the lazy, memory-efficient variant.
> - `map(func, iter)` transforms, `filter(pred, iter)` selects, `functools.reduce(func, iter)` accumulates — all return lazy iterators; wrap in `list()` to materialise.
> - `itertools.groupby` groups consecutive equal elements after a mandatory pre-sort; yields `(key, group_iterator)` pairs consumed once.
> - `zip` pairs elements from parallel iterables positionally, stopping at the shortest — equivalent to C# `Zip`.
> - Nested comprehensions (`[x for outer in col for x in outer]`) replace C# `SelectMany`; `set(...)` deduplicates.
> - Dictionary lookups replace C# `Join`; `defaultdict(list)` handles left-join fan-out without key-presence checks.
>
> **Pandas vs Polars Analytics**
> - Both libraries are demonstrated against live SQL Server data: `silver.eurostoxx50_ohlcv` (66 K rows, 50 symbols) and `gold.scores_daily` (466 rows).
> - Operations shown side-by-side: row/column subsetting, filter, groupby+aggregate, join, window functions, sort.
> - Pandas: mutable, row-indexed, NumPy-backed; `.iloc[]` / `.loc[]` / double-bracket column selection; `groupby().agg()`; `merge()`; `transform()` for window results.
> - Polars: immutable, Rust-backed, Apache Arrow columnar; `slice()` / `select()` / `filter()`; `group_by().agg()`; `join()`; `over()` for window expressions; lazy mode via `.lazy()` + `.collect()`.
> - Comparison matrix: Polars 10–100× faster on large datasets; 2–5× less RAM via Arrow; no row index; lazy plan applies predicate/projection pushdown automatically.

> [!note]- Glossary
>
> **`TypeVar`**
> - A placeholder for a type that the static checker (mypy, pyright) resolves at each call site: `T = TypeVar('T')`.
> - Enables writing functions and classes that work on any type while retaining full type-checker coverage across the call graph.
>
> > [!info] Runtime erasure
> >
> > `TypeVar` is a development-time construct only. The interpreter ignores it at runtime — it provides no enforcement, no dispatch, and no overhead. All checking is performed by mypy or pyright during CI or IDE analysis.
>
>  ---
>
> **`Generic[T]`**
> - Base class for parameterised classes: `class Stack(Generic[T])` tells the type checker to track the inner type `T` through every method.
> - Used for custom container classes and typed wrappers; when built-in containers (`list`, `dict`) suffice, no custom class is needed.
>
> > [!warning] Missing `Generic[T]` inheritance
> >
> > If you omit `Generic[T]`, the class works at runtime but mypy cannot track the inner type — you lose all type-safety benefits for callers.
> >
> > > [!success] Correct pattern
> > >
> > > Always inherit: `class Stack(Generic[T]):` and annotate the internal storage as `list[T]`.
>
>  ---
>
> **`bound` (TypeVar bound)**
> - `TypeVar('T', bound=SomeClass)` restricts `T` to subtypes of `SomeClass`, enabling method calls on `T` that are only safe for that type.
> - Essential when the generic function must call a method (e.g., `__lt__` for sorting, `.close()` for resources) that is not defined on arbitrary objects.
>
> > [!tip] `bound` vs constrained TypeVar
> >
> > `bound=X` accepts any subtype of X. `TypeVar('T', X, Y)` accepts *exactly* X or Y — nothing else, including subtypes of X. Use `bound` for "at least this interface"; use constrained form only when the set of valid types is fixed.
>
>  ---
>
> **`Protocol`**
> - Structural typing interface from `typing`: any class with the required method signatures satisfies the protocol without explicit inheritance.
> - Defines contracts for duck-typed code that mypy can verify statically — the Python equivalent of C# interface checking without the inheritance overhead.
>
> > [!warning] Missing `@runtime_checkable`
> >
> > Without `@runtime_checkable`, `isinstance(obj, MyProtocol)` raises `TypeError` at runtime. The decorator must be applied explicitly.
> >
> > > [!success] Add the decorator when runtime checks are needed
> > >
> > > `@runtime_checkable` on the Protocol class enables `isinstance()` checks while preserving static verification.
>
>  ---
>
> **duck typing**
> - Python's default polymorphism model: if an object has the right methods and attributes, it works — no base class, interface, or generic declaration required.
> - Most Python code is naturally generic through duck typing; `TypeVar` and `Generic` add optional static-analysis safety on top without changing this behaviour.
>
> > [!tip] Avoid over-constraining with `isinstance()`
> >
> > Adding `isinstance()` guards defeats duck typing's flexibility. Prefer structural checks (try/except `AttributeError`) or Protocol annotations in signatures.
>
>  ---
>
> **comprehension**
> - Concise syntax for building collections in a single expression: `[expr for x in iter if cond]` (list), `{k: v for ...}` (dict), `{x for ...}` (set).
> - Python's primary replacement for C# LINQ `Select`/`Where` chains; generally faster than equivalent `for` loops due to CPython bytecode optimisation.
>
> > [!warning] Nested comprehensions and readability
> >
> > Beyond two levels of nesting, comprehensions become difficult to read and debug. Prefer explicit `for` loops or `itertools` combinators for complex multi-level logic.
>
>  ---
>
> **generator expression**
> - Lazy comprehension using `()` instead of `[]`: `(x*2 for x in items)`. Yields items one at a time without building the full list in memory.
> - Essential for processing large datasets — a generator of 10 M rows uses constant memory regardless of the dataset size.
>
> > [!warning] Generators are single-pass
> >
> > Once a generator is exhausted it yields nothing on re-iteration. Wrap with `list()` if multiple passes are needed: `data = list(gen_expr)`.
>
>  ---
>
> **`map` / `filter` / `reduce`**
> - Functional built-ins: `map(func, iter)` applies a function to every element, `filter(pred, iter)` keeps elements where the predicate is `True`, `functools.reduce(func, iter)` folds the sequence into a single value left-to-right.
> - Python's closest equivalents to C# LINQ method-syntax chains (`Select`, `Where`, `Aggregate`).
>
> > [!info] Lazy iterators — materialise explicitly
> >
> > `map()` and `filter()` return iterator objects, not lists. Wrap in `list()` to force evaluation: `list(map(str, nums))`. `reduce` is in `functools` (not a built-in since Python 3).
>
>  ---
>
> **`itertools`**
> - Standard library module with efficient iterator combinators: `groupby`, `chain`, `islice`, `product`, `combinations`, `permutations`, `repeat`, `cycle`.
> - Enables advanced iteration patterns — grouping, windowing, Cartesian products, infinite sequences — without loading data into memory.
>
> > [!warning] `itertools.groupby` requires pre-sorted input
> >
> > `groupby` groups *consecutive* equal elements, not all matching elements across the sequence. Always sort by the grouping key first: `sorted(data, key=lambda x: x['dept'])`. Without sorting, the same key can appear in multiple non-adjacent groups.
>
>  ---
>
> **pandas**
> - DataFrame library for tabular data analysis: mutable, row-indexed, NumPy-backed, with a massive ecosystem (scikit-learn, matplotlib, statsmodels, SQLAlchemy integration).
> - The standard tool for data exploration, notebooks, and existing Python analytics pipelines; the dominant library in production data engineering as of 2025.
>
> > [!warning] `SettingWithCopyWarning` — view vs copy ambiguity
> >
> > Modifying a column on a DataFrame slice may silently modify only a copy, not the original. Use `.copy()` to force a new DataFrame, or `.loc[row_mask, col]` for in-place assignment. The warning signals that pandas cannot determine whether the slice is a view or copy.
>
>  ---
>
> **Polars**
> - High-performance DataFrame library: immutable, Rust-backed, lazy-by-default, Apache Arrow columnar format; no row index.
> - 10–100× faster than pandas for large datasets; native lazy execution with automatic predicate pushdown and projection pushdown; 2–5× less RAM via Arrow columnar storage.
>
> > [!info] No `.loc[]` — use `.filter()` instead
> >
> > Polars has no row-label index. Label-based row selection with `.loc[]` does not exist. Use `.filter(pl.col('symbol') == 'ASML.AS')` for conditional row selection.
>
>  ---
>
> **lazy evaluation (Polars)**
> - Polars builds a logical query plan without executing it when the API is called in lazy mode (`.lazy()`); `.collect()` triggers optimised execution.
> - Predicate pushdown, projection pushdown, and multi-threaded parallelism are applied automatically at `.collect()` time — operations that would be expensive in eager mode become cheap.
>
> > [!warning] Forgetting `.collect()`
> >
> > A `LazyFrame` is not a `DataFrame`. Printing a `LazyFrame` shows the plan, not the data. All downstream operations that expect a `DataFrame` will fail until `.collect()` is called.
>
> > [!success] Always terminate the lazy chain with `.collect()`
> >
> > Call `.collect()` at the end of every lazy chain when a `DataFrame` is needed: `df = lf.filter(...).group_by(...).agg(...).collect()`. Use `.lazy()` / `.collect()` as the outer boundary and keep all transformations in between lazy for automatic query optimization.
>
>  ---
>
> **Apache Arrow**
> - Columnar in-memory data format used by Polars as its internal storage layer. Enables zero-copy reads between Arrow-compatible libraries and efficient Parquet/IPC I/O.
> - Columnar layout means analytical queries (aggregations, filters on one column) scan only the required columns — 2–5× less RAM and better cache locality than row-oriented storage.
>
> > [!info] Arrow is a format, not a user-facing API
> >
> > Polars uses Arrow internally; users interact with Polars DataFrames and Series, not Arrow arrays directly. Arrow becomes relevant when exchanging data with other libraries (PyArrow, DuckDB, Hugging Face Datasets) via zero-copy interop.

Python's duck typing makes most code naturally generic — any iterable, any callable, any object with the right methods just works. Type hints with `TypeVar` and `Generic` add static analysis without changing runtime behavior, bridging the gap to C#-style type safety for library APIs and complex codebases. For data processing, Python replaces C#'s LINQ with built-in functional tools (`map`, `filter`, `zip`, `itertools.groupby`, comprehensions) and the pandas/Polars DataFrame libraries for analytical workloads. 

```python
from typing import TypeVar, Generic, Optional
from itertools import groupby
from collections import defaultdict
from functools import reduce
import pandas as pd
import numpy as np
import pyodbc
import polars as pl
```

## Generics

Python's type system is fundamentally different from C#'s — duck typing means any object with the right interface already works without generic declarations. The `typing` module adds optional type hints that static analysis tools (mypy, pyright) check at development time, but the interpreter ignores them at runtime. `TypeVar` declares generic type variables, `Generic[T]` enables parameterized classes, and `Protocol` defines structural subtyping for duck-typed interfaces.

### Python | Generics | duck typing and type hints

Python functions are inherently generic through duck typing. Type hints with `TypeVar` and `Generic` add compile-time-like safety for IDE tooling and CI checks without changing runtime behavior.

#### Duck typing — no generics needed

Python's dynamic typing means functions work on any iterable — list, tuple, string, set, generator — without type declarations. This is "duck typing": if it quacks like a duck, it's a duck. Simpler than C#/Java generics for most use cases. For public library APIs, add type hints for documentation and type checking.

```python
def first_element(items):
    """Works with ANY iterable — list, tuple, string, set..."""
    for item in items:
        return item
    return None

first_element([1, 2, 3])
first_element('hello')
first_element((10, 20))
```

```text
1
string: h
10
```

#### TypeVar — generic type hints

```python
T = TypeVar("T")

def first(items: list[T]) -> Optional[T]:
    return items[0] if items else None

result_int: Optional[int] = first([1, 2, 3])
result_str: Optional[str] = first(["a", "b", "c"])
print(f"int: {result_int}, str: {result_str}")

Number = TypeVar("Number", int, float)

def add(a: Number, b: Number) -> Number:
    return a + b

add(3, 4)
add(3.5, 4.5)
# add("a", "b")  # type checker flags this — Python still runs it
```

```text
int: 1, str: a
7
float: 8.0
```

#### Generic class — Generic[T]

Inherit from `Generic[T]` so the type checker tracks what's inside. Use for custom container classes and typed wrappers — when built-in containers (`list`, `dict`) suffice, no custom class is needed. Runtime `isinstance` checks on generic types are not supported (type erasure).

```python
class Stack(Generic[T]):
    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()

    def peek(self) -> T:
        return self._items[-1]

    def __len__(self) -> int:
        return len(self._items)

    def __repr__(self) -> str:
        return f"Stack({self._items})"

int_stack: Stack[int] = Stack()
int_stack.push(1)
int_stack.push(2)
int_stack.push(3)
int_stack
int_stack.pop()

str_stack: Stack[str] = Stack()
str_stack.push("hello")
str_stack.push("world")
str_stack
```

```text
Stack([1, 2, 3])
3
Stack(['hello', 'world'])
```

#### Built-in generic type hints — list[int], dict[str, T], Optional

| Type hint | Meaning |
|---|---|
| `list[int]` | Typed list |
| `dict[str, int]` | Typed dictionary |
| `set[str]` | Typed set |
| `tuple[int, str]` | Typed tuple |
| `Optional[str]` | `str` or `None` |
| `Callable[\[int], bool]` | Function signature |

## Functional Data Processing

Python's built-in functional tools — `map`, `filter`, `zip`, comprehensions, `itertools.groupby`, and `functools.reduce` — provide the same pipeline semantics as C#'s LINQ without a separate query language. These operate on plain iterables (lists, generators, tuples) and compose into lazy pipelines via generators. This section mirrors the C# "Advanced LINQ" section using Python's standard library equivalents.

### Python | Functional tools | groupby, zip, comprehensions

The examples below use the same employee/department data as the C# file, expressed as plain dictionaries.

#### Sample data

```python
employees = [
    {"name": "Alice", "dept": "Engineering", "salary": 95000, "level": "senior"},
    {"name": "Bob", "dept": "Sales", "salary": 65000, "level": "junior"},
    {"name": "Charlie", "dept": "Engineering", "salary": 110000, "level": "lead"},
    {"name": "Diana", "dept": "Sales", "salary": 78000, "level": "senior"},
    {"name": "Eve", "dept": "Engineering", "salary": 88000, "level": "junior"},
    {"name": "Frank", "dept": "Marketing", "salary": 72000, "level": "senior"},
]

departments = [
    {"dept": "Engineering", "budget": 500000, "head": "CTO"},
    {"dept": "Sales", "budget": 300000, "head": "VP Sales"},
    {"dept": "Marketing", "budget": 200000, "head": "CMO"},
    {"dept": "HR", "budget": 150000, "head": "CHRO"},
]
```

#### GroupBy and aggregations

`itertools.groupby` requires the input to be sorted by the grouping key first. It yields `(key, group_iterator)` pairs — the group iterator is consumed once, so convert it to a list if you need multiple passes. Python's equivalent of C#'s `GroupBy` + `.Average()` / `.Sum()`.

```python
from itertools import groupby
from statistics import mean

sorted_emps = sorted(employees, key=lambda e: e["dept"])
for dept, group in groupby(sorted_emps, key=lambda e: e["dept"]):
    members = list(group)
    names = [m["name"] for m in members]
    avg_sal = mean(m["salary"] for m in members)
    print(f"  {dept:<15} ({len(members)} people): {names} avg=${avg_sal:,.0f}")
```

```text
Engineering     (3 people): ['Alice', 'Charlie', 'Eve'] avg=$97,667
Marketing       (1 people): ['Frank'] avg=$72,000
Sales           (2 people): ['Bob', 'Diana'] avg=$71,500
```

#### Join — dictionary lookup

Python has no built-in join operator. The idiomatic approach is to build a dictionary from one collection, then look up matching keys from the other — equivalent to C#'s `Join`. For a left join (all departments, even those with no employees), use `dict.get` with a default.

```python
dept_lookup = {d["dept"]: d for d in departments}

inner_join = [
    {**e, "head": dept_lookup[e["dept"]]["head"], "budget": dept_lookup[e["dept"]]["budget"]}
    for e in employees
    if e["dept"] in dept_lookup
]
for r in inner_join[:3]:
    print(f"  {r['name']:<10} {r['dept']:<15} head={r['head']:<10} budget=${r['budget']:,}")

emp_by_dept = defaultdict(list)
for e in employees:
    emp_by_dept[e["dept"]].append(e)

for d in departments:
    count = len(emp_by_dept.get(d["dept"], []))
    print(f"  {d['dept']:<15} head={d['head']:<10} employees={count}")
```

```text
Alice      Engineering     head=CTO        budget=$500,000
Bob        Sales           head=VP Sales   budget=$300,000
Charlie    Engineering     head=CTO        budget=$500,000
Engineering     head=CTO        employees=3
Sales           head=VP Sales   employees=2
Marketing       head=CMO        employees=1
HR              head=CHRO       employees=0
```

#### Chained pipeline and zip

Comprehensions chain naturally via nesting or sequential assignment. `zip` pairs elements from parallel iterables positionally, stopping at the shortest — equivalent to C#'s `Zip`.

```python
top3 = sorted(
    [{"name": e["name"], "salary": e["salary"], "tax": e["salary"] * 0.3}
     for e in employees if e["salary"] > 75000],
    key=lambda x: -x["salary"]
)[:3]
for r in top3:
    print(f"  {r['name']:<10} salary=${r['salary']:,}  tax=${r['tax']:,.0f}")

names = [e["name"] for e in employees]
salaries = [e["salary"] for e in employees]
raises = [e["salary"] * 0.1 for e in employees]
for name, salary, raise_amt in zip(names, salaries, raises):
    print(f"  {name:<10} ${salary:>8,} + ${raise_amt:>7,.0f} raise")
```

```text
Charlie    salary=$110,000  tax=$33,000
Alice      salary=$95,000  tax=$28,500
Eve        salary=$88,000  tax=$26,400
Alice      $  95,000 + $  9,500 raise
Bob        $  65,000 + $  6,500 raise
Charlie    $ 110,000 + $ 11,000 raise
Diana      $  78,000 + $  7,800 raise
Eve        $  88,000 + $  8,800 raise
Frank      $  72,000 + $  7,200 raise
```

#### SelectMany — flatten nested collections

Nested list comprehensions are Python's equivalent of C#'s `SelectMany`. A double `for` in a comprehension iterates the outer collection then the inner, yielding a flat sequence.

```python
people = [
    {"name": "Alice", "skills": ["Python", "LINQ", "SQL"]},
    {"name": "Bob", "skills": ["C#", "SQL"]},
    {"name": "Charlie", "skills": ["Python", "Go"]},
]

nested = [p["skills"] for p in people]
print(f"Select (nested): {nested}")

flat = [skill for p in people for skill in p["skills"]]
print(f"SelectMany (flat): {flat}")

pairs = [f"{p['name']}: {s}" for p in people for s in p["skills"]]
for pair in pairs:
    print(f"  {pair}")

distinct = sorted(set(skill for p in people for skill in p["skills"]))
print(f"Distinct skills: {distinct}")

matrix = [[1, 2, 3], [4, 5], [6, 7, 8, 9]]
print(f"Flat matrix: {[x for row in matrix for x in row]}")
```

```text
Select (nested): [['Python', 'LINQ', 'SQL'], ['C#', 'SQL'], ['Python', 'Go']]
SelectMany (flat): ['Python', 'LINQ', 'SQL', 'C#', 'SQL', 'Python', 'Go']
  Alice: Python
  Alice: LINQ
  Alice: SQL
  Bob: C#
  Bob: SQL
  Charlie: Python
  Charlie: Go
Distinct skills: ['C#', 'Go', 'LINQ', 'Python', 'SQL']
Flat matrix: [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

## Pandas vs Polars Analytics

Side-by-side analytics on live SQL Server data. Each operation shown first in pandas, then in Polars. Mirrors the C# notebook's LINQ vs Polars.NET section. Tables: `silver.eurostoxx50_ohlcv` (66K rows), `gold.scores_daily` (466 rows).

### Python | Data setup | SQL Server connection and data loading

Loads OHLCV and composite score data from the local `stoxx` database via SQLAlchemy/pyodbc into pandas, and reads the same Parquet file into Polars.

#### Connect to SQL Server and load data

```python
from sqlalchemy import create_engine
from urllib.parse import quote_plus

odbc_str = (
    'DRIVER={ODBC Driver 18 for SQL Server};'
    'SERVER=localhost,1434;DATABASE=stoxx;'
    'UID=sa;PWD=EsgDev2026Pass1;'
    'Encrypt=yes;TrustServerCertificate=yes;'
)
engine = create_engine(f'mssql+pyodbc:///?odbc_connect={quote_plus(odbc_str)}')

ohlcv = pd.read_sql('SELECT symbol, date, [open], high, low, [close], adj_close, volume FROM silver.eurostoxx50_ohlcv', engine)
scores = pd.read_sql('SELECT symbol, sector, country, composite_score, composite_rank, momentum_score, current_price, ytd_change_pct FROM gold.scores_daily', engine)

pldf = pl.read_parquet('C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet')

print(f"  Pandas: {len(ohlcv):,} rows, {ohlcv.symbol.nunique()} symbols")
print(f"  Polars: {pldf.height:,} rows")
print(f"  Date range: {ohlcv.date.min()} to {ohlcv.date.max()}")
```

```text
66,355 rows, 50 symbols
66,355 rows
2021-01-04 to 2026-03-12
```

### Subsetting

#### Pandas — Subset rows by slicing with iloc[]

```python
ohlcv.iloc[100:103]
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>open</th>
      <th>high</th>
      <th>low</th>
      <th>close</th>
      <th>adj_close</th>
      <th>volume</th>
      <th>vol_rank</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>100</th>
      <td>ASML.AS</td>
      <td>2021-05-26</td>
      <td>549.7</td>
      <td>549.7</td>
      <td>538.8</td>
      <td>541.9</td>
      <td>518.6536</td>
      <td>538666</td>
      <td>924</td>
    </tr>
    <tr>
      <th>101</th>
      <td>ASML.AS</td>
      <td>2021-05-27</td>
      <td>542.3</td>
      <td>547.3</td>
      <td>537.8</td>
      <td>544.0</td>
      <td>520.6634</td>
      <td>1123807</td>
      <td>115</td>
    </tr>
    <tr>
      <th>102</th>
      <td>ASML.AS</td>
      <td>2021-05-28</td>
      <td>544.8</td>
      <td>553.0</td>
      <td>542.1</td>
      <td>552.3</td>
      <td>528.6074</td>
      <td>562085</td>
      <td>869</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Subset rows by slicing with slice()

```python
pldf.slice(100, 3)
```

<div>
<!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21260</td><td>&quot;ABI.BR&quot;</td><td>2021-05-26</td><td>61.99</td><td>62.39</td><td>61.83</td><td>62.12</td><td>58.6701</td><td>940186</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21261</td><td>&quot;ABI.BR&quot;</td><td>2021-05-27</td><td>61.8</td><td>62.64</td><td>61.73</td><td>62.13</td><td>58.6795</td><td>1796477</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21262</td><td>&quot;ABI.BR&quot;</td><td>2021-05-28</td><td>62.14</td><td>62.58</td><td>61.96</td><td>62.34</td><td>58.8779</td><td>1004125</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

#### Pandas — Subset columns with double-bracket notation

```python
ohlcv[['symbol', 'date', 'close', 'volume']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>close</th>
      <th>volume</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>2021-01-04</td>
      <td>406.25</td>
      <td>789502</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ASML.AS</td>
      <td>2021-01-05</td>
      <td>406.90</td>
      <td>798787</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>2021-01-06</td>
      <td>402.85</td>
      <td>875711</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ASML.AS</td>
      <td>2021-01-07</td>
      <td>403.90</td>
      <td>874780</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ASML.AS</td>
      <td>2021-01-08</td>
      <td>416.05</td>
      <td>975243</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Subset columns with select()

```python
pldf.select('symbol', 'date', 'close', 'volume').head(5)
```

<div>
<!-- shape: (5, 4) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>1513937</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td><td>1382722</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td><td>1370204</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.4</td><td>1469911</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>57.86</td><td>1428681</td></tr></tbody></table></div>

#### Pandas — Subset single row with iloc[n]

```python
ohlcv.iloc[0]
```

```text
symbol          ASML.AS
date         2021-01-04
open              404.0
high              411.0
low              402.25
close            406.25
adj_close       387.709
volume           789502
vol_rank            392
Name: 0, dtype: object
```

#### Polars — Subset single row with row()

```python
pldf.row(0, named=True)
```

```text
{'id': 21160,
'symbol': 'ABI.BR',
'date': datetime.date(2021, 1, 4),
'open': 58.15,
'high': 58.85,
'low': 56.78,
'close': 57.21,
'adj_close': 53.5761,
'volume': 1513937,
'dividends': 0.0,
'stock_splits': 0.0,
'is_filled': False}
```

#### Pandas — Subset with loc[] label filter

```python
ohlcv.loc[ohlcv.symbol == 'ASML.AS', ['date', 'close']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>date</th>
      <th>close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>2021-01-04</td>
      <td>406.25</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2021-01-05</td>
      <td>406.90</td>
    </tr>
    <tr>
      <th>2</th>
      <td>2021-01-06</td>
      <td>402.85</td>
    </tr>
    <tr>
      <th>3</th>
      <td>2021-01-07</td>
      <td>403.90</td>
    </tr>
    <tr>
      <th>4</th>
      <td>2021-01-08</td>
      <td>416.05</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Subset with filter() + select()

```python
pldf.filter(pl.col('symbol') == 'ASML.AS').select('date', 'close').head(5)
```

<div>
<!-- shape: (5, 2) --><table><thead><tr><th>date</th><th>close</th></tr><tr><td>date</td><td>f64</td></tr></thead><tbody><tr><td>2021-01-04</td><td>406.25</td></tr><tr><td>2021-01-05</td><td>406.9</td></tr><tr><td>2021-01-06</td><td>402.85</td></tr><tr><td>2021-01-07</td><td>403.9</td></tr><tr><td>2021-01-08</td><td>416.05</td></tr></tbody></table></div>

#### Pandas — Subset multiple rows with iloc index

```python
ohlcv.iloc[[0, 50, 100, 500]]
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>open</th>
      <th>high</th>
      <th>low</th>
      <th>close</th>
      <th>adj_close</th>
      <th>volume</th>
      <th>vol_rank</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>2021-01-04</td>
      <td>404.0</td>
      <td>411.0</td>
      <td>402.25</td>
      <td>406.25</td>
      <td>387.7090</td>
      <td>789502</td>
      <td>392</td>
    </tr>
    <tr>
      <th>50</th>
      <td>ASML.AS</td>
      <td>2021-03-15</td>
      <td>448.0</td>
      <td>455.1</td>
      <td>446.45</td>
      <td>453.95</td>
      <td>433.2320</td>
      <td>632242</td>
      <td>706</td>
    </tr>
    <tr>
      <th>100</th>
      <td>ASML.AS</td>
      <td>2021-05-26</td>
      <td>549.7</td>
      <td>549.7</td>
      <td>538.80</td>
      <td>541.90</td>
      <td>518.6536</td>
      <td>538666</td>
      <td>924</td>
    </tr>
    <tr>
      <th>500</th>
      <td>ASML.AS</td>
      <td>2022-12-09</td>
      <td>573.0</td>
      <td>579.2</td>
      <td>569.80</td>
      <td>577.30</td>
      <td>560.7872</td>
      <td>618610</td>
      <td>743</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Subset multiple rows with index list

```python
pldf[[0, 50, 100, 500]]
```

<div>
<!-- shape: (4, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21210</td><td>&quot;ABI.BR&quot;</td><td>2021-03-15</td><td>52.32</td><td>53.05</td><td>52.18</td><td>52.29</td><td>48.9686</td><td>1253312</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21260</td><td>&quot;ABI.BR&quot;</td><td>2021-05-26</td><td>61.99</td><td>62.39</td><td>61.83</td><td>62.12</td><td>58.6701</td><td>940186</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21660</td><td>&quot;ABI.BR&quot;</td><td>2022-12-09</td><td>56.64</td><td>56.96</td><td>56.54</td><td>56.88</td><td>54.2262</td><td>1098905</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

#### Pandas — Select columns

```python
ohlcv[['symbol', 'date', 'close']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>2021-01-04</td>
      <td>406.25</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ASML.AS</td>
      <td>2021-01-05</td>
      <td>406.90</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>2021-01-06</td>
      <td>402.85</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ASML.AS</td>
      <td>2021-01-07</td>
      <td>403.90</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ASML.AS</td>
      <td>2021-01-08</td>
      <td>416.05</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Select columns

```python
pldf.select('symbol', 'date', 'close').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.4</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>57.86</td></tr></tbody></table></div>

#### Pandas — Filter rows

```python
ohlcv[(ohlcv.symbol == 'ASML.AS') & (ohlcv['close'] > 600)][['symbol', 'date', 'close']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>135</th>
      <td>ASML.AS</td>
      <td>2021-07-14</td>
      <td>609.1</td>
    </tr>
    <tr>
      <th>141</th>
      <td>ASML.AS</td>
      <td>2021-07-22</td>
      <td>620.8</td>
    </tr>
    <tr>
      <th>142</th>
      <td>ASML.AS</td>
      <td>2021-07-23</td>
      <td>638.8</td>
    </tr>
    <tr>
      <th>143</th>
      <td>ASML.AS</td>
      <td>2021-07-26</td>
      <td>638.0</td>
    </tr>
    <tr>
      <th>144</th>
      <td>ASML.AS</td>
      <td>2021-07-27</td>
      <td>623.0</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Filter rows

```python
pldf.filter((pl.col('symbol') == 'ASML.AS') & (pl.col('close') > 600)).select('symbol', 'date', 'close').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2021-07-14</td><td>609.1</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-07-22</td><td>620.8</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-07-23</td><td>638.8</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-07-26</td><td>638.0</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-07-27</td><td>623.0</td></tr></tbody></table></div>

#### Pandas — Sort

```python
ohlcv.sort_values('volume', ascending=False)[['symbol', 'date', 'volume']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>volume</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>31077</th>
      <td>ISP.MI</td>
      <td>2023-08-08</td>
      <td>376391539</td>
    </tr>
    <tr>
      <th>10782</th>
      <td>SAN.MC</td>
      <td>2021-10-20</td>
      <td>367211467</td>
    </tr>
    <tr>
      <th>31028</th>
      <td>ISP.MI</td>
      <td>2023-05-31</td>
      <td>317362978</td>
    </tr>
    <tr>
      <th>30974</th>
      <td>ISP.MI</td>
      <td>2023-03-13</td>
      <td>311886033</td>
    </tr>
    <tr>
      <th>10792</th>
      <td>SAN.MC</td>
      <td>2021-11-03</td>
      <td>306973344</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Sort

```python
pldf.sort('volume', descending=True).select('symbol', 'date', 'volume').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>volume</th></tr><tr><td>str</td><td>date</td><td>i64</td></tr></thead><tbody><tr><td>&quot;ISP.MI&quot;</td><td>2023-08-08</td><td>376391539</td></tr><tr><td>&quot;SAN.MC&quot;</td><td>2021-10-20</td><td>367211467</td></tr><tr><td>&quot;ISP.MI&quot;</td><td>2023-05-31</td><td>317362978</td></tr><tr><td>&quot;ISP.MI&quot;</td><td>2023-03-13</td><td>311886033</td></tr><tr><td>&quot;SAN.MC&quot;</td><td>2021-11-03</td><td>306973344</td></tr></tbody></table></div>

#### Pandas — Add computed column

```python
ohlcv.assign(range=ohlcv.high - ohlcv.low)[['symbol', 'close', 'range']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>close</th>
      <th>range</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>406.25</td>
      <td>8.75</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ASML.AS</td>
      <td>406.90</td>
      <td>10.90</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>402.85</td>
      <td>8.00</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ASML.AS</td>
      <td>403.90</td>
      <td>7.45</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ASML.AS</td>
      <td>416.05</td>
      <td>5.70</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Add computed column

```python
pldf.with_columns((pl.col('high') - pl.col('low')).alias('range')).select('symbol', 'close', 'range').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>close</th><th>range</th></tr><tr><td>str</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>57.21</td><td>2.07</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>57.18</td><td>1.23</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>58.77</td><td>1.55</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>58.4</td><td>0.98</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>57.86</td><td>0.97</td></tr></tbody></table></div>

### Aggregations

#### Pandas — GroupBy with aggregates

```python
ohlcv.groupby('symbol').agg(
    avg_close=('close', 'mean'),
    total_vol=('volume', 'sum'),
    days=('close', 'count')
).sort_values('avg_close', ascending=False).head(5).round(2)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>avg_close</th>
      <th>total_vol</th>
      <th>days</th>
    </tr>
    <tr>
      <th>symbol</th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>RMS.PA</th>
      <td>1761.56</td>
      <td>81633862</td>
      <td>1331</td>
    </tr>
    <tr>
      <th>ADYEN.AS</th>
      <td>1545.98</td>
      <td>110400463</td>
      <td>1331</td>
    </tr>
    <tr>
      <th>ASML.AS</th>
      <td>671.35</td>
      <td>945070720</td>
      <td>1331</td>
    </tr>
    <tr>
      <th>MC.PA</th>
      <td>662.40</td>
      <td>557855567</td>
      <td>1331</td>
    </tr>
    <tr>
      <th>RHM.DE</th>
      <td>544.66</td>
      <td>308359744</td>
      <td>1324</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — GroupBy with aggregates

```python
pldf.group_by('symbol').agg(
    pl.col('close').mean().alias('avg_close'),
    pl.col('volume').sum().alias('total_vol'),
    pl.col('close').count().alias('days')
).sort('avg_close', descending=True).head(5)
```

<div>
<!-- shape: (5, 4) --><table><thead><tr><th>symbol</th><th>avg_close</th><th>total_vol</th><th>days</th></tr><tr><td>str</td><td>f64</td><td>i64</td><td>u32</td></tr></thead><tbody><tr><td>&quot;RMS.PA&quot;</td><td>1761.555748</td><td>81633862</td><td>1331</td></tr><tr><td>&quot;ADYEN.AS&quot;</td><td>1545.976409</td><td>110400463</td><td>1331</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>671.348911</td><td>945070720</td><td>1331</td></tr><tr><td>&quot;MC.PA&quot;</td><td>662.404508</td><td>557855567</td><td>1331</td></tr><tr><td>&quot;RHM.DE&quot;</td><td>544.661533</td><td>308359744</td><td>1324</td></tr></tbody></table></div>

#### Pandas — HAVING

```python
avg_vol = ohlcv.groupby('symbol')['volume'].mean()
avg_vol[avg_vol > 5_000_000].sort_values(ascending=False).to_frame('avg_volume')
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>avg_volume</th>
    </tr>
    <tr>
      <th>symbol</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>ISP.MI</th>
      <td>8.758860e+07</td>
    </tr>
    <tr>
      <th>SAN.MC</th>
      <td>4.177099e+07</td>
    </tr>
    <tr>
      <th>ENEL.MI</th>
      <td>2.467870e+07</td>
    </tr>
    <tr>
      <th>BBVA.MC</th>
      <td>1.665446e+07</td>
    </tr>
    <tr>
      <th>UCG.MI</th>
      <td>1.390371e+07</td>
    </tr>
    <tr>
      <th>ENI.MI</th>
      <td>1.297621e+07</td>
    </tr>
    <tr>
      <th>INGA.AS</th>
      <td>1.280359e+07</td>
    </tr>
    <tr>
      <th>IBE.MC</th>
      <td>1.203484e+07</td>
    </tr>
    <tr>
      <th>DTE.DE</th>
      <td>7.575084e+06</td>
    </tr>
    <tr>
      <th>NDA-FI.HE</th>
      <td>5.375454e+06</td>
    </tr>
    <tr>
      <th>TTE.PA</th>
      <td>5.138099e+06</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — HAVING

```python
pldf.group_by('symbol').agg(
    pl.col('volume').mean().alias('avg_vol')
).filter(pl.col('avg_vol') > 5_000_000).sort('avg_vol', descending=True)
```

<div>
<!-- shape: (11, 2) --><table><thead><tr><th>symbol</th><th>avg_vol</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ISP.MI&quot;</td><td>8.7589e7</td></tr><tr><td>&quot;SAN.MC&quot;</td><td>4.1771e7</td></tr><tr><td>&quot;ENEL.MI&quot;</td><td>2.4679e7</td></tr><tr><td>&quot;BBVA.MC&quot;</td><td>1.6654e7</td></tr><tr><td>&quot;UCG.MI&quot;</td><td>1.3904e7</td></tr><tr><td>&hellip;</td><td>&hellip;</td></tr><tr><td>&quot;INGA.AS&quot;</td><td>1.2804e7</td></tr><tr><td>&quot;IBE.MC&quot;</td><td>1.2035e7</td></tr><tr><td>&quot;DTE.DE&quot;</td><td>7.5751e6</td></tr><tr><td>&quot;NDA-FI.HE&quot;</td><td>5.3755e6</td></tr><tr><td>&quot;TTE.PA&quot;</td><td>5.1381e6</td></tr></tbody></table></div>

### Window Functions

#### Pandas — Window Function LAG()

```python
asml = ohlcv[ohlcv.symbol == 'ASML.AS'].sort_values('date').copy()
asml['prev_close'] = asml['close'].shift(1)
asml['return_pct'] = ((asml['close'] - asml['prev_close']) / asml['prev_close'] * 100).round(2)
asml[['date', 'close', 'prev_close', 'return_pct']].tail(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>date</th>
      <th>close</th>
      <th>prev_close</th>
      <th>return_pct</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>64731</th>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>1186.0</td>
      <td>-3.29</td>
    </tr>
    <tr>
      <th>66155</th>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>1147.0</td>
      <td>0.05</td>
    </tr>
    <tr>
      <th>66156</th>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>1147.6</td>
      <td>4.57</td>
    </tr>
    <tr>
      <th>66157</th>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>1200.0</td>
      <td>-0.10</td>
    </tr>
    <tr>
      <th>66305</th>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>1198.8</td>
      <td>-0.67</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Window Function LAG()

```python
pldf.filter(pl.col('symbol') == 'ASML.AS').sort('date').with_columns(
    pl.col('close').shift(1).over('symbol').alias('prev_close')
).with_columns(
    ((pl.col('close') - pl.col('prev_close')) / pl.col('prev_close') * 100).alias('return_pct')
).select('date', 'close', 'prev_close', 'return_pct').tail(5)
```

<div>
<!-- shape: (5, 4) --><table><thead><tr><th>date</th><th>close</th><th>prev_close</th><th>return_pct</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-03-06</td><td>1147.0</td><td>1186.0</td><td>-3.288364</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1147.0</td><td>0.05231</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>1147.6</td><td>4.566051</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1200.0</td><td>-0.1</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1198.8</td><td>-0.667334</td></tr></tbody></table></div>

#### Pandas — Window Function Cumulative SUM()

```python
asml = ohlcv[ohlcv.symbol == 'ASML.AS'].sort_values('date').copy()
asml['cum_vol'] = asml['volume'].cumsum()
asml[['date', 'volume', 'cum_vol']].tail(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>date</th>
      <th>volume</th>
      <th>cum_vol</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>64731</th>
      <td>2026-03-06</td>
      <td>857271</td>
      <td>942889692</td>
    </tr>
    <tr>
      <th>66155</th>
      <td>2026-03-09</td>
      <td>689086</td>
      <td>943578778</td>
    </tr>
    <tr>
      <th>66156</th>
      <td>2026-03-10</td>
      <td>800815</td>
      <td>944379593</td>
    </tr>
    <tr>
      <th>66157</th>
      <td>2026-03-11</td>
      <td>562904</td>
      <td>944942497</td>
    </tr>
    <tr>
      <th>66305</th>
      <td>2026-03-12</td>
      <td>128223</td>
      <td>945070720</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Window Function Cumulative SUM()

```python
pldf.filter(pl.col('symbol') == 'ASML.AS').sort('date').with_columns(
    pl.col('volume').cum_sum().over('symbol').alias('cum_vol')
).select('date', 'volume', 'cum_vol').tail(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>date</th><th>volume</th><th>cum_vol</th></tr><tr><td>date</td><td>i64</td><td>i64</td></tr></thead><tbody><tr><td>2026-03-06</td><td>857271</td><td>942889692</td></tr><tr><td>2026-03-09</td><td>689086</td><td>943578778</td></tr><tr><td>2026-03-10</td><td>800815</td><td>944379593</td></tr><tr><td>2026-03-11</td><td>562904</td><td>944942497</td></tr><tr><td>2026-03-12</td><td>128223</td><td>945070720</td></tr></tbody></table></div>

#### Pandas — Window Function AVG() Moving Average

```python
asml = ohlcv[ohlcv.symbol == 'ASML.AS'].sort_values('date').copy()
asml['sma_20'] = asml['close'].rolling(20).mean()
asml[['date', 'close', 'sma_20']].tail(5).round(2)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>date</th>
      <th>close</th>
      <th>sma_20</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>64731</th>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>1214.02</td>
    </tr>
    <tr>
      <th>66155</th>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>1211.16</td>
    </tr>
    <tr>
      <th>66156</th>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>1211.51</td>
    </tr>
    <tr>
      <th>66157</th>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>1211.06</td>
    </tr>
    <tr>
      <th>66305</th>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>1211.61</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Window Function AVG() Moving Average

```python
pldf.filter(pl.col('symbol') == 'ASML.AS').sort('date').with_columns(
    pl.col('close').rolling_mean(20).over('symbol').alias('sma_20')
).select('date', 'close', 'sma_20').tail(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>date</th><th>close</th><th>sma_20</th></tr><tr><td>date</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-03-06</td><td>1147.0</td><td>1214.02</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1211.16</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>1211.51</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1211.06</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1211.61</td></tr></tbody></table></div>

#### Pandas — Window Function ROW_NUMBER()

```python
ohlcv['vol_rank'] = ohlcv.groupby('symbol')['volume'].rank(ascending=False, method='first').astype(int)
ohlcv[ohlcv.vol_rank == 1].sort_values('volume', ascending=False)[['symbol', 'date', 'volume']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>volume</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>31077</th>
      <td>ISP.MI</td>
      <td>2023-08-08</td>
      <td>376391539</td>
    </tr>
    <tr>
      <th>10782</th>
      <td>SAN.MC</td>
      <td>2021-10-20</td>
      <td>367211467</td>
    </tr>
    <tr>
      <th>22666</th>
      <td>BBVA.MC</td>
      <td>2021-09-17</td>
      <td>228528294</td>
    </tr>
    <tr>
      <th>46685</th>
      <td>NDA-FI.HE</td>
      <td>2022-09-16</td>
      <td>140675854</td>
    </tr>
    <tr>
      <th>33211</th>
      <td>PRX.AS</td>
      <td>2021-08-17</td>
      <td>114772834</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Window Function ROW_NUMBER()

```python
pldf.with_columns(
    pl.col('volume').rank(descending=True).over('symbol').alias('vol_rank')
).filter(pl.col('vol_rank') == 1).sort('volume', descending=True).select('symbol', 'date', 'volume').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>volume</th></tr><tr><td>str</td><td>date</td><td>i64</td></tr></thead><tbody><tr><td>&quot;ISP.MI&quot;</td><td>2023-08-08</td><td>376391539</td></tr><tr><td>&quot;SAN.MC&quot;</td><td>2021-10-20</td><td>367211467</td></tr><tr><td>&quot;BBVA.MC&quot;</td><td>2021-09-17</td><td>228528294</td></tr><tr><td>&quot;NDA-FI.HE&quot;</td><td>2022-09-16</td><td>140675854</td></tr><tr><td>&quot;PRX.AS&quot;</td><td>2021-08-17</td><td>114772834</td></tr></tbody></table></div>

#### Pandas — Window Function LEAD()

```python
asml = ohlcv[ohlcv.symbol == 'ASML.AS'].sort_values('date').copy()
asml['next_date'] = asml['date'].shift(-1)
asml['gap_days'] = (pd.to_datetime(asml['next_date']) - pd.to_datetime(asml['date'])).dt.days
asml[asml.gap_days > 3][['date', 'next_date', 'gap_days']].sort_values('gap_days', ascending=False).head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>date</th>
      <th>next_date</th>
      <th>gap_days</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>63</th>
      <td>2021-04-01</td>
      <td>2021-04-06</td>
      <td>5.0</td>
    </tr>
    <tr>
      <th>331</th>
      <td>2022-04-14</td>
      <td>2022-04-19</td>
      <td>5.0</td>
    </tr>
    <tr>
      <th>583</th>
      <td>2023-04-06</td>
      <td>2023-04-11</td>
      <td>5.0</td>
    </tr>
    <tr>
      <th>766</th>
      <td>2023-12-22</td>
      <td>2023-12-27</td>
      <td>5.0</td>
    </tr>
    <tr>
      <th>1101</th>
      <td>2025-04-17</td>
      <td>2025-04-22</td>
      <td>5.0</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Window Function LEAD()

```python
pldf.filter(pl.col('symbol') == 'ASML.AS').sort('date').with_columns(
    pl.col('date').shift(-1).over('symbol').alias('next_date')
).with_columns(
    (pl.col('next_date') - pl.col('date')).dt.total_days().alias('gap_days')
).filter(pl.col('gap_days') > 3).sort('gap_days', descending=True).select('date', 'next_date', 'gap_days').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>date</th><th>next_date</th><th>gap_days</th></tr><tr><td>date</td><td>date</td><td>i64</td></tr></thead><tbody><tr><td>2021-04-01</td><td>2021-04-06</td><td>5</td></tr><tr><td>2022-04-14</td><td>2022-04-19</td><td>5</td></tr><tr><td>2023-04-06</td><td>2023-04-11</td><td>5</td></tr><tr><td>2023-12-22</td><td>2023-12-27</td><td>5</td></tr><tr><td>2024-03-28</td><td>2024-04-02</td><td>5</td></tr></tbody></table></div>

### Joins

#### Pandas — JOIN

```python
avg_df = ohlcv.groupby('symbol')['close'].mean().round(2).reset_index(name='avg_close')
avg_df.merge(scores[['symbol', 'sector', 'composite_rank']], on='symbol').sort_values('composite_rank').head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>avg_close</th>
      <th>sector</th>
      <th>composite_rank</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>44</th>
      <td>BNP.PA</td>
      <td>60.94</td>
      <td>Financial Services</td>
      <td>1</td>
    </tr>
    <tr>
      <th>43</th>
      <td>BNP.PA</td>
      <td>60.94</td>
      <td>Financial Services</td>
      <td>1</td>
    </tr>
    <tr>
      <th>42</th>
      <td>BNP.PA</td>
      <td>60.94</td>
      <td>Financial Services</td>
      <td>1</td>
    </tr>
    <tr>
      <th>60</th>
      <td>DTE.DE</td>
      <td>22.43</td>
      <td>Communication Services</td>
      <td>2</td>
    </tr>
    <tr>
      <th>59</th>
      <td>DTE.DE</td>
      <td>22.43</td>
      <td>Communication Services</td>
      <td>2</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — JOIN

```python
pl_avg = pldf.group_by('symbol').agg(pl.col('close').mean().alias('avg_close'))
pl_scores = pl.DataFrame({
    'symbol': scores['symbol'].tolist(),
    'sector': scores['sector'].tolist(),
    'composite_rank': scores['composite_rank'].tolist(),
})
pl_avg.join(pl_scores, on='symbol').sort('composite_rank').head(5)
```

<div>
<!-- shape: (5, 4) --><table><thead><tr><th>symbol</th><th>avg_close</th><th>sector</th><th>composite_rank</th></tr><tr><td>str</td><td>f64</td><td>str</td><td>i64</td></tr></thead><tbody><tr><td>&quot;BNP.PA&quot;</td><td>60.937712</td><td>&quot;Financial Services&quot;</td><td>1</td></tr><tr><td>&quot;BNP.PA&quot;</td><td>60.937712</td><td>&quot;Financial Services&quot;</td><td>1</td></tr><tr><td>&quot;BNP.PA&quot;</td><td>60.937712</td><td>&quot;Financial Services&quot;</td><td>1</td></tr><tr><td>&quot;DTE.DE&quot;</td><td>22.430097</td><td>&quot;Communication Services&quot;</td><td>2</td></tr><tr><td>&quot;DTE.DE&quot;</td><td>22.430097</td><td>&quot;Communication Services&quot;</td><td>2</td></tr></tbody></table></div>

#### Pandas — STDEV()

```python
returns = ohlcv.sort_values(['symbol', 'date']).groupby('symbol')['close'].pct_change()
vol = returns.groupby(ohlcv['symbol']).std() * np.sqrt(252) * 100
vol.sort_values(ascending=False).head(10).round(2).to_frame('annual_vol_%')
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>annual_vol_%</th>
    </tr>
    <tr>
      <th>symbol</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>ADYEN.AS</th>
      <td>50.30</td>
    </tr>
    <tr>
      <th>ENR.DE</th>
      <td>50.05</td>
    </tr>
    <tr>
      <th>RHM.DE</th>
      <td>40.85</td>
    </tr>
    <tr>
      <th>PRX.AS</th>
      <td>39.72</td>
    </tr>
    <tr>
      <th>ARGX.BR</th>
      <td>39.31</td>
    </tr>
    <tr>
      <th>ASML.AS</th>
      <td>37.62</td>
    </tr>
    <tr>
      <th>IFX.DE</th>
      <td>37.25</td>
    </tr>
    <tr>
      <th>UCG.MI</th>
      <td>35.55</td>
    </tr>
    <tr>
      <th>VOW.DE</th>
      <td>35.51</td>
    </tr>
    <tr>
      <th>ADS.DE</th>
      <td>34.37</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — STDEV()

```python
pldf.sort('symbol', 'date').with_columns(
    pl.col('close').pct_change().over('symbol').alias('ret')
).group_by('symbol').agg(
    (pl.col('ret').std() * (252 ** 0.5) * 100).alias('annual_vol_%')
).sort('annual_vol_%', descending=True).head(10)
```

<div>
<!-- shape: (10, 2) --><table><thead><tr><th>symbol</th><th>annual_vol_%</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ADYEN.AS&quot;</td><td>50.295865</td></tr><tr><td>&quot;ENR.DE&quot;</td><td>50.045128</td></tr><tr><td>&quot;RHM.DE&quot;</td><td>40.84623</td></tr><tr><td>&quot;PRX.AS&quot;</td><td>39.715469</td></tr><tr><td>&quot;ARGX.BR&quot;</td><td>39.305925</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>37.624556</td></tr><tr><td>&quot;IFX.DE&quot;</td><td>37.249051</td></tr><tr><td>&quot;UCG.MI&quot;</td><td>35.550249</td></tr><tr><td>&quot;VOW.DE&quot;</td><td>35.509649</td></tr><tr><td>&quot;ADS.DE&quot;</td><td>34.372174</td></tr></tbody></table></div>

### CRUD-like Operations

#### Pandas — Add rows

```python
new_row = pd.DataFrame([{'symbol': 'TEST.XX', 'date': '2025-01-01', 'open': 100, 'high': 105,
    'low': 95, 'close': 102, 'adj_close': 102, 'volume': 50000}])
pd.concat([ohlcv, new_row], ignore_index=True).tail(3)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>open</th>
      <th>high</th>
      <th>low</th>
      <th>close</th>
      <th>adj_close</th>
      <th>volume</th>
      <th>vol_rank</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>66353</th>
      <td>WKL.AS</td>
      <td>2026-03-12</td>
      <td>67.000</td>
      <td>67.54</td>
      <td>66.28</td>
      <td>67.32</td>
      <td>67.32</td>
      <td>210379</td>
      <td>1312.0</td>
    </tr>
    <tr>
      <th>66354</th>
      <td>DSY.PA</td>
      <td>2026-03-12</td>
      <td>18.075</td>
      <td>18.39</td>
      <td>18.02</td>
      <td>18.37</td>
      <td>18.37</td>
      <td>434417</td>
      <td>1327.0</td>
    </tr>
    <tr>
      <th>66355</th>
      <td>TEST.XX</td>
      <td>2025-01-01</td>
      <td>100.000</td>
      <td>105.00</td>
      <td>95.00</td>
      <td>102.00</td>
      <td>102.00</td>
      <td>50000</td>
      <td>NaN</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Add rows

```python
new_row = pldf.head(1).with_columns(
    pl.lit('TEST.XX').alias('symbol'), pl.lit(102.0).alias('close'), pl.lit(50000).cast(pl.Int64).alias('volume'))
pldf.vstack(new_row).tail(3)
```

<div>
<!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>66877</td><td>&quot;WKL.AS&quot;</td><td>2026-03-11</td><td>67.5</td><td>69.6</td><td>67.02</td><td>67.22</td><td>67.22</td><td>1142531</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>66929</td><td>&quot;WKL.AS&quot;</td><td>2026-03-12</td><td>67.0</td><td>67.54</td><td>66.28</td><td>67.32</td><td>67.32</td><td>210379</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21160</td><td>&quot;TEST.XX&quot;</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>102.0</td><td>53.5761</td><td>50000</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

#### Pandas — Update column

```python
ohlcv[ohlcv.symbol == 'ASML.AS'].assign(adj_close=lambda d: d['close'] * 1.05)[['symbol', 'date', 'adj_close']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>adj_close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>2021-01-04</td>
      <td>426.5625</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ASML.AS</td>
      <td>2021-01-05</td>
      <td>427.2450</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>2021-01-06</td>
      <td>422.9925</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ASML.AS</td>
      <td>2021-01-07</td>
      <td>424.0950</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ASML.AS</td>
      <td>2021-01-08</td>
      <td>436.8525</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Update column

```python
pldf.filter(pl.col('symbol') == 'ASML.AS').with_columns(
    (pl.col('close') * 1.05).alias('adj_close')
).select('symbol', 'date', 'adj_close').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>adj_close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-04</td><td>426.5625</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-05</td><td>427.245</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-06</td><td>422.9925</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-07</td><td>424.095</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-08</td><td>436.8525</td></tr></tbody></table></div>

#### Pandas — Delete rows

```python
filtered = ohlcv[ohlcv.symbol != 'ASML.AS']
print(f"  {len(ohlcv)} - ASML rows = {len(filtered)} remaining")
```

```text
66355 - ASML rows = 65024 remaining
```

#### Polars — Delete rows

```python
filtered = pldf.filter(pl.col('symbol') != 'ASML.AS')
print(f"  {pldf.height} - ASML rows = {filtered.height} remaining")
```

```text
66355 - ASML rows = 65024 remaining
```

#### Pandas — Drop column

```python
ohlcv.drop(columns=['dividends', 'stock_splits', 'is_filled'], errors='ignore').head(3)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>open</th>
      <th>high</th>
      <th>low</th>
      <th>close</th>
      <th>adj_close</th>
      <th>volume</th>
      <th>vol_rank</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>2021-01-04</td>
      <td>404.00</td>
      <td>411.00</td>
      <td>402.25</td>
      <td>406.25</td>
      <td>387.7090</td>
      <td>789502</td>
      <td>392</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ASML.AS</td>
      <td>2021-01-05</td>
      <td>406.55</td>
      <td>412.05</td>
      <td>401.15</td>
      <td>406.90</td>
      <td>388.3294</td>
      <td>798787</td>
      <td>381</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>2021-01-06</td>
      <td>406.80</td>
      <td>407.20</td>
      <td>399.20</td>
      <td>402.85</td>
      <td>384.4644</td>
      <td>875711</td>
      <td>276</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Drop column

```python
pldf.drop('dividends', 'stock_splits', 'is_filled').head(3)
```

<div>
<!-- shape: (3, 9) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>21160</td><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td></tr><tr><td>21161</td><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td></tr><tr><td>21162</td><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td></tr></tbody></table></div>

## Pandas vs Polars — Comparison Matrix

| Feature | Pandas | Polars |
|---------|--------|--------|
| **Engine** | C + Cython (NumPy) | Rust (Apache Arrow) |
| **Memory model** | Copy-heavy, mutable | Zero-copy, immutable |
| **Index** | Row labels (`.loc`, `.iloc`) | No index — positional only |
| **Lazy evaluation** | No — every operation materializes | Yes — `.lazy()` builds a query plan, `.collect()` executes |
| **Multithreading** | Single-threaded (GIL) | Multi-threaded by default |
| **String handling** | Python `object` dtype (slow) | Arrow `Utf8` (fast, zero-copy) |
| **Missing values** | `NaN` (float only), `None`, `pd.NA` | `null` (first-class, any type) |
| **GroupBy** | Split-apply-combine | Hash-based, parallelized |
| **Window functions** | `.shift()`, `.rolling()`, `.rank()` | `.over()` expressions (partition without materializing groups) |
| **Joins** | `.merge(on=, how=)` | `.join(on=, how=)` — same API, faster execution |
| **SQL support** | Via `pandasql` (slow) | Built-in `pl.sql()` on DataFrames |
| **Streaming** | No | `pl.scan_*()` + `.collect(streaming=True)` for larger-than-RAM |
| **Ecosystem** | Massive — scikit-learn, matplotlib, seaborn all expect pandas | Growing — `.to_pandas()` bridge available |
| **Learning curve** | Lower — 10+ years of tutorials, Stack Overflow answers | Steeper — expression API is powerful but different |

### When to use Pandas

- **Prototyping and exploration** — familiar API, instant Stack Overflow answers
- **Interop with ML libraries** — scikit-learn, XGBoost, statsmodels all expect pandas DataFrames
- **Small data** (< 1M rows) — performance difference is negligible
- **Row-label semantics** — time-series with DatetimeIndex, multi-level hierarchical indices
- **Legacy codebases** — existing pandas pipelines that work and don't need optimization

### When to use Polars

- **Large datasets** (1M–100M+ rows) — 10–100x faster than pandas due to Rust engine + multithreading
- **ETL pipelines** — lazy evaluation optimizes the query plan before execution (predicate pushdown, projection pushdown)
- **Memory-constrained environments** — Arrow columnar format uses 2–5x less RAM than pandas
- **Streaming / larger-than-RAM** — `scan_parquet().collect(streaming=True)` processes data in chunks
- **Reproducibility** — immutable DataFrames prevent accidental mutation bugs
- **Cloud-native pipelines** — reads/writes Parquet, IPC, NDJSON natively without conversion

### Gotchas

| Gotcha | Pandas | Polars |
|--------|--------|--------|
| **SettingWithCopyWarning** | Modifying a view vs copy is ambiguous — use `.copy()` or `.loc[]` | Not an issue — DataFrames are immutable |
| **dtype coercion** | Silently upcasts int to float when NaN is present | Keeps int + null separate (no silent coercion) |
| **Chained indexing** | `df[cond][col]` may return copy or view unpredictably | Not possible — use `.filter().select()` (always predictable) |
| **Memory spikes** | `.apply()` and `.iterrows()` create Python objects per row | Expressions stay in Rust — no per-row Python overhead |
| **Column order** | Preserved but fragile after joins/concats | Preserved, deterministic |
| **Datetime handling** | `pd.Timestamp` (nanosecond precision, Y2262 overflow) | Arrow temporal types (microsecond default, configurable) |
| **No index in Polars** | — | If you rely on `.loc[label]`, you need `.filter()` instead |
| **Ecosystem gaps** | — | Some viz/ML libraries don't accept Polars — use `.to_pandas()` |

## Warnings

> [!warning] `TypeVar` and `Generic` are erased at runtime
>
> Type hints in Python provide no runtime enforcement. `Stack[int]` and `Stack[str]` are the same class at runtime — you cannot check `isinstance(stack, Stack[int])`.

> [!success] Correct pattern
>
> Use type hints for static analysis (mypy/pyright) and IDE support. For runtime validation, use `pydantic` or manual checks.

> [!warning] `itertools.groupby` requires pre-sorted input
>
> `groupby` groups consecutive equal elements — it does NOT collect all matching elements like SQL `GROUP BY` or pandas `groupby()`. Unsorted input produces fragmented groups.

> [!success] Correct pattern
>
> Always sort before grouping: `groupby(sorted(data, key=keyfunc), key=keyfunc)`. Or use `defaultdict(list)` for a single-pass grouping without sorting.

> [!warning] Generators are single-pass
>
> A generator expression `(x for x in iter)` can only be consumed once. Iterating a second time yields nothing — the generator is exhausted.

> [!success] Correct pattern
>
> If you need multiple passes, materialize with `list()`. If the data is too large for memory, restructure the pipeline to consume in a single pass or use `itertools.tee()` (but note `tee` stores all consumed items in memory).

> [!warning] pandas `SettingWithCopyWarning`
>
> `df[df['col'] > 5]['other'] = 1` may modify a copy, not the original DataFrame. The result is silently discarded.

> [!success] Correct pattern
>
> Use `.loc[]` for chained assignment: `df.loc[df['col'] > 5, 'other'] = 1`. Or switch to Polars where DataFrames are immutable.

> [!warning] pandas silently upcasts int to float when NaN is present
>
> A column of `int64` values becomes `float64` the moment a single `NaN` is introduced — this can break downstream type-sensitive code.

> [!success] Correct pattern
>
> Use `pd.Int64Dtype()` (nullable integer) or switch to Polars, which keeps int + null separate without coercion.

## Recommendations

- **Use type hints for library APIs and shared code** — even though Python doesn't enforce them at runtime, they enable IDE autocomplete, mypy checking, and self-documenting function signatures.
- **Prefer comprehensions over `map`/`filter`** for most code — comprehensions are more Pythonic and readable. Reserve `map`/`filter` for when you're passing an existing named function.
- **Use generators for large datasets** — `(x for x in iter)` processes one item at a time without loading everything into memory.
- **Use `defaultdict(list)` for single-pass grouping** — more intuitive than `itertools.groupby` and doesn't require pre-sorting.
- **Use Polars for new pipelines with large data** — 10–100x faster than pandas, lazy evaluation, immutable DataFrames, less memory.
- **Keep pandas for exploration and ecosystem compatibility** — notebooks, quick analysis, and libraries that don't accept Polars yet.
- **Use `Protocol` for structural typing** — lighter than `ABC`, no inheritance required, and works with mypy for static contract verification.
- **Use `TypeVar` with `bound=` for constrained generics** — when your generic function needs to call specific methods on the type parameter.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| mypy error: `Incompatible types in assignment` | Type hint mismatch — assigning wrong type to a typed variable | Fix the type annotation or the assignment |
| `itertools.groupby` produces fragmented groups | Input not sorted by the grouping key | Sort first: `sorted(data, key=keyfunc)` |
| Generator yields nothing on second iteration | Generators are single-pass — already exhausted | Materialize with `list()` or recreate the generator |
| `map()` returns an iterator, not a list | Python 3 `map` is lazy | Wrap in `list()`: `list(map(func, data))` |
| `SettingWithCopyWarning` in pandas | Chained indexing modifies a copy, not the original | Use `.loc[]` for assignment |
| pandas column changed from int to float | NaN introduced into an int column | Use `pd.Int64Dtype()` or Polars |
| Polars `LazyFrame` has no data | Haven't called `.collect()` yet | Call `.collect()` to materialize the query |
| Polars `.loc[]` doesn't exist | Polars has no row index | Use `.filter()` for row selection |
| `TypeError: 'type' object is not subscriptable` | Using `list[int]` in Python <3.9 | Use `from __future__ import annotations` or `typing.List[int]` |
| Generic class not type-checked | Forgot to inherit from `Generic[T]` | Add `Generic[T]` to the class bases |

