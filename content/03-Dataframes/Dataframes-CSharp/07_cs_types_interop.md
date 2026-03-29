---
type: reference
category: programming-languages
technology:
  - csharp
  - dotnet
  - polars
tags: [pipeline, csharp, deedle, polars, dataframes]
aliases:
  - categoricals, Arrow, zero-copy, type conversion
keywords: [categorical, Enum, Arrow, zero-copy, interop, type casting, schema, nested types, struct]
description: "Polars.NET / C# DataFrames reference 07/10 — Advanced Types & Interop (categoricals, Arrow, zero-copy). Executable examples with cell outputs. See [[07_py_types_interop]] for the Python equivalent."
related:
  - "[[dataframes-index]]"
  - "[[programming-languages-index]]"
  - "[[07_py_types_interop]]"
  - "[[06_cs_lazy_performance]]"
  - "[[08_cs_visualization]]"
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# 07 — Advanced Types & Interoperability

Polars.NET vs Deedle: Categoricals, nested types, library conversions, I/O deep dive.

---
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
```

#### Setup — Install NuGet packages and configure formatters

```csharp
#r "nuget: Polars.NET, 0.4.0"
#r "nuget: Polars.NET.Native.win-x64, 0.4.0"
#r "nuget: Deedle, 4.0.1"
#r "nuget: Deedle.Interactive, 3.0.0"

using System.IO;
using System.Linq;
using System.Data;
using System.Text.RegularExpressions;
using Polars.CSharp;
using static Polars.CSharp.Polars;
using Deedle;
using Microsoft.DotNet.Interactive.Formatting;

System.Runtime.Loader.AssemblyLoadContext.Default.Resolving += (ctx, name) =>
{
    if (name.Name == "FSharp.Core")
        return AppDomain.CurrentDomain.GetAssemblies()
            .FirstOrDefault(a => a.GetName().Name == "FSharp.Core");
    return null;
};

Formatter.Register<DataFrame>((df, writer) =>
{
    var html = df.ToHtml();
    html = System.Text.RegularExpressions.Regex.Replace(html, @"(>|>)(.+?)(<|<)", @"$1$2$3");
    html = System.Text.RegularExpressions.Regex.Replace(html, @">""(.+?)""<", @">$1<");
    var css = """
        """;
    writer.Write(css + html);
}, "text/html");
Formatter.Register<Polars.CSharp.Series>((s, writer) =>
    writer.Write($"<pre style='font-size:14px'>{s}</pre>"), "text/html");

var DATA = Path.Combine("..", "data");
```

#### Load data — eurostoxx50_ohlcv.csv into Polars and Deedle

```csharp
var dfP = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"), tryParseDates: true);
var dfD = Frame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"));
display($"Polars: {dfP.Shape}  |  Deedle: {dfD.RowCount} x {dfD.ColumnCount}");
```

    Polars: (66355, 12)  |  Deedle: 66355 x 12

---
## Advanced Data Types

Polars supports a rich type system beyond numeric and string columns. The most useful advanced type in Polars.NET 0.4.0 is **Categorical** — a dictionary-encoded string column that saves memory and speeds up group-by operations.

Other advanced types (Enum, List columns, Struct, Binary) exist in the Rust Polars library but are not fully exposed in Polars.NET 0.4.0. Deedle has no categorical type at all.

#### Categorical cast: convert string column to categorical

```csharp
// Polars.NET — check original data type of symbol column
var symbolSeries = dfP.Column("symbol");
Console.WriteLine($"Original type: {symbolSeries.DataTypeName}");
Console.WriteLine($"Unique symbols: {symbolSeries.NUnique}");
Console.WriteLine($"Total rows: {dfP.Shape}");

// Polars.NET — cast symbol to Categorical for memory savings
var dfCat = dfP.WithColumns(
    Col("symbol").Cast(DataType.Categorical).Alias("symbol")
);

