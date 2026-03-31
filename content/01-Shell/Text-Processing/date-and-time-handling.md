---
type: concept
category: data-engineering
technology: [python, sql-server, csharp, bash, powershell]
tags: [shell, python, csharp, bash, linux, powershell, sql-server]
aliases: [datetime handling, ISO 8601, timezone management, date arithmetic, DST pitfalls, naive vs aware datetime, DATETIMEOFFSET, DateTimeOffset, UTC storage, date parsing, date formatting]
keywords: [iso 8601, datetime, date, timezone, utc, dst, daylight saving, GETUTCDATE, SYSUTCDATETIME, DATETIMEOFFSET, DATETIME2, DateTimeOffset, DateOnly, zoneinfo, pytz, timedelta, relativedelta, dateutil, strptime, strftime, fromisoformat, date arithmetic, date parsing, date formatting, unix epoch, unix timestamp, pandas date_range, timedatectl, Get-Date, DATEADD, DATEDIFF, DATETRUNC, EOMONTH, AT TIME ZONE]
description: "Comprehensive reference for date and time handling across all pipeline contexts — ISO 8601 formats, timezone management, UTC storage, DST pitfalls, and date arithmetic in Bash, PowerShell, SQL Server T-SQL, Python, and C#."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Date and Time Handling

> [!quote]
> "Time is an illusion. Lunchtime doubly so."
> — **Douglas Adams**, *The Hitchhiker's Guide to the Galaxy* (1979)

Dates look simple until you realize that "March 10, 2026 at 3 PM" means a different instant in time depending on whether you're in Paris, New York, or Tokyo. A pipeline that processes market close times across Euro market index, the data pipeline project USA 50, and the data pipeline project Asia/Pacific 50 must handle three different closing times, daylight saving transitions that happen on different dates in different countries, and the fact that "today" is a different date in Sydney and New York for several hours each day.

This note covers dates exhaustively: ISO format variants, timezone management, parsing, formatting, arithmetic -- in the terminal (Linux/PowerShell), then SQL Server, Python, and C#. For the Python and C# datetime libraries in more depth, see [11_py_datetimemathutils](https://alp78.github.io/elysium/02-Programming-Languages/Python/11_py_datetimemathutils) and [11_cs_datetimemathutils](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/11_cs_datetimemathutils).

### ISO 8601 — the only date format you should use in pipelines

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

> [!warning] Date format rules for pipelines
>
> 1. **Store dates as `DATE` or `DATETIME2` in SQL Server, never as strings.** String dates cannot be indexed efficiently, cannot be compared with `<`/`>`, and break when formats change.
> 2. **If you must store as string, use ISO 8601 (`YYYY-MM-DD`).** It sorts correctly as text: `"2026-03-10" < "2026-03-11"` works. American `MM/DD/YYYY` does not: `"03/10/2026" < "12/01/2025"` gives the wrong answer.
> 3. **Always store timestamps in UTC.** Convert to local time only at the presentation layer (dashboard, reports). Your SQL Server, pipeline, and API should never deal with local time.
> 4. **Use `DATETIMEOFFSET` in SQL Server for timestamps that cross timezones.** `DATETIME2` loses the timezone — you can't tell if `2026-03-10 15:30:00` is Paris time or New York time.
> 5. **`trade_date` columns should be `DATE`, not `DATETIME`.** A trade date is a calendar date, not a moment in time. Adding time precision to a date-only concept invites bugs (midnight vs 23:59:59, off-by-one errors at day boundaries).

### Date format selection — which format for which context

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

---

## Terminal — Linux (Bash)

#### date +%Y-%m-%d — current date/time in various formats
```bash
# Current date/time in various formats
date                                # Tue Mar 10 16:30:00 CET 2026 (system locale)
date -u                             # Tue Mar 10 15:30:00 UTC 2026 (UTC)
date +%Y-%m-%d                      # 2026-03-10 (ISO date)
date +%Y-%m-%dT%H:%M:%S%z          # 2026-03-10T16:30:00+0100 (ISO with offset)
date +%Y-%m-%dT%H:%M:%SZ -u        # 2026-03-10T15:30:00Z (ISO UTC)
date +%s                            # 1773422200 (Unix epoch — seconds since 1970-01-01T00:00:00Z)
date +%Y%m%d                        # 20260310 (compact — for file names)
date +%Y%m%d_%H%M%S                 # 20260310_163000 (compact with time — for backup names)
```

> [!info] Format specifiers
>
> **Date:**
> - `%Y` — 4-digit year (2026) | `%y` — 2-digit year (26)
> - `%m` — month 01-12 | `%b` — abbreviated (Mar) | `%B` — full (March)
> - `%d` — day 01-31 | `%e` — day 1-31 (space-padded)
>
> **Time:**
> - `%H` — hour 00-23 (24h) | `%I` — hour 01-12 (12h) | `%p` — AM/PM
> - `%M` — minute 00-59 | `%S` — second 00-59
> - `%N` — nanoseconds | `%3N` — milliseconds | `%6N` — microseconds
>
> **Timezone and epoch:**
> - `%z` — timezone offset (+0100) | `%Z` — timezone name (CET)
> - `%s` — Unix epoch seconds
>
> **Calendar:**
> - `%j` — day of year (001-366) | `%u` — day of week 1-7 (Mon=1) | `%A` — full weekday (Tuesday)

