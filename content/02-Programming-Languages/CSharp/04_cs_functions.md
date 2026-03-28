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

```csharp
// Function basics — methods, return types, void, and parameters
//
// Technique: C# methods must declare return type (int, string, void).
//   void means no return value. Parameters are typed. Methods belong
//   to classes but .NET Interactive allows top-level local functions.
//
// Benefits:
//   - Static typing catches signature mismatches at compile time
//   - Return type is documented in the signature — no guessing
//   - Overloading allows same name with different parameter types
//
// Anti-patterns:
//   - Returning null instead of a meaningful empty value or Optional
//   - Very long parameter lists — use a config object or builder
//   - Methods doing too much — single responsibility principle
//
// When to use:
//   - Every named piece of reusable logic
//
// When NOT to use:
//   - Trivial one-liners used once — inline or use a lambda

// Function Basics


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

```csharp
// Expression-bodied methods — => for single-expression, tuples for multiple returns
//
// Technique: => syntax eliminates braces and return for one-liners.
//   Tuples return multiple values: (string, int) GetInfo() => ("Alice", 30).
//   Callers destructure: var (name, age) = GetInfo().
//
// Benefits:
//   - Concise — no braces or return keyword for simple methods
//   - Tuples avoid creating a class just to return two values
//   - Named tuple fields for clarity: (string Name, int Age)
//
// Anti-patterns:
//   - Expression body for complex logic — readability suffers
//   - More than 3-4 values via tuple — use a record or class
//
// When to use:
//   - Simple one-expression methods; returning 2-3 related values
//
// When NOT to use:
//   - Multi-statement logic — use block body with braces

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

```csharp
// Func<T,TResult> and Action<T> — store and pass function references
//
// Technique: Func<T, TResult> holds a method that returns a value.
//   Action<T> holds a void method. Both store lambdas, named methods,
//   or method groups. Enables passing functions as arguments.
//
// Benefits:
//   - Functions as first-class values — store, pass, return them
//   - Type-safe — compiler checks parameter and return types
//   - Enables strategy, callback, and pipeline patterns
//
// Anti-patterns:
//   - Custom delegate types when Func/Action suffice
//   - Very long Func signatures — define a delegate type for readability
//
// When to use:
//   - Callbacks, LINQ lambdas, strategy pattern, dependency injection
//
// When NOT to use:
//   - Event handlers — use EventHandler<T> or custom delegates

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

```csharp
// Callbacks — pass Action<T> for success/error response handling
//
// Technique: Accept Action<string> onSuccess and Action<Exception> onError.
//   The caller defines what happens on each outcome. Decouples the
//   operation from its response handling.
//
// Benefits:
//   - Caller controls the response — logging, UI, retry, or ignore
//   - Decouples operation from side effects — testable and composable
//
// Anti-patterns:
//   - Null callbacks without null checks — NullReferenceException
//   - Too many callback parameters — use an interface or event
//
// When to use:
//   - Async completion, event-driven processing, plugin hooks
//
// When NOT to use:
//   - Simple return values — just return the result directly

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

```csharp
// Strategy pattern — swap behavior at runtime via Func parameters
//
// Technique: Define interchangeable Func<T, TResult> for each strategy.
//   Pass the desired one to the consuming method. Change behavior
//   without modifying code — open/closed principle.
//
// Benefits:
//   - Add strategies without modifying consumers
//   - Runtime flexibility — select strategy from config, user, context
//   - Testable — inject mock strategies for unit tests
//
// Anti-patterns:
//   - if/else chains to select behavior — use a dictionary of strategies
//   - Complex strategies in lambdas — extract to named methods
//
// When to use:
//   - Pricing rules, validation rules, sorting strategies, formatters
//
// When NOT to use:
//   - Single fixed behavior — direct method call is simpler

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

```csharp
// Pipeline — chain Func steps sequentially with Aggregate
//
// Technique: Store steps as List<Func<string, string>>. Aggregate folds
//   the input through each step. Each step receives previous step's output.
//
// Benefits:
//   - Steps are composable — add, remove, reorder without changing others
//   - Aggregate folds in one line
//   - Each step independently testable
//
// Anti-patterns:
//   - Mutating shared state between steps — each should be pure
//   - Too many steps — break into named sub-pipelines
//
// When to use:
//   - Text processing, data transformation, middleware chains
//
// When NOT to use:
//   - Steps with side effects — use explicit sequential calls

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

