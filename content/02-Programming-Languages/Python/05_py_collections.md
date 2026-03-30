---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [lists, dictionaries, sets, tuples, arrays, List, Dictionary, HashSet, LINQ]
keywords: [list, dict, set, tuple, frozenset, deque, Counter, defaultdict, namedtuple, comprehension]
description: "Python collections reference with executable examples and cell outputs — covers lists, dictionaries, sets, tuples, and specialized collections from the collections module. See [[05_cs_collections]] for the C# equivalent."
related:
  - "[[moc-programming-languages]]"
  - "[[05_cs_collections]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 05. Collections - Python

## Lists (Dynamic Arrays)

#### List creation — literals, list(), range, nested

> [!info] List fundamentals
>
> - Ordered, mutable, allows duplicates and mixed types
> - O(1) append and index access, O(n) insert/remove
> - 0-indexed with negative indexing (`[-1]` = last element) and slicing (`list[start:stop:step]`)
> - No fixed-size array built-in (use `array.array` or NumPy)

> [!warning] Anti-patterns
>
> - **`list` for membership tests** — O(n); use `set` for large data
> - **`insert(0, x)` frequently** — O(n) shift; use `deque.appendleft()`
> - **Modifying during iteration** — use a copy or comprehension instead

```python
from collections import Counter
from collections import defaultdict
from collections import deque
from collections import namedtuple
from enum import Enum, IntEnum, auto
from typing import NamedTuple
import copy
import heapq
empty = []
nums = [1, 2, 3, 4, 5]
mixed = [1, "hello", True, 3.14, None]     # mixed types allowed
nested = [[1, 2], [3, 4], [5, 6]]          # list of lists (2D)
from_range = list(range(5))                 # [0, 1, 2, 3, 4]
repeated = [0] * 5                          # [0, 0, 0, 0, 0]

print(f"empty:      {empty}")
print(f"nums:       {nums}")
print(f"mixed:      {mixed}")
print(f"nested:     {nested}")
print(f"from_range: {from_range}")
print(f"repeated:   {repeated}")
print(f"nums[0]:    {nums[0]}")             # first
print(f"nums[-1]:   {nums[-1]}")            # last
print(f"nums[1:4]:  {nums[1:4]}")           # slice [2, 3, 4]
print(f"nums[::-1]: {nums[::-1]}")          # reversed
print(f"nested[1][0]: {nested[1][0]}")      # 2D access: row 1, col 0
```

    empty:      []
    nums:       [1, 2, 3, 4, 5]
    mixed:      [1, 'hello', True, 3.14, None]
    nested:     [[1, 2], [3, 4], [5, 6]]
    from_range: [0, 1, 2, 3, 4]
    repeated:   [0, 0, 0, 0, 0]
    nums[0]:    1
    nums[-1]:   5
    nums[1:4]:  [2, 3, 4]
    nums[::-1]: [5, 4, 3, 2, 1]
    nested[1][0]: 3

#### List append, insert, extend, remove, pop — add and remove elements

```python
# Adding and removing — append, insert, extend, remove, pop, del

lst = [1, 2, 3]
lst.append(4)                               # add to end: [1, 2, 3, 4]
lst.insert(0, 0)                            # insert at index: [0, 1, 2, 3, 4]
lst.extend([5, 6])                          # add multiple: [0, 1, 2, 3, 4, 5, 6]
print(f"After adds: {lst}")

lst = [1, 2, 3, 2, 4, 5]
lst.remove(2)                               # remove FIRST occurrence of value
print(f"remove(2):  {lst}")
del lst[0]                                  # remove at index
print(f"del [0]:    {lst}")
last = lst.pop()                            # pop last (returns value)
print(f"pop():      {lst} (popped: {last})")
lst.clear()                                 # remove all
print(f"clear():    {lst}")
```

    After adds: [0, 1, 2, 3, 4, 5, 6]
    remove(2):  [1, 3, 2, 4, 5]
    del [0]:    [3, 2, 4, 5]
    pop():      [3, 2, 4] (popped: 5)
    clear():    []

#### List search — in operator, index(), count()

