---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [datetime, timezones, date arithmetic, math operations, utility functions]
keywords: [datetime, timedelta, timezone, pytz, math, random, uuid, hashlib, date arithmetic]
description: "Python date, time, math and utilities reference with executable examples and cell outputs — covers datetime, timezones, timedelta, math, random, and common utility functions. See [[11_cs_datetimemathutils]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[11_cs_datetimemathutils]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 11. Date, Time, Math & Utilities - Python

## Date and Time

```python
# Creating date and time objects
from datetime import datetime, date, time, timedelta

# Current date and time
now = datetime.now()             # local time (naive - no timezone)
today = date.today()             # date only
current_time = datetime.now().time()  # time only

print(f"datetime.now():  {now}")
print(f"date.today():    {today}")
print(f"time now:        {current_time}")
print(f"type:            {type(now)}")

# Creating specific dates/times
dt = datetime(2024, 3, 15, 14, 30, 45)       # year, month, day, hour, min, sec
d = date(2024, 3, 15)                         # year, month, day
t = time(14, 30, 45)                          # hour, min, sec
dt_micro = datetime(2024, 3, 15, 14, 30, 45, 123456)  # with microseconds

print(f"\nSpecific datetime: {dt}")
print(f"Specific date:     {d}")
print(f"Specific time:     {t}")
print(f"With microseconds: {dt_micro}")
```

    datetime.now():  2026-03-25 05:48:19.510467
    date.today():    2026-03-25
    time now:        05:48:19.510467
    type:            <class 'datetime.datetime'>
    
    Specific datetime: 2024-03-15 14:30:45
    Specific date:     2024-03-15
    Specific time:     14:30:45
    With microseconds: 2024-03-15 14:30:45.123456

#### Accessing date/time components

```python
# Accessing date/time components
dt = datetime(2024, 3, 15, 14, 30, 45, 123456)

print("=== Components ===")
print(f"Year:        {dt.year}")
print(f"Month:       {dt.month}")
print(f"Day:         {dt.day}")
print(f"Hour:        {dt.hour}")
print(f"Minute:      {dt.minute}")
print(f"Second:      {dt.second}")
print(f"Microsecond: {dt.microsecond}")
print(f"Weekday:     {dt.weekday()}")      # 0=Monday, 6=Sunday
print(f"ISO weekday: {dt.isoweekday()}")   # 1=Monday, 7=Sunday
print(f"Day of year: {dt.timetuple().tm_yday}")
print(f"Week number: {dt.isocalendar()[1]}")
```

    === Components ===
    Year:        2024
    Month:       3
    Day:         15
    Hour:        14
    Minute:      30
    Second:      45
    Microsecond: 123456
    Weekday:     4
    ISO weekday: 5
    Day of year: 75
    Week number: 11

#### Timestamp (Unix epoch) conversions

```python
# Timestamp (Unix epoch) conversions
import time
from datetime import timezone

now = datetime.now()

# datetime -> timestamp (seconds since 1970-01-01 00:00:00 UTC)
ts = now.timestamp()
print(f"Timestamp (float): {ts}")
print(f"Timestamp (int):   {int(ts)}")

# timestamp -> datetime
dt_from_ts = datetime.fromtimestamp(ts)                     # local time
dt_from_ts_utc = datetime.fromtimestamp(ts, tz=timezone.utc)  # UTC (preferred)
print(f"\nFrom timestamp (local): {dt_from_ts}")
print(f"From timestamp (UTC):   {dt_from_ts_utc}")

# time.time() - current timestamp
print(f"\ntime.time(): {time.time()}")

# Epoch - use timezone-aware UTC for correct calculation
epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
now_utc = datetime.now(timezone.utc)
print(f"Epoch: {epoch}")
print(f"Seconds since epoch: {(now_utc - epoch).total_seconds():.0f}")
```

    Timestamp (float): 1774414099.520628
    Timestamp (int):   1774414099
    
    From timestamp (local): 2026-03-25 05:48:19.520628
    From timestamp (UTC):   2026-03-25 04:48:19.520628+00:00
    
    time.time(): 1774414099.5206285
    Epoch: 1970-01-01 00:00:00+00:00
    Seconds since epoch: 1774414100

#### Parsing strings -> datetime (strptime)

