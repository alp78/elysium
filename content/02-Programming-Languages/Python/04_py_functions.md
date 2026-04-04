---
tags: [python]
aliases: [lambda, closures, decorators, delegates, higher-order functions, generators, iterators]
description: "Python functions reference with executable examples and cell outputs — covers function basics, parameters, lambda, closures, decorators, and type hints. See [04_cs_functions](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/04_cs_functions) for the C# equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 04. Functions - Python

> [!quote]
> "The purpose of abstraction is not to be vague, but to create a new semantic level in which one can be absolutely precise."
>
> — **Edsger W. Dijkstra**, *The Humble Programmer*, ACM Turing lecture (1972)

## Function Basics

#### def, return, docstrings — basic function definition

> [!info] Function basics
>
> - `def name(params): body` — defines a function
> - `return` — returns a value; without it, functions implicitly return `None`
> - Docstrings (triple-quoted first line) — built-in documentation via `help()`
> - Functions are first-class objects: assign to variables, pass as arguments, return from other functions

> [!warning] Function anti-patterns
>
> - Very long parameter lists — use `**kwargs` or a config object
> - Functions doing too much — single responsibility principle
> - Missing docstrings on public functions — undocumented API

> [!success] Correct pattern
>
> Keep functions focused on one task. For many parameters, pass a dataclass or dict: `def process(config: Config):`. Add a docstring to every public function: `"""Returns a greeting message."""`. Aim for functions that fit on one screen.

```python
from datetime import datetime, timezone
from functools import reduce
from typing import Optional, Callable
import functools, time
import re
def greet(name):
    """Return a greeting message."""
    return f"Hello, {name}!"

greet("Alice")
greet("Bob")
```

    Hello, Alice!
    Hello, Bob!

#### Void equivalent — implicit None return

A function with no `return` (or bare `return`) returns `None` — Python's equivalent of C#'s `void`. Use for side-effect functions (print, log, write, mutate).

> [!warning] None-returning function pitfalls
>
> Don't assign the result of a `None`-returning function — it's likely a bug. Don't mix `return None` and `return value` in the same function.

> [!success] Correct pattern
>
> If a function mutates state or has side effects, don't `return` a value — callers shouldn't assign it. If a function can return a value or nothing, use `Optional[T]` and be explicit: `return None` at the end. Keep all return paths consistent.

```python
def print_greeting(name):
    print(f"Hi, {name}!")

result = print_greeting("Charlie")
result  # None
```

    Hi, Charlie!
    None

#### Default parameters, *args, **kwargs — tuple return and unpacking

> [!info] Parameters and arguments
>
> - Default parameters: `def f(x=10)`
> - Named arguments: `f(x=5)` — self-documenting
> - `*args` — collects extra positional arguments as a tuple
> - `**kwargs` — collects extra keyword arguments as a dict
> - Order: positional, `*args`, keyword-only, `**kwargs`

> [!warning] Parameter pitfalls
>
> - **Mutable defaults:** `def f(lst=[])` shares the list across all calls — use `lst=None` instead
> - Too many defaulted params — use a config dict or dataclass

> [!success] Correct pattern
>
> Use the `None` sentinel: `def f(lst=None): if lst is None: lst = []`. For functions with many options, group them: `def run(config: dict):` or use a `@dataclass` config object. Immutable defaults (`int`, `str`, `tuple`) are always safe.

```python
def greet(name, greeting="Hello"):
    return f"{greeting}, {name}!"

greet("Alice")                          # positional, default greeting
greet("Bob", "Hi")                      # both positional
greet(greeting="Yo", name="Diana")      # both keyword (any order)
```

    Hello, Alice!
    Hi, Bob!
    Yo, Diana!

#### First-class functions

Functions are objects — assign to variables, pass as arguments, store in lists. Higher-order functions accept or return functions. Use for callbacks, strategy pattern, composition, and `map`/`filter` pipelines.

