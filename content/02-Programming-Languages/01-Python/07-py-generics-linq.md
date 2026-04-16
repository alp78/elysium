---
title: "07 - Generics & Functional Data Processing - Python"
tags: [python]
aliases: [generics, LINQ, type parameters, generic collections, comprehensions, functional programming]
description: "Python generics and functional data processing reference with executable examples and captured outputs — covers duck typing, `TypeVar`, `Generic`, `Protocol`, iterator tools, and pandas/Polars equivalents. See [07-cs-generics-linq](https://alp78.github.io/elysium/02-Programming-Languages/02-CSharp/07-cs-generics-linq) for the C# equivalent."
created: 2026-03-22
updated: 2026-04-14
status: complete
---

# Generics & Functional Data Processing - Python

> [!quote]+
> "All non-trivial abstractions, to some degree, are leaky."
>
> — **Joel Spolsky**, *The Law of Leaky Abstractions*, blog post (2002)

> [!abstract]- Summary
>
> **Generics**
> - Python's duck typing makes functions naturally generic — any object with the right methods works without type declarations or generic syntax.
> - `TypeVar` declares a generic type variable (`T = TypeVar('T')`); resolved by the static checker at each call site, erased at runtime.
> - `Generic[T]` keeps custom container classes type-safe for static analysis, even though the parameterization is erased at runtime.
> - Bounded type variables (`TypeVar('T', bound=SomeProtocolOrClass)`) let generic code call methods that are guaranteed by the bound.
> - `Protocol` defines structural interfaces: any class with the right methods satisfies the contract without inheritance; add `@runtime_checkable` only when you need runtime `isinstance()` checks.
> - Built-in collection annotations such as `list[int]`, `dict[str, int]`, and `tuple[int, str]` need no `typing.List`/`typing.Dict` import in Python 3.9+; `Optional` and `Callable` still come from `typing` unless you use newer alternatives such as `str | None`.
>
> **Functional Data Processing**
> - List/dict/set comprehensions are Python's primary replacement for C# LINQ `Select`/`Where`; generator expressions (`()`) are the lazy, memory-efficient variant.
> - `map(func, iter)` transforms and `filter(pred, iter)` selects as lazy iterators; `functools.reduce(func, iter)` returns the final accumulated value.
> - `itertools.groupby` groups consecutive equal elements after a mandatory pre-sort; yields `(key, group_iterator)` pairs consumed once.
> - `zip` pairs elements from parallel iterables positionally, stopping at the shortest — equivalent to C# `Zip`.
> - Nested comprehensions (`[x for outer in col for x in outer]`) replace C# `SelectMany`; `set(...)` deduplicates.
> - Dictionary lookups replace C# `Join`; `defaultdict(list)` handles left-join fan-out without key-presence checks.
>
> **Pandas vs Polars Analytics**
> - The pandas examples query SQL Server with a `2026-03-12` snapshot cutoff, and the Polars examples read the matching Parquet snapshot so the preserved outputs stay aligned at 66,355 OHLCV rows and 466 score rows.
> - Operations shown side-by-side: row/column subsetting, filter, groupby+aggregate, join, window functions, sort.
> - Pandas is mutable and index-aware; Polars is immutable, Arrow-backed, and expression-oriented.
> - The comparison matrix focuses on indexing, execution model, lazy planning, ecosystem fit, and memory trade-offs rather than universal speed claims.

