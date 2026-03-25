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

```python
# Function Basics
#
# KEY CONCEPTS:
# - Function: a reusable block of code. Defined with 'def' in Python.
# - Parameters: variables in the function definition (the template).
# - Arguments: actual values passed when calling the function.
# - Return value: what the function sends back. Returns None if no return statement.
# - Docstring: a triple-quoted string at the top of the function body that documents it.
#   Accessible via func.__doc__.
# - First-class functions: functions are objects — you can assign them to variables,
#   pass them as arguments, return them from other functions, store in lists.

def greet(name):
    """Return a greeting message."""
    return f"Hello, {name}!"

print(greet("Alice"))
print(greet("Bob"))
```

    Hello, Alice!
    Hello, Bob!

```python
# void equivalent — functions without return implicitly return None
def print_greeting(name):
    print(f"Hi, {name}!")

result = print_greeting("Charlie")
print(f"Return value: {result}")       # None
```

    Hi, Charlie!
    Return value: None

#### Tuple return and unpacking

```python
# Parameters — default, named, *args, **kwargs, positional-only, keyword-only
#
# KEY CONCEPTS:
# - Positional arguments: matched by position: func(1, 2, 3)
# - Keyword arguments: matched by name: func(a=1, b=2)
# - Default values: fallback if not provided: def func(x=10)
# - *args: collects extra positional args into a tuple. Allows variable arg count.
# - **kwargs: collects extra keyword args into a dict. Allows variable named args.
# - Positional-only (/): params before / can ONLY be passed by position.
# - Keyword-only (*): params after * can ONLY be passed by name.
# - Mutable default trap: NEVER use lists/dicts as defaults — they're shared across calls!

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

```python
# First-class functions — assign to variables, pass as arguments
say_hello = greet                      # assign to variable
print(say_hello("Diana"))

def apply(func, value):                # pass as argument
    return func(value)
print(apply(greet, "Eve"))
```

    Hello, Diana!
    Hello, Eve!

#### Return a function from a function

```python
# Return a function — inner function captures n from enclosing scope (closure)
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

```python
# Callbacks — pass functions for success/error handling; caller defines the behavior
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

```python
# Strategy pattern — swap pricing logic at runtime by passing a different function
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

```python
# Pipeline — chain processing steps in a list; reduce applies them left to right
import re
from functools import reduce

# steps is a list of functions — each takes a string and returns a string.
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

```python
# Dependency injection — accept a get_now callable so tests can inject a fake clock
from datetime import datetime, timezone

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

```python
# Progress callback — assign a callable to a slot; the loader invokes it during processing
from typing import Optional, Callable

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

```python
# Sorting with key= — sorted() takes a function that extracts the comparison value
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

```python
# Summary — common patterns for passing functions as arguments
print("Callbacks:    on_success, on_error, on_progress hooks")
print("Strategy:     swap algorithms without changing code")
print("Pipeline:     chain processing steps in a list")
print("DI/Testing:   inject fake dependencies for testing")
print("Events:       notify subscribers when something happens")
```

    Callbacks:    on_success, on_error, on_progress hooks
    Strategy:     swap algorithms without changing code
    Pipeline:     chain processing steps in a list
    DI/Testing:   inject fake dependencies for testing
    Events:       notify subscribers when something happens

## Parameters

#### Mutable default trap

```python
# Mutable default trap — default lists/dicts are shared across calls; use None + create inside
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

```python
# **kwargs — collects extra keyword arguments into a dict; **dict unpacks a dict into keyword args
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

```python
# Combined *args/**kwargs — required first, then *args, keyword-only after *, **kwargs last
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

```python
# fence pattern: everything before / is pos-only, everything after * is kw-only
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

```python
# Lambda — single-expression anonymous function; use for short throwaway logic, prefer def otherwise
add = lambda a, b: a + b              # same as: def add(a, b): return a + b
print(f"lambda add: {add(3, 4)}")
```

    lambda add: 7

