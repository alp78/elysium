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

> [!quote]
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
> **`datetime`** — Object that combines a calendar date and a wall-clock time into a single value.
>
> - The primary timestamp type in Python; created with `datetime(year, month, day, hour, minute, second)` or `datetime.now()`.
> - Can be *naive* (no timezone info) or *aware* (carries a `tzinfo` object); the two kinds cannot be compared or subtracted directly.
>
> > [!warning] Naive vs aware mismatch
> >
> > Subtracting a naive datetime from an aware one raises `TypeError`. Keep all datetimes aware throughout the pipeline; attach `timezone.utc` or a `ZoneInfo` at creation time.
>
> > ---
>
> **Naive datetime** — A `datetime` object with `tzinfo=None`, meaning it carries no timezone information.
>
> - `datetime.now()` returns a naive local datetime; it is ambiguous during DST transitions and cannot be safely compared across systems.
> - Naive datetimes are acceptable only for purely local, single-machine operations where timezone context is irrelevant.
>
> > [!warning] Never store naive datetimes
> >
> > Naive timestamps in a database are ambiguous: the same `2024-03-15 02:30:00` could represent two different UTC instants during a DST fallback. Always use `datetime.now(timezone.utc)` for storage.
>
> > ---
>
> **Aware datetime** — A `datetime` object that carries a `tzinfo` attribute, making it unambiguous in time.
>
> - Created by passing `tzinfo=timezone.utc` or `tzinfo=ZoneInfo("Region/City")` to the constructor, or by calling `.replace(tzinfo=...)` on a naive instance.
> - Aware datetimes from different timezones compare correctly because Python normalises to UTC internally.
>
> > [!info] Attach timezone at creation, not after
> >
> > Prefer `datetime(2024, 3, 15, 14, 30, tzinfo=timezone.utc)` over calling `.replace()` on a naive object. Using `.replace()` on a DST-ambiguous time can attach the wrong UTC offset.
>
> > ---
>
> **`timedelta`** — Represents a fixed duration expressed internally as days, seconds, and microseconds.
>
> - Supports arithmetic with `datetime` (`dt + timedelta(days=7)`) and subtraction between two datetimes to produce a duration.
> - `.days` returns whole days; `.total_seconds()` returns the full span as a float.
>
> > [!warning] No months or years
> >
> > `timedelta` cannot represent a month or a year because their lengths vary. Use `dateutil.relativedelta` for calendar-aware month/year offsets.
>
> > ---
>
> **`timezone.utc`** — The built-in UTC timezone singleton from `datetime.timezone`.
>
> - Used as `tzinfo=timezone.utc` when creating or converting UTC datetimes; avoids importing third-party libraries for the common UTC case.
> - All other fixed offsets can be constructed with `timezone(timedelta(hours=n))`.
>
> > [!info] UTC is the canonical storage format
> >
> > Store all timestamps as UTC in databases, message queues, and log files. Convert to local time only at the presentation layer using `astimezone(ZoneInfo(...))`.
>
> > ---
>
> **`zoneinfo.ZoneInfo`** — Built-in IANA timezone database accessor (Python 3.9+), replacing `pytz`.
>
> - `ZoneInfo("Europe/Amsterdam")` returns a `tzinfo` object aware of DST rules for that region; pass it to `datetime` constructors or `astimezone()`.
> - Timezone names are case-sensitive; invalid names raise `ZoneInfoNotFoundError`.
>
> > [!warning] Prefer `zoneinfo` over `pytz`
> >
> > `pytz` requires `.localize()` for correct DST handling, which is easy to forget. `zoneinfo` follows the standard `datetime` API — pass the object directly as `tzinfo`. Use `pytz` only when targeting Python < 3.9.
>
> > ---
>
> **`strftime` / `strptime`** — Complementary functions for converting between `datetime` objects and formatted strings.
>
> - `dt.strftime(format)` serialises a datetime to a string using format codes (`%Y`, `%m`, `%d`, `%H`, `%M`, `%S`, `%f`, etc.).
> - `datetime.strptime(string, format)` parses a string back to a naive datetime — timezone must be attached manually afterwards if required.
>
> > [!info] `strptime` always returns naive
> >
> > Even if the input string contains `+05:30`, `strptime` ignores it unless `%z` is in the format. Parse timezone-aware strings with `datetime.fromisoformat()` (Python 3.7+) or `dateutil.parser.parse()` for maximum flexibility.
>
> > ---
>
> **ISO 8601** — International standard timestamp format: `2024-01-15T10:30:00+00:00`.
>
> - The universal interchange format for timestamps in APIs, databases, log files, and serialisation protocols.
> - `.isoformat()` produces it; `datetime.fromisoformat()` parses it. Python 3.11+ supports the trailing `Z` UTC marker; Python 3.7–3.10 require an explicit `+00:00` offset.
>
> > [!warning] Naive ISO strings lose timezone context
> >
> > `datetime(2024, 3, 15).isoformat()` returns `'2024-03-15T00:00:00'` with no offset. Any downstream system that assumes a timezone will interpret it differently. Always include the offset when exchanging timestamps.
>
> > ---
>
> **`dateutil.relativedelta`** — Calendar-aware interval from the `python-dateutil` package that supports months and years.
>
> - `relativedelta(months=1)` added to `datetime(2024, 1, 31)` returns `2024-02-29` (correct leap-year clamping), not a `timedelta` arithmetic error.
> - Supports combined offsets: `relativedelta(years=1, months=2, days=3)`.
>
> > [!info] Install separately
> >
> > `python-dateutil` is not in the standard library. Install with `pip install python-dateutil`. For projects that must avoid third-party dependencies, implement month arithmetic manually using `calendar.monthrange`.
>
> > ---
>
> **Unix timestamp** — A float representing elapsed seconds since the Unix epoch (1970-01-01 00:00:00 UTC).
>
> - `.timestamp()` converts a `datetime` to a Unix timestamp; `datetime.fromtimestamp(ts, tz=timezone.utc)` converts back.
> - Millisecond-precision timestamps (used by Kafka, JavaScript) are the Unix timestamp multiplied by 1 000.
>
> > [!warning] Always pass `tz` when converting back
> >
> > `datetime.fromtimestamp(ts)` uses the local system timezone, producing a naive datetime that differs across machines. Pass `tz=timezone.utc` to get a consistent, aware UTC datetime.
>
> > ---
>
> **`math` module** — Standard library module providing mathematical functions beyond Python's built-in operators.
>
> - Key functions: `floor`, `ceil`, `trunc`, `sqrt`, `isqrt`, `pow`, `log`, `log10`, `log2`, `exp`, `sin`, `cos`, `atan2`, `degrees`, `radians`, `isinf`, `isnan`, `isfinite`.
> - Constants: `math.pi`, `math.e`, `math.tau` (2π), `math.inf`, `math.nan`.
>
> > [!warning] `round()` uses banker's rounding
> >
> > Python's built-in `round(2.5)` returns `2` (rounds to even), not `3`. Use `math.floor(x + 0.5)` or `Decimal` rounding modes when you need "round half up" behaviour consistently.
>
> > ---
>
> **`Decimal`** — Fixed-precision decimal type from the `decimal` module, designed for exact base-10 arithmetic.
>
> - `Decimal('0.1') + Decimal('0.2') == Decimal('0.3')` is `True`; the equivalent float expression is `False` due to IEEE 754 representation error.
> - Required for financial calculations (prices, rates, weights, NAV) where float rounding errors accumulate to material differences.
>
> > [!warning] Always construct from strings, not floats
> >
> > `Decimal(0.1)` inherits the float's representation error; `Decimal('0.1')` is exact. Use string literals or integer arithmetic when initialising `Decimal` values.
>
> > ---
>
> **`random` module** — Standard library pseudorandom number generator based on the Mersenne Twister algorithm.
>
> - `random.seed(n)` makes the sequence reproducible; `randint(a, b)` is inclusive on both ends; `choice`, `choices`, `sample`, and `shuffle` operate on sequences. `random.Random(n)` creates an independent instance.
> - `weights=` in `random.choices` enables non-uniform sampling without normalising to a probability distribution.
>
> > [!warning] Not cryptographically secure
> >
> > Mersenne Twister output is predictable given sufficient observed values. Never use `random` for passwords, API keys, session tokens, or security nonces. Use the `secrets` module instead.
>
> > ---
>
> **`secrets` module** — Standard library module for cryptographically secure random generation (Python 3.6+).
>
> - `secrets.token_hex(n)` returns `2n` random hex characters; `secrets.token_urlsafe(n)` returns a URL-safe Base64 string; `secrets.choice(seq)` picks one element securely.
> - Backed by the OS CSPRNG (`os.urandom`); suitable for passwords, tokens, salts, and CSRF nonces.
>
> > [!info] `secrets` vs `random` — the rule
> >
> > Use `random` for simulations, sampling, and reproducible test data. Use `secrets` for anything that must be unpredictable to an adversary. The two modules are not interchangeable.
>
> > ---
>
> **`logging` module** — Standard library framework for structured, levelled, routable log output.
>
> - Five levels in ascending severity: `DEBUG` (10), `INFO` (20), `WARNING` (30), `ERROR` (40), `CRITICAL` (50). A logger only emits records at or above its configured level.
> - Architecture: `Logger` → `Handler` (StreamHandler, FileHandler, etc.) → `Formatter`. Loggers form a dot-separated hierarchy; child loggers propagate to parents unless `propagate=False`.
>
> > [!warning] Do not log with `print()`
> >
> > `print()` has no levels, no routing, no timestamps, and no way to disable per-module. In production, it mixes with application output and cannot be filtered. Use `logging.getLogger(__name__)` in every module.
>
> > ---
>
> **`os.environ`** — Dictionary-like mapping of the current process's environment variables.
>
> - `os.environ["KEY"]` raises `KeyError` if missing (fail-fast, use for required variables); `os.environ.get("KEY", default)` returns the default silently (use for optional config).
> - Setting `os.environ["KEY"] = value` modifies the current process only; the change does not persist after the process exits and does not propagate to the parent shell.
>
> > [!warning] Never hardcode secrets
> >
> > Secrets (passwords, API keys, connection strings) embedded in source code are exposed in version history and diff tools. Inject them via environment variables, a secrets manager (GCP Secret Manager, AWS Secrets Manager), or CI/CD platform secrets — never as literals in code.
>
> > ---
>
> **`configparser`** — Standard library INI-file parser that reads `[section]` / `key = value` configuration files.
>
> - All values are returned as strings; use `.getint()`, `.getfloat()`, `.getboolean()` for typed access with an optional `fallback=` default.
> - `fallback=` prevents `NoSectionError` / `NoOptionError` when a key is missing, making it safe for optional configuration with defaults.
>
> > [!info] `configparser` vs `tomllib`
> >
> > `configparser` is universally available and human-editable but string-only. `tomllib` (Python 3.11+ built-in, read-only) preserves native types (`int`, `bool`, `list`, `datetime`) without manual conversion. Prefer TOML for new projects.
>
> > ---
>
> **`tomllib`** — Read-only TOML parser built into Python 3.11+, returning a plain dict with native Python types.
>
> - TOML natively represents `int`, `float`, `bool`, `list`, `dict`, and `datetime`; no manual type conversion is needed unlike `configparser`.
> - Files must be opened in binary mode (`"rb"`); for writing TOML, add the third-party `tomli-w` package.
>
> > [!info] `tomllib` is read-only by design
> >
> > The built-in module intentionally omits a writer to keep the API minimal. For full TOML read/write support use `tomli` (Python < 3.11) for reading and `tomli-w` for writing, both from the same author as the stdlib implementation.
>
> > ---
>
> **`.env` file** — A plain-text file of `KEY=VALUE` pairs used to supply secrets and environment-specific settings for local development.
>
> - Loaded into `os.environ` by `python-dotenv` (`load_dotenv()`); values set this way are visible to `os.getenv()` and `os.environ` for the duration of the process.
> - Must be listed in `.gitignore` before any secrets are added; in CI/CD and production, replace `.env` files with platform-native secret injection.
>
> > [!danger] Never commit `.env` to version control
> >
> > A committed `.env` exposes credentials in git history even after deletion. If a secret is accidentally committed, rotate it immediately — history scrubbing alone is insufficient because forks and mirrors may already hold the value.

