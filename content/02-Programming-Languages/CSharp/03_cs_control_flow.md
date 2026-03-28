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

> [!warning] if / else if / else — branching with explicit bool conditions
> if / else if / else — branching with explicit bool conditions
>
> Technique: Braces required for multi-statement blocks; single-statement
>   blocks can omit them. Conditions must be explicit bool expressions —
>   no truthy/falsy (unlike Python/JS). else if chains for multiple tiers.
>
> Benefits:
>   - Explicit bool prevents bugs like if (x = 5) (assignment, not comparison)
>   - Braces make scope visually clear — fewer bugs from dangling else
>   - else if chains are evaluated top-down — first match wins
>
> Anti-patterns:
>   - Omitting braces — leads to bugs when adding statements later
>   - Deep if/else nesting — extract to methods or use switch expression
>   - Redundant else after return — if (...) return x; return y; is cleaner
>
> When to use:
>   - 2-3 branches with complex conditions or side effects
>
> When NOT to use:
>   - Many discrete value matches — use switch statement or expression

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

> [!warning] Nested ternary — chain of ? : for multi-tier classification
> Nested ternary — chain of ? : for multi-tier classification
>
> Technique: condition ? trueVal : falseVal chains right-to-left.
>   val > 20 ? "high" : val > 10 ? "mid" : "low" evaluates as:
>   if >20 then "high", else if >10 then "mid", else "low".
>
> Benefits:
>   - Single expression — can assign directly to a variable
>   - Compact — replaces 6-line if/else for simple value mapping
>
> Anti-patterns:
>   - More than 2 levels of nesting — becomes unreadable
>   - Side effects in branches — use if/else for clarity
>
> When to use:
>   - Simple 2-3 tier classification in one expression
>
> When NOT to use:
>   - Complex conditions or statements — use switch expression or if/else

```csharp
int val = 15;
string label = val > 20 ? "high" : val > 10 ? "mid" : "low";
Console.WriteLine($"val={val} → {label}");
```

    val=15 → mid

#### No truthy/falsy — explicit bool conditions

> [!warning] No truthy/falsy — C# requires explicit bool in every condition
> No truthy/falsy — C# requires explicit bool in every condition
>
> Technique: if (items), if (str), if (x) are compile errors in C#.
>   Must use explicit comparisons: items.Count > 0, string.IsNullOrEmpty(s),
>   x != 0, obj != null. Only bool values are valid in conditions.
>
> Benefits:
>   - Prevents if (x = 5) bugs — assignment is not bool, caught at compile time
>   - Self-documenting — no guessing what "truthy" means for a given type
>
> Anti-patterns:
>   - Writing if (collection) like Python — must be if (collection.Count > 0)
>   - Expecting 0/1 to be false/true — bool is not int in C#
>
> When to use:
>   - Always — C# enforces this at the language level
>
> When NOT to use:
>   - N/A — there is no alternative in C#

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

> [!warning] Switch statement — match a value against multiple constant cases
> Switch statement — match a value against multiple constant cases
>
> Technique: Each case must end with break (no fall-through). Empty cases
>   can stack: case "a": case "b": handler. Default catches unmatched.
>   Only constants allowed in case labels — no expressions.
>
> Benefits:
>   - Clear structure for discrete value matching (commands, enum values)
>   - Compiler warns on missing enum cases — exhaustiveness checking
>   - break prevents C/C++ fall-through bugs
>
> Anti-patterns:
>   - Forgetting break — compile error in C# (unlike C where it silently falls)
>   - Switch for range checks — use switch expression with relational patterns
>
> When to use:
>   - Command dispatch, enum handling, state machines
>
> When NOT to use:
>   - Range-based or type-based matching — use switch expression

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

