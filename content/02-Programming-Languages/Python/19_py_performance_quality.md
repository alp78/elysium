---
type: reference
category: programming-languages
technology: [python]
tags: [python, performance, testing]
aliases: [performance profiling, code quality, timeit, cProfile, tracemalloc, ruff, mypy]
keywords: [timeit, perf_counter, cProfile, line_profiler, tracemalloc, sys.getsizeof, Big-O, collections performance, ruff, pylint, mypy, black, bandit, type hints]
description: "Python performance and code quality reference with executable examples and cell outputs — covers timing, memory profiling, Big-O, code smells, type hints, and linting tools. See [[19_cs_performance_quality]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[19_cs_performance_quality]]"
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# 19. Performance & Code Quality - Python

Topics covered:
- Timing & Benchmarking (timeit, perf_counter, cProfile)
- Memory Profiling (sys.getsizeof, tracemalloc, memory_profiler)
- CPU Profiling (cProfile, line_profiler)
- Big-O Complexity & Algorithmic Thinking
- Code Quality Metrics (cyclomatic complexity, linting)
- Golden Rules of Performance
- Absolute No-Go's
- Code Smells & Anti-Patterns
- Type Safety & Static Analysis
- Profiling Real Workloads

## Timing & Benchmarking

#### perf_counter and timeit — wall-clock timing

> [!info] Timing tools
>
> - `time.perf_counter()` — high-resolution wall-clock timing
> - `timeit` — reliable micro-benchmarks (auto-repeats, disables GC)
> - `%%timeit` in Jupyter — auto-calibrates
> - Always warm up first (imports, caching)
> - C# equivalent: `BenchmarkDotNet`, `Stopwatch`

> [!tip] Never optimize without measuring first.
>
> Never optimize without measuring first. Gut feelings are wrong.

> [!warning] Don't use time.time() for benchmarks
>
> Don't use `time.time()` for benchmarks (lower resolution). Don't time a single run (cache/OS scheduling skew results).

```python
import time
import timeit

# --- time.perf_counter (manual timing) ---
from collections import deque
from collections.abc import Callable, Iterator, Sequence
from functools import lru_cache
from pathlib import Path
from typing import Any
from typing import Optional
from typing import overload
import cProfile
import io
import pandas as pd
import pstats
import random
import sys
import tracemalloc
def slow_sum(n):
    return sum(range(n))

t0 = time.perf_counter()
result = slow_sum(1_000_000)
elapsed = time.perf_counter() - t0
print(f"slow_sum(1M): {elapsed*1000:.2f}ms, result={result}")

# --- timeit (automated, more reliable) ---
elapsed = timeit.timeit("sum(range(100_000))", number=100)
print(f"timeit (100 runs): {elapsed*1000:.1f}ms total, {elapsed/100*1000:.2f}ms avg")

# --- Context manager for reusable timing ---
from contextlib import contextmanager

@contextmanager
def timer(label=""):
    t0 = time.perf_counter()
    yield
    elapsed = time.perf_counter() - t0
    print(f"  [{label}] {elapsed*1000:.2f}ms")

with timer("list comp"):
    _ = [x**2 for x in range(100_000)]

with timer("map"):
    _ = list(map(lambda x: x**2, range(100_000)))

with timer("generator"):
    _ = sum(x**2 for x in range(100_000))
```

    slow_sum(1M): 18.14ms, result=499999500000
    timeit (100 runs): 107.9ms total, 1.08ms avg
      [list comp] 3.01ms
      [map] 4.97ms
      [generator] 5.00ms

#### Comparing algorithms with timeit

```python
# Comparing alternatives — benchmark the same operation across approaches

setup = "data = list(range(10_000))"

# Linear search vs set lookup
t_list = timeit.timeit("9999 in data", setup=setup, number=10_000)
t_set = timeit.timeit("9999 in data", setup=setup + "; data = set(data)", number=10_000)

print(f"List lookup: {t_list*1000:.1f}ms")
print(f"Set lookup:  {t_set*1000:.1f}ms")
print(f"Set is {t_list/t_set:.0f}x faster")

# Sorting: sorted() vs .sort()
t_sorted = timeit.timeit("sorted(data)", setup="data = list(range(10_000, 0, -1))", number=1000)
t_sort = timeit.timeit("data.sort()", setup="data = list(range(10_000, 0, -1))", number=1000)
print(f"\nsorted() (new list): {t_sorted*1000:.1f}ms")
print(f".sort() (in-place):  {t_sort*1000:.1f}ms")
```

    List lookup: 307.1ms
    Set lookup:  0.1ms
    Set is 2355x faster
    
    sorted() (new list): 30.2ms
    .sort() (in-place):  21.2ms

## Memory Profiling

#### sys.getsizeof and memory measurement

> [!info] Memory measurement
>
> - `sys.getsizeof()` — shallow size only (not contents)
> - `tracemalloc` — tracks allocations with file and line number
> - C# equivalent: `dotMemory`, `GC.GetTotalMemory()`

