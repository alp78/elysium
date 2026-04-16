---
title: "08 - Error Handling - Python"
tags: [python]
aliases: [exceptions, try catch, error handling, custom exceptions, exception hierarchy]
description: "Python error handling reference with executable examples and cell outputs — covers try/except/finally, exception hierarchy, custom exceptions, re-raising, and context managers. See [08-cs-errorhandling](https://alp78.github.io/elysium/02-Programming-Languages/02-CSharp/08-cs-errorhandling) for the C# equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 08. Error Handling - Python

> [!quote]+
>
> "If debugging is the process of removing software bugs, then programming must be the process of putting them in."
>
> — **Edsger W. Dijkstra**, attributed remark (c. 1970s)

> [!abstract]- Summary
>
> - Python uses `try`/`except`/`else`/`finally` for structured exception handling; `else` runs on success only, `finally` runs unconditionally.
> - The exception hierarchy is rooted at `BaseException`; `Exception` is the correct broadest catch because it excludes `SystemExit`, `KeyboardInterrupt`, and `GeneratorExit`.
> - Multiple `except` clauses are evaluated top-to-bottom; place the most specific types first and a broad `except Exception` fallback last.
> - `raise ... from e` chains exceptions explicitly by setting `__cause__`; bare `raise` re-raises with the original traceback intact; `raise ... from None` suppresses the chain.
> - Custom exception classes inherit from `Exception` and carry structured diagnostic fields such as `row_number`, `column_name`, and `raw_value`.
> - The `with` statement uses the `__enter__` / `__exit__` protocol to guarantee resource cleanup for files, connections, and locks.
> - `@contextlib.contextmanager` turns a generator function into a context manager, with `yield` marking the boundary between setup and teardown.
> - Safe parse helpers such as `safe_int`, `safe_float`, and `safe_date` return a default instead of raising, which is useful for resilient ETL parsing.
> - Error accumulation collects failures into a list so a batch pipeline can process all rows before reporting; `ExceptionGroup` and `except*` extend that model to grouped failures in Python 3.11+.
> - Retry with backoff wraps an operation in a bounded loop with increasing delays; production code should retry only specific transient exceptions and re-raise after exhaustion.

> [!note]- Glossary
>
> **try / except**
> - `try:` wraps code that may raise; matching `except ExceptionType as e:` clauses are checked top-to-bottom and the first match wins.
> - Use `except Exception as e:` at the broadest. Avoid bare `except:` because it also catches `KeyboardInterrupt` and `SystemExit`.
>
> **else**
> - `else` runs only when the `try` block succeeds with no exception.
> - Put success-only logic in `else` so the `try` block stays narrow and the `except` clauses do not hide later failures.
>
> **finally**
> - `finally` runs whether the `try` block succeeds, fails, returns early, or re-raises.
> - Use it for deterministic cleanup when the resource does not support `with`.
>
> **raise**
> - Bare `raise` re-raises the active exception with the original traceback preserved.
> - `raise NewError("msg")` throws a new exception, and `raise NewError("msg") from e` records the wrapped exception in `__cause__`.
>
> **exception chaining**
> - `raise NewError("msg") from original_error` creates an explicit chain that debuggers and loggers can inspect through `__cause__`.
> - `raise NewError("msg") from None` suppresses the lower-level cause when that detail should stay internal.
>
> **BaseException**
> - `BaseException` is the root of Python's full exception tree.
> - `SystemExit`, `KeyboardInterrupt`, and `GeneratorExit` inherit directly from it, so application code should rarely catch it.
>
> **Exception**
> - `Exception` is the base class for normal application failures such as `ValueError`, `TypeError`, `KeyError`, and `OSError`.
> - It is the safe broadest catch for boundary handlers, although narrow handlers should still prefer a specific subtype such as `FileNotFoundError`.
>
> **custom exception**
> - A custom exception inherits from `Exception` or another built-in subtype and adds structured context such as `row_number`, `column_name`, or `raw_value`.
> - Keep the class focused on diagnostic data and type-safe catching rather than business logic.
>
> **context manager**
> - A context manager implements `__enter__` and `__exit__`, or is created with `@contextmanager`.
> - Returning `True` from `__exit__` suppresses the active exception; most application context managers should return `False` or `None`.
>
> **`with` statement**
> - `with resource as r:` calls `__enter__` at block entry and `__exit__` at block exit, even when an exception occurs.
> - Stack multiple resources in one statement when they share the same lifetime, such as `with open(src) as f1, open(dst, "w") as f2:`.
>
> **`@contextmanager`**
> - `@contextmanager` converts a generator function into a context manager.
> - Code before `yield` performs setup, and code after `yield` performs teardown, usually inside `try` / `finally`.
>
> **ExceptionGroup**
> - `ExceptionGroup` bundles multiple exceptions into one raised object and is handled with `except*`.
> - It is available in Python 3.11+ and is useful when parallel work can fail in more than one way at once.
>
> **error accumulation**
> - Error accumulation stores failures in a list or result object instead of failing immediately on the first bad row.
> - The caller must inspect that collection at the end of the batch and decide whether to continue, quarantine, or fail.
>
> **retry with backoff**
> - Retry with backoff repeats a transiently failing operation up to a fixed maximum and increases the delay between attempts.
> - Limit retries to specific transient exceptions such as `ConnectionError` or `TimeoutError`; do not retry permanent validation failures such as `ValueError`.

