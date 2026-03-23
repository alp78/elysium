---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [reference, programming-languages, csharp, dotnet, gcp]
aliases: [Google Cloud, BigQuery, Cloud Storage, GCS, Pub/Sub, cloud SDK]
keywords: [Google.Cloud.BigQuery, Google.Cloud.Storage, Google.Cloud.PubSub, service account, GCP, dotnet GCP]
description: "C# GCP reference with executable examples and cell outputs — covers BigQuery, Cloud Storage, Pub/Sub, and authentication with the Google Cloud .NET SDK. See [[15_GCP]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[15_GCP]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 15. GCP - C#

![Pipeline Architecture](index_lab.jpg)

## How the Pipeline Works

<small>

| Step | GCP Service | What Happens |
|------|------------|--------------|
| **1. Fetch** | *yfinance* | Fetch OHLCV market data for 5 Euro Stoxx tickers (ASML, MC, SAP, SIE, TTE) — 90 days of daily prices |
| **2. Upload** | **Cloud Storage** | Upload raw CSV to `gs://bucket/bronze/ohlcv/` — this is the **Bronze** layer (raw, immutable) |
| **3. Load** | **BigQuery** | Load CSV into `bronze_ohlcv` table — partitioned by date, clustered by symbol |
| **4. Transform** | **BigQuery** | SQL window functions compute daily returns → write to `silver_ohlcv` — the **Silver** layer (cleaned) |
| **5. Score** | **BigQuery** | Compute 30-day momentum, volume ratios, composite rankings → write to `gold_scores` — the **Gold** layer (analytics-ready) |
| **6. Publish** | **Firestore** | Write gold scores to `scores_latest` collection — real-time dashboard access, no polling needed |
| **7. Notify** | **Pub/Sub** | Publish pipeline events (`ohlcv_loaded`, `silver_computed`, `gold_scored`) — downstream consumers subscribe |
| **8. Pulse** | **Firestore** | Pulse scheduler (every 60s) writes live price snapshots to `pulse_live` — real-time listeners catch changes |
| **9. Secure** | **Secret Manager** | All credentials (DB passwords, API keys) retrieved at runtime — never hardcoded |
| **10. Observe** | **Cloud Monitoring** | Structured logs + custom metrics (rows loaded, pipeline duration) — alerts and dashboards |

</small>

## Topics Covered
- Authentication & Setup
- Cloud Storage (GCS)
- BigQuery
- Pub/Sub
- Firestore (+ real-time listeners)
- Secret Manager
- Cloud Monitoring


```C#
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

    probeAddresses(["http://2a02:8308:718a:f200::655c:2050/","http://2a02:8308:718a:f200:8bd4:d06d:33ed:be05:2050/","http://2a02:8308:718a:f200:812b:542c:9d38:5803:2050/","http://fe80::3212:d8da:d32d:4723%14:2050/","http://192.168.0.110:2050/","http://::1:2050/","http://127.0.0.1:2050/","http://fe80::91de:1423:fe62:933b%45:2050/","http://172.25.64.1:2050/"])

        .then((root) => {

        // use probing to find host url and api resources

        // load interactive helpers and language services

        let dotnetInteractiveRequire = require.config({

        context: '12912.Microsoft.DotNet.Interactive.Http.HttpPort',

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


    WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.
    

## 1. Authentication & Setup

**Pipeline role:** The foundation — every GCP service call is authenticated via a service account key. The key file (JSON) is set via `GOOGLE_APPLICATION_CREDENTIALS` env var. All libraries auto-detect it.


```C#
#r "nuget: Google.Cloud.Storage.V1"
#r "nuget: Google.Cloud.BigQuery.V2"
#r "nuget: Google.Cloud.PubSub.V1"
#r "nuget: Microsoft.Bcl.AsyncInterfaces"
#r "nuget: Google.Cloud.Firestore"
#r "nuget: Google.Cloud.SecretManager.V1"
#r "nuget: Google.Cloud.Monitoring.V3"