```python
# Parsing strings -> datetime (strptime)
# strptime = "string parse time"

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

print("=== String -> datetime (strptime) ===")
print(f"'{s1}' -> {dt1}")
print(f"'{s2}' -> {dt2}")
print(f"'{s3}' -> {dt3}")
print(f"'{s4}' -> {dt4}")
print(f"'{s5}' -> {dt5}")
print(f"'{s6}' -> {dt6}")
```

    === String -> datetime (strptime) ===
    '2024-03-15 14:30:45' -> 2024-03-15 14:30:45
    '15/03/2024' -> 2024-03-15 00:00:00
    'March 15, 2024 2:30 PM' -> 2024-03-15 14:30:00
    '2024-03-15T14:30:45' -> 2024-03-15 14:30:45
    '2024-03-15T14:30:45.123456' -> 2024-03-15 14:30:45.123456
    'Fri, 15 Mar 2024 14:30:45' -> 2024-03-15 14:30:45

#### Formatting datetime -> string (strftime)

```python
# Formatting datetime -> string (strftime)
# strftime = "string format time"

dt = datetime(2024, 3, 15, 14, 30, 45, 123456)

print("=== datetime -> String (strftime) ===")
print(f"ISO 8601:       {dt.strftime('%Y-%m-%dT%H:%M:%S')}")
print(f"Date only:      {dt.strftime('%Y-%m-%d')}")
print(f"Time only:      {dt.strftime('%H:%M:%S')}")
print(f"US format:      {dt.strftime('%m/%d/%Y')}")
print(f"EU format:      {dt.strftime('%d/%m/%Y')}")
print(f"Long date:      {dt.strftime('%B %d, %Y')}")
print(f"Short date:     {dt.strftime('%b %d, %Y')}")
print(f"12-hour:        {dt.strftime('%I:%M %p')}")
print(f"Day of week:    {dt.strftime('%A')}")
print(f"Short day:      {dt.strftime('%a')}")
print(f"With micro:     {dt.strftime('%Y-%m-%dT%H:%M:%S.%f')}")
print(f"RFC 2822:       {dt.strftime('%a, %d %b %Y %H:%M:%S')}")
print(f"Compact:        {dt.strftime('%Y%m%d%H%M%S')}")
```

    === datetime -> String (strftime) ===
    ISO 8601:       2024-03-15T14:30:45
    Date only:      2024-03-15
    Time only:      14:30:45
    US format:      03/15/2024
    EU format:      15/03/2024
    Long date:      March 15, 2024
    Short date:     Mar 15, 2024
    12-hour:        02:30 PM
    Day of week:    Friday
    Short day:      Fri
    With micro:     2024-03-15T14:30:45.123456
    RFC 2822:       Fri, 15 Mar 2024 14:30:45
    Compact:        20240315143045

```python
# All strftime Codes
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

#### ISO 8601 conversions

```python
# ISO 8601 conversions
dt = datetime(2024, 3, 15, 14, 30, 45, 123456)

# datetime -> ISO 8601 string
iso_str = dt.isoformat()
print(f"isoformat():     {iso_str}")              # 2024-03-15T14:30:45.123456
print(f"date.isoformat: {dt.date().isoformat()}")  # 2024-03-15
print(f"time.isoformat: {dt.time().isoformat()}")  # 14:30:45.123456

# ISO 8601 string -> datetime
from_iso = datetime.fromisoformat("2024-03-15T14:30:45.123456")
print(f"\nfromisoformat(): {from_iso}")

# With timezone offset (Python 3.7+)
from_iso_tz = datetime.fromisoformat("2024-03-15T14:30:45+05:30")
print(f"With offset:     {from_iso_tz}")

# With Z (Python 3.11+)
from_iso_z = datetime.fromisoformat("2024-03-15T14:30:45Z")
print(f"With Z (UTC):    {from_iso_z}")
```

    isoformat():     2024-03-15T14:30:45.123456
    date.isoformat: 2024-03-15
    time.isoformat: 14:30:45.123456
    
    fromisoformat(): 2024-03-15 14:30:45.123456
    With offset:     2024-03-15 14:30:45+05:30
    With Z (UTC):    2024-03-15 14:30:45+00:00

#### Timezone management

```python
# Timezone management
from datetime import timezone
from zoneinfo import ZoneInfo  # Python 3.9+ (built-in)

# Naive vs aware datetimes
naive = datetime(2024, 3, 15, 14, 30, 45)
print(f"Naive (no tz):   {naive}, tzinfo={naive.tzinfo}")