```csharp
// Dependency injection via Func — inject fake time for testability
//
// Technique: Accept Func<DateTime> getNow with default DateTime.UtcNow.
//   Production uses the default. Tests inject a fixed DateTime for
//   deterministic, reproducible results.
//
// Benefits:
//   - Testable — inject fixed time for reproducible test results
//   - No interface needed — Func<DateTime> is lightweight DI
//   - Default value means production callers need no changes
//
// Anti-patterns:
//   - DateTime.Now directly — untestable, non-deterministic
//   - Creating an interface for one method — Func is simpler
//
// When to use:
//   - Any code depending on DateTime, random, or external state
//
// When NOT to use:
//   - Complex dependencies — use a full DI container

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

```csharp
// Production call — default Func<DateTime> uses real UtcNow
//
// Technique: Call ProcessOrder without getNow parameter — default
//   provides DateTime.UtcNow. No test infrastructure in production path.
//
// Benefits:
//   - Default parameter means production code is unchanged
//   - No test-only code paths in production
//
// Anti-patterns:
//   - Hardcoding DateTime.Now inside the method — can't test
//
// When to use:
//   - Normal production calls where real time is appropriate
//
// When NOT to use:
//   - Tests or reproducible runs — inject a fixed clock

var order1 = ProcessOrder(new Dictionary<string, object> { ["id"] = 1 });
Console.WriteLine($"  Production: {order1["processed_at"]}");
```

      Production: 25-Mar-26 1:21:14

#### Test — inject fake time

```csharp
// Test with injected time — fixed DateTime for deterministic tests
//
// Technique: Pass getNow: () => new DateTime(2024, 1, 15) to freeze time.
//   Tests produce identical results on every run. No mocking framework needed.
//
// Benefits:
//   - Reproducible — same output every run
//   - No mocking framework — just a lambda
//
// Anti-patterns:
//   - Testing with real time — results vary, flaky tests
//
// When to use:
//   - Unit tests, integration tests, snapshot testing
//
// When NOT to use:
//   - Production code — use real time via the default

var order2 = ProcessOrder(
    new Dictionary<string, object> { ["id"] = 2 },
    getNow: () => new DateTime(2024, 1, 1, 12, 0, 0));
Console.WriteLine($"  Test:       {order2["processed_at"]}");
```

      Test:       01-Jan-24 12:00:00

#### Progress callback

```csharp
// Progress callback — optional Action for reporting iteration progress
//
// Technique: Accept Action<int, int, string>? (nullable). Call with
//   onProgress?.Invoke(current, total, message). Callers can omit it.
//
// Benefits:
//   - Caller controls display — console, UI, logging, or nothing
//   - Nullable — no overhead when not needed
//   - Decouples processing from reporting
//
// Anti-patterns:
//   - Hardcoding Console.WriteLine — not reusable
//   - Calling without null check — NullReferenceException
//
// When to use:
//   - Long-running ops: file processing, batch imports, downloads
//
// When NOT to use:
//   - Fast operations where progress adds overhead without value

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

