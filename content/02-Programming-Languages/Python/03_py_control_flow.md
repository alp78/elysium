---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [if else, loops, for loop, while loop, switch, pattern matching, match case]
keywords: [if, elif, else, for, while, break, continue, pass, match, case, comprehension, generator, yield]
description: "Python control flow reference with executable examples and cell outputs — covers conditionals, loops, loop control, iterators, generators, and comprehensions. See [[03_cs_control_flow]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[03_cs_control_flow]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 03. Control Flow - Python

## Conditional Statements

```python
# if / elif / else — Python uses indentation, no braces or parentheses required
#
# KEY CONCEPTS:
# - Conditional chain: a sequence of if/elif/else that checks conditions top-to-bottom.
#   The FIRST matching condition wins — all subsequent branches are skipped.
# - Precedence ordering (most restrictive first): when comparing ranges (>=90, >=80, >=70),
#   you MUST put the highest/most specific threshold first. If you put >=60 first,
#   it would catch everything including scores of 90+, and later branches would never run.
# - Ternary expression: a one-line if/else that returns a value: `x if cond else y`
# - Truthy/falsy: Python evaluates any value as a boolean in conditions.
#   Falsy values: False, 0, 0.0, "", [], {}, set(), None, range(0)
#   Everything else is truthy.
# - Chained comparison: Python allows `10 < x < 20` which means `10 < x and x < 20`.

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

#### Ternary expression

```python
# Ternary expression — single-line conditional: value_if_true if condition else value_if_false
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

```python
# Python checks truthiness — no need for explicit comparisons
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

<h4><code style="font-size:0.75em">match/case</code> — pattern matching</h4>

```python
# Pattern matching: test a value against multiple PATTERNS (not just equality).
# - Wildcard (_): matches anything, used as a default/catch-all case
# - Guard (if ...): an extra condition on a pattern
# - Destructuring: extracting parts of a structure into variables
# - Fall-through: does NOT exist in Python match/case — only one branch runs
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

```python
# match with destructuring — bind variables from tuple shape; _ is the wildcard
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

```python
# match with type checking — case int(n), case str(s) bind and test the type in one step
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

```python
# Loops — for, while, for/else
# Python has NO do-while, NO traditional C-style for(i=0; i<n; i++)
#
# KEY CONCEPTS:
# - Iterable: any object you can loop over (list, string, dict, range, file, generator).
# - range(): a lazy iterable that generates numbers on demand.
# - enumerate(): wraps an iterable to provide (index, value) pairs.
# - zip(): iterates multiple iterables in parallel, stopping at the shortest.
# - for/else: the else block runs ONLY if the loop completed without hitting break.
# - do-while: Python doesn't have it — use `while True: ... if cond: break`.

# Over a list
for fruit in ["apple", "banana", "cherry"]:
    print(f"  {fruit}")
```

      apple
      banana
      cherry

<h4><code style="font-size:0.75em">range()</code></h4>

```python
# range(start, stop, step) — generates integers; stop is exclusive; step can be negative
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

#### Iterating strings and dicts

```python
# Iterating strings and dicts — strings yield characters; dicts yield keys by default, .items() for pairs
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

<h4><code style="font-size:0.75em">enumerate</code> and <code style="font-size:0.75em">zip</code></h4>

```python
# enumerate adds an index to any iterable
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

<h4><code style="font-size:0.75em">while</code> and <code style="font-size:0.75em">for/else</code></h4>

```python
# while loops repeat until condition is false; for/else runs the else block only if no break occurred
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

```python
# Python has no do-while — use while True + break
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

```python
# Loop Control — break, continue, pass
#
# KEY CONCEPTS:
# - break: immediately exits the innermost loop. Does NOT exit outer loops.
# - continue: skips the rest of the current iteration and jumps to the next one.
# - pass: a no-op placeholder — used when syntax requires a body but you don't have code yet.
# - Walrus operator (:=): assigns a value AND returns it in a single expression.

for i in range(10):
    if i == 5:
        print(f"  Breaking at {i}")
        break
    print(f"  {i}", end=" ")
print()
```

      0   1   2   3   4   Breaking at 5

<h4><code style="font-size:0.75em">continue</code> and <code style="font-size:0.75em">pass</code></h4>

```python
# continue skips the rest of the current iteration; pass is a no-op placeholder for empty blocks
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

#### break only exits the innermost loop

```python
# break only exits the innermost loop — outer loops continue their next iteration
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

```python
# Method 1: flag
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

<h4>Walrus operator — <code style="font-size:0.75em">:=</code></h4>

```python
# Without walrus — must assign before AND inside the loop:
#   line = f.readline()
#   while line:
#       process(line)
#       line = f.readline()    # duplicate!
#
# With walrus — assign and test in one expression:
#   while (line := f.readline()):
#       process(line)           # no duplication!
import io
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

```python
# Iterators & Generators — lazy evaluation with yield
#
# KEY CONCEPTS:
# - Generator: a function that uses 'yield' instead of 'return'. Each call to next()
#   resumes execution from where it last yielded, preserving local state.
# - Lazy evaluation: values are computed only when requested, not upfront.
# - yield from: delegates iteration to another generator/iterable.
# - Generator expression: like a list comprehension but lazy: (x for x in ...)
# - StopIteration: the exception raised when a generator/iterator is exhausted.
# - Iterator protocol: any object with __iter__() and __next__() methods.
# - itertools: standard library module with powerful lazy iterator utilities

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