## try / except / else / finally

Python uses exception types as the dispatch key for recovery logic. Keep the `try` block narrow, catch the most specific type that matches the failure boundary, and use chaining so wrapped exceptions remain diagnosable.

### Python | Exceptions | try, except, else, finally, raise

#### Basic try / except

Use `except ValueError as e:` or another narrow type whenever the failure mode is known. Reserve `except Exception as e:` for boundary handlers that log with `logging.exception(...)` or re-raise, and avoid bare `except:` because it also intercepts `KeyboardInterrupt` and `SystemExit`.

*This example imports the helpers used later in the note and catches a basic `IndexError` from an out-of-range list access.*
```python
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
import contextlib
import os
import sys
import time

try:
    arr = [1, 2, 3]
    print(arr[10])  # IndexError
except IndexError as e:
    print(f"Caught: {e}")
```

```text
Caught: list index out of range
```

#### Multiple except clauses — handle different exception types differently

Order `except` clauses from most specific to most general. `except Exception:` belongs last because it matches almost every application failure and will hide narrower handlers if it appears first.

*This example shows `ValueError`, `TypeError`, and a broad `Exception` fallback dispatched in order.*
```python
def parse_row(value, row_num):
    try:
        result = int(value)
        if result < 0:
            raise ValueError(f"Salary cannot be negative: {result}")
        print(f"Row {row_num}: parsed {result}")
    except ValueError as e:
        print(f"Row {row_num}: value error — {e}")
    except TypeError as e:
        print(f"Row {row_num}: type error — {e}")
    except Exception as e:
        print(f"Row {row_num}: unexpected {type(e).__name__}: {e}")

parse_row("42", 1)
parse_row("not_a_number", 2)
parse_row(-100, 3)
parse_row(None, 4)
```

```text
Row 1: parsed 42
Row 2: value error — invalid literal for int() with base 10: 'not_a_number'
Row 3: value error — Salary cannot be negative: -100
Row 4: type error — int() argument must be a string, a bytes-like object or a real number, not 'NoneType'
```

#### else and finally — success-only code and guaranteed cleanup

Use `else` for the work that should happen only after the risky call succeeds. Use `finally` for cleanup or audit logging that must run whether the operation succeeded, failed, or returned early.

*This example keeps file I/O inside `try`, puts the success path in `else`, and prints a guaranteed audit line from `finally`.*
```python
def load_config(path):
    try:
        with open(path) as f:
            data = f.read()
    except FileNotFoundError:
        print(f"Config not found: {path}")
        return None
    else:
        print(f"Config loaded: {len(data)} bytes")
        return data
    finally:
        print(f"Attempt to load: {path} (always runs)")

load_config("missing.json")
```

```text
Config not found: missing.json
Attempt to load: missing.json (always runs)
```

#### finally — guaranteed cleanup even on exception

Use `finally` when a resource does not provide `with` and you still need deterministic cleanup. It runs after normal completion and after a handled exception in the same function.

*This example closes the simulated resource in `finally` whether the work succeeds or raises a `RuntimeError`.*
```python
def process_with_cleanup(throw_error):
    print("Opening resource...")
    try:
        print("Processing...")
        if throw_error:
            raise RuntimeError("Something went wrong")
        print("Done.")
    except RuntimeError as e:
        print(f"Error caught: {e}")
    finally:
        print("Closing resource (finally)")

process_with_cleanup(False)
process_with_cleanup(True)
```

```text
Opening resource...
Processing...
Done.
Closing resource (finally)
Opening resource...
Processing...
Error caught: Something went wrong
Closing resource (finally)
```

