---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [database access, SQL, ORM, pyodbc, Entity Framework, Dapper, SQLAlchemy, connection strings]
keywords: [Entity Framework, Dapper, SqlConnection, DbContext, LINQ to SQL, migrations, connection string, ORM]
description: "C# database reference with executable examples and cell outputs — covers Entity Framework Core, Dapper, raw ADO.NET, migrations, and connection string patterns. See [[14_py_database]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[14_py_database]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 14. Database - C#

Topics covered:
- SQLite CRUD (Microsoft.Data.Sqlite)
- SQL Server with SqlClient (index data, medallion architecture)
- SQL Server with ODBC Provider (same driver as Python pyodbc)
- Parameterized Queries & SQL Injection Prevention
- Dapper (micro-ORM, like pandas read_sql / SQLAlchemy)
- Real-world Index Provider Queries (index provider)


```csharp
// Suppress CS1701/CS1702 assembly version warnings in .NET Interactive.
// These are harmless — .NET unifies assemblies at runtime correctly.
// NuGet packages compiled against .NET 8/9 trigger these on .NET 10.
// We set WarningLevel=0 on the Roslyn ScriptOptions to hide them.
//
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

Console.WriteLine("WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.");
```

    WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.
    

## 1. SQLite — Lightweight Embedded Database