> [!note]- Glossary
>
> **`TypeVar`**
> - A placeholder for a type that the static checker (mypy, pyright) resolves at each call site: `T = TypeVar('T')`.
> - Enables writing functions and classes that work on any type while retaining full type-checker coverage across the call graph.
> - Runtime behavior is unchanged: `TypeVar` exists for static analysis only, so the interpreter does not enforce or dispatch on it.
>
>  ---
>
> **`Generic[T]`**
> - Base class for parameterised classes: `class Stack(Generic[T])` tells the type checker to track the inner type `T` through every method.
> - Used for custom container classes and typed wrappers; when built-in containers (`list`, `dict`) suffice, no custom class is needed.
> - If you omit `Generic[T]`, the class still works at runtime, but callers lose type propagation through the API.
>
>  ---
>
> **`bound` (TypeVar bound)**
> - `TypeVar('T', bound=SomeClass)` restricts `T` to subtypes of `SomeClass`, enabling method calls on `T` that are only safe for that type.
> - Essential when the generic function must call a method (e.g., `__lt__` for sorting, `.close()` for resources) that is not defined on arbitrary objects.
> - `bound=X` accepts any subtype of `X`; constrained form such as `TypeVar('T', X, Y)` accepts only the listed types.
>
>  ---
>
> **`Protocol`**
> - Structural typing interface from `typing`: any class with the required method signatures satisfies the protocol without explicit inheritance.
> - Defines contracts for duck-typed code that mypy can verify statically — the Python equivalent of C# interface checking without the inheritance overhead.
> - Without `@runtime_checkable`, `isinstance(obj, MyProtocol)` raises `TypeError`; add the decorator only when runtime checks are part of the design.
>
>  ---
>
> **duck typing**
> - Python's default polymorphism model: if an object has the right methods and attributes, it works — no base class, interface, or generic declaration required.
> - Most Python code is naturally generic through duck typing; `TypeVar` and `Generic` add optional static-analysis safety on top without changing this behaviour.
> - Avoid over-constraining with `isinstance()` when the operation itself is the contract; prefer Protocol annotations or direct method use.
>
>  ---
>
> **comprehension**
> - Concise syntax for building collections in a single expression: `[expr for x in iter if cond]` (list), `{k: v for ...}` (dict), `{x for ...}` (set).
> - Python's primary replacement for C# LINQ `Select`/`Where` chains; generally faster than equivalent `for` loops due to CPython bytecode optimisation.
> - Beyond two levels of nesting, readability drops quickly; prefer explicit loops or `itertools` helpers for multi-stage transforms.
>
>  ---
>
> **generator expression**
> - Lazy comprehension using `()` instead of `[]`: `(x*2 for x in items)`. Yields items one at a time without building the full list in memory.
> - Essential for processing large datasets — a generator of 10 M rows uses constant memory regardless of the dataset size.
> - Generators are single-pass; materialise with `list()` if the data must be reused.
>
>  ---
>
> **`map` / `filter` / `reduce`**
> - Functional built-ins: `map(func, iter)` applies a function to every element, `filter(pred, iter)` keeps elements where the predicate is `True`, `functools.reduce(func, iter)` folds the sequence into a single value left-to-right.
> - Python's closest equivalents to C# LINQ method-syntax chains (`Select`, `Where`, `Aggregate`).
> - `map()` and `filter()` return iterators, not lists; `reduce` lives in `functools` and returns the accumulated scalar result.
>
>  ---
>
> **`itertools`**
> - Standard library module with efficient iterator combinators: `groupby`, `chain`, `islice`, `product`, `combinations`, `permutations`, `repeat`, `cycle`.
> - Enables advanced iteration patterns — grouping, windowing, Cartesian products, infinite sequences — without loading data into memory.
> - `groupby` groups consecutive equal elements, not all matching values globally, so sort by the grouping key first when you want SQL-style grouping.
>
>  ---
>
> **pandas**
> - Mutable DataFrame library for tabular analysis, with deep integration across notebook, plotting, and ML ecosystems.
> - View-vs-copy ambiguity matters during assignment: prefer `.loc[...]` or `.copy()` when modifying slices.
>
>  ---
>
> **Polars**
> - Immutable, Rust-backed DataFrame library built around Arrow columns and expression-oriented transforms.
> - Often faster and more memory-efficient on analytical workloads, but there is no row-label index, so row filtering uses expressions instead of `.loc[]`.
>
>  ---
>
> **lazy evaluation (Polars)**
> - Polars builds a logical query plan without executing it when the API is called in lazy mode (`.lazy()`); `.collect()` triggers optimised execution.
> - Predicate pushdown and projection pruning happen at collection time, so keep the plan lazy until the point where you need a materialised frame.
> - A `LazyFrame` is not data yet; call `.collect()` before inspection or library handoff.
>
>  ---
>
> **Apache Arrow**
> - Columnar in-memory data format used by Polars as its internal storage layer. Enables zero-copy reads between Arrow-compatible libraries and efficient Parquet/IPC I/O.
> - Columnar layout improves cache locality for analytical scans, and it matters most when moving data between Arrow-compatible systems such as Polars, PyArrow, and DuckDB.
> - Arrow is the storage/interchange layer, not the primary user-facing API in this note.

Python is already generic at runtime through duck typing: any object with the required methods can participate in the operation. Type hints add static contracts when you want library-grade APIs, and the later iterator and DataFrame sections show the common Python equivalents for C# LINQ-style transforms.

```python
from typing import Callable, Generic, Optional, Protocol, TypeVar, runtime_checkable
from itertools import groupby
from collections import defaultdict
from functools import reduce
import pandas as pd
import numpy as np
import pyodbc
import polars as pl
```

## Generics

Python's type system is fundamentally different from C#'s. Duck typing already gives you runtime flexibility, while the `typing` module adds optional static contracts for editors, CI, and reusable APIs. The examples below move from implicit generic behavior to bounded type variables and structural typing.

### Python | Generics | duck typing, bounds, and structural typing

These examples show where Python stays dynamic by default and where `typing` adds useful guarantees without changing the runtime dispatch model.

#### Duck typing — no generics needed

Python's dynamic typing means functions work on any iterable — list, tuple, string, set, generator — without type declarations. This is "duck typing": if it quacks like a duck, it's a duck. Simpler than C#/Java generics for most use cases. For public library APIs, add type hints for documentation and type checking.

```python
def first_element(items):
    """Works with ANY iterable — list, tuple, string, set..."""
    for item in items:
        return item
    return None

print(first_element([1, 2, 3]))
print(first_element("hello"))
print(first_element((10, 20)))
```

```text
1
h
10
```

#### TypeVar — generic type hints

This cell uses both an unconstrained `TypeVar` and a constrained one. The output proves that the annotations preserve the original runtime values while giving the type checker enough information to track `int`, `str`, and numeric-only call sites separately.

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