```python
say_hello = greet                      # assign to variable
say_hello("Diana")

def apply(func, value):                # pass as argument
    return func(value)
apply(greet, "Eve")
```

    Hello, Diana!
    Hello, Eve!

#### Closures — return a function from a function

A closure is a function that remembers variables from its enclosing scope even after that scope has finished executing. The inner function "closes over" the outer variables. Closures are how decorators and factory functions work.

Inner functions capture variables from the enclosing scope. `make_multiplier(3)` returns a function that multiplies by 3 — each call creates independent state. Use for factory functions, parameterized callbacks, and partial application. For complex state, prefer a class.

> [!warning] Don't mutate captured variables without nonlocal
>
> Don't mutate captured variables without `nonlocal` — Python creates a local shadow instead.

> [!success] Correct pattern
>
> Declare `nonlocal var` before assigning to an enclosing-scope variable: `nonlocal count; count += 1`. For complex shared state, use a class instead of closures with multiple `nonlocal` declarations.

```python
def make_multiplier(n):
    def multiplier(x):
        return x * n
    return multiplier

double = make_multiplier(2)
triple = make_multiplier(3)
double(5)   # double(5) =
triple(5)   # triple(5) =

# __doc__ — the docstring is accessible as an attribute
greet.__doc__   # greet.__doc__
```

    double(5) = 10
    triple(5) = 15
    None

#### Callbacks — onSuccess / onError

A callback is a function passed as an argument to another function, to be called later when a specific event occurs. In Python, any callable (function, lambda, method) can serve as a callback. The caller decides what happens on success or failure.

Accept `on_success` and `on_error` as callable parameters — the caller defines the response. Decouples operation from side effects, making it testable. Use for async completion, event-driven processing, and plugin hooks.

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

      data from api/users

#### Strategy pattern — swap behavior via functions

The strategy pattern passes different scoring, calculation, or formatting functions as parameters, letting you swap behavior without modifying the consumer. Each strategy function has the same signature but different logic — the caller picks which one to use at runtime.

Define interchangeable functions and pass the desired one to the consumer. Change behavior without modifying code (open/closed principle). Use for pricing rules, validation, sorting strategies, formatters.

```python
full_price = lambda price: price
discount_20 = lambda price: price * 0.8
member_discount = lambda price: price * 0.7

def calculate(price, strategy):
    return strategy(price)

f"{calculate(100, full_price):.2f}"   # Full:     $
f"{calculate(100, discount_20):.2f}"   # 20% off:  $
f"{calculate(100, member_discount):.2f}"   # Member:   $
```

      $100.00
      $80.00
      $70.00

#### Pipeline — chained steps with reduce

A pipeline chains transformation steps where each function's output feeds the next function's input. This pattern decomposes complex transformations into small, testable, reorderable units.

> [!tip] functools.reduce for pipelines
>
> `reduce(lambda data, fn: fn(data), steps, initial)` composes a pipeline from a list of functions. Each step receives the previous step's output — no intermediate variables needed.

Store steps as a list of functions. `reduce` applies them sequentially — each receives the previous step's output. Steps are composable, reorderable, and independently testable.

```python
steps = [
    str.strip,                         # remove leading/trailing whitespace
    str.lower,                         # convert to lowercase
    lambda s: re.sub(r'\s+', ' ', s),  # collapse multiple spaces
]

raw = "   Hello   WORLD   "
result = reduce(lambda s, fn: fn(s), steps, raw)
f"  Pipeline: '{raw}' → '{result}'"
```

      '   Hello   WORLD   ' → 'hello world'

#### Dependency injection — inject fake time for testing

Dependency injection means passing dependencies (like a time source, database connection, or API client) as parameters instead of hardcoding them. This makes the function testable — tests inject fakes or stubs, while production code passes the real implementations. No mocking framework required.

Accept a `get_now` callable with default `None` (uses real time). Tests inject a lambda returning a fixed datetime — makes time-dependent code deterministic. No mocking framework needed.

