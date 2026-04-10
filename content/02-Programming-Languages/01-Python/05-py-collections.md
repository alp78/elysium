---
title: "05 - Collections - Python"
tags:
  - python
aliases: [lists, dictionaries, sets, tuples, arrays, List, Dictionary, HashSet, LINQ]
description: "Python collections reference with executable examples and cell outputs — covers lists, dictionaries, sets, tuples, and specialized collections from the collections module. See [05-cs-collections](https://alp78.github.io/elysium/02-Programming-Languages/02-CSharp/05-cs-collections) for the C# equivalent."
parent: "[[domain-language-foundations]]"
links:
  - "[[05-cs-collections]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 05. Collections - Python

> [!quote]
> "Algorithms + Data Structures = Programs."
>
> — **Niklaus Wirth**, *Algorithms + Data Structures = Programs* (1976)
>
> "Smart data structures and dumb code works a lot better than the other way around."
>
> — **Eric S. Raymond**, *The Cathedral and the Bazaar* (1999)

Python's built-in collections span the full spectrum from mutable sequences to immutable records, ordered mappings to hash sets, and specialized structures for queues, stacks, and priority scheduling. This page covers the core types and the `collections` module extensions. Every concept is paired with its C# equivalent in [[05-cs-collections]].

### Key terms used in this note

| Term | Plain-English definition | Why it matters here | Common mistake / confusion |
|---|---|---|---|
| **list** | Ordered, mutable, dynamic-array-backed sequence. Elements accessed by integer index starting at 0. | Default general-purpose container for ordered data. | Using `list` for membership tests — O(n); use `set` for O(1). |
| **dict** | Hash-based key-value mapping with O(1) average lookup. Insertion-ordered since Python 3.7. | The standard way to associate names (keys) with values — config, lookup tables, grouped records. | Bracket access `d[key]` raises `KeyError` if key is missing; use `.get()` for safe access. |
| **set** | Unordered collection of unique hashable elements with O(1) membership testing. | Deduplication and fast `in` checks. | `{}` creates an empty dict, not an empty set — use `set()` for an empty set. |
| **frozenset** | Immutable variant of `set`. Because it is hashable, it can serve as a dict key or element of another set. | Cache keys, compound lookup keys, immutable set algebra. | Trying to `add()` to a frozenset — it has no mutating methods. |
| **tuple** | Ordered, immutable sequence. Hashable if all elements are hashable. | Dict keys, function return values, fixed records. | `(42)` is just grouping parentheses — single-element tuple requires a trailing comma: `(42,)`. |
| **namedtuple** | Tuple subclass with named fields, created via `collections.namedtuple` or `typing.NamedTuple`. | Lightweight immutable record type with dot-access and unpacking. | Mutating namedtuples — they are immutable. Use `_replace()` for non-destructive updates. |
| **defaultdict** | `dict` subclass that auto-creates missing keys using a factory function (e.g., `list`, `int`). | Eliminates the `if key not in d` boilerplate for grouping and counting. | Passing the factory result `defaultdict(list())` instead of the factory itself `defaultdict(list)`. |
| **Counter** | `dict` subclass purpose-built for counting hashable objects. | Frequency tables, top-N queries, histogram data. | `Counter` counts are regular ints — negative counts are allowed and can cause surprises. |
| **deque** | Double-ended queue from `collections`. O(1) append/pop on both ends. | FIFO queues, LIFO stacks, sliding windows, bounded buffers. | Using `list.pop(0)` for queues — O(n) because it shifts every element. Use `deque.popleft()`. |
| **heapq** | Module providing min-heap operations on a regular list. | Priority queues, top-N problems, merge-sorting sorted streams. | `heapq` is a min-heap — for max-heap, negate values. There is no built-in max-heap. |
| **Enum** | Class from the `enum` module defining a closed set of named constants. | Replace magic numbers/strings with type-safe symbolic names. | `Color.RED == 1` is `False` for standard `Enum` — use `IntEnum` when numeric comparison is needed. |
| **IntEnum** | `Enum` subclass whose members are true integers — supports comparison and arithmetic with `int`. | Status codes, priorities, severity levels. | `IntEnum` breaks enum isolation — members compare equal to plain ints, which can mask bugs. |
| **shallow copy** | Copies the outer container but shares references to inner objects. | Fast duplication of flat collections. | Mutating a nested object in the copy also mutates the original — use `copy.deepcopy()` for nested structures. |
| **deep copy** | Recursively copies every nested object, producing a fully independent clone. | Safe duplication of nested or mutable data structures. | Deep copy is slow for large graphs and fails on non-picklable objects (open files, sockets). |
| **O(1) / O(n) / O(log n)** | Big-O notation describing how an operation's cost scales with collection size. O(1) = constant, O(n) = linear, O(log n) = logarithmic. | Choosing the right collection type for the access pattern. | Assuming all collections have the same performance — `list.index()` is O(n), `dict[key]` is O(1). |

