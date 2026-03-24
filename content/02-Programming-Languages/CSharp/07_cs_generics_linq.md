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

## 1. Generics (Type Parameterization)


```csharp
// Generics — writing code that works with ANY type, enforced at compile time
//
// KEY CONCEPTS:
// - Generic: code parameterized by type <T>. Instead of writing separate methods
//   for int, string, double — write ONE that works with any type T.
// - Type parameter <T>: placeholder for a type, specified when you use the class/method.
//   List<int>, Dictionary<string, int>.
// - Constraints (where T : ...): restrict what types T can be (must be class, must have
//   constructor, must implement interface). Python has no equivalent enforcement.
// - Generic method: a single method with <T> that works with any type.
// - Generic class: a class with <T> (List<T>, Stack<T>, Dictionary<TKey, TValue>).
// - Python has duck typing — doesn't need generics for correctness. C# REQUIRES them.
//   In Python, generics are optional hints. In C#, they're enforced by the compiler.

// === Generic method ===
Console.WriteLine("=== Generic Method ===");

// Without generics — must write separate methods for each type:
// int FirstInt(int[] items) => items[0];
// string FirstString(string[] items) => items[0];
// double FirstDouble(double[] items) => items[0];

// With generics — ONE method for all types:
T First<T>(T[] items) => items[0];

Console.WriteLine($"int:    {First(new[] { 1, 2, 3 })}");
Console.WriteLine($"string: {First(new[] { "a", "b", "c" })}");
Console.WriteLine($"double: {First(new[] { 1.1, 2.2, 3.3 })}");
// Compiler infers T from the argument type — no need to specify <int> explicitly

// Explicit type argument (sometimes needed):
Console.WriteLine($"explicit: {First<string>(new[] { "x", "y" })}");

// === Generic constraints (where T : ...) ===
Console.WriteLine("\n=== Generic Constraints ===");

// where T : IComparable<T> — T must be comparable (sortable)
T Max<T>(T a, T b) where T : IComparable<T>
    => a.CompareTo(b) >= 0 ? a : b; // expression-bodied method, => replaces { return ... }

Console.WriteLine($"Max(3, 7):       {Max(3, 7)}");
Console.WriteLine($"Max(\"apple\", \"banana\"): {Max("apple", "banana")}");
// Max(new object(), new object());  // Compile error! object doesn't implement IComparable

// Common constraints:
Console.WriteLine("\n=== Constraint Reference ===");
Console.WriteLine("where T : struct          — T must be a value type (int, bool, struct)");
Console.WriteLine("where T : class           — T must be a reference type (string, class)");
Console.WriteLine("where T : new()           — T must have a parameterless constructor");
Console.WriteLine("where T : IComparable<T>  — T must implement an interface");
Console.WriteLine("where T : BaseClass       — T must inherit from a specific class");
Console.WriteLine("where T : notnull         — T can't be null");

// === Generic class ===
Console.WriteLine("\n=== Generic Class ===");

var ints = new List<int> { 1, 2, 3 };                // List<T> where T = int
var lookup = new Dictionary<string, int>             // Dictionary<TKey, TValue>
{
    ["Alice"] = 85, 
    ["Bob"] = 92
};
Console.WriteLine($"List<int>: [{string.Join(", ", ints)}]");
Console.WriteLine($"Dict:      {string.Join(", ", lookup.Select(kv => $"{kv.Key}: {kv.Value}"))}");

// === Multiple type parameters ===
Console.WriteLine("\n=== Multiple Type Parameters ===");
(TKey, TValue) MakePair<TKey, TValue>(TKey key, TValue value) => (key, value);

var pair1 = MakePair("name", 42);
var pair2 = MakePair(1, true);
Console.WriteLine($"pair1: {pair1}");
Console.WriteLine($"pair2: {pair2}");

// === Why generics matter — type safety ===
Console.WriteLine("\n=== Type Safety ===");
// Without generics (old C# before 2.0):
// ArrayList list = new ArrayList();
// list.Add(1);
// list.Add("hello");    // no error — accepts any object
// int val = (int)list[1]; // runtime crash! "hello" is not int

// With generics:
var safeList = new List<int>();
safeList.Add(1);
// safeList.Add("hello");  // Compile error! Can only add int
Console.WriteLine("List<int>.Add(\"hello\") → compile error (type safety!)");

// === Python vs C# ===
Console.WriteLine("\n=== Python vs C# Generics ===");
Console.WriteLine("C#:     List<int>.Add(\"hello\") = COMPILE ERROR (enforced)");
Console.WriteLine("Python: list[int].append(\"hello\") = runs fine (hint only)");
Console.WriteLine("C#:     MUST specify type: List<int>, not just List");
Console.WriteLine("Python: type is OPTIONAL: list works without [int]");
Console.WriteLine("C#:     constraints (where T : IComparable) restrict T");
Console.WriteLine("Python: TypeVar bounds exist but are NOT enforced at runtime");
```