<h4>Lambdas with <code style="font-size:0.75em">sorted</code>, <code style="font-size:0.75em">map</code>, <code style="font-size:0.75em">filter</code></h4>

```python
# Lambdas with sorted, map, filter — short throwaway functions as inline arguments
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

```python
# Closures & Variable Scope
#
# KEY CONCEPTS:
# - Scope: where a variable is visible. Python uses LEGB rule:
#   L = Local (inside current function)
#   E = Enclosing (outer function, for nested functions)
#   G = Global (module level)
#   B = Built-in (print, len, etc.)
#   Python searches L -> E -> G -> B in order.
# - Closure: a nested function that "remembers" variables from its enclosing scope
#   even after the outer function has returned.
# - global: lets a function modify a module-level variable.
# - nonlocal: lets a nested function modify an enclosing function's variable.
# - Late binding: closures capture the VARIABLE, not the VALUE at creation time.
#   This is a common gotcha with lambdas in loops.

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

```python
# Closure with nonlocal — counter state is kept in the enclosing scope between calls
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

```python
# How a decorator works step by step:
# 1. timer(func) receives the ORIGINAL function as its argument
# 2. Inside, it defines a NEW function (wrapper) that:
#    a. Does something BEFORE calling the original (start timer)
#    b. Calls the original function: func(*args, **kwargs)
#    c. Does something AFTER (measure elapsed time, print it)
#    d. Returns the original function's result (so the caller gets what they expect)
# 3. timer returns wrapper — the original function is now REPLACED by wrapper
#    So when you call slow_sum(n), you're actually calling wrapper(n),
#    which calls the real slow_sum inside and adds timing around it.
import functools, time

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

```python
# Loop capture gotcha — all lambdas share the loop variable; fix with default arg i=i
funcs_bad = [lambda: i for i in range(3)]
print(f"Bad:  {[f() for f in funcs_bad]}")     # [2, 2, 2] — all see final i!

funcs_good = [lambda i=i: i for i in range(3)] # fix: capture value via default arg
print(f"Good: {[f() for f in funcs_good]}")    # [0, 1, 2]
```

    Bad:  [2, 2, 2]
    Good: [0, 1, 2]

```python
# *args — collects extra positional arguments into a tuple; *list unpacks a list into arguments
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

```python
# Decorator with arguments — extra wrapper layer returns the actual decorator
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

```python
# Stacking decorators — applied bottom-up; the result is wrapped by each layer
def add(a: int, b: int) -> int:
    return a + b

print(f"add(3, 4):     {add(3, 4)}")
print(f"add('a', 'b'): {add('a', 'b')}")   # works! Python doesn't enforce  # type: ignore
```

    add(3, 4):     7
    add('a', 'b'): ab

<h4>Built-in decorators — <code style="font-size:0.75em">@property</code>, <code style="font-size:0.75em">@staticmethod</code>, <code style="font-size:0.75em">@classmethod</code></h4>

```python
# Built-in decorators — @property for computed attrs, @staticmethod/@classmethod for class functions
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

```python
# Closure as validator factory — captures min/max for reuse
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

```python
# Complex type hints — combine basic types, generics, and union syntax for function signatures
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

```python
# Optional return — str | None means the function may return None
def find_user(user_id: int) -> Optional[str]:   # same as str | None
    users = {1: "Alice", 2: "Bob"}
    return users.get(user_id)

print(f"find_user(1): {find_user(1)}")
print(f"find_user(9): {find_user(9)}")
```

    find_user(1): Alice
    find_user(9): None

<h4><code style="font-size:0.75em">Callable</code> type hints</h4>

```python
# Callable declares that a parameter is a FUNCTION with a specific signature:
#   Callable[[param_types], return_type]
#            ^               ^
#            input types      output type
#            (as a list)
#
# Callable[[int], int]       = function taking 1 int, returning int
# Callable[[str, int], bool] = function taking (str, int), returning bool
# Callable[[], None]         = function taking nothing, returning None
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

```python
# Type aliases — give names to complex types; __annotations__ stores hints for introspection
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
