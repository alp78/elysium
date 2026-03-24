---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [lists, dictionaries, sets, tuples, arrays, List, Dictionary, HashSet, LINQ]
keywords: [List, Dictionary, HashSet, Queue, Stack, IEnumerable, LINQ, array, SortedDictionary, ConcurrentDictionary]
description: "C# collections reference with executable examples and cell outputs — covers List, Dictionary, HashSet, arrays, Queue, Stack, and immutable collections. See [[05_py_collections]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[05_py_collections]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 05. Collections - C#

## 1. Arrays & Lists


```csharp
// Arrays & Lists — C# has both fixed-size arrays AND dynamic lists
//
// KEY CONCEPTS:
// - Array (int[]): fixed size, declared at creation, cannot add/remove.
//   Slightly faster than List. Python has no direct equivalent.
// - List<T>: dynamic size, can grow/shrink. Equivalent to Python's list.
//   BUT all elements must be the same type (no mixed types).
// - Both are 0-indexed. C# supports ^1 (from end) and ranges [1..4].
// - Array is a value you get from APIs; List<T> is what you use day-to-day.

// === Array (fixed size) ===
Console.WriteLine("=== Array (fixed size) ===");
int[] nums = { 1, 2, 3, 4, 5 };                      // literal
int[] zeros = new int[5];                            // [0, 0, 0, 0, 0]
int[] ranged = Enumerable.Range(0, 5).ToArray();     // [0, 1, 2, 3, 4]
string[] words = new[] { "hello", "world" };         // type inferred

Console.WriteLine($"nums:    [{string.Join(", ", nums)}]");
Console.WriteLine($"zeros:   [{string.Join(", ", zeros)}]");
Console.WriteLine($"ranged:  [{string.Join(", ", ranged)}]");
Console.WriteLine($"Length:  {nums.Length}");          // .Length (not .Count)

// Array access
Console.WriteLine($"nums[0]: {nums[0]}");              // first
Console.WriteLine($"nums[^1]:{nums[^1]}");             // last (from end)
Console.WriteLine($"[1..4]:  [{string.Join(", ", nums[1..4])}]");  // slice

// Array: can't add/remove
// nums.Add(6);  // Compile error! No Add method on array

// === List<T> (dynamic size) ===
Console.WriteLine("\n=== List<T> (dynamic size) ===");
var empty = new List<int>();
var list = new List<int> { 1, 2, 3, 4, 5 };
// var mixed = new List<???> { 1, "hello" };  // NOT allowed — single type only
//   Use List<object> if you really need mixed types (rare, avoid)

Console.WriteLine($"list:    [{string.Join(", ", list)}]");
Console.WriteLine($"Count:   {list.Count}");            // .Count (not .Length)

// === Adding elements ===
Console.WriteLine("\n=== Adding ===");
var lst = new List<int> { 1, 2, 3 };
lst.Add(4);                                   // add to end
lst.Insert(0, 0);                             // insert at index
lst.AddRange(new[] { 5, 6 });                 // add multiple (like Python extend)
Console.WriteLine($"After adds: [{string.Join(", ", lst)}]");

// === Removing elements ===
Console.WriteLine("\n=== Removing ===");
lst = new List<int> { 1, 2, 3, 2, 4, 5 };
lst.Remove(2);                                // remove FIRST occurrence of value
Console.WriteLine($"Remove(2):  [{string.Join(", ", lst)}]");
lst.RemoveAt(0);                              // remove at index (like Python del lst[0])
Console.WriteLine($"RemoveAt(0):[{string.Join(", ", lst)}]");
int last = lst[^1]; lst.RemoveAt(lst.Count - 1);  // pop last (no built-in Pop)
Console.WriteLine($"Pop last:   [{string.Join(", ", lst)}] (popped: {last})");
lst.Clear();                                  // remove all
Console.WriteLine($"Clear():    [{string.Join(", ", lst)}]");

// === Searching ===
Console.WriteLine("\n=== Searching ===");
lst = new List<int> { 10, 20, 30, 40, 30, 50 };
Console.WriteLine($"Contains(30):  {lst.Contains(30)}");          // True (like Python 'in')
Console.WriteLine($"IndexOf(30):   {lst.IndexOf(30)}");           // 2 (first occurrence)
Console.WriteLine($"FindAll(>25):  [{string.Join(", ", lst.FindAll(x => x > 25))}]");
Console.WriteLine($"Exists(>40):   {lst.Exists(x => x > 40)}");  // True
Console.WriteLine($"Count(30):     {lst.Count(x => x == 30)}");  // 2 (LINQ)

// === Sorting ===
Console.WriteLine("\n=== Sorting ===");
var unsorted = new List<int> { 3, 1, 4, 1, 5, 9, 2, 6 };
Console.WriteLine($"OrderBy:     [{string.Join(", ", unsorted.OrderBy(x => x))}]");  // new sequence
Console.WriteLine($"original:    [{string.Join(", ", unsorted)}]");                   // unchanged

unsorted.Sort();                              // in-place sort (like Python .sort())
Console.WriteLine($"Sort():      [{string.Join(", ", unsorted)}]");
// Sort() comparer must return: -1 if left comes first, 0 if equal, +1 if right comes first.
//   a.CompareTo(b): a=5, b=3 →  1  (a>b, so a comes after b → ascending)
//   b.CompareTo(a): a=5, b=3 → -1  (inverted sign → a comes before b → descending)
unsorted.Sort((a, b) => b.CompareTo(a));      // descending
Console.WriteLine($"Desc:        [{string.Join(", ", unsorted)}]");

var wordList = new List<string> { "banana", "apple", "cherry" };
Console.WriteLine($"By length ASC:   [{string.Join(", ", wordList.OrderBy(w => w.Length))}]"); // ASC
Console.WriteLine($"By length DESC:   [{string.Join(", ", wordList.OrderByDescending(w => w.Length))}]"); // DESC
Console.WriteLine($"By length DESC then Alpha:   [{string.Join(", ", wordList.OrderByDescending(w => w.Length).ThenBy(w => w))}]"); // DESC + ALPHA


// === Copying ===
Console.WriteLine("\n=== Copying ===");
var original = new List<int> { 1, 2, 3 };
var shallow = new List<int>(original);         // shallow copy (for value types, this is fine)
shallow[0] = 99;
Console.WriteLine($"original: [{string.Join(", ", original)}]");  // [1, 2, 3] — unchanged (int is value type)

// For reference types (List<List<int>>), shallow copy shares inner objects — same as Python

// === Convert between Array and List ===
Console.WriteLine("\n=== Array <-> List ===");
int[] arr = list.ToArray();                    // List → Array
var listFromArr = arr.ToList();                // Array → List
Console.WriteLine($"Array: [{string.Join(", ", arr)}]");
Console.WriteLine($"List:  [{string.Join(", ", listFromArr)}]");
```


