---
title: "05 - Date and Time Handling"
tags: [shell, text-processing]
aliases: [datetime handling, ISO 8601, timezone management, date arithmetic, DST pitfalls, naive vs aware datetime, DATETIMEOFFSET, DateTimeOffset, UTC storage, date parsing, date formatting]
keywords: [iso 8601, datetime, date, timezone, utc, dst, daylight saving, GETUTCDATE, SYSUTCDATETIME, DATETIMEOFFSET, DATETIME2, DateTimeOffset, DateOnly, zoneinfo, pytz, timedelta, relativedelta, dateutil, strptime, strftime, fromisoformat, date arithmetic, date parsing, date formatting, unix epoch, unix timestamp, pandas date_range, timedatectl, Get-Date, DATEADD, DATEDIFF, DATETRUNC, EOMONTH, AT TIME ZONE]
description: "Cross-platform reference for date and time handling in pipelines: ISO 8601, UTC storage, timezone conversion, DST boundaries, and date arithmetic across Linux, PowerShell, SQL Server, Python, and C#."
created: 2026-03-22
updated: 2026-04-15
status: complete
---

# Date and Time Handling

> [!quote] Douglas Adams on time
>
> "Time is an illusion. Lunchtime doubly so."
>
> -- **Douglas Adams**, *The Hitchhiker's Guide to the Galaxy* (1979)

> [!abstract]- Summary
> Pipeline-safe date handling starts with four rules: use ISO 8601 for interchange, store instants in UTC, keep calendar dates separate from timestamps, and convert to local time only at the display edge.
>
> - **Standards and selection** - ISO 8601 forms, UTC storage rules, epoch timestamps, and context-specific format choices for SQL, APIs, logs, filenames, schedules, and runtime objects
> - **Linux and PowerShell** - formatting, parsing, arithmetic, timezone inspection, and timezone conversion with captured shell output
> - **SQL Server, Python, and C#** - grouped executable examples for data types, parsing, formatting, arithmetic, timezone conversion, and pipeline-safe patterns
> - **DST boundaries** - concrete demonstrations of 23-hour days, duplicated local clock times, and cross-market offset drift

> [!note]- Glossary
>
> **ISO 8601**
>
> - International date and time standard for machine-readable values such as `2026-03-10`, `2026-03-10T15:30:00Z`, and `2026-03-10T15:30:00+01:00`
> - Default interchange format for APIs, logs, filenames, and serialized pipeline metadata because it is unambiguous and sorts predictably
> - Use the fully qualified timestamp forms with `Z` or an explicit offset whenever the value represents an instant
>
> ---
>
> **UTC (Coordinated Universal Time)**
>
> - Global civil time reference with no daylight saving transitions
> - Canonical storage basis for pipeline timestamps, event logs, and cross-region processing windows
> - `Z` in ISO 8601 means UTC with zero offset
>
> ---
>
> **Epoch / Unix timestamp**
>
> - Count of elapsed seconds or milliseconds since `1970-01-01T00:00:00Z`
> - Compact absolute representation used in message queues, browser APIs, and cross-language interchange
> - A 10-digit value is usually seconds; a 13-digit value is usually milliseconds
>
> ---
>
> **`strftime`**
>
> - Formatting model that renders date and time values with specifiers such as `%Y`, `%m`, `%d`, `%H`, `%M`, and `%S`
> - Used by GNU `date`, Python, and many POSIX-oriented tools for stable output formatting
> - .NET and PowerShell use different format tokens such as `yyyy-MM-dd`
>
> ---
>
> **DST (Daylight Saving Time)**
>
> - Seasonal clock shift used in some time zones, usually moving one hour forward in spring and one hour backward in autumn
> - Major source of scheduling, window-boundary, and deduplication bugs in pipelines that operate on local time
> - A local day that crosses a DST transition can contain 23 or 25 clock-hours
>
> ---
>
> **IANA timezone name**
>
> - Stable zone identifier such as `Europe/Paris` or `America/New_York`
> - Preferred identifier family for Linux, Python `zoneinfo`, and most network-facing systems
> - A numeric offset like `+01:00` is not a substitute for a timezone name when future DST-aware interpretation matters
>
> ---
>
> **Windows timezone ID**
>
> - Zone identifier such as `Eastern Standard Time` or `Central European Standard Time`
> - Used by Windows APIs, SQL Server `AT TIME ZONE`, and .NET on Windows
> - Cross-platform code often needs explicit mapping between Windows IDs and IANA names
>
> ---
>
> **Naive datetime**
>
> - Date-time value with no attached timezone or offset metadata
> - Unsafe for cross-region comparisons, persistence, and scheduling because the represented instant is ambiguous
> - Convert naive inputs to aware values as soon as the source timezone is known
>
> ---
>
> **Aware datetime**
>
> - Date-time value that carries timezone or UTC offset information
> - Required for correct comparison, serialization, and conversion across regions
> - Prefer aware values in Python and `DateTimeOffset` values in .NET for timestamp work
>
> ---
>
> **`DATETIME2`**
>
> - SQL Server type for date and time values without timezone metadata
> - Appropriate for UTC-normalized timestamps when the timezone context is already resolved before storage
> - Do not use it when a persisted offset must survive round-trips
>
> ---
>
> **`DATETIMEOFFSET`**
>
> - SQL Server type that stores date, time, and UTC offset together
> - Appropriate for values that arrive with a source offset or must round-trip with offset fidelity
> - It preserves the offset, not the full historical rule set of a named timezone
>
> ---
>
> **`DateTimeOffset`**
>
> - .NET type that stores a timestamp together with its UTC offset
> - Preferred .NET type for timestamps that leave process memory or cross system boundaries
> - Use `DateOnly` for pure calendar dates such as trade dates and report dates

Pipelines fail on dates in predictable ways:
ambiguous text formats, local-time storage, fixed-offset assumptions, and arithmetic that treats every day as 86,400 seconds.
The examples below keep those failure modes visible and executable across Linux, PowerShell, SQL Server, Python, and C#.

## Date and time standards

ISO 8601 is the transport format, UTC is the storage baseline, and timezone conversion belongs at the edges.
Keep calendar dates, local clock displays, and absolute instants separate in both schema design and runtime code.

### ISO 8601 forms for pipeline work

Use the narrowest ISO 8601 form that still preserves the meaning of the value.

- `2026-03-10` is a calendar date and belongs in SQL `DATE`, .NET `DateOnly`, or Python `date`
- `2026-03-10T15:30:00Z` is a UTC instant and is the safest default for APIs, logs, and message payloads
- `2026-03-10T15:30:00+01:00` is an instant that arrived with a source offset and must keep that offset through parsing
- `20260310T153000Z` is useful for separator-free identifiers and filenames when lexical sort order matters
- `2026-W11-2` and `2026-069` are specialized ISO week and ordinal forms that appear in reporting and calendar-driven partitioning