Python's `datetime` module provides date/time types, `timedelta` intervals, and timezone-aware operations. This note also covers math, random number generation, logging, and configuration/environment variable management — common utility patterns for data engineering.
### Key terms used in this note

| Term | Plain-English definition | Why it matters here | Common mistake / confusion |
|---|---|---|---|
| **datetime** | Object combining date and time. Can be "naive" (no timezone) or "aware" (has `tzinfo`). | The primary type for timestamps in Python. | Naive datetimes have no timezone — comparing naive and aware raises `TypeError`. |
| **timedelta** | Represents a duration: days, seconds, microseconds. Supports arithmetic with `datetime`. | Date math — add 30 days, compute age, calculate intervals between events. | `timedelta` has no months/years — months vary in length. Use `dateutil.relativedelta`. |
| **timezone.utc** | The UTC timezone constant from `datetime`. | Always store and transmit timestamps in UTC. | `datetime.now()` returns naive local time. Use `datetime.now(timezone.utc)` for UTC. |
| **zoneinfo.ZoneInfo** | IANA timezone database access (Python 3.9+). E.g., `ZoneInfo("Europe/Amsterdam")`. | Convert UTC to local time for display. | Timezone names are case-sensitive — `"europe/amsterdam"` fails silently or raises. |
| **strftime / strptime** | `strftime` formats datetime → string. `strptime` parses string → datetime. | Convert between human-readable text and datetime objects. | `strptime` returns naive datetime — attach timezone manually if needed. |
| **ISO 8601** | Standard format: `2024-01-15T10:30:00+00:00`. Used by APIs, databases, and logs. | Universal interoperable timestamp format. | Forgetting the timezone offset in ISO format — naive ISO strings lose timezone info. |
| **math module** | Standard library for mathematical functions: `ceil`, `floor`, `sqrt`, `log`, `pi`. | Rounding, statistics, scientific computation. | `math.floor(-2.5)` returns `-3`, not `-2` — floor always rounds toward negative infinity. |
| **random module** | Pseudorandom number generation. NOT cryptographically secure. | Sampling, shuffling, generating test data. | Using `random` for security tokens — use `secrets` module instead. |
| **logging module** | Standard library for structured log output with levels (DEBUG, INFO, WARNING, ERROR, CRITICAL). | Production observability — structured, leveled, configurable output. | Using `print()` instead of `logging` — no levels, no routing, no structured output. |
| **os.environ** | Dictionary-like access to environment variables. | Configuration, secrets, deployment-specific settings. | `os.environ['MISSING']` raises `KeyError` — use `os.environ.get('KEY', 'default')`. |

