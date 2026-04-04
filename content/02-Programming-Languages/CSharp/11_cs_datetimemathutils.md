---
tags: [csharp]
aliases: [datetime, timezones, date arithmetic, math operations, utility functions]
description: "C# date, time, math and utilities reference with executable examples and cell outputs — covers DateTime, DateOnly, TimeSpan, timezones, Math, Random, and Guid. See [11_py_datetimemathutils](https://alp78.github.io/elysium/02-Programming-Languages/Python/11_py_datetimemathutils) for the Python equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 11. Date, Time, Math & Utilities - C#

> [!quote]
> "There are two hard problems in datetime handling: timezone conversions, daylight saving transitions, and off-by-one errors."
>
> — **Jon Skeet**


#### Imports and warning suppression

```csharp
// Imports and warning suppression for date/time, math, logging, and configuration

using System.Globalization;
using System.Reflection;
using Microsoft.DotNet.Interactive;
using Microsoft.DotNet.Interactive.CSharp;

#r "nuget: Microsoft.Extensions.Configuration"
#r "nuget: Microsoft.Extensions.Configuration.Binder"
#r "nuget: Microsoft.Extensions.Configuration.EnvironmentVariables"
#r "nuget: Microsoft.Extensions.Configuration.Json"
#r "nuget: Microsoft.Extensions.Logging.Console"
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.IO;
var csharpKernel = (CSharpKernel)Kernel.Root.FindKernelByName("csharp");
var optionsField = typeof(CSharpKernel).GetField("_scriptOptions",
    BindingFlags.NonPublic | BindingFlags.Instance);

var scriptOptions = optionsField.GetValue(csharpKernel);
var withWarningLevel = scriptOptions.GetType().GetMethod("WithWarningLevel");
var newOptions = withWarningLevel.Invoke(scriptOptions, new object[] { 0 });
optionsField.SetValue(csharpKernel, newOptions);

// WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.
```

    WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.

## Date and Time

#### DateTime, DateOnly, TimeOnly, DateTimeOffset — creating objects

> [!info] Date and time types
>
> - `DateTime.Now` — local time | `DateTime.UtcNow` — UTC
> - `DateOnly` — dates without time | `TimeOnly` — times without date (.NET 6+)
> - `DateTimeOffset` — carries timezone offset; always prefer UTC for storage
> - `UtcNow` is monotonic (no DST jumps)

> [!warning] Anti-patterns
>
> - **`DateTime.Now` for storage** — timezone-dependent; use `UtcNow`
> - **Comparing `DateTime` with different `Kind`s** — undefined behavior

> [!success] Best practice
>
> Always use `DateTime.UtcNow` for storage and comparisons. Use `DateTimeOffset` when you need to preserve the original timezone offset alongside the value.

```csharp
// Creating date and time objects

// Current date and time
DateTime now = DateTime.Now;        // local time
DateTime utcNow = DateTime.UtcNow;  // UTC time
DateOnly today = DateOnly.FromDateTime(DateTime.Now);  // date only (.NET 6+)
TimeOnly currentTime = TimeOnly.FromDateTime(DateTime.Now);  // time only (.NET 6+)

now  // DateTime.Now
utcNow  // DateTime.UtcNow
today  // DateOnly
currentTime  // TimeOnly
now.GetType()  // type
```

    25-Mar-26 5:25:13
    25-Mar-26 4:25:13
    25-Mar-26
    5:25
    System.DateTime

#### Creating specific dates and times

```csharp
// Creating specific dates — constructor and factory methods

var dt = new DateTime(2024, 3, 15, 14, 30, 45);       // year, month, day, hour, min, sec
var d = new DateOnly(2024, 3, 15);                     // date only
var t = new TimeOnly(14, 30, 45);                      // time only
var dtTicks = new DateTime(2024, 3, 15, 14, 30, 45).AddTicks(1234560);  // with sub-ms

dt  // Specific DateTime
d  // Specific DateOnly
t  // Specific TimeOnly
dtTicks  // With ticks
```

    
    15-Mar-24 14:30:45
    15-Mar-24
    14:30
    15-Mar-24 14:30:45

#### DateTime .Year, .Month, .Day, .Hour — accessing components

```csharp
// Accessing date/time components — Year, Month, Day, Hour, etc.

var dt = new DateTime(2024, 3, 15, 14, 30, 45).AddTicks(1234560);

// === Components ===
dt.Year  // Year
dt.Month  // Month
dt.Day  // Day
dt.Hour  // Hour
dt.Minute  // Minute
dt.Second  // Second
dt.Millisecond  // Millisecond
dt.Ticks          // 100-nanosecond intervals
dt.DayOfWeek      // Friday (enum)
dt.DayOfYear
System.Globalization.ISOWeek.GetWeekOfYear(dt)  // Week (ISO)
dt.Kind            // Unspecified, Local, or Utc
```

    2024
    3
    15
    14
    30
    45
    123
    638461098451234560
    Friday
    75
    11
    Unspecified

#### Unix timestamp conversions

