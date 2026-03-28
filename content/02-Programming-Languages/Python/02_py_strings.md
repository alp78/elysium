---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [string manipulation, string formatting, regex, f-strings, string interpolation]
keywords: [str, f-string, format, regex, re, split, join, strip, replace, slice, encode]
description: "Python strings reference with executable examples and cell outputs — covers string creation, indexing, slicing, methods, formatting, efficient building, and regular expressions. See [[02_cs_strings]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[02_cs_strings]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 02. Strings - Python

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
print(f"Single quotes:  '{s1}'")
print(f"Double quotes:  \"{s2}\"")
print(f"Same? {s1 == s2}")
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
print(f"Triple-quoted:\n{s3}")

# Raw strings — no escape processing
s5 = r"C:\Users\new\test"     # backslashes NOT interpreted
s6 = "C:\\Users\\new\\test"    # same result, but must escape
print(f"\nRaw string:     {s5}")
print(f"Escaped string: {s6}")
print(f"Same? {s5 == s6}")
```

    Triple-quoted:
    This is
    a multiline
    string
    
    Raw string:     C:\Users\new\test
    Escaped string: C:\Users\new\test
    Same? True

#### String from Other Types

```python
# Type-to-string conversion — str(), repetition, and empty checks

print(f"str(42):        '{str(42)}'")
print(f"str(3.14):      '{str(3.14)}'")
print(f"str(True):      '{str(True)}'")
print(f"str([1,2,3]):   '{str([1,2,3])}'")
print(f"str(None):      '{str(None)}'")

# String repetition and concatenation
print(f"'ha' * 3:       '{'ha' * 3}'")
print(f"'hello' + ' ' + 'world': '{'hello' + ' ' + 'world'}'")

# Empty string and truthiness
empty = ""
print(f"empty == '':    {empty == ''}")
print(f"len(empty):     {len(empty)}")
print(f"bool(''):       {bool('')}")       # False (falsy)
print(f"bool('a'):      {bool('a')}")      # True (truthy)
```

    str(42):        '42'
    str(3.14):      '3.14'
    str(True):      'True'
    str([1,2,3]):   '[1, 2, 3]'
    str(None):      'None'
    'ha' * 3:       'hahaha'
    'hello' + ' ' + 'world': 'hello world'
    empty == '':    True
    len(empty):     0
    bool(''):       False
    bool('a'):      True

#### String Immutability

```python
# String immutability — strings cannot be modified in place

s = 'H' + s[1:]  # must create a new string
print(f"Modified: {s}")
```

    Modified: Hello

## Indexing & Slicing

#### Indexing (0-based)

```python
# Indexing and slicing — s[i], s[-i], s[a:b], s[a:b:step]
#
# Technique: s[i] accesses by index (0-based). s[-1] is the last character.
#   s[a:b] slices from a to b (exclusive). s[::2] takes every 2nd char.
#   s[::-1] reverses the string. Slicing never raises IndexError.
#
# Benefits:
#   - Negative indexing eliminates len(s)-1 boilerplate
#   - Slices are forgiving — out-of-range indices are silently clamped
#   - Step parameter enables stride, reversal, and subsampling
#
# Anti-patterns:
#   - Forgetting slices are right-exclusive — s[0:5] is indices 0-4
#   - Using s[len(s)-1] instead of s[-1] — less Pythonic
#
# When to use:
#   - Extracting substrings, accessing characters, reversing strings
#
# When NOT to use:
#   - Pattern extraction — use regex or split instead of index math

#     0123456789...

print(f"s[0]:     '{s[0]}'")        # H
print(f"s[1]:     '{s[1]}'")        # e
print(f"s[-1]:    '{s[-1]}'")       # ! (last char)
print(f"s[-2]:    '{s[-2]}'")       # d (second to last)
print(f"s[0:5]:   '{s[0:5]}'")      # Hello (stop is exclusive)
print(f"s[:5]:    '{s[:5]}'")        # Hello (start defaults to 0)
print(f"s[7:]:    '{s[7:]}'")        # World! (stop defaults to end)
print(f"s[-6:]:   '{s[-6:]}'")       # orld! (negative index)
print(f"s[::2]:   '{s[::2]}'")      # Hlo ol! (every 2nd char)
print(f"s[::-1]:  '{s[::-1]}'")      # !dlroW ,olleH (reversed)
print(f"s[7:12]:  '{s[7:12]}'")     # World
print(f"s[2:10:2]:'{s[2:10:2]}'")   # lo o (slice with step)
```

    s[0]:     'H'
    s[1]:     'e'
    s[-1]:    '!'
    s[-2]:    'd'
    s[0:5]:   'Hello'
    s[:5]:    'Hello'
    s[7:]:    'World!'
    s[-6:]:   'World!'
    s[::2]:   'Hlo ol!'
    s[::-1]:  '!dlroW ,olleH'
    s[7:12]:  'World'
    s[2:10:2]:'lo o'

#### Out of Range & Iteration

```python
# Out-of-range behavior and character iteration

