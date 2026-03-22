---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [reference, programming-languages, csharp, dotnet, error-handling]
aliases: [exceptions, try catch, error handling, custom exceptions, exception hierarchy]
keywords: [try, catch, finally, throw, Exception, custom exception, when filter, IDisposable, using, Result]
description: "C# error handling reference with executable examples and cell outputs — covers try/catch/finally, exception hierarchy, custom exceptions, exception filters, and IDisposable/using. See [[08_ErrorHandling - Python]] for the Python equivalent."
related:
  - "[[08_ErrorHandling - Python]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 08. Error Handling - C#

## 1. try / catch / finally — The Basics


```C#
using System.IO;

// Error Handling — try/catch/finally
//
// KEY CONCEPTS:
// - try: the block where an exception might be thrown.
// - catch: handles the exception. Can have multiple catch blocks for different types.
//   C# matches catch blocks TOP TO BOTTOM — put most specific types first.
// - finally: ALWAYS runs, whether an exception occurred or not.
//   Used for cleanup: closing files, DB connections, releasing resources.
// - throw: raise a new exception, or re-throw the current one.
// - Python equivalent: try/except/else/finally (Python has 'else', C# does not)

// === Basic try/catch ===
Console.WriteLine("=== Basic try/catch ===");

try
{
    int[] arr = { 1, 2, 3 };
    Console.WriteLine(arr[10]);    // IndexOutOfRangeException
}
catch (IndexOutOfRangeException ex)
{
    // ex.Message: human-readable description
    // ex.StackTrace: full call stack at point of throw
    Console.WriteLine($"Caught: {ex.Message}");
}

// === Multiple catch blocks ===
Console.WriteLine("\n=== Multiple catch blocks ===");

void ParseRow(string input)
{
    try
    {
        // FormatException if input is not a valid int
        int value = int.Parse(input);
        // OverflowException if value too large for int
        int result = checked(value * 1000000); // checked: enables overflow checking for the expression
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
        // Exception is the base class — catches anything not caught above
        // Use as last resort; don't silently swallow exceptions here
        Console.WriteLine($"  Unexpected: {ex.GetType().Name}: {ex.Message}");
    }
}

ParseRow("42");           // ok
ParseRow("not_a_number"); // FormatException
ParseRow("999999");       // OverflowException (999999 * 1000000 > int.MaxValue)

// === Multiple catch blocks for different exception types ===
Console.WriteLine("\n=== Multiple catch types (File IO example) ===");
// FileNotFoundException  — subclass of IOException, must come FIRST
// UnauthorizedAccessException — NOT a subclass of IOException, separate catch
// IOException             — base class, catches remaining IO errors

void LoadFile(string path)
{
    try
    {
        var text = File.ReadAllText(path);
    }
    catch (FileNotFoundException)
    {
        // FileNotFoundException is a subclass of IOException — catch it first (more specific)
        Console.WriteLine($"  File not found: {path}");
    }
    catch (UnauthorizedAccessException)
    {
        // UnauthorizedAccessException is NOT an IOException — it's a separate type
        // Thrown when reading a directory path, or a file without permission
        Console.WriteLine($"  Permission denied: {path}");
    }
    catch (IOException ex)
    {
        // All other IO errors (disk full, network drive gone, etc.)
        Console.WriteLine($"  IO error: {ex.Message}");
    }
}

LoadFile("missing.csv");           // FileNotFoundException
LoadFile("C:\\Windows\\System32"); // UnauthorizedAccessException

// === catch with when filter ===
Console.WriteLine("\n=== catch when (conditional catch) ===");
// 'when' adds a boolean condition — only catches if condition is true
// Useful when one exception type can mean different things

void ParseValue(string input, bool strict)
{
    try
    {
        int.Parse(input);
    }
    catch (FormatException ex) when (strict)
    {
        // Only re-throws in strict mode; in lenient mode falls through to next catch
        // throw inside catch → propagates to caller
        throw new InvalidOperationException($"Strict mode: bad value '{input}'", ex);
    }
    catch (FormatException)
    {
        Console.WriteLine($"  Lenient mode: skipping bad value '{input}'");
    }
}

ParseValue("bad", false); // lenient — skips
try { ParseValue("bad", true); } // strict — throws
// handle the throw inside the catch
catch (InvalidOperationException ex) { Console.WriteLine($"  Strict caught: {ex.Message}"); }

// === finally — always runs ===
Console.WriteLine("\n=== finally ===");
// finally runs whether the try block succeeded OR threw an exception
// Use for: closing connections, releasing locks, logging

void ProcessWithCleanup(bool throwError)
{
    Console.WriteLine("  Opening resource...");
    try
    {
        Console.WriteLine("  Processing...");
        // throw inside try → handled locally if catch
        if (throwError) throw new InvalidOperationException("Something went wrong");
        Console.WriteLine("  Done.");
    }
    catch (InvalidOperationException ex)
    {
        Console.WriteLine($"  Error caught: {ex.Message}");
    }
    finally
    {
        // This runs even if the catch block re-throws or there's a return in try
        Console.WriteLine("  Closing resource (finally)");
    }
}

ProcessWithCleanup(false);
Console.WriteLine();
ProcessWithCleanup(true);

// === throw vs throw ex — preserving the stack trace ===
Console.WriteLine("\n=== throw vs throw ex ===");
// throw;      — re-throws the SAME exception, preserving original stack trace ✓
// throw ex;   — throws a NEW exception from here, stack trace resets to this line ✗
// throw new X("msg", ex); — wraps ex as InnerException, best for adding context ✓

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
    Console.WriteLine($"  Caused by: {ex.InnerException?.Message}"); // InnerException = original
}
```

    === Basic try/catch ===
    Caught: Index was outside the bounds of the array.
    
    === Multiple catch blocks ===
      Parsed: 42000000
      Format error: The input string 'not_a_number' was not in a correct format.
      Overflow: Arithmetic operation resulted in an overflow.
    
    === Multiple catch types (File IO example) ===
      File not found: missing.csv
      Permission denied: C:\Windows\System32
    
    === catch when (conditional catch) ===
      Lenient mode: skipping bad value 'bad'
      Strict caught: Strict mode: bad value 'bad'
    
    === finally ===
      Opening resource...
      Processing...
      Done.
      Closing resource (finally)
    
      Opening resource...
      Processing...
      Error caught: Something went wrong
      Closing resource (finally)
    
    === throw vs throw ex ===
      Outer: Pipeline failed during validation
      Caused by: bad input
    

