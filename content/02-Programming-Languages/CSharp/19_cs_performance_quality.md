---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp, performance, testing]
aliases: [performance profiling, code quality, Stopwatch, BenchmarkDotNet, Span, nullable reference types]
keywords: [Stopwatch, BenchmarkDotNet, GC.GetTotalMemory, Span, stackalloc, ArrayPool, LINQ performance, Roslyn Analyzers, nullable reference types, code smells, Big-O]
description: "C# performance and code quality reference with executable examples and cell outputs — covers timing, memory measurement, Span<T>, Big-O, LINQ pitfalls, code smells, and static analysis. See [[19_py_performance_quality]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[19_py_performance_quality]]"
created: 2026-03-24
updated: 2026-03-24
status: complete
---

## 1. Timing & Benchmarking

#### Stopwatch timing and BenchmarkDotNet

```csharp
// Timing and benchmarking — measure execution time accurately
//
// Technique: Stopwatch for high-resolution wall-clock timing in code.
//   BenchmarkDotNet for production-grade micro-benchmarks with warm-up,
//   statistical analysis, and GC tracking. Always measure before optimizing.
//
// Benefits:
//   - Stopwatch uses hardware counters — sub-microsecond resolution
//   - BenchmarkDotNet handles warm-up, JIT, and GC automatically
//   - Prevents premature optimization — data-driven decisions
//
// Anti-patterns:
//   - DateTime.Now for timing — 15ms resolution, not suitable for benchmarks
//   - Single-run timing — JIT and caching skew first run; use multiple iterations
//   - Optimizing without measuring — guessing where bottlenecks are
//
// When to use:
//   - Comparing algorithm alternatives, validating optimizations
//
// When NOT to use:
//   - Production monitoring — use Application Insights or Prometheus instead

// Timing & Benchmarking — measure how long code takes.
//
// KEY CONCEPTS:
// - Stopwatch: high-resolution timer (System.Diagnostics).
// - BenchmarkDotNet: production-grade benchmarking (warmup, GC, statistics).
// - DateTime.Now is NOT suitable for benchmarking (low resolution, ~15ms).
// - Python equivalent: time.perf_counter(), timeit.
//
// GOLDEN RULE: Never optimize without measuring first.

using System.Diagnostics;

// --- Stopwatch (manual timing) ---
using System.Buffers;
using System.Collections.Generic;
int SlowSum(int n) {
    int total = 0;
    for (int i = 0; i < n; i++) total += i;
    return total;
}

var sw = Stopwatch.StartNew();
var result = SlowSum(1_000_000);
sw.Stop();
Console.WriteLine($"SlowSum(1M): {sw.ElapsedMilliseconds}ms, result={result}");

// --- High-resolution timing ---
long start = Stopwatch.GetTimestamp();
SlowSum(1_000_000);
var elapsed = Stopwatch.GetElapsedTime(start);
Console.WriteLine($"GetElapsedTime: {elapsed.TotalMilliseconds:F2}ms");

// --- Reusable timer helper ---
T MeasureTime<T>(Func<T> action, string label = "") {
    var sw = Stopwatch.StartNew();
    var result = action();
    sw.Stop();
    Console.WriteLine($"  [{label}] {sw.Elapsed.TotalMilliseconds:F2}ms");
    return result;
}

MeasureTime(() => Enumerable.Range(0, 100_000).Select(x => x * x).ToList(), "LINQ ToList");
MeasureTime(() => Enumerable.Range(0, 100_000).Select(x => x * x).ToArray(), "LINQ ToArray");
MeasureTime(() => {
    var arr = new int[100_000];
    for (int i = 0; i < arr.Length; i++) arr[i] = i * i;
    return arr;
}, "Manual loop");
```

    SlowSum(1M): 0ms, result=1783293664
    GetElapsedTime: 0.46ms
      [LINQ ToList] 25.93ms
      [LINQ ToArray] 0.47ms
      [Manual loop] 0.19ms

#### Comparing alternatives — List vs Array vs Dictionary