#### date -d "string" — parse a date string and reformat
```bash
# Parse a date string and reformat
date -d "2026-03-10" +%A
# Tuesday
# -d = parse this string as a date (GNU date only — not macOS)

date -d "2026-03-10T15:30:00Z" +%s
# 1773422200 (convert ISO to Unix epoch)

date -d "@1773422200" +%Y-%m-%dT%H:%M:%SZ
# 2026-03-10T15:30:00Z (convert epoch back to ISO)
```

#### date -d "+N days" — date arithmetic in Bash
```bash
# Date arithmetic
date -d "2026-03-10 + 7 days" +%Y-%m-%d          # 2026-03-17
date -d "2026-03-10 - 30 days" +%Y-%m-%d          # 2026-02-08
date -d "2026-03-10 + 3 months" +%Y-%m-%d          # 2026-06-10
date -d "2026-03-10 + 1 year" +%Y-%m-%d            # 2027-03-10
date -d "2026-03-10 15:30 + 5 hours" +%H:%M        # 20:30
date -d "2026-03-10 15:30 - 90 minutes" +%H:%M     # 14:00

# Business day calculation (skip weekends) — GNU date doesn't have built-in support
# Common workaround:
date -d "2026-03-10 + 1 day" +%u    # 2 (Tuesday — weekday)
date -d "2026-03-13 + 1 day" +%u    # 6 (Saturday — skip!)
# For robust business day logic, use Python or SQL

# Get the start/end of a period
date -d "2026-03-10" +%Y-%m-01                     # 2026-03-01 (first of month)
date -d "2026-04-01 - 1 day" +%Y-%m-%d             # 2026-03-31 (last of month)
date -d "2026-01-01" +%Y-01-01                     # 2026-01-01 (first of year)
```

#### TZ=zone date — timezone conversion in Bash
```bash
# Timezone conversion
TZ=America/New_York date -d "2026-03-10T15:30:00 UTC" +%Y-%m-%dT%H:%M:%S\ %Z
# 2026-03-10T11:30:00 EDT (UTC → New York — note EDT not EST after DST switch)
TZ=Asia/Tokyo date -d "2026-03-10T15:30:00 UTC" +%Y-%m-%dT%H:%M:%S\ %Z
# 2026-03-11T00:30:00 JST (UTC → Tokyo — note date changes!)

# System timezone management
timedatectl                         # Show current timezone and NTP sync status
timedatectl list-timezones           # List all available timezone names
sudo timedatectl set-timezone UTC    # Set system timezone to UTC (recommended for servers)

# Use case: generate filenames with dates
BACKUP_FILE="project_backup_$(date +%Y%m%d_%H%M%S).bak"
# Result: project_backup_20260310_163000.bak

# Use case: find files modified in the last 24 hours
find /data -type f -mtime -1
# -mtime -1 = modified less than 1 day ago
```

> [!warning] Always set servers to UTC
>
> Every server in your infrastructure should run on UTC:
> ```bash
> sudo timedatectl set-timezone UTC
> ```
> Why?
> - **No DST surprises.** UTC never changes. CET becomes CEST in March, EST becomes EDT — your cron jobs shift by an hour, your log timestamps jump, and your pipeline that runs "at 9 AM" suddenly runs at 8 AM or 10 AM.
> - **Consistent logs.** When correlating logs across servers in different regions, UTC makes `grep` work: `grep "2026-03-10T15:" *.log`
> - **SQL Server consistency.** `GETUTCDATE()` always returns UTC regardless of server timezone, but `GETDATE()` returns server-local time. If the server is UTC, they're the same.

---

## Terminal — PowerShell

#### Get-Date — current date/time in PowerShell
```powershell
# Current date/time
Get-Date                                                    # 10 March 2026 16:30:00 (locale)
Get-Date -Format "yyyy-MM-dd"                               # 2026-03-10
Get-Date -Format "yyyy-MM-ddTHH:mm:ssK"                     # 2026-03-10T16:30:00+01:00
Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ" -AsUTC              # 2026-03-10T15:30:00Z (PS 7+)
[DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")   # 2026-03-10T15:30:00Z (any PS)
Get-Date -UFormat "%s"                                       # 1773422200 (Unix epoch)
Get-Date -Format "yyyyMMdd_HHmmss"                           # 20260310_163000
```

