---
title: "02 - Strings - Python"
tags:
  - python
aliases: [string manipulation, string formatting, regex, f-strings, string interpolation]
description: "Python strings reference with executable examples and cell outputs — covers string creation, indexing, slicing, methods, formatting, efficient building, and regular expressions. See [02-cs-strings](https://alp78.github.io/elysium/02-Programming-Languages/02-CSharp/02-cs-strings) for the C# equivalent."
created: 2026-03-22
updated: 2026-04-14
status: complete
---

# 02. Strings - Python

> [!quote] Matsumoto on string processing
>
> "In our daily lives as programmers, we process text strings a lot. So I tried to work hard on text processing, namely the string class and regular expressions."
>
> — **Yukihiro Matsumoto**, creator of Ruby

> [!abstract]- Summary
>
> Reference coverage for Python string representation, slicing semantics, transformation APIs, interpolation mechanisms, construction strategies, and regular-expression workflows.
>
> **String Creation & Basics**
> - `str` is Python's text type: an immutable Unicode code-point sequence with no separate `char`
> - Single, double, and triple quotes all create `str` objects; `r"..."` leaves backslashes uninterpreted
> - `str()` converts arbitrary objects; `*` repeats strings; empty strings are falsy and test cleanly with `if not s:`
> - String transformations allocate new objects; repeated `+=` in loops is O(n²), so use `"".join()` or `io.StringIO`
>
> **Indexing & Slicing**
> - Zero-based indexing and negative indexing from the end (`s[-1]` for the final character)
> - Slice syntax `s[start:stop:step]`: `stop` is exclusive; out-of-range silently clamped
> - `s[::-1]` reverses; direct `s[i]` raises `IndexError` for out-of-range
>
> **String Methods**
> - Case: `upper`, `lower`, `title`, `capitalize`, `swapcase`, `casefold` (Unicode-aware)
> - Whitespace/padding: `strip`, `lstrip`, `rstrip`, `ljust`, `rjust`, `center`, `zfill`
> - Content checks: `isalpha`, `isdigit`, `isdecimal`, `isnumeric`, `isspace`, `isidentifier`
> - Search: `find` (returns -1), `index` (raises), `rfind`, `count`, `startswith`, `endswith`
> - Replace/split/join: `replace`, `split`, `rsplit`, `splitlines`, `partition`, `join`, `expandtabs`
> - Encoding: `maketrans`/`translate` for character-level substitution; `encode`/`decode` for bytes
>
> **String Formatting**
> - f-strings (Python 3.6+): default choice for literal templates; expressions inside `{...}` evaluate at runtime
> - `str.format()`: positional/named placeholders; use when template is a variable
> - `%` operator: legacy C-style; still common in logging
> - Format specifiers: `:.2f`, `:,.2f`, `:.2e`, `:.1%`, `:b`, `:x`, `:#x`, `:<10`, `:>10`, `:^10`
> - Locale-aware currency formatting through `locale` is OS-dependent; prefer `babel` when portability matters
>
> **Efficient String Building**
> - `"".join()`: O(n), single allocation — use for any loop-based assembly
> - `io.StringIO`: incremental write interface analogous to C# `StringBuilder`
> - `+`: acceptable for 2–5 fixed parts only
>
> **Regular Expressions**
> - `re.search` scans whole string; `re.match` anchors to start; `re.fullmatch` requires full string
> - `re.findall` returns list; `re.finditer` yields match objects with position info
> - Capture groups `(...)`: `group(0)` = full match, `group(1)` = first group
> - Named groups `(?P<name>...)`: access via `group('name')` or `groupdict()`
> - `re.sub`: static, lambda, or backreference replacement; `re.split`: pattern-based tokenizing
> - `re.compile`: create reusable regex objects; common flags include `IGNORECASE`, `MULTILINE`, `DOTALL`, `VERBOSE`
>
> **Operational Safety**
> - Never use f-strings in SQL/shell — use parameterized queries or `shlex.quote()`
> - Always use raw strings `r"..."` for regex patterns to avoid escape conflicts
> - Use `casefold()` not `lower()` for Unicode-correct case-insensitive comparison
> - Use `babel` not `locale` for portable currency/number formatting in production

