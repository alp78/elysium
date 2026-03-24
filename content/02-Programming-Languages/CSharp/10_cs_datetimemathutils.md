---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [datetime, timezones, date arithmetic, math operations, utility functions]
keywords: [DateTime, DateOnly, TimeOnly, TimeZoneInfo, TimeSpan, Math, Random, Guid, DateTimeOffset]
description: "C# date, time, math and utilities reference with executable examples and cell outputs — covers DateTime, DateOnly, TimeSpan, timezones, Math, Random, and Guid. See [[10_py_datetimemathutils]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[10_py_datetimemathutils]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 10. Date, Time, Math & Utilities - C#

Topics covered:
- Date & Time (moved from 01_Basics)
- Math & Random
- Logging
- Configuration & Environment Variables


```csharp
// Suppress CS1701/CS1702 assembly version warnings in .NET Interactive.
// NuGet packages targeting .NET 8/9 trigger these on .NET 10 — harmless.
// Run this cell ONCE before any cells that use NuGet packages.

using System.Reflection;
using Microsoft.DotNet.Interactive;
using Microsoft.DotNet.Interactive.CSharp;

var csharpKernel = (CSharpKernel)Kernel.Root.FindKernelByName("csharp");
var optionsField = typeof(CSharpKernel).GetField("_scriptOptions",
    BindingFlags.NonPublic | BindingFlags.Instance);

var scriptOptions = optionsField.GetValue(csharpKernel);
var withWarningLevel = scriptOptions.GetType().GetMethod("WithWarningLevel");
var newOptions = withWarningLevel.Invoke(scriptOptions, new object[] { 0 });
optionsField.SetValue(csharpKernel, newOptions);

Console.WriteLine("WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.");
```

## 1. Date & Time

Moved from 01_Basics. Full coverage: creating, parsing, formatting, timezones, arithmetic.


```csharp
// Creating date and time objects

// Current date and time
DateTime now = DateTime.Now;        // local time
DateTime utcNow = DateTime.UtcNow;  // UTC time
DateOnly today = DateOnly.FromDateTime(DateTime.Now);  // date only (.NET 6+)
TimeOnly currentTime = TimeOnly.FromDateTime(DateTime.Now);  // time only (.NET 6+)

Console.WriteLine($"DateTime.Now:    {now}");
Console.WriteLine($"DateTime.UtcNow: {utcNow}");
Console.WriteLine($"DateOnly:        {today}");
Console.WriteLine($"TimeOnly:        {currentTime}");
Console.WriteLine($"type:            {now.GetType()}");

// Creating specific dates/times
var dt = new DateTime(2024, 3, 15, 14, 30, 45);       // year, month, day, hour, min, sec
var d = new DateOnly(2024, 3, 15);                     // date only
var t = new TimeOnly(14, 30, 45);                      // time only
var dtTicks = new DateTime(2024, 3, 15, 14, 30, 45).AddTicks(1234560);  // with sub-ms

Console.WriteLine($"\nSpecific DateTime: {dt}");
Console.WriteLine($"Specific DateOnly: {d}");
Console.WriteLine($"Specific TimeOnly: {t}");
Console.WriteLine($"With ticks:        {dtTicks}");
```

    DateTime.Now:    16-Mar-26 13:28:05
    DateTime.UtcNow: 16-Mar-26 12:28:05
    DateOnly:        16-Mar-26
    TimeOnly:        13:28
    type:            System.DateTime
    
    Specific DateTime: 15-Mar-24 14:30:45
    Specific DateOnly: 15-Mar-24
    Specific TimeOnly: 14:30
    With ticks:        15-Mar-24 14:30:45
    


```csharp
// Accessing date/time components
var dt = new DateTime(2024, 3, 15, 14, 30, 45).AddTicks(1234560);

Console.WriteLine("=== Components ===");
Console.WriteLine($"Year:        {dt.Year}");
Console.WriteLine($"Month:       {dt.Month}");
Console.WriteLine($"Day:         {dt.Day}");
Console.WriteLine($"Hour:        {dt.Hour}");
Console.WriteLine($"Minute:      {dt.Minute}");
Console.WriteLine($"Second:      {dt.Second}");
Console.WriteLine($"Millisecond: {dt.Millisecond}");
Console.WriteLine($"Ticks:       {dt.Ticks}");          // 100-nanosecond intervals
Console.WriteLine($"DayOfWeek:   {dt.DayOfWeek}");      // Friday (enum)
Console.WriteLine($"DayOfYear:   {dt.DayOfYear}");
Console.WriteLine($"Week (ISO):  {System.Globalization.ISOWeek.GetWeekOfYear(dt)}");
Console.WriteLine($"Kind:        {dt.Kind}");            // Unspecified, Local, or Utc
```

    === Components ===
    Year:        2024
    Month:       3
    Day:         15
    Hour:        14
    Minute:      30
    Second:      45
    Millisecond: 123
    Ticks:       638461098451234560
    DayOfWeek:   Friday
    DayOfYear:   75
    Week (ISO):  11
    Kind:        Unspecified
    


```csharp
// Timestamp (Unix epoch) conversions

var now = DateTime.Now;

// DateTime -> Unix timestamp (seconds since 1970-01-01 00:00:00 UTC)
var dto = new DateTimeOffset(now);
long tsSeconds = dto.ToUnixTimeSeconds();
long tsMillis = dto.ToUnixTimeMilliseconds();
Console.WriteLine($"Timestamp: {dto}");
Console.WriteLine($"Timestamp (seconds): {tsSeconds}");
Console.WriteLine($"Timestamp (millis):  {tsMillis}");

// Timestamp -> DateTime
var fromTs = DateTimeOffset.FromUnixTimeSeconds(tsSeconds).LocalDateTime;
var fromTsUtc = DateTimeOffset.FromUnixTimeSeconds(tsSeconds).UtcDateTime;
Console.WriteLine($"\nFrom timestamp (local): {fromTs}");
Console.WriteLine($"From timestamp (UTC):   {fromTsUtc}");

// .NET Ticks (100-nanosecond intervals since 0001-01-01)
Console.WriteLine($"\n.NET Ticks: {now.Ticks}");
Console.WriteLine($"From ticks: {new DateTime(now.Ticks)}");

// Epoch
var epoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);
Console.WriteLine($"\nEpoch: {epoch}");
```

    Timestamp: 16-Mar-26 14:18:49 +01:00
    Timestamp (seconds): 1773667129
    Timestamp (millis):  1773667129467
    
    From timestamp (local): 16-Mar-26 14:18:49
    From timestamp (UTC):   16-Mar-26 13:18:49
    
    .NET Ticks: 639092675294672870
    From ticks: 16-Mar-26 14:18:49
    
    Epoch: 01-Jan-70 0:00:00
    