## 2. Exception Types & Hierarchy


```C#
// Exception Types — what's thrown and when
#nullable enable
//
// Exception hierarchy:
//   object
//   └── Exception
//       ├── SystemException                     (runtime errors — most built-ins live here)
//       │   ├── ArgumentException
//       │   │   ├── ArgumentNullException
//       │   │   └── ArgumentOutOfRangeException
//       │   ├── ArithmeticException             (math errors)
//       │   │   ├── DivideByZeroException
//       │   │   └── OverflowException
//       │   ├── InvalidOperationException
//       │   ├── NullReferenceException
//       │   ├── IndexOutOfRangeException
//       │   ├── ArrayTypeMismatchException
//       │   ├── FormatException
//       │   ├── NotSupportedException
//       │   ├── NotImplementedException
//       │   ├── KeyNotFoundException
//       │   ├── OutOfMemoryException
//       │   ├── StackOverflowException
//       │   ├── TypeInitializationException
//       │   ├── AccessViolationException
//       │   ├── UnauthorizedAccessException     (NOT under IOException — separate branch)
//       │   ├── OperationCanceledException
//       │   │   └── TaskCanceledException
//       │   └── IOException                     (System.IO)
//       │       ├── FileNotFoundException
//       │       ├── DirectoryNotFoundException
//       │       ├── EndOfStreamException
//       │       ├── PathTooLongException
//       │       └── DriveNotFoundException
//       ├── AggregateException                  (wraps multiple exceptions from parallel tasks)
//       ├── ApplicationException                (obsolete — do NOT inherit from this)
//       └── your custom exceptions inherit directly from Exception (or a specific subclass)

// === Exception properties ===
Console.WriteLine("=== Exception properties ===");

try
{
    throw new ArgumentException("Value cannot be negative", "salary");
}
catch (ArgumentException ex)
{
    Console.WriteLine($"  Message:    {ex.Message}");       // human-readable description
    Console.WriteLine($"  ParamName:  {ex.ParamName}");     // which parameter caused it
    Console.WriteLine($"  Type:       {ex.GetType().Name}"); // exception class name
    // ex.StackTrace  — full call stack (long, skipped here)
    // ex.InnerException — wrapped original exception (null here)
    // ex.Data        — IDictionary for extra key/value context
}

// === Common exceptions in Data Engineering ===
Console.WriteLine("\n=== Data Engineering exceptions ===");

// 1. FormatException — bad CSV values, invalid date strings, non-numeric data
Console.WriteLine("\n1. FormatException (bad data type in source)");
string[] csvRow = { "Alice", "not_a_number", "2024-01-15" };
try
{
    int salary = int.Parse(csvRow[1]); // "not_a_number" is not an int
}
catch (FormatException ex)
{
    Console.WriteLine($"  Can't parse salary '{csvRow[1]}': {ex.Message}");
}

// 2. KeyNotFoundException — missing column in a dictionary/header map
Console.WriteLine("\n2. KeyNotFoundException (missing column)");
var row = new Dictionary<string, string> { ["name"] = "Alice", ["dept"] = "Eng" };
try
{
    var salary = row["salary"]; // column doesn't exist
}
catch (KeyNotFoundException)
{
    // Use TryGetValue to avoid this exception entirely:
    var salary = row.TryGetValue("salary", out var s) ? s : "0";
    Console.WriteLine($"  Column 'salary' missing, defaulting to: {salary}");
}

// 3. OverflowException — numeric overflow during aggregation
Console.WriteLine("\n3. OverflowException (numeric overflow)");
try
{
    // Use a variable — compiler rejects checked(int.MaxValue + 1) as a constant overflow
    int big = int.MaxValue;
    int total = checked(big + 1); // 'checked' turns overflow into exception at runtime
    // Without 'checked', C# silently wraps (int.MaxValue + 1 = int.MinValue)
}
catch (OverflowException ex)
{
    Console.WriteLine($"  Overflow: {ex.Message}");
    Console.WriteLine("  Use long or decimal for large aggregations");
}

// 4. NullReferenceException — missing optional field in JSON/CSV
Console.WriteLine("\n4. NullReferenceException (null field)");
string? optionalField = null; // nullable string — field was absent in source
try
{
    int len = optionalField!.Length; // intentionally dereference null to demo NullReferenceException
}
catch (NullReferenceException)
{
    // Better: use null-conditional operator ?. or null-coalescing ??
    int len = optionalField?.Length ?? 0;
    Console.WriteLine($"  Safe null handling: length = {len}");
}

// 5. ArgumentNullException — passed null where not allowed
Console.WriteLine("\n5. ArgumentNullException (null argument)");
void ProcessRecord(string record)
{
    // Guard clause — validate at method entry
    ArgumentNullException.ThrowIfNull(record); // C# 10+ shorthand
    // Equivalent to:
    // if (record is null) throw new ArgumentNullException(nameof(record));
    Console.WriteLine($"  Processing: {record}");
}

try { ProcessRecord(null!); }
catch (ArgumentNullException ex)
{
    Console.WriteLine($"  {ex.Message}");
}

// 6. InvalidOperationException — operation not valid in current state
Console.WriteLine("\n6. InvalidOperationException (bad state)");
var emptyList = new List<int>();
try
{
    int first = emptyList.First(); // sequence has no elements
}
catch (InvalidOperationException ex)
{
    Console.WriteLine($"  {ex.Message}");
    // Better: use FirstOrDefault() which returns null/0 instead of throwing
    int safe = emptyList.FirstOrDefault();
    Console.WriteLine($"  FirstOrDefault: {safe}");
}

// === Exception.Data — attaching context ===
Console.WriteLine("\n=== Exception.Data — attaching context ===");
// ex.Data is an IDictionary — attach extra info before re-throwing
try
{
    var ex2 = new FormatException("Invalid salary value");
    ex2.Data["row"] = 42;              // which row caused it
    ex2.Data["file"] = "salaries.csv"; // which file
    ex2.Data["value"] = "abc";         // the offending value
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

    === Exception properties ===
      Message:    Value cannot be negative (Parameter 'salary')
      ParamName:  salary
      Type:       ArgumentException
    
    === Data Engineering exceptions ===
    
    1. FormatException (bad data type in source)
      Can't parse salary 'not_a_number': The input string 'not_a_number' was not in a correct format.
    
    2. KeyNotFoundException (missing column)
      Column 'salary' missing, defaulting to: 0
    
    3. OverflowException (numeric overflow)
      Overflow: Arithmetic operation resulted in an overflow.
      Use long or decimal for large aggregations
    
    4. NullReferenceException (null field)
      Safe null handling: length = 0
    
    5. ArgumentNullException (null argument)
      Value cannot be null. (Parameter 'record')
    
    6. InvalidOperationException (bad state)
      Sequence contains no elements
      FirstOrDefault: 0
    
    === Exception.Data — attaching context ===
      Error: Invalid salary value
      Row:   42
      File:  salaries.csv
      Value: abc
    

## 3. Custom Exceptions


```C#
// Custom Exceptions — when built-in types aren't descriptive enough
//
// KEY CONCEPTS:
// - Inherit from Exception (NOT ApplicationException — that's obsolete).
// - Add domain-specific properties (row number, file name, column name).
// - Always provide constructors for (), (message), (message, innerException).
//   This makes your exception compatible with standard exception handling patterns.
// - Name ends in 'Exception' by convention.
// - Use custom exceptions when: the caller needs to distinguish your error from
//   generic ones, or when you need to attach structured context.
//
// INNER EXCEPTION PATTERN:
// - When you catch a low-level exception and re-throw a domain exception,
//   always pass the original as 'inner' — it becomes ex.InnerException.
// - "Inner" = structurally contained inside the wrapper (like a Russian doll).
//   The inner exception happened first chronologically, but is nested inside the outer.
// - This preserves the full cause chain for debugging.
//   Example chain: PipelineException → CsvParseException → FormatException
//
// WHY CATCH FormatException AND THROW CsvParseException?
// - int.Parse() can only throw what .NET built into it: FormatException.
//   You cannot make int.Parse() throw CsvParseException — it doesn't know about it.
// - So the pattern is: catch the low-level exception, wrap it with your domain context,
//   throw the domain exception upward. The caller then catches the domain exception.
// - You CANNOT catch CsvParseException in ParseSalary itself because nothing throws it
//   before that catch block — ParseSalary is the one that creates and throws it.
//
// NOTE: top-level statements must come FIRST, type declarations (class) LAST.

