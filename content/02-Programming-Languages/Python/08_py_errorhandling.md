---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [exceptions, try catch, error handling, custom exceptions, exception hierarchy]
keywords: [try, except, finally, raise, Exception, BaseException, custom exception, logging, contextmanager]
description: "Python error handling reference with executable examples and cell outputs — covers try/except/finally, exception hierarchy, custom exceptions, re-raising, and context managers. See [[08_cs_errorhandling]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[08_cs_errorhandling]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 08. Error Handling - Python

## try / except / else / finally

#### Basic try / except

Wrap risky code in `try:` and catch specific exception types with `except ExceptionType as e:`. Unmatched exceptions propagate up the call stack. Use for I/O operations, parsing external data, and network calls — not for expected conditions (use `if`/`else`, `.get()`, or LBYL checks instead).

> [!warning] Anti-patterns
> - **Bare `except:`** — catches everything including `KeyboardInterrupt`
> - **`except Exception` with `pass`** — silently swallows all errors
> - **Exceptions for flow control** — slow; use `if`/`else` instead

```python
# Basic try/except — wrap risky code in try; except handles specific exception types
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import contextlib
import os
import sys
import tempfile
import time
try:
    arr = [1, 2, 3]
    print(arr[10])         # IndexError
except IndexError as e:
    print(f"Caught: {e}")
```

    Caught: list index out of range

> [!danger] Bare `except:` catches KeyboardInterrupt and SystemExit
> A bare `except:` (no exception type) catches *everything* including `KeyboardInterrupt` and `SystemExit`, making your program impossible to kill with Ctrl+C. Always catch `Exception` at broadest, and only when you re-raise or log.

> [!warning] Logging exceptions — always use `exc_info=True`
> `logging.error(f"Failed: {e}")` loses the traceback. Use `logging.exception("msg")` or `logging.error("msg", exc_info=True)` to capture the full stack trace in logs. Without the traceback, production debugging is nearly impossible.

#### Multiple except clauses

```python
# Multiple except clauses — match most specific exception first

def parse_row(value, row_num):
    try:
        result = int(value)
        if result < 0:
            raise ValueError(f"Salary cannot be negative: {result}")
        print(f"  Row {row_num}: parsed {result}")
    except ValueError as e:
        print(f"  Row {row_num}: value error — {e}")
    except TypeError as e:
        print(f"  Row {row_num}: type error — {e}")
    except Exception as e:
        print(f"  Row {row_num}: unexpected {type(e).__name__}: {e}")

parse_row("42", 1)           # ok
parse_row("not_a_number", 2) # ValueError
parse_row(-100, 3)           # ValueError (negative)
parse_row(None, 4)           # TypeError (int(None))
```

      Row 1: parsed 42
      Row 2: value error — invalid literal for int() with base 10: 'not_a_number'
      Row 3: value error — Salary cannot be negative: -100
      Row 4: type error — int() argument must be a string, a bytes-like object or a real number, not 'NoneType'

#### else and finally

```python
# else — runs only when try succeeds (no exception raised)

def load_config(path):
    try:
        with open(path) as f:
            data = f.read()
    except FileNotFoundError:
        print(f"  Config not found: {path}")
        return None
    else:
        print(f"  Config loaded: {len(data)} bytes")
        return data
    finally:
        print(f"  Attempt to load: {path} (always runs)")

load_config("missing.json")
```

      Config not found: missing.json
      Attempt to load: missing.json (always runs)

#### finally — guaranteed cleanup even on exception

```python
# finally — cleanup pattern that always runs

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
        print("  Closing resource (finally)")

process_with_cleanup(False)
print()
process_with_cleanup(True)
```

      Opening resource...
      Processing...
      Done.
      Closing resource (finally)

      Opening resource...
      Processing...
      Error caught: Something went wrong
      Closing resource (finally)

#### raise vs raise from — exception chaining

> [!warning] Always use `raise ... from e` when wrapping exceptions
> Plain `raise NewException("msg")` inside an `except` block sets `__context__` (implicit chaining) but not `__cause__`. Use `raise NewException("msg") from e` to explicitly link the cause. Use `raise ... from None` to deliberately suppress the chain when internal details should be hidden from callers.

