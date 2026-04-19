---
title: "03 - Silver Transforms"
tags:
  - postgresql
  - data-engineering
  - etl
  - medallion
aliases:
  - PostgreSQL silver loading
  - Silver layer transforms
  - SCD Type 2 in PostgreSQL
description: "PostgreSQL silver-layer patterns for the live stoxx medallion schemas: recommended uniqueness design, SCD Type 2 dimensions, `ON CONFLICT` upserts, trading-calendar gap fill, and freshness checks."
parent: "[[domain-applied-postgresql-pipelines]]"
links:
  - "[[02-postgresql-bronze-layer-loading]]"
  - "[[11-postgresql-merge-and-upsert]]"
  - "[[04-postgresql-gold-transforms]]"
status: complete
---

# Silver Transforms

Silver is where the PostgreSQL pipeline stops preserving source shape and starts enforcing durable business meaning. Bronze accepts raw landed rows and short-lived snapshots. Silver keeps one authoritative row per business key and time grain, preserves selected history, and repairs time-series gaps before gold scoring and dashboard reads begin.

> [!abstract]- Summary
>
> This note mirrors the SQL Server silver chapter against the live PostgreSQL `stoxx` lab. The migrated silver schemas already contain real dimensions, signals, and OHLCV history, which makes it possible to show the current table surface and then document the PostgreSQL-native patterns that should enforce the same operational contract.
>
> **Live surface**
> - inventories the current silver tables, row volumes, and index posture in PostgreSQL
> - makes the current migration gap explicit: the lab tables are populated, but the business-key uniqueness rules are not yet backed by secondary indexes
>
> **Silver transform design**
> - maps SQL Server filtered indexes to PostgreSQL partial unique indexes
> - maps row-by-row merge logic to `INSERT ... ON CONFLICT DO UPDATE` with `IS DISTINCT FROM` guards
>
> **Core transform patterns**
> - covers SCD Type 2 dimensions in `silver.index_dim`
> - covers daily signal upserts and the equivalent quarterly-key pattern
> - covers trading-calendar-driven OHLCV gap fill and synthetic-row hygiene
>
> **Operational posture**
> - closes with freshness checks, row-count inspection, and emergency cleanup patterns for forward-filled rows

> [!note]- Glossary
>
> **Silver layer**
> - The cleaned, deduplicated, historically meaningful layer between raw bronze landing tables and consumer-facing gold outputs.
> - It matters because the PostgreSQL transforms in this note deliberately change persistence rules, uniqueness rules, and time-series behavior.
>
> ---
>
> **SCD Type 2**
> - A slowly changing dimension pattern that closes the previous row and inserts a new current row when tracked attributes change.
> - It matters because `silver.index_dim` is the first durable history surface in the medallion flow.
>
> ---
>
> **Partial unique index**
> - A PostgreSQL index that enforces uniqueness only on rows matching a predicate such as `is_current`.
> - It matters because it is the PostgreSQL equivalent of SQL Server's filtered unique index for active SCD rows.
>
> ---
>
> **Authoritative row**
> - The single silver row that the pipeline treats as correct for one business key at one time grain.
> - It matters because downstream scoring logic should not have to choose between duplicates.
>
> ---
>
> **Gap fill**
> - The insertion of expected-but-missing dates into a time series using a deterministic rule.
> - It matters because moving averages, ranks, and returns behave badly when a market series silently skips open trading days.
>
> ---
>
> **Forward fill**
> - A gap-fill method that carries the last known real value forward to a missing date.
> - It matters because OHLCV repair rows are operationally useful only if they remain explicitly marked as synthetic.
>
> ---
>
> **Freshness check**
> - A validation query that proves silver contains the latest expected real rows rather than only technically successful pipeline runs.
> - It matters because orchestration success and data currency are different questions.

## Silver DDL

Silver tables enforce a stronger contract than bronze. PostgreSQL gives that contract three main building blocks: ordinary `UNIQUE` indexes for one-row-per-key facts, partial unique indexes for one-current-row dimensions, and `ON CONFLICT` for deterministic upsert behavior. The current lab already contains populated silver tables, so the first step is to inspect the live surface before documenting the recommended PostgreSQL constraints.

### Live silver surface

The silver schema already contains the dimension, signal, and OHLCV tables that the transforms write into. This inspection query is appropriate during migration review, first-run verification, or schema-drift analysis when the operator needs to prove which silver tables exist and roughly how large they already are. It runs read-only against PostgreSQL catalog and statistics views and requires only metadata visibility. Its purpose is to establish the real target surface before any transform logic is discussed.

#### Inspect the current silver tables and row volumes

| Field | Meaning |
|---|---|
| `table_name` | Silver table name from `information_schema.tables`. |
| `approx_rows` | Approximate live row count from `pg_stat_user_tables.n_live_tup`. |

*This query inventories the current silver tables and their approximate row counts.*

```sql
SELECT t.table_name,
       COALESCE(s.n_live_tup, 0) AS approx_rows
FROM information_schema.tables AS t
LEFT JOIN pg_stat_user_tables AS s
  ON s.schemaname = t.table_schema
 AND s.relname = t.table_name
WHERE t.table_schema = 'silver'
ORDER BY t.table_name;
```

```text
    table_name     | approx_rows
-------------------+-------------
 eurostoxx50_ohlcv |       67155
 index_dim         |         169
 oil20_ohlcv       |       25080
 signals_daily     |         635
 signals_quarterly |         188
 stoxxasia50_ohlcv |       64875
 stoxxusa50_ohlcv  |       66000
(7 rows)
```

The current volumes match a working medallion surface: one silver dimension table, two signal tables, and four market-history tables. `n_live_tup` is statistics-based rather than transactionally exact, but it is the right operational first pass because it avoids forcing a full `COUNT(*)` across the large OHLCV tables.