// === Using custom exceptions ===
Console.WriteLine("=== Custom exceptions in a CSV parser ===");

int ParseSalary(string value, int rowNum)
{
    try
    {
        return int.Parse(value); // throws FormatException if value is not a valid int
    }
    catch (FormatException ex)
    {
        // int.Parse only knows FormatException — we catch it here and wrap it.
        // We add domain context (row number, column name, raw value) that int.Parse doesn't have.
        // 'ex' (the FormatException) is passed as InnerException — preserved inside the wrapper.
        // The caller will catch CsvParseException and can access both the context AND the root cause.
        throw new CsvParseException(rowNum, "salary", value, ex);
        // chain: CsvParseException.InnerException → FormatException (thrown by int.Parse)
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
        // Caller catches the domain exception — structured properties, not just a message string
        Console.WriteLine($"  SKIP row {ex.RowNumber}: column '{ex.ColumnName}' bad value '{ex.RawValue}'");
        // ex.InnerException is the original FormatException thrown by int.Parse
        // its Message is generated by .NET: "The input string '...' was not in a correct format."
        Console.WriteLine($"         Caused by: {ex.InnerException?.Message}");
    }
}

// === Pipeline-level exception wrapping ===
Console.WriteLine("\n=== Pipeline-level exception wrapping ===");

