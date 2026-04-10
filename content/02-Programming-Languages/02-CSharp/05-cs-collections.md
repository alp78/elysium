---
title: "05 - Collections - C#"
tags:
  - csharp
aliases: [lists, dictionaries, sets, tuples, arrays, List, Dictionary, HashSet, LINQ]
description: "C# collections reference with executable examples and cell outputs — covers List, Dictionary, HashSet, arrays, Queue, Stack, and immutable collections. See [05-py-collections](https://alp78.github.io/elysium/02-Programming-Languages/01-Python/05-py-collections) for the Python equivalent."
parent: "[[domain-language-foundations]]"
links:
  - "[[05-py-collections]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 05. Collections - C#

> [!quote]
> "Algorithms + Data Structures = Programs."
>
> — **Niklaus Wirth**, *Algorithms + Data Structures = Programs* (1976)
>
> "Smart data structures and dumb code works a lot better than the other way around."
>
> — **Eric S. Raymond**, *The Cathedral and the Bazaar* (1999)

C# collections cover fixed arrays, dynamic lists, dictionaries, sets, tuples, enums, and specialised structures. This page covers all core types with executable examples — from `T[]` and `List<T>` through `Span<T>`, `Dictionary`, `HashSet`, and `PriorityQueue`. Every concept is paired with its Python equivalent in [[05-py-collections]].

### Key terms used in this note

| Term | Plain-English definition | Why it matters here | Common mistake / confusion |
|---|---|---|---|
| **T[]** (array) | Fixed-size, contiguous block of memory holding elements of type `T`. Fastest indexed access due to cache locality. | Interop buffers, fixed-size data, performance-critical paths. | Arrays cannot grow — `Array.Resize` allocates a new array and copies. Use `List<T>` for dynamic sizing. |
| **List&lt;T&gt;** | Dynamically-sized generic collection backed by an internal array that doubles capacity on overflow. | Default choice for ordered, mutable collections (~95% of use cases). | Capacity doubling causes memory spikes on large lists — pre-allocate with `new List<T>(capacity)` when size is known. |
| **Dictionary&lt;TKey, TValue&gt;** | Hash-based key-value mapping with O(1) average lookup, insert, and delete. | The standard way to associate keys with values — config, lookup tables, grouped records. | Bracket access `d[key]` throws `KeyNotFoundException` if key is missing; use `TryGetValue` for safe access. |
| **HashSet&lt;T&gt;** | Unordered collection of unique elements with O(1) add, remove, and membership testing. | Deduplication and fast `Contains` checks. | Set algebra methods (`UnionWith`, `ExceptWith`) mutate the set in-place — copy first to preserve the original. |
| **SortedDictionary&lt;K,V&gt;** | Dictionary that maintains keys in sorted order using a red-black tree. O(log n) operations. | Ordered key iteration without manual sorting. | Slower than `Dictionary` for pure lookup — use only when sorted key order is actually needed. |
| **SortedSet&lt;T&gt;** | Set that maintains elements in sorted order via a red-black tree. O(log n) operations. | Range queries (`GetViewBetween`), ordered unique elements. | Slower than `HashSet` for pure membership tests — use only when sorted iteration is needed. |
| **Span&lt;T&gt;** | Stack-only, zero-allocation view (slice) into contiguous memory — arrays, `stackalloc`, or native buffers. | Parsers, serializers, and hot loops where heap allocation is unacceptable. | `Span<T>` is a `ref struct` — cannot be stored in fields, used in `async` methods, or captured by closures. Use `Memory<T>` instead. |
| **Memory&lt;T&gt;** | Heap-safe counterpart to `Span<T>` — can be stored in fields and passed to async methods. | Slicing across async boundaries, storing slices in collections. | Slightly more overhead than `Span<T>` — use `Span<T>` when stack-only is acceptable. |
| **ReadOnlySpan&lt;T&gt;** | Immutable view into contiguous memory. `ReadOnlySpan<char>` provides zero-allocation substring views. | High-throughput text parsing without `Substring()` heap allocation. | Read-only — cannot modify the underlying data. |
| **ValueTuple** | Lightweight value type with optional named fields — stack-allocated, compared by value. | Quick return types, local grouping, deconstruction. | For public APIs with 3+ fields, prefer a `record` — tuples lack documentation and discoverability. |
| **enum** | Named integer constants defining a closed set of values. Members auto-increment from 0 unless explicitly assigned. | Replace magic numbers with type-safe symbolic names for status codes, flags, options. | Casting an arbitrary int to an enum compiles but may produce an undefined member — use `Enum.IsDefined()` to validate. |
| **Stack&lt;T&gt;** | LIFO (Last In, First Out) collection. `Push`/`Pop`/`Peek` are all O(1). | Undo systems, DFS, expression evaluation, backtracking. | `Pop()` throws `InvalidOperationException` on empty stack — use `TryPop()` for safe access. |
| **Queue&lt;T&gt;** | FIFO (First In, First Out) collection. `Enqueue`/`Dequeue`/`Peek` are all O(1). | Task queues, BFS, ETL pipelines, message processing. | `Dequeue()` throws on empty queue — use `TryDequeue()` for safe access. |
| **PriorityQueue&lt;T, TPriority&gt;** | Min-heap that dequeues the element with the lowest priority value first (.NET 6+). | Task scheduling, top-N queries, shortest-path algorithms. | No built-in way to update priorities — remove and re-insert. Not available before .NET 6. |
| **LinkedList&lt;T&gt;** | Doubly-linked list with O(1) insert/remove at any node (given a reference). | Frequent insertions/removals at arbitrary positions. | O(n) indexed access — do not use for random-access patterns. |
| **ImmutableHashSet&lt;T&gt;** | Thread-safe, immutable set from `System.Collections.Immutable`. Mutations return new instances. | Concurrent reads without locking, functional patterns. | Every mutation allocates a new collection — not suitable for high-frequency writes. |
| **FrozenDictionary / FrozenSet** | Build-once, read-many collections from `System.Collections.Frozen` (.NET 8+). Optimized hash strategy at creation. | Static lookup tables, configuration caches, reference data loaded at startup. | Only available in .NET 8+ — not a drop-in for older frameworks. |
| **O(1) / O(n) / O(log n)** | Big-O notation describing how an operation's cost scales with collection size. O(1) = constant, O(n) = linear, O(log n) = logarithmic. | Choosing the right collection type for the access pattern. | Assuming all collections have the same performance — `List.Contains` is O(n), `HashSet.Contains` is O(1). |

### What this note covers

