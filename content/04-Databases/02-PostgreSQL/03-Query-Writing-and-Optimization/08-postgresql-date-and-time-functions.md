---
title: "08 - Date and Time Functions"
tags:
  - postgresql
  - query-optimization
  - sql
aliases:
  - PostgreSQL temporal functions
  - PostgreSQL intervals
  - PostgreSQL at time zone
  - PostgreSQL date_trunc
description: "PostgreSQL reference for temporal types, current-time functions, interval arithmetic, date parts and constructors, period boundaries, time-zone conversion, DST behavior, and half-open date filters."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[07-postgresql-string-functions-and-pattern-matching]]"
  - "[[09-postgresql-json-and-semi-structured-data]]"
status: complete
---

# Date and Time Functions

Temporal work in PostgreSQL is primarily a type and arithmetic question. The important distinctions are `date` versus `timestamp`, naive timestamps versus `timestamptz`, exact duration versus calendar age, and half-open period filters versus fragile inclusive-end predicates. PostgreSQL does not implement SQL Server `DATEADD` or `DATEDIFF`; the native approach is interval arithmetic, subtraction, `age`, `extract`, and `date_trunc`.

> [!abstract] Scope
>
> This note mirrors the SQL Server temporal track with PostgreSQL equivalents. It covers temporal types, current-time functions, interval arithmetic, parts extraction, constructors, period boundaries, time-zone conversion, DST interpretation, and safe date filtering.
>
> - **Temporal types** cover `date`, `timestamp`, and `timestamptz` as they appear in the live warehouse.
> - **Current time and arithmetic** cover `current_timestamp`, interval addition, timestamp subtraction, and `age`.
> - **Date parts and constructors** cover `extract`, `date_trunc`, `make_date`, and `make_timestamp`.
> - **Boundaries and periods** cover month or quarter anchors and half-open filters.
> - **Time zones and DST** cover `AT TIME ZONE` and what happens around daylight-saving transitions.

## Temporal Types and Current-Time Functions

The first question is what kind of temporal fact the column represents. PostgreSQL distinguishes calendar dates, naive timestamps, and zone-aware timestamps explicitly.

### `date`, `timestamp`, and `timestamptz`

The live `stoxx` schema already contains all three major forms: `perf_date` is a calendar day, `_computed_at` is a naive timestamp, and `current_timestamp` is a timestamp with time zone.

#### Inspect the live temporal type surface

Use this pattern when validating a schema or checking whether a stored timestamp is naive or zone-aware. It is typically triggered by migration review and time-zone correctness checks. The query is read-only. Its purpose is to anchor the note on actual column types from the warehouse rather than generic examples.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `perf_date_type` | `pg_typeof(perf_date)` | regtype | Type of the performance-date column. |
| `computed_at_type` | `pg_typeof(_computed_at)` | regtype | Type of the warehouse computation timestamp. |
| `current_timestamp_type` | `pg_typeof(current_timestamp)` | regtype | Type returned by PostgreSQL's current timestamp function. |
| `session_timezone` | `current_setting('TimeZone')` | text | Active time zone of the current session. |

*This query shows the live temporal types used in `gold.index_performance` and in the current session.*

```sql
SELECT
    pg_typeof(perf_date) AS perf_date_type,
    pg_typeof(_computed_at) AS computed_at_type,
    pg_typeof(current_timestamp) AS current_timestamp_type,
    current_setting('TimeZone') AS session_timezone
FROM gold.index_performance
LIMIT 1;
```

| perf_date_type | computed_at_type | current_timestamp_type | session_timezone |
|---|---|---|---|
| date | timestamp without time zone | timestamp with time zone | Etc/UTC |

The warehouse currently stores business dates as `date` and computation stamps as `timestamp without time zone`. The session itself runs in `Etc/UTC`, which is why `current_timestamp` is naturally UTC-tagged here.

#### Compare the core current-time functions

Use this pattern when deciding which "current time" function should feed an audit stamp, runtime comparison, or session diagnostic. It is typically triggered by ETL stamping and timing analysis. The query is read-only. Its purpose is to show the main current-time surfaces side by side.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `current_date` | `current_date` | date | Current date in the session time zone. |
| `current_time` | `current_time` | timetz | Current wall-clock time with session offset. |
| `local_timestamp` | `localtimestamp` | timestamp | Current naive timestamp in the session time zone. |
| `current_timestamp` | `current_timestamp` | timestamptz | Transaction-start timestamp with time zone. |
| `statement_timestamp` | `statement_timestamp()` | timestamptz | Statement-start timestamp. |
| `clock_timestamp` | `clock_timestamp()` | timestamptz | Actual current clock time at function evaluation. |

*This query returns the main PostgreSQL current-time functions in one row.*