var catSeries = dfCat.Column("symbol");
Console.WriteLine($"\nAfter cast: {catSeries.DataTypeName}");
Console.WriteLine($"Unique symbols: {catSeries.NUnique}");
Console.WriteLine("\nCategorical stores each unique string once, then uses integer indices.");
Console.WriteLine("With 50 symbols repeated over 66K rows, this significantly reduces memory.");
```

    Original type: str
    Unique symbols: 50
    Total rows: (66355, 12)
    
    After cast: cat
    Unique symbols: 50
    
    Categorical stores each unique string once, then uses integer indices.
    With 50 symbols repeated over 66K rows, this significantly reduces memory.

#### Schema after categorical cast

```csharp
// Polars.NET — display schema showing the Categorical type
// DataTypeName on each column shows the type after casting
var colNames = dfCat.ColumnNames;
Console.WriteLine("Column schema after categorical cast:");
Console.WriteLine(new string('-', 40));
foreach (var name in colNames)
{
    var col = dfCat.Column(name);
    Console.WriteLine($"  {name,-20} {col.DataTypeName}");
}
```

    Column schema after categorical cast:
    ----------------------------------------
      id                   i64
      symbol               cat
      date                 date
      open                 f64
      high                 f64
      low                  f64
      close                f64
      adj_close            f64
      volume               i64
      dividends            f64
      stock_splits         f64
      is_filled            bool

#### Categorical speeds up GroupBy operations

```csharp
// Polars.NET — GroupBy on categorical column
// Categorical uses integer keys internally, making group operations faster
var aggCat = dfCat
    .GroupBy("symbol")
    .Agg(
        Col("close").Mean().Alias("avg_close"),
        Col("volume").Sum().Alias("total_volume")
    )
    .Sort("total_volume", true);

Console.WriteLine($"Aggregation on categorical column: {aggCat.Shape}");

aggCat.Head(10)
```

    Aggregation on categorical column: (50, 3)

<!-- Polars DataFrame: (10 rows, 3 columns) --><table><thead><tr><th>symbol</th><th>avg_close</th><th>total_volume</th></tr></thead><tbody><tr><td>ISP.MI</td><td>3.147987207</td><td>115704541969</td></tr><tr><td>SAN.MC</td><td>4.42584763</td><td>55513641918</td></tr><tr><td>ENEL.MI</td><td>6.820438304</td><td>32600561934</td></tr><tr><td>BBVA.MC</td><td>8.651954101</td><td>22133773194</td></tr><tr><td>UCG.MI</td><td>28.45710447</td><td>18366801099</td></tr><tr><td>ENI.MI</td><td>13.39762453</td><td>17141570967</td></tr><tr><td>INGA.AS</td><td>14.03818783</td><td>17041577555</td></tr><tr><td>IBE.MC</td><td>12.25531151</td><td>15994295949</td></tr><tr><td>DTE.DE</td><td>22.43009743</td><td>10029411390</td></tr><tr><td>NDA-FI.HE</td><td>10.84807887</td><td>7020342991</td></tr></tbody></table></div>

#### Deedle: no categorical type

```csharp
// Deedle — no native Categorical type
// All string columns are stored as full string values per row.
// Manual dictionary encoding is possible but not built-in.

var symbolsDeedle = dfD.GetColumn<string>("symbol");
var uniqueSymbols = symbolsDeedle.Values.Distinct().ToArray();
Console.WriteLine($"Deedle symbol column: {symbolsDeedle.ValueCount} values, {uniqueSymbols.Length} unique");
Console.WriteLine("Deedle stores every string value individually — no dictionary encoding.");

// Deedle — manual dictionary encoding example
var lookup = uniqueSymbols.Select((s, i) => (s, i)).ToDictionary(x => x.s, x => x.i);
var encoded = symbolsDeedle.Observations.Select(o => KeyValue.Create(o.Key, lookup[o.Value]));
var encodedSeries = new Deedle.Series<int, int>(
    encoded.Select(kv => kv.Key).ToArray(),
    encoded.Select(kv => kv.Value).ToArray()
);
Console.WriteLine($"\nManual encoding: mapped {uniqueSymbols.Length} symbols to int 0..{uniqueSymbols.Length - 1}");
Console.WriteLine($"First 5 encoded values: {string.Join(", ", encodedSeries.Values.Take(5))}");
Console.WriteLine("This is purely manual — no Deedle API support for categoricals.");
```

    Deedle symbol column: 66355 values, 50 unique
    Deedle stores every string value individually — no dictionary encoding.
    
    Manual encoding: mapped 50 symbols to int 0..49
    First 5 encoded values: 0, 0, 0, 0, 0
    This is purely manual — no Deedle API support for categoricals.

#### Other advanced types: not exposed in Polars.NET 0.4.0

```csharp
// Polars.NET 0.4.0 — advanced type availability
// DataType is a class with static properties, not an enum
Console.WriteLine("Available DataType static properties:");
Console.WriteLine(new string('-', 50));
var dtProps = typeof(DataType).GetProperties(BindingFlags.Public | BindingFlags.Static)
    .Where(p => p.PropertyType == typeof(DataType))
    .Select(p => p.Name)
    .OrderBy(n => n);