#### raise vs raise from — exception chaining

Use bare `raise` when the caller should see the original traceback unchanged. Use `raise NewError(...) from e` when you want to wrap a low-level failure with domain context while keeping the original exception available in `__cause__`.

*This example wraps a `ValueError` in a `RuntimeError` and inspects the resulting `__cause__` chain.*
```python
def wrapper():
    try:
        int("bad_value")
    except ValueError as e:
        raise RuntimeError("Pipeline failed during validation") from e

try:
    wrapper()
except RuntimeError as e:
    print(f"Outer: {e}")
    print(f"Caused by: {e.__cause__}")
```

```text
Outer: Pipeline failed during validation
Caused by: invalid literal for int() with base 10: 'bad_value'
```

## Exception Types and Hierarchy

Python's hierarchy starts at `BaseException`, not `Exception`. That distinction matters because `KeyboardInterrupt`, `SystemExit`, and `GeneratorExit` should usually bypass application recovery code so the process can stop cleanly.

### Python | Exceptions | types and properties

#### Exception hierarchy — BaseException tree, args, __cause__

Catch `Exception`, not `BaseException`, unless you are writing framework-level shutdown logic. Built-ins such as `ValueError`, `TypeError`, `KeyError`, and `OSError` still remain catchable through their shared parents when that boundary is appropriate.

*This diagram shows the branch of the exception tree that matters most in application code.*
```text
BaseException
├── SystemExit / KeyboardInterrupt   -- do not catch with bare except
└── Exception
    ├── ValueError        (bad value format)
    ├── TypeError         (wrong argument type)
    ├── KeyError          (dict key missing)
    ├── IndexError        (list index out of range)
    ├── AttributeError    (attribute does not exist)
    ├── RuntimeError      (general runtime failure)
    ├── ArithmeticError   (ZeroDivisionError, OverflowError)
    └── OSError           (FileNotFoundError, PermissionError)
```

Each exception instance also carries `args`, and wrapped exceptions may additionally populate `__cause__` or `__context__`. Those fields are what make error logs and chained tracebacks inspectable after recovery code runs.

*This example inspects a raised `ValueError` through `str(e)`, `e.args`, and `type(e).__name__`.*
```python
try:
    raise ValueError("salary must be positive", -500)
except ValueError as e:
    print(f"str(e):  {str(e)}")
    print(f"e.args:  {e.args}")
    print(f"type(e): {type(e).__name__}")
```

```text
str(e):  ('salary must be positive', -500)
e.args:  ('salary must be positive', -500)
type(e): ValueError
```

#### Common exceptions in data engineering

ETL code usually fails in three ways: coercion of raw strings, missing keys in partially populated records, and unexpected types passed into generic helpers. Treat those cases differently so the fallback is explicit and the surviving data stays inspectable.

*This example handles a bad integer parse, avoids a missing-key `KeyError` with `.get()`, and catches a broad `TypeError` from invalid input.*
```python
csv_row = ["Alice", "not_a_number", "2024-01-15"]
try:
    salary = int(csv_row[1])
except ValueError:
    salary = int(csv_row[1]) if csv_row[1].lstrip("-").isdigit() else 0
    print(f"ValueError: safe fallback = {salary}")

row = {"name": "Alice", "dept": "Engineering"}
salary = row.get("salary", 0)
print(f"KeyError avoided: salary = {salary}")

try:
    total = sum("not_a_list")  # type: ignore[arg-type]
except TypeError as e:
    print(f"TypeError: {e}")
```

```text
ValueError: safe fallback = 0
KeyError avoided: salary = 0
TypeError: unsupported operand type(s) for +: 'int' and 'str'
```

#### Common exceptions — AttributeError, ZeroDivisionError, FileNotFoundError

Prefer narrow guards for expected absence and reserve exception handling for the actual failure boundary. In practice that often means checking `is not None`, using `if values` before division, and catching `FileNotFoundError` only around the file access itself.

*This example avoids an `AttributeError`, avoids `ZeroDivisionError`, and catches a missing file with a narrow `FileNotFoundError` handler.*
```python
optional_field = None
safe = optional_field.upper() if optional_field is not None else ""  # type: ignore[union-attr]
print(f"AttributeError avoided: {safe!r}")

def safe_avg(values):
    return sum(values) / len(values) if values else None

print(safe_avg([10, 20]))
print(safe_avg([]))

try:
    with open("missing_data.csv") as f:
        data = f.read()
except FileNotFoundError as e:
    print(f"FileNotFoundError: {os.path.basename(e.filename)} — {e.strerror}")
```

