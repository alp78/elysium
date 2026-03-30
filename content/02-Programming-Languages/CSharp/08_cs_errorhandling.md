---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [exceptions, try catch, error handling, custom exceptions, exception hierarchy]
keywords: [try, catch, finally, throw, Exception, custom exception, when filter, IDisposable, using, Result]
description: "C# error handling reference with executable examples and cell outputs — covers try/catch/finally, exception hierarchy, custom exceptions, exception filters, and IDisposable/using. See [08_py_errorhandling](https://alp78.github.io/elysium/02-Programming-Languages/Python/08_py_errorhandling) for the Python equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 08. Error Handling - C#

## try / catch / finally

#### Basic try / catch

Wrap risky code in `try { }` and catch specific exception types in `catch (ExceptionType ex) { }`. Unmatched exceptions propagate up the call stack. Use for I/O operations, parsing external data, and network calls — not for expected conditions (use `TryParse`, `if`/`else`, or null checks).

> [!warning] Anti-patterns
>
> - **`catch (Exception)` everywhere** — hides bugs, catches too broadly
> - **Empty catch blocks** — silently swallows errors
> - **Exceptions for flow control** — slow; use `TryParse`/`if` instead

```csharp
// Basic try/catch — wrap risky code in try; catch handles specific exception types
using System.IO;

try
{
    int[] arr = { 1, 2, 3 };
    Console.WriteLine(arr[10]);    // IndexOutOfRangeException
}
catch (IndexOutOfRangeException ex)
{
    Console.WriteLine($"Caught: {ex.Message}");
}
```

    Caught: Index was outside the bounds of the array.

> [!danger] catch (Exception) with empty body
>
> `catch (Exception)` with empty body silently hides bugs
> An empty `catch (Exception) { }` swallows *all* errors including `NullReferenceException`, `StackOverflowException` side effects, and data corruption. At minimum, log the exception. In production, prefer `catch (SpecificException)` and let unexpected errors propagate to global handlers.

> [!warning] async void methods
>
> `async void` methods — exceptions crash the process
> Exceptions thrown in `async void` methods cannot be caught by the caller — they propagate to the `SynchronizationContext` and crash the process. Always use `async Task` for async methods. The only acceptable use of `async void` is for event handlers in UI frameworks.

#### Multiple catch blocks

```csharp
// Multiple catch blocks — match most specific exception first

void ParseRow(string input)
{
    try
    {
        int value = int.Parse(input);
        int result = checked(value * 1000000);
        Console.WriteLine($"  Parsed: {result}");
    }
    catch (OverflowException ex)
    {
        Console.WriteLine($"  Overflow: {ex.Message}");
    }
    catch (FormatException ex)
    {
        Console.WriteLine($"  Format error: {ex.Message}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"  Unexpected: {ex.GetType().Name}: {ex.Message}");
    }
}

ParseRow("42");           // ok
ParseRow("not_a_number"); // FormatException
ParseRow("999999");       // OverflowException

// File IO — FileNotFoundException before IOException (subclass before base)
void LoadFile(string path)
{
    try
    {
        var text = File.ReadAllText(path);
    }
    catch (FileNotFoundException)
    {
        Console.WriteLine($"  File not found: {path}");
    }
    catch (UnauthorizedAccessException)
    {
        Console.WriteLine($"  Permission denied: {path}");
    }
    catch (IOException ex)
    {
        Console.WriteLine($"  IO error: {ex.Message}");
    }
}

LoadFile("missing.csv");
LoadFile("C:\\Windows\\System32");
```

      Parsed: 42000000
      Format error: The input string 'not_a_number' was not in a correct format.
      Overflow: Arithmetic operation resulted in an overflow.
      File not found: missing.csv
      Permission denied: C:\Windows\System32

#### catch when — conditional catch

```csharp
// catch when — conditional catch with boolean guard

void ParseValue(string input, bool strict)
{
    try
    {
        int.Parse(input);
    }
    catch (FormatException ex) when (strict)
    {
        throw new InvalidOperationException($"Strict mode: bad value '{input}'", ex);
    }
    catch (FormatException)
    {
        Console.WriteLine($"  Lenient mode: skipping bad value '{input}'");
    }
}

ParseValue("bad", false); // lenient — skips
try { ParseValue("bad", true); }
catch (InvalidOperationException ex) { Console.WriteLine($"  Strict caught: {ex.Message}"); }
```

      Lenient mode: skipping bad value 'bad'
      Strict caught: Strict mode: bad value 'bad'