```csharp
// Unix timestamp conversions — DateTime to/from epoch seconds

var now = DateTime.Now;

// DateTime -> Unix timestamp (seconds since 1970-01-01 00:00:00 UTC)
var dto = new DateTimeOffset(now);
long tsSeconds = dto.ToUnixTimeSeconds();
long tsMillis = dto.ToUnixTimeMilliseconds();
dto  // Timestamp
tsSeconds  // Timestamp (seconds)
tsMillis  // Timestamp (millis)
```

    25-Mar-26 5:25:13 +01:00
    1774412713
    1774412713988

#### Unix timestamp to DateTime

```csharp
// Timestamp to DateTime — convert epoch seconds back to DateTime

var fromTs = DateTimeOffset.FromUnixTimeSeconds(tsSeconds).LocalDateTime;
var fromTsUtc = DateTimeOffset.FromUnixTimeSeconds(tsSeconds).UtcDateTime;
fromTs  // From timestamp (local)
fromTsUtc  // From timestamp (UTC)
```

    
    25-Mar-26 5:25:13
    25-Mar-26 4:25:13

#### .NET Ticks — sub-millisecond precision

```csharp
// .NET Ticks — 100-nanosecond intervals since 0001-01-01

now.Ticks  // .NET Ticks
new DateTime(now.Ticks)  // From ticks
```

    
    .NET Ticks: 639100131139884609
    25-Mar-26 5:25:13

#### Unix epoch reference — 1970-01-01 UTC

```csharp
// Unix epoch — the reference point for Unix timestamps

var epoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);
epoch  // Epoch
```

    
    01-Jan-70 0:00:00

#### Parsing strings to DateTime

```csharp
// Parsing strings to DateTime — Parse, ParseExact, TryParseExact

string s1 = "2024-03-15 14:30:45";
string s2 = "15/03/2024";
string s3 = "March 15, 2024 2:30 PM";
string s4 = "2024-03-15T14:30:45";
string s5 = "2024-03-15T14:30:45.1234560";
string s6 = "Fri, 15 Mar 2024 14:30:45";

// Parse with exact format (ParseExact)
var dt1 = DateTime.ParseExact(s1, "yyyy-MM-dd HH:mm:ss", null);
var dt2 = DateTime.ParseExact(s2, "dd/MM/yyyy", null);
var dt3 = DateTime.ParseExact(s3, "MMMM dd, yyyy h:mm tt", CultureInfo.InvariantCulture);
var dt4 = DateTime.ParseExact(s4, "yyyy-MM-ddTHH:mm:ss", null);
var dt5 = DateTime.ParseExact(s5, "yyyy-MM-ddTHH:mm:ss.fffffff", null);
var dt6 = DateTime.ParseExact(s6, "ddd, dd MMM yyyy HH:mm:ss", CultureInfo.InvariantCulture);

// === String -> DateTime (ParseExact) ===
var inputs = new[] { (s1, dt1), (s2, dt2), (s3, dt3), (s4, dt4), (s5, dt5), (s6, dt6) };
foreach (var (s, d) in inputs)
    $"  {("'" + s + "'"),-32} -> {d}"
```

      '2024-03-15 14:30:45'            -> 15-Mar-24 14:30:45
      '15/03/2024'                     -> 15-Mar-24 0:00:00
      'March 15, 2024 2:30 PM'         -> 15-Mar-24 14:30:00
      '2024-03-15T14:30:45'            -> 15-Mar-24 14:30:45
      '2024-03-15T14:30:45.1234560'    -> 15-Mar-24 14:30:45
      'Fri, 15 Mar 2024 14:30:45'      -> 15-Mar-24 14:30:45

#### DateTime.TryParseExact — safe parsing with explicit format

```csharp
// TryParseExact — safe date parsing that returns false on invalid input

if (DateTime.TryParseExact("not-a-date", "yyyy-MM-dd", null,
    System.Globalization.DateTimeStyles.None, out DateTime result))
    result  // Parsed
else
    // 'not-a-date' failed to parse (TryParseExact)
```

    
    'not-a-date' failed to parse (TryParseExact)

#### Auto-detect format with Parse

```csharp
// Auto-detect format — DateTime.Parse for common date formats

var auto = DateTime.Parse("2024-03-15T14:30:45");
auto  // Auto-parsed
```

    15-Mar-24 14:30:45

#### Formatting — ToString

```csharp
// Standard format strings — single-letter shortcuts for common patterns

var dt = new DateTime(2024, 3, 15, 14, 30, 45).AddTicks(1234560);

dt.ToString("d")  // d  Short date
dt.ToString("D")  // D  Long date
dt.ToString("t")  // t  Short time
dt.ToString("T")  // T  Long time
dt.ToString("f")  // f  Full short
dt.ToString("F")  // F  Full long
dt.ToString("g")  // g  General short
dt.ToString("G")  // G  General long
dt.ToString("R")  // R  RFC 1123
dt.ToString("s")  // s  Sortable
dt.ToString("o")  // o  Round-trip
```

    15-Mar-24
    Friday, March 15, 2024
    14:30
    14:30:45
    Friday, March 15, 2024 14:30
    Friday, March 15, 2024 14:30:45
    15-Mar-24 14:30
    15-Mar-24 14:30:45
    Fri, 15 Mar 2024 14:30:45 GMT
    2024-03-15T14:30:45
    2024-03-15T14:30:45.1234560