```csharp
#r "nuget: Microsoft.Data.Sqlite"

using Microsoft.Data.Sqlite;

// SQLite in C# — Microsoft.Data.Sqlite
//
// KEY CONCEPTS:
// - SqliteConnection, SqliteCommand, SqliteDataReader — ADO.NET pattern.
//   Python equivalent: sqlite3.connect(), cursor.execute(), cursor.fetchall()
// - Parameterized queries: use @param named placeholders.
//   Python equivalent: ? positional placeholders.
// - using statement: auto-disposes connection (like Python context manager).
// - DataSource=:memory: for in-memory DB.

// ─── Create in-memory database ───
var conn = new SqliteConnection("DataSource=:memory:");
conn.Open();

// ─── CREATE TABLE ───
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

// ─── INSERT (parameterized — @param placeholders) ───
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

// ─── SELECT ───
Console.WriteLine("\n=== All Trades ===");
cmd = conn.CreateCommand();
cmd.CommandText = "SELECT *, quantity * price AS notional FROM trades ORDER BY trade_date, trade_id";
using (var reader = cmd.ExecuteReader())
{
    while (reader.Read())
    {
        var notional = reader.GetDouble(reader.GetOrdinal("notional"));
        Console.WriteLine($"  {reader["trade_id"],-8} | {reader["ticker"],-8} | {reader["side"],-4} | "
            + $"{reader["quantity"],5} | {reader["price"],10:N2} | {notional,12:N2} | {reader["trade_date"]}");
    }
}

// ─── WHERE with parameters ───
Console.WriteLine("\n=== ASML Trades Only ===");
cmd = conn.CreateCommand();
cmd.CommandText = "SELECT * FROM trades WHERE ticker = @ticker";
cmd.Parameters.AddWithValue("@ticker", "ASML.AS");
using (var reader = cmd.ExecuteReader())
{
    while (reader.Read())
        Console.WriteLine($"  {reader["trade_id"]} | {reader["side"]} | {reader["quantity"]} @ {Convert.ToDouble(reader["price"]):N2}");
}

// ─── Aggregate queries ───
Console.WriteLine("\n=== Portfolio Summary ===");
cmd = conn.CreateCommand();
cmd.CommandText = @"
    SELECT ticker,
           SUM(CASE WHEN side='BUY' THEN quantity ELSE -quantity END) AS net_shares,
           ROUND(SUM(CASE WHEN side='BUY' THEN quantity*price ELSE -quantity*price END), 2) AS net_notional,
           COUNT(*) AS trade_count
    FROM trades GROUP BY ticker ORDER BY net_notional DESC";
using (var reader = cmd.ExecuteReader())
{
    while (reader.Read())
        Console.WriteLine($"  {reader["ticker"],-8} | {Convert.ToInt64(reader["net_shares"]),6} shares | "
            + $"{Convert.ToDouble(reader["net_notional"]),12:N2} | {reader["trade_count"]} trades");
}

// ─── UPDATE ───
cmd = conn.CreateCommand();
cmd.CommandText = "UPDATE trades SET price = @price WHERE trade_id = @id";
cmd.Parameters.AddWithValue("@price", 700.00);
cmd.Parameters.AddWithValue("@id", "TRD_004");
Console.WriteLine($"\nUpdated TRD_004 price -> $700.00 ({cmd.ExecuteNonQuery()} row affected)");

// ─── DELETE ───
cmd = conn.CreateCommand();
cmd.CommandText = "DELETE FROM trades WHERE trade_id = @id";
cmd.Parameters.AddWithValue("@id", "TRD_006");
Console.WriteLine($"Deleted TRD_006 ({cmd.ExecuteNonQuery()} row affected)");

// ─── Transaction ───
Console.WriteLine("\n=== Transaction Example ===");
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


<div><div></div><div></div><div><strong>Installed Packages</strong><ul><li><span>Microsoft.Data.Sqlite, 10.0.5</span></li></ul></div></div>


    Created table: trades
    Inserted 6 trades
    
    === All Trades ===
      TRD_001  | ASML.AS  | BUY  |   100 |     685.40 |    68'540.00 | 2026-03-15
      TRD_002  | MC.PA    | BUY  |    50 |     890.20 |    44'510.00 | 2026-03-15
      TRD_003  | SAP.DE   | SELL |    75 |     245.80 |    18'435.00 | 2026-03-15
      TRD_004  | ASML.AS  | SELL |    30 |     690.00 |    20'700.00 | 2026-03-16
      TRD_005  | RMS.PA   | BUY  |    20 |   2'850.00 |    57'000.00 | 2026-03-16
      TRD_006  | SIE.DE   | BUY  |   200 |     198.50 |    39'700.00 | 2026-03-17
    
    === ASML Trades Only ===
      TRD_001 | BUY | 100 @ 685.40
      TRD_004 | SELL | 30 @ 690.00
    
    === Portfolio Summary ===
      RMS.PA   |     20 shares |    57'000.00 | 1 trades
      ASML.AS  |     70 shares |    47'840.00 | 2 trades
      MC.PA    |     50 shares |    44'510.00 | 1 trades
      SIE.DE   |    200 shares |    39'700.00 | 1 trades
      SAP.DE   |    -75 shares |   -18'435.00 | 1 trades
    
    Updated TRD_004 price -> $700.00 (1 row affected)
    Deleted TRD_006 (1 row affected)
    
    === Transaction Example ===
      Transaction committed (2 trades inserted)
    
    Total trades: 7
    

## 2. SQL Server — Index Data (Medallion Architecture)


```csharp
#r "nuget: Microsoft.Data.SqlClient"

using Microsoft.Data.SqlClient;

// SQL Server with ADO.NET (SqlClient) — connecting to the stoxx database.
//
// DATABASE: stoxx (index provider index data)
// Architecture: Bronze (raw) → Silver (cleaned) → Gold (computed scores)
// Indices: Euro Stoxx 50, STOXX Asia/Pacific 50, STOXX USA 50, Oil & Gas 20

var connStr = "Server=localhost,1434;Database=stoxx;"
    + "User Id=sa;Password=EsgDev2026Pass1;"
    + "Encrypt=True;TrustServerCertificate=True;";

