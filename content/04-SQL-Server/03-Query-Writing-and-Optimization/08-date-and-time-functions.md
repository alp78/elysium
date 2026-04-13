---
title: "08 - Date and Time Functions"
tags: [sql, sql-server, tsql, date, time, time-zone]
aliases: [datetime functions, AT TIME ZONE, DATEDIFF, DATEADD, EOMONTH, datetimeoffset, DATEPART]
description: "T-SQL reference for SQL Server date and time types, current-time functions, DATEADD, DATEDIFF, DATEDIFF_BIG, DATEPART, DATENAME, EOMONTH, DATEFROMPARTS, ISO 8601 literals, AT TIME ZONE, DST, SARGability, and production-safe temporal query patterns."
created: 2026-03-22
updated: 2026-04-11
status: complete
---

# Date and Time Functions

> [!abstract]- Summary
>
> Temporal work in SQL Server is a type, arithmetic, and boundary problem before it is a formatting problem: this note maps the core date and time types, shows their behavior against the local `stoxx` database, and establishes the production patterns for current timestamps, safe arithmetic, zone conversion, and SARGable reporting windows.
>
> **Temporal types**
> - covers `date`, `time`, `datetime2`, `datetimeoffset`, and the legacy `datetime` / `smalldatetime` types, with guidance on naive versus zone-aware storage
>
> **Current time and arithmetic**
> - covers current-time functions, `DATEADD`, `DATEDIFF`, and `DATEDIFF_BIG`, including the difference between boundary counting and elapsed duration intuition
>
> **Date parts and construction**
> - covers `DATEPART`, `DATENAME`, `DATEFROMPARTS`, and other parts-based constructors for building and decomposing timestamps without string parsing
>
> **Boundaries and literals**
> - covers `EOMONTH`, period windows, ISO 8601 literals, and locale-safe parsing patterns
>
> **Time zones and DST**
> - covers `AT TIME ZONE`, Windows time-zone names, daylight-saving transitions, and UTC-versus-local storage rules
>
> **Practical date patterns**
> - covers last-N-day, current-month, year-to-date, point-in-time, and SCD-2-style validity-window patterns built with half-open predicates
>
> **Operations and safety**
> - Warnings: legacy `datetime` rounds unexpectedly, boundary-counting functions are easy to misread, manual offset arithmetic breaks around DST, non-ISO literals are locale-sensitive, and functions on the column side of a date predicate kill seekability
> - Recommendations: default to `datetime2` or `datetimeoffset`, write timestamps with `SYSUTCDATETIME()`, use ISO 8601 literals, construct values with `...FROMPARTS`, filter with half-open ranges, and convert time zones with `AT TIME ZONE` instead of manual math

> [!note]- Glossary
>
> **Naive temporal type**
> - A date or time type such as `date`, `time`, or `datetime2` that stores wall-clock values without any attached UTC offset or time-zone identity.
> - It matters because most SQL Server timestamps are stored this way, which makes the storage compact but pushes zone interpretation onto application or query logic.
>
> > [!warning] Naive does not mean UTC
> >
> > A `datetime2` value has no built-in knowledge of timezone. If the business contract says “this column is UTC,” that meaning lives in design discipline, not in the type itself.
>
> ---
>
> **`datetimeoffset`**
> - The SQL Server temporal type that stores a local timestamp together with an explicit UTC offset.
> - It matters because it is the only native type in the note that preserves offset information as data rather than as a convention.
>
> > [!info] Offset is stored, zone identity is not
> >
> > `datetimeoffset` remembers `+01:00` or `-05:00`, but not the daylight-saving rules of a named zone. Zone-aware conversion still requires a time-zone table or `AT TIME ZONE`.
>
> ---
>
> **`SYSUTCDATETIME()`**
> - The current-timestamp function that returns the server’s current UTC time as `datetime2`.
> - It matters because it is the production-safe default for audit columns, ETL stamps, and cross-zone event capture.
>
> > [!warning] Local server time is not a safe baseline
> >
> > `GETDATE()` reflects local server time, which makes cross-region reasoning harder and daylight-saving transitions more fragile. UTC timestamps are the stable operational default.
>
> ---
>
> **`DATEADD`**
> - The function that shifts a temporal value by a specified number of units such as days, months, or minutes.
> - It matters because safe reporting windows and period boundaries are usually built by adding to a known anchor rather than by parsing strings.
>
> > [!info] Use arithmetic on anchors, not string assembly
> >
> > `DATEADD` pairs naturally with half-open ranges and `...FROMPARTS` constructors. Together they produce clear, index-friendly date windows.
>
> ---
>
> **`DATEDIFF` / `DATEDIFF_BIG`**
> - Functions that count how many datepart boundaries were crossed between two timestamps, with `DATEDIFF_BIG` returning a wider integer type.
> - It matters because readers often mistake boundary counting for true elapsed-duration measurement.
>
> > [!warning] Boundary count is not elapsed time
> >
> > Crossing midnight by one second and by twenty-three hours both count as one day boundary. That is correct for calendar logic and wrong for duration intuition unless used carefully.
>
> ---
>
> **Date part**
> - A named calendar or clock component such as year, month, day, hour, or ISO week used by SQL Server date functions.
> - It matters because temporal arithmetic and extraction both depend on choosing the correct unit of meaning.
>
> > [!info] Part choice encodes business semantics
> >
> > “Month” means calendar-month boundaries, not thirty days. The selected datepart often defines the real business rule more than the surrounding function call.
>
> ---
>
> **`DATEFROMPARTS`**
> - A constructor that builds a `date` value from separate year, month, and day integers.
> - It matters because parts-based constructors are safer and clearer than string concatenation for building temporal values.
>
> > [!warning] Constructors beat parsing
> >
> > When the components already exist as numbers, assembling a string just to parse it again adds locale risk and unnecessary conversion work.
>
> ---
>
> **ISO 8601 literal**
> - A locale-independent text representation of a date or timestamp, such as `'2025-04-08'` or `'2025-04-08T14:30:00+02:00'`.
> - It matters because SQL Server parses these forms consistently across language and regional settings.
>
> > [!warning] Ambiguous date strings are environment-dependent
> >
> > Formats like `04/08/2025` can mean different things under different session settings. ISO 8601 avoids that class of bug entirely.
>
> ---
>
> **Half-open date range**
> - A time window written as `>= start AND < end` so the upper bound is exclusive.
> - It matters because this is the canonical safe filter form for `datetime` and `datetime2` columns.
>
> > [!warning] Inclusive end dates are precision traps
> >
> > An inclusive end boundary is easy to mis-size when fractional seconds exist. Half-open ranges avoid silent exclusion of late-in-the-day rows.
>
> ---
>
> **SARGable date predicate**
> - A temporal filter written so SQL Server can seek on the underlying index instead of computing a function on every row.
> - It matters because reporting queries often become slow only because the column is wrapped in `YEAR()`, `CAST()`, or `DATEDIFF(...)`.
>
> > [!warning] Functions belong on constants, not on columns
> >
> > Rewriting the boundary once is cheap. Recomputing a function for every row on the indexed column side usually forces a scan.
>
> ---
>
> **`AT TIME ZONE`**
> - The SQL Server operator that interprets or converts a timestamp using a Windows time-zone definition and returns a `datetimeoffset`.
> - It matters because it is the built-in safe mechanism for timezone-aware conversion without hard-coding offsets.
>
> > [!warning] Use zone rules, not manual offsets
> >
> > A fixed `+01:00` or `-05:00` offset is not a full time-zone model. Daylight-saving transitions make manual offset math incorrect for real-world local time.
>
> ---
>
> **Daylight saving transition**
> - A clock shift in a local time zone that creates repeated or skipped local times during the year.
> - It matters because ambiguous and nonexistent local timestamps are where many timezone bugs surface.
>
> > [!danger] Local timestamps can be ambiguous or impossible
> >
> > During a DST fall-back hour, one local wall-clock time can occur twice. During a spring-forward gap, some local times never occur at all.
>
> ---
>
> **Validity window**
> - A pair of timestamps, often `valid_from` and `valid_to`, that define when a row is considered active.
> - It matters because SCD-2, audit, and point-in-time query patterns all depend on correct half-open temporal intervals.
>
> > [!info] Point-in-time logic is interval logic
> >
> > A row is active when the as-of timestamp falls inside its validity window. Half-open interval patterns keep that test deterministic and overlap-safe.

