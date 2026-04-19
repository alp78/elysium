---
title: "02 - Bronze Layer Loading"
tags:
  - postgresql
  - data-engineering
  - etl
  - medallion
aliases:
  - PostgreSQL bronze loading
  - Bronze schema loading
  - Bronze JSON landing
description: "PostgreSQL bronze-layer design and loading patterns for schema setup, connection helpers, raw table structure, dynamic OHLCV tables, and snapshot-versus-history landing behavior."
parent: "[[domain-applied-postgresql-pipelines]]"
links:
  - "[[01-postgresql-loading-patterns-and-idempotency]]"
  - "[[01-postgresql-query-surface-and-planner-basics]]"
status: complete
---

# Bronze Layer Loading

The bronze layer is the raw landing zone of the PostgreSQL medallion pipeline. Its job is not to normalize or interpret business meaning. Its job is to preserve source shape, attach ingestion metadata, and define a restartable handoff into later silver transforms. The live `stoxx` database already contains a bronze schema, which makes it possible to mirror the SQL Server bronze note against real PostgreSQL tables instead of abstract examples.

> [!abstract]- Summary
>
> This note documents the PostgreSQL bronze-layer equivalent of the SQL Server bronze implementation. Bronze remains the raw landing zone, but the PostgreSQL mechanics are different: idempotent schema creation is simpler, Python connectivity should be built around a PostgreSQL driver rather than ODBC, and history-friendly loads should use native uniqueness plus `ON CONFLICT` when the source contract justifies it.
>
> **Environment and setup**
> - covers idempotent schema creation, PostgreSQL-oriented Python connectivity, and the live symbol-lookup query used by bronze loaders
>
> **Bronze table surface**
> - inspects the current bronze tables, their column layout, and the indexes that actually exist after the SQL Server to PostgreSQL migration
>
> **Dynamic OHLCV structures**
> - shows the current bronze and silver OHLCV table naming surface and previews a live bronze OHLCV slice
>
> **Bronze load patterns**
> - contrasts snapshot-style replacement for bounded bronze feeds with append-and-correct OHLCV history landing through `ON CONFLICT`

> [!note]- Glossary
>
> **Bronze layer**
> - The raw landing layer of a medallion pipeline where data is stored as close to the source payload as practical.
> - It matters because bronze is the replay and audit boundary. If the landing layer is over-transformed, later pipeline debugging loses its clean starting point.
>
> > [!info] Land first, interpret later
> >
> > Bronze should preserve source fidelity and ingestion timing. Business reshaping belongs in silver and gold.
>
> ---
>
> **Snapshot feed**
> - A source whose payload represents the complete current truth for a bounded business slice each time it lands.
> - It matters because these feeds are often safest to load through slice replacement rather than row-by-row merge logic.
>
> > [!info] Full-slice truth prefers replacement
> >
> > If the incoming batch already contains the complete slice, replacement is usually simpler and more trustworthy than incremental reconciliation.
>
> ---
>
> **Append-and-correct history**
> - A source behavior where new rows arrive over time and existing historical rows may occasionally be corrected.
> - It matters because this is the main bronze exception that justifies key-based upsert logic instead of full-slice replacement.
>
> > [!info] Historical feeds need a durable key
> >
> > If history can be corrected, the target needs a real business uniqueness boundary such as `(symbol, trade_date)` for the engine to upsert safely.
>
> ---
>
> **`_ingested_at`**
> - The physical arrival timestamp recorded when the bronze loader writes a row.
> - It matters because bronze often needs to preserve both business event time and ingestion time as separate facts.
>
> > [!info] Arrival time is not event time
> >
> > Keeping both timestamps makes replay, freshness checks, and failure analysis much easier.
>
> ---

## Database Setup And Connection

Before any bronze rows land, the schema has to exist and the loader has to connect through a PostgreSQL-native client. PostgreSQL simplifies the DDL boundary compared with SQL Server because `CREATE SCHEMA IF NOT EXISTS` is available directly.

### Idempotent schema creation

The current bronze schema already exists in `stoxx`, but the creation pattern is still worth making explicit because every bootstrap or rebuild path depends on it.

#### Create the bronze schema idempotently

Use this command during first-time environment bootstrap, rebuilds, or deployment scripts that need to guarantee the bronze namespace exists before any tables are created. It is typically triggered by cluster initialization or by pipeline setup code running against a fresh database. The command is state-changing, but harmless when the schema already exists because PostgreSQL treats the `IF NOT EXISTS` clause as a no-op with a notice. Its purpose is to make the bronze namespace creation step rerunnable.