void RunPipeline(string name)
{
    try
    {
        // Simulate transform stage failing with a parse error
        throw new CsvParseException(42, "amount", "$$$");
    }
    catch (CsvParseException ex)
    {
        // Wrap into a pipeline-level exception — adds pipeline name and stage.
        // 'ex' (the CsvParseException) becomes InnerException of PipelineException.
        // chain: PipelineException → CsvParseException → FormatException
        throw new PipelineException(name, "transform", "Parse error in input file", ex);
    }
}

try { RunPipeline("sales_etl"); }
catch (PipelineException ex)
{
    Console.WriteLine($"  Pipeline: {ex.PipelineName}");
    Console.WriteLine($"  Stage:    {ex.Stage}");
    Console.WriteLine($"  Message:  {ex.Message}");
    // Walk the InnerException chain: PipelineException → CsvParseException
    if (ex.InnerException is CsvParseException csv)
        Console.WriteLine($"  Root:     row {csv.RowNumber}, col '{csv.ColumnName}', value '{csv.RawValue}'");
}

// === When to use custom vs built-in ===
Console.WriteLine("\n=== When to use custom exceptions ===");
Console.WriteLine("Use custom when:");
Console.WriteLine("  - Caller needs to catch YOUR error specifically (not all FormatExceptions)");
Console.WriteLine("  - You need structured context (row number, column name, file path)");
Console.WriteLine("  - Error crosses a layer boundary (parse layer → pipeline layer)");
Console.WriteLine("Use built-in when:");
Console.WriteLine("  - ArgumentException, ArgumentNullException for bad inputs to public methods");
Console.WriteLine("  - InvalidOperationException for wrong object state");
Console.WriteLine("  - NotSupportedException / NotImplementedException for stubs");