# Creating timezone-aware datetimes
utc_dt = datetime(2024, 3, 15, 14, 30, 45, tzinfo=timezone.utc)
ny_dt = datetime(2024, 3, 15, 14, 30, 45, tzinfo=ZoneInfo("America/New_York"))
london_dt = datetime(2024, 3, 15, 14, 30, 45, tzinfo=ZoneInfo("Europe/London"))
tokyo_dt = datetime(2024, 3, 15, 14, 30, 45, tzinfo=ZoneInfo("Asia/Tokyo"))
india_dt = datetime(2024, 3, 15, 14, 30, 45, tzinfo=ZoneInfo("Asia/Kolkata"))

print(f"\nUTC:             {utc_dt}")
print(f"New York:        {ny_dt}")
print(f"London:          {london_dt}")
print(f"Tokyo:           {tokyo_dt}")
print(f"India:           {india_dt}")
```

    Naive (no tz):   2024-03-15 14:30:45, tzinfo=None
    
    UTC:             2024-03-15 14:30:45+00:00
    New York:        2024-03-15 14:30:45-04:00
    London:          2024-03-15 14:30:45+00:00
    Tokyo:           2024-03-15 14:30:45+09:00
    India:           2024-03-15 14:30:45+05:30

#### Converting between timezones

```python
# Converting between timezones
utc_now = datetime.now(timezone.utc)
print(f"\nUTC now:         {utc_now}")
print(f"-> New York:     {utc_now.astimezone(ZoneInfo('America/New_York'))}")
print(f"-> London:       {utc_now.astimezone(ZoneInfo('Europe/London'))}")
print(f"-> Tokyo:        {utc_now.astimezone(ZoneInfo('Asia/Tokyo'))}")
print(f"-> Sydney:       {utc_now.astimezone(ZoneInfo('Australia/Sydney'))}")
print(f"-> India:        {utc_now.astimezone(ZoneInfo('Asia/Kolkata'))}")
print(f"-> Dubai:        {utc_now.astimezone(ZoneInfo('Asia/Dubai'))}")
print(f"-> São Paulo:    {utc_now.astimezone(ZoneInfo('America/Sao_Paulo'))}")
```

    
    UTC now:         2026-03-25 04:48:19.547681+00:00
    -> New York:     2026-03-25 00:48:19.547681-04:00
    -> London:       2026-03-25 04:48:19.547681+00:00
    -> Tokyo:        2026-03-25 13:48:19.547681+09:00
    -> Sydney:       2026-03-25 15:48:19.547681+11:00
    -> India:        2026-03-25 10:18:19.547681+05:30
    -> Dubai:        2026-03-25 08:48:19.547681+04:00
    -> São Paulo:    2026-03-25 01:48:19.547681-03:00

<h4><code style="font-size:0.75em">DateTimeOffset</code> equivalent — localize naive datetime</h4>

```python
# Make naive datetime timezone-aware
naive = datetime(2024, 3, 15, 14, 30, 45)
aware = naive.replace(tzinfo=ZoneInfo("US/Eastern"))
print(f"\nNaive -> aware:  {aware}")

# Fixed offset timezone
offset_5_30 = timezone(timedelta(hours=5, minutes=30))
dt_offset = datetime(2024, 3, 15, 14, 30, 45, tzinfo=offset_5_30)
print(f"Fixed +5:30:     {dt_offset}")
```

    
    Naive -> aware:  2024-03-15 14:30:45-04:00
    Fixed +5:30:     2024-03-15 14:30:45+05:30

#### Date/time arithmetic with timedelta

```python
# Date/time arithmetic with timedelta
from datetime import timedelta

dt = datetime(2024, 3, 15, 14, 30, 45)

# Adding/subtracting time
print("=== timedelta Arithmetic ===")
print(f"Original:          {dt}")
print(f"+ 7 days:          {dt + timedelta(days=7)}")
print(f"- 30 days:         {dt - timedelta(days=30)}")
print(f"+ 2 hours:         {dt + timedelta(hours=2)}")
print(f"+ 90 minutes:      {dt + timedelta(minutes=90)}")
print(f"+ 1 week, 3h, 30m: {dt + timedelta(weeks=1, hours=3, minutes=30)}")
print(f"- 6 months (approx): {dt - timedelta(days=180)}")

# Difference between dates
dt1 = datetime(2024, 3, 15)
dt2 = datetime(2024, 12, 25)
diff = dt2 - dt1

print(f"\n=== Date Difference ===")
print(f"From {dt1.date()} to {dt2.date()}")
print(f"Difference:        {diff}")
print(f"Days:              {diff.days}")
print(f"Total seconds:     {diff.total_seconds()}")

