---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [lists, dictionaries, sets, tuples, arrays, List, Dictionary, HashSet, LINQ]
keywords: [List, Dictionary, HashSet, Queue, Stack, IEnumerable, LINQ, array, SortedDictionary, ConcurrentDictionary]
description: "C# collections reference with executable examples and cell outputs — covers List, Dictionary, HashSet, arrays, Queue, Stack, and immutable collections. See [05_py_collections](https://alp78.github.io/elysium/02-Programming-Languages/Python/05_py_collections) for the Python equivalent."
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

## Arrays and Lists

#### Array — T[] (fixed size)

Arrays are fixed-size, contiguous memory with O(1) index access — the fastest collection type due to cache locality. Size is set at creation and cannot be changed. Use arrays for fixed data, buffers, interop, and performance-critical indexed access. For dynamic sizing (add/remove), use `List<T>` instead.

> [!warning] Anti-patterns
>
> - **`Array.Resize`** creates a new array and copies — it's not in-place
> - **Resizing arrays manually** — use `List<T>` for dynamic collections

```csharp
int[] nums = { 1, 2, 3, 4, 5 };                      // literal
int[] zeros = new int[5];                            // [0, 0, 0, 0, 0]
int[] ranged = Enumerable.Range(0, 5).ToArray();     // [0, 1, 2, 3, 4]
string[] words = new[] { "hello", "world" };         // type inferred

string.Join(", ", nums)   // nums
string.Join(", ", zeros)   // zeros
string.Join(", ", ranged)   // ranged
nums.Length   // Length

nums[0]
nums[^1]
string.Join(", ", nums[1..4])   // [1..4]
```

> [!info] Arrays Are Fixed Size
> Arrays have no `Add()` or `Remove()`. Use `List<T>` for resizable collections.

    [1, 2, 3, 4, 5]
    [0, 0, 0, 0, 0]
    [0, 1, 2, 3, 4]
    5
    1
    5
    [2, 3, 4]

#### List&lt;T&gt; — adding and removing

`List<T>` is C#'s resizable array — the most commonly used collection. Unlike a fixed-size array, a List grows automatically as you add elements. Internally it's backed by an array that doubles in capacity when full, making `Add()` amortized O(1) but occasionally causing a full copy.

> [!warning] Lists Are Single-Type
> `List<T>` holds one type only. `List<object>` allows mixed types but loses type safety — avoid in production code.

> [!warning] List capacity doubling
> When a List exceeds its internal capacity, it allocates a new array twice the size and copies all elements. For large lists (millions of items), this causes memory spikes and GC pressure. If you know the final size, set it upfront: `new List<T>(capacity: 1_000_000)`.

```csharp
// List<T> — dynamic array with Add, Insert, Remove operations

var empty = new List<int>();
var list = new List<int> { 1, 2, 3, 4, 5 };
string.Join(", ", list)   // list
list.Count   // Count

var lst = new List<int> { 1, 2, 3 };
lst.Add(4);                                   // add to end
lst.Insert(0, 0);                             // insert at index
lst.AddRange(new[] { 5, 6 });                 // add multiple
string.Join(", ", lst)   // After adds

lst = new List<int> { 1, 2, 3, 2, 4, 5 };
lst.Remove(2);                                // remove FIRST occurrence of value
string.Join(", ", lst)   // Remove(2)
lst.RemoveAt(0);                              // remove at index
string.Join(", ", lst)   // RemoveAt(0)
int last = lst[^1]; lst.RemoveAt(lst.Count - 1);  // pop last (no built-in Pop)
$"Pop last:   [{string.Join(", ", lst)}] (popped: {last})"
lst.Clear();                                  // remove all
string.Join(", ", lst)   // Clear()
```

    [1, 2, 3, 4, 5]
    5
    [0, 1, 2, 3, 4, 5, 6]
    [1, 3, 2, 4, 5]
    [3, 2, 4, 5]
    5)
    []

#### List Contains, IndexOf, Find, Exists — search and membership

These methods search a List linearly (O(n)) — they check each element until a match is found. For frequent lookups, use a `HashSet<T>` (O(1)) or `Dictionary<TKey, TValue>` instead.