> [!info] PowerShell format specifiers (.NET format strings)
>
> - `yyyy` — 4-digit year | `yy` — 2-digit year
> - `MM` — month 01-12 | `MMM` — abbreviated (Mar) | `MMMM` — full (March)
> - `dd` — day 01-31 | `ddd` — abbreviated day (Tue) | `dddd` — full (Tuesday)
> - `HH` — hour 00-23 (24h) | `hh` — hour 01-12 (12h) | `tt` — AM/PM
> - `mm` — minute 00-59 | `ss` — second 00-59
> - `fff` — milliseconds | `ffffff` — microseconds
> - `K` — timezone offset (+01:00)

> [!warning] MM vs mm case sensitivity
>
> `MM` = month, `mm` = minute. Case matters in .NET format strings.

#### [datetime]::ParseExact — parsing date strings in PowerShell
```powershell
# Parse a date string
[DateTime]::ParseExact("2026-03-10", "yyyy-MM-dd", $null)
[DateTimeOffset]::Parse("2026-03-10T15:30:00+01:00")
Get-Date "2026-03-10"                                        # Parses ISO automatically
```

#### (Get-Date).AddDays — date arithmetic in PowerShell
```powershell
# Date arithmetic
(Get-Date "2026-03-10").AddDays(7)                           # 2026-03-17
(Get-Date "2026-03-10").AddDays(-30)                         # 2026-02-08
(Get-Date "2026-03-10").AddMonths(3)                         # 2026-06-10
(Get-Date "2026-03-10").AddHours(5)                          # 2026-03-10 21:30:00
(Get-Date "2026-03-10").AddMinutes(-90)                      # 2026-03-09 22:30:00
(Get-Date "2026-03-10").AddYears(1)                          # 2027-03-10

# Difference between two dates
$start = Get-Date "2026-01-01"
$end = Get-Date "2026-03-10"
($end - $start).Days                                         # 68
($end - $start).TotalHours                                   # 1632
```

#### [TimeZoneInfo]::ConvertTime — timezone conversion in PowerShell
```powershell
# Timezone conversion
[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId(
    [DateTime]::Parse("2026-03-10T15:30:00"),
    "UTC",
    "Eastern Standard Time"
)
# 2026-03-10 11:30:00 (UTC → New York)

# List available timezone IDs
[TimeZoneInfo]::GetSystemTimeZones() | Select-Object Id, DisplayName | Where-Object Id -match "Europe|America|Asia"
```

#### .Year, .Month, .DayOfWeek — extracting date components in PowerShell
```powershell
# Get components
$d = Get-Date "2026-03-10T15:30:45"
$d.Year         # 2026
$d.Month        # 3
$d.Day          # 10
$d.DayOfWeek    # Tuesday
$d.DayOfYear    # 69
$d.Hour         # 15
$d.Minute       # 30
$d.Second       # 45

# Use case: backup filename
$BackupFile = "project_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').bak"
```

---

## SQL Server (T-SQL)

### Current Date/Time Functions

```sql
-- ============================================================
-- CURRENT DATE/TIME
-- ============================================================

SELECT GETDATE()              -- 2026-03-10 16:30:00.123 (server-local, DATETIME)
SELECT GETUTCDATE()           -- 2026-03-10 15:30:00.123 (UTC, DATETIME)
SELECT SYSDATETIME()          -- 2026-03-10 16:30:00.1234567 (server-local, DATETIME2 — more precision)
SELECT SYSUTCDATETIME()       -- 2026-03-10 15:30:00.1234567 (UTC, DATETIME2)
SELECT SYSDATETIMEOFFSET()    -- 2026-03-10 16:30:00.1234567 +01:00 (with offset, DATETIMEOFFSET)
-- RULE: Use SYSUTCDATETIME() for timestamps in pipelines. Never GETDATE().
```

### SQL Server Date Data Types

```sql
-- ============================================================
-- DATA TYPES
-- ============================================================

-- DATE:             2026-03-10 (date only, 3 bytes, range: 0001-01-01 to 9999-12-31)
-- TIME:             15:30:00.1234567 (time only, 3-5 bytes)
-- DATETIME2:        2026-03-10 15:30:00.1234567 (date+time, 6-8 bytes, replaces DATETIME)
-- DATETIMEOFFSET:   2026-03-10 15:30:00.1234567 +01:00 (date+time+timezone, 8-10 bytes)
-- DATETIME:         2026-03-10 15:30:00.123 (legacy — 3.33ms precision, avoid in new code)
-- SMALLDATETIME:    2026-03-10 15:30:00 (legacy — minute precision only, avoid)

-- RULE: Use DATE for trade dates, DATETIME2 for timestamps, DATETIMEOFFSET for cross-timezone.
-- NEVER use DATETIME for new columns — DATETIME2 is superior in every way.
```

### Parsing and Formatting in T-SQL

