---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [string manipulation, string formatting, regex, f-strings, string interpolation]
keywords: [str, f-string, format, regex, re, split, join, strip, replace, slice, encode]
description: "Python strings reference with executable examples and cell outputs — covers string creation, indexing, slicing, methods, formatting, efficient building, and regular expressions. See [[cs-02_Strings]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[cs-02_Strings]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 02. Strings - Python

## 1. String Creation & Basics


```python
# String (str) - immutable sequence of Unicode characters
# In Python, there is NO separate char type — a single character is just a string of length 1

print("=== String Creation ===")
# Single quotes, double quotes — identical
s1 = 'hello'
s2 = "hello"
print(f"Single quotes:  '{s1}'")
print(f"Double quotes:  \"{s2}\"")
print(f"Same? {s1 == s2}")

# Triple quotes — multiline strings
s3 = """This is
a multiline
string"""
s4 = '''Also works
with single
quotes'''
print(f"\nTriple-quoted:\n{s3}")

# Raw strings — no escape processing
s5 = r"C:\Users\new\test"     # backslashes NOT interpreted
s6 = "C:\\Users\\new\\test"    # same result, but must escape
print(f"\nRaw string:     {s5}")
print(f"Escaped string: {s6}")
print(f"Same? {s5 == s6}")

# String from other types
print("\n=== String Conversion ===")
print(f"str(42):        '{str(42)}'")
print(f"str(3.14):      '{str(3.14)}'")
print(f"str(True):      '{str(True)}'")
print(f"str([1,2,3]):   '{str([1,2,3])}'")
print(f"str(None):      '{str(None)}'")

# String repetition and concatenation
print("\n=== Repetition & Concatenation ===")
print(f"'ha' * 3:       '{'ha' * 3}'")
print(f"'hello' + ' ' + 'world': '{'hello' + ' ' + 'world'}'")

# Empty string and truthiness
print("\n=== Empty String ===")
empty = ""
print(f"empty == '':    {empty == ''}")
print(f"len(empty):     {len(empty)}")
print(f"bool(''):       {bool('')}")       # False (falsy)
print(f"bool('a'):      {bool('a')}")      # True (truthy)

# String immutability
print("\n=== Immutability ===")
s = "hello"
# s[0] = 'H'  # TypeError! Strings are immutable
s = 'H' + s[1:]  # must create a new string
print(f"Modified: {s}")
```

    === String Creation ===
    Single quotes:  'hello'
    Double quotes:  "hello"
    Same? True
    
    Triple-quoted:
    This is
    a multiline
    string
    
    Raw string:     C:\Users\new\test
    Escaped string: C:\Users\new\test
    Same? True
    
    === String Conversion ===
    str(42):        '42'
    str(3.14):      '3.14'
    str(True):      'True'
    str([1,2,3]):   '[1, 2, 3]'
    str(None):      'None'
    
    === Repetition & Concatenation ===
    'ha' * 3:       'hahaha'
    'hello' + ' ' + 'world': 'hello world'
    
    === Empty String ===
    empty == '':    True
    len(empty):     0
    bool(''):       False
    bool('a'):      True
    
    === Immutability ===
    Modified: Hello
    

## 2. Indexing & Slicing


```python
# Indexing & Slicing
s = "Hello, World!"
#     0123456789...

print("=== Indexing (0-based) ===")
print(f"s[0]:     '{s[0]}'")        # H
print(f"s[1]:     '{s[1]}'")        # e
print(f"s[-1]:    '{s[-1]}'")       # ! (last char)
print(f"s[-2]:    '{s[-2]}'")       # d (second to last)

print("\n=== Slicing [start:stop:step] ===")
print(f"s[0:5]:   '{s[0:5]}'")      # Hello (stop is exclusive)
print(f"s[:5]:    '{s[:5]}'")        # Hello (start defaults to 0)
print(f"s[7:]:    '{s[7:]}'")        # World! (stop defaults to end)
print(f"s[-6:]:   '{s[-6:]}'")       # orld! (negative index)
print(f"s[::2]:   '{s[::2]}'")      # Hlo ol! (every 2nd char)
print(f"s[::-1]:  '{s[::-1]}'")      # !dlroW ,olleH (reversed)
print(f"s[7:12]:  '{s[7:12]}'")     # World
print(f"s[2:10:2]:'{s[2:10:2]}'")   # lo o (slice with step)

# Out of range — slicing is forgiving, indexing is not
print("\n=== Out of Range ===")
print(f"s[0:100]: '{s[0:100]}'")     # Hello, World! (no error!)
# print(s[100])                       # IndexError!

# Iterate over characters
print("\n=== Iteration ===")
print("Chars:", end=" ")
for ch in s[:5]:
    print(ch, end=" ")
print()

# Enumerate — index + character
print("Enumerated:")
for i, ch in enumerate(s[:5]):
    print(f"  [{i}] = '{ch}'")
```

    === Indexing (0-based) ===
    s[0]:     'H'
    s[1]:     'e'
    s[-1]:    '!'
    s[-2]:    'd'
    
    === Slicing [start:stop:step] ===
    s[0:5]:   'Hello'
    s[:5]:    'Hello'
    s[7:]:    'World!'
    s[-6:]:   'World!'
    s[::2]:   'Hlo ol!'
    s[::-1]:  '!dlroW ,olleH'
    s[7:12]:  'World'
    s[2:10:2]:'lo o'
    
    === Out of Range ===
    s[0:100]: 'Hello, World!'
    
    === Iteration ===
    Chars: H e l l o 
    Enumerated:
      [0] = 'H'
      [1] = 'e'
      [2] = 'l'
      [3] = 'l'
      [4] = 'o'
    

