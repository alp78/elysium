---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [lists, dictionaries, sets, tuples, arrays, List, Dictionary, HashSet, LINQ]
keywords: [list, dict, set, tuple, frozenset, deque, Counter, defaultdict, namedtuple, comprehension]
description: "Python collections reference with executable examples and cell outputs — covers lists, dictionaries, sets, tuples, and specialized collections from the collections module. See [[05_cs_collections]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[05_cs_collections]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 05. Collections - Python

## 1. Lists (Dynamic Arrays)


```python
# Lists — Python's primary collection (dynamic array)
#
# KEY CONCEPTS:
# - list: ordered, mutable, allows duplicates, mixed types allowed.
#   C# equivalent: List<T> (but C# requires all elements same type).
# - Python has NO fixed-size array built-in (use array.array or numpy for that).
# - Lists are dynamic — grow/shrink automatically, no size declaration needed.
# - 0-indexed. Supports negative indexing ([-1] = last element).
# - Slicing: list[start:stop:step] — returns a new list.

# === Creation ===
print("=== Creation ===")
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

# === Accessing ===
print("\n=== Accessing ===")
print(f"nums[0]:    {nums[0]}")             # first
print(f"nums[-1]:   {nums[-1]}")            # last
print(f"nums[1:4]:  {nums[1:4]}")           # slice [2, 3, 4]
print(f"nums[::-1]: {nums[::-1]}")          # reversed
print(f"nested[1][0]: {nested[1][0]}")      # 2D access: row 1, col 0

# === Adding elements ===
print("\n=== Adding ===")
lst = [1, 2, 3]
lst.append(4)                               # add to end: [1, 2, 3, 4]
lst.insert(0, 0)                            # insert at index: [0, 1, 2, 3, 4]
lst.extend([5, 6])                          # add multiple: [0, 1, 2, 3, 4, 5, 6]
lst += [7, 8]                               # same as extend
print(f"After adds: {lst}")

# === Removing elements ===
print("\n=== Removing ===")
lst = [1, 2, 3, 2, 4, 5]
lst.remove(2)                               # remove FIRST occurrence of value 2
print(f"remove(2):  {lst}")                 # [1, 3, 2, 4, 5]
popped = lst.pop()                          # remove and return LAST element
print(f"pop():      {lst} (popped: {popped})")
popped = lst.pop(0)                         # remove and return at index
print(f"pop(0):     {lst} (popped: {popped})")
del lst[0]                                  # delete by index (no return)
print(f"del [0]:    {lst}")
lst.clear()                                 # remove all
print(f"clear():    {lst}")

# === Searching ===
print("\n=== Searching ===")
lst = [10, 20, 30, 40, 30, 50]
print(f"30 in lst:      {30 in lst}")       # True (membership check)
print(f"99 in lst:      {99 in lst}")       # False
print(f"index(30):      {lst.index(30)}")   # 2 (first occurrence)
print(f"count(30):      {lst.count(30)}")   # 2 (how many times)

# === Sorting ===
print("\n=== Sorting ===")
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

# === Copying ===
print("\n=== Copying (shallow vs deep) ===")
original = [[1, 2], [3, 4]]
shallow = original.copy()                    # or: list(original) or original[:]
shallow[0][0] = 99                           # modifies original too! (shared inner lists)
print(f"original after shallow copy mutation: {original}")  # [[99, 2], [3, 4]]

import copy
original = [[1, 2], [3, 4]]
deep = copy.deepcopy(original)               # fully independent copy
deep[0][0] = 99
print(f"original after deep copy mutation:   {original}")   # [[1, 2], [3, 4]] — unchanged

# === List as stack (LIFO) ===
print("\n=== List as Stack ===")
stack = []
stack.append("a")    # push
stack.append("b")
stack.append("c")
print(f"stack:  {stack}")
print(f"pop:    {stack.pop()}")   # "c" (last in, first out)
print(f"stack:  {stack}")
```

    === Creation ===
    empty:      []
    nums:       [1, 2, 3, 4, 5]
    mixed:      [1, 'hello', True, 3.14, None]
    nested:     [[1, 2], [3, 4], [5, 6]]
    from_range: [0, 1, 2, 3, 4]
    repeated:   [0, 0, 0, 0, 0]
    
    === Accessing ===
    nums[0]:    1
    nums[-1]:   5
    nums[1:4]:  [2, 3, 4]
    nums[::-1]: [5, 4, 3, 2, 1]
    nested[1][0]: 3
    
    === Adding ===
    After adds: [0, 1, 2, 3, 4, 5, 6, 7, 8]
    
    === Removing ===
    remove(2):  [1, 3, 2, 4, 5]
    pop():      [1, 3, 2, 4] (popped: 5)
    pop(0):     [3, 2, 4] (popped: 1)
    del [0]:    [2, 4]
    clear():    []
    
    === Searching ===
    30 in lst:      True
    99 in lst:      False
    index(30):      2
    count(30):      2
    
    === Sorting ===
    sorted():       [1, 1, 2, 3, 4, 5, 6, 9]
    original:       [3, 1, 4, 1, 5, 9, 2, 6]
    sort():         [1, 1, 2, 3, 4, 5, 6, 9]
    reverse sort:   [9, 6, 5, 4, 3, 2, 1, 1]
    by length:      ['apple', 'banana', 'cherry']
    case-insensitive: ['apple', 'Banana', 'Cherry']
    
    === Copying (shallow vs deep) ===
    original after shallow copy mutation: [[99, 2], [3, 4]]
    original after deep copy mutation:   [[1, 2], [3, 4]]
    
    === List as Stack ===
    stack:  ['a', 'b', 'c']
    pop:    c
    stack:  ['a', 'b']
    