<div>

    <div id='dotnet-interactive-this-cell-$CACHE_BUSTER$' style='display: none'>

        The below script needs to be able to find the current output cell; this is an easy method to get it.

    </div>

    <script type='text/javascript'>

async function probeAddresses(probingAddresses) {

    function timeout(ms, promise) {

        return new Promise(function (resolve, reject) {

            setTimeout(function () {

                reject(new Error('timeout'))

            }, ms)

            promise.then(resolve, reject)

        })

    }



    if (Array.isArray(probingAddresses)) {

        for (let i = 0; i < probingAddresses.length; i++) {



            let rootUrl = probingAddresses[i];



            if (!rootUrl.endsWith('/')) {

                rootUrl = `${rootUrl}/`;

            }



            try {

                let response = await timeout(1000, fetch(`${rootUrl}discovery`, {

                    method: 'POST',

                    cache: 'no-cache',

                    mode: 'cors',

                    timeout: 1000,

                    headers: {

                        'Content-Type': 'text/plain'

                    },

                    body: probingAddresses[i]

                }));



                if (response.status == 200) {

                    return rootUrl;

                }

            }

            catch (e) { }

        }

    }

}



function loadDotnetInteractiveApi() {

    probeAddresses(["http://2a02:8308:718a:f200::655c:2048/","http://2a02:8308:718a:f200:8bd4:d06d:33ed:be05:2048/","http://2a02:8308:718a:f200:11f1:5c2e:7e82:d4f1:2048/","http://fe80::3212:d8da:d32d:4723%14:2048/","http://192.168.0.110:2048/","http://::1:2048/","http://127.0.0.1:2048/"])

        .then((root) => {

        // use probing to find host url and api resources

        // load interactive helpers and language services

        let dotnetInteractiveRequire = require.config({

        context: '32304.Microsoft.DotNet.Interactive.Http.HttpPort',

                paths:

            {

                'dotnet-interactive': `${root}resources`

                }

        }) || require;



            window.dotnetInteractiveRequire = dotnetInteractiveRequire;



            window.configureRequireFromExtension = function(extensionName, extensionCacheBuster) {

                let paths = {};

                paths[extensionName] = `${root}extensions/${extensionName}/resources/`;

                

                let internalRequire = require.config({

                    context: extensionCacheBuster,

                    paths: paths,

                    urlArgs: `cacheBuster=${extensionCacheBuster}`

                    }) || require;



                return internalRequire

            };

        

            dotnetInteractiveRequire([

                    'dotnet-interactive/dotnet-interactive'

                ],

                function (dotnet) {

                    dotnet.init(window);

                },

                function (error) {

                    console.log(error);

                }

            );

        })

        .catch(error => {console.log(error);});

    }



// ensure `require` is available globally