## 3. String Methods


```python
# String Methods — Case, Whitespace, Checking, Searching, Replacing

s = "  Hello, World!  "

# === Case Methods ===
print("=== Case Methods ===")
print(f"upper():       '{'hello world'.upper()}'")
print(f"lower():       '{'HELLO WORLD'.lower()}'")
print(f"title():       '{'hello world'.title()}'")
print(f"capitalize():  '{'hello world'.capitalize()}'")
print(f"swapcase():    '{'Hello World'.swapcase()}'")
print(f"casefold():    '{'Straße'.casefold()}'")       # aggressive lowercase for comparison

# === Whitespace Methods ===
print("\n=== Whitespace Methods ===")
print(f"strip():       '{s.strip()}'")           # both sides
print(f"lstrip():      '{s.lstrip()}'")          # left only
print(f"rstrip():      '{s.rstrip()}'")          # right only
print(f"strip('!'):    '{'Hello!!'.strip('!')}'")  # strip specific chars

# === Padding & Alignment ===
print("\n=== Padding & Alignment ===")
print(f"center(20):    '{'hello'.center(20)}'")
print(f"center(20,'*'):'{'hello'.center(20, '*')}'")
print(f"ljust(20):     '{'hello'.ljust(20)}'")
print(f"rjust(20):     '{'hello'.rjust(20)}'")
print(f"zfill(8):      '{'42'.zfill(8)}'")       # zero-pad numbers

# === Checking Methods (return bool) ===
print("\n=== Checking Methods ===")
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

# === Searching ===
print("\n=== Searching ===")
s = "Hello, World! Hello, Python!"
print(f"find('Hello'):      {s.find('Hello')}")        # 0 (first occurrence)
print(f"find('Hello', 1):   {s.find('Hello', 1)}")     # 14 (start from index 1)
print(f"rfind('Hello'):     {s.rfind('Hello')}")       # 14 (last occurrence)
print(f"find('Java'):       {s.find('Java')}")         # -1 (not found)
print(f"index('World'):     {s.index('World')}")       # 7 (like find but raises ValueError)
print(f"count('Hello'):     {s.count('Hello')}")       # 2
print(f"startswith('Hello'):{s.startswith('Hello')}")
print(f"endswith('!'):      {s.endswith('!')}")
print(f"'World' in s:       {'World' in s}")            # True (membership)

# === Replace ===
print("\n=== Replace ===")
print(f"replace:           '{s.replace('Hello', 'Hi')}'")
print(f"replace(max=1):    '{s.replace('Hello', 'Hi', 1)}'")  # replace only first

# === Splitting & Joining ===
print("\n=== Splitting & Joining ===")
csv = "apple,banana,cherry"
print(f"split(','):        {csv.split(',')}")
print(f"split(',', 1):     {csv.split(',', 1)}")         # split at most 1 time
words = "  hello  world  "
print(f"split():           {words.split()}")              # splits on any whitespace, strips
print(f"split(' '):        {words.split(' ')}")           # splits on exact space (keeps empty)
print(f"rsplit(',', 1):    {csv.rsplit(',', 1)}")         # split from right
lines = "line1\nline2\nline3"
print(f"splitlines():      {lines.splitlines()}")
print(f"partition(','):    {csv.partition(',')}")          # (before, sep, after) — first
print(f"rpartition(','):   {csv.rpartition(',')}")        # (before, sep, after) — last

# Join
parts = ["hello", "world", "python"]
print(f"' '.join():        '{' '.join(parts)}'")
print(f"', '.join():       '{', '.join(parts)}'")
print(f"'->'.join():       '{'->'.join(parts)}'")
print(f"''.join():         '{''.join(parts)}'")

# === Tab expansion & translation ===
print("\n=== Other Useful Methods ===")
tab_str = "a\tb\tc"
print(f"expandtabs(4):     '{tab_str.expandtabs(4)}'")
# maketrans + translate — character-level replacement
table = str.maketrans("aeiou", "12345")
print(f"translate(vowels): '{'hello world'.translate(table)}'")
# Remove characters
table2 = str.maketrans("", "", "aeiou")
print(f"remove vowels:     '{'hello world'.translate(table2)}'")

# encode
print(f"encode('utf-8'):   {'hello'.encode('utf-8')}")
print(f"encode('ascii'):   {'hello'.encode('ascii')}")
```

    === Case Methods ===
    upper():       'HELLO WORLD'
    lower():       'hello world'
    title():       'Hello World'
    capitalize():  'Hello world'
    swapcase():    'hELLO wORLD'
    casefold():    'strasse'
    
    === Whitespace Methods ===
    strip():       'Hello, World!'
    lstrip():      'Hello, World!  '
    rstrip():      '  Hello, World!'
    strip('!'):    'Hello'
    
    === Padding & Alignment ===
    center(20):    '       hello        '
    center(20,'*'):'*******hello********'
    ljust(20):     'hello               '
    rjust(20):     '               hello'
    zfill(8):      '00000042'
    
    === Checking Methods ===
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
    
    === Searching ===
    find('Hello'):      0
    find('Hello', 1):   14
    rfind('Hello'):     14
    find('Java'):       -1
    index('World'):     7
    count('Hello'):     2
    startswith('Hello'):True
    endswith('!'):      True
    'World' in s:       True
    
    === Replace ===
    replace:           'Hi, World! Hi, Python!'
    replace(max=1):    'Hi, World! Hello, Python!'
    
    === Splitting & Joining ===
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
    
    === Other Useful Methods ===
    expandtabs(4):     'a   b   c'
    translate(vowels): 'h2ll4 w4rld'
    remove vowels:     'hll wrld'
    encode('utf-8'):   b'hello'
    encode('ascii'):   b'hello'
    

