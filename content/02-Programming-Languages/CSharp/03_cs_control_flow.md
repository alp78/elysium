---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [if else, loops, for loop, while loop, switch, pattern matching, match case]
keywords: [if, else, switch, for, foreach, while, break, continue, pattern matching, LINQ]
description: "C# control flow reference with executable examples and cell outputs — covers conditionals, switch expressions, loops, pattern matching, and iterators. See [[03_py_control_flow]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[03_py_control_flow]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 03. Control Flow - C#

## Conditional Statements

#### if / else if / else — explicit bool conditions

Conditions must be explicit `bool` expressions — no truthy/falsy (unlike Python/JS). `else if` chains evaluate top-down — first match wins.

> [!warning] Always use braces — omitting them leads to bugs when adding statements later. Don't use deep `if`/`else` nesting — extract to methods or use switch expressions.

```csharp
#nullable enable

int score = 85;
string grade;
// Most restrictive condition first — each branch only reached if all above failed
if (score >= 90)
    grade = "A";
else if (score >= 80)
    grade = "B";
else if (score >= 70)
    grade = "C";
else if (score >= 60)
    grade = "D";
else
    grade = "F";
Console.WriteLine($"Score {score} → Grade {grade}");

int x = 10;
if (x > 0)
    Console.WriteLine($"{x} is positive");

// Ternary expression — single-line conditional returning a value
int age = 20;
string status = age >= 18 ? "adult" : "minor";
Console.WriteLine($"age={age} → {status}");
```

    Score 85 → Grade B
    10 is positive
    age=20 → adult

<h4>Nested ternary — <code style="font-size:0.75em">? :</code> chains</h4>

`condition ? trueVal : falseVal` chains right-to-left. Compact for simple 2-3 tier classification. Don't nest more than 2 levels — use switch expression for complex cases.

```csharp
int val = 15;
string label = val > 20 ? "high" : val > 10 ? "mid" : "low";
Console.WriteLine($"val={val} → {label}");
```

    val=15 → mid

#### No truthy/falsy — explicit bool conditions

C# requires explicit `bool` in every condition — no truthy/falsy. `if (items)`, `if (str)` are compile errors. Use `items.Count > 0`, `string.IsNullOrEmpty(s)`, `x != 0`, `obj != null`. This prevents `if (x = 5)` bugs (assignment is not bool).

```csharp
#nullable enable
var items = new List<int> { 1, 2, 3 };
// if (items) { }          // Compile error! Not a bool
if (items.Count > 0)       // must be explicit
    Console.WriteLine($"List has {items.Count} items");

string name = "";
// if (!name) { }           // Compile error!
if (string.IsNullOrEmpty(name))
    Console.WriteLine("Name is empty");

string? value = null;
if (value is null)          // pattern matching (preferred)
    Console.WriteLine("Value is null");
// also: if (value == null)  — works but 'is null' is safer

// if (10 < x < 20)  // Compile error! No chained comparisons in C#
if (10 < x && x < 20)
    Console.WriteLine($"{x} is between 10 and 20");
```

    List has 3 items
    Name is empty
    Value is null

#### Switch statement — discrete value matching with mandatory break