print(f"s[0:100]: '{s[0:100]}'")     # Hello, World! (no error!)
# print(s[100])                       # IndexError!

# Iterate over characters
print("Chars:", end=" ")
for ch in s[:5]:
    print(ch, end=" ")
print()

# Enumerate — index + character
print("Enumerated:")
for i, ch in enumerate(s[:5]):
    print(f"  [{i}] = '{ch}'")
```

    s[0:100]: 'Hello, World!'
    Chars: H e l l o 
    Enumerated:
      [0] = 'H'
      [1] = 'e'
      [2] = 'l'
      [3] = 'l'
      [4] = 'o'

## String Methods

#### Case Methods  — Case, Whitespace, Checking, Searching, Replacing

```python
# Case methods — upper, lower, title, capitalize, swapcase, casefold
#
# Technique: Built-in methods for case conversion. casefold() is more
#   aggressive than lower() — handles Unicode: "Strasse".casefold() = "strasse"
#   from German "Strasse". title() capitalizes first letter of each word.
#
# Benefits:
#   - casefold() is the correct way to do case-insensitive comparison
#   - title()/capitalize() handle word boundaries automatically
#   - All are Unicode-aware — work correctly with non-ASCII characters
#
# Anti-patterns:
#   - Using lower() for case-insensitive comparison — casefold() handles more Unicode
#   - Comparing upper() results — casefold() is designed for this purpose
#
# When to use:
#   - Display formatting, case-insensitive search, normalization
#
# When NOT to use:
#   - Locale-sensitive case rules — use locale module for Turkish i, etc.

s = "  Hello, World!  "

print(f"upper():       '{'hello world'.upper()}'")
print(f"lower():       '{'HELLO WORLD'.lower()}'")
print(f"title():       '{'hello world'.title()}'")
print(f"capitalize():  '{'hello world'.capitalize()}'")
print(f"swapcase():    '{'Hello World'.swapcase()}'")
print(f"casefold():    '{'Straße'.casefold()}'")       # aggressive lowercase for comparison
```

    upper():       'HELLO WORLD'
    lower():       'hello world'
    title():       'Hello World'
    capitalize():  'Hello world'
    swapcase():    'hELLO wORLD'
    casefold():    'strasse'

#### Whitespace & Padding

```python
# Whitespace and padding — strip, ljust, rjust, center, zfill

print(f"lstrip():      '{s.lstrip()}'")          # left only
print(f"rstrip():      '{s.rstrip()}'")          # right only
print(f"strip('!'):    '{'Hello!!'.strip('!')}'")  # strip specific chars
print(f"center(20):    '{'hello'.center(20)}'")
print(f"center(20,'*'):'{'hello'.center(20, '*')}'")
print(f"ljust(20):     '{'hello'.ljust(20)}'")
print(f"rjust(20):     '{'hello'.rjust(20)}'")
print(f"zfill(8):      '{'42'.zfill(8)}'")       # zero-pad numbers
```

    strip():       'Hello, World!'
    lstrip():      'Hello, World!  '
    rstrip():      '  Hello, World!'
    strip('!'):    'Hello'
    center(20):    '       hello        '
    center(20,'*'):'*******hello********'
    ljust(20):     'hello               '
    rjust(20):     '               hello'
    zfill(8):      '00000042'

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

print(f"find('Hello'):      {s.find('Hello')}")        # 0 (first occurrence)
print(f"find('Hello', 1):   {s.find('Hello', 1)}")     # 14 (start from index 1)
print(f"rfind('Hello'):     {s.rfind('Hello')}")       # 14 (last occurrence)
print(f"find('Java'):       {s.find('Java')}")         # -1 (not found)
print(f"index('World'):     {s.index('World')}")       # 7 (like find but raises ValueError)
print(f"count('Hello'):     {s.count('Hello')}")       # 2
print(f"startswith('Hello'):{s.startswith('Hello')}")
print(f"endswith('!'):      {s.endswith('!')}")
print(f"'World' in s:       {'World' in s}")            # True (membership)
```

    find('Hello'):      0
    find('Hello', 1):   14
    rfind('Hello'):     14
    find('Java'):       -1
    index('World'):     7
    count('Hello'):     2
    startswith('Hello'):True
    endswith('!'):      True
    'World' in s:       True

