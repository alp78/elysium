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

#### if / elif / else — indentation-based branching

```python
# if / elif / else — indentation-scoped conditional branching
#
# Technique: Python uses indentation (not braces) to define blocks.
#   Conditions don't need parentheses. elif chains for multiple tiers.
#   Truthy/falsy means any value can be a condition directly.
#
# Benefits:
#   - No braces or parentheses — clean, readable structure
#   - elif is one keyword (not else if) — fewer nesting levels
#   - Truthy/falsy enables concise conditions: if items: instead of if len(items) > 0
#
# Anti-patterns:
#   - Deep if/elif nesting — extract to functions or use match/case
#   - Redundant else after return — if cond: return x; return y is cleaner
#   - Mixing tabs and spaces — causes IndentationError
#
# When to use:
#   - 2-3 branches with conditions involving comparisons or boolean logic
#
# When NOT to use:
#   - Many discrete value matches — use match/case (Python 3.10+)

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

#### Ternary expression

```python
# Ternary expression — value_if_true if condition else value_if_false
#
# Technique: Inline conditional reads left-to-right like English:
#   "adult if age >= 18 else minor". Can nest but readability drops fast.
#
# Benefits:
#   - Single expression — can assign, return, or pass as argument
#   - Reads like natural English — more intuitive than C's ? :
#
# Anti-patterns:
#   - Nested ternaries beyond 2 levels — use if/elif/else or dict mapping
#   - Side effects in ternary branches — use full if/else
#
# When to use:
#   - Simple conditional assignment: label = "pos" if x > 0 else "neg"
#
# When NOT to use:
#   - Complex conditions — use if/elif/else block

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
# Truthy/falsy — empty collections, 0, None, "" are falsy
#
# Technique: if items: is True for non-empty collections. 0, 0.0, "",
#   None, [], {}, set() are falsy — everything else is truthy.
#   Chained comparisons: 0 < x < 100 evaluates x only once.
#
# Benefits:
#   - if items: is more Pythonic than if len(items) > 0
#   - Chained comparisons are concise: 10 < x < 20
#   - and/or return operands: name = user or "Anonymous"
#
# Anti-patterns:
#   - if x == True — just use if x
#   - Truthy check when 0 or "" is valid data — be explicit
#
# When to use:
#   - Emptiness checks, None checks, range validation
#
# When NOT to use:
#   - When falsy values (0, "") are legitimate data

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
# match/case — structural pattern matching (Python 3.10+)
#
# Technique: match value: / case pattern: tests against patterns, not
#   just equality. Supports | for OR, _ for wildcard, guards with if,
#   and variable binding. First match wins.
#
# Benefits:
#   - More expressive than if/elif — matches structure, types, values
#   - Wildcard _ is the default/catch-all — clear intent
#   - Guards (if condition) add arbitrary filters per case
#
# Anti-patterns:
#   - Bare variable names capture (not compare) — use literals or guards
#   - match for simple value checks — if/elif is sufficient
#   - Forgetting _ default — unmatched values silently pass through
#
# When to use:
#   - Command dispatch, protocol parsing, type-based branching
#
# When NOT to use:
#   - Simple 2-3 value checks — if/elif is clearer

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
# match with destructuring — bind variables from tuple/list/dict shapes
#
# Technique: case (x, 0) binds x from a 2-tuple where second is 0.
#   case {"key": val} matches dict structure. Patterns are tested
#   top-down — first match wins.
#
# Benefits:
#   - Combines structure validation and value extraction in one step
#   - No separate unpacking — pattern does it inline
#   - Reads declaratively — the shape IS the condition
#
# Anti-patterns:
#   - Overly complex patterns — extract to helper functions
#   - Catch-all (x, y) before specific patterns — shadows them
#
# When to use:
#   - Coordinate processing, API responses, AST walking
#
# When NOT to use:
#   - Simple value matching — case "a": works without destructuring

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
# match with type checking — case int(n), case str(s)
#
# Technique: case int(n) matches integers and binds to n. Combine with
#   guards: case int(n) if n > 0. Replaces isinstance() chains with
#   clean pattern syntax.
#
# Benefits:
#   - Type check + variable bind in one step
#   - Guards add arbitrary conditions per type branch
#   - Cleaner than if/elif with isinstance()
#
# Anti-patterns:
#   - Catch-all case _ before specific types — unreachable
#   - match for single type check — isinstance() is simpler
#
# When to use:
#   - Heterogeneous data (JSON values, mixed-type collections)
#
# When NOT to use:
#   - Homogeneous collections — no type dispatch needed

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

