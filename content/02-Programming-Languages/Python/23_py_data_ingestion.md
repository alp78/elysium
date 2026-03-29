---
type: reference
category: programming-languages
technology: [python, gcp]
tags: [python, gcp, pipeline, sql, bigquery]
aliases: [Data Ingestion Python, SQL Server Bulk Insert, BigQuery Load]
keywords: [ingestion, bulk insert, bcp, BigQuery load, Firestore batch, GCS, CSV, Parquet, pyodbc, google-cloud-bigquery, benchmark, throughput, latency]
description: "Python data ingestion reference — bulk loading into SQL Server, BigQuery, and Firestore from local and GCS sources with performance benchmarks. See [[23_cs_data_ingestion]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[23_cs_data_ingestion]]"
  - "[[22_py_data_transfer]]"
  - "[[16_py_database]]"
created: 2026-03-28
updated: 2026-03-28
status: complete
---

# 23. Data Ingestion — SQL Server, BigQuery, Firestore

```python
# Suppress tqdm progress bars globally (pandas_gbq uses tqdm internally)
import os
os.environ['TQDM_DISABLE'] = '1'
import warnings
from sqlalchemy import exc

# Suppress SQLAlchemy unrecognized version warnings to keep console output clean
warnings.filterwarnings('ignore', category=exc.SAWarning)
# All imports for data ingestion benchmarking across GCP services

# Standard library
import json
import os
import shutil
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from io import BytesIO, StringIO
from pathlib import Path
from urllib.parse import quote_plus

# Data & serialisation
import pandas as pd
import pandas_gbq
import pyarrow as pa
import pyarrow.parquet as pq

# SQL Server
import pymssql
import pyodbc
from sqlalchemy import create_engine

# Google Cloud
from dotenv import load_dotenv
from google.cloud import bigquery, firestore, storage
from google.cloud import bigquery_connection_v1

# Visualisation
import plotly.graph_objects as go
import plotly.express as px
from IPython.display import display

# Render DataFrames as HTML
html_formatter = get_ipython().display_formatter.formatters['text/html'] # type: ignore
html_formatter.for_type(pd.DataFrame, lambda df: df.to_html())
_ = html_formatter.for_type(pd.Series, lambda s: s.to_frame().to_html())
```

```python
# Load .env and define project constants
load_dotenv(override=True)

# ── Project constants ──
PROJECT_ID    = 'seclab-dev-ap-26'
REGION        = 'europe-west1'
BUCKET_NAME   = f'{PROJECT_ID}-data'
BQ_DATASET    = 'index_data'
FIRESTORE_DB  = 'seclab-scores'
SQL_IP        = os.environ['GCP_SQL_IP']
SQL_PASSWORD  = os.environ['GCP_SQL_PASSWORD']
SA_KEY_PATH   = os.environ.get('GCP_SA_KEY_PATH', './gcp-sa-key.json')
DATA_DIR      = Path(r'C:\Users\aperi\DEV\LANG\data')
CHUNK_SIZE    = 10_000

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = SA_KEY_PATH

# ── Benchmark table/collection names ──
SQL_BENCH_TABLE = 'dbo.ohlcv_bench'
BQ_BENCH_TABLE  = f'{PROJECT_ID}.{BQ_DATASET}.ohlcv_bench'
FS_COLLECTION   = 'ohlcv_bench'

# ── GCP clients (authenticated via service account key) ──
bq_client  = bigquery.Client(project=PROJECT_ID)
gcs_client = storage.Client(project=PROJECT_ID)
bucket     = gcs_client.bucket(BUCKET_NAME)
fs_client  = firestore.Client(project=PROJECT_ID, database=FIRESTORE_DB)

# ── SQL Server connections ──
#
# pymssql: lightweight FreeTDS-based driver, good for quick queries and scripting.
# pyodbc:  ODBC Driver 18 with TLS encryption — production-grade, supports fast_executemany.

def sql_pymssql():
    return pymssql.connect(server=SQL_IP, user='sqlserver', password=SQL_PASSWORD,
                           port='1433', database='stoxx', login_timeout=15)

ODBC_CONN = (
    f'DRIVER={{ODBC Driver 18 for SQL Server}};'
    f'SERVER={SQL_IP},1433;DATABASE=stoxx;'
    f'UID=sqlserver;PWD={SQL_PASSWORD};'
    f'Encrypt=yes;TrustServerCertificate=yes;Connection Timeout=15;'
)
def sql_pyodbc():
    return pyodbc.connect(ODBC_CONN)

# SQLAlchemy engines (for pandas.to_sql / pandas.read_sql)
sql_engine_odbc   = create_engine(f'mssql+pyodbc:///?odbc_connect={quote_plus(ODBC_CONN)}')
sql_engine_pymssql = create_engine(
    f'mssql+pymssql://sqlserver:{quote_plus(SQL_PASSWORD)}@{SQL_IP}/stoxx')

# ── CLI tool paths ──
BCP    = shutil.which('bcp') or 'bcp'
BQ_CLI = shutil.which('bq.cmd') or shutil.which('bq') or 'bq'
GCLOUD = shutil.which('gcloud.cmd') or shutil.which('gcloud') or 'gcloud'

# ── Helpers ──
def _sql_truncate(table):
    """Truncate a SQL Server table before benchmark run."""
    with sql_pymssql() as conn:
        conn.cursor().execute(f'TRUNCATE TABLE {table}')
        conn.commit()

def _fs_delete_collection(collection, batch_size=500):
    """Delete all documents in a Firestore collection in batches to avoid query timeout."""
    deleted = 0
    while True:
        docs = list(fs_client.collection(collection).limit(batch_size).select([]).stream())
        if not docs:
            break
        batch = fs_client.batch()
        for doc in docs:
            batch.delete(doc.reference)
        batch.commit()
        deleted += len(docs)
    return deleted

# ── Test all connections ──
with sql_pymssql() as conn:
    cursor = conn.cursor()
    cursor.execute('SELECT @@VERSION')
    print(f'  SQL Server: {str(cursor.fetchone()[0])[:60]}...')
print(f'  BigQuery:   {BQ_DATASET} ({PROJECT_ID})')
print(f'  Firestore:  {FIRESTORE_DB} ({PROJECT_ID})')
print(f'  GCS:        gs://{BUCKET_NAME}')
```

      SQL Server: Microsoft SQL Server 2022 (RTM-CU23) (KB5078297) - 16.0.4236...
      BigQuery:   index_data (seclab-dev-ap-26)
      Firestore:  seclab-scores (seclab-dev-ap-26)
      GCS:        gs://seclab-dev-ap-26-data

#### Formatting helpers

```python
def fmt_rows(n):
    if n < 1000: return str(n)
    if n < 1_000_000: return f'{n/1000:.1f}K'
    return f'{n/1_000_000:.1f}M'

def fmt_time(ms):
    if ms < 1000: return f'{ms:.0f}ms'
    if ms < 60_000: return f'{ms/1000:.1f}s'
    m, s = divmod(ms / 1000, 60)
    if s == 0: return f'{int(m)}min'
    return f'{int(m)}m{s:.0f}s'

def fmt_size(b):
    if b < 1024: return f'{b} B'
    if b < 1024 * 1024: return f'{b/1024:.0f} KB'
    if b < 1024 ** 3: return f'{b/(1024*1024):.2f} MB'
    return f'{b/(1024**3):.2f} GB'

def fmt_rate(rows, ms):
    if ms <= 0: return '-'
    rate = rows / (ms / 1000)
    if rate < 1000: return f'{rate:.0f} rows/s'
    if rate < 1_000_000: return f'{rate/1000:.1f}K rows/s'
    return f'{rate/1_000_000:.1f}M rows/s'
```

#### Define file tiers for ingestion benchmarks