```csharp
// Range & Index operators — all variants
// These work on arrays, strings, Span<T>, and any type with an indexer

int[] nums = { 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 };
//              0   1   2   3   4   5   6   7   8   9

Console.WriteLine("=== Index operator (^) — from end ===");
Console.WriteLine($"nums[0]:   {nums[0]}");        // 10  (first)
Console.WriteLine($"nums[9]:   {nums[9]}");        // 100 (last by position)
Console.WriteLine($"nums[^1]:  {nums[^1]}");       // 100 (last — ^1 = from end)
Console.WriteLine($"nums[^2]:  {nums[^2]}");       // 90  (second from end)
Console.WriteLine($"nums[^10]: {nums[^10]}");      // 10  (first — ^Length)

Console.WriteLine("\n=== Range operator (..) — slicing ===");
// [start..end] — start is INCLUSIVE, end is EXCLUSIVE (same as Python)
Console.WriteLine($"[0..3]:    [{string.Join(", ", nums[0..3])}]");     // 10, 20, 30
Console.WriteLine($"[3..7]:    [{string.Join(", ", nums[3..7])}]");     // 40, 50, 60, 70
Console.WriteLine($"[..3]:     [{string.Join(", ", nums[..3])}]");      // 10, 20, 30  (start defaults to 0)
Console.WriteLine($"[7..]:     [{string.Join(", ", nums[7..])}]");      // 80, 90, 100 (end defaults to length)
Console.WriteLine($"[..]:      [{string.Join(", ", nums[..])}]");       // all elements (full copy)

Console.WriteLine("\n=== Range with ^ (from end) ===");
Console.WriteLine($"[^3..]:    [{string.Join(", ", nums[^3..])}]");     // 80, 90, 100  (last 3)
Console.WriteLine($"[..^3]:    [{string.Join(", ", nums[..^3])}]");     // 10..70       (all except last 3)
Console.WriteLine($"[^5..^2]:  [{string.Join(", ", nums[^5..^2])}]");   // 60, 70, 80   (from 5th-last to 2nd-last)
Console.WriteLine($"[1..^1]:   [{string.Join(", ", nums[1..^1])}]");    // 20..90       (skip first and last)

Console.WriteLine("\n=== Stored as variables ===");
// Index and Range can be stored in variables
Index last = ^1;
Range middle = 2..^2;
Console.WriteLine($"Index ^1:  {nums[last]}");                          // 100
Console.WriteLine($"Range 2..^2: [{string.Join(", ", nums[middle])}]"); // 30, 40, 50, 60, 70, 80

Console.WriteLine("\n=== Python comparison ===");
Console.WriteLine("Python: nums[0:3]    -> C#: nums[0..3]");
Console.WriteLine("Python: nums[3:]     -> C#: nums[3..]");
Console.WriteLine("Python: nums[:3]     -> C#: nums[..3]");
Console.WriteLine("Python: nums[-3:]    -> C#: nums[^3..]");
Console.WriteLine("Python: nums[:-3]    -> C#: nums[..^3]");
Console.WriteLine("Python: nums[1:-1]   -> C#: nums[1..^1]");
Console.WriteLine("Python: nums[::-1]   -> C#: NO equivalent (use .Reverse())");
Console.WriteLine("Python: nums[::2]    -> C#: NO equivalent (use .Where with index)");
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

    probeAddresses(["http://2a02:8308:718a:f200::280b:2048/","http://2a02:8308:718a:f200:8bd4:d06d:33ed:be05:2048/","http://2a02:8308:718a:f200:9c70:c598:8ab4:ea30:2048/","http://fe80::3212:d8da:d32d:4723%14:2048/","http://192.168.0.110:2048/","http://::1:2048/","http://127.0.0.1:2048/"])

        .then((root) => {

        // use probing to find host url and api resources

        // load interactive helpers and language services

        let dotnetInteractiveRequire = require.config({

        context: '22872.Microsoft.DotNet.Interactive.Http.HttpPort',

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


    === Index operator (^) — from end ===
    nums[0]:   10
    nums[9]:   100
    nums[^1]:  100
    nums[^2]:  90
    nums[^10]: 10
    
    === Range operator (..) — slicing ===
    [0..3]:    [10, 20, 30]
    [3..7]:    [40, 50, 60, 70]
    [..3]:     [10, 20, 30]
    [7..]:     [80, 90, 100]
    [..]:      [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    
    === Range with ^ (from end) ===
    [^3..]:    [80, 90, 100]
    [..^3]:    [10, 20, 30, 40, 50, 60, 70]
    [^5..^2]:  [60, 70, 80]
    [1..^1]:   [20, 30, 40, 50, 60, 70, 80, 90]
    
    === Stored as variables ===
    Index ^1:  100
    Range 2..^2: [30, 40, 50, 60, 70, 80]
    
    === Python comparison ===
    Python: nums[0:3]    -> C#: nums[0..3]
    Python: nums[3:]     -> C#: nums[3..]
    Python: nums[:3]     -> C#: nums[..3]
    Python: nums[-3:]    -> C#: nums[^3..]
    Python: nums[:-3]    -> C#: nums[..^3]
    Python: nums[1:-1]   -> C#: nums[1..^1]
    Python: nums[::-1]   -> C#: NO equivalent (use .Reverse())
    Python: nums[::2]    -> C#: NO equivalent (use .Where with index)
    


```csharp
// Span<T> — a lightweight, zero-allocation view into contiguous memory
//
// KEY CONCEPTS:
// - Span<T>: a "window" into an array (or string, or stack memory) without copying.
//   It's NOT a collection — it's a view/reference into existing memory.
// - Zero allocation: slicing a Span doesn't create a new array — it just moves the window.
//   This is critical for high-performance code (parsers, serializers, hot loops).
// - ReadOnlySpan<T>: same but read-only — used for strings and immutable data.
// - Stack-only: Span can't be stored in fields, closures, or async methods (lives on stack).
//   In notebooks, must wrap in a block {} or method to avoid "can't be a field" error.
// - Python has no equivalent — closest is memoryview (for bytes only).
// - Supports range operator [..] natively — same as arrays.