The next check matters because idempotent silver transforms depend on the target actually enforcing their business keys. It is typically triggered during migration validation or after any DDL refactor when the operator needs to confirm that the physical index posture still matches the intended loader behavior. The query is read-only and runs against `pg_indexes`. Its purpose is to show whether silver currently enforces only surrogate keys or also enforces business-key uniqueness.

#### Inspect the current index posture

| Field | Meaning |
|---|---|
| `tablename` | Silver table owning the index. |
| `indexname` | PostgreSQL index name. |
| `indexdef` | Full `CREATE INDEX` definition stored in the catalog. |

*This query shows every live index currently defined on the silver schema.*

```sql
SELECT tablename,
       indexname,
       indexdef
FROM pg_indexes
WHERE schemaname = 'silver'
ORDER BY tablename, indexname;
```

```text
     tablename     |       indexname        |                                        indexdef
-------------------+------------------------+-----------------------------------------------------------------------------------------
 eurostoxx50_ohlcv | eurostoxx50_ohlcv_pkey | CREATE UNIQUE INDEX eurostoxx50_ohlcv_pkey ON silver.eurostoxx50_ohlcv USING btree (id)
 index_dim         | index_dim_pkey         | CREATE UNIQUE INDEX index_dim_pkey ON silver.index_dim USING btree (id)
 oil20_ohlcv       | oil20_ohlcv_pkey       | CREATE UNIQUE INDEX oil20_ohlcv_pkey ON silver.oil20_ohlcv USING btree (id)
 signals_daily     | signals_daily_pkey     | CREATE UNIQUE INDEX signals_daily_pkey ON silver.signals_daily USING btree (id)
 signals_quarterly | signals_quarterly_pkey | CREATE UNIQUE INDEX signals_quarterly_pkey ON silver.signals_quarterly USING btree (id)
 stoxxasia50_ohlcv | stoxxasia50_ohlcv_pkey | CREATE UNIQUE INDEX stoxxasia50_ohlcv_pkey ON silver.stoxxasia50_ohlcv USING btree (id)
 stoxxusa50_ohlcv  | stoxxusa50_ohlcv_pkey  | CREATE UNIQUE INDEX stoxxusa50_ohlcv_pkey ON silver.stoxxusa50_ohlcv USING btree (id)
(7 rows)
```

The migrated lab currently enforces only surrogate-key primary keys. The data itself is distinct by business key today, but the tables are not yet protected against duplicate `(_index, symbol, signal_date)` or duplicate current SCD rows. That is the key operational difference between "the lab contains silver data" and "the loader contract is fully enforced by PostgreSQL."

### Recommended constraint design

The following transaction-scoped examples show the PostgreSQL DDL that serves the same teaching purpose as the SQL Server silver note. They are appropriate when documenting the intended transform contract, validating DDL in a scratch session, or proving how PostgreSQL expresses the same uniqueness rules without changing the live silver tables. Each block is state-changing inside the session but rolled back at the end. Their purpose is to demonstrate the correct PostgreSQL design safely.

#### Create an SCD Type 2 dimension table with a partial unique index

| Field | Meaning |
|---|---|
| `indexname` | Name of the temporary demo index. |
| `indexdef` | Full PostgreSQL definition showing the predicate-backed uniqueness rule. |

*This transaction creates a temporary SCD table and proves that PostgreSQL uses a partial unique index for the active-row rule.*

```sql
BEGIN;

CREATE TEMP TABLE note03_index_dim_demo (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    _index varchar(20) NOT NULL,
    symbol varchar(20) NOT NULL,
    sector varchar(100),
    valid_from timestamp NOT NULL DEFAULT clock_timestamp(),
    valid_to timestamp,
    is_current boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX note03_index_dim_demo_current_uq
    ON note03_index_dim_demo (_index, symbol)
    WHERE is_current;

SELECT indexname,
       indexdef
FROM pg_indexes
WHERE tablename = 'note03_index_dim_demo'
ORDER BY indexname;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
CREATE INDEX
            indexname             |                                                              indexdef
----------------------------------+-------------------------------------------------------------------------------------------------------------------------------------
 note03_index_dim_demo_current_uq | CREATE UNIQUE INDEX note03_index_dim_demo_current_uq ON pg_temp.note03_index_dim_demo USING btree (_index, symbol) WHERE is_current
 note03_index_dim_demo_pkey       | CREATE UNIQUE INDEX note03_index_dim_demo_pkey ON pg_temp.note03_index_dim_demo USING btree (id)
(2 rows)

ROLLBACK
```

`WHERE is_current` is the PostgreSQL equivalent of the SQL Server filtered unique index. Only rows flagged current participate in the uniqueness check, which lets the dimension keep many historical versions for the same `(_index, symbol)` pair while still preventing two active rows.

#### Create signal tables with business-key unique indexes

| Field | Meaning |
|---|---|
| `tablename` | Temporary signal table being inspected. |
| `indexname` | Primary-key or business-key index name. |
| `indexdef` | Physical index definition showing which business columns PostgreSQL enforces. |

*This transaction creates daily and quarterly signal demos and shows the required business-key indexes.*