### What this note covers

- **Date and Time** — `datetime`, `date`, `time`, `timedelta`, timezones, `strftime`/`strptime`, ISO 8601, business day calculations
- **Math and Random** — `math` module, rounding, `Decimal`, `random`, `secrets`, `statistics`
- **Logging** — `logging` module, levels, formatters, handlers, structured logging
- **Configuration** — `os.environ`, `configparser`, `.env` files, `dataclass`-based config

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

    2026-03-25 05:48:19.510467
    2026-03-25
    05:48:19.510467
    <class 'datetime.datetime'>
    
    2024-03-15 14:30:45
    2024-03-15
    14:30:45
    2024-03-15 14:30:45.123456

#### datetime .year, .month, .day, .hour — accessing components

Access individual components as attributes: `.year`, `.month`, `.day`, `.hour`, `.minute`, `.second`, `.microsecond`. `.weekday()` returns 0=Monday through 6=Sunday; `.isoweekday()` returns 1=Monday through 7=Sunday.

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

### Unix timestamps

#### Timestamp (Unix epoch) conversions

`.timestamp()` converts a datetime to a float of seconds since the Unix epoch (1970-01-01 UTC). `datetime.fromtimestamp(ts, tz=timezone.utc)` converts back — always pass `tz=timezone.utc` to get an aware datetime.

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

    1774414099.520628
    1774414099
    
    2026-03-25 05:48:19.520628
    2026-03-25 04:48:19.520628+00:00
    
    1774414099.5206285
    1970-01-01 00:00:00+00:00
    1774414100

