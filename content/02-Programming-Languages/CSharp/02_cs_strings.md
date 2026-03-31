---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [string manipulation, string formatting, regex, f-strings, string interpolation]
keywords: [string, StringBuilder, interpolation, Regex, Split, Join, Trim, Replace, Span, Format]
description: "C# strings reference with executable examples and cell outputs — covers string creation, indexing, methods, interpolation, StringBuilder, and regular expressions. See [02_py_strings](https://alp78.github.io/elysium/02-Programming-Languages/Python/02_py_strings) for the Python equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 02. Strings - C#

> [!quote]
> "In our daily lives as programmers, we process text strings a lot. So I tried to work hard on text processing, namely the string class and regular expressions."
>
> — **Yukihiro Matsumoto**, creator of Ruby

## String Creation & Basics

#### String (string) - immutable sequence of Unicode characters

```csharp
using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

// C# has both 'string' (alias) and 'char' (single Unicode character, 2 bytes)
// Double quotes only for strings, single quotes for char
string s1 = "hello";
char c1 = 'A';                // single char — NOT a string
s1   // String: \"\"
$"Char:           '{c1}' (type: {c1.GetType().Name})"
```

    "hello"
    'A' (type: Char)

#### Verbatim & Raw Strings

```csharp
// Verbatim strings (@"") — disable escape sequence processing

string s2 = @"C:\Users\new\test";
string s3 = "C:\\Users\\new\\test";
s2   // Verbatim
s3   // Escaped
s2 == s3   // Same?
```

    C:\Users\new\test
    C:\Users\new\test
    Same? True

#### Multiline Strings

```csharp
// Multiline strings — verbatim (@"") and raw string literals (C# 11+)

string s4 = @"This is
a multiline
string";
s4   // Verbatim multiline:\n

// Raw string literals (C# 11+) — triple-quoted; indentation is trimmed from the closing delimiter
string s5 = """
    This is a
    raw string literal
    """;
s5   // Raw string literal:\n
```
    This is
    a multiline
    string
    This is a
    raw string literal

#### ToString(), Convert.ToString() — string from other types

```csharp
#nullable enable
// Type-to-string conversion — ToString(), Convert.ToString(), and $""
42.ToString()
3.14.ToString()
true.ToString()
Convert.ToString(42)   // Convert.ToString()

// Null-safe conversion — ?. returns null, ?? provides fallback
object? obj = null;
obj?.ToString() ?? "(null)"   // obj?.ToString()
```

    '42'
    '3.14'
    'True'
    '42'
    '(null)'

#### Repetition & Concatenation

```csharp
// String repetition and concatenation — no * operator in C#

new string('*', 5)
string.Concat(Enumerable.Repeat("ha", 3))
"hello" + " " + "world"
```

    '*****'
    'hahaha'
    'hello world'

#### Empty String & Null Checks

```csharp
// Empty string and null checks — three distinct states

string empty = "";
empty == ""
string.Empty   // string.Empty: \"\"
empty.Length
string.IsNullOrEmpty(" ")
string.IsNullOrEmpty("")
string.IsNullOrEmpty(null)
string.IsNullOrWhiteSpace("  ")
string.IsNullOrWhiteSpace("")
```

    True
    ""
    0
    False
    True
    True
    True
    True

#### String Immutability

```csharp
// String immutability — every operation returns a new string object

string s = "hello";
// s[0] = 'H';  // Compile error! Strings are immutable
s = 'H' + s.Substring(1);  // must create a new string
s   // Modified
```

    Hello

## Indexing & Slicing

#### Indexing (0-based)