```sql
-- ============================================================
-- PARSING AND FORMATTING
-- ============================================================

-- String to date (CAST — simplest)
SELECT CAST('2026-03-10' AS DATE)                                        -- 2026-03-10
SELECT CAST('2026-03-10T15:30:00' AS DATETIME2)                         -- 2026-03-10 15:30:00
SELECT CAST('2026-03-10T15:30:00+01:00' AS DATETIMEOFFSET)              -- 2026-03-10 15:30:00 +01:00

-- String to date (CONVERT with style codes — for non-ISO formats)
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

-- Date to string (FORMAT — flexible but slow)
SELECT FORMAT(GETDATE(), 'yyyy-MM-dd')                 -- 2026-03-10
SELECT FORMAT(GETDATE(), 'dd MMM yyyy')                -- 10 Mar 2026
SELECT FORMAT(GETDATE(), 'yyyyMMdd_HHmmss')            -- 20260310_163000
SELECT FORMAT(GETDATE(), 'yyyy-MM-ddTHH:mm:ssK')       -- 2026-03-10T16:30:00+01:00
-- WARNING: FORMAT() uses .NET formatting under the hood. It is 10-50x SLOWER than CONVERT.
-- In queries processing millions of rows, use CONVERT instead:
SELECT CONVERT(VARCHAR(10), GETDATE(), 120)             -- 2026-03-10 (fast)
```

> [!warning] FORMAT() performance trap
>
> `FORMAT()` is 10–50x slower than `CONVERT()` because it calls .NET formatting internally. In queries processing millions of rows, always use `CONVERT(VARCHAR, date, style_code)` instead of `FORMAT(date, 'pattern')`.

### Extracting Date Components in T-SQL

```sql
-- ============================================================
-- EXTRACTING COMPONENTS
-- ============================================================

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

### Date Arithmetic in T-SQL

For the full T-SQL date function reference including FORMAT, ISDATE, and calendar table patterns, see [date-and-time-functions](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/date-and-time-functions).

```sql
-- ============================================================
-- DATE ARITHMETIC
-- ============================================================

-- Add/subtract intervals
SELECT DATEADD(DAY, 7, '2026-03-10')          -- 2026-03-17
SELECT DATEADD(DAY, -30, '2026-03-10')        -- 2026-02-08
SELECT DATEADD(MONTH, 3, '2026-03-10')        -- 2026-06-10
SELECT DATEADD(YEAR, 1, '2026-03-10')         -- 2027-03-10
SELECT DATEADD(HOUR, 5, '2026-03-10 15:30')   -- 2026-03-10 20:30:00
SELECT DATEADD(MINUTE, -90, '2026-03-10 15:30')  -- 2026-03-10 14:00:00

-- Difference between two dates
SELECT DATEDIFF(DAY, '2026-01-01', '2026-03-10')     -- 68
SELECT DATEDIFF(MONTH, '2025-06-15', '2026-03-10')   -- 9
SELECT DATEDIFF(YEAR, '2020-01-01', '2026-03-10')    -- 6
SELECT DATEDIFF(HOUR, '2026-03-10 08:00', '2026-03-10 17:30')   -- 9
-- WARNING: DATEDIFF counts BOUNDARY crossings, not full periods.
-- DATEDIFF(YEAR, '2025-12-31', '2026-01-01') = 1 (only 1 day apart!)
-- DATEDIFF(MONTH, '2026-01-31', '2026-02-01') = 1 (only 1 day apart!)
-- For "how many complete months," use more careful logic.

-- DATEDIFF_BIG for large intervals (avoids INT overflow)
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

> [!warning] DATEDIFF counts boundaries
>
> `DATEDIFF(YEAR, '2025-12-31', '2026-01-01')` returns `1` even though the dates are only 1 day apart. `DATEDIFF` counts how many year/month/day boundaries are crossed, not full periods elapsed. For "how many complete months between two dates," use more careful arithmetic.

### Timezone Conversion in T-SQL

```sql
-- ============================================================
-- TIMEZONE CONVERSION
-- ============================================================

-- Convert between timezones (SQL Server 2016+)
SELECT GETDATE() AT TIME ZONE 'Central European Standard Time'
-- 2026-03-10 16:30:00.000 +01:00 (adds offset to local datetime)

SELECT SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time'
-- 2026-03-10 11:30:00.000 -04:00 (UTC → New York)
-- NOTE: You must chain AT TIME ZONE twice:
-- First: tag the value as UTC (it's a plain DATETIME2 with no timezone)
-- Second: convert to the target timezone

SELECT SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'Tokyo Standard Time'
-- 2026-03-11 00:30:00.000 +09:00 (note: date changes!)

-- List all timezone names SQL Server knows
SELECT * FROM sys.time_zone_info ORDER BY name
-- Shows: name, current_utc_offset, is_currently_dst

-- Pipeline pattern: store in UTC, display in local
SELECT
    trade_date,
    created_at_utc,
    created_at_utc AT TIME ZONE 'UTC' AT TIME ZONE 'Central European Standard Time' AS created_at_cet
FROM gold.scores_daily
```

### Practical T-SQL Pipeline Patterns