```python
# Search and membership — in, index, count for finding elements

lst = [10, 20, 30, 40, 30, 50]
print(f"30 in lst:      {30 in lst}")       # True (membership check)
print(f"99 in lst:      {99 in lst}")       # False
print(f"index(30):      {lst.index(30)}")   # 2 (first occurrence)
print(f"count(30):      {lst.count(30)}")   # 2 (how many times)
```

    30 in lst:      True
    99 in lst:      False
    index(30):      2
    count(30):      2

#### List sort() and sorted() — in-place vs new list

```python
# Sorting — sorted() returns new list, .sort() mutates in place

nums = [3, 1, 4, 1, 5, 9, 2, 6]
print(f"sorted():       {sorted(nums)}")            # returns NEW list, original unchanged
print(f"original:       {nums}")                     # unchanged
nums.sort()                                          # sorts IN-PLACE, returns None
print(f"sort():         {nums}")                     # modified
nums.sort(reverse=True)                              # descending
print(f"reverse sort:   {nums}")

words = ["banana", "apple", "cherry"]
print(f"by length:      {sorted(words, key=len)}")
print(f"case-insensitive: {sorted(['Banana', 'apple', 'Cherry'], key=str.lower)}")
```

    sorted():       [1, 1, 2, 3, 4, 5, 6, 9]
    original:       [3, 1, 4, 1, 5, 9, 2, 6]
    sort():         [1, 1, 2, 3, 4, 5, 6, 9]
    reverse sort:   [9, 6, 5, 4, 3, 2, 1, 1]
    by length:      ['apple', 'banana', 'cherry']
    case-insensitive: ['apple', 'Banana', 'Cherry']

#### Copying — shallow vs deep

```python
# Copying — shallow vs deep copy

original = [[1, 2], [3, 4]]
shallow = original.copy()                    # or: list(original) or original[:]
shallow[0][0] = 99                           # modifies original too! (shared inner lists)
print(f"original after shallow copy mutation: {original}")  # [[99, 2], [3, 4]]

original = [[1, 2], [3, 4]]
deep = copy.deepcopy(original)               # fully independent copy
deep[0][0] = 99
print(f"original after deep copy mutation:   {original}")   # [[1, 2], [3, 4]] — unchanged
```

    original after shallow copy mutation: [[99, 2], [3, 4]]
    original after deep copy mutation:   [[1, 2], [3, 4]]

#### List as stack

```python
# List as stack — LIFO with append and pop

stack = []
stack.append("a")    # push
stack.append("b")
stack.append("c")
print(f"stack:  {stack}")
print(f"pop:    {stack.pop()}")   # "c" (last in, first out)
print(f"stack:  {stack}")
```

    stack:  ['a', 'b', 'c']
    pop:    c
    stack:  ['a', 'b']

## Dictionaries

#### Dict creation — literals, dict(), fromkeys, comprehension

Hash-based mapping with O(1) average lookup, insert, and delete. Insertion-ordered since Python 3.7. Keys must be hashable (immutable): `str`, `int`, `float`, `tuple`, `frozenset` — NOT `list` or `dict`. `defaultdict` auto-creates missing keys with a factory function; `Counter` is a specialized dict for counting occurrences.

> [!warning] Anti-patterns
>
> - **Mutable keys** (lists, dicts) — `TypeError`; use tuples instead
> - **Bracket access without checking** — `KeyError`; use `.get()`
> - **`dict` for ordered data** when a list of tuples suffices

```python
empty = {}
person = {"name": "Alice", "age": 30, "city": "NYC"}
from_pairs = dict([("a", 1), ("b", 2)])            # from list of tuples
from_kwargs = dict(name="Bob", age=25)             # from keyword args
from_keys = dict.fromkeys(["x", "y", "z"], 0)      # all same value
comprehension = {x: x**2 for x in range(5)}        # dict comprehension

print(f"person:  {person}")
print(f"from_pairs: {from_pairs}")
print(f"from_keys:  {from_keys}")
print(f"comprehension: {comprehension}")
```

    person:  {'name': 'Alice', 'age': 30, 'city': 'NYC'}
    from_pairs: {'a': 1, 'b': 2}
    from_keys:  {'x': 0, 'y': 0, 'z': 0}
    comprehension: {0: 0, 1: 1, 2: 4, 3: 9, 4: 16}

#### Dict access — [], .get(), .setdefault(), KeyError