## Date and Time Data Types

> [!abstract] Naive vs zone-aware temporal types
>
> SQL Server offers six temporal types in two families:
>
> - **Naive types** (no timezone information): `date`, `time`, `datetime2`, legacy `datetime`, legacy `smalldatetime`. These store the wall-clock values you give them without any notion of UTC or offset.
> - **Zone-aware type**: `datetimeoffset` stores a wall-clock value plus an explicit UTC offset.
>
> For new schemas, reach for `date` when you need only the calendar day, `datetime2` when you need date + time, and `datetimeoffset` when the offset itself is part of the business contract. Avoid the legacy `datetime` and `smalldatetime` types — they exist only for backward compatibility with SQL Server versions before 2008.

### Storage, precision, and range

*The cost and reach of each temporal type.*

#### Storage bytes per type

*Measure each type's on-disk footprint with `DATALENGTH()`.*

```sql
DECLARE @d date              = '2025-04-08';
DECLARE @t time(7)           = '14:30:00.1234567';
DECLARE @dt2 datetime2(7)    = '2025-04-08 14:30:00.1234567';
DECLARE @dto datetimeoffset(7) = '2025-04-08 14:30:00.1234567 +02:00';
SELECT
    DATALENGTH(@d)   AS date_bytes,
    DATALENGTH(@t)   AS time7_bytes,
    DATALENGTH(@dt2) AS datetime2_7_bytes,
    DATALENGTH(@dto) AS dto_7_bytes;
```

| date_bytes | time7_bytes | datetime2_7_bytes | dto_7_bytes |
|---|---|---|---|
| 3 | 5 | 8 | 10 |

> [!info]- Type reference table
>
> - `date` — 3 bytes, range `0001-01-01` to `9999-12-31`, day precision only.
> - `time(n)` — 3–5 bytes depending on precision scale `n` (0 through 7); range `00:00:00.0000000` to `23:59:59.9999999`.
> - `datetime2(n)` — 6–8 bytes depending on precision scale; range `0001-01-01 00:00:00` to `9999-12-31 23:59:59.9999999`.
> - `datetimeoffset(n)` — 8–10 bytes; same range as `datetime2` plus a stored UTC offset from `-14:00` to `+14:00`.
> - Legacy `datetime` — 8 bytes fixed, range `1753-01-01` to `9999-12-31`, precision rounded to 1/300 second.
> - Legacy `smalldatetime` — 4 bytes fixed, range `1900-01-01` to `2079-06-06`, precision rounded to minute.

#### Full range of date and datetime2

*Both types share a calendar range from year 1 to year 9999.*

```sql
SELECT
    CAST('0001-01-01' AS date)                       AS date_min,
    CAST('9999-12-31' AS date)                       AS date_max,
    CAST('0001-01-01T00:00:00' AS datetime2)         AS dt2_min,
    CAST('9999-12-31T23:59:59.9999999' AS datetime2) AS dt2_max;
```

| date_min | date_max | dt2_min | dt2_max |
|---|---|---|---|
| 0001-01-01 | 9999-12-31 | 0001-01-01 00:00:00 | 9999-12-31 23:59:59.999999 |

The `dt2_max` output shows `.999999` not `.9999999` because the pyodbc client truncates fractional seconds to microseconds when presenting values — the stored value is still `datetime2(7)`.

### Precision scale on datetime2

*The `(n)` in `datetime2(n)` chooses how many fractional-second digits are stored.*

#### Scale 0, 3, and 7

*Watch the tail of the fractional seconds get trimmed as the scale drops.*

```sql
SELECT
    CAST('2025-04-08 14:30:00.1234567' AS datetime2(0)) AS dt2_0,
    CAST('2025-04-08 14:30:00.1234567' AS datetime2(3)) AS dt2_3,
    CAST('2025-04-08 14:30:00.1234567' AS datetime2(7)) AS dt2_7;
```

| dt2_0 | dt2_3 | dt2_7 |
|---|---|---|
| 2025-04-08 14:30:00 | 2025-04-08 14:30:00.123 | 2025-04-08 14:30:00.123456 |

`datetime2(0)` stores seconds only (6 bytes), `datetime2(3)` stores milliseconds (7 bytes), `datetime2(7)` stores 100-nanosecond ticks (8 bytes). The `dt2_7` column looks like `.123456` instead of the full `.1234567` for the same pyodbc client-side reason as above — the server still holds all seven digits.

> [!tip] Choose the smallest scale that preserves meaning
>
> - Business event timestamps: `datetime2(0)` or `datetime2(3)` is almost always enough.
> - Market data / trading systems: `datetime2(3)` for millisecond timestamps.
> - Monotonic sequencing / conflict resolution: `datetime2(6)` or `(7)` if you need sub-microsecond precision.
> - Every extra digit of scale costs bytes and index key size, and very few business processes care beyond milliseconds.

### Legacy datetime — the rounding trap

*Avoid `datetime` in new code; this is why.*

#### 23:59:59.999 rounds forward a full day

*`datetime` rounds to the nearest 1/300 second, and `.999` rounds up past midnight.*

```sql
SELECT
    CAST('2025-01-01 23:59:59.999' AS datetime)     AS legacy_rounds_up,
    CAST('2025-01-01 23:59:59.999' AS datetime2(3)) AS modern_exact;
```

| legacy_rounds_up | modern_exact |
|---|---|
| 2025-01-02 00:00:00 | 2025-01-01 23:59:59.999 |

The left column shows `datetime`'s infamous rounding bug: the value `23:59:59.999` on January 1st rounds forward to `00:00:00` on January 2nd. Any range-end predicate like `col <= '2025-01-01 23:59:59.999'` on a `datetime` column silently includes January 2nd records too.

> [!failure] Legacy datetime + inclusive end dates
>
> The classic production bug is:
>
> - Column type is `datetime`.
> - Code uses `WHERE col BETWEEN '2025-01-01' AND '2025-01-01 23:59:59.999'`.
> - The `.999` rounds forward to `2025-01-02 00:00:00`, so the range includes every `2025-01-02` event.
> - The report shows too many rows and nobody notices until month-end reconciliation.

> [!success] datetime2 + half-open range
>
> - Column type is `datetime2` (any precision).
> - Code uses `WHERE col >= '2025-01-01' AND col < '2025-01-02'`.
> - No rounding, no ambiguity, no off-by-one day errors.
> - This is the universal fix for both the legacy `datetime` rounding trap and the half-open range pattern (covered at the end of this note).

### Legacy smalldatetime — rounds to nearest minute

*Four-byte temporal type with minute-level precision; included for completeness.*

#### Rounding behaviour at 29, 30, and 59 seconds

*`smalldatetime` rounds to the nearest whole minute at the 30-second mark.*

```sql
SELECT
    CAST('2025-01-01 12:34:29' AS smalldatetime) AS rounds_down,
    CAST('2025-01-01 12:34:30' AS smalldatetime) AS rounds_up,
    CAST('2025-01-01 12:34:59' AS smalldatetime) AS near_minute_end;
```

