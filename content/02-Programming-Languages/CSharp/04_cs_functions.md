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

## 1. Function Basics


```csharp
// Function Basics
//
// KEY CONCEPTS:
// - Method: C#'s term for a function. Must declare return type (or void for no return).
// - void: means the method returns nothing (Python equivalent: returns None implicitly).
// - Local functions: functions defined inside other functions (like Python's nested def).
//   Available since C# 7. In notebooks, top-level functions are actually local functions.
// - Expression-bodied members: shorthand for one-line methods using =>
// - Tuple return: C# can return multiple values via tuples, like Python.
// - Delegates (Func<>, Action<>): C#'s way to treat functions as first-class objects.
//   Func<int, int, int> = function taking 2 ints, returning int.
//   Action<string> = function taking string, returning void.

// === Basic method ===
Console.WriteLine("=== Basic Functions ===");
string Greet(string name)          // return type declared before name
{
    return $"Hello, {name}!";
}
Console.WriteLine(Greet("Alice"));
Console.WriteLine(Greet("Bob"));

// === void — no return value (Python: returns None) ===
void PrintGreeting(string name)
{
    Console.WriteLine($"Hi, {name}!");
}
PrintGreeting("Charlie");

// === Expression-bodied (=>) — one-liner shorthand ===
Console.WriteLine("\n=== Expression-Bodied ===");
string GreetShort(string name) => $"Hello, {name}!";
int Square(int x) => x * x;
Console.WriteLine(GreetShort("Diana"));
Console.WriteLine($"Square(5): {Square(5)}");

// === Multiple return values (tuple) ===
Console.WriteLine("\n=== Multiple Return Values (Tuple) ===");
(int quotient, int remainder) Divide(int a, int b)
{
    return (a / b, a % b);
}
var (q, r) = Divide(17, 5);       // deconstruct
Console.WriteLine($"17 / 5 = {q} remainder {r}");
Console.WriteLine($"As tuple: {Divide(17, 5)}");

// === First-class functions via Func<> and Action<> ===
Console.WriteLine("\n=== First-Class Functions (Func/Action) ===");
// Func<input..., output> — function with return value
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

    probeAddresses(["http://2a02:8308:718a:f200::280b:2048/","http://2a02:8308:718a:f200:8bd4:d06d:33ed:be05:2048/","http://2a02:8308:718a:f200:5d96:773b:ab14:4981:2048/","http://fe80::3212:d8da:d32d:4723%14:2048/","http://192.168.0.110:2048/","http://::1:2048/","http://127.0.0.1:2048/"])

        .then((root) => {

        // use probing to find host url and api resources

        // load interactive helpers and language services

        let dotnetInteractiveRequire = require.config({

        context: '29556.Microsoft.DotNet.Interactive.Http.HttpPort',

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


    === Basic Functions ===
    Hello, Alice!
    Hello, Bob!
    Hi, Charlie!
    
    === Expression-Bodied ===
    Hello, Diana!
    Square(5): 25
    
    === Multiple Return Values (Tuple) ===
    17 / 5 = 3 remainder 2
    As tuple: (3, 2)
    
    === First-Class Functions (Func/Action) ===
    Hello, Eve!
    Hi, Frank!
    Hello, Grace!
    doubler(5) = 10
    tripler(5) = 15
    


```csharp
// Real-World Use Cases for Func<> and Action<>
// Passing functions as arguments is useful when you want to pass BEHAVIOR as a parameter.
// "Do this thing, but I'll tell you HOW."

// === 1. Callbacks — "call me when you're done" ===
Console.WriteLine("=== 1. Callbacks ===");
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

// === 2. Strategy pattern — swap behavior without changing code ===
Console.WriteLine("\n=== 2. Strategy Pattern ===");
Func<decimal, decimal> fullPrice = price => price;
Func<decimal, decimal> discount20 = price => price * 0.8m;
Func<decimal, decimal> memberDiscount = price => price * 0.7m;

decimal Calculate(decimal price, Func<decimal, decimal> strategy) => strategy(price);

Console.WriteLine($"  Full:     ${Calculate(100, fullPrice):F2}");
Console.WriteLine($"  20% off:  ${Calculate(100, discount20):F2}");
Console.WriteLine($"  Member:   ${Calculate(100, memberDiscount):F2}");