# Comparing dates
print(f"\ndt1 < dt2:   {dt1 < dt2}")
print(f"dt1 == dt2:  {dt1 == dt2}")
print(f"dt1 > dt2:   {dt1 > dt2}")
```

    === timedelta Arithmetic ===
    Original:          2024-03-15 14:30:45
    + 7 days:          2024-03-22 14:30:45
    - 30 days:         2024-02-14 14:30:45
    + 2 hours:         2024-03-15 16:30:45
    + 90 minutes:      2024-03-15 16:00:45
    + 1 week, 3h, 30m: 2024-03-22 18:00:45
    - 6 months (approx): 2023-09-17 14:30:45
    
    === Date Difference ===
    From 2024-03-15 to 2024-12-25
    Difference:        285 days, 0:00:00
    Days:              285
    Total seconds:     24624000.0
    
    dt1 < dt2:   True
    dt1 == dt2:  False
    dt1 > dt2:   False

#### Arithmetic on different date/time objects

```python
# Arithmetic on different date/time objects
from datetime import datetime, date, time, timedelta
```

#### datetime: supports full arithmetic

```python
# datetime: supports full arithmetic
dt = datetime(2024, 3, 15, 14, 30, 45)
print("=== datetime arithmetic ===")
print(f"Original:        {dt}")
print(f"+ 1 day:         {dt + timedelta(days=1)}")
print(f"- 2 hours:       {dt - timedelta(hours=2)}")
print(f"+ 30 minutes:    {dt + timedelta(minutes=30)}")
print(f"+ 45 seconds:    {dt + timedelta(seconds=45)}")
print(f"+ 500ms:         {dt + timedelta(milliseconds=500)}")
print(f"+ 1.5 days:      {dt + timedelta(days=1.5)}")
print(f"Combined:        {dt + timedelta(days=1, hours=2, minutes=30, seconds=15)}")
```

    === datetime arithmetic ===
    Original:        2024-03-15 14:30:45
    + 1 day:         2024-03-16 14:30:45
    - 2 hours:       2024-03-15 12:30:45
    + 30 minutes:    2024-03-15 15:00:45
    + 45 seconds:    2024-03-15 14:31:30
    + 500ms:         2024-03-15 14:30:45.500000
    + 1.5 days:      2024-03-17 02:30:45
    Combined:        2024-03-16 17:01:00

#### date: only days, no hours/minutes

```python
# date: only days, no hours/minutes
d = date(2024, 3, 15)
print(f"\n=== date arithmetic ===")
print(f"Original:        {d}")
print(f"+ 7 days:        {d + timedelta(days=7)}")
print(f"- 30 days:       {d - timedelta(days=30)}")
print(f"+ 1 week:        {d + timedelta(weeks=1)}")
# d + timedelta(hours=2)  # works but result is still a date (hours ignored)

# date difference
d2 = date(2024, 12, 25)
diff = d2 - d
print(f"Diff {d} to {d2}: {diff.days} days")
```

    
    === date arithmetic ===
    Original:        2024-03-15
    + 7 days:        2024-03-22
    - 30 days:       2024-02-14
    + 1 week:        2024-03-22
    Diff 2024-03-15 to 2024-12-25: 285 days

#### time: NO arithmetic support

```python
# time: NO arithmetic support
t = time(14, 30, 45)
print(f"\n=== time arithmetic ===")
print(f"Original:        {t}")
# t + timedelta(hours=1)  # TypeError! time does not support arithmetic
# Workaround: combine with a dummy date, do arithmetic, extract time
dummy = datetime.combine(date.today(), t)
new_time = (dummy + timedelta(hours=2, minutes=15)).time()
print(f"+ 2h 15m:        {new_time}")
new_time2 = (dummy - timedelta(minutes=45)).time()
print(f"- 45m:           {new_time2}")
```

    
    === time arithmetic ===
    Original:        14:30:45
    + 2h 15m:        16:45:45
    - 45m:           13:45:45

#### timestamp: just a float, arithmetic is trivial

```python
# timestamp: just a float, arithmetic is trivial
ts = datetime(2024, 3, 15, 14, 30, 45).timestamp()
print(f"\n=== timestamp arithmetic ===")
print(f"Original:        {ts}")
print(f"+ 1 day:         {ts + 86400}")          # 86400 = 24*60*60
print(f"+ 1 hour:        {ts + 3600}")            # 3600 = 60*60
print(f"+ 30 minutes:    {ts + 1800}")            # 1800 = 30*60
print(f"+ 45 seconds:    {ts + 45}")
print(f"Back to datetime: {datetime.fromtimestamp(ts + 86400)}")
```

    
    === timestamp arithmetic ===
    Original:        1710509445.0
    + 1 day:         1710595845.0
    + 1 hour:        1710513045.0
    + 30 minutes:    1710511245.0
    + 45 seconds:    1710509490.0
    Back to datetime: 2024-03-16 14:30:45

#### No built-in AddMonths/AddYears

```python
# Use dateutil for month/year arithmetic
# pip install python-dateutil (already in most environments)
from dateutil.relativedelta import relativedelta

