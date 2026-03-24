---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [string manipulation, string formatting, regex, f-strings, string interpolation]
keywords: [string, StringBuilder, interpolation, Regex, Split, Join, Trim, Replace, Span, Format]
description: "C# strings reference with executable examples and cell outputs — covers string creation, indexing, methods, interpolation, StringBuilder, and regular expressions. See [[02_py_strings]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[02_py_strings]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 02. Strings - C#

## 1. String Creation & Basics


```csharp
// String (string) - immutable sequence of Unicode characters
// C# has both 'string' (alias) and 'char' (single Unicode character, 2 bytes)

Console.WriteLine("=== String Creation ===");
// Double quotes only for strings, single quotes for char
string s1 = "hello";
char c1 = 'A';                // single char — NOT a string
Console.WriteLine($"String:         \"{s1}\"");
Console.WriteLine($"Char:           '{c1}' (type: {c1.GetType().Name})");

// Verbatim strings (@) — no escape processing (like Python's r"")
string s2 = @"C:\Users\new\test";
string s3 = "C:\\Users\\new\\test";
Console.WriteLine($"\nVerbatim:       {s2}");
Console.WriteLine($"Escaped:        {s3}");
Console.WriteLine($"Same? {s2 == s3}");

// Multiline — verbatim or raw string literals (C# 11+)
string s4 = @"This is
a multiline
string";
Console.WriteLine($"\nVerbatim multiline:\n{s4}");

// Raw string literals (C# 11+) — triple quotes like Python
string s5 = """
    This is a
    raw string literal
    """;
Console.WriteLine($"Raw string literal:\n{s5}");

// String from other types
Console.WriteLine("=== String Conversion ===");
Console.WriteLine($"42.ToString():      '{42.ToString()}'");
Console.WriteLine($"3.14.ToString():    '{3.14.ToString()}'");
Console.WriteLine($"true.ToString():    '{true.ToString()}'");
Console.WriteLine($"Convert.ToString(): '{Convert.ToString(42)}'");
// null-safe conversion
object? obj = null;
Console.WriteLine($"obj?.ToString():    '{obj?.ToString() ?? "(null)"}'");

// String repetition and concatenation
Console.WriteLine("\n=== Repetition & Concatenation ===");
// No * operator for strings — use constructor or string.Concat
Console.WriteLine($"new string('*', 5):  '{new string('*', 5)}'");
Console.WriteLine($"string.Concat(Enumerable.Repeat(\"ha\", 3)): '{string.Concat(Enumerable.Repeat("ha", 3))}'");
Console.WriteLine($"\"hello\" + \" \" + \"world\": '{"hello" + " " + "world"}'");

// Empty string
Console.WriteLine("\n=== Empty String ===");
string empty = "";
Console.WriteLine($"empty == \"\":       {empty == ""}");
Console.WriteLine($"string.Empty:      \"{string.Empty}\"");
Console.WriteLine($"empty.Length:       {empty.Length}");
Console.WriteLine($"string.IsNullOrEmpty(\" \"): {string.IsNullOrEmpty(" ")}");
Console.WriteLine($"string.IsNullOrEmpty(\"\"): {string.IsNullOrEmpty("")}");
Console.WriteLine($"string.IsNullOrEmpty(null): {string.IsNullOrEmpty(null)}");
Console.WriteLine($"string.IsNullOrWhiteSpace(\"  \"): {string.IsNullOrWhiteSpace("  ")}");
Console.WriteLine($"string.IsNullOrWhiteSpace(\"\"): {string.IsNullOrWhiteSpace("")}");

// String immutability
Console.WriteLine("\n=== Immutability ===");
string s = "hello";
// s[0] = 'H';  // Compile error! Strings are immutable
s = 'H' + s.Substring(1);  // must create a new string
Console.WriteLine($"Modified: {s}");
```

    === String Creation ===
    String:         "hello"
    Char:           'A' (type: Char)
    
    Verbatim:       C:\Users\new\test
    Escaped:        C:\Users\new\test
    Same? True
    
    Verbatim multiline:
    This is
    a multiline
    string
    Raw string literal:
    This is a
    raw string literal
    === String Conversion ===
    42.ToString():      '42'
    3.14.ToString():    '3.14'
    true.ToString():    'True'
    Convert.ToString(): '42'
    obj?.ToString():    '(null)'
    
    === Repetition & Concatenation ===
    new string('*', 5):  '*****'
    string.Concat(Enumerable.Repeat("ha", 3)): 'hahaha'
    "hello" + " " + "world": 'hello world'
    
    === Empty String ===
    empty == "":       True
    string.Empty:      ""
    empty.Length:       0
    string.IsNullOrEmpty(" "): False
    string.IsNullOrEmpty(""): True
    string.IsNullOrEmpty(null): True
    string.IsNullOrWhiteSpace("  "): True
    string.IsNullOrWhiteSpace(""): True
    
    === Immutability ===
    Modified: Hello
    

    
    (38,7): warning CS8632: The annotation for nullable reference types should only be used in code within a '#nullable' annotations context.
    
    

