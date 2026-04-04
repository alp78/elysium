---
tags: [python, csharp, sql, sql-server, tsql]
aliases: [SQL Server date functions, datetime types, DATETIMEOFFSET, DATETIME2, DATEADD, DATEDIFF, EOMONTH, DATETRUNC, AT TIME ZONE, ISO 8601, date arithmetic]
description: "Complete reference for date and time handling in SQL Server T-SQL, Python, and C# — covering ISO 8601 formats, data type selection, parsing/formatting, date arithmetic, timezone conversion, and DST pitfalls that break pipelines."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Date and Time Functions

> [!quote]
> "There are two hard problems in datetime handling: timezone conversions, daylight saving transitions, and off-by-one errors."
>
> — **Jon Skeet**, *Noda Time*

Dates look simple until you realize that "March 10, 2026 at 3 PM" means a different instant in time depending on whether you're in Paris, New York, or Tokyo. For the shell-level `date` equivalents used in backup scripts and cron jobs, see [date-and-time-handling](https://alp78.github.io/elysium/01-Shell/Text-Processing/date-and-time-handling). A pipeline that processes market close times across a Euro market index, a US 50 index, and an Asia/Pacific 50 index must handle three different closing times, daylight saving transitions that happen on different dates in different countries, and the fact that "today" is a different date in Sydney and New York for several hours each day.

---

## ISO 8601 — The Only Date Format You Should Use

ISO 8601 is the international standard for date/time representation. It is unambiguous, sortable as text, and understood by every language and database. If you use any other format in your pipeline, you are creating technical debt.

| Format | Example | Name |
|--------|---------|------|
| `YYYY-MM-DD` | `2026-03-10` | Date only |
| `YYYY-MM-DDThh:mm:ss` | `2026-03-10T15:30:00` | Local datetime (no timezone!) |
| `YYYY-MM-DDThh:mm:ssZ` | `2026-03-10T15:30:00Z` | UTC (Z = "Zulu" = UTC+0) |
| `YYYY-MM-DDThh:mm:ss±hh:mm` | `2026-03-10T15:30:00+01:00` | With UTC offset |
| `YYYY-MM-DDThh:mm:ss.ffffff` | `2026-03-10T15:30:00.123456` | With microseconds |
| `YYYY-MM-DDThh:mm:ss.ffffffZ` | `2026-03-10T15:30:00.123456Z` | UTC with microseconds |
| `YYYYMMDDThhmmssZ` | `20260310T153000Z` | Compact (no separators) |
| `YYYY-Www` | `2026-W11` | ISO week (week 11 of 2026) |
| `YYYY-Www-D` | `2026-W11-2` | ISO week + day (Tuesday) |
| `YYYY-DDD` | `2026-069` | Ordinal date (day 69 of 2026) |

#### ISO 8601 date format — decision matrix by context

| Context | Format | Example | Why |
|---------|--------|---------|-----|
| SQL `trade_date` column | `DATE` | `2026-03-10` | No time component — clean, small, indexable |
| SQL timestamp column | `DATETIMEOFFSET` | `2026-03-10 15:30:00 +01:00` | Preserves timezone, unambiguous |
| API response body (JSON) | ISO 8601 string | `"2026-03-10T15:30:00Z"` | Universal standard, every language parses it |
| Log timestamps | ISO 8601 UTC | `2026-03-10T15:30:00.123Z` | Sortable, grep-friendly, Datadog/ELK expect it |
| File names (partitions) | `YYYYMMDD` or `YYYY-MM-DD` | `scores_20260310.parquet` | Sortable, no special chars, filesystem-safe |
| Cron / Airflow schedule | UTC | `0 17 * * 1-5` | Avoids DST surprises — 17:00 UTC is always 17:00 UTC |
| User-facing display | Localized | `10 Mar 2026, 16:30 CET` | Humans expect their local time and format |
| Python internal | `datetime` object | `datetime(2026, 3, 10, 15, 30, tzinfo=...)` | Native arithmetic, comparison, timezone-aware |
| C# internal | `DateTimeOffset` | `new DateTimeOffset(2026, 3, 10, 15, 30, 0, TimeSpan.FromHours(1))` | Preserves offset, unambiguous |

> [!info] Date Format Rules for Pipelines
>
> 1. **Store dates as `DATE` or `DATETIME2` in SQL Server, never as strings.** String dates cannot be indexed efficiently, cannot be compared with `<`/`>`, and break when formats change.
> 2. **If you must store as string, use ISO 8601 (`YYYY-MM-DD`).** It sorts correctly as text.
> 3. **Always store timestamps in UTC.** Convert to local time only at the presentation layer.
> 4. **Use `DATETIMEOFFSET` in SQL Server for timestamps that cross timezones.** `DATETIME2` loses the timezone.
> 5. **`trade_date` columns should be `DATE`, not `DATETIME`.** A trade date is a calendar date, not a moment in time.

---

### SQL Server Date Data Types

SQL Server provides six date/time types with different precision and storage tradeoffs. DATE (3 bytes, date only) is the most efficient for trade dates. DATETIME2 (6-8 bytes) replaces the legacy DATETIME with nanosecond precision. DATETIMEOFFSET stores the timezone offset alongside the value.

