---
tags: [csharp, performance, testing]
aliases: [performance profiling, code quality, Stopwatch, BenchmarkDotNet, Span, nullable reference types]
description: "C# performance and code quality reference with executable examples and cell outputs — covers timing, memory measurement, Span<T>, Big-O, LINQ pitfalls, code smells, and static analysis. See [19_py_performance_quality](https://alp78.github.io/elysium/02-Programming-Languages/Python/19_py_performance_quality) for the Python equivalent."
created: 2026-03-24
updated: 2026-03-24
status: complete
---

> [!quote]
> "Make it correct, make it clear, make it concise, make it fast. In that order."
>
> — **Wes Dyer**, blog post (2007)

## Timing & Benchmarking

#### Stopwatch timing and BenchmarkDotNet

> [!info] Benchmarking tools
>
> - `Stopwatch` — high-resolution timing (hardware counters)
> - `BenchmarkDotNet` — production-grade micro-benchmarks (warm-up, JIT, GC, statistics)
> - Python equivalent: `time.perf_counter()`, `timeit`

> [!tip] Never optimize without measuring first.
>
> Never optimize without measuring first. Don't use `DateTime.Now` for benchmarks (15ms resolution).

```csharp
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
$"SlowSum(1M): {sw.ElapsedMilliseconds}ms, result={result}"

// --- High-resolution timing ---
long start = Stopwatch.GetTimestamp();
SlowSum(1_000_000);
var elapsed = Stopwatch.GetElapsedTime(start);
$"GetElapsedTime: {elapsed.TotalMilliseconds:F2}ms"

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

## Memory Measurement

#### GC.GetTotalMemory — measure managed heap allocations

> [!info] Memory measurement
>
> - `GC.GetTotalMemory(true)` — returns managed heap size (measure before/after for delta)
> - Value types (`struct`) live on stack; reference types (`class`) on heap
> - Boxing (`int` → `object`) allocates

> [!tip] Every new is an allocation.
>
> Every `new` is an allocation. Every allocation is future GC pressure.

```csharp
// Measure allocation impact
GC.Collect();
GC.WaitForPendingFinalizers();
long before = GC.GetTotalMemory(true);

var list = new List<int>(100_000);
for (int i = 0; i < 100_000; i++) list.Add(i);

long after = GC.GetTotalMemory(false);
$"List<int>(100K): {(after - before) / 1024.0:F0} KB allocated"

// Compare: int[] vs List<int> vs int[]  preallocated
GC.Collect(); before = GC.GetTotalMemory(true);
var arr = new int[100_000];
for (int i = 0; i < arr.Length; i++) arr[i] = i;
after = GC.GetTotalMemory(false);
$"int[100K]: {(after - before) / 1024.0:F0} KB allocated"

// String vs StringBuilder
GC.Collect(); before = GC.GetTotalMemory(true);
string s = "";
for (int i = 0; i < 10_000; i++) s += i.ToString();
after = GC.GetTotalMemory(false);
$"String += (10K): {(after - before) / 1024.0:F0} KB (O(n²) allocations!)"

GC.Collect(); before = GC.GetTotalMemory(true);
var sb = new System.Text.StringBuilder();
for (int i = 0; i < 10_000; i++) sb.Append(i);
string result2 = sb.ToString();
after = GC.GetTotalMemory(false);
$"StringBuilder: {(after - before) / 1024.0:F0} KB (O(n))"
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
$"PointStruct[100K]: {(after - before) / 1024.0:F0} KB"

// Class array: each element is a heap allocation
GC.Collect();
before = GC.GetTotalMemory(true);
var classArr = new PointClass[100_000];
for (int i = 0; i < classArr.Length; i++) classArr[i] = new PointClass(i, i);
after = GC.GetTotalMemory(false);
$"PointClass[100K]: {(after - before) / 1024.0:F0} KB"
// Struct is significantly smaller (no object header, no GC tracking)
```

    PointStruct[100K]: 789 KB
    PointClass[100K]:  3150 KB

## Span<T> & Zero-Allocation Patterns

#### Span and zero-allocation patterns

> [!info] Span and zero-allocation patterns
>
> - `Span<T>` — stack-only view into contiguous memory; slicing creates a view (no copy)
> - `ReadOnlySpan<char>` — string parsing without `Substring` allocations
> - `stackalloc` — stack arrays (no GC, ~1MB limit)
> - Can't store in fields or use across `await`

```csharp
// Array slicing: copy vs Span
{
    int[] data = Enumerable.Range(0, 1000).ToArray();
    int[] sliceCopy = data[100..200]; // This allocates a new array!

    // With Span (zero-copy view)
    Span<int> span = data.AsSpan(100, 100); // No allocation
    $"Span slice: {span.Length} elements, first={span[0]}, last={span[^1]}"
}