## 2. Indexing & Slicing


```csharp
// Indexing & Slicing
string s = "Hello, World!";
//           0123456789...

Console.WriteLine("=== Indexing (0-based) ===");
Console.WriteLine($"s[0]:     '{s[0]}'");        // H (returns char)
Console.WriteLine($"s[1]:     '{s[1]}'");        // e
Console.WriteLine($"s[^1]:    '{s[^1]}'");       // ! (last char — ^1 is Index from end)
Console.WriteLine($"s[^2]:    '{s[^2]}'");       // d (second to last)

Console.WriteLine("\n=== Slicing with Range operator [start..stop] ===");
Console.WriteLine($"s[0..5]:  '{s[0..5]}'");     // Hello (stop is exclusive)
Console.WriteLine($"s[..5]:   '{s[..5]}'");      // Hello (start defaults to 0)
Console.WriteLine($"s[7..]:   '{s[7..]}'");      // World! (stop defaults to end)
Console.WriteLine($"s[^6..]:  '{s[^6..]}'");     // orld! (from end)
Console.WriteLine($"s[7..12]: '{s[7..12]}'");    // World

// Substring — older API, same purpose
Console.WriteLine($"\nSubstring(7):    '{s.Substring(7)}'");      // World!
Console.WriteLine($"Substring(7,5):  '{s.Substring(7, 5)}'");    // World

// No step/stride in C# — no equivalent to Python's s[::2] or s[::-1]
// Must use LINQ or manual methods
Console.WriteLine("\n=== Step/Reverse (no built-in, use LINQ) ===");
Console.WriteLine($"Every 2nd:  '{new string(s.Where((c, i) => i % 2 == 0).ToArray())}'");
Console.WriteLine($"Reversed:   '{new string(s.Reverse().ToArray())}'");
// Or use Array.Reverse
char[] arr = s.ToCharArray();
Array.Reverse(arr);
Console.WriteLine($"Reversed:   '{new string(arr)}'");

// Out of range — throws exception (not forgiving like Python)
Console.WriteLine("\n=== Out of Range ===");
// Console.WriteLine(s[100]);   // IndexOutOfRangeException!
// Console.WriteLine(s[0..100]); // ArgumentOutOfRangeException!
Console.WriteLine("s[100] → IndexOutOfRangeException (Python would too)");
Console.WriteLine("s[0..100] → ArgumentOutOfRangeException (Python returns full string)");

// Iterate over characters
Console.WriteLine("\n=== Iteration ===");
Console.Write("Chars: ");
foreach (char ch in s[..5])
    Console.Write($"{ch} ");
Console.WriteLine();

// Index + character — LINQ Select (like Python's enumerate)
Console.WriteLine("Enumerated (LINQ):");
foreach (var (ch, i) in s[..5].Select((c, i) => (c, i)))
    Console.WriteLine($"  [{i}] = '{ch}'");

// Same with plain for loop (simpler when you need an index)
Console.WriteLine("Enumerated (for loop):");
for (int i = 0; i < 5; i++)
    Console.WriteLine($"  [{i}] = '{s[i]}'");
```

    === Indexing (0-based) ===
    s[0]:     'H'
    s[1]:     'e'
    s[^1]:    '!'
    s[^2]:    'd'
    
    === Slicing with Range operator [start..stop] ===
    s[0..5]:  'Hello'
    s[..5]:   'Hello'
    s[7..]:   'World!'
    s[^6..]:  'World!'
    s[7..12]: 'World'
    
    Substring(7):    'World!'
    Substring(7,5):  'World'
    
    === Step/Reverse (no built-in, use LINQ) ===
    Every 2nd:  'Hlo ol!'
    Reversed:   '!dlroW ,olleH'
    Reversed:   '!dlroW ,olleH'
    
    === Out of Range ===
    s[100] → IndexOutOfRangeException (Python would too)
    s[0..100] → ArgumentOutOfRangeException (Python returns full string)
    
    === Iteration ===
    Chars: H e l l o 
    Enumerated (LINQ):
      [0] = 'H'
      [1] = 'e'
      [2] = 'l'
      [3] = 'l'
      [4] = 'o'
    Enumerated (for loop):
      [0] = 'H'
      [1] = 'e'
      [2] = 'l'
      [3] = 'l'
      [4] = 'o'
    

## 3. String Methods