// === Type declarations must come AFTER all top-level statements ===

// Custom exception for CSV parsing failures
// Inherits from Exception (not ApplicationException — that's obsolete)
public class CsvParseException : Exception
{
    public int RowNumber { get; }      // which row in the file caused the failure
    public string ColumnName { get; }  // which column had the bad value
    public string RawValue { get; }    // the actual bad value as a string

    // Constructor 1: no args (required for serialization compatibility)
    public CsvParseException() : base() { }

    // Constructor 2: message only
    public CsvParseException(string message) : base(message) { }

    // Constructor 3: message + inner exception
    // 'inner' is the original exception that caused this one (e.g. FormatException from int.Parse)
    // It is stored as InnerException — accessible via ex.InnerException
    // Always provide this constructor so callers can preserve the cause chain
    public CsvParseException(string message, Exception inner) : base(message, inner) { }

    // Constructor 4: domain-specific — the one you'll actually use in production
    // 'inner' is optional: pass it when wrapping a caught exception, omit when you originate the error
    //   e.g. wrap: throw new CsvParseException(row, col, val, formatEx);  // formatEx = InnerException
    //   e.g. originate: throw new CsvParseException(row, col, val);       // no inner — you detected this
    public CsvParseException(int rowNumber, string columnName, string rawValue, Exception inner = null)
        : base($"Row {rowNumber}: invalid value '{rawValue}' in column '{columnName}'", inner)
    {
        RowNumber = rowNumber;
        ColumnName = columnName;
        RawValue = rawValue;
    }
}

// Pipeline-level exception — wraps lower-level exceptions with pipeline context
public class PipelineException : Exception
{
    public string PipelineName { get; }
    public string Stage { get; }    // which stage failed: extract, transform, or load

    public PipelineException() : base() { }
    public PipelineException(string message) : base(message) { }
    // 'inner' preserved as InnerException — could be CsvParseException, IOException, etc.
    public PipelineException(string message, Exception inner) : base(message, inner) { }