| rounds_down | rounds_up | near_minute_end |
|---|---|---|
| 2025-01-01 12:34:00 | 2025-01-01 12:35:00 | 2025-01-01 12:35:00 |

The 30-second mark rounds up; 29 seconds rounds down. This is independent of the `datetime` 1/300-second quirk — `smalldatetime` drops everything below minute precision entirely. Use it only when working with legacy schemas; never choose it for new columns.

## Current Time Functions

> [!abstract] Seven ways to ask "what time is it?"
>
> SQL Server exposes seven built-in functions that return the current server time, and they differ in three important dimensions:
>
> - **Return type** (legacy `datetime` vs modern `datetime2` vs `datetimeoffset`).
> - **Precision** (3-digit millisecond rounding for the legacy functions, full 7-digit precision for the `SYS*` family).
> - **Time zone** (local server time vs UTC vs local time with offset).
>
> For new code, prefer `SYSUTCDATETIME()` for write timestamps and `SYSDATETIMEOFFSET()` when you need to retain the zone context.

### Side-by-side comparison

*Every current-time function called in the same query so their outputs can be compared directly.*

#### All seven functions

*Capture every variant at once. The `stoxx` Docker container runs at UTC, so the "local" and "UTC" values are identical — the precision and return-type differences are what matter.*

```sql
SELECT
    GETDATE()              AS getdate_v,
    GETUTCDATE()           AS getutcdate_v,
    SYSDATETIME()          AS sysdatetime_v,
    SYSUTCDATETIME()       AS sysutcdatetime_v,
    CONVERT(varchar(40), SYSDATETIMEOFFSET(), 121) AS sysdatetimeoffset_v,
    CURRENT_TIMESTAMP      AS current_timestamp_v,
    CURRENT_TIMEZONE()     AS current_timezone_v;
```

| getdate_v | getutcdate_v | sysdatetime_v | sysutcdatetime_v | sysdatetimeoffset_v | current_timestamp_v | current_timezone_v |
|---|---|---|---|---|---|---|
| 2026-04-11 12:03:21.43 | 2026-04-11 12:03:21.43 | 2026-04-11 12:03:21.441393 | 2026-04-11 12:03:21.441393 | 2026-04-11 12:03:21.4413932 +00:00 | 2026-04-11 12:03:21.43 | (UTC) Coordinated Universal Time |

> [!info]- Function reference
>
> - `GETDATE()` — legacy local server time as `datetime`, rounded to 1/300 second.
> - `GETUTCDATE()` — legacy UTC time as `datetime`, rounded to 1/300 second.
> - `SYSDATETIME()` — local server time as `datetime2(7)`, full precision.
> - `SYSUTCDATETIME()` — UTC time as `datetime2(7)`, full precision.
> - `SYSDATETIMEOFFSET()` — local server time as `datetimeoffset(7)`, includes the server's current UTC offset.
> - `CURRENT_TIMESTAMP` — ANSI-standard alias for `GETDATE()`; same type, same precision.
> - `CURRENT_TIMEZONE()` — returns a `sysname` naming the server's current Windows time zone.

#### Precision: GETDATE vs SYSDATETIME

*Casting both to a high-precision `datetime2(7)` shows the legacy function's missing digits.*

```sql
SELECT
    CAST(GETDATE() AS datetime2(7))     AS getdate_as_dt2,
    CAST(SYSDATETIME() AS datetime2(7)) AS sysdatetime_as_dt2;
```

| getdate_as_dt2 | sysdatetime_as_dt2 |
|---|---|
| 2026-04-11 12:03:21.43 | 2026-04-11 12:03:21.441393 |

`GETDATE()` only has three significant fractional digits to begin with, so casting it to `datetime2(7)` simply pads zeros. `SYSDATETIME()` has full precision. If two writes happen in the same 1/300-second window, `GETDATE()` assigns them the same timestamp; `SYSDATETIME()` distinguishes them.

> [!warning] GETDATE lies about precision
>
> It is tempting to use `GETDATE()` because it looks like a `datetime2` in the output, but:
>
> - The return type is legacy `datetime`, which rounds to 1/300 second.
> - Storing many `GETDATE()` values in a `datetime2` column throws away the client-side precision digits because the column has them but the source never produced them.
> - Ordering or deduplicating by a `GETDATE()`-populated column will produce ties that `SYSDATETIME()` would have split.

> [!success] Prefer SYSUTCDATETIME for new writes
>
> - **Precision**: full 7-digit scale, no 1/300-second rounding.
> - **Zone**: UTC removes any ambiguity about the server's local time or DST state.
> - **Interoperability**: every downstream system can present UTC in whatever local zone it wants; the reverse is harder.
> - Store `SYSUTCDATETIME()` in a `datetime2(3)` or `datetime2(7)` column depending on how precise your domain needs to be.

> [!info]- Why legacy datetime rounds to 1/300 second
>
> The `datetime` type stores the fractional second as a signed integer divided by 300, so the smallest representable step is 3.33 ms. `datetime2` uses a different underlying format (100-ns ticks) and does not suffer from this. On a SQL Server container running Linux with `TZ=Europe/Paris`, `CURRENT_TIMEZONE()` returns the Windows zone name mapped from the IANA zone — typically `Romance Standard Time` per the Linux-to-Windows mapping table SQL Server uses internally.

## DATEADD, DATEDIFF, and DATEDIFF_BIG

> [!abstract] Temporal arithmetic
>
> `DATEADD` shifts a date/time value forward or backward by a named unit. `DATEDIFF` counts how many boundaries of that unit are crossed between two values — **not** how much real time has elapsed. `DATEDIFF_BIG` is the large-integer variant for cases where the boundary count would overflow a 32-bit integer. Understanding the boundary-counting semantics is essential to avoiding the classic year-rollover and age-in-years traps.

### DATEADD

*Shift a date/time value by a signed count of a given unit.*

#### Basic shifts

*Add days, months, and years to a calendar date.*

```sql
SELECT
    DATEADD(DAY,   7,  CAST('2025-01-31' AS date)) AS plus_7_days,
    DATEADD(MONTH, 1,  CAST('2025-01-31' AS date)) AS plus_1_month,
    DATEADD(YEAR, -1,  CAST('2025-01-31' AS date)) AS minus_1_year;
```

| plus_7_days | plus_1_month | minus_1_year |
|---|---|---|
| 2025-02-07 | 2025-02-28 | 2024-01-31 |

> [!info]- DATEADD anatomy
>
> - First argument: the datepart name (`YEAR`, `QUARTER`, `MONTH`, `DAY`, `HOUR`, `MINUTE`, `SECOND`, `MILLISECOND`, `MICROSECOND`, `NANOSECOND`, etc.).
> - Second argument: a signed integer — negative values subtract.
> - Third argument: the date/time expression to shift.
> - Return type matches the input type (adding days to a `date` returns a `date`; adding hours to a `datetime2` returns a `datetime2`).

#### Month-end rounding behaviour

*Adding a month to January 31st does not produce a "March 3rd"; it produces the last valid day of February.*

```sql
SELECT
    DATEADD(MONTH, 1, CAST('2025-01-31' AS date)) AS jan31_plus_month,
    DATEADD(MONTH, 1, CAST('2025-03-31' AS date)) AS mar31_plus_month,
    DATEADD(MONTH, 1, CAST('2025-05-31' AS date)) AS may31_plus_month;
```

| jan31_plus_month | mar31_plus_month | may31_plus_month |
|---|---|---|
| 2025-02-28 | 2025-04-30 | 2025-06-30 |

SQL Server's rule is: after adding the named unit, if the resulting day would be invalid in the target month, round down to the last valid day of that month. This is the ISO-style behaviour most business users expect.