```sql
SELECT
    current_date AS current_date,
    current_time AS current_time,
    localtimestamp AS local_timestamp,
    current_timestamp AS current_timestamp,
    statement_timestamp() AS statement_timestamp,
    clock_timestamp() AS clock_timestamp;
```

| current_date | current_time | local_timestamp | current_timestamp | statement_timestamp | clock_timestamp |
|---|---|---|---|---|---|
| 2026-04-19 | 00:55:04.971864+00 | 2026-04-19 00:55:04.971864 | 2026-04-19 00:55:04.971864+00 | 2026-04-19 00:55:04.971864+00 | 2026-04-19 00:55:04.971977+00 |

`current_timestamp` and `statement_timestamp()` are stable within the statement boundary here, while `clock_timestamp()` advances at evaluation time. That distinction matters in long-running statements or procedural code.

## Interval Arithmetic and Duration

PostgreSQL uses intervals and timestamp subtraction instead of SQL Server's `DATEADD` and `DATEDIFF`. The mental model is simpler: add an interval to move forward, subtract two timestamps to get an interval, and use `age` when the desired answer is calendar-relative rather than pure elapsed time.

### Shift timestamps and measure elapsed versus calendar time

The same two moments can produce different kinds of answers depending on whether the business question is "how much time elapsed?" or "what calendar age separates these dates?"

#### Use interval arithmetic instead of `DATEADD`

Use this pattern when a query needs to move a date or timestamp by a fixed temporal amount. It is typically triggered by reporting windows, anchor calculations, and end-of-period logic. The query is read-only. Its purpose is to show the native PostgreSQL shift model.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `plus_one_month` | `DATE '2026-01-31' + INTERVAL '1 month'` | timestamp | Month-shifted value with month-end normalization. |
| `plus_ninety_minutes` | timestamp plus interval | timestamp | Timestamp shifted by a fixed 90-minute interval. |

*This query adds one month to a calendar date and ninety minutes to a timestamp.*

```sql
SELECT
    DATE '2026-01-31' + INTERVAL '1 month' AS plus_one_month,
    TIMESTAMP '2026-04-07 23:33:06' + INTERVAL '90 minutes' AS plus_ninety_minutes;
```

| plus_one_month | plus_ninety_minutes |
|---|---|
| 2026-02-28 00:00:00 | 2026-04-08 01:03:06 |

The month shift normalized `2026-01-31` to `2026-02-28` because February has no 31st day. That is the same business boundary SQL Server users often study with `DATEADD(month, 1, ...)`, but PostgreSQL expresses it as interval arithmetic.

#### Distinguish elapsed duration from calendar age

Use this pattern when the query must choose between exact elapsed time and a calendar-relative difference. It is typically triggered by SLA timing, age calculations, and validity-window reasoning. The query is read-only. Its purpose is to show that subtraction and `age` answer different questions.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `elapsed_interval` | timestamp subtraction | interval | Exact elapsed duration between two timestamps. |
| `elapsed_hours` | `extract(epoch from interval) / 3600` | numeric | Exact elapsed duration in hours. |
| `calendar_age` | `age(date, date)` | interval | Calendar-relative age in years, months, and days. |

*This query compares exact elapsed time to calendar-aware age semantics.*

```sql
SELECT
    TIMESTAMP '2026-04-07 23:33:06' - TIMESTAMP '2026-04-01 08:00:00' AS elapsed_interval,
    ROUND((EXTRACT(EPOCH FROM TIMESTAMP '2026-04-07 23:33:06' - TIMESTAMP '2026-04-01 08:00:00') / 3600)::numeric, 4) AS elapsed_hours,
    age(DATE '2026-04-07', DATE '2025-01-01') AS calendar_age;
```

| elapsed_interval | elapsed_hours | calendar_age |
|---|---:|---|
| 6 days 15:33:06 | 159.5517 | 1 year 3 mons 6 days |

`elapsed_interval` is a literal duration. `calendar_age` is a calendar decomposition. They are both correct, but only for different questions.

## Date Parts and Constructors

PostgreSQL uses `extract` and `date_trunc` for decomposition and boundary anchoring, and `make_date` or `make_timestamp` for parts-based construction.

### Decompose timestamps, then rebuild them safely

These functions are the PostgreSQL equivalents of the SQL Server date-part and parts-constructor family, but they use interval-friendly and expression-friendly syntax.

#### Extract parts and truncate to a boundary