```python
# raise from — exception chaining preserving the original cause

def wrapper():
    try:
        int("bad_value")
    except ValueError as e:
        raise RuntimeError("Pipeline failed during validation") from e

try:
    wrapper()
except RuntimeError as e:
    print(f"  Outer: {e}")
    print(f"  Caused by: {e.__cause__}")
```

      Outer: Pipeline failed during validation
      Caused by: invalid literal for int() with base 10: 'bad_value'

## Exception Types and Hierarchy

#### Exception hierarchy — BaseException tree, args, __cause__

> [!info] Exception hierarchy
> - `BaseException` — root; `SystemExit` and `KeyboardInterrupt` are siblings of `Exception`
> - Always catch `Exception`, not `BaseException`
> - Properties: `args` (tuple), `__cause__` (`raise ... from`), `__context__` (implicit chaining)
> - Hierarchical catching: `except OSError` catches all OS-related errors

> [!danger] Never catch `BaseException`
> This prevents `Ctrl+C` (`KeyboardInterrupt`) and `sys.exit()` from working.

```python
# Exception hierarchy — BaseException at root; always catch Exception (not BaseException)
#
#   BaseException
#   ├── SystemExit / KeyboardInterrupt   ← DON'T catch with bare except
#   └── Exception
#       ├── ValueError        (bad value format)
#       ├── TypeError         (wrong argument type)
#       ├── KeyError          (dict key missing)
#       ├── IndexError        (list index out of range)
#       ├── AttributeError    (attribute doesn't exist)
#       ├── RuntimeError      (general runtime error)
#       ├── ArithmeticError   (ZeroDivisionError, OverflowError)
#       └── OSError           (FileNotFoundError, PermissionError)

# Exception properties — args, __cause__, __traceback__
try:
    raise ValueError("salary must be positive", -500)
except ValueError as e:
    print(f"  str(e):  {str(e)}")
    print(f"  e.args:  {e.args}")
    print(f"  type(e): {type(e).__name__}")
```

      str(e):  ('salary must be positive', -500)
      e.args:  ('salary must be positive', -500)
      type(e): ValueError

#### Common exceptions in data engineering

```python
# ValueError, KeyError, TypeError — most common in CSV/JSON parsing

csv_row = ["Alice", "not_a_number", "2024-01-15"]
try:
    salary = int(csv_row[1])
except ValueError as e:
    salary = int(csv_row[1]) if csv_row[1].lstrip('-').isdigit() else 0
    print(f"  ValueError: safe fallback = {salary}")

row = {"name": "Alice", "dept": "Engineering"}
salary = row.get("salary", 0)  # .get() avoids KeyError
print(f"  KeyError avoided: salary = {salary}")

try:
    total = sum("not_a_list")  # type: ignore
except TypeError as e:
    print(f"  TypeError: {e}")
```

      ValueError: safe fallback = 0
      KeyError avoided: salary = 0
      TypeError: unsupported operand type(s) for +: 'int' and 'str'

#### Common exceptions — AttributeError, ZeroDivisionError, FileNotFoundError

```python
# Defensive patterns for None, empty collections, missing files

optional_field = None
safe = optional_field.upper() if optional_field is not None else ""  # type: ignore
print(f"  AttributeError avoided: '{safe}'")

def safe_avg(values):
    return sum(values) / len(values) if values else None
print(f"  safe_avg([10,20]): {safe_avg([10, 20])}")
print(f"  safe_avg([]):      {safe_avg([])}")

try:
    with open("missing_data.csv") as f:
        data = f.read()
except FileNotFoundError as e:
    print(f"  FileNotFoundError: {e.filename} — {e.strerror}")
```

      AttributeError avoided: ''
      safe_avg([10,20]): 15.0
      safe_avg([]):      None
      FileNotFoundError: missing_data.csv — No such file or directory

#### Catching multiple exception types in one clause

```python
# Tuple of exception types in one except clause

def parse_numeric(value):
    try:
        return float(value)
    except (ValueError, TypeError):
        return None

for v in ["3.14", "bad", None, "42"]:
    print(f"  parse_numeric({str(v)!r:8}) = {parse_numeric(v)}")
```

      parse_numeric('3.14'  ) = 3.14
      parse_numeric('bad'   ) = None
      parse_numeric('None'  ) = None
      parse_numeric('42'    ) = 42.0

## Custom Exceptions

#### Custom exception classes

