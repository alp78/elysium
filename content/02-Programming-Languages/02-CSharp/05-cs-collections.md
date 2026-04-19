---
title: "05 - Collections - C#"
tags:
  - csharp
aliases: [lists, dictionaries, sets, tuples, arrays, List, Dictionary, HashSet, LINQ]
description: "C# collections reference with executable examples and captured stdout for arrays, lists, dictionaries, sets, tuples, enums, stacks, queues, immutable collections, and frozen collections."
created: 2026-03-22
updated: 2026-04-16
status: complete
---

# 05. Collections - C#

> [!quote]+
>
> "Algorithms + Data Structures = Programs."
>
> — **Niklaus Wirth**, *Algorithms + Data Structures = Programs* (1976)
>
> "Smart data structures and dumb code works a lot better than the other way around."
>
> — **Eric S. Raymond**, *The Cathedral and the Bazaar* (1999)

> [!abstract]- Summary
>
> - Use `List<T>` as the default ordered mutable collection, `T[]` for fixed-size contiguous storage, and `Span<T>` or `Memory<T>` when copying data is too expensive.
> - Use `Dictionary<TKey, TValue>` for key lookup, `HashSet<T>` for membership, and the sorted variants only when ordered iteration is a real requirement.
> - Use `ValueTuple` for local grouping, `record` for reusable named shapes, and `enum` only with explicit validation at external boundaries.
> - Use `ImmutableHashSet<T>` and `FrozenDictionary<TKey, TValue>` for share-safe or build-once read-many workloads.
> - Treat `ToList()` and `ToArray()` as shallow copies for reference types, and remember that `ExceptWith()` mutates the target set.

> [!note]- Glossary
>
> - `T[]`: fixed-size contiguous storage with O(1) indexed access.
> - `List<T>`: dynamic array with amortized O(1) `Add()` and O(1) indexed access.
> - `Span<T>`: stack-only slice over contiguous memory for synchronous zero-allocation work.
> - `Memory<T>`: heap-safe slice that can cross `await` and live in fields.
> - `ReadOnlySpan<char>`: non-allocating text view for tokenization and parsing.
> - `Dictionary<TKey, TValue>`: hash-based key lookup with O(1) average reads and writes.
> - `HashSet<T>`: hash-based uniqueness and membership testing with O(1) average `Contains()`.
> - `SortedSet<T>` and `SortedDictionary<TKey, TValue>`: tree-backed collections with O(log n) operations and ordered iteration.
> - `ImmutableHashSet<T>`: persistent set whose mutations produce a new snapshot.
> - `FrozenDictionary<TKey, TValue>`: build-once read-many dictionary optimized for repeated lookups on .NET 8+.

## Arrays and Lists

Sequential collections are the baseline for most C# code. Start with `List<T>` unless the size is fixed, the API demands `T[]`, or allocation pressure forces a slice-based design.

### `T[]`, `List<T>`, `Span<T>`, and `Memory<T>`

#### Use `T[]` for fixed-size contiguous storage

Arrays give the cheapest indexed access and the clearest memory layout. They are the right tool for fixed buffers, interop boundaries, and algorithms that rely on `^` or `..` slicing syntax.

*Prints a fixed array, reads the last element, and slices the middle range.*
```csharp
int[] nums = { 1, 2, 3, 4, 5 };
Console.WriteLine($"nums: [{string.Join(", ", nums)}]");
Console.WriteLine($"last: {nums[^1]}");
Console.WriteLine($"slice: [{string.Join(", ", nums[1..4])}]");
```
```text
nums: [1, 2, 3, 4, 5]
last: 5
slice: [2, 3, 4]
```

#### Use `List<T>` for ordered mutable data

`List<T>` is a dynamic array. It keeps O(1) indexed access, supports in-place mutation, and usually replaces hand-managed resize logic.

*Sorts a list in place and checks membership and position.*
```csharp
var list = new List<int> { 3, 1, 2 };
list.Add(4);
list.Insert(0, 0);
list.Sort();

Console.WriteLine($"sorted: [{string.Join(", ", list)}]");
Console.WriteLine($"contains 3: {list.Contains(3)}");
Console.WriteLine($"index of 4: {list.IndexOf(4)}");
```
```text
sorted: [0, 1, 2, 3, 4]
contains 3: True
index of 4: 4
```