```csharp
// Search and membership — Contains, IndexOf, FindAll, Find, Exists

lst = new List<int> { 10, 20, 30, 40, 30, 50 };
lst.Contains(30)   // Contains(30)
lst.IndexOf(30)   // IndexOf(30)
string.Join(", ", lst.FindAll(x => x > 25))   // FindAll(>25)
lst.Exists(x => x > 40)   // Exists(>40)
lst.Find(x => x > 25)   // Find(>25)
```

    True
    2
    [30, 40, 30, 50]
    True
    30

#### List Sort, OrderBy, ThenBy — sorting and custom comparers

`Sort()` sorts the list in-place (mutates it), while LINQ's `OrderBy()` returns a new sorted sequence without modifying the original. Use `Sort()` when you don't need the original order; use `OrderBy()` in LINQ chains where immutability matters.

```csharp
// Sorting — OrderBy (new sequence) vs Sort (in-place mutation)

var unsorted = new List<int> { 3, 1, 4, 1, 5, 9, 2, 6 };
string.Join(", ", unsorted.OrderBy(x => x))   // OrderBy
string.Join(", ", unsorted)   // original

unsorted.Sort();                              // in-place sort
string.Join(", ", unsorted)   // Sort()

// Sort() comparer: return -1 (left first), 0 (equal), +1 (right first)
unsorted.Sort((a, b) => b.CompareTo(a));      // descending
string.Join(", ", unsorted)   // Desc

var wordList = new List<string> { "banana", "apple", "cherry" };
string.Join(", ", wordList.OrderBy(w => w.Length))   // By length ASC
string.Join(", ", wordList.OrderByDescending(w => w.Length))   // By length DESC
string.Join(", ", wordList.OrderByDescending(w => w.Length).ThenBy(w => w))   // By length DESC then Alpha
```

    [1, 1, 2, 3, 4, 5, 6, 9]
    [3, 1, 4, 1, 5, 9, 2, 6]
    [1, 1, 2, 3, 4, 5, 6, 9]
    [9, 6, 5, 4, 3, 2, 1, 1]
    [apple, banana, cherry]
    [banana, cherry, apple]
    [banana, cherry, apple]

#### List ToArray, ToList, shallow copy — copying and conversion

These methods create new collections from existing ones. `ToArray()` and `ToList()` produce independent copies of the collection structure, but the elements themselves are NOT cloned — they're shallow copies. Modifying a reference-type element in the copy also modifies it in the original.

> [!danger] Shallow copy trap
> `var copy = original.ToList()` creates a new List, but both lists contain references to the SAME objects. Mutating `copy[0].Name = "changed"` also changes `original[0].Name`. For true independence, you need deep cloning.

```csharp
// Copying and conversion — shallow copy, ToArray, ToList

var original = new List<int> { 1, 2, 3 };
var shallow = new List<int>(original);         // shallow copy (for value types, this is fine)
shallow[0] = 99;
string.Join(", ", original)   // original

// For reference types (List<List<int>>), shallow copy shares inner objects

int[] arr = list.ToArray();                    // List → Array
var backToList = arr.ToList();                 // Array → List
```

    [1, 2, 3]

#### Range and Index operators — slicing syntax

```csharp
// Range and Index operators — C# 8+ slicing with ^ and ..

int[] nums = { 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 };
//              0   1   2   3   4   5   6   7   8   9
```

#### Index operator ^ — from end

```csharp
// Index (^) and Range (..) operators in detail

nums[0]
nums[9]
nums[^1]
nums[^2]
nums[^10]

// [start..end] — start is INCLUSIVE, end is EXCLUSIVE
string.Join(", ", nums[0..3])   // [0..3]
string.Join(", ", nums[3..7])   // [3..7]
string.Join(", ", nums[..3])   // [..3]
string.Join(", ", nums[7..])   // [7..]
string.Join(", ", nums[..])   // [..]

string.Join(", ", nums[^3..])   // [^3..]
string.Join(", ", nums[..^3])   // [..^3]
string.Join(", ", nums[^5..^2])   // [^5..^2]
string.Join(", ", nums[1..^1])   // [1..^1]

// Index and Range can be stored in variables
Index last = ^1;
Range middle = 2..^2;
nums[last]   // Index ^1
string.Join(", ", nums[middle])   // Range 2..^2
```

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

#### Span&lt;T&gt; — zero-allocation slicing