Custom exceptions add structured diagnostic fields (`row_number`, `column_name`, `raw_value`) that built-in types lack. Type-safe catching (`except CsvParseError`) is more precise than catching generic `Exception`. The `__cause__` chain preserves full error history. Only create custom exceptions when you need extra context — otherwise built-in types like `ValueError` or `FileNotFoundError` suffice.

```python
# Custom exception classes — inherit from Exception; add domain-specific attributes

# CsvParseError — structured context for CSV parsing failures
class CsvParseError(Exception):
    def __init__(self, row_number: int, column_name: str, raw_value: str,
                 cause: Optional[Exception] = None):
        self.row_number = row_number
        self.column_name = column_name
        self.raw_value = raw_value
        super().__init__(f"Row {row_number}: invalid value {raw_value!r} in column '{column_name}'")
        if cause:
            self.__cause__ = cause

# PipelineError — wraps lower-level errors with pipeline name and stage
class PipelineError(Exception):
    def __init__(self, pipeline_name: str, stage: str, message: str,
                 cause: Optional[Exception] = None):
        self.pipeline_name = pipeline_name
        self.stage = stage
        super().__init__(f"[{pipeline_name}/{stage}] {message}")
        if cause:
            self.__cause__ = cause

# ConfigError — hides internal file errors from callers
class ConfigError(Exception):
    pass
```

#### Using custom exceptions — catch, wrap, and re-raise with domain context

```python
# Using custom exceptions — catch low-level, wrap with domain context

def parse_salary(value: str, row_num: int) -> int:
    try:
        return int(value)
    except ValueError as e:
        raise CsvParseError(row_num, "salary", value, cause=e)

rows = ["Alice,95000", "Bob,not_a_number", "Charlie,110000"]
for i, row in enumerate(rows, start=1):
    parts = row.split(",")
    try:
        salary = parse_salary(parts[1], i)
        print(f"  Row {i}: {parts[0]} salary={salary:,}")
    except CsvParseError as e:
        print(f"  SKIP row {e.row_number}: column '{e.column_name}' bad value {e.raw_value!r}")
        print(f"         Caused by: {e.__cause__}")
```

      Row 1: Alice salary=95,000
      SKIP row 2: column 'salary' bad value 'not_a_number'
             Caused by: invalid literal for int() with base 10: 'not_a_number'
      Row 3: Charlie salary=110,000

#### Exception chaining and raise from None

```python
# Exception chaining and raise from None — control the error chain

def run_pipeline(name):
    try:
        raise CsvParseError(42, "amount", "$$$")
    except CsvParseError as e:
        raise PipelineError(name, "transform", "Parse error in input file") from e

try:
    run_pipeline("sales_etl")
except PipelineError as e:
    print(f"  Pipeline: {e.pipeline_name}")
    print(f"  Stage:    {e.stage}")
    if isinstance(e.__cause__, CsvParseError):
        csv_e = e.__cause__
        print(f"  Root:     row {csv_e.row_number}, col '{csv_e.column_name}', value {csv_e.raw_value!r}")

# raise from None — hide internal exception from caller
def load_config(path):
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        raise ConfigError(f"Config file not found: {path}") from None

try:
    load_config("config.yaml")
except ConfigError as e:
    print(f"  {e}")
    print(f"  __cause__: {e.__cause__}")  # None — suppressed
```

      Pipeline: sales_etl
      Stage:    transform
      Root:     row 42, col 'amount', value '$$$'
      Config file not found: config.yaml
      __cause__: None

## Context Managers — with statement

#### Basic with statement

> [!info] Context manager protocol
> - `with open(path) as f:` — calls `__enter__` on start, `__exit__` on end (even on exception)
> - No `finally` needed — cleanup is automatic
> - Stack multiple: `with open(a) as f1, open(b) as f2:`
> - Use for files, DB connections, locks, temp directories, network sockets

> [!warning] Anti-patterns
> - **Manual `try`/`finally`** when `with` is available — more verbose, easier to forget
> - **Not closing** files, connections, or cursors — resource leaks

