---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [generics, LINQ, type parameters, generic collections, comprehensions, functional programming]
keywords: [generics, LINQ, where, select, orderby, groupby, IEnumerable, IQueryable, type constraints, variance]
description: "C# generics and LINQ reference with executable examples and cell outputs — covers generic classes, constraints, LINQ query and method syntax, deferred execution, and functional patterns. See [[07_py_generics_linq]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[07_py_generics_linq]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 07. Generics & LINQ - C#

## Generics

#### Generic method

```csharp
// Generic method — one method works with any type T
// compiler infers T from the argument
T First<T>(T[] items) => items[0];

Console.WriteLine($"int:    {First(new[] { 1, 2, 3 })}");
Console.WriteLine($"string: {First(new[] { "a", "b", "c" })}");
Console.WriteLine($"double: {First(new[] { 1.1, 2.2, 3.3 })}");

// Explicit type argument (sometimes needed when inference is ambiguous)
Console.WriteLine($"explicit: {First<string>(new[] { "x", "y" })}");
```

    int:    1
    string: a
    double: 1.1
    explicit: x

<h4>Generic constraints — <code style="font-size:0.75em">where T : ...</code></h4>

```csharp
// Generic constraints restrict what types T can be — enforced at compile time
T Max<T>(T a, T b) where T : IComparable<T>
    => a.CompareTo(b) >= 0 ? a : b;

Console.WriteLine($"Max(3, 7):              {Max(3, 7)}");
Console.WriteLine($"Max(\"apple\", \"banana\"): {Max("apple", "banana")}");
// Max(new object(), new object());  // Compile error! object doesn't implement IComparable

// Common constraints reference
Console.WriteLine("\nwhere T : struct          — T must be a value type (int, bool, struct)");
Console.WriteLine("where T : class           — T must be a reference type (string, class)");
Console.WriteLine("where T : new()           — T must have a parameterless constructor");
Console.WriteLine("where T : IComparable<T>  — T must implement an interface");
Console.WriteLine("where T : BaseClass       — T must inherit from a specific class");
Console.WriteLine("where T : notnull         — T can't be null");
```

    Max(3, 7):              7
    Max("apple", "banana"): banana
    
    where T : struct          — T must be a value type (int, bool, struct)
    where T : class           — T must be a reference type (string, class)
    where T : new()           — T must have a parameterless constructor
    where T : IComparable<T>  — T must implement an interface
    where T : BaseClass       — T must inherit from a specific class
    where T : notnull         — T can't be null

<h4>Generic class and multiple type parameters</h4>

```csharp
// Generic class — List<T>, Dictionary<TKey, TValue> are built-in generic types
var ints = new List<int> { 1, 2, 3 };
var lookup = new Dictionary<string, int> { ["Alice"] = 85, ["Bob"] = 92 };
Console.WriteLine($"List<int>: [{string.Join(", ", ints)}]");
Console.WriteLine($"Dict:      {string.Join(", ", lookup.Select(kv => $"{kv.Key}: {kv.Value}"))}");

// Multiple type parameters — a generic method can take more than one type parameter
(TKey, TValue) MakePair<TKey, TValue>(TKey key, TValue value) => (key, value);

var pair1 = MakePair("name", 42);
var pair2 = MakePair(1, true);
Console.WriteLine($"pair1: {pair1}");
Console.WriteLine($"pair2: {pair2}");
```

    List<int>: [1, 2, 3]
    Dict:      Alice: 85, Bob: 92
    pair1: (name, 42)
    pair2: (1, True)

## Advanced LINQ

#### Sample data

```csharp
// Sample data used throughout the LINQ section
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

<h4><code style="font-size:0.75em">GroupBy</code> and aggregations</h4>

```csharp
// GroupBy — split into groups by key, then aggregate each group
var byDept = employees.GroupBy(e => e.Dept);

foreach (var group in byDept)
{
    var names = string.Join(", ", group.Select(e => e.Name));
    var avgSalary = group.Average(e => e.Salary);
    Console.WriteLine($"  {group.Key,-15} ({group.Count()} people): [{names}] avg=${avgSalary:N0}");
}

