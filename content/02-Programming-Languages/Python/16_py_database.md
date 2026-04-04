---
tags: [python]
aliases: [database access, SQL, ORM, pyodbc, Entity Framework, Dapper, SQLAlchemy, connection strings]
description: "Python database reference with executable examples and cell outputs — covers pyodbc, SQLAlchemy ORM, raw SQL, transactions, and pandas integration. See [16_cs_database](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/16_cs_database) for the C# equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 16. Database - Python

> [!quote]
> "Future users of large data banks must be protected from having to know how the data is organized in the machine."
>
> — **Edgar F. Codd**, *A Relational Model of Data for Large Shared Data Banks* (1970)

```python
import sqlite3
import pyodbc
import pandas as pd
import urllib.parse
import duckdb
import polars as pl
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, DeclarativeBase, Mapped, mapped_column
from datetime import date as Date, datetime
import time

DATA = "C:/Users/aperi/DEV/LANG/data"

# Polars: strip quotes from string values in HTML display
_html_fmt = get_ipython().display_formatter.formatters["text/html"]
_html_fmt.for_type(pl.DataFrame, lambda df: df.to_pandas().style.hide(axis="index").to_html())
```

## SQLite — Built-in Embedded Database

### Connection, Schema, and CRUD

#### SQLite — connect and CREATE TABLE

> [!info] SQLite basics
>
> - `sqlite3.connect(":memory:")` — in-memory; or pass a file path
> - `cursor.execute(sql, params)` — `?` placeholders for parameterized queries
> - Context manager (`with conn:`) — auto-commits on success, rolls back on exception
> - Built-in — no pip install, no server
> - Use for tests, prototyping, local caches; for concurrent access, use SQL Server or PostgreSQL

> [!danger] SQL injection
>
> Never use f-strings in SQL — always use `?` parameter placeholders.

> [!success] Use parameterized queries
>
> ```python
> # Safe: parameter placeholder
> cur.execute("SELECT * FROM trades WHERE ticker = ?", (ticker,))
> # Safe: multiple parameters
> cur.execute("INSERT INTO trades VALUES (?, ?, ?)", (id, ticker, price))
> ```

```python
conn = sqlite3.connect(":memory:")
conn.row_factory = sqlite3.Row  # dict-like row access
cur = conn.cursor()

cur.execute("""
    CREATE TABLE trades (
        trade_id   TEXT PRIMARY KEY,
        ticker     TEXT NOT NULL,
        side       TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
        quantity   INTEGER NOT NULL CHECK(quantity > 0),
        price      REAL NOT NULL CHECK(price > 0),
        trade_date TEXT NOT NULL DEFAULT (Date('now'))
    )""")
# Created table: trades
```

```text
trades
```

#### SQLite — INSERT with ? parameterised queries

`executemany()` bulk-inserts a list of tuples in a single call. Use `?` placeholders for every user-supplied value — never build SQL strings with f-strings. `conn.commit()` persists the inserts to disk.

```python
trades = [
    ("TRD_001", "ASML.AS", "BUY",  100, 685.40, "2026-03-15"),
    ("TRD_002", "MC.PA",   "BUY",   50, 890.20, "2026-03-15"),
    ("TRD_003", "SAP.DE",  "SELL",  75, 245.80, "2026-03-15"),
    ("TRD_004", "ASML.AS", "SELL",  30, 690.00, "2026-03-16"),
    ("TRD_005", "RMS.PA",  "BUY",   20, 2850.0, "2026-03-16"),
    ("TRD_006", "SIE.DE",  "BUY",  200, 198.50, "2026-03-17"),
]
cur.executemany("INSERT INTO trades VALUES (?,?,?,?,?,?)", trades)
conn.commit()
len(trades)  # trades inserted
```

```text
Inserted 6 trades
```

#### SQLite — SELECT into pandas DataFrame

> [!warning] cursor.fetchall() loads the entire result
>
> `cursor.fetchall()` loads the entire result set into memory
> For large tables (millions of rows), `fetchall()` or `pd.read_sql()` without a `WHERE`/`LIMIT` clause can exhaust RAM and crash your process. Use `fetchmany(batch_size)` for streaming, or push filtering to SQL with `WHERE`/`LIMIT`. For analytics, prefer DuckDB which streams columnar data efficiently.

> [!success] Stream large results with fetchmany or push filtering to SQL
>
> ```python
> # Stream in batches instead of loading all rows
> cur.execute("SELECT * FROM trades")
> while batch := cur.fetchmany(1000):
>     process(batch)
> # Or push filtering to SQL
> cur.execute("SELECT * FROM trades WHERE trade_date >= ?", ("2024-01-01",))
> ```

```python
# SELECT — display as pandas DataFrame

pd.read_sql("SELECT *, quantity * price AS notional FROM trades ORDER BY trade_date, trade_id", conn)
```

```text
   trade_id   ticker  side  quantity   price  trade_date   notional
0   TRD_001  ASML.AS   BUY       100   685.4  2026-03-15  68540.0
1   TRD_002    MC.PA   BUY        50   890.2  2026-03-15  44510.0
2   TRD_003   SAP.DE  SELL        75   245.8  2026-03-15  18435.0
3   TRD_004  ASML.AS  SELL        30   690.0  2026-03-16  20700.0
4   TRD_005   RMS.PA   BUY        20  2850.0  2026-03-16  57000.0
5   TRD_006   SIE.DE   BUY       200   198.5  2026-03-17  39700.0
```

#### SQLite — SELECT with WHERE parameter

Pass a parameter tuple to `params=` in `pd.read_sql()` to safely inject filter values into a `WHERE` clause. The `?` placeholder is substituted by the underlying cursor, preventing SQL injection.

```python
pd.read_sql("SELECT * FROM trades WHERE ticker = ?", conn, params=("ASML.AS",))
```

```text
   trade_id   ticker  side  quantity  price  trade_date
0   TRD_001  ASML.AS   BUY       100  685.4  2026-03-15
1   TRD_004  ASML.AS  SELL        30  690.0  2026-03-16
```

#### SQLite — aggregate with GROUP BY

GROUP BY with conditional aggregation computes net position per ticker in a single pass. `SUM(CASE WHEN side='BUY' THEN quantity ELSE -quantity END)` is more efficient than two separate queries.

```python
pd.read_sql("""
    SELECT ticker,
           SUM(CASE WHEN side='BUY' THEN quantity ELSE -quantity END) AS net_shares,
           ROUND(SUM(CASE WHEN side='BUY' THEN quantity*price ELSE -quantity*price END), 2) AS net_notional,
           COUNT(*) AS trade_count
    FROM trades GROUP BY ticker ORDER BY net_notional DESC""", conn)
```

```text
    ticker  net_shares  net_notional  trade_count
0   RMS.PA          20       57000.0            1
1  ASML.AS          70       47840.0            2
2    MC.PA          50       44510.0            1
3   SIE.DE         200       39700.0            1
4   SAP.DE         -75      -18435.0            1
```

#### SQLite — UPDATE and DELETE

`cursor.rowcount` returns the number of rows affected after an UPDATE or DELETE. Changes are not persisted until `conn.commit()` is called (or the connection context manager exits successfully).

```python
cur.execute("UPDATE trades SET price = ? WHERE trade_id = ?", (700.00, "TRD_004"))
cur.rowcount  # UPDATE rows affected

cur.execute("DELETE FROM trades WHERE trade_id = ?", ("TRD_006",))
cur.rowcount  # DELETE rows affected
conn.commit()
```

```text
1 row
1 row
```

### Transactions

#### SQLite — transaction with context manager

Using `with conn:` as a context manager automatically commits on success and rolls back on any exception — without needing an explicit `conn.commit()` call. This is the safest way to group multiple DML statements atomically.

```python
try:
    with conn:
        conn.execute("INSERT INTO trades VALUES (?,?,?,?,?,?)",
            ("TRD_007", "TTE.PA", "BUY", 150, 58.30, Date.today().isoformat()))
        conn.execute("INSERT INTO trades VALUES (?,?,?,?,?,?)",
            ("TRD_008", "BNP.PA", "BUY", 80, 72.10, Date.today().isoformat()))
    print("Transaction committed (2 trades)")
except Exception as e:
    print(f"Transaction rolled back: {e}")

conn.execute('SELECT COUNT(*) FROM trades').fetchone()[0]  # Total trades
```

```text
Transaction committed (2 trades)
7
```

### PRAGMA and Indexes

#### SQLite — PRAGMA settings for performance

PRAGMA statements configure SQLite behavior per connection. `WAL` mode allows concurrent readers while a writer is active. `synchronous=NORMAL` reduces `fsync` calls for a significant write speed boost with minimal durability risk. Settings do not persist — they must be re-applied each time a connection is opened.

