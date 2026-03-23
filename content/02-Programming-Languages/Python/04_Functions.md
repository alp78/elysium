---
type: reference
category: programming-languages
technology: [python]
tags: [reference, programming-languages, python, functions]
aliases: [lambda, closures, decorators, delegates, higher-order functions, generators, iterators]
keywords: [def, lambda, closure, decorator, args, kwargs, type hints, functools, scope, LEGB]
description: "Python functions reference with executable examples and cell outputs — covers function basics, parameters, lambda, closures, decorators, and type hints. See [[cs-04_Functions]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[cs-04_Functions]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 04. Functions - Python

## 1. Function Basics


```python
# Function Basics
#
# KEY CONCEPTS:
# - Function: a reusable block of code. Defined with 'def' in Python.
# - Parameters: variables in the function definition (the template).
# - Arguments: actual values passed when calling the function.
# - Return value: what the function sends back. Returns None if no return statement.
# - Docstring: a triple-quoted string at the top of the function body that documents it.
#   Accessible via func.__doc__. C# uses XML comments (/// <summary>) instead.
# - First-class functions: functions are objects — you can assign them to variables,
#   pass them as arguments, return them from other functions, store in lists.
#   C# supports this via delegates (Func<>, Action<>).

# === Defining and calling ===
print("=== Basic Functions ===")
def greet(name):
    """Return a greeting message."""
    return f"Hello, {name}!"

print(greet("Alice"))
print(greet("Bob"))

# === No return -> returns None ===
def print_greeting(name):
    print(f"Hi, {name}!")

result = print_greeting("Charlie")
print(f"Return value: {result}")       # None

# === Multiple return values (tuple) ===
print("\n=== Multiple Return Values ===")
def divide(a, b):
    """Return quotient and remainder."""
    return a // b, a % b               # returns a tuple

quotient, remainder = divide(17, 5)    # tuple unpacking
print(f"17 / 5 = {quotient} remainder {remainder}")
print(f"As tuple: {divide(17, 5)}")

# === Functions are first-class objects ===
print("\n=== First-Class Functions ===")
say_hello = greet                      # assign to variable
print(say_hello("Diana"))

def apply(func, value):                # pass as argument
    return func(value)
print(apply(greet, "Eve"))

# Return a function from a function
def make_multiplier(n):
    def multiplier(x):
        return x * n
    return multiplier

double = make_multiplier(2)
triple = make_multiplier(3)
print(f"double(5) = {double(5)}")
print(f"triple(5) = {triple(5)}")

# === Docstrings ===
print("\n=== Docstrings ===")
print(f"greet.__doc__:  {greet.__doc__}")
print(f"divide.__doc__: {divide.__doc__}")
```


