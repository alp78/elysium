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

## 1. Conditional Statements


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
#   (C# uses `cond ? x : y` — same concept, different syntax)
# - Truthy/falsy: Python evaluates any value as a boolean in conditions.
#   Falsy values: False, 0, 0.0, "", [], {}, set(), None, range(0)
#   Everything else is truthy. C# does NOT have this — conditions must be explicit bool.
# - Chained comparison: Python allows `10 < x < 20` which means `10 < x and x < 20`.
#   C# does not support this — you must write `10 < x && x < 20`.

# === Basic if/elif/else ===
print("=== if / elif / else ===")
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

# === Single line (simple cases only) ===
print("\n=== Single Line ===")
x = 10
if x > 0: print(f"{x} is positive")

# === Ternary expression ===
print("\n=== Ternary Expression ===")
age = 20
status = "adult" if age >= 18 else "minor"
print(f"age={age} → {status}")

# Nested ternary (avoid — hard to read)
val = 15
label = "high" if val > 20 else "mid" if val > 10 else "low"
print(f"val={val} → {label}")

# === Truthy / Falsy in conditions ===
print("\n=== Truthy / Falsy ===")
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

# === Chained conditions ===
print("\n=== Chained Conditions ===")
x = 15
if 10 < x < 20:                   # Python exclusive! Chained comparison
    print(f"{x} is between 10 and 20")

# === match/case (Python 3.10+) — structural pattern matching ===
# Pattern matching: a way to test a value against multiple PATTERNS (not just equality).
# Patterns can match values, types, structures (tuples, lists), and object properties.
# Different from regex — regex matches text patterns, match/case matches data structures.
# - Wildcard (_): matches anything, used as a default/catch-all case
# - Guard (if ...): an extra condition on a pattern
# - Destructuring: extracting parts of a structure into variables, e.g. (x, y) from a tuple
# - Fall-through: does NOT exist in Python match/case — only one branch runs

print("\n=== match/case (Python 3.10+) ===")
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

# match with destructuring — extracting parts of a tuple
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

# match with type checking
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

    === if / elif / else ===
    Score 85 → Grade B
    
    === Single Line ===
    10 is positive
    
    === Ternary Expression ===
    age=20 → adult
    val=15 → mid
    
    === Truthy / Falsy ===
    List has 3 items
    Name is empty
    Value is None
    
    === Chained Conditions ===
    15 is between 10 and 20
    
    === match/case (Python 3.10+) ===
    Stopping...
    On x-axis at 3
      42           → positive int: 42
      -5           → non-positive int: -5
      hello        → string: 'hello'
      [1, 2, 3]    → list starting with 1, 2 more
      3.14         → other: float
    

## 2. Loops