```python
for pragma, value in [
    ("journal_mode", "WAL"),
    ("synchronous", "NORMAL"),
    ("cache_size", "-20000"),
    ("busy_timeout", "5000"),
    ("foreign_keys", "ON"),
]:
    cur.execute(f"PRAGMA {pragma}={value}")
    result = cur.execute(f"PRAGMA {pragma}").fetchone()[0]
    print(f"  {pragma:20s} = {result}")
```

```text
  journal_mode         = memory
  synchronous          = 1
  cache_size           = -20000
  busy_timeout         = 5000
  foreign_keys         = 1
```

#### SQLite — CREATE INDEX and EXPLAIN QUERY PLAN

`EXPLAIN QUERY PLAN` shows whether SQLite uses a full table scan or an index seek for a given query. Use it to verify that indexes are being picked up — the output changes from `SCAN trades` to `SEARCH trades USING INDEX` once the index exists.

```python
cur.execute("CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker)")

plan = cur.execute("EXPLAIN QUERY PLAN SELECT * FROM trades WHERE ticker = 'ASML.AS'").fetchall()
for row in plan:
    print(f"  {dict(row)}")

conn.close()
```

```text
idx_trades_ticker
  {'id': 3, 'parent': 0, 'notused': 0, 'detail': 'SEARCH trades USING INDEX idx_trades_ticker (ticker=?)'}
```

## SQL Server — pyodbc (ODBC Driver 18)