// GCP Authentication — how C# connects to Google Cloud.
//
// KEY CONCEPTS:
// - Same GOOGLE_APPLICATION_CREDENTIALS env var as Python.
// - All Google.Cloud.* libraries auto-detect the service account key.
// - GoogleCredential.GetApplicationDefault() reads the ADC chain.
// - Python equivalent: same env var, Client(project=...) pattern.

using Google.Apis.Auth.OAuth2;

var projectId = "index-lab-2";
var region = "europe-west1";
var bucketName = $"{projectId}-index-data";
var bqDataset = "index_data";

var creds = GoogleCredential.GetApplicationDefault();
Console.WriteLine($"Authenticated: {creds.UnderlyingCredential.GetType().Name}");
Console.WriteLine($"Project: {projectId}");
Console.WriteLine($"Bucket:  {bucketName}");
```


<div><div></div><div></div><div><strong>Installed Packages</strong><ul><li><span>Google.Cloud.BigQuery.V2, 3.11.0</span></li><li><span>Google.Cloud.Firestore, 4.2.0</span></li><li><span>Google.Cloud.Monitoring.V3, 3.16.0</span></li><li><span>Google.Cloud.PubSub.V1, 3.33.0</span></li><li><span>Google.Cloud.SecretManager.V1, 2.7.0</span></li><li><span>Google.Cloud.Storage.V1, 4.14.0</span></li><li><span>Microsoft.Bcl.AsyncInterfaces, 10.0.5</span></li></ul></div></div>


    Authenticated: UserCredential
    Project: index-lab-2
    Bucket:  index-lab-2-index-data
    

## 2. Cloud Storage (GCS)

**Pipeline role: BRONZE LAYER** — Raw data lands here first. yfinance OHLCV data is fetched and uploaded as CSV to `gs://bucket/bronze/ohlcv/`. GCS is the data lake — immutable, versioned, cheap storage. Downstream services (BigQuery, pipelines) read from here.


```C#
using System.IO;
using Google.Cloud.Storage.V1;
using System.Text;

// Cloud Storage — upload/download/list objects.
// Python equivalent: from google.cloud import storage

// Create GCS client — authenticates via GOOGLE_APPLICATION_CREDENTIALS
// Pipeline role: handles all object storage (upload/download/list)
var storageClient = StorageClient.Create();

// ─── List blobs in bronze/ ───
Console.WriteLine("=== List Bronze Blobs ===");
// List blobs in the bronze prefix — like `gsutil ls gs://bucket/bronze/`
foreach (var obj in storageClient.ListObjects(bucketName, "bronze/"))
    Console.WriteLine($"  {obj.Name,-50} {obj.Size,10:N0} bytes");

// ─── Upload a file ───
Console.WriteLine("\n=== Upload CSV ===");
var csvContent = "symbol,date,close\nASML.AS,2026-03-20,685.40\nMC.PA,2026-03-20,890.20";
var csvBytes = Encoding.UTF8.GetBytes(csvContent);
var blobName = $"bronze/ohlcv/{DateTime.Now:yyyyMMdd}_test_cs.csv";

using (var stream = new MemoryStream(csvBytes))
    // Upload bytes to GCS — Pipeline role: write BRONZE layer data
    storageClient.UploadObject(bucketName, blobName, "text/csv", stream);
Console.WriteLine($"  Uploaded: gs://{bucketName}/{blobName} ({csvBytes.Length} bytes)");

// ─── Download and verify ───
Console.WriteLine("\n=== Download & Verify ===");
using (var ms = new MemoryStream())
{
    // Download object to a MemoryStream — for verification or reprocessing
    storageClient.DownloadObject(bucketName, blobName, ms);
    var downloaded = Encoding.UTF8.GetString(ms.ToArray());
    Console.WriteLine($"  Downloaded ({ms.Length} bytes):");
    foreach (var line in downloaded.Split('\n'))
        Console.WriteLine($"    {line}");
}

