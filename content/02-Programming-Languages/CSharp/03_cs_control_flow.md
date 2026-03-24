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

## 1. Conditional Statements


```csharp
#nullable enable 

// if / else if / else — C# uses braces {}, parentheses required around condition
//
// KEY CONCEPTS:
// - Conditional chain: a sequence of if/else if/else that checks conditions top-to-bottom.
//   The FIRST matching condition wins — all subsequent branches are skipped.
// - Precedence ordering (most restrictive first): when comparing ranges (>=90, >=80, >=70),
//   you MUST put the highest/most specific threshold first. If you put >=60 first,
//   it would catch everything including scores of 90+, and later branches would never run.
// - Ternary expression: a one-line conditional that returns a value: `cond ? x : y`
//   (Python uses `x if cond else y` — same concept, reversed syntax)
// - No truthy/falsy: C# requires conditions to be explicit bool expressions.
//   You can't write `if (items)` — must write `if (items.Count > 0)`.
// - No chained comparisons: must use `&&` explicitly: `10 < x && x < 20`

// === Basic if/else if/else ===
Console.WriteLine("=== if / else if / else ===");
int score = 85;
string grade;

// Most restrictive first! >=90 before >=80 before >=70
if (score >= 90)
    grade = "A";
else if (score >= 80)      // only reached if score < 90
    grade = "B";
else if (score >= 70)      // only reached if score < 80
    grade = "C";
else if (score >= 60)
    grade = "D";
else                       // catches everything else (< 60)
    grade = "F";
Console.WriteLine($"Score {score} → Grade {grade}");

// Single statement: braces optional (but recommended)
// Multi-statement: braces REQUIRED
int x = 10;
if (x > 0)
    Console.WriteLine($"{x} is positive");     // OK without braces (single line)

// === Ternary expression ===
Console.WriteLine("\n=== Ternary Expression ===");
int age = 20;
string status = age >= 18 ? "adult" : "minor";
Console.WriteLine($"age={age} → {status}");

// Nested ternary
int val = 15;
string label = val > 20 ? "high" : val > 10 ? "mid" : "low";
Console.WriteLine($"val={val} → {label}");

// === No truthy/falsy — must be explicit bool ===
Console.WriteLine("\n=== No Truthy/Falsy (must be explicit) ===");
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

// === No chained comparisons — use && ===
Console.WriteLine("\n=== Chained Conditions (use &&) ===");
x = 15;
// if (10 < x < 20)  // Compile error! No chaining in C#
if (10 < x && x < 20)
    Console.WriteLine($"{x} is between 10 and 20");

// === switch statement (traditional) ===
// Switch: tests one value against multiple cases. Unlike if/else chains, switch
// only works with discrete values (not ranges in the statement form).
// - break is REQUIRED after each case (no implicit fall-through like C/C++)
// - Fall-through: only allowed for EMPTY cases (multiple cases sharing same body)
// - default: the catch-all case (like Python's _ or else)

Console.WriteLine("\n=== switch statement ===");
string command = "quit";
switch (command)
{
    case "start":
        Console.WriteLine("Starting...");
        break;                              // break is REQUIRED
    case "stop":                            // no code, falls to next
    case "quit":                            // no code, falls to next
    case "exit":                            // fall-through: only for empty cases
        Console.WriteLine("Stopping...");
        break;
    default:
        Console.WriteLine($"Unknown: {command}");
        break;
}

// === switch expression (C# 8+) — more concise, returns a value ===
// Switch expression: a compact form that returns a value (like Python's match/case).
// - Uses => instead of case/break
// - 'or' pattern: match multiple values
// - '_' wildcard: default case (same as Python's _)
// - Relational patterns: >=, <=, >, < directly in cases
// - Type patterns: match by type and bind to a variable
// - Property patterns: match by object properties (C# exclusive)
// - Guard (when): additional condition on a pattern

Console.WriteLine("\n=== switch expression ===");
string result = command switch
{
    "start" => "Starting...",
    "stop" or "quit" or "exit" => "Stopping...",   // 'or' pattern
    _ => $"Unknown: {command}"                       // _ is wildcard default
};
Console.WriteLine(result);

// switch with relational patterns (>=, <, etc.)
grade = score switch
{
    >= 90 => "A",          // first match wins — most restrictive first
    >= 80 => "B",
    >= 70 => "C",
    >= 60 => "D",
    _ => "F"
};
Console.WriteLine($"Score {score} → Grade {grade}");

// switch with type patterns — match by type and bind to a variable
Console.WriteLine("\n=== switch with Type Patterns ===");
object[] values = { 42, -5, "hello", new[] { 1, 2, 3 }, 3.14 };
foreach (var v in values)
{
    string desc = v switch
    {
        int n when n > 0 => $"positive int: {n}",     // type + guard (when)
        int n => $"non-positive int: {n}",             // type only
        string s => $"string: '{s}'",
        int[] arr => $"array starting with {arr[0]}, {arr.Length - 1} more",
        _ => $"other: {v.GetType().Name}"
    };
    Console.WriteLine($"  {v,-12} → {desc}");
}

// === Property patterns (C# only) ===
// Property pattern: match an object by its property values.
// Syntax: { PropertyName: value } — checks if the property equals the value.
Console.WriteLine("\n=== Property Patterns (C# only) ===");
var date = new DateTime(2024, 12, 25);
string holiday = date switch
{
    { Month: 12, Day: 25 } => "Christmas",
    { Month: 1, Day: 1 } => "New Year",
    { DayOfWeek: DayOfWeek.Saturday or DayOfWeek.Sunday } => "Weekend",
    _ => "Regular day"
};
Console.WriteLine($"{date:yyyy-MM-dd} → {holiday}");

// === Null checks ===
// Null-coalescing (??): returns the left side if not null, otherwise the right side.
// Null-coalescing assignment (??=): assigns the right side ONLY if the left is null.
// Pattern matching (is): tests type AND extracts value in one expression.
Console.WriteLine("\n=== Null Checking Patterns ===");
string? maybeNull = null;
// Pattern matching — tests and extracts in one step
if (maybeNull is string notNull)
    Console.WriteLine($"Has value: {notNull}");
else
    Console.WriteLine("Is null");

// Null-coalescing
string safe = maybeNull ?? "default";
Console.WriteLine($"?? operator: {safe}");

// Null-coalescing assignment
maybeNull ??= "fallback";
Console.WriteLine($"??= operator: {maybeNull}");
```

    === if / else if / else ===
    Score 85 → Grade B
    10 is positive
    
    === Ternary Expression ===
    age=20 → adult
    val=15 → mid
    
    === No Truthy/Falsy (must be explicit) ===
    List has 3 items
    Name is empty
    Value is null
    
    === Chained Conditions (use &&) ===
    15 is between 10 and 20
    
    === switch statement ===
    Stopping...
    
    === switch expression ===
    Stopping...
    Score 85 → Grade B
    
    === switch with Type Patterns ===
      42           → positive int: 42
      -5           → non-positive int: -5
      hello        → string: 'hello'
      System.Int32[] → array starting with 1, 2 more
      3.14         → other: Double
    
    === Property Patterns (C# only) ===
    2024-12-25 → Christmas
    
    === Null Checking Patterns ===
    Is null
    ?? operator: default
    ??= operator: fallback
    

## 2. Loops


```csharp
// Loops — for, foreach, while, do-while
// C# has all 4 loop types + LINQ alternatives
//
// KEY CONCEPTS:
// - IEnumerable<T>: C#'s "iterable" interface. Any object that implements it can be
//   used in foreach. Equivalent to Python's __iter__() protocol.
// - for loop: traditional C-style loop with (init; condition; increment). Python has no equivalent.
// - foreach: iterates over any IEnumerable (like Python's for...in).
// - do-while: runs the body at least once BEFORE checking the condition.
//   Python doesn't have this — must use `while True: ... if cond: break`.
// - No for/else: C# has no equivalent. Use a bool flag to detect if break was hit.
// - No enumerate(): use .Select((item, index) => ...) or a plain for loop with index.
// - .Zip(): like Python's zip() — iterates two sequences in parallel.

// === for loop (traditional C-style) ===
Console.WriteLine("=== for loop ===");
for (int i = 0; i < 5; i++)        // (init; condition; increment)
    Console.Write($"  {i}");
Console.WriteLine();

// Step by 3
Console.Write("Step 3: ");
for (int i = 0; i < 20; i += 3)
    Console.Write($"  {i}");
Console.WriteLine();

// Count down
Console.Write("Down:   ");
for (int i = 10; i > 0; i -= 2)
    Console.Write($"  {i}");
Console.WriteLine();

// === foreach — iterates over any IEnumerable ===
Console.WriteLine("\n=== foreach ===");
foreach (var fruit in new[] { "apple", "banana", "cherry" })
    Console.WriteLine($"  {fruit}");

// Over a string
Console.Write("\nOver string: ");
foreach (char ch in "Hello")
    Console.Write($"'{ch}' ");
Console.WriteLine();

// Over a dictionary
Console.WriteLine("\nOver dict:");
var d = new Dictionary<string, object> { ["name"] = "Alice", ["age"] = 30, ["city"] = "NYC" };
foreach (var kvp in d)                  // KeyValuePair
    Console.WriteLine($"  {kvp.Key} = {kvp.Value}");

foreach (var (key, value) in d)         // deconstruct (C# 7+)
    Console.WriteLine($"  {key}: {value}");

// enumerate equivalent — Select with index (or just use for loop)
Console.WriteLine("\nenumerate (LINQ):");
foreach (var (fruit, i) in new[] { "apple", "banana", "cherry" }.Select((f, i) => (f, i)))
    Console.WriteLine($"  [{i}] {fruit}");

// Simpler: plain for loop when you need an index
var fruits = new[] { "apple", "banana", "cherry" };
Console.WriteLine("enumerate (for loop):");
for (int i = 0; i < fruits.Length; i++)
    Console.WriteLine($"  [{i}] {fruits[i]}");

// Zip — iterate multiple sequences in parallel
Console.WriteLine("\nZip:");
var names = new[] { "Alice", "Bob", "Charlie" };
var ages = new[] { 30, 25, 35 };
foreach (var (name, age) in names.Zip(ages))
    Console.WriteLine($"  {name} is {age}");

// === while loop ===
Console.WriteLine("\n=== while loop ===");
int count = 0;
while (count < 5)
{
    Console.WriteLine($"  count = {count}");
    count++;
}

// === do-while loop (C# only — Python doesn't have this) ===
// Guarantees the body runs at least once before checking the condition.
Console.WriteLine("\n=== do-while (C# only!) ===");
int val = 42;
do
{
    Console.WriteLine($"  Got value: {val}");
} while (val < 0);   // condition is false, but body already ran once

// === No for/else in C# — use a flag ===
Console.WriteLine("\n=== for/else workaround ===");
bool found = false;
foreach (var n in new[] { 2, 4, 6, 8 })
{
    if (n % 3 == 0)
    {
        Console.WriteLine($"  Found multiple of 3: {n}");
        found = true;
        break;
    }
}
if (!found)
    Console.WriteLine("  No multiple of 3 found");

// === Nested loops ===
Console.WriteLine("\n=== Nested Loops ===");
for (int i = 0; i < 3; i++)
{
    for (int j = 0; j < 3; j++)
        Console.Write($"  ({i},{j})");
    Console.WriteLine();
}
```

    === for loop ===
      0  1  2  3  4
    Step 3:   0  3  6  9  12  15  18
    Down:     10  8  6  4  2
    
    === foreach ===
      apple
      banana
      cherry
    
    Over string: 'H' 'e' 'l' 'l' 'o' 
    
    Over dict:
      name = Alice
      age = 30
      city = NYC
      name: Alice
      age: 30
      city: NYC
    
    enumerate (LINQ):
      [0] apple
      [1] banana
      [2] cherry
    enumerate (for loop):
      [0] apple
      [1] banana
      [2] cherry
    
    Zip:
      Alice is 30
      Bob is 25
      Charlie is 35
    
    === while loop ===
      count = 0
      count = 1
      count = 2
      count = 3
      count = 4
    
    === do-while (C# only!) ===
      Got value: 42
    
    === for/else workaround ===
      Found multiple of 3: 6
    
    === Nested Loops ===
      (0,0)  (0,1)  (0,2)
      (1,0)  (1,1)  (1,2)
      (2,0)  (2,1)  (2,2)
    

## 3. Loop Control (break, continue, goto, return)


```csharp
// Loop Control — break, continue

// === break — exit loop immediately ===
Console.WriteLine("=== break ===");
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

// === continue — skip to next iteration ===
Console.WriteLine("\n=== continue ===");
for (int i = 0; i < 10; i++)
{
    if (i % 2 == 0)
        continue;           // skip even numbers
    Console.Write($"  {i}");
}
Console.WriteLine();

// === No 'pass' in C# — use empty block or comment ===
Console.WriteLine("\n=== No pass — use {} or comment ===");
for (int i = 0; i < 5; i++)
{
    if (i == 3)
    {
        // TODO: handle this case later
    }
    else
    {
        Console.Write($"  {i}");
    }
}
Console.WriteLine();

// === break in nested loops — only breaks innermost ===
Console.WriteLine("\n=== break in nested loops ===");
for (int i = 0; i < 3; i++)
{
    for (int j = 0; j < 3; j++)
    {
        if (j == 2)
            break;          // only breaks inner loop
        Console.Write($"  ({i},{j})");
    }
    Console.WriteLine();
}
```

    === break ===
      0  1  2  3  4  Breaking at 5
    
    
    === continue ===
      1  3  5  7  9
    
    === No pass — use {} or comment ===
      0  1  2  4
    
    === break in nested loops ===
      (0,0)  (0,1)
      (1,0)  (1,1)
      (2,0)  (2,1)
    


```csharp
// === goto — break outer loop (C# has this, Python doesn't!) ===
// Note: goto + local functions can't coexist in .NET Interactive cells
Console.WriteLine("=== goto to break outer loop (C# only!) ===");
for (int i = 0; i < 3; i++)
{
    for (int j = 0; j < 3; j++)
    {
        if (i == 1 && j == 1)
        {
            Console.WriteLine($"  Broke at ({i},{j})");
            goto FoundIt;    // jumps to label, exits BOTH loops
        }
    }
}
FoundIt:                     // label
Console.WriteLine("  (after goto label)");
```

    === goto to break outer loop (C# only!) ===
      Broke at (1,1)
      (after goto label)
    


```csharp
// === Break outer loop: function + return (same as Python) ===
Console.WriteLine("=== Function + return to break outer loop ===");
(int x, int y) FindPair()
{
    for (int i = 0; i < 3; i++)
        for (int j = 0; j < 3; j++)
            if (i == 1 && j == 1)
                return (i, j);
    return (-1, -1);
}
Console.WriteLine($"  Found: {FindPair()}");

// === return — exit entire method from inside a loop ===
Console.WriteLine("\n=== return from loop (inside method) ===");
int FirstNegative(int[] arr)
{
    foreach (var n in arr)
        if (n < 0) return n;
    return 0;
}
Console.WriteLine($"  First negative: {FirstNegative(new[] { 3, 7, -2, 5 })}");

// === Key Differences ===
Console.WriteLine("\n=== Key Differences ===");
Console.WriteLine("Python: pass         → C#: {} or // comment");
Console.WriteLine("Python: for/else     → C#: use a bool flag");
Console.WriteLine("Python: no goto      → C#: goto (break outer loops)");
Console.WriteLine("Python: walrus :=    → C#: no equivalent (use separate assignment)");
```

    === Function + return to break outer loop ===
      Found: (1, 1)
    
    === return from loop (inside method) ===
      First negative: -2
    
    === Key Differences ===
    Python: pass         → C#: {} or // comment
    Python: for/else     → C#: use a bool flag
    Python: no goto      → C#: goto (break outer loops)
    Python: walrus :=    → C#: no equivalent (use separate assignment)
    

## 4. Iterators & Generators (yield)


```csharp
// Iterators & Generators — lazy evaluation with yield return
//
// KEY CONCEPTS:
// - yield return: pauses the method, returns a value, and resumes on the next iteration.
//   C# uses TWO words (yield return) vs Python's single 'yield'.
// - yield break: stops the iterator early (equivalent to Python's StopIteration).
// - IEnumerable<T>: the return type for iterator methods. Represents a lazy sequence.
// - Lazy evaluation: values are computed only when requested (during foreach/LINQ).
//   LINQ chains (.Where().Select()) are lazy by default — nothing executes until
//   you iterate (foreach) or materialize (.ToList(), .ToArray()).
// - Eager evaluation: computing all values upfront. .ToList() forces eager evaluation.
// - Iterator method: any method with yield return. The compiler transforms it into
//   a state machine that tracks where execution paused.
// - No generator expressions: C# uses LINQ instead (which is also lazy by default).
// - No yield from: C# has no shortcut — must foreach + yield return manually.

// === Iterator method (uses yield return) ===
Console.WriteLine("=== Iterator Method ===");
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

// === Manual iteration with GetEnumerator ===
// GetEnumerator() + MoveNext() + Current = C#'s version of Python's iter() + next()
Console.WriteLine("\n=== Manual Iteration ===");
var enumerator = Countdown(3).GetEnumerator();
enumerator.MoveNext(); Console.WriteLine($"  next: {enumerator.Current}");  // 3
enumerator.MoveNext(); Console.WriteLine($"  next: {enumerator.Current}");  // 2
enumerator.MoveNext(); Console.WriteLine($"  next: {enumerator.Current}");  // 1

// === LINQ is lazy (like Python generators) ===
Console.WriteLine("\n=== LINQ is Lazy (like Python generators) ===");
// Eager: .ToList() / .ToArray() — computes everything NOW, stores in memory
var squaresList = Enumerable.Range(0, 10).Select(x => x * x).ToList();
Console.WriteLine($"Eager list: [{string.Join(", ", squaresList)}]");

// Lazy: without .ToList() — values computed on demand during iteration
var squaresLazy = Enumerable.Range(0, 10).Select(x => x * x);
Console.WriteLine($"Lazy type:  {squaresLazy.GetType().Name}");
Console.WriteLine($"As list:    [{string.Join(", ", squaresLazy)}]");

// === yield break — stop the iterator early ===
Console.WriteLine("\n=== yield break (stop early) ===");
IEnumerable<int> TakeWhilePositive(int[] arr)
{
    foreach (var n in arr)
    {
        if (n < 0) yield break;   // stops the iterator (like StopIteration)
        yield return n;
    }
}
Console.WriteLine($"TakeWhile: [{string.Join(", ", TakeWhilePositive(new[] { 3, 7, -2, 5 }))}]");

// === Recursive yield (like Python's yield from) ===
// C# has no 'yield from' shortcut — must foreach + yield return manually
Console.WriteLine("\n=== Recursive yield (like yield from) ===");
// Recursive iterator that flattens a nested structure into a flat sequence of ints.
// Example input:  [1, [2, 3], [4, [5, 6]], 7]
// Example output: [1, 2, 3, 4, 5, 6, 7]
IEnumerable<int> Flatten(IEnumerable<object> nested)  // returns a lazy sequence of ints
{
    foreach (var item in nested)          // iterate each element in the collection
    {
        if (item is IEnumerable<object> sub)  // is this element itself a collection? (type pattern)
            foreach (var inner in Flatten(sub))  // YES → recursively flatten the sub-collection
                yield return inner;              // yield each value from the recursive call one by one
                                                 // (this is C#'s manual version of Python's "yield from")
        else if (item is int n)           // is this element an int? (type pattern, bind to n)
            yield return n;               // YES → yield it directly to the caller
        // if item is neither a collection nor an int, it's silently skipped
    }
}
var nestedArr = new object[] { 1, new object[] { 2, 3 }, new object[] { 4, new object[] { 5, 6 } }, 7 };
Console.WriteLine($"Flatten: [{string.Join(", ", Flatten(nestedArr))}]");

// === Infinite iterators ===
Console.WriteLine("\n=== Infinite Iterator ===");
IEnumerable<int> Naturals(int start = 0)
{
    while (true)          // never ends — relies on caller to stop (Take, First, etc.)
    {
        yield return start;  // parameters are local copies, safe to mutate
        start++;
    }
}
Console.WriteLine($"First 5 naturals: [{string.Join(", ", Naturals().Take(5))}]");
Console.WriteLine($"From 10:          [{string.Join(", ", Naturals(10).Take(5))}]");

// === Common LINQ equivalents of Python iterators ===
Console.WriteLine("\n=== LINQ Iterator Methods ===");
Console.WriteLine($"Range:          [{string.Join(", ", Enumerable.Range(0, 5))}]");          // range()
Console.WriteLine($"Select (map):   [{string.Join(", ", new[] { "a", "b" }.Select(s => s.ToUpper()))}]");  // map()
Console.WriteLine($"Where (filter): [{string.Join(", ", new[] { 1, 2, 3, 4 }.Where(x => x > 2))}]");      // filter()
Console.WriteLine($"Reverse:        [{string.Join(", ", new[] { 1, 2, 3 }.Reverse())}]");     // reversed()
Console.WriteLine($"Concat (chain): [{string.Join(", ", new[] { 1, 2 }.Concat(new[] { 3, 4 }))}]");  // chain()
Console.WriteLine($"Repeat:         [{string.Join(", ", Enumerable.Repeat("x", 3))}]");       // repeat()

// === Key Differences ===
Console.WriteLine("\n=== Key Differences ===");
Console.WriteLine("Python: yield           → C#: yield return");
Console.WriteLine("Python: yield from      → C#: foreach + yield return (no shortcut)");
Console.WriteLine("Python: StopIteration   → C#: yield break");
Console.WriteLine("Python: gen expression  → C#: LINQ (lazy by default)");
Console.WriteLine("Python: next(gen)       → C#: enumerator.MoveNext() + .Current");
Console.WriteLine("Python: itertools       → C#: System.Linq (Enumerable)");
```

    === Iterator Method ===
      Starting countdown from 5
      5  4  3  2  1  Done!
    
    
    === Manual Iteration ===
      Starting countdown from 3
      next: 3
      next: 2
      next: 1
    
    === LINQ is Lazy (like Python generators) ===
    Eager list: [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
    Lazy type:  RangeSelectIterator`2
    As list:    [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
    
    === yield break (stop early) ===
    TakeWhile: [3, 7]
    
    === Recursive yield (like yield from) ===
    Flatten: [1, 2, 3, 4, 5, 6, 7]
    
    === Infinite Iterator ===
    First 5 naturals: [0, 1, 2, 3, 4]
    From 10:          [10, 11, 12, 13, 14]
    
    === LINQ Iterator Methods ===
    Range:          [0, 1, 2, 3, 4]
    Select (map):   [A, B]
    Where (filter): [3, 4]
    Reverse:        [3, 2, 1]
    Concat (chain): [1, 2, 3, 4]
    Repeat:         [x, x, x]
    
    === Key Differences ===
    Python: yield           → C#: yield return
    Python: yield from      → C#: foreach + yield return (no shortcut)
    Python: StopIteration   → C#: yield break
    Python: gen expression  → C#: LINQ (lazy by default)
    Python: next(gen)       → C#: enumerator.MoveNext() + .Current
    Python: itertools       → C#: System.Linq (Enumerable)
    


```csharp
// Practical alternatives to manual recursive flatten
// In real code, use libraries or built-in methods instead of writing recursion yourself

var nested = new object[] { 1, new object[] { 2, 3 }, new object[] { 4, new object[] { 5, 6 } }, 7 };

// === Method 1: SelectMany — flattens ONE level only ===
var oneLevel = new[] { new[] { 1, 2 }, new[] { 3, 4 }, new[] { 5, 6 } };
Console.WriteLine($"SelectMany (1 level): [{string.Join(", ", oneLevel.SelectMany(x => x))}]");
// Does NOT work for deep nesting — SelectMany only peels one layer

// === Method 2: Iterative flatten with explicit stack (no recursion) ===
List<int> FlattenIter(object[] input)
{
    // Uses a stack instead of recursion — same result, no call stack growth
    var stack = new Stack<object>(input.Reverse());  // reversed to maintain order
    var result = new List<int>();
    while (stack.Count > 0)
    {
        var item = stack.Pop();
        if (item is object[] sub)
            foreach (var x in sub.Reverse())  // push sub-items onto stack
                stack.Push(x);
        else if (item is int n)
            result.Add(n);
    }
    return result;
}
Console.WriteLine($"Iterative flatten:    [{string.Join(", ", FlattenIter(nested))}]");

// === Method 3: Recursive LINQ (one-liner, but still recursion internally) ===
IEnumerable<int> FlatLinq(IEnumerable<object> items) =>
    items.SelectMany(item => item is object[] sub ? FlatLinq(sub) : new[] { (int)item });
Console.WriteLine($"LINQ recursive:       [{string.Join(", ", FlatLinq(nested))}]");

// === Summary ===
Console.WriteLine("\n=== When to use what ===");
Console.WriteLine("1 level deep:     .SelectMany(x => x)");
Console.WriteLine("Deep nesting:     iterative with Stack<T> (no recursion)");
Console.WriteLine("Nested JSON:      JsonDocument / JsonSerializer.Deserialize<T>()");
Console.WriteLine("One-liner:        recursive SelectMany (still recursion, just compact)");
```

    SelectMany (1 level): [1, 2, 3, 4, 5, 6]
    Iterative flatten:    [1, 2, 3, 4, 5, 6, 7]
    LINQ recursive:       [1, 2, 3, 4, 5, 6, 7]
    
    === When to use what ===
    1 level deep:     .SelectMany(x => x)
    Deep nesting:     iterative with Stack<T> (no recursion)
    Nested JSON:      JsonDocument / JsonSerializer.Deserialize<T>()
    One-liner:        recursive SelectMany (still recursion, just compact)
    


```csharp
// === Method 4: System.Text.Json — for nested JSON ===
using System.Text.Json;

string json = """
[
    {"name": "Alice", "address": {"city": "NYC", "zip": "10001"}},
    {"name": "Bob", "address": {"city": "LA", "zip": "90001"}}
]
""";
var doc = JsonDocument.Parse(json);
Console.WriteLine("Json flattened access:");
foreach (var record in doc.RootElement.EnumerateArray())
{
    var name = record.GetProperty("name").GetString();
    var city = record.GetProperty("address").GetProperty("city").GetString();
    var zip = record.GetProperty("address").GetProperty("zip").GetString();
    Console.WriteLine($"  {name}: {city} {zip}");
}
```

    Json flattened access:
      Alice: NYC 10001
      Bob: LA 90001
    

## 5. LINQ & Functional Equivalents


```csharp
// LINQ — C#'s equivalent of Python's comprehensions and functional tools
//
// KEY CONCEPTS:
// - LINQ (Language Integrated Query): a set of extension methods on IEnumerable<T>
//   for querying, transforming, and filtering collections. Like SQL for objects.
// - Method syntax (fluent): chaining methods: list.Where(...).Select(...).OrderBy(...)
//   This is the most common LINQ style. Python has no equivalent chaining syntax.
// - Query syntax: SQL-like: from x in list where x > 5 select x * 2
//   Syntactic sugar that compiles to method syntax. C# exclusive — Python has no equivalent.
// - Lambda expression: anonymous function: `x => x * 2` (C#) / `lambda x: x * 2` (Python).
// - Select (map): transforms each element. Python: [f(x) for x in lst] or map(f, lst).
// - Where (filter): keeps elements matching condition. Python: [x for x in lst if cond].
// - Aggregate (reduce/fold): accumulates all elements into one value.
//   Python: functools.reduce(f, lst, seed).
// - Method chaining: calling methods in sequence on the lazy result of the previous one.
//   Each step returns a new IEnumerable<T> — nothing executes until materialized.
// - Deferred execution: LINQ queries don't run when defined — they run when iterated
//   (foreach) or materialized (.ToList(), .First(), .Count()). This is lazy evaluation.

// Two syntaxes: Method syntax (fluent) and Query syntax (SQL-like)

// === Select (map) — transform each element ===
Console.WriteLine("=== Select (Python: list comprehension / map) ===");
var squares = Enumerable.Range(0, 10).Select(x => x * x).ToList();
Console.WriteLine($"Squares:  [{string.Join(", ", squares)}]");

var evens = Enumerable.Range(0, 20).Where(x => x % 2 == 0).ToList();
Console.WriteLine($"Evens:    [{string.Join(", ", evens)}]");

// With transformation + filter (chained)
var words = new[] { "hello", "world", "csharp", "is", "great" };
var longUpper = words.Where(w => w.Length > 3).Select(w => w.ToUpper());
Console.WriteLine($"Long upper: [{string.Join(", ", longUpper)}]");

// SelectMany = flatten (Python's nested comprehension: [n for row in matrix for n in row])
var matrix = new[] { new[] { 1, 2, 3 }, new[] { 4, 5, 6 }, new[] { 7, 8, 9 } };
var flat = matrix.SelectMany(row => row).ToList();
Console.WriteLine($"Flat:     [{string.Join(", ", flat)}]");

// === Query syntax (SQL-like, C# exclusive) ===
Console.WriteLine("\n=== Query Syntax (C# only) ===");
var queryResult = from w in words
                  where w.Length > 3
                  orderby w.Length
                  select w.ToUpper();
Console.WriteLine($"Query:    [{string.Join(", ", queryResult)}]");

// Same thing in method syntax (compiles to identical code):
var methodResult = words.Where(w => w.Length > 3).OrderBy(w => w.Length).Select(w => w.ToUpper());
Console.WriteLine($"Method:   [{string.Join(", ", methodResult)}]");

// === ToDictionary (Python: dict comprehension) ===
Console.WriteLine("\n=== ToDictionary (Python: dict comprehension) ===");
var squaresDict = Enumerable.Range(0, 6).ToDictionary(x => x, x => x * x);
Console.WriteLine($"Squares dict: {string.Join(", ", squaresDict.Select(kv => $"{kv.Key}:{kv.Value}"))}");

// Filter dict
var scores = new Dictionary<string, int> { ["Alice"] = 85, ["Bob"] = 92, ["Charlie"] = 78, ["Diana"] = 95 };
var passed = scores.Where(kv => kv.Value >= 80).ToDictionary(kv => kv.Key, kv => kv.Value);
Console.WriteLine($"Passed:       {string.Join(", ", passed.Select(kv => $"{kv.Key}:{kv.Value}"))}");

// === ToHashSet (Python: set comprehension) ===
Console.WriteLine("\n=== ToHashSet (Python: set comprehension) ===");
var uniqueLengths = words.Select(w => w.Length).ToHashSet();
Console.WriteLine($"Unique lengths: [{string.Join(", ", uniqueLengths)}]");

// === Aggregate (Python: reduce/fold) ===
// Aggregate(seed, func): starts with seed, applies func(accumulator, element) for each element
Console.WriteLine("\n=== Aggregate (Python: reduce) ===");
var nums = new[] { 1, 2, 3, 4, 5 };
int total = nums.Aggregate(0, (acc, x) => acc + x);    // 0 + 1 + 2 + 3 + 4 + 5
Console.WriteLine($"Sum:     {total}");
int product = nums.Aggregate(1, (acc, x) => acc * x);   // 1 * 1 * 2 * 3 * 4 * 5
Console.WriteLine($"Product: {product}");

// Built-in alternatives (preferred for common aggregations):
Console.WriteLine($"Sum():   {nums.Sum()}");
Console.WriteLine($"Max():   {nums.Max()}");
Console.WriteLine($"Min():   {nums.Min()}");
Console.WriteLine($"All():   {nums.All(x => x > 0)}");     // True if ALL match
Console.WriteLine($"Any():   {nums.Any(x => x > 3)}");     // True if ANY match
Console.WriteLine($"Count(): {nums.Count(x => x > 2)}");
Console.WriteLine($"Average:{nums.Average()}");

// === OrderBy (Python: sorted with key) ===
// key function: a lambda that extracts the comparison value from each element
Console.WriteLine("\n=== OrderBy (Python: sorted) ===");
var names = new[] { "Charlie", "Alice", "Bob", "Diana" };
Console.WriteLine($"Alphabetical:  [{string.Join(", ", names.OrderBy(n => n))}]");
Console.WriteLine($"By length:     [{string.Join(", ", names.OrderBy(n => n.Length))}]");
Console.WriteLine($"Descending:    [{string.Join(", ", names.OrderByDescending(n => n))}]");
Console.WriteLine($"By last char:  [{string.Join(", ", names.OrderBy(n => n[^1]))}]");

// === Method Chaining — the power of LINQ ===
// Each method returns a lazy IEnumerable — nothing executes until .ToList() or foreach
Console.WriteLine("\n=== Method Chaining ===");
var result = Enumerable.Range(1, 20)
    .Where(x => x % 2 == 0)           // filter evens
    .Select(x => x * x)                // square them
    .Where(x => x > 50)                // keep > 50
    .OrderByDescending(x => x)         // sort descending
    .Take(3)                            // first 3
    .ToList();                          // materialize (execute the chain)
Console.WriteLine($"Chained: [{string.Join(", ", result)}]");

// Python equivalent:
// sorted([x**2 for x in range(1,21) if x%2==0 and x**2 > 50], reverse=True)[:3]

// === Key Differences ===
Console.WriteLine("\n=== Key Differences ===");
Console.WriteLine("Python: [x for x in ...]          → C#: .Select(x => ...)");
Console.WriteLine("Python: [x for x in ... if ...]   → C#: .Where(...).Select(...)");
Console.WriteLine("Python: {k:v for ...}             → C#: .ToDictionary(...)");
Console.WriteLine("Python: {x for ...}               → C#: .ToHashSet()");
Console.WriteLine("Python: reduce(f, lst)            → C#: .Aggregate(seed, f)");
Console.WriteLine("Python: sorted(lst, key=f)        → C#: .OrderBy(f)");
Console.WriteLine("C# only: query syntax (from...where...select)");
```

    === Select (Python: list comprehension / map) ===
    Squares:  [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
    Evens:    [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]
    Long upper: [HELLO, WORLD, CSHARP, GREAT]
    Flat:     [1, 2, 3, 4, 5, 6, 7, 8, 9]
    
    === Query Syntax (C# only) ===
    Query:    [HELLO, WORLD, GREAT, CSHARP]
    Method:   [HELLO, WORLD, GREAT, CSHARP]
    
    === ToDictionary (Python: dict comprehension) ===
    Squares dict: 0:0, 1:1, 2:4, 3:9, 4:16, 5:25
    Passed:       Alice:85, Bob:92, Diana:95
    
    === ToHashSet (Python: set comprehension) ===
    Unique lengths: [5, 6, 2]
    
    === Aggregate (Python: reduce) ===
    Sum:     15
    Product: 120
    Sum():   15
    Max():   5
    Min():   1
    All():   True
    Any():   True
    Count(): 3
    Average:3
    
    === OrderBy (Python: sorted) ===
    Alphabetical:  [Alice, Bob, Charlie, Diana]
    By length:     [Bob, Alice, Diana, Charlie]
    Descending:    [Diana, Charlie, Bob, Alice]
    By last char:  [Diana, Bob, Charlie, Alice]
    
    === Method Chaining ===
    Chained: [400, 324, 256]
    
    === Key Differences ===
    Python: [x for x in ...]          → C#: .Select(x => ...)
    Python: [x for x in ... if ...]   → C#: .Where(...).Select(...)
    Python: {k:v for ...}             → C#: .ToDictionary(...)
    Python: {x for ...}               → C#: .ToHashSet()
    Python: reduce(f, lst)            → C#: .Aggregate(seed, f)
    Python: sorted(lst, key=f)        → C#: .OrderBy(f)
    C# only: query syntax (from...where...select)
    
