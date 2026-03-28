---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [lambda, closures, decorators, delegates, higher-order functions, generators, iterators]
keywords: [method, delegate, Func, Action, lambda, closure, extension method, IEnumerable, yield, nullable]
description: "C# functions reference with executable examples and cell outputs — covers methods, delegates, Func/Action, lambdas, closures, extension methods, and iterators. See [[04_py_functions]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[04_py_functions]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 04. Functions - C#

## Function Basics

#### Basic functions

C# methods must declare a return type (`int`, `string`, `void`). Parameters are typed. Static typing catches signature mismatches at compile time. Overloading allows same name with different parameter types.

> [!warning] Function anti-patterns
> - Returning `null` instead of a meaningful empty value or `Optional`
> - Very long parameter lists — use a config object or builder
> - Methods doing too much — single responsibility principle

```csharp
string Greet(string name) { return $"Hello, {name}!"; }
Console.WriteLine(Greet("Alice"));

void PrintGreeting(string name)      // void — returns nothing
{
    Console.WriteLine($"  Hi, {name}!");
}
PrintGreeting("Bob");

// Local function — nested inside another function
void RunDemo()
{
    int Add(int a, int b) => a + b;
    Console.WriteLine($"  Local Add: {Add(3, 4)}");
}
RunDemo();
```

    Hello, Alice!
      Hi, Bob!
      Local Add: 7

#### Expression-bodied and tuple return

`=>` syntax eliminates braces and `return` for one-liners. Tuples return multiple values: `(string, int) GetInfo() => ("Alice", 30)`. Callers destructure: `var (name, age) = GetInfo()`. Use named tuple fields for clarity. For more than 3-4 values, use a `record` or class instead.

```csharp
string GreetShort(string name) => $"Hello, {name}!";
int Square(int x) => x * x;
Console.WriteLine(GreetShort("Diana"));
Console.WriteLine($"Square(5): {Square(5)}");

// Tuple return — multiple values in one return
(int quotient, int remainder) Divide(int a, int b)
{
    return (a / b, a % b);
}
var (q, r) = Divide(17, 5);       // deconstruct
Console.WriteLine($"17 / 5 = {q} remainder {r}");
Console.WriteLine($"As tuple: {Divide(17, 5)}");
```

    Hello, Diana!
    Square(5): 25
    17 / 5 = 3 remainder 2
    As tuple: (3, 2)

<h4><code style="font-size:0.75em">Func&lt;T, TResult&gt;</code> — function with return value</h4>

`Func<T, TResult>` holds a method that returns a value. `Action<T>` holds a void method. Both store lambdas, named methods, or method groups — functions as first-class values. Use `Func`/`Action` for callbacks, LINQ, strategy pattern, DI. For event handlers, use `EventHandler<T>`.

```csharp
Func<string, string> sayHello = Greet;     // assign method to variable
Console.WriteLine(sayHello("Eve"));

// Action<input...> — function with no return value (void)
Action<string> printer = PrintGreeting;
printer("Frank");

// Pass function as argument
string Apply(Func<string, string> func, string value) => func(value);
Console.WriteLine(Apply(Greet, "Grace"));

// Return a function
Func<int, int> MakeMultiplier(int n) => x => x * n;
var doubler = MakeMultiplier(2);
var tripler = MakeMultiplier(3);
Console.WriteLine($"doubler(5) = {doubler(5)}");
Console.WriteLine($"tripler(5) = {tripler(5)}");
```

    Hello, Eve!
      Hi, Frank!
    Hello, Grace!
    doubler(5) = 10
    tripler(5) = 15

#### Callbacks — onSuccess / onError

Accept `Action<string> onSuccess` and `Action<Exception> onError` — the caller defines the response. Decouples the operation from its side effects.

```csharp
void FetchData(string url, Action<string> onSuccess, Action<Exception> onError)
{
    try
    {
        string result = $"data from {url}";   // simulate fetch
        onSuccess(result);
    }
    catch (Exception ex) { onError(ex); }
}

FetchData("api/users",
    onSuccess: data => Console.WriteLine($"  Got: {data}"),
    onError: err => Console.WriteLine($"  Error: {err}"));
```

      Got: data from api/users