*This command ensures the `bronze` schema exists before loader DDL runs.*

```sql
CREATE SCHEMA IF NOT EXISTS bronze;
```

```text
CREATE SCHEMA
NOTICE:  schema "bronze" already exists, skipping
```

This is exactly the kind of DDL surface a bronze bootstrap needs: explicit, rerunnable, and safe to execute on every setup pass without custom catalog guards.

### Python connection helper

For PostgreSQL, the clean Python baseline is a PostgreSQL-native driver such as `psycopg`, not an ODBC abstraction borrowed from the SQL Server chapter. The key operational goal is still the same: centralize host, port, database, role, and transaction behavior in one reusable connection factory.

#### Build a PostgreSQL-native connection helper with environment-driven settings

Use a shared helper like the following when bronze loaders need one authoritative connection pattern for local runs, orchestrated jobs, and ad-hoc replay scripts. It is typically triggered by loader implementation work, not by SQL troubleshooting. The code is not state-changing on its own. Its purpose is to centralize connection policy, transaction defaults, and environment-variable lookup.

*This Python helper builds a PostgreSQL connection from environment variables instead of hardcoded credentials.*

```python
from pathlib import Path
import os

from dotenv import load_dotenv
import psycopg


def get_connection(autocommit: bool = False, database: str | None = None):
    env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(env_path)

    return psycopg.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5434")),
        dbname=database or os.getenv("PGDATABASE", "stoxx"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD"),
        autocommit=autocommit,
    )
```

The important design choice is not the library syntax itself. It is the fact that host, port, database, user, and autocommit policy are centralized in one place so every bronze loader inherits the same operational boundary.

### Symbol lookup helper

Many bronze loaders need the current set of symbols and the earliest available history date before they can decide which raw files or API requests to process.

#### Read symbols and history starts from `bronze.index_dim`

Use this query when a loader needs the current ticker universe for one index slice, or when the operator wants to validate that the bronze dimension table already holds the expected symbols and history boundaries. It is typically triggered by orchestration code or by ad-hoc data inspection. The query runs read-only against `bronze.index_dim`. Its purpose is to surface the symbol list and the earliest price-data start date that downstream loaders can use as a lower bound.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `bronze.index_dim.symbol` | varchar | Ticker symbol to process. |
| `price_data_start` | `bronze.index_dim.price_data_start` | date | Earliest date for which historical price data is expected. |

*This query returns the first few symbols and their historical lower bounds from the bronze dimension table.*

```sql
SELECT
    symbol,
    price_data_start
FROM bronze.index_dim
ORDER BY symbol
LIMIT 5;
```

| symbol | price_data_start |
|---|---|
| 0388.HK | 2021-01-01 |
| 1299.HK | 2021-01-01 |
| 1810.HK | 2021-01-01 |
| 2269.HK | 2021-01-01 |
| 3382.T | 2021-01-01 |

This is the bronze equivalent of "what entities should I load?" The query stays close to the raw metadata and does not yet impose silver-level interpretation.

## Bronze Table Surface

The bronze schema is already populated in the current PostgreSQL lab. That makes it possible to inspect the actual landed table shapes and compare them to the intended bronze design rules.

### Current bronze metadata and signal tables

The most important structural rules are visible immediately: surrogate key, `_index` business slice, `_ingested_at` arrival time, and payload columns that remain close to the source.

#### Inspect the current columns of `bronze.index_dim`

Use this query when validating the metadata landing shape, comparing the PostgreSQL bronze table to the SQL Server source, or reviewing whether the table is still source-faithful. It is typically triggered by schema review or by a loader change that needs to know exactly which fields the raw dimension table exposes. The query reads `information_schema.columns`. It is read-only. Its purpose is to show the current column surface of the bronze metadata table.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `column_name` | `information_schema.columns.column_name` | text | Column name in ordinal order. |
| `data_type` | `information_schema.columns.data_type` | text | PostgreSQL data type of the column. |
| `is_nullable` | `information_schema.columns.is_nullable` | text | Whether the column allows nulls. |

*This query inspects the landed column surface of `bronze.index_dim`.*

```sql
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'bronze'
  AND table_name = 'index_dim'
ORDER BY ordinal_position;
```