print(add(3, 4))
print(add(3.5, 4.5))
# add("a", "b")  # type checker flags this — Python still runs it
```

```text
int: 1, str: a
7
8.0
```

#### Bounded TypeVar — method access from a bound

Use `bound=` when generic code needs a method or protocol that arbitrary objects do not have. Here the bound guarantees `abs()` is valid for every item, so the function can return the original concrete type instead of falling back to `object`.

```python
class SupportsAbs(Protocol):
    def __abs__(self) -> float: ...

AbsT = TypeVar("AbsT", bound=SupportsAbs)

def largest_magnitude(values: list[AbsT]) -> AbsT:
    return max(values, key=abs)

print(largest_magnitude([3, -7, 2]))
print(largest_magnitude([1.5, -4.25, 2.0]))
```

```text
-7
-4.25
```

#### Protocol — structural typing without inheritance

`Protocol` lets the type checker reason about capabilities instead of ancestry. The runtime check is optional: with `@runtime_checkable`, `isinstance()` succeeds for objects that implement the required method, even if they never inherit from the protocol.

```python
@runtime_checkable
class SupportsClose(Protocol):
    def close(self) -> str: ...

class FileHandle:
    def close(self) -> str:
        return "closed file handle"

class Logger:
    def write(self, message: str) -> None:
        pass

handle = FileHandle()
print(isinstance(handle, SupportsClose))
print(handle.close())
print(isinstance(Logger(), SupportsClose))
```

```text
True
closed file handle
False
```

#### Generic class — Generic[T]

Inherit from `Generic[T]` so the type checker tracks what's inside. The last lines also demonstrate runtime erasure: the parameterized stacks share the same runtime class, and `isinstance(..., Stack[int])` is not allowed.

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
print(int_stack)
print(int_stack.pop())

str_stack: Stack[str] = Stack()
str_stack.push("hello")
str_stack.push("world")
print(str_stack)
print(type(int_stack) is type(str_stack))
try:
    print(isinstance(int_stack, Stack[int]))
except TypeError as exc:
    print(type(exc).__name__)
    print(exc)
```

```text
Stack([1, 2, 3])
3
Stack(['hello', 'world'])
True
TypeError
Subscripted generics cannot be used with class and instance checks
```

#### Common generic type annotations — built-in collections and typing aliases

PEP 585 moved the core collection generics onto the built-in container types in Python 3.9+, but helpers such as `Optional` and `Callable` still come from `typing` unless you use newer syntax such as `str | None`.

| Annotation | Meaning | Import note |
|---|---|---|
| `list[int]` | Typed list | Built-in in Python 3.9+ |
| `dict[str, int]` | Typed dictionary | Built-in in Python 3.9+ |
| `set[str]` | Typed set | Built-in in Python 3.9+ |
| `tuple[int, str]` | Fixed-length typed tuple | Built-in in Python 3.9+ |
| `Optional[str]` | `str` or `None` | Import from `typing`, or write `str | None` |
| `Callable[[int], bool]` | Function signature | Import from `typing` |

## Functional Data Processing

Python's built-in functional tools provide the same pipeline vocabulary as C# LINQ, but they operate on plain iterables rather than query objects. This section shows the core iterator behaviors first, then applies the same ideas to grouping, joining, zipping, and flattening.

### Python | Functional tools | generators, map/filter/reduce, groupby, zip

The examples below use the same employee/department data as the C# note, expressed as plain dictionaries.

#### Sample data

This shared setup keeps the later examples focused on the transformation itself. The records are simple enough to show grouping, joining, sorting, and flattening without hiding the iterator behavior behind a larger framework.

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

#### Generator expressions — lazy and single-pass

Generator expressions are the lazy companion to list comprehensions. The output shows that values are produced only as they are consumed, and that a generator is empty once it has been exhausted.

```python
squares = (x * x for x in range(4))
print(next(squares))
print(list(squares))
print(list(squares))
```

```text
0
[1, 4, 9]
[]
```

#### map(), filter(), and reduce()

This example covers the three standard-library functions that most directly mirror LINQ method chains. The output proves that `map()` and `filter()` are iterator-producing wrappers, while `reduce()` returns the final scalar result.

```python
nums = [1, 2, 3, 4]
mapped = map(lambda x: x * 10, nums)
filtered = filter(lambda x: x % 2 == 0, nums)

print(type(mapped).__name__)
print(type(filtered).__name__)
print(list(mapped))
print(list(filtered))
print(reduce(lambda acc, x: acc + x, nums, 0))
```

```text
map
filter
[10, 20, 30, 40]
[2, 4]
10
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

Side-by-side analytics on the same preserved snapshot boundary. Pandas reads SQL Server with an explicit `2026-03-12` cutoff, while Polars reads the matching Parquet extract so the HTML evidence tables remain comparable across both libraries.

### Python | Data setup | SQL Server connection and data loading

This setup cell is the boundary between live data access and the preserved notebook evidence below. The password is read from an environment variable instead of being embedded in the note, and the date cutoff keeps the pandas SQL result aligned with the stored Polars snapshot and captured outputs.

#### Connect to SQL Server and load data

The code below loads the shared OHLCV and score slices that the pandas and Polars examples reuse later. The output confirms the aligned row counts, symbol count, and date range for the frozen snapshot used by this note.

```python
import os
from sqlalchemy import create_engine
from urllib.parse import quote_plus