### Parsing and formatting

#### Parsing strings -> datetime (strptime)

`datetime.strptime(string, format)` parses a date string using format codes: `%Y` (4-digit year), `%m` (month), `%d` (day), `%H` (24h hour), `%M` (minute), `%S` (second), `%f` (microsecond), `%p` (AM/PM).

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

    '2024-03-15 14:30:45' -> 2024-03-15 14:30:45
    '15/03/2024' -> 2024-03-15 00:00:00
    'March 15, 2024 2:30 PM' -> 2024-03-15 14:30:00
    '2024-03-15T14:30:45' -> 2024-03-15 14:30:45
    '2024-03-15T14:30:45.123456' -> 2024-03-15 14:30:45.123456
    'Fri, 15 Mar 2024 14:30:45' -> 2024-03-15 14:30:45

#### Formatting datetime -> string (strftime)

`dt.strftime(format)` formats a datetime as a string. Same format codes as `strptime`. Common patterns: `'%Y-%m-%dT%H:%M:%S'` (ISO 8601), `'%Y-%m-%d'` (date only), `'%I:%M %p'` (12-hour with AM/PM).

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

#### strftime code reference

```python
# strftime code reference — complete list of format codes

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

### ISO 8601 and timezone handling

#### ISO 8601 conversions | isoformat() and fromisoformat()

`.isoformat()` returns ISO 8601 format. `datetime.fromisoformat()` parses it back. Python 3.7+ supports offset strings (`+05:30`); Python 3.11+ supports `Z` (UTC marker).

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

    2024-03-15T14:30:45.123456
    2024-03-15
    14:30:45.123456
    
    2024-03-15 14:30:45.123456
    2024-03-15 14:30:45+05:30
    2024-03-15 14:30:45+00:00

#### zoneinfo.ZoneInfo — timezone-aware datetime creation

Pass `tzinfo=ZoneInfo("America/New_York")` to the `datetime` constructor to create a timezone-aware datetime. `timezone.utc` is the built-in UTC timezone. Naive datetimes (no `tzinfo`) should be avoided in pipelines.

```python

