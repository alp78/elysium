---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [database access, SQL, ORM, pyodbc, Entity Framework, Dapper, SQLAlchemy, connection strings]
keywords: [Entity Framework, Dapper, SqlConnection, DbContext, LINQ to SQL, migrations, connection string, ORM]
description: "C# database reference with executable examples and cell outputs — covers Entity Framework Core, Dapper, raw ADO.NET, migrations, and connection string patterns. See [16_py_database](https://alp78.github.io/elysium/02-Programming-Languages/Python/16_py_database) for the Python equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 16. Database - C#

> [!quote]
> "Future users of large data banks must be protected from having to know how the data is organized in the machine."
> — **Edgar F. Codd**, *A Relational Model of Data for Large Shared Data Banks* (1970)


> [!info] Run this cell once before
>
> Run this cell once before any cells that use NuGet packages — suppresses harmless CS1701/CS1702 assembly version warnings.

```csharp
#r "nuget: Microsoft.Data.SqlClient"
#r "nuget: Microsoft.Data.Sqlite"
#r "nuget: System.Data.Odbc"
#r "nuget: Dapper"
#r "nuget: Microsoft.EntityFrameworkCore"
#r "nuget: Microsoft.EntityFrameworkCore.InMemory"
#r "nuget: DuckDB.NET.Data.Full, 1.3.0"
#r "nuget: Plotly.NET, 5.1.0"
#r "nuget: Plotly.NET.Interactive, 5.0.0"
#r "nuget: Plotly.NET.CSharp, 0.13.0"
#r "nuget: Polars.NET"
#r "nuget: Polars.NET.Native.win-x64"
using DuckDB.NET.Data;
using System.Reflection;
using Microsoft.DotNet.Interactive;
using Microsoft.DotNet.Interactive.CSharp;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Data.Sqlite;
using System.Data.Odbc;
using System.Data;
using Microsoft.DotNet.Interactive.Formatting;
using Microsoft.EntityFrameworkCore;
using Plotly.NET;
using Plotly.NET.CSharp;
using Plotly.NET.LayoutObjects;
using Polars.CSharp;
using static Polars.CSharp.Polars;


var csharpKernel = (CSharpKernel)Kernel.Root.FindKernelByName("csharp");
var optionsField = typeof(CSharpKernel).GetField("_scriptOptions",
    BindingFlags.NonPublic | BindingFlags.Instance);

var scriptOptions = optionsField.GetValue(csharpKernel);
var withWarningLevel = scriptOptions.GetType().GetMethod("WithWarningLevel");
var newOptions = withWarningLevel.Invoke(scriptOptions, new object[] { 0 });
optionsField.SetValue(csharpKernel, newOptions);



// extension method to .Head() datatables
static DataTable Head(this DataTable dt, int n = 5) 
    => dt.AsEnumerable().Take(n).CopyToDataTable();


// Register Polars DataFrame/Series HTML formatters (transparent for dark theme)
Formatter.Register<DataFrame>((df, writer) =>
{
    var html = df.ToHtml();
    html = System.Text.RegularExpressions.Regex.Replace(html, @"(>|>)&quot;(.+?)&quot;(<|<)", @"$1$2$3");
    html = System.Text.RegularExpressions.Regex.Replace(html, @">""(.+?)""<", @">$1<");
    var css = @"<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>";
    writer.Write(css + html);
}, "text/html");
Formatter.Register<Polars.CSharp.Series>((s, writer) =>
{
    var sdf = DataFrame.FromSeries(s);
    var shtml = sdf.ToHtml();
    shtml = System.Text.RegularExpressions.Regex.Replace(shtml, @"(>|>)&quot;(.+?)&quot;(<|<)", @"$1$2$3");
    shtml = System.Text.RegularExpressions.Regex.Replace(shtml, @">""(.+?)""<", @">$1<");
    var scss = @"<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>";
    writer.Write(scss + shtml);
}, "text/html");
```

#### DataTable helper for query display

```csharp
// Helper: execute SQL query and return a DataTable for styled display
DataTable QueryToTable(SqlConnection c, string sql)
{
    var dt = new DataTable();
    var cmd = new SqlCommand(sql, c);
    using var reader = cmd.ExecuteReader();
    dt.Load(reader);
    return dt;
}

DataTable QueryToTable(SqliteConnection c, string sql)
{
    var dt = new DataTable();
    var cmd = c.CreateCommand();
    cmd.CommandText = sql;
    using var reader = cmd.ExecuteReader();
    dt.Load(reader);
    return dt;
}
```

## SQLite — Lightweight Embedded Database

#### SQLite — create in-memory database and trades table

SQLite uses the ADO.NET pattern: `SqliteConnection`, `SqliteCommand`, `SqliteDataReader`.
`DataSource=:memory:` creates an in-memory database. Parameterised queries use `@param`
named placeholders. Python equivalent: `sqlite3.connect(":memory:")`.

> [!info] ADO.NET pattern (SQLite)
>
> - `SqliteConnection` / `SqliteCommand` / `SqliteDataReader` — same API as SqlClient
> - `@param` named placeholders prevent SQL injection
> - Always `using` connections to avoid leaks
> - SQLite is single-writer — use SQL Server for concurrent access

```csharp
var conn = new SqliteConnection("DataSource=:memory:");
conn.Open();

var cmd = conn.CreateCommand();
cmd.CommandText = @"
    CREATE TABLE trades (
        trade_id   TEXT PRIMARY KEY,
        ticker     TEXT NOT NULL,
        side       TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
        quantity   INTEGER NOT NULL CHECK(quantity > 0),
        price      REAL NOT NULL CHECK(price > 0),
        trade_date TEXT NOT NULL DEFAULT (date('now'))
    )";
cmd.ExecuteNonQuery();
Console.WriteLine("Created table: trades");
```

    Created table: trades

#### SQLite — INSERT with parameterised queries using `@param` placeholders

```csharp
// INSERT — parameterised to prevent SQL injection

var trades = new (string id, string ticker, string side, int qty, double price, string date)[]
{
    ("TRD_001", "ASML.AS", "BUY",  100, 685.40, "2026-03-15"),
    ("TRD_002", "MC.PA",   "BUY",   50, 890.20, "2026-03-15"),
    ("TRD_003", "SAP.DE",  "SELL",  75, 245.80, "2026-03-15"),
    ("TRD_004", "ASML.AS", "SELL",  30, 690.00, "2026-03-16"),
    ("TRD_005", "RMS.PA",  "BUY",   20, 2850.0, "2026-03-16"),
    ("TRD_006", "SIE.DE",  "BUY",  200, 198.50, "2026-03-17"),
};

foreach (var t in trades)
{
    cmd = conn.CreateCommand();
    cmd.CommandText = "INSERT INTO trades VALUES (@id, @ticker, @side, @qty, @price, @date)";
    cmd.Parameters.AddWithValue("@id", t.id);
    cmd.Parameters.AddWithValue("@ticker", t.ticker);
    cmd.Parameters.AddWithValue("@side", t.side);
    cmd.Parameters.AddWithValue("@qty", t.qty);
    cmd.Parameters.AddWithValue("@price", t.price);
    cmd.Parameters.AddWithValue("@date", t.date);
    cmd.ExecuteNonQuery();
}
Console.WriteLine($"Inserted {trades.Length} trades");
```

    Inserted 6 trades

#### SQLite — SELECT with computed columns and WHERE filter

```csharp
// SELECT all trades with computed notional column

QueryToTable(conn, "SELECT *, ROUND(quantity * price, 2) AS notional FROM trades ORDER BY trade_date, trade_id")
```

<table><thead><tr><th>trade_id</th><th>ticker</th><th>side</th><th>quantity</th><th>price</th><th>trade_date</th><th>notional</th></tr></thead><tbody><tr><td>TRD_001</td><td>ASML.AS</td><td>BUY</td><td>100</td><td>685.4</td><td>2026-03-15</td><td>68540</td></tr><tr><td>TRD_002</td><td>MC.PA</td><td>BUY</td><td>50</td><td>890.2</td><td>2026-03-15</td><td>44510</td></tr><tr><td>TRD_003</td><td>SAP.DE</td><td>SELL</td><td>75</td><td>245.8</td><td>2026-03-15</td><td>18435</td></tr><tr><td>TRD_004</td><td>ASML.AS</td><td>SELL</td><td>30</td><td>690</td><td>2026-03-16</td><td>20700</td></tr><tr><td>TRD_005</td><td>RMS.PA</td><td>BUY</td><td>20</td><td>2850</td><td>2026-03-16</td><td>57000</td></tr><tr><td>TRD_006</td><td>SIE.DE</td><td>BUY</td><td>200</td><td>198.5</td><td>2026-03-17</td><td>39700</td></tr></tbody></table>

#### SQLite — aggregate queries with GROUP BY for portfolio summary

```csharp
// Aggregate — net position per ticker

QueryToTable(conn, @"
    SELECT ticker AS Ticker,
           SUM(CASE WHEN side='BUY' THEN quantity ELSE -quantity END) AS [Net Shares],
           ROUND(SUM(CASE WHEN side='BUY' THEN quantity*price ELSE -quantity*price END), 2) AS [Net Notional],
           COUNT(*) AS [Trade Count]
    FROM trades GROUP BY ticker ORDER BY [Net Notional] DESC")
```

<table><thead><tr><th>Ticker</th><th>Net Shares</th><th>Net Notional</th><th>Trade Count</th></tr></thead><tbody><tr><td>RMS.PA</td><td>20</td><td>57000</td><td>1</td></tr><tr><td>ASML.AS</td><td>70</td><td>47840</td><td>2</td></tr><tr><td>MC.PA</td><td>50</td><td>44510</td><td>1</td></tr><tr><td>SIE.DE</td><td>200</td><td>39700</td><td>1</td></tr><tr><td>SAP.DE</td><td>-75</td><td>-18435</td><td>1</td></tr></tbody></table>

#### SQLite — UPDATE and DELETE rows

```csharp
// UPDATE price
cmd = conn.CreateCommand();
cmd.CommandText = "UPDATE trades SET price = @price WHERE trade_id = @id";
cmd.Parameters.AddWithValue("@price", 700.00);
cmd.Parameters.AddWithValue("@id", "TRD_004");
Console.WriteLine($"Updated TRD_004 price -> $700.00 ({cmd.ExecuteNonQuery()} row affected)");

// DELETE
cmd = conn.CreateCommand();
cmd.CommandText = "DELETE FROM trades WHERE trade_id = @id";
cmd.Parameters.AddWithValue("@id", "TRD_006");
Console.WriteLine($"Deleted TRD_006 ({cmd.ExecuteNonQuery()} row affected)");
```

    Updated TRD_004 price -> $700.00 (1 row affected)
    Deleted TRD_006 (1 row affected)

#### SQLite — transaction with atomic multi-row insert and rollback

```csharp
// Transaction — both inserts succeed or both roll back

Console.WriteLine("=== Transaction Example ===");
using (var tx = conn.BeginTransaction())
{
    try
    {
        var c1 = conn.CreateCommand();
        c1.Transaction = tx;
        c1.CommandText = "INSERT INTO trades VALUES (@id, @t, @s, @q, @p, date('now'))";
        c1.Parameters.AddWithValue("@id", "TRD_007");
        c1.Parameters.AddWithValue("@t", "TTE.PA");
        c1.Parameters.AddWithValue("@s", "BUY");
        c1.Parameters.AddWithValue("@q", 150);
        c1.Parameters.AddWithValue("@p", 58.30);
        c1.ExecuteNonQuery();

        var c2 = conn.CreateCommand();
        c2.Transaction = tx;
        c2.CommandText = "INSERT INTO trades VALUES (@id, @t, @s, @q, @p, date('now'))";
        c2.Parameters.AddWithValue("@id", "TRD_008");
        c2.Parameters.AddWithValue("@t", "BNP.PA");
        c2.Parameters.AddWithValue("@s", "BUY");
        c2.Parameters.AddWithValue("@q", 80);
        c2.Parameters.AddWithValue("@p", 72.10);
        c2.ExecuteNonQuery();

        tx.Commit();
        Console.WriteLine("  Transaction committed (2 trades inserted)");
    }
    catch (Exception ex)
    {
        tx.Rollback();
        Console.WriteLine($"  Transaction rolled back: {ex.Message}");
    }
}

// Final count
cmd = conn.CreateCommand();
cmd.CommandText = "SELECT COUNT(*) FROM trades";
Console.WriteLine($"\nTotal trades: {cmd.ExecuteScalar()}");

conn.Close();
```

    === Transaction Example ===
      Transaction committed (2 trades inserted)
    
    Total trades: 7

#### SQLite — PRAGMA overview and connection setup

PRAGMAs configure SQLite behavior per connection. Set them right after `Open()`.
WAL mode enables concurrent readers. Cache and mmap control memory usage.

> [!info] Key PRAGMAs
>
> - Set right after `Open()` — configure per connection
> - `journal_mode=WAL` — enables concurrent reads
> - `busy_timeout` — retries instead of failing on lock
>
> > [!danger] Never use `synchronous=OFF` in production — data loss on crash.

```csharp
var pragmaConn = new SqliteConnection("DataSource=:memory:");
pragmaConn.Open();
var cmd = pragmaConn.CreateCommand();
```

#### SQLite — `journal_mode=WAL` for concurrent reads

```csharp
// WAL (Write-Ahead Log) allows concurrent reads during writes
// DELETE (default): exclusive lock during writes, readers blocked
cmd.CommandText = "PRAGMA journal_mode=WAL";
Console.WriteLine($"journal_mode:    {cmd.ExecuteScalar()}");
```

    journal_mode:    memory

#### SQLite — `synchronous` for durability vs speed

```csharp
// FULL: fsync after every commit (safest, slowest)
// NORMAL: fsync at critical moments (good balance for WAL)
// OFF: no fsync (fastest, risk of corruption on crash)
cmd.CommandText = "PRAGMA synchronous=NORMAL";
cmd.ExecuteNonQuery();
cmd.CommandText = "PRAGMA synchronous";
Console.WriteLine($"synchronous:     {cmd.ExecuteScalar()} (0=OFF, 1=NORMAL, 2=FULL)");
```

    synchronous:     1 (0=OFF, 1=NORMAL, 2=FULL)

#### SQLite — `cache_size` for in-memory page cache

```csharp
// Negative value = KB, positive = pages (default page = 4096 bytes)
// -20000 = 20MB cache
cmd.CommandText = "PRAGMA cache_size=-20000";
cmd.ExecuteNonQuery();
cmd.CommandText = "PRAGMA cache_size";
Console.WriteLine($"cache_size:      {cmd.ExecuteScalar()} (negative = KB)");

// Page size — must be set BEFORE creating tables (on new databases)
cmd.CommandText = "PRAGMA page_size";
Console.WriteLine($"page_size:       {cmd.ExecuteScalar()} bytes");
```

    cache_size:      -20000 (negative = KB)
    page_size:       4096 bytes

#### SQLite — `busy_timeout` for lock contention retry

```csharp
// Wait up to N ms for a lock instead of failing immediately
// Without this, concurrent access gets SQLITE_BUSY error instantly
cmd.CommandText = "PRAGMA busy_timeout=5000";
cmd.ExecuteNonQuery();
cmd.CommandText = "PRAGMA busy_timeout";
Console.WriteLine($"busy_timeout:    {cmd.ExecuteScalar()} ms");
```

    busy_timeout:    5000 ms

#### SQLite — `mmap_size` for memory-mapped I/O

```csharp
// Map up to N bytes of the database file into memory
// 0 = disabled, 268435456 = 256MB
// Faster reads on large files — OS pages data on demand
cmd.CommandText = "PRAGMA mmap_size=268435456";
cmd.ExecuteNonQuery();
cmd.CommandText = "PRAGMA mmap_size";
Console.WriteLine($"mmap_size:       {Convert.ToInt64(cmd.ExecuteScalar()) / 1024 / 1024} MB");
```

    mmap_size:       0 MB

#### SQLite — `temp_store` and `foreign_keys`

```csharp
// Temp store — where temporary tables/indexes are stored
// 0=DEFAULT, 1=FILE, 2=MEMORY
cmd.CommandText = "PRAGMA temp_store=MEMORY";
cmd.ExecuteNonQuery();
cmd.CommandText = "PRAGMA temp_store";
Console.WriteLine($"temp_store:      {cmd.ExecuteScalar()} (0=DEFAULT, 1=FILE, 2=MEMORY)");

// Foreign keys — DISABLED by default in SQLite (!)
// Must enable explicitly on every connection
cmd.CommandText = "PRAGMA foreign_keys=ON";
cmd.ExecuteNonQuery();
cmd.CommandText = "PRAGMA foreign_keys";
Console.WriteLine($"foreign_keys:    {cmd.ExecuteScalar()} (0=OFF, 1=ON)");
```

    temp_store:      2 (0=DEFAULT, 1=FILE, 2=MEMORY)
    foreign_keys:    1 (0=OFF, 1=ON)

#### SQLite — CREATE TABLE for index demos

```csharp
// Create OHLCV table for index performance demos

cmd = pragmaConn.CreateCommand();
cmd.CommandText = @"
    CREATE TABLE IF NOT EXISTS ohlcv (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol     TEXT NOT NULL,
        date       TEXT NOT NULL,
        open       REAL,
        high       REAL,
        low        REAL,
        close      REAL,
        volume     INTEGER
    )";
cmd.ExecuteNonQuery();
Console.WriteLine("Created table: ohlcv");
```

    Created table: ohlcv

#### SQLite — INSERT 5000 sample OHLCV rows

```csharp
// Insert 5000 rows of synthetic OHLCV data

var rng = new Random(42);
var symbols = new[] { "ASML.AS", "SAP.DE", "MC.PA", "SIE.DE", "TTE.PA" };
var baseDate = new DateTime(2024, 1, 1);
for (int i = 0; i < 5000; i++)
{
    var sym = symbols[i % symbols.Length];
    var dt = baseDate.AddDays(i / symbols.Length).ToString("yyyy-MM-dd");
    var price = 100 + rng.NextDouble() * 200;
    cmd.CommandText = $"INSERT INTO ohlcv (symbol, date, open, high, low, close, volume) "
        + $"VALUES ('{sym}', '{dt}', {price:F2}, {price * 1.02:F2}, {price * 0.98:F2}, {price * 1.01:F2}, {rng.Next(100000, 5000000)})";
    cmd.ExecuteNonQuery();
}
Console.WriteLine("Inserted 5000 OHLCV rows");
```

    Inserted 5000 OHLCV rows

#### SQLite — EXPLAIN QUERY PLAN without index (full table scan)

```csharp
// EXPLAIN QUERY PLAN shows whether SQLite uses an index or full table scan
// Drop any existing indexes first to show the "before" state

// Drop indexes if they exist from a previous run
try { cmd.CommandText = "DROP INDEX IF EXISTS idx_ohlcv_symbol"; cmd.ExecuteNonQuery(); } catch {}
try { cmd.CommandText = "DROP INDEX IF EXISTS idx_ohlcv_symbol_date"; cmd.ExecuteNonQuery(); } catch {}


QueryToTable(pragmaConn, "EXPLAIN QUERY PLAN SELECT * FROM ohlcv WHERE symbol = 'ASML.AS' AND date > '2024-06-01'")

// INTERPRETING EXPLAIN QUERY PLAN:
//   SCAN ohlcv         = full table scan (reads every row) — slow, no index used
//   SEARCH ohlcv       = index lookup (reads only matching rows) — fast
//   USING INDEX idx    = which index is being used
//   USING COVERING INDEX = index has all needed columns, no table access at all
//
// Goal: turn SCAN into SEARCH by creating the right index.
// "SCAN" on a 5000-row table is fine. On 50M rows it is a disaster.
```

<table><thead><tr><th>id</th><th>parent</th><th>notused</th><th>detail</th></tr></thead><tbody><tr><td>2</td><td>0</td><td>216</td><td>SCAN ohlcv</td></tr></tbody></table>

#### SQLite — CREATE INDEX (single, composite, unique)

```csharp
// CREATE INDEX speeds up WHERE, JOIN, ORDER BY

Console.WriteLine("=== Creating Indexes ===");

// Single column index — speeds up WHERE symbol = ?
cmd.CommandText = "CREATE INDEX idx_ohlcv_symbol ON ohlcv(symbol)";
cmd.ExecuteNonQuery();
Console.WriteLine("  Created: idx_ohlcv_symbol (single column)");

// Composite index — covers WHERE symbol = ? AND date > ?
cmd.CommandText = "CREATE INDEX idx_ohlcv_symbol_date ON ohlcv(symbol, date)";
cmd.ExecuteNonQuery();
Console.WriteLine("  Created: idx_ohlcv_symbol_date (composite)");

// Unique index — enforces no duplicate (symbol, date) pairs
// cmd.CommandText = "CREATE UNIQUE INDEX idx_ohlcv_unique ON ohlcv(symbol, date)";
// Would fail here because our sample data has duplicates
Console.WriteLine("  UNIQUE INDEX: prevents duplicate (symbol, date) pairs");
```

    === Creating Indexes ===
      Created: idx_ohlcv_symbol (single column)
      Created: idx_ohlcv_symbol_date (composite)
      UNIQUE INDEX: prevents duplicate (symbol, date) pairs

#### SQLite — EXPLAIN QUERY PLAN with index (index scan)

```csharp
// Same query now uses the composite index instead of full table scan

QueryToTable(pragmaConn, "EXPLAIN QUERY PLAN SELECT * FROM ohlcv WHERE symbol = 'ASML.AS' AND date > '2024-06-01'")



// OUTPUT: SEARCH ohlcv USING INDEX idx_ohlcv_symbol_date (symbol=? AND date>?)
//
// Before index: SCAN ohlcv        = reads all 5000 rows, checks each one
// After index:  SEARCH ... USING INDEX = jumps directly to matching rows
//
// The composite index idx_ohlcv_symbol_date covers both WHERE conditions:
//   symbol=?  (exact match on first column of index)
//   date>?    (range scan on second column of index)
// On 50M rows this is the difference between 50ms and 50 seconds.
```

<table><thead><tr><th>id</th><th>parent</th><th>notused</th><th>detail</th></tr></thead><tbody><tr><td>3</td><td>0</td><td>51</td><td>SEARCH ohlcv USING INDEX idx_ohlcv_symbol_date (symbol=? AND date>?)</td></tr></tbody></table>