// Must wrap in a block or method — Span can't be a top-level notebook variable
{
    // === Creating Spans from arrays ===
    Console.WriteLine("=== Span from Array ===");
    int[] arr = { 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 };

    Span<int> full = arr;                          // span over entire array
    Span<int> slice = arr.AsSpan(2, 5);            // span from index 2, length 5
    Span<int> ranged = arr.AsSpan()[3..7];         // span using range operator

    Console.WriteLine($"full:    [{string.Join(", ", full.ToArray())}]");
    Console.WriteLine($"slice:   [{string.Join(", ", slice.ToArray())}]");     // 30, 40, 50, 60, 70
    Console.WriteLine($"ranged:  [{string.Join(", ", ranged.ToArray())}]");    // 40, 50, 60, 70

    // === Zero allocation — modifying span modifies the original array ===
    Console.WriteLine("\n=== Zero Allocation (shared memory) ===");
    Span<int> window = arr.AsSpan(0, 3);          // [10, 20, 30]
    window[0] = 999;                               // modifies arr[0] directly!
    Console.WriteLine($"arr[0] after span mutation: {arr[0]}");   // 999 — same memory!
    arr[0] = 10;                                   // reset

    // === Slicing spans (no allocation, just moves the window) ===
    Console.WriteLine("\n=== Span Slicing (all zero-allocation) ===");
    Span<int> s = arr;
    Console.WriteLine($"s[..3]:    [{string.Join(", ", s[..3].ToArray())}]");       // first 3
    Console.WriteLine($"s[^3..]:   [{string.Join(", ", s[^3..].ToArray())}]");      // last 3
    Console.WriteLine($"s[2..^2]:  [{string.Join(", ", s[2..^2].ToArray())}]");     // skip first 2 and last 2

    // === Span methods ===
    Console.WriteLine("\n=== Span Methods ===");
    Span<int> data = new int[] { 5, 3, 1, 4, 2 };
    data.Sort();
    Console.WriteLine($"Sort:          [{string.Join(", ", data.ToArray())}]");
    data.Reverse();
    Console.WriteLine($"Reverse:       [{string.Join(", ", data.ToArray())}]");
    data.Fill(0);
    Console.WriteLine($"Fill(0):       [{string.Join(", ", data.ToArray())}]");

    Span<int> src = new int[] { 1, 2, 3 };
    Span<int> dst = new int[3];
    src.CopyTo(dst);
    Console.WriteLine($"CopyTo:        [{string.Join(", ", dst.ToArray())}]");
}

// === ReadOnlySpan — for strings (works at top level since it's in expressions) ===
Console.WriteLine("\n=== ReadOnlySpan<char> from String ===");
string text = "Hello, World!";

// Normal substring — creates a NEW string (allocation):
string sub1 = text.Substring(7, 5);           // "World" — new string on heap
Console.WriteLine($"Substring:     '{sub1}'");

// Span substring — must be in a block
{
    ReadOnlySpan<char> sub2 = text.AsSpan(7, 5);
    Console.WriteLine($"Span:          '{sub2.ToString()}'");

    ReadOnlySpan<char> greeting = text.AsSpan()[..5];
    ReadOnlySpan<char> target = text.AsSpan()[^6..^1];
    Console.WriteLine($"[..5]:         '{greeting.ToString()}'");
    Console.WriteLine($"[^6..^1]:      '{target.ToString()}'");

    ReadOnlySpan<char> str = "Hello World".AsSpan();
    Console.WriteLine($"Contains 'World': {str.Contains("World".AsSpan(), StringComparison.Ordinal)}");
    Console.WriteLine($"IndexOf 'W':      {str.IndexOf('W')}");
}