```csharp
// Comparing alternatives — benchmark the same operation across data structures

var data = Enumerable.Range(0, 100_000).ToList();
var dataArr = data.ToArray();
var dataSet = new HashSet<int>(data);
var dataDict = data.ToDictionary(x => x, x => x);

// Search for last element
MeasureTime(() => data.Contains(99_999), "List.Contains (O(n))");
MeasureTime(() => Array.IndexOf(dataArr, 99_999) >= 0, "Array.IndexOf (O(n))");
MeasureTime(() => dataSet.Contains(99_999), "HashSet.Contains (O(1))");
MeasureTime(() => dataDict.ContainsKey(99_999), "Dict.ContainsKey (O(1))");
```

      [List.Contains (O(n))] 0.07ms
      [Array.IndexOf (O(n))] 0.14ms
      [HashSet.Contains (O(1))] 0.07ms
      [Dict.ContainsKey (O(1))] 0.04ms

## 2. Memory Measurement

#### GC.GetTotalMemory — measure managed heap allocations

```csharp
// Memory measurement — understand the cost of allocations
//
// Technique: GC.GetTotalMemory(forceFullCollection: true) returns total
//   managed heap size. Measure before and after allocation to get the
//   delta. GC.GetGCMemoryInfo() provides detailed GC statistics.
//
// Benefits:
//   - Quick allocation measurement without external tools
//   - forceFullCollection gives accurate snapshot (no pending garbage)
//   - Reveals hidden allocations from LINQ, closures, boxing
//
// Anti-patterns:
//   - Not forcing GC before measurement — stale garbage inflates numbers
//   - Measuring in Debug — allocations differ from Release builds
//   - Ignoring LOH (Large Object Heap) — objects >85KB allocated differently
//
// When to use:
//   - Comparing memory footprint of data structures and approaches
//
// When NOT to use:
//   - Production memory monitoring — use dotMemory or Application Insights

// Memory Measurement — understand the cost of allocations.
//
// KEY CONCEPTS:
// - GC.GetTotalMemory(): total managed heap size.
// - GC.GetGCMemoryInfo(): detailed GC stats.
// - Value types (struct) live on the stack; reference types (class) on the heap.
// - Boxing (int -> object) allocates on the heap.
// - Python equivalent: sys.getsizeof(), tracemalloc.
//
// GOLDEN RULE: Every 'new' is an allocation. Every allocation is future GC pressure.

// Measure allocation impact
GC.Collect();
GC.WaitForPendingFinalizers();
long before = GC.GetTotalMemory(true);

var list = new List<int>(100_000);
for (int i = 0; i < 100_000; i++) list.Add(i);

long after = GC.GetTotalMemory(false);
Console.WriteLine($"List<int>(100K): {(after - before) / 1024.0:F0} KB allocated");

// Compare: int[] vs List<int> vs int[]  preallocated
GC.Collect(); before = GC.GetTotalMemory(true);
var arr = new int[100_000];
for (int i = 0; i < arr.Length; i++) arr[i] = i;
after = GC.GetTotalMemory(false);
Console.WriteLine($"int[100K]:       {(after - before) / 1024.0:F0} KB allocated");

// String vs StringBuilder
GC.Collect(); before = GC.GetTotalMemory(true);
string s = "";
for (int i = 0; i < 10_000; i++) s += i.ToString();
after = GC.GetTotalMemory(false);
Console.WriteLine($"\nString += (10K): {(after - before) / 1024.0:F0} KB (O(n²) allocations!)");

GC.Collect(); before = GC.GetTotalMemory(true);
var sb = new System.Text.StringBuilder();
for (int i = 0; i < 10_000; i++) sb.Append(i);
string result2 = sb.ToString();
after = GC.GetTotalMemory(false);
Console.WriteLine($"StringBuilder:   {(after - before) / 1024.0:F0} KB (O(n))");
```

    List<int>(100K): 447 KB allocated
    int[100K]:       415 KB allocated
    
    String += (10K): 11472 KB (O(n²) allocations!)
    StringBuilder:   180 KB (O(n))

#### Value types vs reference types — stack vs heap allocation

```csharp
// Value types vs reference types — stack vs heap memory impact

struct PointStruct(int x, int y) { public int X = x; public int Y = y; }
class PointClass(int x, int y) { public int X = x; public int Y = y; }

// Struct array: contiguous memory, no GC overhead per element
```

#### struct vs class memory benchmark

