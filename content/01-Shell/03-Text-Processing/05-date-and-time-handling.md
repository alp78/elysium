---
title: "05 - Date and Time Handling"
tags: [shell, text-processing]
aliases: [datetime handling, ISO 8601, timezone management, date arithmetic, DST pitfalls, naive vs aware datetime, DATETIMEOFFSET, DateTimeOffset, UTC storage, date parsing, date formatting]
keywords: [iso 8601, datetime, date, timezone, utc, dst, daylight saving, GETUTCDATE, SYSUTCDATETIME, DATETIMEOFFSET, DATETIME2, DateTimeOffset, DateOnly, zoneinfo, pytz, timedelta, relativedelta, dateutil, strptime, strftime, fromisoformat, date arithmetic, date parsing, date formatting, unix epoch, unix timestamp, pandas date_range, timedatectl, Get-Date, DATEADD, DATEDIFF, DATETRUNC, EOMONTH, AT TIME ZONE]
description: "Comprehensive reference for date and time handling across all pipeline contexts — ISO 8601 formats, timezone management, UTC storage, DST pitfalls, and date arithmetic in Bash, PowerShell, SQL Server T-SQL, Python, and C#."
parent: "[[domain-data-and-files]]"
links:
  - "[[01-navigation-and-listing]]"
  - "[[01-reading-file-contents]]"
  - "[[02-grep-and-pattern-matching]]"
  - "[[04-awk-data-processing]]"
  - "[[03-sed-stream-editing]]"
  - "[[03-finding-files]]"
  - "[[02-file-manipulation]]"
  - "[[04-compression]]"
  - "[[05-data-transfer]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Date and Time Handling

> [!quote]
> "Time is an illusion. Lunchtime doubly so."
>
> — **Douglas Adams**, *The Hitchhiker's Guide to the Galaxy* (1979)

Dates look simple until you realize that "March 10, 2026 at 3 PM" means a different instant in time depending on whether you're in Paris, New York, or Tokyo. A pipeline that processes market close times across Euro market index, the data pipeline project USA 50, and the data pipeline project Asia/Pacific 50 must handle three different closing times, daylight saving transitions that happen on different dates in different countries, and the fact that "today" is a different date in Sydney and New York for several hours each day.

This note covers dates exhaustively: ISO format variants, timezone management, parsing, formatting, arithmetic -- in the terminal (Linux/PowerShell), then SQL Server, Python, and C#. For the Python and C# datetime libraries in more depth, see [11_py_datetimemathutils](https://alp78.github.io/elysium/02-Programming-Languages/Python/11_py_datetimemathutils) and [11_cs_datetimemathutils](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/11_cs_datetimemathutils).


## Key terms used in this note