    public PipelineException(string pipelineName, string stage, string message, Exception inner = null)
        : base($"[{pipelineName}/{stage}] {message}", inner)
    {
        PipelineName = pipelineName;
        Stage = stage;
    }
}
```

    === Custom exceptions in a CSV parser ===
      Row 1: Alice salary=95'000
      SKIP row 2: column 'salary' bad value 'not_a_number'
             Caused by: The input string 'not_a_number' was not in a correct format.
      Row 3: Charlie salary=110'000
    
    === Pipeline-level exception wrapping ===
      Pipeline: sales_etl
      Stage:    transform
      Message:  [sales_etl/transform] Parse error in input file
      Root:     row 42, col 'amount', value '$$$'
    
    === When to use custom exceptions ===
    Use custom when:
      - Caller needs to catch YOUR error specifically (not all FormatExceptions)
      - You need structured context (row number, column name, file path)
      - Error crosses a layer boundary (parse layer → pipeline layer)
    Use built-in when:
      - ArgumentException, ArgumentNullException for bad inputs to public methods
      - InvalidOperationException for wrong object state
      - NotSupportedException / NotImplementedException for stubs
    

## 4. Resource Cleanup: using & IDisposable


```C#
// Resource Cleanup — using & IDisposable
//
// KEY CONCEPTS:
// - IDisposable: interface with .Dispose() method — for objects that hold unmanaged
//   resources (file handles, DB connections, network streams, memory buffers).
// - using statement: calls .Dispose() automatically at end of block, EVEN if an
//   exception is thrown. Equivalent to try/finally + Dispose().
// - using declaration (C# 8+): 'using var x = ...' — disposes at end of scope.
// - Python equivalent: 'with' statement / context managers (__enter__/__exit__)
// - NOTE: top-level statements must come FIRST, type declarations (class) LAST.

// === using statement (block form) ===
Console.WriteLine("=== using statement (block form) ===");

// Create a temp file to demo
var tempFile = Path.GetTempFileName();
File.WriteAllText(tempFile, "col1,col2,col3\n1,2,3\n4,5,6");

// StreamReader implements IDisposable — file handle freed on Dispose()
using (var reader = new StreamReader(tempFile))
{
    // reader.Dispose() is called automatically when this block exits,
    // even if an exception is thrown inside
    string? line;
    while ((line = reader.ReadLine()) != null)
        Console.WriteLine($"  Line: {line}");
} // <-- Dispose() called here

// === using declaration (C# 8+, scope-based) ===
Console.WriteLine("\n=== using declaration (scope form) ===");

void ReadCsvFile(string path)
{
    using var reader = new StreamReader(path); // no braces — disposes at end of method
    var header = reader.ReadLine();
    Console.WriteLine($"  Header: {header}");
    Console.WriteLine($"  First row: {reader.ReadLine()}");
} // <-- Dispose() called here (end of method scope)

ReadCsvFile(tempFile);

// === What using expands to (manually) ===
Console.WriteLine("\n=== What 'using' does under the hood ===");
// using (var r = new StreamReader(path)) { ... body ... }
// is exactly equivalent to:
//
// var r = new StreamReader(path);
// try   { ... body ... }
// finally { r?.Dispose(); }  // runs even if body throws
Console.WriteLine("  using(var r = ...) { body }  ≡  try { body } finally { r.Dispose(); }");

// === Custom IDisposable ===
Console.WriteLine("\n=== Custom IDisposable ===");

var outFile = Path.GetTempFileName();
using (var csv = new CsvWriter(outFile))
{
    csv.WriteRow("Alice", 95000, "Engineering");
    csv.WriteRow("Bob", 65000, "Sales");
    // Even if an exception occurs here, Dispose() is still called
}
Console.WriteLine($"  Output: {File.ReadAllText(outFile).Trim()}");

// Clean up temp files
File.Delete(tempFile);
File.Delete(outFile);