dt = datetime(2024, 1, 31, 14, 30, 0)
print(f"\n=== Month/Year arithmetic (dateutil) ===")
print(f"Original:        {dt}")
print(f"+ 1 month:       {dt + relativedelta(months=1)}")     # Feb 29 (leap year!)
print(f"+ 6 months:      {dt + relativedelta(months=6)}")
print(f"+ 1 year:        {dt + relativedelta(years=1)}")
print(f"- 3 months:      {dt - relativedelta(months=3)}")
print(f"+ 1y 2m 3d:      {dt + relativedelta(years=1, months=2, days=3)}")
```

    
    === Month/Year arithmetic (dateutil) ===
    Original:        2024-01-31 14:30:00
    + 1 month:       2024-02-29 14:30:00
    + 6 months:      2024-07-31 14:30:00
    + 1 year:        2025-01-31 14:30:00
    - 3 months:      2023-10-31 14:30:00
    + 1y 2m 3d:      2025-04-03 14:30:00

## Math and Random

#### Basic math

```python
# Basic math — abs, max, min are built-in; clamp uses max(lo, min(val, hi))
import math

print(f"abs(-42):        {abs(-42)}")
print(f"max(10, 20):     {max(10, 20)}")
print(f"min(10, 20):     {min(10, 20)}")
print(f"clamp(15, 0,10): {max(0, min(15, 10))}")
```

    abs(-42):        42
    max(10, 20):     20
    min(10, 20):     10
    clamp(15, 0,10): 10

#### Rounding

```python
# Rounding — floor rounds down, ceil rounds up, round uses banker's rounding by default
print(f"math.floor(3.7):     {math.floor(3.7)}")       # → 3
print(f"math.ceil(3.2):      {math.ceil(3.2)}")         # → 4
print(f"round(3.5):          {round(3.5)}")              # → 4 (banker's)
print(f"round(2.5):          {round(2.5)}")              # → 2 (banker's — rounds to even!)
print(f"math.trunc(3.9):     {math.trunc(3.9)}")        # → 3
print(f"int(3.9):            {int(3.9)}")
```

    math.floor(3.7):     3
    math.ceil(3.2):      4
    round(3.5):          4
    round(2.5):          2
    math.trunc(3.9):     3
    int(3.9):            3

#### Powers, roots, and logarithms

```python
# Powers and roots — ** operator for ints; math.pow returns float; math.isqrt for integer sqrt
print(f"2 ** 10:             {2 ** 10}")                 # 1024 (operator)
print(f"math.pow(2, 10):     {math.pow(2, 10)}")         # 1024.0 (returns float)
print(f"pow(2, 10):          {pow(2, 10)}")               # 1024 (built-in, returns int)
print(f"math.sqrt(144):      {math.sqrt(144)}")           # 12.0
print(f"math.isqrt(144):     {math.isqrt(144)}")          # 12 (integer sqrt, 3.8+)