```csharp
#nullable enable

// String Methods — Case, Whitespace, Checking, Searching, Replacing
using System.Globalization;

string s = "  Hello, World!  ";

// === Case Methods ===
Console.WriteLine("=== Case Methods ===");
Console.WriteLine($"ToUpper():     '{"hello world".ToUpper()}'");
Console.WriteLine($"ToLower():     '{"HELLO WORLD".ToLower()}'");
// No built-in Title Case — use TextInfo
Console.WriteLine($"ToTitleCase(): '{CultureInfo.CurrentCulture.TextInfo.ToTitleCase("hello world")}'");
// No swapcase or casefold — must implement manually

// === Whitespace Methods ===
Console.WriteLine("\n=== Whitespace Methods ===");
Console.WriteLine($"Trim():        '{s.Trim()}'");           // both sides
Console.WriteLine($"TrimStart():   '{s.TrimStart()}'");      // left only
Console.WriteLine($"TrimEnd():     '{s.TrimEnd()}'");        // right only
Console.WriteLine($"Trim('!'):     '{"Hello!!".Trim('!')}'");  // trim specific chars

// === Padding & Alignment ===
Console.WriteLine("\n=== Padding & Alignment ===");
Console.WriteLine($"PadLeft(20):   '{"hello".PadLeft(20)}'");
Console.WriteLine($"PadRight(20):  '{"hello".PadRight(20)}'");
Console.WriteLine($"PadLeft(20,'*'):'{"hello".PadLeft(20, '*')}'");
Console.WriteLine($"PadLeft(8,'0'):'{"42".PadLeft(8, '0')}'");      // like Python zfill
// No built-in center — combine PadLeft+PadRight

// === Checking Methods (return bool) ===
Console.WriteLine("\n=== Checking Methods ===");
// C# uses char-level checks or LINQ — no direct string.isalpha() etc.
Console.WriteLine($"  char.IsLetter('A'):    {char.IsLetter('A')}");
Console.WriteLine($"  char.IsDigit('5'):     {char.IsDigit('5')}");
Console.WriteLine($"  char.IsWhiteSpace(' '):{char.IsWhiteSpace(' ')}");
Console.WriteLine($"  char.IsUpper('A'):     {char.IsUpper('A')}");
Console.WriteLine($"  char.IsLower('a'):     {char.IsLower('a')}");
// String-level checks with LINQ
Console.WriteLine($"  All letters:  {"Hello".All(char.IsLetter)}");       // isalpha
Console.WriteLine($"  All digits:   {"12345".All(char.IsDigit)}");        // isdigit
Console.WriteLine($"  All alnum:    {"Hello123".All(char.IsLetterOrDigit)}"); // isalnum
Console.WriteLine($"  All upper:    {"HELLO".All(char.IsUpper)}");
Console.WriteLine($"  All lower:    {"hello".All(char.IsLower)}");
Console.WriteLine($"  All ASCII:    {"Hello".All(c => c < 128)}");

// === Searching ===
Console.WriteLine("\n=== Searching ===");
s = "Hello, World! Hello, C#!";
Console.WriteLine($"IndexOf(\"Hello\"):     {s.IndexOf("Hello")}");        // 0
Console.WriteLine($"IndexOf(\"Hello\",1):   {s.IndexOf("Hello", 1)}");     // 14
Console.WriteLine($"LastIndexOf(\"Hello\"): {s.LastIndexOf("Hello")}");    // 14
Console.WriteLine($"IndexOf(\"Java\"):      {s.IndexOf("Java")}");         // -1
Console.WriteLine($"Contains(\"World\"):    {s.Contains("World")}");       // True (Py: 'in')
Console.WriteLine($"StartsWith(\"Hello\"): {s.StartsWith("Hello")}");
Console.WriteLine($"EndsWith(\"!\"):       {s.EndsWith("!")}");
// Count occurrences — no built-in, use LINQ or regex
int count = s.Split("Hello").Length - 1;
Console.WriteLine($"Count \"Hello\":       {count}");

// === Replace ===
Console.WriteLine("\n=== Replace ===");
Console.WriteLine($"Replace:           '{s.Replace("Hello", "Hi")}'");
// No max count parameter — replaces ALL (use Regex for first-only)

// === Splitting & Joining ===
Console.WriteLine("\n=== Splitting & Joining ===");
string csv = "apple,banana,cherry";
Console.WriteLine($"Split(','):        [{string.Join(", ", csv.Split(','))}]");
Console.WriteLine($"Split(',', 2):     [{string.Join(", ", csv.Split(',', 2))}]");
string words = "  hello  world  ";
Console.WriteLine($"Split():           [{string.Join(", ", words.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))}]");
Console.WriteLine($"Split(' '):        [{string.Join(", ", words.Split(' '))}]");

// StringSplitOptions
Console.WriteLine($"RemoveEmpty:       [{string.Join(", ", "a,,b,,c".Split(',', StringSplitOptions.RemoveEmptyEntries))}]");
Console.WriteLine($"TrimEntries:       [{string.Join(", ", " a , b , c ".Split(',', StringSplitOptions.TrimEntries))}]");

// Join
string[] parts = { "hello", "world", "csharp" };
Console.WriteLine($"Join(' '):         '{string.Join(' ', parts)}'");
Console.WriteLine($"Join(', '):        '{string.Join(", ", parts)}'");
Console.WriteLine($"Join('->'):        '{string.Join("->", parts)}'");
Console.WriteLine($"Concat:            '{string.Concat(parts)}'");

// === Encoding ===
Console.WriteLine("\n=== Encoding ===");
byte[] utf8 = System.Text.Encoding.UTF8.GetBytes("hello");
byte[] ascii = System.Text.Encoding.ASCII.GetBytes("hello");
Console.WriteLine($"UTF8:  [{string.Join(", ", utf8)}]");
Console.WriteLine($"ASCII: [{string.Join(", ", ascii)}]");
Console.WriteLine($"Back:  '{System.Text.Encoding.UTF8.GetString(utf8)}'");
```

    === Case Methods ===
    ToUpper():     'HELLO WORLD'
    ToLower():     'hello world'
    ToTitleCase(): 'Hello World'
    
    === Whitespace Methods ===
    Trim():        'Hello, World!'
    TrimStart():   'Hello, World!  '
    TrimEnd():     '  Hello, World!'
    Trim('!'):     'Hello'
    
    === Padding & Alignment ===
    PadLeft(20):   '               hello'
    PadRight(20):  'hello               '
    PadLeft(20,'*'):'***************hello'
    PadLeft(8,'0'):'00000042'
    
    === Checking Methods ===
      char.IsLetter('A'):    True
      char.IsDigit('5'):     True
      char.IsWhiteSpace(' '):True
      char.IsUpper('A'):     True
      char.IsLower('a'):     True
      All letters:  True
      All digits:   True
      All alnum:    True
      All upper:    True
      All lower:    True
      All ASCII:    True
    
    === Searching ===
    IndexOf("Hello"):     0
    IndexOf("Hello",1):   14
    LastIndexOf("Hello"): 14
    IndexOf("Java"):      -1
    Contains("World"):    True
    StartsWith("Hello"): True
    EndsWith("!"):       True
    Count "Hello":       2
    
    === Replace ===
    Replace:           'Hi, World! Hi, C#!'
    
    === Splitting & Joining ===
    Split(','):        [apple, banana, cherry]
    Split(',', 2):     [apple, banana,cherry]
    Split():           [hello, world]
    Split(' '):        [, , hello, , world, , ]
    RemoveEmpty:       [a, b, c]
    TrimEntries:       [a, b, c]
    Join(' '):         'hello world csharp'
    Join(', '):        'hello, world, csharp'
    Join('->'):        'hello->world->csharp'
    Concat:            'helloworldcsharp'
    
    === Encoding ===
    UTF8:  [104, 101, 108, 108, 111]
    ASCII: [104, 101, 108, 108, 111]
    Back:  'hello'
    