// ─── Delete test blob ───
// Delete the test blob — in production, you'd keep bronze data immutable
storageClient.DeleteObject(bucketName, blobName);
Console.WriteLine($"\n  Deleted: {blobName}");
```

    === List Bronze Blobs ===
      bronze/.keep                                                0 bytes
      bronze/ohlcv/20260322_ohlcv.csv                        35'426 bytes
    
    === Upload CSV ===
      Uploaded: gs://index-lab-2-index-data/bronze/ohlcv/20260322_test_cs.csv (67 bytes)
    
    === Download & Verify ===
      Downloaded (67 bytes):
        symbol,date,close
        ASML.AS,2026-03-20,685.40
        MC.PA,2026-03-20,890.20
    
      Deleted: bronze/ohlcv/20260322_test_cs.csv
    

## 3. BigQuery

**Pipeline role: SILVER + GOLD LAYERS** — The analytics engine. Bronze data is loaded from GCS into BigQuery tables. SQL transforms compute daily returns (silver) and composite scores (gold). BigQuery handles petabyte-scale data with serverless SQL — no infrastructure to manage.


```C#
using Google.Cloud.BigQuery.V2;

// BigQuery — serverless analytics warehouse.
// Python equivalent: from google.cloud import bigquery

// Create BigQuery client — all SQL queries and loads go through this
var bqClient = BigQueryClient.Create(projectId);

// ─── Query bronze table ───
Console.WriteLine("=== Query Bronze OHLCV ===");
var sql = $@"
    SELECT symbol, date, ROUND(close, 2) AS close, volume
    FROM `{projectId}.{bqDataset}.bronze_ohlcv`
    ORDER BY date DESC, symbol
    LIMIT 10";

var results = bqClient.ExecuteQuery(sql, parameters: null);
Console.WriteLine($"{"Symbol",-10} {"Date",-12} {"Close",10} {"Volume",14}");
Console.WriteLine(new string('─', 50));
foreach (var row in results)
    Console.WriteLine($"  {row["symbol"],-10} {row["date"],-12} {row["close"],10} {row["volume"],14}");

// ─── Query gold scores ───
Console.WriteLine("\n=== Query Gold Scores ===");
sql = $@"
    SELECT symbol, ROUND(close, 2) AS close,
        ROUND(momentum_score * 100, 2) AS momentum_pct,
        ROUND(volume_score, 2) AS vol_ratio,
        composite_rank
    FROM `{projectId}.{bqDataset}.gold_scores`
    ORDER BY composite_rank";

foreach (var row in bqClient.ExecuteQuery(sql, parameters: null))
    Console.WriteLine($"  {row["composite_rank"],2}. {row["symbol"],-10} close={row["close"],8}  momentum={row["momentum_pct"],+6}%  vol={row["vol_ratio"]}");
```

    === Query Bronze OHLCV ===
    Symbol     Date              Close         Volume
    ──────────────────────────────────────────────────
      ASML.AS    20-Mar-26 0:00:00     1128.2        2685518
      MC.PA      20-Mar-26 0:00:00     457.95        1359678
      SAP.DE     20-Mar-26 0:00:00     153.82        9371857
      SIE.DE     20-Mar-26 0:00:00     203.75        3770741
      TTE.PA     20-Mar-26 0:00:00      76.96       13084381
      ASML.AS    19-Mar-26 0:00:00     1168.6        1057331
      MC.PA      19-Mar-26 0:00:00     460.25         772011
      SAP.DE     19-Mar-26 0:00:00        160        3819500
      SIE.DE     19-Mar-26 0:00:00      210.3        2407185
      TTE.PA     19-Mar-26 0:00:00      78.59       13162837
    
    === Query Gold Scores ===
       1. TTE.PA     close=   76.96  momentum= 12.82%  vol=1.61
       2. ASML.AS    close=  1128.2  momentum= -6.15%  vol=3.01
       3. SAP.DE     close=  153.82  momentum=  -8.7%  vol=2.84
       4. MC.PA      close=  457.95  momentum= -10.9%  vol=1.97
       5. SIE.DE     close=  203.75  momentum=-13.24%  vol=2.33
    

## 4. Pub/Sub

**Pipeline role: EVENT BUS** — Decouples pipeline steps. After each ETL stage completes, a message is published ("ohlcv_loaded", "silver_computed", "gold_scored"). Downstream consumers (dashboards, alerting, other pipelines) subscribe to these events. Enables async, event-driven architecture.


```C#
using Google.Cloud.PubSub.V1;
using Google.Protobuf;