```python
# with statement — calls __enter__ on start, __exit__ on end (even on exception)

# Create temp CSV
tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
tmp.write("name,salary,dept\nAlice,95000,Engineering\nBob,65000,Sales")
tmp.close()

# File auto-closed when with block exits
with open(tmp.name) as f:
    for line in f:
        print(f"  {line.rstrip()}")

# Multiple context managers in one statement
out_tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
out_tmp.close()

with open(tmp.name) as src, open(out_tmp.name, 'w') as dst:
    header = src.readline().rstrip()
    dst.write(header + ",tax\n")
    for line in src:
        parts = line.rstrip().split(",")
        salary = int(parts[1])
        dst.write(f"{line.rstrip()},{salary * 0.3:.0f}\n")

with open(out_tmp.name) as f:
    print(f"  Output: {f.read().strip()}")
```

      name,salary,dept
      Alice,95000,Engineering
      Bob,65000,Sales
      Output: name,salary,dept,tax
    Alice,95000,Engineering,28500
    Bob,65000,Sales,19500

#### Custom context manager — @contextmanager

```python
# @contextmanager — generator-based context manager (no class needed)

@contextlib.contextmanager
def csv_writer(path: str, header: list[str]):
    """Context manager that writes a CSV file, flushing on exit."""
    rows_written = 0
    f = open(path, 'w')
    try:
        f.write(",".join(header) + "\n")

        def write_row(*values):
            nonlocal rows_written
            f.write(",".join(str(v) for v in values) + "\n")
            rows_written += 1

        yield write_row
    finally:
        f.flush()
        f.close()
        print(f"  Closed: {path} ({rows_written} rows written)")

out2 = tempfile.NamedTemporaryFile(suffix='.csv', delete=False).name
with csv_writer(out2, ["name", "salary", "dept"]) as write:
    write("Alice", 95000, "Engineering")
    write("Bob", 65000, "Sales")

# contextlib.suppress — silently ignore specific exceptions
for f in [tmp.name, out_tmp.name, out2]:
    with contextlib.suppress(FileNotFoundError):
        os.unlink(f)
        print(f"  Deleted: {f}")
```

      Closed: C:\Users\aperi\AppData\Local\Temp\tmpkqxh9yf4.csv (2 rows written)
      Deleted: C:\Users\aperi\AppData\Local\Temp\tmp8z18xzfq.csv
      Deleted: C:\Users\aperi\AppData\Local\Temp\tmpxzwt778q.csv
      Deleted: C:\Users\aperi\AppData\Local\Temp\tmpkqxh9yf4.csv

#### Class-based context manager — __enter__ and __exit__ protocol

```python
# Class-based context manager — __enter__ and __exit__ for resource lifecycle

class DatabaseConnection:
    def __init__(self, conn_string: str):
        self.conn_string = conn_string
        self.connected = False

    def __enter__(self):
        print(f"  Connecting to {self.conn_string}...")
        self.connected = True
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"  Disconnecting from {self.conn_string}")
        self.connected = False
        return False  # don't suppress exceptions

    def execute(self, query: str):
        if not self.connected:
            raise RuntimeError("Not connected")
        print(f"  Query: {query}")

with DatabaseConnection("postgresql://localhost/mydb") as db:
    db.execute("SELECT * FROM employees LIMIT 3")
```

      Connecting to postgresql://localhost/mydb...
      Query: SELECT * FROM employees LIMIT 3
      Disconnecting from postgresql://localhost/mydb

## Data Engineering — error accumulation and resilience patterns

#### Safe parse helpers — return default on failure instead of raising

> [!info] Safe parse pattern
> - `safe_int(value, default=0)` — wraps `int()` in `try`/`except`, returns default on failure
> - Composable in comprehensions and `map()` calls
> - Use for parsing CSV/JSON fields where bad values are expected
> - When invalid data should halt processing, raise explicitly instead

```python
# Safe parse helpers — return a default instead of raising; much cleaner for expected bad data

def safe_int(value, default=None):
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

def safe_float(value, default=None):
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

def safe_date(value, fmt="%Y-%m-%d", default=None):
    try:
        return datetime.strptime(value, fmt)
    except (ValueError, TypeError):
        return default

values = ["42", "bad", None, "", "3.14", "2024-01-15"]
for v in values:
    print(f"  safe_int({str(v)!r:12}) = {str(safe_int(v))!r:6}  "
          f"safe_date({str(v)!r:12}) = {safe_date(str(v) if v else v)}")
```

      safe_int('42'        ) = '42'    safe_date('42'        ) = None
      safe_int('bad'       ) = 'None'  safe_date('bad'       ) = None
      safe_int('None'      ) = 'None'  safe_date('None'      ) = None
      safe_int(''          ) = 'None'  safe_date(''          ) = None
      safe_int('3.14'      ) = 'None'  safe_date('3.14'      ) = None
      safe_int('2024-01-15') = 'None'  safe_date('2024-01-15') = 2024-01-15 00:00:00

