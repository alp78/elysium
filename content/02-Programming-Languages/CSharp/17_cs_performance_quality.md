---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp, performance, testing]
aliases: [performance profiling, code quality, Stopwatch, BenchmarkDotNet, Span, nullable reference types]
keywords: [Stopwatch, BenchmarkDotNet, GC.GetTotalMemory, Span, stackalloc, ArrayPool, LINQ performance, Roslyn Analyzers, nullable reference types, code smells, Big-O]
description: "C# performance and code quality reference with executable examples and cell outputs — covers timing, memory measurement, Span<T>, Big-O, LINQ pitfalls, code smells, and static analysis. See [[17_py_performance_quality]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[17_py_performance_quality]]"
created: 2026-03-24
updated: 2026-03-24
status: complete
---

# 17. Performance & Code Quality - C\#

## 1. Timing & Benchmarking

Timing & Benchmarking — measure how long code takes.

**KEY CONCEPTS:**
- Stopwatch: high-resolution timer (System.Diagnostics).
- BenchmarkDotNet: production-grade benchmarking (warmup, GC, statistics).
- DateTime.Now is NOT suitable for benchmarking (low resolution, ~15ms).
- Python equivalent: time.perf_counter(), timeit.

> **Golden Rule:** Never optimize without measuring first.

```csharp
using System.Diagnostics;

// --- Stopwatch (manual timing) ---
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

```csharp
// Comparing alternatives: List vs Array vs Dictionary lookup
//
// RULE: Always compare on the SAME data, SAME machine.

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

Memory Measurement — understand the cost of allocations.

**KEY CONCEPTS:**
- GC.GetTotalMemory(): total managed heap size.
- GC.GetGCMemoryInfo(): detailed GC stats.
- Value types (struct) live on the stack; reference types (class) on the heap.
- Boxing (int -> object) allocates on the heap.
- Python equivalent: sys.getsizeof(), tracemalloc.

> **Golden Rule:** Every 'new' is an allocation. Every allocation is future GC pressure.

Measure allocation impact

```csharp
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

Value Types vs Reference Types: stack vs heap

struct = value type, lives on stack (no GC), copied on assignment.
class = reference type, lives on heap (GC), shared reference.

> **Rule:** Use struct for small, immutable data (Point, Color, DateTime).
Use class for large or mutable objects.

```csharp
struct PointStruct(int x, int y) { public int X = x; public int Y = y; }
class PointClass(int x, int y) { public int X = x; public int Y = y; }

// Struct array: contiguous memory, no GC overhead per element
```

```csharp
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

Span<T> — zero-allocation slicing of arrays, strings, and stack memory.

**KEY CONCEPTS:**
- Span<T>: a view into contiguous memory. No allocation, no copy.
- ReadOnlySpan<T>: immutable view (for strings).
- stackalloc: allocate on the stack (no GC). Limited size (~1MB).
- Python equivalent: memoryview, numpy views, Polars zero-copy.

> **Golden Rule:** If you're slicing arrays or parsing strings, Span avoids allocations.

NOTE: Span<T> cannot be stored in fields, so we wrap in a local function scope.

Array slicing: copy vs Span

```csharp
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

Collection Performance Cheat Sheet

| Operation        | List<T> | Array   | Dict<K,V> | HashSet | SortedDict | LinkedList |
|-----------------|---------|---------|-----------|---------|------------|------------|
| Index/Key       | O(1)    | O(1)    | O(1)      | -       | O(log n)   | O(n)       |
| Search          | O(n)    | O(n)    | O(1)      | O(1)    | O(log n)   | O(n)       |
| Add end         | O(1)*   | -       | O(1)      | O(1)    | O(log n)   | O(1)       |
| Add front       | O(n)    | -       | -         | -       | -          | O(1)       |
| Remove          | O(n)    | -       | O(1)      | O(1)    | O(log n)   | O(1)**     |
| Sort            | O(nlogn)| O(nlogn)| -         | -       | sorted     | O(nlogn)   |
| Memory          | Compact | Compact | Heavy     | Heavy   | Heavy      | Heavy      |

*amortized   **if you have the node reference

> **Golden Rule:** Use Dictionary/HashSet when you need fast lookup.
Use List when you need ordered, indexed access.
Use SortedDictionary when you need sorted keys.
NEVER use List.Contains() on large data.

```csharp
using System.Diagnostics;
using System.Collections.Generic;

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