```csharp
// Sorting with Func key — OrderBy/OrderByDescending with lambdas
//
// Technique: LINQ OrderBy(x => x.Property) extracts the sort key.
//   ThenBy for secondary. GroupBy + Select for aggregation over groups.
//
// Benefits:
//   - Declarative — specify what to sort by, not how
//   - Composable — chain multiple sort criteria
//   - Lambda key selector works with any property
//
// Anti-patterns:
//   - OrderBy then OrderBy — second replaces first; use ThenBy
//   - Sorting inside a loop — sort once, iterate the result
//
// When to use:
//   - Ranked output, top-N queries, grouped reports
//
// When NOT to use:
//   - In-place sorting — use List.Sort() for better performance

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

#### Summary — common function-passing patterns

```csharp
// Summary — common function-passing patterns reference
//
// Technique: Quick reference of Func/Action patterns: callbacks, strategy,
//   pipeline, DI, progress, sorting key.
//
// Benefits:
//   - Quick lookup for choosing the right function-passing pattern
//
// Anti-patterns:
//   - Using the wrong pattern — match to the use case
//
// When to use:
//   - Designing APIs that accept function parameters
//
// When NOT to use:
//   - N/A — this is a reference summary

Console.WriteLine("Callbacks:    Action<string> onSuccess, Action<Exception> onError");
Console.WriteLine("Strategy:     Func<decimal, decimal> pricingStrategy");
Console.WriteLine("Pipeline:     List<Func<string, string>> steps + Aggregate");
Console.WriteLine("DI/Testing:   Func<DateTime> getNow — inject fake time");
Console.WriteLine("Events:       Action<int, int, string> onProgress hooks");
Console.WriteLine("Sorting:      .OrderBy(e => e.Salary) — Func<T, TKey>");
```

    Callbacks:    Action<string> onSuccess, Action<Exception> onError
    Strategy:     Func<decimal, decimal> pricingStrategy
    Pipeline:     List<Func<string, string>> steps + Aggregate
    DI/Testing:   Func<DateTime> getNow — inject fake time
    Events:       Action<int, int, string> onProgress hooks
    Sorting:      .OrderBy(e => e.Salary) — Func<T, TKey>

## Parameters

#### Default and named parameters

```csharp
// Default and named parameters — optional values and argument clarity
//
// Technique: Default values in signature: void Func(int x = 10). Named
//   arguments at call site: Func(x: 5, y: 10). Defaults must be
//   compile-time constants. Named args can be in any order.
//
// Benefits:
//   - Defaults eliminate overloads for optional parameters
//   - Named args make calls self-documenting: Connect(port: 8080, host: "localhost")
//   - Combination enables flexible APIs with few required params
//
// Anti-patterns:
//   - Mutable reference types as defaults — shared across calls (use null + ??)
//   - Too many defaulted params — use an options class instead
//
// When to use:
//   - Optional configuration, backward-compatible API extensions
//
// When NOT to use:
//   - When all parameters are required — defaults add ambiguity

// Parameters — default, named, ref, out, in, params
//
// KEY CONCEPTS:
// - Default values: void Func(int x = 10) — must be compile-time constants.
// - Named arguments: Func(x: 5, y: 10) — can skip positional order.
// - ref: pass by reference — the method can READ and MODIFY the caller's variable.
// - out: like ref but the variable doesn't need to be initialized first.
//   The method MUST assign a value before returning. Common for TryParse pattern.
// - in: pass by reference but READ-ONLY — the method cannot modify it.
//   Used for large structs to avoid copying without risking mutation.
// - params: accepts variable number of arguments as an array.
// - No **kwargs equivalent — use anonymous objects or dictionaries instead.
// - No mutable default trap: defaults must be compile-time constants.

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

