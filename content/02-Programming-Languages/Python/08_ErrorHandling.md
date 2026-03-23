---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [exceptions, try catch, error handling, custom exceptions, exception hierarchy]
keywords: [try, except, finally, raise, Exception, BaseException, custom exception, logging, contextmanager]
description: "Python error handling reference with executable examples and cell outputs — covers try/except/finally, exception hierarchy, custom exceptions, re-raising, and context managers. See [[cs-08_ErrorHandling]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[cs-08_ErrorHandling]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 08. Error Handling - Python

## 1. try / except / else / finally — The Basics


```python
# Error Handling — try/except/else/finally
#
# KEY CONCEPTS:
# - try: the block where an exception might be raised.
# - except: handles the exception. Multiple except clauses match top to bottom.
#   Put most specific exception types FIRST (same as C#).
# - else: runs ONLY if the try block did NOT raise an exception.
#   C# has no equivalent. Good for code that should only run on success.
# - finally: ALWAYS runs, exception or not. Used for cleanup.
# - raise: raise a new exception, or re-raise the current one.
# - C# equivalent: try/catch/finally (no 'else')

# === Basic try/except ===
print("=== Basic try/except ===")

try:
    arr = [1, 2, 3]
    print(arr[10])         # IndexError
except IndexError as e:
    # e.args[0]: the error message string
    # str(e): same, human-readable
    print(f"Caught: {e}")

# === Multiple except clauses — most specific FIRST ===
print("\n=== Multiple except clauses ===")

def parse_row(value, row_num):
    try:
        result = int(value)         # ValueError if not a valid int
        if result < 0:
            raise ValueError(f"Salary cannot be negative: {result}")
        print(f"  Row {row_num}: parsed {result}")
    except ValueError as e:
        # ValueError is more specific — must come before Exception
        print(f"  Row {row_num}: value error — {e}")
    except TypeError as e:
        print(f"  Row {row_num}: type error — {e}")
    except Exception as e:
        # Exception base class — catches anything not caught above
        # Avoid bare 'except:' — it catches SystemExit, KeyboardInterrupt too!
        print(f"  Row {row_num}: unexpected {type(e).__name__}: {e}")

parse_row("42", 1)           # ok
parse_row("not_a_number", 2) # ValueError
parse_row(-100, 3)           # ValueError (negative)
parse_row(None, 4)           # TypeError (int(None))

# === else — runs only if no exception ===
print("\n=== else (runs only on success) ===")
# C# has no equivalent. Use it to separate 'what might fail' from 'what to do on success'

def load_config(path):
    try:
        with open(path) as f:
            data = f.read()
    except FileNotFoundError:
        print(f"  Config not found: {path}")
        return None
    else:
        # Only runs if open() succeeded — avoids accidentally catching errors from here
        print(f"  Config loaded: {len(data)} bytes")
        return data
    finally:
        print(f"  Attempt to load: {path} (always runs)")

load_config("missing.json")

# === finally — always runs ===
print("\n=== finally ===")
# finally runs whether the try block succeeded OR raised an exception
# Use for: closing connections, releasing locks, logging

def process_with_cleanup(throw_error):
    print("  Opening resource...")
    try:
        print("  Processing...")
        if throw_error:
            raise RuntimeError("Something went wrong")
        print("  Done.")
    except RuntimeError as e:
        print(f"  Error caught: {e}")
    finally:
        # Runs even if except re-raises, or there's a return in try
        print("  Closing resource (finally)")

process_with_cleanup(False)
print()
process_with_cleanup(True)

# === raise vs raise from — exception chaining ===
print("\n=== raise vs raise from ===")
# raise              — re-raises current exception (preserves original traceback)
# raise X from Y     — chains: X caused by Y (sets __cause__). C#: throw new X(msg, inner)
# raise X from None  — suppresses chaining (hides the original exception)

def wrapper():
    try:
        int("bad_value")
    except ValueError as e:
        # Wrap with context — original stored in __cause__
        raise RuntimeError("Pipeline failed during validation") from e

try:
    wrapper()
except RuntimeError as e:
    print(f"  Outer: {e}")
    print(f"  Caused by: {e.__cause__}")  # __cause__ = the 'from' exception
```

    === Basic try/except ===
    Caught: list index out of range
    
    === Multiple except clauses ===
      Row 1: parsed 42
      Row 2: value error — invalid literal for int() with base 10: 'not_a_number'
      Row 3: value error — Salary cannot be negative: -100
      Row 4: type error — int() argument must be a string, a bytes-like object or a real number, not 'NoneType'
    
    === else (runs only on success) ===
      Config not found: missing.json
      Attempt to load: missing.json (always runs)
    
    === finally ===
      Opening resource...
      Processing...
      Done.
      Closing resource (finally)
    
      Opening resource...
      Processing...
      Error caught: Something went wrong
      Closing resource (finally)
    
    === raise vs raise from ===
      Outer: Pipeline failed during validation
      Caused by: invalid literal for int() with base 10: 'bad_value'
    