```python
# Loops — for, while, for/else
# Python has NO do-while, NO traditional C-style for(i=0; i<n; i++)
#
# KEY CONCEPTS:
# - Iterable: any object you can loop over (list, string, dict, range, file, generator).
#   Technically, any object with an __iter__() method.
# - Iterator: the internal mechanism that tracks position during iteration.
#   Created by calling iter() on an iterable, produces values via next().
# - range(): a lazy iterable that generates numbers on demand without storing them all.
#   range(stop), range(start, stop), range(start, stop, step)
# - enumerate(): wraps an iterable to provide (index, value) pairs.
# - zip(): iterates multiple iterables in parallel, stopping at the shortest.
# - for/else: the else block runs ONLY if the loop completed without hitting break.
#   This is Python-exclusive — C# has no equivalent (use a bool flag instead).
# - do-while: a loop that runs at least once before checking the condition.
#   Python doesn't have it — use `while True: ... if cond: break` as a workaround.

# === for loop — iterates over ANY iterable ===
print("=== for loop ===")
# Over a list
for fruit in ["apple", "banana", "cherry"]:
    print(f"  {fruit}")

# Over a range (C#: for(int i=0; i<5; i++))
print("\nrange(5):")
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

# Over a string
print("\nOver string:")
for ch in "Hello":
    print(f"  '{ch}'", end=" ")
print()

# Over a dict
print("\nOver dict:")
d = {"name": "Alice", "age": 30, "city": "NYC"}
for key in d:                    # iterates over keys by default
    print(f"  {key} = {d[key]}")

for key, value in d.items():     # key-value pairs
    print(f"  {key}: {value}")

# enumerate — index + value
print("\nenumerate:")
for i, fruit in enumerate(["apple", "banana", "cherry"]):
    print(f"  [{i}] {fruit}")

for i, fruit in enumerate(["apple", "banana"], start=1):  # custom start
    print(f"  [{i}] {fruit}")

# zip — iterate multiple sequences in parallel
print("\nzip:")
names = ["Alice", "Bob", "Charlie"]
ages = [30, 25, 35]
for name, age in zip(names, ages):
    print(f"  {name} is {age}")

# === while loop ===
print("\n=== while loop ===")
count = 0
while count < 5:
    print(f"  count = {count}")
    count += 1

# === for/else and while/else (Python exclusive!) ===
print("\n=== for/else (Python only!) ===")
# else block runs if loop completes WITHOUT break
for n in [2, 4, 6, 8]:
    if n % 3 == 0:
        print(f"  Found multiple of 3: {n}")
        break
else:
    print("  No multiple of 3 found")  # this runs — no break happened

# === No do-while in Python — workaround ===
print("\n=== do-while workaround ===")
while True:
    val = 42  # simulate getting input
    print(f"  Got value: {val}")
    if val > 0:
        break    # exit after at least one iteration

# === Nested loops ===
print("\n=== Nested Loops ===")
for i in range(3):
    for j in range(3):
        print(f"  ({i},{j})", end="")
    print()
```

    === for loop ===
      apple
      banana
      cherry
    
    range(5):
      0   1   2   3   4 
    range(2, 8):
      2   3   4   5   6   7 
    range(0, 20, 3):
      0   3   6   9   12   15   18 
    range(10, 0, -2):
      10   8   6   4   2 
    
    Over string:
      'H'   'e'   'l'   'l'   'o' 
    
    Over dict:
      name = Alice
      age = 30
      city = NYC
      name: Alice
      age: 30
      city: NYC
    
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
    
    === while loop ===
      count = 0
      count = 1
      count = 2
      count = 3
      count = 4
    
    === for/else (Python only!) ===
      Found multiple of 3: 6
    
    === do-while workaround ===
      Got value: 42
    
    === Nested Loops ===
      (0,0)  (0,1)  (0,2)
      (1,0)  (1,1)  (1,2)
      (2,0)  (2,1)  (2,2)
    

## 3. Loop Control (break, continue, pass)