Each case must end with `break` (no fall-through — compile error in C#, unlike C). Empty cases can stack for multiple values. Only constants in case labels. Compiler warns on missing enum cases.

```csharp
string command = "quit";
switch (command)
{
    case "start":
        Console.WriteLine("Starting...");
        break;                              // break is REQUIRED
    case "stop":                            // no code, falls to next
    case "quit":                            // no code, falls to next
    case "exit":                            // fall-through: only allowed for empty cases
        Console.WriteLine("Stopping...");
        break;
    default:
        Console.WriteLine($"Unknown: {command}");
        break;
}
```

    Stopping...

<h4>Switch expression — compact value-returning form with <code style="font-size:0.75em">or</code> pattern and <code style="font-size:0.75em">_</code> wildcard</h4>

> [!info] Switch expression syntax
> - `variable switch { pattern => result, _ => default }` — returns a value directly
> - `or` pattern combines cases
> - `_` is the discard wildcard
> - Compiler warns if cases are incomplete

> [!warning] Missing `_` default causes `MatchFailureException` at runtime. Keep switch arms pure — no side effects.

```csharp
string result = command switch
{
    "start" => "Starting...",
    "stop" or "quit" or "exit" => "Stopping...",   // 'or' pattern
    _ => $"Unknown: {command}"                       // _ is wildcard default
};
Console.WriteLine(result);
```

    Stopping...

<h4>Switch expression — relational patterns (<code style="font-size:0.75em">&gt;=</code>, <code style="font-size:0.75em">&lt;</code>, etc.)</h4>

Switch arms with relational operators: `>= 90 => "A"`. First match wins — order from most restrictive to least. `>= 70` before `>= 90` would match 95 as "C".

```csharp
grade = score switch
{
    >= 90 => "A",          // first match wins — most restrictive first
    >= 80 => "B",
    >= 70 => "C",
    >= 60 => "D",
    _ => "F"
};
Console.WriteLine($"Score {score} → Grade {grade}");
```

    Score 85 → Grade B

<h4>Switch expression — type patterns and <code style="font-size:0.75em">when</code> guard</h4>

> [!info] Type patterns
> - `int n => ...` — matches integers and binds to `n`
> - `when` adds a guard: `int n when n < 0 => ...`
> - Combines type checking and casting in one step — no explicit cast needed

```csharp
object[] values = { 42, -5, "hello", new[] { 1, 2, 3 }, 3.14 };
foreach (var v in values)
{
    string desc = v switch
    {
        int n when n > 0 => $"positive int: {n}",     // type + guard (when)
        int n            => $"non-positive int: {n}",  // type only
        string s         => $"string: '{s}'",
        int[] arr        => $"array starting with {arr[0]}, {arr.Length - 1} more",
        _                => $"other: {v.GetType().Name}"
    };
    Console.WriteLine($"  {v,-12} → {desc}");
}
```

      42           → positive int: 42
      -5           → non-positive int: -5
      hello        → string: 'hello'
      System.Int32[] → array starting with 1, 2 more
      3.14         → other: Double

<h4>Switch expression — property patterns (<code style="font-size:0.75em">{ Property: value }</code>)</h4>

> [!info] Property patterns
> - `{ PropertyName: value }` — matches when the property equals the value
> - Nest for multi-property: `{ Month: 12, Day: 25 }`
> - Combine with relational patterns or `or`

```csharp
var date = new DateTime(2024, 12, 25);
string holiday = date switch
{
    { Month: 12, Day: 25 }                                       => "Christmas",
    { Month: 1, Day: 1 }                                         => "New Year",
    { DayOfWeek: DayOfWeek.Saturday or DayOfWeek.Sunday }        => "Weekend",
    _                                                             => "Regular day"
};
Console.WriteLine($"{date:yyyy-MM-dd} → {holiday}");
```

    2024-12-25 → Christmas

<h4>Null-coalescing (<code style="font-size:0.75em">??</code>, <code style="font-size:0.75em">??=</code>) and <code style="font-size:0.75em">is</code> pattern matching</h4>

> [!info] Null-handling operators
> - `??` — returns left if non-null, else right (replaces `x != null ? x : default`)
> - `??=` — assigns only when null (one-line lazy init: `_cache ??= LoadData()`)
> - `is` pattern — extracts and casts in one step: `if (obj is string s)`
>
> > [!warning] When null is an error, throw `ArgumentNullException` instead of using `??`.

```csharp
#nullable enable

string? maybeNull = null;

// ?? — default fallback
string safe = maybeNull ?? "default";
Console.WriteLine($"??:  {safe}");

// ??= — assign only if null
maybeNull ??= "fallback";
Console.WriteLine($"??=: {maybeNull}");

// is — pattern matching: tests type AND extracts value in one expression
if (maybeNull is string notNull)
    Console.WriteLine($"Has value: {notNull}");
else
    Console.WriteLine("Is null");
```

    ??:  default
    ??=: fallback
    Has value: fallback

## Loops

#### for and foreach loops

> [!info] Loop types
> - `for (init; condition; increment)` — runs while condition is true
> - `foreach (var item in collection)` — iterates any `IEnumerable<T>`
> - Prefer `foreach` — cleaner, no off-by-one errors

> [!warning] Don't modify a collection during `foreach` — throws `InvalidOperationException`. Use `for` loop or `ToList()` first.

```csharp
// for — index-based iteration with explicit counter
for (int i = 0; i < 5; i++)
    Console.Write($"  {i}");
Console.WriteLine();

// for with step — increment by any value
Console.Write("Step 3: ");
for (int i = 0; i < 20; i += 3)
    Console.Write($"  {i}");
Console.WriteLine();
```

      0  1  2  3  4
    Step 3:   0  3  6  9  12  15  18

<h4>Count down with <code style="font-size:0.75em">for</code></h4>

Decrement: `for (int i = 10; i > 0; i -= 2)`. Step can be any integer — negative for counting down, >1 for skipping. Watch condition direction: `i > 0` not `i < 10` for counting down.

```csharp
Console.Write("Down:   ");
for (int i = 10; i > 0; i -= 2)
    Console.Write($"  {i}");
Console.WriteLine();
```

    Down:     10  8  6  4  2

#### Enumerate and Zip

## Loop Control

<h4><code style="font-size:0.75em">break</code>, <code style="font-size:0.75em">continue</code>, <code style="font-size:0.75em">goto</code></h4>

> [!info] Loop control
> - `break` — exits the innermost loop immediately
> - `continue` — skips to the next iteration
> - Both work in `for`, `foreach`, `while`, and `do-while`
> - For complex flow, extract to a method with `return`

```csharp
// break — exits immediately when condition is met
for (int i = 0; i < 10; i++)
{
    if (i == 5)
    {
        Console.WriteLine($"  Breaking at {i}");
        break;
    }
    Console.Write($"  {i}");
}
Console.WriteLine();

// continue — skips the rest of the current iteration
for (int i = 0; i < 10; i++)
{
    if (i % 2 == 0)
        continue;           // skip even numbers
    Console.Write($"  {i}");
}
Console.WriteLine();
```

      0  1  2  3  4  Breaking at 5
    
      1  3  5  7  9

<h4>Breaking outer loops with <code style="font-size:0.75em">goto</code> and <code style="font-size:0.75em">return</code></h4>

C# has no labeled `break`. Two patterns: (1) `goto` to a label after the outer loop — the accepted idiom for nested loop breaking. (2) Extract to a method and use `return`. Don't use `goto` for general flow control.

```csharp
bool found = false;
for (int i = 0; i < 3; i++)
{
    for (int j = 0; j < 3; j++)
    {
        if (i == 1 && j == 1)
        {
            found = true;
            goto Done;
        }
    }
}
Done:
Console.WriteLine($"Found: {found}");

// return — exits the entire method, implicitly breaking all loops
static int FindFirst(int[][] matrix, int target)
{
    for (int i = 0; i < matrix.Length; i++)
        for (int j = 0; j < matrix[i].Length; j++)
            if (matrix[i][j] == target)
                return i * 100 + j;
    return -1;
}
int[][] m = { new[] { 1, 2 }, new[] { 3, 4 } };
Console.WriteLine(FindFirst(m, 3));
```

    Found: True
    100

## Iterators & Generators

<h4><code style="font-size:0.75em">yield return</code> — lazy iterator method</h4>

A method returning `IEnumerable<T>` with `yield return` pauses execution, returns a value, and resumes on the next `MoveNext()`. The compiler transforms it into a state machine. Values are computed lazily — only when requested. Composable with LINQ.

> [!warning] The method body doesn't run until the first `MoveNext()` — not when the method is called.

```csharp
IEnumerable<int> Countdown(int n)
{
    Console.WriteLine($"  Starting countdown from {n}");
    while (n > 0)
    {
        yield return n;      // pauses here, returns value, resumes on MoveNext()
        n--;
    }
    Console.WriteLine("  Done!");
}

foreach (var val in Countdown(5))
    Console.Write($"  {val}");
Console.WriteLine();
```

      Starting countdown from 5
      5  4  3  2  1  Done!

<h4>Manual iteration with <code style="font-size:0.75em">GetEnumerator()</code></h4>

`GetEnumerator()` returns an `IEnumerator` with `MoveNext()` (advance + bool) and `Current` (value). `foreach` is syntactic sugar for this protocol. Use manual iteration for peeking ahead or interleaving enumerators.

```csharp
IEnumerable<int> Countdown(int n)
{
    while (n > 0) { yield return n; n--; }
}

var enumerator = Countdown(3).GetEnumerator();
enumerator.MoveNext(); Console.WriteLine($"  next: {enumerator.Current}");  // 3
enumerator.MoveNext(); Console.WriteLine($"  next: {enumerator.Current}");  // 2
enumerator.MoveNext(); Console.WriteLine($"  next: {enumerator.Current}");  // 1
```

      next: 3
      next: 2
      next: 1

<h4><code style="font-size:0.75em">SelectMany</code> — flattens one level of nesting</h4>

`SelectMany` projects each element to a sequence and flattens into one. One-line flatten: `nested.SelectMany(x => x)`. Only one level — not recursive.

```csharp
var oneLevel = new[] { new[] { 1, 2 }, new[] { 3, 4 }, new[] { 5, 6 } };
Console.WriteLine($"SelectMany (1 level): [{string.Join(", ", oneLevel.SelectMany(x => x))}]");
// Does NOT work for deep nesting — SelectMany only peels one layer
```

    SelectMany (1 level): [1, 2, 3, 4, 5, 6]

<h4>Iterative flatten with <code style="font-size:0.75em">Stack&lt;T&gt;</code></h4>

Stack-based iterative flatten — no recursion, handles arbitrary depth in constant stack space. Avoids `StackOverflowException`. Watch out for strings (they're `IEnumerable` — causes infinite recursion if not checked).

```csharp
var nested = new object[] { 1, new object[] { 2, 3 }, new object[] { 4, new object[] { 5, 6 } }, 7 };

// FlattenIter — uses a stack instead of recursion; push sub-items back onto stack in reverse order
List<int> FlattenIter(object[] input)
{
    var stack = new Stack<object>(input.Reverse());  // reversed to maintain order
    var result = new List<int>();
    while (stack.Count > 0)
    {
        var item = stack.Pop();
        if (item is object[] sub)
            foreach (var x in sub.Reverse())
                stack.Push(x);
        else if (item is int n)
            result.Add(n);
    }
    return result;
}
Console.WriteLine($"Iterative flatten:    [{string.Join(", ", FlattenIter(nested))}]");

// FlatLinq — recursive SelectMany; compact but still uses the call stack
IEnumerable<int> FlatLinq(IEnumerable<object> items) =>
    items.SelectMany(item => item is object[] sub ? FlatLinq(sub) : new[] { (int)item });
Console.WriteLine($"LINQ recursive:       [{string.Join(", ", FlatLinq(nested))}]");
```

    Iterative flatten:    [1, 2, 3, 4, 5, 6, 7]
    LINQ recursive:       [1, 2, 3, 4, 5, 6, 7]

<h4>Eager vs lazy evaluation — <code style="font-size:0.75em">ToList()</code> vs deferred</h4>

LINQ queries are lazy — nothing executes until enumerated (`foreach`, `ToList`, `ToArray`). Without `ToList()`, the query re-executes on each enumeration. Use `ToList()` when enumerating multiple times or caching results. Never `ToList()` on infinite sequences.

```csharp
var squaresList = Enumerable.Range(0, 10).Select(x => x * x).ToList();
Console.WriteLine($"Eager list: [{string.Join(", ", squaresList)}]");

// Lazy: without .ToList() — values computed on demand during iteration
var squaresLazy = Enumerable.Range(0, 10).Select(x => x * x);
Console.WriteLine($"Lazy type:  {squaresLazy.GetType().Name}");
Console.WriteLine($"As list:    [{string.Join(", ", squaresLazy)}]");
```

    Eager list: [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
    Lazy type:  RangeSelectIterator`2
    As list:    [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]

<h4><code style="font-size:0.75em">yield break</code> — early termination</h4>

`yield break` terminates the iterator immediately — no more values produced. Equivalent to `return` in a regular method. Use for custom take-while logic or error boundaries. For simple filtering, `.TakeWhile()` is shorter.

```csharp
IEnumerable<int> TakeWhilePositive(int[] arr)
{
    foreach (var n in arr)
    {
        if (n < 0) yield break;   // stops the iterator when a negative is encountered
        yield return n;
    }
}
Console.WriteLine($"TakeWhile: [{string.Join(", ", TakeWhilePositive(new[] { 3, 7, -2, 5 }))}]");
```

    TakeWhile: [3, 7]

<h4>Recursive iterator — flatten a deeply nested structure with <code style="font-size:0.75em">yield return</code></h4>

Recursive iterator — calls itself for nested collections, `yield return` for leaves. Natural for tree/graph traversal. For untrusted/deep nesting, use the Stack approach to avoid `StackOverflowException`.

```csharp
IEnumerable<int> Flatten(IEnumerable<object> nested)
{
    foreach (var item in nested)
    {
        if (item is IEnumerable<object> sub)
            foreach (var inner in Flatten(sub))  // manual "yield from"
                yield return inner;
        else if (item is int n)
            yield return n;
    }
}
var nestedArr = new object[] { 1, new object[] { 2, 3 }, new object[] { 4, new object[] { 5, 6 } }, 7 };
Console.WriteLine($"Flatten: [{string.Join(", ", Flatten(nestedArr))}]");
```

    Flatten: [1, 2, 3, 4, 5, 6, 7]

## LINQ & Functional Equivalents

#### LINQ basics — Select, Where, chaining, and SelectMany

> [!info] Core LINQ methods
> - `Select` — transforms each element (map)
> - `Where` — filters elements (filter)
> - `SelectMany` — flattens nested sequences
> - Chain fluently: `.Where(...).Select(...).Take(...)`
> - All lazy — nothing executes until enumeration (`foreach` or `ToList()`)

> [!warning] Don't use `foreach` with `if` + add to list — use `.Where().Select()`. Don't enumerate a deferred query multiple times — materialize with `ToList()`.

```csharp
// Select — transforms each element (map)
var squares = Enumerable.Range(0, 10).Select(x => x * x).ToList();
Console.WriteLine($"Squares:  [{string.Join(", ", squares)}]");

// Where — keeps only elements matching a condition (filter)
var evens = Enumerable.Range(0, 20).Where(x => x % 2 == 0).ToList();
Console.WriteLine($"Evens:    [{string.Join(", ", evens)}]");

// Chaining — pipe results through multiple operations
var words = new[] { "hello", "world", "csharp", "is", "great" };
var longUpper = words.Where(w => w.Length > 3).Select(w => w.ToUpper());
Console.WriteLine($"Long upper: [{string.Join(", ", longUpper)}]");

// SelectMany — flattens one level of nesting (nested loop in one call)
var matrix = new[] { new[] { 1, 2, 3 }, new[] { 4, 5, 6 }, new[] { 7, 8, 9 } };
var flat = matrix.SelectMany(row => row).ToList();
Console.WriteLine($"Flat:     [{string.Join(", ", flat)}]");
```

    Squares:  [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
    Evens:    [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]
    Long upper: [HELLO, WORLD, CSHARP, GREAT]
    Flat:     [1, 2, 3, 4, 5, 6, 7, 8, 9]

#### Query syntax vs method syntax

Query syntax (`from x in items where ... select ...`) reads like SQL. Method syntax (`.Where().Select()`) uses lambda chains. Both compile to identical IL. Use query syntax for complex joins; method syntax for simple pipelines.

```csharp
var words = new[] { "hello", "world", "csharp", "is", "great" };

// Query syntax — SQL-like keywords: from, where, orderby, select
var queryResult = from w in words
                  where w.Length > 3
                  orderby w.Length
                  select w.ToUpper();
Console.WriteLine($"Query:    [{string.Join(", ", queryResult)}]");

// Method syntax — fluent chaining of extension methods (most common style)
var methodResult = words.Where(w => w.Length > 3).OrderBy(w => w.Length).Select(w => w.ToUpper());
Console.WriteLine($"Method:   [{string.Join(", ", methodResult)}]");
```

    Query:    [HELLO, WORLD, GREAT, CSHARP]
    Method:   [HELLO, WORLD, GREAT, CSHARP]

<h4><code style="font-size:0.75em">ToDictionary</code> and <code style="font-size:0.75em">ToHashSet</code></h4>

> [!info] Materialization
> - `ToDictionary(keySelector, valueSelector)` — builds a `Dictionary` (O(1) lookup)
> - `ToHashSet()` — builds a `HashSet` (O(1) membership)
> - Both are eager — enumerate immediately
>
> > [!warning] Duplicate keys in `ToDictionary` throw `ArgumentException`.

```csharp
var squaresDict = Enumerable.Range(0, 6).ToDictionary(x => x, x => x * x);
Console.WriteLine($"Squares dict: {string.Join(", ", squaresDict.Select(kv => $"{kv.Key}:{kv.Value}"))}");

// Filter dict — Where on a dictionary yields KeyValuePair<K,V>; re-materialize with ToDictionary
var scores = new Dictionary<string, int> { ["Alice"] = 85, ["Bob"] = 92, ["Charlie"] = 78, ["Diana"] = 95 };
var passed = scores.Where(kv => kv.Value >= 80).ToDictionary(kv => kv.Key, kv => kv.Value);
Console.WriteLine($"Passed:       {string.Join(", ", passed.Select(kv => $"{kv.Key}:{kv.Value}"))}");

// ToHashSet — deduplicated collection, O(1) lookup
var words = new[] { "hello", "world", "csharp", "is", "great" };
var uniqueLengths = words.Select(w => w.Length).ToHashSet();
Console.WriteLine($"Unique lengths: [{string.Join(", ", uniqueLengths)}]");
```

    Squares dict: 0:0, 1:1, 2:4, 3:9, 4:16, 5:25
    Passed:       Alice:85, Bob:92, Diana:95
    Unique lengths: [5, 6, 2]

<h4>Aggregate and built-in aggregations (<code style="font-size:0.75em">Sum</code>, <code style="font-size:0.75em">Max</code>, <code style="font-size:0.75em">Any</code>, <code style="font-size:0.75em">All</code>)</h4>

> [!info] Aggregation
> - `Aggregate(seed, (acc, x) => ...)` — the general fold
> - Built-in shortcuts: `Sum()`, `Max()`, `Min()`, `Average()`, `Count()`
> - `Any(predicate)` / `All(predicate)` — boolean checks; `Any()` short-circuits on first match
> - Don't use `Count() > 0` when `Any()` suffices

```csharp
var nums = new[] { 1, 2, 3, 4, 5 };
int total = nums.Aggregate(0, (acc, x) => acc + x);
Console.WriteLine($"Sum:     {total}");
int product = nums.Aggregate(1, (acc, x) => acc * x);
Console.WriteLine($"Product: {product}");

// Built-in aggregations — preferred for common operations
Console.WriteLine($"Sum():   {nums.Sum()}");
Console.WriteLine($"Max():   {nums.Max()}");
Console.WriteLine($"Min():   {nums.Min()}");
Console.WriteLine($"All():   {nums.All(x => x > 0)}");     // true if ALL match
Console.WriteLine($"Any():   {nums.Any(x => x > 3)}");     // true if ANY match
Console.WriteLine($"Count(): {nums.Count(x => x > 2)}");
Console.WriteLine($"Average:{nums.Average()}");
```

    Sum:     15
    Product: 120
    Sum():   15
    Max():   5
    Min():   1
    All():   True
    Any():   True
    Count(): 3
    Average:3

<h4>Ordering — <code style="font-size:0.75em">OrderBy</code>, <code style="font-size:0.75em">OrderByDescending</code> with a key selector</h4>

> [!info] Ordering
> - `OrderBy(x => x.Property)` — sorts ascending
> - `OrderByDescending` — sorts descending
> - `ThenBy` / `ThenByDescending` — secondary sort
> - Stable sort — equal elements maintain relative order
>
> > [!warning] Don't chain two `OrderBy` calls — the second replaces the first. Use `ThenBy` for secondary sort.

```csharp
var names = new[] { "Charlie", "Alice", "Bob", "Diana" };
Console.WriteLine($"Alphabetical:  [{string.Join(", ", names.OrderBy(n => n))}]");
Console.WriteLine($"By length:     [{string.Join(", ", names.OrderBy(n => n.Length))}]");
Console.WriteLine($"Descending:    [{string.Join(", ", names.OrderByDescending(n => n))}]");
Console.WriteLine($"By last char:  [{string.Join(", ", names.OrderBy(n => n[^1]))}]");
```

    Alphabetical:  [Alice, Bob, Charlie, Diana]
    By length:     [Bob, Alice, Diana, Charlie]
    Descending:    [Diana, Charlie, Bob, Alice]
    By last char:  [Diana, Bob, Charlie, Alice]

<h4>Deferred execution — chained LINQ pipeline materialized by <code style="font-size:0.75em">ToList()</code></h4>

> [!info] Deferred execution
> - Each LINQ method returns a lazy `IEnumerable`
> - Chain declaratively: `.Where().Select().OrderBy().Take()`
> - Nothing executes until `foreach` or `ToList()`
> - Add conditions dynamically: `if (filter) query = query.Where(...)`
>
> > [!warning] Don't enumerate the same deferred query multiple times — it duplicates work. Materialize with `ToList()` if you need multiple passes.

```csharp
var result = Enumerable.Range(1, 20)
    .Where(x => x % 2 == 0)             // filter evens
    .Select(x => x * x)                 // square them
    .Where(x => x > 50)                 // keep > 50
    .OrderByDescending(x => x)          // sort descending
    .Take(3)                            // first 3
    .ToList();                          // materialize — executes the entire chain
Console.WriteLine($"Chained: [{string.Join(", ", result)}]");
```

    Chained: [400, 324, 256]

#### Infinite generator and common sequence methods

> [!info] Infinite sequences
> - `while(true)` with `yield return` produces an infinite sequence
> - Callers control consumption with `Take()`, `First()`, `TakeWhile()`
> - Common methods: `Take`, `Skip`, `Distinct`, `Zip`, `Chunk`, `Concat`

> [!danger] Never call `ToList()`, `Count()`, or `foreach` without `break` on infinite sequences — hangs or OOM.

```csharp
IEnumerable<int> Naturals(int start = 0)
{
    while (true)          // never ends — relies on caller to stop (Take, First, etc.)
    {
        yield return start;
        start++;
    }
}
Console.WriteLine($"First 5 naturals: [{string.Join(", ", Naturals().Take(5))}]");
Console.WriteLine($"From 10:          [{string.Join(", ", Naturals(10).Take(5))}]");

// Range — generates a sequence of consecutive integers
Console.WriteLine($"Range:          [{string.Join(", ", Enumerable.Range(0, 5))}]");

// Select — transforms each element with a lambda
Console.WriteLine($"Select (map):   [{string.Join(", ", new[] { "a", "b" }.Select(s => s.ToUpper()))}]");

// Where — keeps only elements matching a condition
Console.WriteLine($"Where (filter): [{string.Join(", ", new[] { 1, 2, 3, 4 }.Where(x => x > 2))}]");

// Reverse — reverses the order of elements
Console.WriteLine($"Reverse:        [{string.Join(", ", new[] { 1, 2, 3 }.Reverse())}]");

// Concat — appends one sequence to another
Console.WriteLine($"Concat (chain): [{string.Join(", ", new[] { 1, 2 }.Concat(new[] { 3, 4 }))}]");

// Repeat — produces a single value repeated n times
Console.WriteLine($"Repeat:         [{string.Join(", ", Enumerable.Repeat("x", 3))}]");
```

    First 5 naturals: [0, 1, 2, 3, 4]
    From 10:          [10, 11, 12, 13, 14]
    Range:          [0, 1, 2, 3, 4]
    Select (map):   [A, B]
    Where (filter): [3, 4]
    Reverse:        [3, 2, 1]
    Concat (chain): [1, 2, 3, 4]
    Repeat:         [x, x, x]
