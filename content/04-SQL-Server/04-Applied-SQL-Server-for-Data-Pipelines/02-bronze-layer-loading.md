---
title: "02 - Bronze Layer Loading"
tags: [sql, sql-server, tsql, medallion-project]
aliases: [Bronze Layer, Bronze DDL, Bronze Loading, JSON to Bronze, Raw Layer Loading, Bronze Tables, Bronze Schema]
description: "Complete DDL and Python loading patterns for the example medallion bronze layer — covers all table definitions, idempotent schema creation, pyodbc connection setup, truncate-and-reload vs merge loading strategies, and JSON-to-bronze data flow."
parent: "[[domain-applied-sql-server-pipelines]]"
links:
  - "[[01-sql-server-loading-patterns]]"
  - "[[05-sql-server-schema-layering]]"
  - "[[10-sql-server-change-tracking]]"
  - "[[05-sql-server-incremental-transforms]]"
  - "[[08-sql-server-pipeline-anti-patterns]]"
  - "[[03-silver-transforms]]"
  - "[[04-gold-transforms]]"
created: 2026-03-22
updated: 2026-04-04
status: complete
---

> [!abstract] Medallion Project — Financial Index Pipeline
>
> This page documents the implementation of a specific financial data pipeline
> (STOXX/yfinance stock index scoring system) on SQL Server. For the general
> patterns and alternative approaches, see the [moc-sql-server > Patterns](https://alp78.github.io/elysium/04-SQL-Server/moc-sql-server#patterns)
> section. For the architectural theory behind bronze/silver/gold layering,
> see [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture).

# Bronze Layer Loading

> [!quote]
> "The bronze layer is sacred ground — it is the only place the data exists exactly as the source sent it. Corrupt the landing zone and you have no way back."
>
> — **Zhamak Dehghani**, *Data Mesh*

The bronze layer is the raw data landing zone in the [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture). Every table stores data exactly as received from the source — 1:1 with the source JSON files produced by yfinance fetchers. No business logic is applied; transformations happen in [silver](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms).

**Pipeline flow:** yfinance API → JSON files → Python loaders → Bronze tables → [Silver transforms](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms)

> [!info] Bronze Layer Role
>
> Bronze is append-friendly and ephemeral for snapshot tables. Most bronze tables are truncated and reloaded on every pipeline run — history is preserved in silver, not bronze. The exception is OHLCV data, which accumulates over time.

---

## Database Setup & Connection

Before any data can land in bronze tables, the database, schema, and Python connectivity must be established. This section covers the one-time setup DDL that creates the `analytics_db` database and `bronze` schema, the shared connection factory that every loader imports, and the symbol lookup helper used to drive per-stock operations. All setup code is idempotent and safe to re-execute on every pipeline run.

### Idempotent Database and Schema Creation

Idempotent DDL produces the same result whether executed once or a hundred times — no errors on reruns, no accidental drops, no duplicated objects. This matters in data pipelines because loaders may crash mid-run and restart from the top, CI/CD may re-apply migrations, and new team members need to bootstrap a fresh environment with a single script. Unlike PostgreSQL's `CREATE ... IF NOT EXISTS` syntax, SQL Server has no native single-statement equivalent for databases and schemas, so idempotency requires querying system catalog views (`sys.databases`, `sys.tables`, `sys.schemas`) before issuing DDL. This project follows the principles described in [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design). File: `db/ddl/bronze_schema.sql`

#### CREATE DATABASE IF NOT EXISTS — idempotent analytics database creation

The script checks `sys.databases` (the catalog view listing every database on the instance) before creating `analytics_db`. The `GO` keyword is not a T-SQL statement — it is a batch separator recognized by SSMS and sqlcmd that signals "send everything above as one batch." `CREATE DATABASE` and `CREATE SCHEMA` must each be the sole statement in their batch, which is why `GO` appears between them. The `EXEC('CREATE SCHEMA bronze')` wrapping is a dynamic SQL workaround: `CREATE SCHEMA` must be the first statement in a batch, so it cannot follow `IF NOT EXISTS` directly — wrapping it in `EXEC()` runs it in its own implicit batch.

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

pyodbc is a Python library that connects to databases via ODBC (Open Database Connectivity), the standard C-level API for relational database access on Windows and Linux. It translates Python calls into ODBC function calls, which the ODBC Driver Manager routes to a vendor-specific driver — here, Microsoft's "ODBC Driver 18 for SQL Server." All Python modules in this project share a single connection factory. Credentials come from `.env` via `python-dotenv`, so secrets are never hardcoded in source files. Every loader and transform imports `get_connection()` to get a database handle. For benchmarks comparing pyodbc `fast_executemany` with alternative ingestion methods (bcp, SqlBulkCopy), see [23_py_data_ingestion](https://alp78.github.io/elysium/02-Programming-Languages/Python/23_py_data_ingestion) and [23_cs_data_ingestion](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/23_cs_data_ingestion).

#### pyodbc connect with os.environ — connection factory from .env

The function loads environment variables from a `.env` file located at the project root (one directory above `utils/`). Each variable maps to a connection string component: `SQL_HOST` (defaults to `localhost`), `SQL_PORT` (defaults to `1434`, the typical named-instance port), `SQL_DATABASE`, `SQL_USER` (defaults to `sa`, the built-in system administrator account), and `SA_PASSWORD`. The `ODBC Driver 18 for SQL Server` is Microsoft's current recommended driver. The `TrustServerCertificate=yes` flag bypasses TLS certificate validation — acceptable for local development but should be removed in production where a CA-signed certificate is installed. The `autocommit` parameter controls whether each statement commits automatically or waits for an explicit `conn.commit()` — loaders pass `False` (the default) to batch multiple inserts into a single transaction.

```python
def get_connection(autocommit=False, database=None):
    env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(env_path)

    host     = os.getenv("SQL_HOST", "localhost")
    port     = os.getenv("SQL_PORT", "1434")
    db       = database or os.getenv("SQL_DATABASE", "analytics_db")
    user     = os.getenv("SQL_USER", "sa")
    password = os.getenv("SA_PASSWORD")
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

Many loaders need the list of stock symbols belonging to a particular index before they can iterate over per-stock data files. This helper queries `bronze.index_dim` to return each symbol and the earliest date for which price data is available, so downstream code knows both *which* stocks to process and *how far back* their history extends.

#### SELECT symbol, price_data_start — stock symbols and history start dates per index

The `get_index_symbols()` function in `utils/db.py` executes a parameterized query against `bronze.index_dim`, filtering by `_index` (e.g., `'market_index'`). It returns the ticker symbol (e.g., `'ASML.AS'`) and `price_data_start` — the earliest date for which OHLCV data exists for that stock. The `?` placeholder is a pyodbc parameterized query marker that prevents SQL injection by binding the value at the driver level rather than interpolating it into the SQL string.

```sql
SELECT symbol,
       price_data_start
FROM bronze.index_dim
WHERE _index = ?
```

#### Sample result — dim_stock query output

| symbol | price_data_start |
|--------|-----------------|
| ASML.AS | 2021-01-04 |
| MC.PA | 2021-01-04 |
| SAP.DE | 2021-01-04 |


---

## Bronze Table DDL

DDL (Data Definition Language) is the subset of SQL that creates, alters, and drops database objects — tables, indexes, schemas, constraints. Every bronze table below follows the same structural conventions:

- **Surrogate key:** An `INT IDENTITY(1,1)` or `BIGINT IDENTITY(1,1)` column named `id` serves as the clustered primary key. `IDENTITY(1,1)` tells SQL Server to auto-generate values starting at 1 and incrementing by 1 for each inserted row. The IDENTITY property guarantees uniqueness only when combined with a `PRIMARY KEY` or `UNIQUE` constraint — it does not guarantee consecutive values (gaps can occur after rollbacks or server restarts). `BIGINT` (8 bytes, max ~9.2 quintillion) is used for high-frequency tables like `pulse`; `INT` (4 bytes, max ~2.1 billion) suffices for the rest.
- **Partition key:** `_index VARCHAR(20)` identifies which stock index (e.g., `'market_index'`) the row belongs to. All truncate-reload operations filter by `_index`, enabling multi-index coexistence in a single table.
- **Ingestion timestamp:** `_ingested_at DATETIME2 DEFAULT SYSUTCDATETIME()` records the exact UTC moment each row was written to bronze. `DATETIME2` offers 100-nanosecond precision (vs. `DATETIME`'s 3.33ms) and a wider date range. `SYSUTCDATETIME()` returns the current UTC time from the operating system, avoiding time-zone ambiguity.
- **Nonclustered indexes:** Each table has a covering index on the columns used for filtering and joining — typically `(_index, symbol)` or `(_index, symbol, timestamp)`. These accelerate the `DELETE WHERE _index = ?` during truncate-reload and the lookups during merge operations.

### bronze.index_dim — Stock Metadata

Stores company identity data: name, sector, country, exchange, currency. Refreshed yearly or on index rebalance.

> [!abstract] Data source
> - **Source:** `data/dimensions/{prefix}_dim.json` (fetched from yfinance `.info`)
> - **Refresh:** On setup or manual re-fetch
> - **Strategy:** Truncate & reload per index
> - **Index:** `(_index, symbol)` — all operations filter by `_index` first

#### CREATE TABLE bronze.index_dim — full DDL with clustered index

The idempotency check joins `sys.tables` with `sys.schemas` to verify the table does not already exist in the `bronze` schema before creating it. The table has three column groups: **stock identity** (ticker symbol, company name, sector, industry, country, city, website, and a full business summary in `NVARCHAR(MAX)` for unlimited-length Unicode text), **exchange metadata** (exchange code, timezone, currency, quote type), and **history range** (the earliest available date and the actual start of OHLCV data for that stock). `NVARCHAR` columns are used wherever the data may contain non-ASCII characters (company names, city names), while `VARCHAR` suffices for codes and URLs.

```sql
IF NOT EXISTS (SELECT * FROM sys.tables t
               JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'bronze' AND t.name = 'index_dim')
CREATE TABLE bronze.index_dim (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    _index                  VARCHAR(20)     NOT NULL,
    _ingested_at            DATETIME2       NOT NULL
                            DEFAULT SYSUTCDATETIME(),

    symbol                  VARCHAR(20)     NOT NULL,
    long_name               NVARCHAR(200),
    short_name              NVARCHAR(100),
    sector                  NVARCHAR(100),
    sector_key              VARCHAR(100),
    industry                NVARCHAR(200),
    industry_key            VARCHAR(200),
    country                 NVARCHAR(100),
    city                    NVARCHAR(100),
    website                 VARCHAR(500),
    long_business_summary   NVARCHAR(MAX),

    exchange                VARCHAR(20),
    full_exchange_name      NVARCHAR(100),
    exchange_timezone_name  VARCHAR(50),
    exchange_timezone_short VARCHAR(10),
    currency                VARCHAR(10),
    financial_currency      VARCHAR(10),
    quote_type              VARCHAR(20),
    market                  VARCHAR(50),

    range_start             DATE,
    price_data_start        DATE
);
GO

CREATE INDEX IX_bronze_index_dim_index
    ON bronze.index_dim (_index, symbol);
GO
```


### bronze.signals_daily — Daily Trading Signals

One snapshot per stock per pipeline run. Stores price metrics, momentum, and analyst sentiment from yfinance.

> [!abstract] Data source
> - **Source:** `data/stage/{prefix}_signals_daily.json`
> - **Refresh:** 3x daily (09:00, 17:00, 22:00 UTC)
> - **Strategy:** Truncate & reload per index

#### CREATE TABLE bronze.signals_daily — full DDL

The table captures three categories of daily signals. **Price metrics** include valuation ratios: `forward_pe` (forward price-to-earnings — share price divided by estimated future earnings per share), `price_to_book` (market value vs. book value of equity), `ev_to_ebitda` (enterprise value divided by earnings before interest, taxes, depreciation, and amortization), `dividend_yield` (annual dividends as a percentage of share price), `market_cap` (total market value in currency units, stored as `BIGINT` because large-cap companies exceed `INT` range), and `beta` (a measure of systematic risk — how much the stock moves relative to the broader market; `beta = 1.0` means it tracks the market exactly). **Market context** compares the stock's 52-week performance against the S&P 500 benchmark. **Momentum signals** provide moving averages (50-day and 200-day SMAs) and distance from the 52-week high — a negative percentage indicating how far the stock has fallen from its peak. **Analyst sentiment** includes the median analyst price target, a recommendation score (1 = Strong Buy through 5 = Strong Sell), and `upside_potential` calculated as `(target / price) - 1`. All `FLOAT` columns use SQL Server's 8-byte IEEE 754 double-precision format.

```sql
CREATE TABLE bronze.signals_daily (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    _index                  VARCHAR(20)     NOT NULL,
    _ingested_at            DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),

    symbol                  VARCHAR(20)     NOT NULL,
    timestamp               DATETIME2       NOT NULL,

    current_price           FLOAT,
    forward_pe              FLOAT,
    price_to_book           FLOAT,
    ev_to_ebitda            FLOAT,
    dividend_yield          FLOAT,
    market_cap              BIGINT,
    beta                    FLOAT,

    fifty_two_week_change   FLOAT,
    sandp_52_week_change    FLOAT,

    fifty_day_average       FLOAT,
    two_hundred_day_average FLOAT,
    dist_from_52_week_high  FLOAT,

    target_median_price     FLOAT,
    recommendation_mean     FLOAT,
    upside_potential         FLOAT
);
GO