#### Use `Span<T>` for synchronous slices and `Memory<T>` across boundaries

`Span<T>` and `Memory<T>` let you work on the same backing store without copying. Use `Span<T>` inside synchronous code and switch to `Memory<T>` when the slice must survive `await`.

*Mutates the same backing array through both `Span<int>` and `Memory<int>` windows.*
```csharp
int[] buffer = { 10, 20, 30, 40 };
Span<int> spanWindow = buffer.AsSpan(1, 2);
spanWindow[0] = 200;

Memory<int> memoryWindow = buffer.AsMemory(2, 2);
memoryWindow.Span[1] = 400;

Console.WriteLine($"buffer: [{string.Join(", ", buffer)}]");
Console.WriteLine($"span: [{string.Join(", ", spanWindow.ToArray())}]");
Console.WriteLine($"memory: [{string.Join(", ", memoryWindow.ToArray())}]");
```
```text
buffer: [10, 200, 30, 400]
span: [200, 30]
memory: [30, 400]
```

#### Use `ReadOnlySpan<char>` to parse without `Substring()`

`ReadOnlySpan<char>` keeps parsing on the original string instead of allocating a new one. That matters in high-throughput text pipelines and protocol parsers.

*Slices a token from a CSV string without allocating a substring.*
```csharp
string csv = "alpha,beta,gamma";
ReadOnlySpan<char> token = csv.AsSpan(6, 4);

Console.WriteLine($"token: {token}");
Console.WriteLine($"starts with b: {token[0] == 'b'}");
```
```text
token: beta
starts with b: True
```

## Dictionaries

Keyed collections exist to answer lookup questions quickly. `Dictionary<TKey, TValue>` is the default, while sorted, frozen, and immutable variants solve narrower iteration or sharing problems.

### `Dictionary<TKey, TValue>` and related lookup types

#### Prefer `TryGetValue()` when missing keys are normal

The indexer `dict[key]` is fine when absence is a bug. If missing data is expected, `TryGetValue()` expresses that contract directly and avoids exception-driven control flow.

*Reads a known key safely and prints the final dictionary contents in key order.*
```csharp
using System.Linq;

var counts = new Dictionary<string, int>
{
    ["ok"] = 1,
    ["warn"] = 2,
};
counts["error"] = 3;

Console.WriteLine($"has warn: {counts.TryGetValue("warn", out var warnCount)}");
Console.WriteLine($"warn count: {warnCount}");
Console.WriteLine(string.Join(", ", counts.OrderBy(kv => kv.Key).Select(kv => $"{kv.Key}={kv.Value}")));
```
```text
has warn: True
warn count: 2
error=3, ok=1, warn=2
```

#### Use `GroupBy()` with `ToDictionary()` for grouped counts

`Dictionary<TKey, TValue>` is often the terminal materialization step after a grouping pipeline. That pattern covers frequency counting, aggregation, and key-based rollups without a bespoke counter type.

*Groups repeated event names and materializes the counts as a dictionary.*
```csharp
using System.Linq;

string[] events = { "etl", "etl", "load", "validate" };
var grouped = events
    .GroupBy(x => x)
    .ToDictionary(group => group.Key, group => group.Count());

Console.WriteLine(string.Join(", ", grouped.OrderBy(kv => kv.Key).Select(kv => $"{kv.Key}={kv.Value}")));
```
```text
etl=2, load=1, validate=1
```

#### Use `SortedDictionary<TKey, TValue>`, `FrozenDictionary<TKey, TValue>`, and `ImmutableHashSet<T>` for specialized lookup workloads

Reach for `SortedDictionary<TKey, TValue>` when ordered key iteration matters, for `FrozenDictionary<TKey, TValue>` when the data is loaded once and read repeatedly, and for `ImmutableHashSet<T>` when readers need stable snapshots.

