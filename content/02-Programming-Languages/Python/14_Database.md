---
type: reference
category: programming-languages
technology: [python]
tags: [reference, programming-languages, python, database]
aliases: [database access, SQL, ORM, pyodbc, Entity Framework, Dapper, SQLAlchemy, connection strings]
keywords: [pyodbc, SQLAlchemy, sqlite3, connection string, ORM, query, transaction, pandas, read_sql]
description: "Python database reference with executable examples and cell outputs — covers pyodbc, SQLAlchemy ORM, raw SQL, transactions, and pandas integration. See [[14_Database - CSharp]] for the C# equivalent."
related:
  - "[[14_Database - CSharp]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 14. Database - Python

Topics covered:
- SQLite CRUD (built-in, zero setup)
- SQL Server with pyodbc (index data, medallion architecture)
- Parameterized Queries & SQL Injection Prevention
- pandas Integration
- SQLAlchemy ORM
- Real-world Index Provider Queries (index provider)

## 1. SQLite — Built-in, Zero Setup


```python
# SQLite — Python's built-in embedded database.
#
# KEY CONCEPTS:
# - sqlite3: built-in module, no install needed. Creates a file-based DB.
#   C# equivalent: Microsoft.Data.Sqlite
# - Connection → Cursor → Execute → Fetch → Close
# - :memory: creates an in-memory DB (lost when connection closes)
# - Parameterized queries: use ? placeholders, NEVER f-strings with SQL.
#   Prevents SQL injection — critical for any data pipeline.
# - context manager: `with` auto-commits on success, rolls back on error.

import sqlite3

# ─── Create in-memory database ───
conn = sqlite3.connect(':memory:')
conn.row_factory = sqlite3.Row  # access columns by name (like dict)
cur = conn.cursor()

# ─── CREATE TABLE ───
cur.execute('''
    CREATE TABLE trades (
        trade_id   TEXT PRIMARY KEY,
        ticker     TEXT NOT NULL,
        side       TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
        quantity   INTEGER NOT NULL CHECK(quantity > 0),
        price      REAL NOT NULL CHECK(price > 0),
        trade_date TEXT NOT NULL DEFAULT (date('now')),
        notional   REAL GENERATED ALWAYS AS (quantity * price) STORED
    )
''')
print('Created table: trades')

# ─── INSERT (parameterized — ? placeholders) ───
trades_data = [
    ('TRD_001', 'ASML.AS', 'BUY',  100, 685.40, '2026-03-15'),
    ('TRD_002', 'MC.PA',   'BUY',   50, 890.20, '2026-03-15'),
    ('TRD_003', 'SAP.DE',  'SELL',  75, 245.80, '2026-03-15'),
    ('TRD_004', 'ASML.AS', 'SELL',  30, 690.00, '2026-03-16'),
    ('TRD_005', 'RMS.PA',  'BUY',   20, 2850.0, '2026-03-16'),
    ('TRD_006', 'SIE.DE',  'BUY',  200, 198.50, '2026-03-17'),
]
cur.executemany(
    'INSERT INTO trades (trade_id, ticker, side, quantity, price, trade_date) VALUES (?, ?, ?, ?, ?, ?)',
    trades_data
)
conn.commit()
print(f'Inserted {len(trades_data)} trades')

# ─── SELECT ───
print('\n=== All Trades ===')
for row in cur.execute('SELECT * FROM trades ORDER BY trade_date, trade_id'):
    print(f"  {row['trade_id']} | {row['ticker']:8s} | {row['side']:4s} | "
          f"{row['quantity']:>5d} | ${row['price']:>10,.2f} | ${row['notional']:>12,.2f} | {row['trade_date']}")

# ─── WHERE with parameters ───
print('\n=== ASML Trades Only ===')
for row in cur.execute('SELECT * FROM trades WHERE ticker = ?', ('ASML.AS',)):
    print(f"  {row['trade_id']} | {row['side']} | {row['quantity']} @ ${row['price']:,.2f}")

# ─── Aggregate queries ───
print('\n=== Portfolio Summary ===')
cur.execute('''
    SELECT ticker,
           SUM(CASE WHEN side='BUY' THEN quantity ELSE -quantity END) AS net_shares,
           ROUND(SUM(CASE WHEN side='BUY' THEN notional ELSE -notional END), 2) AS net_notional,
           COUNT(*) AS trade_count
    FROM trades
    GROUP BY ticker
    ORDER BY net_notional DESC
''')
for row in cur.fetchall():
    print(f"  {row['ticker']:8s} | {row['net_shares']:>6d} shares | ${row['net_notional']:>12,.2f} | {row['trade_count']} trades")

# ─── UPDATE ───
cur.execute('UPDATE trades SET price = ? WHERE trade_id = ?', (700.00, 'TRD_004'))
conn.commit()
print(f'\nUpdated TRD_004 price → $700.00 ({cur.rowcount} row affected)')

# ─── DELETE ───
cur.execute('DELETE FROM trades WHERE trade_id = ?', ('TRD_006',))
conn.commit()
print(f'Deleted TRD_006 ({cur.rowcount} row affected)')

# ─── Transaction with context manager ───
print('\n=== Transaction Example ===')
try:
    with conn:
        conn.execute('INSERT INTO trades (trade_id, ticker, side, quantity, price) VALUES (?, ?, ?, ?, ?)',
                     ('TRD_007', 'TTE.PA', 'BUY', 150, 58.30))
        conn.execute('INSERT INTO trades (trade_id, ticker, side, quantity, price) VALUES (?, ?, ?, ?, ?)',
                     ('TRD_008', 'BNP.PA', 'BUY', 80, 72.10))
    print('  Transaction committed (2 trades inserted)')
except Exception as e:
    print(f'  Transaction rolled back: {e}')

# Final count
count = cur.execute('SELECT COUNT(*) FROM trades').fetchone()[0]
print(f'\nTotal trades: {count}')

conn.close()
```

    Created table: trades
    Inserted 6 trades
    
    === All Trades ===
      TRD_001 | ASML.AS  | BUY  |   100 | $    685.40 | $   68,540.00 | 2026-03-15
      TRD_002 | MC.PA    | BUY  |    50 | $    890.20 | $   44,510.00 | 2026-03-15
      TRD_003 | SAP.DE   | SELL |    75 | $    245.80 | $   18,435.00 | 2026-03-15
      TRD_004 | ASML.AS  | SELL |    30 | $    690.00 | $   20,700.00 | 2026-03-16
      TRD_005 | RMS.PA   | BUY  |    20 | $  2,850.00 | $   57,000.00 | 2026-03-16
      TRD_006 | SIE.DE   | BUY  |   200 | $    198.50 | $   39,700.00 | 2026-03-17
    
    === ASML Trades Only ===
      TRD_001 | BUY | 100 @ $685.40
      TRD_004 | SELL | 30 @ $690.00
    
    === Portfolio Summary ===
      RMS.PA   |     20 shares | $   57,000.00 | 1 trades
      ASML.AS  |     70 shares | $   47,840.00 | 2 trades
      MC.PA    |     50 shares | $   44,510.00 | 1 trades
      SIE.DE   |    200 shares | $   39,700.00 | 1 trades
      SAP.DE   |    -75 shares | $  -18,435.00 | 1 trades
    
    Updated TRD_004 price → $700.00 (1 row affected)
    Deleted TRD_006 (1 row affected)
    
    === Transaction Example ===
      Transaction committed (2 trades inserted)
    
    Total trades: 7
    

