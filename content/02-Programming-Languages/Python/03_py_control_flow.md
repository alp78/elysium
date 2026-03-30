---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [if else, loops, for loop, while loop, switch, pattern matching, match case]
keywords: [if, elif, else, for, while, break, continue, pass, match, case, comprehension, generator, yield]
description: "Python control flow reference with executable examples and cell outputs — covers conditionals, loops, loop control, iterators, generators, and comprehensions. See [03_cs_control_flow](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/03_cs_control_flow) for the C# equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 03. Control Flow - Python

> [!quote]
> "Fools ignore complexity. Pragmatists suffer it. Some can avoid it. Geniuses remove it."
> — **Alan Perlis**

## Conditional Statements

#### if / elif / else — indentation-based branching

Python uses indentation (not braces) to define blocks. Conditions don't need parentheses. `elif` chains for multiple tiers — one keyword instead of `else if`, fewer nesting levels.

Conditional chains check conditions top-to-bottom — the **first matching condition wins**, all subsequent branches are skipped. Put the most specific threshold first (`>=90` before `>=80` before `>=70`). Truthy/falsy: `False`, `0`, `""`, `[]`, `{}`, `None` are falsy; everything else is truthy. Chained comparisons: `10 < x < 20` means `10 < x and x < 20`.

> [!warning] Control flow pitfalls
>
> - Deep `if`/`elif` nesting — extract to functions or use `match`/`case`
> - Redundant `else` after `return` — `if cond: return x; return y` is cleaner
> - Mixing tabs and spaces — causes `IndentationError`

```python
from functools import reduce
from itertools import chain
from itertools import chain, cycle, repeat, accumulate, product
from itertools import islice
from more_itertools import collapse
import io
import pandas as pd
import sys
score = 85
# Most restrictive first! >=90 before >=80 before >=70
if score >= 90:
    grade = "A"
elif score >= 80:      # only reached if score < 90
    grade = "B"
elif score >= 70:      # only reached if score < 80
    grade = "C"
elif score >= 60:
    grade = "D"
else:                  # catches everything else (< 60)
    grade = "F"
print(f"Score {score} → Grade {grade}")

x = 10
if x > 0: print(f"{x} is positive")
```

    Score 85 → Grade B
    10 is positive

#### Ternary operator — inline conditional expression

Inline conditional: `value_if_true if condition else value_if_false`. Reads like natural English. Can nest, but readability drops fast — avoid nesting beyond 2 levels.

```python
age = 20
status = "adult" if age >= 18 else "minor"
print(f"age={age} → {status}")

# Nested ternary (avoid — hard to read)
val = 15
label = "high" if val > 20 else "mid" if val > 10 else "low"
print(f"val={val} → {label}")
```

    age=20 → adult
    val=15 → mid

#### Truthy/falsy and chained comparisons

> [!info] Truthy/falsy
>
> - `if items:` — `True` for non-empty collections
> - Falsy values: `0`, `0.0`, `""`, `None`, `[]`, `{}`, `set()`
> - Chained comparisons: `0 < x < 100` evaluates `x` only once
> - `and`/`or` return operands: `name = user or "Anonymous"`

> [!warning] Don't use if x == True
>
> Don't use `if x == True` — just `if x`. But be careful with truthy checks when `0` or `""` is legitimate data — be explicit in those cases.

```python
items = [1, 2, 3]
if items:                          # truthy: non-empty list
    print(f"List has {len(items)} items")

name = ""
if not name:                       # falsy: empty string
    print("Name is empty")

value = None
if value is None:                  # explicit None check (preferred over falsy check)
    print("Value is None")

x = 15
if 10 < x < 20:                   # Python exclusive! Chained comparison
    print(f"{x} is between 10 and 20")
```

    List has 3 items
    Name is empty
    Value is None
    15 is between 10 and 20

#### match/case — pattern matching

> [!info] Pattern matching (Python 3.10+)
>
> - `match`/`case` — tests against patterns, not just equality
> - `|` for OR, `_` for wildcard, `if` for guards, variable binding
> - First match wins