## 4. String Formatting


```python
# String Formatting — all 3 methods + format specifiers
# (moved from 01_Basics and extended)

name, age = "Alice", 30
n = 1234567.89123
pct = 0.856

# === Three formatting methods ===
print("=== 1. f-strings (recommended, Python 3.6+) ===")
print(f"Name: {name}, Age: {age}")
print(f"Expression: {age + 1}")
print(f"Method call: {name.upper()}")

print("\n=== 2. .format() method ===")
print("Name: {}, Age: {}".format(name, age))
print("Name: {0}, Age: {1}, {0} again".format(name, age))  # reuse by index
print("Name: {n}, Age: {a}".format(n=name, a=age))          # named

print("\n=== 3. % formatting (legacy, avoid in new code) ===")
print("Name: %s, Age: %d, Pi: %.2f" % (name, age, 3.14))

# === Number format specifiers ===
print("\n=== Number Formatting ===")
print(f"Fixed 2 dec:    {n:.2f}")
print(f"Fixed 0 dec:    {n:.0f}")
print(f"Comma sep:      {n:,.2f}")
print(f"Scientific:     {n:.2e}")
print(f"General:        {n:.4g}")
print(f"Percentage:     {pct:.1%}")

# === Integer formatting ===
print("\n=== Integer Formatting ===")
x = 255
print(f"Decimal:        {x:d}")
print(f"Binary:         {x:b}")
print(f"Octal:          {x:o}")
print(f"Hex lower:      {x:x}")
print(f"Hex upper:      {x:X}")
print(f"With prefix:    {x:#x}")
print(f"Zero-padded:    {x:08d}")

# === Alignment & Padding ===
print("\n=== Alignment & Padding ===")
s = "hi"
print(f"Left 10:        '{s:<10}'")
print(f"Right 10:       '{s:>10}'")
print(f"Center 10:      '{s:^10}'")
print(f"Fill char:      '{s:*^10}'")
print(f"Sign always:    {42:+d}")
print(f"Space for pos:  {42: d}")

# === Currency with locale ===
print("\n=== Currency Formatting ===")
import locale
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

    === 1. f-strings (recommended, Python 3.6+) ===
    Name: Alice, Age: 30
    Expression: 31
    Method call: ALICE
    
    === 2. .format() method ===
    Name: Alice, Age: 30
    Name: Alice, Age: 30, Alice again
    Name: Alice, Age: 30
    
    === 3. % formatting (legacy, avoid in new code) ===
    Name: Alice, Age: 30, Pi: 3.14
    
    === Number Formatting ===
    Fixed 2 dec:    1234567.89
    Fixed 0 dec:    1234568
    Comma sep:      1,234,567.89
    Scientific:     1.23e+06
    General:        1.235e+06
    Percentage:     85.6%
    
    === Integer Formatting ===
    Decimal:        255
    Binary:         11111111
    Octal:          377
    Hex lower:      ff
    Hex upper:      FF
    With prefix:    0xff
    Zero-padded:    00000255
    
    === Alignment & Padding ===
    Left 10:        'hi        '
    Right 10:       '        hi'
    Center 10:      '    hi    '
    Fill char:      '****hi****'
    Sign always:    +42
    Space for pos:   42
    
    === Currency Formatting ===
    US:  $1,234,567.89
    EUR: 1.234.567,89 €
    JPY: ￥1,234,568
    BRL: R$ 1.234.567,89
    

## 5. Efficient String Building


```python
# Efficient String Building
# Strings are IMMUTABLE — each + creates a new string object
# For many concatenations, use join() or io.StringIO instead