```python
# Dict access and update — bracket, .get(), .setdefault(), .update()

print(f"person['name']:    {person['name']}")          # KeyError if missing
print(f"person.get('name'):{person.get('name')}")      # None if missing (safe)
print(f"person.get('zip', 'N/A'): {person.get('zip', 'N/A')}")  # default value

person["email"] = "alice@example.com"                   # add new key
person["age"] = 31                                      # update existing
person.update({"city": "LA", "zip": "90001"})          # update multiple
person |= {"phone": "555-0123"}                        # merge (Python 3.9+)
print(f"Updated: {person}")
```

    person['name']:    Alice
    person.get('name'):Alice
    person.get('zip', 'N/A'): N/A
    Updated: {'name': 'Alice', 'age': 31, 'city': 'LA', 'email': 'alice@example.com', 'zip': '90001', 'phone': '555-0123'}

#### Dict del, pop, clear — removing and iterating with .items()

```python
# Removing and iterating — del, pop, popitem, and key/value/item loops

d = {"a": 1, "b": 2, "c": 3, "d": 4}
del d["a"]                                             # delete key (KeyError if missing)
popped = d.pop("b")                                    # remove and return (KeyError if missing)
popped_safe = d.pop("z", "default")                    # safe pop with default
last = d.popitem()                                     # remove and return last (k, v) pair
print(f"After removes: {d}")

d = {"name": "Alice", "age": 30, "city": "NYC"}
for key in d:                                          # keys (default)
    print(f"  key: {key}")
for key, value in d.items():                           # key-value pairs
    print(f"  {key}: {value}")
for value in d.values():                               # values only
    print(f"  value: {value}")

print(f"'name' in d:  {'name' in d}")                 # checks KEYS, not values
print(f"'Alice' in d: {'Alice' in d}")                 # False — not a key
print(f"len(d):       {len(d)}")
```

    After removes: {'c': 3}
      key: name
      key: age
      key: city
      name: Alice
      age: 30
      city: NYC
      value: Alice
      value: 30
      value: NYC
    'name' in d:  True
    'Alice' in d: False
    len(d):       3

#### Dict merging — | operator, .update(), **unpacking

```python
# Merging dicts — {**a, **b}, |, and |= operators

a = {"x": 1, "y": 2}
b = {"y": 3, "z": 4}
merged = {**a, **b}                                    # b overwrites a's 'y'
merged2 = a | b                                        # Python 3.9+ (same result)
print(f"merged: {merged}")                             # {'x': 1, 'y': 3, 'z': 4}
```

    merged: {'x': 1, 'y': 3, 'z': 4}

#### defaultdict and Counter

```python
# defaultdict — auto-create missing keys with a factory function

words = ["apple", "banana", "avocado", "cherry", "blueberry"]
groups = defaultdict(list)                             # missing key → empty list
for word in words:
    groups[word[0]].append(word)                       # no KeyError!
print(f"Groups: {dict(groups)}")
```

    Groups: {'a': ['apple', 'avocado'], 'b': ['banana', 'blueberry'], 'c': ['cherry']}

#### Count occurrences

```python
# Counting occurrences — defaultdict(int) and Counter

counts = defaultdict(int)                              # missing key → 0
for word in words:
    counts[word[0]] += 1
print(f"Counts: {dict(counts)}")

text = "abracadabra"
c = Counter(text)
print(f"Counter:      {c}")
print(f"Most common:  {c.most_common(3)}")
print(f"Total:        {c.total()}")
```

    Counts: {'a': 2, 'b': 2, 'c': 1}
    Counter:      Counter({'a': 5, 'b': 2, 'r': 2, 'c': 1, 'd': 1})
    Most common:  [('a', 5), ('b', 2), ('r', 2)]
    Total:        11

## Sets

#### Set creation — literals, set(), frozenset

> [!info] Set fundamentals
>
> - Unique hashable elements with O(1) membership testing and deduplication
> - Built-in set algebra: union, intersection, difference, symmetric difference
> - `frozenset` — immutable variant (can be dict keys or inside another set)
> - `{}` for non-empty sets, but `set()` for empty (since `{}` creates an empty dict)