CREATE INDEX IX_bronze_signals_daily_index_symbol
    ON bronze.signals_daily (_index, symbol, timestamp);
GO
```


### bronze.signals_quarterly — Quarterly Fundamentals

Quarterly fundamentals are financial metrics that companies report every fiscal quarter in their earnings filings (10-Q in the US, equivalent filings in Europe). These include profitability ratios (gross margin, operating margin, return on equity), growth rates (revenue, earnings), capital structure indicators (debt-to-equity, current ratio, free cash flow), and ISS governance risk scores. The data changes infrequently — only when a company publishes new earnings — but the pipeline refreshes daily so the bronze snapshot is always current.

> [!abstract] Data source
> - **Source:** `data/stage/{prefix}_signals_quarterly.json`
> - **Refresh:** Daily (values only change quarterly with earnings)
> - **Strategy:** Truncate & reload per index

#### CREATE TABLE bronze.signals_quarterly — full DDL

The table has four column groups. **Quality metrics** measure profitability: `gross_margins` (gross profit divided by revenue), `operating_margins` (operating income divided by revenue), `return_on_equity` (net income divided by shareholder equity), and quarter-over-quarter growth rates for revenue and earnings. **Capital structure** tracks ownership and leverage: `shares_outstanding` and `float_shares` (the subset freely traded on the market, excluding insider holdings), `debt_to_equity` (total debt as a percentage of equity — values above 100% mean more debt than equity), `current_ratio` (current assets divided by current liabilities — below 1.0 signals potential liquidity problems), and `free_cashflow` (operating cash flow minus capital expenditures). **Fiscal calendar** columns record `last_fiscal_year_end` and `most_recent_quarter`, which silver uses as the key for upsert operations. **ISS governance risk scores** are ratings from Institutional Shareholder Services on a 1–10 scale where lower is better, covering audit, board, compensation, and shareholder-rights risk; `esg_populated` (a `BIT` column: 0 or 1) indicates whether governance data was available from the source.

```sql
CREATE TABLE bronze.signals_quarterly (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    _index                  VARCHAR(20)     NOT NULL,
    _ingested_at            DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),

    symbol                  VARCHAR(20)     NOT NULL,
    as_of_date              DATE            NOT NULL,

    gross_margins           FLOAT,
    operating_margins       FLOAT,
    return_on_equity        FLOAT,
    revenue_growth          FLOAT,
    earnings_growth         FLOAT,

    shares_outstanding      BIGINT,
    float_shares            BIGINT,
    debt_to_equity          FLOAT,
    current_ratio           FLOAT,
    free_cashflow           BIGINT,

    last_fiscal_year_end    DATE,
    most_recent_quarter     DATE,

    overall_risk            INT,
    audit_risk              INT,
    board_risk              INT,
    compensation_risk       INT,
    shareholder_rights_risk INT,
    esg_populated           BIT
);
GO