GOLDEN RULES OF C# PERFORMANCE

**1. MEASURE BEFORE OPTIMIZING**
Use BenchmarkDotNet or Stopwatch. Never guess.
Profile with dotTrace or PerfView for production code.

**2. ALGORITHM > MICRO-OPTIMIZATION**
O(n²) → O(n log n) is always better than inlining or unrolling.

**3. MINIMIZE ALLOCATIONS**
Every 'new' = heap allocation = future GC pause.
Use structs, Span<T>, stackalloc, ArrayPool<T>.Shared.
Reuse objects instead of creating new ones in hot loops.

**4. USE THE RIGHT COLLECTION**
Dictionary > List for lookups. HashSet for membership tests.
List<T> with initial capacity when size is known.

**5. AVOID BOXING**
int → object = heap allocation. Use generics instead of object.
List<int> not ArrayList (which boxes everything).

**6. STRING HANDLING**
string += in loop is O(n²). Use StringBuilder.
Use string.Create() or Span<char> for high-performance parsing.
Prefer StringComparison.Ordinal over culture-sensitive comparisons.

**7. ASYNC FOR I/O, NOT CPU**
async/await is for I/O-bound work (network, disk).
For CPU-bound parallelism, use Parallel.ForEach or Task.Run.

**8. POOL RESOURCES**
ArrayPool<T>.Shared for temporary arrays.
HttpClient: ONE instance per app (connection pooling).
DbConnection: use connection pooling (built into ADO.NET).

**9. SEALED CLASSES ARE FASTER**
`sealed` enables devirtualization (compiler can inline calls).
Seal classes that aren't designed for inheritance.

**10. READONLY & IMMUTABLE WHEN POSSIBLE**
readonly struct avoids defensive copies.
ImmutableArray<T> for thread-safe collections.

Demo: ArrayPool (reuse instead of allocate)

```csharp
using System.Buffers;

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

ABSOLUTE NO-GO'S — things that should NEVER appear in production C# code.

**1. STRING CONCATENATION IN A LOOP**
s += x is O(n²). Use StringBuilder.

**2. CATCH (Exception) { } — EMPTY CATCH**
Swallows all errors silently. At minimum, log it.
catch (Exception ex) { _logger.LogError(ex, "..."); throw; }

**3. ASYNC VOID**
Exceptions in async void are unobservable and crash the process.
Always use async Task. Only exception: event handlers.

4. .Result / .Wait() ON ASYNC CODE
Deadlocks in UI/ASP.NET contexts. Use await instead.
If you MUST block, use .GetAwaiter().GetResult() (still bad).

**5. EXPOSING MUTABLE COLLECTIONS**
public List<T> Items { get; set; } → anyone can .Clear() it.
Return IReadOnlyList<T> or .AsReadOnly().

**6. NOT DISPOSING IDisposable**
SqlConnection, HttpClient, FileStream → resource leak.
Always use 'using' statement or 'using' declaration.

**7. HARDCODED CONNECTION STRINGS / SECRETS**
Use IConfiguration, user-secrets, Azure Key Vault.

8. new HttpClient() PER REQUEST
Socket exhaustion. Use IHttpClientFactory or a static instance.

**9. BLOCKING THE UI THREAD**
Thread.Sleep() or sync I/O on UI thread → frozen app.
Use async/await for all I/O.

**10. CHECKING TYPE WITH GetType() INSTEAD OF is/as**
if (obj.GetType() == typeof(Foo)) → use: if (obj is Foo foo) { ... }

**11. USING dynamic WHEN STATIC TYPES EXIST**
dynamic bypasses all type checking. Use generics or interfaces.

**12. IGNORING CA/IDE WARNINGS**
Roslyn analyzers exist for a reason. Fix warnings, don't suppress blindly.

Demo: IDisposable (NO-GO #6)
BAD:
var conn = new SqlConnection(connString);
conn.Open();
... if exception here, conn is leaked!
conn.Close();

GOOD:
using var conn = new SqlConnection(connString);
conn.Open();
... conn is disposed even if exception occurs


## 7. Code Smells & Anti-Patterns

CODE SMELLS IN C#

**1. GOD CLASS**
One class with 50+ methods. Split by responsibility (SRP).

**2. PRIMITIVE OBSESSION**
Using string for email, int for money, Guid for everything.
Create value objects: Email, Money, CustomerId.

**3. FEATURE ENVY**
A method that uses another class's data more than its own.
Move the method to the class that owns the data.

**4. MAGIC STRINGS / NUMBERS**
if (status == "active") → use enum or const.
if (timeout > 86400) → use TimeSpan.FromDays(1).

**5. DEEP INHERITANCE HIERARCHIES**
Base > Sub > SubSub > SubSubSub = fragile, hard to reason about.
Prefer composition over inheritance.

**6. SERVICE LOCATOR PATTERN**
var service = ServiceLocator.Get<IMyService>() → hidden dependency.
Use constructor injection instead.

**7. BOOLEAN PARAMETERS**
Process(data, true, false, true) → unreadable.
Use enums, named parameters, or separate methods.

```csharp
record Email {
    public string Value { get; }
    public Email(string value) {
        if (!value.Contains('@')) throw new ArgumentException("Invalid email");
        Value = value;
    }
    public override string ToString() => Value;
}
```

```csharp
// Demo: Primitive Obsession vs Value Object
// BAD:
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