| Term | Plain-English definition | Why it matters here | Common mistake / confusion |
|---|---|---|---|
| ISO 8601 | An international standard for date and time representation. Format: `YYYY-MM-DDTHH:MM:SSZ` (e.g., `2026-04-10T14:30:00Z`). The `T` separates date from time; `Z` means UTC. | The recommended format for all timestamps in data pipelines, file naming, APIs, and logs. Sorts lexicographically and is unambiguous across locales. | Using locale-dependent formats like `MM/DD/YYYY` or `DD-Mon-YYYY` which are ambiguous internationally. `04/05/2026` means April 5 in the US but May 4 in Europe. |
| UTC (Coordinated Universal Time) | The primary time standard for global timekeeping. No daylight saving transitions. All time zones are expressed as offsets from UTC. | Data pipelines should store and process timestamps in UTC to avoid DST ambiguity and timezone conversion bugs. | Storing local time without timezone information. A timestamp of `2026-03-10 02:30:00` is ambiguous during DST transitions -- it may not exist or may occur twice. |
| Epoch / Unix timestamp | The number of seconds (or milliseconds) since 1970-01-01 00:00:00 UTC. A single integer that uniquely identifies a moment in time. | Compact, timezone-free, and easy to compare. Used in APIs, message queues, and database internals. | Confusing seconds vs milliseconds. JavaScript and Java use milliseconds (13 digits). Unix and Python use seconds (10 digits). Dividing or multiplying by 1000 incorrectly corrupts timestamps. |
| `strftime` | A function (available in bash `date`, Python, C, and many other languages) that formats a datetime into a string using format codes like `%Y` (year), `%m` (month), `%d` (day), `%H` (hour), `%M` (minute), `%S` (second). | Generates timestamped filenames, log entries, and formatted date strings. | Platform differences: GNU `date` uses `%N` for nanoseconds (not available on macOS). macOS `date` uses `-v` for date arithmetic (GNU uses `-d`). |
| DST (Daylight Saving Time) | A seasonal clock adjustment where clocks move forward in spring and back in fall. Creates a 23-hour day in spring and a 25-hour day in fall. | The single most common source of date/time bugs in data pipelines. A "daily" job spanning a DST transition may process 23 or 25 hours of data. | Assuming every day has 24 hours. Assuming `+ 1 day` always advances by 86400 seconds. Assuming 2:30 AM always exists (it does not during spring-forward). |
| `date` (Linux) | The Linux command for displaying and formatting dates. `date +%Y-%m-%d` prints today in ISO format. `date -d "yesterday"` does date arithmetic. | Generates timestamps for file naming, log entries, and pipeline scheduling. | GNU `date` and BSD/macOS `date` have different syntax for date arithmetic and formatting. Scripts must handle both or use Python for portability. |
| `Get-Date` (PS) | The PowerShell cmdlet for date/time operations. Returns a .NET `DateTime` object with properties and methods for formatting and arithmetic. | The PowerShell equivalent of the Linux `date` command. `.ToString("yyyy-MM-dd")` for formatting; `.AddDays(-1)` for arithmetic. | .NET format strings differ from `strftime`: `yyyy` not `%Y`, `MM` not `%m`, `dd` not `%d`. |
| Timezone offset | The difference between local time and UTC, expressed as `+HH:MM` or `-HH:MM`. E.g., `+02:00` for Central European Summer Time. | Timestamps without timezone information are ambiguous. Always store offsets or use UTC. | Hardcoding offsets instead of using timezone names. An offset of `+01:00` could be CET, WAT, or BST depending on the date and location. |

## What this note covers

- Date and time standards: ISO 8601, UTC, epoch timestamps
- Linux `date` command: formatting (`strftime`), arithmetic, timezone conversion
- PowerShell `Get-Date`: formatting (`.ToString`), arithmetic (`.AddDays`), timezone conversion
- SQL Server date functions: `GETDATE()`, `GETUTCDATE()`, `DATEADD`, `DATEDIFF`, `FORMAT`
- Python datetime: `datetime`, `timedelta`, `pytz`/`zoneinfo`, `strftime`/`strptime`
- C# (.NET) DateTime: `DateTime.UtcNow`, `.ToString`, `.AddDays`, `TimeZoneInfo`
- DST pitfalls: the traps that break data pipelines
## Date and time standards

Dates look deceptively simple until a pipeline processes market close times across Euro, US, and Asia/Pacific indexes simultaneously. ISO 8601 is the universal wire format; understanding its variants and when to apply each prevents format confusion across regional conventions and database types.

### ISO 8601 — the only date format you should use in pipelines

ISO 8601 is the international standard for date/time representation. It is unambiguous, sortable as text, and understood by every language and database. If you use any other format in your pipeline, you are creating technical debt.

