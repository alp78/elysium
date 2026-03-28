---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [lists, dictionaries, sets, tuples, arrays, List, Dictionary, HashSet, LINQ]
keywords: [List, Dictionary, HashSet, Queue, Stack, IEnumerable, LINQ, array, SortedDictionary, ConcurrentDictionary]
description: "C# collections reference with executable examples and cell outputs — covers List, Dictionary, HashSet, arrays, Queue, Stack, and immutable collections. See [[05_py_collections]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[05_py_collections]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 05. Collections - C#

## Arrays and Lists

<h4>Array — <code style="font-size:0.75em">T[]</code> (fixed size)</h4>

Arrays are fixed-size, contiguous memory with O(1) index access — the fastest collection type due to cache locality. Size is set at creation and cannot be changed. Use arrays for fixed data, buffers, interop, and performance-critical indexed access. For dynamic sizing (add/remove), use `List<T>` instead.

> [!warning] Anti-patterns
> - **`Array.Resize`** creates a new array and copies — it's not in-place
> - **Resizing arrays manually** — use `List<T>` for dynamic collections

```csharp
int[] nums = { 1, 2, 3, 4, 5 };                      // literal
int[] zeros = new int[5];                            // [0, 0, 0, 0, 0]
int[] ranged = Enumerable.Range(0, 5).ToArray();     // [0, 1, 2, 3, 4]
string[] words = new[] { "hello", "world" };         // type inferred

Console.WriteLine($"nums:    [{string.Join(", ", nums)}]");
Console.WriteLine($"zeros:   [{string.Join(", ", zeros)}]");
Console.WriteLine($"ranged:  [{string.Join(", ", ranged)}]");
Console.WriteLine($"Length:  {nums.Length}");          // .Length (not .Count)

Console.WriteLine($"nums[0]: {nums[0]}");              // first
Console.WriteLine($"nums[^1]:{nums[^1]}");             // last (from end)
Console.WriteLine($"[1..4]:  [{string.Join(", ", nums[1..4])}]");  // slice

// Array: can't add/remove
// nums.Add(6);  // Compile error! No Add method on array
```

    nums:    [1, 2, 3, 4, 5]
    zeros:   [0, 0, 0, 0, 0]
    ranged:  [0, 1, 2, 3, 4]
    Length:  5
    nums[0]: 1
    nums[^1]:5
    [1..4]:  [2, 3, 4]

<h4><code style="font-size:0.75em">List&lt;T&gt;</code> — adding and removing</h4>

```csharp
// List<T> — dynamic array with Add, Insert, Remove operations

var empty = new List<int>();
var list = new List<int> { 1, 2, 3, 4, 5 };
// var mixed = new List<???> { 1, "hello" };  // NOT allowed — single type only
//   Use List<object> if you really need mixed types (rare, avoid)

Console.WriteLine($"list:    [{string.Join(", ", list)}]");
Console.WriteLine($"Count:   {list.Count}");            // .Count (not .Length)

var lst = new List<int> { 1, 2, 3 };
lst.Add(4);                                   // add to end
lst.Insert(0, 0);                             // insert at index
lst.AddRange(new[] { 5, 6 });                 // add multiple
Console.WriteLine($"After adds: [{string.Join(", ", lst)}]");

lst = new List<int> { 1, 2, 3, 2, 4, 5 };
lst.Remove(2);                                // remove FIRST occurrence of value
Console.WriteLine($"Remove(2):  [{string.Join(", ", lst)}]");
lst.RemoveAt(0);                              // remove at index
Console.WriteLine($"RemoveAt(0):[{string.Join(", ", lst)}]");
int last = lst[^1]; lst.RemoveAt(lst.Count - 1);  // pop last (no built-in Pop)
Console.WriteLine($"Pop last:   [{string.Join(", ", lst)}] (popped: {last})");
lst.Clear();                                  // remove all
Console.WriteLine($"Clear():    [{string.Join(", ", lst)}]");
```

    list:    [1, 2, 3, 4, 5]
    Count:   5
    After adds: [0, 1, 2, 3, 4, 5, 6]
    Remove(2):  [1, 3, 2, 4, 5]
    RemoveAt(0):[3, 2, 4, 5]
    Pop last:   [3, 2, 4] (popped: 5)
    Clear():    []