> [!warning] DATEADD MONTH is not invertible
>
> - `DATEADD(MONTH, 1, '2025-01-31')` → `2025-02-28`.
> - `DATEADD(MONTH, -1, '2025-02-28')` → `2025-01-28`, not `2025-01-31`.
> - Rolling forward one month and back one month is **not** an identity operation on month-end dates.
> - If you need to track "the last day of month N", store and regenerate with `EOMONTH`, not by pushing dates around with `DATEADD`.

### DATEDIFF — boundary counting

*Count the number of datepart boundaries crossed between two date/time values.*

#### The year-rollover trap

*One day apart across a year boundary returns "one year", "one month", and "one day" simultaneously.*

```sql
SELECT
    DATEDIFF(YEAR,  '2024-12-31', '2025-01-01') AS one_day_one_year,
    DATEDIFF(MONTH, '2024-12-31', '2025-01-01') AS one_day_one_month,
    DATEDIFF(DAY,   '2024-12-31', '2025-01-01') AS one_day_one_day;
```

| one_day_one_year | one_day_one_month | one_day_one_day |
|---|---|---|
| 1 | 1 | 1 |

These two dates are 24 hours apart, yet `DATEDIFF(YEAR, ...)` returns **1**. The function counts boundaries crossed: one year boundary (midnight on January 1st), one month boundary, and one day boundary.

> [!failure] DATEDIFF(YEAR, dob, today) is not age
>
> The classic bug: computing age as `DATEDIFF(YEAR, dob, today)`:
>
> - Someone born on 2000-04-09, asked on 2025-04-08: `DATEDIFF(YEAR, ...)` returns `25`, but they are still `24`.
> - The boundary count reflects calendar-year crossings, not "complete years since birth".
> - The same bug appears in "days employed", "seconds since last login", and every other "elapsed time" computation written with the wrong unit.

#### Exact age in years

*Subtract one from the DATEDIFF result when the anniversary has not yet been reached in the current year.*

```sql
DECLARE @dob date = '2000-04-09';
DECLARE @asof date = '2025-04-08';
SELECT
    DATEDIFF(YEAR, @dob, @asof) AS age_datediff_wrong,
    DATEDIFF(YEAR, @dob, @asof)
      - CASE WHEN (MONTH(@asof)*100 + DAY(@asof))
                < (MONTH(@dob) *100 + DAY(@dob))
             THEN 1 ELSE 0 END AS age_exact;
```

| age_datediff_wrong | age_exact |
|---|---|
| 25 | 24 |

The `CASE` subtracts `1` when the "as-of" month/day is before the birthday month/day. The `MONTH*100 + DAY` trick packs month and day into a single integer so a plain `<` comparison does the right thing without bumping into day-of-month edge cases.

#### Boundary vs elapsed seconds

*Two timestamps one second apart across an hour boundary return `1` for HOUR, MINUTE, and SECOND alike.*

```sql
SELECT
    DATEDIFF(HOUR,   '2025-01-01 09:59:59', '2025-01-01 10:00:00') AS hour_boundary,
    DATEDIFF(MINUTE, '2025-01-01 09:59:59', '2025-01-01 10:00:00') AS minute_boundary,
    DATEDIFF(SECOND, '2025-01-01 09:59:59', '2025-01-01 10:00:00') AS elapsed_seconds;
```

| hour_boundary | minute_boundary | elapsed_seconds |
|---|---|---|
| 1 | 1 | 1 |

`DATEDIFF(HOUR, 9:59:59, 10:00:00) = 1` even though only one second elapsed — because one HOUR boundary (`10:00:00`) was crossed. The function is *boundary counting*, not *interval measurement*.

> [!tip] Read DATEDIFF as "boundaries crossed"
>
> - If you need elapsed time between two instants, `DATEDIFF(SECOND, ...)` or `DATEDIFF_BIG(MILLISECOND, ...)` is the right tool because the smallest unit collapses to "difference in ticks".
> - If you need complete calendar years/months/days between two instants (age, tenure), compensate with a `CASE` guard on the remaining parts as shown above.
> - If you need the literal count of month boundaries crossed, `DATEDIFF(MONTH, ...)` already does exactly that.

### DATEDIFF_BIG — when int overflows

*`DATEDIFF` returns `int`; for wide ranges of small units, it overflows.*

#### 125 years in milliseconds overflows

*`DATEDIFF(MILLISECOND, '1900-01-01', '2025-01-01')` cannot fit in a 32-bit integer.*

```sql
SELECT DATEDIFF(MILLISECOND, '1900-01-01', '2025-01-01');
```

```text
('22003', '[22003] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]The datediff function resulted in an overflow. The number of dateparts separating two date/time instances is too large. Try to use datediff with a less precise datepart. (535) (SQLExecDirectW)')
```

Error 535 is the overflow — the result would be about 3.9 trillion, far above the 2.1-billion limit of `int`.

#### DATEDIFF_BIG — no overflow

*The `_BIG` variant returns `bigint` instead of `int`, so it can represent millisecond-scale differences across centuries.*

```sql
SELECT DATEDIFF_BIG(MILLISECOND, '1900-01-01', '2025-01-01') AS ms_since_1900;
```

| ms_since_1900 |
|---|
| 3944678400000 |

> [!tip] When to reach for DATEDIFF_BIG
>
> - The interval is wide (multi-year) **and** the unit is small (seconds, milliseconds, microseconds, nanoseconds).
> - You need monotonic, uniquely-ordered tick counts for audit or sequencing.
> - You are computing Unix timestamps: `DATEDIFF_BIG(SECOND, '1970-01-01', SYSUTCDATETIME())` is the standard T-SQL shape.

> [!info]- Overflow threshold and tick counting
>
> `DATEDIFF(MILLISECOND, a, b)` overflows whenever the span exceeds `2^31 - 1` milliseconds — about **25 days**. `DATEDIFF_BIG(NANOSECOND, ...)` on `datetime2(7)` returns the count of 100-ns ticks between the two values, not true nanoseconds, because 100-ns is the underlying precision of the type.

## Date Parts and Components

> [!abstract] Decomposing a date into its parts
>
> T-SQL provides three overlapping ways to pull individual components out of a date/time value: `DATEPART` returns the numeric part, `DATENAME` returns the localized string form, and `YEAR` / `MONTH` / `DAY` are shortcuts for the most common `DATEPART` calls. Understanding all three is essential for building reporting queries, but using them in `WHERE` clauses against column values is the most common SARGability anti-pattern in T-SQL — so the second half of this section shows the fix.

### DATEPART and helper functions

*Extract numeric parts from a `datetime2` value.*

#### Full part decomposition

*Every datepart pulled from the same timestamp.*

```sql
DECLARE @d datetime2 = '2025-04-08 14:30:45.1234567';
SELECT
    YEAR(@d)                    AS yr,
    DATEPART(QUARTER, @d)       AS qt,
    MONTH(@d)                   AS mo,
    DAY(@d)                     AS dy,
    DATEPART(WEEK, @d)          AS wk,
    DATEPART(WEEKDAY, @d)       AS wd,
    DATEPART(DAYOFYEAR, @d)     AS doy,
    DATEPART(HOUR, @d)          AS hr,
    DATEPART(MINUTE, @d)        AS mn,
    DATEPART(SECOND, @d)        AS ss,
    DATEPART(MILLISECOND, @d)   AS ms,
    DATEPART(MICROSECOND, @d)   AS us,
    DATEPART(NANOSECOND, @d)    AS ns;
```

| yr | qt | mo | dy | wk | wd | doy | hr | mn | ss | ms | us | ns |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2025 | 2 | 4 | 8 | 15 | 3 | 98 | 14 | 30 | 45 | 123 | 123456 | 123456700 |