```python
# for and while loops — Python's two loop constructs
#
# Technique: for iterates over any iterable (list, range, dict, generator).
#   while repeats until condition is false. Python has no C-style
#   for(i=0; i<n; i++) — use for i in range(n) instead.
#
# Benefits:
#   - for works on any iterable — no index management needed
#   - range() generates integers lazily — memory efficient for large ranges
#   - for/else runs else block only if no break occurred — useful for search
#
# Anti-patterns:
#   - for i in range(len(items)) — use for item in items or enumerate()
#   - while True without break — infinite loop; always have an exit condition
#   - Modifying a list during iteration — use a copy or list comprehension
#
# When to use:
#   - for for definite iteration; while for condition-based loops
#
# When NOT to use:
#   - Simple transforms — use list comprehension or map() instead

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
# range() — lazy integer sequence with start, stop, step
#
# Technique: range(stop), range(start, stop), range(start, stop, step).
#   Stop is exclusive. Negative step for countdown. range is lazy —
#   constant memory regardless of size.
#
# Benefits:
#   - Memory efficient — range(1_000_000) uses constant memory
#   - O(1) membership: 500 in range(1000) is instant
#   - Negative step: range(10, 0, -2) = 10, 8, 6, 4, 2
#
# Anti-patterns:
#   - list(range(n)) when only iteration is needed — wastes memory
#   - range(len(items)) to iterate — use enumerate() or direct iteration
#
# When to use:
#   - Index-based loops, numeric sequences, counting
#
# When NOT to use:
#   - Iterating collections — for item in items is more Pythonic

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
# Iterating strings and dicts — characters and key-value pairs
#
# Technique: Strings yield characters one at a time. Dicts yield keys
#   by default; .items() for (key, value), .values() for values.
#   Unpacking: for k, v in dict.items().
#
# Benefits:
#   - Strings are iterable — no indexing needed for character processing
#   - .items() returns views — no copy, reflects changes
#   - Unpacking makes key-value iteration clean
#
# Anti-patterns:
#   - for key in dict: then dict[key] — use for k, v in dict.items()
#   - Modifying dict during iteration — RuntimeError
#
# When to use:
#   - Character processing, dict traversal, config parsing
#
# When NOT to use:
#   - When only keys or values needed — use .keys() or .values()

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
# enumerate and zip — indexed iteration and parallel pairing
#
# Technique: enumerate(iterable, start=0) yields (index, element).
#   zip(a, b) yields (a_i, b_i), stopping at shortest. Both are lazy.
#
# Benefits:
#   - enumerate replaces manual counter variables
#   - zip enables lockstep iteration of parallel sequences
#   - Both generate pairs on demand — memory efficient
#
# Anti-patterns:
#   - range(len(items)) for indexed iteration — enumerate is cleaner
#   - zip with unequal lengths silently truncates — use zip_longest
#
# When to use:
#   - enumerate for indexed iteration; zip for parallel sequences
#
# When NOT to use:
#   - When index isn't needed — direct iteration is cleaner

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
# while and for/else — condition loops and search pattern
#
# Technique: while repeats until condition is false. for/else runs the
#   else block only if the loop completed WITHOUT break — Python's
#   built-in "search found/not found" idiom.
#
# Benefits:
#   - for/else eliminates boolean flag variables for search loops
#   - while is right when iteration count is unknown
#
# Anti-patterns:
#   - for/else when any() or in check suffices
#   - Forgetting else runs when there's NO break — counterintuitive name
#
# When to use:
#   - for/else for search with "not found" handling
#   - while for polling, retry, input validation
#
# When NOT to use:
#   - for/else for non-search patterns — confuses readers

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
# do-while workaround and nested loops
#
# Technique: while True: body; if cond: break guarantees at least one
#   execution. Nested loops iterate all combinations (Cartesian product).
#
# Benefits:
#   - while True + break is clean substitute for do-while
#   - Nested loops straightforward for multi-dimensional iteration
#
# Anti-patterns:
#   - while True without break — infinite loop
#   - Deep nesting (>3 levels) — extract inner loops to functions
#
# When to use:
#   - Menus, input validation, retry that must run at least once
#
# When NOT to use:
#   - itertools.product() is cleaner for Cartesian products

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

```python
# break, continue, pass — loop control statements
#
# Technique: break exits the innermost loop immediately. continue skips
#   to the next iteration. pass is a no-op placeholder for empty blocks.
#   None of these affect outer loops — Python has no labeled break.
#
# Benefits:
#   - break enables early exit — avoids processing remaining elements
#   - continue skips unwanted items without deep nesting
#   - pass satisfies syntax requirements for empty blocks
#
# Anti-patterns:
#   - break/continue in deeply nested code — hard to follow flow
#   - Using pass when ... (ellipsis) is more conventional for stubs
#   - continue when inverting the condition is clearer
#
# When to use:
#   - break: search found, error, limit reached
#   - continue: skip invalid items, filter during iteration
#   - pass: placeholder for future code, empty except blocks
#
# When NOT to use:
#   - Complex flow — extract to a function with return instead

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
# continue and pass — skip current iteration or do nothing
#
# Technique: continue jumps to next iteration, skipping remaining body.
#   pass does nothing — placeholder for empty blocks (empty class,
#   empty except, stub function).
#
# Benefits:
#   - continue avoids nested if/else for filtering during iteration
#   - pass enables syntactically valid empty blocks
#
# Anti-patterns:
#   - pass in production except blocks — at minimum log the error
#   - continue where a comprehension with if would be cleaner
#
# When to use:
#   - continue to skip items; pass for stubs and empty handlers
#
# When NOT to use:
#   - When the condition can be expressed as a comprehension filter

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
# break only exits the innermost loop
#
# Technique: In nested loops, break affects only the loop it's in.
#   Outer loops continue normally. Python has no labeled break —
#   use flags, functions, or exceptions for multi-level exit.
#
# Benefits:
#   - Predictable — break always affects exactly one loop level
#
# Anti-patterns:
#   - Assuming break exits all nested loops — it only exits one
#   - Deep nesting needing multi-level break — refactor to function
#
# When to use:
#   - Exiting inner search while outer loop continues
#
# When NOT to use:
#   - Multi-level break — use function + return instead

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
# Breaking outer loops — flag or extract-to-function
#
# Technique: Flag: set found = True + break inner, check flag + break
#   outer. Function: extract nested loops, use return. Function is
#   cleaner and more Pythonic.
#
# Benefits:
#   - Function extraction is cleanest — return exits all loops
#   - Flag works without restructuring code
#
# Anti-patterns:
#   - Multiple boolean flags — hard to follow
#   - Exceptions for flow control — StopIteration abuse
#
# When to use:
#   - Function extraction when search logic is reusable
#   - Flag when extraction is overkill
#
# When NOT to use:
#   - Simple searches — use any() or comprehension instead

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
# Walrus operator := — assign and test in one expression
#
# Technique: (var := expr) assigns and returns the value. Eliminates
#   the "read-before-loop" duplication: while (line := f.readline()):
#   replaces separate initial read + loop read.
#
# Benefits:
#   - Eliminates duplicate code in read-process-read loops
#   - Works in comprehensions: [y for x in data if (y := f(x)) > 0]
#
# Anti-patterns:
#   - Overusing := — simple assignments are clearer with =
#   - Forgetting parentheses — a := b is syntax error without (a := b)
#
# When to use:
#   - while loops reading input; comprehensions reusing computed values
#
# When NOT to use:
#   - Simple assignments — x = value is clearer

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