## 2. Exception Types & Hierarchy


```python
# Exception Types — what's raised and when
#
# Exception hierarchy (simplified):
#   BaseException
#   ├── SystemExit              # sys.exit() — DON'T catch with bare except
#   ├── KeyboardInterrupt       # Ctrl+C — DON'T catch with bare except
#   ├── GeneratorExit
#   └── Exception               # catch this (or subclasses)
#       ├── ValueError          # wrong value type/format  (C#: FormatException)
#       ├── TypeError           # wrong argument type      (C#: ArgumentException)
#       ├── KeyError            # dict key missing         (C#: KeyNotFoundException)
#       ├── IndexError          # list index out of range  (C#: IndexOutOfRangeException)
#       ├── AttributeError      # attribute doesn't exist  (C#: NullReferenceException)
#       ├── NameError           # variable not defined
#       ├── RuntimeError        # general runtime error    (C#: InvalidOperationException)
#       ├── StopIteration       # iterator exhausted
#       ├── NotImplementedError # abstract method          (C#: NotImplementedException)
#       ├── ArithmeticError
#       │   ├── ZeroDivisionError
#       │   └── OverflowError
#       └── OSError             # OS / file / IO errors   (C#: IOException)
#           ├── FileNotFoundError
#           ├── PermissionError
#           └── IsADirectoryError

# === Exception properties ===
print("=== Exception properties ===")

try:
    raise ValueError("salary must be positive", -500)
except ValueError as e:
    print(f"  str(e):       {str(e)}")           # human-readable
    print(f"  e.args:       {e.args}")           # tuple of constructor args
    print(f"  type(e):      {type(e).__name__}") # class name
    # e.__traceback__  — traceback object (call stack)
    # e.__cause__      — set by 'raise X from Y'
    # e.__context__    — set implicitly when raising inside except

# === Common exceptions in Data Engineering ===
print("\n=== Data Engineering exceptions ===")

# 1. ValueError — bad CSV values, invalid date strings, wrong data type in column
print("\n1. ValueError (bad value format)")
csv_row = ["Alice", "not_a_number", "2024-01-15"]
try:
    salary = int(csv_row[1])   # "not_a_number" can't be int
except ValueError as e:
    print(f"  Can't parse salary '{csv_row[1]}': {e}")
    # Use int(x) for expected-valid data, int.TryParse equivalent:
    salary = int(csv_row[1]) if csv_row[1].lstrip('-').isdigit() else 0
    print(f"  Safe fallback: {salary}")

# 2. KeyError — missing column in a dict-based row
print("\n2. KeyError (missing column)")
row = {"name": "Alice", "dept": "Engineering"}
try:
    salary = row["salary"]     # KeyError: 'salary'
except KeyError as e:
    # Use .get() to avoid this exception entirely:
    salary = row.get("salary", 0)  # default 0 if missing
    print(f"  Column {e} missing, defaulting to: {salary}")

# 3. TypeError — wrong data type passed to function
print("\n3. TypeError (wrong type)")
try:
    total = sum("not_a_list")  # type: ignore  # intentional — demonstrates TypeError
except TypeError as e:
    print(f"  Type error: {e}")

# 4. AttributeError — accessing a field on None (like NullReferenceException in C#)
print("\n4. AttributeError (None field)")
optional_field = None   # field was absent in source JSON/CSV
try:
    length = optional_field.upper()  # type: ignore  # intentional — demonstrates AttributeError
except AttributeError:
    # Better: guard with 'if' or use conditional expression
    length = optional_field.upper() if optional_field is not None else ""  # type: ignore
    print(f"  Safe None handling: '{length}'")

# 5. ZeroDivisionError — divide-by-zero in aggregation
print("\n5. ZeroDivisionError (empty group)")
def safe_avg(values):
    try:
        return sum(values) / len(values)
    except ZeroDivisionError:
        return None  # empty group — no average

print(f"  avg([10,20,30]): {safe_avg([10, 20, 30])}")
print(f"  avg([]):         {safe_avg([])}")

# 6. FileNotFoundError — missing input file
print("\n6. FileNotFoundError")
try:
    with open("missing_data.csv") as f:
        data = f.read()
except FileNotFoundError as e:
    print(f"  File missing: {e.filename}")
    # e.filename — the path that was not found
    # e.strerror — OS-level message ('No such file or directory')
    print(f"  OS message:   {e.strerror}")
except PermissionError as e:
    print(f"  Permission denied: {e.filename}")

# 7. Catching multiple exceptions in one clause
print("\n7. Catching multiple types in one clause")
def parse_numeric(value):
    try:
        return float(value)
    except (ValueError, TypeError):  # tuple of exception types
        return None

for v in ["3.14", "bad", None, "42"]:
    print(f"  parse_numeric({str(v)!r:8}) = {parse_numeric(v)}")
```

    === Exception properties ===
      str(e):       ('salary must be positive', -500)
      e.args:       ('salary must be positive', -500)
      type(e):      ValueError
    
    === Data Engineering exceptions ===
    
    1. ValueError (bad value format)
      Can't parse salary 'not_a_number': invalid literal for int() with base 10: 'not_a_number'
      Safe fallback: 0
    
    2. KeyError (missing column)
      Column 'salary' missing, defaulting to: 0
    
    3. TypeError (wrong type)
      Type error: unsupported operand type(s) for +: 'int' and 'str'
    
    4. AttributeError (None field)
      Safe None handling: ''
    
    5. ZeroDivisionError (empty group)
      avg([10,20,30]): 20.0
      avg([]):         None
    
    6. FileNotFoundError
      File missing: missing_data.csv
      OS message:   No such file or directory
    
    7. Catching multiple types in one clause
      parse_numeric('3.14'  ) = 3.14
      parse_numeric('bad'   ) = None
      parse_numeric('None'  ) = None
      parse_numeric('42'    ) = 42.0
    