// === When to use Span vs Array vs List ===
Console.WriteLine("\n=== When to Use What ===");
Console.WriteLine("Array (int[]):    fixed data, interop, raw buffers");
Console.WriteLine("List<T>:          dynamic data, add/remove, general purpose (95% of the time)");
Console.WriteLine("Span<T>:          performance-critical slicing without allocation");
Console.WriteLine("                  parsers, serializers, hot loops, large data processing");
Console.WriteLine("ReadOnlySpan:     zero-copy string parsing, protocol parsing");
Console.WriteLine("");
Console.WriteLine("Rule: start with List<T>. Use Span only when profiling shows allocation pressure.");
```

    === Span from Array ===
    full:    [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    slice:   [30, 40, 50, 60, 70]
    ranged:  [40, 50, 60, 70]
    
    === Zero Allocation (shared memory) ===
    arr[0] after span mutation: 999
    
    === Span Slicing (all zero-allocation) ===
    s[..3]:    [10, 20, 30]
    s[^3..]:   [80, 90, 100]
    s[2..^2]:  [30, 40, 50, 60, 70, 80]
    
    === Span Methods ===
    Sort:          [1, 2, 3, 4, 5]
    Reverse:       [5, 4, 3, 2, 1]
    Fill(0):       [0, 0, 0, 0, 0]
    CopyTo:        [1, 2, 3]
    
    === ReadOnlySpan<char> from String ===
    Substring:     'World'
    Span:          'World'
    [..5]:         'Hello'
    [^6..^1]:      'World'
    Contains 'World': True
    IndexOf 'W':      6
    
    === When to Use What ===
    Array (int[]):    fixed data, interop, raw buffers
    List<T>:          dynamic data, add/remove, general purpose (95% of the time)
    Span<T>:          performance-critical slicing without allocation
                      parsers, serializers, hot loops, large data processing
    ReadOnlySpan:     zero-copy string parsing, protocol parsing
    
    Rule: start with List<T>. Use Span only when profiling shows allocation pressure.
    

## 2. Dictionaries


```csharp
// Dictionaries — key-value mapping
//
// KEY CONCEPTS:
// - Dictionary<TKey, TValue>: unordered (no guaranteed order), mutable, no duplicate keys.
//   Python equivalent: dict (but Python dicts are insertion-ordered since 3.7).
// - Keys must implement GetHashCode/Equals properly. String, int, etc. work out of the box.
// - O(1) average lookup — same as Python dict.
// - SortedDictionary<K,V>: keeps keys sorted. Python has no direct equivalent.
// - No defaultdict — use GetValueOrDefault or TryGetValue pattern.
// - No Counter — use GroupBy + Count or manual dict.

// === Creation ===
Console.WriteLine("=== Creation ===");
var empty = new Dictionary<string, int>();
var person = new Dictionary<string, object>
{
    ["name"] = "Alice",
    ["age"] = 30,
    ["city"] = "NYC"
};
// Alternative syntax
var scores = new Dictionary<string, int>
{
    { "Alice", 85 },
    { "Bob", 92 },
    { "Charlie", 78 }
};

Console.WriteLine($"person: {string.Join(", ", person.Select(kv => $"{kv.Key}:{kv.Value}"))}");
Console.WriteLine($"scores: {string.Join(", ", scores.Select(kv => $"{kv.Key}:{kv.Value}"))}");

// === Accessing ===
Console.WriteLine("\n=== Accessing ===");
Console.WriteLine($"person[\"name\"]:        {person["name"]}");       // KeyNotFoundException if missing
// Safe access:
Console.WriteLine($"TryGetValue: {(person.TryGetValue("dodo", out var val) ? val : "N/A")}");
Console.WriteLine($"GetValueOrDefault: {scores.GetValueOrDefault("Unknown", -1)}");  // -1 if missing

// === Adding / Updating ===
Console.WriteLine("\n=== Adding / Updating ===");
person["email"] = "alice@example.com";                    // add new or update existing
person["age"] = 31;                                       // update
// TryAdd — only adds if key doesn't exist (no overwrite)
person.TryAdd("phone", "555-0123");
Console.WriteLine($"Updated: {string.Join(", ", person.Select(kv => $"{kv.Key}:{kv.Value}"))}");

// === Removing ===
Console.WriteLine("\n=== Removing ===");
var d = new Dictionary<string, int> { ["a"] = 1, ["b"] = 2, ["c"] = 3 };
d.Remove("a");                                           // remove key (returns bool)
d.Remove("z");                                           // no error if missing (returns false)
// Remove and get value (like Python pop)
if (d.Remove("b", out int removed))
    Console.WriteLine($"Removed b: {removed}");
d.Clear();                                               // remove all
Console.WriteLine($"After clear: {d.Count} items");

// === Iterating ===
Console.WriteLine("\n=== Iterating ===");
var dd = new Dictionary<string, object> { ["name"] = "Alice", ["age"] = 30, ["city"] = "NYC" };
foreach (var kvp in dd)                                  // KeyValuePair
    Console.WriteLine($"  {kvp.Key}: {kvp.Value}");
foreach (var (key, value) in dd)                         // deconstruct
    Console.WriteLine($"  {key} = {value}");
foreach (var key in dd.Keys)                             // keys only
    Console.Write($"  {key}");
Console.WriteLine();

// === Membership & Size ===
Console.WriteLine("\n=== Membership ===");
Console.WriteLine($"ContainsKey(\"name\"): {dd.ContainsKey("name")}");
Console.WriteLine($"ContainsValue(30):  {dd.ContainsValue(30)}");   // O(n) — slow!
Console.WriteLine($"Count: {dd.Count}");

// === LINQ on Dictionaries ===
Console.WriteLine("\n=== LINQ on Dicts ===");
var filtered = scores.Where(kv => kv.Value >= 80)
    .ToDictionary(kv => kv.Key, kv => kv.Value);
Console.WriteLine($"Score >= 80: {string.Join(", ", filtered.Select(kv => $"{kv.Key}:{kv.Value}"))}");

// Group by (like Python defaultdict grouping)
var words = new[] { "apple", "banana", "avocado", "cherry", "blueberry" };
var groups = words.GroupBy(w => w[0])
    .ToDictionary(g => g.Key, g => g.ToList());
foreach (var (key, value) in groups)
    Console.WriteLine($"  {key}: [{string.Join(", ", value)}]");