The unsafe form is the local timestamp with no timezone metadata, such as `2026-03-10T15:30:00`.
If that value leaves process memory, nobody can tell whether it meant UTC, Paris time, or New York time.

### Date format selection by context

Choose storage and display formats by the meaning of the value, not by convenience in one language.

#### SQL trade dates

Use `DATE` for trade dates, report dates, settlement dates, and other calendar concepts.
Those values describe a day on a business calendar, not an instant on a clock, so adding time precision only invites off-by-one and midnight-boundary bugs.

#### SQL timestamps

Use `DATETIME2` for timestamps that are already normalized to UTC before insertion.
Use `DATETIMEOFFSET` when the incoming value must preserve its source offset or when downstream systems need offset-aware round-trips.

#### API payloads and log lines

Use ISO 8601 strings with `Z` or an explicit offset, for example `2026-03-10T15:30:00Z`.
Those values sort cleanly, parse predictably, and survive handoffs between SQL, Python, .NET, browsers, and queue consumers.

#### Filenames and partitions

Use UTC and a filesystem-safe shape such as `20260310` or `20260310_153000`.
Avoid locale-dependent separators and avoid local time in batch filenames unless the local business rule is explicitly part of the file contract.

#### Schedules and orchestration

Define cron, Airflow, and scheduler triggers in UTC unless the local business rule itself is contractual.
UTC schedules do not slide when DST starts or ends.

#### User-facing display

Render timestamps in the user's local timezone at the presentation edge.
Display formatting is a UI concern; storage and transport should stay in UTC or with explicit offsets.

#### Python runtime values

Use aware `datetime` values with `timezone.utc` or `ZoneInfo`.
Use `date` for calendar concepts and reserve naive datetimes for short-lived local calculations that never cross an interface boundary.

#### C# runtime values

Use `DateTimeOffset` for timestamps and `DateOnly` for calendar dates.
Avoid using `DateTime` as a serialized timestamp type because its `Kind` metadata is easy to lose during database and JSON round-trips.

## Linux date and time tools

GNU `date` handles formatting, parsing, arithmetic, and one-off timezone conversion.
`timedatectl` exposes the system timezone and is the correct surface for timezone changes that affect the whole host.

### Linux | date | formatting and parsing

This group focuses on display and parsing behavior rather than host configuration.
The examples use fixed values where determinism matters and preserve the valid captured outputs that were already present.

#### `date` prints the current local clock in the host timezone

Without a format string, `date` prints the current local time in the shell environment.
That output is useful for quick inspection, but pipelines should emit structured ISO forms instead.

```bash
date
```

```text
Tue Mar 10 16:30:00 CET 2026
```

#### `date +format` renders ISO, epoch, and filename-safe variants

Use `+format` for stable output shapes.
The fixed timestamp below makes the differences between local time, UTC, epoch seconds, and filename-safe strings explicit.

```bash
date -d "2026-03-10 16:30:00 +01:00" +%Y-%m-%d
date -ud "2026-03-10 15:30:00 UTC" "+%a %b %d %H:%M:%S UTC %Y"
date -ud "2026-03-10 15:30:00 UTC" +%Y-%m-%dT%H:%M:%SZ
date -d "2026-03-10 16:30:00 +01:00" +%Y-%m-%dT%H:%M:%S%z
date -ud "2026-03-10 15:30:00 UTC" +%s
date -ud "2026-03-10 15:30:00 UTC" +%Y%m%d
date -ud "2026-03-10 15:30:00 UTC" +%Y%m%d_%H%M%S
```

```text
2026-03-10
Tue Mar 10 15:30:00 UTC 2026
2026-03-10T15:30:00Z
2026-03-10T16:30:00+0100
1773156600
20260310
20260310_153000
```

#### `date -d "string"` parses ISO text and epoch values

GNU `date -d` accepts both human-readable timestamps and epoch inputs.
Use it for quick shell-side validation of timestamps before pushing the logic into a longer script.

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
1773156600
```

```bash
date -d "@1773156600" +%Y-%m-%dT%H:%M:%SZ
```

```text
2026-03-10T15:30:00Z
```

| Specifier | Output | Description |
|---|---|---|
| `%Y` | `2026` | 4-digit year |
| `%y` | `26` | 2-digit year |
| `%m` | `03` | Month 01-12 |
| `%b` | `Mar` | Abbreviated month name |
| `%B` | `March` | Full month name |
| `%d` | `10` | Day 01-31 |
| `%e` | ` 10` | Day 1-31 (space-padded) |
| `%H` | `15` | Hour 00-23 (24h) |
| `%I` | `03` | Hour 01-12 (12h) |
| `%p` | `PM` | AM/PM |
| `%M` | `30` | Minute 00-59 |
| `%S` | `00` | Second 00-59 |
| `%N` | `123456789` | Nanoseconds |
| `%3N` | `123` | Milliseconds |
| `%6N` | `123456` | Microseconds |
| `%z` | `+0100` | Timezone offset |
| `%Z` | `CET` | Timezone name |
| `%s` | `1773156600` | Unix epoch (seconds since 1970-01-01T00:00:00Z) |
| `%j` | `069` | Day of year 001-366 |
| `%u` | `2` | Day of week 1-7 (Mon=1, ISO) |
| `%A` | `Tuesday` | Full weekday name |
| `%a` | `Tue` | Abbreviated weekday name |
| `%W` | `10` | Week number of year (Mon as first day) |

### Linux | date | arithmetic and timezone

This group covers calendar arithmetic and timezone inspection.
For month- and DST-aware business logic, shell commands are useful for inspection, but Python or SQL are usually safer as the rule complexity grows.

#### `date -d` applies calendar arithmetic to fixed inputs

GNU `date` understands relative offsets such as `+7 days`, `+3 months`, and `90 minutes ago`.
Use explicit UTC markers when the input is an instant rather than a local wall-clock value.

```bash
date -d "2026-03-10 +7 days" +%Y-%m-%d
date -d "2026-03-10 -30 days" +%Y-%m-%d
date -d "2026-03-10 +3 months" +%Y-%m-%d
date -d "2026-03-10 +1 year" +%Y-%m-%d
date -ud "2026-03-10 15:30:00 UTC +5 hours" +%H:%M
date -ud "2026-03-10 15:30:00 UTC 90 minutes ago" +%H:%M
date -d "2026-03-10" +%Y-%m-01
date -d "2026-04-01 -1 day" +%Y-%m-%d
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

#### `TZ=zone date` converts a single timestamp without changing the host

Prefixing `TZ=` changes the timezone for one command only.
That is the safest way to inspect how one UTC instant lands in another region.

```bash
TZ=America/New_York date -d "2026-03-10T15:30:00 UTC" +%Y-%m-%dT%H:%M:%S\ %Z
TZ=Asia/Tokyo date -d "2026-03-10T15:30:00 UTC" +%Y-%m-%dT%H:%M:%S\ %Z
```