- **Arrays and Lists** — `T[]`, `List<T>`, search, sort, shallow/deep copy, range/index operators, `Span<T>`, `Memory<T>`, `ReadOnlySpan<char>`
- **Dictionaries** — `Dictionary<K,V>`, safe access patterns, iteration, LINQ filtering/grouping, `SortedDictionary`
- **Sets** — `HashSet<T>`, set algebra (union, intersection, difference), data comparison patterns, `SortedSet<T>`
- **Tuples & Enums** — `ValueTuple`, deconstruction, records as named-tuple alternative, `enum` declaration, switch/parse usage
- **Stacks, Queues & Linked Lists** — `Stack<T>`, `Queue<T>`, `LinkedList<T>`, `PriorityQueue<T,P>`, ETL patterns
- **Collection Comparison** — cheat sheet, decision guide, common data engineering patterns, `FrozenDictionary`/`FrozenSet`

## Arrays and Lists

Arrays and lists are the workhorses of C# data handling. Arrays (`T[]`) offer fixed-size, contiguous memory with the fastest indexed access due to cache locality. `List<T>` wraps an internal array with automatic resizing, making it the default choice for dynamic collections. `Span<T>` and `ReadOnlySpan<T>` provide zero-allocation slicing over contiguous memory for performance-critical paths. This section covers creation, mutation, searching, sorting, slicing, and when to choose each type.

### Array and List fundamentals

Arrays and lists are the two most common sequential collections. Arrays are fixed-size and stack-friendly; lists are dynamically sized and backed by an internal array that doubles capacity on overflow.

#### Array — T[] (fixed size)

Arrays are fixed-size, contiguous memory with O(1) index access — the fastest collection type due to cache locality. Size is set at creation and cannot be changed. Four creation syntaxes: collection literal (`{ ... }`), zero-initialised with `new int[n]` (defaults every element to `0`), range via `Enumerable.Range().ToArray()`, and element-type-inferred with `new[] { ... }`. For dynamic sizing, use `List<T>` instead.

> [!warning] Anti-patterns
>
> - **`Array.Resize`** creates a new array and copies — it's not in-place
> - **Resizing arrays manually** — use `List<T>` for dynamic collections

> [!success] Correct patterns
>
> - Use `List<T>` whenever size is dynamic; reserve arrays for fixed buffers, interop, or performance-critical paths
> - Pre-allocate with `new T[n]` when size is known upfront to avoid resize overhead

```csharp
int[] nums = { 1, 2, 3, 4, 5 };
int[] zeros = new int[5];
int[] ranged = Enumerable.Range(0, 5).ToArray();
string[] words = new[] { "hello", "world" };

Console.WriteLine(string.Join(", ", nums));
Console.WriteLine(string.Join(", ", zeros));
Console.WriteLine(string.Join(", ", ranged));
Console.WriteLine(nums.Length);

Console.WriteLine(nums[0]);
Console.WriteLine(nums[^1]);
Console.WriteLine(string.Join(", ", nums[1..4]));
```

> [!info] Arrays Are Fixed Size
> Arrays have no `Add()` or `Remove()`. Use `List<T>` for resizable collections.

```text
[1, 2, 3, 4, 5]
[0, 0, 0, 0, 0]
[0, 1, 2, 3, 4]
5
1
5
[2, 3, 4]
```

#### List&lt;T&gt; — adding and removing

`List<T>` is C#'s resizable array — the most commonly used collection. Unlike a fixed-size array, a List grows automatically as you add elements. Internally it's backed by an array that doubles in capacity when full, making `Add()` amortized O(1) but occasionally causing a full copy.

> [!warning] Lists Are Single-Type
> `List<T>` holds one type only. `List<object>` allows mixed types but loses type safety — avoid in production code.

> [!success] Use generics for type safety
> Model mixed-type data with a strongly typed `record` or class rather than `List<object>`. This preserves IntelliSense, compile-time checks, and serialization compatibility.

> [!warning] List capacity doubling
> When a List exceeds its internal capacity, it allocates a new array twice the size and copies all elements. For large lists (millions of items), this causes memory spikes and GC pressure. If you know the final size, set it upfront: `new List<T>(capacity: 1_000_000)`.

> [!success] Pre-size large lists
> Always specify `new List<T>(capacity: n)` when loading large datasets (e.g., from a database or file). This eliminates resize copies and reduces GC pressure significantly.

```csharp
var empty = new List<int>();
var list = new List<int> { 1, 2, 3, 4, 5 };
Console.WriteLine(string.Join(", ", list));
Console.WriteLine(list.Count);

var lst = new List<int> { 1, 2, 3 };
lst.Add(4);
lst.Insert(0, 0);
lst.AddRange(new[] { 5, 6 });
Console.WriteLine(string.Join(", ", lst));

lst = new List<int> { 1, 2, 3, 2, 4, 5 };
lst.Remove(2);
Console.WriteLine(string.Join(", ", lst));
lst.RemoveAt(0);
Console.WriteLine(string.Join(", ", lst));
int last = lst[^1]; lst.RemoveAt(lst.Count - 1);
Console.WriteLine($"Pop last:   [{string.Join(", ", lst)}] (popped: {last})");
lst.Clear();
Console.WriteLine(string.Join(", ", lst));
```

```text
[1, 2, 3, 4, 5]
5
[0, 1, 2, 3, 4, 5, 6]
[1, 3, 2, 4, 5]
[3, 2, 4, 5]
Pop last:   [3, 2, 4] (popped: 5)
[]
```

### List search and sorting

Lists support linear search methods (`Contains`, `IndexOf`, `Find`, `Exists`) and both in-place (`Sort`) and non-mutating (`OrderBy`) sorting. For frequent membership checks, consider `HashSet<T>` (O(1)) instead of `List.Contains` (O(n)).

#### List Contains, IndexOf, Find, Exists — search and membership

These methods search a List linearly (O(n)) — they check each element until a match is found. For frequent lookups, use a `HashSet<T>` (O(1)) or `Dictionary<TKey, TValue>` instead.

```csharp
lst = new List<int> { 10, 20, 30, 40, 30, 50 };
Console.WriteLine(lst.Contains(30));
Console.WriteLine(lst.IndexOf(30));
Console.WriteLine(string.Join(", ", lst.FindAll(x => x > 25)));
Console.WriteLine(lst.Exists(x => x > 40));
Console.WriteLine(lst.Find(x => x > 25));
```

```text
True
2
[30, 40, 30, 50]
True
30
```

#### List Sort, OrderBy, ThenBy — sorting and custom comparers

`Sort()` sorts the list in-place (mutates it), while LINQ's `OrderBy()` returns a new sorted sequence without modifying the original. Use `Sort()` when you don't need the original order; use `OrderBy()` in LINQ chains where immutability matters.

`OrderBy` returns a new sorted sequence without modifying the original — use it in LINQ chains where immutability matters. `Sort()` mutates the list in-place and accepts a custom `Comparison<T>` delegate where the comparer returns -1 (left first), 0 (equal), or +1 (right first).

