---
title: "11 - DateTime, Math & Utilities - Python"
tags: [python]
aliases: [datetime, timezones, date arithmetic, math operations, utility functions]
description: "Python date, time, math and utilities reference with executable examples and cell outputs — covers datetime, timezones, timedelta, math, random, and common utility functions. See [11-cs-datetimemathutils](https://alp78.github.io/elysium/02-Programming-Languages/02-CSharp/11-cs-datetimemathutils) for the C# equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# DateTime, Math & Utilities - Python

> [!quote]+
>
> "There are two hard problems in datetime handling: timezone conversions, daylight saving transitions, and off-by-one errors."
>
> — **Jon Skeet**

> [!abstract]- Summary
>
> - **Date and Time** — `datetime`, `date`, `time`, and `timedelta` are the core stdlib types. Always store timestamps in UTC (`datetime.now(timezone.utc)`); convert to local time for display only using `zoneinfo.ZoneInfo` (Python 3.9+). `strftime`/`strptime` handle string ↔ datetime conversion; `.isoformat()` / `.fromisoformat()` handle ISO 8601. `dateutil.relativedelta` extends `timedelta` for month/year arithmetic.
> - **Math and Random** — `math` provides `floor`, `ceil`, `sqrt`, `log`, `pow`, trig functions, and special values (`inf`, `nan`). Python's `round()` uses banker's rounding (round-half-to-even). `random` generates reproducible pseudorandom values (seed with `random.seed(n)`); use `secrets` for cryptographically secure tokens. `statistics` covers mean, median, stdev, and quantiles.
> - **Logging** — `logging` module with hierarchical loggers (`logging.getLogger(__name__)`), configurable handlers (StreamHandler, FileHandler), and formatters. Use `%(asctime)s [%(levelname)-8s]` for human-readable output and a custom `JsonFormatter` for machine-parseable production logs. Use %-style lazy evaluation in log calls; call `basicConfig` once at the entry point only.
> - **Configuration** — `os.environ` / `os.getenv` for environment variables; `configparser` for INI files (all values are strings — use `.getint()`, `.getboolean()`); `tomllib` (Python 3.11+, read-only built-in) for TOML files with native type preservation; `python-dotenv` for `.env` files in local development. Never commit secrets to source control.

> [!note]- Glossary
>
> **`datetime`**
> - Python class representing a calendar date combined with a time of day, optionally with timezone information.
> - Used as the standard timestamp type in Python for storing points in time, comparing timestamps, formatting them, and doing date/time arithmetic.
>
> > [!warning] Naive vs aware mismatch
> >
> > Comparing or subtracting a naive `datetime` and an aware `datetime` raises `TypeError`. Keep a consistent timezone model throughout the pipeline, ideally with aware UTC timestamps for storage and interchange.
>
> ---
>
> **Naive datetime**
> - A `datetime` object whose `tzinfo` is `None`, meaning it carries no timezone or UTC-offset context.
> - Used only when the timestamp is intentionally local and self-contained; otherwise it is a common source of ambiguity and cross-system bugs.
>
> > [!warning] Naive timestamps are ambiguous outside their local context
> >
> > A naive value such as `2024-03-15 02:30:00` does not identify a unique instant unless the relevant timezone rules are known separately. Avoid storing naive datetimes in systems that cross machines, regions, or DST boundaries.
>
> ---
>
> **Aware datetime**
> - A `datetime` object that carries timezone information through a `tzinfo` value, making it interpretable as a specific instant in time.
> - Used for reliable comparison, arithmetic, storage, and exchange across systems operating in different timezones.
>
> > [!info] Attach timezone at creation when possible
> >
> > Prefer creating an aware `datetime` directly, such as `datetime.now(timezone.utc)` or `datetime(..., tzinfo=ZoneInfo("Europe/Amsterdam"))`, rather than attaching timezone metadata later to a naive value whose meaning may already be ambiguous.
>
> ---
>
> **`timedelta`**
> - Python class representing a fixed duration, internally stored as days, seconds, and microseconds.
> - Used for adding or subtracting fixed spans such as hours, days, or weeks, and for representing the result of subtracting two datetimes.
>
> > [!warning] No months or years
> >
> > `timedelta` represents fixed-length durations only. It cannot model calendar concepts such as "one month" or "one year" because those vary in real length.
>
> ---
>
> **`timezone.utc`**
> - Built-in UTC timezone singleton provided by the `datetime` module.
> - Used as the simplest standard-library way to create or convert aware UTC datetimes without requiring third-party timezone libraries.
>
> > [!info] UTC is the safest canonical storage basis
> >
> > Storing timestamps in UTC avoids daylight-saving ambiguity and makes cross-system comparison straightforward. Convert to local time only when presenting data to users or region-specific systems.
>
> ---
>
> **`zoneinfo.ZoneInfo`**
> - Standard-library timezone class backed by the IANA timezone database, available in Python 3.9 and later.
> - Used to represent real named timezones such as `Europe/Amsterdam` or `America/Chicago`, including their DST and historical offset rules.
>
> > [!warning] Prefer named zones over hardcoded offsets for civil time
> >
> > Fixed offsets cannot express DST transitions or historical timezone changes. Use `ZoneInfo("Region/City")` when the local civil timezone matters, not just the current offset.
>
> ---
>
> **`strftime` / `strptime`**
> - Formatting and parsing APIs for converting between `datetime` values and strings using format codes such as `%Y`, `%m`, `%d`, `%H`, `%M`, `%S`, and `%z`.
> - Used when timestamps must be rendered in a required textual format or parsed from text that is not already ISO 8601.
>
> > [!info] `strptime` is aware only if the format includes timezone data
> >
> > `datetime.strptime()` returns a naive `datetime` unless the format includes timezone information such as `%z`, in which case it returns an aware value with a fixed offset.
>
> ---
>
> **ISO 8601**
> - International standard for unambiguous textual date and time representations, including forms such as `2024-01-15T10:30:00+00:00`.
> - Used as the default interchange format for APIs, logs, databases, and serialized payloads because it is machine-readable and locale-independent.
>
> > [!warning] Naive ISO strings omit timezone context
> >
> > A string such as `2024-03-15T00:00:00` is still ambiguous if no offset or timezone context is included. For interchange, prefer timestamps that include `Z` or an explicit numeric offset.
>
> ---
>
> **`dateutil.relativedelta`**
> - Calendar-aware interval type from the `python-dateutil` package that can represent variable-length units such as months and years.
> - Used when business rules depend on calendar arithmetic rather than fixed durations, such as "one month later" or "same day next year."
>
> > [!info] Separate dependency
> >
> > `dateutil.relativedelta` is not part of the Python standard library. Add `python-dateutil` explicitly when the project needs calendar-aware arithmetic beyond `timedelta`.
>
> ---
>
> **Unix timestamp**
> - Numeric count of elapsed time since the Unix epoch, `1970-01-01 00:00:00 UTC`, commonly represented in seconds and sometimes in milliseconds.
> - Used for compact storage, numeric comparison, and cross-system interchange when a single absolute point in time must be represented efficiently.
>
> > [!warning] Always specify the timezone when converting back
> >
> > `datetime.fromtimestamp(ts)` without `tz=` uses the local system timezone. Pass `tz=timezone.utc` or another explicit timezone to get consistent results across machines.
>
> ---
>
> **`math` module**
> - Python standard-library module providing mathematical functions and constants beyond the built-in arithmetic operators.
> - Used for numeric transformations such as rounding control, logarithms, trigonometry, square roots, infinity checks, and NaN handling.
>
> > [!warning] `round()` is not in `math` and uses round-half-to-even
> >
> > Python's built-in `round()` uses banker's rounding for ties. When exact decimal rounding rules matter, use `Decimal` with an explicit rounding mode instead of assuming schoolbook half-up behavior.
>
> ---
>
> **`Decimal`**
> - Exact base-10 decimal numeric type from Python's `decimal` module, designed to avoid binary floating-point representation error.
> - Used for financial and other precision-sensitive calculations where tiny rounding differences from binary floats are unacceptable.
>
> > [!warning] Construct from strings, not binary floats
> >
> > `Decimal(0.1)` imports the inexact value already present in the float. `Decimal("0.1")` preserves the intended decimal value exactly.
>
> ---
>
> **`random` module**
> - Python standard-library module providing pseudorandom number generation based on a deterministic algorithm.
> - Used for simulation, randomized testing, sampling, shuffling, and any workflow where reproducible non-secure randomness is useful.
>
> > [!warning] Not cryptographically secure
> >
> > The `random` module is designed for statistical and simulation use, not adversarial security contexts. Do not use it for tokens, passwords, secrets, or security-sensitive identifiers.
>
> ---
>
> **`secrets` module**
> - Python standard-library module for generating cryptographically strong random values using the operating system's secure random source.
> - Used for passwords, tokens, salts, nonces, and any value that must be unpredictable to an attacker.
>
> > [!info] `secrets` vs `random`
> >
> > Use `random` for reproducible or simulation-oriented randomness. Use `secrets` whenever unpredictability is a security requirement.
>
> ---
>
> **`logging` module**
> - Python standard-library framework for structured, level-based application logging through loggers, handlers, formatters, and filters.
> - Used to emit diagnosable runtime events with timestamps, severity, routing, and formatting that can be controlled per module or per deployment environment.
>
> > [!warning] `print()` is not a logging framework
> >
> > `print()` has no severity levels, handler routing, or central configuration. For production code, use `logging.getLogger(__name__)` and configure handlers explicitly.
>
> ---
>
> **`os.environ`**
> - Dictionary-like mapping exposing the current process environment variables to Python code.
> - Used to read required or optional runtime configuration injected from the shell, orchestrator, CI/CD system, or secret-management layer.
>
> > [!warning] Changes affect the current process and its future children only
> >
> > Assigning to `os.environ` changes the environment seen by the running Python process and any child processes it starts later. It does not modify the parent shell or persist after the process exits.
>
> ---
>
> **`configparser`**
> - Python standard-library parser for INI-style configuration files with sections and key-value pairs.
> - Used when applications need simple human-editable config files and can tolerate string-oriented values with explicit conversion where needed.
>
> > [!info] Values are string-based unless converted
> >
> > `configparser` reads textual configuration, so typed access usually requires methods such as `.getint()`, `.getfloat()`, or `.getboolean()` rather than assuming native types automatically.
>
> ---
>
> **`tomllib`**
> - Python 3.11+ standard-library parser for TOML configuration files, returning ordinary Python data structures.
> - Used when a project wants richer configuration typing than INI while staying within the standard library for read operations.
>
> > [!info] Read-only by design
> >
> > `tomllib` parses TOML but does not write it. Use a separate library if the project must generate or update TOML files programmatically.
>
> ---
>
> **`.env` file**
> - Plain-text file conventionally containing `KEY=VALUE` entries used to supply environment variables during development or controlled runtime setup.
> - Used to keep configuration and secrets out of source code while still making them available to the process environment through an explicit loader.
>
> > [!danger] Never commit `.env` files containing secrets
> >
> > Once a secret is committed, it may remain recoverable from history, forks, or mirrors even after deletion. Treat committed secrets as exposed and rotate them immediately.