> [!tip] Memory is the silent killer.
>
> Memory is the silent killer. A 10x blowup is invisible until OOM-kill in production.

> [!warning] sys.getsizeof on containers only shows
>
> `sys.getsizeof` on containers only shows the container, not elements. Don't use `memory_profiler` in production.

```python
# --- sys.getsizeof (shallow) ---
print("Object sizes (bytes):")
for obj in [42, 3.14, "hello", b"hello", True, None, [], {}, set()]:
    print(f"  {str(obj):15s} {type(obj).__name__:10s} {sys.getsizeof(obj):>6d}")

# Container sizes grow with content
for n in [0, 10, 100, 1000, 10_000]:
    lst = list(range(n))
    dct = {i: i for i in range(n)}
    st = set(range(n))
    print(f"  n={n:>6d}: list={sys.getsizeof(lst):>8d}  dict={sys.getsizeof(dct):>8d}  set={sys.getsizeof(st):>8d}")
```

    Object sizes (bytes):
      42              int            28
      3.14            float          24
      hello           str            46
      b'hello'        bytes          38
      True            bool           28
      None            NoneType       16
      []              list           56
      {}              dict           64
      set()           set           216
      n=     0: list=      56  dict=      64  set=     216
      n=    10: list=     136  dict=     352  set=     728
      n=   100: list=     856  dict=    4688  set=    8408
      n=  1000: list=    8056  dict=   36952  set=   32984
      n= 10000: list=   80056  dict=  294992  set=  524504

#### tracemalloc — track allocation sources

```python
# tracemalloc — track memory allocations with source location

tracemalloc.start()

# Simulate work
data = [x**2 for x in range(100_000)]
mapping = {str(x): x**2 for x in range(10_000)}

snapshot = tracemalloc.take_snapshot()
top = snapshot.statistics("lineno")

print("Top 5 memory allocations:")
for stat in top[:5]:
    print(f"  {stat}")

current, peak = tracemalloc.get_traced_memory()
print(f"\nCurrent: {current / 1024 / 1024:.2f} MB")
print(f"Peak:    {peak / 1024 / 1024:.2f} MB")

tracemalloc.stop()
del data, mapping
```

    Top 5 memory allocations:
      C:\Users\aperi\AppData\Local\Temp\ipykernel_14572\4071954996.py:10: size=3907 KiB, count=99984, average=40 B
      C:\Users\aperi\AppData\Local\Temp\ipykernel_14572\4071954996.py:11: size=953 KiB, count=19984, average=49 B
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\IPython\core\interactiveshell.py:3687: size=296 B, count=1, average=296 B
      C:\Users\aperi\AppData\Local\Programs\Python\Python312\Lib\codeop.py:118: size=286 B, count=2, average=143 B
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\IPython\core\interactiveshell.py:3747: size=160 B, count=1, average=160 B
    
    Current: 4.75 MB
    Peak:    4.77 MB

#### Generators vs lists — O(1) vs O(n) memory

```python
# Memory-efficient alternatives — generators use O(1) memory

list_data = [x**2 for x in range(100_000)]
gen_result = sum(x**2 for x in range(100_000))  # generator, no list created

print(f"List size: {sys.getsizeof(list_data):,} bytes ({sys.getsizeof(list_data)/1024/1024:.2f} MB)")
print(f"Generator: uses ~0 bytes (constant memory)")

# tuple vs list (tuples are smaller)
lst = list(range(1000))
tpl = tuple(range(1000))
print(f"\nlist(1000): {sys.getsizeof(lst):,} bytes")
print(f"tuple(1000): {sys.getsizeof(tpl):,} bytes")
print(f"Tuple is {(1 - sys.getsizeof(tpl)/sys.getsizeof(lst))*100:.0f}% smaller")

# __slots__ for memory-efficient classes
class PointRegular:
    def __init__(self, x, y):
        self.x = x
        self.y = y

class PointSlots:
    __slots__ = ("x", "y")
    def __init__(self, x, y):
        self.x = x
        self.y = y

regular = [PointRegular(i, i) for i in range(10_000)]
slotted = [PointSlots(i, i) for i in range(10_000)]
print(f"\nRegular class: {sys.getsizeof(regular[0])} bytes/instance")
print(f"__slots__ class: {sys.getsizeof(slotted[0])} bytes/instance")
del regular, slotted, list_data
```

    List size: 800,984 bytes (0.76 MB)
    Generator: uses ~0 bytes (constant memory)
    
    list(1000): 8,056 bytes
    tuple(1000): 8,040 bytes
    Tuple is 0% smaller
    
    Regular class: 48 bytes/instance
    __slots__ class: 48 bytes/instance

## CPU Profiling

#### cProfile — built-in CPU profiler

