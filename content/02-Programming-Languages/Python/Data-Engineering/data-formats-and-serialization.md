---
type: concept
category: data-engineering
technology: [python, sql-server]
tags: [pipeline, python, sql]
aliases: [Data Formats, JSON Handling, Serialization, Data Type Mapping, Python SQL Server Types, JSON Serializable, datetime serialization, pyodbc type mapping]
keywords: [json, json.dump, json.load, JSON serializable, datetime, date, isoformat, pyodbc, data types, float, FLOAT, BIGINT, DATETIME2, VARCHAR, NVARCHAR, DATE, BIT, parameterized queries, ? placeholder, fast_executemany, executemany, pandas DataFrame, data type conversion, type mismatch, None vs NULL, NaN, math.isnan, safe_write_json, Object of type date is not JSON serializable, data-pipeline]
description: "Python data format and serialization patterns for the data pipeline — covers JSON reading/writing with date-safe serialization, Python-to-SQL-Server type mapping, pyodbc parameterized query patterns, and common serialization pitfalls."
related: [bronze-layer-loading, silver-transforms, gold-transforms, data-pipeline-pipeline-steps, data-pipeline-common-errors]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Data Formats and Serialization

Data flows through the data pipeline as JSON files on disk, then into SQL Server via pyodbc parameterized queries. This note covers the JSON handling patterns, Python-to-SQL Server type mapping, and serialization pitfalls that arise in the [[bronze-layer-loading|bronze loading]] and [[silver-transforms|silver transform]] stages.

**Data path:** yfinance API response → Python dict/DataFrame → JSON file on disk → pyodbc parameterized INSERT → SQL Server

---

## JSON Handling

### Reading JSON from yfinance Output

Fetchers write raw yfinance data to JSON files in `data/stage/`, `data/dimensions/`, and `data/pulse/`. Loaders read these files and pass the data to SQL via pyodbc.

**Standard JSON read pattern:**

```python
import json
from pathlib import Path

# Read a JSON file containing a list of records (list of dicts)
def load_json(path: Path) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# Read a JSON file containing a single dict (e.g., dimension metadata)
def load_json_dict(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
```

### Writing JSON with Date-Safe Serialization

Python's `json.dump` cannot serialize `datetime.date` or `datetime.datetime` objects by default. yfinance returns `datetime.date` objects for fiscal calendar fields (e.g., `last_fiscal_year_end`, `ipo_date`). If these aren't converted before writing, you get:

```
TypeError: Object of type date is not JSON serializable
```

> [!warning] GCP-Only Serialization Error
> This error occurs specifically on GCP Cloud Run where dim JSON files must be rebuilt from the database on ephemeral containers. The `_export_db_dims()` function in `sync_definitions.py` hits this when database columns (e.g. `ipo_date`) return `datetime.date` objects. Local runs with existing dim JSON files are unaffected. See common pipeline errors for the full error entry.

**Date-safe JSON write (safe_write_json pattern):**

```python
import json
from pathlib import Path
import datetime

def _make_json_serializable(obj):
    """Recursively convert non-serializable types to JSON-safe types."""
    if isinstance(obj, dict):
        return {k: _make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_make_json_serializable(v) for v in obj]
    elif hasattr(obj, "isoformat"):
        # Handles both datetime.date and datetime.datetime
        return obj.isoformat()
    elif isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None  # JSON spec doesn't allow NaN or Infinity
    return obj

def safe_write_json(data, path: Path) -> None:
    """Write data to JSON, converting dates and NaN values."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(_make_json_serializable(data), f, ensure_ascii=False, indent=2)
```

**The minimal fix for isoformat — used in `_export_db_dims()`:**

```python
if hasattr(val, "isoformat"):
    val = val.isoformat()
```

### JSON Structures Used in the Pipeline

| File Pattern | Format | Content |
|-------------|--------|---------|
| `data/dimensions/{prefix}_dim.json` | List of dicts | Stock metadata (one dict per symbol) |
| `data/stage/{prefix}_signals_daily.json` | List of dicts | Daily price/momentum/sentiment signals |
| `data/stage/{prefix}_signals_quarterly.json` | List of dicts | Quarterly fundamental data |
| `data/pulse/{prefix}_pulse.json` | List of dicts | Real-time price snapshots |
| `data/pulse/{prefix}_tickers.json` | List of dicts | Most active stocks ranking |
| `data/definitions/{index_key}.json` | Single dict | Index configuration (symbols, color, name) |

---

## Python ↔ SQL Server Type Mapping