#### finally — always runs

```csharp
// finally — guaranteed cleanup whether try succeeded or threw

void ProcessWithCleanup(bool throwError)
{
    Console.WriteLine("  Opening resource...");
    try
    {
        Console.WriteLine("  Processing...");
        if (throwError) throw new InvalidOperationException("Something went wrong");
        Console.WriteLine("  Done.");
    }
    catch (InvalidOperationException ex)
    {
        Console.WriteLine($"  Error caught: {ex.Message}");
    }
    finally
    {
        Console.WriteLine("  Closing resource (finally)");
    }
}

ProcessWithCleanup(false);
Console.WriteLine();
ProcessWithCleanup(true);
```

      Opening resource...
      Processing...
      Done.
      Closing resource (finally)
    
      Opening resource...
      Processing...
      Error caught: Something went wrong
      Closing resource (finally)

#### throw vs throw ex — preserving the stack trace

> [!danger] throw ex resets the stack trace
>
> `throw ex` resets the stack trace — use `throw` to preserve it
> `throw ex;` replaces the original stack trace with the current location, destroying the information needed to find the actual error source. Use bare `throw;` to re-throw with the original trace intact, or `throw new WrapperException("msg", ex)` to wrap with `InnerException`.

```csharp
// throw vs throw ex — preserving the original stack trace

void Wrapper()
{
    try
    {
        throw new ArgumentException("bad input");
    }
    catch (ArgumentException ex)
    {
        // Wrap with context, preserve original as InnerException
        throw new InvalidOperationException("Pipeline failed during validation", ex);
    }
}

try { Wrapper(); }
catch (InvalidOperationException ex)
{
    Console.WriteLine($"  Outer: {ex.Message}");
    Console.WriteLine($"  Caused by: {ex.InnerException?.Message}");
}
```

      Outer: Pipeline failed during validation
      Caused by: bad input

## Exception Types and Hierarchy

#### Exception hierarchy — Message, StackTrace, InnerException, Data