```python
# Real-World Use Cases for First-Class Functions
# Passing functions as arguments is useful when you want to pass BEHAVIOR as a parameter.
# "Do this thing, but I'll tell you HOW."

# === 1. Callbacks — "call me when you're done" ===
print("=== 1. Callbacks ===")
def fetch_data(url, on_success, on_error):
    try:
        result = f"data from {url}"   # simulate fetch
        on_success(result)
    except Exception as e:
        on_error(e)

fetch_data("api/users",
    on_success=lambda data: print(f"  Got: {data}"),
    on_error=lambda err: print(f"  Error: {err}"))

# === 2. Strategy pattern — swap behavior without changing code ===
print("\n=== 2. Strategy Pattern ===")
full_price = lambda price: price
discount_20 = lambda price: price * 0.8
member_discount = lambda price: price * 0.7

def calculate(price, strategy):
    return strategy(price)

print(f"  Full:     ${calculate(100, full_price):.2f}")
print(f"  20% off:  ${calculate(100, discount_20):.2f}")
print(f"  Member:   ${calculate(100, member_discount):.2f}")

# === 3. Data processing pipeline ===
print("\n=== 3. Pipeline ===")
import re
from functools import reduce

# steps is a list of functions — each takes a string and returns a string.
# 's' in each lambda is the string parameter — it's not declared anywhere else
# because lambda DEFINES it as a parameter (like def f(s): ...).
steps = [
    str.strip,                           # built-in method reference (no lambda needed)
    str.lower,                           # same — str.lower is already a function
    lambda s: re.sub(r'\s+', ' ', s),    # lambda defines 's' as its parameter
]

raw = "  Hello   World  "
# reduce(function, iterable, seed):
#   seed = raw ("  Hello   World  ") — the starting value
#   iterable = steps — the list of functions to apply
#   function = lambda acc, step: step(acc)
#     acc  = the running result (starts as seed, then output of each step)
#     step = the current function from the steps list
#   Each iteration: acc = step(acc), feeding output of previous step as input to next
result = reduce(lambda acc, step: step(acc), steps, raw)
print(f"  '{raw}' -> '{result}'")

# === 4. Dependency injection / testability ===
print("\n=== 4. Dependency Injection ===")
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
fake_time = lambda: datetime(2024, 1, 1, 12, 0)
order2 = process_order({"id": 2}, get_now=fake_time)
print(f"  Test:       {order2['processed_at']}")

# === 5. Event handlers / hooks ===
print("\n=== 5. Event Hooks ===")
from typing import Optional, Callable

class DataLoader:
    def __init__(self):
        self.on_progress: Optional[Callable] = None   # callback slot (typed to avoid Pylance warning)

    def load(self, items):
        for i, item in enumerate(items):
            if self.on_progress:
                self.on_progress(i + 1, len(items), item)

loader = DataLoader()
loader.on_progress = lambda curr, total, item: print(f"  [{curr}/{total}] Loading {item}")
loader.load(["users", "orders", "products"])

# === 6. Sorting with custom key ===
print("\n=== 6. Custom Sort Key ===")
employees = [
    {"name": "Alice", "dept": "Engineering", "salary": 95000},
    {"name": "Bob", "dept": "Sales", "salary": 65000},
    {"name": "Charlie", "dept": "Engineering", "salary": 110000},
]
by_salary = sorted(employees, key=lambda e: e["salary"], reverse=True)
for e in by_salary:
    print(f"  {e['name']:10} ${e['salary']:,}")

# === Summary ===
print("\n=== When to pass functions ===")
print("Callbacks:    on_success, on_error, on_progress hooks")
print("Strategy:     swap algorithms without changing code")
print("Pipeline:     chain processing steps in a list")
print("DI/Testing:   inject fake dependencies for testing")
print("Events:       notify subscribers when something happens")
print("Sorting:      custom comparison logic via key=")
```

    === 1. Callbacks ===
      Got: data from api/users
    
    === 2. Strategy Pattern ===
      Full:     $100.00
      20% off:  $80.00
      Member:   $70.00
    
    === 3. Pipeline ===
      '  Hello   World  ' -> 'hello world'
    
    === 4. Dependency Injection ===
      Production: 2026-03-18 15:08:17.444349
      Test:       2024-01-01 12:00:00
    
    === 5. Event Hooks ===
      [1/3] Loading users
      [2/3] Loading orders
      [3/3] Loading products
    
    === 6. Custom Sort Key ===
      Charlie    $110,000
      Alice      $95,000
      Bob        $65,000
    
    === When to pass functions ===
    Callbacks:    on_success, on_error, on_progress hooks
    Strategy:     swap algorithms without changing code
    Pipeline:     chain processing steps in a list
    DI/Testing:   inject fake dependencies for testing
    Events:       notify subscribers when something happens
    Sorting:      custom comparison logic via key=
    

    C:\Users\aperi\AppData\Local\Temp\ipykernel_22140\446309906.py:63: DeprecationWarning: datetime.datetime.utcnow() is deprecated and scheduled for removal in a future version. Use timezone-aware objects to represent datetimes in UTC: datetime.datetime.now(datetime.UTC).
      order["processed_at"] = get_now()
    