```csharp
var unsorted = new List<int> { 3, 1, 4, 1, 5, 9, 2, 6 };
Console.WriteLine(string.Join(", ", unsorted.OrderBy(x => x)));
Console.WriteLine(string.Join(", ", unsorted));

unsorted.Sort();
Console.WriteLine(string.Join(", ", unsorted));

unsorted.Sort((a, b) => b.CompareTo(a));
Console.WriteLine(string.Join(", ", unsorted));

var wordList = new List<string> { "banana", "apple", "cherry" };
Console.WriteLine(string.Join(", ", wordList.OrderBy(w => w.Length)));
Console.WriteLine(string.Join(", ", wordList.OrderByDescending(w => w.Length)));
Console.WriteLine(string.Join(", ", wordList.OrderByDescending(w => w.Length).ThenBy(w => w)));
```

```text
[1, 1, 2, 3, 4, 5, 6, 9]
[3, 1, 4, 1, 5, 9, 2, 6]
[1, 1, 2, 3, 4, 5, 6, 9]
[9, 6, 5, 4, 3, 2, 1, 1]
[apple, banana, cherry]
[banana, cherry, apple]
[banana, cherry, apple]
```

#### List ToArray, ToList, shallow copy — copying and conversion

These methods create new collections from existing ones. `ToArray()` and `ToList()` produce independent copies of the collection structure, but the elements themselves are NOT cloned — they're shallow copies. Modifying a reference-type element in the copy also modifies it in the original.

> [!danger] Shallow copy trap
> `var copy = original.ToList()` creates a new List, but both lists contain references to the SAME objects. Mutating `copy[0].Name = "changed"` also changes `original[0].Name`. For true independence, you need deep cloning.

> [!success] Deep clone when independence is required
> Use `Select(item => item with { })` (record copy expressions) or implement `ICloneable` to produce a truly independent copy. For value-type collections (`List<int>`, `int[]`) shallow copy is always safe.

Passing a list to the `List<T>` constructor creates a shallow copy. For value types (`int`, `struct`), the copy is fully independent. For reference types, both lists point to the same objects — mutating an element in one mutates it in the other.

```csharp
var original = new List<int> { 1, 2, 3 };
var shallow = new List<int>(original);
shallow[0] = 99;
Console.WriteLine(string.Join(", ", original));

int[] arr = list.ToArray();
var backToList = arr.ToList();
```

```text
[1, 2, 3]
```

### Range, index, and span operators

C# 8+ introduced the `^` (from-end index) and `..` (range) operators for concise slicing. `Span<T>` and `ReadOnlySpan<T>` provide zero-allocation views into contiguous memory — essential for parsers, serializers, and hot loops where heap allocation is unacceptable.

#### Range and Index operators — slicing syntax

The `^` operator indexes from the end (`^1` is the last element). The `..` range operator creates a slice where the start is inclusive and the end is exclusive. Both `Index` and `Range` can be stored in variables and reused.

```csharp
int[] nums = { 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 };

Console.WriteLine(nums[0]);
Console.WriteLine(nums[9]);
Console.WriteLine(nums[^1]);
Console.WriteLine(nums[^2]);
Console.WriteLine(nums[^10]);

Console.WriteLine(string.Join(", ", nums[0..3]));
Console.WriteLine(string.Join(", ", nums[3..7]));
Console.WriteLine(string.Join(", ", nums[..3]));
Console.WriteLine(string.Join(", ", nums[7..]));
Console.WriteLine(string.Join(", ", nums[..]));

Console.WriteLine(string.Join(", ", nums[^3..]));
Console.WriteLine(string.Join(", ", nums[..^3]));
Console.WriteLine(string.Join(", ", nums[^5..^2]));
Console.WriteLine(string.Join(", ", nums[1..^1]));

Index last = ^1;
Range middle = 2..^2;
Console.WriteLine(nums[last]);
Console.WriteLine(string.Join(", ", nums[middle]));
```

```text
10
100
100
90
10
[10, 20, 30]
[40, 50, 60, 70]
[10, 20, 30]
[80, 90, 100]
[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
[80, 90, 100]
[10, 20, 30, 40, 50, 60, 70]
[60, 70, 80]
[20, 30, 40, 50, 60, 70, 80, 90]
100
[30, 40, 50, 60, 70, 80]
```

#### Span&lt;T&gt; — zero-allocation slicing

`Span<T>` is a stack-only view into contiguous memory (arrays, stackalloc, native buffers). It supports slicing with the range operator, in-place `Sort`, `Reverse`, `Fill`, and `CopyTo` — all without heap allocation. Mutating a span element modifies the underlying array directly.

```csharp
{
    int[] arr = { 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 };

    Span<int> full = arr;
    Span<int> slice = arr.AsSpan(2, 5);
    Span<int> ranged = arr.AsSpan()[3..7];

    Console.WriteLine($"full:    [{string.Join(", ", full.ToArray())}]");
    Console.WriteLine($"slice:   [{string.Join(", ", slice.ToArray())}]");
    Console.WriteLine($"ranged:  [{string.Join(", ", ranged.ToArray())}]");

    Span<int> window = arr.AsSpan(0, 3);
    window[0] = 999;
    Console.WriteLine($"arr[0] after span mutation: {arr[0]}");
    arr[0] = 10;

    Span<int> s = arr;
    Console.WriteLine($"s[..3]:    [{string.Join(", ", s[..3].ToArray())}]");
    Console.WriteLine($"s[^3..]:   [{string.Join(", ", s[^3..].ToArray())}]");
    Console.WriteLine($"s[2..^2]:  [{string.Join(", ", s[2..^2].ToArray())}]");

    Span<int> data = new int[] { 5, 3, 1, 4, 2 };
    data.Sort();
    Console.WriteLine($"Sort:          [{string.Join(", ", data.ToArray())}]");
    data.Reverse();
    Console.WriteLine($"Reverse:       [{string.Join(", ", data.ToArray())}]");
    data.Fill(0);
    Console.WriteLine($"Fill(0):       [{string.Join(", ", data.ToArray())}]");

    Span<int> src = new int[] { 1, 2, 3 };
    Span<int> dst = new int[3];
    src.CopyTo(dst);
    Console.WriteLine($"CopyTo:        [{string.Join(", ", dst.ToArray())}]");
}
```

```text
full:    [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
slice:   [30, 40, 50, 60, 70]
ranged:  [40, 50, 60, 70]
arr[0] after span mutation: 999
s[..3]:    [10, 20, 30]
s[^3..]:   [80, 90, 100]
s[2..^2]:  [30, 40, 50, 60, 70, 80]
Sort:          [1, 2, 3, 4, 5]
Reverse:       [5, 4, 3, 2, 1]
Fill(0):       [0, 0, 0, 0, 0]
CopyTo:        [1, 2, 3]
```