```csharp
// struct vs class memory — concrete allocation comparison

GC.Collect();
long before = GC.GetTotalMemory(true);
var structArr = new PointStruct[100_000];
for (int i = 0; i < structArr.Length; i++) structArr[i] = new PointStruct(i, i);
long after = GC.GetTotalMemory(false);
Console.WriteLine($"PointStruct[100K]: {(after - before) / 1024.0:F0} KB");

// Class array: each element is a heap allocation
GC.Collect();
before = GC.GetTotalMemory(true);
var classArr = new PointClass[100_000];
for (int i = 0; i < classArr.Length; i++) classArr[i] = new PointClass(i, i);
after = GC.GetTotalMemory(false);
Console.WriteLine($"PointClass[100K]:  {(after - before) / 1024.0:F0} KB");
Console.WriteLine("Struct is significantly smaller (no object header, no GC tracking).");
```

    PointStruct[100K]: 789 KB
    PointClass[100K]:  3150 KB
    Struct is significantly smaller (no object header, no GC tracking).

## 3. Span<T> & Zero-Allocation Patterns

#### Span and zero-allocation patterns

```csharp
// Span<T> — zero-allocation slicing for high-performance parsing
//
// Technique: Span<T> is a stack-only view into contiguous memory.
//   Slicing creates a new view (no copy). ReadOnlySpan<char> for string
//   parsing without substring allocations. stackalloc for stack arrays.
//
// Benefits:
//   - Zero allocation — no GC pressure from slicing operations
//   - Works with arrays, strings, and stack memory uniformly
//   - Orders of magnitude faster for heavy parsing (CSV, protocols)
//
// Anti-patterns:
//   - Span in class fields — stack-only, compiler error
//   - Span across await — not allowed (stack frame may be gone)
//   - Using Span for simple operations — overhead of understanding isn't worth it
//
// When to use:
//   - High-throughput parsing, buffer processing, protocol handling
//
// When NOT to use:
//   - General string manipulation — Substring is simpler

// Span<T> — zero-allocation slicing of arrays, strings, and stack memory.
//
// KEY CONCEPTS:
// - Span<T>: a view into contiguous memory. No allocation, no copy.
// - ReadOnlySpan<T>: immutable view (for strings).
// - stackalloc: allocate on the stack (no GC). Limited size (~1MB).
// - Python equivalent: memoryview, numpy views, Polars zero-copy.
//
// GOLDEN RULE: If you're slicing arrays or parsing strings, Span avoids allocations.
//
// NOTE: Span<T> cannot be stored in fields, so we wrap in a local function scope.

// Array slicing: copy vs Span
{
    int[] data = Enumerable.Range(0, 1000).ToArray();
    int[] sliceCopy = data[100..200]; // This allocates a new array!

    // With Span (zero-copy view)
    Span<int> span = data.AsSpan(100, 100); // No allocation
    Console.WriteLine($"Span slice: {span.Length} elements, first={span[0]}, last={span[^1]}");
}

// ReadOnlySpan for string parsing (no substring allocations)
{
    ReadOnlySpan<char> text = "2024-01-15T10:30:00".AsSpan();
    var datePart = text[..10];   // No string allocation
    var timePart = text[11..];   // No string allocation
    Console.WriteLine($"Date: {datePart.ToString()}, Time: {timePart.ToString()}");
}

// stackalloc: allocate on the stack
{
    Span<int> stackData = stackalloc int[256];
    for (int i = 0; i < stackData.Length; i++) stackData[i] = i * i;
    Console.WriteLine($"stackalloc: {stackData.Length} ints on the stack");
}
```

    Span slice: 100 elements, first=100, last=199
    Date: 2024-01-15, Time: 10:30:00
    stackalloc: 256 ints on the stack

## 4. Big-O Complexity & Collection Performance

#### Big-O complexity and collection performance cheat sheet