```sql
-- ============================================================
-- PRACTICAL PATTERNS
-- ============================================================

-- Get all trading days in a range (exclude weekends)
SELECT trade_date
FROM bronze.trading_calendar
WHERE trade_date BETWEEN '2026-01-01' AND '2026-03-10'
  AND DATEPART(WEEKDAY, trade_date) NOT IN (1, 7)    -- 1=Sunday, 7=Saturday (with default @@DATEFIRST=7)

-- Yesterday's date (for pipeline "load yesterday's data")
SELECT CAST(DATEADD(DAY, -1, SYSUTCDATETIME()) AS DATE) AS yesterday

-- Rolling 30-day window
SELECT * FROM gold.scores_daily
WHERE trade_date >= DATEADD(DAY, -30, CAST(SYSUTCDATETIME() AS DATE))

-- Group by month
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

> [!warning] @@DATEFIRST and weekday numbers
>
> `DATEPART(WEEKDAY, date)` returns 1-7, but what day is "1" depends on the `@@DATEFIRST` setting:
> - US default: `@@DATEFIRST = 7` → Sunday=1, Monday=2, ..., Saturday=7
> - ISO standard: `@@DATEFIRST = 1` → Monday=1, ..., Sunday=7
>
> If your pipeline assumes Monday=1 but the server uses Sunday=1, your weekend filter breaks silently.
> Fix: use `DATENAME(WEEKDAY, date)` which returns 'Monday' regardless of setting, or set explicitly:
> ```sql
> SET DATEFIRST 1;  -- Monday = 1 (ISO standard)
> ```

---

## Python

### Current Date/Time in Python

```python
from datetime import datetime, date, time, timedelta, timezone
from zoneinfo import ZoneInfo   # Python 3.9+ (replaces pytz)

# ============================================================
# CURRENT DATE/TIME
# ============================================================

datetime.now()                          # 2026-03-10 16:30:00.123456 (local, NAIVE — no timezone!)
datetime.now(timezone.utc)              # 2026-03-10 15:30:00.123456+00:00 (UTC, AWARE)
datetime.utcnow()                       # DO NOT USE — returns naive UTC (deprecated in 3.12)
date.today()                            # 2026-03-10 (date only)
datetime.now().timestamp()              # 1773422200.123456 (Unix epoch as float)

# CRITICAL RULE: ALWAYS use timezone-aware datetimes in pipelines.
# datetime.now() without timezone is a bug waiting to happen.
# CORRECT:
now = datetime.now(timezone.utc)
# WRONG:
now = datetime.now()   # naive — is this UTC? Local? Who knows?
```

> [!warning] Never use datetime.utcnow()
>
> `datetime.utcnow()` is deprecated in Python 3.12 and returns a **naive** datetime with no timezone info. Code that receives it cannot tell if it's UTC or local time. Always use `datetime.now(timezone.utc)` instead.

### Creating Dates in Python

```python
# ============================================================
# CREATING DATES
# ============================================================

date(2026, 3, 10)                                           # 2026-03-10
datetime(2026, 3, 10, 15, 30, 0)                            # 2026-03-10 15:30:00 (naive)
datetime(2026, 3, 10, 15, 30, 0, tzinfo=timezone.utc)       # 2026-03-10 15:30:00+00:00 (UTC)
datetime(2026, 3, 10, 15, 30, tzinfo=ZoneInfo("Europe/Paris"))  # 2026-03-10 15:30:00+01:00
```

### Parsing Strings to Dates in Python

> [!info] Python strptime/strftime format codes
>
> - `%Y` — 4-digit year | `%y` — 2-digit year
> - `%m` — month 01-12 | `%b` — abbreviated (Mar) | `%B` — full (March)
> - `%d` — day 01-31 | `%j` — day of year (069)
> - `%H` — hour 00-23 | `%I` — hour 01-12 | `%p` — AM/PM
> - `%M` — minute 00-59 | `%S` — second 00-59
> - `%f` — microseconds | `%z` — UTC offset (+0100) | `%Z` — timezone name
> - `%A` — weekday (Tuesday) | `%a` — abbreviated (Tue)

```python
# strptime (string parse time) — explicit format
datetime.strptime("2026-03-10", "%Y-%m-%d")                  # datetime(2026, 3, 10)
datetime.strptime("2026-03-10T15:30:00", "%Y-%m-%dT%H:%M:%S")
datetime.strptime("10/03/2026", "%d/%m/%Y")                  # European format
datetime.strptime("Mar 10, 2026 3:30 PM", "%b %d, %Y %I:%M %p")

# fromisoformat (Python 3.7+ — fastest for ISO strings)
datetime.fromisoformat("2026-03-10")                          # datetime(2026, 3, 10)
datetime.fromisoformat("2026-03-10T15:30:00")                 # naive
datetime.fromisoformat("2026-03-10T15:30:00+01:00")           # aware
datetime.fromisoformat("2026-03-10T15:30:00Z")                # aware, UTC (Python 3.11+)

# From Unix epoch
datetime.fromtimestamp(1773422200, tz=timezone.utc)            # 2026-03-10 15:30:00+00:00
# ALWAYS pass tz= to fromtimestamp. Without it, you get local time (ambiguous).