```csharp
// Span<T> — zero-allocation view into contiguous memory

{

    int[] arr = { 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 };

    Span<int> full = arr;                          // span over entire array
    Span<int> slice = arr.AsSpan(2, 5);            // span from index 2, length 5
    Span<int> ranged = arr.AsSpan()[3..7];         // span using range operator

    Console.WriteLine($"full:    [{string.Join(", ", full.ToArray())}]");
    Console.WriteLine($"slice:   [{string.Join(", ", slice.ToArray())}]");     // 30, 40, 50, 60, 70
    Console.WriteLine($"ranged:  [{string.Join(", ", ranged.ToArray())}]");    // 40, 50, 60, 70

    Span<int> window = arr.AsSpan(0, 3);          // [10, 20, 30]
    window[0] = 999;                               // modifies arr[0] directly!
    Console.WriteLine($"arr[0] after span mutation: {arr[0]}");   // 999 — same memory!
    arr[0] = 10;                                   // reset

    Span<int> s = arr;
    Console.WriteLine($"s[..3]:    [{string.Join(", ", s[..3].ToArray())}]");       // first 3
    Console.WriteLine($"s[^3..]:   [{string.Join(", ", s[^3..].ToArray())}]");      // last 3
    Console.WriteLine($"s[2..^2]:  [{string.Join(", ", s[2..^2].ToArray())}]");     // skip first 2 and last 2

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

    [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    [30, 40, 50, 60, 70]
    [40, 50, 60, 70]
    999
    [10, 20, 30]
    [80, 90, 100]
    [30, 40, 50, 60, 70, 80]
    [1, 2, 3, 4, 5]
    [5, 4, 3, 2, 1]
    [0, 0, 0, 0, 0]
    [1, 2, 3]

#### ReadOnlySpan&lt;char&gt; for strings

```csharp
// ReadOnlySpan<char> for strings — zero-allocation substring

string text = "Hello, World!";

// Normal substring — creates a NEW string (allocation):
string sub1 = text.Substring(7, 5);           // "World" — new string on heap
sub1   // Substring

// Span substring — must be in a block
{
    ReadOnlySpan<char> sub2 = text.AsSpan(7, 5);
    Console.WriteLine($"Span:          '{sub2.ToString()}'");

    ReadOnlySpan<char> greeting = text.AsSpan(..5);
    Console.WriteLine($"Span[..5]:     '{greeting.ToString()}'");
}
```

    'World'
    'World'
    'Hello'

#### When to use Array vs List vs Span

| Type | Use when |
|---|---|
| `int[]` (Array) | Fixed data, interop, raw buffers |
| `List<T>` | Dynamic data, add/remove, general purpose (95% of the time) |
| `Span<T>` | Performance-critical slicing without allocation (parsers, serializers, hot loops) |
| `ReadOnlySpan<T>` | Zero-copy string slicing, immutable views |

## Dictionaries

#### Dictionary&lt;TKey, TValue&gt; creation — initializer, indexer, TryGetValue

Hash-based mapping with O(1) average lookup, insert, and remove. Keys must implement `GetHashCode`/`Equals` properly (built-in types like `string`, `int` work out of the box). `SortedDictionary<K,V>` keeps keys sorted. C# has no `defaultdict` — use `GetValueOrDefault` or `TryGetValue` pattern. No `Counter` — use `GroupBy` + `Count` or a manual dictionary.

> [!warning] Anti-patterns
>
> - **Duplicate keys in initializer** — throws `ArgumentException`
> - **Bracket access without checking** key exists — `KeyNotFoundException`
> - **Mutable keys** — changing a key's hash after insertion breaks lookup

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

string.Join(", ", person.Select(kv => $"{kv.Key}:{kv.Value}"))   // person
string.Join(", ", scores.Select(kv => $"{kv.Key}:{kv.Value}"))   // scores
```

    name:Alice, age:30, city:NYC
    Alice:85, Bob:92, Charlie:78

#### Dictionary [], TryGetValue, ContainsKey — access and update

```csharp
// Dictionary access and update — bracket, TryGetValue, GetValueOrDefault

person["name"]
person["age"] = 31;                                                     // update
person["email"] = "alice@example.com";                                  // add new key
person["age"]   // Updated age

// Safe access — TryGetValue returns false if key missing (no exception)
if (scores.TryGetValue("Bob", out int bobScore))
    Console.WriteLine($"Bob's score:          {bobScore}");
scores.GetValueOrDefault("Unknown", -1)   // GetValueOrDefault
```

    Alice
    31
    92
    -1