| column_name | data_type | is_nullable |
|---|---|---|
| id | integer | NO |
| _index | character varying | NO |
| _ingested_at | timestamp without time zone | NO |
| symbol | character varying | NO |
| long_name | character varying | YES |
| short_name | character varying | YES |
| sector | character varying | YES |
| sector_key | character varying | YES |
| industry | character varying | YES |
| industry_key | character varying | YES |
| country | character varying | YES |
| city | character varying | YES |
| website | character varying | YES |
| long_business_summary | text | YES |
| exchange | character varying | YES |
| full_exchange_name | character varying | YES |
| exchange_timezone_name | character varying | YES |
| exchange_timezone_short | character varying | YES |
| currency | character varying | YES |
| financial_currency | character varying | YES |
| quote_type | character varying | YES |
| market | character varying | YES |
| range_start | date | YES |
| price_data_start | date | YES |

This is a good bronze shape. It keeps the source attributes visible, adds `_index` and `_ingested_at` as landing metadata, and avoids premature normalization into downstream-oriented dimensions.

#### Inspect the current columns of `bronze.signals_daily`

Use this query when reviewing a raw signal snapshot feed or when a pipeline change needs the exact landed field names and nullability. It is typically triggered by schema mapping, raw-to-silver planning, or ingestion validation. The query reads `information_schema.columns`. It is read-only. Its purpose is to show the column layout of the current bronze daily-signals table.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `column_name` | `information_schema.columns.column_name` | text | Column name in ordinal order. |
| `data_type` | `information_schema.columns.data_type` | text | PostgreSQL data type of the column. |
| `is_nullable` | `information_schema.columns.is_nullable` | text | Whether the column allows nulls. |

*This query inspects the landed column surface of `bronze.signals_daily`.*

```sql
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'bronze'
  AND table_name = 'signals_daily'
ORDER BY ordinal_position;
```

| column_name | data_type | is_nullable |
|---|---|---|
| id | integer | NO |
| _index | character varying | NO |
| _ingested_at | timestamp without time zone | NO |
| symbol | character varying | NO |
| timestamp | timestamp without time zone | NO |
| current_price | double precision | YES |
| forward_pe | double precision | YES |
| price_to_book | double precision | YES |
| ev_to_ebitda | double precision | YES |
| dividend_yield | double precision | YES |
| market_cap | bigint | YES |
| beta | double precision | YES |
| fifty_two_week_change | double precision | YES |
| sandp_52_week_change | double precision | YES |
| fifty_day_average | double precision | YES |
| two_hundred_day_average | double precision | YES |
| dist_from_52_week_high | double precision | YES |
| target_median_price | double precision | YES |
| recommendation_mean | double precision | YES |
| upside_potential | double precision | YES |

Again the bronze rule is visible in the column design: the landed feed is still recognizable as the original signal payload, not a consumer-facing silver model.

#### Inspect the indexes that currently exist on key bronze tables

Use this query when evaluating bronze-table read patterns, or when comparing the migrated PostgreSQL schema to the original SQL Server design. It is typically triggered by performance review or by DDL planning for native PostgreSQL loaders. The query reads `pg_indexes`. It is read-only. Its purpose is to show which access paths the current bronze tables actually have.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `indexname` | `pg_indexes.indexname` | name | Name of the index. |
| `indexdef` | `pg_indexes.indexdef` | text | Full DDL definition of the index. |

*This query shows the current index surface of two representative bronze tables.*

```sql
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'bronze'
  AND tablename IN ('index_dim', 'signals_daily')
ORDER BY tablename, indexname;
```

| indexname | indexdef |
|---|---|
| index_dim_pkey | CREATE UNIQUE INDEX index_dim_pkey ON bronze.index_dim USING btree (id) |
| signals_daily_pkey | CREATE UNIQUE INDEX signals_daily_pkey ON bronze.signals_daily USING btree (id) |

The migrated PostgreSQL bronze tables currently expose only surrogate-key primary indexes. That is enough for identity and table integrity, but a production-native bronze design would usually add workload-facing indexes or uniqueness boundaries if slice deletes or `ON CONFLICT` landing is going to depend on business keys such as `(_index, symbol)` or `(symbol, timestamp)`.

## Dynamic OHLCV Tables

The bronze layer also contains per-index OHLCV tables. These are the main history-bearing exception to the otherwise snapshot-heavy bronze surface.

### Current OHLCV table naming surface

The current lab preserved the bronze and silver OHLCV tables as separate physical tables per index family.

#### List the live OHLCV tables across bronze and silver

Use this query when validating that the expected OHLCV tables exist for both raw and transformed layers, or before writing loader logic that needs to target a specific table by convention. It is typically triggered by schema discovery or by a new loader implementation. The query reads `information_schema.tables`. It is read-only. Its purpose is to show the current dynamic OHLCV table naming surface.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `table_schema` | `information_schema.tables.table_schema` | text | Schema containing the table. |
| `table_name` | `information_schema.tables.table_name` | text | OHLCV table name. |