```csharp
// Parsing strings -> DateTime

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

Console.WriteLine("=== String -> DateTime (ParseExact) ===");
Console.WriteLine($"'{s1}' -> {dt1}");
Console.WriteLine($"'{s2}' -> {dt2}");
Console.WriteLine($"'{s3}' -> {dt3}");
Console.WriteLine($"'{s4}' -> {dt4}");
Console.WriteLine($"'{s5}' -> {dt5}");
Console.WriteLine($"'{s6}' -> {dt6}");

// Safe parsing with TryParseExact
if (DateTime.TryParseExact("not-a-date", "yyyy-MM-dd", null,
    System.Globalization.DateTimeStyles.None, out DateTime result))
    Console.WriteLine($"\nParsed: {result}");
else
    Console.WriteLine("\n'not-a-date' failed to parse (TryParseExact)");

// Auto-detect format with Parse
var auto = DateTime.Parse("2024-03-15T14:30:45");
Console.WriteLine($"Auto-parsed: {auto}");
```

    === String -> DateTime (ParseExact) ===
    '2024-03-15 14:30:45' -> 15-Mar-24 14:30:45
    '15/03/2024' -> 15-Mar-24 0:00:00
    'March 15, 2024 2:30 PM' -> 15-Mar-24 14:30:00
    '2024-03-15T14:30:45' -> 15-Mar-24 14:30:45
    '2024-03-15T14:30:45.1234560' -> 15-Mar-24 14:30:45
    'Fri, 15 Mar 2024 14:30:45' -> 15-Mar-24 14:30:45
    
    'not-a-date' failed to parse (TryParseExact)
    Auto-parsed: 15-Mar-24 14:30:45
    


```csharp
// Formatting DateTime -> string (ToString)

var dt = new DateTime(2024, 3, 15, 14, 30, 45).AddTicks(1234560);

Console.WriteLine("=== Standard Format Strings ===");
Console.WriteLine($"d  Short date:    {dt.ToString("d")}");
Console.WriteLine($"D  Long date:     {dt.ToString("D")}");
Console.WriteLine($"t  Short time:    {dt.ToString("t")}");
Console.WriteLine($"T  Long time:     {dt.ToString("T")}");
Console.WriteLine($"f  Full short:    {dt.ToString("f")}");
Console.WriteLine($"F  Full long:     {dt.ToString("F")}");
Console.WriteLine($"g  General short: {dt.ToString("g")}");
Console.WriteLine($"G  General long:  {dt.ToString("G")}");
Console.WriteLine($"M  Month/day:     {dt.ToString("M")}");
Console.WriteLine($"Y  Year/month:    {dt.ToString("Y")}");
Console.WriteLine($"R  RFC 1123:      {dt.ToString("R")}");
Console.WriteLine($"s  Sortable:      {dt.ToString("s")}");
Console.WriteLine($"u  Universal:     {dt.ToString("u")}");
Console.WriteLine($"o  Round-trip:    {dt.ToString("o")}");

Console.WriteLine("\n=== Custom Format Strings ===");
Console.WriteLine($"ISO 8601:       {dt.ToString("yyyy-MM-dd'T'HH:mm:ss")}");
Console.WriteLine($"Date only:      {dt.ToString("yyyy-MM-dd")}");
Console.WriteLine($"Time only:      {dt.ToString("HH:mm:ss")}");
Console.WriteLine($"US format:      {dt.ToString("MM/dd/yyyy")}");
Console.WriteLine($"EU format:      {dt.ToString("dd/MM/yyyy")}");
Console.WriteLine($"Long date:      {dt.ToString("MMMM dd, yyyy")}");
Console.WriteLine($"Short date:     {dt.ToString("MMM dd, yyyy")}");
Console.WriteLine($"12-hour:        {dt.ToString("hh:mm tt")}");
Console.WriteLine($"Day of week:    {dt.ToString("dddd")}");
Console.WriteLine($"Short day:      {dt.ToString("ddd")}");
Console.WriteLine($"With fraction:  {dt.ToString("yyyy-MM-dd'T'HH:mm:ss.fffffff")}");
Console.WriteLine($"Compact:        {dt.ToString("yyyyMMddHHmmss")}");

Console.WriteLine("\n=== All Custom Format Specifiers ===");
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
    Console.WriteLine($"  {spec,-8} = {dt.ToString(spec),-22} ({desc})");

// K and zzz need a timezone-aware DateTime to show useful output
var dtUtc = new DateTime(2024, 3, 15, 14, 30, 45, DateTimeKind.Utc);
var dtLocal = new DateTime(2024, 3, 15, 14, 30, 45, DateTimeKind.Local);
Console.WriteLine($"\n  K (UTC):       {dtUtc.ToString("%K")}");
Console.WriteLine($"  K (Local):     {dtLocal.ToString("%K")}");
Console.WriteLine($"  K (Unspec):    (empty - no timezone info)");
Console.WriteLine($"  zzz (Local):   {dtLocal.ToString("zzz")}");
```

    === Standard Format Strings ===
    d  Short date:    15-Mar-24
    D  Long date:     Friday, March 15, 2024
    t  Short time:    14:30
    T  Long time:     14:30:45
    f  Full short:    Friday, March 15, 2024 14:30
    F  Full long:     Friday, March 15, 2024 14:30:45
    g  General short: 15-Mar-24 14:30
    G  General long:  15-Mar-24 14:30:45
    M  Month/day:     March 15
    Y  Year/month:    March 2024
    R  RFC 1123:      Fri, 15 Mar 2024 14:30:45 GMT
    s  Sortable:      2024-03-15T14:30:45
    u  Universal:     2024-03-15 14:30:45Z
    o  Round-trip:    2024-03-15T14:30:45.1234560
    
    === Custom Format Strings ===
    ISO 8601:       2024-03-15T14:30:45
    Date only:      2024-03-15
    Time only:      14:30:45
    US format:      03-15-2024
    EU format:      15-03-2024
    Long date:      March 15, 2024
    Short date:     Mar 15, 2024
    12-hour:        02:30 PM
    Day of week:    Friday
    Short day:      Fri
    With fraction:  2024-03-15T14:30:45.1234560
    Compact:        20240315143045
    
    === All Custom Format Specifiers ===
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
    
      K (UTC):       Z
      K (Local):     +01:00
      K (Unspec):    (empty - no timezone info)
      zzz (Local):   +01:00
    