### What this note covers

- **Lists** — creation, mutation, search, sort, shallow vs deep copy, stack usage
- **Dictionaries** — creation, safe access, modification, iteration, merging, `defaultdict`, `Counter`
- **Sets** — creation, set algebra (union, intersection, difference), `frozenset`, data comparison patterns
- **Tuples & Enums** — tuple basics, unpacking, `namedtuple`/`NamedTuple`, `Enum`, `IntEnum`, pipeline status
- **Stacks, Queues & Deques** — LIFO/FIFO with `deque`, bounded buffers, priority queue with `heapq`, ETL patterns
- **Collection Comparison** — cheat sheet, decision guide, common data engineering patterns

## Lists (Dynamic Arrays)

Lists are Python's most versatile sequential collection — ordered, mutable, and heterogeneous. Internally backed by a dynamic array that grows by ~12.5% when full, giving amortized O(1) `append` and O(1) indexed access. For O(1) prepend/dequeue, use `collections.deque` instead. This section covers creation, mutation, searching, sorting, copying, and using lists as stacks.

### List creation and mutation

Creating lists, adding/removing elements, and basic indexing operations.

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

> [!success] Best practices
>
> - Use `set` for membership tests when the list may be large
> - Use `deque.appendleft()` for O(1) prepend operations
> - Use a list copy (`lst[:]`) or comprehension when iterating with modifications

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
mixed = [1, "hello", True, 3.14, None]
nested = [[1, 2], [3, 4], [5, 6]]
from_range = list(range(5))
repeated = [0] * 5

print(empty)
print(nums)
print(mixed)
print(nested)
print(from_range)
print(repeated)
print(nums[0])
print(nums[-1])
print(nums[1:4])
print(nums[::-1])
print(nested[1][0])
```

```text
[]
[1, 2, 3, 4, 5]
[1, 'hello', True, 3.14, None]
[[1, 2], [3, 4], [5, 6]]
[0, 1, 2, 3, 4]
[0, 0, 0, 0, 0]
1
5
[2, 3, 4]
[5, 4, 3, 2, 1]
3
```

#### List append, insert, extend, remove, pop — add and remove elements

`append` adds to end. `insert(i, x)` shifts elements right from index `i` (O(n)). `extend` merges another iterable. `remove` deletes the first matching value (O(n) search). `del lst[i]` removes by index. `pop()` removes and returns the last element (O(1)), or `pop(i)` for a specific index (O(n)).

```python
lst = [1, 2, 3]
lst.append(4)
lst.insert(0, 0)
lst.extend([5, 6])
print(lst)

lst = [1, 2, 3, 2, 4, 5]
lst.remove(2)
print(lst)
del lst[0]
print(lst)
last = lst.pop()
print(f"pop():      {lst} (popped: {last})")
lst.clear()
print(lst)
```

```text
[0, 1, 2, 3, 4, 5, 6]
[1, 3, 2, 4, 5]
[3, 2, 4, 5]
'pop():      [3, 2, 4] (popped: 5)'
[]
```

### List search and sorting

Linear search with `in`, `index()`, and `count()`. For frequent membership tests on large data, convert to a `set` first (O(1) vs O(n)). `sorted()` returns a new list; `sort()` mutates in place.

#### List search — in operator, index(), count()

`in` checks membership (O(n)). `index()` returns the position of the first match (raises `ValueError` if missing). `count()` returns the number of occurrences.

```python
lst = [10, 20, 30, 40, 30, 50]
print(30 in lst)
print(99 in lst)
print(lst.index(30))
print(lst.count(30))
```

```text
True
False
2
2
```

#### List sort() and sorted() — in-place vs new list

`sorted()` returns a new list without modifying the original — use it in functional chains. `sort()` mutates in place and returns `None`. Both accept `key=` for custom sort keys and `reverse=True` for descending order.

```python
nums = [3, 1, 4, 1, 5, 9, 2, 6]
print(sorted(nums))
print(nums)
nums.sort()
print(nums)
nums.sort(reverse=True)
print(nums)