<h4>Strategy pattern — swap behavior via <code style="font-size:0.75em">Func</code></h4>

Define interchangeable `Func<T, TResult>` for each strategy. Pass the desired one to the consumer — change behavior without modifying code (open/closed principle). Use for pricing rules, validation, sorting, formatters.

```csharp
Func<decimal, decimal> fullPrice = price => price;
Func<decimal, decimal> discount20 = price => price * 0.8m;
Func<decimal, decimal> memberDiscount = price => price * 0.7m;

decimal Calculate(decimal price, Func<decimal, decimal> strategy) => strategy(price);

Console.WriteLine($"  Full:     ${Calculate(100, fullPrice):F2}");
Console.WriteLine($"  20% off:  ${Calculate(100, discount20):F2}");
Console.WriteLine($"  Member:   ${Calculate(100, memberDiscount):F2}");
```

      Full:     $100.00
      20% off:  $80.00
      Member:   $70.00

<h4>Pipeline — chained <code style="font-size:0.75em">Func</code> steps with <code style="font-size:0.75em">Aggregate</code></h4>

Store steps as `List<Func<string, string>>`. `Aggregate` folds the input through each step sequentially. Steps are composable — add, remove, reorder independently, each testable in isolation.

```csharp
var steps = new List<Func<string, string>>
{
    s => s.Trim(),                                                      // lambda: s is the input string
    s => s.ToLower(),                                                   
    s => System.Text.RegularExpressions.Regex.Replace(s, @"\s+", " "),  
};

string raw = "  Hello   World  ";
// Aggregate(seed, function):
//   seed = raw ("  Hello   World  ") — the starting value
//   The function is called once per element in 'steps':
//     acc  = the running result (starts as seed, then output of each step)
//     step = the current Func<string,string> from the steps list
//   Each iteration: acc = step(acc), feeding output of previous step as input to next
string result = steps.Aggregate(raw, (acc, step) => step(acc));
Console.WriteLine($"  '{raw}' -> '{result}'");
```

      '  Hello   World  ' -> 'hello world'

<h4>Dependency injection — inject fake time via <code style="font-size:0.75em">Func</code></h4>

Accept `Func<DateTime> getNow` with default `DateTime.UtcNow`. Production uses the default; tests inject a fixed `DateTime` for deterministic results. No interface needed — `Func<DateTime>` is lightweight DI.

> [!warning] Don't use `DateTime.Now` directly — untestable and non-deterministic.

```csharp
Dictionary<string, object> ProcessOrder(
    Dictionary<string, object> order,
    Func<DateTime>? getNow = null)
{
    getNow ??= () => DateTime.UtcNow;          // default: real time
    order["processed_at"] = getNow();
    return order;
}
```

    
    (4,19): warning CS8632: The annotation for nullable reference types should only be used in code within a '#nullable' annotations context.

#### Production

Production call — default parameter uses real `DateTime.UtcNow`:

```csharp
var order1 = ProcessOrder(new Dictionary<string, object> { ["id"] = 1 });
Console.WriteLine($"  Production: {order1["processed_at"]}");
```

      Production: 25-Mar-26 1:21:14

#### Test — inject fake time

Test call — inject a fixed `DateTime` for deterministic, reproducible results:

```csharp
var order2 = ProcessOrder(
    new Dictionary<string, object> { ["id"] = 2 },
    getNow: () => new DateTime(2024, 1, 1, 12, 0, 0));
Console.WriteLine($"  Test:       {order2["processed_at"]}");
```

      Test:       01-Jan-24 12:00:00

#### Progress callback

Accept `Action<int, int, string>?` (nullable). Call with `onProgress?.Invoke(current, total, message)`. Callers control the display — console, UI, logging, or nothing.