## 2. Dictionaries


```python
# Dictionaries — key-value mapping
#
# KEY CONCEPTS:
# - dict: unordered (but insertion-ordered since Python 3.7), mutable, no duplicate keys.
#   C# equivalent: Dictionary<TKey, TValue>.
# - Keys must be hashable (immutable): str, int, float, tuple, frozenset. NOT list or dict.
# - O(1) average lookup by key — very fast. Lists are O(n) for lookup.
# - defaultdict: auto-creates missing keys with a factory function.
# - Counter: specialized dict for counting occurrences.

# === Creation ===
print("=== Creation ===")
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

# === Accessing ===
print("\n=== Accessing ===")
print(f"person['name']:    {person['name']}")          # KeyError if missing
print(f"person.get('name'):{person.get('name')}")      # None if missing (safe)
print(f"person.get('zip', 'N/A'): {person.get('zip', 'N/A')}")  # default value

# === Adding / Updating ===
print("\n=== Adding / Updating ===")
person["email"] = "alice@example.com"                   # add new key
person["age"] = 31                                      # update existing
person.update({"city": "LA", "zip": "90001"})          # update multiple
person |= {"phone": "555-0123"}                        # merge (Python 3.9+)
print(f"Updated: {person}")

# === Removing ===
print("\n=== Removing ===")
d = {"a": 1, "b": 2, "c": 3, "d": 4}
del d["a"]                                             # delete key (KeyError if missing)
popped = d.pop("b")                                    # remove and return (KeyError if missing)
popped_safe = d.pop("z", "default")                    # safe pop with default
last = d.popitem()                                     # remove and return last (k, v) pair
print(f"After removes: {d}")

# === Iterating ===
print("\n=== Iterating ===")
d = {"name": "Alice", "age": 30, "city": "NYC"}
for key in d:                                          # keys (default)
    print(f"  key: {key}")
for key, value in d.items():                           # key-value pairs
    print(f"  {key}: {value}")
for value in d.values():                               # values only
    print(f"  value: {value}")

# === Membership & Size ===
print("\n=== Membership ===")
print(f"'name' in d:  {'name' in d}")                 # checks KEYS, not values
print(f"'Alice' in d: {'Alice' in d}")                 # False — not a key
print(f"len(d):       {len(d)}")

# === Merging dicts ===
print("\n=== Merging ===")
a = {"x": 1, "y": 2}
b = {"y": 3, "z": 4}
merged = {**a, **b}                                    # b overwrites a's 'y'
merged2 = a | b                                        # Python 3.9+ (same result)
print(f"merged: {merged}")                             # {'x': 1, 'y': 3, 'z': 4}

# === defaultdict — auto-create missing keys ===
print("\n=== defaultdict ===")
from collections import defaultdict

# Group words by first letter
words = ["apple", "banana", "avocado", "cherry", "blueberry"]
groups = defaultdict(list)                             # missing key → empty list
for word in words:
    groups[word[0]].append(word)                       # no KeyError!
print(f"Groups: {dict(groups)}")

# Count occurrences
counts = defaultdict(int)                              # missing key → 0
for word in words:
    counts[word[0]] += 1
print(f"Counts: {dict(counts)}")

# === Counter ===
print("\n=== Counter ===")
from collections import Counter
text = "abracadabra"
c = Counter(text)
print(f"Counter:      {c}")
print(f"Most common:  {c.most_common(3)}")
print(f"Total:        {c.total()}")
```

    === Creation ===
    person:  {'name': 'Alice', 'age': 30, 'city': 'NYC'}
    from_pairs: {'a': 1, 'b': 2}
    from_keys:  {'x': 0, 'y': 0, 'z': 0}
    comprehension: {0: 0, 1: 1, 2: 4, 3: 9, 4: 16}
    
    === Accessing ===
    person['name']:    Alice
    person.get('name'):Alice
    person.get('zip', 'N/A'): N/A
    
    === Adding / Updating ===
    Updated: {'name': 'Alice', 'age': 31, 'city': 'LA', 'email': 'alice@example.com', 'zip': '90001', 'phone': '555-0123'}
    
    === Removing ===
    After removes: {'c': 3}
    
    === Iterating ===
      key: name
      key: age
      key: city
      name: Alice
      age: 30
      city: NYC
      value: Alice
      value: 30
      value: NYC
    
    === Membership ===
    'name' in d:  True
    'Alice' in d: False
    len(d):       3
    
    === Merging ===
    merged: {'x': 1, 'y': 3, 'z': 4}
    
    === defaultdict ===
    Groups: {'a': ['apple', 'avocado'], 'b': ['banana', 'blueberry'], 'c': ['cherry']}
    Counts: {'a': 2, 'b': 2, 'c': 1}
    
    === Counter ===
    Counter:      Counter({'a': 5, 'b': 2, 'r': 2, 'c': 1, 'd': 1})
    Most common:  [('a', 5), ('b', 2), ('r', 2)]
    Total:        11
    