## 2. SQL Server — Index Data (Medallion Architecture)


```python
# SQL Server with pyodbc — connecting to a real index provider database.
#
# KEY CONCEPTS:
# - pyodbc: ODBC driver for Python. Connects to SQL Server, PostgreSQL, etc.
#   C# equivalent: Microsoft.Data.SqlClient (ADO.NET)
# - Connection string: server, database, credentials, encryption settings.
# - Parameterized queries: use ? placeholders (same as SQLite).
# - cursor.description: column names/types from the result set.
#
# DATABASE: stoxx (index provider index data)
# Architecture: Bronze (raw) → Silver (cleaned) → Gold (computed scores)
# Indices: Euro Stoxx 50, STOXX Asia/Pacific 50, STOXX USA 50, Oil & Gas 20
# ~169 stocks, OHLCV history from 2021, daily/quarterly signals, composite scores.

import pyodbc

CONN_STR = (
    'Driver={ODBC Driver 18 for SQL Server};'
    'Server=localhost,1434;'
    'Database=stoxx;'
    'UID=sa;'
    'PWD=EsgDev2026Pass1;'
    'Encrypt=yes;'
    'TrustServerCertificate=yes;'
)

conn = pyodbc.connect(CONN_STR)
cur = conn.cursor()
print('Connected to SQL Server: stoxx database')

# ─── Explore: list tables by schema (bronze/silver/gold) ───
print('\n=== Tables by Schema ===')
cur.execute('''
    SELECT s.name AS schema_name, t.name AS table_name, p.rows
    FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
    ORDER BY s.name, t.name
''')
current_schema = ''
for row in cur.fetchall():
    if row.schema_name != current_schema:
        current_schema = row.schema_name
        print(f'\n  [{current_schema.upper()}]')
    print(f'    {row.table_name:30s} {row.rows:>10,d} rows')

# ─── Index universe: which indices are tracked? ───
print('\n=== Index Universe ===')
cur.execute('SELECT index_key, display_name, currency FROM bronze.dim_index ORDER BY display_name')
for row in cur.fetchall():
    print(f'  {row.index_key:20s} {row.display_name:30s} {row.currency}')

conn.close()
```

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
        trading_calendar                   29,335 rows
    
      [GOLD]
        index_performance                   5,281 rows
        scores_daily                          466 rows
        scores_quarterly                      170 rows
    
      [SILVER]
        eurostoxx50_ohlcv                  66,355 rows
        index_dim                             169 rows
        oil20_ohlcv                        24,738 rows
        signals_daily                         466 rows
        signals_quarterly                     177 rows
        stoxxasia50_ohlcv                  64,045 rows
        stoxxusa50_ohlcv                   65,100 rows
    
    === Index Universe ===
      euro_stoxx_50        Euro Stoxx 50                  €
      oil_20               Oil & Gas 20                   $
      stoxx_asia_50        STOXX Asia/Pacific 50          
      stoxx_usa_50         STOXX USA 50                   $
    