## 2. Parameters


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

# === Positional and keyword ===
print("=== Positional & Keyword ===")
def greet(name, greeting="Hello"):
    return f"{greeting}, {name}!"

print(greet("Alice"))                          # positional, default greeting
print(greet("Bob", "Hi"))                      # both positional
print(greet(greeting="Yo", name="Diana"))      # both keyword (any order)

# === Mutable default trap ===
print("\n=== Mutable Default Trap ===")
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

# === *args — variable positional ===
# put all unnamed arguments into a tuple
print("\n=== *args ===")
def total(*args):
    print(f"  args = {args}  (type: {type(args).__name__})")
    return sum(args)
print(f"total(1,2,3): {total(1, 2, 3)}")

numbers = [1, 2, 3, 4, 5]
print(f"total(*list): {total(*numbers)}")      # unpack list into args

# === **kwargs — variable keyword ===
# put all named arguments into a dict
print("\n=== **kwargs ===")
def build_profile(**kwargs):
    print(f"  kwargs = {kwargs}  (type: {type(kwargs).__name__})")
    return kwargs
print(build_profile(name="Alice", age=30))

data = {"host": "localhost", "port": 5432}
def connect(host, port=5432):
    return f"{host}:{port}"
print(f"connect(**dict): {connect(**data)}")   # unpack dict into kwargs

# === Combined ===
print("\n=== All Combined ===")
def kitchen_sink(required, *args, keyword_only="default", **kwargs):
    print(f"  required: {required}")
    print(f"  *args:    {args}")
    print(f"  kw_only:  {keyword_only}")
    print(f"  **kwargs: {kwargs}")
kitchen_sink("a", "b", "c", keyword_only="custom", x=1, y=2)

# === Positional-only / Keyword-only ===
# fence pattern: everything before / is pos-only, everything after * is arg-only
print("\n=== Positional-only (/) & Keyword-only (*) ===")
def func(pos_only, /, normal, *, kw_only):
    return f"{pos_only}, {normal}, {kw_only}"
print(func(1, 2, kw_only=3))
print(func(1, normal=2, kw_only=3))
# func(pos_only=1, ...)  # Error! pos_only is positional-only
# func(1, 2, 3)          # Error! kw_only must be keyword
```

    === Positional & Keyword ===
    Hello, Alice!
    Hi, Bob!
    Yo, Diana!
    
    === Mutable Default Trap ===
    [1]
    [1, 2]
    [1]
    [2]
    
    === *args ===
      args = (1, 2, 3)  (type: tuple)
    total(1,2,3): 6
      args = (1, 2, 3, 4, 5)  (type: tuple)
    total(*list): 15
    
    === **kwargs ===
      kwargs = {'name': 'Alice', 'age': 30}  (type: dict)
    {'name': 'Alice', 'age': 30}
    connect(**dict): localhost:5432
    
    === All Combined ===
      required: a
      *args:    ('b', 'c')
      kw_only:  custom
      **kwargs: {'x': 1, 'y': 2}
    
    === Positional-only (/) & Keyword-only (*) ===
    1, 2, 3
    1, 2, 3
    

## 3. Lambda Expressions


```python
# Lambda — anonymous (unnamed) one-line functions
#
# KEY CONCEPTS:
# - Lambda: syntax is `lambda params: expression` — returns the expression result.
#   C# equivalent: `(params) => expression`
# - Can only contain a SINGLE expression — no statements, no assignments, no multi-line.
# - Use case: short throwaway functions passed to sorted, map, filter, min, max.
# - Rule of thumb: if you need to assign a lambda to a variable, use def instead.

print("=== Lambda Basics ===")
add = lambda a, b: a + b              # same as: def add(a, b): return a + b
print(f"lambda add: {add(3, 4)}")