## 3. Sets


```python
# Sets — unordered unique elements
#
# KEY CONCEPTS:
# - set: unordered, mutable, NO duplicates. Elements must be hashable.
#   C# equivalent: HashSet<T>.
# - frozenset: immutable set — can be used as a dict key or inside another set.
# - Set operations: union, intersection, difference, symmetric difference.
#   These are the same math operations from set theory — very useful in DE
#   for comparing datasets, finding missing records, deduplication.
# - O(1) average membership check — much faster than list's O(n).

# === Creation ===
print("=== Creation ===")
empty = set()                           # NOT {} — that's an empty dict!
nums = {1, 2, 3, 4, 5}
from_list = set([1, 2, 2, 3, 3, 3])    # duplicates removed: {1, 2, 3}
from_str = set("abracadabra")           # unique chars
comprehension = {x**2 for x in range(5)}

print(f"nums:         {nums}")
print(f"from_list:    {from_list}")
print(f"from_str:     {from_str}")
print(f"comprehension:{comprehension}")

# === Adding / Removing ===
print("\n=== Adding / Removing ===")
s = {1, 2, 3}
s.add(4)                               # add one element
s.update([5, 6, 7])                    # add multiple
print(f"After adds:   {s}")
s.remove(7)                            # remove (KeyError if missing)
s.discard(99)                          # remove (NO error if missing)
popped = s.pop()                       # remove and return arbitrary element
print(f"After removes:{s}")

# === Set Operations (the powerful part) ===
print("\n=== Set Operations ===")
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

# === DE use case: comparing datasets ===
print("\n=== DE Use Case: Dataset Comparison ===")
prod_ids = {"P001", "P002", "P003", "P004"}
warehouse_ids = {"P002", "P003", "P005"}

print(f"In prod only:      {prod_ids - warehouse_ids}")
print(f"In warehouse only: {warehouse_ids - prod_ids}")
print(f"In both:           {prod_ids & warehouse_ids}")
print(f"All unique:        {prod_ids | warehouse_ids}")

# === frozenset (immutable) ===
print("\n=== frozenset (immutable set) ===")
fs = frozenset([1, 2, 3])
# fs.add(4)  # Error! Immutable
print(f"frozenset:    {fs}")

# Can use as dict key (set can't)
cache = {frozenset({"a", "b"}): "result1"}
print(f"As dict key:  {cache}")
```

    === Creation ===
    nums:         {1, 2, 3, 4, 5}
    from_list:    {1, 2, 3}
    from_str:     {'c', 'r', 'd', 'b', 'a'}
    comprehension:{0, 1, 4, 9, 16}
    
    === Adding / Removing ===
    After adds:   {1, 2, 3, 4, 5, 6, 7}
    After removes:{2, 3, 4, 5, 6}
    
    === Set Operations ===
    a:              {1, 2, 3, 4, 5}
    b:              {4, 5, 6, 7, 8}
    union |:        {1, 2, 3, 4, 5, 6, 7, 8}
    intersection &: {4, 5}
    difference -:   {1, 2, 3}
    symmetric ^:    {1, 2, 3, 6, 7, 8}
    {1,2} <= a:    {1, 2} is subset: True
    a >= {1,2}:    a is superset: True
    a.isdisjoint(b): True
    
    === DE Use Case: Dataset Comparison ===
    In prod only:      {'P001', 'P004'}
    In warehouse only: {'P005'}
    In both:           {'P002', 'P003'}
    All unique:        {'P002', 'P004', 'P005', 'P001', 'P003'}
    
    === frozenset (immutable set) ===
    frozenset:    frozenset({1, 2, 3})
    As dict key:  {frozenset({'b', 'a'}): 'result1'}
    