> [!info] SQL Server Date/Time Type Comparison
>
> | Type | Example | Size | Notes |
> |------|---------|------|-------|
> | `DATE` | `2026-03-10` | 3 bytes | Date only, range 0001-01-01 to 9999-12-31 |
> | `TIME` | `15:30:00.1234567` | 3-5 bytes | Time only |
> | `DATETIME2` | `2026-03-10 15:30:00.1234567` | 6-8 bytes | Replaces DATETIME |
> | `DATETIMEOFFSET` | `2026-03-10 15:30:00.1234567 +01:00` | 8-10 bytes | Date + time + timezone |
> | `DATETIME` | `2026-03-10 15:30:00.123` | 8 bytes | Legacy — 3.33ms precision, avoid |
> | `SMALLDATETIME` | `2026-03-10 15:30:00` | 4 bytes | Legacy — minute precision only, avoid |

> [!tip] Use DATE for trade dates, DATETIME2 for timestamps, DATETIMEOFFSET for cross-timezone. Never use DATETIME for new columns — DATETIME2 is superior in every way.

---

### Current Date and Time Functions

SQL Server offers multiple functions that return the current timestamp at different precision levels. GETDATE() returns server-local DATETIME; SYSDATETIME() returns high-precision DATETIME2; SYSUTCDATETIME() returns UTC. For pipelines, always use SYSUTCDATETIME() to avoid timezone ambiguity.

```sql
-- Current date/time — choose carefully:
SELECT GETDATE()              -- 2026-03-10 16:30:00.123 (server-local, DATETIME)
SELECT GETUTCDATE()           -- 2026-03-10 15:30:00.123 (UTC, DATETIME)
SELECT SYSDATETIME()          -- 2026-03-10 16:30:00.1234567 (server-local, DATETIME2 — more precision)
SELECT SYSUTCDATETIME()       -- 2026-03-10 15:30:00.1234567 (UTC, DATETIME2)
SELECT SYSDATETIMEOFFSET()    -- 2026-03-10 16:30:00.1234567 +01:00 (with offset, DATETIMEOFFSET)
-- RULE: Use SYSUTCDATETIME() for timestamps in pipelines. Never GETDATE().
```

> [!warning] GETDATE() vs SYSUTCDATETIME()
>
> `GETDATE()` returns server-local time — if the server timezone is ever changed, all your comparisons break. `SYSUTCDATETIME()` always returns UTC. Set servers to UTC (`timedatectl set-timezone UTC`) so they are the same, but always code defensively with `SYSUTCDATETIME()`.

> [!success] Safe Pattern
>
> Always use `SYSUTCDATETIME()` for pipeline timestamps. Set the server timezone to UTC (`sudo timedatectl set-timezone UTC`) so `GETDATE()` and `SYSUTCDATETIME()` agree, eliminating any ambiguity at the OS level.

---

## Parsing and Formatting

Converting between date types and string representations. Parsing turns strings like '2026-03-15' into DATE values; formatting turns DATE values into display strings. SQL Server's implicit parsing depends on SET DATEFORMAT and SET LANGUAGE — making explicit CONVERT with style codes the only safe approach.

#### CAST(string AS date) — parse ISO date strings

```sql
SELECT CAST('2026-03-10' AS DATE)                                        -- 2026-03-10
SELECT CAST('2026-03-10T15:30:00' AS DATETIME2)                         -- 2026-03-10 15:30:00
SELECT CAST('2026-03-10T15:30:00+01:00' AS DATETIMEOFFSET)              -- 2026-03-10 15:30:00 +01:00
```

#### CONVERT(date, string, style) — parse non-ISO date formats

```sql
SELECT CONVERT(DATE, '03/10/2026', 101)           -- US format MM/DD/YYYY → 2026-03-10
SELECT CONVERT(DATE, '10/03/2026', 103)           -- European format DD/MM/YYYY → 2026-03-10
SELECT CONVERT(DATE, '10.03.2026', 104)           -- German format DD.MM.YYYY → 2026-03-10
SELECT CONVERT(DATE, '20260310', 112)              -- Compact YYYYMMDD → 2026-03-10
```

> [!info] Common CONVERT Style Codes
>
> | Style | Format | Example |
> |-------|--------|---------|
> | 101 | `MM/DD/YYYY` | US |
> | 103 | `DD/MM/YYYY` | British/European |
> | 104 | `DD.MM.YYYY` | German |
> | 112 | `YYYYMMDD` | Compact ISO, no separators |
> | 120 | `YYYY-MM-DD HH:MI:SS` | ODBC canonical |
> | 126 | `YYYY-MM-DDTHH:MI:SS.mmm` | ISO 8601 with T |
> | 127 | `YYYY-MM-DDTHH:MI:SS.mmmZ` | ISO 8601 with timezone |

#### FORMAT, CONVERT — date to string formatting

```sql
-- FORMAT — flexible but slow (10-50x slower than CONVERT)
SELECT FORMAT(GETDATE(), 'yyyy-MM-dd')                 -- 2026-03-10
SELECT FORMAT(GETDATE(), 'dd MMM yyyy')                -- 10 Mar 2026
SELECT FORMAT(GETDATE(), 'yyyyMMdd_HHmmss')            -- 20260310_163000
SELECT FORMAT(GETDATE(), 'yyyy-MM-ddTHH:mm:ssK')       -- 2026-03-10T16:30:00+01:00

-- CONVERT — use this in queries processing millions of rows
SELECT CONVERT(VARCHAR(10), GETDATE(), 120)             -- 2026-03-10 (fast)
```