// ReadOnlySpan for string parsing (no substring allocations)
{
    ReadOnlySpan<char> text = "2024-01-15T10:30:00".AsSpan();
    var datePart = text[..10];   // No string allocation
    var timePart = text[11..];   // No string allocation
    $"Date: {datePart.ToString()}, Time: {timePart.ToString()}"
}

// stackalloc: allocate on the stack
{
    Span<int> stackData = stackalloc int[256];
    for (int i = 0; i < stackData.Length; i++) stackData[i] = i * i;
    $"stackalloc: {stackData.Length} ints on the stack"
}
```

    Span slice: 100 elements, first=100, last=199
    Date: 2024-01-15, Time: 10:30:00
    stackalloc: 256 ints on the stack

## Big-O Complexity & Collection Performance

#### Big-O complexity and collection performance cheat sheet

| Operation | `List<T>` | `Array` | `Dict<K,V>` | `HashSet` | `SortedDict` |
|---|---|---|---|---|---|
| Index/Key | O(1) | O(1) | O(1) | — | O(log n) |
| Search | O(n) | O(n) | O(1) | O(1) | O(log n) |
| Add end | O(1)* | — | O(1) | O(1) | O(log n) |
| Add front | O(n) | — | — | — | — |
| Remove | O(n) | — | O(1) | O(1) | O(log n) |

> [!tip] Dictionary/HashSet for fast lookup. List
>
> `Dictionary`/`HashSet` for fast lookup. `List` for ordered indexed access. Never use `List.Contains()` on large data.

```csharp
int n = 100_000;
var list = Enumerable.Range(0, n).ToList();
var hashSet = new HashSet<int>(list);
var dict = list.ToDictionary(x => x, x => x);
var sorted = new SortedDictionary<int, int>(dict);

$"Lookup of element {n-1}:"
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

## Golden Rules of Performance

#### Golden rules of C# performance

> [!tip] Golden Rules of C# Performance
>
> 1. **Measure first** — BenchmarkDotNet or Stopwatch. Never guess.
> 2. **Algorithm > micro-optimization** — O(n²) → O(n log n) beats any inlining
> 3. **Minimize allocations** — every `new` = GC pressure. Use structs, `Span<T>`, `ArrayPool`
> 4. **Right collection** — `Dictionary` > `List` for lookups. `HashSet` for membership
> 5. **Avoid boxing** — `int` → `object` allocates. Use generics, not `object`
> 6. **String `+=` is O(n²)** — use `StringBuilder`. Prefer `StringComparison.Ordinal`
> 7. **Async for I/O, not CPU** — `Parallel.ForEach` for CPU-bound
> 8. **Pool resources** — `ArrayPool<T>.Shared`, one `HttpClient` per app
> 9. **Seal classes** — `sealed` enables devirtualization (inline calls)
> 10. **`readonly struct`** — avoids defensive copies. `ImmutableArray<T>` for thread safety

```csharp
// Demo: ArrayPool (reuse instead of allocate)

var pool = ArrayPool<int>.Shared;
int[] rented = pool.Rent(1024); // May return larger array
try {
    for (int i = 0; i < 1024; i++) rented[i] = i;
    $"ArrayPool: rented {rented.Length} (requested 1024), no allocation!"
} finally {
    pool.Return(rented); // Return to pool for reuse
}
```

    ArrayPool: rented 1024 (requested 1024), no allocation!

## Absolute No-Go's

> [!danger] Absolute no-go's
>
> Absolute no-go's — patterns that should never appear in production C#
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