> [!warning] Bare variable names in case
>
> Bare variable names in `case` **capture** (don't compare) — use literals or guards. Don't forget the `_` default — unmatched values silently pass through.

```python
command = "quit"
match command:
    case "start":
        print("Starting...")
    case "stop" | "quit" | "exit":    # multiple values with |
        print("Stopping...")
    case str(cmd) if cmd.startswith("go"):  # guard condition
        print(f"Going: {cmd}")
    case _:                            # wildcard: default case
        print(f"Unknown: {command}")
```

    Stopping...

#### match with destructuring

`case (x, 0)` binds `x` from a 2-tuple where second is 0. `case {"key": val}` matches dict structure. Combines validation and extraction in one step — the shape IS the condition.

```python
point = (3, 0)
match point:
    case (0, 0):
        print("Origin")
    case (x, 0):                       # destructure: bind x from tuple
        print(f"On x-axis at {x}")
    case (0, y):
        print(f"On y-axis at {y}")
    case (x, y):
        print(f"Point at ({x}, {y})")
```

    On x-axis at 3

#### match with type checking

> [!info] Type patterns
>
> - `case int(n)` — matches integers and binds to `n`
> - Combine with guards: `case int(n) if n > 0`
> - Replaces `isinstance()` chains with clean pattern syntax

```python
def describe(value):
    match value:
        case int(n) if n > 0:
            return f"positive int: {n}"
        case int(n):
            return f"non-positive int: {n}"
        case str(s):
            return f"string: '{s}'"
        case [first, *rest]:           # list destructuring: first element + rest
            return f"list starting with {first}, {len(rest)} more"
        case _:
            return f"other: {type(value).__name__}"

for v in [42, -5, "hello", [1, 2, 3], 3.14]:
    print(f"  {str(v):12} → {describe(v)}")
```

      42           → positive int: 42
      -5           → non-positive int: -5
      hello        → string: 'hello'
      [1, 2, 3]    → list starting with 1, 2 more
      3.14         → other: float

## Loops

#### for and while loops — iteration over iterables

> [!info] Loop types
>
> - `for` — iterates over any iterable (list, range, dict, generator)
> - `while` — repeats until the condition is false
> - `for i in range(n)` — replaces C-style `for(i=0; i<n; i++)`
> - `for`/`else` — the `else` block runs only if no `break` occurred
> - No `do-while` — use `while True: ... if cond: break`

> [!warning] Loop anti-patterns
>
> - `for i in range(len(items))` — use `for item in items` or `enumerate()`
> - `while True` without `break` — always have an exit condition
> - Modifying a list during iteration — use a copy or comprehension

```python
# Over a list
for fruit in ["apple", "banana", "cherry"]:
    print(f"  {fruit}")
```

      apple
      banana
      cherry

#### range()

> [!info] range() forms
>
> - `range(stop)`, `range(start, stop)`, `range(start, stop, step)`
> - Stop is exclusive; negative step for countdown
> - Lazy — constant memory regardless of size; `500 in range(1000)` is O(1)

```python
print("range(5):")
for i in range(5):              # 0, 1, 2, 3, 4
    print(f"  {i}", end=" ")
print()

print("range(2, 8):")
for i in range(2, 8):           # 2, 3, 4, 5, 6, 7
    print(f"  {i}", end=" ")
print()

print("range(0, 20, 3):")
for i in range(0, 20, 3):      # 0, 3, 6, 9, 12, 15, 18 (step=3)
    print(f"  {i}", end=" ")
print()

print("range(10, 0, -2):")
for i in range(10, 0, -2):     # 10, 8, 6, 4, 2 (count down)
    print(f"  {i}", end=" ")
print()
```

    range(5):
      0   1   2   3   4 
    range(2, 8):
      2   3   4   5   6   7 
    range(0, 20, 3):
      0   3   6   9   12   15   18 
    range(10, 0, -2):
      10   8   6   4   2

#### Iterating strings and dicts — .items(), .values(), .keys()

Strings yield characters one at a time. Dicts yield keys by default; `.items()` for `(key, value)`, `.values()` for values only. Don't use `for key in dict: dict[key]` — use `for k, v in dict.items()`.

```python
print("Over string:")
for ch in "Hello":
    print(f"  '{ch}'", end=" ")
print()

print("\nOver dict:")
d = {"name": "Alice", "age": 30, "city": "NYC"}
for key in d:                    # iterates over keys by default
    print(f"  {key} = {d[key]}")

for key, value in d.items():     # key-value pairs
    print(f"  {key}: {value}")
```

    Over string:
      'H'   'e'   'l'   'l'   'o' 
    
    Over dict:
      name = Alice
      age = 30
      city = NYC
      name: Alice
      age: 30
      city: NYC

#### enumerate and zip

> [!info] Enumerate and zip
>
> - `enumerate(iterable, start=0)` — yields `(index, element)`
> - `zip(a, b)` — yields `(a_i, b_i)`, stopping at the shortest
> - Both are lazy; use `enumerate` instead of `range(len(items))`
>
> > [!warning] `zip` with unequal lengths silently truncates — use `zip_longest` if needed.

```python
print("enumerate:")
for i, fruit in enumerate(["apple", "banana", "cherry"]):
    print(f"  [{i}] {fruit}")

for i, fruit in enumerate(["apple", "banana"], start=1):  # custom start
    print(f"  [{i}] {fruit}")

# zip — pairs up elements by position; stops at the shortest iterable
# pairs elements from multiple iterables
print("\nzip:")
names = ["Alice", "Bob", "Charlie"]
ages = [30, 25, 35]
for name, age in zip(names, ages):
    print(f"  {name} is {age}")
```

    enumerate:
      [0] apple
      [1] banana
      [2] cherry
      [1] apple
      [2] banana
    
    zip:
      Alice is 30
      Bob is 25
      Charlie is 35

#### while and for/else

> [!info] While and for/else
>
> - `while` — repeats until condition is false
> - `for`/`else` — the `else` block runs only if no `break` occurred (search found/not found idiom)
> - Use `for`/`else` for search patterns; `while` for polling, retry, input validation

> [!warning] The else in for/else runs
>
> The `else` in `for`/`else` runs when there's **no** `break` — the name is counterintuitive. Don't use it for non-search patterns.

```python
count = 0
while count < 5:
    print(f"  count = {count}")
    count += 1

# else block runs if loop completes WITHOUT break
for n in [2, 4, 6, 8]:
    if n % 3 == 0:
        print(f"  Found multiple of 3: {n}")
        break
else:
    print("  No multiple of 3 found")  # this runs — no break happened
```

      count = 0
      count = 1
      count = 2
      count = 3
      count = 4
      Found multiple of 3: 6

#### do-while workaround and nested loops

`while True: body; if cond: break` guarantees at least one execution — Python's do-while substitute. For Cartesian products, prefer `itertools.product()` over deep nesting.

```python
while True:
    val = 42  # simulate getting input
    print(f"  Got value: {val}")
    if val > 0:
        break    # exit after at least one iteration

# Nested loops — inner loop runs fully for each outer iteration
for i in range(3):
    for j in range(3):
        print(f"  ({i},{j})", end="")
    print()
```

      Got value: 42
      (0,0)  (0,1)  (0,2)
      (1,0)  (1,1)  (1,2)
      (2,0)  (2,1)  (2,2)

## Loop Control (break, continue, pass)

#### break — exit the innermost loop

> [!info] Loop control
>
> - `break` — exits the innermost loop immediately (does NOT exit outer loops)
> - `continue` — skips to the next iteration
> - `pass` — no-op placeholder for empty blocks
> - Python has no labeled break — none of these affect outer loops
> - Walrus operator (`:=`) — assigns a value AND returns it in one expression

```python
for i in range(10):
    if i == 5:
        print(f"  Breaking at {i}")
        break
    print(f"  {i}", end=" ")
print()
```

      0   1   2   3   4   Breaking at 5

#### continue and pass

`continue` jumps to the next iteration, skipping the remaining body — avoids nested `if`/`else` for filtering. `pass` is a no-op placeholder for empty blocks.

> [!warning] Don't use pass in production
>
> Don't use `pass` in production `except` blocks — at minimum log the error.

```python
for i in range(10):
    if i % 2 == 0:
        continue           # skip even numbers
    print(f"  {i}", end=" ")
print()

for i in range(5):
    if i == 3:
        pass               # handle this case later
    else:
        print(f"  {i}", end=" ")
print()

# pass is also used for empty class/function bodies
class Placeholder:
    pass
```

      1   3   5   7   9 
      0   1   2   4

#### Nested break behavior — only exits the innermost loop

In nested loops, `break` affects only the innermost loop — outer loops continue. Python has no labeled break. For multi-level exit, use a flag + break, or extract to a function and `return`.

```python
for i in range(3):
    for j in range(3):
        if j == 2:
            break          # only breaks inner loop
        print(f"  ({i},{j})", end="")
    print()
```

      (0,0)  (0,1)
      (1,0)  (1,1)
      (2,0)  (2,1)

#### Breaking outer loops — flag or function

Two patterns for breaking outer loops: (1) **flag** — set `found = True` + `break` inner, check flag + `break` outer. (2) **Function extraction** — wrap nested loops in a function, use `return`. Function is cleaner and more Pythonic.

```python
found = False
for i in range(3):
    for j in range(3):
        if i == 1 and j == 1:
            found = True
            break
    if found:
        break
print(f"  Broke at ({i},{j})")

# Method 2: wrap in function + return
def find_pair():
    for i in range(3):
        for j in range(3):
            if i == 1 and j == 1:
                return (i, j)
    return None
print(f"  Found: {find_pair()}")
```

      Broke at (1,1)
      Found: (1, 1)

#### Walrus operator — :=

`(var := expr)` assigns and returns the value in one expression. Eliminates the "read-before-loop" duplication. Also works in comprehensions: `[y for x in data if (y := f(x)) > 0]`. Don't overuse — simple assignments are clearer with `=`.

```python
reader = io.StringIO("line1\nline2\nline3\n")
while (line := reader.readline()):    # assigns line AND checks if truthy
    print(f"  '{line.strip()}'")

# Walrus in if statement
data = "Hello World"
if (n := len(data)) > 5:             # assigns n AND checks condition
    print(f"  String has {n} chars (> 5)")

# Walrus in list comprehension
results = [y for x in range(10) if (y := x ** 2) > 20]
print(f"  Squares > 20: {results}")
```

      'line1'
      'line2'
      'line3'
      String has 11 chars (> 5)
      Squares > 20: [25, 36, 49, 64, 81]

## Iterators & Generators (yield)

#### Generator functions — yield for lazy sequences

A function with `yield` becomes a generator. Each `next()` call resumes execution until the next `yield` — state is preserved between calls. Values are computed lazily (on demand, not upfront). Generators are single-use — exhausted after one pass.

Key concepts: `yield from` delegates to sub-generators, generator expressions `(x for x in ...)` are lazy comprehensions, `StopIteration` signals exhaustion, and the iterator protocol requires `__iter__()` + `__next__()`.

> [!warning] Generator pitfalls
>
> - Returning a list when `yield` would be lazier
> - Calling `list()` on a generator just to iterate — defeats lazy evaluation
> - Generators are single-use — exhausted after one pass

```python
def countdown(n):
    print(f"  Starting countdown from {n}")
    while n > 0:
        yield n          # pauses here, returns value, resumes on next()
        n -= 1
    print("  Done!")

# Using in a for loop (most common)
for val in countdown(5):
    print(f"  {val}", end=" ")
print()
```

      Starting countdown from 5
      5   4   3   2   1   Done!

#### Manual iteration with next()

`next(gen)` returns the next yielded value. Raises `StopIteration` when exhausted — use `next(gen, default)` to return a default instead. Use for peeking at the first element or partial consumption.

```python
gen = countdown(3)
print(f"  next: {next(gen)}")    # 3
print(f"  next: {next(gen)}")    # 2
print(f"  next: {next(gen)}")    # 1
# next(gen) would raise StopIteration
```

      Starting countdown from 3
      next: 3
      next: 2
      next: 1

#### List vs generator expression

> [!info] List vs generator expression
>
> - `[expr for x in iter]` — creates a list in memory (eager)
> - `(expr for x in iter)` — creates a generator (lazy, on-demand, constant memory)
> - As a function arg, parentheses can be omitted: `sum(x**2 for x in range(n))`
> - Use **generators** for large/streaming data; **lists** when you need indexing, `len()`, or multiple passes

```python
squares_list = [x**2 for x in range(10)]
print(f"List: {squares_list}")

# Generator expression — lazy: creates values on demand
squares_gen = (x**2 for x in range(10))
print(f"Generator: {squares_gen}")      # <generator object>
print(f"As list:   {list(squares_gen)}") # consume it

# Memory difference: list stores everything, generator stores nothing
big_list = [x for x in range(100000)]
big_gen = (x for x in range(100000))
print(f"\nList size:      {sys.getsizeof(big_list):>8} bytes")
print(f"Generator size: {sys.getsizeof(big_gen):>8} bytes")
```

    List: [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
    Generator: <generator object <genexpr> at 0x0000018C86002740>
    As list:   [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
    
    List size:        800984 bytes
    Generator size:      192 bytes

#### yield from

`yield from iterable` replaces `for item in iterable: yield item` in one line. Enables recursive generators (flatten) and delegation to sub-generators. Watch out: `yield from` on strings yields each character separately, and deep recursion may hit the limit.

```python
def flatten(nested):
    for item in nested:
        if isinstance(item, list):
            yield from flatten(item)   # recursively yield from sub-generator
        else:
            yield item

nested = [1, [2, 3], [4, [5, 6]], 7]
print(f"Flatten: {list(flatten(nested))}")
```

    Flatten: [1, 2, 3, 4, 5, 6, 7]

#### Infinite generators — islice, map, filter, reversed

`while True` with `yield` produces infinite values. Callers control with `islice`, break, or `zip`. Zero storage — values computed on demand.

> [!danger] Never call list() or len()
>
> Never call `list()` or `len()` on an infinite generator — hangs or OOM. Always limit with `islice` or `break`.

```python
def naturals(start=0):
    n = start
    while True:          # never ends!
        yield n
        n += 1

print(f"First 5 naturals: {list(islice(naturals(), 5))}")
print(f"From 10:          {list(islice(naturals(10), 5))}")

# Built-in iterators — all lazy; wrap in list() to materialise
print(f"range(5):       {list(range(5))}")
print(f"enumerate:      {list(enumerate('abc'))}")
print(f"zip:            {list(zip([1,2], ['a','b']))}")
print(f"map:            {list(map(str.upper, ['a','b']))}")
print(f"filter:         {list(filter(lambda x: x > 2, [1,2,3,4]))}")
print(f"reversed:       {list(reversed([1,2,3]))}")
```

    First 5 naturals: [0, 1, 2, 3, 4]
    From 10:          [10, 11, 12, 13, 14]
    range(5):       [0, 1, 2, 3, 4]
    enumerate:      [(0, 'a'), (1, 'b'), (2, 'c')]
    zip:            [(1, 'a'), (2, 'b')]
    map:            ['A', 'B']
    filter:         [3, 4]
    reversed:       [3, 2, 1]

#### itertools

> [!info] Key itertools functions (all lazy generators)
>
> - `chain` — joins iterables end-to-end
> - `cycle` — repeats infinitely
> - `repeat` — yields same value *n* times
> - `accumulate` — computes running totals
> - `product` — Cartesian product
>
> > [!warning] Never `list(cycle(...))` — infinite memory.

```python
print(f"chain:          {list(chain([1,2], [3,4]))}")
print(f"repeat:         {list(repeat('x', 3))}")
print(f"accumulate:     {list(accumulate([1,2,3,4]))}")
print(f"product:        {list(product('ab', '12'))}")
```

    chain:          [1, 2, 3, 4]
    repeat:         ['x', 'x', 'x']
    accumulate:     [1, 3, 6, 10]
    product:        [('a', '1'), ('a', '2'), ('b', '1'), ('b', '2')]

#### Iterator protocol — __iter__ and __next__

Define `__iter__(self)` returning `self` and `__next__(self)` raising `StopIteration` when done. Makes any class usable in `for` loops, `list()`, and all iteration contexts. Use for complex stateful iteration — for simple sequences, generator functions are much less code.

```python
class Squares:
    def __init__(self, n):
        self.n = n
        self.i = 0
    def __iter__(self):
        return self           # the iterator is itself
    def __next__(self):
        if self.i >= self.n:
            raise StopIteration   # signal "no more values"
        val = self.i ** 2
        self.i += 1
        return val

print(f"Squares(5): {list(Squares(5))}")
```

    Squares(5): [0, 1, 4, 9, 16]

#### Flatten nested iterables — four approaches

Four flatten approaches, each suited to a different nesting depth: `chain.from_iterable` (1 level), `more_itertools.collapse` (any depth), stack-based iterative (no dependencies), `pd.json_normalize` (nested dicts).

```python
nested = [1, [2, 3], [4, [5, 6]], 7]
```

#### itertools chain.from_iterable and more_itertools collapse

`chain.from_iterable` flattens exactly one level — inner lists stay nested. Stdlib, lazy, no external dependency. For arbitrary depth, use `more_itertools.collapse`.

```python
one_level = list(chain.from_iterable([[1, 2], [3, 4], [5, 6]]))
print(f"chain (1 level):  {one_level}")

print(f"collapse (deep):  {list(collapse(nested))}")
```

    chain (1 level):  [1, 2, 3, 4, 5, 6]
    collapse (deep):  [1, 2, 3, 4, 5, 6, 7]

#### Iterative Flatten with Stack

Stack-based iterative flatten — no recursion, no depth limits, handles arbitrarily deep nesting safely. Watch out: strings are iterable and cause infinite loops if not checked.

```python
def flatten_iter(nested):
    """Flatten using an explicit stack — no recursion needed."""
    stack = list(reversed(nested))
    result = []
    while stack:
        item = stack.pop()
        if isinstance(item, list):
            stack.extend(reversed(item))
        else:
            result.append(item)
    return result

nested = [1, [2, 3], [4, [5, 6]], 7]
print(f"Iterative flatten: {flatten_iter(nested)}")
```

    Iterative flatten: [1, 2, 3, 4, 5, 6, 7]

#### pandas json_normalize

`pd.json_normalize` takes a list of nested dicts, flattens nested keys into dot-separated column names, and handles missing keys with NaN. One-line flatten for API responses and JSON files.

```python
nested_records = [
    {"name": "Alice", "address": {"city": "NYC", "zip": "10001"}},
    {"name": "Bob", "address": {"city": "LA", "zip": "90001"}},
]
df = pd.json_normalize(nested_records)
print(f"\npandas json_normalize:\n{df}")
```

    
    pandas json_normalize:
        name address.city address.zip
    0  Alice          NYC       10001
    1    Bob           LA       90001

#### Flatten approach summary

| Scenario | Approach |
|---|---|
| 1 level deep | `list(chain.from_iterable(nested))` |
| Any depth | `list(collapse(nested))` (more-itertools) |
| No dependencies | Iterative with stack (no recursion needed) |
| Nested JSON | `pd.json_normalize(records)` |

## Comprehensions & Functional Tools

#### List comprehension — concise collection building

`[expr for item in iterable if condition]` — builds a new list by applying an expression to each element, optionally filtering with `if`. More readable than `map`/`filter`/`lambda` and faster than equivalent `for` loops (optimized at bytecode level).

> [!warning] Don't use comprehensions for side
>
> Don't use comprehensions for side effects (printing, writing). Don't nest beyond 2 levels — use explicit loops instead.

```python
squares = [x**2 for x in range(10)]
print(f"Squares:  {squares}")

evens = [x for x in range(20) if x % 2 == 0]
print(f"Evens:    {evens}")

# With transformation + filter
words = ["hello", "world", "python", "is", "great"]
long_upper = [w.upper() for w in words if len(w) > 3]
print(f"Long upper: {long_upper}")
```

    Squares:  [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
    Evens:    [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]
    Long upper: ['HELLO', 'WORLD', 'PYTHON', 'GREAT']

#### Nested comprehensions

`[expr for outer in iter1 for inner in iter2]` — outer loop first, then inner (same order as nested `for` loops). One-line flatten: `[n for row in matrix for n in row]`. Don't nest beyond 2 levels.

```python
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
flat = [n for row in matrix for n in row]    # read left-to-right: for row, then for n
print(f"Flat:     {flat}")

# Nested comprehension (create 2D)
grid = [[(i, j) for j in range(3)] for i in range(3)]
print(f"Grid:     {grid}")
```

    Flat:     [1, 2, 3, 4, 5, 6, 7, 8, 9]
    Grid:     [[(0, 0), (0, 1), (0, 2)], [(1, 0), (1, 1), (1, 2)], [(2, 0), (2, 1), (2, 2)]]

#### Dict and set comprehensions

> [!info] Dict and set comprehensions
>
> - `{k: v for item in iterable}` — builds a dict
> - `{expr for item}` — builds a set (auto-deduplicates)
> - Both support `if` filtering
> - Invert a dict: `{v: k for k, v in d.items()}`
>
> > [!warning] Dict with duplicate keys — last value wins silently.

```python
squares_dict = {x: x**2 for x in range(6)}
print(f"Squares dict: {squares_dict}")

# Swap keys and values
original = {"a": 1, "b": 2, "c": 3}
swapped = {v: k for k, v in original.items()}
print(f"Swapped:      {swapped}")

# Filter dict
scores = {"Alice": 85, "Bob": 92, "Charlie": 78, "Diana": 95}
passed = {name: score for name, score in scores.items() if score >= 80}
print(f"Passed:       {passed}")

# {expression for item in iterable} — duplicates automatically removed
words = ["hello", "world", "python", "is", "great"]
unique_lengths = {len(w) for w in words}
print(f"Unique lengths: {unique_lengths}")
```

    Squares dict: {0: 0, 1: 1, 2: 4, 3: 9, 4: 16, 5: 25}
    Swapped:      {1: 'a', 2: 'b', 3: 'c'}
    Passed:       {'Alice': 85, 'Bob': 92, 'Diana': 95}
    Unique lengths: {2, 5, 6}

#### map and filter

> [!info] Map and filter
>
> - `map(func, iterable)` — applies `func` to every element
> - `filter(pred, iterable)` — keeps elements where `pred` is True
> - Both are lazy; best with named functions (`map(str.upper, words)`)
> - With lambdas, comprehensions are almost always clearer

```python
nums = [1, 2, 3, 4, 5]
doubled = list(map(lambda x: x * 2, nums))    # lambda = anonymous function
print(f"Doubled: {doubled}")

# Comprehension equivalent (preferred in Python):
doubled2 = [x * 2 for x in nums]
print(f"Same:    {doubled2}")

evens = list(filter(lambda x: x % 2 == 0, nums))
print(f"Evens:   {evens}")
```

    Doubled: [2, 4, 6, 8, 10]
    Same:    [2, 4, 6, 8, 10]
    Evens:   [2, 4]

#### reduce and built-in aggregations

> [!info] Reduce and built-in aggregations
>
> - `reduce(func, iterable, initial)` — applies `func` cumulatively, folds into one value
> - Prefer built-ins: `sum()`, `min()`, `max()`, `any()`, `all()` — faster (C code) and short-circuit

```python
nums = [1, 2, 3, 4, 5]
total = reduce(lambda acc, x: acc + x, nums, 0)
print(f"Sum:     {total}")
product = reduce(lambda acc, x: acc * x, nums, 1)
print(f"Product: {product}")

# Built-in alternatives (preferred over reduce for common cases):
print(f"sum():   {sum(nums)}")
print(f"max():   {max(nums)}")
print(f"min():   {min(nums)}")
print(f"all():   {all(x > 0 for x in nums)}")    # True if ALL match
print(f"any():   {any(x > 3 for x in nums)}")    # True if ANY match
```

    Sum:     15
    Product: 120
    sum():   15
    max():   5
    min():   1
    all():   True
    any():   True

#### sorted() with key function — custom sort order, multi-key, reverse

> [!info] Sorting
>
> - `sorted(iterable, key=func)` — returns a new sorted list
> - `list.sort()` — sorts in place
> - `key` extracts the comparison value: `key=len`, `key=str.lower`, `key=lambda x: x[1]`
> - `reverse=True` — descending order
> - Python's sort is **stable** — equal elements keep original order
> - Multiple sort keys — return a tuple: `key=lambda x: (x[0], -x[1])`

```python
names = ["Charlie", "Alice", "Bob", "Diana"]
print(f"Alphabetical:  {sorted(names)}")
print(f"By length:     {sorted(names, key=len)}")
print(f"Reverse:       {sorted(names, reverse=True)}")
print(f"By last char:  {sorted(names, key=lambda n: n[-1])}")
```

    Alphabetical:  ['Alice', 'Bob', 'Charlie', 'Diana']
    By length:     ['Bob', 'Alice', 'Diana', 'Charlie']
    Reverse:       ['Diana', 'Charlie', 'Bob', 'Alice']
    By last char:  ['Diana', 'Bob', 'Charlie', 'Alice']

#### Choosing the right iteration construct

| Construct | Use when |
|---|---|
| **Comprehension** | Simple transform/filter → new collection |
| **`for` loop** | Side effects, complex logic, multiple statements |
| **`map`/`filter`** | You already have a named function |
| **Generator** | Lazy pipeline, large data, memory-constrained |

> [!warning] Avoid nested comprehensions with more
>
> Avoid nested comprehensions with more than 2 levels — use explicit loops instead. Don't use comprehensions for side effects; don't use `for` loops when a comprehension would be cleaner.

    Use comprehension: simple transform/filter → new collection
    Use for loop:      side effects, complex logic, multiple statements
    Use map/filter:    when you already have a named function
    Avoid:             nested comprehensions with >2 levels (use loops)