> [!note]- Glossary
>
> **`str`**
>
> - Python text type: immutable sequence of Unicode code points with no separate `char` type.
> - Used at every text boundary, including user input, JSON payloads, log messages, SQL parameters, and file paths.
> - A single character is still a `str` of length 1, and Python 3 string operations are Unicode-aware by default.
>
> ---
>
> **Immutability**
>
> - A `str` cannot be modified in place; item assignment such as `s[0] = "H"` raises `TypeError`.
> - Transformations allocate new string objects, which keeps strings safe for hashing, dict keys, and shared references.
> - Repeated `+=` inside loops copies the accumulated value on each iteration; use `"".join()` or `io.StringIO` for repeated assembly.
>
> ---
>
> **Indexing**
>
> - `s[i]` returns the character at a zero-based position and raises `IndexError` when the position is out of range.
> - Used for parsing, validation, prefix checks, and position-based extraction.
> - Python returns a one-character `str`, not a distinct `char` type.
>
> ---
>
> **Negative indexing**
>
> - Negative indices address positions from the end: `s[-1]` is the final character and `s[-2]` is the previous one.
> - This avoids explicit `len(s) - 1` arithmetic for suffix inspection and reverse traversal.
> - `s[-0]` is identical to `s[0]`; use `s[-1]` when you mean the last element.
>
> ---
>
> **Slicing**
>
> - `s[start:stop:step]` extracts a substring; `stop` is exclusive and omitted bounds use defaults.
> - Used for substrings, reversal (`s[::-1]`), and stride-based extraction.
> - Slice bounds are clamped rather than raising `IndexError`, unlike direct indexing.
>
> ---
>
> **`f-string`**
>
> - Formatted string literal in which expressions inside `{...}` are evaluated at runtime and may include format specifiers after `:`.
> - Preferred interpolation mechanism for literal templates in new Python code.
> - Do not use f-strings to build SQL or shell commands from untrusted data; use parameterized APIs instead.
>
> ---
>
> **`str.format()`**
>
> - Placeholder-based formatting with positional or named fields, for example `"{} {}".format(a, b)` or `"{name}".format(name="x")`.
> - Useful when the template string is stored in a variable rather than written as a literal.
> - Do not mix automatic field numbering (`{}`) with manual numbering (`{0}`); Python raises `ValueError`.
>
> ---
>
> **Format specifier**
>
> - Mini-language written after `:` inside a replacement field, for example `:.2f`, `:,.2f`, `:#x`, or `:.1%`.
> - Controls numeric precision, width, alignment, sign display, and radix formatting without manual string manipulation.
> - The colon is required between the expression and the specifier: `f"{n:.2f}"`, not `f"{n.2f}"`.
>
> ---
>
> **`join()`**
>
> - `separator.join(iterable)` assembles items into a single string and is invoked on the separator, not on the collection.
> - Standard O(n) construction pattern for repeated string assembly.
> - `parts.join(", ")` is incorrect because `list` has no `join`; write `", ".join(parts)`.
>
> ---
>
> **`io.StringIO`**
>
> - In-memory text buffer with `.write()`, `.getvalue()`, and context-manager support.
> - Useful when text is emitted incrementally rather than assembled from a ready-made list of fragments.
> - Use a context manager or close the buffer when the object has a clearly bounded lifetime.
>
> ---
>
> **Regular expression**
>
> - Pattern language used by the `re` module for matching, extracting, replacing, and splitting text.
> - Appropriate when fixed-string methods cannot express the validation or extraction rule precisely.
> - Regex patterns should usually be written as raw strings so backslashes reach the regex engine unchanged.
>
> ---
>
> **Capture group**
>
> - Parentheses `(...)` capture matched substrings for later retrieval through `match.group(n)`.
> - Used to extract structured components such as area codes, usernames, domains, or date parts.
> - `group(0)` is always the full match; numbered capture groups start at `1`.
>
> ---
>
> **Named group**
>
> - `(?P<name>...)` assigns a name to a capture group, retrievable through `match.group("name")` or `groupdict()`.
> - Improves readability when a pattern returns several structured fields.
> - Python requires the `?P<name>` syntax rather than C#'s `?<name>` form.
>
> ---
>
> **`re.compile`**
>
> - Compiles a pattern into a reusable regex object with methods such as `.search()`, `.findall()`, and `.sub()`.
> - Useful when the same pattern is applied repeatedly or shared across several operations.
> - Compilation happens at runtime; Python does not have a source-generated regex feature comparable to recent .NET releases.
>
> ---
>
> **Raw string**
>
> - `r"..."` tells Python not to interpret backslash escapes before the value reaches the next layer.
> - Essential for regex patterns and often clearer for Windows-style paths.
> - Raw strings cannot end with an odd number of trailing backslashes.
>
> ---
>
> **`casefold()`**
>
> - Unicode-aware normalization method intended for caseless comparison.
> - More aggressive than `lower()`, so values such as `"Straße"` normalize correctly for comparison.
> - Prefer `casefold()` over `lower()` whenever equality must remain correct across non-ASCII text.
>
> ---
>
> **Locale**
>
> - Operating-system-provided regional settings for numeric formatting, currency symbols, separators, and collation order.
> - Used through Python's `locale` module when output must follow a host system's regional conventions.
> - Locale identifiers and installed locales vary by operating system; use `babel` when formatting must be portable.

## String Creation & Basics

This section covers the fundamental building blocks of string handling in Python: literal syntax, type conversions, construction patterns, and the immutability guarantee that shapes how strings behave at runtime.

### Literals and declaration

Python strings are sequences of Unicode code points. Single quotes and double quotes are interchangeable; triple quotes create multiline strings; and the `r""` prefix disables escape processing.

#### Declare strings with single and double quotes

`str` is Python's only text type — there is no separate `char` type. A single character is simply a string of length 1. Single quotes (`'...'`) and double quotes (`"..."`) produce identical `str` objects. Choose whichever avoids internal escaping.

*This example imports the modules used later in the note and declares equivalent single-quoted and double-quoted strings.*

```python
import io
import re
import time
import locale

s1 = 'hello'
s2 = "hello"
print(repr(s1))
print(f"\"{s2}\"")
print(s1 == s2)
```

```text
'hello'
"hello"
True
```

#### Create multiline and raw strings

Triple-quoted strings (`"""..."""` or `'''...'''`) preserve embedded newlines. Raw strings (`r"..."`) treat backslashes as literal characters — essential for regex patterns and Windows file paths. Both can be combined (`r"""..."""`).

*This example creates triple-quoted multiline strings and raw strings, then prints their rendered values.*

```python
s3 = """This is
a multiline
string"""
s4 = '''Also works
with single
quotes'''
print(s3)
print()

s5 = r"C:\Users\new\test"
s6 = "C:\\Users\\new\\test"
print(s5)
print(s6)
print(s5 == s6)
```

```text
This is
a multiline
string

C:\Users\new\test
C:\Users\new\test
True
```

### Conversion and construction

Methods for converting other types to strings, assembling strings from parts, and checking for empty values.

#### Convert other types to string with str()

`str()` calls the object's `__str__` method (or `__repr__` as fallback) to produce a human-readable string representation. Unlike C#'s `ToString()`, `str(None)` returns the string `"None"` rather than throwing.

*This example converts common Python values to strings and prints their quoted representations.*

```python
print(repr(str(42)))
print(repr(str(3.14)))
print(repr(str(True)))
print(repr(str([1,2,3])))
print(repr(str(None)))
```

```text
'42'
'3.14'
'True'
'[1, 2, 3]'
'None'
```

#### Repeat and concatenate strings