```csharp
// ref — pass by reference for two-way communication
//
// Technique: ref int x passes the variable itself. Changes inside the
//   method are visible to the caller. Both sides must use ref keyword.
//   Variable must be initialized before passing.
//
// Benefits:
//   - Methods can modify caller's value-type variables
//   - Efficient for large structs — no copy, just a reference
//
// Anti-patterns:
//   - ref for output-only — use out instead (clearer intent)
//   - Multiple ref params — return a tuple or object instead
//
// When to use:
//   - Swap functions, in-place modification, interop
//
// When NOT to use:
//   - Output-only — use out; reference types already pass by reference

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

```csharp
// out — method must assign a value before returning
//
// Technique: out int result requires assignment before return. TryParse
//   pattern: if (int.TryParse(s, out int n)) combines check + extraction.
//   Inline declaration: no pre-declaration needed.
//
// Benefits:
//   - Compiler enforces assignment — can't forget to set output
//   - TryParse is the standard safe parsing pattern
//   - Inline: TryParse(s, out int n) — clean one-liner
//
// Anti-patterns:
//   - Multiple out params — return a tuple or result object
//   - out when ref is needed — out doesn't pass input to method
//
// When to use:
//   - TryParse, methods returning success + value
//
// When NOT to use:
//   - When a return value or tuple suffices

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

```csharp
// in — read-only reference avoiding copies of large value types
//
// Technique: in passes by reference but prevents modification. Compiler
//   enforces read-only. Avoids copying large structs while guaranteeing
//   the method can't change the caller's value.
//
// Benefits:
//   - No copy overhead for large structs (Matrix, Vector3D)
//   - Read-only guarantee — safer than ref
//
// Anti-patterns:
//   - in for small types (int, double) — copy is just as fast
//   - in for reference types — already passed by reference
//
// When to use:
//   - Large struct parameters (>16 bytes) in performance-critical code
//
// When NOT to use:
//   - Small value types — indirection overhead exceeds copy cost

double Distance(in (double x, double y) point)
    => Math.Sqrt(point.x * point.x + point.y * point.y);
Console.WriteLine($"  in: {Distance((3, 4))}");
```

      in: 5

<h4><code style="font-size:0.75em">params</code> — variable arguments</h4>

```csharp
// params — accept any number of arguments as an array
//
// Technique: params int[] numbers accepts variable arguments. Compiler
//   creates the array. Must be the last parameter. Callers can also
//   pass an existing array directly.
//
// Benefits:
//   - Flexible: Total(1, 2, 3) and Total(myArray) both work
//   - No manual array creation at call site
//
// Anti-patterns:
//   - params with other params after — compiler error (must be last)
//   - Large arrays via params — new array each call
//
// When to use:
//   - Utility methods: Math.Min, string.Format, logging
//
// When NOT to use:
//   - Collection parameter is more appropriate — List<T> or IEnumerable<T>

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

```csharp
// No **kwargs — C# alternatives for flexible key-value arguments
//
// Technique: (1) Anonymous object: new { key = value }. (2) Dictionary.
//   (3) Named params with defaults. Anonymous objects common in ASP.NET.
//
// Benefits:
//   - Anonymous objects have clean syntax: new { page = "home", x = 42 }
//   - Dictionary is fully dynamic — runtime keys
//   - Named params give compile-time safety
//
// Anti-patterns:
//   - Reflection on anonymous objects in hot paths — slow
//   - Dictionary when named params would give type safety
//
// When to use:
//   - Anonymous for framework APIs; Dictionary for dynamic key sets
//
// When NOT to use:
//   - Known parameter types — use typed parameters

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

```csharp
// Lambda expressions — anonymous inline functions
//
// Technique: (params) => expression for single-expression lambdas.
//   (params) => { statements } for multi-statement with explicit return.
//   Assigned to Func<T, TResult>, Action<T>, or Predicate<T> variables.
//
// Benefits:
//   - Inline — no separate method declaration needed
//   - Closures — capture variables from enclosing scope automatically
//   - LINQ integration — Where(x => x > 5), Select(x => x * 2)
//
// Anti-patterns:
//   - Complex lambdas (>3 lines) — extract to a named method
//   - Lambdas with side effects in LINQ — use foreach for clarity
//
// When to use:
//   - LINQ queries, event handlers, callbacks, short inline logic
//
// When NOT to use:
//   - Complex logic — named methods are more readable and debuggable

// Lambda expressions — anonymous inline functions assigned to Func or Action variables
//
// KEY CONCEPTS:
// - Lambda: (params) => expression  or  (params) => { statements; }
// - Expression lambda: (x, y) => x + y — single expression, return is implicit.
// - Statement lambda: (x) => { var y = x * 2; return y; } — multi-line with braces.
// - Func<T, TResult>: delegate type for lambdas that return a value.
// - Action<T>: delegate type for lambdas that return void.

Func<int, int> square = x => x * x;
Func<int, int, int> add = (a, b) => a + b;

Console.WriteLine($"square(5): {square(5)}");
Console.WriteLine($"add(3, 4): {add(3, 4)}");
```

    square(5): 25
    add(3, 4): 7