<h4>Manual iteration with <code style="font-size:0.75em">next()</code></h4>

```python
# next() advances a generator one step; raises StopIteration when exhausted
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

```python
# List comprehension — eager: creates ALL values in memory
squares_list = [x**2 for x in range(10)]
print(f"List: {squares_list}")

# Generator expression — lazy: creates values on demand
squares_gen = (x**2 for x in range(10))
print(f"Generator: {squares_gen}")      # <generator object>
print(f"As list:   {list(squares_gen)}") # consume it

# Memory difference: list stores everything, generator stores nothing
import sys
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

<h4><code style="font-size:0.75em">yield from</code></h4>

```python
# yield from delegates to a sub-generator — equivalent to a for loop with yield for each item
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

#### Infinite generator and built-in iterators

```python
# Infinite generator produces values on demand; islice limits how many to consume
def naturals(start=0):
    n = start
    while True:          # never ends!
        yield n
        n += 1

from itertools import islice
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

<h4><code style="font-size:0.75em">itertools</code></h4>

```python
# itertools — combinatorial and infinite iterators from the standard library
from itertools import chain, cycle, repeat, accumulate, product
print(f"chain:          {list(chain([1,2], [3,4]))}")
print(f"repeat:         {list(repeat('x', 3))}")
print(f"accumulate:     {list(accumulate([1,2,3,4]))}")
print(f"product:        {list(product('ab', '12'))}")
```

    chain:          [1, 2, 3, 4]
    repeat:         ['x', 'x', 'x']
    accumulate:     [1, 3, 6, 10]
    product:        [('a', '1'), ('a', '2'), ('b', '1'), ('b', '2')]

<h4>Iterator protocol — <code style="font-size:0.75em">__iter__</code> and <code style="font-size:0.75em">__next__</code></h4>

```python
# Any class with __iter__() and __next__() can be used in for loops.
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

```python
# Practical alternatives to manual recursive flatten
# In real code, use libraries instead of writing recursion yourself

nested = [1, [2, 3], [4, [5, 6]], 7]
```

#### Flatten alternatives

```python
# chain.from_iterable flattens one level; more_itertools.collapse handles arbitrary depth
from itertools import chain
one_level = list(chain.from_iterable([[1, 2], [3, 4], [5, 6]]))
print(f"chain (1 level):  {one_level}")

from more_itertools import collapse
print(f"collapse (deep):  {list(collapse(nested))}")
```

    chain (1 level):  [1, 2, 3, 4, 5, 6]
    collapse (deep):  [1, 2, 3, 4, 5, 6, 7]

#### Iterative Flatten with Stack

```python
# Iterative flatten with an explicit stack — avoids recursion depth limits
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

```python
# pd.json_normalize flattens nested dicts in a list of records into a flat DataFrame
import pandas as pd
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

```python
# Summary — choosing the right flatten approach based on depth and dependencies
print("1 level deep:     list(chain.from_iterable(nested))")
print("Any depth:        list(collapse(nested))  (more-itertools)")
print("No dependencies:  iterative with stack (no recursion needed)")
print("Nested JSON:      pd.json_normalize(records)")
```

    1 level deep:     list(chain.from_iterable(nested))
    Any depth:        list(collapse(nested))  (more-itertools)
    No dependencies:  iterative with stack (no recursion needed)
    Nested JSON:      pd.json_normalize(records)

## Comprehensions & Functional Tools

```python
# Comprehensions — concise way to create collections from loops
#
# KEY CONCEPTS:
# - Comprehension: [expr for item in iterable if cond] — builds a new collection.
# - Lambda: anonymous function: `lambda x: x * 2`
# - map/filter: apply function to each element / keep matching elements.
# - reduce (fold): accumulate all elements into one value.

# [expression for item in iterable if condition]
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

```python
# Nested comprehension (flatten)
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
flat = [n for row in matrix for n in row]    # read left-to-right: for row, then for n
print(f"Flat:     {flat}")

# Nested comprehension (create 2D)
grid = [[(i, j) for j in range(3)] for i in range(3)]
print(f"Grid:     {grid}")
```

    Flat:     [1, 2, 3, 4, 5, 6, 7, 8, 9]
    Grid:     [\[(0, 0), (0, 1), (0, 2)], \[(1, 0), (1, 1), (1, 2)], \[(2, 0), (2, 1), (2, 2)]]

#### Dict and set comprehensions

```python
# {key: value for item in iterable if condition}
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

<h4><code style="font-size:0.75em">map</code> and <code style="font-size:0.75em">filter</code></h4>

```python
# map applies a function to every element; filter keeps elements matching a predicate
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

<h4><code style="font-size:0.75em">reduce</code> and built-in aggregations</h4>

```python
# reduce folds a sequence into a single value; built-ins like sum/max/any are preferred for common cases
from functools import reduce
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

#### Sorting with a key function

```python
# key: a function that extracts the comparison value from each element
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

```python
# Summary — when to use comprehensions, loops, map/filter, or avoid nesting
print("Use comprehension: simple transform/filter → new collection")
print("Use for loop:      side effects, complex logic, multiple statements")
print("Use map/filter:    when you already have a named function")
print("Avoid:             nested comprehensions with >2 levels (use loops)")
```

    Use comprehension: simple transform/filter → new collection
    Use for loop:      side effects, complex logic, multiple statements
    Use map/filter:    when you already have a named function
    Avoid:             nested comprehensions with >2 levels (use loops)