The `*` operator repeats a string *n* times — a feature C# lacks. The `+` operator concatenates strings. The compiler does not optimize `+` in loops, so reserve it for small fixed concatenations.

*This example repeats a substring and concatenates a few fixed string literals with `+`.*

```python
print(repr('ha' * 3))
print(repr('hello' + ' ' + 'world'))
```

```text
'hahaha'
'hello world'
```

#### Check for empty strings and truthiness

Empty strings are falsy in Python — `bool('')` returns `False`. This means you can test for emptiness with `if not s:` instead of `if s == ""` or `if len(s) == 0`. Any non-empty string is truthy.

> [!tip] Idiomatic emptiness check
>
> Prefer `if not s:` over `if s == ""` or `if len(s) == 0`. The boolean test is the idiomatic Python convention and handles `None` gracefully when combined with `if not s:` (both `None` and `""` are falsy).

*This example checks an empty string by equality, length, and boolean truthiness.*

```python
empty = ""
print(empty == '')
print(len(empty))
print(bool(''))
print(bool('a'))
```

```text
True
0
False
True
```

### Immutability

The single most important property of Python strings — every operation that appears to modify a string actually allocates a new object and returns it. Understanding this shapes how you write performant string code.

#### Understand string immutability and its implications

Once a `str` is created, its character sequence cannot change. Item assignment (`s[0] = 'H'`) raises `TypeError`. Any transformation — `upper()`, `replace()`, slicing, or concatenation — allocates a new `str` on the heap. The original is unchanged and becomes eligible for garbage collection if no other reference points to it.

> [!warning] Anti-pattern — concatenation in loops
>
> Each `+=` in a loop creates a new string object, copying all previous characters. For *n* iterations this is O(n²) in both time and allocations. CPython may optimize simple cases, but this is not guaranteed.

> [!success] Correct pattern
>
> Use `"".join()` for loop-based construction, or `io.StringIO` for incremental writes. Reserve `+` for small, fixed concatenations (2–5 parts).

*This example rebuilds a string by slicing because Python strings cannot be modified in place.*

```python
s = "hello"
s = "H" + s[1:]
print(s)
```

```text
Hello
```

The diagram below shows what happens in memory. The variable `s` is reassigned to point to a new string object; the original `"hello"` is not modified — it becomes unreachable and is collected by the GC.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart LR
    subgraph Before["Before: s = 'hello'"]
        s1["s"] -->|points to| obj1["'hello'<br/>(heap)"]
    end
    subgraph After["After: s = 'H' + s[1:]"]
        s2["s"] -->|points to| obj2["'Hello'<br/>(new object)"]
        obj3["'hello'<br/>(unreachable → GC)"]
    end
    Before --> After
```

## Indexing & Slicing

Accessing individual characters and extracting substrings. Python uses 0-based indexing, negative indexing from the end, and slice syntax (`start:stop:step`) with full stride support — more powerful than C#'s Range syntax.

### Accessing characters and substrings

Direct character access by position, substring extraction via slicing, and stride patterns.

#### Access characters and substrings by index and slice

Python strings support 0-based indexing with `[]`, negative indexing from the end, and slice syntax `[start:stop:step]` with full stride support. Slicing never raises an exception — out-of-range indices are silently clamped.

> [!info] Indexing and slicing
>
> - `s[i]` — access by index (0-based)
> - `s[-1]` — last character (eliminates `len(s)-1`)
> - `s[a:b]` — slice from `a` to `b` (right-exclusive)
> - `s[::2]` — every 2nd char; `s[::-1]` — reverse
> - Slicing never raises `IndexError` — out-of-range indices are silently clamped
> - For pattern extraction, use regex or split instead of index math

*This example reads individual characters and common slices, including negative indices and reversed order.*

```python
s = "Hello, World!"
print(repr(s[0]))
print(repr(s[1]))
print(repr(s[-1]))
print(repr(s[-2]))
print(repr(s[0:5]))
print(repr(s[:5]))
print(repr(s[7:]))
print(repr(s[-6:]))
print(repr(s[::2]))
print(repr(s[::-1]))
print(repr(s[7:12]))
print(repr(s[2:10:2]))
```

```text
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
```

### Iterating characters and out-of-range behavior

Python slicing silently clamps out-of-range indices — no exception is raised. Direct indexing (`s[100]`) raises `IndexError`.

#### Handle out-of-range access and iterate characters

Slicing beyond the string length returns as many characters as available — `s[0:100]` returns the full string without error. Direct index access (`s[100]`) raises `IndexError`. Use `for ch in s` for simple iteration or `enumerate()` for index-value pairs (equivalent to C#'s LINQ `Select` with index).

> [!info] Slicing vs indexing — different error behavior
>
> `s[100]` raises `IndexError`, but `s[0:100]` silently returns the whole string. This is by design — slicing is intended to be forgiving, while indexing expects a valid position.

*This example shows slice clamping, iterates over characters, and prints indexes with `enumerate()`.*

```python
s = "Hello, World!"
print(repr(s[0:100]))

print(" ".join(s[:5]))

for i, ch in enumerate(s[:5]):
    print(f"  [{i}] = '{ch}'")
```

```text
'Hello, World!'
H e l l o
  [0] = 'H'
  [1] = 'e'
  [2] = 'l'
  [3] = 'l'
  [4] = 'o'
```

## String Methods

The built-in methods on `str` for transforming case, trimming whitespace, inspecting content, searching, splitting, joining, and encoding. All transformation methods return new strings — the original is never modified.

### Case conversion

Methods for changing letter case. Python provides `upper()`, `lower()`, `title()`, `capitalize()`, `swapcase()`, and `casefold()` — richer than C#'s set.

#### Convert case with upper, lower, title, capitalize, swapcase, casefold

Python provides six case-conversion methods. `upper()` and `lower()` convert all characters. `title()` capitalizes the first letter of each word, while `capitalize()` only capitalizes the first character of the string. `swapcase()` inverts case, and `casefold()` performs aggressive Unicode-aware lowering for case-insensitive comparison.

> [!info] Case methods
>
> - `casefold()` — more aggressive than `lower()`, handles Unicode (`"Straße"` → `"strasse"`)
> - Use `casefold()` for case-insensitive comparison, not `lower()`
> - `title()` / `capitalize()` — handle word boundaries automatically
> - All methods are Unicode-aware
> - For locale-sensitive rules (Turkish `i`), use the `locale` module

*This example applies the main case-conversion methods, including Unicode-aware `casefold()`.*

```python
s = "  Hello, World!  "