```text
2026-03-10T11:30:00 EDT
2026-03-11T00:30:00 JST
```

#### `timedatectl` shows the configured system timezone and available zone IDs

Use `timedatectl show` when you need a script-friendly answer and `timedatectl list-timezones` when you need valid identifiers.
Do not infer the host timezone from ad hoc string parsing of `date`.

```bash
timedatectl show --property=Timezone --value
timedatectl list-timezones | grep -E '^(UTC|Europe/Prague|America/New_York)$'
```

```text
Europe/Prague
America/New_York
Europe/Prague
UTC
```

#### `timedatectl set-timezone` must be followed by an explicit verification read

Timezone changes do not emit useful success text.
After a settings command, always run a verification command and capture the post-change state.

```bash
sudo timedatectl set-timezone UTC
timedatectl show --property=Timezone --value
```

```text
UTC
```

| Flag / Command | Syntax | Description |
|---|---|---|
| `TZ=zone` | `TZ=America/New_York date ...` | Override timezone for one command |
| `-d` | `date -d "string"` | Parse a date string (GNU `date` only) |
| `-u` | `date -u` | Output in UTC |
| `+format` | `date +%Y-%m-%d` | Custom output format |
| `timedatectl` | `timedatectl` | Show or change the system timezone |
| `list-timezones` | `timedatectl list-timezones` | List available IANA timezone names |
| `set-timezone` | `sudo timedatectl set-timezone UTC` | Set the persistent system timezone |

## PowerShell date and time tools

PowerShell date handling sits on top of .NET types.
`Get-Date` is convenient for shell work, while `DateTimeOffset`, `DateOnly`, and `TimeZoneInfo` handle the real semantics.

### PowerShell | Get-Date | formatting and parsing

These examples keep the inputs fixed so that the output demonstrates formatting behavior rather than whatever the local clock happened to be at runtime.
The same formatting rules apply to live values returned by `Get-Date`.

#### `Get-Date -Format` and `DateTimeOffset` render ISO, offset, epoch, and filename-safe values

Use `Get-Date -Format` for .NET format strings and `DateTimeOffset` when you need an explicit offset or epoch conversion.
This combination keeps shell output aligned with the underlying type system.

```powershell
Get-Date "2026-03-10T16:30:00" -Format "yyyy-MM-dd"
([DateTimeOffset]::Parse("2026-03-10T15:30:00Z")).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
[DateTimeOffset]::Parse("2026-03-10T16:30:00+01:00").ToString("yyyy-MM-ddTHH:mm:sszzz")
[DateTimeOffset]::Parse("2026-03-10T15:30:00Z").ToUnixTimeSeconds()
Get-Date "2026-03-10T16:30:00" -Format "yyyyMMdd_HHmmss"
```

```text
2026-03-10
2026-03-10T15:30:00Z
2026-03-10T16:30:00+01:00
1773156600
20260310_163000
```

#### `[datetime]::ParseExact()` and `DateTimeOffset.Parse()` parse explicit shapes safely

Use `ParseExact` when the input contract is fixed and `DateTimeOffset.Parse` when the source string already carries an offset.
Do not mix .NET format tokens with `strftime` tokens; `MM` is month and `mm` is minute.

```powershell
[DateTime]::ParseExact("2026-03-10", "yyyy-MM-dd", $null).ToString("yyyy-MM-dd")
[DateTimeOffset]::Parse("2026-03-10T15:30:00+01:00").ToString("o")
(Get-Date "2026-03-10").ToString("yyyy-MM-ddTHH:mm:ss")
```

```text
2026-03-10
2026-03-10T15:30:00.0000000+01:00
2026-03-10T00:00:00
```

| Specifier | Output | Description |
|---|---|---|
| `yyyy` | `2026` | 4-digit year |
| `yy` | `26` | 2-digit year |
| `MM` | `03` | Month 01-12 (uppercase) |
| `MMM` | `Mar` | Abbreviated month name |
| `MMMM` | `March` | Full month name |
| `dd` | `10` | Day 01-31 |
| `ddd` | `Tue` | Abbreviated weekday name |
| `dddd` | `Tuesday` | Full weekday name |
| `HH` | `15` | Hour 00-23 (24h) |
| `hh` | `03` | Hour 01-12 (12h) |
| `tt` | `PM` | AM/PM |
| `mm` | `30` | Minute 00-59 (lowercase) |
| `ss` | `00` | Second 00-59 |
| `fff` | `123` | Milliseconds |
| `ffffff` | `123456` | Microseconds |
| `K` | `+01:00` | Timezone offset when the value carries one |
| `zzz` | `+01:00` | Timezone offset with explicit sign |

### PowerShell | Get-Date | arithmetic and timezone

PowerShell arithmetic is clearer when the source value already contains the relevant time component.
Use `DateTimeOffset` when the instant must stay unambiguous across timezone conversions.

#### `.AddDays()`, `.AddMonths()`, and subtraction support calendar arithmetic directly

The `.Add*()` methods keep date arithmetic readable and keep the intent in code.
Subtracting two dates yields a `TimeSpan`, which is the correct type for interval results.

```powershell
$dt = Get-Date "2026-03-10T15:30:00"
$dt.AddDays(7).ToString("yyyy-MM-ddTHH:mm:ss")
$dt.AddDays(-30).ToString("yyyy-MM-ddTHH:mm:ss")
$dt.AddMonths(3).ToString("yyyy-MM-ddTHH:mm:ss")
$dt.AddHours(5).ToString("yyyy-MM-ddTHH:mm:ss")
$dt.AddMinutes(-90).ToString("yyyy-MM-ddTHH:mm:ss")
$dt.AddYears(1).ToString("yyyy-MM-ddTHH:mm:ss")
$start = Get-Date "2026-01-01T00:00:00"
$end = Get-Date "2026-03-10T00:00:00"
($end - $start).Days
($end - $start).TotalHours
```

```text
2026-03-17T15:30:00
2026-02-08T15:30:00
2026-06-10T15:30:00
2026-03-10T20:30:00
2026-03-10T14:00:00
2027-03-10T15:30:00
68
1632
```

#### `[TimeZoneInfo]::ConvertTime()` uses Windows timezone IDs and applies DST rules

PowerShell timezone conversion uses the Windows timezone database on Windows hosts.
Convert through `DateTimeOffset` or an explicitly UTC-tagged value so the source instant is not ambiguous.

```powershell
$utc = [DateTimeOffset]::Parse("2026-03-10T15:30:00+00:00")
[TimeZoneInfo]::ConvertTime($utc, [TimeZoneInfo]::FindSystemTimeZoneById("Eastern Standard Time")).ToString("o")
[TimeZoneInfo]::ConvertTime($utc, [TimeZoneInfo]::FindSystemTimeZoneById("Tokyo Standard Time")).ToString("o")
[TimeZoneInfo]::GetSystemTimeZones() |
    Where-Object { $_.Id -in "UTC", "Eastern Standard Time", "Tokyo Standard Time" } |
    Select-Object -ExpandProperty Id
```