Use this pattern when a query needs year, day-of-week, or period-floor values without string parsing. It is typically triggered by reporting calendars, partition checks, and bucketed temporal analysis. The query is read-only. Its purpose is to show `extract` and `date_trunc` on live warehouse timestamps.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `perf_date` | `gold.index_performance.perf_date` | date | Business date of the fact row. |
| `year_part` | `extract(year from perf_date)` | numeric | Calendar year of the date. |
| `iso_dow` | `extract(isodow from perf_date)` | numeric | ISO day-of-week number where Monday is 1. |
| `month_floor` | `date_trunc('month', _computed_at)` | timestamp | Start-of-month boundary of the computation timestamp. |

*This query decomposes live dates and truncates computation stamps to the month boundary.*

```sql
SELECT
    perf_date,
    EXTRACT(YEAR FROM perf_date) AS year_part,
    EXTRACT(ISODOW FROM perf_date) AS iso_dow,
    date_trunc('month', _computed_at) AS month_floor
FROM gold.index_performance
ORDER BY perf_date DESC, _index
LIMIT 4;
```

| perf_date | year_part | iso_dow | month_floor |
|---|---:|---:|---|
| 2026-04-07 | 2026 | 2 | 2026-04-01 00:00:00 |
| 2026-04-07 | 2026 | 2 | 2026-04-01 00:00:00 |
| 2026-04-07 | 2026 | 2 | 2026-04-01 00:00:00 |
| 2026-04-07 | 2026 | 2 | 2026-04-01 00:00:00 |

`extract` returns numeric parts directly, while `date_trunc` returns a full timestamp anchored to the requested boundary. That makes `date_trunc` especially useful for grouping and half-open period logic.

#### Build temporal values from numeric parts

Use parts-based constructors when the components already exist separately and the query should avoid string assembly and reparsing. It is typically triggered by parameterized reporting, test fixtures, and controlled ETL transformations. The query is read-only. Its purpose is to show PostgreSQL's constructor family.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `built_date` | `make_date(2026, 4, 7)` | date | Calendar date built from year, month, and day integers. |
| `built_timestamp` | `make_timestamp(...)` | timestamp | Naive timestamp built from numeric parts. |

*This query constructs a date and a timestamp directly from their numeric components.*

```sql
SELECT
    make_date(2026, 4, 7) AS built_date,
    make_timestamp(2026, 4, 7, 23, 33, 6.0) AS built_timestamp;
```

| built_date | built_timestamp |
|---|---|
| 2026-04-07 | 2026-04-07 23:33:06 |

This is the safe-constructor pattern. It avoids any dependence on literal parsing rules or locale-sensitive string formats.

## Period Boundaries and Half-Open Windows

Most reporting windows are boundary problems, not formatting problems. PostgreSQL solves them with `date_trunc`, interval arithmetic, and half-open predicates.

### Anchor the period, then filter with `< end`

The robust pattern is to calculate the period start once, calculate the exclusive end once, and filter as `>= start AND < end`.

#### Derive month and quarter anchors explicitly

Use this pattern when the query needs first-of-period and end-of-period dates for reporting or slicing. It is typically triggered by month-end reporting, quarter windows, and rolling calendar logic. The query is read-only. Its purpose is to show the standard PostgreSQL boundary-building expressions.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `anchor_date` | date literal | date | Input date whose period boundaries are being derived. |
| `month_start` | `date_trunc('month', ...)` | date | First day of the calendar month. |
| `month_end` | month start plus `1 month - 1 day` | date | Final day of the calendar month. |
| `quarter_start` | `date_trunc('quarter', ...)` | date | First day of the calendar quarter. |

*This query derives month and quarter boundaries from a single anchor date.*

```sql
SELECT
    DATE '2026-04-07' AS anchor_date,
    date_trunc('month', DATE '2026-04-07'::timestamp)::date AS month_start,
    (date_trunc('month', DATE '2026-04-07'::timestamp) + INTERVAL '1 month - 1 day')::date AS month_end,
    date_trunc('quarter', DATE '2026-04-07'::timestamp)::date AS quarter_start;
```

| anchor_date | month_start | month_end | quarter_start |
|---|---|---|---|
| 2026-04-07 | 2026-04-01 | 2026-04-30 | 2026-04-01 |

The end-of-month calculation is useful for display, but the safer predicate boundary is still the first day of the next month as an exclusive end.

#### Use a half-open predicate for whole-period filtering

Use this pattern when a query must include every row in a calendar month without relying on end-of-day precision tricks. It is typically triggered by reports, ETL extracts, and point-in-time warehouse slices. The query is read-only. Its purpose is to reinforce the canonical filter shape.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `april_rows` | `COUNT(*)` over a half-open predicate | bigint | Number of performance rows falling in April 2026. |

*This query counts April 2026 performance rows using an inclusive lower bound and exclusive upper bound.*

```sql
SELECT
    COUNT(*) AS april_rows
FROM gold.index_performance
WHERE perf_date >= DATE '2026-04-01'
  AND perf_date < DATE '2026-05-01';
```

