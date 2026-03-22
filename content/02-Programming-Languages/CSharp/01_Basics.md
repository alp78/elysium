---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [reference, programming-languages, csharp, dotnet, basics]
aliases: [variables, data types, type conversion, operators, console IO]
keywords: [variables, data types, type conversion, operators, Console.WriteLine, int, double, bool, string, var]
description: "C# basics reference with executable examples and cell outputs — covers variables, data types, type conversion, operators, and console I/O. See [[01_Basics - Python]] for the Python equivalent."
related:
  - "[[01_Basics - Python]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 01. Basics - C#

Topics covered:
- Environment Setup
- Hello World & Console I/O
- Variables, Constants & Data Types
- Type Conversion & Casting
- Operators (arithmetic, comparison, logical, bitwise)


```C#
// Suppress CS1701/CS1702 assembly version warnings in .NET Interactive.
// NuGet packages targeting .NET 8/9 trigger these on .NET 10 — harmless.
// Run this cell ONCE before any cells that use NuGet packages.

using System.Reflection;
using Microsoft.DotNet.Interactive;
using Microsoft.DotNet.Interactive.CSharp;

var csharpKernel = (CSharpKernel)Kernel.Root.FindKernelByName("csharp");
var optionsField = typeof(CSharpKernel).GetField("_scriptOptions",
    BindingFlags.NonPublic | BindingFlags.Instance);

var scriptOptions = optionsField.GetValue(csharpKernel);
var withWarningLevel = scriptOptions.GetType().GetMethod("WithWarningLevel");
var newOptions = withWarningLevel.Invoke(scriptOptions, new object[] { 0 });
optionsField.SetValue(csharpKernel, newOptions);

Console.WriteLine("WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.");
```

## 1. Environment Setup


```C#
// Check .NET version
Console.WriteLine($".NET version: {Environment.Version}");
Console.WriteLine($"OS: {Environment.OSVersion}");
Console.WriteLine($"Machine: {Environment.MachineName}");
```

    .NET version: 10.0.4
    OS: Microsoft Windows NT 10.0.26200.0
    Machine: ELYSIUM
    


```C#
// Check working directory
Console.WriteLine($"Working dir: {Environment.CurrentDirectory}");
Console.WriteLine($"User: {Environment.UserName}");
```

    Working dir: c:\Users\aperi\DEV\LANG
    User: Alex
    


```C#
// Load a NuGet package (this is how you add dependencies in notebooks)
#r "nuget: Newtonsoft.Json"

using Newtonsoft.Json;
Console.WriteLine($"Newtonsoft.Json loaded successfully");

// List loaded assemblies (alphabetically)
foreach (var asm in AppDomain.CurrentDomain.GetAssemblies()
    .OrderBy(a => a.GetName().Name)
    .Take(5))
{
    Console.WriteLine($"{asm.GetName().Name} == {asm.GetName().Version}");
}
Console.WriteLine("...");
```


<div><div></div><div></div><div><strong>Installed Packages</strong><ul><li><span>Newtonsoft.Json, 13.0.4</span></li></ul></div></div>


    Newtonsoft.Json loaded successfully
    Anonymously Hosted DynamicMethods Assembly == 0.0.0.0
    AsyncIO == 0.1.69.0
    FSharp.Compiler.Service == 43.10.103.0
    FSharp.Core == 10.0.0.0
    FSharp.DependencyManager.Nuget == 10.0.103.0
    ...
    


```C#
// Verify key assemblies are available
var assemblies = new[] {
    "System.Linq",
    "System.Collections",
    "System.IO",
    "System.Net.Http",
    "System.Text.Json",
    "System.Threading.Tasks"
};

foreach (var name in assemblies)
{
    try
    {
        System.Reflection.Assembly.Load(name);
        Console.WriteLine($"  {name}: OK");
    }
    catch
    {
        Console.WriteLine($"  {name}: MISSING");
    }
}
```

      System.Linq: OK
      System.Collections: OK
      System.IO: OK
      System.Net.Http: OK
      System.Text.Json: OK
      System.Threading.Tasks: OK
    

## 2. Console I/O


```C#
// String concatenation in output
Console.WriteLine("one" + " | " + "two" + " | " + "three");
```

    one | two | three
    


```C#
// String formatting methods

string name = "Alice";
int age = 30;

// String interpolation
Console.WriteLine($"Name: {name}, Age: {age}");

// String.Format()
Console.WriteLine(string.Format("Name: {0}, Age: {1}", name, age));

// Composite formatting
Console.WriteLine("Name: {0}, Age: {1}", name, age);

// Interpolation with expressions
Console.WriteLine($"Next year: {age + 1}");
Console.WriteLine($"Name uppercased: {name.ToUpper()}");
Console.WriteLine($"Pi to 2 decimals: {3.14159:F2}");
```

    Name: Alice, Age: 30
    Name: Alice, Age: 30
    Name: Alice, Age: 30
    Next year: 31
    Name uppercased: ALICE
    Pi to 2 decimals: 3.14
    