// Count occurrences (like Python Counter)
Console.WriteLine("\n=== Counter equivalent ===");
string text = "abracadabra";
var counter = text.GroupBy(c => c)
    .ToDictionary(g => g.Key, g => g.Count())
    .OrderByDescending(kv => kv.Value);
foreach (var (ch, count) in counter)
    Console.WriteLine($"  '{ch}': {count}");

// === SortedDictionary (C# only) ===
Console.WriteLine("\n=== SortedDictionary (keys always sorted) ===");
var sorted = new SortedDictionary<string, int>(scores);
foreach (var (key, value) in sorted)
    Console.WriteLine($"  {key}: {value}");
```

    === Creation ===
    person: name:Alice, age:30, city:NYC
    scores: Alice:85, Bob:92, Charlie:78
    
    === Accessing ===
    person["name"]:        Alice
    TryGetValue: N/A
    GetValueOrDefault: -1
    
    === Adding / Updating ===
    Updated: name:Alice, age:31, city:NYC, email:alice@example.com, phone:555-0123
    
    === Removing ===
    Removed b: 2
    After clear: 0 items
    
    === Iterating ===
      name: Alice
      age: 30
      city: NYC
      name = Alice
      age = 30
      city = NYC
      name  age  city
    
    === Membership ===
    ContainsKey("name"): True
    ContainsValue(30):  True
    Count: 3
    
    === LINQ on Dicts ===
    Score >= 80: Alice:85, Bob:92
      a: [apple, avocado]
      b: [banana, blueberry]
      c: [cherry]
    
    === Counter equivalent ===
      'a': 5
      'b': 2
      'r': 2
      'c': 1
      'd': 1
    
    === SortedDictionary (keys always sorted) ===
      Alice: 85
      Bob: 92
      Charlie: 78
    

## 3. Sets


```csharp
// Sets — unordered unique elements
//
// KEY CONCEPTS:
// - HashSet<T>: unordered, mutable, NO duplicates. O(1) lookup.
//   Python equivalent: set.
// - SortedSet<T>: always keeps elements sorted. Python has no direct equivalent.
// - Set operations: UnionWith, IntersectWith, ExceptWith, SymmetricExceptWith.
//   Same math operations — useful in DE for comparing datasets, deduplication.
// - No frozenset equivalent — use ImmutableHashSet from System.Collections.Immutable.

// === Creation ===
Console.WriteLine("=== Creation ===");
var empty = new HashSet<int>();
var nums = new HashSet<int> { 1, 2, 3, 4, 5 };
var fromList = new List<int> { 1, 2, 2, 3, 3, 3 }.ToHashSet();    // duplicates removed
var fromStr = "abracadabra".ToHashSet();                          // unique chars

Console.WriteLine($"nums:     {{{string.Join(", ", nums)}}}");
Console.WriteLine($"fromList: {{{string.Join(", ", fromList)}}}");
Console.WriteLine($"fromStr:  {{{string.Join(", ", fromStr)}}}");

// === Adding / Removing ===
Console.WriteLine("\n=== Adding / Removing ===");
var s = new HashSet<int> { 1, 2, 3 };
s.Add(4);                                     // returns bool (false if already exists)
s.UnionWith(new[] { 5, 6, 7 });              // add multiple (like Python update)
Console.WriteLine($"After adds:   {{{string.Join(", ", s)}}}");
s.Remove(7);                                  // remove (returns false if missing, no error)
Console.WriteLine($"After remove: {{{string.Join(", ", s)}}}");

// === Set Operations ===
Console.WriteLine("\n=== Set Operations ===");
var a = new HashSet<int> { 1, 2, 3, 4, 5 };
var b = new HashSet<int> { 4, 5, 6, 7, 8 };

// Non-mutating (LINQ) — returns new collection
Console.WriteLine($"a:              {{{string.Join(", ", a)}}}");
Console.WriteLine($"b:              {{{string.Join(", ", b)}}}");
Console.WriteLine($"Union:          {{{string.Join(", ", a.Union(b))}}}");
Console.WriteLine($"Intersect:      {{{string.Join(", ", a.Intersect(b))}}}");
Console.WriteLine($"Except (a-b):   {{{string.Join(", ", a.Except(b))}}}");
Console.WriteLine($"SymmetricExcept:{{{string.Join(", ", a.Union(b).Except(a.Intersect(b)))}}}");

// Mutating versions (modify the set in-place):
// a.UnionWith(b);           a.IntersectWith(b);
// a.ExceptWith(b);          a.SymmetricExceptWith(b);

// Subset / superset
Console.WriteLine($"{{1,2}} subset of a: {new HashSet<int> { 1, 2 }.IsSubsetOf(a)}");
Console.WriteLine($"a superset of {{1,2}}: {a.IsSupersetOf(new[] { 1, 2 })}");
Console.WriteLine($"Overlaps: {a.Overlaps(b)}");

// === DE Use Case: Dataset Comparison ===
Console.WriteLine("\n=== DE Use Case: Dataset Comparison ===");
var prodIds = new HashSet<string> { "P001", "P002", "P003", "P004" };
var warehouseIds = new HashSet<string> { "P002", "P003", "P005" };

Console.WriteLine($"In prod only:      {{{string.Join(", ", prodIds.Except(warehouseIds))}}}");
Console.WriteLine($"In warehouse only: {{{string.Join(", ", warehouseIds.Except(prodIds))}}}");
Console.WriteLine($"In both:           {{{string.Join(", ", prodIds.Intersect(warehouseIds))}}}");
Console.WriteLine($"All unique:        {{{string.Join(", ", prodIds.Union(warehouseIds))}}}");