CREATE INDEX IX_bronze_signals_quarterly_index_symbol
    ON bronze.signals_quarterly (_index, symbol, as_of_date);
GO
```

### bronze.pulse — Real-Time Price Snapshots

Pulse captures intraday market data at 5-minute intervals during trading hours: current price, open/high/low, previous close, absolute and percentage price changes, bid/ask spread (the gap between the highest price a buyer will pay and the lowest a seller will accept), and volume metrics. Because this table accumulates hundreds of rows per stock per trading day, it uses `BIGINT IDENTITY` for its primary key to avoid exhausting the `INT` range (~2.1 billion) over the lifetime of the pipeline.

> [!abstract] Data source
> - **Source:** `data/pulse/{prefix}_pulse.json`
> - **Refresh:** Every 5 minutes during market hours
> - **Strategy:** Truncate & reload per index

#### CREATE TABLE bronze.pulse — BIGINT PK for high-frequency data

The table stores **price** (current, open, high, low, previous close, absolute change, and percentage change), **order book** (best bid and ask prices, their sizes in shares, and the spread — the difference between ask and bid that represents the market's transaction cost), and **volume** (current traded volume, 10-day average volume, and the ratio between them — a `volume_ratio` above 1.0 means the stock is trading more actively than its recent average).

```sql
CREATE TABLE bronze.pulse (
    id                      BIGINT IDENTITY(1,1) PRIMARY KEY,
    _index                  VARCHAR(20)     NOT NULL,
    _ingested_at            DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),

    symbol                  VARCHAR(20)     NOT NULL,
    timestamp               DATETIME2       NOT NULL,

    current_price           FLOAT,
    open_price              FLOAT,
    day_high                FLOAT,
    day_low                 FLOAT,
    previous_close          FLOAT,
    price_change            FLOAT,
    price_change_pct        FLOAT,

    bid                     FLOAT,
    ask                     FLOAT,
    bid_size                INT,
    ask_size                INT,
    spread                  FLOAT,

    current_volume          BIGINT,
    average_volume_10day    BIGINT,
    volume_ratio            FLOAT
);
GO