#### SQLite — ANALYZE to update query planner statistics

```csharp
// ANALYZE collects statistics about index selectivity
// The query planner uses these to choose the best index for each query
// Run after bulk inserts or significant data changes

cmd.CommandText = "ANALYZE";
cmd.ExecuteNonQuery();
Console.WriteLine("ANALYZE: query planner statistics updated");
```

    ANALYZE: query planner statistics updated

#### SQLite — list all indexes and tables with row counts

```csharp
// sqlite_master — list all indexes

Console.WriteLine("=== Indexes ===");
QueryToTable(pragmaConn, "SELECT name AS [Index Name], tbl_name AS [Table] FROM sqlite_master WHERE type = 'index' ORDER BY tbl_name, name")
```

    === Indexes ===

<table><thead><tr><th>Index Name</th><th>Table</th></tr></thead><tbody><tr><td>idx_ohlcv_symbol</td><td>ohlcv</td></tr><tr><td>idx_ohlcv_symbol_date</td><td>ohlcv</td></tr></tbody></table>

#### SQLite — list tables with row counts

```csharp
// SQLite — list tables with row counts

var tableNames = new List<string>();
var countCmd = pragmaConn.CreateCommand();
countCmd.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name";
using (var r = countCmd.ExecuteReader())
    while (r.Read()) tableNames.Add(r.GetString(0));

var dt = new DataTable();
dt.Columns.Add("Table");
dt.Columns.Add("Rows", typeof(long));
foreach (var table in tableNames)
{
    countCmd.CommandText = $"SELECT COUNT(*) FROM [{table}]";
    dt.Rows.Add(table, Convert.ToInt64(countCmd.ExecuteScalar()));
}
dt
```

<table><thead><tr><th>Table</th><th>Rows</th></tr></thead><tbody><tr><td>ohlcv</td><td>5000</td></tr><tr><td>sqlite_sequence</td><td>1</td></tr><tr><td>sqlite_stat1</td><td>2</td></tr></tbody></table>

#### SQLite — database size

```csharp
// SQLite — database size (page_count * page_size)

countCmd.CommandText = "PRAGMA page_count";
var pageCount = Convert.ToInt64(countCmd.ExecuteScalar());
countCmd.CommandText = "PRAGMA page_size";
var pageSize = Convert.ToInt64(countCmd.ExecuteScalar());
Console.WriteLine($"Database: {pageCount} pages x {pageSize} bytes = {pageCount * pageSize / 1024.0:F1} KB");
```

    Database: 135 pages x 4096 bytes = 540.0 KB

#### SQLite — VACUUM, REINDEX, and integrity check

```csharp
// VACUUM — rebuild and compact the database file after DELETEs
// Reclaims unused pages. On in-memory DB this is a no-op.
cmd.CommandText = "VACUUM";
cmd.ExecuteNonQuery();
Console.WriteLine("VACUUM: database file compacted");

// REINDEX — rebuild all indexes from scratch
// Use after bulk updates that may have fragmented indexes
cmd.CommandText = "REINDEX";
cmd.ExecuteNonQuery();
Console.WriteLine("REINDEX: all indexes rebuilt");

// Integrity check — verify database consistency
// Returns "ok" if everything is fine, or a list of problems
cmd.CommandText = "PRAGMA integrity_check";
Console.WriteLine($"Integrity:   {cmd.ExecuteScalar()}");

pragmaConn.Close();
```

    VACUUM: database file compacted
    REINDEX: all indexes rebuilt
    Integrity:   ok

#### SQLite — PRAGMA reference

Quick reference of all important SQLite PRAGMAs — set these right after `Open()`.

> [!abstract]- SQLite PRAGMA Quick Reference
>
> | PRAGMA | Value | Effect |
> |---|---|---|
> | `journal_mode` | `WAL` | Concurrent reads + one writer |
> | `synchronous` | `NORMAL` | Balance of speed and safety |
> | `cache_size` | `-20000` (20MB) | In-memory page cache |
> | `page_size` | `4096` | Disk block alignment (set before CREATE) |
> | `busy_timeout` | `5000` (5s) | Retry on lock instead of failing |
> | `mmap_size` | `268435456` (256MB) | Memory-mapped I/O for large files |
> | `temp_store` | `MEMORY` | Temp tables in RAM |
> | `foreign_keys` | `ON` | Enforce FK constraints (OFF by default!) |
> | `auto_vacuum` | `FULL`/`INCREMENTAL` | Auto-reclaim space on DELETE |
>
> **Maintenance:** `ANALYZE` (update stats), `VACUUM` (rebuild/compact), `REINDEX` (rebuild indexes), `PRAGMA integrity_check` (verify consistency)
>
> **Indexing:** `CREATE INDEX idx ON t(col)` | composite: `t(col1, col2)` | unique: `CREATE UNIQUE INDEX` | check usage: `EXPLAIN QUERY PLAN SELECT ...`

## SQL Server

#### SQL Server — connect and list schemas/tables

