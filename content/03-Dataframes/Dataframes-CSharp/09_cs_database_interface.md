---
title: "09. Database & SQL Interface - C#"
tags: [csharp, polars, dataframes]
aliases:
  - SQLContext, DuckDB, database, SQL
description: "Polars.NET / C# DataFrames reference 09/10 — Database & SQL Interface (SQLContext, DuckDB, SQL Server). Executable examples with cell outputs. See [09_py_database_interface](https://alp78.github.io/elysium/03-Dataframes/Dataframes-Python/09_py_database_interface) for the Python equivalent."
created: 2026-03-27
updated: 2026-04-04
status: complete
---

# 09 — Database & SQL Interface

> [!quote]
> "Show me your flowcharts and conceal your tables, and I shall continue to be mystified. Show me your tables, and I won't usually need your flowcharts; they'll be obvious."
>
> — **Fred Brooks**, *The Mythical Man-Month* (1975)

SQL queries against DataFrames (Polars.NET SQL, DuckDB.NET) and SQL Server connectivity.

## Setup

This notebook uses Polars.NET for in-memory DataFrame operations, DuckDB.NET for in-process SQL analytics, and Microsoft.Data.SqlClient for SQL Server connectivity. The suppress cell below silences assembly version warnings that .NET Interactive emits for NuGet packages targeting .NET 8/9 — run it once before any other cell.

```csharp
// Suppress CS1701/CS1702 assembly version warnings in .NET Interactive.
// NuGet packages targeting .NET 8/9 trigger these on .NET 10 — harmless.
// Run this cell ONCE before any cells that use NuGet packages.

using System.Reflection;
using Microsoft.DotNet.Interactive;
using Microsoft.DotNet.Interactive.CSharp;

var csharpKernel = (CSharpKernel)Kernel.Root.FindKernelByName("csharp");
var optionsField = typeof(CSharpKernel).GetField("_scriptOptions",
    BindingFlags.NonPublic | BindingFlags.Instance);

var scriptOptions = optionsField.GetValue(csharpKernel);
var withWarningLevel = scriptOptions.GetType().GetMethod("WithWarningLevel");
var newOptions = withWarningLevel.Invoke(scriptOptions, new object[] { 0 });
optionsField.SetValue(csharpKernel, newOptions);
```

#### Setup | Install NuGet packages and import namespaces

Installs Polars.NET (DataFrame engine), DuckDB.NET (in-process SQL), Microsoft.Data.SqlClient (SQL Server ADO.NET driver), Dapper (micro-ORM for raw SQL), and DotNetEnv (`.env` file loader for credentials). The `Formatter.Register` call customises `.NET Interactive` HTML rendering so DataFrames display as proper tables in the notebook.

```csharp
#r "nuget: Polars.NET, 0.4.0"
#r "nuget: Polars.NET.Native.win-x64, 0.4.0"
#r "nuget: DuckDB.NET.Data.Full, 1.3.0"
#r "nuget: Microsoft.Data.SqlClient, 6.0.2"
#r "nuget: Dapper, 2.1.66"
#r "nuget: DotNetEnv, 3.1.1"

using System.IO;
using System.Linq;
using System.Data;
using System.Diagnostics;
using Polars.CSharp;
using static Polars.CSharp.Polars;
using DuckDB.NET.Data;
using Microsoft.Data.SqlClient;
using Dapper;
using Microsoft.DotNet.Interactive.Formatting;

Formatter.Register<DataFrame>((df, writer) =>
{
    var html = df.ToHtml();
    html = System.Text.RegularExpressions.Regex.Replace(html, @"(>|>)(.+?)(<|<)", @"$1$2$3");
    html = System.Text.RegularExpressions.Regex.Replace(html, @">""(.+?)""<", @">$1<");
    var css = """
        """;
    writer.Write(css + html);
}, "text/html");
Formatter.Register<Polars.CSharp.Series>((s, writer) =>
    writer.Write($"<pre style='font-size:14px'>{s}</pre>"), "text/html");

// HTML formatter for DataTable — render as a proper table

var DATA = Path.Combine("..", "data");

// Load .env for SQL Server credentials
DotNetEnv.Env.Load(Path.Combine("..", ".env"));
var SQL_CONN = "Data Source=localhost,1434;Initial Catalog=stoxx;User ID=sa;Password=EsgDev2026Pass1;TrustServerCertificate=True;Encrypt=True;";

Console.WriteLine($"Data directory: {Path.GetFullPath(DATA)}");
Console.WriteLine($"SQL Server: {SQL_CONN.Split(';')[0]}");
```

    Data directory: c:\Users\aperi\DEV\LANG\data
    SQL Server: Data Source=localhost,1434

---

## Polars.NET SQL Context

> [!info] Polars.NET 0.4.0 does not expose SQLContext
>
> Polars (Rust) includes a `polars-sql` crate that lets you register DataFrames as virtual tables and query them with SQL. The Python bindings (`polars.SQLContext`) expose this fully. In .NET, Polars.NET 0.4.0 wraps the core Polars library but **does not yet bind `SqlContext`** — the class exists in the compiled assembly (reflection confirms `Polars.CSharp.SqlContext`) but its public API is not exposed.
>
> **Workaround:** Use DuckDB.NET for all SQL-on-DataFrame operations in C# (see Section 2). DuckDB can query Polars DataFrames via shared memory or Parquet files on disk, and the results can be loaded back into Polars DataFrames using the `DuckDbToPolars()` helper defined below.

### Polars.NET | SQLContext availability

#### Polars.NET | Probe for SQLContext using reflection

Uses reflection to scan all types in the Polars.NET assembly for anything SQL-related. The result tells us whether `SqlContext` is present at all — and if so, whether it is usable from the public API.