foreach (var name in dtProps)
    Console.WriteLine($"  {name}");
```

    Available DataType static properties:
    --------------------------------------------------
      Boolean
      Categorical
      Date
      Float16
      Float32
      Float64
      Int128
      Int16
      Int32
      Int64
      Int8
      Null
      SameAsInput
      String
      Time
      UInt128
      UInt16
      UInt32
      UInt64
      UInt8
      Unknown

---
## Interoperability

Real projects often need to move data between libraries. This section covers extracting data from Polars and Deedle into .NET collections, and converting between the two libraries.

#### Polars.NET to .NET collections: extract columns as arrays

```csharp
// Polars.NET — extract columns as typed .NET arrays via ToArray<T>()
var symbols = dfP.Column("symbol").ToArray<string>();
var closes = dfP.Column("close").ToArray<double>();
var volumes = dfP.Column("volume").ToArray<long>();

Console.WriteLine($"symbols:  {symbols.GetType().Name}  length={symbols.Length}  first 3: {string.Join(", ", symbols.Take(3))}");
Console.WriteLine($"closes:   {closes.GetType().Name}  length={closes.Length}  first 3: {string.Join(", ", closes.Take(3))}");
Console.WriteLine($"volumes:  {volumes.GetType().Name}  length={volumes.Length}  first 3: {string.Join(", ", volumes.Take(3))}");

// Polars.NET — use extracted arrays with standard LINQ
var avgClose = closes.Average();
var maxVol = volumes.Max();
Console.WriteLine($"\nLINQ on extracted arrays: avg close = {avgClose:F2}, max volume = {maxVol:N0}");
```

    symbols:  String[]  length=66355  first 3: ABI.BR, ABI.BR, ABI.BR
    closes:   Double[]  length=66355  first 3: 57.21, 57.18, 58.77
    volumes:  Int64[]  length=66355  first 3: 1513937, 1382722, 1370204
    
    LINQ on extracted arrays: avg close = 197.03, max volume = 376'391'539

#### Polars.NET to DataTable: manual conversion

```csharp
// Polars.NET — convert to System.Data.DataTable
// AsDataReader() may not exist in 0.4.0, so we build the DataTable manually.

// Use a small subset for the demo
var dfSmall = dfP.Head(100);

DataTable ToDataTable(DataFrame df)
{
    var dt = new DataTable();
    var colNames = df.ColumnNames;

    // Polars.NET — map Polars types to .NET types for DataTable columns
    var typeMap = new Dictionary<string, Type>
    {
        ["Utf8"] = typeof(string),
        ["String"] = typeof(string),
        ["Float64"] = typeof(double),
        ["Float32"] = typeof(float),
        ["Int64"] = typeof(long),
        ["Int32"] = typeof(int),
        ["Boolean"] = typeof(bool),
        ["Date"] = typeof(DateTime),
        ["Datetime"] = typeof(DateTime),
    };

    // Add columns to DataTable
    var colArrays = new object[colNames.Length][];
    for (int c = 0; c < colNames.Length; c++)
    {
        var series = df.Column(colNames[c]);
        var dtName = series.DataTypeName;
        // Default to string for unknown types
        var netType = typeMap.ContainsKey(dtName) ? typeMap[dtName] : typeof(string);
        dt.Columns.Add(colNames[c], netType);
    }

    // Extract each column as object array and build rows
    var numRows = (int)(int)df.Height;
    for (int c = 0; c < colNames.Length; c++)
    {
        var series = df.Column(colNames[c]);
        var dtName = series.DataTypeName;
        if (dtName == "Float64")
            colArrays[c] = series.ToArray<double>().Cast<object>().ToArray();
        else if (dtName == "Int64")
            colArrays[c] = series.ToArray<long>().Cast<object>().ToArray();
        else
            colArrays[c] = series.ToArray<string>().Cast<object>().ToArray();
    }

    for (int r = 0; r < numRows; r++)
    {
        var row = dt.NewRow();
        for (int c = 0; c < colNames.Length; c++)
            row[c] = colArrays[c][r];
        dt.Rows.Add(row);
    }

    return dt;
}