import time
import io

# === Why + in a loop is slow ===
print("=== Performance: + vs join() ===")

# BAD: O(n²) — each + copies the entire string
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

# === io.StringIO — like C#'s StringBuilder ===
print("\n=== io.StringIO (Python's StringBuilder) ===")
buf = io.StringIO()
buf.write("Hello")
buf.write(", ")
buf.write("World!")
buf.write(f" Number: {42}")
result = buf.getvalue()
print(f"Result: '{result}'")
buf.close()

# === List accumulation pattern (most common) ===
print("\n=== List + join pattern (most Pythonic) ===")
parts = []
for i in range(5):
    parts.append(f"item_{i}")
result = ", ".join(parts)
print(f"Result: '{result}'")

# === List comprehension (even more Pythonic) ===
result = ", ".join(f"item_{i}" for i in range(5))
print(f"Comprehension: '{result}'")

# === When is + fine? ===
print("\n=== When + is fine ===")
# Small number of concatenations — readability wins
first = "Hello"
last = "World"
full = first + " " + last    # perfectly fine
print(f"Small concat: '{full}'")
print("Rule: use + for 2-5 strings, join() for loops/many strings")
```

    === Performance: + vs join() ===
    + in loop (50k):     0.0528s  len=238890
    join() (50k):        0.0030s  len=238890
    join is 17.4x faster
    
    === io.StringIO (Python's StringBuilder) ===
    Result: 'Hello, World! Number: 42'
    
    === List + join pattern (most Pythonic) ===
    Result: 'item_0, item_1, item_2, item_3, item_4'
    Comprehension: 'item_0, item_1, item_2, item_3, item_4'
    
    === When + is fine ===
    Small concat: 'Hello World'
    Rule: use + for 2-5 strings, join() for loops/many strings
    

## 6. Regular Expressions


```python
# Regular Expressions — comprehensive reference
import re

text = "Contact us at support@email.com or sales@company.org. Call 123-456-7890 or 987-654-3210."

# === Core Operations ===
print("=== re.search() — First Match ===")
match = re.search(r'\d{3}-\d{3}-\d{4}', text)
if match:
    print(f"Found: {match.group()} at [{match.start()}:{match.end()}]")

print("\n=== re.findall() — All Matches ===")
phones = re.findall(r'\d{3}-\d{3}-\d{4}', text)
emails = re.findall(r'[\w.+-]+@[\w-]+\.[\w.]+', text)
print(f"Phones: {phones}")
print(f"Emails: {emails}")

print("\n=== re.finditer() — Match Objects ===")
for m in re.finditer(r'\d{3}-\d{3}-\d{4}', text):
    print(f"  {m.group()} at [{m.start()}:{m.end()}]")

print("\n=== re.match() — Match at START only ===")
print(f"match('Contact'): {bool(re.match(r'Contact', text))}")    # True
print(f"match('support'): {bool(re.match(r'support', text))}")    # False (not at start)

print("\n=== re.fullmatch() — Entire string ===")
print(f"fullmatch digits: {bool(re.fullmatch(r'\d+', '12345'))}")  # True
print(f"fullmatch digits: {bool(re.fullmatch(r'\d+', '123a5'))}")  # False