```text
2026-03-10T11:30:00.0000000-04:00
2026-03-11T00:30:00.0000000+09:00
Eastern Standard Time
UTC
Tokyo Standard Time
```

#### Date component properties and deterministic filenames come from the same object

Read components such as `.Year` and `.DayOfYear` from the parsed value rather than reparsing strings.
Build filenames from the same source value when reproducibility matters.

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
"project_backup_$($d.ToString('yyyyMMdd_HHmmss')).bak"
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
project_backup_20260310_153045.bak
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
| `.DayOfWeek` | `$d.DayOfWeek` | Weekday name enum |
| `.DayOfYear` | `$d.DayOfYear` | Day number 1-366 |
| `ConvertTimeBySystemTimeZoneId` | `[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId(...)` | Convert between Windows timezone IDs |
| `GetSystemTimeZones()` | `[TimeZoneInfo]::GetSystemTimeZones()` | List available timezone IDs |

## SQL Server (T-SQL)

SQL Server date handling is primarily about type choice, explicit parsing, and disciplined UTC storage.
Use the database to validate incoming shapes and compute calendar boundaries, but keep timezone policy explicit.

### SQL Server | system functions and data types

This group separates system clock functions from type semantics.
The first example uses the live server clock because that is the point of the function family; the second uses fixed literals so the type differences stay obvious.

#### `GETUTCDATE()`, `SYSUTCDATETIME()`, and `SYSDATETIMEOFFSET()` reveal precision and offset behavior

`GETUTCDATE()` returns a legacy `datetime` value.
`SYSUTCDATETIME()` and `SYSDATETIMEOFFSET()` carry higher precision, and `SYSDATETIMEOFFSET()` also exposes the server offset.

```sql
SELECT 'getutcdate=' + CONVERT(varchar(33), GETUTCDATE(), 126)
UNION ALL
SELECT 'sysutcdatetime=' + CONVERT(varchar(33), SYSUTCDATETIME(), 126)
UNION ALL
SELECT 'sysdatetimeoffset=' + CONVERT(varchar(40), SYSDATETIMEOFFSET(), 126);
```

```text
getutcdate=2026-04-14T11:14:11.273
sysutcdatetime=2026-04-14T11:14:11.2744291
sysdatetimeoffset=2026-04-14T13:14:11.2744291+02:00
```

#### `DATE`, `DATETIME2`, and `DATETIMEOFFSET` store different levels of meaning

Use `DATE` for calendar dates, `DATETIME2` for UTC-normalized timestamps, and `DATETIMEOFFSET` when the stored value must preserve its source offset.
Avoid `DATETIME` for new schema design unless a legacy contract forces it.

```sql
SELECT 'trade_date=' + CONVERT(varchar(10), CAST('2026-03-10' AS date), 23)
UNION ALL
SELECT 'trade_ts_dt2=' + CONVERT(varchar(33), CAST('2026-03-10T15:30:00.1234567' AS datetime2(7)), 126)
UNION ALL
SELECT 'trade_ts_offset=' + CONVERT(varchar(40), CAST('2026-03-10T15:30:00.1234567+01:00' AS datetimeoffset(7)), 126);
```

```text
trade_date=2026-03-10
trade_ts_dt2=2026-03-10T15:30:00.1234567
trade_ts_offset=2026-03-10T15:30:00.1234567+01:00
```

### SQL Server | parsing, formatting, and arithmetic

The safest parse target is ISO 8601 input.
`CONVERT` style codes are still necessary when external sources insist on regional formats, and arithmetic functions stay correct only when you understand whether the operation is calendar-based or boundary-counting.

#### `CAST`, `CONVERT`, and style codes parse external strings

Prefer ISO 8601 input because it avoids style-code branching.
When legacy sources send region-specific formats, make the style code explicit and convert immediately to a real date or timestamp type.

```sql
SELECT 'cast_date=' + CONVERT(varchar(10), CAST('2026-03-10' AS date), 23)
UNION ALL
SELECT 'style_101=' + CONVERT(varchar(10), CONVERT(date, '03/10/2026', 101), 23)
UNION ALL
SELECT 'style_112=' + CONVERT(varchar(10), CONVERT(date, '20260310', 112), 23)
UNION ALL
SELECT 'fast_format=' + CONVERT(varchar(19), CAST('2026-03-10T15:30:00' AS datetime2(0)), 126);
```

```text
cast_date=2026-03-10
style_101=2026-03-10
style_112=2026-03-10
fast_format=2026-03-10T15:30:00
```

For large result sets, prefer `CONVERT` over `FORMAT()`.
`FORMAT()` is flexible, but it pays the cost of CLR formatting and is usually the wrong choice in a hot query path.

#### `DATEPART`, `DATETRUNC`, and `EOMONTH` expose boundaries and components

Use `DATENAME` when you need a stable weekday label and `DATETRUNC` or `EOMONTH` when you need reporting boundaries.
That keeps business calendars readable without string slicing.

```sql
DECLARE @d datetime2 = '2026-03-10T15:30:45';

SELECT 'weekday=' + DATENAME(WEEKDAY, @d)
UNION ALL
SELECT 'iso_week=' + CAST(DATEPART(ISO_WEEK, @d) AS varchar(10))
UNION ALL
SELECT 'day_of_year=' + CAST(DATEPART(DAYOFYEAR, @d) AS varchar(10))
UNION ALL
SELECT 'start_of_month=' + CONVERT(varchar(10), CAST(DATETRUNC(month, @d) AS date), 23)
UNION ALL
SELECT 'end_of_month=' + CONVERT(varchar(10), EOMONTH(@d), 23);
```

```text
weekday=Tuesday
iso_week=11
day_of_year=69
start_of_month=2026-03-01
end_of_month=2026-03-31
```

#### `DATEADD` shifts calendar values, while `DATEDIFF` counts boundaries

`DATEADD` is the right tool for offsets such as "plus seven days" or "minus 90 minutes".
`DATEDIFF` answers a different question:
it counts boundary crossings, which is why `DATEDIFF(year, '2025-12-31', '2026-01-01')` returns `1`.