// === 3. Data processing pipeline ===
Console.WriteLine("\n=== 3. Pipeline ===");
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

// === 4. Dependency injection / testability ===
Console.WriteLine("\n=== 4. Dependency Injection ===");
Dictionary<string, object> ProcessOrder(
    Dictionary<string, object> order,
    Func<DateTime>? getNow = null)
{
    getNow ??= () => DateTime.UtcNow;          // default: real time
    order["processed_at"] = getNow();
    return order;
}

// Production
var order1 = ProcessOrder(new Dictionary<string, object> { ["id"] = 1 });
Console.WriteLine($"  Production: {order1["processed_at"]}");

// Test — inject fake time
var order2 = ProcessOrder(
    new Dictionary<string, object> { ["id"] = 2 },
    getNow: () => new DateTime(2024, 1, 1, 12, 0, 0));
Console.WriteLine($"  Test:       {order2["processed_at"]}");

// === 5. Event-like hooks ===
Console.WriteLine("\n=== 5. Event Hooks ===");
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

// === 6. Sorting with custom key ===
Console.WriteLine("\n=== 6. Custom Sort Key ===");
var employees = new[]
{
    new { Name = "Alice", Dept = "Engineering", Salary = 95000 },
    new { Name = "Bob", Dept = "Sales", Salary = 65000 },
    new { Name = "Charlie", Dept = "Engineering", Salary = 110000 },
};
foreach (var e in employees.OrderByDescending(e => e.Salary))
    Console.WriteLine($"  {e.Name,-10} ${e.Salary:N0}");

// === Summary ===
Console.WriteLine("\n=== When to use Func<>/Action<> ===");
Console.WriteLine("Callbacks:    Action<string> onSuccess, Action<Exception> onError");
Console.WriteLine("Strategy:     Func<decimal, decimal> pricingStrategy");
Console.WriteLine("Pipeline:     List<Func<string, string>> steps + Aggregate");
Console.WriteLine("DI/Testing:   Func<DateTime> getNow — inject fake time");
Console.WriteLine("Events:       Action<int, int, string> onProgress hooks");
Console.WriteLine("Sorting:      .OrderBy(e => e.Salary) — Func<T, TKey>");
```

    === 1. Callbacks ===
      Got: data from api/users
    
    === 2. Strategy Pattern ===
      Full:     $100.00
      20% off:  $80.00
      Member:   $70.00
    
    === 3. Pipeline ===
      '  Hello   World  ' -> 'hello world'
    
    === 4. Dependency Injection ===
      Production: 18-Mar-26 11:07:16
      Test:       01-Jan-24 12:00:00
    
    === 5. Event Hooks ===
      [1/3] Loading users
      [2/3] Loading orders
      [3/3] Loading products
    
    === 6. Custom Sort Key ===
      Charlie    $110'000
      Alice      $95'000
      Bob        $65'000
    
    === When to use Func<>/Action<> ===
    Callbacks:    Action<string> onSuccess, Action<Exception> onError
    Strategy:     Func<decimal, decimal> pricingStrategy
    Pipeline:     List<Func<string, string>> steps + Aggregate
    DI/Testing:   Func<DateTime> getNow — inject fake time
    Events:       Action<int, int, string> onProgress hooks
    Sorting:      .OrderBy(e => e.Salary) — Func<T, TKey>
    

    
    (58,19): warning CS8632: The annotation for nullable reference types should only be used in code within a '#nullable' annotations context.
    
    (81,55): warning CS8632: The annotation for nullable reference types should only be used in code within a '#nullable' annotations context.
    
    

## 2. Parameters


```csharp
// Parameters — default, named, ref, out, in, params
//
// KEY CONCEPTS:
// - Default values: same as Python: void Func(int x = 10)
// - Named arguments: same as Python: Func(x: 5, y: 10)
// - ref: pass by reference — the method can READ and MODIFY the caller's variable.
//   Python has no equivalent (mutable objects are passed by reference implicitly).
// - out: like ref but the variable doesn't need to be initialized first.
//   The method MUST assign a value before returning. Common for TryParse pattern.
// - in: pass by reference but READ-ONLY — the method cannot modify it.
//   Used for large structs to avoid copying without risking mutation.
// - params: like Python's *args — accepts variable number of arguments as an array.
// - No **kwargs equivalent in C# — use anonymous objects or dictionaries instead.
// - No mutable default trap: C# defaults must be compile-time constants.