#### ReadOnlySpan&lt;char&gt; for strings

`ReadOnlySpan<char>` provides zero-allocation substring views. Unlike `Substring()` which allocates a new string on the heap, `AsSpan()` returns a view into the original string's memory — critical for high-throughput parsers and text processing.

```csharp
string text = "Hello, World!";

string sub1 = text.Substring(7, 5);
Console.WriteLine(sub1);

{
    ReadOnlySpan<char> sub2 = text.AsSpan(7, 5);
    Console.WriteLine($"Span:          '{sub2.ToString()}'");

    ReadOnlySpan<char> greeting = text.AsSpan(..5);
    Console.WriteLine($"Span[..5]:     '{greeting.ToString()}'");
}
```

```text
World
Span:          'World'
Span[..5]:     'Hello'
```

#### Memory&lt;T&gt; — span without stack restrictions

`Span<T>` is a `ref struct` and cannot be stored on the heap (no fields, no async methods, no closures). `Memory<T>` lifts this restriction — it can be stored in fields and passed to async methods — while still supporting slicing via its `.Span` property. Use `Memory<T>` when you need to pass a slice across async boundaries or store it in a collection.

> [!info] Span vs Memory
>
> - `Span<T>` — stack-only, lowest overhead, use in synchronous hot paths
> - `Memory<T>` — heap-safe, use when spans must cross `async`/`await` boundaries or be stored in fields
> - Both make the older `ArraySegment<T>` redundant — implicit conversions exist in both directions

#### When to use Array vs List vs Span

| Type | Use when |
|---|---|
| `int[]` (Array) | Fixed data, interop, raw buffers |
| `List<T>` | Dynamic data, add/remove, general purpose (95% of the time) |
| `Span<T>` | Performance-critical slicing without allocation (parsers, serializers, hot loops) |
| `ReadOnlySpan<T>` | Zero-copy string slicing, immutable views |
| `Memory<T>` | Slicing across async boundaries, storing slices in fields or collections |

## Dictionaries

`Dictionary<TKey, TValue>` is a hash-based key-value mapping with O(1) average lookup, insert, and delete. Keys must implement `GetHashCode`/`Equals` (built-in types work out of the box). `SortedDictionary<K,V>` keeps keys in sorted order using a red-black tree (O(log n)). For thread-safe scenarios, use `ConcurrentDictionary<K,V>` from `System.Collections.Concurrent`.

### Dictionary creation and access

Creating dictionaries, reading values safely, and updating entries. Always prefer `TryGetValue` or `GetValueOrDefault` over bracket access when the key may not exist.

#### Dictionary&lt;TKey, TValue&gt; creation — initializer, indexer, TryGetValue

Hash-based mapping with O(1) average lookup, insert, and remove. Keys must implement `GetHashCode`/`Equals` properly (built-in types like `string`, `int` work out of the box). `SortedDictionary<K,V>` keeps keys sorted. C# has no `defaultdict` — use `GetValueOrDefault` or `TryGetValue` pattern. No `Counter` — use `GroupBy` + `Count` or a manual dictionary.

> [!warning] Anti-patterns
>
> - **Duplicate keys in initializer** — throws `ArgumentException`
> - **Bracket access without checking** key exists — `KeyNotFoundException`
> - **Mutable keys** — changing a key's hash after insertion breaks lookup

> [!success] Safe dictionary access
>
> - Always use `TryGetValue` or `ContainsKey` before bracket access in uncertain lookups
> - Use `GetValueOrDefault(key, fallback)` for concise fallback reads
> - Prefer immutable or struct keys (`string`, `int`, `record struct`) to avoid hash mutation bugs

```csharp
var empty = new Dictionary<string, int>();
var person = new Dictionary<string, object>
{
    ["name"] = "Alice",
    ["age"] = 30,
    ["city"] = "NYC"
};
var scores = new Dictionary<string, int>
{
    { "Alice", 85 },
    { "Bob", 92 },
    { "Charlie", 78 }
};

Console.WriteLine(string.Join(", ", person.Select(kv => $"{kv.Key}:{kv.Value}")));
Console.WriteLine(string.Join(", ", scores.Select(kv => $"{kv.Key}:{kv.Value}")));
```

```text
name:Alice, age:30, city:NYC
Alice:85, Bob:92, Charlie:78
```

#### Dictionary [], TryGetValue, ContainsKey — access and update

Bracket access (`dict[key]`) throws `KeyNotFoundException` if the key is missing. `TryGetValue` returns `false` instead — safer for uncertain lookups. `GetValueOrDefault` provides a fallback value inline.

```csharp
Console.WriteLine(person["name"]);
person["age"] = 31;
person["email"] = "alice@example.com";
Console.WriteLine(person["age"]);

if (scores.TryGetValue("Bob", out int bobScore))
    Console.WriteLine($"Bob's score:          {bobScore}");
Console.WriteLine(scores.GetValueOrDefault("Unknown", -1));
```

```text
Alice
31
Bob's score:          92
-1
```

### Dictionary modification and iteration

Removing entries, iterating key-value pairs, and using LINQ for filtering and grouping over dictionaries.

#### Dictionary Remove, Clear — removing entries

`Remove` deletes by key and returns `true` if found. `Clear` empties the entire dictionary.

```csharp
var d = new Dictionary<string, int> { ["a"] = 1, ["b"] = 2, ["c"] = 3 };
d.Remove("b");
Console.WriteLine(string.Join(", ", d.Select(kv => $"{kv.Key}:{kv.Value}")));
d.Clear();
Console.WriteLine(d.Count);
```

```text
a:1, c:3
0
```

#### Dictionary foreach KeyValuePair — iterating and membership

Iterating with `foreach` deconstructs each `KeyValuePair<K,V>` into `(key, value)`. `ContainsKey` is O(1); `ContainsValue` is O(n) — it scans all values linearly.

```csharp
var dd = new Dictionary<string, object> { ["name"] = "Alice", ["age"] = 30, ["city"] = "NYC" };
foreach (var (key, value) in dd)
    Console.WriteLine($"  {key}: {value}");

Console.WriteLine(dd.ContainsKey("name"));
Console.WriteLine(dd.ContainsValue("NYC"));
Console.WriteLine(string.Join(", ", dd.Keys));
Console.WriteLine(string.Join(", ", dd.Values));
```

```text
  name: Alice
  age: 30
  city: NYC
True
True
name, age, city
Alice, 30, NYC
```

#### LINQ Where, GroupBy, Count — dictionary filtering and grouping