*Builds ordered, frozen, and immutable lookup structures and prints the observable differences.*
```csharp
using System.Collections.Frozen;
using System.Collections.Immutable;
using System.Linq;

var sorted = new SortedDictionary<int, string>
{
    [2] = "transform",
    [1] = "extract",
    [3] = "load",
};

var frozen = new[]
{
    (Key: "warn", Value: 2),
    (Key: "error", Value: 5),
}.ToFrozenDictionary(x => x.Key, x => x.Value);

var immutable = ImmutableHashSet.Create("extract", "transform");
var immutableNext = immutable.Add("load");

Console.WriteLine(string.Join(" -> ", sorted.Select(kv => $"{kv.Key}:{kv.Value}")));
Console.WriteLine($"frozen warn: {frozen["warn"]}");
Console.WriteLine($"snapshot: [{string.Join(", ", immutable.Order())}]");
Console.WriteLine($"next: [{string.Join(", ", immutableNext.Order())}]");
```
```text
1:extract -> 2:transform -> 3:load
frozen warn: 2
snapshot: [extract, transform]
next: [extract, load, transform]
```

## Sets

Sets answer uniqueness and membership questions better than lists. Use them as soon as duplicates are invalid or `Contains()` dominates the workload.

### `HashSet<T>` and `SortedSet<T>`

#### Use `HashSet<T>` for uniqueness and set difference

`HashSet<T>` removes duplicates, gives O(1) average membership checks, and exposes set algebra methods that map directly to comparison tasks such as missing or extra records.

*Deduplicates tags and computes the missing and extra members between two sets.*
```csharp
using System.Linq;

var tags = new HashSet<string> { "etl", "batch", "etl" };
var current = new HashSet<string> { "users", "orders", "logs" };
var desired = new HashSet<string> { "orders", "logs", "billing" };

var missing = new HashSet<string>(desired);
missing.ExceptWith(current);

var extra = new HashSet<string>(current);
extra.ExceptWith(desired);

Console.WriteLine($"tags: [{string.Join(", ", tags.Order())}]");
Console.WriteLine($"missing: [{string.Join(", ", missing.Order())}]");
Console.WriteLine($"extra: [{string.Join(", ", extra.Order())}]");
```
```text
tags: [batch, etl]
missing: [billing]
extra: [users]
```

#### Use `SortedSet<T>.GetViewBetween()` for ordered range queries

`SortedSet<T>` trades O(1) average lookup for O(log n) operations and sorted traversal. That trade is worth it when you need ordered windows or lower and upper bound views.

*Builds a sorted set and extracts a live range view from it.*
```csharp
var ids = new SortedSet<int> { 5, 1, 3, 2, 4 };
var range = ids.GetViewBetween(2, 4);

Console.WriteLine($"all: [{string.Join(", ", ids)}]");
Console.WriteLine($"range: [{string.Join(", ", range)}]");
```
```text
all: [1, 2, 3, 4, 5]
range: [2, 3, 4]
```

## Tuples and Enums

Tuples and enums are lightweight modeling tools. They keep local code concise, but they still need clear boundaries: `ValueTuple` is not a substitute for a reusable domain type, and `enum` values from outside the process are never trustworthy by default.

### `ValueTuple`, `record`, and `enum`

#### Use `ValueTuple` for local grouping and `record` for reusable named shapes

Use `ValueTuple` when the grouping is short-lived and local. When the shape matters outside the current method, move to a `record` so the type name carries intent.

*Creates a tuple, deconstructs it, and prints a `record` instance with named fields.*
```csharp
var point = (X: 3, Y: 4);
var (x, y) = point;
var person = new Person("alice", 30);

Console.WriteLine($"point: ({point.X}, {point.Y})");
Console.WriteLine($"deconstructed: {x}, {y}");
Console.WriteLine(person);

record Person(string Name, int Age);
```
```text
point: (3, 4)
deconstructed: 3, 4
Person { Name = alice, Age = 30 }
```

#### Validate external input before trusting an `enum`

`Enum.TryParse()` only answers whether text matched a token. It does not make arbitrary integer payloads safe. Use `Enum.IsDefined()` when the source is an external boundary such as a file, queue, or API.

*Parses an enum name and checks whether raw integer values map to defined members.*
```csharp
var parsed = Enum.TryParse<PipelineStatus>("Success", out var status);

Console.WriteLine($"parsed: {parsed}");
Console.WriteLine($"value: {status}");
Console.WriteLine($"defined 4: {Enum.IsDefined(typeof(PipelineStatus), 4)}");
Console.WriteLine($"defined 99: {Enum.IsDefined(typeof(PipelineStatus), 99)}");

enum PipelineStatus
{
    Pending,
    Running,
    Success,
    Failed,
}
```
```text
parsed: True
value: Success
defined 4: False
defined 99: False
```