> [!info]- DATEPART reference
>
> - `YEAR`, `QUARTER`, `MONTH`, `DAY` — calendar parts.
> - `DAYOFYEAR` — ordinal day 1–366.
> - `WEEK` — week of year (affected by `SET DATEFIRST`).
> - `WEEKDAY` — day of week 1–7 (affected by `SET DATEFIRST`, default is 1=Sunday on `us_english`).
> - `HOUR`, `MINUTE`, `SECOND` — clock parts.
> - `MILLISECOND`, `MICROSECOND`, `NANOSECOND` — fractional parts. `NANOSECOND` reports 100-ns ticks, so the maximum return value is `999999900` for `datetime2(7)`.
> - `TZOFFSET` — for `datetimeoffset`, returns the stored offset in minutes.

#### DATENAME vs DATEPART

*`DATENAME` returns the localized string form of a part, where applicable.*

```sql
DECLARE @d datetime2 = '2025-04-08';
SELECT
    DATEPART(MONTH, @d)    AS month_int,
    DATENAME(MONTH, @d)    AS month_name,
    DATEPART(WEEKDAY, @d)  AS weekday_int,
    DATENAME(WEEKDAY, @d)  AS weekday_name;
```

| month_int | month_name | weekday_int | weekday_name |
|---|---|---|---|
| 4 | April | 3 | Tuesday |

The `month_name` and `weekday_name` values depend on the session's current language (`SET LANGUAGE`). On a `french` session, the same query returns `avril` and `mardi`. For stable output across sessions and deployments, use `DATEPART` and map the integer to whatever display strings your application requires.

> [!warning] DATENAME is locale-sensitive
>
> - The string output depends on `SET LANGUAGE`, which in turn defaults to the login's default language.
> - Report queries that embed `DATENAME(MONTH, ...)` in column headers will break if a different user runs them in a different language.
> - Use `DATEPART` and do the localization in the presentation layer, or use `FORMAT(date, 'MMMM', 'en-US')` for an explicit culture.

### SARGability and date predicates

*Why `WHERE YEAR(col) = 2025` is slow and what to write instead.*

#### The functions-on-column anti-pattern

*Wrapping the column in a function disables index seeks.*

```sql
SELECT COUNT(*)
FROM silver.eurostoxx50_ohlcv
WHERE YEAR([date]) = 2025 AND MONTH([date]) = 1;
```

|  |
|---|
| 1099 |

This query returns the correct answer, but the optimizer cannot seek an index on `[date]` because the predicate references `YEAR([date])` and `MONTH([date])` — functions applied to the column itself. The engine has to scan every row, evaluate the functions, then filter. On a 67,000-row table this is fine; on a billion-row table it is a disaster.

> [!failure] Functions on the indexed column disable seeks
>
> Any of these patterns forces a scan:
>
> - `WHERE YEAR(col) = 2025`
> - `WHERE CAST(col AS date) = '2025-01-15'`
> - `WHERE DATEDIFF(DAY, col, GETDATE()) < 7`
> - `WHERE FORMAT(col, 'yyyy-MM') = '2025-01'`
>
> All four rewrite the predicate so the indexed column is inside a function, which prevents the optimizer from matching it against index key boundaries.

#### Half-open range fix

*Move all the computation to the literal side, leaving the column bare on the left side of the comparison.*

```sql
SELECT COUNT(*)
FROM silver.eurostoxx50_ohlcv
WHERE [date] >= '2025-01-01'
  AND [date] <  '2025-02-01';
```

|  |
|---|
| 1099 |

Same answer, 1099 rows. The difference is that this form is **SARGable** — the optimizer can seek the index on `[date]` directly because the column is on the left side of the comparison and no function is wrapping it.

> [!success] Half-open range is the universal fix
>
> - `col >= start_inclusive AND col < end_exclusive` works for every temporal type.
> - It handles time precision correctly (no `23:59:59.999` rounding bug).
> - It is SARGable — the optimizer can use any index on the column.
> - Compute the boundary values once, pass them as parameters or literals, and let the engine do the work.

## Parts-Based Constructors

> [!abstract] Build dates from integers, not strings
>
> The parts-based constructors `DATEFROMPARTS`, `DATETIME2FROMPARTS`, and `DATETIMEOFFSETFROMPARTS` assemble a temporal value from individual integer components. They are safer than concatenating strings and casting, because they type-check each argument at compile time and reject invalid combinations (February 30th, hour 25, negative months). Prefer them whenever the source data arrives as separate numeric columns.

### The three constructors

*One constructor per temporal return type.*

#### DATEFROMPARTS, DATETIME2FROMPARTS, DATETIMEOFFSETFROMPARTS

*Build each type from integer inputs.*

```sql
SELECT
    DATEFROMPARTS(2025, 4, 8) AS safe_date,
    DATETIME2FROMPARTS(2025, 4, 8, 14, 30, 0, 1234567, 7) AS safe_dt2,
    CONVERT(varchar(40),
        DATETIMEOFFSETFROMPARTS(2025, 4, 8, 14, 30, 0, 0, 2, 0, 0),
        121) AS safe_dto;
```

| safe_date | safe_dt2 | safe_dto |
|---|---|---|
| 2025-04-08 | 2025-04-08 14:30:00.123456 | 2025-04-08 14:30:00 +02:00 |

> [!info]- Constructor signatures
>
> - `DATEFROMPARTS(year, month, day)` — returns `date`.
> - `DATETIME2FROMPARTS(year, month, day, hour, minute, second, fractions, precision)` — returns `datetime2(precision)`. The `fractions` argument is an integer with up to `precision` digits.
> - `DATETIMEOFFSETFROMPARTS(year, month, day, hour, minute, second, fractions, hour_offset, minute_offset, precision)` — returns `datetimeoffset(precision)`.
> - `DATETIMEFROMPARTS` — legacy `datetime`, avoid in new code.
> - `SMALLDATETIMEFROMPARTS` — legacy `smalldatetime`, avoid in new code.
> - `TIMEFROMPARTS(hour, minute, second, fractions, precision)` — returns `time(precision)`.

#### Invalid combinations raise

*Invalid date components produce a hard error — unlike string parsing which can quietly misinterpret them.*

```sql
SELECT DATEFROMPARTS(2025, 2, 30);
```

```text
('42000', '[42000] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]Cannot construct data type date, some of the arguments have values which are not valid. (289) (SQLExecDirectW)')
```

February 30th does not exist and the constructor raises error 289. Compare this to parsing `'2025-02-30'` as a string, which some locales would accept and silently convert to March 2nd or 3rd.

> [!tip] Prefer parts constructors over string concat
>
> - `DATEFROMPARTS(yr, mo, dy)` fails loudly on invalid components.
> - `CAST(CONCAT(yr, '-', mo, '-', dy) AS date)` succeeds in surprising ways and can hide bad data.
> - The parts form does not depend on the session's `DATEFORMAT` or `LANGUAGE`.
> - It is also slightly faster because there is no string allocation or parse step.

## EOMONTH and Business Boundaries

> [!abstract] Period boundaries
>
> Most reporting queries need period-boundary dates: first/last day of month, first/last day of quarter, first/last day of year. `EOMONTH` is the direct tool for month-end; the other boundaries are built from `DATEFROMPARTS`, `DATEADD`, and `DATEDIFF` with predictable patterns. Knowing these patterns by heart is what separates a fast writer of reporting SQL from someone who reinvents the wheel on every query.

### EOMONTH

*Return the last day of a given month, optionally offset by N months.*

#### Basic and offset EOMONTH

*Last day of this month, next month, a leap-year February, and 11 months prior.*

```sql
SELECT
    EOMONTH('2025-02-11')       AS feb_end,
    EOMONTH('2025-02-11', 1)    AS next_month_end,
    EOMONTH('2024-02-11')       AS leap_feb,
    EOMONTH('2025-12-15', -11)  AS jan_end_prior_year;
```