When building parameterized queries with pyodbc, Python values are mapped to SQL Server types automatically. Understanding the mapping prevents silent type issues.

### Core Type Mapping

| Python Type | SQL Server Type | Notes |
|------------|----------------|-------|
| `str` | `VARCHAR`, `NVARCHAR` | Use `NVARCHAR` for text that may contain non-ASCII (company names, countries) |
| `int` | `INT`, `BIGINT`, `SMALLINT`, `TINYINT` | Python int maps to the smallest fitting SQL integer type |
| `float` | `FLOAT` | SQL Server `FLOAT` is double-precision (64-bit), same as Python `float` |
| `bool` | `BIT` | Python `True` → SQL `1`, `False` → SQL `0` |
| `datetime.date` | `DATE` | pyodbc handles this automatically; cast with `CAST(? AS DATE)` if needed |
| `datetime.datetime` | `DATETIME2` | pyodbc handles this; SQL Server stores as UTC if you use `SYSUTCDATETIME()` default |
| `None` | `NULL` | Python `None` maps directly to SQL `NULL` via pyodbc |
| `float('nan')` | Problem | Python `NaN` does NOT map to `NULL` — pyodbc will raise an error |

### Handling None vs NaN

yfinance frequently returns `None` for missing financial metrics. Python's pandas may convert these to `float('nan')` when building DataFrames. You must normalize before inserting into SQL Server.

**NaN-to-None normalization before SQL insert:**

```python
import math

def normalize_value(val):
    """Convert NaN and Infinity to None (SQL NULL)."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val

# Apply to a full row of values before executemany:
def normalize_row(row: dict) -> tuple:
    """Convert a dict of values to a tuple safe for pyodbc INSERT."""
    return tuple(normalize_value(v) for v in row.values())
```

### Column Type Conventions in the example Schema

| Column Pattern | SQL Type | Reason |
|---------------|----------|--------|
| `symbol`, `_index`, `currency` | `VARCHAR(N)` | ASCII-only ticker codes and index keys |
| `long_name`, `sector`, `country`, `city` | `NVARCHAR(N)` | May contain accented characters (e.g., "Société Générale") |
| `long_business_summary` | `NVARCHAR(MAX)` | Unbounded text — company descriptions can be very long |
| `market_cap`, `volume`, `free_cashflow` | `BIGINT` | Large integer values that exceed `INT` (2.1B max) |
| `id` (most tables) | `INT IDENTITY` | Auto-increment surrogate key |
| `id` (bronze.pulse) | `BIGINT IDENTITY` | High-frequency table — INT could overflow with many snapshots |
| All price and ratio columns | `FLOAT` | Decimal precision not critical; FLOAT is sufficient for financial metrics |
| `is_current`, `is_filled`, `esg_populated` | `BIT` | Boolean flags |
| `health_flags_count` | `TINYINT` | Small integer 0–4 |
| `rank`, `composite_rank` | `SMALLINT` | Small integer for rankings (up to 50 stocks per index) |

---

## pyodbc Parameterized Query Patterns

All SQL in the data pipeline uses parameterized queries with `?` placeholders (not f-strings). This prevents SQL injection and handles type conversion automatically.

### Single-Row Insert

**Parameterized single-row INSERT:**

```python
import pyodbc

conn = get_connection()
cursor = conn.cursor()

sql = """
    INSERT INTO bronze.signals_daily (
        _index, symbol, timestamp, current_price, forward_pe
    ) VALUES (?, ?, ?, ?, ?)
"""

row = ('market_index', 'ASML.AS', '2025-03-05 17:00:00', 685.20, 28.5)
cursor.execute(sql, row)
conn.commit()
```

### Batch Insert with executemany

**Batch INSERT using executemany with fast_executemany for performance:**

```python
# Prepare the rows list (list of tuples)
rows = [
    ('market_index', 'ASML.AS', timestamp, 685.20, 28.5),
    ('market_index', 'MC.PA', timestamp, 835.40, 25.3),
    # ... up to 150 rows for 3 indices
]

sql = """
    INSERT INTO bronze.signals_daily (
        _index, symbol, timestamp, current_price, forward_pe
    ) VALUES (?, ?, ?, ?, ?)
"""

cursor.fast_executemany = True   # pyodbc batch mode — much faster than row-by-row
cursor.executemany(sql, rows)    # sends all rows in a single batch
conn.commit()
```

> [!tip] fast_executemany Performance Impact
> `cursor.fast_executemany = True` must be set before `executemany()`. It enables pyodbc's native ODBC batch mode, which is dramatically faster than row-by-row inserts — especially for 50–150 rows. Without it, pyodbc executes each row individually, which creates as many network round-trips as there are rows.