naive = datetime(2024, 3, 15, 14, 30, 45)
print(f"Naive (no tz):   {naive}, tzinfo={naive.tzinfo}")

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

    2024-03-15 14:30:45, tzinfo=None
    
    2024-03-15 14:30:45+00:00
    2024-03-15 14:30:45-04:00
    2024-03-15 14:30:45+00:00
    2024-03-15 14:30:45+09:00
    2024-03-15 14:30:45+05:30

#### datetime.astimezone — converting between timezones

`.astimezone(ZoneInfo('timezone'))` converts an aware datetime to a different timezone while preserving the same instant in time. The underlying UTC value stays the same — only the offset and display change.

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

    2026-03-25 04:48:19.547681+00:00
    2026-03-25 00:48:19.547681-04:00
    2026-03-25 04:48:19.547681+00:00
    2026-03-25 13:48:19.547681+09:00
    2026-03-25 15:48:19.547681+11:00
    2026-03-25 10:18:19.547681+05:30
    2026-03-25 08:48:19.547681+04:00
    2026-03-25 01:48:19.547681-03:00

#### DateTimeOffset equivalent — localize naive datetime

`.replace(tzinfo=ZoneInfo(...))` attaches a timezone to a naive datetime without changing the time value. `timezone(timedelta(hours=5, minutes=30))` creates a fixed-offset timezone for systems that don't use IANA timezone names.

```python

naive = datetime(2024, 3, 15, 14, 30, 45)
aware = naive.replace(tzinfo=ZoneInfo("US/Eastern"))
aware  # Naive -> aware

# Fixed offset timezone
offset_5_30 = timezone(timedelta(hours=5, minutes=30))
dt_offset = datetime(2024, 3, 15, 14, 30, 45, tzinfo=offset_5_30)
dt_offset  # Fixed +5:30
```

    2024-03-15 14:30:45-04:00
    2024-03-15 14:30:45+05:30

### Date/time arithmetic

#### Date/time arithmetic with timedelta | add and subtract intervals

`timedelta(days=, hours=, minutes=, seconds=, weeks=)` creates an interval. Add or subtract from a `datetime` with `+` and `-`. Subtracting two datetimes returns a `timedelta`. `.days` gives whole days; `.total_seconds()` gives the total interval in seconds.

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

#### datetime: supports full arithmetic

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

    2024-03-15 14:30:45
    2024-03-16 14:30:45
    2024-03-15 12:30:45
    2024-03-15 15:00:45
    2024-03-15 14:31:30
    2024-03-15 14:30:45.500000
    2024-03-17 02:30:45
    2024-03-16 17:01:00

#### date: only days, no hours/minutes

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

    2024-03-15
    2024-03-22
    2024-02-14
    2024-03-22
    Diff 2024-03-15 to 2024-12-25: 285 days

#### time: NO arithmetic support

> [!warning] time Has No Arithmetic
>
> `time + timedelta(hours=1)` raises `TypeError`. Workaround: combine with a dummy date, do the arithmetic on the datetime, then extract the time component.

> [!success] Use datetime.combine for time arithmetic
>
> Combine `time` with a dummy date via `datetime.combine(date.today(), t)`, perform the arithmetic on the resulting `datetime`, then extract `.time()`. This is the standard workaround.

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

    14:30:45
    16:45:45
    13:45:45