> [!warning] Switch expression — value-returning pattern matching with => syntax
> Switch expression — value-returning pattern matching with => syntax
>
> Technique: variable switch { pattern => result, _ => default }. The or
>   pattern combines cases: "a" or "b" => handler. _ is the discard
>   wildcard. Returns a value — assign directly to a variable.
>
> Benefits:
>   - Expression — assigns directly: var x = val switch { ... }
>   - or pattern eliminates duplicate case bodies
>   - Exhaustiveness checking — compiler warns if cases incomplete
>
> Anti-patterns:
>   - Missing _ default — MatchFailureException at runtime
>   - Side effects in switch arms — keep arms pure
>
> When to use:
>   - Value mapping: classification, dispatching, enum-to-string
>
> When NOT to use:
>   - Multi-statement logic per case — use switch statement or if/else

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

> [!warning] Relational patterns — use >=, <, <=, > directly in switch arms
> Relational patterns — use >=, <, <=, > directly in switch arms
>
> Technique: Switch arms can use relational operators: >= 90 => "A".
>   First match wins — order from most restrictive to least.
>   Combines with _ wildcard for the catch-all default.
>
> Benefits:
>   - Replaces chains of if/else if for range classification
>   - Concise — one line per tier
>   - Compiler checks exhaustiveness with _ default
>
> Anti-patterns:
>   - Wrong order — >= 70 before >= 90 matches 95 as "C"
>   - Overlapping ranges without understanding first-match-wins
>
> When to use:
>   - Grade tiers, pricing brackets, severity levels, percentile buckets
>
> When NOT to use:
>   - Non-numeric comparisons — use type or property patterns

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

> [!warning] Type patterns — match by runtime type and bind to a typed variable
> Type patterns — match by runtime type and bind to a typed variable
>
> Technique: int n => ... matches integers and binds to n. when adds a
>   guard: int n when n < 0 => ... only matches negative ints.
>   Combines type checking and casting in one step.
>
> Benefits:
>   - No explicit cast — pattern variable is already the right type
>   - when guards add arbitrary conditions beyond type matching
>   - Replaces if/else chains with is/as/cast patterns
>
> Anti-patterns:
>   - Catch-all _ before specific patterns — unreachable code
>   - Complex when guards — extract to a method for readability
>
> When to use:
>   - Heterogeneous collections (object[], JSON), visitor pattern
>
> When NOT to use:
>   - Homogeneous collections — use generics instead

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

> [!warning] Property patterns — match by object property values in switch arms
> Property patterns — match by object property values in switch arms
>
> Technique: { PropertyName: value } matches when the property equals
>   the value. Nest for multi-property: { Month: 12, Day: 25 }.
>   Combine with relational: { Month: >= 6 } or or patterns.
>
> Benefits:
>   - Declarative — reads like a specification, not imperative code
>   - Nested property access: { Address: { City: "NYC" } }
>   - Combines with when guards for complex conditions
>
> Anti-patterns:
>   - Matching too many properties — extract to a predicate method
>   - Property access on null — null check pattern first
>
> When to use:
>   - DTO classification, config routing, date/time matching, validation
>
> When NOT to use:
>   - Simple value equality — regular switch or == is clearer

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

> [!warning] Null-coalescing (??, ??=) and is pattern matching — null-safe operations
> Null-coalescing (??, ??=) and is pattern matching — null-safe operations
>
> Technique: ?? returns left if non-null, else right. ??= assigns only
>   when null. is pattern extracts and casts: if (obj is string s).
>   Combines null safety with type dispatch in one expression.
>
> Benefits:
>   - ?? replaces verbose null checks: x != null ? x : default
>   - ??= is one-line lazy initialization: _cache ??= LoadData()
>   - is pattern eliminates separate is-check + cast steps
>
> Anti-patterns:
>   - Using ?? to mask bugs — null might indicate a real problem
>   - Deep ?? chains — readability degrades after 2-3 levels
>
> When to use:
>   - Default values, lazy init, type-safe dispatch on nullable data
>
> When NOT to use:
>   - When null is an error — throw ArgumentNullException instead