LINQ's `Where`, `GroupBy`, and `ToDictionary` chain naturally over dictionaries. `GroupBy` + `Count` replaces Python's `Counter`. `SortedDictionary<K,V>` maintains keys in sorted order automatically.

```csharp
var filtered = scores.Where(kv => kv.Value >= 80)
    .ToDictionary(kv => kv.Key, kv => kv.Value);
Console.WriteLine(string.Join(", ", filtered.Select(kv => $"{kv.Key}:{kv.Value}")));

var words = new[] { "apple", "banana", "avocado", "cherry", "blueberry" };
var groups = words.GroupBy(w => w[0])
    .ToDictionary(g => g.Key, g => g.ToList());
foreach (var (key, value) in groups)
    Console.WriteLine($"  {key}: [{string.Join(", ", value)}]");

string text = "abracadabra";
var counter = text.GroupBy(c => c)
    .ToDictionary(g => g.Key, g => g.Count())
    .OrderByDescending(kv => kv.Value);
foreach (var (ch, count) in counter)
    Console.WriteLine($"  '{ch}': {count}");

var sorted = new SortedDictionary<string, int>(scores);
foreach (var (key, value) in sorted)
    Console.WriteLine($"  {key}: {value}");
```

```text
Alice:85, Bob:92
  a: [apple, avocado]
  b: [banana, blueberry]
  c: [cherry]
  'a': 5
  'b': 2
  'r': 2
  'c': 1
  'd': 1
  Alice: 85
  Bob: 92
  Charlie: 78
```

## Sets

Sets store unique elements with O(1) membership testing. `HashSet<T>` is unordered and backed by a hash table. `SortedSet<T>` keeps elements sorted via a red-black tree (O(log n)). For immutable sets, use `ImmutableHashSet<T>` from `System.Collections.Immutable`. Set algebra operations (`UnionWith`, `IntersectWith`, `ExceptWith`, `SymmetricExceptWith`) mutate the set in-place — copy first if you need to preserve the original.

### HashSet operations

Creating sets, adding/removing elements, and performing set algebra (union, intersection, difference, symmetric difference).

#### HashSet&lt;T&gt; creation — unordered unique elements

`HashSet<T>` stores unique elements with O(1) add, remove, and membership testing. Duplicates are silently ignored on insertion. The examples show creation from a literal, from a `List` (deduplicating), and from a string (yielding unique characters).

> [!info] HashSet
>
> - `HashSet<T>` — unique elements with O(1) membership, deduplication, and set algebra
> - Set operations: `UnionWith`, `IntersectWith`, `ExceptWith`, `SymmetricExceptWith`
> - `SortedSet<T>` — keeps elements sorted
> - No `frozenset` equivalent — use `ImmutableHashSet` from `System.Collections.Immutable`

> [!warning] Anti-patterns
>
> - **`List` + `Contains`** for uniqueness checks — O(n) per check vs O(1) for `HashSet`
> - **Mutable elements** — hash changes break lookup

> [!success] Correct HashSet usage
>
> - Use `HashSet<T>` whenever membership testing or deduplication is needed — it is O(1) vs O(n) for `List`
> - Use immutable or value-type elements (`string`, `int`, `record struct`) to guarantee stable hash codes

```csharp
var empty = new HashSet<int>();
var nums = new HashSet<int> { 1, 2, 3, 4, 5 };
var fromList = new List<int> { 1, 2, 2, 3, 3, 3 }.ToHashSet();
var fromStr = "abracadabra".ToHashSet();

Console.WriteLine(string.Join(", ", nums));
Console.WriteLine(string.Join(", ", fromList));
Console.WriteLine(string.Join(", ", fromStr));
```

```text
{1, 2, 3, 4, 5}
{1, 2, 3}
{a, b, r, c, d}
```

#### HashSet Add, Remove, RemoveWhere — modify set elements

`Add` returns `true` if the element was inserted, `false` if it already existed. `Remove` returns `true` if the element was found and removed.

```csharp
var s = new HashSet<int> { 1, 2, 3 };
Console.WriteLine(s.Add(4));
Console.WriteLine(s.Add(2));
Console.WriteLine(s.Remove(1));
Console.WriteLine(string.Join(", ", s));
```

```text
True
False
True
{2, 3, 4}
```

#### HashSet UnionWith, IntersectWith, ExceptWith, SymmetricExceptWith

All four set algebra operations mutate the target set in-place. To preserve the original, copy it first with `new HashSet<int>(original)`. `UnionWith` adds all elements from the other set. `IntersectWith` keeps only shared elements. `ExceptWith` removes elements present in the other set. `SymmetricExceptWith` keeps elements in either set but not both.

```csharp
var a = new HashSet<int> { 1, 2, 3, 4, 5 };
var b = new HashSet<int> { 3, 4, 5, 6, 7 };

var union = new HashSet<int>(a); union.UnionWith(b);
var inter = new HashSet<int>(a); inter.IntersectWith(b);
var diff  = new HashSet<int>(a); diff.ExceptWith(b);
var symm  = new HashSet<int>(a); symm.SymmetricExceptWith(b);

Console.WriteLine(string.Join(", ", union));
Console.WriteLine(string.Join(", ", inter));
Console.WriteLine(string.Join(", ", diff));
Console.WriteLine(string.Join(", ", symm));
```

```text
{1, 2, 3, 4, 5, 6, 7}
{3, 4, 5}
{1, 2}
{1, 2, 7, 6}
```

#### HashSet Except — data comparison for missing and extra items

A practical data engineering pattern — use `ExceptWith` to find items present in one dataset but missing from another (e.g., unsold products, orphaned foreign keys).

```csharp
var prodIds = new HashSet<string> { "P001", "P002", "P003", "P004" };
var soldIds = new HashSet<string> { "P002", "P004", "P005" };

var unsold = new HashSet<string>(prodIds); unsold.ExceptWith(soldIds);
var unknown = new HashSet<string>(soldIds); unknown.ExceptWith(prodIds);
Console.WriteLine(string.Join(", ", unsold));
Console.WriteLine(string.Join(", ", unknown));
```

```text
{P001, P003}
{P005}
```

### SortedSet

`SortedSet<T>` maintains elements in sorted order and guarantees uniqueness — duplicates are silently ignored on `Add()`. Internally it uses a red-black tree, giving O(log n) for add, remove, and lookup. Use it when you need both uniqueness and sorted iteration. It also exposes `Min`, `Max`, and `GetViewBetween(lower, upper)` for range queries.

#### SortedSet creation and range access

Constructs a `SortedSet<int>` from an unordered `HashSet`, demonstrating that elements are automatically ordered on insertion. `Min` and `Max` properties read the boundary values without scanning.