#### Dictionary Remove, Clear — removing entries

```csharp
// Dictionary removing — Remove by key and Clear

var d = new Dictionary<string, int> { ["a"] = 1, ["b"] = 2, ["c"] = 3 };
d.Remove("b");
string.Join(", ", d.Select(kv => $"{kv.Key}:{kv.Value}"))   // After Remove(b)
d.Clear();
d.Count   // After Clear: Count
```

    a:1, c:3
    Count=0

#### Dictionary foreach KeyValuePair — iterating and membership

```csharp
// Dictionary iteration and membership — foreach and ContainsKey/Value

var dd = new Dictionary<string, object> { ["name"] = "Alice", ["age"] = 30, ["city"] = "NYC" };
foreach (var (key, value) in dd)
    Console.WriteLine($"  {key}: {value}");

dd.ContainsKey("name")   // ContainsKey(name)
dd.ContainsValue("NYC")   // ContainsValue(NYC)
string.Join(", ", dd.Keys)   // Keys
string.Join(", ", dd.Values)   // Values
```

      name: Alice
      age: 30
      city: NYC
    True
    True
    [name, age, city]
    [Alice, 30, NYC]

#### LINQ Where, GroupBy, Count — dictionary filtering and grouping

```csharp
// LINQ on dictionaries — filtering, grouping, and counting

var filtered = scores.Where(kv => kv.Value >= 80)
    .ToDictionary(kv => kv.Key, kv => kv.Value);
string.Join(", ", filtered.Select(kv => $"{kv.Key}:{kv.Value}"))   // Score >= 80

// Group by first letter
var words = new[] { "apple", "banana", "avocado", "cherry", "blueberry" };
var groups = words.GroupBy(w => w[0])
    .ToDictionary(g => g.Key, g => g.ToList());
foreach (var (key, value) in groups)
    Console.WriteLine($"  {key}: [{string.Join(", ", value)}]");

// Count occurrences
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

## Sets

#### HashSet&lt;T&gt; creation — unordered unique elements

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

```csharp
var empty = new HashSet<int>();
var nums = new HashSet<int> { 1, 2, 3, 4, 5 };
var fromList = new List<int> { 1, 2, 2, 3, 3, 3 }.ToHashSet();
var fromStr = "abracadabra".ToHashSet();

string.Join(", ", nums)   // nums
string.Join(", ", fromList)   // fromList
string.Join(", ", fromStr)   // fromStr
```

    {1, 2, 3, 4, 5}
    {1, 2, 3}
    {a, b, r, c, d}

#### HashSet Add, Remove, RemoveWhere — modify set elements

```csharp
// HashSet add and remove — Add returns bool, Remove returns bool

var s = new HashSet<int> { 1, 2, 3 };
s.Add(4)   // Add(4)
s.Add(2)   // Add(2)
s.Remove(1)   // Remove(1)
string.Join(", ", s)   // Set
```

    True
    False
    True
    {2, 3, 4}

#### HashSet UnionWith, IntersectWith, ExceptWith, SymmetricExceptWith

```csharp
// Set operations — union, intersection, difference, symmetric difference

var a = new HashSet<int> { 1, 2, 3, 4, 5 };
var b = new HashSet<int> { 3, 4, 5, 6, 7 };

var union = new HashSet<int>(a); union.UnionWith(b);
var inter = new HashSet<int>(a); inter.IntersectWith(b);
var diff  = new HashSet<int>(a); diff.ExceptWith(b);
var symm  = new HashSet<int>(a); symm.SymmetricExceptWith(b);

string.Join(", ", union)   // Union
string.Join(", ", inter)   // Intersect
string.Join(", ", diff)   // Except
string.Join(", ", symm)   // Symmetric
```

    {1, 2, 3, 4, 5, 6, 7}
    {3, 4, 5}
    {1, 2}
    {1, 2, 7, 6}

#### HashSet Except — data comparison for missing and extra items

```csharp
// Data comparison use case — ExceptWith for finding missing items

var prodIds = new HashSet<string> { "P001", "P002", "P003", "P004" };
var soldIds = new HashSet<string> { "P002", "P004", "P005" };