```csharp
#nullable enable

// Null-coalescing (??, ??=) and is pattern matching

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

> [!warning] for and foreach — index-based and collection iteration
> for and foreach — index-based and collection iteration
>
> Technique: for (init; condition; increment) runs while condition is true.
>   foreach (var item in collection) iterates any IEnumerable<T>.
>   foreach is preferred — cleaner, no off-by-one errors, works with
>   any enumerable (arrays, lists, LINQ queries, custom iterators).
>
> Benefits:
>   - foreach prevents index errors and works with any IEnumerable
>   - for provides full control over start, end, step, and index access
>   - Both support break and continue for flow control
>
> Anti-patterns:
>   - for loop when index isn't needed — foreach is cleaner
>   - Modifying a collection during foreach — throws InvalidOperationException
>   - Off-by-one errors with for — use < length, not <= length
>
> When to use:
>   - foreach for most iteration; for when you need the index or step control
>
> When NOT to use:
>   - LINQ pipeline when you just need a transformation — Select/Where are lazier
>
> for — index-based iteration with explicit counter

```csharp
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

> [!warning] Count down — for loop with negative step
> Count down — for loop with negative step
>
> Technique: Decrement the counter: for (int i = 10; i > 0; i -= 2).
>   Step can be any integer — negative for counting down, >1 for skipping.
>   Condition is checked before each iteration.
>
> Benefits:
>   - Explicit start, end, and step — no ambiguity about direction
>   - Works for any arithmetic progression
>
> Anti-patterns:
>   - Wrong condition direction — i > 0 not i < 10 for counting down
>   - Infinite loop from wrong step sign — i-- when i++ intended
>
> When to use:
>   - Countdown timers, reverse iteration, stepping by >1
>
> When NOT to use:
>   - Simple reverse — .Reverse() or Enumerable.Range().Reverse()

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

> [!warning] break and continue — loop flow control
> break and continue — loop flow control
>
> Technique: break exits the innermost loop immediately. continue skips
>   the rest of the current iteration and moves to the next. Both work
>   in for, foreach, while, and do-while loops.
>
> Benefits:
>   - break enables early exit — avoids processing remaining elements
>   - continue skips unwanted items cleanly — avoids deep nesting
>
> Anti-patterns:
>   - break/continue in deeply nested code — hard to follow flow
>   - Using continue when inverting the condition is clearer
>   - break without a comment explaining why — intent is unclear
>
> When to use:
>   - break: search found, error encountered, limit reached
>   - continue: skip invalid items, filter during iteration
>
> When NOT to use:
>   - Complex flow control — extract to a method with return instead
>
> break — exits immediately when condition is met

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

> [!warning] Breaking outer loops — goto label and extract-to-method patterns
> Breaking outer loops — goto label and extract-to-method patterns
>
> Technique: C# has no labeled break. goto jumps to a label after the
>   outer loop — the accepted idiom. Alternative: extract nested loops
>   into a method and use return to break all levels at once.
>
> Benefits:
>   - goto to a label is simplest for breaking nested loops in C#
>   - Extract-to-method is cleaner for complex search logic
>
> Anti-patterns:
>   - goto for general control flow — only use for nested loop breaking
>   - Boolean flags for multi-level break — goto is cleaner
>
> When to use:
>   - Breaking out of 2-3 level nested loops
>
> When NOT to use:
>   - General flow control — goto makes code hard to reason about

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

> [!warning] yield return — lazy iterator method producing values on demand
> yield return — lazy iterator method producing values on demand
>
> Technique: A method returning IEnumerable<T> with yield return pauses
>   execution, returns a value, and resumes on the next MoveNext() call.
>   The compiler transforms it into a state machine automatically.
>
> Benefits:
>   - Lazy evaluation — values computed only when requested
>   - Memory efficient — no need to build the entire collection in memory
>   - Composable — chain with LINQ: Countdown(10).Where(x => x % 2 == 0)
>
> Anti-patterns:
>   - Returning a List when yield return would be lazier
>   - Side effects in yield methods — execution order is non-obvious
>   - Forgetting that the method body doesn't run until first MoveNext()
>
> When to use:
>   - Large or infinite sequences, lazy pipelines, custom iterators
>
> When NOT to use:
>   - When all values are needed at once — return a List directly

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