## Date and Time

Python's `datetime` module provides `datetime` (date + time), `date` (date only), `time` (time only), and `timedelta` (intervals). Naive datetimes have no timezone; always use `datetime.now(timezone.utc)` for storage and `zoneinfo.ZoneInfo` (Python 3.9+) for timezone-aware local times.

### Creating date and time objects

#### datetime module — creating date, time, datetime, timedelta objects

> [!info] Date and time types
>
> - `datetime.now()` — local time | `datetime.now(timezone.utc)` — UTC
> - `date.today()` — date-only | `time()` — time-only
> - `timedelta` — arithmetic (add/subtract days, hours, seconds)
> - Naive datetimes have no timezone; aware ones include `tzinfo`

> [!warning] Anti-patterns
>
> - **`datetime.now()` for storage** — timezone-naive; use `datetime.now(timezone.utc)`
> - **Comparing naive and aware** datetimes — raises `TypeError`

> [!success] Best practices
>
> - Always store and transmit datetimes as UTC: `datetime.now(timezone.utc)`
> - Use `zoneinfo.ZoneInfo` (Python 3.9+) for timezone-aware local times
> - Keep datetimes aware throughout the pipeline; convert to local time only for display

*Example: datetime module — creating date, time, datetime, timedelta objects.*
```python
# Creating date and time objects
from datetime import datetime, date, time, timedelta

# Current date and time
from collections import Counter
from datetime import timedelta
from datetime import timezone
from dateutil.relativedelta import relativedelta
from zoneinfo import ZoneInfo  # Python 3.9+ (built-in)
import configparser
import json
import logging
import math
import os
import random
import shutil
import statistics
import sys
import tempfile
import time
import tomllib  # read-only, built-in since Python 3.11
now = datetime.now()             # local time (naive - no timezone)
today = date.today()             # date only
current_time = datetime.now().time()  # time only

now  # datetime.now()
today  # date.today()
current_time  # time now
type(now)  # type

# Creating specific dates/times
dt = datetime(2024, 3, 15, 14, 30, 45)       # year, month, day, hour, min, sec
d = date(2024, 3, 15)                         # year, month, day
t = time(14, 30, 45)                          # hour, min, sec
dt_micro = datetime(2024, 3, 15, 14, 30, 45, 123456)  # with microseconds

dt  # Specific datetime
d  # Specific date
t  # Specific time
dt_micro  # With microseconds
```

```text
2026-03-25 05:48:19.510467
2026-03-25
05:48:19.510467
<class 'datetime.datetime'>

2024-03-15 14:30:45
2024-03-15
14:30:45
2024-03-15 14:30:45.123456
```

#### datetime .year, .month, .day, .hour — accessing components

Access individual components as attributes: `.year`, `.month`, `.day`, `.hour`, `.minute`, `.second`, `.microsecond`. `.weekday()` returns 0=Monday through 6=Sunday; `.isoweekday()` returns 1=Monday through 7=Sunday.

*Example: datetime .year, .month, .day, .hour — accessing components.*
```python

dt = datetime(2024, 3, 15, 14, 30, 45, 123456)

dt.year  # Year
dt.month  # Month
dt.day  # Day
dt.hour  # Hour
dt.minute  # Minute
dt.second  # Second
dt.microsecond  # Microsecond
dt.weekday()  # Weekday — 0=Monday, 6=Sunday
dt.isoweekday()  # ISO weekday — 1=Monday, 7=Sunday
dt.timetuple().tm_yday  # Day of year
dt.isocalendar()[1]  # Week number
```

```text
2024
3
15
14
30
45
123456
4
5
75
11
```

### Unix timestamps

#### Timestamp (Unix epoch) conversions

`.timestamp()` converts a datetime to a float of seconds since the Unix epoch (1970-01-01 UTC). `datetime.fromtimestamp(ts, tz=timezone.utc)` converts back — always pass `tz=timezone.utc` to get an aware datetime.

*Example: Timestamp (Unix epoch) conversions.*
```python

now = datetime.now()

# datetime -> timestamp (seconds since 1970-01-01 00:00:00 UTC)
ts = now.timestamp()
ts  # Timestamp (float)
int(ts)  # Timestamp (int)

# timestamp -> datetime
dt_from_ts = datetime.fromtimestamp(ts)                     # local time
dt_from_ts_utc = datetime.fromtimestamp(ts, tz=timezone.utc)  # UTC (preferred)
dt_from_ts  # From timestamp (local)
dt_from_ts_utc  # From timestamp (UTC)

# time.time() - current timestamp
time.time()

# Epoch - use timezone-aware UTC for correct calculation
epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
now_utc = datetime.now(timezone.utc)
epoch  # Epoch
print(f"{(now_utc - epoch).total_seconds():.0f}")  # Seconds since epoch
```

```text
1774414099.520628
1774414099

2026-03-25 05:48:19.520628
2026-03-25 04:48:19.520628+00:00

1774414099.5206285
1970-01-01 00:00:00+00:00
1774414100
```