> [!warning] FORMAT() Performance
>
> `FORMAT()` uses .NET formatting under the hood and is 10-50x slower than `CONVERT`. In queries processing millions of rows (like the data pipeline), always use `CONVERT` for date-to-string formatting. Use `FORMAT` only for one-off display queries.

> [!success] Safe Pattern
>
> Replace `FORMAT(date_col, 'yyyy-MM-dd')` with `CONVERT(VARCHAR(10), date_col, 120)` in all pipeline queries. Reserve `FORMAT()` for user-facing display statements where throughput is not a concern.

---

### Extracting Date Components

DATEPART extracts numeric components (year, month, day, hour) from a datetime value. DATENAME returns the name (e.g., 'March' instead of 3). DATETRUNC (SQL Server 2022+) truncates to a boundary without extracting — useful for GROUP BY period.

```sql
SELECT YEAR(GETDATE())                  -- 2026
SELECT MONTH(GETDATE())                 -- 3
SELECT DAY(GETDATE())                   -- 10
SELECT DATEPART(WEEKDAY, GETDATE())     -- 3 (Tuesday — depends on @@DATEFIRST setting!)
SELECT DATENAME(WEEKDAY, GETDATE())     -- Tuesday
SELECT DATEPART(HOUR, GETDATE())        -- 16
SELECT DATEPART(MINUTE, GETDATE())      -- 30
SELECT DATEPART(QUARTER, GETDATE())     -- 1
SELECT DATEPART(DAYOFYEAR, GETDATE())   -- 69
SELECT DATEPART(WEEK, GETDATE())        -- 11 (ISO week may differ — use ISO_WEEK)
SELECT DATEPART(ISO_WEEK, GETDATE())    -- 11 (ISO 8601 week number)

-- EOMONTH — end of month (invaluable for financial reporting)
SELECT EOMONTH(GETDATE())               -- 2026-03-31 (last day of current month)
SELECT EOMONTH(GETDATE(), 1)            -- 2026-04-30 (last day of NEXT month)
SELECT EOMONTH(GETDATE(), -1)           -- 2026-02-28 (last day of PREVIOUS month)

-- First day of month
SELECT DATETRUNC(MONTH, GETDATE())      -- 2026-03-01 (SQL Server 2022+)
-- Pre-2022:
SELECT DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)   -- 2026-03-01

-- Construct a date from parts
SELECT DATEFROMPARTS(2026, 3, 10)                                        -- 2026-03-10
SELECT DATETIME2FROMPARTS(2026, 3, 10, 15, 30, 0, 0, 7)                -- 2026-03-10 15:30:00
SELECT DATETIMEOFFSETFROMPARTS(2026, 3, 10, 15, 30, 0, 0, 1, 0, 7)     -- 2026-03-10 15:30:00 +01:00
```

> [!warning] @@DATEFIRST and Weekday Numbers
>
> `DATEPART(WEEKDAY, date)` returns 1-7, but what day is "1" depends on the `@@DATEFIRST` setting:
> - US default: `@@DATEFIRST = 7` → Sunday=1, Monday=2, ..., Saturday=7
> - ISO standard: `@@DATEFIRST = 1` → Monday=1, ..., Sunday=7
>
> If your pipeline assumes Monday=1 but the server uses Sunday=1, your weekend filter breaks silently. Use `DATENAME(WEEKDAY, date)` which returns 'Monday' regardless of setting, or set explicitly:
> ```sql
> SET DATEFIRST 1;  -- Monday = 1 (ISO standard)
> ```

> [!success] Safe Pattern
>
> Add `SET DATEFIRST 1;` at the top of stored procedures and scripts that use `DATEPART(WEEKDAY, ...)`. Alternatively, use `DATENAME(WEEKDAY, date) NOT IN ('Saturday', 'Sunday')` for weekend filters — it is locale-independent.

> [!warning] SET LANGUAGE Affects Date Parsing
>
> `SET LANGUAGE` changes how ambiguous date strings are interpreted AND how DATENAME returns month/day names. '03/10/2026' is March 10 in English but October 3 in British/European. DATENAME returns 'Tuesday' in English but 'Dienstag' in German. For international pipelines, always use ISO 8601 format ('2026-03-10') and numeric DATEPART instead of DATENAME.

> [!success] Safe Pattern
>
> Always use unambiguous ISO 8601 date strings (`'2026-03-10'`) in T-SQL code and use `DATEPART(YEAR/MONTH/DAY, ...)` instead of `DATENAME` when the result must be numeric. This makes the code immune to `SET LANGUAGE` settings on any server.

---

### Date Arithmetic

DATEADD adds intervals to a date; DATEDIFF counts boundary crossings between two dates. DATEDIFF counts how many times the specified boundary is crossed, NOT the elapsed time — DATEDIFF(MONTH, Jan 31, Feb 1) = 1 even though only one day passed.