> [!info] Exception hierarchy
>
> - All exceptions inherit from `Exception`; `SystemException` covers most built-in errors
> - `Message` — description of the error
> - `StackTrace` — call chain leading to the error
> - `InnerException` — wrapped cause (don't ignore — root cause may be buried)
> - `Data` — key-value diagnostic context
> - Hierarchical catching: `catch (SystemException)` handles the entire family

```csharp
// Exception hierarchy — all exceptions inherit from Exception; SystemException covers most built-ins
#nullable enable
//
//   Exception
//   ├── SystemException
//   │   ├── ArgumentException (ArgumentNullException, ArgumentOutOfRangeException)
//   │   ├── ArithmeticException (DivideByZeroException, OverflowException)
//   │   ├── InvalidOperationException
//   │   ├── NullReferenceException
//   │   ├── FormatException
//   │   ├── KeyNotFoundException
//   │   ├── IOException (FileNotFoundException, DirectoryNotFoundException)
//   │   └── UnauthorizedAccessException
//   ├── AggregateException (wraps multiple exceptions from parallel tasks)
//   └── your custom exceptions inherit from Exception or a specific subclass

// Exception properties — Message, ParamName, StackTrace, InnerException, Data
try
{
    throw new ArgumentException("Value cannot be negative", "salary");
}
catch (ArgumentException ex)
{
    Console.WriteLine($"  Message:    {ex.Message}");
    Console.WriteLine($"  ParamName:  {ex.ParamName}");
    Console.WriteLine($"  Type:       {ex.GetType().Name}");
}
```

      Message:    Value cannot be negative (Parameter 'salary')
      ParamName:  salary
      Type:       ArgumentException

#### Common exceptions in data engineering

```csharp
// FormatException, KeyNotFoundException, OverflowException

string[] csvRow = { "Alice", "not_a_number", "2024-01-15" };
try { int salary = int.Parse(csvRow[1]); }
catch (FormatException ex) { Console.WriteLine($"  Can't parse salary '{csvRow[1]}': {ex.Message}"); }

var row = new Dictionary<string, string> { ["name"] = "Alice", ["dept"] = "Eng" };
try { var salary = row["salary"]; }
catch (KeyNotFoundException)
{
    var salary = row.TryGetValue("salary", out var s) ? s : "0";
    Console.WriteLine($"  Column 'salary' missing, defaulting to: {salary}");
}

try { int total = checked(int.MaxValue + 1); }
catch (OverflowException ex) { Console.WriteLine($"  Overflow: {ex.Message}"); }
```

      Can't parse salary 'not_a_number': The input string 'not_a_number' was not in a correct format.
      Column 'salary' missing, defaulting to: 0
      Overflow: Arithmetic operation resulted in an overflow.

#### Common exceptions — NullReferenceException, ArgumentNullException, InvalidOperationException

```csharp
// Null safety, guard clauses, and empty collections
#nullable enable

string? optionalField = null;
int len = optionalField?.Length ?? 0;
Console.WriteLine($"  Safe null handling: length = {len}");

void ProcessRecord(string record)
{
    ArgumentNullException.ThrowIfNull(record);
    Console.WriteLine($"  Processing: {record}");
}
try { ProcessRecord(null!); }
catch (ArgumentNullException ex) { Console.WriteLine($"  {ex.Message}"); }

var emptyList = new List<int>();
int safe = emptyList.FirstOrDefault();
Console.WriteLine($"  FirstOrDefault on empty: {safe}");
```

      Safe null handling: length = 0
      Value cannot be null. (Parameter 'record')
      FirstOrDefault on empty: 0

#### Exception.Data — attaching context

```csharp
// Exception.Data — attach key-value diagnostic context before re-throwing

try
{
    var ex2 = new FormatException("Invalid salary value");
    ex2.Data["row"] = 42;
    ex2.Data["file"] = "salaries.csv";
    ex2.Data["value"] = "abc";
    throw ex2;
}
catch (FormatException ex)
{
    Console.WriteLine($"  Error: {ex.Message}");
    Console.WriteLine($"  Row:   {ex.Data["row"]}");
    Console.WriteLine($"  File:  {ex.Data["file"]}");
    Console.WriteLine($"  Value: {ex.Data["value"]}");
}
```

      Error: Invalid salary value
      Row:   42
      File:  salaries.csv
      Value: abc

## Custom Exceptions

#### Custom exception classes — domain-specific with structured context

Custom exceptions add structured diagnostic fields (`RowNumber`, `ColumnName`, `RawValue`) that built-in types lack. Type-safe catching (`catch (CsvParseException)`) is more precise than catching generic `Exception`. `InnerException` chain preserves full error history. Only create custom exceptions when you need extra context — otherwise built-in types like `FormatException` or `IOException` suffice.

```csharp
// CsvParseException — domain exception for CSV parsing failures with structured context

public class CsvParseException : Exception
{
    public int RowNumber { get; }
    public string ColumnName { get; }
    public string RawValue { get; }

    public CsvParseException() : base() { }
    public CsvParseException(string message) : base(message) { }
    public CsvParseException(string message, Exception inner) : base(message, inner) { }

    public CsvParseException(int rowNumber, string columnName, string rawValue, Exception inner = null)
        : base($"Row {rowNumber}: invalid value '{rawValue}' in column '{columnName}'", inner)
    {
        RowNumber = rowNumber;
        ColumnName = columnName;
        RawValue = rawValue;
    }
}

// PipelineException — wraps lower-level exceptions with pipeline name and stage
public class PipelineException : Exception
{
    public string PipelineName { get; }
    public string Stage { get; }

    public PipelineException() : base() { }
    public PipelineException(string message) : base(message) { }
    public PipelineException(string message, Exception inner) : base(message, inner) { }

    public PipelineException(string pipelineName, string stage, string message, Exception inner = null)
        : base($"[{pipelineName}/{stage}] {message}", inner)
    {
        PipelineName = pipelineName;
        Stage = stage;
    }
}
```

#### Using custom exceptions — catch, wrap, re-throw with context

```csharp
// Using custom exceptions — catch low-level, wrap with domain context

int ParseSalary(string value, int rowNum)
{
    try
    {
        return int.Parse(value);
    }
    catch (FormatException ex)
    {
        throw new CsvParseException(rowNum, "salary", value, ex);
    }
}

string[] rows = { "Alice,95000", "Bob,not_a_number", "Charlie,110000" };

foreach (var (row, idx) in rows.Select((r, i) => (r, i + 1)))
{
    var parts = row.Split(',');
    try
    {
        int salary = ParseSalary(parts[1], idx);
        Console.WriteLine($"  Row {idx}: {parts[0]} salary={salary:N0}");
    }
    catch (CsvParseException ex)
    {
        Console.WriteLine($"  SKIP row {ex.RowNumber}: column '{ex.ColumnName}' bad value '{ex.RawValue}'");
        Console.WriteLine($"         Caused by: {ex.InnerException?.Message}");
    }
}
```

      Row 1: Alice salary=95'000
      SKIP row 2: column 'salary' bad value 'not_a_number'
             Caused by: The input string 'not_a_number' was not in a correct format.
      Row 3: Charlie salary=110'000

#### Pipeline-level exception wrapping — inner exception chain

```csharp
// Pipeline-level exception wrapping — name and stage context

void RunPipeline(string name)
{
    try
    {
        throw new CsvParseException(42, "amount", "$$$");
    }
    catch (CsvParseException ex)
    {
        throw new PipelineException(name, "transform", "Parse error in input file", ex);
    }
}

try { RunPipeline("sales_etl"); }
catch (PipelineException ex)
{
    Console.WriteLine($"  Pipeline: {ex.PipelineName}");
    Console.WriteLine($"  Stage:    {ex.Stage}");
    Console.WriteLine($"  Message:  {ex.Message}");
    if (ex.InnerException is CsvParseException csv)
        Console.WriteLine($"  Root:     row {csv.RowNumber}, col '{csv.ColumnName}', value '{csv.RawValue}'");
}
```

      Pipeline: sales_etl
      Stage:    transform
      Message:  [sales_etl/transform] Parse error in input file
      Root:     row 42, col 'amount', value '$$$'

## Resource Cleanup — using and IDisposable

#### using statement and declaration

```csharp
// using statement — automatic Dispose() for IDisposable resources

# nullable enable

// using statement — calls Dispose() automatically at end of block, even on exception
var tempFile = Path.GetTempFileName();
File.WriteAllText(tempFile, "col1,col2,col3\n1,2,3\n4,5,6");

// Block form — Dispose() called at closing brace
using (var reader = new StreamReader(tempFile))
{
    string? line;
    while ((line = reader.ReadLine()) != null)
        Console.WriteLine($"  Line: {line}");
}

// Declaration form (C# 8+) — Dispose() at end of method scope
void ReadCsvFile(string path)
{
    using var reader = new StreamReader(path);
    Console.WriteLine($"  Header: {reader.ReadLine()}");
    Console.WriteLine($"  First row: {reader.ReadLine()}");
}
ReadCsvFile(tempFile);

// What using expands to: try { body } finally { r?.Dispose(); }
Console.WriteLine("  using(var r = ...) { body }  ≡  try { body } finally { r.Dispose(); }");
```

      Line: col1,col2,col3
      Line: 1,2,3
      Line: 4,5,6
      Header: col1,col2,col3
      First row: 1,2,3
      using(var r = ...) { body }  ≡  try { body } finally { r.Dispose(); }

#### Custom IDisposable

```csharp
// CsvWriter — custom IDisposable that flushes and closes on Dispose

public class CsvWriter : IDisposable
{
    private readonly StreamWriter _writer;
    private bool _disposed = false;

    public CsvWriter(string path)
    {
        _writer = new StreamWriter(path);
        _writer.WriteLine("name,salary,dept");
    }

    public void WriteRow(string name, int salary, string dept)
    {
        if (_disposed) throw new ObjectDisposedException(nameof(CsvWriter));
        _writer.WriteLine($"{name},{salary},{dept}");
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            _writer.Flush();
            _writer.Dispose();
            _disposed = true;
            Console.WriteLine("  CsvWriter disposed (file flushed and closed)");
        }
    }
}
```

#### Using custom IDisposable — CsvWriter with `using`

```csharp
// using block calls Dispose() automatically at closing brace

var outFile = Path.GetTempFileName();
using (var csv = new CsvWriter(outFile))
{
    csv.WriteRow("Alice", 95000, "Engineering");
    csv.WriteRow("Bob", 65000, "Sales");
}
Console.WriteLine($"  Output: {File.ReadAllText(outFile).Trim()}");

File.Delete(tempFile);
File.Delete(outFile);
```

      CsvWriter disposed (file flushed and closed)
      Output: name,salary,dept
    Alice,95000,Engineering
    Bob,65000,Sales

## Data Engineering — error accumulation and resilience patterns

#### ParseResult record — structured result type for error accumulation

`record ParseResult(Name, Salary, IsValid, Error)` captures both successful parses and failures. Process all rows, partition results into valid/invalid, route errors to dead-letter. No exceptions for expected bad data — faster than try/catch per row. Throwing on each bad row is 1000x slower at scale.

```csharp
// ParseResult — record for accumulating parse outcomes (valid records + errors)
#nullable enable
record ParseResult(string Name, int Salary, bool IsValid, string? Error);
```

#### TryParse pattern

```csharp
// TryParse pattern — return false instead of throwing on invalid input

string[] values = { "42", "bad", "100", "", "999" };
foreach (var v in values)
{
    if (int.TryParse(v, out int result))
        Console.WriteLine($"  '{v}' → {result}");
    else
        Console.WriteLine($"  '{v}' → [invalid, skipped]");
}

// Similarly: double.TryParse, DateTime.TryParse, Enum.TryParse
DateTime.TryParse("2024-01-15", out var date);
Console.WriteLine($"  Date parsed: {date:yyyy-MM-dd}");
```

      '42' → 42
      'bad' → [invalid, skipped]
      '100' → 100
      '' → [invalid, skipped]
      '999' → 999
      Date parsed: 2024-01-15

#### Error accumulation — ETL pattern

```csharp
// Error accumulation — ETL pattern collecting all errors, not just first

ParseResult ParseEmployee(string csvLine, int rowNum)
{
    var parts = csvLine.Split(',');
    if (parts.Length < 2)
        return new ParseResult("", 0, false, $"Row {rowNum}: expected 2 columns, got {parts.Length}");
    if (!int.TryParse(parts[1].Trim(), out int salary))
        return new ParseResult("", 0, false, $"Row {rowNum}: invalid salary '{parts[1].Trim()}'");
    if (salary < 0)
        return new ParseResult("", 0, false, $"Row {rowNum}: salary cannot be negative ({salary})");
    return new ParseResult(parts[0].Trim(), salary, true, null);
}

string[] inputRows = {
    "Alice, 95000",
    "Bob, not_a_number",
    "Charlie",
    "Diana, 78000",
    "Eve, -500",
    "Frank, 72000",
};

var results = inputRows.Select((row, i) => ParseEmployee(row, i + 1)).ToList();
var good = results.Where(r => r.IsValid).ToList();
var bad  = results.Where(r => !r.IsValid).ToList();

Console.WriteLine($"  Processed: {results.Count} rows, Valid: {good.Count}, Rejected: {bad.Count}");
foreach (var r in good) Console.WriteLine($"    {r.Name,-10} ${r.Salary:N0}");
foreach (var r in bad)  Console.WriteLine($"    ERROR: {r.Error}");
```

      Processed: 6 rows, Valid: 3, Rejected: 3
        Alice      $95'000
        Diana      $78'000
        Frank      $72'000
        ERROR: Row 2: invalid salary 'not_a_number'
        ERROR: Row 3: expected 2 columns, got 1
        ERROR: Row 5: salary cannot be negative (-500)

#### AggregateException — parallel errors

```csharp
// AggregateException — collect all errors from parallel/async operations

var tasks = new[]
{
    Task.Run(() => { throw new FormatException("Bad value in file A"); }),
    Task.Run(() => { /* succeeds */ }),
    Task.Run(() => { throw new IOException("File B not found"); }),
};

var allTasks = Task.WhenAll(tasks);
try
{
    await allTasks;
}
catch
{
    foreach (var ex in allTasks.Exception!.Flatten().InnerExceptions)
        Console.WriteLine($"  Task error: [{ex.GetType().Name}] {ex.Message}");
}
```

      Task error: [IOException] File B not found
      Task error: [FormatException] Bad value in file A

#### Retry pattern for transient errors

```csharp
// Retry pattern — exponential backoff for transient failures

async Task<T> WithRetry<T>(Func<Task<T>> operation, int maxAttempts = 3, int delayMs = 100)
{
    for (int attempt = 1; attempt <= maxAttempts; attempt++)
    {
        try
        {
            return await operation();
        }
        catch (Exception ex) when (attempt < maxAttempts)
        {
            Console.WriteLine($"  Attempt {attempt} failed: {ex.Message}. Retrying...");
            await Task.Delay(delayMs * attempt);
        }
    }
    throw new InvalidOperationException("Unreachable");
}

int callCount = 0;
var data = await WithRetry(async () =>
{
    callCount++;
    if (callCount < 3) throw new IOException($"Connection timeout (attempt {callCount})");
    return "data loaded successfully";
});
Console.WriteLine($"  Result after {callCount} attempts: {data}");
```

      Attempt 1 failed: Connection timeout (attempt 1). Retrying...
      Attempt 2 failed: Connection timeout (attempt 2). Retrying...
      Result after 3 attempts: data loaded successfully