### Parsing and formatting

#### Parsing strings -> datetime (strptime)

`datetime.strptime(string, format)` parses a date string using format codes: `%Y` (4-digit year), `%m` (month), `%d` (day), `%H` (24h hour), `%M` (minute), `%S` (second), `%f` (microsecond), `%p` (AM/PM).

*Example: Parsing strings -> datetime (strptime).*
```python

s1 = "2024-03-15 14:30:45"
s2 = "15/03/2024"
s3 = "March 15, 2024 2:30 PM"
s4 = "2024-03-15T14:30:45"
s5 = "2024-03-15T14:30:45.123456"
s6 = "Fri, 15 Mar 2024 14:30:45"

dt1 = datetime.strptime(s1, "%Y-%m-%d %H:%M:%S")
dt2 = datetime.strptime(s2, "%d/%m/%Y")
dt3 = datetime.strptime(s3, "%B %d, %Y %I:%M %p")
dt4 = datetime.strptime(s4, "%Y-%m-%dT%H:%M:%S")
dt5 = datetime.strptime(s5, "%Y-%m-%dT%H:%M:%S.%f")
dt6 = datetime.strptime(s6, "%a, %d %b %Y %H:%M:%S")

print(f"'{s1}' -> {dt1}")
print(f"'{s2}' -> {dt2}")
print(f"'{s3}' -> {dt3}")
print(f"'{s4}' -> {dt4}")
print(f"'{s5}' -> {dt5}")
print(f"'{s6}' -> {dt6}")
```

```text
'2024-03-15 14:30:45' -> 2024-03-15 14:30:45
'15/03/2024' -> 2024-03-15 00:00:00
'March 15, 2024 2:30 PM' -> 2024-03-15 14:30:00
'2024-03-15T14:30:45' -> 2024-03-15 14:30:45
'2024-03-15T14:30:45.123456' -> 2024-03-15 14:30:45.123456
'Fri, 15 Mar 2024 14:30:45' -> 2024-03-15 14:30:45
```

#### Formatting datetime -> string (strftime)

`dt.strftime(format)` formats a datetime as a string. Same format codes as `strptime`. Common patterns: `'%Y-%m-%dT%H:%M:%S'` (ISO 8601), `'%Y-%m-%d'` (date only), `'%I:%M %p'` (12-hour with AM/PM).

*Example: Formatting datetime -> string (strftime).*
```python

dt = datetime(2024, 3, 15, 14, 30, 45, 123456)

dt.strftime('%Y-%m-%dT%H:%M:%S')  # ISO 8601
dt.strftime('%Y-%m-%d')  # Date only
dt.strftime('%H:%M:%S')  # Time only
dt.strftime('%m/%d/%Y')  # US format
dt.strftime('%d/%m/%Y')  # EU format
dt.strftime('%B %d, %Y')  # Long date
dt.strftime('%b %d, %Y')  # Short date
dt.strftime('%I:%M %p')  # 12-hour
dt.strftime('%A')  # Day of week
dt.strftime('%a')  # Short day
dt.strftime('%Y-%m-%dT%H:%M:%S.%f')  # With micro
dt.strftime('%a, %d %b %Y %H:%M:%S')  # RFC 2822
dt.strftime('%Y%m%d%H%M%S')  # Compact
```

```text
2024-03-15T14:30:45
2024-03-15
14:30:45
03/15/2024
15/03/2024
March 15, 2024
Mar 15, 2024
02:30 PM
Friday
Fri
2024-03-15T14:30:45.123456
Fri, 15 Mar 2024 14:30:45
20240315143045
```

#### Common `strftime()` format codes

Use `strftime()` directives selectively. This list covers the format codes exercised elsewhere in the note rather than every platform-dependent directive.

*Example: Common `strftime()` format codes.*
```python
# Common strftime codes used in this note

codes = {
    "%Y": "4-digit year",      "%y": "2-digit year",
    "%m": "Month (01-12)",     "%B": "Month name (full)",
    "%b": "Month name (abbr)", "%d": "Day (01-31)",
    "%H": "Hour 24h (00-23)",  "%I": "Hour 12h (01-12)",
    "%M": "Minute (00-59)",    "%S": "Second (00-59)",
    "%f": "Microsecond",       "%p": "AM/PM",
    "%A": "Weekday (full)",    "%a": "Weekday (abbr)",
    "%w": "Weekday (0=Sun)",   "%j": "Day of year",
    "%U": "Week# (Sun start)", "%W": "Week# (Mon start)",
    "%Z": "Timezone name",     "%z": "UTC offset",
    "%%": "Literal %",
}
for code, desc in codes.items():
    print(f"  {code:4s} = {dt.strftime(code):20s}  ({desc})")
```

```text
  %Y   = 2024                  (4-digit year)
  %y   = 24                    (2-digit year)
  %m   = 03                    (Month (01-12))
  %B   = March                 (Month name (full))
  %b   = Mar                   (Month name (abbr))
  %d   = 15                    (Day (01-31))
  %H   = 14                    (Hour 24h (00-23))
  %I   = 02                    (Hour 12h (01-12))
  %M   = 30                    (Minute (00-59))
  %S   = 45                    (Second (00-59))
  %f   = 123456                (Microsecond)
  %p   = PM                    (AM/PM)
  %A   = Friday                (Weekday (full))
  %a   = Fri                   (Weekday (abbr))
  %w   = 5                     (Weekday (0=Sun))
  %j   = 075                   (Day of year)
  %U   = 10                    (Week# (Sun start))
  %W   = 11                    (Week# (Mon start))
  %Z   =                       (Timezone name)
  %z   =                       (UTC offset)
  %%   = %                     (Literal %)
```

### ISO 8601 and timezone handling

#### ISO 8601 conversions | isoformat() and fromisoformat()

`.isoformat()` returns ISO 8601 format. `datetime.fromisoformat()` parses it back. Python 3.7+ supports offset strings (`+05:30`); Python 3.11+ supports `Z` (UTC marker).

*Example: ISO 8601 conversions | isoformat() and fromisoformat().*
```python

dt = datetime(2024, 3, 15, 14, 30, 45, 123456)

# datetime -> ISO 8601 string
iso_str = dt.isoformat()
iso_str  # isoformat() — 2024-03-15T14:30:45.123456
dt.date().isoformat()  # date.isoformat — 2024-03-15
dt.time().isoformat()  # time.isoformat — 14:30:45.123456

# ISO 8601 string -> datetime
from_iso = datetime.fromisoformat("2024-03-15T14:30:45.123456")
from_iso  # fromisoformat()

# With timezone offset (Python 3.7+)
from_iso_tz = datetime.fromisoformat("2024-03-15T14:30:45+05:30")
from_iso_tz  # With offset

# With Z (Python 3.11+)
from_iso_z = datetime.fromisoformat("2024-03-15T14:30:45Z")
from_iso_z  # With Z (UTC)
```

```text
2024-03-15T14:30:45.123456
2024-03-15
14:30:45.123456

2024-03-15 14:30:45.123456
2024-03-15 14:30:45+05:30
2024-03-15 14:30:45+00:00
```

#### zoneinfo.ZoneInfo — timezone-aware datetime creation

Pass `tzinfo=ZoneInfo("America/New_York")` to the `datetime` constructor to create a timezone-aware datetime. `timezone.utc` is the built-in UTC timezone. Naive datetimes (no `tzinfo`) should be avoided in pipelines.

*Example: zoneinfo.ZoneInfo — timezone-aware datetime creation.*
```python

naive = datetime(2024, 3, 15, 14, 30, 45)
print(f"{naive}, tzinfo={naive.tzinfo}")

# Creating timezone-aware datetimes
utc_dt = datetime(2024, 3, 15, 14, 30, 45, tzinfo=timezone.utc)
ny_dt = datetime(2024, 3, 15, 14, 30, 45, tzinfo=ZoneInfo("America/New_York"))
london_dt = datetime(2024, 3, 15, 14, 30, 45, tzinfo=ZoneInfo("Europe/London"))
tokyo_dt = datetime(2024, 3, 15, 14, 30, 45, tzinfo=ZoneInfo("Asia/Tokyo"))
india_dt = datetime(2024, 3, 15, 14, 30, 45, tzinfo=ZoneInfo("Asia/Kolkata"))

utc_dt  # UTC
ny_dt  # New York
london_dt  # London
tokyo_dt  # Tokyo
india_dt  # India
```