```python
# Loop Control — break, continue, pass
#
# KEY CONCEPTS:
# - break: immediately exits the innermost loop. Does NOT exit outer loops.
# - continue: skips the rest of the current iteration and jumps to the next one.
# - pass: a no-op placeholder. Does nothing — used when syntax requires a body
#   but you don't have code yet (empty class, empty function, TODO placeholder).
#   C# has no equivalent — use {} or a comment instead.
# - Walrus operator (:=): assigns a value AND returns it in a single expression.
#   Named "walrus" because := looks like a walrus face rotated sideways.
#   Useful in while loops and if statements to avoid computing a value twice:
#     Without walrus: line = f.readline()  →  while line:  →  line = f.readline()
#     With walrus:    while (line := f.readline()):   (assign + test in one step)

# === break — exit loop immediately ===
print("=== break ===")
for i in range(10):
    if i == 5:
        print(f"  Breaking at {i}")
        break
    print(f"  {i}", end=" ")
print()

# === continue — skip to next iteration ===
print("\n=== continue ===")
for i in range(10):
    if i % 2 == 0:
        continue           # skip even numbers
    print(f"  {i}", end=" ")
print()

# === pass — do nothing (placeholder) ===
print("\n=== pass (no-op placeholder) ===")
for i in range(5):
    if i == 3:
        pass               # TODO: handle this case later
    else:
        print(f"  {i}", end=" ")
print()

# pass is also used for empty classes/functions
class NotImplementedYet:
    pass                   # empty class body

def todo_function():
    pass                   # empty function body

# === break in nested loops — only breaks innermost ===
print("\n=== break in nested loops ===")
for i in range(3):
    for j in range(3):
        if j == 2:
            break          # only breaks inner loop
        print(f"  ({i},{j})", end="")
    print()

# === Workaround to break outer loop ===
print("\n=== Break outer loop (flag or function) ===")
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

# === Walrus operator (:=) in while loop ===
# Without walrus — must assign before AND inside the loop:
#   line = f.readline()
#   while line:
#       process(line)
#       line = f.readline()    # duplicate!
#
# With walrus — assign and test in one expression:
#   while (line := f.readline()):
#       process(line)           # no duplication!

print("\n=== Walrus operator (:=) in while loop ===")
import io
reader = io.StringIO("line1\nline2\nline3\n")
while (line := reader.readline()):    # assigns line AND checks if truthy
    print(f"  '{line.strip()}'")

# Walrus in if statement
print("\n=== Walrus in if statement ===")
data = "Hello World"
if (n := len(data)) > 5:             # assigns n AND checks condition
    print(f"  String has {n} chars (> 5)")

# Walrus in list comprehension
print("\n=== Walrus in comprehension ===")
results = [y for x in range(10) if (y := x ** 2) > 20]
print(f"  Squares > 20: {results}")
```

    === break ===
      0   1   2   3   4   Breaking at 5
    
    
    === continue ===
      1   3   5   7   9 
    
    === pass (no-op placeholder) ===
      0   1   2   4 
    
    === break in nested loops ===
      (0,0)  (0,1)
      (1,0)  (1,1)
      (2,0)  (2,1)
    
    === Break outer loop (flag or function) ===
      Broke at (1,1)
      Found: (1, 1)
    
    === Walrus operator (:=) in while loop ===
      'line1'
      'line2'
      'line3'
    
    === Walrus in if statement ===
      String has 11 chars (> 5)
    
    === Walrus in comprehension ===
      Squares > 20: [25, 36, 49, 64, 81]
    

## 4. Iterators & Generators (yield)