snapshot_end = "2026-03-12"
odbc_str = (
    'DRIVER={ODBC Driver 18 for SQL Server};'
    'SERVER=localhost,1434;DATABASE=stoxx;'
    f"UID=sa;PWD={os.environ['STOXX_SQL_PASSWORD']};"
    'Encrypt=yes;TrustServerCertificate=yes;'
)
engine = create_engine(f'mssql+pyodbc:///?odbc_connect={quote_plus(odbc_str)}')

ohlcv = pd.read_sql(
    f"SELECT symbol, date, [open], high, low, [close], adj_close, volume "
    f"FROM silver.eurostoxx50_ohlcv WHERE date <= '{snapshot_end}'",
    engine,
)
scores = pd.read_sql(
    f"SELECT symbol, sector, country, composite_score, composite_rank, "
    f"momentum_score, current_price, ytd_change_pct "
    f"FROM gold.scores_daily WHERE score_date <= '{snapshot_end}'",
    engine,
)

pldf = pl.read_parquet('C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet')

print(f"  Pandas: {len(ohlcv):,} rows, {ohlcv.symbol.nunique()} symbols")
print(f"  Polars: {pldf.height:,} rows")
print(f"  Date range: {ohlcv.date.min()} to {ohlcv.date.max()}")
print(f"  Scores rows: {len(scores):,}")
```

```text
  Pandas: 66,355 rows, 50 symbols
  Polars: 66,355 rows
  Date range: 2021-01-04 to 2026-03-12
  Scores rows: 466
```

### Subsetting

These pairs show the closest pandas and Polars equivalents for row slicing, column projection, and symbol-specific subsets on the same OHLCV snapshot.

#### Pandas — Subset rows by slicing with iloc[]

`iloc[100:103]` slices rows by integer position while leaving the original labeled index intact. The output proves pandas returns three consecutive rows with their existing row labels still visible.

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

`slice(100, 3)` is the Polars equivalent of positional row slicing. The output shows the same three-row window without a separate pandas-style index column.

```python
pldf.slice(100, 3)
```

<div>
<!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21260</td><td>&quot;ABI.BR&quot;</td><td>2021-05-26</td><td>61.99</td><td>62.39</td><td>61.83</td><td>62.12</td><td>58.6701</td><td>940186</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21261</td><td>&quot;ABI.BR&quot;</td><td>2021-05-27</td><td>61.8</td><td>62.64</td><td>61.73</td><td>62.13</td><td>58.6795</td><td>1796477</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21262</td><td>&quot;ABI.BR&quot;</td><td>2021-05-28</td><td>62.14</td><td>62.58</td><td>61.96</td><td>62.34</td><td>58.8779</td><td>1004125</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

#### Pandas — Subset columns with double-bracket notation

Double brackets keep the result as a DataFrame instead of collapsing to a Series. The output confirms that only the requested four columns are materialized.

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

Polars uses `select()` for column projection, even in the simplest cases. The output shows the matching four-column subset plus explicit schema metadata above the table.

```python
pldf.select('symbol', 'date', 'close', 'volume').head(5)
```

<div>
<!-- shape: (5, 4) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>1513937</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td><td>1382722</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td><td>1370204</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.4</td><td>1469911</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>57.86</td><td>1428681</td></tr></tbody></table></div>

#### Pandas — Subset single row with iloc[n]

Selecting one row with `iloc[0]` returns a Series keyed by column name. The output proves pandas collapses the row into a one-dimensional labeled result rather than a one-row DataFrame.

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

`row(0, named=True)` materializes one record as a Python mapping. The text output shows that Polars returns named scalar values instead of a pandas Series.

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

This uses a boolean mask with `loc[]` to keep only `date` and `close` for one symbol. The output confirms pandas combines row filtering and column selection in a single label-oriented expression.

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

Polars has no row-label index, so the same subset is expressed as `filter()` followed by `select()`. The output shows the equivalent ASML date/close slice with the Polars schema banner.

```python
pldf.filter(pl.col('symbol') == 'ASML.AS').select('date', 'close').head(5)
```

<div>
<!-- shape: (5, 2) --><table><thead><tr><th>date</th><th>close</th></tr><tr><td>date</td><td>f64</td></tr></thead><tbody><tr><td>2021-01-04</td><td>406.25</td></tr><tr><td>2021-01-05</td><td>406.9</td></tr><tr><td>2021-01-06</td><td>402.85</td></tr><tr><td>2021-01-07</td><td>403.9</td></tr><tr><td>2021-01-08</td><td>416.05</td></tr></tbody></table></div>

#### Pandas — Subset multiple rows with iloc index

Passing a list of integer positions selects non-contiguous rows in the order requested. The output shows pandas preserving the original row labels for those sampled positions.

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

Indexing with a list pulls the same non-contiguous rows by position in Polars. The output confirms the selected records are returned without a dedicated row index.

```python
pldf[[0, 50, 100, 500]]
```

<div>
<!-- shape: (4, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21210</td><td>&quot;ABI.BR&quot;</td><td>2021-03-15</td><td>52.32</td><td>53.05</td><td>52.18</td><td>52.29</td><td>48.9686</td><td>1253312</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21260</td><td>&quot;ABI.BR&quot;</td><td>2021-05-26</td><td>61.99</td><td>62.39</td><td>61.83</td><td>62.12</td><td>58.6701</td><td>940186</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21660</td><td>&quot;ABI.BR&quot;</td><td>2022-12-09</td><td>56.64</td><td>56.96</td><td>56.54</td><td>56.88</td><td>54.2262</td><td>1098905</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

#### Pandas — Select columns

This is the minimal pandas projection pattern used throughout notebook work. The output confirms the frame is reduced to the requested three columns and keeps the default tabular display.

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

The equivalent Polars projection stays expression-oriented even when no computation is involved. The output shows the same three-column shape with inferred dtypes.

```python
pldf.select('symbol', 'date', 'close').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.4</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>57.86</td></tr></tbody></table></div>