print(repr('hello world'.upper()))
print(repr('HELLO WORLD'.lower()))
print(repr('hello world'.title()))
print(repr('hello world'.capitalize()))
print(repr('Hello World'.swapcase()))
print(repr('Straße'.casefold()))
```

```text
'HELLO WORLD'
'hello world'
'Hello World'
'Hello world'
'hELLO wORLD'
'strasse'
```

### Whitespace and padding

Methods for stripping leading/trailing whitespace (or custom characters) and padding strings to a fixed width.

#### Trim with strip and pad with ljust, rjust, center, zfill

`strip()` removes whitespace from both ends; `lstrip()`/`rstrip()` from one side. Pass a string argument to strip specific characters. `ljust`/`rjust`/`center` pad to a target width — Python adds `center()` and `zfill()` which C# lacks natively.

*This example trims whitespace and pads strings with alignment and zero-fill helpers.*

```python
print(repr(s.strip()))
print(repr(s.lstrip()))
print(repr(s.rstrip()))
print(repr('Hello!!'.strip('!')))
print(repr('hello'.center(20)))
print(repr('hello'.center(20, '*')))
print(repr('hello'.ljust(20)))
print(repr('hello'.rjust(20)))
print(repr('42'.zfill(8)))
```

```text
'Hello, World!'
'Hello, World!  '
'  Hello, World!'
'Hello'
'       hello        '
'*******hello********'
'hello               '
'               hello'
'00000042'
```

### Character and content checks

Python provides built-in `str.isXxx()` methods — unlike C# where you must combine `char.IsXxx` with LINQ.

#### Test string content with isalpha, isdigit, isnumeric, and more

Python provides built-in `str.isXxx()` methods that return `True` if all characters satisfy the condition and the string is non-empty. Notable distinctions: `isnumeric()` is broader than `isdigit()` (it includes fractions like `½`), `isdecimal()` is the strictest (only `0-9`), and `isprintable()` returns `False` for control characters like `\n`.

> [!tip] isdigit vs isnumeric vs isdecimal
>
> `isdecimal()` accepts only `0-9` characters. `isdigit()` also accepts superscripts and subscripts. `isnumeric()` is the broadest — it includes fractions like `½` and Roman numerals. For parsing numbers, `isdecimal()` is usually what you want.

*This example runs the common string content-check methods and prints their boolean results.*

```python
checks = {
    "isalpha()":    "Hello",
    "isdigit()":    "12345",
    "isalnum()":    "Hello123",
    "isspace()":    "   ",
    "isupper()":    "HELLO",
    "islower()":    "hello",
    "istitle()":    "Hello World",
    "isascii()":    "Hello",
    "isnumeric()":  "½",
    "isdecimal()":  "12345",
    "isidentifier()": "my_var",
    "isprintable()":  "hello\n",
}
for method, example in checks.items():
    result = getattr(example, method.replace('()', ''))()
    safe = example.replace("\n", "\\n")
    print(f"'{safe:12}'.{method:18} = {result}")
```

```text
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
'hello\n     '.isprintable()      = False
```

### Search and location

Methods for finding substrings by position or existence.

#### Search with find, index, count, startswith, endswith

`find` returns the 0-based position of the first occurrence (or `-1` if not found). `index` is identical but raises `ValueError` instead of returning `-1`. `rfind`/`rindex` search from the right. `count` returns the number of non-overlapping occurrences. The `in` operator is the idiomatic way to check for substring existence.

*This example searches for substrings, counts matches, and compares `find()` with `index()`.*

```python
s = "Hello, World! Hello!"
print(s.find('Hello'))
print(s.find('Hello', 1))
print(s.rfind('Hello'))
print(s.find('Java'))
print(s.index('World'))
print(s.count('Hello'))
print(s.startswith('Hello'))
print(s.endswith('!'))
print('World' in s)
```

```text
0
14
14
-1
7
2
True
True
True
```

### Comparison and ordering

Python strings support direct comparison with `<`, `>`, `==` using lexicographic (Unicode code point) ordering — no explicit `Compare` method needed.

#### Compare strings for ordering

Python's comparison operators (`<`, `>`, `<=`, `>=`, `==`, `!=`) compare strings lexicographically by Unicode code point — equivalent to C#'s `StringComparison.Ordinal`. For locale-aware sorting (e.g., German ä near a), use `locale.strcoll`. For custom sort keys, use `functools.cmp_to_key`.

> [!info] C# parity
>
> Python's `<` operator is closest to ordinal string comparison in C#. There is no built-in case-insensitive comparison operator; use `s1.casefold() == s2.casefold()` when equality must be Unicode-correct.

*This example compares strings for lexical ordering, case sensitivity, and case-insensitive equality.*

```python
print("apple" < "banana")
print("banana" > "apple")
print("apple" == "apple")
print("hello" == "HELLO")
print("hello".casefold() == "HELLO".casefold())
```

```text
True
True
True
False
True
```

### Replace, split, and join

Methods for substituting substrings, tokenizing strings into arrays, and reassembling them. Python's `str.split()` and `str.join()` are richer than C#'s — with `rsplit`, `splitlines`, `partition`, and `expandtabs`.

#### Replace substrings and split strings

`replace` substitutes occurrences and accepts an optional max-count parameter (unlike C# which always replaces all). `split` tokenizes on a delimiter — with no arguments it splits on any whitespace and strips empties, equivalent to C#'s `Split(null, RemoveEmptyEntries)`. `rsplit` splits from the right. `splitlines` handles all line endings (`\n`, `\r\n`, `\r`). `partition`/`rpartition` split into exactly three parts `(before, sep, after)`.

*This example replaces substrings and splits text into lists and tuples with several string methods.*

```python
s = "  Hello, World!  "
print(repr(s.replace('Hello', 'Hi')))
print(repr(s.replace('Hello', 'Hi', 1)))

