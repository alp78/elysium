---
tags: [python]
aliases: [string manipulation, string formatting, regex, f-strings, string interpolation]
description: "Python strings reference with executable examples and cell outputs — covers string creation, indexing, slicing, methods, formatting, efficient building, and regular expressions. See [02_cs_strings](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/02_cs_strings) for the C# equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 02. Strings - Python

> [!quote]
> "In our daily lives as programmers, we process text strings a lot. So I tried to work hard on text processing, namely the string class and regular expressions."
>
> — **Yukihiro Matsumoto**, creator of Ruby

## String Creation & Basics

#### String (str) - immutable sequence of Unicode characters

```python
import io
import re
import time

# No separate char type — a single character is just a string of length 1
# Single quotes, double quotes — identical
import locale
s1 = 'hello'
s2 = "hello"
s1   # Single quotes
f"Double quotes:  \"{s2}\""
s1 == s2   # Same?
```

#### Multiline & Raw Strings

```python
# Multiline and raw strings — triple quotes and r"" prefix

s3 = """This is
a multiline
string"""
s4 = '''Also works
with single
quotes'''
s3   # Triple-quoted:\n

# Raw strings — no escape processing
s5 = r"C:\Users\new\test"     # backslashes NOT interpreted
s6 = "C:\\Users\\new\\test"    # same result, but must escape
s5   # Raw string
s6   # Escaped string
s5 == s6   # Same?
```

    This is
    a multiline
    string
    
    C:\Users\new\test
    C:\Users\new\test
    True

#### str() — convert other types to string

```python
# Type-to-string conversion — str(), repetition, and empty checks

str(42)   # str(42)
str(3.14)   # str(3.14)
str(True)   # str(True)
str([1,2,3])   # str([1,2,3])
str(None)   # str(None)

# String repetition and concatenation
'ha' * 3   # 'ha' * 3
'hello' + ' ' + 'world'   # 'hello' + ' ' + 'world'

# Empty string and truthiness
empty = ""
empty == ''   # empty == ''
len(empty)   # len(empty)
bool('')  # False (falsy)
bool('a')  # True (truthy)
```

    '42'
    '3.14'
    'True'
    '[1, 2, 3]'
    'None'
    'hahaha'
    'hello' + ' ' + 'world': 'hello world'
    True
    0
    False
    True

#### String Immutability

```python
# String immutability — strings cannot be modified in place

s = 'H' + s[1:]  # must create a new string
s   # Modified
```

    Hello

## Indexing & Slicing

#### Indexing (0-based)

> [!info] Indexing and slicing
>
> - `s[i]` — access by index (0-based)
> - `s[-1]` — last character (eliminates `len(s)-1`)
> - `s[a:b]` — slice from `a` to `b` (right-exclusive)
> - `s[::2]` — every 2nd char; `s[::-1]` — reverse
> - Slicing never raises `IndexError` — out-of-range indices are silently clamped
> - For pattern extraction, use regex or split instead of index math

```python
#     0123456789...

s[0]  # H
s[1]  # e
s[-1]  # ! (last char)
s[-2]  # d (second to last)
s[0:5]  # Hello (stop is exclusive)
s[:5]  # Hello (start defaults to 0)
s[7:]  # World! (stop defaults to end)
s[-6:]  # orld! (negative index)
s[::2]  # Hlo ol! (every 2nd char)
s[::-1]  # !dlroW ,olleH (reversed)
s[7:12]  # World
s[2:10:2]  # lo o (slice with step)
```

    'H'
    'e'
    '!'
    'd'
    'Hello'
    'Hello'
    'World!'
    'World!'
    'Hlo ol!'
    '!dlroW ,olleH'
    'World'
    'lo o'

#### String iteration — enumerate(), slicing out of range

```python
# Out-of-range behavior and character iteration

s[0:100]  # Hello, World! (no error!)
# print(s[100])                       # IndexError!

# Iterate over characters
print("Chars:", end=" ")
for ch in s[:5]:
    print(ch, end=" ")

# Enumerate — index + character
for i, ch in enumerate(s[:5]):
    print(f"  [{i}] = '{ch}'")
```

    'Hello, World!'
    H e l l o
      [0] = 'H'
      [1] = 'e'
      [2] = 'l'
      [3] = 'l'
      [4] = 'o'

## String Methods

#### Case Methods  — Case, Whitespace, Checking, Searching, Replacing

> [!info] Case methods
>
> - `casefold()` — more aggressive than `lower()`, handles Unicode (`"Straße"` → `"strasse"`)
> - Use `casefold()` for case-insensitive comparison, not `lower()`
> - `title()` / `capitalize()` — handle word boundaries automatically
> - All methods are Unicode-aware
> - For locale-sensitive rules (Turkish `i`), use the `locale` module