words = ["banana", "apple", "cherry"]
print(sorted(words, key=len))
print(sorted(['Banana', 'apple', 'Cherry'], key=str.lower))
```

```text
[1, 1, 2, 3, 4, 5, 6, 9]
[3, 1, 4, 1, 5, 9, 2, 6]
[1, 1, 2, 3, 4, 5, 6, 9]
[9, 6, 5, 4, 3, 2, 1, 1]
['apple', 'banana', 'cherry']
['apple', 'Banana', 'Cherry']
```

#### Copying — shallow vs deep

`list.copy()`, `list(original)`, and `original[:]` all create shallow copies — the outer list is new, but inner objects are shared references. For nested structures (list of lists), mutating an inner object in the copy also changes the original. Use `copy.deepcopy()` for fully independent copies.

> [!danger] Shallow copy trap with nested lists
> `shallow[0][0] = 99` also changes `original[0][0]` because both point to the same inner list object. This is the #1 source of data corruption bugs in ETL code that caches intermediate results.

> [!success] Use deepcopy for nested structures
> `copy.deepcopy(original)` recursively copies every nested object. For flat lists of primitives (`list[int]`, `list[str]`), shallow copy is safe.

```python
original = [[1, 2], [3, 4]]
shallow = original.copy()
shallow[0][0] = 99
print(original)

original = [[1, 2], [3, 4]]
deep = copy.deepcopy(original)
deep[0][0] = 99
print(original)
```

```text
[[99, 2], [3, 4]]
[[1, 2], [3, 4]]
```

#### List as stack — LIFO with append and pop

Python lists work as stacks out of the box — `append()` pushes to the top and `pop()` removes from the top, both O(1).

```python
stack = []
stack.append("a")
stack.append("b")
stack.append("c")
print(stack)
print(stack.pop())
print(stack)
```

```text
['a', 'b', 'c']
'c'
['a', 'b']
```

## Dictionaries

Hash-based key-value mapping with O(1) average lookup, insert, and delete. Insertion-ordered since Python 3.7 (guaranteed by language spec since 3.7, CPython implementation detail since 3.6). Keys must be hashable (immutable types: `str`, `int`, `float`, `tuple`, `frozenset` — NOT `list` or `dict`). `defaultdict` auto-creates missing keys with a factory function; `Counter` is a specialized dict for counting occurrences.

### Dictionary creation and access

Creating dictionaries, reading values safely, and updating entries.

#### Dict creation — literals, dict(), fromkeys, comprehension

Four creation patterns: literal `{k: v}`, `dict()` from a list of pairs or keyword args, `dict.fromkeys(keys, default)` to initialize all keys to the same value, and dict comprehension `{k: expr for k in iter}`.

> [!warning] Anti-patterns
>
> - **Mutable keys** (lists, dicts) — `TypeError`; use tuples instead
> - **Bracket access without checking** — `KeyError`; use `.get()`
> - **`dict` for ordered data** when a list of tuples suffices

> [!success] Best practices
>
> - Use tuples as dict keys when a composite key is needed
> - Use `.get(key, default)` for safe access to optional fields
> - Use a list of tuples `[(k, v)]` when insertion order and simple iteration suffice

```python
empty = {}
person = {"name": "Alice", "age": 30, "city": "NYC"}
from_pairs = dict([("a", 1), ("b", 2)])
from_kwargs = dict(name="Bob", age=25)
from_keys = dict.fromkeys(["x", "y", "z"], 0)
comprehension = {x: x**2 for x in range(5)}

print(person)
print(from_pairs)
print(from_keys)
print(comprehension)
```

```text
{'name': 'Alice', 'age': 30, 'city': 'NYC'}
{'a': 1, 'b': 2}
{'x': 0, 'y': 0, 'z': 0}
{0: 0, 1: 1, 2: 4, 3: 9, 4: 16}
```

#### Dict access — [], .get(), .setdefault(), KeyError

Bracket access (`d[key]`) raises `KeyError` if the key is missing. `.get(key)` returns `None` instead — safer for optional fields. `.get(key, default)` provides a fallback value. `.update()` and `|=` (Python 3.9+) merge multiple key-value pairs at once.

```python
print(person['name'])
print(person.get('name'))
print(person.get('zip', 'N/A'))

person["email"] = "alice@example.com"
person["age"] = 31
person.update({"city": "LA", "zip": "90001"})
person |= {"phone": "555-0123"}
print(person)
```

```text
'Alice'
'Alice'
'N/A'
{'name': 'Alice', 'age': 31, 'city': 'LA', 'email': 'alice@example.com', 'zip': '90001', 'phone': '555-0123'}
```

### Dictionary modification and iteration

Removing entries, iterating key-value pairs, merging dictionaries, and using specialized dict subclasses (`defaultdict`, `Counter`).

#### Dict del, pop, clear — removing and iterating with .items()

`del d[key]` raises `KeyError` if missing. `pop(key)` removes and returns the value (also `KeyError` if missing — use `pop(key, default)` for safe removal). `popitem()` removes the last-inserted pair. The `in` operator checks keys, not values.

```python
d = {"a": 1, "b": 2, "c": 3, "d": 4}
del d["a"]
popped = d.pop("b")
popped_safe = d.pop("z", "default")
last = d.popitem()
print(d)