```C#
// Output formatting options for Console

// Console.Write vs Console.WriteLine
Console.WriteLine("=== Write vs WriteLine ===");
Console.Write("hello ");                  // no newline
Console.Write("world");                   // no newline
Console.WriteLine("!");                   // with newline: "hello world!"

// No sep equivalent — use string.Join()
Console.WriteLine("\n=== Separator (string.Join) ===");
var items = new[] { "a", "b", "c" };
Console.WriteLine(string.Join(", ", items));        // a, b, c
Console.WriteLine(string.Join("", items));          // abc
Console.WriteLine(string.Join(" → ", items));       // a → b → c
Console.WriteLine(string.Join("-", 2024, 3, 15));   // 2024-3-15

// Redirect output
Console.WriteLine("\n=== Redirect Output ===");
Console.Error.WriteLine("This goes to stderr");
// Console.SetOut(new StreamWriter("log.txt"));   // redirect stdout to file

// Escape sequences
Console.WriteLine("\n=== Escape Sequences ===");
Console.WriteLine("Tab:\tafter tab");
Console.WriteLine("Newline:\nafter newline");
Console.WriteLine("Backslash: \\");
Console.WriteLine("Quote: \"double\"");
Console.WriteLine("Unicode: \u2764 \u2605 \u2602");   // ❤ ★ ☂
Console.WriteLine("Null char: [\0] (invisible)");
Console.WriteLine(@"Verbatim string: \n \t not escaped");  // @ prefix = raw

// Verbatim vs regular strings
Console.WriteLine("\n=== Verbatim Strings (@) vs Raw ===");
Console.WriteLine("Regular:  C:\\Users\\file.txt");      // need \\
Console.WriteLine(@"Verbatim: C:\Users\file.txt");       // no escaping needed
Console.WriteLine($@"Combined: C:\Users\{Environment.UserName}");  // verbatim + interpolation

// ANSI colors (use \x1b for ESC character)
// Note: ConsoleColor API (Console.ForegroundColor) only works in real terminals, not notebooks
Console.WriteLine("\n=== ANSI Colors (\x1b escape) ===");
Console.WriteLine("\x1b[31mRed text\x1b[0m");
Console.WriteLine("\x1b[32mGreen text\x1b[0m");
// in terminal : Console.WriteLine("\033[1;34mBold blue (ANSI)\033[0m");
Console.WriteLine("\x1b[1;34mBold blue text\x1b[0m"); 
Console.WriteLine("\x1b[43m\x1b[30mBlack on yellow\x1b[0m");
Console.WriteLine("\x1b[4mUnderlined\x1b[0m");
Console.WriteLine("\x1b[9mStrikethrough\x1b[0m");
Console.WriteLine("\x1b[3mItalic\x1b[0m");

// Common ANSI codes reference
Console.WriteLine("\n=== ANSI Code Reference ===");
Console.WriteLine(@"  \x1b[0m   Reset        \x1b[1m   Bold");
Console.WriteLine(@"  \x1b[3m   Italic       \x1b[4m   Underline");
Console.WriteLine(@"  \x1b[9m   Strikethrough");
Console.WriteLine(@"  \x1b[30-37m  Foreground colors (black,red,green,yellow,blue,magenta,cyan,white)");
Console.WriteLine(@"  \x1b[40-47m  Background colors (same order)");

// ToString() formatting
Console.WriteLine("\n=== ToString() Overrides ===");
int num = 42;
Console.WriteLine(num.ToString());       // "42"
Console.WriteLine(num.ToString("X"));    // "2A" (hex)
Console.WriteLine(num.ToString("D8"));   // "00000042" (padded)
Console.WriteLine(num.ToString("C"));    // "$42.00" (currency)
Console.WriteLine(num.ToString("E2"));   // "4.20E+001" (scientific)
```

    === Write vs WriteLine ===
    hello world!
    
    === Separator (string.Join) ===
    a, b, c
    abc
    a → b → c
    2024-3-15
    
    === Redirect Output ===
    

    This goes to stderr
    

    
    === Escape Sequences ===
    Tab:	after tab
    Newline:
    after newline
    Backslash: \
    Quote: "double"
    Unicode: ❤ ★ ☂
    Null char: [ ] (invisible)
    Verbatim string: \n \t not escaped
    
    === Verbatim Strings (@) vs Raw ===
    Regular:  C:\Users\file.txt
    Verbatim: C:\Users\file.txt
    Combined: C:\Users\Alex
    
    === ANSI Colors ( escape) ===
    [31mRed text[0m
    [32mGreen text[0m
    [1;34mBold blue text[0m
    [43m[30mBlack on yellow[0m
    [4mUnderlined[0m
    [9mStrikethrough[0m
    [3mItalic[0m
    
    === ANSI Code Reference ===
      \x1b[0m   Reset        \x1b[1m   Bold
      \x1b[3m   Italic       \x1b[4m   Underline
      \x1b[9m   Strikethrough
      \x1b[30-37m  Foreground colors (black,red,green,yellow,blue,magenta,cyan,white)
      \x1b[40-47m  Background colors (same order)
    
    === ToString() Overrides ===
    42
    2A
    00000042
    $42.00
    4.20E+001
    


```C#
// Console input - ReadLine() always returns a string
string inputName = "Alice"; // In a real console app: Console.ReadLine()
Console.WriteLine($"Hello, {inputName}!");
Console.WriteLine($"Type of input: {inputName.GetType()}");
```

    Hello, Alice!
    Type of input: System.String
    


```C#
// Reading numeric input - must convert/parse manually
string ageStr = "30"; // In a real console app: Console.ReadLine()

// Unsafe conversion - throws on invalid input
// int age = int.Parse(ageStr);

// Safe conversion with TryParse (preferred)
if (int.TryParse(ageStr, out int age))
{
    Console.WriteLine($"Your age is {age}, type: {age.GetType()}");
}
else
{
    Console.WriteLine($"'{ageStr}' is not a valid integer");
}
```

    Your age is 30, type: System.Int32
    


```C#
// Reading float/double input with validation
string priceStr = "19.99"; // In a real console app: Console.ReadLine()

if (double.TryParse(priceStr, out double price))
{
    Console.WriteLine($"Price: ${price:F2}, type: {price.GetType()}");
}
else
{
    Console.WriteLine($"'{priceStr}' is not a valid number");
}
```

    Price: $19.99, type: System.Double
    


```C#
// Input validation loop - keep asking until valid
// In a real console app, these would use Console.ReadLine() in the loop

// Simulating validation with test data
string[] testInputs = { "abc", "", "42" };

int GetValidInt(string[] inputs)
{
    foreach (var input in inputs)
    {
        Console.WriteLine($"Trying: '{input}'");
        if (int.TryParse(input, out int result))
        {
            Console.WriteLine($"  Valid integer: {result}");
            return result;
        }
        Console.WriteLine($"  '{input}' is not valid. Please enter a whole number.");
    }
    return 0;
}

string GetNonEmptyString(string[] inputs)
{
    foreach (var input in inputs)
    {
        Console.WriteLine($"Trying: '{input}'");
        if (!string.IsNullOrWhiteSpace(input))
        {
            Console.WriteLine($"  Valid string: {input.Trim()}");
            return input.Trim();
        }
        Console.WriteLine("  Input cannot be empty.");
    }
    return "";
}

// Test them
GetValidInt(testInputs);
GetNonEmptyString(new[] { "", "  ", "Alice" });
```

    Trying: 'abc'
      'abc' is not valid. Please enter a whole number.
    Trying: ''
      '' is not valid. Please enter a whole number.
    Trying: '42'
      Valid integer: 42
    Trying: ''
      Input cannot be empty.
    Trying: '  '
      Input cannot be empty.
    Trying: 'Alice'
      Valid string: Alice
    

## 3. Variables, Constants & Data Types


```C#
// Variables - statically typed, must declare type (or use var)
int x = 10;
double y = 3.14;
string name = "Alice";
bool active = true;

// var lets the compiler infer the type (still statically typed)
var z = 42; // inferred as int

Console.WriteLine($"x = {x}, type: {x.GetType()}");
Console.WriteLine($"y = {y}, type: {y.GetType()}");
Console.WriteLine($"name = {name}, type: {name.GetType()}");
Console.WriteLine($"active = {active}, type: {active.GetType()}");
Console.WriteLine($"z = {z}, type: {z.GetType()}");

// Variables CANNOT change type (static typing)
// x = "now I'm a string"; // Compile error!
```

    x = 10, type: System.Int32
    y = 3.14, type: System.Double
    name = Alice, type: System.String
    active = True, type: System.Boolean
    z = 42, type: System.Int32
    


```C#
// Constants - C# has true constants enforced by the compiler

// const: compile-time constant, must be assigned at declaration
const double Pi = 3.14159;
const int MaxUsers = 100;
const string ApiUrl = "https://api.example.com";

Console.WriteLine($"Pi = {Pi}");
Console.WriteLine($"MaxUsers = {MaxUsers}");
Console.WriteLine($"ApiUrl = {ApiUrl}");

// Pi = 999; // Compile error: cannot assign to a constant

// readonly: runtime constant, can be assigned in constructor (class-level only)
// readonly fields are shown in the OOP notebook
```

    Pi = 3.14159
    MaxUsers = 100
    ApiUrl = https://api.example.com
    


```C#
// Integer types - fixed size, each has a defined range

// Signed integers
Console.WriteLine("=== Signed Integers ===");
Console.WriteLine($"sbyte   (8-bit):  {sbyte.MinValue} to {sbyte.MaxValue}");
Console.WriteLine($"short   (16-bit): {short.MinValue} to {short.MaxValue}");
Console.WriteLine($"int     (32-bit): {int.MinValue} to {int.MaxValue}");
Console.WriteLine($"long    (64-bit): {long.MinValue} to {long.MaxValue}");

Console.WriteLine();

// Unsigned integers
Console.WriteLine("=== Unsigned Integers ===");
Console.WriteLine($"byte    (8-bit):  {byte.MinValue} to {byte.MaxValue}");
Console.WriteLine($"ushort  (16-bit): {ushort.MinValue} to {ushort.MaxValue}");
Console.WriteLine($"uint    (32-bit): {uint.MinValue} to {uint.MaxValue}");
Console.WriteLine($"ulong   (64-bit): {ulong.MinValue} to {ulong.MaxValue}");

long big = 9_000_000_000_000L;   // L suffix for long
uint positive = 4_000_000_000U;  // U suffix for uint

// Overflow: int.MaxValue + 1 wraps around (unchecked) or throws (checked)
// checked { int overflow = int.MaxValue + 1; } // throws OverflowException
```

    === Signed Integers ===
    sbyte   (8-bit):  -128 to 127
    short   (16-bit): -32768 to 32767
    int     (32-bit): -2147483648 to 2147483647
    long    (64-bit): -9223372036854775808 to 9223372036854775807
    
    === Unsigned Integers ===
    byte    (8-bit):  0 to 255
    ushort  (16-bit): 0 to 65535
    uint    (32-bit): 0 to 4294967295
    ulong   (64-bit): 0 to 18446744073709551615
    
    tiny = 127 
    small = 32000 
    regular = 2000000000
    big = 9000000000000 
    positive = 4000000000
    


```C#
// Floating-point types

Console.WriteLine("=== Floating-Point Types ===");
Console.WriteLine($"float   (32-bit): {float.MinValue} to {float.MaxValue}, ~6-9 digits precision");
Console.WriteLine($"double  (64-bit): {double.MinValue} to {double.MaxValue}, ~15-17 digits precision");
Console.WriteLine($"decimal (128-bit): {decimal.MinValue} to {decimal.MaxValue}, 28-29 digits precision");

// Literal suffixes: f=float, d=double (default), m=decimal
float f = 3.14f;        // f suffix required
double d = 3.14;        // default for decimal literals (d suffix optional)
decimal m = 3.14m;      // m suffix required (money/precise)

Console.WriteLine($"\nfloat:   {f}, type: {f.GetType()}");
Console.WriteLine($"double:  {d}, type: {d.GetType()}");
Console.WriteLine($"decimal: {m}, type: {m.GetType()}");

// Default literal type demonstration with var
var a = 3.14;           // double (default, no suffix)
var b = 3.14f;          // float
var c = 3.14d;          // double (explicit but redundant)
var e = 3.14m;          // decimal
Console.WriteLine($"\nvar a = 3.14   -> {a.GetType().Name}");
Console.WriteLine($"var b = 3.14f  -> {b.GetType().Name}");
Console.WriteLine($"var c = 3.14d  -> {c.GetType().Name}");
Console.WriteLine($"var e = 3.14m  -> {e.GetType().Name}");

// float requires f suffix - without it, the literal is double and won't compile
// float bad = 3.14;    // Compile error: cannot implicitly convert double to float
// float good = 3.14f;  // OK

// Special values (float and double only, not decimal)
Console.WriteLine($"\nInfinity: {double.PositiveInfinity}");
Console.WriteLine($"Neg Infinity: {double.NegativeInfinity}");
Console.WriteLine($"NaN: {double.NaN}");

// Floating point imprecision
Console.WriteLine($"\n0.1 + 0.2 = {0.1 + 0.2}");          // imprecise
Console.WriteLine($"0.1m + 0.2m = {0.1m + 0.2m}");        // decimal is precise!
```

    === Floating-Point Types ===
    float   (32-bit): -3.4028235E+38 to 3.4028235E+38, ~6-9 digits precision
    double  (64-bit): -1.7976931348623157E+308 to 1.7976931348623157E+308, ~15-17 digits precision
    decimal (128-bit): -79228162514264337593543950335 to 79228162514264337593543950335, 28-29 digits precision
    
    float:   3.14, type: System.Single
    double:  3.14, type: System.Double
    decimal: 3.14, type: System.Decimal
    
    var a = 3.14   -> Double
    var b = 3.14f  -> Single
    var c = 3.14d  -> Double
    var e = 3.14m  -> Decimal
    
    Infinity: ∞
    Neg Infinity: -∞
    NaN: NaN
    
    0.1 + 0.2 = 0.30000000000000004
    0.1m + 0.2m = 0.3
    


```C#
// Complex numbers (System.Numerics)
using System.Numerics;

var z = new Complex(3, 4);
Console.WriteLine($"z = {z}, type: {z.GetType()}");
Console.WriteLine($"Real: {z.Real}, Imaginary: {z.Imaginary}");
Console.WriteLine($"Conjugate: {Complex.Conjugate(z)}");
Console.WriteLine($"Magnitude: {z.Magnitude}");
```

    z = <3; 4>, type: System.Numerics.Complex
    Real: 3, Imaginary: 4
    Conjugate: <3; -4>
    Magnitude: 5
    


```C#
// Boolean (bool) - true or false only, NOT interchangeable with int
bool a = true;
bool b = false;

Console.WriteLine($"a = {a}, type: {a.GetType()}");
Console.WriteLine($"b = {b}, type: {b.GetType()}");

// bool is NOT an int in C# - no implicit conversion
// Console.WriteLine(true + true);  // Compile error!
// int x = true;                    // Compile error!

// Explicit conversion
Console.WriteLine($"Convert.ToInt32(true) = {Convert.ToInt32(true)}");    // 1
Console.WriteLine($"Convert.ToInt32(false) = {Convert.ToInt32(false)}");  // 0

// No truthy/falsy concept - must be explicit bool
// if ("hello") {}  // Compile error! Must use: if (str != null && str.Length > 0)
// if (1) {}        // Compile error! Must use: if (x != 0)
```

    a = True, type: System.Boolean
    b = False, type: System.Boolean
    Convert.ToInt32(true) = 1
    Convert.ToInt32(false) = 0
    


```C#
// byte arrays and encoding
byte[] b1 = new byte[] { 104, 101, 108, 108, 111 }; // "hello" in ASCII
Console.WriteLine($"b1 = [{string.Join(", ", b1)}], type: {b1.GetType()}");
Console.WriteLine($"As string: {System.Text.Encoding.UTF8.GetString(b1)}");

// Encoding/decoding
string text = "café";
byte[] encoded = System.Text.Encoding.UTF8.GetBytes(text);
string decoded = System.Text.Encoding.UTF8.GetString(encoded);
Console.WriteLine($"\n'{text}' encoded: [{string.Join(", ", encoded)}]");
Console.WriteLine($"decoded back: {decoded}");
```

    b1 = [104, 101, 108, 108, 111], type: System.Byte[]
    As string: hello
    
    'café' encoded: [99, 97, 102, 195, 169]
    decoded back: café
    


```C#
// null - C#'s null reference
string s = null;           // reference types can be null
Console.WriteLine($"s is null: {s == null}");
Console.WriteLine($"s is null: {s is null}");  // pattern matching (preferred)

// Value types (int, double, bool) CANNOT be null by default
// int x = null;  // Compile error!

// Nullable value types - use ? suffix
int? x = null;              // nullable int
double? y = null;           // nullable double
Console.WriteLine($"\nx = {x}, hasValue: {x.HasValue}");
x = 42;
Console.WriteLine($"x = {x}, hasValue: {x.HasValue}, value: {x.Value}");

// Null-coalescing operator ??
string name = null;
Console.WriteLine($"name ?? default: {name ?? "Unknown"}");

// Null-conditional operator ?.
Console.WriteLine($"name?.Length: {name?.Length}");  // null, not exception
```

    s is null: True
    s is null: True
    
    x = , hasValue: False
    x = 42, hasValue: True, value: 42
    name ?? default: Unknown
    name?.Length: 
    


```C#
// Complete Data Type Overview
// C# has a strict VALUE vs REFERENCE type distinction.
//
// STACK: Fast, small, auto-managed memory. Each method call gets a stack frame.
//        When the method returns, its stack frame is discarded. No garbage collector needed.
//        Value types live here (int, bool, struct, etc.)
//
// HEAP:  Large, shared memory pool managed by the Garbage Collector (GC).
//        Objects persist until no references point to them, then GC reclaims the memory.
//        Reference types live here (class, string, List, array, etc.)
//        A variable on the stack holds a POINTER to the heap object.
//
//   Stack (fast, scoped)         Heap (large, GC-managed)
//   ┌──────────────┐            ┌──────────────────────┐
//   │ int x = 42   │            │                      │
//   │ bool b = true│            │  ┌────────────────┐  │
//   │ listA ───────┼──────────► │  │ List: [1,2,3]  │  │
//   │ listB ───────┼──────────► │  └────────────────┘  │
//   └──────────────┘            └──────────────────────┘

Console.WriteLine(new string('=', 60));
Console.WriteLine("COMPLETE C# DATA TYPES");
Console.WriteLine(new string('=', 60));

// === VALUE TYPES (stored on stack, copied on assignment) ===
Console.WriteLine("\n=== VALUE TYPES (stack, copied on assignment) ===");

// Integer types
sbyte   sb = -128;        Console.WriteLine($"sbyte:    {sb,20}  ({sizeof(sbyte)} byte,  signed)     Py: int");
byte    by = 255;         Console.WriteLine($"byte:     {by,20}  ({sizeof(byte)} byte,  unsigned)   Py: int");
short   sh = -32768;      Console.WriteLine($"short:    {sh,20}  ({sizeof(short)} bytes, signed)     Py: int");
ushort  us = 65535;        Console.WriteLine($"ushort:   {us,20}  ({sizeof(ushort)} bytes, unsigned)   Py: int");
int     i  = -2147483648;  Console.WriteLine($"int:      {i,20}  ({sizeof(int)} bytes, signed)     Py: int");
uint    ui = 4294967295;   Console.WriteLine($"uint:     {ui,20}  ({sizeof(uint)} bytes, unsigned)   Py: int");
long    l  = -9223372036854775808; Console.WriteLine($"long:     {l,20}  ({sizeof(long)} bytes, signed)     Py: int");
ulong   ul = 18446744073709551615; Console.WriteLine($"ulong:    {ul,20}  ({sizeof(ulong)} bytes, unsigned)   Py: int");
nint    ni = -42;          Console.WriteLine($"nint:     {ni,20}  (native, signed)     Py: int");
nuint   nui = 42;          Console.WriteLine($"nuint:    {nui,20}  (native, unsigned)   Py: int");

// Floating-point types
float   fl = 3.14f;       Console.WriteLine($"float:    {fl,20}  ({sizeof(float)} bytes, ~6-9 dig)   Py: N/A (no 32-bit float)");
double  db = 3.14159265;  Console.WriteLine($"double:   {db,20}  ({sizeof(double)} bytes, ~15-17 dig) Py: float");
decimal dc = 3.14m;       Console.WriteLine($"decimal:  {dc,20}  ({sizeof(decimal)} bytes, 28-29 dig)  Py: Decimal");

// Other value types
bool    bo = true;         Console.WriteLine($"bool:     {bo,20}  ({sizeof(bool)} byte)              Py: bool");
char    ch = 'A';          Console.WriteLine($"char:     {ch,20}  ({sizeof(char)} bytes, Unicode)    Py: str (len 1)");

// Struct (user-defined value type)
Console.WriteLine($"struct:   {"(user-defined)",20}  (value type)         Py: N/A");

// Enum
Console.WriteLine($"enum:     {"(user-defined)",20}  (value type)         Py: Enum");

// Tuple (ValueTuple — value type)
var vt = (x: 3, y: 4);    Console.WriteLine($"ValueTuple:{vt,19}  (value type)         Py: namedtuple");

// === REFERENCE TYPES (stored on heap, reference copied on assignment) ===
Console.WriteLine("\n=== REFERENCE TYPES (heap, reference copied on assignment) ===");

// String — immutable (special: reference type but behaves like value)
string  str1 = "hello";   Console.WriteLine($"string:   {str1,20}  (immutable ref type) Py: str");

// Object — base of everything
object  obj = 42;          Console.WriteLine($"object:   {obj,20}  (base of all types)  Py: object");

// Dynamic — like Python's duck typing
dynamic dy = "hello";     Console.WriteLine($"dynamic:  {dy,20}  (runtime typed)      Py: (default behavior)");

// Array — fixed size
int[] arr = {1, 2, 3};    Console.WriteLine($"int[]:    {string.Join(",", arr),20}  (fixed size)         Py: N/A (array.array)");

// List<T> — dynamic size
var lst = new List<int>{1,2,3}; Console.WriteLine($"List<T>:  {string.Join(",", lst),20}  (dynamic size)       Py: list");

// Dictionary<K,V>
var dict = new Dictionary<string,int>{{"a",1}}; Console.WriteLine($"Dict<K,V>:{"a:1",20}  (key-value)          Py: dict");

// HashSet<T>
var hs = new HashSet<int>{1,2,3}; Console.WriteLine($"HashSet:  {string.Join(",", hs),20}  (unique elements)    Py: set");

// Queue<T> and Stack<T>
var q = new Queue<int>();  Console.WriteLine($"Queue<T>: {"(FIFO)",20}  (first in first out) Py: deque");
var sk = new Stack<int>(); Console.WriteLine($"Stack<T>: {"(LIFO)",20}  (last in first out)  Py: list (as stack)");

// LinkedList<T>
var ll = new LinkedList<int>(); Console.WriteLine($"LinkedList:{"(doubly linked)",19}                     Py: deque");

// SortedSet, SortedDictionary, SortedList
Console.WriteLine($"SortedSet:{"(sorted unique)",20}                     Py: N/A (sorted())");
Console.WriteLine($"SortedDict:{"(sorted k-v)",19}                     Py: N/A");

// Nullable<T> — value type that can be null
int? nullable = null;      Console.WriteLine($"int?:     {nullable?.ToString() ?? "null",20}  (nullable value)     Py: None");

// Tuple (reference type — System.Tuple, older)
Console.WriteLine($"Tuple:    {"(ref type, legacy)",20}  (prefer ValueTuple)  Py: tuple");

// Class, Interface, Delegate, Record
Console.WriteLine($"class:    {"(user-defined)",20}  (reference type)     Py: class");
Console.WriteLine($"interface:{"(contract)",20}  (reference type)     Py: ABC");
Console.WriteLine($"delegate: {"(function ptr)",20}  (reference type)     Py: callable");
Console.WriteLine($"record:   {"(immutable class)",20}  (ref or value)       Py: @dataclass(frozen)");
```

    ============================================================
    COMPLETE C# DATA TYPES
    ============================================================
    
    === VALUE TYPES (stack, copied on assignment) ===
    sbyte:                    -128  (1 byte,  signed)     Py: int
    byte:                      255  (1 byte,  unsigned)   Py: int
    short:                  -32768  (2 bytes, signed)     Py: int
    ushort:                  65535  (2 bytes, unsigned)   Py: int
    int:               -2147483648  (4 bytes, signed)     Py: int
    uint:               4294967295  (4 bytes, unsigned)   Py: int
    long:     -9223372036854775808  (8 bytes, signed)     Py: int
    ulong:    18446744073709551615  (8 bytes, unsigned)   Py: int
    nint:                      -42  (native, signed)     Py: int
    nuint:                      42  (native, unsigned)   Py: int
    float:                    3.14  (4 bytes, ~6-9 dig)   Py: N/A (no 32-bit float)
    double:             3.14159265  (8 bytes, ~15-17 dig) Py: float
    decimal:                  3.14  (16 bytes, 28-29 dig)  Py: Decimal
    bool:                     True  (1 byte)              Py: bool
    char:                        A  (2 bytes, Unicode)    Py: str (len 1)
    struct:         (user-defined)  (value type)         Py: N/A
    enum:           (user-defined)  (value type)         Py: Enum
    ValueTuple:             (3, 4)  (value type)         Py: namedtuple
    
    === REFERENCE TYPES (heap, reference copied on assignment) ===
    string:                  hello  (immutable ref type) Py: str
    object:                     42  (base of all types)  Py: object
    dynamic:                 hello  (runtime typed)      Py: (default behavior)
    int[]:                   1,2,3  (fixed size)         Py: N/A (array.array)
    List<T>:                 1,2,3  (dynamic size)       Py: list
    Dict<K,V>:                 a:1  (key-value)          Py: dict
    HashSet:                 1,2,3  (unique elements)    Py: set
    Queue<T>:               (FIFO)  (first in first out) Py: deque
    Stack<T>:               (LIFO)  (last in first out)  Py: list (as stack)
    LinkedList:    (doubly linked)                     Py: deque
    SortedSet:     (sorted unique)                     Py: N/A (sorted())
    SortedDict:       (sorted k-v)                     Py: N/A
    int?:                     null  (nullable value)     Py: None
    Tuple:      (ref type, legacy)  (prefer ValueTuple)  Py: tuple
    class:          (user-defined)  (reference type)     Py: class
    interface:          (contract)  (reference type)     Py: ABC
    delegate:       (function ptr)  (reference type)     Py: callable
    record:      (immutable class)  (ref or value)       Py: @dataclass(frozen)
    


```C#
// Why Value vs Reference types matter

Console.WriteLine("=== Value Type: assignment COPIES the value ===");
int a = 42;
int b = a;       // b gets a COPY
a = 100;
Console.WriteLine($"a = {a}, b = {b}");   // a=100, b=42 — independent!

Console.WriteLine("\n=== Reference Type: assignment copies the REFERENCE ===");
var listA = new List<int> { 1, 2, 3 };
var listB = listA;     // listB points to SAME object
listA.Add(4);
Console.WriteLine($"listA = [{string.Join(",", listA)}]");  // 1,2,3,4
Console.WriteLine($"listB = [{string.Join(",", listB)}]");  // 1,2,3,4 — same!
Console.WriteLine($"Same object? {object.ReferenceEquals(listA, listB)}");  // True

Console.WriteLine("\n=== String: reference type but BEHAVES like value ===");
string strA = "hello";
string strB = strA;
strA += " world";    // creates a NEW string, doesn't modify original
Console.WriteLine($"strA = '{strA}'");  // hello world
Console.WriteLine($"strB = '{strB}'");  // hello — unchanged!

Console.WriteLine("\n=== Boxing: value type → object (heap allocation) ===");
int val = 42;
object boxed = val;    // boxing: int copied to heap
int unboxed = (int)boxed;  // unboxing: copied back to stack
Console.WriteLine($"val={val}, boxed={boxed}, unboxed={unboxed}");

Console.WriteLine("\n=== Summary ===");
Console.WriteLine("Value types:     int, float, double, decimal, bool, char, struct, enum, ValueTuple");
Console.WriteLine("Reference types: string, object, class, array, List, Dict, delegate, interface, record");
Console.WriteLine("Special:         string is reference but immutable (acts like value)");
Console.WriteLine("                 Nullable<T> (int?) wraps value types to allow null");
```

    === Value Type: assignment COPIES the value ===
    a = 100, b = 42
    
    === Reference Type: assignment copies the REFERENCE ===
    listA = [1,2,3,4]
    listB = [1,2,3,4]
    Same object? True
    
    === String: reference type but BEHAVES like value ===
    strA = 'hello world'
    strB = 'hello'
    
    === Boxing: value type → object (heap allocation) ===
    val=42, boxed=42, unboxed=42
    
    === Summary ===
    Value types:     int, float, double, decimal, bool, char, struct, enum, ValueTuple
    Reference types: string, object, class, array, List, Dict, delegate, interface, record
    Special:         string is reference but immutable (acts like value)
                     Nullable<T> (int?) wraps value types to allow null
    

## 4. Date & Time

> **Moved to [10_DateTimeMathUtils_cs.ipynb](10_DateTimeMathUtils_cs.ipynb)** — Date/time creation, parsing, formatting, timezones, and arithmetic.

## 5. Operators


```C#
// Arithmetic operators
int a = 17, b = 5;

Console.WriteLine("=== Arithmetic Operators ===");
Console.WriteLine($"{a} + {b}  = {a + b}");       // Addition
Console.WriteLine($"{a} - {b}  = {a - b}");       // Subtraction
Console.WriteLine($"{a} * {b}  = {a * b}");       // Multiplication
Console.WriteLine($"{a} / {b}  = {a / b}");       // Integer division (int/int = int!)
Console.WriteLine($"{a} % {b}  = {a % b}");       // Modulus (remainder)
Console.WriteLine($"-{a}       = {-a}");           // Unary negation

// No ** operator in C# — use Math.Pow()
Console.WriteLine($"{a} ^ {b}  = {Math.Pow(a, b)}");  // Exponentiation (returns double)

// Division behavior — depends on operand types!
Console.WriteLine("\n=== Division Behavior ===");
Console.WriteLine($"17 / 5     = {17 / 5}");           // 3 (integer division, truncates)
Console.WriteLine($"17.0 / 5   = {17.0 / 5}");         // 3.4 (double division)
Console.WriteLine($"17 / 5.0   = {17 / 5.0}");         // 3.4 (one double forces double division)
Console.WriteLine($"(double)17/5 = {(double)17 / 5}");  // 3.4 (explicit cast)
Console.WriteLine($"-7 / 2     = {-7 / 2}");            // -3 (truncates toward zero, NOT floor!)
Console.WriteLine($"-7 % 2     = {-7 % 2}");            // -1 (C# modulo keeps sign of dividend)

// No // floor division operator — use Math.Floor
Console.WriteLine($"Math.Floor(-7.0/2) = {Math.Floor(-7.0 / 2)}");  // -4
```

    === Arithmetic Operators ===
    17 + 5  = 22
    17 - 5  = 12
    17 * 5  = 85
    17 / 5  = 3
    17 % 5  = 2
    -17       = -17
    17 ^ 5  = 1419857
    
    === Division Behavior ===
    17 / 5     = 3
    17.0 / 5   = 3.4
    17 / 5.0   = 3.4
    (double)17/5 = 3.4
    -7 / 2     = -3
    -7 % 2     = -1
    Math.Floor(-7.0/2) = -4
    


```C#
// Comparison operators
int a = 10, b = 20;

Console.WriteLine("=== Comparison Operators ===");
Console.WriteLine($"{a} == {b}  : {a == b}");     // Equal
Console.WriteLine($"{a} != {b}  : {a != b}");     // Not equal
Console.WriteLine($"{a} > {b}   : {a > b}");      // Greater than
Console.WriteLine($"{a} < {b}   : {a < b}");      // Less than
Console.WriteLine($"{a} >= {b}  : {a >= b}");     // Greater than or equal
Console.WriteLine($"{a} <= {b}  : {a <= b}");     // Less than or equal

// No chained comparisons — must use && explicitly
int x = 15;
Console.WriteLine($"\n=== No Chained Comparisons (use && instead) ===");
Console.WriteLine($"10 < {x} && {x} < 20 : {10 < x && x < 20}");

// Reference equality (like Python's 'is')
Console.WriteLine("\n=== Reference Equality ===");
var list1 = new List<int> { 1, 2, 3 };
var list2 = new List<int> { 1, 2, 3 };
var list3 = list1;
Console.WriteLine($"list1.SequenceEqual(list2)          : {list1.SequenceEqual(list2)}");  // True (same values)
Console.WriteLine($"object.ReferenceEquals(list1, list2) : {object.ReferenceEquals(list1, list2)}");  // False (different objects)
Console.WriteLine($"object.ReferenceEquals(list1, list3) : {object.ReferenceEquals(list1, list3)}");  // True (same object)
Console.WriteLine($"list1 == list2                       : {list1 == list2}");  // False! == checks reference for List

// Membership — no 'in' keyword, use .Contains()
Console.WriteLine("\n=== Membership (.Contains()) ===");
var fruits = new List<string> { "apple", "banana", "cherry" };
Console.WriteLine($"fruits.Contains(\"banana\")     : {fruits.Contains("banana")}");
Console.WriteLine($"!fruits.Contains(\"grape\")     : {!fruits.Contains("grape")}");
Console.WriteLine($"\"banana\".Contains(\"an\")       : {"banana".Contains("an")}");
// LINQ Any() for complex checks
Console.WriteLine($"fruits.Any(f => f.Length > 5) : {fruits.Any(f => f.Length > 5)}");
```

    === Comparison Operators ===
    10 == 20  : False
    10 != 20  : True
    10 > 20   : False
    10 < 20   : True
    10 >= 20  : False
    10 <= 20  : True
    
    === No Chained Comparisons (use && instead) ===
    10 < 15 && 15 < 20 : True
    
    === Reference Equality ===
    list1.SequenceEqual(list2)          : True
    object.ReferenceEquals(list1, list2) : False
    object.ReferenceEquals(list1, list3) : True
    list1 == list2                       : False
    
    === Membership (.Contains()) ===
    fruits.Contains("banana")     : True
    !fruits.Contains("grape")     : True
    "banana".Contains("an")       : True
    fruits.Any(f => f.Length > 5) : True
    


```C#
#nullable enable
// Logical operators
Console.WriteLine("=== Logical Operators ===");
Console.WriteLine($"true && false  : {true && false}");    // False (AND)
Console.WriteLine($"true || false  : {true || false}");    // True (OR)
Console.WriteLine($"!true          : {!true}");            // False (NOT)

// && and || are short-circuit; & and | evaluate both sides
Console.WriteLine("\n=== Short-Circuit vs Full Evaluation ===");
Console.WriteLine("&&  short-circuits: false && Foo() → Foo() never called");
Console.WriteLine("&   evaluates both: false & Foo()  → Foo() IS called");
Console.WriteLine("||  short-circuits: true || Foo()  → Foo() never called");
Console.WriteLine("|   evaluates both: true | Foo()   → Foo() IS called");

// No truthy/falsy! C# requires explicit bool
Console.WriteLine("\n=== No Truthy/Falsy in C# ===");
Console.WriteLine("Python: if 0, if '', if [], if None → all falsy");
Console.WriteLine("C#: ONLY bool works in conditions. Must be explicit:");
Console.WriteLine("  if (list.Count > 0)   // not: if (list)");
Console.WriteLine("  if (str.Length > 0)    // not: if (str)");
Console.WriteLine("  if (x != 0)           // not: if (x)");
Console.WriteLine("  if (obj != null)       // not: if (obj)");

// Null-coalescing — C#'s version of Python's 'or' for defaults
Console.WriteLine("\n=== Null-Coalescing Operator ?? ===");
string? name = null;
Console.WriteLine($"name ?? \"default\"     : {name ?? "default"}");
name = "Alice";
Console.WriteLine($"name ?? \"default\"     : {name ?? "default"}");

// Null-coalescing assignment
string? val = null;
val ??= "fallback";   // assign only if null
Console.WriteLine($"val ??= \"fallback\"    : {val}");
```

    === Logical Operators ===
    true && false  : False
    true || false  : True
    !true          : False
    
    === Short-Circuit vs Full Evaluation ===
    &&  short-circuits: false && Foo() → Foo() never called
    &   evaluates both: false & Foo()  → Foo() IS called
    ||  short-circuits: true || Foo()  → Foo() never called
    |   evaluates both: true | Foo()   → Foo() IS called
    
    === No Truthy/Falsy in C# ===
    Python: if 0, if '', if [], if None → all falsy
    C#: ONLY bool works in conditions. Must be explicit:
      if (list.Count > 0)   // not: if (list)
      if (str.Length > 0)    // not: if (str)
      if (x != 0)           // not: if (x)
      if (obj != null)       // not: if (obj)
    
    === Null-Coalescing Operator ?? ===
    name ?? "default"     : default
    name ?? "default"     : Alice
    val ??= "fallback"    : fallback
    


```C#
// Bitwise operators
int a = 0b1100, b = 0b1010;  // 12 and 10

Console.WriteLine("=== Bitwise Operators ===");
Console.WriteLine($"a = {Convert.ToString(a, 2).PadLeft(4, '0')} ({a}),  b = {Convert.ToString(b, 2).PadLeft(4, '0')} ({b})");
Console.WriteLine($"a & b  (AND)  = {Convert.ToString(a & b, 2).PadLeft(4, '0')} ({a & b})");
Console.WriteLine($"a | b  (OR)   = {Convert.ToString(a | b, 2).PadLeft(4, '0')} ({a | b})");
Console.WriteLine($"a ^ b  (XOR)  = {Convert.ToString(a ^ b, 2).PadLeft(4, '0')} ({a ^ b})");
Console.WriteLine($"~a     (NOT)  = {~a} (inverts all bits)");
Console.WriteLine($"a << 2 (LEFT) = {Convert.ToString(a << 2, 2).PadLeft(8, '0')} ({a << 2})");
Console.WriteLine($"a >> 1 (RIGHT)= {Convert.ToString(a >> 1, 2).PadLeft(4, '0')} ({a >> 1})");
// >>> unsigned right shift (C# 11+)
Console.WriteLine($"a >>> 1 (UNSIGNED RIGHT) = {a >>> 1}");

// Common use cases for bitwise operators
Console.WriteLine("\n=== Bitwise Use Cases ===");
// Flags using plain int constants (enum in next cell)
int READ = 0b100, WRITE = 0b010, EXECUTE = 0b001;
int perms = READ | WRITE;
Console.WriteLine($"Permissions: {Convert.ToString(perms, 2).PadLeft(3, '0')}");
Console.WriteLine($"Can read?    {(perms & READ) != 0}");
Console.WriteLine($"Can execute? {(perms & EXECUTE) != 0}");
perms |= EXECUTE;
Console.WriteLine($"After +exec: {Convert.ToString(perms, 2).PadLeft(3, '0')}");
perms &= ~WRITE;
Console.WriteLine($"After -write:{Convert.ToString(perms, 2).PadLeft(3, '0')}");

// Check even/odd
int n = 42;
Console.WriteLine($"\n{n} is {((n & 1) == 0 ? "even" : "odd")}");

// Swap without temp
int x = 5, y = 10;
x ^= y; y ^= x; x ^= y;
Console.WriteLine($"Swapped: x={x}, y={y}");
```

    === Bitwise Operators ===
    a = 1100 (12),  b = 1010 (10)
    a & b  (AND)  = 1000 (8)
    a | b  (OR)   = 1110 (14)
    a ^ b  (XOR)  = 0110 (6)
    ~a     (NOT)  = -13 (inverts all bits)
    a << 2 (LEFT) = 00110000 (48)
    a >> 1 (RIGHT)= 0110 (6)
    a >>> 1 (UNSIGNED RIGHT) = 6
    
    === Bitwise Use Cases ===
    Permissions: 110
    Can read?    True
    Can execute? False
    After +exec: 111
    After -write:101
    
    42 is even
    Swapped: x=10, y=5
    


```C#
// [Flags] enum definition — must be alone (no top-level code in same cell)
// Values MUST be powers of 2 (1, 2, 4, 8...) so each has a unique bit:
//   None    = 0b000 (0)  — no bits set
//   Execute = 0b001 (1)  — bit 0
//   Write   = 0b010 (2)  — bit 1
//   Read    = 0b100 (4)  — bit 2
// This way they can be combined without overlap:
//   Read | Write = 0b110 (6) — both bits distinguishable
// Sequential values (1,2,3) would break: 1+2=3 is ambiguous with a value of 3

[Flags]
enum Perms { None = 0, Read = 0b100, Write = 0b010, Execute = 0b001 }
```


```C#
// Using [Flags] enum for bitwise flags
var perms = Perms.Read | Perms.Write;
Console.WriteLine($"Permissions: {perms}");                        // Read, Write
Console.WriteLine($"Can read?    {perms.HasFlag(Perms.Read)}");    // True
Console.WriteLine($"Can execute? {perms.HasFlag(Perms.Execute)}"); // False
perms |= Perms.Execute;
Console.WriteLine($"After +exec: {perms}");                        // Read, Write, Execute
perms &= ~Perms.Write;
Console.WriteLine($"After -write:{perms}");                        // Read, Execute
```

    Permissions: Write, Read
    Can read?    True
    Can execute? False
    After +exec: Execute, Write, Read
    After -write:Execute, Read
    


```C#
#nullable enable

// Assignment operators (compound)
int x;
x = 10;  Console.WriteLine($"x = 10       → {x}");
x += 5;  Console.WriteLine($"x += 5       → {x}");
x -= 3;  Console.WriteLine($"x -= 3       → {x}");
x *= 2;  Console.WriteLine($"x *= 2       → {x}");
x /= 4;  Console.WriteLine($"x /= 4       → {x}");   // integer division (int/int)
x = 10;
x %= 3;  Console.WriteLine($"x %= 3       → {x}");

// Compound bitwise assignment operators
x = 0b1100;
x &= 0b1010; Console.WriteLine($"x &= 0b1010  → {Convert.ToString(x, 2).PadLeft(4, '0')}");  // x = x & y — keep only shared bits (mask/filter)
x = 0b1100;
x |= 0b1010; Console.WriteLine($"x |= 0b1010  → {Convert.ToString(x, 2).PadLeft(4, '0')}");  // x = x | y — add/set bits (set flags)
x = 0b1100;
x ^= 0b1010; Console.WriteLine($"x ^= 0b1010  → {Convert.ToString(x, 2).PadLeft(4, '0')}");  // x = x ^ y — toggle bits (flip flags)
x = 8;
x >>= 2; Console.WriteLine($"x >>= 2      → {x}");   // x = x >> y — right shift
x <<= 3; Console.WriteLine($"x <<= 3      → {x}");   // x = x << y — left shift

// No **= (use Math.Pow), no //= (no floor division operator)

// Common flag pattern with |= and &=
Console.WriteLine("\n=== Flag Pattern: |= to add, &= ~ to remove ===");
int READ = 0b100, WRITE = 0b010, EXECUTE = 0b001;
int perms = READ;
Console.WriteLine($"Start:           {Convert.ToString(perms, 2).PadLeft(3, '0')}");
perms |= WRITE;
Console.WriteLine($"perms |= WRITE:  {Convert.ToString(perms, 2).PadLeft(3, '0')}  (|= adds a flag)");
perms |= EXECUTE;
Console.WriteLine($"perms |= EXEC:   {Convert.ToString(perms, 2).PadLeft(3, '0')}  (|= adds a flag)");
perms &= ~WRITE;
Console.WriteLine($"perms &= ~WRITE: {Convert.ToString(perms, 2).PadLeft(3, '0')}  (&= ~ removes a flag)");

// Increment / Decrement (C# only, not in Python)
Console.WriteLine("\n=== Increment/Decrement (C# only!) ===");
x = 10;
Console.WriteLine($"x = {x}");
Console.WriteLine($"x++ (post): {x++}, then x = {x}");   // returns 10, then x becomes 11
Console.WriteLine($"++x (pre):  {++x}, and x = {x}");    // x becomes 12, returns 12
Console.WriteLine($"x-- (post): {x--}, then x = {x}");   // returns 12, then x becomes 11
Console.WriteLine($"--x (pre):  {--x}, and x = {x}");    // x becomes 10, returns 10

// Ternary operator
Console.WriteLine("\n=== Ternary Operator ===");
int age = 20;
string status = age >= 18 ? "adult" : "minor";
Console.WriteLine($"age={age} → {status}");

// Null-conditional operators (C# only)
Console.WriteLine("\n=== Null-Conditional Operators ?. and ?[] ===");
string? name = null;
Console.WriteLine($"name?.Length      : {name?.Length}");          // null (no exception!)
Console.WriteLine($"name?.ToUpper()   : {name?.ToUpper()}");      // null
name = "Alice";
Console.WriteLine($"name?.Length      : {name?.Length}");          // 5
Console.WriteLine($"name?.ToUpper()   : {name?.ToUpper()}");      // ALICE

int[]? arr = null;
Console.WriteLine($"arr?[0]           : {arr?[0]}");              // null
arr = new[] { 10, 20, 30 };
Console.WriteLine($"arr?[0]           : {arr?[0]}");              // 10
```

    x = 10       → 10
    x += 5       → 15
    x -= 3       → 12
    x *= 2       → 24
    x /= 4       → 6
    x %= 3       → 1
    x &= 0b1010  → 1000
    x |= 0b1010  → 1110
    x ^= 0b1010  → 0110
    x >>= 2      → 2
    x <<= 3      → 16
    
    === Flag Pattern: |= to add, &= ~ to remove ===
    Start:           100
    perms |= WRITE:  110  (|= adds a flag)
    perms |= EXEC:   111  (|= adds a flag)
    perms &= ~WRITE: 101  (&= ~ removes a flag)
    
    === Increment/Decrement (C# only!) ===
    x = 10
    x++ (post): 10, then x = 11
    ++x (pre):  12, and x = 12
    x-- (post): 12, then x = 11
    --x (pre):  10, and x = 10
    
    === Ternary Operator ===
    age=20 → adult
    
    === Null-Conditional Operators ?. and ?[] ===
    name?.Length      : 
    name?.ToUpper()   : 
    name?.Length      : 5
    name?.ToUpper()   : ALICE
    arr?[0]           : 
    arr?[0]           : 10
    


```C#
// Operator precedence
Console.WriteLine("=== Operator Precedence (highest to lowest) ===");
var precedence = @"
  1.  x.y, x?.y, f(), a[], x++, x--    Member access, invocation, index, postfix
  2.  +x, -x, !x, ~x, ++x, --x        Unary
  3.  x * y, x / y, x % y              Multiplicative
  4.  x + y, x - y                     Additive
  5.  x << y, x >> y, x >>> y          Shift
  6.  x < y, x > y, x <= y, x >= y    Relational, type testing (is, as)
  7.  x == y, x != y                   Equality
  8.  x & y                            Bitwise AND / logical AND
  9.  x ^ y                            Bitwise XOR / logical XOR
 10.  x | y                            Bitwise OR / logical OR
 11.  x && y                           Conditional AND (short-circuit)
 12.  x || y                           Conditional OR (short-circuit)
 13.  x ?? y                           Null-coalescing
 14.  c ? t : f                        Ternary conditional
 15.  x = y, x += y, x ??= y, etc.    Assignment
";
Console.WriteLine(precedence);

// Precedence gotchas
Console.WriteLine("=== Precedence Gotchas ===");
Console.WriteLine($"2 + 3 * 4     = {2 + 3 * 4}");       // 14
Console.WriteLine($"(2 + 3) * 4   = {(2 + 3) * 4}");     // 20
// No ** operator so no -2**2 gotcha
Console.WriteLine($"1 + 2 << 3    = {1 + 2 << 3}");       // 24 (+ before <<)
Console.WriteLine($"1 + (2 << 3)  = {1 + (2 << 3)}");     // 17

// Key differences from Python:
Console.WriteLine("\n=== Key Differences from Python ===");
Console.WriteLine("Python: and/or/not        C#: &&/||/!");
Console.WriteLine("Python: **                C#: Math.Pow()");
Console.WriteLine("Python: //                C#: Math.Floor(a/b)");
Console.WriteLine("Python: x if cond else y  C#: cond ? x : y");
Console.WriteLine("Python: :=                C#: (no equivalent)");
Console.WriteLine("Python: in / not in       C#: .Contains()");
Console.WriteLine("Python: is / is not       C#: ReferenceEquals() / ==");
Console.WriteLine("C# only: ++, --, ?., ??, ??=, >>>, switch expr");
```

    === Operator Precedence (highest to lowest) ===
    
      1.  x.y, x?.y, f(), a[], x++, x--    Member access, invocation, index, postfix
      2.  +x, -x, !x, ~x, ++x, --x        Unary
      3.  x * y, x / y, x % y              Multiplicative
      4.  x + y, x - y                     Additive
      5.  x << y, x >> y, x >>> y          Shift
      6.  x < y, x > y, x <= y, x >= y    Relational, type testing (is, as)
      7.  x == y, x != y                   Equality
      8.  x & y                            Bitwise AND / logical AND
      9.  x ^ y                            Bitwise XOR / logical XOR
     10.  x | y                            Bitwise OR / logical OR
     11.  x && y                           Conditional AND (short-circuit)
     12.  x || y                           Conditional OR (short-circuit)
     13.  x ?? y                           Null-coalescing
     14.  c ? t : f                        Ternary conditional
     15.  x = y, x += y, x ??= y, etc.    Assignment
    
    === Precedence Gotchas ===
    2 + 3 * 4     = 14
    (2 + 3) * 4   = 20
    1 + 2 << 3    = 24
    1 + (2 << 3)  = 17
    
    === Key Differences from Python ===
    Python: and/or/not        C#: &&/||/!
    Python: **                C#: Math.Pow()
    Python: //                C#: Math.Floor(a/b)
    Python: x if cond else y  C#: cond ? x : y
    Python: :=                C#: (no equivalent)
    Python: in / not in       C#: .Contains()
    Python: is / is not       C#: ReferenceEquals() / ==
    C# only: ++, --, ?., ??, ??=, >>>, switch expr
    

## 7. Special Methods & Operator Overloading


```C#
// Special Methods & Operator Overloading — C# equivalents of Python's dunder methods
// Type declarations must be in their own cell (no top-level code)
#nullable enable

using System.Collections;

class Vector : IEnumerable<double>, IComparable<Vector>
{
    public double X { get; }
    public double Y { get; }

    // Constructor (Py: __init__)
    public Vector(double x, double y) { X = x; Y = y; }

    // ToString (Py: __str__ / __repr__)
    public override string ToString() => $"Vector({X}, {Y})";

    // Equals + GetHashCode (Py: __eq__ / __hash__)
    public override bool Equals(object? obj) =>
        obj is Vector v && X == v.X && Y == v.Y;
    public override int GetHashCode() => HashCode.Combine(X, Y);

    // Operator + (Py: __add__)
    public static Vector operator +(Vector a, Vector b) =>
        new Vector(a.X + b.X, a.Y + b.Y);

    // Operator - (Py: __sub__)
    public static Vector operator -(Vector a, Vector b) =>
        new Vector(a.X - b.X, a.Y - b.Y);

    // Operator * scalar (Py: __mul__)
    public static Vector operator *(Vector v, double s) =>
        new Vector(v.X * s, v.Y * s);

    // Unary - (Py: __neg__)
    public static Vector operator -(Vector v) =>
        new Vector(-v.X, -v.Y);

    // Operator == and != (Py: __eq__, must define both in C#)
    public static bool operator ==(Vector a, Vector b) => a.Equals(b);
    public static bool operator !=(Vector a, Vector b) => !a.Equals(b);

    // Operator < and > (Py: __lt__, __gt__, must define in pairs)
    public static bool operator <(Vector a, Vector b) => a.Magnitude < b.Magnitude;
    public static bool operator >(Vector a, Vector b) => a.Magnitude > b.Magnitude;

    // IComparable (Py: __lt__, enables sorting)
    public int CompareTo(Vector? other) =>
        other is null ? 1 : Magnitude.CompareTo(other.Magnitude);

    // Magnitude (Py: __abs__)
    public double Magnitude => Math.Sqrt(X * X + Y * Y);

    // Indexer (Py: __getitem__)
    public double this[int index] => index switch
    {
        0 => X,
        1 => Y,
        _ => throw new IndexOutOfRangeException()
    };

    // IEnumerable (Py: __iter__)
    public IEnumerator<double> GetEnumerator()
    {
        yield return X;
        yield return Y;
    }
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

    // Deconstruct — enables (var x, var y) = vector; syntax
    public void Deconstruct(out double x, out double y) { x = X; y = Y; }
}
```


```C#
// Demo — using the Vector class (run the previous cell first)
var v1 = new Vector(3, 4);
var v2 = new Vector(1, 2);

Console.WriteLine("=== String Representation ===");
Console.WriteLine($"ToString():   {v1}");                     // ToString()
Console.WriteLine($"Interpolated: {v1}");                     // also calls ToString()

Console.WriteLine("\n=== Arithmetic Operators ===");
Console.WriteLine($"v1 + v2:      {v1 + v2}");               // operator +
Console.WriteLine($"v1 - v2:      {v1 - v2}");               // operator -
Console.WriteLine($"v1 * 3:       {v1 * 3}");                // operator *
Console.WriteLine($"-v1:          {-v1}");                    // unary operator -
Console.WriteLine($"v1.Magnitude: {v1.Magnitude}");          // property (Py: abs())

Console.WriteLine("\n=== Comparison & Equality ===");
Console.WriteLine($"v1 == v2:           {v1 == v2}");        // operator ==
Console.WriteLine($"v1 == Vector(3,4):  {v1 == new Vector(3, 4)}");
Console.WriteLine($"v1 != v2:           {v1 != v2}");        // operator !=
Console.WriteLine($"v1 < v2:            {v1 < v2}");         // operator < (magnitude)
Console.WriteLine($"v1 > v2:            {v1 > v2}");         // operator >
Console.WriteLine($"v1.GetHashCode():   {v1.GetHashCode()}");// GetHashCode()

Console.WriteLine("\n=== Indexer ===");
Console.WriteLine($"v1[0]:        {v1[0]}");                 // indexer this[int]
Console.WriteLine($"v1[1]:        {v1[1]}");

Console.WriteLine("\n=== IEnumerable (foreach) ===");
Console.Write("foreach:      ");
foreach (var val in v1) Console.Write($"{val} ");            // IEnumerable
Console.WriteLine();
Console.WriteLine($"ToList:       [{string.Join(", ", v1)}]");

Console.WriteLine("\n=== IComparable (sorting) ===");
var vectors = new List<Vector> { new(5, 0), new(1, 1), new(3, 4) };
vectors.Sort();                                               // uses CompareTo
Console.WriteLine($"Sorted:       [{string.Join(", ", vectors)}]");

Console.WriteLine("\n=== Implicit Conversion ===");
(double x, double y) = v1;                                   // implicit operator
Console.WriteLine($"Deconstructed: x={x}, y={y}");

Console.WriteLine("\n=== Key Differences from Python ===");
Console.WriteLine("Python: __call__     → C#: no equivalent (use delegates/Func)");
Console.WriteLine("Python: __bool__     → C#: no truthy/falsy, bool is strict");
Console.WriteLine("Python: __contains__ → C#: implement .Contains() method");
Console.WriteLine("Python: __len__      → C#: .Count or .Length property");
Console.WriteLine("Python: __repr__     → C#: no separate repr, just ToString()");
Console.WriteLine("C# requires pairs:   == must have !=, < must have >");
```

    === String Representation ===
    ToString():   Vector(3, 4)
    Interpolated: Vector(3, 4)
    
    === Arithmetic Operators ===
    v1 + v2:      Vector(4, 6)
    v1 - v2:      Vector(2, 2)
    v1 * 3:       Vector(9, 12)
    -v1:          Vector(-3, -4)
    v1.Magnitude: 5
    
    === Comparison & Equality ===
    v1 == v2:           False
    v1 == Vector(3,4):  True
    v1 != v2:           True
    v1 < v2:            False
    v1 > v2:            True
    v1.GetHashCode():   1257559065
    
    === Indexer ===
    v1[0]:        3
    v1[1]:        4
    
    === IEnumerable (foreach) ===
    foreach:      3 4 
    ToList:       [3, 4]
    
    === IComparable (sorting) ===
    Sorted:       [Vector(1, 1), Vector(5, 0), Vector(3, 4)]
    
    === Implicit Conversion ===
    Deconstructed: x=3, y=4
    
    === Key Differences from Python ===
    Python: __call__     → C#: no equivalent (use delegates/Func)
    Python: __bool__     → C#: no truthy/falsy, bool is strict
    Python: __contains__ → C#: implement .Contains() method
    Python: __len__      → C#: .Count or .Length property
    Python: __repr__     → C#: no separate repr, just ToString()
    C# requires pairs:   == must have !=, < must have >
    


```C#
// Reflection & Attributes — C# equivalent of Python's magic attributes
// Reflection lets you inspect types, members, and metadata at runtime
using System.Reflection;

// === Type inspection (Py: __class__, __name__, type()) ===
Console.WriteLine("=== Type Inspection ===");
var dog = new { Name = "Rex", Age = 5 };  // anonymous type for demo
Console.WriteLine($"GetType():        {dog.GetType()}");
Console.WriteLine($"GetType().Name:   {dog.GetType().Name}");
Console.WriteLine($"nameof():         {nameof(dog)}");          // compile-time name

int x = 42;
Console.WriteLine($"x.GetType():      {x.GetType()}");          // System.Int32
Console.WriteLine($"x.GetType().Name: {x.GetType().Name}");     // Int32

// === Type checking (Py: isinstance, issubclass) ===
Console.WriteLine("\n=== Type Checking ===");
object obj = "hello";
Console.WriteLine($"obj is string:    {obj is string}");         // True
Console.WriteLine($"obj is int:       {obj is int}");            // False
Console.WriteLine($"typeof(string):   {typeof(string)}");        // System.String
Console.WriteLine($"typeof(string).IsClass: {typeof(string).IsClass}");

// === Inheritance chain (Py: __bases__, __mro__) ===
Console.WriteLine("\n=== Inheritance Chain ===");
var type = typeof(List<int>);
Console.WriteLine($"Type:       {type.Name}");
Console.WriteLine($"BaseType:   {type.BaseType?.Name}");         // Object
Console.WriteLine($"Interfaces: {string.Join(", ", type.GetInterfaces().Select(i => i.Name))}");

// Walk up the chain (like Python's __mro__)
Console.Write("MRO:        ");
var current = type;
while (current != null)
{
    Console.Write($"{current.Name} → ");
    current = current.BaseType;
}
Console.WriteLine("null");

// === Members inspection (Py: __dict__, dir()) ===
Console.WriteLine("\n=== Members Inspection ===");
var strType = typeof(string);
Console.WriteLine($"Properties: {strType.GetProperties().Length}");
Console.WriteLine($"Methods:    {strType.GetMethods().Length}");
Console.WriteLine($"Fields:     {strType.GetFields().Length}");

// List first 5 methods
Console.WriteLine("\nFirst 5 string methods:");
foreach (var method in strType.GetMethods().Take(5))
    Console.WriteLine($"  {method.Name}({string.Join(", ", method.GetParameters().Select(p => p.ParameterType.Name))})");

// === Assembly info (Py: __file__, __module__) ===
Console.WriteLine("\n=== Assembly Info ===");
var asm = typeof(string).Assembly;
Console.WriteLine($"Assembly:    {asm.GetName().Name}");
Console.WriteLine($"Version:     {asm.GetName().Version}");
Console.WriteLine($"Location:    {asm.Location}");
Console.WriteLine($"Namespace:   {typeof(string).Namespace}");   // System
Console.WriteLine($"FullName:    {typeof(string).FullName}");    // System.String

// === Custom Attributes (Py: decorators like @property, @staticmethod) ===
Console.WriteLine("\n=== Built-in Attributes ===");
Console.WriteLine("[Obsolete]      → marks deprecated (Py: @deprecated)");
Console.WriteLine("[Serializable]  → can be serialized");
Console.WriteLine("[Flags]         → bitwise enum (we used this earlier)");
Console.WriteLine("[Required]      → property must be set");
Console.WriteLine("[MaxLength(50)] → validation constraint");
Console.WriteLine("[HttpGet]       → ASP.NET route attribute");

// Check if a type has an attribute
Console.WriteLine($"\nList<int> is serializable: {typeof(List<int>).GetCustomAttributes().Any(a => a is SerializableAttribute)}");

// === Key Differences from Python ===
Console.WriteLine("\n=== Key Differences ===");
Console.WriteLine("Python: magic attrs always available, lightweight, duck-typed");
Console.WriteLine("C#:     Reflection is heavier, requires System.Reflection import");
Console.WriteLine("Python: __doc__ available at runtime → C#: XML docs are compile-time only");
Console.WriteLine("Python: decorators (@) modify behavior → C#: [Attributes] add metadata");
Console.WriteLine("Python: dir(obj) lists everything → C#: GetMembers() via reflection");
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

    probeAddresses(["http://2a02:8308:718a:f200::655c:2049/","http://2a02:8308:718a:f200:8bd4:d06d:33ed:be05:2049/","http://2a02:8308:718a:f200:11f1:5c2e:7e82:d4f1:2049/","http://fe80::3212:d8da:d32d:4723%14:2049/","http://192.168.0.110:2049/","http://::1:2049/","http://127.0.0.1:2049/"])

        .then((root) => {

        // use probing to find host url and api resources

        // load interactive helpers and language services

        let dotnetInteractiveRequire = require.config({

        context: '24408.Microsoft.DotNet.Interactive.Http.HttpPort',

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


    === Type Inspection ===
    GetType():        <>f__AnonymousType0#1`2[System.String,System.Int32]
    GetType().Name:   <>f__AnonymousType0#1`2
    nameof():         dog
    x.GetType():      System.Int32
    x.GetType().Name: Int32
    
    === Type Checking ===
    obj is string:    True
    obj is int:       False
    typeof(string):   System.String
    typeof(string).IsClass: True
    
    === Inheritance Chain ===
    Type:       List`1
    BaseType:   Object
    Interfaces: IList`1, ICollection`1, IEnumerable`1, IEnumerable, IList, ICollection, IReadOnlyList`1, IReadOnlyCollection`1
    MRO:        List`1 → Object → null
    
    === Members Inspection ===
    Properties: 2
    Methods:    177
    Fields:     1
    
    First 5 string methods:
      Intern(String)
      IsInterned(String)
      Compare(String, String)
      Compare(String, String, Boolean)
      Compare(String, String, StringComparison)
    
    === Assembly Info ===
    Assembly:    System.Private.CoreLib
    Version:     10.0.0.0
    Location:    C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.4\System.Private.CoreLib.dll
    Namespace:   System
    FullName:    System.String
    
    === Built-in Attributes ===
    [Obsolete]      → marks deprecated (Py: @deprecated)
    [Serializable]  → can be serialized
    [Flags]         → bitwise enum (we used this earlier)
    [Required]      → property must be set
    [MaxLength(50)] → validation constraint
    [HttpGet]       → ASP.NET route attribute
    
    List<int> is serializable: True
    
    === Key Differences ===
    Python: magic attrs always available, lightweight, duck-typed
    C#:     Reflection is heavier, requires System.Reflection import
    Python: __doc__ available at runtime → C#: XML docs are compile-time only
    Python: decorators (@) modify behavior → C#: [Attributes] add metadata
    Python: dir(obj) lists everything → C#: GetMembers() via reflection
    

## 8. Value vs Reference Types & Mutability Reference


```C#
// Value vs Reference Types & Mutability — Complete Reference
//
// C# has TWO orthogonal distinctions:
//   1. VALUE vs REFERENCE type  — where it lives in memory (stack vs heap)
//   2. MUTABLE vs IMMUTABLE     — can it be changed after creation?
//
// These are INDEPENDENT — you can have all four combinations:
//   value + mutable:      struct (e.g. regular struct)
//   value + immutable:    readonly struct, record struct, int, bool, enum
//   reference + mutable:  class, List<T>, Dictionary<K,V>
//   reference + immutable: string, record, ImmutableList<T>
//
// Python comparison:
//   Python has NO value type concept — everything is a reference (object).
//   Python's mutable/immutable distinction maps roughly to C#'s, but without
//   the stack/heap dimension.
//
// ═══════════════════════════════════════════════════════════════
// VALUE TYPES (stored on stack, COPIED on assignment)
// ═══════════════════════════════════════════════════════════════
// Assignment creates an INDEPENDENT copy. Modifying the copy doesn't affect the original.
//
// Type              Example              Mutable?    Notes
// int, long, short  42                   Immutable   all numeric types
// float, double     3.14                 Immutable
// decimal           3.14m                Immutable   exact decimal
// bool              true                 Immutable
// char              'A'                  Immutable
// enum              Color.Red            Immutable
// ValueTuple        (1, "hi")            Mutable*    fields can be changed
// struct            new MyStruct()       Mutable*    unless readonly
// record struct     new Point(3, 4)      Immutable   value equality + immutable
//
// * struct/ValueTuple fields are technically mutable, but best practice is to keep them immutable.
//
// ═══════════════════════════════════════════════════════════════
// REFERENCE TYPES (stored on heap, REFERENCE copied on assignment)
// ═══════════════════════════════════════════════════════════════
// Assignment copies the POINTER — both variables point to the SAME object.
// Modifying through one variable affects all references.
//
// Type              Example                    Mutable?    Notes
// string            "hello"                    Immutable   special: ref type but acts like value
// record            record Person(...)         Immutable   value equality (use 'with' to copy+modify)
// class             new MyClass()              Mutable     default OOP type
// object            new object()               Mutable
// dynamic           dynamic x = ...            Mutable     runtime-typed
// int[]             new int[5]                 Mutable     elements changeable, size fixed
// List<T>           new List<int>()            Mutable     dynamic array
// Dictionary<K,V>   new Dictionary<...>()      Mutable     key-value mapping
// HashSet<T>        new HashSet<int>()         Mutable     unique elements
// Queue<T>          new Queue<int>()           Mutable     FIFO
// Stack<T>          new Stack<int>()           Mutable     LIFO
// delegate          Func<int,int>              Immutable   function reference
//
// ═══════════════════════════════════════════════════════════════
// WHY IT MATTERS
// ═══════════════════════════════════════════════════════════════
//
// 1. Assignment behavior:
//      value type:     int a = 10; int b = a; b = 99;     → a is still 10 (independent copy)
//      reference type: var a = new List<int>{1}; var b = a; b.Add(2); → a is [1,2] (same object!)
//      string (special): string a = "hi"; string b = a; a += "!"; → b is still "hi" (immutable ref)
//
// 2. Equality:
//      value type:     compares VALUES by default (10 == 10)
//      reference type: compares REFERENCES by default (are they the same object?)
//      string/record:  overrides == to compare VALUES (special cases)
//
// 3. Null:
//      value type:     can't be null (use int? for nullable)
//      reference type: can be null (use string? to mark nullable intent)
//
// 4. Performance:
//      value type:     stack allocation → fast, no GC pressure
//      reference type: heap allocation → GC must clean up later
//
// 5. Function arguments:
//      value type:     copied → function can't modify caller's variable (unless ref/out)
//      reference type: reference copied → function CAN modify the object's contents

// === Demonstrations ===
Console.WriteLine("=== Value Type: assignment COPIES ===");
int a = 10;
int b = a;
b = 99;
Console.WriteLine($"a = {a}, b = {b}");          // a=10, b=99 — independent

Console.WriteLine("\n=== Reference Type: assignment shares ===");
var listA = new List<int> { 1, 2, 3 };
var listB = listA;
listB.Add(4);
Console.WriteLine($"listA = [{string.Join(",", listA)}]");  // [1,2,3,4] — same object!
Console.WriteLine($"listB = [{string.Join(",", listB)}]");  // [1,2,3,4]
Console.WriteLine($"Same? {object.ReferenceEquals(listA, listB)}");  // True

Console.WriteLine("\n=== String: reference but IMMUTABLE ===");
string strA = "hello";
string strB = strA;
strA += " world";
Console.WriteLine($"strA = '{strA}'");   // "hello world" — new string created
Console.WriteLine($"strB = '{strB}'");   // "hello" — unchanged

Console.WriteLine("\n=== Record: reference but VALUE equality ===");
// record Point(double X, double Y);  // defined in earlier notebook
Console.WriteLine("Records compare by VALUE:");
Console.WriteLine("  new Point(1,2) == new Point(1,2) → True");
Console.WriteLine("  (unlike classes which compare by reference)");

Console.WriteLine("\n=== Function args ===");
void TryModify(int val, List<int> lst)
{
    val = 999;          // modifies LOCAL copy only (value type)
    lst.Add(999);       // modifies the ORIGINAL list (reference type)
}
int num = 42;
var myList = new List<int> { 1, 2 };
TryModify(num, myList);
Console.WriteLine($"num after:  {num}");                          // 42 — unchanged
Console.WriteLine($"list after: [{string.Join(",", myList)}]");   // [1,2,999] — modified!

// === Quick Reference ===
Console.WriteLine("\n=== Quick Reference ===");
Console.WriteLine("Value + Immutable:     int, bool, decimal, enum, record struct  → safest");
Console.WriteLine("Value + Mutable:       struct, ValueTuple  → avoid mutating");
Console.WriteLine("Reference + Immutable: string, record, delegate  → safe to share");
Console.WriteLine("Reference + Mutable:   class, List, Dict, arrays  → careful with sharing");
Console.WriteLine("");
Console.WriteLine("Python: everything is reference. Mutable/immutable is the only distinction.");
Console.WriteLine("C#:     value/reference + mutable/immutable = four combinations.");
```

    === Value Type: assignment COPIES ===
    a = 10, b = 99
    
    === Reference Type: assignment shares ===
    listA = [1,2,3,4]
    listB = [1,2,3,4]
    Same? True
    
    === String: reference but IMMUTABLE ===
    strA = 'hello world'
    strB = 'hello'
    
    === Record: reference but VALUE equality ===
    Records compare by VALUE:
      new Point(1,2) == new Point(1,2) → True
      (unlike classes which compare by reference)
    
    === Function args ===
    num after:  42
    list after: [1,2,999]
    
    === Quick Reference ===
    Value + Immutable:     int, bool, decimal, enum, record struct  → safest
    Value + Mutable:       struct, ValueTuple  → avoid mutating
    Reference + Immutable: string, record, delegate  → safe to share
    Reference + Mutable:   class, List, Dict, arrays  → careful with sharing
    
    Python: everything is reference. Mutable/immutable is the only distinction.
    C#:     value/reference + mutable/immutable = four combinations.
    