## 3. Custom Exceptions


```python
# Custom Exceptions — when built-in types aren't descriptive enough
#
# KEY CONCEPTS:
# - Inherit from Exception (not BaseException — that's for system-level errors).
# - Add domain-specific attributes (row_number, file_name, column_name).
# - Call super().__init__(message) so str(e) works correctly.
# - Name ends in 'Error' by Python convention (C# uses 'Exception').
# - Use custom exceptions when the caller needs to distinguish your error,
#   or when you need to attach structured context.

from typing import Optional

# === Custom exception with context ===

# Data Engineering scenario: parsing a CSV row fails
class CsvParseError(Exception):
    """Raised when a CSV row cannot be parsed."""

    def __init__(self, row_number: int, column_name: str, raw_value: str,
                 cause: Optional[Exception] = None):  # Optional[Exception] = Exception | None
        self.row_number = row_number
        self.column_name = column_name
        self.raw_value = raw_value
        message = f"Row {row_number}: invalid value {raw_value!r} in column '{column_name}'" # !r = calls repr() on the value before inserting it into the string
        super().__init__(message)   # sets self.args[0] — makes str(e) work
        if cause:
            self.__cause__ = cause  # manually set cause (same as 'raise X from cause')


# Pipeline-level exception
class PipelineError(Exception):
    """Raised when an ETL pipeline stage fails."""

    def __init__(self, pipeline_name: str, stage: str, message: str,
                 cause: Optional[Exception] = None):
        self.pipeline_name = pipeline_name
        self.stage = stage
        full_message = f"[{pipeline_name}/{stage}] {message}"
        super().__init__(full_message)
        if cause:
            self.__cause__ = cause # __cause__ is the Python equivalent of C#'s InnerException


# === Using custom exceptions ===
print("=== Custom exceptions in a CSV parser ===")

def parse_salary(value: str, row_num: int) -> int:
    try:
        return int(value)
    except ValueError as e:
        # Wrap ValueError with context — caller knows which row and column failed
        raise CsvParseError(row_num, "salary", value, cause=e)


rows = ["Alice,95000", "Bob,not_a_number", "Charlie,110000"]

for i, row in enumerate(rows, start=1):
    parts = row.split(",")
    try:
        salary = parse_salary(parts[1], i)
        print(f"  Row {i}: {parts[0]} salary={salary:,}")
    except CsvParseError as e:
        # Caller can access structured attributes, not just a message string
        print(f"  SKIP row {e.row_number}: column '{e.column_name}' bad value {e.raw_value!r}")
        print(f"         Caused by: {e.__cause__}")

# === Exception chaining: raise X from Y ===
print("\n=== Exception chaining (raise from) ===")
# 'raise X from Y' sets X.__cause__ = Y
# Python prints both when the exception is unhandled: "The above exception was the direct cause..."
# C# equivalent: throw new X("msg", innerException)

def run_pipeline(name):
    try:
        raise CsvParseError(42, "amount", "$$$")
    except CsvParseError as e:
        # Wrap into pipeline-level error — preserves original as __cause__
        raise PipelineError(name, "transform", "Parse error in input file") from e

try:
    run_pipeline("sales_etl")
except PipelineError as e:
    print(f"  Pipeline: {e.pipeline_name}")
    print(f"  Stage:    {e.stage}")
    print(f"  Message:  {e}")
    # Unwrap chain: PipelineError → CsvParseError
    if isinstance(e.__cause__, CsvParseError):
        csv_e = e.__cause__
        print(f"  Root:     row {csv_e.row_number}, col '{csv_e.column_name}', value {csv_e.raw_value!r}")

# === Raise from None — suppress chaining ===
print("\n=== raise from None (hide internal details) ===")
# Use when the internal exception is an implementation detail
# the caller doesn't need to know about

class ConfigError(Exception):
    pass

def load_config(path):
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        # 'from None' hides the FileNotFoundError — caller just sees ConfigError
        raise ConfigError(f"Config file not found: {path}") from None

try:
    load_config("config.yaml")
except ConfigError as e:
    print(f"  {e}")
    print(f"  __cause__: {e.__cause__}")  # None — suppressed
```

    === Custom exceptions in a CSV parser ===
      Row 1: Alice salary=95,000
      SKIP row 2: column 'salary' bad value 'not_a_number'
             Caused by: invalid literal for int() with base 10: 'not_a_number'
      Row 3: Charlie salary=110,000
    
    === Exception chaining (raise from) ===
      Pipeline: sales_etl
      Stage:    transform
      Message:  [sales_etl/transform] Parse error in input file
      Root:     row 42, col 'amount', value '$$$'
    
    === raise from None (hide internal details) ===
      Config file not found: config.yaml
      __cause__: None
    