# From date components
date.fromisoformat("2026-03-10")                               # date(2026, 3, 10)
```

### Formatting Dates to Strings in Python

```python
# ============================================================
# FORMATTING DATES → STRINGS
# ============================================================

dt = datetime(2026, 3, 10, 15, 30, 0, tzinfo=timezone.utc)

dt.strftime("%Y-%m-%d")                          # 2026-03-10
dt.strftime("%Y-%m-%dT%H:%M:%SZ")                # 2026-03-10T15:30:00Z
dt.strftime("%d %b %Y")                          # 10 Mar 2026
dt.strftime("%Y%m%d_%H%M%S")                     # 20260310_153000
dt.isoformat()                                    # 2026-03-10T15:30:00+00:00
dt.date().isoformat()                             # 2026-03-10
str(dt.date())                                    # 2026-03-10 (same)
```

### Date Arithmetic in Python

```python
# ============================================================
# DATE ARITHMETIC
# ============================================================

d = date(2026, 3, 10)
dt = datetime(2026, 3, 10, 15, 30, tzinfo=timezone.utc)

d + timedelta(days=7)                              # date(2026, 3, 17)
d - timedelta(days=30)                             # date(2026, 2, 8)
dt + timedelta(hours=5)                            # 2026-03-10 20:30:00+00:00
dt - timedelta(minutes=90)                         # 2026-03-10 14:00:00+00:00
dt + timedelta(weeks=2)                            # 2026-03-24 15:30:00+00:00
dt + timedelta(days=1, hours=3, minutes=15)        # 2026-03-11 18:45:00+00:00

# Difference between dates
(date(2026, 3, 10) - date(2026, 1, 1)).days        # 68
diff = datetime(2026, 3, 10) - datetime(2026, 3, 1)
diff.days                                            # 9
diff.total_seconds()                                 # 777600.0

# Add months/years (timedelta doesn't support months — use dateutil)
from dateutil.relativedelta import relativedelta
d + relativedelta(months=3)                         # date(2026, 6, 10)
d + relativedelta(years=1)                          # date(2027, 3, 10)
d + relativedelta(months=1, days=-1)                # date(2026, 4, 9)
d - relativedelta(months=6)                         # date(2025, 9, 10)
# dateutil handles month-end correctly:
date(2026, 1, 31) + relativedelta(months=1)         # date(2026, 2, 28) (not Feb 31!)
```

> [!tip] dateutil for month/year arithmetic
>
> Python's `timedelta` only handles days, seconds, and microseconds — not months or years. Use `dateutil.relativedelta` for month/year arithmetic. It correctly handles edge cases like January 31 + 1 month = February 28 (not February 31).

### Timezone Conversion in Python

```python
# ============================================================
# TIMEZONE CONVERSION
# ============================================================

# Create timezone-aware datetime
paris = ZoneInfo("Europe/Paris")
ny = ZoneInfo("America/New_York")
tokyo = ZoneInfo("Asia/Tokyo")

dt_utc = datetime(2026, 3, 10, 15, 30, tzinfo=timezone.utc)
dt_utc.astimezone(paris)    # 2026-03-10 16:30:00+01:00
dt_utc.astimezone(ny)       # 2026-03-10 11:30:00-04:00 (EDT after DST)
dt_utc.astimezone(tokyo)    # 2026-03-11 00:30:00+09:00 (next day!)

# Convert naive to aware (tag it with a timezone)
naive = datetime(2026, 3, 10, 15, 30)
aware = naive.replace(tzinfo=timezone.utc)              # "This IS UTC"
# OR:
aware = paris.localize(naive) if hasattr(paris, 'localize') else naive.replace(tzinfo=paris)

# List available timezones
from zoneinfo import available_timezones
sorted(tz for tz in available_timezones() if tz.startswith("Europe/"))
```

### Extracting Components in Python

```python
# ============================================================
# EXTRACTING COMPONENTS
# ============================================================

dt = datetime(2026, 3, 10, 15, 30, 45)
dt.year          # 2026
dt.month         # 3
dt.day           # 10
dt.hour          # 15
dt.minute        # 30
dt.second        # 45
dt.microsecond   # 0
dt.weekday()     # 1 (0=Monday, 6=Sunday — ISO-like)
dt.isoweekday()  # 2 (1=Monday, 7=Sunday — ISO 8601)
dt.date()        # date(2026, 3, 10) — strip time
dt.time()        # time(15, 30, 45) — strip date
dt.isocalendar() # (2026, 11, 2) — ISO year, week, weekday
dt.timetuple().tm_yday  # 69 (day of year)
```

### Practical Pipeline Patterns in Python

```python
# ============================================================
# PRACTICAL PIPELINE PATTERNS
# ============================================================

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

