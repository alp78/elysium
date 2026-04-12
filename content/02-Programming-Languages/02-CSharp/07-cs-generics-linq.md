---
title: "07 - Generics & LINQ - C#"
tags: [csharp]
aliases: [generics, LINQ, type parameters, generic collections, comprehensions, functional programming]
description: "C# generics and LINQ reference with executable examples and cell outputs — covers generic classes, constraints, LINQ query and method syntax, deferred execution, and functional patterns. See [07-py-generics-linq](https://alp78.github.io/elysium/02-Programming-Languages/01-Python/07-py-generics-linq) for the Python equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 07. Generics & LINQ - C#

> [!quote]
> "All non-trivial abstractions, to some degree, are leaky."
>
> — **Joel Spolsky**, *The Law of Leaky Abstractions*, blog post (2002)

> [!abstract]- Summary
>
> **Generics**
> - Type parameters (`<T>`, `<TKey, TValue>`) are placeholders the compiler resolves at each usage site — eliminating boxing for value types and catching type mismatches at compile time.
> - Constraints (`where T : IComparable<T>`, `where T : new()`, `where T : class/struct`, `where T : notnull`, `where T : unmanaged`) narrow the allowed types and unlock interface methods or constructors inside the generic body.
> - Variance: `out T` (covariance) allows a more-derived type where a base is expected on read-only interfaces; `in T` (contravariance) does the same for write-only consumption. Both work only on interfaces and delegates.
>
> **Advanced LINQ — Core Operators**
> - `Where` filters, `Select` projects, `OrderBy`/`OrderByDescending` sorts, `Take`/`Skip` pages — all build a lazy pipeline that executes only when enumerated.
> - `GroupBy` partitions a sequence into `IGrouping<TKey, TElement>` groups for per-group aggregates (Count, Average, Sum, Min, Max, MaxBy).
> - `Join` performs an inner join on matching keys; `GroupJoin` produces a left-join hierarchy grouping all right-side matches under each left element.
> - `ToLookup` builds a multi-value dictionary (unlike `ToDictionary`, it does not throw on duplicate keys).
> - `Zip` pairs elements from two or three sequences positionally, stopping at the shortest.
> - `SelectMany` flattens a projected collection — equivalent to a nested loop or SQL `CROSS APPLY`.
>
> **LINQ Analytics on Live SQL Server Data**
> - Data loaded from `stoxx` via Dapper into `List<Ohlcv>` (66 K rows) and `List<ScoreRow>` (466 rows).
> - `GroupBy` + `Select` aggregates map to SQL `GROUP BY`; chained `GroupBy` + `SelectMany` with index maps to `ROW_NUMBER() OVER (PARTITION BY ...)`.
> - `LAG()` via `Zip` on a shifted list; `LEAD()` via `Zip` with `Skip(1)`; cumulative `SUM()` via `Aggregate` with an accumulator list; rolling average via `Enumerable.Range` + `Skip`/`Take`.
> - `NTILE(N)` via index arithmetic after `OrderBy`; `HAVING` as a `Where` after `GroupBy + Select`; `STDEV` computed manually (no built-in LINQ equivalent).
> - Cross-sequence `Join` pairs OHLCV aggregates with composite scores by symbol; nested `GroupBy` computes best stock per sector.
>
> **LINQ vs Polars.NET — Side-by-Side**
> - Polars.NET reads Parquet directly into a columnar Rust-backed DataFrame; LINQ operates on in-memory `IEnumerable<T>` from Dapper.
> - Column selection: `Select(...)` vs `df.Select(...)`. Row filter: `Where(...)` vs `df.Filter(Col(...))`. Sort: `OrderBy` vs `df.Sort(...)`. Computed column: `Select` anonymous type vs `df.WithColumns(...)`.
> - Aggregation: LINQ `GroupBy + Select` vs `df.GroupBy(...).Agg(...)`. HAVING: `Where` after `Select` vs `df.Filter` after `Agg`.
> - Window functions: LINQ uses `Zip`/`Aggregate`/`Enumerable.Range`; Polars uses `.Shift(1).Over(...)`, `.CumSum().Over(...)`, `.RollingMean("20i").Over(...)`, `.Rank(...).Over(...)`.
> - CRUD-like: `Concat` (LINQ) / `VStack` (Polars) to append rows; `Select` projection (LINQ) / `WithColumns` (Polars) to update; `Where` negation (LINQ) / `Filter` negation (Polars) to delete.

> [!note]- Glossary
>
> **Generic type parameter**
>
> - A placeholder type declared in angle brackets — `<T>`, `<TKey, TValue>` — that the compiler substitutes with a concrete type at each usage site (e.g., `List<int>`, `Dictionary<string, int>`). One generic class or method handles any type without duplication and without losing compile-time type safety.
> - Equivalent in Python: `TypeVar` from the `typing` module; in Java: bounded wildcards `<T extends Comparable<T>>`.
>
> > [!tip] Infer vs. specify
> >
> > The compiler infers `T` from the argument when possible (`First(new[] { 1, 2, 3 })` infers `int`). Specify explicitly (`First<string>(...)`) only when inference is ambiguous or you want to be explicit for readability.
>
>  ---
>
> **Type constraint**
>
> - A `where T : ...` clause that restricts which types are valid for a type parameter, enabling the compiler to guarantee that operations on `T` — such as `.CompareTo()`, `new T()`, or specific interface members — are safe to call inside the generic body.
> - Common constraints: `where T : IComparable<T>` (enables comparison), `where T : new()` (enables `new T()`), `where T : class` (reference types only), `where T : struct` (value types only), `where T : notnull`, `where T : unmanaged` (no reference-type fields), `where T : BaseClass`, `where T : U` (T derives from another type parameter).
>
> > [!warning] Over-constraining reduces reusability
> >
> > Adding constraints that are not needed by the generic body silently narrows the set of usable types. Apply only the constraints the body actually requires.
>
>  ---
>
> **`where T : new()`**
>
> - A constraint that requires `T` to expose a public parameterless constructor, enabling `new T()` inside the generic class or method. Must appear last when combined with other constraints.
> - Any type with only parameterized constructors does not satisfy `new()`. Use a factory delegate `Func<T>` as a parameter instead when parameterless construction is not guaranteed.
>
> > [!tip] Factory delegate pattern
> >
> > `T Create<T>(Func<T> factory) => factory();` avoids the `new()` constraint entirely and gives the caller full control over how `T` is constructed.
>
>  ---
>
> **Covariance (`out T`)**
>
> - Declared with the `out` modifier on an interface or delegate type parameter (e.g., `IEnumerable<out T>`). Allows a more-derived type to be used where a base type is expected — for example, passing `IEnumerable<Dog>` where `IEnumerable<Animal>` is required. Safe only for read (output) positions.
> - Applies exclusively to interfaces and delegates; generic classes are invariant. The `out` modifier prevents `T` from appearing in input positions (e.g., as a method parameter), which is what makes the variance type-safe.
>
> > [!info] IEnumerable is covariant by design
> >
> > `IEnumerable<out T>` is covariant in .NET because it only produces `T` (via `GetEnumerator`) and never consumes it. This is why a `List<string>` can be passed to a method that accepts `IEnumerable<object>`.
>
>  ---
>
> **Contravariance (`in T`)**
>
> - Declared with the `in` modifier on an interface or delegate type parameter (e.g., `Action<in T>`, `IComparer<in T>`). Allows a less-derived (broader) type to be used where a more-derived type is expected — for example, passing `Action<Animal>` where `Action<Dog>` is required. Safe only for write (input) positions.
> - Mixing `in` and `out` on the same type parameter causes a compile error. A type parameter can be covariant or contravariant, never both.
>
> > [!tip] Practical use: comparers and handlers
> >
> > `IComparer<Animal>` satisfies `IComparer<Dog>` (contravariance) — an `AnimalComparer` can sort dogs because dogs are animals. Pass a broader comparer or event handler where a narrower one is expected.
>
>  ---
>
> **LINQ**
>
> - Language Integrated Query — a set of extension methods (`System.Linq`) and optional query syntax keywords that add a declarative, composable pipeline model for filtering, transforming, grouping, and joining any `IEnumerable<T>` or `IQueryable<T>` directly in C#.
> - Replaces manual `foreach` loops with readable, chainable expressions that preserve strong typing and compose lazily. The same operators apply to in-memory collections, LINQ to SQL, Entity Framework, and XML (`XDocument`).
>
> > [!warning] LINQ is lazy — pipelines re-execute on each enumeration
> >
> > A LINQ query builds a description of the operation, not the result. Every call to `foreach`, `.Count()`, or `.ToList()` re-runs the pipeline from source. If the source is expensive (database, file), materialize with `.ToList()` or `.ToArray()` before enumerating more than once.
>
>  ---
>
> **Deferred execution**
>
> - The property of LINQ pipelines whereby query evaluation is postponed until a consuming operation enumerates the result — `.ToList()`, `.ToArray()`, `foreach`, `.Count()`, `.First()`, etc. The query object holds the pipeline description, not the data.
> - Enables composable query building: partial pipelines can be stored in variables and extended before materialization. Also avoids computing results that are never consumed.
>
> > [!tip] When to materialize early
> >
> > Materialize with `.ToList()` when: (1) the source collection may change between enumerations, (2) the pipeline is expensive and the result is needed more than once, (3) you need random access by index, or (4) you need to pass the result to a method expecting `IList<T>`.
>
>  ---
>
> **Method syntax**
>
> - LINQ expressed as a chain of extension-method calls: `data.Where(x => x > 5).Select(x => x * 2).OrderBy(x => x)`. The dominant style in production C# because it is composable, tooling-friendly, and supports all LINQ operators.
> - Compiled to the same IL as query syntax. Some operators — `Distinct`, `Take`, `Skip`, `Zip`, `SelectMany` with a result selector — have no query syntax equivalent and require method syntax.
>
> > [!tip] Chain readability tip
> >
> > Break long method-syntax chains onto separate lines, one operator per line, aligned at the dot. The compiler treats the whole expression as one statement; formatting is cosmetic.
>
>  ---
>
> **Query syntax**
>
> - LINQ expressed with SQL-like keywords: `from x in data where x > 5 select x * 2`. Compiled identically to method syntax. More readable for complex multi-source joins and `let` bindings that would produce deeply nested lambda arguments.
> - Not all LINQ operators have query-syntax equivalents: `Distinct`, `Take`, `Skip`, `Zip`, `Aggregate`, and `ToLookup` require method syntax or a hybrid expression.
>
> > [!info] Query syntax is syntactic sugar
> >
> > The C# compiler transforms every query-syntax expression into an equivalent method-syntax call tree before compilation. The two forms produce identical IL — choose based on readability for the specific query.
>
>  ---
>
> **`Select`**
>
> - Projects each element of a sequence into a new form using a selector function: `data.Select(x => new { x.Name, x.Age })`. Equivalent to SQL `SELECT` or Python `map()`. Returns a new `IEnumerable<TResult>` of the projected type without filtering the source.
> - Confusing `Select` (transform) with `Where` (filter) is the most common beginner mistake. `Select` always produces the same count as the source; `Where` may produce fewer.
>
> > [!tip] Projecting to anonymous types
> >
> > `Select(x => new { x.Symbol, x.Close })` creates an anonymous type inferred by the compiler. Use named record or class types when the projection must cross method boundaries or be returned from a method.
>
>  ---
>
> **`Where`**
>
> - Filters elements by a predicate: `data.Where(x => x.Age > 30)`. Returns an `IEnumerable<T>` containing only elements for which the predicate returns `true`. Equivalent to SQL `WHERE` or Python `filter()`.
> - Use `First(predicate)` or `Single(predicate)` when you expect exactly one result — using `Where` when you need a single element forces a second traversal or requires `.First()` chained after `Where`.
>
> > [!warning] `First` vs `FirstOrDefault` on empty sequences
> >
> > `First(predicate)` throws `InvalidOperationException` when no element matches. Use `FirstOrDefault(predicate)` and null-check the result when an empty match is a valid outcome.
>
>  ---
>
> **`GroupBy`**
>
> - Groups elements by a key selector function: `data.GroupBy(x => x.Department)`. Returns `IEnumerable<IGrouping<TKey, TElement>>` — one `IGrouping` per distinct key. Access `.Key` for the group identifier and enumerate the group itself for its elements.
> - Equivalent to SQL `GROUP BY` or Python `itertools.groupby` (but does not require the source to be pre-sorted). Use with `Select(g => new { g.Key, ... })` to project aggregates per group.
>
> > [!info] IGrouping is lazy too
> >
> > Each `IGrouping<TKey, TElement>` is itself a deferred sequence. Calling aggregates like `.Count()`, `.Sum()`, or `.Average()` inside a `Select` after `GroupBy` enumerates the group on each call. If multiple aggregates are needed on the same group, materializing each group with `.ToList()` inside the `Select` avoids repeated enumeration.
>
>  ---
>
> **`Aggregate`**
>
> - Applies an accumulator function sequentially across a sequence, threading the result from one step to the next: `data.Aggregate((acc, x) => acc + x)`. Equivalent to Python's `functools.reduce()`. An optional seed value initializes the accumulator before the first element.
> - Without a seed, `Aggregate` throws `InvalidOperationException` on an empty sequence. With a seed (`data.Aggregate(0, (acc, x) => acc + x)`), an empty sequence safely returns the seed value.
>
> > [!warning] Seed-less Aggregate throws on empty sequences
> >
> > The overload `Aggregate(func)` uses the first element as the implicit seed. If the sequence is empty, it throws. Always provide an explicit seed unless the source is guaranteed non-empty.
>
>  ---
>
> **Polars.NET**
>
> - A .NET binding for the Polars DataFrame library — a Rust-backed, columnar, multi-threaded analytical engine. Exposes a `DataFrame` / `Series` API in C# for vectorized operations over large datasets, reading Parquet files directly without ORM overhead.
> - Newer ecosystem with fewer community examples than pandas (Python) or LINQ on collections. The expression API (`Col(...)`, `Lit(...)`, `.Over(...)`) mirrors Polars' lazy evaluation model and supports window functions natively via `.Shift`, `.CumSum`, `.RollingMean`, and `.Rank`.
>
> > [!info] LINQ vs Polars.NET — when to choose each
> >
> > - **LINQ:** natural choice for in-memory object graphs loaded from Dapper, EF Core, or any `IEnumerable<T>`. Zero extra dependencies; composes with the type system.
> > - **Polars.NET:** better for large columnar datasets (>100 K rows), Parquet ingestion, or when vectorized aggregations and window functions need to run fast without writing LINQ workarounds.