```csharp
var unsorted = new HashSet<int> { 5, 3, 1, 4, 2 };
var sorted = new SortedSet<int>(unsorted);
Console.WriteLine(string.Join(", ", sorted));
Console.WriteLine($"Min: {sorted.Min}, Max: {sorted.Max}");
```

```text
{1, 2, 3, 4, 5}
Min: 1, Max: 5
```

## Tuples and Enums

Tuples group a fixed number of heterogeneous values without defining a class. C# uses `ValueTuple` (value type, stack-allocated, compared by value) — the modern replacement for `System.Tuple` (reference type, heap-allocated). Enums define named integer constants for discrete value sets, improving readability and compile-time safety over magic numbers.

### ValueTuple fundamentals

`ValueTuple` supports named fields, deconstruction into separate variables, and swap-without-temp idioms. For public APIs or complex return types (3–4+ fields), prefer a `record` or class for discoverability and documentation.

#### ValueTuple basics

`ValueTuple` is a lightweight value type with optional named fields — stack-allocated, compared by value, and zero heap overhead. Named fields (`Name`, `Age`, `City`) are accessed via dot notation; unnamed fields fall back to `Item1`, `Item2`, etc.

> [!info] ValueTuple
>
> - Lightweight value type with named fields — lives on the stack, compared by value, no heap allocation
> - Deconstruction: `var (x, y) = tuple` unpacks into separate variables
> - Avoid `System.Tuple` (older reference type using `Item1`/`Item2`) in new code
> - For tuples with more than 3-4 fields, use a `record` or class instead
> - For public APIs, records are more discoverable and documented

```csharp
var point = (3, 4);
var person = (Name: "Alice", Age: 30, City: "NYC");

Console.WriteLine(point);
Console.WriteLine(point.Item1);
Console.WriteLine(person.Name);
Console.WriteLine(person.Age);
```

```text
(3, 4)
3
Alice
30
```

#### Tuple deconstruction (var (a,b) = ...) and swap

Deconstruction unpacks tuple fields into separate variables. The swap idiom `(a, b) = (b, a)` exchanges two values without a temporary variable — the compiler handles this atomically.

```csharp
var (x, y) = point;
Console.WriteLine($"Deconstructed: x={x}, y={y}");

int a2 = 1, b2 = 2;
(a2, b2) = (b2, a2);
Console.WriteLine($"Swapped: a={a2}, b={b2}");
```

```text
Deconstructed: x=3, y=4
Swapped: a=2, b=1
```

#### Records as an alternative to namedtuple

For named immutable data, C# uses records:

```csharp
record Point(int X, int Y);          // positional record
record class Person(string Name);    // reference type (default)
record struct Coord(int X, int Y);   // value type
```

### Enum types

Enums define a closed set of named integer constants. Members auto-increment from 0 unless explicitly assigned. Use enums instead of magic numbers or string constants for state machines, status codes, and configuration options.

#### Enum type declaration

Enum values auto-increment from 0 unless explicitly assigned. Use explicit values when they map to external codes (database, wire protocol). The `[Flags]` attribute enables bitwise combination for multi-valued enums.

```csharp
enum Color { Red = 1, Green = 2, Blue = 3 }
enum Direction { North, South, East, West }

enum PipelineStatus { Pending, Running, Success, Failed }
```

#### Enum usage — switch, ToString, Enum.Parse, IsDefined

Cast to `int` for the underlying value. `Enum.Parse<T>` converts a string to the enum member. `Enum.GetValues<T>` returns all defined members.

```csharp
Console.WriteLine(Color.Red);
Console.WriteLine((int)Color.Red);
Console.WriteLine(Enum.Parse<Color>("Blue"));
Console.WriteLine(string.Join(", ", Enum.GetValues<Color>()));
```

```text
Red
1
Blue
Red, Green, Blue
```

## Stacks, Queues, and Linked Lists

Specialized collections for ordered processing. `Stack<T>` (LIFO) is natural for undo systems, DFS, and expression evaluation. `Queue<T>` (FIFO) models task queues, BFS, and ETL pipelines. `LinkedList<T>` provides O(1) insertion/removal at any node position. `PriorityQueue<T, TPriority>` (.NET 6+) dequeues by priority rather than insertion order.

### Stack and Queue

Stack operations (`Push`, `Pop`, `Peek`) and Queue operations (`Enqueue`, `Dequeue`, `Peek`) are all O(1).

#### Stack — Stack&lt;T&gt; (LIFO)

`Stack<T>` is Last In, First Out — `Push` adds to the top, `Pop` removes and returns the top element, `Peek` reads it without removing. All three operations are O(1). The last item pushed is the first returned.

> [!info] Stack operations (all O(1))
>
> - `Push` — adds to top
> - `Pop` — removes and returns top
> - `Peek` — reads top without removing
> - `TryPop` / `TryPeek` — return `false` if empty instead of throwing
> - Natural for undo systems, DFS, balanced bracket checking, reverse iteration
> - For FIFO use `Queue<T>`; for indexed access use `List<T>`

```csharp
var stack = new Stack<string>();
stack.Push("first");
stack.Push("second");
stack.Push("third");
Console.WriteLine(string.Join(", ", stack));
Console.WriteLine(stack.Pop());
Console.WriteLine(stack.Pop());
Console.WriteLine(stack.Peek());
Console.WriteLine(stack.Count);
```

```text
[third, second, first]
third
second
first
1
```

#### Queue — Queue&lt;T&gt; (FIFO)

`Queue<T>` processes elements in insertion order (First In, First Out). `Dequeue` removes and returns the front element; `Peek` reads it without removing.

```csharp
var queue = new Queue<string>();
queue.Enqueue("first");
queue.Enqueue("second");
queue.Enqueue("third");
Console.WriteLine(string.Join(", ", queue));
Console.WriteLine(queue.Dequeue());
Console.WriteLine(queue.Peek());
```

```text
[first, second, third]
first
second
```

### LinkedList and PriorityQueue

`LinkedList<T>` is a doubly-linked list with O(1) insert/remove at any node (given a reference to that node). `PriorityQueue<T, TPriority>` (.NET 6+) dequeues the element with the lowest priority value first.

#### LinkedList&lt;T&gt; — doubly-linked list

`AddFirst`, `AddLast`, and `AddAfter`/`AddBefore` insert at specific positions. `Find` returns a `LinkedListNode<T>` reference for positional operations.

```csharp
var ll = new LinkedList<string>();
ll.AddLast("B");
ll.AddFirst("A");
ll.AddLast("D");
ll.AddAfter(ll.Find("B")!, "C");
Console.WriteLine(string.Join(", ", ll));
ll.Remove("C");
ll.RemoveFirst();
Console.WriteLine(string.Join(", ", ll));
```