```sql
BEGIN;

CREATE TEMP TABLE note03_signals_daily_demo (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    _index varchar(20) NOT NULL,
    symbol varchar(20) NOT NULL,
    signal_date date NOT NULL,
    current_price double precision,
    recommendation_mean double precision
);

CREATE UNIQUE INDEX note03_signals_daily_demo_business_uq
    ON note03_signals_daily_demo (_index, symbol, signal_date);

CREATE TEMP TABLE note03_signals_quarterly_demo (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    _index varchar(20) NOT NULL,
    symbol varchar(20) NOT NULL,
    as_of_date date NOT NULL,
    gross_margins double precision,
    esg_populated boolean
);

CREATE UNIQUE INDEX note03_signals_quarterly_demo_business_uq
    ON note03_signals_quarterly_demo (_index, symbol, as_of_date);

SELECT tablename,
       indexname,
       indexdef
FROM pg_indexes
WHERE tablename IN ('note03_signals_daily_demo', 'note03_signals_quarterly_demo')
ORDER BY tablename, indexname;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
           tablename           |                 indexname                 |                                                                    indexdef
-------------------------------+-------------------------------------------+-------------------------------------------------------------------------------------------------------------------------------------------------
 note03_signals_daily_demo     | note03_signals_daily_demo_business_uq     | CREATE UNIQUE INDEX note03_signals_daily_demo_business_uq ON pg_temp.note03_signals_daily_demo USING btree (_index, symbol, signal_date)
 note03_signals_daily_demo     | note03_signals_daily_demo_pkey            | CREATE UNIQUE INDEX note03_signals_daily_demo_pkey ON pg_temp.note03_signals_daily_demo USING btree (id)
 note03_signals_quarterly_demo | note03_signals_quarterly_demo_business_uq | CREATE UNIQUE INDEX note03_signals_quarterly_demo_business_uq ON pg_temp.note03_signals_quarterly_demo USING btree (_index, symbol, as_of_date)
 note03_signals_quarterly_demo | note03_signals_quarterly_demo_pkey        | CREATE UNIQUE INDEX note03_signals_quarterly_demo_pkey ON pg_temp.note03_signals_quarterly_demo USING btree (id)
(4 rows)

ROLLBACK
```

These are ordinary unique indexes rather than partial ones because every fact row participates in the business rule. The daily table guarantees one row per stock per date. The quarterly table guarantees one row per stock per reporting date. `ON CONFLICT` only becomes a safe silver publish surface once those uniqueness boundaries are real.

#### Inspect the row shape after an attribute change closes and reopens an SCD record

| Field | Meaning |
|---|---|
| `_index`, `symbol` | Business key of the dimension member. |
| `sector` | Example tracked attribute that changed. |
| `valid_from` | Timestamp when the row version became current. |
| `valid_to` | Timestamp when the row stopped being current. |
| `is_current` | Boolean flag marking the active version. |

*This transaction shows the final two-row SCD Type 2 state after one attribute change.*

```sql
BEGIN;

CREATE TEMP TABLE note03_scd_demo (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    _index text NOT NULL,
    symbol text NOT NULL,
    sector text,
    valid_from timestamp NOT NULL DEFAULT clock_timestamp(),
    valid_to timestamp,
    is_current boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX note03_scd_demo_current_uq
    ON note03_scd_demo (_index, symbol)
    WHERE is_current;

INSERT INTO note03_scd_demo (_index, symbol, sector, valid_from)
VALUES ('market_index', 'ASML.AS', 'Technology', '2024-01-15 00:00:00');

UPDATE note03_scd_demo
SET valid_to = '2025-06-01 00:00:00',
    is_current = false
WHERE _index = 'market_index'
  AND symbol = 'ASML.AS'
  AND is_current;

INSERT INTO note03_scd_demo (_index, symbol, sector, valid_from)
VALUES ('market_index', 'ASML.AS', 'Semiconductors', '2025-06-01 00:00:00');

SELECT _index,
       symbol,
       sector,
       valid_from,
       valid_to,
       is_current
FROM note03_scd_demo
ORDER BY valid_from;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
CREATE INDEX
INSERT 0 1
UPDATE 1
INSERT 0 1
    _index    | symbol  |     sector     |     valid_from      |      valid_to       | is_current
--------------+---------+----------------+---------------------+---------------------+------------
 market_index | ASML.AS | Technology     | 2024-01-15 00:00:00 | 2025-06-01 00:00:00 | f
 market_index | ASML.AS | Semiconductors | 2025-06-01 00:00:00 |                     | t
(2 rows)

ROLLBACK
```

This is the exact SCD Type 2 outcome the silver layer is trying to preserve: history stays queryable, the previous version is explicitly closed, and only one row remains active for the business key.

## SCD Type 2 Transform — Index Dimensions

The silver dimension transform reads the full bronze snapshot, compares it to the current silver state, closes any changed active row, and inserts the new version. PostgreSQL does not need a special SCD feature for this; the pattern is ordinary DML plus a partial unique index and disciplined sequencing.

### Read paths for comparison

The bronze read is appropriate during transform development, validation, or incident triage when the operator needs to prove what the latest landed metadata snapshot currently says. It is normally triggered before any SCD comparison step. The query is read-only against `bronze.index_dim`, requires standard `SELECT` access, and its purpose is to capture the source-of-truth snapshot that silver will compare against.

#### Read the full bronze dimension snapshot

| Field | Meaning |
|---|---|
| `_index`, `symbol` | Business key identifying the constituent within an index. |
| `sector` | Example tracked attribute used here to show a meaningful dimension change. |
| `range_start` | Start of source availability for the instrument in the upstream feed. |
| `price_data_start` | First date with price history expected for the instrument. |

*This query reads representative rows from the live bronze dimension snapshot.*

```sql
SELECT _index,
       symbol,
       sector,
       range_start,
       price_data_start
FROM bronze.index_dim
ORDER BY symbol
LIMIT 5;
```

```text
    _index     | symbol  |       sector       | range_start | price_data_start
---------------+---------+--------------------+-------------+------------------
 stoxx_asia_50 | 0388.HK | Financial Services | 2000-06-27  | 2021-01-01
 stoxx_asia_50 | 1299.HK | Financial Services | 2010-10-29  | 2021-01-01
 stoxx_asia_50 | 1810.HK | Technology         | 2018-07-09  | 2021-01-01
 stoxx_asia_50 | 2269.HK | Healthcare         | 2017-06-13  | 2021-01-01
 stoxx_asia_50 | 3382.T  | Consumer Defensive | 2000-01-04  | 2021-01-01
(5 rows)
```