> [!warning] Manual iteration — GetEnumerator(), MoveNext(), Current protocol
> Manual iteration — GetEnumerator(), MoveNext(), Current protocol
>
> Technique: IEnumerable.GetEnumerator() returns an IEnumerator with
>   MoveNext() (advance + bool) and Current (value). foreach is syntactic
>   sugar for this. Manual iteration allows peeking and interleaving.
>
> Benefits:
>   - Understanding the protocol behind foreach and LINQ
>   - Enables custom iteration: peek ahead, skip, interleave enumerators
>
> Anti-patterns:
>   - Manual iteration when foreach suffices — unnecessary complexity
>   - Forgetting to Dispose the enumerator — use try/finally or using
>
> When to use:
>   - Interleaving enumerators, peeking ahead, custom control
>
> When NOT to use:
>   - Standard iteration — foreach handles the protocol automatically

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

> [!warning] SelectMany — flatten one level of nested collections
> SelectMany — flatten one level of nested collections
>
> Technique: SelectMany projects each element to a sequence and flattens
>   the results into one sequence. Equivalent to nested foreach + yield.
>   Only flattens one level — not recursive.
>
> Benefits:
>   - One-line flatten: nested.SelectMany(x => x)
>   - Combines projection and flattening in one step
>   - Lazy evaluation — integrates with LINQ pipeline
>
> Anti-patterns:
>   - Expecting recursive flatten — SelectMany only goes one level
>   - Using nested foreach when SelectMany is cleaner
>
> When to use:
>   - Flattening list-of-lists, expanding one-to-many relationships
>
> When NOT to use:
>   - Deep nesting — use recursive Flatten with yield return or Stack

```csharp
var oneLevel = new[] { new[] { 1, 2 }, new[] { 3, 4 }, new[] { 5, 6 } };
Console.WriteLine($"SelectMany (1 level): [{string.Join(", ", oneLevel.SelectMany(x => x))}]");
// Does NOT work for deep nesting — SelectMany only peels one layer
```

    SelectMany (1 level): [1, 2, 3, 4, 5, 6]

<h4>Iterative flatten with <code style="font-size:0.75em">Stack&lt;T&gt;</code></h4>

> [!warning] Iterative flatten with Stack — deep nesting without recursion
> Iterative flatten with Stack — deep nesting without recursion
>
> Technique: Push nested structures onto a Stack. Pop and process: if
>   IEnumerable, push children in reverse; if leaf, add to result.
>   Avoids call stack growth — handles arbitrary depth safely.
>
> Benefits:
>   - No StackOverflowException — explicit stack replaces recursion
>   - Handles arbitrary depth in constant stack space
>
> Anti-patterns:
>   - Recursive flatten on untrusted input — may overflow
>   - Processing strings as IEnumerable — infinite recursion
>
> When to use:
>   - Flattening deeply or variably nested data (JSON, trees)
>
> When NOT to use:
>   - Shallow known nesting — SelectMany is simpler

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

> [!warning] Eager vs lazy evaluation — ToList() forces immediate execution
> Eager vs lazy evaluation — ToList() forces immediate execution
>
> Technique: LINQ queries are lazy — nothing executes until enumerated
>   (foreach, ToList, ToArray). ToList() materializes immediately.
>   Without it, the query re-executes on each enumeration.
>
> Benefits:
>   - Lazy: skip computation if result never consumed; enables infinite sequences
>   - Eager: predictable timing, safe to modify source after materializing
>
> Anti-patterns:
>   - Multiple enumeration of deferred query — runs pipeline each time
>   - ToList() on infinite sequences — hangs or OOM
>
> When to use:
>   - ToList() when enumerating multiple times or caching results
>
> When NOT to use:
>   - ToList() on queries consumed only once — wastes memory

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