#### Custom format strings

```csharp
// Custom format strings — combine specifiers for any date/time layout

dt.ToString("yyyy-MM-dd'T'HH:mm:ss")  // ISO 8601
dt.ToString("yyyy-MM-dd")  // Date only
dt.ToString("HH:mm:ss")  // Time only
dt.ToString("MM/dd/yyyy")  // US format
dt.ToString("dd/MM/yyyy")  // EU format
dt.ToString("MMMM dd, yyyy")  // Long date
dt.ToString("hh:mm tt")  // 12-hour
dt.ToString("dddd")  // Day of week
dt.ToString("yyyy-MM-dd'T'HH:mm:ss.fffffff")  // With fraction
dt.ToString("yyyyMMddHHmmss")  // Compact
```

    2024-03-15T14:30:45
    2024-03-15
    14:30:45
    03-15-2024
    15-03-2024
    March 15, 2024
    02:30 PM
    Friday
    2024-03-15T14:30:45.1234560
    20240315143045

#### Format specifier reference

```csharp
// Format specifier reference — complete list of date/time codes

var specs = new (string spec, string desc)[] {
    ("yyyy", "4-digit year"),     ("yy", "2-digit year"),
    ("MMMM", "Month name full"), ("MMM", "Month name abbr"),
    ("MM", "Month (01-12)"),     ("dd", "Day (01-31)"),
    ("HH", "Hour 24h (00-23)"),  ("hh", "Hour 12h (01-12)"),
    ("mm", "Minute (00-59)"),    ("ss", "Second (00-59)"),
    ("fffffff", "Ticks"),        ("tt", "AM/PM"),
    ("dddd", "Weekday full"),    ("ddd", "Weekday abbr"),
};
foreach (var (spec, desc) in specs)
    $"  {spec,-8} = {dt.ToString(spec),-22} ({desc})"

// K and zzz — timezone offset specifiers (need Kind = Utc or Local)
var dtUtc = new DateTime(2024, 3, 15, 14, 30, 45, DateTimeKind.Utc);
var dtLocal = new DateTime(2024, 3, 15, 14, 30, 45, DateTimeKind.Local);
dtUtc.ToString("%K")  // K (UTC)
dtLocal.ToString("%K")  // K (Local)
dtLocal.ToString("zzz")  // zzz (Local)
```

      yyyy     = 2024                   (4-digit year)
      yy       = 24                     (2-digit year)
      MMMM     = March                  (Month name full)
      MMM      = Mar                    (Month name abbr)
      MM       = 03                     (Month (01-12))
      dd       = 15                     (Day (01-31))
      HH       = 14                     (Hour 24h (00-23))
      hh       = 02                     (Hour 12h (01-12))
      mm       = 30                     (Minute (00-59))
      ss       = 45                     (Second (00-59))
      fffffff  = 1234560                (Ticks)
      tt       = PM                     (AM/PM)
      dddd     = Friday                 (Weekday full)
      ddd      = Fri                    (Weekday abbr)
    
      Z
      +01:00
      +01:00

#### ISO 8601 conversions

```csharp
// ISO 8601 conversions — DateTime to standardized string format

var dt = new DateTime(2024, 3, 15, 14, 30, 45).AddTicks(1234560);

$"Round-trip (o):  {dt:o}"                           // 2024-03-15T14:30:45.1234560
$"Sortable (s):    {dt:s}"                           // 2024-03-15T14:30:45
dt:yyyy-MM-ddTHH:mm:ss.fff  // Custom ISO
```

    2024-03-15T14:30:45.1234560
    2024-03-15T14:30:45
    2024-03-15T14:30:45.123

#### Parsing ISO 8601 strings

```csharp
// Parsing ISO 8601 strings — auto-detect with DateTime.Parse

var fromIso1 = DateTime.Parse("2024-03-15T14:30:45.1234560");
var fromIso2 = DateTime.Parse("2024-03-15T14:30:45Z");                  // Z = UTC
var fromIso3 = DateTimeOffset.Parse("2024-03-15T14:30:45+05:30");       // with offset

fromIso1  // From ISO
$"From ISO (Z):    {fromIso2} Kind={fromIso2.Kind}"
$"From ISO (+5:30):{fromIso3} Offset={fromIso3.Offset}"
```

    15-Mar-24 14:30:45
    15-Mar-24 15:30:45 Kind=Local
    From ISO (+5:30):15-Mar-24 14:30:45 +05:30 Offset=05:30:00

#### DateTimeOffset preserves timezone

```csharp
// DateTimeOffset — preserves timezone offset as part of the value

var dto = DateTimeOffset.Parse("2024-03-15T14:30:45+05:30");
dto  // DateTimeOffset
dto.UtcDateTime  // UTC
dto.LocalDateTime  // Local
dto.Offset  // Offset
```

    15-Mar-24 14:30:45 +05:30
      15-Mar-24 9:00:45
      15-Mar-24 10:00:45
      05:30:00

#### TimeZoneInfo.FindSystemTimeZoneById — timezone management