```csharp
void LoadData(string[] items, Action<int, int, string>? onProgress = null)
{
    for (int i = 0; i < items.Length; i++)
        // onProgress?.Invoke(...) breakdown:
        //   ?. = null-conditional — if onProgress is null, skip (don't crash)
        //   .Invoke() = calls the Action with these arguments:
        //     arg 1 (int):    i + 1          = current item number (1-based)
        //     arg 2 (int):    items.Length    = total items
        //     arg 3 (string): items[i]       = current item name
        //   Same as calling: onProgress(i + 1, items.Length, items[i])
        //   but ?.Invoke is safe when onProgress might be null
        onProgress?.Invoke(i + 1, items.Length, items[i]);
}

LoadData(new[] { "users", "orders", "products" },
    onProgress: (curr, total, item) => Console.WriteLine($"  [{curr}/{total}] Loading {item}"));
```

      [1/3] Loading users
      [2/3] Loading orders
      [3/3] Loading products

    
    (5,55): warning CS8632: The annotation for nullable reference types should only be used in code within a '#nullable' annotations context.

<h4>Sorting with <code style="font-size:0.75em">Func</code> as key</h4>

LINQ `OrderBy(x => x.Property)` extracts the sort key. `ThenBy` for secondary sort. `GroupBy` + `Select` for aggregation over groups. Declarative and composable.

> [!warning] `OrderBy` then another `OrderBy` **replaces** the first — use `ThenBy` for secondary sort.

```csharp
var employees = new[]
{
    new { Name = "Alice", Dept = "Engineering", Salary = 95000 },
    new { Name = "Bob", Dept = "Sales", Salary = 65000 },
    new { Name = "Charlie", Dept = "Engineering", Salary = 110000 },
};
foreach (var e in employees.OrderByDescending(e => e.Salary))
    Console.WriteLine($"  {e.Name,-10} ${e.Salary:N0}");
```

      Charlie    $110'000
      Alice      $95'000
      Bob        $65'000

#### Common function-passing patterns

| Pattern | C# signature | Use case |
|---|---|---|
| **Callbacks** | `Action<string> onSuccess, Action<Exception> onError` | Success/error hooks |
| **Strategy** | `Func<decimal, decimal> pricingStrategy` | Swap algorithms |
| **Pipeline** | `List<Func<string, string>> steps` + `Aggregate` | Chain processing steps |
| **DI / Testing** | `Func<DateTime> getNow` | Inject fake time |
| **Events** | `Action<int, int, string> onProgress` | Progress hooks |
| **Sorting** | `.OrderBy(e => e.Salary)` — `Func<T, TKey>` | Key selector |

## Parameters

#### Default and named parameters

Default values: `void Func(int x = 10)` — must be compile-time constants (no mutable default trap like Python). Named arguments: `Func(x: 5, y: 10)` — self-documenting, any order.

Parameter passing modes: `ref` (read+write), `out` (must assign before return — `TryParse` pattern), `in` (read-only reference — avoids copies of large structs), `params` (variable argument count as array). No `**kwargs` equivalent — use anonymous objects or dictionaries.

```csharp
string Connect(string host, int port = 5432, bool ssl = true)
    => $"{host}:{port} ssl={ssl}";

Console.WriteLine(Connect("localhost"));                    // all defaults
Console.WriteLine(Connect("db.example.com", 3306));        // override port
Console.WriteLine(Connect("db.example.com", ssl: false));  // named, skip port
```

    localhost:5432 ssl=True
    db.example.com:3306 ssl=True
    db.example.com:5432 ssl=False

<h4><code style="font-size:0.75em">ref</code> — pass by reference</h4>

`ref int x` passes the variable itself — changes inside the method are visible to the caller. Both sides must use the `ref` keyword. Variable must be initialized before passing. Use `out` for output-only scenarios.

```csharp
void DoubleIt(ref int x)
{
    x *= 2;
}
int val = 5;
DoubleIt(ref val);
Console.WriteLine($"  ref: {val}");
```

      ref: 10

<h4><code style="font-size:0.75em">out</code> — must-assign output</h4>