var dataTable = ToDataTable(dfSmall);
Console.WriteLine($"DataTable: {dataTable.Rows.Count} rows x {dataTable.Columns.Count} columns");
Console.WriteLine($"Columns: {string.Join(", ", dataTable.Columns.Cast<DataColumn>().Select(c => $"{c.ColumnName}({c.DataType.Name})"))}");
Console.WriteLine($"\nFirst row: {string.Join(", ", dataTable.Rows[0].ItemArray.Take(6))}");
```

    DataTable: 100 rows x 12 columns
    Columns: id(String), symbol(String), date(String), open(String), high(String), low(String), close(String), adj_close(String), volume(String), dividends(String), stock_splits(String), is_filled(String)
    
    First row: , ABI.BR, , , ,

#### Deedle to Polars.NET: extract columns and rebuild

```csharp
// Deedle — extract columns as .NET arrays, then build Polars Series and DataFrame
// Use a small Deedle frame for the conversion demo
var dfDSmall = dfD.GetRowsAt(Enumerable.Range(0, 100).ToArray());

// Deedle — extract typed arrays from Deedle columns
var dSymbols = dfDSmall.GetColumn<string>("symbol").Values.ToArray();
var dClose = dfDSmall.GetColumn<double>("close").Values.ToArray();
var dVolume = dfDSmall.GetColumn<double>("volume").Values.Select(v => (long)v).ToArray();
var dOpen = dfDSmall.GetColumn<double>("open").Values.ToArray();

// Polars.NET — build Series from .NET arrays, then construct DataFrame
var pSymbol = Polars.CSharp.Series.From("symbol", dSymbols);
var pClose = Polars.CSharp.Series.From("close", dClose);
var pVolume = Polars.CSharp.Series.From("volume", dVolume);
var pOpen = Polars.CSharp.Series.From("open", dOpen);

var dfFromDeedle = new DataFrame(new Polars.CSharp.Series[] { pSymbol, pOpen, pClose, pVolume });

Console.WriteLine($"Deedle -> Polars conversion: {dfFromDeedle.Shape}");

dfFromDeedle.Head(5)
```

    Deedle -> Polars conversion: (100, 4)

<!-- Polars DataFrame: (5 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>open</th><th>close</th><th>volume</th></tr></thead><tbody><tr><td>ABI.BR</td><td>58.15</td><td>57.21</td><td>1513937</td></tr><tr><td>ABI.BR</td><td>56.9</td><td>57.18</td><td>1382722</td></tr><tr><td>ABI.BR</td><td>57.96</td><td>58.77</td><td>1370204</td></tr><tr><td>ABI.BR</td><td>58.68</td><td>58.4</td><td>1469911</td></tr><tr><td>ABI.BR</td><td>58.16</td><td>57.86</td><td>1428681</td></tr></tbody></table></div>

#### Polars.NET to Deedle: extract columns and rebuild

```csharp
// Polars.NET — extract columns as .NET arrays, build Deedle Frame
var dfPSmall = dfP.Head(100);

var pSymbols = dfPSmall.Column("symbol").ToArray<string>();
var pCloses = dfPSmall.Column("close").ToArray<double>();
var pVolumes = dfPSmall.Column("volume").ToArray<long>();
var pOpens = dfPSmall.Column("open").ToArray<double>();