#### Statement lambda — multi-line body

```csharp
// Statement lambda — multi-line with braces and explicit return
//
// Technique: (params) => { statements; return value; }. Braces and
//   explicit return required. Supports if/else, loops, try/catch.
//
// Benefits:
//   - Full method body syntax — any statement allowed
//   - Still captures enclosing scope (closure)
//
// Anti-patterns:
//   - Statement lambdas >5 lines — extract to named method
//   - Missing return in statement lambda — compiles as void Action
//
// When to use:
//   - Multi-step transformations in LINQ or callbacks
//
// When NOT to use:
//   - Single expressions — use expression lambda (no braces)

Func<int, string> classify = (x) => {
    if (x > 0) return "positive";
    if (x < 0) return "negative";
    return "zero";
};
Console.WriteLine($"classify(-5): {classify(-5)}");
```

    classify(-5): negative

#### Lambdas with LINQ

```csharp
// Lambdas with LINQ — inline functions for sorting, filtering, projection
//
// Technique: Pass lambdas to OrderBy, Select, Where, MinBy. Lambda
//   extracts or transforms each element. Method chains compose operations.
//
// Benefits:
//   - Declarative — describe the transformation, not the loop
//   - Composable — chain without intermediate variables
//   - Type-inferred — compiler deduces lambda parameter types
//
// Anti-patterns:
//   - Complex lambdas in LINQ — extract to named methods
//   - Stateful lambdas capturing mutable variables — surprising behavior
//
// When to use:
//   - Sorting, filtering, projection, aggregation on collections
//
// When NOT to use:
//   - Side effects (printing, writing) — use foreach

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

```csharp
// Action, Predicate, and closure capture
//
// Technique: Action<T> for side-effect lambdas (void). Predicate<T> for
//   boolean tests used by List.FindAll, Exists. Closures capture the
//   variable reference, not its value — changes are shared.
//
// Benefits:
//   - Action separates "what to do" from "when to do it"
//   - Predicate integrates with List's built-in search methods
//   - Closures enable stateful lambdas without objects
//
// Anti-patterns:
//   - Capturing loop variables — all lambdas share same variable
//   - Mutating captured variables from multiple threads — races
//
// When to use:
//   - Action for logging, notifications; Predicate for filtering
//
// When NOT to use:
//   - Complex predicates — extract to a named method

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

```csharp
// Closure capture — lambda captures variable reference, not snapshot
//
// Technique: Lambda sees the CURRENT value of captured variable, not
//   the value at definition time. If multiplier changes after lambda
//   is defined, lambda uses the new value.
//
// Benefits:
//   - Shared state between lambda and enclosing scope — counters, accumulators
//   - Automatic — no explicit passing needed
//
// Anti-patterns:
//   - Assuming captured value is frozen — it's not
//   - Capturing loop variables — all iterations share same variable
//
// When to use:
//   - Accumulators, counters, memoization closures
//
// When NOT to use:
//   - When frozen value is needed — copy to local variable first

int multiplier = 3;
Func<int, int> times = x => x * multiplier;   // captures 'multiplier'
Console.WriteLine($"times(5): {times(5)}");    // 15
multiplier = 10;                                // change captured variable
Console.WriteLine($"times(5): {times(5)}");    // 50 — sees the change!
```

    times(5): 15
    times(5): 50