#### List Contains, IndexOf, Find, Exists — search and membership

```csharp
// Search and membership — Contains, IndexOf, FindAll, Find, Exists

lst = new List<int> { 10, 20, 30, 40, 30, 50 };
Console.WriteLine($"Contains(30):  {lst.Contains(30)}");
Console.WriteLine($"IndexOf(30):   {lst.IndexOf(30)}");           // 2 (first occurrence)
Console.WriteLine($"FindAll(>25):  [{string.Join(", ", lst.FindAll(x => x > 25))}]");
Console.WriteLine($"Exists(>40):   {lst.Exists(x => x > 40)}");
Console.WriteLine($"Find(>25):     {lst.Find(x => x > 25)}");
```

    Contains(30):  True
    IndexOf(30):   2
    FindAll(>25):  [30, 40, 30, 50]
    Exists(>40):   True
    Find(>25):     30

#### List Sort, OrderBy, ThenBy — sorting and custom comparers

```csharp
// Sorting — OrderBy (new sequence) vs Sort (in-place mutation)

var unsorted = new List<int> { 3, 1, 4, 1, 5, 9, 2, 6 };
Console.WriteLine($"OrderBy:     [{string.Join(", ", unsorted.OrderBy(x => x))}]");  // new sequence
Console.WriteLine($"original:    [{string.Join(", ", unsorted)}]");                   // unchanged

unsorted.Sort();                              // in-place sort
Console.WriteLine($"Sort():      [{string.Join(", ", unsorted)}]");

// Sort() comparer: return -1 (left first), 0 (equal), +1 (right first)
unsorted.Sort((a, b) => b.CompareTo(a));      // descending
Console.WriteLine($"Desc:        [{string.Join(", ", unsorted)}]");

var wordList = new List<string> { "banana", "apple", "cherry" };
Console.WriteLine($"By length ASC:   [{string.Join(", ", wordList.OrderBy(w => w.Length))}]");
Console.WriteLine($"By length DESC:   [{string.Join(", ", wordList.OrderByDescending(w => w.Length))}]");
Console.WriteLine($"By length DESC then Alpha:   [{string.Join(", ", wordList.OrderByDescending(w => w.Length).ThenBy(w => w))}]");
```

    OrderBy:     [1, 1, 2, 3, 4, 5, 6, 9]
    original:    [3, 1, 4, 1, 5, 9, 2, 6]
    Sort():      [1, 1, 2, 3, 4, 5, 6, 9]
    Desc:        [9, 6, 5, 4, 3, 2, 1, 1]
    By length ASC:   [apple, banana, cherry]
    By length DESC:   [banana, cherry, apple]
    By length DESC then Alpha:   [banana, cherry, apple]

#### List ToArray, ToList, shallow copy — copying and conversion

```csharp
// Copying and conversion — shallow copy, ToArray, ToList

var original = new List<int> { 1, 2, 3 };
var shallow = new List<int>(original);         // shallow copy (for value types, this is fine)
shallow[0] = 99;
Console.WriteLine($"original: [{string.Join(", ", original)}]");  // [1, 2, 3] — unchanged (int is value type)

// For reference types (List<List<int>>), shallow copy shares inner objects

int[] arr = list.ToArray();                    // List → Array
var backToList = arr.ToList();                 // Array → List
```

    original: [1, 2, 3]

#### Range and Index operators — slicing syntax

```csharp
// Range and Index operators — C# 8+ slicing with ^ and ..

int[] nums = { 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 };
//              0   1   2   3   4   5   6   7   8   9
```

<h4>Index operator <code style="font-size:0.75em">^</code> — from end</h4>