// Pub/Sub — publish and pull messages.
// Python equivalent: from google.cloud import pubsub_v1

var topicName = TopicName.FromProjectTopic(projectId, "pipeline-events");
var subName = SubscriptionName.FromProjectSubscription(projectId, "pipeline-events-sub");

// ─── Publish ───
Console.WriteLine("=== Publish Events ===");
// Create async publisher — Pipeline role: emit events after each ETL step
// Downstream consumers (dashboards, alerts) subscribe to these events
var publisher = await PublisherClient.CreateAsync(topicName);

var events = new[] { "ohlcv_loaded_cs", "silver_computed_cs", "gold_scored_cs" };
foreach (var evt in events)
{
    // Publish a message — data is bytes, attributes are string metadata
    var msgId = await publisher.PublishAsync(new PubsubMessage
    {
        Data = ByteString.CopyFromUtf8($"{{\"event\": \"{evt}\", \"source\": \"csharp\"}}"),
        Attributes = { ["pipeline"] = "index_etl" }
    });
    Console.WriteLine($"  Published: {evt} (msg_id={msgId})");
}
// Flush pending messages and close the publisher connection
await publisher.ShutdownAsync(TimeSpan.FromSeconds(5));

await Task.Delay(2000);  // let messages propagate

// ─── Pull ───
Console.WriteLine("\n=== Pull Messages ===");
// Create subscriber client for synchronous pull
var subscriber = SubscriberServiceApiClient.Create();
// Pull messages — synchronous batch pull (for notebooks/scripts)
// In production services, use SubscriberClient for streaming pull
var response = subscriber.Pull(subName, maxMessages: 10);

var ackIds = new List<string>();
foreach (var msg in response.ReceivedMessages)
{
    var data = msg.Message.Data.ToStringUtf8();
    Console.WriteLine($"  {msg.Message.PublishTime:HH:mm:ss} | {data}");
    ackIds.Add(msg.AckId);
}

if (ackIds.Count > 0)
{
    // Acknowledge processed messages — prevents redelivery
    subscriber.Acknowledge(subName, ackIds);
    Console.WriteLine($"\n  Acknowledged {ackIds.Count} messages");
}
```

    === Publish Events ===
      Published: ohlcv_loaded_cs (msg_id=18105610464022399)
      Published: silver_computed_cs (msg_id=18105731398234272)
      Published: gold_scored_cs (msg_id=18105493728682506)
    
    === Pull Messages ===
      "2026-03-22T13:37:42.738Z" | {"event": "ohlcv_loaded_cs", "source": "csharp"}
      "2026-03-22T13:37:42.865Z" | {"event": "silver_computed_cs", "source": "csharp"}
      "2026-03-22T13:37:42.973Z" | {"event": "gold_scored_cs", "source": "csharp"}
    
      Acknowledged 3 messages
    

## 5. Firestore

**Pipeline role: REAL-TIME LAYER** — The live dashboard backend. Gold scores and pulse snapshots are written here for instant access. Firestore supports real-time listeners — dashboards get push notifications when data changes, without polling. Think of it as the "hot" layer vs BigQuery's "warm" layer.


```C#
using Google.Cloud.Firestore;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;