#### Summary — lambdas vs named methods

```csharp
// Summary — lambda vs named method decision guide
//
// Technique: Lambda for LINQ, event handlers, short inline logic.
//   Named method for reusable logic, complex bodies, debugging.
//
// Benefits:
//   - Quick decision guide for consistent code style
//
// Anti-patterns:
//   - Complex lambdas that should be methods
//   - Named methods for trivial one-liners used once
//
// When to use:
//   - Deciding between lambda and named method
//
// When NOT to use:
//   - N/A — reference summary

Console.WriteLine("Use lambda:  with LINQ, event handlers, callbacks, short inline logic");
Console.WriteLine("Use method:  reusable, complex, needs documentation");
Console.WriteLine("Statement lambda: allows multi-line body with braces and explicit return");
```

    Use lambda:  with LINQ, event handlers, callbacks, short inline logic
    Use method:  reusable, complex, needs documentation
    Statement lambda: allows multi-line body with braces and explicit return

## Closures & Scope

#### Block scope

```csharp
// Block scope — variables are scoped to their enclosing braces
//
// Technique: C# uses block-level scoping defined by {}. A variable is
//   visible from its declaration to the end of its block. Inner blocks
//   can see outer variables; outer blocks cannot see inner variables.
//
// Benefits:
//   - Prevents accidental use of variables outside their intended scope
//   - Compiler catches undeclared variable errors at build time
//
// Anti-patterns:
//   - Declaring variables far from their use — declare close to first use
//   - Reusing a variable name in nested scope — shadows outer variable
//
// When to use:
//   - Always — block scoping is enforced by the language
//
// When NOT to use:
//   - N/A — C# has no alternative scoping mechanism

// Closures & Variable Scope
//
// KEY CONCEPTS:
// - Scope: C# uses block-level scoping (defined by {}).
//   A variable is visible from its declaration to the end of its enclosing block.
// - Closure: a lambda or local function that captures variables from its enclosing scope.
//   The captured variable itself is shared, not a copy of its value.
// - Loop capture gotcha: lambdas in a loop all share the same loop variable.
//   Fix: copy into a local variable inside the loop body.

{
    int x = 10;
    Console.WriteLine($"  Inside block: {x}");
}
// x is not accessible here — block scope ended
```

      Inside block: 10

#### Closures capture variables

```csharp
// Closures — returned lambda keeps enclosing scope's variables alive
//
// Technique: Lambda returned from a method retains access to the method's
//   locals. Variable lives on heap (not stack) because closure keeps a
//   reference. This is the "closure" pattern.
//
// Benefits:
//   - Factory functions: MakeAdder(5) returns x => x + 5
//   - State encapsulated — no external variable needed
//   - Each call creates independent state
//
// Anti-patterns:
//   - Large closures capturing many variables — memory leak risk
//   - Assuming captured variables are copied — shared references
//
// When to use:
//   - Factory functions, parameterized callbacks, memoization
//
// When NOT to use:
//   - When a class with explicit state is clearer

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

```csharp
// Closure modification — lambda and caller share the same variable
//
// Technique: Closure can read AND modify captured variables. Both the
//   lambda and enclosing scope see the same variable. Enables counters.
//
// Benefits:
//   - Shared mutable state without explicit objects
//   - Simple counter: Action increment = () => counter++
//
// Anti-patterns:
//   - Unintended mutation — caller may not expect lambda to modify state
//   - Thread safety — shared mutable state without locks
//
// When to use:
//   - Simple counters, accumulators in single-threaded code
//
// When NOT to use:
//   - Multi-threaded — use Interlocked or locks