```text
2024-03-15 14:30:45, tzinfo=None

2024-03-15 14:30:45+00:00
2024-03-15 14:30:45-04:00
2024-03-15 14:30:45+00:00
2024-03-15 14:30:45+09:00
2024-03-15 14:30:45+05:30
```

#### datetime.astimezone — converting between timezones

`.astimezone(ZoneInfo('timezone'))` converts an aware datetime to a different timezone while preserving the same instant in time. The underlying UTC value stays the same — only the offset and display change.

*Example: datetime.astimezone — converting between timezones.*
```python

utc_now = datetime.now(timezone.utc)
utc_now  # UTC now
utc_now.astimezone(ZoneInfo('America/New_York'))  # -> New York
utc_now.astimezone(ZoneInfo('Europe/London'))  # -> London
utc_now.astimezone(ZoneInfo('Asia/Tokyo'))  # -> Tokyo
utc_now.astimezone(ZoneInfo('Australia/Sydney'))  # -> Sydney
utc_now.astimezone(ZoneInfo('Asia/Kolkata'))  # -> India
utc_now.astimezone(ZoneInfo('Asia/Dubai'))  # -> Dubai
utc_now.astimezone(ZoneInfo('America/Sao_Paulo'))  # -> São Paulo
```

```text
2026-03-25 04:48:19.547681+00:00
2026-03-25 00:48:19.547681-04:00
2026-03-25 04:48:19.547681+00:00
2026-03-25 13:48:19.547681+09:00
2026-03-25 15:48:19.547681+11:00
2026-03-25 10:18:19.547681+05:30
2026-03-25 08:48:19.547681+04:00
2026-03-25 01:48:19.547681-03:00
```

#### Attaching `tzinfo` to a local wall-clock value

`naive.replace(tzinfo=ZoneInfo(...))` should only be used when the naive value already represents local wall-clock time in that zone. It annotates the clock reading without converting the underlying instant. `timezone(timedelta(hours=5, minutes=30))` creates a fixed-offset timezone for systems that do not use IANA timezone names.

*Example: Attaching `tzinfo` to a local wall-clock value.*
```python

naive = datetime(2024, 3, 15, 14, 30, 45)
aware = naive.replace(tzinfo=ZoneInfo("US/Eastern"))
aware  # Naive -> aware

# Fixed offset timezone
offset_5_30 = timezone(timedelta(hours=5, minutes=30))
dt_offset = datetime(2024, 3, 15, 14, 30, 45, tzinfo=offset_5_30)
dt_offset  # Fixed +5:30
```

```text
2024-03-15 14:30:45-04:00
2024-03-15 14:30:45+05:30
```

### Date/time arithmetic

#### Date/time arithmetic with timedelta | add and subtract intervals

`timedelta(days=, hours=, minutes=, seconds=, weeks=)` creates an interval. Add or subtract from a `datetime` with `+` and `-`. Subtracting two datetimes returns a `timedelta`. `.days` gives whole days; `.total_seconds()` gives the total interval in seconds.

*Example: Date/time arithmetic with timedelta | add and subtract intervals.*
```python

dt = datetime(2024, 3, 15, 14, 30, 45)

# Adding/subtracting time
dt  # Original
dt + timedelta(days=7)  # + 7 days
dt - timedelta(days=30)  # - 30 days
dt + timedelta(hours=2)  # + 2 hours
dt + timedelta(minutes=90)  # + 90 minutes
dt + timedelta(weeks=1, hours=3, minutes=30)  # + 1 week, 3h, 30m
dt - timedelta(days=180)  # - 6 months (approx)

# Difference between dates
dt1 = datetime(2024, 3, 15)
dt2 = datetime(2024, 12, 25)
diff = dt2 - dt1

print(f"From {dt1.date()} to {dt2.date()}")
diff  # Difference
diff.days  # Days
diff.total_seconds()  # Total seconds

# Comparing dates
print(f"dt1 < dt2:   {dt1 < dt2}")
print(f"dt1 == dt2:  {dt1 == dt2}")
dt1 > dt2
```

```text
2024-03-15 14:30:45
2024-03-22 14:30:45
2024-02-14 14:30:45
2024-03-15 16:30:45
2024-03-15 16:00:45
2024-03-22 18:00:45
2023-09-17 14:30:45

From 2024-03-15 to 2024-12-25
285 days, 0:00:00
285
24624000.0

True
False
False
```

#### `datetime` values support full `timedelta` arithmetic

`datetime` accepts both day-level and sub-day `timedelta` components, so additions and subtractions keep the calendar date and clock fields aligned in one operation.

*Example: `datetime` values support full `timedelta` arithmetic.*
```python
# datetime arithmetic — full add/subtract with timedelta

dt = datetime(2024, 3, 15, 14, 30, 45)
dt  # Original
dt + timedelta(days=1)  # + 1 day
dt - timedelta(hours=2)  # - 2 hours
dt + timedelta(minutes=30)  # + 30 minutes
dt + timedelta(seconds=45)  # + 45 seconds
dt + timedelta(milliseconds=500)  # + 500ms
dt + timedelta(days=1.5)  # + 1.5 days
dt + timedelta(days=1, hours=2, minutes=30, seconds=15)  # Combined
```

```text
2024-03-15 14:30:45
2024-03-16 14:30:45
2024-03-15 12:30:45
2024-03-15 15:00:45
2024-03-15 14:31:30
2024-03-15 14:30:45.500000
2024-03-17 02:30:45
2024-03-16 17:01:00
```

#### `date` values ignore sub-day `timedelta` components

`date` arithmetic tracks whole days only. If you need hour or minute offsets, promote the value to `datetime` before doing the calculation.

*Example: `date` values ignore sub-day `timedelta` components.*
```python
# date arithmetic — only days, no hours or minutes

d = date(2024, 3, 15)
d  # Original
d + timedelta(days=7)  # + 7 days
d - timedelta(days=30)  # - 30 days
d + timedelta(weeks=1)  # + 1 week
# d + timedelta(hours=2)  # works but result is still a date (hours ignored)

# date difference
d2 = date(2024, 12, 25)
diff = d2 - d
print(f"Diff {d} to {d2}: {diff.days} days")
```

```text
2024-03-15
2024-03-22
2024-02-14
2024-03-22
Diff 2024-03-15 to 2024-12-25: 285 days
```

#### `time` values require `datetime.combine()` for arithmetic

A `time` value has no date context, so Python requires you to combine it with a `date` before adding or subtracting offsets.

> [!warning] `time` Arithmetic Requires a Date Context
>
> `time + timedelta(hours=1)` raises `TypeError`. Workaround: combine with a dummy date, do the arithmetic on the datetime, then extract the time component.

> [!success] Use datetime.combine for time arithmetic
>
> Combine `time` with a dummy date via `datetime.combine(date.today(), t)`, perform the arithmetic on the resulting `datetime`, then extract `.time()`. This is the standard workaround.

*Example: `time` values require `datetime.combine()` for arithmetic.*
```python
# time arithmetic — must convert to datetime first

t = time(14, 30, 45)
t  # Original
dummy = datetime.combine(date.today(), t)
new_time = (dummy + timedelta(hours=2, minutes=15)).time()
new_time  # + 2h 15m
new_time2 = (dummy - timedelta(minutes=45)).time()
new_time2  # - 45m
```

```text
14:30:45
16:45:45
13:45:45
```

#### Unix timestamps use numeric second offsets

A Unix timestamp is a numeric count of seconds since the epoch. Offset math is straightforward, but you must restore timezone context explicitly when converting back to `datetime`.