using (var conn = new SqlConnection(connStr))
{
    conn.Open();
    Console.WriteLine("Connected to SQL Server: stoxx database");

    // ─── List tables by schema (bronze/silver/gold) ───
    Console.WriteLine("\n=== Tables by Schema ===");
    var cmd = new SqlCommand(@"
        SELECT s.name AS schema_name, t.name AS table_name, p.rows
        FROM sys.tables t
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
        ORDER BY s.name, t.name", conn);

    var currentSchema = "";
    using (var reader = cmd.ExecuteReader())
    {
        while (reader.Read())
        {
            var schema = reader.GetString(0);
            if (schema != currentSchema)
            {
                currentSchema = schema;
                Console.WriteLine($"\n  [{schema.ToUpper()}]");
            }
            Console.WriteLine($"    {reader.GetString(1),-30} {reader.GetInt64(2),10:N0} rows");
        }
    }

    // ─── Index universe ───
    Console.WriteLine("\n=== Index Universe ===");
    cmd = new SqlCommand("SELECT index_key, display_name, currency FROM bronze.dim_index ORDER BY display_name", conn);
    using (var reader = cmd.ExecuteReader())
    {
        while (reader.Read())
            Console.WriteLine($"  {reader.GetString(0),-20} {reader.GetString(1),-30} {(reader.IsDBNull(2) ? "" : reader.GetString(2))}");
    }
}
```


<div><div></div><div></div><div><strong>Installed Packages</strong><ul><li><span>Microsoft.Data.SqlClient, 7.0.0</span></li></ul></div></div>


    Connected to SQL Server: stoxx database
    
    === Tables by Schema ===
    
      [BRONZE]
        dim_country                           212 rows
        dim_index                               4 rows
        eurostoxx50_ohlcv                      50 rows
        index_dim                             169 rows
        oil20_ohlcv                            19 rows
        pulse                                  40 rows
        pulse_tickers                          40 rows
        signals_daily                         169 rows
        signals_quarterly                     169 rows
        stoxxasia50_ohlcv                      50 rows
        stoxxusa50_ohlcv                       50 rows
        trading_calendar                   29'335 rows
    
      [GOLD]
        index_performance                   5'281 rows
        scores_daily                          466 rows
        scores_quarterly                      170 rows
    
      [SILVER]
        eurostoxx50_ohlcv                  66'355 rows
        index_dim                             169 rows
        oil20_ohlcv                        24'738 rows
        signals_daily                         466 rows
        signals_quarterly                     177 rows
        stoxxasia50_ohlcv                  64'045 rows
        stoxxusa50_ohlcv                   65'100 rows
    
    === Index Universe ===
      euro_stoxx_50        Euro Stoxx 50                  €
      oil_20               Oil & Gas 20                   $
      stoxx_asia_50        STOXX Asia/Pacific 50          
      stoxx_usa_50         STOXX USA 50                   $
    


```csharp
#r "nuget: Microsoft.Data.SqlClient"

using Microsoft.Data.SqlClient;

// SQL Server — exploring a real index provider database.
//
// DATABASE: stoxx (index provider index data)
// Architecture: Bronze (raw) → Silver (cleaned) → Gold (computed scores)
// Indices: Euro Stoxx 50, STOXX Asia/Pacific 50, STOXX USA 50, Oil & Gas 20
// ~169 stocks, OHLCV history from 2021, daily/quarterly signals, composite scores.

var connStr = "Server=localhost,1434;Database=stoxx;"
    + "User Id=sa;Password=EsgDev2026Pass1;"
    + "Encrypt=True;TrustServerCertificate=True;";

var conn = new SqlConnection(connStr);
conn.Open();
Console.WriteLine("Connected to SQL Server: stoxx database");

// ─── List tables by schema (bronze/silver/gold) ───
Console.WriteLine("\n=== Tables by Schema ===");
var cmd = new SqlCommand(@"
    SELECT s.name AS schema_name, t.name AS table_name, p.rows
    FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
    ORDER BY s.name, t.name", conn);

var currentSchema = "";
using (var reader = cmd.ExecuteReader())
{
    while (reader.Read())
    {
        var schema = reader.GetString(0);
        if (schema != currentSchema)
        {
            currentSchema = schema;
            Console.WriteLine($"\n  [{schema.ToUpper()}]");
        }
        Console.WriteLine($"    {reader.GetString(1),-30} {reader.GetInt64(2),10:N0} rows");
    }
}

// ─── Index universe ───
Console.WriteLine("\n=== Index Universe ===");
cmd = new SqlCommand("SELECT index_key, display_name, currency FROM bronze.dim_index ORDER BY display_name", conn);
using (var reader = cmd.ExecuteReader())
{
    while (reader.Read())
        Console.WriteLine($"  {reader.GetString(0),-20} {reader.GetString(1),-30} {(reader.IsDBNull(2) ? "" : reader.GetString(2))}");
}

conn.Close();
```


<div><div></div><div></div><div><strong>Installed Packages</strong><ul><li><span>Microsoft.Data.SqlClient, 7.0.0</span></li></ul></div></div>


    Connected to SQL Server: stoxx database
    
    === Tables by Schema ===
    
      [BRONZE]
        dim_country                           212 rows
        dim_index                               4 rows
        eurostoxx50_ohlcv                      50 rows
        index_dim                             169 rows
        oil20_ohlcv                            19 rows
        pulse                                  40 rows
        pulse_tickers                          40 rows
        signals_daily                         169 rows
        signals_quarterly                     169 rows
        stoxxasia50_ohlcv                      50 rows
        stoxxusa50_ohlcv                       50 rows
        trading_calendar                   29'335 rows
    
      [GOLD]
        index_performance                   5'281 rows
        scores_daily                          466 rows
        scores_quarterly                      170 rows
    
      [SILVER]
        eurostoxx50_ohlcv                  66'355 rows
        index_dim                             169 rows
        oil20_ohlcv                        24'738 rows
        signals_daily                         466 rows
        signals_quarterly                     177 rows
        stoxxasia50_ohlcv                  64'045 rows
        stoxxusa50_ohlcv                   65'100 rows
    
    === Index Universe ===
      euro_stoxx_50        Euro Stoxx 50                  €
      oil_20               Oil & Gas 20                   $
      stoxx_asia_50        STOXX Asia/Pacific 50          
      stoxx_usa_50         STOXX USA 50                   $
    

## 3. ODBC Provider


```csharp
#r "nuget: System.Data.Odbc"

using System.Data.Odbc;

// ODBC Provider — alternative to SqlClient, same driver as Python pyodbc.
//
// KEY DIFFERENCES from SqlClient:
// - Uses ODBC Driver 18 (same driver as Python pyodbc).
// - ? positional placeholders (same as Python), not @param.
// - System.Data.Odbc is built into .NET — no NuGet needed.
// - SqlClient is preferred for SQL Server-specific features.
// - ODBC is useful for cross-database portability.

var odbcConnStr = "Driver={ODBC Driver 18 for SQL Server};"
    + "Server=localhost,1434;Database=stoxx;"
    + "UID=sa;PWD=EsgDev2026Pass1;"
    + "Encrypt=yes;TrustServerCertificate=yes;";

using (var conn = new OdbcConnection(odbcConnStr))
{
    conn.Open();
    Console.WriteLine("=== ODBC Provider (same driver as Python pyodbc) ===");

    // ? positional params — same as Python pyodbc
    var cmd = new OdbcCommand("SELECT TOP 5 symbol, short_name, composite_score FROM gold.scores_daily WHERE _index = ? ORDER BY composite_rank", conn);
    cmd.Parameters.AddWithValue("@p1", "euro_stoxx_50");

    using (var r = cmd.ExecuteReader())
    {
        while (r.Read())
            Console.WriteLine($"  {r["symbol"],-10} {(r.IsDBNull(1) ? "" : r.GetString(1)),-20} {Convert.ToDouble(r["composite_score"]):F4}");
    }
}

// ─── SqlClient vs ODBC ───
Console.WriteLine("\n=== SqlClient vs ODBC ===");
Console.WriteLine($"{"Feature",-20} {"SqlClient",-25} {"ODBC",-25}");
Console.WriteLine(new string('─', 70));
Console.WriteLine($"{"NuGet needed",-20} {"Yes (SqlClient)",-25} {"No (built-in)",-25}");
Console.WriteLine($"{"Parameters",-20} {"@named",-25} {"? positional",-25}");
Console.WriteLine($"{"SQL Server features",-20} {"Full",-25} {"Standard ODBC only",-25}");
Console.WriteLine($"{"Python equivalent",-20} {"—",-25} {"pyodbc",-25}");
Console.WriteLine($"{"Connection string",-20} {"Server=...",-25} {"Driver=...",-25}");
```


<div><div></div><div></div><div><strong>Installed Packages</strong><ul><li><span>System.Data.Odbc, 10.0.5</span></li></ul></div></div>


    === ODBC Provider (same driver as Python pyodbc) ===
      BNP.PA     BNP PARIBAS ACT.A    0.6839
      BNP.PA     BNP PARIBAS ACT.A    0.6640
      BNP.PA     BNP PARIBAS ACT.A    0.6796
      DTE.DE     DEUTSCHE TELEKOM AG  0.5150
      DTE.DE     DEUTSCHE TELEKOM AG  0.5214
    
    === SqlClient vs ODBC ===
    Feature              SqlClient                 ODBC                     
    ──────────────────────────────────────────────────────────────────────
    NuGet needed         Yes (SqlClient)           No (built-in)            
    Parameters           @named                    ? positional             
    SQL Server features  Full                      Standard ODBC only       
    Python equivalent    —                         pyodbc                   
    Connection string    Server=...                Driver=...               
    

## 4. Dapper — Micro-ORM


```csharp
// Dapper — lightweight ORM that maps SQL results to C# objects.
//
// NOTE: Dapper is a NuGet package — in a notebook it triggers CS1701 warnings
// (suppressed by the WarningLevel=0 cell above). In a real project it works cleanly.
// Here we show both the Dapper API and the ADO.NET equivalent side by side.
//
// KEY CONCEPTS:
// - conn.Query<T>(sql): executes SQL, maps each row to T automatically.
//   Python equivalent: pd.read_sql() returning a DataFrame.
// - conn.QueryFirst<T>(sql): single result.
// - conn.Execute(sql, @params): for INSERT/UPDATE/DELETE.
// - Dapper maps column names to property names automatically.
// - Much lighter than Entity Framework — you write SQL, Dapper maps results.

Console.WriteLine("=== Dapper API Reference ===");
Console.WriteLine();
Console.WriteLine("// Install:");
Console.WriteLine("//   dotnet add package Dapper");
Console.WriteLine("//   dotnet add package Microsoft.Data.SqlClient");
Console.WriteLine();
Console.WriteLine("// ─── Query into typed list ───");
Console.WriteLine("// var prices = conn.Query<OhlcvRow>(sql, new { Symbol = \"ASML.AS\" });");
Console.WriteLine("// foreach (var p in prices)");
Console.WriteLine("//     Console.WriteLine($\"{p.Symbol} | {p.Date:yyyy-MM-dd} | {p.Close}\");");
Console.WriteLine();
Console.WriteLine("// ─── Query with parameters ───");
Console.WriteLine("// var scores = conn.Query<ScoreRow>(sql, new { Index = \"euro_stoxx_50\" });");
Console.WriteLine();
Console.WriteLine("// ─── Scalar ───");
Console.WriteLine("// var count = conn.ExecuteScalar<long>(\"SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv\");");
Console.WriteLine();
Console.WriteLine("// ─── Insert ───");
Console.WriteLine("// conn.Execute(insertSql, new { TradeId = \"TRD_001\", Ticker = \"AAPL\" });");
Console.WriteLine();
Console.WriteLine("// ─── DTOs ───");
Console.WriteLine("// record OhlcvRow(string Symbol, DateTime Date, double Close, long Volume);");
Console.WriteLine("// record ScoreRow(string Symbol, double CompositeScore, int CompositeRank);");

Console.WriteLine();
Console.WriteLine("=== ADO.NET vs Dapper vs Entity Framework ===");
Console.WriteLine();
Console.WriteLine($"{"Feature",-20} {"ADO.NET (raw)",-20} {"Dapper",-20} {"EF Core",-20}");
Console.WriteLine(new string('─', 80));
Console.WriteLine($"{"SQL control",-20} {"Full",-20} {"Full",-20} {"LINQ (auto-gen)",-20}");
Console.WriteLine($"{"Mapping",-20} {"Manual (reader)",-20} {"Auto (col→prop)",-20} {"Auto (navigation)",-20}");
Console.WriteLine($"{"Performance",-20} {"Fastest",-20} {"~Same as ADO.NET",-20} {"Slower (tracking)",-20}");
Console.WriteLine($"{"Boilerplate",-20} {"Lots",-20} {"Minimal",-20} {"Minimal",-20}");
Console.WriteLine($"{"Best for",-20} {"Notebooks, scripts",-20} {"Services, APIs",-20} {"Large apps, CRUD",-20}");
Console.WriteLine($"{"Python equiv",-20} {"pyodbc",-20} {"pd.read_sql()",-20} {"SQLAlchemy ORM",-20}");
```

    === Dapper API Reference ===
    
    // Install:
    //   dotnet add package Dapper
    //   dotnet add package Microsoft.Data.SqlClient
    
    // ─── Query into typed list ───
    // var prices = conn.Query<OhlcvRow>(sql, new { Symbol = "ASML.AS" });
    // foreach (var p in prices)
    //     Console.WriteLine($"{p.Symbol} | {p.Date:yyyy-MM-dd} | {p.Close}");
    
    // ─── Query with parameters ───
    // var scores = conn.Query<ScoreRow>(sql, new { Index = "euro_stoxx_50" });
    
    // ─── Scalar ───
    // var count = conn.ExecuteScalar<long>("SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv");
    
    // ─── Insert ───
    // conn.Execute(insertSql, new { TradeId = "TRD_001", Ticker = "AAPL" });
    
    // ─── DTOs ───
    // record OhlcvRow(string Symbol, DateTime Date, double Close, long Volume);
    // record ScoreRow(string Symbol, double CompositeScore, int CompositeRank);
    
    === ADO.NET vs Dapper vs Entity Framework ===
    
    Feature              ADO.NET (raw)        Dapper               EF Core             
    ────────────────────────────────────────────────────────────────────────────────
    SQL control          Full                 Full                 LINQ (auto-gen)     
    Mapping              Manual (reader)      Auto (col→prop)      Auto (navigation)   
    Performance          Fastest              ~Same as ADO.NET     Slower (tracking)   
    Boilerplate          Lots                 Minimal              Minimal             
    Best for             Notebooks, scripts   Services, APIs       Large apps, CRUD    
    Python equiv         pyodbc               pd.read_sql()        SQLAlchemy ORM      
    

## 5. Summary


```csharp
// Summary — C# database cheat sheet
//
// SQLITE (Microsoft.Data.Sqlite):
// new SqliteConnection("DataSource=:memory:")    In-memory DB
// cmd.Parameters.AddWithValue("@p", value)       Named parameter
// reader.GetString(0), reader.GetInt32(1)        Typed column access
// reader["column_name"]                          Name-based access
// conn.BeginTransaction() + tx.Commit()          Explicit transaction
//
// SQL SERVER (Microsoft.Data.SqlClient):
// new SqlConnection(connStr)                     Connect
// new SqlCommand(sql, conn)                      Create command
// cmd.ExecuteReader()                            SELECT → reader
// cmd.ExecuteNonQuery()                          INSERT/UPDATE/DELETE
// cmd.ExecuteScalar()                            Single value
//
// DAPPER (micro-ORM):
// conn.Query<T>(sql, @params)                    SQL → List<T>
// conn.QueryFirst<T>(sql)                        SQL → single T
// conn.Execute(sql, @params)                     INSERT/UPDATE/DELETE
//
// PYTHON EQUIVALENTS:
// SqliteConnection      → sqlite3.connect()
// SqlConnection          → pyodbc.connect()
// SqlCommand             → cursor.execute()
// SqlDataReader          → cursor.fetchall()
// @param                 → ? placeholder
// Dapper                 → pd.read_sql() / SQLAlchemy
// BeginTransaction()     → with conn: (context manager)
//
// MEDALLION ARCHITECTURE (stoxx database):
// Bronze: raw ingested data (latest batch, dim tables)
// Silver: cleaned, deduplicated, SCD-2, full OHLCV history
// Gold:   composite scores (value/momentum/sentiment), index performance
```