`out int result` requires the method to assign a value before returning — compiler enforces it. The `TryParse` pattern combines check + extraction in one line: `if (int.TryParse(s, out int n))`.

```csharp
bool TryDivide(int a, int b, out int result)
{
    if (b == 0) { result = 0; return false; }
    result = a / b;
    return true;
}
if (TryDivide(10, 3, out int answer))
    Console.WriteLine($"  out: {answer}");
```

      out: 3

<h4><code style="font-size:0.75em">in</code> — read-only reference</h4>

`in` passes by reference but prevents modification — compiler enforces read-only. Avoids copy overhead for large structs (Matrix, Vector3D). Don't use for small types (`int`, `double`) — copy is just as fast.

```csharp
double Distance(in (double x, double y) point)
    => Math.Sqrt(point.x * point.x + point.y * point.y);
Console.WriteLine($"  in: {Distance((3, 4))}");
```

      in: 5

<h4><code style="font-size:0.75em">params</code> — variable arguments</h4>

`params int[] numbers` accepts variable arguments — compiler creates the array. Must be the last parameter. `Total(1, 2, 3)` and `Total(myArray)` both work.

```csharp
int Total(params int[] numbers)       // caller can pass any number of ints
{
    return numbers.Sum();
}
Console.WriteLine($"Total(1,2,3):   {Total(1, 2, 3)}");
Console.WriteLine($"Total(10,20):   {Total(10, 20)}");

// Can also pass an array directly
int[] nums = { 1, 2, 3, 4, 5 };
Console.WriteLine($"Total(array):   {Total(nums)}");
```

    Total(1,2,3):   6
    Total(10,20):   30
    Total(array):   15

<h4>No <code style="font-size:0.75em">**kwargs</code> — alternatives</h4>

C# has no `**kwargs`. Alternatives: (1) anonymous object `new { key = value }` (common in ASP.NET), (2) `Dictionary<string, object>` for dynamic keys, (3) named params with defaults for compile-time safety.

```csharp
void LogEvent(string name, object data) =>
    Console.WriteLine($"  {name}: {data}");
LogEvent("click", new { page = "home", button = "submit" });

// Option 2: dictionary
void LogDict(string name, Dictionary<string, object> data) =>
    Console.WriteLine($"  {name}: {string.Join(", ", data.Select(kv => $"{kv.Key}={kv.Value}"))}");
LogDict("click", new Dictionary<string, object> { ["page"] = "home", ["button"] = "submit" });
```

      click: { page = home, button = submit }
      click: page=home, button=submit

## Lambda Expressions

#### Lambda expressions

`(params) => expression` for single-expression lambdas (return is implicit). `(params) => { statements }` for multi-statement with explicit `return`. Assign to `Func<T, TResult>` (returns value) or `Action<T>` (void). Lambdas capture enclosing scope variables automatically.

> [!warning] Keep lambdas short (≤3 lines). Extract complex logic to named methods. Don't use lambdas with side effects in LINQ — use `foreach`.

```csharp
Func<int, int> square = x => x * x;
Func<int, int, int> add = (a, b) => a + b;

Console.WriteLine($"square(5): {square(5)}");
Console.WriteLine($"add(3, 4): {add(3, 4)}");
```

    square(5): 25
    add(3, 4): 7

#### Statement lambda — multi-line body

`(params) => { statements; return value; }` — braces and explicit `return` required. Supports `if`/`else`, loops, `try`/`catch`. Still captures enclosing scope. Keep under 5 lines — extract longer logic to a named method.

```csharp
Func<int, string> classify = (x) => {
    if (x > 0) return "positive";
    if (x < 0) return "negative";
    return "zero";
};
Console.WriteLine($"classify(-5): {classify(-5)}");
```

    classify(-5): negative

#### Lambdas with LINQ

Pass lambdas to `OrderBy`, `Select`, `Where`, `MinBy`. Method chains compose operations declaratively. Compiler infers lambda parameter types.