> [!success] Production-safe alternatives
> Use `StringBuilder` for concatenation, `using` for all `IDisposable` resources, `async Task` for all async methods, and `await` instead of `.Result`/`.Wait()`. Store secrets in `IConfiguration`, user-secrets, or Key Vault. Register `IHttpClientFactory` in DI and use pattern-matched `is` checks over `GetType()` comparisons.

```csharp
// BAD: resource leak if exception occurs
// var conn = new SqlConnection(connString);
// conn.Open(); ... conn.Close();

// GOOD: disposed even if exception occurs
// using var conn = new SqlConnection(connString);
// conn.Open(); ...
```

## Code Smells & Anti-Patterns

#### Code smells and anti-patterns

> [!warning] Code smells
>
> 1. **God class** — 50+ methods. Split by SRP
> 2. **Primitive obsession** — `string` for email → create `Email` value object
> 3. **Feature envy** — method uses another class's data more than its own
> 4. **Magic strings/numbers** — `if (status == "active")` → use `enum`
> 5. **Deep inheritance** — prefer composition over inheritance
> 6. **Service locator** — hidden dependency. Use constructor injection
> 7. **Boolean parameters** — `Process(data, true, false, true)` → use enums or named params

> [!success] Refactoring to clean code
> Apply SRP to split large classes, introduce value objects for domain primitives (e.g., `record Email`), replace magic literals with `enum`, and use constructor injection throughout. Roslyn analyzers (CA rules) flag most of these automatically — treat warnings as errors in CI.

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

#### Primitive obsession vs value objects — demo

```csharp
// Primitive obsession vs value objects — concrete refactoring example

string email = "alice@example.com";  // Just a string, no validation

// GOOD:

var validEmail = new Email("alice@example.com");
validEmail

try {
    var invalid = new Email("not-an-email");
} catch (ArgumentException ex) {
    ex.Message  // caught
}
```

    alice@example.com
    Invalid email

## Nullable Reference Types & Static Analysis

#### Nullable reference types and static analysis

> [!info] Nullable reference types
>
> - `#nullable enable` — turns on compiler null analysis
> - `string?` = nullable, `string` = non-nullable
> - Catches `NullReferenceException` at compile time
> - `!` operator (null-forgiving) suppresses warnings — use sparingly
> - On by default since .NET 6

> [!tip] Enable NRT in all new projects
>
> Enable NRT in all new projects — free bug prevention. Don't ignore nullable warnings or overuse `!`.

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

$"{safeName}, length: {length}"  // safe name

// Pattern matching for null checks (modern C#)
object? obj = "hello";
if (obj is string text) {
    text.ToUpper()  // it's a string
}

// Null-conditional chaining
string? result = maybeName?.ToUpper()?.Trim();
result ?? "(null)"  // chained
```

    Unknown, length: 0
    HELLO
    (null)

## LINQ Performance Pitfalls

#### LINQ performance pitfalls

> [!warning] LINQ performance pitfalls
>
> - **Multiple enumeration** — `.Where().Count()` then `.Where().ToList()` = 2 passes. Materialize with `ToList()` if reused
> - **`.Count() > 0`** — use `.Any()` instead (short-circuits)
> - **`OrderBy().First()`** — sorts everything to get one item. Use `MinBy()`
> - **Deferred execution** — `.Where()` doesn't execute until consumed. Returning deferred queries causes multiple enumerations
> - **Closure allocations** — lambdas capture variables, allocating on heap

> [!success] LINQ best practices
> Materialize with `ToList()` or `ToArray()` before reuse, use `.Any()` over `.Count() > 0`, replace `OrderBy().First()` with `MinBy()`/`MaxBy()`, and prefer manual loops for hot paths where allocations matter. Profiling with BenchmarkDotNet confirms the right trade-off.

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
count  // materialized items

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
    50000
      [LINQ chain] 3.47ms
      [Manual loop] 0.46ms

## Code Quality Tools

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

> [!tip] Enable <TreatWarningsAsErrors>true</TreatWarningsAsErrors> in .csproj. Warnings
>
> Enable `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` in `.csproj`. Warnings are bugs waiting to happen — fix them or justify the suppression.

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