csv = "apple,banana,cherry"
print(csv.split(','))
print(csv.split(',', 1))

words = "  hello  world  "
print(words.split())
print(words.split(' '))

print(csv.rsplit(',', 1))

lines = "line1\nline2\nline3"
print(lines.splitlines())

print(csv.partition(','))
print(csv.rpartition(','))
```

```text
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
```

#### Rejoin strings with join and expandtabs

`str.join(iterable)` is called on the separator string, not on the list — the opposite of C#'s `string.Join(separator, collection)`. `expandtabs` replaces tab characters with spaces aligned to tab stops.

*This example rejoins a list of strings with different separators and expands tab characters to spaces.*

```python
parts = ["hello", "world", "python"]
print(repr(' '.join(parts)))
print(repr(', '.join(parts)))
print(repr('->'.join(parts)))
print(repr(''.join(parts)))

tab_str = "a\tb\tc"
print(repr(tab_str.expandtabs(4)))
```

```text
'hello world python'
'hello, world, python'
'hello->world->python'
'helloworldpython'
'a   b   c'
```

### Encoding and translation

Converting between strings and bytes, and performing character-level replacements.

#### Translate characters and encode to bytes

`str.maketrans` builds a translation table mapping characters to replacements (or `None` for deletion). `translate` applies the table in a single pass — faster than chained `replace` calls for multiple substitutions. `encode` converts a `str` to `bytes` using a specified codec; `bytes.decode` reverses the process.

> [!info] C# parity
>
> C# has no direct equivalent of `str.translate` or `str.maketrans`. The closest approaches are `Regex.Replace` with a character class or a manual loop with `StringBuilder`.

*This example translates characters with `maketrans()` and converts text to UTF-8 and ASCII bytes.*

```python
table = str.maketrans("aeiou", "12345")
print(repr('hello world'.translate(table)))

table2 = str.maketrans("", "", "aeiou")
print(repr('hello world'.translate(table2)))

print('hello'.encode('utf-8'))
print('hello'.encode('ascii'))
```

```text
'h2ll4 w4rld'
'hll wrld'
b'hello'
b'hello'
```

## String Formatting

Embedding values into strings and controlling how numbers, dates, and currencies are displayed. Python offers three mechanisms: f-strings (`f""`), `str.format()`, and the legacy `%` operator.

### Interpolation mechanisms

The three standard ways to embed values into strings.

#### Embed values with f-strings, format(), and % operator

> [!info] f-string syntax
>
> - `f"..."` embeds any expression in `{braces}`
> - Format specifiers: `f"{n:.2f}"` | method calls: `f"{s.upper()}"` | expressions: `f"{a + 1}"`
> - Prefer f-strings when the template is a literal in source code
> - Use `.format()` when the template string is stored dynamically

> [!danger] Injection risk
>
> Never use f-strings in SQL or shell commands — use parameterized queries. For logging, use `logger.info("msg %s", val)` for lazy evaluation.

> [!success] Correct pattern
>
> Use parameterized queries for SQL: `cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))`. For logging, use lazy `%s` formatting: `logger.info("User %s logged in", username)` — the string is only built if the log level is active.

f-strings (`f""`, Python 3.6+) are the preferred approach — any expression inside `{...}` is evaluated at runtime. `str.format()` uses numbered or named placeholders and is useful when the format string is stored in a variable. The `%` operator is the legacy C-style approach, still common in logging.

*This example formats the same values with f-strings, `str.format()`, and the legacy `%` operator.*

```python
name, age = "Alice", 30
n = 1234567.89123
pct = 0.856

print(f"Name: {name}, Age: {age}")
print(age + 1)
print(name.upper())

print("Name: {}, Age: {}".format(name, age))
print("Name: {0}, Age: {1}, {0} again".format(name, age))
print("Name: {n}, Age: {a}".format(n=name, a=age))