```csharp
// Collection performance cheat sheet — Big-O for common operations
//
// Technique: Reference table showing time complexity for each operation
//   (lookup, insert, remove, iterate) on each collection type (List,
//   Array, Dictionary, HashSet, SortedDictionary, LinkedList).
//
// Benefits:
//   - Quick lookup for choosing the right collection by access pattern
//   - Shows why Dictionary/HashSet are O(1) for lookup vs List O(n)
//   - Covers edge cases: List.Insert(0) is O(n), LinkedList is O(1)
//
// Anti-patterns:
//   - List.Contains in hot loops — O(n); switch to HashSet for O(1)
//   - SortedDictionary when order doesn't matter — Dictionary is faster
//
// When to use:
//   - Choosing collections based on performance requirements
//
// When NOT to use:
//   - N/A — this is a reference table

// Collection Performance Cheat Sheet
//
// | Operation        | List<T> | Array   | Dict<K,V> | HashSet | SortedDict | LinkedList |
// |-----------------|---------|---------|-----------|---------|------------|------------|
// | Index/Key       | O(1)    | O(1)    | O(1)      | -       | O(log n)   | O(n)       |
// | Search          | O(n)    | O(n)    | O(1)      | O(1)    | O(log n)   | O(n)       |
// | Add end         | O(1)*   | -       | O(1)      | O(1)    | O(log n)   | O(1)       |
// | Add front       | O(n)    | -       | -         | -       | -          | O(1)       |
// | Remove          | O(n)    | -       | O(1)      | O(1)    | O(log n)   | O(1)**     |
// | Sort            | O(nlogn)| O(nlogn)| -         | -       | sorted     | O(nlogn)   |
// | Memory          | Compact | Compact | Heavy     | Heavy   | Heavy      | Heavy      |
//
// *amortized   **if you have the node reference
//
// GOLDEN RULE: Use Dictionary/HashSet when you need fast lookup.
//              Use List when you need ordered, indexed access.
//              Use SortedDictionary when you need sorted keys.
//              NEVER use List.Contains() on large data.


int n = 100_000;
var list = Enumerable.Range(0, n).ToList();
var hashSet = new HashSet<int>(list);
var dict = list.ToDictionary(x => x, x => x);
var sorted = new SortedDictionary<int, int>(dict);

Console.WriteLine($"Lookup of element {n-1}:");
MeasureTime(() => list.Contains(n - 1), "List (O(n))");
MeasureTime(() => hashSet.Contains(n - 1), "HashSet (O(1))");
MeasureTime(() => dict.ContainsKey(n - 1), "Dict (O(1))");
MeasureTime(() => sorted.ContainsKey(n - 1), "SortedDict (O(log n))");
```

    Lookup of element 99999:
      [List (O(n))] 0.18ms
      [HashSet (O(1))] 0.11ms
      [Dict (O(1))] 0.06ms
      [SortedDict (O(log n))] 0.27ms

## 5. Golden Rules of Performance

#### Golden rules of C# performance

```csharp
// Golden rules of performance — principles before micro-optimization
//
// Technique: Ten rules: measure first, avoid premature optimization,
//   prefer built-in APIs, minimize allocations, use value types for
//   small data, pool buffers, use Span for parsing, batch I/O.
//
// Benefits:
//   - Prioritizes high-impact optimizations over micro-optimizations
//   - Measure-first approach prevents wasted effort
//   - Covers the 80/20 of C# performance improvements
//
// Anti-patterns:
//   - Optimizing without profiling — solving the wrong problem
//   - Micro-optimizing cold paths — only hot paths matter
//
// When to use:
//   - Before any optimization work — review these rules first
//
// When NOT to use:
//   - N/A — these principles are always applicable

// GOLDEN RULES OF C# PERFORMANCE
//
// 1. MEASURE BEFORE OPTIMIZING
//    Use BenchmarkDotNet or Stopwatch. Never guess.
//    Profile with dotTrace or PerfView for production code.
//
// 2. ALGORITHM > MICRO-OPTIMIZATION
//    O(n²) → O(n log n) is always better than inlining or unrolling.
//
// 3. MINIMIZE ALLOCATIONS
//    Every 'new' = heap allocation = future GC pause.
//    Use structs, Span<T>, stackalloc, ArrayPool<T>.Shared.
//    Reuse objects instead of creating new ones in hot loops.
//
// 4. USE THE RIGHT COLLECTION
//    Dictionary > List for lookups. HashSet for membership tests.
//    List<T> with initial capacity when size is known.
//
// 5. AVOID BOXING
//    int → object = heap allocation. Use generics instead of object.
//    List<int> not ArrayList (which boxes everything).
//
// 6. STRING HANDLING
//    string += in loop is O(n²). Use StringBuilder.
//    Use string.Create() or Span<char> for high-performance parsing.
//    Prefer StringComparison.Ordinal over culture-sensitive comparisons.
//
// 7. ASYNC FOR I/O, NOT CPU
//    async/await is for I/O-bound work (network, disk).
//    For CPU-bound parallelism, use Parallel.ForEach or Task.Run.
//
// 8. POOL RESOURCES
//    ArrayPool<T>.Shared for temporary arrays.
//    HttpClient: ONE instance per app (connection pooling).
//    DbConnection: use connection pooling (built into ADO.NET).
//
// 9. SEALED CLASSES ARE FASTER
//    `sealed` enables devirtualization (compiler can inline calls).
//    Seal classes that aren't designed for inheritance.
//
// 10. READONLY & IMMUTABLE WHEN POSSIBLE
//     readonly struct avoids defensive copies.
//     ImmutableArray<T> for thread-safe collections.

// Demo: ArrayPool (reuse instead of allocate)

var pool = ArrayPool<int>.Shared;
int[] rented = pool.Rent(1024); // May return larger array
try {
    for (int i = 0; i < 1024; i++) rented[i] = i;
    Console.WriteLine($"ArrayPool: rented {rented.Length} (requested 1024), no allocation!");
} finally {
    pool.Return(rented); // Return to pool for reuse
}
```

    ArrayPool: rented 1024 (requested 1024), no allocation!