```csharp
// Index (^) and Range (..) operators in detail

Console.WriteLine($"nums[0]:   {nums[0]}");        // 10  (first)
Console.WriteLine($"nums[9]:   {nums[9]}");        // 100 (last by position)
Console.WriteLine($"nums[^1]:  {nums[^1]}");       // 100 (last — ^1 = from end)
Console.WriteLine($"nums[^2]:  {nums[^2]}");       // 90  (second from end)
Console.WriteLine($"nums[^10]: {nums[^10]}");      // 10  (first — ^Length)

// [start..end] — start is INCLUSIVE, end is EXCLUSIVE
Console.WriteLine($"[0..3]:    [{string.Join(", ", nums[0..3])}]");     // 10, 20, 30
Console.WriteLine($"[3..7]:    [{string.Join(", ", nums[3..7])}]");     // 40, 50, 60, 70
Console.WriteLine($"[..3]:     [{string.Join(", ", nums[..3])}]");      // 10, 20, 30  (start defaults to 0)
Console.WriteLine($"[7..]:     [{string.Join(", ", nums[7..])}]");      // 80, 90, 100 (end defaults to length)
Console.WriteLine($"[..]:      [{string.Join(", ", nums[..])}]");       // all elements (full copy)

Console.WriteLine($"[^3..]:    [{string.Join(", ", nums[^3..])}]");     // 80, 90, 100  (last 3)
Console.WriteLine($"[..^3]:    [{string.Join(", ", nums[..^3])}]");     // 10..70       (all except last 3)
Console.WriteLine($"[^5..^2]:  [{string.Join(", ", nums[^5..^2])}]");   // 60, 70, 80   (from 5th-last to 2nd-last)
Console.WriteLine($"[1..^1]:   [{string.Join(", ", nums[1..^1])}]");    // 20..90       (skip first and last)

// Index and Range can be stored in variables
Index last = ^1;
Range middle = 2..^2;
Console.WriteLine($"Index ^1:  {nums[last]}");                          // 100
Console.WriteLine($"Range 2..^2: [{string.Join(", ", nums[middle])}]"); // 30, 40, 50, 60, 70, 80
```

    nums[0]:   10
    nums[9]:   100
    nums[^1]:  100
    nums[^2]:  90
    nums[^10]: 10
    [0..3]:    [10, 20, 30]
    [3..7]:    [40, 50, 60, 70]
    [..3]:     [10, 20, 30]
    [7..]:     [80, 90, 100]
    [..]:      [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    [^3..]:    [80, 90, 100]
    [..^3]:    [10, 20, 30, 40, 50, 60, 70]
    [^5..^2]:  [60, 70, 80]
    [1..^1]:   [20, 30, 40, 50, 60, 70, 80, 90]
    Index ^1:  100
    Range 2..^2: [30, 40, 50, 60, 70, 80]

<h4><code style="font-size:0.75em">Span&lt;T&gt;</code> — zero-allocation slicing</h4>

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

<h4><code style="font-size:0.75em">ReadOnlySpan&lt;char&gt;</code> for strings</h4>

```csharp
// ReadOnlySpan<char> for strings — zero-allocation substring

string text = "Hello, World!";

// Normal substring — creates a NEW string (allocation):
string sub1 = text.Substring(7, 5);           // "World" — new string on heap
Console.WriteLine($"Substring:     '{sub1}'");

// Span substring — must be in a block
{
    ReadOnlySpan<char> sub2 = text.AsSpan(7, 5);
    Console.WriteLine($"Span:          '{sub2.ToString()}'");

    ReadOnlySpan<char> greeting = text.AsSpan(..5);
    Console.WriteLine($"Span[..5]:     '{greeting.ToString()}'");
}
```

    Substring:     'World'
    Span:          'World'
    Span[..5]:     'Hello'

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

Console.WriteLine($"person: {string.Join(", ", person.Select(kv => $"{kv.Key}:{kv.Value}"))}");
Console.WriteLine($"scores: {string.Join(", ", scores.Select(kv => $"{kv.Key}:{kv.Value}"))}");
```

    person: name:Alice, age:30, city:NYC
    scores: Alice:85, Bob:92, Charlie:78

#### Dictionary [], TryGetValue, ContainsKey — access and update

```csharp
// Dictionary access and update — bracket, TryGetValue, GetValueOrDefault

Console.WriteLine($"person[\"name\"]:        {person["name"]}");       // KeyNotFoundException if missing
person["age"] = 31;                                                     // update
person["email"] = "alice@example.com";                                  // add new key
Console.WriteLine($"Updated age:          {person["age"]}");

// Safe access — TryGetValue returns false if key missing (no exception)
if (scores.TryGetValue("Bob", out int bobScore))
    Console.WriteLine($"Bob's score:          {bobScore}");
Console.WriteLine($"GetValueOrDefault:    {scores.GetValueOrDefault("Unknown", -1)}");
```

    person["name"]:        Alice
    Updated age:          31
    Bob's score:          92
    GetValueOrDefault:    -1

#### Dictionary Remove, Clear — removing entries

```csharp
// Dictionary removing — Remove by key and Clear

var d = new Dictionary<string, int> { ["a"] = 1, ["b"] = 2, ["c"] = 3 };
d.Remove("b");
Console.WriteLine($"After Remove(b): {string.Join(", ", d.Select(kv => $"{kv.Key}:{kv.Value}"))}");
d.Clear();
Console.WriteLine($"After Clear:     Count={d.Count}");
```

    After Remove(b): a:1, c:3
    After Clear:     Count=0

#### Dictionary foreach KeyValuePair — iterating and membership

```csharp
// Dictionary iteration and membership — foreach and ContainsKey/Value

var dd = new Dictionary<string, object> { ["name"] = "Alice", ["age"] = 30, ["city"] = "NYC" };
foreach (var (key, value) in dd)
    Console.WriteLine($"  {key}: {value}");

Console.WriteLine($"ContainsKey(name):    {dd.ContainsKey("name")}");
Console.WriteLine($"ContainsValue(NYC):   {dd.ContainsValue("NYC")}");
Console.WriteLine($"Keys:   [{string.Join(", ", dd.Keys)}]");
Console.WriteLine($"Values: [{string.Join(", ", dd.Values)}]");
```

      name: Alice
      age: 30
      city: NYC
    ContainsKey(name):    True
    ContainsValue(NYC):   True
    Keys:   [name, age, city]
    Values: [Alice, 30, NYC]

#### LINQ Where, GroupBy, Count — dictionary filtering and grouping

```csharp
// LINQ on dictionaries — filtering, grouping, and counting

var filtered = scores.Where(kv => kv.Value >= 80)
    .ToDictionary(kv => kv.Key, kv => kv.Value);
Console.WriteLine($"Score >= 80: {string.Join(", ", filtered.Select(kv => $"{kv.Key}:{kv.Value}"))}");

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

    Score >= 80: Alice:85, Bob:92
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

`HashSet<T>` stores unique elements with O(1) membership testing, deduplication, and built-in set algebra (`UnionWith`, `IntersectWith`, `ExceptWith`, `SymmetricExceptWith`). `SortedSet<T>` keeps elements sorted. No `frozenset` equivalent — use `ImmutableHashSet` from `System.Collections.Immutable`.

> [!warning] Anti-patterns
> - **`List` + `Contains`** for uniqueness checks — O(n) per check vs O(1) for `HashSet`
> - **Mutable elements** — hash changes break lookup

```csharp
var empty = new HashSet<int>();
var nums = new HashSet<int> { 1, 2, 3, 4, 5 };
var fromList = new List<int> { 1, 2, 2, 3, 3, 3 }.ToHashSet();
var fromStr = "abracadabra".ToHashSet();

Console.WriteLine($"nums:     {{{string.Join(", ", nums)}}}");
Console.WriteLine($"fromList: {{{string.Join(", ", fromList)}}}");
Console.WriteLine($"fromStr:  {{{string.Join(", ", fromStr)}}}");
```

    nums:     {1, 2, 3, 4, 5}
    fromList: {1, 2, 3}
    fromStr:  {a, b, r, c, d}

#### HashSet Add, Remove, RemoveWhere — modify set elements

```csharp
// HashSet add and remove — Add returns bool, Remove returns bool

var s = new HashSet<int> { 1, 2, 3 };
Console.WriteLine($"Add(4):  {s.Add(4)}");     // True (new)
Console.WriteLine($"Add(2):  {s.Add(2)}");     // False (duplicate ignored)
Console.WriteLine($"Remove(1): {s.Remove(1)}");
Console.WriteLine($"Set: {{{string.Join(", ", s)}}}");
```

    Add(4):  True
    Add(2):  False
    Remove(1): True
    Set: {2, 3, 4}

#### HashSet UnionWith, IntersectWith, ExceptWith, SymmetricExceptWith

```csharp
// Set operations — union, intersection, difference, symmetric difference

var a = new HashSet<int> { 1, 2, 3, 4, 5 };
var b = new HashSet<int> { 3, 4, 5, 6, 7 };

var union = new HashSet<int>(a); union.UnionWith(b);
var inter = new HashSet<int>(a); inter.IntersectWith(b);
var diff  = new HashSet<int>(a); diff.ExceptWith(b);
var symm  = new HashSet<int>(a); symm.SymmetricExceptWith(b);

Console.WriteLine($"Union:     {{{string.Join(", ", union)}}}");
Console.WriteLine($"Intersect: {{{string.Join(", ", inter)}}}");
Console.WriteLine($"Except:    {{{string.Join(", ", diff)}}}");
Console.WriteLine($"Symmetric: {{{string.Join(", ", symm)}}}");
```

    Union:     {1, 2, 3, 4, 5, 6, 7}
    Intersect: {3, 4, 5}
    Except:    {1, 2}
    Symmetric: {1, 2, 7, 6}

#### HashSet Except — data comparison for missing and extra items

```csharp
// Data comparison use case — ExceptWith for finding missing items

var prodIds = new HashSet<string> { "P001", "P002", "P003", "P004" };
var soldIds = new HashSet<string> { "P002", "P004", "P005" };

var unsold = new HashSet<string>(prodIds); unsold.ExceptWith(soldIds);
var unknown = new HashSet<string>(soldIds); unknown.ExceptWith(prodIds);
Console.WriteLine($"Unsold:  {{{string.Join(", ", unsold)}}}");
Console.WriteLine($"Unknown: {{{string.Join(", ", unknown)}}}");
```

    Unsold:  {P001, P003}
    Unknown: {P005}

<h4><code style="font-size:0.75em">SortedSet</code></h4>

```csharp
// SortedSet — elements maintained in sorted order automatically

var unsorted = new HashSet<int> { 5, 3, 1, 4, 2 };
var sorted = new SortedSet<int>(unsorted);
Console.WriteLine($"SortedSet: {{{string.Join(", ", sorted)}}}");
Console.WriteLine($"Min: {sorted.Min}, Max: {sorted.Max}");
```

    SortedSet: {1, 2, 3, 4, 5}
    Min: 1, Max: 5

## Tuples and Enums

<h4><code style="font-size:0.75em">ValueTuple</code> basics</h4>

`ValueTuple` is a lightweight value type with named fields — lives on the stack, compared by value, no heap allocation. Deconstruction (`var (x, y) = tuple`) unpacks into separate variables. Avoid `System.Tuple` (older reference type using `Item1`/`Item2`) in new code. For tuples with more than 3-4 fields, use a `record` or class instead. For public APIs, records are more discoverable and documented.

```csharp
var point = (3, 4);
var person = (Name: "Alice", Age: 30, City: "NYC");

Console.WriteLine($"point:     {point}");
Console.WriteLine($"point.Item1: {point.Item1}");
Console.WriteLine($"person.Name: {person.Name}");
Console.WriteLine($"person.Age:  {person.Age}");
```

    point:     (3, 4)
    point.Item1: 3
    person.Name: Alice
    person.Age:  30

#### Tuple deconstruction (var (a,b) = ...) and swap

```csharp
// Deconstruction and swap — unpack tuples into separate variables

var (x, y) = point;
Console.WriteLine($"Deconstructed: x={x}, y={y}");

// Swap without temp variable
int a2 = 1, b2 = 2;
(a2, b2) = (b2, a2);
Console.WriteLine($"Swapped: a={a2}, b={b2}");
```

    Deconstructed: x=3, y=4
    Swapped: a=2, b=1

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

Console.WriteLine($"Color.Red:       {Color.Red}");
Console.WriteLine($"(int)Color.Red:  {(int)Color.Red}");
Console.WriteLine($"Parse:           {Enum.Parse<Color>("Blue")}");
Console.WriteLine($"All values:      [{string.Join(", ", Enum.GetValues<Color>())}]");
```

    Color.Red:       Red
    (int)Color.Red:  1
    Parse:           Blue
    All values:      [Red, Green, Blue]

## Stacks, Queues, and Linked Lists

<h4>Stack — <code style="font-size:0.75em">Stack&lt;T&gt;</code> (LIFO)</h4>

`Push` adds to top, `Pop` removes and returns top, `Peek` reads top without removing — all O(1). `TryPop`/`TryPeek` return `false` if empty instead of throwing. Natural for undo systems, DFS traversal, balanced bracket checking, and reverse iteration. For FIFO processing use `Queue<T>`; for indexed access use `List<T>`.

```csharp
var stack = new Stack<string>();
stack.Push("first");
stack.Push("second");
stack.Push("third");
Console.WriteLine($"Stack: [{string.Join(", ", stack)}]");
Console.WriteLine($"Pop:   {stack.Pop()}");
Console.WriteLine($"Pop:   {stack.Pop()}");
Console.WriteLine($"Peek:  {stack.Peek()}");
Console.WriteLine($"Count: {stack.Count}");
```

    Stack: [third, second, first]
    Pop:   third
    Pop:   second
    Peek:  first
    Count: 1

<h4>Queue — <code style="font-size:0.75em">Queue&lt;T&gt;</code> (FIFO)</h4>

```csharp
// Queue<T> — First In, First Out (FIFO) collection

var queue = new Queue<string>();
queue.Enqueue("first");
queue.Enqueue("second");
queue.Enqueue("third");
Console.WriteLine($"Queue:   [{string.Join(", ", queue)}]");
Console.WriteLine($"Dequeue: {queue.Dequeue()}");
Console.WriteLine($"Peek:    {queue.Peek()}");
```

    Queue:   [first, second, third]
    Dequeue: first
    Peek:    second

<h4><code style="font-size:0.75em">LinkedList&lt;T&gt;</code></h4>

```csharp
// LinkedList<T> — doubly-linked list with O(1) insert/remove at any node

var ll = new LinkedList<string>();
ll.AddLast("B");
ll.AddFirst("A");
ll.AddLast("D");
ll.AddAfter(ll.Find("B")!, "C");
Console.WriteLine($"LinkedList: [{string.Join(", ", ll)}]");
ll.Remove("C");
ll.RemoveFirst();
Console.WriteLine($"After removes: [{string.Join(", ", ll)}]");
```

    LinkedList: [A, B, C, D]
    After removes: [B, D]

<h4><code style="font-size:0.75em">PriorityQueue&lt;T, TPriority&gt;</code></h4>

```csharp
// PriorityQueue<T, TPriority> — dequeue by lowest priority first (.NET 6+)

var pq = new PriorityQueue<string, int>();
pq.Enqueue("low priority", 3);
pq.Enqueue("high priority", 1);
pq.Enqueue("medium priority", 2);

Console.WriteLine($"Dequeue: {pq.Dequeue()}");
Console.WriteLine($"Dequeue: {pq.Dequeue()}");
```

    Dequeue: high priority
    Dequeue: medium priority

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