> [!warning] Anti-patterns
>
> - **`list` + `in`** for uniqueness — O(n); use `set`
> - **Mutable elements** (lists, dicts) — unhashable, raises `TypeError`
> - **Relying on set order** — unordered (no guaranteed iteration order)

```python
empty = set()                           # NOT {} — that's an empty dict!
nums = {1, 2, 3, 4, 5}
from_list = set([1, 2, 2, 3, 3, 3])    # duplicates removed: {1, 2, 3}
from_str = set("abracadabra")           # unique chars
comprehension = {x**2 for x in range(5)}

print(f"nums:         {nums}")
print(f"from_list:    {from_list}")
print(f"from_str:     {from_str}")
print(f"comprehension:{comprehension}")
```

    nums:         {1, 2, 3, 4, 5}
    from_list:    {1, 2, 3}
    from_str:     {'d', 'b', 'r', 'a', 'c'}
    comprehension:{0, 1, 4, 9, 16}

#### Set add, remove, discard, pop — modify set elements

```python
# Set add and remove — add, update, remove, discard, pop

s = {1, 2, 3}
s.add(4)                               # add one element
s.update([5, 6, 7])                    # add multiple
print(f"After adds:   {s}")
s.remove(7)                            # remove (KeyError if missing)
s.discard(99)                          # remove (NO error if missing)
popped = s.pop()                       # remove and return arbitrary element
print(f"After removes:{s}")
```

    After adds:   {1, 2, 3, 4, 5, 6, 7}
    After removes:{2, 3, 4, 5, 6}

#### Set union, intersection, difference, symmetric_difference

```python
# Set operations — union, intersection, difference, symmetric difference

a = {1, 2, 3, 4, 5}
b = {4, 5, 6, 7, 8}

print(f"a:              {a}")
print(f"b:              {b}")
print(f"union |:        {a | b}")           # all elements from both
print(f"intersection &: {a & b}")           # elements in BOTH
print(f"difference -:   {a - b}")           # in a but NOT in b
print(f"symmetric ^:    {a ^ b}")           # in one but NOT both

# Subset / superset
print(f"{{1,2}} <= a:    {{1, 2}} is subset: {({1, 2} <= a)}")
print(f"a >= {{1,2}}:    a is superset: {(a >= {1, 2})}")
print(f"a.isdisjoint(b): {a.isdisjoint({10, 20})}")  # no common elements
```

    a:              {1, 2, 3, 4, 5}
    b:              {4, 5, 6, 7, 8}
    union |:        {1, 2, 3, 4, 5, 6, 7, 8}
    intersection &: {4, 5}
    difference -:   {1, 2, 3}
    symmetric ^:    {1, 2, 3, 6, 7, 8}
    {1,2} <= a:    {1, 2} is subset: True
    a >= {1,2}:    a is superset: True
    a.isdisjoint(b): True

#### Set difference for data comparison — find missing and extra items

```python
# Data comparison — set difference for finding missing/extra items

prod_ids = {"P001", "P002", "P003", "P004"}
warehouse_ids = {"P002", "P003", "P005"}

print(f"In prod only:      {prod_ids - warehouse_ids}")
print(f"In warehouse only: {warehouse_ids - prod_ids}")
print(f"In both:           {prod_ids & warehouse_ids}")
print(f"All unique:        {prod_ids | warehouse_ids}")
```

    In prod only:      {'P004', 'P001'}
    In warehouse only: {'P005'}
    In both:           {'P003', 'P002'}
    All unique:        {'P005', 'P001', 'P003', 'P002', 'P004'}

#### frozenset

```python
# frozenset — immutable set for use as dict keys or set elements

fs = frozenset([1, 2, 3])
# fs.add(4)  # Error! Immutable
print(f"frozenset:    {fs}")

# Can use as dict key (set can't)
cache = {frozenset({"a", "b"}): "result1"}
print(f"As dict key:  {cache}")
```

    frozenset:    frozenset({1, 2, 3})
    As dict key:  {frozenset({'b', 'a'}): 'result1'}

## Tuples & Enums

#### Tuple basics

Tuples are ordered, immutable sequences. Once created, elements can't be added, removed, or changed. Because they're hashable (if all elements are), tuples can serve as dict keys, set elements, and function return values — lists cannot. `namedtuple` adds named fields for a lightweight immutable class. Single-element tuples require a trailing comma: `(1,)` not `(1)`.