// Top earner per department
Console.WriteLine("\nMax salary per dept:");
foreach (var group in byDept)
{
    var top = group.MaxBy(e => e.Salary)!;
    Console.WriteLine($"  {group.Key,-15} top earner: {top.Name} ${top.Salary:N0}");
}

// Multiple aggregations per group
Console.WriteLine("\nMultiple aggregations:");
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

      Engineering     (3 people): [Alice, Charlie, Eve] avg=$97'667
      Sales           (2 people): [Bob, Diana] avg=$71'500
      Marketing       (1 people): [Frank] avg=$72'000
    
    Max salary per dept:
      Engineering     top earner: Charlie $110'000
      Sales           top earner: Diana $78'000
      Marketing       top earner: Frank $72'000
    
    Multiple aggregations:
      Engineering     count=3 avg=$97'667 range=[$88'000-$110'000] total=$293'000
      Sales           count=2 avg=$71'500 range=[$65'000-$78'000] total=$143'000
      Marketing       count=1 avg=$72'000 range=[$72'000-$72'000] total=$72'000

<h4><code style="font-size:0.75em">Join</code> and <code style="font-size:0.75em">GroupJoin</code></h4>

```csharp
// Inner Join — combine two collections by matching key
var innerJoin = employees.Join(
    departments,
    e => e.Dept,                                // key from employees
    d => d.Dept,                                // key from departments
    (e, d) => new { e.Name, e.Dept, d.Head, d.Budget }
);
Console.WriteLine("Inner Join:");
foreach (var r in innerJoin.Take(3))
    Console.WriteLine($"  {r.Name,-10} {r.Dept,-15} head={r.Head,-10} budget=${r.Budget:N0}");

// GroupJoin — left join (all departments, employees may be empty)
Console.WriteLine("\nLeft Join (GroupJoin):");
var leftJoin = departments.GroupJoin(
    employees,
    d => d.Dept,
    e => e.Dept,
    (d, emps) => new { d.Dept, d.Head, Count = emps.Count() }
);
foreach (var r in leftJoin)
    Console.WriteLine($"  {r.Dept,-15} head={r.Head,-10} employees={r.Count}");
```

    Inner Join:
      Alice      Engineering     head=CTO        budget=$500'000
      Bob        Sales           head=VP Sales   budget=$300'000
      Charlie    Engineering     head=CTO        budget=$500'000
    
    Left Join (GroupJoin):
      Engineering     head=CTO        employees=3
      Sales           head=VP Sales   employees=2
      Marketing       head=CMO        employees=1
      HR              head=CHRO       employees=0

<h4>Chained pipeline, <code style="font-size:0.75em">Lookup</code>, and <code style="font-size:0.75em">Zip</code></h4>

```csharp
// Chained pipeline — filter → transform → sort → take in one expression
var result = employees
    .Where(e => e.Salary > 75000)
    .Select(e => new { e.Name, e.Salary, Tax = e.Salary * 0.3 })
    .OrderByDescending(e => e.Salary)
    .Take(3);
Console.WriteLine("Top 3 earners (>75k) with tax:");
foreach (var r in result)
    Console.WriteLine($"  {r.Name,-10} salary=${r.Salary:N0}  tax=${r.Tax:N0}");

// Lookup — like Dictionary but allows multiple values per key
Console.WriteLine("\nLookup (multi-value dictionary):");
var empLookup = employees.ToLookup(e => e.Dept);
Console.WriteLine($"Engineering: [{string.Join(", ", empLookup["Engineering"].Select(e => e.Name))}]");
Console.WriteLine($"Unknown:     [{string.Join(", ", empLookup["Unknown"].Select(e => e.Name))}]");  // empty, no error

// Zip — pair elements from parallel sequences
Console.WriteLine("\nZip (parallel processing):");
var names = employees.Select(e => e.Name);
var salaries = employees.Select(e => e.Salary);
var raises = employees.Select(e => e.Salary * 0.1);

foreach (var (name, salary, raise_amt) in names.Zip(salaries, raises))
    Console.WriteLine($"  {name,-10} ${salary,8:N0} + ${raise_amt,7:N0} raise");
```

    Top 3 earners (>75k) with tax:
      Charlie    salary=$110'000  tax=$33'000
      Alice      salary=$95'000  tax=$28'500
      Eve        salary=$88'000  tax=$26'400
    
    Lookup (multi-value dictionary):
    Engineering: [Alice, Charlie, Eve]
    Unknown:     []
    
    Zip (parallel processing):
      Alice      $  95'000 + $  9'500 raise
      Bob        $  65'000 + $  6'500 raise
      Charlie    $ 110'000 + $ 11'000 raise
      Diana      $  78'000 + $  7'800 raise
      Eve        $  88'000 + $  8'800 raise
      Frank      $  72'000 + $  7'200 raise