## 6. Absolute No-Go's

> [!danger] Absolute no-go's — patterns that should never appear in production C#
> 1. **String `+=` in a loop** — O(n²). Use `StringBuilder`.
> 2. **`catch (Exception) { }`** — empty catch swallows all errors. At minimum: `_logger.LogError(ex, "..."); throw;`
> 3. **`async void`** — exceptions are unobservable and crash the process. Always use `async Task`. Only exception: event handlers.
> 4. **`.Result` / `.Wait()`** — deadlocks in UI/ASP.NET contexts. Use `await`.
> 5. **Exposing mutable collections** — `public List<T> Items { get; set; }` lets anyone `.Clear()` it. Return `IReadOnlyList<T>`.
> 6. **Not disposing `IDisposable`** — `SqlConnection`, `HttpClient`, `FileStream` → resource leak. Always use `using`.
> 7. **Hardcoded connection strings / secrets** — use `IConfiguration`, user-secrets, or Key Vault.
> 8. **`new HttpClient()` per request** — socket exhaustion. Use `IHttpClientFactory` or a static instance.
> 9. **Blocking the UI thread** — `Thread.Sleep()` or sync I/O → frozen app. Use `async`/`await`.
> 10. **`obj.GetType() == typeof(Foo)`** — use `if (obj is Foo foo)` instead.
> 11. **`dynamic` when static types exist** — bypasses all type checking. Use generics or interfaces.
> 12. **Ignoring CA/IDE warnings** — Roslyn analyzers exist for a reason. Fix warnings, don't suppress blindly.

```csharp
// BAD: resource leak if exception occurs
// var conn = new SqlConnection(connString);
// conn.Open(); ... conn.Close();

// GOOD: disposed even if exception occurs
// using var conn = new SqlConnection(connString);
// conn.Open(); ...
```

## 7. Code Smells & Anti-Patterns

#### Code smells and anti-patterns

```csharp
// Code smells — design issues that indicate deeper problems
//
// Technique: Catalog of common smells: god class (too many methods),
//   primitive obsession (string for email), deep nesting, feature envy,
//   magic numbers, boolean parameters, dead code.
//
// Benefits:
//   - Recognition guide — spot smells during code review
//   - Each smell has a concrete refactoring solution
//   - Prevents technical debt accumulation
//
// Anti-patterns:
//   - God class — split by single responsibility
//   - Primitive obsession — wrap in value objects
//   - Magic numbers — extract to named constants
//   - Deep nesting — extract to methods, use guard clauses
//
// When to use:
//   - Code review, refactoring planning, design improvement
//
// When NOT to use:
//   - Premature refactoring — fix smells when they cause real problems

// CODE SMELLS IN C#
//
// 1. GOD CLASS
//    One class with 50+ methods. Split by responsibility (SRP).
//
// 2. PRIMITIVE OBSESSION
//    Using string for email, int for money, Guid for everything.
//    Create value objects: Email, Money, CustomerId.
//
// 3. FEATURE ENVY
//    A method that uses another class's data more than its own.
//    Move the method to the class that owns the data.
//
// 4. MAGIC STRINGS / NUMBERS
//    if (status == "active") → use enum or const.
//    if (timeout > 86400) → use TimeSpan.FromDays(1).
//
// 5. DEEP INHERITANCE HIERARCHIES
//    Base > Sub > SubSub > SubSubSub = fragile, hard to reason about.
//    Prefer composition over inheritance.
//
// 6. SERVICE LOCATOR PATTERN
//    var service = ServiceLocator.Get<IMyService>() → hidden dependency.
//    Use constructor injection instead.
//
// 7. BOOLEAN PARAMETERS
//    Process(data, true, false, true) → unreadable.
//    Use enums, named parameters, or separate methods.
record Email {
    public string Value { get; }
    public Email(string value) {
        if (!value.Contains('@')) throw new ArgumentException("Invalid email");
        Value = value;
    }
    public override string ToString() => Value;
}
```