## 4. Context Managers: with & IDisposable equivalent


```python
# Context Managers — with statement
#
# KEY CONCEPTS:
# - Context manager: an object that defines __enter__ and __exit__ methods.
#   __enter__: called at start of 'with' block, returns the resource.
#   __exit__: called at end of block, EVEN if an exception occurred.
#   C# equivalent: IDisposable + 'using' statement.
# - 'with' is the standard way to ensure cleanup in Python.
# - contextlib: library of helpers for building context managers.
# - contextlib.suppress: silently ignore specific exception types.

import contextlib
import os
import tempfile

# === Basic with (file handling) ===
print("=== with statement (file handling) ===")

# Create a temp CSV file
tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
tmp.write("name,salary,dept\nAlice,95000,Engineering\nBob,65000,Sales")
tmp.close()

# File is automatically closed when 'with' block exits, even on exception
with open(tmp.name) as f:       # __enter__ opens the file, returns file object
    for line in f:
        print(f"  {line.rstrip()}")
# __exit__ closes the file here — no explicit f.close() needed

# === Multiple context managers in one with ===
print("\n=== Multiple context managers ===")

out_tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
out_tmp.close()

# Python 3: can combine multiple with items in one statement
with open(tmp.name) as src, open(out_tmp.name, 'w') as dst:
    header = src.readline().rstrip()          # read header from source
    dst.write(header + ",tax\n")              # write enriched header to dest
    for line in src:
        parts = line.rstrip().split(",")
        salary = int(parts[1])
        tax = salary * 0.3
        dst.write(f"{line.rstrip()},{tax:.0f}\n")

with open(out_tmp.name) as f:
    print(f"  Output: {f.read().strip()}")

# === What 'with' does under the hood ===
print("\n=== What 'with' does (manually) ===")
# with open(path) as f:
#     body
# is exactly equivalent to:
#
# mgr = open(path)
# f = mgr.__enter__()       ← setup: open file, connect to DB, etc.
# try:
#     body
# except:
#     if not mgr.__exit__(*sys.exc_info()):  # __exit__ can suppress the exception
#         raise                              # by returning True
# else:
#     mgr.__exit__(None, None, None)         ← teardown: close file, disconnect, etc.
print("  with open(f) as x: body  ≡  try: body finally: x.close()")

# === Building a custom context manager with @contextmanager ===
print("\n=== Custom context manager (@contextmanager) ===")

# @contextlib.contextmanager turns a generator function into a context manager.
# Everything BEFORE yield = __enter__ (setup).
# Everything AFTER yield  = __exit__  (teardown, always runs).
# The value passed to yield = what 'as' receives in the 'with' statement.
# C# equivalent: implementing IDisposable with a using block.

@contextlib.contextmanager
def csv_writer(path: str, header: list[str]):
    """Context manager that writes a CSV file, flushing on exit."""
    rows_written = 0
    f = open(path, 'w')         # __enter__ starts here
    try:
        f.write(",".join(header) + "\n")  # write header on open

        def write_row(*values):
            # write_row is a nested function — defined inside the context manager.
            # It is the value yielded, so 'as writer' in the with block = this function.
            # Calling writer(...) inside the with block executes write_row(...).
            nonlocal rows_written           # nonlocal: modify outer function's variable
            f.write(",".join(str(v) for v in values) + "\n")
            rows_written += 1

        yield write_row                     # hand control to 'with' block; write_row = 'as' value
    finally:
        # __exit__ starts here — runs when the 'with' block ends (normally or via exception)
        f.flush()                           # ensure all buffered data is written to disk
        f.close()                           # always close, even if body raised an exception
        print(f"  Closed: {path} ({rows_written} rows written)")

out2 = tempfile.NamedTemporaryFile(suffix='.csv', delete=False).name
with csv_writer(out2, ["name", "salary", "dept"]) as write:
    write("Alice", 95000, "Engineering")    # calls write_row("Alice", 95000, "Engineering")
    write("Bob", 65000, "Sales")
    write("Charlie", 110000, "Engineering")
# finally block runs here: f.flush(), f.close(), print rows written

# === contextlib.suppress — silently ignore specific exceptions ===
print("\n=== contextlib.suppress ===")
# Equivalent to: try: ... except SomeError: pass
# Use when you genuinely don't care if the operation fails

# Delete file if it exists, ignore if already gone
for f in [tmp.name, out_tmp.name, out2]:
    with contextlib.suppress(FileNotFoundError):
        os.unlink(f)    # os.unlink = os.remove — deletes the file from disk
                        # (not 'del f' which only removes the Python variable, not the file)
        print(f"  Deleted: {f}")

# === Building context manager as a class ===
print("\n=== Context manager as class ===")

# Class-based context manager: implement __enter__ and __exit__ directly.
# Use this when you need more control than @contextmanager provides
# (e.g. storing state, supporting inheritance, reuse across multiple with blocks).
# C# equivalent: class implementing IDisposable.

class DatabaseConnection:
    """Simulates a DB connection — C# equivalent of IDisposable."""

    def __init__(self, conn_string: str):
        # Called when the object is created — NOT when 'with' starts.
        # Store config only; don't connect yet.
        self.conn_string = conn_string
        self.connected = False

    def __enter__(self):
        # Called when the 'with' block starts.
        # Opens the connection and returns 'self' as the 'as' variable.
        # C# equivalent: the constructor body of a using-scoped object.
        print(f"  Connecting to {self.conn_string}...")
        self.connected = True
        return self     # 'with DatabaseConnection(...) as db' → db = self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Called when the 'with' block ends — normally OR via exception.
        # exc_type:  the exception class (e.g. ValueError), or None if no exception
        # exc_val:   the exception instance (e.g. ValueError("bad")), or None
        # exc_tb:    the traceback object, or None
        # C# equivalent: IDisposable.Dispose()
        print(f"  Disconnecting from {self.conn_string}")
        self.connected = False
        # Return True  → suppress the exception (swallow it, don't propagate)
        # Return False → let the exception propagate normally (almost always what you want)
        return False

    def execute(self, query: str):
        if not self.connected:
            raise RuntimeError("Not connected")
        print(f"  Query: {query}")

with DatabaseConnection("postgresql://localhost/mydb") as db:
    db.execute("SELECT * FROM employees LIMIT 3")
# __exit__ called here — connection always closed, even if execute() raised
```

    === with statement (file handling) ===
      name,salary,dept
      Alice,95000,Engineering
      Bob,65000,Sales
    
    === Multiple context managers ===
      Output: name,salary,dept,tax
    Alice,95000,Engineering,28500
    Bob,65000,Sales,19500
    
    === What 'with' does (manually) ===
      with open(f) as x: body  ≡  try: body finally: x.close()
    
    === Custom context manager (@contextmanager) ===
      Closed: C:\Users\aperi\AppData\Local\Temp\tmpo08jdx9q.csv (3 rows written)
    
    === contextlib.suppress ===
      Deleted: C:\Users\aperi\AppData\Local\Temp\tmpkresau1k.csv
      Deleted: C:\Users\aperi\AppData\Local\Temp\tmp5914n1lc.csv
      Deleted: C:\Users\aperi\AppData\Local\Temp\tmpo08jdx9q.csv
    
    === Context manager as class ===
      Connecting to postgresql://localhost/mydb...
      Query: SELECT * FROM employees LIMIT 3
      Disconnecting from postgresql://localhost/mydb
    