## 4. Tuples & Enums


```python
# Tuples & Enums
#
# KEY CONCEPTS:
# - tuple: ordered, IMMUTABLE sequence. Once created, can't add/remove/change elements.
#   C# has ValueTuple (value type) and Tuple (reference type, legacy).
# - namedtuple: tuple with named fields — like a lightweight immutable class.
#   C# equivalent: named ValueTuple or record struct.
# - Enum: a set of named constants representing a fixed set of values.
#   Useful for states, categories, options — prevents "magic strings/numbers" in code.
# - Why immutable? Tuples can be dict keys, set elements, and function return values
#   because they're hashable. Lists can't be used as dict keys (mutable = unhashable).

# === Tuple ===
print("=== Tuple ===")
empty = ()
single = (42,)                          # trailing comma required for single element!
point = (3, 4)
person = ("Alice", 30, "NYC")
nested = ((1, 2), (3, 4))

print(f"point:    {point}")
print(f"point[0]: {point[0]}")
print(f"person:   {person}")
# point[0] = 99  # TypeError! Immutable

# Tuple unpacking
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

# === namedtuple — tuple with names ===
print("\n=== namedtuple ===")
from collections import namedtuple

Point = namedtuple("Point", ["x", "y"])
p = Point(3, 4)
print(f"p.x={p.x}, p.y={p.y}")
print(f"p[0]={p[0]}")                   # still supports index access
print(f"_asdict: {p._asdict()}")        # convert to dict

# Can't modify (immutable)
# p.x = 10  # AttributeError!

# _replace creates a NEW tuple with changed values
p2 = p._replace(x=10)
print(f"_replace: {p2}")

# === NamedTuple with types (modern style) ===
from typing import NamedTuple

class Employee(NamedTuple):
    name: str
    department: str
    salary: float

emp = Employee("Alice", "Engineering", 95000)
print(f"\nEmployee: {emp}")
print(f"  name: {emp.name}, salary: ${emp.salary:,.0f}")

# === Enum ===
print("\n=== Enum ===")
from enum import Enum, IntEnum, auto

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

# Iterate over enum
for color in Color:
    print(f"  {color.name} = {color.value}")

# Comparison
print(f"RED == RED: {Color.RED == Color.RED}")
print(f"RED == 1:   {Color.RED == 1}")          # False! Enum != int

# IntEnum — comparable to int
class Priority(IntEnum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3

print(f"\nPriority.HIGH > Priority.LOW: {Priority.HIGH > Priority.LOW}")
print(f"Priority.HIGH == 3: {Priority.HIGH == 3}")   # True! IntEnum == int

# === DE use case: status tracking ===
print("\n=== DE Use Case: Pipeline Status ===")
class PipelineStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"

status = PipelineStatus.RUNNING
if status == PipelineStatus.RUNNING:
    print(f"Pipeline is {status.value}...")
```

    === Tuple ===
    point:    (3, 4)
    point[0]: 3
    person:   ('Alice', 30, 'NYC')
    Unpacked: x=3, y=4
    Unpacked: name=Alice, age=30
    Swapped:  a=2, b=1
    first=1, last=5
    
    === namedtuple ===
    p.x=3, p.y=4
    p[0]=3
    _asdict: {'x': 3, 'y': 4}
    _replace: Point(x=10, y=4)
    
    Employee: Employee(name='Alice', department='Engineering', salary=95000)
      name: Alice, salary: $95,000
    
    === Enum ===
    Color.RED:       Color.RED
    Color.RED.name:  RED
    Color.RED.value: 1
    Color(2):        Color.GREEN
    Color['BLUE']:   Color.BLUE
      RED = 1
      GREEN = 2
      BLUE = 3
    RED == RED: True
    RED == 1:   False
    
    Priority.HIGH > Priority.LOW: True
    Priority.HIGH == 3: True
    
    === DE Use Case: Pipeline Status ===
    Pipeline is running...
    