# === Common use cases ===
print("\n=== With sorted ===")
names = ["Charlie", "Alice", "Bob", "Diana"]
print(f"By length:    {sorted(names, key=lambda n: len(n))}")
print(f"By last char: {sorted(names, key=lambda n: n[-1])}")

print("\n=== With map & filter ===")
nums = [1, 2, 3, 4, 5]
print(f"Squared: {list(map(lambda x: x**2, nums))}")
print(f"Evens:   {list(filter(lambda x: x % 2 == 0, nums))}")

print("\n=== With min/max ===")
people = [("Alice", 30), ("Bob", 25), ("Charlie", 35)]
print(f"Youngest: {min(people, key=lambda p: p[1])}")

# === Immediately invoked ===
print("\n=== Immediately Invoked ===")
result = (lambda x, y: x + y)(3, 4)
print(f"Result: {result}")

# === Guidelines ===
print("\n=== Guidelines ===")
print("Use lambda:  one-line, passed to sorted/map/filter/min/max")
print("Use def:     multi-line, reused, needs a name or docstring")
```

    === Lambda Basics ===
    lambda add: 7
    
    === With sorted ===
    By length:    ['Bob', 'Alice', 'Diana', 'Charlie']
    By last char: ['Diana', 'Bob', 'Charlie', 'Alice']
    
    === With map & filter ===
    Squared: [1, 4, 9, 16, 25]
    Evens:   [2, 4]
    
    === With min/max ===
    Youngest: ('Bob', 25)
    
    === Immediately Invoked ===
    Result: 7
    
    === Guidelines ===
    Use lambda:  one-line, passed to sorted/map/filter/min/max
    Use def:     multi-line, reused, needs a name or docstring
    

## 4. Closures & Scope


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

# === LEGB scope ===
print("=== LEGB Scope ===")
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

# === Closure ===
print("\n=== Closure ===")
def make_counter(start=0):
    count = start
    def increment():
        nonlocal count
        count += 1
        return count
    return increment

counter = make_counter(10) # nonlocal count is assinged 10
print(f"counter(): {counter()}")    # 11
print(f"counter(): {counter()}")    # 12

counter2 = make_counter(0)          # independent closure
print(f"counter2(): {counter2()}")  # 1

# === global keyword ===
print("\n=== global ===")
total = 0
def add_to_total(n):
    global total
    total += n
add_to_total(10)
add_to_total(20)
print(f"total = {total}")

# === Function factory ===
print("\n=== Function Factory ===")
def make_validator(min_val, max_val):
    def validate(value):
        return min_val <= value <= max_val
    return validate

is_valid_age = make_validator(0, 120)
is_valid_score = make_validator(0, 100)
print(f"age 25:  {is_valid_age(25)}")
print(f"age 150: {is_valid_age(150)}")

# === Late binding gotcha ===
print("\n=== Late Binding Gotcha ===")
funcs_bad = [lambda: i for i in range(3)]
print(f"Bad:  {[f() for f in funcs_bad]}")     # [2, 2, 2] — all see final i!

funcs_good = [lambda i=i: i for i in range(3)] # fix: capture value via default arg
print(f"Good: {[f() for f in funcs_good]}")    # [0, 1, 2]
```

    === LEGB Scope ===
      inner: local
      outer: enclosing
      global: global
    
    === Closure ===
    counter(): 11
    counter(): 12
    counter2(): 1
    
    === global ===
    total = 30
    
    === Function Factory ===
    age 25:  True
    age 150: False
    
    === Late Binding Gotcha ===
    Bad:  [2, 2, 2]
    Good: [0, 1, 2]
    

## 5. Decorators