int counter = 0;
Action increment = () => counter++;
increment();
increment();
increment();
Console.WriteLine($"counter: {counter}");      // 3 — closure modified outer variable
```

    counter: 3

#### Closure as state — counter factory

```csharp
// Counter factory — each call creates independent closure state
//
// Technique: MakeCounter() returns Func<int> closing over a local count.
//   Each call creates a new, independent counter. State is private.
//
// Benefits:
//   - Encapsulated state — no public fields
//   - Independent instances — multiple counters don't interfere
//   - Lightweight — no class definition needed
//
// Anti-patterns:
//   - Sharing returned Func across threads without synchronization
//   - Complex state — use a class with methods
//
// When to use:
//   - Simple state machines, ID generators, rate limiters
//
// When NOT to use:
//   - Complex state with multiple operations — use a class

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

```csharp
// Range validator factory — parameterized closure for reusable checks
//
// Technique: MakeRangeValidator(min, max) returns Func<int, bool> that
//   tests [min, max]. Each call creates an independent validator.
//
// Benefits:
//   - Reusable — create validators for different ranges
//   - Composable — items.Where(isValid)
//   - Lightweight — no class needed
//
// Anti-patterns:
//   - Hardcoding ranges — factory pattern is more flexible
//
// When to use:
//   - Parameterized validation, configurable filters, rule engines
//
// When NOT to use:
//   - Complex validation — use a validator class

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

```csharp
// Loop capture gotcha — all lambdas share the same loop variable
//
// Technique: Lambdas in a loop capture the variable itself. After the
//   loop, all see the final value. Fix: copy to local inside the loop.
//
// Benefits:
//   - Understanding prevents a common and subtle bug
//   - Local copy (int copy = i) is the standard fix
//
// Anti-patterns:
//   - Assuming each iteration captures its own value — it doesn't
//   - Captured loop vars in callbacks — delayed eval sees final value
//
// When to use:
//   - Always apply the local copy fix when creating closures in loops
//
// When NOT to use:
//   - foreach in C# 5+ — variable is captured per-iteration

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

```csharp
// Delegate types — type-safe function pointers
//
// Technique: Delegates declare a function signature as a type. Func<T, TResult>
//   and Action<T> are built-in. Custom delegates: delegate int Op(int a, int b).
//   Delegates can be combined (multicast) with += and -=.
//
// Benefits:
//   - Type-safe — compiler checks parameter and return types
//   - Multicast — invoke multiple methods with one call
//   - Foundation for events, callbacks, and LINQ
//
// Anti-patterns:
//   - Custom delegate types when Func/Action suffice — unnecessary ceremony
//   - Multicast delegates expecting a single return value — only last wins
//
// When to use:
//   - Event systems, callback registrations, plugin architectures
//
// When NOT to use:
//   - Simple function passing — Func/Action is cleaner than custom delegates

// Delegates & Events — type-safe function pointers
//
// KEY CONCEPTS:
// - Delegate: a type-safe function pointer. Declares a function signature.
//   Func<int, int> is a delegate for "function taking int, returning int".
// - Built-in delegate types:
//   Func<T1, T2, TResult> — function with return value (up to 16 params)
//   Action<T1, T2> — void function (up to 16 params)
//   Predicate<T> — function returning bool
// - Multicast: delegates can chain multiple methods via +=.
// - Events: restricted delegates that only the owner can invoke.

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

```csharp
// Multicast delegates — combine multiple handlers with +=
//
// Technique: += adds a handler; -= removes. Invoking calls all registered
//   handlers in order. Each handler gets the same input independently.
//
// Benefits:
//   - Observer pattern — multiple subscribers notified by one invoke
//   - Dynamic — add/remove handlers at runtime
//   - Foundation for C# events
//
// Anti-patterns:
//   - Expecting return values from multicast — only last handler's return kept
//   - Not removing handlers — memory leaks from long-lived delegates
//
// When to use:
//   - Event notifications, logging hooks, plugin systems
//
// When NOT to use:
//   - Pipelines where output feeds next step — use Aggregate

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