CREATE INDEX IX_bronze_pulse_index_symbol
    ON bronze.pulse (_index, symbol, timestamp);
GO
```

### bronze.pulse_tickers — Most Active Stocks

This table ranks stocks by intraday activity — which tickers are seeing unusual volume surges, abnormal price ranges, or elevated z-scores relative to their peers. The `activity_score` is a composite metric combining volume and range intensity, used in gold-layer dashboards to surface stocks that warrant attention. Rankings are recomputed hourly during market hours.

> [!abstract] Data source
> - **Source:** `data/pulse/{prefix}_tickers.json`
> - **Refresh:** Hourly during market hours

#### CREATE TABLE bronze.pulse_tickers — full DDL

Each row represents one stock's activity ranking at a specific `discovered_at` timestamp. `rank` is 1 for the most active stock. The z-score columns (`vol_z`, `rng_z`) measure how many standard deviations a stock's volume or price range deviates from its peer group — a z-score above 2.0 indicates statistically unusual activity. `activity_score` is the composite metric that combines volume surge and range intensity into a single ranking value.

```sql
CREATE TABLE bronze.pulse_tickers (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    _index                  VARCHAR(20)     NOT NULL,
    _ingested_at            DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),

    discovered_at           DATETIME2       NOT NULL,
    symbol                  VARCHAR(20)     NOT NULL,
    rank                    INT             NOT NULL,
    volume_surge            FLOAT,
    range_intensity         FLOAT,
    vol_z                   FLOAT,
    rng_z                   FLOAT,
    activity_score          FLOAT
);
GO