```sql
-- Add/subtract intervals with DATEADD
SELECT DATEADD(DAY, 7, '2026-03-10')          -- 2026-03-17
SELECT DATEADD(DAY, -30, '2026-03-10')        -- 2026-02-08
SELECT DATEADD(MONTH, 3, '2026-03-10')        -- 2026-06-10
SELECT DATEADD(YEAR, 1, '2026-03-10')         -- 2027-03-10
SELECT DATEADD(HOUR, 5, '2026-03-10 15:30')   -- 2026-03-10 20:30:00
SELECT DATEADD(MINUTE, -90, '2026-03-10 15:30')  -- 2026-03-10 14:00:00

-- Difference between two dates with DATEDIFF
SELECT DATEDIFF(DAY, '2026-01-01', '2026-03-10')     -- 68
SELECT DATEDIFF(MONTH, '2025-06-15', '2026-03-10')   -- 9
SELECT DATEDIFF(YEAR, '2020-01-01', '2026-03-10')    -- 6
SELECT DATEDIFF(HOUR, '2026-03-10 08:00', '2026-03-10 17:30')   -- 9

-- DATEDIFF_BIG for large intervals (avoids INT overflow for seconds since epoch)
SELECT DATEDIFF_BIG(SECOND, '2000-01-01', SYSUTCDATETIME())   -- ~827,000,000

-- DATETRUNC — truncate to a boundary (SQL Server 2022+)
SELECT DATETRUNC(HOUR, GETDATE())        -- 2026-03-10 16:00:00 (drop minutes/seconds)
SELECT DATETRUNC(DAY, GETDATE())         -- 2026-03-10 00:00:00
SELECT DATETRUNC(MONTH, GETDATE())       -- 2026-03-01 00:00:00
SELECT DATETRUNC(QUARTER, GETDATE())     -- 2026-01-01 00:00:00
SELECT DATETRUNC(YEAR, GETDATE())        -- 2026-01-01 00:00:00
SELECT DATETRUNC(WEEK, GETDATE())        -- 2026-03-09 00:00:00 (Monday of the week)
-- Use case: GROUP BY date period without FORMAT/CONVERT overhead
```

> [!warning] DATEDIFF Counts Boundary Crossings
>
> DATEDIFF Counts Boundary Crossings, Not Full Periods.
> `DATEDIFF(YEAR, '2025-12-31', '2026-01-01')` = 1, even though they are only 1 day apart. `DATEDIFF(MONTH, '2026-01-31', '2026-02-01')` = 1, even though they are 1 day apart. For "how many complete months," use more careful logic combining DATEDIFF with DAY comparison.

> [!success] Safe Pattern
>
> To count complete months between two dates, combine `DATEDIFF` with a day-of-month adjustment: `DATEDIFF(MONTH, @start, @end) - CASE WHEN DAY(@end) < DAY(@start) THEN 1 ELSE 0 END`. For complete years, apply the same pattern with month and day components.

> [!warning] DATEDIFF Counts Boundaries, Not Elapsed Time
>
> `DATEDIFF(YEAR, '2025-12-31', '2026-01-01')` returns 1 — one year boundary crossed — even though only one day elapsed. `DATEDIFF(MONTH, '2026-01-31', '2026-02-01')` returns 1 even though it's one day. DATEDIFF is a boundary counter, not a duration calculator.

> [!success] Safe Pattern
>
> Use `DATEDIFF(DAY, @start, @end)` to measure actual elapsed days. For elapsed time in hours/minutes/seconds, use `DATEDIFF_BIG(SECOND, @start, @end)` and divide as needed. Avoid relying on `DATEDIFF(MONTH, ...)` or `DATEDIFF(YEAR, ...)` for "how much time passed" calculations.