*Example: Unix timestamps use numeric second offsets.*
```python
# Timestamp arithmetic — float math on epoch seconds

ts = datetime(2024, 3, 15, 14, 30, 45).timestamp()
ts  # Original
ts + 86400  # + 1 day — 86400 = 24*60*60
ts + 3600  # + 1 hour — 3600 = 60*60
ts + 1800  # + 30 minutes — 1800 = 30*60
ts + 45  # + 45 seconds
datetime.fromtimestamp(ts + 86400)  # Back to datetime
```

```text
1710509445.0
1710595845.0
1710513045.0
1710511245.0
1710509490.0
2024-03-16 14:30:45
```

#### dateutil.relativedelta — add months and years to dates

`timedelta` does not support months or years because those units have variable lengths. `dateutil.relativedelta` handles calendar-aware math such as month-end clamping, so `relativedelta(months=1)` turns January 31 into February 29 in a leap year. Install it with `pip install python-dateutil`.

*Example: dateutil.relativedelta — add months and years to dates.*
```python

dt = datetime(2024, 1, 31, 14, 30, 0)
dt  # Original
dt + relativedelta(months=1)  # + 1 month — month-end clamped to Feb 29
dt + relativedelta(months=6)  # + 6 months
dt + relativedelta(years=1)  # + 1 year
dt - relativedelta(months=3)  # - 3 months
dt + relativedelta(years=1, months=2, days=3)  # + 1y 2m 3d
```

```text
2024-01-31 14:30:00
2024-02-29 14:30:00
2024-07-31 14:30:00
2025-01-31 14:30:00
2023-10-31 14:30:00
2025-04-03 14:30:00
```

## Math and Random

### Math built-ins and math module

#### Built-in numeric helpers — `abs()`, `max()`, `min()`, and clamp patterns

> [!info] Math built-ins
>
> - `abs()`, `max()`, `min()` — built-in, no import needed
> - `max`/`min` accept any number of arguments
> - Clamp pattern: `max(lo, min(val, hi))`
> - `math` module adds `floor`, `ceil`, `sqrt`, `log`, `pow`, and trig functions
> - For vectorized array math, use NumPy instead

*Example: Built-in numeric helpers — `abs()`, `max()`, `min()`, and clamp patterns.*
```python
# Basic numeric helpers — abs, max, min; clamp uses max(lo, min(val, hi))

abs(-42)
max(10, 20)
min(10, 20)
max(0, min(15, 10))  # clamp(15, 0,10)
```

```text
42
20
10
10
```

#### `math.floor()`, `math.ceil()`, and `round()` handle different rounding cases

`math.floor()`, `math.ceil()`, and `round()` solve different rounding problems, especially around tie handling and truncation.

*Example: `math.floor()`, `math.ceil()`, and `round()` handle different rounding cases.*
```python
# Rounding — floor, ceil, round with banker's rounding default

math.floor(3.7)  # → 3
math.ceil(3.2)  # → 4
round(3.5)  # → 4 (banker's)
round(2.5)  # → 2 (banker's — rounds to even!)
math.trunc(3.9)  # → 3
int(3.9)
```

```text
3
4
4
2
3
3
```

#### `math.sqrt()`, `math.log()`, and `math.pow()` cover power and log transforms

Choose between operators and `math` helpers based on whether you need integer preservation, floating-point behavior, or logarithmic transforms.

*Example: `math.sqrt()`, `math.log()`, and `math.pow()` cover power and log transforms.*
```python
# Powers, roots, logarithms — ** operator, math.sqrt, math.log

2 ** 10  # 1024 (operator)
math.pow(2, 10)  # 1024.0 (returns float)
pow(2, 10)  # 1024 (built-in, returns int)
math.sqrt(144)  # 12.0
math.isqrt(144)  # 12 (integer sqrt, 3.8+)

# Logarithms — log is natural (ln), log10 and log2 for other bases
math.log(100)
math.log10(100)
math.log2(1024)
math.exp(1)
```

```text
1024
1024.0
1024
12.0
12
4.605170185988092
2.0
10.0
2.718281828459045
```

#### `math.sin()`, `math.cos()`, `math.pi`, and `math.e` support trigonometric work

The `math` module exposes both numeric constants and radian-based trigonometric helpers for geometry and signal-processing tasks.

*Example: `math.sin()`, `math.cos()`, `math.pi`, and `math.e` support trigonometric work.*
```python
# Trigonometry and constants — pi, e, tau, sin, cos, atan2

math.pi
math.e
math.tau  # 2π
math.sin(math.pi / 2)  # math.sin(π/2)
math.cos(0)
math.atan2(1, 1)
math.degrees(math.pi)  # math.degrees(π)
math.radians(180)
```

```text
3.141592653589793
2.718281828459045
6.283185307179586
1.0
1.0
0.7853981633974483
180.0
3.141592653589793
```

#### `math.inf`, `math.nan`, and `math.isnan()` require explicit checks

`inf` and `nan` are valid float sentinel values, but they require explicit guards such as `math.isnan()` and `math.isfinite()` in comparison-heavy code.

*Example: `math.inf`, `math.nan`, and `math.isnan()` require explicit checks.*
```python
# Special float values — inf, nan, and detection functions

math.inf
math.nan
math.isnan(math.nan)  # math.isnan(nan)
math.isinf(math.inf)  # math.isinf(inf)
math.isfinite(42)
```

```text
inf
nan
True
True
True
```

#### `statistics.quantiles()` gives lightweight percentile cut points

`statistics.quantiles()` is convenient for small in-memory samples when you need percentile-style cut points without pulling in NumPy.

*Example: `statistics.quantiles()` gives lightweight percentile cut points.*
```python
# Percentile calculation — statistics module for distribution analysis

latencies = [12.5, 45.2, 3.1, 78.9, 22.0, 15.3, 99.1, 6.7, 33.4, 51.8]
latencies.sort()
latencies  # Latencies
print(f"{statistics.mean(latencies):.2f}")  # Mean
print(f"{statistics.median(latencies):.2f}")  # Median
print(f"{statistics.stdev(latencies):.2f}")  # Stdev
# Python 3.8+ quantiles
quantiles = statistics.quantiles(latencies, n=20)  # 5% increments
print(f"{quantiles[-1]:.2f} ms")  # P95
```

```text
[3.1, 6.7, 12.5, 15.3, 22.0, 33.4, 45.2, 51.8, 78.9, 99.1]
36.80
27.70
32.10
108.19 ms
```

### Random number generation

#### random module | pseudo-random numbers with seed for reproducibility

`random.seed(n)` makes results reproducible. `randint(a, b)` returns `[a, b]` inclusive. `random()` returns `[0.0, 1.0)`. `choice()` picks one element; `choices(k=n)` picks n with replacement; `sample(k=n)` picks n without replacement. `shuffle()` reorders in place.

*Example: random module | pseudo-random numbers with seed for reproducibility.*
```python

random.seed(42)  # seed for reproducibility

[random.randint(1, 100) for _ in range(5)]  # [1, 100] inclusive both ends
[random.randrange(1, 101) for _ in range(5)]  # [1, 101) upper bound excluded

[round(random.random(), 4) for _ in range(5)]  # [0.0, 1.0)
[round(random.uniform(1.0, 10.0), 2) for _ in range(5)]  # [1.0, 10.0]

colors = ["red", "green", "blue", "yellow"]
random.choice(colors)  # choice — pick one
random.choices(colors, k=3)  # choices — pick k with replacement
random.sample(colors, k=2)  # sample — pick k WITHOUT replacement

items = ["A", "B", "C", "D", "E"]
items  # Original
random.shuffle(items)
items  # Shuffled
```

```text
[82, 15, 4, 95, 36]
[32, 29, 18, 95, 14]

[0.6767, 0.8922, 0.0869, 0.4219, 0.0298]
[2.97, 5.55, 1.24, 2.79, 6.85]

yellow
['red', 'blue', 'yellow']
['red', 'yellow']

['A', 'B', 'C', 'D', 'E']
['E', 'A', 'B', 'C', 'D']
```

#### random.choices weights= — weighted random selection