CREATE INDEX IX_bronze_pulse_tickers_index
    ON bronze.pulse_tickers (_index, discovered_at);
```

### bronze.trading_calendar — Exchange Schedules

Used to detect gaps in OHLCV data — if the exchange was open but we have no price, that's a gap to forward-fill. See [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms) for the gap-filling logic.

> [!abstract] Data source
> - **Source:** `exchange_calendars` Python library
> - **Refresh:** On setup (populated once per exchange)
> - **Composite primary key:** `(date, exchange_code)` — no surrogate id

#### CREATE TABLE bronze.trading_calendar — full DDL

Unlike the other bronze tables, this one has no surrogate `id` column. Its natural composite primary key `(date, exchange_code)` uniquely identifies each row because there is exactly one calendar entry per date per exchange. `exchange_code` is the yfinance code (e.g., `'AMS'` for Amsterdam), while `xc_code` is the corresponding code from the `exchange_calendars` Python library (e.g., `'XAMS'`). Pre-computed date-part columns (`year`, `quarter`, `month`, `week_of_year`, `day_of_week` where 0 = Monday through 6 = Sunday) avoid repeated `DATEPART()` calls in downstream queries. The `BIT` columns `is_trading_day`, `is_month_end`, and `is_quarter_end` enable fast filtered joins — silver gap-fill logic needs to ask "was exchange X open on date Y?" thousands of times per run.

```sql
CREATE TABLE bronze.trading_calendar (
    date                    DATE            NOT NULL,
    exchange_code           VARCHAR(10)     NOT NULL,
    xc_code                 VARCHAR(10)     NOT NULL,
    year                    SMALLINT        NOT NULL,
    quarter                 TINYINT         NOT NULL,
    month                   TINYINT         NOT NULL,
    week_of_year            TINYINT         NOT NULL,
    day_of_week             TINYINT         NOT NULL,
    is_trading_day          BIT             NOT NULL,
    is_month_end            BIT             NOT NULL,
    is_quarter_end          BIT             NOT NULL,

    CONSTRAINT PK_trading_calendar PRIMARY KEY (date, exchange_code)
);
GO