```python
# ─── Real-world index provider queries ───
# These are the types of queries an index provider like index provider runs daily:
# constituent analysis, performance tracking, rebalancing signals.

import pyodbc

conn = pyodbc.connect(
    'Driver={ODBC Driver 18 for SQL Server};'
    'Server=localhost,1434;Database=stoxx;'
    'UID=sa;PWD=EsgDev2026Pass1;'
    'Encrypt=yes;TrustServerCertificate=yes;'
)
cur = conn.cursor()

# ─── 1. Index constituents with sector breakdown ───
print('=== Euro Stoxx 50: Sector Breakdown ===')
cur.execute('''
    SELECT sector, COUNT(*) AS stocks, 
           STRING_AGG(symbol, ', ') AS tickers
    FROM silver.index_dim
    WHERE _index = 'euro_stoxx_50' AND is_current = 1
    GROUP BY sector
    ORDER BY stocks DESC
''')
for row in cur.fetchall():
    print(f'  {row.sector:30s} {row.stocks:>3d}  [{row.tickers[:60]}]')

# ─── 2. Latest OHLCV prices (top movers) ───
print('\n=== Euro Stoxx 50: Latest Prices (Top 10 by Volume) ===')
cur.execute('''
    SELECT TOP 10 o.symbol, d.short_name, o.date, 
           o.[close], o.volume,
           ROUND((o.[close] - o.[open]) / o.[open] * 100, 2) AS day_change_pct
    FROM silver.eurostoxx50_ohlcv o
    JOIN silver.index_dim d ON o.symbol = d.symbol AND d._index = 'euro_stoxx_50'
    WHERE o.date = (SELECT MAX(date) FROM silver.eurostoxx50_ohlcv)
    ORDER BY o.volume DESC
''')
print(f'{"Symbol":10s} {"Name":20s} {"Date":12s} {"Close":>10s} {"Volume":>12s} {"Change%":>8s}')
print('─' * 78)
for row in cur.fetchall():
    print(f'{row.symbol:10s} {(row.short_name or "")[:20]:20s} {str(row.date):12s} '
          f'{row.close:>10,.2f} {row.volume:>12,d} {row.day_change_pct:>+8.2f}%')

# ─── 3. Gold layer: composite stock scores (value + momentum + sentiment) ───
print('\n=== Gold: Top 10 Composite Scores (Euro Stoxx 50) ===')
cur.execute('''
    SELECT TOP 10 symbol, short_name, sector,
           composite_score, composite_rank,
           relative_value_score, momentum_score, sentiment_score,
           current_price, index_weight
    FROM gold.scores_daily
    WHERE _index = 'euro_stoxx_50'
      AND score_date = (SELECT MAX(score_date) FROM gold.scores_daily WHERE _index = 'euro_stoxx_50')
    ORDER BY composite_rank
''')
print(f'{"Rank":>4s} {"Symbol":10s} {"Name":18s} {"Composite":>10s} {"Value":>7s} {"Momentum":>9s} {"Sentiment":>10s} {"Weight":>7s}')
print('─' * 82)
for row in cur.fetchall():
    print(f'{row.composite_rank:>4d} {row.symbol:10s} {(row.short_name or "")[:18]:18s} '
          f'{row.composite_score:>10.4f} {row.relative_value_score:>7.3f} '
          f'{row.momentum_score:>9.3f} {row.sentiment_score:>10.3f} '
          f'{(row.index_weight or 0)*100:>6.2f}%')

# ─── 4. Index performance (gold layer) ───
print('\n=== Gold: Index Performance (Last 5 Trading Days) ===')
cur.execute('''
    SELECT TOP 5 _index, perf_date,
           ROUND(daily_return * 100, 3) AS daily_ret_pct,
           ROUND(ytd_return * 100, 2) AS ytd_pct,
           ROUND(rolling_30d_volatility * 100, 2) AS vol_30d_pct,
           stocks_count, avg_pe, avg_dividend_yield
    FROM gold.index_performance
    WHERE _index = 'euro_stoxx_50'
    ORDER BY perf_date DESC
''')
print(f'{"Date":12s} {"Daily%":>8s} {"YTD%":>8s} {"Vol30d%":>8s} {"#Stocks":>8s} {"Avg PE":>8s} {"DivYld":>7s}')
print('─' * 65)
for row in cur.fetchall():
    print(f'{str(row.perf_date):12s} {row.daily_ret_pct:>+8.3f} {row.ytd_pct:>+8.2f} '
          f'{row.vol_30d_pct:>8.2f} {row.stocks_count:>8d} '
          f'{row.avg_pe or 0:>8.1f} {(row.avg_dividend_yield or 0)*100:>6.2f}%')

# ─── 5. Cross-index comparison ───
print('\n=== Cross-Index: Latest Performance ===')
cur.execute('''
    SELECT p._index, d.display_name,
           ROUND(p.ytd_return * 100, 2) AS ytd_pct,
           ROUND(p.rolling_30d_return * 100, 2) AS ret_30d_pct,
           ROUND(p.rolling_30d_volatility * 100, 2) AS vol_30d_pct,
           p.stocks_count, p.avg_pe
    FROM gold.index_performance p
    JOIN bronze.dim_index d ON p._index = d.index_key
    WHERE p.perf_date = (
        SELECT MAX(perf_date) FROM gold.index_performance WHERE _index = p._index
    )
    ORDER BY ytd_pct DESC
''')
print(f'{"Index":25s} {"YTD%":>8s} {"30d Ret%":>9s} {"30d Vol%":>9s} {"Stocks":>7s} {"Avg PE":>7s}')
print('─' * 70)
for row in cur.fetchall():
    print(f'{row.display_name:25s} {row.ytd_pct:>+8.2f} {row.ret_30d_pct:>+9.2f} '
          f'{row.vol_30d_pct:>9.2f} {row.stocks_count:>7d} {row.avg_pe or 0:>7.1f}')

conn.close()
```

    === Euro Stoxx 50: Sector Breakdown ===
      Financial Services              11  [NDA-FI.HE, ISP.MI, MUV2.DE, INGA.AS, CS.PA, ALV.DE, BBVA.MC,]
      Industrials                     10  [DHL.DE, AIR.PA, DG.PA, RHM.DE, ENR.DE, SAF.PA, SU.PA, SIE.DE]
      Consumer Cyclical                9  [MC.PA, RMS.PA, PRX.AS, RACE.MI, BMW.DE, MBG.DE, VOW.DE, ADS.]
      Technology                       5  [DSY.PA, ADYEN.AS, ASML.AS, SAP.DE, IFX.DE]
      Healthcare                       4  [BAYN.DE, ARGX.BR, EL.PA, SAN.PA]
      Consumer Defensive               4  [AD.AS, BN.PA, OR.PA, ABI.BR]
      Energy                           2  [TTE.PA, ENI.MI]
      Basic Materials                  2  [AI.PA, BAS.DE]
      Utilities                        2  [ENEL.MI, IBE.MC]
      Communication Services           1  [DTE.DE]
    
    === Euro Stoxx 50: Latest Prices (Top 10 by Volume) ===
    Symbol     Name                 Date              Close       Volume  Change%
    ──────────────────────────────────────────────────────────────────────────────
    ISP.MI     INTESA SANPAOLO      2026-03-12         5.20   16,904,468    -1.18%
    SAN.MC     BANCO SANTANDER S.A. 2026-03-12         9.62    8,210,717    -1.82%
    ENEL.MI    ENEL                 2026-03-12         9.36    6,181,446    -1.00%
    ENI.MI     ENI                  2026-03-12        21.34    4,902,953    +0.05%
    BBVA.MC    BANCO BILBAO VIZCAYA 2026-03-12        18.17    4,682,093    -3.09%
    UCG.MI     UNICREDIT            2026-03-12        65.95    2,145,710    -1.86%
    INGA.AS    ING GROEP N.V.       2026-03-12        22.91    1,581,321    -1.76%
    IBE.MC     ACCIONES IBERDROLA   2026-03-12        19.20    1,539,201    +0.29%
    BAS.DE     BASF SE              2026-03-12        47.71    1,483,587    +3.05%
    TTE.PA     TOTALENERGIES        2026-03-12        69.77    1,417,322    -0.34%
    
    === Gold: Top 10 Composite Scores (Euro Stoxx 50) ===
    Rank Symbol     Name                Composite   Value  Momentum  Sentiment  Weight
    ──────────────────────────────────────────────────────────────────────────────────
       1 BNP.PA     BNP PARIBAS ACT.A      0.6796   1.497     0.460      0.081   1.94%
       2 VOW.DE     VOLKSWAGEN AG          0.5756   1.028    -0.382      1.081   0.93%
       3 DTE.DE     DEUTSCHE TELEKOM A     0.4870   0.226     0.706      0.529   3.13%
       4 TTE.PA     TOTALENERGIES          0.3913   0.585     1.307     -0.719   2.95%
       5 ABI.BR     AB INBEV               0.3852   0.251     0.537      0.368   2.43%
       6 IFX.DE     INFINEON TECHNOLOG     0.3487   0.084     0.302      0.661   1.06%
       7 SAN.MC     BANCO SANTANDER S.     0.3106  -0.037     0.450      0.519   2.78%
       8 DG.PA      VINCI                  0.2928   0.957     0.489     -0.568   1.43%
       9 ISP.MI     INTESA SANPAOLO        0.2852   0.553    -0.208      0.511   1.80%
      10 BAYN.DE    Bayer AG               0.2724   0.349     0.642     -0.174   0.77%
    
    === Gold: Index Performance (Last 5 Trading Days) ===
    Date           Daily%     YTD%  Vol30d%  #Stocks   Avg PE  DivYld
    ─────────────────────────────────────────────────────────────────
    2026-03-12     -0.656    -2.39    18.06       50     14.0   2.90%
    2026-03-11     -0.703    -1.75    18.02       50     14.0   2.90%
    2026-03-10     +2.531    -1.05    18.01       50     14.0   2.90%
    2026-03-09     -0.674    -3.49    16.29       50     14.2  15.00%
    2026-03-06     -0.997    -2.84    16.22       49     14.2  15.00%
    
    === Cross-Index: Latest Performance ===
    Index                         YTD%  30d Ret%  30d Vol%  Stocks  Avg PE
    ──────────────────────────────────────────────────────────────────────
    Oil & Gas 20                +27.70    +15.33     21.93      19    16.1
    STOXX Asia/Pacific 50        +5.45     +2.68     23.30      50    15.8
    STOXX USA 50                 +3.71     +0.60     13.32      50    20.8
    Euro Stoxx 50                -2.39     -2.08     18.06      50    14.0
    