print("Name: %s, Age: %d, Pi: %.2f" % (name, age, 3.14))
```

```text
Name: Alice, Age: 30
31
ALICE
Name: Alice, Age: 30
Name: Alice, Age: 30, Alice again
Name: Alice, Age: 30
Name: Alice, Age: 30, Pi: 3.14
```

### Numeric format specifiers

Format specifiers inside f-string braces control numeric display: `{value:.2f}`, `{value:,.0f}`, `{value:#x}`.

#### Format numbers with f-string specifiers

The table below summarizes the specifiers used in the examples and the output they produce.

| Specifier | Meaning | Example |
|---|---|---|
| `.2f` | Fixed-point, 2 decimals | `1234567.89` |
| `,.2f` | Fixed with comma separator | `1,234,567.89` |
| `.2e` | Scientific notation | `1.23e+06` |
| `.4g` | General (compact) | `1.235e+06` |
| `.1%` | Percentage (multiplies by 100) | `85.6%` |
| `d` | Decimal integer | `255` |
| `b` | Binary | `11111111` |
| `o` | Octal | `377` |
| `x`/`X` | Hexadecimal lower/upper | `ff` / `FF` |
| `#x` | Hex with `0x` prefix | `0xff` |

*This example formats numbers with precision, grouping, scientific notation, percentages, and integer radix specifiers.*

```python
print(f"{n:.2f}")
print(f"{n:.0f}")
print(f"{n:,.2f}")
print(f"{n:.2e}")
print(f"{n:.4g}")
print(f"{pct:.1%}")

x = 255
print(f"{x:d}")
print(f"{x:b}")
print(f"{x:o}")
print(f"{x:x}")
print(f"{x:X}")
print(f"{x:#x}")
print(f"{x:08d}")
```

```text
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
```

### Alignment and locale currency

Controlling field width for tabular output and formatting numbers according to locale conventions.

#### Align strings and format currencies by locale

f-string alignment uses `<` (left), `>` (right), `^` (center) with an optional fill character. For locale-aware currency, Python's `locale` module depends on system locale availability. The `babel` library is more reliable and portable for production currency formatting.

*This example aligns text inside fixed-width fields and formats currency through `locale` and `babel` when available.*

```python
s = "hi"
print(repr(f"{s:<10}"))
print(repr(f"{s:>10}"))
print(repr(f"{s:^10}"))
print(repr(f"{s:*^10}"))
print(f"{42:+d}")
print(f"{42:d}")

try:
    locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
    print(locale.currency(1234567.89, grouping=True))
except:
    print("(locale not available)")

try:
    from babel.numbers import format_currency
    print(f"EUR: {format_currency(1234567.89, 'EUR', locale='de_DE')}")
    print(f"JPY: {format_currency(1234567.89, 'JPY', locale='ja_JP')}")
    print(f"BRL: {format_currency(1234567.89, 'BRL', locale='pt_BR')}")
except ImportError:
    print("(babel not installed — pip install babel)")
```

```text
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
```

## Efficient String Building

Strategies for building strings without the O(n²) penalty of repeated concatenation. `"".join()` for collections, `io.StringIO` for incremental writes, and `+` for small fixed concatenations.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    A["How many strings<br/>are you combining?"] --> B{"2–5 fixed parts?"}
    B -->|Yes| C["Use + or f-string<br/>Readable and fast"]
    B -->|No| D{"From a collection<br/>or generator?"}
    D -->|Yes| E["Use ''.join()<br/>Single allocation"]
    D -->|No| F{"Built incrementally<br/>in a loop?"}
    F -->|Yes| G["Use io.StringIO<br/>or list + join()"]
    F -->|No| H["Use ''.join()<br/>with generator expr"]
```

> [!warning] Don't use += in loops
>
> Each iteration copies the growing string into a new object. CPython may optimize simple cases, but this is not guaranteed. Always consider the building strategy for more than ~10 concatenations. For 2–5 concatenations, `+` is fine.

> [!success] Correct pattern
>
> Use `"".join(parts)` for O(n) string assembly: `result = "".join(str(i) for i in range(50000))`. For incremental writes, use `io.StringIO`: `buf = io.StringIO(); buf.write(...); result = buf.getvalue()`.

### join() and io.StringIO

Python's equivalents of C#'s `StringBuilder` and `string.Join`.

#### Compare += vs join() performance

The benchmark below demonstrates the difference: 50,000 `+=` operations are materially slower than a single `"".join()` call because `join` pre-calculates the final size and copies each part exactly once.

*This example times repeated `+=` concatenation against `"".join()` and reports a deterministic faster/slower comparison.*

```python
start = time.perf_counter()
result = ""
for i in range(50000):
    result += str(i)
t1 = time.perf_counter() - start

start = time.perf_counter()
result_join = "".join(str(i) for i in range(50000))
t2 = time.perf_counter() - start
print(f"+ in loop len={len(result)}")
print(f"join() len={len(result_join)}")
print(f"join faster? {t2 < t1}")
```

```text
+ in loop len=238890
join() len=238890
join faster? True
```

#### Build strings with io.StringIO and list accumulation

`io.StringIO` provides a file-like write interface for incremental string building — the Python equivalent of C#'s `StringBuilder`. Alternatively, accumulate parts in a `list` and call `"".join()` at the end. Generator expressions inside `join()` are the most concise pattern.

*This example builds strings with `io.StringIO`, a list plus `join()`, and a generator expression.*

```python
buf = io.StringIO()
buf.write("Hello")
buf.write(", ")
buf.write("World!")
buf.write(f" Number: {42}")
result = buf.getvalue()
print(repr(result))
buf.close()

parts = []
for i in range(5):
    parts.append(f"item_{i}")
result = ", ".join(parts)
print(repr(result))

result = ", ".join(f"item_{i}" for i in range(5))
print(repr(result))
```

```text
'Hello, World! Number: 42'
'item_0, item_1, item_2, item_3, item_4'
'item_0, item_1, item_2, item_3, item_4'
```

> [!info] C# parity — no zero-copy string slicing
>
> C# offers `ReadOnlySpan<char>` and `string.Create` for zero-allocation string processing. Python has no equivalent for text strings: every slice creates a new `str` object. `memoryview` applies to bytes, not to `str`.

#### Use + for small fixed concatenations

For 2–5 known parts, the `+` operator is perfectly readable and efficient. Python does not optimize `+` in loops, but for small fixed concatenations the overhead is negligible.

*This example concatenates a few fixed string parts with `+`, which is appropriate for small constant assemblies.*

```python
first = "Hello"
last = "World"
full = first + " " + last
print(repr(full))
```

```text
'Hello World'
```

## Regular Expressions

The `re` module provides pattern matching, extraction, replacement, and splitting. Always use raw strings (`r""`) for patterns to avoid double-escaping backslashes.

### Matching and capturing

Finding patterns in text and extracting matched groups.

#### Find matches with re.search, findall, finditer, match, fullmatch

`re.search` scans the entire string and returns the first match (or `None`). `re.findall` returns all non-overlapping matches as a list of strings. `re.finditer` yields match objects for iteration with position info. `re.match` only matches at the **start** of the string. `re.fullmatch` requires the **entire** string to match.

*This example searches text with the main `re` matching functions and prints the matches they return.*

```python
text = "Contact us at support@email.com or sales@company.org. Call 123-456-7890 or 987-654-3210."

match = re.search(r'\d{3}-\d{3}-\d{4}', text)
if match:
    print(f"Found: {match.group()} at [{match.start()}:{match.end()}]")

phones = re.findall(r'\d{3}-\d{3}-\d{4}', text)
emails = re.findall(r'[\w.+-]+@[\w-]+\.[\w.]+', text)
print(phones)
print(emails)

for m in re.finditer(r'\d{3}-\d{3}-\d{4}', text):
    print(f"  {m.group()} at [{m.start()}:{m.end()}]")

print(bool(re.match(r'Contact', text)))
print(bool(re.match(r'support', text)))
print(bool(re.fullmatch(r'\d+', '12345')))
print(bool(re.fullmatch(r'\d+', '123a5')))
```

```text
Found: 123-456-7890 at [59:71]
['123-456-7890', '987-654-3210']
['support@email.com', 'sales@company.org.']
  123-456-7890 at [59:71]
  987-654-3210 at [75:87]
True
False
True
False
```

#### Extract sub-matches with capture groups

Parentheses `(...)` create numbered capture groups accessible via `match.group(1)`, `match.group(2)`, etc. (`group(0)` is the full match). `match.groups()` returns all groups as a tuple. Named groups `(?P<name>...)` use the `P<>` syntax (unlike C#'s `<>`) and are accessed via `match.group('name')` or `match.groupdict()`.

*This example extracts numbered and named regex capture groups from a phone number and an email address.*

```python
match = re.search(r'(\d{3})-(\d{3})-(\d{4})', text)
if match:
    print(f"Full:     {match.group(0)}")
    print(f"Groups:   {match.groups()}")
    print(f"Area:     {match.group(1)}")

match = re.search(r'(?P<user>[\w.+-]+)@(?P<domain>[\w-]+\.[\w.]+)', text)
if match:
    print(f"User:     {match.group('user')}")
    print(f"Domain:   {match.group('domain')}")
    print(f"GroupDict:{match.groupdict()}")
```

```text
Full:     123-456-7890
Groups:   ('123', '456', '7890')
Area:     123
User:     support
Domain:   email.com
GroupDict:{'user': 'support', 'domain': 'email.com'}
```

### Replace, split, and compilation

Transforming text with pattern-based replacement, splitting on patterns, and pre-compiling for performance.

#### Replace, split, and compile regex patterns

`re.sub` substitutes matches — pass a string for static replacement, a lambda for dynamic transformation, or `\1`/`\2` backreferences for group rearrangement. `re.split` tokenizes on a pattern instead of a fixed delimiter. `re.compile` pre-compiles a pattern into a reusable object — the Python equivalent of C#'s `new Regex(..., Compiled)`.

*This example replaces matches, splits text by regex, and reuses a compiled pattern.*

```python
print(re.sub(r'\d{3}-\d{3}-\d{4}', '***-***-****', text))

print(re.sub(r'\d+', lambda m: str(int(m.group()) * 2), "price: 50, qty: 3"))

print(re.sub(r'(\w+)@(\w+)', r'\2/\1', "user@host"))

print(re.split(r'[.!?]\s*', "Hello World. How are you? Fine!"))
print(re.split(r'\s*,\s*', "a , b , c"))

phone_pat = re.compile(r'\d{3}-\d{3}-\d{4}')
print(phone_pat.findall(text))
print(phone_pat.sub('REDACTED', text))
```

```text
Contact us at support@email.com or sales@company.org. Call ***-***-**** or ***-***-****.
price: 100, qty: 6
host/user
['Hello World', 'How are you', 'Fine', '']
['a', 'b', 'c']
['123-456-7890', '987-654-3210']
Contact us at support@email.com or sales@company.org. Call REDACTED or REDACTED.
```

### Syntax reference

Quick-reference tables for regex syntax elements.

#### Regex syntax — characters, quantifiers, anchors, groups

A condensed reference for Python's `re` module syntax. Named groups use `(?P<name>...)` (with `P`) — unlike C#'s `(?<name>...)`.

```text
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
```

### Options and flags

`re` flags modify matching behavior. Combine multiple flags with bitwise OR (`|`).

#### Control matching with re flags

`re.IGNORECASE` enables case-insensitive matching. `re.MULTILINE` makes `^` and `$` match line boundaries. `re.DOTALL` makes `.` match newline characters. `re.VERBOSE` allows formatting patterns with whitespace and inline `#` comments for readability — the Python equivalent of C#'s `IgnorePatternWhitespace`.

*This example applies common regex flags such as `IGNORECASE`, `MULTILINE`, `DOTALL`, and `VERBOSE`.*

```python
text = "Hello\nworld\nHELLO"
print(re.findall(r'hello', text, re.IGNORECASE))
print(re.findall(r'^\w+', text, re.MULTILINE))
print(bool(re.search(r'Hello.world', text, re.DOTALL)))

pattern = re.compile(r"""
    (\d{3})     # area code
    [-.]        # separator
    (\d{3})     # first 3 digits
    [-.]        # separator
    (\d{4})     # last 4 digits
""", re.VERBOSE)
print(pattern.findall('Call 123-456-7890'))

print(re.findall(r'^hello', text, re.IGNORECASE | re.MULTILINE))
```

```text
['Hello', 'HELLO']
['Hello', 'world', 'HELLO']
True
[('123', '456', '7890')]
['Hello', 'HELLO']
```

> [!info] C# parity — no source-generated regex
>
> C# (.NET 7+) offers `[GeneratedRegex]` for compile-time regex generation. Python's `re.compile()` is the closest equivalent — it caches the compiled pattern at runtime. There is no build-time code generation for Python regex.

### Validation patterns

Ready-to-use validation patterns for frequently matched formats.

#### Common regex patterns for validation

The table below collects compact patterns that are frequently reused in validation helpers and data-cleaning code.

| Pattern | Regex |
|---|---|
| Email | `^[\w.+-]+@[\w-]+\.[\w.]+$` |
| URL | `https?://[\w./\-?=&#]+` |
| IPv4 | `\b\d{1,3}(\.\d{1,3}){3}\b` |
| Date (YYYY-MM-DD) | `\d{4}-(?:0[1-9]\|1[0-2])-(?:0[1-9]\|[12]\d\|3[01])` |
| Time (HH:MM) | `(?:[01]\d\|2[0-3]):[0-5]\d` |
| Hex color | `^#[0-9a-fA-F]{6}$` |
| Phone (US) | `\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}` |
| Zip code (US) | `\d{5}(-\d{4})?` |
| Strong password | `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$` |

*This example prints reusable regex patterns for common validation and extraction tasks.*

```python
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
    print(f"{name:20}: {pat}")
```

```text
email               : ^[\w.+-]+@[\w-]+\.[\w.]+$
URL                 : https?://[\w./\-?=&#]+
IPv4                : \b\d{1,3}(\.\d{1,3}){3}\b
date YYYY-MM-DD     : \d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])
time HH:MM          : (?:[01]\d|2[0-3]):[0-5]\d
hex color           : ^#[0-9a-fA-F]{6}$
phone US            : \(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}
zip code US         : \d{5}(-\d{4})?
strong password     : ^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$
```

## Workload Selection

Summarizes the workloads where Python's string model is a strong fit and the cases where allocation behavior or boundary handling becomes the limiting factor.

### Appropriate workloads

The table below identifies string-heavy workloads where Python's built-in APIs remain expressive and operationally efficient.

| Workload profile | Why Python fits |
|---|---|
| Text parsing and transformation | `split`, `strip`, `replace`, `translate`, and slicing cover the majority of routine text-cleaning operations with minimal ceremony. |
| Regex-centric extraction and validation | `re` plus raw strings and named groups provides compact pattern matching and field extraction. |
| Data cleaning in pipelines | Column normalization, whitespace cleanup, header parsing, and semi-structured record extraction map directly to the standard `str` API. |
| Template and report assembly | f-strings, format specifiers, and `join()` support fast iteration on textual output without external templating machinery. |

### Constraints and trade-offs

The next table highlights the cases where Python strings become a bottleneck or require stricter operational boundaries.

| Constraint | Impact | Preferred mitigation |
|---|---|---|
| High-throughput per-row string processing | Repeated allocations and interpreter overhead dominate in large hot loops. | Use vectorized string operations in Polars or Pandas, or move the hot path to a lower-level runtime. |
| Binary protocol parsing | Decoding too early adds overhead and can blur byte-level boundaries. | Keep the workload in `bytes` or `memoryview` until the text boundary is explicit. |
| Locale-dependent presentation | `locale` availability and locale names vary across hosts. | Use `babel` or keep formatting in the presentation layer. |
| Security-sensitive command assembly | Manual interpolation creates SQL, shell, or HTML injection risk. | Use parameterized APIs, argument vectors, or templating layers with explicit escaping rules. |

## Engineering Practices

These conventions consolidate the page's repeated guidance into one operational reference section.

### Core conventions

The table below captures the default choices that keep Python string code predictable in production.

| Practice | Operational rule | Benefit |
|---|---|---|
| Prefer f-strings for literal templates | Use `.format()` when the template string is dynamic and reserve `%` formatting for legacy logging interfaces. | Keeps interpolation concise without losing the cases where deferred formatting is required. |
| Use `casefold()` for caseless equality | Avoid `lower()` when text may contain non-ASCII characters. | Preserves Unicode-correct comparison semantics. |
| Use `"".join()` or `io.StringIO` for repeated assembly | Reserve `+` for a small fixed number of fragments. | Avoids quadratic copying and reduces allocation churn. |
| Compile reused regex patterns | Store hot-path or shared patterns in `re.compile()` objects. | Reduces repeated parsing and centralizes pattern maintenance. |
| Write regex as raw strings | Let backslashes reach the regex engine unchanged. | Prevents accidental Python escape processing. |
| Prefer semantic helpers over manual slicing | Use `removeprefix()`, `removesuffix()`, and `partition()` when their intent matches the task. | Improves readability and reduces off-by-one handling. |
| Prefer `babel` for portable locale formatting | Treat `locale` as a host-dependent integration surface. | Keeps presentation behavior consistent across environments. |

## Troubleshooting

Maps common string and regex failures to their immediate cause and the first corrective action.

### Diagnostic reference

| Problem | Cause | Fix |
|---|---|---|
| `TypeError: 'str' object does not support item assignment` | Tried `s[0] = 'H'` on an immutable string | Create a new string instead: `s = 'H' + s[1:]` |
| `IndexError: string index out of range` | Accessed `s[i]` where `i >= len(s)` | Use `s[i:i+1]` (returns empty string if out of range) or check bounds |
| `re.error: bad escape` | Used a normal string that altered or invalidated the regex escape before it reached the regex engine | Write the pattern as a raw string, for example `r"\bword\b"` |
| `AttributeError: 'list' object has no attribute 'join'` | Called `join()` on the list instead of the separator | Reverse: `", ".join(parts)` not `parts.join(", ")` |
| `UnicodeEncodeError` | Tried to encode a string with characters outside the target codec | Specify the correct encoding or use `errors='replace'`/`'ignore'` |
| `UnicodeDecodeError` | Tried to decode bytes with the wrong codec | Detect encoding with `chardet` or specify the correct codec |
| Case-insensitive match fails for non-ASCII | Used `lower()` instead of `casefold()` | Use `casefold()` for Unicode-aware comparison |
| `re.match` doesn't find pattern in middle of string | `match()` only checks the start of the string | Use `re.search()` to scan the entire string |
| Regex greedy match captures too much | `.*` is greedy by default — matches as much as possible | Use lazy quantifier `.*?` or be more specific with character classes |
| `locale.Error: unsupported locale setting` | Requested locale not installed on the system | Install the locale or use `babel` for portable formatting |

## Related Topics

- **Data Architecture: Serialization** — [Serialization Formats](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/serialization-formats) for when string encoding choices matter in data pipelines