```text
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

> [!success] Apply these rules consistently
> Use `DATE` for trade/report dates, `DATETIME2` for internal timestamps, and `DATETIMEOFFSET` for any value that crosses timezone boundaries. Always store as UTC and apply `YYYY-MM-DD` when strings are unavoidable.

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

## Linux date and time tools

The primary date/time tool on Linux is the GNU `date` command, which handles formatting, parsing, arithmetic, and timezone conversion in a single binary. `timedatectl` manages the system clock and timezone. Most pipeline scripts need only these two tools; more complex month/year arithmetic is better handled in Python or SQL.

### Linux | date | formatting and output

The `date` command outputs the current date/time when called without arguments, or a formatted string when given a `+format` argument. GNU `date` (Linux) supports the `-d` flag for parsing arbitrary date strings; macOS uses BSD `date`, which has a different syntax.

#### date — current date in default format

```bash
date
```

```text
Tue Mar 10 16:30:00 CET 2026
```

#### date +format — current date with format string

```bash
date +%Y-%m-%d                      # 2026-03-10 (ISO date)
date -u                             # Tue Mar 10 15:30:00 UTC 2026 (UTC)
date -u +%Y-%m-%dT%H:%M:%SZ        # 2026-03-10T15:30:00Z (ISO UTC)
date +%Y-%m-%dT%H:%M:%S%z          # 2026-03-10T16:30:00+0100 (ISO with offset)
date +%s                            # 1773422200 (Unix epoch)
date +%Y%m%d                        # 20260310 (compact — for file names)
date +%Y%m%d_%H%M%S                 # 20260310_163000 (compact with time — for backup names)
```

#### date -d "string" — parse a date string and reformat

The `-d` flag interprets a string as a date instead of using the current time. It accepts ISO 8601 strings, natural-language offsets like `"next Monday"`, and Unix epoch timestamps prefixed with `@`. This flag is GNU `date`-only; BSD `date` (macOS) uses `-j -f` instead.

```bash
date -d "2026-03-10" +%A
```

```text
Tuesday
```

```bash
date -d "2026-03-10T15:30:00Z" +%s
```

```text
1773422200
```

```bash
date -d "@1773422200" +%Y-%m-%dT%H:%M:%SZ
```

```text
2026-03-10T15:30:00Z
```

| Specifier | Output | Description |
|---|---|---|
| `%Y` | `2026` | 4-digit year |
| `%y` | `26` | 2-digit year |
| `%m` | `03` | Month 01–12 |
| `%b` | `Mar` | Abbreviated month name |
| `%B` | `March` | Full month name |
| `%d` | `10` | Day 01–31 |
| `%e` | ` 10` | Day 1–31 (space-padded) |
| `%H` | `15` | Hour 00–23 (24h) |
| `%I` | `03` | Hour 01–12 (12h) |
| `%p` | `PM` | AM/PM |
| `%M` | `30` | Minute 00–59 |
| `%S` | `00` | Second 00–59 |
| `%N` | `123456789` | Nanoseconds |
| `%3N` | `123` | Milliseconds |
| `%6N` | `123456` | Microseconds |
| `%z` | `+0100` | Timezone offset |
| `%Z` | `CET` | Timezone name |
| `%s` | `1773422200` | Unix epoch (seconds since 1970-01-01T00:00:00Z) |
| `%j` | `069` | Day of year 001–366 |
| `%u` | `2` | Day of week 1–7 (Mon=1, ISO) |
| `%A` | `Tuesday` | Full weekday name |
| `%a` | `Tue` | Abbreviated weekday name |
| `%W` | `10` | Week number of year (Mon as first day) |

### Linux | date | arithmetic and timezone

GNU `date -d` accepts relative arithmetic expressions as its date string, allowing date math without external tools. The `TZ` environment variable prefixed before `date` overrides the timezone for that single invocation, which is useful for converting UTC timestamps to local time for display.

#### date -d "+N days" — date arithmetic in Bash

The `-d` flag accepts relative offset strings as well as absolute dates, allowing addition and subtraction of days, months, years, hours, and minutes directly in the shell. GNU `date` does not have built-in business-day logic — for that, use Python's `dateutil` or a SQL Server calendar table.

```bash
date -d "2026-03-10 + 7 days" +%Y-%m-%d
date -d "2026-03-10 - 30 days" +%Y-%m-%d
date -d "2026-03-10 + 3 months" +%Y-%m-%d
date -d "2026-03-10 + 1 year" +%Y-%m-%d
date -d "2026-03-10 15:30 + 5 hours" +%H:%M
date -d "2026-03-10 15:30 - 90 minutes" +%H:%M
date -d "2026-03-10" +%Y-%m-01
date -d "2026-04-01 - 1 day" +%Y-%m-%d
```

```text
2026-03-17
2026-02-08
2026-06-10
2027-03-10
20:30
14:00
2026-03-01
2026-03-31
```

#### TZ=zone date — timezone conversion in Bash

Prefix `TZ=<zone>` before `date` to convert an input timestamp to any IANA timezone without changing the system clock. `timedatectl` manages the persistent system timezone and NTP sync status.

```bash
TZ=America/New_York date -d "2026-03-10T15:30:00 UTC" +%Y-%m-%dT%H:%M:%S\ %Z
TZ=Asia/Tokyo date -d "2026-03-10T15:30:00 UTC" +%Y-%m-%dT%H:%M:%S\ %Z
timedatectl
timedatectl list-timezones
BACKUP_FILE="project_backup_$(date +%Y%m%d_%H%M%S).bak"
```

```text
2026-03-10T11:30:00 EDT
2026-03-11T00:30:00 JST
               Local time: Tue 2026-03-10 16:30:00 CET
           Universal time: Tue 2026-03-10 15:30:00 UTC
                 RTC time: Tue 2026-03-10 15:30:00
                Time zone: Europe/Paris (CET, +0100)
