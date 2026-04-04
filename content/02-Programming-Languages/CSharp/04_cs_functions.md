---
tags: [csharp]
aliases: [lambda, closures, decorators, delegates, higher-order functions, generators, iterators]
description: "C# functions reference with executable examples and cell outputs — covers methods, delegates, Func/Action, lambdas, closures, extension methods, and iterators. See [04_py_functions](https://alp78.github.io/elysium/02-Programming-Languages/Python/04_py_functions) for the Python equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 04. Functions - C#

> [!quote]
> "The purpose of abstraction is not to be vague, but to create a new semantic level in which one can be absolutely precise."
>
> — **Edsger W. Dijkstra**, *The Humble Programmer*, ACM Turing lecture (1972)

## Function Basics

#### Method definition — return type, parameters, static, overloading

C# methods must declare a return type (`int`, `string`, `void`). Parameters are typed. Static typing catches signature mismatches at compile time. Overloading allows same name with different parameter types.

> [!warning] Function anti-patterns
>
> - Returning `null` instead of a meaningful empty value or `Optional`
> - Very long parameter lists — use a config object or builder
> - Methods doing too much — single responsibility principle

> [!success] Follow these instead
>
> - Return a typed result or throw a specific exception rather than `null`
> - Use a config/options object or builder pattern when you need more than 3–4 parameters
> - Keep each method focused on one responsibility — extract helpers freely

```csharp
string Greet(string name) { return $"Hello, {name}!"; }
Greet("Alice")

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
      7

#### Expression-bodied and tuple return

> [!info] Expression-bodied and tuple return
>
> - `=>` syntax — eliminates braces and `return` for one-liners
> - Tuples return multiple values: `(string, int) GetInfo() => ("Alice", 30)`
> - Callers destructure: `var (name, age) = GetInfo()`
> - Use named tuple fields for clarity; for 3-4+ values, use a `record` or class

```csharp
string GreetShort(string name) => $"Hello, {name}!";
int Square(int x) => x * x;
GreetShort("Diana")
Square(5)

// Tuple return — multiple values in one return
(int quotient, int remainder) Divide(int a, int b)
{
    return (a / b, a % b);
}
var (q, r) = Divide(17, 5);       // deconstruct
$"17 / 5 = {q} remainder {r}"
Divide(17, 5)   // As tuple
```

    Hello, Diana!
    25
    17 / 5 = 3 remainder 2
    (3, 2)

#### Func&lt;T, TResult&gt; — function with return value

> [!info] Delegate types
>
> - `Func<T, TResult>` — holds a method that returns a value
> - `Action<T>` — holds a void method
> - Both store lambdas, named methods, or method groups — functions as first-class values
> - Use for callbacks, LINQ, strategy pattern, DI
> - For event handlers, use `EventHandler<T>`

```csharp
Func<string, string> sayHello = Greet;     // assign method to variable
sayHello("Eve")

// Action<input...> — function with no return value (void)
Action<string> printer = PrintGreeting;
printer("Frank");

// Pass function as argument
string Apply(Func<string, string> func, string value) => func(value);
Apply(Greet, "Grace")