## Processing Collections

Processing-order collections model how work should flow through the system. Choose them based on the order guarantee you need, not because they happen to store the same element type.

### `Stack<T>`, `Queue<T>`, `LinkedList<T>`, and `PriorityQueue<T, TPriority>`

#### Use `Stack<T>` and `Queue<T>` for explicit processing order

`Stack<T>` models LIFO flows such as undo stacks and depth-first traversal. `Queue<T>` models FIFO work such as pipeline stages, schedulers, and producer-consumer buffers.

*Pushes and dequeues work items to show the difference between LIFO and FIFO processing.*
```csharp
var stack = new Stack<string>();
stack.Push("extract");
stack.Push("transform");
stack.Push("load");

var queue = new Queue<string>();
queue.Enqueue("extract");
queue.Enqueue("transform");
queue.Enqueue("load");

Console.WriteLine($"stack pop: {stack.Pop()}");
Console.WriteLine($"stack peek: {stack.Peek()}");
Console.WriteLine($"queue dequeue: {queue.Dequeue()}");
Console.WriteLine($"queue peek: {queue.Peek()}");
```
```text
stack pop: load
stack peek: transform
queue dequeue: extract
queue peek: transform
```

#### Use `LinkedList<T>` for node insertion and `PriorityQueue<T, TPriority>` for ranked work

`LinkedList<T>` is worthwhile only when you already have node references and need O(1) insertion or removal at those nodes. `PriorityQueue<T, TPriority>` is the right choice for ranked scheduling on .NET 6+.

*Inserts into a linked list by node reference and dequeues the two highest-priority items first.*
```csharp
var linked = new LinkedList<string>();
linked.AddLast("A");
linked.AddLast("C");
linked.AddAfter(linked.Find("A")!, "B");

var pq = new PriorityQueue<string, int>();
pq.Enqueue("low", 3);
pq.Enqueue("high", 1);
pq.Enqueue("medium", 2);

Console.WriteLine($"linked: [{string.Join(", ", linked)}]");
Console.WriteLine($"priority order: {pq.Dequeue()}, {pq.Dequeue()}");
```
```text
linked: [A, B, C]
priority order: high, medium
```

## Collection Selection

The collection decision should follow the access pattern. If you cannot name the dominant operation, you probably cannot justify the collection choice yet.

### Choose from the dominant operation

#### Compare the common collection families before optimizing

This matrix is deliberately narrow: order, uniqueness, lookup behavior, and the primary workload. It is enough to rule out most bad choices early.

*Prints a compact comparison matrix for the core collection families.*
```csharp
Console.WriteLine(@"Collection        | Ordered   | Unique | Key lookup | Typical use
------------------+-----------+--------+------------+-----------------------------
T[]               | Yes       | No     | No         | fixed-size buffers
List<T>           | Yes       | No     | No         | ordered mutable data
Dictionary<K,V>   | By key    | Keys   | O(1) avg   | indexed lookup by key
HashSet<T>        | No        | Yes    | O(1) avg   | membership and dedupe
SortedSet<T>      | Yes       | Yes    | O(log n)   | ordered unique values
Queue<T>          | FIFO      | No     | No         | staged work
Stack<T>          | LIFO      | No     | No         | undo and traversal
PriorityQueue<T>  | Priority  | No     | No         | ranked work");
```
```text
Collection        | Ordered   | Unique | Key lookup | Typical use
------------------+-----------+--------+------------+-----------------------------
T[]               | Yes       | No     | No         | fixed-size buffers
List<T>           | Yes       | No     | No         | ordered mutable data
Dictionary<K,V>   | By key    | Keys   | O(1) avg   | indexed lookup by key
HashSet<T>        | No        | Yes    | O(1) avg   | membership and dedupe
SortedSet<T>      | Yes       | Yes    | O(log n)   | ordered unique values
Queue<T>          | FIFO      | No     | No         | staged work
Stack<T>          | LIFO      | No     | No         | undo and traversal
PriorityQueue<T>  | Priority  | No     | No         | ranked work
```

#### Start from the access pattern instead of the class name

The fastest way to select a collection is to ask what the code needs to do most often: append in order, look up by key, deduplicate, or rank work.