> [!warning] Naive vs aware datetimes
>
> Python has two kinds of datetimes:
> - **Naive** (`datetime(2026, 3, 10, 15, 30)`) — no timezone information. You don't know if this is UTC, Paris, or Tokyo. Comparing two naive datetimes from different timezones gives wrong results silently.
> - **Aware** (`datetime(2026, 3, 10, 15, 30, tzinfo=timezone.utc)`) — has timezone. Comparisons, arithmetic, and conversions are correct.
>
> **Rule: never create naive datetimes in pipeline code.** Always pass `tzinfo=`. If a library returns a naive datetime, immediately tag it:
> ```python
> naive_from_api = datetime.fromisoformat("2026-03-10T15:30:00")
> aware = naive_from_api.replace(tzinfo=timezone.utc)  # because you KNOW the API returns UTC
> ```

---

## C# (.NET)

### Current Date/Time in C#

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

### Creating Dates in C#

```csharp
// ============================================================
// CREATING DATES
// ============================================================

new DateTime(2026, 3, 10)                                                          // 2026-03-10 (Kind=Unspecified)
new DateTime(2026, 3, 10, 15, 30, 0, DateTimeKind.Utc)                            // 2026-03-10 15:30:00 UTC
new DateTimeOffset(2026, 3, 10, 15, 30, 0, TimeSpan.FromHours(1))                 // 2026-03-10 15:30:00 +01:00
new DateOnly(2026, 3, 10)                                                          // 2026-03-10
DateTimeOffset.FromUnixTimeSeconds(1773422200)                                     // from epoch
```

### Parsing Strings to Dates in C#

```csharp
// ============================================================
// PARSING STRINGS → DATES
// ============================================================

// Parse ISO automatically
DateTime.Parse("2026-03-10")                                                       // 2026-03-10
DateTime.Parse("2026-03-10T15:30:00Z")                                             // UTC → local (CAREFUL!)
DateTimeOffset.Parse("2026-03-10T15:30:00+01:00")                                  // preserves offset
DateOnly.Parse("2026-03-10")                                                       // .NET 6+

// Parse with exact format
DateTime.ParseExact("10/03/2026", "dd/MM/yyyy", CultureInfo.InvariantCulture)
DateTime.ParseExact("Mar 10, 2026", "MMM dd, yyyy", CultureInfo.InvariantCulture)

// TryParse (safe — no exception on invalid input)
if (DateTime.TryParse(userInput, out var parsed))
    Console.WriteLine(parsed);
else
    Console.WriteLine("Invalid date");

// TryParseExact (safe + exact format)
DateTime.TryParseExact("20260310", "yyyyMMdd", CultureInfo.InvariantCulture,
    DateTimeStyles.None, out var compactDate);

```

> [!info] C# (.NET) format strings
>
> - `yyyy` — 4-digit year | `yy` — 2-digit year
> - `MM` — month 01-12 | `MMM` — abbreviated (Mar) | `MMMM` — full (March)
> - `dd` — day 01-31 | `ddd` — abbreviated day (Tue) | `dddd` — full (Tuesday)
> - `HH` — hour 00-23 | `hh` — hour 01-12 | `tt` — AM/PM
> - `mm` — minute 00-59 | `ss` — second 00-59
> - `fff` — milliseconds | `ffffff` — microseconds
> - `K` — timezone offset | `zzz` — timezone offset (+01:00)
>
> `MM` = month, `mm` = minute. Same case-sensitivity gotcha as PowerShell.

### Formatting Dates to Strings in C#

```csharp
// ============================================================
// FORMATTING DATES → STRINGS
// ============================================================

var dt = new DateTimeOffset(2026, 3, 10, 15, 30, 0, TimeSpan.FromHours(1));

dt.ToString("yyyy-MM-dd")                         // 2026-03-10
dt.ToString("yyyy-MM-ddTHH:mm:ssK")               // 2026-03-10T15:30:00+01:00
dt.ToString("o")                                   // 2026-03-10T15:30:00.0000000+01:00 (round-trip)
dt.ToString("s")                                   // 2026-03-10T15:30:00 (sortable)
dt.ToString("dd MMM yyyy HH:mm")                   // 10 Mar 2026 15:30
dt.ToString("yyyyMMdd_HHmmss")                     // 20260310_153000
dt.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ssZ")    // 2026-03-10T14:30:00Z
```

### Date Arithmetic in C#

```csharp
// ============================================================
// DATE ARITHMETIC
// ============================================================

var d = new DateOnly(2026, 3, 10);
var dto = new DateTimeOffset(2026, 3, 10, 15, 30, 0, TimeSpan.Zero);

d.AddDays(7)                     // 2026-03-17
d.AddDays(-30)                   // 2026-02-08
d.AddMonths(3)                   // 2026-06-10
d.AddYears(1)                    // 2027-03-10
dto.AddHours(5)                  // 2026-03-10 20:30:00+00:00
dto.AddMinutes(-90)              // 2026-03-10 14:00:00+00:00
dto.Add(TimeSpan.FromDays(2.5))  // 2026-03-13 03:30:00+00:00

// Difference
(new DateTime(2026, 3, 10) - new DateTime(2026, 1, 1)).Days          // 68
(new DateTime(2026, 3, 10) - new DateTime(2026, 1, 1)).TotalHours    // 1632
```