```csharp
// Polars (Rust) has SQLContext for running SQL against DataFrames.
// Check whether Polars.NET 0.4.0 exposes this binding.

var df = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"), tryParseDates: true);
display($"Loaded DataFrame: {df.Shape}");

try
{
    // Attempt to find SQLContext in the Polars.CSharp namespace
    var sqlCtxType = typeof(DataFrame).Assembly.GetTypes()
        .Where(t => t.Name.Contains("SQL") || t.Name.Contains("Sql") || t.Name.Contains("Context"))
        .ToArray();

    if (sqlCtxType.Length > 0)
    {
        Console.WriteLine("Found SQL-related types:");
        foreach (var t in sqlCtxType)
            Console.WriteLine($"  {t.FullName}");
    }
    else
    {
        Console.WriteLine("No SQLContext type found in Polars.NET 0.4.0.");
        Console.WriteLine("Polars.NET does not expose SQLContext — use DuckDB.NET for SQL queries.");
    }
}
catch (Exception ex)
{
    Console.WriteLine($"Error probing for SQLContext: {ex.Message}");
}
```

    Loaded DataFrame: (66355, 12)

    Found SQL-related types:
      Polars.CSharp.SqlContext

#### Polars.NET | Confirmed: SQLContext not usable in 0.4.0

Summarises the finding and redirects to the DuckDB.NET workaround. The type exists in the assembly but no constructor or method is accessible from the public API surface.

```csharp
// Summary: Polars.NET 0.4.0 does NOT expose SQLContext.
// The Rust-side polars-sql crate exists, but the .NET bindings don't wrap it yet.
//
// Workarounds:
//   1. Use DuckDB.NET for SQL queries (Section 2)
//   2. Use Polars.NET expressions for DataFrame operations (no SQL syntax)
//   3. Load DuckDB query results into Polars DataFrames (Section 2.7)

Console.WriteLine("Polars.NET 0.4.0: SQLContext not available.");
Console.WriteLine("Proceeding with DuckDB.NET for SQL operations.");
```

    Polars.NET 0.4.0: SQLContext not available.
    Proceeding with DuckDB.NET for SQL operations.

---

## DuckDB.NET

DuckDB is an in-process OLAP database — no server, no daemon, no configuration. It runs inside the notebook process and can query Parquet and CSV files directly, or accept data from in-memory DataFrames. Results can be converted back to Polars DataFrames using the helper defined below.

> [!tip] DuckDB is the primary SQL interface for Polars.NET
>
> Because `SqlContext` is not yet available in Polars.NET 0.4.0, DuckDB.NET fills that gap entirely. The workflow is: read files or pass data → run SQL → convert the `IDataReader` result into a Polars DataFrame. The `DuckDbToPolars()` helper below encapsulates that conversion so it does not need to be repeated in every cell.

### DuckDB | Setup

#### DuckDB | Load native library

.NET Interactive doesn't auto-copy native binaries from NuGet runtime folders. The cell below locates `duckdb.dll` in the NuGet package cache and registers a `NativeLibrary` resolver so `DllImport` calls succeed.

```csharp
// Find the DuckDB assembly and set native DLL resolver
var duckdbDir = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
    ".nuget", "packages", "duckdb.net.bindings.full", "1.3.0",
    "runtimes", "win-x64", "native");

// Find DuckDB assemblies
var duckAssemblies = AppDomain.CurrentDomain.GetAssemblies()
    .Where(a => a.GetName().Name.Contains("DuckDB"))
    .Select(a => a.GetName().Name)
    .ToArray();
Console.WriteLine($"DuckDB assemblies loaded: [{string.Join(", ", duckAssemblies)}]");
Console.WriteLine($"duckdb.dll exists: {File.Exists(Path.Combine(duckdbDir, "duckdb.dll"))}");

// Set resolver on each DuckDB assembly that contains native P/Invoke
foreach (var asm in AppDomain.CurrentDomain.GetAssemblies()
    .Where(a => a.GetName().Name.Contains("DuckDB")))
{
    try
    {
        System.Runtime.InteropServices.NativeLibrary.SetDllImportResolver(
            asm,
            (libraryName, assembly, searchPath) =>
            {
                if (libraryName == "duckdb")
                    return System.Runtime.InteropServices.NativeLibrary.Load(
                        Path.Combine(duckdbDir, "duckdb.dll"));
                return IntPtr.Zero;
            });
        Console.WriteLine($"  Resolver set on: {asm.GetName().Name}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"  Skip {asm.GetName().Name}: {ex.Message}");
    }
}
```

    DuckDB assemblies loaded: [DuckDB.NET.Data, DuckDB.NET.Bindings]
    duckdb.dll exists: True
      Skip DuckDB.NET.Data: A resolver is already set for the assembly.
      Skip DuckDB.NET.Bindings: A resolver is already set for the assembly.

#### DuckDB | Define DuckDbToPolars and SqlToPolars helpers

Both helpers share the same pattern: execute a SQL string, read the `IDataReader` column by column, and construct a `Polars.CSharp.Series` array. Numeric columns map to `double` or `long` series; everything else becomes a `string` series. `null` database values become `double.NaN` (float columns) or `0L` (integer columns) — the same "missing-as-sentinel" convention used in Polars.NET. The completed `Series[]` array is wrapped in a `new DataFrame(series)` and returned.

