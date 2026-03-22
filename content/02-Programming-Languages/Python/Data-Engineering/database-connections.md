---
type: how-to
category: python
technology: [python, sql-server]
tags: [how-to, python, sql-server, pyodbc, sqlalchemy, database]
aliases: [pyodbc connection, SQLAlchemy SQL Server, connection pooling, python database, pyodbc connect, create_engine, read_sql, to_sql, ODBC driver, python SQL Server]
keywords: [pyodbc, sqlalchemy, connection string, sql server, mssql, odbc driver 18, TrustServerCertificate, connection pooling, pool_size, max_overflow, pool_recycle, pandas read_sql, to_sql, create_engine, quote_plus, fast_executemany, context manager, database driver]
description: "Python database connection patterns for SQL Server — pyodbc direct connections, SQLAlchemy with connection pooling, pandas read_sql/to_sql, environment variable secrets, and connection troubleshooting."
related: ["[[data-formats-and-serialization]]", "[[python-virtual-environments]]", "[[sql-python-csharp-transforms]]", "[[sqlcmd-connection-and-usage]]"]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Python Database Connections

Connecting Python to SQL Server for data pipelines. This note covers pyodbc (direct ODBC) and SQLAlchemy (with connection pooling and pandas integration).

> [!warning] ODBC Driver Version Matters
> `ODBC Driver 18 for SQL Server` enforces TLS encryption by default and requires `TrustServerCertificate=yes` for self-signed certificates (common in development and internal servers). `ODBC Driver 17` did not encrypt by default. Always use Driver 18 — but add `TrustServerCertificate=yes` if your server uses a self-signed cert.

For C#, PowerShell, and sqlcmd connection strings, see [[sql-python-csharp-transforms]] and [[sqlcmd-connection-and-usage]].

## pyodbc — Direct ODBC Connections

**SQL Server authentication:**
```python
import pyodbc

conn = pyodbc.connect(
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=10.132.0.2;DATABASE=mydb;UID=sa;PWD=YourPassword;"
    "TrustServerCertificate=yes;"
)
```

**Windows (Integrated) authentication:**
```python
conn = pyodbc.connect(
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=10.132.0.2;DATABASE=mydb;"
    "Trusted_Connection=yes;"
    "TrustServerCertificate=yes;"
)
```

**Non-default port (e.g., 1434):**
```python
conn = pyodbc.connect(
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=10.132.0.2,1434;DATABASE=mydb;UID=sa;PWD=YourPassword;"
    "TrustServerCertificate=yes;"
)
```

### Production Pattern: Environment Variables

> [!tip] Never Hardcode Passwords
> Always read secrets from environment variables or a secrets manager:

```python
import os

conn = pyodbc.connect(
    f"DRIVER={{ODBC Driver 18 for SQL Server}};"
    f"SERVER={os.environ['DB_HOST']};DATABASE={os.environ['DB_NAME']};"
    f"UID={os.environ['DB_USER']};PWD={os.environ['DB_PASSWORD']};"
    "TrustServerCertificate=yes;"
)
```

### Context Manager Pattern

```python
import pyodbc

def get_connection():
    return pyodbc.connect(
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={os.environ['DB_HOST']};DATABASE={os.environ['DB_NAME']};"
        f"UID={os.environ['DB_USER']};PWD={os.environ['DB_PASSWORD']};"
        "TrustServerCertificate=yes;"
    )

# Use as context manager — auto-closes on exit
with get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM gold.scores WHERE trade_date = ?", date)
    rows = cursor.fetchall()
```

### fast_executemany for Bulk Inserts

```python
conn = get_connection()
cursor = conn.cursor()
cursor.fast_executemany = True  # 10-50x faster for batch inserts

cursor.executemany(
    "INSERT INTO bronze.prices (symbol, date, close) VALUES (?, ?, ?)",
    [(row.symbol, row.date, row.close) for row in data]
)
conn.commit()
```

## SQLAlchemy — Connection Pooling and pandas

SQLAlchemy is required when using pandas `read_sql()` or ORM tools. It wraps pyodbc with connection pooling.

### Creating an Engine

```python
from sqlalchemy import create_engine

engine = create_engine(
    "mssql+pyodbc://sa:YourPassword@10.132.0.2/mydb"
    "?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes",
    pool_size=5, max_overflow=10, pool_recycle=3600
)
```

### Production Pattern with Environment Variables

```python
import os
from sqlalchemy import create_engine
from urllib.parse import quote_plus

# URL-encode the password to handle special characters (!, @, #, etc.)
password = quote_plus(os.environ['DB_PASSWORD'])

engine = create_engine(
    f"mssql+pyodbc://{os.environ['DB_USER']}:{password}"
    f"@{os.environ['DB_HOST']}/{os.environ['DB_NAME']}"
    "?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes",
    pool_size=5,       # connections kept open at all times
    max_overflow=10,   # extra connections beyond pool_size (max 15 total)
    pool_recycle=3600  # recycle connections every hour (prevents stale TCP)
)
```

> [!info] Connection Pooling Parameters
> - `pool_size=5` — keep 5 connections open (reused across requests)
> - `max_overflow=10` — allow up to 10 additional connections when pool is exhausted
> - `pool_recycle=3600` — close and reopen after 1 hour to prevent stale connections
>
> For pipeline scripts that run and exit, pooling provides no benefit. Use plain `pyodbc.connect()` instead.

### pandas read_sql and to_sql

```python
import pandas as pd

# Read query result into DataFrame
df = pd.read_sql(
    "SELECT * FROM gold.scores WHERE trade_date = '2026-03-10'",
    engine
)

# Write DataFrame to SQL table
df.to_sql(
    'staging_scores',
    engine,
    schema='bronze',
    if_exists='append',    # 'replace' drops and recreates, 'append' adds rows
    index=False,
    method='multi',        # batches rows for better performance
    chunksize=1000
)
```

### Parameterized Queries with SQLAlchemy

```python
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(
        text("SELECT * FROM gold.scores WHERE trade_date = :dt"),
        {"dt": "2026-03-10"}
    )
    for row in result:
        print(row.symbol, row.composite_score)
```

> [!warning] Always Use Parameterized Queries
> Never concatenate user input into SQL strings. Use `?` placeholders (pyodbc) or `:param` (SQLAlchemy). SQL injection is how databases get breached.

## Connection Troubleshooting

| Error | Likely Cause | Fix |
|---|---|---|
| `Login failed for user 'sa'` | Wrong password or disabled login | Verify credentials |
| `Cannot open server requested by the login` | Wrong database name | Check `DATABASE=` value |
| `SSL Provider: certificate verify failed` | Self-signed cert | Add `TrustServerCertificate=yes` |
| `Named Pipes Provider: Could not open connection` | Server not reachable | Check firewall port 1433 |
| `Login timeout expired` | Network latency or server load | Increase `ConnectTimeout` |
| `The ODBC driver is not installed` | Missing driver | Install ODBC Driver 18 |

> [!tip] Test Connectivity Before Debugging the App
> ```bash
> nc -zv 10.132.0.2 1433    # test port is reachable
> ```
> If this fails, the problem is network/firewall, not your connection string.

## Related

- [[data-formats-and-serialization]] — Python type mapping and pyodbc parameterized patterns
- [[sql-python-csharp-transforms]] — Side-by-side data manipulation in SQL, Python, C#
- [[sqlcmd-connection-and-usage]] — SQL Server CLI tool (non-Python)
- [[python-virtual-environments]] — Setting up the Python environment with pyodbc/SQLAlchemy