#### Pandas — Filter rows

This boolean mask keeps only ASML rows whose close is above 600 and then projects the relevant columns. The output proves pandas evaluates the mask eagerly and returns only matching rows.

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

The same predicate becomes a column expression in Polars. The output confirms the filtered subset matches the pandas result while keeping the expression syntax explicit.

```python
pldf.filter((pl.col('symbol') == 'ASML.AS') & (pl.col('close') > 600)).select('symbol', 'date', 'close').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2021-07-14</td><td>609.1</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-07-22</td><td>620.8</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-07-23</td><td>638.8</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-07-26</td><td>638.0</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-07-27</td><td>623.0</td></tr></tbody></table></div>

#### Pandas — Sort

`sort_values(..., ascending=False)` ranks the rows by trading volume. The output shows the highest-volume days rising to the top of the frame.

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

Polars sorts the same snapshot with `descending=True` and then projects the interesting columns. The output confirms the same top-volume records are surfaced.

```python
pldf.sort('volume', descending=True).select('symbol', 'date', 'volume').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>volume</th></tr><tr><td>str</td><td>date</td><td>i64</td></tr></thead><tbody><tr><td>&quot;ISP.MI&quot;</td><td>2023-08-08</td><td>376391539</td></tr><tr><td>&quot;SAN.MC&quot;</td><td>2021-10-20</td><td>367211467</td></tr><tr><td>&quot;ISP.MI&quot;</td><td>2023-05-31</td><td>317362978</td></tr><tr><td>&quot;ISP.MI&quot;</td><td>2023-03-13</td><td>311886033</td></tr><tr><td>&quot;SAN.MC&quot;</td><td>2021-11-03</td><td>306973344</td></tr></tbody></table></div>

#### Pandas — Add computed column

`assign()` creates a derived `range` column without mutating the original DataFrame in place. The output proves the calculated high-minus-low spread is available alongside the original columns.

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

`with_columns()` is the Polars equivalent for derived expressions. The output shows the same `range` calculation added as a new column in the returned frame.