#### timestamp: just a float, arithmetic is trivial

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

    1710509445.0
    1710595845.0
    1710513045.0
    1710511245.0
    1710509490.0
    2024-03-16 14:30:45

#### dateutil.relativedelta — add months and years to dates

`timedelta` doesn't support months or years (variable-length intervals). `dateutil.relativedelta` handles this — `relativedelta(months=1)` correctly handles month-end clamping (Jan 31 + 1 month = Feb 29 in leap year). Install via `pip install python-dateutil`.

```python

dt = datetime(2024, 1, 31, 14, 30, 0)
dt  # Original
dt + relativedelta(months=1)  # + 1 month — Feb 29 (leap year!)
dt + relativedelta(months=6)  # + 6 months
dt + relativedelta(years=1)  # + 1 year
dt - relativedelta(months=3)  # - 3 months
dt + relativedelta(years=1, months=2, days=3)  # + 1y 2m 3d
```

    2024-01-31 14:30:00
    2024-02-29 14:30:00
    2024-07-31 14:30:00
    2025-01-31 14:30:00
    2023-10-31 14:30:00
    2025-04-03 14:30:00

## Math and Random

### Math built-ins and math module

#### Built-in math — abs(), max(), min(), divmod(), clamp

> [!info] Math built-ins
>
> - `abs()`, `max()`, `min()` — built-in, no import needed
> - `max`/`min` accept any number of arguments
> - Clamp pattern: `max(lo, min(val, hi))`
> - `math` module adds `floor`, `ceil`, `sqrt`, `log`, `pow`, and trig functions
> - For vectorized array math, use NumPy instead

```python
# Basic math — abs, max, min are built-in; clamp uses max(lo, min(val, hi))

abs(-42)
max(10, 20)
min(10, 20)
max(0, min(15, 10))  # clamp(15, 0,10)
```

    42
    20
    10
    10

#### math.floor, math.ceil, round — rounding strategies

```python
# Rounding — floor, ceil, round with banker's rounding default

math.floor(3.7)  # → 3
math.ceil(3.2)  # → 4
round(3.5)  # → 4 (banker's)
round(2.5)  # → 2 (banker's — rounds to even!)
math.trunc(3.9)  # → 3
int(3.9)
```

    3
    4
    4
    2
    3
    3

#### math.sqrt, math.log, math.pow — powers, roots, logarithms

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

    1024
    1024.0
    1024
    12.0
    12
    4.605170185988092
    2.0
    10.0
    2.718281828459045

#### math.sin, math.cos, math.pi, math.e — trigonometry and constants

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

    3.141592653589793
    2.718281828459045
    6.283185307179586
    1.0
    1.0
    0.7853981633974483
    180.0
    3.141592653589793

#### math.inf, math.nan, math.isnan — special float values

```python
# Special float values — inf, nan, and detection functions

math.inf
math.nan
math.isnan(math.nan)  # math.isnan(nan)
math.isinf(math.inf)  # math.isinf(inf)
math.isfinite(42)
```

    inf
    nan
    True
    True
    True

#### statistics.quantiles — percentile calculation

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

    [3.1, 6.7, 12.5, 15.3, 22.0, 33.4, 45.2, 51.8, 78.9, 99.1]
    36.80
    27.70
    32.10
    108.19 ms

### Random number generation

#### random module | pseudo-random numbers with seed for reproducibility

`random.seed(n)` makes results reproducible. `randint(a, b)` returns `[a, b]` inclusive. `random()` returns `[0.0, 1.0)`. `choice()` picks one element; `choices(k=n)` picks n with replacement; `sample(k=n)` picks n without replacement. `shuffle()` reorders in place.

```python

random.seed(42)  # seed for reproducibility (like C# new Random(42))

[random.randint(1, 100) for _ in range(5)]  # [1, 100] inclusive both ends
[random.randrange(1, 101) for _ in range(5)]  # [1, 101) — like C# Next(1, 101)

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

    [82, 15, 4, 95, 36]
    [32, 29, 18, 95, 14]
    
    [0.6767, 0.8922, 0.0869, 0.4219, 0.0298]
    [2.97, 5.55, 1.24, 2.79, 6.85]
    
    yellow
    ['red', 'blue', 'yellow']
    ['red', 'yellow']
    
    ['A', 'B', 'C', 'D', 'E']
    ['E', 'A', 'B', 'C', 'D']

#### random.choices weights= — weighted random selection

Pass `weights=` to `random.choices` for non-uniform sampling. Weights don't need to sum to 100 — they're relative. Useful for generating realistic test data with skewed distributions (e.g., 60% page_view, 10% purchase).

```python