Connect to the live stoxx database (localhost,1434). Query `sys.tables` and
`sys.schemas` to discover the medallion architecture: bronze (raw), silver (cleaned),
gold (computed scores). `sys.partitions` gives approximate row counts. The T-SQL patterns used throughout this section (parameterised queries, CTEs, window functions) follow [sql-fundamentals](https://alp78.github.io/elysium/05-DB-Queries/SQL-Server/sql-fundamentals).

> [!info] ADO.NET pattern (SQL Server)
>
> - `SqlConnection` + `SqlCommand` + `SqlDataReader` — same pattern as SQLite
> - Always use `@param` for safety
> - `sys.*` catalog views give full metadata
> - Don't use `SELECT *` in production — list columns explicitly

```csharp
var connStr = "Server=localhost,1434;Database=stoxx;"
    + "User Id=sa;Password=EsgDev2026Pass1;"
    + "Encrypt=True;TrustServerCertificate=True;";

var conn = new SqlConnection(connStr);
conn.Open();
Console.WriteLine("Connected to SQL Server: stoxx database");

// List all schemas and tables with row counts
QueryToTable(conn, @"
    SELECT s.name AS [Schema], t.name AS [Table],
           FORMAT(p.rows, 'N0') AS Rows
    FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
    ORDER BY s.name, t.name")
```

    Connected to SQL Server: stoxx database

<table><thead><tr><th>Schema</th><th>Table</th><th>Rows</th></tr></thead><tbody><tr><td>bronze</td><td>dim_country</td><td>212</td></tr><tr><td>bronze</td><td>dim_index</td><td>4</td></tr><tr><td>bronze</td><td>eurostoxx50_ohlcv</td><td>50</td></tr><tr><td>bronze</td><td>index_dim</td><td>169</td></tr><tr><td>bronze</td><td>oil20_ohlcv</td><td>19</td></tr><tr><td>bronze</td><td>pulse</td><td>40</td></tr><tr><td>bronze</td><td>pulse_tickers</td><td>40</td></tr><tr><td>bronze</td><td>signals_daily</td><td>169</td></tr><tr><td>bronze</td><td>signals_quarterly</td><td>169</td></tr><tr><td>bronze</td><td>stoxxasia50_ohlcv</td><td>50</td></tr><tr><td>bronze</td><td>stoxxusa50_ohlcv</td><td>50</td></tr><tr><td>bronze</td><td>trading_calendar</td><td>29,335</td></tr><tr><td>gold</td><td>index_performance</td><td>5,281</td></tr><tr><td>gold</td><td>scores_daily</td><td>466</td></tr><tr><td>gold</td><td>scores_quarterly</td><td>170</td></tr><tr><td>silver</td><td>eurostoxx50_ohlcv</td><td>66,355</td></tr><tr><td>silver</td><td>index_dim</td><td>169</td></tr><tr><td>silver</td><td>oil20_ohlcv</td><td>24,738</td></tr><tr><td>silver</td><td>signals_daily</td><td>466</td></tr><tr><td>silver</td><td>signals_quarterly</td><td>177</td></tr><tr><td>silver</td><td>stoxxasia50_ohlcv</td><td>64,045</td></tr><tr><td>silver</td><td>stoxxusa50_ohlcv</td><td>65,100</td></tr></tbody></table>

#### SQL Server — SELECT with parameterised queries

```csharp
// Parameterised query — @param prevents SQL injection

QueryToTable(conn, @"
    SELECT TOP 10 symbol AS Symbol, CONVERT(VARCHAR, date, 23) AS Date,
           FORMAT([open], 'N2') AS [Open], FORMAT(high, 'N2') AS High,
           FORMAT(low, 'N2') AS Low, FORMAT([close], 'N2') AS [Close],
           FORMAT(volume, 'N0') AS Volume
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = 'SAP.DE'
    ORDER BY date DESC")
```

<table><thead><tr><th>Symbol</th><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr></thead><tbody><tr><td>SAP.DE</td><td>2026-03-12</td><td>163.00</td><td>166.74</td><td>162.80</td><td>166.52</td><td>806,722</td></tr><tr><td>SAP.DE</td><td>2026-03-11</td><td>167.10</td><td>168.96</td><td>163.02</td><td>165.44</td><td>2,953,782</td></tr><tr><td>SAP.DE</td><td>2026-03-10</td><td>171.60</td><td>172.88</td><td>166.46</td><td>169.60</td><td>3,187,246</td></tr><tr><td>SAP.DE</td><td>2026-03-09</td><td>173.72</td><td>173.86</td><td>168.52</td><td>171.88</td><td>1,990,823</td></tr><tr><td>SAP.DE</td><td>2026-03-06</td><td>173.66</td><td>175.10</td><td>170.24</td><td>172.74</td><td>3,347,221</td></tr><tr><td>SAP.DE</td><td>2026-03-05</td><td>167.50</td><td>172.80</td><td>166.48</td><td>170.98</td><td>2,961,032</td></tr><tr><td>SAP.DE</td><td>2026-03-04</td><td>169.22</td><td>169.22</td><td>165.94</td><td>167.38</td><td>2,443,582</td></tr><tr><td>SAP.DE</td><td>2026-03-03</td><td>165.60</td><td>166.16</td><td>161.28</td><td>165.48</td><td>3,971,985</td></tr><tr><td>SAP.DE</td><td>2026-03-02</td><td>166.62</td><td>169.10</td><td>164.86</td><td>167.10</td><td>2,776,438</td></tr><tr><td>SAP.DE</td><td>2026-02-27</td><td>172.00</td><td>173.34</td><td>168.28</td><td>170.96</td><td>2,673,448</td></tr></tbody></table>

#### SQL Server — aggregate queries and GROUP BY

```csharp
// Aggregate — average close price and total volume per symbol

QueryToTable(conn, @"
    SELECT TOP 10 symbol AS Symbol,
           COUNT(*) AS [Trading Days],
           FORMAT(AVG(CAST([close] AS FLOAT)), 'N2') AS [Avg Close],
           FORMAT(SUM(CAST(volume AS BIGINT)), 'N0') AS [Total Volume]
    FROM silver.eurostoxx50_ohlcv
    GROUP BY symbol
    ORDER BY SUM(CAST(volume AS BIGINT)) DESC")
```

<table><thead><tr><th>Symbol</th><th>Trading Days</th><th>Avg Close</th><th>Total Volume</th></tr></thead><tbody><tr><td>ISP.MI</td><td>1321</td><td>3.15</td><td>115,704,541,969</td></tr><tr><td>SAN.MC</td><td>1329</td><td>4.43</td><td>55,513,641,918</td></tr><tr><td>ENEL.MI</td><td>1321</td><td>6.82</td><td>32,600,561,934</td></tr><tr><td>BBVA.MC</td><td>1329</td><td>8.65</td><td>22,133,773,194</td></tr><tr><td>UCG.MI</td><td>1321</td><td>28.46</td><td>18,366,801,099</td></tr><tr><td>ENI.MI</td><td>1321</td><td>13.40</td><td>17,141,570,967</td></tr><tr><td>INGA.AS</td><td>1331</td><td>14.04</td><td>17,041,577,555</td></tr><tr><td>IBE.MC</td><td>1329</td><td>12.26</td><td>15,994,295,949</td></tr><tr><td>DTE.DE</td><td>1324</td><td>22.43</td><td>10,029,411,390</td></tr><tr><td>NDA-FI.HE</td><td>1306</td><td>10.85</td><td>7,020,342,991</td></tr></tbody></table>

#### SQL Server — CREATE TABLE for demo

```csharp
// Create a staging table for INSERT/UPDATE/DELETE demos

var sqlCmd = new SqlCommand(@"
    IF OBJECT_ID('dbo.trades_demo', 'U') IS NOT NULL DROP TABLE dbo.trades_demo;
    CREATE TABLE dbo.trades_demo (
        trade_id   NVARCHAR(20) PRIMARY KEY,
        ticker     NVARCHAR(10) NOT NULL,
        side       NVARCHAR(4) NOT NULL,
        quantity   INT NOT NULL,
        price      DECIMAL(10,2) NOT NULL,
        trade_date DATE NOT NULL DEFAULT GETDATE()
    )", conn);
sqlCmd.ExecuteNonQuery();
Console.WriteLine("Created dbo.trades_demo");
```

    Created dbo.trades_demo

#### SQL Server — INSERT with parameterised values

```csharp
// INSERT — parameterised to prevent SQL injection

var sqlCmd = new SqlCommand("INSERT INTO dbo.trades_demo VALUES (@id, @t, @s, @q, @p, @d)", conn);
sqlCmd.Parameters.AddWithValue("@id", "TRD_001");
sqlCmd.Parameters.AddWithValue("@t", "ASML.AS");
sqlCmd.Parameters.AddWithValue("@s", "BUY");
sqlCmd.Parameters.AddWithValue("@q", 100);
sqlCmd.Parameters.AddWithValue("@p", 685.40);
sqlCmd.Parameters.AddWithValue("@d", "2026-03-15");
Console.WriteLine($"INSERT: {sqlCmd.ExecuteNonQuery()} row");
```

    INSERT: 1 row

#### SQL Server — UPDATE with parameterised WHERE

```csharp
// UPDATE — change price for a specific trade

var sqlCmd = new SqlCommand("UPDATE dbo.trades_demo SET price = @p WHERE trade_id = @id", conn);
sqlCmd.Parameters.AddWithValue("@p", 700.00);
sqlCmd.Parameters.AddWithValue("@id", "TRD_001");
Console.WriteLine($"UPDATE: {sqlCmd.ExecuteNonQuery()} row");
```

    UPDATE: 1 row

#### SQL Server — DELETE with parameterised WHERE

```csharp
// DELETE — remove a specific trade

var sqlCmd = new SqlCommand("DELETE FROM dbo.trades_demo WHERE trade_id = @id", conn);
sqlCmd.Parameters.AddWithValue("@id", "TRD_001");
Console.WriteLine($"DELETE: {sqlCmd.ExecuteNonQuery()} row");
```

    DELETE: 1 row

#### SQL Server — DROP TABLE cleanup

```csharp
// Cleanup — drop the demo table

var sqlCmd = new SqlCommand("DROP TABLE dbo.trades_demo", conn);
sqlCmd.ExecuteNonQuery();
Console.WriteLine("Dropped dbo.trades_demo");
```

    Dropped dbo.trades_demo

#### SQL Server — transactions with BEGIN/COMMIT/ROLLBACK

```csharp
// Explicit transaction — both inserts succeed or both roll back

var sqlCmd = new SqlCommand(@"
    IF OBJECT_ID('dbo.tx_demo', 'U') IS NOT NULL DROP TABLE dbo.tx_demo;
    CREATE TABLE dbo.tx_demo (id INT PRIMARY KEY, val NVARCHAR(50))", conn);
sqlCmd.ExecuteNonQuery();

var tx = conn.BeginTransaction();
try
{
    new SqlCommand("INSERT INTO dbo.tx_demo VALUES (1, 'first')", conn, tx).ExecuteNonQuery();
    new SqlCommand("INSERT INTO dbo.tx_demo VALUES (2, 'second')", conn, tx).ExecuteNonQuery();
    tx.Commit();
    Console.WriteLine("Transaction committed (2 rows inserted)");
}
catch (Exception ex)
{
    tx.Rollback();
    Console.WriteLine($"Transaction rolled back: {ex.Message}");
}

sqlCmd = new SqlCommand("SELECT COUNT(*) FROM dbo.tx_demo", conn);
Console.WriteLine($"Rows in tx_demo: {sqlCmd.ExecuteScalar()}");
sqlCmd = new SqlCommand("DROP TABLE dbo.tx_demo", conn);
sqlCmd.ExecuteNonQuery();
```

    Transaction committed (2 rows inserted)
    Rows in tx_demo: 2

#### SQL Server — list all indexes on a table

```csharp
// List indexes — sys.indexes + sys.index_columns + sys.columns

QueryToTable(conn, @"
    SELECT i.name AS [Index Name],
           i.type_desc AS [Type],
           CASE WHEN i.is_unique = 1 THEN 'Yes' ELSE 'No' END AS [Unique],
           STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS Columns
    FROM sys.indexes i
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID('silver.eurostoxx50_ohlcv')
    GROUP BY i.name, i.type_desc, i.is_unique
    ORDER BY i.name")
```

<table><thead><tr><th>Index Name</th><th>Type</th><th>Unique</th><th>Columns</th></tr></thead><tbody><tr><td>IX_silver_eurostoxx50_ohlcv_symbol_date</td><td>NONCLUSTERED</td><td>Yes</td><td>symbol, date</td></tr><tr><td>PK__eurostox__3213E83FDF67D274</td><td>CLUSTERED</td><td>Yes</td><td>id</td></tr></tbody></table>

#### SQL Server — benchmark full table scan with Stopwatch

```csharp
// Full table aggregate — scans all rows, GROUP BY forces sort/hash
//
// This reads every 8KB page in the table. Elapsed time scales with table size.
// If 0ms, data is fully cached in the SQL Server buffer pool.

var sw = new System.Diagnostics.Stopwatch();

sw.Restart();
var sqlCmd = new SqlCommand(@"
    SELECT symbol,
           COUNT(*) AS trading_days,
           ROUND(AVG(CAST([close] AS FLOAT)), 2) AS avg_close,
           ROUND(STDEV(CAST([close] AS FLOAT)), 2) AS close_stdev,
           SUM(CAST(volume AS BIGINT)) AS total_volume
    FROM silver.eurostoxx50_ohlcv
    GROUP BY symbol
    ORDER BY total_volume DESC", conn);
int rows1 = 0;
using (var reader = sqlCmd.ExecuteReader())
    while (reader.Read()) rows1++;
sw.Stop();
Console.WriteLine($"Full table scan: {rows1} symbols | {sw.ElapsedMilliseconds} ms");
```

    Full table scan: 50 symbols | 17 ms

#### SQL Server — benchmark indexed single-symbol lookup

```csharp
// Indexed seek — reads only pages matching symbol = @Symbol
//
// With an index on symbol, SQL Server jumps directly to matching rows.
// Should be significantly faster than the full scan above.
// If similar speed, the table may be small enough to fit in cache entirely.

sw.Restart();
var sqlCmd = new SqlCommand(@"
    SELECT TOP 100 symbol, date, [close], volume
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = @Symbol
    ORDER BY date DESC", conn);
sqlCmd.Parameters.AddWithValue("@Symbol", "ASML.AS");
int rows2 = 0;
using (var reader = sqlCmd.ExecuteReader())
    while (reader.Read()) rows2++;
sw.Stop();
Console.WriteLine($"Index seek:      {rows2} rows | {sw.ElapsedMilliseconds} ms");
```

    Index seek:      100 rows | 6 ms

#### SQL Server — benchmark cross-table JOIN

```csharp
// Cross-table JOIN — combines ohlcv with dim_index

sw.Restart();
var joinResult = QueryToTable(conn, @"
    SELECT d.display_name AS [Index], COUNT(*) AS [OHLCV Rows],
           CONVERT(VARCHAR, MIN(o.date), 23) AS [First Date],
           CONVERT(VARCHAR, MAX(o.date), 23) AS [Last Date]
    FROM silver.eurostoxx50_ohlcv o
    CROSS JOIN bronze.dim_index d
    WHERE d.index_key = 'euro_stoxx_50'
    GROUP BY d.display_name");
sw.Stop();
Console.WriteLine($"JOIN completed in {sw.ElapsedMilliseconds} ms");
joinResult
```

    JOIN completed in 9 ms

<table><thead><tr><th>Index</th><th>OHLCV Rows</th><th>First Date</th><th>Last Date</th></tr></thead><tbody><tr><td>Euro Stoxx 50</td><td>66355</td><td>2021-01-04</td><td>2026-03-12</td></tr></tbody></table>

#### SQL Server — table sizes and page counts for I/O context

```csharp
// Table sizes — rows, MB, and 8KB page counts
//
// A full table scan reads total_pages * 8KB of data.
// An index seek reads only the pages containing matching rows.
// If the entire table fits in the buffer pool, physical reads = 0.

QueryToTable(conn, @"
    SELECT s.name + '.' + t.name AS [Table],
           FORMAT(SUM(p.rows), 'N0') AS Rows,
           CAST(SUM(a.total_pages) * 8.0 / 1024 AS DECIMAL(10,2)) AS [Size MB],
           FORMAT(SUM(a.total_pages), 'N0') AS [Pages (8KB)]
    FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    JOIN sys.indexes i ON t.object_id = i.object_id
    JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
    JOIN sys.allocation_units a ON p.partition_id = a.container_id
    WHERE s.name IN ('bronze', 'silver', 'gold')
    GROUP BY s.name, t.name
    ORDER BY SUM(a.total_pages) DESC")
```

<table><thead><tr><th>Table</th><th>Rows</th><th>Size MB</th><th>Pages (8KB)</th></tr></thead><tbody><tr><td>silver.eurostoxx50_ohlcv</td><td>132,710</td><td>7.95</td><td>1,018</td></tr><tr><td>silver.stoxxasia50_ohlcv</td><td>128,090</td><td>7.70</td><td>986</td></tr><tr><td>silver.stoxxusa50_ohlcv</td><td>130,200</td><td>7.39</td><td>946</td></tr><tr><td>silver.oil20_ohlcv</td><td>49,476</td><td>2.83</td><td>362</td></tr><tr><td>bronze.eurostoxx50_ohlcv</td><td>100</td><td>1.95</td><td>250</td></tr><tr><td>bronze.stoxxasia50_ohlcv</td><td>100</td><td>1.95</td><td>250</td></tr><tr><td>bronze.oil20_ohlcv</td><td>38</td><td>1.89</td><td>242</td></tr><tr><td>bronze.trading_calendar</td><td>58,670</td><td>1.77</td><td>226</td></tr><tr><td>bronze.stoxxusa50_ohlcv</td><td>100</td><td>1.52</td><td>194</td></tr><tr><td>bronze.index_dim</td><td>676</td><td>1.02</td><td>130</td></tr><tr><td>gold.index_performance</td><td>10,562</td><td>0.89</td><td>114</td></tr><tr><td>silver.index_dim</td><td>676</td><td>0.77</td><td>98</td></tr><tr><td>gold.scores_daily</td><td>932</td><td>0.45</td><td>58</td></tr><tr><td>gold.scores_quarterly</td><td>340</td><td>0.27</td><td>34</td></tr><tr><td>bronze.signals_daily</td><td>338</td><td>0.20</td><td>26</td></tr><tr><td>silver.signals_daily</td><td>932</td><td>0.20</td><td>26</td></tr><tr><td>bronze.signals_quarterly</td><td>338</td><td>0.20</td><td>26</td></tr><tr><td>silver.signals_quarterly</td><td>354</td><td>0.14</td><td>18</td></tr><tr><td>bronze.pulse</td><td>80</td><td>0.14</td><td>18</td></tr><tr><td>bronze.pulse_tickers</td><td>80</td><td>0.14</td><td>18</td></tr><tr><td>bronze.dim_country</td><td>212</td><td>0.07</td><td>9</td></tr><tr><td>bronze.dim_index</td><td>4</td><td>0.07</td><td>9</td></tr></tbody></table>

#### SQL Server — database size

```csharp
// Database size

QueryToTable(conn, @"
    SELECT DB_NAME() AS [Database],
           CAST(SUM(size) * 8.0 / 1024 AS DECIMAL(10,2)) AS [Size MB]
    FROM sys.database_files")
```

<table><thead><tr><th>Database</th><th>Size MB</th></tr></thead><tbody><tr><td>stoxx</td><td>272.00</td></tr></tbody></table>

#### SQL Server — table sizes (Top 10)

```csharp
// Table sizes (Top 10 by size)

QueryToTable(conn, @"
    SELECT TOP 10
           s.name + '.' + t.name AS [Table],
           FORMAT(SUM(p.rows), 'N0') AS Rows,
           CAST(SUM(a.total_pages) * 8.0 / 1024 AS DECIMAL(10,2)) AS [Size MB]
    FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    JOIN sys.indexes i ON t.object_id = i.object_id
    JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
    JOIN sys.allocation_units a ON p.partition_id = a.container_id
    GROUP BY s.name, t.name
    ORDER BY SUM(a.total_pages) DESC")
```

<table><thead><tr><th>Table</th><th>Rows</th><th>Size MB</th></tr></thead><tbody><tr><td>silver.eurostoxx50_ohlcv</td><td>132,710</td><td>7.95</td></tr><tr><td>silver.stoxxasia50_ohlcv</td><td>128,090</td><td>7.70</td></tr><tr><td>silver.stoxxusa50_ohlcv</td><td>130,200</td><td>7.39</td></tr><tr><td>silver.oil20_ohlcv</td><td>49,476</td><td>2.83</td></tr><tr><td>bronze.eurostoxx50_ohlcv</td><td>100</td><td>1.95</td></tr><tr><td>bronze.stoxxasia50_ohlcv</td><td>100</td><td>1.95</td></tr><tr><td>bronze.oil20_ohlcv</td><td>38</td><td>1.89</td></tr><tr><td>bronze.trading_calendar</td><td>58,670</td><td>1.77</td></tr><tr><td>bronze.stoxxusa50_ohlcv</td><td>100</td><td>1.52</td></tr><tr><td>bronze.index_dim</td><td>676</td><td>1.02</td></tr></tbody></table>

#### SQL Server — index fragmentation and maintenance

SQL Server stores index data in 8KB B-tree pages. INSERT/UPDATE/DELETE cause page splits → physical order diverges from logical order (fragmentation). A 50% fragmented index can be 2–5x slower for range scans.

| Fragmentation | Action |
|---|---|
| < 10% | Do nothing |
| 10–30% | `ALTER INDEX idx REORGANIZE` (online, lightweight) |
| > 30% | `ALTER INDEX idx REBUILD` (recreates index, resets to 0%) |
| < 1000 pages | Don't bother (too small) |

> [!tip] Always UPDATE STATISTICS after REBUILD
>
> Always `UPDATE STATISTICS` after `REBUILD` — stale stats produce bad query plans. Schedule via SQL Agent job. For data warehouses, rebuild after each ETL load.

```csharp
QueryToTable(conn, @"
    SELECT TOP 10
           OBJECT_NAME(ips.object_id) AS [Table],
           i.name AS [Index],
           ips.index_type_desc AS [Type],
           CAST(ROUND(ips.avg_fragmentation_in_percent, 1) AS DECIMAL(5,1)) AS [Frag %],
           ips.page_count AS Pages,
           CASE
               WHEN ips.avg_fragmentation_in_percent < 10 THEN 'OK'
               WHEN ips.avg_fragmentation_in_percent < 30 THEN 'REORGANIZE'
               ELSE 'REBUILD'
           END AS Action
    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
    JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
    WHERE ips.page_count > 10
    ORDER BY ips.avg_fragmentation_in_percent DESC")


// INTERPRETING THE RESULTS:
//
// 95-98% fragmentation on bronze tables (trading_calendar, ohlcv):
//   These tables were bulk-loaded (INSERT from CSV/API) without sorting.
//   Bulk inserts in random order cause massive page splits.
//   CLUSTERED INDEX at 98% means the physical row order is almost
//   completely random relative to the index key — every range scan
//   jumps across the entire file instead of reading sequentially.
//
// 47-49% fragmentation on silver tables:
//   Silver tables were built from bronze via INSERT...SELECT.
//   Partial ordering from the source means partial fragmentation.
//   Still above 30% — REBUILD is recommended.
//
// Small page counts (20-51 pages):
//   These are tiny tables. Fragmentation matters less here because
//   the entire table fits in the buffer pool cache. But rebuilding
//   is instant and costs nothing, so do it anyway.
//
// Larger tables (213-252 pages = ~2MB):
//   At this size, fragmentation starts to have measurable impact.
//   Sequential scans read 2x more pages than necessary at 47% frag.
//   REBUILD will cut scan time significantly.
```

<table><thead><tr><th>Table</th><th>Index</th><th>Type</th><th>Frag %</th><th>Pages</th><th>Action</th></tr></thead><tbody><tr><td>trading_calendar</td><td>PK_trading_calendar</td><td>CLUSTERED INDEX</td><td>98.7</td><td>149</td><td>REBUILD</td></tr><tr><td>eurostoxx50_ohlcv</td><td>IX_bronze_eurostoxx50_ohlcv_symbol_date</td><td>NONCLUSTERED INDEX</td><td>98.0</td><td>51</td><td>REBUILD</td></tr><tr><td>stoxxusa50_ohlcv</td><td>IX_bronze_stoxxusa50_ohlcv_symbol_date</td><td>NONCLUSTERED INDEX</td><td>98.0</td><td>51</td><td>REBUILD</td></tr><tr><td>oil20_ohlcv</td><td>PK__oil20_oh__3213E83F22CF352A</td><td>CLUSTERED INDEX</td><td>95.0</td><td>20</td><td>REBUILD</td></tr><tr><td>oil20_ohlcv</td><td>IX_bronze_oil20_ohlcv_symbol_date</td><td>NONCLUSTERED INDEX</td><td>95.0</td><td>20</td><td>REBUILD</td></tr><tr><td>stoxxasia50_ohlcv</td><td>IX_bronze_stoxxasia50_ohlcv_symbol_date</td><td>NONCLUSTERED INDEX</td><td>94.1</td><td>51</td><td>REBUILD</td></tr><tr><td>stoxxasia50_ohlcv</td><td>IX_silver_stoxxasia50_ohlcv_symbol_date</td><td>NONCLUSTERED INDEX</td><td>49.4</td><td>247</td><td>REBUILD</td></tr><tr><td>stoxxusa50_ohlcv</td><td>IX_silver_stoxxusa50_ohlcv_symbol_date</td><td>NONCLUSTERED INDEX</td><td>47.4</td><td>213</td><td>REBUILD</td></tr><tr><td>eurostoxx50_ohlcv</td><td>IX_silver_eurostoxx50_ohlcv_symbol_date</td><td>NONCLUSTERED INDEX</td><td>47.2</td><td>252</td><td>REBUILD</td></tr><tr><td>oil20_ohlcv</td><td>IX_silver_oil20_ohlcv_symbol_date</td><td>NONCLUSTERED INDEX</td><td>46.2</td><td>78</td><td>REBUILD</td></tr></tbody></table>

#### SQL Server — find all indexes needing REBUILD (>30% fragmented)

```csharp
// Query fragmented indexes above the 30% threshold

var sqlCmd = new SqlCommand(@"
    SELECT s.name AS schema_name, OBJECT_NAME(ips.object_id) AS table_name,
           i.name AS index_name,
           ROUND(ips.avg_fragmentation_in_percent, 1) AS frag_pct
    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
    JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
    JOIN sys.tables t ON ips.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE ips.avg_fragmentation_in_percent > 30
      AND ips.page_count > 10
      AND i.name IS NOT NULL
    ORDER BY ips.avg_fragmentation_in_percent DESC", conn);

var indexesToRebuild = new List<(string schema, string table, string index, double frag)>();
using (var reader = sqlCmd.ExecuteReader())
    while (reader.Read())
        indexesToRebuild.Add((
            reader["schema_name"].ToString()!,
            reader["table_name"].ToString()!,
            reader["index_name"].ToString()!,
            Convert.ToDouble(reader["frag_pct"])));

Console.WriteLine($"Found {indexesToRebuild.Count} indexes to rebuild (>30% fragmentation)");
```

    Found 12 indexes to rebuild (>30% fragmentation)

#### SQL Server — ALTER INDEX REBUILD on each fragmented index

```csharp
// REBUILD recreates the index from scratch — fragmentation goes to 0%

var sw = System.Diagnostics.Stopwatch.StartNew();
foreach (var (schema, table, index, frag) in indexesToRebuild)
{
    var rebuildSql = $"ALTER INDEX [{index}] ON [{schema}].[{table}] REBUILD";
    new SqlCommand(rebuildSql, conn).ExecuteNonQuery();
    Console.WriteLine($"  REBUILT: [{schema}].[{table}].[{index}] (was {frag}%)");
}
sw.Stop();
Console.WriteLine($"\nAll {indexesToRebuild.Count} indexes rebuilt in {sw.ElapsedMilliseconds} ms");
```

      REBUILT: [bronze].[trading_calendar].[PK_trading_calendar] (was 98.7%)
      REBUILT: [bronze].[eurostoxx50_ohlcv].[IX_bronze_eurostoxx50_ohlcv_symbol_date] (was 98%)
      REBUILT: [bronze].[stoxxusa50_ohlcv].[IX_bronze_stoxxusa50_ohlcv_symbol_date] (was 98%)
      REBUILT: [bronze].[oil20_ohlcv].[PK__oil20_oh__3213E83F22CF352A] (was 95%)
      REBUILT: [bronze].[oil20_ohlcv].[IX_bronze_oil20_ohlcv_symbol_date] (was 95%)
      REBUILT: [bronze].[stoxxasia50_ohlcv].[IX_bronze_stoxxasia50_ohlcv_symbol_date] (was 94.1%)
      REBUILT: [silver].[stoxxasia50_ohlcv].[IX_silver_stoxxasia50_ohlcv_symbol_date] (was 49.4%)
      REBUILT: [silver].[stoxxusa50_ohlcv].[IX_silver_stoxxusa50_ohlcv_symbol_date] (was 47.4%)
      REBUILT: [silver].[eurostoxx50_ohlcv].[IX_silver_eurostoxx50_ohlcv_symbol_date] (was 47.2%)
      REBUILT: [silver].[oil20_ohlcv].[IX_silver_oil20_ohlcv_symbol_date] (was 46.2%)
      REBUILT: [gold].[index_performance].[UX_gold_index_performance] (was 31.8%)
      REBUILT: [gold].[scores_daily].[PK__scores_d__3213E83F41C788A9] (was 30.4%)
    
    All 12 indexes rebuilt in 167 ms

#### SQL Server — UPDATE STATISTICS after rebuild

```csharp
// Stale statistics = bad query plans. Always update after REBUILD.

foreach (var (schema, table, _, _) in indexesToRebuild.DistinctBy(x => x.schema + "." + x.table))
{
    new SqlCommand($"UPDATE STATISTICS [{schema}].[{table}]", conn).ExecuteNonQuery();
    Console.WriteLine($"  STATS UPDATED: [{schema}].[{table}]");
}
```

      STATS UPDATED: [bronze].[trading_calendar]
      STATS UPDATED: [bronze].[eurostoxx50_ohlcv]
      STATS UPDATED: [bronze].[stoxxusa50_ohlcv]
      STATS UPDATED: [bronze].[oil20_ohlcv]
      STATS UPDATED: [bronze].[stoxxasia50_ohlcv]
      STATS UPDATED: [silver].[stoxxasia50_ohlcv]
      STATS UPDATED: [silver].[stoxxusa50_ohlcv]
      STATS UPDATED: [silver].[eurostoxx50_ohlcv]
      STATS UPDATED: [silver].[oil20_ohlcv]
      STATS UPDATED: [gold].[index_performance]
      STATS UPDATED: [gold].[scores_daily]

#### SQL Server — verify fragmentation after rebuild

```csharp
// Verify fragmentation is now 0% after rebuild

QueryToTable(conn, @"
    SELECT TOP 10
           s.name + '.' + OBJECT_NAME(ips.object_id) AS [Table],
           i.name AS [Index],
           ips.index_type_desc AS [Type],
           CAST(ROUND(ips.avg_fragmentation_in_percent, 1) AS DECIMAL(5,1)) AS [Frag %],
           ips.page_count AS Pages
    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
    JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
    JOIN sys.tables t ON ips.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE ips.page_count > 10
    ORDER BY ips.avg_fragmentation_in_percent DESC")
```

<table><thead><tr><th>Table</th><th>Index</th><th>Type</th><th>Frag %</th><th>Pages</th></tr></thead><tbody><tr><td>bronze.index_dim</td><td>PK__index_di__3213E83FDB4E5BA9</td><td>CLUSTERED INDEX</td><td>13.6</td><td>88</td></tr><tr><td>gold.index_performance</td><td>UX_gold_index_performance</td><td>NONCLUSTERED INDEX</td><td>5.3</td><td>19</td></tr><tr><td>gold.index_performance</td><td>PK__index_pe__3213E83FBBB2393E</td><td>CLUSTERED INDEX</td><td>4.9</td><td>81</td></tr><tr><td>silver.stoxxusa50_ohlcv</td><td>PK__stoxxusa__3213E83FC84E3F24</td><td>CLUSTERED INDEX</td><td>1.4</td><td>724</td></tr><tr><td>silver.index_dim</td><td>PK__index_di__3213E83F590AA69E</td><td>CLUSTERED INDEX</td><td>1.2</td><td>85</td></tr><tr><td>silver.stoxxusa50_ohlcv</td><td>IX_silver_stoxxusa50_ohlcv_symbol_date</td><td>NONCLUSTERED INDEX</td><td>0.6</td><td>163</td></tr><tr><td>silver.stoxxasia50_ohlcv</td><td>IX_silver_stoxxasia50_ohlcv_symbol_date</td><td>NONCLUSTERED INDEX</td><td>0.5</td><td>183</td></tr><tr><td>silver.stoxxasia50_ohlcv</td><td>PK__stoxxasi__3213E83F66A8DE5E</td><td>CLUSTERED INDEX</td><td>0.4</td><td>729</td></tr><tr><td>silver.eurostoxx50_ohlcv</td><td>PK__eurostox__3213E83FDF67D274</td><td>CLUSTERED INDEX</td><td>0.4</td><td>757</td></tr><tr><td>silver.oil20_ohlcv</td><td>PK__oil20_oh__3213E83F544EB286</td><td>CLUSTERED INDEX</td><td>0.4</td><td>275</td></tr></tbody></table>

#### SQL Server — index usage statistics

```csharp
// Which indexes are actually used? sys.dm_db_index_usage_stats
// Unused indexes waste disk space and slow down writes.

QueryToTable(conn, @"
    SELECT TOP 10
           OBJECT_NAME(s.object_id) AS [Table],
           i.name AS [Index],
           s.user_seeks AS Seeks, s.user_scans AS Scans,
           s.user_lookups AS Lookups, s.user_updates AS Updates
    FROM sys.dm_db_index_usage_stats s
    JOIN sys.indexes i ON s.object_id = i.object_id AND s.index_id = i.index_id
    WHERE s.database_id = DB_ID()
    ORDER BY s.user_seeks + s.user_scans DESC")
```

<table><thead><tr><th>Table</th><th>Index</th><th>Seeks</th><th>Scans</th><th>Lookups</th><th>Updates</th></tr></thead><tbody><tr><td>eurostoxx50_ohlcv</td><td>PK__eurostox__3213E83FDF67D274</td><td>0</td><td>16</td><td>3</td><td>0</td></tr><tr><td>dim_index</td><td>PK__dim_inde__D02D09ED2DACF7AF</td><td>4</td><td>2</td><td>0</td><td>0</td></tr><tr><td>dim_country</td><td>PK__dim_coun__F701889525414513</td><td>1</td><td>0</td><td>0</td><td>1</td></tr><tr><td>pulse_tickers</td><td>PK__pulse_ti__3213E83FF5E3765E</td><td>0</td><td>0</td><td>0</td><td>0</td></tr><tr><td>stoxxusa50_ohlcv</td><td>PK__stoxxusa__3213E83FC84E3F24</td><td>0</td><td>0</td><td>0</td><td>0</td></tr><tr><td>stoxxusa50_ohlcv</td><td>IX_silver_stoxxusa50_ohlcv_symbol_date</td><td>0</td><td>0</td><td>0</td><td>0</td></tr><tr><td>scores_daily</td><td>PK__scores_d__3213E83F41C788A9</td><td>0</td><td>0</td><td>0</td><td>0</td></tr><tr><td>scores_daily</td><td>UX_gold_scores_daily</td><td>0</td><td>0</td><td>0</td><td>0</td></tr><tr><td>signals_daily</td><td>PK__signals___3213E83F7466104F</td><td>0</td><td>0</td><td>0</td><td>0</td></tr><tr><td>signals_quarterly</td><td>PK__signals___3213E83FD922C308</td><td>0</td><td>0</td><td>0</td><td>0</td></tr></tbody></table>

#### SQL Server — provoke missing index recommendations

Missing index DMVs only populate when SQL Server sees queries that WOULD have
benefited from an index that doesn’t exist. After an index REBUILD, the DMV
stats reset. We run queries on unindexed columns to generate recommendations.

```csharp
// Run queries on columns without indexes to trigger missing index recommendations
// SQL Server tracks these in sys.dm_db_missing_index_details

// Query 1: filter on close price (no index on close)
new SqlCommand(@"
    SELECT symbol, date, [close], volume
    FROM silver.eurostoxx50_ohlcv
    WHERE [close] > 500
    ORDER BY [close] DESC", conn).ExecuteReader().Close();

// Query 2: filter on volume (no index on volume)
new SqlCommand(@"
    SELECT symbol, date, volume
    FROM silver.eurostoxx50_ohlcv
    WHERE volume > 5000000
    ORDER BY volume DESC", conn).ExecuteReader().Close();

// Query 3: filter on date range without covering index
new SqlCommand(@"
    SELECT symbol, date, [close], high - low AS daily_range
    FROM silver.eurostoxx50_ohlcv
    WHERE date BETWEEN '2025-01-01' AND '2025-06-30'
    ORDER BY date", conn).ExecuteReader().Close();

// Run each a few times to increase the impact score
for (int i = 0; i < 5; i++)
{
    new SqlCommand("SELECT * FROM silver.eurostoxx50_ohlcv WHERE [close] > 500", conn).ExecuteReader().Close();
    new SqlCommand("SELECT * FROM silver.eurostoxx50_ohlcv WHERE volume > 5000000", conn).ExecuteReader().Close();
}

Console.WriteLine("Ran 13 queries on unindexed columns to provoke recommendations");
```

    Ran 13 queries on unindexed columns to provoke recommendations

#### SQL Server — missing index recommendations from the query optimizer

> [!info] Missing index advisor
>
> `sys.dm_db_missing_index_details` — SQL Server records missing indexes every time it compiles a plan.
> - `equality_columns` — WHERE `=` | `inequality_columns` — WHERE `>`
> - `included_columns` — SELECT → INCLUDE
> - `avg_user_impact` — estimated % improvement
> - Empty after restart (in-memory only)

```csharp
QueryToTable(conn, @"
    SELECT TOP 5
           OBJECT_NAME(d.object_id) AS [Table],
           ISNULL(d.equality_columns, '-') AS [Equality Columns],
           ISNULL(d.inequality_columns, '-') AS [Inequality Columns],
           ISNULL(d.included_columns, '-') AS [Include Columns],
           CAST(ROUND(s.avg_user_impact, 1) AS DECIMAL(5,1)) AS [Impact %],
           s.user_seeks + s.user_scans AS [Queries]
    FROM sys.dm_db_missing_index_details d
    JOIN sys.dm_db_missing_index_groups g ON d.index_handle = g.index_handle
    JOIN sys.dm_db_missing_index_group_stats s ON g.index_group_handle = s.group_handle
    WHERE d.database_id = DB_ID()
    ORDER BY s.avg_user_impact * (s.user_seeks + s.user_scans) DESC")
```

<table><thead><tr><th>Table</th><th>Equality Columns</th><th>Inequality Columns</th><th>Include Columns</th><th>Impact %</th><th>Queries</th></tr></thead><tbody><tr><td>eurostoxx50_ohlcv</td><td>-</td><td>[close]</td><td>[symbol], [date], [open], [high], [low], [adj_close], [volume], [dividends], [stock_splits], [is_filled]</td><td>65.7</td><td>5</td></tr><tr><td>eurostoxx50_ohlcv</td><td>-</td><td>[volume]</td><td>[symbol], [date], [open], [high], [low], [close], [adj_close], [dividends], [stock_splits], [is_filled]</td><td>65.7</td><td>5</td></tr><tr><td>eurostoxx50_ohlcv</td><td>-</td><td>[close]</td><td>[symbol], [date], [volume]</td><td>66.7</td><td>1</td></tr><tr><td>eurostoxx50_ohlcv</td><td>-</td><td>[date]</td><td>[symbol], [high], [low], [close]</td><td>65.1</td><td>1</td></tr><tr><td>eurostoxx50_ohlcv</td><td>-</td><td>[volume]</td><td>[symbol], [date]</td><td>37.0</td><td>1</td></tr></tbody></table>

#### SQL Server — server configuration and version

```csharp
// Server metadata — version, edition, collation, configuration

QueryToTable(conn, @"
    SELECT
        SUBSTRING(@@VERSION, 1, CHARINDEX(' (', @@VERSION) - 1) AS [Version],
        CAST(SERVERPROPERTY('Edition') AS NVARCHAR(100)) AS Edition,
        CAST(SERVERPROPERTY('Collation') AS NVARCHAR(100)) AS Collation,
        CAST(SERVERPROPERTY('ProductLevel') AS NVARCHAR(20)) AS [Level]")
```

<table><thead><tr><th>Version</th><th>Edition</th><th>Collation</th><th>Level</th></tr></thead><tbody><tr><td>Microsoft SQL Server 2022</td><td>Developer Edition (64-bit)</td><td>SQL_Latin1_General_CP1_CI_AS</td><td>RTM</td></tr></tbody></table>

#### SQL Server — key configuration settings

```csharp
// Key server configuration from sys.configurations

QueryToTable(conn, @"
    SELECT name AS [Setting],
           CAST(value_in_use AS NVARCHAR(30)) AS [Value],
           CASE name
               WHEN 'max server memory (MB)' THEN 'Max RAM for buffer pool (2147483647 = unlimited)'
               WHEN 'max degree of parallelism' THEN 'Max CPU cores per query (0 = all cores)'
               WHEN 'cost threshold for parallelism' THEN 'Query cost before parallel plan (5 = default)'
               ELSE ''
           END AS [Meaning]
    FROM sys.configurations
    WHERE name IN ('max server memory (MB)', 'max degree of parallelism',
                   'cost threshold for parallelism')
    ORDER BY name")
```

<table><thead><tr><th>Setting</th><th>Value</th><th>Meaning</th></tr></thead><tbody><tr><td>cost threshold for parallelism</td><td>5</td><td>Query cost before parallel plan (5 = default)</td></tr><tr><td>max degree of parallelism</td><td>0</td><td>Max CPU cores per query (0 = all cores)</td></tr><tr><td>max server memory (MB)</td><td>2147483647</td><td>Max RAM for buffer pool (2147483647 = unlimited)</td></tr></tbody></table>

#### SQL Server — active sessions and blocking

```csharp
// Active sessions — who is connected and what are they doing

QueryToTable(conn, @"
    SELECT s.session_id AS SID,
           s.login_name AS [Login],
           ISNULL(s.host_name, '') AS Host,
           LEFT(ISNULL(s.program_name, ''), 30) AS Program,
           s.status AS Status,
           DB_NAME(s.database_id) AS [Database]
    FROM sys.dm_exec_sessions s
    WHERE s.is_user_process = 1
    ORDER BY s.session_id")
```

<table><thead><tr><th>SID</th><th>Login</th><th>Host</th><th>Program</th><th>Status</th><th>Database</th></tr></thead><tbody><tr><td>53</td><td>NT AUTHORITY\SYSTEM</td><td>8482aae8ad0a</td><td>SQLServerCEIP</td><td>sleeping</td><td>master</td></tr><tr><td>55</td><td>sa</td><td>ELYSIUM</td><td>Core Microsoft SqlClient Data </td><td>sleeping</td><td>stoxx</td></tr><tr><td>56</td><td>sa</td><td>ELYSIUM</td><td>Core Microsoft SqlClient Data </td><td>running</td><td>stoxx</td></tr><tr><td>57</td><td>sa</td><td>ELYSIUM</td><td>Core Microsoft SqlClient Data </td><td>sleeping</td><td>stoxx</td></tr></tbody></table>

#### SQL Server — administration reference

Quick reference of essential SQL Server DMVs and commands for monitoring,
tuning, and troubleshooting.

> [!abstract]- SQL Server Administration Quick Reference
>
> **Metadata:** `sys.tables`, `sys.schemas`, `sys.columns` (table/column metadata) | `sys.indexes` (index definitions) | `sys.partitions` (row counts) | `OBJECT_ID('schema.table')` (get object ID)
>
> **Index Management**
> | Command | Purpose |
> |---|---|
> | `sys.dm_db_index_physical_stats` | Fragmentation analysis |
> | `sys.dm_db_index_usage_stats` | Index usage (seeks/scans/updates) |
> | `sys.dm_db_missing_index_details` | Missing index recommendations |
> | `ALTER INDEX idx ON table REORGANIZE` | Defragment online (10–30%) |
> | `ALTER INDEX idx ON table REBUILD` | Full rebuild (>30%) |
> | `UPDATE STATISTICS table` | Refresh query planner stats |
>
> **Performance:** `SET STATISTICS IO ON` (logical/physical reads) | `SET STATISTICS TIME ON` (CPU/elapsed) | `sys.dm_exec_query_stats` (top queries) | `DBCC FREEPROCCACHE` (clear plan cache — dev only!)
>
> **Monitoring:** `sys.dm_exec_sessions` (active connections) | `sys.dm_exec_requests` (running queries) | `sys.dm_os_wait_stats` (wait analysis) | `sp_who2` (quick overview)
>
> **Maintenance:** `DBCC CHECKDB` (integrity) | `sp_spaceused 'table'` (table size) | `BACKUP DATABASE db TO DISK = 'path'` (full backup)
>
> **Configuration:** `sp_configure 'max server memory', 4096` | `sp_configure 'max degree of parallelism', 4` | `RECONFIGURE` (apply changes)

#### SQL Server — ODBC Provider with positional parameters

```csharp
// ODBC Provider — same driver as Python pyodbc, ? positional params

var odbcConnStr = "Driver={ODBC Driver 18 for SQL Server};"
    + "Server=localhost,1434;Database=stoxx;"
    + "UID=sa;PWD=EsgDev2026Pass1;"
    + "Encrypt=yes;TrustServerCertificate=yes;";

var odbcResult = new DataTable();
using (var odbcConn = new OdbcConnection(odbcConnStr))
{
    odbcConn.Open();
    var odbcCmd = new OdbcCommand(
        "SELECT TOP 5 symbol, short_name, composite_score "
        + "FROM gold.scores_daily WHERE _index = ? "
        + "ORDER BY composite_rank", odbcConn);
    odbcCmd.Parameters.AddWithValue("@p1", "euro_stoxx_50");
    odbcResult.Load(odbcCmd.ExecuteReader());
}
odbcResult
```

<table><thead><tr><th>symbol</th><th>short_name</th><th>composite_score</th></tr></thead><tbody><tr><td>BNP.PA</td><td>BNP PARIBAS ACT.A</td><td>0.6839467847784353</td></tr><tr><td>BNP.PA</td><td>BNP PARIBAS ACT.A</td><td>0.6639711356464837</td></tr><tr><td>BNP.PA</td><td>BNP PARIBAS ACT.A</td><td>0.6795985859619491</td></tr><tr><td>DTE.DE</td><td>DEUTSCHE TELEKOM AG</td><td>0.5150053634526331</td></tr><tr><td>DTE.DE</td><td>DEUTSCHE TELEKOM AG</td><td>0.5214424751678984</td></tr></tbody></table>

#### SQL Server — SqlClient vs ODBC comparison

```csharp
// SqlClient vs ODBC comparison

var cmp = new DataTable();
cmp.Columns.Add("Feature");
cmp.Columns.Add("SqlClient");
cmp.Columns.Add("ODBC");
cmp.Rows.Add("NuGet needed", "Yes (Microsoft.Data.SqlClient)", "No (System.Data.Odbc built-in)");
cmp.Rows.Add("Parameters", "@named", "? positional (like Python)");
cmp.Rows.Add("SQL Server features", "Full (bulk copy, Always Encrypted)", "Standard ODBC only");
cmp.Rows.Add("Python equivalent", "—", "pyodbc");
cmp.Rows.Add("Connection string", "Server=host;Database=db;...", "Driver={ODBC Driver 18};Server=...");
cmp.Rows.Add("Best for", "SQL Server-specific apps", "Cross-database portability");
cmp
```

<table><thead><tr><th>Feature</th><th>SqlClient</th><th>ODBC</th></tr></thead><tbody><tr><td>NuGet needed</td><td>Yes (Microsoft.Data.SqlClient)</td><td>No (System.Data.Odbc built-in)</td></tr><tr><td>Parameters</td><td>@named</td><td>? positional (like Python)</td></tr><tr><td>SQL Server features</td><td>Full (bulk copy, Always Encrypted)</td><td>Standard ODBC only</td></tr><tr><td>Python equivalent</td><td>—</td><td>pyodbc</td></tr><tr><td>Connection string</td><td>Server=host;Database=db;...</td><td>Driver={ODBC Driver 18};Server=...</td></tr><tr><td>Best for</td><td>SQL Server-specific apps</td><td>Cross-database portability</td></tr></tbody></table>

## Dapper — Micro-ORM

Dapper sits between raw ADO.NET and full Entity Framework. You write SQL (full control),
Dapper maps results to typed C# objects (no manual `reader.GetString(0)`).

#### The problem with ADO.NET
```csharp
// 10 lines of boilerplate per query
var cmd = new SqlCommand(sql, conn);
using var reader = cmd.ExecuteReader();
while (reader.Read()) {
    var row = new OhlcvRow(
        reader.GetString(0),      // which column is 0? hope you remember
        reader.GetDateTime(1),    // wrong index = runtime crash
        reader.GetDouble(2),      // manual cast for every column
    );
}
```

#### What Dapper gives you
```csharp
// 1 line — same performance, typed result
var rows = conn.Query<OhlcvRow>(sql, new { Symbol = "ASML.AS" });
rows.First().Close   // double, not object — IntelliSense, refactoring, compile-time safety
```

**Key difference:** ADO.NET returns **untyped rows** (`object` values, index-based access).
Dapper returns **typed objects** (real C# instances with properties). Same difference as
`dict` vs `dataclass` in Python, or `pd.read_sql()` returning a DataFrame vs raw `cursor.fetchall()`.

| | ADO.NET | Dapper |
|---|---|---|
| Access a field | `reader["close"]` → `object`, must cast | `row.Close` → `double` directly |
| Typo in column | Runtime crash | Compile error |
| LINQ on results | Not on DataReader | Full LINQ: `.Where()`, `.OrderBy()` |
| Parameters | `cmd.Parameters.AddWithValue` per param | `new { Symbol = "ASML" }` one-liner |
| Performance | Fastest | ~Same (IL emission, not reflection) |
| Python equivalent | `pyodbc cursor.fetchall()` | `pd.read_sql()` returning DataFrame |

#### Dapper — NuGet setup and record DTOs

Define a `record` whose property names match SQL column aliases — Dapper matches by name (case-insensitive), no configuration. Auto-maps results, supports parameterised queries via anonymous objects, ~same performance as raw ADO.NET. Use EF Core for complex CRUD with relationships.

```csharp
// DTOs — Dapper maps columns to these by matching property names
record OhlcvRow(string Symbol, DateTime Date, double Open, double High, double Low, double Close, long Volume);
record IndexInfo(string IndexKey, string DisplayName, string Currency);
record ScoreRow(string Symbol, double CompositeScore, int CompositeRank);
record TradeRow(string TradeId, string Ticker, string Side, int Quantity, decimal Price);
```

```csharp
var dapperConn = new SqlConnection(
    "Server=localhost,1434;Database=stoxx;"
    + "User Id=sa;Password=EsgDev2026Pass1;"
    + "Encrypt=True;TrustServerCertificate=True;");
dapperConn.Open();
```

#### Dapper — `Query<T>` returns typed list from SQL

```csharp
// Query<T> — returns IEnumerable<T>, maps each row to a record
// Column aliases must match property names (case-insensitive)

var indices = dapperConn.Query<IndexInfo>(
    "SELECT index_key AS IndexKey, display_name AS DisplayName, currency AS Currency FROM bronze.dim_index ORDER BY display_name");

var dt = new DataTable();
dt.Columns.Add("Index Key"); dt.Columns.Add("Display Name"); dt.Columns.Add("Currency");
foreach (var idx in indices)
    dt.Rows.Add(idx.IndexKey, idx.DisplayName, idx.Currency);
dt
```

<table><thead><tr><th>Index Key</th><th>Display Name</th><th>Currency</th></tr></thead><tbody><tr><td>euro_stoxx_50</td><td>Euro Stoxx 50</td><td>€</td></tr><tr><td>oil_20</td><td>Oil & Gas 20</td><td>$</td></tr><tr><td>stoxx_asia_50</td><td>STOXX Asia/Pacific 50</td><td></td></tr><tr><td>stoxx_usa_50</td><td>STOXX USA 50</td><td>$</td></tr></tbody></table>

#### Dapper — parameterised queries with anonymous objects

```csharp
// Parameters as anonymous object — @param in SQL maps to object properties
// No cmd.Parameters.AddWithValue boilerplate

var prices = dapperConn.Query<OhlcvRow>(@"
    SELECT TOP 5 symbol AS Symbol, date AS Date,
           [open] AS [Open], high AS High, low AS Low, [close] AS [Close], volume AS Volume
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = @Symbol
    ORDER BY date DESC",
    new { Symbol = "ASML.AS" });    // anonymous object maps to @Symbol

var dt = new DataTable();
dt.Columns.Add("Symbol"); dt.Columns.Add("Date"); dt.Columns.Add("Open");
dt.Columns.Add("High"); dt.Columns.Add("Low"); dt.Columns.Add("Close"); dt.Columns.Add("Volume");
foreach (var p in prices)
    dt.Rows.Add(p.Symbol, $"{p.Date:yyyy-MM-dd}", $"{p.Open:F2}", $"{p.High:F2}", $"{p.Low:F2}", $"{p.Close:F2}", $"{p.Volume:N0}");
dt
```

<table><thead><tr><th>Symbol</th><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr></thead><tbody><tr><td>ASML.AS</td><td>2026-03-12</td><td>1194.80</td><td>1202.20</td><td>1187.80</td><td>1190.80</td><td>128'223</td></tr><tr><td>ASML.AS</td><td>2026-03-11</td><td>1188.40</td><td>1210.80</td><td>1174.00</td><td>1198.80</td><td>562'904</td></tr><tr><td>ASML.AS</td><td>2026-03-10</td><td>1188.40</td><td>1208.40</td><td>1172.20</td><td>1200.00</td><td>800'815</td></tr><tr><td>ASML.AS</td><td>2026-03-09</td><td>1072.00</td><td>1147.60</td><td>1060.20</td><td>1147.60</td><td>689'086</td></tr><tr><td>ASML.AS</td><td>2026-03-06</td><td>1186.00</td><td>1192.60</td><td>1112.80</td><td>1147.00</td><td>857'271</td></tr></tbody></table>

#### Dapper — multiple parameters and WHERE IN

```csharp
// Multiple parameters — each property becomes a @param

var filtered = dapperConn.Query<OhlcvRow>(@"
    SELECT TOP 10 symbol AS Symbol, date AS Date,
           [open] AS [Open], high AS High, low AS Low, [close] AS [Close], volume AS Volume
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = @Symbol AND volume > @MinVolume
    ORDER BY volume DESC",
    new { Symbol = "SAP.DE", MinVolume = 3_000_000 });

// WHERE IN — pass a list, Dapper expands to (val1, val2, val3)
var multiSymbol = dapperConn.Query<OhlcvRow>(@"
    SELECT TOP 10 symbol AS Symbol, date AS Date,
           [open] AS [Open], high AS High, low AS Low, [close] AS [Close], volume AS Volume
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol IN @Symbols
    ORDER BY date DESC",
    new { Symbols = new[] { "ASML.AS", "SAP.DE", "MC.PA" } });

Console.WriteLine($"Filtered (SAP + vol>3M): {filtered.Count()} rows");
Console.WriteLine($"Multi-symbol IN:         {multiSymbol.Count()} rows");
```

    Filtered (SAP + vol>3M): 10 rows
    Multi-symbol IN:         10 rows

#### Dapper — `QueryFirst`, `QuerySingle`, `ExecuteScalar`

```csharp
// QueryFirst<T> — returns first row (throws if empty)
// QueryFirstOrDefault<T> — returns first row or null/default
// QuerySingle<T> — returns exactly one row (throws if 0 or >1)
// ExecuteScalar<T> — returns a single value (COUNT, SUM, MAX)

var latest = dapperConn.QueryFirst<OhlcvRow>(@"
    SELECT TOP 1 symbol AS Symbol, date AS Date,
           [open] AS [Open], high AS High, low AS Low, [close] AS [Close], volume AS Volume
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = @Symbol ORDER BY date DESC",
    new { Symbol = "SAP.DE" });

var rowCount = dapperConn.ExecuteScalar<long>("SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv");
var stockCount = dapperConn.ExecuteScalar<long>("SELECT COUNT(DISTINCT symbol) FROM silver.eurostoxx50_ohlcv");
var maxVol = dapperConn.ExecuteScalar<long>("SELECT MAX(volume) FROM silver.eurostoxx50_ohlcv");

var dt = new DataTable();
dt.Columns.Add("Metric"); dt.Columns.Add("Value");
dt.Rows.Add("Latest SAP.DE", $"{latest.Date:yyyy-MM-dd} | Close: {latest.Close:F2} | Vol: {latest.Volume:N0}");
dt.Rows.Add("Total OHLCV rows", $"{rowCount:N0}");
dt.Rows.Add("Distinct stocks", $"{stockCount}");
dt.Rows.Add("Max volume", $"{maxVol:N0}");
dt
```

<table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody><tr><td>Latest SAP.DE</td><td>2026-03-12 | Close: 166.52 | Vol: 806'722</td></tr><tr><td>Total OHLCV rows</td><td>66'355</td></tr><tr><td>Distinct stocks</td><td>50</td></tr><tr><td>Max volume</td><td>376'391'539</td></tr></tbody></table>

#### Dapper — `Execute` for INSERT, UPDATE, DELETE

```csharp
// Execute — returns number of affected rows (for INSERT/UPDATE/DELETE)

// Create demo table
dapperConn.Execute(@"
    IF OBJECT_ID('dbo.dapper_trades', 'U') IS NOT NULL DROP TABLE dbo.dapper_trades;
    CREATE TABLE dbo.dapper_trades (
        trade_id NVARCHAR(20) PRIMARY KEY,
        ticker   NVARCHAR(10),
        side     NVARCHAR(4),
        quantity INT,
        price    DECIMAL(10,2))");

// INSERT single row
var inserted = dapperConn.Execute(
    "INSERT INTO dbo.dapper_trades VALUES (@TradeId, @Ticker, @Side, @Quantity, @Price)",
    new { TradeId = "TRD_001", Ticker = "ASML.AS", Side = "BUY", Quantity = 100, Price = 685.40m });
Console.WriteLine($"INSERT: {inserted} row");

// INSERT multiple rows — pass a list, Dapper executes once per item
var batch = new[] {
    new { TradeId = "TRD_002", Ticker = "SAP.DE",  Side = "SELL", Quantity = 75,  Price = 245.80m },
    new { TradeId = "TRD_003", Ticker = "MC.PA",   Side = "BUY",  Quantity = 50,  Price = 890.20m },
    new { TradeId = "TRD_004", Ticker = "RMS.PA",  Side = "BUY",  Quantity = 20,  Price = 2850.0m },
};
var batchInserted = dapperConn.Execute(
    "INSERT INTO dbo.dapper_trades VALUES (@TradeId, @Ticker, @Side, @Quantity, @Price)", batch);
Console.WriteLine($"BATCH INSERT: {batchInserted} rows");

// UPDATE
var updated = dapperConn.Execute(
    "UPDATE dbo.dapper_trades SET price = @Price WHERE trade_id = @TradeId",
    new { Price = 700.00m, TradeId = "TRD_001" });
Console.WriteLine($"UPDATE: {updated} row");

// DELETE
var deleted = dapperConn.Execute(
    "DELETE FROM dbo.dapper_trades WHERE trade_id = @TradeId",
    new { TradeId = "TRD_004" });
Console.WriteLine($"DELETE: {deleted} row");
```

    INSERT: 1 row
    BATCH INSERT: 3 rows
    UPDATE: 1 row
    DELETE: 1 row

#### Dapper — verify trades table after INSERT/UPDATE/DELETE

```csharp
// Query the trades we just modified

var dt = new DataTable();
dt.Columns.Add("Trade ID"); dt.Columns.Add("Ticker"); dt.Columns.Add("Side");
dt.Columns.Add("Qty"); dt.Columns.Add("Price");
foreach (var t in dapperConn.Query<TradeRow>(
    "SELECT trade_id AS TradeId, ticker AS Ticker, side AS Side, quantity AS Quantity, price AS Price FROM dbo.dapper_trades ORDER BY trade_id"))
    dt.Rows.Add(t.TradeId, t.Ticker, t.Side, t.Quantity, $"{t.Price:F2}");

// Cleanup
dapperConn.Execute("DROP TABLE dbo.dapper_trades");
dt
```

<table><thead><tr><th>Trade ID</th><th>Ticker</th><th>Side</th><th>Qty</th><th>Price</th></tr></thead><tbody><tr><td>TRD_001</td><td>ASML.AS</td><td>BUY</td><td>100</td><td>700.00</td></tr><tr><td>TRD_002</td><td>SAP.DE</td><td>SELL</td><td>75</td><td>245.80</td></tr><tr><td>TRD_003</td><td>MC.PA</td><td>BUY</td><td>50</td><td>890.20</td></tr></tbody></table>

#### Dapper — aggregate queries with LINQ on results

```csharp
// Dapper returns IEnumerable<T> — full LINQ works on results
// This is impossible with raw ADO.NET DataReader

var allPrices = dapperConn.Query<OhlcvRow>(@"
    SELECT symbol AS Symbol, date AS Date,
           [open] AS [Open], high AS High, low AS Low, [close] AS [Close], volume AS Volume
    FROM silver.eurostoxx50_ohlcv
    WHERE date >= '2025-01-01'").ToList();

// LINQ aggregation on typed objects — not possible with DataReader
var summary = allPrices
    .GroupBy(r => r.Symbol)
    .Select(g => new {
        Symbol = g.Key,
        Days = g.Count(),
        AvgClose = g.Average(r => r.Close),
        MaxVolume = g.Max(r => r.Volume),
    })
    .OrderByDescending(s => s.AvgClose)
    .Take(5);

var dt = new DataTable();
dt.Columns.Add("Symbol"); dt.Columns.Add("Days"); dt.Columns.Add("Avg Close"); dt.Columns.Add("Max Volume");
foreach (var s in summary)
    dt.Rows.Add(s.Symbol, s.Days, $"{s.AvgClose:F2}", $"{s.MaxVolume:N0}");
dt
```

<table><thead><tr><th>Symbol</th><th>Days</th><th>Avg Close</th><th>Max Volume</th></tr></thead><tbody><tr><td>RMS.PA</td><td>305</td><td>2274.84</td><td>200'686</td></tr><tr><td>RHM.DE</td><td>303</td><td>1539.54</td><td>1'665'353</td></tr><tr><td>ADYEN.AS</td><td>305</td><td>1441.14</td><td>758'895</td></tr><tr><td>ASML.AS</td><td>305</td><td>797.70</td><td>2'619'138</td></tr><tr><td>ARGX.BR</td><td>305</td><td>618.03</td><td>1'507'897</td></tr></tbody></table>

#### Dapper — dynamic queries (no DTO needed)

```csharp
// Query without a DTO — returns dynamic objects
// Useful for ad-hoc queries where defining a record is overkill

var dynamic = dapperConn.Query(
    "SELECT TOP 3 symbol, date, [close], volume FROM silver.eurostoxx50_ohlcv ORDER BY volume DESC");

var dt = new DataTable();
dt.Columns.Add("Symbol"); dt.Columns.Add("Date"); dt.Columns.Add("Close"); dt.Columns.Add("Volume");
foreach (var row in dynamic)
    dt.Rows.Add(row.symbol, $"{row.date:yyyy-MM-dd}", $"{row.close:F2}", $"{row.volume:N0}");
dt

// dynamic = no IntelliSense, no compile-time safety
// Use only for throwaway queries — prefer typed records for production
```

<table><thead><tr><th>Symbol</th><th>Date</th><th>Close</th><th>Volume</th></tr></thead><tbody><tr><td>ISP.MI</td><td>2023-08-08</td><td>2.34</td><td>376'391'539</td></tr><tr><td>SAN.MC</td><td>2021-10-20</td><td>3.36</td><td>367'211'467</td></tr><tr><td>ISP.MI</td><td>2023-05-31</td><td>2.16</td><td>317'362'978</td></tr></tbody></table>

#### ADO.NET vs Dapper vs Entity Framework — comparison

```csharp
// When to use what — decision guide

var dt = new DataTable();
dt.Columns.Add("Feature"); dt.Columns.Add("ADO.NET (raw)"); dt.Columns.Add("Dapper"); dt.Columns.Add("EF Core");
dt.Rows.Add("SQL control", "Full — you write SQL", "Full — you write SQL", "LINQ — auto-generated SQL");
dt.Rows.Add("Result type", "DataReader (untyped)", "IEnumerable<T> (typed)", "IQueryable<T> (tracked)");
dt.Rows.Add("Mapping", "Manual reader.GetXxx()", "Auto by column name", "Auto + navigation props");
dt.Rows.Add("Parameters", "cmd.Parameters.Add()", "new { Param = val }", "LINQ variables");
dt.Rows.Add("LINQ on results", "No", "Yes (in-memory)", "Yes (translated to SQL)");
dt.Rows.Add("Performance", "Fastest", "~Same as ADO.NET", "Slower (change tracking)");
dt.Rows.Add("Batch insert", "SqlBulkCopy", "Execute(sql, list)", "AddRange + SaveChanges");
dt.Rows.Add("Boilerplate", "Lots", "Minimal", "Minimal");
dt.Rows.Add("Best for", "Notebooks, scripts", "Services, APIs, pipelines", "Large apps, CRUD");
dt.Rows.Add("Python equiv", "pyodbc cursor", "pd.read_sql() → DataFrame", "SQLAlchemy ORM");
dt
```

<table><thead><tr><th>Feature</th><th>ADO.NET (raw)</th><th>Dapper</th><th>EF Core</th></tr></thead><tbody><tr><td>SQL control</td><td>Full — you write SQL</td><td>Full — you write SQL</td><td>LINQ — auto-generated SQL</td></tr><tr><td>Result type</td><td>DataReader (untyped)</td><td>IEnumerable<T> (typed)</td><td>IQueryable<T> (tracked)</td></tr><tr><td>Mapping</td><td>Manual reader.GetXxx()</td><td>Auto by column name</td><td>Auto + navigation props</td></tr><tr><td>Parameters</td><td>cmd.Parameters.Add()</td><td>new { Param = val }</td><td>LINQ variables</td></tr><tr><td>LINQ on results</td><td>No</td><td>Yes (in-memory)</td><td>Yes (translated to SQL)</td></tr><tr><td>Performance</td><td>Fastest</td><td>~Same as ADO.NET</td><td>Slower (change tracking)</td></tr><tr><td>Batch insert</td><td>SqlBulkCopy</td><td>Execute(sql, list)</td><td>AddRange + SaveChanges</td></tr><tr><td>Boilerplate</td><td>Lots</td><td>Minimal</td><td>Minimal</td></tr><tr><td>Best for</td><td>Notebooks, scripts</td><td>Services, APIs, pipelines</td><td>Large apps, CRUD</td></tr><tr><td>Python equiv</td><td>pyodbc cursor</td><td>pd.read_sql() → DataFrame</td><td>SQLAlchemy ORM</td></tr></tbody></table>

## Entity Framework Core — Full ORM

EF Core is the **dominant ORM in .NET** — used by ~60-70% of .NET applications.
Unlike Dapper (you write SQL, it maps results), EF Core generates SQL from LINQ
and manages the full object lifecycle: change tracking, migrations, relationships.

#### How it works
1. Define **entity classes** (C# classes = database tables)
2. Define a **DbContext** (connection + table mappings + configuration)
3. Write **LINQ queries** — EF Core translates to SQL automatically
4. **Change tracking** — modify objects in memory, call `SaveChanges()`, EF generates INSERT/UPDATE/DELETE
5. **Migrations** — `dotnet ef migrations add` generates SQL schema changes from code

| | Dapper | EF Core |
|---|---|---|
| You write | SQL | LINQ |
| SQL generated by | You | EF Core |
| Navigation properties | No | `order.Customer.Address.City` |
| Change tracking | No | Automatic |
| Migrations | Manual SQL scripts | `dotnet ef migrations add` |
| Performance | Fastest | Slower (tracking overhead) |
| Best for | Data pipelines, complex SQL | CRUD apps, business logic |

**NOTEBOOK LIMITATION:** EF Core requires `dotnet ef` CLI tools and a real project
structure for migrations. In notebooks, we demonstrate the API patterns with an
in-memory database. In production, use SQL Server/PostgreSQL with migrations.

#### EF Core — NuGet packages and entity classes

Entity classes = tables, properties = columns. `DbContext` maps entities via `DbSet<T>`. LINQ queries are compile-time checked. Change tracking generates SQL on `SaveChanges()`. In-memory provider for notebooks; SQL Server for production.

> [!warning] EF Core pitfalls
>
> - Lazy loading without understanding N+1 queries
> - Not using `AsNoTracking()` for read-only queries — adds tracking overhead
> - Loading entire tables — use `IQueryable`, not `ToList()`
> - For complex analytics or bulk operations — use Dapper or SqlBulkCopy



// Entity classes — each class = one database table
// Properties = columns. Navigation properties = foreign key relationships.

public class Stock
{
    public int Id { get; set; }
    public string Symbol { get; set; } = "";
    public string Name { get; set; } = "";
    public string Sector { get; set; } = "";
    public List<Price> Prices { get; set; } = new();  // navigation: one stock has many prices
}

public class Price
{
    public int Id { get; set; }
    public int StockId { get; set; }                   // foreign key
    public Stock Stock { get; set; } = null!;           // navigation: each price belongs to one stock
    public DateTime Date { get; set; }
    public double Close { get; set; }
    public long Volume { get; set; }
}

public class Trade
{
    public int Id { get; set; }
    public string TradeId { get; set; } = "";
    public int StockId { get; set; }
    public Stock Stock { get; set; } = null!;
    public string Side { get; set; } = "";
    public int Quantity { get; set; }
    public decimal Price { get; set; }
    public DateTime TradeDate { get; set; }
}
```

#### EF Core — DbContext definition

> [!info] DbContext setup
>
> - `DbContext` maps `DbSet<T>` properties to tables
> - `OnConfiguring` — chooses the provider (`UseInMemoryDatabase` for tests, `UseSqlServer` for production)
> - `OnModelCreating` — configures relationships (`HasOne`/`WithMany`) and constraints (`HasIndex`)
> - Conventions: `Id` = primary key, `DbSet<Stock>` = "Stocks" table, navigation + FK auto-detected

```csharp
public class TradingContext : DbContext
{
    // Each DbSet = one table. LINQ queries on these generate SQL.
    public DbSet<Stock> Stocks { get; set; }
    public DbSet<Price> Prices { get; set; }
    public DbSet<Trade> Trades { get; set; }

    // Database provider — swap this line for production
    protected override void OnConfiguring(DbContextOptionsBuilder options)
        => options.UseInMemoryDatabase("TradingDemo");
        // Production: options.UseSqlServer("Server=localhost,1434;Database=stoxx;...");

    protected override void OnModelCreating(ModelBuilder model)
    {
        // One-to-many: one Stock has many Prices
        // Price.StockId is the FK column, Stock.Prices is the navigation collection
        model.Entity<Price>()
            .HasOne(p => p.Stock)          // each Price belongs to one Stock
            .WithMany(s => s.Prices)       // each Stock has many Prices
            .HasForeignKey(p => p.StockId);// Price.StockId is the FK

        // One-to-many: each Trade references one Stock
        // No inverse navigation on Stock (WithMany() with no arg)
        model.Entity<Trade>()
            .HasOne(t => t.Stock)
            .WithMany()                    // Stock doesn't have a Trades collection
            .HasForeignKey(t => t.StockId);

        // Unique index on Symbol — prevents duplicate tickers
        model.Entity<Stock>()
            .HasIndex(s => s.Symbol)
            .IsUnique();
    }
}
```

#### EF Core — seed data with `Add`, `AddRange`, `SaveChanges`

- **`Add(entity)`** — marks a single object for insertion. EF Core starts tracking it in the `Added` state. No SQL is executed yet.
- **`AddRange(entities)`** — same as `Add` but for multiple objects at once. More efficient than calling `Add` in a loop.
- **`SaveChanges()`** — flushes ALL pending changes to the database in one transaction. Generates the actual INSERT/UPDATE/DELETE SQL. Returns the number of affected rows.

The pattern is always: modify objects in memory → call `SaveChanges()` once → EF generates SQL and executes in a transaction. If any statement fails, the entire transaction rolls back.

```csharp
// Create context and seed data
// SaveChanges() generates INSERT statements automatically

var db = new TradingContext();
db.Database.EnsureDeleted();   // clean slate for re-runs
db.Database.EnsureCreated();

// Add stocks
var asml = new Stock { Symbol = "ASML.AS", Name = "ASML Holding", Sector = "Technology" };
var sap  = new Stock { Symbol = "SAP.DE",  Name = "SAP SE",        Sector = "Technology" };
var mc   = new Stock { Symbol = "MC.PA",   Name = "LVMH",          Sector = "Consumer" };
var tte  = new Stock { Symbol = "TTE.PA",  Name = "TotalEnergies",  Sector = "Energy" };
db.Stocks.AddRange(asml, sap, mc, tte);
db.SaveChanges();

// Add prices
var rng = new Random(42);
foreach (var stock in new[] { asml, sap, mc, tte })
{
    var basePrice = stock.Symbol switch { "ASML.AS" => 700, "SAP.DE" => 240, "MC.PA" => 850, _ => 60 };
    for (int d = 0; d < 30; d++)
    {
        var close = basePrice + (rng.NextDouble() - 0.5) * 20;
        db.Prices.Add(new Price
        {
            StockId = stock.Id,
            Date = new DateTime(2025, 3, 1).AddDays(d),
            Close = Math.Round(close, 2),
            Volume = rng.Next(500_000, 5_000_000),
        });
    }
}
db.SaveChanges();

Console.WriteLine($"Seeded: {db.Stocks.Count()} stocks, {db.Prices.Count()} prices");
```

    Seeded: 4 stocks, 120 prices

#### EF Core — LINQ queries (no SQL strings)

EF Core translates LINQ to SQL automatically. You never write SQL —
the compiler checks your queries at build time. Wrong property name = compile error,
not runtime crash.

```csharp
// Simple query — WHERE + OrderBy + Take

var techStocks = db.Stocks
    .Where(s => s.Sector == "Technology")
    .OrderBy(s => s.Symbol)
    .ToList();

var dt = new DataTable();
dt.Columns.Add("Symbol"); dt.Columns.Add("Name"); dt.Columns.Add("Sector");
foreach (var s in techStocks)
    dt.Rows.Add(s.Symbol, s.Name, s.Sector);
dt
```

<table><thead><tr><th>Symbol</th><th>Name</th><th>Sector</th></tr></thead><tbody><tr><td>ASML.AS</td><td>ASML Holding</td><td>Technology</td></tr><tr><td>SAP.DE</td><td>SAP SE</td><td>Technology</td></tr></tbody></table>

#### EF Core — navigation properties (joins without SQL)

```csharp
// Navigation properties — traverse relationships without writing JOIN
// stock.Prices navigates the one-to-many relationship automatically

var stocksWithPrices = db.Stocks
    .Include(s => s.Prices)    // eager load related prices (generates LEFT JOIN)
    .OrderBy(s => s.Symbol)
    .ToList();

var dt = new DataTable();
dt.Columns.Add("Symbol"); dt.Columns.Add("Name"); dt.Columns.Add("Price Count");
dt.Columns.Add("Latest Close"); dt.Columns.Add("Avg Close");
foreach (var s in stocksWithPrices)
{
    var latest = s.Prices.OrderByDescending(p => p.Date).FirstOrDefault();
    var avg = s.Prices.Any() ? s.Prices.Average(p => p.Close) : 0;
    dt.Rows.Add(s.Symbol, s.Name, s.Prices.Count, $"{latest?.Close:F2}", $"{avg:F2}");
}
dt
```

<table><thead><tr><th>Symbol</th><th>Name</th><th>Price Count</th><th>Latest Close</th><th>Avg Close</th></tr></thead><tbody><tr><td>ASML.AS</td><td>ASML Holding</td><td>30</td><td>704.13</td><td>697.98</td></tr><tr><td>MC.PA</td><td>LVMH</td><td>30</td><td>858.81</td><td>849.20</td></tr><tr><td>SAP.DE</td><td>SAP SE</td><td>30</td><td>243.02</td><td>238.71</td></tr><tr><td>TTE.PA</td><td>TotalEnergies</td><td>30</td><td>55.83</td><td>60.31</td></tr></tbody></table>

#### EF Core — aggregate queries with GroupBy

```csharp
// GroupBy + aggregation — translated to SQL GROUP BY

var sectorSummary = db.Stocks
    .Include(s => s.Prices)
    .ToList()   // materialize first for in-memory grouping
    .GroupBy(s => s.Sector)
    .Select(g => new
    {
        Sector = g.Key,
        Stocks = g.Count(),
        TotalPriceRows = g.Sum(s => s.Prices.Count),
        AvgClose = g.SelectMany(s => s.Prices).Average(p => p.Close),
    })
    .OrderByDescending(x => x.AvgClose);

var dt = new DataTable();
dt.Columns.Add("Sector"); dt.Columns.Add("Stocks"); dt.Columns.Add("Price Rows"); dt.Columns.Add("Avg Close");
foreach (var s in sectorSummary)
    dt.Rows.Add(s.Sector, s.Stocks, s.TotalPriceRows, $"{s.AvgClose:F2}");
dt
```

<table><thead><tr><th>Sector</th><th>Stocks</th><th>Price Rows</th><th>Avg Close</th></tr></thead><tbody><tr><td>Consumer</td><td>1</td><td>30</td><td>849.20</td></tr><tr><td>Technology</td><td>2</td><td>60</td><td>468.34</td></tr><tr><td>Energy</td><td>1</td><td>30</td><td>60.31</td></tr></tbody></table>

#### EF Core — change tracking and `SaveChanges()`

Modify objects in memory — EF Core tracks all changes and generates
the correct INSERT/UPDATE/DELETE SQL when you call `SaveChanges()`.

```csharp
// INSERT — Add + SaveChanges generates INSERT
db.Trades.Add(new Trade
{
    TradeId = "TRD_001", StockId = asml.Id,
    Side = "BUY", Quantity = 100, Price = 685.40m,
    TradeDate = DateTime.Today
});
db.SaveChanges();
Console.WriteLine("INSERT: TRD_001 added");

// UPDATE — modify a tracked entity + SaveChanges generates UPDATE
var trade = db.Trades.First(t => t.TradeId == "TRD_001");
trade.Price = 700.00m;
db.SaveChanges();
Console.WriteLine($"UPDATE: TRD_001 price -> {trade.Price}");

// DELETE — Remove + SaveChanges generates DELETE
db.Trades.Remove(trade);
db.SaveChanges();
Console.WriteLine("DELETE: TRD_001 removed");

Console.WriteLine($"Trades remaining: {db.Trades.Count()}");
```

    INSERT: TRD_001 added
    UPDATE: TRD_001 price -> 700.00
    DELETE: TRD_001 removed
    Trades remaining: 0

#### EF Core — `AsNoTracking()` for read-only performance

```csharp
// AsNoTracking() — skip change tracking for read-only queries
// 2-3x faster for large result sets because EF doesn't snapshot each entity

var readOnly = db.Prices
    .AsNoTracking()                        // no change tracking overhead
    .Where(p => p.Close > 700)
    .OrderByDescending(p => p.Close)
    .Take(5)
    .ToList();

var dt = new DataTable();
dt.Columns.Add("Stock ID"); dt.Columns.Add("Date"); dt.Columns.Add("Close"); dt.Columns.Add("Volume");
foreach (var p in readOnly)
    dt.Rows.Add(p.StockId, $"{p.Date:yyyy-MM-dd}", $"{p.Close:F2}", $"{p.Volume:N0}");
dt

// RULE: always use AsNoTracking() for queries that only READ data
// Only skip it when you need to modify and SaveChanges() the entities
```

<table><thead><tr><th>Stock ID</th><th>Date</th><th>Close</th><th>Volume</th></tr></thead><tbody><tr><td>3</td><td>2025-03-06</td><td>859.87</td><td>1'046'270</td></tr><tr><td>3</td><td>2025-03-18</td><td>859.75</td><td>4'017'367</td></tr><tr><td>3</td><td>2025-03-27</td><td>858.95</td><td>4'146'515</td></tr><tr><td>3</td><td>2025-03-30</td><td>858.81</td><td>3'740'448</td></tr><tr><td>3</td><td>2025-03-12</td><td>858.52</td><td>4'303'796</td></tr></tbody></table>

#### EF Core — raw SQL escape hatch with `FromSqlRaw`

`FromSqlRaw` — raw SQL inside EF Core. Use `{0}`, `{1}` placeholders (auto-parameterised). Can chain LINQ after. For complex analytics (CTEs, PIVOT, window functions) or stored procedures. Alternative: use Dapper alongside EF Core.

> [!danger] Never use string interpolation $"...{var}..."
>
> Never use string interpolation `$"...{var}..."` with `FromSqlRaw` — injection risk. Use `FromSqlInterpolated` instead (auto-parameterises `{var}` into `@p0`).

```csharp
// Demo with LINQ instead (works with InMemory provider)
var techStocks = db.Stocks
    .Where(s => s.Sector == "Technology")    // LINQ → generates WHERE clause
    .AsNoTracking()
    .ToList();

Console.WriteLine("=== LINQ query (InMemory) — FromSqlRaw requires relational provider ===");
foreach (var s in techStocks)
    Console.WriteLine($"  {s.Symbol,-10} {s.Name,-20} {s.Sector}");
```

    === LINQ query (InMemory) — FromSqlRaw requires relational provider ===
      ASML.AS    ASML Holding         Technology
      SAP.DE     SAP SE               Technology

#### EF Core — migrations workflow (reference)

Migrations are the killer feature of EF Core — schema changes are version-controlled
C# code, not ad-hoc SQL scripts. Not executable in notebooks (requires project + CLI),
but this is the production workflow.

#### Setup
```bash
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet tool install dotnet-ef
```

#### Workflow
1. Modify entity classes (add property, change type, add table)
2. `dotnet ef migrations add AddVolumeColumn` → generates C# migration with `Up()` and `Down()`
3. `dotnet ef database update` → applies pending migrations
4. `dotnet ef migrations script` → generates SQL script for DBA review

#### Example migration (auto-generated)
```csharp
public partial class AddVolumeColumn : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
        => migrationBuilder.AddColumn<long>("Volume", "Prices");

    protected override void Down(MigrationBuilder migrationBuilder)
        => migrationBuilder.DropColumn("Volume", "Prices");
}
```

> [!warning] Migration best practices
>
> - One migration per logical change (not one per deployment)
> - Always test `Down()` — rollbacks must work
> - Generate SQL scripts for production (`dotnet ef migrations script`)
> - Never edit a migration after it has been applied
> - Use `HasData()` for seed data that should be in every environment

#### EF Core — when to use EF Core vs Dapper

```csharp
// Decision guide — EF Core vs Dapper

var dt = new DataTable();
dt.Columns.Add("Scenario"); dt.Columns.Add("Use"); dt.Columns.Add("Why");
dt.Rows.Add("CRUD app with 50 tables", "EF Core", "Navigation properties, migrations, change tracking");
dt.Rows.Add("Complex analytics query", "Dapper", "Window functions, CTEs, hand-tuned SQL");
dt.Rows.Add("Bulk insert 100K rows", "Dapper + SqlBulkCopy", "EF SaveChanges is row-by-row");
dt.Rows.Add("Microservice API", "Either", "Dapper for perf, EF Core for productivity");
dt.Rows.Add("Schema migrations", "EF Core", "dotnet ef migrations — version-controlled schema");
dt.Rows.Add("Notebook / script", "Dapper or ADO.NET", "No project structure needed");
dt.Rows.Add("Read-only dashboard", "Dapper", "AsNoTracking helps but Dapper is still faster");
dt.Rows.Add("Multi-table transaction", "EF Core", "SaveChanges wraps all changes in one transaction");
dt.Rows.Add("Cross-database query", "Dapper", "EF Core is one DbContext per database");
dt.Rows.Add("Both in same project", "Yes — common", "EF for CRUD, Dapper for reporting queries");
dt
```

<table><thead><tr><th>Scenario</th><th>Use</th><th>Why</th></tr></thead><tbody><tr><td>CRUD app with 50 tables</td><td>EF Core</td><td>Navigation properties, migrations, change tracking</td></tr><tr><td>Complex analytics query</td><td>Dapper</td><td>Window functions, CTEs, hand-tuned SQL</td></tr><tr><td>Bulk insert 100K rows</td><td>Dapper + SqlBulkCopy</td><td>EF SaveChanges is row-by-row</td></tr><tr><td>Microservice API</td><td>Either</td><td>Dapper for perf, EF Core for productivity</td></tr><tr><td>Schema migrations</td><td>EF Core</td><td>dotnet ef migrations — version-controlled schema</td></tr><tr><td>Notebook / script</td><td>Dapper or ADO.NET</td><td>No project structure needed</td></tr><tr><td>Read-only dashboard</td><td>Dapper</td><td>AsNoTracking helps but Dapper is still faster</td></tr><tr><td>Multi-table transaction</td><td>EF Core</td><td>SaveChanges wraps all changes in one transaction</td></tr><tr><td>Cross-database query</td><td>Dapper</td><td>EF Core is one DbContext per database</td></tr><tr><td>Both in same project</td><td>Yes — common</td><td>EF for CRUD, Dapper for reporting queries</td></tr></tbody></table>

## DuckDB — Embedded Analytical SQL Database

DuckDB is an **embedded columnar database** — no server, runs in-process.
Full SQL (window functions, CTEs, QUALIFY, PIVOT) and direct file queries.

This section demonstrates **all the ways to interact with DuckDB from C#**:
- ADO.NET (`DuckDBConnection`, `DuckDBCommand`, `DuckDBDataReader`)
- DuckDB Appender (fastest bulk loader)
- Dapper (typed query mapping)
- Performance comparison vs SQL Server

### DuckDB with ADO.NET

#### DuckDB ADO.NET — open in-memory connection and CREATE TABLE with typed schema

`DuckDBConnection`/`DuckDBCommand`/`DuckDBDataReader` — same ADO.NET pattern as SQLite. Columnar engine is 10–100x faster for analytical queries. Full SQL:2003 (window functions, CTEs, QUALIFY, PIVOT). Single-writer — don't use for OLTP.

```csharp
var duck = new DuckDBConnection("Data Source=:memory:");
duck.Open();

var dkCmd = duck.CreateCommand();
dkCmd.CommandText = @"
    CREATE OR REPLACE TABLE ohlcv (
        symbol VARCHAR NOT NULL, date DATE NOT NULL,
        open DOUBLE, high DOUBLE, low DOUBLE, close DOUBLE,
        volume BIGINT
    )";
dkCmd.ExecuteNonQuery();
Console.WriteLine("DuckDB connected + table created");
```

    DuckDB connected + table created

#### DuckDB ADO.NET — INSERT rows from SQL Server using parameterised DuckDBCommand

```csharp
// Read from SQL Server with ADO.NET, insert into DuckDB with parameterised INSERT

var conn = new SqlConnection("Server=localhost,1434;Database=stoxx;User Id=sa;Password=EsgDev2026Pass1;Encrypt=True;TrustServerCertificate=True;");
conn.Open();

var sqlCmd = new SqlCommand(
    "SELECT symbol, date, [open], high, low, [close], volume FROM silver.eurostoxx50_ohlcv", conn);

int rowCount = 0;
using (var reader = sqlCmd.ExecuteReader())
{
    var ins = duck.CreateCommand();
    while (reader.Read())
    {
        ins.CommandText = "INSERT INTO ohlcv VALUES ($1, $2, $3, $4, $5, $6, $7)";
        ins.Parameters.Clear();
        ins.Parameters.Add(new DuckDBParameter { Value = reader.GetString(0) });
        ins.Parameters.Add(new DuckDBParameter { Value = reader.GetDateTime(1) });
        ins.Parameters.Add(new DuckDBParameter { Value = reader.GetDouble(2) });
        ins.Parameters.Add(new DuckDBParameter { Value = reader.GetDouble(3) });
        ins.Parameters.Add(new DuckDBParameter { Value = reader.GetDouble(4) });
        ins.Parameters.Add(new DuckDBParameter { Value = reader.GetDouble(5) });
        ins.Parameters.Add(new DuckDBParameter { Value = reader.GetInt64(6) });
        ins.ExecuteNonQuery();
        rowCount++;
    }
}

dkCmd.CommandText = "SELECT COUNT(*) FROM ohlcv";
Console.WriteLine($"Loaded {dkCmd.ExecuteScalar()} rows from SQL Server");
```

    Loaded 66355 rows from SQL Server

#### DuckDB ADO.NET — SELECT rows into DataTable with ExecuteReader

```csharp
// ExecuteReader — standard row-by-row iteration

var dt = new DataTable();
dkCmd.CommandText = "SELECT symbol, date, close, volume FROM ohlcv WHERE symbol = 'SAP.DE' ORDER BY date DESC LIMIT 5";
dt.Load(dkCmd.ExecuteReader());
dt
```

<table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>SAP.DE</td><td>12-Mar-26</td><td>166.52</td><td>806722</td></tr><tr><td>SAP.DE</td><td>11-Mar-26</td><td>165.44</td><td>2953782</td></tr><tr><td>SAP.DE</td><td>10-Mar-26</td><td>169.6</td><td>3187246</td></tr><tr><td>SAP.DE</td><td>09-Mar-26</td><td>171.88</td><td>1990823</td></tr><tr><td>SAP.DE</td><td>06-Mar-26</td><td>172.74</td><td>3347221</td></tr></tbody></table>

#### DuckDB ADO.NET — get single values with ExecuteScalar (COUNT, MAX)

```csharp
// ExecuteScalar — returns a single value (COUNT, MAX, etc.)

dkCmd.CommandText = "SELECT COUNT(*) FROM ohlcv";
Console.WriteLine($"Row count:      {dkCmd.ExecuteScalar()}");

dkCmd.CommandText = "SELECT COUNT(DISTINCT symbol) FROM ohlcv";
Console.WriteLine($"Distinct stocks: {dkCmd.ExecuteScalar()}");

dkCmd.CommandText = "SELECT MAX(close) FROM ohlcv";
Console.WriteLine($"Max close:      {dkCmd.ExecuteScalar()}");
```

    Row count:      66355
    Distinct stocks: 50
    Max close:      2839

#### DuckDB ADO.NET — filter rows with $1 $2 positional parameters

```csharp
// $1, $2 positional parameters — safe from injection

dkCmd.CommandText = "SELECT symbol, date, close FROM ohlcv WHERE symbol = $1 AND close > $2 ORDER BY close DESC LIMIT 5";
dkCmd.Parameters.Clear();
dkCmd.Parameters.Add(new DuckDBParameter { Value = "ASML.AS" });
dkCmd.Parameters.Add(new DuckDBParameter { Value = 700.0 });

var dt = new DataTable();
dt.Load(dkCmd.ExecuteReader());
dt
```

<table><thead><tr><th>symbol</th><th>date</th><th>close</th></tr></thead><tbody><tr><td>ASML.AS</td><td>25-Feb-26</td><td>1288.4</td></tr><tr><td>ASML.AS</td><td>24-Feb-26</td><td>1263.4</td></tr><tr><td>ASML.AS</td><td>20-Feb-26</td><td>1255.6</td></tr><tr><td>ASML.AS</td><td>23-Feb-26</td><td>1249.2</td></tr><tr><td>ASML.AS</td><td>18-Feb-26</td><td>1244.8</td></tr></tbody></table>

#### DuckDB ADO.NET — UPDATE a row with ExecuteNonQuery

```csharp
// UPDATE — same SQL syntax

dkCmd.CommandText = "UPDATE ohlcv SET close = 999.99 WHERE symbol = 'SAP.DE' AND date = (SELECT MAX(date) FROM ohlcv WHERE symbol = 'SAP.DE')";
dkCmd.Parameters.Clear();
Console.WriteLine($"UPDATE: {dkCmd.ExecuteNonQuery()} row");

// Verify
var dt = new DataTable();
dkCmd.CommandText = "SELECT symbol, date, close FROM ohlcv WHERE symbol = 'SAP.DE' ORDER BY date DESC LIMIT 3";
dt.Load(dkCmd.ExecuteReader());
dt
```

    UPDATE: 1 row

<table><thead><tr><th>symbol</th><th>date</th><th>close</th></tr></thead><tbody><tr><td>SAP.DE</td><td>12-Mar-26</td><td>999.99</td></tr><tr><td>SAP.DE</td><td>11-Mar-26</td><td>165.44</td></tr><tr><td>SAP.DE</td><td>10-Mar-26</td><td>169.6</td></tr></tbody></table>

#### DuckDB ADO.NET — DELETE rows with ExecuteNonQuery

```csharp
// DELETE

dkCmd.CommandText = "SELECT COUNT(*) FROM ohlcv WHERE symbol = 'SAP.DE'";
Console.WriteLine($"Before DELETE: {dkCmd.ExecuteScalar()} SAP.DE rows");

dkCmd.CommandText = "DELETE FROM ohlcv WHERE symbol = 'SAP.DE' AND date < '2023-01-01'";
Console.WriteLine($"DELETE: {dkCmd.ExecuteNonQuery()} rows");

dkCmd.CommandText = "SELECT COUNT(*) FROM ohlcv WHERE symbol = 'SAP.DE'";
Console.WriteLine($"After DELETE:  {dkCmd.ExecuteScalar()} SAP.DE rows");
```

    Before DELETE: 1324 SAP.DE rows
    DELETE: 512 rows
    After DELETE:  812 SAP.DE rows

#### DuckDB ADO.NET — inspect schema with DESCRIBE and information_schema

```csharp
// Schema inspection — same as PostgreSQL

Console.WriteLine("=== DESCRIBE ===");
var dt = new DataTable();
dkCmd.CommandText = "DESCRIBE ohlcv";
dkCmd.Parameters.Clear();
dt.Load(dkCmd.ExecuteReader());
dt
```

    === DESCRIBE ===

<table><thead><tr><th>column_name</th><th>column_type</th><th>null</th><th>key</th><th>default</th><th>extra</th></tr></thead><tbody><tr><td>symbol</td><td>VARCHAR</td><td>NO</td><td></td><td></td><td></td></tr><tr><td>date</td><td>DATE</td><td>NO</td><td></td><td></td><td></td></tr><tr><td>open</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>high</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>low</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>close</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>volume</td><td>BIGINT</td><td>YES</td><td></td><td></td><td></td></tr></tbody></table>

#### DuckDB ADO.NET — show query plan with EXPLAIN ANALYZE

```csharp
// EXPLAIN ANALYZE — query plan with actual timing

dkCmd.CommandText = "EXPLAIN ANALYZE SELECT symbol, AVG(close) FROM ohlcv GROUP BY symbol";
using (var reader = dkCmd.ExecuteReader())
    while (reader.Read())
        Console.WriteLine(reader.GetString(1));
```

    ┌─────────────────────────────────────┐
    │┌───────────────────────────────────┐│
    ││    Query Profiling Information    ││
    │└───────────────────────────────────┘│
    └─────────────────────────────────────┘
    EXPLAIN ANALYZE SELECT symbol, AVG(close) FROM ohlcv GROUP BY symbol
    ┌────────────────────────────────────────────────┐
    │┌──────────────────────────────────────────────┐│
    ││              Total Time: 0.0022s             ││
    │└──────────────────────────────────────────────┘│
    └────────────────────────────────────────────────┘
    ┌───────────────────────────┐
    │           QUERY           │
    └─────────────┬─────────────┘
    ┌─────────────┴─────────────┐
    │      EXPLAIN_ANALYZE      │
    │    ────────────────────   │
    │           0 Rows          │
    │          (0.00s)          │
    └─────────────┬─────────────┘
    ┌─────────────┴─────────────┐
    │         PROJECTION        │
    │    ────────────────────   │
    │__internal_decompress_strin│
    │           g(#0)           │
    │             #1            │
    │                           │
    │          50 Rows          │
    │          (0.00s)          │
    └─────────────┬─────────────┘
    ┌─────────────┴─────────────┐
    │       HASH_GROUP_BY       │
    │    ────────────────────   │
    │         Groups: #0        │
    │    Aggregates: avg(#1)    │
    │                           │
    │          50 Rows          │
    │          (0.00s)          │
    └─────────────┬─────────────┘
    ┌─────────────┴─────────────┐
    │         PROJECTION        │
    │    ────────────────────   │
    │           symbol          │
    │           close           │
    │                           │
    │         65843 Rows        │
    │          (0.00s)          │
    └─────────────┬─────────────┘
    ┌─────────────┴─────────────┐
    │         PROJECTION        │
    │    ────────────────────   │
    │__internal_compress_string_│
    │        hugeint(#0)        │
    │             #1            │
    │                           │
    │         65843 Rows        │
    │          (0.00s)          │
    └─────────────┬─────────────┘
    ┌─────────────┴─────────────┐
    │         TABLE_SCAN        │
    │    ────────────────────   │
    │        Table: ohlcv       │
    │   Type: Sequential Scan   │
    │                           │
    │        Projections:       │
    │           symbol          │
    │           close           │
    │                           │
    │         65843 Rows        │
    │          (0.00s)          │
    └───────────────────────────┘

### DuckDB Appender — fastest bulk loader

#### DuckDB Appender — INSERT rows without SQL using CreateRow and AppendValue

`CreateAppender("table")` bypasses SQL parsing — `CreateRow().AppendValue().EndRow()` per row, `Close()` flushes. 10–100x faster than parameterised INSERT. Fastest way to bulk load into DuckDB.

```csharp
// Create a fresh table for the appender demo
dkCmd.CommandText = "CREATE OR REPLACE TABLE appender_demo (symbol VARCHAR, date DATE, close DOUBLE, volume BIGINT)";
dkCmd.Parameters.Clear();
dkCmd.ExecuteNonQuery();

using (var appender = duck.CreateAppender("appender_demo"))
{
    var row = appender.CreateRow();
    row.AppendValue("ASML.AS").AppendValue(new DateOnly(2025, 3, 15)).AppendValue(685.40).AppendValue(2500000L);
    row.EndRow();

    row = appender.CreateRow();
    row.AppendValue("SAP.DE").AppendValue(new DateOnly(2025, 3, 15)).AppendValue(245.80).AppendValue(1800000L);
    row.EndRow();

    row = appender.CreateRow();
    row.AppendValue("MC.PA").AppendValue(new DateOnly(2025, 3, 15)).AppendValue(890.20).AppendValue(900000L);
    row.EndRow();
}

var dt = new DataTable();
dkCmd.CommandText = "SELECT * FROM appender_demo";
dt.Load(dkCmd.ExecuteReader());
dt
```

<table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>ASML.AS</td><td>15-Mar-25</td><td>685.4</td><td>2500000</td></tr><tr><td>SAP.DE</td><td>15-Mar-25</td><td>245.8</td><td>1800000</td></tr><tr><td>MC.PA</td><td>15-Mar-25</td><td>890.2</td><td>900000</td></tr></tbody></table>

#### DuckDB Appender — stream SqlDataReader into DuckDB with bulk CreateRow loop

```csharp
// Appender bulk load — stream from SqlDataReader directly into DuckDB

dkCmd.CommandText = "CREATE OR REPLACE TABLE ohlcv_fast AS SELECT * FROM ohlcv LIMIT 0";
dkCmd.ExecuteNonQuery();

var sw = System.Diagnostics.Stopwatch.StartNew();
var bulkCmd = new SqlCommand(
    "SELECT symbol, date, [open], high, low, [close], volume FROM silver.eurostoxx50_ohlcv", conn);

int bulkCount = 0;
using (var reader = bulkCmd.ExecuteReader())
using (var appender = duck.CreateAppender("ohlcv_fast"))
{
    while (reader.Read())
    {
        var row = appender.CreateRow();
        row.AppendValue(reader.GetString(0));
        row.AppendValue(DateOnly.FromDateTime(reader.GetDateTime(1)));
        row.AppendValue(reader.GetDouble(2));
        row.AppendValue(reader.GetDouble(3));
        row.AppendValue(reader.GetDouble(4));
        row.AppendValue(reader.GetDouble(5));
        row.AppendValue(reader.GetInt64(6));
        row.EndRow();
        bulkCount++;
    }
}
sw.Stop();

Console.WriteLine($"Appender: loaded {bulkCount} rows in {sw.ElapsedMilliseconds} ms");
```

    Appender: loaded 66355 rows in 62 ms

### DuckDB with Dapper

#### DuckDB Dapper — define record DTO for typed mapping

```csharp
// Record DTO for Dapper typed queries against DuckDB

record DuckOhlcv(string Symbol, string Date, double Close, long Volume);
```

#### DuckDB Dapper — SELECT into typed records with Query<T>

```csharp
// Dapper works with DuckDB — same as SQL Server or SQLite
// DuckDBConnection implements DbConnection, so Dapper recognises it

var top5 = duck.Query<DuckOhlcv>(
    "SELECT symbol AS Symbol, CAST(date AS VARCHAR) AS Date, close AS Close, volume AS Volume FROM ohlcv ORDER BY volume DESC LIMIT 5");

var dt = new DataTable();
dt.Columns.Add("Symbol"); dt.Columns.Add("Date"); dt.Columns.Add("Close"); dt.Columns.Add("Volume");
foreach (var r in top5)
    dt.Rows.Add(r.Symbol, r.Date, $"{r.Close:F2}", $"{r.Volume:N0}");
dt
```

<table><thead><tr><th>Symbol</th><th>Date</th><th>Close</th><th>Volume</th></tr></thead><tbody><tr><td>ISP.MI</td><td>2023-08-08</td><td>2.34</td><td>376'391'539</td></tr><tr><td>SAN.MC</td><td>2021-10-20</td><td>3.36</td><td>367'211'467</td></tr><tr><td>ISP.MI</td><td>2023-05-31</td><td>2.16</td><td>317'362'978</td></tr><tr><td>ISP.MI</td><td>2023-03-13</td><td>2.33</td><td>311'886'033</td></tr><tr><td>SAN.MC</td><td>2021-11-03</td><td>3.31</td><td>306'973'344</td></tr></tbody></table>

#### DuckDB Dapper — filter with anonymous object parameters (@Symbol, @MinClose)

```csharp
// Dapper with DuckDB — parameterised queries
//
// LIMITATION: DuckDB uses $1 $2 positional params, not @named.
// Dapper sends @name which DuckDB interprets as a type cast operator.
// Workaround: use string interpolation (safe when values are not user input)
// or use ADO.NET with $1 positional params for user-facing queries.

var symbol = "ASML.AS";
var minClose = 700.0;
var filtered = duck.Query<DuckOhlcv>(
    $"SELECT symbol AS Symbol, CAST(date AS VARCHAR) AS Date, close AS Close, volume AS Volume "
    + $"FROM ohlcv WHERE symbol = '{symbol}' AND close > {minClose} ORDER BY close DESC LIMIT 5");

var dt = new DataTable();
dt.Columns.Add("Symbol"); dt.Columns.Add("Date"); dt.Columns.Add("Close"); dt.Columns.Add("Volume");
foreach (var r in filtered)
    dt.Rows.Add(r.Symbol, r.Date, $"{r.Close:F2}", $"{r.Volume:N0}");
dt
```

<table><thead><tr><th>Symbol</th><th>Date</th><th>Close</th><th>Volume</th></tr></thead><tbody><tr><td>ASML.AS</td><td>2026-02-25</td><td>1288.40</td><td>514'749</td></tr><tr><td>ASML.AS</td><td>2026-02-24</td><td>1263.40</td><td>690'480</td></tr><tr><td>ASML.AS</td><td>2026-02-20</td><td>1255.60</td><td>565'504</td></tr><tr><td>ASML.AS</td><td>2026-02-23</td><td>1249.20</td><td>479'494</td></tr><tr><td>ASML.AS</td><td>2026-02-18</td><td>1244.80</td><td>523'222</td></tr></tbody></table>

#### DuckDB Dapper — INSERT, UPDATE, DELETE with Execute and anonymous objects

```csharp
// Dapper Execute for INSERT/UPDATE/DELETE
// DuckDB does not support @named params — use literal values

// INSERT
var inserted = duck.Execute(
    "INSERT INTO ohlcv VALUES ('TEST.XX', '2025-01-01', 100.0, 105.0, 95.0, 102.0, 1000000)");
Console.WriteLine($"Dapper INSERT: {inserted} row");

// UPDATE
var updated = duck.Execute(
    "UPDATE ohlcv SET close = 110.0 WHERE symbol = 'TEST.XX'");
Console.WriteLine($"Dapper UPDATE: {updated} row");

// DELETE
var deleted = duck.Execute(
    "DELETE FROM ohlcv WHERE symbol = 'TEST.XX'");
Console.WriteLine($"Dapper DELETE: {deleted} row");
```

    Dapper INSERT: 1 row
    Dapper UPDATE: 1 row
    Dapper DELETE: 1 row

#### DuckDB Dapper — SELECT single row with QueryFirst<T> and single value with ExecuteScalar

```csharp
// QueryFirst — single row (no @params, DuckDB limitation)

var latest = duck.QueryFirst<DuckOhlcv>(
    "SELECT symbol AS Symbol, CAST(date AS VARCHAR) AS Date, close AS Close, volume AS Volume "
    + "FROM ohlcv WHERE symbol = 'ASML.AS' ORDER BY date DESC LIMIT 1");
Console.WriteLine($"QueryFirst: {latest.Symbol} | {latest.Date} | {latest.Close:F2}");

// ExecuteScalar
var count = duck.ExecuteScalar<long>("SELECT COUNT(*) FROM ohlcv");
Console.WriteLine($"ExecuteScalar: {count} rows");
```

    QueryFirst: ASML.AS | 2026-03-12 | 1190.80
    ExecuteScalar: 65843 rows

### DuckDB-Specific SQL Features

#### DuckDB SQL — export query results to Parquet and CSV with COPY TO

```csharp
// COPY TO — export query results to file

dkCmd.CommandText = @"
    COPY (SELECT symbol, COUNT(*) AS days, ROUND(AVG(close), 2) AS avg_close
          FROM ohlcv GROUP BY symbol ORDER BY avg_close DESC)
    TO 'C:/Users/aperi/DEV/LANG/data/duckdb_export.parquet' (FORMAT PARQUET)";
dkCmd.Parameters.Clear();
dkCmd.ExecuteNonQuery();
Console.WriteLine("Exported to duckdb_export.parquet");

dkCmd.CommandText = @"
    COPY (SELECT symbol, COUNT(*) AS days, ROUND(AVG(close), 2) AS avg_close
          FROM ohlcv GROUP BY symbol ORDER BY avg_close DESC)
    TO 'C:/Users/aperi/DEV/LANG/data/duckdb_export.csv' (FORMAT CSV, HEADER)";
dkCmd.ExecuteNonQuery();
Console.WriteLine("Exported to duckdb_export.csv");
```

    Exported to duckdb_export.parquet
    Exported to duckdb_export.csv

#### DuckDB SQL — load data from Parquet file with INSERT INTO ... SELECT FROM

```csharp
// Load data from Parquet file into a new DuckDB table
// CREATE TABLE AS SELECT auto-detects schema from the file

dkCmd.CommandText = "CREATE OR REPLACE TABLE from_parquet AS SELECT * FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet'";
dkCmd.Parameters.Clear();
dkCmd.ExecuteNonQuery();

dkCmd.CommandText = "SELECT COUNT(*) FROM from_parquet";
Console.WriteLine($"Loaded from Parquet: {dkCmd.ExecuteScalar()} rows");

// Show auto-detected schema
var dt = new DataTable();
dkCmd.CommandText = "DESCRIBE from_parquet";
dt.Load(dkCmd.ExecuteReader());
dt
```

    Loaded from Parquet: 66355 rows

<table><thead><tr><th>column_name</th><th>column_type</th><th>null</th><th>key</th><th>default</th><th>extra</th></tr></thead><tbody><tr><td>id</td><td>BIGINT</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>symbol</td><td>VARCHAR</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>date</td><td>DATE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>open</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>high</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>low</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>close</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>adj_close</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>volume</td><td>BIGINT</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>dividends</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>stock_splits</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>is_filled</td><td>BOOLEAN</td><td>YES</td><td></td><td></td><td></td></tr></tbody></table>

#### DuckDB SQL — create table directly from CSV file with CREATE TABLE AS SELECT

```csharp
// One-liner: create table directly from a file

dkCmd.CommandText = "CREATE OR REPLACE TABLE ohlcv_from_csv AS SELECT * FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.csv'";
dkCmd.ExecuteNonQuery();

dkCmd.CommandText = "SELECT COUNT(*) FROM ohlcv_from_csv";
Console.WriteLine($"Created from CSV: {dkCmd.ExecuteScalar()} rows");

dkCmd.CommandText = "DESCRIBE ohlcv_from_csv";
var dt = new DataTable();
dt.Load(dkCmd.ExecuteReader());
dt

// DuckDB auto-detects column types from the CSV content
```

    Created from CSV: 66355 rows

<table><thead><tr><th>column_name</th><th>column_type</th><th>null</th><th>key</th><th>default</th><th>extra</th></tr></thead><tbody><tr><td>id</td><td>BIGINT</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>symbol</td><td>VARCHAR</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>date</td><td>DATE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>open</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>high</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>low</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>close</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>adj_close</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>volume</td><td>BIGINT</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>dividends</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>stock_splits</td><td>DOUBLE</td><td>YES</td><td></td><td></td><td></td></tr><tr><td>is_filled</td><td>BOOLEAN</td><td>YES</td><td></td><td></td><td></td></tr></tbody></table>

#### DuckDB SQL — profile all columns with SUMMARIZE (min, max, avg, nulls)

```csharp
// SUMMARIZE — min, max, avg, nulls, distinct per column in one call

var dt = new DataTable();
dkCmd.CommandText = "SUMMARIZE ohlcv";
dt.Load(dkCmd.ExecuteReader());
dt

// Equivalent of pandas df.describe() in one SQL command
```

<table><thead><tr><th>column_name</th><th>column_type</th><th>min</th><th>max</th><th>approx_unique</th><th>avg</th><th>std</th><th>q25</th><th>q50</th><th>q75</th><th>count</th><th>null_percentage</th></tr></thead><tbody><tr><td>symbol</td><td>VARCHAR</td><td>ABI.BR</td><td>WKL.AS</td><td>51</td><td></td><td></td><td></td><td></td><td></td><td>65843</td><td>0</td></tr><tr><td>date</td><td>DATE</td><td>2021-01-04</td><td>2026-03-12</td><td>1516</td><td>2023-08-09 13:12:43.762283</td><td></td><td>2022-04-25</td><td>2023-08-10</td><td>2024-11-21</td><td>65843</td><td>0</td></tr><tr><td>open</td><td>DOUBLE</td><td>1.601</td><td>2926.0</td><td>25981</td><td>197.74364532144514</td><td>364.4699500693946</td><td>29.516213068894928</td><td>70.31475017274542</td><td>188.63608762992362</td><td>65843</td><td>0</td></tr><tr><td>high</td><td>DOUBLE</td><td>1.6628</td><td>2957.0</td><td>30967</td><td>200.07710156888447</td><td>369.2103309370757</td><td>29.899639613590537</td><td>71.04163364730812</td><td>190.78985690530178</td><td>65843</td><td>0</td></tr><tr><td>low</td><td>DOUBLE</td><td>1.5842</td><td>2813.0</td><td>34449</td><td>195.27775719058997</td><td>359.3127051878782</td><td>29.291640677307946</td><td>69.50168287298162</td><td>186.0791768916689</td><td>65843</td><td>0</td></tr><tr><td>close</td><td>DOUBLE</td><td>1.6066</td><td>2839.0</td><td>31506</td><td>197.74997440122425</td><td>364.3846830497668</td><td>29.47347149787374</td><td>69.66141927075263</td><td>188.31922598476882</td><td>65843</td><td>0</td></tr><tr><td>volume</td><td>BIGINT</td><td>0</td><td>376391539</td><td>75668</td><td>5971114.79628814</td><td>16215225.87082861</td><td>505631</td><td>1403981</td><td>4116754</td><td>65843</td><td>0</td></tr></tbody></table>

#### DuckDB SQL — reference of DuckDB-specific features (QUALIFY, PIVOT, EXCLUDE, SAMPLE)

DuckDB-specific SQL features not available in SQL Server:

| Feature | Syntax |
|---|---|
| **QUALIFY** | `SELECT *, ROW_NUMBER() OVER (...) AS rn FROM t QUALIFY rn <= 3` |
| **PIVOT / UNPIVOT** | `PIVOT t ON category USING SUM(amount)` |
| **EXCLUDE** | `SELECT * EXCLUDE (volume) FROM ohlcv` |
| **REPLACE** | `SELECT * REPLACE (ROUND(close, 2) AS close) FROM ohlcv` |
| **SAMPLE** | `SELECT * FROM ohlcv USING SAMPLE 10%` |
| **LIST aggregation** | `SELECT symbol, LIST(close ORDER BY date) FROM ohlcv GROUP BY symbol` |
| **Direct file query** | `SELECT * FROM 'file.parquet'` |

Also: `CREATE OR REPLACE` (idempotent DDL), `DESCRIBE`/`SUMMARIZE` (schema + profiling), `COPY FROM/TO` (bulk import/export).

### DuckDB Indexes and Tuning

#### DuckDB — CREATE INDEX (ART index for point lookups)

Indexes are optional — the columnar engine is already fast for scans. DuckDB uses ART (Adaptive Radix Tree, not B-tree) — speeds up equality filters but NOT range scans. Zone maps (min/max per row group) provide free predicate pushdown automatically.

```csharp
dkCmd.CommandText = "CREATE INDEX idx_ohlcv_symbol ON ohlcv(symbol)";
dkCmd.Parameters.Clear();
dkCmd.ExecuteNonQuery();
Console.WriteLine("Created: idx_ohlcv_symbol (ART index)");

// Unique index
dkCmd.CommandText = "CREATE UNIQUE INDEX idx_ohlcv_sym_date ON ohlcv(symbol, date)";
dkCmd.ExecuteNonQuery();
Console.WriteLine("Created: idx_ohlcv_sym_date (UNIQUE, composite)");
```

    Created: idx_ohlcv_symbol (ART index)
    Created: idx_ohlcv_sym_date (UNIQUE, composite)

#### DuckDB — list all indexes

```csharp
// List indexes on a table

var dt = new DataTable();
dkCmd.CommandText = @"
    SELECT index_name, table_name, is_unique
    FROM duckdb_indexes()
    ORDER BY table_name, index_name";
dt.Load(dkCmd.ExecuteReader());
dt
```

<table><thead><tr><th>index_name</th><th>table_name</th><th>is_unique</th></tr></thead><tbody><tr><td>idx_ohlcv_sym_date</td><td>ohlcv</td><td>True</td></tr><tr><td>idx_ohlcv_symbol</td><td>ohlcv</td><td>False</td></tr></tbody></table>

#### DuckDB — DROP INDEX

```csharp
// Drop an index

dkCmd.CommandText = "DROP INDEX IF EXISTS idx_ohlcv_symbol";
dkCmd.ExecuteNonQuery();
Console.WriteLine("Dropped: idx_ohlcv_symbol");

// Verify
dkCmd.CommandText = "SELECT index_name FROM duckdb_indexes()";
using (var r = dkCmd.ExecuteReader())
    while (r.Read())
        Console.WriteLine($"  Remaining: {r.GetString(0)}");
```

    Dropped: idx_ohlcv_symbol
      Remaining: idx_ohlcv_sym_date

#### DuckDB — PRAGMA database_size and memory usage

```csharp
// Database size and memory usage

var dt = new DataTable();
dkCmd.CommandText = "CALL pragma_database_size()";
dt.Load(dkCmd.ExecuteReader());
dt
```

<table><thead><tr><th>database_name</th><th>database_size</th><th>block_size</th><th>total_blocks</th><th>used_blocks</th><th>free_blocks</th><th>wal_size</th><th>memory_usage</th><th>memory_limit</th></tr></thead><tbody><tr><td>memory</td><td>0 bytes</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0 bytes</td><td>31.2 MiB</td><td>50.0 GiB</td></tr></tbody></table>

#### DuckDB — pragma_storage_info — compression and row groups per column

```csharp
// Storage info — row groups, compression, and size per column

var storageInfo = new DataTable();
dkCmd.CommandText = "CALL pragma_storage_info('ohlcv')";
storageInfo.Load(dkCmd.ExecuteReader());

// Remove stats column (shown separately) and any all-null columns
var clean = storageInfo.Copy();
var dropCols = new List<string>();
foreach (DataColumn col in clean.Columns)
{
    if (col.ColumnName == "stats") { dropCols.Add(col.ColumnName); continue; }
    if (clean.AsEnumerable().All(r => r[col] == DBNull.Value || r[col]?.ToString() == ""))
        dropCols.Add(col.ColumnName);
}
foreach (var col in dropCols) clean.Columns.Remove(col);
clean.AsEnumerable().Take(10).CopyToDataTable()
```

<table><thead><tr><th>row_group_id</th><th>column_name</th><th>column_id</th><th>column_path</th><th>segment_id</th><th>segment_type</th><th>start</th><th>count</th><th>compression</th><th>has_updates</th><th>persistent</th></tr></thead><tbody><tr><td>0</td><td>symbol</td><td>0</td><td>[0]</td><td>0</td><td>VARCHAR</td><td>0</td><td>3276</td><td>Uncompressed</td><td>False</td><td>False</td></tr><tr><td>0</td><td>symbol</td><td>0</td><td>[0]</td><td>1</td><td>VARCHAR</td><td>3276</td><td>26538</td><td>Uncompressed</td><td>False</td><td>False</td></tr><tr><td>0</td><td>symbol</td><td>0</td><td>[0]</td><td>2</td><td>VARCHAR</td><td>29814</td><td>25764</td><td>Uncompressed</td><td>False</td><td>False</td></tr><tr><td>0</td><td>symbol</td><td>0</td><td>[0]</td><td>3</td><td>VARCHAR</td><td>55578</td><td>10778</td><td>Uncompressed</td><td>False</td><td>False</td></tr><tr><td>0</td><td>symbol</td><td>0</td><td>[0, 0]</td><td>0</td><td>VALIDITY</td><td>0</td><td>16384</td><td>Uncompressed</td><td>False</td><td>False</td></tr><tr><td>0</td><td>symbol</td><td>0</td><td>[0, 0]</td><td>1</td><td>VALIDITY</td><td>16384</td><td>49972</td><td>Uncompressed</td><td>False</td><td>False</td></tr><tr><td>0</td><td>date</td><td>1</td><td>[1]</td><td>0</td><td>DATE</td><td>0</td><td>2048</td><td>Uncompressed</td><td>False</td><td>False</td></tr><tr><td>0</td><td>date</td><td>1</td><td>[1]</td><td>1</td><td>DATE</td><td>2048</td><td>64308</td><td>Uncompressed</td><td>False</td><td>False</td></tr><tr><td>0</td><td>date</td><td>1</td><td>[1, 0]</td><td>0</td><td>VALIDITY</td><td>0</td><td>16384</td><td>Uncompressed</td><td>False</td><td>False</td></tr><tr><td>0</td><td>date</td><td>1</td><td>[1, 0]</td><td>1</td><td>VALIDITY</td><td>16384</td><td>49972</td><td>Uncompressed</td><td>False</td><td>False</td></tr></tbody></table>

#### DuckDB — zone map stats per row group and segment

**Row group**: DuckDB splits tables into chunks of ~122K rows called row groups.
Each row group is independent — columns are stored and compressed separately within it.
If your table has < 122K rows, everything is in row_group_id = 0.

**Segment**: Within a row group, each column is further split into segments —
compression blocks that DuckDB manages independently. Each segment has its own
zone map (min/max stats) and compression type. DuckDB uses these zone maps for
predicate pushdown: `WHERE close > 500` skips segments where `max(close) < 500`
without reading any data.

Hierarchy: **Table → Row Group (122K rows) → Column → Segment (compression block + zone map)**

Storage stats show zone map min/max per column per segment. When querying `WHERE symbol = 'SAP.DE'`, DuckDB checks each segment's zone map and skips segments where the value can't exist — no data read needed.

```csharp
var statsOnly = new DataTable();
statsOnly.Columns.Add("row_group_id");
statsOnly.Columns.Add("column_name");
statsOnly.Columns.Add("segment_id");
statsOnly.Columns.Add("segment_type");
statsOnly.Columns.Add("stats");
foreach (DataRow row in storageInfo.Rows)
    statsOnly.Rows.Add(row["row_group_id"], row["column_name"], row["segment_id"], row["segment_type"], row["stats"]);
statsOnly.AsEnumerable().OrderBy(r => r["segment_id"].ToString()).Take(20).CopyToDataTable()
```

<table><thead><tr><th>row_group_id</th><th>column_name</th><th>segment_id</th><th>segment_type</th><th>stats</th></tr></thead><tbody><tr><td>0</td><td>symbol</td><td>0</td><td>VARCHAR</td><td>[Min: ASML.AS, Max: RMS.PA, Has Unicode: false, Max String Length: 7][Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>symbol</td><td>0</td><td>VALIDITY</td><td>[Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>date</td><td>0</td><td>DATE</td><td>[Min: 2021-01-04, Max: 2026-03-04][Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>date</td><td>0</td><td>VALIDITY</td><td>[Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>open</td><td>0</td><td>DOUBLE</td><td>[Min: 394.7, Max: 1300.0][Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>open</td><td>0</td><td>VALIDITY</td><td>[Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>high</td><td>0</td><td>DOUBLE</td><td>[Min: 407.2, Max: 1312.8][Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>high</td><td>0</td><td>VALIDITY</td><td>[Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>low</td><td>0</td><td>DOUBLE</td><td>[Min: 375.75, Max: 1264.2][Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>low</td><td>0</td><td>VALIDITY</td><td>[Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>close</td><td>0</td><td>DOUBLE</td><td>[Min: 397.45, Max: 1288.4][Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>close</td><td>0</td><td>VALIDITY</td><td>[Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>volume</td><td>0</td><td>BIGINT</td><td>[Min: 48392, Max: 2713321][Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>volume</td><td>0</td><td>VALIDITY</td><td>[Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>symbol</td><td>1</td><td>VARCHAR</td><td>[Min: ABI.BR, Max: UCG.MI, Has Unicode: false, Max String Length: 7][Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>symbol</td><td>1</td><td>VALIDITY</td><td>[Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>date</td><td>1</td><td>DATE</td><td>[Min: 2021-01-04, Max: 2026-03-12][Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>date</td><td>1</td><td>VALIDITY</td><td>[Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>open</td><td>1</td><td>DOUBLE</td><td>[Min: 1.601, Max: 2926.0][Has Null: false, Has No Null: true]</td></tr><tr><td>0</td><td>open</td><td>1</td><td>VALIDITY</td><td>[Has Null: false, Has No Null: true]</td></tr></tbody></table>

#### DuckDB — memory_limit and threads configuration

```csharp
// DuckDB configuration — memory limit and thread count

// Show current settings
var dt = new DataTable();
dkCmd.CommandText = @"
    SELECT name, value, description
    FROM duckdb_settings()
    WHERE name IN ('memory_limit', 'threads', 'default_order',
                   'enable_object_cache', 'max_memory',
                   'worker_threads', 'enable_progress_bar')
    ORDER BY name";
dt.Load(dkCmd.ExecuteReader());
dt
```

<table><thead><tr><th>name</th><th>value</th><th>description</th></tr></thead><tbody><tr><td>default_order</td><td>asc</td><td>The order type used when none is specified (ASC or DESC)</td></tr><tr><td>enable_object_cache</td><td>NULL</td><td>[PLACEHOLDER] Legacy setting - does nothing</td></tr><tr><td>enable_progress_bar</td><td>false</td><td>Enables the progress bar, printing progress to the terminal for long queries</td></tr><tr><td>max_memory</td><td>50.0 GiB</td><td>The maximum memory of the system (e.g. 1GB)</td></tr><tr><td>memory_limit</td><td>50.0 GiB</td><td>The maximum memory of the system (e.g. 1GB)</td></tr><tr><td>threads</td><td>16</td><td>The number of total threads used by the system.</td></tr><tr><td>worker_threads</td><td>16</td><td>The number of total threads used by the system.</td></tr></tbody></table>

#### DuckDB — SET memory_limit and threads

| Setting | Default | Rule of thumb |
|---|---|---|
| `memory_limit` | 80% RAM | 50% if alongside SQL Server, 80% if solo |
| `threads` | CPU cores | N-2 if shared machine, all cores if solo |
| `enable_object_cache` | false | Enable for notebooks (re-running queries), disable for ETL |

> [!tip] How to know if tuning
>
> How to know if tuning is needed
> 1. Query slow → `EXPLAIN ANALYZE` → check for disk spills
> 2. "Out of Memory" → increase `memory_limit`
> 3. CPU at 100% → reduce `threads` if other services need CPU
> 4. Second run 2x faster → object cache is helping

```csharp
// Set memory limit
dkCmd.CommandText = "SET memory_limit = '4GB'";
dkCmd.Parameters.Clear();
dkCmd.ExecuteNonQuery();
Console.WriteLine("Set memory_limit = 4GB");

// Set thread count
dkCmd.CommandText = "SET threads = 4";
dkCmd.ExecuteNonQuery();
Console.WriteLine("Set threads = 4");

// Enable object cache for interactive notebook use
dkCmd.CommandText = "SET enable_object_cache = true";
dkCmd.ExecuteNonQuery();
Console.WriteLine("Set enable_object_cache = true");

// Verify
dkCmd.CommandText = "SELECT name, value FROM duckdb_settings() WHERE name IN ('memory_limit', 'threads', 'enable_object_cache') ORDER BY name";
var dt = new DataTable();
dt.Load(dkCmd.ExecuteReader());
dt
```

    Set memory_limit = 4GB
    Set threads = 4
    Set enable_object_cache = true

<table><thead><tr><th>name</th><th>value</th></tr></thead><tbody><tr><td>enable_object_cache</td><td>NULL</td></tr><tr><td>memory_limit</td><td>3.7 GiB</td></tr><tr><td>threads</td><td>4</td></tr></tbody></table>

#### DuckDB — VACUUM ANALYZE (reclaim space and update stats)

```csharp
// VACUUM — reclaim space from deleted rows
// ANALYZE — update statistics for the query optimizer

dkCmd.CommandText = "VACUUM";
dkCmd.ExecuteNonQuery();
Console.WriteLine("VACUUM: space reclaimed");

dkCmd.CommandText = "VACUUM ANALYZE";
dkCmd.ExecuteNonQuery();
Console.WriteLine("VACUUM ANALYZE: stats updated + space reclaimed");

// CHECKPOINT — force write of WAL to main storage (file-based DBs only)
// dkCmd.CommandText = "CHECKPOINT";
// dkCmd.ExecuteNonQuery();
// Not needed for in-memory databases
```

    VACUUM: space reclaimed
    VACUUM ANALYZE: stats updated + space reclaimed

#### DuckDB — tuning reference

Quick reference of all DuckDB tuning and maintenance commands.

> [!abstract]- DuckDB Tuning & Maintenance Reference
>
> **Indexes:** `CREATE INDEX idx ON t(col)` (ART index for equality) | `CREATE UNIQUE INDEX` | `duckdb_indexes()` (list all)
>
> **Storage:** `CALL pragma_database_size()` | `CALL pragma_storage_info('table')` (per-column compression) | `SUMMARIZE table` | `DESCRIBE table`
>
> **Memory & Threads:** `SET memory_limit = '4GB'` | `SET threads = 4` | `SET enable_object_cache = true`
>
> **Maintenance:** `VACUUM` (reclaim space) | `VACUUM ANALYZE` (+ update stats) | `CHECKPOINT` (force WAL flush)
>
> **Explain:** `EXPLAIN sql` (plan only) | `EXPLAIN ANALYZE sql` (plan + actual times)
>
> **Key differences from SQL Server:**
> - Indexes are optional (columnar engine + zone maps handle most cases)
> - ART indexes, not B-trees (fast for equality, not ranges)
> - No `ALTER INDEX REBUILD` — auto-compresses
> - No `UPDATE STATISTICS` — use `VACUUM ANALYZE`
> - Memory limit instead of buffer pool — `SET memory_limit`

### DuckDB vs SQL Server Performance

#### DuckDB vs SQL Server — benchmark GROUP BY, LAG window, full scan side by side

```csharp
// Time the same queries on DuckDB vs SQL Server

var sw = new System.Diagnostics.Stopwatch();
var perf = new DataTable();
perf.Columns.Add("Engine"); perf.Columns.Add("Query"); perf.Columns.Add("Time (ms)");

// GROUP BY + AVG
sw.Restart();
dkCmd.CommandText = "SELECT symbol, COUNT(*), ROUND(AVG(close), 2) FROM ohlcv GROUP BY symbol";
dkCmd.Parameters.Clear();
using (var r = dkCmd.ExecuteReader()) while (r.Read()) { }
sw.Stop();
perf.Rows.Add("DuckDB", "GROUP BY + AVG", sw.ElapsedMilliseconds);

sw.Restart();
var sqlBench = new SqlCommand("SELECT symbol, COUNT(*), ROUND(AVG(CAST([close] AS FLOAT)), 2) FROM silver.eurostoxx50_ohlcv GROUP BY symbol", conn);
using (var r = sqlBench.ExecuteReader()) while (r.Read()) { }
sw.Stop();
perf.Rows.Add("SQL Server", "GROUP BY + AVG", sw.ElapsedMilliseconds);

// LAG window function
sw.Restart();
dkCmd.CommandText = "SELECT symbol, date, close, LAG(close) OVER (PARTITION BY symbol ORDER BY date) FROM ohlcv";
using (var r = dkCmd.ExecuteReader()) while (r.Read()) { }
sw.Stop();
perf.Rows.Add("DuckDB", "LAG() window", sw.ElapsedMilliseconds);

sw.Restart();
sqlBench = new SqlCommand("SELECT symbol, date, [close], LAG([close]) OVER (PARTITION BY symbol ORDER BY date) FROM silver.eurostoxx50_ohlcv", conn);
using (var r = sqlBench.ExecuteReader()) while (r.Read()) { }
sw.Stop();
perf.Rows.Add("SQL Server", "LAG() window", sw.ElapsedMilliseconds);

// Full scan
sw.Restart();
dkCmd.CommandText = "SELECT * FROM ohlcv";
using (var r = dkCmd.ExecuteReader()) while (r.Read()) { }
sw.Stop();
perf.Rows.Add("DuckDB", "Full table scan", sw.ElapsedMilliseconds);

sw.Restart();
sqlBench = new SqlCommand("SELECT * FROM silver.eurostoxx50_ohlcv", conn);
using (var r = sqlBench.ExecuteReader()) while (r.Read()) { }
sw.Stop();
perf.Rows.Add("SQL Server", "Full table scan", sw.ElapsedMilliseconds);

perf
```

<table><thead><tr><th>Engine</th><th>Query</th><th>Time (ms)</th></tr></thead><tbody><tr><td>DuckDB</td><td>GROUP BY + AVG</td><td>4</td></tr><tr><td>SQL Server</td><td>GROUP BY + AVG</td><td>16</td></tr><tr><td>DuckDB</td><td>LAG() window</td><td>8</td></tr><tr><td>SQL Server</td><td>LAG() window</td><td>106</td></tr><tr><td>DuckDB</td><td>Full table scan</td><td>2</td></tr><tr><td>SQL Server</td><td>Full table scan</td><td>37</td></tr></tbody></table>

#### DuckDB vs SQL Server — Plotly grouped bar chart of benchmark results

```csharp
// Grouped bar chart

var duckRows = perf.AsEnumerable().Where(r => r["Engine"].ToString() == "DuckDB").ToList();
var sqlRows = perf.AsEnumerable().Where(r => r["Engine"].ToString() == "SQL Server").ToList();

var duckBar = Plotly.NET.CSharp.Chart.Column<double, string, string>(
    values: duckRows.Select(r => Convert.ToDouble(r["Time (ms)"])).ToArray(),
    Keys: duckRows.Select(r => r["Query"].ToString()).ToArray(),
    Name: "DuckDB", MarkerColor: Color.fromHex("#4285F4"));

var sqlBar = Plotly.NET.CSharp.Chart.Column<double, string, string>(
    values: sqlRows.Select(r => Convert.ToDouble(r["Time (ms)"])).ToArray(),
    Keys: sqlRows.Select(r => r["Query"].ToString()).ToArray(),
    Name: "SQL Server", MarkerColor: Color.fromHex("#EA4335"));

Plotly.NET.CSharp.Chart.Combine(new[] { duckBar, sqlBar })
    .WithTitle("DuckDB vs SQL Server — Query Performance (ms)")
    .WithYAxisStyle(Title.init("Time (ms)"))
    .WithSize(800, 450)
    .WithLayout(Layout.init<string>(
        PaperBGColor: Color.fromString("transparent"),
        PlotBGColor: Color.fromString("transparent"),
        Font: Font.init(Color: Color.fromHex("#cccccc"))))
```

<iframe src="/static/plotly/db_cs_01.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### DuckDB — when to use ADO.NET vs Appender vs Dapper for each operation

```csharp
// Which DuckDB interface for which job

var cmp = new DataTable();
cmp.Columns.Add("Operation"); cmp.Columns.Add("ADO.NET"); cmp.Columns.Add("Appender"); cmp.Columns.Add("Dapper");
cmp.Rows.Add("SELECT rows", "ExecuteReader + DataTable", "—", "Query<T> (typed)");
cmp.Rows.Add("Single value", "ExecuteScalar", "—", "ExecuteScalar<T>");
cmp.Rows.Add("Single row", "ExecuteReader + Read()", "—", "QueryFirst<T>");
cmp.Rows.Add("INSERT 1 row", "ExecuteNonQuery", "CreateRow (overkill)", "Execute + anon obj");
cmp.Rows.Add("Bulk INSERT", "Loop + ExecuteNonQuery", "CreateRow loop (fastest)", "Execute + list");
cmp.Rows.Add("UPDATE", "ExecuteNonQuery", "—", "Execute + anon obj");
cmp.Rows.Add("DELETE", "ExecuteNonQuery", "—", "Execute + anon obj");
cmp.Rows.Add("Parameters", "$1, $2 positional", "— (no SQL)", "@Named (anon obj)");
cmp.Rows.Add("Best for", "DDL, schema ops", "Bulk loading", "Typed queries, CRUD");
cmp
```

<table><thead><tr><th>Operation</th><th>ADO.NET</th><th>Appender</th><th>Dapper</th></tr></thead><tbody><tr><td>SELECT rows</td><td>ExecuteReader + DataTable</td><td>—</td><td>Query<T> (typed)</td></tr><tr><td>Single value</td><td>ExecuteScalar</td><td>—</td><td>ExecuteScalar<T></td></tr><tr><td>Single row</td><td>ExecuteReader + Read()</td><td>—</td><td>QueryFirst<T></td></tr><tr><td>INSERT 1 row</td><td>ExecuteNonQuery</td><td>CreateRow (overkill)</td><td>Execute + anon obj</td></tr><tr><td>Bulk INSERT</td><td>Loop + ExecuteNonQuery</td><td>CreateRow loop (fastest)</td><td>Execute + list</td></tr><tr><td>UPDATE</td><td>ExecuteNonQuery</td><td>—</td><td>Execute + anon obj</td></tr><tr><td>DELETE</td><td>ExecuteNonQuery</td><td>—</td><td>Execute + anon obj</td></tr><tr><td>Parameters</td><td>$1, $2 positional</td><td>— (no SQL)</td><td>@Named (anon obj)</td></tr><tr><td>Best for</td><td>DDL, schema ops</td><td>Bulk loading</td><td>Typed queries, CRUD</td></tr></tbody></table>

## Querying Files — DuckDB SQL vs Polars.NET DataFrame

Both DuckDB and Polars can query Parquet, CSV, and JSON files directly.
This section pairs each operation side by side: DuckDB (SQL) then Polars (DataFrame API).

### Read Parquet

#### DuckDB — read Parquet file with SELECT

```csharp
// DuckDB reads Parquet directly — no import, predicate pushdown

var dt = new DataTable();
dkCmd.CommandText = "SELECT symbol, date, close, volume FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet' LIMIT 5";
dkCmd.Parameters.Clear();
dt.Load(dkCmd.ExecuteReader());
dt
```

<table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>ABI.BR</td><td>04-Jan-21</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>05-Jan-21</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>06-Jan-21</td><td>58.77</td><td>1370204</td></tr><tr><td>ABI.BR</td><td>07-Jan-21</td><td>58.4</td><td>1469911</td></tr><tr><td>ABI.BR</td><td>08-Jan-21</td><td>57.86</td><td>1428681</td></tr></tbody></table>

#### Polars — read Parquet file with ReadParquet and Select

```csharp
// Polars equivalent: read Parquet, select same 4 columns, show 5 rows

var df = DataFrame.ReadParquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet");
df.Select("symbol", "date", "close", "volume").Head(5)
```

    Shape: (66355, 12)

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 12 columns)</b></div><table class='pl-dataframe'><thead><tr><th>id<span class='pl-dtype'>int64</span></th><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>adj_close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>dividends<span class='pl-dtype'>double</span></th><th>stock_splits<span class='pl-dtype'>double</span></th><th>is_filled<span class='pl-dtype'>bool</span></th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0</td><td>0</td><td>false</td></tr></tbody></table>

### Read CSV

#### DuckDB — read CSV file with SELECT

```csharp
// DuckDB reads CSV directly — auto-detects schema and headers

var dt = new DataTable();
dkCmd.CommandText = "SELECT symbol, date, close, volume FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.csv' LIMIT 5";
dt.Load(dkCmd.ExecuteReader());
dt
```

<table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>ABI.BR</td><td>04-Jan-21</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>05-Jan-21</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>06-Jan-21</td><td>58.77</td><td>1370204</td></tr><tr><td>ABI.BR</td><td>07-Jan-21</td><td>58.4</td><td>1469911</td></tr><tr><td>ABI.BR</td><td>08-Jan-21</td><td>57.86</td><td>1428681</td></tr></tbody></table>

#### Polars — read CSV file with ReadCsv and Select

```csharp
// Polars equivalent: read CSV, select same 4 columns, show 5 rows

var csvDf = DataFrame.ReadCsv("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.csv");
csvDf.Select("symbol", "date", "close", "volume").Head(5)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 4 columns)</b></div><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>1370204</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>1469911</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>1428681</td></tr></tbody></table>

### Read JSON

#### DuckDB — read JSON file with SELECT

```csharp
// DuckDB reads JSON/JSONL directly

var dt = new DataTable();
dkCmd.CommandText = "SELECT symbol, date, close, volume FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.json' LIMIT 5";
dt.Load(dkCmd.ExecuteReader());
dt
```

<table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04T00:00:00.000</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>2021-01-05T00:00:00.000</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>2021-01-06T00:00:00.000</td><td>58.77</td><td>1370204</td></tr><tr><td>ABI.BR</td><td>2021-01-07T00:00:00.000</td><td>58.4</td><td>1469911</td></tr><tr><td>ABI.BR</td><td>2021-01-08T00:00:00.000</td><td>57.86</td><td>1428681</td></tr></tbody></table>

#### Polars — read JSON file with ReadJson and Select

```csharp
// Polars equivalent: read JSON, select same 4 columns, show 5 rows

var jsonDf = DataFrame.ReadJson("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.json");
jsonDf.Select("symbol", "date", "close", "volume").Head(5)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 4 columns)</b></div><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>utf8view</span></th><th>close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04T00:00:00.000</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>2021-01-05T00:00:00.000</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>2021-01-06T00:00:00.000</td><td>58.77</td><td>1370204</td></tr><tr><td>ABI.BR</td><td>2021-01-07T00:00:00.000</td><td>58.4</td><td>1469911</td></tr><tr><td>ABI.BR</td><td>2021-01-08T00:00:00.000</td><td>57.86</td><td>1428681</td></tr></tbody></table>

### Filter rows

#### DuckDB — filter rows with WHERE and ORDER BY

```csharp
// DuckDB: WHERE symbol = 'SAP.DE'

var dt = new DataTable();
dkCmd.CommandText = "SELECT symbol, date, close, volume FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet' WHERE symbol = 'SAP.DE' ORDER BY date DESC LIMIT 5";
dt.Load(dkCmd.ExecuteReader());
dt
```

<table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>SAP.DE</td><td>12-Mar-26</td><td>166.52</td><td>806722</td></tr><tr><td>SAP.DE</td><td>11-Mar-26</td><td>165.44</td><td>2953782</td></tr><tr><td>SAP.DE</td><td>10-Mar-26</td><td>169.6</td><td>3187246</td></tr><tr><td>SAP.DE</td><td>09-Mar-26</td><td>171.88</td><td>1990823</td></tr><tr><td>SAP.DE</td><td>06-Mar-26</td><td>172.74</td><td>3347221</td></tr></tbody></table>

#### Polars — filter with Filter() and Select()

```csharp
// Polars equivalent: filter symbol = SAP.DE, select same columns, sort, limit 5

df.Filter(Col("symbol") == Lit("SAP.DE"))
    .Select("symbol", "date", "close", "volume")
    .Sort("date", descending: true)
    .Head(5)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 4 columns)</b></div><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>SAP.DE</td><td>2026-03-12</td><td>166.52</td><td>806722</td></tr><tr><td>SAP.DE</td><td>2026-03-11</td><td>165.44</td><td>2953782</td></tr><tr><td>SAP.DE</td><td>2026-03-10</td><td>169.6</td><td>3187246</td></tr><tr><td>SAP.DE</td><td>2026-03-09</td><td>171.88</td><td>1990823</td></tr><tr><td>SAP.DE</td><td>2026-03-06</td><td>172.74</td><td>3347221</td></tr></tbody></table>