// === Type declarations must come AFTER all top-level statements ===

// Data Engineering scenario: a CSV writer that must flush & close on done
public class CsvWriter : IDisposable
{
    private readonly StreamWriter _writer;
    private bool _disposed = false;  // guard against double-dispose

    public CsvWriter(string path)
    {
        _writer = new StreamWriter(path);
        _writer.WriteLine("name,salary,dept"); // write header
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
            _writer.Flush(); // ensure all buffered data is written
            _writer.Dispose();
            _disposed = true;
            Console.WriteLine("  CsvWriter disposed (file flushed and closed)");
        }
    }
}
```

    === using statement (block form) ===
      Line: col1,col2,col3
      Line: 1,2,3
      Line: 4,5,6
    
    === using declaration (scope form) ===
      Header: col1,col2,col3
      First row: 1,2,3
    
    === What 'using' does under the hood ===
      using(var r = ...) { body }  ≡  try { body } finally { r.Dispose(); }
    
    === Custom IDisposable ===
      CsvWriter disposed (file flushed and closed)
      Output: name,salary,dept
    Alice,95000,Engineering
    Bob,65000,Sales
    

    
    (24,11): warning CS8632: The annotation for nullable reference types should only be used in code within a '#nullable' annotations context.
    
    

## 5. Data Engineering: Error Accumulation & Resilience Patterns


```C#
// Data Engineering Error Patterns
#nullable enable
//
// KEY PATTERNS:
// - Fail-fast: throw on first error. Good for dev/validation pipelines.
// - Accumulate errors: collect all errors, continue processing. Good for ETL.
// - Dead-letter: route bad records to a separate output, never discard silently.
// - Try-parse pattern: use TryParse/TryGetValue instead of Parse to avoid exceptions.
// - Retry: retry transient errors (network, DB timeouts) with backoff.
//
// NOTE: in C#, top-level statements must come FIRST, type declarations (record/class) LAST.

// === TryParse pattern — avoid exceptions for expected bad data ===
Console.WriteLine("=== TryParse — no exceptions for bad data ===");
// In a pipeline, bad data is EXPECTED — don't use exceptions for control flow
// int.Parse() throws FormatException on bad input
// int.TryParse() returns false — no exception, much faster at scale

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

// === Error accumulation — collect all errors, don't stop on first ===
Console.WriteLine("\n=== Error accumulation (ETL pattern) ===");

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
    "Bob, not_a_number",      // bad salary
    "Charlie",                // missing salary column
    "Diana, 78000",
    "Eve, -500",              // negative salary
    "Frank, 72000",
};

var results = inputRows.Select((row, i) => ParseEmployee(row, i + 1)).ToList();
var good = results.Where(r => r.IsValid).ToList();
var bad  = results.Where(r => !r.IsValid).ToList();

Console.WriteLine($"  Processed: {results.Count} rows");
Console.WriteLine($"  Valid:     {good.Count}");
Console.WriteLine($"  Rejected:  {bad.Count}");
Console.WriteLine("  Good records:");
foreach (var r in good)
    Console.WriteLine($"    {r.Name,-10} ${r.Salary:N0}");
Console.WriteLine("  Dead-letter (bad records):");
foreach (var r in bad)
    Console.WriteLine($"    ERROR: {r.Error}");

// === AggregateException — multiple errors from parallel processing ===
Console.WriteLine("\n=== AggregateException (parallel errors) ===");
// When tasks run in parallel (Task.WhenAll, Parallel.ForEach), multiple can fail.
// AggregateException wraps ALL failures — you can inspect every one.
//
// NOTE: 'await Task.WhenAll(...)' unwraps AggregateException and rethrows only the first
// inner exception. To get ALL errors, call Task.WhenAll without await first, then inspect
// the Task.Exception property which holds the full AggregateException.

var tasks = new[]
{
    Task.Run(() => { throw new FormatException("Bad value in file A"); }),
    Task.Run(() => { /* succeeds */ }),
    Task.Run(() => { throw new IOException("File B not found"); }),
};