```csharp
var names = new[] { "Charlie", "Alice", "Bob", "Diana" };
Console.WriteLine($"By length:    [{string.Join(", ", names.OrderBy(n => n.Length))}]");
Console.WriteLine($"By last char: [{string.Join(", ", names.OrderBy(n => n[^1]))}]");

var nums = new[] { 1, 2, 3, 4, 5 };
Console.WriteLine($"Squared: [{string.Join(", ", nums.Select(x => x * x))}]");
Console.WriteLine($"Evens:   [{string.Join(", ", nums.Where(x => x % 2 == 0))}]");

var people = new[] { ("Alice", 30), ("Bob", 25), ("Charlie", 35) };
var youngest = people.MinBy(p => p.Item2);
Console.WriteLine($"Youngest: {youngest}");
```

    By length:    [Bob, Alice, Diana, Charlie]
    By last char: [Diana, Bob, Charlie, Alice]
    Squared: [1, 4, 9, 16, 25]
    Evens:   [2, 4]
    Youngest: (Bob, 25)

<h4><code style="font-size:0.75em">Action</code>, <code style="font-size:0.75em">Predicate</code>, and closure capture</h4>

`Action<T>` for side-effect lambdas (void). `Predicate<T>` for boolean tests used by `List.FindAll`, `Exists`. Closures capture the **variable reference**, not its value — changes are shared.

```csharp
Action<string> shout = msg => Console.WriteLine($"  {msg.ToUpper()}!");
shout("hello");

Predicate<int> isEven = x => x % 2 == 0;
var list = new List<int> { 1, 2, 3, 4, 5, 6 };
Console.WriteLine($"FindAll even: [{string.Join(", ", list.FindAll(isEven))}]");
Console.WriteLine($"Exists > 5:   {list.Exists(x => x > 5)}");
```

      HELLO!
    FindAll even: [2, 4, 6]
    Exists > 5:   True

#### Closure capture — variable, not value

Lambdas capture the **variable reference**, not a snapshot. If `multiplier` changes after the lambda is defined, the lambda uses the new value. When you need a frozen value, copy to a local variable first.

```csharp
int multiplier = 3;
Func<int, int> times = x => x * multiplier;   // captures 'multiplier'
Console.WriteLine($"times(5): {times(5)}");    // 15
multiplier = 10;                                // change captured variable
Console.WriteLine($"times(5): {times(5)}");    // 50 — sees the change!
```

    times(5): 15
    times(5): 50

#### Lambdas vs named methods

| Use | When |
|---|---|
| **Lambda** | LINQ, event handlers, callbacks, short inline logic |
| **Named method** | Reusable, complex, needs documentation |
| **Statement lambda** | Multi-line body with braces and explicit `return` |

> [!warning] Don't write complex lambdas that should be methods. Don't create named methods for trivial one-liners used once.

## Closures & Scope

#### Block scope

C# uses block-level scoping defined by `{}`. A variable is visible from its declaration to the end of its block. Closures capture the variable itself (shared reference, not a copy). Lambdas in a loop all share the same loop variable — fix by copying to a local inside the loop body.

```csharp
{
    int x = 10;
    Console.WriteLine($"  Inside block: {x}");
}
// x is not accessible here — block scope ended
```

      Inside block: 10

#### Closures capture variables

A lambda returned from a method retains access to the method's locals — the variable lives on the heap because the closure keeps a reference. Each call creates independent state.

```csharp
Func<int, int> MakeAdder(int n)
{
    // n is captured by the returned lambda
    return x => x + n;
}
var add5 = MakeAdder(5);
var add10 = MakeAdder(10);
Console.WriteLine($"add5(3):  {add5(3)}");     // 8
Console.WriteLine($"add10(3): {add10(3)}");    // 13
```

    add5(3):  8
    add10(3): 13

#### Closure modifies outer variable

Closures can read AND modify captured variables — both the lambda and enclosing scope see the same variable. Use for simple counters in single-threaded code. For multi-threaded scenarios, use `Interlocked` or locks.

```csharp
int counter = 0;
Action increment = () => counter++;
increment();
increment();
increment();
Console.WriteLine($"counter: {counter}");      // 3 — closure modified outer variable
```

    counter: 3

