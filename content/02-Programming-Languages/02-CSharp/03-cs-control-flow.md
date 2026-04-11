---
title: "03 - Control Flow - C#"
tags:
  - csharp
aliases: [if else, loops, for loop, while loop, switch, pattern matching, match case]
description: "C# control flow reference with executable examples and cell outputs — covers conditionals, switch expressions, loops, pattern matching, and iterators. See [03-py-control-flow](https://alp78.github.io/elysium/02-Programming-Languages/01-Python/03-py-control-flow) for the Python equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 03. Control Flow - C#

> [!quote]
> "The quality of programmers is a decreasing function of the density of go to statements in the programs they produce."
>
> — **Edsger W. Dijkstra**, *Go To Statement Considered Harmful* (1968)

This note covers every mechanism C# provides for directing program execution: conditional branching (`if`/`else`, ternary, null-coalescing), `switch` statements and expressions with exhaustive pattern matching (type, property, relational, list, positional), loops (`for`, `foreach`, `while`, `do-while`), loop control (`break`, `continue`, `goto`), iterator methods with `yield return`, and LINQ as functional pipeline equivalents.

### Key terms used in this note

| Term | Definition | Purpose | Common mistake / confusion |
|---|---|---|---|
| **if / else** | Conditional branching requiring an explicit `bool` expression. No truthy/falsy coercion — `if (1)` is a compile error. | Direct program flow based on conditions. | Using `=` (assignment) instead of `==` (equality) in conditions — C# catches this at compile time for non-bool. |
| **Ternary operator** | `condition ? valueIfTrue : valueIfFalse`. Both branches must return the same type. | Inline conditional assignment. | Nesting beyond 2 levels — becomes unreadable. Use `switch` expression instead. |
| **Null-coalescing** | `a ?? b` returns `a` if not null, otherwise `b`. `a ??= b` assigns `b` only if `a` is null. | Provide defaults for nullable values. | Chaining too many: `a ?? b ?? c ?? d` — consider a method or config lookup. |
| **switch statement** | Multi-branch dispatch on a value. Requires `break` after each `case` (no fall-through by default). | Replace long `if/elif` chains with clearer branching. | Forgetting `break` — causes a compile error (C# prevents accidental fall-through). |
| **switch expression** | `value switch { pattern => result, ... }` — expression-based, exhaustive matching. Returns a value. | Pattern-based dispatch in assignments and returns. | Missing the discard `_` default — throws `SwitchExpressionException` at runtime if no pattern matches. |
| **Pattern matching** | `is` patterns in `if`/`switch`: type (`is int n`), property (`{ Length: > 5 }`), relational (`> 0`), list (`[_, .., var last]`). | Type-safe destructuring and condition checking. | Forgetting that `is` patterns introduce new variables in scope — can shadow outer variables. |
| **for loop** | Index-based iteration: `for (int i = 0; i < n; i++)`. | Iterate when you need the index or non-sequential access. | Off-by-one errors with `<` vs `<=` in the condition. |
| **foreach** | Iterates over any `IEnumerable<T>`. No index access (use LINQ `Select` with index or manual counter). | Process every item in a collection. | Modifying the collection during iteration — throws `InvalidOperationException`. |
| **while / do-while** | `while` checks condition first; `do-while` executes body first, then checks. | Loop when iteration count is unknown. | `do-while` always runs at least once — ensure the body handles the initial state. |
| **break / continue** | `break` exits the innermost loop; `continue` skips to the next iteration. | Early termination and item skipping. | Expecting `break` to exit nested loops — use `goto`, a flag, or extract to a method. |
| **yield return** | Produces one value at a time from an iterator method returning `IEnumerable<T>`. | Lazy, memory-efficient sequences. | Modifying state between `yield` calls — the method resumes where it left off. |
| **yield break** | Terminates an iterator method early. | Stop producing values when a condition is met. | Using `return` instead of `yield break` in an iterator — causes a compile error. |
| **LINQ** | Language-Integrated Query — `Select`, `Where`, `OrderBy`, `GroupBy`, `Aggregate`, etc. Lazy by default. | Declarative data transformation replacing imperative loops. | Calling LINQ on non-materialized queries repeatedly — each call re-evaluates. Use `.ToList()` to materialize. |
| **IEnumerable\<T\>** | Interface for lazy, forward-only iteration. Returned by LINQ, `yield return`, and collection types. | Standardized iteration contract. | Enumerating multiple times triggers multiple evaluations (DB queries, file reads). Materialize with `.ToList()`. |

### What this note covers

- **Conditional Statements** — `if`/`else`, ternary, null-coalescing (`??`, `??=`), `switch` statements and expressions, pattern matching (type, property, relational, list, positional)
- **Loops** — `for`, `foreach`, `while`, `do-while`, nested loops, `Parallel.For`
- **Loop Control** — `break`, `continue`, `goto` for nested loop exit, labeled loop patterns
- **Iterators & Generators** — `yield return`, `yield break`, custom `IEnumerable<T>` implementations, lazy evaluation
- **LINQ & Functional Equivalents** — `Select`, `Where`, `OrderBy`, `GroupBy`, `Aggregate`, `Zip`, `Range`, `Repeat`

## Conditional Statements

C# provides three families of conditional constructs: `if`/`else` chains for boolean branching, `switch` statements and expressions for multi-way value and pattern matching, and null-handling operators (`??`, `??=`, `is`) for safe navigation. Conditions must always be explicit `bool` — no implicit truthy/falsy conversion.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    A["How many branches?"] --> B["1-2 branches"]
    A --> C["3+ discrete values"]
    A --> D["Pattern matching needed"]
    B --> E["if / else"]
    B --> F["Ternary ? :"]
    C --> G["Switch statement"]
    C --> H["Switch expression"]
    D --> I["Type / property / relational patterns"]
    E --> J["Use for side effects,\nmultiple statements"]
    F --> K["Use for inline\nvalue selection"]
    G --> L["Use for imperative flow\nwith fall-through"]
    H --> M["Use for value-returning\ncompact matching"]
    I --> H
```

### Branching with if / else

Basic conditional branching evaluates explicit `bool` expressions top-down. C# has no truthy/falsy coercion, so every condition must resolve to `true` or `false`.

#### if / else if / else — explicit bool conditions

Conditions must be explicit `bool` expressions — no truthy/falsy (unlike Python/JS). `else if` chains evaluate top-down — first match wins. Place the most restrictive condition first, since each branch is only reached if all conditions above it failed.

> [!warning] Always use braces
>
> Always use braces — omitting them leads to bugs when adding statements later. Don't use deep `if`/`else` nesting — extract to methods or use switch expressions.

> [!success] Best practice
>
> Always wrap `if`/`else` bodies in braces, even for single-line branches. Replace deep nesting with guard clauses or switch expressions to keep methods flat and readable.

```csharp
int score = 85;
string grade;

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
```

```text
Score 85 → Grade B
```

#### Simple if — single condition without else

A standalone `if` checks one condition with no alternative branch. The body executes only when the condition is `true`.

```csharp
int x = 10;
if (x > 0)
    Console.WriteLine($"{x} is positive");
```

```text
10 is positive
```

#### Nested ternary — ? : chains

`condition ? trueVal : falseVal` chains right-to-left. Compact for simple 2-3 tier classification. Don't nest more than 2 levels — use switch expression for complex cases.

```csharp
int val = 15;
string label = val > 20 ? "high" : val > 10 ? "mid" : "low";
Console.WriteLine($"val={val} → {label}");
```

```text
val=15 → mid
```

#### No truthy/falsy — explicit bool conditions

C# requires explicit `bool` in every condition — no truthy/falsy. `if (items)`, `if (str)` are compile errors — use `items.Count > 0`, `string.IsNullOrEmpty(s)`, `x != 0`, or `obj != null`. This prevents `if (x = 5)` bugs (assignment returns `int`, not `bool`). For null checks, `is null` is preferred over `== null` because `is` cannot be overloaded. Chained comparisons like `10 < x < 20` are also compile errors — use `&&` to combine conditions.

```csharp
#nullable enable
var items = new List<int> { 1, 2, 3 };
if (items.Count > 0)
    Console.WriteLine($"List has {items.Count} items");

string name = "";
if (string.IsNullOrEmpty(name))
    Console.WriteLine("Name is empty");

string? value = null;
if (value is null)
    Console.WriteLine("Value is null");

if (10 < x && x < 20)
    Console.WriteLine($"{x} is between 10 and 20");
```

```text
List has 3 items
Name is empty
Value is null
```

### Switch statements and expressions

The `switch` construct comes in two forms: the traditional statement (multi-line, imperative) and the modern expression (single-expression, value-returning). Switch expressions support relational, type, property, and combinatorial patterns — making them the preferred choice for most pattern matching scenarios in modern C#.

#### Switch statement — discrete value matching with mandatory break

Each case must end with `break` (no fall-through — compile error in C#, unlike C). Empty cases can stack for multiple values. Only constants allowed in case labels. The compiler warns on missing enum cases.

```csharp
string command = "quit";
switch (command)
{
    case "start":
        Console.WriteLine("Starting...");
        break;
    case "stop":
    case "quit":
    case "exit":
        Console.WriteLine("Stopping...");
        break;
    default:
        Console.WriteLine($"Unknown: {command}");
        break;
}
```

```text
Stopping...
```

#### Switch expression — compact value-returning form with or pattern and _ wildcard

> [!info] Switch expression syntax
>
> - `variable switch { pattern => result, _ => default }` — returns a value directly
> - `or` pattern combines cases
> - `_` is the discard wildcard
> - Compiler warns if cases are incomplete

> [!warning] Missing _ default causes MatchFailureException
>
> Missing `_` default causes `MatchFailureException` at runtime. Keep switch arms pure — no side effects.

> [!success] Always add a wildcard arm
>
> Always close a switch expression with `_ => ...` to handle unmatched inputs gracefully. Keep arms side-effect-free and return values rather than mutating state.

```csharp
string result = command switch
{
    "start" => "Starting...",
    "stop" or "quit" or "exit" => "Stopping...",
    _ => $"Unknown: {command}"
};
Console.WriteLine(result);
```

```text
Stopping...
```

#### Switch expression — relational patterns

Switch arms support relational operators (`>=`, `<`, `>`, `<=`). First match wins — order arms from most restrictive to least. Placing `>= 70` before `>= 90` would incorrectly match 95 as "C".

```csharp
grade = score switch
{
    >= 90 => "A",
    >= 80 => "B",
    >= 70 => "C",
    >= 60 => "D",
    _ => "F"
};
Console.WriteLine($"Score {score} → Grade {grade}");
```

```text
Score 85 → Grade B
```

#### Switch expression — type patterns and when guard

> [!info] Type patterns
>
> - `int n => ...` — matches integers and binds to `n`
> - `when` adds a guard: `int n when n < 0 => ...`
> - Combines type checking and casting in one step — no explicit cast needed

```csharp
object[] values = { 42, -5, "hello", new[] { 1, 2, 3 }, 3.14 };
foreach (var v in values)
{
    string desc = v switch
    {
        int n when n > 0 => $"positive int: {n}",
        int n            => $"non-positive int: {n}",
        string s         => $"string: '{s}'",
        int[] arr        => $"array starting with {arr[0]}, {arr.Length - 1} more",
        _                => $"other: {v.GetType().Name}"
    };
    Console.WriteLine($"  {v,-12} → {desc}");
}
```

```text
  42           → positive int: 42
  -5           → non-positive int: -5
  hello        → string: 'hello'
  System.Int32[] → array starting with 1, 2 more
  3.14         → other: Double
```

#### Switch expression — property patterns ({ Property: value })

> [!info] Property patterns
>
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

```text
2024-12-25 → Christmas
```

### Null handling and pattern matching

C# provides dedicated operators for null-safe programming that eliminate verbose `if (x != null)` checks and combine type testing with variable binding in a single expression.

#### Null-coalescing (??, ??=) and is pattern matching

> [!info] Null-handling operators
>
> - `??` — returns left if non-null, else right (replaces `x != null ? x : default`)
> - `??=` — assigns only when null (one-line lazy init: `_cache ??= LoadData()`)
> - `is` pattern — extracts and casts in one step: `if (obj is string s)`
>
> > [!warning] When null is an error, throw `ArgumentNullException` instead of using `??`.

```csharp
#nullable enable

string? maybeNull = null;

string safe = maybeNull ?? "default";
Console.WriteLine(safe);

maybeNull ??= "fallback";
Console.WriteLine(maybeNull);

if (maybeNull is string notNull)
    Console.WriteLine($"Has value: {notNull}");
else
    Console.WriteLine("Is null");
```

```text
default
fallback
Has value: fallback
```

#### Logical pattern combinators — and, or, not (C# 9+)

C# 9 introduced `and`, `or`, and `not` as pattern combinators that compose with any pattern — relational, type, property, or constant. They replace verbose `&&`/`||` chains in `switch` arms and `is` expressions. `not` is especially useful for null-guard clauses: `if (obj is not null)` reads more naturally than `if (obj != null)`.

```csharp
int temperature = 22;
string comfort = temperature switch
{
    < 0 => "freezing",
    >= 0 and < 15 => "cold",
    >= 15 and <= 25 => "comfortable",
    > 25 and <= 35 => "warm",
    > 35 => "hot"
};
Console.WriteLine($"temp={temperature} → {comfort}");

object item = "hello";
if (item is not null and string s)
    Console.WriteLine($"Non-null string: {s}");
```

```text
temp=22 → comfortable
Non-null string: hello
```

#### List patterns — positional matching on collections (C# 11+)

List patterns match elements by position in arrays, lists, and spans. Use `_` for a single-element wildcard, `..` (slice pattern) for zero-or-more elements, and combine with relational or type patterns. List patterns make guard logic for sequences concise and declarative — especially useful for parsing command-line arguments, CSV rows, or protocol headers.

```csharp
int[] numbers = { 1, 2, 3, 4, 5 };
string description = numbers switch
{
    [1, 2, ..]          => "starts with 1, 2",
    [_, _, _, ..]       => "at least 3 elements",
    []                  => "empty",
    _                   => "other"
};
Console.WriteLine(description);

var cmd = new[] { "git", "commit", "-m", "fix bug" };
string action = cmd switch
{
    ["git", "commit", "-m", var msg] => $"committing: {msg}",
    ["git", "push", ..]              => "pushing",
    ["git", ..]                      => "other git command",
    _                                => "unknown"
};
Console.WriteLine(action);
```

```text
starts with 1, 2
committing: fix bug
```

## Loops

C# provides four loop constructs: `for` (index-based), `foreach` (collection iteration), `while` (condition-first), and `do-while` (body-first). Prefer `foreach` for collection traversal — it eliminates off-by-one errors and works with any `IEnumerable<T>`. Use `for` when you need the index, and `while`/`do-while` for condition-driven repetition.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    A["What drives the iteration?"] --> B["A collection"]
    A --> C["A numeric range or index"]
    A --> D["A condition"]
    A --> E["A transformation pipeline"]
    B --> F["foreach"]
    C --> G["for"]
    D --> H{"Must body run\nat least once?"}
    E --> I["LINQ .Where/.Select"]
    H -->|Yes| J["do-while"]
    H -->|No| K["while"]
    F --> L["Preferred for\nIEnumerable&lt;T&gt;"]
    G --> M["Use when index\nis needed"]
    I --> N["Lazy, composable,\nvalue-returning"]
```

### Counted and collection iteration

Index-based `for` loops give explicit control over the counter, step, and direction. `foreach` iterates any `IEnumerable<T>` without exposing the index. Both support `break` and `continue` for early exit and skip.

#### for and foreach loops

> [!info] Loop types
>
> - `for (init; condition; increment)` — runs while condition is true
> - `foreach (var item in collection)` — iterates any `IEnumerable<T>`
> - Prefer `foreach` — cleaner, no off-by-one errors

> [!warning] Don't modify a collection during foreach
>
> Don't modify a collection during `foreach` — throws `InvalidOperationException`. Use `for` loop or `ToList()` first.

> [!success] Safe modification pattern
>
> To remove or add items while iterating, snapshot the collection first with `.ToList()`, then `foreach` over the snapshot while modifying the original. For indexed removal, iterate backwards with a `for` loop.

```csharp
for (int i = 0; i < 5; i++)
    Console.Write($"  {i}");
Console.WriteLine();
```

```text
  0  1  2  3  4
```

#### for loop — custom step increment

The step expression can be any integer — `i += 3` skips by three on each iteration. Use this pattern for sampling, pagination offsets, or any non-unit stride.

```csharp
for (int i = 0; i < 20; i += 3)
    Console.Write($"  {i}");
Console.WriteLine();
```

```text
  0  3  6  9  12  15  18
```

#### Count down with for

Decrement with a negative step: `for (int i = 10; i > 0; i -= 2)`. The step can be any integer — negative for counting down, greater than 1 for skipping. Watch the condition direction: use `i > 0` (not `i < 10`) when counting down.

```csharp
for (int i = 10; i > 0; i -= 2)
    Console.Write($"  {i}");
Console.WriteLine();
```

```text
  10  8  6  4  2
```

#### Iterate a collection with foreach

`foreach` iterates any type implementing `IEnumerable<T>` — arrays, lists, dictionaries, LINQ results, and custom collections. The loop variable is read-only; you cannot reassign it inside the body. For dictionaries, the loop variable is a `KeyValuePair<TKey, TValue>` that you can deconstruct.

```csharp
var languages = new[] { "C#", "Python", "Go" };
foreach (var lang in languages)
    Console.Write($"  {lang}");
Console.WriteLine();

var scores = new Dictionary<string, int> { ["Alice"] = 92, ["Bob"] = 85 };
foreach (var (name, score) in scores)
    Console.Write($"  {name}:{score}");
Console.WriteLine();
```

```text
  C#  Python  Go
  Alice:92  Bob:85
```

#### while — condition-first loop

`while` evaluates the condition before each iteration — the body may never execute if the condition is `false` from the start. Use for input validation loops and polling where zero iterations is a valid outcome.

```csharp
int n = 3;
while (n > 0)
{
    Console.Write($"  {n}");
    n--;
}
Console.WriteLine();
```

```text
  3  2  1
```

#### do-while — body-first loop

`do-while` executes the body first, then checks the condition — guaranteeing at least one iteration. Use for retry-at-least-once logic, menu display, or input validation where the first pass must always run.

```csharp
int attempts = 0;
do
{
    attempts++;
    Console.Write($"  attempt-{attempts}");
} while (attempts < 3);
Console.WriteLine();
```

```text
  attempt-1  attempt-2  attempt-3
```

#### Enumerate with index using Select overload

C# has no built-in `enumerate` keyword. Use LINQ's `Select` overload that provides the index as a second parameter: `.Select((item, index) => ...)`.

```csharp
var fruits = new[] { "apple", "banana", "cherry" };
foreach (var (fruit, i) in fruits.Select((f, i) => (f, i)))
    Console.Write($"  {i}:{fruit}");
Console.WriteLine();
```

```text
  0:apple  1:banana  2:cherry
```

#### Parallel iteration with Zip

`Zip` pairs elements from two sequences positionally and stops at the shorter sequence. Use for lock-step iteration of parallel collections — names with ages, keys with values, expected with actual.

```csharp
var names = new[] { "Alice", "Bob", "Charlie" };
var ages = new[] { 30, 25, 35 };
foreach (var pair in names.Zip(ages))
    Console.Write($"  {pair.First}={pair.Second}");
Console.WriteLine();
```

```text
  Alice=30  Bob=25  Charlie=35
```

## Loop Control

C# provides `break` to exit a loop, `continue` to skip to the next iteration, and `goto` as a last-resort mechanism for breaking out of nested loops. For complex loop logic, extracting to a method and using `return` is usually cleaner than `goto`.

### Control keywords

Keywords that alter loop execution: `break` exits immediately, `continue` skips to the next iteration, and `goto` jumps to a labeled statement (used only for nested loop escape).

#### break — exit the innermost loop

`break` exits the innermost enclosing loop immediately. Execution continues after the loop body. Works in `for`, `foreach`, `while`, and `do-while`. For complex flow, extract to a method with `return`.

```csharp
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
```

```text
  0  1  2  3  4  Breaking at 5

```

#### continue — skip to the next iteration

`continue` skips the remainder of the current iteration and jumps to the next loop cycle. Use for filtering within a loop when a LINQ pipeline is not practical.

```csharp
for (int i = 0; i < 10; i++)
{
    if (i % 2 == 0)
        continue;
    Console.Write($"  {i}");
}
Console.WriteLine();
```

```text
  1  3  5  7  9
```

#### Breaking outer loops with goto

C# has no labeled `break`. The accepted idiom for escaping nested loops is `goto` to a label placed after the outer loop. Avoid `goto` for general flow control — it is only justified for this specific nested-break scenario.

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
```

```text
Found: True
```

#### Breaking outer loops with return

Extract nested loop logic to a method and use `return` to exit all loops at once. This is usually cleaner than `goto` and avoids the stigma of labeled jumps.

```csharp
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

```text
100
```

## Iterators & Generators

Iterator methods use `yield return` to produce values lazily — the compiler transforms them into state machines that pause between each value. This enables memory-efficient processing of large or infinite sequences, composable pipelines with LINQ, and custom traversal logic for trees and graphs.

### yield return and yield break

`yield return` pauses execution and emits one value; `yield break` terminates the iterator. The method body does not execute until the first `MoveNext()` call — not when the method is called.

#### yield return — lazy iterator method

A method returning `IEnumerable<T>` with `yield return` pauses execution, returns a value, and resumes on the next `MoveNext()`. The compiler transforms it into a state machine. Values are computed lazily — only when requested. Composable with LINQ.

> [!warning] The method body doesn't run
>
> The method body doesn't run until the first `MoveNext()` — not when the method is called.

> [!success] Validate eagerly, yield lazily
>
> Place argument validation before the first `yield` in a separate non-iterator wrapper method. This ensures validation runs immediately at call time, not deferred to first enumeration.

```csharp
IEnumerable<int> Countdown(int n)
{
    Console.WriteLine($"  Starting countdown from {n}");
    while (n > 0)
    {
        yield return n;

        n--;
    }
    Console.WriteLine("  Done!");
}

foreach (var val in Countdown(5))
    Console.Write($"  {val}");
Console.WriteLine();
```

```text
  Starting countdown from 5
  5  4  3  2  1  Done!
```

#### Manual iteration with GetEnumerator()

`GetEnumerator()` returns an `IEnumerator` with `MoveNext()` (advance + bool) and `Current` (value). `foreach` is syntactic sugar for this protocol. Use manual iteration for peeking ahead or interleaving enumerators.

```csharp
IEnumerable<int> Countdown(int n)
{
    while (n > 0) { yield return n; n--; }
}

var enumerator = Countdown(3).GetEnumerator();
enumerator.MoveNext(); Console.WriteLine($"  next: {enumerator.Current}");
enumerator.MoveNext(); Console.WriteLine($"  next: {enumerator.Current}");
enumerator.MoveNext(); Console.WriteLine($"  next: {enumerator.Current}");
```

```text
  next: 3
  next: 2
  next: 1
```

### Flattening nested structures

Flattening converts nested collections into a single flat sequence. `SelectMany` handles one level; for arbitrary depth, use a `Stack<T>`-based iterative approach or recursive iterators.

#### SelectMany — flattens one level of nesting

`SelectMany` projects each element to a sequence and flattens the results into a single sequence: `nested.SelectMany(x => x)`. It only peels one layer — it is not recursive. For deeper nesting, use the iterative or recursive approaches below.

```csharp
var oneLevel = new[] { new[] { 1, 2 }, new[] { 3, 4 }, new[] { 5, 6 } };
Console.WriteLine(string.Join(", ", oneLevel.SelectMany(x => x)));
```

```text
1, 2, 3, 4, 5, 6
```

#### Iterative flatten with Stack&lt;T&gt;

Stack-based iterative flatten — no recursion, handles arbitrary depth in constant stack space. Avoids `StackOverflowException`. Watch out for strings (they're `IEnumerable` — causes infinite recursion if not checked).

```csharp
var nested = new object[] { 1, new object[] { 2, 3 }, new object[] { 4, new object[] { 5, 6 } }, 7 };

List<int> FlattenIter(object[] input)
{
    var stack = new Stack<object>(input.Reverse());
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
Console.WriteLine(string.Join(", ", FlattenIter(nested)));
```

```text
1, 2, 3, 4, 5, 6, 7
```

#### Recursive flatten with SelectMany

The LINQ variant uses `SelectMany` with a recursive lambda — more compact but still uses the call stack. Prefer the iterative `Stack<T>` version for untrusted input depth.

```csharp
var nested = new object[] { 1, new object[] { 2, 3 }, new object[] { 4, new object[] { 5, 6 } }, 7 };

IEnumerable<int> FlatLinq(IEnumerable<object> items) =>
    items.SelectMany(item => item is object[] sub ? FlatLinq(sub) : new[] { (int)item });
Console.WriteLine(string.Join(", ", FlatLinq(nested)));
```

```text
1, 2, 3, 4, 5, 6, 7
```

#### Eager evaluation — materialize with ToList()

`ToList()` forces immediate evaluation and caches the results in a concrete `List<T>`. Use when enumerating multiple times or when downstream code expects a materialized collection. Never call `ToList()` on infinite sequences.

```csharp
var squaresList = Enumerable.Range(0, 10).Select(x => x * x).ToList();
Console.WriteLine(string.Join(", ", squaresList));
```

```text
0, 1, 4, 9, 16, 25, 36, 49, 64, 81
```

#### Lazy evaluation — deferred query re-executes on each enumeration

Without `ToList()`, the query returns an iterator that re-executes on each enumeration. The type name (`RangeSelectIterator`) reveals no values have been computed yet. Both produce identical results, but the lazy version duplicates work on repeated enumeration.

```csharp
var squaresLazy = Enumerable.Range(0, 10).Select(x => x * x);
Console.WriteLine(squaresLazy.GetType().Name);
Console.WriteLine(string.Join(", ", squaresLazy));
```

```text
RangeSelectIterator`2
0, 1, 4, 9, 16, 25, 36, 49, 64, 81
```

#### yield break — early termination

`yield break` terminates the iterator immediately — no more values produced. Equivalent to `return` in a regular method. Use for custom take-while logic or error boundaries. For simple filtering, `.TakeWhile()` is shorter.

```csharp
IEnumerable<int> TakeWhilePositive(int[] arr)
{
    foreach (var n in arr)
    {
        if (n < 0) yield break;
        yield return n;
    }
}
Console.WriteLine(string.Join(", ", TakeWhilePositive(new[] { 3, 7, -2, 5 })));
```

```text
3, 7
```

#### Recursive iterator — flatten a deeply nested structure with yield return

Recursive iterator — calls itself for nested collections, `yield return` for leaves. Natural for tree/graph traversal. For untrusted/deep nesting, use the Stack approach to avoid `StackOverflowException`.

```csharp
IEnumerable<int> Flatten(IEnumerable<object> nested)
{
    foreach (var item in nested)
    {
        if (item is IEnumerable<object> sub)
            foreach (var inner in Flatten(sub))
                yield return inner;
        else if (item is int n)
            yield return n;
    }
}
var nestedArr = new object[] { 1, new object[] { 2, 3 }, new object[] { 4, new object[] { 5, 6 } }, 7 };
Console.WriteLine(string.Join(", ", Flatten(nestedArr)));
```

```text
1, 2, 3, 4, 5, 6, 7
```

## LINQ & Functional Equivalents

LINQ (Language Integrated Query) replaces imperative `foreach`/`if`/`Add` patterns with declarative pipelines. All LINQ methods are lazy — nothing executes until the result is enumerated (`foreach`, `ToList()`, `ToArray()`). Method syntax (`.Where().Select()`) and query syntax (`from x in items where ... select ...`) compile to identical IL.

### Core LINQ methods

The foundational LINQ operations: `Select` (map), `Where` (filter), `SelectMany` (flat-map), and query syntax as an alternative notation.

#### Select — transform each element (map)

`Select` projects each element into a new form — equivalent to `map` in functional languages. All LINQ methods are lazy and return `IEnumerable<T>`.

> [!warning] Don't use foreach with if
>
> Don't use `foreach` with `if` + add to list — use `.Where().Select()`. Don't enumerate a deferred query multiple times — materialize with `ToList()`.

> [!success] Prefer LINQ pipelines
>
> Replace manual `foreach`/`if`/`Add` patterns with `.Where().Select()` chains. Call `.ToList()` once at the end to materialize, then reuse the list freely without re-executing the query.

```csharp
var squares = Enumerable.Range(0, 10).Select(x => x * x).ToList();
Console.WriteLine(string.Join(", ", squares));
```

```text
0, 1, 4, 9, 16, 25, 36, 49, 64, 81
```

#### Where — filter elements by predicate

`Where` returns only elements satisfying the predicate — equivalent to `filter`. Chain with `Select` for filter-then-transform pipelines.

```csharp
var evens = Enumerable.Range(0, 20).Where(x => x % 2 == 0).ToList();
Console.WriteLine(string.Join(", ", evens));
```

```text
0, 2, 4, 6, 8, 10, 12, 14, 16, 18
```

#### Chaining Where and Select

Chain `.Where().Select()` fluently for filter-then-transform pipelines. The order matters — filtering first reduces the number of elements transformed.

```csharp
var words = new[] { "hello", "world", "csharp", "is", "great" };
var longUpper = words.Where(w => w.Length > 3).Select(w => w.ToUpper());
Console.WriteLine(string.Join(", ", longUpper));
```

```text
HELLO, WORLD, CSHARP, GREAT
```

#### SelectMany — flatten nested sequences

`SelectMany` projects each element to a sequence and flattens the results into a single `IEnumerable<T>`. It only peels one layer of nesting.

```csharp
var matrix = new[] { new[] { 1, 2, 3 }, new[] { 4, 5, 6 }, new[] { 7, 8, 9 } };
var flat = matrix.SelectMany(row => row).ToList();
Console.WriteLine(string.Join(", ", flat));
```

```text
1, 2, 3, 4, 5, 6, 7, 8, 9
```

#### Query syntax vs method syntax

Query syntax (`from x in items where ... select ...`) reads like SQL. Method syntax (`.Where().Select()`) uses lambda chains. Both compile to identical IL. Use query syntax for complex joins; method syntax for simple pipelines.

```csharp
var words = new[] { "hello", "world", "csharp", "is", "great" };

var queryResult = from w in words
                  where w.Length > 3
                  orderby w.Length
                  select w.ToUpper();
Console.WriteLine(string.Join(", ", queryResult));

var methodResult = words.Where(w => w.Length > 3).OrderBy(w => w.Length).Select(w => w.ToUpper());
Console.WriteLine(string.Join(", ", methodResult));
```

```text
HELLO, WORLD, GREAT, CSHARP
HELLO, WORLD, GREAT, CSHARP
```

### Materialization and aggregation

Materialization converts lazy LINQ queries into concrete collections (`Dictionary`, `HashSet`, `List`). Aggregation reduces a sequence to a single value (`Sum`, `Count`, `Aggregate`).

#### ToDictionary and ToHashSet

> [!info] Materialization
>
> - `ToDictionary(keySelector, valueSelector)` — builds a `Dictionary` (O(1) lookup)
> - `ToHashSet()` — builds a `HashSet` (O(1) membership)
> - Both are eager — enumerate immediately
>
> > [!warning] Duplicate keys in `ToDictionary` throw `ArgumentException`.

```csharp
var squaresDict = Enumerable.Range(0, 6).ToDictionary(x => x, x => x * x);
Console.WriteLine(string.Join(", ", squaresDict.Select(kv => $"{kv.Key}:{kv.Value}")));

var scores = new Dictionary<string, int> { ["Alice"] = 85, ["Bob"] = 92, ["Charlie"] = 78, ["Diana"] = 95 };
var passed = scores.Where(kv => kv.Value >= 80).ToDictionary(kv => kv.Key, kv => kv.Value);
Console.WriteLine(string.Join(", ", passed.Select(kv => $"{kv.Key}:{kv.Value}")));

var words = new[] { "hello", "world", "csharp", "is", "great" };
var uniqueLengths = words.Select(w => w.Length).ToHashSet();
Console.WriteLine(string.Join(", ", uniqueLengths));
```

`Where` on a dictionary yields `KeyValuePair<K,V>` — re-materialize with `ToDictionary`. `ToHashSet` builds a deduplicated `HashSet<T>` with O(1) membership testing.

```text
0:0, 1:1, 2:4, 3:9, 4:16, 5:25
Alice:85, Bob:92, Diana:95
5, 6, 2
```

#### Aggregate — general-purpose fold

`Aggregate(seed, (acc, x) => ...)` is the general fold — reduces a sequence to a single value by applying an accumulator function. The seed is the initial value. Use for custom reductions that built-in methods don't cover.

```csharp
var nums = new[] { 1, 2, 3, 4, 5 };
int total = nums.Aggregate(0, (acc, x) => acc + x);
Console.WriteLine(total);

int product = nums.Aggregate(1, (acc, x) => acc * x);
Console.WriteLine(product);
```

```text
15
120
```

#### Built-in aggregations — Sum, Max, Min, Any, All, Count, Average

Built-in shortcuts for common reductions. `Any(predicate)` short-circuits on first match — always prefer `Any()` over `Count() > 0`. `All(predicate)` returns `true` for empty sequences.

```csharp
var nums = new[] { 1, 2, 3, 4, 5 };
Console.WriteLine(nums.Sum());
Console.WriteLine(nums.Max());
Console.WriteLine(nums.Min());
Console.WriteLine(nums.All(x => x > 0));
Console.WriteLine(nums.Any(x => x > 3));
Console.WriteLine(nums.Count(x => x > 2));
Console.WriteLine(nums.Average());
```

```text
15
5
1
True
True
3
3
```

### Ordering and deferred execution

Sorting, chaining, and controlling when a LINQ pipeline actually executes.

#### Ordering — OrderBy, OrderByDescending with a key selector

> [!info] Ordering
>
> - `OrderBy(x => x.Property)` — sorts ascending
> - `OrderByDescending` — sorts descending
> - `ThenBy` / `ThenByDescending` — secondary sort
> - Stable sort — equal elements maintain relative order
>
> > [!warning] Don't chain two `OrderBy` calls — the second replaces the first. Use `ThenBy` for secondary sort.

```csharp
var names = new[] { "Charlie", "Alice", "Bob", "Diana" };
Console.WriteLine(string.Join(", ", names.OrderBy(n => n)));
Console.WriteLine(string.Join(", ", names.OrderBy(n => n.Length)));
Console.WriteLine(string.Join(", ", names.OrderByDescending(n => n)));
Console.WriteLine(string.Join(", ", names.OrderBy(n => n[^1])));
```

```text
Alice, Bob, Charlie, Diana
Bob, Alice, Diana, Charlie
Diana, Charlie, Bob, Alice
Diana, Bob, Charlie, Alice
```

#### Deferred execution — chained LINQ pipeline materialized by ToList()

> [!info] Deferred execution
>
> - Each LINQ method returns a lazy `IEnumerable`
> - Chain declaratively: `.Where().Select().OrderBy().Take()`
> - Nothing executes until `foreach` or `ToList()`
> - Add conditions dynamically: `if (filter) query = query.Where(...)`
>
> > [!warning] Don't enumerate the same deferred query multiple times — it duplicates work. Materialize with `ToList()` if you need multiple passes.

```csharp
var result = Enumerable.Range(1, 20)
    .Where(x => x % 2 == 0)
    .Select(x => x * x)
    .Where(x => x > 50)
    .OrderByDescending(x => x)
    .Take(3)
    .ToList();
Console.WriteLine(string.Join(", ", result));
```

```text
400, 324, 256
```

#### Infinite generator with yield return

`while(true)` with `yield return` produces an infinite sequence. Callers control consumption with `Take()`, `First()`, or `TakeWhile()`.

> [!danger] Infinite sequences cause OOM
>
> Never call `ToList()`, `Count()`, or `foreach` without `break` on infinite sequences — hangs or OOM.

> [!success] Always bound infinite sequences
>
> Always pair an infinite generator with `Take(n)`, `TakeWhile(...)`, or `First(...)` before materializing. This keeps memory bounded and gives callers explicit control over how many values are consumed.

```csharp
IEnumerable<int> Naturals(int start = 0)
{
    while (true)
    {
        yield return start;
        start++;
    }
}
Console.WriteLine(string.Join(", ", Naturals().Take(5)));
Console.WriteLine(string.Join(", ", Naturals(10).Take(5)));
```

```text
0, 1, 2, 3, 4
10, 11, 12, 13, 14
```

#### Common sequence methods — Range, Reverse, Concat, Repeat

`Range` generates consecutive integers, `Reverse` reverses order, `Concat` appends sequences, and `Repeat` produces a single value `n` times. All return lazy `IEnumerable<T>`.

```csharp
Console.WriteLine(string.Join(", ", Enumerable.Range(0, 5)));
Console.WriteLine(string.Join(", ", new[] { "a", "b" }.Select(s => s.ToUpper())));
Console.WriteLine(string.Join(", ", new[] { 1, 2, 3, 4 }.Where(x => x > 2)));
Console.WriteLine(string.Join(", ", new[] { 1, 2, 3 }.Reverse()));
Console.WriteLine(string.Join(", ", new[] { 1, 2 }.Concat(new[] { 3, 4 })));
Console.WriteLine(string.Join(", ", Enumerable.Repeat("x", 3)));
```

```text
0, 1, 2, 3, 4
A, B
3, 4
3, 2, 1
1, 2, 3, 4
x, x, x
```

## When to Use

- **Type-safe branching** — C#'s pattern matching in `switch` expressions provides exhaustive, compiler-verified dispatch on types, properties, and values — catching missing cases at compile time.
- **Performance-critical loops** — C# `for`/`foreach` loops are 10–100x faster than Python loops for CPU-bound work, with no GIL limitation for parallel execution.
- **Complex state machines** — `switch` with pattern matching and `when` guards cleanly expresses multi-dimensional branching that would be unwieldy in Python's `if/elif` chains.
- **LINQ pipelines** — declarative, composable, and lazy data transformation with full IDE support and type inference.

## When Not to Use / Limits

- **Ad-hoc data exploration** — C#'s ceremony makes quick iteration slower than Python's comprehensions and REPL. Prototype logic in Python, then port.
- **Dynamic dispatch on unknown types** — pattern matching requires known types at compile time. For truly dynamic data, consider `dynamic` or dictionary-based dispatch.
- **No `for...else` equivalent** — C# has no equivalent of Python's `for...else` for "not found" detection. Use a flag variable or LINQ `Any()`/`FirstOrDefault()`.
- **LINQ overhead for simple loops** — LINQ adds allocation and virtual dispatch overhead. For tight loops processing millions of items, a plain `for` loop with manual accumulation is faster.

## Warnings

> [!warning] Collection modified during foreach
>
> Adding or removing items from a collection during `foreach` throws `InvalidOperationException`.

> [!success] Correct pattern
>
> Iterate over a copy (`foreach (var x in items.ToList())`) or collect indices to remove and process after the loop.

> [!warning] Switch expression without discard pattern
>
> If no `_` discard is provided and no pattern matches, `SwitchExpressionException` is thrown at runtime.

> [!success] Correct pattern
>
> Always include a `_ => defaultValue` or `_ => throw new ArgumentException(...)` arm for exhaustiveness.

> [!warning] Multiple LINQ enumeration
>
> Enumerating an `IEnumerable<T>` backed by a database query or file read executes the source operation each time.

> [!success] Correct pattern
>
> Materialize with `.ToList()` or `.ToArray()` before iterating multiple times: `var data = query.ToList();`.

## Recommendations

- **Use `switch` expressions** over `switch` statements for value-producing branches — more concise and the compiler checks exhaustiveness.
- **Use pattern matching in `if`** — `if (obj is string s && s.Length > 0)` combines type check, cast, and condition in one expression.
- **Use `foreach` over `for`** when you don't need the index — clearer intent and works with any `IEnumerable<T>`.
- **Use LINQ for declarative pipelines** — `items.Where(...).Select(...).ToList()` is more readable than manual `for` + `if` + `add`.
- **Materialize LINQ once** — call `.ToList()` after composing the query, before iterating multiple times.
- **Use `yield return` for lazy sequences** — produces values on demand without allocating the full collection upfront.
- **Use `Parallel.For` / `Parallel.ForEach`** for CPU-bound parallel iteration — no GIL limitation unlike Python.
- **Always add `_` discard** to switch expressions to prevent runtime `SwitchExpressionException`.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `CS0029: Cannot implicitly convert type` in condition | Used non-bool expression in `if` (no truthy/falsy) | Use explicit comparison: `if (x != 0)` not `if (x)` |
| `InvalidOperationException` during foreach | Modified collection while iterating | Iterate over `.ToList()` copy or collect changes for post-loop |
| `SwitchExpressionException` at runtime | No pattern matched and no `_` discard arm | Add `_ => throw` or `_ => default` arm |
| Iterator method returns wrong type | Used `return` instead of `yield return` | Use `yield return value;` and `yield break;` in iterator methods |
| LINQ query executes twice | `IEnumerable<T>` re-evaluated on each enumeration | Materialize with `.ToList()` before multiple iterations |
| `goto` causes spaghetti code | Overuse of `goto` for control flow | Refactor to method extraction, `break` with flag, or LINQ |
| `break` only exits one loop level | `break` is scoped to the innermost loop | Use `goto`, extract to method with `return`, or use a flag |
| `NullReferenceException` in null-coalescing chain | Intermediate object is null before `?.` applied | Chain null-conditional: `a?.B?.C ?? default` |
| Pattern matching variable shadows outer | `is` pattern introduces same-named variable | Rename the pattern variable or the outer variable |
| LINQ performance worse than loop | Virtual dispatch and allocation overhead in tight loops | Use plain `for` loop for hot paths processing millions of items |