// === SortedSet (C# only) ===
Console.WriteLine("\n=== SortedSet (always sorted) ===");
var unsorted = new HashSet<int> { 5, 3, 1, 4, 2 };
var sorted = new SortedSet<int> (unsorted);
Console.WriteLine($"HashSet: {{{string.Join(", ", unsorted)}}}");
Console.WriteLine($"SortedSet: {{{string.Join(", ", sorted)}}}");  // {1, 2, 3, 4, 5}
Console.WriteLine($"Min: {sorted.Min}, Max: {sorted.Max}");
Console.WriteLine($"Range [2..4]: {{{string.Join(", ", sorted.GetViewBetween(2, 4))}}}");
```

    === Creation ===
    nums:     {1, 2, 3, 4, 5}
    fromList: {1, 2, 3}
    fromStr:  {a, b, r, c, d}
    
    === Adding / Removing ===
    After adds:   {1, 2, 3, 4, 5, 6, 7}
    After remove: {1, 2, 3, 4, 5, 6}
    
    === Set Operations ===
    a:              {1, 2, 3, 4, 5}
    b:              {4, 5, 6, 7, 8}
    Union:          {1, 2, 3, 4, 5, 6, 7, 8}
    Intersect:      {4, 5}
    Except (a-b):   {1, 2, 3}
    SymmetricExcept:{1, 2, 3, 6, 7, 8}
    {1,2} subset of a: True
    a superset of {1,2}: True
    Overlaps: True
    
    === DE Use Case: Dataset Comparison ===
    In prod only:      {P001, P004}
    In warehouse only: {P005}
    In both:           {P002, P003}
    All unique:        {P001, P002, P003, P004, P005}
    
    === SortedSet (always sorted) ===
    HashSet: {5, 3, 1, 4, 2}
    SortedSet: {1, 2, 3, 4, 5}
    Min: 1, Max: 5
    Range [2..4]: {2, 3, 4}
    

## 4. Tuples & Enums


```csharp
// Tuples & Enums
//
// KEY CONCEPTS:
// - ValueTuple: lightweight, value type, supports named fields. Python: tuple/namedtuple.
// - System.Tuple: older, reference type, uses Item1/Item2. Avoid in new code.
// - Deconstruction: var (x, y) = tuple; — same as Python's unpacking.
// - Enum: a set of named integer constants. Python: enum.Enum.
//   C# enums are always integers underneath. Python enums can be any type.
// - [Flags] enum: bitwise combinable enum (covered in notebook 01).

// === ValueTuple ===
Console.WriteLine("=== ValueTuple ===");
var point = (3, 4);                          // unnamed: Item1, Item2
var person = (Name: "Alice", Age: 30, City: "NYC");  // named fields

Console.WriteLine($"point:     {point}");
Console.WriteLine($"point.Item1: {point.Item1}");
Console.WriteLine($"person.Name: {person.Name}");
Console.WriteLine($"person.Age:  {person.Age}");

// Deconstruction (like Python unpacking)
var (x, y) = point;
var (name, age, city) = person;
Console.WriteLine($"Unpacked: x={x}, y={y}");
Console.WriteLine($"Unpacked: name={name}, age={age}");

// Swap values
int a = 1, b = 2;
(a, b) = (b, a);
Console.WriteLine($"Swapped:  a={a}, b={b}");

// Ignore values with _
var (first, _, _, _, last) = (1, 2, 3, 4, 5);
Console.WriteLine($"first={first}, last={last}");

// Tuples are value types — compared by value, not reference
Console.WriteLine($"(1,2) == (1,2): {(1, 2) == (1, 2)}");  // True!

// === Record struct (modern C# replacement for namedtuple) ===
Console.WriteLine("\n=== Named types (use in separate cell) ===");
Console.WriteLine("For named immutable data, C# uses:");
Console.WriteLine("  record struct Point(int X, int Y);       // value type, immutable");
Console.WriteLine("  record Employee(string Name, string Dept, double Salary);  // ref type");
Console.WriteLine("  These must be defined in their own cell (type declarations)");
```

    === ValueTuple ===
    point:     (3, 4)
    point.Item1: 3
    person.Name: Alice
    person.Age:  30
    Unpacked: x=3, y=4
    Unpacked: name=Alice, age=30
    Swapped:  a=2, b=1
    first=1, last=5
    (1,2) == (1,2): True
    
    === Named types (use in separate cell) ===
    For named immutable data, C# uses:
      record struct Point(int X, int Y);       // value type, immutable
      record Employee(string Name, string Dept, double Salary);  // ref type
      These must be defined in their own cell (type declarations)
    


```csharp
// Enum (type declaration — separate cell)
// C# enums are always integers underneath (default: int, starting at 0)

enum Color { Red = 1, Green = 2, Blue = 3 }
enum Direction { North, South, East, West }           // auto: 0, 1, 2, 3

enum PipelineStatus { Pending, Running, Success, Failed }
```


```csharp
// Using enums (run previous cell first)
Console.WriteLine("=== Enum Usage ===");
Console.WriteLine($"Color.Red:       {Color.Red}");
Console.WriteLine($"(int)Color.Red:  {(int)Color.Red}");      // cast to int: 1
Console.WriteLine($"(Color)2:        {(Color)2}");            // cast from int: Green
Console.WriteLine($"ToString():      {Color.Blue.ToString()}");
Console.WriteLine($"Parse:           {Enum.Parse<Color>("Green")}");
Console.WriteLine($"TryParse:        {Enum.TryParse<Color>("Blue", out var c)} → {c}");

// Iterate
Console.Write("All colors: ");
foreach (var color in Enum.GetValues<Color>())
    Console.Write($"{color}({(int)color}) ");
Console.WriteLine();

// Comparison (enums are integers — can compare directly)
Console.WriteLine($"Red == Red: {Color.Red == Color.Red}");