*Prints a short decision guide that maps common access patterns to collection types.*
```csharp
Console.WriteLine(@"Need ordered, mutable items? -> List<T>
Need fixed-size contiguous storage? -> T[]
Need key-value lookup? -> Dictionary<TKey, TValue>
Need unique membership checks? -> HashSet<T>
Need sorted unique values? -> SortedSet<T>
Need FIFO processing? -> Queue<T>
Need LIFO processing? -> Stack<T>
Need ranked processing? -> PriorityQueue<T, TPriority>");
```
```text
Need ordered, mutable items? -> List<T>
Need fixed-size contiguous storage? -> T[]
Need key-value lookup? -> Dictionary<TKey, TValue>
Need unique membership checks? -> HashSet<T>
Need sorted unique values? -> SortedSet<T>
Need FIFO processing? -> Queue<T>
Need LIFO processing? -> Stack<T>
Need ranked processing? -> PriorityQueue<T, TPriority>
```

## Operational Risks

These are the failure modes that change behavior or cost materially. They are not edge trivia; they are the reasons collection choices become production incidents.

### Allocation and mutation boundaries

#### Pre-size `List<T>` when the final count is known

`List<T>` grows automatically, but that growth still allocates and copies. If the final count is available up front, pass `capacity` explicitly and avoid intermediate expansions.

*Shows the capacity growth of a default list versus a pre-sized list after the same inserts.*
```csharp
var defaultList = new List<int>();
defaultList.Add(1);
defaultList.Add(2);
defaultList.Add(3);
defaultList.Add(4);
defaultList.Add(5);

var presized = new List<int>(5);
presized.AddRange(new[] { 1, 2, 3, 4, 5 });

Console.WriteLine($"default: count={defaultList.Count}, capacity={defaultList.Capacity}");
Console.WriteLine($"presized: count={presized.Count}, capacity={presized.Capacity}");
```
```text
default: count=5, capacity=8
presized: count=5, capacity=5
```

#### Remember that `ToList()` is a shallow copy for reference types

Copying the collection structure does not clone the objects inside it. If the elements are mutable references, both lists still point at the same instances.

*Copies a list of reference types and mutates the copy to show that the original sees the same object change.*
```csharp
var originalRows = new List<Row> { new() { Name = "users" } };
var copiedRows = originalRows.ToList();
copiedRows[0].Name = "orders";

Console.WriteLine($"original[0]: {originalRows[0].Name}");
Console.WriteLine($"copy[0]: {copiedRows[0].Name}");

sealed class Row
{
    public string Name { get; set; } = string.Empty;
}
```
```text
original[0]: orders
copy[0]: orders
```

#### Copy a `HashSet<T>` before calling `ExceptWith()`

Set algebra methods mutate the target set. If the original snapshot must survive, create the result set from a copy and mutate the copy instead.

*Preserves the original set by copying it before applying `ExceptWith()`.*
```csharp
using System.Linq;

var originalSet = new HashSet<int> { 1, 2, 3 };
var resultSet = new HashSet<int>(originalSet);
resultSet.ExceptWith(new[] { 3, 4 });

Console.WriteLine($"original: [{string.Join(", ", originalSet.Order())}]");
Console.WriteLine($"result: [{string.Join(", ", resultSet.Order())}]");
```
```text
original: [1, 2, 3]
result: [1, 2]
```

### Async and slice lifetime

#### Use `Memory<T>` when a slice must survive `await`

`Span<T>` is a `ref struct`, so it cannot cross `await`. The correct replacement is `Memory<T>`, which keeps the slice alive while still exposing `Span<T>` inside the synchronous region.

*Carries a `Memory<int>` slice across `await` and mutates the original array afterward.*
```csharp
int[] values = { 1, 2, 3, 4 };
Memory<int> window = values.AsMemory(1, 2);

await Task.Yield();
window.Span[0] = 99;

Console.WriteLine($"after await: [{string.Join(", ", values)}]");
Console.WriteLine($"window: [{string.Join(", ", window.ToArray())}]");
```
```text
after await: [1, 99, 3, 4]
window: [99, 3]
```

## C# Collections Recommendations

These are the collection defaults that hold up well under ordinary production workloads. Deviate only when the dominant operation or lifecycle is clearly different.

### Default mutable choices

#### Start with `List<T>` when order and mutation dominate

If the code appends, iterates in order, and occasionally sorts or indexes, `List<T>` is usually already the right answer. Do not jump to a more specialized type without a matching access-pattern reason.