#### Primitive obsession vs value objects — demo

```csharp
// Primitive obsession vs value objects — concrete refactoring example

string email = "alice@example.com";  // Just a string, no validation

// GOOD:

var validEmail = new Email("alice@example.com");
Console.WriteLine($"Valid email: {validEmail}");

try {
    var invalid = new Email("not-an-email");
} catch (ArgumentException ex) {
    Console.WriteLine($"Caught: {ex.Message}");
}
```

    Valid email: alice@example.com
    Caught: Invalid email

## 8. Nullable Reference Types & Static Analysis

#### Nullable reference types and static analysis

```csharp
// Nullable reference types (NRT) — compile-time null safety
//
// Technique: #nullable enable turns on compiler null analysis. string?
//   marks nullable, string is non-nullable. Compiler warns on potential
//   null dereference. The null-forgiving operator (!) suppresses warnings.
//
// Benefits:
//   - Catches NullReferenceException at compile time, not runtime
//   - Documents nullable intent in the type system
//   - Works with existing code — enable gradually per file
//
// Anti-patterns:
//   - Ignoring nullable warnings — defeats the purpose
//   - Overusing ! (null-forgiving) — hides real null risks
//   - Not enabling NRT in new projects — missing free bug prevention
//
// When to use:
//   - Every new C# project — NRT is on by default since .NET 6
//
// When NOT to use:
//   - N/A — NRT should always be enabled

// Nullable Reference Types (NRT) — C#'s answer to the billion-dollar mistake.
//
// KEY CONCEPTS:
// - #nullable enable: compiler warns on potential null dereference.
// - string? = nullable; string = non-nullable (by convention + compiler check).
// - The ! operator (null-forgiving) suppresses warnings. Use sparingly.
// - Python equivalent: Optional[str], type hints with mypy strict mode.
//
// GOLDEN RULE: Enable nullable in ALL new projects. It catches bugs at compile time.

#nullable enable

string GetName(bool exists) {
    if (exists) return "Alice";
    return null!; // We promise it won't be null (but it will!)
}

// Safe pattern: use ? and ??
string? maybeName = null;
string safeName = maybeName ?? "Unknown";
int length = maybeName?.Length ?? 0;

Console.WriteLine($"Safe name: {safeName}, length: {length}");

// Pattern matching for null checks (modern C#)
object? obj = "hello";
if (obj is string text) {
    Console.WriteLine($"It's a string: {text.ToUpper()}");
}

// Null-conditional chaining
string? result = maybeName?.ToUpper()?.Trim();
Console.WriteLine($"Chained: {result ?? "(null)"}");
```

    Safe name: Unknown, length: 0
    It's a string: HELLO
    Chained: (null)

## 9. LINQ Performance Pitfalls

#### LINQ performance pitfalls