## 5. Stacks, Queues & Deques


```python
# Stacks, Queues & Deques
#
# KEY CONCEPTS:
# - Stack (LIFO): Last In, First Out. Like a stack of plates — you add/remove from the top.
#   Python: use list (append/pop) or collections.deque.
#   C#: Stack<T>.
# - Queue (FIFO): First In, First Out. Like a line at a store — first person served first.
#   Python: collections.deque (NOT list — list.pop(0) is O(n), deque.popleft() is O(1)).
#   C#: Queue<T>.
# - Deque (double-ended queue): efficiently add/remove from BOTH ends.
#   Python: collections.deque. C#: no built-in (use LinkedList or third-party).
# - Priority Queue: items come out in priority order, not insertion order.
#   Python: heapq module. C#: PriorityQueue<T, TPriority>.

from collections import deque

# === Stack (LIFO) — use list or deque ===
print("=== Stack (LIFO) ===")
stack = []
stack.append("first")       # push
stack.append("second")
stack.append("third")
print(f"Stack: {stack}")
print(f"Pop:   {stack.pop()}")     # "third" (last in, first out)
print(f"Pop:   {stack.pop()}")     # "second"
print(f"Peek:  {stack[-1]}")       # look at top without removing

# === Queue (FIFO) — use deque, NOT list ===
print("\n=== Queue (FIFO) ===")
queue = deque()
queue.append("first")       # enqueue (add to right)
queue.append("second")
queue.append("third")
print(f"Queue:    {list(queue)}")
print(f"Dequeue:  {queue.popleft()}")   # "first" (first in, first out)
print(f"Dequeue:  {queue.popleft()}")   # "second"
print(f"Peek:     {queue[0]}")          # look at front without removing

# === Deque — acts as BOTH stack and queue depending on methods used ===
# As QUEUE (FIFO): append() + popleft()  → first in, first out
# As STACK (LIFO): append() + pop()      → last in, first out
# Full deque:      appendleft()/append() + popleft()/pop()  → both ends
print("\n=== Deque (double-ended) ===")
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

# Max length (auto-discards from opposite end)
d = deque(maxlen=3)          # fixed-size buffer
d.append(1); d.append(2); d.append(3);
d.append(4)                 # [2, 3, 4] — 1 was auto-removed
print(f"maxlen=3:  {list(d)}")

# === Priority Queue (heap) ===
print("\n=== Priority Queue (heapq) ===")
import heapq

# heapq works on a regular list — always keeps smallest on top
pq = []
heapq.heappush(pq, (3, "low priority"))
heapq.heappush(pq, (1, "high priority"))
heapq.heappush(pq, (2, "medium priority"))

print(f"Heap:    {pq}")
print(f"Pop:     {heapq.heappop(pq)}")     # (1, "high priority") — smallest first
print(f"Pop:     {heapq.heappop(pq)}")     # (2, "medium priority")

# === DE use case: task queue ===
print("\n=== DE Use Case: Task Queue ===")
task_queue = deque()
task_queue.append({"task": "extract", "table": "users"})
task_queue.append({"task": "extract", "table": "orders"})
task_queue.append({"task": "transform", "table": "users"})

while task_queue:
    task = task_queue.popleft()
    print(f"  Processing: {task['task']} {task['table']}")
```

    === Stack (LIFO) ===
    Stack: ['first', 'second', 'third']
    Pop:   third
    Pop:   second
    Peek:  first
    
    === Queue (FIFO) ===
    Queue:    ['first', 'second', 'third']
    Dequeue:  first
    Dequeue:  second
    Peek:     third
    
    === Deque (double-ended) ===
    Deque: [1, 2, 3]
    Rotate(2): [4, 5, 1, 2, 3]
    Rotate(-2):[1, 2, 3, 4, 5]
    maxlen=3:  [2, 3, 4]
    
    === Priority Queue (heapq) ===
    Heap:    [(1, 'high priority'), (3, 'low priority'), (2, 'medium priority')]
    Pop:     (1, 'high priority')
    Pop:     (2, 'medium priority')
    
    === DE Use Case: Task Queue ===
      Processing: extract users
      Processing: extract orders
      Processing: transform users
    