## 4. String Formatting


```csharp
// String Formatting — interpolation, String.Format, and format specifiers
// (moved from 01_Basics and extended)
using System.Globalization;

string name = "Alice";
int age = 30;
double n = 1234567.89123;
double pct = 0.856;

// === Two formatting methods ===
Console.WriteLine("=== 1. String Interpolation (recommended) ===");
Console.WriteLine($"Name: {name}, Age: {age}");
Console.WriteLine($"Expression: {age + 1}");
Console.WriteLine($"Method call: {name.ToUpper()}");

Console.WriteLine("\n=== 2. String.Format() ===");
Console.WriteLine(string.Format("Name: {0}, Age: {1}", name, age));
Console.WriteLine(string.Format("Name: {0}, Age: {1}, {0} again", name, age));

// === Number format specifiers ===
Console.WriteLine("\n=== Number Formatting ===");
Console.WriteLine($"Fixed 2 dec:    {n.ToString("F2")}");
Console.WriteLine($"Fixed 0 dec:    {n.ToString("F0")}");
Console.WriteLine($"Comma sep:      {n.ToString("N2")}");
Console.WriteLine($"Scientific:     {n.ToString("E2")}");
Console.WriteLine($"General:        {n.ToString("G4")}");
Console.WriteLine($"Percentage:     {pct.ToString("P1")}");
Console.WriteLine($"Currency:       {n.ToString("C2")}");
Console.WriteLine($"Phone:          {1234567890:###-###-####}");

// === Integer formatting ===
Console.WriteLine("\n=== Integer Formatting ===");
int x = 255;
Console.WriteLine($"Decimal:        {x.ToString("D")}");
Console.WriteLine($"Hex upper:      {x.ToString("X")}");
Console.WriteLine($"Hex lower:      {x.ToString("x")}");
Console.WriteLine($"Zero-padded:    {x.ToString("D8")}");
Console.WriteLine($"Binary:         {Convert.ToString(x, 2)}");
Console.WriteLine($"Octal:          {Convert.ToString(x, 8)}");

// === Alignment & Padding ===
Console.WriteLine("\n=== Alignment & Padding ===");
string s = "hi";
Console.WriteLine($"Left 10:        '{s,-10}'");            // negative = left-align
Console.WriteLine($"Right 10:       '{s,10}'");             // positive = right-align
Console.WriteLine($"PadLeft(*):     '{s.PadLeft(10, '*')}'");
Console.WriteLine($"PadRight(*):    '{s.PadRight(10, '*')}'");

// === Currency with CultureInfo ===
Console.WriteLine("\n=== Currency Formatting ===");
double amt = 1234567.89;
Console.WriteLine($"US:  {amt.ToString("C2", new CultureInfo("en-US"))}");
Console.WriteLine($"EUR: {amt.ToString("C2", new CultureInfo("fr-FR"))}");
Console.WriteLine($"JPY: {amt.ToString("C0", new CultureInfo("ja-JP"))}");
Console.WriteLine($"CNY: {amt.ToString("C2", new CultureInfo("zh-CN"))}");
Console.WriteLine($"BRL: {amt.ToString("C2", new CultureInfo("pt-BR"))}");
Console.WriteLine($"GBP: {amt.ToString("C2", new CultureInfo("en-GB"))}");
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

    probeAddresses(["http://2a02:8308:718a:f200::280b:2048/","http://2a02:8308:718a:f200:8bd4:d06d:33ed:be05:2048/","http://2a02:8308:718a:f200:2c21:dd48:3480:3c4d:2048/","http://2a02:8308:718a:f200:6854:c800:c412:8103:2048/","http://fe80::3212:d8da:d32d:4723%14:2048/","http://192.168.0.110:2048/","http://::1:2048/","http://127.0.0.1:2048/"])

        .then((root) => {

        // use probing to find host url and api resources

        // load interactive helpers and language services

        let dotnetInteractiveRequire = require.config({

        context: '21832.Microsoft.DotNet.Interactive.Http.HttpPort',

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


    === 1. String Interpolation (recommended) ===
    Name: Alice, Age: 30
    Expression: 31
    Method call: ALICE
    
    === 2. String.Format() ===
    Name: Alice, Age: 30
    Name: Alice, Age: 30, Alice again
    
    === Number Formatting ===
    Fixed 2 dec:    1234567.89
    Fixed 0 dec:    1234568
    Comma sep:      1'234'567.89
    Scientific:     1.23E+006
    General:        1.235E+06
    Percentage:     85.6%
    Currency:       $1,234,567.89
    Phone:          123-456-7890
    
    === Integer Formatting ===
    Decimal:        255
    Hex upper:      FF
    Hex lower:      ff
    Zero-padded:    00000255
    Binary:         11111111
    Octal:          377
    
    === Alignment & Padding ===
    Left 10:        'hi        '
    Right 10:       '        hi'
    PadLeft(*):     '********hi'
    PadRight(*):    'hi********'
    
    === Currency Formatting ===
    US:  $1,234,567.89
    EUR: 1 234 567,89 €
    JPY: ￥1,234,568
    CNY: ¥1,234,567.89
    BRL: R$ 1.234.567,89
    GBP: £1,234,567.89
    

## 5. Efficient String Building (StringBuilder)


```csharp
// StringBuilder — mutable string buffer for efficient building
// string is IMMUTABLE — each + creates a new string object
// StringBuilder modifies in-place, much faster for loops
using System.Text;
using System.Diagnostics;