```text
[A, B, C, D]
[B, D]
```

#### PriorityQueue&lt;T, TPriority&gt; — dequeue by lowest priority

`PriorityQueue` orders by priority value (lower = higher priority). It uses a min-heap internally. There is no built-in way to update priorities — remove and re-insert instead.

```csharp
var pq = new PriorityQueue<string, int>();
pq.Enqueue("low priority", 3);
pq.Enqueue("high priority", 1);
pq.Enqueue("medium priority", 2);

Console.WriteLine(pq.Dequeue());
Console.WriteLine(pq.Dequeue());
```

```text
high priority
medium priority
```

#### ETL task queue — FIFO processing pattern

A practical data engineering pattern — model extract/transform/load steps as a FIFO queue. Each job is dequeued and processed in submission order.

```csharp
var taskQueue = new Queue<(string task, string table)>();
taskQueue.Enqueue(("extract", "users"));
taskQueue.Enqueue(("extract", "orders"));
taskQueue.Enqueue(("transform", "users"));

while (taskQueue.Count > 0)
{
    var (task, table) = taskQueue.Dequeue();
    Console.WriteLine($"  Processing: {task} → {table}");
}
```

```text
  Processing: extract → users
  Processing: extract → orders
  Processing: transform → users
```

## Collection Comparison and Choosing the Right One

Choosing the right collection type depends on access pattern, ordering requirements, uniqueness constraints, and performance characteristics. This section provides a quick-reference comparison table and a decision guide for common data engineering scenarios.

### Collection comparison tables

The following cells output formatted ASCII tables for quick reference during collection selection — a cheat sheet comparing all types across ordering, mutability, and lookup complexity, then a decision tree by access pattern.

#### Collection cheat sheet

Prints a reference table comparing all core C# collection types across ordering, mutability, duplicate support, and lookup complexity.

```csharp
Console.WriteLine(@"
Collection          | Ordered | Mutable | Duplicates | Lookup
--------------------+---------+---------+------------+---------
int[] (array)       | Yes     | Fixed*  | Yes        | O(n)
List<T>             | Yes     | Yes     | Yes        | O(n)
Dictionary<K,V>     | No**    | Yes     | Keys: No   | O(1)
HashSet<T>          | No      | Yes     | No         | O(1)
SortedDictionary    | Yes     | Yes     | Keys: No   | O(log n)
SortedSet<T>        | Yes     | Yes     | No         | O(log n)
Stack<T>            | LIFO    | Yes     | Yes        | -
Queue<T>            | FIFO    | Yes     | Yes        | -
LinkedList<T>       | Yes     | Yes     | Yes        | O(n)
PriorityQueue<T,P>  | Priority| Yes     | Yes        | -
ValueTuple          | Yes     | No***   | Yes        | -
enum                | -       | No      | No         | -

*  Array: elements mutable, size fixed
** Dictionary: no guaranteed order
*** ValueTuple: struct fields mutable, but usually used as immutable
");
```

```text
Collection          | Ordered | Mutable | Duplicates | Lookup
--------------------+---------+---------+------------+---------
int[] (array)       | Yes     | Fixed*  | Yes        | O(n)
List<T>             | Yes     | Yes     | Yes        | O(n)
Dictionary<K,V>     | No**    | Yes     | Keys: No   | O(1)
HashSet<T>          | No      | Yes     | No         | O(1)
SortedDictionary    | Yes     | Yes     | Keys: No   | O(log n)
SortedSet<T>        | Yes     | Yes     | No         | O(log n)
Stack<T>            | LIFO    | Yes     | Yes        | -
Queue<T>            | FIFO    | Yes     | Yes        | -
LinkedList<T>       | Yes     | Yes     | Yes        | O(n)
PriorityQueue<T,P>  | Priority| Yes     | Yes        | -
ValueTuple          | Yes     | No***   | Yes        | -
enum                | -       | No      | No         | -

*  Array: elements mutable, size fixed
** Dictionary: no guaranteed order
*** ValueTuple: struct fields mutable, but usually used as immutable
```

#### Decision guide

Prints a decision-tree guide for selecting the right collection type based on access pattern: ordered, key-value, unique, FIFO, LIFO, or priority.

```csharp
Console.WriteLine(@"
Need ordered items?
  ├─ Fixed size?      → T[] (array)
  └─ Dynamic size?    → List<T>

Need key-value pairs?
  ├─ Keep keys sorted? → SortedDictionary<K,V>
  └─ Fast lookup?      → Dictionary<K,V>

Need unique elements?
  ├─ Keep sorted?      → SortedSet<T>
  └─ Fast lookup?      → HashSet<T>

Need FIFO?             → Queue<T>
Need LIFO?             → Stack<T>
Need priority?         → PriorityQueue<T,P>
Need O(1) insert/remove at position? → LinkedList<T>
");
```

```text
Need ordered items?
  ├─ Fixed size?      → T[] (array)
  └─ Dynamic size?    → List<T>

Need key-value pairs?
  ├─ Keep keys sorted? → SortedDictionary<K,V>
  └─ Fast lookup?      → Dictionary<K,V>

Need unique elements?
  ├─ Keep sorted?      → SortedSet<T>
  └─ Fast lookup?      → HashSet<T>

Need FIFO?             → Queue<T>
Need LIFO?             → Stack<T>
Need priority?         → PriorityQueue<T,P>
Need O(1) insert/remove at position? → LinkedList<T>
```

#### Common data engineering patterns

| Use case | Collection |
|---|---|
| ETL records | `List<T>` or `T[]` |
| Config / params | `Dictionary<string, object>` |
| Deduplication | `HashSet<T>` |
| Lookup table | `Dictionary<TKey, TValue>` |
| Grouping | `.GroupBy().ToDictionary()` (LINQ) |
| Counting | `.GroupBy().Count()` (LINQ) |
| Task queue | `Queue<T>` |
| Priority tasks | `PriorityQueue<T, int>` |
| Schema fields | `ValueTuple` or `enum` |
| Immutable config | `ImmutableDictionary` (`System.Collections.Immutable`) |
| Read-heavy lookup | `FrozenDictionary` / `FrozenSet` (`System.Collections.Frozen`, .NET 8+) |

> [!info] FrozenDictionary and FrozenSet (.NET 8+)
>
> `FrozenDictionary<TKey, TValue>` and `FrozenSet<T>` from `System.Collections.Frozen` are optimized for scenarios where the collection is built once and read many times. The `ToFrozenDictionary()` / `ToFrozenSet()` extension methods create an immutable snapshot with faster read performance than standard `Dictionary` or `HashSet` — the runtime pre-computes an optimal hash strategy at creation time. Ideal for static lookup tables, configuration caches, and reference data loaded at startup.

## Warnings