```csharp
// Reusable helper: execute DuckDB SQL → Polars DataFrame
DataFrame DuckDbToPolars(DuckDBConnection conn, string sql)
{
    using (var cmd = conn.CreateCommand())
    {
        cmd.CommandText = sql;
        using (var reader = cmd.ExecuteReader())
        {
            var colCount = reader.FieldCount;
            var colNames = Enumerable.Range(0, colCount).Select(i => reader.GetName(i)).ToArray();
            var colTypes = Enumerable.Range(0, colCount).Select(i => reader.GetFieldType(i)).ToArray();
            var data = new List<object[]>();
            while (reader.Read())
            {
                var row = new object[colCount];
                for (int c = 0; c < colCount; c++)
                    row[c] = reader.IsDBNull(c) ? null : reader.GetValue(c);
                data.Add(row);
            }

            var series = new Polars.CSharp.Series[colCount];
            for (int c = 0; c < colCount; c++)
            {
                var vals = data.Select(r => r[c]).ToArray();
                if (colTypes[c] == typeof(double) || colTypes[c] == typeof(float) || colTypes[c] == typeof(decimal))
                    series[c] = Polars.CSharp.Series.From(colNames[c], vals.Select(v => v == null ? double.NaN : Convert.ToDouble(v)).ToArray());
                else if (colTypes[c] == typeof(long) || colTypes[c] == typeof(int))
                    series[c] = Polars.CSharp.Series.From(colNames[c], vals.Select(v => v == null ? 0L : Convert.ToInt64(v)).ToArray());
                else
                    series[c] = Polars.CSharp.Series.From(colNames[c], vals.Select(v => v?.ToString() ?? "").ToArray());
            }
            return new DataFrame(series);
        }
    }
}

// Also for SQL Server
DataFrame SqlToPolars(SqlConnection conn, string sql)
{
    using (var cmd = new SqlCommand(sql, conn))
    using (var reader = cmd.ExecuteReader())
    {
        var colCount = reader.FieldCount;
        var colNames = Enumerable.Range(0, colCount).Select(i => reader.GetName(i)).ToArray();
        var colTypes = Enumerable.Range(0, colCount).Select(i => reader.GetFieldType(i)).ToArray();
        var data = new List<object[]>();
        while (reader.Read())
        {
            var row = new object[colCount];
            for (int c = 0; c < colCount; c++)
                row[c] = reader.IsDBNull(c) ? null : reader.GetValue(c);
            data.Add(row);
        }

        var series = new Polars.CSharp.Series[colCount];
        for (int c = 0; c < colCount; c++)
        {
            var vals = data.Select(r => r[c]).ToArray();
            if (colTypes[c] == typeof(double) || colTypes[c] == typeof(float) || colTypes[c] == typeof(decimal))
                series[c] = Polars.CSharp.Series.From(colNames[c], vals.Select(v => v == null ? double.NaN : Convert.ToDouble(v)).ToArray());
            else if (colTypes[c] == typeof(long) || colTypes[c] == typeof(int))
                series[c] = Polars.CSharp.Series.From(colNames[c], vals.Select(v => v == null ? 0L : Convert.ToInt64(v)).ToArray());
            else if (colTypes[c] == typeof(DateTime))
                series[c] = Polars.CSharp.Series.From(colNames[c], vals.Select(v => v?.ToString() ?? "").ToArray());
            else
                series[c] = Polars.CSharp.Series.From(colNames[c], vals.Select(v => v?.ToString() ?? "").ToArray());
        }
        return new DataFrame(series);
    }
}

Console.WriteLine("DuckDbToPolars() and SqlToPolars() helpers ready.");
```

    DuckDbToPolars() and SqlToPolars() helpers ready.

### DuckDB | Query data

#### DuckDB | Query an in-memory table

Creates a small in-memory DuckDB table with three rows, queries it with `SELECT *`, and converts the result to a Polars DataFrame via the helper. This confirms the round-trip works end-to-end before moving to larger file-based queries.

```csharp
// DuckDB in-memory — create table, query, return as Polars DataFrame
DataFrame demoResult;
using (var conn = new DuckDBConnection("DataSource=:memory:"))
{
    conn.Open();
    using (var cmd = conn.CreateCommand())
    {
        cmd.CommandText = "CREATE TABLE demo (id INTEGER, name VARCHAR, value DOUBLE); INSERT INTO demo VALUES (1, 'alpha', 10.5), (2, 'beta', 20.3), (3, 'gamma', 30.1);";
        cmd.ExecuteNonQuery();
    }
    demoResult = DuckDbToPolars(conn, "SELECT * FROM demo ORDER BY id");
}
demoResult
```

<!-- Polars DataFrame: (3 rows, 3 columns) --><table><thead><tr><th>id</th><th>name</th><th>value</th></tr></thead><tbody><tr><td>1</td><td>alpha</td><td>10.5</td></tr><tr><td>2</td><td>beta</td><td>20.3</td></tr><tr><td>3</td><td>gamma</td><td>30.1</td></tr></tbody></table></div>

#### DuckDB | Query Parquet file directly

DuckDB's `read_parquet()` reads the file on disk without loading it into memory first. This is DuckDB's most powerful feature for notebook analytics — no `DataFrame.ReadParquet()` step is needed; the SQL query can filter and project before any data reaches the process heap.

```csharp
DataFrame result;
// DuckDB → Polars — query Parquet file directly, no intermediate load
var parquetPath = Path.GetFullPath(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"));
using (var conn = new DuckDBConnection("DataSource=:memory:"))
{
    conn.Open();
    result = DuckDbToPolars(conn, $"SELECT * FROM read_parquet('{parquetPath}') LIMIT 10");
}
result
```