```csharp
// ISO 8601 conversions
var dt = new DateTime(2024, 3, 15, 14, 30, 45).AddTicks(1234560);

// DateTime -> ISO 8601 string
Console.WriteLine($"Round-trip (o):  {dt:o}");                           // 2024-03-15T14:30:45.1234560
Console.WriteLine($"Sortable (s):    {dt:s}");                           // 2024-03-15T14:30:45
Console.WriteLine($"Custom ISO:      {dt:yyyy-MM-ddTHH:mm:ss.fff}");    // with ms

// ISO 8601 string -> DateTime
var fromIso1 = DateTime.Parse("2024-03-15T14:30:45.1234560");
var fromIso2 = DateTime.Parse("2024-03-15T14:30:45Z");                  // UTC
var fromIso3 = DateTimeOffset.Parse("2024-03-15T14:30:45+05:30");       // with offset

Console.WriteLine($"\nFrom ISO:        {fromIso1}");
Console.WriteLine($"From ISO (Z):    {fromIso2} Kind={fromIso2.Kind}");
Console.WriteLine($"From ISO (+5:30):{fromIso3} Offset={fromIso3.Offset}");

// DateTimeOffset preserves timezone offset
var dto = DateTimeOffset.Parse("2024-03-15T14:30:45+05:30");
Console.WriteLine($"\nDateTimeOffset:  {dto}");
Console.WriteLine($"  UTC:           {dto.UtcDateTime}");
Console.WriteLine($"  Local:         {dto.LocalDateTime}");
Console.WriteLine($"  Offset:        {dto.Offset}");
```

    Round-trip (o):  2024-03-15T14:30:45.1234560
    Sortable (s):    2024-03-15T14:30:45
    Custom ISO:      2024-03-15T14:30:45.123
    
    From ISO:        15-Mar-24 14:30:45
    From ISO (Z):    15-Mar-24 15:30:45 Kind=Local
    From ISO (+5:30):15-Mar-24 14:30:45 +05:30 Offset=05:30:00
    
    DateTimeOffset:  15-Mar-24 14:30:45 +05:30
      UTC:           15-Mar-24 9:00:45
      Local:         15-Mar-24 10:00:45
      Offset:        05:30:00
    


```csharp
// Timezone management

// DateTime.Kind: Unspecified, Local, Utc
var unspec = new DateTime(2024, 3, 15, 14, 30, 45);                          // Unspecified
var local = new DateTime(2024, 3, 15, 14, 30, 45, DateTimeKind.Local);       // Local
var utc = new DateTime(2024, 3, 15, 14, 30, 45, DateTimeKind.Utc);           // Utc

Console.WriteLine($"Unspecified: {unspec}, Kind={unspec.Kind}");
Console.WriteLine($"Local:       {local}, Kind={local.Kind}");
Console.WriteLine($"UTC:         {utc}, Kind={utc.Kind}");

// TimeZoneInfo - system timezone database
var eastern = TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time");
var london = TimeZoneInfo.FindSystemTimeZoneById("GMT Standard Time");
var tokyo = TimeZoneInfo.FindSystemTimeZoneById("Tokyo Standard Time");
var india = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
var sydney = TimeZoneInfo.FindSystemTimeZoneById("AUS Eastern Standard Time");

// Converting between timezones
var utcNow = DateTime.UtcNow;
Console.WriteLine($"\nUTC now:     {utcNow}");
Console.WriteLine($"-> Eastern:  {TimeZoneInfo.ConvertTimeFromUtc(utcNow, eastern)}");
Console.WriteLine($"-> London:   {TimeZoneInfo.ConvertTimeFromUtc(utcNow, london)}");
Console.WriteLine($"-> Tokyo:    {TimeZoneInfo.ConvertTimeFromUtc(utcNow, tokyo)}");
Console.WriteLine($"-> Sydney:   {TimeZoneInfo.ConvertTimeFromUtc(utcNow, sydney)}");
Console.WriteLine($"-> India:    {TimeZoneInfo.ConvertTimeFromUtc(utcNow, india)}");

// DateTimeOffset - carries offset with it (preferred for tz work)
var dtoUtc = new DateTimeOffset(2024, 3, 15, 14, 30, 45, TimeSpan.Zero);
var dtoNy = dtoUtc.ToOffset(TimeSpan.FromHours(-4));
var dtoIndia = dtoUtc.ToOffset(new TimeSpan(5, 30, 0));

Console.WriteLine($"\nDateTimeOffset UTC:   {dtoUtc}");
Console.WriteLine($"-> New York (-4):     {dtoNy}");
Console.WriteLine($"-> India (+5:30):     {dtoIndia}");

// List all available timezones
Console.WriteLine($"\nAvailable timezones: {TimeZoneInfo.GetSystemTimeZones().Count}");
foreach (var tz in TimeZoneInfo.GetSystemTimeZones().Take(5))
    Console.WriteLine($"  {tz.Id} ({tz.DisplayName})");
```

    Unspecified: 15-Mar-24 14:30:45, Kind=Unspecified
    Local:       15-Mar-24 14:30:45, Kind=Local
    UTC:         15-Mar-24 14:30:45, Kind=Utc
    
    UTC now:     16-Mar-26 13:23:41
    -> Eastern:  16-Mar-26 9:23:41
    -> London:   16-Mar-26 13:23:41
    -> Tokyo:    16-Mar-26 22:23:41
    -> Sydney:   17-Mar-26 0:23:41
    -> India:    16-Mar-26 18:53:41
    
    DateTimeOffset UTC:   15-Mar-24 14:30:45 +00:00
    -> New York (-4):     15-Mar-24 10:30:45 -04:00
    -> India (+5:30):     15-Mar-24 20:00:45 +05:30
    
    Available timezones: 141
      Dateline Standard Time ((UTC-12:00) International Date Line West)
      UTC-11 ((UTC-11:00) Coordinated Universal Time-11)
      Aleutian Standard Time ((UTC-10:00) Aleutian Islands)
      Hawaiian Standard Time ((UTC-10:00) Hawaii)
      Marquesas Standard Time ((UTC-09:30) Marquesas Islands)
    