Generics let you write type-safe code that works across multiple types without duplication — the compiler enforces correctness at compile time rather than deferring to runtime casts. LINQ (Language Integrated Query) extends this with a declarative pipeline model for filtering, transforming, grouping, and joining collections directly in C#, mirroring SQL semantics while preserving strong typing. 


```csharp
// Suppress CS1701/CS1702 assembly version warnings in .NET Interactive.
using System.Reflection;
using Microsoft.DotNet.Interactive;
using Microsoft.DotNet.Interactive.CSharp;

var csharpKernel = (CSharpKernel)Kernel.Root.FindKernelByName("csharp");
var optionsField = typeof(CSharpKernel).GetField("_scriptOptions",
    BindingFlags.NonPublic | BindingFlags.Instance);
var scriptOptions = optionsField.GetValue(csharpKernel);
var withWarningLevel = scriptOptions.GetType().GetMethod("WithWarningLevel");
var newOptions = withWarningLevel.Invoke(scriptOptions, new object[] { 0 });
optionsField.SetValue(csharpKernel, newOptions);
```

```csharp
#r "nuget: Microsoft.Data.SqlClient"
#r "nuget: Dapper"
#r "nuget: Polars.NET"
#r "nuget: Polars.NET.Native.win-x64"

using Microsoft.Data.SqlClient;
using Dapper;
using Polars.CSharp;
using static Polars.CSharp.Polars;
using Microsoft.DotNet.Interactive.Formatting;
// Register Polars DataFrame/Series HTML formatters (transparent for dark theme)
Formatter.Register<DataFrame>((df, writer) =>
{
    var html = df.ToHtml();
    html = System.Text.RegularExpressions.Regex.Replace(html, @"(>|>)&quot;(.+?)&quot;(<|<)", @"$1$2$3");
    html = System.Text.RegularExpressions.Regex.Replace(html, @">""(.+?)""<", @">$1<");
    var css = @"<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>";
    writer.Write(css + html);
}, "text/html");
Formatter.Register<Polars.CSharp.Series>((s, writer) =>
{
    var sdf = DataFrame.FromSeries(s);
    var shtml = sdf.ToHtml();
    shtml = System.Text.RegularExpressions.Regex.Replace(shtml, @"(>|>)&quot;(.+?)&quot;(<|<)", @"$1$2$3");
    shtml = System.Text.RegularExpressions.Regex.Replace(shtml, @">""(.+?)""<", @">$1<");
    var scss = @"<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>";
    writer.Write(scss + shtml);
}, "text/html");
```

## Generics

Generics enable writing reusable, type-safe code by parameterizing classes, methods, and interfaces with type placeholders (`T`, `TKey`, `TValue`). The compiler substitutes concrete types at compile time, eliminating boxing for value types and catching type mismatches before runtime. Constraints (`where T : ...`) restrict what types are valid, unlocking access to interface methods, constructors, and base class members within the generic body.

### C# | Generics | type parameters and constraints

Generic type parameters are placeholders declared in angle brackets. The compiler infers `T` from arguments when possible, or you can specify it explicitly. Constraints narrow the allowed types, enabling the compiler to guarantee that operations like `.CompareTo()` or `new T()` are valid.

#### Generic method

> [!info] Generic methods
>
> - `T First<T>(T[] items)` — declares a type parameter `T` the compiler infers from the argument
> - One method handles `int[]`, `string[]`, `double[]` — no overloads needed
> - Type safety preserved at compile time
> - Avoid `object` instead of generics (loses type safety, requires casting)

```csharp
T First<T>(T[] items) => items[0];

Console.WriteLine(First(new[] { 1, 2, 3 }));          // int
Console.WriteLine(First(new[] { "a", "b", "c" }));    // string
Console.WriteLine(First(new[] { 1.1, 2.2, 3.3 }));    // double

Console.WriteLine(First<string>(new[] { "x", "y" }));  // explicit type argument
```

```text
1
a
1.1
x
```

#### Generic constraints — `where T : ...`

Generic constraints restrict what types can be used as a type parameter. Without constraints, `T` could be anything — you can't call methods on it because the compiler doesn't know what `T` is. Adding `where T : IComparable` guarantees that `T` has a `CompareTo` method, enabling type-safe operations. Common constraints: `class` (reference type), `struct` (value type), `new()` (has parameterless constructor), `notnull`, and interface/base class requirements.

```csharp
T Max<T>(T a, T b) where T : IComparable<T>
    => a.CompareTo(b) >= 0 ? a : b;

Console.WriteLine(Max(3, 7));                          // 7
Console.WriteLine(Max("apple", "banana"));             // banana
// Max(new object(), new object());  // Compile error — object doesn't implement IComparable
```

```text
7
banana
```