The silver-side read belongs immediately after the bronze snapshot has been materialized in memory or a staging structure. It is triggered by the need to know which versions are currently active and whether any history already exists. The query is read-only against `silver.index_dim`. Its purpose is to restrict SCD comparison to the active record set because historical rows are not candidates for closure a second time.

#### Read only the current silver rows

| Field | Meaning |
|---|---|
| `total_rows` | Total rows currently stored in `silver.index_dim`. |
| `current_rows` | Rows where `is_current = true`. |
| `historical_rows` | Closed rows where `is_current = false`. |
| `distinct_business_keys` | Distinct `(_index, symbol)` combinations currently represented. |
| `valid_from`, `valid_to`, `is_current` | SCD state columns showing whether a row is active or closed. |

*This query proves that the current lab holds only active dimension rows today and then samples those active rows.*

```sql
SELECT COUNT(*) AS total_rows,
       COUNT(*) FILTER (WHERE is_current) AS current_rows,
       COUNT(*) FILTER (WHERE NOT is_current) AS historical_rows,
       COUNT(DISTINCT (_index, symbol)) AS distinct_business_keys
FROM silver.index_dim;

SELECT _index,
       symbol,
       sector,
       valid_from,
       valid_to,
       is_current
FROM silver.index_dim
ORDER BY symbol
LIMIT 5;
```

```text
 total_rows | current_rows | historical_rows | distinct_business_keys
------------+--------------+-----------------+------------------------
        169 |          169 |               0 |                    169
(1 row)

    _index     | symbol  |       sector       |         valid_from         | valid_to | is_current
---------------+---------+--------------------+----------------------------+----------+------------
 stoxx_asia_50 | 0388.HK | Financial Services | 2026-03-04 22:11:36.30016  |          | t
 stoxx_asia_50 | 1299.HK | Financial Services | 2026-03-04 22:11:36.263401 |          | t
 stoxx_asia_50 | 1810.HK | Technology         | 2026-03-04 22:11:36.328825 |          | t
 stoxx_asia_50 | 2269.HK | Healthcare         | 2026-03-04 22:11:36.328825 |          | t
 stoxx_asia_50 | 3382.T  | Consumer Defensive | 2026-03-04 22:11:36.316571 |          | t
(5 rows)
```

The current silver dimension is populated but not yet historized in the lab: every row is current, no rows are closed, and the business-key distinct count matches the row count exactly. That is a valid migrated starting point, but it means SCD history will only begin once the transform actually observes a changed attribute and the business-key uniqueness rule is enforced.

### Write sequence for changes

The close step is the critical operation when one or more tracked attributes changed for a business key already present in silver. It is typically triggered after the bronze-versus-silver comparison has identified a difference and before any new version is inserted. The block is state-changing, but transaction-scoped and rolled back. Its purpose is to show that the old active row must be closed first so the partial unique index stops protecting that key as current.

#### Close the current row before opening a new version

| Field | Meaning |
|---|---|
| `sector` | Attribute that changed and triggered the SCD event. |
| `valid_from` | Start of the original row's active period. |
| `valid_to` | Closure time written by the update step. |
| `is_current` | Active flag after the close step. |

*This transaction closes the existing active row and shows its post-update state.*

```sql
BEGIN;

CREATE TEMP TABLE note03_scd_demo (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    _index text NOT NULL,
    symbol text NOT NULL,
    sector text,
    valid_from timestamp NOT NULL DEFAULT clock_timestamp(),
    valid_to timestamp,
    is_current boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX note03_scd_demo_current_uq
    ON note03_scd_demo (_index, symbol)
    WHERE is_current;

INSERT INTO note03_scd_demo (_index, symbol, sector, valid_from)
VALUES ('market_index', 'ASML.AS', 'Technology', '2024-01-15 00:00:00');

UPDATE note03_scd_demo
SET valid_to = '2025-06-01 00:00:00',
    is_current = false
WHERE _index = 'market_index'
  AND symbol = 'ASML.AS'
  AND is_current;

SELECT _index,
       symbol,
       sector,
       valid_from,
       valid_to,
       is_current
FROM note03_scd_demo;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
CREATE INDEX
INSERT 0 1
UPDATE 1
    _index    | symbol  |   sector   |     valid_from      |      valid_to       | is_current
--------------+---------+------------+---------------------+---------------------+------------
 market_index | ASML.AS | Technology | 2024-01-15 00:00:00 | 2025-06-01 00:00:00 | f
(1 row)

ROLLBACK
```

Once the close step has succeeded, the new version insert becomes legal and deterministic. It is triggered immediately after the active row has been closed or when a new business key appears for the first time. The transaction is state-changing only inside the scratch scope. Its purpose is to show the final two-row history that the silver dimension should retain.

#### Insert the new current version after the close step

| Field | Meaning |
|---|---|
| `sector` | Old and new attribute values across the SCD boundary. |
| `valid_from` | Start of each row version. |
| `valid_to` | End of the closed row's validity period. |
| `is_current` | Indicator of which row remains active after the insert. |

*This transaction closes the old version, inserts the new version, and returns the final SCD history.*