```csharp
// Date/time arithmetic with TimeSpan
var dt = new DateTime(2024, 3, 15, 14, 30, 45);

// Adding/subtracting time
Console.WriteLine("=== TimeSpan Arithmetic ===");
Console.WriteLine($"Original:           {dt}");
Console.WriteLine($"+ 7 days:           {dt.AddDays(7)}");
Console.WriteLine($"- 30 days:          {dt.AddDays(-30)}");
Console.WriteLine($"+ 2 hours:          {dt.AddHours(2)}");
Console.WriteLine($"+ 90 minutes:       {dt.AddMinutes(90)}");
Console.WriteLine($"+ 1w 3h 30m:        {dt.Add(new TimeSpan(7, 3, 30, 0))}");
Console.WriteLine($"+ 6 months:         {dt.AddMonths(6)}");    // built-in!
Console.WriteLine($"+ 1 year:           {dt.AddYears(1)}");     // built-in!

// Difference between dates
var dt1 = new DateTime(2024, 3, 15);
var dt2 = new DateTime(2024, 12, 25);
TimeSpan diff = dt2 - dt1;

Console.WriteLine($"\n=== Date Difference ===");
Console.WriteLine($"From {dt1:d} to {dt2:d}");
Console.WriteLine($"Difference:         {diff}");
Console.WriteLine($"Days:               {diff.Days}");
Console.WriteLine($"Total days:         {diff.TotalDays}");
Console.WriteLine($"Total hours:        {diff.TotalHours}");
Console.WriteLine($"Total seconds:      {diff.TotalSeconds}");

// Comparing dates
Console.WriteLine($"\ndt1 < dt2:   {dt1 < dt2}");
Console.WriteLine($"dt1 == dt2:  {dt1 == dt2}");
Console.WriteLine($"dt1 > dt2:   {dt1 > dt2}");
Console.WriteLine($"Compare:     {DateTime.Compare(dt1, dt2)}");
```




<div>

    <div id='dotnet-interactive-this-cell-$CACHE_BUSTER$' style='display: none'>

        The below script needs to be able to find the current output cell; this is an easy method to get it.

    </div>

    <script type='text/javascript'>

async function probeAddresses(probingAddresses) {

    function timeout(ms, promise) {

        return new Promise(function (resolve, reject) {

            setTimeout(function () {

                reject(new Error('timeout'))

            }, ms)

            promise.then(resolve, reject)

        })

    }



    if (Array.isArray(probingAddresses)) {

        for (let i = 0; i < probingAddresses.length; i++) {



            let rootUrl = probingAddresses[i];



            if (!rootUrl.endsWith('/')) {

                rootUrl = `${rootUrl}/`;

            }



            try {

                let response = await timeout(1000, fetch(`${rootUrl}discovery`, {

                    method: 'POST',

                    cache: 'no-cache',

                    mode: 'cors',

                    timeout: 1000,

                    headers: {

                        'Content-Type': 'text/plain'

                    },

                    body: probingAddresses[i]

                }));



                if (response.status == 200) {

                    return rootUrl;

                }

            }

            catch (e) { }

        }

    }

}



function loadDotnetInteractiveApi() {

    probeAddresses(["http://2a02:8308:718a:f200::655c:2048/","http://2a02:8308:718a:f200:8bd4:d06d:33ed:be05:2048/","http://2a02:8308:718a:f200:2c21:dd48:3480:3c4d:2048/","http://fe80::3212:d8da:d32d:4723%14:2048/","http://192.168.0.110:2048/","http://::1:2048/","http://127.0.0.1:2048/"])

        .then((root) => {

        // use probing to find host url and api resources

        // load interactive helpers and language services

        let dotnetInteractiveRequire = require.config({

        context: '22468.Microsoft.DotNet.Interactive.Http.HttpPort',

                paths:

            {

                'dotnet-interactive': `${root}resources`

                }

        }) || require;



            window.dotnetInteractiveRequire = dotnetInteractiveRequire;



            window.configureRequireFromExtension = function(extensionName, extensionCacheBuster) {

                let paths = {};

                paths[extensionName] = `${root}extensions/${extensionName}/resources/`;

                

                let internalRequire = require.config({

                    context: extensionCacheBuster,

                    paths: paths,

                    urlArgs: `cacheBuster=${extensionCacheBuster}`

                    }) || require;



                return internalRequire

            };

        

            dotnetInteractiveRequire([

                    'dotnet-interactive/dotnet-interactive'

                ],

                function (dotnet) {

                    dotnet.init(window);

                },

                function (error) {

                    console.log(error);

                }

            );

        })

        .catch(error => {console.log(error);});

    }



// ensure `require` is available globally