### Timezone Conversion in C#

```csharp
// ============================================================
// TIMEZONE CONVERSION
// ============================================================

var utcNow = DateTimeOffset.UtcNow;

// Convert to specific timezone
var paris = TimeZoneInfo.FindSystemTimeZoneById("Central European Standard Time");
var ny = TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time");
var tokyo = TimeZoneInfo.FindSystemTimeZoneById("Tokyo Standard Time");

TimeZoneInfo.ConvertTime(utcNow, paris)     // +01:00 (or +02:00 during CEST)
TimeZoneInfo.ConvertTime(utcNow, ny)        // -05:00 (or -04:00 during EDT)
TimeZoneInfo.ConvertTime(utcNow, tokyo)     // +09:00 (no DST in Japan)

// List all timezone IDs
foreach (var tz in TimeZoneInfo.GetSystemTimeZones())
    Console.WriteLine($"{tz.Id} → {tz.DisplayName}");

// Check if DST is active
paris.IsDaylightSavingTime(utcNow)          // true/false

// GOTCHA: Windows and Linux use DIFFERENT timezone ID strings!
// Windows: "Central European Standard Time"
// Linux:   "Europe/Paris"
// Cross-platform fix (.NET 6+): both work — .NET auto-maps between them
```

### Extracting Components in C#

```csharp
// ============================================================
// EXTRACTING COMPONENTS
// ============================================================

var now = DateTimeOffset.Now;
now.Year             // 2026
now.Month            // 3
now.Day              // 10
now.Hour             // 16
now.Minute           // 30
now.Second           // 45
now.DayOfWeek        // Tuesday (enum)
now.DayOfYear        // 69
now.Offset           // +01:00:00
ISOWeek.GetWeekOfYear(now.DateTime)   // 11 (ISO 8601 week)
```

### Practical Patterns in C# (Dashboard/Display)

```csharp
// ============================================================
// PRACTICAL PATTERNS (BLAZOR/DASHBOARD)
// ============================================================

// Display trade date with user-friendly format
var tradeDate = new DateOnly(2026, 3, 10);
tradeDate.ToString("dd MMM yyyy")                  // "10 Mar 2026"

// Format for chart tooltip
var timestamp = DateTimeOffset.Parse("2026-03-10T15:30:00Z");
timestamp.ToLocalTime().ToString("dd MMM yyyy HH:mm")   // "10 Mar 2026 16:30" (user's local)

// Calculate market hours
var marketOpen = new TimeOnly(9, 0);     // 09:00
var marketClose = new TimeOnly(17, 30);  // 17:30
var currentTime = TimeOnly.FromDateTime(DateTime.Now);
var isMarketOpen = currentTime >= marketOpen && currentTime <= marketClose;

// Last business day
var d2 = DateOnly.FromDateTime(DateTime.Today);
while (d2.DayOfWeek == DayOfWeek.Saturday || d2.DayOfWeek == DayOfWeek.Sunday)
    d2 = d2.AddDays(-1);
```

> [!warning] DateTime vs DateTimeOffset
>
> `DateTime` has a `Kind` property (Local, Utc, Unspecified) that is not part of the value — it's metadata that gets silently lost during serialization, database round-trips, and JSON conversion. This causes bugs that are nearly impossible to track down.
>
> `DateTimeOffset` embeds the UTC offset directly in the value. It round-trips correctly through SQL Server (`DATETIMEOFFSET`), JSON, and API responses. **Use `DateTimeOffset` for all timestamps in your code.**
>
> `DateOnly` (.NET 6+) is perfect for trade dates — it cannot accidentally have a time component, eliminating an entire class of off-by-one bugs at day boundaries.

---

## DST Pitfalls — The Traps That Break Pipelines

Daylight Saving Time is the single biggest source of date/time bugs in data engineering. Here's what catches people:

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

#### DST safety rules — UTC storage, conversion at display time

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

## Related Notes

- [text processing tools](https://alp78.github.io/elysium/01-Shell/Text-Processing/grep-and-pattern-matching) — JSON and CSV parsing in Bash, jq, Python, PowerShell
- [serialization-formats](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/serialization-formats) — Full format comparison: JSON, YAML, CSV, Parquet, Avro, Protobuf, MessagePack

- [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) — Pipeline design that handles date boundaries correctly

## References

- [ISO 8601 Standard](https://www.iso.org/iso-8601-date-and-time-format.html)
- [Python zoneinfo docs](https://docs.python.org/3/library/zoneinfo.html)
- [SQL Server AT TIME ZONE](https://docs.microsoft.com/en-us/sql/t-sql/queries/at-time-zone-transact-sql)
- [.NET DateTimeOffset](https://docs.microsoft.com/en-us/dotnet/api/system.datetimeoffset)
- [dateutil relativedelta](https://dateutil.readthedocs.io/en/stable/relativedelta.html)