## 5. Data Engineering: Error Accumulation & Resilience Patterns


```python
# Data Engineering Error Patterns
#
# KEY PATTERNS:
# - Fail-fast: raise on first error. Good for dev/validation pipelines.
# - Accumulate errors: collect all errors, continue processing. Good for ETL.
# - Dead-letter: route bad records to a separate output, never discard silently.
# - Safe parse: use fallbacks (int(x) inside try or conditional) instead of bare int().
# - Retry: retry transient errors (network, DB) with exponential backoff.

import time
from dataclasses import dataclass, field
from typing import Optional

# === Safe parse helpers — avoid exceptions for expected bad data ===
print("=== Safe parse helpers ===")
# In a pipeline, bad data is EXPECTED — don't use exceptions for control flow
# Use try/except with a default or use conditional logic

def safe_int(value, default=None):
    """Like C# int.TryParse — returns default instead of raising."""
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

def safe_float(value, default=None):
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

from datetime import datetime
def safe_date(value, fmt="%Y-%m-%d", default=None):
    try:
        return datetime.strptime(value, fmt)
    except (ValueError, TypeError):
        return default

values = ["42", "bad", None, "", "3.14", "2024-01-15"]
for v in values:
    print(f"  safe_int({str(v)!r:12}) = {str(safe_int(v))!r:6}  "
          f"safe_date({str(v)!r:12}) = {safe_date(str(v) if v else v)}")

# === Error accumulation — collect all errors, don't stop on first ===
print("\n=== Error accumulation (ETL pattern) ===")

# @dataclass auto-generates __init__, __repr__, __eq__ from the field annotations.
# Without it, you'd need to write a full __init__ with self.name = name, self.salary = salary, etc.
# Ideal here because ParseResult is a simple data container — no methods, no logic,
# just fields to carry parse results around.
# C# equivalent: record ParseResult(string Name, int Salary, bool IsValid, string? Error);
@dataclass
class ParseResult:
    name: str = ""
    salary: int = 0
    is_valid: bool = True
    error: Optional[str] = None   # None if valid, error message string if invalid

def parse_employee(csv_line: str, row_num: int) -> ParseResult:
    parts = [p.strip() for p in csv_line.split(",")]

    if len(parts) < 2:
        return ParseResult(is_valid=False,
                           error=f"Row {row_num}: expected 2 columns, got {len(parts)}")

    salary = safe_int(parts[1])
    if salary is None:
        return ParseResult(is_valid=False,
                           error=f"Row {row_num}: invalid salary {parts[1]!r}")

    if salary < 0:
        return ParseResult(is_valid=False,
                           error=f"Row {row_num}: salary cannot be negative ({salary})")

    return ParseResult(name=parts[0], salary=salary)


input_rows = [
    "Alice, 95000",
    "Bob, not_a_number",   # bad salary
    "Charlie",             # missing salary column
    "Diana, 78000",
    "Eve, -500",           # negative salary
    "Frank, 72000",
]

results = [parse_employee(row, i + 1) for i, row in enumerate(input_rows)]
good = [r for r in results if r.is_valid]
bad  = [r for r in results if not r.is_valid]

print(f"  Processed: {len(results)} rows")
print(f"  Valid:     {len(good)}")
print(f"  Rejected:  {len(bad)}")
print("  Good records:")
for r in good:
    print(f"    {r.name:<10} ${r.salary:,}")
print("  Dead-letter (bad records):")
for r in bad:
    print(f"    ERROR: {r.error}")

# === Retry pattern for transient errors ===
print("\n=== Retry pattern (transient failures) ===")
# Network timeouts, DB deadlocks, rate limits — should be retried

def with_retry(operation, max_attempts=3, delay_s=0.1, exceptions=(Exception,)):
    """Retry an operation up to max_attempts times on specified exception types."""
    for attempt in range(1, max_attempts + 1):
        try:
            return operation()
        except exceptions as e:
            if attempt == max_attempts:
                raise  # re-raise on last attempt
            print(f"  Attempt {attempt} failed: {e}. Retrying...")
            time.sleep(delay_s * attempt)  # simple linear backoff

call_count = 0

def flaky_load():
    global call_count
    call_count += 1
    if call_count < 3:
        raise ConnectionError(f"Connection timeout (attempt {call_count})")
    return "data loaded successfully"

result = with_retry(flaky_load, exceptions=(ConnectionError,))
print(f"  Result after {call_count} attempts: {result}")

# === ExceptionGroup (Python 3.11+) — multiple errors from concurrent tasks ===
print("\n=== ExceptionGroup (Python 3.11+ parallel errors) ===")
# When running multiple tasks (asyncio.gather, concurrent.futures), collect all errors

import sys
if sys.version_info >= (3, 11):
    # ExceptionGroup wraps multiple exceptions from parallel operations
    # C# equivalent: AggregateException
    try:
        raise ExceptionGroup("pipeline errors", [
            ValueError("Bad value in file A"),
            IOError("File B not found"),
            ValueError("Bad value in file C"),
        ])
    except* ValueError as eg:   # except* catches a subgroup by type
        print(f"  ValueError group ({len(eg.exceptions)} errors):")
        for e in eg.exceptions:
            print(f"    - {e}")
    except* IOError as eg:
        print(f"  IOError group: {eg.exceptions[0]}")
else:
    print("  ExceptionGroup requires Python 3.11+ (skipped)")

# === C# vs Python cheat sheet ===
print("\n=== C# vs Python Error Handling ===")
print("""
C#                                    Python
──────────────────────────────────    ──────────────────────────────────
try { }                               try:
catch (FormatException ex) { }            except ValueError as e:
catch (IOException ex) { }               except IOError as e:
catch (Exception ex) { }                 except Exception as e:
finally { }                           finally:
                                      else:              ← C# has no 'else'
throw new X("msg");                   raise X("msg")
throw;                                raise              (re-raise current)
throw new X("msg", inner);            raise X("msg") from inner
                                      raise X from None  (suppress chain)
using (var r = new X()) { }          with X() as r:
int.TryParse(s, out int v)            safe_int(s)  / try: int(s) except ValueError
AggregateException                    ExceptionGroup     (Python 3.11+)
ex.InnerException                     e.__cause__ / e.__context__
ex.Data["key"] = value                e.args  / custom attributes on exception class
""")
```

    === Safe parse helpers ===
      safe_int('42'        ) = '42'    safe_date('42'        ) = None
      safe_int('bad'       ) = 'None'  safe_date('bad'       ) = None
      safe_int('None'      ) = 'None'  safe_date('None'      ) = None
      safe_int(''          ) = 'None'  safe_date(''          ) = None
      safe_int('3.14'      ) = 'None'  safe_date('3.14'      ) = None
      safe_int('2024-01-15') = 'None'  safe_date('2024-01-15') = 2024-01-15 00:00:00
    
    === Error accumulation (ETL pattern) ===
      Processed: 6 rows
      Valid:     3
      Rejected:  3
      Good records:
        Alice      $95,000
        Diana      $78,000
        Frank      $72,000
      Dead-letter (bad records):
        ERROR: Row 2: invalid salary 'not_a_number'
        ERROR: Row 3: expected 2 columns, got 1
        ERROR: Row 5: salary cannot be negative (-500)
    
    === Retry pattern (transient failures) ===
      Attempt 1 failed: Connection timeout (attempt 1). Retrying...
      Attempt 2 failed: Connection timeout (attempt 2). Retrying...
      Result after 3 attempts: data loaded successfully
    
    === ExceptionGroup (Python 3.11+ parallel errors) ===
      ValueError group (2 errors):
        - Bad value in file A
        - Bad value in file C
      IOError group: File B not found
    
    === C# vs Python Error Handling ===
    
    C#                                    Python
    ──────────────────────────────────    ──────────────────────────────────
    try { }                               try:
    catch (FormatException ex) { }            except ValueError as e:
    catch (IOException ex) { }               except IOError as e:
    catch (Exception ex) { }                 except Exception as e:
    finally { }                           finally:
                                          else:              ← C# has no 'else'
    throw new X("msg");                   raise X("msg")
    throw;                                raise              (re-raise current)
    throw new X("msg", inner);            raise X("msg") from inner
                                          raise X from None  (suppress chain)
    using (var r = new X()) { }          with X() as r:
    int.TryParse(s, out int v)            safe_int(s)  / try: int(s) except ValueError
    AggregateException                    ExceptionGroup     (Python 3.11+)
    ex.InnerException                     e.__cause__ / e.__context__
    ex.Data["key"] = value                e.args  / custom attributes on exception class
    
    