#### Closure as state — counter factory

`MakeCounter()` returns `Func<int>` closing over a local `count`. Each call creates an independent counter with private, encapsulated state — no class needed.

```csharp
Func<int> MakeCounter(int start = 0)
{
    int count = start;
    return () => ++count;
}
var c1 = MakeCounter(10);
Console.WriteLine($"c1(): {c1()}");   // 11
Console.WriteLine($"c1(): {c1()}");   // 12

var c2 = MakeCounter(0);              // independent closure
Console.WriteLine($"c2(): {c2()}");   // 1
```

    c1(): 11
    c1(): 12
    c2(): 1

#### Range validator factory — parameterized closure

`MakeRangeValidator(min, max)` returns `Func<int, bool>` that tests `[min, max]`. Each call creates an independent validator, composable with `items.Where(isValid)`.

```csharp
Func<int, bool> MakeRangeValidator(int min, int max)
    => value => value >= min && value <= max;

var isValidAge = MakeRangeValidator(0, 120);
var isValidScore = MakeRangeValidator(0, 100);
Console.WriteLine($"age 25:  {isValidAge(25)}");
Console.WriteLine($"age 150: {isValidAge(150)}");
```

    age 25:  True
    age 150: False

#### Loop capture gotcha

> [!danger] Lambdas in a `for` loop capture the variable itself — after the loop, all see the final value. Fix: `int captured = i` inside the loop body. Note: `foreach` in C# 5+ captures per-iteration automatically.

```csharp
var funcs = new List<Func<int>>();
for (int i = 0; i < 3; i++)
    funcs.Add(() => i);               // all capture the SAME variable i
Console.WriteLine($"Bad:  [{string.Join(", ", funcs.Select(f => f()))}]");  // [3, 3, 3]

// Fix: capture a copy
var funcsGood = new List<Func<int>>();
for (int i = 0; i < 3; i++)
{
    int captured = i;                 // new variable each iteration
    funcsGood.Add(() => captured);
}
Console.WriteLine($"Good: [{string.Join(", ", funcsGood.Select(f => f()))}]");  // [0, 1, 2]
```

    Bad:  [3, 3, 3]
    Good: [0, 1, 2]

## Delegates & Events

#### Delegate types

Delegates declare a function signature as a type — type-safe function pointers. Built-in: `Func<T, TResult>` (returns value), `Action<T>` (void), `Predicate<T>` (returns bool). Custom: `delegate int Op(int a, int b)`. Delegates can chain multiple methods via `+=` (multicast). Events are restricted delegates that only the owner can invoke.

> [!warning] With multicast delegates, only the **last** handler's return value is kept. Use `Func`/`Action` for simple cases — custom delegate types add unnecessary ceremony.

```csharp
int Add(int a, int b) => a + b;
int Multiply(int a, int b) => a * b;

MathOp op = Add;
Console.WriteLine($"Add: {op(3, 4)}");
op = Multiply;
Console.WriteLine($"Mul: {op(3, 4)}");

delegate int MathOp(int a, int b);     // custom delegate type
```

    Add: 7
    Mul: 12

#### Multicast delegates

`+=` adds a handler, `-=` removes. Invoking calls all registered handlers in order. Observer pattern — multiple subscribers notified by one invoke. Don't forget to remove handlers to avoid memory leaks.

```csharp
Action<string> pipeline = msg => Console.WriteLine($"  Step 1: {msg}");
pipeline += msg => Console.WriteLine($"  Step 2: {msg.ToUpper()}");
pipeline += msg => Console.WriteLine($"  Step 3: {msg.Length} chars");

Console.WriteLine("Calling pipeline:");
pipeline("hello world");    // all 3 functions execute

// Remove a step
// pipeline -= step;  // can remove specific handlers
```

    Calling pipeline:
      Step 1: hello world
      Step 2: HELLO WORLD
      Step 3: 11 chars

#### Method groups and callbacks