### Group and aggregate

#### DuckDB — aggregate with GROUP BY, COUNT, AVG, SUM

```csharp
// DuckDB: GROUP BY + AVG + COUNT

var dt = new DataTable();
dkCmd.CommandText = @"
    SELECT symbol, COUNT(*) AS days, ROUND(AVG(close), 2) AS avg_close,
           SUM(volume) AS total_volume
    FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet'
    GROUP BY symbol ORDER BY total_volume DESC LIMIT 10";
dt.Load(dkCmd.ExecuteReader());
dt
```

<table><thead><tr><th>symbol</th><th>days</th><th>avg_close</th><th>total_volume</th></tr></thead><tbody><tr><td>ISP.MI</td><td>1321</td><td>3.15</td><td>115704541969</td></tr><tr><td>SAN.MC</td><td>1329</td><td>4.43</td><td>55513641918</td></tr><tr><td>ENEL.MI</td><td>1321</td><td>6.82</td><td>32600561934</td></tr><tr><td>BBVA.MC</td><td>1329</td><td>8.65</td><td>22133773194</td></tr><tr><td>UCG.MI</td><td>1321</td><td>28.46</td><td>18366801099</td></tr><tr><td>ENI.MI</td><td>1321</td><td>13.4</td><td>17141570967</td></tr><tr><td>INGA.AS</td><td>1331</td><td>14.04</td><td>17041577555</td></tr><tr><td>IBE.MC</td><td>1329</td><td>12.26</td><td>15994295949</td></tr><tr><td>DTE.DE</td><td>1324</td><td>22.43</td><td>10029411390</td></tr><tr><td>NDA-FI.HE</td><td>1306</td><td>10.85</td><td>7020342991</td></tr></tbody></table>