```csharp
// Timezone management — DateTime.Kind and timezone conversion

var unspec = new DateTime(2024, 3, 15, 14, 30, 45);                          // Unspecified
var local = new DateTime(2024, 3, 15, 14, 30, 45, DateTimeKind.Local);       // Local
var utc = new DateTime(2024, 3, 15, 14, 30, 45, DateTimeKind.Utc);           // Utc

$"Unspecified: {unspec}, Kind={unspec.Kind}"
$"Local:       {local}, Kind={local.Kind}"
$"UTC:         {utc}, Kind={utc.Kind}"
```

    15-Mar-24 14:30:45, Kind=Unspecified
    15-Mar-24 14:30:45, Kind=Local
    15-Mar-24 14:30:45, Kind=Utc

#### TimeZoneInfo.ConvertTime — converting between timezones

```csharp
// Converting between timezones — UTC to Eastern, Tokyo, etc.

var eastern = TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time");
var london = TimeZoneInfo.FindSystemTimeZoneById("GMT Standard Time");
var tokyo = TimeZoneInfo.FindSystemTimeZoneById("Tokyo Standard Time");
var india = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
var sydney = TimeZoneInfo.FindSystemTimeZoneById("AUS Eastern Standard Time");

var utcNow = DateTime.UtcNow;
utcNow  // UTC now
TimeZoneInfo.ConvertTimeFromUtc(utcNow, eastern)  // -> Eastern
TimeZoneInfo.ConvertTimeFromUtc(utcNow, london)  // -> London
TimeZoneInfo.ConvertTimeFromUtc(utcNow, tokyo)  // -> Tokyo
TimeZoneInfo.ConvertTimeFromUtc(utcNow, sydney)  // -> Sydney
TimeZoneInfo.ConvertTimeFromUtc(utcNow, india)  // -> India
```

    25-Mar-26 4:30:20
    25-Mar-26 0:30:20
    25-Mar-26 4:30:20
    25-Mar-26 13:30:20
    25-Mar-26 15:30:20
    25-Mar-26 10:00:20

#### DateTimeOffset — carries the offset with it

```csharp
// DateTimeOffset — carries offset as part of the value

var dtoUtc = new DateTimeOffset(2024, 3, 15, 14, 30, 45, TimeSpan.Zero);
var dtoNy = dtoUtc.ToOffset(TimeSpan.FromHours(-4));
var dtoIndia = dtoUtc.ToOffset(new TimeSpan(5, 30, 0));

dtoUtc  // DateTimeOffset UTC
dtoNy  // -> New York (-4)
dtoIndia  // -> India (+5:30)

// List available timezones
TimeZoneInfo.GetSystemTimeZones().Count  // Available timezones
foreach (var tz in TimeZoneInfo.GetSystemTimeZones().Take(5))
    $"  {tz.Id} ({tz.DisplayName})"
```

    15-Mar-24 14:30:45 +00:00
    15-Mar-24 10:30:45 -04:00
    -> India (+5:30):     15-Mar-24 20:00:45 +05:30
    
    141
      Dateline Standard Time ((UTC-12:00) International Date Line West)
      UTC-11 ((UTC-11:00) Coordinated Universal Time-11)
      Aleutian Standard Time ((UTC-10:00) Aleutian Islands)
      Hawaiian Standard Time ((UTC-10:00) Hawaii)
      Marquesas Standard Time ((UTC-09:30) Marquesas Islands)

#### Arithmetic with TimeSpan

```csharp
// TimeSpan arithmetic — adding and subtracting time intervals

var dt = new DateTime(2024, 3, 15, 14, 30, 45);

dt  // Original
dt.AddDays(7)  // + 7 days
dt.AddDays(-30)  // - 30 days
dt.AddHours(2)  // + 2 hours
dt.AddMinutes(90)  // + 90 minutes
dt.Add(new TimeSpan(7, 3, 30, 0))  // + 1w 3h 30m
dt.AddMonths(6)  // + 6 months
dt.AddYears(1)  // + 1 year
```

    15-Mar-24 14:30:45
    22-Mar-24 14:30:45
    14-Feb-24 14:30:45
    15-Mar-24 16:30:45
    15-Mar-24 16:00:45
    22-Mar-24 18:00:45
    15-Sep-24 14:30:45
    15-Mar-25 14:30:45

#### TimeSpan — difference between dates

```csharp
// Difference between dates — subtracting DateTimes returns TimeSpan

var dt1 = new DateTime(2024, 3, 15);
var dt2 = new DateTime(2024, 12, 25);
TimeSpan diff = dt2 - dt1;

$"From {dt1:d} to {dt2:d}"
diff  // Difference
diff.Days  // Days
diff.TotalDays  // Total days
diff.TotalHours  // Total hours
```

    From 15-Mar-24 to 25-Dec-24
    285.00:00:00
    285
    285
    6840

#### DateTime.Compare, CompareTo — comparing dates

```csharp
// Comparing dates — operators and DateTime.Compare

dt1 < dt2  // dt1 < dt2
dt1 == dt2  // dt1 == dt2
dt1 > dt2  // dt1 > dt2
DateTime.Compare(dt1, dt2)  // Compare
```

    True
    False
    False
    -1

#### Arithmetic on different date/time types

#### DateTime: full arithmetic with Add* methods