```text
AttributeError avoided: ''
15.0
None
FileNotFoundError: missing_data.csv — No such file or directory
```

#### Catching multiple exception types in one clause

When the same recovery logic applies to several failure types, catch a tuple such as `(ValueError, TypeError)`. This is appropriate for parse helpers that collapse bad inputs to a shared default value.

*This example collapses both `ValueError` and `TypeError` to `None` in a reusable numeric parser.*
```python
def parse_numeric(value):
    try:
        return float(value)
    except (ValueError, TypeError):
        return None

for v in ["3.14", "bad", None, "42"]:
    print(f"parse_numeric({str(v)!r:8}) = {parse_numeric(v)}")
```

```text
parse_numeric('3.14'  ) = 3.14
parse_numeric('bad'   ) = None
parse_numeric('None'  ) = None
parse_numeric('42'    ) = 42.0
```

## Custom Exceptions

Custom exceptions let callers catch failures at the domain boundary instead of reverse-engineering a built-in error string. They are most useful when the caller needs structured fields such as row number, stage, or failing column name.

### Python | Exceptions | custom exception classes

#### Custom exception classes

Keep custom exceptions small and data-oriented. The class should capture the fields that help the caller recover or log precisely, and the message should stay readable without hiding the original cause.

*These class definitions create the typed exceptions used by the next examples.*
```python
class CsvParseError(Exception):
    def __init__(self, row_number: int, column_name: str, raw_value: str,
                 cause: Optional[Exception] = None):
        self.row_number = row_number
        self.column_name = column_name
        self.raw_value = raw_value
        super().__init__(f"Row {row_number}: invalid value {raw_value!r} in column '{column_name}'")
        if cause:
            self.__cause__ = cause

class PipelineError(Exception):
    def __init__(self, pipeline_name: str, stage: str, message: str,
                 cause: Optional[Exception] = None):
        self.pipeline_name = pipeline_name
        self.stage = stage
        super().__init__(f"[{pipeline_name}/{stage}] {message}")
        if cause:
            self.__cause__ = cause

class ConfigError(Exception):
    pass
```

```text
No output.
```

#### Using custom exceptions — catch, wrap, and re-raise with domain context

Raise a custom subtype when the caller needs row-level metadata rather than a generic parse message. The caller can still inspect `__cause__` when the lower-level `ValueError` matters for diagnostics.

*This example raises `CsvParseError` with row metadata and lets the caller decide whether to skip or quarantine the record.*
```python
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
        print(f"Row {i}: {parts[0]} salary={salary:,}")
    except CsvParseError as e:
        print(f"SKIP row {e.row_number}: column '{e.column_name}' bad value {e.raw_value!r}")
        print(f"Caused by: {e.__cause__}")
```

```text
Row 1: Alice salary=95,000
SKIP row 2: column 'salary' bad value 'not_a_number'
Caused by: invalid literal for int() with base 10: 'not_a_number'
Row 3: Charlie salary=110,000
```

#### Exception chaining and raise from None

`raise ... from e` keeps the lower-level cause visible to the caller. `raise ... from None` is the opposite choice: it deliberately hides the internal source when the public boundary should expose only a domain-specific message.

*This example wraps a `CsvParseError` in `PipelineError` and then suppresses a lower-level `FileNotFoundError` behind `ConfigError`.*
```python
def run_pipeline(name):
    try:
        raise CsvParseError(42, "amount", "$$$")
    except CsvParseError as e:
        raise PipelineError(name, "transform", "Parse error in input file") from e

try:
    run_pipeline("sales_etl")
except PipelineError as e:
    print(f"Pipeline: {e.pipeline_name}")
    print(f"Stage:    {e.stage}")
    if isinstance(e.__cause__, CsvParseError):
        csv_e = e.__cause__
        print(f"Root:     row {csv_e.row_number}, col '{csv_e.column_name}', value {csv_e.raw_value!r}")

def load_config(path):
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        raise ConfigError(f"Config file not found: {path}") from None

try:
    load_config("config.yaml")
except ConfigError as e:
    print(e)
    print(f"__cause__: {e.__cause__}")
```

```text
Pipeline: sales_etl
Stage:    transform
Root:     row 42, col 'amount', value '$$$'
Config file not found: config.yaml
__cause__: None
```

## Context Managers — with statement