events = ["page_view", "click", "purchase", "signup"]
weights = [60, 25, 10, 5]  # percentage weights
picks = random.choices(events, weights=weights, k=20)
picks  # Weighted picks (20)
dict(Counter(picks))  # Distribution
```

    ['page_view', 'click', 'page_view', 'page_view', 'page_view', 'page_view', 'page_view', 'page_view', 'page_view', 'page_view', 'purchase', 'page_view', 'page_view', 'click', 'purchase', 'page_view', 'page_view', 'page_view', 'click', 'click']
    {'page_view': 14, 'click': 4, 'purchase': 2}

#### random + datetime — synthetic OHLCV test data generation

```python
# Synthetic test data generation — realistic event records for pipelines

event_types = ["page_view", "click", "purchase", "signup"]
regions = ["us-east-1", "eu-west-1", "ap-south-1"]
rng = random.Random(123)  # independent RNG instance (like C# new Random(123))

print(f"{'event_id':<12} {'type':<12} {'region':<12} {'revenue':>8}")
for i in range(8):
    event_id = f"evt_{i+1:04d}"
    evt_type = rng.choice(event_types)
    region = rng.choice(regions)
    revenue = round(rng.uniform(5, 200), 2) if evt_type == "purchase" else 0.0
    print(f"{event_id:<12} {evt_type:<12} {region:<12} {revenue:>8.2f}")
```

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

    05:52:00 [DEBUG   ] PipelineDemo: Debug: starting pipeline
    05:52:00 [INFO    ] PipelineDemo: Info: processed 42 rows
    05:52:00 [WARNING ] PipelineDemo: Warning: schema drift in events_raw
    05:52:00 [ERROR   ] PipelineDemo: Error: failed partition 2024-03-15
    05:52:00 [CRITICAL] PipelineDemo: Critical: pipeline halted

#### logging.getLogger — simulating a pipeline run with structured logs

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

    05:52:09 [INFO    ] ETL: Pipeline started
    05:52:09 [INFO    ] ETL: Loaded events_raw: 1924 rows in 404ms
    05:52:09 [INFO    ] ETL: Loaded users: 4606 rows in 2206ms
    05:52:09 [INFO    ] ETL: Loaded transactions: 3757 rows in 1343ms
    05:52:09 [INFO    ] ETL: Pipeline completed

#### logging.Formatter — JSON structured log output

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

    {"timestamp": "2026-03-25T05:52:11", "level": "INFO", "logger": "ETL.json", "message": "Loaded events_raw: 8500 rows in 1200ms"}
    {"timestamp": "2026-03-25T05:52:11", "level": "WARNING", "logger": "ETL.json", "message": "Schema drift detected in users"}

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

> [!info] os.environ vs os.getenv
>
> `os.environ["KEY"]` raises `KeyError` if missing. `os.getenv("KEY", default)` returns the default silently. Use `os.environ` when the variable MUST exist (fail-fast); use `os.getenv` for optional configuration.

    Alex
    ELYSIUM
    c:\Users\aperi\DEV\LANG\.lang\Scripts;C:\Users\aperi\DEV\LANG\.lang\Scripts;C:\U...
    
    localhost
    not set
    staging
    not set

#### os.environ.items() — list all environment variables

```python
# List all environment variables — diagnostic inspection

for i, (key, val) in enumerate(os.environ.items()):
    if i >= 10: break
    if len(val) > 60: val = val[:60] + "..."
    print(f"  {key} = {val}")
print(f"... ({len(os.environ)} total)")
```

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

### Config files — configparser, TOML, .env

#### configparser — INI-style configuration

`configparser` reads INI-format files (sections with `[name]`, key-value pairs). All values are strings — use `.getint()`, `.getboolean()`, `.getfloat()` for type-safe access with optional `fallback=` defaults. Built-in, no dependencies.

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

    events_etl
    5000
    3
    True
    prod-db
    INFO
    30

#### configparser.sections, .get — reading config sections and keys

`.sections()` lists all section names. Access keys with `config['section']['key']` or `config.get('section', 'key', fallback=default)`.

```python