```sql
BEGIN;

CREATE TEMP TABLE note03_scd_demo (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    _index text NOT NULL,
    symbol text NOT NULL,
    sector text,
    valid_from timestamp NOT NULL DEFAULT clock_timestamp(),
    valid_to timestamp,
    is_current boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX note03_scd_demo_current_uq
    ON note03_scd_demo (_index, symbol)
    WHERE is_current;

INSERT INTO note03_scd_demo (_index, symbol, sector, valid_from)
VALUES ('market_index', 'ASML.AS', 'Technology', '2024-01-15 00:00:00');

UPDATE note03_scd_demo
SET valid_to = '2025-06-01 00:00:00',
    is_current = false
WHERE _index = 'market_index'
  AND symbol = 'ASML.AS'
  AND is_current;

INSERT INTO note03_scd_demo (_index, symbol, sector, valid_from)
VALUES ('market_index', 'ASML.AS', 'Semiconductors', '2025-06-01 00:00:00');

SELECT _index,
       symbol,
       sector,
       valid_from,
       valid_to,
       is_current
FROM note03_scd_demo
ORDER BY valid_from;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
CREATE INDEX
INSERT 0 1
UPDATE 1
INSERT 0 1
    _index    | symbol  |     sector     |     valid_from      |      valid_to       | is_current
--------------+---------+----------------+---------------------+---------------------+------------
 market_index | ASML.AS | Technology     | 2024-01-15 00:00:00 | 2025-06-01 00:00:00 | f
 market_index | ASML.AS | Semiconductors | 2025-06-01 00:00:00 |                     | t
(2 rows)

ROLLBACK
```

## Upsert — Daily Signals

The daily signal transform preserves one row per `(_index, symbol, signal_date)` while allowing newer source values to update an existing date. In PostgreSQL that means a unique business key plus `INSERT ... ON CONFLICT DO UPDATE`, usually with an `IS DISTINCT FROM` predicate so unchanged rows are skipped instead of being rewritten unnecessarily.

### Live source and target keys

The existing silver read is appropriate when a batch is about to publish today's signal snapshot or when an operator needs to see what the durable target currently holds for the latest date. It is typically triggered before the upsert statement runs. The query is read-only against `silver.signals_daily`. Its purpose is to show the target grain and confirm that silver already stores a date-based signal history rather than a transient intraday snapshot.

#### Load existing silver daily keys for comparison

| Field | Meaning |
|---|---|
| `_index`, `symbol` | Business key prefix for the signal row. |
| `signal_date` | Silver grain used by the daily upsert. |
| `current_price`, `recommendation_mean` | Example signal values used to detect whether an existing row changed. |

*This query samples the latest durable daily rows already present in silver.*

```sql
SELECT _index,
       symbol,
       signal_date,
       current_price,
       recommendation_mean
FROM silver.signals_daily
ORDER BY signal_date DESC, symbol
LIMIT 5;
```

```text
    _index     | symbol  | signal_date | current_price | recommendation_mean
---------------+---------+-------------+---------------+---------------------
 stoxx_asia_50 | 0388.HK | 2026-04-08  |           396 |                 1.4
 stoxx_asia_50 | 1299.HK | 2026-04-08  |         86.15 |             1.28571
 stoxx_asia_50 | 1810.HK | 2026-04-08  |         30.88 |             1.74286
 stoxx_asia_50 | 2269.HK | 2026-04-08  |         34.98 |             1.55556
 stoxx_asia_50 | 3382.T  | 2026-04-08  |          2231 |             2.33333
(5 rows)
```

The bronze-side read belongs immediately before publish because bronze keeps a latest snapshot and silver has to decide whether that snapshot inserts a new date, updates an existing date, or can be skipped. It is triggered by the current batch arrival. The query is read-only against `bronze.signals_daily`. Its purpose is to normalize bronze's timestamped rows to the silver date grain.

#### Read the bronze snapshot at the silver date grain

| Field | Meaning |
|---|---|
| `timestamp` cast to `signal_date` | Converts the bronze intraday timestamp to the daily silver key. |
| `current_price`, `recommendation_mean` | Representative value columns used during change detection. |

*This query casts the bronze timestamp to a date so the snapshot matches silver's daily key.*

```sql
SELECT _index,
       symbol,
       CAST(timestamp AS date) AS signal_date,
       current_price,
       recommendation_mean
FROM bronze.signals_daily
ORDER BY timestamp DESC, symbol
LIMIT 5;
```

```text
    _index    | symbol | signal_date | current_price | recommendation_mean
--------------+--------+-------------+---------------+---------------------
 stoxx_usa_50 | CRM    | 2026-04-08  |        182.96 |                1.62
 stoxx_usa_50 | UBER   | 2026-04-08  |         71.73 |             1.54545
 stoxx_usa_50 | AXP    | 2026-04-08  |        307.03 |             2.39286
 stoxx_usa_50 | VZ     | 2026-04-08  |         48.62 |                2.24
 stoxx_usa_50 | IBM    | 2026-04-08  |        245.07 |
(5 rows)
```

### PostgreSQL upsert pattern

The publish statement is appropriate once the bronze snapshot has been validated and the business-key unique index exists on the silver target. It is triggered by a ready-to-publish batch. The statement is state-changing, but the example below runs only in a scratch transaction. Its purpose is to show the three real silver outcomes: insert a new key, update a changed key, and skip an unchanged key without rewriting it.

#### Upsert changed rows and skip identical rows

| Field | Meaning |
|---|---|
| `inserted_rows` | Rows inserted because the business key was not already present. |
| `updated_rows` | Existing rows changed by `ON CONFLICT DO UPDATE`. |
| `skipped_rows` | Source rows that matched an existing target row and were not rewritten because the values were unchanged. |

*This transaction uses `ON CONFLICT` plus `IS DISTINCT FROM` to produce deterministic insert, update, and skip counts.*