```python
empty = ()
single = (42,)                          # trailing comma required for single element!
point = (3, 4)
person = ("Alice", 30, "NYC")
nested = ((1, 2), (3, 4))

print(f"point:    {point}")
print(f"point[0]: {point[0]}")
print(f"person:   {person}")
# point[0] = 99  # TypeError! Immutable
```

    point:    (3, 4)
    point[0]: 3
    person:   ('Alice', 30, 'NYC')

#### Tuple unpacking

```python
# Tuple unpacking — destructure into separate variables

x, y = point
name, age, city = person
print(f"Unpacked: x={x}, y={y}")
print(f"Unpacked: name={name}, age={age}")

# Swap values (tuple unpacking trick)
a, b = 1, 2
a, b = b, a
print(f"Swapped:  a={a}, b={b}")

# Ignore values with _
first, *_, last = [1, 2, 3, 4, 5]
print(f"first={first}, last={last}")
```

    Unpacked: x=3, y=4
    Unpacked: name=Alice, age=30
    Swapped:  a=2, b=1
    first=1, last=5

#### namedtuple and NamedTuple

```python
# namedtuple and NamedTuple — tuples with named field access

Point = namedtuple("Point", ["x", "y"])
p = Point(3, 4)
print(f"p.x={p.x}, p.y={p.y}")
print(f"p[0]={p[0]}")                   # still supports index access
print(f"_asdict: {p._asdict()}")        # convert to dict
```

    p.x=3, p.y=4
    p[0]=3
    _asdict: {'x': 3, 'y': 4}

#### Tuple immutability — _replace for non-destructive updates

```python
# Tuple immutability — _replace for non-destructive updates

p2 = p._replace(x=10)
print(f"_replace: {p2}")


class Employee(NamedTuple):
    name: str
    department: str
    salary: float

emp = Employee("Alice", "Engineering", 95000)
print(f"\nEmployee: {emp}")
print(f"  name: {emp.name}, salary: ${emp.salary:,.0f}")
```

    _replace: Point(x=10, y=4)
    
    Employee: Employee(name='Alice', department='Engineering', salary=95000)
      name: Alice, salary: $95,000

#### Enum

```python
# Enum — named constants with type safety and iteration

class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3

class Direction(Enum):
    NORTH = auto()                     # auto-assigns: 1, 2, 3, 4
    SOUTH = auto()
    EAST = auto()
    WEST = auto()

print(f"Color.RED:       {Color.RED}")
print(f"Color.RED.name:  {Color.RED.name}")
print(f"Color.RED.value: {Color.RED.value}")
print(f"Color(2):        {Color(2)}")          # lookup by value
print(f"Color['BLUE']:   {Color['BLUE']}")     # lookup by name
```

    Color.RED:       Color.RED
    Color.RED.name:  RED
    Color.RED.value: 1
    Color(2):        Color.GREEN
    Color['BLUE']:   Color.BLUE

#### Iterating over enum

```python
# Iterating over enum — loop yields each member in declaration order

for color in Color:
    print(f"  {color.name} = {color.value}")
```

      RED = 1
      GREEN = 2
      BLUE = 3

#### Comparison

```python
# Enum comparison — identity vs value comparison

print(f"RED == RED: {Color.RED == Color.RED}")
print(f"RED == 1:   {Color.RED == 1}")          # False! Enum != int
```

    RED == RED: True
    RED == 1:   False

#### IntEnum and pipeline status

```python
# IntEnum — integer-compatible enum for arithmetic and comparison

class Priority(IntEnum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3

print(f"Priority.HIGH > Priority.LOW: {Priority.HIGH > Priority.LOW}")
print(f"Priority.HIGH == 3: {Priority.HIGH == 3}")   # True! IntEnum == int

class PipelineStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"

status = PipelineStatus.RUNNING
if status == PipelineStatus.RUNNING:
    print(f"Pipeline is {status.value}...")
```

    Priority.HIGH > Priority.LOW: True
    Priority.HIGH == 3: True
    Pipeline is running...

## Stacks, Queues & Deques

Each data structure enforces a specific access pattern:

- **Stack (LIFO):** Last In, First Out — use `list` with `append()`/`pop()`, or `collections.deque`. Use cases: DFS, undo history, backtracking.
- **Queue (FIFO):** First In, First Out — use `collections.deque` with `append()`/`popleft()`. Use cases: BFS, task processing.
- **Deque:** Double-ended queue — efficiently add/remove from both ends in O(1). Use cases: sliding windows, both-ends access.
- **Priority Queue:** Items come out in priority order, not insertion order — use the `heapq` module.

> [!warning] Don't use list.pop(0) for FIFO queues
>
> `list.pop(0)` is O(n) because it shifts all remaining elements. Use `deque.popleft()` which is O(1). Also avoid using a single list as both stack and queue — the semantics become confusing.

#### collections.deque — Stack (LIFO) with append and pop

```python
# Stack (LIFO) — list with append/pop from the end

stack = []
stack.append("first")       # push
stack.append("second")
stack.append("third")
print(f"Stack: {stack}")
print(f"Pop:   {stack.pop()}")     # "third" (last in, first out)
print(f"Pop:   {stack.pop()}")     # "second"
print(f"Peek:  {stack[-1]}")       # look at top without removing
```

    Stack: ['first', 'second', 'third']
    Pop:   third
    Pop:   second
    Peek:  first

#### collections.deque — Queue (FIFO) with append and popleft

```python
# Queue (FIFO) — deque with append/popleft

queue = deque()
queue.append("first")       # enqueue (add to right)
queue.append("second")
queue.append("third")
print(f"Queue:    {list(queue)}")
print(f"Dequeue:  {queue.popleft()}")   # "first" (first in, first out)
print(f"Dequeue:  {queue.popleft()}")   # "second"
print(f"Peek:     {queue[0]}")          # look at front without removing
```

    Queue:    ['first', 'second', 'third']
    Dequeue:  first
    Dequeue:  second
    Peek:     third

#### deque — double-ended queue

```python
# deque — double-ended queue with O(1) operations on both ends

d = deque([1, 2, 3])
d.append(4)                 # add right: [1, 2, 3, 4]
d.appendleft(0)             # add left:  [0, 1, 2, 3, 4]
d.pop()                     # remove right: [0, 1, 2, 3]
d.popleft()                 # remove left:  [1, 2, 3]
print(f"Deque: {list(d)}")

# Rotate
d = deque([1, 2, 3, 4, 5])
d.rotate(2)                 # rotate right by 2: [4, 5, 1, 2, 3]
print(f"Rotate(2): {list(d)}")
d.rotate(-2)                # rotate left by 2: [1, 2, 3, 4, 5]
print(f"Rotate(-2):{list(d)}")
```

    Deque: [1, 2, 3]
    Rotate(2): [4, 5, 1, 2, 3]
    Rotate(-2):[1, 2, 3, 4, 5]

#### deque with maxlen

```python
# deque with maxlen — fixed-size circular buffer

d = deque(maxlen=3)          # fixed-size buffer
d.append(1); d.append(2); d.append(3);
d.append(4)                 # [2, 3, 4] — 1 was auto-removed
print(f"maxlen=3:  {list(d)}")
```

    maxlen=3:  [2, 3, 4]

#### Priority queue — heapq

```python
# heapq — priority queue using a min-heap on a regular list

pq = []
heapq.heappush(pq, (3, "low priority"))
heapq.heappush(pq, (1, "high priority"))
heapq.heappush(pq, (2, "medium priority"))

print(f"Heap:    {pq}")
print(f"Pop:     {heapq.heappop(pq)}")     # (1, "high priority") — smallest first
print(f"Pop:     {heapq.heappop(pq)}")     # (2, "medium priority")
```

    Heap:    [(1, 'high priority'), (3, 'low priority'), (2, 'medium priority')]
    Pop:     (1, 'high priority')
    Pop:     (2, 'medium priority')

#### ETL task queue

```python
# ETL task queue — deque for FIFO job processing

task_queue = deque()
task_queue.append({"task": "extract", "table": "users"})
task_queue.append({"task": "extract", "table": "orders"})
task_queue.append({"task": "transform", "table": "users"})

while task_queue:
    task = task_queue.popleft()
    print(f"  Processing: {task['task']} {task['table']}")
```

      Processing: extract users
      Processing: extract orders
      Processing: transform users