Pass `weights=` to `random.choices` for non-uniform sampling. Weights don't need to sum to 100 — they're relative. Useful for generating realistic test data with skewed distributions (e.g., 60% page_view, 10% purchase).

*Example: random.choices weights= — weighted random selection.*
```python

events = ["page_view", "click", "purchase", "signup"]
weights = [60, 25, 10, 5]  # percentage weights
picks = random.choices(events, weights=weights, k=20)
picks  # Weighted picks (20)
dict(Counter(picks))  # Distribution
```

```text
['page_view', 'click', 'page_view', 'page_view', 'page_view', 'page_view', 'page_view', 'page_view', 'page_view', 'page_view', 'purchase', 'page_view', 'page_view', 'click', 'purchase', 'page_view', 'page_view', 'page_view', 'click', 'click']
{'page_view': 14, 'click': 4, 'purchase': 2}
```

#### `random.Random()` can generate deterministic synthetic event records

A dedicated `random.Random()` instance keeps generator state isolated from global calls, which is useful when test fixtures need deterministic event streams.

*Example: `random.Random()` can generate deterministic synthetic event records.*
```python
# Synthetic test data generation — realistic event records for pipelines

event_types = ["page_view", "click", "purchase", "signup"]
regions = ["us-east-1", "eu-west-1", "ap-south-1"]
rng = random.Random(123)  # independent RNG instance

print(f"{'event_id':<12} {'type':<12} {'region':<12} {'revenue':>8}")
for i in range(8):
    event_id = f"evt_{i+1:04d}"
    evt_type = rng.choice(event_types)
    region = rng.choice(regions)
    revenue = round(rng.uniform(5, 200), 2) if evt_type == "purchase" else 0.0
    print(f"{event_id:<12} {evt_type:<12} {region:<12} {revenue:>8.2f}")
```

```text
event_id     type         region        revenue
────────────────────────────────────────────────
evt_0001     page_view    eu-west-1        0.00
evt_0002     page_view    eu-west-1        0.00
evt_0003     purchase     us-east-1      168.51
evt_0004     page_view    eu-west-1        0.00
evt_0005     purchase     eu-west-1      171.16
evt_0006     click        us-east-1        0.00
evt_0007     purchase     ap-south-1      70.09
evt_0008     click        us-east-1        0.00
```

## Logging

### logging module — levels, handlers, formatters

#### logging module — levels, handlers, formatters, basicConfig

Loggers form a hierarchy (root > app > app.module) — set level on parent, children inherit. Handlers direct output (console, file, network); formatters control layout. Levels: `DEBUG` < `INFO` < `WARNING` < `ERROR` < `CRITICAL`. Use lazy evaluation: `logger.info("msg %s", val)` only formats if the level is active.

> [!warning] Anti-patterns
>
> - **`print()` for logging** — no levels, timestamps, or filtering
> - **f-string in log calls** — always evaluated, even if level is filtered
> - **`basicConfig` in library code** — should only be in the entry point

> [!success] Best practices
>
> - Use `logger.info("msg %s", val)` (%-style) so the string is only formatted when the level is active
> - Call `logging.basicConfig` once in the application entry point, never in library modules
> - Use `logging.getLogger(__name__)` in each module for automatic hierarchy and filtering

*Example: logging module — levels, handlers, formatters, basicConfig.*
```python
# ── Basic logging setup ──
logger = logging.getLogger("PipelineDemo")
logger.setLevel(logging.DEBUG)  # accept DEBUG and above

# Remove any existing handlers (Jupyter may have leftover handlers)
logger.handlers.clear()

# Add a console handler with a formatter
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter("%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
                              datefmt="%H:%M:%S")
handler.setFormatter(formatter)
logger.addHandler(handler)

# Log at each level
logger.debug("Debug: starting pipeline")             # shown (min level = DEBUG)
logger.info("Info: processed %d rows", 42)           # shown, %-style formatting
logger.warning("Warning: schema drift in %s", "events_raw")  # shown
logger.error("Error: failed partition %s", "2024-03-15")      # shown
logger.critical("Critical: pipeline halted")                   # shown
```

```text
05:52:00 [DEBUG   ] PipelineDemo: Debug: starting pipeline
05:52:00 [INFO    ] PipelineDemo: Info: processed 42 rows
05:52:00 [WARNING ] PipelineDemo: Warning: schema drift in events_raw
05:52:00 [ERROR   ] PipelineDemo: Error: failed partition 2024-03-15
05:52:00 [CRITICAL] PipelineDemo: Critical: pipeline halted
```

#### `logging.getLogger()` keeps subsystem logs scoped and configurable

`logging.getLogger()` gives each subsystem a stable logger name while still inheriting shared handler and level configuration.

*Example: `logging.getLogger()` keeps subsystem logs scoped and configurable.*
```python
# Simulating a pipeline run with logging — practical ETL example

logger = logging.getLogger("ETL")
logger.setLevel(logging.INFO)
logger.handlers.clear()

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
                                       datefmt="%H:%M:%S"))
logger.addHandler(handler)

rng = random.Random(42)
tables = ["events_raw", "users", "transactions"]

logger.info("Pipeline started")
for table in tables:
    row_count = rng.randint(100, 10_000)
    duration_ms = rng.randint(200, 5000)
    if row_count < 500:
        logger.warning("Low row count for %s: %d (expected > 500)", table, row_count)
    else:
        logger.info("Loaded %s: %d rows in %dms", table, row_count, duration_ms)
logger.info("Pipeline completed")

# ── JSON logging (for production / cloud) ──
```

```text
05:52:09 [INFO    ] ETL: Pipeline started
05:52:09 [INFO    ] ETL: Loaded events_raw: 1924 rows in 404ms
05:52:09 [INFO    ] ETL: Loaded users: 4606 rows in 2206ms
05:52:09 [INFO    ] ETL: Loaded transactions: 3757 rows in 1343ms
05:52:09 [INFO    ] ETL: Pipeline completed
```

#### Custom `logging.Formatter` implementations can emit JSON

A custom `logging.Formatter` can emit JSON for downstream systems that index `timestamp`, `level`, and message fields.

*Example: Custom `logging.Formatter` implementations can emit JSON.*
```python
# JSON log formatter — machine-parseable logs for ELK/CloudWatch/Datadog

class JsonFormatter(logging.Formatter):
    """Minimal JSON formatter — production apps use python-json-logger."""
    def format(self, record):
        return json.dumps({
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        })

json_logger = logging.getLogger("ETL.json")
json_logger.setLevel(logging.INFO)
json_logger.handlers.clear()
json_logger.propagate = False  # don't send to parent "ETL" logger

json_handler = logging.StreamHandler(sys.stdout)
json_handler.setFormatter(JsonFormatter())
json_logger.addHandler(json_handler)

json_logger.info("Loaded %s: %d rows in %dms", "events_raw", 8500, 1200)
json_logger.warning("Schema drift detected in %s", "users")
```

```text
{"timestamp": "2026-03-25T05:52:11", "level": "INFO", "logger": "ETL.json", "message": "Loaded events_raw: 8500 rows in 1200ms"}
{"timestamp": "2026-03-25T05:52:11", "level": "WARNING", "logger": "ETL.json", "message": "Schema drift detected in users"}
```

## Configuration and Environment Variables

### Environment variables — os.environ

#### os.environ — reading and setting environment variables

> [!info] Environment variables
>
> - `os.environ["KEY"]` — raises `KeyError` if missing
> - `os.environ.get("KEY", default)` — returns default silently
> - `os.environ["KEY"] = value` — sets for the current process only
> - Standard for Docker, Kubernetes, CI/CD
> - For complex structured config, use config files with env var overrides

> [!warning] Anti-patterns
>
> - **Hardcoding secrets in code** — use env vars or secret managers
> - **`os.environ["KEY"]` without handling `KeyError`** — crashes if missing

> [!success] Best practices
>
> - Use `os.getenv("KEY", default)` for optional config and `os.environ["KEY"]` only for required values (fail-fast)
> - Store secrets in environment variables or a secrets manager — never in source code or config files committed to git
> - Validate required env vars at startup so the process fails immediately with a clear error, not deep in the pipeline