```python
# Generator functions — yield produces values lazily on demand
#
# Technique: A function with yield becomes a generator. Each next() call
#   resumes execution until the next yield. State is preserved between
#   calls. The generator is exhausted when the function returns.
#
# Benefits:
#   - Memory efficient — values computed one at a time, not stored
#   - Composable — chain with for loops, LINQ-like operations, itertools
#   - Infinite sequences are possible — caller controls consumption
#
# Anti-patterns:
#   - Returning a list when yield would be lazier and more memory-efficient
#   - Calling list() on a generator just to iterate — defeats lazy evaluation
#   - Forgetting generators are single-use — exhausted after one pass
#
# When to use:
#   - Large/infinite sequences, pipelines, streaming data processing
#
# When NOT to use:
#   - When all values are needed at once — return a list directly
#   - When random access is needed — generators only support forward iteration

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
# Manual iteration with next() — advance a generator one step
#
# Technique: next(gen) returns the next yielded value. Raises
#   StopIteration when exhausted. next(gen, default) returns default
#   instead. Useful for peeking or partial consumption.
#
# Benefits:
#   - Fine-grained control — consume exactly n values
#   - next(gen, None) avoids try/except for optional values
#
# Anti-patterns:
#   - Catching StopIteration in a loop — use for loop instead
#   - next() after exhaustion without default — raises unexpectedly
#
# When to use:
#   - Peeking at first element, partial consumption, interleaved reading
#
# When NOT to use:
#   - Full iteration — for loop handles StopIteration automatically

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
# List vs generator expression — eager vs lazy evaluation
#
# Technique: [expr for x in iter] creates list in memory (eager).
#   (expr for x in iter) creates generator (lazy, on-demand).
#   Generator as function arg: sum(x**2 for x in range(n)).
#
# Benefits:
#   - Generator: constant memory for large sequences
#   - List: supports indexing, len(), multiple iteration
#
# Anti-patterns:
#   - list(generator) just to iterate once — defeats lazy benefit
#   - Generator when len() or indexing is needed — use list
#
# When to use:
#   - Generator for large/streaming data; list for small or reusable
#
# When NOT to use:
#   - Generator when full list is needed for multiple passes

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

<h4><code style="font-size:0.75em">yield from</code></h4>

```python
# yield from — delegate to a sub-generator or iterable
#
# Technique: yield from iterable replaces for item in iterable: yield item.
#   Enables recursive generators (flatten) and delegation to sub-generators.
#   Handles send(), throw(), close() correctly on sub-generators.
#
# Benefits:
#   - One line instead of explicit for + yield loop
#   - Natural recursive traversal of tree structures
#
# Anti-patterns:
#   - yield from on strings — each char yields separately
#   - Deep recursion — may hit recursion limit
#
# When to use:
#   - Recursive flattening, delegating to sub-generators
#
# When NOT to use:
#   - Simple iteration — for loop is more explicit

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
# Infinite generator — while True + yield for unbounded sequences
#
# Technique: while True with yield produces infinite values. Callers
#   control with islice, Take patterns, or zip. iter() wraps
#   callable + sentinel into an iterator.
#
# Benefits:
#   - Zero storage — values computed on demand
#   - islice safely limits: islice(naturals(), 5)
#   - Composable with all iteration tools
#
# Anti-patterns:
#   - list() on infinite generator — hangs or OOM
#   - len() on infinite generator — never returns
#   - for loop without break — infinite loop
#
# When to use:
#   - Fibonacci, primes, sensor streams, paginated APIs
#
# When NOT to use:
#   - Known total count — use range() or finite generator

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

