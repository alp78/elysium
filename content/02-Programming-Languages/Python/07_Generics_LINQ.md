---
type: reference
category: programming-languages
technology: [python]
tags: [reference, programming-languages, python, generics]
aliases: [generics, LINQ, type parameters, generic collections, comprehensions, functional programming]
keywords: [generics, TypeVar, Generic, Protocol, map, filter, reduce, itertools, functools, comprehension]
description: "Python generics and functional data processing reference with executable examples and cell outputs — covers TypeVar, Generic classes, Protocol, functional tools, and itertools. See [[07_Generics_LINQ - CSharp]] for the C# equivalent."
related:
  - "[[07_Generics_LINQ - CSharp]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 07. Generics & Functional Data Processing - Python

## 1. Generics (Type Parameterization)


```python
# Generics — writing code that works with ANY type
#
# KEY CONCEPTS:
# - Generic: code that is parameterized by type. Instead of writing separate functions
#   for int, str, float — write ONE that works with any type T.
#   C# has TRUE generics (enforced at compile time): List<int>, Dictionary<string, int>.
#   Python has DUCK TYPING — everything already works with any type by default.
#   Python's "generics" are type hints only — not enforced at runtime.
# - TypeVar: Python's way to declare a generic type variable for type hints.
# - Generic[T]: base class for creating generic classes with type hints.
# - Python doesn't NEED generics the way C# does, because:
#   - Python lists already hold any type: [1, "hello", True]
#   - Python functions already accept any type (duck typing)
#   - Generics in Python are ONLY for type checker documentation

from typing import TypeVar, Generic, Optional

# === Python doesn't need generics — duck typing handles it ===
print("=== Duck Typing (no generics needed) ===")
def first_element(items):
    """Works with ANY iterable — list, tuple, string, set..."""
    for item in items:
        return item
    return None

print(f"list:   {first_element([1, 2, 3])}")
print(f"string: {first_element('hello')}")
print(f"tuple:  {first_element((10, 20))}")
# No generics needed — Python doesn't care about the type

# === TypeVar — generic type hints (for documentation + type checker) ===
print("\n=== TypeVar (generic type hints) ===")
T = TypeVar("T")                    # T is a placeholder for any type

def first(items: list[T]) -> Optional[T]:
    """Type hint says: list of T in → T out (same type)."""
    return items[0] if items else None

# Type checker knows: list[int] in → int out
result_int: Optional[int] = first([1, 2, 3])
result_str: Optional[str] = first(["a", "b", "c"])
print(f"int: {result_int}, str: {result_str}")

# === Constrained TypeVar ===
print("\n=== Constrained TypeVar ===")
Number = TypeVar("Number", int, float)    # T can only be int or float

def add(a: Number, b: Number) -> Number:
    return a + b

print(f"int:   {add(3, 4)}")
print(f"float: {add(3.5, 4.5)}")
# add("a", "b")  # type checker would flag this (but Python still runs it)

# === Generic class ===
print("\n=== Generic Class ===")
class Stack(Generic[T]):
    """A typed stack — type checker knows what's inside."""
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

# Usage — type checker tracks the type
int_stack: Stack[int] = Stack()
int_stack.push(1)
int_stack.push(2)
int_stack.push(3)
print(f"Stack: {int_stack}")
print(f"Pop:   {int_stack.pop()}")

str_stack: Stack[str] = Stack()
str_stack.push("hello")
str_stack.push("world")
print(f"Stack: {str_stack}")

# === Built-in generic types (you've been using these all along) ===
print("\n=== Built-in Generic Types ===")
print("list[int]              — C#: List<int>")
print("dict[str, int]         — C#: Dictionary<string, int>")
print("set[str]               — C#: HashSet<string>")
print("tuple[int, str]        — C#: (int, string) / ValueTuple")
print("Optional[str]          — C#: string?")
print("Callable[[int], bool]  — C#: Func<int, bool>")

# === Key Difference ===
print("\n=== Python vs C# Generics ===")
print("C#:     generics are ENFORCED — List<int>.Add('hello') = compile error")
print("Python: generics are HINTS — list[int].append('hello') runs fine")
print("C#:     MUST use generics (List<T>, not List)")
print("Python: generics are OPTIONAL (list works without [int])")
print("C#:     generics exist for type SAFETY")
print("Python: generics exist for DOCUMENTATION + IDE support")
```