> [!warning] yield break — stop an iterator method early
> yield break — stop an iterator method early
>
> Technique: yield break terminates the iterator immediately — no more
>   values produced. Equivalent to return in a regular method.
>   Enumerator reports MoveNext() = false after yield break.
>
> Benefits:
>   - Clean early exit — no boolean flag or break needed
>   - Composable: TakeWhilePositive feeds into further LINQ queries
>
> Anti-patterns:
>   - yield break when LINQ TakeWhile() would be simpler
>   - Forgetting yield break — iterator silently produces no more
>
> When to use:
>   - Custom take-while logic, sentinel-based iteration, error boundaries
>
> When NOT to use:
>   - Simple filtering — .TakeWhile() or .Where() is shorter

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

> [!warning] Recursive iterator — flatten nested structures with yield return
> Recursive iterator — flatten nested structures with yield return
>
> Technique: Iterator method calls itself recursively. For each element:
>   if leaf, yield return; if collection, yield return each flattened child.
>   Natural expression of tree/graph traversal.
>
> Benefits:
>   - Natural recursion — mirrors the data structure
>   - Lazy — yields one element at a time
>   - Composable — pipe output through LINQ
>
> Anti-patterns:
>   - Very deep nesting — risks StackOverflowException; use Stack approach
>   - Not handling circular references — infinite recursion
>
> When to use:
>   - Tree traversal, JSON flattening, file system walking
>
> When NOT to use:
>   - Untrusted depth — use iterative Stack approach for safety

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

> [!warning] LINQ basics — Select, Where, chaining, and SelectMany
> LINQ basics — Select, Where, chaining, and SelectMany
>
> Technique: Select transforms each element (map). Where filters (filter).
>   Chain methods fluently: .Where(...).Select(...).Take(...). All lazy —
>   nothing executes until enumeration. SelectMany flattens nested sequences.
>
> Benefits:
>   - Declarative — describe what you want, not how to iterate
>   - Lazy evaluation — only computes what's consumed
>   - Composable — chain any number of operations into a pipeline
>
> Anti-patterns:
>   - foreach with if + add to list — use .Where().Select() instead
>   - Mixing LINQ with manual loops — pick one style for consistency
>   - Multiple enumeration — materialize with ToList() if reused
>
> When to use:
>   - Data transformation pipelines, filtering, projection, aggregation
>
> When NOT to use:
>   - Simple single-element access — use indexer or First() directly
>
> Select — transforms each element (map)