> [!info] Indexing and slicing
>
> - `s[i]` — returns a `char` at position `i`
> - `s[^i]` — indexes from the end (`^1` = last char), eliminating `s[s.Length - i]`
> - `s[a..b]` — substring via Range syntax (C# 8+), right-exclusive (`s[0..5]` = indices 0-4)
> - No step/stride support — use LINQ for every-nth-char
> - For pattern extraction, use Regex or Split instead of index math

```csharp
string s = "Hello, World!";
//           0123456789...

s[0]
s[1]
s[^1]
s[^2]
s[0..5]
s[..5]
s[7..]
s[^6..]
s[7..12]
```

    'H'
    'e'
    '!'
    'd'
    'Hello'
    'Hello'
    'World!'
    'World!'
    'World'

#### Substring & Stride

```csharp
// Substring and stride — older API and LINQ-based character stepping

s.Substring(7)   // Substring(7)
s.Substring(7, 5)   // Substring(7,5)

// No step/stride — use LINQ or Array.Reverse for every-other or reversed
new string(s.Where((c, i) => i % 2 == 0).ToArray())   // Every 2nd
new string(s.Reverse().ToArray())   // Reversed

// Or use Array.Reverse
char[] arr = s.ToCharArray();
Array.Reverse(arr);
new string(arr)   // Reversed
```

    'World!'
    'World'
    'Hlo ol!'
    '!dlroW ,olleH'
    '!dlroW ,olleH'

#### Out of range — throws IndexOutOfRangeException

```csharp
// Out-of-range access — exception types for index vs range
```

    s[100]    → IndexOutOfRangeException
    s[0..100] → ArgumentOutOfRangeException (range must be within bounds)

#### foreach char — iterate over string characters

```csharp
// Character iteration — foreach yields each char in the string

foreach (char ch in s[..5])
    Console.Write($"{ch} ");
```

    H e l l o

#### Index + character — LINQ Select with index

```csharp
// Enumerated iteration — LINQ Select with index for (char, index) pairs

foreach (var (ch, i) in s[..5].Select((c, i) => (c, i)))
    Console.WriteLine($"  [{i}] = '{ch}'");
```
      [0] = 'H'
      [1] = 'e'
      [2] = 'l'
      [3] = 'l'
      [4] = 'o'

#### Index + character — plain for loop

```csharp
// For-loop iteration — classic index-based character access

for (int i = 0; i < 5; i++)
    Console.WriteLine($"  [{i}] = '{s[i]}'");
```
      [0] = 'H'
      [1] = 'e'
      [2] = 'l'
      [3] = 'l'
      [4] = 'o'

## String Methods

#### Case Methods

> [!info] Case methods
>
> - `ToUpper()` / `ToLower()` — convert all characters
> - `ToTitleCase()` — via `CultureInfo.CurrentCulture.TextInfo`, capitalizes each word
> - No built-in `swapcase` or `casefold`
> - Culture-aware: `ToUpper(CultureInfo)` handles locale-specific rules (e.g., Turkish `i` → `İ`)

> [!warning] Anti-pattern
>
> Don't use `ToUpper()` for case-insensitive comparison — use `StringComparison.OrdinalIgnoreCase` instead.

```csharp
#nullable enable

string s = "  Hello, World!  ";

// Case methods — ToUpper, ToLower, ToTitleCase (via TextInfo); no built-in swapcase or casefold
"hello world".ToUpper()   // ToUpper()
"HELLO WORLD".ToLower()   // ToLower()
// No built-in Title Case — use TextInfo
CultureInfo.CurrentCulture.TextInfo.ToTitleCase("hello world")   // ToTitleCase()
// No swapcase or casefold — must implement manually
```

    'HELLO WORLD'
    'hello world'
    'Hello World'

#### Whitespace & Padding

```csharp
// Whitespace and padding — Trim, PadLeft, PadRight

s.Trim()   // Trim()
s.TrimStart()   // TrimStart()
s.TrimEnd()   // TrimEnd()
"Hello!!".Trim('!')   // Trim('!')
"hello".PadLeft(20)   // PadLeft(20)
"hello".PadRight(20)   // PadRight(20)
"hello".PadLeft(20, '*')   // PadLeft(20,'*')
"42".PadLeft(8, '0')   // PadLeft(8,'0')
```

    'Hello, World!'
    'Hello, World!  '
    '  Hello, World!'
    'Hello'
    '               hello'
    'hello               '
    '***************hello'
    '00000042'

#### Character & String Checks

```csharp
// Character and string checks — char.IsLetter, LINQ-based string tests

char.IsLetter('A')
char.IsDigit('5')
char.IsWhiteSpace(' ')
char.IsUpper('A')
char.IsLower('a')

// String-level checks with LINQ
"Hello".All(char.IsLetter)   // All letters
"12345".All(char.IsDigit)   // All digits
"Hello123".All(char.IsLetterOrDigit)   // All alnum
"HELLO".All(char.IsUpper)   // All upper
"hello".All(char.IsLower)   // All lower
"Hello".All(c => c < 128)   // All ASCII
```

      True
      True
      True
      True
      True
      True
      True
      True
      True
      True
      True

#### Searching

```csharp
// Searching — IndexOf, LastIndexOf, Contains, StartsWith, EndsWith

s = "Hello, World! Hello, C#!";
s.IndexOf("Hello")   // IndexOf(\"Hello\")
s.IndexOf("Hello", 1)   // IndexOf(\"Hello\",1)
s.LastIndexOf("Hello")   // LastIndexOf(\"Hello\")
s.IndexOf("Java")   // IndexOf(\"Java\")
s.Contains("World")   // Contains(\"World\")
s.StartsWith("Hello")   // StartsWith(\"Hello\")
s.EndsWith("!")   // EndsWith(\"!\")

// Count occurrences — no built-in, use LINQ or regex
int count = s.Split("Hello").Length - 1;
count   // Count \"Hello\"
```

    0
    14
    14
    -1
    True
    True
    True
    2

#### Replace, Split & Join

```csharp
// Replace and Split — substitution and tokenization

s.Replace("Hello", "Hi")   // Replace
// No max count parameter — replaces ALL (use Regex for first-only)

string csv = "apple,banana,cherry";
string.Join(", ", csv.Split(','))   // Split(',')
string.Join(", ", csv.Split(',', 2))   // Split(',', 2)
string words = "  hello  world  ";
string.Join(", ", words.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))   // Split()
string.Join(", ", words.Split(' '))   // Split(' ')
```

    'Hi, World! Hi, C#!'
    [apple, banana, cherry]
    [apple, banana,cherry]
    [hello, world]
    [, , hello, , world, , ]

#### StringSplitOptions

```csharp
// StringSplitOptions and Join — control Split behavior and reassembly

string.Join(", ", "a,,b,,c".Split(',', StringSplitOptions.RemoveEmptyEntries))   // RemoveEmpty
string.Join(", ", " a , b , c ".Split(',', StringSplitOptions.TrimEntries))   // TrimEntries

// Join
string[] parts = { "hello", "world", "csharp" };
string.Join(' ', parts)   // Join(' ')
string.Join(", ", parts)   // Join(', ')
string.Join("->", parts)   // Join('->')
string.Concat(parts)   // Concat
```

    [a, b, c]
    [a, b, c]
    'hello world csharp'
    'hello, world, csharp'
    'hello->world->csharp'
    'helloworldcsharp'

#### Encoding.UTF8.GetBytes / GetString — text encoding

```csharp
// Encoding — convert between strings and byte arrays

byte[] utf8 = System.Text.Encoding.UTF8.GetBytes("hello");
byte[] ascii = System.Text.Encoding.ASCII.GetBytes("hello");
string.Join(", ", utf8)   // UTF8
string.Join(", ", ascii)   // ASCII
System.Text.Encoding.UTF8.GetString(utf8)   // Back
```

    [104, 101, 108, 108, 111]
    [104, 101, 108, 108, 111]
    'hello'

## String Formatting

#### String formatting setup — declare format demo variables

```csharp
// Variables for formatting demonstrations

string name = "Alice";
int age = 30;
double n = 1234567.89123;
double pct = 0.856;
```

#### String Interpolation (recommended)

```csharp
// String interpolation — $"" and String.Format for value embedding

$"Name: {name}, Age: {age}"
age + 1   // Expression
name.ToUpper()   // Method call
```

    30
    31
    ALICE
    30
    30, Alice again

#### Numeric Format Specifiers

```csharp
// Numeric format specifiers — F, N, E, G, P, C, X, D for display formatting

n.ToString("F2")   // Fixed 2 dec
n.ToString("F0")   // Fixed 0 dec
n.ToString("N2")   // Comma sep
n.ToString("E2")   // Scientific
n.ToString("G4")   // General
pct.ToString("P1")   // Percentage
n.ToString("C2")   // Currency
1234567890   // Phone

int x = 255;
x.ToString("D")   // Decimal
x.ToString("X")   // Hex upper
x.ToString("x")   // Hex lower
x.ToString("D8")   // Zero-padded
Convert.ToString(x, 2)   // Binary
Convert.ToString(x, 8)   // Octal
```

    1234567.89
    1234568
    1'234'567.89
    1.23E+006
    1.235E+06
    85.6%
    $1,234,567.89
    123-456-7890
    255
    FF
    ff
    00000255
    11111111
    377

#### Alignment & Culture-Specific Formatting

```csharp
// Alignment and culture-specific formatting — layout and locale control

string s = "hi";
s   // Left 10
s   // Right 10
s.PadLeft(10, '*')   // PadLeft(*)
s.PadRight(10, '*')   // PadRight(*)

double amt = 1234567.89;
amt.ToString("C2", new CultureInfo("en-US"))   // US
amt.ToString("C2", new CultureInfo("fr-FR"))   // EUR
amt.ToString("C0", new CultureInfo("ja-JP"))   // JPY
amt.ToString("C2", new CultureInfo("zh-CN"))   // CNY
amt.ToString("C2", new CultureInfo("pt-BR"))   // BRL
amt.ToString("C2", new CultureInfo("en-GB"))   // GBP
```

    'hi        '
    '        hi'
    '********hi'
    'hi********'
    $1,234,567.89
    1 234 567,89 €
    ￥1,234,568
    ¥1,234,567.89
    R$ 1.234.567,89
    £1,234,567.89

## Efficient String Building (StringBuilder)

#### StringBuilder vs string + — concatenation performance comparison

> [!info] StringBuilder
>
> - Modifies an internal char buffer in place — `Append`/`AppendLine`/`Insert`/`Replace`
> - O(n) for n appends vs O(n²) for `string +` in a loop
> - Pre-allocate capacity for known sizes: `new StringBuilder(1024)`
> - Use for building strings in loops, large template assembly, CSV generation
> - For simple concatenation (2-5 strings), `+` or `$""` is cleaner; for collections, `string.Join`

```csharp
// string is IMMUTABLE — each + creates a new string object
// StringBuilder modifies in-place, much faster for loops

// Performance: + vs StringBuilder — string concatenation in a loop creates many allocations; StringBuilder mutates in place
var sw = Stopwatch.StartNew();
string result = "";
for (int i = 0; i < 50000; i++)
    result += i.ToString();
sw.Stop();
var t1 = sw.Elapsed.TotalSeconds;
$"+ in loop (50k):     {t1:F4}s  len={result.Length}"

sw.Restart();
var sb = new StringBuilder();
for (int i = 0; i < 50000; i++)
    sb.Append(i);
result = sb.ToString();
sw.Stop();
var t2 = sw.Elapsed.TotalSeconds;
$"StringBuilder (50k): {t2:F4}s  len={result.Length}"
t1/t2   // StringBuilder is x faster
```

    4.2222s  len=238890
    0.0005s  len=238890
    StringBuilder is 8989.1x faster

#### StringBuilder Append, Insert, Replace, Remove — mutable string building

```csharp
// StringBuilder API — Append, AppendLine, Insert, Replace, Remove

sb = new StringBuilder("Hello");
sb.Append(", ");                          // append string
sb.Append("World!");
sb.AppendLine();                          // append + newline
sb.AppendLine($"Number: {42}");           // formatted append
sb.Insert(0, ">>> ");                     // insert at position
sb.Replace("World", "C#");               // replace
sb   // Result:\n
sb.Length   // Length
sb.Capacity   // Capacity

// StringBuilder with initial capacity (avoid resizing)
var sb2 = new StringBuilder(1000);        // pre-allocate
sb2.Capacity   // Pre-alloc capacity
```
    >>> Hello, C#!
    42
    
    28
    33
    1000

#### string.Join, string.Concat — efficient multi-string assembly

```csharp
// Join and Concat — efficient collection-to-string conversion

var items = Enumerable.Range(0, 5).Select(i => $"item_{i}");
string.Join(", ", items)   // Join
string.Concat(Enumerable.Range(0, 5))   // Concat

string first = "Hello";
string last = "World";
string full = first + " " + last;     // compiler optimizes small concats
full   // Small concat
```

    'item_0, item_1, item_2, item_3, item_4'
    '01234'
    'Hello World'
    use + for 2-5 strings, StringBuilder for loops

## Regular Expressions

#### Regex.Match() — First Match

> [!info] Regex
>
> - `Regex.Match` — returns the first match (check `.Success`)
> - `Regex.Matches` — returns all matches as `MatchCollection`
> - Use `@""` verbatim strings to avoid double-escaping backslashes
> - `Groups[0]` is the full match; `Groups[1..n]` are capture groups
> - For simple `Contains`/`StartsWith` checks, string methods are faster

> [!warning] Anti-patterns
>
> - **Not checking `.Success`** before reading `.Value` — empty match is not null
> - **Recompiling the same pattern in a loop** — cache with `new Regex()`

```csharp
string text = "Contact us at support@email.com or sales@company.org. Call 123-456-7890 or 987-654-3210.";

// Regex.Match & Matches — find first or all matches; check Success before reading Value
var match = Regex.Match(text, @"\d{3}-\d{3}-\d{4}");
if (match.Success)
    Console.WriteLine($"Found: {match.Value} at [{match.Index}:{match.Index + match.Length}]");

var phones = Regex.Matches(text, @"\d{3}-\d{3}-\d{4}");
var emails = Regex.Matches(text, @"[\w.+-]+@[\w-]+\.[\w.]+");
string.Join(", ", phones.Select(m => m.Value))   // Phones
string.Join(", ", emails.Select(m => m.Value))   // Emails

// Iterate matches
foreach (Match m in phones)
    Console.WriteLine($"  {m.Value} at [{m.Index}:{m.Index + m.Length}]");

Regex.IsMatch("12345", @"^\d+$")   // IsMatch(digits)
Regex.IsMatch("123a5", @"^\d+$")   // IsMatch(mixed)
```

    123-456-7890 at [59:71]
    123-456-7890, 987-654-3210
    support@email.com, sales@company.org.
      123-456-7890 at [59:71]
      987-654-3210 at [75:87]
    True
    False

#### Regex capture groups — numbered and named (?&lt;name&gt;...)

```csharp
// Capture groups — extract sub-matches with numbered and named groups

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
```

    123-456-7890
    123
    456
    7890
    support
    email.com

#### Regex.Replace, Regex.Split, new Regex() — replace, split, compile

```csharp
// Regex Replace, Split, and Compiled — advanced pattern operations

Regex.Replace(text, @"\d{3}-\d{3}-\d{4}", "***-***-****")

// Replace with function (MatchEvaluator)
Regex.Replace("price: 50, qty: 3", @"\d+", m => (int.Parse(m.Value) * 2).ToString())

// Replace with backreference
Regex.Replace("user@host", @"(\w+)@(\w+)", "$2/$1")

string.Join(", ", Regex.Split("Hello World. How are you? Fine!", @"[.!?]\s*"))
string.Join(", ", Regex.Split("a , b , c", @"\s*,\s*"))

// Compiled regex — precompiles to IL for repeated use
var phonePat = new Regex(@"\d{3}-\d{3}-\d{4}", RegexOptions.Compiled);
string.Join(", ", phonePat.Matches(text).Select(m => m.Value))
phonePat.Replace(text, "REDACTED")
```

    Contact us at support@email.com or sales@company.org. Call ***-***-**** or ***-***-****.
    6
    host/user
    Hello World, How are you, Fine, 
    a, b, c
    123-456-7890, 987-654-3210
    Contact us at support@email.com or sales@company.org. Call REDACTED or REDACTED.

#### Regex Syntax Reference

```csharp
// Regex syntax reference — characters, quantifiers, anchors, groups

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
```

    
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

#### Regex Flags

```csharp
// Regex flags — IgnoreCase, Multiline, Singleline for match behavior

string text = "Hello\nworld\nHELLO";

// IgnoreCase — case-insensitive matching
var ic = Regex.Matches(text, @"hello", RegexOptions.IgnoreCase);
string.Join(", ", ic.Select(m => m.Value))   // IgnoreCase

// Multiline — ^ and $ match line boundaries instead of string boundaries
var ml = Regex.Matches(text, @"^\w+", RegexOptions.Multiline);
string.Join(", ", ml.Select(m => m.Value))   // Multiline

// Singleline — . matches newline characters
Regex.IsMatch(text, @"Hello.world", RegexOptions.Singleline)   // Singleline
```

    Hello, HELLO
    Hello, world, HELLO
    True

#### IgnorePatternWhitespace — verbose patterns with inline comments

```csharp
// IgnorePatternWhitespace — verbose regex with inline comments

var pattern = new Regex(@"
    (\d{3})     # area code
    [-.]        # separator
    (\d{3})     # first 3 digits
    [-.]        # separator
    (\d{4})     # last 4 digits
", RegexOptions.IgnorePatternWhitespace);
var m2 = pattern.Match("Call 123-456-7890");
if (m2.Success) Console.WriteLine($"Verbose:     {m2.Groups[1]}-{m2.Groups[2]}-{m2.Groups[3]}");
```

    123-456-7890

#### RegexOptions bitwise OR — combine multiple flags

```csharp
// Combining regex flags — use | to apply multiple RegexOptions

var combined = Regex.Matches(text, @"^hello", RegexOptions.IgnoreCase | RegexOptions.Multiline);
string.Join(", ", combined.Select(m => m.Value))   // Combined
```

    Hello, HELLO

#### RegexOptions Reference

| Option | Effect |
|---|---|
| `IgnoreCase` | Case-insensitive matching |
| `Multiline` | `^` and `$` match line boundaries |
| `Singleline` | `.` matches newline characters |
| `IgnorePatternWhitespace` | Whitespace in pattern is ignored, enables comments |
| `Compiled` | Precompiles regex to IL for repeated use |
| `RightToLeft` | Search proceeds right to left |
| `ExplicitCapture` | Only named groups capture, `(...)` becomes non-capturing |
| `NonBacktracking` | .NET 7+, guaranteed linear time (no catastrophic backtracking) |

#### Common Regex Patterns

```csharp
// Common regex patterns — ready-to-use patterns for validation

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

      email               : ^[\w.+-]+@[\w-]+\.[\w.]+$
      URL                 : https?://[\w./\-?=&#]+
      IPv4                : \b\d{1,3}(\.\d{1,3}){3}\b
      date YYYY-MM-DD     : \d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])
      time HH:MM          : (?:[01]\d|2[0-3]):[0-5]\d
      hex color           : ^#[0-9a-fA-F]{6}$
      phone US            : \(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}
      zip code US         : \d{5}(-\d{4})?
      strong password     : ^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$