# Logarithms — log is natural (ln), log10 and log2 for other bases
print(f"math.log(100):       {math.log(100)}")
print(f"math.log10(100):     {math.log10(100)}")
print(f"math.log2(1024):     {math.log2(1024)}")
print(f"math.exp(1):         {math.exp(1)}")
```

    2 ** 10:             1024
    math.pow(2, 10):     1024.0
    pow(2, 10):          1024
    math.sqrt(144):      12.0
    math.isqrt(144):     12
    math.log(100):       4.605170185988092
    math.log10(100):     2.0
    math.log2(1024):     10.0
    math.exp(1):         2.718281828459045

#### Trigonometry and constants

```python
# Trigonometry — all functions use radians; degrees/radians convert between them
print(f"math.pi:             {math.pi}")
print(f"math.e:              {math.e}")
print(f"math.tau:            {math.tau}")                 # 2π
print(f"math.sin(π/2):       {math.sin(math.pi / 2)}")
print(f"math.cos(0):         {math.cos(0)}")
print(f"math.atan2(1, 1):    {math.atan2(1, 1)}")
print(f"math.degrees(π):     {math.degrees(math.pi)}")
print(f"math.radians(180):   {math.radians(180)}")
```

    math.pi:             3.141592653589793
    math.e:              2.718281828459045
    math.tau:            6.283185307179586
    math.sin(π/2):       1.0
    math.cos(0):         1.0
    math.atan2(1, 1):    0.7853981633974483
    math.degrees(π):     180.0
    math.radians(180):   3.141592653589793

#### Special float values

```python
# Special values — inf, nan; always check with isnan/isinf, never == nan
print(f"math.inf:            {math.inf}")
print(f"math.nan:            {math.nan}")
print(f"math.isnan(nan):     {math.isnan(math.nan)}")
print(f"math.isinf(inf):     {math.isinf(math.inf)}")
print(f"math.isfinite(42):   {math.isfinite(42)}")
```

    math.inf:            inf
    math.nan:            nan
    math.isnan(nan):     True
    math.isinf(inf):     True
    math.isfinite(42):   True

#### Percentile calculation

```python
# Data Engineering example: compute percentile rank
# Common for scoring, normalization, anomaly detection.
import statistics
latencies = [12.5, 45.2, 3.1, 78.9, 22.0, 15.3, 99.1, 6.7, 33.4, 51.8]
latencies.sort()
print(f"\n=== DE: Percentile Calculation ===")
print(f"Latencies: {latencies}")
print(f"Mean:      {statistics.mean(latencies):.2f}")
print(f"Median:    {statistics.median(latencies):.2f}")
print(f"Stdev:     {statistics.stdev(latencies):.2f}")
# Python 3.8+ quantiles
quantiles = statistics.quantiles(latencies, n=20)  # 5% increments
print(f"P95:       {quantiles[-1]:.2f} ms")
```

    
    === DE: Percentile Calculation ===
    Latencies: [3.1, 6.7, 12.5, 15.3, 22.0, 33.4, 45.2, 51.8, 78.9, 99.1]
    Mean:      36.80
    Median:    27.70
    Stdev:     32.10
    P95:       108.19 ms

#### random module

```python
# random module — pseudo-random number generation.
# NOT cryptographically secure. For crypto: import secrets.
import random

random.seed(42)  # seed for reproducibility (like C# new Random(42))

print("=== Random integers ===")
print([random.randint(1, 100) for _ in range(5)])    # [1, 100] inclusive both ends
print([random.randrange(1, 101) for _ in range(5)])  # [1, 101) — like C# Next(1, 101)

print("\n=== Random floats ===")
print([round(random.random(), 4) for _ in range(5)])       # [0.0, 1.0)
print([round(random.uniform(1.0, 10.0), 2) for _ in range(5)])  # [1.0, 10.0]

print("\n=== Random choices ===")
colors = ["red", "green", "blue", "yellow"]
print(f"choice:    {random.choice(colors)}")          # pick one
print(f"choices:   {random.choices(colors, k=3)}")    # pick k with replacement
print(f"sample:    {random.sample(colors, k=2)}")     # pick k WITHOUT replacement

items = ["A", "B", "C", "D", "E"]
print(f"\nOriginal:  {items}")
random.shuffle(items)
print(f"Shuffled:  {items}")
```

    === Random integers ===
    [82, 15, 4, 95, 36]
    [32, 29, 18, 95, 14]
    
    === Random floats ===
    [0.6767, 0.8922, 0.0869, 0.4219, 0.0298]
    [2.97, 5.55, 1.24, 2.79, 6.85]
    
    === Random choices ===
    choice:    yellow
    choices:   ['red', 'blue', 'yellow']
    sample:    ['red', 'yellow']
    
    Original:  ['A', 'B', 'C', 'D', 'E']
    Shuffled:  ['E', 'A', 'B', 'C', 'D']

#### Weighted random

```python
# Weighted random — common for A/B testing, load balancing
events = ["page_view", "click", "purchase", "signup"]
weights = [60, 25, 10, 5]  # percentage weights
picks = random.choices(events, weights=weights, k=20)
print(f"\nWeighted picks (20): {picks}")
from collections import Counter
print(f"Distribution: {dict(Counter(picks))}")
```

    
    Weighted picks (20): ['page_view', 'click', 'page_view', 'page_view', 'page_view', 'page_view', 'page_view', 'page_view', 'page_view', 'page_view', 'purchase', 'page_view', 'page_view', 'click', 'purchase', 'page_view', 'page_view', 'page_view', 'click', 'click']
    Distribution: {'page_view': 14, 'click': 4, 'purchase': 2}

#### Synthetic test data generation

```python
# Data Engineering example: generate synthetic test data
# Common for testing pipelines, load testing, staging environments.
print("\n=== DE: Synthetic Event Data ===")
event_types = ["page_view", "click", "purchase", "signup"]
regions = ["us-east-1", "eu-west-1", "ap-south-1"]
rng = random.Random(123)  # independent RNG instance (like C# new Random(123))