```sql
BEGIN;

CREATE TEMP TABLE note03_signals_daily_demo (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    _index text NOT NULL,
    symbol text NOT NULL,
    signal_date date NOT NULL,
    current_price double precision,
    recommendation_mean double precision
);

CREATE UNIQUE INDEX note03_signals_daily_demo_business_uq
    ON note03_signals_daily_demo (_index, symbol, signal_date);

INSERT INTO note03_signals_daily_demo (_index, symbol, signal_date, current_price, recommendation_mean)
VALUES
    ('stoxx_usa_50', 'AAPL', DATE '2026-04-08', 200.0, 2.0),
    ('stoxx_usa_50', 'MSFT', DATE '2026-04-08', 300.0, 1.8);

WITH bronze_snapshot AS (
    SELECT *
    FROM (VALUES
        ('stoxx_usa_50', 'AAPL', DATE '2026-04-08', 205.0::double precision, 1.9::double precision),
        ('stoxx_usa_50', 'MSFT', DATE '2026-04-08', 300.0::double precision, 1.8::double precision),
        ('stoxx_usa_50', 'NVDA', DATE '2026-04-08', 900.0::double precision, 1.6::double precision)
    ) AS v(_index, symbol, signal_date, current_price, recommendation_mean)
),
upserted AS (
    INSERT INTO note03_signals_daily_demo (_index, symbol, signal_date, current_price, recommendation_mean)
    SELECT _index, symbol, signal_date, current_price, recommendation_mean
    FROM bronze_snapshot
    ON CONFLICT (_index, symbol, signal_date) DO UPDATE
    SET current_price = EXCLUDED.current_price,
        recommendation_mean = EXCLUDED.recommendation_mean
    WHERE note03_signals_daily_demo.current_price IS DISTINCT FROM EXCLUDED.current_price
       OR note03_signals_daily_demo.recommendation_mean IS DISTINCT FROM EXCLUDED.recommendation_mean
    RETURNING (xmax = 0) AS inserted
)
SELECT COUNT(*) FILTER (WHERE inserted) AS inserted_rows,
       COUNT(*) FILTER (WHERE NOT inserted) AS updated_rows,
       (SELECT COUNT(*) FROM bronze_snapshot) - COUNT(*) AS skipped_rows
FROM upserted;

SELECT _index,
       symbol,
       signal_date,
       current_price,
       recommendation_mean
FROM note03_signals_daily_demo
ORDER BY symbol;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
CREATE INDEX
INSERT 0 2
 inserted_rows | updated_rows | skipped_rows
---------------+--------------+--------------
             1 |            1 |            1
(1 row)

    _index    | symbol | signal_date | current_price | recommendation_mean
--------------+--------+-------------+---------------+---------------------
 stoxx_usa_50 | AAPL   | 2026-04-08  |           205 |                 1.9
 stoxx_usa_50 | MSFT   | 2026-04-08  |           300 |                 1.8
 stoxx_usa_50 | NVDA   | 2026-04-08  |           900 |                 1.6
(3 rows)

ROLLBACK
```

This is the core PostgreSQL replacement for the SQL Server merge-style teaching point. A unique index enforces the grain, `ON CONFLICT` handles insert-versus-update, and `IS DISTINCT FROM` avoids rewriting identical rows. `silver.signals_quarterly` follows the same pattern with the key changed to `(_index, symbol, as_of_date)`.

## OHLCV Gap-Fill Transform

The OHLCV transform uses the trading calendar to detect dates that should exist for an open market but do not yet exist in silver. PostgreSQL does not need a different conceptual model than SQL Server here, but the implementation idioms matter: anti-joins stay read-only and inexpensive, forward-fill inserts should remain bounded, and synthetic rows should always remain traceable through `is_filled`.

### Detecting and repairing gaps

Gap detection is appropriate after a source load has landed and before downstream analytics assume the series is continuous. It is triggered by a missing-date suspicion, by a regular silver repair step, or by freshness validation that shows a market fell behind its expected calendar. The example below is state-changing only inside temporary tables. Its purpose is to show the anti-join shape that identifies one missing trading day cleanly.

#### Identify missing trading days with a `NOT EXISTS` anti-join

| Field | Meaning |
|---|---|
| `exchange_code` | Trading calendar code used to select the expected market schedule. |
| `date` | Expected trading date being checked for a matching OHLCV row. |
| `is_trading_day` | Calendar flag limiting the scan to dates that should have a row. |

*This transaction builds a three-day trading calendar and returns the one missing OHLCV date.*

```sql
BEGIN;

CREATE TEMP TABLE note03_trading_calendar_demo (
    exchange_code text NOT NULL,
    date date NOT NULL,
    is_trading_day boolean NOT NULL
);

CREATE TEMP TABLE note03_ohlcv_demo (
    symbol text NOT NULL,
    date date NOT NULL,
    close double precision NOT NULL,
    adj_close double precision NOT NULL,
    volume bigint NOT NULL,
    dividends double precision NOT NULL,
    stock_splits double precision NOT NULL,
    is_filled boolean NOT NULL DEFAULT false
);

INSERT INTO note03_trading_calendar_demo (exchange_code, date, is_trading_day)
VALUES
    ('XNAS', DATE '2026-04-07', true),
    ('XNAS', DATE '2026-04-08', true),
    ('XNAS', DATE '2026-04-09', true);

INSERT INTO note03_ohlcv_demo (symbol, date, close, adj_close, volume, dividends, stock_splits, is_filled)
VALUES
    ('AAPL', DATE '2026-04-07', 200.00, 200.00, 1000000, 0, 0, false),
    ('AAPL', DATE '2026-04-09', 204.00, 204.00, 1250000, 0, 0, false);

SELECT c.date
FROM note03_trading_calendar_demo AS c
WHERE c.exchange_code = 'XNAS'
  AND c.is_trading_day
  AND c.date BETWEEN DATE '2026-04-07' AND DATE '2026-04-09'
  AND NOT EXISTS (
      SELECT 1
      FROM note03_ohlcv_demo AS o
      WHERE o.symbol = 'AAPL'
        AND o.date = c.date
  )
ORDER BY c.date;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
CREATE TABLE
INSERT 0 3
INSERT 0 2
    date
------------
 2026-04-08
(1 row)

ROLLBACK
```