> [!info] cProfile
>
> - `cProfile.run()` — profiles and prints per-function timing
> - `tottime` — in-function only | `cumtime` — including sub-calls
> - `pstats` — programmatic analysis
> - C# equivalent: dotTrace, PerfView

> [!tip] Profile the WHOLE program first,
>
> Profile the WHOLE program first, then zoom into hotspots. Don't guess. Don't profile in production (use py-spy for sampling).

```python
def fib(n):
    if n <= 1:
        return n
    return fib(n-1) + fib(n-2)

def work():
    results = []
    for i in range(25):
        results.append(fib(i))
    return results

# Profile and capture output
profiler = cProfile.Profile()
profiler.enable()
work()
profiler.disable()

stream = io.StringIO()
stats = pstats.Stats(profiler, stream=stream).sort_stats("cumulative")
stats.print_stats(15)
print(stream.getvalue())
```

             392950 function calls (165 primitive calls) in 0.060 seconds
    
       Ordered by: cumulative time
       List reduced from 51 to 15 due to restriction <15>
    
       ncalls  tottime  percall  cumtime  percall filename:lineno(function)
    392809/25    0.059    0.000    0.083    0.003 C:\Users\aperi\AppData\Local\Temp\ipykernel_14572\3127912342.py:17(fib)
            2    0.000    0.000    0.059    0.030 {built-in method builtins.exec}
            1    0.000    0.000    0.059    0.059 C:\Users\aperi\AppData\Local\Temp\ipykernel_14572\3127912342.py:1(<module>)
            1    0.000    0.000    0.059    0.059 C:\Users\aperi\AppData\Local\Temp\ipykernel_14572\3127912342.py:22(work)
            2    0.000    0.000    0.000    0.000 c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\traitlets\traitlets.py:708(__set__)
            2    0.000    0.000    0.000    0.000 c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\traitlets\traitlets.py:3631(set)
            2    0.000    0.000    0.000    0.000 C:\Users\aperi\AppData\Local\Programs\Python\Python312\Lib\codeop.py:117(__call__)
            2    0.000    0.000    0.000    0.000 c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\traitlets\traitlets.py:689(set)
            2    0.000    0.000    0.000    0.000 {built-in method builtins.compile}
            1    0.000    0.000    0.000    0.000 {method 'disable' of '_lsprof.Profiler' objects}
            2    0.000    0.000    0.000    0.000 {method '__exit__' of 'sqlite3.Connection' objects}
            2    0.000    0.000    0.000    0.000 c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\traitlets\traitlets.py:718(_validate)
            1    0.000    0.000    0.000    0.000 c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\traitlets\traitlets.py:1512(_notify_trait)
            2    0.000    0.000    0.000    0.000 c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\traitlets\traitlets.py:3474(validate)
            1    0.000    0.000    0.000    0.000 c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\traitlets\traitlets.py:1523(notify_change)

#### cProfile — profiling string concatenation strategies (+=, join, StringIO)

```python
# Profiling a realistic workload — comparing string building strategies

def concat_plus(n):
    s = ""
    for i in range(n):
        s += str(i)  # NO-GO: O(n²) due to string immutability
    return s

def concat_join(n):
    return "".join(str(i) for i in range(n))  # O(n)

def concat_io(n):
    buf = io.StringIO()
    for i in range(n):
        buf.write(str(i))
    return buf.getvalue()

n = 50_000
for fn in [concat_plus, concat_join, concat_io]:
    t0 = __import__("time").perf_counter()
    fn(n)
    elapsed = __import__("time").perf_counter() - t0
    print(f"{fn.__name__:20s}: {elapsed*1000:.1f}ms")
```

    concat_plus         : 4.4ms
    concat_join         : 3.0ms
    concat_io           : 3.2ms

## Big-O Complexity & Algorithmic Thinking

#### Big-O complexity reference

| Complexity | Name | Examples |
|---|---|---|
| O(1) | Constant | Dict lookup, set membership, array index |
| O(log n) | Logarithmic | Binary search, balanced tree |
| O(n) | Linear | List scan, single loop, map/filter |
| O(n log n) | Linearithmic | Sorting (mergesort, timsort) |
| O(n²) | Quadratic | Nested loops — red flag for n > 10K |
| O(2ⁿ) | Exponential | Naive recursion — no-go for n > 25 |

> [!tip] Know the complexity of your
>
> Know the complexity of your data structures. If *n* can grow, O(n²) is a ticking time bomb. Fix the algorithm before optimizing constants.