<h4><code style="font-size:0.75em">SelectMany</code> — flatten nested collections</h4>

```csharp
// SelectMany — Select gives nested List<List<T>>; SelectMany flattens to List<T>
var people = new[]
{
    new { Name = "Alice", Skills = new[] { "C#", "LINQ", "SQL" } },
    new { Name = "Bob",   Skills = new[] { "Python", "SQL" } },
    new { Name = "Charlie", Skills = new[] { "C#", "Go" } },
};

// Select → nested (array per person)
Console.WriteLine("Select (nested):");
foreach (var arr in people.Select(p => p.Skills))
    Console.WriteLine($"  [{string.Join(", ", arr)}]");

// SelectMany → flat (one sequence)
var allSkills = people.SelectMany(p => p.Skills);
Console.WriteLine($"\nSelectMany (flat): [{string.Join(", ", allSkills)}]");

// With result selector — keeps access to the outer item
Console.WriteLine("\nSelectMany with result selector:");
var pairs = people.SelectMany(
    p => p.Skills,
    (p, skill) => $"{p.Name}: {skill}"
);
foreach (var pair in pairs)
    Console.WriteLine($"  {pair}");

// Flatten + distinct
Console.WriteLine($"\nDistinct skills: [{string.Join(", ", people.SelectMany(p => p.Skills).Distinct().OrderBy(s => s))}]");

// Flatten a List<List<int>>
var matrix = new List<List<int>>
{
    new List<int> { 1, 2, 3 },
    new List<int> { 4, 5 },
    new List<int> { 6, 7, 8, 9 },
};
Console.WriteLine($"Flat matrix: [{string.Join(", ", matrix.SelectMany(row => row))}]");
```

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

## LINQ vs Pandas — side-by-side comparison

#### Filter, Select, and pipeline

```csharp
// Filter, Select, and chained pipeline — LINQ equivalents of Pandas operations

// Filter — Where is like df[df["salary"] > 75000]
Console.WriteLine("Filter: salary > 75000");
var highEarners = employees.Where(e => e.Salary > 75000);
foreach (var e in highEarners)
    Console.WriteLine($"  {e.Name,-10} ${e.Salary:N0}");

// Multiple conditions
Console.WriteLine("\nEngineering >75k:");
var engHigh = employees.Where(e => e.Salary > 75000 && e.Dept == "Engineering");
foreach (var e in engHigh)
    Console.WriteLine($"  {e.Name,-10} ${e.Salary:N0}");

// Select — transform each element
Console.WriteLine("\nSelect: name + salary + computed tax");
var withTax = employees.Select(e => new { e.Name, e.Salary, Tax = e.Salary * 0.3 });
foreach (var r in withTax)
    Console.WriteLine($"  {r.Name,-10} salary=${r.Salary:N0}  tax=${r.Tax:N0}");

// Full pipeline — filter → transform → sort → take
Console.WriteLine("\nFull pipeline: Filter → Transform → Sort → Take");
var pipeline = employees
    .Where(e => e.Salary > 75000)
    .Select(e => new { e.Name, e.Salary, Tax = e.Salary * 0.3 })
    .OrderByDescending(e => e.Salary)
    .Take(3);
foreach (var r in pipeline)
    Console.WriteLine($"  {r.Name,-10} salary=${r.Salary:N0}  tax=${r.Tax:N0}");
```

    Filter: salary > 75000
      Alice      $95'000
      Charlie    $110'000
      Diana      $78'000
      Eve        $88'000
    
    Engineering >75k:
      Alice      $95'000
      Charlie    $110'000
      Eve        $88'000
    
    Select: name + salary + computed tax
      Alice      salary=$95'000  tax=$28'500
      Bob        salary=$65'000  tax=$19'500
      Charlie    salary=$110'000  tax=$33'000
      Diana      salary=$78'000  tax=$23'400
      Eve        salary=$88'000  tax=$26'400
      Frank      salary=$72'000  tax=$21'600
    
    Full pipeline: Filter → Transform → Sort → Take
      Charlie    salary=$110'000  tax=$33'000
      Alice      salary=$95'000  tax=$28'500
      Eve        salary=$88'000  tax=$26'400