print(f"{'event_id':<12} {'type':<12} {'region':<12} {'revenue':>8}")
print("─" * 48)
for i in range(8):
    event_id = f"evt_{i+1:04d}"
    evt_type = rng.choice(event_types)
    region = rng.choice(regions)
    revenue = round(rng.uniform(5, 200), 2) if evt_type == "purchase" else 0.0
    print(f"{event_id:<12} {evt_type:<12} {region:<12} {revenue:>8.2f}")
```

    
    === DE: Synthetic Event Data ===
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

```python
# logging module — Python's built-in logging framework.
#
# KEY CONCEPTS:
# - Levels: DEBUG < INFO < WARNING < ERROR < CRITICAL
# - Logger hierarchy: loggers form a tree by dot-separated names.
#   "etl.extract" is a child of "etl" — messages propagate up.
# - NEVER use print() for operational logging — print can't be filtered, routed, or leveled.
#
# WARNING: In Jupyter, logging config can be tricky because the root logger
# may already have handlers. We reset handlers to get clean output.

import logging
import sys

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

#### Structured logging & logging best practices

```python
# Structured logging & logging best practices
#
# Python's built-in logging uses %-style or {}-style formatting:
#   logger.info("Processed %d rows from %s", row_count, table)  # %-style (traditional)
#   logger.info("Processed %(count)d rows", {"count": 42})       # dict-style
#
# For true structured logging (JSON output for ELK/GCP/Datadog), use:
#   - python-json-logger: formats log records as JSON
#   - structlog: full structured logging library
#
# Rule: use logger.info("msg %s", val), NOT logger.info(f"msg {val}")
# f-string evaluates immediately even if the level is filtered out.
# %-style defers formatting until the message is actually emitted.

import logging
import sys
import json
```

#### Simulating a pipeline run with logging

```python
# ── Simulate a pipeline run ──
logger = logging.getLogger("ETL")
logger.setLevel(logging.INFO)
logger.handlers.clear()

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
                                       datefmt="%H:%M:%S"))
logger.addHandler(handler)

import random
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

#### JSON log formatter

```python
# In production, you want JSON logs so log aggregators can parse them.
# Here's a minimal JSON formatter without extra dependencies.
print("\n=== JSON log output (for ELK / GCP Logging / Datadog) ===")

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

    
    === JSON log output (for ELK / GCP Logging / Datadog) ===
    {"timestamp": "2026-03-25T05:52:11", "level": "INFO", "logger": "ETL.json", "message": "Loaded events_raw: 8500 rows in 1200ms"}
    {"timestamp": "2026-03-25T05:52:11", "level": "WARNING", "logger": "ETL.json", "message": "Schema drift detected in users"}

## Configuration and Environment Variables

```python
# Environment variables — the simplest config mechanism.
# Used everywhere: Docker, Kubernetes, CI/CD, cloud functions.
import os

print("=== Environment Variables ===")

# Read common env vars
print(f"USERNAME:      {os.environ.get('USERNAME', 'N/A')}")     # Windows
print(f"COMPUTERNAME:  {os.environ.get('COMPUTERNAME', 'N/A')}")
print(f"PATH (first 80): {os.environ.get('PATH', '')[:80]}...")

db_host = os.environ.get("DATABASE_HOST", "localhost")
print(f"\nDATABASE_HOST (default): {db_host}")

# os.getenv() — same as os.environ.get() (shorthand)
print(f"PIPELINE_ENV:  {os.getenv('PIPELINE_ENV', 'not set')}")

# Set an env var (current process only — does NOT persist after exit)
os.environ["PIPELINE_ENV"] = "staging"
print(f"PIPELINE_ENV:  {os.environ['PIPELINE_ENV']}")

# Delete an env var
del os.environ["PIPELINE_ENV"]
print(f"After delete:  {os.getenv('PIPELINE_ENV', 'not set')}")

# os.environ vs os.getenv:
# os.environ["KEY"]          → raises KeyError if missing
# os.environ.get("KEY", d)   → returns d if missing
# os.getenv("KEY", d)        → same as .get()
```

    === Environment Variables ===
    USERNAME:      Alex
    COMPUTERNAME:  ELYSIUM
    PATH (first 80): c:\Users\aperi\DEV\LANG\.lang\Scripts;C:\Users\aperi\DEV\LANG\.lang\Scripts;C:\U...
    
    DATABASE_HOST (default): localhost
    PIPELINE_ENV:  not set
    PIPELINE_ENV:  staging
    After delete:  not set