```python
def measure(fn, *args, label=""):
    t0 = time.perf_counter()
    result = fn(*args)
    elapsed = time.perf_counter() - t0
    print(f"  {label:30s}: {elapsed*1000:>10.2f}ms")
    return result

# O(1) vs O(n): lookup
data_list = list(range(1_000_000))
data_set = set(data_list)
data_dict = {x: x for x in data_list}

print("Lookup (element at end):")
measure(lambda: 999_999 in data_list, label="list (O(n))")
measure(lambda: 999_999 in data_set, label="set (O(1))")
measure(lambda: 999_999 in data_dict, label="dict (O(1))")

# O(n) vs O(n²): finding duplicates
data = random.sample(range(1_000_000), 10_000)

def find_dupes_quadratic(lst):
    dupes = []
    for i in range(len(lst)):
        for j in range(i+1, len(lst)):
            if lst[i] == lst[j]:
                dupes.append(lst[i])
    return dupes

def find_dupes_linear(lst):
    seen = set()
    dupes = []
    for x in lst:
        if x in seen:
            dupes.append(x)
        seen.add(x)
    return dupes

small = data[:500]
print("\nFind duplicates (n=500):")
measure(find_dupes_quadratic, small, label="Quadratic O(n²)")
measure(find_dupes_linear, small, label="Linear O(n)")
```

    Lookup (element at end):
      list (O(n))                   :       3.15ms
      set (O(1))                    :       0.00ms
      dict (O(1))                   :       0.00ms
    
    Find duplicates (n=500):
      Quadratic O(n²)               :       2.56ms
      Linear O(n)                   :       0.02ms

    []

## Data Structure Performance Cheat Sheet

#### Data structure performance cheat sheet

| Operation | `list` | `dict` | `set` | `deque` |
|---|---|---|---|---|
| Index/Key | O(1) | O(1) | — | O(n) |
| Search | O(n) | O(1) | O(1) | O(n) |
| Insert end | O(1)* | O(1) | O(1) | O(1) |
| Insert front | O(n) | — | — | O(1) |
| Delete end | O(1) | O(1) | O(1) | O(1) |
| Delete front | O(n) | — | — | O(1) |
| Sort | O(n log n) | — | — | O(n log n) |
| Memory | Compact | Heavy | Heavy | Compact |

\* amortized. Use the right structure for the access pattern: fast lookup → `dict`/`set`, FIFO → `deque`, both ends → `deque`.

```python
n = 100_000

# List vs deque: insert at front
lst = list(range(n))
dq = deque(range(n))

t0 = time.perf_counter()
for _ in range(1000):
    lst.insert(0, -1)
    lst.pop(0)
t_list = time.perf_counter() - t0

t0 = time.perf_counter()
for _ in range(1000):
    dq.appendleft(-1)
    dq.popleft()
t_deque = time.perf_counter() - t0

print(f"Insert/remove front (1000x):")
print(f"  list:  {t_list*1000:.1f}ms")
print(f"  deque: {t_deque*1000:.1f}ms")
print(f"  deque is {t_list/t_deque:.0f}x faster")
```

    Insert/remove front (1000x):
      list:  28.6ms
      deque: 0.2ms
      deque is 158x faster

## Golden Rules of Performance

#### Golden rules of Python performance

> [!tip] Golden Rules of Performance
>
> 1. **Measure before optimizing** — profile first, the bottleneck is never where you think
> 2. **Algorithm > micro-optimization** — O(n²) → O(n log n) beats any loop unrolling
> 3. **Use built-in data structures** — list/dict/set are C-implemented
> 4. **Vectorize, don't loop** — NumPy/Pandas/Polars are 100–1000x faster than Python loops
> 5. **Minimize copies** — prefer in-place or generator patterns
> 6. **I/O is the bottleneck** — Network > Disk > Memory > CPU
> 7. **Cache expensive results** — `lru_cache`, memoization, Redis
> 8. **Lazy > eager** — generators, itertools, Polars lazy mode
> 9. **Know your constants** — Big-O theory diverges from practice at small *n*
> 10. **Readable > fast** — 10% gain that makes code unreadable is rarely worth it

```python
# Example: Rule 7 — caching

def fib_slow(n):
    if n <= 1: return n
    return fib_slow(n-1) + fib_slow(n-2)

@lru_cache(maxsize=None)
def fib_cached(n):
    if n <= 1: return n
    return fib_cached(n-1) + fib_cached(n-2)

t0 = time.perf_counter()
fib_slow(30)
t_slow = time.perf_counter() - t0

t0 = time.perf_counter()
fib_cached(300)  # 10x larger input, still instant
t_cached = time.perf_counter() - t0

print(f"fib(30) uncached:  {t_slow*1000:.1f}ms")
print(f"fib(300) cached:   {t_cached*1000:.3f}ms")
print(f"Cached is {t_slow/max(t_cached, 1e-9):.0f}x faster (on a 10x larger input!)")
fib_cached.cache_clear()
```

    fib(30) uncached:  68.6ms
    fib(300) cached:   0.341ms
    Cached is 201x faster (on a 10x larger input!)

## Absolute No-Go's

#### Absolute no-go's — patterns that should never appear in production

