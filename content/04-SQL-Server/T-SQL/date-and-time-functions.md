---
type: concept
category: sql-server
technology: [sql-server, python, csharp]
tags: [python, csharp, sql, sql-server, tsql]
aliases: [SQL Server date functions, datetime types, DATETIMEOFFSET, DATETIME2, DATEADD, DATEDIFF, EOMONTH, DATETRUNC, AT TIME ZONE, ISO 8601, date arithmetic]
keywords: [date, datetime, DATETIME2, DATETIMEOFFSET, DATE, SMALLDATETIME, DATEADD, DATEDIFF, DATEDIFF_BIG, EOMONTH, DATETRUNC, DATEFROMPARTS, DATETIME2FROMPARTS, FORMAT, CONVERT, GETDATE, GETUTCDATE, SYSUTCDATETIME, SYSDATETIMEOFFSET, ISO 8601, UTC, timezone, AT TIME ZONE, DST daylight saving, trade_date, naive datetime, aware datetime, dateutil, relativedelta, ZoneInfo, DateTimeOffset, DateOnly, pipeline date patterns]
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

```
Format                          Example                          Name
─────────────────────────────── ──────────────────────────────── ─────────────
YYYY-MM-DD                      2026-03-10                       Date only
YYYY-MM-DDThh:mm:ss             2026-03-10T15:30:00              Local datetime (no timezone!)
YYYY-MM-DDThh:mm:ssZ            2026-03-10T15:30:00Z             UTC (Z = "Zulu" = UTC+0)
YYYY-MM-DDThh:mm:ss±hh:mm      2026-03-10T15:30:00+01:00        With UTC offset
YYYY-MM-DDThh:mm:ss.ffffff      2026-03-10T15:30:00.123456       With microseconds
YYYY-MM-DDThh:mm:ss.ffffffZ    2026-03-10T15:30:00.123456Z      UTC with microseconds
YYYYMMDDThhmmssZ                20260310T153000Z                 Compact (no separators)
YYYY-Www                        2026-W11                         ISO week (week 11 of 2026)
YYYY-Www-D                      2026-W11-2                       ISO week + day (Tuesday)
YYYY-DDD                        2026-069                         Ordinal date (day 69 of 2026)
```

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

```sql
-- DATE:             2026-03-10 (date only, 3 bytes, range: 0001-01-01 to 9999-12-31)
-- TIME:             15:30:00.1234567 (time only, 3-5 bytes)
-- DATETIME2:        2026-03-10 15:30:00.1234567 (date+time, 6-8 bytes, replaces DATETIME)
-- DATETIMEOFFSET:   2026-03-10 15:30:00.1234567 +01:00 (date+time+timezone, 8-10 bytes)
-- DATETIME:         2026-03-10 15:30:00.123 (legacy — 3.33ms precision, avoid in new code)
-- SMALLDATETIME:    2026-03-10 15:30:00 (legacy — minute precision only, avoid)

-- RULE: Use DATE for trade dates, DATETIME2 for timestamps, DATETIMEOFFSET for cross-timezone.
-- NEVER use DATETIME for new columns — DATETIME2 is superior in every way.
```

---

### Current Date and Time Functions

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

---

## Parsing and Formatting

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

-- Common style codes:
-- 101 = MM/DD/YYYY (US)
-- 103 = DD/MM/YYYY (British/European)
-- 104 = DD.MM.YYYY (German)
-- 112 = YYYYMMDD (compact ISO, no separators)
-- 120 = YYYY-MM-DD HH:MI:SS (ODBC canonical)
-- 126 = YYYY-MM-DDTHH:MI:SS.mmm (ISO 8601 with T)
-- 127 = YYYY-MM-DDTHH:MI:SS.mmmZ (ISO 8601 with timezone)
```

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

---

### Extracting Date Components

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

---

### Date Arithmetic

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

---

### Timezone Conversion with AT TIME ZONE

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

#### Python datetime.now, datetime.utcnow — current date/time

```python
from datetime import datetime, date, time, timedelta, timezone
from zoneinfo import ZoneInfo   # Python 3.9+ (replaces pytz)