The SQL patterns used below (parameterised queries, window functions, CTEs) follow the same T-SQL dialect covered in [sql-fundamentals](https://alp78.github.io/elysium/05-DB-Queries/SQL-Server/sql-fundamentals). For how connection pooling interacts with SQL Server lock behavior under concurrent writes, see [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking).

### Connection and CRUD

#### SQL Server — connect and list schemas/tables

> [!danger] Connection pool exhaustion
>
> Connection pool exhausting — always close connections
> `pyodbc.connect()` without `with` or explicit `.close()` leaks connections. SQL Server defaults to a max pool of 100 connections — once exhausted, new connections block or fail with timeout errors. Always use `with conn:` or wrap in try/finally. For SQLAlchemy, `engine.dispose()` reclaims all pooled connections.

> [!success] Always close connections with a context manager or try/finally
>
> ```python
> # Preferred: context manager auto-closes on exit
> with pyodbc.connect(conn_str) as conn:
>     with conn.cursor() as cur:
>         cur.execute("SELECT 1")
> # Alternative: explicit close in finally
> conn = pyodbc.connect(conn_str)
> try:
>     ...
> finally:
>     conn.close()
> ```

> [!info] SQL Server connection pattern
>
> - `pyodbc.connect()` — direct cursor for DML (fast, `rowcount` available)
> - `SQLAlchemy create_engine()` — for `pd.read_sql()` (avoids DBAPI2 warnings, adds connection pooling)
> - Both use ODBC Driver 18 underneath
> - For ORM scenarios, use SQLAlchemy ORM instead

```python
import urllib.parse

conn_str = (
    'Driver={ODBC Driver 18 for SQL Server};'
    'Server=localhost,1434;Database=stoxx;'
    'UID=sa;PWD=EsgDev2026Pass1;'
    'Encrypt=yes;TrustServerCertificate=yes;'
)

# pyodbc connection for DML (INSERT/UPDATE/DELETE)
sql_conn = pyodbc.connect(conn_str)
cur = sql_conn.cursor()

# SQLAlchemy engine for pd.read_sql (no warnings)
odbc_params = urllib.parse.quote_plus(conn_str)
sql_engine = create_engine(f"mssql+pyodbc:///?odbc_connect={odbc_params}")

# Connected to SQL Server: stoxx database
```

```text
stoxx database
```

#### SQL Server — SELECT with parameterised query

`pd.read_sql()` accepts a `params=` tuple that maps to `?` placeholders in the query string. This is the correct way to pass filter values when using pyodbc or SQLAlchemy — never use f-string interpolation.

```python
pd.read_sql("""
    SELECT TOP 10 symbol, date, [open], high, low, [close], volume
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = ?
    ORDER BY date DESC""", sql_engine, params=("SAP.DE",))
```

```text
   symbol        date    open     high      low   close   volume
0  SAP.DE  2026-03-12  163.00   166.74   162.80  166.52   806722
1  SAP.DE  2026-03-11  167.10   168.96   163.02  165.44  2953782
2  SAP.DE  2026-03-10  171.60   172.88   166.46  169.60  3187246
3  SAP.DE  2026-03-09  173.72   173.86   168.52  171.88  1990823
4  SAP.DE  2026-03-06  173.66   175.10   170.24  172.74  3347221
5  SAP.DE  2026-03-05  167.50   172.80   166.48  170.98  2961032
6  SAP.DE  2026-03-04  169.22   169.22   165.94  167.38  2443582
7  SAP.DE  2026-03-03  165.60   166.16   161.28  165.48  3971985
8  SAP.DE  2026-03-02  166.62   169.10   164.86  167.10  2776438
9  SAP.DE  2026-02-27  172.00   173.34   168.28  170.96  2673448
```

#### SQL Server — aggregate with GROUP BY

`SUM(CAST(volume AS BIGINT))` is required here because SQL Server's `volume` column is stored as `INT` and summing 1300+ trading days across 50 stocks would overflow a 32-bit integer. `ROUND(AVG(CAST([close] AS FLOAT)), 2)` avoids integer division truncation.

```python
pd.read_sql("""
    SELECT TOP 10 symbol,
           COUNT(*) AS trading_days,
           ROUND(AVG(CAST([close] AS FLOAT)), 2) AS avg_close,
           SUM(CAST(volume AS BIGINT)) AS total_volume
    FROM silver.eurostoxx50_ohlcv
    GROUP BY symbol
    ORDER BY total_volume DESC""", sql_engine)
```

```text
       symbol  trading_days  avg_close   total_volume
0      ISP.MI          1321       3.15  115704541969
1      SAN.MC          1329       4.43   55513641918
2     ENEL.MI          1321       6.82   32600561934
3     BBVA.MC          1329       8.65   22133773194
4      UCG.MI          1321      28.46   18366801099
5      ENI.MI          1321      13.40   17141570967
6     INGA.AS          1331      14.04   17041577555
7      IBE.MC          1329      12.26   15994295949
8      DTE.DE          1324      22.43   10029411390
9  NDA-FI.HE          1306      10.85    7020342991
```

#### SQL Server — INSERT, UPDATE, DELETE

pyodbc passes positional parameters directly after the SQL string (not as a tuple), unlike sqlite3. `cur.rowcount` returns the number of rows affected. Every DML batch must end with `conn.commit()` — changes are not visible to other connections until committed.

```python
cur.execute("""
    IF OBJECT_ID('dbo.trades_demo', 'U') IS NOT NULL DROP TABLE dbo.trades_demo;
    CREATE TABLE dbo.trades_demo (
        trade_id NVARCHAR(20) PRIMARY KEY, ticker NVARCHAR(10),
        side NVARCHAR(4), quantity INT, price DECIMAL(10,2))""")
cur.execute("INSERT INTO dbo.trades_demo VALUES (?,?,?,?,?)",
    "TRD_001", "ASML.AS", "BUY", 100, 685.40)
cur.rowcount  # INSERT rows affected

# UPDATE
cur.execute("UPDATE dbo.trades_demo SET price = ? WHERE trade_id = ?", 700.00, "TRD_001")
cur.rowcount  # UPDATE rows affected

# DELETE
cur.execute("DELETE FROM dbo.trades_demo WHERE trade_id = ?", "TRD_001")
cur.rowcount  # DELETE rows affected

cur.execute("DROP TABLE dbo.trades_demo")
sql_conn.commit()
```

```text
1 row
1 row
1 row
```

> [!danger] Silent rollback when commit() is missing
>
> `pyodbc` operates with `autocommit=False` by default. Any INSERT, UPDATE, or DELETE that is not followed by `conn.commit()` will be silently rolled back when the connection closes — no error is raised, data simply disappears. This is the most common source of "my writes don't persist" bugs with pyodbc.

> [!success] Always commit after DML, or use autocommit for DDL
>
> ```python
> # Preferred: explicit commit after DML
> cur.execute("INSERT INTO dbo.trades VALUES (?,?,?,?,?)", row)
> conn.commit()
>
> # For DDL (CREATE TABLE, DROP TABLE) that cannot run in a transaction:
> conn = pyodbc.connect(conn_str, autocommit=True)
> cur.execute("CREATE TABLE ...")
> ```

### Indexes and Query Performance

#### SQL Server — list indexes on a table

`sys.indexes` joined with `sys.index_columns` and `sys.columns` reveals all indexes on a table including their key columns. `STRING_AGG()` concatenates key column names in ordinal order. Use this to verify coverage before writing expensive queries.

```python
pd.read_sql("""
    SELECT i.name AS index_name, i.type_desc, i.is_unique,
           STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns
    FROM sys.indexes i
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID('silver.eurostoxx50_ohlcv')
    GROUP BY i.name, i.type_desc, i.is_unique
    ORDER BY i.name""", sql_engine)
```

```text
                               index_name     type_desc  is_unique       columns
0  IX_silver_eurostoxx50_ohlcv_symbol_date  NONCLUSTERED       True  symbol, date
1          PK__eurostox__3213E83FDF67D274     CLUSTERED       True            id
```

#### SQL Server — index fragmentation

`sys.dm_db_index_physical_stats` returns fragmentation percentages for each index. The `'LIMITED'` scan mode is fast and suitable for production — it samples page headers rather than reading all pages. The rule of thumb: `< 10%` = OK, `10–30%` = REORGANIZE, `> 30%` = REBUILD.

```python
pd.read_sql("""
    SELECT TOP 10 OBJECT_NAME(ips.object_id) AS [table],
           i.name AS [index], ips.index_type_desc AS type,
           ROUND(ips.avg_fragmentation_in_percent, 1) AS frag_pct,
           ips.page_count AS pages,
           CASE WHEN ips.avg_fragmentation_in_percent < 10 THEN 'OK'
                WHEN ips.avg_fragmentation_in_percent < 30 THEN 'REORGANIZE'
                ELSE 'REBUILD' END AS action
    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
    JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
    WHERE ips.page_count > 10
    ORDER BY ips.avg_fragmentation_in_percent DESC""", sql_engine)
```

```text
               table                                      index                type  frag_pct  pages      action
0          index_dim             PK__index_di__3213E83FDB4E5BA9    CLUSTERED INDEX      13.6     88  REORGANIZE
1  index_performance                  UX_gold_index_performance  NONCLUSTERED INDEX       5.3     19          OK
2  index_performance             PK__index_pe__3213E83FBBB2393E    CLUSTERED INDEX       4.9     81          OK
3   stoxxusa50_ohlcv             PK__stoxxusa__3213E83FC84E3F24    CLUSTERED INDEX       1.4    724          OK
4          index_dim             PK__index_di__3213E83F590AA69E    CLUSTERED INDEX       1.2     85          OK
5   stoxxusa50_ohlcv    IX_silver_stoxxusa50_ohlcv_symbol_date  NONCLUSTERED INDEX       0.6    163          OK
6  stoxxasia50_ohlcv  IX_silver_stoxxasia50_ohlcv_symbol_date  NONCLUSTERED INDEX       0.5    183          OK
7  stoxxasia50_ohlcv             PK__stoxxasi__3213E83F66A8DE5E    CLUSTERED INDEX       0.4    729          OK
8  eurostoxx50_ohlcv             PK__eurostox__3213E83FDF67D274    CLUSTERED INDEX       0.4    757          OK
9        oil20_ohlcv             PK__oil20_oh__3213E83F544EB286    CLUSTERED INDEX       0.4    275          OK
```

#### SQL Server — database and table sizes

`sys.database_files` returns total database file size. `sys.allocation_units` tracks actual page usage per table partition. Together they give a two-level view: total DB size and per-table footprint — useful for capacity planning and identifying bloated tables.

```python
display(pd.read_sql("SELECT DB_NAME() AS db, CAST(SUM(size)*8.0/1024 AS DECIMAL(10,2)) AS size_mb FROM sys.database_files", sql_engine))

pd.read_sql("""
    SELECT TOP 10 s.name + '.' + t.name AS [table],
           FORMAT(SUM(p.rows), 'N0') AS rows,
           CAST(SUM(a.total_pages)*8.0/1024 AS DECIMAL(10,2)) AS size_mb
    FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    JOIN sys.indexes i ON t.object_id = i.object_id
    JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
    JOIN sys.allocation_units a ON p.partition_id = a.container_id
    GROUP BY s.name, t.name ORDER BY SUM(a.total_pages) DESC""", sql_engine)
```

```text
      db  size_mb
0  stoxx    272.0
```

```text
                      table     rows  size_mb
0   silver.eurostoxx50_ohlcv  132,710     7.52
1   silver.stoxxasia50_ohlcv  128,090     7.27
2    silver.stoxxusa50_ohlcv  130,200     7.08
3       silver.oil20_ohlcv   49,476     2.77
4    bronze.trading_calendar   58,670     1.58
5          bronze.index_dim      676     1.02
6     gold.index_performance   10,562     1.02
7          silver.index_dim      676     0.77
8  bronze.eurostoxx50_ohlcv      100     0.33
9        gold.scores_daily      932     0.33
```

### Server Configuration and Administration

#### SQL Server — server info and configuration

`@@VERSION` returns the full SQL Server build string — `SUBSTRING` extracts just the version name. `sys.configurations` shows instance-level settings like `max server memory (MB)`, `max degree of parallelism` (MAXDOP), and `cost threshold for parallelism` — critical parameters for tuning query plan behavior.

```python
display(pd.read_sql("""
    SELECT SUBSTRING(@@VERSION, 1, CHARINDEX(' (', @@VERSION)-1) AS version,
           CAST(SERVERPROPERTY('Edition') AS NVARCHAR(100)) AS edition,
           CAST(SERVERPROPERTY('Collation') AS NVARCHAR(100)) AS collation""", sql_engine))

pd.read_sql("""
    SELECT name AS setting, CAST(value_in_use AS NVARCHAR(30)) AS value
    FROM sys.configurations
    WHERE name IN ('max server memory (MB)', 'max degree of parallelism', 'cost threshold for parallelism')
    ORDER BY name""", sql_engine)
```

```text
                    version                      edition                      collation
0  Microsoft SQL Server 2022  Developer Edition (64-bit)  SQL_Latin1_General_CP1_CI_AS
```

```text
                          setting       value
0  cost threshold for parallelism           5
1       max degree of parallelism           0
2          max server memory (MB)  2147483647
```

## pandas Integration — pd.read_sql and to_sql

#### pandas — read_sql into DataFrame with SQLAlchemy engine

`pd.read_sql(sql, engine)` executes SQL and returns a DataFrame in one line. SQLAlchemy engine handles connection pooling and dialect translation, and works with any database SQLAlchemy supports. For streaming large results row by row, use `cursor.fetchmany()` instead.

> [!warning] Anti-patterns
>
> - **`pd.read_sql` with raw `pyodbc`** — works but triggers Pylance/UserWarning
> - **Reading entire large table** — add `WHERE`/`LIMIT` clauses

> [!success] Use a SQLAlchemy engine and add filters
>
> ```python
> # Pass a SQLAlchemy engine, not a raw pyodbc connection
> engine = create_engine(f"mssql+pyodbc:///?odbc_connect={odbc_params}")
> df = pd.read_sql("SELECT * FROM trades WHERE trade_date >= '2024-01-01'", engine)
> ```

```python
odbc_params = urllib.parse.quote_plus(
    'Driver={ODBC Driver 18 for SQL Server};'
    'Server=localhost,1434;Database=stoxx;'
    'UID=sa;PWD=EsgDev2026Pass1;'
    'Encrypt=yes;TrustServerCertificate=yes;'
)
engine = create_engine(f"mssql+pyodbc:///?odbc_connect={odbc_params}")

pd.read_sql("SELECT TOP 5 symbol, date, [close], volume FROM silver.eurostoxx50_ohlcv ORDER BY date DESC", engine)
```

```text
    symbol        date    close   volume
0  ASML.AS  2026-03-12  1190.80   128223
1    MC.PA  2026-03-12   494.35   171997
2   RMS.PA  2026-03-12  1906.00    18681
3    OR.PA  2026-03-12   360.80    82621
4   SAP.DE  2026-03-12   166.52   806722
```

#### pandas — to_sql to write DataFrame to database

`df.to_sql(table, engine, if_exists=)` writes a DataFrame to a database table. `if_exists='replace'` drops and recreates the table; `'append'` adds rows without altering the schema. Pass `index=False` unless you want the DataFrame index as a column.

```python

sample = pd.DataFrame({
    "ticker": ["TEST1", "TEST2", "TEST3"],
    "price": [100.0, 200.0, 300.0],
    "volume": [1000, 2000, 3000],
})

sample.to_sql("pandas_demo", engine, schema="dbo", if_exists="replace", index=False)
# Written to dbo.pandas_demo

# Read back
display(pd.read_sql("SELECT * FROM dbo.pandas_demo", engine))

# Cleanup
with engine.connect() as c:
    c.execute(text("DROP TABLE dbo.pandas_demo"))
    c.commit()
```

```text
Written to dbo.pandas_demo
```

```text
  ticker  price  volume
0  TEST1  100.0    1000
1  TEST2  200.0    2000
2  TEST3  300.0    3000
```

## SQLAlchemy — ORM

#### SQLAlchemy — define ORM model classes

Python's equivalent of EF Core. Define model classes inheriting from `DeclarativeBase` with `Mapped[type]` for typed columns. `Session` manages transactions — `session.add()` + `session.commit()` generates INSERT SQL automatically. Use Alembic for migrations (like `dotnet ef`). For complex analytics SQL, use raw SQL or DuckDB instead.

> [!warning] Anti-patterns
>
> - **N+1 queries** — use `joinedload()` or `selectinload()`
> - **Session per query** — reuse sessions within a request

> [!success] Eager-load relationships and reuse sessions
>
> ```python
> # Eager load to avoid N+1
> stmt = select(Portfolio).options(joinedload(Portfolio.positions))
> portfolios = session.scalars(stmt).unique().all()
> # Reuse session within a unit of work
> with Session(engine) as session:
>     session.add(obj1)
>     session.add(obj2)
>     session.commit()
> ```

```python
class Base(DeclarativeBase):
    pass

class StockPrice(Base):
    __tablename__ = "stock_prices"
    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column()
    trade_date: Mapped[Date] = mapped_column()
    close: Mapped[float] = mapped_column()
    volume: Mapped[int] = mapped_column()

# Create in-memory SQLite for demo
orm_engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(orm_engine)
```

```text
ORM tables created
```

#### SQLAlchemy — INSERT with session.add() and commit()

`session.add()` marks an ORM object as pending. `session.commit()` flushes all pending changes and generates the appropriate INSERT SQL. `session.add_all()` is the equivalent of `executemany()` — use it for bulk inserts rather than calling `add()` in a loop.

```python
with Session(orm_engine) as session:
    session.add_all([
        StockPrice(symbol="ASML.AS", trade_date=Date(2025, 3, 15), close=685.40, volume=2500000),
        StockPrice(symbol="SAP.DE",  trade_date=Date(2025, 3, 15), close=245.80, volume=1800000),
        StockPrice(symbol="MC.PA",   trade_date=Date(2025, 3, 15), close=890.20, volume=900000),
    ])
    session.commit()
    print(f"Inserted {session.query(StockPrice).count()} rows")
```

```text
Inserted 3 rows
```

#### SQLAlchemy — SELECT with session.query() and filter()

`session.query(Model).filter(condition).all()` generates a SELECT with a WHERE clause. `.first()` fetches one row with `LIMIT 1`. The ORM translates Python attribute access (`StockPrice.symbol`) to column names automatically.

```python
with Session(orm_engine) as session:
    results = session.query(StockPrice).filter(
        StockPrice.symbol == "ASML.AS"
    ).order_by(StockPrice.trade_date.desc()).all()

    for r in results:
        print(f"  {r.symbol} | {r.trade_date} | {r.close} | {r.volume}")
```

```text
ASML.AS | 2025-03-15 | 685.4 | 2500000
```

#### SQLAlchemy — UPDATE and DELETE

Mutate an object fetched within a session, then call `session.commit()` to generate the UPDATE. For DELETE, call `session.delete(obj)` then commit. SQLAlchemy tracks object state — you do not write UPDATE/DELETE SQL manually.

```python
with Session(orm_engine) as session:
    stock = session.query(StockPrice).filter(StockPrice.symbol == "SAP.DE").first()
    stock.close = 999.99
    session.commit()
    print(f"Updated SAP.DE close to {stock.close}")

# DELETE
with Session(orm_engine) as session:
    stock = session.query(StockPrice).filter(StockPrice.symbol == "MC.PA").first()
    session.delete(stock)
    session.commit()
    print(f"Deleted MC.PA, remaining: {session.query(StockPrice).count()}")
```

```text
Updated SAP.DE close to 999.99
Deleted MC.PA, remaining: 2
```

#### SQLAlchemy — raw SQL with text()

`text()` wraps a raw SQL string for safe execution through SQLAlchemy. Named parameters use `:name` syntax (not `?`), passed as a dict. This is the escape hatch for complex queries (window functions, CTEs) where the ORM is too verbose.

```python
with engine.connect() as c:
    result = c.execute(text("""
        SELECT TOP 5 symbol, date, [close], volume
        FROM silver.eurostoxx50_ohlcv
        WHERE symbol = :symbol
        ORDER BY date DESC"""), {"symbol": "ASML.AS"})
    df = pd.DataFrame(result.fetchall(), columns=result.keys())
df
```

```text
    symbol        date   close   volume
0  ASML.AS  2026-03-12  1190.8   128223
1  ASML.AS  2026-03-11  1198.8   562904
2  ASML.AS  2026-03-10  1200.0   800815
3  ASML.AS  2026-03-09  1147.6   689086
4  ASML.AS  2026-03-06  1147.0   857271
```

## DuckDB — Embedded Analytical SQL Database

#### DuckDB — connect and CREATE TABLE

Embedded columnar database — no server, in-process, 10-100x faster than row-stores for analytics. Full SQL:2003 with window functions, CTEs, `QUALIFY`, `PIVOT`. Queries files directly (`SELECT * FROM 'data.parquet'`) and returns pandas DataFrames natively with `.df()`. Not suited for OLTP or concurrent writers — use SQL Server for those.

```python
duck = duckdb.connect(":memory:")
duck.execute("""
    CREATE OR REPLACE TABLE ohlcv (
        symbol VARCHAR, date DATE, open DOUBLE,
        high DOUBLE, low DOUBLE, close DOUBLE, volume BIGINT
    )""")
```

```text
DuckDB connected + table created
```

#### DuckDB — load data from SQL Server

`executemany()` bulk-inserts rows fetched from pyodbc into DuckDB. Explicit casting (`float()`, `int()`) is necessary because pyodbc returns `Decimal` and `datetime` objects that DuckDB's schema expects as native Python floats and ints.

> [!warning] fetchall() on large tables loads
>
> `fetchall()` on large tables loads everything into Python memory
> The 66K rows below are fine, but `fetchall()` on a million-row table can OOM your process. For large transfers, use `fetchmany(batch_size)` in a loop, or let DuckDB read files directly (`SELECT * FROM 'data.parquet'`).

> [!success] Stream with fetchmany or query files directly in DuckDB
>
> ```python
> # Stream in batches from pyodbc into DuckDB
> mssql_cur.execute("SELECT * FROM large_table")
> while batch := mssql_cur.fetchmany(10_000):
>     ddb.executemany("INSERT INTO target VALUES (?, ?)", batch)
> # Or let DuckDB read the file directly — no Python memory overhead
> ddb.execute("CREATE TABLE target AS SELECT * FROM 'export.parquet'")
> ```

```python
# Load from SQL Server via pyodbc into DuckDB

cur = sql_conn.cursor()
cur.execute("SELECT symbol, date, [open], high, low, [close], volume FROM silver.eurostoxx50_ohlcv")
rows = cur.fetchall()

duck.executemany("INSERT INTO ohlcv VALUES (?,?,?,?,?,?,?)",
    [(r[0], r[1], float(r[2]), float(r[3]), float(r[4]), float(r[5]), int(r[6])) for r in rows])

duck.execute('SELECT COUNT(*) FROM ohlcv').fetchone()[0]  # rows loaded
```

```text
Loaded 66355 rows
```

#### DuckDB — Appender for fastest bulk load

`duckdb.Appender` is the highest-throughput path for inserting rows into DuckDB — faster than `executemany()` because it bypasses SQL parsing and parameter binding overhead. Use it when loading millions of rows from Python (e.g., from a pyodbc cursor or a Parquet-to-DuckDB ETL). Call `.flush()` periodically to avoid accumulating too many rows in memory, and `.close()` to commit the final batch.

```python
import duckdb

duck2 = duckdb.connect()
duck2.execute("""
    CREATE OR REPLACE TABLE ohlcv (
        symbol VARCHAR, date DATE, open DOUBLE,
        high DOUBLE, low DOUBLE, close DOUBLE, volume BIGINT
    )""")

# Appender — fastest bulk insert path (bypasses SQL parsing)
with duck2.cursor() as cur:
    cur.execute("SELECT symbol, date, open, high, low, close, volume FROM silver.eurostoxx50_ohlcv", [], sql_conn)
    rows = cur.fetchall()

with duck2.appender("ohlcv") as app:
    for r in rows:
        app.append_row(r[0], r[1], float(r[2]), float(r[3]), float(r[4]), float(r[5]), int(r[6]))

duck2.execute("SELECT COUNT(*) FROM ohlcv").fetchone()[0]
```

```text
66355
```

> [!tip] Use Appender with fetchmany() for streaming bulk loads
>
> For very large tables, combine `fetchmany(10_000)` with the Appender to avoid loading all rows into Python memory before inserting. Call `.flush()` every N batches if memory pressure is a concern:
> ```python
> with duck2.appender("ohlcv") as app:
>     while batch := cur.fetchmany(10_000):
>         for r in batch:
>             app.append_row(*r)
> ```

#### DuckDB — SELECT with .df() for pandas DataFrame

`.df()` converts the DuckDB result set to a pandas DataFrame in one step — equivalent to `.fetchdf()`. For raw Python tuples use `.fetchall()`, or `.fetchone()` for a single row. Use `LIMIT` to avoid loading large results into memory.

```python
duck.execute("SELECT symbol, date, close, volume FROM ohlcv WHERE symbol = 'SAP.DE' ORDER BY date DESC LIMIT 5").df()
```

```text
   symbol        date   close   volume
0  SAP.DE  2026-03-12  166.52   806722
1  SAP.DE  2026-03-11  165.44  2953782
2  SAP.DE  2026-03-10  169.60  3187246
3  SAP.DE  2026-03-09  171.88  1990823
4  SAP.DE  2026-03-06  172.74  3347221
```

#### DuckDB — aggregate with GROUP BY

Standard SQL GROUP BY with COUNT, AVG, and SUM. DuckDB executes this in-process using columnar vectorised execution — significantly faster than row-based databases for aggregations over millions of rows.

```python
duck.execute("""
    SELECT symbol, COUNT(*) AS days, ROUND(AVG(close), 2) AS avg_close,
           SUM(volume) AS total_volume
    FROM ohlcv GROUP BY symbol ORDER BY total_volume DESC LIMIT 10""").df()
```

```text
       symbol  days  avg_close  total_volume
0      ISP.MI  1321       3.15  1.157045e+11
1      SAN.MC  1329       4.43  5.551364e+10
2     ENEL.MI  1321       6.82  3.260056e+10
3     BBVA.MC  1329       8.65  2.213377e+10
4      UCG.MI  1321      28.46  1.836680e+10
5      ENI.MI  1321      13.40  1.714157e+10
6     INGA.AS  1331      14.04  1.704158e+10
7      IBE.MC  1329      12.26  1.599430e+10
8      DTE.DE  1324      22.43  1.002941e+10
9  NDA-FI.HE  1306      10.85  7.020343e+09
```

#### DuckDB — window function: LAG for daily returns

`LAG(col) OVER (PARTITION BY symbol ORDER BY date)` accesses the previous row's value within each symbol group. DuckDB supports all standard window functions including `LAG`, `LEAD`, `ROW_NUMBER`, `RANK`, and `NTILE`. SQLite does not support window functions.

```python
duck.execute("""
    SELECT symbol, date, close,
           LAG(close) OVER (PARTITION BY symbol ORDER BY date) AS prev_close,
           ROUND((close - LAG(close) OVER (PARTITION BY symbol ORDER BY date))
               / LAG(close) OVER (PARTITION BY symbol ORDER BY date) * 100, 2) AS daily_return_pct
    FROM ohlcv WHERE symbol = 'ASML.AS' ORDER BY date DESC LIMIT 10""").df()
```

```text
    symbol        date   close  prev_close  daily_return_pct
0  ASML.AS  2026-03-12  1190.8      1198.8             -0.67
1  ASML.AS  2026-03-11  1198.8      1200.0             -0.10
2  ASML.AS  2026-03-10  1200.0      1147.6              4.57
3  ASML.AS  2026-03-09  1147.6      1147.0              0.05
4  ASML.AS  2026-03-06  1147.0      1186.0             -3.29
5  ASML.AS  2026-03-05  1186.0      1199.8             -1.15
6  ASML.AS  2026-03-04  1199.8      1161.8              3.27
7  ASML.AS  2026-03-03  1161.8      1210.4             -4.02
8  ASML.AS  2026-03-02  1210.4      1233.4             -1.86
9  ASML.AS  2026-02-27  1233.4      1232.4              0.08
```

#### DuckDB — CTE for annualized volatility

A CTE (`WITH ... AS (...)`) names an intermediate result for reuse in the outer query. Here, `daily_returns` computes per-day returns, and the outer query aggregates over a trailing window. Annualized volatility = `STDDEV(daily_return) * SQRT(252)` — the standard market convention.

```python
duck.execute("""
    WITH daily_returns AS (
        SELECT symbol, date, close,
               (close - LAG(close) OVER (PARTITION BY symbol ORDER BY date))
                   / LAG(close) OVER (PARTITION BY symbol ORDER BY date) AS daily_return
        FROM ohlcv
    )
    SELECT symbol, COUNT(*) AS days,
           ROUND(STDDEV(daily_return) * SQRT(252) * 100, 2) AS annualized_vol_pct
    FROM daily_returns WHERE daily_return IS NOT NULL
    GROUP BY symbol ORDER BY annualized_vol_pct DESC""").df().head()
```

```text
     symbol  days  annualized_vol_pct
0  ADYEN.AS  1330               50.30
1    ENR.DE  1323               50.05
2    RHM.DE  1323               40.85
3    PRX.AS  1330               39.72
4   ARGX.BR  1330               39.31
```

#### DuckDB — SUMMARIZE for data profiling

`SUMMARIZE table` returns per-column statistics including min, max, approximate distinct count, mean, std, quartiles, total count, and null percentage — equivalent to pandas `df.describe()` but faster and with null tracking. Useful as the first step in data quality checks.

```python
duck.execute("SUMMARIZE ohlcv").df()
```

```text
  column_name column_type          min          max  approx_unique                         avg              std             q25             q50             q75  count  null_pct
0       symbol     VARCHAR      ABI.BR      WKL.AS             51                           None             None            None            None            None  66355       0.0
1         date        DATE  2021-01-04  2026-03-12           1516  2023-08-05 00:56:42.354005             None      2022-04-18      2023-08-03      2024-11-18  66355       0.0
2         open      DOUBLE       1.601      2926.0          25981                       197.04           363.15           29.93           70.86          186.66  66355       0.0
3         high      DOUBLE      1.6628      2957.0          30967                       199.36           367.87           30.07           72.03          188.90  66355       0.0
4          low      DOUBLE      1.5842      2813.0          34449                       194.59           358.01           29.54           70.57          184.59  66355       0.0
5        close      DOUBLE      1.6066      2839.0          31796                       197.03           363.05           30.00           71.37          186.45  66355       0.0
6       volume      BIGINT           0   376391539          75668                  5942123.69      16156185.53          510041         1415355         4094451  66355       0.0
```

#### DuckDB — COPY TO export to Parquet

`COPY (query) TO 'file.parquet' (FORMAT PARQUET)` exports a query result directly to a file without materialising a DataFrame. This is the most efficient export path — no Python memory allocation required.

```python
duck.execute(f"""
    COPY (SELECT symbol, COUNT(*) AS days, ROUND(AVG(close), 2) AS avg_close
          FROM ohlcv GROUP BY symbol ORDER BY avg_close DESC)
    TO '{DATA}/duckdb_py_export.parquet' (FORMAT PARQUET)""")
# Exported to duckdb_py_export.parquet
```

```text
Exported to duckdb_py_export.parquet
```

#### DuckDB vs SQL Server — benchmark same queries

Compares wall-clock time for GROUP BY and LAG window function queries on the same 66K-row dataset — once via DuckDB (in-process columnar) and once via SQL Server (network round-trip + row-based executor). The columnar execution and lack of network overhead make DuckDB 5–10x faster for analytics.

```python
results = []
for label, fn in [
    ("DuckDB GROUP BY",   lambda: duck.execute("SELECT symbol, AVG(close) FROM ohlcv GROUP BY symbol").fetchall()),
    ("SQL Server GROUP BY", lambda: pd.read_sql("SELECT symbol, AVG(CAST([close] AS FLOAT)) FROM silver.eurostoxx50_ohlcv GROUP BY symbol", sql_engine)),
    ("DuckDB LAG()",      lambda: duck.execute("SELECT symbol, date, close, LAG(close) OVER (PARTITION BY symbol ORDER BY date) FROM ohlcv").fetchall()),
    ("SQL Server LAG()",  lambda: pd.read_sql("SELECT symbol, date, [close], LAG([close]) OVER (PARTITION BY symbol ORDER BY date) FROM silver.eurostoxx50_ohlcv", sql_engine)),
]:
    start = time.perf_counter()
    fn()
    elapsed = (time.perf_counter() - start) * 1000
    results.append({"Engine": label.split()[0], "Query": " ".join(label.split()[1:]), "Time (ms)": round(elapsed, 1)})

pd.DataFrame(results)
```

```text
   Engine             Query  Time (ms)
0  DuckDB          GROUP BY        3.2
1     SQL    Server GROUP BY       17.2
2  DuckDB            LAG()       23.9
3     SQL      Server LAG()      181.3
```

## Querying Files — DuckDB vs Polars vs Pandas

### Read Parquet

#### DuckDB — read Parquet file with SELECT

DuckDB reads Parquet directly from disk with a SQL SELECT — no intermediate load step. The file path is embedded in the FROM clause as a string literal. Columnar pushdown means only the requested columns are read from disk.

```python
duck.execute("SELECT symbol, date, close, volume FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet' LIMIT 5").df()
```

```text
   symbol        date  close   volume
0  ABI.BR  2021-01-04  57.21  1513937
1  ABI.BR  2021-01-05  57.18  1382722
2  ABI.BR  2021-01-06  58.77  1370204
3  ABI.BR  2021-01-07  58.40  1469911
4  ABI.BR  2021-01-08  57.86  1428681
```

#### Polars — read Parquet file with pl.read_parquet()

`pl.read_parquet()` loads a Parquet file into a Polars DataFrame. `.select()` pushes column projection to the file reader — only specified columns are deserialised. Polars reads Parquet with Arrow-native columnar decoding, which is faster than pandas' default path.

```python
pl.read_parquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet").select("symbol", "date", "close", "volume").head(5)
```

```text
   symbol                 date      close   volume
0  ABI.BR  2021-01-04 00:00:00  57.210000  1513937
1  ABI.BR  2021-01-05 00:00:00  57.180000  1382722
2  ABI.BR  2021-01-06 00:00:00  58.770000  1370204
3  ABI.BR  2021-01-07 00:00:00  58.400000  1469911
4  ABI.BR  2021-01-08 00:00:00  57.860000  1428681
```

#### Pandas — read Parquet file with pd.read_parquet()

`pd.read_parquet()` uses PyArrow (default) to load a Parquet file. The `columns=` parameter pushes column projection to the reader — unselected columns are not read from disk. Dates are returned as `datetime64[ns]` (vs Polars' `Date` type or DuckDB's `DATE`).

```python
pd.read_parquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet", columns=["symbol", "date", "close", "volume"]).head(5)
```

```text
   symbol        date  close   volume
0  ABI.BR  2021-01-04  57.21  1513937
1  ABI.BR  2021-01-05  57.18  1382722
2  ABI.BR  2021-01-06  58.77  1370204
3  ABI.BR  2021-01-07  58.40  1469911
4  ABI.BR  2021-01-08  57.86  1428681
```

### Read CSV

#### DuckDB — read CSV file with SELECT

DuckDB auto-detects CSV schema (delimiter, types, header) and reads the file directly in SQL. No pandas intermediary is needed. CSV is significantly slower than Parquet for large files — see the benchmark in `### Performance — format comparison`.

```python
duck.execute("SELECT symbol, date, close, volume FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.csv' LIMIT 5").df()
```

```text
   symbol        date  close   volume
0  ABI.BR  2021-01-04  57.21  1513937
1  ABI.BR  2021-01-05  57.18  1382722
2  ABI.BR  2021-01-06  58.77  1370204
3  ABI.BR  2021-01-07  58.40  1469911
4  ABI.BR  2021-01-08  57.86  1428681
```

#### Polars — read CSV file with pl.read_csv()

`pl.read_csv()` infers schema automatically. Column selection via `.select()` happens after loading (CSV doesn't support columnar pushdown). For large CSVs, `pl.scan_csv()` with lazy evaluation avoids loading all columns into memory.

```python
pl.read_csv("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.csv").select("symbol", "date", "close", "volume").head(5)
```

```text
   symbol        date      close   volume
0  ABI.BR  2021-01-04  57.210000  1513937
1  ABI.BR  2021-01-05  57.180000  1382722
2  ABI.BR  2021-01-06  58.770000  1370204
3  ABI.BR  2021-01-07  58.400000  1469911
4  ABI.BR  2021-01-08  57.860000  1428681
```

#### Pandas — read CSV file with pd.read_csv()

`pd.read_csv()` with `usecols=` loads only the specified columns into memory. Unlike Parquet, CSV is read row-by-row, so `usecols` saves memory but not I/O time. Parse date columns explicitly with `parse_dates=["date"]` if you need `datetime64` types.

```python
pd.read_csv("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.csv", usecols=["symbol", "date", "close", "volume"]).head(5)
```

```text
   symbol        date  close   volume
0  ABI.BR  2021-01-04  57.21  1513937
1  ABI.BR  2021-01-05  57.18  1382722
2  ABI.BR  2021-01-06  58.77  1370204
3  ABI.BR  2021-01-07  58.40  1469911
4  ABI.BR  2021-01-08  57.86  1428681
```

### Filter rows

#### DuckDB — filter with WHERE

DuckDB pushes the `WHERE` predicate into the Parquet reader — rows that don't match the filter are never loaded into memory. This makes DuckDB significantly more efficient than loading the full file into pandas and filtering afterwards.

```python
duck.execute("SELECT symbol, date, close, volume FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet' WHERE symbol = 'SAP.DE' ORDER BY date DESC LIMIT 5").df()
```

```text
   symbol        date   close   volume
0  SAP.DE  2026-03-12  166.52   806722
1  SAP.DE  2026-03-11  165.44  2953782
2  SAP.DE  2026-03-10  169.60  3187246
3  SAP.DE  2026-03-09  171.88  1990823
4  SAP.DE  2026-03-06  172.74  3347221
```

#### Polars — filter with filter() and select()

`.filter(pl.col("symbol") == "SAP.DE")` applies a row predicate. Polars pushes this filter into the Parquet reader via `scan_parquet()` in lazy mode — `read_parquet()` loads first then filters. For large files, use `pl.scan_parquet().filter(...).collect()` instead.

```python
pl.read_parquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet").filter(pl.col("symbol") == "SAP.DE").select("symbol", "date", "close", "volume").sort("date", descending=True).head(5)
```

```text
   symbol                 date       close   volume
0  SAP.DE  2026-03-12 00:00:00  166.520000   806722
1  SAP.DE  2026-03-11 00:00:00  165.440000  2953782
2  SAP.DE  2026-03-10 00:00:00  169.600000  3187246
3  SAP.DE  2026-03-09 00:00:00  171.880000  1990823
4  SAP.DE  2026-03-06 00:00:00  172.740000  3347221
```

#### Pandas — filter with boolean indexing

Boolean indexing `df[df["col"] == value]` creates a boolean Series and selects matching rows. The full file is loaded into memory first (no pushdown). The result retains original integer row indexes (not reset to 0).

```python
df = pd.read_parquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet", columns=["symbol", "date", "close", "volume"])
df[df["symbol"] == "SAP.DE"].sort_values("date", ascending=False).head(5)
```

```text
         symbol        date   close   volume
57061  SAP.DE  2026-03-12  166.52   806722
57060  SAP.DE  2026-03-11  165.44  2953782
57059  SAP.DE  2026-03-10  169.60  3187246
57058  SAP.DE  2026-03-09  171.88  1990823
57057  SAP.DE  2026-03-06  172.74  3347221
```

### Group and aggregate

#### DuckDB — aggregate with GROUP BY

GROUP BY with aggregate functions run directly on the Parquet file — DuckDB reads only the required columns and applies the aggregation without loading the full dataset into Python memory.

```python
duck.execute("""
    SELECT symbol, COUNT(*) AS days, ROUND(AVG(close), 2) AS avg_close, SUM(volume) AS total_volume
    FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet'
    GROUP BY symbol ORDER BY total_volume DESC LIMIT 10""").df()
```

```text
       symbol  days  avg_close  total_volume
0      ISP.MI  1321       3.15  1.157045e+11
1      SAN.MC  1329       4.43  5.551364e+10
2     ENEL.MI  1321       6.82  3.260056e+10
3     BBVA.MC  1329       8.65  2.213377e+10
4      UCG.MI  1321      28.46  1.836680e+10
5      ENI.MI  1321      13.40  1.714157e+10
6     INGA.AS  1331      14.04  1.704158e+10
7      IBE.MC  1329      12.26  1.599430e+10
8      DTE.DE  1324      22.43  1.002941e+10
9  NDA-FI.HE  1306      10.85  7.020343e+09
```

#### Polars — aggregate with group_by() and agg()

`.group_by("symbol").agg(...)` groups by one or more columns and computes aggregations. Polars `agg()` takes named expressions — `pl.col("close").count().alias("days")` — rather than strings. Results are unordered by default; chain `.sort()` for a consistent output.

```python
pl.read_parquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet").group_by("symbol").agg(
    pl.col("close").count().alias("days"),
    pl.col("close").mean().alias("avg_close"),
    pl.col("volume").sum().alias("total_volume"),
).sort("total_volume", descending=True).head(10)
```

```text
       symbol  days  avg_close  total_volume
0      ISP.MI  1321   3.147987  115704541969
1      SAN.MC  1329   4.425848   55513641918
2     ENEL.MI  1321   6.820438   32600561934
3     BBVA.MC  1329   8.651954   22133773194
4      UCG.MI  1321  28.457104   18366801099
5      ENI.MI  1321  13.397625   17141570967
6     INGA.AS  1331  14.038188   17041577555
7      IBE.MC  1329  12.255312   15994295949
8      DTE.DE  1324  22.430097   10029411390
9  NDA-FI.HE  1306  10.848079    7020342991
```

#### Pandas — aggregate with groupby() and agg()

`df.groupby("symbol").agg(named_agg=...)` uses pandas' named aggregation syntax. The `groupby` key becomes the row index (shown as `symbol` in the output). Use `.reset_index()` to convert it back to a regular column.

```python
df = pd.read_parquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet")
df.groupby("symbol").agg(
    days=("close", "count"),
    avg_close=("close", "mean"),
    total_volume=("volume", "sum"),
).sort_values("total_volume", ascending=False).head(10)
```

```text
            days  avg_close  total_volume
symbol
ISP.MI      1321   3.147987  115704541969
SAN.MC      1329   4.425848   55513641918
ENEL.MI     1321   6.820438   32600561934
BBVA.MC     1329   8.651954   22133773194
UCG.MI      1321  28.457104   18366801099
ENI.MI      1321  13.397625   17141570967
INGA.AS     1331  14.038188   17041577555
IBE.MC      1329  12.255312   15994295949
DTE.DE      1324  22.430097   10029411390
NDA-FI.HE   1306  10.848079    7020342991
```

### Select specific columns from file

#### DuckDB — select columns with SELECT

Standard SQL column projection — only listed columns are read from the Parquet file. DuckDB's Parquet reader skips unselected column chunks entirely, reducing I/O proportionally to how many columns are omitted.

```python
duck.execute("SELECT symbol, close FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet' LIMIT 5").df()
```

```text
   symbol  close
0  ABI.BR  57.21
1  ABI.BR  57.18
2  ABI.BR  58.77
3  ABI.BR  58.40
4  ABI.BR  57.86
```

#### Polars — select columns with select()

`.select("col1", "col2")` returns a DataFrame with only the listed columns. When used in a lazy pipeline (`scan_parquet().select()`), Polars pushes column projection into the file reader; with `read_parquet()` (eager), all columns are loaded first.

```python
pl.read_parquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet").select("symbol", "close").head(5)
```

```text
   symbol      close
0  ABI.BR  57.210000
1  ABI.BR  57.180000
2  ABI.BR  58.770000
3  ABI.BR  58.400000
4  ABI.BR  57.860000
```

#### Pandas — select columns with usecols

`pd.read_parquet(..., columns=[...])` passes the column list directly to the PyArrow Parquet reader — unselected columns are skipped at read time. This is the most memory-efficient way to load a subset of a wide Parquet file in pandas.

```python
pd.read_parquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet", columns=["symbol", "close"]).head(5)
```

```text
   symbol  close
0  ABI.BR  57.21
1  ABI.BR  57.18
2  ABI.BR  58.77
3  ABI.BR  58.40
4  ABI.BR  57.86
```

### Sort and limit directly from file

#### DuckDB — sort with ORDER BY and LIMIT

`ORDER BY col DESC LIMIT n` in DuckDB uses a tournament sort that only retains the top-N rows in memory — equivalent to a heap sort. This is far more efficient than sorting all rows and taking a slice.

```python
# DuckDB — sort by close descending, top 5

duck.execute("SELECT symbol, date, close FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet' ORDER BY close DESC LIMIT 5").df()
```

```text
     symbol        date   close
0    RMS.PA  2025-02-14  2839.0
1    RMS.PA  2025-02-13  2816.0
2    RMS.PA  2025-02-17  2809.0
3    RMS.PA  2025-02-18  2806.0
4  ADYEN.AS  2021-08-24  2766.0
```

#### Polars — sort with sort() and head()

`.sort("col", descending=True).head(n)` sorts the full DataFrame and takes the top N rows. Unlike DuckDB's tournament sort, Polars sorts all rows first — for very large datasets use `.top_k(n, by="col")` (Polars 0.19+) for efficient top-N without full sort.

```python
# Polars — sort by close descending, top 5

pl.read_parquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet").select("symbol", "date", "close").sort("close", descending=True).head(5)
```

```text
     symbol                 date         close
0    RMS.PA  2025-02-14 00:00:00  2839.000000
1    RMS.PA  2025-02-13 00:00:00  2816.000000
2    RMS.PA  2025-02-17 00:00:00  2809.000000
3    RMS.PA  2025-02-18 00:00:00  2806.000000
4  ADYEN.AS  2021-08-24 00:00:00  2766.000000
```

#### Pandas — sort with sort_values() and head()

`.sort_values("col", ascending=False).head(n)` sorts a pandas DataFrame in place (returns a view) then slices. Like Polars, this sorts all rows — use `df.nlargest(n, "col")` for a more efficient top-N path.

```python
# Pandas — sort by close descending, top 5

pd.read_parquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet", columns=["symbol", "date", "close"]).sort_values("close", ascending=False).head(5)
```

```text
        symbol        date   close
51473   RMS.PA  2025-02-14  2839.0
51472   RMS.PA  2025-02-13  2816.0
51474   RMS.PA  2025-02-17  2809.0
51475   RMS.PA  2025-02-18  2806.0
4150  ADYEN.AS  2021-08-24  2766.0
```

### Multiple filters (AND / OR) directly from file

#### DuckDB — multi-condition filter with WHERE AND

Combine conditions with `AND` / `OR` directly in the `WHERE` clause. DuckDB evaluates compound predicates in the Parquet reader — only rows matching all conditions reach the query engine.

```python
# DuckDB — WHERE with AND + OR

duck.execute("""
    SELECT symbol, date, close, volume
    FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet'
    WHERE symbol = 'ASML.AS' AND close > 700
    ORDER BY date DESC LIMIT 5""").df()
```

```text
   symbol        date   close  volume
0  ASML.AS  2026-03-12  1190.8  128223
1  ASML.AS  2026-03-11  1198.8  562904
2  ASML.AS  2026-03-10  1200.0  800815
3  ASML.AS  2026-03-09  1147.6  689086
4  ASML.AS  2026-03-06  1147.0  857271
```

#### Polars — multi-condition filter with & and |

Combine conditions with `&` (AND) and `|` (OR). Each condition must be a `pl.col()` expression — use parentheses around each condition when combining, as Python operator precedence can cause unexpected grouping.

```python
# Polars — AND filter with &

pl.read_parquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet").filter(
    (pl.col("symbol") == "ASML.AS") & (pl.col("close") > 700)
).select("symbol", "date", "close", "volume").sort("date", descending=True).head(5)
```

```text
   symbol                 date         close  volume
0  ASML.AS  2026-03-12 00:00:00  1190.800000  128223
1  ASML.AS  2026-03-11 00:00:00  1198.800000  562904
2  ASML.AS  2026-03-10 00:00:00  1200.000000  800815
3  ASML.AS  2026-03-09 00:00:00  1147.600000  689086
4  ASML.AS  2026-03-06 00:00:00  1147.000000  857271
```

#### Pandas — multi-condition filter with & and |

Same parentheses rule as Polars: wrap each condition in parentheses. `&` is bitwise AND on boolean Series; `and` is a Python keyword and will not work with pandas. For more readable filters, use `df.query("symbol == 'ASML.AS' and close > 700")`.

```python
# Pandas — AND filter with &

df = pd.read_parquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet", columns=["symbol", "date", "close", "volume"])
df[(df["symbol"] == "ASML.AS") & (df["close"] > 700)].sort_values("date", ascending=False).head(5)
```

```text
        symbol        date   close  volume
11964  ASML.AS  2026-03-12  1190.8  128223
11963  ASML.AS  2026-03-11  1198.8  562904
11962  ASML.AS  2026-03-10  1200.0  800815
11961  ASML.AS  2026-03-09  1147.6  689086
11960  ASML.AS  2026-03-06  1147.0  857271
```

### Add computed column directly from file

#### DuckDB — computed column with SELECT expression

Computed columns in SQL are expressions in the SELECT list, aliased with `AS`. `ROUND(high - low, 2)` is evaluated per row — no intermediate storage. DuckDB can push the ORDER BY over computed columns without materialising them first.

```python
# DuckDB — add daily range column

duck.execute("""
    SELECT symbol, date, high, low, ROUND(high - low, 2) AS daily_range
    FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet'
    WHERE symbol = 'ASML.AS'
    ORDER BY daily_range DESC LIMIT 5""").df()
```

```text
   symbol        date    high     low  daily_range
0  ASML.AS  2024-10-15   804.6   665.0        139.6
1  ASML.AS  2026-01-28  1309.0  1185.4        123.6
2  ASML.AS  2026-02-26  1304.3  1210.8         93.5
3  ASML.AS  2024-08-05   749.9   657.0         92.9
4  ASML.AS  2025-04-07   596.2   508.4         87.8
```

#### Polars — computed column with with_columns()

`.with_columns(expr.alias("name"))` adds one or more computed columns without modifying existing ones. Expressions operate on full columns (vectorised), not row-by-row — no Python loop is needed.

```python
# Polars — add daily range column

pl.read_parquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet").filter(
    pl.col("symbol") == "ASML.AS"
).with_columns(
    (pl.col("high") - pl.col("low")).round(2).alias("daily_range")
).select("symbol", "date", "high", "low", "daily_range").sort("daily_range", descending=True).head(5)
```

```text
   symbol                 date         high          low  daily_range
0  ASML.AS  2024-10-15 00:00:00   804.600000   665.000000      139.600000
1  ASML.AS  2026-01-28 00:00:00  1309.000000  1185.400000      123.600000
2  ASML.AS  2026-02-26 00:00:00  1304.300000  1210.800000       93.500000
3  ASML.AS  2024-08-05 00:00:00   749.900000   657.000000       92.900000
4  ASML.AS  2025-04-07 00:00:00   596.200000   508.400000       87.800000
```

#### Pandas — computed column with assign()

`.assign(col=lambda d: expr)` adds a computed column in a method-chain-friendly way. The lambda receives the current DataFrame (`d`), allowing reference to other columns. `round()` is a Python built-in here — use `df["col"].round(n)` for the pandas vectorised version.

```python
# Pandas — add daily range column

df = pd.read_parquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet", columns=["symbol", "date", "high", "low"])
df[df["symbol"] == "ASML.AS"].assign(daily_range=lambda d: round(d["high"] - d["low"], 2)).sort_values("daily_range", ascending=False).head(5)
```

```text
        symbol        date    high     low  daily_range
11606  ASML.AS  2024-10-15   804.6   665.0        139.6
11933  ASML.AS  2026-01-28  1309.0  1185.4        123.6
11954  ASML.AS  2026-02-26  1304.3  1210.8         93.5
11555  ASML.AS  2024-08-05   749.9   657.0         92.9
11727  ASML.AS  2025-04-07   596.2   508.4         87.8
```

### Window function directly from file (DuckDB only)

#### DuckDB — LAG() window function on Parquet file

DuckDB can apply window functions directly on a Parquet file without loading it into memory first — unique to DuckDB among the three tools. Polars and pandas must load the full dataset before computing shifted values.

```python
# DuckDB — daily returns with LAG() directly on Parquet (not possible in Polars/Pandas without loading)

duck.execute("""
    SELECT symbol, date, close,
           LAG(close) OVER (PARTITION BY symbol ORDER BY date) AS prev_close,
           ROUND((close - LAG(close) OVER (PARTITION BY symbol ORDER BY date))
               / LAG(close) OVER (PARTITION BY symbol ORDER BY date) * 100, 2) AS daily_return_pct
    FROM 'C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet'
    WHERE symbol = 'ASML.AS'
    ORDER BY date DESC LIMIT 10""").df()
```

```text
   symbol        date   close  prev_close  daily_return_pct
0  ASML.AS  2026-03-12  1190.8      1198.8             -0.67
1  ASML.AS  2026-03-11  1198.8      1200.0             -0.10
2  ASML.AS  2026-03-10  1200.0      1147.6              4.57
3  ASML.AS  2026-03-09  1147.6      1147.0              0.05
4  ASML.AS  2026-03-06  1147.0      1186.0             -3.29
5  ASML.AS  2026-03-05  1186.0      1199.8             -1.15
6  ASML.AS  2026-03-04  1199.8      1161.8              3.27
7  ASML.AS  2026-03-03  1161.8      1210.4             -4.02
8  ASML.AS  2026-03-02  1210.4      1233.4             -1.86
9  ASML.AS  2026-02-27  1233.4      1232.4              0.08
```

#### Polars — equivalent with shift() (must load data first)

`.shift(1).over("symbol")` is Polars' LAG equivalent — it shifts values by N positions within each group defined by `.over()`. The full dataset must be in memory first; there is no Parquet-level pushdown for window functions in Polars.

```python
# Polars — LAG equivalent with shift().over() (data must be loaded, not lazy on file)

pl.read_parquet("C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet").filter(
    pl.col("symbol") == "ASML.AS"
).sort("date").with_columns(
    pl.col("close").shift(1).over("symbol").alias("prev_close")
).with_columns(
    ((pl.col("close") - pl.col("prev_close")) / pl.col("prev_close") * 100).round(2).alias("daily_return_pct")
).select("symbol", "date", "close", "prev_close", "daily_return_pct").sort("date", descending=True).head(10)
```

```text
   symbol                 date         close    prev_close  daily_return_pct
0  ASML.AS  2026-03-12 00:00:00  1190.800000  1198.800000           -0.670000
1  ASML.AS  2026-03-11 00:00:00  1198.800000  1200.000000           -0.100000
2  ASML.AS  2026-03-10 00:00:00  1200.000000  1147.600000            4.570000
3  ASML.AS  2026-03-09 00:00:00  1147.600000  1147.000000            0.050000
4  ASML.AS  2026-03-06 00:00:00  1147.000000  1186.000000           -3.290000
5  ASML.AS  2026-03-05 00:00:00  1186.000000  1199.800000           -1.150000
6  ASML.AS  2026-03-04 00:00:00  1199.800000  1161.800000            3.270000
7  ASML.AS  2026-03-03 00:00:00  1161.800000  1210.400000           -4.020000
8  ASML.AS  2026-03-02 00:00:00  1210.400000  1233.400000           -1.860000
9  ASML.AS  2026-02-27 00:00:00  1233.400000  1232.400000            0.080000
```

### Performance — format comparison

#### DuckDB — benchmark same query on CSV vs Parquet vs JSON

Same GROUP BY query on three file formats — same data, different encodings. Parquet is columnar and compressed so only the `symbol` and `close` columns are read; CSV and JSON require full row parsing. The result quantifies the I/O advantage of columnar formats.

```python
# Format comparison timing

results = []
for fmt, path in [("CSV", "C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.csv"),
                  ("Parquet", "C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet"),
                  ("JSON", "C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.json")]:
    start = time.perf_counter()
    rows = duck.execute(f"SELECT symbol, COUNT(*), AVG(close) FROM '{path}' GROUP BY symbol").fetchall()
    elapsed = (time.perf_counter() - start) * 1000
    results.append({"Format": fmt, "Rows": len(rows), "Time (ms)": round(elapsed, 1)})
pd.DataFrame(results)
```

```text
    Format  Rows  Time (ms)
0      CSV    50       59.8
1  Parquet    50        3.1
2     JSON    50       76.7
```

### DuckDB vs Polars vs Pandas — reference

| Operation | DuckDB SQL | Polars | Pandas |
|---|---|---|---|
| Read Parquet | `SELECT FROM 'file.parquet'` | `pl.read_parquet(path)` | `pd.read_parquet(path)` |
| Read CSV | `SELECT FROM 'file.csv'` | `pl.read_csv(path)` | `pd.read_csv(path)` |
| Filter | `WHERE col = 'val'` | `df.filter(pl.col("c")==v)` | `df[df["c"]==v]` |
| Select cols | `SELECT a, b` | `df.select("a","b")` | `df[["a","b"]]` |
| Sort | `ORDER BY col DESC` | `df.sort("c", descending=True)` | `df.sort_values("c", ascending=False)` |
| Limit | `LIMIT 10` | `df.head(10)` | `df.head(10)` |
| Group + Agg | `GROUP BY ... AVG(c)` | `df.group_by("c").agg(...)` | `df.groupby("c").agg(...)` |
| Window | `LAG() OVER (PARTITION BY ...)` | `pl.col("c").shift(1).over("g")` | `df.groupby("g")["c"].shift(1)` |
| Export | `COPY TO 'file.parquet'` | `df.write_parquet(path)` | `df.to_parquet(path)` |
| Lazy eval | No | `pl.scan_parquet(path)` | No |
| Returns | `.df()` → pandas DataFrame | Polars DataFrame | pandas DataFrame |