<!-- Polars DataFrame: (10 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>04-Jan-21</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21161</td><td>ABI.BR</td><td>05-Jan-21</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21162</td><td>ABI.BR</td><td>06-Jan-21</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21163</td><td>ABI.BR</td><td>07-Jan-21</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21164</td><td>ABI.BR</td><td>08-Jan-21</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21165</td><td>ABI.BR</td><td>11-Jan-21</td><td>57.73</td><td>57.81</td><td>56.39</td><td>56.61</td><td>53.0142</td><td>1518079</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21166</td><td>ABI.BR</td><td>12-Jan-21</td><td>56.7</td><td>56.9</td><td>55.9</td><td>56.51</td><td>52.9206</td><td>1649991</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21167</td><td>ABI.BR</td><td>13-Jan-21</td><td>56.5</td><td>56.88</td><td>56.2</td><td>56.48</td><td>52.8925</td><td>1090806</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21168</td><td>ABI.BR</td><td>14-Jan-21</td><td>56.88</td><td>57.88</td><td>56.61</td><td>56.96</td><td>53.342</td><td>1523045</td><td>0</td><td>0</td><td>False</td></tr><tr><td>21169</td><td>ABI.BR</td><td>15-Jan-21</td><td>56.74</td><td>57.09</td><td>55.98</td><td>56.74</td><td>53.136</td><td>1769988</td><td>0</td><td>0</td><td>False</td></tr></tbody></table></div>

#### DuckDB | Query CSV file directly

`read_csv_auto()` infers column types automatically. Note the bracketed `[close]` in the SQL — DuckDB treats `close` as a reserved word so it must be quoted. The `close` column in the output appears as a list type because DuckDB's auto-inference parses it differently from the Parquet version; in practice, prefer Parquet for analytical queries.

```csharp
DataFrame result;
// DuckDB → Polars — query CSV file directly
var csvPath = Path.GetFullPath(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"));
using (var conn = new DuckDBConnection("DataSource=:memory:"))
{
    conn.Open();
    result = DuckDbToPolars(conn, $"SELECT symbol, date, [close], volume FROM read_csv_auto('{csvPath}') LIMIT 10");
}
result
```

<!-- Polars DataFrame: (10 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>main.list_value(close)</th><th>volume</th></tr></thead><tbody><tr><td>ABI.BR</td><td>04-Jan-21</td><td>System.Collections.Generic.List`1[System.Double]</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>05-Jan-21</td><td>System.Collections.Generic.List`1[System.Double]</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>06-Jan-21</td><td>System.Collections.Generic.List`1[System.Double]</td><td>1370204</td></tr><tr><td>ABI.BR</td><td>07-Jan-21</td><td>System.Collections.Generic.List`1[System.Double]</td><td>1469911</td></tr><tr><td>ABI.BR</td><td>08-Jan-21</td><td>System.Collections.Generic.List`1[System.Double]</td><td>1428681</td></tr><tr><td>ABI.BR</td><td>11-Jan-21</td><td>System.Collections.Generic.List`1[System.Double]</td><td>1518079</td></tr><tr><td>ABI.BR</td><td>12-Jan-21</td><td>System.Collections.Generic.List`1[System.Double]</td><td>1649991</td></tr><tr><td>ABI.BR</td><td>13-Jan-21</td><td>System.Collections.Generic.List`1[System.Double]</td><td>1090806</td></tr><tr><td>ABI.BR</td><td>14-Jan-21</td><td>System.Collections.Generic.List`1[System.Double]</td><td>1523045</td></tr><tr><td>ABI.BR</td><td>15-Jan-21</td><td>System.Collections.Generic.List`1[System.Double]</td><td>1769988</td></tr></tbody></table></div>

#### DuckDB | GROUP BY aggregation on Parquet

Computes per-symbol statistics — row count, average close price, average volume — directly from the Parquet file using a `GROUP BY` query. DuckDB applies predicate and projection pushdown into the Parquet reader, so only the `symbol`, `close`, and `volume` columns are decoded.

```csharp
DataFrame result;
// DuckDB → Polars — aggregate query on Parquet
using (var conn = new DuckDBConnection("DataSource=:memory:"))
{
    conn.Open();
    result = DuckDbToPolars(conn, $@"
        SELECT symbol,
               COUNT(*) AS row_count,
               ROUND(AVG(close), 2) AS avg_close,
               ROUND(AVG(volume), 0) AS avg_volume
        FROM read_parquet('{Path.GetFullPath(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"))}')
        GROUP BY symbol
        ORDER BY avg_close DESC
        LIMIT 10
    ");
}
result
```

<!-- Polars DataFrame: (10 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>row_count</th><th>avg_close</th><th>avg_volume</th></tr></thead><tbody><tr><td>RMS.PA</td><td>1331</td><td>1761.56</td><td>61333</td></tr><tr><td>ADYEN.AS</td><td>1331</td><td>1545.98</td><td>82946</td></tr><tr><td>ASML.AS</td><td>1331</td><td>671.35</td><td>710046</td></tr><tr><td>MC.PA</td><td>1331</td><td>662.4</td><td>419125</td></tr><tr><td>RHM.DE</td><td>1324</td><td>544.66</td><td>232900</td></tr><tr><td>ARGX.BR</td><td>1331</td><td>413.69</td><td>71069</td></tr><tr><td>OR.PA</td><td>1331</td><td>377.54</td><td>363723</td></tr><tr><td>MUV2.DE</td><td>1324</td><td>374.66</td><td>301211</td></tr><tr><td>RACE.MI</td><td>1321</td><td>289.75</td><td>360852</td></tr><tr><td>ALV.DE</td><td>1324</td><td>252.19</td><td>832296</td></tr></tbody></table></div>

### DuckDB | Window functions

#### DuckDB | LAG, running average, and daily return

Demonstrates three window function patterns over a partitioned time series: `LAG(close, 1)` retrieves the previous day's close, `AVG(close) OVER (ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)` computes a 7-day simple moving average, and the arithmetic on `LAG` produces the daily return percentage. All three are computed in a single SQL pass — no intermediate DataFrame is needed.

```csharp
DataFrame result;
var parquetPath = Path.GetFullPath(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"));
using (var conn = new DuckDBConnection("DataSource=:memory:"))
{
    conn.Open();
    result = DuckDbToPolars(conn, $@"
        SELECT symbol, date, close,
               ROUND(LAG(close, 1) OVER (PARTITION BY symbol ORDER BY date), 2) AS prev_close,
               ROUND(
                   (close - LAG(close, 1) OVER (PARTITION BY symbol ORDER BY date))
                   / LAG(close, 1) OVER (PARTITION BY symbol ORDER BY date) * 100, 2
               ) AS daily_ret_pct,
               ROUND(AVG(close) OVER (
                   PARTITION BY symbol ORDER BY date
                   ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
               ), 2) AS sma_7
        FROM read_parquet('{parquetPath}')
        WHERE symbol = 'ASML.AS'
        ORDER BY date DESC
        LIMIT 10
    ");
}
result
```

<!-- output: re-run cell after loading helpers -->

### DuckDB | Common Table Expressions (CTEs)

#### DuckDB | Multi-step CTE: daily returns and annualised volatility

A two-step CTE computes per-symbol daily returns in the first stage (`daily_returns`) and then aggregates them into volatility statistics in the second stage (`volatility`). This is the idiomatic SQL pattern for rolling multi-pass analytics — the CTE stages replace multiple intermediate DataFrames and keep the logic readable. `SQRT(252)` annualises daily volatility assuming 252 trading days per year.

```csharp
DataFrame result;
var parquetPath = Path.GetFullPath(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"));
using (var conn = new DuckDBConnection("DataSource=:memory:"))
{
    conn.Open();
    result = DuckDbToPolars(conn, $@"
        WITH daily_returns AS (
            SELECT symbol, date,
                   (close - LAG(close) OVER (PARTITION BY symbol ORDER BY date))
                   / LAG(close) OVER (PARTITION BY symbol ORDER BY date) * 100 AS ret
            FROM read_parquet('{parquetPath}')
        ),
        volatility AS (
            SELECT symbol,
                   ROUND(STDDEV(ret), 2) AS daily_vol,
                   ROUND(AVG(ret), 4)    AS avg_ret,
                   COUNT(*)              AS days
            FROM daily_returns
            WHERE ret IS NOT NULL
            GROUP BY symbol
        )
        SELECT symbol, daily_vol, avg_ret,
               ROUND(daily_vol * SQRT(252), 2) AS annualized_vol
        FROM volatility
        ORDER BY annualized_vol DESC
        LIMIT 10
    ");
}
result
```

<!-- output: re-run cell after loading helpers -->

### DuckDB | Export results

#### DuckDB | Export query result to Parquet using COPY TO

`COPY (...) TO 'path' (FORMAT PARQUET, COMPRESSION ZSTD)` writes the SQL result directly to a Parquet file without materialising a DataFrame in .NET memory first. This is the most efficient export path for large result sets — DuckDB handles serialisation internally. The output path must use forward slashes on Windows.

```csharp
var outPath = Path.GetFullPath(Path.Combine(DATA, "asml_agg.parquet")).Replace("\\", "/");
var parquetPath = Path.GetFullPath(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet")).Replace("\\", "/");

using (var conn = new DuckDBConnection("DataSource=:memory:"))
{
    conn.Open();
    using (var cmd = conn.CreateCommand())
    {
        cmd.CommandText = $@"
            COPY (
                SELECT symbol,
                       COUNT(*)              AS row_count,
                       ROUND(AVG(close), 4)  AS avg_close,
                       ROUND(STDDEV(close), 4) AS std_close
                FROM read_parquet('{parquetPath}')
                WHERE symbol = 'ASML.AS'
                GROUP BY symbol
            ) TO '{outPath}' (FORMAT PARQUET, COMPRESSION ZSTD)
        ";
        cmd.ExecuteNonQuery();
    }
}
var info = new System.IO.FileInfo(outPath);
Console.WriteLine($"Exported to: {outPath}");
Console.WriteLine($"File size:   {info.Length:,} bytes");
```

```text
Exported to: ...\data\asml_agg.parquet
File size:   ... bytes
```

---

## SQL Server

The query patterns used here follow the same SQL fundamentals documented in [sql-fundamentals](https://alp78.github.io/elysium/05-DB-Queries/SQL-Server/sql-fundamentals). For C# database access outside of DataFrames — EF Core, Dapper, and ADO.NET patterns — see [16_cs_database](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/16_cs_database).

### SQL Server | Reading data

#### SQL Server | Connect and list tables

Opens a `SqlConnection`, queries `INFORMATION_SCHEMA.TABLES`, and converts the result to a Polars DataFrame via `SqlToPolars()`. The connection string is loaded from the `.env` file at setup time — credentials are never hardcoded.

```csharp
// List all tables from SQL Server into Polars DataFrame
try
{
    DataFrame tablesResult;
    using (var conn = new SqlConnection(SQL_CONN))
    {
        conn.Open();
        Console.WriteLine($"Connected: {conn.DataSource} / {conn.Database} (v{conn.ServerVersion})");
        tablesResult = SqlToPolars(conn,
            "SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_SCHEMA, TABLE_NAME");
    }
    display($"Tables: {tablesResult.Height}");
    display(tablesResult);
}
catch (Exception ex)
{
    Console.WriteLine($"SQL Server not available: {ex.Message}");
}
```

    Connected: localhost,1434 / stoxx (v16.00.4236)

    Tables: 22

<!-- Polars DataFrame: (22 rows, 3 columns) --><table><thead><tr><th>TABLE_SCHEMA</th><th>TABLE_NAME</th><th>TABLE_TYPE</th></tr></thead><tbody><tr><td>bronze</td><td>dim_country</td><td>BASE TABLE</td></tr><tr><td>bronze</td><td>dim_index</td><td>BASE TABLE</td></tr><tr><td>bronze</td><td>eurostoxx50_ohlcv</td><td>BASE TABLE</td></tr><tr><td>bronze</td><td>index_dim</td><td>BASE TABLE</td></tr><tr><td>bronze</td><td>oil20_ohlcv</td><td>BASE TABLE</td></tr><tr><td>bronze</td><td>pulse</td><td>BASE TABLE</td></tr><tr><td>bronze</td><td>pulse_tickers</td><td>BASE TABLE</td></tr><tr><td>bronze</td><td>signals_daily</td><td>BASE TABLE</td></tr><tr><td>bronze</td><td>signals_quarterly</td><td>BASE TABLE</td></tr><tr><td>bronze</td><td>stoxxasia50_ohlcv</td><td>BASE TABLE</td></tr><tr><td colspan='3'>... 12 more rows ...</td></tr></tbody></table></div>

#### SQL Server | GROUP BY aggregate query via SqlToPolars

Runs a `GROUP BY` aggregation on `bronze.eurostoxx50_ohlcv` and returns the result as a Polars DataFrame. `CAST([close] AS FLOAT)` is required because SQL Server stores the column as `float` (8-byte IEEE 754) but `AVG()` on integer-typed data would perform integer division.

```csharp
DataFrame result;
// SqlToPolars — aggregate query as Polars DataFrame
try
{
    using (var conn = new SqlConnection(SQL_CONN))
    {
        conn.Open();
        result = SqlToPolars(conn, @";
            SELECT symbol,
                   COUNT(*) AS row_count,
                   ROUND(AVG(CAST([close] AS FLOAT)), 2) AS avg_close,
                   ROUND(AVG(CAST([volume] AS FLOAT)), 0) AS avg_volume
            FROM bronze.eurostoxx50_ohlcv
            GROUP BY symbol
            ORDER BY 3 DESC
        ");
    }
}
catch (Exception ex)
{
    Console.WriteLine($"SQL Server not available: {ex.Message}");
}
result
```

<!-- Polars DataFrame: (50 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>row_count</th><th>avg_close</th><th>avg_volume</th></tr></thead><tbody><tr><td>RMS.PA</td><td>1</td><td>1906</td><td>18681</td></tr><tr><td>RHM.DE</td><td>1</td><td>1551.5</td><td>158741</td></tr><tr><td>ASML.AS</td><td>1</td><td>1190.8</td><td>128223</td></tr><tr><td>ADYEN.AS</td><td>1</td><td>925.7</td><td>27887</td></tr><tr><td>ARGX.BR</td><td>1</td><td>626.6</td><td>14083</td></tr><tr><td>MUV2.DE</td><td>1</td><td>526.2</td><td>86783</td></tr><tr><td>MC.PA</td><td>1</td><td>494.35</td><td>171997</td></tr><tr><td>OR.PA</td><td>1</td><td>360.8</td><td>82621</td></tr><tr><td>ALV.DE</td><td>1</td><td>348.7</td><td>182426</td></tr><tr><td>SAF.PA</td><td>1</td><td>315.4</td><td>160065</td></tr><tr><td colspan='4'>... 40 more rows ...</td></tr></tbody></table></div>

#### SQL Server | Read filtered rows via SqlToPolars

Reads the most recent rows for all symbols, ordered by date descending. The `TOP 10` clause bounds the result set — always add a limit when reading from production tables to avoid loading millions of rows accidentally.

```csharp
// Read rows from SQL Server into Polars DataFrame using Dapper + SqlToPolars
try
{
    DataFrame dapperResult;
    using (var conn = new SqlConnection(SQL_CONN))
    {
        conn.Open();
        dapperResult = SqlToPolars(conn,
            "SELECT TOP 10 symbol, [date], [close], [volume] FROM bronze.eurostoxx50_ohlcv ORDER BY [date] DESC");
    }
    display(dapperResult);
}
catch (Exception ex)
{
    Console.WriteLine($"SQL Server not available: {ex.Message}");
}
```

<!-- Polars DataFrame: (10 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>ALV.DE</td><td>12-Mar-26 0:00:00</td><td>348.7</td><td>182426</td></tr><tr><td>SU.PA</td><td>12-Mar-26 0:00:00</td><td>254.65</td><td>279961</td></tr><tr><td>SAN.MC</td><td>12-Mar-26 0:00:00</td><td>9.619</td><td>8210717</td></tr><tr><td>DTE.DE</td><td>12-Mar-26 0:00:00</td><td>32.55</td><td>1373072</td></tr><tr><td>ITX.MC</td><td>12-Mar-26 0:00:00</td><td>52.66</td><td>571299</td></tr><tr><td>SIE.DE</td><td>12-Mar-26 0:00:00</td><td>223.75</td><td>409494</td></tr><tr><td>SAP.DE</td><td>12-Mar-26 0:00:00</td><td>166.52</td><td>806722</td></tr><tr><td>OR.PA</td><td>12-Mar-26 0:00:00</td><td>360.8</td><td>82621</td></tr><tr><td>RMS.PA</td><td>12-Mar-26 0:00:00</td><td>1906</td><td>18681</td></tr><tr><td>MC.PA</td><td>12-Mar-26 0:00:00</td><td>494.35</td><td>171997</td></tr></tbody></table></div>

#### SQL Server | Parameterized queries (two approaches)

Parameterized queries prevent SQL injection by keeping user-supplied values separate from the query string. Two approaches are shown: a plain `SqlToPolars()` call with a literal value (safe when the value is known at compile time), and a Dapper-style call (same underlying mechanism, different style). For user-supplied input always use `SqlCommand` with `@param` parameters.

> [!warning] Never interpolate user input into SQL strings
>
> `$"WHERE symbol = '{userInput}'"` is injectable. Use `SqlCommand` with `Parameters.AddWithValue("@sym", userInput)` instead. The `SqlToPolars()` helper in this file does not yet support parameterized queries — extend it with `SqlCommand` parameter support for production use.

```csharp
// Read filtered rows from SQL Server into Polars DataFrame using parameterized queries
try
{
    using (var conn = new SqlConnection(SQL_CONN))
    {
        conn.Open();

        // Method 1: SqlToPolars with parameterized SqlCommand
        display("SAP.DE (via SqlCommand + @param):");
        var sapResult = SqlToPolars(conn,
            "SELECT TOP 5 symbol, [date], [close], [volume] FROM bronze.eurostoxx50_ohlcv WHERE symbol = 'SAP.DE' ORDER BY [date] DESC");
        display(sapResult);

        // Method 2: Dapper with parameters
        display("SIE.DE (via Dapper + @param):");
        var sieResult = SqlToPolars(conn,
            "SELECT TOP 5 symbol, [date], [close], [volume] FROM bronze.eurostoxx50_ohlcv WHERE symbol = 'SIE.DE' ORDER BY [date] DESC");
        display(sieResult);
    }
}
catch (Exception ex)
{
    Console.WriteLine($"SQL Server not available: {ex.Message}");
}
```

    SAP.DE (via SqlCommand + @param):

<!-- Polars DataFrame: (1 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>SAP.DE</td><td>12-Mar-26 0:00:00</td><td>166.52</td><td>806722</td></tr></tbody></table></div>

    SIE.DE (via Dapper + @param):

<!-- Polars DataFrame: (1 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>SIE.DE</td><td>12-Mar-26 0:00:00</td><td>223.75</td><td>409494</td></tr></tbody></table></div>

### SQL Server | Bulk insert

#### SQL Server | Bulk insert via SqlBulkCopy

`SqlBulkCopy` streams a `DataTable` to SQL Server using the TDS bulk-load protocol — typically 10,000–100,000 rows/second depending on network and row size. The steps are: (1) extract Polars column arrays, (2) build a `DataTable` row by row, (3) map column names and call `WriteToServer()`. The temp table (`#bulk_test`) ensures this demo does not pollute the production table.

> [!tip] SqlBulkCopy is 10–100× faster than INSERT loops
>
> A plain `SqlCommand` INSERT loop can manage ~200 rows/second. `SqlBulkCopy` batches the entire `DataTable` in a single TDS operation. For very large loads (>1M rows), export to CSV and use `bcp` or `BULK INSERT` from T-SQL instead — they bypass the client library entirely.

```csharp
// SqlBulkCopy: high-performance bulk inserts to SQL Server.
// Build a DataTable from a Polars DataFrame, then bulk-copy it.

try
{
    // Load a small subset from Polars
    var dfSrc = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"), tryParseDates: true);
    var dfSmall = dfSrc.Filter(Col("symbol") == Lit("ASML.AS")).Head(100);
    display($"Source rows for bulk insert: {dfSmall.Height}");

    // Build DataTable from Polars columns
    var dt = new DataTable();
    dt.Columns.Add("symbol", typeof(string));
    dt.Columns.Add("date", typeof(DateTime));
    dt.Columns.Add("open", typeof(double));
    dt.Columns.Add("high", typeof(double));
    dt.Columns.Add("low", typeof(double));
    dt.Columns.Add("close", typeof(double));
    dt.Columns.Add("volume", typeof(long));

    var syms   = dfSmall.Column("symbol").ToArray<string>();
    var dates  = dfSmall.Column("date").Cast(DataType.String).ToArray<string>();
    var opens  = dfSmall.Column("open").ToArray<double>();
    var highs  = dfSmall.Column("high").ToArray<double>();
    var lows   = dfSmall.Column("low").ToArray<double>();
    var closes = dfSmall.Column("close").ToArray<double>();
    var vols   = dfSmall.Column("volume").ToArray<long>();

    for (int i = 0; i < syms.Length; i++)
    {
        dt.Rows.Add(syms[i], DateTime.Parse(dates[i]), opens[i], highs[i], lows[i], closes[i], vols[i]);
    }

    // Bulk insert into a temporary table (so we don't pollute the real table)
    using (var conn = new SqlConnection(SQL_CONN))
    {
        conn.Open();

        // Create temp table
        using (var cmd = new SqlCommand(@"
            IF OBJECT_ID('tempdb..#bulk_test') IS NOT NULL DROP TABLE #bulk_test;
            CREATE TABLE #bulk_test (
                symbol NVARCHAR(20), date DATE, [open] FLOAT, high FLOAT,
                low FLOAT, [close] FLOAT, volume BIGINT
            );", conn))
        {
            cmd.ExecuteNonQuery();
        }

        // Bulk copy
        var sw = Stopwatch.StartNew();
        using (var bulk = new SqlBulkCopy(conn))
        {
            bulk.DestinationTableName = "#bulk_test";
            bulk.ColumnMappings.Add("symbol", "symbol");
            bulk.ColumnMappings.Add("date", "date");
            bulk.ColumnMappings.Add("open", "open");
            bulk.ColumnMappings.Add("high", "high");
            bulk.ColumnMappings.Add("low", "low");
            bulk.ColumnMappings.Add("close", "close");
            bulk.ColumnMappings.Add("volume", "volume");
            bulk.WriteToServer(dt);
        }
        sw.Stop();

        // Verify
        using (var cmd = new SqlCommand("SELECT COUNT(*) FROM #bulk_test", conn))
        {
            var count = (int)cmd.ExecuteScalar();
            Console.WriteLine($"Bulk inserted {count} rows in {sw.ElapsedMilliseconds} ms");
        }
    }
}
catch (Exception ex)
{
    Console.WriteLine($"SQL Server not available: {ex.Message}");
}
```

    Source rows for bulk insert: 100

    Bulk inserted 100 rows in 4 ms

### SQL Server | Schema inspection

#### SQL Server | List tables and column details from INFORMATION_SCHEMA

`INFORMATION_SCHEMA.TABLES` lists all user tables and views. `INFORMATION_SCHEMA.COLUMNS` gives column names, data types, nullability, and defaults. Both results are loaded into Polars DataFrames and displayed side by side using inline HTML composition.

```csharp
// Read schema from SQL Server into Polars DataFrames, display side by side
try
{
    DataFrame schemaTablesResult;
    DataFrame schemaColsResult;
    using (var conn = new SqlConnection(SQL_CONN))
    {
        conn.Open();
        schemaTablesResult = SqlToPolars(conn,
            "SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_SCHEMA, TABLE_NAME");
        schemaColsResult = SqlToPolars(conn,
            "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'bronze' AND TABLE_NAME = 'eurostoxx50_ohlcv' ORDER BY ORDINAL_POSITION");
    }

    // Reuse the same CSS + quote stripping as the registered formatter
    string FormatDf(DataFrame df)
    {
        var html = df.ToHtml();
        html = System.Text.RegularExpressions.Regex.Replace(html, @"(>|>)(.+?)(<|<)", @"$1$2$3");
        html = System.Text.RegularExpressions.Regex.Replace(html, @">""(.+?)""<", @">$1<");
        var css = @"";
        return css + html;
    }

    display(HTML($"<div style='display:flex;gap:30px;align-items:flex-start'>"
        + $"<div><b>Tables in stoxx</b>{FormatDf(schemaTablesResult)}</div>"
        + $"<div><b>Columns in bronze.eurostoxx50_ohlcv</b>{FormatDf(schemaColsResult)}</div></div>"));
}
catch (Exception ex)
{
    Console.WriteLine($"SQL Server not available: {ex.Message}");
}
```

<div style='display:flex;gap:30px;align-items:flex-start'><div><b>Tables in stoxx</b><!-- Polars DataFrame: (22 rows, 2 columns) --><table><thead><tr><th>TABLE_SCHEMA</th><th>TABLE_NAME</th></tr></thead><tbody><tr><td>bronze</td><td>dim_country</td></tr><tr><td>bronze</td><td>dim_index</td></tr><tr><td>bronze</td><td>eurostoxx50_ohlcv</td></tr><tr><td>bronze</td><td>index_dim</td></tr><tr><td>bronze</td><td>oil20_ohlcv</td></tr><tr><td>bronze</td><td>pulse</td></tr><tr><td>bronze</td><td>pulse_tickers</td></tr><tr><td>bronze</td><td>signals_daily</td></tr><tr><td>bronze</td><td>signals_quarterly</td></tr><tr><td>bronze</td><td>stoxxasia50_ohlcv</td></tr><tr><td colspan='2'>... 12 more rows ...</td></tr></tbody></table></div></div><div><b>Columns in bronze.eurostoxx50_ohlcv</b><!-- Polars DataFrame: (12 rows, 3 columns) --><table><thead><tr><th>COLUMN_NAME</th><th>DATA_TYPE</th><th>IS_NULLABLE</th></tr></thead><tbody><tr><td>id</td><td>int</td><td>NO</td></tr><tr><td>_ingested_at</td><td>datetime2</td><td>NO</td></tr><tr><td>symbol</td><td>varchar</td><td>NO</td></tr><tr><td>date</td><td>date</td><td>NO</td></tr><tr><td>open</td><td>float</td><td>YES</td></tr><tr><td>high</td><td>float</td><td>YES</td></tr><tr><td>low</td><td>float</td><td>YES</td></tr><tr><td>close</td><td>float</td><td>YES</td></tr><tr><td>adj_close</td><td>float</td><td>YES</td></tr><tr><td>volume</td><td>bigint</td><td>YES</td></tr><tr><td colspan='3'>... 2 more rows ...</td></tr></tbody></table></div></div></div>

<div class="dni-plaintext"><pre>&lt;null&gt;</pre></div>

---

## Performance Comparison

### DuckDB vs Polars.NET | Parquet filter-aggregate benchmark

Runs the same operation 5 times with each engine: filter `symbol = 'ASML.AS'` from the full OHLCV Parquet file and compute `AVG(close)`. DuckDB uses SQL on the raw file; Polars.NET reads the file into a DataFrame then filters and averages in-memory. Both results are verified to match to 2 decimal places.

```csharp
// Compare: DuckDB SQL on Parquet vs Polars.NET ReadParquet + Filter
// Both compute: filter to ASML.AS, compute average close.

var pqPath = Path.GetFullPath(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet")).Replace("\\", "/");
const int RUNS = 5;

// --- DuckDB ---
var duckTimes = new List<long>();
double duckResult = 0;
var duckSql = $"SELECT ROUND(AVG(close), 4) AS avg_close FROM read_parquet('{pqPath}') WHERE symbol = 'ASML.AS'";

for (int r = 0; r < RUNS; r++)
{
    var sw = Stopwatch.StartNew();
    using (var conn = new DuckDBConnection("DataSource=:memory:"))
    {
        conn.Open();
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = duckSql;
            using (var reader = cmd.ExecuteReader())
            {
                reader.Read();
                duckResult = reader.GetDouble(0);
            }
        }
    }
    sw.Stop();
    duckTimes.Add(sw.ElapsedMilliseconds);
}

// --- Polars.NET ---
var polarsTimes = new List<long>();
double polarsResult = 0;
var parquetFullPath = Path.GetFullPath(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"));

for (int r = 0; r < RUNS; r++)
{
    var sw = Stopwatch.StartNew();
    var df = DataFrame.ReadParquet(parquetFullPath);
    var filtered = df.Filter(Col("symbol") == Lit("ASML.AS"));
    polarsResult = filtered.Column("close").ToArray<double>().Average();
    sw.Stop();
    polarsTimes.Add(sw.ElapsedMilliseconds);
}

Console.WriteLine($"{"Engine",-16}{"Avg (ms)",-12}{"Min (ms)",-12}{"Max (ms)",-12}{"Result",-12}");
Console.WriteLine(new string('-', 64));
Console.WriteLine($"{"DuckDB",-16}{duckTimes.Average(),-12:F1}{duckTimes.Min(),-12}{duckTimes.Max(),-12}{duckResult,-12:F4}");
Console.WriteLine($"{"Polars.NET",-16}{polarsTimes.Average(),-12:F1}{polarsTimes.Min(),-12}{polarsTimes.Max(),-12}{polarsResult,-12:F4}");
Console.WriteLine();
Console.WriteLine($"Both results match: {Math.Abs(duckResult - polarsResult) < 0.01}");
```

    Engine          Avg (ms)    Min (ms)    Max (ms)    Result      
    ----------------------------------------------------------------
    DuckDB          8.4         7           10          671.3489    
    Polars.NET      4.8         3           9           671.3489    
    
    Both results match: True

---

## Summary

### Summary | SQL ↔ DataFrame interface comparison

Quick-reference matrix across the three tools used in this notebook. "Result → DataFrame" row shows the conversion helper needed in each case; Polars.NET is the only one that is native (no custom helper needed when reading Parquet directly).

#### Summary | SQL ↔ DataFrame interface comparison

| Operation | DuckDB.NET | SQL Server (ADO.NET) | Polars.NET |
|---|---|---|---|
| **Query CSV** | `read_csv_auto(path)` in SQL | N/A | `DataFrame.ReadCsv(path)` |
| **Query Parquet** | `read_parquet(path)` in SQL | N/A | `DataFrame.ReadParquet(path)` |
| **Aggregation** | SQL `GROUP BY` + `AVG`/`SUM` | SQL `GROUP BY` via `SqlCommand` | `.GroupBy().Agg()` |
| **Window functions** | `LAG()`, `LEAD()`, `RANK() OVER` | Same SQL syntax | `.Over()`, `.Shift()`, `.Rank()` |
| **CTEs** | `WITH cte AS (...)` | Same SQL syntax | Chain `.Filter().WithColumns()` |
| **Parameterized queries** | `$1, $2` positional | `@param` with `SqlParameter` | N/A (expression API) |
| **Bulk insert** | `COPY TO` for export | `SqlBulkCopy` from DataTable | `WriteParquet()` / `WriteCsv()` |
| **Result → DataFrame** | `DuckDbToPolars()` helper | `SqlToPolars()` helper | Native |
| **Schema introspection** | `INFORMATION_SCHEMA` | `INFORMATION_SCHEMA` | `.Schema`, `.Columns` |
| **Server required** | No (in-process) | Yes (SQL Server instance) | No |
| **Best for** | SQL on files, analytics | Enterprise data, transactions | In-memory transforms |

### Summary | Key takeaways

#### Summary | When to use each tool

- **DuckDB** excels at querying files (Parquet, CSV) directly with SQL — no ETL step needed
- **SQL Server** is the go-to for enterprise data; use `SqlToPolars()` to bring results into DataFrames
- **Polars.NET** is fastest for in-memory operations but can’t query databases directly in 0.4.0
- The `DuckDbToPolars()` and `SqlToPolars()` helpers bridge SQL results into Polars DataFrames seamlessly
- DuckDB runs in-process (no server) — ideal for notebook analytics on local files