```sql
SELECT 'add_day=' + CONVERT(varchar(10), DATEADD(day, 7, CAST('2026-03-10' AS date)), 23)
UNION ALL
SELECT 'add_month=' + CONVERT(varchar(10), DATEADD(month, 3, CAST('2026-03-10' AS date)), 23)
UNION ALL
SELECT 'add_hour=' + CONVERT(varchar(19), DATEADD(hour, 5, CAST('2026-03-10T15:30:00' AS datetime2(0))), 126)
UNION ALL
SELECT 'diff_days=' + CAST(DATEDIFF(day, '2026-01-01', '2026-03-10') AS varchar(10))
UNION ALL
SELECT 'boundary_year=' + CAST(DATEDIFF(year, '2025-12-31', '2026-01-01') AS varchar(10))
UNION ALL
SELECT 'trunc_hour=' + CONVERT(varchar(19), DATETRUNC(hour, CAST('2026-03-10T15:30:45' AS datetime2(0))), 126);
```

```text
add_day=2026-03-17
add_month=2026-06-10
add_hour=2026-03-10T20:30:00
diff_days=68
boundary_year=1
trunc_hour=2026-03-10T15:00:00
```

### SQL Server | timezone conversion and pipeline windows

Timezone conversion in SQL Server uses Windows timezone IDs through `AT TIME ZONE`.
For calendar windows and trading calendars, keep the filtering rule readable enough that the next operator can inspect it without reverse-engineering session settings.

#### `AT TIME ZONE` converts through named zones

Convert a UTC-normalized value by first tagging it as UTC and then converting it to the target zone.
That preserves DST behavior and avoids hard-coded numeric offsets.

> [!info] Gap and overlap semantics
>
> SQL Server applies Windows time-zone rules in `AT TIME ZONE`. If a naive `datetime` or `datetime2` lands in a spring-forward gap, SQL Server moves it forward and uses the post-change offset. If it lands in the autumn overlap, SQL Server presents it with the pre-change DST offset. For UTC-normalized data, attach `UTC` first and then convert.

```sql
DECLARE @utc datetime2 = '2026-03-10T15:30:00';

SELECT 'paris=' + CONVERT(varchar(40), @utc AT TIME ZONE 'UTC' AT TIME ZONE 'Central European Standard Time', 126)
UNION ALL
SELECT 'new_york=' + CONVERT(varchar(40), @utc AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time', 126)
UNION ALL
SELECT 'tokyo=' + CONVERT(varchar(40), @utc AT TIME ZONE 'UTC' AT TIME ZONE 'Tokyo Standard Time', 126);
```

```text
paris=2026-03-10T16:30:00+01:00
new_york=2026-03-10T11:30:00-04:00
tokyo=2026-03-11T00:30:00+09:00
```

#### `DATENAME(WEEKDAY, ...)` keeps calendar filters independent of `@@DATEFIRST`

Weekday numbers depend on `@@DATEFIRST`, but weekday names do not.
If a weekend filter must survive session defaults, either set `DATEFIRST` explicitly or filter on `DATENAME`.

```sql
WITH sample(trade_date) AS (
    SELECT CAST(v.trade_date AS date)
    FROM (VALUES ('2026-03-06'), ('2026-03-07'), ('2026-03-08'), ('2026-03-09')) AS v(trade_date)
)
SELECT 'business_day=' + CONVERT(varchar(10), trade_date, 23)
FROM sample
WHERE DATENAME(WEEKDAY, trade_date) NOT IN ('Saturday', 'Sunday')
UNION ALL
SELECT 'rolling_window_start=' + CONVERT(varchar(10), DATEADD(DAY, -30, CAST('2026-03-10' AS date)), 23);
```

```text
business_day=2026-03-06
business_day=2026-03-09
rolling_window_start=2026-02-08
```

## Python

Python date handling is safest when `date` and `datetime` are kept separate and every timestamp is timezone-aware.
The standard library is sufficient for most work; `dateutil` and `pandas` extend it where calendar logic becomes richer.

### Python | creation and parsing

Use constructors for clear, explicit values and parse helpers only at the edges.
That keeps source-of-truth types visible in the code path.

#### `date()`, `datetime()`, and `fromtimestamp()` create the right type for the job

Use `date` for calendar-only fields and aware `datetime` for instants.
For live UTC timestamps, prefer `datetime.now(timezone.utc)` over naive clock calls.

```python
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

print(date(2026, 3, 10).isoformat())
print(datetime(2026, 3, 10, 15, 30, tzinfo=timezone.utc).isoformat())
print(datetime(2026, 3, 10, 15, 30, tzinfo=ZoneInfo("Europe/Paris")).isoformat())
print(int(datetime(2026, 3, 10, 15, 30, tzinfo=timezone.utc).timestamp()))
```

```text
2026-03-10
2026-03-10T15:30:00+00:00
2026-03-10T15:30:00+01:00
1773156600
```

#### `strptime()`, `fromisoformat()`, `fromtimestamp()`, and `date.fromisoformat()` parse explicit input contracts

Use `strptime()` when the source contract is fixed and non-ISO.
Use `fromisoformat()` when the input is already ISO 8601, and always pass `tz=` when converting epoch values.

```python
from datetime import datetime, date, timezone

print(datetime.strptime("2026-03-10", "%Y-%m-%d").isoformat())
print(datetime.fromisoformat("2026-03-10T15:30:00+01:00").isoformat())
print(datetime.fromtimestamp(1773156600, tz=timezone.utc).isoformat())
print(date.fromisoformat("2026-03-10").isoformat())
```

```text
2026-03-10T00:00:00
2026-03-10T15:30:00+01:00
2026-03-10T15:30:00+00:00
2026-03-10
```

| Specifier | Output | Description |
|---|---|---|
| `%Y` | `2026` | 4-digit year |
| `%y` | `26` | 2-digit year |
| `%m` | `03` | Month 01-12 |
| `%b` | `Mar` | Abbreviated month name |
| `%B` | `March` | Full month name |
| `%d` | `10` | Day 01-31 |
| `%j` | `069` | Day of year 001-366 |
| `%H` | `15` | Hour 00-23 (24h) |
| `%I` | `03` | Hour 01-12 (12h) |
| `%p` | `PM` | AM/PM |
| `%M` | `30` | Minute 00-59 |
| `%S` | `00` | Second 00-59 |
| `%f` | `123456` | Microseconds |
| `%z` | `+0100` | UTC offset (+HHMM or +HH:MM) |
| `%Z` | `UTC` | Timezone name (output only - unreliable for parsing) |
| `%A` | `Tuesday` | Full weekday name |
| `%a` | `Tue` | Abbreviated weekday name |
| `%u` | `2` | Weekday 1-7 (Mon=1, ISO) |
| `%W` | `10` | Week number 00-53 (Mon as first day) |

### Python | formatting and arithmetic

Formatting and arithmetic should preserve the semantic distinction between an instant and a calendar date.
Use `timedelta` for fixed durations and `relativedelta` when the business rule is expressed in months or years.

#### `strftime()` and `isoformat()` generate transport-safe strings

`strftime()` is useful for controlled display and filenames.
`isoformat()` is the safest default for machine interchange because it preserves offset information automatically.