Use `with` whenever the resource supports it. The context-manager protocol is Python's standard way to make file handles, locks, sockets, temporary resources, and custom wrappers deterministic at block exit.

### Python | Context managers | with statement and protocols

#### Basic with statement — guaranteed cleanup via context managers

`with open(path) as f:` is the normal replacement for manual `try` / `finally` around a file handle. Stack multiple `with` resources in the same statement when they share a lifetime and should close together.

*This example writes two CSV files under a temporary workspace, reads them back, and relies on `with` for deterministic file closure.*
```python
workspace = os.path.join(os.getcwd(), "py-error-handling-demo")
os.makedirs(workspace, exist_ok=True)

tmp = os.path.join(workspace, "employees.csv")
with open(tmp, "w") as f:
    f.write("name,salary,dept\nAlice,95000,Engineering\nBob,65000,Sales")

with open(tmp) as f:
    for line in f:
        print(line.rstrip())

out_tmp = os.path.join(workspace, "employees_with_tax.csv")
with open(tmp) as src, open(out_tmp, "w") as dst:
    header = src.readline().rstrip()
    dst.write(header + ",tax\n")
    for line in src:
        parts = line.rstrip().split(",")
        salary = int(parts[1])
        dst.write(f"{line.rstrip()},{salary * 0.3:.0f}\n")

with open(out_tmp) as f:
    print(f"Output: {f.read().strip()}")
```

```text
name,salary,dept
Alice,95000,Engineering
Bob,65000,Sales
Output: name,salary,dept,tax
Alice,95000,Engineering,28500
Bob,65000,Sales,19500
```

#### Custom context manager — @contextmanager

Use `@contextmanager` when the resource lifecycle is simple enough to express as setup, `yield`, and teardown in one function. Put teardown after `yield` inside `try` / `finally` so it still runs when the `with` body fails.

*This example implements a generator-based CSV writer that reports its cleanup and then removes the demo files created in the previous section.*
```python
@contextlib.contextmanager
def csv_writer(path: str, header: list[str]):
    rows_written = 0
    f = open(path, "w")
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
        print(f"Closed: {os.path.basename(path)} ({rows_written} rows written)")

out2 = os.path.join(workspace, "employees_written.csv")
with csv_writer(out2, ["name", "salary", "dept"]) as write:
    write("Alice", 95000, "Engineering")
    write("Bob", 65000, "Sales")

for path in [tmp, out_tmp, out2]:
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)
        print(f"Deleted: {os.path.basename(path)}")

with contextlib.suppress(OSError):
    os.rmdir(workspace)
```

```text
Closed: employees_written.csv (2 rows written)
Deleted: employees.csv
Deleted: employees_with_tax.csv
Deleted: employees_written.csv
```

#### Class-based context manager — __enter__ and __exit__ protocol

Use a class-based context manager when the resource needs persistent state, multiple helper methods, or more explicit control over `__exit__`. Return `False` or `None` from `__exit__` unless suppression is an intentional part of the API.

*This example opens a simulated database connection, runs one query, and lets `__exit__` close the resource on block exit.*
```python
class DatabaseConnection:
    def __init__(self, conn_string: str):
        self.conn_string = conn_string
        self.connected = False

    def __enter__(self):
        print(f"Connecting to {self.conn_string}...")
        self.connected = True
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"Disconnecting from {self.conn_string}")
        self.connected = False
        return False

    def execute(self, query: str):
        if not self.connected:
            raise RuntimeError("Not connected")
        print(f"Query: {query}")

with DatabaseConnection("postgresql://localhost/mydb") as db:
    db.execute("SELECT * FROM employees LIMIT 3")
```

```text
Connecting to postgresql://localhost/mydb...
Query: SELECT * FROM employees LIMIT 3
Disconnecting from postgresql://localhost/mydb
```

## Data Engineering — error accumulation and resilience patterns

Batch pipelines usually cannot stop on the first malformed row or transient network failure. Use parse helpers, typed result objects, grouped error reporting, and bounded retries so the pipeline can continue without losing the reason each failure occurred.

### Python | Error handling | result types and retry

#### Safe parse helpers — return default on failure instead of raising

Use small helpers such as `safe_int` and `safe_date` when bad input is an expected part of the dataset rather than an exceptional program state. The default value should make the downstream policy explicit: continue, quarantine, or reject the row.

*This example converts invalid numbers and dates to `None` instead of raising into the calling loop.*
```python
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
    print(f"safe_int({str(v)!r:12}) = {str(safe_int(v))!r:6}  "
          f"safe_date({str(v)!r:12}) = {safe_date(str(v) if v else v)}")
```