if ((typeof(require) !==  typeof(Function)) || (typeof(require.config) !== typeof(Function))) {

    let require_script = document.createElement('script');

    require_script.setAttribute('src', 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js');

    require_script.setAttribute('type', 'text/javascript');

    

    

    require_script.onload = function() {

        loadDotnetInteractiveApi();

    };



    document.getElementsByTagName('head')[0].appendChild(require_script);

}

else {

    loadDotnetInteractiveApi();

}



    </script>

</div>


    === Generic Method ===
    int:    1
    string: a
    double: 1.1
    explicit: x
    
    === Generic Constraints ===
    Max(3, 7):       7
    Max("apple", "banana"): banana
    
    === Constraint Reference ===
    where T : struct          — T must be a value type (int, bool, struct)
    where T : class           — T must be a reference type (string, class)
    where T : new()           — T must have a parameterless constructor
    where T : IComparable<T>  — T must implement an interface
    where T : BaseClass       — T must inherit from a specific class
    where T : notnull         — T can't be null
    
    === Generic Class ===
    List<int>: [1, 2, 3]
    Dict:      Alice:85, Bob:92
    
    === Multiple Type Parameters ===
    pair1: (name, 42)
    pair2: (1, True)
    
    === Type Safety ===
    List<int>.Add("hello") → compile error (type safety!)
    
    === Python vs C# Generics ===
    C#:     List<int>.Add("hello") = COMPILE ERROR (enforced)
    Python: list[int].append("hello") = runs fine (hint only)
    C#:     MUST specify type: List<int>, not just List
    Python: type is OPTIONAL: list works without [int]
    C#:     constraints (where T : IComparable) restrict T
    Python: TypeVar bounds exist but are NOT enforced at runtime
    

## 2. Advanced LINQ


```csharp
// Advanced LINQ — GroupBy, Joins, Aggregations, Chaining
// Beyond the basics from notebook 03
//
// KEY CONCEPTS:
// - GroupBy: split data into groups, process each group. Like SQL GROUP BY.
// - Join / GroupJoin: combine two collections by matching key. Like SQL JOIN.
// - SelectMany: flatten nested results (one-to-many). Like SQL CROSS APPLY.
// - Lookup: like a Dictionary but allows multiple values per key.
// - All LINQ is lazy by default — nothing executes until you iterate or materialize.

// === Sample data ===
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

// === GroupBy ===
Console.WriteLine("=== GroupBy Department ===");
var byDept = employees.GroupBy(e => e.Dept);

foreach (var group in byDept)
{
    var names = string.Join(", ", group.Select(e => e.Name));
    var avgSalary = group.Average(e => e.Salary);
    Console.WriteLine($"  {group.Key,-15} ({group.Count()} people): [{names}] avg=${avgSalary:N0}");
}

// === Aggregate per group ===
Console.WriteLine("\n=== Aggregate: max salary per dept ===");
foreach (var group in byDept)
{
    var top = group.MaxBy(e => e.Salary)!;
    Console.WriteLine($"  {group.Key,-15} top earner: {top.Name} ${top.Salary:N0}");
}

// GroupBy + multiple aggregations
Console.WriteLine("\n=== GroupBy + Multiple Aggregations ===");
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

// === Join — combine two collections ===
Console.WriteLine("\n=== Inner Join (employees + departments) ===");
var innerJoin = employees.Join(
    departments,                                // join with
    e => e.Dept,                                // key from employees
    d => d.Dept,                                // key from departments
    (e, d) => new { e.Name, e.Dept, d.Head, d.Budget }  // result
);
foreach (var r in innerJoin.Take(3))
    Console.WriteLine($"  {r.Name,-10} {r.Dept,-15} head={r.Head,-10} budget=${r.Budget:N0}");

// === GroupJoin — left join (all departments, employees may be empty) ===
Console.WriteLine("\n=== Left Join (all depts, employees grouped) ===");
var leftJoin = departments.GroupJoin(
    employees,
    d => d.Dept,                                // key from departments
    e => e.Dept,                                // key from employees
    (d, emps) => new { d.Dept, d.Head, Count = emps.Count() }
);
foreach (var r in leftJoin)
    Console.WriteLine($"  {r.Dept,-15} head={r.Head,-10} employees={r.Count}");

// === Chained transformations (LINQ pipeline) ===
Console.WriteLine("\n=== Chained: Filter → Transform → Sort → Take ===");
var result = employees
    .Where(e => e.Salary > 75000)                          // filter
    .Select(e => new { e.Name, e.Salary, Tax = e.Salary * 0.3 })  // transform
    .OrderByDescending(e => e.Salary)                      // sort
    .Take(3);                                              // top 3
Console.WriteLine("Top 3 earners (>75k) with tax:");
foreach (var r in result)
    Console.WriteLine($"  {r.Name,-10} salary=${r.Salary:N0}  tax=${r.Tax:N0}");

// === Lookup — like Dictionary but multiple values per key ===
Console.WriteLine("\n=== Lookup (multi-value dictionary) ===");
var lookup = employees.ToLookup(e => e.Dept);
Console.WriteLine($"Engineering: [{string.Join(", ", lookup["Engineering"].Select(e => e.Name))}]");
Console.WriteLine($"Sales:       [{string.Join(", ", lookup["Sales"].Select(e => e.Name))}]");
Console.WriteLine($"Unknown:     [{string.Join(", ", lookup["Unknown"].Select(e => e.Name))}]");  // empty, no error

// === Zip ===
Console.WriteLine("\n=== Zip (parallel processing) ===");
var names = employees.Select(e => e.Name);
var salaries = employees.Select(e => e.Salary);
var raises = employees.Select(e => e.Salary * 0.1);

foreach (var (name, salary, raise_amt) in names.Zip(salaries, raises))
    Console.WriteLine($"  {name,-10} ${salary,8:N0} + ${raise_amt,7:N0} raise");
```

    === GroupBy Department ===
      Engineering     (3 people): [Alice, Charlie, Eve] avg=$97'667
      Sales           (2 people): [Bob, Diana] avg=$71'500
      Marketing       (1 people): [Frank] avg=$72'000
    
    === Aggregate: max salary per dept ===
      Engineering     top earner: Charlie $110'000
      Sales           top earner: Diana $78'000
      Marketing       top earner: Frank $72'000
    
    === GroupBy + Multiple Aggregations ===
      Engineering     count=3 avg=$97'667 range=[$88'000-$110'000] total=$293'000
      Sales           count=2 avg=$71'500 range=[$65'000-$78'000] total=$143'000
      Marketing       count=1 avg=$72'000 range=[$72'000-$72'000] total=$72'000
    
    === Inner Join (employees + departments) ===
      Alice      Engineering     head=CTO        budget=$500'000
      Bob        Sales           head=VP Sales   budget=$300'000
      Charlie    Engineering     head=CTO        budget=$500'000
    
    === Left Join (all depts, employees grouped) ===
      Engineering     head=CTO        employees=3
      Sales           head=VP Sales   employees=2
      Marketing       head=CMO        employees=1
      HR              head=CHRO       employees=0
    
    === Chained: Filter → Transform → Sort → Take ===
    Top 3 earners (>75k) with tax:
      Charlie    salary=$110'000  tax=$33'000
      Alice      salary=$95'000  tax=$28'500
      Eve        salary=$88'000  tax=$26'400
    
    === Lookup (multi-value dictionary) ===
    Engineering: [Alice, Charlie, Eve]
    Sales:       [Bob, Diana]
    Unknown:     []
    
    === Zip (parallel processing) ===
      Alice      $  95'000 + $  9'500 raise
      Bob        $  65'000 + $  6'500 raise
      Charlie    $ 110'000 + $ 11'000 raise
      Diana      $  78'000 + $  7'800 raise
      Eve        $  88'000 + $  8'800 raise
      Frank      $  72'000 + $  7'200 raise
    


```csharp
// SelectMany — flatten nested collections (one-to-many)
//
// KEY CONCEPT:
// - Select(x => list)    → gives you a List<List<T>>  (nested, one inner list per item)
// - SelectMany(x => list) → gives you a flat List<T>   (all inner items merged into one)
// Like SQL CROSS APPLY, or Python's df.explode() / itertools.chain.from_iterable()

// === Example 1: each person has multiple skills ===
Console.WriteLine("=== SelectMany: flatten skills ===");

var people = new[]
{
    new { Name = "Alice", Skills = new[] { "C#", "LINQ", "SQL" } },
    new { Name = "Bob",   Skills = new[] { "Python", "SQL" } },
    new { Name = "Charlie", Skills = new[] { "C#", "Go" } },
};

// Select → nested (List of arrays):
var nested = people.Select(p => p.Skills);
// nested = [ ["C#","LINQ","SQL"], ["Python","SQL"], ["C#","Go"] ]
Console.WriteLine("Select (nested):");
foreach (var arr in nested)
    Console.WriteLine($"  [{string.Join(", ", arr)}]");

// SelectMany → flat (one sequence):
var allSkills = people.SelectMany(p => p.Skills);
// allSkills = ["C#", "LINQ", "SQL", "Python", "SQL", "C#", "Go"]
Console.WriteLine("\nSelectMany (flat):");
Console.WriteLine($"  [{string.Join(", ", allSkills)}]");

// === Example 2: project both the parent and the child item ===
Console.WriteLine("\n=== SelectMany with result selector: (person, skill) pairs ===");
// SelectMany(collectionSelector, resultSelector) — keeps access to the outer item too
var pairs = people.SelectMany(
    p => p.Skills,                          // inner collection - returns: a string[]
    (p, skill) => $"{p.Name}: {skill}"      // combine outer + inner - automatically receives (person, string)
);
foreach (var pair in pairs)
    Console.WriteLine($"  {pair}");

// === Example 3: flatten + filter + distinct ===
Console.WriteLine("\n=== Distinct skills across all people ===");
var uniqueSkills = people
    .SelectMany(p => p.Skills)
    .Distinct()
    .OrderBy(s => s);
Console.WriteLine($"  [{string.Join(", ", uniqueSkills)}]");

// === Example 4: flatten a list of lists ===
Console.WriteLine("\n=== Flatten List<List<int>> ===");
// one level at a time only
var matrix = new List<List<int>>
{
    new List<int> { 1, 2, 3 },
    new List<int> { 4, 5 },
    new List<int> { 6, 7, 8, 9 },
};
var flat = matrix.SelectMany(row => row);
Console.WriteLine($"  [{string.Join(", ", flat)}]");

// === Python equivalent ===
Console.WriteLine("\n=== Python equivalent ===");
Console.WriteLine("people.SelectMany(p => p.Skills)");
Console.WriteLine("  → [skill for p in people for skill in p['skills']]");
Console.WriteLine("  → itertools.chain.from_iterable(p['skills'] for p in people)");
Console.WriteLine("  → df.explode('skills')  (Pandas)");
```

    === SelectMany: flatten skills ===
    Select (nested):
      [C#, LINQ, SQL]
      [Python, SQL]
      [C#, Go]
    
    SelectMany (flat):
      [C#, LINQ, SQL, Python, SQL, C#, Go]
    
    === SelectMany with result selector: (person, skill) pairs ===
      Alice: C#
      Alice: LINQ
      Alice: SQL
      Bob: Python
      Bob: SQL
      Charlie: C#
      Charlie: Go
    
    === Distinct skills across all people ===
      [C#, Go, LINQ, Python, SQL]
    
    === Flatten List<List<int>> ===
      [1, 2, 3, 4, 5, 6, 7, 8, 9]
    
    === Python equivalent ===
    people.SelectMany(p => p.Skills)
      → [skill for p in people for skill in p['skills']]
      → itertools.chain.from_iterable(p['skills'] for p in people)
      → df.explode('skills')  (Pandas)
    

## 3. LINQ vs Pandas — Side-by-Side Comparison


```csharp
// LINQ vs Pandas — Side-by-Side Reference
// Both do the same thing: filter, transform, group, join, aggregate.
// LINQ uses IEnumerable<T> (any collection), Pandas uses DataFrame (tabular data).
//
// KEY MAPPING:
//   LINQ .Where()        → pandas df[df.col > 5]
//   LINQ .Select()       → pandas df[["col1"]] or df.assign(new_col=...)
//   LINQ .OrderBy()      → pandas df.sort_values("col")
//   LINQ .GroupBy()      → pandas df.groupby("col")
//   LINQ .Join()         → pandas pd.merge(df1, df2, on="key")
//   LINQ .Take(n)        → pandas df.head(n)
//   LINQ .Count()        → pandas len(df)
//   LINQ .Sum/Avg/Max()  → pandas df.col.sum() / .mean() / .max()
//   LINQ .Distinct()     → pandas df.drop_duplicates()
//   LINQ .SelectMany()   → pandas df.explode("col")

// Using the same employee data from section 2:
Console.WriteLine("=== LINQ Equivalents of Pandas Operations ===");
Console.WriteLine("(Using employee data from previous cell)\n");

// === Filter ===
Console.WriteLine("=== Filter: salary > 75000 ===");
// Pandas:  df[df["salary"] > 75000]
var highEarners = employees.Where(e => e.Salary > 75000);
foreach (var e in highEarners)
    Console.WriteLine($"  {e.Name,-10} ${e.Salary:N0}");

// Multiple conditions
// Pandas:  df[(df["salary"] > 75000) & (df["dept"] == "Engineering")]
Console.WriteLine("\nEngineering >75k:");
var engHigh = employees.Where(e => e.Salary > 75000 && e.Dept == "Engineering");
foreach (var e in engHigh)
    Console.WriteLine($"  {e.Name,-10} ${e.Salary:N0}");

// === Select / Transform ===
Console.WriteLine("\n=== Select: name + salary + computed tax ===");
// Pandas:  df.assign(tax=df["salary"] * 0.3)[["name", "salary", "tax"]]
var withTax = employees.Select(e => new { e.Name, e.Salary, Tax = e.Salary * 0.3 });
foreach (var r in withTax)
    Console.WriteLine($"  {r.Name,-10} salary=${r.Salary:N0}  tax=${r.Tax:N0}");

// === Chained pipeline ===
Console.WriteLine("\n=== Full Pipeline: Filter → Transform → Sort → Take ===");
// Pandas: df[df["salary"]>75000].assign(tax=...).sort_values(...).head(3)
var pipeline = employees
    .Where(e => e.Salary > 75000)
    .Select(e => new { e.Name, e.Salary, Tax = e.Salary * 0.3 })
    .OrderByDescending(e => e.Salary)
    .Take(3);

foreach (var r in pipeline)
    Console.WriteLine($"  {r.Name,-10} salary=${r.Salary:N0}  tax=${r.Tax:N0}");

// === Comparison Table ===
Console.WriteLine("\n=== LINQ vs Pandas Cheat Sheet ===");
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
Multi-aggregate   .GroupBy().Select(g => new {...})  .groupby().agg(...)
Inner join        .Join(other, ...)                  pd.merge(df1, df2, on='key')
Left join         .GroupJoin(...)                    pd.merge(..., how='left')
Take N            .Take(3)                           df.head(3)
Skip N            .Skip(3)                           df.iloc[3:]
Count             .Count()                           len(df) or df.shape[0]
Distinct          .Distinct()                        df.drop_duplicates()
Flatten           .SelectMany(...)                   df.explode('col')
Lookup            .ToLookup(...)                     df.groupby().apply(list)
");

Console.WriteLine("=== Key Differences ===");
Console.WriteLine("LINQ:   works on ANY collection (List, Array, Dict, custom IEnumerable)");
Console.WriteLine("Pandas: works on DataFrames only (tabular data)");
Console.WriteLine("LINQ:   lazy by default (nothing runs until you iterate)");
Console.WriteLine("Pandas: eager (executes immediately, returns new DataFrame)");
Console.WriteLine("LINQ:   type-safe (compiler checks column names at compile time)");
Console.WriteLine("Pandas: string-based (column names are strings, typos = runtime errors)");
Console.WriteLine("LINQ:   no built-in DataFrame visualization");
Console.WriteLine("Pandas: rich display, plotting, CSV/Excel I/O built-in");
```

    === LINQ Equivalents of Pandas Operations ===
    (Using employee data from previous cell)
    
    === Filter: salary > 75000 ===
      Alice      $95'000
      Charlie    $110'000
      Diana      $78'000
      Eve        $88'000
    
    Engineering >75k:
      Alice      $95'000
      Charlie    $110'000
      Eve        $88'000
    
    === Select: name + salary + computed tax ===
      Alice      salary=$95'000  tax=$28'500
      Bob        salary=$65'000  tax=$19'500
      Charlie    salary=$110'000  tax=$33'000
      Diana      salary=$78'000  tax=$23'400
      Eve        salary=$88'000  tax=$26'400
      Frank      salary=$72'000  tax=$21'600
    
    === Full Pipeline: Filter → Transform → Sort → Take ===
      Charlie    salary=$110'000  tax=$33'000
      Alice      salary=$95'000  tax=$28'500
      Eve        salary=$88'000  tax=$26'400
    
    === LINQ vs Pandas Cheat Sheet ===
    
    Operation         LINQ (C#)                          Pandas (Python)
    ────────────────  ─────────────────────────────────  ─────────────────────────────
    Filter            .Where(e => e.Salary > 75000)      df[df['salary'] > 75000]
    Select columns    .Select(e => new { e.Name })       df[['name']]
    Add column        .Select(e => new { ..., Tax=... }) df.assign(tax=...)
    Sort asc          .OrderBy(e => e.Salary)            df.sort_values('salary')
    Sort desc         .OrderByDescending(...)            df.sort_values(..., ascending=False)
    GroupBy           .GroupBy(e => e.Dept)              df.groupby('dept')
    Aggregate         .Sum() .Average() .Max()           .sum() .mean() .max()
    Multi-aggregate   .GroupBy().Select(g => new {...})  .groupby().agg(...)
    Inner join        .Join(other, ...)                  pd.merge(df1, df2, on='key')
    Left join         .GroupJoin(...)                    pd.merge(..., how='left')
    Take N            .Take(3)                           df.head(3)
    Skip N            .Skip(3)                           df.iloc[3:]
    Count             .Count()                           len(df) or df.shape[0]
    Distinct          .Distinct()                        df.drop_duplicates()
    Flatten           .SelectMany(...)                   df.explode('col')
    Lookup            .ToLookup(...)                     df.groupby().apply(list)
    
    === Key Differences ===
    LINQ:   works on ANY collection (List, Array, Dict, custom IEnumerable)
    Pandas: works on DataFrames only (tabular data)
    LINQ:   lazy by default (nothing runs until you iterate)
    Pandas: eager (executes immediately, returns new DataFrame)
    LINQ:   type-safe (compiler checks column names at compile time)
    Pandas: string-based (column names are strings, typos = runtime errors)
    LINQ:   no built-in DataFrame visualization
    Pandas: rich display, plotting, CSV/Excel I/O built-in
    