```python
# Decorators — functions that wrap and modify other functions
#
# KEY CONCEPTS:
# - Decorator: a function that takes a function as input, returns a modified version.
#   @decorator above a function is syntactic sugar for: func = decorator(func)
# - functools.wraps: preserves the original function's __name__ and __doc__.
#   Always use this in your decorators.
# - Decorator with arguments: needs an extra nesting layer (decorator factory).
# - Stacking: multiple decorators applied bottom-up.
# - C# has [Attributes] for metadata but they don't modify behavior at runtime.
#   C#'s closest equivalent is middleware or aspect-oriented programming (AOP).

import functools
import time

# === Basic decorator ===
print("=== Basic Decorator (timer) ===")
# How a decorator works step by step:
# 1. timer(func) receives the ORIGINAL function as its argument
# 2. Inside, it defines a NEW function (wrapper) that:
#    a. Does something BEFORE calling the original (start timer)
#    b. Calls the original function: func(*args, **kwargs)
#    c. Does something AFTER (measure elapsed time, print it)
#    d. Returns the original function’s result (so the caller gets what they expect)
# 3. timer returns wrapper — the original function is now REPLACED by wrapper
#    So when you call slow_sum(n), you’re actually calling wrapper(n),
#    which calls the real slow_sum inside and adds timing around it.
def timer(func):                          # Step 1: receives original function
    @functools.wraps(func)                # preserves func.__name__ and __doc__ on wrapper
    def wrapper(*args, **kwargs):         # Step 2: replacement function (accepts any arguments)
        start = time.perf_counter()       # 2a. BEFORE: start timer
        result = func(*args, **kwargs)    # 2b. CALL: run the original function
        elapsed = time.perf_counter() - start  # 2c. AFTER: measure time
        print(f"  {func.__name__} took {elapsed:.6f}s")
        return result                     # 2d. return original’s result to caller
    return wrapper                        # Step 3: return the wrapper (replaces original)

@timer
def slow_sum(n):
    """Sum numbers from 0 to n."""
    return sum(range(n))

result = slow_sum(1_000_000)
print(f"  Result: {result}")
print(f"  Name: {slow_sum.__name__}")     # 'slow_sum' (preserved by wraps)

# === Decorator with arguments ===
print("\n=== Decorator with Arguments (retry) ===")
def retry(max_attempts=3):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    print(f"  Attempt {attempt} failed: {e}")
                    if attempt == max_attempts:
                        raise
        return wrapper
    return decorator

@retry(max_attempts=3)
def unreliable():
    import random
    if random.random() < 0.7:
        raise ValueError("Random failure")
    return "Success!"

try:
    print(f"  {unreliable()}")
except ValueError:
    print("  All attempts failed")

# === Stacking decorators ===
print("\n=== Stacking (applied bottom-up) ===")
def bold(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        return f"<b>{func(*args, **kwargs)}</b>"
    return wrapper

def italic(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        return f"<i>{func(*args, **kwargs)}</i>"
    return wrapper

@bold
@italic          # italic applied first, then bold wraps the result
def say(text):
    return text

print(f"Stacked: {say('hello')}")   # <b><i>hello</i></b>

# === Built-in decorators ===
print("\n=== Built-in Decorators ===")
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

    === Basic Decorator (timer) ===
      slow_sum took 0.015784s
      Result: 499999500000
      Name: slow_sum
    
    === Decorator with Arguments (retry) ===
      Attempt 1 failed: Random failure
      Success!
    
    === Stacking (applied bottom-up) ===
    Stacked: <b><i>hello</i></b>
    
    === Built-in Decorators ===
    @property:     42
    @staticmethod: No instance needed
    @classmethod:  99
    

## 6. Type Hints


```python
# Type Hints — optional annotations for documentation and tooling
#
# KEY CONCEPTS:
# - Type hints: declare expected types for parameters and return values.
#   Python does NOT enforce them at runtime — purely for documentation,
#   IDE support, and static analysis (mypy, pyright).
# - C# enforces types at compile time (mandatory). Python hints are informational only.
# - typing module: provides complex annotations (Optional, Union, Callable, etc.)
# - Python 3.10+: use built-in syntax: list[int], int | None (no typing import needed)