Once the missing dates are known, the forward-fill insert is appropriate only when the pipeline has a documented rule that allows synthetic continuity rows. It is triggered by a confirmed missing trading day rather than by a generic "date is absent" condition. The transaction is state-changing only inside the demo scope. Its purpose is to show the standard repair shape: copy the last real close forward, zero the volume-like fields, and mark the row synthetic.

#### Forward-fill the missing day from the last real close

| Field | Meaning |
|---|---|
| `open`, `high`, `low`, `close` | Forward-filled price columns derived from the last real close. |
| `volume` | Zero because no real trading occurred for the synthetic row. |
| `is_filled` | Boolean marker distinguishing inferred rows from real source rows. |

*This transaction inserts one synthetic OHLCV row and returns the repaired three-day series.*

```sql
BEGIN;

CREATE TEMP TABLE note03_trading_calendar_demo (
    exchange_code text NOT NULL,
    date date NOT NULL,
    is_trading_day boolean NOT NULL
);

CREATE TEMP TABLE note03_ohlcv_demo (
    symbol text NOT NULL,
    date date NOT NULL,
    open double precision,
    high double precision,
    low double precision,
    close double precision NOT NULL,
    adj_close double precision NOT NULL,
    volume bigint NOT NULL,
    dividends double precision NOT NULL,
    stock_splits double precision NOT NULL,
    is_filled boolean NOT NULL DEFAULT false
);

INSERT INTO note03_trading_calendar_demo (exchange_code, date, is_trading_day)
VALUES
    ('XNAS', DATE '2026-04-07', true),
    ('XNAS', DATE '2026-04-08', true),
    ('XNAS', DATE '2026-04-09', true);

INSERT INTO note03_ohlcv_demo (symbol, date, open, high, low, close, adj_close, volume, dividends, stock_splits, is_filled)
VALUES
    ('AAPL', DATE '2026-04-07', 200.00, 201.00, 199.00, 200.00, 200.00, 1000000, 0, 0, false),
    ('AAPL', DATE '2026-04-09', 204.00, 205.00, 203.00, 204.00, 204.00, 1250000, 0, 0, false);

INSERT INTO note03_ohlcv_demo (
    symbol,
    date,
    open,
    high,
    low,
    close,
    adj_close,
    volume,
    dividends,
    stock_splits,
    is_filled
)
SELECT o.symbol,
       DATE '2026-04-08',
       o.close,
       o.close,
       o.close,
       o.close,
       o.adj_close,
       0,
       0,
       0,
       true
FROM note03_ohlcv_demo AS o
WHERE o.symbol = 'AAPL'
  AND o.date = (
      SELECT MAX(date)
      FROM note03_ohlcv_demo
      WHERE symbol = 'AAPL'
        AND date < DATE '2026-04-08'
        AND NOT is_filled
  );

SELECT symbol,
       date,
       open,
       high,
       low,
       close,
       volume,
       is_filled
FROM note03_ohlcv_demo
ORDER BY date;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
CREATE TABLE
INSERT 0 3
INSERT 0 2
INSERT 0 1
 symbol |    date    | open | high | low | close | volume  | is_filled
--------+------------+------+------+-----+-------+---------+-----------
 AAPL   | 2026-04-07 |  200 |  201 | 199 |   200 | 1000000 | f
 AAPL   | 2026-04-08 |  200 |  200 | 200 |   200 |       0 | t
 AAPL   | 2026-04-09 |  204 |  205 | 203 |   204 | 1250000 | f
(3 rows)

ROLLBACK
```

Forward fill is useful only when it stays bounded. A synthetic row dated beyond the current date is an operational mistake, not a repair. The verification query below is appropriate after any gap-fill run or during daily health checks. It is read-only against the live silver OHLCV tables. Its purpose is to prove that no future-dated synthetic rows currently survive in the production-like lab.

#### Verify that no future-dated synthetic rows survive

| Field | Meaning |
|---|---|
| `market` | Silver OHLCV table family being checked. |
| `future_filled_rows` | Count of `is_filled = true` rows dated after `CURRENT_DATE`. |

*This query checks every live silver OHLCV table for future-dated synthetic rows.*

```sql
SELECT 'eurostoxx50' AS market,
       COUNT(*) AS future_filled_rows
FROM silver.eurostoxx50_ohlcv
WHERE is_filled
  AND date > CURRENT_DATE
UNION ALL
SELECT 'stoxxasia50', COUNT(*)
FROM silver.stoxxasia50_ohlcv
WHERE is_filled
  AND date > CURRENT_DATE
UNION ALL
SELECT 'stoxxusa50', COUNT(*)
FROM silver.stoxxusa50_ohlcv
WHERE is_filled
  AND date > CURRENT_DATE
UNION ALL
SELECT 'oil20', COUNT(*)
FROM silver.oil20_ohlcv
WHERE is_filled
  AND date > CURRENT_DATE
ORDER BY market;
```

```text
   market    | future_filled_rows
-------------+--------------------
 eurostoxx50 |                  0
 oil20       |                  0
 stoxxasia50 |                  0
 stoxxusa50  |                  0
(4 rows)
```

The live lab currently has no future-dated filled rows. That is the healthy baseline: the repair mechanism may be available, but it is not currently leaking synthetic dates beyond the legitimate trading horizon.

### Silver index design

Silver's index rules are about data correctness first and performance second. The same business-key indexes that make the transforms safe also make existence checks and `ON CONFLICT` resolution cheap.

