---
type: reference
category: db-queries
technology: [firestore, csharp, dotnet, gcp]
tags: [csharp, sql, gcp, firestore]
aliases: [Firestore C#, Firestore queries C#, NoSQL C#, document database C#]
keywords: [firestore, csharp, dotnet, Google.Cloud.Firestore, DocumentReference, CollectionReference, query, where, order, limit, batch, transaction, snapshot, WriteBatch, FieldValue]
description: "Firestore operations in C# with executable examples and cell outputs — covers CRUD, queries, transactions, batches, snapshots, and typed document mapping."
related:
  - "[[firestore-python]]"
  - "[[firestore-data-model-and-operations]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Firestore for Data Engineering — C#

Comprehensive reference for querying, writing, and managing Firestore collections
using the `Google.Cloud.Firestore` C# SDK and REST API.

#### Firestore collections — stocks, prices, scores, index_performance

| Collection | Description | Key Features |
|---|---|---|
| `stocks` | 50 Euro Stoxx constituents | Nested maps, arrays, booleans |
| `stocks/*/prices` | 30-day OHLCV per symbol | Subcollections |
| `sectors` | Aggregated sector scores | Arrays of symbols |
| `alerts` | Pipeline alerts | Mixed severities, timestamps |
| `pipeline_runs` | Audit log | Array of maps (steps) |
| `watchlists` | User watchlists | Ownership, public/private |
| `config` | App configuration | Singleton documents |

## Topics Covered
1. Setup & Connection
2. Read Operations
3. Filtering & Ordering
4. Nested Fields & Arrays
5. Subcollections
6. Write Operations
7. Batch Operations & Transactions
8. Real-Time Listeners
9. Aggregation Queries
10. Collection Group Queries
11. Pagination & Cursors
12. Maintenance & Monitoring

```C#
// Suppress CS1701 assembly version warnings (.NET 10 + NuGet packages)
using System.Reflection;
using Microsoft.DotNet.Interactive;
using Microsoft.DotNet.Interactive.CSharp;

var csharpKernel = (CSharpKernel)Kernel.Root.FindKernelByName("csharp");
var optionsField = typeof(CSharpKernel).GetField("_scriptOptions",
    BindingFlags.NonPublic | BindingFlags.Instance);
if (optionsField != null)
{
    dynamic opts = optionsField.GetValue(csharpKernel);
    optionsField.SetValue(csharpKernel, opts.WithWarningLevel(0));
}
Console.WriteLine("Warnings suppressed");
```

    Warnings suppressed
    

## Setup & Connection

This cell:

1. Loads `Google.Cloud.Firestore` and `Microsoft.Bcl.AsyncInterfaces` NuGet packages
2. Sets `GOOGLE_APPLICATION_CREDENTIALS` to the service account key
3. Creates a `FirestoreDb` client and an HTTP client with OAuth2 token for REST API calls
4. Defines a `RestQuery()` helper that sends structured queries to the Firestore REST API

**Note**: On .NET 10, SDK reads fail due to a missing assembly. Writes work fine.
For reads, we use the Firestore REST API as a workaround.

```C#
#r "nuget: Google.Cloud.Firestore"
#r "nuget: Microsoft.Bcl.AsyncInterfaces"

using Google.Cloud.Firestore;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

// ── Credentials ──
// Same GOOGLE_APPLICATION_CREDENTIALS env var as Python.
// Points to the service account JSON key file.
Environment.SetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS",
    @"C:\Users\aperi\DEV\LANG\gcp-bq-key.json");

// ── SDK client ──
// Used for writes + single-document reads (these work on .NET 10).
// Collection-level reads fail due to a missing AsyncInterfaces assembly.
var db = FirestoreDb.Create("bq-wh-nb");

// ── REST client ──
// Used for collection reads, filtered queries, and collection group queries.
// This is the .NET 10 workaround — in .NET 8/9, the SDK handles everything.
var credential = Google.Apis.Auth.OAuth2.GoogleCredential.GetApplicationDefault()
    .CreateScoped("https://www.googleapis.com/auth/datastore");
var token = await credential.UnderlyingCredential.GetAccessTokenForRequestAsync();
var http = new HttpClient();
http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

// Base URL for all Firestore REST API calls
var baseUrl = "https://firestore.googleapis.com/v1/projects/bq-wh-nb/databases/(default)/documents";

Console.WriteLine("Connected to Firestore (SDK + REST).");
```

> Installed Packages: Google.Cloud.Firestore, 4.2.0, Microsoft.Bcl.AsyncInterfaces, 10.0.5

    Connected to Firestore (SDK + REST).
    

### REST Query Helper — `RestQuery()`

Firestore REST API uses **structured queries** — a JSON body describing the filter,
ordering, and limit. This helper sends the query and returns a list of parsed document elements.

This cell:

1. Defines `RestQuery(queryJson)` — sends a POST to `{baseUrl}:runQuery`
2. Parses the JSON response array
3. Extracts only items that have a `document` property (skips empty results)
4. Returns a `List<JsonElement>` of Firestore documents

Used by all filter/query cells below.

```C#
// ── RestQuery: send a structured query and return parsed documents ──
// Input:  JSON string with a "structuredQuery" object
// Output: List of JsonElement, each representing one Firestore document
//         Each document has "name" (full path) and "fields" (the data)

async Task<List<JsonElement>> RestQuery(string queryJson)
{
    // Send the structured query to Firestore REST API
    var resp = await http.PostAsync(
        $"{baseUrl}:runQuery",
        new StringContent(queryJson, Encoding.UTF8, "application/json"));

    // Parse the response — it is a JSON array of results
    var body = await resp.Content.ReadAsStringAsync();
    var results = JsonDocument.Parse(body).RootElement;

    // Extract only items that contain a "document" (some may be empty/metadata)
    var docs = new List<JsonElement>();
    foreach (var item in results.EnumerateArray())
        if (item.TryGetProperty("document", out var doc))
            docs.Add(doc);
    return docs;
}

Console.WriteLine("RestQuery() helper loaded.");
```

    RestQuery() helper loaded.
    

### Field Extraction Helpers

Firestore REST API wraps every field value in a type envelope:

```json
{ "current_price": { "doubleValue": 178.50 } }
{ "symbol": { "stringValue": "ASML.AS" } }
{ "is_active": { "booleanValue": true } }
{ "volume": { "integerValue": "1500000" } }
```

These helpers unwrap the type envelope and return the native C# value.
Without them, every field access would need 2 levels of `TryGetProperty()`.

```C#
// ── GetStr: extract a string field ──
// Firestore REST: { "fieldName": { "stringValue": "..." } }
string GetStr(JsonElement fields, string key) =>
    fields.TryGetProperty(key, out var v) && v.TryGetProperty("stringValue", out var s)
        ? s.GetString() ?? "" : "";

// ── GetDbl: extract a double field ──
// Firestore REST: { "fieldName": { "doubleValue": 178.50 } }
double GetDbl(JsonElement fields, string key) =>
    fields.TryGetProperty(key, out var v) && v.TryGetProperty("doubleValue", out var d)
        ? d.GetDouble() : 0;

// ── GetBool: extract a boolean field ──
// Firestore REST: { "fieldName": { "booleanValue": true } }
bool GetBool(JsonElement fields, string key) =>
    fields.TryGetProperty(key, out var v) && v.TryGetProperty("booleanValue", out var b)
        && b.GetBoolean();

// ── GetInt: extract an integer field ──
// Firestore REST returns integers as strings: { "fieldName": { "integerValue": "1500000" } }
long GetInt(JsonElement fields, string key) =>
    fields.TryGetProperty(key, out var v) && v.TryGetProperty("integerValue", out var i)
        ? long.Parse(i.GetString() ?? "0") : 0;

Console.WriteLine("Field extraction helpers loaded: GetStr, GetDbl, GetBool, GetInt");
```

    Field extraction helpers loaded: GetStr, GetDbl, GetBool, GetInt
    

### Index Utility — `EnsureIndex()`

Firestore requires **explicit indexes** for:
- **Compound queries**: filtering on two fields (e.g., `country == "Germany"` AND `price < 200`)
- **Collection group queries**: querying across all subcollections with the same name

Single-field queries on a single collection work out of the box (auto-indexed).

This utility:
1. Calls the Firestore Admin REST API to create a composite index
2. Polls until the index state is `READY`
3. For single-field collection group indexes, creates a **field exemption** via PATCH
4. Is **idempotent** — safe to call multiple times

Called automatically before queries that need an index.

```C#
// ═══════════════════════════════════════════════════════════════
// Firestore Index Utility
// ═══════════════════════════════════════════════════════════════

var adminBaseUrl = "https://firestore.googleapis.com/v1/projects/bq-wh-nb/databases/(default)";

/// Create a composite index and wait until READY.
/// For single-field COLLECTION_GROUP, creates a field exemption instead.
async Task EnsureIndex(string collection, (string fieldPath, string order)[] fields,
    string scope = "COLLECTION")
{
    var fieldNames = string.Join(" + ", fields.Select(f => f.fieldPath));

    // ── Case 1: single-field collection group → field exemption ──
    if (scope == "COLLECTION_GROUP" && fields.Length == 1)
    {
        await EnsureFieldExemption(collection, fields[0].fieldPath, fields[0].order);
        return;
    }

    // ── Case 2: composite index via Admin API ──
    var parent = $"{adminBaseUrl}/collectionGroups/{collection}";
    var fieldsArr = fields.Select(f => "{" + $"\"fieldPath\": \"{f.fieldPath}\", \"order\": \"{f.order}\"" + "}");
    var body = "{\"queryScope\": \"" + scope + "\", \"fields\": [" + string.Join(",", fieldsArr) + "]}";

    var resp = await http.PostAsync($"{parent}/indexes",
        new StringContent(body, Encoding.UTF8, "application/json"));
    var respText = await resp.Content.ReadAsStringAsync();

    if (resp.IsSuccessStatusCode)
    {
        Console.Write($"  Building index: {collection}/{fieldNames}...");
    }
    else if (respText.Contains("already exists"))
    {
        Console.Write($"  Index exists: {collection}/{fieldNames}...");
    }
    else
    {
        Console.WriteLine($"  Index error: {respText[..Math.Min(150, respText.Length)]}");
        return;
    }

    // Poll until no indexes are CREATING
    for (int attempt = 0; attempt < 30; attempt++)
    {
        await Task.Delay(5000);
        Console.Write(".");
        var listResp = await http.GetAsync($"{parent}/indexes");
        var listText = await listResp.Content.ReadAsStringAsync();
        if (!listText.Contains("CREATING"))
        {
            Console.WriteLine(" ready!");
            return;
        }
    }
    Console.WriteLine(" timeout");
}

/// Create a single-field collection group exemption via REST API.
async Task EnsureFieldExemption(string collection, string fieldPath, string order)
{
    var url = $"{adminBaseUrl}/collectionGroups/{collection}/fields/{fieldPath}";

    // ── Check if exemption already exists ──
    var getResp = await http.GetAsync(url);
    var getText = await getResp.Content.ReadAsStringAsync();
    if (getText.Contains("COLLECTION_GROUP"))
    {
        if (getText.Contains("CREATING"))
        {
            Console.Write($"  Field exemption building: {collection}/{fieldPath}...");
            for (int i = 0; i < 30; i++)
            {
                await Task.Delay(5000);
                Console.Write(".");
                var check = await (await http.GetAsync(url)).Content.ReadAsStringAsync();
                if (!check.Contains("CREATING")) { Console.WriteLine(" ready!"); return; }
            }
            Console.WriteLine(" timeout");
        }
        else
        {
            Console.WriteLine($"  Field exemption ready: {collection}/{fieldPath}");
        }
        return;
    }

    // ── Preserve existing COLLECTION indexes ──
    var existing = new List<string>();
    if (getResp.IsSuccessStatusCode)
    {
        var doc = JsonDocument.Parse(getText);
        if (doc.RootElement.TryGetProperty("indexConfig", out var ic)
            && ic.TryGetProperty("indexes", out var idxArr))
        {
            foreach (var idx in idxArr.EnumerateArray())
            {
                if (idx.TryGetProperty("queryScope", out var qs) && qs.GetString() == "COLLECTION")
                {
                    existing.Add(idx.GetRawText());
                }
            }
        }
    }

    // ── Build PATCH body: keep COLLECTION + add COLLECTION_GROUP ──
    var cgAsc = $"{{\"queryScope\": \"COLLECTION_GROUP\", \"fields\": [{{\"fieldPath\": \"{fieldPath}\", \"order\": \"ASCENDING\"}}]}}";
    var cgDesc = $"{{\"queryScope\": \"COLLECTION_GROUP\", \"fields\": [{{\"fieldPath\": \"{fieldPath}\", \"order\": \"DESCENDING\"}}]}}";
    var allIndexes = string.Join(",", existing.Concat(new[] { cgAsc, cgDesc }));
    var patchBody = $"{{\"indexConfig\": {{\"indexes\": [{allIndexes}]}}}}";

    Console.Write($"  Creating field exemption: {collection}/{fieldPath}...");
    var req = new HttpRequestMessage(HttpMethod.Patch, url)
    {
        Content = new StringContent(patchBody, Encoding.UTF8, "application/json")
    };
    var patchResp = await http.SendAsync(req);
    if (!patchResp.IsSuccessStatusCode)
    {
        var err = await patchResp.Content.ReadAsStringAsync();
        Console.WriteLine($" error: {err[..Math.Min(150, err.Length)]}");
        return;
    }

    // ── Poll until READY ──
    for (int i = 0; i < 30; i++)
    {
        await Task.Delay(5000);
        Console.Write(".");
        var check = await (await http.GetAsync(url)).Content.ReadAsStringAsync();
        if (check.Contains("COLLECTION_GROUP") && !check.Contains("CREATING"))
        {
            Console.WriteLine(" ready!");
            return;
        }
    }
    Console.WriteLine(" timeout");
}

Console.WriteLine("EnsureIndex() utility loaded.");
```

    EnsureIndex() utility loaded.
    

### Verify Connection — List Collections

This cell:

1. Calls the REST API for each known collection with `pageSize=1000`
2. Counts documents in the response
3. Prints a summary table

Run this after setup to confirm the connection works and data is populated.

```C#
// Verify connection: list all collections and document counts
Console.WriteLine("=== Firestore Collections ===");
foreach (var coll in new[] { "stocks", "sectors", "alerts", "pipeline_runs", "watchlists", "config" })
{
    var r = await http.GetAsync($"{baseUrl}/{coll}?pageSize=1000");
    var j = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
    var count = j.RootElement.TryGetProperty("documents", out var d) ? d.GetArrayLength() : 0;
    Console.WriteLine($"  {coll,-20} {count,5} documents");
}
```

    === Firestore Collections ===
      stocks                  50 documents
      sectors                 10 documents
      alerts                  20 documents
      pipeline_runs           15 documents
      watchlists               3 documents
      config                   2 documents
    

## Read Operations

### Get a Single Document by ID

This cell:

1. Fetches `stocks/ASML.AS` via SDK `GetSnapshotAsync()`
2. Extracts flat fields: `short_name` (string), `current_price` (double), `is_active` (bool)
3. Extracts nested map: `scores` with `composite`, `momentum`, `rank`
4. Extracts array: `tags`

```C#
// Get a single document by ID (SDK — single-doc reads work on .NET 10)
var doc = await db.Collection("stocks").Document("ASML.AS").GetSnapshotAsync();

if (doc.Exists)
{
    Console.WriteLine($"Document: {doc.Id}");
    Console.WriteLine($"  Short name: {doc.GetValue<string>("short_name")}");
    Console.WriteLine($"  Sector:     {doc.GetValue<string>("sector")}");
    Console.WriteLine($"  Price:      {doc.GetValue<double>("current_price")}");
    Console.WriteLine($"  Active:     {doc.GetValue<bool>("is_active")}");

    var scores = doc.GetValue<Dictionary<string, object>>("scores");
    Console.WriteLine($"  Scores:     composite={scores["composite"]}, rank={scores["rank"]}");

    var tags = doc.GetValue<List<object>>("tags");
    Console.WriteLine($"  Tags:       [{string.Join(", ", tags)}]");
}
```

    Document: ASML.AS
      Short name: ASML HOLDING
      Sector:     Technology
      Price:      1191.2
      Active:     True
      Scores:     composite=0.17610432350282, rank=19
      Tags:       [technology, netherlands, euro_stoxx_50]
    

### List Documents (Top 10)

This cell:

1. Calls REST API `GET .../documents/stocks?pageSize=10`
2. Parses JSON response, extracts symbol, short_name, price from each document
3. Prints a formatted table

```C#
// SDK equivalent (.NET 8/9):
//   var snapshot = await db.Collection("stocks").Limit(10).GetSnapshotAsync();
//   foreach (var doc in snapshot.Documents) { ... }

// List first 10 stocks via REST
var listResp = await http.GetAsync($"{baseUrl}/stocks?pageSize=10");
var listJson = JsonDocument.Parse(await listResp.Content.ReadAsStringAsync());

Console.WriteLine("=== Stocks (top 10) ===");
if (listJson.RootElement.TryGetProperty("documents", out var docs))
{
    foreach (var fdoc in docs.EnumerateArray())
    {
        var name = fdoc.GetProperty("name").GetString().Split("/")[^1];
        var fields = fdoc.GetProperty("fields");
        Console.WriteLine($"  {name,-12} {GetStr(fields, "short_name"),-20} price={GetDbl(fields, "current_price"),8:F2}");
    }
}
```

    === Stocks (top 10) ===
      ABI.BR       AB INBEV             price=   62.76
      AD.AS        KONINKLIJKE AHOLD DELHAIZE N.V. price=   41.04
      ADS.DE       adidas AG            price=  140.10
      ADYEN.AS     ADYEN                price=  923.10
      AI.PA        AIR LIQUIDE          price=  168.02
      AIR.PA       AIRBUS SE            price=  176.02
      ALV.DE       Allianz SE           price=  348.80
      ARGX.BR      ARGENX SE            price=  626.60
      ASML.AS      ASML HOLDING         price= 1191.20
      BAS.DE       BASF SE              price=   47.74
    

### Get Multiple Documents by ID

This cell:

1. Fetches 3 specific stocks (ASML, MC, SAP) in separate SDK calls
2. Prints name and price for each

**Note**: Unlike Python's `db.get_all()` (one round-trip), the C# SDK
requires individual `GetSnapshotAsync()` calls. In production, use
`db.GetAllSnapshotsAsync()` on .NET 8/9.

```C#
// Get multiple documents by ID
Console.WriteLine("=== Multiple Documents ===");
foreach (var sym in new[] { "ASML.AS", "MC.PA", "SAP.DE" })
{
    var d = await db.Collection("stocks").Document(sym).GetSnapshotAsync();
    if (d.Exists)
        Console.WriteLine($"  {d.Id}: {d.GetValue<string>("short_name")} — {d.GetValue<double>("current_price"):F2}");
}
```

    === Multiple Documents ===
      ASML.AS: ASML HOLDING — 1191.20
      MC.PA: LVMH — 494.40
      SAP.DE: SAP SE — 153.82
    

## Filtering & Ordering

### Equality Filter

This cell:

1. Sends a structured query to the REST API filtering `country == "Germany"`
2. Returns only German stocks with their sector

```C#
// SDK equivalent (.NET 8/9):
//   var docs = await db.Collection("stocks")
//       .WhereEqualTo("country", "Germany")
//       .Limit(15)
//       .GetSnapshotAsync();

// Equality filter: country == "Germany"
var germanQuery = @"{
    ""structuredQuery"": {
        ""from"": [{""collectionId"": ""stocks""}],
        ""where"": {
            ""fieldFilter"": {
                ""field"": {""fieldPath"": ""country""},
                ""op"": ""EQUAL"",
                ""value"": {""stringValue"": ""Germany""}
            }
        },
        ""limit"": 15
    }
}";

Console.WriteLine("=== German Stocks ===");
foreach (var fdoc in await RestQuery(germanQuery))
{
    var fields = fdoc.GetProperty("fields");
    Console.WriteLine($"  {fdoc.GetProperty("name").GetString().Split("/")[^1],-12} {GetStr(fields, "sector")}");
}
```

    === German Stocks ===
      ADS.DE       Consumer Cyclical
      ALV.DE       Financial Services
      BAS.DE       Basic Materials
      BAYN.DE      Healthcare
      BMW.DE       Consumer Cyclical
      DB1.DE       Financial Services
      DHL.DE       Industrials
      DTE.DE       Communication Services
      ENR.DE       Industrials
      IFX.DE       Technology
      MBG.DE       Consumer Cyclical
      MUV2.DE      Financial Services
      RHM.DE       Industrials
      SAP.DE       Technology
      SIE.DE       Industrials
    

### Range Filter

This cell:

1. Filters stocks where `current_price > 500`
2. Orders by `current_price` descending

```C#
// SDK equivalent (.NET 8/9):
//   var docs = await db.Collection("stocks")
//       .WhereGreaterThan("current_price", 500)
//       .OrderByDescending("current_price")
//       .Limit(10)
//       .GetSnapshotAsync();

// Range filter: price > 500, ordered descending
var rangeQuery = @"{
    ""structuredQuery"": {
        ""from"": [{""collectionId"": ""stocks""}],
        ""where"": {
            ""fieldFilter"": {
                ""field"": {""fieldPath"": ""current_price""},
                ""op"": ""GREATER_THAN"",
                ""value"": {""doubleValue"": 500}
            }
        },
        ""orderBy"": [{""field"": {""fieldPath"": ""current_price""}, ""direction"": ""DESCENDING""}],
        ""limit"": 10
    }
}";

Console.WriteLine("=== High-Price Stocks (>500) ===");
foreach (var fdoc in await RestQuery(rangeQuery))
{
    var fields = fdoc.GetProperty("fields");
    Console.WriteLine($"  {fdoc.GetProperty("name").GetString().Split("/")[^1],-12} price={GetDbl(fields, "current_price"):F2}");
}
```

    === High-Price Stocks (>500) ===
      RMS.PA       price=1906.00
      RHM.DE       price=1552.00
      ASML.AS      price=1191.20
      ADYEN.AS     price=923.10
      ARGX.BR      price=626.60
      MUV2.DE      price=526.20
    

### Compound Filter (AND)

This cell:

1. Filters `country == "France"` AND `current_price < 200`
2. Uses `compositeFilter` with `AND` operator
3. Requires a composite index (same as Python)

```C#
// SDK equivalent (.NET 8/9):
//   var docs = await db.Collection("stocks")
//       .WhereEqualTo("country", "France")
//       .WhereLessThan("current_price", 200)
//       .Limit(10)
//       .GetSnapshotAsync();

// Compound query needs a composite index
await EnsureIndex("stocks", new[] {
    ("country", "ASCENDING"),
    ("current_price", "ASCENDING"),
});

// Compound filter: country == "France" AND price < 200
var compoundQuery = @"{
    ""structuredQuery"": {
        ""from"": [{""collectionId"": ""stocks""}],
        ""where"": {
            ""compositeFilter"": {
                ""op"": ""AND"",
                ""filters"": [
                    {""fieldFilter"": {""field"": {""fieldPath"": ""country""}, ""op"": ""EQUAL"", ""value"": {""stringValue"": ""France""}}},
                    {""fieldFilter"": {""field"": {""fieldPath"": ""current_price""}, ""op"": ""LESS_THAN"", ""value"": {""doubleValue"": 200}}}
                ]
            }
        },
        ""limit"": 10
    }
}";

Console.WriteLine("=== French Stocks Under 200 ===");
foreach (var fdoc in await RestQuery(compoundQuery))
{
    var fields = fdoc.GetProperty("fields");
    Console.WriteLine($"  {fdoc.GetProperty("name").GetString().Split("/")[^1],-12} {GetStr(fields, "short_name"),-20} price={GetDbl(fields, "current_price"):F2}");
}
```

      Index exists: stocks/country + current_price.... ready!
    === French Stocks Under 200 ===
      DSY.PA       DASSAULT SYSTEMES    price=18.37
      CS.PA        AXA                  price=37.96
      BN.PA        DANONE               price=69.24
      TTE.PA       TOTALENERGIES        price=69.80
      SGO.PA       SAINT GOBAIN         price=73.22
      SAN.PA       SANOFI               price=76.26
      BNP.PA       BNP PARIBAS ACT.A    price=87.44
      DG.PA        VINCI                price=129.90
      AI.PA        AIR LIQUIDE          price=168.02
    

### Array Contains

This cell:

1. Filters stocks where the `tags` array contains `"germany"`
2. Uses `ARRAY_CONTAINS` operator in the REST API

```C#
// SDK equivalent (.NET 8/9):
//   var docs = await db.Collection("stocks")
//       .WhereArrayContains("tags", "germany")
//       .Limit(15)
//       .GetSnapshotAsync();

// Array contains: stocks tagged with "germany"
var arrayQuery = @"{
    ""structuredQuery"": {
        ""from"": [{""collectionId"": ""stocks""}],
        ""where"": {
            ""fieldFilter"": {
                ""field"": {""fieldPath"": ""tags""},
                ""op"": ""ARRAY_CONTAINS"",
                ""value"": {""stringValue"": ""germany""}
            }
        },
        ""limit"": 15
    }
}";

Console.WriteLine("=== Stocks tagged germany ===");
foreach (var fdoc in await RestQuery(arrayQuery))
{
    var fields = fdoc.GetProperty("fields");
    Console.WriteLine($"  {fdoc.GetProperty("name").GetString().Split("/")[^1],-12} {GetStr(fields, "country")}");
}
```

    === Stocks tagged germany ===
      ADS.DE       Germany
      ALV.DE       Germany
      BAS.DE       Germany
      BAYN.DE      Germany
      BMW.DE       Germany
      DB1.DE       Germany
      DHL.DE       Germany
      DTE.DE       Germany
      ENR.DE       Germany
      IFX.DE       Germany
      MBG.DE       Germany
      MUV2.DE      Germany
      RHM.DE       Germany
      SAP.DE       Germany
      SIE.DE       Germany
    

### ii. array_contains_any

This cell:

1. Filters stocks where `tags` contains **any** of `["france", "netherlands"]`
2. Uses `ARRAY_CONTAINS_ANY` operator
3. Returns French OR Dutch stocks

```C#
// SDK equivalent (.NET 8/9):
//   var docs = await db.Collection("stocks")
//       .WhereArrayContainsAny("tags", new[] { "france", "netherlands" })
//       .Limit(15)
//       .GetSnapshotAsync();

// Array contains any: French OR Dutch stocks
var acaQuery = @"{
    ""structuredQuery"": {
        ""from"": [{""collectionId"": ""stocks""}],
        ""where"": {
            ""fieldFilter"": {
                ""field"": {""fieldPath"": ""tags""},
                ""op"": ""ARRAY_CONTAINS_ANY"",
                ""value"": {""arrayValue"": {""values"": [{""stringValue"": ""france""}, {""stringValue"": ""netherlands""}]}}
            }
        },
        ""limit"": 15
    }
}";

Console.WriteLine("=== French or Dutch stocks ===");
foreach (var fdoc in await RestQuery(acaQuery))
{
    var fields = fdoc.GetProperty("fields");
    Console.WriteLine($"  {fdoc.GetProperty("name").GetString().Split("/")[^1],-12} {GetStr(fields, "country")}");
}
```

    === French or Dutch stocks ===
      AD.AS        Netherlands
      ADYEN.AS     Netherlands
      AI.PA        France
      AIR.PA       Netherlands
      ARGX.BR      Netherlands
      ASML.AS      Netherlands
      BN.PA        France
      BNP.PA       France
      CS.PA        France
      DG.PA        France
      DSY.PA       France
      EL.PA        France
      INGA.AS      Netherlands
      MC.PA        France
      OR.PA        France
    

### Order By Nested Field + Limit

This cell:

1. Orders stocks by `scores.composite` descending (nested field, dot notation)
2. Takes top 5

```C#
// SDK equivalent (.NET 8/9):
//   var docs = await db.Collection("stocks")
//       .OrderByDescending("scores.composite")
//       .Limit(5)
//       .GetSnapshotAsync();

// Order by nested field: scores.composite DESC, limit 5
var topQuery = @"{
    ""structuredQuery"": {
        ""from"": [{""collectionId"": ""stocks""}],
        ""orderBy"": [{""field"": {""fieldPath"": ""scores.composite""}, ""direction"": ""DESCENDING""}],
        ""limit"": 5
    }
}";

Console.WriteLine("=== Top 5 by Composite Score ===");
foreach (var fdoc in await RestQuery(topQuery))
{
    var name = fdoc.GetProperty("name").GetString().Split("/")[^1];
    var fields = fdoc.GetProperty("fields");
    var scoresMap = fields.GetProperty("scores").GetProperty("mapValue").GetProperty("fields");
    var composite = scoresMap.TryGetProperty("composite", out var cv)
        ? cv.GetProperty("doubleValue").GetDouble() : 0;
    var rank = scoresMap.TryGetProperty("rank", out var rv)
        ? rv.GetProperty("integerValue").GetString() : "?";
    Console.WriteLine($"  #{rank,2} {name,-12} score={composite:F4}");
}
```

    === Top 5 by Composite Score ===
      # 1 BNP.PA       score=0.6796
      # 2 VOW.DE       score=0.5756
      # 3 DTE.DE       score=0.4870
      # 4 TTE.PA       score=0.3913
      # 5 ABI.BR       score=0.3852
    

## Nested Fields & Arrays

### Query Nested Map Fields

This cell:

1. Filters stocks where `scores.momentum > 0.05` (dot notation)
2. Orders by `scores.momentum` descending

```C#
// SDK equivalent (.NET 8/9):
//   var docs = await db.Collection("stocks")
//       .WhereGreaterThan("scores.momentum", 0.05)
//       .OrderByDescending("scores.momentum")
//       .Limit(10)
//       .GetSnapshotAsync();

// Filter on nested map: scores.momentum > 0.05
var momentumQuery = @"{
    ""structuredQuery"": {
        ""from"": [{""collectionId"": ""stocks""}],
        ""where"": {
            ""fieldFilter"": {
                ""field"": {""fieldPath"": ""scores.momentum""},
                ""op"": ""GREATER_THAN"",
                ""value"": {""doubleValue"": 0.05}
            }
        },
        ""orderBy"": [{""field"": {""fieldPath"": ""scores.momentum""}, ""direction"": ""DESCENDING""}],
        ""limit"": 10
    }
}";

Console.WriteLine("=== High Momentum Stocks ===");
foreach (var fdoc in await RestQuery(momentumQuery))
{
    var name = fdoc.GetProperty("name").GetString().Split("/")[^1];
    var fields = fdoc.GetProperty("fields");
    var scoresMap = fields.GetProperty("scores").GetProperty("mapValue").GetProperty("fields");
    var mom = scoresMap.TryGetProperty("momentum", out var mv) ? mv.GetProperty("doubleValue").GetDouble() : 0;
    Console.WriteLine($"  {name,-12} momentum={mom:F4}");
}
```

    === High Momentum Stocks ===
      ENR.DE       momentum=2.0402
      ENI.MI       momentum=1.9778
      ASML.AS      momentum=1.4701
      TTE.PA       momentum=1.3074
      AD.AS        momentum=1.1629
      IBE.MC       momentum=0.7534
      DTE.DE       momentum=0.7064
      BAYN.DE      momentum=0.6422
      ENEL.MI      momentum=0.6336
      SU.PA        momentum=0.5633
    

## Subcollections

### Read Price History Subcollection

This cell:

1. Reads `stocks/ASML.AS/prices` subcollection via REST
2. Orders by `date` descending, takes top 5
3. Prints OHLCV data for each day

```C#
// SDK equivalent (.NET 8/9):
//   var docs = await db.Collection("stocks").Document("ASML.AS")
//       .Collection("prices")
//       .OrderByDescending("date")
//       .Limit(5)
//       .GetSnapshotAsync();

// Read subcollection: stocks/ASML.AS/prices (last 5 days)
var priceQuery = @"{
    ""structuredQuery"": {
        ""from"": [{""collectionId"": ""prices""}],
        ""orderBy"": [{""field"": {""fieldPath"": ""date""}, ""direction"": ""DESCENDING""}],
        ""limit"": 5
    }
}";

var priceUrl = $"{baseUrl}/stocks/ASML.AS:runQuery";
var priceResp = await http.PostAsync(priceUrl,
    new StringContent(priceQuery, Encoding.UTF8, "application/json"));
var priceResults = JsonDocument.Parse(await priceResp.Content.ReadAsStringAsync());

Console.WriteLine("=== ASML.AS Price History (last 5 days) ===");
foreach (var item in priceResults.RootElement.EnumerateArray())
{
    if (!item.TryGetProperty("document", out var pdoc)) continue;
    var f = pdoc.GetProperty("fields");
    Console.WriteLine($"  {GetStr(f, "date")}  O={GetDbl(f, "open"),8:F2}  H={GetDbl(f, "high"),8:F2}  "
        + $"L={GetDbl(f, "low"),8:F2}  C={GetDbl(f, "close"),8:F2}  V={GetInt(f, "volume"),12:N0}");
}
```

    === ASML.AS Price History (last 5 days) ===
      2026-03-12  O= 1194.80  H= 1202.20  L= 1187.80  C= 1190.80  V=     128'223
      2026-03-11  O= 1188.40  H= 1210.80  L= 1174.00  C= 1198.80  V=     562'904
      2026-03-10  O= 1188.40  H= 1208.40  L= 1172.20  C= 1200.00  V=     800'815
      2026-03-09  O= 1072.00  H= 1147.60  L= 1060.20  C= 1147.60  V=     689'086
      2026-03-06  O= 1186.00  H= 1192.60  L= 1112.80  C= 1147.00  V=     857'271
    

### Query Within a Subcollection

This cell:

1. Queries `stocks/ASML.AS/prices` where `close > 700`
2. Orders by `close` descending
3. Only searches ASML's prices — not other stocks

```C#
// SDK equivalent (.NET 8/9):
//   var docs = await db.Collection("stocks").Document("ASML.AS")
//       .Collection("prices")
//       .WhereGreaterThan("close", 700)
//       .OrderByDescending("close")
//       .Limit(10)
//       .GetSnapshotAsync();

// Query subcollection: ASML days above 700
var subQuery = @"{
    ""structuredQuery"": {
        ""from"": [{""collectionId"": ""prices""}],
        ""where"": {
            ""fieldFilter"": {
                ""field"": {""fieldPath"": ""close""},
                ""op"": ""GREATER_THAN"",
                ""value"": {""doubleValue"": 700}
            }
        },
        ""orderBy"": [{""field"": {""fieldPath"": ""close""}, ""direction"": ""DESCENDING""}],
        ""limit"": 10
    }
}";

var subUrl = $"{baseUrl}/stocks/ASML.AS:runQuery";
var subResp = await http.PostAsync(subUrl,
    new StringContent(subQuery, Encoding.UTF8, "application/json"));
var subResults = JsonDocument.Parse(await subResp.Content.ReadAsStringAsync());

Console.WriteLine("=== ASML Days Above 700 ===");
foreach (var item in subResults.RootElement.EnumerateArray())
{
    if (!item.TryGetProperty("document", out var pdoc)) continue;
    var f = pdoc.GetProperty("fields");
    Console.WriteLine($"  {GetStr(f, "date")}: close={GetDbl(f, "close"):F2}");
}
```

    === ASML Days Above 700 ===
      2026-02-25: close=1288.40
      2026-02-24: close=1263.40
      2026-02-20: close=1255.60
      2026-02-23: close=1249.20
      2026-02-27: close=1233.40
      2026-02-26: close=1232.40
      2026-03-02: close=1210.40
      2026-03-10: close=1200.00
      2026-03-04: close=1199.80
      2026-03-11: close=1198.80
    

## Write Operations

### Set, Update & Delete

This cell:

1. **Set**: creates `watchlists/test_cs` with name, symbols array, timestamp
2. **Update**: adds MC.PA to symbols via `FieldValue.ArrayUnion` (atomic, no read needed)
3. **Delete**: removes the document

```C#
// SET: create a document
var testRef = db.Collection("watchlists").Document("test_cs");
await testRef.SetAsync(new Dictionary<string, object>
{
    ["name"] = "Test C# Watchlist",
    ["owner"] = "notebook_cs",
    ["symbols"] = new[] { "ASML.AS", "SAP.DE" },
    ["is_public"] = false,
    ["created_at"] = Timestamp.GetCurrentTimestamp(),
    ["stock_count"] = 2,
});
Console.WriteLine("Created test_cs");

// UPDATE: add to array + increment counter
await testRef.UpdateAsync(new Dictionary<string, object>
{
    { "symbols", FieldValue.ArrayUnion("MC.PA") },
    { "stock_count", FieldValue.Increment(1) },
});
Console.WriteLine("Updated: added MC.PA, incremented count");

// DELETE
await testRef.DeleteAsync();
Console.WriteLine("Deleted test_cs");
```

    Created test_cs
    Updated: added MC.PA, incremented count
    Deleted test_cs
    

### Update — ArrayUnion, Increment, ServerTimestamp

This cell:

1. `FieldValue.ArrayUnion("TTE.PA")` — adds to array without duplicates
2. `FieldValue.ArrayRemove("MC.PA")` — removes from array
3. `FieldValue.Increment(1)` — atomic counter increment (no read needed)
4. `FieldValue.ServerTimestamp` — server-side timestamp
5. Reads back to verify, then deletes

```C#
// Create a test doc first
var updRef = db.Collection("watchlists").Document("test_update_cs");
await updRef.SetAsync(new Dictionary<string, object>
{
    ["name"] = "Update Demo",
    ["symbols"] = new[] { "ASML.AS", "MC.PA" },
    ["stock_count"] = 2,
});

// ArrayUnion: add without duplicates
await updRef.UpdateAsync("symbols", FieldValue.ArrayUnion("TTE.PA"));

// ArrayRemove: remove from array
await updRef.UpdateAsync("symbols", FieldValue.ArrayRemove("MC.PA"));

// Increment: atomic counter
await updRef.UpdateAsync("stock_count", FieldValue.Increment(1));

// ServerTimestamp: set by Firestore server
await updRef.UpdateAsync("last_modified", FieldValue.ServerTimestamp);

// Verify
var snap = await updRef.GetSnapshotAsync();
Console.WriteLine($"Symbols: [{string.Join(", ", snap.GetValue<List<object>>("symbols"))}]");
Console.WriteLine($"Count: {snap.GetValue<long>("stock_count")}");
Console.WriteLine($"Modified: {snap.GetValue<Timestamp>("last_modified")}");

// Cleanup
await updRef.DeleteAsync();
Console.WriteLine("Deleted test_update_cs");
```

    Symbols: [ASML.AS, TTE.PA]
    Count: 3
    Modified: Timestamp: 2026-03-22T18:39:01.125Z
    Deleted test_update_cs
    

### Delete a Document

This cell:

1. Creates a temporary document `watchlists/test_delete_cs`
2. Deletes it with `DeleteAsync()`
3. Verifies deletion by checking `Exists`

**Important**: deleting a document does NOT delete its subcollections.
You must delete subcollection documents individually (Firestore has no cascading deletes).

```C#
// DELETE: remove a document
var delRef = db.Collection("watchlists").Document("test_delete_cs");

// Create a temp doc to delete
await delRef.SetAsync(new Dictionary<string, object>
{
    ["name"] = "To Be Deleted",
    ["owner"] = "notebook_cs",
});
Console.WriteLine($"Created: {delRef.Id}");

// Delete it
await delRef.DeleteAsync();
Console.WriteLine($"Deleted: {delRef.Id}");

// Verify
var delCheck = await delRef.GetSnapshotAsync();
Console.WriteLine($"Exists after delete: {delCheck.Exists}");
```

    Created: test_delete_cs
    Deleted: test_delete_cs
    Exists after delete: False
    

## Batch Operations & Transactions

### Batch — Atomic Multi-Write

This cell:

1. Creates a batch with 3 alert documents
2. `CommitAsync()` — all 3 writes happen atomically (all or nothing)
3. Cleans up the test documents

```C#
// BATCH: atomic multi-write (max 500 operations)
var batch = db.StartBatch();
for (int i = 0; i < 3; i++)
{
    batch.Set(db.Collection("alerts").Document($"cs_batch_{i}"), new Dictionary<string, object>
    {
        ["symbol"] = "DEMO.XX",
        ["type"] = "BATCH_TEST",
        ["severity"] = "LOW",
        ["message"] = $"C# batch alert #{i}",
        ["acknowledged"] = false,
        ["tags"] = new[] { "test", "csharp" },
    });
}
await batch.CommitAsync();
Console.WriteLine("Batch committed: 3 alerts");

// Clean up
for (int i = 0; i < 3; i++)
    await db.Collection("alerts").Document($"cs_batch_{i}").DeleteAsync();
Console.WriteLine("Cleaned up");
```

    Batch committed: 3 alerts
    Cleaned up
    

### Transaction — Acknowledge an Alert

This cell:

1. **Read** `alerts/alert_001` inside `RunTransactionAsync`
2. **Check** if `acknowledged` is already `true`
3. **If false**: set `acknowledged = true` and `acknowledged_by = "csharp_notebook"`
4. **If true**: skip (prevent double-ack)
5. **Reset** back to `false` for re-run

The transaction retries automatically if another client modifies the document mid-read.

```C#
// TRANSACTION: read-modify-write
var alertRef = db.Collection("alerts").Document("alert_001");

var result = await db.RunTransactionAsync(async transaction =>
{
    var snapshot = await transaction.GetSnapshotAsync(alertRef);
    var acked = snapshot.GetValue<bool>("acknowledged");

    if (acked)
        return $"[SKIP] {snapshot.Id} was already acknowledged";

    transaction.Update(alertRef, new Dictionary<string, object>
    {
        { "acknowledged", true },
        { "acknowledged_by", "csharp_notebook" },
    });
    return $"[UPDATED] {snapshot.Id}: acknowledged=true";
});

Console.WriteLine($"=== Transaction Result ===");
Console.WriteLine($"  {result}");

// Reset
await alertRef.UpdateAsync(new Dictionary<string, object> { { "acknowledged", false } });
Console.WriteLine("  [RESET] alert_001.acknowledged = false");
```

    === Transaction Result ===
      [UPDATED] alert_001: acknowledged=true
      [RESET] alert_001.acknowledged = false
    

## Real-Time Listeners

**Note**: Firestore C# SDK's `Listen()` method fails on .NET 10 due to the same
`AsyncInterfaces` assembly issue that affects collection reads.

In a real .NET 8/9 project:

```csharp
var listener = db.Collection("stocks")
    .WhereEqualTo("country", "Germany")
    .Listen(snapshot => {
        foreach (var change in snapshot.Changes)
            Console.WriteLine($"[{change.ChangeType}] {change.Document.Id}");
    });
// ... later:
await listener.StopAsync();
```

For .NET 10 notebooks, use REST polling (same pattern as the GCP notebook, Section 15)
or run the Python listener instead.

## Aggregation Queries

**Note**: Firestore C# SDK aggregation methods (`Count`, `Sum`, `Avg`) also fail
on .NET 10 due to the `AsyncInterfaces` issue.

In a real .NET 8/9 project:

```csharp
var count = await db.Collection("stocks")
    .WhereEqualTo("country", "Germany")
    .Count()
    .GetSnapshotAsync();
Console.WriteLine($"Count: {count.Count}");
```

For .NET 10 notebooks, use the REST API `runAggregationQuery` endpoint,
or run the Python aggregation cells.

## Collection Group Queries

### Query Across ALL Price Subcollections

This cell:

1. Sends a collection group query (`allDescendants: true`) for `prices`
2. Orders by `close` descending, takes top 10
3. Extracts parent symbol from the document path

**Prerequisite**: field exemption for `close` on `prices` collection group
(created from the Python notebook's `ensure_index()`).

```C#
// SDK equivalent (.NET 8/9):
//   var docs = await db.CollectionGroup("prices")
//       .OrderByDescending("close")
//       .Limit(10)
//       .GetSnapshotAsync();

// Collection group needs a field exemption
await EnsureIndex("prices", new[] { ("close", "DESCENDING") }, scope: "COLLECTION_GROUP");

// Collection group query: highest closes across ALL stocks
var cgQuery = @"{
    ""structuredQuery"": {
        ""from"": [{""collectionId"": ""prices"", ""allDescendants"": true}],
        ""orderBy"": [{""field"": {""fieldPath"": ""close""}, ""direction"": ""DESCENDING""}],
        ""limit"": 10
    }
}";

Console.WriteLine("=== Highest Closes Across All Stocks ===");
var cgResp = await http.PostAsync($"{baseUrl}:runQuery",
    new StringContent(cgQuery, Encoding.UTF8, "application/json"));
var cgResults = JsonDocument.Parse(await cgResp.Content.ReadAsStringAsync());

foreach (var item in cgResults.RootElement.EnumerateArray())
{
    if (!item.TryGetProperty("document", out var pdoc)) continue;
    var path = pdoc.GetProperty("name").GetString();
    var parts = path.Split("/");
    var symbol = parts[^3]; // .../stocks/{symbol}/prices/{date}
    var f = pdoc.GetProperty("fields");
    Console.WriteLine($"  {symbol,-12} {GetStr(f, "date")}  close={GetDbl(f, "close"),10:F2}");
}
```

      Field exemption ready: prices/close
    === Highest Closes Across All Stocks ===
      RMS.PA       2026-02-20  close=   2112.00
      RMS.PA       2026-02-23  close=   2106.00
      RMS.PA       2026-02-24  close=   2080.00
      RMS.PA       2026-02-25  close=   2062.00
      RMS.PA       2026-02-26  close=   2060.00
      RMS.PA       2026-02-27  close=   2049.00
      RMS.PA       2026-03-02  close=   1967.00
      RMS.PA       2026-03-10  close=   1948.00
      RMS.PA       2026-03-04  close=   1930.00
      RMS.PA       2026-03-11  close=   1920.50
    

### Collection Group — Filter by Date

This cell:

1. Dynamically finds the latest available date from ASML's prices
2. Queries ALL `prices` subcollections for that date using `allDescendants: true`
3. Orders by `close` descending, limits to 10
4. Prints cross-stock closing prices for that day

```C#
// SDK equivalent (.NET 8/9):
//   var docs = await db.CollectionGroup("prices")
//       .WhereEqualTo("date", targetDate)
//       .OrderByDescending("close")
//       .Limit(10)
//       .GetSnapshotAsync();

// Collection group + date filter needs a field exemption
await EnsureIndex("prices", new[] { ("date", "ASCENDING") }, scope: "COLLECTION_GROUP");

// Find latest available date
var latestQuery = @"{
    ""structuredQuery"": {
        ""from"": [{""collectionId"": ""prices""}],
        ""orderBy"": [{""field"": {""fieldPath"": ""date""}, ""direction"": ""DESCENDING""}],
        ""limit"": 1
    }
}";
var latestResp = await http.PostAsync($"{baseUrl}/stocks/ASML.AS:runQuery",
    new StringContent(latestQuery, Encoding.UTF8, "application/json"));
var latestResults = JsonDocument.Parse(await latestResp.Content.ReadAsStringAsync());
var targetDate = "2026-03-12"; // fallback
foreach (var item in latestResults.RootElement.EnumerateArray())
    if (item.TryGetProperty("document", out var ld))
        targetDate = GetStr(ld.GetProperty("fields"), "date");

// Collection group: all prices on that date
var dateQuery = $@"{{
    ""structuredQuery"": {{
        ""from"": [{{""collectionId"": ""prices"", ""allDescendants"": true}}],
        ""where"": {{
            ""fieldFilter"": {{
                ""field"": {{""fieldPath"": ""date""}},
                ""op"": ""EQUAL"",
                ""value"": {{""stringValue"": ""{targetDate}""}}
            }}
        }},
        ""orderBy"": [{{""field"": {{""fieldPath"": ""close""}}, ""direction"": ""DESCENDING""}}],
        ""limit"": 10
    }}
}}";

Console.WriteLine($"=== All Prices on {targetDate} ===");
var dateDocs = await RestQuery(dateQuery);
foreach (var fdoc in dateDocs)
{
    var path = fdoc.GetProperty("name").GetString();
    var symbol = path.Split("/")[^3];
    var f = fdoc.GetProperty("fields");
    Console.WriteLine($"  {symbol,-12} close={GetDbl(f, "close"),10:F2}  volume={GetInt(f, "volume"),12:N0}");
}
```

      Field exemption ready: prices/date
    === All Prices on 2026-03-12 ===
      RMS.PA       close=   1906.00  volume=      18'681
      RHM.DE       close=   1551.50  volume=     158'741
      ASML.AS      close=   1190.80  volume=     128'223
      ADYEN.AS     close=    925.70  volume=      27'887
      ARGX.BR      close=    626.60  volume=      14'083
      MUV2.DE      close=    526.20  volume=      86'783
      MC.PA        close=    494.35  volume=     171'997
      OR.PA        close=    360.80  volume=      82'621
      ALV.DE       close=    348.70  volume=     182'426
      SAF.PA       close=    315.40  volume=     160'065
    

## Pagination & Cursors

### Cursor-Based Pagination

This cell:

1. Fetches stocks 5 at a time using `pageSize` and `pageToken`
2. Follows `nextPageToken` from each response to get the next page
3. Stops after 2 pages (demo limit)

```C#
// SDK equivalent (.NET 8/9):
//   var query = db.Collection("stocks").OrderBy("symbol").Limit(5);
//   QuerySnapshot snapshot = await query.GetSnapshotAsync();
//   // Next page:
//   query = db.Collection("stocks").OrderBy("symbol")
//       .StartAfter(snapshot.Documents.Last())
//       .Limit(5);

// Paginate: 5 stocks per page, 2 pages
Console.WriteLine("=== Paginated Stock List ===");
string nextToken = null;
for (int page = 1; page <= 2; page++)
{
    var pageUrl = $"{baseUrl}/stocks?pageSize=5"
        + (nextToken != null ? $"&pageToken={nextToken}" : "");
    var pageResp = await http.GetAsync(pageUrl);
    var pageJson = JsonDocument.Parse(await pageResp.Content.ReadAsStringAsync());

    Console.WriteLine($"\n--- Page {page} ---");
    if (pageJson.RootElement.TryGetProperty("documents", out var pageDocs))
    {
        foreach (var fdoc in pageDocs.EnumerateArray())
        {
            var name = fdoc.GetProperty("name").GetString().Split("/")[^1];
            var fields = fdoc.GetProperty("fields");
            Console.WriteLine($"  {name,-12} {GetStr(fields, "short_name"),-20}");
        }
    }

    nextToken = pageJson.RootElement.TryGetProperty("nextPageToken", out var tok)
        ? tok.GetString() : null;
    if (nextToken == null) break;
}
```

    === Paginated Stock List ===
    
    --- Page 1 ---
      ABI.BR       AB INBEV            
      AD.AS        KONINKLIJKE AHOLD DELHAIZE N.V.
      ADS.DE       adidas AG           
      ADYEN.AS     ADYEN               
      AI.PA        AIR LIQUIDE         
    
    --- Page 2 ---
      AIR.PA       AIRBUS SE           
      ALV.DE       Allianz SE          
      ARGX.BR      ARGENX SE           
      ASML.AS      ASML HOLDING        
      BAS.DE       BASF SE             
    

## Maintenance & Monitoring

### Collection Inventory

This cell:

1. Lists 6 known collections
2. Counts documents in each via REST
3. Prints a summary table

```C#
// SDK equivalent (.NET 8/9):
//   foreach (var coll in db.ListRootCollectionsAsync())
//   {
//       var snapshot = await coll.Count().GetSnapshotAsync();
//       Console.WriteLine($"  {coll.Id}: {snapshot.Count}");
//   }

// List collections and count documents
Console.WriteLine("=== Collections ===");
foreach (var coll in new[] { "stocks", "sectors", "alerts", "pipeline_runs", "watchlists", "config" })
{
    var r = await http.GetAsync($"{baseUrl}/{coll}?pageSize=1000");
    var j = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
    var count = j.RootElement.TryGetProperty("documents", out var d) ? d.GetArrayLength() : 0;
    Console.WriteLine($"  {coll,-20} {count,5} documents");
}
```

    === Collections ===
      stocks                  50 documents
      sectors                 10 documents
      alerts                  20 documents
      pipeline_runs           15 documents
      watchlists               3 documents
      config                   2 documents
    

### List Subcollections

This cell:

1. Lists subcollections under `stocks/ASML.AS` via REST API
2. Prints the subcollection name and a sample document

```C#
// SDK equivalent (.NET 8/9):
//   var subCollections = db.Collection("stocks").Document("ASML.AS")
//       .ListCollectionsAsync();
//   await foreach (var sub in subCollections)
//       Console.WriteLine($"  {sub.Id}");

// List subcollections of a document
var subCollUrl = $"{baseUrl}/stocks/ASML.AS/prices?pageSize=1";
var subCollResp = await http.GetAsync(subCollUrl);
var subCollJson = JsonDocument.Parse(await subCollResp.Content.ReadAsStringAsync());

Console.WriteLine("=== Subcollections of stocks/ASML.AS ===");
if (subCollJson.RootElement.TryGetProperty("documents", out var subDocs))
{
    Console.WriteLine($"  prices: {subDocs.GetArrayLength()}+ documents (showing 1)");
    var first = subDocs[0];
    var f = first.GetProperty("fields");
    Console.WriteLine($"    Sample: date={GetStr(f, "date")}, close={GetDbl(f, "close"):F2}");
}
```

    === Subcollections of stocks/ASML.AS ===
      prices: 1+ documents (showing 1)
        Sample: date=2026-02-20, close=1255.60
    

### Find Stale Documents

This cell:

1. Queries `pipeline_runs` started more than 48 hours ago
2. Uses `LESS_THAN` filter on `started_at` timestamp field
3. Prints stale runs for freshness monitoring

```C#
// SDK equivalent (.NET 8/9):
//   var cutoff = Timestamp.FromDateTime(DateTime.UtcNow.AddHours(-48));
//   var docs = await db.Collection("pipeline_runs")
//       .WhereLessThan("started_at", cutoff)
//       .OrderBy("started_at")
//       .Limit(10)
//       .GetSnapshotAsync();

// Find stale pipeline runs (>48h old)
var cutoff = DateTime.UtcNow.AddHours(-48).ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
var staleQuery = $@"{{
    ""structuredQuery"": {{
        ""from"": [{{""collectionId"": ""pipeline_runs""}}],
        ""where"": {{
            ""fieldFilter"": {{
                ""field"": {{""fieldPath"": ""started_at""}},
                ""op"": ""LESS_THAN"",
                ""value"": {{""timestampValue"": ""{cutoff}""}}
            }}
        }},
        ""orderBy"": [{{""field"": {{""fieldPath"": ""started_at""}}, ""direction"": ""ASCENDING""}}],
        ""limit"": 10
    }}
}}";

Console.WriteLine("=== Stale Pipeline Runs (>48h) ===");
foreach (var fdoc in await RestQuery(staleQuery))
{
    var name = fdoc.GetProperty("name").GetString().Split("/")[^1];
    var f = fdoc.GetProperty("fields");
    Console.WriteLine($"  {name}: status={GetStr(f, "status")}");
}
```

    === Stale Pipeline Runs (>48h) ===
      run_015: status=SUCCESS
      run_014: status=SUCCESS
      run_013: status=SUCCESS
    

### Find Failed Pipeline Runs

This cell:

1. Queries `pipeline_runs` where `status == "FAILED"`
2. Inspects the `steps` array to find which step failed

```C#
// SDK equivalent (.NET 8/9):
//   var docs = await db.Collection("pipeline_runs")
//       .WhereEqualTo("status", "FAILED")
//       .Limit(10)
//       .GetSnapshotAsync();

// Failed pipeline runs
var failedQuery = @"{
    ""structuredQuery"": {
        ""from"": [{""collectionId"": ""pipeline_runs""}],
        ""where"": {
            ""fieldFilter"": {
                ""field"": {""fieldPath"": ""status""},
                ""op"": ""EQUAL"",
                ""value"": {""stringValue"": ""FAILED""}
            }
        },
        ""limit"": 10
    }
}";

Console.WriteLine("=== Failed Pipeline Runs ===");
foreach (var fdoc in await RestQuery(failedQuery))
{
    var name = fdoc.GetProperty("name").GetString().Split("/")[^1];
    var f = fdoc.GetProperty("fields");
    Console.WriteLine($"  {name}: status={GetStr(f, "status")}");
}
```

    === Failed Pipeline Runs ===
      run_004: status=FAILED
      run_005: status=FAILED
      run_006: status=FAILED
    

### Unacknowledged Critical Alerts

This cell:

1. Compound filter: `severity == "HIGH"` AND `acknowledged == false`
2. Returns alerts needing immediate attention

```C#
// SDK equivalent (.NET 8/9):
//   var docs = await db.Collection("alerts")
//       .WhereEqualTo("severity", "HIGH")
//       .WhereEqualTo("acknowledged", false)
//       .Limit(10)
//       .GetSnapshotAsync();

// Compound query on alerts needs a composite index
await EnsureIndex("alerts", new[] {
    ("severity", "ASCENDING"),
    ("acknowledged", "ASCENDING"),
});

// Unacknowledged HIGH alerts
var alertQuery = @"{
    ""structuredQuery"": {
        ""from"": [{""collectionId"": ""alerts""}],
        ""where"": {
            ""compositeFilter"": {
                ""op"": ""AND"",
                ""filters"": [
                    {""fieldFilter"": {""field"": {""fieldPath"": ""severity""}, ""op"": ""EQUAL"", ""value"": {""stringValue"": ""HIGH""}}},
                    {""fieldFilter"": {""field"": {""fieldPath"": ""acknowledged""}, ""op"": ""EQUAL"", ""value"": {""booleanValue"": false}}}
                ]
            }
        },
        ""limit"": 10
    }
}";

Console.WriteLine("=== Unacknowledged HIGH Alerts ===");
foreach (var fdoc in await RestQuery(alertQuery))
{
    var f = fdoc.GetProperty("fields");
    Console.WriteLine($"  {fdoc.GetProperty("name").GetString().Split("/")[^1]}: {GetStr(f, "symbol")} — {GetStr(f, "message")}");
}
```

      Index exists: alerts/severity + acknowledged.... ready!
    === Unacknowledged HIGH Alerts ===
      alert_001: BAS.DE — BAS.DE triggered price drop alert
      alert_008: UCG.MI — UCG.MI triggered weight change alert
      alert_009: ENI.MI — ENI.MI triggered volume spike alert
      alert_010: DG.PA — DG.PA triggered momentum flip alert
      alert_011: SAP.DE — SAP.DE triggered price drop alert
      alert_020: DHL.DE — DHL.DE triggered rank change alert
    

### Read Application Config

This cell:

1. Reads `config/pipeline` — fetch interval, retries, thresholds
2. Prints all key-value pairs

```C#
// SDK equivalent (.NET 8/9):
//   var doc = await db.Collection("config").Document("pipeline").GetSnapshotAsync();
//   var dict = doc.ToDictionary();
//   foreach (var kv in dict)
//       Console.WriteLine($"  {kv.Key}: {kv.Value}");

// Read config document
Console.WriteLine("=== Pipeline Config ===");
var configResp = await http.GetAsync($"{baseUrl}/config/pipeline");
var configJson = JsonDocument.Parse(await configResp.Content.ReadAsStringAsync());

if (configJson.RootElement.TryGetProperty("fields", out var configFields))
{
    foreach (var prop in configFields.EnumerateObject())
    {
        var val = prop.Value.EnumerateObject().First();
        Console.WriteLine($"  {prop.Name}: {val.Value}");
    }
}
```

    === Pipeline Config ===
      last_modified_by: admin
      fetch_interval_seconds: 60
      last_modified_at: 2026-03-22T17:02:47.409688Z
      enabled_indices: {
            "values": [
              {
                "stringValue": "euro_stoxx_50"
              },
              {
                "stringValue": "stoxx_usa_50"
              },
              {
                "stringValue": "stoxx_asia_50"
              }
            ]
          }
      max_retries: 3
      alert_thresholds: {
            "fields": {
              "price_drop_pct": {
                "doubleValue": -3
              },
              "volume_spike_ratio": {
                "doubleValue": 2
              },
              "rank_change_min": {
                "integerValue": "3"
              }
            }
          }
    