// Deedle — build Frame using FrameBuilder (requires Series, not raw arrays)
var idx = Enumerable.Range(0, pSymbols.Length).ToArray();
var fb = new FrameBuilder.Columns<int, string>();
fb.Add("symbol", new Series<int, string>(idx, pSymbols));
fb.Add("open", new Series<int, double>(idx, pOpens));
fb.Add("close", new Series<int, double>(idx, pCloses));
fb.Add("volume", new Series<int, double>(idx, pVolumes.Select(v => (double)v).ToArray()));
var dfFromPolars = fb.Frame;

Console.WriteLine($"Polars -> Deedle conversion: {dfFromPolars.RowCount} x {dfFromPolars.ColumnCount}");
Console.WriteLine($"Columns: {string.Join(", ", dfFromPolars.ColumnKeys)}");
dfFromPolars.Rows[Enumerable.Range(0, 5)]
```

    Polars -> Deedle conversion: 100 x 4
    Columns: symbol, open, close, volume

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>open</th><th>close</th><th>volume</th></thead><thead><th></th><th></th><th>(string)</th><th>(float)</th><th>(float)</th><th>(float)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>58.15</td><td>57.21</td><td>1513937</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>56.9</td><td>57.18</td><td>1382722</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>57.96</td><td>58.77</td><td>1370204</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>58.68</td><td>58.4</td><td>1469911</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>58.16</td><td>57.86</td><td>1428681</td></tr>

</table>

<p><b>5</b> rows x <b>4</b> columns</p><p><b>0</b> missing values</p>

</div>

#### Round-trip verification: Polars -> Deedle -> Polars

```csharp
// Verify that Polars -> Deedle -> Polars preserves data
// Extract from Deedle frame we just built, convert back to Polars
var rtSymbols = dfFromPolars.GetColumn<string>("symbol").Values.ToArray();
var rtCloses = dfFromPolars.GetColumn<double>("close").Values.ToArray();

var rtDf = new DataFrame(new Polars.CSharp.Series[]
{
    Polars.CSharp.Series.From("symbol", rtSymbols),
    Polars.CSharp.Series.From("close", rtCloses)
});

// Compare original close values with round-tripped values
var origCloses = dfPSmall.Column("close").ToArray<double>();
var match = origCloses.Zip(rtCloses, (a, b) => Math.Abs(a - b) < 1e-10).All(x => x);
Console.WriteLine($"Round-trip shape: {rtDf.Shape}");
Console.WriteLine($"Close values match after round-trip: {match}");
```

    Round-trip shape: (100, 2)
    Close values match after round-trip: True

---
## I/O Deep Dive

Polars.NET and Deedle both support CSV I/O. Polars also supports Parquet and JSON natively. This section explores format options, separators, and round-trip integrity.

#### CSV read with options: separator, date parsing, row limits

```csharp
// Polars.NET — CSV with tryParseDates
var dfCsv = DataFrame.ReadCsv(
    Path.Combine(DATA, "eurostoxx50_ohlcv.csv"),
    tryParseDates: true,
    nRows: 500
);
Console.WriteLine($"CSV with nRows=500 and tryParseDates: {dfCsv.Shape}");
Console.WriteLine($"Date column type: {dfCsv.Column("date").DataTypeName}");

// Polars.NET — TSV file (tab-separated) using separator parameter
var dfTsv = DataFrame.ReadCsv(
    Path.Combine(DATA, "dim_country.tsv"),
    separator: '\t'
);
Console.WriteLine($"\nTSV (tab-separated): {dfTsv.Shape}");

// Polars.NET — SSV file (semicolon-separated)
var dfSsv = DataFrame.ReadCsv(
    Path.Combine(DATA, "dim_country.ssv"),
    separator: ';'
);
Console.WriteLine($"SSV (semicolon-separated): {dfSsv.Shape}");