## Collection Comparison & Choosing the Right One

#### Collection cheat sheet

```python
comparison = """
Collection    | Ordered | Mutable | Duplicates | Lookup  | Use When
--------------+---------+---------+------------+---------+----------------------------------
list          | Yes     | Yes     | Yes        | O(n)    | General purpose, ordered data
tuple         | Yes     | No      | Yes        | O(n)    | Immutable data, dict keys, returns
dict          | Yes*    | Yes     | Keys: No   | O(1)    | Key-value mapping, config, lookup
set           | No      | Yes     | No         | O(1)    | Unique elements, membership test
frozenset     | No      | No      | No         | O(1)    | Immutable set, dict keys
deque         | Yes     | Yes     | Yes        | O(n)    | Queue/stack, fast append/pop both ends
namedtuple    | Yes     | No      | Yes        | O(n)    | Lightweight records with named fields
defaultdict   | Yes*    | Yes     | Keys: No   | O(1)    | Grouping, counting (auto-create keys)
Counter       | Yes*    | Yes     | Keys: No   | O(1)    | Counting occurrences
heapq         | Partial | Yes     | Yes        | O(log n)| Priority queue, top-N problems

* dict/defaultdict/Counter are insertion-ordered since Python 3.7
"""
print(comparison)
```

    
    Collection    | Ordered | Mutable | Duplicates | Lookup  | Use When
    --------------+---------+---------+------------+---------+----------------------------------
    list          | Yes     | Yes     | Yes        | O(n)    | General purpose, ordered data
    tuple         | Yes     | No      | Yes        | O(n)    | Immutable data, dict keys, returns
    dict          | Yes*    | Yes     | Keys: No   | O(1)    | Key-value mapping, config, lookup
    set           | No      | Yes     | No         | O(1)    | Unique elements, membership test
    frozenset     | No      | No      | No         | O(1)    | Immutable set, dict keys
    deque         | Yes     | Yes     | Yes        | O(n)    | Queue/stack, fast append/pop both ends
    namedtuple    | Yes     | No      | Yes        | O(n)    | Lightweight records with named fields
    defaultdict   | Yes*    | Yes     | Keys: No   | O(1)    | Grouping, counting (auto-create keys)
    Counter       | Yes*    | Yes     | Keys: No   | O(1)    | Counting occurrences
    heapq         | Partial | Yes     | Yes        | O(log n)| Priority queue, top-N problems
    
    * dict/defaultdict/Counter are insertion-ordered since Python 3.7

#### Decision guide

```python
# Decision guide — choose the right collection by access pattern

guide = """
Need ordered items?
  ├─ Need to modify? → list
  └─ Immutable?      → tuple

Need key-value pairs?
  ├─ Auto-create missing keys? → defaultdict
  ├─ Count things?             → Counter
  └─ General mapping?          → dict

Need unique elements?
  ├─ Need to modify?   → set
  └─ Need as dict key? → frozenset

Need FIFO queue?        → deque
Need LIFO stack?        → list (or deque)
Need priority ordering? → heapq
Need fast middle insert?→ (use database — no Python collection is good at this)
"""
print(guide)
```

    
    Need ordered items?
      ├─ Need to modify? → list
      └─ Immutable?      → tuple
    
    Need key-value pairs?
      ├─ Auto-create missing keys? → defaultdict
      ├─ Count things?             → Counter
      └─ General mapping?          → dict
    
    Need unique elements?
      ├─ Need to modify?   → set
      └─ Need as dict key? → frozenset
    
    Need FIFO queue?        → deque
    Need LIFO stack?        → list (or deque)
    Need priority ordering? → heapq
    Need fast middle insert?→ (use database — no Python collection is good at this)

#### Common data engineering patterns

| Use case | Collection |
|---|---|
| ETL records | `list[dict]` or `list[namedtuple]` |
| Config / params | `dict` |
| Deduplication | `set` |
| Lookup table | `dict` (id → record) |
| Grouping | `defaultdict(list)` |
| Counting | `Counter` |
| Task queue | `deque` |
| Priority tasks | `heapq` |
| Schema fields | `tuple` or `frozenset` (immutable) |
| Cache key | `tuple` or `frozenset` (hashable) |