## 2. Advanced Functional Data Processing


```python
# Advanced Functional Data Processing
# GroupBy, Joins, Aggregations, Chaining
#
# KEY CONCEPTS:
# - GroupBy: split data into groups based on a key, then process each group.
#   C# equivalent: .GroupBy(). SQL equivalent: GROUP BY.
# - Join: combine two datasets based on a matching key.
#   C# equivalent: .Join() / .GroupJoin(). SQL: JOIN.
# - Chained operations: Python doesn't chain like LINQ — uses nested calls,
#   comprehensions, or intermediate variables.

from itertools import groupby
from collections import defaultdict
from functools import reduce

# === Sample data — employee records ===
employees = [
    {"name": "Alice", "dept": "Engineering", "salary": 95000, "level": "senior"},
    {"name": "Bob", "dept": "Sales", "salary": 65000, "level": "junior"},
    {"name": "Charlie", "dept": "Engineering", "salary": 110000, "level": "lead"},
    {"name": "Diana", "dept": "Sales", "salary": 78000, "level": "senior"},
    {"name": "Eve", "dept": "Engineering", "salary": 88000, "level": "junior"},
    {"name": "Frank", "dept": "Marketing", "salary": 72000, "level": "senior"},
]

# === GroupBy — using defaultdict (most common in Python) ===
print("=== GroupBy Department ===")
by_dept = defaultdict(list)
for emp in employees:
    by_dept[emp["dept"]].append(emp)

for dept, members in by_dept.items():
    names = [m["name"] for m in members]
    avg_salary = sum(m["salary"] for m in members) / len(members)
    print(f"  {dept:15} ({len(members)} people): {names} avg=${avg_salary:,.0f}")

# === GroupBy with itertools.groupby (requires pre-sorted data!) ===
print("\n=== itertools.groupby (must sort first!) ===")
sorted_emps = sorted(employees, key=lambda e: e["dept"])
for dept, group in groupby(sorted_emps, key=lambda e: e["dept"]):
    members = list(group)
    print(f"  {dept}: {[m['name'] for m in members]}")

# === Aggregate per group ===
print("\n=== Aggregate: max salary per dept ===")
for dept, members in by_dept.items():
    top = max(members, key=lambda m: m["salary"])
    print(f"  {dept:15} top earner: {top['name']} ${top['salary']:,}")

# === Join — combine two datasets ===
print("\n=== Join (matching by key) ===")
departments = [
    {"dept": "Engineering", "budget": 500000, "head": "CTO"},
    {"dept": "Sales", "budget": 300000, "head": "VP Sales"},
    {"dept": "Marketing", "budget": 200000, "head": "CMO"},
    {"dept": "HR", "budget": 150000, "head": "CHRO"},          # no employees
]

# Inner join — only matching records
# dept_lookup is a dict[str, dict]: key = dept name (str), value = full dept dict
# e.g. {"Engineering": {"dept": "Engineering", "budget": 500000, "head": "CTO"}, ...}
# dict comprehension: build once for O(1) lookups instead of scanning the list each time
dept_lookup = {d["dept"]: d for d in departments}

inner_join = [
    # **emp unpacks all key-value pairs from the employee dict (like JS spread: {...emp})
    # then we add "budget" and "head" from the matched department
    # result: one flat dict with all employee fields + budget + head
    {**emp, "budget": dept_lookup[emp["dept"]]["budget"], "head": dept_lookup[emp["dept"]]["head"]}
    for emp in employees           # iterate every employee
    if emp["dept"] in dept_lookup  # skip if no matching dept (inner join condition)
]
print("Inner join (employees + department info):")
for r in inner_join[:3]:
    print(f"  {r['name']:10} {r['dept']:15} head={r['head']:10} budget=${r['budget']:,}")

# Left join — all employees, departments may be None
print("\nLeft join (all employees, dept info if available):")
for emp in employees[:3]:
    dept = dept_lookup.get(emp["dept"], {}) # empty dict if dept not found
    print(f"  {emp['name']:10} head={dept.get('head', 'N/A')}")

# === Chained transformations ===
print("\n=== Chained Transformations ===")
# Filter → Transform → Sort → Take (like LINQ chain)
result = sorted(
    [
        {"name": e["name"], "salary": e["salary"], "tax": e["salary"] * 0.3}
        for e in employees
        if e["salary"] > 75000
    ],
    key=lambda x: x["salary"],
    reverse=True
)[:3]
print("Top 3 earners (>75k) with tax:")
for r in result:
    print(f"  {r['name']:10} salary=${r['salary']:,}  tax=${r['tax']:,.0f}")

# === Zip — parallel iteration ===
print("\n=== Zip (parallel processing) ===")
names = [e["name"] for e in employees]
salaries = [e["salary"] for e in employees]
raises = [s * 0.1 for s in salaries]

for name, salary, raise_amt in zip(names, salaries, raises):
    print(f"  {name:10} ${salary:>8,} + ${raise_amt:>7,.0f} raise")
```

    === GroupBy Department ===
      Engineering     (3 people): ['Alice', 'Charlie', 'Eve'] avg=$97,667
      Sales           (2 people): ['Bob', 'Diana'] avg=$71,500
      Marketing       (1 people): ['Frank'] avg=$72,000
    
    === itertools.groupby (must sort first!) ===
      Engineering: ['Alice', 'Charlie', 'Eve']
      Marketing: ['Frank']
      Sales: ['Bob', 'Diana']
    
    === Aggregate: max salary per dept ===
      Engineering     top earner: Charlie $110,000
      Sales           top earner: Diana $78,000
      Marketing       top earner: Frank $72,000
    
    === Join (matching by key) ===
    Inner join (employees + department info):
      Alice      Engineering     head=CTO        budget=$500,000
      Bob        Sales           head=VP Sales   budget=$300,000
      Charlie    Engineering     head=CTO        budget=$500,000
    
    Left join (all employees, dept info if available):
      Alice      head=CTO
      Bob        head=VP Sales
      Charlie    head=CTO
    
    === Chained Transformations ===
    Top 3 earners (>75k) with tax:
      Charlie    salary=$110,000  tax=$33,000
      Alice      salary=$95,000  tax=$28,500
      Eve        salary=$88,000  tax=$26,400
    
    === Zip (parallel processing) ===
      Alice      $  95,000 + $  9,500 raise
      Bob        $  65,000 + $  6,500 raise
      Charlie    $ 110,000 + $ 11,000 raise
      Diana      $  78,000 + $  7,800 raise
      Eve        $  88,000 + $  8,800 raise
      Frank      $  72,000 + $  7,200 raise
    