// Return a function
Func<int, int> MakeMultiplier(int n) => x => x * n;
var doubler = MakeMultiplier(2);
var tripler = MakeMultiplier(3);
doubler(5)
tripler(5)
```

    Hello, Eve!
      Hi, Frank!
    Hello, Grace!
    doubler(5) = 10
    tripler(5) = 15

#### Callbacks — onSuccess / onError

A callback is a function passed as an argument to another function, to be called later when a specific event occurs. In C#, callbacks are implemented as `Action` or `Func` delegates. The caller decides what happens on success or failure by providing the callback — the called method doesn't need to know the details of error handling or notification.

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

      data from api/users

#### Strategy pattern — swap behavior via Func

The strategy pattern lets you swap an algorithm at runtime without changing the code that uses it. Instead of hardcoding a calculation (like a pricing formula or scoring method), you pass the algorithm as a `Func` parameter. Different callers can inject different strategies — one uses z-score normalization, another uses percentile ranking — through the same method signature.

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

      $100.00
      $80.00
      $70.00

#### Pipeline — chained Func steps with Aggregate

A pipeline chains multiple transformation steps where each step's output becomes the next step's input. In C#, you store steps as a `List<Func<T, T>>` and compose them with `Aggregate`. This mirrors the medallion architecture: raw data passes through validation, cleaning, and enrichment stages sequentially.

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

#### Dependency injection — inject fake time via Func

Dependency injection (DI) means passing dependencies into a method or class from outside rather than creating them internally. The classic example: instead of calling `DateTime.UtcNow` directly (which makes testing impossible), you accept a `Func<DateTime>` parameter. In production, it returns real time; in tests, it returns a fixed date so results are deterministic.

Accept `Func<DateTime> getNow` with default `DateTime.UtcNow`. Production uses the default; tests inject a fixed `DateTime` for deterministic results. No interface needed — `Func<DateTime>` is lightweight DI.

> [!tip] DI enables testability
> If a function calls `DateTime.UtcNow` directly, you can't test what happens at midnight, on weekends, or at year boundaries without waiting. Injecting time as a `Func<DateTime>` parameter makes every time-dependent scenario testable in milliseconds.

> [!warning] Don't use DateTime.Now directly
>
> Don't use `DateTime.Now` directly — untestable and non-deterministic.

> [!success] Inject time as a dependency
>
> Accept `Func<DateTime>? getNow = null` with `getNow ??= () => DateTime.UtcNow` as default. Production uses real time; tests inject a fixed `DateTime` — fully deterministic.

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

#### Dependency injection — production call with default DateTime.UtcNow

Production call — default parameter uses real `DateTime.UtcNow`:

```csharp
var order1 = ProcessOrder(new Dictionary<string, object> { ["id"] = 1 });
Console.WriteLine($"  Production: {order1["processed_at"]}");
```

      25-Mar-26 1:21:14

#### Dependency injection — test with injected fake DateTime

Test call — inject a fixed `DateTime` for deterministic, reproducible results:

```csharp
var order2 = ProcessOrder(
    new Dictionary<string, object> { ["id"] = 2 },
    getNow: () => new DateTime(2024, 1, 1, 12, 0, 0));
Console.WriteLine($"  Test:       {order2["processed_at"]}");
```

      01-Jan-24 12:00:00

#### Progress callback

A progress callback reports incremental status during a long-running operation. The caller provides an `Action` that receives progress updates (e.g., percentage complete, current item), allowing UI updates or logging without the core logic knowing how progress is displayed.

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

#### Sorting with Func as key

> [!info] LINQ with Func
>
> - `OrderBy(x => x.Property)` — extracts the sort key
> - `ThenBy` — secondary sort
> - `GroupBy` + `Select` — aggregation over groups
> - Declarative and composable

> [!warning] OrderBy replaces previous sort
>
> `OrderBy` then another `OrderBy` **replaces** the first — use `ThenBy` for secondary sort.

> [!success] Chain ThenBy for multi-column sort
>
> Use `.OrderBy(e => e.Dept).ThenBy(e => e.Salary)` to apply a stable secondary sort without discarding the primary one.

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

Connect("localhost")
Connect("db.example.com", 3306)
Connect("db.example.com", ssl: false)
```

    localhost:5432 ssl=True
    db.example.com:3306 ssl=True
    db.example.com:5432 ssl=False

#### ref — pass by reference