> [!warning] `List<T>` capacity doubling causes memory spikes
>
> When a `List<T>` exceeds its internal capacity, it allocates a new array twice the size and copies all elements. For lists with millions of items, this causes GC pressure and temporary memory usage up to 3× the data size (old array + new array + data being copied).

> [!success] Correct pattern
>
> Pre-allocate with `new List<T>(capacity: expectedSize)` when the final size is known or estimable. This eliminates resize copies entirely.

> [!warning] Shallow copy trap with reference types
>
> `new List<T>(original)`, `.ToList()`, and `.ToArray()` create new collection structures, but both collections contain references to the same objects. Mutating `copy[0].Name` also changes `original[0].Name`.

> [!success] Correct pattern
>
> For value types (`int`, `struct`), shallow copy is safe. For reference types, use `Select(item => item with { })` (record copy expressions) or implement `ICloneable` for true independence.

> [!warning] `HashSet` set algebra mutates in-place
>
> `UnionWith`, `IntersectWith`, `ExceptWith`, and `SymmetricExceptWith` all modify the target set. Calling `a.ExceptWith(b)` permanently removes elements from `a`.

> [!success] Correct pattern
>
> Copy first: `var diff = new HashSet<T>(a); diff.ExceptWith(b);` — this preserves the original set `a`.

> [!warning] `Span<T>` cannot cross async boundaries
>
> `Span<T>` is a `ref struct` (stack-only). It cannot be stored in fields, captured by lambdas, or used in `async` methods. Attempting to do so produces a compile error.

> [!success] Correct pattern
>
> Use `Memory<T>` when the slice must survive an `await` or be stored in a collection. Access its `.Span` property for the fast path inside synchronous code blocks.

> [!warning] Casting arbitrary integers to enums
>
> `(Color)999` compiles and runs — it produces an enum value with no defined name. `Enum.IsDefined` returns `false` for it, but nothing prevents its creation.

> [!success] Correct pattern
>
> Always validate with `Enum.IsDefined(typeof(Color), value)` when converting external input (database, API) to an enum. Use `Enum.TryParse` for string-to-enum conversion.

> [!warning] `Pop()` and `Dequeue()` throw on empty collections
>
> `Stack<T>.Pop()` and `Queue<T>.Dequeue()` throw `InvalidOperationException` if the collection is empty. In concurrent or event-driven code, the count can change between check and call.

> [!success] Correct pattern
>
> Use `TryPop(out var item)` and `TryDequeue(out var item)` — they return `false` instead of throwing, and are atomic.

## Recommendations

- **Use `List<T>` as the default** — it handles ~95% of ordered collection needs. Reserve arrays for interop, fixed buffers, or performance-critical paths.
- **Pre-size large collections** — `new List<T>(capacity)`, `new Dictionary<K,V>(capacity)`, `new HashSet<T>(capacity)` all accept initial capacity to avoid resize overhead.
- **Use `TryGetValue` over bracket access** — for dictionaries where the key may not exist. Avoids exceptions and is faster than `ContainsKey` + bracket (single hash lookup vs two).
- **Use `HashSet<T>` for membership tests** — `HashSet.Contains` is O(1) vs `List.Contains` at O(n). Convert early in hot paths.
- **Use LINQ `GroupBy` + `ToDictionary` for counting/grouping** — C# has no built-in `Counter` or `defaultdict`. LINQ provides the equivalent with `GroupBy(x => x).ToDictionary(g => g.Key, g => g.Count())`.
- **Use `Span<T>` in parsers and serializers** — zero-allocation slicing avoids GC pressure in hot loops. Fall back to `Memory<T>` only when async boundaries force it.
- **Use `ReadOnlySpan<char>` for string parsing** — `text.AsSpan(start, length)` avoids `Substring()` heap allocations entirely.
- **Use records instead of tuples for public APIs** — `record Point(int X, int Y)` is self-documenting, serializable, and pattern-matchable. Tuples are fine for local/internal use.
- **Use `FrozenDictionary`/`FrozenSet` for static lookup tables** (.NET 8+) — faster reads than `Dictionary`/`HashSet` when the data is loaded once at startup.
- **Avoid `List<object>`** — it discards type safety. Model mixed-type data with a strongly typed `record`, class, or discriminated union (`OneOf`).

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `KeyNotFoundException` on dictionary access | Key doesn't exist; used `d[key]` instead of `TryGetValue` | Use `TryGetValue(key, out var val)` or `GetValueOrDefault(key, fallback)` |
| `ArgumentException: duplicate key` | Dictionary initializer contains the same key twice | Remove duplicate or use indexer assignment `d[key] = val` (overwrites) |
| `InvalidOperationException` on `Pop()`/`Dequeue()` | Collection is empty | Use `TryPop()`/`TryDequeue()` or check `Count > 0` first |
| `InvalidOperationException: Collection was modified` | Modified a collection during `foreach` iteration | Use `for` loop with reverse index, or build a separate list of changes first |
| `OutOfMemoryException` on large `List<T>` | Capacity doubling allocates a new array twice the current size | Pre-allocate with `new List<T>(capacity)` or use streaming/pagination |
| Shallow copy mutates original | Reference-type elements are shared between collections | Use record `with { }` copy or `ICloneable` for deep independence |
| `Span<T>` compile error in async method | `ref struct` cannot be used across `await` boundaries | Switch to `Memory<T>` and access `.Span` in synchronous blocks |
| `HashSet` loses elements after key mutation | Mutating an element's hash-contributing fields breaks internal lookup | Use immutable or value-type elements (`string`, `int`, `record struct`) |
| `SortedDictionary` slower than expected | O(log n) per operation vs O(1) for `Dictionary` | Use `SortedDictionary` only when sorted key iteration is actually needed |
| Enum cast produces undefined value | Arbitrary int cast to enum with no matching member | Validate with `Enum.IsDefined()` or `Enum.TryParse()` before use |
| `PriorityQueue` not available | Target framework is older than .NET 6 | Upgrade to .NET 6+ or use a third-party heap library |

## Cross-References

- **Python equivalent** — [[05-py-collections]] covers lists, dicts, sets, tuples, `deque`, `heapq`, `Counter`, `defaultdict`, `namedtuple`
- **Strings** — [[02-cs-strings]] covers string methods, interpolation, and regex — strings are immutable sequences
- **Control flow** — [[03-cs-control-flow]] covers LINQ queries (`Where`, `Select`, `GroupBy`) as the idiomatic way to filter and transform collections
- **Functions** — [[04-cs-functions]] covers `Func<T>`/`Action<T>`, lambdas, and extension methods that power LINQ
- **OOP** — [[06-cs-oop]] covers records, classes, and structs as alternatives to tuples and dictionaries for structured data
