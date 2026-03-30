---
type: how-to
category: data-engineering
technology: [sql-server, python]
tags: [python, sql, sql-server, tsql, medallion-project]
aliases: [Bronze Layer, Bronze DDL, Bronze Loading, JSON to Bronze, Raw Layer Loading, Bronze Tables, Bronze Schema]
keywords: [bronze layer, raw layer, medallion architecture, DDL, pyodbc, parameterized queries, JSON loading, truncate reload, upsert, merge, OHLCV, trading calendar, index_dim, signals_daily, signals_quarterly, pulse, fast_executemany, executemany, batch insert, identity column, SYSUTCDATETIME, IS NOT EXISTS CREATE TABLE, idempotent DDL, bronze schema]
description: "Complete DDL and Python loading patterns for the example medallion bronze layer — covers all table definitions, idempotent schema creation, pyodbc connection setup, truncate-and-reload vs merge loading strategies, and JSON-to-bronze data flow."
related: [silver-transforms, gold-transforms, medallion-architecture, data-formats-and-serialization, pyodbc-sql-server]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

> [!abstract] Medallion Project — Financial Index Pipeline
>
> This page documents the implementation of a specific financial data pipeline
> (STOXX/yfinance stock index scoring system) on SQL Server. For the general
> patterns and alternative approaches, see the [[moc-sql-server#Patterns]]
> section. For the architectural theory behind bronze/silver/gold layering,
> see [[medallion-architecture]].

# Bronze Layer Loading

The bronze layer is the raw data landing zone in the [[medallion-architecture]]. Every table stores data exactly as received from the source — 1:1 with the source JSON files produced by yfinance fetchers. No business logic is applied; transformations happen in [[silver-transforms|silver]].

**Pipeline flow:** yfinance API → JSON files → Python loaders → Bronze tables → [[silver-transforms|Silver transforms]]

> [!info] Bronze Layer Role
>
> Bronze is append-friendly and ephemeral for snapshot tables. Most bronze tables are truncated and reloaded on every pipeline run — history is preserved in silver, not bronze. The exception is OHLCV data, which accumulates over time.

---

## Database Setup & Connection

### Idempotent Database and Schema Creation

All DDL in this project is idempotent — safe to run multiple times without error, following the principles described in [[idempotent-pipeline-design]]. File: `db/ddl/bronze_schema.sql`

#### CREATE DATABASE IF NOT EXISTS — idempotent analytics database creation

```sql
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'analytics_db')
    CREATE DATABASE analytics_db;
GO

USE analytics_db;
GO

-- Create the bronze schema (raw data layer)
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'bronze')
    EXEC('CREATE SCHEMA bronze');
GO
```


### Connection Helper (`utils/db.py`)

All Python modules share a single connection factory. Credentials come from `.env`. This is the key that unlocks the database — every loader and transform imports `get_connection()` to get a database handle. Credentials are never hardcoded. For benchmarks comparing pyodbc `fast_executemany` with alternative ingestion methods (bcp, SqlBulkCopy), see [[23_py_data_ingestion]] and [[23_cs_data_ingestion]].

#### pyodbc connect with os.environ — connection factory from .env

```python
# utils/db.py — creates pyodbc connections from .env config

def get_connection(autocommit=False, database=None):
    # Load .env from project root (SA_PASSWORD, SQL_HOST, etc.)
    env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(env_path)

    host     = os.getenv("SQL_HOST", "localhost")      # SQL Server hostname
    port     = os.getenv("SQL_PORT", "1434")            # SQL Server port
    db       = database or os.getenv("SQL_DATABASE", "analytics_db")  # target database
    user     = os.getenv("SQL_USER", "sa")              # SQL Server login
    password = os.getenv("SA_PASSWORD")                 # SA password from .env
    driver   = os.getenv("SQL_DRIVER", "ODBC Driver 18 for SQL Server")

    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={host},{port};"
        f"DATABASE={db};"
        f"UID={user};"
        f"PWD={password};"
        f"TrustServerCertificate=yes"
    )
    return pyodbc.connect(conn_str, autocommit=autocommit)
```

### Symbol Lookup Helper

#### SELECT symbol, MIN(date) — stock symbols and history start dates per index

```sql
-- utils/db.py: get_index_symbols()
-- Returns all stock symbols and their price history start dates for a given index.

SELECT symbol,            -- e.g. 'ASML.AS'
       price_data_start   -- e.g. '2021-01-04' — earliest OHLCV date available
FROM bronze.index_dim
WHERE _index = ?          -- parameterized: e.g. 'market_index'
```

#### Sample result — dim_stock query output

| symbol | price_data_start |
|--------|-----------------|
| ASML.AS | 2021-01-04 |
| MC.PA | 2021-01-04 |
| SAP.DE | 2021-01-04 |


---

## Bronze Table DDL

### bronze.index_dim — Stock Metadata

Stores company identity data: name, sector, country, exchange, currency. Refreshed yearly or on index rebalance.

- **Source:** `data/dimensions/{prefix}_dim.json` (fetched from yfinance `.info`)
- **Refresh:** On setup or manual re-fetch
- **Strategy:** Truncate & reload per index

#### CREATE TABLE bronze.index_dim — full DDL with clustered index

```sql
-- Source: data/dimensions/{prefix}_dim.json (fetched from yfinance .info)
-- Refresh: on setup or manual re-fetch
-- Strategy: truncate & reload per index

IF NOT EXISTS (SELECT * FROM sys.tables t
               JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'bronze' AND t.name = 'index_dim')
CREATE TABLE bronze.index_dim (
    id                      INT IDENTITY(1,1) PRIMARY KEY,  -- auto-increment surrogate key
    _index                  VARCHAR(20)     NOT NULL,        -- index key, e.g. 'market_index'
    _ingested_at            DATETIME2       NOT NULL         -- UTC timestamp of ingestion
                            DEFAULT SYSUTCDATETIME(),

    -- Stock identity
    symbol                  VARCHAR(20)     NOT NULL,        -- ticker, e.g. 'ASML.AS'
    long_name               NVARCHAR(200),                   -- 'ASML Holding N.V.'
    short_name              NVARCHAR(100),                   -- 'ASML Holding'
    sector                  NVARCHAR(100),                   -- 'Technology'
    sector_key              VARCHAR(100),                    -- 'technology'
    industry                NVARCHAR(200),                   -- 'Semiconductor Equipment'
    industry_key            VARCHAR(200),                    -- 'semiconductor-equipment-materials'
    country                 NVARCHAR(100),                   -- 'Netherlands'
    city                    NVARCHAR(100),                   -- 'Veldhoven'
    website                 VARCHAR(500),                    -- company URL
    long_business_summary   NVARCHAR(MAX),                   -- full company description

    -- Exchange metadata
    exchange                VARCHAR(20),                     -- 'AMS' (Amsterdam)
    full_exchange_name      NVARCHAR(100),                   -- 'Amsterdam'
    exchange_timezone_name  VARCHAR(50),                     -- 'Europe/Amsterdam'
    exchange_timezone_short VARCHAR(10),                     -- 'CET'
    currency                VARCHAR(10),                     -- 'EUR'
    financial_currency      VARCHAR(10),                     -- 'EUR'
    quote_type              VARCHAR(20),                     -- 'EQUITY'
    market                  VARCHAR(50),                     -- 'nl_market'

    -- History range
    range_start             DATE,                            -- earliest available date
    price_data_start        DATE                             -- actual start of OHLCV data
);
GO

-- Index: (_index, symbol) — all operations filter by _index first
CREATE INDEX IX_bronze_index_dim_index
    ON bronze.index_dim (_index, symbol);
GO
```


### bronze.signals_daily — Daily Trading Signals

One snapshot per stock per pipeline run. Stores price metrics, momentum, and analyst sentiment from yfinance.

- **Source:** `data/stage/{prefix}_signals_daily.json`
- **Refresh:** 3x daily (09:00, 17:00, 22:00 UTC)
- **Strategy:** Truncate & reload per index

#### CREATE TABLE bronze.signals_daily — full DDL

```sql
-- Source: data/stage/{prefix}_signals_daily.json
-- Refresh: 3x daily (09:00, 17:00, 22:00 UTC)
-- Strategy: truncate & reload per index

CREATE TABLE bronze.signals_daily (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    _index                  VARCHAR(20)     NOT NULL,
    _ingested_at            DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),

    symbol                  VARCHAR(20)     NOT NULL,        -- stock ticker
    timestamp               DATETIME2       NOT NULL,        -- when yfinance returned the data

    -- Price metrics (valuation ratios)
    current_price           FLOAT,                           -- current market price
    forward_pe              FLOAT,                           -- forward P/E ratio
    price_to_book           FLOAT,                           -- price-to-book ratio
    ev_to_ebitda            FLOAT,                           -- enterprise value / EBITDA
    dividend_yield          FLOAT,                           -- annual dividend yield
    market_cap              BIGINT,                          -- market capitalization in currency units
    beta                    FLOAT,                           -- systematic risk vs market

    -- Market context
    fifty_two_week_change   FLOAT,                           -- 52-week price change (decimal)
    sandp_52_week_change    FLOAT,                           -- S&P 500 52-week change (benchmark)

    -- Momentum signals
    fifty_day_average       FLOAT,                           -- 50-day simple moving average
    two_hundred_day_average FLOAT,                           -- 200-day SMA
    dist_from_52_week_high  FLOAT,                           -- distance from 52-week high (negative %)

    -- Analyst sentiment
    target_median_price     FLOAT,                           -- median analyst target price
    recommendation_mean     FLOAT,                           -- 1=Strong Buy ... 5=Strong Sell
    upside_potential         FLOAT                           -- (target / price) - 1
);
GO

-- Index: (_index, symbol, timestamp)
CREATE INDEX IX_bronze_signals_daily_index_symbol
    ON bronze.signals_daily (_index, symbol, timestamp);
GO
```


### bronze.signals_quarterly — Quarterly Fundamentals

- **Source:** `data/stage/{prefix}_signals_quarterly.json`
- **Refresh:** Daily (values only change quarterly with earnings)
- **Strategy:** Truncate & reload per index

#### CREATE TABLE bronze.signals_quarterly — full DDL

```sql
-- Source: data/stage/{prefix}_signals_quarterly.json
-- Refresh: daily (values only change quarterly with earnings)
-- Strategy: truncate & reload per index

CREATE TABLE bronze.signals_quarterly (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    _index                  VARCHAR(20)     NOT NULL,
    _ingested_at            DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),

    symbol                  VARCHAR(20)     NOT NULL,
    as_of_date              DATE            NOT NULL,        -- date the snapshot was taken

    -- Quality metrics
    gross_margins           FLOAT,                           -- gross profit / revenue
    operating_margins       FLOAT,                           -- operating income / revenue
    return_on_equity        FLOAT,                           -- net income / shareholder equity
    revenue_growth          FLOAT,                           -- QoQ revenue growth
    earnings_growth         FLOAT,                           -- QoQ earnings growth

    -- Capital structure
    shares_outstanding      BIGINT,
    float_shares            BIGINT,                          -- freely traded shares
    debt_to_equity          FLOAT,                           -- total debt / equity (%)
    current_ratio           FLOAT,                           -- current assets / current liabilities
    free_cashflow           BIGINT,                          -- operating cash flow - capex

    -- Fiscal calendar
    last_fiscal_year_end    DATE,
    most_recent_quarter     DATE,                            -- used to key silver upserts

    -- ISS Governance risk scores (1-10 scale, lower = better)
    overall_risk            INT,
    audit_risk              INT,
    board_risk              INT,
    compensation_risk       INT,
    shareholder_rights_risk INT,
    esg_populated           BIT                              -- whether governance data was available
);
GO

CREATE INDEX IX_bronze_signals_quarterly_index_symbol
    ON bronze.signals_quarterly (_index, symbol, as_of_date);
GO
```

### bronze.pulse — Real-Time Price Snapshots

- **Source:** `data/pulse/{prefix}_pulse.json`
- **Refresh:** Every 5 minutes during market hours
- **Strategy:** Truncate & reload per index

#### CREATE TABLE bronze.pulse — BIGINT PK for high-frequency data

```sql
-- Source: data/pulse/{prefix}_pulse.json
-- Refresh: every 5 minutes during market hours
-- Strategy: truncate & reload per index

CREATE TABLE bronze.pulse (
    id                      BIGINT IDENTITY(1,1) PRIMARY KEY,  -- BIGINT for high-frequency data
    _index                  VARCHAR(20)     NOT NULL,
    _ingested_at            DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),

    symbol                  VARCHAR(20)     NOT NULL,
    timestamp               DATETIME2       NOT NULL,

    -- Price
    current_price           FLOAT,
    open_price              FLOAT,
    day_high                FLOAT,
    day_low                 FLOAT,
    previous_close          FLOAT,
    price_change            FLOAT,                           -- absolute change
    price_change_pct        FLOAT,                           -- percentage change

    -- Order book
    bid                     FLOAT,
    ask                     FLOAT,
    bid_size                INT,
    ask_size                INT,
    spread                  FLOAT,                           -- ask - bid

    -- Volume
    current_volume          BIGINT,
    average_volume_10day    BIGINT,
    volume_ratio            FLOAT                            -- current_volume / avg_10day
);
GO

CREATE INDEX IX_bronze_pulse_index_symbol
    ON bronze.pulse (_index, symbol, timestamp);
GO
```

### bronze.pulse_tickers — Most Active Stocks

#### CREATE TABLE bronze.pulse_tickers — full DDL

```sql
-- Source: data/pulse/{prefix}_tickers.json
-- Refresh: hourly during market hours

CREATE TABLE bronze.pulse_tickers (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    _index                  VARCHAR(20)     NOT NULL,
    _ingested_at            DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),

    discovered_at           DATETIME2       NOT NULL,        -- when the ranking was computed
    symbol                  VARCHAR(20)     NOT NULL,        -- stock ticker
    rank                    INT             NOT NULL,        -- 1 = most active
    volume_surge            FLOAT,                           -- current / average volume
    range_intensity         FLOAT,                           -- intraday range / avg range
    vol_z                   FLOAT,                           -- volume z-score vs peers
    rng_z                   FLOAT,                           -- range z-score vs peers
    activity_score          FLOAT                            -- composite activity ranking
);
GO

CREATE INDEX IX_bronze_pulse_tickers_index
    ON bronze.pulse_tickers (_index, discovered_at);
```

### bronze.trading_calendar — Exchange Schedules

Used to detect gaps in OHLCV data — if the exchange was open but we have no price, that's a gap to forward-fill. See [[silver-transforms]] for the gap-filling logic.

- **Source:** `exchange_calendars` Python library
- **Refresh:** On setup (populated once per exchange)
- **Composite primary key:** `(date, exchange_code)` — no surrogate id

#### CREATE TABLE bronze.trading_calendar — full DDL

```sql
-- Source: exchange_calendars Python library
-- Refresh: on setup (populated once per exchange)
-- Composite primary key: (date, exchange_code) — no surrogate id

CREATE TABLE bronze.trading_calendar (
    date                    DATE            NOT NULL,         -- calendar date
    exchange_code           VARCHAR(10)     NOT NULL,         -- yfinance exchange code, e.g. 'AMS'
    xc_code                 VARCHAR(10)     NOT NULL,         -- exchange_calendars code, e.g. 'XAMS'
    year                    SMALLINT        NOT NULL,
    quarter                 TINYINT         NOT NULL,
    month                   TINYINT         NOT NULL,
    week_of_year            TINYINT         NOT NULL,
    day_of_week             TINYINT         NOT NULL,         -- 0=Monday ... 6=Sunday
    is_trading_day          BIT             NOT NULL,         -- 1 if the exchange was open
    is_month_end            BIT             NOT NULL,
    is_quarter_end          BIT             NOT NULL,

    CONSTRAINT PK_trading_calendar PRIMARY KEY (date, exchange_code)
);
GO

-- Optimized for: WHERE exchange_code = ? AND is_trading_day = 1 AND date BETWEEN ...
CREATE INDEX IX_bronze_trading_calendar_exchange
    ON bronze.trading_calendar (exchange_code, is_trading_day, date);
GO
```


---

## Dynamic OHLCV Tables

OHLCV (Open/High/Low/Close/Volume) tables are **created dynamically per index** by `setup_index.py`. Each index gets its own bronze and silver OHLCV table because price history can be millions of rows per index.

### Table Name Convention

The table name is derived from the index key by stripping underscores:

| Index Key | Table Prefix | Bronze Table | Silver Table |
|-----------|-------------|-------------|-------------|
| `market_index` | `index_europe` | `bronze.index_europe_ohlcv` | `silver.index_europe_ohlcv` |
| `project_usa_50` | `index_usa` | `bronze.index_usa_ohlcv` | `silver.index_usa_ohlcv` |
| `project_asia_50` | `index_asia` | `bronze.index_asia_ohlcv` | `silver.index_asia_ohlcv` |

#### config.py — derive table prefix from index key for dynamic DDL

```python
# config.py — derives table prefix from index key
file_prefix = defn.get("file_prefix", key.replace("_", ""))  # "market_index" → "index_europe"
ohlcv_table = f"{file_prefix}_ohlcv"                          # "index_europe_ohlcv"

def bronze_ohlcv(key):
    return f"bronze.{_BY_KEY[key]['ohlcv_table']}"  # "bronze.index_europe_ohlcv"

def silver_ohlcv(key):
    return f"silver.{_BY_KEY[key]['ohlcv_table']}"  # "silver.index_europe_ohlcv"
```

### Dynamic OHLCV DDL (`setup_index.py`)

#### CREATE TABLE IF NOT EXISTS — OHLCV bronze and silver per index (idempotent)

```sql
-- Created by setup_index.py for each new index (idempotent)

-- Bronze OHLCV: raw prices from yfinance
IF NOT EXISTS (SELECT * FROM sys.tables t
               JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'bronze' AND t.name = '{ohlcv_table}')
CREATE TABLE bronze.{ohlcv_table} (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    _ingested_at    DATETIME2   NOT NULL DEFAULT SYSUTCDATETIME(),
    symbol          VARCHAR(20) NOT NULL,
    date            DATE        NOT NULL,
    [open]          FLOAT,                    -- [brackets] because OPEN is a reserved word
    high            FLOAT,
    low             FLOAT,
    [close]         FLOAT,                    -- raw close (not split-adjusted)
    adj_close       FLOAT,                    -- split & dividend adjusted close
    volume          BIGINT,
    dividends       FLOAT,
    stock_splits    FLOAT
);

CREATE INDEX IX_bronze_{ohlcv_table}
    ON bronze.{ohlcv_table} (symbol, date);

-- Silver OHLCV: gap-filled, forward-filled version
IF NOT EXISTS (...)
CREATE TABLE silver.{ohlcv_table} (
    -- Same columns as bronze, plus:
    is_filled       BIT NOT NULL DEFAULT 0    -- 1 = this row was forward-filled (not real data)
);

CREATE UNIQUE INDEX UX_silver_{ohlcv_table}
    ON silver.{ohlcv_table} (symbol, date);   -- UNIQUE: one price per stock per day
```


---

## Loading Patterns (JSON → Bronze)

Loaders read JSON files produced by fetchers and write to bronze tables. Two strategies apply, depending on the data type. In production, [[airflow-dag-patterns|Airflow DAGs]] orchestrate these bronze loads as upstream tasks in the pipeline.

### Strategy 1: Truncate & Reload (Most Loaders)

Used by: `index_dim`, `signals_daily`, `signals_quarterly`, `pulse`, `pulse_tickers`


#### DELETE WHERE _index = @key — truncate-reload step 1: clear existing data

```sql
-- ingestion/loaders/load_signals_daily.py (line 33)

DELETE FROM bronze.signals_daily
WHERE _index = ?      -- e.g. 'market_index'
```

#### INSERT INTO bronze — truncate-reload step 2: bulk insert from JSON

```sql
-- ingestion/loaders/load_signals_daily.py (lines 60-68)

INSERT INTO bronze.signals_daily (
    _index, symbol, timestamp,
    current_price, forward_pe, price_to_book, ev_to_ebitda,
    dividend_yield, market_cap, beta,
    fifty_two_week_change, sandp_52_week_change,
    fifty_day_average, two_hundred_day_average, dist_from_52_week_high,
    target_median_price, recommendation_mean, upside_potential
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

#### pyodbc cursor.executemany fast_executemany — Python batch insert

```python
cursor.fast_executemany = True   # pyodbc batch mode — much faster than row-by-row
cursor.executemany(sql, rows)    # rows is a list of tuples matching the ? placeholders
conn.commit()                    # commit the transaction (or rollback on error)
```

> [!tip] fast_executemany Performance
>
> Setting `cursor.fast_executemany = True` before `executemany()` enables pyodbc's ODBC batch mode, which is dramatically faster than row-by-row inserts. Use it for all bulk loads.

### Strategy 2: Merge (OHLCV Only)

OHLCV data is append-only (new dates) with volume corrections (updates). Used by: `load_ohlcv.py`


#### SELECT existing bronze — merge step 1: build lookup map for comparison

```sql
-- ingestion/loaders/load_ohlcv.py (lines 54-57)

SELECT symbol,                                   -- stock ticker
       CONVERT(VARCHAR(10), date, 120),           -- date as 'YYYY-MM-DD' string
       ISNULL(volume, 0)                          -- volume (0 if null, for stale check)
FROM bronze.index_europe_ohlcv                     -- table name is dynamic per index
```

#### Sample result — bronze OHLCV lookup query output

| symbol | date | volume |
|--------|------|--------|
| ASML.AS | 2025-03-04 | 1842300 |
| ASML.AS | 2025-03-05 | 0 |
| MC.PA | 2025-03-04 | 523100 |

Python builds a dictionary: `existing = {('ASML.AS', '2025-03-04'): 1842300, ...}`

#### INSERT WHERE NOT IN existing — merge step 2a: new rows only

```sql
-- ingestion/loaders/load_ohlcv.py (lines 84-88)

INSERT INTO bronze.index_europe_ohlcv (
    symbol, date, [open], high, low, [close],
    adj_close, volume, dividends, stock_splits
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

#### UPDATE WHERE volume changed — merge step 2b: update stale rows

```sql
-- ingestion/loaders/load_ohlcv.py (lines 91-95)

UPDATE bronze.index_europe_ohlcv
SET [open] = ?, high = ?, low = ?, [close] = ?,
    adj_close = ?, volume = ?, dividends = ?, stock_splits = ?
WHERE symbol = ? AND date = ?
```

---

### Load Pattern Summary

| Pattern | Tables | When to Use |
|---------|--------|-------------|
| **Truncate & reload** | `signals_daily`, `signals_quarterly`, `pulse`, `pulse_tickers`, `index_dim` | Source provides a complete snapshot; history is kept in silver |
| **Merge (upsert)** | OHLCV | Source is append-only with possible corrections |
| **SCD Type 2** | `index_dim` (silver only) | Need to track attribute changes over time |

---

### Index Design (Bronze Layer)

| Table | Index | Purpose |
|-------|-------|---------|
| `bronze.index_dim` | `(_index, symbol)` | Per-index truncate, per-symbol lookups |
| `bronze.signals_daily` | `(_index, symbol, timestamp)` | Per-index truncate, time-ordered reads |
| `bronze.trading_calendar` | `(exchange_code, is_trading_day, date)` | Gap-fill lookups: "was this exchange open on this date?" |
| `bronze.{ohlcv}` | `(symbol, date)` | Append + merge by date |

---

### Related Notes

- [[silver-transforms]] — next stage: cleaning, deduplication, SCD Type 2, gap-filling
- [[gold-transforms]] — final stage: pre-computed analytics and scoring
- [[medallion-architecture]] — architectural context for all three layers
- the data pipeline steps — pipeline steps that drive these loaders
- data formats and serialization — JSON handling and Python type mapping
- database connections — pyodbc connection patterns and parameterized queries