d = {"name": "Alice", "age": 30, "city": "NYC"}
for key in d:
    print(f"  key: {key}")
for key, value in d.items():
    print(f"  {key}: {value}")
for value in d.values():
    print(f"  value: {value}")

print('name' in d)
print('Alice' in d)
print(len(d))
```

```text
{'c': 3}
  key: name
  key: age
  key: city
  name: Alice
  age: 30
  city: NYC
  value: Alice
  value: 30
  value: NYC
True
False
3
```

#### Dict merging — | operator, .update(), **unpacking

Three ways to merge: `{**a, **b}` (unpacking, all Python 3), `a | b` (Python 3.9+, returns new dict), and `a |= b` (Python 3.9+, in-place update). When keys conflict, the right operand wins.

```python
a = {"x": 1, "y": 2}
b = {"y": 3, "z": 4}
merged = {**a, **b}
merged2 = a | b
print(merged)
```

```text
{'x': 1, 'y': 3, 'z': 4}
```

#### defaultdict and Counter

A `defaultdict` is a dictionary subclass that automatically creates missing keys with a factory function. `defaultdict(list)` creates an empty list for any new key, eliminating the `if key not in d: d[key] = []` pattern. Essential for grouping operations. `Counter` is a dictionary subclass for counting hashable objects. `Counter(items)` builds a frequency table. Supports arithmetic: `counter_a - counter_b` gives the difference in counts.

`defaultdict(list)` creates an empty list for any new key on first access, eliminating the `if key not in d: d[key] = []` boilerplate. Essential for grouping operations in ETL code.

```python
words = ["apple", "banana", "avocado", "cherry", "blueberry"]
groups = defaultdict(list)
for word in words:
    groups[word[0]].append(word)
print(dict(groups))
```

```text
{'a': ['apple', 'avocado'], 'b': ['banana', 'blueberry'], 'c': ['cherry']}
```

#### Count occurrences

`defaultdict(int)` initializes missing keys to 0 — useful for manual counting. `Counter` is a dict subclass purpose-built for counting hashable objects. `most_common(n)` returns the top N by frequency. `total()` sums all counts.

```python
counts = defaultdict(int)
for word in words:
    counts[word[0]] += 1
print(dict(counts))

text = "abracadabra"
c = Counter(text)
print(c)
print(c.most_common(3))
print(c.total())
```

```text
{'a': 2, 'b': 2, 'c': 1}
Counter({'a': 5, 'b': 2, 'r': 2, 'c': 1, 'd': 1})
[('a', 5), ('b', 2), ('r', 2)]
11
```

## Sets

Sets store unique hashable elements with O(1) membership testing, deduplication, and set algebra. Python provides `set` (mutable) and `frozenset` (immutable — can be used as dict keys or set elements). Set operations use both method syntax (`a.union(b)`) and operator syntax (`a | b`). Empty set must use `set()` because `{}` creates an empty dict.

### Set operations

Creating sets, adding/removing elements, and performing set algebra (union, intersection, difference, symmetric difference).

#### Set creation — literals, set(), frozenset

Creating sets from literals `{1, 2, 3}`, the `set()` constructor, iterables, strings, and set comprehensions. Use `set()` for an empty set — `{}` creates an empty dict, not an empty set.

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

> [!success] Best practices
>
> - Use `set` (or `set(list)`) for deduplication and O(1) membership tests
> - Use `frozenset` or convert to tuples when elements must be hashable
> - Iterate sets only when order is irrelevant; sort explicitly when order matters

```python
empty = set()
nums = {1, 2, 3, 4, 5}
from_list = set([1, 2, 2, 3, 3, 3])
from_str = set("abracadabra")
comprehension = {x**2 for x in range(5)}

print(nums)
print(from_list)
print(from_str)
print(comprehension)
```

```text
{1, 2, 3, 4, 5}
{1, 2, 3}
{'d', 'b', 'r', 'a', 'c'}
{0, 1, 4, 9, 16}
```

#### Set add, remove, discard, pop — modify set elements

`add` inserts one element. `update` adds multiple from an iterable. `remove` raises `KeyError` if missing; `discard` silently ignores missing elements. `pop` removes and returns an arbitrary element.

```python
s = {1, 2, 3}
s.add(4)
s.update([5, 6, 7])
print(s)
s.remove(7)
s.discard(99)
popped = s.pop()
print(s)
```

```text
{1, 2, 3, 4, 5, 6, 7}
{2, 3, 4, 5, 6}
```

#### Set union, intersection, difference, symmetric_difference

`|` (union), `&` (intersection), `-` (difference), `^` (symmetric difference). `<=` and `>=` test subset/superset relationships. `isdisjoint` returns `True` if no elements are shared.

```python
a = {1, 2, 3, 4, 5}
b = {4, 5, 6, 7, 8}

