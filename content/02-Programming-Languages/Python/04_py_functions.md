---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [lambda, closures, decorators, delegates, higher-order functions, generators, iterators]
keywords: [def, lambda, closure, decorator, args, kwargs, type hints, functools, scope, LEGB]
description: "Python functions reference with executable examples and cell outputs — covers function basics, parameters, lambda, closures, decorators, and type hints. See [[04_cs_functions]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[04_cs_functions]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 04. Functions - Python

## Function Basics

#### Basic functions

> [!warning] Function basics — def, return, parameters, and docstrings
> Function basics — def, return, parameters, and docstrings
>
> Technique: Define with def name(params): body. Return value with return.
>   Functions without return implicitly return None. Docstrings (triple-quoted
>   first line) provide built-in documentation via help().
>
> Benefits:
>   - First-class objects — assign to variables, pass as arguments, return
>   - Dynamic typing — no type declarations required (add hints optionally)
>   - Docstrings integrate with help(), IDEs, and documentation generators
>
> Anti-patterns:
>   - Very long parameter lists — use **kwargs or a config object
>   - Functions doing too much — single responsibility principle
>   - Missing docstrings on public functions — undocumented API
>
> When to use:
>   - Every named piece of reusable logic
>
> When NOT to use:
>   - Trivial one-liners used once — use a lambda or inline code
>
> Function Basics
>
> KEY CONCEPTS:
> - Function: a reusable block of code. Defined with 'def' in Python.
> - Parameters: variables in the function definition (the template).
> - Arguments: actual values passed when calling the function.
> - Return value: what the function sends back. Returns None if no return statement.
> - Docstring: a triple-quoted string at the top of the function body that documents it.
>   Accessible via func.__doc__.
> - First-class functions: functions are objects — you can assign them to variables,
>   pass them as arguments, return them from other functions, store in lists.

```python
from datetime import datetime, timezone
from functools import reduce
from typing import Optional, Callable
import functools, time
import re
def greet(name):
    """Return a greeting message."""
    return f"Hello, {name}!"

print(greet("Alice"))
print(greet("Bob"))
```

    Hello, Alice!
    Hello, Bob!

#### Void equivalent — implicit None return

> [!warning] Implicit None return — functions without return return None
> Implicit None return — functions without return return None
>
> Technique: A function with no return (or bare return) returns None.
>   Python's equivalent of C#'s void. result = print_greeting() is None.
>
> Benefits:
>   - No separate void keyword — return type is always implicit
>   - Consistent — even "void" functions return a value (None)
>
> Anti-patterns:
>   - Assigning result of None-returning function — likely a bug
>   - Mixing return None and return value in same function
>
> When to use:
>   - Side-effect functions: print, log, write, mutate
>
> When NOT to use:
>   - When callers expect a value — always return explicitly

```python
def print_greeting(name):
    print(f"Hi, {name}!")

result = print_greeting("Charlie")
print(f"Return value: {result}")       # None
```

    Hi, Charlie!
    Return value: None

#### Tuple return and unpacking