```python
pldf.with_columns((pl.col('high') - pl.col('low')).alias('range')).select('symbol', 'close', 'range').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>close</th><th>range</th></tr><tr><td>str</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>57.21</td><td>2.07</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>57.18</td><td>1.23</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>58.77</td><td>1.55</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>58.4</td><td>0.98</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>57.86</td><td>0.97</td></tr></tbody></table></div>

### Aggregations

These examples translate SQL-style `GROUP BY` and `HAVING` logic into the native pandas and Polars aggregation APIs.

#### Pandas — GroupBy with aggregates

This groups rows by `symbol` and computes multiple aggregate columns in one pass. The output confirms pandas returns one row per symbol with named summary metrics.

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

Polars performs the same grouped reduction with expression-based aggregations. The output shows the grouped result as a regular DataFrame with explicit schema metadata.

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

This reproduces SQL `HAVING` behavior by aggregating first and filtering the grouped result afterward. The output proves the threshold is applied to per-symbol summaries rather than raw rows.

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

The Polars version applies the same post-aggregation filter inside an expression pipeline. The output shows only the groups that survive the aggregate condition.

```python
pldf.group_by('symbol').agg(
    pl.col('volume').mean().alias('avg_vol')
).filter(pl.col('avg_vol') > 5_000_000).sort('avg_vol', descending=True)
```

<div>
<!-- shape: (11, 2) --><table><thead><tr><th>symbol</th><th>avg_vol</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ISP.MI&quot;</td><td>8.7589e7</td></tr><tr><td>&quot;SAN.MC&quot;</td><td>4.1771e7</td></tr><tr><td>&quot;ENEL.MI&quot;</td><td>2.4679e7</td></tr><tr><td>&quot;BBVA.MC&quot;</td><td>1.6654e7</td></tr><tr><td>&quot;UCG.MI&quot;</td><td>1.3904e7</td></tr><tr><td>&hellip;</td><td>&hellip;</td></tr><tr><td>&quot;INGA.AS&quot;</td><td>1.2804e7</td></tr><tr><td>&quot;IBE.MC&quot;</td><td>1.2035e7</td></tr><tr><td>&quot;DTE.DE&quot;</td><td>7.5751e6</td></tr><tr><td>&quot;NDA-FI.HE&quot;</td><td>5.3755e6</td></tr><tr><td>&quot;TTE.PA&quot;</td><td>5.1381e6</td></tr></tbody></table></div>

### Window Functions

Window functions let each row see neighboring or group-level context without collapsing the dataset. The pairs below keep the same ASML slice or per-symbol partition so the pandas and Polars semantics stay comparable.

#### Pandas — Window Function LAG()

`shift(1)` aligns each close with the prior trading day's close after sorting by date. The output proves the first row has no lag value and later rows inherit the previous close.

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

Polars expresses the same lag with a shifted column over the filtered symbol slice. The output shows the same prior-close alignment as the pandas example.

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

This builds a running total of ASML volume over time. The output confirms the cumulative value increases row by row in date order.

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

The Polars version computes the same running total as a column expression. The output shows the cumulative sum growing across the ordered rows.

```python
pldf.filter(pl.col('symbol') == 'ASML.AS').sort('date').with_columns(
    pl.col('volume').cum_sum().over('symbol').alias('cum_vol')
).select('date', 'volume', 'cum_vol').tail(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>date</th><th>volume</th><th>cum_vol</th></tr><tr><td>date</td><td>i64</td><td>i64</td></tr></thead><tbody><tr><td>2026-03-06</td><td>857271</td><td>942889692</td></tr><tr><td>2026-03-09</td><td>689086</td><td>943578778</td></tr><tr><td>2026-03-10</td><td>800815</td><td>944379593</td></tr><tr><td>2026-03-11</td><td>562904</td><td>944942497</td></tr><tr><td>2026-03-12</td><td>128223</td><td>945070720</td></tr></tbody></table></div>

#### Pandas — Window Function AVG() Moving Average

This applies a rolling average to smooth short-term price movement. The output shows the moving-average column filling in only once enough rows exist for the configured window.

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

Polars computes the same moving window as an expression over the ordered slice. The output confirms the rolling average aligns with the pandas result.

```python
pldf.filter(pl.col('symbol') == 'ASML.AS').sort('date').with_columns(
    pl.col('close').rolling_mean(20).over('symbol').alias('sma_20')
).select('date', 'close', 'sma_20').tail(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>date</th><th>close</th><th>sma_20</th></tr><tr><td>date</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-03-06</td><td>1147.0</td><td>1214.02</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1211.16</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>1211.51</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1211.06</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1211.61</td></tr></tbody></table></div>

#### Pandas — Window Function ROW_NUMBER()

Here `rank(..., method='first')` emulates `ROW_NUMBER()` within each symbol partition. The output proves ranking restarts per symbol and orders rows by descending volume.

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

Polars assigns the same per-symbol ranking through expressions rather than a mutable helper column. The output shows the generated row numbers beside the source rows.

```python
pldf.with_columns(
    pl.col('volume').rank(descending=True).over('symbol').alias('vol_rank')
).filter(pl.col('vol_rank') == 1).sort('volume', descending=True).select('symbol', 'date', 'volume').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>volume</th></tr><tr><td>str</td><td>date</td><td>i64</td></tr></thead><tbody><tr><td>&quot;ISP.MI&quot;</td><td>2023-08-08</td><td>376391539</td></tr><tr><td>&quot;SAN.MC&quot;</td><td>2021-10-20</td><td>367211467</td></tr><tr><td>&quot;BBVA.MC&quot;</td><td>2021-09-17</td><td>228528294</td></tr><tr><td>&quot;NDA-FI.HE&quot;</td><td>2022-09-16</td><td>140675854</td></tr><tr><td>&quot;PRX.AS&quot;</td><td>2021-08-17</td><td>114772834</td></tr></tbody></table></div>

#### Pandas — Window Function LEAD()

This looks ahead to the next trading day and measures the calendar gap between rows. The output proves weekends and holidays appear as multi-day jumps even though market rows remain consecutive.

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

The Polars version computes the same next-date and gap calculation on the ordered symbol slice. The output shows the identical five-day holiday/weekend gaps as preserved notebook evidence.

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

These examples move from aggregated price summaries into cross-table analytics by merging the OHLCV snapshot with the score snapshot.

#### Pandas — JOIN

This merges average close per symbol with the score table. Because `scores` contains multiple scoring dates per symbol inside the preserved snapshot, the output intentionally shows repeated join matches rather than a deduplicated dimension table.

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

Polars performs the same join after converting the score slice into a Polars DataFrame. The repeated rows in the output confirm the same join cardinality as the pandas example.

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

This computes annualized volatility from percentage returns per symbol. The output ranks symbols by realized volatility, with the most volatile names at the top.

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

Polars derives the same annualized standard deviation from per-symbol returns. The output confirms the same high-volatility symbols appear first.

```python
pldf.sort('symbol', 'date').with_columns(
    pl.col('close').pct_change().over('symbol').alias('ret')
).group_by('symbol').agg(
    (pl.col('ret').std() * (252 ** 0.5) * 100).alias('annual_vol_%')
).sort('annual_vol_%', descending=True).head(10)
```

<div>
<!-- shape: (10, 2) --><table><thead><tr><th>symbol</th><th>annual_vol_%</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ADYEN.AS&quot;</td><td>50.295865</td></tr><tr><td>&quot;ENR.DE&quot;</td><td>50.045128</td></tr><tr><td>&quot;RHM.DE&quot;</td><td>40.84623</td></tr><tr><td>&quot;PRX.AS&quot;</td><td>39.715469</td></tr><tr><td>&quot;ARGX.BR&quot;</td><td>39.305925</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>37.624556</td></tr><tr><td>&quot;IFX.DE&quot;</td><td>37.249051</td></tr><tr><td>&quot;UCG.MI&quot;</td><td>35.550249</td></tr><tr><td>&quot;VOW.DE&quot;</td><td>35.509649</td></tr><tr><td>&quot;ADS.DE&quot;</td><td>34.372174</td></tr></tbody></table></div>

### Data modification patterns

These examples mirror insert-, update-, delete-, and drop-style transformations without writing back to storage. Each one returns a transformed frame so the effect is visible immediately in the preserved output.

#### Pandas — Add rows

`pd.concat()` appends a synthetic one-row DataFrame to the existing snapshot. The output proves the new `TEST.XX` row lands at the bottom and leaves missing derived columns such as `vol_rank` empty.

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

`vstack()` appends a schema-compatible row built from an existing template. The output shows why that template matters: fields you do not override, such as `id`, `date`, and `adj_close`, are inherited from the source row.

```python
new_row = pldf.head(1).with_columns(
    pl.lit('TEST.XX').alias('symbol'), pl.lit(102.0).alias('close'), pl.lit(50000).cast(pl.Int64).alias('volume'))
pldf.vstack(new_row).tail(3)
```

<div>
<!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>66877</td><td>&quot;WKL.AS&quot;</td><td>2026-03-11</td><td>67.5</td><td>69.6</td><td>67.02</td><td>67.22</td><td>67.22</td><td>1142531</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>66929</td><td>&quot;WKL.AS&quot;</td><td>2026-03-12</td><td>67.0</td><td>67.54</td><td>66.28</td><td>67.32</td><td>67.32</td><td>210379</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21160</td><td>&quot;TEST.XX&quot;</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>102.0</td><td>53.5761</td><td>50000</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

#### Pandas — Update column

This recalculates `adj_close` for one symbol with `assign()` and returns the modified slice. The output proves the new values are computed from the current `close` column instead of mutating the base frame in place.

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

The Polars version overwrites `adj_close` in the returned expression result. The output shows the same recalculated values for the first ASML rows.

```python
pldf.filter(pl.col('symbol') == 'ASML.AS').with_columns(
    (pl.col('close') * 1.05).alias('adj_close')
).select('symbol', 'date', 'adj_close').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>adj_close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-04</td><td>426.5625</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-05</td><td>427.245</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-06</td><td>422.9925</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-07</td><td>424.095</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-08</td><td>436.8525</td></tr></tbody></table></div>

#### Pandas — Delete rows

This removes ASML rows with a negated boolean mask and compares the row counts. The text output proves the filter drops exactly the ASML slice from the snapshot.

```python
filtered = ohlcv[ohlcv.symbol != 'ASML.AS']
print(f"  {len(ohlcv)} - ASML rows = {len(filtered)} remaining")
```

```text
66355 - ASML rows = 65024 remaining
```

#### Polars — Delete rows

Polars expresses the same delete-style operation as a filter that keeps every other symbol. The output confirms the remaining row count matches the pandas result.

```python
filtered = pldf.filter(pl.col('symbol') != 'ASML.AS')
print(f"  {pldf.height} - ASML rows = {filtered.height} remaining")
```

```text
66355 - ASML rows = 65024 remaining
```

#### Pandas — Drop column

`drop(columns=...)` removes housekeeping fields from the displayed frame. The output proves the requested columns are gone while the rest of the schema stays intact.

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

Polars drops the same housekeeping columns with a positional expression-style call. The output shows the frame reduced to the retained nine columns.

```python
pldf.drop('dividends', 'stock_splits', 'is_filled').head(3)
```

<div>
<!-- shape: (3, 9) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>21160</td><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td></tr><tr><td>21161</td><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td></tr><tr><td>21162</td><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td></tr></tbody></table></div>

## Pandas vs Polars — Comparison Matrix

| Feature | Pandas | Polars |
|---------|--------|--------|
| **Engine** | NumPy-backed DataFrame library with C/Cython kernels | Rust query engine over Arrow-style columnar data |
| **Memory model** | Mutable; copies depend on operation and settings | Immutable, expression-oriented columns |
| **Index** | Optional row index with `.loc[]` and `.iloc[]` | No row-label index; positional rows plus expressions |
| **Evaluation model** | Eager DataFrame operations | Eager frames plus optional lazy query plans via `.lazy()` |
| **Parallelism** | Some vectorized kernels release the GIL, but many workflows remain effectively single-threaded | Multithreaded execution for many operations by default |
| **String handling** | `object`, `string`, or Arrow-backed string dtypes depending on configuration | Arrow UTF-8 strings by default |
| **Missing values** | `NaN`, `None`, and `pd.NA` depending on dtype | `null` as a first-class value across dtypes |
| **GroupBy** | Split-apply-combine API | Expression-based grouped aggregations |
| **Window functions** | `shift()`, `rolling()`, `rank()`, `transform()` | `over()` expressions plus rolling/window helpers |
| **Joins** | `.merge(on=, how=)` | `.join(on=, how=)` |
| **SQL support** | `read_sql*()` via SQLAlchemy / DBAPI connectors | SQL surface via `SQLContext` / `pl.sql`, with expressions as the primary API |
| **Large-file scans** | Chunked reads at the IO boundary; in-memory work stays eager | Lazy scans such as `scan_parquet()` can reduce memory and push filters earlier |
| **Ecosystem** | Default target for many notebook, plotting, and ML libraries | Growing ecosystem with `.to_pandas()` as a common bridge |
| **Learning curve** | Lower if you already know notebook-style pandas | Higher until the expression API becomes familiar |

### When to use Pandas

- **Notebook exploration and plotting** — pandas remains the default target for many examples, charting libraries, and ad hoc analysis flows.
- **ML and statistics interop** — scikit-learn, statsmodels, and many feature-engineering utilities still expect pandas objects directly.
- **Index-heavy workflows** — labeled time-series and multi-index operations are more natural when row indices are part of the design.
- **Existing pandas codebases** — if the pipeline already works and is not bottlenecked, pandas is usually the cheaper operational choice.

### When to use Polars

- **Large analytical workloads** — Polars often shines when wide or tall datasets can stay in vectorized column expressions.
- **Lazy ETL pipelines** — `.lazy()` plus scan APIs help push filters and projections earlier in the plan.
- **Memory-sensitive batch transforms** — immutable columnar execution reduces some of the copy and Python-object overhead common in pandas workflows.
- **Arrow- and Parquet-centered stacks** — Polars fits naturally when the rest of the pipeline already speaks columnar formats.

## Operational constraints and diagnostics

### Typing and iterator rules

#### `Optional`, `Callable`, and `list[int]` follow different syntax eras

`list[int]`, `dict[str, int]`, and similar container annotations are built-in syntax in Python 3.9+, but `Optional` and `Callable` still come from `typing` unless you adopt newer alternatives such as `str | None`. If you need compatibility with Python versions older than 3.9, use `typing.List[...]` or `from __future__ import annotations` instead of assuming the built-in generic syntax exists.

#### Missing `Generic[T]` and mypy assignment errors usually have the same root cause

When mypy reports an incompatible assignment in generic code, the problem is often that the type variable stopped propagating through the API. The usual fixes are to inherit from `Generic[T]`, annotate the internal storage with the same `T`, and then correct whichever assignment or return path drifted away from the declared type.

#### Iterator exhaustion and `groupby()` ordering are consumption problems

The generator and `map()` examples above show why iterator pipelines are single-pass: once consumed, they are empty. `itertools.groupby()` has a related constraint in a different dimension: it only groups consecutive equal keys, so sort first when you want SQL-style grouping, or use `defaultdict(list)` when a one-pass accumulation is clearer.

### Pandas constraints

#### Chained assignment and nullable integer handling

`SettingWithCopyWarning` exists because `df[mask][col] = ...` may target a temporary slice instead of the original frame. Use `.loc[...]` for in-place updates or `.copy()` when you want an isolated slice. For integer columns that may hold missing values later, prefer nullable dtypes such as `pd.Int64Dtype()` so pandas does not silently promote the whole column to `float64`.

#### Row-wise pandas APIs and timestamp edges

Row-wise helpers such as `.apply(axis=1)` and `.iterrows()` materialize Python objects and usually cost more memory and CPU than vectorized expressions. Also keep temporal precision in mind: pandas timestamps use nanosecond semantics with an upper bound around year 2262, so cross-library time handling can diverge once you move between pandas, Arrow, and Polars.

### Polars constraints

#### No `.loc[]` and no materialized data until `.collect()`

The subsetting examples above show the first implication of Polars having no row-label index: row filters become explicit expressions such as `.filter(pl.col("symbol") == "ASML.AS")`. The second implication appears in lazy mode: a `LazyFrame` is only a plan until `.collect()` runs it, so inspect or export only after materialization.

#### Schema inspection and pandas handoff still matter

Polars preserves schema predictably, but joins, appends, and interop boundaries are still worth checking explicitly, especially when you build synthetic rows from templates as in the `vstack()` example above. When a downstream visualization or ML library expects pandas, convert at the boundary with `.to_pandas()` rather than bouncing back and forth mid-pipeline.