#### Replace, Split & Join

```python
# Replace, split, and join — substitution, tokenization, and reassembly

print(f"replace:           '{s.replace('Hello', 'Hi')}'")
print(f"replace(max=1):    '{s.replace('Hello', 'Hi', 1)}'")

csv = "apple,banana,cherry"

# split — split on delimiter; optional second arg limits number of splits
print(f"split(','):        {csv.split(',')}")
print(f"split(',', 1):     {csv.split(',', 1)}")

words = "  hello  world  "

# split() with no args splits on any whitespace and strips leading/trailing
print(f"split():           {words.split()}")

# split(' ') splits on exact space character, preserving empty strings
print(f"split(' '):        {words.split(' ')}")

# rsplit — like split but starts from the right
print(f"rsplit(',', 1):    {csv.rsplit(',', 1)}")

lines = "line1\nline2\nline3"

# splitlines — splits on line boundaries (\n, \r\n, \r, etc.)
print(f"splitlines():      {lines.splitlines()}")

# partition — splits into exactly (before, separator, after) on first occurrence
print(f"partition(','):    {csv.partition(',')}")

# rpartition — same but finds last occurrence
print(f"rpartition(','):   {csv.rpartition(',')}")

parts = ["hello", "world", "python"]

# join — concatenate iterable with separator between elements
print(f"' '.join():        '{' '.join(parts)}'")
print(f"', '.join():       '{', '.join(parts)}'")
print(f"'->'.join():       '{'->'.join(parts)}'")
print(f"''.join():         '{''.join(parts)}'")

tab_str = "a\tb\tc"

# expandtabs — replace tab characters with spaces aligned to tab stops
print(f"expandtabs(4):     '{tab_str.expandtabs(4)}'")
```

    replace:           '  Hi, World!  '
    replace(max=1):    '  Hi, World!  '
    split(','):        ['apple', 'banana', 'cherry']
    split(',', 1):     ['apple', 'banana,cherry']
    split():           ['hello', 'world']
    split(' '):        ['', '', 'hello', '', 'world', '', '']
    rsplit(',', 1):    ['apple,banana', 'cherry']
    splitlines():      ['line1', 'line2', 'line3']
    partition(','):    ('apple', ',', 'banana,cherry')
    rpartition(','):   ('apple,banana', ',', 'cherry')
    ' '.join():        'hello world python'
    ', '.join():       'hello, world, python'
    '->'.join():       'hello->world->python'
    ''.join():         'helloworldpython'
    expandtabs(4):     'a   b   c'

#### Translate & Encode

```python
# Translate and encode — character-level replacement and byte conversion

table = str.maketrans("aeiou", "12345")
print(f"translate(vowels): '{'hello world'.translate(table)}'")

# Remove characters
table2 = str.maketrans("", "", "aeiou")
print(f"remove vowels:     '{'hello world'.translate(table2)}'")

print(f"encode('utf-8'):   {'hello'.encode('utf-8')}")
print(f"encode('ascii'):   {'hello'.encode('ascii')}")
```

    translate(vowels): 'h2ll4 w4rld'
    remove vowels:     'hll wrld'
    encode('utf-8'):   b'hello'
    encode('ascii'):   b'hello'

## String Formatting

#### f-strings (recommended, Python 3.6+)

```python
# f-strings — inline expression embedding (Python 3.6+)
#
# Technique: f"..." embeds any expression in {braces}. Supports format
#   specifiers: f"{n:.2f}", method calls: f"{s.upper()}", and expressions:
#   f"{a + 1}". Also shows .format() and % operator for comparison.
#
# Benefits:
#   - Most readable — expressions are inline, no positional placeholders
#   - Any expression allowed: f"{len(items)}", f"{x if x else 'N/A'}"
#   - Faster than .format() — compiled to efficient bytecode
#
# Anti-patterns:
#   - .format() in new code when f-strings work — f-strings are cleaner
#   - f-strings in SQL or shell commands — injection risk
#   - %-formatting in new code — legacy, error-prone with tuple/dict
#
# When to use:
#   - f-strings for all new code; .format() when template is a variable
#
# When NOT to use:
#   - SQL/command strings — use parameterised queries
#   - Logging — use logger.info("msg %s", val) for lazy evaluation

name, age = "Alice", 30
n = 1234567.89123
pct = 0.856


print(f"Name: {name}, Age: {age}")
print(f"Expression: {age + 1}")
print(f"Method call: {name.upper()}")

print("Name: {}, Age: {}".format(name, age))
print("Name: {0}, Age: {1}, {0} again".format(name, age))  # reuse by index
print("Name: {n}, Age: {a}".format(n=name, a=age))          # named

print("Name: %s, Age: %d, Pi: %.2f" % (name, age, 3.14))
```

    Name: Alice, Age: 30
    Expression: 31
    Method call: ALICE
    Name: Alice, Age: 30
    Name: Alice, Age: 30, Alice again
    Name: Alice, Age: 30
    Name: Alice, Age: 30, Pi: 3.14