// === Default values and named arguments ===
Console.WriteLine("=== Default & Named ===");
string Connect(string host, int port = 5432, bool ssl = true)
    => $"{host}:{port} ssl={ssl}";

Console.WriteLine(Connect("localhost"));                    // all defaults
Console.WriteLine(Connect("db.example.com", 3306));        // override port
Console.WriteLine(Connect("db.example.com", ssl: false));  // named, skip port

// === ref — pass by reference (read + modify) ===
Console.WriteLine("\n=== ref (pass by reference) ===");
void DoubleIt(ref int x)
{
    x *= 2;    // modifies the CALLER'S variable directly
}
int val = 10;
DoubleIt(ref val);              // must use 'ref' at call site too
Console.WriteLine($"After DoubleIt: {val}");   // 20

// === out — must assign, no init needed ===
Console.WriteLine("\n=== out (must assign) ===");
bool TryDivide(int a, int b, out int result)
{
    if (b == 0) { result = 0; return false; }
    result = a / b;
    return true;
}

if (TryDivide(10, 3, out int answer))          // declare inline with 'out int'
    Console.WriteLine($"10 / 3 = {answer}");

// Common pattern: int.TryParse
if (int.TryParse("42", out int parsed))
    Console.WriteLine($"Parsed: {parsed}");
if (!int.TryParse("abc", out int failed))
    Console.WriteLine($"Failed to parse 'abc'");

// === in — pass by reference, read-only ===
Console.WriteLine("\n=== in (read-only reference) ===");
double Distance(in (double x, double y) point)
{
    // point.x = 0;  // Compile error! 'in' is read-only
    return Math.Sqrt(point.x * point.x + point.y * point.y);
}
var pt = (x: 3.0, y: 4.0);
Console.WriteLine($"Distance: {Distance(pt)}");

// === params — variable arguments (like Python's *args) ===
Console.WriteLine("\n=== params (like *args) ===");
int Total(params int[] numbers)       // caller can pass any number of ints
{
    return numbers.Sum();
}
Console.WriteLine($"Total(1,2,3):   {Total(1, 2, 3)}");
Console.WriteLine($"Total(10,20):   {Total(10, 20)}");

// Can also pass an array directly
int[] nums = { 1, 2, 3, 4, 5 };
Console.WriteLine($"Total(array):   {Total(nums)}");

// === No **kwargs — alternatives ===
Console.WriteLine("\n=== No **kwargs — use objects or dictionaries ===");
// Option 1: anonymous object (common in ASP.NET)
void LogEvent(string name, object data) =>
    Console.WriteLine($"  {name}: {data}");
LogEvent("click", new { page = "home", button = "submit" });

// Option 2: dictionary
void LogDict(string name, Dictionary<string, object> data) =>
    Console.WriteLine($"  {name}: {string.Join(", ", data.Select(kv => $"{kv.Key}={kv.Value}"))}");
LogDict("click", new Dictionary<string, object> { ["page"] = "home", ["button"] = "submit" });