> [!danger] Absolute no-go's — never in production
>
> 1. **String `+=` in loop** — O(n²), use `"".join()`
> 2. **Nested loops on large data** — O(n²), use dict lookup or set intersection
> 3. **Bare `except:`** — catches `SystemExit`, `KeyboardInterrupt`. Catch specific exceptions
> 4. **Mutable default args** — `def f(lst=[])` shares one list. Use `None` sentinel
> 5. **Global mutable state** — untraceable bugs. Use DI or closures
> 6. **`eval()`/`exec()` with user input** — RCE vulnerability. Use `ast.literal_eval`
> 7. **Hardcoded secrets** — use env vars or secret managers
> 8. **Ignoring return values** — `sorted()` returns new list, `.sort()` returns `None`
> 9. **Wildcard imports** — `from module import *` pollutes namespace
> 10. **`except: pass`** — bugs become invisible. At minimum, log
> 11. **`is` for value comparison** — `x is 256` works by accident. Use `==`
> 12. **Not closing resources** — `open()` without `with` leaks file handles

```python
# --- Demo: Mutable default argument (NO-GO #4) ---
def bad_append(item, lst=[]):
    lst.append(item)
    return lst

print("Mutable default bug:")
print(f"  Call 1: {bad_append(1)}")
print(f"  Call 2: {bad_append(2)}")  # Still has [1] from call 1!
print(f"  Call 3: {bad_append(3)}")  # [1, 2, 3] — list is shared!

def good_append(item, lst=None):
    if lst is None:
        lst = []
    lst.append(item)
    return lst

print("\nFixed:")
print(f"  Call 1: {good_append(1)}")
print(f"  Call 2: {good_append(2)}")
print(f"  Call 3: {good_append(3)}")
```

    Mutable default bug:
      Call 1: [1]
      Call 2: [1, 2]
      Call 3: [1, 2, 3]
    
    Fixed:
      Call 1: [1]
      Call 2: [2]
      Call 3: [3]

## Code Smells & Anti-Patterns

#### Code smells and anti-patterns

> [!warning] Code smells
>
> Code smells — patterns indicating deeper problems
> 1. **God function/class** — >30 lines = doing too much. Split by single responsibility
> 2. **Deep nesting** — `if: if: if: for: if:` → use early returns, guard clauses
> 3. **Magic numbers** — `if x > 86400` → use `SECONDS_PER_DAY = 86400`
> 4. **Copy-paste code** — same block 3+ places → extract to function (DRY)
> 5. **Boolean blindness** — `process(data, True, False, True)` → use keyword args or enums
> 6. **Premature abstraction** — YAGNI: abstract when you see the pattern 3 times
> 7. **Comments explaining "what"** — `# increment x` is useless; `# retry because race condition` is valuable

```python
# --- Demo: Deep nesting vs guard clauses ---
# BAD
def process_bad(user):
    if user is not None:
        if user.get("active"):
            if user.get("email"):
                return f"Sending to {user['email']}"
            else:
                return "No email"
        else:
            return "Inactive"
    else:
        return "No user"

# GOOD — guard clauses (flat, readable, same logic)
def process_good(user):
    if user is None:
        return "No user"
    if not user.get("active"):
        return "Inactive"
    if not user.get("email"):
        return "No email"
    return f"Sending to {user['email']}"

user = {"active": True, "email": "alice@example.com"}
assert process_bad(user) == process_good(user)
print("Guard clauses produce the same result, but are flat and readable.")
```

    Guard clauses produce the same result, but are flat and readable.

## Type Safety & Static Analysis

#### Type hints and static analysis — mypy, pyright

Type annotations (`def f(x: int) -> str`) document intent. `mypy`/`pyright` check statically — no runtime cost. Catches `NoneType` errors, wrong argument types, missing attributes at lint time. C# equivalent: the language IS statically typed; Python adds this opt-in.

> [!tip] Type hints are free documentation.
>
> Type hints are free documentation. Always use them in function signatures. Don't use `Any` everywhere — it defeats the purpose.

```python
# Without types — what does this return? what types are valid?
def process(data, flag):
    if flag:
        return data.upper()
    return len(data)

# With types — clear contract, mypy catches misuse
def process_typed(data: str, flag: bool) -> str | int:
    if flag:
        return data.upper()
    return len(data)

# Better: use Union or overload for different return types

@overload
def fetch(id: int, as_dict: bool = True) -> dict: ...
@overload
def fetch(id: int, as_dict: bool = False) -> list: ...  # type: ignore[misc]
def fetch(id: int, as_dict: bool = True) -> dict | list:
    data = {"id": id, "name": "test"}
    return data if as_dict else list(data.values())

print(f"Type hints: {process_typed('hello', True)}")
print(f"Overload:   {fetch(1, as_dict=True)}")
```

    Type hints: HELLO
    Overload:   {'id': 1, 'name': 'test'}

#### typing module — common patterns for data engineering (TypeAlias, Protocol)