`Action<string> h = PrintUpper` — no parentheses, no lambda wrapper. Compiler creates the delegate automatically. Works with LINQ: `.Select(Transform)`, `.Where(IsValid)`. Use lambda only when additional arguments or transformation are needed.

```csharp
void PrintUpper(string s) => Console.WriteLine($"  {s.ToUpper()}");

Action<string> handler = PrintUpper;    // no () — passing the method itself
handler("method group");

// With LINQ — can pass method directly instead of lambda
var names = new[] { "alice", "bob", "charlie" };
// Lambda:      names.Select(n => n.ToUpper())
// Method group: not possible here because ToUpper is instance method
```

      METHOD GROUP

#### Callback via Action — processing with notification

`ProcessData` accepts `Action<int> onProcessed` called for each item. Caller defines the response — log, collect, display, or ignore. Decouples the algorithm from output handling.

```csharp
void ProcessData(int[] data, Action<int> onProcessed)
{
    foreach (var item in data)
    {
        var result = item * 2;
        onProcessed(result);   // call the callback for each result
    }
}

Console.Write("Results: ");
ProcessData(new[] { 1, 2, 3 }, result => Console.Write($"{result} "));
Console.WriteLine();
```

    Results: 2 4 6

## Method Overloading & Extension Methods

**Method overloading:** multiple methods with the same name but different parameter types or counts. The compiler resolves the correct overload at compile time — clean API, no runtime overhead, backward compatible.

**Extension methods:** add methods to existing types without modifying their source code. Defined as static methods in a static class with `this` before the first parameter. LINQ methods (`.Where`, `.Select`, `.OrderBy`) are all extension methods on `IEnumerable<T>`.

> [!warning] Overloading pitfalls
> - Overloads that do fundamentally different things — confusing API
> - Too many overloads — use optional/named parameters or generics instead
> - Ambiguous overloads cause compiler errors when it can't decide

#### Same name, different parameters

The compiler picks the most specific overload by argument types. `Format(42)` resolves to `Format(int)`, `Format(3.14)` to `Format(double)`. Numeric promotions: `int` can promote to `double` but not vice versa. Use generics when one method can handle all types.

```csharp
string Format(int value) => $"int: {value}";
string Format(double value) => $"double: {value:F2}";
string Format(string value) => $"string: '{value}'";
string Format(int a, int b) => $"two ints: {a} + {b} = {a + b}";

Console.WriteLine(Format(42));           // calls Format(int)
Console.WriteLine(Format(3.14));         // calls Format(double)
Console.WriteLine(Format("hello"));      // calls Format(string)
Console.WriteLine(Format(10, 20));       // calls Format(int, int)
```

    int: 42
    double: 3.14
    string: 'hello'
    two ints: 10 + 20 = 30

#### Extension methods and LINQ

Static method in a static class with `this` as first parameter: `static int WordCount(this string s)`. Enables fluent syntax: `"hello".WordCount()`. LINQ is built entirely with extension methods on `IEnumerable<T>`. Don't extend `object` — pollutes IntelliSense for all types.

```csharp
Console.WriteLine("Extension methods must be in static classes.");
Console.WriteLine("LINQ methods (.Where, .Select, .OrderBy) are ALL extension methods.");
Console.WriteLine("They 'extend' IEnumerable<T> without modifying its source code.");

// Example of how LINQ's .Where is defined (simplified):
// public static IEnumerable<T> Where<T>(this IEnumerable<T> source, Func<T, bool> predicate)
//                                       ^^^^ 'this' makes it an extension method

// Using LINQ extension methods (you've been using these all along!)
var nums = new[] { 1, 2, 3, 4, 5 };
Console.WriteLine($"Where+Select: [{string.Join(", ", nums.Where(x => x > 2).Select(x => x * 10))}]");
// .Where and .Select are extension methods on int[] (which implements IEnumerable<int>)
```

    Extension methods must be in static classes.
    LINQ methods (.Where, .Select, .OrderBy) are ALL extension methods.
    They 'extend' IEnumerable<T> without modifying its source code.
    Where+Select: [30, 40, 50]