```python
s = "  Hello, World!  "

'hello world'.upper()   # upper()
'HELLO WORLD'.lower()   # lower()
'hello world'.title()   # title()
'hello world'.capitalize()   # capitalize()
'Hello World'.swapcase()   # swapcase()
'Straße'.casefold()  # aggressive lowercase for comparison
```

    'HELLO WORLD'
    'hello world'
    'Hello World'
    'Hello world'
    'hELLO wORLD'
    'strasse'

#### Whitespace & Padding

```python
# Whitespace and padding — strip, ljust, rjust, center, zfill

s.lstrip()  # left only
s.rstrip()  # right only
'Hello!!'.strip('!')  # strip specific chars
'hello'.center(20)   # center(20)
'hello'.center(20, '*')   # center(20,'*')
'hello'.ljust(20)   # ljust(20)
'hello'.rjust(20)   # rjust(20)
'42'.zfill(8)  # zero-pad numbers
```

    'Hello, World!'
    'Hello, World!  '
    '  Hello, World!'
    'Hello'
    '       hello        '
    '*******hello********'
    'hello               '
    '               hello'
    '00000042'

#### String Type Checks

```python
# String type checks — isalpha, isdigit, isalnum, isspace, and more

checks = {
    "isalpha()":    "Hello",
    "isdigit()":    "12345",
    "isalnum()":    "Hello123",
    "isspace()":    "   ",
    "isupper()":    "HELLO",
    "islower()":    "hello",
    "istitle()":    "Hello World",
    "isascii()":    "Hello",
    "isnumeric()":  "½",          # True (broader than isdigit)
    "isdecimal()":  "12345",
    "isidentifier()": "my_var",   # valid Python identifier?
    "isprintable()":  "hello\n",  # False (\n is not printable)
}
for method, example in checks.items():
    result = getattr(example, method.replace('()', ''))()
    print(f"  '{example:12}'.{method:18} = {result}")
```

      'Hello       '.isalpha()          = True
      '12345       '.isdigit()          = True
      'Hello123    '.isalnum()          = True
      '            '.isspace()          = True
      'HELLO       '.isupper()          = True
      'hello       '.islower()          = True
      'Hello World '.istitle()          = True
      'Hello       '.isascii()          = True
      '½           '.isnumeric()        = True
      '12345       '.isdecimal()        = True
      'my_var      '.isidentifier()     = True
      'hello
          '.isprintable()      = False

#### Searching

```python
# Searching — find, index, count, startswith, endswith, in

s.find('Hello')  # 0 (first occurrence)
s.find('Hello', 1)  # 14 (start from index 1)
s.rfind('Hello')  # 14 (last occurrence)
s.find('Java')  # -1 (not found)
s.index('World')  # 7 (like find but raises ValueError)
s.count('Hello')  # 2
s.startswith('Hello')   # startswith('Hello')
s.endswith('!')   # endswith('!')
'World' in s  # True (membership)
```

    0
    14
    14
    -1
    7
    2
    True
    True
    True

#### Replace, Split & Join

```python
# Replace, split, and join — substitution, tokenization, and reassembly

s.replace('Hello', 'Hi')   # replace
s.replace('Hello', 'Hi', 1)   # replace(max=1)

csv = "apple,banana,cherry"

# split — split on delimiter; optional second arg limits number of splits
csv.split(',')   # split(',')
csv.split(',', 1)   # split(',', 1)

words = "  hello  world  "

# split() with no args splits on any whitespace and strips leading/trailing
words.split()   # split()

# split(' ') splits on exact space character, preserving empty strings
words.split(' ')   # split(' ')

# rsplit — like split but starts from the right
csv.rsplit(',', 1)   # rsplit(',', 1)

lines = "line1\nline2\nline3"

# splitlines — splits on line boundaries (\n, \r\n, \r, etc.)
lines.splitlines()   # splitlines()

# partition — splits into exactly (before, separator, after) on first occurrence
csv.partition(',')   # partition(',')

# rpartition — same but finds last occurrence
csv.rpartition(',')   # rpartition(',')

parts = ["hello", "world", "python"]

# join — concatenate iterable with separator between elements
' '.join(parts)   # ' '.join()
', '.join(parts)   # ', '.join()
'->'.join(parts)   # '->'.join()
''.join(parts)   # ''.join()

tab_str = "a\tb\tc"

# expandtabs — replace tab characters with spaces aligned to tab stops
tab_str.expandtabs(4)   # expandtabs(4)
```

    '  Hi, World!  '
    '  Hi, World!  '
    ['apple', 'banana', 'cherry']
    ['apple', 'banana,cherry']
    ['hello', 'world']
    ['', '', 'hello', '', 'world', '', '']
    ['apple,banana', 'cherry']
    ['line1', 'line2', 'line3']
    ('apple', ',', 'banana,cherry')
    ('apple,banana', ',', 'cherry')
    'hello world python'
    'hello, world, python'
    'hello->world->python'
    'helloworldpython'
    'a   b   c'