print(a)
print(b)
print(a | b)
print(a & b)
print(a - b)
print(a ^ b)

print({1, 2} <= a)
print(a >= {1, 2})
print(a.isdisjoint({10, 20}))
```

```text
{1, 2, 3, 4, 5}
{4, 5, 6, 7, 8}
{1, 2, 3, 4, 5, 6, 7, 8}
{4, 5}
{1, 2, 3}
{1, 2, 3, 6, 7, 8}
True
True
True
```

#### Set difference for data comparison — find missing and extra items

A practical data engineering pattern — use set difference to find items present in one dataset but missing from another (e.g., unsold products, orphaned foreign keys).

```python
prod_ids = {"P001", "P002", "P003", "P004"}
warehouse_ids = {"P002", "P003", "P005"}

print(prod_ids - warehouse_ids)
print(warehouse_ids - prod_ids)
print(prod_ids & warehouse_ids)
print(prod_ids | warehouse_ids)
```

```text
{'P004', 'P001'}
{'P005'}
{'P003', 'P002'}
{'P005', 'P001', 'P003', 'P002', 'P004'}
```

### frozenset — immutable set

`frozenset` is an immutable variant of `set`. Because it's hashable, it can serve as a dictionary key or an element of another set — regular `set` cannot.

#### frozenset creation and usage

`frozenset` is constructed from any iterable — duplicates are removed. Because it is hashable, it can serve as a dict key or as an element of another `set`, unlike a regular `set`.

```python
fs = frozenset([1, 2, 3])
print(fs)

cache = {frozenset({"a", "b"}): "result1"}
print(cache)
```

```text
frozenset({1, 2, 3})
{frozenset({'b', 'a'}): 'result1'}
```

## Tuples & Enums

Tuples are ordered, immutable sequences — once created, elements cannot be added, removed, or changed. Because they're hashable (if all elements are), tuples can serve as dict keys, set elements, and function return values — lists cannot. `namedtuple` adds named fields for a lightweight immutable class. Enums define named constants with type safety.

### Tuple fundamentals

Tuples are the immutable counterpart to lists. Single-element tuples require a trailing comma: `(1,)` not `(1)` (which is just grouping parentheses). Tuple unpacking allows concise destructuring of return values and swap idioms.

#### Tuple basics

Creating tuples using literal syntax, a single-element form (trailing comma required — `(42)` is just grouping parentheses, not a tuple), nested structures, and accessing elements by index.

```python
empty = ()
single = (42,)
point = (3, 4)
person = ("Alice", 30, "NYC")
nested = ((1, 2), (3, 4))

print(point)
print(point[0])
print(person)
```

```text
(3, 4)
3
('Alice', 30, 'NYC')
```

#### Tuple unpacking

Unpacking destructures tuple elements into separate variables. The swap idiom `a, b = b, a` exchanges values without a temporary. The `*_` syntax captures and discards middle elements.

```python
x, y = point
name, age, city = person
print(f"Unpacked: x={x}, y={y}")
print(f"Unpacked: name={name}, age={age}")

a, b = 1, 2
a, b = b, a
print(f"Swapped:  a={a}, b={b}")

first, *_, last = [1, 2, 3, 4, 5]
print(f"first={first}, last={last}")
```

```text
'Unpacked: x=3, y=4'
'Unpacked: name=Alice, age=30'
'Swapped:  a=2, b=1'
'first=1, last=5'
```

#### namedtuple and NamedTuple

An immutable tuple subclass with named fields. `Point = namedtuple('Point', ['x', 'y'])` creates a lightweight record type. Accessed by name (`p.x`) or index (`p[0]`). Use `typing.NamedTuple` for the type-annotated version.

> [!tip] dataclass vs NamedTuple
>
> Use `@dataclass` when you need mutability, methods, or inheritance. Use `NamedTuple` when you need immutability, tuple unpacking, and minimal memory footprint.

Access by name (`p.x`) or index (`p[0]`). `_asdict()` converts to an `OrderedDict`. `_replace()` creates a new instance with some fields changed (non-destructive).

```python
Point = namedtuple("Point", ["x", "y"])
p = Point(3, 4)
print(f"p.x={p.x}, p.y={p.y}")
print(p[0])
print(p._asdict())
```

```text
'p.x=3, p.y=4'
3
{'x': 3, 'y': 4}
```

#### Tuple immutability — _replace for non-destructive updates

`_replace` returns a new namedtuple with specified fields changed — the original is unchanged. `typing.NamedTuple` provides the same functionality with type annotations.

```python
p2 = p._replace(x=10)
print(p2)