> [!info] Pass by reference
>
> - `ref int x` — passes the variable itself; changes are visible to the caller
> - Both sides must use the `ref` keyword
> - Variable must be initialized before passing
> - Use `out` for output-only scenarios (caller doesn't need to initialize)

```csharp
void DoubleIt(ref int x)
{
    x *= 2;
}
int val = 5;
DoubleIt(ref val);
val   // ref
```

      10

#### out — must-assign output

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

      3

#### in — read-only reference

`in` passes by reference but prevents modification — compiler enforces read-only. Avoids copy overhead for large structs (Matrix, Vector3D). Don't use for small types (`int`, `double`) — copy is just as fast.

```csharp
double Distance(in (double x, double y) point)
    => Math.Sqrt(point.x * point.x + point.y * point.y);
Distance((3, 4))   // in
```

      5

#### params — variable arguments

`params int[] numbers` accepts variable arguments — compiler creates the array. Must be the last parameter. `Total(1, 2, 3)` and `Total(myArray)` both work.

```csharp
int Total(params int[] numbers)       // caller can pass any number of ints
{
    return numbers.Sum();
}
Total(1, 2, 3)
Total(10, 20)

// Can also pass an array directly
int[] nums = { 1, 2, 3, 4, 5 };
Total(nums)   // Total(array)
```

    6
    30
    15

#### No **kwargs — alternatives

> [!info] C# has no kwargs equivalent
>
> - Anonymous object: `new { key = value }` (common in ASP.NET)
> - `Dictionary<string, object>` for dynamic keys
> - Named params with defaults for compile-time safety

```csharp
void LogEvent(string name, object data) =>
    $"  {name}: {data}"
LogEvent("click", new { page = "home", button = "submit" });

// Option 2: dictionary
void LogDict(string name, Dictionary<string, object> data) =>
    $"  {name}: {string.Join(", ", data.Select(kv => $"{kv.Key}={kv.Value}"))}"
LogDict("click", new Dictionary<string, object> { ["page"] = "home", ["button"] = "submit" });
```

      click: { page = home, button = submit }
      click: page=home, button=submit

## Lambda Expressions

#### Lambda expressions

> [!info] Lambda syntax
>
> - `(params) => expression` — single-expression (return is implicit)
> - `(params) => { statements }` — multi-statement with explicit `return`
> - Assign to `Func<T, TResult>` (returns value) or `Action<T>` (void)
> - Lambdas capture enclosing scope variables automatically

> [!warning] Keep lambdas short (≤3 lines).
>
> Keep lambdas short (≤3 lines). Extract complex logic to named methods. Don't use lambdas with side effects in LINQ — use `foreach`.

> [!success] Named methods for complex logic
>
> Extract anything beyond 3 lines into a named method. Side-effecting operations belong in `foreach` loops, not LINQ chains — keeps each part readable and independently testable.

```csharp
Func<int, int> square = x => x * x;
Func<int, int, int> add = (a, b) => a + b;

square(5)
add(3, 4)
```

    25
    7

#### Statement lambda — multi-line body with { }

> [!info] Statement lambda syntax
>
> - `(params) => { statements; return value; }` — braces and explicit `return` required
> - Supports `if`/`else`, loops, `try`/`catch`
> - Still captures enclosing scope
> - Keep under 5 lines — extract longer logic to a named method

```csharp
Func<int, string> classify = (x) => {
    if (x > 0) return "positive";
    if (x < 0) return "negative";
    return "zero";
};
classify(-5)
```

    negative

#### Lambdas with LINQ

Pass lambdas to `OrderBy`, `Select`, `Where`, `MinBy`. Method chains compose operations declaratively. Compiler infers lambda parameter types.

```csharp
var names = new[] { "Charlie", "Alice", "Bob", "Diana" };
string.Join(", ", names.OrderBy(n => n.Length))   // By length
string.Join(", ", names.OrderBy(n => n[^1]))   // By last char

var nums = new[] { 1, 2, 3, 4, 5 };
string.Join(", ", nums.Select(x => x * x))   // Squared
string.Join(", ", nums.Where(x => x % 2 == 0))   // Evens

var people = new[] { ("Alice", 30), ("Bob", 25), ("Charlie", 35) };
var youngest = people.MinBy(p => p.Item2);
youngest   // Youngest
```

    [Bob, Alice, Diana, Charlie]
    [Diana, Bob, Charlie, Alice]
    [1, 4, 9, 16, 25]
    [2, 4]
    (Bob, 25)

#### Action, Predicate, and closure capture

> [!info] Delegate types and closures
>
> - `Action<T>` — side-effect lambdas (void)
> - `Predicate<T>` — boolean tests used by `List.FindAll`, `Exists`
> - Closures capture the **variable reference**, not its value — changes are shared

```csharp
Action<string> shout = msg => Console.WriteLine($"  {msg.ToUpper()}!");
shout("hello");

Predicate<int> isEven = x => x % 2 == 0;
var list = new List<int> { 1, 2, 3, 4, 5, 6 };
string.Join(", ", list.FindAll(isEven))   // FindAll even
list.Exists(x => x > 5)   // Exists > 5
```

      HELLO!
    [2, 4, 6]
    True

#### Closure capture — variable, not value

Lambdas capture the **variable reference**, not a snapshot. If `multiplier` changes after the lambda is defined, the lambda uses the new value. When you need a frozen value, copy to a local variable first.

```csharp
int multiplier = 3;
Func<int, int> times = x => x * multiplier;   // captures 'multiplier'
times(5)
multiplier = 10;                                // change captured variable
times(5)
```

    15
    50

#### Lambdas vs named methods

| Use | When |
|---|---|
| **Lambda** | LINQ, event handlers, callbacks, short inline logic |
| **Named method** | Reusable, complex, needs documentation |
| **Statement lambda** | Multi-line body with braces and explicit `return` |

> [!warning] Lambda vs method choice
>
> Don't write complex lambdas that should be methods. Don't create named methods for trivial one-liners used once.

> [!success] Right tool for the right job
>
> Inline lambda for short, single-use LINQ predicates and callbacks; named method for anything reusable, > 3 lines, or that needs a doc comment.

## Closures & Scope

#### Block scope — variables declared inside { } are local

C# uses block-level scoping defined by `{}`. A variable is visible from its declaration to the end of its block. Closures capture the variable itself (shared reference, not a copy). Lambdas in a loop all share the same loop variable — fix by copying to a local inside the loop body.

```csharp
{
    int x = 10;
    Console.WriteLine($"  Inside block: {x}");
}
// x is not accessible here — block scope ended
```

      10

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
add5(3)
add10(3)
```

    8
    13

#### Closure modifies outer variable

Closures can read AND modify captured variables — both the lambda and enclosing scope see the same variable. Use for simple counters in single-threaded code. For multi-threaded scenarios, use `Interlocked` or locks.

```csharp
int counter = 0;
Action increment = () => counter++;
increment();
increment();
increment();
counter
```

    3

#### Closure as state — counter factory

`MakeCounter()` returns `Func<int>` closing over a local `count`. Each call creates an independent counter with private, encapsulated state — no class needed.

```csharp
Func<int> MakeCounter(int start = 0)
{
    int count = start;
    return () => ++count;
}
var c1 = MakeCounter(10);
c1()
c1()

var c2 = MakeCounter(0);              // independent closure
c2()
```

    11
    12
    1

#### Range validator factory — parameterized closure

`MakeRangeValidator(min, max)` returns `Func<int, bool>` that tests `[min, max]`. Each call creates an independent validator, composable with `items.Where(isValid)`.

```csharp
Func<int, bool> MakeRangeValidator(int min, int max)
    => value => value >= min && value <= max;

var isValidAge = MakeRangeValidator(0, 120);
var isValidScore = MakeRangeValidator(0, 100);
isValidAge(25)   // age 25
isValidAge(150)   // age 150
```

    True
    False

#### Loop capture gotcha

> [!danger] Lambdas in a for loop
>
> Lambdas in a `for` loop capture the variable itself — after the loop, all see the final value. Fix: `int captured = i` inside the loop body. Note: `foreach` in C# 5+ captures per-iteration automatically.

> [!success] Copy the loop variable before capturing
>
> Declare `int captured = i;` at the top of the loop body and close over `captured` instead of `i`. Each iteration creates a new variable, so each lambda holds an independent snapshot.

```csharp
var funcs = new List<Func<int>>();
for (int i = 0; i < 3; i++)
    funcs.Add(() => i);               // all capture the SAME variable i
string.Join(", ", funcs.Select(f => f()))   // Bad

// Fix: capture a copy
var funcsGood = new List<Func<int>>();
for (int i = 0; i < 3; i++)
{
    int captured = i;                 // new variable each iteration
    funcsGood.Add(() => captured);
}
string.Join(", ", funcsGood.Select(f => f()))   // Good
```

    [3, 3, 3]
    [0, 1, 2]

## Delegates & Events

#### Delegate, Func&lt;T&gt;, Action&lt;T&gt; — delegate type declarations

Delegates declare a function signature as a type — type-safe function pointers. Built-in: `Func<T, TResult>` (returns value), `Action<T>` (void), `Predicate<T>` (returns bool). Custom: `delegate int Op(int a, int b)`. Delegates can chain multiple methods via `+=` (multicast). Events are restricted delegates that only the owner can invoke.

> [!warning] Multicast delegate return values
>
> With multicast delegates, only the **last** handler's return value is kept. Use `Func`/`Action` for simple cases — custom delegate types add unnecessary ceremony.

> [!success] Use Action for fire-and-forget multicasting
>
> When all subscribers perform side effects (logging, UI updates, pipeline steps), use `Action<T>` — return values are irrelevant and the multicast discard issue never arises.

```csharp
int Add(int a, int b) => a + b;
int Multiply(int a, int b) => a * b;

MathOp op = Add;
op(3, 4)   // Add
op = Multiply;
op(3, 4)   // Mul

delegate int MathOp(int a, int b);     // custom delegate type
```

    7
    12

#### Multicast delegates — += to chain, invoke all subscribers

`+=` adds a handler, `-=` removes. Invoking calls all registered handlers in order. Observer pattern — multiple subscribers notified by one invoke. Don't forget to remove handlers to avoid memory leaks.

```csharp
Action<string> pipeline = msg => Console.WriteLine($"  Step 1: {msg}");
pipeline += msg => Console.WriteLine($"  Step 2: {msg.ToUpper()}");
pipeline += msg => Console.WriteLine($"  Step 3: {msg.Length} chars");

Console.WriteLine("Calling pipeline:");
pipeline("hello world");    // all 3 functions execute

```

> [!info] Delegate Removal
> Delegates support `-=` to remove handlers from the invocation list, enabling dynamic pipeline step management at runtime.
      Step 1: hello world
      Step 2: HELLO WORLD
      Step 3: 11 chars

#### Method groups and callbacks

`Action<string> h = PrintUpper` — no parentheses, no lambda wrapper. Compiler creates the delegate automatically. Works with LINQ: `.Select(Transform)`, `.Where(IsValid)`. Use lambda only when additional arguments or transformation are needed.

```csharp
void PrintUpper(string s) => Console.WriteLine($"  {s.ToUpper()}");

Action<string> handler = PrintUpper;    // no () — passing the method itself
handler("method group");
```

> [!info] Lambda vs Method Group in LINQ
>
> With LINQ you can pass a method directly instead of wrapping it in a lambda:
> `names.Select(Transform)` instead of `names.Select(n => Transform(n))`.
> However, instance methods like `string.ToUpper()` can't be used as method
> groups because they require an instance — use a lambda instead:
> `names.Select(n => n.ToUpper())`.

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

    2 4 6

## Method Overloading & Extension Methods

**Method overloading:** multiple methods with the same name but different parameter types or counts. The compiler resolves the correct overload at compile time — clean API, no runtime overhead, backward compatible.

**Extension methods:** add methods to existing types without modifying their source code. Defined as static methods in a static class with `this` before the first parameter. LINQ methods (`.Where`, `.Select`, `.OrderBy`) are all extension methods on `IEnumerable<T>`.

> [!warning] Overloading pitfalls
>
> - Overloads that do fundamentally different things — confusing API
> - Too many overloads — use optional/named parameters or generics instead
> - Ambiguous overloads cause compiler errors when it can't decide

> [!success] Clean overloading guidelines
>
> - All overloads should do the same logical operation on different input types
> - Prefer optional/named parameters when the logic is identical; use generics when one method can handle all types
> - If the compiler reports ambiguity, add an explicit cast at the call site or consolidate overloads

#### Method overloading — same name, different parameters

The compiler picks the most specific overload by argument types. `Format(42)` resolves to `Format(int)`, `Format(3.14)` to `Format(double)`. Numeric promotions: `int` can promote to `double` but not vice versa. Use generics when one method can handle all types.

```csharp
string Format(int value) => $"int: {value}";
string Format(double value) => $"double: {value:F2}";
string Format(string value) => $"string: '{value}'";
string Format(int a, int b) => $"two ints: {a} + {b} = {a + b}";

Format(42)
Format(3.14)
Format("hello")
Format(10, 20)
```

    42
    3.14
    'hello'
    10 + 20 = 30

#### Extension methods and LINQ

Static method in a static class with `this` as first parameter: `static int WordCount(this string s)`. Enables fluent syntax: `"hello".WordCount()`. LINQ is built entirely with extension methods on `IEnumerable<T>`. Don't extend `object` — pollutes IntelliSense for all types.

> [!info] LINQ Is Built on Extension Methods
>
> Every LINQ method (`.Where`, `.Select`, `.OrderBy`) is an extension method on `IEnumerable<T>`.
> The simplified signature of `.Where`: `static IEnumerable<T> Where<T>(this IEnumerable<T> source, Func<T, bool> predicate)` — the `this` keyword before the first parameter makes it an extension method.

```csharp
var nums = new[] { 1, 2, 3, 4, 5 };
string.Join(", ", nums.Where(x => x > 2).Select(x => x * 10))   // Where+Select
```

    [30, 40, 50]