## 3. pandas Integration


```python
# pandas + SQL — the standard way to work with database data in Python.
#
# KEY CONCEPTS:
# - pd.read_sql(): execute SQL and return a DataFrame.
# - df.to_sql(): write a DataFrame to a database table.
# - Best practice: pass a SQLAlchemy engine (not raw pyodbc connection).
#   Raw pyodbc works at runtime but triggers Pylance type warnings.

import pandas as pd
from sqlalchemy import create_engine, text
import urllib.parse

odbc_params = urllib.parse.quote_plus(
    'Driver={ODBC Driver 18 for SQL Server};'
    'Server=localhost,1434;Database=stoxx;'
    'UID=sa;PWD=EsgDev2026Pass1;'
    'Encrypt=yes;TrustServerCertificate=yes;'
)
engine = create_engine(f'mssql+pyodbc:///?odbc_connect={odbc_params}')

# ─── Read SQL into DataFrame ───
print('=== OHLCV DataFrame ===')
df = pd.read_sql(text('''
    SELECT symbol, date, [open], high, low, [close], volume
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS'
      AND date >= '2026-01-01'
    ORDER BY date DESC
'''), engine)
print(df.head(10).to_string(index=False))
print(f'\nShape: {df.shape}')

# ─── Analytics with pandas ───
print('\n=== ASML 2026 Stats ===')
print(f"  Mean close:  {df['close'].mean():.2f}")
print(f"  Std close:   {df['close'].std():.2f}")
print(f"  Max volume:  {df['volume'].max():,}")
print(f"  Trading days: {len(df)}")

# ─── Gold scores as DataFrame ───
print('\n=== Gold Scores DataFrame ===')
scores_df = pd.read_sql(text('''
    SELECT symbol, short_name, sector,
           composite_score, composite_rank,
           relative_value_score, momentum_score, sentiment_score,
           current_price, index_weight
    FROM gold.scores_daily
    WHERE _index = 'euro_stoxx_50'
      AND score_date = (SELECT MAX(score_date) FROM gold.scores_daily WHERE _index = 'euro_stoxx_50')
    ORDER BY composite_rank
'''), engine)
print(scores_df[['symbol', 'short_name', 'composite_score', 'composite_rank']].head(10).to_string(index=False))

# ─── Sector aggregation with pandas ───
print('\n=== Sector Average Scores ===')
sector_avg = scores_df.groupby('sector').agg(
    stocks=('symbol', 'count'),
    avg_composite=('composite_score', 'mean'),
    avg_value=('relative_value_score', 'mean'),
    avg_momentum=('momentum_score', 'mean'),
).sort_values('avg_composite', ascending=False)
print(sector_avg.to_string())

engine.dispose()
```

    === OHLCV DataFrame ===
     symbol       date   open   high    low  close  volume
    ASML.AS 2026-03-12 1194.8 1202.2 1187.8 1190.8  128223
    ASML.AS 2026-03-11 1188.4 1210.8 1174.0 1198.8  562904
    ASML.AS 2026-03-10 1188.4 1208.4 1172.2 1200.0  800815
    ASML.AS 2026-03-09 1072.0 1147.6 1060.2 1147.6  689086
    ASML.AS 2026-03-06 1186.0 1192.6 1112.8 1147.0  857271
    ASML.AS 2026-03-05 1198.6 1220.0 1183.0 1186.0  778081
    ASML.AS 2026-03-04 1171.0 1210.8 1167.6 1199.8  714587
    ASML.AS 2026-03-03 1186.6 1187.4 1144.0 1161.8  941945
    ASML.AS 2026-03-02 1192.8 1231.4 1180.0 1210.4  871267
    ASML.AS 2026-02-27 1234.8 1239.8 1201.6 1233.4 1010698
    
    Shape: (50, 7)
    
    === ASML 2026 Stats ===
      Mean close:  1170.42
      Std close:   64.71
      Max volume:  1,388,174
      Trading days: 50
    
    === Gold Scores DataFrame ===
     symbol               short_name  composite_score  composite_rank
     BNP.PA        BNP PARIBAS ACT.A         0.679599               1
     VOW.DE            VOLKSWAGEN AG         0.575610               2
     DTE.DE      DEUTSCHE TELEKOM AG         0.487049               3
     TTE.PA            TOTALENERGIES         0.391287               4
     ABI.BR                 AB INBEV         0.385210               5
     IFX.DE INFINEON TECHNOLOGIES AG         0.348704               6
     SAN.MC     BANCO SANTANDER S.A.         0.310633               7
      DG.PA                    VINCI         0.292751               8
     ISP.MI          INTESA SANPAOLO         0.285183               9
    BAYN.DE                 Bayer AG         0.272386              10
    
    === Sector Average Scores ===
                            stocks  avg_composite     avg_value  avg_momentum
    sector                                                                   
    Communication Services       1       0.487049  2.260062e-01      0.706384
    Energy                       2       0.328570  5.743741e-01      1.642615
    Healthcare                   4       0.081186 -7.001288e-02     -0.372232
    Technology                   5       0.052242  1.278304e-02     -0.653610
    Industrials                 10       0.050393 -4.440892e-17     -0.020382
    Financial Services          11      -0.009482  5.328448e-02      0.160204
    Basic Materials              2      -0.010562  7.408002e-02      0.263210
    Consumer Defensive           4      -0.061023 -5.551115e-17      0.401726
    Consumer Cyclical            9      -0.101304  8.635068e-17     -0.479260
    Utilities                    2      -0.101744  2.387998e-01      0.693479
    