```csharp
// DateTime arithmetic — Add* methods for full date/time manipulation

var dt = new DateTime(2024, 3, 15, 14, 30, 45);
// === DateTime arithmetic ===
dt  // Original
dt.AddDays(1)  // + 1 day
dt.AddHours(-2)  // - 2 hours
dt.AddMinutes(30)  // + 30 minutes
dt.AddSeconds(45)  // + 45 seconds
dt.AddMilliseconds(500)  // + 500ms
dt.AddDays(1.5)  // + 1.5 days
$"+ 1 month:       {dt.AddMonths(1)}"       // built-in!
$"+ 1 year:        {dt.AddYears(1)}"        // built-in!
$"Combined:        {dt.Add(new TimeSpan(1, 2, 30, 15))}"  // 1d 2h 30m 15s
```

    15-Mar-24 14:30:45
    16-Mar-24 14:30:45
    15-Mar-24 12:30:45
    15-Mar-24 15:00:45
    15-Mar-24 14:31:30
    15-Mar-24 14:30:45
    17-Mar-24 2:30:45
    15-Apr-24 14:30:45
    15-Mar-25 14:30:45
    16-Mar-24 17:01:00

#### DateOnly: only days/months/years

```csharp
// DateOnly arithmetic — only days, months, and years

var d = new DateOnly(2024, 3, 15);
$"\n=== DateOnly arithmetic ==="
d  // Original
d.AddDays(7)  // + 7 days
d.AddDays(-30)  // - 30 days
d.AddMonths(1)  // + 1 month
d.AddYears(1)  // + 1 year

// DateOnly difference (returns int days, not TimeSpan)
var d2 = new DateOnly(2024, 12, 25);
int daysDiff = d2.DayNumber - d.DayNumber;
$"Diff {d} to {d2}: {daysDiff} days"
```

    
    15-Mar-24
    22-Mar-24
    14-Feb-24
    15-Apr-24
    15-Mar-25
    285 days

#### TimeOnly: hours/minutes/seconds arithmetic

```csharp
// TimeOnly arithmetic — hours, minutes, seconds manipulation

var t = new TimeOnly(14, 30, 45);
$"\n=== TimeOnly arithmetic ==="
t  // Original
t.Add(new TimeSpan(2, 15, 0))  // + 2h 15m
t.Add(new TimeSpan(0, -45, 0))  // - 45m
t.Add(new TimeSpan(0, 0, 30))  // + 30 seconds
t.AddHours(3)  // AddHours(3)
t.AddMinutes(90)  // AddMinutes(90)
// TimeOnly wraps around at midnight
$"+ 12 hours:      {t.AddHours(12)}"  // wraps past midnight
```

    
    14:30
    16:45
    13:45
    14:31
    17:30
    16:00
    2:30

#### Timestamp: arithmetic via DateTimeOffset

```csharp
// Timestamp arithmetic — add/subtract via DateTimeOffset and Unix epoch

var dtoNow = new DateTimeOffset(2024, 3, 15, 14, 30, 45, TimeSpan.Zero);
long ts = dtoNow.ToUnixTimeSeconds();
$"\n=== Timestamp arithmetic ==="
ts  // Original
ts + 86400  // + 1 day
ts + 3600  // + 1 hour
ts + 1800  // + 30 minutes
ts + 45  // + 45 seconds
DateTimeOffset.FromUnixTimeSeconds(ts + 86400).DateTime  // Back to DateTime
```

    
    1710513045
    1710599445
    1710516645
    1710514845
    1710513090
    16-Mar-24 14:30:45

#### Month arithmetic handles edge cases

```csharp
// Month arithmetic edge cases — January 31 + 1 month = February 28/29

var jan31 = new DateTime(2024, 1, 31);
$"\n=== Month edge cases ==="
$"Jan 31 + 1 month: {jan31.AddMonths(1)}"  // Feb 29 (leap year)
$"Jan 31 + 2 months:{jan31.AddMonths(2)}"  // Mar 31
$"Jan 31 + 1 year:  {jan31.AddYears(1)}"   // Jan 31
```

    
    29-Feb-24 0:00:00
    Jan 31 + 2 months:31-Mar-24 0:00:00
    31-Jan-25 0:00:00

## Math and Random

#### Math class

> [!info] Math class
>
> - `Math.Abs` — absolute value
> - `Math.Max` / `Math.Min` — comparisons
> - `Math.Clamp(value, min, max)` — restricts to a range (replaces manual `if`/`else`)
> - All static, overloaded for `int`, `double`, `decimal`
> - For complex math, use `MathNet.Numerics`

```csharp
// Basic math — Abs, Max, Min, Clamp; all static methods on Math class
Math.Abs(-42)  // Abs(-42)
Math.Max(10, 20)  // Max(10, 20)
Math.Min(10, 20)  // Min(10, 20)
$"Clamp(15, 0, 10):{Math.Clamp(15, 0, 10)}"
```

    42
    20
    10
    Clamp(15, 0, 10):10

#### Math.Floor, Math.Ceiling, Math.Round — rounding strategies