#### Error accumulation — ETL pattern

```python
# ParseResult dataclass — structured result type for error accumulation

@dataclass
class ParseResult:
    name: str = ""
    salary: int = 0
    is_valid: bool = True
    error: Optional[str] = None

def parse_employee(csv_line: str, row_num: int) -> ParseResult:
    parts = [p.strip() for p in csv_line.split(",")]
    if len(parts) < 2:
        return ParseResult(is_valid=False, error=f"Row {row_num}: expected 2 columns, got {len(parts)}")
    salary = safe_int(parts[1])
    if salary is None:
        return ParseResult(is_valid=False, error=f"Row {row_num}: invalid salary {parts[1]!r}")
    if salary < 0:
        return ParseResult(is_valid=False, error=f"Row {row_num}: salary cannot be negative ({salary})")
    return ParseResult(name=parts[0], salary=salary)
```

#### Error accumulation — process all rows, partition valid/invalid

```python
# Process all rows, partition into valid and rejected

input_rows = [
    "Alice, 95000", "Bob, not_a_number", "Charlie",
    "Diana, 78000", "Eve, -500", "Frank, 72000",
]

results = [parse_employee(row, i + 1) for i, row in enumerate(input_rows)]
good = [r for r in results if r.is_valid]
bad  = [r for r in results if not r.is_valid]

print(f"  Processed: {len(results)} rows, Valid: {len(good)}, Rejected: {len(bad)}")
for r in good: print(f"    {r.name:<10} ${r.salary:,}")
for r in bad:  print(f"    ERROR: {r.error}")
```

      Processed: 6 rows, Valid: 3, Rejected: 3
        Alice      $95,000
        Diana      $78,000
        Frank      $72,000
        ERROR: Row 2: invalid salary 'not_a_number'
        ERROR: Row 3: expected 2 columns, got 1
        ERROR: Row 5: salary cannot be negative (-500)

#### Retry pattern for transient errors

> [!tip] Only retry transient exceptions
> Pass a specific tuple of retryable exceptions (e.g., `ConnectionError`, `TimeoutError`) to avoid retrying permanent failures like `ValueError` or `PermissionError`. In production, use `tenacity` or `stamina` libraries instead of hand-rolling retry logic.

```python
# Retry pattern — retry transient failures with backoff

def with_retry(operation, max_attempts=3, delay_s=0.1, exceptions=(Exception,)):
    for attempt in range(1, max_attempts + 1):
        try:
            return operation()
        except exceptions as e:
            if attempt == max_attempts:
                raise
            print(f"  Attempt {attempt} failed: {e}. Retrying...")
            time.sleep(delay_s * attempt)

call_count = 0
def flaky_load():
    global call_count
    call_count += 1
    if call_count < 3:
        raise ConnectionError(f"Connection timeout (attempt {call_count})")
    return "data loaded successfully"

result = with_retry(flaky_load, exceptions=(ConnectionError,))
print(f"  Result after {call_count} attempts: {result}")
```

      Attempt 1 failed: Connection timeout (attempt 1). Retrying...
      Attempt 2 failed: Connection timeout (attempt 2). Retrying...
      Result after 3 attempts: data loaded successfully

#### ExceptionGroup — parallel errors

```python
# ExceptionGroup — aggregate multiple exceptions (Python 3.11+)

if sys.version_info >= (3, 11):
    try:
        raise ExceptionGroup("pipeline errors", [
            ValueError("Bad value in file A"),
            IOError("File B not found"),
            ValueError("Bad value in file C"),
        ])
    except* ValueError as eg:
        print(f"  ValueError group ({len(eg.exceptions)} errors):")
        for e in eg.exceptions:
            print(f"    - {e}")
    except* IOError as eg:
        print(f"  IOError group: {eg.exceptions[0]}")
else:
    print("  ExceptionGroup requires Python 3.11+ (skipped)")
```

      ValueError group (2 errors):
        - Bad value in file A
        - Bad value in file C
      IOError group: File B not found