<h4><code style="font-size:0.75em">itertools</code></h4>

```python
# itertools — standard library for combinatorial and infinite iterators
#
# Technique: chain joins iterables end-to-end. cycle repeats infinitely.
#   repeat yields same value n times. accumulate computes running totals.
#   product gives Cartesian product. All are lazy generators.
#
# Benefits:
#   - Memory efficient — all are lazy generators
#   - Composable — chain itertools for complex pipelines
#   - Batteries included — no external library
#
# Anti-patterns:
#   - Re-implementing itertools logic manually — use the stdlib
#   - list(cycle(...)) — infinite, will OOM
#
# When to use:
#   - Combining iterables, Cartesian products, running totals
#
# When NOT to use:
#   - Simple cases where a list comprehension is clearer

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
# Iterator protocol — __iter__ and __next__ for custom iterables
#
# Technique: Define __iter__(self) returning self, __next__(self) raising
#   StopIteration when done. Makes any class usable in for loops,
#   list(), and all iteration contexts.
#
# Benefits:
#   - Full control over iteration state and logic
#   - Integrates with all Python iteration tools
#   - Can maintain complex state that generators can't express
#
# Anti-patterns:
#   - Iterator protocol when generator function is simpler
#   - Forgetting StopIteration — infinite iteration
#
# When to use:
#   - Complex stateful iteration, external resource cursors
#
# When NOT to use:
#   - Simple sequences — generator functions are much less code

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

#### Practical flatten alternatives

```python
# Practical flatten alternatives — choose by depth and dependencies
#
# Technique: Preview of library-based flatten options before demonstrating
#   each: chain.from_iterable (1 level), more_itertools.collapse (deep),
#   custom stack-based (no deps), pd.json_normalize (dicts).
#
# Benefits:
#   - Real code uses libraries instead of handwritten recursion
#   - Each approach suits a different nesting depth
#
# Anti-patterns:
#   - Writing recursive flatten when a library handles it
#   - Using the most complex approach for simple one-level flattening
#
# When to use:
#   - Choosing the right flatten strategy for your data
#
# When NOT to use:
#   - N/A — this is a setup cell for the comparison