from typing import Optional, Callable

# === Basic type hints ===
print("=== Basic Type Hints ===")
def add(a: int, b: int) -> int:
    return a + b

print(f"add(3, 4):     {add(3, 4)}")
print(f"add('a', 'b'): {add('a', 'b')}")   # works! Python doesn't enforce  # type: ignore

# === Common annotations ===
def process(
    name: str,
    age: int,
    score: float,
    active: bool = True,
    tags: list[str] | None = None,     # Python 3.10+ syntax
) -> dict[str, object]:
    return {"name": name, "age": age, "score": score, "active": active, "tags": tags or []}

print(process("Alice", 30, 85.5, tags=["admin"]))

# === Optional (X | None) ===
print("\n=== Optional ===")
def find_user(user_id: int) -> Optional[str]:   # same as str | None
    users = {1: "Alice", 2: "Bob"}
    return users.get(user_id)

print(f"find_user(1): {find_user(1)}")
print(f"find_user(9): {find_user(9)}")

# === Callable type hint ===
# Callable declares that a parameter is a FUNCTION with a specific signature:
#   Callable[[param_types], return_type]
#            ^               ^
#            input types      output type
#            (as a list)
#
# Callable[[int], int]       = function taking 1 int, returning int
# Callable[[str, int], bool] = function taking (str, int), returning bool
# Callable[[], None]         = function taking nothing, returning None
# C# equivalent: Func<int, int>, Func<string, int, bool>, Action
print("\n=== Callable ===")
def apply_func(func: Callable[[int], int], value: int) -> int:
    # func must be a function that takes an int and returns an int
    return func(value)

# same as the non-hinted version
def apply_func_nohint(func, value):
    return func(value) 

print(f"apply: {apply_func(lambda x: x * 2, 5)}")
print(f"apply_nohint: {apply_func_nohint(lambda x: x * 2, 5)}")

# === Type aliases ===
UserId = int
UserName = str
UserMap = dict[UserId, UserName]

def get_users() -> UserMap:
    return {1: "Alice", 2: "Bob"}
print(f"\nget_users(): {get_users()}")

# === Inspecting annotations ===
print("\n=== Annotations ===")
print(f"add:     {add.__annotations__}")
print(f"process: {process.__annotations__}")

# === Key Differences from C# ===
print("\n=== Python vs C# ===")
print("Python: type hints OPTIONAL, NOT enforced at runtime")
print("C#:     types REQUIRED, enforced at compile time")
print("Python: def func(x: int) -> int:    (hint only)")
print("C#:     int Func(int x) { ... }     (enforced)")
print("Python: list[int] | None            (optional nullable)")
print("C#:     List<int>?                   (nullable reference)")
print("Use mypy/pyright to check Python types statically")
```

    === Basic Type Hints ===
    add(3, 4):     7
    add('a', 'b'): ab
    {'name': 'Alice', 'age': 30, 'score': 85.5, 'active': True, 'tags': ['admin']}
    
    === Optional ===
    find_user(1): Alice
    find_user(9): None
    
    === Callable ===
    apply: 10
    apply_nohint: 10
    
    get_users(): {1: 'Alice', 2: 'Bob'}
    
    === Annotations ===
    add:     {'a': <class 'int'>, 'b': <class 'int'>, 'return': <class 'int'>}
    process: {'name': <class 'str'>, 'age': <class 'int'>, 'score': <class 'float'>, 'active': <class 'bool'>, 'tags': list[str] | None, 'return': dict[str, object]}
    
    === Python vs C# ===
    Python: type hints OPTIONAL, NOT enforced at runtime
    C#:     types REQUIRED, enforced at compile time
    Python: def func(x: int) -> int:    (hint only)
    C#:     int Func(int x) { ... }     (enforced)
    Python: list[int] | None            (optional nullable)
    C#:     List<int>?                   (nullable reference)
    Use mypy/pyright to check Python types statically
    