// === Why + in a loop is slow ===
Console.WriteLine("=== Performance: + vs StringBuilder ===");

var sw = Stopwatch.StartNew();
string result = "";
for (int i = 0; i < 50000; i++)
    result += i.ToString();
sw.Stop();
var t1 = sw.Elapsed.TotalSeconds;
Console.WriteLine($"+ in loop (50k):     {t1:F4}s  len={result.Length}");

sw.Restart();
var sb = new StringBuilder();
for (int i = 0; i < 50000; i++)
    sb.Append(i);
result = sb.ToString();
sw.Stop();
var t2 = sw.Elapsed.TotalSeconds;
Console.WriteLine($"StringBuilder (50k): {t2:F4}s  len={result.Length}");
Console.WriteLine($"StringBuilder is {t1/t2:F1}x faster");

// === StringBuilder API ===
Console.WriteLine("\n=== StringBuilder Methods ===");
sb = new StringBuilder("Hello");
sb.Append(", ");                          // append string
sb.Append("World!");
sb.AppendLine();                          // append + newline
sb.AppendLine($"Number: {42}");           // formatted append
sb.Insert(0, ">>> ");                     // insert at position
sb.Replace("World", "C#");               // replace
Console.WriteLine($"Result:\n{sb}");
Console.WriteLine($"Length:   {sb.Length}");
Console.WriteLine($"Capacity: {sb.Capacity}");