class Employee(NamedTuple):
    name: str
    department: str
    salary: float

emp = Employee("Alice", "Engineering", 95000)
print(emp)
print(f"  name: {emp.name}, salary: ${emp.salary:,.0f}")
```

```text
Point(x=10, y=4)
Employee(name='Alice', department='Engineering', salary=95000)
'  name: Alice, salary: $95,000'
```

### Enum types

Enums define a closed set of named constants. `class Color(Enum): RED = 1` prevents magic numbers scattered through code. Members are accessed by name (`Color.RED`), by value (`Color(1)`), or by string (`Color['RED']`). `auto()` auto-assigns integer values. Enums are iterable and can have custom methods.

#### Enum declaration and access

Each enum member has a `.name` (string) and `.value` (the assigned constant). `auto()` auto-assigns incrementing integers starting from 1. Lookup by value: `Color(2)`. Lookup by name: `Color['BLUE']`.

```python
class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3

class Direction(Enum):
    NORTH = auto()
    SOUTH = auto()
    EAST = auto()
    WEST = auto()

print(Color.RED)
print(Color.RED.name)
print(Color.RED.value)
print(Color(2))
print(Color['BLUE'])
```

```text
<Color.RED: 1>
'RED'
1
<Color.GREEN: 2>
<Color.BLUE: 3>
```

#### Iterating over enum

Iterating over an enum yields each member in declaration order.

```python
for color in Color:
    print(f"  {color.name} = {color.value}")
```

```text
  RED = 1
  GREEN = 2
  BLUE = 3