// DE use case
var status = PipelineStatus.Running;
if (status == PipelineStatus.Running)
    Console.WriteLine($"\nPipeline is {status}...");
```

    === Enum Usage ===
    Color.Red:       Red
    (int)Color.Red:  1
    (Color)2:        Green
    ToString():      Blue
    Parse:           Green
    TryParse:        True → Blue
    All colors: Red(1) Green(2) Blue(3) 
    Red == Red: True
    
    Pipeline is Running...
    

    
    (17,34): warning CS1718: Comparison made to same variable; did you mean to compare something else?
    
    

## 5. Stacks, Queues & Linked Lists


```csharp
// Stacks, Queues & Linked Lists
//
// KEY CONCEPTS:
// - Stack<T> (LIFO): Last In, First Out. Push/Pop from top only.
//   Python: list (append/pop) or deque.
// - Queue<T> (FIFO): First In, First Out. Enqueue at back, Dequeue from front.
//   Python: collections.deque.
// - LinkedList<T>: doubly-linked list — O(1) insert/remove at any position if you have the node.
//   Python: collections.deque (roughly equivalent, but not a linked list).
// - PriorityQueue<T, TPriority>: items dequeued in priority order, not insertion order.
//   Python: heapq module.

// === Stack (LIFO) ===
Console.WriteLine("=== Stack (LIFO) ===");
var stack = new Stack<string>();
stack.Push("first");
stack.Push("second");
stack.Push("third");
Console.WriteLine($"Stack: [{string.Join(", ", stack)}]");      // third, second, first (top first)
Console.WriteLine($"Pop:   {stack.Pop()}");                      // "third"
Console.WriteLine($"Pop:   {stack.Pop()}");                      // "second"
Console.WriteLine($"Peek:  {stack.Peek()}");                     // "first" (look without removing)
Console.WriteLine($"Count: {stack.Count}");

// === Queue (FIFO) ===
Console.WriteLine("\n=== Queue (FIFO) ===");
var queue = new Queue<string>();
queue.Enqueue("first");
queue.Enqueue("second");
queue.Enqueue("third");
Console.WriteLine($"Queue:   [{string.Join(", ", queue)}]");
Console.WriteLine($"Dequeue: {queue.Dequeue()}");                // "first"
Console.WriteLine($"Dequeue: {queue.Dequeue()}");                // "second"
Console.WriteLine($"Peek:    {queue.Peek()}");                   // "third"

// === LinkedList (doubly-linked) ===
Console.WriteLine("\n=== LinkedList ===");
var ll = new LinkedList<string>();
ll.AddLast("B");
ll.AddFirst("A");                                                // O(1) — add to front
ll.AddLast("D");
ll.AddAfter(ll.Find("B")!, "C");                                // insert after node
Console.WriteLine($"LinkedList: [{string.Join(", ", ll)}]");     // A, B, C, D
ll.Remove("C");                                                  // O(n) find + O(1) remove
ll.RemoveFirst();                                                // O(1)
Console.WriteLine($"After removes: [{string.Join(", ", ll)}]");

// === PriorityQueue (C# 10+) ===
Console.WriteLine("\n=== PriorityQueue ===");
var pq = new PriorityQueue<string, int>();                       // item type, priority type
pq.Enqueue("low priority", 3);
pq.Enqueue("high priority", 1);                                 // lower number = higher priority
pq.Enqueue("medium priority", 2);

Console.WriteLine($"Dequeue: {pq.Dequeue()}");                   // "high priority" (priority 1)
Console.WriteLine($"Dequeue: {pq.Dequeue()}");                   // "medium priority" (priority 2)

// === DE use case: task queue ===
Console.WriteLine("\n=== DE Use Case: Task Queue ===");
var taskQueue = new Queue<(string task, string table)>();
taskQueue.Enqueue(("extract", "users"));
taskQueue.Enqueue(("extract", "orders"));
taskQueue.Enqueue(("transform", "users"));

while (taskQueue.Count > 0)
{
    var (task, table) = taskQueue.Dequeue();
    Console.WriteLine($"  Processing: {task} {table}");
}

// === Key Differences ===
Console.WriteLine("\n=== Key Differences ===");
Console.WriteLine("Python: list as stack           -> C#: Stack<T>");
Console.WriteLine("Python: deque as queue           -> C#: Queue<T>");
Console.WriteLine("Python: deque (double-ended)     -> C#: LinkedList<T> (different API)");
Console.WriteLine("Python: heapq (min-heap on list) -> C#: PriorityQueue<T, TPriority>");
Console.WriteLine("Python: deque(maxlen=N)          -> C#: no built-in bounded queue");
```

    === Stack (LIFO) ===
    Stack: [third, second, first]
    Pop:   third
    Pop:   second
    Peek:  first
    Count: 1
    
    === Queue (FIFO) ===
    Queue:   [first, second, third]
    Dequeue: first
    Dequeue: second
    Peek:    third
    
    === LinkedList ===
    LinkedList: [A, B, C, D]
    After removes: [B, D]
    
    === PriorityQueue ===
    Dequeue: high priority
    Dequeue: medium priority
    
    === DE Use Case: Task Queue ===
      Processing: extract users
      Processing: extract orders
      Processing: transform users
    
    === Key Differences ===
    Python: list as stack           -> C#: Stack<T>
    Python: deque as queue           -> C#: Queue<T>
    Python: deque (double-ended)     -> C#: LinkedList<T> (different API)
    Python: heapq (min-heap on list) -> C#: PriorityQueue<T, TPriority>
    Python: deque(maxlen=N)          -> C#: no built-in bounded queue
    

## 6. Collection Comparison & Choosing the Right One


```csharp
// Collection Comparison — when to use which
//
// Performance characteristics (Big O notation):
//   O(1) = instant regardless of size (dict/set lookup, list add)
//   O(n) = time grows linearly with size (list search, list insert at 0)
//   O(n log n) = sorting