if ((typeof(require) !==  typeof(Function)) || (typeof(require.config) !== typeof(Function))) {

    let require_script = document.createElement('script');

    require_script.setAttribute('src', 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js');

    require_script.setAttribute('type', 'text/javascript');

    

    

    require_script.onload = function() {

        loadDotnetInteractiveApi();

    };



    document.getElementsByTagName('head')[0].appendChild(require_script);

}

else {

    loadDotnetInteractiveApi();

}



    </script>

</div>


    === TimeSpan Arithmetic ===
    Original:           15-Mar-24 14:30:45
    + 7 days:           22-Mar-24 14:30:45
    - 30 days:          14-Feb-24 14:30:45
    + 2 hours:          15-Mar-24 16:30:45
    + 90 minutes:       15-Mar-24 16:00:45
    + 1w 3h 30m:        22-Mar-24 18:00:45
    + 6 months:         15-Sep-24 14:30:45
    + 1 year:           15-Mar-25 14:30:45
    
    === Date Difference ===
    From 15-Mar-24 to 25-Dec-24
    Difference:         285.00:00:00
    Days:               285
    Total days:         285
    Total hours:        6840
    Total seconds:      24624000
    
    dt1 < dt2:   True
    dt1 == dt2:  False
    dt1 > dt2:   False
    Compare:     -1
    


```csharp
// Arithmetic on different date/time objects

// === DateTime: full arithmetic with Add* methods ===
var dt = new DateTime(2024, 3, 15, 14, 30, 45);
Console.WriteLine("=== DateTime arithmetic ===");
Console.WriteLine($"Original:        {dt}");
Console.WriteLine($"+ 1 day:         {dt.AddDays(1)}");
Console.WriteLine($"- 2 hours:       {dt.AddHours(-2)}");
Console.WriteLine($"+ 30 minutes:    {dt.AddMinutes(30)}");
Console.WriteLine($"+ 45 seconds:    {dt.AddSeconds(45)}");
Console.WriteLine($"+ 500ms:         {dt.AddMilliseconds(500)}");
Console.WriteLine($"+ 1.5 days:      {dt.AddDays(1.5)}");
Console.WriteLine($"+ 1 month:       {dt.AddMonths(1)}");       // built-in!
Console.WriteLine($"+ 1 year:        {dt.AddYears(1)}");        // built-in!
Console.WriteLine($"Combined:        {dt.Add(new TimeSpan(1, 2, 30, 15))}");  // 1d 2h 30m 15s

// === DateOnly: only days/months/years ===
var d = new DateOnly(2024, 3, 15);
Console.WriteLine($"\n=== DateOnly arithmetic ===");
Console.WriteLine($"Original:        {d}");
Console.WriteLine($"+ 7 days:        {d.AddDays(7)}");
Console.WriteLine($"- 30 days:       {d.AddDays(-30)}");
Console.WriteLine($"+ 1 month:       {d.AddMonths(1)}");
Console.WriteLine($"+ 1 year:        {d.AddYears(1)}");

// DateOnly difference (returns int days, not TimeSpan)
var d2 = new DateOnly(2024, 12, 25);
int daysDiff = d2.DayNumber - d.DayNumber;
Console.WriteLine($"Diff {d} to {d2}: {daysDiff} days");

// === TimeOnly: hours/minutes/seconds arithmetic ===
var t = new TimeOnly(14, 30, 45);
Console.WriteLine($"\n=== TimeOnly arithmetic ===");
Console.WriteLine($"Original:        {t}");
Console.WriteLine($"+ 2h 15m:        {t.Add(new TimeSpan(2, 15, 0))}");
Console.WriteLine($"- 45m:           {t.Add(new TimeSpan(0, -45, 0))}");
Console.WriteLine($"+ 30 seconds:    {t.Add(new TimeSpan(0, 0, 30))}");
Console.WriteLine($"AddHours(3):     {t.AddHours(3)}");
Console.WriteLine($"AddMinutes(90):  {t.AddMinutes(90)}");
// TimeOnly wraps around at midnight
Console.WriteLine($"+ 12 hours:      {t.AddHours(12)}");  // wraps past midnight

// === Timestamp: arithmetic via DateTimeOffset ===
var dtoNow = new DateTimeOffset(2024, 3, 15, 14, 30, 45, TimeSpan.Zero);
long ts = dtoNow.ToUnixTimeSeconds();
Console.WriteLine($"\n=== Timestamp arithmetic ===");
Console.WriteLine($"Original:        {ts}");
Console.WriteLine($"+ 1 day:         {ts + 86400}");
Console.WriteLine($"+ 1 hour:        {ts + 3600}");
Console.WriteLine($"+ 30 minutes:    {ts + 1800}");
Console.WriteLine($"+ 45 seconds:    {ts + 45}");
Console.WriteLine($"Back to DateTime: {DateTimeOffset.FromUnixTimeSeconds(ts + 86400).DateTime}");

// === Month arithmetic handles edge cases ===
var jan31 = new DateTime(2024, 1, 31);
Console.WriteLine($"\n=== Month edge cases ===");
Console.WriteLine($"Jan 31 + 1 month: {jan31.AddMonths(1)}");  // Feb 29 (leap year)
Console.WriteLine($"Jan 31 + 2 months:{jan31.AddMonths(2)}");  // Mar 31
Console.WriteLine($"Jan 31 + 1 year:  {jan31.AddYears(1)}");   // Jan 31
```

    === DateTime arithmetic ===
    Original:        15-Mar-24 14:30:45
    + 1 day:         16-Mar-24 14:30:45
    - 2 hours:       15-Mar-24 12:30:45
    + 30 minutes:    15-Mar-24 15:00:45
    + 45 seconds:    15-Mar-24 14:31:30
    + 500ms:         15-Mar-24 14:30:45
    + 1.5 days:      17-Mar-24 2:30:45
    + 1 month:       15-Apr-24 14:30:45
    + 1 year:        15-Mar-25 14:30:45
    Combined:        16-Mar-24 17:01:00
    
    === DateOnly arithmetic ===
    Original:        15-Mar-24
    + 7 days:        22-Mar-24
    - 30 days:       14-Feb-24
    + 1 month:       15-Apr-24
    + 1 year:        15-Mar-25
    Diff 15-Mar-24 to 25-Dec-24: 285 days
    
    === TimeOnly arithmetic ===
    Original:        14:30
    + 2h 15m:        16:45
    - 45m:           13:45
    + 30 seconds:    14:31
    AddHours(3):     17:30
    AddMinutes(90):  16:00
    + 12 hours:      2:30
    
    === Timestamp arithmetic ===
    Original:        1710513045
    + 1 day:         1710599445
    + 1 hour:        1710516645
    + 30 minutes:    1710514845
    + 45 seconds:    1710513090
    Back to DateTime: 16-Mar-24 14:30:45
    
    === Month edge cases ===
    Jan 31 + 1 month: 29-Feb-24 0:00:00
    Jan 31 + 2 months:31-Mar-24 0:00:00
    Jan 31 + 1 year:  31-Jan-25 0:00:00
    

## 2. Math & Random


```csharp
// Math class — static methods for common math operations.
// Python equivalent: import math
// All methods are static — you call Math.Sqrt(), never new Math().

Console.WriteLine("=== Basic Math ===");
Console.WriteLine($"Abs(-42):        {Math.Abs(-42)}");           // absolute value
Console.WriteLine($"Max(10, 20):     {Math.Max(10, 20)}");        // larger of two
Console.WriteLine($"Min(10, 20):     {Math.Min(10, 20)}");        // smaller of two
Console.WriteLine($"Clamp(15, 0, 10):{Math.Clamp(15, 0, 10)}");  // clamp to range [0,10]

Console.WriteLine("\n=== Rounding ===");
Console.WriteLine($"Floor(3.7):      {Math.Floor(3.7)}");         // round down → 3
Console.WriteLine($"Ceiling(3.2):    {Math.Ceiling(3.2)}");       // round up   → 4
Console.WriteLine($"Round(3.5):      {Math.Round(3.5)}");         // banker's rounding → 4
Console.WriteLine($"Round(2.5):      {Math.Round(2.5)}");         // banker's rounding → 2 (!)
Console.WriteLine($"Round(2.5, AwayFromZero): {Math.Round(2.5, MidpointRounding.AwayFromZero)}"); // → 3
Console.WriteLine($"Truncate(3.9):   {Math.Truncate(3.9)}");     // drop decimal → 3

Console.WriteLine("\n=== Powers & Roots ===");
Console.WriteLine($"Pow(2, 10):      {Math.Pow(2, 10)}");        // 2^10 = 1024
Console.WriteLine($"Sqrt(144):       {Math.Sqrt(144)}");          // √144 = 12
Console.WriteLine($"Cbrt(27):        {Math.Cbrt(27)}");           // ∛27 = 3
Console.WriteLine($"Log(100):        {Math.Log(100)}");           // natural log (ln)
Console.WriteLine($"Log10(100):      {Math.Log10(100)}");         // log base 10
Console.WriteLine($"Log2(1024):      {Math.Log2(1024)}");         // log base 2
Console.WriteLine($"Exp(1):          {Math.Exp(1)}");             // e^1

Console.WriteLine("\n=== Trigonometry (radians) ===");
Console.WriteLine($"PI:              {Math.PI}");
Console.WriteLine($"E:               {Math.E}");
Console.WriteLine($"Tau:             {Math.Tau}");                // 2π
Console.WriteLine($"Sin(π/2):        {Math.Sin(Math.PI / 2)}");  // 1
Console.WriteLine($"Cos(0):          {Math.Cos(0)}");             // 1
Console.WriteLine($"Atan2(1, 1):     {Math.Atan2(1, 1)}");       // π/4

Console.WriteLine("\n=== Special values ===");
Console.WriteLine($"double.NaN:            {double.NaN}");
Console.WriteLine($"double.PositiveInf:    {double.PositiveInfinity}");
Console.WriteLine($"IsNaN(0.0/0.0):        {double.IsNaN(0.0 / 0.0)}");
Console.WriteLine($"IsInfinity(1.0/0.0):   {double.IsInfinity(1.0 / 0.0)}");

// Data Engineering example: compute percentile rank
// Common for scoring, normalization, anomaly detection.
var latencies = new double[] { 12.5, 45.2, 3.1, 78.9, 22.0, 15.3, 99.1, 6.7, 33.4, 51.8 };
Array.Sort(latencies);
double p95Index = 0.95 * (latencies.Length - 1);
int lower = (int)Math.Floor(p95Index);
int upper = (int)Math.Ceiling(p95Index);
double p95 = latencies[lower] + (latencies[upper] - latencies[lower]) * (p95Index - lower);
Console.WriteLine($"\n=== DE: Percentile Calculation ===");
Console.WriteLine($"Latencies: [{string.Join(", ", latencies.Select(l => $"{l:F1}"))}]");
Console.WriteLine($"P95 latency: {p95:F2} ms");
```




<div>

    <div id='dotnet-interactive-this-cell-$CACHE_BUSTER$' style='display: none'>

        The below script needs to be able to find the current output cell; this is an easy method to get it.

    </div>

    <script type='text/javascript'>

async function probeAddresses(probingAddresses) {

    function timeout(ms, promise) {

        return new Promise(function (resolve, reject) {

            setTimeout(function () {

                reject(new Error('timeout'))

            }, ms)

            promise.then(resolve, reject)

        })

    }



    if (Array.isArray(probingAddresses)) {

        for (let i = 0; i < probingAddresses.length; i++) {



            let rootUrl = probingAddresses[i];



            if (!rootUrl.endsWith('/')) {

                rootUrl = `${rootUrl}/`;

            }



            try {

                let response = await timeout(1000, fetch(`${rootUrl}discovery`, {

                    method: 'POST',

                    cache: 'no-cache',

                    mode: 'cors',

                    timeout: 1000,

                    headers: {

                        'Content-Type': 'text/plain'

                    },

                    body: probingAddresses[i]

                }));



                if (response.status == 200) {

                    return rootUrl;

                }

            }

            catch (e) { }

        }

    }

}



function loadDotnetInteractiveApi() {

    probeAddresses(["http://2a02:8308:718a:f200::655c:2048/","http://2a02:8308:718a:f200:8bd4:d06d:33ed:be05:2048/","http://2a02:8308:718a:f200:4d6a:f754:e291:8378:2048/","http://fe80::3212:d8da:d32d:4723%14:2048/","http://192.168.0.110:2048/","http://::1:2048/","http://127.0.0.1:2048/"])

        .then((root) => {

        // use probing to find host url and api resources

        // load interactive helpers and language services

        let dotnetInteractiveRequire = require.config({

        context: '24248.Microsoft.DotNet.Interactive.Http.HttpPort',

                paths:

            {

                'dotnet-interactive': `${root}resources`

                }

        }) || require;



            window.dotnetInteractiveRequire = dotnetInteractiveRequire;



            window.configureRequireFromExtension = function(extensionName, extensionCacheBuster) {

                let paths = {};

                paths[extensionName] = `${root}extensions/${extensionName}/resources/`;

                

                let internalRequire = require.config({

                    context: extensionCacheBuster,

                    paths: paths,

                    urlArgs: `cacheBuster=${extensionCacheBuster}`

                    }) || require;



                return internalRequire

            };

        

            dotnetInteractiveRequire([

                    'dotnet-interactive/dotnet-interactive'

                ],

                function (dotnet) {

                    dotnet.init(window);

                },

                function (error) {

                    console.log(error);

                }

            );

        })

        .catch(error => {console.log(error);});

    }



// ensure `require` is available globally

if ((typeof(require) !==  typeof(Function)) || (typeof(require.config) !== typeof(Function))) {

    let require_script = document.createElement('script');

    require_script.setAttribute('src', 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js');

    require_script.setAttribute('type', 'text/javascript');

    

    

    require_script.onload = function() {

        loadDotnetInteractiveApi();

    };



    document.getElementsByTagName('head')[0].appendChild(require_script);

}

else {

    loadDotnetInteractiveApi();

}



    </script>

</div>


    === Basic Math ===
    Abs(-42):        42
    Max(10, 20):     20
    Min(10, 20):     10
    Clamp(15, 0, 10):10
    
    === Rounding ===
    Floor(3.7):      3
    Ceiling(3.2):    4
    Round(3.5):      4
    Round(2.5):      2
    Round(2.5, AwayFromZero): 3
    Truncate(3.9):   3
    
    === Powers & Roots ===
    Pow(2, 10):      1024
    Sqrt(144):       12
    Cbrt(27):        3
    Log(100):        4.605170185988092
    Log10(100):      2
    Log2(1024):      10
    Exp(1):          2.718281828459045
    
    === Trigonometry (radians) ===
    PI:              3.141592653589793
    E:               2.718281828459045
    Tau:             6.283185307179586
    Sin(π/2):        1
    Cos(0):          1
    Atan2(1, 1):     0.7853981633974483
    
    === Special values ===
    double.NaN:            NaN
    double.PositiveInf:    ∞
    IsNaN(0.0/0.0):        True
    IsInfinity(1.0/0.0):   True
    
    === DE: Percentile Calculation ===
    Latencies: [3.1, 6.7, 12.5, 15.3, 22.0, 33.4, 45.2, 51.8, 78.9, 99.1]
    P95 latency: 90.01 ms
    


```csharp
// Random number generation
// System.Random is the standard RNG. NOT cryptographically secure.
// For crypto: System.Security.Cryptography.RandomNumberGenerator.
// Python equivalent: import random

var rng = new Random(42);  // seed for reproducibility (like Python's random.seed(42))

Console.WriteLine("=== Random integers ===");
for (int i = 0; i < 5; i++)
    Console.Write($"{rng.Next(1, 101)} ");  // [1, 101) → 1..100 inclusive
Console.WriteLine();

Console.WriteLine("\n=== Random doubles ===");
for (int i = 0; i < 5; i++)
    Console.Write($"{rng.NextDouble():F4} ");  // [0.0, 1.0)
Console.WriteLine();

Console.WriteLine("\n=== Random bytes ===");
var buffer = new byte[8];
rng.NextBytes(buffer);
Console.WriteLine($"Bytes: [{string.Join(", ", buffer)}]");

// Shuffle an array — Random.Shuffle() available in .NET 8+
var items = new[] { "A", "B", "C", "D", "E" };
Console.WriteLine($"\nOriginal: [{string.Join(", ", items)}]");
rng.Shuffle(items);  // in-place shuffle
Console.WriteLine($"Shuffled: [{string.Join(", ", items)}]");

// Pick random element
var colors = new[] { "red", "green", "blue", "yellow" };
Console.WriteLine($"\nRandom pick: {colors[rng.Next(colors.Length)]}");

// Data Engineering example: generate synthetic test data
// Common for testing pipelines, load testing, staging environments.
Console.WriteLine("\n=== DE: Synthetic Event Data ===");
var eventTypes = new[] { "page_view", "click", "purchase", "signup" };
var regions = new[] { "us-east-1", "eu-west-1", "ap-south-1" };
var syntheticRng = new Random(123);

Console.WriteLine($"{"event_id",-12} {"type",-12} {"region",-12} {"revenue",8}");
Console.WriteLine(new string('─', 48));
for (int i = 0; i < 8; i++)
{
    var eventId = $"evt_{i + 1:D4}";
    var evtType = eventTypes[syntheticRng.Next(eventTypes.Length)];
    var region = regions[syntheticRng.Next(regions.Length)];
    var revenue = evtType == "purchase" ? Math.Round(syntheticRng.NextDouble() * 200, 2) : 0.0;
    Console.WriteLine($"{eventId,-12} {evtType,-12} {region,-12} {revenue,8:F2}");
}
```

    === Random integers ===
    67 15 13 53 17 
    
    === Random doubles ===
    0.2626 0.7244 0.5129 0.1737 0.7613 
    
    === Random bytes ===
    Bytes: [158, 86, 240, 173, 191, 58, 111, 183]
    
    Original: [A, B, C, D, E]
    Shuffled: [E, D, B, C, A]
    
    Random pick: red
    
    === DE: Synthetic Event Data ===
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
    

## 3. Logging


```csharp
#r "nuget: Microsoft.Extensions.Logging.Console"

// Logging in .NET — Microsoft.Extensions.Logging
// The standard logging abstraction for .NET apps, pipelines, and services.
// Python equivalent: import logging
//
// KEY CONCEPTS:
// - ILogger<T>: the logging interface — you inject it, never create directly.
// - LogLevel: Trace < Debug < Information < Warning < Error < Critical
//   (Python: DEBUG < INFO < WARNING < ERROR < CRITICAL — same idea)
// - Structured logging: log key-value pairs, not just strings.
//   e.g., logger.LogInformation("Processed {Count} rows", rowCount)
//   The {Count} is a named placeholder — logging backends (Seq, ELK, GCP) index it.
// - In notebooks/scripts we use LoggerFactory directly (no DI container).

// ── Basic console logging ──
// In a real app, this comes from dependency injection (builder.Services.AddLogging()).
// In a notebook/script, we build the factory manually.

using Microsoft.Extensions.Logging;

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


<div><div></div><div></div><div><strong>Installed Packages</strong><ul><li><span>Microsoft.Extensions.Logging.Console, 10.0.5</span></li></ul></div></div>


    dbug: PipelineDemo[0]
          Debug: starting pipeline
    info: PipelineDemo[0]
          Info: processed 42 rows
    warn: PipelineDemo[0]
          Warning: schema drift detected in events_raw
    fail: PipelineDemo[0]
          Error: failed to write partition 2024-03-15
    crit: PipelineDemo[0]
          Critical: pipeline halted — data loss risk
    


```csharp
#r "nuget: Microsoft.Extensions.Logging.Console"

// Structured logging — why it matters for Data Engineering
//
// Plain string logging:   "Processed 1500 rows from events table in 3.2s"
//   → You can grep for it, but you can't query row_count > 1000 in your log system.
//
// Structured logging:     logger.LogInformation("Processed {RowCount} rows from {Table}", 1500, "events")
//   → Log systems (Seq, ELK, GCP Logging) index RowCount, Table as separate fields.
//   → You can alert when RowCount == 0, dashboard Duration by Table, etc.
//
// Rule: use named placeholders {LikeThis}, NOT string interpolation $"like {this}".
// Interpolation bakes values into the string. Placeholders keep them as structured fields.

using Microsoft.Extensions.Logging;

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


<div><div></div><div></div><div><strong>Installed Packages</strong><ul><li><span>Microsoft.Extensions.Logging.Console, 10.0.5</span></li></ul></div></div>


    info: ETL[0]
          Pipeline started at 03/22/2026 01:37:50
    info: ETL[0]
          Loaded events_raw: 6714 rows in 876ms
    info: ETL[0]
          Loaded users: 1342 rows in 2709ms
    info: ETL[0]
          Loaded transactions: 1767 rows in 1460ms
    info: ETL[0]
          Pipeline completed at 03/22/2026 01:37:50
    

## 4. Configuration & Environment Variables


```csharp
// Environment variables — the simplest config mechanism.
// Used everywhere: Docker, Kubernetes, CI/CD, cloud functions.
// Python equivalent: os.environ, os.getenv()
//
// KEY CONCEPTS:
// - Environment.GetEnvironmentVariable(name): read a single var (returns null if missing).
// - Environment.SetEnvironmentVariable(name, value): set for current process only.
// - In production, env vars come from the OS, Docker, K8s secrets, CI/CD — never hardcoded.

Console.WriteLine("=== Environment Variables ===");

// Read common env vars
Console.WriteLine($"USERNAME:              {Environment.GetEnvironmentVariable("USERNAME")}");
Console.WriteLine($"COMPUTERNAME:          {Environment.GetEnvironmentVariable("COMPUTERNAME")}");
Console.WriteLine($"OS:                    {Environment.GetEnvironmentVariable("OS")}");

// Read a var that may not exist — always use null check or ??
var dbHost = Environment.GetEnvironmentVariable("DATABASE_HOST") ?? "localhost";
Console.WriteLine($"\nDATABASE_HOST (default): {dbHost}");

// Set an env var (current process only — does NOT persist after exit)
Environment.SetEnvironmentVariable("PIPELINE_ENV", "staging");
Console.WriteLine($"PIPELINE_ENV:          {Environment.GetEnvironmentVariable("PIPELINE_ENV")}");

// List all env vars (like Python's os.environ.items())
Console.WriteLine("\n=== All Environment Variables (first 10) ===");
var allVars = Environment.GetEnvironmentVariables();
int count = 0;
foreach (System.Collections.DictionaryEntry entry in allVars)
{
    if (count++ >= 10) break;
    var val = entry.Value?.ToString();
    if (val != null && val.Length > 60) val = val[..60] + "...";
    Console.WriteLine($"  {entry.Key} = {val}");
}
Console.WriteLine($"  ... ({allVars.Count} total)");

// Cleanup
Environment.SetEnvironmentVariable("PIPELINE_ENV", null);
```

    === Environment Variables ===
    USERNAME:              Alex
    COMPUTERNAME:          ELYSIUM
    OS:                    Windows_NT
    
    DATABASE_HOST (default): localhost
    PIPELINE_ENV:          staging
    
    === All Environment Variables (first 10) ===
      VSCODE_ESM_ENTRYPOINT = vs/workbench/api/node/extensionHostProcess
      VSCODE_CODE_CACHE_PATH = C:\Users\aperi\AppData\Roaming\Code\CachedData\07ff9d6178ede...
      HOMEPATH = \Users\aperi
      VSCODE_NLS_CONFIG = {"userLocale":"en-us","osLocale":"en-us","resolvedLanguage":...
      PROGRAMFILES = C:\Program Files
      CLAUDE_CODE_MAX_OUTPUT_TOKENS = 64000
      ONEDRIVE = C:\Users\aperi\OneDrive
      APPDATA = C:\Users\aperi\AppData\Roaming
      OS = Windows_NT
      LOGONSERVER = \\ELYSIUM
      ... (74 total)
    


```csharp
#r "nuget: Microsoft.Extensions.Configuration"
#r "nuget: Microsoft.Extensions.Configuration.Json"
#r "nuget: Microsoft.Extensions.Configuration.EnvironmentVariables"
#r "nuget: Microsoft.Extensions.Configuration.Binder"

using System.IO;
using Microsoft.Extensions.Configuration;

// Configuration in .NET — Microsoft.Extensions.Configuration
// The standard way to manage app settings in .NET services and pipelines.
// Reads from multiple sources: JSON files, env vars, command-line args, Azure Key Vault.
// Python equivalent: python-dotenv, configparser, or pydantic-settings.
//
// KEY CONCEPTS:
// - IConfiguration: the config interface — accessed via DI in real apps.
// - Configuration sources are layered (last wins):
//   appsettings.json → appsettings.{env}.json → env vars → command-line args
// - Env vars override JSON — this is how you configure per-environment in Docker/K8s.
// - __double_underscore__ or : separates nested keys in env vars:
//   Pipeline__BatchSize → Pipeline:BatchSize in config.

// In a notebook we build the config manually (in a real app, Host.CreateDefaultBuilder does this).
// NOTE: Microsoft.Extensions.Configuration is included in .NET Interactive by default.

// Simulate appsettings.json content by writing a temp file
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

// Build configuration from JSON + env vars
var config = new ConfigurationBuilder()
    .SetBasePath(tmpDir)
    .AddJsonFile("appsettings.json", optional: false)  // base config
    .AddEnvironmentVariables()                          // env vars override JSON
    .Build();

// Read flat values
Console.WriteLine("=== Read Configuration ===");
Console.WriteLine($"Pipeline name: {config["Pipeline:Name"]}");
Console.WriteLine($"Batch size:    {config["Pipeline:BatchSize"]}");
Console.WriteLine($"Max retries:   {config["Pipeline:MaxRetries"]}");
Console.WriteLine($"Enabled:       {config["Pipeline:Enabled"]}");
Console.WriteLine($"Connection:    {config["ConnectionStrings:Warehouse"]}");

// GetValue<T> with default — type-safe access
Console.WriteLine($"\n=== GetValue<T> with defaults ===");
Console.WriteLine($"BatchSize (int):    {config.GetValue<int>("Pipeline:BatchSize")}");
Console.WriteLine($"Enabled (bool):     {config.GetValue<bool>("Pipeline:Enabled")}");
Console.WriteLine($"Timeout (missing):  {config.GetValue<int>("Pipeline:Timeout", 30)}");  // default = 30

// GetSection — navigate nested config
var loggingSection = config.GetSection("Logging:LogLevel");
Console.WriteLine($"\n=== Nested Section: Logging:LogLevel ===");
foreach (var child in loggingSection.GetChildren())
    Console.WriteLine($"  {child.Key} = {child.Value}");

// Override with env var — env var name uses __ for nesting
// Pipeline__BatchSize → Pipeline:BatchSize
Environment.SetEnvironmentVariable("Pipeline__BatchSize", "10000");
var overriddenConfig = new ConfigurationBuilder()
    .SetBasePath(tmpDir)
    .AddJsonFile("appsettings.json")
    .AddEnvironmentVariables()    // env vars win over JSON
    .Build();

Console.WriteLine($"\n=== Env Var Override ===");
Console.WriteLine($"BatchSize (from JSON):    5000");
Console.WriteLine($"BatchSize (after envvar): {overriddenConfig["Pipeline:BatchSize"]}");

// Cleanup
Environment.SetEnvironmentVariable("Pipeline__BatchSize", null);
Directory.Delete(tmpDir, true);
Console.WriteLine($"\nCleaned up: {tmpDir}");
```


<div><div></div><div></div><div><strong>Installed Packages</strong><ul><li><span>microsoft.extensions.configuration, 10.0.5</span></li><li><span>microsoft.extensions.configuration.binder, 10.0.5</span></li><li><span>Microsoft.Extensions.Configuration.EnvironmentVariables, 10.0.5</span></li><li><span>Microsoft.Extensions.Configuration.Json, 10.0.5</span></li></ul></div></div>


    === Read Configuration ===
    Pipeline name: events_etl
    Batch size:    5000
    Max retries:   3
    Enabled:       True
    Connection:    Server=prod-db;Database=analytics;Trusted_Connection=true
    
    === GetValue<T> with defaults ===
    BatchSize (int):    5000
    Enabled (bool):     True
    Timeout (missing):  30
    
    === Nested Section: Logging:LogLevel ===
      Default = Information
    
    === Env Var Override ===
    BatchSize (from JSON):    5000
    BatchSize (after envvar): 10000
    
    Cleaned up: C:\Users\aperi\AppData\Local\Temp\config_demo_489d41bf
    