datetime.now()                          # 2026-03-10 16:30:00.123456 (local, NAIVE — no timezone!)
datetime.now(timezone.utc)              # 2026-03-10 15:30:00.123456+00:00 (UTC, AWARE)
datetime.utcnow()                       # DO NOT USE — returns naive UTC (deprecated in 3.12)
date.today()                            # 2026-03-10 (date only)
datetime.now().timestamp()              # 1773422200.123456 (Unix epoch as float)

# CRITICAL RULE: ALWAYS use timezone-aware datetimes in pipelines.
# CORRECT:
now = datetime.now(timezone.utc)
# WRONG:
now = datetime.now()   # naive — is this UTC? Local? Who knows?
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

```csharp
using System;
using System.Globalization;

// ============================================================
// CURRENT DATE/TIME
// ============================================================

DateTime.Now                    // 2026-03-10 16:30:00 (local)
DateTime.UtcNow                 // 2026-03-10 15:30:00 (UTC)
DateTimeOffset.Now              // 2026-03-10 16:30:00 +01:00 (local with offset)
DateTimeOffset.UtcNow           // 2026-03-10 15:30:00 +00:00 (UTC with offset)
DateOnly.FromDateTime(DateTime.Now)    // 2026-03-10 (.NET 6+)
TimeOnly.FromDateTime(DateTime.Now)    // 16:30:00 (.NET 6+)

// RULE: Use DateTimeOffset for timestamps (preserves timezone).
// Use DateOnly for trade dates (.NET 6+).
// Avoid DateTime — it has a broken Kind system (Local/Utc/Unspecified).
```

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

// GOTCHA: Windows and Linux use DIFFERENT timezone ID strings!
// Windows: "Central European Standard Time"
// Linux:   "Europe/Paris"
// Cross-platform fix (.NET 6+): both work — .NET auto-maps between them
```

> [!warning] DateTime vs DateTimeOffset in C#
>
> `DateTime` has a `Kind` property (Local, Utc, Unspecified) that is not part of the value — it's metadata that gets silently lost during serialization, database round-trips, and JSON conversion. This causes bugs that are nearly impossible to track down. `DateTimeOffset` embeds the UTC offset directly in the value. It round-trips correctly through SQL Server (`DATETIMEOFFSET`), JSON, and API responses. Use `DateTimeOffset` for all timestamps in your code.
>
> `DateOnly` (.NET 6+) is perfect for trade dates — it cannot accidentally have a time component, eliminating an entire class of off-by-one bugs at day boundaries.

---

## DST Pitfalls That Break Pipelines

Daylight Saving Time is the single biggest source of date/time bugs in data engineering:

```
Problem: Your pipeline runs at "09:00 CET" every day.
On the last Sunday of March, CET becomes CEST.
- Before DST: 09:00 CET = 08:00 UTC
- After DST:  09:00 CEST = 07:00 UTC
Your pipeline now runs 1 hour earlier in UTC. If it depends on data that arrives at 08:00 UTC,
it breaks because the data isn't there yet.
Fix: Schedule in UTC. "08:00 UTC" is always 08:00 UTC, regardless of DST.

Problem: Your pipeline calculates "24 hours ago" for a rolling window.
On DST spring-forward day (March 29, 2026 in Europe), 2:00 AM → 3:00 AM.
The day has only 23 hours. "24 hours ago" actually goes back to yesterday minus 1 hour.
Fix: Use calendar days (date - 1 day), not hours (datetime - 24 hours).

Problem: Your pipeline deduplicates by timestamp.
On DST fall-back day (October 25, 2026 in Europe), 3:00 AM → 2:00 AM.
The hour 2:00-3:00 occurs TWICE. Two different records with the same local timestamp.
Fix: Store UTC timestamps. 2:00 AM CEST (UTC+2) and 2:00 AM CET (UTC+1) are different UTC times.

Problem: US, Europe, and Asia change DST on DIFFERENT dates.
- US: Second Sunday in March / First Sunday in November
- Europe: Last Sunday in March / Last Sunday in October
- Japan/China: No DST ever
For 2-3 weeks per year, the UTC offset between NYC and Paris changes.
Your cross-market pipeline that assumes "Paris is always 6 hours ahead of NYC" breaks.
Fix: Always convert through UTC. Never hardcode offsets between non-UTC timezones.
```

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