## 6. Collection Comparison & Choosing the Right One


```python
# Collection Comparison — when to use which
#
# Performance characteristics (Big O notation):
#   O(1) = instant regardless of size (dict/set lookup, list append)
#   O(n) = time grows linearly with size (list search, list insert at 0)
#   O(n log n) = sorting

print("=== Python Collection Cheat Sheet ===")
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

print("=== Decision Guide ===")
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

# === Practical: choosing collections for DE tasks ===
print("=== DE Collection Choices ===")
print("ETL records:      list[dict]   or  list[namedtuple]")
print("Config/params:    dict")
print("Deduplication:    set")
print("Lookup table:     dict  (id → record)")
print("Grouping:         defaultdict(list)")
print("Counting:         Counter")
print("Task queue:       deque")
print("Priority tasks:   heapq")
print("Schema fields:    tuple or frozenset (immutable)")
print("Cache key:        tuple or frozenset (hashable)")
```

    === Python Collection Cheat Sheet ===
    
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
    
    === Decision Guide ===
    
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
    
    === DE Collection Choices ===
    ETL records:      list[dict]   or  list[namedtuple]
    Config/params:    dict
    Deduplication:    set
    Lookup table:     dict  (id → record)
    Grouping:         defaultdict(list)
    Counting:         Counter
    Task queue:       deque
    Priority tasks:   heapq
    Schema fields:    tuple or frozenset (immutable)
    Cache key:        tuple or frozenset (hashable)
    