// === Key Differences ===
Console.WriteLine("\n=== Key Differences ===");
Console.WriteLine("Python: *args          -> C#: params int[] args");
Console.WriteLine("Python: **kwargs       -> C#: no equivalent (use dict or object)");
Console.WriteLine("Python: mutable default trap  -> C#: defaults must be constants (no trap)");
Console.WriteLine("Python: no ref/out/in  -> C#: ref (read+write), out (write), in (read)");
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

    probeAddresses(["http://2a02:8308:718a:f200::280b:2048/","http://2a02:8308:718a:f200:8bd4:d06d:33ed:be05:2048/","http://2a02:8308:718a:f200:5d96:773b:ab14:4981:2048/","http://fe80::3212:d8da:d32d:4723%14:2048/","http://192.168.0.110:2048/","http://::1:2048/","http://127.0.0.1:2048/"])

        .then((root) => {

        // use probing to find host url and api resources

        // load interactive helpers and language services

        let dotnetInteractiveRequire = require.config({

        context: '8724.Microsoft.DotNet.Interactive.Http.HttpPort',

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


    === Default & Named ===
    localhost:5432 ssl=True
    db.example.com:3306 ssl=True
    db.example.com:5432 ssl=False
    
    === ref (pass by reference) ===
    After DoubleIt: 20
    
    === out (must assign) ===
    10 / 3 = 3
    Parsed: 42
    Failed to parse 'abc'
    
    === in (read-only reference) ===
    Distance: 5
    
    === params (like *args) ===
    Total(1,2,3):   6
    Total(10,20):   30
    Total(array):   15
    
    === No **kwargs — use objects or dictionaries ===
      click: { page = home, button = submit }
      click: page=home, button=submit
    
    === Key Differences ===
    Python: *args          -> C#: params int[] args
    Python: **kwargs       -> C#: no equivalent (use dict or object)
    Python: mutable default trap  -> C#: defaults must be constants (no trap)
    Python: no ref/out/in  -> C#: ref (read+write), out (write), in (read)
    

## 3. Lambda Expressions


```csharp
// Lambda Expressions — anonymous inline functions
//
// KEY CONCEPTS:
// - Lambda: (params) => expression  or  (params) => { statements; }
//   Python equivalent: lambda params: expression
// - Expression lambda: (x, y) => x + y — single expression, return is implicit.
// - Statement lambda: (x) => { var y = x * 2; return y; } — multi-line with braces.
//   Python lambdas CANNOT be multi-line — C# can.
// - Func<T, TResult>: delegate type for lambdas that return a value.
// - Action<T>: delegate type for lambdas that return void.
// - Predicate<T>: shorthand for Func<T, bool> — used in Where, Find, etc.

// === Lambda basics ===
Console.WriteLine("=== Lambda Basics ===");
Func<int, int, int> add = (a, b) => a + b;
Console.WriteLine($"add(3, 4): {add(3, 4)}");

// Statement lambda — multi-line (Python can't do this with lambda)
Func<int, string> classify = (x) => {
    if (x > 0) return "positive";
    if (x < 0) return "negative";
    return "zero";
};
Console.WriteLine($"classify(-5): {classify(-5)}");

// === With LINQ (most common usage) ===
Console.WriteLine("\n=== With LINQ ===");
var names = new[] { "Charlie", "Alice", "Bob", "Diana" };
Console.WriteLine($"By length:    [{string.Join(", ", names.OrderBy(n => n.Length))}]");
Console.WriteLine($"By last char: [{string.Join(", ", names.OrderBy(n => n[^1]))}]");

var nums = new[] { 1, 2, 3, 4, 5 };
Console.WriteLine($"Squared: [{string.Join(", ", nums.Select(x => x * x))}]");
Console.WriteLine($"Evens:   [{string.Join(", ", nums.Where(x => x % 2 == 0))}]");

// === With Min/Max ===
Console.WriteLine("\n=== With Min/Max ===");
var people = new[] { ("Alice", 30), ("Bob", 25), ("Charlie", 35) };
var youngest = people.MinBy(p => p.Item2);
Console.WriteLine($"Youngest: {youngest}");

// === Action (void lambda) ===
Console.WriteLine("\n=== Action (void lambda) ===");
Action<string> shout = msg => Console.WriteLine($"  {msg.ToUpper()}!");
shout("hello");

// === Predicate<T> — shorthand for Func<T, bool> ===
Console.WriteLine("\n=== Predicate ===");
Predicate<int> isEven = x => x % 2 == 0;
var list = new List<int> { 1, 2, 3, 4, 5, 6 };
Console.WriteLine($"FindAll even: [{string.Join(", ", list.FindAll(isEven))}]");
Console.WriteLine($"Exists > 5:   {list.Exists(x => x > 5)}");

// === Closure in lambda ===
Console.WriteLine("\n=== Closure ===");
int multiplier = 3;
Func<int, int> times = x => x * multiplier;   // captures 'multiplier'
Console.WriteLine($"times(5): {times(5)}");    // 15
multiplier = 10;                                // change captured variable
Console.WriteLine($"times(5): {times(5)}");    // 50 — sees the change!

// === Guidelines ===
Console.WriteLine("\n=== Guidelines ===");
Console.WriteLine("Use lambda:  with LINQ, event handlers, callbacks, short inline logic");
Console.WriteLine("Use method:  reusable, complex, needs documentation");
Console.WriteLine("C# advantage: statement lambdas allow multi-line (Python can't)");
```

    === Lambda Basics ===
    add(3, 4): 7
    classify(-5): negative
    
    === With LINQ ===
    By length:    [Bob, Alice, Diana, Charlie]
    By last char: [Diana, Bob, Charlie, Alice]
    Squared: [1, 4, 9, 16, 25]
    Evens:   [2, 4]
    
    === With Min/Max ===
    Youngest: (Bob, 25)
    
    === Action (void lambda) ===
      HELLO!
    
    === Predicate ===
    FindAll even: [2, 4, 6]
    Exists > 5:   True
    
    === Closure ===
    times(5): 15
    times(5): 50
    
    === Guidelines ===
    Use lambda:  with LINQ, event handlers, callbacks, short inline logic
    Use method:  reusable, complex, needs documentation
    C# advantage: statement lambdas allow multi-line (Python can't)
    

## 4. Closures & Scope


```csharp
// Closures & Variable Scope
//
// KEY CONCEPTS:
// - Scope: C# uses block-level scoping (defined by {}).
//   A variable is visible from its declaration to the end of its enclosing block.
//   Python uses function-level scoping (LEGB). C# is stricter.
// - Closure: a lambda or local function that captures variables from its enclosing scope.
//   The captured variable stays alive as long as the closure exists.
// - Captured variable: the closure captures the VARIABLE itself (not a copy of the value).
//   If the variable changes, the closure sees the change (same as Python).
// - No global/nonlocal keywords: C# doesn't need them because class fields and
//   captured variables are accessible directly. Python needs 'global' and 'nonlocal'
//   because of its function-level scoping rules.
// - Static local function: a local function that CANNOT capture variables (C# 8+).
//   Forces you to pass everything as parameters — prevents accidental captures.

// === Block scope ===
Console.WriteLine("=== Block Scope ===");
{
    int x = 10;
    Console.WriteLine($"  Inside block: x = {x}");
}
// Console.WriteLine(x);  // Compile error! x is out of scope

// === Closure — lambda captures outer variable ===
Console.WriteLine("\n=== Closure ===");
Func<int, int> MakeAdder(int n)
{
    // n is captured by the returned lambda
    return x => x + n;
}
var add5 = MakeAdder(5);
var add10 = MakeAdder(10);
Console.WriteLine($"add5(3):  {add5(3)}");     // 8
Console.WriteLine($"add10(3): {add10(3)}");    // 13

// === Captured variable is shared (not copied) ===
Console.WriteLine("\n=== Captured Variable is Shared ===");
int counter = 0;
Action increment = () => counter++;
increment();
increment();
increment();
Console.WriteLine($"counter: {counter}");      // 3 — closure modified outer variable

// === Closure counter (like Python's make_counter) ===
Console.WriteLine("\n=== Closure Counter ===");
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

// === Function factory (like Python's make_validator) ===
Console.WriteLine("\n=== Function Factory ===");
Func<int, bool> MakeRangeValidator(int min, int max)
    => value => value >= min && value <= max;

var isValidAge = MakeRangeValidator(0, 120);
var isValidScore = MakeRangeValidator(0, 100);
Console.WriteLine($"age 25:  {isValidAge(25)}");
Console.WriteLine($"age 150: {isValidAge(150)}");

// === Late binding gotcha (same as Python) ===
Console.WriteLine("\n=== Late Binding Gotcha ===");
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

// === Key Differences ===
Console.WriteLine("\n=== Key Differences ===");
Console.WriteLine("Python: function-level scope (LEGB)  -> C#: block-level scope ({})");
Console.WriteLine("Python: needs 'global'/'nonlocal'    -> C#: not needed (block scope)");
Console.WriteLine("Python: lambda i=i: i (default arg)  -> C#: var captured = i (local copy)");
Console.WriteLine("Both: closures capture VARIABLES, not values (late binding)");
```

    === Block Scope ===
      Inside block: x = 10
    
    === Closure ===
    add5(3):  8
    add10(3): 13
    
    === Captured Variable is Shared ===
    counter: 3
    
    === Closure Counter ===
    c1(): 11
    c1(): 12
    c2(): 1
    
    === Function Factory ===
    age 25:  True
    age 150: False
    
    === Late Binding Gotcha ===
    Bad:  [3, 3, 3]
    Good: [0, 1, 2]
    
    === Key Differences ===
    Python: function-level scope (LEGB)  -> C#: block-level scope ({})
    Python: needs 'global'/'nonlocal'    -> C#: not needed (block scope)
    Python: lambda i=i: i (default arg)  -> C#: var captured = i (local copy)
    Both: closures capture VARIABLES, not values (late binding)
    

## 5. Delegates & Events


```csharp
// Delegates & Events — C#'s function pointer system
// Python has no direct equivalent — closest is passing functions as arguments.
//
// KEY CONCEPTS:
// - Delegate: a type-safe function pointer. Declares a function signature.
//   Func<int, int> is a delegate for "function taking int, returning int".
// - Built-in delegate types:
//   Func<T1, T2, TResult> — function with return value (up to 16 params)
//   Action<T1, T2>        — function returning void (up to 16 params)
//   Predicate<T>          — function returning bool (single param)
// - Multicast delegate: a delegate that holds MULTIPLE functions.
//   Calling it invokes all of them in order. Python has no equivalent.
// - Event: a restricted multicast delegate. External code can only += and -=,
//   not invoke or replace. Used in UI, messaging, observer pattern.
// - C# decorators equivalent: C# [Attributes] add metadata but don't modify behavior.
//   Python @decorators actively wrap/modify functions at runtime.

// === Func, Action, Predicate recap ===
Console.WriteLine("=== Delegate Types ===");
Func<int, int, int> add = (a, b) => a + b;           // returns int
Action<string> log = msg => Console.WriteLine($"  LOG: {msg}");  // returns void
Predicate<int> isPositive = x => x > 0;              // returns bool

Console.WriteLine($"Func:      add(3,4) = {add(3, 4)}");
log("hello");
Console.WriteLine($"Predicate: isPositive(5) = {isPositive(5)}");

// === Multicast delegates — multiple functions on one delegate ===
// NOT a pipeline, each function is independent and consumes the same msg input
Console.WriteLine("\n=== Multicast Delegates ===");
Action<string> pipeline = msg => Console.WriteLine($"  Step 1: {msg}");
pipeline += msg => Console.WriteLine($"  Step 2: {msg.ToUpper()}");
pipeline += msg => Console.WriteLine($"  Step 3: {msg.Length} chars");

Console.WriteLine("Calling pipeline:");
pipeline("hello world");    // all 3 functions execute

// Remove a step
// pipeline -= step;  // can remove specific handlers

// === Method groups — pass method name directly ===
Console.WriteLine("\n=== Method Groups ===");
void PrintUpper(string s) => Console.WriteLine($"  {s.ToUpper()}");

Action<string> handler = PrintUpper;    // no () — passing the method itself
handler("method group");

// With LINQ — can pass method directly instead of lambda
var names = new[] { "alice", "bob", "charlie" };
// Lambda:      names.Select(n => n.ToUpper())
// Method group: not possible here because ToUpper is instance method

// === Practical example: event-like callback ===
Console.WriteLine("\n=== Callback Pattern ===");
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

// === Key Differences ===
Console.WriteLine("\n=== Key Differences ===");
Console.WriteLine("Python: pass any callable directly     -> C#: must match delegate signature");
Console.WriteLine("Python: no multicast (use list of funcs) -> C#: built-in multicast delegates");
Console.WriteLine("Python: @decorator modifies behavior   -> C#: [Attribute] adds metadata only");
Console.WriteLine("Python: no events                      -> C#: events for observer pattern");
```

    === Delegate Types ===
    Func:      add(3,4) = 7
      LOG: hello
    Predicate: isPositive(5) = True
    
    === Multicast Delegates ===
    Calling pipeline:
      Step 1: hello world
      Step 2: HELLO WORLD
      Step 3: 11 chars
    
    === Method Groups ===
      METHOD GROUP
    
    === Callback Pattern ===
    Results: 2 4 6 
    
    === Key Differences ===
    Python: pass any callable directly     -> C#: must match delegate signature
    Python: no multicast (use list of funcs) -> C#: built-in multicast delegates
    Python: @decorator modifies behavior   -> C#: [Attribute] adds metadata only
    Python: no events                      -> C#: events for observer pattern
    

## 6. Method Overloading & Extension Methods


```csharp
// Method Overloading & Extension Methods — C# features with no Python equivalent
//
// KEY CONCEPTS:
// - Method overloading: multiple methods with the SAME name but DIFFERENT parameter types
//   or counts. The compiler picks the right one based on arguments. Python has no
//   overloading — the last def with the same name wins (overwrites previous ones).
// - Extension methods: add methods to EXISTING types without modifying their source code.
//   Defined as static methods with 'this' on the first parameter.
//   Python equivalent: monkey-patching (adding methods to a class at runtime).
//   LINQ is entirely built on extension methods (.Where, .Select, etc.)

// === Method overloading ===
Console.WriteLine("=== Method Overloading (C# only) ===");

// Same name, different parameters — compiler picks the right one
string Format(int value) => $"int: {value}";
string Format(double value) => $"double: {value:F2}";
string Format(string value) => $"string: '{value}'";
string Format(int a, int b) => $"two ints: {a} + {b} = {a + b}";

Console.WriteLine(Format(42));           // calls Format(int)
Console.WriteLine(Format(3.14));         // calls Format(double)
Console.WriteLine(Format("hello"));      // calls Format(string)
Console.WriteLine(Format(10, 20));       // calls Format(int, int)

// Python would need different names or *args + type checking:
// def format_int(value): ...
// def format_str(value): ...
// Or: def format(value): if isinstance(value, int): ...

// === Extension methods ===
// Must be in a static class — but in notebooks we can use local functions with similar effect
Console.WriteLine("\n=== Extension Methods (C# only) ===");
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

// === Comparison Summary ===
Console.WriteLine("\n=== Python vs C# Functions Summary ===");
Console.WriteLine("Python: def / lambda              -> C#: method / lambda / Func<>/Action<>");
Console.WriteLine("Python: *args, **kwargs           -> C#: params, (no **kwargs)");
Console.WriteLine("Python: no ref/out/in             -> C#: ref, out, in");
Console.WriteLine("Python: @decorator wraps function -> C#: [Attribute] adds metadata");
Console.WriteLine("Python: no overloading            -> C#: method overloading");
Console.WriteLine("Python: monkey-patching           -> C#: extension methods");
Console.WriteLine("Python: type hints (optional)     -> C#: types enforced at compile time");
Console.WriteLine("Python: closures via nonlocal     -> C#: closures capture automatically");
Console.WriteLine("Python: single-line lambda only   -> C#: statement lambda (multi-line)");
```

    === Method Overloading (C# only) ===
    int: 42
    double: 3.14
    string: 'hello'
    two ints: 10 + 20 = 30
    
    === Extension Methods (C# only) ===
    Extension methods must be in static classes.
    LINQ methods (.Where, .Select, .OrderBy) are ALL extension methods.
    They 'extend' IEnumerable<T> without modifying its source code.
    Where+Select: [30, 40, 50]
    
    === Python vs C# Functions Summary ===
    Python: def / lambda              -> C#: method / lambda / Func<>/Action<>
    Python: *args, **kwargs           -> C#: params, (no **kwargs)
    Python: no ref/out/in             -> C#: ref, out, in
    Python: @decorator wraps function -> C#: [Attribute] adds metadata
    Python: no overloading            -> C#: method overloading
    Python: monkey-patching           -> C#: extension methods
    Python: type hints (optional)     -> C#: types enforced at compile time
    Python: closures via nonlocal     -> C#: closures capture automatically
    Python: single-line lambda only   -> C#: statement lambda (multi-line)
    