```python
# Common typing patterns — practical type hints for DE functions

def read_data(path: str | Path) -> list[dict[str, Any]]:
    return [{"example": True}]

# Callback / higher-order function
def retry(fn: Callable[[], Any], attempts: int = 3) -> Any:
    for i in range(attempts):
        try:
            return fn()
        except Exception:
            if i == attempts - 1:
                raise

# Generator function
def batched(data: Sequence[Any], size: int) -> Iterator[Sequence[Any]]:
    for i in range(0, len(data), size):
        yield data[i:i+size]

# Usage
for batch in batched(list(range(10)), 3):
    print(f"  batch: {list(batch)}")
```

      batch: [0, 1, 2]
      batch: [3, 4, 5]
      batch: [6, 7, 8]
      batch: [9]

## Linting & Code Quality Tools

#### ruff, flake8, black — cyclomatic complexity and linting tools

Cyclomatic complexity counts independent code paths: 1–5 simple, 6–10 moderate, 10+ refactor. `ruff` (Rust-based) replaces flake8+isort+pyflakes (10–100x faster). `black` auto-formats — one canonical style, no debates.

```python
# Cyclomatic complexity: 1 = simple, 5 = moderate, 10+ = refactor

# HIGH complexity (6 branches)
def complex_function(x, y, z):
    if x > 0:
        if y > 0:
            return x + y
        elif z > 0:
            return x + z
        else:
            return x
    elif y > 0:
        return y
    else:
        if z > 0:
            return z
        return 0

# LOWER complexity — same logic, flattened with early returns
def simple_function(x, y, z):
    if x > 0 and y > 0:
        return x + y
    if x > 0 and z > 0:
        return x + z
    if x > 0:
        return x
    if y > 0:
        return y
    if z > 0:
        return z
    return 0

# Verify equivalence
for args in [(1,2,3), (-1,2,3), (-1,-1,3), (-1,-1,-1), (1,-1,3), (1,-1,-1), (0,0,0)]:
    assert complex_function(*args) == simple_function(*args), f"Mismatch at {args}"
print("Refactored function passes all cases.")
```

    Refactored function passes all cases.

## Profiling Real Workloads

#### cProfile — profiling a realistic data pipeline end-to-end

Wrap each pipeline stage (extract, transform, load) with timing. Optimize the slowest stage first — Amdahl's law limits speedup to the slowest unoptimized stage. Don't optimize all stages equally; don't profile with small data (bottlenecks differ at scale).