var unsold = new HashSet<string>(prodIds); unsold.ExceptWith(soldIds);
var unknown = new HashSet<string>(soldIds); unknown.ExceptWith(prodIds);
string.Join(", ", unsold)   // Unsold
string.Join(", ", unknown)   // Unknown
```

    {P001, P003}
    {P005}

#### SortedSet

A `SortedSet<T>` is a collection that maintains its elements in sorted order and guarantees uniqueness — duplicates are silently ignored on `Add()`. It uses a red-black tree internally, giving O(log n) for add, remove, and lookup. Use it when you need both uniqueness and sorted iteration.

```csharp
// SortedSet — elements maintained in sorted order automatically

var unsorted = new HashSet<int> { 5, 3, 1, 4, 2 };
var sorted = new SortedSet<int>(unsorted);
string.Join(", ", sorted)   // SortedSet
$"Min: {sorted.Min}, Max: {sorted.Max}"
```

    {1, 2, 3, 4, 5}
    5

## Tuples and Enums

#### ValueTuple basics

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

point
point.Item1
person.Name
person.Age
```

    (3, 4)
    3
    Alice
    30

#### Tuple deconstruction (var (a,b) = ...) and swap

```csharp
// Deconstruction and swap — unpack tuples into separate variables

var (x, y) = point;
$"Deconstructed: x={x}, y={y}"

// Swap without temp variable
int a2 = 1, b2 = 2;
(a2, b2) = (b2, a2);
$"Swapped: a={a2}, b={b2}"
```

    x=3, y=4
    a=2, b=1

#### Records as an alternative to namedtuple

For named immutable data, C# uses records:

```csharp
record Point(int X, int Y);          // positional record
record class Person(string Name);    // reference type (default)
record struct Coord(int X, int Y);   // value type
```

#### Enum type declaration

```csharp
// Enum — named integer constants for discrete value sets

enum Color { Red = 1, Green = 2, Blue = 3 }
enum Direction { North, South, East, West }           // auto: 0, 1, 2, 3

enum PipelineStatus { Pending, Running, Success, Failed }
```

#### Enum usage — switch, ToString, Enum.Parse, IsDefined

```csharp
// Using enums — access, cast, parse, and iterate

Color.Red
(int)Color.Red
Enum.Parse<Color>("Blue")   // Parse
string.Join(", ", Enum.GetValues<Color>())   // All values
```

    Red
    1
    Blue
    [Red, Green, Blue]

## Stacks, Queues, and Linked Lists

#### Stack — Stack&lt;T&gt; (LIFO)

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
string.Join(", ", stack)   // Stack
stack.Pop()   // Pop
stack.Pop()   // Pop
stack.Peek()   // Peek
stack.Count   // Count
```

    [third, second, first]
    third
    second
    first
    1

#### Queue — Queue&lt;T&gt; (FIFO)

```csharp
// Queue<T> — First In, First Out (FIFO) collection

var queue = new Queue<string>();
queue.Enqueue("first");
queue.Enqueue("second");
queue.Enqueue("third");
string.Join(", ", queue)   // Queue
queue.Dequeue()   // Dequeue
queue.Peek()   // Peek
```

    [first, second, third]
    first
    second

#### LinkedList&lt;T&gt;

```csharp
// LinkedList<T> — doubly-linked list with O(1) insert/remove at any node

var ll = new LinkedList<string>();
ll.AddLast("B");
ll.AddFirst("A");
ll.AddLast("D");
ll.AddAfter(ll.Find("B")!, "C");
string.Join(", ", ll)   // LinkedList
ll.Remove("C");
ll.RemoveFirst();
string.Join(", ", ll)   // After removes
```

    [A, B, C, D]
    [B, D]

#### PriorityQueue&lt;T, TPriority&gt;

```csharp
// PriorityQueue<T, TPriority> — dequeue by lowest priority first (.NET 6+)

var pq = new PriorityQueue<string, int>();
pq.Enqueue("low priority", 3);
pq.Enqueue("high priority", 1);
pq.Enqueue("medium priority", 2);

pq.Dequeue()   // Dequeue
pq.Dequeue()   // Dequeue
```

    high priority
    medium priority

#### ETL task queue

```csharp
// ETL task queue — process extract/transform/load jobs in FIFO order

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

      Processing: extract → users
      Processing: extract → orders
      Processing: transform → users

## Collection Comparison and Choosing the Right One

#### Collection cheat sheet

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

#### Decision guide

```csharp
// Decision guide — choose the right collection by access pattern

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