```python
# Iterators & Generators — lazy evaluation with yield
#
# KEY CONCEPTS:
# - Generator: a function that uses 'yield' instead of 'return'. Each call to next()
#   resumes execution from where it last yielded, preserving local state.
#   Generators produce values ONE AT A TIME (lazy), not all at once (eager).
# - Lazy evaluation: values are computed only when requested, not upfront.
#   Saves memory for large/infinite sequences. Opposite of eager evaluation (lists).
# - yield: pauses the function, returns a value, and remembers where it stopped.
#   On the next call to next(), execution resumes right after the yield.
# - yield from: delegates iteration to another generator/iterable, forwarding all its values.
# - Generator expression: like a list comprehension but lazy: (x for x in ...) vs [x for x in ...]
# - StopIteration: the exception raised when a generator/iterator is exhausted.
# - Iterator protocol: any object with __iter__() and __next__() methods.
#   for loops call these automatically. Generators implement this protocol implicitly.
# - itertools: standard library module with powerful lazy iterator utilities
#   (chain, cycle, repeat, islice, accumulate, product, permutations, etc.)

# === Generator function (uses yield instead of return) ===
print("=== Generator Function ===")
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

# === Manual iteration with next() ===
print("\n=== Manual next() ===")
gen = countdown(3)
print(f"  next: {next(gen)}")    # 3
print(f"  next: {next(gen)}")    # 2
print(f"  next: {next(gen)}")    # 1
# next(gen) would raise StopIteration

# === Generator expression (like list comprehension, but lazy) ===
print("\n=== Generator Expression ===")
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

# === yield from — delegate to another generator ===
print("\n=== yield from ===")
def flatten(nested):
    for item in nested:
        if isinstance(item, list):
            yield from flatten(item)   # recursively yield from sub-generator
        else:
            yield item

nested = [1, [2, 3], [4, [5, 6]], 7]
print(f"Flatten: {list(flatten(nested))}")

# === Infinite generators ===
print("\n=== Infinite Generator ===")
def naturals(start=0):
    n = start
    while True:          # never ends!
        yield n
        n += 1

# Take first 5 from infinite generator
from itertools import islice
print(f"First 5 naturals: {list(islice(naturals(), 5))}")
print(f"From 10:          {list(islice(naturals(10), 5))}")

# === Common built-in iterators ===
print("\n=== Built-in Iterators ===")
print(f"range(5):       {list(range(5))}")                              # lazy range
print(f"enumerate:      {list(enumerate('abc'))}")                      # index + value
print(f"zip:            {list(zip([1,2], ['a','b']))}")                 # parallel
print(f"map:            {list(map(str.upper, ['a','b']))}")             # apply func to each
print(f"filter:         {list(filter(lambda x: x > 2, [1,2,3,4]))}")    # keep matching
print(f"reversed:       {list(reversed([1,2,3]))}")

# itertools — powerful lazy iterators
from itertools import chain, cycle, repeat, accumulate, product
print(f"chain:          {list(chain([1,2], [3,4]))}")         # concatenate iterables
print(f"repeat:         {list(repeat('x', 3))}")              # repeat value n times
print(f"accumulate:     {list(accumulate([1,2,3,4]))}")       # running sum
print(f"product:        {list(product('ab', '12'))}")         # cartesian product

# === Custom Iterator Protocol ===
# Any class with __iter__() and __next__() can be used in for loops.
print("\n=== Custom Iterator Protocol ===")
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

    === Generator Function ===
      Starting countdown from 5
      5   4   3   2   1   Done!
    
    
    === Manual next() ===
      Starting countdown from 3
      next: 3
      next: 2
      next: 1
    
    === Generator Expression ===
    List: [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
    Generator: <generator object <genexpr> at 0x000002563F062DC0>
    As list:   [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
    
    List size:        800984 bytes
    Generator size:      192 bytes
    
    === yield from ===
    Flatten: [1, 2, 3, 4, 5, 6, 7]
    
    === Infinite Generator ===
    First 5 naturals: [0, 1, 2, 3, 4]
    From 10:          [10, 11, 12, 13, 14]
    
    === Built-in Iterators ===
    range(5):       [0, 1, 2, 3, 4]
    enumerate:      [(0, 'a'), (1, 'b'), (2, 'c')]
    zip:            [(1, 'a'), (2, 'b')]
    map:            ['A', 'B']
    filter:         [3, 4]
    reversed:       [3, 2, 1]
    chain:          [1, 2, 3, 4]
    repeat:         ['x', 'x', 'x']
    accumulate:     [1, 3, 6, 10]
    product:        [('a', '1'), ('a', '2'), ('b', '1'), ('b', '2')]
    
    === Custom Iterator Protocol ===
    Squares(5): [0, 1, 4, 9, 16]
    


```python
# Practical alternatives to manual recursive flatten
# In real code, use libraries instead of writing recursion yourself

nested = [1, [2, 3], [4, [5, 6]], 7]

# === Method 1: itertools.chain — flattens ONE level only ===
from itertools import chain
one_level = list(chain.from_iterable([[1, 2], [3, 4], [5, 6]]))
print(f"chain (1 level):  {one_level}")
# Does NOT work for deep nesting:
# chain.from_iterable([1, [2, [3]]]) → error, because 1 is not iterable

# === Method 2: more-itertools.collapse — flattens ANY depth ===
from more_itertools import collapse
print(f"collapse (deep):  {list(collapse(nested))}")

# === Method 3: simple iterative flatten (no recursion, uses a stack) ===
def flatten_iter(nested):
    """Flatten using an explicit stack — no recursion needed."""
    stack = list(reversed(nested))     # put items on stack (reversed to maintain order)
    result = []
    while stack:
        item = stack.pop()
        if isinstance(item, list):
            stack.extend(reversed(item))  # push sub-items onto stack
        else:
            result.append(item)
    return result