*Builds an ordered pipeline step list and appends a new stage.*
```csharp
var batch = new List<string> { "extract", "transform" };
batch.Add("load");

Console.WriteLine($"pipeline: [{string.Join(", ", batch)}]");
Console.WriteLine($"count: {batch.Count}");
```
```text
pipeline: [extract, transform, load]
count: 3
```

#### Prefer `TryGetValue()` over `ContainsKey()` plus the indexer

Two lookups are rarely better than one. `TryGetValue()` documents optional data and reads the value in the same operation.

*Looks up a configuration value with `TryGetValue()` and prints the retrieved setting.*
```csharp
var config = new Dictionary<string, string> { ["region"] = "eu-central" };

Console.WriteLine($"region found: {config.TryGetValue("region", out var region)}");
Console.WriteLine($"region: {region}");
```
```text
region found: True
region: eu-central
```

### Build-once and shared-state choices

#### Use `FrozenDictionary<TKey, TValue>` for read-heavy tables loaded once

`FrozenDictionary<TKey, TValue>` pays its cost at construction time and then optimizes for repeated reads. That makes it a good fit for route maps, static code tables, and startup-loaded configuration on .NET 8+.

*Creates a frozen route table and reads a known key from it.*
```csharp
using System.Collections.Frozen;

var routes = new[]
{
    (Key: "health", Value: 200),
    (Key: "metrics", Value: 200),
}.ToFrozenDictionary(x => x.Key, x => x.Value);

Console.WriteLine($"routes: {routes.Count}");
Console.WriteLine($"metrics status: {routes["metrics"]}");
```
```text
routes: 2
metrics status: 200
```

#### Use `ImmutableHashSet<T>` when multiple readers need stable snapshots

`ImmutableHashSet<T>` is useful when readers must not observe in-place mutation. Each change returns a new set, so earlier snapshots remain valid.

*Creates an immutable snapshot and then adds a new member without changing the original snapshot.*
```csharp
using System.Collections.Immutable;
using System.Linq;

var snapshot = ImmutableHashSet.Create("v1");
var nextSnapshot = snapshot.Add("v2");

Console.WriteLine($"snapshot: [{string.Join(", ", snapshot.Order())}]");
Console.WriteLine($"next: [{string.Join(", ", nextSnapshot.Order())}]");
```
```text
snapshot: [v1]
next: [v1, v2]
```

## C# Collections Troubleshooting

When collection code misbehaves, the bug is usually about absence, emptiness, or invalid external input. Start there before assuming the collection type itself is wrong.

### Missing data and empty collections

#### Avoid missing-key failures with `TryGetValue()`

If a key is optional, represent that directly. `TryGetValue()` is the simplest fix for `KeyNotFoundException` paths that are actually normal misses.

*Looks for a missing key and prints the safe default instead of throwing.*
```csharp
var retrySettings = new Dictionary<string, int> { ["retries"] = 3 };

Console.WriteLine($"timeout found: {retrySettings.TryGetValue("timeout", out var timeout)}");
Console.WriteLine($"timeout value: {timeout}");
```
```text
timeout found: False
timeout value: 0
```

#### Avoid empty-stack failures with `TryPop()`

`Pop()` throws on an empty stack. If emptiness is a valid state, move to `TryPop()` and branch on the returned Boolean instead of catching `InvalidOperationException`.

*Calls `TryPop()` on an empty stack to show the non-throwing result path.*
```csharp
var emptyStack = new Stack<int>();

Console.WriteLine($"try pop: {emptyStack.TryPop(out var popped)}");
Console.WriteLine($"popped value: {popped}");
```
```text
try pop: False
popped value: 0
```

### Input validation

#### Reject undefined `enum` values with `Enum.IsDefined()`

Casting or deserializing arbitrary integers can produce unnamed enum states. Check `Enum.IsDefined()` before you trust the value in business logic.

*Validates an external integer before treating it as a defined enum member.*
```csharp
var externalValue = 99;

Console.WriteLine($"defined: {Enum.IsDefined(typeof(PipelineStatus), externalValue)}");
Console.WriteLine($"raw value: {externalValue}");

enum PipelineStatus
{
    Pending,
    Running,
    Success,
    Failed,
}
```
```text
defined: False
raw value: 99
```