```python
def stage_timer(stages: dict):
    """Run each stage and report timing."""
    results = {}
    for name, fn in stages.items():
        t0 = time.perf_counter()
        result = fn() if callable(fn) else fn
        elapsed = time.perf_counter() - t0
        results[name] = (elapsed, result)
        print(f"  {name:30s}: {elapsed*1000:>8.1f}ms")
    total = sum(t for t, _ in results.values())
    print(f"  {'TOTAL':30s}: {total*1000:>8.1f}ms")
    print(f"\n  Bottleneck: {max(results, key=lambda k: results[k][0])}")
    return results

DATA = Path("./data")

print("Data pipeline profiling:")
stages = {
    "1. Read parquet": lambda: pd.read_parquet(DATA / "eurostoxx50_ohlcv.parquet"),
    "2. Filter": lambda: stages["1. Read parquet"]()[1].query("symbol == 'ASML.AS'") if False else pd.read_parquet(DATA / "eurostoxx50_ohlcv.parquet").query("symbol == 'ASML.AS'"),
    "3. Compute returns": lambda: pd.read_parquet(DATA / "eurostoxx50_ohlcv.parquet").assign(ret=lambda d: d["close"].pct_change()),
    "4. Group by symbol": lambda: pd.read_parquet(DATA / "eurostoxx50_ohlcv.parquet").groupby("symbol")["close"].mean(),
    "5. Sort": lambda: pd.read_parquet(DATA / "eurostoxx50_ohlcv.parquet").sort_values(["symbol", "date"]),
}
stage_timer(stages)
```

    Data pipeline profiling:
      1. Read parquet               :     18.9ms
      2. Filter                     :      7.9ms
      3. Compute returns            :      7.4ms
      4. Group by symbol            :      8.1ms
      5. Sort                       :     11.5ms
      TOTAL                         :     53.7ms
    
      Bottleneck: 1. Read parquet

    {'1. Read parquet': (0.018856499998946674,
                id  symbol        date   open   high    low  close  adj_close  \
      0      21160  ABI.BR  2021-01-04  58.15  58.85  56.78  57.21    53.5761   
      1      21161  ABI.BR  2021-01-05  56.90  57.98  56.75  57.18    53.5480   
      2      21162  ABI.BR  2021-01-06  57.96  58.94  57.39  58.77    55.0370   
      3      21163  ABI.BR  2021-01-07  58.68  58.86  57.88  58.40    54.6905   
      4      21164  ABI.BR  2021-01-08  58.16  58.40  57.43  57.86    54.1848   
      ...      ...     ...         ...    ...    ...    ...    ...        ...   
      66350  64828  WKL.AS  2026-03-06  69.02  69.36  67.82  68.52    68.5200   
      66351  66875  WKL.AS  2026-03-09  68.78  69.16  67.64  68.64    68.6400   
      66352  66876  WKL.AS  2026-03-10  68.80  69.16  66.34  67.16    67.1600   
      66353  66877  WKL.AS  2026-03-11  67.50  69.60  67.02  67.22    67.2200   
      66354  66929  WKL.AS  2026-03-12  67.00  67.54  66.28  67.32    67.3200   
      
              volume  dividends  stock_splits  is_filled  
      0      1513937        0.0           0.0      False  
      1      1382722        0.0           0.0      False  
      2      1370204        0.0           0.0      False  
      3      1469911        0.0           0.0      False  
      4      1428681        0.0           0.0      False  
      ...        ...        ...           ...        ...  
      66350  1143729        0.0           0.0      False  
      66351   841503        0.0           0.0      False  
      66352  1355645        0.0           0.0      False  
      66353  1142531        0.0           0.0      False  
      66354   210379        0.0           0.0      False  
      
      [66355 rows x 12 columns]),
     '2. Filter': (0.007916899998235749,
                id   symbol        date     open     high      low    close  \
      10634      1  ASML.AS  2021-01-04   404.00   411.00   402.25   406.25   
      10635      2  ASML.AS  2021-01-05   406.55   412.05   401.15   406.90   
      10636      3  ASML.AS  2021-01-06   406.80   407.20   399.20   402.85   
      10637      4  ASML.AS  2021-01-07   404.80   407.80   400.35   403.90   
      10638      5  ASML.AS  2021-01-08   414.25   419.10   413.40   416.05   
      ...      ...      ...         ...      ...      ...      ...      ...   
      11960  64732  ASML.AS  2026-03-06  1186.00  1192.60  1112.80  1147.00   
      11961  66731  ASML.AS  2026-03-09  1072.00  1147.60  1060.20  1147.60   
      11962  66732  ASML.AS  2026-03-10  1188.40  1208.40  1172.20  1200.00   
      11963  66733  ASML.AS  2026-03-11  1188.40  1210.80  1174.00  1198.80   
      11964  66881  ASML.AS  2026-03-12  1194.80  1202.20  1187.80  1190.80   
      
             adj_close  volume  dividends  stock_splits  is_filled  
      10634   387.7090  789502        0.0           0.0      False  
      10635   388.3294  798787        0.0           0.0      False  
      10636   384.4644  875711        0.0           0.0      False  
      10637   385.4664  874780        0.0           0.0      False  
      10638   397.0618  975243        0.0           0.0      False  
      ...          ...     ...        ...           ...        ...  
      11960  1147.0000  857271        0.0           0.0      False  
      11961  1147.6000  689086        0.0           0.0      False  
      11962  1200.0000  800815        0.0           0.0      False  
      11963  1198.8000  562904        0.0           0.0      False  
      11964  1190.8000  128223        0.0           0.0      False  
      
      [1331 rows x 12 columns]),
     '3. Compute returns': (0.007366499998170184,
                id  symbol        date   open   high    low  close  adj_close  \
      0      21160  ABI.BR  2021-01-04  58.15  58.85  56.78  57.21    53.5761   
      1      21161  ABI.BR  2021-01-05  56.90  57.98  56.75  57.18    53.5480   
      2      21162  ABI.BR  2021-01-06  57.96  58.94  57.39  58.77    55.0370   
      3      21163  ABI.BR  2021-01-07  58.68  58.86  57.88  58.40    54.6905   
      4      21164  ABI.BR  2021-01-08  58.16  58.40  57.43  57.86    54.1848   
      ...      ...     ...         ...    ...    ...    ...    ...        ...   
      66350  64828  WKL.AS  2026-03-06  69.02  69.36  67.82  68.52    68.5200   
      66351  66875  WKL.AS  2026-03-09  68.78  69.16  67.64  68.64    68.6400   
      66352  66876  WKL.AS  2026-03-10  68.80  69.16  66.34  67.16    67.1600   
      66353  66877  WKL.AS  2026-03-11  67.50  69.60  67.02  67.22    67.2200   
      66354  66929  WKL.AS  2026-03-12  67.00  67.54  66.28  67.32    67.3200   
      
              volume  dividends  stock_splits  is_filled       ret  
      0      1513937        0.0           0.0      False       NaN  
      1      1382722        0.0           0.0      False -0.000524  
      2      1370204        0.0           0.0      False  0.027807  
      3      1469911        0.0           0.0      False -0.006296  
      4      1428681        0.0           0.0      False -0.009247  
      ...        ...        ...           ...        ...       ...  
      66350  1143729        0.0           0.0      False  0.001462  
      66351   841503        0.0           0.0      False  0.001751  
      66352  1355645        0.0           0.0      False -0.021562  
      66353  1142531        0.0           0.0      False  0.000893  
      66354   210379        0.0           0.0      False  0.001488  
      
      [66355 rows x 13 columns]),
     '4. Group by symbol': (0.008067300001130207,
      symbol
      ABI.BR         54.864234
      AD.AS          29.652656
      ADS.DE        205.426480
      ADYEN.AS     1545.976409
      AI.PA         145.428443
      AIR.PA        134.584117
      ALV.DE        252.193731
      ARGX.BR       413.691961
      ASML.AS       671.348911
      BAS.DE         50.561854
      BAYN.DE        41.874956
      BBVA.MC         8.651954
      BMW.DE         86.932356
      BN.PA          60.293366
      BNP.PA         60.937712
      CS.PA          30.011902
      DB1.DE        184.800302
      DG.PA         103.833118
      DHL.DE         42.693036
      DSY.PA         37.056195
      DTE.DE         22.430097
      EL.PA         191.914013
      ENEL.MI         6.820438
      ENI.MI         13.397625
      ENR.DE         38.130769
      IBE.MC         12.255312
      IFX.DE         33.327417
      INGA.AS        14.038188
      ISP.MI          3.147987
      ITX.MC         36.555628
      MBG.DE         61.805643
      MC.PA         662.404508
      MUV2.DE       374.659932
      NDA-FI.HE      10.848079
      OR.PA         377.544365
      PRX.AS         35.748743
      RACE.MI       289.753823
      RHM.DE        544.661533
      RMS.PA       1761.555748
      SAF.PA        171.833802
      SAN.MC          4.425848
      SAN.PA         90.303725
      SAP.DE        154.326163
      SGO.PA         66.434910
      SIE.DE        162.942583
      SU.PA         179.032630
      TTE.PA         53.140808
      UCG.MI         28.457104
      VOW.DE        161.578361
      WKL.AS        114.170316
      Name: close, dtype: float64),
     '5. Sort': (0.01152899999942747,
                id  symbol        date   open   high    low  close  adj_close  \
      0      21160  ABI.BR  2021-01-04  58.15  58.85  56.78  57.21    53.5761   
      1      21161  ABI.BR  2021-01-05  56.90  57.98  56.75  57.18    53.5480   
      2      21162  ABI.BR  2021-01-06  57.96  58.94  57.39  58.77    55.0370   
      3      21163  ABI.BR  2021-01-07  58.68  58.86  57.88  58.40    54.6905   
      4      21164  ABI.BR  2021-01-08  58.16  58.40  57.43  57.86    54.1848   
      ...      ...     ...         ...    ...    ...    ...    ...        ...   
      66350  64828  WKL.AS  2026-03-06  69.02  69.36  67.82  68.52    68.5200   
      66351  66875  WKL.AS  2026-03-09  68.78  69.16  67.64  68.64    68.6400   
      66352  66876  WKL.AS  2026-03-10  68.80  69.16  66.34  67.16    67.1600   
      66353  66877  WKL.AS  2026-03-11  67.50  69.60  67.02  67.22    67.2200   
      66354  66929  WKL.AS  2026-03-12  67.00  67.54  66.28  67.32    67.3200   
      
              volume  dividends  stock_splits  is_filled  
      0      1513937        0.0           0.0      False  
      1      1382722        0.0           0.0      False  
      2      1370204        0.0           0.0      False  
      3      1469911        0.0           0.0      False  
      4      1428681        0.0           0.0      False  
      ...        ...        ...           ...        ...  
      66350  1143729        0.0           0.0      False  
      66351   841503        0.0           0.0      False  
      66352  1355645        0.0           0.0      False  
      66353  1142531        0.0           0.0      False  
      66354   210379        0.0           0.0      False  
      
      [66355 rows x 12 columns])}

## Summary

| Category | Tool / Technique | When to Use |
|---|---|---|
| Wall-clock time | `time.perf_counter()` | Quick ad-hoc measurement |
| Reliable timing | `timeit.timeit()` | Comparing alternatives |
| Object size | `sys.getsizeof()` | Single object inspection |
| Memory tracking | `tracemalloc` | Finding memory leaks |
| CPU profiling | `cProfile` + `pstats` | Finding slow functions |
| Query plan | Polars `.explain()` | Understanding lazy execution |
| Execution profile | Polars `.profile()` | Per-node timing |
| Complexity | Big-O analysis | Algorithm selection |
| Type safety | `mypy` / `pyright` | Catching type bugs pre-runtime |
| Linting | `ruff` | Style + bug detection |
| Formatting | `black` / `ruff format` | Consistent code style |

**Golden Rules:** Measure first. Algorithm > micro-optimization. Vectorize. Cache. Lazy > eager.

**No-Go's:** String concat in loops. Nested loops on large data. Bare except. Mutable defaults. eval(). Hardcoded secrets. Wildcard imports.