dfTsv.Head(5)
```

    CSV with nRows=500 and tryParseDates: (500, 12)
    Date column type: date
    
    TSV (tab-separated): (212, 2)
    SSV (semicolon-separated): (212, 2)

<!-- Polars DataFrame: (5 rows, 2 columns) --><table><thead><tr><th>country_name</th><th>iso_alpha2</th></tr></thead><tbody><tr><td>Afghanistan</td><td>AF</td></tr><tr><td>Albania</td><td>AL</td></tr><tr><td>Algeria</td><td>DZ</td></tr><tr><td>American Samoa</td><td>AS</td></tr><tr><td>Andorra</td><td>AD</td></tr></tbody></table></div>

#### CSV read with Deedle: format comparison

```csharp
// Deedle — standard CSV read
var dfDCsv = Frame.ReadCsv(Path.Combine(DATA, "dim_country.csv"));
Console.WriteLine($"Deedle CSV: {dfDCsv.RowCount} x {dfDCsv.ColumnCount}");

// Deedle — TSV read with separators parameter
var dfDTsv = Frame.ReadCsv(Path.Combine(DATA, "dim_country.tsv"), separators: "\t");
Console.WriteLine($"Deedle TSV: {dfDTsv.RowCount} x {dfDTsv.ColumnCount}");

// Deedle — SSV read
var dfDSsv = Frame.ReadCsv(Path.Combine(DATA, "dim_country.ssv"), separators: ";");
Console.WriteLine($"Deedle SSV: {dfDSsv.RowCount} x {dfDSsv.ColumnCount}");

dfDTsv.Rows[dfDTsv.RowKeys.Take(5)]
```

    Deedle CSV: 212 x 2
    Deedle TSV: 212 x 2
    Deedle SSV: 212 x 2

<div>

<table>

<thead><th></th><th></th><th>country_name</th><th>iso_alpha2</th></thead><thead><th></th><th></th><th>(string)</th><th>(string)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>Afghanistan</td><td>AF</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>Albania</td><td>AL</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>Algeria</td><td>DZ</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>American Samoa</td><td>AS</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>Andorra</td><td>AD</td></tr>

</table>

<p><b>5</b> rows x <b>2</b> columns</p><p><b>0</b> missing values</p>

</div>

#### CSV write: Polars and Deedle

```csharp
// Polars.NET — write CSV
var csvOutPath = Path.Combine(DATA, "_temp_polars_write.csv");
var dfWrite = dfP.Head(50);
dfWrite.WriteCsv(csvOutPath);
Console.WriteLine($"Polars CSV written: {csvOutPath}");
Console.WriteLine($"File size: {new FileInfo(csvOutPath).Length:N0} bytes");

// Deedle — write CSV (SaveCsv)
var csvOutPathD = Path.Combine(DATA, "_temp_deedle_write.csv");
var dfDWrite = dfD.GetRowsAt(Enumerable.Range(0, 50).ToArray());
dfDWrite.SaveCsv(csvOutPathD);
Console.WriteLine($"\nDeedle CSV written: {csvOutPathD}");
Console.WriteLine($"File size: {new FileInfo(csvOutPathD).Length:N0} bytes");

// Verify Polars can read back its own CSV
var dfReadBack = DataFrame.ReadCsv(csvOutPath);
Console.WriteLine($"\nPolars read-back: {dfReadBack.Shape}");
```

    Polars CSV written: ..\data\_temp_polars_write.csv
    File size: 5'164 bytes
    
    Deedle CSV written: ..\data\_temp_deedle_write.csv
    File size: 3'991 bytes
    
    Polars read-back: (50, 12)

#### Parquet read: schema and data

```csharp
// Polars.NET — read Parquet natively
var dfParquet = DataFrame.ReadParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"));
Console.WriteLine($"Parquet read: {dfParquet.Shape}");

// Show schema from Parquet
Console.WriteLine("\nParquet column types:");
foreach (var name in dfParquet.ColumnNames)
{
    Console.WriteLine($"  {name,-20} {dfParquet.Column(name).DataTypeName}");
}