## 4. SQLAlchemy — ORM


```python
# SQLAlchemy — Python's standard ORM and SQL toolkit.
#
# KEY CONCEPTS:
# - Engine: connection factory. create_engine(url) returns an Engine.
#   C# equivalent: IDbConnection / IHttpClientFactory pattern.
# - Connection URL: dialect+driver://user:pass@host:port/db
# - text(): wrap raw SQL strings for parameterized execution.
# - ORM mode: define Python classes that map to tables (like EF Core).
# - Core mode: use SQL expression language (like Dapper).
# - Session: unit of work — tracks changes, commits/rollbacks.
#   C# equivalent: DbContext in Entity Framework.
#
# We use Core mode (raw SQL via text()) here — most common in DE pipelines.
# ORM mode is better for web apps with complex relationships.

from sqlalchemy import create_engine, text
import urllib.parse

# ─── Create engine with ODBC connection ───
# SQLAlchemy uses a URL format. For SQL Server with pyodbc:
# mssql+pyodbc://user:pass@host:port/db?driver=ODBC+Driver+18+for+SQL+Server

odbc_params = urllib.parse.quote_plus(
    'Driver={ODBC Driver 18 for SQL Server};'
    'Server=localhost,1434;Database=stoxx;'
    'UID=sa;PWD=EsgDev2026Pass1;'
    'Encrypt=yes;TrustServerCertificate=yes;'
)
engine = create_engine(f'mssql+pyodbc:///?odbc_connect={odbc_params}')

# ─── Execute raw SQL with text() ───
# text() enables parameterized queries (:param syntax).
# C# equivalent: Dapper conn.Query<T>(sql, new { Param = value })

print('=== SQLAlchemy: Index Universe ===')
with engine.connect() as conn:
    result = conn.execute(text('SELECT index_key, display_name, currency FROM bronze.dim_index ORDER BY display_name'))
    for row in result:
        print(f'  {row.index_key:20s} {row.display_name:30s} {row.currency}')

# ─── Parameterized query with :named params ───
# Different from pyodbc (?) — SQLAlchemy uses :name style.

print('\n=== SQLAlchemy: Top 5 Scores (parameterized) ===')
with engine.connect() as conn:
    result = conn.execute(text('''
        SELECT TOP 5 symbol, short_name, composite_score, composite_rank
        FROM gold.scores_daily
        WHERE _index = :idx
          AND score_date = (SELECT MAX(score_date) FROM gold.scores_daily WHERE _index = :idx)
        ORDER BY composite_rank
    '''), {'idx': 'euro_stoxx_50'})
    for row in result:
        print(f'  {row.composite_rank:>3d} {row.symbol:10s} {(row.short_name or "")[:20]:20s} {row.composite_score:.4f}')

# ─── pandas + SQLAlchemy (preferred over raw pyodbc) ───
# pd.read_sql() works with both pyodbc connections AND SQLAlchemy engines.
# SQLAlchemy is the recommended approach (pyodbc triggers deprecation warnings).

import pandas as pd

print('\n=== pandas + SQLAlchemy ===')
df = pd.read_sql(
    text('SELECT symbol, date, [close], volume FROM silver.eurostoxx50_ohlcv WHERE symbol = :sym AND date >= :dt ORDER BY date DESC'),
    engine,
    params={'sym': 'ASML.AS', 'dt': '2026-03-01'},
)
print(df.head(5).to_string(index=False))
print(f'\nShape: {df.shape}')

# ─── Comparison: pyodbc vs SQLAlchemy ───
print('\n=== pyodbc vs SQLAlchemy ===')
print('''
Feature              pyodbc                SQLAlchemy
───────────────────  ──────────────────    ──────────────────
Level                Low-level (raw SQL)   Toolkit + ORM
Param style          ? positional          :named
Connection           pyodbc.connect()      create_engine()
pandas integration   Direct conn           Preferred (engine)
Transaction          conn.commit()         with conn.begin()
ORM support          No                    Yes (declarative)
C# equivalent        ADO.NET raw           Entity Framework
''')
```

    === SQLAlchemy: Index Universe ===
      euro_stoxx_50        Euro Stoxx 50                  €
      oil_20               Oil & Gas 20                   $
      stoxx_asia_50        STOXX Asia/Pacific 50          
      stoxx_usa_50         STOXX USA 50                   $
    
    === SQLAlchemy: Top 5 Scores (parameterized) ===
        1 BNP.PA     BNP PARIBAS ACT.A    0.6796
        2 VOW.DE     VOLKSWAGEN AG        0.5756
        3 DTE.DE     DEUTSCHE TELEKOM AG  0.4870
        4 TTE.PA     TOTALENERGIES        0.3913
        5 ABI.BR     AB INBEV             0.3852
    
    === pandas + SQLAlchemy ===
     symbol       date  close  volume
    ASML.AS 2026-03-12 1190.8  128223
    ASML.AS 2026-03-11 1198.8  562904
    ASML.AS 2026-03-10 1200.0  800815
    ASML.AS 2026-03-09 1147.6  689086
    ASML.AS 2026-03-06 1147.0  857271
    
    Shape: (9, 4)
    
    === pyodbc vs SQLAlchemy ===
    
    Feature              pyodbc                SQLAlchemy
    ───────────────────  ──────────────────    ──────────────────
    Level                Low-level (raw SQL)   Toolkit + ORM
    Param style          ? positional          :named
    Connection           pyodbc.connect()      create_engine()
    pandas integration   Direct conn           Preferred (engine)
    Transaction          conn.commit()         with conn.begin()
    ORM support          No                    Yes (declarative)
    C# equivalent        ADO.NET raw           Entity Framework
    
    