// Firestore -- NoSQL document database.
// Python equivalent: from google.cloud import firestore
//
// NOTE: Firestore SDK reads hit a missing assembly bug on .NET 10.
// Writes work fine. For reads, we use the Firestore REST API.
// In a real .NET 8/9 project, SDK reads work perfectly.

// Create Firestore client — connects to the document database
// Pipeline role: REAL-TIME layer — latest scores for dashboards
var firestoreDb = FirestoreDb.Create(projectId);

// --- Write sample scores (SDK) ---
Console.WriteLine("=== Write to Firestore ===");
var scores = new[]
{
    new { Symbol = "ASML.AS", Close = 685.40, Rank = 1 },
    new { Symbol = "MC.PA",   Close = 890.20, Rank = 2 },
    new { Symbol = "SAP.DE",  Close = 245.80, Rank = 3 },
};

foreach (var s in scores)
{
    var docRef = firestoreDb.Collection("scores_latest_cs").Document(s.Symbol);
    // Set (upsert) document — creates or overwrites entirely
    await docRef.SetAsync(new Dictionary<string, object>
    {
        ["symbol"] = s.Symbol,
        ["close"] = s.Close,
        ["composite_rank"] = s.Rank,
        ["updated_at"] = Timestamp.GetCurrentTimestamp(),
    });
}
Console.WriteLine($"  Written {scores.Length} documents");

// --- Read pulse_live via REST API ---
Console.WriteLine("\n=== Read Pulse Live Data (REST API) ===");

// Get access token — works with both ServiceAccount and UserCredential
var credential = Google.Apis.Auth.OAuth2.GoogleCredential.GetApplicationDefault()
    .CreateScoped("https://www.googleapis.com/auth/datastore");
// Get OAuth2 access token for REST API calls
// Works with both ServiceAccountCredential and UserCredential
var token = await credential.UnderlyingCredential.GetAccessTokenForRequestAsync();

var httpClient = new HttpClient();
httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

var restUrl = $"https://firestore.googleapis.com/v1/projects/{projectId}/databases/(default)/documents/pulse_live";
// Fetch documents via Firestore REST API
// Workaround for .NET 10 SDK compatibility issue — SDK writes work fine
var response = await httpClient.GetAsync(restUrl);
var jsonStr = await response.Content.ReadAsStringAsync();
var jsonDoc = JsonDocument.Parse(jsonStr);

if (!jsonDoc.RootElement.TryGetProperty("documents", out var documents))
{
    Console.WriteLine("  No pulse data yet. Run: python pulse_scheduler.py --once");
}
else
{
    foreach (var fdoc in documents.EnumerateArray())
    {
        var docName = fdoc.GetProperty("name").GetString();
        var symbol = docName.Split("/")[^1];
        var fields = fdoc.GetProperty("fields");

        var price = "N/A";
        if (fields.TryGetProperty("current_price", out var pv))
            price = pv.GetProperty("doubleValue").GetDouble().ToString("F2");

        double? chgPct = null;
        if (fields.TryGetProperty("price_change_pct", out var cv))
            chgPct = cv.GetProperty("doubleValue").GetDouble();

        var chgStr = chgPct.HasValue ? string.Format("{0:+0.00}%", chgPct.Value) : "N/A";
        Console.WriteLine($"  {symbol,-10}  price={price,10}  change={chgStr,8}");
    }
}

// --- Cleanup scores ---
foreach (var s in scores)
    await firestoreDb.Collection("scores_latest_cs").Document(s.Symbol).DeleteAsync();
Console.WriteLine($"\n  Cleaned up {scores.Length} score documents");
```

    === Write to Firestore ===
      Written 3 documents
    
    === Read Pulse Live Data (REST API) ===
      ASML.AS     price=   1128.20  change= -+3.46%
      MC.PA       price=    457.95  change= -+0.50%
      SAP.DE      price=    153.82  change= -+3.86%
      SIE.DE      price=    203.75  change= -+3.11%
      TTE.PA      price=     76.96  change= -+2.07%
    
      Cleaned up 3 score documents
    


```C#
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;