# === Groups ===
print("\n=== Groups — Capture Parts ===")
match = re.search(r'(\d{3})-(\d{3})-(\d{4})', text)
if match:
    print(f"Full:     {match.group(0)}")
    print(f"Groups:   {match.groups()}")
    print(f"Area:     {match.group(1)}")

# Named groups
match = re.search(r'(?P<user>[\w.+-]+)@(?P<domain>[\w-]+\.[\w.]+)', text)
if match:
    print(f"User:     {match.group('user')}")
    print(f"Domain:   {match.group('domain')}")
    print(f"GroupDict:{match.groupdict()}")

# === Replace ===
print("\n=== re.sub() — Replace ===")
print(re.sub(r'\d{3}-\d{3}-\d{4}', '***-***-****', text))
# Replace with function
print(re.sub(r'\d+', lambda m: str(int(m.group()) * 2), "price: 50, qty: 3"))
# Replace with backreference
print(re.sub(r'(\w+)@(\w+)', r'\2/\1', "user@host"))

# === Split ===
print("\n=== re.split() ===")
print(re.split(r'[.!?]\s*', "Hello World. How are you? Fine!"))
print(re.split(r'\s*,\s*', "a , b , c"))   # split on comma with optional spaces

# === Compile ===
print("\n=== re.compile() — Precompile for reuse ===")
phone_pat = re.compile(r'\d{3}-\d{3}-\d{4}')
print(phone_pat.findall(text))
print(phone_pat.sub('REDACTED', text))
```

    === re.search() — First Match ===
    Found: 123-456-7890 at [59:71]
    
    === re.findall() — All Matches ===
    Phones: ['123-456-7890', '987-654-3210']
    Emails: ['support@email.com', 'sales@company.org.']
    
    === re.finditer() — Match Objects ===
      123-456-7890 at [59:71]
      987-654-3210 at [75:87]
    
    === re.match() — Match at START only ===
    match('Contact'): True
    match('support'): False
    
    === re.fullmatch() — Entire string ===
    fullmatch digits: True
    fullmatch digits: False
    
    === Groups — Capture Parts ===
    Full:     123-456-7890
    Groups:   ('123', '456', '7890')
    Area:     123
    User:     support
    Domain:   email.com
    GroupDict:{'user': 'support', 'domain': 'email.com'}
    
    === re.sub() — Replace ===
    Contact us at support@email.com or sales@company.org. Call ***-***-**** or ***-***-****.
    price: 100, qty: 6
    host/user
    
    === re.split() ===
    ['Hello World', 'How are you', 'Fine', '']
    ['a', 'b', 'c']
    
    === re.compile() — Precompile for reuse ===
    ['123-456-7890', '987-654-3210']
    Contact us at support@email.com or sales@company.org. Call REDACTED or REDACTED.
    


```python
# Regex Syntax Reference & Flags
import re

print("=== Regex Syntax Reference ===")
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

# === Flags ===
print("=== Regex Flags ===")
text = "Hello\nworld\nHELLO"
print(f"IGNORECASE: {re.findall(r'hello', text, re.IGNORECASE)}")
print(f"MULTILINE:  {re.findall(r'^\\w+', text, re.MULTILINE)}")
print(f"DOTALL:     {bool(re.search(r'Hello.world', text, re.DOTALL))}")  # . matches \n
print("VERBOSE:")
# VERBOSE allows comments and whitespace in pattern
pattern = re.compile(r"""
    (\d{3})     # area code
    [-.]        # separator
    (\d{3})     # first 3 digits
    [-.]        # separator
    (\d{4})     # last 4 digits
""", re.VERBOSE)
print(f"  {pattern.findall('Call 123-456-7890')}")

# Combine flags
print(f"Combined:   {re.findall(r'^hello', text, re.IGNORECASE | re.MULTILINE)}")

# === Common Real-World Patterns ===
print("\n=== Common Patterns ===")
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
      (?P<name>...) Named group           (?P=name) Backreference
      \1, \2    Backreference by number
    
      LOOKAROUND
      (?=...)   Lookahead (positive)      (?!...)  Lookahead (negative)
      (?<=...)  Lookbehind (positive)     (?<!...) Lookbehind (negative)
    
      CHARACTER CLASSES
      [abc]     Any of a, b, c            [^abc]  NOT a, b, c
      [a-z]     Range a through z         [a-zA-Z0-9]  Alphanumeric
      |         OR (alternation)
    
    === Regex Flags ===
    IGNORECASE: ['Hello', 'HELLO']
    MULTILINE:  []
    DOTALL:     True
    VERBOSE:
      [('123', '456', '7890')]
    Combined:   ['Hello', 'HELLO']
    
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
    