#### Translate & Encode

```python
# Translate and encode — character-level replacement and byte conversion

table = str.maketrans("aeiou", "12345")
'hello world'.translate(table)   # translate(vowels)

# Remove characters
table2 = str.maketrans("", "", "aeiou")
'hello world'.translate(table2)   # remove vowels

'hello'.encode('utf-8')   # encode('utf-8')
'hello'.encode('ascii')   # encode('ascii')
```

    'h2ll4 w4rld'
    'hll wrld'
    b'hello'
    b'hello'

## String Formatting

#### f-strings (recommended, Python 3.6+)

> [!info] f-string syntax
>
> - `f"..."` embeds any expression in `{braces}`
> - Format specifiers: `f"{n:.2f}"` | method calls: `f"{s.upper()}"` | expressions: `f"{a + 1}"`
> - Faster than `.format()` and more readable
> - Use f-strings for all new code; `.format()` when the template is a variable

> [!danger] Injection risk
>
> Never use f-strings in SQL or shell commands — use parameterized queries. For logging, use `logger.info("msg %s", val)` for lazy evaluation.

> [!success] Correct pattern
>
> Use parameterized queries for SQL: `cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))`. For logging, use lazy `%s` formatting: `logger.info("User %s logged in", username)` — the string is only built if the log level is active.

```python
name, age = "Alice", 30
n = 1234567.89123
pct = 0.856


f"Name: {name}, Age: {age}"
age + 1   # Expression
name.upper()   # Method call

"Name: {}, Age: {}".format(name, age)
"Name: {0}, Age: {1}, {0} again".format(name, age)  # reuse by index
"Name: {n}, Age: {a}".format(n=name, a=age)  # named

"Name: %s, Age: %d, Pi: %.2f" % (name, age, 3.14)
```

    Name: Alice, Age: 30
    31
    ALICE
    Name: Alice, Age: 30
    Name: Alice, Age: 30, Alice again
    Name: Alice, Age: 30
    Name: Alice, Age: 30, Pi: 3.14

#### Numeric Format Specifiers

```python
# Numeric format specifiers — .2f, .2e, ,.2f, .1%, d, x, o, b

f"{n:.2f}"   # Fixed 2 dec
f"{n:.0f}"   # Fixed 0 dec
f"{n:,.2f}"   # Comma sep
f"{n:.2e}"   # Scientific
f"{n:.4g}"   # General
f"{pct:.1%}"   # Percentage

x = 255
x:d   # Decimal
x:b   # Binary
x:o   # Octal
x:x   # Hex lower
x:X   # Hex upper
f"{x:#x}"   # With prefix
f"{x:08d}"   # Zero-padded
```

    1234567.89
    1234568
    1,234,567.89
    1.23e+06
    1.235e+06
    85.6%
    255
    11111111
    377
    ff
    FF
    0xff
    00000255

#### Alignment & Locale Currency

```python
# Alignment and locale currency — layout control and locale-aware output

s = "hi"
f"{s:<10}"   # Left 10
f"{s:>10}"   # Right 10
f"{s:^10}"   # Center 10
f"{s:*^10}"   # Fill char
f"{42:+d}"   # Sign always
f"{42: d}"   # Space for pos

try:
    locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
    print(f"US:  {locale.currency(1234567.89, grouping=True)}")
except:
    print("(locale not available)")

# babel is more reliable for currency
try:
    from babel.numbers import format_currency
    print(f"EUR: {format_currency(1234567.89, 'EUR', locale='de_DE')}")
    print(f"JPY: {format_currency(1234567.89, 'JPY', locale='ja_JP')}")
    print(f"BRL: {format_currency(1234567.89, 'BRL', locale='pt_BR')}")
except ImportError:
    print("(babel not installed — pip install babel)")
```

    'hi        '
    '        hi'
    '    hi    '
    '****hi****'
    +42
    42
    $1,234,567.89
    EUR: 1.234.567,89 €
    JPY: ￥1,234,568
    BRL: R$ 1.234.567,89

## Efficient String Building