#### Numeric Format Specifiers

```python
# Numeric format specifiers — .2f, .2e, ,.2f, .1%, d, x, o, b

print(f"Fixed 2 dec:    {n:.2f}")
print(f"Fixed 0 dec:    {n:.0f}")
print(f"Comma sep:      {n:,.2f}")
print(f"Scientific:     {n:.2e}")
print(f"General:        {n:.4g}")
print(f"Percentage:     {pct:.1%}")

x = 255
print(f"Decimal:        {x:d}")
print(f"Binary:         {x:b}")
print(f"Octal:          {x:o}")
print(f"Hex lower:      {x:x}")
print(f"Hex upper:      {x:X}")
print(f"With prefix:    {x:#x}")
print(f"Zero-padded:    {x:08d}")
```

    Fixed 2 dec:    1234567.89
    Fixed 0 dec:    1234568
    Comma sep:      1,234,567.89
    Scientific:     1.23e+06
    General:        1.235e+06
    Percentage:     85.6%
    Decimal:        255
    Binary:         11111111
    Octal:          377
    Hex lower:      ff
    Hex upper:      FF
    With prefix:    0xff
    Zero-padded:    00000255

#### Alignment & Locale Currency

```python
# Alignment and locale currency — layout control and locale-aware output

s = "hi"
print(f"Left 10:        '{s:<10}'")
print(f"Right 10:       '{s:>10}'")
print(f"Center 10:      '{s:^10}'")
print(f"Fill char:      '{s:*^10}'")
print(f"Sign always:    {42:+d}")
print(f"Space for pos:  {42: d}")

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

    Left 10:        'hi        '
    Right 10:       '        hi'
    Center 10:      '    hi    '
    Fill char:      '****hi****'
    Sign always:    +42
    Space for pos:   42
    US:  $1,234,567.89
    EUR: 1.234.567,89 €
    JPY: ￥1,234,568
    BRL: R$ 1.234.567,89

## Efficient String Building

Strings are immutable — each `+=` copies the entire string. For *n* concatenations, this is O(n²) total work. Use `"".join()` or `io.StringIO` for O(n) string building.

> [!warning] Don't use `+=` in loops
> Each iteration copies the growing string into a new object. CPython may optimize simple cases, but this is not guaranteed. Always consider the building strategy for more than ~10 concatenations. For 2–5 concatenations, `+` is fine.

#### BAD: O(n²) — each + copies the entire string

```python
# Performance comparison — + in loop vs join()

start = time.perf_counter()
result = ""
for i in range(50000):
    result += str(i)
t1 = time.perf_counter() - start
print(f"+ in loop (50k):     {t1:.4f}s  len={len(result)}")

# GOOD: O(n) — join builds once
start = time.perf_counter()
result = "".join(str(i) for i in range(50000))
t2 = time.perf_counter() - start
print(f"join() (50k):        {t2:.4f}s  len={len(result)}")
print(f"join is {t1/t2:.1f}x faster")
```

    + in loop (50k):     0.0542s  len=238890
    join() (50k):        0.0037s  len=238890
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
print(f"Result: '{result}'")
buf.close()

parts = []
for i in range(5):
    parts.append(f"item_{i}")
result = ", ".join(parts)
print(f"Result: '{result}'")

result = ", ".join(f"item_{i}" for i in range(5))
print(f"Comprehension: '{result}'")
```

    Result: 'Hello, World! Number: 42'
    Result: 'item_0, item_1, item_2, item_3, item_4'
    Comprehension: 'item_0, item_1, item_2, item_3, item_4'

#### Small number of concatenations — readability wins

```python
# Small concatenation — + is fine for 2-5 strings

first = "Hello"
last = "World"
full = first + " " + last    # perfectly fine
print(f"Small concat: '{full}'")
print("Rule: use + for 2-5 strings, join() for loops/many strings")
```

    Small concat: 'Hello World'
    Rule: use + for 2-5 strings, join() for loops/many strings

## Regular Expressions