| Table pattern | PostgreSQL index rule | Why it matters |
|---|---|---|
| `silver.index_dim` | `UNIQUE (_index, symbol) WHERE is_current` | Allows unlimited history while still enforcing one active row per business key. |
| `silver.signals_daily` | `UNIQUE (_index, symbol, signal_date)` | Prevents duplicate daily signal rows and anchors the upsert target. |
| `silver.signals_quarterly` | `UNIQUE (_index, symbol, as_of_date)` | Prevents duplicate quarter snapshots and anchors the quarterly upsert target. |
| `silver.*_ohlcv` | `UNIQUE (symbol, date)` | Prevents duplicate market rows and protects gap-fill inserts from colliding with real data. |

### Key PostgreSQL techniques used in silver transforms

| Technique | Where it appears | Why it is the PostgreSQL fit |
|---|---|---|
| Partial unique index | `silver.index_dim` | Native replacement for SQL Server filtered unique indexes. |
| `clock_timestamp()` or `CURRENT_TIMESTAMP` | SCD timestamps | Records closure and open times in PostgreSQL-native syntax. |
| `INSERT ... ON CONFLICT DO UPDATE` | Signal upserts and bounded corrections | Replaces merge-style publish logic with a simpler constraint-backed pattern. |
| `IS DISTINCT FROM` | Upsert change detection | Treats `NULL` safely when deciding whether a row really changed. |
| `NOT EXISTS` anti-join | Gap detection | Finds expected calendar dates that do not yet exist in silver. |
| Synthetic row marker | `is_filled` in OHLCV | Preserves the audit boundary between source rows and inferred continuity rows. |

## Useful Data Freshness Queries

Silver transforms are only valuable if the layer is current, internally consistent, and easy to repair safely. These checks are appropriate after a pipeline run, during incident triage, or inside recurring operational monitoring.

#### Check the latest real OHLCV date in each silver market table

| Field | Meaning |
|---|---|
| `market` | Silver OHLCV table family being inspected. |
| `latest_real_date` | Latest row where `is_filled = false`, excluding synthetic forward-fill rows. |

*This query shows the freshest real market date currently available in each silver OHLCV table.*

```sql
SELECT 'eurostoxx50' AS market, MAX(date) AS latest_real_date
FROM silver.eurostoxx50_ohlcv
WHERE NOT is_filled
UNION ALL
SELECT 'stoxxasia50', MAX(date)
FROM silver.stoxxasia50_ohlcv
WHERE NOT is_filled
UNION ALL
SELECT 'stoxxusa50', MAX(date)
FROM silver.stoxxusa50_ohlcv
WHERE NOT is_filled
UNION ALL
SELECT 'oil20', MAX(date)
FROM silver.oil20_ohlcv
WHERE NOT is_filled
ORDER BY market;
```

```text
   market    | latest_real_date
-------------+------------------
 eurostoxx50 | 2026-04-07
 oil20       | 2026-04-07
 stoxxasia50 | 2026-04-07
 stoxxusa50  | 2026-04-07
(4 rows)
```

All four silver OHLCV families currently agree on `2026-04-07` as the latest real market date. Agreement across all markets matters because a technically successful run that leaves one family behind still produces stale downstream scores.

#### Inspect approximate row counts from `pg_stat_user_tables`

| Field | Meaning |
|---|---|
| `table_name` | Live silver table name. |
| `approx_rows` | PostgreSQL statistics estimate of current live rows. |

*This query gives a low-cost operational row-count snapshot for every silver table.*

```sql
SELECT relname AS table_name,
       n_live_tup AS approx_rows
FROM pg_stat_user_tables
WHERE schemaname = 'silver'
ORDER BY relname;
```

```text
    table_name     | approx_rows
-------------------+-------------
 eurostoxx50_ohlcv |       67155
 index_dim         |         169
 oil20_ohlcv       |       25080
 signals_daily     |         635
 signals_quarterly |         188
 stoxxasia50_ohlcv |       64875
 stoxxusa50_ohlcv  |       66000
(7 rows)
```

This is the PostgreSQL replacement for the SQL Server `sys.partitions` quick row-count check. The numbers are approximate, but they are usually the right first signal for skew, stalled growth, or unexpectedly small reloads.

#### Remove only future-dated filled rows during an emergency cleanup

| Field | Meaning |
|---|---|
| `symbol` | Instrument whose synthetic rows are being inspected. |
| `date` | Remaining row date after cleanup. |
| `is_filled` | Whether the surviving row is real or synthetic. |

*This transaction deletes only future-dated synthetic rows and shows the bounded post-cleanup state.*

```sql
BEGIN;

CREATE TEMP TABLE note03_cleanup_demo (
    symbol text NOT NULL,
    date date NOT NULL,
    is_filled boolean NOT NULL
);

INSERT INTO note03_cleanup_demo (symbol, date, is_filled)
VALUES
    ('AAPL', CURRENT_DATE - 1, false),
    ('AAPL', CURRENT_DATE + 1, true),
    ('AAPL', CURRENT_DATE + 2, true);

DELETE FROM note03_cleanup_demo
WHERE is_filled
  AND date > CURRENT_DATE;

SELECT symbol,
       date,
       is_filled
FROM note03_cleanup_demo
ORDER BY date;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
INSERT 0 3
DELETE 2
 symbol |    date    | is_filled
--------+------------+-----------
 AAPL   | 2026-04-18 | f
(1 row)

ROLLBACK
```

This is the safe emergency pattern: remove only synthetic rows that overshot the legitimate calendar boundary, then rerun the normal gap-fill logic. A broad delete of all filled rows would destroy useful continuity history and turn a bounded repair into a larger reload problem.

### Related notes

- [[02-postgresql-bronze-layer-loading]] for the raw landing rules that feed silver.
- [[04-postgresql-gold-transforms]] for the consumer-facing layer built from silver outputs.
- [[11-postgresql-merge-and-upsert]] for PostgreSQL upsert semantics in standalone query form.