#### Polars — aggregate with GroupBy and Agg

```csharp
// Polars equivalent: group by symbol, count, avg close, sum volume, top 10

df.GroupBy("symbol")
    .Agg(
        Col("close").Count().Alias("days"),
        Col("close").Mean().Alias("avg_close"),
        Col("volume").Sum().Alias("total_volume")
    )
    .Sort("total_volume", descending: true)
    .Head(10)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 4 columns)</b></div><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>days<span class='pl-dtype'>uint32</span></th><th>avg_close<span class='pl-dtype'>double</span></th><th>total_volume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>ISP.MI</td><td>1321</td><td>3.147987207</td><td>115704541969</td></tr><tr><td>SAN.MC</td><td>1329</td><td>4.42584763</td><td>55513641918</td></tr><tr><td>ENEL.MI</td><td>1321</td><td>6.820438304</td><td>32600561934</td></tr><tr><td>BBVA.MC</td><td>1329</td><td>8.651954101</td><td>22133773194</td></tr><tr><td>UCG.MI</td><td>1321</td><td>28.45710447</td><td>18366801099</td></tr><tr><td>ENI.MI</td><td>1321</td><td>13.39762453</td><td>17141570967</td></tr><tr><td>INGA.AS</td><td>1331</td><td>14.03818783</td><td>17041577555</td></tr><tr><td>IBE.MC</td><td>1329</td><td>12.25531151</td><td>15994295949</td></tr><tr><td>DTE.DE</td><td>1324</td><td>22.43009743</td><td>10029411390</td></tr><tr><td>NDA-FI.HE</td><td>1306</td><td>10.84807887</td><td>7020342991</td></tr></tbody></table>

### Performance — DuckDB query across CSV vs Parquet vs JSON

#### DuckDB — benchmark same aggregate on CSV vs Parquet vs JSON

```csharp
// Compare DuckDB query speed across file formats