| feb_end | next_month_end | leap_feb | jan_end_prior_year |
|---|---|---|---|
| 2025-02-28 | 2025-03-31 | 2024-02-29 | 2025-01-31 |

> [!info]- EOMONTH anatomy
>
> - First argument: any date/time expression; only the month and year are used.
> - Second argument (optional): integer offset in months, positive or negative.
> - Return type: `date`.
> - Handles leap years correctly (`EOMONTH('2024-02-11')` returns `2024-02-29`).

### First-of-period patterns

*Build the start of the current month, quarter, and year.*

#### First of month, quarter, year

*The three canonical period-start patterns.*

```sql
DECLARE @today date = '2025-04-08';
SELECT
    DATEFROMPARTS(YEAR(@today), MONTH(@today), 1)     AS first_of_month,
    DATEADD(QUARTER, DATEDIFF(QUARTER, 0, @today), 0) AS first_of_quarter,
    DATEFROMPARTS(YEAR(@today), 1, 1)                 AS first_of_year;
```

| first_of_month | first_of_quarter | first_of_year |
|---|---|---|
| 2025-04-01 | 2025-04-01 00:00:00 | 2025-01-01 |

> [!info]- Pattern breakdown
>
> - **First of month**: `DATEFROMPARTS(YEAR(x), MONTH(x), 1)` — direct and clear.
> - **First of quarter**: `DATEADD(QUARTER, DATEDIFF(QUARTER, 0, x), 0)` — counts quarter boundaries since the epoch `0` (which is `1900-01-01`) and adds that many quarters back to zero. The result is the start of the quarter containing `x`. This idiom generalizes to `WEEK`, `MONTH`, `YEAR`, `HOUR`, etc.
> - **First of year**: `DATEFROMPARTS(YEAR(x), 1, 1)` — the simplest form.

> [!tip] Last-of-period is EOMONTH or first-of-next-period minus one
>
> - Last of month: `EOMONTH(x)`.
> - Last of quarter: `EOMONTH(DATEADD(QUARTER, DATEDIFF(QUARTER, 0, x) + 1, -1))` — or just compute first-of-next-quarter and use `< first_of_next` in a half-open range.
> - Last of year: `DATEFROMPARTS(YEAR(x), 12, 31)`.
> - In most query contexts, the "first of next period" form is cleaner than the "last of this period" form because it composes directly with the half-open range pattern: `col >= start AND col < next_start`.

## ISO 8601 Literals and Safe Parsing

> [!abstract] Locale-independent date literals
>
> SQL Server parses date literals according to the session's `DATEFORMAT` setting, which is derived from the login's default language. This means the string `'04/08/2025'` is `April 8` on an `mdy` session and `August 4` on a `dmy` session — a bug that will not be caught by any test because both parses succeed. The universal fix is to write every literal in **ISO 8601** form (`'2025-04-08'` or `'2025-04-08T14:30:00'`), which SQL Server interprets the same way regardless of `DATEFORMAT` or `LANGUAGE`.

### The locale trap

*Two identical strings, two different parses.*

#### DATEFORMAT mdy

*Session set to US-style month/day/year.*

```sql
SET DATEFORMAT mdy;
SELECT CAST('04/08/2025' AS date) AS mdy_reading;
```

| mdy_reading |
|---|
| 2025-04-08 |

#### DATEFORMAT dmy

*Same string, European-style day/month/year.*

```sql
SET DATEFORMAT dmy;
SELECT CAST('04/08/2025' AS date) AS dmy_reading;
```

| dmy_reading |
|---|
| 2025-08-04 |

The same string `'04/08/2025'` is interpreted as **April 8** on an `mdy` session and **August 4** on a `dmy` session — a four-month error that silently flips every value.

> [!failure] Locale-dependent literals are a data integrity risk
>
> - `'04/08/2025'` changes meaning based on `SET DATEFORMAT`.
> - `'04-08-2025'` is also locale-dependent despite the hyphens.
> - Production servers across regions frequently have different default languages.
> - A query that works correctly in development can silently produce wrong results in production.

> [!success] ISO 8601 literals are unambiguous
>
> - `'2025-04-08'` — always April 8th, 2025, regardless of `DATEFORMAT`.
> - `'2025-04-08T14:30:00'` — same value with time, unambiguous across every session.
> - `'2025-04-08T14:30:00+02:00'` — offset-aware literal for `datetimeoffset`.
> - These forms are ISO 8601 standard and are the only date literals you should write in code you intend to ship.

#### ISO literal example

*A canonical ISO datetime literal cast to `datetime2`.*

```sql
SELECT CAST('2025-04-08T14:30:00' AS datetime2) AS iso_literal;
```

| iso_literal |
|---|
| 2025-04-08 14:30:00 |

### Defensive parsing

*When you cannot control the input format, use `TRY_CONVERT` to parse without raising.*

#### TRY_CONVERT returns NULL on failure

*Unparseable inputs produce `NULL` instead of an error, letting the query continue.*

```sql
SELECT
    TRY_CONVERT(date, '2025-13-40')         AS bad_date,
    TRY_CONVERT(date, '2025-04-08')         AS good_date,
    TRY_CONVERT(datetime2, 'not a date')    AS not_parseable;
```

| bad_date | good_date | not_parseable |
|---|---|---|
| NULL | 2025-04-08 | NULL |

`TRY_CONVERT` never raises on invalid input — it returns `NULL` instead. This makes it the right tool for ETL quarantine logic: keep the rows with a non-`NULL` parsed value, route the `NULL` rows into a quarantine table for manual review.

> [!tip] TRY_CONVERT vs TRY_PARSE
>
> - `TRY_CONVERT` uses the same rules as `CONVERT` (and `CAST`) but suppresses errors.
> - `TRY_PARSE` uses .NET's `DateTime.Parse` and accepts a `USING <culture>` clause for locale-specific parsing; it is slower and should only be used when you need .NET's parsing flexibility.
> - For ISO-formatted inputs and most other cases, prefer `TRY_CONVERT`.

## AT TIME ZONE

> [!abstract] Timezone-aware conversion
>
> `AT TIME ZONE` is SQL Server's operator for timezone-aware date/time conversion. It always returns a `datetimeoffset` value in the target zone, regardless of the input type. Applied to a naive `datetime2`, it **attaches** the target zone's offset without converting. Applied to a `datetimeoffset`, it **converts** the stored instant into the target zone's wall-clock form. Chain two calls (`... AT TIME ZONE 'UTC' AT TIME ZONE 'Romance Standard Time'`) to convert a naive UTC value into Paris local time.
>
> SQL Server uses **Windows time zone names** (e.g., `Romance Standard Time`), not IANA names (e.g., `Europe/Paris`). Query `sys.time_zone_info` to list the valid names available on your server.

### Attaching an offset to a naive value

*Treat a naive `datetime2` as if it were already in the target zone, and tag it with that zone's offset.*

#### AT TIME ZONE 'UTC'

*Wrap a naive value and declare "this was always UTC".*

```sql
SELECT CONVERT(varchar(40),
    CAST('2025-03-10T15:30:00' AS datetime2) AT TIME ZONE 'UTC',
    121) AS attach_utc;
```

| attach_utc |
|---|
| 2025-03-10 15:30:00.0000000 +00:00 |

The wall-clock value is unchanged (`15:30:00`), but the result is now a `datetimeoffset` with `+00:00` attached. No shift occurred — SQL Server interpreted the naive input as already being in the `UTC` zone.