#### Regex setup — import and test text

```python
# Regex setup — declare test text for pattern matching demonstrations
#
# Technique: Define a multi-format test string containing emails, phone
#   numbers, and other patterns for regex demonstrations.
#
# Benefits:
#   - Single test string reused across all regex demo cells
#
# Anti-patterns:
#   - Re-declaring test data in every cell — wastes space
#
# When to use:
#   - When multiple cells demonstrate patterns on the same text
#
# When NOT to use:
#   - Self-contained cells — declare test data inline

text = "Contact us at support@email.com or sales@company.org. Call 123-456-7890 or 987-654-3210."
```

#### re.search() — First Match

```python
# re.search, re.findall, re.match — find patterns in text

match = re.search(r'\d{3}-\d{3}-\d{4}', text)
if match:
    print(f"Found: {match.group()} at [{match.start()}:{match.end()}]")

# re.findall — returns all non-overlapping matches as a list of strings
phones = re.findall(r'\d{3}-\d{3}-\d{4}', text)
emails = re.findall(r'[\w.+-]+@[\w-]+\.[\w.]+', text)
print(f"Phones: {phones}")
print(f"Emails: {emails}")

# re.finditer — like findall but yields match objects, giving access to position and groups
for m in re.finditer(r'\d{3}-\d{3}-\d{4}', text):
    print(f"  {m.group()} at [{m.start()}:{m.end()}]")

# re.match — only matches at the START of the string (unlike search)
print(f"match('Contact'): {bool(re.match(r'Contact', text))}")
print(f"match('support'): {bool(re.match(r'support', text))}")

# re.fullmatch — the entire string must match the pattern
print(f"fullmatch digits: {bool(re.fullmatch(r'\d+', '12345'))}")
print(f"fullmatch digits: {bool(re.fullmatch(r'\d+', '123a5'))}")
```

#### Capture Groups

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

#### Replace, Split & Compile

```python
# re.sub, re.split, re.compile — replace, split, and precompile patterns

print(re.sub(r'\d{3}-\d{3}-\d{4}', '***-***-****', text))

# Replace with a function — doubles every number found
print(re.sub(r'\d+', lambda m: str(int(m.group()) * 2), "price: 50, qty: 3"))

# Replace with backreference — \1 and \2 refer to capture groups
print(re.sub(r'(\w+)@(\w+)', r'\2/\1', "user@host"))

# Split on sentence-ending punctuation
print(re.split(r'[.!?]\s*', "Hello World. How are you? Fine!"))
# Split on comma with optional surrounding spaces
print(re.split(r'\s*,\s*', "a , b , c"))

# Compiled pattern — reuse for findall and sub
phone_pat = re.compile(r'\d{3}-\d{3}-\d{4}')
print(phone_pat.findall(text))
print(phone_pat.sub('REDACTED', text))
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
print(syntax)
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
      (?P<name>...) Named group           (?P=name) Backreference
      \1, \2    Backreference by number
    
      LOOKAROUND
      (?=...)   Lookahead (positive)      (?!...)  Lookahead (negative)
      (?<=...)  Lookbehind (positive)     (?<!...) Lookbehind (negative)
    
      CHARACTER CLASSES
      [abc]     Any of a, b, c            [^abc]  NOT a, b, c
      [a-z]     Range a through z         [a-zA-Z0-9]  Alphanumeric
      |         OR (alternation)

#### Regex Flags

```python
# Regex flags — IGNORECASE, MULTILINE, DOTALL, VERBOSE

text = "Hello\nworld\nHELLO"
print(f"IGNORECASE: {re.findall(r'hello', text, re.IGNORECASE)}")
print(f"MULTILINE:  {re.findall(r'^\\w+', text, re.MULTILINE)}")
print(f"DOTALL:     {bool(re.search(r'Hello.world', text, re.DOTALL))}")  # . matches \n

# VERBOSE allows comments and whitespace in pattern
pattern = re.compile(r"""
    (\d{3})     # area code
    [-.]        # separator
    (\d{3})     # first 3 digits
    [-.]        # separator
    (\d{4})     # last 4 digits
""", re.VERBOSE)
print(f"VERBOSE:    {pattern.findall('Call 123-456-7890')}")

# Combine flags
print(f"Combined:   {re.findall(r'^hello', text, re.IGNORECASE | re.MULTILINE)}")
```

    IGNORECASE: ['Hello', 'HELLO']
    MULTILINE:  []
    DOTALL:     True
    VERBOSE:    [('123', '456', '7890')]
    Combined:   ['Hello', 'HELLO']

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