// StringBuilder with initial capacity (avoid resizing)
var sb2 = new StringBuilder(1000);        // pre-allocate
Console.WriteLine($"Pre-alloc capacity: {sb2.Capacity}");

// === string.Join — best for joining collections ===
Console.WriteLine("\n=== string.Join (like Python ' '.join()) ===");
var items = Enumerable.Range(0, 5).Select(i => $"item_{i}");
Console.WriteLine($"Join: '{string.Join(", ", items)}'");

// === string.Concat — no separator ===
Console.WriteLine($"Concat: '{string.Concat(Enumerable.Range(0, 5))}'");

// === string.Create — advanced, allocation-free ===
Console.WriteLine("\n=== When + is fine ===");
string first = "Hello";
string last = "World";
string full = first + " " + last;     // compiler optimizes small concats
Console.WriteLine($"Small concat: '{full}'");
Console.WriteLine("Rule: use + for 2-5 strings, StringBuilder for loops");
```

    === Performance: + vs StringBuilder ===
    + in loop (50k):     4.5004s  len=238890
    StringBuilder (50k): 0.0007s  len=238890
    StringBuilder is 6088.2x faster
    
    === StringBuilder Methods ===
    Result:
    >>> Hello, C#!
    Number: 42
    
    Length:   28
    Capacity: 33
    Pre-alloc capacity: 1000
    
    === string.Join (like Python ' '.join()) ===
    Join: 'item_0, item_1, item_2, item_3, item_4'
    Concat: '01234'
    
    === When + is fine ===
    Small concat: 'Hello World'
    Rule: use + for 2-5 strings, StringBuilder for loops
    

## 6. Regular Expressions


```csharp
// Regular Expressions — comprehensive reference
using System.Text.RegularExpressions;

string text = "Contact us at support@email.com or sales@company.org. Call 123-456-7890 or 987-654-3210.";

// === Core Operations ===
Console.WriteLine("=== Regex.Match() — First Match ===");
var match = Regex.Match(text, @"\d{3}-\d{3}-\d{4}");
if (match.Success)
    Console.WriteLine($"Found: {match.Value} at [{match.Index}:{match.Index + match.Length}]");

Console.WriteLine("\n=== Regex.Matches() — All Matches ===");
var phones = Regex.Matches(text, @"\d{3}-\d{3}-\d{4}");
var emails = Regex.Matches(text, @"[\w.+-]+@[\w-]+\.[\w.]+");
Console.WriteLine($"Phones: {string.Join(", ", phones.Select(m => m.Value))}");
Console.WriteLine($"Emails: {string.Join(", ", emails.Select(m => m.Value))}");

// Iterate matches (like finditer)
Console.WriteLine("\n=== Iterate Matches ===");
foreach (Match m in phones)
    Console.WriteLine($"  {m.Value} at [{m.Index}:{m.Index + m.Length}]");

Console.WriteLine("\n=== Regex.IsMatch() — Test only ===");
Console.WriteLine($"IsMatch(digits): {Regex.IsMatch("12345", @"^\d+$")}");    // True
Console.WriteLine($"IsMatch(mixed):  {Regex.IsMatch("123a5", @"^\d+$")}");    // False

// === Groups ===
Console.WriteLine("\n=== Groups — Capture Parts ===");
match = Regex.Match(text, @"(\d{3})-(\d{3})-(\d{4})");
if (match.Success)
{
    Console.WriteLine($"Full:     {match.Groups[0].Value}");
    Console.WriteLine($"Area:     {match.Groups[1].Value}");
    Console.WriteLine($"Mid:      {match.Groups[2].Value}");
    Console.WriteLine($"Last:     {match.Groups[3].Value}");
}

// Named groups
match = Regex.Match(text, @"(?<user>[\w.+-]+)@(?<domain>[\w-]+\.[\w.]+)");
if (match.Success)
{
    Console.WriteLine($"User:     {match.Groups["user"].Value}");
    Console.WriteLine($"Domain:   {match.Groups["domain"].Value}");
}