> [!info]- How AT TIME ZONE treats naive inputs
>
> - `datetime2` value + `AT TIME ZONE 'X'` → `datetimeoffset` value tagged with zone `X`'s current offset.
> - The wall-clock digits are preserved — only the offset is added.
> - This is the right operation when you have a naive column you know represents local time in a specific zone, and you want to convert the column into a proper `datetimeoffset` for downstream use.

### Converting between zones

*Chain two `AT TIME ZONE` calls to shift an instant across zones.*

#### UTC to Paris

*First attach the zone (step 1), then convert to the target zone (step 2).*

```sql
SELECT CONVERT(varchar(40),
    CAST('2025-03-10T15:30:00' AS datetime2) AT TIME ZONE 'UTC'
                                             AT TIME ZONE 'Romance Standard Time',
    121) AS paris_time;
```

| paris_time |
|---|
| 2025-03-10 16:30:00.0000000 +01:00 |

On `2025-03-10`, Paris was still on standard time (`+01:00` — DST starts on the last Sunday of March). The conversion adds one hour to `15:30 UTC` and produces `16:30 +01:00`, which is the correct Paris local time at that instant.

> [!info]- Chained AT TIME ZONE semantics
>
> - **First call**: attaches the source zone to a naive value (the `datetime2` becomes a `datetimeoffset`).
> - **Second call**: converts the `datetimeoffset` into the target zone — the wall-clock shifts, the offset changes to the target zone's offset.
> - If the input is already a `datetimeoffset`, you only need the second call; the first one is only needed for naive inputs.

### sys.time_zone_info

*The catalog view listing every zone name SQL Server recognizes.*

#### Sample zone offsets

*A handful of common zones and their current UTC offsets.*

```sql
SELECT TOP (5) name, current_utc_offset, is_currently_dst
FROM sys.time_zone_info
WHERE name IN (
    'UTC',
    'Romance Standard Time',
    'Central Europe Standard Time',
    'Eastern Standard Time',
    'Tokyo Standard Time'
)
ORDER BY current_utc_offset;
```

| name | current_utc_offset | is_currently_dst |
|---|---|---|
| UTC | +00:00 | False |
| Romance Standard Time | +02:00 | True |
| Central Europe Standard Time | +02:00 | True |
| Tokyo Standard Time | +09:00 | False |
| Eastern Standard Time | -04:00 | True |

The three columns are:

- `name` — the Windows zone identifier you pass to `AT TIME ZONE`.
- `current_utc_offset` — the zone's current offset, which changes with DST.
- `is_currently_dst` — whether the zone is currently in daylight saving time. This query was run in April 2026 when European zones are in DST (so Paris/Romance shows `+02:00` even though its standard offset is `+01:00`).

> [!warning] Windows zone names, not IANA names
>
> SQL Server does not accept IANA zone names like `Europe/Paris`:
>
> - Pass `Romance Standard Time` instead of `Europe/Paris`.
> - Pass `Central Europe Standard Time` instead of `Europe/Berlin`.
> - Pass `Eastern Standard Time` instead of `America/New_York`.
> - If you need to cross-reference between IANA and Windows, the Linux-to-Windows mapping in the SQL Server on Linux docs is the authoritative table.

## DST and Boundary Pitfalls

> [!abstract] Daylight saving is real
>
> Daylight saving transitions create two pathological cases every year:
>
> - **Spring forward**: at 2:00 AM local, clocks jump to 3:00 AM. The hour `02:00`–`02:59` does not exist; any "local time in that hour" is a fiction.
> - **Fall back**: at 3:00 AM local, clocks jump back to 2:00 AM. The hour `02:00`–`02:59` occurs twice; any "local time in that hour" is ambiguous without an explicit offset.
>
> SQL Server's `AT TIME ZONE` applies specific documented rules to these transitions: non-existent local times are converted with the *after-DST* offset, and ambiguous local times are presented with the *before-change* offset. Understanding these rules is essential for any system that stores local time in a naive column.

### Spring forward — non-existent local time

*At 02:30 local on spring-forward day, the clock has already jumped to 03:30.*

#### Paris spring-forward 2025

*March 30, 2025 was the European DST change day. 02:30 Paris local does not exist that day.*

```sql
SELECT
    CONVERT(varchar(40),
        CAST('2025-03-30T02:30:00' AS datetime2) AT TIME ZONE 'Romance Standard Time',
        121) AS paris_gap_local,
    CONVERT(varchar(40),
        CAST('2025-03-30T00:30:00' AS datetime2) AT TIME ZONE 'UTC'
                                                 AT TIME ZONE 'Romance Standard Time',
        121) AS paris_after_utc;
```

| paris_gap_local | paris_after_utc |
|---|---|
| 2025-03-30 03:30:00.0000000 +02:00 | 2025-03-30 01:30:00.0000000 +01:00 |

Read the left column: the input was `2025-03-30 02:30:00` as if it were Paris local time. `AT TIME ZONE` applies the *after-DST* offset (`+02:00`) and produces `03:30:00 +02:00` — because 02:30 didn't exist, the engine treats it as the time one hour later, 03:30, which does exist.

The right column shows the correct way to handle the transition: start from UTC (`00:30 UTC`), which is unambiguous, and convert to Paris. At that instant Paris was still on standard time (`+01:00`), so the result is `01:30 +01:00` — the correct local wall-clock value half an hour before the DST jump.

> [!failure] Non-existent local time cannot be round-tripped
>
> If you store local wall-clock time in a naive column and the user picks "02:30 on the DST change day":
>
> - That value does not correspond to a real instant.
> - `AT TIME ZONE` will silently snap it forward to `03:30 +02:00`.
> - The user's intent is lost — there is no way to tell whether they meant "02:30 before DST, which is actually 03:30 after" or "they misread a clock".
> - The only correct storage for event timestamps is UTC, converted to local time at read time.

### Fall back — ambiguous local time

*At 02:30 local on fall-back day, the clock says 02:30 twice — once at +02:00 and once at +01:00.*

#### Paris fall-back 2025

*October 26, 2025 was the European DST exit day. 02:30 Paris local happened twice.*

```sql
SELECT
    CONVERT(varchar(40),
        CAST('2025-10-26T02:30:00' AS datetime2) AT TIME ZONE 'Romance Standard Time',
        121) AS paris_ambiguous_before,
    CONVERT(varchar(40),
        CAST('2025-10-26T01:30:00' AS datetime2) AT TIME ZONE 'UTC'
                                                 AT TIME ZONE 'Romance Standard Time',
        121) AS paris_0130_utc;
```

| paris_ambiguous_before | paris_0130_utc |
|---|---|
| 2025-10-26 02:30:00.0000000 +02:00 | 2025-10-26 02:30:00.0000000 +01:00 |

Both columns show `02:30:00` on `2025-10-26`. They are **different instants**:

- The left column is the first `02:30` (still on DST, offset `+02:00`) — the naive input was treated as local time before the DST change, per the documented rule.
- The right column is the second `02:30` (after DST ended, offset `+01:00`) — derived from `01:30 UTC`.

Both wall-clock strings are identical. Only the offset distinguishes them, and only the `datetimeoffset` representation preserves that distinction.

> [!danger] Naive local time in the fall-back hour is unrecoverable
>
> If an audit log stores local wall-clock time as a `datetime2` during the fall-back hour:
>
> - Two events one hour apart can have identical timestamps.
> - There is no way to sort them correctly, deduplicate them, or compute elapsed time between them.
> - The only defense is to store every timestamp as `datetimeoffset` or as UTC `datetime2`, and convert on display.

### BETWEEN on datetime2

*The `BETWEEN` operator on a `datetime2` column does not cover a full day's data.*

#### BETWEEN misses the tail of the end day

*A naive "BETWEEN start AND end" range excludes every event after midnight on the end day.*