```python
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

dt = datetime(2026, 3, 10, 15, 30, tzinfo=timezone.utc)

print(dt.strftime("%Y-%m-%d"))
print(dt.strftime("%Y-%m-%dT%H:%M:%SZ"))
print(dt.astimezone(ZoneInfo("Europe/Paris")).strftime("%Y-%m-%dT%H:%M:%S%z"))
print(dt.strftime("%Y%m%d_%H%M%S"))
print(dt.isoformat())
```

```text
2026-03-10
2026-03-10T15:30:00Z
2026-03-10T16:30:00+0100
20260310_153000
2026-03-10T15:30:00+00:00
```

#### `timedelta` handles fixed durations, and `relativedelta` handles calendar shifts

Use `timedelta` for days, hours, and minutes.
Use `dateutil.relativedelta` when the business rule is "plus three months" or "end of next month", because calendar months do not all have the same length.

```python
from datetime import date, datetime, timedelta, timezone
from dateutil.relativedelta import relativedelta

d = date(2026, 3, 10)
dt = datetime(2026, 3, 10, 15, 30, tzinfo=timezone.utc)

print((d + timedelta(days=7)).isoformat())
print((d - timedelta(days=30)).isoformat())
print((dt + timedelta(hours=5)).isoformat())
print((dt - timedelta(minutes=90)).isoformat())
print((d + relativedelta(months=3)).isoformat())
print((d + relativedelta(years=1)).isoformat())
print((date(2026, 3, 10) - date(2026, 1, 1)).days)
print((date(2026, 1, 31) + relativedelta(months=1)).isoformat())
```

```text
2026-03-17
2026-02-08
2026-03-10T20:30:00+00:00
2026-03-10T14:00:00+00:00
2026-06-10
2027-03-10
68
2026-02-28
```

### Python | timezone conversion and ranges

`zoneinfo` is the correct standard-library surface for named timezones.
For calendar ranges and business-day sequences, pair the standard library with `pandas` only when the range logic justifies the dependency.

#### `ZoneInfo` converts through named zones instead of hard-coded offsets

Converting through named zones preserves DST behavior and date rollovers automatically.
That matters whenever one UTC instant must be shown in several markets.

```python
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, available_timezones

dt = datetime(2026, 3, 10, 15, 30, tzinfo=timezone.utc)

print(dt.astimezone(ZoneInfo("Europe/Paris")).isoformat())
print(dt.astimezone(ZoneInfo("America/New_York")).isoformat())
print(dt.astimezone(ZoneInfo("Asia/Tokyo")).isoformat())
for tz in ["Europe/Paris", "America/New_York", "Asia/Tokyo"]:
    print(tz if tz in available_timezones() else f"missing:{tz}")
```

```text
2026-03-10T16:30:00+01:00
2026-03-10T11:30:00-04:00
2026-03-11T00:30:00+09:00
Europe/Paris
America/New_York
Asia/Tokyo
```

#### `monthrange()` and `pandas.date_range()` generate month ends and business-day series

Use the standard library for month boundaries and bring in `pandas` when you need dense trading-day or reporting calendars.
That split keeps small scripts light without giving up richer range generation in data work.

```python
from datetime import date
from calendar import monthrange
import pandas as pd

first_of_month = date(2026, 3, 10).replace(day=1)
_, last_day = monthrange(2026, 3)
end_of_month = date(2026, 3, last_day)

print(first_of_month.isoformat())
print(end_of_month.isoformat())
print(pd.date_range("2026-03-01", "2026-03-10", freq="B").strftime("%Y-%m-%d").tolist())
```

```text
2026-03-01
2026-03-31
['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10']
```

## C# (.NET)

In .NET, type choice decides whether a value is a calendar date, a local timestamp, or an offset-bearing instant.
`DateTimeOffset` and `DateOnly` should carry most of the pipeline workload.

### C# | core types and parsing

The key distinction is between calendar dates and instants.
That distinction should be obvious from the chosen type before any serialization logic is added.

#### `DateOnly`, `DateTimeOffset`, and `FromUnixTimeSeconds()` separate dates from instants

Use `DateOnly` for date-only fields and `DateTimeOffset` for instants.
`FromUnixTimeSeconds()` is the clean bridge from epoch-based payloads into typed .NET values.

```csharp
using System;

var tradeDate = new DateOnly(2026, 3, 10);
var tradeStamp = new DateTimeOffset(2026, 3, 10, 15, 30, 0, TimeSpan.FromHours(1));
var utcStamp = DateTimeOffset.FromUnixTimeSeconds(1773156600);

Console.WriteLine(tradeDate.ToString("yyyy-MM-dd"));
Console.WriteLine(tradeStamp.ToString("o"));
Console.WriteLine(utcStamp.ToString("o"));
```

```text
2026-03-10
2026-03-10T15:30:00.0000000+01:00
2026-03-10T15:30:00.0000000+00:00
```

#### `ParseExact()` and `TryParseExact()` validate external text contracts

Use `ParseExact` or `TryParseExact` when the input contract is fixed.
Use `DateTimeOffset.Parse` when the source string already includes its offset and should stay offset-aware.

```csharp
using System;
using System.Globalization;

var isoDate = DateOnly.Parse("2026-03-10", CultureInfo.InvariantCulture);
var dto = DateTimeOffset.Parse("2026-03-10T15:30:00+01:00", CultureInfo.InvariantCulture);
DateTime.TryParseExact("20260310", "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var compact);

Console.WriteLine(isoDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
Console.WriteLine(dto.ToString("o", CultureInfo.InvariantCulture));
Console.WriteLine(compact.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
```

```text
2026-03-10
2026-03-10T15:30:00.0000000+01:00
2026-03-10
```

| Specifier | Output | Description |
|---|---|---|
| `yyyy` | `2026` | 4-digit year |
| `yy` | `26` | 2-digit year |
| `MM` | `03` | Month 01-12 (uppercase) |
| `MMM` | `Mar` | Abbreviated month name |
| `MMMM` | `March` | Full month name |
| `dd` | `10` | Day 01-31 |
| `ddd` | `Tue` | Abbreviated weekday name |
| `dddd` | `Tuesday` | Full weekday name |
| `HH` | `15` | Hour 00-23 (24h) |
| `hh` | `03` | Hour 01-12 (12h) |
| `tt` | `PM` | AM/PM |
| `mm` | `30` | Minute 00-59 (lowercase) |
| `ss` | `00` | Second 00-59 |
| `fff` | `123` | Milliseconds |
| `ffffff` | `123456` | Microseconds |
| `K` | `+01:00` | Timezone offset when the type carries one |
| `zzz` | `+01:00` | Timezone offset with explicit sign |
| `o` | `2026-03-10T15:30:00.0000000+01:00` | Round-trip ISO 8601 format |
| `s` | `2026-03-10T15:30:00` | Sortable ISO 8601 without offset |

### C# | formatting and arithmetic