```python
# Unified OHLCV schema across all three tiers.
# Generated from combined eurostoxx50 + stoxxusa50 + oil20 OHLCV data.
# Schema: id, symbol, date, open, high, low, close, adj_close, volume, dividends, stock_splits, is_filled

OHLCV_COLS = ['id', 'symbol', 'date', 'open', 'high', 'low', 'close',
              'adj_close', 'volume', 'dividends', 'stock_splits', 'is_filled']

tiers = {
    'small':  {'csv': DATA_DIR / 'ingest_small.csv',  'json': DATA_DIR / 'ingest_small.json',  'parquet': DATA_DIR / 'ingest_small.parquet'},
    'medium': {'csv': DATA_DIR / 'ingest_medium.csv', 'json': DATA_DIR / 'ingest_medium.json', 'parquet': DATA_DIR / 'ingest_medium.parquet'},
    'large':  {'csv': DATA_DIR / 'ingest_large.csv',  'json': DATA_DIR / 'ingest_large.json',  'parquet': DATA_DIR / 'ingest_large.parquet'},
}

# Count rows dynamically (header excluded for CSV)
for tier, info in tiers.items():
    with open(info['csv']) as f:
        info['rows'] = sum(1 for _ in f) - 1

gcs_paths = {tier: {fmt: f'bronze/{fmt}/ingest_{tier}.{fmt}'
              for fmt in ['csv', 'json', 'parquet']} for tier in tiers}


tier_summary = pd.DataFrame([
    {
        'tier': tier,
        'rows': f'{info["rows"]:,}',
        'CSV': fmt_size(info['csv'].stat().st_size),
        'JSON': fmt_size(info['json'].stat().st_size),
        'Parquet': fmt_size(info['parquet'].stat().st_size),
    }
    for tier, info in tiers.items()
]).set_index('tier')
display(tier_summary)
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>rows</th>
      <th>CSV</th>
      <th>JSON</th>
      <th>Parquet</th>
    </tr>
    <tr>
      <th>tier</th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>small</th>
      <td>2,500</td>
      <td>190 KB</td>
      <td>468 KB</td>
      <td>130 KB</td>
    </tr>
    <tr>
      <th>medium</th>
      <td>75,000</td>
      <td>5.66 MB</td>
      <td>13.81 MB</td>
      <td>2.96 MB</td>
    </tr>
    <tr>
      <th>large</th>
      <td>750,000</td>
      <td>57.31 MB</td>
      <td>138.85 MB</td>
      <td>18.89 MB</td>
    </tr>
  </tbody>
</table>

#### Ingestion benchmark helper

```python
# Benchmark helper — persists results to JSON, keyed by (method, tier).
INGEST_RESULTS_FILE = DATA_DIR / 'ingestion_results.json'

def _load_results() -> list:
    if INGEST_RESULTS_FILE.exists():
        return json.loads(INGEST_RESULTS_FILE.read_text())
    return []

def _save_results(results: list) -> None:
    INGEST_RESULTS_FILE.write_text(json.dumps(results, indent=2))

ingest_results = _load_results()

def bench_ingest(method_name, ingest_fn, tier_name):
    t0 = time.perf_counter()
    row_count = ingest_fn()
    elapsed_ms = (time.perf_counter() - t0) * 1000
    record = {
        'method': method_name, 'tier': tier_name,
        'rows': row_count, 'rows_fmt': fmt_rows(row_count),
        'elapsed_ms': round(elapsed_ms, 1), 'elapsed': fmt_time(elapsed_ms),
        'rate': fmt_rate(row_count, elapsed_ms),
        'rate_raw': round(row_count / (elapsed_ms / 1000), 1) if elapsed_ms > 0 else 0,
    }
    # Upsert in persistent store
    all_r = _load_results()
    all_r = [r for r in all_r if (r['method'], r['tier']) != (method_name, tier_name)]
    all_r.append(record)
    _save_results(all_r)
    # Upsert in memory
    global ingest_results
    ingest_results = [r for r in ingest_results if (r['method'], r['tier']) != (method_name, tier_name)]
    ingest_results.append(record)
    return record

print(f'  Loaded {len(ingest_results)} existing results from {INGEST_RESULTS_FILE.name}')
```

      Loaded 67 existing results from ingestion_results.json

## Schema Setup

Create unified `ohlcv_bench` staging table in SQL Server and BigQuery.
Same OHLCV schema everywhere. Firestore is schemaless — no setup needed. The SQL Server DDL below follows the same [[bronze-layer-loading]] patterns used in the medallion architecture, while the BigQuery schema aligns with the format decisions documented in [[data-loading-and-export]].

#### pymssql — create staging table in SQL Server

```python
# Single staging table matching the OHLCV schema. All nvarchar (matching existing Cloud SQL pattern).
with sql_pymssql() as conn:
    cursor = conn.cursor()
    cursor.execute('''
        IF OBJECT_ID('dbo.ohlcv_bench', 'U') IS NULL
        CREATE TABLE dbo.ohlcv_bench (
            id         nvarchar(50),
            symbol     nvarchar(50),
            date       nvarchar(50),
            [open]     nvarchar(50),
            high       nvarchar(50),
            low        nvarchar(50),
            [close]    nvarchar(50),
            adj_close  nvarchar(50),
            volume     nvarchar(50),
            dividends  nvarchar(50),
            stock_splits nvarchar(50),
            is_filled  nvarchar(50)
        )
    ''')
    conn.commit()
```

#### google-cloud-bigquery — create staging table in BigQuery

```python
# Typed schema for BigQuery staging table.
BQ_BENCH_TABLE = f'{PROJECT_ID}.{BQ_DATASET}.ohlcv_bench'

bq_schema = [
    bigquery.SchemaField('id', 'INTEGER'),
    bigquery.SchemaField('symbol', 'STRING'),
    bigquery.SchemaField('date', 'DATE'),
    bigquery.SchemaField('open', 'FLOAT'),
    bigquery.SchemaField('high', 'FLOAT'),
    bigquery.SchemaField('low', 'FLOAT'),
    bigquery.SchemaField('close', 'FLOAT'),
    bigquery.SchemaField('adj_close', 'FLOAT'),
    bigquery.SchemaField('volume', 'INTEGER'),
    bigquery.SchemaField('dividends', 'FLOAT'),
    bigquery.SchemaField('stock_splits', 'FLOAT'),
    bigquery.SchemaField('is_filled', 'BOOLEAN'),
]

table = bigquery.Table(BQ_BENCH_TABLE, schema=bq_schema)
table = bq_client.create_table(table, exists_ok=True)
```

## Local → SQL Server Ingestion

#### Insert data from local CSV files into Cloud SQL for SQL Server.
Small tier: `executemany` (baseline). Medium + large: `fast_executemany` vs `bcp`.

#### Ingest CSV into SQL Server from local using pymssql executemany over TDS

Parameterised INSERT, one row per network round-trip. Simple but slow — included as baseline for the small tier only.

`pymssql.executemany()` — simplest ingestion, one round-trip per row. Parameterised queries prevent injection. Works with any SQL Server. **Extremely slow for >5K rows** — use `fast_executemany` or `bcp` instead.

```python
def pymssql_executemany():
    _sql_truncate('ohlcv_bench')
    df = pd.read_csv(tiers['small']['csv'], dtype=str, keep_default_na=False)
    cols = ', '.join(f'[{c}]' for c in df.columns)
    placeholders = ', '.join(['%s'] * len(df.columns))
    sql = f'INSERT INTO dbo.ohlcv_bench ({cols}) VALUES ({placeholders})'
    rows = [tuple(r) for r in df.values]
    with sql_pymssql() as conn:
        cursor = conn.cursor()
        cursor.executemany(sql, rows)
        conn.commit()
    return len(rows)