Nullable Reference Types (NRT) — C#'s answer to the billion-dollar mistake.

**KEY CONCEPTS:**
- #nullable enable: compiler warns on potential null dereference.
- string? = nullable; string = non-nullable (by convention + compiler check).
- The ! operator (null-forgiving) suppresses warnings. Use sparingly.
- Python equivalent: Optional[str], type hints with mypy strict mode.

> **Golden Rule:** Enable nullable in ALL new projects. It catches bugs at compile time.

```csharp
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

LINQ is elegant but has performance traps.

**PITFALLS:**
**1. Multiple enumeration: .Where().Count() then .Where().ToList() = 2 passes.**
**2. Deferred execution: .Where() doesn't execute until you consume it.**
**3. Closure allocations: lambdas capture variables, allocating on heap.**
**4. OrderBy().First() = sort everything to get one item. Use MinBy().**

> **Rule:** Materialize (.ToList()) when you'll enumerate multiple times.
> **Rule:** Use MinBy/MaxBy instead of OrderBy().First().

```csharp
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

Code Quality Tools for C#

| Tool                  | Purpose                           | Config            |
|-----------------------|-----------------------------------|-------------------|
| Roslyn Analyzers      | Built-in code analysis (CA rules) | .editorconfig     |
| StyleCop Analyzers    | Style enforcement                 | NuGet package     |
| SonarAnalyzer         | Bug & security detection          | NuGet / SonarQube |
| dotnet format         | Code formatting                   | .editorconfig     |
| NDepend               | Dependency & complexity analysis   | Standalone tool   |
| dotnet-counters       | Runtime performance counters       | CLI tool          |
| PerfView              | CPU/Memory/GC profiling            | Standalone        |
| dotTrace / dotMemory  | JetBrains profilers               | IDE integration   |

KEY .editorconfig RULES:
dotnet_diagnostic.CA1822.severity = warning  // Mark members static if possible
dotnet_diagnostic.CA2007.severity = warning  // ConfigureAwait
dotnet_diagnostic.CA1062.severity = warning  // Validate arguments
dotnet_diagnostic.IDE0090.severity = warning // Use 'new()' shorthand

RECOMMENDED: Enable <TreatWarningsAsErrors>true</TreatWarningsAsErrors> in .csproj

> **Golden Rule:** Warnings are bugs waiting to happen. Fix them or justify the suppression.


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