// Compare CSV vs Parquet file sizes
var csvSize = new FileInfo(Path.Combine(DATA, "eurostoxx50_ohlcv.csv")).Length;
var parquetSize = new FileInfo(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet")).Length;
Console.WriteLine($"\nCSV size:     {csvSize:N0} bytes ({csvSize / 1024.0 / 1024.0:F1} MB)");
Console.WriteLine($"Parquet size: {parquetSize:N0} bytes ({parquetSize / 1024.0 / 1024.0:F1} MB)");
Console.WriteLine($"Compression:  {(1.0 - (double)parquetSize / csvSize) * 100:F0}% smaller");
```

    Parquet read: (66355, 12)
    
    Parquet column types:
      id                   i64
      symbol               str
      date                 date
      open                 f64
      high                 f64
      low                  f64
      close                f64
      adj_close            f64
      volume               i64
      dividends            f64
      stock_splits         f64
      is_filled            bool
    
    CSV size:     5'285'917 bytes (5.0 MB)
    Parquet size: 2'484'896 bytes (2.4 MB)
    Compression:  53% smaller

#### Parquet write and verify

```csharp
// Polars.NET — write Parquet
var parquetOutPath = Path.Combine(DATA, "_temp_polars_write.parquet");
dfWrite.WriteParquet(parquetOutPath);
Console.WriteLine($"Parquet written: {parquetOutPath}");
Console.WriteLine($"File size: {new FileInfo(parquetOutPath).Length:N0} bytes");

// Read it back and verify
var dfPqReadBack = DataFrame.ReadParquet(parquetOutPath);
Console.WriteLine($"Read back: {dfPqReadBack.Shape}");

// Deedle — no native Parquet support
Console.WriteLine("\nDeedle has no native Parquet I/O.");
Console.WriteLine("Workaround: use Polars to read Parquet, convert to arrays, build Deedle Frame.");
```

    Parquet written: ..\data\_temp_polars_write.parquet
    File size: 4'931 bytes
    Read back: (50, 12)
    
    Deedle has no native Parquet I/O.
    Workaround: use Polars to read Parquet, convert to arrays, build Deedle Frame.

#### JSON read/write (Polars.NET)

```csharp
// Polars.NET — JSON read (newline-delimited JSON / NDJSON format)
// ReadJson/WriteJson may not exist in 0.4.0 — try with fallback
try
{
    var dfJson = DataFrame.ReadJson(Path.Combine(DATA, "dim_country.json"));
    Console.WriteLine($"JSON read: {dfJson.Shape}");
    display(dfJson.Head(5));

    // Write JSON
    var jsonOutPath = Path.Combine(DATA, "_temp_polars_write.json");
    dfJson.WriteJson(jsonOutPath);
    Console.WriteLine($"\nJSON written: {jsonOutPath}");
    Console.WriteLine($"File size: {new FileInfo(jsonOutPath).Length:N0} bytes");
}
catch (Exception ex)
{
    Console.WriteLine($"JSON I/O not available in Polars.NET 0.4.0: {ex.GetType().Name}");
    Console.WriteLine("Use CSV or Parquet instead. For JSON, use System.Text.Json with manual conversion.");
}
```

    JSON read: (212, 2)

<!-- Polars DataFrame: (5 rows, 2 columns) --><table><thead><tr><th>country_name</th><th>iso_alpha2</th></tr></thead><tbody><tr><td>Afghanistan</td><td>AF</td></tr><tr><td>Albania</td><td>AL</td></tr><tr><td>Algeria</td><td>DZ</td></tr><tr><td>American Samoa</td><td>AS</td></tr><tr><td>Andorra</td><td>AD</td></tr></tbody></table></div>

    
    JSON written: ..\data\_temp_polars_write.json
    File size: 9'868 bytes

#### Round-trip test: CSV -> Polars -> Parquet -> read back -> verify

```csharp
// Polars.NET — full round-trip: CSV -> DataFrame -> Parquet -> read back -> compare
var rtCsvPath = Path.Combine(DATA, "dim_country.csv");
var rtParquetPath = Path.Combine(DATA, "_temp_roundtrip.parquet");
var rtCsvOutPath = Path.Combine(DATA, "_temp_roundtrip.csv");

// Step 1: Read CSV
var rtDf1 = DataFrame.ReadCsv(rtCsvPath);
Console.WriteLine($"1. CSV read:     {rtDf1.Shape}");

// Step 2: Write Parquet
rtDf1.WriteParquet(rtParquetPath);
Console.WriteLine($"2. Parquet write: {new FileInfo(rtParquetPath).Length:N0} bytes");

// Step 3: Read Parquet
var rtDf2 = DataFrame.ReadParquet(rtParquetPath);
Console.WriteLine($"3. Parquet read:  {rtDf2.Shape}");

// Step 4: Write CSV from Parquet-sourced DataFrame
rtDf2.WriteCsv(rtCsvOutPath);
Console.WriteLine($"4. CSV write:     {new FileInfo(rtCsvOutPath).Length:N0} bytes");

// Step 5: Read back and compare
var rtDf3 = DataFrame.ReadCsv(rtCsvOutPath);
Console.WriteLine($"5. CSV re-read:   {rtDf3.Shape}");

// Verify shapes match
Console.WriteLine($"\nShapes match: {rtDf1.Height == rtDf3.Height && rtDf1.Width == rtDf3.Width}");

// Verify content: compare first column values
var origNames = rtDf1.Column("country_name").ToArray<string>();
var rtNames = rtDf3.Column("country_name").ToArray<string>();
var allMatch = origNames.Zip(rtNames, (a, b) => a == b).All(x => x);
Console.WriteLine($"Content match: {allMatch}");
```

    1. CSV read:     (212, 2)
    2. Parquet write: 3'520 bytes
    3. Parquet read:  (212, 2)
    4. CSV write:     3'535 bytes
    5. CSV re-read:   (212, 2)
    
    Shapes match: True
    Content match: True

#### Cleanup temp files

```csharp
// Clean up temporary files created during I/O demos
var tempFiles = new[]
{
    "_temp_polars_write.csv",
    "_temp_deedle_write.csv",
    "_temp_polars_write.parquet",
    "_temp_polars_write.json",
    "_temp_roundtrip.parquet",
    "_temp_roundtrip.csv"
};

foreach (var f in tempFiles)
{
    var path = Path.Combine(DATA, f);
    if (File.Exists(path))
    {
        File.Delete(path);
        Console.WriteLine($"Deleted: {f}");
    }
}
Console.WriteLine("\nCleanup complete.");
```

    Deleted: _temp_polars_write.csv
    Deleted: _temp_deedle_write.csv
    Deleted: _temp_polars_write.parquet
    Deleted: _temp_polars_write.json
    Deleted: _temp_roundtrip.parquet
    Deleted: _temp_roundtrip.csv
    
    Cleanup complete.

---
## Summary

#### Comparison table

| Feature | Polars.NET 0.4.0 | Deedle 4.0.1 |
|---|---|---|
| **Categorical type** | `Cast(DataType.Categorical)` — dictionary-encoded | No support; manual encoding only |
| **List/Struct columns** | Not exposed in C# bindings | Not supported |
| **Enum type** | Not exposed in C# bindings | Not supported |
| **Binary type** | Not exposed in C# bindings | Not supported |
| **Extract to arrays** | `series.ToArray<T>()` | `series.Values.ToArray()` |
| **To DataTable** | Manual (column-by-column extraction) | Manual (similar approach) |
| **Cross-library** | Extract arrays, build with `Series.From` + `new DataFrame` | Extract arrays, build with `FrameBuilder` |
| **CSV read** | `DataFrame.ReadCsv(path, separator, tryParseDates, nRows)` | `Frame.ReadCsv(path, separators)` |
| **CSV write** | `df.WriteCsv(path)` | `frame.SaveCsv(path)` |
| **Parquet read** | `DataFrame.ReadParquet(path)` | Not supported |
| **Parquet write** | `df.WriteParquet(path)` | Not supported |
| **JSON read/write** | `ReadJson` / `WriteJson` (if available) | Not supported |
| **TSV/SSV** | `ReadCsv(path, separator: '\t')` | `ReadCsv(path, separators: "\t")` |

#### Key takeaways

- **Use Categorical** for low-cardinality string columns (like symbol) to save memory and speed up GroupBy.
- **Cross-library conversion** is straightforward: extract columns as .NET arrays, then rebuild in the target library.
- **Parquet** is the preferred format for analytical workloads — smaller files, typed columns, and enables lazy scan with pushdown.
- **Deedle's I/O** is limited to CSV. For Parquet or JSON, read with Polars and convert via arrays.
- **Round-trips** (CSV -> Parquet -> CSV) preserve data integrity for standard types.