> [!info] Common generic constraints
>
> | Constraint | Meaning |
> |---|---|
> | `where T : struct` | T must be a value type (`int`, `bool`, custom `struct`) |
> | `where T : class` | T must be a reference type (`string`, `class`) |
> | `where T : new()` | T must have a parameterless constructor (must appear last) |
> | `where T : IComparable<T>` | T must implement the specified interface |
> | `where T : BaseClass` | T must inherit from a specific class |
> | `where T : notnull` | T cannot be `null` |
> | `where T : unmanaged` | T must be an unmanaged type (no reference-type fields) |
> | `where T : U` | T must be or derive from another type parameter U |
> | `where T : default` | Resolves ambiguity when overriding unconstrained methods |
> | `where T : allows ref struct` | T may be a `ref struct` (anti-constraint, C# 13+) |

> [!warning] `where T : class` — `==` tests reference identity, not value equality
> When using the `class` constraint, the `==` and `!=` operators on `T` compare reference identity, not value equality — even if the concrete type (e.g., `string`) overloads `==`. Two distinct `string` instances with the same content will compare as `false`.

> [!success] Use `IEquatable<T>` for value comparison
> Add `where T : IEquatable<T>` and call `a.Equals(b)` instead of `a == b` when you need value equality semantics inside a generic method or class.

#### Generic class and multiple type parameters

A generic class is parameterized by one or more types, allowing the same data structure to work with any type while maintaining compile-time type safety. `Result<TValue, TError>` can represent a success value OR an error without boxing or casting. Multiple type parameters let you build type-safe pairs, key-value mappings, and response wrappers.

```csharp
var ints = new List<int> { 1, 2, 3 };
var lookup = new Dictionary<string, int> { ["Alice"] = 85, ["Bob"] = 92 };
Console.WriteLine($"[{string.Join(", ", ints)}]");
Console.WriteLine(string.Join(", ", lookup.Select(kv => $"{kv.Key}: {kv.Value}")));

(TKey, TValue) MakePair<TKey, TValue>(TKey key, TValue value) => (key, value);

var pair1 = MakePair("name", 42);
var pair2 = MakePair(1, true);
Console.WriteLine(pair1);
Console.WriteLine(pair2);
```

```text
[1, 2, 3]
92
(name, 42)
(1, True)
```

## Advanced LINQ

LINQ extends C# with a declarative query model over any `IEnumerable<T>`. Method syntax chains — `Where`, `Select`, `GroupBy`, `Join`, `SelectMany` — compose into lazy pipelines that execute only when enumerated. This section demonstrates core LINQ operators using in-memory anonymous-type collections, covering grouping with aggregations, inner and left joins, lookups, zipping parallel sequences, and flattening nested collections.

### C# | LINQ | core operators

The examples below use a shared dataset of employees and departments defined as anonymous types. Each operator is shown independently so the pipeline logic is clear.

#### Sample data

Shared in-memory collections used throughout the LINQ section — six employees across three departments and four department records (including one with no employees, to demonstrate left join behavior).

```csharp
var employees = new[]
{
    new { Name = "Alice", Dept = "Engineering", Salary = 95000, Level = "senior" },
    new { Name = "Bob", Dept = "Sales", Salary = 65000, Level = "junior" },
    new { Name = "Charlie", Dept = "Engineering", Salary = 110000, Level = "lead" },
    new { Name = "Diana", Dept = "Sales", Salary = 78000, Level = "senior" },
    new { Name = "Eve", Dept = "Engineering", Salary = 88000, Level = "junior" },
    new { Name = "Frank", Dept = "Marketing", Salary = 72000, Level = "senior" },
};

var departments = new[]
{
    new { Dept = "Engineering", Budget = 500000, Head = "CTO" },
    new { Dept = "Sales", Budget = 300000, Head = "VP Sales" },
    new { Dept = "Marketing", Budget = 200000, Head = "CMO" },
    new { Dept = "HR", Budget = 150000, Head = "CHRO" },       // no employees
};
```

#### `GroupBy` and aggregations

`GroupBy` partitions a sequence into groups based on a key function, then lets you aggregate each group independently. It's the LINQ equivalent of SQL's `GROUP BY` — you specify what to group by (e.g., sector), then compute aggregates per group (count, sum, average). The result is an `IGrouping<TKey, TElement>` for each distinct key.

```csharp
var byDept = employees.GroupBy(e => e.Dept);

foreach (var group in byDept)
{
    var names = string.Join(", ", group.Select(e => e.Name));
    var avgSalary = group.Average(e => e.Salary);
    Console.WriteLine($"  {group.Key,-15} ({group.Count()} people): [{names}] avg=${avgSalary:N0}");
}

foreach (var group in byDept)
{
    var top = group.MaxBy(e => e.Salary)!;
    Console.WriteLine($"  {group.Key,-15} top earner: {top.Name} ${top.Salary:N0}");
}

var deptStats = employees.GroupBy(e => e.Dept).Select(g => new
{
    Dept = g.Key,
    Count = g.Count(),
    AvgSalary = g.Average(e => e.Salary),
    MaxSalary = g.Max(e => e.Salary),
    MinSalary = g.Min(e => e.Salary),
    TotalSalary = g.Sum(e => e.Salary),
});
foreach (var s in deptStats)
    Console.WriteLine($"  {s.Dept,-15} count={s.Count} avg=${s.AvgSalary:N0} range=[${s.MinSalary:N0}-${s.MaxSalary:N0}] total=${s.TotalSalary:N0}");
```

```text
Engineering     (3 people): [Alice, Charlie, Eve] avg=$97'667
Sales           (2 people): [Bob, Diana] avg=$71'500
Marketing       (1 people): [Frank] avg=$72'000
Engineering     top earner: Charlie $110'000
Sales           top earner: Diana $78'000
Marketing       top earner: Frank $72'000
Engineering     count=3 avg=$97'667 range=[$88'000-$110'000] total=$293'000
Sales           count=2 avg=$71'500 range=[$65'000-$78'000] total=$143'000
Marketing       count=1 avg=$72'000 range=[$72'000-$72'000] total=$72'000
```

#### `Join` and `GroupJoin`

`Join` combines two sequences by matching a key from each — the LINQ equivalent of SQL's `INNER JOIN`. `GroupJoin` is a LEFT JOIN variant that groups all matching right-side elements under each left-side element, producing a hierarchical result. Both require you to specify the outer key, inner key, and result selector.

> [!warning] Join requires matching key types
> The outer and inner key selectors must return the same type. If one returns `int` and the other returns `string`, the join silently produces zero results with no compile-time error. Always verify key types match.

> [!success] Verify key types before joining
> Confirm that both key selectors return the same type (e.g., both `string`). Use explicit casts or `.ToString()` if types differ, and add a unit test that asserts the join result count is greater than zero.

```csharp
var innerJoin = employees.Join(
    departments,
    e => e.Dept,
    d => d.Dept,
    (e, d) => new { e.Name, e.Dept, d.Head, d.Budget }
);
foreach (var r in innerJoin.Take(3))
    Console.WriteLine($"  {r.Name,-10} {r.Dept,-15} head={r.Head,-10} budget=${r.Budget:N0}");

var leftJoin = departments.GroupJoin(
    employees,
    d => d.Dept,
    e => e.Dept,
    (d, emps) => new { d.Dept, d.Head, Count = emps.Count() }
);
foreach (var r in leftJoin)
    Console.WriteLine($"  {r.Dept,-15} head={r.Head,-10} employees={r.Count}");
```
```text
Alice      Engineering     head=CTO        budget=$500'000
Bob        Sales           head=VP Sales   budget=$300'000
Charlie    Engineering     head=CTO        budget=$500'000
Engineering     head=CTO        employees=3
Sales           head=VP Sales   employees=2
Marketing       head=CMO        employees=1
HR              head=CHRO       employees=0
```

#### Chained pipeline, `Lookup`, and `Zip`

LINQ pipelines compose by chaining operators — `Where` → `Select` → `OrderByDescending` → `Take` reads left to right as filter, project, sort, limit. `ToLookup` creates a dictionary-like structure that allows multiple values per key (unlike `ToDictionary` which throws on duplicates). `Zip` pairs elements from two or three sequences positionally, stopping at the shortest.

```csharp
var result = employees
    .Where(e => e.Salary > 75000)
    .Select(e => new { e.Name, e.Salary, Tax = e.Salary * 0.3 })
    .OrderByDescending(e => e.Salary)
    .Take(3);
foreach (var r in result)
    Console.WriteLine($"  {r.Name,-10} salary=${r.Salary:N0}  tax=${r.Tax:N0}");

var empLookup = employees.ToLookup(e => e.Dept);
Console.WriteLine($"Engineering: [{string.Join(", ", empLookup["Engineering"].Select(e => e.Name))}]");
Console.WriteLine($"Unknown:     [{string.Join(", ", empLookup["Unknown"].Select(e => e.Name))}]");

var names = employees.Select(e => e.Name);
var salaries = employees.Select(e => e.Salary);
var raises = employees.Select(e => e.Salary * 0.1);

foreach (var (name, salary, raise_amt) in names.Zip(salaries, raises))
    Console.WriteLine($"  {name,-10} ${salary,8:N0} + ${raise_amt,7:N0} raise");
```
```text
Charlie    salary=$110'000  tax=$33'000
Alice      salary=$95'000  tax=$28'500
Eve        salary=$88'000  tax=$26'400
Engineering: [Alice, Charlie, Eve]
Unknown:     []
Alice      $  95'000 + $  9'500 raise
Bob        $  65'000 + $  6'500 raise
Charlie    $ 110'000 + $ 11'000 raise
Diana      $  78'000 + $  7'800 raise
Eve        $  88'000 + $  8'800 raise
Frank      $  72'000 + $  7'200 raise
```

#### `SelectMany` — flatten nested collections

`SelectMany` projects each element to a collection, then flattens all those collections into one sequence. It's the LINQ equivalent of a nested loop or SQL's `CROSS APPLY`. Common use: a list of orders where each order has multiple line items — `SelectMany` gives you a flat list of all line items across all orders.

```csharp
var people = new[]
{
    new { Name = "Alice", Skills = new[] { "C#", "LINQ", "SQL" } },
    new { Name = "Bob",   Skills = new[] { "Python", "SQL" } },
    new { Name = "Charlie", Skills = new[] { "C#", "Go" } },
};

foreach (var arr in people.Select(p => p.Skills))
    Console.WriteLine($"  [{string.Join(", ", arr)}]");

var allSkills = people.SelectMany(p => p.Skills);
Console.WriteLine($"SelectMany (flat): [{string.Join(", ", allSkills)}]");

var pairs = people.SelectMany(
    p => p.Skills,
    (p, skill) => $"{p.Name}: {skill}"
);
foreach (var pair in pairs)
    Console.WriteLine($"  {pair}");

Console.WriteLine($"Distinct skills: [{string.Join(", ", people.SelectMany(p => p.Skills).Distinct().OrderBy(s => s))}]");

var matrix = new List<List<int>>
{
    new List<int> { 1, 2, 3 },
    new List<int> { 4, 5 },
    new List<int> { 6, 7, 8, 9 },
};
Console.WriteLine($"Flat matrix: [{string.Join(", ", matrix.SelectMany(row => row))}]");
```
```text
Select (nested):
  [C#, LINQ, SQL]
  [Python, SQL]
  [C#, Go]

SelectMany (flat): [C#, LINQ, SQL, Python, SQL, C#, Go]

SelectMany with result selector:
  Alice: C#
  Alice: LINQ
  Alice: SQL
  Bob: Python
  Bob: SQL
  Charlie: C#
  Charlie: Go

Distinct skills: [C#, Go, LINQ, Python, SQL]
Flat matrix: [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

## LINQ Analytics on Live SQL Server Data

Advanced analytics queries written in LINQ against the local `stoxx` database — the C# equivalent
of SQL window functions, running aggregates, and analytical patterns.

Tables used:
- `silver.eurostoxx50_ohlcv` — 66K rows of daily OHLCV data for 50 European stocks
- `gold.scores_daily` — composite scores with 36 metrics per stock
- `gold.index_performance` — daily index-level returns and rolling metrics
- `silver.index_dim` — company metadata (sector, country, exchange)
- `bronze.trading_calendar` — 29K trading day flags per exchange

### C# | LINQ | SQL Server data setup

Connection and DTO records for loading EUROSTOXX 50 OHLCV and composite score data from the local `stoxx` database using Dapper.

#### DTO records for SQL Server data mapping

Dapper maps SQL result columns to C# record properties by matching names. Records must be declared in a separate cell because C# requires type declarations before top-level statements in .NET Interactive.

```csharp
record Ohlcv(string Symbol, DateTime Date, double Open, double High, double Low,
             double Close, double AdjClose, long Volume);
record ScoreRow(string Symbol, string Sector, string Country, double CompositeScore,
               short CompositeRank, double MomentumScore, double CurrentPrice, double YtdChangePct);
```

```csharp
var connStr = "Server=localhost,1434;Database=stoxx;"
    + "User Id=sa;Password=EsgDev2026Pass1;"
    + "Encrypt=True;TrustServerCertificate=True;";

List<Ohlcv> ohlcv;
List<ScoreRow> scores;
using (var conn = new SqlConnection(connStr))
{
    conn.Open();
    ohlcv = conn.Query<Ohlcv>(
        "SELECT symbol AS Symbol, date AS Date, [open] AS [Open], high AS High, low AS Low, "
        + "[close] AS [Close], adj_close AS AdjClose, volume AS Volume "
        + "FROM silver.eurostoxx50_ohlcv").AsList();
    scores = conn.Query<ScoreRow>(
        "SELECT symbol AS Symbol, sector AS Sector, country AS Country, "
        + "composite_score AS CompositeScore, composite_rank AS CompositeRank, "
        + "momentum_score AS MomentumScore, current_price AS CurrentPrice, "
        + "ytd_change_pct AS YtdChangePct "
        + "FROM gold.scores_daily").AsList();
}
Console.WriteLine($"  OHLCV: {ohlcv.Count:N0} rows, {ohlcv.Select(r => r.Symbol).Distinct().Count()} symbols");
Console.WriteLine($"  Scores: {scores.Count:N0} rows");
Console.WriteLine($"  Date range: {ohlcv.Min(r => r.Date):yyyy-MM-dd} to {ohlcv.Max(r => r.Date):yyyy-MM-dd}");
```

```text
66'355 rows, 50 symbols
466 rows
2021-01-04 to 2026-03-12
```

### C# | LINQ | analytical queries on financial data

Each query below demonstrates a LINQ pattern equivalent to a common SQL analytical operation — aggregation, window functions, filtering after grouping, and joins — applied to real EUROSTOXX 50 market data.

#### LINQ — `GroupBy` with Aggregates

Splits a collection into groups by key and applies multiple aggregate functions (Average, Sum, Min, Max, Count) to each group.

```csharp
var summary = ohlcv
    .GroupBy(r => r.Symbol)
    .Select(g => new
    {
        Symbol = g.Key,
        AvgClose = g.Average(r => r.Close),
        TotalVolume = g.Sum(r => r.Volume),
        MinLow = g.Min(r => r.Low),
        MaxHigh = g.Max(r => r.High),
        Days = g.Count(),
    })
    .OrderByDescending(s => s.AvgClose)
    .Take(10);

// Display as Polars DataFrame
var results = summary.ToList();
new DataFrame(
    Series.From("Symbol", results.Select(s => s.Symbol).ToArray()),
    Series.From("AvgClose", results.Select(s => Math.Round(s.AvgClose, 2)).ToArray()),
    Series.From("TotalVolume", results.Select(s => s.TotalVolume).ToArray()),
    Series.From("MinLow", results.Select(s => Math.Round(s.MinLow, 2)).ToArray()),
    Series.From("MaxHigh", results.Select(s => Math.Round(s.MaxHigh, 2)).ToArray()),
    Series.From("Days", results.Select(s => s.Days).ToArray()))
```

<!-- Polars DataFrame: (10 rows, 6 columns) --><table><thead><tr><th>Symbol</th><th>AvgClose</th><th>TotalVolume</th><th>MinLow</th><th>MaxHigh</th><th>Days</th></tr></thead><tbody><tr><td>RMS.PA</td><td>1761.56</td><td>81633862</td><td>839.4</td><td>2957</td><td>1331</td></tr><tr><td>ADYEN.AS</td><td>1545.98</td><td>110400463</td><td>602.8</td><td>2835</td><td>1331</td></tr><tr><td>ASML.AS</td><td>671.35</td><td>945070720</td><td>375.75</td><td>1312.8</td><td>1331</td></tr><tr><td>MC.PA</td><td>662.4</td><td>557855567</td><td>436.55</td><td>904.6</td><td>1331</td></tr><tr><td>RHM.DE</td><td>544.66</td><td>308359744</td><td>76.28</td><td>2008</td><td>1324</td></tr><tr><td>ARGX.BR</td><td>413.69</td><td>94592244</td><td>201.4</td><td>810</td><td>1331</td></tr><tr><td>OR.PA</td><td>377.54</td><td>484115375</td><td>290.1</td><td>461.85</td><td>1331</td></tr><tr><td>MUV2.DE</td><td>374.66</td><td>398802950</td><td>205.15</td><td>615.8</td><td>1324</td></tr><tr><td>RACE.MI</td><td>289.75</td><td>476686026</td><td>154.4</td><td>492.8</td><td>1321</td></tr><tr><td>ALV.DE</td><td>252.19</td><td>1101960308</td><td>156.22</td><td>396</td><td>1324</td></tr></tbody></table>

#### LINQ — Window Function `ROW_NUMBER()`

Assigns a sequential rank to each row within a partition, ordered by a column. Equivalent to SQL ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...).

```csharp
var topVolumeDay = ohlcv
    .GroupBy(r => r.Symbol)
    .SelectMany(g => g
        .OrderByDescending(r => r.Volume)
        .Select((r, idx) => new { r.Symbol, r.Date, r.Close, r.Volume, Rank = idx + 1 })
        .Where(r => r.Rank == 1))
    .OrderByDescending(r => r.Volume)
    .Take(10);

var results = topVolumeDay.ToList();
new DataFrame(
    Series.From("Symbol", results.Select(r => r.Symbol).ToArray()),
    Series.From("Date", results.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", results.Select(r => Math.Round(r.Close, 2)).ToArray()),
    Series.From("Volume", results.Select(r => r.Volume).ToArray()))
```

<!-- Polars DataFrame: (10 rows, 4 columns) --><table><thead><tr><th>Symbol</th><th>Date</th><th>Close</th><th>Volume</th></tr></thead><tbody><tr><td>ISP.MI</td><td>2023-08-08</td><td>2.34</td><td>376391539</td></tr><tr><td>SAN.MC</td><td>2021-10-20</td><td>3.36</td><td>367211467</td></tr><tr><td>BBVA.MC</td><td>2021-09-17</td><td>5.67</td><td>228528294</td></tr><tr><td>NDA-FI.HE</td><td>2022-09-16</td><td>9.14</td><td>140675854</td></tr><tr><td>PRX.AS</td><td>2021-08-17</td><td>32.43</td><td>114772834</td></tr><tr><td>ENEL.MI</td><td>2021-10-15</td><td>6.92</td><td>101413521</td></tr><tr><td>UCG.MI</td><td>2021-12-09</td><td>12.8</td><td>82881371</td></tr><tr><td>IBE.MC</td><td>2022-10-21</td><td>9.53</td><td>82592287</td></tr><tr><td>INGA.AS</td><td>2024-02-01</td><td>12.34</td><td>55872649</td></tr><tr><td>ENI.MI</td><td>2025-04-07</td><td>12.04</td><td>48554374</td></tr></tbody></table>

#### LINQ — Window Function `LAG()`

Accesses the value from the previous row in a sorted sequence. Implemented via Zip with a shifted copy of the list.

```csharp
var withReturns = ohlcv
    .GroupBy(r => r.Symbol)
    .SelectMany(g =>
    {
        var sorted = g.OrderBy(r => r.Date).ToList();
        return sorted.Skip(1).Zip(sorted, (curr, prev) => new
        {
            curr.Symbol, curr.Date, curr.Close,
            PrevClose = prev.Close,
            DailyReturn = (curr.Close - prev.Close) / prev.Close * 100,
        });
    });

var topGains = withReturns.OrderByDescending(r => r.DailyReturn).Take(10);

var results = topGains.ToList();
new DataFrame(
    Series.From("Symbol", results.Select(r => r.Symbol).ToArray()),
    Series.From("Date", results.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", results.Select(r => Math.Round(r.Close, 2)).ToArray()),
    Series.From("PrevClose", results.Select(r => Math.Round(r.PrevClose, 2)).ToArray()),
    Series.From("Return%", results.Select(r => Math.Round(r.DailyReturn, 2)).ToArray()))
```

<!-- Polars DataFrame: (10 rows, 5 columns) --><table><thead><tr><th>Symbol</th><th>Date</th><th>Close</th><th>PrevClose</th><th>Return%</th></tr></thead><tbody><tr><td>ADYEN.AS</td><td>2023-11-09</td><td>958.8</td><td>695.7</td><td>37.82</td></tr><tr><td>ARGX.BR</td><td>2023-07-17</td><td>437.6</td><td>334</td><td>31.02</td></tr><tr><td>RHM.DE</td><td>2022-02-28</td><td>133.6</td><td>107.05</td><td>24.8</td></tr><tr><td>PRX.AS</td><td>2022-03-16</td><td>24.1</td><td>19.45</td><td>23.88</td></tr><tr><td>ADS.DE</td><td>2022-11-04</td><td>114.04</td><td>93.95</td><td>21.38</td></tr><tr><td>ADYEN.AS</td><td>2024-02-08</td><td>1436.2</td><td>1183.6</td><td>21.34</td></tr><tr><td>ENR.DE</td><td>2024-11-13</td><td>46.33</td><td>38.95</td><td>18.95</td></tr><tr><td>RHM.DE</td><td>2022-03-01</td><td>156.6</td><td>133.6</td><td>17.22</td></tr><tr><td>VOW.DE</td><td>2021-03-17</td><td>308.8</td><td>266.6</td><td>15.83</td></tr><tr><td>PRX.AS</td><td>2022-06-27</td><td>28.17</td><td>24.35</td><td>15.72</td></tr></tbody></table>

#### LINQ — Window Function Cumulative `SUM()`

Computes a running total where each row includes the sum of all preceding rows. Implemented via Aggregate with an accumulator.

```csharp
var cumVol = ohlcv
    .Where(r => r.Symbol == "ASML.AS")
    .OrderBy(r => r.Date)
    .Aggregate(
        new List<(DateTime Date, long Vol, long CumVol)>(),
        (acc, r) => { acc.Add((r.Date, r.Volume, (acc.Count > 0 ? acc[^1].CumVol : 0) + r.Volume)); return acc; });

new DataFrame(
    Series.From("Date", cumVol.TakeLast(10).Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Volume", cumVol.TakeLast(10).Select(r => r.Vol).ToArray()),
    Series.From("CumVolume", cumVol.TakeLast(10).Select(r => r.CumVol).ToArray()))
```

<!-- Polars DataFrame: (10 rows, 3 columns) --><table><thead><tr><th>Date</th><th>Volume</th><th>CumVolume</th></tr></thead><tbody><tr><td>2026-02-27</td><td>1010698</td><td>938726541</td></tr><tr><td>2026-03-02</td><td>871267</td><td>939597808</td></tr><tr><td>2026-03-03</td><td>941945</td><td>940539753</td></tr><tr><td>2026-03-04</td><td>714587</td><td>941254340</td></tr><tr><td>2026-03-05</td><td>778081</td><td>942032421</td></tr><tr><td>2026-03-06</td><td>857271</td><td>942889692</td></tr><tr><td>2026-03-09</td><td>689086</td><td>943578778</td></tr><tr><td>2026-03-10</td><td>800815</td><td>944379593</td></tr><tr><td>2026-03-11</td><td>562904</td><td>944942497</td></tr><tr><td>2026-03-12</td><td>128223</td><td>945070720</td></tr></tbody></table>

#### LINQ — Window Function `AVG()` Moving Average

Computes the average of a sliding window of N rows. Implemented via Skip/Take on a sorted list for each position.

```csharp
var W = 20;
var asml = ohlcv.Where(r => r.Symbol == "ASML.AS").OrderBy(r => r.Date).ToList();

var sma = Enumerable.Range(W - 1, asml.Count - W + 1)
    .Select(i => new { asml[i].Date, asml[i].Close,
        SMA20 = asml.Skip(i - W + 1).Take(W).Average(r => r.Close) });

var results = sma.TakeLast(10).ToList();
new DataFrame(
    Series.From("Date", results.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", results.Select(r => Math.Round(r.Close, 2)).ToArray()),
    Series.From("SMA20", results.Select(r => Math.Round(r.SMA20, 2)).ToArray()))
```

<!-- Polars DataFrame: (10 rows, 3 columns) --><table><thead><tr><th>Date</th><th>Close</th><th>SMA20</th></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>1213.73</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>1213.01</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>1211.58</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>1214.54</td></tr><tr><td>2026-03-05</td><td>1186</td><td>1216.36</td></tr><tr><td>2026-03-06</td><td>1147</td><td>1214.02</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1211.16</td></tr><tr><td>2026-03-10</td><td>1200</td><td>1211.51</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1211.06</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1211.61</td></tr></tbody></table>

#### LINQ — Window Function `NTILE()`

Distributes rows into N equal-sized buckets based on a sort order. Implemented via index arithmetic after OrderBy.

```csharp
var symbolCount = ohlcv.Select(r => r.Symbol).Distinct().Count();
var quartiles = ohlcv
    .GroupBy(r => r.Symbol)
    .Select(g => new { Symbol = g.Key, AvgClose = g.Average(r => r.Close) })
    .OrderBy(s => s.AvgClose)
    .Select((s, idx) => new { s.Symbol, s.AvgClose, Quartile = idx * 4 / symbolCount + 1 })
    .OrderByDescending(s => s.AvgClose);

var results = quartiles.Take(10).ToList();
new DataFrame(
    Series.From("Symbol", results.Select(s => s.Symbol).ToArray()),
    Series.From("AvgClose", results.Select(s => Math.Round(s.AvgClose, 2)).ToArray()),
    Series.From("Quartile", results.Select(s => s.Quartile).ToArray()))
```

<!-- Polars DataFrame: (10 rows, 3 columns) --><table><thead><tr><th>Symbol</th><th>AvgClose</th><th>Quartile</th></tr></thead><tbody><tr><td>RMS.PA</td><td>1761.56</td><td>4</td></tr><tr><td>ADYEN.AS</td><td>1545.98</td><td>4</td></tr><tr><td>ASML.AS</td><td>671.35</td><td>4</td></tr><tr><td>MC.PA</td><td>662.4</td><td>4</td></tr><tr><td>RHM.DE</td><td>544.66</td><td>4</td></tr><tr><td>ARGX.BR</td><td>413.69</td><td>4</td></tr><tr><td>OR.PA</td><td>377.54</td><td>4</td></tr><tr><td>MUV2.DE</td><td>374.66</td><td>4</td></tr><tr><td>RACE.MI</td><td>289.75</td><td>4</td></tr><tr><td>ALV.DE</td><td>252.19</td><td>4</td></tr></tbody></table>

#### LINQ — `HAVING`

Filters groups after aggregation. A Where clause applied after GroupBy + Select acts as the SQL HAVING clause.

```csharp
var highVol = ohlcv
    .GroupBy(r => r.Symbol)
    .Select(g => new { Symbol = g.Key, AvgVol = g.Average(r => (double)r.Volume) })
    .Where(s => s.AvgVol > 5_000_000)
    .OrderByDescending(s => s.AvgVol);

var results = highVol.ToList();
new DataFrame(
    Series.From("Symbol", results.Select(s => s.Symbol).ToArray()),
    Series.From("AvgVolume", results.Select(s => (long)s.AvgVol).ToArray()))
```

<!-- Polars DataFrame: (11 rows, 2 columns) --><table><thead><tr><th>Symbol</th><th>AvgVolume</th></tr></thead><tbody><tr><td>ISP.MI</td><td>87588601</td></tr><tr><td>SAN.MC</td><td>41770987</td></tr><tr><td>ENEL.MI</td><td>24678699</td></tr><tr><td>BBVA.MC</td><td>16654456</td></tr><tr><td>UCG.MI</td><td>13903710</td></tr><tr><td>ENI.MI</td><td>12976208</td></tr><tr><td>INGA.AS</td><td>12803589</td></tr><tr><td>IBE.MC</td><td>12034835</td></tr><tr><td>DTE.DE</td><td>7575084</td></tr><tr><td>NDA-FI.HE</td><td>5375454</td></tr><tr><td colspan='2'>... 1 more rows ...</td></tr></tbody></table>

#### LINQ — `STDEV()`

Standard deviation of daily returns, annualized by multiplying by sqrt(252). No built-in LINQ StdDev — computed manually.

```csharp
double StdDev(IEnumerable<double> v)
{
    var l = v.ToList(); var a = l.Average();
    return Math.Sqrt(l.Sum(x => (x - a) * (x - a)) / (l.Count - 1));
}

var vol = ohlcv.GroupBy(r => r.Symbol).Select(g =>
{
    var s = g.OrderBy(r => r.Date).ToList();
    var ret = s.Skip(1).Zip(s, (c, p) => (c.Close - p.Close) / p.Close).ToList();
    return new { Symbol = g.Key, AnnVol = StdDev(ret) * Math.Sqrt(252) * 100 };
}).OrderByDescending(s => s.AnnVol).Take(10);

var results = vol.ToList();
new DataFrame(
    Series.From("Symbol", results.Select(s => s.Symbol).ToArray()),
    Series.From("AnnualVol%", results.Select(s => Math.Round(s.AnnVol, 2)).ToArray()))
```

<!-- Polars DataFrame: (10 rows, 2 columns) --><table><thead><tr><th>Symbol</th><th>AnnualVol%</th></tr></thead><tbody><tr><td>ADYEN.AS</td><td>50.3</td></tr><tr><td>ENR.DE</td><td>50.05</td></tr><tr><td>RHM.DE</td><td>40.85</td></tr><tr><td>PRX.AS</td><td>39.72</td></tr><tr><td>ARGX.BR</td><td>39.31</td></tr><tr><td>ASML.AS</td><td>37.62</td></tr><tr><td>IFX.DE</td><td>37.25</td></tr><tr><td>UCG.MI</td><td>35.55</td></tr><tr><td>VOW.DE</td><td>35.51</td></tr><tr><td>ADS.DE</td><td>34.37</td></tr></tbody></table>

#### LINQ — `JOIN`

Combines two collections on a matching key. Each OHLCV aggregate row is paired with its corresponding score row by symbol.

```csharp
var joined = ohlcv
    .GroupBy(r => r.Symbol)
    .Select(g => new { Symbol = g.Key, AvgClose = g.Average(r => r.Close), AvgVol = g.Average(r => (double)r.Volume) })
    .Join(scores, o => o.Symbol, s => s.Symbol,
        (o, s) => new { o.Symbol, s.Sector, o.AvgClose, o.AvgVol, s.CompositeScore, s.CompositeRank, s.YtdChangePct })
    .OrderBy(r => r.CompositeRank)
    .Take(10);

var results = joined.ToList();
new DataFrame(
    Series.From("Symbol", results.Select(r => r.Symbol).ToArray()),
    Series.From("Sector", results.Select(r => r.Sector).ToArray()),
    Series.From("Rank", results.Select(r => (int)r.CompositeRank).ToArray()),
    Series.From("Score", results.Select(r => Math.Round(r.CompositeScore, 2)).ToArray()),
    Series.From("YTD%", results.Select(r => Math.Round(r.YtdChangePct, 1)).ToArray()),
    Series.From("AvgVol", results.Select(r => (long)r.AvgVol).ToArray()))
```

<!-- Polars DataFrame: (10 rows, 6 columns) --><table><thead><tr><th>Symbol</th><th>Sector</th><th>Rank</th><th>Score</th><th>YTD%</th><th>AvgVol</th></tr></thead><tbody><tr><td>BNP.PA</td><td>Financial Services</td><td>1</td><td>0.68</td><td>0.1</td><td>3096879</td></tr><tr><td>BNP.PA</td><td>Financial Services</td><td>1</td><td>0.66</td><td>0.1</td><td>3096879</td></tr><tr><td>BNP.PA</td><td>Financial Services</td><td>1</td><td>0.68</td><td>0.1</td><td>3096879</td></tr><tr><td>DTE.DE</td><td>Communication Services</td><td>2</td><td>0.52</td><td>0.2</td><td>7575084</td></tr><tr><td>DTE.DE</td><td>Communication Services</td><td>2</td><td>0.52</td><td>0.2</td><td>7575084</td></tr><tr><td>VOW.DE</td><td>Consumer Cyclical</td><td>2</td><td>0.58</td><td>-0.1</td><td>62021</td></tr><tr><td>DTE.DE</td><td>Communication Services</td><td>3</td><td>0.49</td><td>0.2</td><td>7575084</td></tr><tr><td>IFX.DE</td><td>Technology</td><td>3</td><td>0.51</td><td>0.2</td><td>4186778</td></tr><tr><td>VOW.DE</td><td>Consumer Cyclical</td><td>3</td><td>0.46</td><td>-0.1</td><td>62021</td></tr><tr><td>TTE.PA</td><td>Energy</td><td>4</td><td>0.39</td><td>0.3</td><td>5138099</td></tr></tbody></table>

#### LINQ — Window Function `LEAD()`

Accesses the value from the next row in a sorted sequence. Implemented via Zip with a Skip(1) shifted copy. Used here to detect date gaps.

```csharp
var gaps = ohlcv
    .Where(r => r.Symbol == "ASML.AS")
    .OrderBy(r => r.Date)
    .Zip(ohlcv.Where(r => r.Symbol == "ASML.AS").OrderBy(r => r.Date).Skip(1),
        (curr, next) => new { FromDate = curr.Date, ToDate = next.Date, GapDays = (next.Date - curr.Date).Days })
    .Where(g => g.GapDays > 3)
    .OrderByDescending(g => g.GapDays)
    .Take(10);

var results = gaps.ToList();
new DataFrame(
    Series.From("From", results.Select(g => g.FromDate.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("To", results.Select(g => g.ToDate.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("GapDays", results.Select(g => g.GapDays).ToArray()))
```

<!-- Polars DataFrame: (10 rows, 3 columns) --><table><thead><tr><th>From</th><th>To</th><th>GapDays</th></tr></thead><tbody><tr><td>2021-04-01</td><td>2021-04-06</td><td>5</td></tr><tr><td>2022-04-14</td><td>2022-04-19</td><td>5</td></tr><tr><td>2023-04-06</td><td>2023-04-11</td><td>5</td></tr><tr><td>2023-12-22</td><td>2023-12-27</td><td>5</td></tr><tr><td>2024-03-28</td><td>2024-04-02</td><td>5</td></tr><tr><td>2025-04-17</td><td>2025-04-22</td><td>5</td></tr><tr><td>2025-12-24</td><td>2025-12-29</td><td>5</td></tr><tr><td>2022-12-23</td><td>2022-12-27</td><td>4</td></tr><tr><td>2023-04-28</td><td>2023-05-02</td><td>4</td></tr><tr><td>2023-12-29</td><td>2024-01-02</td><td>4</td></tr></tbody></table>

#### LINQ — Nested `GroupBy`

Groups by a key and computes nested aggregates including the best element per group via OrderBy + First().

```csharp
var sectorSummary = scores
    .GroupBy(s => s.Sector)
    .Select(g => new
    {
        Sector = g.Key,
        AvgScore = g.Average(s => s.CompositeScore),
        BestStock = g.OrderBy(s => s.CompositeRank).First().Symbol,
        BestRank = g.Min(s => s.CompositeRank),
        Count = g.Count(),
    })
    .OrderByDescending(s => s.AvgScore);

var results = sectorSummary.ToList();
new DataFrame(
    Series.From("Sector", results.Select(s => s.Sector).ToArray()),
    Series.From("AvgScore", results.Select(s => Math.Round(s.AvgScore, 2)).ToArray()),
    Series.From("BestStock", results.Select(s => s.BestStock).ToArray()),
    Series.From("BestRank", results.Select(s => (int)s.BestRank).ToArray()),
    Series.From("Count", results.Select(s => s.Count).ToArray()))
```

<!-- Polars DataFrame: (10 rows, 5 columns) --><table><thead><tr><th>Sector</th><th>AvgScore</th><th>BestStock</th><th>BestRank</th><th>Count</th></tr></thead><tbody><tr><td>Technology</td><td>0.15</td><td>MU</td><td>1</td><td>75</td></tr><tr><td>Energy</td><td>0.11</td><td>DVN</td><td>1</td><td>34</td></tr><tr><td>Industrials</td><td>0.09</td><td>8001.T</td><td>1</td><td>66</td></tr><tr><td>Communication Services</td><td>0.05</td><td>DTE.DE</td><td>2</td><td>36</td></tr><tr><td>Basic Materials</td><td>0.04</td><td>4063.T</td><td>7</td><td>18</td></tr><tr><td>Healthcare</td><td>0.02</td><td>2269.HK</td><td>5</td><td>45</td></tr><tr><td>Consumer Defensive</td><td>-0.08</td><td>ABI.BR</td><td>4</td><td>36</td></tr><tr><td>Financial Services</td><td>-0.09</td><td>BNP.PA</td><td>1</td><td>96</td></tr><tr><td>Utilities</td><td>-0.1</td><td>ENEL.MI</td><td>25</td><td>6</td></tr><tr><td>Consumer Cyclical</td><td>-0.14</td><td>VOW.DE</td><td>2</td><td>54</td></tr></tbody></table>

## LINQ vs Polars.NET — Side-by-Side

Every operation shown first in LINQ (C# collections), then in Polars.NET (Rust DataFrame engine).
Both operate on the same OHLCV data loaded from SQL Server.

#### Load data into Polars DataFrame

Polars.NET reads Parquet files directly into a columnar DataFrame backed by the Rust Polars engine — same data as the Dapper-loaded OHLCV list, but in a format optimized for vectorized operations.

```csharp
var df = DataFrame.ReadParquet(@"C:\Users\aperi\DEV\LANG\data\eurostoxx50_ohlcv.parquet");
Console.WriteLine($"  Polars: {df.Height} rows x {df.Width} columns");
df.Head(3)
```

```text
66355 rows x 12 columns
```

<!-- Polars DataFrame: (3 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0</td><td>0</td><td>false</td></tr></tbody></table>

### Basic Operations

#### LINQ — Select columns

```csharp
var linqSelect = ohlcv.Select(r => new { r.Symbol, r.Date, r.Close }).Take(5).ToList();
new DataFrame(
    Series.From("Symbol", linqSelect.Select(r => r.Symbol).ToArray()),
    Series.From("Date", linqSelect.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", linqSelect.Select(r => r.Close).ToArray()))
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>Symbol</th><th>Date</th><th>Close</th></tr></thead><tbody><tr><td>ASML.AS</td><td>2021-01-04</td><td>406.25</td></tr><tr><td>ASML.AS</td><td>2021-01-05</td><td>406.9</td></tr><tr><td>ASML.AS</td><td>2021-01-06</td><td>402.85</td></tr><tr><td>ASML.AS</td><td>2021-01-07</td><td>403.9</td></tr><tr><td>ASML.AS</td><td>2021-01-08</td><td>416.05</td></tr></tbody></table>

#### Polars DataFrame — Select columns

```csharp
df.Select("symbol", "date", "close").Head(5)
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td></tr></tbody></table>

#### LINQ — Filter rows

```csharp
var linqFilter = ohlcv.Where(r => r.Symbol == "ASML.AS" && r.Close > 600).Take(5).ToList();
new DataFrame(
    Series.From("Symbol", linqFilter.Select(r => r.Symbol).ToArray()),
    Series.From("Date", linqFilter.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", linqFilter.Select(r => r.Close).ToArray()))
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>Symbol</th><th>Date</th><th>Close</th></tr></thead><tbody><tr><td>ASML.AS</td><td>2021-07-14</td><td>609.1</td></tr><tr><td>ASML.AS</td><td>2021-07-22</td><td>620.8</td></tr><tr><td>ASML.AS</td><td>2021-07-23</td><td>638.8</td></tr><tr><td>ASML.AS</td><td>2021-07-26</td><td>638</td></tr><tr><td>ASML.AS</td><td>2021-07-27</td><td>623</td></tr></tbody></table>

#### Polars DataFrame — Filter rows

```csharp
df.Filter((Col("symbol") == Lit("ASML.AS")) & (Col("close") > Lit(600.0)))
  .Select("symbol", "date", "close").Head(5)
```

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>136</td><td>ASML.AS</td><td>2021-07-14</td><td>599.5</td><td>611.8</td><td>597.2</td><td>609.1</td><td>582.9708</td><td>641585</td><td>0</td><td>0</td><td>false</td></tr><tr><td>142</td><td>ASML.AS</td><td>2021-07-22</td><td>610</td><td>625.9</td><td>608.2</td><td>620.8</td><td>594.169</td><td>788099</td><td>0</td><td>0</td><td>false</td></tr><tr><td>143</td><td>ASML.AS</td><td>2021-07-23</td><td>622.9</td><td>639</td><td>617.5</td><td>638.8</td><td>611.3967</td><td>833737</td><td>0</td><td>0</td><td>false</td></tr><tr><td>144</td><td>ASML.AS</td><td>2021-07-26</td><td>635.2</td><td>647</td><td>631.5</td><td>638</td><td>610.631</td><td>640691</td><td>0</td><td>0</td><td>false</td></tr><tr><td>145</td><td>ASML.AS</td><td>2021-07-27</td><td>634.2</td><td>641.1</td><td>622.3</td><td>623</td><td>596.2745</td><td>705560</td><td>0</td><td>0</td><td>false</td></tr></tbody></table>

#### LINQ — Sort

```csharp
var linqSort = ohlcv.OrderByDescending(r => r.Volume).Take(5).ToList();
new DataFrame(
    Series.From("Symbol", linqSort.Select(r => r.Symbol).ToArray()),
    Series.From("Date", linqSort.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Volume", linqSort.Select(r => r.Volume).ToArray()))
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>Symbol</th><th>Date</th><th>Volume</th></tr></thead><tbody><tr><td>ISP.MI</td><td>2023-08-08</td><td>376391539</td></tr><tr><td>SAN.MC</td><td>2021-10-20</td><td>367211467</td></tr><tr><td>ISP.MI</td><td>2023-05-31</td><td>317362978</td></tr><tr><td>ISP.MI</td><td>2023-03-13</td><td>311886033</td></tr><tr><td>SAN.MC</td><td>2021-11-03</td><td>306973344</td></tr></tbody></table>

#### Polars DataFrame — Sort

```csharp
df.Sort("volume", descending: true).Head(5)
```

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>31078</td><td>ISP.MI</td><td>2023-08-08</td><td>2.4</td><td>2.4165</td><td>2.3285</td><td>2.338</td><td>1.8961</td><td>376391539</td><td>0</td><td>0</td><td>false</td></tr><tr><td>10783</td><td>SAN.MC</td><td>2021-10-20</td><td>3.36</td><td>3.376</td><td>3.322</td><td>3.36</td><td>2.8379</td><td>367211467</td><td>0</td><td>0</td><td>false</td></tr><tr><td>31029</td><td>ISP.MI</td><td>2023-05-31</td><td>2.1925</td><td>2.2255</td><td>2.133</td><td>2.1555</td><td>1.7481</td><td>317362978</td><td>0</td><td>0</td><td>false</td></tr><tr><td>30975</td><td>ISP.MI</td><td>2023-03-13</td><td>2.4705</td><td>2.478</td><td>2.279</td><td>2.3305</td><td>1.8196</td><td>311886033</td><td>0</td><td>0</td><td>false</td></tr><tr><td>10793</td><td>SAN.MC</td><td>2021-11-03</td><td>3.275</td><td>3.31</td><td>3.236</td><td>3.31</td><td>2.8377</td><td>306973344</td><td>0</td><td>0</td><td>false</td></tr></tbody></table>

#### LINQ — Add computed column

```csharp
var linqComputed = ohlcv.Take(5).Select(r => new { r.Symbol, r.Date, r.Close, Range = r.High - r.Low }).ToList();
new DataFrame(
    Series.From("Symbol", linqComputed.Select(r => r.Symbol).ToArray()),
    Series.From("Close", linqComputed.Select(r => r.Close).ToArray()),
    Series.From("Range", linqComputed.Select(r => Math.Round(r.Range, 2)).ToArray()))
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>Symbol</th><th>Close</th><th>Range</th></tr></thead><tbody><tr><td>ASML.AS</td><td>406.25</td><td>8.75</td></tr><tr><td>ASML.AS</td><td>406.9</td><td>10.9</td></tr><tr><td>ASML.AS</td><td>402.85</td><td>8</td></tr><tr><td>ASML.AS</td><td>403.9</td><td>7.45</td></tr><tr><td>ASML.AS</td><td>416.05</td><td>5.7</td></tr></tbody></table>

#### Polars DataFrame — Add computed column

```csharp
df.WithColumns((Col("high") - Col("low")).Alias("range")).Select("symbol", "close", "range").Head(5)
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>symbol</th><th>close</th><th>range</th></tr></thead><tbody><tr><td>ABI.BR</td><td>57.21</td><td>2.07</td></tr><tr><td>ABI.BR</td><td>57.18</td><td>1.23</td></tr><tr><td>ABI.BR</td><td>58.77</td><td>1.55</td></tr><tr><td>ABI.BR</td><td>58.4</td><td>0.98</td></tr><tr><td>ABI.BR</td><td>57.86</td><td>0.97</td></tr></tbody></table>

### Aggregations

#### LINQ — GroupBy with aggregates

```csharp
var linqAgg = ohlcv.GroupBy(r => r.Symbol)
    .Select(g => new { Symbol = g.Key, AvgClose = Math.Round(g.Average(r => r.Close), 2), Count = g.Count() })
    .OrderByDescending(s => s.AvgClose).Take(5).ToList();
new DataFrame(
    Series.From("Symbol", linqAgg.Select(s => s.Symbol).ToArray()),
    Series.From("AvgClose", linqAgg.Select(s => s.AvgClose).ToArray()),
    Series.From("Count", linqAgg.Select(s => s.Count).ToArray()))
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>Symbol</th><th>AvgClose</th><th>Count</th></tr></thead><tbody><tr><td>RMS.PA</td><td>1761.56</td><td>1331</td></tr><tr><td>ADYEN.AS</td><td>1545.98</td><td>1331</td></tr><tr><td>ASML.AS</td><td>671.35</td><td>1331</td></tr><tr><td>MC.PA</td><td>662.4</td><td>1331</td></tr><tr><td>RHM.DE</td><td>544.66</td><td>1324</td></tr></tbody></table>

#### Polars DataFrame — GroupBy with aggregates

```csharp
df.GroupBy("symbol").Agg(
    Col("close").Mean().Alias("avg_close"),
    Col("close").Count().Alias("count")
).Sort("avg_close", descending: true).Head(5)
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>symbol</th><th>avg_close</th><th>count</th></tr></thead><tbody><tr><td>RMS.PA</td><td>1761.555748</td><td>1331</td></tr><tr><td>ADYEN.AS</td><td>1545.976409</td><td>1331</td></tr><tr><td>ASML.AS</td><td>671.3489106</td><td>1331</td></tr><tr><td>MC.PA</td><td>662.4045079</td><td>1331</td></tr><tr><td>RHM.DE</td><td>544.6615332</td><td>1324</td></tr></tbody></table>

#### LINQ — HAVING

```csharp
var linqHaving = ohlcv.GroupBy(r => r.Symbol)
    .Select(g => new { Symbol = g.Key, AvgVol = g.Average(r => (double)r.Volume) })
    .Where(s => s.AvgVol > 5_000_000)
    .OrderByDescending(s => s.AvgVol).ToList();
new DataFrame(
    Series.From("Symbol", linqHaving.Select(s => s.Symbol).ToArray()),
    Series.From("AvgVol", linqHaving.Select(s => (long)s.AvgVol).ToArray()))
```

<!-- Polars DataFrame: (11 rows, 2 columns) --><table><thead><tr><th>Symbol</th><th>AvgVol</th></tr></thead><tbody><tr><td>ISP.MI</td><td>87588601</td></tr><tr><td>SAN.MC</td><td>41770987</td></tr><tr><td>ENEL.MI</td><td>24678699</td></tr><tr><td>BBVA.MC</td><td>16654456</td></tr><tr><td>UCG.MI</td><td>13903710</td></tr><tr><td>ENI.MI</td><td>12976208</td></tr><tr><td>INGA.AS</td><td>12803589</td></tr><tr><td>IBE.MC</td><td>12034835</td></tr><tr><td>DTE.DE</td><td>7575084</td></tr><tr><td>NDA-FI.HE</td><td>5375454</td></tr><tr><td colspan='2'>... 1 more rows ...</td></tr></tbody></table>

#### Polars DataFrame — HAVING

```csharp
df.GroupBy("symbol").Agg(
    Col("volume").Mean().Alias("avg_vol")
).Filter(Col("avg_vol") > Lit(5_000_000.0)).Sort("avg_vol", descending: true)
```

<!-- Polars DataFrame: (11 rows, 2 columns) --><table><thead><tr><th>symbol</th><th>avg_vol</th></tr></thead><tbody><tr><td>ISP.MI</td><td>87588601.04</td></tr><tr><td>SAN.MC</td><td>41770987.15</td></tr><tr><td>ENEL.MI</td><td>24678699.42</td></tr><tr><td>BBVA.MC</td><td>16654456.88</td></tr><tr><td>UCG.MI</td><td>13903710.14</td></tr><tr><td>ENI.MI</td><td>12976208.15</td></tr><tr><td>INGA.AS</td><td>12803589.45</td></tr><tr><td>IBE.MC</td><td>12034835.18</td></tr><tr><td>DTE.DE</td><td>7575084.131</td></tr><tr><td>NDA-FI.HE</td><td>5375454.051</td></tr><tr><td colspan='2'>... 1 more rows ...</td></tr></tbody></table>

### Window Functions

#### LINQ — LAG

```csharp
var asmlLinq = ohlcv.Where(r => r.Symbol == "ASML.AS").OrderBy(r => r.Date).ToList();
var linqLag = asmlLinq.Skip(1).Zip(asmlLinq, (curr, prev) => new
    { curr.Date, curr.Close, PrevClose = prev.Close,
      Return = Math.Round((curr.Close - prev.Close) / prev.Close * 100, 2) })
    .TakeLast(5).ToList();
new DataFrame(
    Series.From("Date", linqLag.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", linqLag.Select(r => r.Close).ToArray()),
    Series.From("PrevClose", linqLag.Select(r => r.PrevClose).ToArray()),
    Series.From("Return%", linqLag.Select(r => r.Return).ToArray()))
```

<!-- Polars DataFrame: (5 rows, 4 columns) --><table><thead><tr><th>Date</th><th>Close</th><th>PrevClose</th><th>Return%</th></tr></thead><tbody><tr><td>2026-03-06</td><td>1147</td><td>1186</td><td>-3.29</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1147</td><td>0.05</td></tr><tr><td>2026-03-10</td><td>1200</td><td>1147.6</td><td>4.57</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1200</td><td>-0.1</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1198.8</td><td>-0.67</td></tr></tbody></table>

#### Polars DataFrame — LAG

```csharp
df.Filter(Col("symbol") == Lit("ASML.AS"))
  .Sort("date")
  .WithColumns(Col("close").Shift(1).Over("symbol").Alias("prev_close"))
  .WithColumns(((Col("close") - Col("prev_close")) / Col("prev_close") * Lit(100.0)).Alias("return_pct"))
  .Select("date", "close", "prev_close", "return_pct")
  .Tail(5)
```

<!-- Polars DataFrame: (5 rows, 4 columns) --><table><thead><tr><th>date</th><th>close</th><th>prev_close</th><th>return_pct</th></tr></thead><tbody><tr><td>2026-03-06</td><td>1147</td><td>1186</td><td>-3.28836425</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1147</td><td>0.05231037489</td></tr><tr><td>2026-03-10</td><td>1200</td><td>1147.6</td><td>4.566050889</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1200</td><td>-0.1</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1198.8</td><td>-0.6673340007</td></tr></tbody></table>

#### LINQ — Cumulative SUM

```csharp
var linqCum = ohlcv.Where(r => r.Symbol == "ASML.AS").OrderBy(r => r.Date)
    .Aggregate(new List<(string D, long V, long C)>(),
        (acc, r) => { acc.Add((r.Date.ToString("yyyy-MM-dd"), r.Volume,
            (acc.Count > 0 ? acc[^1].C : 0) + r.Volume)); return acc; })
    .TakeLast(5).ToList();
new DataFrame(
    Series.From("Date", linqCum.Select(r => r.D).ToArray()),
    Series.From("Volume", linqCum.Select(r => r.V).ToArray()),
    Series.From("CumVol", linqCum.Select(r => r.C).ToArray()))
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>Date</th><th>Volume</th><th>CumVol</th></tr></thead><tbody><tr><td>2026-03-06</td><td>857271</td><td>942889692</td></tr><tr><td>2026-03-09</td><td>689086</td><td>943578778</td></tr><tr><td>2026-03-10</td><td>800815</td><td>944379593</td></tr><tr><td>2026-03-11</td><td>562904</td><td>944942497</td></tr><tr><td>2026-03-12</td><td>128223</td><td>945070720</td></tr></tbody></table>

#### Polars DataFrame — Cumulative SUM

```csharp
df.Filter(Col("symbol") == Lit("ASML.AS"))
  .Sort("date")
  .WithColumns(Col("volume").CumSum().Over("symbol").Alias("cum_vol"))
  .Select("date", "volume", "cum_vol")
  .Tail(5)
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>date</th><th>volume</th><th>cum_vol</th></tr></thead><tbody><tr><td>2026-03-06</td><td>857271</td><td>942889692</td></tr><tr><td>2026-03-09</td><td>689086</td><td>943578778</td></tr><tr><td>2026-03-10</td><td>800815</td><td>944379593</td></tr><tr><td>2026-03-11</td><td>562904</td><td>944942497</td></tr><tr><td>2026-03-12</td><td>128223</td><td>945070720</td></tr></tbody></table>

#### LINQ — Rolling average

```csharp
var W = 20;
var asmlSorted = ohlcv.Where(r => r.Symbol == "ASML.AS").OrderBy(r => r.Date).ToList();
var linqSma = Enumerable.Range(W - 1, asmlSorted.Count - W + 1)
    .Select(i => new { asmlSorted[i].Date, asmlSorted[i].Close,
        SMA = Math.Round(asmlSorted.Skip(i - W + 1).Take(W).Average(r => r.Close), 2) })
    .TakeLast(5).ToList();
new DataFrame(
    Series.From("Date", linqSma.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", linqSma.Select(r => r.Close).ToArray()),
    Series.From("SMA20", linqSma.Select(r => r.SMA).ToArray()))
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>Date</th><th>Close</th><th>SMA20</th></tr></thead><tbody><tr><td>2026-03-06</td><td>1147</td><td>1214.02</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1211.16</td></tr><tr><td>2026-03-10</td><td>1200</td><td>1211.51</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1211.06</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1211.61</td></tr></tbody></table>

#### Polars DataFrame — Rolling average

```csharp
df.Filter(Col("symbol") == Lit("ASML.AS"))
  .Sort("date")
  .WithColumns(Col("close").RollingMean("20i").Over("symbol").Alias("sma_20"))
  .Select("date", "close", "sma_20")
  .Tail(5)
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>date</th><th>close</th><th>sma_20</th></tr></thead><tbody><tr><td>2026-03-06</td><td>1147</td><td>1214.02</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1211.16</td></tr><tr><td>2026-03-10</td><td>1200</td><td>1211.51</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1211.06</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1211.61</td></tr></tbody></table>

#### LINQ — ROW_NUMBER / Rank

```csharp
var linqRank = ohlcv.GroupBy(r => r.Symbol)
    .SelectMany(g => g.OrderByDescending(r => r.Volume)
        .Select((r, i) => new { r.Symbol, r.Date, r.Volume, Rank = i + 1 })
        .Where(r => r.Rank <= 1))
    .OrderByDescending(r => r.Volume).Take(5).ToList();
new DataFrame(
    Series.From("Symbol", linqRank.Select(r => r.Symbol).ToArray()),
    Series.From("Date", linqRank.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Volume", linqRank.Select(r => r.Volume).ToArray()))
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>Symbol</th><th>Date</th><th>Volume</th></tr></thead><tbody><tr><td>ISP.MI</td><td>2023-08-08</td><td>376391539</td></tr><tr><td>SAN.MC</td><td>2021-10-20</td><td>367211467</td></tr><tr><td>BBVA.MC</td><td>2021-09-17</td><td>228528294</td></tr><tr><td>NDA-FI.HE</td><td>2022-09-16</td><td>140675854</td></tr><tr><td>PRX.AS</td><td>2021-08-17</td><td>114772834</td></tr></tbody></table>

#### Polars DataFrame — ROW_NUMBER / Rank

```csharp
df.WithColumns(Col("volume").Rank(descending: true).Over("symbol").Alias("vol_rank"))
  .Filter(Col("vol_rank") == Lit(1))
  .Sort("volume", descending: true)
  .Select("symbol", "date", "volume")
  .Head(5)
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>volume</th></tr></thead><tbody><tr><td>ISP.MI</td><td>2023-08-08</td><td>376391539</td></tr><tr><td>SAN.MC</td><td>2021-10-20</td><td>367211467</td></tr><tr><td>BBVA.MC</td><td>2021-09-17</td><td>228528294</td></tr><tr><td>NDA-FI.HE</td><td>2022-09-16</td><td>140675854</td></tr><tr><td>PRX.AS</td><td>2021-08-17</td><td>114772834</td></tr></tbody></table>

### Joins

#### LINQ — Inner Join

```csharp
var linqJoin = ohlcv.GroupBy(r => r.Symbol)
    .Select(g => new { Symbol = g.Key, AvgClose = Math.Round(g.Average(r => r.Close), 2) })
    .Join(scores, o => o.Symbol, s => s.Symbol,
        (o, s) => new { o.Symbol, o.AvgClose, s.Sector, Rank = (int)s.CompositeRank })
    .OrderBy(r => r.Rank).Take(5).ToList();
new DataFrame(
    Series.From("Symbol", linqJoin.Select(r => r.Symbol).ToArray()),
    Series.From("AvgClose", linqJoin.Select(r => r.AvgClose).ToArray()),
    Series.From("Sector", linqJoin.Select(r => r.Sector).ToArray()),
    Series.From("Rank", linqJoin.Select(r => r.Rank).ToArray()))
```

<!-- Polars DataFrame: (5 rows, 4 columns) --><table><thead><tr><th>Symbol</th><th>AvgClose</th><th>Sector</th><th>Rank</th></tr></thead><tbody><tr><td>BNP.PA</td><td>60.94</td><td>Financial Services</td><td>1</td></tr><tr><td>BNP.PA</td><td>60.94</td><td>Financial Services</td><td>1</td></tr><tr><td>BNP.PA</td><td>60.94</td><td>Financial Services</td><td>1</td></tr><tr><td>DTE.DE</td><td>22.43</td><td>Communication Services</td><td>2</td></tr><tr><td>DTE.DE</td><td>22.43</td><td>Communication Services</td><td>2</td></tr></tbody></table>

#### Polars DataFrame — Inner Join

```csharp
var dfAvg = df.GroupBy("symbol").Agg(Col("close").Mean().Alias("avg_close"));

var dfScores = new DataFrame(
    Series.From("symbol", scores.Select(s => s.Symbol).ToArray()),
    Series.From("sector", scores.Select(s => s.Sector).ToArray()),
    Series.From("composite_rank", scores.Select(s => (int)s.CompositeRank).ToArray()));

dfAvg.Join(dfScores, new[] { Col("symbol") }, new[] { Col("symbol") })
    .Select("symbol", "avg_close", "sector", "composite_rank")
    .Sort("composite_rank")
    .Head(5)
```

<!-- Polars DataFrame: (5 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>avg_close</th><th>sector</th><th>composite_rank</th></tr></thead><tbody><tr><td>BNP.PA</td><td>60.93771225</td><td>Financial Services</td><td>1</td></tr><tr><td>BNP.PA</td><td>60.93771225</td><td>Financial Services</td><td>1</td></tr><tr><td>BNP.PA</td><td>60.93771225</td><td>Financial Services</td><td>1</td></tr><tr><td>DTE.DE</td><td>22.43009743</td><td>Communication Services</td><td>2</td></tr><tr><td>DTE.DE</td><td>22.43009743</td><td>Communication Services</td><td>2</td></tr></tbody></table>

### CRUD-like Operations

#### LINQ — Add rows with Concat()

`Concat` appends one `IEnumerable` to another lazily — no copy, no allocation. It returns a new sequence that yields elements from both, equivalent to SQL `UNION ALL`.

```csharp
var newRows = new[] { new Ohlcv("TEST.XX", DateTime.Today, 100, 105, 95, 102, 102, 50000) };
var linqInsert = ohlcv.Concat(newRows).TakeLast(3).ToList();
Console.WriteLine($"  LINQ: {ohlcv.Count} + {newRows.Length} = {ohlcv.Count + newRows.Length} rows (Concat)");
new DataFrame(
    Series.From("Symbol", linqInsert.Select(r => r.Symbol).ToArray()),
    Series.From("Date", linqInsert.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", linqInsert.Select(r => r.Close).ToArray()),
    Series.From("Volume", linqInsert.Select(r => r.Volume).ToArray()))
```

```text
66355 + 1 = 66356 rows (Concat)
```

<!-- Polars DataFrame: (3 rows, 4 columns) --><table><thead><tr><th>Symbol</th><th>Date</th><th>Close</th><th>Volume</th></tr></thead><tbody><tr><td>WKL.AS</td><td>2026-03-12</td><td>67.32</td><td>210379</td></tr><tr><td>DSY.PA</td><td>2026-03-12</td><td>18.37</td><td>434417</td></tr><tr><td>TEST.XX</td><td>2026-03-28</td><td>102</td><td>50000</td></tr></tbody></table>

#### Polars DataFrame — Add rows with VStack()

`VStack` vertically stacks two DataFrames (appends rows). Both must have identical column names and types. Equivalent to SQL `UNION ALL`.

```csharp
var newDf = new DataFrame(
    Series.From("id", new[] { 0L }),
    Series.From("symbol", new[] { "TEST.XX" }),
    Series.From("date", new[] { DateOnly.FromDateTime(DateTime.Today) }),
    Series.From("open", new[] { 100.0 }),
    Series.From("high", new[] { 105.0 }),
    Series.From("low", new[] { 95.0 }),
    Series.From("close", new[] { 102.0 }),
    Series.From("adj_close", new[] { 102.0 }),
    Series.From("volume", new[] { 50000L }),
    Series.From("dividends", new[] { 0.0 }),
    Series.From("stock_splits", new[] { 0.0 }),
    Series.From("is_filled", new[] { false }));

var dfInserted = df.VStack(newDf);
Console.WriteLine($"  Polars: {df.Height} + {newDf.Height} = {dfInserted.Height} rows (VStack)");
dfInserted.Tail(3)
```

```text
66355 + 1 = 66356 rows (VStack)
```

<!-- Polars DataFrame: (3 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>66877</td><td>WKL.AS</td><td>2026-03-11</td><td>67.5</td><td>69.6</td><td>67.02</td><td>67.22</td><td>67.22</td><td>1142531</td><td>0</td><td>0</td><td>false</td></tr><tr><td>66929</td><td>WKL.AS</td><td>2026-03-12</td><td>67</td><td>67.54</td><td>66.28</td><td>67.32</td><td>67.32</td><td>210379</td><td>0</td><td>0</td><td>false</td></tr><tr><td>0</td><td>TEST.XX</td><td>2026-03-28</td><td>100</td><td>105</td><td>95</td><td>102</td><td>102</td><td>50000</td><td>0</td><td>0</td><td>false</td></tr></tbody></table>

#### LINQ — Update column

LINQ doesn't mutate in place — `Select` projects each element into a new anonymous type with the modified property, leaving the original collection untouched.

```csharp
var linqUpdate = ohlcv.Where(r => r.Symbol == "ASML.AS").Take(5)
    .Select(r => new { r.Symbol, r.Date, AdjClose = r.Close * 1.05 }).ToList();
new DataFrame(
    Series.From("Symbol", linqUpdate.Select(r => r.Symbol).ToArray()),
    Series.From("Date", linqUpdate.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("AdjClose", linqUpdate.Select(r => Math.Round(r.AdjClose, 2)).ToArray()))
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>Symbol</th><th>Date</th><th>AdjClose</th></tr></thead><tbody><tr><td>ASML.AS</td><td>2021-01-04</td><td>426.56</td></tr><tr><td>ASML.AS</td><td>2021-01-05</td><td>427.24</td></tr><tr><td>ASML.AS</td><td>2021-01-06</td><td>422.99</td></tr><tr><td>ASML.AS</td><td>2021-01-07</td><td>424.1</td></tr><tr><td>ASML.AS</td><td>2021-01-08</td><td>436.85</td></tr></tbody></table>

#### Polars DataFrame — Update column

`WithColumns` replaces or creates a column by expression — Polars is also immutable, returning a new DataFrame rather than modifying the original.

```csharp
df.Filter(Col("symbol") == Lit("ASML.AS"))
  .WithColumns((Col("close") * Lit(1.05)).Alias("adj_close"))
  .Select("symbol", "date", "adj_close")
  .Head(5)
```

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>adj_close</th></tr></thead><tbody><tr><td>ASML.AS</td><td>2021-01-04</td><td>426.5625</td></tr><tr><td>ASML.AS</td><td>2021-01-05</td><td>427.245</td></tr><tr><td>ASML.AS</td><td>2021-01-06</td><td>422.9925</td></tr><tr><td>ASML.AS</td><td>2021-01-07</td><td>424.095</td></tr><tr><td>ASML.AS</td><td>2021-01-08</td><td>436.8525</td></tr></tbody></table>

#### LINQ — Delete rows

Deleting is the inverse of filtering — `Where` keeps non-matching rows, effectively excluding the "deleted" ones from the resulting sequence.

```csharp
var linqDelete = ohlcv.Where(r => r.Symbol != "ASML.AS");
Console.WriteLine($"  LINQ: {ohlcv.Count} - ASML rows = {linqDelete.Count()} remaining");
```

```text
66355 - ASML rows = 65024 remaining
```

#### Polars DataFrame — Delete rows

Same pattern — `Filter` with a negated condition returns a new DataFrame without the excluded rows.

```csharp
var dfFiltered = df.Filter(Col("symbol") != Lit("ASML.AS"));
Console.WriteLine($"  Polars: {df.Height} - ASML rows = {dfFiltered.Height} remaining");
```

```text
66355 - ASML rows = 65024 remaining
```

#### LINQ — Drop column

LINQ has no native `Drop` — project only the columns you want via `Select`, omitting the unwanted properties.

```csharp
var linqDrop = ohlcv.Take(3).Select(r => new
    { r.Symbol, r.Date, r.Open, r.High, r.Low, r.Close, r.AdjClose, r.Volume }).ToList();
new DataFrame(
    Series.From("Symbol", linqDrop.Select(r => r.Symbol).ToArray()),
    Series.From("Date", linqDrop.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Open", linqDrop.Select(r => r.Open).ToArray()),
    Series.From("High", linqDrop.Select(r => r.High).ToArray()),
    Series.From("Low", linqDrop.Select(r => r.Low).ToArray()),
    Series.From("Close", linqDrop.Select(r => r.Close).ToArray()),
    Series.From("AdjClose", linqDrop.Select(r => r.AdjClose).ToArray()),
    Series.From("Volume", linqDrop.Select(r => r.Volume).ToArray()))
```

<!-- Polars DataFrame: (3 rows, 8 columns) --><table><thead><tr><th>Symbol</th><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>AdjClose</th><th>Volume</th></tr></thead><tbody><tr><td>ASML.AS</td><td>2021-01-04</td><td>404</td><td>411</td><td>402.25</td><td>406.25</td><td>387.709</td><td>789502</td></tr><tr><td>ASML.AS</td><td>2021-01-05</td><td>406.55</td><td>412.05</td><td>401.15</td><td>406.9</td><td>388.3294</td><td>798787</td></tr><tr><td>ASML.AS</td><td>2021-01-06</td><td>406.8</td><td>407.2</td><td>399.2</td><td>402.85</td><td>384.4644</td><td>875711</td></tr></tbody></table>

#### Polars DataFrame — Drop column

Select all columns except the ones to remove — Polars doesn't have a `.Drop()` method, so you filter the column name list and pass it to `Select`.

```csharp
var dropCols = new HashSet<string> { "dividends", "stock_splits", "is_filled" };
var keepCols = df.Columns.Where(n => !dropCols.Contains(n)).ToArray();
df.Select(keepCols).Head(3)
```

<!-- Polars DataFrame: (3 rows, 9 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td></tr></tbody></table>

## Warnings

> [!warning] LINQ deferred execution — query re-executes on each enumeration
>
> A LINQ query like `var q = data.Where(x => x > 5)` is a description, not a result. Every `foreach`, `.Count()`, or `.ToList()` re-executes the full pipeline from scratch — including any side effects or database calls.

> [!success] Correct pattern
>
> Materialize early with `.ToList()` or `.ToArray()` when you need the results more than once: `var results = data.Where(x => x > 5).ToList();`.

> [!warning] Forgetting generic constraints causes compile errors
>
> Calling `item.CompareTo(other)` on an unconstrained `T` doesn't compile — the compiler doesn't know `T` has that method.

> [!success] Correct pattern
>
> Add the constraint: `where T : IComparable<T>`. Only add constraints you actually use — over-constraining reduces reusability.

> [!warning] `GroupBy` returns `IGrouping`, not a dictionary
>
> The result of `GroupBy` is a lazy sequence of `IGrouping<TKey, TElement>`. Accessing `.Key` gives the group key; enumerating gives the group's elements. It's not a `Dictionary`.

> [!success] Correct pattern
>
> To get a dictionary, chain `.ToDictionary(g => g.Key, g => g.ToList())`. To process groups lazily, iterate the `IGrouping` directly.

> [!warning] `Aggregate` throws on empty sequences
>
> The seedless overload `data.Aggregate((a, b) => a + b)` throws `InvalidOperationException` if the source is empty.

> [!success] Correct pattern
>
> Use the seeded overload: `data.Aggregate(0, (acc, x) => acc + x)`. The seed serves as both the initial value and the return value for empty sequences.

> [!warning] Variance only applies to interfaces and delegates
>
> `class MyList<out T>` doesn't compile — covariance (`out`) and contravariance (`in`) only work on interface and delegate type parameters.

> [!success] Correct pattern
>
> Define variance on the interface: `interface IReadable<out T>`. The implementing class uses invariant `T`: `class Readable<T> : IReadable<T>`.

## Recommendations

- **Prefer method syntax for most LINQ** — it's more composable and the dominant style in production C#. Use query syntax for complex joins and `let` bindings.
- **Materialize LINQ results with `.ToList()`** when you need stable, reusable data — deferred execution re-evaluates on each enumeration.
- **Use generic constraints sparingly** — only add constraints you actually need. `where T : class` or `where T : IComparable<T>` should serve a purpose in the method body.
- **Use `IEnumerable<T>` as parameter types** — accept the broadest interface so callers can pass arrays, lists, LINQ queries, or any collection.
- **Use Dapper for SQL → LINQ pipelines** — Dapper maps SQL results directly to strongly typed records, then LINQ operates on the typed collection in memory.
- **Use Polars.NET for large analytical workloads** — when LINQ on in-memory collections isn't fast enough, Polars.NET brings columnar Rust-backed processing to C#.
- **Use `record` types for LINQ projections** — `record PriceRow(string Symbol, DateTime Date, double Close)` gives free equality, `ToString`, and deconstruction.
- **Use covariance (`out T`) on read-only interfaces** — enables `IEnumerable<Dog>` where `IEnumerable<Animal>` is expected, which is safe because you're only reading.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `CS0311: type 'X' cannot be used as type parameter 'T'` | `X` doesn't satisfy the generic constraint | Add the required interface to `X`, or relax the constraint |
| LINQ query returns different results on second enumeration | Deferred execution re-evaluates — source data changed between enumerations | Materialize with `.ToList()` after the first evaluation |
| `InvalidOperationException: Sequence contains no elements` | Called `First()`, `Single()`, or seedless `Aggregate()` on an empty sequence | Use `FirstOrDefault()`, `SingleOrDefault()`, or seeded `Aggregate(seed, func)` |
| `GroupBy` result is hard to work with | `IGrouping<K,V>` isn't a dictionary | Chain `.ToDictionary(g => g.Key, g => g.ToList())` to convert |
| `CS1061: 'T' does not contain a definition for 'X'` | Missing constraint — compiler doesn't know `T` has method `X` | Add `where T : IInterface` with the required method |
| Covariance/contravariance won't compile on class | Variance only works on interfaces and delegates | Move `out`/`in` to an interface definition |
| LINQ query is slow on large data | All data loaded in memory, no optimization | Consider Polars.NET for columnar processing, or push filtering into SQL |
| Polars.NET `DataFrame` column access throws | Column name mismatch or wrong type | Check column names with `df.Columns` and types with `df.Schema` |
| `Aggregate` produces wrong result | Seed value is wrong, or accumulator function has a bug | Verify seed and step through the accumulator logic manually |
| Query syntax `let` not available in method syntax | `let` is a query-syntax-only keyword | Use a `.Select()` to create an intermediate anonymous type |