```sql
DECLARE @events TABLE (ts datetime2);
INSERT INTO @events VALUES
    ('2025-04-30 00:00:00'),
    ('2025-04-30 12:00:00'),
    ('2025-04-30 23:59:59.9999999'),
    ('2025-05-01 00:00:00');
SELECT ts
FROM @events
WHERE ts BETWEEN '2025-04-01' AND '2025-04-30';
```

| ts |
|---|
| 2025-04-30 00:00:00 |

Only the midnight event on April 30 is returned. The 12:00 and `23:59:59.9999999` events are **missed** — `BETWEEN ... AND '2025-04-30'` is equivalent to `<= '2025-04-30 00:00:00'`, which excludes the rest of the day.

> [!failure] BETWEEN on datetime2 excludes most of the end day
>
> - The literal `'2025-04-30'` is interpreted as `2025-04-30 00:00:00.0000000`.
> - `BETWEEN '2025-04-01' AND '2025-04-30'` matches `col >= '2025-04-01' AND col <= '2025-04-30 00:00:00'`.
> - Every event with a non-zero time on April 30 is silently excluded.
> - This is the most common production reporting bug in the entire temporal feature set.

#### Half-open range covers the full day

*Use `>= start AND < next_start` to include every event in the target period.*

```sql
DECLARE @events TABLE (ts datetime2);
INSERT INTO @events VALUES
    ('2025-04-30 00:00:00'),
    ('2025-04-30 12:00:00'),
    ('2025-04-30 23:59:59.9999999'),
    ('2025-05-01 00:00:00');
SELECT ts
FROM @events
WHERE ts >= '2025-04-01'
  AND ts <  '2025-05-01';
```

| ts |
|---|
| 2025-04-30 00:00:00 |
| 2025-04-30 12:00:00 |
| 2025-04-30 23:59:59.999999 |

All three April 30 events are included, and the May 1 midnight event is correctly excluded. The half-open range handles every precision scale — nothing changes if the column is `datetime2(3)` vs `datetime2(7)`.

> [!success] Half-open range is the only correct date filter
>
> - `col >= start AND col < end` works on every temporal type.
> - It handles all precision scales without thinking about trailing 9s.
> - It is SARGable (no functions on the column side).
> - It composes naturally with first-of-next-period patterns.

## Practical Date Patterns

> [!abstract] Production reporting shapes
>
> Every reporting query in every organization boils down to the same handful of period-boundary patterns: "last N days", "current month", "year-to-date", "previous quarter". Writing them correctly means using SARGable predicates (half-open ranges, no functions on the column) and composing them from the EOMONTH / DATEFROMPARTS / DATEADD building blocks above.

### Rolling windows

*"Last N days" from a fixed anchor date.*

#### Last 7 days against a real table

*Pull every row from the last week of trading through April 7, 2026.*

```sql
SELECT TOP (5) symbol, [date], [close]
FROM silver.eurostoxx50_ohlcv
WHERE [date] >= '2026-04-01'
  AND [date] <  '2026-04-08'
ORDER BY [date] DESC, symbol;
```

| symbol | date | close |
|---|---|---|
| ABI.BR | 2026-04-07 | 61.62 |
| AD.AS | 2026-04-07 | 41.69 |
| ADS.DE | 2026-04-07 | 130.85 |
| ADYEN.AS | 2026-04-07 | 844.2 |
| AI.PA | 2026-04-07 | 181.5 |

The half-open predicate `[date] >= '2026-04-01' AND [date] < '2026-04-08'` captures exactly the April 1 through April 7 trading days. Switching the anchor to a parameter and computing it with `DATEADD(DAY, -7, CAST(SYSUTCDATETIME() AS date))` generalizes the pattern for any "last N days from now" query.

### Period boundaries

*Current-month window built from a parameterized anchor date.*

#### Current month from an anchor

*Compute the first day of the month and the first day of the next month.*

```sql
DECLARE @now date = '2025-04-08';
SELECT
    DATEFROMPARTS(YEAR(@now), MONTH(@now), 1) AS month_start,
    DATEADD(MONTH, 1,
        DATEFROMPARTS(YEAR(@now), MONTH(@now), 1)) AS month_end_exclusive;
```

| month_start | month_end_exclusive |
|---|---|
| 2025-04-01 | 2025-05-01 |

Use the two computed values directly in a half-open predicate: `WHERE col >= @month_start AND col < @month_end_exclusive`. This is SARGable, precision-safe, and DST-safe.

### Real datetime2 column in silver.index_dim

*A production SCD-2 dimension table with `valid_from` / `valid_to` / `is_current` columns demonstrates the audit timestamp pattern.*

```sql
SELECT TOP (3) symbol, valid_from, valid_to, is_current
FROM silver.index_dim
WHERE is_current = 1
ORDER BY symbol;
```

| symbol | valid_from | valid_to | is_current |
|---|---|---|---|
| 0388.HK | 2026-03-04 22:11:36.30016 | NULL | True |
| 1299.HK | 2026-03-04 22:11:36.263401 | NULL | True |
| 1810.HK | 2026-03-04 22:11:36.328825 | NULL | True |

This is the canonical Slowly Changing Dimension Type 2 shape: `valid_from` is the UTC timestamp the record became active (populated by `SYSUTCDATETIME()` in the ETL), `valid_to` is `NULL` for the currently-active record, and `is_current` is a convenience flag denormalized from the `valid_to IS NULL` predicate. The `datetime2` column holds sub-millisecond precision to allow monotonic ordering of same-second changes.

> [!tip] SCD-2 timestamp patterns
>
> - Always populate `valid_from` with `SYSUTCDATETIME()`, never `GETDATE()`.
> - Use `datetime2(7)` (or at minimum `datetime2(6)`) so simultaneous updates do not collide.
> - Current-record predicates should use `is_current = 1` for performance (indexable) and `valid_to IS NULL` for correctness checks.
> - Point-in-time queries use `WHERE @asof_ts >= valid_from AND (@asof_ts < valid_to OR valid_to IS NULL)` — half-open range as always.

## Practical Guidance

> [!tip] Defaults for new code
>
> - **Type**: `datetime2(3)` for most timestamps; `datetime2(7)` when monotonicity matters; `datetimeoffset(3)` when the offset is a business fact; `date` when you do not need time.
> - **Write timestamp**: always `SYSUTCDATETIME()`, never `GETDATE()`.
> - **Literals**: ISO 8601 only (`'2025-04-08'`, `'2025-04-08T14:30:00'`, `'2025-04-08T14:30:00+02:00'`).
> - **Construction**: `DATEFROMPARTS` / `DATETIME2FROMPARTS` / `DATETIMEOFFSETFROMPARTS`, never string concatenation.
> - **Date filters**: half-open range (`>= start AND < end`), never `BETWEEN`, never functions on the column.
> - **Time zones**: `AT TIME ZONE` with Windows zone names from `sys.time_zone_info`, never manual offset arithmetic.
> - **Storage**: UTC in the column, conversion to local time at the presentation layer.
> - **Age / tenure**: `DATEDIFF(YEAR, ...)` with a CASE compensation for the birthday/anniversary not yet reached.

> [!warning] Production-grade checklist
>
> Before shipping any temporal code:
>
> - Have you used ISO 8601 literals everywhere?
> - Are all date filters half-open (`>= AND <`)?
> - Are there any `WHERE YEAR(col)`, `WHERE CAST(col AS date)`, or `WHERE DATEDIFF(...) < N` patterns that should be rewritten for SARGability?
> - Is the column the column type you think it is — `datetime2` and not legacy `datetime`?
> - If you store local time, does `AT TIME ZONE` correctly handle DST transitions for the data you expect to land in those hours?
> - Does the audit log use `datetimeoffset` or UTC `datetime2` + `SYSUTCDATETIME()`?