var sw = new System.Diagnostics.Stopwatch();
var results = new DataTable();
results.Columns.Add("Format"); results.Columns.Add("Rows"); results.Columns.Add("Time (ms)");

foreach (var (format, path) in new[] {
    ("CSV",     "C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.csv"),
    ("Parquet", "C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet"),
    ("JSON",    "C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.json"),
})
{
    sw.Restart();
    dkCmd.CommandText = $"SELECT symbol, COUNT(*), ROUND(AVG(close), 2) FROM '{path}' GROUP BY symbol";
    int rows = 0;
    using (var reader = dkCmd.ExecuteReader())
        while (reader.Read()) rows++;
    sw.Stop();
    results.Rows.Add(format, rows, sw.ElapsedMilliseconds);
}
results

// Parquet is fastest — columnar format + predicate pushdown
// CSV requires full parse; JSON requires parse + type inference
```

<table><thead><tr><th>Format</th><th>Rows</th><th>Time (ms)</th></tr></thead><tbody><tr><td>CSV</td><td>50</td><td>55</td></tr><tr><td>Parquet</td><td>50</td><td>2</td></tr><tr><td>JSON</td><td>50</td><td>76</td></tr></tbody></table>

### DuckDB vs Polars.NET — reference

| Operation | DuckDB (SQL) | Polars.NET (DataFrame API) |
|---|---|---|
| Read Parquet | `SELECT * FROM 'file.parquet'` | `DataFrame.ReadParquet(path)` |
| Read CSV | `SELECT * FROM 'file.csv'` | `DataFrame.ReadCsv(path)` |
| Filter | `WHERE col = 'val'` | `df.Filter(Col("col") == Lit("val"))` |
| Select | `SELECT col1, col2` | `df.Select("col1", "col2")` |
| Sort | `ORDER BY col DESC` | `df.Sort("col", descending: true)` |
| Group + Agg | `GROUP BY ... AVG(col)` | `df.GroupBy("col").Agg(Col("col").Mean())` |
| Add column | `SELECT *, a-b AS c` | `df.WithColumns((Col("a")-Col("b")).Alias("c"))` |
| Window function | `LAG() OVER (PARTITION BY ...)` | Not available — use DuckDB |
| CTE | `WITH cte AS (...)` | Not available — use DuckDB |
| Export | `COPY (...) TO 'file.parquet'` | `df.WriteParquet(path)` |

#### DuckDB vs Polars — decision guide

| Scenario | Use | Why |
|---|---|---|
| Complex SQL (joins, CTEs, windows) | DuckDB | Full SQL:2003 support |
| Ad-hoc file exploration | DuckDB | SQL on files, no code needed |
| DataFrame transforms | Polars.NET | Method chaining, lazy eval |
| ML pipeline preprocessing | Polars.NET | DataFrame API integrates with ML |
| Notebook data exploration | DuckDB | Write SQL directly, instant results |
| Production ETL validation | DuckDB | SQL assertions on file data |
| Both in same project | Yes | DuckDB for SQL, Polars for transforms |

## Summary

> [!abstract]- C# Database Quick Reference
>
> **SQLite** (`Microsoft.Data.Sqlite`)
> | Pattern | Description |
> |---|---|
> | `new SqliteConnection("DataSource=:memory:")` | In-memory DB |
> | `cmd.Parameters.AddWithValue("@p", value)` | Named parameter |
> | `reader.GetString(0)`, `reader.GetInt32(1)` | Typed column access |
> | `conn.BeginTransaction()` + `tx.Commit()` | Explicit transaction |
>
> **SQL Server** (`Microsoft.Data.SqlClient`)
> | Pattern | Description |
> |---|---|
> | `new SqlConnection(connStr)` | Connect |
> | `cmd.ExecuteReader()` | SELECT → reader |
> | `cmd.ExecuteNonQuery()` | INSERT/UPDATE/DELETE |
> | `cmd.ExecuteScalar()` | Single value |
>
> **Dapper** (micro-ORM)
> | Pattern | Description |
> |---|---|
> | `conn.Query<T>(sql, @params)` | SQL → `List<T>` |
> | `conn.QueryFirst<T>(sql)` | SQL → single `T` |
> | `conn.Execute(sql, @params)` | INSERT/UPDATE/DELETE |
>
> **Python equivalents:** `SqliteConnection` → `sqlite3.connect()` | `SqlConnection` → `pyodbc.connect()` | `SqlCommand` → `cursor.execute()` | Dapper → `pd.read_sql()`/SQLAlchemy
>
> **Medallion architecture:** Bronze (raw ingested data) → Silver (cleaned, deduplicated, SCD-2) → Gold (composite scores, index performance)