```python
# List all env vars (first 10)
for i, (key, val) in enumerate(os.environ.items()):
    if i >= 10: break
    if len(val) > 60: val = val[:60] + "..."
    print(f"  {key} = {val}")
print(f"  ... ({len(os.environ)} total)")
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

#### Configuration files

```python
# Configuration files — configparser, .env files, TOML
#
# Python has several config approaches:
# 1. configparser — built-in, reads INI-style files
# 2. python-dotenv — reads .env files into os.environ
# 3. tomllib — built-in (Python 3.11+), reads TOML files
# 4. pydantic-settings — typed config with env var + file support
#
# In Data Engineering:
# - .env files for local dev (never committed to git)
# - Env vars in Docker/K8s for production
# - TOML/YAML for pipeline config (dbt, Airflow)

import configparser
import tempfile
import os
```

<h4><code style="font-size:0.75em">configparser</code> — INI-style config</h4>

```python
# ── configparser: INI-style config (built-in) ──
print("=== configparser (INI-style) ===")

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
print(f"Pipeline name:  {config['pipeline']['name']}")
print(f"Batch size:     {config.getint('pipeline', 'batch_size')}")  # type-safe
print(f"Max retries:    {config.getint('pipeline', 'max_retries')}")
print(f"Enabled:        {config.getboolean('pipeline', 'enabled')}")  # true/false/yes/no/1/0
print(f"DB host:        {config['database']['host']}")
print(f"Log level:      {config['logging']['level']}")

print(f"Timeout:        {config.getint('pipeline', 'timeout', fallback=30)}")
```

    === configparser (INI-style) ===
    Pipeline name:  events_etl
    Batch size:     5000
    Max retries:    3
    Enabled:        True
    DB host:        prod-db
    Log level:      INFO
    Timeout:        30

#### Reading configparser sections and keys

```python
# List all sections and keys
print(f"\nSections: {config.sections()}")
print(f"Pipeline keys: {list(config['pipeline'].keys())}")
```

    
    Sections: ['pipeline', 'database', 'logging']
    Pipeline keys: ['name', 'batch_size', 'max_retries', 'enabled']

#### TOML — modern config format

```python
# ── TOML: modern config format (Python 3.11+ built-in) ──
# TOML is used by pyproject.toml, Rust (Cargo.toml), and many modern tools.
print("\n=== TOML (Python 3.11+ built-in) ===")
import tomllib  # read-only, built-in since Python 3.11

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

print(f"Pipeline: {toml_config['pipeline']}")
print(f"Name:     {toml_config['pipeline']['name']}")
print(f"Tags:     {toml_config['pipeline']['tags']}")  # native list!
print(f"DB port:  {toml_config['database']['port']}")   # native int!
# Unlike configparser, TOML preserves types: int, bool, list, datetime.

# ── .env files (python-dotenv) ──
```

    
    === TOML (Python 3.11+ built-in) ===
    Pipeline: {'name': 'events_etl', 'batch_size': 5000, 'max_retries': 3, 'enabled': True, 'tags': ['production', 'clickstream']}
    Name:     events_etl
    Tags:     ['production', 'clickstream']
    DB port:  5432

<h4><code style="font-size:0.75em">.env</code> files</h4>

```python
# .env files hold secrets for local dev. NEVER commit to git.
# python-dotenv loads them into os.environ.
print("\n=== .env files (pattern) ===")
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
import shutil
shutil.rmtree(tmp_dir)
print(f"\nCleaned up: {tmp_dir}")
```

    
    === .env files (pattern) ===
      DATABASE_HOST = localhost
      DATABASE_PORT = 5432
      API_KEY = sk-test-abc123
    
    Cleaned up: C:\Users\aperi\AppData\Local\Temp\config_demo_s32pafzs