// Firestore Real-Time Polling via REST API.
//
// The SDK's Listen() also hits the AsyncInterfaces bug on .NET 10.
// In a real .NET 8/9 project, use the push listener:
//   firestoreDb.Collection("pulse_live").Listen(snapshot => { ... });
//
// Python equivalent: collection.on_snapshot(callback) -- true push listener.
//
// Run pulse_scheduler.py in a separate terminal first:
//   python pulse_scheduler.py --minutes 5

var cred = Google.Apis.Auth.OAuth2.GoogleCredential.GetApplicationDefault()
    .CreateScoped("https://www.googleapis.com/auth/datastore");
var accessToken = await cred.UnderlyingCredential.GetAccessTokenForRequestAsync();

var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

var apiUrl = $"https://firestore.googleapis.com/v1/projects/{projectId}/databases/(default)/documents/pulse_live";

Console.WriteLine("=== Firestore Polling (REST API) ===");
Console.WriteLine("Polling pulse_live every 30s for 2 minutes...\n");

var previousPrices = new Dictionary<string, string>();
var pollCount = 0;

for (int i = 0; i < 4; i++)  // 4 polls x 30s = 2 minutes
{
    pollCount++;
    var resp = await client.GetAsync(apiUrl);
    var body = await resp.Content.ReadAsStringAsync();
    var parsed = JsonDocument.Parse(body);

    Console.WriteLine($"[Poll #{pollCount} at {DateTime.Now:HH:mm:ss}]");

    if (parsed.RootElement.TryGetProperty("documents", out var docs))
    {
        foreach (var fdoc in docs.EnumerateArray())
        {
            var docName = fdoc.GetProperty("name").GetString();
            var sym = docName.Split("/")[^1];
            var fields = fdoc.GetProperty("fields");

            var priceStr = "N/A";
            if (fields.TryGetProperty("current_price", out var pv))
                priceStr = pv.GetProperty("doubleValue").GetDouble().ToString("F2");

            double? change = null;
            if (fields.TryGetProperty("price_change_pct", out var cv))
                change = cv.GetProperty("doubleValue").GetDouble();

            var status = "UNCHANGED";
            if (!previousPrices.ContainsKey(sym))
                status = "NEW";
            else if (previousPrices[sym] != priceStr)
                status = "CHANGED";

            previousPrices[sym] = priceStr;

            var chgStr = change.HasValue ? string.Format("{0:+0.00}%", change.Value) : "N/A";
            Console.WriteLine($"  [{status,-9}] {sym,-10}  price={priceStr,10}  change={chgStr,8}");
        }
    }

    if (i < 3)
    {
        Console.WriteLine("  Next poll in 30s...\n");
        await Task.Delay(30_000);
    }
}