## 3. Pandas vs LINQ — Side-by-Side Comparison


```python
# Pandas — Python's equivalent of C# LINQ for tabular data
# Both do the same thing: filter, transform, group, join, aggregate.
# Pandas uses DataFrames (tables), LINQ uses IEnumerable<T> (collections).
#
# KEY MAPPING:
#   LINQ .Where()        → pandas df[df.col > 5]   or df.query("col > 5")
#   LINQ .Select()       → pandas df[["col1", "col2"]]  or df.assign(new_col=...)
#   LINQ .OrderBy()      → pandas df.sort_values("col")
#   LINQ .GroupBy()      → pandas df.groupby("col")
#   LINQ .Join()         → pandas pd.merge(df1, df2, on="key")
#   LINQ .Take(n)        → pandas df.head(n)
#   LINQ .Skip(n)        → pandas df.iloc[n:]
#   LINQ .Count()        → pandas len(df)  or df.shape[0]
#   LINQ .Sum/Avg/Max()  → pandas df.col.sum() / .mean() / .max()
#   LINQ .Distinct()     → pandas df.drop_duplicates()
#   LINQ .SelectMany()   → pandas df.explode("col")

import pandas as pd

# === Same data as section 2, now as DataFrame ===
df = pd.DataFrame([
    {"name": "Alice", "dept": "Engineering", "salary": 95000, "level": "senior"},
    {"name": "Bob", "dept": "Sales", "salary": 65000, "level": "junior"},
    {"name": "Charlie", "dept": "Engineering", "salary": 110000, "level": "lead"},
    {"name": "Diana", "dept": "Sales", "salary": 78000, "level": "senior"},
    {"name": "Eve", "dept": "Engineering", "salary": 88000, "level": "junior"},
    {"name": "Frank", "dept": "Marketing", "salary": 72000, "level": "senior"},
])
print("=== DataFrame ===")
print(df)

# === Filter (LINQ: .Where) ===
print("\n=== Filter: salary > 75000 ===")
# LINQ: employees.Where(e => e.Salary > 75000)
high_earners = df[df["salary"] > 75000]
print(high_earners)

# Multiple conditions
# LINQ: .Where(e => e.Salary > 75000 && e.Dept == "Engineering")
eng_high = df[(df["salary"] > 75000) & (df["dept"] == "Engineering")]
print(f"\nEngineering >75k:\n{eng_high}")

# === Select columns (LINQ: .Select) ===
print("\n=== Select: name + salary ===")
# LINQ: employees.Select(e => new { e.Name, e.Salary })
print(df[["name", "salary"]])

# Add computed column
# LINQ: .Select(e => new { e.Name, e.Salary, Tax = e.Salary * 0.3 })
df_with_tax = df.assign(tax=df["salary"] * 0.3)
print(f"\nWith tax:\n{df_with_tax[['name', 'salary', 'tax']]}")

# === Sort (LINQ: .OrderBy / .OrderByDescending) ===
print("\n=== Sort: by salary desc ===")
# LINQ: employees.OrderByDescending(e => e.Salary)
print(df.sort_values("salary", ascending=False))

# === GroupBy + Aggregate (LINQ: .GroupBy + aggregations) ===
print("\n=== GroupBy dept + aggregations ===")
# LINQ: employees.GroupBy(e => e.Dept).Select(g => new { Dept = g.Key, Avg = g.Average(...) })
dept_stats = df.groupby("dept").agg(
    count=("name", "count"),
    avg_salary=("salary", "mean"),
    max_salary=("salary", "max"),
    min_salary=("salary", "min"),
    total_salary=("salary", "sum"),
).round(0)
print(dept_stats)

# === Join / Merge (LINQ: .Join) ===
print("\n=== Join: employees + departments ===")
dept_df = pd.DataFrame([
    {"dept": "Engineering", "budget": 500000, "head": "CTO"},
    {"dept": "Sales", "budget": 300000, "head": "VP Sales"},
    {"dept": "Marketing", "budget": 200000, "head": "CMO"},
    {"dept": "HR", "budget": 150000, "head": "CHRO"},
])

# Inner join (LINQ: .Join)
# LINQ: employees.Join(departments, e => e.Dept, d => d.Dept, (e, d) => new {...})
inner = pd.merge(df, dept_df, on="dept", how="inner")
print(f"Inner join:\n{inner[['name', 'dept', 'head', 'budget']].head(3)}")

# Left join (LINQ: .GroupJoin + .SelectMany + .DefaultIfEmpty)
left = pd.merge(df, dept_df, on="dept", how="left")
print(f"\nLeft join:\n{left[['name', 'dept', 'head']].head(3)}")

# === Chained pipeline (LINQ: method chaining) ===
print("\n=== Chained Pipeline ===")
# LINQ: employees.Where(...).Select(...).OrderByDescending(...).Take(3)
result = (
    df[df["salary"] > 75000]                          # Where
    .assign(tax=lambda x: x["salary"] * 0.3)          # Select (add column)
    .sort_values("salary", ascending=False)            # OrderByDescending
    .head(3)                                           # Take
    [["name", "salary", "tax"]]                        # Select columns
)
print(result)

# === Comparison Table ===
print("\n=== LINQ vs Pandas Cheat Sheet ===")
comparison = """
Operation         LINQ (C#)                          Pandas (Python)
────────────────  ─────────────────────────────────  ─────────────────────────────
Filter            .Where(e => e.Salary > 75000)      df[df["salary"] > 75000]
Select columns    .Select(e => new { e.Name })       df[["name"]]
Add column        .Select(e => new { ..., Tax=... }) df.assign(tax=...)
Sort asc          .OrderBy(e => e.Salary)            df.sort_values("salary")
Sort desc         .OrderByDescending(...)            df.sort_values(..., ascending=False)
GroupBy           .GroupBy(e => e.Dept)              df.groupby("dept")
Aggregate         .Sum() .Average() .Max()           .sum() .mean() .max()
Inner join        .Join(other, ...)                  pd.merge(df1, df2, on="key")
Left join         .GroupJoin(...)                    pd.merge(..., how="left")
Take N            .Take(3)                           df.head(3)
Skip N            .Skip(3)                           df.iloc[3:]
Count             .Count()                           len(df) or df.shape[0]
Distinct          .Distinct()                        df.drop_duplicates()
Flatten           .SelectMany(...)                   df.explode("col")
"""
print(comparison)
```

    === DataFrame ===
          name         dept  salary   level
    0    Alice  Engineering   95000  senior
    1      Bob        Sales   65000  junior
    2  Charlie  Engineering  110000    lead
    3    Diana        Sales   78000  senior
    4      Eve  Engineering   88000  junior
    5    Frank    Marketing   72000  senior
    
    === Filter: salary > 75000 ===
          name         dept  salary   level
    0    Alice  Engineering   95000  senior
    2  Charlie  Engineering  110000    lead
    3    Diana        Sales   78000  senior
    4      Eve  Engineering   88000  junior
    
    Engineering >75k:
          name         dept  salary   level
    0    Alice  Engineering   95000  senior
    2  Charlie  Engineering  110000    lead
    4      Eve  Engineering   88000  junior
    
    === Select: name + salary ===
          name  salary
    0    Alice   95000
    1      Bob   65000
    2  Charlie  110000
    3    Diana   78000
    4      Eve   88000
    5    Frank   72000
    
    With tax:
          name  salary      tax
    0    Alice   95000  28500.0
    1      Bob   65000  19500.0
    2  Charlie  110000  33000.0
    3    Diana   78000  23400.0
    4      Eve   88000  26400.0
    5    Frank   72000  21600.0
    
    === Sort: by salary desc ===
          name         dept  salary   level
    2  Charlie  Engineering  110000    lead
    0    Alice  Engineering   95000  senior
    4      Eve  Engineering   88000  junior
    3    Diana        Sales   78000  senior
    5    Frank    Marketing   72000  senior
    1      Bob        Sales   65000  junior
    
    === GroupBy dept + aggregations ===
                 count  avg_salary  max_salary  min_salary  total_salary
    dept                                                                
    Engineering      3     97667.0      110000       88000        293000
    Marketing        1     72000.0       72000       72000         72000
    Sales            2     71500.0       78000       65000        143000
    
    === Join: employees + departments ===
    Inner join:
          name         dept      head  budget
    0    Alice  Engineering       CTO  500000
    1      Bob        Sales  VP Sales  300000
    2  Charlie  Engineering       CTO  500000
    
    Left join:
          name         dept      head
    0    Alice  Engineering       CTO
    1      Bob        Sales  VP Sales
    2  Charlie  Engineering       CTO
    
    === Chained Pipeline ===
          name  salary      tax
    2  Charlie  110000  33000.0
    0    Alice   95000  28500.0
    4      Eve   88000  26400.0
    
    === LINQ vs Pandas Cheat Sheet ===
    
    Operation         LINQ (C#)                          Pandas (Python)
    ────────────────  ─────────────────────────────────  ─────────────────────────────
    Filter            .Where(e => e.Salary > 75000)      df[df["salary"] > 75000]
    Select columns    .Select(e => new { e.Name })       df[["name"]]
    Add column        .Select(e => new { ..., Tax=... }) df.assign(tax=...)
    Sort asc          .OrderBy(e => e.Salary)            df.sort_values("salary")
    Sort desc         .OrderByDescending(...)            df.sort_values(..., ascending=False)
    GroupBy           .GroupBy(e => e.Dept)              df.groupby("dept")
    Aggregate         .Sum() .Average() .Max()           .sum() .mean() .max()
    Inner join        .Join(other, ...)                  pd.merge(df1, df2, on="key")
    Left join         .GroupJoin(...)                    pd.merge(..., how="left")
    Take N            .Take(3)                           df.head(3)
    Skip N            .Skip(3)                           df.iloc[3:]
    Count             .Count()                           len(df) or df.shape[0]
    Distinct          .Distinct()                        df.drop_duplicates()
    Flatten           .SelectMany(...)                   df.explode("col")
    
    