> [!warning] Avoid datetime.now() in production
>
> Don't call `datetime.now()` directly in production code — it's untestable. Don't monkeypatch `datetime` in tests — it's fragile.

> [!success] Correct pattern
>
> Inject time as a callable: `def process(get_now=None): if get_now is None: get_now = lambda: datetime.now(timezone.utc)`. Tests inject a fixed value: `process(get_now=lambda: datetime(2024, 1, 1))`. This makes time-dependent code fully deterministic and testable.

```python
def process_order(order, get_now=None):
    if get_now is None:
        get_now = lambda: datetime.now(timezone.utc)   # default: real time (UTC)
    order["processed_at"] = get_now()
    return order

# Production
order1 = process_order({"id": 1})
order1['processed_at']   # Production

# Test — inject fake time
order2 = process_order({"id": 2}, get_now=lambda: datetime(2024, 1, 1, 12, 0, 0))
order2['processed_at']   # Test
```

      2026-03-25 01:34:08.803144+00:00
      2024-01-01 12:00:00

#### Progress callback

Class with an `on_progress` attribute. The loader invokes it with `(current, total, message)`. If not set, no reporting — caller controls display (print, tqdm, GUI, nothing). Decouples processing from reporting.

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

#### Sorting with key= function

> [!info] Sorting with key
>
> - `sorted(iterable, key=func)` — returns a new sorted list
> - `key` extracts the comparison value: `key=len`, `key=lambda x: x["salary"]`
> - `reverse=True` for descending
> - Python's sort is stable — equal elements keep original order

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

#### Common function-passing patterns

| Pattern | Use case |
|---|---|
| **Callbacks** | `on_success`, `on_error`, `on_progress` hooks |
| **Strategy** | Swap algorithms without changing calling code |
| **Pipeline** | Chain processing steps in a list |
| **DI / Testing** | Inject fake dependencies for testing |
| **Events** | Notify subscribers when something happens |

## Parameters

#### Mutable default argument trap — def f(lst=[]) pitfall

> [!info] Mutable default trap
>
> - `def f(lst=[])` creates ONE list at definition time — all calls share it
> - Fix: use `None` as default, create inside: `if lst is None: lst = []`
> - Immutable defaults (`int`, `str`, `tuple`) are safe