Console.WriteLine($"\nPolling complete. {pollCount} polls, {previousPrices.Count} tickers tracked.");
```

    === Firestore Polling (REST API) ===
    Polling pulse_live every 30s for 2 minutes...
    
    [Poll #1 at 14:38:00]
      [NEW      ] ASML.AS     price=   1128.20  change= -+3.46%
      [NEW      ] MC.PA       price=    457.95  change= -+0.50%
      [NEW      ] SAP.DE      price=    153.82  change= -+3.86%
      [NEW      ] SIE.DE      price=    203.75  change= -+3.11%
      [NEW      ] TTE.PA      price=     76.96  change= -+2.07%
      Next poll in 30s...
    
    [Poll #2 at 14:38:30]
      [UNCHANGED] ASML.AS     price=   1128.20  change= -+3.46%
      [UNCHANGED] MC.PA       price=    457.95  change= -+0.50%
      [UNCHANGED] SAP.DE      price=    153.82  change= -+3.86%
      [UNCHANGED] SIE.DE      price=    203.75  change= -+3.11%
      [UNCHANGED] TTE.PA      price=     76.96  change= -+2.07%
      Next poll in 30s...
    
    [Poll #3 at 14:39:00]
      [UNCHANGED] ASML.AS     price=   1128.20  change= -+3.46%
      [UNCHANGED] MC.PA       price=    457.95  change= -+0.50%
      [UNCHANGED] SAP.DE      price=    153.82  change= -+3.86%
      [UNCHANGED] SIE.DE      price=    203.75  change= -+3.11%
      [UNCHANGED] TTE.PA      price=     76.96  change= -+2.07%
      Next poll in 30s...
    
    [Poll #4 at 14:39:30]
      [UNCHANGED] ASML.AS     price=   1128.20  change= -+3.46%
      [UNCHANGED] MC.PA       price=    457.95  change= -+0.50%
      [UNCHANGED] SAP.DE      price=    153.82  change= -+3.86%
      [UNCHANGED] SIE.DE      price=    203.75  change= -+3.11%
      [UNCHANGED] TTE.PA      price=     76.96  change= -+2.07%
    
    Polling complete. 4 polls, 5 tickers tracked.
    

## 6. Secret Manager

**Pipeline role: CREDENTIAL VAULT** — All secrets (DB passwords, API keys, connection strings) live here. Pipeline code retrieves them at runtime — never hardcoded, never in git. Supports versioning and rotation. In production, Cloud Run and GKE inject secrets automatically.


```C#
using Google.Cloud.SecretManager.V1;
using Google.Protobuf;

// Secret Manager — secure credential storage.
// Python equivalent: from google.cloud import secretmanager

// Create Secret Manager client
// Pipeline role: ALL credentials retrieved at runtime — never hardcoded
var smClient = SecretManagerServiceClient.Create();

// ─── Read secrets ───
Console.WriteLine("=== Read Secrets ===");
foreach (var secretId in new[] { "index-db-password", "index-api-key" })
{
    var name = $"projects/{projectId}/secrets/{secretId}/versions/latest";
    // Read the latest version of a secret — returns encrypted payload
    var response = smClient.AccessSecretVersion(name);
    var value = response.Payload.Data.ToStringUtf8();
    var masked = value[..3] + new string('*', value.Length - 3);
    Console.WriteLine($"  {secretId}: {masked}");
}

// ─── List secrets ───
Console.WriteLine("\n=== List Secrets ===");
// List all secrets in the project
foreach (var secret in smClient.ListSecrets(new Google.Cloud.SecretManager.V1.ListSecretsRequest { Parent = $"projects/{projectId}" }))
    Console.WriteLine($"  {secret.SecretName.SecretId}");
```

    === Read Secrets ===
      index-db-password: Esg************
      index-api-key: dem***************
    
    === List Secrets ===
      index-api-key
      index-db-password
    

## 7. Cloud Monitoring

**Pipeline role: OBSERVABILITY** — Two components: Cloud Logging (structured log entries for every pipeline event) and Cloud Monitoring (custom metrics for quantitative KPIs). Enables alerting ("pipeline failed", "row count dropped 50%"), dashboards, and post-mortem debugging.


```C#
using Google.Cloud.Monitoring.V3;
using Google.Api;
using Google.Protobuf.WellKnownTypes;

// Cloud Monitoring — write custom metrics and structured logs.
// Python equivalent: from google.cloud import monitoring_v3

// Create Monitoring client for custom metrics
// Pipeline role: quantitative KPIs — rows loaded, latency, errors
var metricClient = MetricServiceClient.Create();
var projectName = $"projects/{projectId}";

// ─── Write custom metric ───
Console.WriteLine("=== Write Custom Metric ===");