*This query lists the current bronze and silver OHLCV tables in the PostgreSQL lab.*

```sql
SELECT
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema IN ('bronze', 'silver')
  AND table_name LIKE '%ohlcv'
ORDER BY table_schema, table_name;
```

| table_schema | table_name |
|---|---|
| bronze | eurostoxx50_ohlcv |
| bronze | oil20_ohlcv |
| bronze | stoxxasia50_ohlcv |
| bronze | stoxxusa50_ohlcv |
| silver | eurostoxx50_ohlcv |
| silver | oil20_ohlcv |
| silver | stoxxasia50_ohlcv |
| silver | stoxxusa50_ohlcv |

This naming scheme keeps the business slice visible directly in the table name while still respecting the medallion layer boundary through the schema.

#### Preview a live bronze OHLCV slice

Use this query when validating the raw historical landing shape of one OHLCV table, or before designing a merge or upsert boundary for historical prices. It is typically triggered by schema walkthrough, feed validation, or note writing. The query runs read-only against `bronze.stoxxusa50_ohlcv`. Its purpose is to show the raw landed OHLCV row shape.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `bronze.stoxxusa50_ohlcv.symbol` | varchar | Ticker symbol. |
| `date` | `bronze.stoxxusa50_ohlcv.date` | date | Trading date. |
| `open` | `bronze.stoxxusa50_ohlcv.open` | double precision | Opening price. |
| `high` | `bronze.stoxxusa50_ohlcv.high` | double precision | Daily high price. |
| `low` | `bronze.stoxxusa50_ohlcv.low` | double precision | Daily low price. |
| `close` | `bronze.stoxxusa50_ohlcv.close` | double precision | Closing price. |
| `volume` | `bronze.stoxxusa50_ohlcv.volume` | bigint | Daily volume. |

*This query previews the latest rows currently present in the raw bronze USA OHLCV table.*

```sql
SELECT
    symbol,
    date,
    open,
    high,
    low,
    close,
    volume
FROM bronze.stoxxusa50_ohlcv
ORDER BY date DESC, symbol
LIMIT 5;
```

| symbol | date | open | high | low | close | volume |
|---|---|---:|---:|---:|---:|---:|
| AAPL | 2026-04-07 | 256.155 | 256.19 | 245.7 | 253.5 | 60820961 |
| ABBV | 2026-04-07 | 206.23 | 206.49 | 201.6634 | 206.37 | 7807749 |
| AMAT | 2026-04-07 | 348.145 | 356 | 345.5 | 354.31 | 3670017 |
| AMD | 2026-04-07 | 218.255 | 222.0984 | 215.375 | 221.53 | 24796216 |
| AMZN | 2026-04-07 | 211.24 | 213.97 | 209.08 | 213.77 | 26704731 |

The bronze OHLCV table is already close to a typed historical fact table. That is why these feeds are the main bronze exception that often justify append-and-correct landing instead of complete slice replacement.

## Loading Patterns (JSON To Bronze)

Bronze loading should still be chosen by source contract first. The two dominant cases are snapshot feeds and historical OHLCV feeds.

### Snapshot-style feeds

Daily signals and similar payloads are typically full-slice snapshots. That makes transactional replacement the safest raw landing posture.

#### Replace one snapshot slice transactionally

Use this pattern when the incoming payload is the complete truth for one `_index` slice and the safest outcome is to replace that slice atomically. It is typically triggered by daily snapshot feeds or dimension refreshes. The demo runs against a temporary table so the real bronze schema is untouched. Its purpose is to show the bronze snapshot rule: replace the slice inside one transaction, then read the final landed state.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `_index` | temp demo slice key | text | Business slice being refreshed. |
| `symbol` | temp demo payload | text | Entity key inside the slice. |
| `signal_date` | temp demo payload | date | Snapshot date of the signal row. |
| `recommendation_mean` | temp demo payload | double precision | Example signal measure. |
| `_ingested_at` | temp demo payload | timestamp | Arrival timestamp of the landed row. |

*This demo replaces one bronze snapshot slice and returns the final target contents.*

