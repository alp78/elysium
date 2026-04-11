---
title: "08 - Date and Time Functions"
tags: [sql, sql-server, tsql, date, time, datetime2, datetimeoffset, dateadd, datediff, at-time-zone]
aliases: [datetime functions, AT TIME ZONE, DATEDIFF, DATEADD, EOMONTH, datetimeoffset]
description: "T-SQL reference for SQL Server date and time types, current time functions, DATEADD, DATEDIFF, DATEDIFF_BIG, EOMONTH, DATEFROMPARTS, AT TIME ZONE, ISO 8601 literals, and DST-safe date logic."
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# Date and Time Functions

This note is the SQL Server T-SQL time reference.

It owns:

- temporal data types
- current time functions
- date arithmetic
- timezone conversion with `AT TIME ZONE`
- ISO-safe literals
- business-safe temporal query patterns

It does not own Python or C# date handling.

## Date and Time Data Types

### DATE, TIME, DATETIME2, and DATETIMEOFFSET

| Type | Use | Guidance |
|---|---|---|
| `date` | Calendar date only | Best for business dates without time |
| `time` | Time of day only | Use for clock-time values without date |
| `datetime2` | Date + time | Preferred general-purpose SQL Server timestamp type |
| `datetimeoffset` | Date + time + UTC offset | Use when the stored value must retain timezone offset context |

Practical rule:

- Prefer `datetime2` over legacy `datetime` for new schema.
- Use `datetimeoffset` when the offset itself is part of the contract.
- Store operational timestamps in UTC unless a strong reason exists not to.

## Current Time Functions

### GETDATE, SYSDATETIME, SYSUTCDATETIME, SYSDATETIMEOFFSET, and CURRENT_TIMESTAMP

```sql
SELECT
    GETDATE() AS getdate_value,
    SYSDATETIME() AS sysdatetime_value,
    SYSUTCDATETIME() AS sysutcdatetime_value,
    SYSDATETIMEOFFSET() AS sysdatetimeoffset_value,
    CURRENT_TIMESTAMP AS current_timestamp_value;
```

Use these intentionally:

- `GETDATE()` returns local server time as legacy `datetime`
- `SYSDATETIME()` returns local server time with higher precision
- `SYSUTCDATETIME()` returns UTC time with higher precision
- `SYSDATETIMEOFFSET()` returns local time plus offset
- `CURRENT_TIMESTAMP` is ANSI syntax similar to `GETDATE()`

Production rule:

- Prefer `SYSUTCDATETIME()` for new write timestamps.
- Prefer `SYSDATETIME()` over `GETDATE()` when local server time is still required.

## DATEADD, DATEDIFF, and DATEDIFF_BIG

### DATEADD

`DATEADD` shifts a date or time value by a specified unit.

```sql
SELECT DATEADD(DAY, 7, CAST('2025-01-31' AS date)) AS plus_7_days;
```

### DATEDIFF and DATEDIFF_BIG

`DATEDIFF` counts datepart boundaries crossed, not elapsed human time.

```sql
SELECT
    DATEDIFF(DAY, '2025-01-01', '2025-01-31') AS day_boundaries,
    DATEDIFF_BIG(SECOND, '2025-01-01', '2025-02-01') AS seconds_big;
```

Important rule:

- `DATEDIFF` is excellent for boundary counting.
- It is not the same thing as "how much real time passed" in a business sense.

## EOMONTH, DATEFROMPARTS, DATETIMEFROMPARTS, and helpers

### EOMONTH

`EOMONTH` returns the last day of a month.

```sql
SELECT
    EOMONTH('2025-02-11') AS feb_end,
    EOMONTH('2025-02-11', 1) AS next_month_end;
```

### DATEFROMPARTS and DATETIMEFROMPARTS

Use parts-based constructors when assembling dates from separate numeric components.

```sql
SELECT
    DATEFROMPARTS(2025, 4, 8) AS safe_date,
    DATETIME2FROMPARTS(2025, 4, 8, 14, 30, 0, 0, 7) AS safe_datetime2;
```

These are safer and clearer than string concatenation followed by conversion.

## ISO 8601 Literals and Safe Parsing

Use ISO 8601 literals in T-SQL:

- `'2025-04-08'` for `date`
- `'2025-04-08T14:30:00'` for local datetime
- `'2025-04-08T14:30:00+00:00'` for offset-aware values

Why:

- language-safe
- regional-format-safe
- predictable across sessions and deployments

Avoid locale-sensitive formats such as `04/08/2025`.

## AT TIME ZONE

### Timezone conversion with AT TIME ZONE

`AT TIME ZONE` converts a date/time value into a timezone-aware one.

```sql
SELECT
    CAST('2025-03-10T15:30:00' AS datetime2) AT TIME ZONE 'UTC' AS utc_value,
    CAST('2025-03-10T15:30:00' AS datetime2) AT TIME ZONE 'UTC' AT TIME ZONE 'Central Europe Standard Time' AS prague_value;
```

Use it for:

- rendering UTC-stored timestamps into a user timezone
- attaching a zone to a naive `datetime2` value when the source timezone is known

## DST and Boundary Pitfalls

### DST transitions

Time changes create real ambiguity.

- some local times never occur during spring-forward
- some local times occur twice during fall-back

Use `AT TIME ZONE` rather than manual offset arithmetic.

### Inclusive end dates

Avoid:

```sql
WHERE event_time BETWEEN '2025-04-01' AND '2025-04-30'
```

Prefer:

```sql
WHERE event_time >= '2025-04-01'
  AND event_time < '2025-05-01'
```

This is the safe half-open range pattern for datetime values.

## Practical Date Patterns

### Last 7 days

```sql
WHERE event_time >= DATEADD(DAY, -7, SYSUTCDATETIME())
```

### Current month

```sql
WHERE event_date >= DATEFROMPARTS(YEAR(SYSUTCDATETIME()), MONTH(SYSUTCDATETIME()), 1)
  AND event_date < DATEADD(MONTH, 1, DATEFROMPARTS(YEAR(SYSUTCDATETIME()), MONTH(SYSUTCDATETIME()), 1))
```

### Rolling window by business boundary

Use explicit start and exclusive end dates rather than `DATEDIFF`-based predicates on the column side when performance matters.

## Practical Guidance

- Prefer `datetime2` for new schema.
- Prefer UTC for stored operational timestamps.
- Use ISO 8601 literals.
- Use half-open date ranges: `>= start AND < end`.
- Use `AT TIME ZONE` for timezone logic, not manual offset math.
- Use `DATEFROMPARTS` and related constructors when building dates from components.