```text
safe_int('42'        ) = '42'    safe_date('42'        ) = None
safe_int('bad'       ) = 'None'  safe_date('bad'       ) = None
safe_int('None'      ) = 'None'  safe_date('None'      ) = None
safe_int(''          ) = 'None'  safe_date(''          ) = None
safe_int('3.14'      ) = 'None'  safe_date('3.14'      ) = None
safe_int('2024-01-15') = 'None'  safe_date('2024-01-15') = 2024-01-15 00:00:00
```

#### Error accumulation — ETL pattern

Accumulate row failures in a typed result object when the batch should finish before deciding whether to fail. A `ParseResult` record keeps the data and the failure reason in the same shape, which makes downstream partitioning straightforward.

*These definitions create the `ParseResult` record and parser used by the next accumulation example.*
```python
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

```text
No output.
```

#### Error accumulation — process all rows, partition valid/invalid

After parsing, split the batch into `good` and `bad` results and keep the rejection reasons intact. That allows the pipeline to send valid rows forward while logging or quarantining invalid records with the exact failure context.

*This example processes six rows, keeps the valid employees, and reports each rejected row without stopping the batch.*
```python
input_rows = [
    "Alice, 95000", "Bob, not_a_number", "Charlie",
    "Diana, 78000", "Eve, -500", "Frank, 72000",
]

results = [parse_employee(row, i + 1) for i, row in enumerate(input_rows)]
good = [r for r in results if r.is_valid]
bad = [r for r in results if not r.is_valid]

print(f"Processed: {len(results)} rows, Valid: {len(good)}, Rejected: {len(bad)}")
for r in good:
    print(f"  {r.name:<10} ${r.salary:,}")
for r in bad:
    print(f"  ERROR: {r.error}")
```

```text
Processed: 6 rows, Valid: 3, Rejected: 3
  Alice      $95,000
  Diana      $78,000
  Frank      $72,000
  ERROR: Row 2: invalid salary 'not_a_number'
  ERROR: Row 3: expected 2 columns, got 1
  ERROR: Row 5: salary cannot be negative (-500)
```

#### Retry pattern for transient errors

Retry only the exceptions that are plausibly transient, such as `ConnectionError` or `TimeoutError`. The loop must cap `max_attempts`, keep the delay policy explicit, and re-raise when the retry budget is exhausted.

*This example retries a flaky loader three times and succeeds on the third attempt after two `ConnectionError` failures.*
```python
def with_retry(operation, max_attempts=3, delay_s=0.1, exceptions=(Exception,)):
    for attempt in range(1, max_attempts + 1):
        try:
            return operation()
        except exceptions as e:
            if attempt == max_attempts:
                raise
            print(f"Attempt {attempt} failed: {e}. Retrying...")
            time.sleep(delay_s * attempt)

call_count = 0

def flaky_load():
    global call_count
    call_count += 1
    if call_count < 3:
        raise ConnectionError(f"Connection timeout (attempt {call_count})")
    return "data loaded successfully"

result = with_retry(flaky_load, exceptions=(ConnectionError,))
print(f"Result after {call_count} attempts: {result}")
```

```text
Attempt 1 failed: Connection timeout (attempt 1). Retrying...
Attempt 2 failed: Connection timeout (attempt 2). Retrying...
Result after 3 attempts: data loaded successfully
```

#### ExceptionGroup — parallel errors (Python 3.11+)

Use `ExceptionGroup` and `except*` when independent work items can fail in different ways at the same time. Keep a version guard around the feature if the code must still run on Python 3.10 or earlier.

*This example raises one `ExceptionGroup`, handles the `ValueError` members separately from the `IOError` member, and reports each branch explicitly.*
```python
if sys.version_info >= (3, 11):
    try:
        raise ExceptionGroup("pipeline errors", [
            ValueError("Bad value in file A"),
            IOError("File B not found"),
            ValueError("Bad value in file C"),
        ])
    except* ValueError as eg:
        print(f"ValueError group ({len(eg.exceptions)} errors):")
        for e in eg.exceptions:
            print(f"  - {e}")
    except* IOError as eg:
        print(f"IOError group: {eg.exceptions[0]}")
else:
    print("ExceptionGroup requires Python 3.11+ (skipped)")
```

```text
ValueError group (2 errors):
  - Bad value in file A
  - Bad value in file C
IOError group: File B not found
```