## 5. Summary


```python
# Summary — Python database cheat sheet
#
# SQLITE (built-in):
# sqlite3.connect(':memory:')            In-memory DB
# sqlite3.connect('file.db')             File-based DB
# conn.row_factory = sqlite3.Row         Dict-like row access
# cur.execute('SELECT ...', (param,))    Parameterized query (?)
# cur.executemany(sql, data_list)         Batch insert
# with conn: ...                          Auto commit/rollback
#
# SQL SERVER (pyodbc):
# pyodbc.connect(conn_str)               Connect to SQL Server
# cur.execute(sql, params)               Parameterized query (?)
# cur.fetchall() / cur.fetchone()        Get results
# cur.description                        Column metadata
#
# PANDAS INTEGRATION:
# pd.read_sql(sql, conn)                 SQL → DataFrame
# df.to_sql('table', conn)               DataFrame → SQL table
#
# SQLALCHEMY:
# create_engine(url)                    Create connection factory
# text('SELECT ... WHERE x = :param')   Parameterized SQL
# conn.execute(text(sql), params)        Execute with named params
# pd.read_sql(text(sql), engine)         DataFrame via SQLAlchemy
# Session()                              ORM unit of work
#
# C# EQUIVALENTS:
# sqlite3            → Microsoft.Data.Sqlite
# pyodbc             → Microsoft.Data.SqlClient (ADO.NET)
# pd.read_sql()      → Dapper / EF Core
# ? placeholder      → @param (named parameters)
# with conn:          → using var transaction = conn.BeginTransaction()
#
# MEDALLION ARCHITECTURE:
# Bronze: raw ingested data (latest batch, minimal transforms)
# Silver: cleaned, deduplicated, SCD-2 tracking, full history
# Gold:   computed scores, aggregated metrics, ready for consumption

```