nested = [1, [2, 3], [4, [5, 6]], 7]
```

#### Flatten alternatives

```python
# chain.from_iterable — flatten exactly one level of nesting
#
# Technique: Takes an iterable of iterables, yields elements from each
#   sub-iterable in order. Only one level — inner lists stay nested.
#
# Benefits:
#   - Stdlib — no external dependency
#   - Lazy — processes one element at a time
#   - Cleaner than nested list comprehension
#
# Anti-patterns:
#   - Expecting deep flatten — only goes one level
#   - Mixed types — non-iterable elements raise TypeError
#
# When to use:
#   - List-of-lists where inner elements are not nested further
#
# When NOT to use:
#   - Arbitrary depth — use more_itertools.collapse or stack-based

one_level = list(chain.from_iterable([[1, 2], [3, 4], [5, 6]]))
print(f"chain (1 level):  {one_level}")

print(f"collapse (deep):  {list(collapse(nested))}")
```

    chain (1 level):  [1, 2, 3, 4, 5, 6]
    collapse (deep):  [1, 2, 3, 4, 5, 6, 7]

#### Iterative Flatten with Stack

```python
# Iterative flatten with stack — no recursion depth limits
#
# Technique: Push nested structures onto a list used as stack. Pop and
#   process: if list, extend stack with reversed contents; if leaf, add
#   to result. No recursion — handles any depth safely.
#
# Benefits:
#   - No RecursionError — handles arbitrarily deep nesting
#   - Constant call stack usage
#
# Anti-patterns:
#   - Not checking for strings — strings are iterable, cause infinite loop
#   - Recursive flatten on untrusted input — may hit recursion limit
#
# When to use:
#   - Deeply nested data from untrusted sources
#
# When NOT to use:
#   - Shallow known nesting — chain.from_iterable is simpler

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
# pd.json_normalize — flatten nested dicts into a DataFrame
#
# Technique: Takes a list of nested dicts, flattens nested keys into
#   dot-separated column names. Handles missing keys with NaN.
#
# Benefits:
#   - One-line flatten for JSON/API response data
#   - Produces DataFrame ready for analysis or CSV export
#   - Handles missing keys gracefully
#
# Anti-patterns:
#   - json_normalize for simple flat dicts — pd.DataFrame is enough
#   - Deeply nested arrays — need record_path parameter
#
# When to use:
#   - API responses, JSON files, nested dict records
#
# When NOT to use:
#   - Non-dict data — use chain or recursive flatten

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

```python
# Flatten summary — decision guide by depth and data type
#
# Technique: Quick reference: 1-level → chain.from_iterable; any-depth →
#   collapse; stack-based → no deps; dicts → json_normalize.
#
# Benefits:
#   - Decision guide for selecting the right flatten tool
#
# Anti-patterns:
#   - Most complex approach for simple one-level flattening
#
# When to use:
#   - Quick lookup when deciding how to flatten data
#
# When NOT to use:
#   - N/A — this is a reference summary

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

#### List comprehension — concise collection building

```python
# List comprehension — [expr for item in iterable if condition]
#
# Technique: Builds a new list by applying an expression to each element,
#   optionally filtering with if. Replaces the map+filter+lambda pattern
#   with more readable syntax. Can nest for multiple iterables.
#
# Benefits:
#   - More readable than map/filter/lambda for most cases
#   - Faster than equivalent for loop — optimized at bytecode level
#   - Supports multiple for clauses and conditions
#
# Anti-patterns:
#   - Comprehensions with side effects — use a for loop instead
#   - Deeply nested comprehensions (>2 levels) — unreadable
#   - Using comprehension just to call a function — use for loop
#
# When to use:
#   - Creating new lists from existing data with transform/filter
#
# When NOT to use:
#   - Side effects (printing, writing, appending to external list)
#   - Complex logic — use a regular for loop for clarity

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
# Nested comprehension — flatten and Cartesian product
#
# Technique: [expr for outer in iter1 for inner in iter2] iterates
#   outer then inner — same order as nested for loops. Use for
#   flattening (one expression) or Cartesian products.
#
# Benefits:
#   - One-line flatten: [n for row in matrix for n in row]
#   - Reads left-to-right matching nested for loop order
#
# Anti-patterns:
#   - More than 2 nesting levels — extract to function or itertools
#   - Confusing read order — outer loop first, then inner
#
# When to use:
#   - Flattening 2D lists, Cartesian products, grid generation
#
# When NOT to use:
#   - Deep nesting (>2) — use itertools.product or helpers

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