Console.WriteLine("=== C# Collection Cheat Sheet ===");
Console.WriteLine(@"
Collection          | Ordered | Mutable | Duplicates | Lookup  | Python Equivalent
--------------------+---------+---------+------------+---------+------------------
int[] (array)       | Yes     | Fixed*  | Yes        | O(n)    | (no equivalent)
List<T>             | Yes     | Yes     | Yes        | O(n)    | list
Dictionary<K,V>     | No**    | Yes     | Keys: No   | O(1)    | dict
HashSet<T>          | No      | Yes     | No         | O(1)    | set
SortedDictionary    | Yes     | Yes     | Keys: No   | O(log n)| (no equivalent)
SortedSet<T>        | Yes     | Yes     | No         | O(log n)| (no equivalent)
Stack<T>            | LIFO    | Yes     | Yes        | -       | list (append/pop)
Queue<T>            | FIFO    | Yes     | Yes        | -       | deque
LinkedList<T>       | Yes     | Yes     | Yes        | O(n)    | deque (roughly)
PriorityQueue<T,P>  | Priority| Yes     | Yes        | -       | heapq
ValueTuple          | Yes     | No***   | Yes        | -       | tuple
enum                | -       | No      | No         | -       | Enum

*  Array: elements mutable, size fixed
** Dictionary: no guaranteed order (unlike Python dict since 3.7)
*** ValueTuple: struct fields mutable, but usually used as immutable
");

Console.WriteLine("=== Decision Guide ===");
Console.WriteLine(@"
Need ordered items?
  ├─ Fixed size?      → T[] (array)
  └─ Dynamic size?    → List<T>

Need key-value pairs?
  ├─ Keep keys sorted? → SortedDictionary<K,V>
  └─ Fast lookup?      → Dictionary<K,V>

Need unique elements?
  ├─ Keep sorted?      → SortedSet<T>
  └─ Just unique?      → HashSet<T>

Need FIFO queue?        → Queue<T>
Need LIFO stack?        → Stack<T>
Need priority ordering? → PriorityQueue<T,P>
Need fast middle insert?→ LinkedList<T>
");

Console.WriteLine("=== DE Collection Choices ===");
Console.WriteLine("ETL records:      List<T> or T[]");
Console.WriteLine("Config/params:    Dictionary<string, object>");
Console.WriteLine("Deduplication:    HashSet<T>");
Console.WriteLine("Lookup table:     Dictionary<TKey, TValue>");
Console.WriteLine("Grouping:         .GroupBy().ToDictionary()  (LINQ)");
Console.WriteLine("Counting:         .GroupBy().Count()  (LINQ)");
Console.WriteLine("Task queue:       Queue<T>");
Console.WriteLine("Priority tasks:   PriorityQueue<T, int>");
Console.WriteLine("Schema fields:    ValueTuple or enum");
Console.WriteLine("Immutable config: ImmutableDictionary (System.Collections.Immutable)");
```

    === C# Collection Cheat Sheet ===
    
    Collection          | Ordered | Mutable | Duplicates | Lookup  | Python Equivalent
    --------------------+---------+---------+------------+---------+------------------
    int[] (array)       | Yes     | Fixed*  | Yes        | O(n)    | (no equivalent)
    List<T>             | Yes     | Yes     | Yes        | O(n)    | list
    Dictionary<K,V>     | No**    | Yes     | Keys: No   | O(1)    | dict
    HashSet<T>          | No      | Yes     | No         | O(1)    | set
    SortedDictionary    | Yes     | Yes     | Keys: No   | O(log n)| (no equivalent)
    SortedSet<T>        | Yes     | Yes     | No         | O(log n)| (no equivalent)
    Stack<T>            | LIFO    | Yes     | Yes        | -       | list (append/pop)
    Queue<T>            | FIFO    | Yes     | Yes        | -       | deque
    LinkedList<T>       | Yes     | Yes     | Yes        | O(n)    | deque (roughly)
    PriorityQueue<T,P>  | Priority| Yes     | Yes        | -       | heapq
    ValueTuple          | Yes     | No***   | Yes        | -       | tuple
    enum                | -       | No      | No         | -       | Enum
    
    *  Array: elements mutable, size fixed
    ** Dictionary: no guaranteed order (unlike Python dict since 3.7)
    *** ValueTuple: struct fields mutable, but usually used as immutable
    
    === Decision Guide ===
    
    Need ordered items?
      ├─ Fixed size?      → T[] (array)
      └─ Dynamic size?    → List<T>
    
    Need key-value pairs?
      ├─ Keep keys sorted? → SortedDictionary<K,V>
      └─ Fast lookup?      → Dictionary<K,V>
    
    Need unique elements?
      ├─ Keep sorted?      → SortedSet<T>
      └─ Just unique?      → HashSet<T>
    
    Need FIFO queue?        → Queue<T>
    Need LIFO stack?        → Stack<T>
    Need priority ordering? → PriorityQueue<T,P>
    Need fast middle insert?→ LinkedList<T>
    
    === DE Collection Choices ===
    ETL records:      List<T> or T[]
    Config/params:    Dictionary<string, object>
    Deduplication:    HashSet<T>
    Lookup table:     Dictionary<TKey, TValue>
    Grouping:         .GroupBy().ToDictionary()  (LINQ)
    Counting:         .GroupBy().Count()  (LINQ)
    Task queue:       Queue<T>
    Priority tasks:   PriorityQueue<T, int>
    Schema fields:    ValueTuple or enum
    Immutable config: ImmutableDictionary (System.Collections.Immutable)
    