```csharp
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

> [!warning] Query syntax vs method syntax — two ways to write the same LINQ
> Query syntax vs method syntax — two ways to write the same LINQ
>
> Technique: Query syntax (from x in items where ... select ...) reads
>   like SQL. Method syntax (.Where().Select()) uses lambda chains.
>   Both compile to identical IL — choose by readability.
>
> Benefits:
>   - Query syntax is clearer for joins and multiple from clauses
>   - Method syntax is more concise for simple filter/map chains
>   - Both support the same operations — no functionality difference
>
> Anti-patterns:
>   - Mixing both styles in one expression — pick one for consistency
>   - Query syntax for simple .Where().Select() — method is shorter
>
> When to use:
>   - Query syntax for complex joins; method syntax for simple pipelines
>
> When NOT to use:
>   - N/A — both are valid; choose by readability

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

> [!warning] ToDictionary and ToHashSet — materialize LINQ into keyed collections
> ToDictionary and ToHashSet — materialize LINQ into keyed collections
>
> Technique: ToDictionary(keySelector, valueSelector) builds a Dictionary.
>   ToHashSet() builds a HashSet for O(1) lookups. Both are eager —
>   they enumerate the source immediately.
>
> Benefits:
>   - ToDictionary: O(1) lookup by key from any sequence
>   - ToHashSet: O(1) membership testing
>   - Both are terminal LINQ operations
>
> Anti-patterns:
>   - Duplicate keys in ToDictionary — throws ArgumentException
>   - ToHashSet on large sequences when only a few lookups needed
>
> When to use:
>   - Building lookup tables, indexes, deduplication sets from queries
>
> When NOT to use:
>   - Sequence iterated once — ToList or foreach is sufficient

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

> [!warning] Aggregate and built-in aggregations — general fold and shortcuts
> Aggregate and built-in aggregations — general fold and shortcuts
>
> Technique: Aggregate(seed, (acc, x) => ...) is the general fold.
>   Built-in shortcuts: Sum(), Max(), Min(), Average(), Count().
>   Any(predicate) and All(predicate) for boolean existence checks.
>
> Benefits:
>   - Built-in aggregations are optimized and null-safe
>   - Any() short-circuits on first match — O(1) best case
>   - Aggregate handles custom reductions (string building, merges)
>
> Anti-patterns:
>   - Manual loop for sum/max/count — use built-in LINQ methods
>   - Count() > 0 when Any() suffices — Any() short-circuits
>
> When to use:
>   - Sum/Max/Min/Average for numbers; Any/All for predicates
>
> When NOT to use:
>   - Aggregate for simple sum — built-in Sum() is clearer

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

> [!warning] Ordering — OrderBy and OrderByDescending with key selectors
> Ordering — OrderBy and OrderByDescending with key selectors
>
> Technique: OrderBy(x => x.Property) sorts ascending. OrderByDescending
>   for descending. ThenBy/ThenByDescending for secondary sort.
>   Key selector is a lambda extracting the comparison value.
>
> Benefits:
>   - Declarative — specify what to sort by, not how
>   - Stable sort — equal elements maintain relative order
>   - Lazy — deferred until enumeration
>
> Anti-patterns:
>   - OrderBy then OrderBy — second replaces first; use ThenBy
>   - List.Sort() when new sorted sequence is needed — OrderBy is non-destructive
>
> When to use:
>   - Sorted query results, ranked output, report ordering
>
> When NOT to use:
>   - In-place sorting — use List.Sort() for better performance

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

> [!warning] Deferred execution — chained LINQ pipeline materialized by ToList()
> Deferred execution — chained LINQ pipeline materialized by ToList()
>
> Technique: Each LINQ method returns a lazy IEnumerable. Methods chain
>   declaratively: .Where().Select().OrderBy().Take(). Nothing executes
>   until foreach or ToList(). ToList() forces execution of the full chain.
>
> Benefits:
>   - Compose complex queries without intermediate allocations
>   - Short-circuit with Take/First — don't process entire source
>   - Add conditions dynamically: if (filter) query = query.Where(...)
>
> Anti-patterns:
>   - Enumerating the same deferred query multiple times — duplicates work
>   - Assuming LINQ runs eagerly — source modifications affect results
>
> When to use:
>   - Building query pipelines step by step; conditional filtering
>
> When NOT to use:
>   - When you need predictable execution — use ToList() early

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

> [!warning] Infinite generator — yield return in while(true) with Take/First control
> Infinite generator — yield return in while(true) with Take/First control
>
> Technique: while(true) with yield return produces an infinite sequence.
>   Callers control consumption with Take(), First(), TakeWhile().
>   Common LINQ methods: Take, Skip, Distinct, Zip, Chunk, Concat.
>
> Benefits:
>   - Infinite sequences are memory-free — only computed on demand
>   - Take(n) safely limits consumption — no OOM risk
>   - Composable with all LINQ operators
>
> Anti-patterns:
>   - ToList() on infinite sequence — hangs or OOM
>   - Count() on infinite sequence — never returns
>   - foreach without break — infinite loop
>
> When to use:
>   - Fibonacci, primes, sensor streams, paginated API consumption
>
> When NOT to use:
>   - When all values needed at once — use a finite collection

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