> [!danger] DATEADD Month-End Truncation
>
> `DATEADD(MONTH, 1, '2026-01-31')` returns `2026-02-28`, not February 31 (which doesn't exist). SQL Server silently truncates to the last day of the target month. This breaks month-end financial reporting if you expect the last business day of each month. Use `EOMONTH(DATEADD(MONTH, 1, date))` for reliable end-of-month calculations.

> [!success] Safe Pattern
>
> Use `EOMONTH(DATEADD(MONTH, n, date))` for any end-of-month date arithmetic. For start-of-month, use `DATEFROMPARTS(YEAR(date), MONTH(DATEADD(MONTH, n, date)), 1)`. Both patterns are immune to month-end truncation.

---

### Timezone Conversion with AT TIME ZONE

DATETIME2 values have no timezone information. AT TIME ZONE attaches an offset (producing DATETIMEOFFSET) or converts between zones. Chain two AT TIME ZONE calls to convert: first to declare the source zone, then to convert to the target.

```sql
-- Convert between timezones (SQL Server 2016+)
SELECT GETDATE() AT TIME ZONE 'Central European Standard Time'
-- 2026-03-10 16:30:00.000 +01:00 (adds offset to local datetime)

-- Convert UTC to another timezone — must chain AT TIME ZONE twice:
SELECT SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time'
-- 2026-03-10 11:30:00.000 -04:00 (UTC → New York)
-- NOTE: First: tag the value as UTC (DATETIME2 has no timezone info)
--       Second: convert to the target timezone

SELECT SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'Tokyo Standard Time'
-- 2026-03-11 00:30:00.000 +09:00 (note: date changes!)

-- List all timezone names SQL Server knows
SELECT * FROM sys.time_zone_info ORDER BY name
-- Shows: name, current_utc_offset, is_currently_dst

-- Pipeline pattern: store in UTC, display in local at query time
SELECT
    trade_date,
    created_at_utc,
    created_at_utc AT TIME ZONE 'UTC' AT TIME ZONE 'Central European Standard Time' AS created_at_cet
FROM gold.scores_daily
```

---

## Practical Pipeline Date Patterns

Common date calculations used in financial data pipelines — yesterday's date, start/end of current month, business day detection, quarter labels.

#### DATEADD, DATEDIFF, EOMONTH, DATEFROMPARTS — pipeline date patterns

```sql
-- Yesterday's date (for pipeline "load yesterday's data")
SELECT CAST(DATEADD(DAY, -1, SYSUTCDATETIME()) AS DATE) AS yesterday

-- Rolling 30-day window
SELECT * FROM gold.scores_daily
WHERE trade_date >= DATEADD(DAY, -30, CAST(SYSUTCDATETIME() AS DATE))

-- Get all trading days in a range (exclude weekends)
SELECT trade_date
FROM bronze.trading_calendar
WHERE trade_date BETWEEN '2026-01-01' AND '2026-03-10'
  AND DATEPART(WEEKDAY, trade_date) NOT IN (1, 7)    -- 1=Sunday, 7=Saturday (with default @@DATEFIRST=7)

-- Group by month using DATETRUNC (SQL Server 2022+)
SELECT
    DATETRUNC(MONTH, trade_date) AS month,
    COUNT(*) AS records
FROM gold.scores_daily
GROUP BY DATETRUNC(MONTH, trade_date)
ORDER BY month

-- Quarter label
SELECT
    CONCAT('Q', DATEPART(QUARTER, trade_date), ' ', YEAR(trade_date)) AS quarter,
    COUNT(*)
FROM gold.scores_daily
GROUP BY DATEPART(QUARTER, trade_date), YEAR(trade_date)
-- Q1 2026, Q2 2026, etc.
```

---

## Python Date and Time Reference

Cross-language reference for the same date operations in Python. Included because pipeline code frequently bridges T-SQL and Python — knowing both prevents conversion bugs at the boundary.

For the full Python datetime reference including `relativedelta`, `ZoneInfo`, and pandas date ranges, see [11_py_datetimemathutils](https://alp78.github.io/elysium/02-Programming-Languages/Python/11_py_datetimemathutils). The C# equivalents (`DateTimeOffset`, `DateOnly`, `TimeZoneInfo`) are covered in [11_cs_datetimemathutils](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/11_cs_datetimemathutils).

Python has two kinds of datetimes — this distinction matters enormously in pipelines:

- **Naive** (`datetime(2026, 3, 10, 15, 30)`) — no timezone information. Comparing two naive datetimes from different timezones gives wrong results silently.
- **Aware** (`datetime(2026, 3, 10, 15, 30, tzinfo=timezone.utc)`) — has timezone. Comparisons, arithmetic, and conversions are correct.

> [!warning] Never Create Naive Datetimes
>
> Never Create Naive Datetimes in Pipeline Code. Always pass `tzinfo=`. If a library returns a naive datetime, immediately tag it:
> ```python
> naive_from_api = datetime.fromisoformat("2026-03-10T15:30:00")
> aware = naive_from_api.replace(tzinfo=timezone.utc)  # because you KNOW the API returns UTC
> ```

> [!success] Safe Pattern
>
> Always construct datetimes with `datetime.now(timezone.utc)` or pass `tzinfo=timezone.utc` explicitly. When receiving a naive datetime from a third-party library, immediately call `.replace(tzinfo=timezone.utc)` before any arithmetic or comparison.

#### Python datetime.now, datetime.utcnow — current date/time

```python
from datetime import datetime, date, time, timedelta, timezone
from zoneinfo import ZoneInfo   # Python 3.9+ (replaces pytz)

datetime.now()                          # 2026-03-10 16:30:00.123456 (local, NAIVE — no timezone!)
datetime.now(timezone.utc)              # 2026-03-10 15:30:00.123456+00:00 (UTC, AWARE)
datetime.utcnow()                       # DO NOT USE — returns naive UTC (deprecated in 3.12)
date.today()                            # 2026-03-10 (date only)
datetime.now().timestamp()              # 1773422200.123456 (Unix epoch as float)
```

> [!danger] Always Use Timezone-Aware Datetimes in Pipelines
>
> `datetime.now()` returns a naive datetime with no timezone — is it UTC? Local? Impossible to tell downstream. Always use `datetime.now(timezone.utc)` instead. A single naive datetime leaking into a pipeline can silently shift every timestamp by your server's UTC offset.

> [!success] Safe Pattern
>
> Replace every `datetime.now()` with `datetime.now(timezone.utc)` and every `datetime.utcnow()` (deprecated in Python 3.12) with the same. Enforce this with a linting rule: `pylint --disable=W0611` or a `ruff` rule flagging `datetime.now()` calls without `tz=`.

```python
# Correct — timezone-aware:
now = datetime.now(timezone.utc)

# Wrong — naive, ambiguous:
now = datetime.now()
```

#### Python datetime.strptime — parsing date strings

```python
# strptime (string parse time) — explicit format
datetime.strptime("2026-03-10", "%Y-%m-%d")                  # datetime(2026, 3, 10)
datetime.strptime("2026-03-10T15:30:00", "%Y-%m-%dT%H:%M:%S")
datetime.strptime("10/03/2026", "%d/%m/%Y")                  # European format
datetime.strptime("Mar 10, 2026 3:30 PM", "%b %d, %Y %I:%M %p")

# fromisoformat (Python 3.7+ — fastest for ISO strings)
datetime.fromisoformat("2026-03-10")                          # naive
datetime.fromisoformat("2026-03-10T15:30:00+01:00")           # aware
datetime.fromisoformat("2026-03-10T15:30:00Z")                # aware, UTC (Python 3.11+)

# From Unix epoch — always pass tz= to fromtimestamp
datetime.fromtimestamp(1773422200, tz=timezone.utc)            # 2026-03-10 15:30:00+00:00
```

#### Python timedelta, relativedelta — date arithmetic

```python
d = date(2026, 3, 10)
dt = datetime(2026, 3, 10, 15, 30, tzinfo=timezone.utc)

d + timedelta(days=7)                              # date(2026, 3, 17)
d - timedelta(days=30)                             # date(2026, 2, 8)
dt + timedelta(hours=5)                            # 2026-03-10 20:30:00+00:00
dt - timedelta(minutes=90)                         # 2026-03-10 14:00:00+00:00
dt + timedelta(weeks=2)                            # 2026-03-24 15:30:00+00:00

# Difference between dates
(date(2026, 3, 10) - date(2026, 1, 1)).days        # 68
diff = datetime(2026, 3, 10) - datetime(2026, 3, 1)
diff.days                                            # 9
diff.total_seconds()                                 # 777600.0

# Add months/years (timedelta doesn't support months — use dateutil)
from dateutil.relativedelta import relativedelta
d + relativedelta(months=3)                         # date(2026, 6, 10)
d + relativedelta(years=1)                          # date(2027, 3, 10)
# dateutil handles month-end correctly:
date(2026, 1, 31) + relativedelta(months=1)         # date(2026, 2, 28) (not Feb 31!)
```

#### Python zoneinfo.ZoneInfo, astimezone — timezone conversion

```python
paris = ZoneInfo("Europe/Paris")
ny = ZoneInfo("America/New_York")
tokyo = ZoneInfo("Asia/Tokyo")

dt_utc = datetime(2026, 3, 10, 15, 30, tzinfo=timezone.utc)
dt_utc.astimezone(paris)    # 2026-03-10 16:30:00+01:00
dt_utc.astimezone(ny)       # 2026-03-10 11:30:00-04:00 (EDT after DST)
dt_utc.astimezone(tokyo)    # 2026-03-11 00:30:00+09:00 (next day!)
```

#### Python pipeline date patterns — trading calendar, business days, batch windows

```python
# Yesterday's date
yesterday = date.today() - timedelta(days=1)

# Start/end of month
from calendar import monthrange
first_of_month = date.today().replace(day=1)
_, last_day = monthrange(2026, 3)
end_of_month = date(2026, 3, last_day)     # date(2026, 3, 31)

# Last business day (skip weekends)
d = date.today()
while d.weekday() >= 5:   # 5=Saturday, 6=Sunday
    d -= timedelta(days=1)

# Generate date range
def date_range(start, end):
    """Yield dates from start to end inclusive."""
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)

for d in date_range(date(2026, 3, 1), date(2026, 3, 10)):
    print(d.isoformat())

# Pandas date range (more powerful)
import pandas as pd
pd.date_range("2026-03-01", "2026-03-10", freq="B")   # Business days only
pd.date_range("2026-01-01", periods=12, freq="MS")     # Monthly start dates
pd.date_range("2026-01-01", periods=4, freq="QS")      # Quarterly start dates
```

---

## C# Date and Time Reference

Same cross-language reference for C#. DateTime in C# maps to DATETIME2 in SQL Server; DateTimeOffset maps to DATETIMEOFFSET.

```csharp
using System;
using System.Globalization;

// Current date/time
DateTime.Now                    // 2026-03-10 16:30:00 (local)
DateTime.UtcNow                 // 2026-03-10 15:30:00 (UTC)
DateTimeOffset.Now              // 2026-03-10 16:30:00 +01:00 (local with offset)
DateTimeOffset.UtcNow           // 2026-03-10 15:30:00 +00:00 (UTC with offset)
DateOnly.FromDateTime(DateTime.Now)    // 2026-03-10 (.NET 6+)
TimeOnly.FromDateTime(DateTime.Now)    // 16:30:00 (.NET 6+)
```

> [!danger] Avoid DateTime in C# — Use DateTimeOffset
>
> `DateTime` has a broken `Kind` system (Local/Utc/Unspecified) that silently loses timezone information during serialization, database round-trips, and JSON conversion. Use `DateTimeOffset` for timestamps (preserves timezone) and `DateOnly` for trade dates (.NET 6+).

> [!success] Safe Pattern
>
> Declare all timestamp properties as `DateTimeOffset` and all calendar-date properties as `DateOnly` (.NET 6+). Map them to `DATETIMEOFFSET` and `DATE` columns respectively in SQL Server. This eliminates the `Kind` ambiguity and rounds trips cleanly through Dapper and System.Text.Json.

#### C# DateTime.ParseExact, ToString — parsing and formatting

```csharp
// Parse ISO automatically
DateTime.Parse("2026-03-10")                                                       // 2026-03-10
DateTimeOffset.Parse("2026-03-10T15:30:00+01:00")                                  // preserves offset
DateOnly.Parse("2026-03-10")                                                       // .NET 6+

// Parse with exact format
DateTime.ParseExact("10/03/2026", "dd/MM/yyyy", CultureInfo.InvariantCulture)

// TryParse (safe — no exception on invalid input)
if (DateTime.TryParse(userInput, out var parsed))
    Console.WriteLine(parsed);
else
    Console.WriteLine("Invalid date");

// Formatting
var dt = new DateTimeOffset(2026, 3, 10, 15, 30, 0, TimeSpan.FromHours(1));
dt.ToString("yyyy-MM-dd")                         // 2026-03-10
dt.ToString("yyyy-MM-ddTHH:mm:ssK")               // 2026-03-10T15:30:00+01:00
dt.ToString("o")                                   // 2026-03-10T15:30:00.0000000+01:00 (round-trip)
dt.ToString("s")                                   // 2026-03-10T15:30:00 (sortable)
dt.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ssZ")    // 2026-03-10T14:30:00Z
```

#### C# TimeZoneInfo.ConvertTime — timezone conversion

```csharp
var utcNow = DateTimeOffset.UtcNow;

var paris = TimeZoneInfo.FindSystemTimeZoneById("Central European Standard Time");
var ny = TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time");
var tokyo = TimeZoneInfo.FindSystemTimeZoneById("Tokyo Standard Time");

TimeZoneInfo.ConvertTime(utcNow, paris)     // +01:00 (or +02:00 during CEST)
TimeZoneInfo.ConvertTime(utcNow, ny)        // -05:00 (or -04:00 during EDT)
TimeZoneInfo.ConvertTime(utcNow, tokyo)     // +09:00 (no DST in Japan)

```

> [!warning] Windows vs IANA Timezone IDs in .NET
>
> Windows uses `"Central European Standard Time"` while Linux uses `"Europe/Paris"`. Code that hardcodes one format fails on the other OS. In .NET 6+, both formats are accepted — .NET auto-maps between them. For earlier versions, use the `TimeZoneConverter` NuGet package.

> [!success] Safe Pattern
>
> Target .NET 6+ and use IANA IDs (`"Europe/Paris"`) throughout — they work on both Windows and Linux. If targeting earlier .NET, add the `TimeZoneConverter` NuGet package and call `TZConvert.GetTimeZoneInfo("Europe/Paris")` instead of `TimeZoneInfo.FindSystemTimeZoneById`.

> [!warning] DateTime vs DateTimeOffset in C#
>
> `DateTime` has a `Kind` property (Local, Utc, Unspecified) that is not part of the value — it's metadata that gets silently lost during serialization, database round-trips, and JSON conversion. This causes bugs that are nearly impossible to track down. `DateTimeOffset` embeds the UTC offset directly in the value. It round-trips correctly through SQL Server (`DATETIMEOFFSET`), JSON, and API responses. Use `DateTimeOffset` for all timestamps in your code.
>
> `DateOnly` (.NET 6+) is perfect for trade dates — it cannot accidentally have a time component, eliminating an entire class of off-by-one bugs at day boundaries.

> [!success] Safe Pattern
>
> Use `DateTimeOffset` for all timestamps and `DateOnly` for all trade/reference dates in .NET code. Configure Dapper to map `DateTimeOffset` → `DATETIMEOFFSET` and `DateOnly` → `DATE` without manual conversion. Enable `JsonSerializerOptions` to serialize `DateTimeOffset` as ISO 8601 with offset (`"O"` format) to preserve timezone through API responses.

---

## DST Pitfalls That Break Pipelines

Daylight Saving Time is the single biggest source of date/time bugs in data engineering:

> [!danger] DST Shifts Pipeline Execution Time
>
> A pipeline scheduled at "09:00 CET" runs at 08:00 UTC in winter but 07:00 UTC in summer (when CET becomes CEST). If it depends on data arriving at 08:00 UTC, it breaks after the spring DST transition because the data is not there yet. **Fix:** Schedule in UTC — "08:00 UTC" is always 08:00 UTC regardless of DST.

> [!success] Safe Pattern
>
> Define all Airflow DAGs, cron schedules, and Cloud Scheduler jobs in UTC. Replace `"09:00 CET"` with the equivalent fixed UTC time. The UTC time is stable year-round; CET/CEST offsets shift twice per year.

> [!danger] DST Makes Days Shorter or Longer Than 24 Hours
>
> On DST spring-forward day (March 29, 2026 in Europe), 2:00 AM jumps to 3:00 AM — the day has only 23 hours. A rolling window of "24 hours ago" goes back to yesterday minus 1 hour, not midnight. **Fix:** Use calendar days (`date - 1 day`), not hours (`datetime - 24 hours`).

> [!success] Safe Pattern
>
> Use `DATEADD(DAY, -1, CAST(SYSUTCDATETIME() AS DATE))` in SQL or `date.today() - timedelta(days=1)` in Python for "yesterday". Never compute a 24-hour window with `DATEADD(HOUR, -24, ...)` — use calendar-day subtraction instead.

> [!danger] DST Fall-Back Creates Duplicate Timestamps
>
> On DST fall-back day (October 25, 2026 in Europe), 3:00 AM reverts to 2:00 AM. The hour 2:00-3:00 occurs TWICE — two different records can have the same local timestamp, breaking deduplication. **Fix:** Store UTC timestamps. 2:00 AM CEST (UTC+2) and 2:00 AM CET (UTC+1) are different UTC instants.

> [!success] Safe Pattern
>
> Store all timestamps in UTC (`DATETIMEOFFSET` or `DATETIME2` with UTC values). Convert to local time only at the presentation layer using `AT TIME ZONE` in SQL or `astimezone()` in Python. UTC timestamps are always unique — no fall-back ambiguity.

> [!danger] DST Transition Dates Differ Across Regions
>
> US (second Sunday in March), Europe (last Sunday in March), and Japan/China (no DST ever) change on different dates. For 2-3 weeks per year, the UTC offset between NYC and Paris changes. A pipeline that assumes "Paris is always 6 hours ahead of NYC" breaks silently. **Fix:** Always convert through UTC. Never hardcode offsets between non-UTC timezones.

> [!success] Safe Pattern
>
> Always chain conversions through UTC: local A → UTC → local B. Use timezone names (`"Europe/Paris"`, `"America/New_York"`) rather than hardcoded numeric offsets. SQL Server's `AT TIME ZONE` and Python's `ZoneInfo` both handle DST transitions automatically when timezone names are used.

#### DST rules — store UTC, convert at display, never schedule at 2 AM

| Rule | Explanation |
|------|-------------|
| Store in UTC | All internal timestamps, database columns, log entries |
| Schedule in UTC | Cron jobs, Airflow DAGs, Cloud Scheduler |
| Display in local | Dashboard tooltips, user-facing reports, emails |
| Use `DATE` not `DATETIME` for calendar dates | Trade dates, report dates — no time component = no DST bugs |
| Never hardcode UTC offsets | Use timezone names ("Europe/Paris"), not numbers (+01:00) |
| Use `DATETIMEOFFSET` / `DateTimeOffset` | SQL Server and C# — preserves the offset through round-trips |
| Test on DST boundary dates | March and October — the two times per year your pipeline will break |

---

### Linux Terminal Date Reference

Shell date commands for pipeline scripts that run on Linux. Pipelines often use bash date calculations for file naming, log rotation, and cron scheduling.

```bash
# Current date/time in various formats
date                                # Tue Mar 10 16:30:00 CET 2026 (system locale)
date -u                             # Tue Mar 10 15:30:00 UTC 2026 (UTC)
date +%Y-%m-%d                      # 2026-03-10 (ISO date)
date +%Y-%m-%dT%H:%M:%S%z          # 2026-03-10T16:30:00+0100 (ISO with offset)
date +%Y-%m-%dT%H:%M:%SZ -u        # 2026-03-10T15:30:00Z (ISO UTC)
date +%s                            # 1773422200 (Unix epoch)
date +%Y%m%d                        # 20260310 (compact — for file names)
date +%Y%m%d_%H%M%S                 # 20260310_163000 (compact with time — for backup names)

# Date arithmetic
date -d "2026-03-10 + 7 days" +%Y-%m-%d          # 2026-03-17
date -d "2026-03-10 - 30 days" +%Y-%m-%d          # 2026-02-08
date -d "2026-03-10 + 3 months" +%Y-%m-%d          # 2026-06-10

# Timezone conversion
TZ=America/New_York date -d "2026-03-10T15:30:00 UTC" +%Y-%m-%dT%H:%M:%S\ %Z
# 2026-03-10T11:30:00 EDT (UTC → New York — note EDT not EST after DST switch)
TZ=Asia/Tokyo date -d "2026-03-10T15:30:00 UTC" +%Y-%m-%dT%H:%M:%S\ %Z
# 2026-03-11T00:30:00 JST (UTC → Tokyo — note date changes!)

# System timezone management
timedatectl                         # Show current timezone and NTP sync status
sudo timedatectl set-timezone UTC    # Set system timezone to UTC (recommended for servers)

# Use case: generate filenames with dates
BACKUP_FILE="project_backup_$(date +%Y%m%d_%H%M%S).bak"
# Result: project_backup_20260310_163000.bak
```

> [!tip] Always Set Servers to UTC
>
> Every server in your infrastructure should run on UTC:
> ```bash
> sudo timedatectl set-timezone UTC
> ```
> UTC never changes — no DST surprises. `GETUTCDATE()` and `GETDATE()` become equivalent when the server is UTC, reducing confusion. Logs from multiple servers are comparable without offset adjustment.

---

### Related

- [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/sargable-queries) — date predicates on indexed columns: never wrap in CONVERT/CAST in WHERE clauses
- [merge-and-upsert](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/merge-and-upsert) — transaction patterns that use date range filtering for incremental loads
- [gold-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/gold-transforms) — SMA calculations using date-ordered window functions and `trade_date` ranges
- [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/silver-transforms) — SCD Type 2 effective date handling (`effective_from`, `effective_to`)
- [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/bronze-layer-loading) — `loaded_at` timestamps and idempotent reload by date range
- [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/Performance/performance-audit-playbook) — statistics staleness queries that filter by date