print(f"Iterative flatten: {flatten_iter(nested)}")

# === Method 4: pandas — for JSON-like nested data ===
import pandas as pd
nested_records = [
    {"name": "Alice", "address": {"city": "NYC", "zip": "10001"}},
    {"name": "Bob", "address": {"city": "LA", "zip": "90001"}},
]
df = pd.json_normalize(nested_records)
print(f"\npandas json_normalize:\n{df}")

# === Summary ===
print("\n=== When to use what ===")
print("1 level deep:     list(chain.from_iterable(nested))")
print("Any depth:        list(collapse(nested))  (more-itertools)")
print("No dependencies:  iterative with stack (no recursion needed)")
print("Nested JSON:      pd.json_normalize(records)")
```

    chain (1 level):  [1, 2, 3, 4, 5, 6]
    collapse (deep):  [1, 2, 3, 4, 5, 6, 7]
    Iterative flatten: [1, 2, 3, 4, 5, 6, 7]
    
    pandas json_normalize:
        name address.city address.zip
    0  Alice          NYC       10001
    1    Bob           LA       90001
    
    === When to use what ===
    1 level deep:     list(chain.from_iterable(nested))
    Any depth:        list(collapse(nested))  (more-itertools)
    No dependencies:  iterative with stack (no recursion needed)
    Nested JSON:      pd.json_normalize(records)
    

## 5. Comprehensions & Functional Tools


```python
# Comprehensions — concise way to create collections from loops
#
# KEY CONCEPTS:
# - Comprehension: a compact syntax to build a new collection by transforming/filtering
#   an existing iterable in a single expression. Syntax: [expr for item in iterable if cond]
#   Python has list, dict, set, and generator comprehensions. C# has no equivalent syntax —
#   uses LINQ (.Select(), .Where(), .ToDictionary(), etc.) instead.
# - Lambda: an anonymous (unnamed) function: `lambda x: x * 2` (Python) / `x => x * 2` (C#).
#   Used as throwaway functions passed to map, filter, sorted, etc.
# - map(): applies a function to every element. Same as [f(x) for x in lst] or .Select(f).
# - filter(): keeps only elements where the function returns True. Same as .Where(f).
# - reduce() (fold): accumulates all elements into a single value by applying a function
#   repeatedly: reduce(f, [a,b,c,d]) = f(f(f(a,b),c),d). C# equivalent: .Aggregate().
# - Method chaining: calling multiple methods in sequence on the result of the previous one:
#   lst.Where(...).Select(...).OrderBy(...) — each returns a new lazy sequence.
#   Python doesn't support this natively — must use nested calls or comprehensions.
# - Cartesian product: all possible combinations of elements from two+ sets.
#   [('a','1'), ('a','2'), ('b','1'), ('b','2')] from 'ab' × '12'.

# === List comprehension ===
print("=== List Comprehension ===")
# [expression for item in iterable if condition]
squares = [x**2 for x in range(10)]
print(f"Squares:  {squares}")

evens = [x for x in range(20) if x % 2 == 0]
print(f"Evens:    {evens}")

# With transformation + filter
words = ["hello", "world", "python", "is", "great"]
long_upper = [w.upper() for w in words if len(w) > 3]
print(f"Long upper: {long_upper}")

# Nested comprehension (flatten)
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
flat = [n for row in matrix for n in row]    # read left-to-right: for row, then for n
print(f"Flat:     {flat}")

# Nested comprehension (create 2D)
grid = [[(i, j) for j in range(3)] for i in range(3)]
print(f"Grid:     {grid}")

# === Dict comprehension ===
print("\n=== Dict Comprehension ===")
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

# === Set comprehension ===
print("\n=== Set Comprehension ===")
# {expression for item in iterable} — duplicates automatically removed
unique_lengths = {len(w) for w in words}
print(f"Unique lengths: {unique_lengths}")