Formatting and arithmetic stay reliable when the source type matches the meaning of the value.
Do not use `DateTime` plus comments as a substitute for a real offset-bearing type.

#### `ToString()` emits ISO, round-trip, and filename-safe forms

The built-in format strings are sufficient for most pipeline output.
Use round-trip format `o` when the value must survive serialization and reparse without loss.

```csharp
using System;
using System.Globalization;

var dt = new DateTimeOffset(2026, 3, 10, 15, 30, 0, TimeSpan.FromHours(1));

Console.WriteLine(dt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
Console.WriteLine(dt.ToString("yyyy-MM-ddTHH:mm:sszzz", CultureInfo.InvariantCulture));
Console.WriteLine(dt.ToString("o", CultureInfo.InvariantCulture));
Console.WriteLine(dt.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture));
Console.WriteLine(dt.ToString("yyyyMMdd_HHmmss", CultureInfo.InvariantCulture));
```

```text
2026-03-10
2026-03-10T15:30:00+01:00
2026-03-10T15:30:00.0000000+01:00
2026-03-10T14:30:00Z
20260310_153000
```

#### `AddDays()`, `AddMonths()`, and subtraction stay calendar-aware

`DateOnly` handles calendar math without dragging a time component into the rule.
`DateTimeOffset` handles instant math without losing the offset.

```csharp
using System;
using System.Globalization;

var d = new DateOnly(2026, 3, 10);
var dto = new DateTimeOffset(2026, 3, 10, 15, 30, 0, TimeSpan.Zero);

Console.WriteLine(d.AddDays(7).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
Console.WriteLine(d.AddDays(-30).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
Console.WriteLine(d.AddMonths(3).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
Console.WriteLine(d.AddYears(1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
Console.WriteLine(dto.AddHours(5).ToString("o", CultureInfo.InvariantCulture));
Console.WriteLine(dto.AddMinutes(-90).ToString("o", CultureInfo.InvariantCulture));
Console.WriteLine((new DateTime(2026, 3, 10) - new DateTime(2026, 1, 1)).Days);
```

```text
2026-03-17
2026-02-08
2026-06-10
2027-03-10
2026-03-10T20:30:00.0000000+00:00
2026-03-10T14:00:00.0000000+00:00
68
```

### C# | timezone conversion and display patterns

Timezone conversion on Windows uses Windows timezone IDs.
Display logic should keep timestamps, dates, and times in separate types until the final render step.

#### `TimeZoneInfo.ConvertTime()` applies Windows timezone rules to a fixed UTC instant

Use named timezones, not hard-coded offsets.
That lets .NET apply the correct DST rule for the target zone.

```csharp
using System;
using System.Globalization;

var utc = DateTimeOffset.Parse("2026-03-10T15:30:00+00:00", CultureInfo.InvariantCulture);
var paris = TimeZoneInfo.FindSystemTimeZoneById("Central European Standard Time");
var ny = TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time");
var tokyo = TimeZoneInfo.FindSystemTimeZoneById("Tokyo Standard Time");

Console.WriteLine(TimeZoneInfo.ConvertTime(utc, paris).ToString("o", CultureInfo.InvariantCulture));
Console.WriteLine(TimeZoneInfo.ConvertTime(utc, ny).ToString("o", CultureInfo.InvariantCulture));
Console.WriteLine(TimeZoneInfo.ConvertTime(utc, tokyo).ToString("o", CultureInfo.InvariantCulture));
Console.WriteLine(paris.Id);
Console.WriteLine(ny.Id);
Console.WriteLine(tokyo.Id);
```

```text
2026-03-10T16:30:00.0000000+01:00
2026-03-10T11:30:00.0000000-04:00
2026-03-11T00:30:00.0000000+09:00
Central European Standard Time
Eastern Standard Time
Tokyo Standard Time
```

#### `DateOnly` and `TimeOnly` keep dashboard logic separate from timestamps

Use `DateOnly` for business dates, `TimeOnly` for local session hours, and `DateTimeOffset` only when you need an actual instant.
That split keeps dashboard code from reintroducing timestamp bugs into date-only business rules.

```csharp
using System;
using System.Globalization;

var tradeDate = new DateOnly(2026, 3, 10);
var timestamp = DateTimeOffset.Parse("2026-03-10T15:30:00Z", CultureInfo.InvariantCulture);
var paris = TimeZoneInfo.FindSystemTimeZoneById("Central European Standard Time");
var marketOpen = new TimeOnly(9, 0);
var marketClose = new TimeOnly(17, 30);
var currentTime = new TimeOnly(16, 15);
var lastBusinessDay = new DateOnly(2026, 3, 8);

while (lastBusinessDay.DayOfWeek == DayOfWeek.Saturday || lastBusinessDay.DayOfWeek == DayOfWeek.Sunday)
{
    lastBusinessDay = lastBusinessDay.AddDays(-1);
}

Console.WriteLine(tradeDate.ToString("dd MMM yyyy", CultureInfo.InvariantCulture));
Console.WriteLine(TimeZoneInfo.ConvertTime(timestamp, paris).ToString("dd MMM yyyy HH:mm zzz", CultureInfo.InvariantCulture));
Console.WriteLine(currentTime >= marketOpen && currentTime <= marketClose);
Console.WriteLine(lastBusinessDay.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
```

```text
10 Mar 2026
10 Mar 2026 16:30 +01:00
True
2026-03-06
```

## DST failure modes and operating rules

DST bugs are not theoretical edge cases.
They appear in daily schedules, rolling windows, deduplication keys, and multi-market comparisons whenever local clock time is treated as if it were a stable global coordinate.

### Python | DST | failure modes

Python's timezone model is expressive enough to make the common DST defects visible in one screen.
The same defects apply to shell schedules, SQL windows, and application runtimes.

#### Civil days are not always 24 hours

When Europe moves into summer time, the local day that starts on `2026-03-29` contains only 23 clock-hours.
That is why "subtract 24 hours" is not the same rule as "move to the previous local calendar day".

```python
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

paris = ZoneInfo("Europe/Paris")
start = datetime(2026, 3, 29, 0, 0, tzinfo=paris)
end = datetime(2026, 3, 30, 0, 0, tzinfo=paris)

print(start.astimezone(timezone.utc).isoformat())
print(end.astimezone(timezone.utc).isoformat())
print((end.astimezone(timezone.utc) - start.astimezone(timezone.utc)).total_seconds() / 3600)
```

```text
2026-03-28T23:00:00+00:00
2026-03-29T22:00:00+00:00
23.0
```

#### A local clock time can occur twice

During autumn fallback, the same local label can map to two different instants.
Without an offset, `2026-11-01 01:30` in New York is ambiguous.