*Example: os.environ — reading and setting environment variables.*
```python
# Environment variables — the simplest config mechanism.
# Used everywhere: Docker, Kubernetes, CI/CD, cloud functions.

# Read common env vars
os.environ.get('USERNAME', 'N/A')  # USERNAME — Windows
os.environ.get('COMPUTERNAME', 'N/A')  # COMPUTERNAME
print(f"PATH (first 80): {os.environ.get('PATH', '')[:80]}...")

db_host = os.environ.get("DATABASE_HOST", "localhost")
db_host  # DATABASE_HOST (default)

# os.getenv() — same as os.environ.get() (shorthand)
os.getenv('PIPELINE_ENV', 'not set')  # PIPELINE_ENV

# Set an env var (current process only — does NOT persist after exit)
os.environ["PIPELINE_ENV"] = "staging"
os.environ['PIPELINE_ENV']  # PIPELINE_ENV

# Delete an env var
del os.environ["PIPELINE_ENV"]
os.getenv('PIPELINE_ENV', 'not set')  # After delete
```

```text
Alex
ELYSIUM
c:\Users\aperi\DEV\LANG\.lang\Scripts;C:\Users\aperi\DEV\LANG\.lang\Scripts;C:\U...

localhost
not set
staging
not set
```

> [!info] os.environ vs os.getenv
>
> `os.environ["KEY"]` raises `KeyError` if missing. `os.getenv("KEY", default)` returns the default silently. Use `os.environ` when the variable MUST exist (fail-fast); use `os.getenv` for optional configuration.


#### `os.environ.items()` helps with environment diagnostics

`os.environ.items()` is useful for diagnostics, but truncate values before printing so the dump stays readable and avoids spraying long secrets.

*Example: `os.environ.items()` helps with environment diagnostics.*
```python
# List all environment variables — diagnostic inspection

for i, (key, val) in enumerate(os.environ.items()):
    if i >= 10: break
    if len(val) > 60: val = val[:60] + "..."
    print(f"  {key} = {val}")
print(f"... ({len(os.environ)} total)")
```

```text
  3DVPATH = C:\AMD\Chipset_Software\Binaries\3D_V-Cache_Performance_Opti...
  ACSETUPSVCPORT = 23210
  ALLUSERSPROFILE = C:\ProgramData
  APPDATA = C:\Users\aperi\AppData\Roaming
  APPLICATIONINSIGHTS_CONFIGURATION_CONTENT = {}
  APPLICATION_INSIGHTS_NO_DIAGNOSTIC_CHANNEL = 1
  ASL.LOG = Destination=file
  CHROME_CRASHPAD_PIPE_NAME = \\.\pipe\crashpad_6836_LBXSBGYJGPFYPULP
  CLAUDE_AGENT_SDK_VERSION = 0.2.81
  CLAUDE_CODE_MAX_OUTPUT_TOKENS = 64000
  ... (85 total)
```

### Config files — configparser, TOML, .env

#### configparser — INI-style configuration

`configparser` reads INI-format files (sections with `[name]`, key-value pairs). All values are strings — use `.getint()`, `.getboolean()`, `.getfloat()` for type-safe access with optional `fallback=` defaults. Built-in, no dependencies.

*Example: configparser — INI-style configuration.*
```python

tmp_dir = tempfile.mkdtemp(prefix="config_demo_")
config_path = os.path.join(tmp_dir, "pipeline.ini")

# Write a config file
with open(config_path, "w") as f:
    f.write("""[pipeline]
name = events_etl
batch_size = 5000
max_retries = 3
enabled = true

[database]
host = prod-db
port = 5432
name = analytics

[logging]
level = INFO
""")

# Read it back
config = configparser.ConfigParser()
config.read(config_path)

# Access values (all values are strings — must convert manually)
config['pipeline']['name']  # Pipeline name
config.getint('pipeline', 'batch_size')  # Batch size — type-safe
config.getint('pipeline', 'max_retries')  # Max retries
config.getboolean('pipeline', 'enabled')  # Enabled — true/false/yes/no/1/0
config['database']['host']  # DB host
config['logging']['level']  # Log level

config.getint('pipeline', 'timeout', fallback=30)  # Timeout
```

```text
events_etl
5000
3
True
prod-db
INFO
30
```

#### configparser.sections, .get — reading config sections and keys

`.sections()` lists all section names. Access keys with `config['section']['key']` or `config.get('section', 'key', fallback=default)`.

*Example: configparser.sections, .get — reading config sections and keys.*
```python

config.sections()  # Sections
list(config['pipeline'].keys())  # Pipeline keys
```

```text
['pipeline', 'database', 'logging']
['name', 'batch_size', 'max_retries', 'enabled']
```

#### tomllib — TOML modern config format (Python 3.11+)

`tomllib` (read-only, built-in since Python 3.11) parses TOML files into dicts. Unlike `configparser`, TOML preserves native types: `int`, `bool`, `list`, `datetime`. Open in binary mode (`"rb"`). For writing TOML, use `tomli-w` (third-party).

*Example: tomllib — TOML modern config format (Python 3.11+).*
```python

toml_path = os.path.join(tmp_dir, "pipeline.toml")
with open(toml_path, "w") as f:
    f.write("""[pipeline]
name = "events_etl"
batch_size = 5000
max_retries = 3
enabled = true
tags = ["production", "clickstream"]

[database]
host = "prod-db"
port = 5432
""")

# Read TOML — tomllib only reads, returns a dict
with open(toml_path, "rb") as f:  # must open in binary mode
    toml_config = tomllib.load(f)

toml_config['pipeline']  # Pipeline
toml_config['pipeline']['name']  # Name
toml_config['pipeline']['tags']  # Tags — native list!
toml_config['database']['port']  # DB port — native int!
# Unlike configparser, TOML preserves types: int, bool, list, datetime.

# ── .env files (python-dotenv) ──
```

```text
{'name': 'events_etl', 'batch_size': 5000, 'max_retries': 3, 'enabled': True, 'tags': ['production', 'clickstream']}
events_etl
['production', 'clickstream']
5432
```

#### .env files

> [!danger] Never Commit .env to Git
>
> `.env` files hold secrets for local development. `python-dotenv` loads them into `os.environ`. Always add `.env` to `.gitignore`. In production, use a secret manager instead.

> [!success] Secure secret management
>
> Add `.env` to `.gitignore` immediately when creating the file. Use `python-dotenv` only for local development. In CI/CD and production, inject secrets through the platform's secret management (GCP Secret Manager, AWS Secrets Manager, GitHub Actions secrets, K8s Secrets).

*Example: .env files.*
```python
# .env files — local secrets with python-dotenv

env_path = os.path.join(tmp_dir, ".env")
with open(env_path, "w") as f:
    f.write("DATABASE_HOST=localhost\n")
    f.write("DATABASE_PORT=5432\n")
    f.write("API_KEY=sk-test-abc123\n")

# Manual .env parsing (without python-dotenv dependency)
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, val = line.split("=", 1)
            print(f"  {key} = {val}")
            # In production: os.environ[key] = val

# Cleanup
shutil.rmtree(tmp_dir)
tmp_dir  # Cleaned up
```

```text
  DATABASE_HOST = localhost
  DATABASE_PORT = 5432
  API_KEY = sk-test-abc123

C:\Users\aperi\AppData\Local\Temp\config_demo_s32pafzs
```

## Operational Risks

### Timezone semantics

#### `replace(tzinfo=...)` reinterprets wall-clock time instead of converting an instant

Use `replace(tzinfo=...)` only when the naive value already belongs to the target zone. If the source value is already an absolute instant such as `timezone.utc`, use `astimezone()` for conversion.

*Example: `replace(tzinfo=...)` reinterprets wall-clock time instead of converting an instant.*
```python
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

utc_stamp = datetime(2024, 3, 15, 12, 0, 0, tzinfo=timezone.utc)
wrong = utc_stamp.replace(tzinfo=ZoneInfo("America/New_York"))
right = utc_stamp.astimezone(ZoneInfo("America/New_York"))
print(wrong.isoformat())
print(right.isoformat())
```