# === Functional tools: map, filter, reduce ===
print("\n=== map() — apply function to each element ===")
nums = [1, 2, 3, 4, 5]
doubled = list(map(lambda x: x * 2, nums))    # lambda = anonymous function
print(f"Doubled: {doubled}")
# Comprehension equivalent (preferred in Python):
doubled2 = [x * 2 for x in nums]
print(f"Same:    {doubled2}")

print("\n=== filter() — keep elements matching condition ===")
evens = list(filter(lambda x: x % 2 == 0, nums))
print(f"Evens:   {evens}")
# Comprehension equivalent (preferred in Python):
evens2 = [x for x in nums if x % 2 == 0]
print(f"Same:    {evens2}")

print("\n=== reduce() — accumulate to single value ===")
from functools import reduce
total = reduce(lambda acc, x: acc + x, nums, 0)   # 0 is the initial accumulator
print(f"Sum:     {total}")
product = reduce(lambda acc, x: acc * x, nums, 1)
print(f"Product: {product}")
# Built-in alternatives (preferred over reduce for common cases):
print(f"sum():   {sum(nums)}")
print(f"max():   {max(nums)}")
print(f"min():   {min(nums)}")
print(f"all():   {all(x > 0 for x in nums)}")    # True if ALL match
print(f"any():   {any(x > 3 for x in nums)}")    # True if ANY match

# === sorted() with key ===
# key: a function that extracts the comparison value from each element
print("\n=== sorted() ===")
names = ["Charlie", "Alice", "Bob", "Diana"]
print(f"Alphabetical:  {sorted(names)}")
print(f"By length:     {sorted(names, key=len)}")
print(f"Reverse:       {sorted(names, reverse=True)}")
print(f"By last char:  {sorted(names, key=lambda n: n[-1])}")

# === When to use comprehension vs loop ===
print("\n=== Guidelines ===")
print("Use comprehension: simple transform/filter → new collection")
print("Use for loop:      side effects, complex logic, multiple statements")
print("Use map/filter:    when you already have a named function")
print("Avoid:             nested comprehensions with >2 levels (use loops)")
```

    === List Comprehension ===
    Squares:  [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
    Evens:    [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]
    Long upper: ['HELLO', 'WORLD', 'PYTHON', 'GREAT']
    Flat:     [1, 2, 3, 4, 5, 6, 7, 8, 9]
    Grid:     [[(0, 0), (0, 1), (0, 2)], [(1, 0), (1, 1), (1, 2)], [(2, 0), (2, 1), (2, 2)]]
    
    === Dict Comprehension ===
    Squares dict: {0: 0, 1: 1, 2: 4, 3: 9, 4: 16, 5: 25}
    Swapped:      {1: 'a', 2: 'b', 3: 'c'}
    Passed:       {'Alice': 85, 'Bob': 92, 'Diana': 95}
    
    === Set Comprehension ===
    Unique lengths: {2, 5, 6}
    
    === map() — apply function to each element ===
    Doubled: [2, 4, 6, 8, 10]
    Same:    [2, 4, 6, 8, 10]
    
    === filter() — keep elements matching condition ===
    Evens:   [2, 4]
    Same:    [2, 4]
    
    === reduce() — accumulate to single value ===
    Sum:     15
    Product: 120
    sum():   15
    max():   5
    min():   1
    all():   True
    any():   True
    
    === sorted() ===
    Alphabetical:  ['Alice', 'Bob', 'Charlie', 'Diana']
    By length:     ['Bob', 'Alice', 'Diana', 'Charlie']
    Reverse:       ['Diana', 'Charlie', 'Bob', 'Alice']
    By last char:  ['Diana', 'Bob', 'Charlie', 'Alice']
    
    === Guidelines ===
    Use comprehension: simple transform/filter → new collection
    Use for loop:      side effects, complex logic, multiple statements
    Use map/filter:    when you already have a named function
    Avoid:             nested comprehensions with >2 levels (use loops)
    