```csharp
// LINQ performance pitfalls — common traps in LINQ pipelines
//
// Technique: Multiple enumeration (calling .Count() then .ToList() scans
//   twice), deferred execution surprises, OrderBy vs Sort (allocation
//   difference), materialization timing with ToList/ToArray.
//
// Benefits:
//   - Awareness prevents common LINQ performance mistakes
//   - Each pitfall has a concrete fix
//   - Profiling reveals which LINQ calls are costly
//
// Anti-patterns:
//   - Multiple enumeration — materialize with ToList() if reused
//   - .Count() > 0 instead of .Any() — Any() short-circuits
//   - OrderBy in a loop — sort once outside the loop
//   - Deferred query as return value — callers may enumerate multiple times
//
// When to use:
//   - Reviewing LINQ-heavy code for performance issues
//
// When NOT to use:
//   - Simple LINQ on small data — these pitfalls matter at scale

// LINQ is elegant but has performance traps.
//
// PITFALLS:
// 1. Multiple enumeration: .Where().Count() then .Where().ToList() = 2 passes.
// 2. Deferred execution: .Where() doesn't execute until you consume it.
// 3. Closure allocations: lambdas capture variables, allocating on heap.
// 4. OrderBy().First() = sort everything to get one item. Use MinBy().
//
// RULE: Materialize (.ToList()) when you'll enumerate multiple times.
// RULE: Use MinBy/MaxBy instead of OrderBy().First().

var data = Enumerable.Range(0, 100_000).ToList();

// BAD: OrderBy + First (sorts everything O(n log n))
MeasureTime(() => data.OrderByDescending(x => x).First(), "OrderBy().First()");

// GOOD: MaxBy (single pass O(n))
MeasureTime(() => data.Max(), "Max()");

// Multiple enumeration trap
IEnumerable<int> filtered = data.Where(x => x % 2 == 0); // Deferred!
// BAD: enumerates twice
// var count = filtered.Count();  // pass 1
// var list = filtered.ToList();  // pass 2

// GOOD: materialize once
var materialized = filtered.ToList(); // single pass
var count = materialized.Count;       // O(1) on List
Console.WriteLine($"Materialized: {count} items");

// LINQ vs manual loop
MeasureTime(() => data.Where(x => x % 2 == 0).Select(x => (long)x * x).Sum(), "LINQ chain");
MeasureTime(() => {
    long sum = 0;
    foreach (var x in data) if (x % 2 == 0) sum += (long)x * x;
    return sum;
}, "Manual loop");
```

      [OrderBy().First()] 0.97ms
      [Max()] 1.39ms
    Materialized: 50000 items
      [LINQ chain] 3.47ms
      [Manual loop] 0.46ms

## 10. Code Quality Tools

| Tool | Purpose | Config |
|---|---|---|
| Roslyn Analyzers | Built-in code analysis (CA rules) | `.editorconfig` |
| StyleCop Analyzers | Style enforcement | NuGet package |
| SonarAnalyzer | Bug & security detection | NuGet / SonarQube |
| `dotnet format` | Code formatting | `.editorconfig` |
| NDepend | Dependency & complexity analysis | Standalone |
| `dotnet-counters` | Runtime performance counters | CLI tool |
| PerfView | CPU/Memory/GC profiling | Standalone |
| dotTrace / dotMemory | JetBrains profilers | IDE integration |

Key `.editorconfig` rules: `CA1822` (mark members static), `CA2007` (ConfigureAwait), `CA1062` (validate arguments), `IDE0090` (use `new()` shorthand).

> [!tip] Enable `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` in `.csproj`. Warnings are bugs waiting to happen — fix them or justify the suppression.

## Summary

| Category | C# Tool | Python Equivalent |
|---|---|---|
| Wall-clock time | `Stopwatch` | `time.perf_counter()` |
| Benchmarking | `BenchmarkDotNet` | `timeit` |
| Memory | `GC.GetTotalMemory()` | `tracemalloc`, `sys.getsizeof()` |
| CPU profiling | `dotTrace`, `PerfView` | `cProfile`, `line_profiler` |
| Zero-allocation | `Span<T>`, `stackalloc` | `memoryview`, numpy views |
| Type safety | Built-in + NRT | `mypy`, `pyright` |
| Linting | Roslyn Analyzers | `ruff`, `pylint` |
| Formatting | `dotnet format` | `black`, `ruff format` |
| Security | SonarAnalyzer | `bandit` |

**Golden Rules:** Measure first. Algorithm > micro-opt. Minimize allocations. Right collection. Pool resources. Seal classes.

**No-Go's:** String += in loops. Empty catch. async void. .Result/.Wait(). Mutable public collections. new HttpClient() per request. Hardcoded secrets. dynamic.