CREATE INDEX IX_bronze_trading_calendar_exchange
    ON bronze.trading_calendar (exchange_code, is_trading_day, date);
GO
```


---

## Dynamic OHLCV Tables

OHLCV (Open/High/Low/Close/Volume) tables are **created dynamically per index** by `setup_index.py`. Each index gets its own bronze and silver OHLCV table because price history can be millions of rows per index.

### Table Name Convention

Each index gets a dedicated OHLCV table rather than sharing a single partitioned table. This per-index isolation simplifies truncation (drop one table without locking another), keeps index sizes manageable, and avoids cross-index contention during concurrent loads. The table name is derived from the index key's `file_prefix` configuration value:

| Index Key | Table Prefix | Bronze Table | Silver Table |
|-----------|-------------|-------------|-------------|
| `market_index` | `index_europe` | `bronze.index_europe_ohlcv` | `silver.index_europe_ohlcv` |
| `project_usa_50` | `index_usa` | `bronze.index_usa_ohlcv` | `silver.index_usa_ohlcv` |
| `project_asia_50` | `index_asia` | `bronze.index_asia_ohlcv` | `silver.index_asia_ohlcv` |

#### config.py — derive table prefix from index key for dynamic DDL

The `file_prefix` is read from the index definition dictionary; if not set, it falls back to the index key with underscores stripped (e.g., `"market_index"` becomes `"indexeurope"` — but in practice the explicit `file_prefix` like `"index_europe"` is always provided). The `bronze_ohlcv()` and `silver_ohlcv()` helper functions return fully schema-qualified table names that loaders and transforms use to build parameterized SQL strings.

```python
file_prefix = defn.get("file_prefix", key.replace("_", ""))
ohlcv_table = f"{file_prefix}_ohlcv"

def bronze_ohlcv(key):
    return f"bronze.{_BY_KEY[key]['ohlcv_table']}"

def silver_ohlcv(key):
    return f"silver.{_BY_KEY[key]['ohlcv_table']}"
```

### Dynamic OHLCV DDL (`setup_index.py`)

#### CREATE TABLE IF NOT EXISTS — OHLCV bronze and silver per index (idempotent)

Bronze OHLCV stores raw prices from yfinance. Created by `setup_index.py` for each new index (idempotent). The `{ohlcv_table}` placeholder is substituted at runtime via Python f-strings. Note that `[open]` and `[close]` use square-bracket delimiters because `OPEN` and `CLOSE` are T-SQL reserved words — without delimiters, the parser would interpret them as keywords and raise a syntax error. `adj_close` is the split-and-dividend-adjusted closing price (the price retroactively recalculated to account for stock splits and dividend payments), which is the standard basis for computing returns. No `_index` column is needed here because each index has its own dedicated table.

```sql
IF NOT EXISTS (SELECT * FROM sys.tables t
               JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'bronze' AND t.name = '{ohlcv_table}')
CREATE TABLE bronze.{ohlcv_table} (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    _ingested_at    DATETIME2   NOT NULL DEFAULT SYSUTCDATETIME(),
    symbol          VARCHAR(20) NOT NULL,
    date            DATE        NOT NULL,
    [open]          FLOAT,
    high            FLOAT,
    low             FLOAT,
    [close]         FLOAT,
    adj_close       FLOAT,
    volume          BIGINT,
    dividends       FLOAT,
    stock_splits    FLOAT
);