```python
# Dict and set comprehensions — {key: val} and {val} syntax
#
# Technique: {k: v for item in iterable} builds a dict. {expr for item}
#   builds a set. Both support if filtering. Dict comprehension can
#   invert: {v: k for k, v in d.items()}.
#
# Benefits:
#   - Concise creation of dicts and sets from any iterable
#   - Key-value swap in one line
#   - Set comprehension auto-deduplicates
#
# Anti-patterns:
#   - Dict with duplicate keys — last value wins silently
#   - Set on unhashable elements — TypeError
#
# When to use:
#   - Lookup dicts, inverting mappings, deduplication with transform
#
# When NOT to use:
#   - dict(zip(keys, values)) may be clearer for simple cases

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
# map and filter — functional-style transformation and selection
#
# Technique: map(func, iterable) applies func to every element.
#   filter(pred, iterable) keeps elements where pred is True.
#   Both return lazy iterators. Lambda provides inline functions.
#
# Benefits:
#   - Lazy evaluation — one element at a time
#   - Named functions make map/filter self-documenting
#
# Anti-patterns:
#   - map/filter with lambda when comprehension is clearer
#   - Nested map/filter — comprehensions are more readable
#
# When to use:
#   - With named functions: map(str.upper, words), filter(None, items)
#
# When NOT to use:
#   - With lambdas — list comprehension is almost always clearer

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
# reduce and built-in aggregations — fold into a single value
#
# Technique: reduce(func, iterable, initial) applies func cumulatively.
#   Built-ins sum(), min(), max(), any(), all() are preferred for common
#   cases — faster C code, more readable.
#
# Benefits:
#   - Built-in aggregations are optimized and short-circuit (any/all)
#   - reduce handles arbitrary binary operations
#
# Anti-patterns:
#   - reduce for sum/product — use sum() or math.prod()
#   - reduce with complex lambda — extract to named function
#
# When to use:
#   - sum/min/max/any/all for common; reduce for custom reductions
#
# When NOT to use:
#   - reduce when a for loop is clearer — readability first

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
# Sorting with key functions — sorted() and list.sort()
#
# Technique: sorted(iterable, key=func) returns new sorted list.
#   list.sort() sorts in place. key extracts comparison value:
#   key=len, key=str.lower, key=lambda x: x[1]. Stable sort.
#
# Benefits:
#   - key avoids custom __lt__ — works with any data
#   - Stable sort — equal elements keep original order
#   - reverse=True for descending without negating key
#
# Anti-patterns:
#   - Defining __lt__ just for one sort — use key function
#   - sorted() when in-place suffices — unnecessary copy
#   - Multiple keys with nested lambdas — use tuple key
#
# When to use:
#   - Custom ordering: by length, by field, case-insensitive, multi-key
#
# When NOT to use:
#   - Default order — sorted(items) needs no key

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

#### Control flow and comprehension summary

```python
# Summary — choosing the right iteration construct
#
# Technique: Quick reference: comprehension for new collections,
#   for loop for side effects, map/filter with named functions,
#   generators for lazy pipelines.
#
# Benefits:
#   - Decision guide for selecting the right pattern
#
# Anti-patterns:
#   - Comprehensions with side effects — use for loop
#   - for loops that build a list — use comprehension
#
# When to use:
#   - Quick lookup when deciding which construct to use
#
# When NOT to use:
#   - N/A — this is a reference summary

print("Use comprehension: simple transform/filter → new collection")
print("Use for loop:      side effects, complex logic, multiple statements")
print("Use map/filter:    when you already have a named function")
print("Avoid:             nested comprehensions with >2 levels (use loops)")
```

    Use comprehension: simple transform/filter → new collection
    Use for loop:      side effects, complex logic, multiple statements
    Use map/filter:    when you already have a named function
    Avoid:             nested comprehensions with >2 levels (use loops)