> [!warning] Parameters — default values, named, *args, **kwargs
> Parameters — default values, named, *args, **kwargs
>
> Technique: Default: def f(x=10). Named: f(x=5). *args collects extra
>   positional as tuple. **kwargs collects extra keyword as dict.
>   Order: pos, *args, kw-only, **kwargs.
>
> Benefits:
>   - Defaults eliminate overloads for optional parameters
>   - Named args: connect(port=8080) is self-documenting
>   - *args/**kwargs enable fully flexible APIs
>
> Anti-patterns:
>   - Mutable defaults: def f(lst=[]) — shared across calls
>   - Too many defaulted params — use a config dict or dataclass
>
> When to use:
>   - Optional config, wrapper functions, decorator internals
>
> When NOT to use:
>   - All params required — explicit params are clearer

```python
def greet(name, greeting="Hello"):
    return f"{greeting}, {name}!"

print(greet("Alice"))                          # positional, default greeting
print(greet("Bob", "Hi"))                      # both positional
print(greet(greeting="Yo", name="Diana"))      # both keyword (any order)
```

    Hello, Alice!
    Hi, Bob!
    Yo, Diana!

#### First-class functions

> [!warning] First-class functions — assign, pass, return functions
> First-class functions — assign, pass, return functions
>
> Technique: Functions are objects — assign to variables, pass as arguments,
>   store in lists. Higher-order functions accept or return functions.
>
> Benefits:
>   - Strategy pattern — swap behavior by passing different functions
>   - Callback pattern — caller defines what happens
>   - Composition — build complex from simple functions
>
> Anti-patterns:
>   - Wrapping a function just to pass it — pass directly
>   - Using strings of function names — pass the object itself
>
> When to use:
>   - Callbacks, strategy, LINQ-style pipelines, map/filter
>
> When NOT to use:
>   - Direct call is simpler — don't abstract for abstraction's sake

```python
say_hello = greet                      # assign to variable
print(say_hello("Diana"))

def apply(func, value):                # pass as argument
    return func(value)
print(apply(greet, "Eve"))
```

    Hello, Diana!
    Hello, Eve!

#### Return a function from a function

> [!warning] Return a function — closure captures enclosing scope
> Return a function — closure captures enclosing scope
>
> Technique: Inner function captures variables from enclosing function.
>   make_multiplier(3) returns a function that multiplies by 3.
>   Each call creates independent state.
>
> Benefits:
>   - Factory pattern — create configured functions on demand
>   - Encapsulated state — no external variables needed
>   - Lightweight — no class definition required
>
> Anti-patterns:
>   - Complex closures with many captured vars — use a class
>   - Mutating captured variables without nonlocal — creates local shadow
>
> When to use:
>   - Factory functions, parameterized callbacks, partial application
>
> When NOT to use:
>   - Complex state — class with methods is more maintainable

```python
def make_multiplier(n):
    def multiplier(x):
        return x * n
    return multiplier

double = make_multiplier(2)
triple = make_multiplier(3)
print(f"double(5) = {double(5)}")
print(f"triple(5) = {triple(5)}")

# __doc__ — the docstring is accessible as an attribute
print(f"greet.__doc__: {greet.__doc__}")
```

    double(5) = 10
    triple(5) = 15
    greet.__doc__: None

#### Callbacks — onSuccess / onError

> [!warning] Callbacks — pass functions for success/error handling
> Callbacks — pass functions for success/error handling
>
> Technique: Accept on_success and on_error as callable parameters.
>   Caller defines response. Decouples operation from handling.
>
> Benefits:
>   - Caller controls response — logging, UI, retry, ignore
>   - Decouples operation from side effects — testable
>
> Anti-patterns:
>   - Not checking if callback is None — TypeError on None()
>   - Too many callbacks — use an event system or observer
>
> When to use:
>   - Async completion, event-driven processing, plugin hooks
>
> When NOT to use:
>   - Simple return values — just return directly

```python
def fetch_data(url, on_success, on_error):
    try:
        result = f"data from {url}"   # simulate fetch
        on_success(result)
    except Exception as e:
        on_error(e)

fetch_data("api/users",
    on_success=lambda data: print(f"  Got: {data}"),
    on_error=lambda err: print(f"  Error: {err}"))
```

      Got: data from api/users

#### Strategy pattern — swap behavior via functions

> [!warning] Strategy pattern — swap behavior by passing different functions
> Strategy pattern — swap behavior by passing different functions
>
> Technique: Define interchangeable functions (full_price, discount_20).
>   Pass desired one to consuming function. Change behavior without
>   modifying code — open/closed principle.
>
> Benefits:
>   - Add strategies without modifying consumers
>   - Runtime flexibility — select from config, user input
>   - Testable — inject mock strategies
>
> Anti-patterns:
>   - if/elif chains to select behavior — use a dict of strategies
>   - Complex strategies as lambdas — extract to named functions
>
> When to use:
>   - Pricing rules, validation, sorting strategies, formatters
>
> When NOT to use:
>   - Single fixed behavior — direct call is simpler

```python
full_price = lambda price: price
discount_20 = lambda price: price * 0.8
member_discount = lambda price: price * 0.7

def calculate(price, strategy):
    return strategy(price)

print(f"  Full:     ${calculate(100, full_price):.2f}")
print(f"  20% off:  ${calculate(100, discount_20):.2f}")
print(f"  Member:   ${calculate(100, member_discount):.2f}")
```

      Full:     $100.00
      20% off:  $80.00
      Member:   $70.00

<h4>Pipeline — chained steps with <code style="font-size:0.75em">reduce</code></h4>

> [!warning] Pipeline — chain function steps with functools.reduce
> Pipeline — chain function steps with functools.reduce
>
> Technique: Store steps as a list of functions. reduce applies them
>   sequentially — each receives previous step's output.
>
> Benefits:
>   - Steps composable — add, remove, reorder independently
>   - reduce folds through the pipeline in one line
>   - Each step independently testable
>
> Anti-patterns:
>   - Mutating shared state between steps — keep pure
>   - Too many steps — break into named sub-pipelines
>
> When to use:
>   - Text processing, data transformation, middleware
>
> When NOT to use:
>   - Steps with side effects — use sequential calls

```python
steps = [
    str.strip,                         # remove leading/trailing whitespace
    str.lower,                         # convert to lowercase
    lambda s: re.sub(r'\s+', ' ', s),  # collapse multiple spaces
]

raw = "   Hello   WORLD   "
result = reduce(lambda s, fn: fn(s), steps, raw)
print(f"  Pipeline: '{raw}' → '{result}'")
```

      Pipeline: '   Hello   WORLD   ' → 'hello world'

#### Dependency injection — inject fake time for testing

> [!warning] Dependency injection — inject fake time for testability
> Dependency injection — inject fake time for testability
>
> Technique: Accept get_now callable with default None (uses real time).
>   Tests inject lambda returning fixed datetime. Makes time-dependent
>   code deterministic.
>
> Benefits:
>   - Testable — fixed time for reproducible results
>   - Default None means production callers unchanged
>   - No mocking framework — just a lambda
>
> Anti-patterns:
>   - datetime.now() directly — untestable
>   - Monkeypatching datetime in tests — fragile
>
> When to use:
>   - Code depending on datetime, random, or external state
>
> When NOT to use:
>   - Complex dependencies — use a DI framework

```python
def process_order(order, get_now=None):
    if get_now is None:
        get_now = lambda: datetime.now(timezone.utc)   # default: real time (UTC)
    order["processed_at"] = get_now()
    return order

# Production
order1 = process_order({"id": 1})
print(f"  Production: {order1['processed_at']}")

# Test — inject fake time
order2 = process_order({"id": 2}, get_now=lambda: datetime(2024, 1, 1, 12, 0, 0))
print(f"  Test:       {order2['processed_at']}")
```

      Production: 2026-03-25 01:34:08.803144+00:00
      Test:       2024-01-01 12:00:00

#### Progress callback

> [!warning] Progress callback — optional callable for reporting progress
> Progress callback — optional callable for reporting progress
>
> Technique: Class with on_progress attribute. Loader invokes it with
>   (current, total, message). If not set, no reporting.
>
> Benefits:
>   - Caller controls display — print, tqdm, GUI, nothing
>   - Optional — no overhead when not needed
>   - Decouples processing from reporting
>
> Anti-patterns:
>   - Hardcoding print() — not reusable
>   - Calling without checking if set — AttributeError
>
> When to use:
>   - Long-running ops: file processing, batch imports
>
> When NOT to use:
>   - Fast operations where progress adds no value

```python
class DataLoader:
    def __init__(self):
        self.on_progress: Optional[Callable] = None   # callback slot

    def load(self, items):
        for i, item in enumerate(items):
            if self.on_progress:
                self.on_progress(i + 1, len(items), item)

loader = DataLoader()
loader.on_progress = lambda curr, total, item: print(f"  [{curr}/{total}] Loading {item}")
loader.load(["users", "orders", "products"])
```

      [1/3] Loading users
      [2/3] Loading orders
      [3/3] Loading products

<h4>Sorting with <code style="font-size:0.75em">key=</code> function</h4>

> [!warning] Sorting with key= — sorted() and list.sort()
> Sorting with key= — sorted() and list.sort()
>
> Technique: sorted(iterable, key=func) returns new sorted list.
>   key extracts comparison value: key=len, key=lambda x: x["salary"].
>   reverse=True for descending. Stable sort.
>
> Benefits:
>   - key avoids custom __lt__ — works with any data
>   - Stable sort — equal elements keep original order
>   - Composable — chain with groupby, filter
>
> Anti-patterns:
>   - __lt__ just for one sort — use key function
>   - sorted() when in-place suffices — unnecessary copy
>
> When to use:
>   - Custom ordering: by length, by field, case-insensitive
>
> When NOT to use:
>   - Default order — sorted(items) needs no key

```python
employees = [
    {"name": "Alice", "dept": "Engineering", "salary": 95000},
    {"name": "Bob", "dept": "Sales", "salary": 65000},
    {"name": "Charlie", "dept": "Engineering", "salary": 110000},
]
by_salary = sorted(employees, key=lambda e: e["salary"], reverse=True)
for e in by_salary:
    print(f"  {e['name']:<10} ${e['salary']:>7,}")
```

      Charlie    $110,000
      Alice      $ 95,000
      Bob        $ 65,000

#### Summary — common function-passing patterns

> [!warning]- Summary — common function-passing patterns
> Summary — common function-passing patterns
>
> Technique: Reference of patterns: callbacks, strategy, pipeline,
>   dependency injection, progress hooks, sorting keys.
>
> Benefits:
>   - Quick lookup for the right function-passing pattern
>
> Anti-patterns:
>   - Wrong pattern for the use case
>
> When to use:
>   - Designing APIs that accept callables
>
> When NOT to use:
>   - N/A — reference summary
>
> Callbacks:    on_success, on_error, on_progress hooks
> Strategy:     swap algorithms without changing code
> Pipeline:     chain processing steps in a list
> DI/Testing:   inject fake dependencies for testing
> Events:       notify subscribers when something happens
>

    Callbacks:    on_success, on_error, on_progress hooks
    Strategy:     swap algorithms without changing code
    Pipeline:     chain processing steps in a list
    DI/Testing:   inject fake dependencies for testing
    Events:       notify subscribers when something happens

## Parameters

#### Mutable default trap

> [!warning] Mutable default trap — default lists/dicts are shared across calls
> Mutable default trap — default lists/dicts are shared across calls
>
> Technique: def f(lst=[]) creates ONE list at definition time — all calls
>   share it. Fix: use None as default, create inside: if lst is None: lst = [].
>   This is Python's most common gotcha for new developers.
>
> Benefits:
>   - Understanding this prevents a subtle and common bug
>   - None sentinel pattern is the standard fix
>
> Anti-patterns:
>   - Mutable default arguments: def f(lst=[], d={}) — shared state
>   - Using is None check only for lists — same issue with dicts, sets
>
> When to use:
>   - Always use None + create inside for mutable default parameters
>
> When NOT to use:
>   - Immutable defaults (int, str, tuple, None) are safe — no fix needed

```python
def bad_append(item, lst=[]):         # BAD: shared across calls
    lst.append(item)
    return lst
print(bad_append(1))                  # [1]
print(bad_append(2))                  # [1, 2] — surprise!

def good_append(item, lst=None):      # GOOD: create new each time
    if lst is None:
        lst = []
    lst.append(item)
    return lst
print(good_append(1))                 # [1]
print(good_append(2))                 # [2]
```

    [1]
    [1, 2]
    [1]
    [2]

<h4><code style="font-size:0.75em">**kwargs</code> — variable keyword arguments</h4>

> [!warning] **kwargs — collect extra keyword arguments into a dict
> **kwargs — collect extra keyword arguments into a dict
>
> Technique: **kwargs collects unmatched keyword args as dict.
>   **dict unpacks at call site. Perfect for decorators and
>   flexible APIs.
>
> Benefits:
>   - Forward unknown kwargs to wrapped functions
>   - Flexible configuration — callers pass any key-value pairs
>   - **dict unpacking: func(**config)
>
> Anti-patterns:
>   - **kwargs when explicit params give better IDE support
>   - Not documenting accepted kwargs — undiscoverable
>
> When to use:
>   - Decorators, wrapper functions, config builders
>
> When NOT to use:
>   - Known parameter names — explicit params give type safety

```python
def build_profile(**kwargs):
    print(f"  kwargs = {kwargs}  (type: {type(kwargs).__name__})")
    return kwargs
print(build_profile(name="Alice", age=30))

data = {"host": "localhost", "port": 5432}
def connect(host, port=5432):
    return f"{host}:{port}"
print(f"connect(**dict): {connect(**data)}")
```

      kwargs = {'name': 'Alice', 'age': 30}  (type: dict)
    {'name': 'Alice', 'age': 30}
    connect(**dict): localhost:5432

<h4>Combined <code style="font-size:0.75em">*args</code>/<code style="font-size:0.75em">**kwargs</code> and positional/keyword-only</h4>

> [!warning] Combined *args/**kwargs and positional/keyword-only
> Combined *args/**kwargs and positional/keyword-only
>
> Technique: Order: required, *args, keyword-only, **kwargs.
>   After * are keyword-only. Full control over how callers pass args.
>
> Benefits:
>   - keyword-only prevents positional misuse
>   - *args/**kwargs forward all arguments to wrapped functions
>
> Anti-patterns:
>   - Too many parameter categories — confusing signature
>   - *args/**kwargs when explicit params suffice
>
> When to use:
>   - Decorator wrappers, flexible APIs, CLI handling
>
> When NOT to use:
>   - Simple functions — explicit named params are clearer

```python
def kitchen_sink(required, *args, keyword_only="default", **kwargs):
    print(f"  required: {required}")
    print(f"  *args:    {args}")
    print(f"  kw_only:  {keyword_only}")
    print(f"  **kwargs: {kwargs}")
kitchen_sink("a", "b", "c", keyword_only="custom", x=1, y=2)
```

      required: a
      *args:    ('b', 'c')
      kw_only:  custom
      **kwargs: {'x': 1, 'y': 2}

#### Positional-only (/) and keyword-only (*) parameters

> [!warning] Positional-only (/) and keyword-only (*) fence markers
> Positional-only (/) and keyword-only (*) fence markers
>
> Technique: Before / = positional-only. After * = keyword-only.
>   Gives API authors control over calling conventions.
>
> Benefits:
>   - Positional-only allows renaming params without breaking callers
>   - Keyword-only prevents misuse of config-like params
>   - Matches built-in signatures: len(obj, /)
>
> Anti-patterns:
>   - / and * together with unclear intent — document the design
>   - Overusing positional-only — most functions benefit from named args
>
> When to use:
>   - Library APIs where param names are implementation details
>
> When NOT to use:
>   - Internal functions — explicit named params are fine

```python
def func(pos_only, /, normal, *, kw_only):
    return f"{pos_only}, {normal}, {kw_only}"
print(func(1, 2, kw_only=3))
print(func(1, normal=2, kw_only=3))
# func(pos_only=1, ...)  # Error! pos_only is positional-only
# func(1, 2, 3)          # Error! kw_only must be keyword
```

    1, 2, 3
    1, 2, 3

## Lambda Expressions

#### Lambda basics

> [!warning] Lambda — single-expression anonymous function
> Lambda — single-expression anonymous function
>
> Technique: lambda params: expression creates an anonymous function.
>   Limited to one expression — no statements, no assignments (except :=).
>   Prefer def for anything more complex than a simple transform.
>
> Benefits:
>   - Inline — no separate def needed for throwaway logic
>   - Works with sorted(), map(), filter() as key/transform functions
>   - Concise for simple operations: lambda x: x * 2
>
> Anti-patterns:
>   - Assigning lambda to a variable — use def instead (has a name, docstring)
>   - Complex lambdas — unreadable; extract to a named function
>   - Lambda with side effects — use def for clarity
>
> When to use:
>   - Short throwaway functions as arguments: sorted(data, key=lambda x: x[1])
>
> When NOT to use:
>   - Named reusable functions — use def
>   - Multi-line logic — lambda only supports one expression

```python
add = lambda a, b: a + b              # same as: def add(a, b): return a + b
print(f"lambda add: {add(3, 4)}")
```

    lambda add: 7

<h4>Lambdas with <code style="font-size:0.75em">sorted</code>, <code style="font-size:0.75em">map</code>, <code style="font-size:0.75em">filter</code></h4>

> [!warning] Lambdas with sorted, map, filter — inline throwaway functions
> Lambdas with sorted, map, filter — inline throwaway functions
>
> Technique: sorted(key=lambda), map(lambda, iter), filter(lambda, iter).
>   Comprehensions are often more Pythonic for the same job.
>
> Benefits:
>   - Concise for simple transforms with named functions
>   - map/filter are lazy — generate on demand
>
> Anti-patterns:
>   - map/filter with lambda when comprehension is clearer
>   - Nested chains — comprehensions are more readable
>
> When to use:
>   - Named functions: map(str.upper, words), filter(None, items)
>
> When NOT to use:
>   - Lambdas — comprehension is almost always clearer

```python
names = ["Charlie", "Alice", "Bob", "Diana"]
print(f"By length:    {sorted(names, key=lambda n: len(n))}")
print(f"By last char: {sorted(names, key=lambda n: n[-1])}")

nums = [1, 2, 3, 4, 5]
print(f"Squared: {list(map(lambda x: x**2, nums))}")
print(f"Evens:   {list(filter(lambda x: x % 2 == 0, nums))}")
```

    By length:    ['Bob', 'Alice', 'Diana', 'Charlie']
    By last char: ['Diana', 'Bob', 'Charlie', 'Alice']
    Squared: [1, 4, 9, 16, 25]
    Evens:   [2, 4]

#### Closures and variable scope — LEGB rule

> [!warning] Closures and scope — LEGB rule (Local, Enclosing, Global, Built-in)
> Closures and scope — LEGB rule (Local, Enclosing, Global, Built-in)
>
> Technique: Python resolves names L→E→G→B. Closures capture enclosing
>   scope vars. nonlocal modifies enclosing; global modifies module-level.
>
> Benefits:
>   - LEGB is predictable — always same search order
>   - Closures enable factory functions and stateful callbacks
>   - nonlocal makes mutation explicit
>
> Anti-patterns:
>   - Modifying enclosing without nonlocal — creates local shadow
>   - global — couples function to module state; pass params instead
>
> When to use:
>   - Factory functions, decorators, counter closures
>
> When NOT to use:
>   - Complex state — use a class instead

```python
x = "global"
def outer():
    x = "enclosing"
    def inner():
        x = "local"
        print(f"  inner: {x}")
    inner()
    print(f"  outer: {x}")
outer()
print(f"  global: {x}")
```

      inner: local
      outer: enclosing
      global: global

## Closures & Scope

<h4>Closures and <code style="font-size:0.75em">nonlocal</code></h4>

> [!warning] Closure with nonlocal — mutable state in enclosing scope
> Closure with nonlocal — mutable state in enclosing scope
>
> Technique: nonlocal count allows the inner function to modify count
>   from the enclosing scope. Without nonlocal, assignment creates a
>   local variable that shadows the outer one.
>
> Benefits:
>   - Simple counter factory — no class needed for basic state
>   - Each make_counter() call creates independent state
>   - nonlocal makes mutation explicit — clear intent
>
> Anti-patterns:
>   - Forgetting nonlocal — creates a local shadow, UnboundLocalError
>   - Complex state with multiple nonlocal vars — use a class
>
> When to use:
>   - Simple counters, accumulators, toggle state in callbacks
>
> When NOT to use:
>   - Complex state with multiple variables — use a class

```python
def make_counter(start=0):
    count = start
    def increment():
        nonlocal count
        count += 1
        return count
    return increment

counter = make_counter(10)
print(f"counter(): {counter()}")    # 11
print(f"counter(): {counter()}")    # 12

counter2 = make_counter(0)          # independent closure
print(f"counter2(): {counter2()}")  # 1
```

    counter(): 11
    counter(): 12
    counter2(): 1

<h4><code style="font-size:0.75em">global</code> keyword</h4>

> [!warning] Decorators — wrap functions with additional behavior
> Decorators — wrap functions with additional behavior
>
> Technique: Decorator takes a function, returns a modified version.
>   @decorator applies at definition time. functools.wraps preserves
>   original name and docstring.
>
> Benefits:
>   - Cross-cutting: timing, logging, retry, caching, auth
>   - Clean separation from business logic
>   - @functools.wraps preserves __name__, __doc__
>
> Anti-patterns:
>   - Forgetting @functools.wraps — breaks help() and debugging
>   - Side effects at import time — surprising
>   - Too many stacked (>3) — hard to debug order
>
> When to use:
>   - Timing, logging, retry, caching, authentication
>
> When NOT to use:
>   - Simple function call is clearer — don't over-abstract

```python
def timer(func):                          # Step 1: receives original function
    @functools.wraps(func)                # preserves func.__name__ and __doc__ on wrapper
    def wrapper(*args, **kwargs):         # Step 2: replacement function (accepts any arguments)
        start = time.perf_counter()       # 2a. BEFORE: start timer
        result = func(*args, **kwargs)    # 2b. CALL: run the original function
        elapsed = time.perf_counter() - start  # 2c. AFTER: measure time
        print(f"  {func.__name__} took {elapsed:.6f}s")
        return result                     # 2d. return original's result to caller
    return wrapper                        # Step 3: return the wrapper (replaces original)

@timer
def slow_sum(n):
    """Sum numbers from 0 to n."""
    return sum(range(n))

result = slow_sum(1_000_000)
print(f"  Result: {result}")
print(f"  Name: {slow_sum.__name__}")     # 'slow_sum' (preserved by wraps)
```

      slow_sum took 0.016651s
      Result: 499999500000
      Name: slow_sum

#### Loop capture gotcha

> [!warning] Loop capture gotcha — all lambdas share the loop variable
> Loop capture gotcha — all lambdas share the loop variable
>
> Technique: Lambdas in a loop capture the variable itself. After the
>   loop, all see final value. Fix: default arg i=i captures current.
>
> Benefits:
>   - Understanding prevents common subtle bug
>   - Default arg (i=i) is the standard fix
>
> Anti-patterns:
>   - Assuming each iteration captures own value — it doesn't
>   - Captured loop vars in callbacks — delayed eval sees final
>
> When to use:
>   - Always apply default arg fix for closures in loops
>
> When NOT to use:
>   - When loop variable is intentionally shared (rare)

```python
funcs_bad = [lambda: i for i in range(3)]
print(f"Bad:  {[f() for f in funcs_bad]}")     # [2, 2, 2] — all see final i!

funcs_good = [lambda i=i: i for i in range(3)] # fix: capture value via default arg
print(f"Good: {[f() for f in funcs_good]}")    # [0, 1, 2]
```

    Bad:  [2, 2, 2]
    Good: [0, 1, 2]

#### *args — variable positional arguments as tuple

> [!warning] *args — collect extra positional arguments into a tuple
> *args — collect extra positional arguments into a tuple
>
> Technique: *args collects unmatched positional args as tuple.
>   *list at call site unpacks. Common in wrappers and decorators.
>
> Benefits:
>   - Flexible — any number of positional arguments
>   - Tuple is immutable — safe from modification
>   - *unpacking forwards args to wrapped functions
>
> Anti-patterns:
>   - *args when explicit params give better IDE support
>   - Treating args as list — it's a tuple
>
> When to use:
>   - Wrapper functions, decorators, variadic utilities
>
> When NOT to use:
>   - Known parameter names — explicit params are clearer

```python
def total(*args):
    print(f"  args = {args}  (type: {type(args).__name__})")
    return sum(args)
print(f"total(1,2,3): {total(1, 2, 3)}")

numbers = [1, 2, 3, 4, 5]
print(f"total(*list): {total(*numbers)}")      # unpack list into args
```

      args = (1, 2, 3)  (type: tuple)
    total(1,2,3): 6
      args = (1, 2, 3, 4, 5)  (type: tuple)
    total(*list): 15

## Decorators

#### Decorator with arguments — retry

> [!warning] Decorator with arguments — extra wrapper layer returns the decorator
> Decorator with arguments — extra wrapper layer returns the decorator
>
> Technique: @retry(max_attempts=3) requires three nested functions:
>   retry(args) returns decorator(func) which returns wrapper(*args).
>   The outer function captures decorator arguments; inner wraps the target.
>
> Benefits:
>   - Configurable decoration — @retry(3), @cache(ttl=60)
>   - Each decorated function gets its own configuration
>
> Anti-patterns:
>   - Forgetting the extra nesting level — decorator won't receive func
>   - Not using @functools.wraps — loses original function metadata
>
> When to use:
>   - Configurable retry, caching with TTL, rate limiting with params
>
> When NOT to use:
>   - No-argument decorators — use the simpler two-level pattern

```python
def retry(max_attempts=3):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts:
                        raise
                    print(f"  Attempt {attempt} failed: {e}, retrying...")
        return wrapper
    return decorator

@retry(max_attempts=3)
def unreliable():
    import random
    if random.random() < 0.7:
        raise ValueError("bad luck")
    return "success"

try:
    print(f"  Result: {unreliable()}")
except ValueError as e:
    print(f"  Final failure: {e}")
```

      Attempt 1 failed: bad luck, retrying...
      Attempt 2 failed: bad luck, retrying...
      Final failure: bad luck

#### Stacking decorators

> [!warning] Stacking decorators — applied bottom-up, each wraps the previous
> Stacking decorators — applied bottom-up, each wraps the previous
>
> Technique: @a @b @c def f(): means f = a(b(c(f))). Bottom first.
>   Each receives result of the one below. Order matters.
>
> Benefits:
>   - Composable — combine logging, timing, validation
>   - Each decorator independently testable
>
> Anti-patterns:
>   - Order-dependent decorators without docs — confusing
>   - Too many stacked (>3) — hard to debug
>
> When to use:
>   - Combining cross-cutting concerns: @log @time @validate
>
> When NOT to use:
>   - Single decorator handles multiple concerns

```python
def add(a: int, b: int) -> int:
    return a + b

print(f"add(3, 4):     {add(3, 4)}")
print(f"add('a', 'b'): {add('a', 'b')}")   # works! Python doesn't enforce  # type: ignore
```

    add(3, 4):     7
    add('a', 'b'): ab

<h4>Built-in decorators — <code style="font-size:0.75em">@property</code>, <code style="font-size:0.75em">@staticmethod</code>, <code style="font-size:0.75em">@classmethod</code></h4>

> [!warning] Built-in decorators — @property, @staticmethod, @classmethod
> Built-in decorators — @property, @staticmethod, @classmethod
>
> Technique: @property makes method act like attribute. @staticmethod
>   no self. @classmethod receives cls for factory methods.
>
> Benefits:
>   - @property: computed attributes with attribute syntax
>   - @classmethod: factory methods, inheritance-safe
>   - @staticmethod: class-namespaced utilities
>
> Anti-patterns:
>   - @property with expensive computation — cache or use method
>   - @staticmethod when module-level function is clearer
>
> When to use:
>   - @property for computed attrs; @classmethod for factories
>
> When NOT to use:
>   - @property for simple attribute access — just use the attribute

```python
class MyClass:
    def __init__(self, value):
        self.value = value

    @property              # access like attribute, not method call
    def doubled(self):
        return self.value * 2

    @staticmethod          # no self — standalone function in class namespace
    def utility():
        return "No instance needed"

    @classmethod           # receives class, not instance
    def from_string(cls, s):
        return cls(int(s))

obj = MyClass(21)
print(f"@property:     {obj.doubled}")            # 42 (no parentheses!)
print(f"@staticmethod: {MyClass.utility()}")
print(f"@classmethod:  {MyClass.from_string('99').value}")
```

    @property:     42
    @staticmethod: No instance needed
    @classmethod:  99

#### Closure as validator factory

> [!warning] Closure as validator factory — captures min/max for reuse
> Closure as validator factory — captures min/max for reuse
>
> Technique: make_validator(min, max) returns function testing [min, max].
>   Each call creates independent validator with own captured bounds.
>
> Benefits:
>   - Reusable — create validators for different ranges
>   - Composable — combine with filter(), any(), all()
>   - Lightweight — no class needed
>
> Anti-patterns:
>   - Hardcoding ranges — factory is more flexible
>
> When to use:
>   - Parameterized validation, configurable filters
>
> When NOT to use:
>   - Complex validation — use a class or pydantic

```python
def make_validator(min_val, max_val):
    def validate(value):
        return min_val <= value <= max_val
    return validate

is_valid_age = make_validator(0, 120)
is_valid_score = make_validator(0, 100)
print(f"age 25:  {is_valid_age(25)}")
print(f"age 150: {is_valid_age(150)}")
```

    age 25:  True
    age 150: False

## Type Hints

<h4>Complex type hints and <code style="font-size:0.75em">Optional</code></h4>

> [!warning] Complex type hints — generics, unions, and Optional for signatures
> Complex type hints — generics, unions, and Optional for signatures
>
> Technique: Combine types: list[int], dict[str, Any], str | None.
>   Optional[str] is shorthand for str | None. Callable[[int], str]
>   declares function signatures. TypeVar for generic functions.
>
> Benefits:
>   - IDE autocompletion and type checking with mypy/pyright
>   - Self-documenting — signature shows expected types
>   - Catches type errors before runtime via static analysis
>
> Anti-patterns:
>   - Using Any everywhere — defeats the purpose of type hints
>   - Over-complicated generics — keep hints readable
>   - Runtime enforcement — hints are not checked at runtime by default
>
> When to use:
>   - Public APIs, library interfaces, complex function signatures
>
> When NOT to use:
>   - Quick scripts — overhead outweighs benefit for throwaway code

```python
def process(
    name: str,
    age: int,
    score: float,
    active: bool = True,
    tags: list[str] | None = None,     # Python 3.10+ syntax
) -> dict[str, object]:
    return {"name": name, "age": age, "score": score, "active": active, "tags": tags or []}

print(process("Alice", 30, 85.5, tags=["admin"]))
```

    {'name': 'Alice', 'age': 30, 'score': 85.5, 'active': True, 'tags': ['admin']}

#### Optional return — str | None for nullable results

> [!warning] Optional return — str | None for functions that may return None
> Optional return — str | None for functions that may return None
>
> Technique: -> Optional[str] (or -> str | None in 3.10+) declares
>   nullable return. Callers should check before using.
>
> Benefits:
>   - Documents nullable return — callers know to check
>   - mypy/pyright flag unguarded access
>   - Cleaner than sentinel values
>
> Anti-patterns:
>   - Returning None without hint — callers don't know to check
>   - Optional for params — use =None default instead
>
> When to use:
>   - Lookups that may fail, search, optional config
>
> When NOT to use:
>   - When raising an exception is more appropriate

```python
def find_user(user_id: int) -> Optional[str]:   # same as str | None
    users = {1: "Alice", 2: "Bob"}
    return users.get(user_id)

print(f"find_user(1): {find_user(1)}")
print(f"find_user(9): {find_user(9)}")
```

    find_user(1): Alice
    find_user(9): None

<h4><code style="font-size:0.75em">Callable</code> type hints</h4>

> [!warning] Callable type hints — declare function parameter signatures
> Callable type hints — declare function parameter signatures
>
> Technique: Callable[[param_types], return_type] declares a function
>   parameter. Callable[[int, int], str] = takes two ints, returns str.
>
> Benefits:
>   - Documents callback signatures — callers know what to pass
>   - mypy checks passed functions match the signature
>   - IDE autocomplete inside the callback
>
> Anti-patterns:
>   - Callable without param types — loses type safety
>   - Over-specifying internal callbacks
>
> When to use:
>   - Public APIs accepting callbacks, strategy functions
>
> When NOT to use:
>   - Internal functions where type is obvious

```python
def apply_func(func: Callable[[int], int], value: int) -> int:
    # func must be a function that takes an int and returns an int
    return func(value)

# same as the non-hinted version
def apply_func_nohint(func, value):
    return func(value)

print(f"apply: {apply_func(lambda x: x * 2, 5)}")
print(f"apply_nohint: {apply_func_nohint(lambda x: x * 2, 5)}")
```

    apply: 10
    apply_nohint: 10

#### Type aliases and introspection

> [!warning] Type aliases and __annotations__ — named types and introspection
> Type aliases and __annotations__ — named types and introspection
>
> Technique: TypeAlias = complex_type gives readable names.
>   __annotations__ dict stores hints for runtime introspection.
>   get_type_hints() resolves forward references.
>
> Benefits:
>   - Aliases reduce repetition: UserMap = dict[int, str]
>   - __annotations__ enables runtime validation (pydantic)
>   - Readable signatures: def get_users() -> UserMap
>
> Anti-patterns:
>   - Too many aliases — harder to navigate than inline types
>   - Runtime type checking via __annotations__ without framework
>
> When to use:
>   - Complex types in multiple signatures; framework introspection
>
> When NOT to use:
>   - Simple types — int, str, list[str] are clear without aliases

```python
UserId = int
UserName = str
UserMap = dict[UserId, UserName]

def get_users() -> UserMap:
    return {1: "Alice", 2: "Bob"}
print(f"get_users(): {get_users()}")

print(f"add:     {add.__annotations__}")
print(f"process: {process.__annotations__}")
```

    get_users(): {1: 'Alice', 2: 'Bob'}
    add:     {'a': <class 'int'>, 'b': <class 'int'>, 'return': <class 'int'>}
    process: {'name': <class 'str'>, 'age': <class 'int'>, 'score': <class 'float'>, 'active': <class 'bool'>, 'tags': list[str] | None, 'return': dict[str, object]}