System clock synchronized: yes
project_backup_20260310_163000.bak
```

| Flag / Command | Syntax | Description |
|---|---|---|
| `TZ=zone` | `TZ=America/New_York date ...` | Override timezone for one command |
| `-d` | `date -d "string"` | Parse a date string (GNU date only) |
| `-u` | `date -u` | Output in UTC |
| `+format` | `date +%Y-%m-%d` | Custom output format |
| `timedatectl` | `timedatectl` | Show system clock status and timezone |
| `list-timezones` | `timedatectl list-timezones` | List all available IANA timezone names |
| `set-timezone` | `sudo timedatectl set-timezone UTC` | Set persistent system timezone |

> [!warning] Always set servers to UTC
>
> Every server in your infrastructure should run on UTC. UTC never changes — CET becomes CEST in March, EST becomes EDT, and cron jobs scheduled at "09:00 local" shift by an hour. On UTC, 09:00 is always 09:00. Correlating logs across regions also works cleanly: `grep "2026-03-10T15:" *.log` gives exact matches only if all servers share the same timezone. `GETUTCDATE()` in SQL Server always returns UTC regardless of server timezone, but `GETDATE()` returns server-local time — on a UTC server they are identical.

> [!success] Set timezone to UTC at provisioning time
> Run this once after server setup and include it in your bootstrap scripts:

```bash
sudo timedatectl set-timezone UTC
```

---

## PowerShell date and time tools

PowerShell date/time operations use the .NET `DateTime`, `DateTimeOffset`, and `DateOnly` types directly. `Get-Date` is the primary cmdlet for formatting and parsing; arithmetic uses the `.Add*()` methods; timezone conversion uses `[TimeZoneInfo]`. Note that Windows timezone IDs (e.g. `"Eastern Standard Time"`) differ from IANA names (e.g. `"America/New_York"`) used on Linux — .NET 6+ maps between them automatically on cross-platform code.

### PowerShell | Get-Date | formatting and output

`Get-Date` without arguments returns a `DateTime` object in system locale. Use `-Format` for .NET format strings, `-UFormat` for Unix-style `%` specifiers, and `-AsUTC` (PowerShell 7+) to force UTC output.

#### Get-Date — current date/time in PowerShell

```powershell
Get-Date
Get-Date -Format "yyyy-MM-dd"
Get-Date -Format "yyyy-MM-ddTHH:mm:ssK"
Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ" -AsUTC
[DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
Get-Date -UFormat "%s"
Get-Date -Format "yyyyMMdd_HHmmss"
```

```text
Tuesday, March 10, 2026 16:30:00
2026-03-10
2026-03-10T16:30:00+01:00
2026-03-10T15:30:00Z
2026-03-10T15:30:00Z
1773422200
20260310_163000
```

#### [datetime]::ParseExact — parsing date strings in PowerShell

`[DateTime]::ParseExact` requires an exact format string and `CultureInfo.InvariantCulture` (pass `$null` in PowerShell to use invariant culture). `[DateTimeOffset]::Parse` accepts ISO 8601 strings with offset automatically. `Get-Date "string"` is the simplest path for ISO-formatted input.

```powershell
[DateTime]::ParseExact("2026-03-10", "yyyy-MM-dd", $null)
[DateTimeOffset]::Parse("2026-03-10T15:30:00+01:00")
Get-Date "2026-03-10"
```

> [!warning] MM vs mm case sensitivity
>
> `MM` = month, `mm` = minute. Case matters in .NET format strings. A format like `"yyyy-mm-dd"` silently produces wrong output — `mm` extracts the minute (00), not the month.

> [!success] Use uppercase MM for month, lowercase mm for minutes
> `"yyyy-MM-dd HH:mm:ss"` is correct. `"yyyy-mm-dd"` is a silent bug.

| Specifier | Output | Description |
|---|---|---|
| `yyyy` | `2026` | 4-digit year |
| `yy` | `26` | 2-digit year |
| `MM` | `03` | Month 01–12 (uppercase) |
| `MMM` | `Mar` | Abbreviated month name |
| `MMMM` | `March` | Full month name |
| `dd` | `10` | Day 01–31 |
| `ddd` | `Tue` | Abbreviated weekday name |
| `dddd` | `Tuesday` | Full weekday name |
| `HH` | `15` | Hour 00–23 (24h) |
| `hh` | `03` | Hour 01–12 (12h) |
| `tt` | `PM` | AM/PM |
| `mm` | `30` | Minute 00–59 (lowercase) |
| `ss` | `00` | Second 00–59 |
| `fff` | `123` | Milliseconds |
| `ffffff` | `123456` | Microseconds |
| `K` | `+01:00` | Timezone offset (appends `Z` for UTC) |
| `zzz` | `+01:00` | Timezone offset (always explicit sign) |

### PowerShell | Get-Date | arithmetic and timezone

Date arithmetic uses the `.Add*()` instance methods on `DateTime`/`DateTimeOffset` objects. Subtraction with `-` produces a `TimeSpan`. Timezone conversion uses `[TimeZoneInfo]::ConvertTime`, which handles DST transitions automatically using the system timezone database.

#### (Get-Date).AddDays — date arithmetic in PowerShell

```powershell
(Get-Date "2026-03-10").AddDays(7)
(Get-Date "2026-03-10").AddDays(-30)
(Get-Date "2026-03-10").AddMonths(3)
(Get-Date "2026-03-10").AddHours(5)
(Get-Date "2026-03-10").AddMinutes(-90)
(Get-Date "2026-03-10").AddYears(1)
$start = Get-Date "2026-01-01"
$end = Get-Date "2026-03-10"
($end - $start).Days
($end - $start).TotalHours
```

```text
2026-03-17 00:00:00
2026-02-08 00:00:00
2026-06-10 00:00:00
2026-03-10 20:30:00
2026-03-09 22:30:00
2027-03-10 00:00:00
68
1632
```

#### [TimeZoneInfo]::ConvertTime — timezone conversion in PowerShell

```powershell
[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId(
    [DateTime]::Parse("2026-03-10T15:30:00"),
    "UTC",
    "Eastern Standard Time"
)
[TimeZoneInfo]::GetSystemTimeZones() | Select-Object Id, DisplayName | Where-Object Id -match "Europe|America|Asia"
```

#### .Year, .Month, .DayOfWeek — extracting date components in PowerShell

```powershell
$d = Get-Date "2026-03-10T15:30:45"
$d.Year
$d.Month
$d.Day
$d.DayOfWeek
$d.DayOfYear
$d.Hour
$d.Minute
$d.Second
$BackupFile = "project_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').bak"
```

```text
2026
3
10
Tuesday
69
15
30
45
project_backup_20260310_163000.bak
```

| Method / Property | Syntax | Description |
|---|---|---|
| `.AddDays()` | `(Get-Date).AddDays(7)` | Add or subtract days |
| `.AddMonths()` | `(Get-Date).AddMonths(1)` | Add or subtract months |
| `.AddYears()` | `(Get-Date).AddYears(-1)` | Add or subtract years |
| `.AddHours()` | `(Get-Date).AddHours(5)` | Add or subtract hours |
| `.AddMinutes()` | `(Get-Date).AddMinutes(-90)` | Add or subtract minutes |
| `TimeSpan.Days` | `($end - $start).Days` | Whole days between two dates |
| `TimeSpan.TotalHours` | `($end - $start).TotalHours` | Total hours as decimal |
| `.DayOfWeek` | `$d.DayOfWeek` | Weekday name enum (Monday, Tuesday…) |
| `.DayOfYear` | `$d.DayOfYear` | Day number 1–366 |
| `ConvertTimeBySystemTimeZoneId` | `[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId(dt, "UTC", "Eastern Standard Time")` | Convert between Windows timezone IDs |
| `GetSystemTimeZones()` | `[TimeZoneInfo]::GetSystemTimeZones()` | List all available timezone IDs |

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

> [!success] Use CONVERT for high-volume formatting
> `CONVERT(VARCHAR(10), GETDATE(), 120)` returns `2026-03-10` and is an order of magnitude faster than `FORMAT(GETDATE(), 'yyyy-MM-dd')`. Reserve `FORMAT()` for display-only queries with small result sets.

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

For the full T-SQL date function reference including FORMAT, ISDATE, and calendar table patterns, see [date-and-time-functions](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/date-and-time-functions).

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

> [!success] Use DATEDIFF for coarse intervals, custom logic for precise periods
> `DATEDIFF(DAY, start, end)` is reliable. For "complete months elapsed," compute `DATEDIFF(MONTH, ...) - 1` when the end day is earlier in the month than the start day, or use a calendar table join.

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
> `DATEPART(WEEKDAY, date)` returns 1–7, but what day is "1" depends on the `@@DATEFIRST` setting. US default: `@@DATEFIRST = 7` → Sunday=1, Monday=2, Saturday=7. ISO standard: `@@DATEFIRST = 1` → Monday=1, Sunday=7. If your pipeline assumes Monday=1 but the server uses Sunday=1, your weekend exclusion filter breaks silently and lets through Saturday and Sunday records.

> [!success] Use DATENAME or set @@DATEFIRST explicitly
> `DATENAME(WEEKDAY, date)` returns `'Monday'` regardless of `@@DATEFIRST` — use it for readable, session-independent weekday logic. Alternatively, set the session setting at the top of any script that relies on weekday numbers:

```sql
SET DATEFIRST 1;  -- Monday = 1 (ISO standard)
```

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

> [!success] Use datetime.now(timezone.utc) for all UTC timestamps
> `datetime.now(timezone.utc)` returns a timezone-aware datetime. Any downstream code can inspect `.tzinfo` and the value round-trips correctly through JSON serialization, database storage, and API responses.

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

| Specifier | Output | Description |
|---|---|---|
| `%Y` | `2026` | 4-digit year |
| `%y` | `26` | 2-digit year |
| `%m` | `03` | Month 01–12 |
| `%b` | `Mar` | Abbreviated month name |
| `%B` | `March` | Full month name |
| `%d` | `10` | Day 01–31 |
| `%j` | `069` | Day of year 001–366 |
| `%H` | `15` | Hour 00–23 (24h) |
| `%I` | `03` | Hour 01–12 (12h) |
| `%p` | `PM` | AM/PM |
| `%M` | `30` | Minute 00–59 |
| `%S` | `00` | Second 00–59 |
| `%f` | `123456` | Microseconds |
| `%z` | `+0100` | UTC offset (+HHMM or +HH:MM) |
| `%Z` | `UTC` | Timezone name (output only — unreliable for parsing) |
| `%A` | `Tuesday` | Full weekday name |
| `%a` | `Tue` | Abbreviated weekday name |
| `%u` | `2` | Weekday 1–7 (Mon=1, ISO) |
| `%W` | `10` | Week number 00–53 (Mon as first day) |

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
> Python has two kinds of datetimes. **Naive** (`datetime(2026, 3, 10, 15, 30)`) has no timezone info — you cannot tell if it represents UTC, Paris, or Tokyo. Comparing two naive datetimes from different timezones gives wrong results silently. **Aware** (`datetime(2026, 3, 10, 15, 30, tzinfo=timezone.utc)`) embeds the timezone. Comparisons, arithmetic, and conversions are all correct. Never create naive datetimes in pipeline code — always pass `tzinfo=`.

> [!success] Tag naive datetimes immediately on receipt
> If a library or API returns a naive datetime and you know its intended timezone, tag it with `.replace()` before storing or passing it on:

```python
naive_from_api = datetime.fromisoformat("2026-03-10T15:30:00")
aware = naive_from_api.replace(tzinfo=timezone.utc)  # tag as UTC
```

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

| Specifier | Output | Description |
|---|---|---|
| `yyyy` | `2026` | 4-digit year |
| `yy` | `26` | 2-digit year |
| `MM` | `03` | Month 01–12 (uppercase) |
| `MMM` | `Mar` | Abbreviated month name |
| `MMMM` | `March` | Full month name |
| `dd` | `10` | Day 01–31 |
| `ddd` | `Tue` | Abbreviated weekday name |
| `dddd` | `Tuesday` | Full weekday name |
| `HH` | `15` | Hour 00–23 (24h) |
| `hh` | `03` | Hour 01–12 (12h) |
| `tt` | `PM` | AM/PM |
| `mm` | `30` | Minute 00–59 (lowercase) |
| `ss` | `00` | Second 00–59 |
| `fff` | `123` | Milliseconds |
| `ffffff` | `123456` | Microseconds |
| `K` | `+01:00` | Timezone offset; appends `Z` when `Kind=Utc` |
| `zzz` | `+01:00` | Timezone offset (always explicit) |
| `o` | `2026-03-10T15:30:00.0000000+01:00` | Round-trip ISO 8601 format |
| `s` | `2026-03-10T15:30:00` | Sortable ISO 8601 (no timezone) |

`MM` = month, `mm` = minute — same case-sensitivity rule as PowerShell.

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
> `DateTime` has a `Kind` property (Local, Utc, Unspecified) that is not part of the value — it's metadata that gets silently lost during serialization, database round-trips, and JSON conversion. This causes bugs that are nearly impossible to track down. `DateTime.Kind = Utc` and `DateTime.Kind = Local` are structurally identical values; only the tag differs, and the tag disappears the moment you serialize to JSON or write to SQL Server.

> [!success] Use DateTimeOffset for timestamps, DateOnly for trade dates
> `DateTimeOffset` embeds the UTC offset directly in the value and round-trips correctly through SQL Server `DATETIMEOFFSET`, JSON, and API responses. `DateOnly` (.NET 6+) is perfect for trade dates — it has no time component, eliminating off-by-one bugs at day boundaries entirely.

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


## When to use date and time handling

- **Timestamped file naming** -- `output_$(date +%Y%m%d_%H%M%S).csv` creates unique, sortable filenames for pipeline output.
- **Log correlation** -- converting all timestamps to UTC enables correlating events across systems in different timezones.
- **Pipeline scheduling** -- calculating "yesterday" or "last business day" for incremental data loads: `date -d "yesterday" +%Y-%m-%d`.
- **Data validation** -- checking that timestamps in incoming data fall within expected ranges and are not in the future.
- **Audit trails** -- recording when each pipeline step started and finished, in UTC, for compliance and debugging.
- **Financial data processing** -- converting between exchange timezones (NYSE, LSE, TSE) for market data alignment.

## When not to use date and time handling

- **Rolling your own timezone conversion** -- use established libraries (`pytz`/`zoneinfo` in Python, `TimeZoneInfo` in .NET, `AT TIME ZONE` in SQL Server) instead of manual offset arithmetic.
- **Storing dates as strings in databases** -- use native `DATE`, `DATETIME2`, or `TIMESTAMPTZ` types. String dates break sorting, comparison, and indexing.
- **Assuming 24-hour days in date arithmetic** -- adding 86400 seconds is not the same as adding 1 calendar day when DST transitions are involved. Use calendar-aware functions.

## Warnings

> [!danger] DST transitions break naive date arithmetic
>
> Adding 86400 seconds (24 hours) to `2026-03-08 00:00:00 America/New_York` produces `2026-03-09 01:00:00` (25 hours later by clock time) because spring-forward skipped an hour. Always use calendar-aware functions (`dateadd`, `timedelta`, `.AddDays`) instead of second-based arithmetic.

> [!danger] Timestamps without timezone info are ambiguous
>
> `2026-11-01 01:30:00` in US Eastern occurs twice during fall-back. Without a timezone offset or UTC designation, there is no way to determine which 1:30 AM was intended. Always store timestamps in UTC or with explicit timezone offsets.

> [!warning] GNU `date` and BSD/macOS `date` have different syntax
>
> GNU: `date -d "yesterday" +%Y-%m-%d`. BSD: `date -v-1d +%Y-%m-%d`. Scripts using `date -d` fail silently on macOS. For portable date arithmetic, use Python `datetime`.

> [!warning] Epoch timestamp precision varies by platform
>
> Unix/Python: seconds (10 digits). JavaScript/Java: milliseconds (13 digits). Mixing them produces dates in the year 53,000+ or 1970. Always verify the precision of epoch values before conversion.

## Recommendations

| Scenario | Recommendation |
|---|---|
| Timestamp format for filenames | `$(date -u +%Y%m%d_%H%M%S)` -- UTC, no separators that conflict with filesystem rules. |
| Timestamp format for data | ISO 8601 with timezone: `2026-04-10T14:30:00+00:00` or `2026-04-10T14:30:00Z`. |
| Date arithmetic (Linux) | `date -d "3 days ago" +%Y-%m-%d` (GNU only). For portability, use Python. |
| Date arithmetic (PowerShell) | `(Get-Date).AddDays(-3).ToString("yyyy-MM-dd")`. |
| Date arithmetic (SQL Server) | `DATEADD(DAY, -3, GETUTCDATE())`. Always use `GETUTCDATE()`, not `GETDATE()`. |
| Timezone storage | Store all timestamps in UTC. Convert to local time only at display time. |
| DST-safe daily scheduling | Schedule jobs in UTC. Calculate date ranges using calendar-aware functions, not fixed-second intervals. |
| Financial data alignment | Use exchange-specific timezone names (`America/New_York`, `Europe/London`, `Asia/Tokyo`) with `AT TIME ZONE` or `pytz`/`zoneinfo`. |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Daily pipeline processes 23 or 25 hours of data | Date range calculated with fixed 24-hour intervals across a DST boundary. | Use calendar-day arithmetic (`DATEADD(DAY, ...)`, `.AddDays()`, `timedelta(days=1)`) instead of second-based math. |
| `date -d "yesterday"` fails on macOS | GNU `date` syntax not available on BSD. | Use `date -v-1d +%Y-%m-%d` on macOS, or install GNU coreutils (`brew install coreutils`, then `gdate`). |
| Epoch conversion produces wrong year | Seconds vs milliseconds mismatch. JavaScript epoch (13 digits) divided by 1 yields year ~53000. | Divide JavaScript/Java epochs by 1000 before converting. Verify digit count: 10 = seconds, 13 = milliseconds. |
| Timestamps sort incorrectly | Using locale-dependent format (`MM/DD/YYYY`) which does not sort lexicographically. | Use ISO 8601 (`YYYY-MM-DD`) which sorts correctly as text. |
| Same timestamp appears twice in data | Fall-back DST transition: local time 1:00-2:00 AM occurs twice. | Store timestamps in UTC. If local time is required, include the UTC offset to disambiguate. |
| `Get-Date -Format` produces unexpected output | Confusion between .NET format strings and `strftime` codes. | Use .NET format: `yyyy-MM-dd HH:mm:ss`, not `%Y-%m-%d %H:%M:%S`. |
## Cross-references

- [text processing tools](https://alp78.github.io/elysium/01-Shell/Text-Processing/grep-and-pattern-matching) — JSON and CSV parsing in Bash, jq, Python, PowerShell
- [serialization-formats](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/serialization-formats) — Full format comparison: JSON, YAML, CSV, Parquet, Avro, Protobuf, MessagePack

- [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) — Pipeline design that handles date boundaries correctly

## References

- [ISO 8601 Standard](https://www.iso.org/iso-8601-date-and-time-format.html)
- [Python zoneinfo docs](https://docs.python.org/3/library/zoneinfo.html)
- [SQL Server AT TIME ZONE](https://docs.microsoft.com/en-us/sql/t-sql/queries/at-time-zone-transact-sql)
- [.NET DateTimeOffset](https://docs.microsoft.com/en-us/dotnet/api/system.datetimeoffset)
- [dateutil relativedelta](https://dateutil.readthedocs.io/en/stable/relativedelta.html)