### Parameterized SELECT with Named Columns

**Fetch results as a list of dicts:**

```python
cursor.execute("SELECT symbol, sector, country FROM silver.index_dim WHERE is_current = 1 AND _index = ?", ('market_index',))
columns = [col[0] for col in cursor.description]  # extract column names
rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
```

### Date Handling in Parameters

**Pass dates as strings in ISO format to avoid ambiguity:**

```python
from datetime import date

# Option 1: pass datetime.date directly (pyodbc handles conversion)
cursor.execute("SELECT * FROM silver.index_europe_ohlcv WHERE date = ?", (date(2025, 3, 5),))

# Option 2: pass as ISO string (safer, unambiguous)
cursor.execute("SELECT * FROM silver.index_europe_ohlcv WHERE date = ?", ('2025-03-05',))

# Option 3: use CONVERT in SQL to normalize date format
cursor.execute("""
    SELECT symbol, CONVERT(VARCHAR(10), date, 120) AS date_str, volume
    FROM bronze.index_europe_ohlcv
""")
# Result: date_str = '2025-03-05'  (always YYYY-MM-DD, safe as dict key)
```

> [!info] Date Normalization Pattern
> The `CONVERT(VARCHAR(10), date, 120)` pattern (format code 120 = ISO 8601) is used throughout the data pipeline to create consistent `'YYYY-MM-DD'` string keys for Python dictionaries. This avoids issues with datetime comparison when building lookup maps.

### The `?` vs `@Param` Distinction

The data pipeline uses two parameterization styles depending on the caller:

| Style | Where Used | Syntax |
|-------|-----------|--------|
| `?` (positional) | Python/pyodbc loaders and transforms | `WHERE _index = ?` |
| `@Param` (named) | C# Dapper dashboard queries | `WHERE @Index IS NULL OR _index = @Index` |

pyodbc does not support named parameters directly — use `?` placeholders in the correct positional order.

---

## Index Definition JSON Format

Index definitions drive the entire pipeline. The `data/definitions/<index_key>.json` format:

**Index definition JSON structure:**

```json
{
    "name": "Oil & Gas 20",
    "color": "#D4A017",
    "currency": "$",
    "symbols": ["XOM", "CVX", "SHEL", "TTE", "BP", "EQNR", "COP", "EOG", "OXY"],
    "history_start": "2021-01-01"
}
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Display name in dashboard UI |
| `symbols` | Yes | list[str] | yfinance ticker symbols (with exchange suffix for non-US: `ASML.AS`, `7203.T`) |
| `color` | No | string | Hex color for charts |
| `currency` | No | string | Currency symbol shown in tooltips |
| `file_prefix` | No | string | Derived from key with underscores removed (e.g. `oil_20` → `oil20`) |
| `history_start` | No | string (ISO date) | Earliest date to fetch OHLCV history |

**Index key naming rules** (enforced by `setup_index.py`):
- Lowercase letters, digits, underscores only
- Must start with a lowercase letter (a-z)
- Must not end with underscore
- No consecutive underscores (`my__index` is invalid)
- Max 50 characters
- No SQL reserved words (`index`, `select`, `order`, etc.)

**Verify symbols before creating a definition:**

```bash
python -c "import yfinance as yf; t = yf.Ticker('OXY'); print(t.info.get('shortName', 'FAILED'))"
```

---

## Common Serialization Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| `TypeError: Object of type date is not JSON serializable` | `datetime.date` in data being passed to `json.dump` | Call `val.isoformat()` before serializing, or use `_make_json_serializable()` |
| `pyodbc.ProgrammingError: No results` | `execute()` called on a non-SELECT statement, then `fetchall()` attempted | Only call `fetchall()` after SELECT; use `rowcount` for DML statements |
| Silent NULL insert instead of float value | Python `float('nan')` passed to `executemany` | Normalize `NaN` to `None` before building the rows list |
| `NVARCHAR` truncation | Passing a string longer than the column's `N` | Increase column width or truncate: `val[:200]` before insert |
| Date comparison fails | Date stored as `DATE` but compared to `DATETIME2` string | Use `CAST(? AS DATE)` in SQL or pass `datetime.date` objects |

---

## Related Notes

- [[bronze-layer-loading]] — where these patterns are applied in the loading stage
- [[silver-transforms]] — how data types flow through to silver
- [[gold-transforms]] — downstream consumption in gold scoring
- the pipeline steps — pipeline steps that use these patterns
- common pipeline errors — the JSON serialization error in full context