```python
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

ny = ZoneInfo("America/New_York")
first = datetime(2026, 11, 1, 1, 30, tzinfo=ny, fold=0)
second = datetime(2026, 11, 1, 1, 30, tzinfo=ny, fold=1)

print(first.isoformat())
print(first.astimezone(timezone.utc).isoformat())
print(second.isoformat())
print(second.astimezone(timezone.utc).isoformat())
```

```text
2026-11-01T01:30:00-04:00
2026-11-01T05:30:00+00:00
2026-11-01T01:30:00-05:00
2026-11-01T06:30:00+00:00
```

#### Paris and New York do not stay six hours apart all year

US and European DST transitions do not occur on the same dates.
For several weeks each year, the offset between Paris and New York is five hours instead of six.

```python
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

paris = ZoneInfo("Europe/Paris")
new_york = ZoneInfo("America/New_York")

for label, utc_dt in [
    ("2026-03-20", datetime(2026, 3, 20, 12, 0, tzinfo=timezone.utc)),
    ("2026-04-02", datetime(2026, 4, 2, 12, 0, tzinfo=timezone.utc)),
]:
    paris_dt = utc_dt.astimezone(paris)
    ny_dt = utc_dt.astimezone(new_york)
    delta_hours = (paris_dt.utcoffset() - ny_dt.utcoffset()).total_seconds() / 3600
    print(f"{label} paris={paris_dt.strftime('%H:%M %z')} new_york={ny_dt.strftime('%H:%M %z')} delta_hours={delta_hours:.0f}")
```

```text
2026-03-20 paris=13:00 +0100 new_york=08:00 -0400 delta_hours=5
2026-04-02 paris=14:00 +0200 new_york=08:00 -0400 delta_hours=6
```

### Cross-platform | DST | operating rules

The demonstrations above justify a small set of operating rules that should be enforced across every platform in the note.

#### Store instants in UTC

Persist internal timestamps, log lines, and scheduler watermarks in UTC.
UTC removes DST jumps from storage and lets every runtime convert from the same canonical instant.

#### Convert to local time only at the edge

Dashboards, emails, and exchange-facing reports can render local time, but the stored record should remain UTC or offset-bearing.
That keeps storage rules simple and makes replay and cross-region debugging possible.

#### Use date-only types for calendar concepts

Trade dates, statement dates, and report dates should use `DATE`, `date`, or `DateOnly`.
Those values describe a civil day, not a moment on a clock, so timestamp arithmetic is the wrong tool.

#### Persist timezone names when future interpretation matters

An offset such as `+01:00` is only the result of a timezone rule at one moment.
If future reconversion, legal-time display, or exchange schedule logic matters, keep the named timezone as well.

#### Test March and autumn boundary weekends explicitly

DST regressions usually hide until one or two weekends per year.
Include those weekends in automated tests, especially for daily windowing, end-of-day jobs, and multi-market comparisons.

## Recommendations

The platform sections above show the mechanics.
Use the following operational defaults when you need a quick design answer.

### Storage and interchange defaults

#### Use ISO 8601 with `Z` or an explicit offset for exchanged timestamps

APIs, queue payloads, and log lines should carry timestamps such as `2026-03-10T15:30:00Z` or `2026-03-10T15:30:00+01:00`.
That keeps the payload self-describing across SQL Server, Python, .NET, and shell tooling.

#### Use `DATE`, `date`, or `DateOnly` for calendar-only values

If the business concept is a day on a calendar, store a date-only value.
That removes false midnight semantics and avoids DST-related off-by-one defects.

### Scheduling and shell defaults

#### Anchor schedules and filenames in UTC

Use UTC for cron, orchestration schedules, and timestamped filenames.
The Linux and PowerShell examples above show how to format UTC values cleanly for those surfaces.

#### Use calendar-aware arithmetic instead of fixed-second subtraction

"Previous business day" and "previous calendar day" are not the same as subtracting 24 hours or 86,400 seconds.
Use `DATEADD`, `timedelta(days=1)`, `.AddDays()`, or business-calendar tables depending on the platform.

### Runtime and database defaults

#### Prefer `DATETIMEOFFSET` and `DateTimeOffset` when offsets must survive round-trips

Those types preserve the offset through storage, serialization, and reparse.
Use them when the source system or contract requires offset fidelity.

#### Prefer `ZoneInfo` and `TimeZoneInfo` over hard-coded offsets

Named zones carry the actual rule set.
That is the only safe way to survive DST transitions and cross-market comparisons.

## Troubleshooting

Treat these as diagnosis patterns rather than generic tips.
Each symptom maps back to a concrete failure mode already demonstrated above.

### Shell and scheduler defects

#### A daily job processes 23 or 25 hours of data

The window logic is probably subtracting fixed hours across a DST boundary instead of moving by calendar day.
Use the DST demonstrations above as the regression case and switch to calendar-aware date arithmetic.

#### `date -d "yesterday"` fails on macOS

BSD `date` does not implement GNU `-d`.
Use `date -v-1d` on macOS, install GNU coreutils and call `gdate`, or move the logic into Python for portability.

### Parsing and formatting defects

#### Epoch conversion lands in the wrong year

The input is almost certainly milliseconds being treated as seconds, or the reverse.
Check the digit count before conversion:
10 digits usually means seconds, 13 digits usually means milliseconds.

#### Timestamps do not sort in textual order

The stored string is probably locale-dependent, such as `03/10/2026`.
Switch to ISO 8601 so lexical order matches chronological order.

#### `Get-Date -Format` prints minutes where the month should be

The format string used `mm` instead of `MM`.
In .NET formatting, `MM` is month and `mm` is minute.

### Timestamp identity defects

#### One local timestamp appears twice in the source data

That is usually an autumn fallback event where the same local clock label refers to two different instants.
Store the offset or normalize to UTC before deduplicating.

#### Cross-market comparisons drift by one hour for a few weeks

The code assumed a fixed offset between two non-UTC zones.
Convert both zones through UTC and compare named timezone conversions instead of hard-coding the relationship.

## Cross-references

- [text processing tools](https://alp78.github.io/elysium/01-Shell/Text-Processing/grep-and-pattern-matching) - JSON and CSV parsing in Bash, jq, Python, and PowerShell
- [serialization-formats](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/serialization-formats) - format tradeoffs for JSON, CSV, Parquet, Avro, and other interchange layers
- [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) - pipeline design patterns that survive date boundaries and replays

## References

- [ISO 8601 Standard](https://www.iso.org/iso-8601-date-and-time-format.html)
- [Python `zoneinfo` docs](https://docs.python.org/3/library/zoneinfo.html)
- [SQL Server `AT TIME ZONE`](https://learn.microsoft.com/en-us/sql/t-sql/queries/at-time-zone-transact-sql)
- [.NET `DateTimeOffset`](https://learn.microsoft.com/en-us/dotnet/api/system.datetimeoffset)
- [dateutil `relativedelta`](https://dateutil.readthedocs.io/en/stable/relativedelta.html)