config.sections()  # Sections
list(config['pipeline'].keys())  # Pipeline keys
```

    ['pipeline', 'database', 'logging']
    ['name', 'batch_size', 'max_retries', 'enabled']

#### tomllib — TOML modern config format (Python 3.11+)

`tomllib` (read-only, built-in since Python 3.11) parses TOML files into dicts. Unlike `configparser`, TOML preserves native types: `int`, `bool`, `list`, `datetime`. Open in binary mode (`"rb"`). For writing TOML, use `tomli-w` (third-party).

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

    {'name': 'events_etl', 'batch_size': 5000, 'max_retries': 3, 'enabled': True, 'tags': ['production', 'clickstream']}
    events_etl
    ['production', 'clickstream']
    5432

#### .env files

> [!danger] Never Commit .env to Git
>
> `.env` files hold secrets for local development. `python-dotenv` loads them into `os.environ`. Always add `.env` to `.gitignore`. In production, use a secret manager instead.

> [!success] Secure secret management
>
> Add `.env` to `.gitignore` immediately when creating the file. Use `python-dotenv` only for local development. In CI/CD and production, inject secrets through the platform's secret management (GCP Secret Manager, AWS Secrets Manager, GitHub Actions secrets, K8s Secrets).

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

      DATABASE_HOST = localhost
      DATABASE_PORT = 5432
      API_KEY = sk-test-abc123
    
    C:\Users\aperi\AppData\Local\Temp\config_demo_s32pafzs

## Warnings

> [!warning] Naive datetimes lose timezone information
>
> `datetime.now()` returns a naive datetime (no timezone). Comparing or subtracting naive and aware datetimes raises `TypeError`. Storing naive timestamps leads to ambiguous data.

> [!success] Correct pattern
>
> Always use `datetime.now(timezone.utc)` for UTC timestamps. Convert to local time only for display using `dt.astimezone(ZoneInfo("Europe/Amsterdam"))`.

> [!warning] `random` module is not cryptographically secure
>
> `random.random()` uses a Mersenne Twister PRNG — predictable given enough output. Never use for passwords, tokens, or security-sensitive applications.

> [!success] Correct pattern
>
> Use `secrets.token_hex()` or `secrets.token_urlsafe()` for security tokens. Use `secrets.choice()` for cryptographically secure random selection.

> [!warning] `print()` instead of `logging` in production code
>
> `print()` has no log levels, no routing, no structured output, and no way to disable it per-module. It makes debugging production issues nearly impossible.

> [!success] Correct pattern
>
> Use `logging.getLogger(__name__)` with appropriate levels. Configure handlers for stdout, files, or structured JSON output.

## Recommendations

- **Store all timestamps in UTC** — convert to local time only for display. This prevents DST ambiguity and simplifies cross-timezone operations.
- **Use `zoneinfo.ZoneInfo` (Python 3.9+)** instead of `pytz` — it's built-in, follows the standard `datetime` API, and doesn't require `.localize()`.
- **Use `Decimal` for financial calculations** — `float` introduces rounding errors. `Decimal('0.1') + Decimal('0.2') == Decimal('0.3')`.
- **Use `secrets` for security-sensitive randomness** — tokens, passwords, API keys.
- **Use structured logging** — `logging` with `JSONFormatter` or `structlog` for machine-parseable log output.
- **Use environment variables for deployment config** — `os.environ.get('KEY', 'default')` with `.env` files for local development.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `TypeError: can't compare offset-naive and offset-aware datetimes` | Mixing naive and aware datetimes | Make all datetimes aware: `dt.replace(tzinfo=timezone.utc)` |
| `strptime` returns naive datetime | `strptime` doesn't parse timezone by default | Attach timezone manually or parse with `dateutil.parser.parse()` |
| Float arithmetic produces wrong result (`0.1 + 0.2 != 0.3`) | IEEE 754 floating-point representation | Use `Decimal` for exact arithmetic or `math.isclose()` for comparisons |
| `KeyError` on `os.environ['MISSING']` | Environment variable not set | Use `os.environ.get('KEY', 'default')` for safe access |
| Logging output not appearing | Logger not configured or level too high | Call `logging.basicConfig(level=logging.DEBUG)` at startup |
| `random.seed()` produces same sequence | Seed set to fixed value | Remove fixed seed for production; use fixed seed only for reproducible tests |