Strings are immutable — each `+=` copies the entire string. For *n* concatenations, this is O(n²) total work. Use `"".join()` or `io.StringIO` for O(n) string building.

> [!warning] Don't use += in loops
>
> Each iteration copies the growing string into a new object. CPython may optimize simple cases, but this is not guaranteed. Always consider the building strategy for more than ~10 concatenations. For 2–5 concatenations, `+` is fine.

> [!success] Correct pattern
>
> Use `"".join(parts)` for O(n) string assembly: `result = "".join(str(i) for i in range(50000))`. For incremental writes, use `io.StringIO`: `buf = io.StringIO(); buf.write(...); result = buf.getvalue()`.

#### String concatenation performance — += in loops is O(n²)

```python
# Performance comparison — + in loop vs join()

start = time.perf_counter()
result = ""
for i in range(50000):
    result += str(i)
t1 = time.perf_counter() - start
f"+ in loop (50k):     {t1:.4f}s  len={len(result)}"

# GOOD: O(n) — join builds once
start = time.perf_counter()
result = "".join(str(i) for i in range(50000))
t2 = time.perf_counter() - start
f"join() (50k):        {t2:.4f}s  len={len(result)}"
f"join is {t1/t2:.1f}x faster"
```

    0.0542s  len=238890
    0.0037s  len=238890
    join is 14.7x faster

#### io.StringIO & List Building

```python
# io.StringIO and list building — two efficient string assembly patterns

buf = io.StringIO()
buf.write("Hello")
buf.write(", ")
buf.write("World!")
buf.write(f" Number: {42}")
result = buf.getvalue()
result
buf.close()

parts = []
for i in range(5):
    parts.append(f"item_{i}")
result = ", ".join(parts)
result

result = ", ".join(f"item_{i}" for i in range(5))
result   # Comprehension
```

    'Hello, World! Number: 42'
    'item_0, item_1, item_2, item_3, item_4'
    'item_0, item_1, item_2, item_3, item_4'

#### Small number of concatenations — readability wins

```python
# Small concatenation — + is fine for 2-5 strings

first = "Hello"
last = "World"
full = first + " " + last    # perfectly fine
full   # Small concat
# Rule: use + for 2-5 strings, join() for loops/many strings
```

    'Hello World'
    use + for 2-5 strings, join() for loops/many strings

## Regular Expressions

#### re module — import and test text setup

```python
text = "Contact us at support@email.com or sales@company.org. Call 123-456-7890 or 987-654-3210."
```

#### re.search, re.findall, re.finditer, re.match — pattern matching

```python
# re.search, re.findall, re.match — find patterns in text

match = re.search(r'\d{3}-\d{3}-\d{4}', text)
if match:
    print(f"Found: {match.group()} at [{match.start()}:{match.end()}]")

# re.findall — returns all non-overlapping matches as a list of strings
phones = re.findall(r'\d{3}-\d{3}-\d{4}', text)
emails = re.findall(r'[\w.+-]+@[\w-]+\.[\w.]+', text)
phones
emails

# re.finditer — like findall but yields match objects, giving access to position and groups
for m in re.finditer(r'\d{3}-\d{3}-\d{4}', text):
    print(f"  {m.group()} at [{m.start()}:{m.end()}]")

# re.match — only matches at the START of the string (unlike search)
bool(re.match(r'Contact', text))   # match('Contact')
bool(re.match(r'support', text))   # match('support')

# re.fullmatch — the entire string must match the pattern
bool(re.fullmatch(r'\d+', '12345'))   # fullmatch digits
bool(re.fullmatch(r'\d+', '123a5'))   # fullmatch digits
```

#### Regex capture groups — numbered and named (?P&lt;name&gt;...)

```python
# Capture groups — extract sub-matches with () and (?P<name>...)

match = re.search(r'(\d{3})-(\d{3})-(\d{4})', text)
if match:
    print(f"Full:     {match.group(0)}")
    print(f"Groups:   {match.groups()}")
    print(f"Area:     {match.group(1)}")

# Named groups — (?P<name>...) gives a capture group a label so it can be accessed
# by name instead of position. groupdict() returns all named groups as a dict.
match = re.search(r'(?P<user>[\w.+-]+)@(?P<domain>[\w-]+\.[\w.]+)', text)
if match:
    print(f"User:     {match.group('user')}")
    print(f"Domain:   {match.group('domain')}")
    print(f"GroupDict:{match.groupdict()}")
```

#### re.sub, re.split, re.compile — replace, split, precompile