r = bench_ingest('pymssql_executemany', pymssql_executemany, 'small')
print(f'  small    {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      small        2.5K      59.5s      42 rows/s

#### Ingest CSV into SQL Server from local using pyodbc fast_executemany over ODBC Driver 18 (TLS)

Packs all rows into a single TDS packet. ODBC Driver 18 with TLS encryption. 5-10x faster than plain `executemany`.

`fast_executemany=True` packs all rows into a single TDS packet per chunk — 5–10x faster. ODBC Driver 18 with TLS. Chunk at 10K rows to avoid timeouts. For >1M rows, `bcp` is 2–5x faster.

> [!warning] Always chunk large datasets — sending all rows in one `executemany()` causes `Communication link failure`. Always set `fast_executemany=True` — without it, falls back to row-by-row.

```python
def pyodbc_fast(tier):
    _sql_truncate('ohlcv_bench')
    df = pd.read_csv(tiers[tier]['csv'], dtype=str, keep_default_na=False)
    cols = ', '.join(f'[{c}]' for c in df.columns)
    placeholders = ', '.join(['?'] * len(df.columns))
    sql = f'INSERT INTO dbo.ohlcv_bench ({cols}) VALUES ({placeholders})'
    rows = [tuple(r) for r in df.values]
    with sql_pyodbc() as conn:
        cursor = conn.cursor()
        cursor.fast_executemany = True
        for start in range(0, len(rows), CHUNK_SIZE):
            cursor.executemany(sql, rows[start:start + CHUNK_SIZE])
        conn.commit()
    return len(rows)

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')
for tier in tiers:
    r = bench_ingest('pyodbc_fast_executemany', lambda t=tier: pyodbc_fast(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K       1.5s    1.7K rows/s
      medium      75.0K       5.7s   13.0K rows/s
      large      750.0K      54.4s   13.8K rows/s

#### Ingest CSV into SQL Server from local using bcp (Bulk Copy Program) over TDS

The `bcp` CLI is the fastest bulk loader for SQL Server. Native TDS bulk-insert protocol — bypasses the SQL parser entirely. Production standard for ETL pipelines.

`bcp` streams rows via native TDS bulk-insert protocol — bypasses SQL parser, writes directly to table pages. 10–50x faster than row-by-row. Always use `-F 2` (skip header), `-b 10000` (batch size for recovery).

> [!warning] Don't hardcode passwords in CLI args — use `-T` (trusted) or env vars. Don't skip `-b` (batch size) — one failed row rolls back the entire load.

```python
BCP = shutil.which('bcp') or 'bcp'

def bcp_import(tier):
    _sql_truncate('ohlcv_bench')
    result = subprocess.run([
        BCP, 'dbo.ohlcv_bench', 'in', str(tiers[tier]['csv']),
        '-S', f'{SQL_IP},1433', '-U', 'sqlserver', '-P', SQL_PASSWORD,
        '-d', 'stoxx', '-c', '-t', ',', '-F', '2', '-b', '10000', '-u',  # -u = trust server cert (Cloud SQL self-signed)
    ], capture_output=True, text=True)
    if result.returncode != 0:
        print(f'    bcp error: {result.stdout[:200]} {result.stderr[:200]}')
        return 0
    for line in result.stdout.splitlines():
        if 'rows copied' in line.lower():
            return int(line.split()[0])
    return tiers[tier]['rows']

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')
for tier in tiers:
    r = bench_ingest('bcp_import', lambda t=tier: bcp_import(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K      770ms    3.2K rows/s
      medium      75.0K       2.7s   28.1K rows/s
      large      750.0K      21.0s   35.7K rows/s

#### Ingest JSON into SQL Server from local using pyodbc fast_executemany over ODBC Driver 18 (TLS)

Reads newline-delimited JSON with pandas, then inserts via `fast_executemany`. Same TLS-encrypted ODBC path as CSV.

Reads newline-delimited JSON with pandas, converts to strings, inserts via `fast_executemany`. Handles nested/optional fields. JSON nulls become NaN — must `fillna` before INSERT.

```python
def json_to_sql(tier):
    _sql_truncate('ohlcv_bench')
    df = pd.read_json(tiers[tier]['json'], lines=True, dtype=str)
    df = df.fillna('')
    cols = ', '.join(f'[{c}]' for c in df.columns)
    placeholders = ', '.join(['?'] * len(df.columns))
    sql = f'INSERT INTO dbo.ohlcv_bench ({cols}) VALUES ({placeholders})'
    rows = [tuple(r) for r in df.values]
    with sql_pyodbc() as conn:
        cursor = conn.cursor()
        cursor.fast_executemany = True
        for start in range(0, len(rows), CHUNK_SIZE):
            cursor.executemany(sql, rows[start:start + CHUNK_SIZE])
        conn.commit()
    return len(rows)

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')
for tier in tiers:
    r = bench_ingest('json_to_sql_fast', lambda t=tier: json_to_sql(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K      722ms    3.5K rows/s
      medium      75.0K       6.2s   12.2K rows/s
      large      750.0K      59.0s   12.7K rows/s

#### Ingest Parquet into SQL Server from local using pyodbc fast_executemany over ODBC Driver 18 (TLS)

Reads Parquet with pyarrow (fastest local parse), then inserts via `fast_executemany`. Parquet’s columnar format makes the read near-instant.

Reads Parquet with pyarrow (zero-copy columnar, near-instant), then inserts via `fast_executemany`. Parquet's schema is embedded — no column mapping errors. Smallest file size = less disk I/O.

```python
def parquet_to_sql(tier):
    _sql_truncate('ohlcv_bench')
    df = pd.read_parquet(tiers[tier]['parquet']).astype(str)
    df = df.replace('nan', '').replace('None', '')
    cols = ', '.join(f'[{c}]' for c in df.columns)
    placeholders = ', '.join(['?'] * len(df.columns))
    sql = f'INSERT INTO dbo.ohlcv_bench ({cols}) VALUES ({placeholders})'
    rows = [tuple(r) for r in df.values]
    with sql_pyodbc() as conn:
        cursor = conn.cursor()
        cursor.fast_executemany = True
        for start in range(0, len(rows), CHUNK_SIZE):
            cursor.executemany(sql, rows[start:start + CHUNK_SIZE])
        conn.commit()
    return len(rows)

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')
for tier in tiers:
    r = bench_ingest('parquet_to_sql_fast', lambda t=tier: parquet_to_sql(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K      837ms    3.0K rows/s
      medium      75.0K       5.8s   12.9K rows/s
      large      750.0K      55.2s   13.6K rows/s

#### Ingest CSV into SQL Server using BULK INSERT (T-SQL) and SSMS Import Wizard (reference)

**BULK INSERT**: Native T-SQL command. Requires the file to be accessible from the server filesystem — not supported on Cloud SQL (server can't read client-side files). Use `bcp` instead.

**SSMS / Azure Data Studio Import Wizard**: Graphical import via right-click → Tasks → Import Flat File. Best for ad-hoc one-off imports under 100K rows. Not benchmarkable from a notebook.

## Local → BigQuery Ingestion

Load data from local files into BigQuery. Three formats (CSV, JSON, Parquet),
plus `bq` CLI and Storage Write API.

#### Ingest CSV into BigQuery from local using google-cloud-bigquery load_table_from_file over HTTPS

Server parses CSV rows. `skip_leading_rows=1` for header. `WRITE_TRUNCATE` clears before load.

Uploads CSV to BigQuery's load job API over HTTPS. Server-side parsing, atomic (fully succeeds or fails). Always set `skip_leading_rows=1`. Use explicit schema in production (not autodetect). For large files, use Parquet (5x compression) or GCS staging.

```python
def bq_load_csv(tier):
    path = DATA_DIR / f'ingest_{tier}.csv'
    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.CSV,
        skip_leading_rows=1,
        autodetect=True,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )
    with open(path, 'rb') as f:
        job = bq_client.load_table_from_file(f, BQ_BENCH_TABLE, job_config=job_config)
    job.result()
    return job.output_rows

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')
for tier in tiers:
    r = bench_ingest('bq_load_csv', lambda t=tier: bq_load_csv(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K       3.1s     815 rows/s
      medium      75.0K       6.8s   11.1K rows/s
      large      750.0K      22.7s   33.1K rows/s

#### Ingest JSON into BigQuery from local using google-cloud-bigquery load_table_from_file over HTTPS

Server parses newline-delimited JSON. Auto-detects schema from keys.

NDJSON (one JSON object per line) — handles nested/repeated fields natively. Schema auto-detected from keys. Use for API dumps or nested data. For flat tabular data, CSV/Parquet is 3–5x smaller.

```python
def bq_load_json(tier):
    path = DATA_DIR / f'ingest_{tier}.json'
    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        autodetect=True,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )
    with open(path, 'rb') as f:
        job = bq_client.load_table_from_file(f, BQ_BENCH_TABLE, job_config=job_config)
    job.result()
    return job.output_rows

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')
for tier in tiers:
    r = bench_ingest('bq_load_json', lambda t=tier: bq_load_json(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K       4.5s     554 rows/s
      medium      75.0K       7.3s   10.3K rows/s
      large      750.0K      27.7s   27.1K rows/s

#### Ingest Parquet into BigQuery from local using google-cloud-bigquery load_table_from_file over HTTPS

Fastest format — columnar, compressed, schema embedded. No parsing overhead.

Parquet schema maps directly to BQ schema — no parsing, no autodetect needed. Snappy compression = smallest upload. Type-safe end-to-end. BigQuery-recommended format for production pipelines.

```python
def bq_load_parquet(tier):
    path = DATA_DIR / f'ingest_{tier}.parquet'
    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.PARQUET,

        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )
    with open(path, 'rb') as f:
        job = bq_client.load_table_from_file(f, BQ_BENCH_TABLE, job_config=job_config)
    job.result()
    return job.output_rows

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')
for tier in tiers:
    r = bench_ingest('bq_load_parquet', lambda t=tier: bq_load_parquet(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K       2.8s     884 rows/s
      medium      75.0K       3.6s   20.8K rows/s
      large      750.0K       8.3s   90.2K rows/s

#### Ingest CSV into BigQuery from local using bq CLI bq load over HTTPS

Command-line tool — same load job API but no Python code needed.

`bq load` — same load job API as Python but no code needed. Just the gcloud SDK. Good for shell scripts, CI/CD, and one-off loads.

```python
BQ_CMD = shutil.which('bq.cmd') or shutil.which('bq') or 'bq'

def bq_cli_csv(tier):
    table_id = f'{BQ_DATASET}.ohlcv_bench'
    result = subprocess.run([
        BQ_CMD, 'load', '--source_format=CSV', '--skip_leading_rows=1',
        '--autodetect', '--replace', f'--project_id={PROJECT_ID}',
        table_id, str(tiers[tier]['csv']),
    ], capture_output=True, text=True)
    if result.returncode != 0:
        print(f'    bq error: {result.stderr[:200]}')
        return 0
    return tiers[tier]['rows']

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')
for tier in tiers:
    r = bench_ingest('bq_cli_csv', lambda t=tier: bq_cli_csv(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K       9.0s     278 rows/s
      medium      75.0K       7.9s    9.5K rows/s
      large      750.0K      19.7s   38.0K rows/s

#### Ingest data into BigQuery using pandas-gbq Storage Write API over gRPC

Highest throughput for streaming ingestion. `pandas_gbq.to_gbq()` uses the Storage Write API when available.

`pandas_gbq.to_gbq()` uses the Storage Write API (gRPC) — writes directly to BQ storage with row-level acknowledgment and exactly-once semantics. Highest throughput for streaming. For batch loads, load jobs are simpler.

```python
def bq_storage_write(tier):
    df = pd.read_csv(tiers[tier]['csv'])
    pandas_gbq.to_gbq(df, f'{BQ_DATASET}.ohlcv_bench', project_id=PROJECT_ID, if_exists='replace')
    return len(df)

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')
for tier in tiers:
    r = bench_ingest('bq_storage_write', lambda t=tier: bq_storage_write(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K       4.7s     527 rows/s
      medium      75.0K       4.0s   18.8K rows/s
      large      750.0K      11.8s   63.6K rows/s

#### Query data from GCS without loading using BigQuery External Tables over internal network

Query CSV/JSON/Parquet in GCS directly via SQL. Zero ingestion time — slower queries but no storage cost.

External table points to a GCS file — queries read directly at query time. Zero ingestion, zero storage cost. 10–100x slower than native tables. Use for ad-hoc exploration; not for production dashboards.

```python
def bq_external_table(tier):
    ext_table = f'{PROJECT_ID}.{BQ_DATASET}.ohlcv_bench_ext'
    uri = f'gs://{BUCKET_NAME}/{gcs_paths[tier]["parquet"]}'
    ext_config = bigquery.ExternalConfig('PARQUET')
    ext_config.source_uris = [uri]
    table = bigquery.Table(ext_table)
    table.external_data_configuration = ext_config
    table = bq_client.create_table(table, exists_ok=True)
    result = bq_client.query(f'SELECT COUNT(*) as cnt FROM `{ext_table}`').result()
    row_count = list(result)[0].cnt
    bq_client.delete_table(ext_table, not_found_ok=True)
    return row_count

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')
for tier in tiers:
    r = bench_ingest('bq_external_table', lambda t=tier: bq_external_table(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K       1.1s    2.2K rows/s
      medium      75.0K       1.2s   64.1K rows/s
      large      750.0K       9.7s   77.6K rows/s

#### Ingest data into BigQuery using Google Cloud Console Web UI (reference)

Console → BigQuery → Dataset → Create Table → Upload (up to 10 MB) or Google Cloud Storage.
Not benchmarkable from a notebook.

## Local → Firestore Ingestion

Write OHLCV data into Firestore. Each row becomes a document in the `ohlcv_bench` collection.

#### Ingest CSV into Firestore from local using google-cloud-firestore batch.set over gRPC

500-doc batches (Firestore limit). Each batch is a single gRPC call.

500-doc batches (Firestore's limit). Each `batch.commit()` is a single atomic gRPC call. Simple API. For >50K docs, `BulkWriter` is 2–5x faster (parallel batches).

> [!warning] Don't exceed 500 docs per batch (rejected). Don't forget to commit the final partial batch.

```python
def fs_batch_write(tier):
    df = pd.read_csv(tiers[tier]['csv'], dtype=str, keep_default_na=False)
    batch = fs_client.batch()
    count = 0
    for idx, row in df.iterrows():
        doc_ref = fs_client.collection(FS_COLLECTION).document(str(idx))
        batch.set(doc_ref, row.to_dict())
        count += 1
        if count % 500 == 0:
            batch.commit()
            batch = fs_client.batch()
    if count % 500 != 0:
        batch.commit()
    return count

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')

# Benchmark standard batches
for tier in tiers:
    # No delete — set() overwrites existing docs by ID, avoiding costly collection scan
    r = bench_ingest('fs_batch', lambda t=tier: fs_batch_write(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K       6.7s     372 rows/s
      medium      75.0K      3m21s     372 rows/s
      large      750.0K     31m13s     400 rows/s

#### Ingest CSV into Firestore from local using google-cloud-firestore BulkWriter over gRPC

`BulkWriter` manages batching, retries, and throttling automatically. Parallel writes — the recommended method for bulk ingestion.

`BulkWriter` manages batching, retries, and rate limiting automatically. 2–5x faster than manual `batch.set()`. Use for 10K–500K document migrations/backfills. Always call `bw.close()` — unflushed writes are lost.

```python
def fs_bulk_write(tier):
    df = pd.read_csv(tiers[tier]['csv'], dtype=str, keep_default_na=False)
    bw = fs_client.bulk_writer()
    count = 0
    for idx, row in df.iterrows():
        doc_ref = fs_client.collection(FS_COLLECTION).document(str(idx))
        bw.set(doc_ref, row.to_dict())
        count += 1
    bw.close()
    return count

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')

# Benchmark BulkWriter
for tier in tiers:
    # No delete — set() overwrites existing docs by ID, avoiding costly collection scan
    r = bench_ingest('fs_bulkwriter', lambda t=tier: fs_bulk_write(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K       4.1s     604 rows/s
      medium      75.0K      2m31s     497 rows/s
      large      750.0K     25m11s     496 rows/s

#### Import data into Firestore from GCS using gcloud firestore import and Console UI (reference)

**gcloud firestore export/import**: Managed backup/restore from GCS. Server-side, fastest for large restores.

**Firebase/GCP Console**: Manual document creation or import from managed exports.

Both require managed export format (not raw CSV/JSON).

## GCS → BigQuery Ingestion

Server-side operation — no data passes through the local machine.

#### Ingest CSV into BigQuery from GCS using google-cloud-bigquery load_table_from_uri over internal network

Server-side CSV parse. Data flows GCS → BigQuery within Google’s network.

`load_table_from_uri` triggers a server-side load — data flows GCS → BQ within Google's network, no local bandwidth. Supports wildcards (`gs://bucket/path/*.csv`). Standard data lake pattern.

```python
def bq_gcs_csv(tier):
    uri = f'gs://{BUCKET_NAME}/{gcs_paths[tier]["csv"]}'
    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.CSV,
        skip_leading_rows=1,
        autodetect=True,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )
    job = bq_client.load_table_from_uri(uri, BQ_BENCH_TABLE, job_config=job_config)
    job.result()
    return job.output_rows

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')
for tier in tiers:
    r = bench_ingest('bq_gcs_csv', lambda t=tier: bq_gcs_csv(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K       3.2s     775 rows/s
      medium      75.0K       4.8s   15.7K rows/s
      large      750.0K      13.0s   57.9K rows/s

#### Ingest JSON into BigQuery from GCS using google-cloud-bigquery load_table_from_uri over internal network

Server-side JSON parse. Same internal network path.

```python
# BigQuery load from GCS JSON
def bq_gcs_json(tier):
    uri = f'gs://{BUCKET_NAME}/{gcs_paths[tier]["json"]}'
    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        autodetect=True,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )
    job = bq_client.load_table_from_uri(uri, BQ_BENCH_TABLE, job_config=job_config)
    job.result()
    return job.output_rows

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')
for tier in tiers:
    r = bench_ingest('bq_gcs_json', lambda t=tier: bq_gcs_json(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K       4.1s     614 rows/s
      medium      75.0K       6.6s   11.3K rows/s
      large      750.0K      17.6s   42.6K rows/s

#### Ingest Parquet into BigQuery from GCS using google-cloud-bigquery load_table_from_uri over internal network

Fastest — columnar, compressed, schema embedded.

```python
# BigQuery load from GCS Parquet
def bq_gcs_parquet(tier):
    uri = f'gs://{BUCKET_NAME}/{gcs_paths[tier]["parquet"]}'
    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.PARQUET,

        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )
    job = bq_client.load_table_from_uri(uri, BQ_BENCH_TABLE, job_config=job_config)
    job.result()
    return job.output_rows

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')
for tier in tiers:
    r = bench_ingest('bq_gcs_parquet', lambda t=tier: bq_gcs_parquet(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K       2.5s    1.0K rows/s
      medium      75.0K       2.9s   26.1K rows/s
      large      750.0K       7.6s   98.9K rows/s

## GCS → SQL Server Ingestion

Two-hop: download from GCS to memory, then insert into SQL Server.

#### Ingest CSV into SQL Server from GCS using google-cloud-storage download + pyodbc fast_executemany over HTTPS + TLS

Download CSV → pandas → fast_executemany. Combined pipeline.

Two-hop: download CSV from GCS into memory (BytesIO), parse with pandas, insert via `fast_executemany` in 10K-row chunks. No direct GCS→SQL path exists. For GB-scale, use VM-hosted SQL Server or Dataflow instead.

```python
def gcs_csv_to_sql(tier):
    _sql_truncate('ohlcv_bench')
    blob = bucket.blob(gcs_paths[tier]['csv'])
    csv_bytes = blob.download_as_bytes()
    df = pd.read_csv(BytesIO(csv_bytes), dtype=str, keep_default_na=False)
    cols = ', '.join(f'[{c}]' for c in df.columns)
    placeholders = ', '.join(['?'] * len(df.columns))
    sql = f'INSERT INTO dbo.ohlcv_bench ({cols}) VALUES ({placeholders})'
    rows = [tuple(r) for r in df.values]
    with sql_pyodbc() as conn:
        cursor = conn.cursor()
        cursor.fast_executemany = True
        for start in range(0, len(rows), CHUNK_SIZE):
            cursor.executemany(sql, rows[start:start + CHUNK_SIZE])
        conn.commit()
    return len(rows)

print(f'  {"tier":<8s} {"rows":>8s} {"time":>10s} {"rate":>14s}')
for tier in tiers:
    r = bench_ingest('gcs_csv_to_sql', lambda t=tier: gcs_csv_to_sql(t), tier)
    print(f'  {tier:<8s} {r["rows_fmt"]:>8s} {r["elapsed"]:>10s} {r["rate"]:>14s}')
```

      tier         rows       time           rate
      small        2.5K       2.2s    1.1K rows/s
      medium      75.0K       6.5s   11.5K rows/s
      large      750.0K      56.2s   13.3K rows/s

## Cross-Service Transfers

Move data between SQL Server, BigQuery, and Firestore.

#### Transfer data from SQL Server to BigQuery using pymssql query + load_table_from_dataframe over TDS + HTTPS

Query SQL Server → DataFrame → BigQuery. Two-hop via local memory.

```python
# SQL Server → BigQuery — self-populates SQL Server first, then transfers
#
# Step 1: Load CSV into SQL Server (ensures correct row count per tier)
# Step 2: Query SQL Server into DataFrame, load into BigQuery

def sql_to_bq(tier):
    # Step 1: populate SQL Server with this tier's data
    _sql_truncate('ohlcv_bench')
    df = pd.read_csv(tiers[tier]['csv'], dtype=str, keep_default_na=False)
    df.to_sql('ohlcv_bench', con=sql_engine_pymssql, schema='dbo', if_exists='append', index=False)

    # Step 2: read from SQL Server, load into BigQuery
    query = f'SELECT TOP {tiers[tier]["rows"]} * FROM dbo.ohlcv_bench'
    df2 = pd.read_sql(query, con=sql_engine_pymssql)
    job_config = bigquery.LoadJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        autodetect=True
    )
    job = bq_client.load_table_from_dataframe(df2, BQ_BENCH_TABLE, job_config=job_config)
    job.result()
    return job.output_rows

print(f"  {'tier':<8s} {'rows':>8s} {'time':>10s} {'rate':>14s}")
for tier in tiers:
    r = bench_ingest('sql_to_bq', lambda t=tier: sql_to_bq(t), tier)
    print(f"  {tier:<8s} {r['rows_fmt']:>8s} {r['elapsed']:>10s} {r['rate']:>14s}")
```

      tier         rows       time           rate
      small        2.5K       7.4s     340 rows/s
      medium      75.0K      51.8s    1.4K rows/s
      large      750.0K      8m19s    1.5K rows/s

#### Transfer data from BigQuery to SQL Server using google-cloud-bigquery query + pyodbc fast_executemany over HTTPS + TLS

Query BigQuery → DataFrame → SQL Server.

```python
# BigQuery → SQL Server — self-populates BigQuery first, then transfers

def bq_to_sql(tier):
    # Step 1: populate BigQuery with this tier's data
    df = pd.read_csv(tiers[tier]['csv'], dtype=str, keep_default_na=False)
    job_config = bigquery.LoadJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        autodetect=True
    )
    job = bq_client.load_table_from_dataframe(df, BQ_BENCH_TABLE, job_config=job_config)
    job.result()

    # Step 2: query BigQuery, insert into SQL Server
    _sql_truncate('ohlcv_bench')
    results = bq_client.query(f'SELECT * FROM `{PROJECT_ID}.{BQ_DATASET}.ohlcv_bench`')
    rows = [dict(row) for row in results]
    df2 = pd.DataFrame(rows).astype(str)
    df2.to_sql('ohlcv_bench', con=sql_engine_pymssql, schema='dbo', if_exists='append', index=False)
    return len(rows)

print(f"  {'tier':<8s} {'rows':>8s} {'time':>10s} {'rate':>14s}")
for tier in tiers:
    r = bench_ingest('bq_to_sql', lambda t=tier: bq_to_sql(t), tier)
    print(f"  {tier:<8s} {r['rows_fmt']:>8s} {r['elapsed']:>10s} {r['rate']:>14s}")
```

      tier         rows       time           rate
      small        2.5K       5.5s     451 rows/s
      medium      75.0K      57.4s    1.3K rows/s
      large      750.0K      8m34s    1.5K rows/s

#### Transfer data from BigQuery to Firestore using google-cloud-bigquery query + BulkWriter over HTTPS + gRPC

Query BigQuery → iterate results → Firestore BulkWriter. For real-time serving of scored data.

```python
# BigQuery → Firestore — self-populates BigQuery first, then transfers

def bq_to_fs(tier):
    # Step 1: populate BigQuery with this tier's data
    df = pd.read_csv(tiers[tier]['csv'], dtype=str, keep_default_na=False)
    job_config = bigquery.LoadJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        autodetect=True
    )
    job = bq_client.load_table_from_dataframe(df, BQ_BENCH_TABLE, job_config=job_config)
    job.result()

    # Step 2: query BigQuery, write to Firestore
    results = bq_client.query(f'SELECT * FROM `{PROJECT_ID}.{BQ_DATASET}.ohlcv_bench`')
    bw = fs_client.bulk_writer()
    count = 0
    for row in results:
        doc_ref = fs_client.collection(FS_COLLECTION).document(str(count))
        bw.set(doc_ref, {k: str(v) for k, v in dict(row).items()})
        count += 1
    bw.close()
    return count

print(f"  {'tier':<8s} {'rows':>8s} {'time':>10s} {'rate':>14s}")
for tier in tiers:
    r = bench_ingest('bq_to_fs', lambda t=tier: bq_to_fs(t), tier)
    print(f"  {tier:<8s} {r['rows_fmt']:>8s} {r['elapsed']:>10s} {r['rate']:>14s}")
```

      tier         rows       time           rate
      small        2.5K       8.9s     282 rows/s
      medium      75.0K      2m41s     466 rows/s
      large      750.0K     25m52s     483 rows/s

#### Transfer data from SQL Server to Firestore using pymssql query + BulkWriter over TDS + gRPC

Direct SQL Server → Firestore bridge.

```python
# SQL Server → Firestore — self-populates SQL Server first, then transfers

def sql_to_fs(tier):
    # Step 1: populate SQL Server with this tier's data
    _sql_truncate('ohlcv_bench')
    df = pd.read_csv(tiers[tier]['csv'], dtype=str, keep_default_na=False)
    df.to_sql('ohlcv_bench', con=sql_engine_pymssql, schema='dbo', if_exists='append', index=False)

    # Step 2: query SQL Server, write to Firestore
    with sql_pymssql() as conn:
        cursor = conn.cursor(as_dict=True)
        cursor.execute(f'SELECT TOP {tiers[tier]["rows"]} * FROM dbo.ohlcv_bench')
        bw = fs_client.bulk_writer()
        count = 0
        for row in cursor:
            doc_ref = fs_client.collection(FS_COLLECTION).document(str(count))
            bw.set(doc_ref, {k: str(v) for k, v in row.items()})
            count += 1
        bw.close()
    return count

print(f"  {'tier':<8s} {'rows':>8s} {'time':>10s} {'rate':>14s}")
for tier in tiers:
    r = bench_ingest('sql_to_firestore', lambda t=tier: sql_to_fs(t), tier)
    print(f"  {tier:<8s} {r['rows_fmt']:>8s} {r['elapsed']:>10s} {r['rate']:>14s}")
```

      tier         rows       time           rate
      small        2.5K       6.5s     387 rows/s
      medium      75.0K      3m16s     383 rows/s
      large      750.0K     32m51s     381 rows/s

#### Transfer data from SQL Server to BigQuery via GCS staging using pandas + GCS + load_table_from_uri

Production pattern: SQL → Parquet → GCS → BigQuery. Avoids local memory bottleneck for large datasets.

```python
# SQL Server → GCS → BigQuery — self-populates SQL Server first

def sql_to_bq_gcs(tier):
    # Step 1: populate SQL Server with this tier's data
    _sql_truncate('ohlcv_bench')
    df = pd.read_csv(tiers[tier]['csv'], dtype=str, keep_default_na=False)
    df.to_sql('ohlcv_bench', con=sql_engine_pymssql, schema='dbo', if_exists='append', index=False)

    # Step 2: query SQL Server, write CSV to GCS, load into BigQuery
    query = f'SELECT TOP {tiers[tier]["rows"]} * FROM dbo.ohlcv_bench'
    df2 = pd.read_sql(query, con=sql_engine_pymssql)
    gcs_path = f'staging/sql_to_bq_{tier}.csv'
    blob = bucket.blob(gcs_path)
    blob.upload_from_string(df2.to_csv(index=False), content_type='text/csv')
    uri = f'gs://{BUCKET_NAME}/{gcs_path}'
    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.CSV,
        skip_leading_rows=1,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        autodetect=True
    )
    job = bq_client.load_table_from_uri(uri, BQ_BENCH_TABLE, job_config=job_config)
    job.result()
    blob.delete()
    return job.output_rows

print(f"  {'tier':<8s} {'rows':>8s} {'time':>10s} {'rate':>14s}")
for tier in tiers:
    r = bench_ingest('sql_to_bq_gcs', lambda t=tier: sql_to_bq_gcs(t), tier)
    print(f"  {tier:<8s} {r['rows_fmt']:>8s} {r['elapsed']:>10s} {r['rate']:>14s}")
```

      tier         rows       time           rate
      small        2.5K       6.5s     382 rows/s
      medium      75.0K      54.4s    1.4K rows/s
      large      750.0K       8m7s    1.5K rows/s

## Export

Export data from SQL Server, BigQuery, and Firestore.

#### Export SQL Server to CSV using pandas read_sql + to_csv over TDS

Query into DataFrame, write to local CSV.

```python
EXPORT_DIR = DATA_DIR / 'exports'
EXPORT_DIR.mkdir(exist_ok=True)

def sql_export(tier):
    query = f'SELECT TOP {tiers[tier]["rows"]} * FROM dbo.ohlcv_bench'
    df = pd.read_sql(query, con=sql_engine_pymssql)
    df.to_csv(EXPORT_DIR / f'export_{tier}.csv', index=False)
    return len(df)

print(f"  {'tier':<8s} {'rows':>8s} {'time':>10s} {'rate':>14s}")
for tier in tiers:
    r = bench_ingest('sql_export_csv', lambda t=tier: sql_export(t), tier)
    print(f"  {tier:<8s} {r['rows_fmt']:>8s} {r['elapsed']:>10s} {r['rate']:>14s}")
```

      tier         rows       time           rate
      small        2.5K      131ms   19.1K rows/s
      medium      75.0K      800ms   93.7K rows/s
      large      750.0K       6.5s  114.7K rows/s

#### Export BigQuery to GCS using google-cloud-bigquery extract_table over internal network

Server-side export — BigQuery writes directly to GCS.

```python
def bq_export(tier):
    row_limit = tiers[tier]['rows']
    # Create a temp table with the correct row count
    temp_table = f'{PROJECT_ID}.{BQ_DATASET}.export_temp_{tier}'
    query = f'CREATE OR REPLACE TABLE `{temp_table}` AS SELECT * FROM `{PROJECT_ID}.{BQ_DATASET}.ohlcv_bench` LIMIT {row_limit}'
    bq_client.query(query).result()
    dest_uri = f'gs://{BUCKET_NAME}/exports/ohlcv_{tier}.csv'
    job_config = bigquery.ExtractJobConfig(destination_format=bigquery.DestinationFormat.CSV)
    job = bq_client.extract_table(temp_table, dest_uri, job_config=job_config)
    job.result()
    row_count = bq_client.get_table(temp_table).num_rows
    bq_client.delete_table(temp_table, not_found_ok=True)
    return row_count

print(f"  {'tier':<8s} {'rows':>8s} {'time':>10s} {'rate':>14s}")
for tier in tiers:
    r = bench_ingest('bq_export_gcs', lambda t=tier: bq_export(t), tier)
    print(f"  {tier:<8s} {r['rows_fmt']:>8s} {r['elapsed']:>10s} {r['rate']:>14s}")
```

      tier         rows       time           rate
      small        2.5K       4.9s     510 rows/s
      medium      75.0K       5.2s   14.3K rows/s
      large      750.0K      15.8s   47.4K rows/s

#### Export Firestore to JSON using google-cloud-firestore collection.stream over gRPC

Stream documents, write as NDJSON.

```python
def fs_export(tier):
    path = EXPORT_DIR / f'ohlcv_firestore_{tier}.json'
    target = tiers[tier]['rows']
    count = 0
    batch_size = 500
    last_doc = None
    with open(path, 'w') as f:
        while count < target:
            query = fs_client.collection(FS_COLLECTION).order_by('__name__').limit(batch_size)
            if last_doc:
                query = query.start_after(last_doc)
            docs = list(query.stream())
            if not docs:
                break
            for doc in docs:
                d = doc.to_dict()
                for k, v in d.items():
                    if hasattr(v, 'isoformat'): d[k] = v.isoformat()
                f.write(json.dumps(d) + chr(10))
                count += 1
                if count >= target:
                    break
            last_doc = docs[-1]
    return count

print(f"  {'tier':<8s} {'rows':>8s} {'time':>10s} {'rate':>14s}")
for tier in tiers:
    r = bench_ingest('fs_export_json', lambda t=tier: fs_export(t), tier)
    print(f"  {tier:<8s} {r['rows_fmt']:>8s} {r['elapsed']:>10s} {r['rate']:>14s}")
```

      tier         rows       time           rate
      small        2.5K      707ms    3.5K rows/s
      medium      75.0K      17.0s    4.4K rows/s
      large      750.0K      2m45s    4.5K rows/s

## Summary

#### Results table

```python
# Load the raw data and keep the latest run for each method/tier combination
all_results = _load_results()
df_results = pd.DataFrame(all_results).drop_duplicates(subset=['method', 'tier'], keep='last')

# Create a numeric rank so Large appears first, then Medium, then Small
tier_order = {'large': 0, 'medium': 1, 'small': 2}
df_results['tier_rank'] = df_results['tier'].map(tier_order)
```

#### INGESTION BENCHMARK: BIGQUERY (Local & GCS)

```python
bq_methods = [
    'bq_load_parquet', 'bq_storage_write', 'bq_gcs_csv', 'bq_external_table',
    'bq_gcs_parquet', 'bq_gcs_json', 'bq_cli_csv', 'bq_load_csv', 'bq_load_json'
]

df_bq = df_results[df_results['method'].isin(bq_methods)].copy()
df_bq = df_bq.sort_values(['tier_rank', 'rate_raw'], ascending=[True, False])

display(df_bq[['method', 'tier', 'rows_fmt', 'elapsed', 'rate']].reset_index(drop=True))
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>method</th>
      <th>tier</th>
      <th>rows_fmt</th>
      <th>elapsed</th>
      <th>rate</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>bq_gcs_parquet</td>
      <td>large</td>
      <td>750.0K</td>
      <td>7.6s</td>
      <td>98.9K rows/s</td>
    </tr>
    <tr>
      <th>1</th>
      <td>bq_load_parquet</td>
      <td>large</td>
      <td>750.0K</td>
      <td>8.3s</td>
      <td>90.2K rows/s</td>
    </tr>
    <tr>
      <th>2</th>
      <td>bq_external_table</td>
      <td>large</td>
      <td>750.0K</td>
      <td>9.7s</td>
      <td>77.6K rows/s</td>
    </tr>
    <tr>
      <th>3</th>
      <td>bq_storage_write</td>
      <td>large</td>
      <td>750.0K</td>
      <td>11.8s</td>
      <td>63.6K rows/s</td>
    </tr>
    <tr>
      <th>4</th>
      <td>bq_gcs_csv</td>
      <td>large</td>
      <td>750.0K</td>
      <td>13.0s</td>
      <td>57.9K rows/s</td>
    </tr>
    <tr>
      <th>5</th>
      <td>bq_gcs_json</td>
      <td>large</td>
      <td>750.0K</td>
      <td>17.6s</td>
      <td>42.6K rows/s</td>
    </tr>
    <tr>
      <th>6</th>
      <td>bq_cli_csv</td>
      <td>large</td>
      <td>750.0K</td>
      <td>19.7s</td>
      <td>38.0K rows/s</td>
    </tr>
    <tr>
      <th>7</th>
      <td>bq_load_csv</td>
      <td>large</td>
      <td>750.0K</td>
      <td>22.7s</td>
      <td>33.1K rows/s</td>
    </tr>
    <tr>
      <th>8</th>
      <td>bq_load_json</td>
      <td>large</td>
      <td>750.0K</td>
      <td>27.7s</td>
      <td>27.1K rows/s</td>
    </tr>
    <tr>
      <th>9</th>
      <td>bq_external_table</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>1.2s</td>
      <td>64.1K rows/s</td>
    </tr>
    <tr>
      <th>10</th>
      <td>bq_gcs_parquet</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>2.9s</td>
      <td>26.1K rows/s</td>
    </tr>
    <tr>
      <th>11</th>
      <td>bq_load_parquet</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>3.6s</td>
      <td>20.8K rows/s</td>
    </tr>
    <tr>
      <th>12</th>
      <td>bq_storage_write</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>4.0s</td>
      <td>18.8K rows/s</td>
    </tr>
    <tr>
      <th>13</th>
      <td>bq_gcs_csv</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>4.8s</td>
      <td>15.7K rows/s</td>
    </tr>
    <tr>
      <th>14</th>
      <td>bq_gcs_json</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>6.6s</td>
      <td>11.3K rows/s</td>
    </tr>
    <tr>
      <th>15</th>
      <td>bq_load_csv</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>6.8s</td>
      <td>11.1K rows/s</td>
    </tr>
    <tr>
      <th>16</th>
      <td>bq_load_json</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>7.3s</td>
      <td>10.3K rows/s</td>
    </tr>
    <tr>
      <th>17</th>
      <td>bq_cli_csv</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>7.9s</td>
      <td>9.5K rows/s</td>
    </tr>
    <tr>
      <th>18</th>
      <td>bq_external_table</td>
      <td>small</td>
      <td>2.5K</td>
      <td>1.1s</td>
      <td>2.2K rows/s</td>
    </tr>
    <tr>
      <th>19</th>
      <td>bq_gcs_parquet</td>
      <td>small</td>
      <td>2.5K</td>
      <td>2.5s</td>
      <td>1.0K rows/s</td>
    </tr>
    <tr>
      <th>20</th>
      <td>bq_load_parquet</td>
      <td>small</td>
      <td>2.5K</td>
      <td>2.8s</td>
      <td>884 rows/s</td>
    </tr>
    <tr>
      <th>21</th>
      <td>bq_load_csv</td>
      <td>small</td>
      <td>2.5K</td>
      <td>3.1s</td>
      <td>815 rows/s</td>
    </tr>
    <tr>
      <th>22</th>
      <td>bq_gcs_csv</td>
      <td>small</td>
      <td>2.5K</td>
      <td>3.2s</td>
      <td>775 rows/s</td>
    </tr>
    <tr>
      <th>23</th>
      <td>bq_gcs_json</td>
      <td>small</td>
      <td>2.5K</td>
      <td>4.1s</td>
      <td>614 rows/s</td>
    </tr>
    <tr>
      <th>24</th>
      <td>bq_load_json</td>
      <td>small</td>
      <td>2.5K</td>
      <td>4.5s</td>
      <td>554 rows/s</td>
    </tr>
    <tr>
      <th>25</th>
      <td>bq_storage_write</td>
      <td>small</td>
      <td>2.5K</td>
      <td>4.7s</td>
      <td>527 rows/s</td>
    </tr>
    <tr>
      <th>26</th>
      <td>bq_cli_csv</td>
      <td>small</td>
      <td>2.5K</td>
      <td>9.0s</td>
      <td>278 rows/s</td>
    </tr>
  </tbody>
</table>

```python
fig_bq = go.Figure()

# Iterate through tiers in order to maintain consistent legend grouping
for tier in ['large', 'medium', 'small']:
    df_t = df_bq[df_bq['tier'] == tier]
    if not df_t.empty:
        fig_bq.add_trace(go.Bar(
            x=df_t['method'],
            y=df_t['rate_raw'],
            name=tier.capitalize()
        ))

fig_bq.update_layout(
    barmode='group',
    title='BigQuery Ingestion Performance (Log Scale)',
    xaxis_title='Ingestion Method',
    yaxis_title='Speed (Rows / Second)',
    yaxis_type='log',
    template='plotly_dark',
    xaxis_tickangle=-45
)
fig_bq.show()
```

<iframe src="/static/plotly/di_py_01.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### INGESTION BENCHMARK: SQL SERVER (Local & GCS)

```python
sql_methods = [
    'bcp_import', 'pyodbc_fast_executemany', 'gcs_csv_to_sql',
    'parquet_to_sql_fast', 'json_to_sql_fast', 'pymssql_executemany'
]

df_sql = df_results[df_results['method'].isin(sql_methods)].copy()
df_sql = df_sql.sort_values(['tier_rank', 'rate_raw'], ascending=[True, False])

display(df_sql[['method', 'tier', 'rows_fmt', 'elapsed', 'rate']].reset_index(drop=True))
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>method</th>
      <th>tier</th>
      <th>rows_fmt</th>
      <th>elapsed</th>
      <th>rate</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>bcp_import</td>
      <td>large</td>
      <td>750.0K</td>
      <td>21.0s</td>
      <td>35.7K rows/s</td>
    </tr>
    <tr>
      <th>1</th>
      <td>pyodbc_fast_executemany</td>
      <td>large</td>
      <td>750.0K</td>
      <td>54.4s</td>
      <td>13.8K rows/s</td>
    </tr>
    <tr>
      <th>2</th>
      <td>parquet_to_sql_fast</td>
      <td>large</td>
      <td>750.0K</td>
      <td>55.2s</td>
      <td>13.6K rows/s</td>
    </tr>
    <tr>
      <th>3</th>
      <td>gcs_csv_to_sql</td>
      <td>large</td>
      <td>750.0K</td>
      <td>56.2s</td>
      <td>13.3K rows/s</td>
    </tr>
    <tr>
      <th>4</th>
      <td>json_to_sql_fast</td>
      <td>large</td>
      <td>750.0K</td>
      <td>59.0s</td>
      <td>12.7K rows/s</td>
    </tr>
    <tr>
      <th>5</th>
      <td>bcp_import</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>2.7s</td>
      <td>28.1K rows/s</td>
    </tr>
    <tr>
      <th>6</th>
      <td>pyodbc_fast_executemany</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>5.7s</td>
      <td>13.0K rows/s</td>
    </tr>
    <tr>
      <th>7</th>
      <td>parquet_to_sql_fast</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>5.8s</td>
      <td>12.9K rows/s</td>
    </tr>
    <tr>
      <th>8</th>
      <td>json_to_sql_fast</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>6.2s</td>
      <td>12.2K rows/s</td>
    </tr>
    <tr>
      <th>9</th>
      <td>gcs_csv_to_sql</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>6.5s</td>
      <td>11.5K rows/s</td>
    </tr>
    <tr>
      <th>10</th>
      <td>json_to_sql_fast</td>
      <td>small</td>
      <td>2.5K</td>
      <td>722ms</td>
      <td>3.5K rows/s</td>
    </tr>
    <tr>
      <th>11</th>
      <td>bcp_import</td>
      <td>small</td>
      <td>2.5K</td>
      <td>770ms</td>
      <td>3.2K rows/s</td>
    </tr>
    <tr>
      <th>12</th>
      <td>parquet_to_sql_fast</td>
      <td>small</td>
      <td>2.5K</td>
      <td>837ms</td>
      <td>3.0K rows/s</td>
    </tr>
    <tr>
      <th>13</th>
      <td>pyodbc_fast_executemany</td>
      <td>small</td>
      <td>2.5K</td>
      <td>1.5s</td>
      <td>1.7K rows/s</td>
    </tr>
    <tr>
      <th>14</th>
      <td>gcs_csv_to_sql</td>
      <td>small</td>
      <td>2.5K</td>
      <td>2.2s</td>
      <td>1.1K rows/s</td>
    </tr>
    <tr>
      <th>15</th>
      <td>pymssql_executemany</td>
      <td>small</td>
      <td>2.5K</td>
      <td>59.5s</td>
      <td>42 rows/s</td>
    </tr>
  </tbody>
</table>

```python
fig_sql = go.Figure()

for tier in ['large', 'medium', 'small']:
    df_t = df_sql[df_sql['tier'] == tier]
    if not df_t.empty:
        fig_sql.add_trace(go.Bar(
            x=df_t['method'],
            y=df_t['rate_raw'],
            name=tier.capitalize()
        ))

fig_sql.update_layout(
    barmode='group',
    title='SQL Server Ingestion Performance (Log Scale)',
    xaxis_title='Ingestion Method',
    yaxis_title='Speed (Rows / Second)',
    yaxis_type='log',
    template='plotly_dark',
    xaxis_tickangle=-45
)
fig_sql.show()
```

<iframe src="/static/plotly/di_py_02.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### INGESTION BENCHMARK: FIRESTORE

```python
fs_methods = [
    'fs_bulkwriter', 'fs_batch'
]

df_fs = df_results[df_results['method'].isin(fs_methods)].copy()
df_fs = df_fs.sort_values(['tier_rank', 'rate_raw'], ascending=[True, False])

display(df_fs[['method', 'tier', 'rows_fmt', 'elapsed', 'rate']].reset_index(drop=True))
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>method</th>
      <th>tier</th>
      <th>rows_fmt</th>
      <th>elapsed</th>
      <th>rate</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>fs_bulkwriter</td>
      <td>large</td>
      <td>750.0K</td>
      <td>25m11s</td>
      <td>496 rows/s</td>
    </tr>
    <tr>
      <th>1</th>
      <td>fs_batch</td>
      <td>large</td>
      <td>750.0K</td>
      <td>31m13s</td>
      <td>400 rows/s</td>
    </tr>
    <tr>
      <th>2</th>
      <td>fs_bulkwriter</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>2m31s</td>
      <td>497 rows/s</td>
    </tr>
    <tr>
      <th>3</th>
      <td>fs_batch</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>3m21s</td>
      <td>372 rows/s</td>
    </tr>
    <tr>
      <th>4</th>
      <td>fs_bulkwriter</td>
      <td>small</td>
      <td>2.5K</td>
      <td>4.1s</td>
      <td>604 rows/s</td>
    </tr>
    <tr>
      <th>5</th>
      <td>fs_batch</td>
      <td>small</td>
      <td>2.5K</td>
      <td>6.7s</td>
      <td>372 rows/s</td>
    </tr>
  </tbody>
</table>

```python
fig_fs = go.Figure()

for tier in ['large', 'medium', 'small']:
    df_t = df_fs[df_fs['tier'] == tier]
    if not df_t.empty:
        fig_fs.add_trace(go.Bar(
            x=df_t['method'],
            y=df_t['rate_raw'],
            name=tier.capitalize()
        ))

fig_fs.update_layout(
    barmode='group',
    title='Firestore Ingestion Performance',
    xaxis_title='Ingestion Method',
    yaxis_title='Speed (Documents / Second)',
    # Linear scale used here as the variance is smaller
    template='plotly_dark',
    xaxis_tickangle=-45
)
fig_fs.show()
```

<iframe src="/static/plotly/di_py_03.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### DATABASE-TO-DATABASE TRANSFERS BENCHMARK

```python
transfer_methods = [
    'sql_to_bq_gcs', 'sql_to_bq', 'bq_to_sql', 'sql_to_firestore', 'bq_to_fs'
]

df_transfer = df_results[df_results['method'].isin(transfer_methods)].copy()
df_transfer = df_transfer.sort_values(['tier_rank', 'rate_raw'], ascending=[True, False])

display(df_transfer[['method', 'tier', 'rows_fmt', 'elapsed', 'rate']].reset_index(drop=True))
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>method</th>
      <th>tier</th>
      <th>rows_fmt</th>
      <th>elapsed</th>
      <th>rate</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>sql_to_bq_gcs</td>
      <td>large</td>
      <td>750.0K</td>
      <td>8m7s</td>
      <td>1.5K rows/s</td>
    </tr>
    <tr>
      <th>1</th>
      <td>sql_to_bq</td>
      <td>large</td>
      <td>750.0K</td>
      <td>8m19s</td>
      <td>1.5K rows/s</td>
    </tr>
    <tr>
      <th>2</th>
      <td>bq_to_sql</td>
      <td>large</td>
      <td>750.0K</td>
      <td>8m34s</td>
      <td>1.5K rows/s</td>
    </tr>
    <tr>
      <th>3</th>
      <td>bq_to_fs</td>
      <td>large</td>
      <td>750.0K</td>
      <td>25m52s</td>
      <td>483 rows/s</td>
    </tr>
    <tr>
      <th>4</th>
      <td>sql_to_firestore</td>
      <td>large</td>
      <td>750.0K</td>
      <td>32m51s</td>
      <td>381 rows/s</td>
    </tr>
    <tr>
      <th>5</th>
      <td>sql_to_bq</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>51.8s</td>
      <td>1.4K rows/s</td>
    </tr>
    <tr>
      <th>6</th>
      <td>sql_to_bq_gcs</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>54.4s</td>
      <td>1.4K rows/s</td>
    </tr>
    <tr>
      <th>7</th>
      <td>bq_to_sql</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>57.4s</td>
      <td>1.3K rows/s</td>
    </tr>
    <tr>
      <th>8</th>
      <td>bq_to_fs</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>2m41s</td>
      <td>466 rows/s</td>
    </tr>
    <tr>
      <th>9</th>
      <td>sql_to_firestore</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>3m16s</td>
      <td>383 rows/s</td>
    </tr>
    <tr>
      <th>10</th>
      <td>bq_to_sql</td>
      <td>small</td>
      <td>2.5K</td>
      <td>5.5s</td>
      <td>451 rows/s</td>
    </tr>
    <tr>
      <th>11</th>
      <td>sql_to_firestore</td>
      <td>small</td>
      <td>2.5K</td>
      <td>6.5s</td>
      <td>387 rows/s</td>
    </tr>
    <tr>
      <th>12</th>
      <td>sql_to_bq_gcs</td>
      <td>small</td>
      <td>2.5K</td>
      <td>6.5s</td>
      <td>382 rows/s</td>
    </tr>
    <tr>
      <th>13</th>
      <td>sql_to_bq</td>
      <td>small</td>
      <td>2.5K</td>
      <td>7.4s</td>
      <td>340 rows/s</td>
    </tr>
    <tr>
      <th>14</th>
      <td>bq_to_fs</td>
      <td>small</td>
      <td>2.5K</td>
      <td>8.9s</td>
      <td>282 rows/s</td>
    </tr>
  </tbody>
</table>

```python
fig_transfer = go.Figure()

for tier in ['large', 'medium', 'small']:
    df_t = df_transfer[df_transfer['tier'] == tier]
    if not df_t.empty:
        fig_transfer.add_trace(go.Bar(
            x=df_t['method'],
            y=df_t['rate_raw'],
            name=tier.capitalize()
        ))

fig_transfer.update_layout(
    barmode='group',
    title='Cross-Database Transfer Performance',
    xaxis_title='Transfer Path',
    yaxis_title='Speed (Rows / Second)',
    template='plotly_dark',
    xaxis_tickangle=-45
)
```

<iframe src="/static/plotly/di_py_04.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### DATA EXPORTS BENCHMARK

```python
export_methods = [
    'bq_export_gcs', 'sql_export_csv', 'fs_export_json'
]

df_export = df_results[df_results['method'].isin(export_methods)].copy()
df_export = df_export.sort_values(['tier_rank', 'rate_raw'], ascending=[True, False])

display(df_export[['method', 'tier', 'rows_fmt', 'elapsed', 'rate']].reset_index(drop=True))
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>method</th>
      <th>tier</th>
      <th>rows_fmt</th>
      <th>elapsed</th>
      <th>rate</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>sql_export_csv</td>
      <td>large</td>
      <td>750.0K</td>
      <td>6.5s</td>
      <td>114.7K rows/s</td>
    </tr>
    <tr>
      <th>1</th>
      <td>bq_export_gcs</td>
      <td>large</td>
      <td>750.0K</td>
      <td>15.8s</td>
      <td>47.4K rows/s</td>
    </tr>
    <tr>
      <th>2</th>
      <td>fs_export_json</td>
      <td>large</td>
      <td>750.0K</td>
      <td>2m45s</td>
      <td>4.5K rows/s</td>
    </tr>
    <tr>
      <th>3</th>
      <td>sql_export_csv</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>800ms</td>
      <td>93.7K rows/s</td>
    </tr>
    <tr>
      <th>4</th>
      <td>bq_export_gcs</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>5.2s</td>
      <td>14.3K rows/s</td>
    </tr>
    <tr>
      <th>5</th>
      <td>fs_export_json</td>
      <td>medium</td>
      <td>75.0K</td>
      <td>17.0s</td>
      <td>4.4K rows/s</td>
    </tr>
    <tr>
      <th>6</th>
      <td>sql_export_csv</td>
      <td>small</td>
      <td>2.5K</td>
      <td>131ms</td>
      <td>19.1K rows/s</td>
    </tr>
    <tr>
      <th>7</th>
      <td>fs_export_json</td>
      <td>small</td>
      <td>2.5K</td>
      <td>707ms</td>
      <td>3.5K rows/s</td>
    </tr>
    <tr>
      <th>8</th>
      <td>bq_export_gcs</td>
      <td>small</td>
      <td>2.5K</td>
      <td>4.9s</td>
      <td>510 rows/s</td>
    </tr>
  </tbody>
</table>

```python
fig_export = go.Figure()

for tier in ['large', 'medium', 'small']:
    df_t = df_export[df_export['tier'] == tier]
    if not df_t.empty:
        fig_export.add_trace(go.Bar(
            x=df_t['method'],
            y=df_t['rate_raw'],
            name=tier.capitalize()
        ))

fig_export.update_layout(
    barmode='group',
    title='Data Export Performance',
    xaxis_title='Export Method',
    yaxis_title='Speed (Rows / Second)',
    template='plotly_dark',
    xaxis_tickangle=-45
)
fig_export.show()
```

<iframe src="/static/plotly/di_py_05.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### pymssql + google-cloud-bigquery — cleanup staging tables

```python
# Drop staging tables and clean up
with sql_pymssql() as conn:
    conn.cursor().execute('DROP TABLE IF EXISTS dbo.ohlcv_bench')
    conn.commit()
    print('  SQL Server: ohlcv_bench dropped')

bq_client.delete_table(BQ_BENCH_TABLE, not_found_ok=True)
bq_client.delete_table(f'{BQ_BENCH_TABLE}_ext', not_found_ok=True)
print('  BigQuery: ohlcv_bench dropped')

# No delete — set() overwrites existing docs by ID, avoiding costly collection scan
print('  Firestore: ohlcv_bench cleared')

for blob in gcs_client.list_blobs(BUCKET_NAME, prefix='exports/'):
    blob.delete()
for blob in gcs_client.list_blobs(BUCKET_NAME, prefix='staging/'):
    blob.delete()
print('  GCS: exports/ and staging/ cleaned')

if EXPORT_DIR.exists():
    import shutil
    shutil.rmtree(EXPORT_DIR)
    print(f'  Local: exports/ deleted')
print('  Cleanup done')
```

      SQL Server: ohlcv_bench dropped
      BigQuery: ohlcv_bench dropped
      Firestore: ohlcv_bench cleared
      GCS: exports/ and staging/ cleaned
      Cleanup done
