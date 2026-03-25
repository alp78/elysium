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
// Function Basics
//
// KEY CONCEPTS:
// - Method: C#'s term for a function. Must declare return type (or void for no return).
// - void: means the method returns nothing.
// - Local functions: functions defined inside other functions.
//   Available since C# 7. In notebooks, top-level functions are actually local functions.


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
// Expression-bodied methods use => for single-expression returns; tuples return multiple values
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
// Func<T,TResult> stores a method reference; Action<T> stores a void method; both are first-class values
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
// Callbacks — pass Action<T> for success/error handlers; caller defines what happens
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
// Strategy pattern — swap pricing logic at runtime by passing a different Func
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
// steps is a List of Func<string, string> — each function takes a string and returns a string.
// 's' in each lambda is the string parameter
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
// Dependency injection — accept Func<DateTime> so tests can inject a fake clock
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
// Production call — uses real DateTime.UtcNow by default
var order1 = ProcessOrder(new Dictionary<string, object> { ["id"] = 1 });
Console.WriteLine($"  Production: {order1["processed_at"]}");
```

      Production: 25-Mar-26 1:21:14

#### Test — inject fake time

```csharp
// Test — inject a fixed DateTime to get deterministic output
var order2 = ProcessOrder(
    new Dictionary<string, object> { ["id"] = 2 },
    getNow: () => new DateTime(2024, 1, 1, 12, 0, 0));
Console.WriteLine($"  Test:       {order2["processed_at"]}");
```

      Test:       01-Jan-24 12:00:00

#### Progress callback

```csharp
// Action<int, int, string>? onProgress:
//   Action<int, int, string> = a function that takes (int, int, string) and returns void
//   ? = nullable — the caller can choose not to provide it (defaults to null)
//   This is a callback slot: "if you give me a function, I'll call it for each item"
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
// Sorting with Func as key — OrderByDescending takes a lambda that extracts the sort value
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

```csharp
// Summary — common patterns for passing functions as arguments
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
// ref — caller and method share the same variable; changes inside propagate out
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
// out — method must assign a value; common in TryParse pattern
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
// in — read-only reference; avoids copying large structs without allowing mutation
double Distance(in (double x, double y) point)
    => Math.Sqrt(point.x * point.x + point.y * point.y);
Console.WriteLine($"  in: {Distance((3, 4))}");
```

      in: 5

<h4><code style="font-size:0.75em">params</code> — variable arguments</h4>

```csharp
// params — accepts a variable number of arguments collected into an array
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
// Option 1: anonymous object (common in ASP.NET)
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
// Statement lambda — braces allow multiple statements, explicit return required
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
// Lambdas with LINQ — pass inline functions to OrderBy, Select, Where, MinBy
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
// Action for side effects; Predicate<T> for boolean tests used by List methods
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

```csharp
// Closure capture — lambda captures the variable itself, not its value at definition time
int multiplier = 3;
Func<int, int> times = x => x * multiplier;   // captures 'multiplier'
Console.WriteLine($"times(5): {times(5)}");    // 15
multiplier = 10;                                // change captured variable
Console.WriteLine($"times(5): {times(5)}");    // 50 — sees the change!
```

    times(5): 15
    times(5): 50

```csharp
// Summary — when to use lambdas vs named methods
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
// Closures capture variables — the returned lambda keeps a reference to the enclosing scope's n
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

```csharp
// Closure modifies outer variable — the lambda and the caller share the same counter
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
// Counter factory — each call to MakeCounter creates an independent closure over count
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

```csharp
// Range validator factory — closure captures min and max for reuse
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
// Loop capture gotcha — all lambdas share the same loop variable; fix by copying into a local
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
// NOT a pipeline, each function is independent and consumes the same msg input
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
// Method group — pass a method name without () to use it as a delegate value
void PrintUpper(string s) => Console.WriteLine($"  {s.ToUpper()}");

Action<string> handler = PrintUpper;    // no () — passing the method itself
handler("method group");

// With LINQ — can pass method directly instead of lambda
var names = new[] { "alice", "bob", "charlie" };
// Lambda:      names.Select(n => n.ToUpper())
// Method group: not possible here because ToUpper is instance method
```

      METHOD GROUP

```csharp
// Callback via Action<T> — ProcessData calls onProcessed for each result
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
// Same name, different parameter types — compiler resolves the correct overload at compile time
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
// Must be in a static class — but in notebooks we can use local functions with similar effect
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