```sql
CREATE TEMP TABLE bronze_snapshot_demo
(
    _index text,
    symbol text,
    signal_date date,
    recommendation_mean double precision,
    _ingested_at timestamp without time zone
);

INSERT INTO bronze_snapshot_demo
VALUES
    ('stoxx_usa_50', 'AAPL', DATE '2026-04-07', 1.8, TIMESTAMP '2026-04-07 23:00:00'),
    ('stoxx_usa_50', 'AMD', DATE '2026-04-07', 2.1, TIMESTAMP '2026-04-07 23:00:00'),
    ('stoxx_europe_50', 'ASML.AS', DATE '2026-04-07', 1.7, TIMESTAMP '2026-04-07 23:00:00');

BEGIN;

DELETE FROM bronze_snapshot_demo
WHERE _index = 'stoxx_usa_50';

INSERT INTO bronze_snapshot_demo
VALUES
    ('stoxx_usa_50', 'AAPL', DATE '2026-04-08', 1.6, TIMESTAMP '2026-04-08 23:00:00'),
    ('stoxx_usa_50', 'AMD', DATE '2026-04-08', 2.0, TIMESTAMP '2026-04-08 23:00:00');

COMMIT;

SELECT
    _index,
    symbol,
    signal_date,
    recommendation_mean,
    _ingested_at
FROM bronze_snapshot_demo
ORDER BY _index, symbol;
```

| _index | symbol | signal_date | recommendation_mean | _ingested_at |
|---|---|---|---:|---|
| stoxx_europe_50 | ASML.AS | 2026-04-07 | 1.7 | 2026-04-07 23:00:00 |
| stoxx_usa_50 | AAPL | 2026-04-08 | 1.6 | 2026-04-08 23:00:00 |
| stoxx_usa_50 | AMD | 2026-04-08 | 2 | 2026-04-08 23:00:00 |

This is the correct bronze pattern for a full-slice snapshot feed. The new rows become visible together, and unrelated slices remain untouched.

### Append-and-correct OHLCV history

Historical OHLCV feeds are different because the feed can append new dates and occasionally correct existing ones. That is where PostgreSQL's key-based upsert becomes useful.

#### Upsert raw OHLCV history on a business key

Use this pattern when the feed can deliver both new and corrected historical rows, and the landing table has a real uniqueness boundary such as `(symbol, trade_date)`. It is typically triggered by daily price-history refreshes or backfills from an external market-data source. The demo uses a temporary table with a composite primary key. Its purpose is to show the PostgreSQL-native bronze history pattern: `INSERT ... ON CONFLICT DO UPDATE`.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | temp demo business key | text | Instrument symbol. |
| `trade_date` | temp demo business key | date | Historical date boundary. |
| `close` | temp demo payload | numeric | Closing price to land. |
| `volume` | temp demo payload | bigint | Daily volume to land. |

*This demo corrects one existing historical row and inserts one new one through `ON CONFLICT`.*

```sql
CREATE TEMP TABLE bronze_ohlcv_demo
(
    symbol text,
    trade_date date,
    close numeric(10, 2),
    volume bigint,
    PRIMARY KEY (symbol, trade_date)
);

INSERT INTO bronze_ohlcv_demo
VALUES
    ('AAPL', DATE '2026-04-07', 253.50, 60820961),
    ('AMD', DATE '2026-04-07', 221.53, 24796216);

INSERT INTO bronze_ohlcv_demo (symbol, trade_date, close, volume)
VALUES
    ('AMD', DATE '2026-04-07', 222.00, 25000000),
    ('AMZN', DATE '2026-04-07', 213.77, 26704731)
ON CONFLICT (symbol, trade_date) DO UPDATE
SET
    close = EXCLUDED.close,
    volume = EXCLUDED.volume;

SELECT
    symbol,
    trade_date,
    close,
    volume
FROM bronze_ohlcv_demo
ORDER BY symbol, trade_date;
```

| symbol | trade_date | close | volume |
|---|---|---:|---:|
| AAPL | 2026-04-07 | 253.50 | 60820961 |
| AMD | 2026-04-07 | 222.00 | 25000000 |
| AMZN | 2026-04-07 | 213.77 | 26704731 |

This is the PostgreSQL-native equivalent of the bronze-history merge boundary. It works well when the target table has the right business key. Without that key, the loader has no safe definition of what counts as "the same" historical row.

## Operational Guidance

The safest bronze defaults for this PostgreSQL chapter are straightforward.

### Default habits for the bronze layer

- Keep bronze tables source-faithful and ingestion-aware. Preserve `_index` and `_ingested_at` instead of normalizing them away.
- Use PostgreSQL-native idempotent DDL such as `CREATE SCHEMA IF NOT EXISTS` during setup.
- Prefer snapshot replacement for complete slice feeds and `ON CONFLICT` only for true append-and-correct history.
- Add real business-key indexes or constraints if bronze loaders will depend on conflict-aware landing or slice-targeted maintenance.