var allTasks = Task.WhenAll(tasks);   // start all, don't await yet
try
{
    await allTasks; // throws — but only rethrows the first inner exception
}
catch
{
    // allTasks.Exception is the full AggregateException with ALL failures
    // .Flatten() unwraps nested AggregateExceptions into a single flat list
    foreach (var ex in allTasks.Exception!.Flatten().InnerExceptions)
        Console.WriteLine($"  Task error: [{ex.GetType().Name}] {ex.Message}");
}

// === Retry pattern for transient errors ===
Console.WriteLine("\n=== Retry pattern (transient failures) ===");
// Network timeouts, DB deadlocks, rate limits — should be retried, not failed immediately

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
            // 'when' only catches if we have retries left — last attempt falls through
            Console.WriteLine($"  Attempt {attempt} failed: {ex.Message}. Retrying...");
            await Task.Delay(delayMs * attempt); // exponential backoff
        }
    }
    throw new InvalidOperationException("Unreachable"); // compiler needs this
}

int callCount = 0;
var data = await WithRetry(async () =>
{
    callCount++;
    if (callCount < 3) throw new IOException($"Connection timeout (attempt {callCount})");
    return "data loaded successfully"; // succeeds on 3rd attempt
});
Console.WriteLine($"  Result after {callCount} attempts: {data}");

// === C# vs Python cheat sheet ===
Console.WriteLine("\n=== C# vs Python Error Handling ===");
Console.WriteLine(@"
C#                                    Python
──────────────────────────────────    ──────────────────────────────────
try { }                               try:
catch (FormatException ex) { }            except ValueError as e:
catch (IOException ex) { }               except IOError as e:
catch (Exception ex) { }                 except Exception as e:
finally { }                           finally:
                                      else:              ← C# has no 'else'
throw new X('msg');                   raise X('msg')
throw;                                raise              (re-raise)
throw new X('msg', inner);            raise X('msg') from inner
using (var r = new X()) { }          with X() as r:
int.TryParse(s, out int v)            try: v=int(s) except ValueError
AggregateException                    ExceptionGroup     (Python 3.11+)
");

// === Type declarations must come AFTER all top-level statements ===
record ParseResult(string Name, int Salary, bool IsValid, string? Error);
```

    === TryParse — no exceptions for bad data ===
      '42' → 42
      'bad' → [invalid, skipped]
      '100' → 100
      '' → [invalid, skipped]
      '999' → 999
      Date parsed: 2024-01-15
    
    === Error accumulation (ETL pattern) ===
      Processed: 6 rows
      Valid:     3
      Rejected:  3
      Good records:
        Alice      $95'000
        Diana      $78'000
        Frank      $72'000
      Dead-letter (bad records):
        ERROR: Row 2: invalid salary 'not_a_number'
        ERROR: Row 3: expected 2 columns, got 1
        ERROR: Row 5: salary cannot be negative (-500)
    
    === AggregateException (parallel errors) ===
      Task error: [FormatException] Bad value in file A
      Task error: [IOException] File B not found
    
    === Retry pattern (transient failures) ===
      Attempt 1 failed: Connection timeout (attempt 1). Retrying...
      Attempt 2 failed: Connection timeout (attempt 2). Retrying...
      Result after 3 attempts: data loaded successfully
    
    === C# vs Python Error Handling ===
    
    C#                                    Python
    ──────────────────────────────────    ──────────────────────────────────
    try { }                               try:
    catch (FormatException ex) { }            except ValueError as e:
    catch (IOException ex) { }               except IOError as e:
    catch (Exception ex) { }                 except Exception as e:
    finally { }                           finally:
                                          else:              ← C# has no 'else'
    throw new X('msg');                   raise X('msg')
    throw;                                raise              (re-raise)
    throw new X('msg', inner);            raise X('msg') from inner
    using (var r = new X()) { }          with X() as r:
    int.TryParse(s, out int v)            try: v=int(s) except ValueError
    AggregateException                    ExceptionGroup     (Python 3.11+)
    
    