#### LINQ vs Pandas cheat sheet

```csharp
// LINQ vs Pandas operation mapping
Console.WriteLine(@"
Operation         LINQ (C#)                          Pandas (Python)
────────────────  ─────────────────────────────────  ─────────────────────────────
Filter            .Where(e => e.Salary > 75000)      df[df['salary'] > 75000]
Select columns    .Select(e => new { e.Name })       df[['name']]
Add column        .Select(e => new { ..., Tax=... }) df.assign(tax=...)
Sort asc          .OrderBy(e => e.Salary)            df.sort_values('salary')
Sort desc         .OrderByDescending(...)            df.sort_values(..., ascending=False)
GroupBy           .GroupBy(e => e.Dept)              df.groupby('dept')
Aggregate         .Sum() .Average() .Max()           .sum() .mean() .max()
Inner join        .Join(other, ...)                  pd.merge(df1, df2, on='key')
Left join         .GroupJoin(...)                    pd.merge(..., how='left')
Take N            .Take(3)                           df.head(3)
Count             .Count()                           len(df)
Distinct          .Distinct()                        df.drop_duplicates()
Flatten           .SelectMany(...)                   df.explode('col')
");

// Key differences
Console.WriteLine("LINQ:   works on ANY collection (List, Array, Dict, custom IEnumerable)");
Console.WriteLine("Pandas: works on DataFrames only (tabular data)");
Console.WriteLine("LINQ:   lazy by default (nothing runs until you iterate)");
Console.WriteLine("Pandas: eager (executes immediately, returns new DataFrame)");
Console.WriteLine("LINQ:   type-safe (compiler checks at compile time)");
Console.WriteLine("Pandas: string-based (column names are strings, typos = runtime errors)");
```

    
    Operation         LINQ (C#)                          Pandas (Python)
    ────────────────  ─────────────────────────────────  ─────────────────────────────
    Filter            .Where(e => e.Salary > 75000)      df[df['salary'] > 75000]
    Select columns    .Select(e => new { e.Name })       df[['name']]
    Add column        .Select(e => new { ..., Tax=... }) df.assign(tax=...)
    Sort asc          .OrderBy(e => e.Salary)            df.sort_values('salary')
    Sort desc         .OrderByDescending(...)            df.sort_values(..., ascending=False)
    GroupBy           .GroupBy(e => e.Dept)              df.groupby('dept')
    Aggregate         .Sum() .Average() .Max()           .sum() .mean() .max()
    Inner join        .Join(other, ...)                  pd.merge(df1, df2, on='key')
    Left join         .GroupJoin(...)                    pd.merge(..., how='left')
    Take N            .Take(3)                           df.head(3)
    Count             .Count()                           len(df)
    Distinct          .Distinct()                        df.drop_duplicates()
    Flatten           .SelectMany(...)                   df.explode('col')
    
    LINQ:   works on ANY collection (List, Array, Dict, custom IEnumerable)
    Pandas: works on DataFrames only (tabular data)
    LINQ:   lazy by default (nothing runs until you iterate)
    Pandas: eager (executes immediately, returns new DataFrame)
    LINQ:   type-safe (compiler checks at compile time)
    Pandas: string-based (column names are strings, typos = runtime errors)