```python
# re.sub, re.split, re.compile — replace, split, and precompile patterns

re.sub(r'\d{3}-\d{3}-\d{4}', '***-***-****', text)

# Replace with a function — doubles every number found
re.sub(r'\d+', lambda m: str(int(m.group()) * 2), "price: 50, qty: 3")

# Replace with backreference — \1 and \2 refer to capture groups
re.sub(r'(\w+)@(\w+)', r'\2/\1', "user@host")

# Split on sentence-ending punctuation
re.split(r'[.!?]\s*', "Hello World. How are you? Fine!")
# Split on comma with optional surrounding spaces
re.split(r'\s*,\s*', "a , b , c")

# Compiled pattern — reuse for findall and sub
phone_pat = re.compile(r'\d{3}-\d{3}-\d{4}')
phone_pat.findall(text)
phone_pat.sub('REDACTED', text)
```

    Hello
    world
    HELLO
    price: 100, qty: 6
    host/user
    ['Hello World', 'How are you', 'Fine', '']
    ['a', 'b', 'c']
    []
    Hello
    world
    HELLO

#### Regex Syntax Reference

```python
# Regex syntax reference — characters, quantifiers, anchors, groups

syntax = r"""
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
  (?P<name>...) Named group           (?P=name) Backreference
  \1, \2    Backreference by number

  LOOKAROUND
  (?=...)   Lookahead (positive)      (?!...)  Lookahead (negative)
  (?<=...)  Lookbehind (positive)     (?<!...) Lookbehind (negative)

  CHARACTER CLASSES
  [abc]     Any of a, b, c            [^abc]  NOT a, b, c
  [a-z]     Range a through z         [a-zA-Z0-9]  Alphanumeric
  |         OR (alternation)
"""
syntax
```

    
      .         Any character (except newline)
      \d        Digit [0-9]              \D  Non-digit
      \w        Word char [a-zA-Z0-9_]   \W  Non-word
      \s        Whitespace [ \t\n\r]     \S  Non-whitespace
      \b        Word boundary             \B  Non-word boundary
    
      *         0 or more (greedy)        *?  0 or more (lazy)
      +         1 or more (greedy)        +?  1 or more (lazy)
      ?         0 or 1 (optional)         ??  0 or 1 (lazy)
      {n}       Exactly n                 {n,m}  Between n and m
      {n,}      n or more                 {n,m}? Between n and m (lazy)
    
      ^         Start of string/line      $   End of string/line
      \A        Start of string only      \Z  End of string only
    
      (...)     Capture group             (?:...)  Non-capture group
      (?P<name>...) Named group           (?P=name) Backreference
      \1, \2    Backreference by number
    
      (?=...)   Lookahead (positive)      (?!...)  Lookahead (negative)
      (?<=...)  Lookbehind (positive)     (?<!...) Lookbehind (negative)
    
      [abc]     Any of a, b, c            [^abc]  NOT a, b, c
      [a-z]     Range a through z         [a-zA-Z0-9]  Alphanumeric
      |         OR (alternation)

#### Regex Flags

```python
# Regex flags — IGNORECASE, MULTILINE, DOTALL, VERBOSE

text = "Hello\nworld\nHELLO"
re.findall(r'hello', text, re.IGNORECASE)   # IGNORECASE
re.findall(r'^\\w+', text, re.MULTILINE)   # MULTILINE
bool(re.search(r'Hello.world', text, re.DOTALL))  # . matches \n

# VERBOSE allows comments and whitespace in pattern
pattern = re.compile(r"""
    (\d{3})     # area code
    [-.]        # separator
    (\d{3})     # first 3 digits
    [-.]        # separator
    (\d{4})     # last 4 digits
""", re.VERBOSE)
pattern.findall('Call 123-456-7890')   # VERBOSE

# Combine flags
re.findall(r'^hello', text, re.IGNORECASE | re.MULTILINE)   # Combined
```

    IGNORECASE: ['Hello', 'HELLO']
    []
    True
    [('123', '456', '7890')]
    ['Hello', 'HELLO']

#### Common Regex Patterns

```python
# Common regex patterns — ready-to-use patterns for validation

patterns = {
    "email":          r'^[\w.+-]+@[\w-]+\.[\w.]+$',
    "URL":            r'https?://[\w./\-?=&#]+',
    "IPv4":           r'\b\d{1,3}(\.\d{1,3}){3}\b',
    "date YYYY-MM-DD":r'\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])',
    "time HH:MM":     r'(?:[01]\d|2[0-3]):[0-5]\d',
    "hex color":      r'^#[0-9a-fA-F]{6}$',
    "phone US":       r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
    "zip code US":    r'\d{5}(-\d{4})?',
    "strong password": r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$',
}
for name, pat in patterns.items():
    print(f"  {name:20}: {pat}")
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