```csharp
// Rounding — Floor, Ceiling, Round, and banker's rounding

$"Floor(3.7):      {Math.Floor(3.7)}"         // → 3
$"Ceiling(3.2):    {Math.Ceiling(3.2)}"       // → 4
$"Round(3.5):      {Math.Round(3.5)}"         // → 4 (banker's)
$"Round(2.5):      {Math.Round(2.5)}"         // → 2 (banker's — rounds to even!)
$"Round(2.5, AwayFromZero): {Math.Round(2.5, MidpointRounding.AwayFromZero)}" // → 3
Math.Truncate(3.9)  // Truncate(3.9)
```

    3
    4
    4
    2
    Round(2.5, AwayFromZero): 3
    3

#### Math.Sqrt, Math.Log, Math.Pow — powers, roots, logarithms

```csharp
// Powers, roots, and logarithms — Pow, Sqrt, Log, Exp

$"Pow(2, 10):      {Math.Pow(2, 10)}"        // 2^10 = 1024
$"Sqrt(144):       {Math.Sqrt(144)}"          // √144 = 12
$"Cbrt(27):        {Math.Cbrt(27)}"           // ∛27 = 3
$"Log(100):        {Math.Log(100)}"           // natural log (ln)
$"Log10(100):      {Math.Log10(100)}"         // log base 10
$"Log2(1024):      {Math.Log2(1024)}"         // log base 2
Math.Exp(1)  // Exp(1)
```

    1024
    12
    3
    4.605170185988092
    2
    10
    2.718281828459045

#### Math.Sin, Math.Cos, Math.PI, Math.E — trigonometry and constants

```csharp
// Trigonometry and constants — PI, E, Tau, Sin, Cos, Atan2

Math.PI  // PI
Math.E  // E
Math.Tau  // Tau
Math.Sin(Math.PI / 2)  // Sin(π/2)
Math.Cos(0)  // Cos(0)
Math.Atan2(1, 1)  // Atan2(1, 1)
```

    3.141592653589793
    2.718281828459045
    6.283185307179586
    1
    1
    0.7853981633974483

#### double.NaN, double.IsNaN, double.PositiveInfinity — special values

```csharp
// Special float values and NaN — detection and propagation rules

double.NaN  // double.NaN
double.PositiveInfinity  // double.PositiveInf
double.IsNaN(0.0 / 0.0)  // IsNaN(0.0/0.0)
double.IsInfinity(1.0 / 0.0)  // IsInfinity(1.0/0.0)
```

    NaN
    ∞
    True
    True

#### LINQ OrderBy + ElementAt — percentile calculation

```csharp
// Percentile calculation — common for scoring and anomaly detection

var latencies = new double[] { 12.5, 45.2, 3.1, 78.9, 22.0, 15.3, 99.1, 6.7, 33.4, 51.8 };
Array.Sort(latencies);
double p95Index = 0.95 * (latencies.Length - 1);
int lower = (int)Math.Floor(p95Index);
int upper = (int)Math.Ceiling(p95Index);
double p95 = latencies[lower] + (latencies[upper] - latencies[lower]) * (p95Index - lower);
$"Latencies: [{string.Join(", ", latencies.Select(l => $"{l:F1}"))}]"
$"P95 latency: {p95:F2} ms"
```

    [3.1, 6.7, 12.5, 15.3, 22.0, 33.4, 45.2, 51.8, 78.9, 99.1]
    90.01 ms

#### Random.Shared.Next, NextDouble — random number generation

```csharp
// Random number generation — seed for reproducibility, Next for integers

var rng = new Random(42);  // seed for reproducibility

for (int i = 0; i < 5; i++)
    $"{rng.Next(1, 101)} "

for (int i = 0; i < 5; i++)
    $"{rng.NextDouble():F4} "
```

    Random integers [1..100]:
    67 15 13 53 17 
    
    Random doubles [0.0, 1.0):
    0.2626 0.7244 0.5129 0.1737 0.7613

#### Random bytes and shuffle

```csharp
// Random bytes and shuffle — NextBytes and Shuffle (.NET 8+)

var buffer = new byte[8];
rng.NextBytes(buffer);
$"Bytes: [{string.Join(", ", buffer)}]"

// Shuffle an array
var items = new[] { "A", "B", "C", "D", "E" };
$"\nOriginal: [{string.Join(", ", items)}]"
rng.Shuffle(items);
$"Shuffled: [{string.Join(", ", items)}]"
```

    [158, 86, 240, 173, 191, 58, 111, 183]
    
    [A, B, C, D, E]
    [E, D, B, C, A]

#### Random pick

```csharp
// Random pick — select a random element from a collection

var colors = new[] { "red", "green", "blue", "yellow" };
colors[rng.Next(colors.Length)]  // Random pick
```

    red

#### Random + DateTime — synthetic OHLCV test data generation