```

#### Enum comparison — identity vs value

Standard `Enum` members compare by identity, not by value. `Color.RED == 1` is `False` because an Enum member is not an integer. Use `IntEnum` when integer comparison is needed.

```python
print(Color.RED == Color.RED)
print(Color.RED == 1)
```

```text
True
False
```

#### IntEnum and pipeline status

`IntEnum` members are true integers — they support comparison, arithmetic, and equality with `int`. Use `IntEnum` for status codes and priorities where numeric comparison is meaningful. String-valued enums (like `PipelineStatus`) are useful for database values and API responses.

```python
class Priority(IntEnum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3

print(Priority.HIGH > Priority.LOW)
print(Priority.HIGH == 3)

class PipelineStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"

status = PipelineStatus.RUNNING
if status == PipelineStatus.RUNNING:
    print(f"Pipeline is {status.value}...")
```

```text
True
True
Pipeline is running...
```

## Stacks, Queues & Deques

Each data structure enforces a specific access pattern:

- **Stack (LIFO):** Last In, First Out — use `list` with `append()`/`pop()`, or `collections.deque`. Use cases: DFS, undo history, backtracking.
- **Queue (FIFO):** First In, First Out — use `collections.deque` with `append()`/`popleft()`. Use cases: BFS, task processing.
- **Deque:** Double-ended queue — efficiently add/remove from both ends in O(1). Use cases: sliding windows, both-ends access.
- **Priority Queue:** Items come out in priority order, not insertion order — use the `heapq` module.

### Stack and Queue

Stack (LIFO) uses `append`/`pop`. Queue (FIFO) uses `deque` with `append`/`popleft`. Both are O(1) operations on `deque`.

> [!warning] List as queue is O(n)
>
> `list.pop(0)` shifts every element left. For queues, use `collections.deque` which is O(1) for both ends.

> [!success] Prefer deque.popleft() for queues
>
> `deque.popleft()` is O(1) and semantically correct. Initialize with `deque()` and use `append`/`popleft` to express FIFO intent clearly.

#### collections.deque — Stack (LIFO) with append and pop

`deque` (double-ended queue) provides O(1) append and pop from both ends. For LIFO stacks, use `append` and `pop`. Peek at the top with `stack[-1]`.

```python
stack = []
stack.append("first")
stack.append("second")
stack.append("third")
print(stack)
print(stack.pop())
print(stack.pop())
print(stack[-1])
```

```text
['first', 'second', 'third']
'third'
'second'
'first'
```

#### collections.deque — Queue (FIFO) with append and popleft

For FIFO queues, use `append` (enqueue to right) and `popleft` (dequeue from left). Peek at the front with `queue[0]`.

```python
queue = deque()
queue.append("first")
queue.append("second")
queue.append("third")
print(list(queue))
print(queue.popleft())
print(queue.popleft())
print(queue[0])
```

```text
['first', 'second', 'third']
'first'
'second'
'third'
```

### Deque operations

`deque` supports O(1) operations on both ends: `append`/`pop` (right), `appendleft`/`popleft` (left). `rotate(n)` shifts elements circularly — positive rotates right, negative rotates left.

#### deque — double-ended queue

`append`/`pop` target the right end; `appendleft`/`popleft` target the left — all O(1). `rotate(n)` shifts all elements circularly: positive n rotates right, negative n rotates left.

```python
d = deque([1, 2, 3])
d.append(4)
d.appendleft(0)
d.pop()
d.popleft()
print(list(d))

d = deque([1, 2, 3, 4, 5])
d.rotate(2)
print(list(d))
d.rotate(-2)
print(list(d))
```

```text
[1, 2, 3]
[4, 5, 1, 2, 3]
[1, 2, 3, 4, 5]
```

#### deque with maxlen

`maxlen` creates a bounded deque that automatically drops the oldest element when a new one is appended beyond capacity. Useful for sliding windows and fixed-size buffers.

```python
d = deque(maxlen=3)
d.append(1); d.append(2); d.append(3);
d.append(4)
print(list(d))
```

```text
[2, 3, 4]
```

### Priority queue and ETL patterns

`heapq` provides a min-heap implementation using a regular list. `heappush` adds items maintaining heap order; `heappop` removes the smallest. Use for top-N queries, task scheduling, and merge-sorting multiple sorted streams. For max-heap, negate the values.

#### Priority queue — heapq

`heapq` operates on a regular list, maintaining the min-heap invariant. Elements are tuples where the first element is the priority (lower = higher priority). For max-heap behavior, negate the priority values.

```python
pq = []
heapq.heappush(pq, (3, "low priority"))
heapq.heappush(pq, (1, "high priority"))
heapq.heappush(pq, (2, "medium priority"))

print(pq)
print(heapq.heappop(pq))
print(heapq.heappop(pq))
```

```text
[(1, 'high priority'), (3, 'low priority'), (2, 'medium priority')]
(1, 'high priority')
(2, 'medium priority')
```

#### ETL task queue — FIFO processing pattern

A practical data engineering pattern — model extract/transform/load steps as a FIFO deque. Each job is dequeued and processed in submission order.

```python
task_queue = deque()
task_queue.append({"task": "extract", "table": "users"})
task_queue.append({"task": "extract", "table": "orders"})
task_queue.append({"task": "transform", "table": "users"})

while task_queue:
    task = task_queue.popleft()
    print(f"  Processing: {task['task']} {task['table']}")
```

```text
  Processing: extract users
  Processing: extract orders
  Processing: transform users
```

## Collection Comparison & Choosing the Right One

Choosing the right collection type depends on access pattern, ordering requirements, uniqueness constraints, and performance characteristics. This section provides a quick-reference comparison table and a decision guide for common data engineering scenarios.

### Collection comparison tables

#### Collection cheat sheet

| Collection | Ordered | Mutable | Duplicates | Lookup | Use When |
|---|---|---|---|---|---|
| `list` | Yes | Yes | Yes | O(n) | General purpose, ordered data |
| `tuple` | Yes | No | Yes | O(n) | Immutable data, dict keys, returns |
| `dict` | Yes\* | Yes | Keys: No | O(1) | Key-value mapping, config, lookup |
| `set` | No | Yes | No | O(1) | Unique elements, membership test |
| `frozenset` | No | No | No | O(1) | Immutable set, dict keys |
| `deque` | Yes | Yes | Yes | O(n) | Queue/stack, fast append/pop both ends |
| `namedtuple` | Yes | No | Yes | O(n) | Lightweight records with named fields |
| `defaultdict` | Yes\* | Yes | Keys: No | O(1) | Grouping, counting (auto-create keys) |
| `Counter` | Yes\* | Yes | Keys: No | O(1) | Counting occurrences |
| `heapq` | Partial | Yes | Yes | O(log n) | Priority queue, top-N problems |

\* `dict`, `defaultdict`, and `Counter` are insertion-ordered since Python 3.7

#### Decision guide

> [!question] Which collection type should I use?
>
> **Need ordered items?**
> - Need to modify? → `list`
> - Immutable? → `tuple`
>
> **Need key-value pairs?**
> - Auto-create missing keys? → `defaultdict`
> - Count things? → `Counter`
> - General mapping? → `dict`
>
> **Need unique elements?**
> - Need to modify? → `set`
> - Need as dict key? → `frozenset`
>
> **Need FIFO queue?** → `deque`
> **Need LIFO stack?** → `list` (or `deque`)
> **Need priority ordering?** → `heapq`
> **Need fast middle insert?** → use a database — no Python collection handles this efficiently

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

## Warnings

> [!warning] Mutable default arguments in collection-building functions
>
> `def group(items, result={})` shares one dict across all calls. The default is created once at function definition time, so subsequent calls mutate the same object.

> [!success] Correct pattern
>
> Use `None` sentinel: `def group(items, result=None): result = result if result is not None else {}`.

> [!warning] Shallow copy trap with nested collections
>
> `list.copy()`, `dict.copy()`, and `set.copy()` all create shallow copies. Inner mutable objects (lists, dicts) are shared between original and copy — mutating one mutates the other.

> [!success] Correct pattern
>
> Use `copy.deepcopy(original)` when the collection contains nested mutable objects. For flat collections of primitives (`list[int]`, `dict[str, str]`), shallow copy is safe.

> [!warning] `list.pop(0)` is O(n)
>
> Every call shifts all remaining elements left. In a loop processing thousands of items, this turns a queue into an O(n²) operation.

> [!success] Correct pattern
>
> Use `collections.deque` with `popleft()` for O(1) FIFO operations.

> [!warning] `defaultdict` silently creates keys on read access
>
> `dd["missing_key"]` inserts the key with the factory default — even if you only intended to check whether it exists. This inflates the dict and can mask bugs.

> [!success] Correct pattern
>
> Use `key in dd` to check existence, or `.get(key, default)` for safe reads without side effects.

> [!warning] Set iteration order is not guaranteed
>
> `set` and `frozenset` have no guaranteed iteration order. Code that depends on element ordering will produce different results across runs or Python versions.

> [!success] Correct pattern
>
> Sort explicitly with `sorted(my_set)` when order matters. Use `list` or `tuple` when insertion order must be preserved.

## Recommendations

- **Choose collections by access pattern, not habit** — use the decision guide above. `list` for ordered data, `dict` for keyed lookup, `set` for uniqueness/membership, `deque` for queue/stack.
- **Pre-size when possible** — for large datasets, `[None] * n` or `dict.fromkeys(keys)` avoids incremental resize overhead.
- **Use `Counter` for counting** — it is purpose-built, handles `most_common(n)`, arithmetic, and zero defaults.
- **Use `defaultdict(list)` for grouping** — eliminates the `if key not in d` boilerplate and reads cleanly.
- **Use `frozenset` for compound dict keys** — when a key is a combination of values (e.g., a set of tags), `frozenset` is the hashable choice.
- **Use `namedtuple` or `NamedTuple` for lightweight records** — they are immutable, unpackable, and memory-efficient. Use `@dataclass` only when you need mutability or methods.
- **Use `heapq` for top-N problems** — `heapq.nsmallest(n, data)` and `heapq.nlargest(n, data)` are more efficient than sorting the entire dataset.
- **Avoid `dict` as a poor man's object** — if the same set of keys repeats across thousands of records, use a `namedtuple`, `dataclass`, or typed `dict` (`TypedDict`) instead.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `KeyError` on dict access | Key doesn't exist; used `d[key]` instead of `.get()` | Use `d.get(key, default)` or `key in d` check |
| `TypeError: unhashable type: 'list'` | Tried to use a list as a dict key or set element | Convert to `tuple` or `frozenset` |
| `ValueError: x is not in list` | Called `list.index(x)` for a missing element | Check `x in lst` before calling `.index()` |
| All closures/lambdas return same value | Late-binding loop variable captured by reference | Bind via default arg: `lambda i=i: i` |
| `set()` vs `{}` confusion | `{}` creates an empty dict, not an empty set | Use `set()` for empty sets |
| `defaultdict` has unexpected keys | Read access auto-creates keys via the factory function | Use `key in dd` or `.get()` for non-mutating lookups |
| Shallow copy mutates original | Inner mutable objects are shared references | Use `copy.deepcopy()` for nested structures |
| `heapq` gives wrong order | `heapq` is a min-heap — smallest first | Negate values for max-heap: `heappush(h, (-priority, item))` |
| `Counter` total doesn't match data | Negative counts from subtraction or manual assignment | Use `+counter` to strip zero/negative counts |
| `deque` loses oldest items | `maxlen` silently drops elements when full | Expected behavior for bounded buffers — check `maxlen` value |

## Cross-References

- **C# equivalent** — [[05-cs-collections]] covers `List<T>`, `Dictionary`, `HashSet`, arrays, `Span<T>`, `Stack<T>`, `Queue<T>`, `PriorityQueue`
- **Strings** — [[02-py-strings]] covers string methods, formatting, and regex — strings are immutable sequences
- **Control flow** — [[03-py-control-flow]] covers comprehensions (`[x for x in lst]`) as the idiomatic way to build and filter collections
- **Functions** — [[04-py-functions]] covers `map`/`filter`/`reduce` and `functools` tools that operate on collections
- **OOP** — [[06-py-oop]] covers `@dataclass` as a mutable alternative to `namedtuple`