var now = DateTimeOffset.UtcNow;
var interval = new TimeInterval
{
    EndTime = Google.Protobuf.WellKnownTypes.Timestamp.FromDateTimeOffset(now),
};

var point = new Point
{
    Interval = interval,
    Value = new TypedValue { Int64Value = 250 },  // simulated row count
};

var timeSeries = new TimeSeries
{
    Metric = new Google.Api.Metric
    {
        Type = "custom.googleapis.com/index_pipeline/rows_loaded",
    },
    Resource = new MonitoredResource
    {
        Type = "global",
    },
};
timeSeries.Points.Add(point);

// Retry — Cloud Monitoring sometimes returns transient Internal errors
for (int attempt = 1; attempt <= 3; attempt++)
{
    try
    {
        // Write the data point — visible in Metrics Explorer within ~60s
        metricClient.CreateTimeSeries(projectName, new[] { timeSeries });
        break;
    }
    catch (Grpc.Core.RpcException ex) when (ex.StatusCode == Grpc.Core.StatusCode.Internal && attempt < 3)
    {
        Console.WriteLine($"  Retry {attempt}/3: {ex.Status.Detail[..50]}...");
        await Task.Delay(3000 * attempt);
    }
}
Console.WriteLine("  Wrote metric: rows_loaded = 250");

Console.WriteLine($"\n=== View in GCP Console ===");
Console.WriteLine($"  Logs:    https://console.cloud.google.com/logs?project={projectId}");
Console.WriteLine($"  Metrics: https://console.cloud.google.com/monitoring/metrics-explorer?project={projectId}");
```

    === Write Custom Metric ===
      Wrote metric: rows_loaded = 250
    
    === View in GCP Console ===
      Logs:    https://console.cloud.google.com/logs?project=index-lab-2
      Metrics: https://console.cloud.google.com/monitoring/metrics-explorer?project=index-lab-2
    

## 8. Summary


```C#
// Summary — GCP C# cheat sheet
//
// AUTHENTICATION:
// GoogleCredential.GetApplicationDefault()           Auto-detect ADC
// GOOGLE_APPLICATION_CREDENTIALS env var             Service account key
//
// CLOUD STORAGE (Google.Cloud.Storage.V1):
// StorageClient.Create()                             Create client
// client.UploadObject(bucket, name, type, stream)    Upload
// client.DownloadObject(bucket, name, stream)        Download
// client.ListObjects(bucket, prefix)                 List blobs
//
// BIGQUERY (Google.Cloud.BigQuery.V2):
// BigQueryClient.Create(projectId)                   Create client
// client.ExecuteQuery(sql, params)                   Run SQL
// client.InsertRows(datasetId, tableId, rows)        Insert rows
//
// PUB/SUB (Google.Cloud.PubSub.V1):
// PublisherClient.CreateAsync(topicName)              Create publisher
// publisher.PublishAsync(message)                     Publish
// subscriber.Pull(subName, maxMessages)              Pull messages
//
// FIRESTORE (Google.Cloud.Firestore):
// FirestoreDb.Create(projectId)                      Create client
// collection.Document(id).SetAsync(data)             Write document
// collection.GetSnapshotAsync()                      Read all docs
//
// SECRET MANAGER (Google.Cloud.SecretManager.V1):
// client.AccessSecretVersion(name)                   Read secret
// client.ListSecrets(projectName)                    List all secrets
//
// CLOUD MONITORING (Google.Cloud.Monitoring.V3):
// client.CreateTimeSeries(project, timeSeries)       Write metric
//
// PYTHON EQUIVALENTS:
// StorageClient           → storage.Client()
// BigQueryClient           → bigquery.Client()
// PublisherClient           → pubsub_v1.PublisherClient()
// FirestoreDb              → firestore.Client()
// SecretManagerServiceClient → secretmanager.SecretManagerServiceClient()
// MetricServiceClient       → monitoring_v3.MetricServiceClient()
```