```csharp
// Synthetic test data generation — OHLCV-style records for pipelines

var eventTypes = new[] { "page_view", "click", "purchase", "signup" };
var regions = new[] { "us-east-1", "eu-west-1", "ap-south-1" };
var syntheticRng = new Random(123);

$"{"event_id",-12} {"type",-12} {"region",-12} {"revenue",8}"
new string('─', 48)
for (int i = 0; i < 8; i++)
{
    var eventId = $"evt_{i + 1:D4}";
    var evtType = eventTypes[syntheticRng.Next(eventTypes.Length)];
    var region = regions[syntheticRng.Next(regions.Length)];
    var revenue = evtType == "purchase" ? Math.Round(syntheticRng.NextDouble() * 200, 2) : 0.0;
    $"{eventId,-12} {evtType,-12} {region,-12} {revenue,8:F2}"
}
```

    event_id     type         region        revenue
    ────────────────────────────────────────────────
    evt_0001     signup       ap-south-1       0.00
    evt_0002     purchase     ap-south-1     147.76
    evt_0003     page_view    us-east-1        0.00
    evt_0004     page_view    us-east-1        0.00
    evt_0005     purchase     ap-south-1      99.04
    evt_0006     page_view    eu-west-1        0.00
    evt_0007     page_view    ap-south-1       0.00
    evt_0008     purchase     us-east-1        1.37

## Logging

#### Microsoft.Extensions.Logging — ILogger, LoggerFactory setup

The standard .NET logging abstraction — same API for console, file, and cloud providers. `ILoggerFactory` creates typed loggers; `ILogger<T>` provides category-based filtering. Log levels: `Trace` < `Debug` < `Information` < `Warning` < `Error` < `Critical`. Use **structured logging** with named placeholders (`logger.LogInformation("Processed {Count} rows", rowCount)`) — backends like Seq, ELK, and GCP index the values.

> [!warning] Anti-pattern
>
> Don't use `Console.WriteLine` for logging — it has no levels, timestamps, or filtering.

> [!success] Use structured logging
>
> Use `ILogger` from `Microsoft.Extensions.Logging` with named placeholders. This enables level filtering, timestamps, structured output to any backend (console, Seq, ELK, GCP), and is the same API across all .NET workloads.

```csharp
// ── Basic console logging ──
// In a real app, this comes from dependency injection (builder.Services.AddLogging()).
// In a notebook/script, we build the factory manually.


{
    using var factory = LoggerFactory.Create(builder =>
    {
        builder.AddConsole();                       // write to stdout
        builder.SetMinimumLevel(LogLevel.Debug);    // show Debug and above
    });

    var logger = factory.CreateLogger("PipelineDemo");

    // Log at each level — only Debug+ will show (we set minimum = Debug)
    logger.LogTrace("Trace: very detailed diagnostic info");       // filtered out
    logger.LogDebug("Debug: starting pipeline");                    // shown
    logger.LogInformation("Info: processed {RowCount} rows", 42);  // shown, structured
    logger.LogWarning("Warning: schema drift detected in {Table}", "events_raw"); // shown
    logger.LogError("Error: failed to write partition {Partition}", "2024-03-15"); // shown
    logger.LogCritical("Critical: pipeline halted — data loss risk");              // shown
}
```

    dbug: PipelineDemo[0]
          starting pipeline
    info: PipelineDemo[0]
          processed 42 rows
    warn: PipelineDemo[0]
          schema drift detected in events_raw
    fail: PipelineDemo[0]
          failed to write partition 2024-03-15
    crit: PipelineDemo[0]
          pipeline halted — data loss risk

#### ILogger.LogInformation, LogWarning, LogError — structured log levels

```csharp
// Structured logging — log templates with named parameters

{
    using var factory = LoggerFactory.Create(builder =>
    {
        builder.AddConsole();
        builder.SetMinimumLevel(LogLevel.Information);
    });
    var logger = factory.CreateLogger("ETL");

    // Simulate a pipeline run with structured logging
    var tables = new[] { "events_raw", "users", "transactions" };
    var rng = new Random(42);

    logger.LogInformation("Pipeline started at {StartTime}", DateTime.UtcNow);

    foreach (var table in tables)
    {
        var rowCount = rng.Next(100, 10_000);
        var durationMs = rng.Next(200, 5000);

        if (rowCount < 500)
            logger.LogWarning("Low row count for {Table}: {RowCount} (expected > 500)", table, rowCount);
        else
            logger.LogInformation("Loaded {Table}: {RowCount} rows in {DurationMs}ms", table, rowCount, durationMs);
    }

    logger.LogInformation("Pipeline completed at {EndTime}", DateTime.UtcNow);
}
```

    info: ETL[0]
          Pipeline started at 03/25/2026 04:35:25
    info: ETL[0]
          Loaded events_raw: 6714 rows in 876ms
    info: ETL[0]
          1342 rows in 2709ms
    info: ETL[0]
          1767 rows in 1460ms
    info: ETL[0]
          Pipeline completed at 03/25/2026 04:35:25

## Configuration and Environment Variables

#### Environment.GetEnvironmentVariable — read and set env vars

> [!info] Environment variables
>
> - `Environment.GetEnvironmentVariable("NAME")` — reads a single variable
> - `GetEnvironmentVariables()` — returns all as `IDictionary`
> - Standard across all platforms; use for connection strings, API keys, deployment config
> - Always provide defaults with `??` for variables that may not exist
> - For complex structured config, use `appsettings.json` + `IConfiguration`
>
> > [!warning] Never hardcode secrets in code.