| april_rows |
|---:|
| 16 |

The half-open predicate is safe regardless of whether the underlying column is a `date`, `timestamp`, or `timestamptz`. That is why it is the default production pattern.

## Time Zones and DST

PostgreSQL supports named time-zone conversion with `AT TIME ZONE`. The main rule is to store an unambiguous instant whenever possible and convert to presentation zones at the edge.

### Convert safely with named zones, not manual offsets

Manual offset arithmetic breaks when daylight-saving rules change the local offset. Named zones encode those rules.

#### Convert a UTC instant into presentation zones

Use this pattern when the query has a real instant and needs to present it in one or more local zones. It is typically triggered by user-facing reporting, cross-region debugging, and audit review. The query is read-only. Its purpose is to show PostgreSQL's `AT TIME ZONE` conversion on a fixed UTC instant.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `utc_ts` | UTC `timestamptz` literal | timestamptz | Unambiguous stored instant. |
| `paris_local` | `utc_ts AT TIME ZONE 'Europe/Paris'` | timestamp | Local wall-clock time in Paris. |
| `new_york_local` | `utc_ts AT TIME ZONE 'America/New_York'` | timestamp | Local wall-clock time in New York. |

*This query converts one UTC instant into two presentation zones by using named IANA time zones.*

```sql
SELECT
    TIMESTAMPTZ '2026-04-07 23:33:06+00' AS utc_ts,
    TIMESTAMPTZ '2026-04-07 23:33:06+00' AT TIME ZONE 'Europe/Paris' AS paris_local,
    TIMESTAMPTZ '2026-04-07 23:33:06+00' AT TIME ZONE 'America/New_York' AS new_york_local;
```

| utc_ts | paris_local | new_york_local |
|---|---|---|
| 2026-04-07 23:33:06+00 | 2026-04-08 01:33:06 | 2026-04-07 19:33:06 |

The same instant maps to different local dates and times depending on the zone rules in effect. That is why fixed `+01:00` or `-05:00` arithmetic is not a complete solution.

#### Expect surprising results around DST transitions

Use this pattern when the workload must interpret naive local times that fall inside daylight-saving gaps or repeated hours. It is typically triggered by local-time ingestion, audit reconstruction, and timezone bug analysis. The query is read-only. Its purpose is to show that ambiguous or nonexistent local wall-clock times are real operational problems.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `paris_spring_gap` | naive timestamp interpreted in `Europe/Paris` | timestamptz | UTC instant PostgreSQL resolves for a local time in the spring-forward gap. |
| `paris_fall_ambiguous` | naive timestamp interpreted in `Europe/Paris` | timestamptz | UTC instant PostgreSQL resolves for a repeated local time during fall-back. |

*This query interprets two local Paris wall-clock times that sit on DST transition boundaries.*

```sql
SELECT
    TIMESTAMP '2025-03-30 02:30:00' AT TIME ZONE 'Europe/Paris' AS paris_spring_gap,
    TIMESTAMP '2025-10-26 02:30:00' AT TIME ZONE 'Europe/Paris' AS paris_fall_ambiguous;
```

| paris_spring_gap | paris_fall_ambiguous |
|---|---|
| 2025-03-30 01:30:00+00 | 2025-10-26 01:30:00+00 |

The point is not to memorize these specific outputs. It is to remember that local wall-clock timestamps can be ambiguous or even nonexistent, which is why storing UTC instants is the safer default.

## Practical Rules

Use the type and arithmetic that match the business meaning of the timestamp instead of translating SQL Server idioms mechanically.

| Need | PostgreSQL pattern | Why |
|---|---|---|
| Calendar-only fact | `date` | Stores just the day with no time ambiguity. |
| Naive wall-clock timestamp | `timestamp without time zone` | Good when the zone is external to the value by contract. |
| Unambiguous instant | `timestamptz` | Preserves a real instant and converts safely across zones. |
| Current UTC-like session instant | `current_timestamp` in a UTC session | Stable transaction timestamp with zone awareness. |
| Shift a value forward or backward | `+ INTERVAL ...` / `- INTERVAL ...` | Native PostgreSQL replacement for `DATEADD`. |
| Exact elapsed duration | timestamp subtraction plus `extract(epoch ...)` | Native replacement for `DATEDIFF`-style duration logic. |
| Calendar-relative age | `age(...)` | Produces years, months, and days rather than raw elapsed seconds. |
| Boundary anchors | `date_trunc(...)` | Clean first-of-period logic. |
| Whole-period filter | `>= start AND < end` | Safe for all timestamp precisions. |
| Zone conversion | `AT TIME ZONE 'Zone/Name'` | Uses real timezone rules instead of manual offsets. |