```text
2024-03-15T12:00:00-04:00
2024-03-15T08:00:00-04:00
```

### Predictability and observability

#### Fixed `random` seeds make sequences reproducible to anyone who knows the seed

A fixed `random.Random(42)` stream is useful in tests, but it is a liability for tokens, secrets, or any user-visible identifier that should not repeat.

*Example: Fixed `random` seeds make sequences reproducible to anyone who knows the seed.*
```python
import random

first = random.Random(42)
second = random.Random(42)
seq_a = [first.randint(1, 100) for _ in range(3)]
seq_b = [second.randint(1, 100) for _ in range(3)]
print(seq_a)
print(seq_b)
print(seq_a == seq_b)
```

```text
[82, 15, 4]
[82, 15, 4]
True
```

#### `print()` does not replace structured `logging`

`print()` emits an unlabeled string, while `logging` can carry a level and logger name that downstream tooling can filter and route.

*Example: `print()` does not replace structured `logging`.*
```python
import logging
import sys

print("print: pipeline started")
logger = logging.getLogger("demo.risk")
logger.handlers.clear()
logger.propagate = False
logger.setLevel(logging.INFO)
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter("%(levelname)s %(name)s %(message)s"))
logger.addHandler(handler)
logger.info("pipeline started")
```

```text
print: pipeline started
INFO demo.risk pipeline started
```

## Recommended Patterns

### Time and numeric correctness

#### Store canonical timestamps in `timezone.utc` and render with `ZoneInfo`

Keep storage and interchange values in `timezone.utc`, then project them into a presentation zone such as `ZoneInfo("Europe/Amsterdam")` only at the display boundary.

*Example: Store canonical timestamps in `timezone.utc` and render with `ZoneInfo`.*
```python
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

stamp = datetime(2024, 3, 15, 12, 0, 0, tzinfo=timezone.utc)
print(stamp.isoformat())
print(stamp.astimezone(ZoneInfo("Europe/Amsterdam")).isoformat())
```

```text
2024-03-15T12:00:00+00:00
2024-03-15T13:00:00+01:00
```

#### Use `Decimal` when binary `float` rounding drift is unacceptable

For financial or precision-sensitive calculations, `Decimal("0.1")` preserves the exact decimal value that `0.1` as a binary float cannot represent.

*Example: Use `Decimal` when binary `float` rounding drift is unacceptable.*
```python
from decimal import Decimal

print(0.1 + 0.2)
print(Decimal("0.1") + Decimal("0.2"))
```

```text
0.30000000000000004
0.3
```

### Secure randomness and runtime diagnostics

#### Use `secrets` for token material instead of `random`

`secrets` pulls from the operating system's secure random source, so it is the correct choice for API keys, reset links, and session secrets.

*Example: Use `secrets` for token material instead of `random`.*
```python
import secrets

token = secrets.token_hex(8)
print(len(token))
print(all(ch in "0123456789abcdef" for ch in token))
```

```text
16
True
```

#### Emit machine-readable records with `logging.Formatter`

A JSON `logging.Formatter` keeps `level`, logger name, and message fields explicit, which makes ingestion into log indexes and alerting rules straightforward.

*Example: Emit machine-readable records with `logging.Formatter`.*
```python
import json
import logging
import sys

class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        })

logger = logging.getLogger("demo.json")
logger.handlers.clear()
logger.propagate = False
logger.setLevel(logging.INFO)
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())
logger.addHandler(handler)
logger.warning("schema drift detected")
```

```text
{"level": "WARNING", "logger": "demo.json", "message": "schema drift detected"}
```

### Configuration defaults

#### Prefer `os.getenv()` for optional settings and reserve `os.environ[...]` for required ones

Use `os.getenv()` when a missing value should fall back to a default, and keep direct `os.environ[...]` lookups for fail-fast settings that must be present at startup.

*Example: Prefer `os.getenv()` for optional settings and reserve `os.environ[...]` for required ones.*
```python
import os

os.environ.pop("APP_MODE", None)
print(os.getenv("APP_MODE", "local"))
os.environ["APP_MODE"] = "staging"
print(os.getenv("APP_MODE", "local"))
del os.environ["APP_MODE"]
```

```text
local
staging
```

## Python DateTime, Math and Utilities Troubleshooting

### Datetime parsing and comparison

#### `TypeError` when a naive `datetime` meets an aware `datetime`

This error means one value has `tzinfo=None` and the other is timezone-aware. Normalize both sides to the same timezone model before comparing or subtracting them.

*Example: `TypeError` when a naive `datetime` meets an aware `datetime`.*
```python
from datetime import datetime, timezone

naive = datetime(2024, 3, 15, 12, 0, 0)
aware = datetime(2024, 3, 15, 12, 0, 0, tzinfo=timezone.utc)
try:
    print(naive < aware)
except TypeError as exc:
    print(type(exc).__name__)
    print(exc)
```

```text
TypeError
can't compare offset-naive and offset-aware datetimes
```

#### `strptime()` returns a naive `datetime` unless the format includes timezone data

If you parse text without `%z`, Python has no offset information to attach. Include `%z` in the format string or assign the correct timezone in a separate step when the wall-clock context is known.

*Example: `strptime()` returns a naive `datetime` unless the format includes timezone data.*
```python
from datetime import datetime

naive = datetime.strptime("2024-03-15 14:30:45", "%Y-%m-%d %H:%M:%S")
aware = datetime.strptime("2024-03-15 14:30:45 +0000", "%Y-%m-%d %H:%M:%S %z")
print(naive.tzinfo is None)
print(aware.tzinfo)
```

```text
True
UTC
```

### Numeric and configuration issues

#### `float` equality fails for `0.1 + 0.2`

This is standard IEEE 754 behavior. Use `math.isclose()` for approximate comparisons or `Decimal` when the calculation itself must stay exact.

*Example: `float` equality fails for `0.1 + 0.2`.*
```python
import math
from decimal import Decimal

print(0.1 + 0.2 == 0.3)
print(math.isclose(0.1 + 0.2, 0.3))
print(Decimal("0.1") + Decimal("0.2") == Decimal("0.3"))
```

```text
False
True
True
```

#### `os.environ['KEY']` raises `KeyError` when the variable is absent

Direct indexing is appropriate for required settings, but it will fail immediately when the variable is not defined. Use `os.getenv()` when a default is acceptable.

*Example: `os.environ['KEY']` raises `KeyError` when the variable is absent.*
```python
import os

os.environ.pop("MISSING_KEY", None)
try:
    print(os.environ["MISSING_KEY"])
except KeyError as exc:
    print(type(exc).__name__)
    print(exc.args[0])
print(os.getenv("MISSING_KEY", "default"))
```

```text
KeyError
MISSING_KEY
default
```

### Logging and randomness

#### Missing `logging` output usually means no handler is attached

If a logger has no handler and propagation is disabled, emitted records go nowhere. Attach a handler explicitly or let the logger propagate to a configured parent.

*Example: Missing `logging` output usually means no handler is attached.*
```python
import logging
import sys

logger = logging.getLogger("demo.troubleshoot")
logger.handlers.clear()
logger.propagate = False
logger.setLevel(logging.INFO)
print(len(logger.handlers))
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.INFO)
    handler.setFormatter(logging.Formatter("%(levelname)s %(message)s"))
    logger.addHandler(handler)
logger.info("handler attached")
```

```text
0
INFO handler attached
```

#### `random.seed()` repeats the same sequence by design

A fixed seed is correct for reproducible tests, but production code should avoid it unless repeatability is part of the requirement.

*Example: `random.seed()` repeats the same sequence by design.*
```python
import random

first = random.Random(7)
second = random.Random(7)
seq1 = [first.randint(1, 9) for _ in range(4)]
seq2 = [second.randint(1, 9) for _ in range(4)]
print(seq1)
print(seq2)
print(seq1 == seq2)
```

```text
[6, 3, 7, 1]
[6, 3, 7, 1]
True
```