// === Replace ===
Console.WriteLine("\n=== Regex.Replace() ===");
Console.WriteLine(Regex.Replace(text, @"\d{3}-\d{3}-\d{4}", "***-***-****"));
// Replace with function (MatchEvaluator)
Console.WriteLine(Regex.Replace("price: 50, qty: 3", @"\d+", m => (int.Parse(m.Value) * 2).ToString()));
// Replace with backreference
Console.WriteLine(Regex.Replace("user@host", @"(\w+)@(\w+)", "$2/$1"));

// === Split ===
Console.WriteLine("\n=== Regex.Split() ===");
Console.WriteLine(string.Join(", ", Regex.Split("Hello World. How are you? Fine!", @"[.!?]\s*")));
Console.WriteLine(string.Join(", ", Regex.Split("a , b , c", @"\s*,\s*")));

// === Compile ===
Console.WriteLine("\n=== new Regex() — Precompile for reuse ===");
var phonePat = new Regex(@"\d{3}-\d{3}-\d{4}", RegexOptions.Compiled);
Console.WriteLine(string.Join(", ", phonePat.Matches(text).Select(m => m.Value)));
Console.WriteLine(phonePat.Replace(text, "REDACTED"));
```

    === Regex.Match() — First Match ===
    Found: 123-456-7890 at [59:71]
    
    === Regex.Matches() — All Matches ===
    Phones: 123-456-7890, 987-654-3210
    Emails: support@email.com, sales@company.org.
    
    === Iterate Matches ===
      123-456-7890 at [59:71]
      987-654-3210 at [75:87]
    
    === Regex.IsMatch() — Test only ===
    IsMatch(digits): True
    IsMatch(mixed):  False
    
    === Groups — Capture Parts ===
    Full:     123-456-7890
    Area:     123
    Mid:      456
    Last:     7890
    User:     support
    Domain:   email.com
    
    === Regex.Replace() ===
    Contact us at support@email.com or sales@company.org. Call ***-***-**** or ***-***-****.
    price: 100, qty: 6
    host/user
    
    === Regex.Split() ===
    Hello World, How are you, Fine, 
    a, b, c
    
    === new Regex() — Precompile for reuse ===
    123-456-7890, 987-654-3210
    Contact us at support@email.com or sales@company.org. Call REDACTED or REDACTED.
    


```csharp
// Regex Syntax Reference & Flags
using System.Text.RegularExpressions;