CREATE INDEX IX_bronze_{ohlcv_table}
    ON bronze.{ohlcv_table} (symbol, date);
```

Silver OHLCV mirrors the bronze schema but adds an `is_filled BIT` column (defaulting to 0) that flags rows created by the gap-filling process — these rows contain forward-filled prices for trading days where the source had no data, not real market observations. The silver index is `UNIQUE` on `(symbol, date)`, enforcing a strict one-row-per-stock-per-day constraint that bronze does not have.

```sql
IF NOT EXISTS (...)
CREATE TABLE silver.{ohlcv_table} (
    ...
    is_filled       BIT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX UX_silver_{ohlcv_table}
    ON silver.{ohlcv_table} (symbol, date);
```


---

## Loading Patterns (JSON → Bronze)

Loaders read JSON files produced by fetchers and write to bronze tables. Two strategies apply, depending on the data type. In production, [Airflow DAGs](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns) orchestrate these bronze loads as upstream tasks in the pipeline.

### Strategy 1: Truncate & Reload (Most Loaders)

Truncate-and-reload is the simplest idempotent loading strategy: delete all existing rows for a given index, then insert the full dataset from the source JSON file. This works when the source provides a complete snapshot on every run — the entire truth for that index at that moment. There is no need to detect what changed because the old data is discarded entirely. The tradeoff is that bronze loses historical snapshots (only the latest run survives), which is acceptable here because history is preserved in silver via SCD Type 2 or append patterns. The `DELETE` targets only rows matching the current `_index`, so data from other indexes in the same table is unaffected.

Used by: `index_dim`, `signals_daily`, `signals_quarterly`, `pulse`, `pulse_tickers`

#### DELETE WHERE _index = @key — truncate-reload step 1: clear existing data

The loader uses a targeted `DELETE` rather than `TRUNCATE TABLE` because `TRUNCATE` removes *all* rows from the entire table and cannot be filtered by a `WHERE` clause. Since multiple indexes coexist in the same table, only the rows belonging to the current index are removed. The `?` is a pyodbc parameter placeholder — the actual index key (e.g., `'market_index'`) is bound at execution time.

```sql
DELETE FROM bronze.signals_daily
WHERE _index = ?
```

#### INSERT INTO bronze — truncate-reload step 2: bulk insert from JSON

After the `DELETE`, the loader reads the source JSON file, builds a list of tuples (one per row), and executes a parameterized `INSERT` via `executemany()`. The column list explicitly names every target column — this protects against schema drift (if a column is added to the table later, existing loaders continue to work without modification). The `id` and `_ingested_at` columns are omitted because they are auto-populated by `IDENTITY` and `DEFAULT SYSUTCDATETIME()` respectively.

```sql
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

By default, pyodbc's `executemany()` sends one row at a time to the server — each row incurs a full network round-trip. Setting `fast_executemany = True` switches to ODBC's array binding mode, which packs all parameter rows into a single network call. The `rows` argument is a list of tuples where each tuple matches the `?` placeholders in the SQL string, in order. `conn.commit()` finalizes the transaction; if an error occurs before commit, the entire batch can be rolled back.

```python
cursor.fast_executemany = True
cursor.executemany(sql, rows)
conn.commit()
```

> [!tip] fast_executemany Performance
>
> `fast_executemany = True` typically achieves 10–100x throughput improvement over row-by-row inserts, depending on row count and network latency. The speedup comes from reducing network round-trips: instead of N calls for N rows, the driver sends all rows in a single ODBC batch. This mode is safe for all INSERT/UPDATE/DELETE operations and should be the default for any bulk load in this pipeline.

### Strategy 2: Merge (OHLCV Only)

The merge (upsert) pattern handles data that grows over time rather than being fully replaced. OHLCV price history is append-only — each pipeline run adds rows for new trading days — but volume figures for recent dates can be corrected retroactively by the exchange, requiring updates to existing rows. A simple truncate-and-reload would work functionally but would be wasteful: OHLCV tables can contain millions of rows spanning years of history, and reloading the entire dataset on every run would mean re-inserting data that has not changed. Instead, the merge strategy: (1) reads the existing bronze data into a Python dictionary keyed by `(symbol, date)`, (2) compares each incoming row against the dictionary, (3) inserts rows that do not exist yet, and (4) updates rows where the volume has changed (the cheapest signal that the exchange corrected the data). This approach is implemented in application code (Python) rather than with T-SQL's `MERGE` statement to keep the logic portable and testable.

Used by: `load_ohlcv.py`

#### SELECT existing bronze — merge step 1: build lookup map for comparison

The loader first reads every existing row from the bronze OHLCV table into memory. `CONVERT(VARCHAR(10), date, 120)` formats the `DATE` column as a `'YYYY-MM-DD'` string so that Python can use it directly as a dictionary key without date-object conversion overhead. `ISNULL(volume, 0)` replaces `NULL` volumes with `0` so the stale-check comparison (step 2b) can use a simple integer inequality rather than handling `NULL` semantics. The table name is dynamic per index — the Python code substitutes it via an f-string.

```sql
SELECT symbol,
       CONVERT(VARCHAR(10), date, 120),
       ISNULL(volume, 0)
FROM bronze.index_europe_ohlcv
```

#### Sample result — bronze OHLCV lookup query output

| symbol | date | volume |
|--------|------|--------|
| ASML.AS | 2025-03-04 | 1842300 |
| ASML.AS | 2025-03-05 | 0 |
| MC.PA | 2025-03-04 | 523100 |

Python builds a dictionary keyed by `(symbol, date)` with volume as the value: `existing = {('ASML.AS', '2025-03-04'): 1842300, ...}`. For each incoming row, the loader checks: if the key is absent, insert (step 2a); if the key exists but the volume differs, update (step 2b); otherwise, skip.

#### INSERT WHERE NOT IN existing — merge step 2a: new rows only

Rows whose `(symbol, date)` key was not found in the `existing` dictionary are new trading days. They are collected into a list and batch-inserted using `fast_executemany`. The `id` and `_ingested_at` columns are auto-populated as with the truncate-reload pattern.

```sql
INSERT INTO bronze.index_europe_ohlcv (
    symbol, date, [open], high, low, [close],
    adj_close, volume, dividends, stock_splits
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

#### UPDATE WHERE volume changed — merge step 2b: update stale rows

Rows whose key exists in `existing` but whose volume value differs from the incoming data are stale — the exchange has corrected the volume (and potentially other OHLCV fields) since the last load. The `UPDATE` replaces all price and volume columns for the matching `(symbol, date)` pair. Only changed rows trigger an update; unchanged rows are skipped entirely, avoiding unnecessary write I/O and transaction log growth.

```sql
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

Every bronze table has at least one nonclustered index beyond the clustered primary key. These indexes are designed around the two dominant access patterns: (1) the `DELETE WHERE _index = ?` that precedes each truncate-reload, and (2) the `WHERE symbol = ? AND date = ?` lookups used by the merge strategy. Without these indexes, both operations would require full table scans — acceptable for small tables but prohibitively slow once OHLCV tables grow to millions of rows.

| Table | Index | Purpose |
|-------|-------|---------|
| `bronze.index_dim` | `(_index, symbol)` | Per-index truncate, per-symbol lookups |
| `bronze.signals_daily` | `(_index, symbol, timestamp)` | Per-index truncate, time-ordered reads |
| `bronze.trading_calendar` | `(exchange_code, is_trading_day, date)` | Gap-fill lookups: "was this exchange open on this date?" |
| `bronze.{ohlcv}` | `(symbol, date)` | Append + merge by date |

---

### Related Notes

- [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms) — next stage: cleaning, deduplication, SCD Type 2, gap-filling
- [gold-transforms](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms) — final stage: pre-computed analytics and scoring
- [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) — architectural context for all three layers
- [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) — the design principles behind rerunnable DDL and loaders
- [23_py_data_ingestion](https://alp78.github.io/elysium/02-Programming-Languages/Python/23_py_data_ingestion) — pyodbc connection patterns, fast_executemany benchmarks, and parameterized queries
- [23_cs_data_ingestion](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/23_cs_data_ingestion) — C# SqlBulkCopy and bcp alternatives for high-volume ingestion