```csharp
// Method groups — pass a method name directly as a delegate
//
// Technique: Action<string> h = PrintUpper — no parentheses. Compiler
//   creates the delegate automatically. Cleaner than lambda wrapper.
//
// Benefits:
//   - Concise — no lambda wrapper for simple delegation
//   - Readable — handler = PrintUpper is self-documenting
//   - Works with LINQ: .Select(Transform), .Where(IsValid)
//
// Anti-patterns:
//   - Lambda wrapper when method group works — redundant
//   - Method groups with overloads — ambiguous, may error
//
// When to use:
//   - Assigning named methods to Func/Action or LINQ
//
// When NOT to use:
//   - Additional arguments or transformation needed — use lambda

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

```csharp
// Callback via Action — per-item notification during processing
//
// Technique: ProcessData accepts Action<int> onProcessed called for each
//   item. Caller defines response logic. Decouples algorithm from output.
//
// Benefits:
//   - Caller controls per-item handling — log, collect, display, ignore
//   - Processing logic reusable with different callbacks
//
// Anti-patterns:
//   - Hardcoding Console.WriteLine — not reusable
//   - Null callback without check — NullReferenceException
//
// When to use:
//   - Batch processing with progress, ETL with row-level hooks
//
// When NOT to use:
//   - Returning results is simpler — use Select/yield return

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

#### Method overloading

```csharp
// Method overloading — same name, different parameter signatures
//
// Technique: Multiple methods with the same name but different parameter
//   types or counts. The compiler resolves the correct overload at
//   compile time based on argument types.
//
// Benefits:
//   - Clean API — one name for related operations: Format(int), Format(double)
//   - Compile-time resolution — no runtime overhead or ambiguity
//   - Backward compatible — add new overloads without breaking existing callers
//
// Anti-patterns:
//   - Overloads that do fundamentally different things — confusing API
//   - Too many overloads — use optional/named parameters or generics
//   - Ambiguous overloads — compiler error when it can't decide
//
// When to use:
//   - Same operation on different types, progressive parameter addition
//
// When NOT to use:
//   - Unrelated operations — use different method names

// Method Overloading & Extension Methods
//
// KEY CONCEPTS:
// - Method overloading: multiple methods with the SAME name but DIFFERENT parameter types
//   or counts. The compiler picks the right one based on arguments.
// - Extension methods: add methods to EXISTING types without modifying their source code.
//   Defined as static methods in a static class, with 'this' before the first parameter.
// - LINQ methods (.Where, .Select, .OrderBy) are all extension methods on IEnumerable<T>.
```

#### Same name, different parameters

```csharp
// Overload resolution — compiler picks best match by argument types
//
// Technique: Format(42) resolves to Format(int). Format(3.14) resolves
//   to Format(double). Compiler uses most specific match. Numeric
//   promotions: int can promote to double but not vice versa.
//
// Benefits:
//   - Automatic — caller doesn't specify which overload
//   - Type-safe — no runtime casting
//
// Anti-patterns:
//   - Relying on implicit numeric conversion surprises
//   - Overloading with object parameter — catches everything
//
// When to use:
//   - Type-specific implementations of the same operation
//
// When NOT to use:
//   - Generics can handle all types with one method

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

```csharp
// Extension methods — add methods to types you don't own
//
// Technique: static method in static class, first param uses this:
//   static int WordCount(this string s). LINQ is built entirely
//   with extension methods on IEnumerable<T>.
//
// Benefits:
//   - Add methods to framework types — string, List<T>, IEnumerable
//   - Fluent: "hello".WordCount() instead of WordCount("hello")
//   - LINQ operators are all extension methods — composable pipeline
//
// Anti-patterns:
//   - Extensions in non-static classes — compile error
//   - Extensions on object — pollutes IntelliSense for all types
//
// When to use:
//   - Utility methods on framework types, LINQ-style pipelines
//
// When NOT to use:
//   - Types you own — add the method directly

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