> [!danger] Mutable default arguments (def f(lst=[],
>
> Mutable default arguments (`def f(lst=[], d={})`) cause shared state across calls. The same issue applies to dicts and sets — always use the `None` sentinel pattern.

> [!success] Correct pattern
>
> Use `None` as the default, then initialize inside the function: `def f(lst=None): if lst is None: lst = []`. This guarantees a fresh object on every call. The same pattern applies to dicts: `def f(d=None): if d is None: d = {}`.

```python
def bad_append(item, lst=[]):         # BAD: shared across calls
    lst.append(item)
    return lst
bad_append(1)                  # [1]
bad_append(2)                  # [1, 2] — surprise!

def good_append(item, lst=None):      # GOOD: create new each time
    if lst is None:
        lst = []
    lst.append(item)
    return lst
good_append(1)                 # [1]
good_append(2)                 # [2]
```

    [1]
    [1, 2]
    [1]
    [2]

#### **kwargs — variable keyword arguments

`**kwargs` collects unmatched keyword arguments as a dict. `**dict` unpacks at the call site (`func(**config)`). Use for decorators, wrapper functions, and config builders. Prefer explicit params when names are known — they give better IDE support and type safety.

```python
def build_profile(**kwargs):
    print(f"  kwargs = {kwargs}  (type: {type(kwargs).__name__})")
    return kwargs
build_profile(name="Alice", age=30)

data = {"host": "localhost", "port": 5432}
def connect(host, port=5432):
    return f"{host}:{port}"
connect(**data)   # connect(**dict)
```

      kwargs = {'name': 'Alice', 'age': 30}  (type: dict)
    {'name': 'Alice', 'age': 30}
    localhost:5432

#### Combined *args/**kwargs and positional/keyword-only

Parameter order: required, `*args`, keyword-only, `**kwargs`. Parameters after `*` are keyword-only — prevents positional misuse. Use for decorator wrappers and flexible APIs.

```python
def kitchen_sink(required, *args, keyword_only="default", **kwargs):
    print(f"  required: {required}")
    print(f"  *args:    {args}")
    print(f"  kw_only:  {keyword_only}")
    print(f"  **kwargs: {kwargs}")
kitchen_sink("a", "b", "c", keyword_only="custom", x=1, y=2)
```

      required: a
      ('b', 'c')
      custom
      **kwargs: {'x': 1, 'y': 2}

#### Positional-only (/) and keyword-only (*) parameters

> [!info] Parameter kinds
>
> - Before `/` = **positional-only** (allows renaming params without breaking callers)
> - After `*` = **keyword-only** (prevents positional misuse)
> - Matches built-in signatures like `len(obj, /)`

```python
def func(pos_only, /, normal, *, kw_only):
    return f"{pos_only}, {normal}, {kw_only}"
func(1, 2, kw_only=3)
func(1, normal=2, kw_only=3)
# func(pos_only=1, ...)  # Error! pos_only is positional-only
# func(1, 2, 3)          # Error! kw_only must be keyword
```

    1, 2, 3
    1, 2, 3

## Lambda Expressions

#### Lambda basics

`lambda params: expression` creates an anonymous function — limited to one expression, no statements. Use for short throwaway functions as arguments: `sorted(data, key=lambda x: x[1])`.

> [!warning] Lambda anti-patterns
>
> - **Assigning lambda to a variable** — use `def` instead (has a name, docstring)
> - **Complex lambdas** — unreadable; extract to a named function
> - **Lambda with side effects** — use `def` for clarity

> [!success] Correct pattern
>
> Use lambdas only as inline arguments: `sorted(data, key=lambda x: x[1])`. For anything more complex, define a named function: `def by_salary(e): return e["salary"]`. Named functions show up in tracebacks and support docstrings.

```python
add = lambda a, b: a + b              # same as: def add(a, b): return a + b
add(3, 4)   # lambda add
```

    7

#### Lambdas with sorted, map, filter

> [!info] Lambdas with built-ins
>
> - `sorted(key=lambda)`, `map(lambda, iter)`, `filter(lambda, iter)`
> - `map`/`filter` are lazy — generate on demand
> - Comprehensions are often more Pythonic: prefer `[x**2 for x in nums]` over `list(map(...))`

```python
names = ["Charlie", "Alice", "Bob", "Diana"]
sorted(names, key=lambda n: len(n))   # By length
sorted(names, key=lambda n: n[-1])   # By last char

nums = [1, 2, 3, 4, 5]
list(map(lambda x: x**2, nums))   # Squared
list(filter(lambda x: x % 2 == 0, nums))   # Evens
```

    ['Bob', 'Alice', 'Diana', 'Charlie']
    ['Diana', 'Bob', 'Charlie', 'Alice']
    [1, 4, 9, 16, 25]
    [2, 4]

#### Closures and variable scope — LEGB rule

Python resolves names in LEGB order: Local → Enclosing → Global → Built-in. Closures capture enclosing scope variables. `nonlocal` modifies enclosing scope; `global` modifies module-level (but prefer passing params instead).

> [!warning] Modifying an enclosing variable without
>
> Modifying an enclosing variable without `nonlocal` creates a local shadow instead of updating the outer variable.

> [!success] Correct pattern
>
> Declare `nonlocal x` at the top of the inner function before any assignment to `x`. Without it, any `x = ...` inside the inner function creates a new local and Python raises `UnboundLocalError` if `x` is read before assignment.

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
x   # global
```

      inner: local
      outer: enclosing
      global: global

## Closures & Scope

#### Closures and nonlocal

`nonlocal count` allows the inner function to modify `count` from the enclosing scope. Without it, assignment creates a local shadow (`UnboundLocalError`). Each `make_counter()` call creates independent state — no class needed for basic counters.

```python
def make_counter(start=0):
    count = start
    def increment():
        nonlocal count
        count += 1
        return count
    return increment

counter = make_counter(10)
counter()  # 11
counter()  # 12

counter2 = make_counter(0)          # independent closure
counter2()  # 1
```

    11
    12
    1

#### global keyword

A decorator wraps a function with additional behavior without modifying its source code. The `@decorator` syntax is syntactic sugar for `func = decorator(func)`. Common uses include logging, timing, retry logic, and authentication checks.

A decorator takes a function and returns a modified version. `@decorator` applies at definition time. `@functools.wraps` preserves the original `__name__` and `__doc__`. Use for cross-cutting concerns: timing, logging, retry, caching, authentication.

> [!warning] Decorator pitfalls
>
> - Forgetting `@functools.wraps` — breaks `help()` and debugging
> - Side effects at import time — surprising behavior
> - Too many stacked decorators (>3) — hard to debug order

> [!success] Correct pattern
>
> Always use `@functools.wraps(func)` on the wrapper to preserve `__name__`, `__doc__`, and `__annotations__`. Keep decorator logic side-effect-free at definition time. If stacking more than 3 decorators, consider combining related concerns into one decorator.

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
result
slow_sum.__name__  # 'slow_sum' (preserved by wraps)
```

      slow_sum took 0.016651s
      499999500000
      Name: slow_sum

#### Lambda loop capture gotcha — closures bind by reference

> [!danger] Lambdas in a loop capture
>
> Lambdas in a loop capture the variable itself — not the value. After the loop, all see the final value. Fix: default argument `i=i` captures the current value.

> [!success] Correct pattern
>
> Capture the current value using a default argument: `lambda i=i: i`. The default is evaluated at definition time, binding the current value of `i` rather than the variable reference. This is the standard Pythonic fix for late-binding closures in loops.

```python
funcs_bad = [lambda: i for i in range(3)]
[f() for f in funcs_bad]  # [2, 2, 2] — all see final i!

funcs_good = [lambda i=i: i for i in range(3)] # fix: capture value via default arg
[f() for f in funcs_good]  # [0, 1, 2]
```

    [2, 2, 2]
    [0, 1, 2]

#### *args — variable positional arguments as tuple

`*args` collects unmatched positional arguments as a tuple. `*list` at the call site unpacks. Common in wrappers and decorators. Prefer explicit params when names are known — they give better IDE support.

```python
def total(*args):
    print(f"  args = {args}  (type: {type(args).__name__})")
    return sum(args)
total(1, 2, 3)   # total(1,2,3)

numbers = [1, 2, 3, 4, 5]
total(*numbers)  # unpack list into args
```

      args = (1, 2, 3)  (type: tuple)
    6
      args = (1, 2, 3, 4, 5)  (type: tuple)
    15

## Decorators

#### Decorator with arguments — retry

`@retry(max_attempts=3)` requires three nested functions: `retry(args)` returns `decorator(func)` which returns `wrapper(*args)`. The outer function captures decorator arguments; the inner wraps the target. Each decorated function gets its own configuration.

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

#### Stacking decorators — execution order and composition

> [!warning] Decorator order matters — decorators are applied bottom-up
>
> `@retry @log def f()` means `f = retry(log(f))`, not `log(retry(f))`. The bottom decorator wraps the function first, and each outer decorator wraps the result. Reversing the order changes behavior — e.g., logging may or may not see retries depending on stack order.

> [!success] Correct pattern
>
> Read decorator stacks bottom-up: the decorator closest to `def` wraps first. Place `@functools.wraps` innermost. To log retries, put `@log` outside `@retry`: `@log @retry def f()` means `f = log(retry(f))` — every retry attempt is visible to the logger.

`@a @b @c def f()` means `f = a(b(c(f)))` — bottom decorator wraps first, each receives the result of the one below. Order matters. Avoid stacking more than 3 decorators.

```python
def add(a: int, b: int) -> int:
    return a + b

add(3, 4)   # add(3, 4)
add('a', 'b')  # works! Python doesn't enforce  # type: ignore
```

    7
    ab

#### Built-in decorators — @property, @staticmethod, @classmethod

> [!info] Built-in decorators
>
> - `@property` — makes a method act like an attribute
> - `@staticmethod` — takes no `self`
> - `@classmethod` — receives `cls`; use for factory methods and inheritance-safe constructors
> - Avoid `@property` for expensive computation — cache it or use a regular method

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
obj.doubled  # 42 (no parentheses!)
MyClass.utility()   # @staticmethod
MyClass.from_string('99').value   # @classmethod
```

    42
    @staticmethod: No instance needed
    99

#### Closure as validator factory

`make_validator(min, max)` returns a function that tests whether a value falls in `[min, max]`. Each call creates an independent validator with its own captured bounds — composable with `filter()`, `any()`, `all()`.

```python
def make_validator(min_val, max_val):
    def validate(value):
        return min_val <= value <= max_val
    return validate

is_valid_age = make_validator(0, 120)
is_valid_score = make_validator(0, 100)
is_valid_age(25)   # age 25
is_valid_age(150)   # age 150
```

    True
    age 150: False

## Type Hints

#### Complex type hints and Optional

Combine types: `list[int]`, `dict[str, Any]`, `str | None`. `Optional[str]` is shorthand for `str | None`. `Callable[[int], str]` declares function signatures. Hints enable IDE autocompletion and static analysis with mypy/pyright — they are not checked at runtime.

```python
def process(
    name: str,
    age: int,
    score: float,
    active: bool = True,
    tags: list[str] | None = None,     # Python 3.10+ syntax
) -> dict[str, object]:
    return {"name": name, "age": age, "score": score, "active": active, "tags": tags or []}

process("Alice", 30, 85.5, tags=["admin"])
```

    {'name': 'Alice', 'age': 30, 'score': 85.5, 'active': True, 'tags': ['admin']}

#### Optional return — str | None for nullable results

`-> Optional[str]` (or `-> str | None` in 3.10+) declares a nullable return. Callers should check before using — mypy/pyright flag unguarded access. Use for lookups that may fail.

```python
def find_user(user_id: int) -> Optional[str]:   # same as str | None
    users = {1: "Alice", 2: "Bob"}
    return users.get(user_id)

find_user(1)   # find_user(1)
find_user(9)   # find_user(9)
```

    Alice
    None

#### Callable type hints

`Callable[[param_types], return_type]` declares a function parameter. `Callable[[int, int], str]` means: takes two ints, returns str. mypy checks that passed functions match the signature.

```python
def apply_func(func: Callable[[int], int], value: int) -> int:
    # func must be a function that takes an int and returns an int
    return func(value)

# same as the non-hinted version
def apply_func_nohint(func, value):
    return func(value)

apply_func(lambda x: x * 2, 5)   # apply
apply_func_nohint(lambda x: x * 2, 5)   # apply_nohint
```

    apply: 10
    apply_nohint: 10

#### Type aliases, __annotations__, get_type_hints — runtime introspection

> [!info] Type introspection
>
> - Type aliases give readable names: `UserMap = dict[int, str]`
> - `__annotations__` stores hints as a dict for runtime introspection — this is how Pydantic validates types
> - `get_type_hints()` resolves forward references

```python
UserId = int
UserName = str
UserMap = dict[UserId, UserName]

def get_users() -> UserMap:
    return {1: "Alice", 2: "Bob"}
get_users()   # get_users()

add.__annotations__   # add
process.__annotations__   # process
```

    {1: 'Alice', 2: 'Bob'}
    {'a': <class 'int'>, 'b': <class 'int'>, 'return': <class 'int'>}
    process: {'name': <class 'str'>, 'age': <class 'int'>, 'score': <class 'float'>, 'active': <class 'bool'>, 'tags': list[str] | None, 'return': dict[str, object]}