Console.WriteLine("=== Regex Syntax Reference ===");
Console.WriteLine(@"
  CHARACTERS
  .         Any character (except newline)
  \d        Digit [0-9]              \D  Non-digit
  \w        Word char [a-zA-Z0-9_]   \W  Non-word
  \s        Whitespace [ \t\n\r]     \S  Non-whitespace
  \b        Word boundary             \B  Non-word boundary

  QUANTIFIERS
  *         0 or more (greedy)        *?  0 or more (lazy)
  +         1 or more (greedy)        +?  1 or more (lazy)
  ?         0 or 1 (optional)         ??  0 or 1 (lazy)
  {n}       Exactly n                 {n,m}  Between n and m
  {n,}      n or more                 {n,m}? Between n and m (lazy)

  ANCHORS
  ^         Start of string/line      $   End of string/line
  \A        Start of string only      \Z  End of string only

  GROUPS
  (...)     Capture group             (?:...)  Non-capture group
  (?<name>...)  Named group (C# uses <> not P<>)
  \1, \2    Backreference by number   \k<name> By name

  LOOKAROUND
  (?=...)   Lookahead (positive)      (?!...)  Lookahead (negative)
  (?<=...)  Lookbehind (positive)     (?<!...) Lookbehind (negative)

  CHARACTER CLASSES
  [abc]     Any of a, b, c            [^abc]  NOT a, b, c
  [a-z]     Range a through z         [a-zA-Z0-9]  Alphanumeric
  |         OR (alternation)
");

// === Flags (RegexOptions) ===
Console.WriteLine("=== RegexOptions ===");
string text = "Hello\nworld\nHELLO";

var ic = Regex.Matches(text, @"hello", RegexOptions.IgnoreCase);
Console.WriteLine($"IgnoreCase:  {string.Join(", ", ic.Select(m => m.Value))}");

var ml = Regex.Matches(text, @"^\w+", RegexOptions.Multiline);
Console.WriteLine($"Multiline:   {string.Join(", ", ml.Select(m => m.Value))}");

Console.WriteLine($"Singleline:  {Regex.IsMatch(text, @"Hello.world", RegexOptions.Singleline)}");  // . matches \n

// IgnorePatternWhitespace — like Python's re.VERBOSE
var pattern = new Regex(@"
    (\d{3})     # area code
    [-.]        # separator
    (\d{3})     # first 3 digits
    [-.]        # separator
    (\d{4})     # last 4 digits
", RegexOptions.IgnorePatternWhitespace);
var m2 = pattern.Match("Call 123-456-7890");
if (m2.Success) Console.WriteLine($"Verbose:     {m2.Groups[1]}-{m2.Groups[2]}-{m2.Groups[3]}");

// Combine flags
var combined = Regex.Matches(text, @"^hello", RegexOptions.IgnoreCase | RegexOptions.Multiline);
Console.WriteLine($"Combined:    {string.Join(", ", combined.Select(m => m.Value))}");

// === RegexOptions reference ===
Console.WriteLine("\n=== RegexOptions Reference ===");
Console.WriteLine("IgnoreCase              (Py: re.IGNORECASE)");
Console.WriteLine("Multiline               (Py: re.MULTILINE)");
Console.WriteLine("Singleline              (Py: re.DOTALL)");
Console.WriteLine("IgnorePatternWhitespace (Py: re.VERBOSE)");
Console.WriteLine("Compiled                (Py: re.compile — precompiles for speed)");
Console.WriteLine("RightToLeft             (Py: no equivalent)");
Console.WriteLine("ExplicitCapture         (Py: no equivalent)");
Console.WriteLine("NonBacktracking         (Py: no equivalent — .NET 7+, linear time)");

// === Common Real-World Patterns ===
Console.WriteLine("\n=== Common Patterns ===");
var patterns = new (string name, string pat)[] {
    ("email",           @"^[\w.+-]+@[\w-]+\.[\w.]+$"),
    ("URL",             @"https?://[\w./\-?=&#]+"),
    ("IPv4",            @"\b\d{1,3}(\.\d{1,3}){3}\b"),
    ("date YYYY-MM-DD", @"\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])"),
    ("time HH:MM",      @"(?:[01]\d|2[0-3]):[0-5]\d"),
    ("hex color",       @"^#[0-9a-fA-F]{6}$"),
    ("phone US",        @"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}"),
    ("zip code US",     @"\d{5}(-\d{4})?"),
    ("strong password", @"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$"),
};
foreach (var (pname, pat) in patterns)
    Console.WriteLine($"  {pname,-20}: {pat}");
```

    === Regex Syntax Reference ===
    
      CHARACTERS
      .         Any character (except newline)
      \d        Digit [0-9]              \D  Non-digit
      \w        Word char [a-zA-Z0-9_]   \W  Non-word
      \s        Whitespace [ \t\n\r]     \S  Non-whitespace
      \b        Word boundary             \B  Non-word boundary
    
      QUANTIFIERS
      *         0 or more (greedy)        *?  0 or more (lazy)
      +         1 or more (greedy)        +?  1 or more (lazy)
      ?         0 or 1 (optional)         ??  0 or 1 (lazy)
      {n}       Exactly n                 {n,m}  Between n and m
      {n,}      n or more                 {n,m}? Between n and m (lazy)
    
      ANCHORS
      ^         Start of string/line      $   End of string/line
      \A        Start of string only      \Z  End of string only
    
      GROUPS
      (...)     Capture group             (?:...)  Non-capture group
      (?<name>...)  Named group (C# uses <> not P<>)
      \1, \2    Backreference by number   \k<name> By name
    
      LOOKAROUND
      (?=...)   Lookahead (positive)      (?!...)  Lookahead (negative)
      (?<=...)  Lookbehind (positive)     (?<!...) Lookbehind (negative)
    
      CHARACTER CLASSES
      [abc]     Any of a, b, c            [^abc]  NOT a, b, c
      [a-z]     Range a through z         [a-zA-Z0-9]  Alphanumeric
      |         OR (alternation)
    
    === RegexOptions ===
    IgnoreCase:  Hello, HELLO
    Multiline:   Hello, world, HELLO
    Singleline:  True
    Verbose:     123-456-7890
    Combined:    Hello, HELLO
    
    === RegexOptions Reference ===
    IgnoreCase              (Py: re.IGNORECASE)
    Multiline               (Py: re.MULTILINE)
    Singleline              (Py: re.DOTALL)
    IgnorePatternWhitespace (Py: re.VERBOSE)
    Compiled                (Py: re.compile — precompiles for speed)
    RightToLeft             (Py: no equivalent)
    ExplicitCapture         (Py: no equivalent)
    NonBacktracking         (Py: no equivalent — .NET 7+, linear time)
    
    === Common Patterns ===
      email               : ^[\w.+-]+@[\w-]+\.[\w.]+$
      URL                 : https?://[\w./\-?=&#]+
      IPv4                : \b\d{1,3}(\.\d{1,3}){3}\b
      date YYYY-MM-DD     : \d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])
      time HH:MM          : (?:[01]\d|2[0-3]):[0-5]\d
      hex color           : ^#[0-9a-fA-F]{6}$
      phone US            : \(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}
      zip code US         : \d{5}(-\d{4})?
      strong password     : ^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$
    