```csharp
// Read common env vars
Environment.GetEnvironmentVariable("USERNAME")  // USERNAME
Environment.GetEnvironmentVariable("COMPUTERNAME")  // COMPUTERNAME
Environment.GetEnvironmentVariable("OS")  // OS

// Read a var that may not exist — always use null check or ??
var dbHost = Environment.GetEnvironmentVariable("DATABASE_HOST") ?? "localhost";
dbHost  // DATABASE_HOST (default)

// Set an env var (current process only — does NOT persist after exit)
Environment.SetEnvironmentVariable("PIPELINE_ENV", "staging");
Environment.GetEnvironmentVariable("PIPELINE_ENV")  // PIPELINE_ENV
```

    Alex
    ELYSIUM
    Windows_NT
    
    DATABASE_HOST (default): localhost
    staging

#### Environment.GetEnvironmentVariables — list all env vars

```csharp
// List all environment variables — diagnostic inspection

var allVars = Environment.GetEnvironmentVariables();
int count = 0;
foreach (System.Collections.DictionaryEntry entry in allVars)
{
    if (count++ >= 10) break;
    var val = entry.Value?.ToString();
    if (val != null && val.Length > 60) val = val[..60] + "...";
    $"  {entry.Key} = {val}"
}
$"  ... ({allVars.Count} total)"

// Cleanup
Environment.SetEnvironmentVariable("PIPELINE_ENV", null);
```

      CLAUDE_CODE_MAX_OUTPUT_TOKENS = 64000
      PSExecutionPolicyPreference = RemoteSigned
      ALLUSERSPROFILE = C:\ProgramData
      PYTHONUNBUFFERED = 1
      ASL.LOG = Destination=file
      VSCODE_DOTNET_INSTALL_TOOL_ORIGINAL_HOME = undefined
      PROCESSOR_REVISION = 4400
      USERDOMAIN_ROAMINGPROFILE = ELYSIUM
      PYTHON_FROZEN_MODULES = on
      CHROME_CRASHPAD_PIPE_NAME = \\.\pipe\crashpad_6836_LBXSBGYJGPFYPULP
      ... (75 total)

#### IConfiguration — structured settings

```csharp
// IConfiguration — structured settings from JSON, env vars, and more

var tmpDir = Path.Combine(Path.GetTempPath(), "config_demo_" + Guid.NewGuid().ToString("N")[..8]);
Directory.CreateDirectory(tmpDir);

var appSettings = Path.Combine(tmpDir, "appsettings.json");
File.WriteAllText(appSettings, @"{
  ""Pipeline"": {
    ""Name"": ""events_etl"",
    ""BatchSize"": 5000,
    ""MaxRetries"": 3,
    ""Enabled"": true
  },
  ""ConnectionStrings"": {
    ""Warehouse"": ""Server=prod-db;Database=analytics;Trusted_Connection=true""
  },
  ""Logging"": {
    ""LogLevel"": {
      ""Default"": ""Information""
    }
  }
}");
```

#### ConfigurationBuilder — JSON, env vars, command-line args

```csharp
// Building configuration from multiple sources — JSON + env vars

var config = new ConfigurationBuilder()
    .SetBasePath(tmpDir)
    .AddJsonFile("appsettings.json", optional: false)  // base config
    .AddEnvironmentVariables()                          // env vars override JSON
    .Build();

// Read flat values
// === Read Configuration ===
config["Pipeline:Name"]  // Pipeline name
config["Pipeline:BatchSize"]  // Batch size
config["Pipeline:MaxRetries"]  // Max retries
config["Pipeline:Enabled"]  // Enabled
config["ConnectionStrings:Warehouse"]  // Connection
```

    events_etl
    5000
    3
    True
    Server=prod-db;Database=analytics;Trusted_Connection=true

#### IConfiguration GetValue, GetSection, Bind — reading config values

```csharp
// Reading configuration values — GetValue<T>, GetSection, and binding

$"\n=== GetValue<T> with defaults ==="
config.GetValue<int>("Pipeline:BatchSize")  // BatchSize (int)
config.GetValue<bool>("Pipeline:Enabled")  // Enabled (bool)
config.GetValue<int>("Pipeline:Timeout", 30)  // Timeout (missing): default = 30

// GetSection — navigate nested config
var loggingSection = config.GetSection("Logging:LogLevel");
$"\n=== Nested Section: Logging:LogLevel ==="
foreach (var child in loggingSection.GetChildren())
    $"  {child.Key} = {child.Value}"
```

    
    5000
    True
    30
    
      Default = Information

#### Override config with environment variables

```csharp
// Environment variable override — __ separator for nested config keys

Environment.SetEnvironmentVariable("Pipeline__BatchSize", "10000");
var overriddenConfig = new ConfigurationBuilder()
    .SetBasePath(tmpDir)
    .AddJsonFile("appsettings.json")
    .AddEnvironmentVariables()    // env vars win over JSON
    .Build();

$"\n=== Env Var Override ==="
$"BatchSize (from JSON):    5000"
overriddenConfig["Pipeline:BatchSize"]  // BatchSize (after envvar)

// Cleanup
Environment.SetEnvironmentVariable("Pipeline__BatchSize", null);
Directory.Delete(tmpDir, true);
tmpDir  // Cleaned up
```

    
    5000
    10000
    
    C:\Users\aperi\AppData\Local\Temp\config_demo_1c1e72c6
